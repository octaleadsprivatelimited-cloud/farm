import { hash } from "./security.js";
import { rows, one } from "./db.js";
import { must } from "./errors.js";
export async function identifierLimit(
  app,
  scope,
  identifier,
  max,
  seconds = 900,
) {
  const bucket = hash(
    `${scope}:${identifier.toLowerCase()}:${Math.floor(Date.now() / (seconds * 1000))}`,
  );
  let count;
  if (app.redis)
    count = await app.redis.eval(
      "local n=redis.call('INCR',KEYS[1]);if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end;return n",
      1,
      `kn:auth-limit:${bucket}`,
      seconds + 1,
    );
  else {
    await rows(
      app.db,
      "INSERT INTO auth_rate_limits(bucket_hash,attempts,expires_at) VALUES (?,1,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL ? SECOND)) ON DUPLICATE KEY UPDATE attempts=attempts+1",
      [bucket, seconds + 1],
    );
    count = (
      await one(
        app.db,
        "SELECT attempts FROM auth_rate_limits WHERE bucket_hash=?",
        [bucket],
      )
    ).attempts;
  }
  must(
    Number(count) <= max,
    429,
    "AUTH_LIMIT",
    "Too many attempts. Please try again later.",
  );
}
