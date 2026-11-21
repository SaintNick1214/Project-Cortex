/** Actual installed Agent stream handlers and source erasure, with paused component scheduling.
 * Retained streams deliberately model pre-upgrade native copies; no provider/hosted OCC claim.
 */
import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import { saveMessages } from "@convex-dev/agent";
import { canonicalModelJson } from "../../../src/domain/model-policy";
jest.unstable_mockModule("@convex-dev/workflow", () => ({ WorkflowManager: class {
  define(value: { handler: unknown }) { return { _handler: value.handler }; }
  async start() { return "workflow:native-streams"; }
  async cancel() {}
} }));
const { installIngestionMockRoot } = await import("../runtimeIngestion/fixture");
const { dependencyFixture, generated } = await import("./agent-dependency-fixture");
const { nativeStreamFixture } = await import("./native-stream-fixture");
const agent = await import("../../../convex-dev/runtimeAgent");
const transcript = await import("../../../convex-dev/runtimeTranscript");
const erasure = await import("../../../convex-dev/runtimeExternalErasure");

beforeEach(() => installIngestionMockRoot());
afterEach(() => { jest.restoreAllMocks(); });
type Fixture = Awaited<ReturnType<typeof dependencyFixture>>;
type Root = Awaited<ReturnType<Fixture["external"]>>;
type Native = ReturnType<typeof nativeStreamFixture>;
type Message = { _id: string; threadId: string; order: number; stepOrder: number; agentName?: string };
type Completion = { complete: boolean };

async function execution() {
  const f = await dependencyFixture(), root = await f.external(), { attempt } = await f.start();
  await f.call(agent.saveContext, { ...attempt, context: root.source.content, witnesses: [root.witness], completeness: "complete" });
  const prepared = await f.call<{ state: string; op: { operationId: string } }>(agent.prepareModelOperation, { ...attempt, ordinal: 0 });
  expect(prepared.state).toBe("started");
  const saved = await f.call<{ savedMessageIds: string[] }>(agent.finishGeneratedOperation, { ...attempt, operationId: prepared.op.operationId,
    messagesCanonical: canonicalModelJson([{ role: "assistant", content: root.source.content }]) });
  const message = f.native.messages.get(saved.savedMessageIds[0])!;
  // The existing saveMessages port omits native generation metadata. Restore
  // only the retained row's agent identity; canonical content pins stay intact.
  message.agentName = "cortex:managed-evidence";
  expect(f.db.table("runtimeAgentExecutions")[0].savedMessagePins).toEqual([expect.objectContaining({ id: message._id })]);
  return { f, root, message: message as unknown as Message, native: nativeStreamFixture(f) };
}
async function stream(native: Native, message: Message, text: string, count = 1, state: "streaming" | "finished" | "aborted" = "finished", fileId?: string) {
  const id = await native.call<string>(native.streams.create, { threadId: message.threadId, order: message.order, stepOrder: message.stepOrder,
    agentName: message.agentName, format: "UIMessageChunk" });
  for (let index = 0; index < count; index++) expect(await native.call(native.streams.addDelta, { streamId: id, start: index, end: index + 1,
    parts: [{ type: "text-delta", id: "source-copy", delta: text }], ...(index === 0 && fileId ? { fileRefs: [{ url: "https://controlled.test/private", fileId }] } : {}) })).toBe(true);
  if (state === "finished") await native.call(native.streams.finish, { streamId: id });
  if (state === "aborted") await native.call(native.streams.abort, { streamId: id, reason: "retained-aborted-run" });
  return id;
}
const deltaCount = (native: Native, streamId: string) => [...native.table("streamDeltas").values()].filter(row => row.streamId === streamId).length;
async function advanceUntil(f: Fixture, root: Root, predicate: () => boolean) {
  for (let index = 0; index < 80; index++) {
    const result = await f.call<Completion>(erasure.continueSource, root.scope);
    if (predicate()) return result;
    expect(result.complete).toBe(false);
  }
  throw new Error("Source erasure did not reach the bounded checkpoint");
}
async function purge(f: Fixture, root: Root) {
  for (let index = 0; index < 200; index++) if ((await f.call<Completion>(erasure.continueSource, root.scope)).complete) return;
  throw new Error("Source erasure did not complete");
}

it.each(["streaming", "finished", "aborted"] as const)("retained %s execution streams drain bounded pages before completion and release exact ownership", async status => {
  const { f, root, message, native } = await execution();
  const fileId = native.seed("files", { refcount: 1, storageId: "owned-storage", hash: "owned-file", lastTouchedAt: Date.now() });
  const embeddingId = native.seed("embeddings_128", { model: "controlled", table: "messages", vector: Array(128).fill(1) });
  Object.assign(f.native.messages.get(message._id)!, { fileIds: [fileId], embeddingId });
  const streamId = await stream(native, message, root.source.content, 2501, status, fileId);
  expect(native.table("files").get(fileId)?.refcount).toBe(2);
  const neighbors = await saveMessages(f.ctx, transcript.agentComponent, { threadId: message.threadId, order: message.order + 1,
    messages: [{ role: "user", content: root.source.content }, { role: "assistant", content: root.source.content }] });
  const neighbor = neighbors.messages[1] as unknown as Message;
  const unrelated = await stream(native, neighbor, root.source.content);
  const authored = neighbors.messages[0]._id;
  await f.call(erasure.eraseSource, root.scope);
  const partial = await advanceUntil(f, root, () => deltaCount(native, streamId) < 2501);
  expect(partial.complete).toBe(false); expect(deltaCount(native, streamId)).toBe(1501);
  expect(f.native.messages.has(message._id)).toBe(true);
  expect(native.table("streamingMessages").get(streamId)?.state).toMatchObject({ kind: status === "streaming" ? "aborted" : status });
  expect(native.table("files").get(fileId)?.refcount).toBe(2); expect(native.table("embeddings_128").has(embeddingId)).toBe(true);
  // abort happens before draining, so a writer cannot replenish the exact stream.
  expect(await native.call(native.streams.addDelta, { streamId, start: 3000, end: 3001, parts: [{ type: "text-delta", delta: root.source.content }] })).toBe(false);
  expect(native.scheduled.some(job => job.delay === 0 && job.args.streamId === streamId && job.state.kind === "pending")).toBe(true);
  // No background worker runs implicitly. Resume one owning bounded continuation.
  await native.resumeDeletion(streamId);
  expect(deltaCount(native, streamId)).toBe(501); expect(f.native.messages.has(message._id)).toBe(true);
  expect(f.db.table("runtimeExternalErasureJobs")[0].complete).toBe(false);
  await purge(f, root);
  expect(deltaCount(native, streamId)).toBe(0); expect(native.table("streamingMessages").has(streamId)).toBe(false);
  expect(f.native.messages.has(message._id)).toBe(false); expect(native.table("embeddings_128").has(embeddingId)).toBe(false);
  expect(native.table("files").get(fileId)?.refcount).toBe(0);
  expect(f.native.messages.get(authored)?.message).toMatchObject({ role: "user", content: root.source.content });
  expect(f.native.messages.get(neighbor._id)?.message).toMatchObject({ role: "assistant", content: root.source.content });
  expect(native.table("streamingMessages").has(unrelated)).toBe(true); expect(deltaCount(native, unrelated)).toBe(1);
  const deletions = native.calls.filter(call => call.path.endsWith("/streams/deleteStreamAsync"));
  expect(deletions.every(call => call.args.streamId === streamId && call.before - call.after <= 1000)).toBe(true);
  expect(deletions.length).toBeGreaterThanOrEqual(3);
  expect(native.calls.filter(call => call.path.endsWith("/streams/list")).every(call => call.args.startOrder === message.order
    && canonicalModelJson(call.args.statuses) === canonicalModelJson(["streaming", "finished", "aborted"]))).toBe(true);
});

it("exactly 1000 transcript deltas need the second empty-page deletion to release the header and file refs", async () => {
  const f = await dependencyFixture(), root = await f.external(), history = await generated(f, root.witness), native = nativeStreamFixture(f);
  const message = f.native.messages.get(history.assistant.nativeMessageId)! as unknown as Message;
  const fileId = native.seed("files", { refcount: 0, hash: "transcript-file", storageId: "transcript-storage", lastTouchedAt: Date.now() });
  const streamId = await stream(native, message, root.source.content, 1000, "finished", fileId);
  expect(native.table("files").get(fileId)?.refcount).toBe(1);
  await f.call(erasure.eraseSource, root.scope); await purge(f, root);
  const deletion = native.calls.filter(call => call.path.endsWith("/streams/deleteStreamAsync") && call.args.streamId === streamId);
  expect(deletion.map(call => call.before - call.after)).toEqual([1000, 0]);
  expect(native.calls.some(call => call.path.endsWith("/streams/listDeltas") && canonicalModelJson(call.args.cursors) === canonicalModelJson([{ streamId, cursor: 0 }]))).toBe(true);
  expect(deltaCount(native, streamId)).toBe(0); expect(native.table("streamingMessages").has(streamId)).toBe(false);
  expect(native.table("files").get(fileId)?.refcount).toBe(0);
  expect(f.native.messages.has(message._id)).toBe(false);
  expect(f.db.table("runtimeTranscriptMessages").find(row => row._id === history.assistant._id)?.sourceErasedAt).toBeDefined();
  expect(f.native.messages.has(history.user.nativeMessageId)).toBe(true);
  expect(native.scheduled.find(job => job.args.streamId === streamId && job.delay === 300_000)?.state.kind).toBe("cancelled");
});

it("owning message deletion alone leaves finished private stream bytes until explicit stream cleanup", async () => {
  const { f, root, message, native } = await execution();
  const streamId = await stream(native, message, root.source.content);
  await native.call(native.messages.deleteByIds, { messageIds: [message._id] });
  expect(f.native.messages.has(message._id)).toBe(false);
  expect(native.table("streamingMessages").get(streamId)?.state).toMatchObject({ kind: "finished" });
  expect(deltaCount(native, streamId)).toBe(1);
  expect([...native.table("streamDeltas").values()][0].parts).toEqual([{ type: "text-delta", id: "source-copy", delta: root.source.content }]);
  expect(native.scheduled.some(job => job.args.streamId === streamId && job.delay === 300_000 && job.state.kind === "pending")).toBe(true);
  await native.call(native.streams.deleteStreamAsync, { streamId });
  expect(native.table("streamingMessages").has(streamId)).toBe(false); expect(deltaCount(native, streamId)).toBe(0);
});

it("more than eight exactly owned streams preserve the message until the next bounded pass", async () => {
  const { f, root, message, native } = await execution(), streamIds: string[] = [];
  for (let index = 0; index < 9; index++) streamIds.push(await stream(native, message, root.source.content));
  await f.call(erasure.eraseSource, root.scope);
  const partial = await advanceUntil(f, root, () => streamIds.some(id => !native.table("streamingMessages").has(id)));
  expect(partial.complete).toBe(false);
  expect(streamIds.filter(id => native.table("streamingMessages").has(id))).toHaveLength(1);
  expect(f.native.messages.has(message._id)).toBe(true);
  expect(native.calls.some(call => call.path.endsWith("/messages/deleteByIds"))).toBe(false);
  await purge(f, root);
  expect(streamIds.every(id => !native.table("streamingMessages").has(id) && deltaCount(native, id) === 0)).toBe(true);
  expect(f.native.messages.has(message._id)).toBe(false);
});

it("a capped owning listing cannot hide the exact stream and falsely complete", async () => {
  const { f, root, message, native } = await execution(), streamId = await stream(native, message, root.source.content);
  const unrelated: string[] = [];
  for (let index = 0; index < 100; index++) unrelated.push(await stream(native, { ...message, order: message.order + index + 1 }, root.source.content));
  const listed = await native.call<{ streamId: string }[]>(native.streams.list, { threadId: message.threadId, startOrder: message.order, statuses: ["streaming", "finished", "aborted"] });
  expect(listed).toHaveLength(100); expect(listed.some(row => row.streamId === streamId)).toBe(false);
  await f.call(erasure.eraseSource, root.scope);
  await advanceUntil(f, root, () => native.calls.some(call => call.path.endsWith("/streams/list")));
  for (let index = 0; index < 5; index++) expect((await f.call<Completion>(erasure.continueSource, root.scope)).complete).toBe(false);
  expect(f.native.messages.has(message._id)).toBe(true); expect(deltaCount(native, streamId)).toBe(1);
  expect(native.calls.some(call => call.path.endsWith("/messages/deleteByIds"))).toBe(false);
  expect(unrelated.every(id => native.table("streamingMessages").has(id))).toBe(true);
  // Simulate independent owning GC of two unrelated streams; an exhaustive
  // inventory now fits below the cap and the precise target can be proven drained.
  await native.call(native.streams.deleteStreamAsync, { streamId: unrelated[0] });
  await native.call(native.streams.deleteStreamAsync, { streamId: unrelated[1] });
  await purge(f, root);
  expect(native.table("streamingMessages").has(streamId)).toBe(false); expect(deltaCount(native, streamId)).toBe(0);
  expect(unrelated.slice(2).every(id => native.table("streamingMessages").has(id) && deltaCount(native, id) === 1)).toBe(true);
});

it.each(["step", "agent"] as const)("same-order unrelated active %s identity waits and remains intact after independent finish", async difference => {
  const { f, root, message, native } = await execution(), streamId = await stream(native, message, root.source.content);
  const other = { ...message, ...(difference === "step" ? { stepOrder: message.stepOrder + 1 } : { agentName: "host:independent-generation" }) };
  const unrelated = await stream(native, other, root.source.content, 1, "streaming");
  await f.call(erasure.eraseSource, root.scope);
  const partial = await advanceUntil(f, root, () => !native.table("streamingMessages").has(streamId));
  expect(partial.complete).toBe(false);
  for (let index = 0; index < 4; index++) expect((await f.call<Completion>(erasure.continueSource, root.scope)).complete).toBe(false);
  expect(f.native.messages.has(message._id)).toBe(true);
  expect(native.table("streamingMessages").get(unrelated)?.state).toMatchObject({ kind: "streaming" });
  expect(deltaCount(native, unrelated)).toBe(1);
  expect(native.calls.filter(call => call.path.endsWith("/streams/abort")).some(call => call.args.streamId === unrelated)).toBe(false);
  expect(native.calls.some(call => call.path.endsWith("/messages/deleteByIds"))).toBe(false);
  await native.call(native.streams.finish, { streamId: unrelated });
  await purge(f, root);
  expect(f.native.messages.has(message._id)).toBe(false);
  expect(native.table("streamingMessages").get(unrelated)?.state).toMatchObject({ kind: "finished" });
  expect(deltaCount(native, unrelated)).toBe(1);
});
