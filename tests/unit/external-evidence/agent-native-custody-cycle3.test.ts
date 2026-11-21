/** Installed Agent and AI SDK execution with a controlled LanguageModelV4;
 * native component/database ports are transactional test doubles, never live. */
import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import { getFunctionName } from "convex/server";
import { MockLanguageModelV4 } from "ai/test";
import type { LanguageModelV4, LanguageModelV4Content, LanguageModelV4StreamPart } from "@ai-sdk/provider";
import type { ActionCtx } from "../../../convex-dev/_generated/server";
import { canonicalModelJson } from "../../../src/domain/model-policy";
jest.unstable_mockModule("@convex-dev/workflow", () => ({ WorkflowManager: class {
  define(value: { handler: unknown }) { return { _handler: value.handler }; }
  async start() { return "workflow:atomic-custody"; }
} }));
let controlled: LanguageModelV4, beforeModel: (() => Promise<void>) | undefined;
const gateway = await import("../../../convex-dev/runtimeGateway");
jest.unstable_mockModule("../../../convex-dev/runtimeGateway", () => ({ ...gateway, createGovernedGatewayModel: async () => {
  const hook = beforeModel; beforeModel = undefined; await hook?.();
  return { model: controlled, lifecycle: { signal: new AbortController().signal, complete: async () => {} } };
} }));
const { installIngestionMockRoot, invoke } = await import("../runtimeIngestion/fixture");
const { dependencyFixture } = await import("./agent-dependency-fixture");
const agent = await import("../../../convex-dev/runtimeAgent");
const erasure = await import("../../../convex-dev/runtimeExternalErasure");
type F = Awaited<ReturnType<typeof dependencyFixture>>;
const usage = { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } };
beforeEach(() => { installIngestionMockRoot(); beforeModel = undefined; jest.spyOn(globalThis, "fetch").mockRejectedValue(Error("NETWORK_FORBIDDEN")); });
afterEach(() => { jest.restoreAllMocks(); });
function model(text: string, content: LanguageModelV4Content[] = [{ type: "text", text }], pause?: () => Promise<void>) {
  controlled = new MockLanguageModelV4({
    doGenerate: async () => { await pause?.(); return { content, finishReason: { unified: "stop", raw: undefined }, usage, warnings: [] }; },
    doStream: async () => {
      await pause?.();
      const files = content.filter(part => part.type === "file");
      const parts: LanguageModelV4StreamPart[] = [{ type: "stream-start", warnings: [] }, ...(files.length ? files : [{ type: "text-start" as const, id: "text" },
        { type: "text-delta" as const, id: "text", delta: text }, { type: "text-end" as const, id: "text" }]), { type: "finish", finishReason: { unified: "stop", raw: undefined }, usage }];
      return { stream: new ReadableStream({ start(controller) { for (const part of parts) controller.enqueue(part); controller.close(); } }) };
    },
  });
  return controlled as MockLanguageModelV4;
}
async function fixture(v8: boolean, streaming = true) {
  const f = await dependencyFixture({ v8, tools: true }), root = await f.external(), started = await f.start();
  await f.ctx.db.patch("runtimeAgentExecutions", started.owned._id as never, { streaming });
  await f.call(v8 ? agent.saveContextV8 : agent.saveContext, { ...started.attempt, context: root.source.content, witnesses: [root.witness], completeness: "complete",
    ...(v8 ? { entries: [{ key: "external", kind: "memory", text: root.source.content, relevance: 1 }] } : {}) });
  const query = f.ctx.runQuery.bind(f.ctx), mutation = f.ctx.runMutation.bind(f.ctx), nativeWrites: string[] = [];
  f.ctx.runQuery = (async (ref, args) => {
    const path = (ref as unknown as Partial<Record<symbol, string>>)[Symbol.for("toReferencePath")];
    if (path?.endsWith("/getThread")) return f.native.threads.get((args as { threadId: string }).threadId);
    return query(ref, args);
  }) as typeof f.ctx.runQuery;
  f.ctx.runMutation = (async (ref, args) => {
    const path = (ref as unknown as Partial<Record<symbol, string>>)[Symbol.for("toReferencePath")];
    if (path) {
      nativeWrites.push(path);
      if (/\/(streams|files)\//.test(path)) throw Error("NATIVE_STREAM_OR_FILE_WRITE_FORBIDDEN");
    }
    return mutation(ref, args);
  }) as typeof f.ctx.runMutation;
  return { ...f, ...started, root, nativeWrites };
}
async function purge(f: Pick<F, "call">, scope: { tenantId: string; memorySpaceId: string; sourceId: string }) {
  await f.call(erasure.eraseSource, scope); let complete = false;
  for (let n = 0; n < 256 && !complete; n++) complete = (await f.call<{ complete: boolean }>(erasure.continueSource, scope)).complete;
  expect(complete).toBe(true);
}
async function generate(f: Awaited<ReturnType<typeof fixture>>, v8: boolean) {
  return v8 ? await invoke<{ savedMessageIds: string[] }>(agent.turnStepV8, f.ctx, { ...f.attempt, ordinal: 1 })
    : await agent.modelStepHandler(f.ctx as unknown as ActionCtx, { ...f.attempt, ordinal: 0 });
}

it.each([[false, false], [false, true], [true, false], [true, true]])("installed Agent v8=%s streaming=%s stores external output only inside atomic custody", async (v8, streaming) => {
  const f = await fixture(v8, streaming), text = f.root.source.content, nativeModel = model(text), before = f.native.messages.size, authored = [...f.native.messages.keys()];
  let insideParent = false, completionError: unknown; const mutate = f.ctx.runMutation.bind(f.ctx);
  f.ctx.runMutation = (async (ref, args) => {
    const path = (ref as unknown as Partial<Record<symbol, string>>)[Symbol.for("toReferencePath")];
    let name = ""; try { name = getFunctionName(ref); } catch { /* Component write below. */ }
    if (path?.endsWith("/addMessages")) expect(insideParent).toBe(true);
    if (name === "runtimeAgent:finishGeneratedOperation") { insideParent = true; try { return await mutate(ref, args); } catch (error) { completionError = error; throw error; } finally { insideParent = false; } }
    return mutate(ref, args);
  }) as typeof f.ctx.runMutation;
  const result = await generate(f, v8).catch(error => { throw completionError ?? error; });
  expect(nativeModel.doGenerateCalls.length + nativeModel.doStreamCalls.length).toBe(1);
  expect(f.native.messages.size).toBe(before + 1); expect(result.savedMessageIds).toHaveLength(1);
  expect(f.db.table("runtimeAgentExecutions")[0]!.savedMessageIds).toEqual(result.savedMessageIds);
  expect(f.db.table("runtimeAgentExecutions")[0]!.savedMessagePins).toMatchObject([{ id: result.savedMessageIds[0], canonicalContentHash: expect.any(String) }]);
  expect(f.nativeWrites.filter(path => path.endsWith("/addMessages"))).toHaveLength(1);
  expect(f.nativeWrites.some(path => /\/(streams|files)\//.test(path))).toBe(false);
  expect(f.db.table("runtimeAgentOutput").some(row => String(row.partCanonical).includes(text))).toBe(true);
  await purge(f, f.root.scope);
  expect([...f.native.messages.values()].some(row => JSON.stringify(row).includes(text))).toBe(false);
  expect([...f.native.messages.keys()]).toEqual(authored);
});

it.each([false, true])("v8=%s erasure wins while installed Agent is awaiting a provider result, without late native writes", async v8 => {
  const f = await fixture(v8, false); let entered!: () => void, release!: () => void;
  const ready = new Promise<void>(resolve => { entered = resolve; }), waiting = new Promise<void>(resolve => { release = resolve; });
  model(f.root.source.content, undefined, async () => { entered(); await waiting; });
  const action = generate(f, v8).then(value => ({ value }), error => ({ error }));
  await Promise.race([ready, action.then(outcome => { if ("error" in outcome) throw outcome.error; throw Error("Provider pause not reached"); })]);
  await purge(f, f.root.scope); release(); expect(await action).toHaveProperty("error");
  expect(f.nativeWrites.filter(path => path.endsWith("/addMessages"))).toEqual([]);
  expect([...f.native.messages.values()].some(row => JSON.stringify(row).includes(f.root.source.content))).toBe(false);
  expect(f.db.table("runtimeAgentExecutions")[0]!.savedMessageIds).toEqual([]);
});

it.each([false, true])("v8=%s atomic native save rolls back with failed custody, and old ID-only adoption is refused", async v8 => {
  const f = await fixture(v8), op = await f.call<{ operationId: string }>(agent.prepareModelOperation, { ...f.attempt, ordinal: 0 }).then(value => (value as unknown as { op: { operationId: string } }).op);
  const patch = f.db.patch.bind(f.db), count = f.native.messages.size;
  const fail = jest.spyOn(f.db, "patch").mockImplementation((async (table: string, id: string, value: Record<string, unknown>) => {
    if (table === "runtimeAgentOperations" && (value as { state?: string }).state === "complete") throw Error("INJECTED_CUSTODY_FAILURE");
    return patch(table, id as string, value as Record<string, unknown>);
  }) as typeof f.db.patch);
  await expect(f.call(agent.finishGeneratedOperation, { ...f.attempt, operationId: op.operationId, messagesCanonical: canonicalModelJson([{ role: "assistant", content: f.root.source.content }]) })).rejects.toThrow("INJECTED_CUSTODY_FAILURE");
  fail.mockRestore(); expect(f.native.messages.size).toBe(count); expect(f.db.table("runtimeAgentExecutions")[0]!.savedMessageIds).toEqual([]);
  expect(f.db.table("runtimeAgentOperations")[0]!).toMatchObject({ state: "started", nativeMessageIds: [] });
  await expect(f.call(agent.finishOperation, { ...f.attempt, operationId: op.operationId, resultCanonical: "{}", nativeMessageIds: ["native:unowned"] })).rejects.toHaveProperty("data.code", "CAPABILITY_UNAVAILABLE");
});

it("tool witness growth is fenced in the native-save parent, and tool result ordering stays in the prompt generation", async () => {
  const f = await dependencyFixture({ tools: true }), root = await f.external(), { attempt } = await f.start();
  await f.call(agent.saveContext, { ...attempt, context: "", witnesses: [], completeness: "complete" });
  const op = await f.call<{ operationId: string }>(agent.beginOperation, { ...attempt, kind: "tool", ordinal: 0, toolCallId: "recall", toolName: "memory_recall", requestCanonical: canonicalModelJson({ text: "search", limit: 1 }) });
  await f.call(agent.startOperation, { ...attempt, operationId: op.operationId });
  await f.call(agent.rememberToolSources, { ...attempt, operationId: op.operationId, witnesses: [root.witness] });
  const before = f.native.messages.size;
  await purge(f, root.scope);
  await expect(f.call(agent.finishGeneratedOperation, { ...attempt, operationId: op.operationId, resultCanonical: canonicalModelJson({ context: root.source.content }) })).rejects.toHaveProperty("data.code", "STALE_CONTEXT");
  expect(f.native.messages.size).toBe(before);
});

it.each([false, true])("streaming=%s unsupported generated file bodies are rejected before native materialization", async streaming => {
  const f = await fixture(false, streaming), nativeModel = model("", [{ type: "file", mediaType: "image/png", data: { type: "data", data: new Uint8Array([1, 2, 3]) } }]);
  await expect(generate(f, false)).rejects.toHaveProperty("data.code", "INVALID_MODEL_OUTPUT");
  expect(nativeModel.doGenerateCalls.length + nativeModel.doStreamCalls.length).toBe(1); expect(f.nativeWrites).toEqual([]);
});

it.each([false, true])("v8=%s ordinary mode refuses late external witness growth before context reaches the installed model or native auto-storage", async v8 => {
  const f = await dependencyFixture({ v8, tools: true }), root = await f.external(), { attempt } = await f.start();
  await f.call(v8 ? agent.saveContextV8 : agent.saveContext, { ...attempt, context: "", witnesses: [], completeness: "complete", ...(v8 ? { entries: [] } : {}) });
  const recall = await f.call<{ operationId: string }>(agent.beginOperation, { ...attempt, kind: "tool", ordinal: 0, toolCallId: "growing-recall", toolName: "memory_recall", requestCanonical: canonicalModelJson({ text: "search", limit: 1 }) });
  await f.call(agent.startOperation, { ...attempt, operationId: recall.operationId });
  const query = f.ctx.runQuery.bind(f.ctx), mutation = f.ctx.runMutation.bind(f.ctx), nativeWrites: string[] = [], count = f.native.messages.size;
  f.ctx.runQuery = (async (ref, args) => {
    const path = (ref as unknown as Partial<Record<symbol, string>>)[Symbol.for("toReferencePath")];
    if (path?.endsWith("/getThread")) return f.native.threads.get((args as { threadId: string }).threadId);
    return query(ref, args);
  }) as typeof f.ctx.runQuery;
  f.ctx.runMutation = (async (ref, args) => {
    const path = (ref as unknown as Partial<Record<symbol, string>>)[Symbol.for("toReferencePath")]; if (path) nativeWrites.push(path);
    return mutation(ref, args);
  }) as typeof f.ctx.runMutation;
  const nativeModel = model(root.source.content);
  beforeModel = async () => { await f.call(agent.rememberToolSources, { ...attempt, operationId: recall.operationId, witnesses: [root.witness] }); };
  const action = v8 ? invoke(agent.turnStepV8, f.ctx, { ...attempt, ordinal: 1 }) : agent.modelStepHandler(f.ctx as unknown as ActionCtx, { ...attempt, ordinal: 0 });
  await expect(action).rejects.toHaveProperty("data.code", "STALE_CONTEXT");
  expect(f.db.table("runtimeAgentExecutions")[0]!.hasExternalDependencies).toBe(true);
  expect(nativeModel.doGenerateCalls.length + nativeModel.doStreamCalls.length).toBe(0);
  expect(f.native.messages.size).toBe(count); expect(nativeWrites).toEqual([]);
});

it("the atomic tool save owns output IDs/hash pins and native ordering before erasure wins later", async () => {
  const f = await dependencyFixture({ tools: true }), root = await f.external(), { attempt } = await f.start();
  await f.call(agent.saveContext, { ...attempt, context: "", witnesses: [], completeness: "complete" });
  const current = await agent.executionContext(f.ctx, attempt), authored = [...f.native.messages.keys()];
  const op = await f.call<{ operationId: string }>(agent.beginOperation, { ...attempt, kind: "tool", ordinal: 0, toolCallId: "atomic-tool", toolName: "memory_recall", requestCanonical: canonicalModelJson({ text: "search", limit: 1 }) });
  await f.call(agent.startOperation, { ...attempt, operationId: op.operationId });
  await f.call(agent.rememberToolSources, { ...attempt, operationId: op.operationId, witnesses: [root.witness] });
  const mutate = f.ctx.runMutation.bind(f.ctx), writes: { order?: number; agentName?: string }[] = [];
  f.ctx.runMutation = (async (ref, args) => {
    const path = (ref as unknown as Partial<Record<symbol, string>>)[Symbol.for("toReferencePath")];
    if (path?.endsWith("/addMessages")) writes.push(args as { order?: number; agentName?: string });
    return mutate(ref, args);
  }) as typeof f.ctx.runMutation;
  await f.call(agent.finishGeneratedOperation, { ...attempt, operationId: op.operationId, resultCanonical: canonicalModelJson({ context: root.source.content }) });
  const execution = f.db.table("runtimeAgentExecutions")[0]!, savedIds = execution.savedMessageIds as string[];
  expect(savedIds).toHaveLength(1); expect(execution.savedMessagePins).toMatchObject([{ id: savedIds[0], canonicalContentHash: expect.any(String) }]);
  expect(writes).toEqual([expect.objectContaining({ order: current.snapshot.anchor.order, agentName: `cortex:${attempt.runId}:1:0` })]);
  expect(f.native.messages.get(savedIds[0]!)!.stepOrder as number).toBeGreaterThan(current.snapshot.anchor.stepOrder);
  expect(f.db.table("runtimeAgentOperations")[0]!).toMatchObject({ state: "complete", nativeMessageIds: savedIds });
  await purge(f, root.scope); expect([...f.native.messages.keys()]).toEqual(authored);
});
