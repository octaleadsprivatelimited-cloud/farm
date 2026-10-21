import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { GoogleAuth } from "google-auth-library";
import { rows, one, tx } from "./db.js";
import { requireAuth } from "./auth.js";
import { obj, str } from "./schema.js";
import { hash } from "./security.js";
import { must } from "./errors.js";
function cryptKey(config) {
  return createHash("sha256")
    .update(`nursery-device-token:${config.SESSION_SECRET}`)
    .digest();
}
function encrypt(config, value) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", cryptKey(config), iv);
  return Buffer.concat([
    iv,
    cipher.update(value, "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]).toString("base64");
}
function decrypt(config, value) {
  const data = Buffer.from(value, "base64"),
    decipher = createDecipheriv(
      "aes-256-gcm",
      cryptKey(config),
      data.subarray(0, 12),
    );
  decipher.setAuthTag(data.subarray(-16));
  return Buffer.concat([
    decipher.update(data.subarray(12, -16)),
    decipher.final(),
  ]).toString("utf8");
}
export function pushSender(config) {
  if (config.PUSH_PROVIDER !== "fcm") return null;
  const auth = new GoogleAuth({
    keyFile: config.FCM_SERVICE_ACCOUNT_FILE,
    scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
  });
  return async (token, notification) => {
    const accessToken = await auth.getAccessToken();
    const result = await fetch(
      `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(config.FCM_PROJECT_ID)}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token,
            notification: {
              title: notification.title,
              body: notification.message,
            },
            data: {
              notificationId: String(notification.seq),
              type: notification.type,
            },
            android: { priority: "normal", ttl: "86400s" },
          },
        }),
        signal: AbortSignal.timeout(10000),
      },
    );
    const body = await result.json();
    if (!result.ok) {
      const e = Error("Push delivery failed");
      e.code =
        body.error?.details?.find((d) => d.errorCode)?.errorCode ||
        `FCM_${result.status}`;
      e.permanent = ["UNREGISTERED", "SENDER_ID_MISMATCH"].includes(e.code);
      throw e;
    }
    return body.name;
  };
}
export async function pushRoutes(app) {
  app.post(
    "/api/devices",
    {
      preHandler: requireAuth,
      schema: {
        body: obj({
          token: str(4096, 20),
          platform: { type: "string", enum: ["android", "web"] },
        }),
      },
    },
    async (req) => {
      must(
        app.push,
        503,
        "PUSH_DISABLED",
        "Push notifications are not configured",
      );
      const id = randomUUID(),
        tokenHash = hash(req.body.token);
      await tx(app.db, async (c) => {
        await one(c, "SELECT id FROM users WHERE id=? FOR UPDATE", [
          req.user.id,
        ]);
        const count = await one(
          c,
          "SELECT COUNT(*) AS n FROM devices WHERE user_id=?",
          [req.user.id],
        );
        const old = await one(
          c,
          "SELECT id FROM devices WHERE token_hash=? FOR UPDATE",
          [tokenHash],
        );
        must(
          old || Number(count.n) < 10,
          409,
          "DEVICE_LIMIT",
          "Remove an old device before registering another",
        );
        await rows(
          c,
          "INSERT INTO devices(id,user_id,session_hash,token_hash,token_ciphertext,platform) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id),session_hash=VALUES(session_hash),token_ciphertext=VALUES(token_ciphertext),platform=VALUES(platform)",
          [
            id,
            req.user.id,
            req.session.key,
            tokenHash,
            encrypt(app.config, req.body.token),
            req.body.platform,
          ],
        );
      });
      const device = await one(
        app.db,
        "SELECT id FROM devices WHERE token_hash=?",
        [tokenHash],
      );
      return { id: device.id };
    },
  );
  app.delete("/api/devices/:id", { preHandler: requireAuth }, async (req) => {
    await rows(app.db, "DELETE FROM devices WHERE id=? AND user_id=?", [
      req.params.id,
      req.user.id,
    ]);
    return { ok: true };
  });
}
export async function runPushOnce(app) {
  if (!app.push) return false;
  await tx(app.db, async (c) => {
    const notifications = await rows(
      c,
      "SELECT seq,user_id FROM notifications WHERE push_enqueued_at IS NULL ORDER BY seq LIMIT 100 FOR UPDATE SKIP LOCKED",
    );
    for (const n of notifications) {
      await rows(
        c,
        "INSERT IGNORE INTO push_deliveries(notification_seq,device_id) SELECT ?,d.id FROM devices d JOIN sessions s ON s.token_hash=d.session_hash WHERE d.user_id=? AND s.expires_at>UTC_TIMESTAMP(3)",
        [n.seq, n.user_id],
      );
      await rows(
        c,
        "UPDATE notifications SET push_enqueued_at=UTC_TIMESTAMP(3) WHERE seq=?",
        [n.seq],
      );
    }
  });
  const job = await tx(app.db, async (c) => {
    const j = await one(
      c,
      "SELECT * FROM push_deliveries WHERE (status='pending' AND available_at<=UTC_TIMESTAMP(3)) OR (status='processing' AND lease_until<UTC_TIMESTAMP(3)) ORDER BY available_at LIMIT 1 FOR UPDATE SKIP LOCKED",
    );
    if (!j) return null;
    const lease = randomUUID();
    await rows(
      c,
      "UPDATE push_deliveries SET status='processing',attempts=attempts+1,lease_token=?,lease_until=DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 60 SECOND) WHERE notification_seq=? AND device_id=?",
      [lease, j.notification_seq, j.device_id],
    );
    return { ...j, attempts: j.attempts + 1, lease };
  });
  if (!job) return false;
  try {
    const delivery = await one(
      app.db,
      "SELECT n.*,d.token_ciphertext FROM notifications n JOIN devices d ON d.id=? JOIN sessions s ON s.token_hash=d.session_hash WHERE n.seq=? AND s.expires_at>UTC_TIMESTAMP(3)",
      [job.device_id, job.notification_seq],
    );
    if (!delivery) {
      await rows(
        app.db,
        "DELETE FROM push_deliveries WHERE notification_seq=? AND device_id=?",
        [job.notification_seq, job.device_id],
      );
      return true;
    }
    const providerId = await app.push(
      decrypt(app.config, delivery.token_ciphertext),
      delivery,
    );
    await rows(
      app.db,
      "UPDATE push_deliveries SET status='done',provider_id=?,lease_token=NULL,lease_until=NULL WHERE notification_seq=? AND device_id=? AND lease_token=?",
      [providerId, job.notification_seq, job.device_id, job.lease],
    );
  } catch (e) {
    if (e.permanent) {
      await rows(app.db, "DELETE FROM devices WHERE id=?", [job.device_id]);
    } else
      await rows(
        app.db,
        "UPDATE push_deliveries SET status=?,available_at=DATE_ADD(UTC_TIMESTAMP(3),INTERVAL ? SECOND),lease_token=NULL,lease_until=NULL,last_error=? WHERE notification_seq=? AND device_id=? AND lease_token=?",
        [
          job.attempts >= 8 ? "failed" : "pending",
          Math.min(2 ** job.attempts, 3600),
          String(e.code || "PUSH_FAILED").slice(0, 100),
          job.notification_seq,
          job.device_id,
          job.lease,
        ],
      );
  }
  return true;
}
