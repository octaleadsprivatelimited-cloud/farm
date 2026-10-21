import { createHmac } from "node:crypto";
import { requireAuth, requireRole } from "../auth.js";
import { obj, str } from "../schema.js";
import { rows, one, tx } from "../db.js";
import { equal } from "../security.js";
import { must } from "../errors.js";
import {
  createPayment,
  capturePayment,
  handleWebhook,
  queueRefund,
} from "../payments.js";
export async function paymentRoutes(app) {
  const auth = { preHandler: requireAuth };
  app.post(
    "/api/payments",
    {
      ...auth,
      schema: {
        body: {
          ...obj({ orderId: str(36), bookingId: str(36) }, []),
          oneOf: [
            { required: ["orderId"], not: { required: ["bookingId"] } },
            { required: ["bookingId"], not: { required: ["orderId"] } },
          ],
        },
      },
    },
    (req) => createPayment(app, req.user, req.body),
  );
  app.post(
    "/api/payments/verify",
    {
      ...auth,
      schema: {
        body: obj({
          paymentId: str(36),
          razorpay_payment_id: str(100),
          razorpay_signature: str(100),
        }),
      },
    },
    async (req) => {
      must(
        app.config.PAYMENT_MODE === "razorpay",
        400,
        "GATEWAY_DISABLED",
        "Gateway verification is unavailable",
      );
      const p = await one(
        app.db,
        "SELECT p.* FROM payments p LEFT JOIN orders o ON o.id=p.order_id LEFT JOIN bookings b ON b.id=p.booking_id WHERE p.id=? AND COALESCE(o.user_id,b.user_id)=?",
        [req.body.paymentId, req.user.id],
      );
      must(p?.provider_order_id, 404, "NOT_FOUND", "Payment not found");
      must(
        equal(
          createHmac("sha256", app.config.RAZORPAY_KEY_SECRET)
            .update(`${p.provider_order_id}|${req.body.razorpay_payment_id}`)
            .digest("hex"),
          req.body.razorpay_signature,
        ),
        400,
        "SIGNATURE_INVALID",
        "Payment signature is invalid",
      );
      const remote = await app.gateway.payments.fetch(
        req.body.razorpay_payment_id,
      );
      must(
        remote.order_id === p.provider_order_id,
        400,
        "ORDER_MISMATCH",
        "Payment belongs to another order",
      );
      if (remote.status !== "captured") return { ok: false, pending: true };
      return capturePayment(app, remote);
    },
  );
  app.post("/api/payments/:id/test-capture", auth, async (req) => {
    must(
      app.config.NODE_ENV !== "production" &&
        app.config.PAYMENT_MODE === "test",
      404,
      "NOT_FOUND",
      "Not found",
    );
    const p = await one(
      app.db,
      "SELECT p.* FROM payments p LEFT JOIN orders o ON o.id=p.order_id LEFT JOIN bookings b ON b.id=p.booking_id WHERE p.id=? AND COALESCE(o.user_id,b.user_id)=?",
      [req.params.id, req.user.id],
    );
    must(p, 404, "NOT_FOUND", "Payment not found");
    return capturePayment(app, {
      id: `test_pay_${p.id}`,
      order_id: p.provider_order_id,
      amount: p.amount_paise,
      currency: p.currency,
      status: "captured",
    });
  });
  app.post(
    "/api/webhooks/razorpay",
    {
      config: {
        rawBody: true,
        webhook: true,
        rateLimit: { max: 1200, timeWindow: "1 minute" },
      },
      schema: {
        body: {
          type: "object",
          required: ["event", "payload"],
          properties: {
            event: str(100),
            payload: { type: "object", additionalProperties: true },
          },
          additionalProperties: true,
        },
      },
    },
    (req) => handleWebhook(app, req),
  );
  app.post(
    "/api/admin/payments/:id/refund",
    { preHandler: requireRole("admin") },
    async (req) => {
      await tx(app.db, async (c) => {
        const p = await one(
          c,
          "SELECT * FROM payments WHERE id=? AND status='captured' FOR UPDATE",
          [req.params.id],
        );
        must(
          p,
          409,
          "NOT_REFUNDABLE",
          "Only captured payments can be refunded",
        );
        await queueRefund(c, p, "Admin-approved refund");
        await rows(
          c,
          "INSERT INTO audit_logs(actor_id,action,resource_type,resource_id) VALUES (?,?,?,?)",
          [req.user.id, "refund.request", "payment", p.id],
        );
      });
      return { ok: true, status: "queued" };
    },
  );
}
