/** Actual handler/RPC schemas and lifecycle ownership; paid model/tool ports are controlled. */
import { beforeEach, afterEach, expect, it, jest } from "@jest/globals";
import { getFunctionName } from "convex/server";
import type { ActionCtx } from "../../../convex-dev/_generated/server";
import { assertNativeArgs } from "./native-arguments";
import { mergeTransforms } from "../../../node_modules/@convex-dev/agent/dist/vercel/client/streaming.js";
const nativeAgent = await import("@convex-dev/agent");
const complete = jest.fn(async () => {}); let mode = "success";
const nativeMethods: string[] = [];
let fixtureFinal: Record<string, unknown>, capturedOptions: Record<string, unknown>, capturedCall: Record<string, unknown>;
let privateContext: unknown;
let streamScenario: ((call: Record<string, unknown>, storage: { saveStreamDeltas: Parameters<typeof mergeTransforms>[0] }) => Promise<void>) | undefined;
jest.unstable_mockModule("@convex-dev/agent", () => ({ ...nativeAgent, Agent: class {
  constructor(_component: unknown, options: Record<string, unknown>) { capturedOptions = options; if (mode === "constructor") throw new Error("Constructor failure"); }
  async streamText(_ctx: unknown, _identity: unknown, call: Record<string, unknown>, storage: unknown) {
    nativeMethods.push("streamText");
    capturedCall = { ...call, storage }; privateContext = await (capturedOptions.contextHandler as () => Promise<unknown>)();
    if (mode === "stream") throw new Error("Ambiguous stream failure");
    if (streamScenario) {
      await streamScenario(call, storage as Parameters<NonNullable<typeof streamScenario>>[1]);
      return { toolCalls: Promise.resolve([]), savedMessages: [fixtureFinal], text: Promise.resolve("safe final") };
    }
    await (call.onChunk as (value: unknown) => Promise<void>)({ chunk: { type: "text-delta", text: "safe", providerMetadata: { secret: "PROVIDER_SECRET" } } });
    if (mode === "native-chunks") for (const chunk of [
      { type: "text", text: "visible primitive text", reasoning: "PRIVATE_REASONING" },
      { type: "tool-call", toolCallId: "chunk-call", toolName: "memory_recall", input: { secret: "PRIVATE_INPUT" } },
      { type: "finish-step", response: { timestamp: new Date(), headers: { authorization: "PRIVATE_HEADER" } }, providerMetadata: { secret: "PRIVATE_METADATA" } },
      { type: "reasoning-delta", text: "PRIVATE_REASONING" }, { type: "unknown", context: "PRIVATE_CONTEXT", opaque: new Date() },
    ]) await (call.onChunk as (value: unknown) => Promise<void>)({ chunk });
    return { toolCalls: Promise.resolve([]), savedMessages: [fixtureFinal], text: Promise.resolve("safe final") };
  }
  async generateText(_ctx: unknown, _identity: unknown, call: Record<string, unknown>) {
    nativeMethods.push("generateText"); capturedCall = call;
    privateContext = await (capturedOptions.contextHandler as () => Promise<unknown>)();
    if (mode === "generate") throw new Error("Ambiguous generation failure");
    return { toolCalls: mode === "generate-tool" ? [{toolCallId: "generated-call", toolName: "memory_recall", input: {text: "query", limit: 1}}] : [],
      savedMessages: [fixtureFinal], text: mode === "generate-tool" ? "" : "safe final",
      response: {timestamp: new Date(), headers: {authorization: "PRIVATE_GENERATION_HEADER"}} };
  }
} }));
jest.unstable_mockModule("@convex-dev/workflow", () => ({ WorkflowManager: class {
  define(value: { handler: unknown }) { return { _handler: value.handler }; } async start() { return "workflow:1"; }
} }));
const { transcriptFixture, installMockRoot, runs, ledger, invoke } = await import("../runtimeTranscript/fixture");
const originalGateway = await import("../../../convex-dev/runtimeGateway");
jest.unstable_mockModule("../../../convex-dev/runtimeGateway", () => ({ ...originalGateway, createGovernedGatewayModel: async () => ({
  model: { specificationVersion: mode === "identity" ? "v3" : "v4", doStream: async () => {}, doGenerate: async () => {}, provider: "controlled", modelId: "controlled/model" },
  lifecycle: { complete, signal: new AbortController().signal },
}) }));
const originalTools = await import("../../../convex-dev/runtimeAgentTools");
const executeTool = jest.fn(async (_ctx: unknown, binding: { checkCurrent(): Promise<void> }) => { await binding.checkCurrent(); return { result: { context: "PRIVATE_TOOL_CONTEXT", profileId: "controlled" }, witnesses: [] }; });
jest.unstable_mockModule("../../../convex-dev/runtimeAgentTools", () => ({ ...originalTools, executeServerTool: executeTool }));
const runtime = await import("../../../convex-dev/runtimeAgent");
const definitions = await import("../../../convex-dev/agentDefinitions");
const memory = await import("../../../convex-dev/runtimeMemory");
beforeEach(() => { installMockRoot(); mode = "success"; streamScenario = undefined; complete.mockClear(); executeTool.mockClear(); nativeMethods.length = 0; });
afterEach(() => { jest.restoreAllMocks(); });
async function setup(withTool = false, streaming = true) {
  if (withTool) installMockRoot({ tools: true });
  const f = await transcriptFixture(); const mutation = f.ctx.runMutation.bind(f.ctx), query = f.ctx.runQuery.bind(f.ctx); const calls: string[] = [];
  f.ctx.runQuery = (async (reference: unknown, args: unknown) => {
    let name = ""; try { name = getFunctionName(reference as never); } catch { /* Native component. */ }
    const reg = name.startsWith("runtimeAgent:") ? runtime[name.split(":")[1] as keyof typeof runtime] : name === "runtimeMemory:readSource" ? memory.readSource : name === "runtimeModelPolicy:resolve" ? ledger.resolve : undefined;
    if (reg) { assertNativeArgs(reg, args); calls.push(name); return await invoke(reg, f.ctx, args); }
    return await query(reference as never, args as never);
  }) as typeof f.ctx.runQuery;
  f.ctx.runMutation = (async (reference: unknown, args: unknown) => {
    let name = ""; try { name = getFunctionName(reference as never); } catch { /* Native component. */ }
    const reg = name.startsWith("runtimeAgent:") ? runtime[name.split(":")[1] as keyof typeof runtime] : name === "runs:claimNext" ? runs.claimNext : name === "runs:cancel" ? runs.cancel : undefined;
    if (reg) { assertNativeArgs(reg, args); calls.push(name); return await invoke(reg, f.ctx, args); }
    return await mutation(reference as never, args as never);
  }) as typeof f.ctx.runMutation;
  let request = f.request();
  if (withTool) {
    f.grant.capabilities = [...f.grant.capabilities as string[], "tool"];
    const published = await f.call<{ agentId: string; version: number }>(definitions.publishVersion, { memorySpaceId: "space-a", clientMutationId: "tool", expectedPreviousVersion: 0,
      definitionInput: { ...f.definitionInput, tools: [{ toolId: "memory.recall", toolVersion: 1, registryHash: await definitions.executableRegistryHash(), requiredCapability: "tool", approval: "none" }], policies: [{ policyId: "tool", version: 1, rules: { limits: { toolSteps: 4 } } }] } });
    request = { ...request, agentId: published.agentId, agentVersion: published.version };
  }
  const run = await f.call<{ runId: string }>(runs.submit, { request }); await f.call(runtime.start, { runId: run.runId, streaming });
  const owned = f.db.table("runtimeAgentExecutions")[0]; const args = { reference: f.reference, runId: run.runId, attemptNumber: 1, leaseVersion: owned.leaseVersion as number };
  await f.call(runtime.saveContext, { ...args, context: "PRIVATE_MEMORY_CONTEXT", witnesses: [] });
  const input = f.native.messages.get((f.db.table("runtimeRuns")[0].inputMessageIds as string[])[0])!;
  fixtureFinal = { ...input, _id: "final:controlled", stepOrder: 1, agentName: `cortex:${run.runId}:1:0`, message: { role: "assistant", content: "safe final" } };
  f.native.messages.set("final:controlled", fixtureFinal);
  return { f, args, calls };
}
async function actualFragmentStream(call: Record<string, unknown>, storage: Parameters<NonNullable<typeof streamScenario>>[1], beforeEnd: () => Promise<void> | void) {
  const transform = mergeTransforms(storage.saveStreamDeltas, undefined)![0]!({ tools: {}, stopStream() {} });
  const writer = transform.writable.getWriter(), reader = transform.readable.getReader();
  const read = (async () => { try { for (;;) { const item = await reader.read(); if (item.done) return;
    await (call.onChunk as (event: { chunk: unknown }) => Promise<void>)({ chunk: item.value }); }
  } catch (error) { await reader.cancel(error); throw error; } })();
  // Always observe reader rejection, including a fresh publication denial.
  void read.catch(() => {});
  try {
    await writer.write({ type: "text-start", id: "short" });
    await writer.write({ type: "text-delta", id: "short", text: "ABC" });
    await writer.write({ type: "text-delta", id: "short", text: "DEF" });
    await new Promise<void>(resolve => setImmediate(resolve));
    await beforeEnd();
    await writer.write({ type: "text-end", id: "short" }); await writer.close(); await read;
  } catch (error) { await writer.abort(error); await read.catch(() => {}); throw error; }
}
it("real installed Agent/AI SDK smoothing publishes first whitespace-free fragment before text-end/terminal, preserving order once", async () => {
  const { f, args } = await setup(); const clock = Date.now(); jest.spyOn(Date, "now").mockReturnValue(clock);
  streamScenario = async (call, storage) => actualFragmentStream(call, storage, () => {
    const parts = f.db.table("runtimeAgentOutput").map(row => JSON.parse(row.partCanonical as string));
    expect(parts).toEqual([{ type: "text-start", id: "short" }, { type: "text-delta", id: "short", text: "ABC" }]);
    expect(f.db.table("runtimeAgentOperations")[0].state).toBe("started"); expect(complete).not.toHaveBeenCalled();
  });
  await runtime.modelStepHandler(f.ctx as unknown as ActionCtx, { ...args, ordinal: 0 });
  const parts = f.db.table("runtimeAgentOutput").map(row => JSON.parse(row.partCanonical as string));
  expect(parts.filter(part => part.type === "text-delta").map(part => part.text)).toEqual(["ABC", "DEF"]);
  expect(parts.at(-1)).toEqual({ type: "text-end", id: "short" });
  expect(f.db.table("runtimeAgentOutput").map(row => row.sequence)).toEqual([1, 2, 3, 4]); expect(complete).toHaveBeenCalledTimes(1);
});
it("empty/start chunks do not consume first-text immediacy and concurrent callbacks keep bounded ordered batches", async () => {
  const { f, args } = await setup(); jest.spyOn(Date, "now").mockReturnValue(Date.now()); const batches: unknown[][] = [];
  const mutation = f.ctx.runMutation.bind(f.ctx);
  f.ctx.runMutation = (async (ref, value) => {
    if (getFunctionName(ref) === "runtimeAgent:recordOutput") batches.push((value as { parts: unknown[] }).parts);
    return mutation(ref, value);
  }) as typeof f.ctx.runMutation;
  streamScenario = async call => {
    const chunk = call.onChunk as (event: { chunk: unknown }) => Promise<void>;
    await chunk({ chunk: { type: "text-start", id: "batch" } }); await chunk({ chunk: { type: "text-delta", text: "" } });
    expect(batches).toEqual([]);
    await chunk({ chunk: { type: "text-delta", text: "first" } }); expect(batches).toHaveLength(1);
    await Promise.all(Array.from({ length: 65 }, (_, index) => chunk({ chunk: { type: "text-delta", text: `:${index}` } })));
  };
  await runtime.modelStepHandler(f.ctx as unknown as ActionCtx, { ...args, ordinal: 0 });
  expect(batches.map(batch => batch.length)).toEqual([3, 32, 32, 1]);
  const parts = f.db.table("runtimeAgentOutput").map(row => JSON.parse(row.partCanonical as string));
  expect(parts.filter(part => part.type === "text-delta").map(part => part.text)).toEqual(["", "first", ...Array.from({ length: 65 }, (_, index) => `:${index}`)]);
  expect(new Set(f.db.table("runtimeAgentOutput").map(row => row.sequence)).size).toBe(parts.length);
});
it("stream failure after first public text retains only that prefix and closes without canonical completion", async () => {
  const { f, args } = await setup(); const failure = new Error("CONTROLLED_STREAM_FAILURE");
  streamScenario = async (call, storage) => actualFragmentStream(call, storage, () => { throw failure; });
  await expect(runtime.modelStepHandler(f.ctx as unknown as ActionCtx, { ...args, ordinal: 0 })).rejects.toBe(failure);
  expect(f.db.table("runtimeAgentOutput").map(row => JSON.parse(row.partCanonical as string)).filter(part => part.type === "text-delta")).toEqual([{ type: "text-delta", id: "short", text: "ABC" }]);
  expect(f.db.table("runtimeAgentOperations")[0].state).toBe("started"); expect(f.db.table("runtimeAgentIngestion")).toEqual([]); expect(complete).toHaveBeenCalledTimes(1);
});
it("subsequent text keeps the existing250ms flush threshold after first immediate publication", async () => {
  const { f, args } = await setup(); let now = Date.now(); jest.spyOn(Date, "now").mockImplementation(() => now);
  const batches: unknown[][] = [], mutation = f.ctx.runMutation.bind(f.ctx);
  f.ctx.runMutation = (async (ref, value) => {
    if (getFunctionName(ref) === "runtimeAgent:recordOutput") batches.push((value as { parts: unknown[] }).parts);
    return mutation(ref, value);
  }) as typeof f.ctx.runMutation;
  streamScenario = async call => {
    const chunk = call.onChunk as (event: { chunk: unknown }) => Promise<void>;
    await chunk({ chunk: { type: "text-delta", text: "first" } }); expect(batches).toHaveLength(1);
    now += 249; await chunk({ chunk: { type: "text-delta", text: "second" } }); expect(batches).toHaveLength(1);
    now += 1; await chunk({ chunk: { type: "text-delta", text: "third" } }); expect(batches).toHaveLength(2);
  };
  await runtime.modelStepHandler(f.ctx as unknown as ActionCtx, { ...args, ordinal: 0 });
  expect(batches.map(batch => batch.length)).toEqual([1, 2]);
});
it.each(["revoked", "cancelled", "input-edited"])("first fragment still executes real recordOutput current guards after %s", async fault => {
  const { f, args } = await setup();
  streamScenario = async (call, storage) => {
    if (fault === "revoked") f.grant.revokedAt = Date.now();
    if (fault === "cancelled") await f.call(runtime.cancel, { runId: args.runId });
    if (fault === "input-edited") {
      const input = f.native.messages.get((f.db.table("runtimeRuns")[0].inputMessageIds as string[])[0])!;
      input.message = { role: "user", content: "edited after model context" };
    }
    await actualFragmentStream(call, storage, () => {});
  };
  await expect(runtime.modelStepHandler(f.ctx as unknown as ActionCtx, { ...args, ordinal: 0 })).rejects.toThrow();
  expect(f.db.table("runtimeAgentOutput").map(row => JSON.parse(row.partCanonical as string)).filter(part => part.type === "text" || part.type === "text-delta")).toEqual([]);
  expect(f.db.table("runtimeAgentIngestion")).toEqual([]); expect(complete).toHaveBeenCalledTimes(1);
});
it("concurrent cancellation before first publication denies the queued prefix and cleanup joins all callbacks", async () => {
  const { f, args } = await setup(); const mutation = f.ctx.runMutation.bind(f.ctx);
  let entered!: () => void, release!: () => void;
  const writing = new Promise<void>(resolve => { entered = resolve; }), gate = new Promise<void>(resolve => { release = resolve; });
  f.ctx.runMutation = (async (ref, value) => {
    if (getFunctionName(ref) === "runtimeAgent:recordOutput") { entered(); await gate; }
    return mutation(ref, value);
  }) as typeof f.ctx.runMutation;
  streamScenario = async call => {
    const chunk = call.onChunk as (event: { chunk: unknown }) => Promise<void>;
    const writes = Promise.all([chunk({ chunk: { type: "text-delta", text: "first" } }), chunk({ chunk: { type: "text-delta", text: "second" } })]);
    void writes.catch(() => {}); await writing;
    try { await f.call(runtime.cancel, { runId: args.runId }); } finally { release(); }
    await writes;
  };
  await expect(runtime.modelStepHandler(f.ctx as unknown as ActionCtx, { ...args, ordinal: 0 })).rejects.toThrow();
  expect(f.db.table("runtimeAgentOutput").map(row => JSON.parse(row.partCanonical as string)).filter(part => part.type === "text-delta")).toEqual([]);
  expect(complete).toHaveBeenCalledTimes(1); expect(f.db.table("runtimeAgentExecutions")[0].state).toBe("cancelled");
});
it.each(["identity", "constructor", "stream"])("the %s failure closes the governed lifecycle once and does not publish a completed operation", async failure => {
  const { f, args } = await setup(); mode = failure;
  await expect(runtime.modelStepHandler(f.ctx as unknown as ActionCtx, { ...args, ordinal: 0 })).rejects.toThrow();
  expect(complete).toHaveBeenCalledTimes(1); expect(f.db.table("runtimeAgentOperations")[0].state).toBe("started"); expect(f.db.table("runtimeAgentIngestion")).toEqual([]);
});
it("the whole model path obeys native RPC schemas, uses private pinned history and owns one no-retry stream lifecycle", async () => {
  const { f, args, calls } = await setup();
  expect(await runtime.modelStepHandler(f.ctx as unknown as ActionCtx, { ...args, ordinal: 0 })).toEqual({ savedMessageIds: ["final:controlled"], calls: [], final: true });
  expect(capturedOptions).toMatchObject({ contextOptions: { recentMessages: 0 }, storageOptions: { saveMessages: "promptAndOutput" } });
  expect(capturedOptions.embeddingModel).toBeUndefined(); expect(capturedOptions.textEmbeddingModel).toBeUndefined();
  expect(capturedCall).toMatchObject({ maxRetries: 0, maxOutputTokens: 2000, storage: { saveStreamDeltas: { throttleMs: 250, returnImmediately: false, sendSources: false } } });
  expect(JSON.stringify(privateContext)).toContain("PRIVATE_MEMORY_CONTEXT"); expect(JSON.stringify(privateContext)).toContain("Hello");
  expect(calls).toContain("runtimeAgent:recordOutput"); expect(calls).toContain("runtimeAgent:finishOperation"); expect(complete).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(f.db.table("runtimeAgentOutput"))).not.toContain("PROVIDER_SECRET");
});
it("the whole deferred tool path keeps exact native schemas and its primary model parent; completed tool replay performs no second effect", async () => {
  const { f, args, calls } = await setup(true);
  const op = await f.call<{ operationId: string; semanticId: string }>(runtime.beginOperation, { ...args, ordinal: 0, kind: "model", requestCanonical: "{}" });
  await f.call(runtime.startOperation, { ...args, operationId: op.operationId });
  const native = f.db.seed("runtimeModelOperations", { tenantId: f.reference.tenantId, runAccountId: f.db.table("runtimeRuns")[0].runAccountId, reference: f.reference, semanticId: op.semanticId });
  f.db.seed("runtimeModelAttempts", { operationDocumentId: native._id, ordinal: 0, attemptNumber: 1 });
  await f.call(runtime.bindNativeOperation, { ...args, operationId: op.operationId, nativeOperationId: native._id });
  await f.call(runtime.finishOperation, { ...args, operationId: op.operationId, resultCanonical: "{}", nativeMessageIds: ["final:controlled"] });
  const toolArgs = { ...args, ordinal: 0, call: { toolCallId: "tc", toolName: "memory_recall", inputCanonical: f.canonical({ text: "query", limit: 1 }) } };
  await runtime.toolStepHandler(f.ctx as unknown as ActionCtx, toolArgs);
  expect(executeTool).toHaveBeenCalledTimes(1); expect(executeTool.mock.calls[0][1]).toMatchObject({ runBudgetId: f.db.table("runtimeRuns")[0].runBudgetId, parentOperationId: native._id });
  expect(calls).toContain("runtimeAgent:checkActiveTool"); expect(calls).toContain("runtimeAgent:rememberToolSources");
  expect(calls).toContain("runtimeAgent:finishOperation");
  await runtime.toolStepHandler(f.ctx as unknown as ActionCtx, toolArgs); expect(executeTool).toHaveBeenCalledTimes(1);
  expect(f.db.table("runtimeAgentOperations").filter(row => row.kind === "tool")).toHaveLength(1);
});
it("projects real SDK Date-containing finish-step parts before native RPC serialization, retaining safe text and tool phases", async () => {
  const { f, args } = await setup(true); mode = "native-chunks";
  await expect(runtime.modelStepHandler(f.ctx as unknown as ActionCtx, { ...args, ordinal: 0 })).resolves.toMatchObject({ final: true });
  const parts = f.db.table("runtimeAgentOutput").map(row => JSON.parse(row.partCanonical as string));
  expect(parts).toContainEqual({ type: "text-delta", text: "safe" });
  expect(parts).toContainEqual({ type: "text", text: "visible primitive text" });
  expect(parts).toContainEqual({ type: "tool", toolCallId: "chunk-call", name: "memory_recall", phase: "requested" });
  expect(JSON.stringify(parts)).not.toMatch(/PRIVATE_|PROVIDER_SECRET|finish-step|timestamp|unknown|opaque/);
  expect(f.db.table("runtimeAgentOperations")[0].state).toBe("complete"); expect(complete).toHaveBeenCalledTimes(1);
});
it.each([true, false])("uses the requested native interface with the same owned history and no retries (streaming=%s)", async streaming => {
  const {f, args} = await setup(false, streaming);
  const result = await runtime.modelStepHandler(f.ctx as unknown as ActionCtx, {...args, ordinal: 0});
  expect(nativeMethods).toEqual([streaming ? "streamText" : "generateText"]);
  expect(result).toEqual({savedMessageIds: ["final:controlled"], calls: [], final: true});
  expect(capturedCall).toMatchObject({maxRetries: 0, maxOutputTokens: 2000});
  expect(capturedCall).toHaveProperty("stopWhen");
  expect(JSON.stringify(privateContext)).toContain("PRIVATE_MEMORY_CONTEXT");
  expect(f.db.table("runtimeAgentOperations")[0].state).toBe("complete");
  expect(complete).toHaveBeenCalledTimes(1);
  if (!streaming) {
    expect(capturedCall).not.toHaveProperty("onChunk"); expect(capturedCall).not.toHaveProperty("storage");
    const output = f.db.table("runtimeAgentOutput").map(row => JSON.parse(row.partCanonical as string));
    expect(output).toContainEqual({type: "text", text: "safe final"});
    expect(JSON.stringify(output)).not.toContain("PRIVATE_GENERATION_HEADER");
  }
});
it("nonstream tool calls retain exact private inputs and public requested phases before the deferred tool", async () => {
  const {f,args} = await setup(true, false); mode = "generate-tool";
  const result = await runtime.modelStepHandler(f.ctx as unknown as ActionCtx, {...args, ordinal: 0});
  expect(nativeMethods).toEqual(["generateText"]);
  expect(result).toEqual({savedMessageIds: ["final:controlled"], calls: [{toolCallId: "generated-call", toolName: "memory_recall", inputCanonical: '{"limit":1,"text":"query"}'}], final: false});
  const output = f.db.table("runtimeAgentOutput").map(row => JSON.parse(row.partCanonical as string));
  expect(output).toContainEqual({type: "tool", toolCallId: "generated-call", name: "memory_recall", phase: "requested"});
  expect(executeTool).not.toHaveBeenCalled(); expect(JSON.stringify(output)).not.toContain("PRIVATE_GENERATION_HEADER");
});
it("ambiguous nonstream failure closes ownership without a completed operation or automatic readmission", async () => {
  const {f,args} = await setup(false, false); mode = "generate";
  await expect(runtime.modelStepHandler(f.ctx as unknown as ActionCtx, {...args, ordinal: 0})).rejects.toThrow("Ambiguous generation failure");
  expect(nativeMethods).toEqual(["generateText"]); expect(complete).toHaveBeenCalledTimes(1);
  expect(f.db.table("runtimeAgentOperations")[0].state).toBe("started"); expect(f.db.table("runtimeAgentIngestion")).toEqual([]);
});
it("confirmed nonstream operation replay returns its canonical result without another native method", async () => {
  const {f,args} = await setup(false, false);
  const first = await runtime.modelStepHandler(f.ctx as unknown as ActionCtx, {...args, ordinal: 0});
  await expect(runtime.modelStepHandler(f.ctx as unknown as ActionCtx, {...args, ordinal: 0})).resolves.toEqual(first);
  expect(nativeMethods).toEqual(["generateText"]); expect(complete).toHaveBeenCalledTimes(1);
  expect(f.db.table("runtimeAgentOperations")).toHaveLength(1);
});

it("completed nonstream replay rechecks saved-message pins before returning protected evidence", async () => {
  const {f,args} = await setup(false, false);
  await runtime.modelStepHandler(f.ctx as unknown as ActionCtx, {...args, ordinal: 0});
  fixtureFinal.message = {role: "assistant", content: "edited saved output"};
  await expect(runtime.modelStepHandler(f.ctx as unknown as ActionCtx, {...args, ordinal: 0})).rejects.toThrow("STALE_TRANSCRIPT");
  expect(nativeMethods).toEqual(["generateText"]); expect(complete).toHaveBeenCalledTimes(1);
});
