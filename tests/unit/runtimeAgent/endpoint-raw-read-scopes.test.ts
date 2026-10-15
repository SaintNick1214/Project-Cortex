/** Actual registered handlers on controlled transactional ports; no native latency/OCC claim. */
import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import { getFunctionAddress, getFunctionName } from "convex/server";
import type { ApiFromModules, FunctionReturnType } from "convex/server";
import type { MutationCtx } from "../../../convex-dev/_generated/server";
import type { GatewayAdmissionCheckpoint } from "../../../convex-dev/runtimeGateway";
import type { ModelCallRequest } from "../../../src/domain/model-policy";
import { canonicalModelJson } from "../../../src/domain/model-policy";
import { assertNativeArgs } from "./native-arguments";

const actualAuth = await import("../../../convex-dev/runtimeAuth");
let enabled = true;
let managedGraph = true;
const contexts: Parameters<typeof actualAuth.createAuthorityReadScope>[0][] = [];
jest.unstable_mockModule("../../../convex-dev/runtimeAuth", () => ({ ...actualAuth,
  createAuthorityReadScope: <Ctx extends Parameters<typeof actualAuth.createAuthorityReadScope>[0]>(ctx: Ctx, options?: Parameters<typeof actualAuth.createAuthorityReadScope>[1]) => {
    const scoped = enabled ? actualAuth.createAuthorityReadScope(ctx, options) : ctx;
    contexts.push(scoped); return scoped;
  },
  createMemorySourceReadScope: <Ctx extends Parameters<typeof actualAuth.createMemorySourceReadScope>[0]>(ctx: Ctx) => {
    const scoped = enabled ? managedGraph ? actualAuth.createMemorySourceReadScope(ctx)
      : actualAuth.createAuthorityReadScope(ctx, { nativeTranscript: true, policyMetadata: true }) : ctx;
    contexts.push(scoped); return scoped;
  },
}));
jest.unstable_mockModule("@convex-dev/workflow", () => ({ WorkflowManager: class {
  define(input: { handler: unknown }) { return { _handler: input.handler }; }
  async start() { return "workflow:turn"; }
} }));
const { ingestionFixture, installIngestionMockRoot, invoke } = await import("../runtimeIngestion/fixture");
const { clone, clock, ledger } = await import("../runtimeTranscript/fixture");
const runtime = await import("../../../convex-dev/runtimeAgent");
const runs = await import("../../../convex-dev/runs");
const memory = await import("../../../convex-dev/runtimeMemory");
const transcript = await import("../../../convex-dev/runtimeTranscript");
beforeEach(() => { enabled = true; managedGraph = true; contexts.length = 0; installIngestionMockRoot(); });
afterEach(() => { jest.restoreAllMocks(); });

async function fixture() {
  const f = await ingestionFixture(), query = f.ctx.runQuery.bind(f.ctx), mutation = f.ctx.runMutation.bind(f.ctx);
  f.ctx.runQuery = (async (ref, input) => {
    let name = ""; try { name = getFunctionName(ref); } catch { return query(ref, input); }
    const registration = name.startsWith("runtimeAgent:") ? runtime[name.split(":")[1] as keyof typeof runtime]
      : name.startsWith("runtimeMemory:") ? memory[name.split(":")[1] as keyof typeof memory] : undefined;
    if (registration) { assertNativeArgs(registration, input); return invoke(registration, f.ctx, input); }
    return query(ref, input);
  }) as MutationCtx["runQuery"];
  f.ctx.runMutation = (async (ref, input) => {
    let name = ""; try { name = getFunctionName(ref); } catch { return mutation(ref, input); }
    const registration = name.startsWith("runtimeAgent:") ? runtime[name.split(":")[1] as keyof typeof runtime]
      : name === "runs:claimNext" ? runs.claimNext : undefined;
    if (registration) { assertNativeArgs(registration, input); return f.call(registration, input); }
    return mutation(ref, input);
  }) as MutationCtx["runMutation"];
  const run = await f.call<ReturnType<typeof runs.publicRun>>(runs.submit, { request: f.request() });
  await f.call(runtime.start, { runId: run.runId });
  const execution = f.db.table("runtimeAgentExecutions")[0];
  const args = { reference: f.reference, runId: run.runId, attemptNumber: 1, leaseVersion: execution.leaseVersion as number };
  await f.call(runtime.startContext, args);
  const source = await f.source("Current source witness", "source-witness");
  await f.call(runtime.saveContext, { ...args, context: "", witnesses: [{ sourceId: source.lineage.sourceId,
    sourceEventId: source.lineage.sourceEventId, sourceRevision: source.lineage.sourceRevision,
    contentHash: source.contentHash, permissions: ["canViewMemories"] }], completeness: "complete" });
  return { ...f, get grant() { return f.grant; }, args };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
type RuntimeApi = ApiFromModules<{ runtimeAgent: typeof runtime }> ["runtimeAgent"];
type Prepared = Extract<FunctionReturnType<RuntimeApi["prepareResolvedModelOperation"]>, { state: "started" }>;
async function admitted(f: Fixture) {
  const prepared = await f.call<Prepared>(runtime.prepareResolvedModelOperation, { ...f.args, ordinal: 0 });
  const resolution = prepared.governedResolution, pins = resolution.snapshot.pins;
  const request: ModelCallRequest = { semanticId: prepared.op.semanticId, childCallId: "controlled-child", texts: ["Hello world!"],
    messages: [{ role: "user", parts: [{ type: "text", text: "Hello world!" }] }], inputTokens: 1, outputTokens: 20,
    toolSteps: 0, timeoutMs: 1000, reservationUnits: resolution.snapshot.costBound.maximumCostUnits,
    promptVersion: pins.promptVersion, schemaVersion: pins.schemaVersion, extractionVersion: pins.extractionVersion,
    toolRegistryVersion: pins.toolRegistryVersion, tools: [], options: { maxRetries: 0 } };
  request.inputTokens = ledger.deriveQualifiedInputBound(resolution.dispatchEvidence, request);
  const result = await f.call<GatewayAdmissionCheckpoint>(runtime.admitPreparedModelOperation, { ...f.args,
    operationId: prepared.op.operationId, ordinal: 0, requestCanonical: canonicalModelJson(request), snapshotCanonical: canonicalModelJson(resolution.snapshot),
    bindingCanonical: canonicalModelJson({ reference: f.reference, operationKey: "agent.respond", runBudgetId: prepared.current.run.runBudgetId, semanticId: prepared.op.semanticId, ordinal: 0 }) });
  if (result.admission.status !== "reserved") throw Error("Expected a newly reserved controlled attempt");
  if (!("permit" in result)) throw Error("Expected the controlled atomic checkpoint permit");
  expect(result.permit).toMatchObject({ dispatchPermit: true });
  return { reference: f.reference, attemptId: result.admission.attemptId, outputVisible: true,
    toolInputVisible: false, toolResultVisible: false, toolEffectCommitted: false };
}
type Entry = "hydrateExecution" | "recordOutput" | "markVisible";
async function entry(f: Fixture, name: Entry) {
  if (name === "markVisible") return { registration: ledger.markVisible, args: await admitted(f) };
  return { registration: runtime[name], args: name === "recordOutput"
    ? { ...f.args, parts: [{ type: "text-delta", text: "controlled", id: "text", providerMetadata: { private: "omit" } }] } : f.args };
}
function state(f: Fixture) { return clone({ rows: f.db.rows, sequence: f.db.sequence, writes: f.db.writes, native: f.native, effects: f.effects, scheduled: f.scheduled }); }
const authTables = new Set(["runtimeAuthPrincipals", "runtimeAuthMemberships", "runtimeAuthGrants", "runtimeAuthScopes", "runtimeAuthTombstones"]);
const managedTables = new Set(["runtimeMemorySources", "runtimeConversations", "runtimeTranscriptMessages", "runtimeRuns"]);
function trace(f: Fixture) {
  const events: { method: string; table?: string; reference?: string; args?: unknown }[] = [];
  const query = f.db.query.bind(f.db), get = f.db.get.bind(f.db);
  jest.spyOn(f.db, "query").mockImplementation(table => { events.push({ method: "query", table }); return query(table); });
  jest.spyOn(f.db, "get").mockImplementation(async (table, key) => { events.push({ method: "get", table, args: key }); return get(table, key); });
  const patch = f.db.patch.bind(f.db);
  jest.spyOn(f.db, "patch").mockImplementation(async (tableOrId: string, idOrPatch: string | Record<string, unknown>, value?: Record<string, unknown>) => {
    events.push({ method: "patch", table: typeof idOrPatch === "string" ? tableOrId : tableOrId.split(":")[0], args: clone([tableOrId, idOrPatch, value]) });
    if (typeof idOrPatch === "string") await patch(tableOrId, idOrPatch, value!); else await patch(tableOrId, idOrPatch);
  });
  const insert = f.db.insert.bind(f.db);
  jest.spyOn(f.db, "insert").mockImplementation(async (table, value) => { events.push({ method: "insert", table, args: clone(value) }); return insert(table, value); });
  const raw = f.ctx.runQuery.bind(f.ctx) as (...args: Parameters<MutationCtx["runQuery"]>) => ReturnType<MutationCtx["runQuery"]>;
  jest.spyOn(f.ctx, "runQuery").mockImplementation(async (...args: Parameters<MutationCtx["runQuery"]>) => {
    events.push({ method: "runQuery", reference: JSON.stringify(getFunctionAddress(args[0])), args: clone(args[1]) }); return raw(...args);
  });
  const native = (event: typeof events[number]) => event.reference?.endsWith('/messages/getMessagesByIds"}') === true;
  const counts = () => ({ authority: events.filter(e => e.table && authTables.has(e.table) && ["query", "get"].includes(e.method)).length,
    transcript: events.filter(native).length,
    policyMetadata: events.filter(e => e.method === "query" && ["runtimeModelQualifications", "runtimeModelPolicies"].includes(e.table ?? "")).length,
    managedGraph: events.filter(e => e.method === "query" && managedTables.has(e.table ?? "")).length });
  const nonRaw = () => events.filter(e => !native(e) && !(e.table && (authTables.has(e.table)
    || e.method === "query" && (["runtimeModelQualifications", "runtimeModelPolicies", "runtimeAgentDefinitions"].includes(e.table) || managedTables.has(e.table)))));
  return { events, counts, nonRaw };
}
async function rejection(f: Fixture, registration: unknown, args: unknown) {
  try { await f.call(registration, args); throw Error("EXPECTED_FAILURE"); }
  catch (error) { if (!(error instanceof Error) || error.message === "EXPECTED_FAILURE") throw error;
    return { name: error.name, message: error.message, data: "data" in error ? error.data : undefined }; }
}
it.each(["hydrateExecution", "recordOutput", "markVisible"] as const)("%s preserves real result/state/non-raw read and writer order with fewer duplicate raw reads", async name => {
  const f = await fixture(), { registration, args } = await entry(f, name), observed = trace(f), before = state(f), stop = Error("REFERENCE_ROLLBACK"); let expected: unknown, expectedState: unknown;
  enabled = false;
  await expect(f.transaction(async () => { expected = await invoke(registration, f.ctx, args); expectedState = state(f); throw stop; })).rejects.toBe(stop);
  expect(state(f)).toEqual(before); const reference = observed.counts(), order = clone(observed.nonRaw()); observed.events.length = 0; enabled = true;
  assertNativeArgs(registration, args); expect(await f.call(registration, args)).toEqual(expected); expect(state(f)).toEqual(expectedState); expect(observed.nonRaw()).toEqual(order);
  const scoped = observed.counts(); expect(scoped.authority).toBeLessThan(reference.authority); expect(scoped.transcript).toBeLessThan(reference.transcript);
  console.info(JSON.stringify({ type: "endpoint-raw-read-count", name, reference, scoped }));
});
it("visibility's same-native source rows reduce duplicate graph reads versus its previous raw scope", async () => {
  const f = await fixture(), { registration, args } = await entry(f, "markVisible"), observed = trace(f), before = state(f);
  const stop = Error("PREVIOUS_VISIBILITY_SCOPE_ROLLBACK"); let expected: unknown, expectedState: unknown;
  managedGraph = false;
  await expect(f.transaction(async () => { expected = await invoke(registration, f.ctx, args); expectedState = state(f); throw stop; })).rejects.toBe(stop);
  const previous = observed.counts(), previousEvents = clone(observed.events); expect(state(f)).toEqual(before);
  observed.events.length = 0; managedGraph = true;
  expect(await f.call(registration, args)).toEqual(expected); expect(state(f)).toEqual(expectedState);
  const current = observed.counts(); expect(current.managedGraph).toBeLessThan(previous.managedGraph);
  const rawIdentity = (event: typeof observed.events[number]) => canonicalModelJson(event);
  expect(new Set(observed.events.map(rawIdentity))).toEqual(new Set(previousEvents.map(rawIdentity)));
  console.info(JSON.stringify({ type: "visibility-managed-source-raw-reads", previous, current, nativeLatency: "NOT_RUN" }));
});
it.each(["hydrateExecution", "recordOutput", "markVisible"] as const)("%s starts a detached fresh scope on every invocation", async name => {
  const f = await fixture(), { registration, args } = await entry(f, name), original = await f.call<Record<string, unknown>>(registration, args);
  if (name === "hydrateExecution") { (original.messages as unknown[]).splice(0); expect((await f.call<{ messages: unknown[] }>(registration, args)).messages).toHaveLength(1); }
  f.grant.revokedAt = clock; const before = state(f); enabled = false; const expected = await rejection(f, registration, args); enabled = true;
  expect(await rejection(f, registration, args)).toEqual(expected); expect(state(f)).toEqual(before); expect(expected.message).toContain("FORBIDDEN");
});
it.each(["grant", "principal", "epoch", "conversation", "source", "source-owner", "source-tombstone", "transcript", "lease", "cancel", "definition"] as const)("fresh %s denial matches the original hydration/output/visibility handlers and rolls back", async fault => {
  for (const name of ["hydrateExecution", "recordOutput", "markVisible"] as const) {
    const f = await fixture(), { registration, args } = await entry(f, name);
    if (fault === "grant") f.grant.revokedAt = clock;
    if (fault === "principal") f.db.table("runtimeAuthPrincipals")[0].deletedAt = clock;
    if (fault === "epoch") f.db.table("runtimeAuthScopes")[0].epoch = 2;
    if (fault === "conversation") f.db.table("runtimeConversations")[0].tombstonedAt = clock;
    if (fault === "source") f.db.table("runtimeMemorySources").find(row => (row.lineage as { sourceId: string }).sourceId === "source-witness")!.contentHash = "changed";
    if (fault === "source-owner") f.db.table("runtimeMemorySources").find(row => (row.lineage as { sourceId: string }).sourceId === "source-witness")!.ownerPrincipalId = "foreign";
    if (fault === "source-tombstone") f.db.seed("runtimeAuthTombstones", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId, resourceType: "source", resourceId: "source-witness", deletedAt: clock });
    if (fault === "transcript") f.native.messages.values().next().value!.message = { role: "user", content: "edited" };
    if (fault === "lease") f.db.table("runtimeRunOutbox")[0].leaseExpiresAt = clock;
    if (fault === "cancel") f.db.table("runtimeRuns")[0].cancellationRequestedAt = clock;
    if (fault === "definition") f.db.table("runtimeAgentDefinitions")[0].revokedAt = clock;
    const before = state(f); enabled = false; const expected = await rejection(f, registration, args); enabled = true;
    expect(await rejection(f, registration, args)).toEqual(expected); expect(state(f)).toEqual(before);
  }
});
it.each(["qualification", "control", "account", "duplicate"] as const)("visibility preserves current %s denial even when every monotone flag is unchanged", async fault => {
  const f = await fixture(), { registration, args } = await entry(f, "markVisible"); await f.call(registration, args);
  if (fault === "qualification") f.db.table("runtimeModelQualifications")[0].revokedAt = clock;
  if (fault === "control") f.db.table("runtimeModelPolicies")[0].revokedAt = clock;
  if (fault === "account") f.db.table("runtimeBudgetAccounts").find(row => row.kind === "run")!.cancelled = true;
  if (fault === "duplicate") f.db.seed("runtimeAuthGrants", { ...f.grant, _id: "runtimeAuthGrants:duplicate" });
  const before = state(f); enabled = false; const expected = await rejection(f, registration, args); enabled = true;
  expect(await rejection(f, registration, args)).toEqual(expected); expect(state(f)).toEqual(before);
});
it.each(["hydrateExecution", "recordOutput", "markVisible"] as const)("%s rereads its second private pass after an interleaved actual component writer", async name => {
  const f = await fixture(), { registration, args } = await entry(f, name), query = f.db.query.bind(f.db); let blocked = false, enter!: () => void, release!: () => void;
  const entered = new Promise<void>(resolve => { enter = resolve; }), gate = new Promise<void>(resolve => { release = resolve; });
  jest.spyOn(f.db, "query").mockImplementation(table => { const builder = query(table), take = builder.take;
    builder.take = async cap => { const result = await take(cap); if (table === "runtimeTranscriptMessages" && !blocked) { blocked = true; enter(); await gate; } return result; }; return builder; });
  contexts.length = 0; const before = state(f), pending = f.call(registration, args); void pending.catch(() => {}); await entered;
  const ctx = contexts[0]; expect(ctx).toBeDefined();
  const writer = Reflect.get(ctx, "runMutation") as MutationCtx["runMutation"]; expect(writer).toBeInstanceOf(Function);
  await writer(transcript.agentComponent.messages.updateMessage,
    { messageId: [...f.native.messages.keys()][0], patch: { message: { role: "user", content: "interleaved component edit" } } });
  release(); await expect(pending).rejects.toThrow("STALE_TRANSCRIPT"); expect(state(f)).toEqual(before);
});
it("visibility's unchanged monotone update does no writes only after the original complete current guards", async () => {
  const f = await fixture(), { registration, args } = await entry(f, "markVisible"); await f.call(registration, args); const before = state(f);
  expect(await f.call(registration, args)).toEqual({ recorded: true }); expect(state(f)).toEqual(before);
  f.db.table("runtimeModelAttempts")[0].state = "settled"; enabled = false; const expected = await rejection(f, registration, args); enabled = true;
  expect(await rejection(f, registration, args)).toEqual(expected); expect(expected.message).toContain("POLICY_DENIED");
});
it("finalDelivery keeps its existing independent fresh scope and denies a later revoked actor", async () => {
  const f = await fixture(); contexts.length = 0;
  const args = { reference: f.reference, bindings: { sources: [], facts: [], vectors: [] } };
  expect(await f.call(memory.finalDelivery, args)).toEqual({ version: 1 });
  // This pre-existing endpoint already uses createMemorySourceReadScope; the
  // expanded mock now records that factory as well as authority-only scopes.
  expect(contexts).toHaveLength(1); const previous = contexts[0]; f.grant.revokedAt = clock;
  const before = state(f); await expect(f.call(memory.finalDelivery, args)).rejects.toThrow("FORBIDDEN");
  expect(contexts).toHaveLength(2); expect(contexts[1]).not.toBe(previous); expect(state(f)).toEqual(before);
});
