/** Explicit caller scope and operation-owned CLI SDK/graph resources. */
import { Cortex, createAuthContext, type CortexConfig, type GraphAdapter, type ErasureGraphParticipant } from "@cortexmemory/sdk";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { credentialSource } from "./host-auth.js";
import type { CLIConfig, GlobalOptions } from "../types.js";
import { lstat } from "fs/promises";
import { join } from "path";
import { resolveConfig } from "./config.js";
import { printInfo } from "./formatting.js";
import { initializeKeyedHttpTransport } from "./client-http.js";

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

export type ClientOptions = GlobalOptions & { maintenance?: boolean };
type Handle = { client: Cortex; adapter?: GraphAdapter; participant?: ErasureGraphParticipant; disposal?: Promise<void> };
const owned = new Set<Handle>();
const handles = new WeakMap<Cortex, Handle>();

/** A referenced timer prevents unresolved official close promises from exiting as success. */
async function awaitCleanup(cleanup: () => Promise<unknown>): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([Promise.resolve().then(cleanup), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Required resource cleanup remains unconfirmed")), 5000);
    })]);
  } finally { clearTimeout(timer); }
}

export function validateClientScope(options: ClientOptions): void {
  for (const [name, value] of [["scope-user", options.scopeUser], ["tenant", options.tenant]] as const)
    if (value !== undefined && (typeof value !== "string" || !value.trim())) throw new Error(`--${name} must be nonempty`);
  if (options.graphSync !== undefined && !["auto", "off", "required"].includes(options.graphSync))
    throw new Error("--graph-sync must be auto, off or required");
  if (options.tenant !== undefined && options.scopeUser === undefined && !options.maintenance)
    throw new Error("Ordinary --tenant requires an explicit --scope-user; target/filter IDs and deployment keys do not identify the caller");
}

async function selectedGraph(config: CLIConfig, options: ClientOptions): Promise<{ adapter?: GraphAdapter; password?: string }> {
  const mode = options.graphSync ?? "auto";
  if (mode === "off") return {};
  const projectPath = config.deployments[options.deployment ?? config.default]?.projectPath;
  if (!projectPath) {
    if (mode === "required") throw new Error("Graph required: the selected deployment has no explicit project graph configuration");
    return {};
  }
  try { await lstat(join(projectPath, ".cortex", "graph")); }
  catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      if (mode === "required") throw new Error("Graph required: configure the selected project's graph connection first", { cause: error });
      return {};
    }
    throw error;
  }
  const { readSelectedGraphConfiguration } = await import("./graph/service.js");
  const selection = await readSelectedGraphConfiguration(projectPath);
  const sdk = await import("@cortexmemory/sdk");
  const connection = sdk.resolveGraphConnection({ enabled: true, connection: {
    type: selection.provider, uri: selection.uri, username: selection.credentials.username, password: selection.credentials.password,
  } }, {});
  if (!connection) throw new Error("Selected graph connection is unavailable");
  const adapter = new sdk.CypherGraphAdapter();
  const disconnect = adapter.disconnect.bind(adapter);
  let disconnection: Promise<void> | undefined;
  adapter.disconnect = () => disconnection ??= Promise.resolve().then(disconnect);
  try {
    await adapter.connect({ ...connection, connectionTimeout: 30000 });
    await sdk.assertManagedGraphCompatibility(adapter);
    return { adapter, password: selection.credentials.password };
  } catch {
    try { await awaitCleanup(() => adapter.disconnect()); } catch { console.error("Graph cleanup failed after connection/preflight refusal"); }
    throw new Error("Selected graph connection/schema preflight failed; verify the selected project's credentials and managed graph compatibility. No command operation was started.");
  }
}

async function createOperatorClient(config: CLIConfig, options: ClientOptions): Promise<Cortex> {
  validateClientScope(options);
  const resolved = resolveConfig(config, options);
  const auth = options.scopeUser === undefined ? undefined : createAuthContext({ userId: options.scopeUser, ...(options.tenant === undefined ? {} : { tenantId: options.tenant }) });
  const graph = await selectedGraph(config, options);
  const secrets = [resolved.key, graph.password].filter((value): value is string => Boolean(value));
  const diagnostic = (...args: unknown[]): void => {
    let message = args.map(value => typeof value === "string" ? value : JSON.stringify(value)).join(" ");
    for (const secret of secrets) message = message.split(secret).join("***");
    printInfo(message);
  };
  const clientConfig: CortexConfig = {
    convexUrl: resolved.url,
    resilience: { enabled: false },
    ...(auth === undefined ? {} : { auth }),
    ...(graph.adapter ? { graph: { adapter: graph.adapter, autoSync: false } } : {}), graphEnabled: false,
    convexLogger: { log: diagnostic, warn: diagnostic, error: diagnostic, logVerbose: (...args: unknown[]) => { if (resolved.debug) diagnostic(...args); } },
  };
  let client: Cortex | undefined, keyedTransportInitialized = false, constructorDrain: Promise<void> | undefined;
  try {
    // The SDK constructor has two ambient opt-in gates and no disabled config value.
    // Mask only those gates across synchronous construction; no await occurs while masked.
    const automationFlags = ["CORTEX_FACT_EXTRACTION", "CORTEX_EMBEDDING"] as const;
    const prior = automationFlags.map(name => process.env[name]);
    try {
      for (const name of automationFlags) process.env[name] = "false";
      client = new Cortex(clientConfig, { ...(resolved.key ? { deploymentOperator: true } : {}), initializeTransport: transport => {
      // Observe exactly the same close promise, including SDK-constructor failure cleanup.
      const originalClose = transport.close.bind(transport);
      transport.close = () => constructorDrain ??= Promise.resolve().then(originalClose);
      if (resolved.key) {
        initializeKeyedHttpTransport(transport, resolved.url, resolved.key, clientConfig.convexLogger);
        keyedTransportInitialized = true;
      }
    } });
    } finally {
      automationFlags.forEach((name, index) => { if (prior[index] === undefined) delete process.env[name]; else process.env[name] = prior[index]; });
    }
    if (resolved.key && !keyedTransportInitialized)
      throw new Error("Installed Cortex SDK does not support synchronous keyed transport initialization; use the supported CLI dependency");
    if (typeof client.shutdown !== "function") throw new Error("Installed Cortex SDK does not support awaited shutdown; use the supported CLI dependency");
    const handle = { client, adapter: graph.adapter };
    handles.set(client, handle); owned.add(handle);
    return client;
  } catch (error) {
    try {
      if (client) { if (typeof client.shutdown === "function") await awaitCleanup(() => client!.shutdown()); else await awaitCleanup(() => Promise.resolve(client!.close())); }
      else if (constructorDrain) await awaitCleanup(() => constructorDrain!);
    } catch { console.error("Client cleanup failed after construction refusal"); }
    if (graph.adapter) try { await awaitCleanup(() => graph.adapter!.disconnect()); } catch { console.error("Graph cleanup failed after construction refusal"); }
    throw error;
  }
}

async function createPublicClient(config: CLIConfig, options: ClientOptions): Promise<Cortex> {
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
  let client: Cortex;
  const automationFlags = ["CORTEX_FACT_EXTRACTION", "CORTEX_EMBEDDING"] as const;
  const prior = automationFlags.map(name => process.env[name]);
  try {
    for (const name of automationFlags) process.env[name] = "false";
    client = new Cortex({ convexUrl: resolved.url, fetchAuthToken: refresh, graphEnabled: false, resilience: { enabled: false }, auth: { userId: session.userId, tenantId: session.tenantId, authMethod: "jwt" } });
  } finally {
    automationFlags.forEach((name, index) => { if (prior[index] === undefined) delete process.env[name]; else process.env[name] = prior[index]; });
  }
  const handle: Handle = { client };
  handles.set(client, handle); owned.add(handle);
  const verify = async () => { const current = await refresh({ forceRefreshToken: true }); if (!current) throw new Error("UNAUTHENTICATED"); };
  try { bindings.set(client, verify); fenceRpcDelivery(client, verify); }
  catch (error) { await disposeClient(client); throw error; }
  return client;
}

export async function createClient(config: CLIConfig, options: ClientOptions): Promise<Cortex> {
  const combined = { ...selectedOptions, ...options };
  validateClientScope(combined);
  const resolved = resolveConfig(config, combined);
  // Explicit host credentials select JWT mode even when an operator key is configured.
  // Missing/rejected tokens are terminal; caller labels are never credentials.
  const publicMode = combined.fetchAuthToken !== undefined || resolved.tokenEnv !== undefined || resolved.tokenFile !== undefined || Object.prototype.hasOwnProperty.call(process.env, "CORTEX_AUTH_TOKEN");
  if (publicMode || !resolved.key) return createPublicClient(config, combined);
  return createOperatorClient(config, combined);
}

/** The handle owns the fixed copied-data disposal transport alongside its borrowed adapter. */
export async function getErasureGraphParticipant(client: Cortex, target: { url: string; deploymentKey: string }): Promise<ErasureGraphParticipant | undefined> {
  const handle = handles.get(client);
  if (!handle?.adapter) return undefined;
  if (!handle.participant) {
    const { createGraphErasureTransport } = await import("@cortexmemory/sdk");
    handle.participant = { adapter: handle.adapter, disposalTransport: createGraphErasureTransport(target) };
  }
  return handle.participant;
}

export function disposeClient(client: Cortex): Promise<void> {
  const handle = handles.get(client);
  if (!handle) return Promise.reject(new Error("CLI client has no owned disposal handle"));
  if (!handle.disposal) handle.disposal = (async () => {
    let failed = false;
    try {
      try { handle.participant?.disposalTransport.close(); } catch { failed = true; }
      try { await awaitCleanup(() => client.shutdown()); } catch { failed = true; }
      try { if (handle.adapter) await awaitCleanup(() => handle.adapter!.disconnect()); } catch { failed = true; }
      if (failed) throw new Error("CLI client/graph cleanup failed; required resource cleanup was not confirmed");
    } finally { bindings.delete(client); owned.delete(handle); }
  })();
  return handle.disposal;
}

export async function closeClient(client?: Cortex): Promise<void> {
  if (client) { await disposeClient(client); return; }
  const results = await Promise.allSettled([...owned].map(handle => disposeClient(handle.client)));
  if (results.some(result => result.status === "rejected")) throw new Error("CLI resource drain failed; required cleanup was not confirmed");
}

/** Convex 1.46 runtime supports this internal admin-auth method although its public
 * declaration omits it. Keep the compatibility boundary here and fail closed.
 * A deployment key grants deployment administration; it is never a tenant JWT.
 */
export function applyDeploymentKey(client: Cortex, key: string): void {
  const transport: unknown = client.getClient();
  if (
    !transport ||
    typeof transport !== "object" ||
    !("setAdminAuth" in transport) ||
    typeof transport.setAdminAuth !== "function"
  ) {
    throw new Error(
      "Installed Convex client does not support deployment-key admin authentication; use the pinned supported CLI dependency",
    );
  }
  try {
    transport.setAdminAuth(key);
  } catch {
    throw new Error(
      "Could not apply deployment credentials; verify deployment-key capability and credentials",
    );
  }
}

/** Read-only admission deadline; admitted operations have no imposed deadline/retry. */
async function checkClientAccess(client: Cortex, timeout: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([client.memorySpaces.list({ limit: 1 }), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Connection timed out")), timeout); })]);
  } finally { clearTimeout(timer); }
}

export async function testConnection(config: CLIConfig, options: ClientOptions, timeout = 3000): Promise<{ connected: boolean; url: string; error?: string; latency?: number }> {
  const resolved = resolveConfig(config, options);
  if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > 60000) throw new Error("Connection timeout must be an integer from 1 to 60000 ms");
  let client: Cortex | undefined;
  const started = Date.now();
  let observation: { connected: boolean; url: string; error?: string; latency?: number };
  try {
    client = await createClient(config, options);
    await checkClientAccess(client, timeout);
    observation = { connected: true, url: resolved.url, latency: Date.now() - started };
  } catch { observation = { connected: false, url: resolved.url, error: "Connection/access failed; verify URL, deployment key and tenant access separately" }; }
  if (client) {
    try { await disposeClient(client); }
    catch { return { connected: false, url: resolved.url, error: "Connection/access observation failed: required client/graph cleanup remains unconfirmed" }; }
  }
  return observation;
}

/**
 * Get deployment info
 */
export function getDeploymentInfo(
  config: CLIConfig,
  options: GlobalOptions,
): {
  url: string;
  deployment?: string;
  hasKey: boolean;
  isLocal: boolean;
} {
  const resolved = resolveConfig(config, options);

  return {
    url: resolved.url,
    deployment: resolved.deployment,
    hasKey: Boolean(resolved.key),
    isLocal: ["localhost", "127.0.0.1", "[::1]"].includes(
      new URL(resolved.url).hostname,
    ),
  };
}

export async function withClient<T>(config: CLIConfig, options: ClientOptions, operation: (client: Cortex) => Promise<T>): Promise<T> {
  const client = await createClient(config, options);
  let result: T;
  try {
    try { const verify = bindings.get(client); if (verify) await verify(); else await checkClientAccess(client, 3000); }
    catch { throw new Error("Connection/access check failed; verify the selected deployment URL, deployment key and access. No command operation was started."); }
    result = await operation(client);
    await bindings.get(client)?.();
  } catch (error) {
    try { await disposeClient(client); }
    catch { console.error("CLI resource cleanup failed after the operation error"); }
    throw error;
  }
  await disposeClient(client);
  return result;
}

let cleanupRegistered = false;
let foregroundSignalHandler: ((signal: "SIGINT" | "SIGTERM") => Promise<void>) | null = null;
let signalDrain: Promise<void> | undefined;
export function setupClientCleanup(): void {
  if (cleanupRegistered) return;
  cleanupRegistered = true;
  process.on("exit", () => {
    // Async cleanup is awaited on normal/error/signal paths. Exit is best-effort only.
    for (const handle of owned) { try { handle.client.close(); } catch { /* No diagnostics after exit. */ } }
  });
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => {
    if (signalDrain) return;
    process.exitCode = signal === "SIGINT" ? 130 : 143;
    signalDrain = (async () => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const drain = (async () => {
          let failed = false;
          try { await foregroundSignalHandler?.(signal); } catch { failed = true; }
          try { await closeClient(); } catch { failed = true; }
          if (failed) throw new Error("Owned signal cleanup failed");
        })();
        await Promise.race([drain, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Owned signal cleanup timed out")), 30000); })]);
      } catch { console.error("Owned command/native cleanup failed or remains incomplete"); process.exitCode = 1; }
      finally { clearTimeout(timer); }
    })();
    void signalDrain.then(() => { signalDrain = undefined; });
  });
}
export function acquireForegroundSignalHandler(handler: (signal: "SIGINT" | "SIGTERM") => Promise<void>): () => void {
  if (foregroundSignalHandler) throw new Error("A foreground native operation is already active");
  foregroundSignalHandler = handler;
  return () => { if (foregroundSignalHandler === handler) foregroundSignalHandler = null; };
}
