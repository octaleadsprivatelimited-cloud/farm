import { rows, one, tx } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";
import {
  obj,
  str,
  integer,
  bool,
  phone,
  ids,
  pagination,
  bookingBody,
  idempotencyHeaders,
} from "../schema.js";
import { must } from "../errors.js";
import {
  createBooking,
  getBooking,
  listBookings,
  acceptLead,
  attachUploads,
} from "../bookings.js";
import { randomUUID } from "node:crypto";
import { queueRefund } from "../payments.js";
export async function partnerProfile(db, userId) {
  const p = await one(
    db,
    "SELECT p.*,COALESCE(u.phone,u.contact_phone) AS phone,u.email FROM partners p JOIN users u ON u.id=p.user_id WHERE p.user_id=?",
    [userId],
  );
  if (!p) return null;
  const cats = await rows(
    db,
    "SELECT category FROM partner_categories WHERE partner_id=?",
    [p.id],
  );
  const docs = await rows(
    db,
    "SELECT u.id,u.original_name FROM partner_uploads pu JOIN uploads u ON u.id=pu.upload_id WHERE pu.partner_id=?",
    [p.id],
  );
  return {
    id: p.id,
    userId: String(p.user_id),
    name: p.name,
    person: p.person,
    phone: p.phone,
    email: p.email,
    city: p.city,
    address: p.address,
    experience: p.experience,
    status: p.status,
    available: Boolean(p.available),
    received: Number(p.received_count),
    categories: cats.map((c) => c.category),
    documents: docs.map((d) => d.original_name),
    uploads: docs,
  };
}
export async function bookingRoutes(app) {
  const auth = { preHandler: requireAuth },
    partnerAuth = { preHandler: requireRole("partner") };
  app.post(
    "/api/bookings",
    { ...auth, schema: { headers: idempotencyHeaders, body: bookingBody } },
    async (req, reply) => {
      reply.code(201);
      return createBooking(
        app,
        req.user,
        req.body,
        req.headers["idempotency-key"],
      );
    },
  );
  app.get(
    "/api/bookings",
    { ...auth, schema: { querystring: pagination } },
    (req) => listBookings(app, { ...req.user, role: "customer" }, req.query),
  );
  app.get("/api/bookings/:id", auth, (req) =>
    getBooking(app.db, req.params.id, req.user),
  );
  app.post("/api/bookings/:id/cancel", auth, async (req) => {
    await tx(app.db, async (c) => {
      const b = await one(
        c,
        `SELECT * FROM bookings WHERE id=?${req.user.role === "admin" ? "" : " AND user_id=?"} FOR UPDATE`,
        [req.params.id, ...(req.user.role === "admin" ? [] : [req.user.id])],
      );
      must(b, 404, "NOT_FOUND", "Booking not found");
      must(
        !["Service completed", "Service in progress"].includes(b.status),
        409,
        "STATUS_CONFLICT",
        "Contact support to cancel a service already in progress",
      );
      await rows(c, "UPDATE bookings SET status='Cancelled' WHERE id=?", [
        b.id,
      ]);
      if (b.payment_status === "captured") {
        const pay = await one(c, "SELECT * FROM payments WHERE booking_id=?", [
          b.id,
        ]);
        await queueRefund(c, pay, "Service cancelled");
      }
      await rows(
        c,
        "UPDATE booking_recipients SET status='closed' WHERE booking_id=?",
        [b.id],
      );
      await rows(
        c,
        "INSERT INTO booking_events(booking_id,actor_id,status) VALUES (?,?,?)",
        [b.id, req.user.id, "Cancelled"],
      );
    });
    return { ok: true };
  });
  app.put(
    "/api/bookings/:id/review",
    {
      ...auth,
      schema: { body: obj({ rating: integer(1, 5), text: str(1000) }) },
    },
    async (req) => {
      const b = await one(
        app.db,
        "SELECT * FROM bookings WHERE id=? AND user_id=? AND status='Service completed'",
        [req.params.id, req.user.id],
      );
      must(
        b?.assigned_partner_id,
        409,
        "REVIEW_UNAVAILABLE",
        "Only your completed services can be reviewed",
      );
      await rows(
        app.db,
        "INSERT INTO reviews(booking_id,user_id,partner_id,rating,feedback) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE rating=VALUES(rating),feedback=VALUES(feedback)",
        [
          b.id,
          req.user.id,
          b.assigned_partner_id,
          req.body.rating,
          req.body.text,
        ],
      );
      return { ok: true };
    },
  );
  app.post(
    "/api/partners/apply",
    {
      ...auth,
      schema: {
        body: obj(
          {
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
          },
          [
            "name",
            "person",
            "city",
            "address",
            "experience",
            "phone",
            "categories",
            "uploadIds",
          ],
        ),
      },
    },
    async (req, reply) => {
      must(
        req.user.role === "customer",
        409,
        "ALREADY_PARTNER",
        "Only customer accounts can submit a new partner application",
      );
      const b = req.body,
        id = randomUUID();
      await tx(app.db, async (c) => {
        await one(c, "SELECT id FROM users WHERE id=? FOR UPDATE", [
          req.user.id,
        ]);
        must(
          !(await one(c, "SELECT id FROM partners WHERE user_id=?", [
            req.user.id,
          ])),
          409,
          "APPLICATION_EXISTS",
          "Your application is already submitted",
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
            "Select an available service category",
          );
        await rows(
          c,
          "INSERT INTO partners(id,user_id,name,person,city,address,experience) VALUES (?,?,?,?,?,?,?)",
          [id, req.user.id, b.name, b.person, b.city, b.address, b.experience],
        );
        for (const category of b.categories)
          await rows(
            c,
            "INSERT INTO partner_categories(partner_id,category) VALUES (?,?)",
            [id, category],
          );
        await attachUploads(
          c,
          "partner_uploads",
          id,
          req.user.id,
          b.uploadIds,
          ["document"],
        );
        await rows(
          c,
          "UPDATE users SET role='partner',contact_phone=? WHERE id=?",
          [b.phone, req.user.id],
        );
      });
      await app.invalidateUserSessions(req.user.id);
      reply.code(201);
      return { id, status: "Pending" };
    },
  );
  app.get("/api/partner/profile", partnerAuth, async (req) => ({
    partner: await partnerProfile(app.db, req.user.id),
  }));
  app.patch(
    "/api/partner/profile",
    {
      ...partnerAuth,
      schema: {
        body: obj(
          {
            name: str(160),
            person: str(100),
            city: str(100),
            experience: str(100),
            available: bool,
          },
          ["name", "person", "city", "experience", "available"],
        ),
      },
    },
    async (req) => {
      const p = await one(
        app.db,
        "SELECT id,status FROM partners WHERE user_id=?",
        [req.user.id],
      );
      must(p, 404, "NOT_FOUND", "Partner profile not found");
      must(
        !req.body.available || p.status === "Approved",
        403,
        "APPROVAL_REQUIRED",
        "Nursery approval is required before receiving leads",
      );
      await rows(
        app.db,
        "UPDATE partners SET name=?,person=?,city=?,experience=?,available=? WHERE id=?",
        [
          req.body.name,
          req.body.person,
          req.body.city,
          req.body.experience,
          req.body.available,
          p.id,
        ],
      );
      return { ok: true };
    },
  );
  app.get(
    "/api/partner/leads",
    { ...partnerAuth, schema: { querystring: pagination } },
    (req) => listBookings(app, req.user, req.query, "leads"),
  );
  app.get(
    "/api/partner/jobs",
    { ...partnerAuth, schema: { querystring: pagination } },
    (req) => listBookings(app, req.user, req.query, "jobs"),
  );
  app.post("/api/partner/leads/:id/accept", partnerAuth, (req) =>
    acceptLead(app, req.user, req.params.id),
  );
  app.post("/api/partner/leads/:id/decline", partnerAuth, async (req) => {
    const p = await one(app.db, "SELECT id FROM partners WHERE user_id=?", [
      req.user.id,
    ]);
    must(p, 403, "PARTNER_REQUIRED", "Register as a partner");
    const r = await rows(
      app.db,
      "UPDATE booking_recipients br JOIN bookings b ON b.id=br.booking_id SET br.status='declined' WHERE br.booking_id=? AND br.partner_id=? AND br.status='open' AND b.assigned_partner_id IS NULL",
      [req.params.id, p.id],
    );
    must(
      r.affectedRows,
      409,
      "LEAD_CLOSED",
      "This lead is no longer available",
    );
    return { ok: true };
  });
  app.patch(
    "/api/partner/jobs/:id",
    {
      ...partnerAuth,
      schema: {
        body: obj(
          {
            status: {
              type: "string",
              enum: [
                "Partner assigned",
                "Booking confirmed",
                "Service scheduled",
                "Service in progress",
                "Service completed",
              ],
            },
            remarks: str(1000, 0),
            uploadIds: ids,
          },
          ["status"],
        ),
      },
    },
    async (req) => {
      const transitions = {
        "Partner assigned": ["Booking confirmed"],
        "Booking confirmed": ["Service scheduled"],
        "Service scheduled": ["Service in progress"],
        "Service in progress": ["Service completed"],
      };
      await tx(app.db, async (c) => {
        const b = await one(c, "SELECT * FROM bookings WHERE id=? FOR UPDATE", [
          req.params.id,
        ]);
        const p = await one(
          c,
          "SELECT id,status FROM partners WHERE user_id=?",
          [req.user.id],
        );
        must(
          b && p?.status === "Approved" && b.assigned_partner_id === p.id,
          404,
          "NOT_FOUND",
          "Assigned job not found",
        );
        must(
          b.status === req.body.status ||
            transitions[b.status]?.includes(req.body.status),
          409,
          "STATUS_CONFLICT",
          "Advance the job one step at a time",
        );
        await rows(c, "UPDATE bookings SET status=?,remarks=? WHERE id=?", [
          req.body.status,
          req.body.remarks || "",
          b.id,
        ]);
        await attachUploads(
          c,
          "booking_uploads",
          b.id,
          req.user.id,
          req.body.uploadIds,
          ["completion"],
        );
        await rows(
          c,
          "INSERT INTO booking_events(booking_id,actor_id,status,notes) VALUES (?,?,?,?)",
          [b.id, req.user.id, req.body.status, req.body.remarks || ""],
        );
        await rows(
          c,
          "INSERT INTO notifications(user_id,title,message,type,payload) VALUES (?,?,?,?,?)",
          [
            b.user_id,
            "Your garden booking was updated",
            req.body.status,
            "booking",
            JSON.stringify({ bookingId: b.id }),
          ],
        );
      });
      return { ok: true };
    },
  );
}
