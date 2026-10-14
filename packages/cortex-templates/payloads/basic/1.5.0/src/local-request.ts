import type { MiddlewareHandler } from "hono";

/** Local trusted SDK operations accept direct clients and this server's browser origin. */
export const localRequest: MiddlewareHandler = async (context, next) => {
  const origin = context.req.header("origin");
  const target = new URL(context.req.url);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname);
  if (origin && (!loopback || origin !== target.origin))
    return context.json({ error: "Cross-origin requests are not allowed" }, 403);
  return next();
};
