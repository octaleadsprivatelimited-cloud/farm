import { randomUUID } from "node:crypto";
import { rows, one, tx } from "./db.js";
import { must, fail } from "./errors.js";
import { hash, parseJSON, paged, page } from "./security.js";
import { queueRefund } from "./payments.js";
async function hydrateOrders(db, data) {
  if (!data.length) return [];
  const items = await rows(
    db,
    `SELECT order_id,product_id AS id,name,quantity AS qty,unit_price_paise FROM order_items WHERE order_id IN (${data.map(() => "?")}) ORDER BY product_id`,
    data.map((o) => o.id),
  );
  const byOrder = new Map();
  for (const item of items) {
    if (!byOrder.has(item.order_id)) byOrder.set(item.order_id, []);
    byOrder.get(item.order_id).push({
      id: item.id,
      name: item.name,
      qty: item.qty,
      price: item.unit_price_paise / 100,
    });
  }
  return data.map((order) => {
    const address = parseJSON(order.address_json, {});
    return {
      id: order.id,
      seq: order.seq,
      userId: String(order.user_id),
      name: address.name,
      phone: address.phone,
      address: [address.line, address.city, address.pincode].join(", "),
      addressDetails: address,
      items: byOrder.get(order.id) || [],
      subtotal: order.subtotal_paise / 100,
      delivery: order.delivery_paise / 100,
      total: order.total_paise / 100,
      status: order.status,
      payment: order.payment_status,
      created: new Date(order.created_at + "Z").getTime(),
      expiresAt: order.expires_at,
    };
  });
}
export async function getOrder(db, id, userId = null) {
  const order = await one(
    db,
    `SELECT * FROM orders WHERE id=?${userId ? " AND user_id=?" : ""}`,
    [id, ...(userId ? [userId] : [])],
  );
  must(order, 404, "NOT_FOUND", "Order not found");
  return (await hydrateOrders(db, [order]))[0];
}
export async function listOrders(db, userId, query = {}) {
  const p = page(query),
    data = await rows(
      db,
      `SELECT * FROM orders WHERE ${userId ? "user_id=? AND " : ""}seq<? ORDER BY seq DESC LIMIT ?`,
      [...(userId ? [userId] : []), p.cursor, p.limit + 1],
    );
  const result = paged(data, p.limit);
  result.items = await hydrateOrders(db, result.items);
  return result;
}
export async function createOrder(app, userId, body, key) {
  const lines = [...body.items].sort((a, b) => a.id.localeCompare(b.id));
  must(
    new Set(lines.map((l) => l.id)).size === lines.length,
    400,
    "DUPLICATE_ITEM",
    "Combine duplicate products into one line",
  );
  const requestHash = hash(
    JSON.stringify({ addressId: body.addressId, items: lines }),
  );
  let id;
  try {
    id = await tx(app.db, async (c) => {
      const existing = await one(
        c,
        "SELECT id,request_hash FROM orders WHERE user_id=? AND idempotency_key=?",
        [userId, key],
      );
      if (existing) {
        must(
          existing.request_hash === requestHash,
          409,
          "KEY_REUSED",
          "This idempotency key belongs to a different order",
        );
        return existing.id;
      }
      const address = await one(
        c,
        "SELECT * FROM addresses WHERE id=? AND user_id=?",
        [body.addressId, userId],
      );
      must(
        address,
        404,
        "ADDRESS_NOT_FOUND",
        "Choose a saved delivery address",
      );
      const ps = await rows(
        c,
        `SELECT p.*,(SELECT c.active FROM categories c WHERE c.id=p.category_id) AS category_active FROM products p WHERE id IN (${lines.map(() => "?").join(",")}) ORDER BY id FOR UPDATE`,
        lines.map((l) => l.id),
      );
      let subtotal = 0;
      for (const line of lines) {
        const p = ps.find((p) => p.id === line.id);
        must(
          p && p.active && p.category_active && p.stock >= line.qty,
          409,
          "OUT_OF_STOCK",
          "One or more products are unavailable",
        );
        subtotal += p.price_paise * line.qty;
      }
      must(
        subtotal <= 100000000,
        400,
        "ORDER_LIMIT",
        "Please contact the nursery for bulk orders",
      );
      const delivery = subtotal >= 100000 ? 0 : 9900,
        id = randomUUID();
      await rows(
        c,
        "INSERT INTO orders(id,user_id,idempotency_key,request_hash,subtotal_paise,delivery_paise,total_paise,address_json,expires_at) VALUES (?,?,?,?,?,?,?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 15 MINUTE))",
        [
          id,
          userId,
          key,
          requestHash,
          subtotal,
          delivery,
          subtotal + delivery,
          JSON.stringify(address),
        ],
      );
      for (const line of lines) {
        const p = ps.find((p) => p.id === line.id);
        await rows(c, "UPDATE products SET stock=stock-? WHERE id=?", [
          line.qty,
          line.id,
        ]);
        await rows(
          c,
          "INSERT INTO order_items(order_id,product_id,name,quantity,unit_price_paise) VALUES (?,?,?,?,?)",
          [id, p.id, p.name, line.qty, p.price_paise],
        );
        await rows(
          c,
          "INSERT INTO inventory_movements(product_id,order_id,delta,reason) VALUES (?,?,?,?)",
          [p.id, id, -line.qty, "reservation"],
        );
      }
      await rows(
        c,
        "INSERT INTO notifications(user_id,title,message,type) VALUES (?,?,?,?)",
        [
          userId,
          "Order reserved",
          "Your plants are reserved for 15 minutes while you complete payment.",
          "order",
        ],
      );
      return id;
    });
  } catch (e) {
    if (e.code !== "ER_DUP_ENTRY") throw e;
    const old = await one(
      app.db,
      "SELECT id,request_hash FROM orders WHERE user_id=? AND idempotency_key=?",
      [userId, key],
    );
    must(
      old && old.request_hash === requestHash,
      409,
      "KEY_REUSED",
      "This idempotency key is already used",
    );
    id = old.id;
  }
  return getOrder(app.db, id, userId);
}
export async function releaseInventory(c, order, reason) {
  if (order.inventory_released) return;
  const items = await rows(
    c,
    "SELECT product_id,quantity FROM order_items WHERE order_id=? ORDER BY product_id",
    [order.id],
  );
  for (const i of items) {
    await rows(c, "UPDATE products SET stock=stock+? WHERE id=?", [
      i.quantity,
      i.product_id,
    ]);
    await rows(
      c,
      "INSERT INTO inventory_movements(product_id,order_id,delta,reason) VALUES (?,?,?,?)",
      [i.product_id, order.id, i.quantity, reason],
    );
  }
  await rows(c, "UPDATE orders SET inventory_released=TRUE WHERE id=?", [
    order.id,
  ]);
}
export async function cancelOrder(app, id, user) {
  await tx(app.db, async (c) => {
    const o = await one(
      c,
      `SELECT * FROM orders WHERE id=?${user.role === "admin" ? "" : " AND user_id=?"} FOR UPDATE`,
      [id, ...(user.role === "admin" ? [] : [user.id])],
    );
    must(o, 404, "NOT_FOUND", "Order not found");
    if (o.status === "Cancelled" || o.status === "Expired") return;
    must(
      ["Awaiting payment", "Order placed", "Confirmed", "Processing"].includes(
        o.status,
      ),
      409,
      "STATUS_CONFLICT",
      "This order can no longer be cancelled",
    );
    await releaseInventory(c, o, "cancellation");
    await rows(c, "UPDATE orders SET status='Cancelled' WHERE id=?", [id]);
    if (o.payment_status === "captured") {
      const pay = await one(c, "SELECT * FROM payments WHERE order_id=?", [id]);
      await queueRefund(c, pay, "Order cancelled");
    }
  });
  return getOrder(app.db, id, user.role === "admin" ? null : user.id);
}
export async function expireOrders(app) {
  const due = await rows(
    app.db,
    "SELECT id FROM orders WHERE status='Awaiting payment' AND expires_at<UTC_TIMESTAMP(3) ORDER BY expires_at LIMIT 100",
  );
  for (const item of due)
    await tx(app.db, async (c) => {
      const o = await one(
        c,
        "SELECT *,expires_at<UTC_TIMESTAMP(3) AS expired FROM orders WHERE id=? FOR UPDATE",
        [item.id],
      );
      if (o.status !== "Awaiting payment" || !o.expired) return;
      await releaseInventory(c, o, "expired");
      await rows(c, "UPDATE orders SET status='Expired' WHERE id=?", [o.id]);
    });
}
