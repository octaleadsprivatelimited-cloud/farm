import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import dotenv from "dotenv";
import Razorpay from "razorpay";

dotenv.config();

const root = path.resolve("public");
const port = Number(process.env.PORT || 4173);

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";

let rzpInstance = null;
if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET && RAZORPAY_KEY_ID !== "rzp_test_placeholder") {
  try {
    rzpInstance = new Razorpay({
      key_id: RAZORPAY_KEY_ID,
      key_secret: RAZORPAY_KEY_SECRET,
    });
  } catch (err) {
    console.warn("Could not initialize Razorpay SDK:", err.message);
  }
}

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ttf": "font/ttf",
  ".json": "application/json",
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function jsonResponse(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(data));
}

http
  .createServer(async (req, res) => {
    try {
      const parsedUrl = new URL(req.url, "http://localhost");
      const pathname = decodeURIComponent(parsedUrl.pathname);

      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        });
        res.end();
        return;
      }

      // API: Get Public Razorpay Config
      if (pathname === "/api/config" && req.method === "GET") {
        return jsonResponse(res, 200, {
          razorpayKeyId: RAZORPAY_KEY_ID || "rzp_test_placeholder",
          hasValidCredentials: Boolean(
            RAZORPAY_KEY_ID &&
              RAZORPAY_KEY_SECRET &&
              RAZORPAY_KEY_ID !== "rzp_test_placeholder"
          ),
        });
      }

      // API: Create Razorpay Order
      if (pathname === "/api/razorpay/create-order" && req.method === "POST") {
        const body = await readBody(req);
        const amountInRupees = Number(body.amount) || 0;
        const amountInPaise = Math.round(amountInRupees * 100);
        const receipt = body.receipt || `rcpt_${Date.now()}`;
        const currency = body.currency || "INR";

        if (amountInPaise <= 0) {
          return jsonResponse(res, 400, { error: "Invalid amount" });
        }

        // If real Razorpay credentials exist, create order via Razorpay API
        if (rzpInstance) {
          try {
            const order = await rzpInstance.orders.create({
              amount: amountInPaise,
              currency,
              receipt,
              notes: body.notes || {},
            });
            return jsonResponse(res, 200, order);
          } catch (err) {
            console.error("Razorpay order creation error:", err);
            return jsonResponse(res, 500, {
              error: err.error?.description || err.message,
            });
          }
        }

        // Fallback simulated order for test/dev mode without real API keys
        const mockOrder = {
          id: `order_${crypto.randomBytes(8).toString("hex")}`,
          entity: "order",
          amount: amountInPaise,
          amount_paid: 0,
          amount_due: amountInPaise,
          currency,
          receipt,
          status: "created",
          attempts: 0,
          notes: body.notes || {},
          created_at: Math.floor(Date.now() / 1000),
          isMock: true,
        };
        return jsonResponse(res, 200, mockOrder);
      }

      // API: Verify Razorpay Payment Signature
      if (pathname === "/api/razorpay/verify-payment" && req.method === "POST") {
        const body = await readBody(req);
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

        if (!razorpay_order_id || !razorpay_payment_id) {
          return jsonResponse(res, 400, { error: "Missing required payment fields" });
        }

        if (RAZORPAY_KEY_SECRET && RAZORPAY_KEY_SECRET !== "placeholder_secret") {
          const generatedSignature = crypto
            .createHmac("sha256", RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest("hex");

          if (generatedSignature !== razorpay_signature) {
            return jsonResponse(res, 400, {
              success: false,
              error: "Invalid payment signature verification failed",
            });
          }
        }

        return jsonResponse(res, 200, {
          success: true,
          message: "Payment signature verified successfully",
          orderId: razorpay_order_id,
          paymentId: razorpay_payment_id,
        });
      }

      // Static files serving
      let target = path.resolve(root, "." + pathname);
      if (target !== root && !target.startsWith(root + path.sep)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
      if ((await stat(target)).isDirectory()) {
        target = path.join(target, "index.html");
      }
      const data = await readFile(target);
      res.writeHead(200, {
        "Content-Type":
          types[path.extname(target)] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(data);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
    }
  })
  .listen(port, "127.0.0.1", () =>
    console.log(`Kaushik Nursery preview running at: http://127.0.0.1:${port}`)
  );
