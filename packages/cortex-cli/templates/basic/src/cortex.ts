/** Fresh bounded session checks; interactive CLI may retain its owned transport. */
import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { CortexRuntimeClient, CortexRuntimeError } from "@cortexmemory/sdk/runtime";
import type { CortexRuntimeClientOptions, RuntimeSession } from "@cortexmemory/sdk/runtime";
export { CortexRuntimeError };
export type RuntimeClient = Pick<CortexRuntimeClient, "session" | "submit" | "submitAndStart" | "start" | "attach" | "get" | "observe" | "watchObservation" | "cancel" | "approveInput" | "approveTool" | "messages" | "listConversations" | "getDefaultProfile" | "memoryReadiness" | "recall" | "close">;
export type RuntimeFactory = (options: CortexRuntimeClientOptions) => RuntimeClient;
export interface RuntimeConfig { deploymentUrl: string; tenantId?: string; memorySpaceId?: string; agentId: string; agentVersion: number; timeoutMs: number }
export class AppError extends Error { constructor(readonly code: string, readonly status: 400 | 401 | 403 | 413 | 499 | 504 = 400) { super(code); } }
export function identifier(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 256 || [...value].some(character => character.charCodeAt(0) < 32)) throw new AppError("INVALID_INPUT");
  return value;
}
export function runtimeConfig(env: Readonly<Record<string, string | undefined>> = process.env): RuntimeConfig {
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
export async function hostToken(env: Readonly<Record<string, string | undefined>> = process.env): Promise<string> {
  // Reread the host-managed file for every official refresh callback. Never print tokens.
  let token = env.CORTEX_AUTH_TOKEN;
  if (env.CORTEX_AUTH_TOKEN_FILE) {
    const file = await open(env.CORTEX_AUTH_TOKEN_FILE, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK).catch(() => { throw new AppError("HOST_TOKEN_UNAVAILABLE", 401); });
    try {
      const stat = await file.stat(); if (!stat.isFile() || stat.size > 32768 || (stat.mode & 0o077) !== 0 || typeof process.getuid === "function" && stat.uid !== process.getuid()) throw new AppError("INVALID_HOST_TOKEN", 401);
      const data = Buffer.alloc(32769); let size = 0;
      while (size < data.length) { const result = await file.read(data, size, data.length - size, size); if (result.bytesRead === 0) break; size += result.bytesRead; }
      if (size > 32768) throw new AppError("INVALID_HOST_TOKEN", 401); token = data.subarray(0, size).toString("utf8").trim();
    } finally { await file.close(); }
  }
  return bearer(token ? `Bearer ${token}` : undefined);
}
export function sameSession(a: RuntimeSession, b: RuntimeSession): boolean { return a.principalId === b.principalId && a.tenantId === b.tenantId && a.memorySpaceId === b.memorySpaceId; }
export interface RuntimeConnection { entry?: { client: RuntimeClient; configKey: string; closed: boolean; fetchToken: CortexRuntimeClientOptions["fetchToken"]; factory?: RuntimeFactory }; busy?: boolean }
export function closeRuntimeConnection(connection: RuntimeConnection): void {
  const entry = connection.entry; connection.entry = undefined;
  if (entry && !entry.closed) { entry.closed = true; entry.client.close(); }
}
export async function withRuntime<T>(fetchToken: CortexRuntimeClientOptions["fetchToken"], work: (client: RuntimeClient, config: RuntimeConfig) => Promise<T>,
  options: { config?: RuntimeConfig; factory?: RuntimeFactory; signal?: AbortSignal; connection?: RuntimeConnection } = {}): Promise<T> {
  const config = options.config ?? runtimeConfig();
  if (options.signal?.aborted) { if (options.connection) closeRuntimeConnection(options.connection); throw new AppError("REQUEST_ABORTED", 499); }
  const connection = options.connection;
  if (connection?.busy) throw new AppError("RUNTIME_BUSY");
  const configKey = JSON.stringify([config.deploymentUrl, config.tenantId, config.memorySpaceId, config.agentId, config.agentVersion, config.timeoutMs]);
  if (connection?.entry && (connection.entry.configKey !== configKey || connection.entry.fetchToken !== fetchToken || connection.entry.factory !== options.factory)) { closeRuntimeConnection(connection); throw new AppError("RUNTIME_CONFIGURATION_CHANGED"); }
  const entry = connection?.entry ?? { configKey, closed: false, fetchToken, factory: options.factory, client: (options.factory ?? (settings => new CortexRuntimeClient(settings)))({ deploymentUrl: config.deploymentUrl, fetchToken,
    scope: { ...(config.tenantId ? { tenantId: config.tenantId } : {}), ...(config.memorySpaceId ? { memorySpaceId: config.memorySpaceId } : {}) },
    authTimeoutMs: Math.min(config.timeoutMs, 10000), requestTimeoutMs: config.timeoutMs,
    ...(process.env.CORTEX_RUNTIME_LATENCY_TRACE === "1" ? { onLatencyEvent: event => console.error(JSON.stringify({ type: "cortex-client-latency", ...event })) } : {}) }) };
  if (connection) { connection.entry = entry; connection.busy = true; }
  const client = entry.client;
  let completed = false, timer: ReturnType<typeof setTimeout> | undefined, rejectBound: (error: Error) => void = () => {};
  const close = () => { if (connection?.entry === entry) connection.entry = undefined; if (!entry.closed) { entry.closed = true; client.close(); } };
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
  try { const result = await Promise.race([operation, bound]); completed = true; return result; }
  finally { clearTimeout(timer); options.signal?.removeEventListener("abort", abort); if (connection) connection.busy = false; if (!completed || !connection) close(); }
}
// Retained display utilities consume server-confirmed statuses only. They do not execute inference.
export type OrchestrationPhase = "recall" | "remember";
export interface LayerEvent { layer: "memorySpace" | "user" | "agent" | "context" | "conversation" | "vector" | "facts" | "graph"; status: "pending" | "in_progress" | "complete" | "error" | "skipped"; timestamp: number; latencyMs?: number; phase: OrchestrationPhase; data?: Record<string, unknown>; error?: { message: string; code?: string }; revisionAction?: "ADD" | "UPDATE" | "SUPERSEDE" | "NONE"; supersededFacts?: string[] }
