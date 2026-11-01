/** Real routing/context/policy bodies on controlled transactional ports. Not native timing/OCC proof. */
import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import { getFunctionName } from "convex/server";
import type { MutationCtx } from "../../../convex-dev/_generated/server";
import { assertNativeArgs } from "./native-arguments";
const actualAuth = await import("../../../convex-dev/runtimeAuth");
let metadata = true;
jest.unstable_mockModule("../../../convex-dev/runtimeAuth", () => ({ ...actualAuth,
  createAuthorityReadScope: <Ctx extends Parameters<typeof actualAuth.createAuthorityReadScope>[0]>(ctx: Ctx, options?: { policyMetadata: true }) =>
    actualAuth.createAuthorityReadScope(ctx, metadata ? options : undefined),
}));
jest.unstable_mockModule("@convex-dev/workflow", () => ({ WorkflowManager: class {
  define(input: { handler: unknown }) { return { _handler: input.handler }; } async start() { return "workflow:policy-reads"; }
} }));
const { ingestionFixture, ingestion, installIngestionMockRoot, invoke } = await import("../runtimeIngestion/fixture");
const { clone, clock } = await import("../runtimeTranscript/fixture");
const runtime = await import("../../../convex-dev/runtimeAgent");
const runs = await import("../../../convex-dev/runs");
const memory = await import("../../../convex-dev/runtimeMemory");
const definitions = await import("../../../convex-dev/agentDefinitions");
beforeEach(() => { installIngestionMockRoot(); metadata = true; }); afterEach(() => { jest.restoreAllMocks(); });
async function fixture() {
  const f = await ingestionFixture(), query = f.ctx.runQuery.bind(f.ctx), mutation = f.ctx.runMutation.bind(f.ctx), calls: string[] = [];
  f.ctx.runQuery = (async (ref, args) => {
    let name = ""; try { name = getFunctionName(ref); } catch { return query(ref, args); } calls.push(name);
    if (name.startsWith("runtimeAgent:")) { const reg = runtime[name.split(":")[1] as keyof typeof runtime]; assertNativeArgs(reg, args); return invoke(reg, f.ctx, args); }
    if (name.startsWith("runtimeMemory:")) return invoke(memory[name.split(":")[1] as keyof typeof memory], f.ctx, args);
    return query(ref, args);
  }) as MutationCtx["runQuery"];
  f.ctx.runMutation = (async (ref, args) => {
    let name = ""; try { name = getFunctionName(ref); } catch { return mutation(ref, args); } calls.push(name);
    if (name.startsWith("runtimeAgent:")) { const reg = runtime[name.split(":")[1] as keyof typeof runtime]; assertNativeArgs(reg, args); return f.call(reg, args); }
    if (name === "runs:claimNext") return f.call(runs.claimNext, args); return mutation(ref, args);
  }) as MutationCtx["runMutation"];
  async function start() {
    const run = await f.call<ReturnType<typeof runs.publicRun>>(runs.submit, { request: f.request() }); await f.call(runtime.start, { runId: run.runId });
    const owned = f.db.table("runtimeAgentExecutions")[0], args = { reference: f.reference, runId: run.runId, attemptNumber: 1, leaseVersion: owned.leaseVersion as number };
    await f.call(runtime.startContext, args); return args;
  }
  return { ...f, get grant() { return f.grant; }, calls, start };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
function state(f: Fixture) { return clone({ rows: f.db.rows, writes: f.db.writes, native: f.native, effects: f.effects, scheduled: f.scheduled }); }
function observe(f: Fixture, afterProbe?: () => void) {
  const query = f.db.query.bind(f.db), get = f.db.get.bind(f.db), writes = f.db.patch.bind(f.db), records: string[] = [], counts = { policy: 0, qualification: 0, total: 0 }; let probes = 0;
  jest.spyOn(f.db, "get").mockImplementation(async (table, id) => { const row = await get(table, id); counts.total += row ? 1 : 0; records.push(`get:${table}:${id}`); return row; });
  jest.spyOn(f.db, "query").mockImplementation(table => {
    const b = query(table), take = b.take, first = b.first, unique = b.unique;
    b.take = async n => { const rows = await take(n); counts.total += rows.length;
      if (table === "runtimeModelPolicies") counts.policy += rows.length; if (table === "runtimeModelQualifications") counts.qualification += rows.length;
      records.push(`take:${table}:${n}`);
      if (table === "runtimeIngestionEvents" && n === 1025 && ++probes === 2) afterProbe?.(); return rows; };
    b.first = async () => { const row = await first(); counts.total += row ? 1 : 0; records.push(`first:${table}`); return row; };
    b.unique = async () => { const row = await unique(); counts.total += row ? 1 : 0; records.push(`unique:${table}`); return row; }; return b;
  });
  jest.spyOn(f.db, "patch").mockImplementation(async (tableOrId: string, idOrValue: string | Record<string, unknown>, value?: Record<string, unknown>) => {
    records.push(`patch:${tableOrId}`); if (typeof idOrValue === "string") await writes(tableOrId, idOrValue, value!); else await writes(tableOrId, idOrValue);
  });
  return { records, counts, restore: () => { jest.spyOn(f.db, "get").mockRestore(); jest.spyOn(f.db, "query").mockRestore(); jest.spyOn(f.db, "patch").mockRestore(); } };
}
const withoutMetadata = (records: string[]) => records.filter(value => !value.includes("runtimeModelPolicies") && !value.includes("runtimeModelQualifications"));
it.each(["empty", "represented", "warning"])("%s preserves actual result/state/non-metadata order while reducing exact raw rows", async mode => {
  const f = await fixture(), args = await f.start();
  if (mode === "represented") { const event = f.db.table("runtimeIngestionEvents").at(-1)!; event.factsState = event.vectorsState = "complete"; }
  if (mode === "warning") Object.assign(f.db.table("runtimeAgentExecutions")[0], { contextCompleteness: "incomplete", contextFailureCode: "MEMORY_STAGE_FAILED" });
  const before = state(f), observed = observe(f), stop = Error("REFERENCE_ROLLBACK"); let original: unknown, result: unknown;
  metadata = false;
  await expect(f.transaction(async () => { result = await invoke(runtime.prepareRoutedContext, f.ctx, args); original = state(f); throw stop; })).rejects.toBe(stop);
  expect(state(f)).toEqual(before); const counts = { ...observed.counts }, records = [...observed.records]; observed.records.length = 0; Object.assign(observed.counts, { policy: 0, qualification: 0, total: 0 }); f.calls.length = 0;
  metadata = true; expect(await f.call(runtime.prepareRoutedContext, args)).toEqual(result); expect(state(f)).toEqual(original);
  expect(withoutMetadata(observed.records)).toEqual(withoutMetadata(records));
  expect(counts.policy + counts.qualification - observed.counts.policy - observed.counts.qualification).toBe(45);
  expect(counts.total - observed.counts.total).toBe(45); expect(observed.counts).toMatchObject({ policy: 32, qualification: 20 });
  expect(f.calls.filter(name => name === "runtimeModelPolicy:embeddingProfile")).toHaveLength(2);
  expect(f.db.table("runtimeModelOperations")).toEqual([]); expect(f.db.table("runtimeModelAttempts")).toEqual([]);
});
it("positive routing does no full profile/probe work; standalone empty and child profile query stay unopted", async () => {
  const f = await fixture(), source = await f.source("Authorized prior", "prior"); await ingestion.enqueueSourceEvent(f.ctx, f.reference, source); const args = await f.start(), before = state(f);
  const observed = observe(f); expect(await f.call(runtime.prepareRoutedContext, args)).toEqual({ state: "NEEDS_ACTION" }); expect(state(f)).toEqual(before);
  expect(observed.counts.qualification).toBe(0); expect(observed.records.filter(value => value === "take:runtimeIngestionEvents:1025")).toHaveLength(1);
  expect(observed.records.some(value => value.includes("runtimeMemoryVectorGenerations"))).toBe(false);
  observed.restore(); const separate = await fixture(), attempt = await separate.start(), separateReads = observe(separate);
  expect(await separate.call(runtime.prepareEmptyContext, attempt)).toEqual({ state: "COMPLETE" });
  expect(separateReads.counts).toMatchObject({ policy: 68, qualification: 25 });
});
async function denial(f: Fixture, args: Awaited<ReturnType<Fixture["start"]>>, fault: string, enabled: boolean) {
  metadata = enabled; const before = state(f); let reached = false;
  const observer = observe(f, () => {
    reached = true; const policies = f.db.table("runtimeModelPolicies"), qualifications = f.db.table("runtimeModelQualifications");
    if (fault === "qualification-revoked") qualifications[0].revokedAt = Date.now();
    if (fault === "qualification-duplicate") f.db.seed("runtimeModelQualifications", { ...qualifications[0], _id: "runtimeModelQualifications:duplicate" });
    if (fault === "qualification-expired") jest.mocked(Date.now).mockReturnValue(clock + 600_000);
    if (fault === "root-canonical") (policies[0].root as Record<string, unknown>).hash = "b".repeat(64);
    if (fault === "policy-revoked") policies[0].revokedAt = Date.now();
    if (fault === "policy-duplicate") f.db.seed("runtimeModelPolicies", { ...policies[0], _id: "runtimeModelPolicies:duplicate" });
    if (fault === "revocation") f.grant.revokedAt = Date.now();
    if (fault === "lease") f.db.table("runtimeRunOutbox")[0].leaseVersion = args.leaseVersion + 1;
    if (fault === "memory-appeared") f.db.seed("runtimeIngestionEvents", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId, ownerPrincipalId: f.reference.principalId, sequence: 1, eligibility: "eligible", lineage: { sourceId: "appeared", sourceEventId: "appeared", sourceRevision: 1 } });
    if (fault === "input-edit") f.native.messages.values().next().value!.message = { role: "user", content: "edited" };
  });
  let error: unknown;
  try { await f.call(runtime.prepareRoutedContext, args); } catch (value) { error = value; }
  expect(reached).toBe(true); expect(error).toBeInstanceOf(Error); expect(state(f)).toEqual(before); expect(f.db.table("runtimeAgentExecutions")[0].contextCanonical).toBeUndefined();
  expect(observer.records.some(value => value.startsWith("patch:"))).toBe(false); observer.restore(); jest.mocked(Date.now).mockReturnValue(clock);
  return error instanceof Error ? { name: error.name, message: error.message, data: "data" in error ? error.data : undefined } : error;
}
it.each(["qualification-revoked", "qualification-duplicate", "qualification-expired", "root-canonical", "policy-revoked", "policy-duplicate", "revocation", "lease", "memory-appeared", "input-edit"])("fresh save fence preserves original after-probe %s denial and transaction rollback", async fault => {
  const f = await fixture(), args = await f.start(); const original = await denial(f, args, fault, false); expect(await denial(f, args, fault, true)).toEqual(original);
});
it("cached raw policy rows still execute current-definition/root validation each time", async () => {
  const f = await fixture(), ctx = actualAuth.createAuthorityReadScope(f.ctx, { policyMetadata: true });
  const read = () => definitions.readCurrentExecutableDefinition(ctx, f.reference, { agentId: f.published.agentId, version: f.published.version }, { capability: "run" });
  expect(await read()).toMatchObject({ definitionHash: f.published.definitionHash });
  await expect(definitions.readCurrentExecutableDefinition(ctx, f.reference, { agentId: f.published.agentId, version: f.published.version + 1 }, { capability: "run" })).rejects.toThrow();
  f.db.table("runtimeModelPolicies")[0].revokedAt = Date.now(); actualAuth.freshPolicyMetadataReads(ctx);
  await expect(read()).rejects.toMatchObject({ data: { code: "CAPABILITY_UNAVAILABLE" } });
});
