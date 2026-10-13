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
  const context = createWorkflowCtx("workflow:turn-v5" as never, channel), handler = (runtime.executeTurnV5 as unknown as { _handler(ctx: unknown, args: unknown): Promise<null> })._handler, task = handler(context, f.args); void task.catch(() => {}); let result: unknown, error: unknown;
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
it("installed interpreter queues one retry:false ordinary Action after original inline guards; no context/model executes in the parent", async () => {
  const f = await fixture(), first = await drive(f); expect(first.error).toBe(first.suspended); expect(first.entries.map(e => [e.step.name, e.step.inProgress])).toEqual([["runtimeAgent:startContext", false], ["runtimeAgent:contextBarrier", false], ["context and model turn 0", true]]);
  expect(first.entries.at(-1)!.step).toMatchObject({ functionType: "action", args: { ...f.args, ordinal: 0 } }); expect(first.retries.at(-1)).toBe(false); expect(first.invoked).toEqual(["runtimeAgent:startContext", "runtimeAgent:contextBarrier"]);
  expect(f.db.table("runtimeAgentOperations")).toEqual([]); expect(f.db.table("runtimeModelAttempts")).toEqual([]);
  const replay = await drive(f, first.entries); expect(replay.invoked).toEqual([]); expect(replay.entries).toEqual(first.entries);
});
it("journaled ordinary completion returns without another Action/finalization/title step", async () => {
  const f = await fixture(), first = await drive(f), second = await drive(f, complete(first.entries, { savedMessageIds: ["saved"], calls: [], final: true }));
  expect(second.result).toBeNull(); expect(second.error).toBeUndefined(); expect(second.entries).toHaveLength(3); expect(second.invoked).toEqual([]);
});
it.each([false, true])("strict waiting preserves sleep/deadline and durable failure vs warning=%s before ordinary work", async warning => {
  const f = await fixture({ strict: true, warning }), first = await drive(f); expect(first.entries.at(-1)!.step).toMatchObject({ kind: "sleep", name: "memory stage barrier" });
  expect(first.invoked).toEqual(["runtimeAgent:startContext", "runtimeAgent:contextBarrier"]); jest.mocked(Date.now).mockReturnValue(clock + 101);
  let next = await drive(f, complete(first.entries, null));
  if (warning) { expect(next.entries.at(-1)!.step.name).toBe("context and model turn 0"); expect(f.db.table("runtimeAgentExecutions")[0]).toMatchObject({ contextCompleteness: "incomplete", contextFailureCode: "MEMORY_BARRIER_TIMEOUT" }); }
  else { expect(next.entries.at(-1)!.step.name).toBe("runtimeAgent:failContext"); next = await drive(f, await completeMutation(f, next.entries)); expect(next.error).toBeInstanceOf(Error); expect(String(next.error)).toContain("MEMORY_BARRIER_TIMEOUT"); expect(f.db.table("runtimeAgentExecutions")[0].contextState).toBe("failed"); }
  expect(f.db.table("runtimeModelAttempts")).toEqual([]);
});
it("tool explicit approval remains Workflow-owned and native approval event gates the original server tool Action", async () => {
  const f = await fixture({ tool: true }), first = await drive(f), calls = [{ toolCallId: "approved-call", toolName: "memory_recall", inputCanonical: canonicalModelJson({ text: "query", limit: 1 }) }];
  let next = await drive(f, complete(first.entries, { savedMessageIds: [], final: false, calls })); expect(next.entries.at(-1)!.step.name).toBe("runtimeAgent:beginOperation");
  next = await drive(f, await completeMutation(f, next.entries)); expect(next.entries.at(-1)!.step.name).toBe("runtimeAgent:waitForApproval");
  next = await drive(f, await completeMutation(f, next.entries)); const op = f.db.table("runtimeAgentOperations")[0]; expect(next.entries.at(-1)!.step).toMatchObject({ kind: "event", name: op.operationId }); expect(f.db.table("runtimeRuns")[0].responseStatus).toBe("waiting_approval");
  expect(await f.call(runtime.approveTool, { runId: f.args.runId, operationId: op.operationId, expectedRequestHash: await f.hash(calls[0].inputCanonical) })).toEqual({ approved: true });
  expect(approvedEvents).toEqual([{ workflowId: "workflow:turn-v5", name: op.operationId, value: "approved" }]);
  const continued = await drive(f, complete(next.entries, "approved")); expect(continued.entries.at(-1)!.step).toMatchObject({ functionType: "action", name: "server tool memory_recall", args: { ...f.args, ordinal: 0, call: calls[0] } }); expect(continued.retries.at(-1)).toBe(false);
  const invalid = await drive(f, complete(next.entries, "forged")); expect(invalid.error).toBeInstanceOf(Error); expect(invalid.entries.at(-1)!.step.kind).toBe("event"); expect(f.db.table("runtimeModelAttempts")).toEqual([]);
});
