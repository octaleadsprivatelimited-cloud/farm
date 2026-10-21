import { loadConfig } from "./config.js";
import { createDatabase } from "./db.js";
import { migrate } from "./migrate.js";
import { seedCatalog } from "./seed.js";
import { buildApp } from "./app.js";
import { startWorker } from "./worker.js";
const config = loadConfig();
const db = await createDatabase(config);
if (config.MIGRATE_ON_START) await migrate(db);
if (config.SEED_CATALOG_ON_START) await seedCatalog(db);
const app = await buildApp({ config, db });
const stopWorker = config.RUN_WORKER ? startWorker(app) : null;
await app.listen({ port: config.PORT, host: config.HOST });
let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  const timer = setTimeout(() => process.exit(1), 25000).unref();
  try {
    await stopWorker?.();
    await app.close();
    await db.end();
    clearTimeout(timer);
  } catch {
    process.exitCode = 1;
  }
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
