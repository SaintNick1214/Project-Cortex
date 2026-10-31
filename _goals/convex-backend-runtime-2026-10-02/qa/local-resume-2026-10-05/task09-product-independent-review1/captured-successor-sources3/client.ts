import { ConvexClient } from "convex/browser";
import type { AuthTokenFetcher } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import type { RuntimeConversation, RuntimeDefinition, RuntimeEmbeddingProfile, RuntimeObservation, RuntimeRecallResult, RuntimeRun,
  RuntimeRunHandle, RuntimeScope, RuntimeSession, RuntimeToolApproval, RuntimeTranscriptPage, RuntimeOutputCursor, TextSubmitV1 } from "./types.js";
import { CortexRuntimeError, identifier, invalid, natural, observation, run, runtimeError, sameScope, session, textSubmit } from "./validation.js";

export type RuntimeClientPort = Pick<ConvexClient, "setAuth" | "query" | "mutation" | "action" | "onUpdate" | "close">;
export interface CortexRuntimeClientOptions {
  deploymentUrl: string; fetchToken: AuthTokenFetcher; scope?: Partial<RuntimeScope>;
  onAuthChange?: (authenticated: boolean) => void;
  /** An existing official client can be shared; close() then leaves its ownership with the caller. */
  client?: RuntimeClientPort;
}
const query = (name: string) => makeFunctionReference<"query", Record<string, unknown>, unknown>(name);
const mutation = (name: string) => makeFunctionReference<"mutation", Record<string, unknown>, unknown>(name);
const action = (name: string) => makeFunctionReference<"action", Record<string, unknown>, unknown>(name);
const refs = { session: query("runtimeClient:session"), submit: mutation("runs:submit"), get: query("runs:get"), start: mutation("runtimeAgent:start"),
  observe: query("runtimeAgent:observe"), cancel: mutation("runtimeAgent:cancel"), approve: mutation("runs:approve"), tool: mutation("runtimeAgent:approveTool"),
  definition: query("agentDefinitions:get"), messages: query("runtimeTranscript:messages"), conversations: query("runtimeTranscript:list"),
  profile: query("runtimeMemory:defaultProfile"), recall: action("runtimeMemory:recall") };

/** One authenticated Convex connection. JWTs stay inside the host's official fetchToken callback. */
export class CortexRuntimeClient {
  private readonly port: RuntimeClientPort;
  private readonly scope: Partial<RuntimeScope>;
  private readonly watchers = new Set<(error: CortexRuntimeError) => void>();
  private closed = false;
  private generation = 0;
  private authenticated = false;
  private fetchToken: AuthTokenFetcher;
  private authReady: Promise<void> = Promise.resolve();
  private rejectAuth?: (error: CortexRuntimeError) => void;
  constructor(private readonly options: CortexRuntimeClientOptions) {
    this.port = options.client ?? new ConvexClient(options.deploymentUrl);
    this.scope = Object.freeze({ ...(options.scope?.tenantId === undefined ? {} : { tenantId: identifier(options.scope.tenantId) }),
      ...(options.scope?.memorySpaceId === undefined ? {} : { memorySpaceId: identifier(options.scope.memorySpaceId) }) });
    this.fetchToken = options.fetchToken; this.installAuth();
  }
  private installAuth() {
    this.authenticated = false;
    const epoch = this.generation;
    let ready = () => {}, denied = (_error: CortexRuntimeError) => {};
    this.authReady = new Promise<void>((resolve, reject) => { ready = resolve; denied = reject; });
    // A client may be constructed before the UI starts a request.
    void this.authReady.catch(() => {}); this.rejectAuth = denied;
    this.port.setAuth(args => this.fetchToken(args), authenticated => {
      if (this.closed || epoch !== this.generation) return;
      this.authenticated = authenticated;
      if (authenticated) ready();
      else {
        const error = new CortexRuntimeError("UNAUTHENTICATED"); denied(error);
        for (const fail of [...this.watchers]) fail(error);
      }
      this.options.onAuthChange?.(authenticated);
    });
  }
  /** Reinstall the official callback; Convex requests and verifies a fresh token. No local token cache. */
  async refreshAuth(fetchToken?: AuthTokenFetcher): Promise<void> {
    this.check(); this.rejectAuth?.(new CortexRuntimeError("AUTH_REFRESHED")); this.generation++;
    if (fetchToken) this.fetchToken = fetchToken; this.installAuth(); await this.authReady;
  }
  private check() { if (this.closed) invalid("CLIENT_CLOSED"); }
  private async call<T>(invoke: () => Promise<T>): Promise<T> { this.check(); try { return await invoke(); } catch (error) { throw runtimeError(error); } }
  async session(): Promise<RuntimeSession> {
    this.check(); const epoch = this.generation; await this.authReady;
    if (epoch !== this.generation) invalid("SESSION_CHANGED"); if (!this.authenticated) invalid("UNAUTHENTICATED");
    const result = session(await this.call(() => this.port.query(refs.session, { ...this.scope })));
    if (epoch !== this.generation || !this.authenticated) invalid("SESSION_CHANGED"); return result;
  }
  private selector(handle: RuntimeRunHandle, current: RuntimeSession) {
    if (!sameScope(handle, current) || handle.principalId !== current.principalId) invalid("SESSION_CHANGED");
    return { tenantId: current.tenantId, memorySpaceId: current.memorySpaceId, runId: identifier(handle.runId, 512) };
  }
  private async bound(handle: RuntimeRunHandle) { return this.selector(handle, await this.session()); }
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
    const admitted = await this.inSession(current => this.port.mutation(refs.submit, { request: normalized, tenantId: current.tenantId, memorySpaceId: current.memorySpaceId }));
    const current = admitted.current, result = run(admitted.result);
    if (result.agentId !== normalized.agentId || result.agentVersion !== normalized.agentVersion
      || normalized.conversationId !== undefined && result.conversationId !== normalized.conversationId) invalid("RUN_IDENTITY_CHANGED");
    return this.handle(result, current);
  }
  async attach(runId: string): Promise<RuntimeRunHandle> {
    const acquired = await this.inSession(current => this.port.query(refs.get, { tenantId: current.tenantId, memorySpaceId: current.memorySpaceId, runId: identifier(runId, 512) }));
    const current = acquired.current, result = run(acquired.result);
    if (result.runId !== runId) invalid("RUN_IDENTITY_CHANGED"); return this.handle(result, current);
  }
  async start(handle: RuntimeRunHandle, options: { streaming?: boolean } = {}): Promise<{ runId: string; attemptNumber: number; state: string; failureCode?: string }> {
    await this.get(handle);
    const { result } = await this.inSession(current => this.port.mutation(refs.start, { ...this.selector(handle, current), streaming: options.streaming ?? true }));
    return result as { runId: string; attemptNumber: number; state: string; failureCode?: string };
  }
  async get(handle: RuntimeRunHandle): Promise<RuntimeRun> { const { result } = await this.inSession(current => this.port.query(refs.get, this.selector(handle, current))); return this.pinned(handle, run(result)); }
  async observe(handle: RuntimeRunHandle, options: { cursor?: RuntimeOutputCursor; finalOnly?: boolean; limit?: number } = {}): Promise<RuntimeObservation> {
    const acquired = await this.inSession(async current => {
      const args = this.selector(handle, current);
      let result = observation(await this.port.query(refs.observe, { ...args, afterSequence: natural(options.cursor?.sequence ?? 0), limit: options.limit ?? 100, finalOnly: options.finalOnly ?? false }));
      if (options.cursor && result.run.attemptNumber !== natural(options.cursor.attemptNumber)) result = observation(await this.port.query(refs.observe, { ...args, afterSequence: 0, limit: options.limit ?? 100, finalOnly: options.finalOnly ?? false }));
      this.pinned(handle, result.run); return result;
    }); return acquired.result;
  }
  private watch<T>(handle: RuntimeRunHandle, ref: ReturnType<typeof query>, args: Record<string, unknown>, parse: (raw: unknown) => T,
    callback: (value: T) => void, onError?: (error: CortexRuntimeError) => void): () => void {
    this.check(); let active = true, subscribed = false, stopSession = () => {}, stopResult = () => {}, delivery = Promise.resolve();
    const close = () => { if (!active) return; active = false; stopSession(); stopResult(); this.watchers.delete(fail); };
    const fail = (error: unknown) => { if (!active) return; close(); onError?.(runtimeError(error)); };
    this.watchers.add(fail);
    // A verified session subscription fences principal changes even if the new actor can read the same space.
    stopSession = this.port.onUpdate(refs.session, { ...this.scope }, raw => {
      if (!active) return;
      try { const current = session(raw); if (!sameScope(handle, current) || current.principalId !== handle.principalId) invalid("SESSION_CHANGED"); }
      catch (error) { fail(error); return; }
      if (subscribed) return; subscribed = true;
      stopResult = this.port.onUpdate(ref, args, rawResult => {
        const epoch = this.generation;
        // Prevent cached results/late refresh callbacks from crossing a session change.
        delivery = delivery.then(async () => {
          if (!active || epoch !== this.generation) return;
          await this.bound(handle); if (active && epoch === this.generation) callback(parse(rawResult));
        }).catch(error => { if (epoch === this.generation) fail(error); });
      }, fail);
    }, fail);
    if (!active) { stopSession(); stopResult(); }
    return close;
  }
  watchRun(handle: RuntimeRunHandle, onUpdate: (run: RuntimeRun) => void, onError?: (error: CortexRuntimeError) => void): () => void {
    return this.watch(handle, refs.get, { tenantId: handle.tenantId, memorySpaceId: handle.memorySpaceId, runId: handle.runId }, raw => this.pinned(handle, run(raw)), onUpdate, onError);
  }
  /** Live cursor pages, including updates while paused for approval. Unsubscribe affects observation only. */
  watchObservation(handle: RuntimeRunHandle, onUpdate: (observation: RuntimeObservation) => void, onError?: (error: CortexRuntimeError) => void,
    options: { cursor?: RuntimeOutputCursor; finalOnly?: boolean } = {}): () => void {
    let active = true, stop = () => {}, cursor = natural(options.cursor?.sequence ?? 0), attempt = options.cursor?.attemptNumber, epoch = 0;
    if (attempt !== undefined) natural(attempt);
    const subscribe = () => {
      const ownEpoch = ++epoch;
      stop = this.watch(handle, refs.observe, { tenantId: handle.tenantId, memorySpaceId: handle.memorySpaceId, runId: handle.runId,
        afterSequence: cursor, limit: 100, finalOnly: options.finalOnly ?? false }, raw => { const result = observation(raw); this.pinned(handle, result.run); return result; }, result => {
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
  async cancel(handle: RuntimeRunHandle): Promise<{ cancelled: true }> { const { result } = await this.inSession(current => this.port.mutation(refs.cancel, this.selector(handle, current))); return result as { cancelled: true }; }
  async approveInput(handle: RuntimeRunHandle): Promise<RuntimeRun> { const { result } = await this.inSession(current => this.port.mutation(refs.approve, { ...this.selector(handle, current), expectedDefinitionHash: handle.definitionHash })); return this.pinned(handle, run(result)); }
  async approveTool(handle: RuntimeRunHandle, approval: RuntimeToolApproval): Promise<{ approved: true }> {
    const { result } = await this.inSession(current => this.port.mutation(refs.tool, { ...this.selector(handle, current), operationId: identifier(approval.operationId, 512), expectedRequestHash: identifier(approval.requestHash) })); return result as { approved: true };
  }
  async getDefinition(agentId: string, version: number): Promise<RuntimeDefinition> { const { result } = await this.inSession(current => this.port.query(refs.definition, { tenantId: current.tenantId, memorySpaceId: current.memorySpaceId, agentId: identifier(agentId), version: natural(version) })); return result as RuntimeDefinition; }
  async messages(conversationId: string, options: { cursor?: string | null; limit?: number } = {}): Promise<RuntimeTranscriptPage> { const { result } = await this.inSession(current => this.port.query(refs.messages, { tenantId: current.tenantId, memorySpaceId: current.memorySpaceId, conversationId: identifier(conversationId), cursor: options.cursor ?? null, limit: options.limit ?? 100 })); return result as RuntimeTranscriptPage; }
  async listConversations(limit = 100): Promise<RuntimeConversation[]> { const { result } = await this.inSession(current => this.port.query(refs.conversations, { tenantId: current.tenantId, memorySpaceId: current.memorySpaceId, limit })); return result as RuntimeConversation[]; }
  async getDefaultProfile(): Promise<{ version: 1; profile: RuntimeEmbeddingProfile }> { const { result } = await this.inSession(current => this.port.query(refs.profile, { tenantId: current.tenantId, memorySpaceId: current.memorySpaceId })); return result as { version: 1; profile: RuntimeEmbeddingProfile }; }
  async recall(input: { text: string; requestId: string; limit?: number }): Promise<RuntimeRecallResult> {
    const { result } = await this.inSession(current => this.port.action(refs.recall, { tenantId: current.tenantId, memorySpaceId: current.memorySpaceId,
      text: input.text, requestId: identifier(input.requestId, 512), ...(input.limit === undefined ? {} : { limit: input.limit }) })); return result as RuntimeRecallResult;
  }
  async close(): Promise<void> { if (this.closed) return; this.closed = true; const error = new CortexRuntimeError("CLIENT_CLOSED"); this.rejectAuth?.(error); for (const fail of [...this.watchers]) fail(error); if (!this.options.client) await this.port.close(); }
}
