import { ConvexClient } from "convex/browser";
import type { AuthTokenFetcher } from "convex/browser";
import { getFunctionName, makeFunctionReference } from "convex/server";
import type { RuntimeConversation, RuntimeDefinition, RuntimeEmbeddingProfile, RuntimeObservation, RuntimeRecallResult, RuntimeRun,
  RuntimeRunHandle, RuntimeScope, RuntimeSession, RuntimeToolApproval, RuntimeTranscriptPage, RuntimeOutputCursor, RuntimeAdmissionResult, TextSubmitV1 } from "./types.js";
import type { RuntimeAssetReference, RuntimeAssetVersion } from "./types.js";
import { assetDigest, assetHttpBase, assetHttpError, assetMime, assetFilename, assetRequestId, assetReference, assetVersion, boundedAssetBody, RUNTIME_ASSET_MAX_BYTES } from "./assets.js";
import type { RuntimeAssetIoOptions, RuntimeAssetUploadOptions, RuntimeAssetPreview } from "./assets.js";
import { admissionResult, CortexRuntimeError, deliveryDeadline, identifier, invalid, natural, object, observation, run, runtimeError, sameScope, session, textSubmit } from "./validation.js";
import { embeddingProfileOptions, memoryReadiness, readinessOptions, runtimeArtifact, runtimeEmbeddingProfile } from "./extensions.js";
import type { RuntimeMemoryReadiness, RuntimeMemoryReadinessOptions } from "./types.js";
import type { RuntimeArtifact, RuntimeMediaJob, RuntimeMediaSubmit } from "./types.js";
import { mediaJob, mediaJobList, mediaListOptions, mediaSubmit } from "./media.js";
import { contentJob, contentJobList, contentListOptions, contentSubmit, contentSuggestionInput } from "./content.js";
import {rememberInput,rememberResult} from './remember.js';
import type {RuntimeRememberInput,RuntimeRememberResult} from './types.js';
import type { ContentSubmitV1, RuntimeContentJobV1 } from "../domain/content.js";
import { probeAuthenticationDenial } from "./authentication-denial.js";

export type RuntimeClientPort = Pick<ConvexClient, "setAuth" | "query" | "mutation" | "action" | "onUpdate" | "close">;
/** Metadata only, timed with this client's monotonic clock. RPC end/failed describe
 * the official port promise; a local deadline may already have suppressed delivery. */
export interface RuntimeLatencyEvent {
  readonly version: 1;
  readonly phase: "rpc.begin" | "rpc.end" | "rpc.failed" | "auth.begin" | "auth.ready" | "auth.denied" | "watcher.wake";
  readonly atMs: number; readonly rpcId?: number; readonly method?: string; readonly durationMs?: number;
}
export interface CortexRuntimeClientOptions {
  deploymentUrl: string; fetchToken: AuthTokenFetcher; scope?: Partial<RuntimeScope>;
  /** Explicit owned HTTP-action origin. Tokens are never forwarded to redirects or storage URLs. */
  assetHttpUrl?: string;
  /** Standard HTTP port for assets and the denial-only auth check. Supplying this
   * also enables that check for a custom borrowed transport. Owned/official
   * clients use standard fetch by default; HTTP success grants no authority. */
  fetch?: typeof globalThis.fetch;
  onAuthChange?: (authenticated: boolean) => void;
  /** Optional scalar diagnostics. No arguments, results, credentials or error data are emitted. */
  onLatencyEvent?: (event: RuntimeLatencyEvent) => void;
  /** Bound the official authentication handshake, including providers that never notify rejection. Default 10 seconds. */
  authTimeoutMs?: number;
  /** Bound RPC observation without cancelling or retrying a server mutation. Default 12 seconds. */
  requestTimeoutMs?: number;
  /** An existing official client can be shared; close() then leaves its ownership with the caller. */
  client?: RuntimeClientPort;
}
const query = (name: string) => makeFunctionReference<"query", Record<string, unknown>, unknown>(name);
const mutation = (name: string) => makeFunctionReference<"mutation", Record<string, unknown>, unknown>(name);
const action = (name: string) => makeFunctionReference<"action", Record<string, unknown>, unknown>(name);
const refs = { session: mutation("runtimeClient:session"), signal: query("runtimeClient:signal"), submit: mutation("runs:submit"), submitAndStart: mutation("runtimeClient:submitAndStartEnvelope"), get: mutation("runs:get"), start: mutation("runtimeAgent:start"),
  observe: mutation("runtimeClient:observeEnvelope"), cancel: mutation("runtimeAgent:cancel"), approve: mutation("runs:approve"), tool: mutation("runtimeAgent:approveTool"),
  definition: mutation("agentDefinitions:get"), messages: mutation("runtimeTranscript:messages"), conversations: mutation("runtimeTranscript:list"),
  profile: mutation("runtimeMemory:defaultProfile"), recall: action("runtimeMemory:recall"), asset: mutation("runtimeAssets:get"),
  remember:mutation('runtimeMemoryCapture:rememberExchange'),rememberStatus:mutation('runtimeMemoryCapture:rememberStatus'),
  embeddingProfile: mutation("runtimeClientExtensions:embeddingProfile"), readiness: mutation("runtimeClientExtensions:memoryReadiness"),
  mediaSubmit: mutation("runtimeMediaJobs:submit"), mediaGet: mutation("runtimeMediaJobs:get"), mediaList: mutation("runtimeMediaJobs:list"),
  mediaCancel: mutation("runtimeMediaJobs:cancel"), mediaReconcile: mutation("runtimeMediaJobs:reconcile"), artifact: mutation("artifacts:get"),
  contentSubmit: mutation("runtimeContentJobs:submit"), contentGet: mutation("runtimeContentJobs:get"), contentList: mutation("runtimeContentJobs:list"),
  contentCancel: mutation("runtimeContentJobs:cancel"), contentReconcile: mutation("runtimeContentJobs:reconcile"), contentApply: mutation("runtimeContentJobs:applySuggestion") };

/** One authenticated Convex connection. JWTs stay inside the host's official fetchToken callback. */
export class CortexRuntimeClient {
  private readonly port: RuntimeClientPort;
  private readonly scope: Partial<RuntimeScope>;
  private readonly watchers = new Set<(error: CortexRuntimeError) => void>();
  private readonly assetRequests = new Set<AbortController>();
  private readonly assetPreviews = new Set<() => void>();
  private closed = false;
  private generation = 0;
  private authenticated = false;
  private fetchToken: AuthTokenFetcher;
  private authReady: Promise<void> = Promise.resolve();
  private rejectAuth?: (error: CortexRuntimeError) => void;
  private stopAuthProbe?: () => void;
  private authProbeSequence = 0;
  private readonly authProbeTarget: Readonly<{ deploymentUrl: string; fetch?: typeof globalThis.fetch; enabled: boolean }>;
  private authTimer?: ReturnType<typeof setTimeout>;
  private sessionTimer?: ReturnType<typeof setTimeout>;
  private deliveryTimer?: ReturnType<typeof setTimeout>;
  private earliestDelivery?: number;
  private readonly wakeWatchers = new Set<() => void>();
  private readonly pendingCalls = new Set<(error: CortexRuntimeError) => void>();
  private rpcSequence = 0;
  private latencyAt = 0;
  constructor(private readonly options: CortexRuntimeClientOptions) {
    this.scope = Object.freeze({ ...(options.scope?.tenantId === undefined ? {} : { tenantId: identifier(options.scope.tenantId) }),
      ...(options.scope?.memorySpaceId === undefined ? {} : { memorySpaceId: identifier(options.scope.memorySpaceId) }) });
    if (options.authTimeoutMs !== undefined && (!Number.isSafeInteger(options.authTimeoutMs) || options.authTimeoutMs < 1 || options.authTimeoutMs > 120000)) invalid("INVALID_INPUT");
    if (options.requestTimeoutMs !== undefined && (!Number.isSafeInteger(options.requestTimeoutMs) || options.requestTimeoutMs < 1 || options.requestTimeoutMs > 120000)) invalid("INVALID_INPUT");
    this.port = options.client ?? new ConvexClient(options.deploymentUrl);
    this.authProbeTarget = Object.freeze({ deploymentUrl: options.deploymentUrl, fetch: options.fetch,
      enabled: !options.client || this.port instanceof ConvexClient || typeof options.fetch === "function" });
    this.fetchToken = options.fetchToken; this.installAuth();
  }
  private latencyNow(): number {
    let at: number | undefined;
    try { at = globalThis.performance.now(); } catch { /* Diagnostic clocks cannot alter execution. */ }
    if (at === undefined || !Number.isFinite(at)) { try { at = Date.now(); } catch { at = this.latencyAt; } }
    this.latencyAt = Math.max(this.latencyAt, Number.isFinite(at) ? at : 0); return this.latencyAt;
  }
  private latency(phase: RuntimeLatencyEvent["phase"], fields: { rpcId?: number; method?: string; durationMs?: number } = {}, atMs?: number): void {
    if (!this.options.onLatencyEvent) return;
    try {
      const result: unknown = this.options.onLatencyEvent(Object.freeze({ version: 1, phase, atMs: atMs ?? this.latencyNow(), ...fields }));
      // Also own rejection from an accidentally asynchronous diagnostic callback.
      if (result && typeof (result as PromiseLike<unknown>).then === "function") void Promise.resolve(result).catch(() => {});
    } catch { /* Diagnostics cannot fail authentication, dispatch, delivery or cleanup. */ }
  }
  private rpc<T>(method: string, invoke: () => Promise<T>): Promise<T> {
    if (!this.options.onLatencyEvent) return invoke();
    const rpcId = ++this.rpcSequence, started = this.latencyNow();
    this.latency("rpc.begin", { rpcId, method }, started);
    const finish = (phase: "rpc.end" | "rpc.failed") => {
      const at = this.latencyNow(); this.latency(phase, { rpcId, method, durationMs: at - started }, at);
    };
    try { return invoke().then(value => { finish("rpc.end"); return value; }, error => { finish("rpc.failed"); throw error; }); }
    catch (error) { finish("rpc.failed"); throw error; }
  }
  private mutation(ref: ReturnType<typeof mutation>, args: Record<string, unknown>): Promise<unknown> {
    if (!this.options.onLatencyEvent) return this.port.mutation(ref, args);
    return this.rpc(getFunctionName(ref), () => this.port.mutation(ref, args));
  }
  private action(ref: ReturnType<typeof action>, args: Record<string, unknown>): Promise<unknown> {
    if (!this.options.onLatencyEvent) return this.port.action(ref, args);
    return this.rpc(getFunctionName(ref), () => this.port.action(ref, args));
  }
  private installAuth() {
    this.latency("auth.begin");
    this.stopAuthProbe?.(); this.stopAuthProbe = undefined; this.authProbeSequence++;
    clearTimeout(this.authTimer); clearTimeout(this.sessionTimer); clearTimeout(this.deliveryTimer); this.earliestDelivery = undefined; this.authenticated = false;
    const epoch = this.generation; let settled = false, accepted = false;
    let ready = () => {}, denied = (_error: CortexRuntimeError) => {};
    this.authReady = new Promise<void>((resolve, reject) => { ready = resolve; denied = reject; });
    void this.authReady.catch(() => {}); this.rejectAuth = denied;
    const reject = (error: CortexRuntimeError) => {
      if (this.closed || epoch !== this.generation || (settled && !accepted)) return;
      settled = true; accepted = false; clearTimeout(this.authTimer); this.authenticated = false;
      this.stopAuthProbe?.(); this.stopAuthProbe = undefined;
      this.latency("auth.denied");
      denied(error); this.abortAssets(error); this.abortCalls(error); for (const fail of [...this.watchers]) fail(error);
      this.options.onAuthChange?.(false);
    };
    this.authTimer = setTimeout(() => reject(new CortexRuntimeError("AUTHENTICATION_TIMEOUT")), this.options.authTimeoutMs ?? 10000);
    // Node hosts can exit normally while an unused authentication attempt waits.
    if (typeof this.authTimer === "object" && "unref" in this.authTimer) this.authTimer.unref();
    this.port.setAuth(async args => {
      try {
        const token = await this.fetchToken(args);
        if (token === null) reject(new CortexRuntimeError("UNAUTHENTICATED"));
        else if (typeof token === "string" && !this.closed && epoch === this.generation && !settled
          && this.authProbeTarget.enabled) {
          this.stopAuthProbe?.();
          const sequence = ++this.authProbeSequence;
          this.stopAuthProbe = probeAuthenticationDenial({ deploymentUrl: this.authProbeTarget.deploymentUrl, token, scope: this.scope,
            fetch: this.authProbeTarget.fetch,
            active: () => !this.closed && epoch === this.generation && sequence === this.authProbeSequence && !settled,
            denied: () => reject(new CortexRuntimeError("UNAUTHENTICATED")) });
        }
        return token;
      } catch { reject(new CortexRuntimeError("AUTH_TOKEN_FETCH_FAILED")); return null; }
    }, authenticated => {
      if (this.closed || epoch !== this.generation || (settled && !accepted)) return;
      if (!authenticated) { reject(new CortexRuntimeError("UNAUTHENTICATED")); return; }
      settled = true; accepted = true; clearTimeout(this.authTimer); this.authenticated = true; ready();
      this.stopAuthProbe?.(); this.stopAuthProbe = undefined;
      this.latency("auth.ready");
      this.options.onAuthChange?.(true); for (const wake of [...this.wakeWatchers]) wake();
    });
  }
  /** Reinstall the official callback; Convex verifies a fresh token within the bounded handshake. */
  async refreshAuth(fetchToken?: AuthTokenFetcher): Promise<void> {
    this.check(); this.abortAssets(new CortexRuntimeError("SESSION_CHANGED", "uncertain")); this.abortCalls(new CortexRuntimeError("SESSION_CHANGED", "uncertain")); this.rejectAuth?.(new CortexRuntimeError("AUTH_REFRESHED")); this.generation++;
    if (fetchToken) this.fetchToken = fetchToken; this.installAuth(); await this.authReady;
  }
  private expireSession() {
    if (this.closed) return;
    const error = new CortexRuntimeError("AUTHORITY_EXPIRED"); this.authenticated = false;
    this.latency("auth.denied");
    this.abortAssets(error); this.abortCalls(error); for (const fail of [...this.watchers]) fail(error); this.options.onAuthChange?.(false);
  }
  private sessionDeadline(value: RuntimeSession) {
    clearTimeout(this.sessionTimer);
    const deadline = value.deliveryExpiresAt;
    if (deadline === undefined) return;
    const remaining = deadline - Date.now(); if (remaining <= 0) { this.expireSession(); invalid("AUTHORITY_EXPIRED"); }
    // Recheck long deadlines at the JS timer ceiling rather than overflowing to immediate expiry.
    this.sessionTimer = setTimeout(() => { if (deadline <= Date.now()) this.expireSession(); else this.sessionDeadline(value); }, Math.min(remaining, 2147483647));
    if (typeof this.sessionTimer === "object" && "unref" in this.sessionTimer) this.sessionTimer.unref();
  }
  private trackDelivery(expiresAt: number | undefined) {
    if (expiresAt === undefined) return;
    if (expiresAt <= Date.now()) { this.expireSession(); invalid("AUTHORITY_EXPIRED"); }
    if (this.earliestDelivery !== undefined && this.earliestDelivery <= expiresAt) return;
    clearTimeout(this.deliveryTimer); this.earliestDelivery = expiresAt;
    const expire = () => {
      if (expiresAt <= Date.now()) this.expireSession();
      else this.deliveryTimer = setTimeout(expire, Math.min(expiresAt - Date.now(), 2147483647));
    };
    this.deliveryTimer = setTimeout(expire, Math.min(expiresAt - Date.now(), 2147483647));
    if (typeof this.deliveryTimer === "object" && "unref" in this.deliveryTimer) this.deliveryTimer.unref();
  }
  private check() { if (this.closed) invalid("CLIENT_CLOSED"); }
  private abortCalls(error: CortexRuntimeError) { for (const fail of [...this.pendingCalls]) fail(new CortexRuntimeError(error.code, "uncertain")); }
  private call<T>(invoke: () => Promise<T>): Promise<T> {
    this.check();
    return new Promise<T>((resolve, reject) => {
      let finished = false;
      const finish = (value?: T, error?: unknown) => {
        if (finished) return; finished = true; clearTimeout(timer); this.pendingCalls.delete(fail);
        if (error !== undefined) reject(runtimeError(error)); else resolve(value!);
      };
      const fail = (error: CortexRuntimeError) => finish(undefined, error);
      const timer = setTimeout(() => fail(new CortexRuntimeError("RPC_DEADLINE_EXCEEDED", "uncertain")), this.options.requestTimeoutMs ?? 12000);
      this.pendingCalls.add(fail);
      // Attach both outcomes to the original operation. Local timeout never redispatches or rolls it back.
      try { Promise.resolve(invoke()).then(value => finish(value), error => finish(undefined, error)); }
      catch (error) { finish(undefined, error); }
    });
  }
  async session(): Promise<RuntimeSession> {
    this.check(); const epoch = this.generation; await this.authReady;
    if (epoch !== this.generation) invalid("SESSION_CHANGED"); if (!this.authenticated) invalid("UNAUTHENTICATED");
    const result = session(await this.call(() => this.mutation(refs.session, { ...this.scope })));
    if (epoch !== this.generation || !this.authenticated) invalid("SESSION_CHANGED"); this.sessionDeadline(result); return result;
  }
  private selector(handle: RuntimeRunHandle, current: RuntimeSession) {
    if (!sameScope(handle, current) || handle.principalId !== current.principalId) invalid("SESSION_CHANGED");
    return { tenantId: current.tenantId, memorySpaceId: current.memorySpaceId, runId: identifier(handle.runId, 512) };
  }
  private async inSession<T>(invoke: (current: RuntimeSession) => Promise<T>): Promise<{ current: RuntimeSession; result: T }> {
    const epoch = this.generation, current = await this.session();
    if (epoch !== this.generation) invalid("SESSION_CHANGED");
    const result = await this.call(() => invoke(current));
    // After I/O, suppress stale delivery without claiming the action/mutation never happened.
    try {
      if (epoch !== this.generation) invalid("SESSION_CHANGED");
      const after = await this.session();
      if (epoch !== this.generation || !sameScope(current, after) || current.principalId !== after.principalId) invalid("SESSION_CHANGED");
    } catch (error) { throw new CortexRuntimeError(runtimeError(error).code, "uncertain"); }
    return { current, result };
  }
  private pinned(handle: RuntimeRunHandle, value: RuntimeRun) {
    if (!sameScope(handle, value.scope) || handle.runId !== value.runId || handle.conversationId !== value.conversationId
      || handle.definitionHash !== value.definitionHash || handle.agentId !== value.agentId || handle.agentVersion !== value.agentVersion) invalid("RUN_IDENTITY_CHANGED");
    return value;
  }
  private handle(value: RuntimeRun, current: RuntimeSession): RuntimeRunHandle {
    if (!sameScope(value.scope, current)) invalid("SESSION_CHANGED");
    return Object.freeze({ version: 1, tenantId: current.tenantId, memorySpaceId: current.memorySpaceId, principalId: current.principalId,
      runId: value.runId, conversationId: value.conversationId, agentId: value.agentId, agentVersion: value.agentVersion, definitionHash: value.definitionHash });
  }
  async submit(request: TextSubmitV1): Promise<RuntimeRunHandle> {
    const normalized = textSubmit(request);
    const admitted = await this.inSession(current => this.mutation(refs.submit, { request: normalized, tenantId: current.tenantId, memorySpaceId: current.memorySpaceId }));
    const current = admitted.current, result = run(admitted.result);
    if (result.agentId !== normalized.agentId || result.agentVersion !== normalized.agentVersion
      || normalized.conversationId !== undefined && result.conversationId !== normalized.conversationId) invalid("RUN_IDENTITY_CHANGED");
    return this.handle(result, current);
  }
  /** Native pre-session/admission envelope followed by the independent fresh post-I/O session. */
  async submitAndStart(request: TextSubmitV1, options: { streaming?: boolean } = {}): Promise<RuntimeAdmissionResult> {
    const normalized = textSubmit(request), settings = object(options);
    if (Object.keys(settings).some(key => key !== "streaming") || settings.streaming !== undefined && typeof settings.streaming !== "boolean") invalid();
    this.check(); const epoch = this.generation; await this.authReady;
    if (epoch !== this.generation) invalid("SESSION_CHANGED"); if (!this.authenticated) invalid("UNAUTHENTICATED");
    const raw = await this.call(() => this.mutation(refs.submitAndStart, { request: normalized,
      ...this.scope, streaming: settings.streaming ?? true }));
    try {
      if (epoch !== this.generation || !this.authenticated) invalid("SESSION_CHANGED");
      const envelope = object(raw);
      if (envelope.version !== 1 || Object.keys(envelope).length !== 3 || !Object.hasOwn(envelope, "session")
        || !Object.hasOwn(envelope, "admission")) invalid("INVALID_RESPONSE");
      const actor = object(envelope.session);
      if (Object.keys(actor).some(key => !["version", "tenantId", "memorySpaceId", "principalId", "userId", "deliveryExpiresAt"].includes(key))) invalid("INVALID_RESPONSE");
      const current = session(actor);
      if (this.scope.tenantId !== undefined && current.tenantId !== this.scope.tenantId
        || this.scope.memorySpaceId !== undefined && current.memorySpaceId !== this.scope.memorySpaceId) invalid("SESSION_CHANGED");
      this.sessionDeadline(current);
      const after = await this.session();
      if (epoch !== this.generation || !sameScope(current, after) || current.principalId !== after.principalId) invalid("SESSION_CHANGED");
      const result = admissionResult(envelope.admission), value = result.run;
      if (value.agentId !== normalized.agentId || value.agentVersion !== normalized.agentVersion
        || normalized.conversationId !== undefined && value.conversationId !== normalized.conversationId) invalid("RUN_IDENTITY_CHANGED");
      const handle = this.handle(value, current);
      return { handle, run: value, start: result.start };
    } catch (error) {
      // Invalid delivery cannot assert that the native admission/Workflow did not happen.
      throw new CortexRuntimeError(runtimeError(error).code, "uncertain");
    }
  }
  async attach(runId: string): Promise<RuntimeRunHandle> {
    const acquired = await this.inSession(current => this.mutation(refs.get, { tenantId: current.tenantId, memorySpaceId: current.memorySpaceId, runId: identifier(runId, 512) }));
    const current = acquired.current, result = run(acquired.result);
    if (result.runId !== runId) invalid("RUN_IDENTITY_CHANGED"); return this.handle(result, current);
  }
  async start(handle: RuntimeRunHandle, options: { streaming?: boolean } = {}): Promise<{ runId: string; attemptNumber: number; state: string; failureCode?: string }> {
    await this.get(handle);
    const { result } = await this.inSession(current => this.mutation(refs.start, { ...this.selector(handle, current), streaming: options.streaming ?? true }));
    return result as { runId: string; attemptNumber: number; state: string; failureCode?: string };
  }
  async get(handle: RuntimeRunHandle): Promise<RuntimeRun> { const { result } = await this.inSession(current => this.mutation(refs.get, this.selector(handle, current))); return this.pinned(handle, run(result)); }
  private async observeInSession(handle: RuntimeRunHandle, args: Record<string, unknown>, acknowledgeSignal = false): Promise<{ current: RuntimeSession; result: RuntimeObservation; marker?: string }> {
    this.check(); const epoch = this.generation; await this.authReady;
    if (epoch !== this.generation) invalid("SESSION_CHANGED"); if (!this.authenticated) invalid("UNAUTHENTICATED");
    const input = object(handle);
    if (input.version !== 1 || natural(input.agentVersion) < 1) invalid();
    const expected: RuntimeRunHandle = { version: 1, tenantId: identifier(input.tenantId), memorySpaceId: identifier(input.memorySpaceId),
      principalId: identifier(input.principalId), runId: identifier(input.runId, 512), conversationId: identifier(input.conversationId, 512),
      agentId: identifier(input.agentId, 512), agentVersion: input.agentVersion as number, definitionHash: identifier(input.definitionHash, 512) };
    const raw = await this.call(() => this.mutation(refs.observe, { ...args, ...this.scope, handle: expected, ...(acknowledgeSignal ? { acknowledgeSignal: true } : {}) }));
    try {
      if (epoch !== this.generation || !this.authenticated) invalid("SESSION_CHANGED");
      const envelope = object(raw);
      if (envelope.version !== 1 || Object.keys(envelope).some(key => !["version", "session", "observation", "marker"].includes(key))
        || !Object.hasOwn(envelope, "session") || !Object.hasOwn(envelope, "observation")) invalid("INVALID_RESPONSE");
      if (Object.hasOwn(envelope, "marker") && (typeof envelope.marker !== "string" || !/^[a-f0-9]{64}$/.test(envelope.marker))) invalid("INVALID_RESPONSE");
      const actor = object(envelope.session);
      if (Object.keys(actor).some(key => !["version", "tenantId", "memorySpaceId", "principalId", "userId", "deliveryExpiresAt"].includes(key))) invalid("INVALID_RESPONSE");
      const current = session(actor); this.selector(expected, current); this.sessionDeadline(current);
      const payload = object(envelope.observation);
      if (Object.keys(payload).some(key => !["run", "state", "parts", "cursor", "approvals", "deliveryExpiresAt"].includes(key))) invalid("INVALID_RESPONSE");
      const result = observation(payload); this.pinned(expected, result.run);
      // An envelope's transaction cannot certify a later revocation. Preserve the
      // original independent post-I/O session, generation and immutable-actor fence.
      const after = await this.session();
      if (epoch !== this.generation || !sameScope(current, after) || current.principalId !== after.principalId) invalid("SESSION_CHANGED");
      if (current.deliveryExpiresAt !== undefined && current.deliveryExpiresAt <= Date.now()) invalid("AUTHORITY_EXPIRED");
      // Existing one-shot trackDelivery and per-watcher deadline checks consume
      // the protected-source bound before return/callback, with their original cleanup.
      return { current, result, ...(envelope.marker === undefined ? {} : { marker: envelope.marker as string }) };
    } catch (error) { throw new CortexRuntimeError(runtimeError(error).code, "uncertain"); }
  }
  async observe(handle: RuntimeRunHandle, options: { cursor?: RuntimeOutputCursor; finalOnly?: boolean; limit?: number } = {}): Promise<RuntimeObservation> {
    const args = { afterSequence: natural(options.cursor?.sequence ?? 0), limit: options.limit ?? 100, finalOnly: options.finalOnly ?? false };
    let acquired = await this.observeInSession(handle, args);
    if (options.cursor && acquired.result.run.attemptNumber !== natural(options.cursor.attemptNumber)) acquired = await this.observeInSession(handle, { ...args, afterSequence: 0 });
    this.trackDelivery(acquired.result.deliveryExpiresAt); return acquired.result;
  }
  private watch<T>(handle: RuntimeRunHandle, ref: ReturnType<typeof mutation>, args: Record<string, unknown> | (() => Record<string, unknown>), parse: (raw: unknown) => T,
    callback: (value: T) => void, onError?: (error: CortexRuntimeError) => void): () => void {
    this.check(); let active = true, inFlight = false, stopSignal = () => {};
    let forced = 0, servedForced = 0, signalled = 0, servedSignal = 0;
    type Revision = { marker: string; deliveryExpiresAt?: number };
    let latestSignal: Revision | undefined, acknowledged: Revision | undefined;
    const sameRevision = (left: Revision | undefined, right: Revision | undefined) => left !== undefined && right !== undefined
      && left.marker === right.marker && left.deliveryExpiresAt === right.deliveryExpiresAt;
    const pending = () => forced > servedForced || signalled > servedSignal;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const close = () => { if (!active) return; active = false; clearTimeout(timer); stopSignal(); this.watchers.delete(fail); this.wakeWatchers.delete(wake); };
    const fail = (error: unknown) => { if (!active) return; close(); onError?.(runtimeError(error)); };
    const deadline = (expiresAt: number | undefined) => {
      clearTimeout(timer); if (expiresAt === undefined) return;
      const remaining = expiresAt - Date.now(); if (remaining <= 0) { this.abortAssets(new CortexRuntimeError("AUTHORITY_EXPIRED")); fail(new CortexRuntimeError("AUTHORITY_EXPIRED")); return; }
      timer = setTimeout(() => { if (expiresAt <= Date.now()) { this.abortAssets(new CortexRuntimeError("AUTHORITY_EXPIRED")); fail(new CortexRuntimeError("AUTHORITY_EXPIRED")); } else deadline(expiresAt); }, Math.min(remaining, 2147483647));
      if (typeof timer === "object" && "unref" in timer) timer.unref();
    };
    const drain = () => {
      if (!active || inFlight) return; inFlight = true;
      void (async () => {
        while (active && pending()) {
          const epoch = this.generation, throughForced = forced, throughSignal = signalled;
          try {
            const acquired = await this.observeInSession(handle, typeof args === "function" ? args() : args, true);
            if (!active || epoch !== this.generation) continue;
            const raw = object(acquired.result), value = parse(raw);
            const sourceDeadline = deliveryDeadline(raw.deliveryExpiresAt);
            const bounds = [acquired.current.deliveryExpiresAt, sourceDeadline].filter((bound): bound is number => bound !== undefined);
            deadline(bounds.length ? Math.min(...bounds) : undefined);
            // The acknowledgement belongs to this guarded read, including its
            // independent post-I/O session. It caches no protected payload or permit.
            acknowledged = acquired.marker === undefined ? undefined : { marker: acquired.marker,
              ...(sourceDeadline === undefined ? {} : { deliveryExpiresAt: sourceDeadline }) };
            servedForced = throughForced;
            servedSignal = sameRevision(acknowledged, latestSignal) ? signalled : throughSignal;
            if (active && epoch === this.generation) callback(value);
          } catch (error) { if (!active) break; if (epoch !== this.generation) continue; fail(error); }
        }
      })().finally(() => { inFlight = false; if (active && pending()) drain(); });
    };
    const wake = () => {
      if (!active) return;
      if (this.options.onLatencyEvent) this.latency("watcher.wake", { method: getFunctionName(ref) });
      forced++; drain();
    };
    this.watchers.add(fail); this.wakeWatchers.add(wake);
    // Only opaque invalidation metadata is cacheable. Every delivery executes a fresh mutation.
    stopSignal = this.port.onUpdate(refs.signal, { tenantId: handle.tenantId, memorySpaceId: handle.memorySpaceId, runId: handle.runId }, raw => {
      if (!active) return;
      try { const signal = object(raw);
        if (signal.version !== 1 || typeof signal.marker !== "string" || !/^[a-f0-9]{64}$/.test(signal.marker)
          || Object.keys(signal).some(key => !["version", "marker", "deliveryExpiresAt"].includes(key))) invalid("INVALID_RESPONSE");
        const expiresAt = deliveryDeadline(signal.deliveryExpiresAt);
        const revision = { marker: signal.marker, ...(expiresAt === undefined ? {} : { deliveryExpiresAt: expiresAt }) };
        // A legacy three-field envelope has no acknowledgement: retain its
        // conservative wake behavior. Expiry validation above always runs.
        if (sameRevision(revision, acknowledged) || acknowledged !== undefined && sameRevision(revision, latestSignal)) return;
        latestSignal = revision; signalled++;
        if (this.options.onLatencyEvent) this.latency("watcher.wake", { method: getFunctionName(ref) });
        drain();
      } catch (error) { fail(error); }
    }, fail);
    if (!active) stopSignal(); else if (!inFlight) wake();
    return close;
  }
  watchRun(handle: RuntimeRunHandle, onUpdate: (run: RuntimeRun) => void, onError?: (error: CortexRuntimeError) => void): () => void {
    return this.watch(handle, refs.observe, { afterSequence: 0, limit: 1, finalOnly: false }, raw => this.pinned(handle, observation(raw).run), onUpdate, onError);
  }
  /** Live cursor pages, including updates while paused for approval. Unsubscribe affects observation only. */
  watchObservation(handle: RuntimeRunHandle, onUpdate: (observation: RuntimeObservation) => void, onError?: (error: CortexRuntimeError) => void,
    options: { cursor?: RuntimeOutputCursor; finalOnly?: boolean } = {}): () => void {
    let active = true, stop = () => {}, cursor = natural(options.cursor?.sequence ?? 0), attempt = options.cursor?.attemptNumber, epoch = 0;
    if (attempt !== undefined) natural(attempt);
    const subscribe = () => {
      const ownEpoch = ++epoch;
      stop = this.watch(handle, refs.observe, () => ({ afterSequence: cursor, limit: 100, finalOnly: options.finalOnly ?? false }),
        raw => { const result = observation(raw); this.pinned(handle, result.run); return result; }, result => {
        if (!active || ownEpoch !== epoch) return;
        if (attempt !== undefined && result.run.attemptNumber !== attempt) {
          attempt = result.run.attemptNumber; cursor = 0; stop(); queueMicrotask(() => { if (active && ownEpoch === epoch) subscribe(); }); return;
        }
        attempt = result.run.attemptNumber;
        const before = cursor; const parts = result.parts.filter(part => part.sequence > before);
        for (const part of parts) { if (part.sequence <= cursor) invalid("INVALID_RESPONSE"); cursor = part.sequence; }
        if (result.cursor < cursor || result.cursor < before) invalid("INVALID_RESPONSE");
        onUpdate({ ...result, parts, cursor });
        if (result.parts.length === 100 && active) { stop(); queueMicrotask(() => { if (active && ownEpoch === epoch) subscribe(); }); }
      }, error => { if (!active) return; active = false; stop(); onError?.(error); });
      if (!active) stop();
    };
    subscribe(); return () => { active = false; epoch++; stop(); };
  }
  async cancel(handle: RuntimeRunHandle): Promise<{ cancelled: true }> { const { result } = await this.inSession(current => this.mutation(refs.cancel, this.selector(handle, current))); return result as { cancelled: true }; }
  async approveInput(handle: RuntimeRunHandle): Promise<RuntimeRun> { const { result } = await this.inSession(current => this.mutation(refs.approve, { ...this.selector(handle, current), expectedDefinitionHash: handle.definitionHash })); return this.pinned(handle, run(result)); }
  async approveTool(handle: RuntimeRunHandle, approval: RuntimeToolApproval): Promise<{ approved: true }> {
    const { result } = await this.inSession(current => this.mutation(refs.tool, { ...this.selector(handle, current), operationId: identifier(approval.operationId, 512), expectedRequestHash: identifier(approval.requestHash) })); return result as { approved: true };
  }
  async getDefinition(agentId: string, version: number): Promise<RuntimeDefinition> { const { result } = await this.inSession(current => this.mutation(refs.definition, { tenantId: current.tenantId, memorySpaceId: current.memorySpaceId, agentId: identifier(agentId), version: natural(version) })); return result as RuntimeDefinition; }
  async messages(conversationId: string, options: { cursor?: string | null; limit?: number } = {}): Promise<RuntimeTranscriptPage> { const { result } = await this.inSession(current => this.mutation(refs.messages, { tenantId: current.tenantId, memorySpaceId: current.memorySpaceId, conversationId: identifier(conversationId), cursor: options.cursor ?? null, limit: options.limit ?? 100 })); return result as RuntimeTranscriptPage; }
  async listConversations(limit = 100): Promise<RuntimeConversation[]> { const { result } = await this.inSession(current => this.mutation(refs.conversations, { tenantId: current.tenantId, memorySpaceId: current.memorySpaceId, limit })); return result as RuntimeConversation[]; }
  async getDefaultProfile(): Promise<{ version: 1; profile: RuntimeEmbeddingProfile }> { const { result } = await this.inSession(current => this.mutation(refs.profile, { tenantId: current.tenantId, memorySpaceId: current.memorySpaceId })); return result as { version: 1; profile: RuntimeEmbeddingProfile }; }
  /** Fresh administrator-selected profile metadata. expectedProfileId is a mismatch guard, never an override. */
  async getEmbeddingProfile(options: { operationKey?: "embedding.memory" | "embedding.query"; expectedProfileId?: string } = {}): Promise<{ version: 1; profile: RuntimeEmbeddingProfile }> {
    const args = embeddingProfileOptions(options);
    const { result } = await this.inSession(current => this.mutation(refs.embeddingProfile, { tenantId: current.tenantId, memorySpaceId: current.memorySpaceId, ...args }));
    const row = object(result);
    if (row.version !== 1) invalid("INVALID_RESPONSE");
    const profile = runtimeEmbeddingProfile(row.profile);
    if (args.expectedProfileId !== undefined && profile.profileId !== args.expectedProfileId) invalid("INVALID_RESPONSE");
    return { version: 1, profile };
  }
  /** Fresh status, or an explicit strict barrier for only the requested stages. Starts no inference. */
  async memoryReadiness(options: RuntimeMemoryReadinessOptions = {}): Promise<RuntimeMemoryReadiness> {
    const args = readinessOptions(options);
    const { result } = await this.inSession(current => this.mutation(refs.readiness, { tenantId: current.tenantId, memorySpaceId: current.memorySpaceId, ...args }));
    const value = memoryReadiness(result);
    if (args.cutoff !== undefined && value.cutoff !== args.cutoff || args.graphCutoff !== undefined && value.graphCutoff !== args.graphCutoff
      || args.expectedProfileId !== undefined && value.profile.profileId !== args.expectedProfileId
      || JSON.stringify(value.strictStages) !== JSON.stringify(args.strictStages ?? [])) invalid("INVALID_RESPONSE");
    return value;
  }
  async recall(input: { text: string; requestId: string; limit?: number }): Promise<RuntimeRecallResult> {
    const { result } = await this.inSession(current => this.action(refs.recall, { tenantId: current.tenantId, memorySpaceId: current.memorySpaceId,
      text: input.text, requestId: identifier(input.requestId, 512), ...(input.limit === undefined ? {} : { limit: input.limit }) }));
    this.trackDelivery(deliveryDeadline(object(result).deliveryExpiresAt)); return result as RuntimeRecallResult;
  }
  /** One canonical capture receipt; pending indexing is not immediate facts/vectors. */
  async remember(input:RuntimeRememberInput):Promise<RuntimeRememberResult> {
    const normalized=rememberInput(input);
    const {current,result}=await this.inSession(actor=>this.mutation(refs.remember,{tenantId:actor.tenantId,memorySpaceId:actor.memorySpaceId,input:normalized}));
    try {
      const captured=rememberResult(result);
      if(!sameScope(current,captured.scope)||current.principalId!==captured.principalId||captured.requestId!==normalized.requestId)invalid('INVALID_RESPONSE');
      this.trackDelivery(captured.deliveryExpiresAt);return captured;
    }catch(error){throw new CortexRuntimeError(runtimeError(error).code,'uncertain');}
  }
  /** Fresh receipt/source/profile/readiness, without starting inference. */
  async rememberStatus(receiptId:string):Promise<RuntimeRememberResult> {
    const id=identifier(receiptId,512);
    const {current,result}=await this.inSession(actor=>this.mutation(refs.rememberStatus,{tenantId:actor.tenantId,memorySpaceId:actor.memorySpaceId,receiptId:id}));
    const captured=rememberResult(result);
    if(!sameScope(current,captured.scope)||current.principalId!==captured.principalId||captured.receiptId!==id)invalid('INVALID_RESPONSE');
    this.trackDelivery(captured.deliveryExpiresAt);return captured;
  }
  /** Admit one backend-owned job and pending artifact. The backend chooses its qualified model and options. */
  async submitMediaJob(input: RuntimeMediaSubmit): Promise<RuntimeMediaJob> {
    const request = mediaSubmit(input);
    const { result } = await this.inSession(current => this.mutation(refs.mediaSubmit, { tenantId: current.tenantId, memorySpaceId: current.memorySpaceId, ...request }));
    const job = mediaJob(result); this.trackDelivery(job.deliveryExpiresAt); if (job.kind !== request.kind) invalid("INVALID_RESPONSE"); return job;
  }
  async getMediaJob(jobId: string): Promise<RuntimeMediaJob> { return await this.mediaOperation(refs.mediaGet, jobId); }
  async listMediaJobs(options: { conversationId?: string; limit?: number } = {}): Promise<{ version: 1; jobs: RuntimeMediaJob[] }> {
    const args = mediaListOptions(options);
    const { result } = await this.inSession(current => this.mutation(refs.mediaList, { tenantId: current.tenantId, memorySpaceId: current.memorySpaceId, ...args }));
    const list = mediaJobList(result, args.limit ?? 20); for (const job of list.jobs) this.trackDelivery(job.deliveryExpiresAt); return list;
  }
  /** Local cancellation is honest about unsupported upstream cancellation and any incurred uncertainty. */
  async cancelMediaJob(jobId: string): Promise<RuntimeMediaJob> { return await this.mediaOperation(refs.mediaCancel, jobId); }
  /** Poll/download an existing acknowledged operation; submission-unknown never triggers a new generation. */
  async reconcileMediaJob(jobId: string): Promise<RuntimeMediaJob> { return await this.mediaOperation(refs.mediaReconcile, jobId); }
  /** Fresh artifact metadata with a bounded current-version projection and no storage URL or credentials. */
  async getArtifact(value: string): Promise<RuntimeArtifact> {
    const artifactId = identifier(value);
    const { result } = await this.inSession(current => this.mutation(refs.artifact, { tenantId: current.tenantId, memorySpaceId: current.memorySpaceId,
      artifactId, includeVersionHistory: false }));
    const artifact = runtimeArtifact(result); this.trackDelivery(artifact.deliveryExpiresAt); if (artifact.artifactId !== artifactId) invalid("INVALID_RESPONSE"); return artifact;
  }
  private async mediaOperation(ref: ReturnType<typeof mutation>, value: string): Promise<RuntimeMediaJob> {
    const jobId = identifier(value);
    const { result } = await this.inSession(current => this.mutation(ref, { tenantId: current.tenantId, memorySpaceId: current.memorySpaceId, jobId }));
    const job = mediaJob(result); this.trackDelivery(job.deliveryExpiresAt); if (job.jobId !== jobId) invalid("INVALID_RESPONSE"); return job;
  }
  /** Submit one durable backend content intent; model, budget, tools and memory stay on the backend. */
  async submitContentJob(input: ContentSubmitV1): Promise<RuntimeContentJobV1> {
    const request = contentSubmit(input);
    const { result } = await this.inSession(current => this.mutation(refs.contentSubmit, { tenantId: current.tenantId, memorySpaceId: current.memorySpaceId, ...request }));
    const job = contentJob(result); this.trackDelivery(job.deliveryExpiresAt);
    if (job.intent !== request.intent || request.conversationId !== undefined && job.conversationId !== request.conversationId) invalid("INVALID_RESPONSE");
    return job;
  }
  async getContentJob(jobId: string): Promise<RuntimeContentJobV1> { return await this.contentOperation(refs.contentGet, jobId); }
  async listContentJobs(options: { conversationId?: string; limit?: number } = {}): Promise<RuntimeContentJobV1[]> {
    const args = contentListOptions(options);
    const { result } = await this.inSession(current => this.mutation(refs.contentList, { tenantId: current.tenantId, memorySpaceId: current.memorySpaceId, ...args }));
    const jobs = contentJobList(result, args.limit ?? 20);
    for (const job of jobs) { this.trackDelivery(job.deliveryExpiresAt); if (args.conversationId !== undefined && job.conversationId !== args.conversationId) invalid("INVALID_RESPONSE"); }
    return jobs;
  }
  async cancelContentJob(jobId: string): Promise<RuntimeContentJobV1> { return await this.contentOperation(refs.contentCancel, jobId); }
  /** Recover only the existing operation; an unknown submission is never retried through this API. */
  async reconcileContentJob(jobId: string): Promise<RuntimeContentJobV1> { return await this.contentOperation(refs.contentReconcile, jobId); }
  /** Commit an explicitly selected suggestion against its exact current retained artifact version. */
  async applyContentSuggestion(input: { jobId: string; suggestionId: string; artifactVersion: number }): Promise<RuntimeContentJobV1> {
    const args = contentSuggestionInput(input);
    const { result } = await this.inSession(current => this.mutation(refs.contentApply, { tenantId: current.tenantId, memorySpaceId: current.memorySpaceId, ...args }));
    const job = contentJob(result); this.trackDelivery(job.deliveryExpiresAt);
    if (job.jobId !== args.jobId || job.intent !== "suggestions" || job.artifactVersion === undefined || job.artifactVersion <= args.artifactVersion) invalid("INVALID_RESPONSE");
    return job;
  }
  private async contentOperation(ref: ReturnType<typeof mutation>, value: string): Promise<RuntimeContentJobV1> {
    const jobId = identifier(value);
    const { result } = await this.inSession(current => this.mutation(ref, { tenantId: current.tenantId, memorySpaceId: current.memorySpaceId, jobId }));
    const job = contentJob(result); this.trackDelivery(job.deliveryExpiresAt); if (job.jobId !== jobId) invalid("INVALID_RESPONSE"); return job;
  }
  private abortAssets(error: CortexRuntimeError) {
    for (const controller of this.assetRequests) controller.abort(error);
    for (const revoke of [...this.assetPreviews]) revoke();
  }
  private async assetIo<T>(options: RuntimeAssetIoOptions, invoke: (current: RuntimeSession, signal: AbortSignal, base: URL) => Promise<T>): Promise<T> {
    this.check(); const base = assetHttpBase(this.options.assetHttpUrl), epoch = this.generation;
    const timeout = options.timeoutMs ?? 60_000;
    if (!Number.isSafeInteger(timeout) || timeout < 1000 || timeout > 120_000) invalid();
    const controller = new AbortController(); this.assetRequests.add(controller);
    const cancel = () => controller.abort(new CortexRuntimeError("ASSET_CANCELLED", "uncertain"));
    options.signal?.addEventListener("abort", cancel, { once: true }); if (options.signal?.aborted) cancel();
    const timer = setTimeout(() => controller.abort(new CortexRuntimeError("ASSET_TIMEOUT", "uncertain")), timeout);
    let rejectAbort = (_error: unknown) => {};
    const aborted = new Promise<never>((_resolve, reject) => { rejectAbort = reject; });
    const abort = () => rejectAbort(controller.signal.reason);
    controller.signal.addEventListener("abort", abort, { once: true }); if (controller.signal.aborted) abort();
    const check = () => {
      if (controller.signal.aborted) throw controller.signal.reason;
      this.check(); if (epoch !== this.generation || !this.authenticated) invalid("SESSION_CHANGED");
    };
    const task = async () => {
      const current = await this.session(); check();
      const result = await invoke(current, controller.signal, base); check();
      const after = await this.session(); check();
      if (!sameScope(current, after) || current.principalId !== after.principalId) invalid("SESSION_CHANGED");
      return result;
    };
    try { return await Promise.race([task(), aborted]); }
    catch (error) { throw new CortexRuntimeError(runtimeError(error).code, "uncertain"); }
    finally {
      clearTimeout(timer); options.signal?.removeEventListener("abort", cancel);
      controller.signal.removeEventListener("abort", abort); this.assetRequests.delete(controller);
    }
  }
  private async assetFetch(base: URL, path: string, current: RuntimeSession, selectors: Record<string, string>, signal: AbortSignal, body?: Blob): Promise<Response> {
    const token = await this.fetchToken({ forceRefreshToken: true });
    if (signal.aborted) throw signal.reason;
    if (!token || !this.authenticated || this.closed) invalid("UNAUTHENTICATED");
    const url = new URL(path, base);
    for (const [key, value] of Object.entries({ tenantId: current.tenantId, memorySpaceId: current.memorySpaceId, ...selectors })) url.searchParams.set(key, value);
    const headers = new Headers({ Authorization: `Bearer ${token}` });
    if (body) headers.set("Content-Type", body.type);
    return (this.options.fetch ?? globalThis.fetch)(url, { method: body ? "POST" : "GET", headers, ...(body ? { body } : {}),
      signal, redirect: "error", cache: "no-store", credentials: "omit" });
  }
  private async currentAsset(current: RuntimeSession, reference: RuntimeAssetReference): Promise<RuntimeAssetVersion> {
    const result = assetVersion(await this.mutation(refs.asset, { tenantId: current.tenantId, memorySpaceId: current.memorySpaceId, ...reference }));
    if (result.assetId !== reference.assetId || result.assetVersion !== reference.version) invalid("ASSET_VERSION_CHANGED");
    this.trackDelivery(result.deliveryExpiresAt);
    return result;
  }
  /** Metadata is freshly authorized by a mutation; its immutable IDs grant no byte access. */
  async getAsset(reference: RuntimeAssetReference): Promise<RuntimeAssetVersion> {
    const normalized = assetReference(reference);
    const { result } = await this.inSession(current => this.currentAsset(current, normalized)); return result;
  }
  /** Direct bounded raw-byte upload. No client-side storage or presigned URL. */
  async uploadAsset(input: Uint8Array | Blob, options: RuntimeAssetUploadOptions): Promise<RuntimeAssetVersion> {
    const requestId = assetRequestId(options.requestId), mimeType = assetMime(options.mimeType);
    const filename = options.filename === undefined ? undefined : assetFilename(options.filename);
    const size = input instanceof Blob ? input.size : input instanceof Uint8Array ? input.byteLength : invalid();
    if (size < 1) invalid("INVALID_ASSET_METADATA");
    if (size > RUNTIME_ASSET_MAX_BYTES) invalid("ASSET_TOO_LARGE");
    const body = input instanceof Blob ? input.slice(0, size, mimeType) : new Blob([new Uint8Array(input)], { type: mimeType });
    return this.assetIo(options, async (current, signal, base) => {
      const response = await this.assetFetch(base, "/cortex/assets/upload", current, { requestId, ...(filename === undefined ? {} : { filename }) }, signal, body);
      if (!response.ok) return assetHttpError(response, signal);
      const bytes = await boundedAssetBody(response, 65_536, signal, "INVALID_RESPONSE");
      let parsed: unknown; try { parsed = JSON.parse(new TextDecoder().decode(bytes)); } catch { return invalid("INVALID_RESPONSE"); }
      const value = assetVersion(parsed);
      const digest = await assetDigest(new Uint8Array(await body.arrayBuffer()));
      if (signal.aborted) throw signal.reason;
      if (value.sizeBytes !== size || value.mimeType !== mimeType || value.contentHash !== digest || value.filename !== filename) invalid("ASSET_VERSION_CHANGED");
      return value;
    });
  }
  /** Authenticated bytes, verified against the exact current immutable version, suitable for a bounded Blob URL in the UI. */
  async fetchAsset(reference: RuntimeAssetReference, options: RuntimeAssetIoOptions = {}): Promise<Blob> {
    const normalized = assetReference(reference);
    return this.assetIo(options, async (current, signal, base) => {
      const expected = await this.currentAsset(current, normalized);
      if (signal.aborted) throw signal.reason;
      const response = await this.assetFetch(base, "/cortex/assets/download", current, { assetId: normalized.assetId, version: String(normalized.version) }, signal);
      if (!response.ok) return assetHttpError(response, signal);
      const bytes = await boundedAssetBody(response, RUNTIME_ASSET_MAX_BYTES, signal);
      const mimeType = response.headers.get("content-type")?.split(";", 1)[0]?.trim();
      if (bytes.byteLength !== expected.sizeBytes || mimeType !== expected.mimeType || await assetDigest(bytes) !== expected.contentHash) invalid("ASSET_CONTENT_MISMATCH");
      if (signal.aborted) throw signal.reason;
      const after = await this.currentAsset(current, normalized);
      // Delivery deadlines describe current authorization, not immutable content.
      const { deliveryExpiresAt: _beforeDeadline, ...beforeIdentity } = expected;
      const { deliveryExpiresAt: _afterDeadline, ...afterIdentity } = after;
      if (JSON.stringify(afterIdentity) !== JSON.stringify(beforeIdentity)) invalid("ASSET_VERSION_CHANGED");
      if (signal.aborted) throw signal.reason;
      return new Blob([bytes], { type: expected.mimeType });
    });
  }
  /** Local bounded Blob URL for image/video/download rendering. Revoke on unmount; auth changes and close also revoke. */
  async createAssetUrl(reference: RuntimeAssetReference, options: RuntimeAssetIoOptions = {}): Promise<RuntimeAssetPreview> {
    const epoch = this.generation, blob = await this.fetchAsset(reference, options);
    this.check(); if (epoch !== this.generation || !this.authenticated) invalid("SESSION_CHANGED");
    if (typeof URL.createObjectURL !== "function" || typeof URL.revokeObjectURL !== "function") invalid("ASSET_PREVIEW_UNAVAILABLE");
    const url = URL.createObjectURL(blob); let active = true;
    const revoke = () => { if (!active) return; active = false; URL.revokeObjectURL(url); this.assetPreviews.delete(revoke); };
    this.assetPreviews.add(revoke);
    return Object.freeze({ url, mimeType: blob.type, sizeBytes: blob.size, revoke });
  }
  async close(): Promise<void> { if (this.closed) return; this.closed = true; this.stopAuthProbe?.(); this.stopAuthProbe = undefined; clearTimeout(this.authTimer); clearTimeout(this.sessionTimer); clearTimeout(this.deliveryTimer); const error = new CortexRuntimeError("CLIENT_CLOSED"); this.abortAssets(error); this.abortCalls(error); this.rejectAuth?.(error); for (const fail of [...this.watchers]) fail(error); if (!this.options.client) await this.port.close(); }
}
