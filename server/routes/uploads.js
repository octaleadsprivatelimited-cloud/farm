import { randomUUID } from "node:crypto";
import path from "node:path";
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  CopyObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { rows, one } from "../db.js";
import { requireAuth } from "../auth.js";
import { obj, str, integer } from "../schema.js";
import { must } from "../errors.js";
const maxSize = 8 * 1024 * 1024;
export function validFile(bytes, type) {
  if (type === "image/jpeg")
    return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (type === "image/png")
    return bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (type === "image/webp")
    return (
      bytes.subarray(0, 4).toString() === "RIFF" &&
      bytes.subarray(8, 12).toString() === "WEBP"
    );
  if (type === "application/pdf")
    return bytes.subarray(0, 5).toString() === "%PDF-";
  return false;
}
export async function uploadRoutes(app) {
  const c = app.config,
    auth = { preHandler: requireAuth },
    root = path.resolve(c.UPLOAD_DIRECTORY);
  const s3 =
    c.STORAGE_DRIVER === "s3"
      ? new S3Client({
          maxAttempts: 2,
          requestHandler: { connectionTimeout: 3000, requestTimeout: 10000 },
          region: c.S3_REGION,
          endpoint: c.S3_ENDPOINT,
          forcePathStyle: Boolean(c.S3_ENDPOINT),
          credentials: {
            accessKeyId: c.S3_ACCESS_KEY_ID,
            secretAccessKey: c.S3_SECRET_ACCESS_KEY,
          },
        })
      : null;
  if (!s3) await mkdir(root, { recursive: true });
  const filePath = (u) => path.join(root, u.id);
  app.post(
    "/api/uploads/presign",
    {
      ...auth,
      config: { rateLimit: { max: 20, timeWindow: "1 hour" } },
      schema: {
        body: obj({
          name: str(160),
          kind: {
            type: "string",
            enum: ["reference", "completion", "document", "catalog"],
          },
          contentType: {
            type: "string",
            enum: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
          },
          size: integer(1, maxSize),
        }),
      },
    },
    async (req, reply) => {
      const b = req.body;
      must(
        b.kind !== "catalog" || req.user.role === "admin",
        403,
        "FORBIDDEN",
        "Only administrators can upload catalog images",
      );
      must(
        b.kind !== "completion" || req.user.role === "partner",
        403,
        "FORBIDDEN",
        "Only service partners can upload completion photos",
      );
      must(
        b.contentType !== "application/pdf" || b.kind === "document",
        400,
        "FILE_TYPE_INVALID",
        "PDF files are only accepted as partner documents",
      );
      const n = await one(
        app.db,
        "SELECT COUNT(*) AS n FROM uploads WHERE user_id=? AND created_at>DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 1 DAY)",
        [req.user.id],
      );
      must(
        Number(n.n) < 100,
        429,
        "UPLOAD_QUOTA",
        "Daily upload limit reached",
      );
      const id = randomUUID(),
        key = `private/${req.user.id}/${id}`;
      await rows(
        app.db,
        "INSERT INTO uploads(id,user_id,kind,object_key,original_name,content_type,size_bytes) VALUES (?,?,?,?,?,?,?)",
        [
          id,
          req.user.id,
          b.kind,
          key,
          b.name.replace(/[\r\n]/g, ""),
          b.contentType,
          b.size,
        ],
      );
      const uploadUrl = s3
        ? await getSignedUrl(
            s3,
            new PutObjectCommand({
              Bucket: c.S3_BUCKET,
              Key: key,
              ContentType: b.contentType,
              ContentLength: b.size,
            }),
            { expiresIn: 300 },
          )
        : `/api/uploads/${id}/local-content`;
      reply.code(201);
      return {
        id,
        uploadUrl,
        headers: { "Content-Type": b.contentType },
        expiresIn: 300,
      };
    },
  );
  if (!s3) {
    app.addContentTypeParser(
      ["image/jpeg", "image/png", "image/webp", "application/pdf"],
      { parseAs: "buffer", bodyLimit: maxSize },
      (req, body, done) => done(null, body),
    );
    app.put(
      "/api/uploads/:id/local-content",
      { ...auth, bodyLimit: maxSize },
      async (req) => {
        const u = await one(
          app.db,
          "SELECT * FROM uploads WHERE id=? AND user_id=? AND status='pending' AND created_at>DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 5 MINUTE)",
          [req.params.id, req.user.id],
        );
        must(u, 404, "NOT_FOUND", "Upload not found or expired");
        must(
          Buffer.isBuffer(req.body) &&
            req.body.length === u.size_bytes &&
            validFile(req.body, u.content_type),
          400,
          "FILE_INVALID",
          "File size or content does not match",
        );
        await writeFile(filePath(u), req.body, { flag: "wx", mode: 0o600 });
        return { ok: true };
      },
    );
  }
  app.post("/api/uploads/:id/complete", auth, async (req) => {
    const u = await one(
      app.db,
      "SELECT * FROM uploads WHERE id=? AND user_id=?",
      [req.params.id, req.user.id],
    );
    must(u, 404, "NOT_FOUND", "Upload not found");
    if (u.status === "ready") return { id: u.id, name: u.original_name };
    let size,
      magic,
      finalKey = u.object_key;
    if (s3) {
      const head = await s3.send(
        new HeadObjectCommand({ Bucket: c.S3_BUCKET, Key: u.object_key }),
      );
      must(
        head.ContentLength === u.size_bytes && head.ContentLength <= maxSize,
        400,
        "FILE_INVALID",
        "File size does not match",
      );
      finalKey = `private/${req.user.id}/ready-${randomUUID()}`;
      await s3.send(
        new CopyObjectCommand({
          Bucket: c.S3_BUCKET,
          Key: finalKey,
          CopySource: [c.S3_BUCKET, ...u.object_key.split("/")]
            .map(encodeURIComponent)
            .join("/"),
          CopySourceIfMatch: head.ETag,
        }),
      );
      const copied = await s3.send(
        new HeadObjectCommand({ Bucket: c.S3_BUCKET, Key: finalKey }),
      );
      size = copied.ContentLength;
      const result = await s3.send(
        new GetObjectCommand({
          Bucket: c.S3_BUCKET,
          Key: finalKey,
          Range: "bytes=0-15",
        }),
      );
      magic = Buffer.from(await result.Body.transformToByteArray());
    } else {
      size = (await stat(filePath(u))).size;
      const { open } = await import("node:fs/promises");
      const file = await open(filePath(u), "r");
      try {
        magic = Buffer.alloc(16);
        await file.read(magic, 0, 16, 0);
      } finally {
        await file.close();
      }
    }
    must(
      size === u.size_bytes &&
        size <= maxSize &&
        validFile(magic, u.content_type),
      400,
      "FILE_INVALID",
      "File size or type validation failed",
    );
    await rows(
      app.db,
      "UPDATE uploads SET status='ready',object_key=? WHERE id=? AND status='pending'",
      [finalKey, u.id],
    );
    return { id: u.id, name: u.original_name };
  });
  app.get("/api/uploads/:id/content", async (req, reply) => {
    const u = await one(
      app.db,
      "SELECT * FROM uploads WHERE id=? AND status='ready'",
      [req.params.id],
    );
    must(u, 404, "NOT_FOUND", "File not found");
    let allowed =
      String(u.user_id) === String(req.user?.id) || req.user?.role === "admin";
    if (!allowed && u.kind === "catalog")
      allowed = Boolean(
        await one(
          app.db,
          "SELECT p.id FROM products p JOIN categories c ON c.id=p.category_id WHERE p.active=TRUE AND c.active=TRUE AND p.image=? UNION ALL SELECT s.id FROM services s JOIN service_categories c ON c.name=s.category WHERE s.active=TRUE AND c.active=TRUE AND s.image=? LIMIT 1",
          [`/api/uploads/${u.id}/content`, `/api/uploads/${u.id}/content`],
        ),
      );
    if (!allowed && req.user) {
      allowed = Boolean(
        await one(
          app.db,
          "SELECT b.id FROM booking_uploads bu JOIN bookings b ON b.id=bu.booking_id LEFT JOIN partners p ON p.id=b.assigned_partner_id WHERE bu.upload_id=? AND (b.user_id=? OR p.user_id=?)",
          [u.id, req.user.id, req.user.id],
        ),
      );
    }
    must(allowed, 404, "NOT_FOUND", "File not found");
    reply
      .header("X-Content-Type-Options", "nosniff")
      .header("Cache-Control", "private, max-age=60");
    const disposition =
      u.content_type === "application/pdf" ? "attachment" : "inline";
    if (s3) {
      const url = await getSignedUrl(
        s3,
        new GetObjectCommand({
          Bucket: c.S3_BUCKET,
          Key: u.object_key,
          ResponseContentDisposition: disposition,
          ResponseContentType: u.content_type,
        }),
        { expiresIn: 60 },
      );
      return reply.redirect(url);
    }
    reply
      .type(u.content_type)
      .header("Content-Disposition", `${disposition}; filename="file-${u.id}"`);
    return reply.send(createReadStream(filePath(u)));
  });
  app.addHook("onClose", async () => s3?.destroy());
}
