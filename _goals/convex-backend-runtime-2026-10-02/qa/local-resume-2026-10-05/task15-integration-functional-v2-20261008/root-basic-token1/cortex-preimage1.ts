/** One verified, bounded connection per CLI command or HTTP request. */
import { open } from "node:fs/promises";
import { CortexRuntimeClient, CortexRuntimeError } from "@cortexmemory/sdk/runtime";
import type { CortexRuntimeClientOptions, RuntimeSession } from "@cortexmemory/sdk/runtime";
export { CortexRuntimeError };
export type RuntimeClient = Pick<CortexRuntimeClient, "session" | "submit" | "start" | "attach" | "get" | "observe" | "watchObservation" | "cancel" | "approveInput" | "approveTool" | "messages" | "listConversations" | "getDefaultProfile" | "memoryReadiness" | "recall" | "close">;
export type RuntimeFactory = (options: CortexRuntimeClientOptions) => RuntimeClient;
export interface RuntimeConfig { deploymentUrl: string; tenantId?: string; memorySpaceId?: string; agentId: string; agentVersion: number; timeoutMs: number }
export class AppError extends Error { constructor(readonly code: string, readonly status: 400 | 401 | 403 | 413 | 499 | 504 = 400) { super(code); } }
export function identifier(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 256 || /[\x00-\x1f]/.test(value)) throw new AppError("INVALID_INPUT");
  return value;
}
export function runtimeConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  let url: URL; try { url = new URL(env.CONVEX_URL ?? env.NEXT_PUBLIC_CONVEX_URL ?? ""); } catch { throw new AppError("CONVEX_URL_REQUIRED"); }
  if (url.username || url.password || url.search || url.hash || !(url.protocol === "https:" || url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) throw new AppError("INVALID_CONVEX_URL");
  const version = Number(env.AGENT_VERSION ?? env.NEXT_PUBLIC_CORTEX_AGENT_VERSION ?? "1"), timeoutMs = Number(env.RUNTIME_TIMEOUT_MS ?? "30000");
  if (!Number.isSafeInteger(version) || version < 1 || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000) throw new AppError("INVALID_RUNTIME_CONFIG");
  const memorySpaceId = env.MEMORY_SPACE_ID ?? env.NEXT_PUBLIC_CORTEX_MEMORY_SPACE_ID;
  return { deploymentUrl: url.href.replace(/\/$/, ""), agentId: identifier(env.AGENT_ID ?? env.NEXT_PUBLIC_CORTEX_AGENT_ID ?? "basic-assistant"), agentVersion: version, timeoutMs,
    ...(env.TENANT_ID ? { tenantId: identifier(env.TENANT_ID) } : {}), ...(memorySpaceId ? { memorySpaceId: identifier(memorySpaceId) } : {}) };
}
export function bearer(header: string | undefined): string {
  const match = /^Bearer ([^\s]{1,32768})$/i.exec(header ?? ""); if (!match) throw new AppError("UNAUTHENTICATED", 401); return match[1];
}
export async function hostToken(env: NodeJS.ProcessEnv = process.env): Promise<string> {
  // Reread the host-managed file for every official refresh callback. Never print tokens.
  let token = env.CORTEX_AUTH_TOKEN;
  if (env.CORTEX_AUTH_TOKEN_FILE) {
    const file = await open(env.CORTEX_AUTH_TOKEN_FILE, "r").catch(() => { throw new AppError("HOST_TOKEN_UNAVAILABLE", 401); });
    try {
      const stat = await file.stat(); if (!stat.isFile() || stat.size > 32768) throw new AppError("INVALID_HOST_TOKEN", 401);
      const data = Buffer.alloc(32769); let size = 0;
      while (size < data.length) { const result = await file.read(data, size, data.length - size, size); if (result.bytesRead === 0) break; size += result.bytesRead; }
      if (size > 32768) throw new AppError("INVALID_HOST_TOKEN", 401); token = data.subarray(0, size).toString("utf8").trim();
    } finally { await file.close(); }
  }
  return bearer(token ? `Bearer ${token}` : undefined);
}
export function sameSession(a: RuntimeSession, b: RuntimeSession): boolean { return a.principalId === b.principalId && a.tenantId === b.tenantId && a.memorySpaceId === b.memorySpaceId; }
export async function withRuntime<T>(fetchToken: CortexRuntimeClientOptions["fetchToken"], work: (client: RuntimeClient, config: RuntimeConfig) => Promise<T>,
  options: { config?: RuntimeConfig; factory?: RuntimeFactory; signal?: AbortSignal } = {}): Promise<T> {
  const config = options.config ?? runtimeConfig();
  if (options.signal?.aborted) throw new AppError("REQUEST_ABORTED", 499);
  const client = (options.factory ?? (settings => new CortexRuntimeClient(settings)))({ deploymentUrl: config.deploymentUrl, fetchToken,
    scope: { ...(config.tenantId ? { tenantId: config.tenantId } : {}), ...(config.memorySpaceId ? { memorySpaceId: config.memorySpaceId } : {}) },
    authTimeoutMs: Math.min(config.timeoutMs, 10000), requestTimeoutMs: Math.min(config.timeoutMs, 12000) });
  let closed = false, timer: ReturnType<typeof setTimeout> | undefined, rejectBound: (error: Error) => void = () => {};
  const close = () => { if (!closed) { closed = true; client.close(); } };
  const abort = () => { close(); rejectBound(new AppError("REQUEST_ABORTED", 499)); };
  const bound = new Promise<never>((_, reject) => { rejectBound = reject; timer = setTimeout(() => { close(); reject(new AppError("REQUEST_DEADLINE_EXCEEDED", 504)); }, config.timeoutMs); });
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) abort();
  const operation = (async () => {
    if (options.signal?.aborted) throw new AppError("REQUEST_ABORTED", 499);
    const before = await client.session(), result = await work(client, config), after = await client.session();
    if (!sameSession(before, after)) throw new AppError("SESSION_CHANGED", 403);
    for (const deadline of [before.deliveryExpiresAt, after.deliveryExpiresAt]) if (deadline !== undefined && Date.now() >= deadline) throw new AppError("AUTHORITY_EXPIRED", 403);
    return result;
  })();
  try { return await Promise.race([operation, bound]); }
  finally { clearTimeout(timer); options.signal?.removeEventListener("abort", abort); close(); }
}
// Retained display utilities consume server-confirmed statuses only. They do not execute inference.
export type OrchestrationPhase = "recall" | "remember";
export interface LayerEvent { layer: "memorySpace" | "user" | "agent" | "context" | "conversation" | "vector" | "facts" | "graph"; status: "pending" | "in_progress" | "complete" | "error" | "skipped"; timestamp: number; latencyMs?: number; phase: OrchestrationPhase; data?: Record<string, unknown>; error?: { message: string; code?: string }; revisionAction?: "ADD" | "UPDATE" | "SUPERSEDE" | "NONE"; supersededFacts?: string[] }
