import {
  randomBytes,
  scrypt as rawScrypt,
  timingSafeEqual,
  createHash,
  createHmac,
} from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(rawScrypt);
export const hash = (value) => createHash("sha256").update(value).digest("hex");
export const secretHash = (secret, value) =>
  createHmac("sha256", secret).update(value).digest("hex");
export const token = () => randomBytes(32).toString("hex");
export function equal(a, b) {
  const x = Buffer.from(String(a)),
    y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}
export async function passwordHash(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return `scrypt$${salt}$${key.toString("hex")}`;
}
export async function passwordMatches(password, stored) {
  const [algo, salt, key] = String(stored || "").split("$");
  if (algo !== "scrypt" || !salt || !key) {
    await scrypt(password, "invalid-user-salt", 64, {
      N: 32768,
      r: 8,
      p: 1,
      maxmem: 64 * 1024 * 1024,
    });
    return false;
  }
  const actual = await scrypt(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return equal(actual.toString("hex"), key);
}
export const publicUser = (u) =>
  u
    ? {
        id: String(u.id),
        name: u.name,
        email: u.email,
        phone: u.phone || u.contact_phone,
        contactPhone: u.contact_phone || u.phone || "",
        phoneVerified: Boolean(u.phone),
        city: u.city,
        role: u.role,
        status: u.status,
      }
    : null;
export function page(query = {}) {
  return {
    limit: Math.min(Math.max(Number(query.limit) || 25, 1), 100),
    cursor: /^\d{1,20}$/.test(query.cursor || "")
      ? query.cursor
      : "18446744073709551615",
  };
}
export const paged = (data, limit, map = (x) => x) => ({
  items: data.slice(0, limit).map(map),
  nextCursor: data.length > limit ? String(data[limit - 1].seq) : null,
});
export function parseJSON(x, fallback = null) {
  if (x === null || x === undefined) return fallback;
  if (typeof x === "object") return x;
  try {
    return JSON.parse(x);
  } catch {
    return fallback;
  }
}

export function canonicalJSON(value) {
  if (Array.isArray(value))
    return "[" + value.map(canonicalJSON).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map((k) => JSON.stringify(k) + ":" + canonicalJSON(value[k]))
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
