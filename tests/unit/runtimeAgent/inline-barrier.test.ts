/** Installed Workflow executor/context, with actual product barrier handlers and controlled DB ports. */
import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import { BaseChannel, ChannelClosedError } from "async-channel";
import { getFunctionName, makeFunctionReference } from "convex/server";
import { createWorkflowCtx } from "../../../node_modules/@convex-dev/workflow/dist/client/workflowContext.js";
import { StepExecutor } from "../../../node_modules/@convex-dev/workflow/dist/client/step.js";
type Request = Parameters<typeof createWorkflowCtx>[1] extends BaseChannel<infer T> ? T : never;
type Entry = ConstructorParameters<typeof StepExecutor>[4][number];
const host = globalThis as typeof globalThis & { Convex?: unknown };
const originalHost = host.Convex;
jest.unstable_mockModule("@convex-dev/workflow", () => ({ WorkflowManager: class {
  define(input: { handler: unknown }) { return { _handler: input.handler }; }
  async start() { return "workflow:inline"; }
} }));
const { transcriptFixture, installIngestionMockRoot, runs } = await import("../runtimeTranscript/fixture");
const runtime = await import("../../../convex-dev/runtimeAgent");
const definitions = await import("../../../convex-dev/agentDefinitions");
beforeEach(() => {
  installIngestionMockRoot();
  host.Convex = { asyncSyscall: async (name: string, value: string) => {
    if (name !== "1.0/createFunctionHandle") throw new Error(`Unexpected syscall ${name}`);
    return JSON.stringify(`function://${JSON.parse(value).name}`);
  } };
});
afterEach(() => { host.Convex = originalHost; jest.restoreAllMocks(); });
async function fixture(strict = false) {
  const f = await transcriptFixture({ maxContextTokens: 16384 }), mutation = f.ctx.runMutation.bind(f.ctx);
  f.ctx.runMutation = (async (ref, args) => {
    if ((ref as Partial<Record<symbol, string>>)[Symbol.for("toReferencePath")]) return mutation(ref, args);
    return getFunctionName(ref) === "runs:claimNext" ? f.call(runs.claimNext, args) : mutation(ref, args);
  }) as typeof f.ctx.runMutation;
  let request = f.request();
  if (strict) {
    const definition = await f.call<{ agentId: string; version: number }>(definitions.publishVersion, {
      memorySpaceId: "space-a", clientMutationId: "inline-strict", expectedPreviousVersion: 0,
      definitionInput: { ...f.definitionInput, context: { ...f.definitionInput.context, memoryMode: "strict", requiredStages: ["facts"], barrier: { deadlineMs: 100, onFailure: "fail" } } },
    });
    request = { ...request, agentId: definition.agentId, agentVersion: definition.version };
  }
  const run = await f.call<{ runId: string }>(runs.submit, { request }); await f.call(runtime.start, { runId: run.runId });
  const owned = f.db.table("runtimeAgentExecutions")[0];
  return { f, args: { reference: f.reference, runId: run.runId, attemptNumber: 1, leaseVersion: owned.leaseVersion as number } };
}
async function executeInitial(f: Awaited<ReturnType<typeof fixture>>["f"], args: Awaited<ReturnType<typeof fixture>>["args"], options: {
  entries?: Entry[]; afterStart?: () => void; sleep?: (ms: number) => void;
} = {}) {
  const channel = new BaseChannel<Request>(), entries: Entry[] = [], invoked: string[] = [], sleeps: number[] = [], nonInline: string[] = [];
  const stop = new Error("CONTROLLED_BEFORE_CONTEXT_ACTION");
  const journal = makeFunctionReference<"mutation">("test:journal");
  const native = {
    runMutation: async (ref: unknown, input: unknown) => {
      const name = getFunctionName(ref as never);
      if (name === "test:journal") {
        const records = (input as { steps: { step: Entry["step"] }[] }).steps.map(({ step }, index) => ({
          _id: `journal:${entries.length + index}`, _creationTime: Date.now(), workflowId: "workflow:inline", stepNumber: entries.length + index, step,
        } as Entry));
        entries.push(...records); return records;
      }
      invoked.push(name);
      const registration = runtime[name.split(":")[1] as keyof typeof runtime];
      const result = await f.call(registration, input);
      if (name === "runtimeAgent:startContext") options.afterStart?.();
      return result;
    },
  };
  const executor = new StepExecutor("workflow:inline", 0, native as never, { journal: { startSteps: journal } } as never,
    options.entries ?? [], channel, Date.now(), undefined);
  const worker = executor.run(); void worker.catch(() => {});
  const context = createWorkflowCtx("workflow:inline" as never, channel);
  const handler = (runtime.executeTurn as unknown as { _handler: (step: unknown, args: unknown) => Promise<null> })._handler;
  const task = handler({ ...context,
    runMutation: async (ref: unknown, input: unknown, settings: unknown) => {
      const name = getFunctionName(ref as never);
      if (name === "runtimeAgent:failContext") {
        expect(settings).toBeUndefined(); nonInline.push(name); invoked.push(name); return f.call(runtime.failContext, input);
      }
      return context.runMutation(ref as never, input as never, settings as never);
    },
    runAction: async () => { throw stop; },
    sleep: async (ms: number) => { sleeps.push(ms); options.sleep?.(ms); },
  }, args);
  let failure: unknown;
  try { await task; } catch (error) { failure = error; }
  channel.close(); await expect(worker).rejects.toBeInstanceOf(ChannelClosedError);
  return { entries, invoked, sleeps, failure, stop, nonInline };
}
it("existing initial mutations execute inline through installed executor, stay journaled and completed replay performs no repeat writes", async () => {
  const { f, args } = await fixture();
  const first = await executeInitial(f, args);
  expect(first.failure).toBe(first.stop);
  expect(first.invoked).toEqual(["runtimeAgent:startContext", "runtimeAgent:contextBarrier"]);
  expect(first.entries.map(entry => [entry.step.name, entry.step.inProgress, entry.step.runResult?.kind])).toEqual([
    ["runtimeAgent:startContext", false, "success"], ["runtimeAgent:contextBarrier", false, "success"],
  ]);
  expect(f.db.table("runtimeAgentExecutions")[0].contextState).toBe("started"); expect(first.sleeps).toEqual([]);
  const writes = f.db.writes;
  const replay = await executeInitial(f, args, { entries: first.entries });
  expect(replay.failure).toBe(replay.stop); expect(replay.invoked).toEqual([]); expect(replay.entries).toEqual([]); expect(f.db.writes).toBe(writes);
  expect(f.db.table("runtimeModelOperations")).toEqual([]);
});
it("installed completed replay rejects changed attempt arguments before native writes", async () => {
  const { f, args } = await fixture(), first = await executeInitial(f, args);
  const channel = new BaseChannel<Request>();
  const executor = new StepExecutor("workflow:inline", 0, {} as never, {} as never, first.entries, channel, Date.now(), undefined);
  const worker = executor.run(); void worker.catch(() => {});
  const request = createWorkflowCtx("workflow:inline" as never, channel).runMutation(makeFunctionReference("runtimeAgent:startContext"), { ...args, leaseVersion: args.leaseVersion + 1 }, { inline: true });
  void request.catch(() => {});
  await expect(worker).rejects.toThrow("Journal entry mismatch"); channel.close();
  expect(f.db.table("runtimeAgentExecutions")[0].contextState).toBe("started"); expect(f.db.table("runtimeModelOperations")).toEqual([]);
});
it("strict inline barrier retains wait/deadline and fails before context/model dispatch", async () => {
  const { f, args } = await fixture(true);
  const result = await executeInitial(f, args, { sleep: ms => { jest.mocked(Date.now).mockReturnValue(Date.now() + ms + 1); } });
  expect(result.sleeps).toEqual([100]); expect(result.failure).toEqual(new Error("MEMORY_BARRIER_TIMEOUT"));
  expect(result.invoked).toEqual(["runtimeAgent:startContext", "runtimeAgent:contextBarrier", "runtimeAgent:contextBarrier", "runtimeAgent:failContext"]);
  expect(result.nonInline).toEqual(["runtimeAgent:failContext"]);
  expect(f.db.table("runtimeAgentExecutions")[0]).toMatchObject({ contextState: "failed", contextFailureCode: "MEMORY_BARRIER_TIMEOUT" });
  expect(f.db.table("runtimeModelOperations")).toEqual([]);
});
it.each(["revocation", "budget-cancel", "input-edit"])("second inline handler freshly denies %s", async fault => {
  const { f, args } = await fixture(fault === "budget-cancel");
  const result = await executeInitial(f, args, { afterStart: () => {
    if (fault === "revocation") f.grant.revokedAt = Date.now();
    if (fault === "budget-cancel") f.db.table("runtimeBudgetAccounts").find(row => row.kind === "run" && row.runBudgetId === f.db.table("runtimeRuns")[0].runBudgetId)!.cancelled = true;
    if (fault === "input-edit") f.native.messages.get((f.db.table("runtimeRuns")[0].inputMessageIds as string[])[0])!.message = { role: "user", content: "changed canonical input" };
  } });
  expect(result.failure).not.toBe(result.stop); expect(result.failure).toBeInstanceOf(Error);
  expect(result.entries.at(-1)?.step.runResult?.kind).toBe("failed"); expect(f.db.table("runtimeModelOperations")).toEqual([]);
});
it("installed Workflow rejects inline scheduling overrides/actions and keeps sleep non-inline with exact delay", async () => {
  const channel = new BaseChannel<Request>(), context = createWorkflowCtx("workflow:inline" as never, channel);
  await expect(context.runMutation(makeFunctionReference("runtimeAgent:startContext"), {}, { inline: true, runAfter: 1 } as never)).rejects.toThrow("Cannot combine");
  await expect(context.runAction(makeFunctionReference("runtimeAgent:modelStep"), {}, { inline: true } as never)).rejects.toThrow("Cannot run an action inline");
  const sleep = context.sleep(100, { name: "memory stage barrier" });
  const request = await channel.get(); expect(request).toMatchObject({ name: "memory stage barrier", inline: false, schedulerOptions: { runAfter: 100 }, unstableArgs: false });
  request.resolve({ kind: "success", returnValue: null }); await sleep; channel.close();
});
