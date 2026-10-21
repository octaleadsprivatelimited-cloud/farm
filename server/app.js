import Fastify from "fastify";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import staticFiles from "@fastify/static";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import rawBody from "fastify-raw-body";
import Razorpay from "razorpay";
import nodemailer from "nodemailer";
import client from "prom-client";
import path from "node:path";
import { loadConfig } from "./config.js";
import { createDatabase, rows, one } from "./db.js";
import { createRedis, cached } from "./cache.js";
import { resolveSession, validateWrite, requireRole } from "./auth.js";
import { AppError, must } from "./errors.js";
import { equal, secretHash } from "./security.js";
import { authRoutes } from "./routes/auth.js";
import {
  catalogRoutes,
  catalogProducts,
  catalogServices,
} from "./routes/catalog.js";
import { accountRoutes, accountSnapshot } from "./routes/account.js";
import { orderRoutes } from "./routes/orders.js";
import { bookingRoutes, partnerProfile } from "./routes/bookings.js";
import { paymentRoutes } from "./routes/payments.js";
import { adminRoutes } from "./routes/admin.js";
import { pushRoutes, pushSender } from "./push.js";
import { portalRoutes, publicBusiness } from "./routes/portal.js";
import { heroRoutes, heroContent } from "./routes/hero.js";
import { uploadRoutes } from "./routes/uploads.js";
export async function buildApp({
  config: provided,
  db: providedDb,
  redis: providedRedis,
  providers = {},
  logger,
} = {}) {
  const config = provided || loadConfig();
  const storageOrigins = config.S3_ENDPOINT
    ? [new URL(config.S3_ENDPOINT).origin]
    : config.S3_BUCKET
      ? [
          `https://${config.S3_BUCKET}.s3.${config.S3_REGION}.amazonaws.com`,
          `https://${config.S3_BUCKET}.s3.amazonaws.com`,
        ]
      : [];
  const app = Fastify({
    logger: logger ?? {
      level: config.LOG_LEVEL,
      redact: [
        "req.headers.authorization",
        "req.headers.cookie",
        'res.headers["set-cookie"]',
      ],
    },
    bodyLimit: 65536,
    requestTimeout: 15000,
    connectionTimeout: 10000,
    keepAliveTimeout: 5000,
    trustProxy: config.TRUST_PROXY
      ? config.TRUST_PROXY.split(",").map((x) => x.trim())
      : false,
    ajv: { customOptions: { removeAdditional: false } },
  });
  app.decorate("config", config);
  app.decorate("db", providedDb || (await createDatabase(config)));
  app.decorate(
    "redis",
    providedRedis === undefined ? await createRedis(config) : providedRedis,
  );
  app.decorate("providers", providers);
  app.decorate("push", providers.push || pushSender(config));
  app.decorate(
    "gateway",
    providers.gateway ||
      (config.PAYMENT_MODE === "razorpay"
        ? new Razorpay({
            key_id: config.RAZORPAY_KEY_ID,
            key_secret: config.RAZORPAY_KEY_SECRET,
          })
        : null),
  );
  // Bound the installed SDK transport so provider outages cannot hold workers indefinitely.
  if (app.gateway?.api?.rq) app.gateway.api.rq.defaults.timeout = 10000;
  app.decorate(
    "mailer",
    providers.mailer ||
      (config.SMTP_HOST
        ? nodemailer.createTransport({
            host: config.SMTP_HOST,
            port: config.SMTP_PORT,
            secure: config.SMTP_PORT === 465,
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 10000,
            auth: config.SMTP_USER
              ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD }
              : undefined,
          })
        : null),
  );
  app.decorate("sms", async (phone, code) => {
    const body = new URLSearchParams({
      To: phone.startsWith("+") ? phone : `+91${phone}`,
      From: config.TWILIO_FROM,
      Body: `Your Kaushik Nursery verification code is ${code}. Expires in 5 minutes.`,
    });
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${config.TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${config.TWILIO_ACCOUNT_SID}:${config.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
        signal: AbortSignal.timeout(10000),
      },
    );
    must(
      res.ok,
      503,
      "SMS_FAILED",
      "Could not deliver the verification message",
    );
  });
  app.decorateRequest("user", null);
  app.decorateRequest("session", null);
  app.decorate("invalidateUserSessions", async (userId) => {
    if (!app.redis) return;
    const ss = await rows(
      app.db,
      "SELECT token_hash FROM sessions WHERE user_id=?",
      [userId],
    );
    if (ss.length)
      await app.redis.del(...ss.map((s) => `kn:session:${s.token_hash}`));
  });
  await app.register(cookie);
  app.addHook("onRequest", async (req) => {
    if (
      req.url.startsWith("/api/") &&
      !/^\/api\/(products|categories|services|service-categories|config)(\/|\?|$)/.test(
        req.url,
      ) &&
      !req.url.startsWith("/api/webhooks/")
    )
      await resolveSession(app, req);
    validateWrite(app, req);
  });
  await app.register(rateLimit, {
    global: true,
    max: 600,
    timeWindow: "1 minute",
    redis: app.redis || undefined,
    skipOnError: false,
    keyGenerator: (req) => (req.user ? `user:${req.user.id}` : req.ip),
  });
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://checkout.razorpay.com"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: [
          "'self'",
          "data:",
          ...storageOrigins,
          "https://*.razorpay.com",
        ],
        connectSrc: [
          "'self'",
          "https://api.razorpay.com",
          "https://*.razorpay.com",
          ...storageOrigins,
        ],
        frameSrc: ["https://api.razorpay.com", "https://*.razorpay.com"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: config.NODE_ENV === "production" ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
  });
  await app.register(rawBody, {
    field: "rawBody",
    global: false,
    encoding: false,
    runFirst: true,
  });
  app.addHook("onSend", async (req, reply, payload) => {
    if (req.url.startsWith("/api/")) reply.header("Cache-Control", "no-store");
    return payload;
  });
  const register = new client.Registry();
  client.collectDefaultMetrics({ register });
  const duration = new client.Histogram({
    name: "http_request_duration_seconds",
    help: "HTTP request duration",
    labelNames: ["method", "route", "status"],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
    registers: [register],
  });
  app.decorateRequest("startedAt", 0);
  app.addHook("onRequest", async (req) => {
    req.startedAt = performance.now();
  });
  app.addHook("onResponse", async (req, reply) =>
    duration.observe(
      {
        method: req.method,
        route: req.routeOptions.url || "unmatched",
        status: String(reply.statusCode),
      },
      (performance.now() - req.startedAt) / 1000,
    ),
  );
  app.get("/health/live", { config: { rateLimit: false } }, async () => ({
    status: "ok",
  }));
  app.get(
    "/health/ready",
    { config: { rateLimit: false } },
    async (req, reply) => {
      try {
        await app.db.query("SELECT 1");
        if (app.redis) await app.redis.ping();
        return { status: "ready" };
      } catch {
        reply.code(503);
        return { status: "unavailable" };
      }
    },
  );
  app.get(
    "/metrics",
    { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (req, reply) => {
      must(
        config.METRICS_TOKEN &&
          equal(
            req.headers.authorization || "",
            `Bearer ${config.METRICS_TOKEN}`,
          ),
        401,
        "UNAUTHORIZED",
        "Metrics credentials required",
      );
      reply.type(register.contentType);
      return register.metrics();
    },
  );
  await app.register(swagger, {
    openapi: {
      info: { title: "Kaushik Nursery API", version: "2.0.0" },
      servers: [{ url: config.APP_ORIGIN }],
      components: {
        securitySchemes: {
          session: { type: "apiKey", in: "cookie", name: "kn_session" },
          csrf: { type: "apiKey", in: "header", name: "X-CSRF-Token" },
          bearer: { type: "http", scheme: "bearer" },
        },
      },
    },
  });
  await authRoutes(app);
  await catalogRoutes(app);
  await accountRoutes(app);
  await orderRoutes(app);
  await bookingRoutes(app);
  await paymentRoutes(app);
  await pushRoutes(app);
  await adminRoutes(app);
  await portalRoutes(app);
  await heroRoutes(app);
  await app.register(uploadRoutes);
  app.get("/api/bootstrap", async (req) => {
    const [products, services, categories, serviceCategories, business, hero] =
      await Promise.all([
        catalogProducts(app, { limit: 100 }),
        catalogServices(app),
        cached(app.redis, "kn:categories", 20, () =>
          rows(
            app.db,
            "SELECT id,name,slug FROM categories WHERE active=TRUE ORDER BY name LIMIT 100",
          ),
        ),
        cached(app.redis, "kn:service-categories", 30, () =>
          rows(
            app.db,
            "SELECT name FROM service_categories WHERE active=TRUE ORDER BY name LIMIT 100",
          ),
        ),
        publicBusiness(app),
        heroContent(app),
      ]);
    return {
      hero,
      business,
      products: products.items,
      services,
      categories,
      serviceCategories,
      user: req.user || null,
      csrfToken: req.session?.csrfToken || null,
      paymentMode: config.PAYMENT_MODE,
      smsEnabled: config.SMS_PROVIDER !== "disabled",
    };
  });
  await app.register(swaggerUI, {
    routePrefix: "/api/docs",
    uiHooks: { preHandler: requireRole("admin") },
  });
  await app.register(staticFiles, {
    root: path.resolve("public"),
    prefix: "/",
    index: ["index.html"],
    maxAge: config.NODE_ENV === "production" ? "1h" : 0,
    setHeaders: (res, file) => {
      if (file.endsWith("index.html")) res.header("Cache-Control", "no-cache");
    },
  });
  app.setErrorHandler((error, req, reply) => {
    const status = error.validation
      ? 400
      : error instanceof AppError
        ? error.statusCode
        : error.statusCode && error.statusCode < 500
          ? error.statusCode
          : error.code === "ER_DUP_ENTRY"
            ? 409
            : 500;
    if (status >= 500)
      app.log.error(
        {
          requestId: req.id,
          code: error.code || error.name,
          err: config.NODE_ENV === "production" ? undefined : error,
        },
        "Request failed",
      );
    return reply.code(status).send({
      error: {
        code: error.validation
          ? "VALIDATION_ERROR"
          : error instanceof AppError
            ? error.code
            : status === 409
              ? "CONFLICT"
              : status === 429
                ? "RATE_LIMITED"
                : status === 500
                  ? "INTERNAL_ERROR"
                  : "REQUEST_FAILED",
        message:
          status >= 500 && !(error instanceof AppError)
            ? "The request could not be completed. Please try again."
            : error.validation
              ? "Check the submitted fields"
              : error.message,
        requestId: req.id,
      },
    });
  });
  app.addHook("onClose", async () => {
    register.clear();
    if (!providedDb) await app.db.end();
    if (providedRedis === undefined && app.redis) await app.redis.quit();
    if (app.mailer?.close) app.mailer.close();
  });
  return app;
}
