import mysql from "mysql2/promise";
import { readFile } from "node:fs/promises";
export async function createDatabase(c) {
  const ssl = c.DB_SSL_CA
    ? { ca: await readFile(c.DB_SSL_CA), rejectUnauthorized: true }
    : undefined;
  const pool = mysql.createPool({
    host: c.DB_HOST,
    port: c.DB_PORT,
    user: c.DB_USER,
    password: c.DB_PASSWORD,
    database: c.DB_NAME,
    connectionLimit: c.DB_POOL_SIZE,
    queueLimit: c.DB_QUEUE_LIMIT,
    waitForConnections: true,
    connectTimeout: 5000,
    enableKeepAlive: true,
    timezone: "Z",
    dateStrings: true,
    decimalNumbers: true,
    supportBigNumbers: true,
    bigNumberStrings: true,
    multipleStatements: false,
    charset: "utf8mb4",
    ssl,
    maxPreparedStatements: 256,
  });
  pool.on("connection", (connection) =>
    connection.query(
      "SET SESSION innodb_lock_wait_timeout=5, max_execution_time=5000",
      (error) => {
        if (error) connection.destroy();
      },
    ),
  );
  await pool.query("SELECT 1");
  return pool;
}
export async function rows(db, sql, params = []) {
  const [r] = await db.execute(sql, params);
  return r;
}
export async function one(db, sql, params = []) {
  return (await rows(db, sql, params))[0] || null;
}
export async function tx(db, fn, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    const c = await db.getConnection();
    try {
      await c.query("SET time_zone = '+00:00'");
      await c.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
      await c.beginTransaction();
      const result = await fn(c);
      await c.commit();
      return result;
    } catch (e) {
      await c.rollback();
      if (
        !["ER_LOCK_DEADLOCK", "ER_LOCK_WAIT_TIMEOUT"].includes(e.code) ||
        i === attempts - 1
      )
        throw e;
    } finally {
      c.release();
    }
  }
}
