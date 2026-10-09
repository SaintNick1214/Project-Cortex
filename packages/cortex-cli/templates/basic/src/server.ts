/** Authenticated local HTTP facade. Each request owns and closes its remote client. */
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { pathToFileURL } from "node:url";
import { AppError, CortexRuntimeError, bearer, identifier, runtimeConfig, withRuntime } from "./cortex.js";
import type { RuntimeFactory, RuntimeConfig } from "./cortex.js";
import { chat, message, observe } from "./chat.js";
const BODY_BYTES = 32768;
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > BODY_BYTES)) throw new AppError("BODY_TOO_LARGE", 413);
  if (!request.headers.get("content-type")?.split(";")[0].trim().toLowerCase().endsWith("/json")) throw new AppError("JSON_REQUIRED");
  const reader = request.body?.getReader(); if (!reader) throw new AppError("INVALID_BODY");
  const chunks: Uint8Array[] = []; let size = 0, timer: ReturnType<typeof setTimeout> | undefined;
  const timed = new Promise<never>((_, reject) => { timer = setTimeout(() => { void reader.cancel().catch(() => {}); reject(new AppError("BODY_DEADLINE_EXCEEDED", 504)); }, 5000); });
  const read = (async () => { for (;;) { const next = await reader.read(); if (next.done) break; size += next.value.byteLength;
    if (size > BODY_BYTES) throw new AppError("BODY_TOO_LARGE", 413); chunks.push(next.value); }
    const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    let value: unknown; try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { throw new AppError("INVALID_BODY"); }
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new AppError("INVALID_BODY"); return value as Record<string, unknown>;
  })();
  try { return await Promise.race([read, timed]); } finally { clearTimeout(timer); void reader.cancel().catch(() => {}); }
}
export function createApp(options: { config?: RuntimeConfig; factory?: RuntimeFactory } = {}) {
  const config = options.config ?? runtimeConfig(), app = new Hono();
  app.onError((error, c) => {
    if (error instanceof AppError) return Response.json({ version: 1, code: error.code }, { status: error.status, headers: { "Cache-Control": "no-store" } });
    const code = error instanceof CortexRuntimeError && /^[A-Z0-9_]{1,64}$/.test(error.code) ? error.code : "RUNTIME_UNAVAILABLE";
    return c.json({ version: 1, code }, /UNAUTHENTICATED|AUTH_TOKEN/.test(code) ? 401 : /FORBIDDEN|SESSION_CHANGED|AUTHORITY_EXPIRED/.test(code) ? 403 : /INVALID_/.test(code) ? 400 : 503);
  });
  app.use("*", async (c, next) => { c.header("Cache-Control", "no-store"); await next(); });
  app.get("/health", c => c.json({ version: 1, status: "ok", inferenceOwner: "registered-backend" }));
  app.use("*", async (c, next) => { bearer(c.req.header("Authorization")); await next(); });
  const remote = <T>(request: Request, work: Parameters<typeof withRuntime<T>>[1]) => withRuntime(async () => bearer(request.headers.get("Authorization") ?? undefined), work,
    { config, factory: options.factory, signal: request.signal });
  app.post("/chat", async c => {
    const body = await readJson(c.req.raw), input = { requestId: identifier(body.requestId), message: message(body.message),
      ...(body.conversationId === undefined ? {} : { conversationId: identifier(body.conversationId) }) };
    return c.json(await remote(c.req.raw, client => chat(client, config, input)), 202);
  });
  app.get("/runs/:id", async c => c.json(await remote(c.req.raw, async client => client.get(await client.attach(identifier(c.req.param("id")))))));
  app.get("/runs/:id/observe", async c => c.json(await remote(c.req.raw, client => observe(client, c.req.param("id"), {
    ...(c.req.query("cursor") === undefined ? {} : { cursor: Number(c.req.query("cursor")) }),
    ...(c.req.query("attemptNumber") === undefined ? {} : { attemptNumber: Number(c.req.query("attemptNumber")) }), finalOnly: c.req.query("finalOnly") === "true" }))));
  app.post("/runs/:id/start", async c => c.json(await remote(c.req.raw, async client => client.start(await client.attach(identifier(c.req.param("id"))), { streaming: true }))));
  app.post("/runs/:id/cancel", async c => c.json(await remote(c.req.raw, async client => client.cancel(await client.attach(identifier(c.req.param("id")))))));
  app.post("/runs/:id/approve-input", async c => c.json(await remote(c.req.raw, async client => {
    const handle = await client.attach(identifier(c.req.param("id"))); const run = await client.approveInput(handle); await client.start(handle, { streaming: true }); return run;
  })));
  app.post("/runs/:id/approve-tool", async c => { const body = await readJson(c.req.raw);
    const approval = { operationId: identifier(body.operationId), toolName: identifier(body.toolName), requestHash: identifier(body.requestHash) };
    return c.json(await remote(c.req.raw, async client => client.approveTool(await client.attach(identifier(c.req.param("id"))), approval)));
  });
  app.post("/recall", async c => { const body = await readJson(c.req.raw), input = { requestId: identifier(body.requestId), text: message(body.query), limit: 10 };
    return c.json(await remote(c.req.raw, client => client.recall(input)));
  });
  app.get("/history/:id", async c => c.json(await remote(c.req.raw, client => client.messages(identifier(c.req.param("id")), { cursor: c.req.query("cursor") ?? null, limit: 100 }))));
  app.get("/conversations", async c => c.json(await remote(c.req.raw, client => client.listConversations(100))));
  app.get("/profile", async c => c.json(await remote(c.req.raw, client => client.getDefaultProfile())));
  app.get("/readiness", async c => c.json(await remote(c.req.raw, client => client.memoryReadiness())));
  return app;
}
export function main() {
  const port = Number(process.env.PORT ?? "3001"); if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new AppError("INVALID_PORT");
  const server = serve({ fetch: createApp().fetch, hostname: process.env.HOST ?? "127.0.0.1", port });
  console.log(`Cortex Basic application listening on port ${port}. Backend deployment is managed separately.`);
  const stop = () => { server.close(); if ("closeAllConnections" in server) server.closeAllConnections(); };
  process.once("SIGINT", stop); process.once("SIGTERM", stop); return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch { console.error("Application configuration failed. Check CONVEX_URL and runtime settings."); process.exitCode = 1; }
}
