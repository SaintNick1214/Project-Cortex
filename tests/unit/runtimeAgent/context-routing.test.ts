/** Actual native handlers and installed Workflow executor; controlled DB/component ports, no live OCC/SLO claim. */
import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import { BaseChannel, ChannelClosedError } from "async-channel";
import { getFunctionName, makeFunctionReference } from "convex/server";
import { createWorkflowCtx } from "../../../node_modules/@convex-dev/workflow/dist/client/workflowContext.js";
import { StepExecutor } from "../../../node_modules/@convex-dev/workflow/dist/client/step.js";
import type { MutationCtx } from "../../../convex-dev/_generated/server";
import { LARGE_EMBEDDING_PROFILE } from "../../../src/domain/profile";
import { assertNativeArgs } from "./native-arguments";
type Request = Parameters<typeof createWorkflowCtx>[1] extends BaseChannel<infer T> ? T : never;
type Entry = ConstructorParameters<typeof StepExecutor>[4][number];
const starts: unknown[][] = [];
const host = globalThis as typeof globalThis & { Convex?: unknown }, originalHost = host.Convex;
jest.unstable_mockModule("@convex-dev/workflow", () => ({ WorkflowManager: class {
  define(input: { handler: unknown }) { return { _handler: input.handler }; }
  async start(...args: unknown[]) { starts.push(args); return "workflow:routing"; }
} }));
const { ingestionFixture, ingestion, installIngestionMockRoot, invoke } = await import("../runtimeIngestion/fixture");
const { clone, ledger } = await import("../runtimeTranscript/fixture");
const runtime = await import("../../../convex-dev/runtimeAgent");
const runs = await import("../../../convex-dev/runs");
const memory = await import("../../../convex-dev/runtimeMemory");
const definitions = await import("../../../convex-dev/agentDefinitions");
beforeEach(() => {
  installIngestionMockRoot(); starts.length = 0;
  host.Convex = { asyncSyscall: async (name: string, input: string) => {
    if (name !== "1.0/createFunctionHandle") throw new Error(`Unexpected syscall ${name}`);
    return JSON.stringify(`function://${JSON.parse(input).name}`);
  } };
});
afterEach(() => { jest.restoreAllMocks(); host.Convex = originalHost; });
async function fixture(options: { strict?: boolean; warn?: boolean; maxContextTokens?: number } = {}) {
  const f = await ingestionFixture(), query = f.ctx.runQuery.bind(f.ctx), mutation = f.ctx.runMutation.bind(f.ctx), calls: string[] = [];
  f.ctx.runQuery = (async (ref, args) => {
    let name = ""; try { name = getFunctionName(ref); } catch { return query(ref, args); }
    calls.push(name);
    if (name.startsWith("runtimeAgent:")) {
      const registration = runtime[name.split(":")[1] as keyof typeof runtime]; assertNativeArgs(registration, args); return invoke(registration, f.ctx, args);
    }
    if (name.startsWith("runtimeMemory:")) return invoke(memory[name.split(":")[1] as keyof typeof memory], f.ctx, args);
    return query(ref, args);
  }) as MutationCtx["runQuery"];
  f.ctx.runMutation = (async (ref, args) => {
    let name = ""; try { name = getFunctionName(ref); } catch { return mutation(ref, args); }
    calls.push(name);
    if (name.startsWith("runtimeAgent:")) {
      const registration = runtime[name.split(":")[1] as keyof typeof runtime]; assertNativeArgs(registration, args); return f.call(registration, args);
    }
    if (name === "runs:claimNext") return f.call(runs.claimNext, args);
    return mutation(ref, args);
  }) as MutationCtx["runMutation"];
  async function start(startContext = true) {
    let request = f.request();
    if (options.strict || options.warn || options.maxContextTokens) {
      const published = await f.call<{ agentId: string; version: number }>(definitions.publishVersion, {
        memorySpaceId: "space-a", clientMutationId: "routing-policy", expectedPreviousVersion: 0,
        definitionInput: { ...f.definitionInput, context: { ...f.definitionInput.context, maxContextTokens: options.maxContextTokens ?? 16_384,
          ...(options.strict ? { memoryMode: "strict", requiredStages: ["facts"] } : {}),
          barrier: { deadlineMs: 100, onFailure: options.warn ? "incomplete" : "fail" } } },
      }); request = { ...request, agentId: published.agentId, agentVersion: published.version };
    }
    // A short valid input fits the small context-cap fixture; the warning
    // text is what must overflow, not the original transcript admission.
    if (options.maxContextTokens) request = { ...request, parts: [{ type: "text", text: "." }] };
    const run = await f.call<ReturnType<typeof runs.publicRun>>(runs.submit, { request }); await f.call(runtime.start, { runId: run.runId });
    const owned = f.db.table("runtimeAgentExecutions")[0], args = { reference: f.reference, runId: run.runId, attemptNumber: 1, leaseVersion: owned.leaseVersion as number };
    if (startContext) await f.call(runtime.startContext, args); return { run, args };
  }
  async function prior(count = 1, complete = false) {
    const sources = [];
    for (let index = 0; index < count; index++) {
      const source = await f.source(`Prior authorized evidence ${index}`, `prior:${index}`); await ingestion.enqueueSourceEvent(f.ctx, f.reference, source); sources.push(source);
    }
    if (complete) for (const event of f.db.table("runtimeIngestionEvents")) event.factsState = event.vectorsState = "complete";
    return sources;
  }
  return { ...f, get grant() { return f.grant; }, calls, start, prior };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
function state(f: Fixture) { return clone({ rows: f.db.rows, writes: f.db.writes, native: f.native, effects: f.effects, scheduled: f.scheduled }); }
function observeReads(f: Fixture) {
  const query = f.db.query.bind(f.db), reads: { table: string; limit: number; count: number }[] = [];
  jest.spyOn(f.db, "query").mockImplementation(table => {
    const builder = query(table), take = builder.take;
    builder.take = async limit => { const result = await take(limit); reads.push({ table, limit, count: result.length }); return result; };
    return builder;
  }); return reads;
}
function stopAtOriginalRetrieval(f: Fixture) {
  const query = f.ctx.runQuery.bind(f.ctx), reached = jest.fn();
  f.ctx.runQuery = (async (ref, args) => {
    let name = ""; try { name = getFunctionName(ref); } catch { return query(ref, args); }
    if (name === "runtimeModelPolicy:resolve" && (args as { operationKey: string }).operationKey === "embedding.query") {
      reached(args); await invoke(ledger.resolve, f.ctx, args); throw new Error("ORIGINAL_GOVERNED_RETRIEVAL");
    } return query(ref, args);
  }) as MutationCtx["runQuery"]; return reached;
}
it.each([false, true])("eligible unrepresented completed=%s routes with one bounded metadata read and no full probe or effects", async complete => {
  const f = await fixture(); await f.prior(1, complete); const { args } = await f.start(); const before = state(f), reads = observeReads(f);
  expect(await f.call(runtime.prepareRoutedContext, args)).toEqual({ state: "NEEDS_ACTION" }); expect(state(f)).toEqual(before);
  expect(reads.filter(read => read.table === "runtimeIngestionEvents")).toEqual([{ table: "runtimeIngestionEvents", limit: 1025, count: 2 }]);
  expect(reads.some(read => read.table === "runtimeMemoryVectorGenerations")).toBe(false);
  expect(f.calls).not.toContain("runtimeAgent:contextInputs"); expect(f.db.table("runtimeAgentExecutions")[0].contextCanonical).toBeUndefined();
  expect(f.db.table("runtimeModelOperations")).toEqual([]); expect(f.db.table("runtimeModelAttempts")).toEqual([]);
});
it("completed indexed routing reaches the same original governed retrieval tuple without saving an empty context", async () => {
  const f = await fixture(); await f.prior(1, true); const { args } = await f.start();
  expect(await f.call(runtime.prepareRoutedContext, args)).toEqual({ state: "NEEDS_ACTION" });
  const reached = stopAtOriginalRetrieval(f); await expect(invoke(runtime.prepareContext, f.ctx, args)).rejects.toThrow("ORIGINAL_GOVERNED_RETRIEVAL");
  expect(reached).toHaveBeenCalledTimes(1); expect(reached.mock.calls[0][0]).toEqual({ reference: args.reference, operationKey: "embedding.query", runBudgetId: f.db.table("runtimeRuns")[0].runBudgetId });
  expect(f.db.table("runtimeAgentExecutions")[0].contextState).toBe("started"); expect(f.db.table("runtimeModelAttempts")).toEqual([]);
});
it.each(["empty", "ineligible", "awaiting_approval", "represented", "warning"])("%s falls through to the original exact proof/save outcome", async mode => {
  const f = await fixture();
  if (["ineligible", "awaiting_approval"].includes(mode)) { await f.prior(); f.db.table("runtimeIngestionEvents")[0].eligibility = mode; }
  const { args } = await f.start();
  if (mode === "represented") { const event = f.db.table("runtimeIngestionEvents").at(-1)!; event.factsState = event.vectorsState = "complete"; }
  if (mode === "warning") Object.assign(f.db.table("runtimeAgentExecutions")[0], { contextCompleteness: "incomplete", contextFailureCode: "MEMORY_STAGE_FAILED" });
  const before = state(f), stop = new Error("REFERENCE_ROLLBACK"); let original: unknown;
  await expect(f.transaction(async () => { expect(await invoke(runtime.prepareEmptyContext, f.ctx, args)).toEqual({ state: "COMPLETE" }); original = state(f); throw stop; })).rejects.toBe(stop);
  expect(state(f)).toEqual(before); expect(await f.call(runtime.prepareRoutedContext, args)).toEqual({ state: "COMPLETE" }); expect(state(f)).toEqual(original);
  expect(f.db.table("runtimeModelOperations")).toEqual([]);
});
it.each(["pending", "unknown"])("false-positive %s routes to original pending context, with original witnesses and no embedding", async mode => {
  const f = await fixture(), [source] = await f.prior(); if (mode === "unknown") f.db.table("runtimeIngestionEvents")[0].factsState = "unknown";
  const { args } = await f.start(); expect(await f.call(runtime.prepareRoutedContext, args)).toEqual({ state: "NEEDS_ACTION" });
  await invoke(runtime.prepareContext, f.ctx, args);
  expect(f.db.table("runtimeAgentExecutions")[0]).toMatchObject({ contextState: "complete", sourceWitnesses: [{ sourceId: source.lineage.sourceId, contentHash: source.contentHash, permissions: ["canViewMemories"] }] });
  expect(f.db.table("runtimeAgentExecutions")[0].contextCanonical).toContain(source.content); expect(f.db.table("runtimeModelOperations")).toEqual([]);
  if (mode === "unknown") expect(f.db.table("runtimeIngestionEvents")[0].factsState).toBe("unknown");
});
it.each(["tenant", "space", "owner", "after_cutoff"])("%s metadata cannot be used by the scoped hint or original empty proof", async mode => {
  const f = await fixture(), { args } = await f.start();
  f.db.seed("runtimeIngestionEvents", { tenantId: mode === "tenant" ? "foreign" : f.reference.tenantId,
    memorySpaceId: mode === "space" ? "foreign" : f.reference.memorySpaceId, ownerPrincipalId: mode === "owner" ? "foreign" : f.reference.principalId,
    sequence: mode === "after_cutoff" ? 2 : 1, eligibility: "eligible", lineage: { sourceId: "foreign", sourceEventId: "foreign", sourceRevision: 1 } });
  const reads = observeReads(f); expect(await f.call(runtime.prepareRoutedContext, args)).toEqual({ state: "COMPLETE" });
  expect(reads.find(read => read.table === "runtimeIngestionEvents" && read.limit === 1025)).toMatchObject({ count: 1 });
  expect(f.db.table("runtimeAgentExecutions")[0]).toMatchObject({ contextCanonical: "", sourceWitnesses: [] }); expect(f.db.table("runtimeModelOperations")).toEqual([]);
});
it("space authority routes another owner's metadata while the original Action still determines resource readability", async () => {
  const f = await fixture(); await f.prior(1, true); f.grant.resourceAccess = "space"; const { args } = await f.start();
  f.db.table("runtimeIngestionEvents")[0].ownerPrincipalId = "another-principal";
  expect(await f.call(runtime.prepareRoutedContext, args)).toEqual({ state: "NEEDS_ACTION" }); expect(f.db.table("runtimeAgentExecutions")[0].contextCanonical).toBeUndefined();
});
it("a same-conversation future run is a safe positive hint, then original boundary checks save no future context", async () => {
  const f = await fixture(); await f.prior(1, true); const { args, run } = await f.start(), event = f.db.table("runtimeIngestionEvents")[0];
  Object.assign(event, { conversationId: run.conversationId, runId: "missing-future-run" });
  expect(await f.call(runtime.prepareRoutedContext, args)).toEqual({ state: "NEEDS_ACTION" }); await invoke(runtime.prepareContext, f.ctx, args);
  expect(f.db.table("runtimeAgentExecutions")[0]).toMatchObject({ contextState: "complete", contextCanonical: "", sourceWitnesses: [] }); expect(f.db.table("runtimeModelOperations")).toEqual([]);
});
it("metadata overflow routes conservatively at the original bounded 1025-row cap without full pending/profile work", async () => {
  const f = await fixture(); await f.prior(); f.db.table("runtimeIngestionEvents")[0].eligibility = "superseded";
  for (let index = 2; index <= 1026; index++) f.db.seed("runtimeIngestionEvents", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId,
    ownerPrincipalId: f.reference.principalId, sequence: index, eligibility: "superseded", lineage: { sourceId: `overflow:${index}`, sourceEventId: `overflow:${index}`, sourceRevision: 1 } });
  f.db.table("runtimeIngestionScopes")[0].sequence = 1026; const { args } = await f.start(), before = state(f), reads = observeReads(f);
  expect(await f.call(runtime.prepareRoutedContext, args)).toEqual({ state: "NEEDS_ACTION" }); expect(state(f)).toEqual(before);
  expect(reads.filter(read => read.table === "runtimeIngestionEvents")).toEqual([{ table: "runtimeIngestionEvents", limit: 1025, count: 1025 }]);
  expect(reads.some(read => read.table === "runtimeMemoryVectorGenerations")).toBe(false);
});
it.each(["cutoff", "profile", "runBudgetId", "represented", "owner", "context", "witnesses"])("the attempt-only registration rejects caller-selected %s", async key => {
  const f = await fixture(), { args } = await f.start(); expect(runtime.prepareRoutedContext.isInternal).toBe(true);
  expect(() => assertNativeArgs(runtime.prepareRoutedContext, { ...args, [key]: "injected" })).toThrow(`Unknown native field: ${key}`);
});
it.each(["revocation", "delete", "epoch", "lease", "expired_lease", "attempt", "cancel", "input_edit", "context_state"])("fresh routing denies %s before hint metadata or effects", async fault => {
  const f = await fixture(); await f.prior(1, true); const { args } = await f.start(); let input = args;
  if (fault === "revocation") f.grant.revokedAt = Date.now();
  if (fault === "delete") f.db.table("runtimeConversations")[0].tombstonedAt = Date.now();
  if (fault === "epoch") f.db.table("runtimeConversations")[0].epoch = 2;
  if (fault === "lease") input = { ...args, leaseVersion: args.leaseVersion + 1 };
  if (fault === "attempt") input = { ...args, attemptNumber: 0 };
  if (fault === "expired_lease") f.db.table("runtimeRunOutbox")[0].leaseExpiresAt = Date.now();
  if (fault === "cancel") f.db.table("runtimeRuns")[0].cancellationRequestedAt = Date.now();
  if (fault === "context_state") f.db.table("runtimeAgentExecutions")[0].contextState = "complete";
  if (fault === "input_edit") f.native.messages.values().next().value!.message = { role: "user", content: "edited" };
  const before = state(f), reads = observeReads(f); await expect(f.call(runtime.prepareRoutedContext, input)).rejects.toThrow(); expect(state(f)).toEqual(before);
  expect(reads.filter(read => read.table === "runtimeIngestionEvents" && read.limit === 1025)).toEqual([]);
});
it.each(["revocation", "lease", "source_edit"])("the original fallback freshly rejects %s after a positive hint", async fault => {
  const f = await fixture(), [source] = await f.prior(), { args } = await f.start();
  expect(await f.call(runtime.prepareRoutedContext, args)).toEqual({ state: "NEEDS_ACTION" });
  if (fault === "revocation") f.grant.revokedAt = Date.now();
  if (fault === "lease") f.db.table("runtimeRunOutbox")[0].leaseVersion = args.leaseVersion + 1;
  if (fault === "source_edit") await f.source("Changed private source", source.lineage.sourceId);
  await expect(invoke(runtime.prepareContext, f.ctx, args)).rejects.toThrow(); expect(f.db.table("runtimeAgentExecutions")[0].contextCanonical).toBeUndefined();
  expect(f.db.table("runtimeModelOperations")).toEqual([]);
});
it("the original save witness rejects a source edit after Action contextInputs without false completion", async () => {
  const f = await fixture(), [source] = await f.prior(), { args } = await f.start();
  expect(await f.call(runtime.prepareRoutedContext, args)).toEqual({ state: "NEEDS_ACTION" }); const query = f.ctx.runQuery.bind(f.ctx); let reached = false;
  f.ctx.runQuery = (async (ref, input) => { const value = await query(ref, input); let name = "";
    try { name = getFunctionName(ref); } catch { return value; }
    if (name === "runtimeAgent:contextInputs") { reached = true; await f.source("Edited after fresh DTO", source.lineage.sourceId); } return value;
  }) as MutationCtx["runQuery"];
  await expect(invoke(runtime.prepareContext, f.ctx, args)).rejects.toThrow(); expect(reached).toBe(true);
  expect(f.db.table("runtimeAgentExecutions")[0].contextCanonical).toBeUndefined(); expect(f.db.table("runtimeModelOperations")).toEqual([]);
});
it("original profile readiness and pending overflow failure precedence remain after the hint", async () => {
  const f = await fixture(), [source] = await f.prior(33), { args } = await f.start();
  f.db.seed("runtimeMemoryVectorGenerations", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId,
    ownerPrincipalId: f.reference.principalId, ...source.lineage, contentHash: source.contentHash, profile: LARGE_EMBEDDING_PROFILE });
  const reads = observeReads(f); expect(await f.call(runtime.prepareRoutedContext, args)).toEqual({ state: "NEEDS_ACTION" });
  await expect(invoke(runtime.prepareContext, f.ctx, args)).rejects.toThrow("CONTEXT_OVERFLOW");
  expect(f.db.table("runtimeAgentExecutions")[0]).toMatchObject({ contextState: "failed", contextFailureCode: "CONTEXT_OVERFLOW" });
  expect(reads.some(read => read.table === "runtimeMemoryVectorGenerations")).toBe(false); expect(f.db.table("runtimeModelAttempts")).toEqual([]);
});
it("stale profile readiness cannot be certified empty by either a positive or negative metadata hint", async () => {
  const f = await fixture(), [source] = await f.prior(), { args } = await f.start();
  f.db.seed("runtimeMemoryVectorGenerations", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId,
    ownerPrincipalId: f.reference.principalId, ...source.lineage, contentHash: source.contentHash, profile: LARGE_EMBEDDING_PROFILE });
  expect(await f.call(runtime.prepareRoutedContext, args)).toEqual({ state: "NEEDS_ACTION" });
  await expect(invoke(runtime.prepareContext, f.ctx, args)).rejects.toThrow("PROFILE_NOT_READY");
  f.db.table("runtimeIngestionEvents")[0].eligibility = "awaiting_approval";
  await expect(f.call(runtime.prepareRoutedContext, args)).rejects.toThrow("PROFILE_NOT_READY"); expect(f.db.table("runtimeAgentExecutions")[0].contextCanonical).toBeUndefined();
});
it("negative hint keeps the complete original empty/save re-probe when memory changes mid-proof", async () => {
  const f = await fixture(), { args } = await f.start(), query = f.db.query.bind(f.db); let metadataReads = 0, reached = false;
  jest.spyOn(f.db, "query").mockImplementation(table => {
    const builder = query(table), take = builder.take; builder.take = async count => {
      const result = await take(count);
      if (table === "runtimeIngestionEvents" && count === 1025 && ++metadataReads === 2) {
        reached = true; f.db.seed("runtimeIngestionEvents", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId,
          ownerPrincipalId: f.reference.principalId, sequence: 1, eligibility: "eligible", lineage: { sourceId: "appeared", sourceEventId: "appeared", sourceRevision: 1 } });
      } return result;
    }; return builder;
  });
  await expect(f.call(runtime.prepareRoutedContext, args)).rejects.toThrow("STALE_CONTEXT"); expect(reached).toBe(true);
  expect(f.db.table("runtimeAgentExecutions")[0].contextCanonical).toBeUndefined(); expect(f.db.table("runtimeModelOperations")).toEqual([]);
});
it.each(["execution-write", "run-write"])("a %s failure rolls back the entire original negative-hint context save", async fault => {
  const f = await fixture(), { args } = await f.start(), before = state(f), patch = f.db.patch.bind(f.db); let reached = false;
  jest.spyOn(f.db, "patch").mockImplementation(async (tableOrId: string, idOrPatch: string | Record<string, unknown>, value?: Record<string, unknown>) => {
    if (typeof idOrPatch === "string") await patch(tableOrId, idOrPatch, value!); else await patch(tableOrId, idOrPatch);
    if (tableOrId === (fault === "execution-write" ? "runtimeAgentExecutions" : "runtimeRuns")) { reached = true; throw new Error("ORIGINAL_CONTEXT_WRITE_FAILURE"); }
  });
  await expect(f.call(runtime.prepareRoutedContext, args)).rejects.toThrow("ORIGINAL_CONTEXT_WRITE_FAILURE"); expect(reached).toBe(true); expect(state(f)).toEqual(before);
});
it("a lost completed native result cannot repeat context saves or create model work", async () => {
  const f = await fixture(), { args } = await f.start(); expect(await f.call(runtime.prepareRoutedContext, args)).toEqual({ state: "COMPLETE" }); const before = state(f);
  await expect(f.call(runtime.prepareRoutedContext, args)).rejects.toThrow("INVALID_STATE"); expect(state(f)).toEqual(before);
});
it("fresh ordinary starts atomically schedule V6 and retain duplicate ownership", async () => {
  const f = await fixture(), { run } = await f.start(); expect(starts).toEqual([]);
  const scheduled = f.scheduled.filter(row => row.name === "runtimeAgent:executeDirectV6"); expect(scheduled).toHaveLength(1);
  expect(scheduled[0].args).toMatchObject({ runId: run.runId, attemptNumber: 1 });
  expect(f.db.table("runtimeAgentExecutions")[0]).toMatchObject({ executionMode: "direct-v6", directState: "scheduled" });
  await f.call(runtime.start, { runId: run.runId }); expect(starts).toEqual([]); expect(f.scheduled.filter(row => row.name === "runtimeAgent:executeDirectV6")).toHaveLength(1);
});
async function drive(f: Fixture, args: Awaited<ReturnType<Fixture["start"]>>["args"], options: { entries?: Entry[]; journalModel?: boolean } = {}) {
  const channel = new BaseChannel<Request>(), entries: Entry[] = [], invoked: string[] = [], actions: { name: string; args: unknown; retry: boolean }[] = [], failures: string[] = [], sleeps: number[] = [];
  const stop = new Error("CONTROLLED_BEFORE_MODEL"), suspended = new Error("CONTROLLED_SEPARATE_STEP"), journal = makeFunctionReference<"mutation">("test:journal");
  const native = { runMutation: async (ref: unknown, input: unknown) => {
    const name = getFunctionName(ref as never);
    if (name === "test:journal") {
      const records = (input as { steps: { step: Entry["step"] }[] }).steps.map(({ step }, index) => ({ _id: `journal:${entries.length + index}`,
        _creationTime: Date.now(), workflowId: "workflow:routing", stepNumber: entries.length + index, step } as Entry)); entries.push(...records); return records;
    }
    invoked.push(name); const registration = runtime[name.split(":")[1] as keyof typeof runtime]; assertNativeArgs(registration, input); return f.call(registration, input);
  } };
  const executor = new StepExecutor("workflow:routing", 0, native as never, { journal: { startSteps: journal } } as never,
    structuredClone(options.entries ?? []), channel, Date.now(), undefined), worker = executor.run(); void worker.catch(() => {});
  const context = createWorkflowCtx("workflow:routing" as never, channel);
  const handler = (runtime.executeTurnV4 as unknown as { _handler: (step: unknown, args: unknown) => Promise<null> })._handler;
  const task = handler({ ...context,
    runMutation: async (ref: unknown, input: unknown, settings: unknown) => {
      if (getFunctionName(ref as never) === "runtimeAgent:failContext") { expect(settings).toBeUndefined(); failures.push("runtimeAgent:failContext"); return f.call(runtime.failContext, input); }
      return context.runMutation(ref as never, input as never, settings as never);
    },
    runAction: async (ref: unknown, input: unknown, settings: { retry: boolean }) => {
      const name = getFunctionName(ref as never); actions.push({ name, args: input, retry: settings.retry });
      if (name === "runtimeAgent:prepareContext") return invoke(runtime.prepareContext, f.ctx, input);
      if (options.journalModel) return context.runAction(ref as never, input as never, settings); throw stop;
    },
    sleep: async (ms: number) => { sleeps.push(ms); jest.mocked(Date.now).mockReturnValue(Date.now() + ms + 1); },
  }, args); void task.catch(() => {}); let failure: unknown;
  try { await Promise.race([task, worker.then(() => { throw suspended; })]); } catch (error) { failure = error; }
  channel.close(); try { await worker; } catch (error) { if (!(error instanceof ChannelClosedError) && error !== failure) throw error; }
  return { entries, invoked, actions, failures, sleeps, failure, stop, suspended };
}
function complete(entries: Entry[], result: unknown, error?: string) {
  const copy = structuredClone(entries), entry = copy.at(-1)!;
  expect(entry.step.inProgress).toBe(true); entry.step.inProgress = false; entry.step.completedAt = Date.now();
  entry.step.runResult = error ? { kind: "failed", error } : { kind: "success", returnValue: result as never }; return copy;
}
async function executeScheduled(f: Fixture, entries: Entry[]) {
  const step = entries.at(-1)!.step; expect(step).toMatchObject({ name: "runtimeAgent:prepareRoutedContext", functionType: "mutation", inProgress: true });
  assertNativeArgs(runtime.prepareRoutedContext, step.args); const result = await f.call(runtime.prepareRoutedContext, step.args); return complete(entries, result);
}
it("V4 schedules a separate routing mutation; original empty completion and exact journal replay repeat no work", async () => {
  const f = await fixture(), { args } = await f.start(false), first = await drive(f, args);
  expect(first.failure).toBe(first.suspended); expect(first.invoked).toEqual(["runtimeAgent:startContext", "runtimeAgent:contextBarrier"]); expect(first.actions).toEqual([]);
  expect(first.entries.map(entry => [entry.step.name, entry.step.inProgress])).toEqual([["runtimeAgent:startContext", false], ["runtimeAgent:contextBarrier", false], ["runtimeAgent:prepareRoutedContext", true]]);
  const history = await executeScheduled(f, first.entries), before = state(f);
  for (let index = 0; index < 2; index++) {
    const replay = await drive(f, args, { entries: structuredClone(history) }); expect(replay.failure).toBe(replay.stop);
    expect(replay.invoked).toEqual([]); expect(replay.entries).toEqual([]); expect(replay.actions).toEqual([{ name: "runtimeAgent:modelStep", args: { ...args, ordinal: 0 }, retry: false }]); expect(state(f)).toEqual(before);
  }
});
it("V4 positive routing schedules the unchanged governed Action only once before any model effect", async () => {
  const f = await fixture(); await f.prior(1, true); const { args } = await f.start(false), first = await drive(f, args), history = await executeScheduled(f, first.entries);
  expect(history.at(-1)!.step.runResult).toMatchObject({ kind: "success", returnValue: { state: "NEEDS_ACTION" } }); const reached = stopAtOriginalRetrieval(f), resumed = await drive(f, args, { entries: history });
  expect(String(resumed.failure)).toContain("ORIGINAL_GOVERNED_RETRIEVAL"); expect(reached).toHaveBeenCalledTimes(1);
  expect(resumed.actions).toEqual([{ name: "runtimeAgent:prepareContext", args, retry: false }]); expect(f.db.table("runtimeModelAttempts")).toEqual([]);
});
it("V4 pending overflow retains the Action's separate durable failContext mutation and no model dispatch", async () => {
  const f = await fixture(); await f.prior(33); const { args } = await f.start(false), first = await drive(f, args), history = await executeScheduled(f, first.entries), resumed = await drive(f, args, { entries: history });
  expect(String(resumed.failure)).toContain("CONTEXT_OVERFLOW"); expect(resumed.actions).toEqual([{ name: "runtimeAgent:prepareContext", args, retry: false }]);
  expect(f.db.table("runtimeAgentExecutions")[0]).toMatchObject({ contextState: "failed", contextFailureCode: "CONTEXT_OVERFLOW" }); expect(f.db.table("runtimeRuns")[0]).toMatchObject({ contextCompleteness: "incomplete", contextFailureCode: "CONTEXT_OVERFLOW" });
  expect(f.db.table("runtimeModelAttempts")).toEqual([]);
});
it("V4 preserves the original FAILED marker and separate durable fail before model/title", async () => {
  const f = await fixture({ maxContextTokens: 64 }), { args } = await f.start(false), first = await drive(f, args);
  Object.assign(f.db.table("runtimeAgentExecutions")[0], { contextCompleteness: "incomplete", contextFailureCode: "MEMORY_STAGE_FAILED" });
  const history = await executeScheduled(f, first.entries); expect(history.at(-1)!.step.runResult).toMatchObject({ returnValue: { state: "FAILED", failureCode: "CONTEXT_OVERFLOW" } });
  const resumed = await drive(f, args, { entries: history }); expect(String(resumed.failure)).toContain("CONTEXT_OVERFLOW"); expect(resumed.failures).toEqual(["runtimeAgent:failContext"]); expect(resumed.actions).toEqual([]);
  expect(f.db.table("runtimeAgentExecutions")[0]).toMatchObject({ contextState: "failed", contextFailureCode: "CONTEXT_OVERFLOW" });
});
it.each([false, true])("strict barriers precede any hint with warning=%s and preserve original bounded sleep/deadline", async warn => {
  const f = await fixture({ strict: true, warn }), { args } = await f.start(false), result = await drive(f, args); expect(result.sleeps).toEqual([100]); expect(result.actions).toEqual([]);
  if (warn) { expect(result.failure).toBe(result.suspended); const history = await executeScheduled(f, result.entries); expect(history.at(-1)!.step.runResult).toMatchObject({ returnValue: { state: "COMPLETE" } });
    expect(f.db.table("runtimeAgentExecutions")[0]).toMatchObject({ contextCompleteness: "incomplete", contextFailureCode: "MEMORY_BARRIER_TIMEOUT" });
    expect(f.db.table("runtimeAgentExecutions")[0].contextCanonical).toContain("Cortex context is incomplete (MEMORY_BARRIER_TIMEOUT)");
  } else { expect(String(result.failure)).toContain("MEMORY_BARRIER_TIMEOUT"); expect(result.entries.some(e => e.step.name === "runtimeAgent:prepareRoutedContext")).toBe(false); expect(result.failures).toEqual(["runtimeAgent:failContext"]); }
});
it("queued routing retains fresh revocation failure and failed-journal replay without Action/model work", async () => {
  const f = await fixture(), { args } = await f.start(false), first = await drive(f, args); f.grant.revokedAt = Date.now(); const before = state(f); let failure: unknown;
  try { await executeScheduled(f, first.entries); } catch (error) { failure = error; } expect(failure).toBeInstanceOf(Error); expect(state(f)).toEqual(before);
  const resumed = await drive(f, args, { entries: complete(first.entries, null, String(failure)) }); expect(String(resumed.failure)).toContain(String(failure)); expect(resumed.actions).toEqual([]); expect(resumed.invoked).toEqual([]);
});
it("installed V4 scheduling finalizes canonical answer before optional title, whose failure cannot roll it back", async () => {
  const f = await fixture(), { args } = await f.start(false), first = await drive(f, args), prepared = await executeScheduled(f, first.entries);
  const model = await drive(f, args, { entries: prepared, journalModel: true }); expect(model.failure).toBe(model.suspended); expect(model.entries.at(-1)!.step).toMatchObject({ name: "model 0", functionType: "action", inProgress: true });
  const modelHistory = complete([...prepared, ...model.entries], { final: true, calls: [], savedMessageIds: ["native:final"] }), finalizing = await drive(f, args, { entries: modelHistory, journalModel: true });
  expect(finalizing.entries.at(-1)!.step).toMatchObject({ name: "runtimeAgent:finalize", functionType: "mutation", inProgress: true, args: { ...args, finalMessageIds: ["native:final"] } });
  expect(finalizing.entries.some(e => e.step.name === "runtimeContentJobs:enqueueParentTitle")).toBe(false);
  const finalHistory = complete([...modelHistory, ...finalizing.entries], null), title = await drive(f, args, { entries: finalHistory, journalModel: true });
  expect(title.entries.at(-1)!.step).toMatchObject({ name: "runtimeContentJobs:enqueueParentTitle", functionType: "mutation", inProgress: true });
  const done = await drive(f, args, { entries: complete([...finalHistory, ...title.entries], null, "STALE_SOURCE"), journalModel: true }); expect(done.failure).toBeUndefined(); expect(done.invoked).toEqual([]);
});
