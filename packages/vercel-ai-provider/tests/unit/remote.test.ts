import { jest } from "@jest/globals";
import { readUIMessageStream } from "ai";
import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";
import type { CortexRuntimeClient, RuntimeObservation, RuntimeRun, RuntimeRunHandle, TextSubmitV1 } from "@cortexmemory/sdk/runtime";
import { CortexRemoteTransport } from "../../src/remote/index";
import { CortexRuntimeError } from "@cortexmemory/sdk/runtime";

const handle: RuntimeRunHandle = { version: 1, tenantId: "tenant", memorySpaceId: "space", principalId: "owner", runId: "run", conversationId: "conversation", agentId: "agent", agentVersion: 1, definitionHash: "definition" };
const run: RuntimeRun = { version: 1, runId: "run", conversationId: "conversation", agentId: "agent", agentVersion: 1, scope: { tenantId: "tenant", memorySpaceId: "space" },
  definitionHash: "definition", queueSequence: 1, responseStatus: "running", memoryStatus: "pending", graphStatus: "not_requested", attemptNumber: 1, cancellationRequested: false,
  inputMessageIds: ["input"], outputMessageIds: [], failureCode: null, contextCompleteness: "complete", contextFailureCode: null, createdAt: 1, updatedAt: 2 };
function fixture() {
  const subscriptions: { update: (value: RuntimeObservation) => void; error: (error: Error) => void; options: unknown; closed: boolean }[] = [];
  const client = { submit: jest.fn(async (_request: TextSubmitV1) => handle), start: jest.fn(async () => ({ state: "running" })), get: jest.fn(async () => run), cancel: jest.fn(async () => ({ cancelled: true })),
    approveInput: jest.fn(async () => run), approveTool: jest.fn(async () => ({ approved: true })),
    watchObservation: (_handle: RuntimeRunHandle, update: (value: RuntimeObservation) => void, error: (error: Error) => void, options: unknown) => {
      const row = { update, error, options, closed: false }; subscriptions.push(row); return () => { row.closed = true; };
    } };
  const onRun = jest.fn(), onObservation = jest.fn();
  const transport = new CortexRemoteTransport({ client: client as unknown as CortexRuntimeClient, agentId: "agent", agentVersion: 1, onRun, onObservation });
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
  it("submits only last ordered user text; server owns all model/tool/context choices", async () => {
    const f = fixture(); const options = send(); options.messages[1].parts.push({ type: "text", text: " second" });
    const stream = await f.transport.sendMessages(options); f.update([{ sequence: 1, part: { type: "text", text: "answer" } }], "complete"); const chunks = await drain(stream);
    expect(f.client.submit).toHaveBeenCalledTimes(1); expect(f.client.submit).toHaveBeenCalledWith({ version: 1, agentId: "agent", agentVersion: 1, clientRequestId: "message", parts: [{ type: "text", text: "hello" }, { type: "text", text: " second" }] });
    expect(f.onRun).toHaveBeenCalledWith(handle); expect(chunks.some(part => part.type === "finish")).toBe(true);
    expect(f.subscriptions[0].closed).toBe(true);
  });
  it.each(["body", "headers", "metadata"])("denies request %s knobs before any backend call", async key => {
    const f = fixture(); await expect(f.transport.sendMessages({ ...send(), [key]: { tenantId: "foreign", apiKey: "secret" } })).rejects.toMatchObject({ code: "UNSUPPORTED_TRANSPORT_OPTIONS" });
    expect(f.client.submit).not.toHaveBeenCalled();
  });
  it("rejects regeneration rather than replaying full history or creating a paid retry", async () => {
    const f = fixture(); await expect(f.transport.sendMessages({ ...send(), trigger: "regenerate-message" })).rejects.toMatchObject({ code: "UNSUPPORTED_REGENERATION" }); expect(f.client.submit).not.toHaveBeenCalled();
  });
  it.each(["assistant", "system"] as const)("rejects last %s as a user submission", async role => {
    const f = fixture(); const options = send(); options.messages[1].role = role;
    await expect(f.transport.sendMessages(options)).rejects.toMatchObject({ code: "TEXT_ONLY_REQUEST_REQUIRED" }); expect(f.client.submit).not.toHaveBeenCalled();
  });
  it("rejects media and application tool parts rather than silently dropping them", async () => {
    const f = fixture(); const options = send(); options.messages[1].parts.push({ type: "file", mediaType: "image/png", url: "https://example.invalid/private" });
    await expect(f.transport.sendMessages(options)).rejects.toMatchObject({ code: "TEXT_ONLY_REQUEST_REQUIRED" }); expect(f.client.submit).not.toHaveBeenCalled();
  });
  it("preserves create-selector/request identity on manual replay and immediate next turn uses server conversation", async () => {
    const f = fixture(); const first = await f.transport.sendMessages(send()); f.transport.disconnect(); await drain(first);
    const again = await f.transport.sendMessages(send()); f.transport.disconnect(); await drain(again); expect(f.client.submit).toHaveBeenCalledTimes(1);
    const next = await f.transport.sendMessages(send("next")); f.transport.disconnect(); await drain(next);
    expect(f.client.submit.mock.calls[1][0]).toMatchObject({ conversationId: "conversation", clientRequestId: "next" });
  });
  it("keeps original request selector after an ambiguous network submit failure", async () => {
    const f = fixture(); f.client.submit.mockRejectedValueOnce(new Error("lost response")); await expect(f.transport.sendMessages(send())).rejects.toThrow("lost response");
    const stream = await f.transport.sendMessages(send()); f.transport.disconnect(); await drain(stream);
    expect(f.client.submit.mock.calls[0][0]).toEqual(f.client.submit.mock.calls[1][0]);
  });
  it("denies changed payload for retained request ID with no second submission", async () => {
    const f = fixture(); const stream = await f.transport.sendMessages(send()); f.transport.disconnect(); await drain(stream);
    await expect(f.transport.sendMessages(send("message", "changed"))).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" }); expect(f.client.submit).toHaveBeenCalledTimes(1);
  });
  it("reconnect reconstructs one full text and skips duplicate sequence with actual SDK stream parser", async () => {
    const f = fixture(); const first = await f.transport.sendMessages(send()); f.update([{ sequence: 1, part: { type: "text-delta", text: "hel" } }]);
    f.transport.disconnect(); await drain(first); expect(f.client.cancel).not.toHaveBeenCalled();
    const resumed = await f.transport.reconnectToStream({ chatId: "chat" }); const messages: UIMessage[] = [];
    const done = (async () => { for await (const message of readUIMessageStream({ stream: resumed! })) messages.push(message); })();
    f.update([{ sequence: 1, part: { type: "text-delta", text: "hel" } }, { sequence: 2, part: { type: "text-delta", text: "lo" } },
      { sequence: 3, part: { type: "text", text: "hello" } }, { sequence: 4, part: { type: "status", state: "complete" } }], "complete"); await done;
    expect(messages.at(-1)?.parts.filter(part => part.type === "text").map(part => part.text).join("")).toBe("hello");
    expect(messages.at(-1)?.id).toBe("cortex:run:assistant"); expect(f.client.submit).toHaveBeenCalledTimes(1); expect(f.client.start).toHaveBeenCalledTimes(1);
    expect(f.subscriptions[1].options).toMatchObject({ cursor: { attemptNumber: 1, sequence: 1 } });
    expect(messages.at(-1)?.metadata).toMatchObject({ responseStatus: "complete", memoryStatus: "pending", graphStatus: "not_requested" });
  });
  it("attaches server handle and second observer without submission/start or authority fields", async () => {
    const f = fixture(); f.transport.attach(handle); const stream = await f.transport.reconnectToStream({ chatId: "observer" });
    f.update([{ sequence: 1, part: { type: "text", text: "existing" } }], "complete"); await drain(stream!);
    expect(f.client.get).toHaveBeenCalledWith(handle); expect(f.client.submit).not.toHaveBeenCalled(); expect(f.client.start).not.toHaveBeenCalled();
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
  it("explicit input approval resumes same server run rather than submitting a second input", async () => {
    const f = fixture(); const stream = await f.transport.sendMessages(send()); await f.transport.approveInput(); f.transport.disconnect(); await drain(stream);
    expect(f.client.approveInput).toHaveBeenCalledWith(handle); expect(f.client.submit).toHaveBeenCalledTimes(1); expect(f.client.start).toHaveBeenLastCalledWith(handle, { streaming: true });
  });
  it("explicit stop calls server cancellation while disconnect only closes the local observer", async () => {
    const f = fixture(); const stream = await f.transport.sendMessages(send()); await f.transport.stop(); await drain(stream);
    expect(f.client.cancel).toHaveBeenCalledTimes(1); expect(f.client.cancel).toHaveBeenCalledWith(handle); expect(f.subscriptions[0].closed).toBe(true);
  });
  it("AI SDK abort stops remote run with a typed abort and closes owned observer", async () => {
    const f = fixture(), abort = new AbortController(); const stream = await f.transport.sendMessages({ ...send(), abortSignal: abort.signal }); abort.abort(); const chunks = await drain(stream);
    expect(f.client.cancel).toHaveBeenCalledWith(handle); expect(chunks).toContainEqual({ type: "abort", reason: "CANCELLED" }); expect(f.subscriptions[0].closed).toBe(true);
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
    expect(f.client.start).toHaveBeenCalledWith(handle, { streaming: false }); expect(f.subscriptions[0].options).toMatchObject({ finalOnly: true });
  });
  it("withholds retained text until current evidence authorization and clears stale UI on denied observation", async () => {
    const f = fixture(); const transport = new CortexRemoteTransport({ client: f.client as unknown as CortexRuntimeClient, agentId: "agent", agentVersion: 1,
      state: { version: 1, chatId: "chat", handle, attemptNumber: 1, cursor: 1, text: "SENSITIVE_CACHED_TEXT", finalText: "", finalTextStarted: false } });
    const stream = await transport.reconnectToStream({ chatId: "chat" }); const reader = stream!.getReader();
    expect((await reader.read()).value).toMatchObject({ type: "start" }); expect((await reader.read()).value).toEqual({ type: "reset-step" });
    expect((await reader.read()).value).toMatchObject({ type: "text-start" });
    f.subscriptions[0].error(new CortexRuntimeError("FORBIDDEN")); await expect(reader.read()).rejects.toMatchObject({ code: "FORBIDDEN" }); reader.releaseLock();
    expect(f.client.start).not.toHaveBeenCalled(); expect(f.client.submit).not.toHaveBeenCalled();
  });
});
