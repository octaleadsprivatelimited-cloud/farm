import { rows, one, tx } from "./db.js";
import { publicUser, secretHash, token, equal } from "./security.js";
import { must } from "./errors.js";
export async function createSession(app, user, reply, client = "web") {
  const accessToken = token(),
    csrfToken = token(),
    key = secretHash(app.config.SESSION_SECRET, accessToken);
  let cacheSet = false;
  try {
    user = await tx(app.db, async (c) => {
      const current = await one(
        c,
        "SELECT * FROM users WHERE id=? AND status='active' FOR UPDATE",
        [user.id],
      );
      must(
        current &&
          (!user.password_hash || user.password_hash === current.password_hash),
        401,
        "ACCOUNT_UNAVAILABLE",
        "Your account changed. Please sign in again.",
      );
      await rows(
        c,
        "INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at) VALUES (?,?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL ? DAY))",
        [key, current.id, csrfToken, app.config.SESSION_DAYS],
      );
      if (app.redis) {
        await app.redis.set(
          `kn:session:${key}`,
          JSON.stringify({ user: publicUser(current), csrfToken }),
          "EX",
          app.config.SESSION_DAYS * 86400,
        );
        cacheSet = true;
      }
      return current;
    });
  } catch (e) {
    if (cacheSet && app.redis) await app.redis.del(`kn:session:${key}`);
    throw e;
  }
  reply.setCookie("kn_session", accessToken, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: app.config.NODE_ENV === "production",
    maxAge: app.config.SESSION_DAYS * 86400,
  });
  return {
    user: publicUser(user),
    csrfToken,
    ...(client === "mobile" ? { accessToken } : {}),
  };
}
export async function resolveSession(app, request) {
  const bearer = /^Bearer ([a-f0-9]{64})$/.exec(
    request.headers.authorization || "",
  );
  const value = bearer?.[1] || request.cookies.kn_session;
  if (!value || !/^[a-f0-9]{64}$/.test(value)) return;
  const key = secretHash(app.config.SESSION_SECRET, value);
  if (app.redis) {
    const cached = await app.redis.get(`kn:session:${key}`);
    if (cached) {
      const session = JSON.parse(cached);
      request.user = session.user;
      request.session = {
        key,
        csrfToken: session.csrfToken,
        bearer: Boolean(bearer),
      };
      return;
    }
  }
  // Cache misses are checked against MySQL without repopulating revoked session keys.
  const u = await one(
    app.db,
    "SELECT u.*,s.csrf_token FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>UTC_TIMESTAMP(3) AND u.status='active'",
    [key],
  );
  if (u) {
    request.user = publicUser(u);
    request.session = { key, csrfToken: u.csrf_token, bearer: Boolean(bearer) };
  }
}
export async function requireAuth(request) {
  must(request.user, 401, "AUTH_REQUIRED", "Sign in to continue");
}
export function requireRole(...roles) {
  return async (request) => {
    await requireAuth(request);
    must(
      roles.includes(request.user.role),
      403,
      "FORBIDDEN",
      "You do not have access to this operation",
    );
  };
}
export async function revokeSessions(app, userId) {
  await tx(app.db, async (c) => {
    await one(c, "SELECT id FROM users WHERE id=? FOR UPDATE", [userId]);
    const sessions = await rows(
      c,
      "SELECT token_hash FROM sessions WHERE user_id=?",
      [userId],
    );
    await rows(c, "DELETE FROM sessions WHERE user_id=?", [userId]);
    if (app.redis && sessions.length)
      await app.redis.del(...sessions.map((s) => `kn:session:${s.token_hash}`));
  });
}
export function validateWrite(app, request) {
  if (
    !request.url.startsWith("/api/") ||
    ["GET", "HEAD", "OPTIONS"].includes(request.method) ||
    request.routeOptions?.config?.webhook
  )
    return;
  const origin = request.headers.origin;
  if (origin)
    must(
      origin === app.config.APP_ORIGIN,
      403,
      "ORIGIN_DENIED",
      "This request origin is not allowed",
    );
  if (request.session && !request.session.bearer)
    must(
      equal(request.headers["x-csrf-token"] || "", request.session.csrfToken),
      403,
      "CSRF_INVALID",
      "Refresh this page before submitting again",
    );
}
