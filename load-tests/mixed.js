// Run only against an isolated, explicitly authorized synthetic staging environment.
// Fixtures: [{token,addressId,productId,serviceId,packageId,city}] one account per VU.
// Tokens are secrets: keep this file outside source and destroy it after the test.
import http from "k6/http";
import { check, sleep } from "k6";
import exec from "k6/execution";
import { SharedArray } from "k6/data";
if (
  __ENV.AUTHORIZED_LOAD_TEST !== "true" ||
  !__ENV.LOAD_BASE_URL ||
  !__ENV.SESSIONS_FILE
)
  throw Error(
    "Explicit staging authorization, target and synthetic sessions are required",
  );
const base = __ENV.LOAD_BASE_URL.replace(/\/$/, ""),
  users = new SharedArray("synthetic-sessions", () =>
    JSON.parse(open(__ENV.SESSIONS_FILE)),
  ),
  vus = Number(__ENV.TARGET_VUS || 10);
if (!Number.isInteger(vus) || vus < 1 || vus > 100000 || users.length < vus)
  throw Error("Provide a distinct synthetic session for each target VU");
if (vus > 1000 && __ENV.DISTRIBUTED_RUN !== "true")
  throw Error("Large runs require an explicitly distributed execution plan");
export const options = {
  scenarios: {
    mixed: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "5m", target: Math.ceil(vus / 10) },
        { duration: "5m", target: Math.ceil(vus / 2) },
        { duration: "10m", target: vus },
        { duration: "20m", target: vus },
        { duration: "5m", target: 0 },
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    checks: ["rate>0.999"],
    http_req_duration: ["p(95)<500", "p(99)<1500"],
  },
};
export default function () {
  const u = users[(exec.vu.idInTest - 1) % users.length],
    headers = {
      Authorization: `Bearer ${u.token}`,
      "Content-Type": "application/json",
    },
    n = Math.random();
  let res;
  if (n < 0.65) res = http.get(`${base}/api/products?limit=25`);
  else if (n < 0.9)
    res = http.get(`${base}/api/${n < 0.8 ? "account" : "orders?limit=25"}`, {
      headers,
    });
  else if (n < 0.97)
    res = http.put(
      `${base}/api/cart/${u.productId}`,
      JSON.stringify({ quantity: 1 }),
      { headers },
    );
  else if (n < 0.99) {
    res = http.post(
      `${base}/api/orders`,
      JSON.stringify({
        addressId: u.addressId,
        items: [{ id: u.productId, qty: 1 }],
      }),
      {
        headers: {
          ...headers,
          "Idempotency-Key": `load-order-${exec.vu.idInTest}-${exec.scenario.iterationInTest}`,
        },
      },
    );
    if (res.status === 201) {
      const id = res.json("id");
      check(http.post(`${base}/api/orders/${id}/cancel`, null, { headers }), {
        "cleanup cancellation succeeds": (r) => r.status === 200,
      });
    }
  } else {
    const date = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    res = http.post(
      `${base}/api/bookings`,
      JSON.stringify({
        serviceId: u.serviceId,
        packageId: u.packageId,
        name: "Synthetic customer",
        phone: "9999999999",
        city: u.city || "Hyderabad",
        address: "Synthetic staging address",
        property: "Apartment",
        area: 100,
        date,
        time: "12:00",
        description: "Synthetic capacity workload",
      }),
      {
        headers: {
          ...headers,
          "Idempotency-Key": `load-booking-${exec.vu.idInTest}-${exec.scenario.iterationInTest}`,
        },
      },
    );
    if (res.status === 201)
      check(
        http.post(`${base}/api/bookings/${res.json("id")}/cancel`, null, {
          headers,
        }),
        { "booking cleanup succeeds": (r) => r.status === 200 },
      );
  }
  check(res, { "request succeeds": (r) => r.status >= 200 && r.status < 300 });
  sleep(15 + Math.random() * 30);
}
