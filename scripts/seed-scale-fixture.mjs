import { loadConfig } from "../server/config.js";
import { createDatabase, rows, one } from "../server/db.js";
import { passwordHash } from "../server/security.js";
import { randomBytes } from "node:crypto";
const c = loadConfig();
if (
  c.DB_NAME !== "kaushik_test" ||
  !["127.0.0.1", "localhost"].includes(c.DB_HOST)
)
  throw Error(
    "Scale fixtures are restricted to the local kaushik_test database",
  );
const db = await createDatabase(c);
try {
  const password = await passwordHash(randomBytes(32).toString("hex"));
  for (let start = 0; start < 100000; start += 1000) {
    const params = [];
    for (let n = start; n < start + 1000; n++)
      params.push(
        `Scale fixture ${n}`,
        `scale-fixture-${n}@example.test`,
        password,
      );
    await rows(
      db,
      `INSERT IGNORE INTO users(name,email,password_hash) VALUES ${Array.from({ length: 1000 }, () => "(?,?,?)").join(",")}`,
      params,
    );
  }
  const count = await one(
    db,
    "SELECT COUNT(*) AS n FROM users WHERE email LIKE 'scale-fixture-%@example.test'",
  );
  const plan = await rows(
    db,
    "EXPLAIN SELECT id,name FROM users WHERE id<? ORDER BY id DESC LIMIT 25",
    ["18446744073709551615"],
  );
  console.log(
    JSON.stringify(
      {
        syntheticCustomerRows: Number(count.n),
        paginationPlan: plan,
        scope:
          "Database row/index sanity check only. This does not demonstrate 100,000 simultaneous users.",
      },
      null,
      2,
    ),
  );
} finally {
  await db.end();
}
