import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHmac } from "node:crypto";
import { loadConfig } from "../server/config.js";
import { createDatabase, rows, one } from "../server/db.js";
import { migrate } from "../server/migrate.js";
import { seedCatalog } from "../server/seed.js";
import { passwordHash } from "../server/security.js";
import { buildApp } from "../server/app.js";
import { expireOrders } from "../server/orders.js";
import { runPushOnce } from "../server/push.js";
import { capturePayment, processRefund } from "../server/payments.js";
import { runJobsOnce } from "../server/worker.js";
let app, db, c, a, b, admin, partner1, partner2;
const suffix = randomUUID().slice(0, 8),
  pass = "A-unique-integration-password!";
async function user(role = "customer", name = role) {
  const email = `${name}-${randomUUID()}@example.test`;
  const r = await rows(
    db,
    "INSERT INTO users(name,email,password_hash,role,city) VALUES (?,?,?,?,?)",
    [name, email, await passwordHash(pass), role, "Hyderabad"],
  );
  const login = await app.inject({
    remoteAddress: `127.0.0.${(Number(r.insertId) % 250) + 1}`,
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: pass },
  });
  assert.equal(login.statusCode, 200, login.body);
  return {
    id: String(r.insertId),
    email,
    cookie: login.cookies.find((c) => c.name === "kn_session").value,
    csrf: login.json().csrfToken,
  };
}
async function call(user, method, url, payload, headers = {}) {
  return app.inject({
    method,
    url,
    payload,
    headers: {
      ...(user
        ? { cookie: `kn_session=${user.cookie}`, "x-csrf-token": user.csrf }
        : {}),
      ...headers,
    },
  });
}
async function address(u) {
  const res = await call(u, "POST", "/api/addresses", {
    tag: "Test",
    name: "Integration Customer",
    phone: "9999999999",
    line: "Test-only garden address",
    city: "Hyderabad",
    pincode: "500033",
    isDefault: true,
  });
  assert.equal(res.statusCode, 201, res.body);
  return res.json().id;
}
async function product(stock = 10) {
  const id = randomUUID();
  const cat = await one(db, "SELECT id FROM categories LIMIT 1");
  await rows(
    db,
    "INSERT INTO products(id,category_id,name,description,price_paise,stock,image) VALUES (?,?,?,?,?,?,?)",
    [
      id,
      cat.id,
      "Integration Plant",
      "Test inventory",
      12500,
      stock,
      "plant-monstera.jpg",
    ],
  );
  return id;
}
async function order(u, productId, qty = 1, key = randomUUID()) {
  const aid = u.address || (u.address = await address(u));
  return call(
    u,
    "POST",
    "/api/orders",
    { addressId: aid, items: [{ id: productId, qty }] },
    { "idempotency-key": key },
  );
}
before(async () => {
  c = loadConfig({
    ...process.env,
    NODE_ENV: "test",
    DB_NAME: "kaushik_test",
    REDIS_NAMESPACE: `integration-${suffix}`,
    PAYMENT_MODE: "test",
    LOG_LEVEL: "silent",
  });
  assert.ok(
    ["127.0.0.1", "localhost"].includes(c.DB_HOST),
    "Tests require a local MySQL server",
  );
  db = await createDatabase(c);
  await migrate(db);
  await seedCatalog(db);
  app = await buildApp({
    config: {
      ...c,
      RAZORPAY_WEBHOOK_SECRET: "integration-only-webhook-secret",
    },
    db,
    logger: false,
  });
  await app.ready();
  a = await user("customer", "first");
  b = await user("customer", "second");
  admin = await user("admin", "administrator");
  partner1 = await user("partner", "partnerone");
  partner2 = await user("partner", "partnertwo");
  for (const u of [partner1, partner2]) {
    u.partnerId = randomUUID();
    await rows(
      db,
      "INSERT INTO partners(id,user_id,name,person,city,address,experience,status,available) VALUES (?,?,?,?,?,?,?,'Approved',TRUE)",
      [
        u.partnerId,
        u.id,
        "Test Partner",
        "Test Professional",
        "Hyderabad",
        "Test address",
        "5 years",
      ],
    );
    await rows(
      db,
      "INSERT INTO partner_categories(partner_id,category) VALUES (?,?)",
      [u.partnerId, "Design & landscaping"],
    );
  }
});
after(async () => {
  await app?.close();
  await db?.end();
});
test("public catalog and readiness use real MySQL", async () => {
  const res = await call(null, "GET", "/api/products?limit=2");
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().items.length, 2);
  assert.equal((await call(null, "GET", "/health/ready")).statusCode, 200);
});
test("static website and API share the same server", async () => {
  const response = await call(null, "GET", "/");
  assert.equal(response.statusCode, 200);
  assert.match(response.body, /Kaushik Nursery/);
  assert.equal((await call(null, "GET", "/app.js")).statusCode, 200);
});
test("registration forbids caller-selected administrator role", async () => {
  const res = await call(null, "POST", "/api/auth/register", {
    name: "Attacker",
    email: `attacker-${suffix}@example.test`,
    password: pass,
    role: "admin",
  });
  assert.equal(res.statusCode, 400);
});
test("HttpOnly session and CSRF/origin checks protect writes", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/api/addresses",
    headers: { cookie: `kn_session=${a.cookie}` },
    payload: {},
  });
  assert.equal(res.statusCode, 403);
  const denied = await call(
    a,
    "POST",
    "/api/addresses",
    {},
    { origin: "https://untrusted.example" },
  );
  assert.equal(denied.statusCode, 403);
  assert.equal((await call(null, "GET", "/api/account")).statusCode, 401);
});
test("customers cannot call administrator APIs", async () => {
  assert.equal((await call(a, "GET", "/api/admin/users")).statusCode, 403);
  assert.equal(
    (
      await call(a, "PUT", "/api/admin/settings", {
        maxPartners: 1,
        rotation: false,
      })
    ).statusCode,
    403,
  );
});
test("orders reject client prices and prevent cross-customer access", async () => {
  const p = await product();
  const created = await order(a, p);
  assert.equal(created.statusCode, 201, created.body);
  const o = created.json();
  assert.equal(o.total, 224);
  assert.equal((await call(b, "GET", `/api/orders/${o.id}`)).statusCode, 404);
  assert.equal(
    (await call(b, "POST", `/api/orders/${o.id}/cancel`)).statusCode,
    404,
  );
  const tamper = await call(a, "POST", "/api/payments", {
    orderId: o.id,
    amount: 1,
  });
  assert.equal(tamper.statusCode, 400);
});
test("concurrent buyers cannot oversell one available plant", async () => {
  const p = await product(1);
  const replies = await Promise.all([order(a, p), order(b, p)]);
  assert.deepEqual(replies.map((r) => r.statusCode).sort(), [201, 409]);
  assert.equal(
    (await one(db, "SELECT stock FROM products WHERE id=?", [p])).stock,
    0,
  );
});
test("idempotent concurrent checkout reserves inventory once", async () => {
  const p = await product(10),
    key = randomUUID();
  const results = await Promise.all(
    Array.from({ length: 8 }, () => order(a, p, 2, key)),
  );
  for (const r of results) assert.equal(r.statusCode, 201, r.body);
  assert.equal(new Set(results.map((r) => r.json().id)).size, 1);
  assert.equal(
    (await one(db, "SELECT stock FROM products WHERE id=?", [p])).stock,
    8,
  );
  const bad = await order(a, p, 1, key);
  assert.equal(bad.statusCode, 409);
});
test("signed captured-payment webhooks are amount-checked and replay-safe", async () => {
  const p = await product(),
    o = (await order(a, p)).json();
  const pay = await call(a, "POST", "/api/payments", { orderId: o.id });
  assert.equal(pay.statusCode, 200, pay.body);
  const payment = pay.json(),
    eventId = randomUUID();
  const event = {
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: `pay_${randomUUID()}`,
          order_id: payment.providerOrderId,
          amount: payment.amount,
          currency: "INR",
          status: "captured",
        },
      },
    },
  };
  const body = JSON.stringify(event),
    signature = createHmac("sha256", "integration-only-webhook-secret")
      .update(body)
      .digest("hex");
  const send = () =>
    call(null, "POST", "/api/webhooks/razorpay", body, {
      "content-type": "application/json",
      "x-razorpay-signature": signature,
      "x-razorpay-event-id": eventId,
    });
  assert.equal((await send()).statusCode, 200);
  assert.equal((await send()).statusCode, 200);
  assert.equal(
    (await one(db, "SELECT status FROM orders WHERE id=?", [o.id])).status,
    "Order placed",
  );
  const forged = await call(null, "POST", "/api/webhooks/razorpay", body, {
    "content-type": "application/json",
    "x-razorpay-signature": "bad",
    "x-razorpay-event-id": randomUUID(),
  });
  assert.equal(forged.statusCode, 401);
});
test("expired reservations release inventory exactly once", async () => {
  const p = await product(3),
    o = (await order(a, p, 2)).json();
  await rows(
    db,
    "UPDATE orders SET expires_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 1 MINUTE) WHERE id=?",
    [o.id],
  );
  await expireOrders(app);
  await expireOrders(app);
  assert.equal(
    (await one(db, "SELECT stock FROM products WHERE id=?", [p])).stock,
    3,
  );
  assert.equal(
    (await one(db, "SELECT status FROM orders WHERE id=?", [o.id])).status,
    "Expired",
  );
});
test("two matching partners race to accept exactly one assignment", async () => {
  const date = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  const res = await call(
    a,
    "POST",
    "/api/bookings",
    {
      serviceId: "s1",
      packageId: "s1-pkg-0",
      name: "Customer",
      phone: "9999999999",
      city: "Hyderabad",
      address: "Private test address",
      property: "Apartment",
      area: 200,
      date,
      time: "09:00",
      description: "Test garden design",
    },
    { "idempotency-key": randomUUID() },
  );
  assert.equal(res.statusCode, 201, res.body);
  const booking = res.json();
  const before = await call(partner1, "GET", `/api/bookings/${booking.id}`);
  assert.equal(before.statusCode, 200);
  assert.equal(before.json().phone, "");
  assert.equal(before.json().address, "Hyderabad");
  const replies = await Promise.all([
    call(partner1, "POST", `/api/partner/leads/${booking.id}/accept`),
    call(partner2, "POST", `/api/partner/leads/${booking.id}/accept`),
  ]);
  assert.deepEqual(replies.map((r) => r.statusCode).sort(), [200, 409]);
  const own = await call(a, "GET", `/api/bookings/${booking.id}`);
  assert.equal(own.json().status, "Partner assigned");
  assert.equal(
    (await call(b, "GET", `/api/bookings/${booking.id}`)).statusCode,
    404,
  );
});
test("uploaded files require ownership and verified bytes", async () => {
  const body = Buffer.from([
    137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0, 0, 0, 0, 0,
  ]);
  const init = await call(a, "POST", "/api/uploads/presign", {
    name: "test.png",
    kind: "reference",
    contentType: "image/png",
    size: body.length,
  });
  assert.equal(init.statusCode, 201, init.body);
  const u = init.json();
  assert.equal(
    (await call(b, "PUT", u.uploadUrl, body, { "content-type": "image/png" }))
      .statusCode,
    404,
  );
  assert.equal(
    (await call(a, "PUT", u.uploadUrl, body, { "content-type": "image/png" }))
      .statusCode,
    200,
  );
  assert.equal(
    (await call(a, "POST", `/api/uploads/${u.id}/complete`)).statusCode,
    200,
  );
  assert.equal(
    (await call(b, "GET", `/api/uploads/${u.id}/content`)).statusCode,
    404,
  );
});
test("admin settings are persisted, exported CSV is protected", async () => {
  const saved = await call(admin, "PUT", "/api/admin/settings", {
    maxPartners: 6,
    rotation: true,
  });
  assert.equal(saved.statusCode, 200);
  assert.equal(
    (await call(admin, "GET", "/api/admin/settings")).json().maxPartners,
    6,
  );
  assert.equal(
    (await call(a, "GET", "/api/admin/reports/users")).statusCode,
    403,
  );
  const csv = await call(admin, "GET", "/api/admin/reports/orders");
  assert.equal(csv.statusCode, 200);
  assert.match(csv.headers["content-type"], /text\/csv/);
});
test("logout revokes a session on both API instances", async () => {
  const u = await user("customer", "logout");
  const second = await buildApp({ config: c, db, logger: false });
  await second.ready();
  try {
    assert.equal(
      (
        await second.inject({
          url: "/api/account",
          headers: { cookie: `kn_session=${u.cookie}` },
        })
      ).statusCode,
      200,
    );
    assert.equal((await call(u, "POST", "/api/auth/logout")).statusCode, 200);
    assert.equal(
      (
        await second.inject({
          url: "/api/account",
          headers: { cookie: `kn_session=${u.cookie}` },
        })
      ).statusCode,
      401,
    );
  } finally {
    await second.close();
  }
});

test("OTP is single-use and locks after five incorrect attempts", async () => {
  let delivered;
  app.providers.sendOtp = async (phone, code) => {
    delivered = code;
  };
  const phone = "9" + String(Date.now()).slice(-9);
  const requested = await call(null, "POST", "/api/auth/otp/request", {
    phone,
  });
  assert.equal(requested.statusCode, 202, requested.body);
  const challengeId = requested.json().challengeId;
  const verified = await call(null, "POST", "/api/auth/otp/verify", {
    challengeId,
    code: delivered,
  });
  assert.equal(verified.statusCode, 200, verified.body);
  assert.equal(
    (
      await call(null, "POST", "/api/auth/otp/verify", {
        challengeId,
        code: delivered,
      })
    ).statusCode,
    401,
  );
  const second = await call(null, "POST", "/api/auth/otp/request", { phone });
  const next = second.json().challengeId,
    wrong = delivered === "111111" ? "222222" : "111111";
  for (let i = 0; i < 5; i++)
    assert.equal(
      (
        await call(null, "POST", "/api/auth/otp/verify", {
          challengeId: next,
          code: wrong,
        })
      ).statusCode,
      401,
    );
  assert.equal(
    (
      await call(null, "POST", "/api/auth/otp/verify", {
        challengeId: next,
        code: delivered,
      })
    ).statusCode,
    401,
  );
  delete app.providers.sendOtp;
});
test("payment amount mismatch cannot mark an order paid", async () => {
  const o = (await order(a, await product())).json(),
    p = (await call(a, "POST", "/api/payments", { orderId: o.id })).json();
  await assert.rejects(
    () =>
      capturePayment(app, {
        id: "mismatch-" + randomUUID(),
        order_id: p.providerOrderId,
        amount: 1,
        currency: "INR",
        status: "captured",
      }),
    (e) => e.code === "PAYMENT_MISMATCH",
  );
  assert.equal(
    (await one(db, "SELECT payment_status FROM orders WHERE id=?", [o.id]))
      .payment_status,
    "pending",
  );
});
test("late capture refunds rather than fulfilling released stock", async () => {
  const pid = await product(3),
    o = (await order(a, pid, 2)).json(),
    p = (await call(a, "POST", "/api/payments", { orderId: o.id })).json();
  await rows(
    db,
    "UPDATE orders SET expires_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 1 MINUTE) WHERE id=?",
    [o.id],
  );
  await expireOrders(app);
  await capturePayment(app, {
    id: "late-" + randomUUID(),
    order_id: p.providerOrderId,
    amount: p.amount,
    currency: "INR",
    status: "captured",
  });
  const refund = await one(db, "SELECT id FROM refunds WHERE order_id=?", [
    o.id,
  ]);
  assert.ok(refund);
  await processRefund(app, { refundId: refund.id });
  await processRefund(app, { refundId: refund.id });
  assert.equal(
    (await one(db, "SELECT payment_status FROM orders WHERE id=?", [o.id]))
      .payment_status,
    "refunded",
  );
  assert.equal(
    (await one(db, "SELECT stock FROM products WHERE id=?", [pid])).stock,
    3,
  );
});
test("pending gateway refund retries reconcile without a second transfer", async () => {
  const o = (await order(a, await product())).json(),
    p = (await call(a, "POST", "/api/payments", { orderId: o.id })).json(),
    providerPayment = "refund-" + randomUUID();
  await capturePayment(app, {
    id: providerPayment,
    order_id: p.providerOrderId,
    amount: p.amount,
    currency: "INR",
    status: "captured",
  });
  await call(a, "POST", `/api/orders/${o.id}/cancel`);
  const refund = await one(db, "SELECT id FROM refunds WHERE order_id=?", [
    o.id,
  ]);
  let transfers = 0;
  const gateway = app.gateway,
    mode = app.config.PAYMENT_MODE;
  app.config.PAYMENT_MODE = "razorpay";
  app.gateway = {
    payments: {
      refund: async () => {
        transfers++;
        return {
          id: "rfnd-" + refund.id,
          payment_id: providerPayment,
          amount: p.amount,
          status: "pending",
        };
      },
      fetchRefund: async () => ({
        id: "rfnd-" + refund.id,
        payment_id: providerPayment,
        amount: p.amount,
        status: "processed",
      }),
    },
  };
  try {
    await assert.rejects(
      () => processRefund(app, { refundId: refund.id }),
      (e) => e.code === "REFUND_PENDING",
    );
    await processRefund(app, { refundId: refund.id });
    assert.equal(transfers, 1);
    assert.equal(
      (await one(db, "SELECT status FROM refunds WHERE id=?", [refund.id]))
        .status,
      "processed",
    );
  } finally {
    app.gateway = gateway;
    app.config.PAYMENT_MODE = mode;
  }
});
test("push token is encrypted, queued once and removed when session ends", async () => {
  const u = await user("customer", "device");
  let sent = 0;
  app.push = async (token, n) => {
    assert.equal(token, "integration-device-token-not-real");
    assert.equal(n.title, "Integration notice");
    sent++;
    return "projects/test/messages/1";
  };
  try {
    await rows(
      db,
      "UPDATE notifications SET push_enqueued_at=UTC_TIMESTAMP(3) WHERE push_enqueued_at IS NULL",
    );
    const device = await call(u, "POST", "/api/devices", {
      token: "integration-device-token-not-real",
      platform: "android",
    });
    assert.equal(device.statusCode, 200, device.body);
    const saved = await one(db, "SELECT * FROM devices WHERE id=?", [
      device.json().id,
    ]);
    assert.ok(!saved.token_ciphertext.includes("integration-device-token"));
    await rows(
      db,
      "INSERT INTO notifications(user_id,title,message,type) VALUES (?,?,?,?)",
      [u.id, "Integration notice", "Private message", "test"],
    );
    assert.equal(await runPushOnce(app), true);
    assert.equal(await runPushOnce(app), false);
    assert.equal(sent, 1);
    await call(u, "POST", "/api/auth/logout");
    assert.equal(
      await one(db, "SELECT id FROM devices WHERE id=?", [device.json().id]),
      null,
    );
  } finally {
    app.push = null;
  }
});
test("disabled users lose cached sessions across API instances", async () => {
  const u = await user("customer", "disabled"),
    second = await buildApp({ config: c, db, logger: false });
  await second.ready();
  try {
    assert.equal(
      (
        await second.inject({
          url: "/api/account",
          headers: { cookie: `kn_session=${u.cookie}` },
        })
      ).statusCode,
      200,
    );
    assert.equal(
      (
        await call(admin, "PATCH", `/api/admin/users/${u.id}/status`, {
          status: "disabled",
        })
      ).statusCode,
      200,
    );
    assert.equal(
      (
        await second.inject({
          url: "/api/account",
          headers: { cookie: `kn_session=${u.cookie}` },
        })
      ).statusCode,
      401,
    );
  } finally {
    await second.close();
  }
});
test("broadcast worker resumes in bounded idempotent batches", async () => {
  const queued = await call(admin, "POST", "/api/admin/notifications", {
    audience: "customers",
    title: "Integration broadcast",
    message: "Test delivery",
  });
  assert.equal(queued.statusCode, 202, queued.body);
  for (let i = 0; i < 20; i++) {
    const job = await one(db, "SELECT status FROM outbox_jobs WHERE id=?", [
      queued.json().id,
    ]);
    if (job.status === "done") break;
    await runJobsOnce(app);
  }
  const n = await one(
    db,
    "SELECT COUNT(*) AS n FROM notifications WHERE user_id=? AND campaign_id=?",
    [a.id, queued.json().id],
  );
  assert.equal(Number(n.n), 1);
  await rows(
    db,
    "UPDATE outbox_jobs SET status='pending',available_at=UTC_TIMESTAMP(3) WHERE id=?",
    [queued.json().id],
  );
  await runJobsOnce(app);
  assert.equal(
    Number(
      (
        await one(
          db,
          "SELECT COUNT(*) AS n FROM notifications WHERE user_id=? AND campaign_id=?",
          [a.id, queued.json().id],
        )
      ).n,
    ),
    1,
  );
});
test("production rejects simulated payments and local file storage", () => {
  assert.throws(
    () =>
      loadConfig({
        ...process.env,
        NODE_ENV: "production",
        APP_ORIGIN: "https://nursery.example.test",
        PAYMENT_MODE: "test",
        METRICS_TOKEN: "a".repeat(40),
      }),
    /Simulated/,
  );
  assert.throws(
    () =>
      loadConfig({
        ...process.env,
        NODE_ENV: "production",
        APP_ORIGIN: "https://nursery.example.test",
        PAYMENT_MODE: "disabled",
        STORAGE_DRIVER: "local",
        METRICS_TOKEN: "a".repeat(40),
      }),
    /object storage/,
  );
});
test("partner onboarding requires an owned document and administrator approval", async () => {
  const u = await user("customer", "applicant"),
    body = {
      name: "Test Nursery Professional",
      person: "Synthetic Professional",
      city: "Hyderabad",
      phone: "9999999999",
      address: "Synthetic partner address",
      experience: "3 years",
      categories: ["Garden care"],
    };
  assert.equal(
    (await call(u, "POST", "/api/partners/apply", body)).statusCode,
    400,
  );
  const bytes = Buffer.from("%PDF-1.7\nSynthetic integration document"),
    init = await call(u, "POST", "/api/uploads/presign", {
      name: "business-test.pdf",
      kind: "document",
      contentType: "application/pdf",
      size: bytes.length,
    });
  assert.equal(init.statusCode, 201, init.body);
  const upload = init.json();
  assert.equal(
    (
      await call(u, "PUT", upload.uploadUrl, bytes, {
        "content-type": "application/pdf",
      })
    ).statusCode,
    200,
  );
  await call(u, "POST", `/api/uploads/${upload.id}/complete`);
  assert.equal(
    (
      await call(u, "POST", "/api/partners/apply", {
        ...body,
        uploadIds: [upload.id],
      })
    ).statusCode,
    201,
  );
  const profile = await call(u, "GET", "/api/partner/profile");
  assert.equal(profile.json().partner.status, "Pending");
  assert.equal(
    (
      await call(u, "PATCH", "/api/partner/profile", {
        name: body.name,
        person: body.person,
        city: body.city,
        experience: body.experience,
        available: true,
      })
    ).statusCode,
    403,
  );
  const id = profile.json().partner.id;
  const amended = {
    ...body,
    name: "Amended professional",
    uploadIds: [upload.id],
  };
  assert.equal(
    (await call(u, "PUT", "/api/partner/application", amended)).statusCode,
    200,
  );
  assert.equal(
    (
      await call(admin, "PATCH", `/api/admin/partners/${id}/status`, {
        status: "Rejected",
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (await call(u, "PUT", "/api/partner/application", amended)).statusCode,
    200,
  );
  const resubmitted = (await call(u, "GET", "/api/partner/profile")).json()
    .partner;
  assert.equal(resubmitted.status, "Pending");
  assert.equal(Boolean(resubmitted.available), false);
  assert.equal(resubmitted.uploads.length, 1);
  assert.equal(
    (
      await call(admin, "PATCH", `/api/admin/partners/${id}/status`, {
        status: "Approved",
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (await call(u, "GET", "/api/partner/profile")).json().partner.status,
    "Approved",
  );
  assert.equal(
    (await call(u, "PUT", "/api/partner/application", amended)).statusCode,
    409,
  );
  assert.equal(
    (await call(admin, "GET", `/api/uploads/${upload.id}/content`)).statusCode,
    200,
  );
});
test("service payment, sequential progress and customer review complete end to end", async () => {
  const date = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
    booking = await call(
      a,
      "POST",
      "/api/bookings",
      {
        serviceId: "s1",
        packageId: "s1-pkg-0",
        name: "Synthetic Customer",
        phone: "9999999999",
        city: "Hyderabad",
        address: "Synthetic garden address",
        property: "Apartment",
        area: 120,
        date,
        time: "12:00",
        description: "Service lifecycle integration test",
      },
      { "idempotency-key": randomUUID() },
    );
  assert.equal(booking.statusCode, 201, booking.body);
  const id = booking.json().id;
  assert.equal(
    (await call(a, "POST", "/api/payments", { bookingId: id })).statusCode,
    409,
  );
  assert.equal(
    (
      await call(admin, "POST", `/api/admin/bookings/${id}/assign`, {
        partnerId: partner1.partnerId,
      })
    ).statusCode,
    200,
  );
  const pay = await call(a, "POST", "/api/payments", { bookingId: id });
  assert.equal(pay.statusCode, 200, pay.body);
  assert.equal(
    (await call(a, "POST", `/api/payments/${pay.json().id}/test-capture`))
      .statusCode,
    200,
  );
  assert.equal(
    (
      await call(partner1, "PATCH", `/api/partner/jobs/${id}`, {
        status: "Service completed",
      })
    ).statusCode,
    409,
  );
  for (const status of [
    "Booking confirmed",
    "Service scheduled",
    "Service in progress",
    "Service completed",
  ])
    assert.equal(
      (await call(partner1, "PATCH", `/api/partner/jobs/${id}`, { status }))
        .statusCode,
      200,
    );
  assert.equal(
    (
      await call(a, "PUT", `/api/bookings/${id}/review`, {
        rating: 5,
        text: "Synthetic successful service",
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (
      await call(b, "PUT", `/api/bookings/${id}/review`, {
        rating: 5,
        text: "Not my service",
      })
    ).statusCode,
    409,
  );
  const own = (await call(a, "GET", `/api/bookings/${id}`)).json();
  assert.equal(own.payment, "captured");
  assert.equal(own.review.rating, 5);
});
test("API documentation is restricted to administrators", async () => {
  assert.equal((await call(null, "GET", "/api/docs/json")).statusCode, 401);
  assert.equal((await call(a, "GET", "/api/docs/json")).statusCode, 403);
  const spec = await call(admin, "GET", "/api/docs/json");
  assert.equal(spec.statusCode, 200);
  assert.ok(spec.json().paths["/api/orders"]);
});
test("password reset invalidates older links and sessions, then password change rotates the session", async () => {
  const u = await user("customer", "reset"),
    messages = [],
    mailer = app.mailer;
  app.mailer = { sendMail: async (message) => messages.push(message) };
  const nextPassword = "Reset-integration-password-2026!",
    finalPassword = "Changed-integration-password-2026!";
  try {
    for (let i = 0; i < 2; i++)
      assert.equal(
        (
          await call(null, "POST", "/api/auth/forgot-password", {
            email: u.email,
          })
        ).statusCode,
        202,
      );
    const tokens = messages.map(
      (m) => m.text.match(/#reset-password\/([a-f0-9]{64})/)[1],
    );
    assert.equal(
      (
        await call(null, "POST", "/api/auth/reset-password", {
          token: tokens[1],
          password: nextPassword,
        })
      ).statusCode,
      200,
    );
    assert.equal((await call(u, "GET", "/api/account")).statusCode, 401);
    assert.equal(
      (
        await call(null, "POST", "/api/auth/reset-password", {
          token: tokens[0],
          password: pass,
        })
      ).statusCode,
      400,
    );
    const login = await call(null, "POST", "/api/auth/login", {
      email: u.email,
      password: nextPassword,
    });
    assert.equal(login.statusCode, 200, login.body);
    const session = {
      id: u.id,
      cookie: login.cookies.find((c) => c.name === "kn_session").value,
      csrf: login.json().csrfToken,
    };
    const changed = await call(session, "POST", "/api/auth/change-password", {
      currentPassword: nextPassword,
      password: finalPassword,
    });
    assert.equal(changed.statusCode, 200, changed.body);
    assert.equal((await call(session, "GET", "/api/account")).statusCode, 401);
    const replacement = {
      cookie: changed.cookies.find((c) => c.name === "kn_session").value,
      csrf: changed.json().csrfToken,
    };
    assert.equal(
      (await call(replacement, "GET", "/api/account")).statusCode,
      200,
    );
  } finally {
    app.mailer = mailer;
  }
});
test("production configuration uses secure cookies and accepts a private S3 adapter", async () => {
  const production = loadConfig({
      ...c,
      NODE_ENV: "production",
      APP_ORIGIN: "https://nursery.example.test",
      PAYMENT_MODE: "disabled",
      STORAGE_DRIVER: "s3",
      S3_ENDPOINT: "https://objects.example.test",
      S3_BUCKET: "synthetic-test-bucket",
      S3_ACCESS_KEY_ID: "synthetic-not-a-real-key",
      S3_SECRET_ACCESS_KEY: "synthetic-not-a-real-secret",
      METRICS_TOKEN: "synthetic-metrics-token-for-local-test-only",
    }),
    server = await buildApp({ config: production, db, logger: false });
  await server.ready();
  try {
    const login = await server.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: a.email, password: pass },
    });
    assert.equal(login.statusCode, 200, login.body);
    assert.match(login.headers["set-cookie"], /HttpOnly/);
    assert.match(login.headers["set-cookie"], /Secure/);
    const index = await server.inject("/");
    assert.equal(index.statusCode, 200);
    assert.match(
      index.headers["content-security-policy"],
      /https:\/\/objects\.example\.test/,
    );
    assert.equal((await server.inject("/metrics")).statusCode, 401);
  } finally {
    await server.close();
  }
});
test("contact phone edits persist without claiming a verified login identity", async () => {
  const profile = await call(a, "PATCH", "/api/account", {
    name: "Updated integration customer",
    city: "Hyderabad",
    contactPhone: "9888888888",
  });
  assert.equal(profile.statusCode, 200, profile.body);
  assert.equal(profile.json().user.contactPhone, "9888888888");
  assert.equal(profile.json().user.phoneVerified, false);
  assert.equal(
    (await one(db, "SELECT phone FROM users WHERE id=?", [a.id])).phone,
    null,
  );
});
test("editing the default address preserves exactly one default", async () => {
  const id = await address(b),
    saved = await one(db, "SELECT * FROM addresses WHERE id=?", [id]);
  const changed = await call(b, "PUT", `/api/addresses/${id}`, {
    tag: saved.tag,
    name: saved.name,
    phone: saved.phone,
    line: saved.line,
    city: saved.city,
    pincode: saved.pincode,
    isDefault: false,
  });
  assert.equal(changed.statusCode, 200, changed.body);
  assert.equal(
    Number(
      (
        await one(
          db,
          "SELECT COUNT(*) AS n FROM addresses WHERE user_id=? AND is_default=TRUE",
          [b.id],
        )
      ).n,
    ),
    1,
  );
});
test("unavailable products can be removed from cart and wishlist", async () => {
  const p = await product();
  assert.equal(
    (await call(a, "PUT", `/api/cart/${p}`, { quantity: 1 })).statusCode,
    200,
  );
  assert.equal(
    (await call(a, "PUT", `/api/wishlist/${p}`, { saved: true })).statusCode,
    200,
  );
  await rows(db, "UPDATE products SET active=FALSE WHERE id=?", [p]);
  const saved = await call(a, "GET", "/api/wishlist/products?limit=100");
  assert.equal(saved.statusCode, 200);
  assert.equal(saved.json().items.find((x) => x.id === p)?.active, false);
  assert.equal(
    (await call(a, "PUT", `/api/cart/${p}`, { quantity: 0 })).statusCode,
    200,
  );
  assert.equal(
    (await call(a, "PUT", `/api/wishlist/${p}`, { saved: false })).statusCode,
    200,
  );
  assert.equal(
    await one(
      db,
      "SELECT product_id FROM cart_items WHERE user_id=? AND product_id=?",
      [a.id, p],
    ),
    null,
  );
});
test("customer overview counts captured purchases and excludes unpaid/cancelled orders", async () => {
  const u = await user("customer", "totals"),
    pid = await product(10);
  const paid = (await order(u, pid)).json(),
    unpaid = (await order(u, pid)).json(),
    cancelled = (await order(u, pid)).json();
  for (const o of [paid, cancelled]) {
    const p = (
      await call(u, "POST", "/api/payments", { orderId: o.id })
    ).json();
    await call(u, "POST", `/api/payments/${p.id}/test-capture`);
  }
  await call(u, "POST", `/api/orders/${cancelled.id}/cancel`);
  const result = await call(u, "GET", "/api/account/overview");
  assert.equal(result.statusCode, 200, result.body);
  assert.equal(result.json().orders, 3);
  assert.equal(result.json().totalSpent, paid.total);
  assert.ok(unpaid.id);
});
test("partners can make personal bookings without receiving their own lead", async () => {
  const date = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
    res = await call(
      partner1,
      "POST",
      "/api/bookings",
      {
        serviceId: "s1",
        packageId: "s1-pkg-0",
        name: "Partner personal visit",
        phone: "9999999999",
        city: "Hyderabad",
        address: "Synthetic personal garden",
        property: "Apartment",
        area: 100,
        date,
        time: "12:00",
        description: "Personal booking, separate from assigned work",
      },
      { "idempotency-key": randomUUID() },
    );
  assert.equal(res.statusCode, 201, res.body);
  const booking = res.json();
  assert.ok(!booking.recipients.includes(partner1.partnerId));
  const own = await call(partner1, "GET", "/api/bookings");
  assert.ok(own.json().items.some((b) => b.id === booking.id));
  assert.ok(own.json().items.every((b) => String(b.userId) === partner1.id));
  assert.ok(
    !(await call(partner1, "GET", "/api/partner/jobs"))
      .json()
      .items.some((b) => b.id === booking.id),
  );
  assert.equal(
    (await call(partner1, "GET", `/api/bookings/${booking.id}`)).statusCode,
    200,
  );
  const adminOwn = await call(admin, "GET", "/api/bookings");
  assert.ok(adminOwn.json().items.every((b) => String(b.userId) === admin.id));
});
test("administrator user search is bounded and parameterized", async () => {
  const exact = await call(
    admin,
    "GET",
    `/api/admin/users?limit=1&q=${encodeURIComponent(a.email)}`,
  );
  assert.equal(exact.statusCode, 200, exact.body);
  assert.equal(exact.json().items.length, 1);
  assert.equal(exact.json().items[0].id, a.id);
  const injection = await call(
    admin,
    "GET",
    `/api/admin/users?q=${encodeURIComponent("%' OR 1=1 --")}`,
  );
  assert.equal(injection.statusCode, 200);
  assert.equal(injection.json().items.length, 0);
  assert.equal(
    (await call(a, "GET", "/api/admin/users?q=test")).statusCode,
    403,
  );
});
test("catalog mutations reject missing image assets and preserve all service packages", async () => {
  const category = (
    await one(db, "SELECT name FROM categories WHERE active=TRUE LIMIT 1")
  ).name;
  const rejected = await call(admin, "POST", "/api/admin/products", {
    name: "Missing photo",
    category,
    description: "Synthetic missing image",
    price: 100,
    stock: 1,
    image: "not-an-existing-nursery-photo.jpg",
  });
  assert.equal(rejected.statusCode, 400);
  const packages = [100, 200, 300, 400].map((price, i) => ({
    name: `Package ${i + 1}`,
    price,
    description: "Synthetic package",
  }));
  const created = await call(admin, "POST", "/api/admin/services", {
    name: "Multiple packages",
    category: "Garden care",
    description: "Synthetic service with four packages",
    image: "garden-care.jpg",
    active: true,
    packages,
  });
  assert.equal(created.statusCode, 201, created.body);
  const id = created.json().id;
  const first = (await call(admin, "GET", "/api/admin/services"))
    .json()
    .items.find((s) => s.id === id);
  assert.equal(first.packages.length, 4);
  const changed = await call(admin, "PUT", `/api/admin/services/${id}`, {
    name: first.name,
    category: first.category,
    description: first.description,
    image: first.image,
    active: false,
    packages: first.packages.map((p) => ({ ...p, price: p.price + 1 })),
  });
  assert.equal(changed.statusCode, 200, changed.body);
  assert.equal(
    Number(
      (
        await one(
          db,
          "SELECT COUNT(*) AS n FROM service_packages WHERE service_id=? AND active=TRUE",
          [id],
        )
      ).n,
    ),
    4,
  );
  assert.ok(
    !(await call(null, "GET", "/api/services"))
      .json()
      .items.some((s) => s.id === id),
  );
  assert.ok(
    (await call(admin, "GET", "/api/admin/services"))
      .json()
      .items.some((s) => s.id === id),
  );
});
test("a catalog upload used by a public service is readable without a session", async () => {
  const bytes = Buffer.from([
      137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0, 0, 0, 0, 0,
    ]),
    init = await call(admin, "POST", "/api/uploads/presign", {
      name: "service-photo.png",
      kind: "catalog",
      contentType: "image/png",
      size: bytes.length,
    });
  assert.equal(init.statusCode, 201, init.body);
  const upload = init.json();
  await call(admin, "PUT", upload.uploadUrl, bytes, {
    "content-type": "image/png",
  });
  await call(admin, "POST", `/api/uploads/${upload.id}/complete`);
  assert.equal(
    (await call(null, "GET", `/api/uploads/${upload.id}/content`)).statusCode,
    404,
  );
  const service = await call(admin, "POST", "/api/admin/services", {
    name: "Uploaded photo service",
    category: "Garden care",
    description: "Synthetic photo reference",
    image: `/api/uploads/${upload.id}/content`,
    packages: [{ name: "Basic", price: 100 }],
  });
  assert.equal(service.statusCode, 201, service.body);
  assert.equal(
    (await call(null, "GET", `/api/uploads/${upload.id}/content`)).statusCode,
    200,
  );
});
test("category visibility is authorized and blocks checkout for hidden categories", async () => {
  const name = "Audit category " + randomUUID().slice(0, 8),
    slug = "audit-" + randomUUID();
  assert.equal(
    (await call(admin, "POST", "/api/admin/categories", { name, slug }))
      .statusCode,
    201,
  );
  const category = await one(db, "SELECT id FROM categories WHERE slug=?", [
      slug,
    ]),
    p = await product();
  await rows(db, "UPDATE products SET category_id=? WHERE id=?", [
    category.id,
    p,
  ]);
  assert.equal(
    (
      await call(a, "PATCH", `/api/admin/categories/${category.id}`, {
        active: false,
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await call(admin, "PATCH", `/api/admin/categories/${category.id}`, {
        active: false,
      })
    ).statusCode,
    200,
  );
  assert.equal((await order(a, p)).statusCode, 409);
  assert.equal((await call(null, "GET", `/api/products/${p}`)).statusCode, 404);
  assert.equal(
    (
      await call(admin, "PATCH", `/api/admin/categories/${category.id}`, {
        active: true,
      })
    ).statusCode,
    200,
  );
  assert.equal((await order(a, p)).statusCode, 201);
});
test("failed jobs can be retried by administrators with an audit entry", async () => {
  const id = randomUUID();
  await rows(
    db,
    "INSERT INTO outbox_jobs(id,type,payload,status,attempts) VALUES (?,'broadcast',?,'failed',8)",
    [
      id,
      JSON.stringify({
        audience: "customers",
        title: "Retry fixture",
        message: "Synthetic notice",
        cursor: "0",
        campaignId: id,
      }),
    ],
  );
  assert.equal(
    (await call(a, "POST", `/api/admin/jobs/${id}/retry`)).statusCode,
    403,
  );
  assert.equal(
    (await call(admin, "POST", `/api/admin/jobs/${id}/retry`)).statusCode,
    200,
  );
  const job = await one(db, "SELECT * FROM outbox_jobs WHERE id=?", [id]);
  assert.equal(job.status, "pending");
  assert.equal(job.attempts, 0);
  assert.equal(
    (await call(admin, "POST", `/api/admin/jobs/${id}/retry`)).statusCode,
    409,
  );
  assert.ok(
    await one(
      db,
      "SELECT seq FROM audit_logs WHERE resource_id=? AND action='job.retry'",
      [id],
    ),
  );
});

test("business details require admin access and refresh the public bootstrap", async () => {
  const body = {
    name: "Integration Nursery",
    email: "support@example.test",
    phone: "9999999999",
    address: "Synthetic business address",
  };
  assert.equal(
    (await call(a, "PUT", "/api/admin/business", body)).statusCode,
    403,
  );
  assert.equal(
    (await call(admin, "PUT", "/api/admin/business", body)).statusCode,
    200,
  );
  assert.deepEqual((await call(null, "GET", "/api/business")).json(), body);
  assert.deepEqual(
    (await call(null, "GET", "/api/bootstrap")).json().business,
    body,
  );
});

test("notification pagination is private, deduplicated and reports total unread", async () => {
  const u = await user("customer", "notices");
  for (let i = 0; i < 5; i++)
    await rows(
      db,
      "INSERT INTO notifications(user_id,title,message,type) VALUES (?,?,'Private fixture','test')",
      [u.id, "Notice " + i],
    );
  const first = (await call(u, "GET", "/api/notifications?limit=2")).json();
  assert.equal(first.items.length, 2);
  assert.equal(first.unreadCount, 5);
  const second = (
    await call(
      u,
      "GET",
      "/api/notifications?limit=2&cursor=" + first.nextCursor,
    )
  ).json();
  assert.equal(
    new Set([...first.items, ...second.items].map((n) => n.seq)).size,
    4,
  );
  assert.ok(
    [...first.items, ...second.items].every((n) => String(n.user_id) === u.id),
  );
  assert.equal(
    (await call(b, "PATCH", `/api/notifications/${first.items[0].seq}/read`))
      .statusCode,
    404,
  );
  assert.equal(
    (await call(u, "PATCH", `/api/notifications/${first.items[0].seq}/read`))
      .statusCode,
    200,
  );
  assert.equal(
    (await call(u, "GET", "/api/notifications?limit=1")).json().unreadCount,
    4,
  );
});

test("eligible partner search pages beyond the first match and respects availability", async () => {
  const booking = await call(
    a,
    "POST",
    "/api/bookings",
    {
      serviceId: "s1",
      packageId: "s1-pkg-0",
      name: "Synthetic Customer",
      phone: "9999999999",
      city: "Hyderabad",
      address: "Synthetic address",
      property: "Apartment",
      area: 120,
      date: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
      time: "12:00",
      description: "Assignment search fixture",
    },
    { "idempotency-key": randomUUID() },
  );
  assert.equal(booking.statusCode, 201, booking.body);
  const id = booking.json().id;
  assert.equal(
    (await call(a, "GET", `/api/admin/bookings/${id}/eligible-partners`))
      .statusCode,
    403,
  );
  const first = (
    await call(
      admin,
      "GET",
      `/api/admin/bookings/${id}/eligible-partners?limit=1`,
    )
  ).json();
  assert.equal(first.items.length, 1);
  assert.ok(first.nextCursor);
  const second = (
    await call(
      admin,
      "GET",
      `/api/admin/bookings/${id}/eligible-partners?limit=1&cursor=${first.nextCursor}`,
    )
  ).json();
  assert.equal(second.items.length, 1);
  assert.notEqual(first.items[0].id, second.items[0].id);
  await rows(db, "UPDATE partners SET available=FALSE WHERE id=?", [
    first.items[0].id,
  ]);
  try {
    const refreshed = (
      await call(
        admin,
        "GET",
        `/api/admin/bookings/${id}/eligible-partners?limit=100`,
      )
    ).json();
    assert.ok(!refreshed.items.some((p) => p.id === first.items[0].id));
  } finally {
    await rows(db, "UPDATE partners SET available=TRUE WHERE id=?", [
      first.items[0].id,
    ]);
  }
});

test("wishlist capacity remains bounded under simultaneous additions and saves are idempotent", async () => {
  const u = await user("customer", "wishlistlimit");
  const cat = await one(db, "SELECT id FROM categories LIMIT 1");
  const ps = Array.from({ length: 501 }, () => randomUUID());
  await db.query(
    "INSERT INTO products(id,category_id,name,description,price_paise,stock,image) VALUES ?",
    [
      ps.map((id) => [
        id,
        cat.id,
        "Wishlist fixture",
        "Synthetic",
        100,
        1,
        "plant-monstera.jpg",
      ]),
    ],
  );
  await db.query("INSERT INTO wishlist(user_id,product_id) VALUES ?", [
    ps.slice(0, 499).map((id) => [u.id, id]),
  ]);
  const added = await Promise.all(
    ps
      .slice(499)
      .map((id) => call(u, "PUT", `/api/wishlist/${id}`, { saved: true })),
  );
  assert.deepEqual(added.map((r) => r.statusCode).sort(), [200, 409]);
  assert.equal(
    Number(
      (
        await one(db, "SELECT COUNT(*) AS n FROM wishlist WHERE user_id=?", [
          u.id,
        ])
      ).n,
    ),
    500,
  );
  assert.equal(
    (await call(u, "PUT", `/api/wishlist/${ps[0]}`, { saved: true }))
      .statusCode,
    200,
  );
});

test("homepage banners publish atomically with ordering, visibility, validation and an audit trail", async () => {
  const current = (await call(admin, "GET", "/api/admin/hero")).json();
  const slides = [
    {
      id: "garden-first",
      image: "garden-design.jpg",
      mobileImage: "garden-care.jpg",
      alt: "Nursery garden path",
      link: "#services",
      active: true,
    },
    {
      id: "hidden-second",
      image: "plant-monstera.jpg",
      mobileImage: "",
      alt: "Hidden plant banner",
      link: "#shop",
      active: false,
    },
    {
      id: "plants-third",
      image: "terracotta-pots.jpg",
      mobileImage: "",
      alt: "Terracotta pots",
      link: "#shop",
      active: true,
    },
  ];
  const body = {
    revision: current.revision,
    autoplay: true,
    intervalSeconds: 8,
    slides,
  };
  assert.equal((await call(a, "PUT", "/api/admin/hero", body)).statusCode, 403);
  assert.equal((await call(a, "GET", "/api/admin/hero")).statusCode, 403);
  assert.equal(
    (await call(admin, "PUT", "/api/admin/hero", body)).statusCode,
    200,
  );
  const published = (await call(null, "GET", "/api/hero")).json();
  assert.deepEqual(
    published.slides.map((s) => s.id),
    ["garden-first", "plants-third"],
  );
  assert.equal(published.slides[0].mobileImage, "garden-care.jpg");
  assert.equal(published.intervalSeconds, 8);
  assert.deepEqual(
    (await call(null, "GET", "/api/bootstrap")).json().hero,
    published,
  );
  assert.equal(
    (await call(admin, "GET", "/api/admin/hero")).json().slides.length,
    3,
  );
  const latest = { ...body, revision: published.revision };
  for (const invalid of [
    { ...latest, slides: slides.map((s) => ({ ...s, active: false })) },
    { ...latest, slides: [{ ...slides[0], image: "missing-hero.jpg" }] },
    { ...latest, slides: [{ ...slides[0], link: "javascript:alert(1)" }] },
    { ...latest, slides: [slides[0], slides[0]] },
    {
      ...latest,
      slides: Array.from({ length: 9 }, (_, i) => ({
        ...slides[0],
        id: "banner-" + i,
      })),
    },
  ])
    assert.equal(
      (await call(admin, "PUT", "/api/admin/hero", invalid)).statusCode,
      400,
    );
  assert.equal(
    (await call(admin, "PUT", "/api/admin/hero", body)).statusCode,
    409,
  );
  assert.ok(
    await one(
      db,
      "SELECT seq FROM audit_logs WHERE action='hero.update' AND actor_id=?",
      [admin.id],
    ),
  );
});

test("simultaneous banner editors cannot overwrite a newer publication", async () => {
  const content = (await call(admin, "GET", "/api/admin/hero")).json();
  const result = await Promise.all([
    call(admin, "PUT", "/api/admin/hero", { ...content, intervalSeconds: 9 }),
    call(admin, "PUT", "/api/admin/hero", { ...content, intervalSeconds: 10 }),
  ]);
  assert.deepEqual(result.map((r) => r.statusCode).sort(), [200, 409]);
});

test("uploaded banner photos are public only while referenced by a visible banner", async () => {
  const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const init = await call(admin, "POST", "/api/uploads/presign", {
    name: "hero-fixture.png",
    kind: "catalog",
    contentType: "image/png",
    size: bytes.length,
  });
  assert.equal(init.statusCode, 201, init.body);
  const upload = init.json();
  assert.equal(
    (
      await call(admin, "PUT", upload.uploadUrl, bytes, {
        "content-type": "image/png",
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (await call(admin, "POST", `/api/uploads/${upload.id}/complete`))
      .statusCode,
    200,
  );
  const url = `/api/uploads/${upload.id}/content`;
  assert.equal((await call(null, "GET", url)).statusCode, 404);
  const content = (await call(admin, "GET", "/api/admin/hero")).json();
  content.slides = [
    {
      id: "uploaded-banner",
      image: url,
      mobileImage: url,
      alt: "Uploaded nursery banner",
      link: "#shop",
      active: true,
    },
    {
      id: "fallback-banner",
      image: "garden-hero.png",
      mobileImage: "",
      alt: "Garden",
      link: "#services",
      active: true,
    },
  ];
  assert.equal(
    (await call(admin, "PUT", "/api/admin/hero", content)).statusCode,
    200,
  );
  assert.equal((await call(null, "GET", url)).statusCode, 200);
  content.revision++;
  content.slides[0].active = false;
  assert.equal(
    (await call(admin, "PUT", "/api/admin/hero", content)).statusCode,
    200,
  );
  assert.equal((await call(null, "GET", url)).statusCode, 404);
});
