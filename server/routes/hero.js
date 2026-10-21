import { rows, one, tx } from "../db.js";
import { requireRole } from "../auth.js";
import { obj, str, integer, bool } from "../schema.js";
import { parseJSON } from "../security.js";
import { cached } from "../cache.js";
import { must } from "../errors.js";
import { validateCatalogImage } from "./portal.js";

const defaults = {
  revision: 0,
  autoplay: true,
  intervalSeconds: 6,
  slides: [
    {
      id: "nursery-garden",
      image: "garden-hero.png",
      mobileImage: "",
      alt: "Sunlit nursery garden with lush greenery and terracotta pots",
      link: "#services",
      active: true,
    },
  ],
};
export async function heroContent(app, includeHidden = false) {
  const content = await cached(app.redis, "kn:hero", 20, async () => {
    const record = await one(
      app.db,
      "SELECT value_json FROM settings WHERE `key`='homepage_hero'",
    );
    return parseJSON(record?.value_json, defaults);
  });
  return {
    ...content,
    slides: content.slides.filter((s) => includeHidden || s.active),
  };
}
export async function heroRoutes(app) {
  const admin = { preHandler: requireRole("admin") };
  app.get("/api/hero", async () => heroContent(app));
  app.get("/api/admin/hero", admin, async () => heroContent(app, true));
  app.put(
    "/api/admin/hero",
    {
      ...admin,
      schema: {
        body: obj({
          revision: integer(0, 2147483647),
          autoplay: bool,
          intervalSeconds: integer(4, 20),
          slides: {
            type: "array",
            minItems: 1,
            maxItems: 8,
            items: obj({
              id: { type: "string", pattern: "^[a-zA-Z0-9-]{1,64}$" },
              image: str(200),
              mobileImage: str(200, 0),
              alt: str(200),
              link: {
                type: "string",
                enum: ["#home", "#shop", "#services", "#partner"],
              },
              active: bool,
            }),
          },
        }),
      },
    },
    async (req) => {
      const body = req.body;
      must(
        body.slides.some((s) => s.active),
        400,
        "HERO_EMPTY",
        "Keep at least one banner visible",
      );
      must(
        new Set(body.slides.map((s) => s.id)).size === body.slides.length,
        400,
        "DUPLICATE_BANNER",
        "Banner IDs must be unique",
      );
      for (const s of body.slides) {
        await validateCatalogImage(app, s.image);
        if (s.mobileImage) await validateCatalogImage(app, s.mobileImage);
      }
      const revision = await tx(app.db, async (c) => {
        await rows(
          c,
          "INSERT IGNORE INTO settings(`key`,value_json) VALUES ('homepage_hero',?)",
          [JSON.stringify(defaults)],
        );
        const current = await one(
          c,
          "SELECT value_json FROM settings WHERE `key`='homepage_hero' FOR UPDATE",
        );
        const previous = parseJSON(current.value_json, defaults);
        must(
          previous.revision === body.revision,
          409,
          "HERO_CHANGED",
          "Banners changed in another session. Reload this page before saving.",
        );
        const next = { ...body, revision: previous.revision + 1 };
        await rows(
          c,
          "UPDATE settings SET value_json=? WHERE `key`='homepage_hero'",
          [JSON.stringify(next)],
        );
        await rows(
          c,
          "INSERT INTO audit_logs(actor_id,action,resource_type,resource_id,details) VALUES (?,?,?,?,?)",
          [
            req.user.id,
            "hero.update",
            "settings",
            "homepage_hero",
            JSON.stringify({
              revision: next.revision,
              bannerIds: body.slides.map((s) => s.id),
            }),
          ],
        );
        return next.revision;
      });
      if (app.redis) await app.redis.del("kn:hero");
      return { ok: true, revision };
    },
  );
}
