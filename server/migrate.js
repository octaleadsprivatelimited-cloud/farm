import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
export async function migrate(db) {
  const conn = await db.getConnection();
  try {
    const [[lock]] = await conn.query(
      "SELECT GET_LOCK('kaushik_migrations',30) AS acquired",
    );
    if (!lock.acquired) throw Error("Another migration is still running");
    await conn.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(160) PRIMARY KEY,checksum CHAR(64) NOT NULL,applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)) ENGINE=InnoDB",
    );
    const dir = fileURLToPath(
      new URL("../database/migrations/", import.meta.url),
    );
    for (const file of (await readdir(dir))
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      const sql = await readFile(`${dir}/${file}`, "utf8"),
        checksum = createHash("sha256").update(sql).digest("hex");
      const [[old]] = await conn.execute(
        "SELECT checksum FROM schema_migrations WHERE version=?",
        [file],
      );
      if (old) {
        if (old.checksum !== checksum)
          throw Error(`Applied migration changed: ${file}`);
        continue;
      }
      for (const statement of sql
        .split(/;\s*(?:\n|$)/)
        .map((s) => s.trim())
        .filter(Boolean))
        await conn.query(statement);
      await conn.execute(
        "INSERT INTO schema_migrations(version,checksum) VALUES (?,?)",
        [file, checksum],
      );
    }
  } finally {
    await conn
      .query("SELECT RELEASE_LOCK('kaushik_migrations')")
      .catch(() => {});
    conn.release();
  }
}
