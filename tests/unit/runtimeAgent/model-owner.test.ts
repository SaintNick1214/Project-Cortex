/** Actual handler/RPC schemas and lifecycle ownership; paid model/tool ports are controlled. */
import { beforeEach, afterEach, expect, it, jest } from "@jest/globals";
import { getFunctionName } from "convex/server";
import type { ActionCtx } from "../../../convex-dev/_generated/server";
import { assertNativeArgs } from "./native-arguments";
const nativeAgent = await import("@convex-dev/agent");
const complete = jest.fn(async () => {}); let mode = "success";
let fixtureFinal: Record<string, unknown>, capturedOptions: Record<string, unknown>, capturedCall: Record<string, unknown>;
let privateContext: unknown;
jest.unstable_mockModule("@convex-dev/agent", () => ({ ...nativeAgent, Agent: class {
  constructor(_component: unknown, options: Record<string, unknown>) { capturedOptions = options; if (mode === "constructor") throw new Error("Constructor failure"); }
  async streamText(_ctx: unknown, _identity: unknown, call: Record<string, unknown>, storage: unknown) {
    capturedCall = { ...call, storage }; privateContext = await (capturedOptions.contextHandler as () => Promise<unknown>)();
    if (mode === "stream") throw new Error("Ambiguous stream failure");
    await (call.onChunk as (value: unknown) => Promise<void>)({ chunk: { type: "text-delta", text: "safe", providerMetadata: { secret: "PROVIDER_SECRET" } } });
    if (mode === "native-chunks") for (const chunk of [
      { type: "text", text: "visible primitive text", reasoning: "PRIVATE_REASONING" },
      { type: "tool-call", toolCallId: "chunk-call", toolName: "memory_recall", input: { secret: "PRIVATE_INPUT" } },
      { type: "finish-step", response: { timestamp: new Date(), headers: { authorization: "PRIVATE_HEADER" } }, providerMetadata: { secret: "PRIVATE_METADATA" } },
      { type: "reasoning-delta", text: "PRIVATE_REASONING" }, { type: "unknown", context: "PRIVATE_CONTEXT", opaque: new Date() },
    ]) await (call.onChunk as (value: unknown) => Promise<void>)({ chunk });
    return { toolCalls: Promise.resolve([]), savedMessages: [fixtureFinal], text: Promise.resolve("safe final") };
  }
} }));
jest.unstable_mockModule("@convex-dev/workflow", () => ({ WorkflowManager: class {
  define(value: { handler: unknown }) { return { _handler: value.handler }; } async start() { return "workflow:1"; }
} }));
const originalGateway = await import("../../../convex-dev/runtimeGateway");
jest.unstable_mockModule("../../../convex-dev/runtimeGateway", () => ({ ...originalGateway, createGovernedGatewayModel: async () => ({
  model: { specificationVersion: mode === "identity" ? "v3" : "v4", doStream: async () => {}, provider: "controlled", modelId: "controlled/model" },
  lifecycle: { complete, signal: new AbortController().signal },
}) }));
const originalTools = await import("../../../convex-dev/runtimeAgentTools");
const executeTool = jest.fn(async (_ctx: unknown, binding: { checkCurrent(): Promise<void> }) => { await binding.checkCurrent(); return { result: { context: "PRIVATE_TOOL_CONTEXT", profileId: "controlled" }, witnesses: [] }; });
jest.unstable_mockModule("../../../convex-dev/runtimeAgentTools", () => ({ ...originalTools, executeServerTool: executeTool }));
const { transcriptFixture, installMockRoot, runs, ledger, invoke } = await import("../runtimeTranscript/fixture");
const runtime = await import("../../../convex-dev/runtimeAgent");
const definitions = await import("../../../convex-dev/agentDefinitions");
const memory = await import("../../../convex-dev/runtimeMemory");
beforeEach(() => { installMockRoot(); mode = "success"; complete.mockClear(); executeTool.mockClear(); });
afterEach(() => { jest.restoreAllMocks(); });
async function setup(withTool = false) {
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
    const reg = name.startsWith("runtimeAgent:") ? runtime[name.split(":")[1] as keyof typeof runtime] : name === "runs:claimNext" ? runs.claimNext : undefined;
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
  const run = await f.call<{ runId: string }>(runs.submit, { request }); await f.call(runtime.start, { runId: run.runId });
  const owned = f.db.table("runtimeAgentExecutions")[0]; const args = { reference: f.reference, runId: run.runId, attemptNumber: 1, leaseVersion: owned.leaseVersion as number };
  await f.call(runtime.saveContext, { ...args, context: "PRIVATE_MEMORY_CONTEXT", witnesses: [] });
  const input = f.native.messages.get((f.db.table("runtimeRuns")[0].inputMessageIds as string[])[0])!;
  fixtureFinal = { ...input, _id: "final:controlled", stepOrder: 1, agentName: `cortex:${run.runId}:1:0`, message: { role: "assistant", content: "safe final" } };
  f.native.messages.set("final:controlled", fixtureFinal);
  return { f, args, calls };
}
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
