import { readdir, access } from "node:fs/promises";
import path from "node:path";
import { rows, one, tx } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";
import {
  obj,
  str,
  integer,
  bool,
  pagination,
  phone,
  ids,
  email,
} from "../schema.js";
import { must } from "../errors.js";
import { page, paged, publicUser, parseJSON } from "../security.js";
import { invalidateCatalog, cached } from "../cache.js";
import { attachUploads } from "../bookings.js";
export async function validateCatalogImage(app, image) {
  const match = /^\/api\/uploads\/([a-f0-9-]{36})\/content$/.exec(image);
  if (match) {
    must(
      await one(
        app.db,
        "SELECT id FROM uploads WHERE id=? AND kind='catalog' AND status='ready' AND content_type LIKE 'image/%'",
        [match[1]],
      ),
      400,
      "IMAGE_INVALID",
      "Choose a completed catalog image",
    );
    return;
  }
  must(
    /^[a-zA-Z0-9_.-]+\.(jpg|jpeg|png|webp|svg)$/i.test(image),
    400,
    "IMAGE_INVALID",
    "Choose a nursery image",
  );
  try {
    await access(path.resolve("public/assets", image));
  } catch {
    must(
      false,
      400,
      "IMAGE_INVALID",
      "The selected nursery image does not exist",
    );
  }
}
export async function listAdminUsers(app, query) {
  const p = page(query),
    params = [p.cursor];
  let where = "id<?";
  if (query.role) {
    where += " AND role=?";
    params.push(query.role);
  }
  if (query.status) {
    where += " AND status=?";
    params.push(query.status);
  }
  if (query.q) {
    const q = query.q.trim();
    if (q.includes("@")) {
      where += " AND email=?";
      params.push(q.toLowerCase());
    } else if (/^\+?[0-9]{10,15}$/.test(q)) {
      where += " AND (phone=? OR contact_phone=?)";
      params.push(q, q);
    } else {
      where += " AND name LIKE ?";
      params.push(q.replace(/[\\%_]/g, "\\$&") + "%");
    }
  }
  const data = await rows(
    app.db,
    `SELECT id AS seq,id,name,email,phone,contact_phone,city,role,status,created_at FROM users WHERE ${where} ORDER BY id DESC LIMIT ?`,
    [...params, p.limit + 1],
  );
  return paged(data, p.limit, (u) => ({ ...publicUser(u), seq: u.seq }));
}
export async function portalRoutes(app) {
  const auth = { preHandler: requireAuth },
    admin = { preHandler: requireRole("admin") };
  app.get("/api/business", async () => publicBusiness(app));
  app.get("/api/admin/business", admin, async () => publicBusiness(app));
  app.put(
    "/api/admin/business",
    {
      ...admin,
      schema: {
        body: obj({
          name: str(160),
          email: { anyOf: [email, { type: "string", maxLength: 0 }] },
          phone: { anyOf: [phone, { type: "string", maxLength: 0 }] },
          address: str(1000, 0),
        }),
      },
    },
    async (req) => {
      await tx(app.db, async (c) => {
        await rows(
          c,
          "INSERT INTO settings(`key`,value_json) VALUES ('business_profile',?) ON DUPLICATE KEY UPDATE value_json=VALUES(value_json)",
          [JSON.stringify(req.body)],
        );
        await rows(
          c,
          "INSERT INTO audit_logs(actor_id,action,resource_type,resource_id) VALUES (?,?,?,?)",
          [req.user.id, "business.update", "settings", "business_profile"],
        );
      });
      if (app.redis) await app.redis.del("kn:business");
      return { ok: true };
    },
  );
  app.get("/api/account/overview", auth, async (req) => {
    const [orders, bookings, wishlist] = await Promise.all([
      one(
        app.db,
        "SELECT COUNT(*) AS total,COALESCE(SUM(CASE WHEN payment_status='captured' AND status NOT IN ('Cancelled','Expired') AND NOT EXISTS (SELECT 1 FROM refunds r WHERE r.order_id=orders.id) THEN total_paise ELSE 0 END),0) AS spent FROM orders WHERE user_id=?",
        [req.user.id],
      ),
      one(app.db, "SELECT COUNT(*) AS total FROM bookings WHERE user_id=?", [
        req.user.id,
      ]),
      one(app.db, "SELECT COUNT(*) AS total FROM wishlist WHERE user_id=?", [
        req.user.id,
      ]),
    ]);
    return {
      orders: Number(orders.total),
      bookings: Number(bookings.total),
      saved: Number(wishlist.total),
      totalSpent: Number(orders.spent) / 100,
    };
  });
  app.get("/api/admin/assets", admin, async () => ({
    items: (await readdir(path.resolve("public/assets")))
      .filter((n) => /\.(jpe?g|png|webp)$/i.test(n))
      .sort(),
  }));
  app.get("/api/admin/categories", admin, async () => ({
    items: await rows(
      app.db,
      "SELECT * FROM categories ORDER BY name LIMIT 200",
    ),
  }));
  app.patch(
    "/api/admin/categories/:id",
    {
      ...admin,
      schema: {
        body: {
          ...obj(
            {
              active: bool,
              name: str(100),
              slug: { type: "string", pattern: "^[a-z0-9-]{1,120}$" },
            },
            [],
          ),
          minProperties: 1,
        },
      },
    },
    async (req) => {
      const r = await rows(
        app.db,
        "UPDATE categories SET active=COALESCE(?,active),name=COALESCE(?,name),slug=COALESCE(?,slug) WHERE id=?",
        [
          req.body.active ?? null,
          req.body.name ?? null,
          req.body.slug ?? null,
          req.params.id,
        ],
      );
      must(r.affectedRows, 404, "NOT_FOUND", "Category not found");
      await invalidateCatalog(app.redis);
      if (app.redis) await app.redis.del("kn:categories");
      return { ok: true };
    },
  );
  app.get("/api/admin/service-categories", admin, async () => ({
    items: await rows(
      app.db,
      "SELECT * FROM service_categories ORDER BY name LIMIT 200",
    ),
  }));
  app.patch(
    "/api/admin/service-categories/:name",
    { ...admin, schema: { body: obj({ active: bool }) } },
    async (req) => {
      const r = await rows(
        app.db,
        "UPDATE service_categories SET active=? WHERE name=?",
        [req.body.active, req.params.name],
      );
      must(r.affectedRows, 404, "NOT_FOUND", "Category not found");
      await invalidateCatalog(app.redis);
      if (app.redis) await app.redis.del("kn:service-categories");
      return { ok: true };
    },
  );
  app.get(
    "/api/admin/bookings/:id/eligible-partners",
    {
      ...admin,
      schema: {
        querystring: obj(
          {
            q: str(100, 0),
            limit: { ...integer(1, 100), default: 50 },
            cursor: str(36),
          },
          [],
        ),
      },
    },
    async (req) => {
      const b = await one(
        app.db,
        "SELECT b.city,b.user_id,s.category FROM bookings b JOIN services s ON s.id=b.service_id WHERE b.id=?",
        [req.params.id],
      );
      must(b, 404, "NOT_FOUND", "Booking not found");
      const data = await rows(
        app.db,
        `SELECT p.id,p.name,p.city,p.received_count FROM partners p JOIN users u ON u.id=p.user_id JOIN partner_categories pc ON pc.partner_id=p.id WHERE p.status='Approved' AND p.available=TRUE AND u.status='active' AND p.city=? AND pc.category=? AND p.user_id<>? ${req.query.cursor ? "AND p.id>?" : ""} ${req.query.q ? "AND p.name LIKE ?" : ""} ORDER BY p.id LIMIT ?`,
        [
          b.city,
          b.category,
          b.user_id,
          ...(req.query.cursor ? [req.query.cursor] : []),
          ...(req.query.q
            ? [req.query.q.replace(/[\\%_]/g, "\\$&") + "%"]
            : []),
          (req.query.limit || 50) + 1,
        ],
      );
      const limit = req.query.limit || 50;
      return {
        items: data.slice(0, limit),
        nextCursor: data.length > limit ? data[limit - 1].id : null,
      };
    },
  );
  app.post("/api/admin/jobs/:id/retry", admin, async (req) => {
    await tx(app.db, async (c) => {
      const job = await one(
        c,
        "SELECT * FROM outbox_jobs WHERE id=? FOR UPDATE",
        [req.params.id],
      );
      must(
        job?.status === "failed",
        409,
        "JOB_NOT_FAILED",
        "Only failed jobs can be retried",
      );
      await rows(
        c,
        "UPDATE outbox_jobs SET status='pending',attempts=0,available_at=UTC_TIMESTAMP(3),lease_until=NULL,lease_token=NULL WHERE id=?",
        [job.id],
      );
      await rows(
        c,
        "INSERT INTO audit_logs(actor_id,action,resource_type,resource_id) VALUES (?,?,?,?)",
        [req.user.id, "job.retry", "job", job.id],
      );
    });
    return { ok: true };
  });
  const application = obj({
    name: str(160),
    person: str(100),
    city: str(100),
    address: str(500),
    experience: str(100),
    phone,
    categories: {
      type: "array",
      items: str(100),
      minItems: 1,
      maxItems: 20,
      uniqueItems: true,
    },
    uploadIds: { ...ids, minItems: 1 },
  });
  app.put(
    "/api/partner/application",
    { preHandler: requireRole("partner"), schema: { body: application } },
    async (req) => {
      const b = req.body;
      await tx(app.db, async (c) => {
        const p = await one(
          c,
          "SELECT * FROM partners WHERE user_id=? FOR UPDATE",
          [req.user.id],
        );
        must(
          p && ["Pending", "Rejected"].includes(p.status),
          409,
          "APPLICATION_LOCKED",
          "Only pending or rejected applications can be amended",
        );
        for (const category of b.categories)
          must(
            await one(
              c,
              "SELECT name FROM service_categories WHERE name=? AND active=TRUE",
              [category],
            ),
            400,
            "CATEGORY_INVALID",
            "Select an active service category",
          );
        await rows(
          c,
          "UPDATE partners SET name=?,person=?,city=?,address=?,experience=?,status='Pending',available=FALSE WHERE id=?",
          [b.name, b.person, b.city, b.address, b.experience, p.id],
        );
        await rows(c, "DELETE FROM partner_categories WHERE partner_id=?", [
          p.id,
        ]);
        for (const category of b.categories)
          await rows(
            c,
            "INSERT INTO partner_categories(partner_id,category) VALUES (?,?)",
            [p.id, category],
          );
        await rows(c, "DELETE FROM partner_uploads WHERE partner_id=?", [p.id]);
        await attachUploads(
          c,
          "partner_uploads",
          p.id,
          req.user.id,
          b.uploadIds,
          ["document"],
        );
        await rows(c, "UPDATE users SET contact_phone=? WHERE id=?", [
          b.phone,
          req.user.id,
        ]);
        await rows(
          c,
          "INSERT INTO notifications(user_id,title,message,type) VALUES (?,?,?,?)",
          [
            req.user.id,
            "Application submitted",
            "Your updated application is awaiting nursery review.",
            "partner",
          ],
        );
      });
      await app.invalidateUserSessions(req.user.id);
      return { status: "Pending" };
    },
  );
}

export async function publicBusiness(app) {
  return cached(app.redis, "kn:business", 20, async () => {
    const data = await one(
      app.db,
      "SELECT value_json FROM settings WHERE `key`='business_profile'",
    );
    return parseJSON(data?.value_json, {
      name: "Kaushik Nursery",
      email: "",
      phone: "",
      address: "",
    });
  });
}
