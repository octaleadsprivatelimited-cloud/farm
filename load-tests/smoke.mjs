// A bounded local HTTP smoke test. This is not a 100,000-user capacity certificate.
import { mkdir, writeFile } from "node:fs/promises";
const base = process.env.LOAD_BASE_URL || "http://127.0.0.1:4173";
if (
  !["127.0.0.1", "localhost", "::1"].includes(new URL(base).hostname) &&
  process.env.AUTHORIZED_LOAD_TEST !== "true"
)
  throw Error(
    "Set AUTHORIZED_LOAD_TEST=true only for an authorized test deployment",
  );
const concurrency = Math.min(Number(process.env.LOAD_CONCURRENCY) || 20, 50),
  total = Math.min(Number(process.env.LOAD_REQUESTS) || 200, 500);
let next = 0,
  errors = 0;
const latency = [];
const started = performance.now();
await Promise.all(
  Array.from({ length: concurrency }, async () => {
    while (next < total) {
      const index = next++,
        t = performance.now();
      try {
        const r = await fetch(`${base}/api/products?limit=25`, {
          signal: AbortSignal.timeout(10000),
        });
        const body = await r.json();
        if (r.status !== 200 || !Array.isArray(body.items)) errors++;
      } catch {
        errors++;
      }
      latency.push(performance.now() - t);
    }
  }),
);
latency.sort((a, b) => a - b);
const elapsed = performance.now() - started;
const report = {
  timestamp: new Date().toISOString(),
  target: base,
  requests: total,
  concurrency,
  errors,
  elapsedMs: Math.round(elapsed),
  requestsPerSecond: Math.round((total / elapsed) * 1000),
  p50Ms: Math.round(latency[Math.floor(total * 0.5)]),
  p95Ms: Math.round(latency[Math.floor(total * 0.95)]),
  p99Ms: Math.round(latency[Math.floor(total * 0.99)]),
  scope: "Local bounded read-only smoke test; no production capacity claim",
};
await mkdir("load-tests/results", { recursive: true });
await writeFile(
  "load-tests/results/smoke.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
if (errors) process.exitCode = 1;
