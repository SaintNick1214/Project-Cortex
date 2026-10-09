/** Per-operation verified host identity. URL-only/shared-principal client caching is forbidden. */
import { Cortex } from "@cortexmemory/sdk";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import type { CLIConfig, GlobalOptions } from "../types.js";
import { resolveConfig } from "./config.js";
import { credentialSource } from "./host-auth.js";

const clients = new Set<Cortex>();
let selectedOptions: GlobalOptions = {};
/** Process-global selectors/credential locations only, never token values or client identity. */
export function configureClientOptions(options: GlobalOptions): void {
  selectedOptions = { tokenEnv: options.tokenEnv, tokenFile: options.tokenFile, tenantId: options.tenantId, memorySpaceId: options.memorySpaceId };
}
interface Session { version: 1; tenantId: string; memorySpaceId: string; principalId: string; userId: string; deliveryExpiresAt?: number }
const sessionRef = makeFunctionReference<"mutation">("runtimeClient:session");
async function verifiedSession(url: string, token: string, scope: { tenantId?: string; memorySpaceId?: string }): Promise<Session> {
  const http = new ConvexHttpClient(url); http.setAuth(token);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result: unknown = await Promise.race([http.mutation(sessionRef, scope), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("AUTH_SESSION_TIMEOUT")), 12000); })]);
    if (!result || typeof result !== "object") throw new Error("INVALID_SESSION");
    const row = result as Record<string, unknown>;
    if (row.version !== 1 || ["tenantId", "memorySpaceId", "principalId", "userId"].some(key => typeof row[key] !== "string" || !row[key] || (row[key] as string).length > 256) || scope.tenantId && row.tenantId !== scope.tenantId || scope.memorySpaceId && row.memorySpaceId !== scope.memorySpaceId) throw new Error("INVALID_SESSION");
    if (row.deliveryExpiresAt !== undefined && (typeof row.deliveryExpiresAt !== "number" || !Number.isFinite(row.deliveryExpiresAt) || row.deliveryExpiresAt <= Date.now())) throw new Error("AUTH_SESSION_EXPIRED");
    return { version: 1, tenantId: row.tenantId as string, memorySpaceId: row.memorySpaceId as string, principalId: row.principalId as string, userId: row.userId as string, ...(row.deliveryExpiresAt === undefined ? {} : { deliveryExpiresAt: row.deliveryExpiresAt as number }) };
  } finally { clearTimeout(timer); }
}
function sameSession(a: Session, b: Session): boolean { return a.principalId === b.principalId && a.tenantId === b.tenantId && a.memorySpaceId === b.memorySpaceId && a.userId === b.userId; }
const bindings = new WeakMap<Cortex, () => Promise<void>>();
/** Inspect only server delivery metadata, never JWT claims or model/provider values. */
function assertDeliveryDeadline(value: unknown): void {
  const todo: unknown[] = [value]; let visited = 0;
  while (todo.length) {
    const row = todo.pop(); if (!row || typeof row !== "object") continue;
    if (++visited > 20000) throw new Error("CLI_DELIVERY_TOO_LARGE");
    if ("deliveryExpiresAt" in row && row.deliveryExpiresAt !== undefined && (typeof row.deliveryExpiresAt !== "number" || !Number.isFinite(row.deliveryExpiresAt) || row.deliveryExpiresAt <= Date.now())) throw new Error("AUTH_DELIVERY_EXPIRED");
    // User metadata/content can contain identically named fields; it is not a delivery lease.
    if (Array.isArray(row)) todo.push(...row);
    else for (const key of ["items", "conversations", "facts", "memories", "users", "spaces", "versions", "history", "parts"]) {
      const collection = (row as Record<string, unknown>)[key]; if (Array.isArray(collection)) todo.push(...collection);
    }
  }
}
function fenceRpcDelivery(client: Cortex, verify: () => Promise<void>): void {
  const port = client.getClient();
  const query = port.query.bind(port), mutation = port.mutation.bind(port), action = port.action.bind(port);
  port.query = (async (...args: Parameters<typeof port.query>) => { await verify(); const result = await query(...args); await verify(); assertDeliveryDeadline(result); return result; }) as typeof port.query;
  port.mutation = (async (...args: Parameters<typeof port.mutation>) => { await verify(); const result = await mutation(...args); await verify(); assertDeliveryDeadline(result); return result; }) as typeof port.mutation;
  port.action = (async (...args: Parameters<typeof port.action>) => { await verify(); const result = await action(...args); await verify(); assertDeliveryDeadline(result); return result; }) as typeof port.action;
}
export async function createClient(config: CLIConfig, options: GlobalOptions): Promise<Cortex> {
  const combined = { ...selectedOptions, ...options }, resolved = resolveConfig(config, combined);
  const fetchToken = credentialSource({ tokenEnv: resolved.tokenEnv, tokenFile: resolved.tokenFile, fetchAuthToken: combined.fetchAuthToken });
  const token = await fetchToken({ forceRefreshToken: true }); if (!token) throw new Error("UNAUTHENTICATED");
  const scope = { ...(resolved.tenantId ? { tenantId: resolved.tenantId } : {}), ...(resolved.memorySpaceId ? { memorySpaceId: resolved.memorySpaceId } : {}) };
  const session = await verifiedSession(resolved.url, token, scope);
  const refresh = async (request: { forceRefreshToken: boolean }): Promise<string | null> => {
    const current = await fetchToken(request); if (!current) return null;
    if (!sameSession(session, await verifiedSession(resolved.url, current, scope))) throw new Error("AUTH_SESSION_CHANGED");
    return current;
  };
  // An error after a committed effect is delivery uncertainty, never permission
  // to redispatch a versioned mutation through the SDK retry layer.
  const client = new Cortex({ convexUrl: resolved.url, fetchAuthToken: refresh, resilience: { enabled: false }, auth: { userId: session.userId, tenantId: session.tenantId, authMethod: "jwt" } });
  clients.add(client);
  const verify = async () => { const current = await refresh({ forceRefreshToken: true }); if (!current) throw new Error("UNAUTHENTICATED"); };
  bindings.set(client, verify); fenceRpcDelivery(client, verify);
  return client;
}
export function closeClient(client?: Cortex): void {
  for (const owned of client ? [client] : [...clients]) { if (clients.delete(owned)) { bindings.delete(owned); owned.close(); } }
}
export async function withClient<T>(config: CLIConfig, options: GlobalOptions, operation: (client: Cortex) => Promise<T>): Promise<T> {
  const client = await createClient(config, options);
  try { const result = await operation(client); await bindings.get(client)!(); return result; }
  finally { closeClient(client); }
}
export async function testConnection(config: CLIConfig, options: GlobalOptions): Promise<{ connected: boolean; url: string; error?: string; latency?: number }> {
  const resolved = resolveConfig(config, options), start = Date.now();
  try { await withClient(config, options, async () => undefined); return { connected: true, url: resolved.url, latency: Date.now() - start }; }
  catch { return { connected: false, url: resolved.url, error: "Verified host JWT/session unavailable. Renew the token and confirm current scope grants; deployment configuration was preserved." }; }
}
export function getDeploymentInfo(config: CLIConfig, options: GlobalOptions): { url: string; deployment?: string; hasKey: boolean; isLocal: boolean } {
  const resolved = resolveConfig(config, options); return { url: resolved.url, deployment: resolved.deployment, hasKey: Boolean(resolved.key), isLocal: resolved.url.includes("localhost") || resolved.url.includes("127.0.0.1") };
}
export function setupClientCleanup(): void {
  process.on("exit", () => closeClient());
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => { closeClient(); process.exit(0); });
}
