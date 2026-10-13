/** Installed Workflow executor/context with real inline product handlers and controlled durable ports. */
import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import { BaseChannel, ChannelClosedError } from "async-channel";
import { getFunctionName, makeFunctionReference } from "convex/server";
import { createWorkflowCtx } from "../../../node_modules/@convex-dev/workflow/dist/client/workflowContext.js";
import { StepExecutor } from "../../../node_modules/@convex-dev/workflow/dist/client/step.js";
import { assertNativeArgs } from "./native-arguments";
type Request = Parameters<typeof createWorkflowCtx>[1] extends BaseChannel<infer T> ? T : never;
type Entry = ConstructorParameters<typeof StepExecutor>[4][number];
const host = globalThis as typeof globalThis & { Convex?: unknown }, originalHost = host.Convex;
jest.unstable_mockModule("@convex-dev/workflow", () => ({ WorkflowManager: class {
  define(input: { handler: unknown }) { return { _handler: input.handler }; }
  async start() { return "workflow:empty"; }
} }));
const { ingestionFixture, installIngestionMockRoot, ingestion, invoke } = await import("../runtimeIngestion/fixture");
const { ledger } = await import("../runtimeTranscript/fixture");
const runtime = await import("../../../convex-dev/runtimeAgent");
const runs = await import("../../../convex-dev/runs");
const memory = await import("../../../convex-dev/runtimeMemory");
const definitions = await import("../../../convex-dev/agentDefinitions");
beforeEach(() => {
  installIngestionMockRoot();
  host.Convex = { asyncSyscall: async (name: string, value: string) => {
    if (name !== "1.0/createFunctionHandle") throw new Error(`Unexpected syscall ${name}`);
    return JSON.stringify(`function://${JSON.parse(value).name}`);
  } };
});
afterEach(() => { host.Convex = originalHost; jest.restoreAllMocks(); });
async function fixture(options: { strict?: boolean; warn?: boolean; pendingOverflow?: boolean; indexed?: boolean } = {}) {
  const f = await ingestionFixture(), mutation = f.ctx.runMutation.bind(f.ctx), query = f.ctx.runQuery.bind(f.ctx);
  f.ctx.runMutation = (async (ref, args) => {
    let name = ""; try { name = getFunctionName(ref); } catch { return mutation(ref, args); }
    if (name === "runs:claimNext") return f.call(runs.claimNext, args);
    if (name.startsWith("runtimeAgent:")) return f.call(runtime[name.split(":")[1] as keyof typeof runtime], args);
    return mutation(ref, args);
  }) as typeof f.ctx.runMutation;
  f.ctx.runQuery = (async (ref, args) => {
    let name = ""; try { name = getFunctionName(ref); } catch { return query(ref, args); }
    if (name.startsWith("runtimeAgent:")) return invoke(runtime[name.split(":")[1] as keyof typeof runtime], f.ctx, args);
    if (name.startsWith("runtimeMemory:")) return invoke(memory[name.split(":")[1] as keyof typeof memory], f.ctx, args);
    if (name === "runtimeModelPolicy:resolve" && (args as { operationKey: string }).operationKey === "embedding.query") {
      await invoke(ledger.resolve, f.ctx, args); throw new Error("ORIGINAL_FALLBACK_RETRIEVAL");
    } return query(ref, args);
  }) as typeof f.ctx.runQuery;
  if (options.pendingOverflow || options.indexed) {
    for (let index = 0; index < (options.pendingOverflow ? 33 : 1); index++) {
      const source = await f.source(`Prior evidence ${index}`, `prior:${index}`); await ingestion.enqueueSourceEvent(f.ctx, f.reference, source);
    }
    if (options.indexed) f.db.table("runtimeIngestionEvents")[0].factsState = f.db.table("runtimeIngestionEvents")[0].vectorsState = "complete";
  }
  let request = f.request();
  if (options.strict) {
    const published = await f.call<{ agentId: string; version: number }>(definitions.publishVersion, {
      memorySpaceId: "space-a", clientMutationId: "empty-strict", expectedPreviousVersion: 0,
      definitionInput: { ...f.definitionInput, context: { ...f.definitionInput.context, memoryMode: "strict", requiredStages: ["facts"],
        barrier: { deadlineMs: 100, onFailure: options.warn ? "incomplete" : "fail" } } },
    }); request = { ...request, agentId: published.agentId, agentVersion: published.version };
  }
  const run = await f.call<{ runId: string }>(runs.submit, { request }); await f.call(runtime.start, { runId: run.runId });
  const owned = f.db.table("runtimeAgentExecutions")[0];
  return { f, args: { reference: f.reference, runId: run.runId, attemptNumber: 1, leaseVersion: owned.leaseVersion as number } };
}
async function drive(f: Awaited<ReturnType<typeof fixture>>["f"], args: Awaited<ReturnType<typeof fixture>>["args"], options: {
  old?: boolean; entries?: Entry[]; journalFault?: boolean; afterBarrier?: () => void;
} = {}) {
  const channel = new BaseChannel<Request>(), entries: Entry[] = [], invoked: string[] = [], actions: { name: string; args: unknown; retry: boolean }[] = [], nonInline: string[] = [], sleeps: number[] = [];
  const stop = new Error("CONTROLLED_BEFORE_MODEL_EFFECTS"), journal = makeFunctionReference<"mutation">("test:journal");
  const native = { runMutation: async (ref: unknown, input: unknown) => {
    const name = getFunctionName(ref as never);
    if (name === "test:journal") {
      const steps = (input as { steps: { step: Entry["step"] }[] }).steps;
      if (options.journalFault && steps.some(item => item.step.name === "runtimeAgent:prepareEmptyContext")) throw new Error("CONTROLLED_JOURNAL_FAILURE");
      const records = steps.map(({ step }, index) => ({ _id: `journal:${entries.length + index}`, _creationTime: Date.now(), workflowId: "workflow:empty",
        stepNumber: entries.length + index, step } as Entry)); entries.push(...records); return records;
    }
    invoked.push(name); const registration = runtime[name.split(":")[1] as keyof typeof runtime]; assertNativeArgs(registration, input);
    const result = await f.call(registration, input);
    if (name === "runtimeAgent:contextBarrier") options.afterBarrier?.();
    return result;
  } };
  const executor = new StepExecutor("workflow:empty", 0, native as never, { journal: { startSteps: journal } } as never,
    options.entries ?? [], channel, Date.now(), undefined);
  const worker = executor.run(); void worker.catch(() => {});
  const context = createWorkflowCtx("workflow:empty" as never, channel);
  const registration = options.old ? runtime.executeTurn : runtime.executeTurnV2;
  const handler = (registration as unknown as { _handler: (step: unknown, args: unknown) => Promise<null> })._handler;
  const task = handler({ ...context,
    runMutation: async (ref: unknown, input: unknown, settings: unknown) => {
      if (getFunctionName(ref as never) === "runtimeAgent:failContext") {
        expect(settings).toBeUndefined(); nonInline.push("runtimeAgent:failContext"); invoked.push("runtimeAgent:failContext");
        return f.call(runtime.failContext, input);
      } return context.runMutation(ref as never, input as never, settings as never);
    },
    runAction: async (ref: unknown, input: unknown, settings: { retry: boolean }) => {
      const name = getFunctionName(ref as never); actions.push({ name, args: input, retry: settings.retry });
      if (name === "runtimeAgent:prepareContext") return invoke(runtime.prepareContext, f.ctx, input);
      throw stop;
    },
    sleep: async (ms: number) => { sleeps.push(ms); jest.mocked(Date.now).mockReturnValue(Date.now() + ms + 1); },
  }, args); void task.catch(() => {});
  let failure: unknown;
  try { await Promise.race([task, worker.then(() => { throw new Error("UNEXPECTED_BLOCKED_EXECUTOR"); })]); } catch (error) { failure = error; }
  channel.close(); try { await worker; } catch (error) { if (!(error instanceof ChannelClosedError) && error !== failure) throw error; }
  return { entries, invoked, actions, nonInline, sleeps, failure, stop };
}
it("fresh layout journals empty completion inline and reaches model with no context Action; exact replay repeats no context writes", async () => {
  const { f, args } = await fixture(), first = await drive(f, args);
  expect(first.failure).toBe(first.stop);
  expect(first.invoked).toEqual(["runtimeAgent:startContext", "runtimeAgent:contextBarrier", "runtimeAgent:prepareEmptyContext"]);
  expect(first.entries.map(e => [e.step.name, e.step.inProgress, e.step.runResult?.kind])).toEqual([
    ["runtimeAgent:startContext", false, "success"], ["runtimeAgent:contextBarrier", false, "success"], ["runtimeAgent:prepareEmptyContext", false, "success"],
  ]);
  expect(first.actions).toEqual([{ name: "runtimeAgent:modelStep", args: { ...args, ordinal: 0 }, retry: false }]);
  expect(f.db.table("runtimeAgentExecutions")[0]).toMatchObject({ contextState: "complete", contextCanonical: "", state: "running" });
  const writes = f.db.writes, replay = await drive(f, args, { entries: first.entries });
  expect(replay.failure).toBe(replay.stop); expect(replay.invoked).toEqual([]); expect(replay.entries).toEqual([]); expect(f.db.writes).toBe(writes);
  expect(f.db.table("runtimeModelOperations")).toEqual([]); expect(f.db.table("runtimeModelAttempts")).toEqual([]);
});
it("historical executeTurn preserves its original two-step prefix and context Action dispatch", async () => {
  const { f, args } = await fixture(), result = await drive(f, args, { old: true });
  expect(result.failure).toBe(result.stop); expect(result.entries.map(e => e.step.name)).toEqual(["runtimeAgent:startContext", "runtimeAgent:contextBarrier"]);
  expect(result.invoked).toEqual(["runtimeAgent:startContext", "runtimeAgent:contextBarrier"]);
  expect(result.actions.map(a => [a.name, a.retry])).toEqual([["runtimeAgent:prepareContext", false], ["runtimeAgent:modelStep", false]]);
});
it("unrepresented indexed context journals NEEDS_ACTION and dispatches the original governed Action exactly once", async () => {
  const { f, args } = await fixture({ indexed: true }), result = await drive(f, args);
  expect(result.failure).toEqual(new Error("ORIGINAL_FALLBACK_RETRIEVAL"));
  expect(result.entries[2].step.runResult).toMatchObject({ kind: "success", returnValue: { state: "NEEDS_ACTION" } });
  expect(result.actions).toEqual([{ name: "runtimeAgent:prepareContext", args, retry: false }]);
  expect(f.db.table("runtimeAgentExecutions")[0].contextState).toBe("started"); expect(f.db.table("runtimeModelOperations")).toEqual([]);
});
it("pending overflow's separate original fail mutation persists before Workflow failure and no Action/model dispatch", async () => {
  const { f, args } = await fixture({ pendingOverflow: true }), result = await drive(f, args);
  expect(result.failure).toBeInstanceOf(Error); expect(String(result.failure)).toContain("CONTEXT_OVERFLOW");
  expect(result.entries[2].step.runResult).toMatchObject({ kind: "success", returnValue: { state: "FAILED", failureCode: "CONTEXT_OVERFLOW" } });
  expect(result.nonInline).toEqual(["runtimeAgent:failContext"]); expect(result.actions).toEqual([]);
  expect(f.db.table("runtimeAgentExecutions")[0]).toMatchObject({ contextState: "failed", contextFailureCode: "CONTEXT_OVERFLOW" });
  expect(f.db.table("runtimeRuns")[0]).toMatchObject({ contextCompleteness: "incomplete", contextFailureCode: "CONTEXT_OVERFLOW" });
});
it.each([false, true])("strict barrier retains its original sleep/deadline and warning=%s outcome before local context", async warn => {
  const { f, args } = await fixture({ strict: true, warn }), result = await drive(f, args);
  expect(result.sleeps).toEqual([100]);
  if (warn) {
    expect(result.failure).toBe(result.stop); expect(result.actions.map(a => a.name)).toEqual(["runtimeAgent:modelStep"]);
    expect(f.db.table("runtimeAgentExecutions")[0]).toMatchObject({ contextState: "complete", contextCompleteness: "incomplete", contextFailureCode: "MEMORY_BARRIER_TIMEOUT" });
    expect(f.db.table("runtimeAgentExecutions")[0].contextCanonical).toContain("Cortex context is incomplete (MEMORY_BARRIER_TIMEOUT)");
  } else {
    expect(result.failure).toEqual(new Error("MEMORY_BARRIER_TIMEOUT")); expect(result.actions).toEqual([]);
    expect(result.invoked).not.toContain("runtimeAgent:prepareEmptyContext"); expect(result.nonInline).toEqual(["runtimeAgent:failContext"]);
    expect(f.db.table("runtimeAgentExecutions")[0].contextState).toBe("failed");
  }
  expect(f.db.table("runtimeModelAttempts")).toEqual([]);
});
it("revocation after the barrier is freshly refused by the native fast path and saved as failed journal result", async () => {
  const { f, args } = await fixture(), result = await drive(f, args, { afterBarrier: () => { f.grant.revokedAt = Date.now(); } });
  expect(String(result.failure)).toContain("FORBIDDEN"); expect(result.actions).toEqual([]);
  expect(result.entries[2].step.runResult?.kind).toBe("failed"); expect(f.db.table("runtimeAgentExecutions")[0].contextCanonical).toBeUndefined();
});
it("a journal-write failure rolls back local context in the containing transaction; retry executes fresh original guards", async () => {
  const { f, args } = await fixture(), before = f.db.writes;
  await expect(f.transaction(async () => {
    const result = await drive(f, args, { journalFault: true });
    expect(result.failure).toEqual(new Error("CONTROLLED_JOURNAL_FAILURE"));
    expect(f.db.table("runtimeAgentExecutions")[0].contextState).toBe("complete");
    throw result.failure;
  })).rejects.toThrow("CONTROLLED_JOURNAL_FAILURE");
  expect(f.db.writes).toBe(before); expect(f.db.table("runtimeAgentExecutions")[0].contextState).toBeUndefined();
  const fresh = await drive(f, args); expect(fresh.failure).toBe(fresh.stop); expect(fresh.invoked).toContain("runtimeAgent:prepareEmptyContext");
  expect(f.db.table("runtimeAgentExecutions")[0].contextState).toBe("complete"); expect(f.db.table("runtimeModelAttempts")).toEqual([]);
});
