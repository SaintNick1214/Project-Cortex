/** Original registered financial/Agent handlers and controlled transactions.
 * Native OCC, installed qualification and cloud latency remain separate gates. */
import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import { getFunctionName } from "convex/server";
import type { MutationCtx } from "../../../convex-dev/_generated/server";
import type { ContextSourceWitness } from "../../../src/domain/context-witness";
import { semanticHash } from "../../../src/domain/profile";
import type { ModelCallRequest } from "../../../src/domain/model-policy";
import type { GatewayAdmissionCheckpoint, GatewayResolution } from "../../../convex-dev/runtimeGateway";
import { canonicalModelJson } from "../../../src/domain/model-policy";
import { assertNativeArgs } from "./native-arguments";

jest.unstable_mockModule("@convex-dev/workflow", () => ({ WorkflowManager: class {
  define(value: { handler: unknown }) { return { _handler: value.handler }; }
  async start() { return "workflow:terminal-scope"; }
} }));
const { transcriptFixture, installMockRoot, ledger, definitions, runs, clone, clock } = await import("../runtimeTranscript/fixture");
const agent = await import("../../../convex-dev/runtimeAgent");
const { createV8AuthorityReadScope } = await import("../../../convex-dev/runtimeAuth");
const { createBackendGatewayComposition, withV8GatewayTerminalPorts } = await import("../../../convex-dev/runtimeGatewayBackend");
beforeEach(() => { installMockRoot(); });
afterEach(() => { jest.restoreAllMocks(); });

type Capture = Awaited<ReturnType<typeof ledger.captureTerminalEvidenceHandler>>;
async function fixture() {
  const f = await transcriptFixture(), oldMutation = f.ctx.runMutation.bind(f.ctx);
  f.ctx.runMutation = (async (ref, args) => {
    let name = ""; try { name = getFunctionName(ref); } catch { return oldMutation(ref, args); }
    const [module, key] = name.split(":");
    const target = module === "runtimeAgent" ? agent[key as keyof typeof agent]
      : module === "runs" ? runs[key as keyof typeof runs]
        : module === "runtimeModelPolicy" ? ledger[key as keyof typeof ledger] : undefined;
    if (!target) return oldMutation(ref, args);
    assertNativeArgs(target, args); return f.call(target, args);
  }) as MutationCtx["runMutation"];
  const published = await f.call<{ agentId: string; version: number }>(definitions.publishVersion, {
    memorySpaceId: "space-a", clientMutationId: "terminal-scope-v8", expectedPreviousVersion: 0,
    definitionInput: { ...f.definitionInput, context: { ...f.definitionInput.context, handlerId: "cortex.transcript.relevant",
      registryHash: await definitions.executableRegistryHashV3(), inputSelection: {
        version: 1, recentMessages: 4, relevantMemories: 4, relevantFacts: 4, pendingEntries: 4, maxMessages: 16 } } },
  });
  const run = await f.call<ReturnType<typeof runs.publicRun>>(runs.submit, {
    request: { ...f.request(), agentId: published.agentId, agentVersion: published.version } });
  await f.call(agent.start, { runId: run.runId });
  const owned = f.db.table("runtimeAgentExecutions")[0]!;
  const attempt = { reference: f.reference, runId: run.runId, attemptNumber: 1, leaseVersion: owned.leaseVersion as number };
  await f.call(agent.saveContext, { ...attempt, context: "Private verified evidence", witnesses: [], completeness: "complete" });
  const prepared = await f.call<{ state: "started"; op: { operationId: string; semanticId: string }; current: { run: { runBudgetId: string } } }>(
    agent.prepareModelOperation, { ...attempt, ordinal: 0 });
  const resolution = await f.call<GatewayResolution>(ledger.resolve, { reference: f.reference,
    operationKey: "agent.respond", runBudgetId: prepared.current.run.runBudgetId });
  const request: ModelCallRequest = { semanticId: prepared.op.semanticId, childCallId: "terminal-actual-admission",
    texts: ["Hello world!"], messages: [{ role: "user", parts: [{ type: "text", text: "Hello world!" }] }], inputTokens: 1,
    outputTokens: 20, toolSteps: 0, timeoutMs: 1000, reservationUnits: resolution.snapshot.costBound.maximumCostUnits,
    promptVersion: resolution.snapshot.pins.promptVersion, schemaVersion: resolution.snapshot.pins.schemaVersion,
    extractionVersion: resolution.snapshot.pins.extractionVersion, toolRegistryVersion: resolution.snapshot.pins.toolRegistryVersion,
    tools: [], options: { maxRetries: 0 } };
  request.inputTokens = ledger.deriveQualifiedInputBound(resolution.dispatchEvidence, request);
  const admitted = await f.call<GatewayAdmissionCheckpoint>(agent.admitModelOperation, { ...attempt, operationId: prepared.op.operationId,
    ordinal: 0, requestCanonical: canonicalModelJson(request), snapshotCanonical: canonicalModelJson(resolution.snapshot) });
  if (admitted.admission.status !== "reserved" || !("permit" in admitted) || !admitted.permit.dispatchPermit) throw Error("Expected original native reservation and checkpoint");
  const captureArgs = { attemptId: admitted.admission.attemptId, dispatchIdentity: admitted.permit.dispatchIdentity,
    receiptCanonical: canonicalModelJson({ version: 1, dispatchIdentity: admitted.permit.dispatchIdentity,
      receiptId: "controlled-terminal", modelId: resolution.snapshot.modelId, nativeInterface: resolution.snapshot.nativeInterface,
      outcome: "confirmed", proof: "provider-terminal-v1", costSource: "gateway-aggregate-usd-v1", aggregateCostUsd: "0.000040",
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } }) };
  const state = () => clone({ rows: new Map([...f.db.rows].filter(([, rows]) => rows.length)), writes: f.db.writes,
    sequence: f.db.sequence, native: f.native, effects: f.effects, scheduled: f.scheduled });
  const restore = (value: ReturnType<typeof state>) => {
    f.db.rows = clone(value.rows); f.db.writes = value.writes; f.db.sequence = value.sequence;
    Object.assign(f.native, clone(value.native)); Object.assign(f.effects, value.effects);
    f.scheduled.splice(0, f.scheduled.length, ...clone(value.scheduled));
  };
  const attachment = (captured: Capture) => ({ reference: f.reference, attemptId: captureArgs.attemptId,
    evidenceId: captured.evidenceId, privateResultCanonical: canonicalModelJson({ text: "Private canonical answer" }) });
  return { ...f, get grant() { return f.grant; }, attempt, captureArgs, attachment, state, restore };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
function instrument(f: Fixture) {
  const query = f.db.query.bind(f.db), get = f.db.get.bind(f.db);
  const reads: { method: string; table: string; id?: string; index?: string; keys?: unknown[]; family?: boolean }[] = [];
  jest.spyOn(f.db, "get").mockImplementation(async (table, id) => { reads.push({ method: "get", table, id }); return get(table, id); });
  jest.spyOn(f.db, "query").mockImplementation(table => {
    const record = { method: "query", table, family: /readManaged(?:SourceRows|ConversationRows|TranscriptBridgeRows|SourceRunRows)/.test(new Error().stack ?? ""), index: undefined as string | undefined, keys: [] as unknown[] };
    reads.push(record); const builder = query(table), withIndex = builder.withIndex.bind(builder);
    builder.withIndex = (index, callback) => { record.index = index; return withIndex(index, q => {
      if (q === null || typeof q !== "object") throw Error("Expected native index query object");
      const traced: object = new Proxy(q, { get(target, key) {
        const value: unknown = Reflect.get(target, key, target); if (typeof value !== "function") return value;
        return (...args: unknown[]) => { record.keys.push([String(key), ...args]);
          const result: unknown = Reflect.apply(value, target, args); return result === target ? traced : result; };
      } }); return callback(traced);
    }); }; return builder;
  });
  const retained = (table: string) => table.startsWith("runtimeAuth") || table === "runtimeModelPolicies" || table === "runtimeModelQualifications";
  return { clear: () => { reads.length = 0; },
    counts: () => ({ total: reads.length, authority: reads.filter(row => row.table.startsWith("runtimeAuth")).length, graph: reads.filter(row => row.family).length }),
    mutableReads: () => clone(reads.filter(row => !retained(row.table) && !row.family)) };
}
async function capture(f: Fixture, v8: boolean) {
  const target = v8 ? ledger.captureTerminalEvidenceV8 : ledger.captureTerminalEvidence;
  assertNativeArgs(target, f.captureArgs); return f.call<Capture>(target, f.captureArgs);
}
async function attach(f: Fixture, value: Capture, v8: boolean) {
  const target = v8 ? ledger.attachTerminalResultV8 : ledger.attachTerminalResult;
  const args = f.attachment(value); assertNativeArgs(target, args); return f.call(target, args);
}
async function differential<T>(f: Fixture, run: (v8: boolean) => Promise<T>) {
  const before = f.state(), observed = instrument(f);
  const original = await run(false), after = f.state(), baseline = observed.counts(), mutable = observed.mutableReads();
  f.restore(before); observed.clear(); const optimized = await run(true);
  expect(optimized).toEqual(original); expect(f.state()).toEqual(after); expect(observed.mutableReads()).toEqual(mutable);
  return { value: optimized, baseline, optimized: observed.counts() };
}

it("new terminal ports are internal, exact-shape and retain two separately committed mutations", async () => {
  const f = await fixture();
  for (const registration of [ledger.captureTerminalEvidenceV8, ledger.attachTerminalResultV8]) {
    expect(registration.isInternal).toBe(true); expect(registration.isMutation).toBe(true); expect(Reflect.get(registration, "isPublic")).not.toBe(true);
  }
  expect(() => assertNativeArgs(ledger.captureTerminalEvidenceV8, { ...f.captureArgs, reference: f.reference })).toThrow();
  const captured = await capture(f, true), attempts = f.db.table("runtimeModelAttempts");
  expect(captured).toMatchObject({ state: "settled", settledCostUnits: 40, overrun: false });
  expect(attempts).toMatchObject([{ state: "settled", slotReleased: true, resultAttachmentState: "pending", resultWithheld: true, outputVisible: false }]);
  expect(attempts[0]!.privateResultCanonical).toBeUndefined();
  const accounts = clone(f.db.table("runtimeBudgetAccounts"));
  expect(await attach(f, captured, true)).toEqual({ attached: true, resultWithheld: false });
  expect(f.db.table("runtimeBudgetAccounts")).toEqual(accounts);
});
it.each(["capture", "attach"])("real %s handler keeps exact effects/mutable read order and reduces raw authority reads", async kind => {
  const f = await fixture(); const captured = kind === "attach" ? await capture(f, false) : undefined;
  const compared = await differential(f, v8 => captured ? attach(f, captured, v8) : capture(f, v8));
  expect(compared.optimized.authority).toBeLessThan(compared.baseline.authority);
  expect(compared.optimized.total).toBeLessThan(compared.baseline.total);
  console.info(JSON.stringify({ type: "controlled-v8-terminal-read-count", kind, original: compared.baseline,
    optimized: compared.optimized, nativePerformanceProof: false }));
});
it.each(["revoked", "expired", "principal-version", "scope-epoch", "tombstone", "cancelled", "lease", "stale-transcript"])(
  "fresh %s before capture cannot suppress incurred charge and closes private attachment identically", async fault => {
    const f = await fixture();
    if (fault === "revoked") f.grant.revokedAt = clock;
    if (fault === "expired") f.grant.expiresAt = clock;
    if (fault === "principal-version") f.db.table("runtimeAuthPrincipals")[0]!.version = 2;
    if (fault === "scope-epoch") f.db.table("runtimeAuthScopes")[0]!.epoch = 2;
    if (fault === "tombstone") f.db.seed("runtimeAuthTombstones", { tenantId: f.reference.tenantId,
      memorySpaceId: f.reference.memorySpaceId, resourceType: "memorySpace", resourceId: f.reference.memorySpaceId, deletedAt: clock });
    if (fault === "cancelled") f.db.table("runtimeModelOperations")[0]!.cancelled = true;
    if (fault === "lease") f.db.table("runtimeRunOutbox")[0]!.leaseExpiresAt = clock;
    if (fault === "stale-transcript") f.native.messages.values().next().value!.message = { role: "user", content: "Canonical source edited after dispatch" };
    const compared = await differential(f, async v8 => {
      const captured = await capture(f, v8); expect(captured).toMatchObject({ state: "settled", settledCostUnits: 40 });
      expect(f.db.table("runtimeModelAttempts")).toMatchObject([{ slotReleased: true, resultAttachmentState: "closed" }]);
      expect(await attach(f, captured, v8)).toEqual({ attached: false, resultWithheld: true }); return captured;
    });
    expect(compared.value.settledCostUnits).toBe(40);
  });
it.each(["revoked", "expired", "policy", "budget", "wrong-principal", "wrong-scope", "malformed-result"])(
  "capture commit survives fresh %s attachment refusal; no financial replay or private resurrection", async fault => {
    const f = await fixture(), captured = await capture(f, true), accounts = clone(f.db.table("runtimeBudgetAccounts"));
    if (fault === "revoked") await f.ctx.db.patch("runtimeAuthGrants", f.grant._id as never, { revokedAt: clock });
    if (fault === "expired") f.grant.expiresAt = clock;
    if (fault === "policy") f.db.table("runtimeModelPolicies")[0]!.active = false;
    if (fault === "budget") f.db.table("runtimeBudgetAccounts").find(row => row.kind === "run")!.cancelled = true;
    const run = async (v8: boolean) => {
      const args = f.attachment(captured);
      if (fault === "wrong-principal") args.reference = { ...args.reference, principalId: "foreign" };
      if (fault === "wrong-scope") args.reference = { ...args.reference, memorySpaceId: "foreign" };
      if (fault === "malformed-result") args.privateResultCanonical = "{}";
      return f.call(v8 ? ledger.attachTerminalResultV8 : ledger.attachTerminalResult, args);
    };
    const compared = await differential(f, run); expect(compared.value).toEqual({ attached: false, resultWithheld: true });
    const currentAccounts = clone(f.db.table("runtimeBudgetAccounts"));
    if (fault === "budget") currentAccounts.find(row => row.kind === "run")!.cancelled = false;
    expect(currentAccounts).toEqual(accounts);
    expect(await capture(f, true)).toEqual(captured);
  });
it("UNKNOWN capture remains conservative, releases the slot once and never creates a retry advantage", async () => {
  const f = await fixture(); const raw = JSON.parse(f.captureArgs.receiptCanonical) as Record<string, unknown>;
  raw.costSource = "unavailable"; delete raw.aggregateCostUsd; f.captureArgs.receiptCanonical = canonicalModelJson(raw);
  const compared = await differential(f, v8 => capture(f, v8)); expect(compared.value).toMatchObject({ state: "uncertain", overrun: false });
  expect(f.db.table("runtimeModelAttempts")).toMatchObject([{ state: "uncertain", slotReleased: true, resultAttachmentState: "closed" }]);
  const accounts = f.db.table("runtimeBudgetAccounts");
  expect(accounts.every(row => row.activeConcurrency === 0 && row.uncertainUnits === 100)).toBe(true);
  const writes = f.db.writes; expect(await capture(f, true)).toEqual(compared.value); expect(f.db.writes).toBe(writes);
  expect(await attach(f, compared.value, true)).toEqual({ attached: false, resultWithheld: true });
});
it.each(["dispatch", "malformed", "model", "proof"])("%s receipt refusal has exact legacy error order and zero partial writes", async fault => {
  const f = await fixture();
  if (fault === "dispatch") f.captureArgs.dispatchIdentity = "wrong";
  if (fault === "malformed") f.captureArgs.receiptCanonical = "{";
  if (fault === "model" || fault === "proof") {
    const raw = JSON.parse(f.captureArgs.receiptCanonical) as Record<string, unknown>;
    raw[fault === "model" ? "modelId" : "proof"] = "changed"; f.captureArgs.receiptCanonical = canonicalModelJson(raw);
  }
  const before = f.state(); let original: unknown;
  try { await capture(f, false); } catch (error) { original = error; }
  expect(original).toBeDefined(); expect(f.state()).toEqual(before);
  await expect(capture(f, true)).rejects.toEqual(original); expect(f.state()).toEqual(before);
});
it.each(["capture", "attach"])("opaque %s failure rolls its own partial writes back without changing earlier accounting", async kind => {
  const f = await fixture(), captured = kind === "attach" ? await capture(f, true) : undefined;
  const before = f.state(), patch = f.db.patch.bind(f.db), error = Symbol("opaque-storage-failure");
  jest.spyOn(f.db, "patch").mockImplementation(async (table: string, id: string | Record<string, unknown>, value?: Record<string, unknown>) => {
    if (typeof id !== "string" || value === undefined) throw Error("Expected native explicit table writer");
    await patch(table, id, value); throw error;
  });
  for (const v8 of [false, true]) {
    const call = captured ? attach(f, captured, v8) : capture(f, v8);
    await expect(call).rejects.toBe(error); expect(f.state()).toEqual(before);
  }
  if (captured) expect(f.db.table("runtimeModelAttempts")).toMatchObject([{ state: "settled", resultAttachmentState: "pending" }]);
});
it("the private nonserialized context selector changes only two terminal ports, preserving default generic calls and native this", async () => {
  const calls: string[] = [], owners: unknown[] = [];
  const ctx = { runQuery: async () => { throw Error("UNEXPECTED_QUERY"); },
    runMutation: async function (this: unknown, ref: Parameters<typeof getFunctionName>[0]) {
      owners.push(this); calls.push(getFunctionName(ref));
      return calls[calls.length - 1]!.includes("capture") ? { evidenceId: "evidence", state: "uncertain", overrun: false }
        : { attached: false, resultWithheld: true };
    } } as unknown as MutationCtx;
  const f = await fixture(), captured = { evidenceId: "evidence", state: "uncertain", overrun: false } as Capture;
  for (const context of [ctx, withV8GatewayTerminalPorts(ctx)]) {
    const composition = createBackendGatewayComposition(context);
    await composition.terminalSink!.capture(f.captureArgs); await composition.ledger.attachTerminalResult(f.attachment(captured));
  }
  expect(calls).toEqual(["runtimeModelPolicy:captureTerminalEvidence", "runtimeModelPolicy:attachTerminalResult",
    "runtimeModelPolicy:captureTerminalEvidenceV8", "runtimeModelPolicy:attachTerminalResultV8"]);
  expect(owners.every(owner => owner === ctx)).toBe(true); expect(JSON.stringify(withV8GatewayTerminalPorts(ctx))).toBe("{}");
});


async function withAncestry(f: Fixture, shared: boolean) {
  const witness = (id: string, hash: string): ContextSourceWitness => ({ sourceId: id, sourceEventId: id, sourceRevision: 1,
    contentHash: hash, permissions: ["canViewMemories", "canViewFacts"] });
  const add = async (id: string, dependencies: ContextSourceWitness[] = []) => {
    const content = `Retained terminal graph ${id}`, contentHash = await semanticHash(content);
    const row = f.db.seed("runtimeMemorySources", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId,
      ownerPrincipalId: f.reference.principalId, lineage: { sourceId: id, sourceEventId: id, sourceRevision: 1, role: "user", trust: "user_assertion" },
      content, contentHash, createdAt: clock, contextSourceWitnesses: dependencies });
    return { row, witness: witness(id, contentHash) };
  };
  const leaves = [];
  for (let index = 0; index < (shared ? 1 : 3); index++) leaves.push(await add(`terminal-leaf-${index}`));
  const roots = [];
  for (let index = 0; index < 3; index++) roots.push(await add(`terminal-root-${index}`, [leaves[shared ? 0 : index]!.witness]));
  const top = await add("terminal-top", roots.map(value => value.witness));
  f.db.table("runtimeAgentExecutions")[0]!.sourceWitnesses = [top.witness];
  return { leaves, top };
}
it.each([true, false])("both independent V8 terminal mutations retain only raw shared=%s graph rows with exact accounting/read order", async shared => {
  for (const kind of ["capture", "attach"]) {
    const f = await fixture(); await withAncestry(f, shared);
    const captured = kind === "attach" ? await capture(f, false) : undefined;
    // Exact K25 V8 scope is the control, so these counts exclude the already
    // accepted generic-to-V8 authority reduction.
    const compared = await differential<unknown>(f, async v8 => {
      if (v8) return captured ? await attach(f, captured, true) : await capture(f, true);
      return await f.transaction<unknown>(async () => {
        if (captured) return await ledger.attachTerminalResultHandler(createV8AuthorityReadScope(f.ctx), f.attachment(captured));
        return await ledger.captureTerminalEvidenceHandler(createV8AuthorityReadScope(f.ctx), f.captureArgs);
      });
    });
    expect(compared.baseline.graph).toBeGreaterThan(0); expect(compared.optimized.graph).toBeLessThan(compared.baseline.graph);
    expect(compared.optimized.total).toBeLessThan(compared.baseline.total);
    if (kind === "capture") expect(compared.value).toMatchObject({ state: "settled", settledCostUnits: 40 });
    else expect(compared.value).toEqual({ attached: true, resultWithheld: false });
    console.info(JSON.stringify({ type: "k26-controlled-terminal-graph-reads", kind, shared,
      original: compared.baseline, optimized: compared.optimized, mutableReadSequenceEqual: true, nativeLatency: "UNAVAILABLE" }));
    jest.restoreAllMocks(); installMockRoot();
  }
});
it.each(["edit", "tombstone", "revoked"])("fresh %s in retained ancestry closes attachment while preserving the incurred capture", async fault => {
  const f = await fixture(), graph = await withAncestry(f, true), captured = await capture(f, true);
  expect(captured).toMatchObject({ state: "settled", settledCostUnits: 40 });
  if (fault === "edit") await f.ctx.db.patch("runtimeMemorySources", graph.leaves[0]!.row._id as never, { contentHash: "f".repeat(64) });
  if (fault === "tombstone") await f.ctx.db.patch("runtimeMemorySources", graph.leaves[0]!.row._id as never, { tombstonedAt: clock });
  if (fault === "revoked") await f.ctx.db.patch("runtimeAuthGrants", f.grant._id as never, { revokedAt: clock });
  const accounts = clone(f.db.table("runtimeBudgetAccounts"));
  const compared = await differential(f, v8 => attach(f, captured, v8));
  expect(compared.value).toEqual({ attached: false, resultWithheld: true }); expect(f.db.table("runtimeBudgetAccounts")).toEqual(accounts);
  expect(f.db.table("runtimeModelAttempts")).toMatchObject([{ state: "settled", slotReleased: true, resultAttachmentState: "closed" }]);
  expect(await capture(f, true)).toEqual(captured);
});
