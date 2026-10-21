import { initialProducts, initialServices } from "../public/data.js";
import { rows, one, tx } from "./db.js";
export async function seedCatalog(db) {
  await tx(db, async (c) => {
    for (const name of [...new Set(initialProducts.map((p) => p.category))])
      await rows(c, "INSERT IGNORE INTO categories(name,slug) VALUES (?,?)", [
        name,
        name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      ]);
    for (const p of initialProducts) {
      const cat = await one(c, "SELECT id FROM categories WHERE name=?", [
        p.category,
      ]);
      await rows(
        c,
        "INSERT IGNORE INTO products(id,category_id,name,description,price_paise,old_price_paise,stock,image,badge,care,water) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        [
          p.id,
          cat.id,
          p.name,
          p.description,
          p.price * 100,
          (p.oldPrice || 0) * 100,
          p.stock,
          p.image,
          p.badge,
          p.care,
          p.water,
        ],
      );
    }
    for (const s of initialServices) {
      await rows(c, "INSERT IGNORE INTO service_categories(name) VALUES (?)", [
        s.category,
      ]);
      await rows(
        c,
        "INSERT IGNORE INTO services(id,category,name,description,image,label) VALUES (?,?,?,?,?,?)",
        [s.id, s.category, s.name, s.description, s.image, s.label],
      );
      for (let i = 0; i < s.packages.length; i++) {
        const p = s.packages[i];
        await rows(
          c,
          "INSERT IGNORE INTO service_packages(id,service_id,name,description,price_paise) VALUES (?,?,?,?,?)",
          [`${s.id}-pkg-${i}`, s.id, p.name, p.description, p.price * 100],
        );
      }
    }
    await rows(
      c,
      "INSERT IGNORE INTO settings(`key`,value_json) VALUES (?,?)",
      ["lead_distribution", JSON.stringify({ maxPartners: 6, rotation: true })],
    );
  });
}
