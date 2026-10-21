import { loadConfig } from "./config.js";
import { buildApp } from "./app.js";
import { startWorker } from "./worker.js";
const app = await buildApp({ config: loadConfig() });
await app.ready();
const stop = startWorker(app);
const keepalive = setInterval(() => {}, 60000);
async function close() {
  clearInterval(keepalive);
  await stop();
  await app.close();
}
process.on("SIGTERM", close);
process.on("SIGINT", close);
