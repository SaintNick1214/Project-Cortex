/** Installed Workflow 0.4.8/real product handlers with controlled native storage ports; no cloud/OCC/SLO claim. */
import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import { getFunctionName } from "convex/server";
import type { MutationCtx } from "../../../convex-dev/_generated/server";
import type { StepExecutor } from "../../../node_modules/@convex-dev/workflow/dist/client/step.js";
import { completeHandler } from "../../../node_modules/@convex-dev/workflow/dist/component/workflow.js";
import { assertNativeArgs } from "./native-arguments";
type Entry = ConstructorParameters<typeof StepExecutor>[4][number];
const actualAuth = await import("../../../convex-dev/runtimeAuth");
let scopeEnabled = true;
jest.unstable_mockModule("../../../convex-dev/runtimeAuth", () => ({ ...actualAuth,
  createAuthorityReadScope: <Ctx extends Parameters<typeof actualAuth.createAuthorityReadScope>[0]>(ctx: Ctx) => scopeEnabled ? actualAuth.createAuthorityReadScope(ctx) : ctx,
}));
const { ingestionFixture, ingestion, installIngestionMockRoot, invoke } = await import("../runtimeIngestion/fixture");
const { clone, clock } = await import("../runtimeTranscript/fixture");
const runtime = await import("../../../convex-dev/runtimeAgent");
const runs = await import("../../../convex-dev/runs");
const definitions = await import("../../../convex-dev/agentDefinitions");
const host = globalThis as typeof globalThis & { Convex?: unknown }, originalHost = host.Convex;
const nativeCrypto = globalThis.crypto;
// Real ctx.runQuery/runMutation executes in another native function environment.
// This in-process port must restore crypto only there, while the Workflow handler
// continues running under the installed deterministic environment.
async function nativeBoundary<T>(call: () => Promise<T>): Promise<T> {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  Object.defineProperty(globalThis, "crypto", { value: nativeCrypto, configurable: true, writable: true });
  try { return await call(); } finally { if (descriptor) Object.defineProperty(globalThis, "crypto", descriptor); }
}
beforeEach(() => {
  scopeEnabled = true; installIngestionMockRoot();
  host.Convex = { asyncSyscall: async (name: string, text: string) => {
    if (name !== "1.0/createFunctionHandle") throw Error(`Unexpected syscall ${name}`);
    return JSON.stringify(`function://${(JSON.parse(text) as { name: string }).name}`);
  } };
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { host.Convex = originalHost; jest.restoreAllMocks(); });
function functionName(ref: unknown) {
  if (typeof ref === "string") return ref.startsWith("function://") ? ref.slice("function://".length) : ref;
  return (ref as Partial<Record<symbol, string>>)[Symbol.for("toReferencePath")] ?? getFunctionName(ref as never);
}
async function fixture(options: { initialReadFailure?: boolean; journalFailure?: boolean; strict?: boolean } = {}) {
  const f = await ingestionFixture(), query = f.ctx.runQuery.bind(f.ctx), mutation = f.ctx.runMutation.bind(f.ctx);
  const entries: Entry[] = [], events: string[] = [], starts: Record<string, unknown>[] = [];
  let phase = "", initialReadFailed = false;
  Object.assign(f.ctx, { meta: { getFunctionMetadata: async () => ({ name: "runtimeAgent:executeTurnV5" }) } });
  f.ctx.runQuery = (async (ref: unknown, args: unknown) => nativeBoundary(async () => {
    const name = functionName(ref);
    if (name.endsWith("/journal/load")) {
      const workflow = await f.db.get("workflows", (args as { workflowId: string }).workflowId);
      return { workflow, logLevel: "ERROR", journalEntries: clone(entries), ok: true };
    }
    if (name.endsWith("/workflow/getStatus")) {
      events.push("component.getStatus");
      return { workflow: await f.db.get("workflows", (args as { workflowId: string }).workflowId), inProgress: entries.filter(e => e.step.inProgress), logLevel: "ERROR" };
    }
    if (options.initialReadFailure && phase === "runtimeAgent:startContext" && !initialReadFailed && name.endsWith("/getMessagesByIds")) {
      initialReadFailed = true; throw Error("CONTROLLED_INITIAL_COMPONENT_FAILURE");
    }
    return query(ref as never, args as never);
  })) as MutationCtx["runQuery"];
  f.ctx.runMutation = (async (ref: unknown, args: unknown) => nativeBoundary(async () => {
    const name = functionName(ref);
    if (name.endsWith("/workflow/create")) {
      const input = args as Record<string, unknown>; starts.push(clone(input)); events.push("component.create");
      expect(input).toMatchObject({ createOnly: true, startAsync: false, workflowName: "runtimeAgent:executeTurnV5" });
      return await f.db.insert("workflows", { name: input.workflowName, workflowHandle: input.workflowHandle, args: input.workflowArgs,
        generationNumber: 0, onComplete: input.onComplete });
    }
    if (name.endsWith("/journal/startSteps")) {
      events.push("component.journal");
      if (options.journalFailure) throw Error("CONTROLLED_INITIAL_JOURNAL_FAILURE");
      const input = args as { workflowId: string; steps: { step: Entry["step"] }[] };
      const added = input.steps.map(({ step }, offset) => ({ _id: `steps:${entries.length + offset}`, _creationTime: clock,
        workflowId: input.workflowId, stepNumber: entries.length + offset, step } as Entry));
      entries.push(...clone(added)); return added;
    }
    if (name.endsWith("/workflow/complete")) {
      events.push("component.complete");
      return completeHandler(f.ctx as unknown as Parameters<typeof completeHandler>[0], args as Parameters<typeof completeHandler>[1]);
    }
    if (name === "runs:claimNext") return f.call(runs.claimNext, args);
    if (name.startsWith("runtimeAgent:")) {
      events.push(name); const old = phase; phase = name;
      try { const registration = runtime[name.slice("runtimeAgent:".length) as keyof typeof runtime]; assertNativeArgs(registration, args); return await invoke(registration, f.ctx, args); }
      finally { phase = old; }
    }
    return mutation(ref as never, args as never);
  })) as MutationCtx["runMutation"];
  async function start() {
    let request = f.request();
    if (options.strict) {
      const source = await f.source("Prior pending evidence", "start-prior"); await ingestion.enqueueSourceEvent(f.ctx, f.reference, source);
      const published = await f.call<{ agentId: string; version: number }>(definitions.publishVersion, { memorySpaceId: "space-a", clientMutationId: "start-strict", expectedPreviousVersion: 0,
        definitionInput: { ...f.definitionInput, context: { ...f.definitionInput.context, memoryMode: "strict", requiredStages: ["facts"], barrier: { deadlineMs: 100, onFailure: "fail" } } } });
      request = { ...request, agentId: published.agentId, agentVersion: published.version };
    }
    const run = await f.call<ReturnType<typeof runs.publicRun>>(runs.submit, { request });
    const result = await f.call<{ runId: string; attemptNumber: number; state: string }>(runtime.start, { runId: run.runId });
    const owned = f.db.table("runtimeAgentExecutions")[0], args = { reference: f.reference, runId: run.runId, attemptNumber: 1, leaseVersion: owned.leaseVersion as number };
    return { run, result, owned, args };
  }
  return { ...f, get grant() { return f.grant; }, entries, events, starts, start };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
const stored = (f: Fixture) => clone({ rows: f.db.rows, writes: f.db.writes, sequence: f.db.sequence, native: f.native, effects: f.effects, scheduled: f.scheduled });
it("real immediate start sees the inserted execution, journals the inline prefix, and queues the ordinary turn Action before returning its ID", async () => {
  const f = await fixture(), { run, result, owned } = await f.start();
  expect(result).toEqual({ runId: run.runId, attemptNumber: 1, state: "ready" }); expect(f.starts).toHaveLength(1);
  expect(owned).toMatchObject({ workflowId: f.db.table("workflows")[0]._id, contextState: "started", state: "ready" });
  expect(f.entries.map(e => [e.step.name, e.step.kind === "function" || e.step.kind === undefined ? e.step.functionType : e.step.kind, e.step.inProgress])).toEqual([
    ["runtimeAgent:startContext", "mutation", false], ["runtimeAgent:contextBarrier", "mutation", false], ["context and model turn 0", "action", true],
  ]);
  expect(f.events).not.toContain("runtimeAgent:prepareRoutedContext"); expect(f.events).not.toContain("runtimeAgent:modelStep");
  expect(f.db.table("runtimeModelAttempts")).toEqual([]); expect(f.db.table("runtimeAgentOperations")).toEqual([]);
  await f.call(runtime.start, { runId: run.runId }); expect(f.starts).toHaveLength(1); expect(f.entries).toHaveLength(3);
});
it("in-progress fresh journal replay keeps one durable paid Action and never executes it in the parent mutation", async () => {
  const f = await fixture(), { owned } = await f.start(), before = stored(f); f.events.length = 0;
  await f.call(runtime.executeTurnV5, { workflowId: owned.workflowId, generationNumber: 0 });
  expect(f.events).toEqual([]); expect(f.entries.at(-1)!.step).toMatchObject({ name: "context and model turn 0", functionType: "action", inProgress: true });
  expect(stored(f)).toEqual(before); await f.call(runtime.executeTurnV5, { workflowId: owned.workflowId, generationNumber: 0 }); expect(stored(f)).toEqual(before);
  expect(f.db.table("runtimeModelAttempts")).toEqual([]); expect(f.db.table("runtimeAgentOperations")).toEqual([]);
});
it("strict readiness still journals the original bounded sleep before context or model scheduling", async () => {
  const f = await fixture({ strict: true }), { owned } = await f.start();
  expect(owned).toMatchObject({ contextState: "started", barrierStartedAt: clock });
  expect(f.entries.map(e => e.step.name)).toEqual(["runtimeAgent:startContext", "runtimeAgent:contextBarrier", "memory stage barrier"]);
  expect(f.entries.at(-1)!.step).toMatchObject({ kind: "sleep", inProgress: true }); expect(f.db.table("runtimeModelAttempts")).toEqual([]);
});
it("official early completion binds the verified document then runs the original strict callback with a consistent failed admission", async () => {
  const f = await fixture({ initialReadFailure: true }), { run, result, owned } = await f.start();
  expect(result.state).toBe("failed"); expect(owned).toMatchObject({ state: "failed", failureCode: "EXECUTION_FAILED", workflowId: f.db.table("workflows")[0]._id });
  expect(f.db.table("workflows")[0].runResult).toMatchObject({ kind: "failed", error: expect.stringContaining("CONTROLLED_INITIAL_COMPONENT_FAILURE") });
  expect(await f.call(runs.get, { runId: run.runId })).toMatchObject({ responseStatus: "failed", failureCode: "EXECUTION_FAILED" });
  expect(f.events.slice(-4)).toEqual(["runtimeAgent:onInitialWorkflowComplete", "component.getStatus", "runtimeAgent:onWorkflowComplete", "runtimeAgent:endInterrupted"]);
  expect(f.db.table("onCompleteFailures")).toEqual([]); expect(f.db.table("runtimeRunOutbox")[0].state).toBe("complete");
  expect(f.db.table("runtimeModelAttempts")).toEqual([]); expect(f.scheduled.some(s => s.name === "runs:recoverQueue")).toBe(true);
  const before = stored(f), workflow = f.db.table("workflows")[0];
  await f.call(runtime.onInitialWorkflowComplete, { workflowId: workflow._id, context: workflow.args, result: workflow.runResult }); expect(stored(f)).toEqual(before);
});
it("the unchanged legacy callback still rejects an unattached ID under the installed component completion contract", async () => {
  const f = await fixture(), { owned } = await f.start(), workflow = f.db.table("workflows")[0];
  delete owned.workflowId; workflow.onComplete = { fnHandle: "function://runtimeAgent:onWorkflowComplete", context: workflow.args };
  await f.transaction(() => completeHandler(f.ctx as unknown as Parameters<typeof completeHandler>[0], { workflowId: workflow._id as never,
    generationNumber: 0, runResult: { kind: "failed", error: "CONTROLLED_LEGACY_EARLY_FAILURE" } }));
  expect(f.db.table("onCompleteFailures")).toHaveLength(1); expect(owned.workflowId).toBeUndefined(); expect(owned.state).toBe("ready");
});
it.each(["handler", "callback", "attempt", "context", "result", "generation", "document-id", "pending", "execution-state", "attached-id"])("fresh completion refuses forged %s without binding or completion effects", async fault => {
  const f = await fixture(), { owned, args } = await f.start(), workflow = f.db.table("workflows")[0];
  const result = { kind: "failed" as const, error: "CONTROLLED_FAILURE" }, context = clone(args);
  delete owned.workflowId; workflow.runResult = result; for (const e of f.entries) e.step.inProgress = false;
  if (fault === "handler") workflow.workflowHandle = "function://runtimeAgent:executeTurnV3";
  if (fault === "callback") workflow.onComplete = { ...(workflow.onComplete as object), fnHandle: "function://runtimeAgent:onWorkflowComplete" };
  if (fault === "attempt") workflow.args = { ...context, leaseVersion: context.leaseVersion + 1 };
  if (fault === "context") workflow.onComplete = { ...(workflow.onComplete as object), context: { ...context, runId: "foreign" } };
  if (fault === "result") workflow.runResult = { kind: "failed", error: "different" };
  if (fault === "generation") workflow.generationNumber = 1;
  if (fault === "document-id") {
    const get = f.db.get.bind(f.db); jest.spyOn(f.db, "get").mockImplementation(async (table, id) => table === "workflows" ? { ...(await get(table, id))!, _id: "workflows:forged" } : get(table, id));
  }
  if (fault === "pending") f.entries.at(-1)!.step.inProgress = true;
  if (fault === "execution-state") owned.state = "unknown";
  if (fault === "attached-id") owned.workflowId = "workflows:other";
  const before = stored(f);
  await expect(f.call(runtime.onInitialWorkflowComplete, { workflowId: workflow._id, context, result })).rejects.toThrow();
  expect(stored(f)).toEqual(before); expect(f.db.table("runtimeModelAttempts")).toEqual([]);
});
it("a parent journal failure rolls claim/execution/Workflow work back without paid dispatch, then fresh retry starts once", async () => {
  const options = { journalFailure: true }, f = await fixture(options), run = await f.run(), before = stored(f);
  await expect(f.call(runtime.start, { runId: run.runId })).rejects.toThrow("CONTROLLED_INITIAL_JOURNAL_FAILURE");
  expect(stored(f)).toEqual(before); expect(f.db.table("runtimeAgentExecutions")).toEqual([]); expect(f.db.table("runtimeModelAttempts")).toEqual([]);
  options.journalFailure = false; await f.call(runtime.start, { runId: run.runId });
  expect(f.db.table("runtimeAgentExecutions")).toHaveLength(1); expect(f.db.table("workflows")).toHaveLength(1); expect(f.entries).toHaveLength(3);
});
it("prepareModelOperation's fresh scope retains exact original results/non-authority order and clears after operation writes", async () => {
  const f = await fixture(), { args } = await f.start(); await f.call(runtime.prepareRoutedContext, args);
  const reads: string[] = [], get = f.db.get.bind(f.db), query = f.db.query.bind(f.db), auth = (table: string) => table.startsWith("runtimeAuth");
  jest.spyOn(f.db, "get").mockImplementation(async (table, id) => { reads.push(`get:${table}:${id}`); return get(table, id); });
  jest.spyOn(f.db, "query").mockImplementation(table => { reads.push(`query:${table}`); return query(table); });
  const rollback = Error("REFERENCE_ROLLBACK"); let expected: unknown, after: unknown;
  scopeEnabled = false;
  await expect(f.transaction(async () => { expected = await f.call(runtime.prepareModelOperation, { ...args, ordinal: 0 }); after = stored(f); throw rollback; })).rejects.toBe(rollback);
  const originalReads = [...reads], originalAuthority = reads.filter(r => auth(r.split(":")[1])).length; reads.length = 0; scopeEnabled = true;
  expect(await f.call(runtime.prepareModelOperation, { ...args, ordinal: 0 })).toEqual(expected); expect(stored(f)).toEqual(after);
  expect(reads.filter(r => !auth(r.split(":")[1]))).toEqual(originalReads.filter(r => !auth(r.split(":")[1])));
  const scopedAuthority = reads.filter(r => auth(r.split(":")[1])).length; expect(scopedAuthority).toBeLessThan(originalAuthority);
  expect(reads.filter(r => r.startsWith("get:runtimeAuthGrants:"))).toHaveLength(2);
  console.info(JSON.stringify({ type: "preparation-authority-fixture-count", unscoped: originalAuthority, scoped: scopedAuthority }));
  expect(f.db.table("runtimeModelAttempts")).toEqual([]); expect(f.db.table("runtimeAgentOperations")[0].state).toBe("started");
});
it("preparation writer invalidation preserves original late revocation rejection and complete rollback", async () => {
  const f = await fixture(), { args } = await f.start(); await f.call(runtime.prepareRoutedContext, args);
  const before = stored(f), insert = f.db.insert.bind(f.db); let reached = false;
  jest.spyOn(f.db, "insert").mockImplementation(async (table, value) => { const id = await insert(table, value); if (table === "runtimeAgentOperations") { reached = true; f.grant.revokedAt = clock; } return id; });
  await expect(f.call(runtime.prepareModelOperation, { ...args, ordinal: 0 })).rejects.toThrow("FORBIDDEN"); expect(reached).toBe(true); expect(stored(f)).toEqual(before);
});
