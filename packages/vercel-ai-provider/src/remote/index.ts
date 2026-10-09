import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";
import { CortexRuntimeError, runtimePublicPart } from "@cortexmemory/sdk/runtime";
import type { CortexRuntimeClient, RuntimeObservation, RuntimePublicPart, RuntimeRunHandle, RuntimeToolApproval, TextSubmitV1 } from "@cortexmemory/sdk/runtime";

export interface CortexRemoteMetadata {
  version: 1; runId: string; conversationId: string; tenantId: string; memorySpaceId: string;
  definitionHash: string; attemptNumber: number; cursor: number; responseStatus: string;
  memoryStatus: string; graphStatus: string; contextCompleteness: "complete" | "incomplete" | null;
  failureCode: string | null; contextFailureCode: string | null;
}
/** A local reconnect snapshot, not authorization. Server session/identity are reverified on use. */
export interface CortexRemoteState {
  version: 1; chatId: string; handle: RuntimeRunHandle; attemptNumber: number; cursor: number;
  text: string; finalText: string; finalTextStarted: boolean;
  /** Bounded projection of server-authored references. Job/asset state is fetched freshly by the host. */
  projections?: RuntimePublicPart[];
}
export interface CortexRemoteTransportOptions {
  client: CortexRuntimeClient; agentId: string; agentVersion: number; conversationId?: string; finalOnly?: boolean;
  onRun?: (handle: RuntimeRunHandle) => void; onObservation?: (observation: RuntimeObservation) => void;
  /** Restore only from this app's retained state; no model/context/tool/authority overrides. */
  state?: CortexRemoteState;
}
interface Replay { canonical: string; request: TextSubmitV1; handle?: RuntimeRunHandle; pending?: Promise<RuntimeRunHandle> }

/** AI SDK 7 transport for one canonical remote conversation. It performs no inference or memory writing. */
export class CortexRemoteTransport<UI_MESSAGE extends UIMessage = UIMessage> implements ChatTransport<UI_MESSAGE> {
  private current?: CortexRemoteState;
  private conversationId?: string;
  private readonly replays = new Map<string, Replay>();
  private closeObservation?: () => void;
  constructor(private readonly options: CortexRemoteTransportOptions) {
    this.conversationId = options.conversationId;
    if (options.state) {
      if (options.state.version !== 1 || options.state.handle.agentId !== options.agentId || options.state.handle.agentVersion !== options.agentVersion
        || options.conversationId !== undefined && options.state.handle.conversationId !== options.conversationId
        || !Number.isSafeInteger(options.state.cursor) || options.state.cursor < 0 || !Number.isSafeInteger(options.state.attemptNumber) || options.state.attemptNumber < 0) throw new CortexRuntimeError("INVALID_RECONNECT_STATE");
      const projections = options.state.projections ?? [];
      if (!Array.isArray(projections) || projections.length > 256) throw new CortexRuntimeError("INVALID_RECONNECT_STATE");
      const restored = projections.map(runtimePublicPart);
      if (restored.some(part => !["tool", "artifact", "media-job"].includes(part.type))) throw new CortexRuntimeError("INVALID_RECONNECT_STATE");
      this.current = { ...options.state, handle: Object.freeze({ ...options.state.handle }), projections: restored };
      this.conversationId = options.state.handle.conversationId;
    }
  }
  get run(): RuntimeRunHandle | undefined { return this.current?.handle; }
  get state(): CortexRemoteState | undefined { return this.current ? { ...this.current, handle: { ...this.current.handle }, projections: this.current.projections?.map(part => ({ ...part })) } : undefined; }
  /** Close only this browser observation. The Workflow and other observers continue. */
  disconnect(): void { this.closeObservation?.(); }
  async stop(): Promise<void> { const handle = this.run; if (handle) await this.options.client.cancel(handle); this.disconnect(); }
  async approveInput(): Promise<void> { const handle = this.requireRun(); await this.options.client.approveInput(handle); await this.options.client.start(handle, { streaming: !this.options.finalOnly }); }
  async approveTool(approval: RuntimeToolApproval): Promise<void> { await this.options.client.approveTool(this.requireRun(), approval); }
  /** Attach a server-verified handle without submitting or starting any work. */
  attach(handle: RuntimeRunHandle): void {
    if (handle.agentId !== this.options.agentId || handle.agentVersion !== this.options.agentVersion) throw new CortexRuntimeError("RUN_IDENTITY_CHANGED");
    this.disconnect(); this.conversationId = handle.conversationId;
    this.current = { version: 1, chatId: "", handle: Object.freeze({ ...handle }), cursor: 0, attemptNumber: 0, text: "", finalText: "", finalTextStarted: false };
    this.options.onRun?.(handle);
  }
  setConversation(conversationId?: string): void { this.disconnect(); this.conversationId = conversationId; this.current = undefined; }
  private requireRun(): RuntimeRunHandle { if (!this.run) throw new CortexRuntimeError("RUN_REQUIRED"); return this.run; }
  private requestOptions(options: { body?: unknown; headers?: unknown; metadata?: unknown }) {
    // Host authentication belongs to ConvexClient.setAuth; chat request knobs cannot select authority/models/context.
    if (options.body !== undefined || options.headers !== undefined || options.metadata !== undefined) throw new CortexRuntimeError("UNSUPPORTED_TRANSPORT_OPTIONS");
  }
  async sendMessages(options: Parameters<ChatTransport<UI_MESSAGE>["sendMessages"]>[0]): Promise<ReadableStream<UIMessageChunk>> {
    this.requestOptions(options);
    if (options.trigger !== "submit-message") throw new CortexRuntimeError("UNSUPPORTED_REGENERATION");
    const last = options.messages[options.messages.length - 1];
    if (!last || last.role !== "user" || !last.id || !last.parts.length || last.parts.some(part => part.type !== "text")) throw new CortexRuntimeError("TEXT_ONLY_REQUEST_REQUIRED");
    const parts = last.parts.map(part => { if (part.type !== "text") throw new CortexRuntimeError("TEXT_ONLY_REQUEST_REQUIRED"); return { type: "text" as const, text: part.text }; });
    const key = JSON.stringify([options.chatId, last.id]);
    // A replay keeps its original create/existing selector even after onRun fills conversationId.
    const canonical = JSON.stringify([this.options.agentId, this.options.agentVersion, parts]);
    let replay = this.replays.get(key);
    if (replay && replay.canonical !== canonical) throw new CortexRuntimeError("IDEMPOTENCY_CONFLICT");
    if (!replay) {
      const request: TextSubmitV1 = { version: 1, agentId: this.options.agentId, agentVersion: this.options.agentVersion,
        clientRequestId: last.id, parts, ...(this.conversationId === undefined ? {} : { conversationId: this.conversationId }) };
      replay = { canonical, request }; this.replays.set(key, replay);
    }
    if (!replay.handle && !replay.pending) {
      const ownReplay = replay;
      replay.pending = this.options.client.submit(replay.request).catch(error => { ownReplay.pending = undefined; throw error; });
    }
    const handle = replay.handle ?? await replay.pending!;
    replay.handle = handle;
    this.disconnect(); this.conversationId = handle.conversationId;
    if (this.current?.handle.runId !== handle.runId) this.current = { version: 1, chatId: options.chatId, handle, cursor: 0, attemptNumber: 0, text: "", finalText: "", finalTextStarted: false };
    this.options.onRun?.(handle);
    if (options.abortSignal?.aborted) { await this.options.client.cancel(handle); throw new CortexRuntimeError("CANCELLED"); }
    await this.options.client.start(handle, { streaming: !this.options.finalOnly });
    return this.stream(options.abortSignal);
  }
  async reconnectToStream(options: Parameters<ChatTransport<UI_MESSAGE>["reconnectToStream"]>[0]): Promise<ReadableStream<UIMessageChunk> | null> {
    this.requestOptions(options);
    if (!this.current) return null;
    if (!this.current.chatId) this.current.chatId = options.chatId;
    else if (this.current.chatId !== options.chatId) throw new CortexRuntimeError("CHAT_IDENTITY_CHANGED");
    await this.options.client.get(this.current.handle);
    this.disconnect(); return this.stream(options.abortSignal);
  }
  private stream(signal?: AbortSignal): ReadableStream<UIMessageChunk> {
    const state = this.current!; const handle = state.handle; const textId = `cortex:${handle.runId}:text`;
    let stop = () => {}, active = true, textOpen = false, authorized = false;
    const metadata = (observation: RuntimeObservation): CortexRemoteMetadata => ({ version: 1, runId: handle.runId, conversationId: handle.conversationId,
      tenantId: handle.tenantId, memorySpaceId: handle.memorySpaceId, definitionHash: handle.definitionHash, attemptNumber: observation.run.attemptNumber,
      cursor: state.cursor, responseStatus: observation.run.responseStatus, memoryStatus: observation.run.memoryStatus,
      graphStatus: observation.run.graphStatus, contextCompleteness: observation.run.contextCompleteness, failureCode: observation.run.failureCode, contextFailureCode: observation.run.contextFailureCode });
    return new ReadableStream<UIMessageChunk>({ start: controller => {
      const close = () => { if (!active) return; active = false; stop(); signal?.removeEventListener("abort", abort); if (this.closeObservation === close) this.closeObservation = undefined; controller.close(); };
      const fail = (error: unknown) => { if (!active) return; active = false; stop(); signal?.removeEventListener("abort", abort); if (this.closeObservation === close) this.closeObservation = undefined;
        controller.error(error instanceof CortexRuntimeError ? error : new CortexRuntimeError("TRANSPORT_ERROR", "uncertain")); };
      const abort = () => { void this.options.client.cancel(handle).then(() => { if (active) controller.enqueue({ type: "abort", reason: "CANCELLED" }); close(); }).catch(fail); };
      const resetText = (text: string) => {
        controller.enqueue({ type: "reset-step" }); textOpen = false;
        controller.enqueue({ type: "text-start", id: textId }); textOpen = true;
        if (text) controller.enqueue({ type: "text-delta", id: textId, delta: text });
        // AI SDK reset-step replaces all message parts, including data parts.
        // Rebuild authorized server references whenever canonical text replaces deltas.
        if (authorized) for (const part of state.projections ?? []) project(part);
      };
      const project = (part: RuntimePublicPart) => {
        if (part.type === "tool") controller.enqueue({ type: "data-cortex-tool", id: part.toolCallId, data: { version: 1, runId: handle.runId, ...part } });
        else if (part.type === "artifact") controller.enqueue({ type: "data-cortex-artifact", id: part.artifactId, data: { version: 1, runId: handle.runId, ...part } });
        else if (part.type === "media-job") controller.enqueue({ type: "data-cortex-media-job", id: part.jobId, data: { runId: handle.runId, ...part } });
      };
      const projectionKey = (part: RuntimePublicPart) => part.type === "tool" ? `tool:${part.toolCallId}`
        : part.type === "artifact" ? `artifact:${part.artifactId}` : part.type === "media-job" ? `media:${part.jobId}` : "";
      const remember = (part: RuntimePublicPart) => {
        const key = projectionKey(part); if (!key) return;
        const prior = state.projections ?? [], index = prior.findIndex(value => projectionKey(value) === key);
        if (index >= 0) prior[index] = { ...part };
        else { if (prior.length >= 256) throw new CortexRuntimeError("PROJECTION_LIMIT_EXCEEDED"); prior.push({ ...part }); }
        state.projections = prior;
      };
      this.closeObservation = close;
      controller.enqueue({ type: "start", messageId: `cortex:${handle.runId}:assistant` });
      // Clear an interrupted local projection immediately. Retained text is private until
      // the current evidence-authorized observation (not metadata get) confirms this attempt.
      resetText("");
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) { abort(); return; }
      stop = this.options.client.watchObservation(handle, observation => {
        if (!active) return;
        if (observation.run.attemptNumber !== state.attemptNumber) {
          state.attemptNumber = observation.run.attemptNumber; state.cursor = 0; state.text = ""; state.finalText = ""; state.finalTextStarted = false; state.projections = []; resetText("");
        } else if (!authorized && state.text) {
          resetText(state.text);
        }
        if (!authorized) for (const part of state.projections ?? []) project(part);
        authorized = true;
        for (const event of observation.parts) {
          if (event.sequence <= state.cursor) continue;
          const part = event.part;
          if (part.type === "text-delta" && !state.finalTextStarted) {
            state.text += part.text; controller.enqueue({ type: "text-delta", id: textId, delta: part.text });
          } else if (part.type === "text") {
            // Final-only text is a complete canonical projection, not another copy of streamed deltas.
            if (!state.finalTextStarted) { state.finalTextStarted = true; state.finalText = ""; resetText(""); }
            state.finalText += part.text; state.text = state.finalText;
            controller.enqueue({ type: "text-delta", id: textId, delta: part.text });
          } else if (part.type === "tool" || part.type === "artifact" || part.type === "media-job") {
            remember(part); project(part);
          } else if (part.type === "error") controller.enqueue({ type: "data-cortex-error", data: { version: 1, code: part.code, runId: handle.runId } });
          state.cursor = event.sequence;
        }
        const value = metadata(observation);
        controller.enqueue({ type: "message-metadata", messageMetadata: value });
        controller.enqueue({ type: "data-cortex-status", id: handle.runId, data: value });
        for (const approval of observation.approvals) controller.enqueue({ type: "data-cortex-approval", id: approval.operationId, data: { version: 1, runId: handle.runId, ...approval } });
        this.options.onObservation?.(observation);
        // Drain every cursor page before response finality; memory/graph readiness are separate watches.
        if (observation.parts.length < 100 && ["complete", "failed", "cancelled"].includes(observation.run.responseStatus)) {
          if (textOpen) { controller.enqueue({ type: "text-end", id: textId }); textOpen = false; }
          if (observation.run.responseStatus === "cancelled") controller.enqueue({ type: "abort", reason: "CANCELLED" });
          else if (observation.run.responseStatus === "failed") controller.enqueue({ type: "error", errorText: observation.run.failureCode ?? "RUNTIME_OUTPUT_FAILED" });
          controller.enqueue({ type: "finish", finishReason: observation.run.responseStatus === "complete" ? "stop" : "error", messageMetadata: value }); close();
        }
      }, fail, { cursor: { attemptNumber: state.attemptNumber, sequence: state.cursor }, finalOnly: this.options.finalOnly });
      if (!active) stop();
    }, cancel: () => { this.disconnect(); } });
  }
}
