/** Installed Workflow0.4.8 interpreter + actual stage/tool/approval handlers; no native scheduling/OCC/SLO claim. */
import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import { BaseChannel, ChannelClosedError } from "async-channel";
import { getFunctionName, makeFunctionReference } from "convex/server";
import { createWorkflowCtx } from "../../../node_modules/@convex-dev/workflow/dist/client/workflowContext.js";
import { StepExecutor } from "../../../node_modules/@convex-dev/workflow/dist/client/step.js";
import { canonicalModelJson } from "../../../src/domain/model-policy";
import { assertNativeArgs } from "./native-arguments";
type Request = Parameters<typeof createWorkflowCtx>[1] extends BaseChannel<infer T> ? T : never;
type Entry = ConstructorParameters<typeof StepExecutor>[4][number];
const host = globalThis as typeof globalThis & { Convex?: unknown }, beforeHost = host.Convex;
const approvedEvents: unknown[] = [];
jest.unstable_mockModule("@convex-dev/workflow", () => ({ WorkflowManager: class {
  define(input: { handler: unknown }) { return { _handler: input.handler }; } async start() { return "workflow:turn-v5"; }
  async sendEvent(_ctx: unknown, args: unknown) { approvedEvents.push(args); }
} }));
const { ingestionFixture, ingestion, installIngestionMockRoot } = await import("../runtimeIngestion/fixture");
const { clone, clock } = await import("../runtimeTranscript/fixture");
const runtime = await import("../../../convex-dev/runtimeAgent"), runs = await import("../../../convex-dev/runs"), definitions = await import("../../../convex-dev/agentDefinitions");
beforeEach(() => { installIngestionMockRoot(); approvedEvents.length = 0; host.Convex = { asyncSyscall: async (name: string, input: string) => {
  if (name !== "1.0/createFunctionHandle") throw Error("Unexpected syscall"); return JSON.stringify(`function://${(JSON.parse(input) as { name: string }).name}`);
} }; });
afterEach(() => { host.Convex = beforeHost; jest.restoreAllMocks(); });
async function fixture(options: { strict?: boolean; warning?: boolean; tool?: boolean } = {}) {
  const f = await ingestionFixture(), mutation = f.ctx.runMutation.bind(f.ctx);
  f.ctx.runMutation = (async (ref, args) => { let name = ""; try { name = getFunctionName(ref); } catch { return mutation(ref, args); }
    const reg = name === "runs:claimNext" ? runs.claimNext : name.startsWith("runtimeAgent:") ? runtime[name.split(":")[1] as keyof typeof runtime] : undefined;
    if (reg) { assertNativeArgs(reg, args); return f.call(reg, args); } return mutation(ref, args);
  }) as typeof f.ctx.runMutation;
  let request = f.request();
  if (options.strict) { const source = await f.source("Unprocessed approved source", "strict-prior"); await ingestion.enqueueSourceEvent(f.ctx, f.reference, source); }
  if (options.strict || options.tool) { if (options.tool) f.grant.capabilities = [...f.grant.capabilities as string[], "tool"];
    const published = await f.call<{ agentId: string; version: number }>(definitions.publishVersion, { memorySpaceId: "space-a", clientMutationId: "turn-workflow", expectedPreviousVersion: 0,
      definitionInput: { ...f.definitionInput, ...(options.strict ? { context: { ...f.definitionInput.context, memoryMode: "strict", requiredStages: ["facts"], barrier: { deadlineMs: 100, onFailure: options.warning ? "incomplete" : "fail" } } } : {}),
        ...(options.tool ? { tools: [{ toolId: "memory.recall", toolVersion: 1, registryHash: await definitions.executableRegistryHash(), requiredCapability: "tool", approval: "explicit" }], policies: [{ policyId: "turn-tools", version: 1, rules: { limits: { toolSteps: 4 } } }] } : {}) } });
    request = { ...request, agentId: published.agentId, agentVersion: published.version }; }
  const run = await f.call<ReturnType<typeof runs.publicRun>>(runs.submit, { request }); await f.call(runtime.start, { runId: run.runId }); const row = f.db.table("runtimeAgentExecutions")[0];
  return { ...f, get grant() { return f.grant; }, args: { reference: f.reference, runId: run.runId, attemptNumber: 1, leaseVersion: row.leaseVersion as number } };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function drive(f: Fixture, prior: Entry[] = []) {
  const channel = new BaseChannel<Request>(), entries: Entry[] = clone(prior), invoked: string[] = [], retries: unknown[] = [], journal = makeFunctionReference<"mutation">("test:journal"), suspended = Error("CONTROLLED_DURABLE_SUSPENSION");
  const ctx = { runMutation: async (ref: unknown, args: unknown) => {
    const name = getFunctionName(ref as never);
    if (name === "test:journal") { const added = (args as { steps: { retry?: unknown; step: Entry["step"] }[] }).steps.map(({ retry, step }, index) => { retries.push(retry); return { _id: `steps:${entries.length + index}`, _creationTime: clock, workflowId: "workflow:turn-v5", stepNumber: entries.length + index, step } as Entry; }); entries.push(...added); return added; }
    invoked.push(name); const reg = runtime[name.split(":")[1] as keyof typeof runtime]; assertNativeArgs(reg, args); return f.call(reg, args);
  } };
  const executor = new StepExecutor("workflow:turn-v5", 0, ctx as never, { journal: { startSteps: journal } } as never, clone(prior), channel, clock, undefined), worker = executor.run(); void worker.catch(() => {});
  const context = createWorkflowCtx("workflow:turn-v5" as never, channel), handler = (runtime.executeToolsV6 as unknown as { _handler(ctx: unknown, args: unknown): Promise<null> })._handler, task = handler(context, f.args); void task.catch(() => {}); let result: unknown, error: unknown;
  try { result = await Promise.race([task, worker.then(() => { throw suspended; })]); } catch (value) { error = value; }
  channel.close(); try { await worker; } catch (value) { if (!(value instanceof ChannelClosedError) && value !== error) throw value; }
  return { entries, invoked, retries, error, result, suspended };
}
function complete(entries: Entry[], value: unknown) { const result = clone(entries), entry = result.at(-1)!; entry.step.inProgress = false; entry.step.completedAt = clock; entry.step.runResult = { kind: "success", returnValue: value as never }; return result; }
async function completeMutation(f: Fixture, entries: Entry[]) {
  const entry = entries.at(-1)!; if (entry.step.kind !== undefined && entry.step.kind !== "function") throw Error("Function step required");
  const name = entry.step.name; if (!name.startsWith("runtimeAgent:")) throw Error("Original handler required"); const reg = runtime[name.split(":")[1] as keyof typeof runtime]; assertNativeArgs(reg, entry.step.args);
  return complete(entries, await f.call(reg, entry.step.args));
}

async function toolFixture() {
  const f = await fixture({ tool: true });
  await f.call(runtime.startContext, f.args); await f.call(runtime.saveContext, { ...f.args, context: "", witnesses: [], completeness: "complete" });
  await f.db.patch("runtimeAgentExecutions", f.db.table("runtimeAgentExecutions")[0]._id, { directState: "started" });
  const prepared = await f.call<{ op: { operationId: string } }>(runtime.prepareResolvedModelOperation, { ...f.args, ordinal: 0 });
  const input = f.native.messages.values().next().value!, id = "native:tool-first";
  f.native.messages.set(id, { ...input, _id: id, stepOrder: 1, message: { role: "assistant", content: [{ type: "tool-call", toolCallId: "call-v6", toolName: "memory_recall", input: { text: "query", limit: 1 } }] } });
  const result = { savedMessageIds: [id], final: false, calls: [{ toolCallId: "call-v6", toolName: "memory_recall", inputCanonical: canonicalModelJson({ text: "query", limit: 1 }) }] };
  await f.call(runtime.finishOperation, { ...f.args, operationId: prepared.op.operationId, resultCanonical: canonicalModelJson(result), nativeMessageIds: [id] });
  await f.call(runtime.attachDirectContinuation, f.args); return f;
}
it("installed V6 journal reads completed first operation, owns explicit approval, and never queues ordinal0 inference", async () => {
  const f = await toolFixture(), first = await drive(f); expect(first.entries.at(-1)!.step).toMatchObject({ name: "runtimeAgent:completedModelStep", functionType: "query", args: { ...f.args, ordinal: 0 } });
  const begin = await drive(f, await completeMutation(f, first.entries)); expect(begin.entries.at(-1)!.step.name).toBe("runtimeAgent:beginOperation");
  const waiting = await drive(f, await completeMutation(f, begin.entries)); expect(waiting.entries.at(-1)!.step.name).toBe("runtimeAgent:waitForApproval");
  const event = await drive(f, await completeMutation(f, waiting.entries)); expect(f.db.table("runtimeRuns")[0].responseStatus).toBe("waiting_approval");
  const operation = f.db.table("runtimeAgentOperations").find(x => x.kind === "tool")!;
  await f.call(runtime.approveTool, { runId: f.args.runId, operationId: operation.operationId, expectedRequestHash: await (await import("../../../src/domain/profile")).semanticHash(operation.requestCanonical as string) });
  expect(approvedEvents).toHaveLength(1);
  const tool = await drive(f, complete(event.entries, "approved")); expect(tool.entries.at(-1)!.step).toMatchObject({ functionType: "action", args: { ordinal: 0 }, name: "server tool memory_recall" }); expect(tool.retries.at(-1)).toBe(false);
  const next = await drive(f, complete(tool.entries, null)); expect(next.entries.at(-1)!.step).toMatchObject({ functionType: "action", args: { ordinal: 1 }, name: "context and model turn 1" }); expect(next.retries.at(-1)).toBe(false);
  expect(next.entries.filter(e => (e.step.kind === undefined || e.step.kind === "function") && e.step.functionType === "action" && e.step.name === "context and model turn 0")).toEqual([]);
  const replay = await drive(f, next.entries); expect(replay.invoked).toEqual([]); expect(replay.entries).toEqual(next.entries);
  expect((await drive(f, complete(next.entries, { savedMessageIds: [], final: true, calls: [] }))).result).toBeNull();
});
it("a missing or stale completed first operation cannot start tool/model continuation", async () => {
  const f = await toolFixture(), first = await drive(f); f.native.messages.values().next().value!.message = { role: "user", content: "edited" };
  await expect(completeMutation(f, first.entries)).rejects.toThrow("STALE_TRANSCRIPT"); expect(f.db.table("runtimeModelAttempts")).toEqual([]);
});
