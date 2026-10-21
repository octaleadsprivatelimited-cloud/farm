import { randomUUID } from "node:crypto";
import { rows, one, tx } from "./db.js";
import { must } from "./errors.js";
import { hash, canonicalJSON, parseJSON, page, paged } from "./security.js";
export async function hydrateBookings(db, data, viewer = { role: "admin" }) {
  if (!data.length) return [];
  const ids = data.map((b) => b.id),
    place = ids.map(() => "?").join(",");
  const recipients = await rows(
    db,
    `SELECT * FROM booking_recipients WHERE booking_id IN (${place})`,
    ids,
  );
  const uploads = await rows(
    db,
    `SELECT bu.booking_id,u.id,u.original_name,u.kind FROM booking_uploads bu JOIN uploads u ON u.id=bu.upload_id WHERE bu.booking_id IN (${place})`,
    ids,
  );
  return data.map((b) => {
    const rs = recipients.filter((r) => r.booking_id === b.id),
      visible =
        viewer.role !== "partner" || b.partner_user_id === String(viewer.id);
    return {
      id: b.id,
      seq: b.seq,
      userId: String(b.user_id),
      serviceId: b.service_id,
      serviceName: b.service_name,
      category: b.category,
      packageId: b.package_id,
      package: b.package_name,
      price: b.price_paise / 100,
      customer: visible ? b.customer : "Customer",
      phone: visible ? b.phone : "",
      city: b.city,
      address: visible ? b.address : b.city,
      property: b.property,
      area: b.area,
      date: b.preferred_date,
      time: b.preferred_time.slice(0, 5),
      description: b.description,
      status: b.status,
      assigned: b.assigned_partner_id,
      partnerName: b.partner_name,
      remarks: b.remarks,
      recipients: rs.map((r) => r.partner_id),
      declined: rs
        .filter((r) => r.status === "declined")
        .map((r) => r.partner_id),
      images: uploads
        .filter((u) => u.booking_id === b.id && u.kind === "reference")
        .map((u) => u.original_name),
      uploads: visible ? uploads.filter((u) => u.booking_id === b.id) : [],
      review: b.rating ? { rating: b.rating, text: b.feedback } : null,
      payment: b.payment_status,
      created: new Date(b.created_at + "Z").getTime(),
      sample: false,
    };
  });
}
const base =
  "SELECT b.*,s.name AS service_name,s.category,r.rating,r.feedback,p.user_id AS partner_user_id,p.name AS partner_name FROM bookings b JOIN services s ON s.id=b.service_id LEFT JOIN reviews r ON r.booking_id=b.id LEFT JOIN partners p ON p.id=b.assigned_partner_id";
export async function getBooking(db, id, viewer) {
  const b = await one(db, `${base} WHERE b.id=?`, [id]);
  must(b, 404, "NOT_FOUND", "Booking not found");
  const ownsBooking = String(b.user_id) === String(viewer.id);
  if (viewer.role === "customer")
    must(
      String(b.user_id) === String(viewer.id),
      404,
      "NOT_FOUND",
      "Booking not found",
    );
  if (viewer.role === "partner" && !ownsBooking) {
    const p = await one(
      db,
      "SELECT id,status,available FROM partners WHERE user_id=?",
      [viewer.id],
    );
    must(p, 403, "PARTNER_REQUIRED", "Register as a service partner");
    const rec = await one(
      db,
      "SELECT status FROM booking_recipients WHERE booking_id=? AND partner_id=?",
      [id, p.id],
    );
    must(
      b.assigned_partner_id === p.id ||
        (rec?.status === "open" &&
          !b.assigned_partner_id &&
          p.status === "Approved" &&
          p.available),
      404,
      "NOT_FOUND",
      "Booking not found",
    );
  }
  return (
    await hydrateBookings(
      db,
      [b],
      ownsBooking ? { ...viewer, role: "customer" } : viewer,
    )
  )[0];
}
export async function listBookings(app, user, query = {}, kind = "all") {
  const p = page(query),
    values = [];
  let where = "b.seq<?";
  if (user.role === "customer") {
    where += " AND b.user_id=?";
    values.push(user.id);
  }
  if (user.role === "partner") {
    const partner = await one(
      app.db,
      "SELECT id,status,available FROM partners WHERE user_id=?",
      [user.id],
    );
    if (!partner) return { items: [], nextCursor: null };
    if (kind === "leads") {
      if (partner.status !== "Approved" || !partner.available)
        return { items: [], nextCursor: null };
      where +=
        " AND b.assigned_partner_id IS NULL AND b.status='Finding service partner' AND EXISTS (SELECT 1 FROM booking_recipients br WHERE br.booking_id=b.id AND br.partner_id=? AND br.status='open')";
    } else where += " AND b.assigned_partner_id=?";
    values.push(partner.id);
  }
  const data = await rows(
    app.db,
    `${base} WHERE ${where} ORDER BY b.seq DESC LIMIT ?`,
    [p.cursor, ...values, p.limit + 1],
  );
  const result = paged(data, p.limit);
  result.items = await hydrateBookings(app.db, result.items, user);
  return result;
}
export async function attachUploads(
  c,
  table,
  resourceId,
  userId,
  uploadIds = [],
  kinds = ["reference"],
) {
  must(
    uploadIds.length <= 8,
    400,
    "UPLOAD_LIMIT",
    "Up to eight attachments are allowed",
  );
  for (const id of uploadIds) {
    const u = await one(
      c,
      "SELECT * FROM uploads WHERE id=? AND user_id=? AND status='ready'",
      [id, userId],
    );
    must(
      u && kinds.includes(u.kind),
      400,
      "UPLOAD_INVALID",
      "Choose a completed upload belonging to your account",
    );
    await rows(
      c,
      `INSERT IGNORE INTO ${table}(${table === "booking_uploads" ? "booking_id" : "partner_id"},upload_id) VALUES (?,?)`,
      [resourceId, id],
    );
  }
}
export async function createBooking(app, user, body, key) {
  const requestHash = hash(canonicalJSON(body));
  let id;
  const scheduled = new Date(`${body.date}T${body.time}:00+05:30`).getTime();
  must(
    scheduled > Date.now() && scheduled < Date.now() + 365 * 86400000,
    400,
    "INVALID_DATE",
    "Choose a future visit within the next year",
  );
  try {
    id = await tx(app.db, async (c) => {
      const old = await one(
        c,
        "SELECT id,request_hash FROM bookings WHERE user_id=? AND idempotency_key=?",
        [user.id, key],
      );
      if (old) {
        must(
          old.request_hash === requestHash,
          409,
          "KEY_REUSED",
          "This key belongs to another booking",
        );
        return old.id;
      }
      const p = await one(
        c,
        "SELECT p.*,s.name AS service_name,s.category FROM service_packages p JOIN services s ON s.id=p.service_id WHERE p.id=? AND p.service_id=? AND p.active=TRUE AND s.active=TRUE AND EXISTS (SELECT 1 FROM service_categories sc WHERE sc.name=s.category AND sc.active=TRUE)",
        [body.packageId, body.serviceId],
      );
      must(p, 404, "PACKAGE_NOT_FOUND", "This service package is unavailable");
      const settings = parseJSON(
        (
          await one(c, "SELECT value_json FROM settings WHERE `key`=?", [
            "lead_distribution",
          ])
        )?.value_json,
        { maxPartners: 6, rotation: true },
      );
      const partners = await rows(
        c,
        `SELECT p.id,p.user_id FROM partners p JOIN users u ON u.id=p.user_id JOIN partner_categories pc ON pc.partner_id=p.id WHERE p.status='Approved' AND p.available=TRUE AND p.city=? AND pc.category=? AND u.status='active' AND p.user_id<>? ORDER BY ${settings.rotation ? "p.received_count ASC," : ""}p.id ASC LIMIT ? FOR UPDATE`,
        [body.city, p.category, user.id, Number(settings.maxPartners)],
      );
      const id = randomUUID(),
        status = partners.length
          ? "Finding service partner"
          : "Request submitted";
      await rows(
        c,
        "INSERT INTO bookings(id,user_id,idempotency_key,request_hash,service_id,package_id,package_name,price_paise,customer,phone,city,address,property,area,preferred_date,preferred_time,description,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [
          id,
          user.id,
          key,
          requestHash,
          p.service_id,
          p.id,
          p.name,
          p.price_paise,
          body.name,
          body.phone,
          body.city,
          body.address,
          body.property,
          body.area,
          body.date,
          body.time,
          body.description,
          status,
        ],
      );
      await attachUploads(c, "booking_uploads", id, user.id, body.uploadIds);
      for (const partner of partners) {
        await rows(
          c,
          "INSERT INTO booking_recipients(booking_id,partner_id) VALUES (?,?)",
          [id, partner.id],
        );
        await rows(
          c,
          "UPDATE partners SET received_count=received_count+1 WHERE id=?",
          [partner.id],
        );
        await rows(
          c,
          "INSERT INTO notifications(user_id,title,message,type,payload) VALUES (?,?,?,?,?)",
          [
            partner.user_id,
            "New garden request",
            `${p.service_name} in ${body.city}`,
            "lead",
            JSON.stringify({ bookingId: id }),
          ],
        );
      }
      await rows(
        c,
        "INSERT INTO booking_events(booking_id,actor_id,status) VALUES (?,?,?)",
        [id, user.id, status],
      );
      await rows(
        c,
        "INSERT INTO notifications(user_id,title,message,type,payload) VALUES (?,?,?,?,?)",
        [
          user.id,
          "Service request received",
          "Follow your garden request in My service bookings.",
          "booking",
          JSON.stringify({ bookingId: id }),
        ],
      );
      return id;
    });
  } catch (e) {
    if (e.code !== "ER_DUP_ENTRY") throw e;
    const old = await one(
      app.db,
      "SELECT id,request_hash FROM bookings WHERE user_id=? AND idempotency_key=?",
      [user.id, key],
    );
    must(
      old && old.request_hash === requestHash,
      409,
      "KEY_REUSED",
      "This key has already been used",
    );
    id = old.id;
  }
  return getBooking(app.db, id, user);
}
export async function acceptLead(app, user, id) {
  await tx(app.db, async (c) => {
    const b = await one(c, "SELECT * FROM bookings WHERE id=? FOR UPDATE", [
      id,
    ]);
    must(b, 404, "NOT_FOUND", "Booking not found");
    const p = await one(
      c,
      "SELECT * FROM partners WHERE user_id=? FOR UPDATE",
      [user.id],
    );
    must(
      p?.status === "Approved" && p.available,
      403,
      "PARTNER_UNAVAILABLE",
      "Your partner account must be approved and available",
    );
    must(
      p.city === b.city &&
        (await one(
          c,
          "SELECT pc.partner_id FROM partner_categories pc JOIN services s ON s.category=pc.category WHERE pc.partner_id=? AND s.id=?",
          [p.id, b.service_id],
        )),
      403,
      "PARTNER_INELIGIBLE",
      "Your current city and service category must match this request",
    );
    const rec = await one(
      c,
      "SELECT status FROM booking_recipients WHERE booking_id=? AND partner_id=?",
      [id, p.id],
    );
    if (b.assigned_partner_id === p.id) return;
    must(
      !b.assigned_partner_id &&
        b.status === "Finding service partner" &&
        rec?.status === "open",
      409,
      "LEAD_CLOSED",
      "Another professional has already received this assignment",
    );
    await rows(
      c,
      "UPDATE bookings SET assigned_partner_id=?,status='Partner assigned' WHERE id=?",
      [p.id, id],
    );
    await rows(
      c,
      "UPDATE booking_recipients SET status=IF(partner_id=?,'accepted','closed') WHERE booking_id=?",
      [p.id, id],
    );
    await rows(
      c,
      "INSERT INTO booking_events(booking_id,actor_id,status) VALUES (?,?,?)",
      [id, user.id, "Partner assigned"],
    );
    await rows(
      c,
      "INSERT INTO notifications(user_id,title,message,type,payload) VALUES (?,?,?,?,?)",
      [
        b.user_id,
        "A professional is assigned",
        `${p.name} will take care of your garden request.`,
        "booking",
        JSON.stringify({ bookingId: id }),
      ],
    );
  });
  return getBooking(app.db, id, user);
}
