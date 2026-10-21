import { randomUUID, createHmac } from "node:crypto";
import { rows, one, tx } from "./db.js";
import { must, fail } from "./errors.js";
import { equal, hash } from "./security.js";
async function target(c, ref, userId = null, lock = false) {
  const isOrder = Boolean(ref.orderId),
    table = isOrder ? "orders" : "bookings",
    id = ref.orderId || ref.bookingId;
  const t = await one(
    c,
    `SELECT *,${isOrder ? "total_paise" : "price_paise"} AS amount FROM ${table} WHERE id=?${userId ? " AND user_id=?" : ""}${lock ? " FOR UPDATE" : ""}`,
    [id, ...(userId ? [userId] : [])],
  );
  must(t, 404, "NOT_FOUND", "Payment resource not found");
  return { ...t, table, isOrder };
}
const paymentDTO = (p, c) => ({
  id: p.id,
  orderId: p.order_id,
  bookingId: p.booking_id,
  providerOrderId: p.provider_order_id,
  amount: p.amount_paise,
  currency: p.currency,
  keyId: c.PAYMENT_MODE === "razorpay" ? c.RAZORPAY_KEY_ID : null,
  mode: c.PAYMENT_MODE,
  status: p.status,
});
export async function createPayment(app, user, ref) {
  must(
    app.config.PAYMENT_MODE !== "disabled",
    503,
    "PAYMENTS_UNAVAILABLE",
    "Online payments are not configured",
  );
  const result = await tx(app.db, async (c) => {
    const t = await target(c, ref, user.id, true);
    must(
      !["Cancelled", "Expired"].includes(t.status),
      409,
      "PAYMENT_CLOSED",
      "This order or booking cannot be paid",
    );
    if (t.isOrder)
      must(
        new Date(t.expires_at + "Z").getTime() > Date.now() ||
          t.payment_status === "captured",
        409,
        "ORDER_EXPIRED",
        "Your order reservation has expired",
      );
    else
      must(
        !["Request submitted", "Finding service partner"].includes(t.status),
        409,
        "BOOKING_UNCONFIRMED",
        "Wait for a service professional to be assigned before paying",
      );
    must(
      t.payment_status !== "captured" && t.payment_status !== "refunded",
      409,
      "ALREADY_PAID",
      "This item has already been paid",
    );
    const p = await one(
      c,
      `SELECT * FROM payments WHERE ${t.isOrder ? "order_id" : "booking_id"}=? FOR UPDATE`,
      [t.id],
    );
    if (p?.provider_order_id) return { payment: p, created: false };
    must(
      !p || p.status === "failed",
      409,
      "PAYMENT_PREPARING",
      "Payment setup is in progress. Please try again shortly.",
    );
    const id = p?.id || randomUUID();
    if (p)
      await rows(c, "UPDATE payments SET status='creating' WHERE id=?", [id]);
    else
      await rows(
        c,
        "INSERT INTO payments(id,order_id,booking_id,amount_paise) VALUES (?,?,?,?)",
        [id, t.isOrder ? t.id : null, t.isOrder ? null : t.id, t.amount],
      );
    return {
      payment: {
        id,
        order_id: t.isOrder ? t.id : null,
        booking_id: t.isOrder ? null : t.id,
        amount_paise: t.amount,
        currency: "INR",
      },
      created: true,
    };
  });
  if (!result.created) return paymentDTO(result.payment, app.config);
  const p = result.payment;
  try {
    const remote =
      app.config.PAYMENT_MODE === "test"
        ? { id: `test_order_${p.id}`, amount: p.amount_paise, currency: "INR" }
        : await app.gateway.orders.create({
            amount: p.amount_paise,
            currency: "INR",
            receipt: p.id,
            notes: { localPaymentId: p.id },
          });
    must(
      Number(remote.amount) === p.amount_paise && remote.currency === "INR",
      502,
      "GATEWAY_MISMATCH",
      "The payment gateway returned an invalid amount",
    );
    await rows(
      app.db,
      "UPDATE payments SET provider_order_id=?,status='created' WHERE id=?",
      [remote.id, p.id],
    );
    return paymentDTO(
      { ...p, provider_order_id: remote.id, status: "created" },
      app.config,
    );
  } catch (e) {
    await rows(
      app.db,
      "UPDATE payments SET status='failed' WHERE id=? AND provider_order_id IS NULL",
      [p.id],
    );
    throw e;
  }
}
export async function capturePayment(app, entity, event = null) {
  const p = await one(
    app.db,
    "SELECT * FROM payments WHERE provider_order_id=?",
    [entity.order_id],
  );
  must(
    p,
    503,
    "PAYMENT_NOT_READY",
    "Payment setup has not been persisted. Retry this webhook.",
  );
  return tx(app.db, async (c) => {
    const t = await target(
      c,
      { orderId: p.order_id, bookingId: p.booking_id },
      null,
      true,
    );
    const pay = await one(c, "SELECT * FROM payments WHERE id=? FOR UPDATE", [
      p.id,
    ]);
    must(
      Number(entity.amount) === pay.amount_paise &&
        entity.currency === pay.currency &&
        entity.status === "captured",
      400,
      "PAYMENT_MISMATCH",
      "Payment amount, currency or state does not match",
    );
    must(
      !pay.provider_payment_id || pay.provider_payment_id === entity.id,
      409,
      "PAYMENT_CONFLICT",
      "A different payment is already recorded for this order",
    );
    if (event) {
      const old = await one(
        c,
        "SELECT body_hash FROM webhook_events WHERE id=?",
        [event.id],
      );
      if (old) {
        must(
          old.body_hash === event.hash,
          409,
          "EVENT_CONFLICT",
          "Webhook event ID was reused",
        );
        return { ok: true, replayed: true };
      }
      await rows(
        c,
        "INSERT INTO webhook_events(id,body_hash,event_type) VALUES (?,?,?)",
        [event.id, event.hash, event.type],
      );
    }
    if (pay.status === "captured" || pay.status === "refunded")
      return { ok: true, replayed: true };
    await rows(
      c,
      "UPDATE payments SET status='captured',provider_payment_id=? WHERE id=?",
      [entity.id, p.id],
    );
    if (t.isOrder) {
      const expired = new Date(t.expires_at + "Z").getTime() < Date.now();
      if (
        t.inventory_released ||
        ["Cancelled", "Expired"].includes(t.status) ||
        expired
      ) {
        if (!t.inventory_released) {
          const { releaseInventory } = await import("./orders.js");
          await releaseInventory(c, t, "late_payment");
        }
        await rows(
          c,
          "UPDATE orders SET status='Cancelled',payment_status='captured' WHERE id=?",
          [t.id],
        );
        await queueRefund(
          c,
          { ...pay, provider_payment_id: entity.id },
          "Late payment after reservation ended",
        );
      } else {
        await rows(
          c,
          "UPDATE orders SET status='Order placed',payment_status='captured' WHERE id=?",
          [t.id],
        );
        const items = await rows(
          c,
          "SELECT product_id FROM order_items WHERE order_id=?",
          [t.id],
        );
        for (const item of items)
          await rows(
            c,
            "DELETE FROM cart_items WHERE user_id=? AND product_id=?",
            [t.user_id, item.product_id],
          );
      }
    } else {
      await rows(
        c,
        "UPDATE bookings SET payment_status='captured' WHERE id=?",
        [t.id],
      );
      if (t.status === "Cancelled")
        await queueRefund(
          c,
          { ...pay, provider_payment_id: entity.id },
          "Payment after service cancellation",
        );
    }
    await rows(
      c,
      "INSERT INTO notifications(user_id,title,message,type,payload) VALUES (?,?,?,?,?)",
      [
        t.user_id,
        app.config.PAYMENT_MODE === "test"
          ? "Test payment recorded"
          : "Payment received",
        app.config.PAYMENT_MODE === "test"
          ? "This was a simulated payment. No money was collected."
          : "Your payment has been confirmed.",
        "payment",
        JSON.stringify({ orderId: p.order_id, bookingId: p.booking_id }),
      ],
    );
    return { ok: true };
  });
}
export async function queueRefund(c, p, reason) {
  const id = randomUUID();
  await rows(
    c,
    "INSERT IGNORE INTO refunds(id,order_id,booking_id,payment_id,amount_paise) VALUES (?,?,?,?,?)",
    [id, p.order_id, p.booking_id, p.id, p.amount_paise],
  );
  const record = await one(
    c,
    `SELECT id FROM refunds WHERE ${p.order_id ? "order_id" : "booking_id"}=?`,
    [p.order_id || p.booking_id],
  );
  await rows(
    c,
    "INSERT IGNORE INTO outbox_jobs(id,type,payload) VALUES (?,?,?)",
    [record.id, "refund", JSON.stringify({ refundId: record.id, reason })],
  );
}
export async function processRefund(app, { refundId }) {
  const r = await one(
    app.db,
    "SELECT r.*,p.provider_payment_id FROM refunds r JOIN payments p ON p.id=r.payment_id WHERE r.id=?",
    [refundId],
  );
  if (!r || r.status === "processed") return;
  if (app.config.PAYMENT_MODE === "test") {
    await finishRefund(
      app,
      {
        id: `test_refund_${r.id}`,
        payment_id: r.provider_payment_id,
        amount: r.amount_paise,
        status: "processed",
      },
      r.id,
    );
    return;
  }
  must(app.gateway, 503, "GATEWAY_UNAVAILABLE", "Payment gateway unavailable");
  if (r.provider_refund_id) {
    const remote = await app.gateway.payments.fetchRefund(
      r.provider_payment_id,
      r.provider_refund_id,
    );
    await finishRefund(app, remote, r.id);
    must(
      remote.status === "processed",
      503,
      "REFUND_PENDING",
      "Gateway refund reconciliation is pending",
    );
    return;
  }
  // Reconcile before every retry. Once a send is uncertain we never issue another refund blindly.
  if (r.status === "sending" || r.status === "reconcile") {
    const remote = await app.gateway.payments.fetchMultipleRefund(
      r.provider_payment_id,
      { count: 100 },
    );
    const found = remote.items?.find((x) => x.notes?.localRefundId === r.id);
    if (found) {
      await finishRefund(app, found, r.id);
      must(
        found.status === "processed",
        503,
        "REFUND_PENDING",
        "Gateway refund reconciliation is pending",
      );
      return;
    }
    fail(
      503,
      "REFUND_RECONCILIATION",
      "Refund submission is uncertain; reconcile with the gateway before retrying the transfer",
    );
  }
  const claimed = await rows(
    app.db,
    "UPDATE refunds SET status='sending' WHERE id=? AND status='pending'",
    [r.id],
  );
  if (!claimed.affectedRows) return;
  try {
    const remote = await app.gateway.payments.refund(r.provider_payment_id, {
      amount: r.amount_paise,
      notes: { localRefundId: r.id },
    });
    await finishRefund(app, remote, r.id);
    must(
      remote.status === "processed",
      503,
      "REFUND_PENDING",
      "Gateway refund reconciliation is pending",
    );
  } catch (e) {
    await rows(app.db, "UPDATE refunds SET status='reconcile' WHERE id=?", [
      r.id,
    ]);
    throw e;
  }
}
export async function finishRefund(app, remote, localId = null) {
  await tx(app.db, async (c) => {
    const r = localId
      ? await one(c, "SELECT * FROM refunds WHERE id=? FOR UPDATE", [localId])
      : await one(
          c,
          "SELECT * FROM refunds WHERE provider_refund_id=? FOR UPDATE",
          [remote.id],
        );
    must(r, 404, "REFUND_NOT_FOUND", "Refund not found");
    if (r.status === "processed") return;
    must(
      !r.provider_refund_id || r.provider_refund_id === remote.id,
      409,
      "REFUND_CONFLICT",
      "A different refund is already recorded",
    );
    must(
      ["pending", "processed", "failed"].includes(remote.status),
      400,
      "REFUND_STATE",
      "Unsupported gateway refund state",
    );
    const p = await one(c, "SELECT * FROM payments WHERE id=?", [r.payment_id]);
    must(
      remote.payment_id === p.provider_payment_id &&
        Number(remote.amount) === r.amount_paise,
      400,
      "REFUND_MISMATCH",
      "Refund does not match the original payment",
    );
    await rows(
      c,
      "UPDATE refunds SET status=?,provider_refund_id=? WHERE id=?",
      [remote.status, remote.id, r.id],
    );
    if (remote.status === "processed") {
      await rows(c, "UPDATE payments SET status='refunded' WHERE id=?", [p.id]);
      await rows(
        c,
        `UPDATE ${r.order_id ? "orders" : "bookings"} SET payment_status='refunded' WHERE id=?`,
        [r.order_id || r.booking_id],
      );
    }
  });
}
export async function handleWebhook(app, req) {
  const signature = req.headers["x-razorpay-signature"];
  must(
    typeof signature === "string" && app.config.RAZORPAY_WEBHOOK_SECRET,
    401,
    "SIGNATURE_REQUIRED",
    "Webhook signature is required",
  );
  const raw = req.rawBody;
  must(
    raw &&
      equal(
        createHmac("sha256", app.config.RAZORPAY_WEBHOOK_SECRET)
          .update(raw)
          .digest("hex"),
        signature,
      ),
    401,
    "SIGNATURE_INVALID",
    "Invalid webhook signature",
  );
  const event = req.body,
    id = req.headers["x-razorpay-event-id"];
  must(
    typeof id === "string" && id.length <= 128,
    400,
    "EVENT_ID_REQUIRED",
    "Webhook event ID is required",
  );
  if (event.event === "payment.captured")
    return capturePayment(app, event.payload?.payment?.entity || {}, {
      id,
      hash: hash(raw),
      type: event.event,
    });
  if (["refund.processed", "refund.failed"].includes(event.event)) {
    const refund = event.payload?.refund?.entity;
    must(refund, 400, "EVENT_INVALID", "Missing refund entity");
    const local = refund.notes?.localRefundId;
    must(
      !local || typeof local === "string",
      400,
      "EVENT_INVALID",
      "Invalid refund reference",
    );
    await finishRefund(app, refund, local || null);
    return { ok: true };
  }
  return { ok: true, ignored: true };
}
