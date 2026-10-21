// Run with distributed load generators against a dedicated, authorized staging cluster.
// Default 25 users. TARGET_VUS=100000 is explicit and must not run on a laptop.
import http from "k6/http";
import { check, sleep } from "k6";
const target = Number(__ENV.TARGET_VUS || 25),
  origin = __ENV.LOAD_BASE_URL;
if (!origin || __ENV.AUTHORIZED_LOAD_TEST !== "true")
  throw new Error(
    "Set LOAD_BASE_URL and AUTHORIZED_LOAD_TEST=true for your staging deployment",
  );
if (target > 1000 && !__ENV.DISTRIBUTED_RUN)
  throw new Error(
    "Large runs require DISTRIBUTED_RUN=true and distributed load generators",
  );
export const options = {
  scenarios: {
    browsing_sessions: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "5m", target: Math.ceil(target * 0.1) },
        { duration: "5m", target: Math.ceil(target * 0.5) },
        { duration: "10m", target },
        { duration: "20m", target },
        { duration: "5m", target: 0 },
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.001"],
    http_req_duration: ["p(95)<250", "p(99)<1000"],
  },
};
export default function () {
  const response = http.get(`${origin}/api/products?limit=25`, {
    tags: { operation: "public_catalog" },
  });
  check(response, {
    "catalog responds": (r) => r.status === 200,
    "bounded catalog": (r) =>
      Array.isArray(r.json("items")) && r.json("items").length <= 25,
  });
  // 100,000 active browsing sessions with 15–45 seconds of think time produce
  // approximately 3,333 iterations/second, not 100,000 requests/second.
  sleep(15 + Math.random() * 30);
}
