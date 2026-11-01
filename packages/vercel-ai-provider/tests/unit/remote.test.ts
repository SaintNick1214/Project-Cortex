import { jest } from "@jest/globals";
import { readUIMessageStream } from "ai";
import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";
import type { RuntimeClientPort, RuntimeObservation, RuntimeRun, RuntimeRunHandle, TextSubmitV1, MemoryEffortRequest, MemoryEffortTrace } from "@cortexmemory/sdk/runtime";
import { CortexRemoteTransport } from "../../src/remote/index";
import { CortexRuntimeClient, CortexRuntimeError } from "@cortexmemory/sdk/runtime";
import { getFunctionName } from "convex/server";

const handle: RuntimeRunHandle = { version: 1, tenantId: "tenant", memorySpaceId: "space", principalId: "owner", runId: "run", conversationId: "conversation", agentId: "agent", agentVersion: 1, definitionHash: "definition" };
const run: RuntimeRun = { version: 1, runId: "run", conversationId: "conversation", agentId: "agent", agentVersion: 1, scope: { tenantId: "tenant", memorySpaceId: "space" },
  definitionHash: "definition", queueSequence: 1, responseStatus: "running", memoryStatus: "pending", graphStatus: "not_requested", attemptNumber: 1, cancellationRequested: false,
  inputMessageIds: ["input"], outputMessageIds: [], failureCode: null, contextCompleteness: "complete", contextFailureCode: null, createdAt: 1, updatedAt: 2 };
function fixture(memory?:MemoryEffortRequest) {
  const subscriptions: { update: (value: RuntimeObservation) => void; error: (error: Error) => void; options: unknown; closed: boolean }[] = [];
  const client = { submitAndStart: jest.fn(async (_request: TextSubmitV1, _options: { streaming?: boolean }) => ({ handle, run, start: { runId: run.runId, attemptNumber: 1, state: "ready" as const } })), submit: jest.fn(async (_request: TextSubmitV1) => handle), start: jest.fn(async () => ({ state: "running" })), get: jest.fn(async () => run), cancel: jest.fn(async () => ({ cancelled: true })),
    observe: jest.fn(async (_handle: RuntimeRunHandle, _options: { cursor?: { attemptNumber: number; sequence: number }; finalOnly?: boolean }): Promise<RuntimeObservation> => ({
      run: { ...run, responseStatus: "cancelled", cancellationRequested: true, failureCode: "CANCELLED" }, state: "cancelled", parts: [], cursor: 0, approvals: [],
    })),
    approveInput: jest.fn(async () => run), approveTool: jest.fn(async () => ({ approved: true })),
    watchObservation: (_handle: RuntimeRunHandle, update: (value: RuntimeObservation) => void, error: (error: Error) => void, options: unknown) => {
      const row = { update, error, options, closed: false }; subscriptions.push(row); return () => { row.closed = true; };
    } };
  const onRun = jest.fn(), onObservation = jest.fn();
  const transport = new CortexRemoteTransport({ client: client as unknown as CortexRuntimeClient, agentId: "agent", agentVersion: 1, onRun, onObservation,memory });
  const update = (parts: RuntimeObservation["parts"], responseStatus: RuntimeRun["responseStatus"] = "running", index = subscriptions.length - 1,
    extra: Partial<RuntimeObservation> = {}) => subscriptions[index].update({ run: { ...run, responseStatus }, state: responseStatus, parts,
      cursor: parts.at(-1)?.sequence ?? 0, approvals: [], ...extra });
  return { client, transport, subscriptions, update, onRun, onObservation };
}
const send = (id = "message", text = "hello"): Parameters<ChatTransport<UIMessage>["sendMessages"]>[0] => ({ trigger: "submit-message", chatId: "chat", messageId: undefined,
  abortSignal: undefined, messages: [{ id: "old", role: "assistant", parts: [{ type: "text", text: "untrusted historical context" }] }, { id, role: "user", parts: [{ type: "text", text }] }] });
async function drain(stream: ReadableStream<UIMessageChunk>) { const reader = stream.getReader(), chunks: UIMessageChunk[] = [];
  try { for (;;) { const next = await reader.read(); if (next.done) break; chunks.push(next.value); } return chunks; } finally { reader.releaseLock(); } }
describe("AI SDK 7 remote transport", () => {
  it("actual SDK transport verifies the native admission envelope and post-session before watching without separate get/start", async () => {
    const calls: string[] = [], prewatch: string[][] = [];
    const port = {
      setAuth: (_fetcher: unknown, ready: (accepted: boolean) => void) => ready(true),
      mutation: async (ref: Parameters<RuntimeClientPort["mutation"]>[0], args: Record<string, unknown>) => {
        const name = getFunctionName(ref); calls.push(name);
        if (name === "runtimeClient:session") return { version: 1, tenantId: "tenant", memorySpaceId: "space", principalId: "owner", userId: "owner" };
        if (name === "runtimeClient:submitAndStartEnvelope") {
          expect(args).toEqual({ streaming: true,
            request: { version: 1, agentId: "agent", agentVersion: 1, clientRequestId: "message", parts: [{ type: "text", text: "hello" }] } });
          return { version: 1, session: { version: 1, tenantId: "tenant", memorySpaceId: "space", principalId: "owner", userId: "owner" }, admission: { version: 1, run, start: { runId: "run", attemptNumber: 1, state: "ready" } } };
        }
        if (name === "runtimeClient:observeEnvelope") return {version:1,session:{version:1,tenantId:"tenant",memorySpaceId:"space",principalId:"owner",userId:"owner"},observation:{ run: { ...run, responseStatus: "complete" }, state: "complete", cursor: 1, approvals: [], parts: [{ sequence: 1, part: { type: "text", text: "answer" } }] }};
        throw new Error("UNEXPECTED_RPC");
      },
      query: async () => { throw new Error("PRIVATE_QUERY_PROHIBITED"); },
      action: async () => { throw new Error("PAID_CALL_PROHIBITED"); },
      onUpdate: () => { prewatch.push([...calls]); return () => {}; }, close: async () => {},
    } as unknown as RuntimeClientPort;
    const client = new CortexRuntimeClient({ deploymentUrl: "https://unit.invalid", fetchToken: async () => "opaque", client: port });
    try {
      const transport = new CortexRemoteTransport({ client, agentId: "agent", agentVersion: 1 });
      const chunks = await drain(await transport.sendMessages(send()));
      expect(prewatch[0]).toEqual(["runtimeClient:submitAndStartEnvelope", "runtimeClient:session"]);
      // Admission pins the current attempt; no redundant reset/read is needed for attempt 1.
      expect(prewatch).toHaveLength(1);
      expect(calls).toEqual(["runtimeClient:submitAndStartEnvelope", "runtimeClient:session",
        "runtimeClient:observeEnvelope", "runtimeClient:session"]);
      expect(chunks.filter(part => part.type === "text-delta")).toEqual([{ type: "text-delta", id: "cortex:run:text", delta: "answer" }]);
    } finally { await client.close(); }
  });
  it("submits only last ordered user text; server owns all model/tool/context choices", async () => {
    const f = fixture(); const options = send(); options.messages[1].parts.push({ type: "text", text: " second" });
    const stream = await f.transport.sendMessages(options); f.update([{ sequence: 1, part: { type: "text", text: "answer" } }], "complete"); const chunks = await drain(stream);
    expect(f.client.submitAndStart).toHaveBeenCalledTimes(1); expect(f.client.submitAndStart).toHaveBeenCalledWith({ version: 1, agentId: "agent", agentVersion: 1, clientRequestId: "message", parts: [{ type: "text", text: "hello" }, { type: "text", text: " second" }] }, { streaming: true });
    expect(f.onRun).toHaveBeenCalledWith(handle); expect(chunks.some(part => part.type === "finish")).toBe(true);
    expect(f.client.submit).not.toHaveBeenCalled(); expect(f.client.get).not.toHaveBeenCalled(); expect(f.client.start).not.toHaveBeenCalled();
    expect(f.subscriptions[0].closed).toBe(true);
  });
  it.each(["body", "headers", "metadata"])("denies request %s knobs before any backend call", async key => {
    const f = fixture(); await expect(f.transport.sendMessages({ ...send(), [key]: { tenantId: "foreign", apiKey: "secret" } })).rejects.toMatchObject({ code: "UNSUPPORTED_TRANSPORT_OPTIONS" });
    expect(f.client.submitAndStart).not.toHaveBeenCalled();
  });
  it("rejects regeneration rather than replaying full history or creating a paid retry", async () => {
    const f = fixture(); await expect(f.transport.sendMessages({ ...send(), trigger: "regenerate-message" })).rejects.toMatchObject({ code: "UNSUPPORTED_REGENERATION" }); expect(f.client.submitAndStart).not.toHaveBeenCalled();
  });
  it.each(["assistant", "system"] as const)("rejects last %s as a user submission", async role => {
    const f = fixture(); const options = send(); options.messages[1].role = role;
    await expect(f.transport.sendMessages(options)).rejects.toMatchObject({ code: "TEXT_ONLY_REQUEST_REQUIRED" }); expect(f.client.submitAndStart).not.toHaveBeenCalled();
  });
  it("rejects media and application tool parts rather than silently dropping them", async () => {
    const f = fixture(); const options = send(); options.messages[1].parts.push({ type: "file", mediaType: "image/png", url: "https://example.invalid/private" });
    await expect(f.transport.sendMessages(options)).rejects.toMatchObject({ code: "TEXT_ONLY_REQUEST_REQUIRED" }); expect(f.client.submitAndStart).not.toHaveBeenCalled();
  });
  it("preserves create-selector/request identity on manual replay and immediate next turn uses server conversation", async () => {
    const f = fixture(); const first = await f.transport.sendMessages(send()); f.transport.disconnect(); await drain(first);
    const again = await f.transport.sendMessages(send()); f.transport.disconnect(); await drain(again); expect(f.client.submitAndStart).toHaveBeenCalledTimes(1);
    const next = await f.transport.sendMessages(send("next")); f.transport.disconnect(); await drain(next);
    expect(f.client.submitAndStart.mock.calls[1][0]).toMatchObject({ conversationId: "conversation", clientRequestId: "next" });
  });
  it("keeps original request selector after an ambiguous network submit failure", async () => {
    const f = fixture(); f.client.submitAndStart.mockRejectedValueOnce(new Error("lost response")); await expect(f.transport.sendMessages(send())).rejects.toThrow("lost response");
    const stream = await f.transport.sendMessages(send()); f.transport.disconnect(); await drain(stream);
    expect(f.client.submitAndStart.mock.calls[0][0]).toEqual(f.client.submitAndStart.mock.calls[1][0]);
  });
  it("denies changed payload for retained request ID with no second submission", async () => {
    const f = fixture(); const stream = await f.transport.sendMessages(send()); f.transport.disconnect(); await drain(stream);
    await expect(f.transport.sendMessages(send("message", "changed"))).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" }); expect(f.client.submitAndStart).toHaveBeenCalledTimes(1);
  });
  it("reconnect reconstructs one full text and skips duplicate sequence with actual SDK stream parser", async () => {
    const f = fixture(); const first = await f.transport.sendMessages(send()); f.update([{ sequence: 1, part: { type: "text-delta", text: "hel" } }]);
    f.transport.disconnect(); await drain(first); expect(f.client.cancel).not.toHaveBeenCalled();
    const resumed = await f.transport.reconnectToStream({ chatId: "chat" }); const messages: UIMessage[] = [];
    const done = (async () => { for await (const message of readUIMessageStream({ stream: resumed! })) messages.push(message); })();
    f.update([{ sequence: 1, part: { type: "text-delta", text: "hel" } }, { sequence: 2, part: { type: "text-delta", text: "lo" } },
      { sequence: 3, part: { type: "text", text: "hello" } }, { sequence: 4, part: { type: "status", state: "complete" } }], "complete"); await done;
    expect(messages.at(-1)?.parts.filter(part => part.type === "text").map(part => part.text).join("")).toBe("hello");
    expect(messages.at(-1)?.id).toBe("cortex:run:assistant"); expect(f.client.submitAndStart).toHaveBeenCalledTimes(1); expect(f.client.start).not.toHaveBeenCalled();
    expect(f.subscriptions[1].options).toMatchObject({ cursor: { attemptNumber: 1, sequence: 1 } });
    expect(messages.at(-1)?.metadata).toMatchObject({ responseStatus: "complete", memoryStatus: "pending", graphStatus: "not_requested" });
  });
  it("attaches server handle and second observer without submission/start or authority fields", async () => {
    const f = fixture(); f.transport.attach(handle); const stream = await f.transport.reconnectToStream({ chatId: "observer" });
    f.update([{ sequence: 1, part: { type: "text", text: "existing" } }], "complete"); await drain(stream!);
    expect(f.client.get).toHaveBeenCalledWith(handle); expect(f.client.submitAndStart).not.toHaveBeenCalled(); expect(f.client.start).not.toHaveBeenCalled();
    await expect(f.transport.reconnectToStream({ chatId: "other" })).rejects.toMatchObject({ code: "CHAT_IDENTITY_CHANGED" });
  });
  it("restores retained cursor/prefix and resets text when native attempt changes", async () => {
    const f = fixture(); f.transport.attach(handle); const stream = await f.transport.reconnectToStream({ chatId: "chat" }); f.update([{ sequence: 1, part: { type: "text-delta", text: "old" } }]);
    f.transport.disconnect(); await drain(stream!); const saved = f.transport.state!;
    const next = new CortexRemoteTransport({ client: f.client as unknown as CortexRuntimeClient, agentId: "agent", agentVersion: 1, state: saved });
    const resumed = await next.reconnectToStream({ chatId: "chat" });
    f.update([{ sequence: 1, part: { type: "text", text: "new" } }], "complete", undefined, { run: { ...run, attemptNumber: 2, responseStatus: "complete" } });
    const chunks = await drain(resumed!); expect(chunks.filter(part => part.type === "text-delta").map(part => part.delta).join("")).toBe("new"); expect(next.state).toMatchObject({ attemptNumber: 2, cursor: 1, text: "new" });
  });
  it("publishes redacted tool, approval and artifact DTOs without SDK tool execution", async () => {
    const f = fixture(); const stream = await f.transport.sendMessages(send());
    const approval = { operationId: "op", toolName: "memory_remember", requestHash: "hash" };
    f.update([{ sequence: 1, part: { type: "tool", toolCallId: "call", name: "memory_remember", phase: "requested" } },
      { sequence: 2, part: { type: "artifact", artifactId: "receipt", kind: "memory-receipt" } }], "waiting_approval", undefined, { approvals: [approval] });
    await f.transport.approveTool(approval); expect(f.client.approveTool).toHaveBeenCalledWith(handle, approval);
    f.transport.disconnect(); const chunks = await drain(stream);
    expect(chunks.some(part => part.type === "data-cortex-approval")).toBe(true); expect(chunks.some(part => part.type.startsWith("tool-"))).toBe(false);
    expect(chunks.some(part => part.type === "data-cortex-artifact")).toBe(true);
  });
  it("restores backend tool, artifact and media-job references across restart using the actual UI parser", async () => {
    const f = fixture(); const first = await f.transport.sendMessages(send());
    const parts: RuntimeObservation["parts"] = [
      { sequence: 1, part: { type: "tool", toolCallId: "call", name: "media_image_generate", phase: "succeeded" } },
      { sequence: 2, part: { type: "artifact", artifactId: "receipt", kind: "memory-receipt" } },
      { sequence: 3, part: { type: "media-job", version: 1, jobId: "job", artifactId: "image", kind: "image" } },
    ];
    f.update(parts); f.transport.disconnect(); await drain(first);
    const saved = f.transport.state!; expect(saved.projections).toHaveLength(3);
    const next = new CortexRemoteTransport({ client: f.client as unknown as CortexRuntimeClient, agentId: "agent", agentVersion: 1, state: saved });
    const resumed = await next.reconnectToStream({ chatId: "chat" }); const messages: UIMessage[] = [];
    const done = (async () => { for await (const message of readUIMessageStream({ stream: resumed! })) messages.push(message); })();
    f.update([...parts, { sequence: 4, part: { type: "text", text: "Your image is processing." } }], "complete"); await done;
    const restored = messages.at(-1)!.parts;
    expect(restored.filter(part => part.type === "data-cortex-tool")).toHaveLength(1);
    expect(restored.filter(part => part.type === "data-cortex-artifact")).toHaveLength(1);
    expect(restored.filter(part => part.type === "data-cortex-media-job")).toHaveLength(1);
    expect(f.client.submitAndStart).toHaveBeenCalledTimes(1); expect(f.client.start).not.toHaveBeenCalled();
    expect(next.state!.projections).toHaveLength(3);
  });
  it("withholds restored job references until current evidence authorization", async () => {
    const f = fixture(); const transport = new CortexRemoteTransport({ client: f.client as unknown as CortexRuntimeClient, agentId: "agent", agentVersion: 1,
      state: { version: 1, chatId: "chat", handle, attemptNumber: 1, cursor: 3, text: "", finalText: "", finalTextStarted: false,
        projections: [{ type: "media-job", version: 1, jobId: "private-job", artifactId: "private-artifact", kind: "video" }] } });
    const stream = await transport.reconnectToStream({ chatId: "chat" }), reader = stream!.getReader();
    expect((await reader.read()).value!.type).toBe("start"); expect((await reader.read()).value!.type).toBe("reset-step"); expect((await reader.read()).value!.type).toBe("text-start");
    f.subscriptions[0].error(new CortexRuntimeError("FORBIDDEN")); await expect(reader.read()).rejects.toMatchObject({ code: "FORBIDDEN" }); reader.releaseLock();
    expect(f.client.start).not.toHaveBeenCalled(); expect(f.client.submitAndStart).not.toHaveBeenCalled();
  });
  it("explicit input approval resumes same server run rather than submitting a second input", async () => {
    const f = fixture(); const stream = await f.transport.sendMessages(send()); await f.transport.approveInput(); f.transport.disconnect(); await drain(stream);
    expect(f.client.approveInput).toHaveBeenCalledWith(handle); expect(f.client.submitAndStart).toHaveBeenCalledTimes(1); expect(f.client.start).toHaveBeenLastCalledWith(handle, { streaming: true });
  });
  it("explicit stop calls server cancellation while disconnect only closes the local observer", async () => {
    const f = fixture(); const stream = await f.transport.sendMessages(send()); await f.transport.stop(); await drain(stream);
    expect(f.client.cancel).toHaveBeenCalledTimes(1); expect(f.client.cancel).toHaveBeenCalledWith(handle); expect(f.subscriptions[0].closed).toBe(true);
  });
  it("stop projects a fresh cancelled observation before closing a waiting-approval attachment", async () => {
    const f = fixture(); f.transport.attach(handle); const stream = await f.transport.reconnectToStream({ chatId: "chat" });
    f.update([{ sequence: 1, part: { type: "tool", toolCallId: "call", name: "memory_recall", phase: "requested" } }], "waiting_approval");
    const observed: RuntimeObservation = { run: { ...run, responseStatus: "cancelled", cancellationRequested: true, failureCode: "CANCELLED" },
      state: "cancelled", parts: [{ sequence: 2, part: { type: "status", state: "cancelled" } }], cursor: 2, approvals: [] };
    f.client.observe.mockImplementationOnce(async () => { expect(f.subscriptions[0].closed).toBe(false); return observed; });
    await f.transport.stop();
    const messages: UIMessage[] = []; for await (const message of readUIMessageStream({ stream: stream! })) messages.push(message);
    expect(f.client.observe).toHaveBeenCalledTimes(1);
    expect(f.client.observe).toHaveBeenCalledWith(handle, { cursor: { attemptNumber: 1, sequence: 1 }, finalOnly: undefined });
    expect(f.client.cancel.mock.invocationCallOrder[0]).toBeLessThan(f.client.observe.mock.invocationCallOrder[0]);
    expect(f.onObservation).toHaveBeenLastCalledWith(observed);
    expect(messages.at(-1)?.metadata).toMatchObject({ runId: handle.runId, responseStatus: "cancelled", failureCode: "CANCELLED", cursor: 2 });
    expect(f.transport.state).toMatchObject({ attemptNumber: 1, cursor: 2 }); expect(f.subscriptions[0].closed).toBe(true);
    expect(f.client.submitAndStart).not.toHaveBeenCalled(); expect(f.client.start).not.toHaveBeenCalled(); expect(f.client.approveTool).not.toHaveBeenCalled();
  });
  it("stop reports the actual observed state rather than fabricating cancellation", async () => {
    const f = fixture(); f.transport.attach(handle);
    const observed: RuntimeObservation = { run, state: "running", parts: [], cursor: 0, approvals: [] };
    f.client.observe.mockResolvedValueOnce(observed); await f.transport.stop();
    expect(f.onObservation).toHaveBeenCalledTimes(1); expect(f.onObservation).toHaveBeenCalledWith(observed); expect(f.transport.run).toEqual(handle);
    expect(f.client.submitAndStart).not.toHaveBeenCalled(); expect(f.client.start).not.toHaveBeenCalled();
  });
  it("cancel failure propagates without observing, publishing terminal metadata, or closing the observer", async () => {
    const f = fixture(), error = new CortexRuntimeError("FORBIDDEN"); const stream = await f.transport.sendMessages(send());
    f.client.cancel.mockRejectedValueOnce(error); await expect(f.transport.stop()).rejects.toBe(error);
    expect(f.client.observe).not.toHaveBeenCalled(); expect(f.onObservation).not.toHaveBeenCalled(); expect(f.subscriptions[0].closed).toBe(false);
    f.transport.disconnect(); await drain(stream);
  });
  it("fresh observation failure propagates without publishing cached or invented metadata", async () => {
    const f = fixture(), error = new CortexRuntimeError("SESSION_CHANGED", "uncertain"); const stream = await f.transport.sendMessages(send());
    f.client.observe.mockRejectedValueOnce(error); await expect(f.transport.stop()).rejects.toBe(error);
    expect(f.client.cancel).toHaveBeenCalledTimes(1); expect(f.onObservation).not.toHaveBeenCalled(); expect(f.subscriptions[0].closed).toBe(false);
    f.transport.disconnect(); await drain(stream);
  });
  it.each([false, true])("stop uses actual SDK observation and its fresh post-I/O session fence (changed=%s)", async changed => {
    const calls: string[] = [], session = { version: 1, tenantId: "tenant", memorySpaceId: "space", principalId: "owner", userId: "owner" };
    const observed: RuntimeObservation = { run: { ...run, responseStatus: "cancelled", cancellationRequested: true, failureCode: "CANCELLED" },
      state: "cancelled", parts: [], cursor: 0, approvals: [] };
    const port = {
      setAuth: (_fetcher: unknown, ready: (accepted: boolean) => void) => ready(true),
      mutation: async (ref: Parameters<RuntimeClientPort["mutation"]>[0], args: Record<string, unknown>) => {
        const name = getFunctionName(ref); calls.push(name);
        if (name === "runtimeClient:session") return changed && calls.includes("runtimeClient:observeEnvelope") ? { ...session, principalId: "other" } : session;
        if (name === "runtimeAgent:cancel") { expect(args).toEqual({ tenantId: "tenant", memorySpaceId: "space", runId: "run" }); return { cancelled: true }; }
        if (name === "runtimeClient:observeEnvelope") {
          expect(args).toEqual({ afterSequence: 0, limit: 100, finalOnly: true, handle });
          return { version: 1, session, observation: observed };
        }
        throw new Error("UNEXPECTED_RPC");
      },
      query: async () => { throw new Error("PRIVATE_QUERY_PROHIBITED"); },
      action: async () => { throw new Error("PAID_CALL_PROHIBITED"); }, close: async () => {},
    } as unknown as RuntimeClientPort;
    const client = new CortexRuntimeClient({ deploymentUrl: "https://unit.invalid", fetchToken: async () => "opaque", client: port });
    const onObservation = jest.fn();
    try {
      const transport = new CortexRemoteTransport({ client, agentId: "agent", agentVersion: 1, finalOnly: true, onObservation }); transport.attach(handle);
      if (changed) { await expect(transport.stop()).rejects.toMatchObject({ code: "SESSION_CHANGED", outcome: "uncertain" }); expect(onObservation).not.toHaveBeenCalled(); }
      else { await transport.stop(); expect(onObservation).toHaveBeenCalledTimes(1); expect(onObservation).toHaveBeenCalledWith(observed); }
      // A newly attached handle has attempt 0; the SDK resets the cursor after
      // observing the canonical attempt. Every observation retains its session fence.
      expect(calls).toEqual(["runtimeClient:session", "runtimeAgent:cancel", "runtimeClient:session", "runtimeClient:observeEnvelope", "runtimeClient:session",
        ...(changed ? [] : ["runtimeClient:observeEnvelope", "runtimeClient:session"])]);
    } finally { await client.close(); }
  });
  it.each(["attach", "conversation", "reconnect"] as const)("does not observe or close a new %s while cancellation is pending", async change => {
    const f = fixture(); const first = await f.transport.sendMessages(send()); let release = () => {};
    f.client.cancel.mockImplementationOnce(async () => await new Promise(resolve => { release = () => resolve({ cancelled: true }); }));
    const pending = f.transport.stop();
    if (change === "attach") f.transport.attach(handle);
    if (change === "conversation") { f.transport.setConversation("other"); f.transport.attach({ ...handle, runId: "other", conversationId: "other" }); }
    const resumed = await f.transport.reconnectToStream({ chatId: "chat" });
    release(); await pending;
    expect(f.client.observe).not.toHaveBeenCalled(); expect(f.onObservation).not.toHaveBeenCalled(); expect(f.subscriptions[1].closed).toBe(false);
    f.transport.disconnect(); await drain(first); await drain(resumed!);
  });
  it.each(["attach", "conversation", "reconnect"] as const)("does not publish or close a new %s while fresh observation is pending", async change => {
    const f = fixture(); const first = await f.transport.sendMessages(send()); let release = (_value: RuntimeObservation) => {};
    f.client.observe.mockImplementationOnce(async () => await new Promise(resolve => { release = resolve; }));
    const pending = f.transport.stop(); await Promise.resolve(); expect(f.client.observe).toHaveBeenCalledTimes(1);
    if (change === "attach") f.transport.attach(handle);
    if (change === "conversation") { f.transport.setConversation("other"); f.transport.attach({ ...handle, runId: "other", conversationId: "other" }); }
    const resumed = await f.transport.reconnectToStream({ chatId: "chat" });
    release({ run: { ...run, responseStatus: "cancelled" }, state: "cancelled", parts: [], cursor: 0, approvals: [] }); await pending;
    expect(f.onObservation).not.toHaveBeenCalled(); expect(f.subscriptions[1].closed).toBe(false);
    f.transport.disconnect(); await drain(first); await drain(resumed!);
  });
  it("AI SDK abort stops remote run with a typed abort and closes owned observer", async () => {
    const f = fixture(), abort = new AbortController(); const stream = await f.transport.sendMessages({ ...send(), abortSignal: abort.signal }); abort.abort(); const chunks = await drain(stream);
    expect(f.client.cancel).toHaveBeenCalledWith(handle); expect(chunks).toContainEqual({ type: "abort", reason: "CANCELLED" }); expect(f.subscriptions[0].closed).toBe(true);
  });
  it("abort during combined admission cancels the accepted handle before attaching any observer", async () => {
    const f = fixture(), abort = new AbortController();
    let release = (_result: Awaited<ReturnType<typeof f.client.submitAndStart>>) => {};
    f.client.submitAndStart.mockImplementation(async () => await new Promise(resolve => { release = resolve; }));
    const pending = f.transport.sendMessages({ ...send(), abortSignal: abort.signal });
    abort.abort(); release({ handle, run, start: { runId: "run", attemptNumber: 1, state: "ready" } });
    await expect(pending).rejects.toMatchObject({ code: "CANCELLED" });
    expect(f.client.cancel).toHaveBeenCalledTimes(1); expect(f.client.cancel).toHaveBeenCalledWith(handle); expect(f.subscriptions).toEqual([]);
    expect(f.client.submit).not.toHaveBeenCalled(); expect(f.client.start).not.toHaveBeenCalled();
  });
  it("waits for terminal cursor drainage and keeps delayed memory distinct from response completion", async () => {
    const f = fixture(); const stream = await f.transport.sendMessages(send());
    f.update(Array.from({ length: 100 }, (_, i) => ({ sequence: i + 1, part: { type: "text-delta", text: "a" } })), "complete"); expect(f.subscriptions[0].closed).toBe(false);
    f.update([{ sequence: 101, part: { type: "text", text: "done" } }, { sequence: 102, part: { type: "status", state: "complete" } }], "complete");
    const chunks = await drain(stream); expect(chunks.filter(part => part.type === "finish")).toHaveLength(1);
    expect(chunks.at(-1)).toMatchObject({ type: "finish", messageMetadata: { memoryStatus: "pending", responseStatus: "complete" } });
  });
  it("final-only config reaches backend streaming=false and no partial text leaks", async () => {
    const f = fixture(); const transport = new CortexRemoteTransport({ client: f.client as unknown as CortexRuntimeClient, agentId: "agent", agentVersion: 1, finalOnly: true });
    const stream = await transport.sendMessages(send()); f.update([{ sequence: 1, part: { type: "text", text: "final" } }], "complete"); await drain(stream);
    expect(f.client.submitAndStart).toHaveBeenCalledWith(expect.anything(), { streaming: false }); expect(f.client.start).not.toHaveBeenCalled(); expect(f.subscriptions[0].options).toMatchObject({ finalOnly: true });
  });
  it("withholds retained text until current evidence authorization and clears stale UI on denied observation", async () => {
    const f = fixture(); const transport = new CortexRemoteTransport({ client: f.client as unknown as CortexRuntimeClient, agentId: "agent", agentVersion: 1,
      state: { version: 1, chatId: "chat", handle, attemptNumber: 1, cursor: 1, text: "SENSITIVE_CACHED_TEXT", finalText: "", finalTextStarted: false } });
    const stream = await transport.reconnectToStream({ chatId: "chat" }); const reader = stream!.getReader();
    expect((await reader.read()).value).toMatchObject({ type: "start" }); expect((await reader.read()).value).toEqual({ type: "reset-step" });
    expect((await reader.read()).value).toMatchObject({ type: "text-start" });
    f.subscriptions[0].error(new CortexRuntimeError("FORBIDDEN")); await expect(reader.read()).rejects.toMatchObject({ code: "FORBIDDEN" }); reader.releaseLock();
    expect(f.client.start).not.toHaveBeenCalled(); expect(f.client.submitAndStart).not.toHaveBeenCalled();
  });
});


describe("remote memory effort request and trace",()=>{
  it("snapshots a default request and per-message overrides without changing the pending request",async()=>{
    const memory:MemoryEffortRequest={effort:"fast"},f=fixture(memory);memory.effort="max";
    const first=await f.transport.sendMessages(send());f.transport.disconnect();await drain(first);
    expect(f.client.submitAndStart.mock.calls[0][0].memory).toEqual({effort:"fast"});
    const next=await f.transport.sendMessages({...send("next"),body:{memory:{effort:"high",maxEntries:2}}});f.transport.disconnect();await drain(next);
    expect(f.client.submitAndStart.mock.calls[1][0].memory).toEqual({effort:"high",maxEntries:2});
    expect(f.client.submitAndStart.mock.calls[0][0].memory).toEqual({effort:"fast"});
  });
  it("normalizes equivalent replay controls but rejects changed effort without a duplicate dispatch",async()=>{
    const f=fixture(),first=await f.transport.sendMessages({...send(),body:{memory:{}}});f.transport.disconnect();await drain(first);
    const replay=await f.transport.sendMessages({...send(),body:{memory:{effort:"normal"}}});f.transport.disconnect();await drain(replay);
    expect(f.client.submitAndStart).toHaveBeenCalledTimes(1);
    await expect(f.transport.sendMessages({...send(),body:{memory:{effort:"max"}}})).rejects.toMatchObject({code:"IDEMPOTENCY_CONFLICT"});
    expect(f.client.submitAndStart).toHaveBeenCalledTimes(1);
    await expect(f.transport.reconnectToStream({chatId:"chat",body:{memory:{effort:"fast"}}})).rejects.toMatchObject({code:"UNSUPPORTED_TRANSPORT_OPTIONS"});
    expect(f.client.start).not.toHaveBeenCalled();
  });
  it.each([undefined,null,[],{effort:"instant"},{maxEntries:-1},{maxContextTokens:0},{maxDepth:8},{effort:"normal",apiKey:"private"}])("refuses invalid memory %j before any backend call",async memory=>{
    const f=fixture();await expect(f.transport.sendMessages({...send(),body:{memory}})).rejects.toMatchObject({code:"INVALID_INPUT"});expect(f.client.submitAndStart).not.toHaveBeenCalled();
  });
  it("refuses memory accessors without invoking caller code",async()=>{
    const f=fixture(),get=jest.fn(()=>({effort:"max"}));
    await expect(f.transport.sendMessages({...send(),body:Object.defineProperty({},"memory",{get,enumerable:true})})).rejects.toMatchObject({code:"UNSUPPORTED_TRANSPORT_OPTIONS"});
    await expect(f.transport.sendMessages({...send(),body:{memory:Object.defineProperty({},"effort",{get,enumerable:true})}})).rejects.toMatchObject({code:"INVALID_INPUT"});
    expect(get).not.toHaveBeenCalled();expect(f.client.submitAndStart).not.toHaveBeenCalled();
  });
  it("carries server effective limits/stops in official AI7 message metadata and status",async()=>{
    const f=fixture(),trace:MemoryEffortTrace={version:1,policyVersion:"memory-effort-v1",requestedEffort:"max",effectiveEffort:"max",maxDepth:null,maxEntries:null,maxContextTokens:4096,targetFirstAnswerMs:30000,reachedDepth:10,visited:20,expanded:10,selected:9,deduplicated:1,entriesByKind:{memory:4,fact:5,pending:0,history:0},selectedInputUnits:100,durationMs:123,stopReasons:["input"],unavailableStages:["external_graph"]};
    const stream=await f.transport.sendMessages({...send(),body:{memory:{effort:"max"}}});f.update([{sequence:1,part:{type:"text",text:"answer"}}],"complete",undefined,{run:{...run,responseStatus:"complete",memoryEffort:trace}});
    const messages:UIMessage[]=[];for await(const message of readUIMessageStream({stream}))messages.push(message);
    expect(messages.at(-1)?.metadata).toMatchObject({memoryEffort:trace});expect(f.client.submitAndStart).toHaveBeenCalledTimes(1);expect(f.subscriptions[0].closed).toBe(true);
  });
});
