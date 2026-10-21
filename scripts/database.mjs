import { loadConfig } from "../server/config.js";
import { createDatabase } from "../server/db.js";
import { migrate } from "../server/migrate.js";
import { seedCatalog } from "../server/seed.js";
const db = await createDatabase(loadConfig());
try {
  if (process.argv[2] === "seed") await seedCatalog(db);
  else await migrate(db);
  console.log("Database operation completed");
} finally {
  await db.end();
}
