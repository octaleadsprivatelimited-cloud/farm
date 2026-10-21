import Redis from "ioredis";
export async function createRedis(c) {
  if (!c.REDIS_URL) return null;
  const redis = new Redis(c.REDIS_URL, {
    keyPrefix: `${c.REDIS_NAMESPACE}:${c.NODE_ENV}:${c.DB_NAME}:`,
    connectTimeout: 2000,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    lazyConnect: true,
    retryStrategy: (n) => Math.min(n * 250, 5000),
  });
  redis.on("error", () => {});
  await redis.connect();
  await redis.ping();
  return redis;
}
export async function cached(redis, key, seconds, loader) {
  if (!redis) return loader();
  const hit = await redis.get(key).catch(() => null);
  if (hit) return JSON.parse(hit);
  const lock = await redis
    .set(`${key}:lock`, "1", "EX", 5, "NX")
    .catch(() => null);
  if (!lock) {
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setTimeout(r, 25));
      const value = await redis.get(key).catch(() => null);
      if (value) return JSON.parse(value);
    }
  }
  try {
    const value = await loader();
    await redis
      .set(
        key,
        JSON.stringify(value),
        "EX",
        seconds + Math.floor(Math.random() * 5),
      )
      .catch(() => {});
    return value;
  } finally {
    if (lock) await redis.del(`${key}:lock`).catch(() => {});
  }
}
export async function invalidateCatalog(redis) {
  if (redis) await redis.incr("kn:catalog:version");
}
