import { rows, one } from "../db.js";
import { cached } from "../cache.js";
import { obj, str, integer } from "../schema.js";
import { must } from "../errors.js";
export const mapProduct = (p) => ({
  id: p.id,
  name: p.name,
  category: p.category,
  price: p.price_paise / 100,
  oldPrice: p.old_price_paise / 100,
  stock: p.stock,
  image: p.image,
  badge: p.badge,
  care: p.care,
  water: p.water,
  description: p.description,
  active:
    Boolean(p.active) && p.category_active !== 0 && p.category_active !== false,
});
export async function catalogProducts(
  app,
  { category = "", q = "", sort = "featured", limit = 100, page = 1 } = {},
) {
  const revision = app.redis ? await app.redis.get("kn:catalog:version") : 0;
  return cached(
    app.redis,
    `kn:catalog:${revision || 0}:${JSON.stringify({ category, q, sort, limit, page })}`,
    20,
    async () => {
      let where = "p.active=TRUE AND c.active=TRUE",
        params = [];
      if (category && category !== "All plants") {
        where += " AND c.name=?";
        params.push(category);
      }
      if (q) {
        where += " AND (p.name LIKE ? OR c.name LIKE ?)";
        const text = q.replace(/[\\%_]/g, "\\$&");
        params.push(`%${text}%`, `%${text}%`);
      }
      const order = {
        featured: "p.id ASC",
        "price-low": "p.price_paise ASC,p.id ASC",
        "price-high": "p.price_paise DESC,p.id ASC",
      }[sort];
      const data = await rows(
        app.db,
        `SELECT p.*,c.name AS category FROM products p JOIN categories c ON c.id=p.category_id WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`,
        [...params, limit + 1, (page - 1) * limit],
      );
      return {
        items: data.slice(0, limit).map(mapProduct),
        hasMore: data.length > limit,
        page,
      };
    },
  );
}
export async function catalogServices(app, includeInactive = false) {
  const revision = app.redis ? await app.redis.get("kn:catalog:version") : 0;
  return cached(
    app.redis,
    `kn:services:${revision || 0}:${includeInactive}`,
    30,
    async () => {
      const ss = await rows(
        app.db,
        "SELECT s.* FROM services s JOIN service_categories c ON c.name=s.category WHERE (?=TRUE OR (s.active=TRUE AND c.active=TRUE)) ORDER BY s.id LIMIT 100",
        [includeInactive],
      );
      const packages = await rows(
        app.db,
        "SELECT p.* FROM service_packages p JOIN services s ON s.id=p.service_id WHERE p.active=TRUE AND (?=TRUE OR s.active=TRUE) ORDER BY p.id LIMIT 500",
        [includeInactive],
      );
      return ss
        .map((s) => ({
          ...s,
          price: Math.min(
            ...packages
              .filter((p) => p.service_id === s.id)
              .map((p) => p.price_paise / 100),
          ),
          packages: packages
            .filter((p) => p.service_id === s.id)
            .map((p) => ({
              id: p.id,
              name: p.name,
              description: p.description,
              price: p.price_paise / 100,
            })),
        }))
        .filter((s) => s.packages.length);
    },
  );
}
export async function catalogRoutes(app) {
  app.get(
    "/api/products",
    {
      schema: {
        querystring: obj(
          {
            q: str(100, 0),
            category: str(100, 0),
            sort: {
              type: "string",
              enum: ["featured", "price-low", "price-high"],
              default: "featured",
            },
            limit: { ...integer(1, 100), default: 25 },
            page: { ...integer(1, 100), default: 1 },
          },
          [],
        ),
      },
    },
    async (req) => catalogProducts(app, req.query),
  );
  app.get("/api/products/:id", async (req) => {
    const p = await one(
      app.db,
      "SELECT p.*,c.name AS category FROM products p JOIN categories c ON c.id=p.category_id WHERE p.id=? AND p.active=TRUE AND c.active=TRUE",
      [req.params.id],
    );
    must(p, 404, "NOT_FOUND", "Product not found");
    return mapProduct(p);
  });
  app.get("/api/categories", async () => ({
    items: await cached(app.redis, "kn:categories", 20, () =>
      rows(
        app.db,
        "SELECT id,name,slug FROM categories WHERE active=TRUE ORDER BY name LIMIT 100",
      ),
    ),
  }));
  app.get("/api/service-categories", async () => ({
    items: await cached(app.redis, "kn:service-categories", 30, () =>
      rows(
        app.db,
        "SELECT name FROM service_categories WHERE active=TRUE ORDER BY name",
      ),
    ),
  }));
  app.get("/api/services", async () => ({ items: await catalogServices(app) }));
  app.get("/api/config", async () => ({
    paymentMode: app.config.PAYMENT_MODE,
    razorpayKeyId:
      app.config.PAYMENT_MODE === "razorpay"
        ? app.config.RAZORPAY_KEY_ID
        : null,
    smsEnabled: app.config.SMS_PROVIDER !== "disabled",
    uploadsEnabled:
      app.config.STORAGE_DRIVER === "s3" ||
      app.config.NODE_ENV !== "production",
  }));
  app.post(
    "/api/newsletter",
    {
      config: { rateLimit: { max: 5, timeWindow: "1 hour" } },
      schema: {
        body: obj({
          email: { type: "string", format: "email", maxLength: 254 },
        }),
      },
    },
    async (req) => {
      await rows(
        app.db,
        "INSERT IGNORE INTO newsletter_subscribers(email) VALUES (?)",
        [req.body.email.toLowerCase()],
      );
      return { ok: true };
    },
  );
}
