import { rows, one, tx } from "../db.js";
import { requireAuth } from "../auth.js";
import {
  obj,
  str,
  integer,
  bool,
  phone,
  addressBody,
  pagination,
} from "../schema.js";
import { publicUser, paged, page } from "../security.js";
import { must } from "../errors.js";
import { randomUUID } from "node:crypto";
import { mapProduct } from "./catalog.js";
export async function accountSnapshot(app, user) {
  const [addresses, cart, favorites, cartProducts] = await Promise.all([
    rows(
      app.db,
      "SELECT id,tag,name,phone,line,city,pincode,is_default AS isDefault FROM addresses WHERE user_id=? ORDER BY is_default DESC,id",
      [user.id],
    ),
    rows(
      app.db,
      "SELECT product_id AS id,quantity AS qty FROM cart_items WHERE user_id=? ORDER BY product_id",
      [user.id],
    ),
    rows(
      app.db,
      "SELECT product_id AS id FROM wishlist WHERE user_id=? ORDER BY product_id",
      [user.id],
    ),
    rows(
      app.db,
      "SELECT p.*,c.name AS category,c.active AS category_active FROM cart_items ci JOIN products p ON p.id=ci.product_id JOIN categories c ON c.id=p.category_id WHERE ci.user_id=? ORDER BY p.id",
      [user.id],
    ),
  ]);
  return {
    user: {
      ...user,
      addresses: addresses.map((a) => ({
        ...a,
        isDefault: Boolean(a.isDefault),
      })),
    },
    cart,
    favorites: favorites.map((p) => p.id),
    cartProducts: cartProducts.map(mapProduct),
  };
}
export async function accountRoutes(app) {
  const auth = { preHandler: requireAuth };
  app.get("/api/account", auth, (req) => accountSnapshot(app, req.user));
  app.get(
    "/api/wishlist/products",
    {
      ...auth,
      schema: {
        querystring: obj(
          {
            limit: { ...integer(1, 100), default: 25 },
            page: { ...integer(1, 100), default: 1 },
            q: str(100, 0),
            category: str(100, 0),
            sort: {
              type: "string",
              enum: ["featured", "price-low", "price-high"],
            },
          },
          [],
        ),
      },
    },
    async (req) => {
      const limit = req.query.limit || 25;
      const order = {
        featured: "p.id",
        "price-low": "p.price_paise,p.id",
        "price-high": "p.price_paise DESC,p.id",
      }[req.query.sort || "featured"];
      let where = "w.user_id=?",
        params = [req.user.id];
      if (req.query.category && req.query.category !== "All plants") {
        where += " AND c.name=?";
        params.push(req.query.category);
      }
      if (req.query.q) {
        where += " AND (p.name LIKE ? OR c.name LIKE ?)";
        const text = "%" + req.query.q.replace(/[\\%_]/g, "\\$&") + "%";
        params.push(text, text);
      }
      const data = await rows(
        app.db,
        `SELECT p.*,c.name AS category,c.active AS category_active FROM wishlist w JOIN products p ON p.id=w.product_id JOIN categories c ON c.id=p.category_id WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`,
        [...params, limit + 1, ((req.query.page || 1) - 1) * limit],
      );
      return {
        items: data.slice(0, limit).map(mapProduct),
        hasMore: data.length > limit,
      };
    },
  );
  app.patch(
    "/api/account",
    {
      ...auth,
      schema: {
        body: obj(
          {
            name: str(100),
            city: str(100, 0),
            contactPhone: { anyOf: [phone, { type: "string", maxLength: 0 }] },
          },
          ["name"],
        ),
      },
    },
    async (req) => {
      await rows(
        app.db,
        "UPDATE users SET name=?,city=?,contact_phone=IF(?,?,contact_phone) WHERE id=?",
        [
          req.body.name,
          req.body.city || "",
          req.body.contactPhone !== undefined,
          req.body.contactPhone || null,
          req.user.id,
        ],
      );
      await app.invalidateUserSessions(req.user.id);
      return {
        user: publicUser(
          await one(app.db, "SELECT * FROM users WHERE id=?", [req.user.id]),
        ),
      };
    },
  );
  app.get("/api/addresses", auth, async (req) => ({
    items: (await accountSnapshot(app, req.user)).user.addresses,
  }));
  async function saveAddress(req, reply) {
    const b = req.body,
      id = req.params.id || randomUUID();
    await tx(app.db, async (c) => {
      await one(c, "SELECT id FROM users WHERE id=? FOR UPDATE", [req.user.id]);
      const all = await rows(c, "SELECT id FROM addresses WHERE user_id=?", [
        req.user.id,
      ]);
      must(
        all.length < 20 || req.params.id,
        409,
        "ADDRESS_LIMIT",
        "You can save up to 20 addresses",
      );
      if (req.params.id)
        must(
          all.some((a) => a.id === id),
          404,
          "NOT_FOUND",
          "Address not found",
        );
      const isDefault = b.isDefault || all.length === 0;
      if (isDefault)
        await rows(c, "UPDATE addresses SET is_default=FALSE WHERE user_id=?", [
          req.user.id,
        ]);
      if (req.params.id)
        await rows(
          c,
          "UPDATE addresses SET tag=?,name=?,phone=?,line=?,city=?,pincode=?,is_default=? WHERE id=? AND user_id=?",
          [
            b.tag,
            b.name,
            b.phone,
            b.line,
            b.city,
            b.pincode,
            isDefault,
            id,
            req.user.id,
          ],
        );
      else
        await rows(
          c,
          "INSERT INTO addresses(id,user_id,tag,name,phone,line,city,pincode,is_default) VALUES (?,?,?,?,?,?,?,?,?)",
          [
            id,
            req.user.id,
            b.tag,
            b.name,
            b.phone,
            b.line,
            b.city,
            b.pincode,
            isDefault,
          ],
        );
      if (
        !(await one(
          c,
          "SELECT id FROM addresses WHERE user_id=? AND is_default=TRUE",
          [req.user.id],
        ))
      )
        await rows(
          c,
          "UPDATE addresses SET is_default=TRUE WHERE user_id=? ORDER BY id LIMIT 1",
          [req.user.id],
        );
    });
    reply.code(req.params.id ? 200 : 201);
    return { id };
  }
  app.post(
    "/api/addresses",
    { ...auth, schema: { body: addressBody } },
    saveAddress,
  );
  app.put(
    "/api/addresses/:id",
    { ...auth, schema: { body: addressBody } },
    saveAddress,
  );
  app.delete("/api/addresses/:id", auth, async (req) => {
    await tx(app.db, async (c) => {
      await one(c, "SELECT id FROM users WHERE id=? FOR UPDATE", [req.user.id]);
      const a = await one(
        c,
        "SELECT * FROM addresses WHERE id=? AND user_id=?",
        [req.params.id, req.user.id],
      );
      must(a, 404, "NOT_FOUND", "Address not found");
      await rows(c, "DELETE FROM addresses WHERE id=? AND user_id=?", [
        req.params.id,
        req.user.id,
      ]);
      if (a.is_default)
        await rows(
          c,
          "UPDATE addresses SET is_default=TRUE WHERE user_id=? ORDER BY id LIMIT 1",
          [req.user.id],
        );
    });
    return { ok: true };
  });
  app.patch("/api/addresses/:id/default", auth, async (req) => {
    await tx(app.db, async (c) => {
      await one(c, "SELECT id FROM users WHERE id=? FOR UPDATE", [req.user.id]);
      must(
        await one(c, "SELECT id FROM addresses WHERE id=? AND user_id=?", [
          req.params.id,
          req.user.id,
        ]),
        404,
        "NOT_FOUND",
        "Address not found",
      );
      await rows(c, "UPDATE addresses SET is_default=FALSE WHERE user_id=?", [
        req.user.id,
      ]);
      await rows(c, "UPDATE addresses SET is_default=TRUE WHERE id=?", [
        req.params.id,
      ]);
    });
    return { ok: true };
  });
  app.put(
    "/api/cart/:id",
    { ...auth, schema: { body: obj({ quantity: integer(0, 99) }) } },
    async (req) => {
      await tx(app.db, async (c) => {
        await one(c, "SELECT id FROM users WHERE id=? FOR UPDATE", [
          req.user.id,
        ]);
        if (req.body.quantity === 0) {
          await rows(
            c,
            "DELETE FROM cart_items WHERE user_id=? AND product_id=?",
            [req.user.id, req.params.id],
          );
          return;
        }
        const p = await one(c, "SELECT stock,active FROM products WHERE id=?", [
          req.params.id,
        ]);
        must(p && p.active, 404, "NOT_FOUND", "Product not found");
        must(
          req.body.quantity <= p.stock,
          409,
          "OUT_OF_STOCK",
          "The requested quantity is unavailable",
        );
        if (!req.body.quantity)
          await rows(
            c,
            "DELETE FROM cart_items WHERE user_id=? AND product_id=?",
            [req.user.id, req.params.id],
          );
        else {
          const count = await one(
            c,
            "SELECT COUNT(*) AS n FROM cart_items WHERE user_id=?",
            [req.user.id],
          );
          const existing = await one(
            c,
            "SELECT product_id FROM cart_items WHERE user_id=? AND product_id=?",
            [req.user.id, req.params.id],
          );
          must(
            existing || Number(count.n) < 50,
            409,
            "CART_LIMIT",
            "A bag can contain up to 50 different products",
          );
          await rows(
            c,
            "INSERT INTO cart_items(user_id,product_id,quantity) VALUES (?,?,?) ON DUPLICATE KEY UPDATE quantity=VALUES(quantity)",
            [req.user.id, req.params.id, req.body.quantity],
          );
        }
      });
      return { ok: true };
    },
  );
  app.put(
    "/api/wishlist/:id",
    { ...auth, schema: { body: obj({ saved: bool }) } },
    async (req) => {
      must(
        await one(app.db, "SELECT id FROM products WHERE id=?", [
          req.params.id,
        ]),
        404,
        "NOT_FOUND",
        "Product not found",
      );
      if (req.body.saved) {
        await tx(app.db, async (c) => {
          await one(c, "SELECT id FROM users WHERE id=? FOR UPDATE", [
            req.user.id,
          ]);
          if (
            await one(
              c,
              "SELECT product_id FROM wishlist WHERE user_id=? AND product_id=?",
              [req.user.id, req.params.id],
            )
          )
            return;
          const n = await one(
            c,
            "SELECT COUNT(*) AS n FROM wishlist WHERE user_id=?",
            [req.user.id],
          );
          must(
            Number(n.n) < 500,
            409,
            "WISHLIST_LIMIT",
            "Wishlist limit reached",
          );
          await rows(
            c,
            "INSERT INTO wishlist(user_id,product_id) VALUES (?,?)",
            [req.user.id, req.params.id],
          );
        });
      } else
        await rows(
          app.db,
          "DELETE FROM wishlist WHERE user_id=? AND product_id=?",
          [req.user.id, req.params.id],
        );
      return { ok: true };
    },
  );
  app.get(
    "/api/notifications",
    { ...auth, schema: { querystring: pagination } },
    async (req) => {
      const p = page(req.query);
      const ns = await rows(
        app.db,
        "SELECT * FROM notifications WHERE user_id=? AND seq<? ORDER BY seq DESC LIMIT ?",
        [req.user.id, p.cursor, p.limit + 1],
      );
      const unread = await one(
        app.db,
        "SELECT COUNT(*) AS n FROM notifications WHERE user_id=? AND read_at IS NULL",
        [req.user.id],
      );
      return { ...paged(ns, p.limit), unreadCount: Number(unread.n) };
    },
  );
  app.patch("/api/notifications/:id/read", auth, async (req) => {
    const r = await rows(
      app.db,
      "UPDATE notifications SET read_at=UTC_TIMESTAMP(3) WHERE seq=? AND user_id=?",
      [req.params.id, req.user.id],
    );
    must(r.affectedRows, 404, "NOT_FOUND", "Notification not found");
    return { ok: true };
  });
}
