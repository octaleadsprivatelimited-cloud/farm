import { requireAuth } from "../auth.js";
import {
  obj,
  str,
  integer,
  pagination,
  idempotencyHeaders,
} from "../schema.js";
import { createOrder, getOrder, listOrders, cancelOrder } from "../orders.js";
export async function orderRoutes(app) {
  const auth = { preHandler: requireAuth };
  app.post(
    "/api/orders",
    {
      ...auth,
      schema: {
        headers: idempotencyHeaders,
        body: obj({
          addressId: str(36),
          items: {
            type: "array",
            minItems: 1,
            maxItems: 50,
            items: obj({ id: str(36), qty: integer(1, 99) }),
          },
        }),
      },
    },
    async (req, reply) => {
      const o = await createOrder(
        app,
        req.user.id,
        req.body,
        req.headers["idempotency-key"],
      );
      reply.code(201);
      return o;
    },
  );
  app.get(
    "/api/orders",
    { ...auth, schema: { querystring: pagination } },
    (req) => listOrders(app.db, req.user.id, req.query),
  );
  app.get("/api/orders/:id", auth, (req) =>
    getOrder(app.db, req.params.id, req.user.id),
  );
  app.post("/api/orders/:id/cancel", auth, (req) =>
    cancelOrder(app, req.params.id, req.user),
  );
}
