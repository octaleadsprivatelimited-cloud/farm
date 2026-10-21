import "dotenv/config";
import { z } from "zod";
const bool = z.preprocess((v) => v === true || v === "true", z.boolean());
const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4173),
  APP_ORIGIN: z.string().url().default("http://127.0.0.1:4173"),
  DB_HOST: z.string().default("127.0.0.1"),
  DB_PORT: z.coerce.number().int().default(3306),
  DB_NAME: z
    .string()
    .regex(/^[a-zA-Z0-9_]+$/)
    .default("kaushik"),
  DB_USER: z.string().default("kaushik"),
  DB_PASSWORD: z.string().min(1),
  DB_POOL_SIZE: z.coerce.number().int().min(1).max(100).default(10),
  DB_QUEUE_LIMIT: z.coerce.number().int().min(1).max(1000).default(100),
  DB_SSL_CA: z.string().optional(),
  REDIS_NAMESPACE: z
    .string()
    .regex(/^[a-zA-Z0-9:_-]+$/)
    .default("nursery"),
  REDIS_URL: z.string().url().optional(),
  TRUST_PROXY: z.string().default(""),
  SESSION_SECRET: z.string().min(48),
  SESSION_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  PAYMENT_MODE: z.enum(["razorpay", "disabled", "test"]).default("disabled"),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  SMS_PROVIDER: z.enum(["disabled", "twilio"]).default("disabled"),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().email().optional(),
  PUSH_PROVIDER: z.enum(["disabled", "fcm"]).default("disabled"),
  FCM_PROJECT_ID: z.string().optional(),
  FCM_SERVICE_ACCOUNT_FILE: z.string().optional(),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  UPLOAD_DIRECTORY: z.string().default("./var/uploads"),
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  METRICS_TOKEN: z.string().min(32).optional(),
  MIGRATE_ON_START: bool.default(false),
  SEED_CATALOG_ON_START: bool.default(false),
  RUN_WORKER: bool.default(false),
  LOG_LEVEL: z
    .enum(["silent", "error", "warn", "info", "debug"])
    .default("info"),
});
export function loadConfig(env = process.env) {
  const c = schema.parse(env);
  c.APP_ORIGIN = new URL(c.APP_ORIGIN).origin;
  if (
    c.PAYMENT_MODE === "razorpay" &&
    (!c.RAZORPAY_KEY_ID || !c.RAZORPAY_KEY_SECRET || !c.RAZORPAY_WEBHOOK_SECRET)
  )
    throw Error("Razorpay credentials and webhook secret are required");
  if (
    c.SMS_PROVIDER === "twilio" &&
    (!c.TWILIO_ACCOUNT_SID || !c.TWILIO_AUTH_TOKEN || !c.TWILIO_FROM)
  )
    throw Error("Twilio credentials are required");
  if (
    c.STORAGE_DRIVER === "s3" &&
    (!c.S3_BUCKET || !c.S3_ACCESS_KEY_ID || !c.S3_SECRET_ACCESS_KEY)
  )
    throw Error("Private object-storage credentials are required");
  if (c.STORAGE_DRIVER === "s3" && !c.S3_ENDPOINT && c.S3_REGION === "auto")
    throw Error("Set the actual AWS S3 region or a compatible S3_ENDPOINT");
  if (
    c.NODE_ENV === "production" &&
    c.S3_ENDPOINT &&
    !c.S3_ENDPOINT.startsWith("https://")
  )
    throw Error("Production object storage requires HTTPS");
  if (
    c.PUSH_PROVIDER === "fcm" &&
    (!c.FCM_PROJECT_ID || !c.FCM_SERVICE_ACCOUNT_FILE)
  )
    throw Error("FCM project and service-account file are required");
  if (c.NODE_ENV === "production") {
    if (!c.REDIS_URL) throw Error("Production requires shared Redis");
    if (!c.APP_ORIGIN.startsWith("https://"))
      throw Error("Production APP_ORIGIN must use HTTPS");
    if (c.PAYMENT_MODE === "test")
      throw Error("Simulated payments cannot run in production");
    if (c.STORAGE_DRIVER !== "s3")
      throw Error("Production uploads require shared private object storage");
    if (!c.METRICS_TOKEN) throw Error("Production metrics require a token");
  }
  return c;
}
