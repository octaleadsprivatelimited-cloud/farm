import { randomInt, randomUUID } from "node:crypto";
import { one, rows, tx } from "../db.js";
import { createSession, requireAuth, revokeSessions } from "../auth.js";
import {
  passwordHash,
  passwordMatches,
  publicUser,
  token,
  secretHash,
  equal,
} from "../security.js";
import { must, fail } from "../errors.js";
import { identifierLimit } from "../limits.js";
import { obj, str, email, phone, password } from "../schema.js";
const authLimit = { rateLimit: { max: 12, timeWindow: "15 minutes" } };
export async function authRoutes(app) {
  app.post(
    "/api/auth/register",
    {
      config: authLimit,
      schema: {
        body: obj(
          {
            name: str(100),
            email,
            password,
            phone,
            city: str(100, 0),
            client: { type: "string", enum: ["web", "mobile"] },
          },
          ["name", "email", "password"],
        ),
      },
    },
    async (req, reply) => {
      const b = req.body;
      await identifierLimit(app, "register", b.email, 6);
      try {
        const result = await rows(
          app.db,
          "INSERT INTO users(name,email,contact_phone,password_hash,city) VALUES (?,?,?,?,?)",
          [
            b.name,
            b.email.toLowerCase(),
            b.phone || null,
            await passwordHash(b.password),
            b.city || "",
          ],
        );
        const user = await one(app.db, "SELECT * FROM users WHERE id=?", [
          result.insertId,
        ]);
        reply.code(201);
        return createSession(app, user, reply, b.client);
      } catch (e) {
        if (e.code === "ER_DUP_ENTRY")
          fail(
            409,
            "ACCOUNT_EXISTS",
            "An account already uses this email or phone",
          );
        throw e;
      }
    },
  );
  app.post(
    "/api/auth/login",
    {
      config: authLimit,
      schema: {
        body: obj(
          {
            email,
            password: str(128),
            client: { type: "string", enum: ["web", "mobile"] },
          },
          ["email", "password"],
        ),
      },
    },
    async (req, reply) => {
      await identifierLimit(app, "login", req.body.email, 20);
      const user = await one(app.db, "SELECT * FROM users WHERE email=?", [
        req.body.email.toLowerCase(),
      ]);
      const valid = await passwordMatches(
        req.body.password,
        user?.password_hash,
      );
      must(
        valid && user?.status === "active",
        401,
        "INVALID_LOGIN",
        "Email or password is incorrect",
      );
      return createSession(app, user, reply, req.body.client);
    },
  );
  app.get("/api/auth/session", async (req) => ({
    user: req.user || null,
    csrfToken: req.session?.csrfToken || null,
  }));
  app.post(
    "/api/auth/logout",
    { preHandler: requireAuth },
    async (req, reply) => {
      await rows(app.db, "DELETE FROM sessions WHERE token_hash=?", [
        req.session.key,
      ]);
      if (app.redis) await app.redis.del(`kn:session:${req.session.key}`);
      reply.clearCookie("kn_session", { path: "/" });
      return { ok: true };
    },
  );
  app.post(
    "/api/auth/logout-all",
    { preHandler: requireAuth },
    async (req, reply) => {
      await revokeSessions(app, req.user.id);
      reply.clearCookie("kn_session", { path: "/" });
      return { ok: true };
    },
  );
  app.post(
    "/api/auth/change-password",
    {
      preHandler: requireAuth,
      config: authLimit,
      schema: { body: obj({ currentPassword: str(128), password }) },
    },
    async (req, reply) => {
      const user = await one(app.db, "SELECT * FROM users WHERE id=?", [
        req.user.id,
      ]);
      must(
        await passwordMatches(req.body.currentPassword, user.password_hash),
        401,
        "INVALID_PASSWORD",
        "Current password is incorrect",
      );
      const newHash = await passwordHash(req.body.password);
      await tx(app.db, async (c) => {
        const changed = await rows(
          c,
          "UPDATE users SET password_hash=? WHERE id=? AND password_hash=?",
          [newHash, user.id, user.password_hash],
        );
        must(
          changed.affectedRows,
          409,
          "PASSWORD_CHANGED",
          "Your credentials changed. Sign in again.",
        );
        await rows(
          c,
          "UPDATE password_resets SET consumed=TRUE WHERE user_id=?",
          [user.id],
        );
        await app.invalidateUserSessions(user.id);
        await rows(c, "DELETE FROM sessions WHERE user_id=?", [user.id]);
      });
      await app.invalidateUserSessions(user.id);
      return createSession(app, { ...user, password_hash: newHash }, reply);
    },
  );
  app.post(
    "/api/auth/otp/request",
    { config: authLimit, schema: { body: obj({ phone }) } },
    async (req, reply) => {
      must(
        app.config.SMS_PROVIDER !== "disabled" || app.providers.sendOtp,
        503,
        "SMS_UNAVAILABLE",
        "SMS sign-in is not configured. Use email and password.",
      );
      await identifierLimit(app, "otp", req.body.phone, 5);
      const recent = await one(
        app.db,
        "SELECT COUNT(*) AS n FROM otp_challenges WHERE phone=? AND created_at>DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 15 MINUTE)",
        [req.body.phone],
      );
      must(
        Number(recent.n) < 5,
        429,
        "OTP_LIMIT",
        "Please wait before requesting another code",
      );
      const id = randomUUID(),
        code = String(randomInt(100000, 1000000));
      await rows(
        app.db,
        "INSERT INTO otp_challenges(id,phone,code_hash,expires_at) VALUES (?,?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 5 MINUTE))",
        [
          id,
          req.body.phone,
          secretHash(app.config.SESSION_SECRET, `${id}:${code}`),
        ],
      );
      try {
        if (app.providers.sendOtp)
          await app.providers.sendOtp(req.body.phone, code);
        else await app.sms(req.body.phone, code);
      } catch (e) {
        await rows(
          app.db,
          "UPDATE otp_challenges SET consumed=TRUE WHERE id=?",
          [id],
        );
        throw e;
      }
      reply.code(202);
      return { challengeId: id, expiresIn: 300 };
    },
  );
  app.post(
    "/api/auth/otp/verify",
    {
      config: authLimit,
      schema: {
        body: obj(
          {
            challengeId: str(36),
            code: { type: "string", pattern: "^[0-9]{6}$" },
            name: str(100),
            client: { type: "string", enum: ["web", "mobile"] },
          },
          ["challengeId", "code"],
        ),
      },
    },
    async (req, reply) => {
      const b = req.body;
      const result = await tx(app.db, async (c) => {
        const challenge = await one(
          c,
          "SELECT *,expires_at>UTC_TIMESTAMP(3) AS valid FROM otp_challenges WHERE id=? FOR UPDATE",
          [b.challengeId],
        );
        if (
          !challenge ||
          challenge.consumed ||
          !challenge.valid ||
          challenge.attempts >= 5
        )
          return null;
        await rows(
          c,
          "UPDATE otp_challenges SET attempts=attempts+1 WHERE id=?",
          [b.challengeId],
        );
        if (
          !equal(
            challenge.code_hash,
            secretHash(app.config.SESSION_SECRET, `${b.challengeId}:${b.code}`),
          )
        )
          return null;
        await rows(c, "UPDATE otp_challenges SET consumed=TRUE WHERE id=?", [
          b.challengeId,
        ]);
        let user = await one(c, "SELECT * FROM users WHERE phone=?", [
          challenge.phone,
        ]);
        if (!user) {
          const r = await rows(
            c,
            "INSERT INTO users(name,phone) VALUES (?,?)",
            [b.name || "Garden lover", challenge.phone],
          );
          user = await one(c, "SELECT * FROM users WHERE id=?", [r.insertId]);
        }
        return user;
      });
      must(
        result && result.status === "active",
        401,
        "OTP_INVALID",
        "The code is invalid or expired",
      );
      return createSession(app, result, reply, b.client);
    },
  );
  app.post(
    "/api/auth/forgot-password",
    { config: authLimit, schema: { body: obj({ email }) } },
    async (req, reply) => {
      must(
        app.mailer,
        503,
        "EMAIL_UNAVAILABLE",
        "Password reset email is not configured",
      );
      await identifierLimit(app, "reset", req.body.email, 5);
      const u = await one(
        app.db,
        "SELECT id,email FROM users WHERE email=? AND status='active'",
        [req.body.email.toLowerCase()],
      );
      if (u) {
        const value = token();
        await rows(
          app.db,
          "INSERT INTO password_resets(token_hash,user_id,expires_at) VALUES (?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 30 MINUTE))",
          [secretHash(app.config.SESSION_SECRET, value), u.id],
        );
        await app.mailer.sendMail({
          from: app.config.MAIL_FROM,
          to: u.email,
          subject: "Reset your Kaushik Nursery password",
          text: `Open ${app.config.APP_ORIGIN}/#reset-password/${value} to reset your password. This link expires in 30 minutes.`,
        });
      }
      reply.code(202);
      return {
        ok: true,
        message: "If the account exists, a reset email has been sent.",
      };
    },
  );
  app.post(
    "/api/auth/reset-password",
    {
      config: authLimit,
      schema: { body: obj({ token: str(64, 64), password }) },
    },
    async (req) => {
      const newHash = await passwordHash(req.body.password);
      await tx(app.db, async (c) => {
        const reset = await one(
          c,
          "SELECT * FROM password_resets WHERE token_hash=? AND consumed=FALSE AND expires_at>UTC_TIMESTAMP(3) FOR UPDATE",
          [secretHash(app.config.SESSION_SECRET, req.body.token)],
        );
        must(
          reset,
          400,
          "RESET_INVALID",
          "This reset link is invalid or expired",
        );
        await rows(
          c,
          "UPDATE password_resets SET consumed=TRUE WHERE user_id=?",
          [reset.user_id],
        );
        await rows(c, "UPDATE users SET password_hash=? WHERE id=?", [
          newHash,
          reset.user_id,
        ]);
        await app.invalidateUserSessions(reset.user_id);
        await rows(c, "DELETE FROM sessions WHERE user_id=?", [reset.user_id]);
      });
      return { ok: true };
    },
  );
}
