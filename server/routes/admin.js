import { listAdminUsers, validateCatalogImage } from "./portal.js";
import { randomUUID } from "node:crypto";
import { rows, one, tx } from "../db.js";
import { requireRole, revokeSessions } from "../auth.js";
import { obj, str, integer, bool, pagination } from "../schema.js";
import { must } from "../errors.js";
import { page, paged, parseJSON, publicUser } from "../security.js";
import { invalidateCatalog } from "../cache.js";
import { mapProduct, catalogServices } from "./catalog.js";
import { listOrders, cancelOrder } from "../orders.js";
import { listBookings } from "../bookings.js";
export async function audit(db, userId, action, type, id, details = {}) {
  await rows(
    db,
    "INSERT INTO audit_logs(actor_id,action,resource_type,resource_id,details) VALUES (?,?,?,?,?)",
    [userId, action, type, String(id), JSON.stringify(details)],
  );
}
export async function adminRoutes(app) {
  const auth = { preHandler: requireRole("admin") };
  app.get("/api/admin/overview", auth, async () => {
    const queries = [
      "SELECT COUNT(*) AS n FROM users WHERE role='customer'",
      "SELECT COUNT(*) AS n FROM partners WHERE status='Pending'",
      "SELECT COUNT(*) AS n FROM bookings WHERE status NOT IN ('Cancelled','Service completed')",
      "SELECT COUNT(*) AS n FROM orders",
      "SELECT COALESCE(SUM(amount_paise),0) AS n FROM payments WHERE status='captured'",
      "SELECT COUNT(*) AS n FROM outbox_jobs WHERE status='failed'",
    ];
    const values = await Promise.all(queries.map((sql) => one(app.db, sql)));
    return {
      customers: Number(values[0].n),
      pendingPartners: Number(values[1].n),
      activeBookings: Number(values[2].n),
      orders: Number(values[3].n),
      capturedAmount: Number(values[4].n) / 100,
      failedJobs: Number(values[5].n),
    };
  });
  app.get(
    "/api/admin/users",
    {
      ...auth,
      schema: {
        querystring: obj(
          {
            ...pagination.properties,
            q: str(100, 0),
            role: { type: "string", enum: ["customer", "partner", "admin"] },
            status: { type: "string", enum: ["active", "disabled"] },
          },
          [],
        ),
      },
    },
    (req) => listAdminUsers(app, req.query),
  );
  app.patch(
    "/api/admin/users/:id/status",
    {
      ...auth,
      schema: {
        body: obj({ status: { type: "string", enum: ["active", "disabled"] } }),
      },
    },
    async (req) => {
      must(
        String(req.params.id) !== String(req.user.id),
        409,
        "SELF_DISABLE",
        "You cannot disable your own admin account",
      );
      const u = await one(app.db, "SELECT role FROM users WHERE id=?", [
        req.params.id,
      ]);
      must(u, 404, "NOT_FOUND", "User not found");
      must(
        u.role !== "admin",
        403,
        "ADMIN_PROTECTED",
        "Manage administrator access through the operator CLI",
      );
      await tx(app.db, async (c) => {
        await rows(c, "UPDATE users SET status=? WHERE id=?", [
          req.body.status,
          req.params.id,
        ]);
        await audit(
          c,
          req.user.id,
          "user.status",
          "user",
          req.params.id,
          req.body,
        );
      });
      await revokeSessions(app, req.params.id);
      return { ok: true };
    },
  );
  app.get(
    "/api/admin/partners",
    {
      ...auth,
      schema: {
        querystring: obj(
          { limit: { ...integer(1, 100), default: 25 }, cursor: str(36) },
          [],
        ),
      },
    },
    async (req) => {
      const limit = req.query.limit || 25;
      const ps = await rows(
        app.db,
        `SELECT p.*,COALESCE(u.phone,u.contact_phone) AS phone,u.email FROM partners p JOIN users u ON u.id=p.user_id ${req.query.cursor ? "WHERE p.id<?" : ""} ORDER BY p.id DESC LIMIT ?`,
        [...(req.query.cursor ? [req.query.cursor] : []), limit + 1],
      );
      const ids = ps.slice(0, limit).map((p) => p.id);
      const cats = ids.length
        ? await rows(
            app.db,
            `SELECT * FROM partner_categories WHERE partner_id IN (${ids.map(() => "?")})`,
            ids,
          )
        : [];
      const docs = ids.length
        ? await rows(
            app.db,
            `SELECT pu.partner_id,u.id,u.original_name FROM partner_uploads pu JOIN uploads u ON u.id=pu.upload_id WHERE pu.partner_id IN (${ids.map(() => "?")})`,
            ids,
          )
        : [];
      return {
        items: ps.slice(0, limit).map((p) => ({
          ...p,
          userId: String(p.user_id),
          available: Boolean(p.available),
          received: Number(p.received_count),
          categories: cats
            .filter((c) => c.partner_id === p.id)
            .map((c) => c.category),
          documents: docs
            .filter((d) => d.partner_id === p.id)
            .map((d) => d.original_name),
          uploads: docs.filter((d) => d.partner_id === p.id),
        })),
        nextCursor: ps.length > limit ? ids.at(-1) : null,
      };
    },
  );
  app.patch(
    "/api/admin/partners/:id/status",
    {
      ...auth,
      schema: {
        body: obj({
          status: {
            type: "string",
            enum: ["Approved", "Rejected", "Suspended"],
          },
        }),
      },
    },
    async (req) => {
      let userId;
      await tx(app.db, async (c) => {
        const p = await one(c, "SELECT * FROM partners WHERE id=? FOR UPDATE", [
          req.params.id,
        ]);
        must(p, 404, "NOT_FOUND", "Partner not found");
        userId = p.user_id;
        if (req.body.status === "Approved")
          must(
            await one(
              c,
              "SELECT pu.upload_id FROM partner_uploads pu JOIN uploads u ON u.id=pu.upload_id WHERE pu.partner_id=? AND u.status='ready' AND u.kind='document' LIMIT 1",
              [p.id],
            ),
            409,
            "DOCUMENTS_REQUIRED",
            "Review at least one uploaded identity or business document before approval",
          );
        await rows(c, "UPDATE partners SET status=?,available=? WHERE id=?", [
          req.body.status,
          req.body.status === "Approved",
          p.id,
        ]);
        await audit(
          c,
          req.user.id,
          "partner.status",
          "partner",
          p.id,
          req.body,
        );
        await rows(
          c,
          "INSERT INTO notifications(user_id,title,message,type) VALUES (?,?,?,?)",
          [
            p.user_id,
            "Partner application updated",
            `Your application is ${req.body.status.toLowerCase()}.`,
            "partner",
          ],
        );
      });
      await app.invalidateUserSessions(userId);
      return { ok: true };
    },
  );
  app.get(
    "/api/admin/bookings",
    { ...auth, schema: { querystring: pagination } },
    (req) => listBookings(app, req.user, req.query),
  );
  app.post(
    "/api/admin/bookings/:id/assign",
    {
      ...auth,
      schema: {
        body: obj({ partnerId: { anyOf: [str(36), { type: "null" }] } }),
      },
    },
    async (req) => {
      await tx(app.db, async (c) => {
        const b = await one(
          c,
          "SELECT b.*,s.category FROM bookings b JOIN services s ON s.id=b.service_id WHERE b.id=? FOR UPDATE",
          [req.params.id],
        );
        must(b, 404, "NOT_FOUND", "Booking not found");
        must(
          !["Cancelled", "Service completed"].includes(b.status),
          409,
          "BOOKING_CLOSED",
          "This booking is closed",
        );
        if (req.body.partnerId) {
          const p = await one(
            c,
            "SELECT p.* FROM partners p JOIN users u ON u.id=p.user_id JOIN partner_categories pc ON pc.partner_id=p.id WHERE p.id=? AND p.status='Approved' AND p.available=TRUE AND p.city=? AND pc.category=? AND p.user_id<>? AND u.status='active' FOR UPDATE",
            [req.body.partnerId, b.city, b.category, b.user_id],
          );
          must(
            p,
            400,
            "PARTNER_INELIGIBLE",
            "Choose an approved, available partner matching city and service category",
          );
        }
        await rows(
          c,
          "UPDATE bookings SET assigned_partner_id=?,status=? WHERE id=?",
          [
            req.body.partnerId,
            req.body.partnerId ? "Partner assigned" : "Request submitted",
            b.id,
          ],
        );
        await rows(
          c,
          "UPDATE booking_recipients SET status='closed' WHERE booking_id=?",
          [b.id],
        );
        if (req.body.partnerId)
          await rows(
            c,
            "INSERT INTO booking_recipients(booking_id,partner_id,status) VALUES (?,?,'accepted') ON DUPLICATE KEY UPDATE status='accepted'",
            [b.id, req.body.partnerId],
          );
        await rows(
          c,
          "INSERT INTO booking_events(booking_id,actor_id,status,notes) VALUES (?,?,?,?)",
          [
            b.id,
            req.user.id,
            req.body.partnerId ? "Partner assigned" : "Request submitted",
            "Administrative assignment override",
          ],
        );
        await audit(
          c,
          req.user.id,
          "booking.assign",
          "booking",
          b.id,
          req.body,
        );
      });
      return { ok: true };
    },
  );
  app.get(
    "/api/admin/orders",
    { ...auth, schema: { querystring: pagination } },
    (req) => listOrders(app.db, null, req.query),
  );
  app.patch(
    "/api/admin/orders/:id/status",
    {
      ...auth,
      schema: {
        body: obj({
          status: {
            type: "string",
            enum: [
              "Confirmed",
              "Processing",
              "Dispatched",
              "Delivered",
              "Cancelled",
            ],
          },
        }),
      },
    },
    async (req) => {
      if (req.body.status === "Cancelled")
        return cancelOrder(app, req.params.id, req.user);
      await tx(app.db, async (c) => {
        const o = await one(c, "SELECT * FROM orders WHERE id=? FOR UPDATE", [
          req.params.id,
        ]);
        must(o, 404, "NOT_FOUND", "Order not found");
        const next = {
          "Order placed": "Confirmed",
          Confirmed: "Processing",
          Processing: "Dispatched",
          Dispatched: "Delivered",
        };
        must(
          o.payment_status === "captured" &&
            (o.status === req.body.status ||
              next[o.status] === req.body.status),
          409,
          "STATUS_CONFLICT",
          "Only paid orders can advance, one step at a time",
        );
        must(
          !(await one(c, "SELECT id FROM refunds WHERE order_id=? LIMIT 1", [
            o.id,
          ])),
          409,
          "REFUND_IN_PROGRESS",
          "An order with a requested refund cannot advance",
        );
        await rows(c, "UPDATE orders SET status=? WHERE id=?", [
          req.body.status,
          o.id,
        ]);
        await audit(c, req.user.id, "order.status", "order", o.id, req.body);
        await rows(
          c,
          "INSERT INTO notifications(user_id,title,message,type,payload) VALUES (?,?,?,?,?)",
          [
            o.user_id,
            "Your nursery order was updated",
            req.body.status,
            "order",
            JSON.stringify({ orderId: o.id }),
          ],
        );
      });
      return { ok: true };
    },
  );
  app.get(
    "/api/admin/products",
    {
      ...auth,
      schema: {
        querystring: obj(
          { limit: { ...integer(1, 100), default: 100 }, cursor: str(36) },
          [],
        ),
      },
    },
    async (req) => {
      const limit = req.query.limit || 100;
      const data = await rows(
        app.db,
        `SELECT p.*,c.name AS category FROM products p JOIN categories c ON c.id=p.category_id ${req.query.cursor ? "WHERE p.id>?" : ""} ORDER BY p.id LIMIT ?`,
        [...(req.query.cursor ? [req.query.cursor] : []), limit + 1],
      );
      return {
        items: data.slice(0, limit).map(mapProduct),
        nextCursor: data.length > limit ? data[limit - 1].id : null,
      };
    },
  );
  const productSchema = obj(
    {
      name: str(160),
      category: str(100),
      description: str(5000),
      price: integer(1, 1000000),
      oldPrice: integer(0, 1000000),
      stock: integer(0, 1000000),
      image: str(500),
      care: str(160, 0),
      water: str(160, 0),
      badge: str(100, 0),
      active: bool,
    },
    ["name", "category", "description", "price", "stock", "image"],
  );
  async function saveProduct(req, reply) {
    const b = req.body,
      id = req.params.id || randomUUID();
    await validateCatalogImage(app, b.image);
    await tx(app.db, async (c) => {
      const cat = await one(
        c,
        "SELECT id FROM categories WHERE name=? AND active=TRUE",
        [b.category],
      );
      must(cat, 400, "CATEGORY_INVALID", "Choose an active product category");
      const old = await one(
        c,
        "SELECT stock FROM products WHERE id=? FOR UPDATE",
        [id],
      );
      if (req.params.id) must(old, 404, "NOT_FOUND", "Product not found");
      if (old)
        await rows(
          c,
          "UPDATE products SET category_id=?,name=?,description=?,price_paise=?,old_price_paise=?,stock=?,image=?,care=?,water=?,badge=?,active=? WHERE id=?",
          [
            cat.id,
            b.name,
            b.description,
            b.price * 100,
            (b.oldPrice || 0) * 100,
            b.stock,
            b.image,
            b.care || "",
            b.water || "",
            b.badge || "",
            b.active ?? true,
            id,
          ],
        );
      else
        await rows(
          c,
          "INSERT INTO products(id,category_id,name,description,price_paise,old_price_paise,stock,image,care,water,badge,active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
          [
            id,
            cat.id,
            b.name,
            b.description,
            b.price * 100,
            (b.oldPrice || 0) * 100,
            b.stock,
            b.image,
            b.care || "",
            b.water || "",
            b.badge || "",
            b.active ?? true,
          ],
        );
      if (!old || old.stock !== b.stock)
        await rows(
          c,
          "INSERT INTO inventory_movements(product_id,actor_id,delta,reason) VALUES (?,?,?,?)",
          [id, req.user.id, b.stock - (old?.stock || 0), "admin_adjustment"],
        );
      await audit(
        c,
        req.user.id,
        old ? "product.update" : "product.create",
        "product",
        id,
      );
    });
    await invalidateCatalog(app.redis);
    reply.code(req.params.id ? 200 : 201);
    return { id };
  }
  app.post(
    "/api/admin/products",
    { ...auth, schema: { body: productSchema } },
    saveProduct,
  );
  app.put(
    "/api/admin/products/:id",
    { ...auth, schema: { body: productSchema } },
    saveProduct,
  );
  app.post(
    "/api/admin/categories",
    {
      ...auth,
      schema: {
        body: obj({
          name: str(100),
          slug: { type: "string", pattern: "^[a-z0-9-]{1,120}$" },
        }),
      },
    },
    async (req, reply) => {
      await rows(app.db, "INSERT INTO categories(name,slug) VALUES (?,?)", [
        req.body.name,
        req.body.slug,
      ]);
      await invalidateCatalog(app.redis);
      reply.code(201);
      return { ok: true };
    },
  );
  app.post(
    "/api/admin/service-categories",
    { ...auth, schema: { body: obj({ name: str(100) }) } },
    async (req) => {
      await rows(app.db, "INSERT INTO service_categories(name) VALUES (?)", [
        req.body.name,
      ]);
      if (app.redis) await app.redis.del("kn:service-categories");
      return { ok: true };
    },
  );
  app.get("/api/admin/services", auth, async () => ({
    items: await catalogServices(app, true),
  }));
  const serviceSchema = obj(
    {
      name: str(160),
      category: str(100),
      description: str(5000),
      image: str(500),
      label: str(100, 0),
      active: bool,
      packages: {
        type: "array",
        minItems: 1,
        maxItems: 10,
        items: obj(
          {
            id: str(36),
            name: str(160),
            description: str(2000, 0),
            price: integer(1, 1000000),
          },
          ["name", "price"],
        ),
      },
    },
    ["name", "category", "description", "image", "packages"],
  );
  async function saveService(req, reply) {
    const b = req.body,
      id = req.params.id || randomUUID();
    await validateCatalogImage(app, b.image);
    await tx(app.db, async (c) => {
      must(
        await one(
          c,
          "SELECT name FROM service_categories WHERE name=? AND active=TRUE",
          [b.category],
        ),
        400,
        "CATEGORY_INVALID",
        "Choose an active service category",
      );
      if (req.params.id) {
        must(
          await one(c, "SELECT id FROM services WHERE id=?", [id]),
          404,
          "NOT_FOUND",
          "Service not found",
        );
        await rows(
          c,
          "UPDATE services SET name=?,category=?,description=?,image=?,label=?,active=? WHERE id=?",
          [
            b.name,
            b.category,
            b.description,
            b.image,
            b.label || "",
            b.active ?? true,
            id,
          ],
        );
        await rows(
          c,
          "UPDATE service_packages SET active=FALSE WHERE service_id=?",
          [id],
        );
      } else
        await rows(
          c,
          "INSERT INTO services(id,name,category,description,image,label,active) VALUES (?,?,?,?,?,?,?)",
          [
            id,
            b.name,
            b.category,
            b.description,
            b.image,
            b.label || "",
            b.active ?? true,
          ],
        );
      for (const p of b.packages) {
        const pid = p.id || randomUUID();
        const old = await one(
          c,
          "SELECT service_id FROM service_packages WHERE id=?",
          [pid],
        );
        must(
          !old || old.service_id === id,
          400,
          "PACKAGE_INVALID",
          "Package belongs to a different service",
        );
        await rows(
          c,
          "INSERT INTO service_packages(id,service_id,name,description,price_paise) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),description=VALUES(description),price_paise=VALUES(price_paise),active=TRUE",
          [pid, id, p.name, p.description || "", p.price * 100],
        );
      }
      await audit(c, req.user.id, "service.save", "service", id);
    });
    await invalidateCatalog(app.redis);
    reply.code(req.params.id ? 200 : 201);
    return { id };
  }
  app.post(
    "/api/admin/services",
    { ...auth, schema: { body: serviceSchema } },
    saveService,
  );
  app.put(
    "/api/admin/services/:id",
    { ...auth, schema: { body: serviceSchema } },
    saveService,
  );
  app.get("/api/admin/settings", auth, async () =>
    parseJSON(
      (
        await one(app.db, "SELECT value_json FROM settings WHERE `key`=?", [
          "lead_distribution",
        ])
      )?.value_json,
      { maxPartners: 6, rotation: true },
    ),
  );
  app.put(
    "/api/admin/settings",
    {
      ...auth,
      schema: { body: obj({ maxPartners: integer(1, 20), rotation: bool }) },
    },
    async (req) => {
      await tx(app.db, async (c) => {
        await rows(
          c,
          "INSERT INTO settings(`key`,value_json) VALUES (?,?) ON DUPLICATE KEY UPDATE value_json=VALUES(value_json)",
          ["lead_distribution", JSON.stringify(req.body)],
        );
        await audit(
          c,
          req.user.id,
          "settings.update",
          "settings",
          "lead_distribution",
          req.body,
        );
      });
      return { ok: true };
    },
  );
  app.get(
    "/api/admin/payments",
    { ...auth, schema: { querystring: pagination } },
    async (req) => {
      const p = page(req.query);
      const data = await rows(
        app.db,
        "SELECT p.*,COALESCE(o.user_id,b.user_id) AS user_id,r.status AS refund_status FROM payments p LEFT JOIN orders o ON o.id=p.order_id LEFT JOIN bookings b ON b.id=p.booking_id LEFT JOIN refunds r ON r.payment_id=p.id WHERE p.seq<? ORDER BY p.seq DESC LIMIT ?",
        [p.cursor, p.limit + 1],
      );
      return paged(data, p.limit);
    },
  );
  app.get(
    "/api/admin/audit",
    { ...auth, schema: { querystring: pagination } },
    async (req) => {
      const p = page(req.query);
      return paged(
        await rows(
          app.db,
          "SELECT * FROM audit_logs WHERE seq<? ORDER BY seq DESC LIMIT ?",
          [p.cursor, p.limit + 1],
        ),
        p.limit,
      );
    },
  );
  app.get("/api/admin/notifications", auth, async () => ({
    items: await rows(
      app.db,
      "SELECT id,status,created_at,JSON_UNQUOTE(JSON_EXTRACT(payload,'$.title')) AS title,JSON_UNQUOTE(JSON_EXTRACT(payload,'$.message')) AS message,JSON_UNQUOTE(JSON_EXTRACT(payload,'$.audience')) AS audience FROM outbox_jobs WHERE type='broadcast' AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.cursor'))='0' ORDER BY created_at DESC,id DESC LIMIT 25",
    ),
  }));
  app.post(
    "/api/admin/notifications",
    {
      ...auth,
      schema: {
        body: obj({
          audience: { type: "string", enum: ["customers", "partners", "all"] },
          title: str(160),
          message: str(1000),
        }),
      },
    },
    async (req, reply) => {
      const id = randomUUID();
      await rows(
        app.db,
        "INSERT INTO outbox_jobs(id,type,payload) VALUES (?,?,?)",
        [
          id,
          "broadcast",
          JSON.stringify({ ...req.body, campaignId: id, cursor: "0" }),
        ],
      );
      await audit(app.db, req.user.id, "notification.broadcast", "job", id, {
        audience: req.body.audience,
      });
      reply.code(202);
      return { id, status: "queued" };
    },
  );
  app.get(
    "/api/admin/jobs",
    { ...auth, schema: { querystring: pagination } },
    async (req) => ({
      items: await rows(
        app.db,
        "SELECT id,type,status,attempts,available_at,lease_until,last_error,created_at FROM outbox_jobs ORDER BY created_at DESC LIMIT ?",
        [page(req.query).limit],
      ),
    }),
  );
  app.get(
    "/api/admin/reports/:type",
    { ...auth, config: { rateLimit: { max: 3, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const reports = {
        users: [
          "id",
          "SELECT id AS seq,name,email,role,status,created_at FROM users WHERE id>? ORDER BY id LIMIT 1000",
        ],
        orders: [
          "seq",
          "SELECT seq,id,status,payment_status,total_paise,created_at FROM orders WHERE seq>? ORDER BY seq LIMIT 1000",
        ],
        leads: [
          "seq",
          "SELECT seq,id,status,city,preferred_date,price_paise FROM bookings WHERE seq>? ORDER BY seq LIMIT 1000",
        ],
        partners: [
          "id",
          "SELECT id AS seq,name,city,status,received_count FROM partners WHERE id>? ORDER BY id LIMIT 1000",
        ],
        products: [
          "id",
          "SELECT id AS seq,name,stock,price_paise,active FROM products WHERE id>? ORDER BY id LIMIT 1000",
        ],
      };
      const spec = reports[req.params.type];
      must(spec, 404, "NOT_FOUND", "Report not found");
      const { Readable } = await import("node:stream");
      const db = app.db;
      const csv = (v) =>
        '"' +
        String(v ?? "")
          .replace(/^[=+\-@\t\r]/, "'$&")
          .replace(/"/g, '""') +
        '"';
      async function* exportRows() {
        let cursor =
          spec[0] === "seq" || req.params.type === "users" ? "0" : "";
        let header = false;
        for (let batches = 0; batches < 10000; batches++) {
          const data = await rows(db, spec[1], [cursor]);
          if (!data.length) break;
          if (!header) {
            yield Object.keys(data[0]).map(csv).join(",") + "\r\n";
            header = true;
          }
          for (const r of data)
            yield Object.values(r).map(csv).join(",") + "\r\n";
          cursor = String(data.at(-1).seq);
          if (data.length < 1000) break;
        }
      }
      reply
        .type("text/csv; charset=utf-8")
        .header(
          "Content-Disposition",
          `attachment; filename="kaushik-${req.params.type}.csv"`,
        );
      return reply.send(Readable.from(exportRows()));
    },
  );
}
