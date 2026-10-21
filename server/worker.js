import { randomUUID } from "node:crypto";
import { rows, one, tx } from "./db.js";
import { hash, parseJSON } from "./security.js";
import { expireOrders } from "./orders.js";
import { runPushOnce } from "./push.js";
import { processRefund } from "./payments.js";
export async function runJobsOnce(app) {
  const claim = await tx(app.db, async (c) => {
    const job = await one(
      c,
      "SELECT * FROM outbox_jobs WHERE (status='pending' AND available_at<=UTC_TIMESTAMP(3)) OR (status='processing' AND lease_until<UTC_TIMESTAMP(3)) ORDER BY available_at LIMIT 1 FOR UPDATE SKIP LOCKED",
    );
    if (!job) return null;
    const lease = randomUUID();
    await rows(
      c,
      "UPDATE outbox_jobs SET status='processing',attempts=attempts+1,lease_token=?,lease_until=DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 60 SECOND) WHERE id=?",
      [lease, job.id],
    );
    return { ...job, attempts: job.attempts + 1, lease };
  });
  if (!claim) return false;
  try {
    const payload = parseJSON(claim.payload, {});
    if (claim.type === "refund") await processRefund(app, payload);
    else if (claim.type === "broadcast")
      await tx(app.db, async (c) => {
        const roles = {
          customers: ["customer"],
          partners: ["partner"],
          all: ["customer", "partner"],
        };
        const recipients = await rows(
          c,
          `SELECT id FROM users WHERE id>? AND status='active' AND role IN (${roles[payload.audience].map(() => "?")}) ORDER BY id LIMIT 500`,
          [payload.cursor, ...roles[payload.audience]],
        );
        for (const user of recipients)
          await rows(
            c,
            "INSERT IGNORE INTO notifications(user_id,title,message,type,payload,campaign_id) VALUES (?,?,?,?,?,?)",
            [
              user.id,
              payload.title,
              payload.message,
              "announcement",
              JSON.stringify({ campaignId: payload.campaignId }),
              payload.campaignId,
            ],
          );
        if (recipients.length === 500) {
          const next = { ...payload, cursor: String(recipients.at(-1).id) },
            nextId = hash(`${payload.campaignId}:${next.cursor}`).slice(0, 32);
          await rows(
            c,
            "INSERT IGNORE INTO outbox_jobs(id,type,payload) VALUES (?,?,?)",
            [nextId, "broadcast", JSON.stringify(next)],
          );
        }
      });
    else throw Error("Unsupported background job");
    await rows(
      app.db,
      "UPDATE outbox_jobs SET status='done',lease_until=NULL,lease_token=NULL WHERE id=? AND lease_token=?",
      [claim.id, claim.lease],
    );
  } catch (e) {
    const exhausted = claim.attempts >= 8;
    await rows(
      app.db,
      "UPDATE outbox_jobs SET status=?,available_at=DATE_ADD(UTC_TIMESTAMP(3),INTERVAL ? SECOND),lease_until=NULL,lease_token=NULL,last_error=? WHERE id=? AND lease_token=?",
      [
        exhausted ? "failed" : "pending",
        Math.min(2 ** claim.attempts, 3600),
        String(e.code || e.name || "JOB_FAILED").slice(0, 500),
        claim.id,
        claim.lease,
      ],
    );
    app.log.error(
      { jobId: claim.id, code: e.code || "JOB_FAILED" },
      "Background job failed",
    );
  }
  return true;
}
export function startWorker(app) {
  let stopped = false,
    running = false,
    ticks = 0;
  const timer = setInterval(async () => {
    if (stopped || running) return;
    running = true;
    try {
      for (let i = 0; i < 10; i++) if (!(await runJobsOnce(app))) break;
      for (let i = 0; i < 20; i++) if (!(await runPushOnce(app))) break;
      if (++ticks % 15 === 0) {
        await expireOrders(app);
        await rows(
          app.db,
          "DELETE FROM sessions WHERE expires_at<UTC_TIMESTAMP(3) LIMIT 1000",
        );
        await rows(
          app.db,
          "DELETE FROM auth_rate_limits WHERE expires_at<UTC_TIMESTAMP(3) LIMIT 1000",
        );
        await rows(
          app.db,
          "DELETE FROM password_resets WHERE expires_at<UTC_TIMESTAMP(3) LIMIT 1000",
        );
        await rows(
          app.db,
          "DELETE FROM otp_challenges WHERE expires_at<DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 1 DAY) LIMIT 1000",
        );
      }
    } catch (e) {
      app.log.error(
        { code: e.code || "WORKER_FAILED" },
        "Worker iteration failed",
      );
    } finally {
      running = false;
    }
  }, 2000);
  timer.unref();
  return async () => {
    stopped = true;
    clearInterval(timer);
    while (running) await new Promise((r) => setTimeout(r, 20));
  };
}
