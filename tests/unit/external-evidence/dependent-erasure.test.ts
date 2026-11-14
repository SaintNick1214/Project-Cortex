/** Actual managed handlers; database, Workflow journal, storage and model ports are controlled. */
import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import { getFunctionName } from "convex/server";
import { saveMessages } from "@convex-dev/agent";
import type { MutationCtx } from "../../../convex-dev/_generated/server";
import { canonicalModelJson } from "../../../src/domain/model-policy";
jest.unstable_mockModule("@convex-dev/workflow", () => ({ WorkflowManager: class {
  define(value: { handler: unknown }) { return { _handler: value.handler }; }
  async start() { return "workflow:dependent-erasure"; }
  async cancel() {}
} }));
const { dependencyFixture, generated } = await import("./agent-dependency-fixture");
const { installIngestionMockRoot } = await import("../runtimeIngestion/fixture");
const { installMockRoot } = await import("../runtimeTranscript/fixture");
const agent = await import("../../../convex-dev/runtimeAgent");
const erasure = await import("../../../convex-dev/runtimeExternalErasure");
const dependencies = await import("../../../convex-dev/runtimeSourceDependencies");
const ledger = await import("../../../convex-dev/runtimeModelPolicy");
const transcript = await import("../../../convex-dev/runtimeTranscript");
beforeEach(() => installIngestionMockRoot()); afterEach(() => { jest.restoreAllMocks(); });
type Fixture = Awaited<ReturnType<typeof dependencyFixture>>;
function journalPort(f: Fixture) {
  const mutation = f.ctx.runMutation.bind(f.ctx), query = f.ctx.runQuery.bind(f.ctx);
  let remaining = 0, cleanups = 0, barriers = 0;
  f.ctx.runMutation = (async (ref, args) => {
    const path = (ref as Partial<Record<symbol, string>>)[Symbol.for("toReferencePath")];
    if (path?.includes("workflow") && path.includes("cleanup")) { expect(remaining).toBeLessThanOrEqual(0); cleanups++; return true; }
    return mutation(ref, args);
  }) as MutationCtx["runMutation"];
  f.ctx.runQuery = (async (ref, args) => {
    const path = (ref as Partial<Record<symbol, string>>)[Symbol.for("toReferencePath")];
    if (path?.includes("workflow") && path.includes("listSteps")) { barriers++; const waiting = remaining-- > 0; return { page: waiting ? [{ kind: "function", workId: "issued:private-work", name: "private step pending terminal work/payload deletion" }] : [], isDone: true, continueCursor: "" }; }
    return query(ref, args);
  }) as MutationCtx["runQuery"];
  return { waitForBatches: (count: number) => { remaining = count; }, cleanups: () => cleanups, barriers: () => barriers };
}
async function purge(f: Fixture, scope: { tenantId: string; memorySpaceId: string; sourceId: string }) {
  let complete = false, calls = 0;
  while (!complete && calls++ < 600) complete = (await f.call<{ complete: boolean }>(erasure.continueSource, scope)).complete;
  expect(complete).toBe(true); return calls;
}
it.each([false, true])("%s V8 saved contexts and entries physically disappear; resumable journal cleanup waits for actual emptiness", async v8 => {
  const f = await dependencyFixture({ v8 }), root = await f.external(), journal = journalPort(f), { attempt, owned } = await f.start();
  // Retained workflows from earlier managed execution modes are valid upgrade
  // rows even when today's start path uses direct scheduling.
  await f.ctx.db.patch("runtimeAgentExecutions", owned._id as never, { workflowId: "workflow:retained-upgrade" });
  await f.call(v8 ? agent.saveContextV8 : agent.saveContext, { ...attempt, context: root.source.content, witnesses: [root.witness], completeness: "complete",
    ...(v8 ? { entries: [{ key: "raw-memory", kind: "memory", text: root.source.content, relevance: 1 }] } : {}) });
  let native: { admission: { attemptId: string }; permit: { dispatchIdentity: string }; snapshot: import("../../../src/domain/model-policy").ModelPolicySnapshotV1 } | undefined;
  if (v8) {
    const candidate = await f.call<Awaited<ReturnType<typeof agent.prepareResolvedModelCandidateV8Handler>>>(agent.prepareResolvedModelCandidateV8, { ...attempt, ordinal: 0 });
    if (candidate.state === "completed") throw Error("Fresh V8 model candidate required");
    expect(candidate.op.nativeRequestCanonical).toContain(root.source.content);
    const admitted = await f.call<{ admission: { attemptId: string }; permit: { dispatchIdentity: string } }>(agent.admitPreparedModelOperationV8, { ...attempt, operationId: candidate.op.operationId, ordinal: 0,
      requestCanonical: candidate.op.nativeRequestCanonical, snapshotCanonical: canonicalModelJson(candidate.governedResolution.snapshot),
      bindingCanonical: canonicalModelJson({ reference: f.reference, operationKey: "agent.respond", runBudgetId: candidate.current.run.runBudgetId, semanticId: candidate.op.semanticId, ordinal: 0 }) });
    native = { ...admitted, snapshot: candidate.governedResolution.snapshot };
    expect(f.db.table("runtimeModelAttempts")[0]!.canonical).toContain(root.source.content);
  }
  await f.call(agent.recordOutput, { ...attempt, parts: [{ type: "text-delta", text: root.source.content, id: "private-output" }] });
  journal.waitForBatches(2);
  await f.call(erasure.eraseSource, root.scope);
  expect(await purge(f, root.scope)).toBeGreaterThan(15);
  const execution = f.db.table("runtimeAgentExecutions").find(row => row._id === owned._id)!;
  expect(execution).toMatchObject({ sourceErasedAt: expect.any(Number), failureCode: "SOURCE_ERASED" });
  expect(execution.contextCanonical).toBeUndefined(); expect(execution.modelInputEntries).toBeUndefined();
  expect(JSON.stringify(f.db.table("runtimeModelAttempts"))).not.toContain(root.source.content);
  expect(JSON.stringify(f.db.table("runtimeAgentOutput"))).not.toContain(root.source.content);
  expect(journal.cleanups()).toBeGreaterThanOrEqual(1); expect(journal.barriers()).toBeGreaterThanOrEqual(4);
  await expect(f.call(v8 ? agent.saveContextV8 : agent.saveContext, { ...attempt, context: "LATE " + root.source.content, witnesses: [], completeness: "complete", ...(v8 ? { entries: [] } : {}) })).rejects.toMatchObject({ data: { code: "STALE_CONTEXT" } });
  expect(JSON.stringify(f.db.table("runtimeAgentExecutions"))).not.toContain(root.source.content);
  if (native) {
    const evidence = await f.call<{ evidenceId: string; state: string }>(ledger.captureTerminalEvidenceV8, { attemptId: native.admission.attemptId, dispatchIdentity: native.permit.dispatchIdentity,
      receiptCanonical: canonicalModelJson({ version: 1, dispatchIdentity: native.permit.dispatchIdentity, receiptId: "late-v8-charge", modelId: native.snapshot.modelId, nativeInterface: native.snapshot.nativeInterface,
        outcome: "confirmed", proof: "provider-terminal-v1", costSource: "unavailable" }) });
    expect(evidence.state).toBe("uncertain");
    expect(await f.call(ledger.attachTerminalResultV8, { reference: f.reference, attemptId: native.admission.attemptId, evidenceId: evidence.evidenceId, privateResultCanonical: canonicalModelJson({ text: root.source.content + " LATE V8" }) })).toEqual({ attached: false, resultWithheld: true });
    expect(JSON.stringify(f.db.table("runtimeModelAttempts"))).not.toContain(root.source.content);
  }
});

it("actual Agent admission indexes before bind; immediate and late legacy settlement cannot restore erased input/proof/result", async () => {
  // Use the reviewed legacy envelope qualification rather than a synthetic
  // provider response: only ledger control/accounting handlers execute here.
  installMockRoot();
  const { transcriptFixture, invoke, runs } = await import("../runtimeTranscript/fixture");
  const sources = await import("../../../convex-dev/runtimeExternalSources");
  const f = await transcriptFixture(), old = f.ctx.runMutation.bind(f.ctx);
  f.ctx.runMutation = (async (ref, args) => {
    const path = (ref as Partial<Record<symbol, string>>)[Symbol.for("toReferencePath")];
    if (path?.includes("workflow") && path.includes("cleanup")) return true;
    const name = path ? "" : getFunctionName(ref);
    const registration = name === "runs:claimNext" ? runs.claimNext : name.startsWith("runtimeAgent:") ? agent[name.split(":")[1] as keyof typeof agent] : undefined;
    return registration ? invoke(registration, f.ctx, args) : old(ref, args);
  }) as MutationCtx["runMutation"];
  const query = f.ctx.runQuery.bind(f.ctx);
  f.ctx.runQuery = (async (ref, args) => {
    const path = (ref as Partial<Record<symbol, string>>)[Symbol.for("toReferencePath")];
    if (path?.includes("workflow") && path.includes("listSteps")) return { page: [], isDone: true, continueCursor: "" };
    return query(ref, args);
  }) as MutationCtx["runQuery"];
  const marker = "ERASE-DEPENDENT-CONTEXT-7835";
  const captured = await f.call<{ receipt: { reference: { sourceId: string } } }>(sources.ingest, { requestId: "review-regression", input: { provider: "archive", externalSourceId: "dependent", externalEventId: "dep1", externalRevision: 1, originalText: marker, author: { id: "test-author" }, observedAt: 2, provenance: {}, attribution: "unverified_external", extraction: "none" } });
  const source = f.db.table("runtimeMemorySources")[0]!, lineage = source.lineage as { sourceId: string; sourceEventId: string; sourceRevision: number };
  const run = await f.run(); await f.call(agent.start, { runId: run.runId });
  const attempt = { reference: f.reference, runId: run.runId, attemptNumber: 1, leaseVersion: f.db.table("runtimeAgentExecutions")[0]!.leaseVersion };
  await f.call(agent.saveContext, { ...attempt, context: marker, witnesses: [{ sourceId: lineage.sourceId, sourceEventId: lineage.sourceEventId, sourceRevision: lineage.sourceRevision, contentHash: source.contentHash }], completeness: "complete" });
  const prepared = await f.call<{ current: { run: { runBudgetId: string } }; op: { semanticId: string; operationId: string } }>(agent.prepareModelOperation, { ...attempt, ordinal: 0 });
  const resolution = await f.call<{ snapshot: import("../../../src/domain/model-policy").ModelPolicySnapshotV1; dispatchEvidence: Parameters<typeof ledger.deriveQualifiedInputBound>[0] }>(ledger.resolve, { reference: f.reference, operationKey: "agent.respond", runBudgetId: prepared.current.run.runBudgetId });
  const snapshot = resolution.snapshot;
  const request: import("../../../src/domain/model-policy").ModelCallRequest = { semanticId: prepared.op.semanticId, childCallId: "server-normalized", texts: [marker], messages: [{ role: "user", parts: [{ type: "text", text: marker }] }], inputTokens: 1, outputTokens: 20, toolSteps: 0, timeoutMs: 1000,
    reservationUnits: snapshot.costBound.maximumCostUnits, promptVersion: snapshot.pins.promptVersion, schemaVersion: snapshot.pins.schemaVersion, extractionVersion: snapshot.pins.extractionVersion, toolRegistryVersion: snapshot.pins.toolRegistryVersion, tools: [], options: { maxRetries: 0 as const } };
  request.inputTokens = ledger.deriveQualifiedInputBound(resolution.dispatchEvidence, request);
  const admitted = await f.call<{ admission: { operationId: string; attemptId: string }; permit: { dispatchIdentity: string } }>(agent.admitModelOperation, { ...attempt, operationId: prepared.op.operationId, ordinal: 0, requestCanonical: canonicalModelJson(request), snapshotCanonical: canonicalModelJson(snapshot) });
  expect(f.db.table("runtimeSourceDependencies").some(row => row.targetKind === "model" && row.targetId === admitted.admission.operationId)).toBe(true);
  const scope = { tenantId: "tenant-a", memorySpaceId: "space-a", sourceId: captured.receipt.reference.sourceId };
  await f.call(erasure.eraseSource, scope);
  const receipt = canonicalModelJson({ version: 1, dispatchIdentity: admitted.permit.dispatchIdentity, receiptId: "review-late-terminal", modelId: snapshot.modelId, nativeInterface: "chat", outcome: "confirmed", proof: "provider-terminal-v1", costSource: "gateway-aggregate-usd-v1", aggregateCostUsd: "0.000001", privateResultCanonical: canonicalModelJson({ text: marker + " LATE RESPONSE" }) });
  expect(await f.call(ledger.settle, { reference: f.reference, attemptId: admitted.admission.attemptId, receiptCanonical: receipt })).toMatchObject({ state: "settled", resultWithheld: true });
  let complete = false; for (let count = 0; count < 300 && !complete; count++) complete = (await f.call<{ complete: boolean }>(erasure.continueSource, scope)).complete;
  expect(complete).toBe(true);
  for (const table of ["runtimeAgentExecutions", "runtimeAgentOperations", "runtimeModelAttempts"]) expect(JSON.stringify(f.db.table(table))).not.toContain(marker);
  expect(await f.call(ledger.settle, { reference: f.reference, attemptId: admitted.admission.attemptId, receiptCanonical: receipt })).toMatchObject({ state: "settled", resultWithheld: true });
  expect(f.db.table("runtimeModelAttempts")[0]).toMatchObject({ settledCostUnits: 1, resultWithheld: true, sourceErasedAt: expect.any(Number) });
  expect(f.db.table("runtimeModelAttempts")[0]!.privateResultCanonical).toBeUndefined();
});

it("transitive declared sources and generated native copies purge, while authored and later manual revisions survive", async () => {
  const f = await dependencyFixture(), root = await f.external(), history = await generated(f, root.witness); journalPort(f);
  const source = f.db.table("runtimeMemorySources").find(row => (row.lineage as { sourceId: string }).sourceId === history.assistant.sourceId)!;
  const { attempt, owned } = await f.start();
  await f.call(agent.saveContext, { ...attempt, context: source.content, witnesses: [{ ...source.lineage as object, contentHash: source.contentHash }], completeness: "complete" });
  expect((await dependencies.sourceDependencyWitnesses(f.ctx, root.scope, { kind: "execution", id: owned._id })).map(w => w.sourceId)).toContain(root.witness.sourceId);
  const created = await f.call<{ conversationId: string }>(transcript.create, { memorySpaceId: "space-a", clientRequestId: "independent-later-history" });
  const conversation = (await f.ctx.db.query("runtimeConversations").withIndex("by_scoped_id", q => q.eq("tenantId", "tenant-a").eq("memorySpaceId", "space-a").eq("conversationId", created.conversationId)).unique())!;
  const saved = await saveMessages(f.ctx, transcript.agentComponent, { threadId: conversation.threadId, messages: [{ role: "assistant", content: "Old derived revision " + root.source.content }] });
  await transcript.registerMessages(f.ctx, conversation, f.reference, saved.messages, { contextSourceWitnesses: [root.witness] });
  const later = (await f.ctx.db.query("runtimeTranscriptMessages").withIndex("by_native", q => q.eq("tenantId", "tenant-a").eq("memorySpaceId", "space-a").eq("nativeMessageId", saved.messages[0]!._id)).unique())!;
  await f.ctx.db.patch("runtimeConversations", conversation._id, { manualWriteLocked: false });
  await f.call(transcript.edit, { conversationId: conversation.conversationId, expectedRevision: 1, messageId: later.nativeMessageId, expectedMessageRevision: 1, parts: [{ type: "text", text: "Independent manual replacement" }] });
  await f.call(erasure.eraseSource, root.scope); await purge(f, root.scope);
  expect(f.native.messages.has(history.assistant.nativeMessageId)).toBe(false);
  expect(f.native.messages.has(history.user.nativeMessageId)).toBe(true);
  expect(f.native.messages.get(later.nativeMessageId)!.message).toMatchObject({ content: [{ text: "Independent manual replacement" }] });
  const newer = f.db.table("runtimeMemorySources").find(row => (row.lineage as { sourceId: string }).sourceId === later.sourceId)!;
  expect(newer.content).toBe("Independent manual replacement");
  expect(f.db.table("runtimeMemorySources").some(row => (row.lineage as { sourceId: string }).sourceId === history.assistant.sourceId)).toBe(false);
  expect(f.db.table("runtimeAgentExecutions").find(row => row._id === owned._id)!.contextCanonical).toBeUndefined();
});

it("bounded exact source cleanup preserves colliding host histories and unrelated scoped facts", async () => {
  const f = await dependencyFixture(), root = await f.external(); journalPort(f);
  const { ConvexMemoryRepository, memoryScope } = await import("../../../convex-dev/runtimeMemoryRepository");
  const { prepareSourceContent } = await import("../../../src/domain/sources");
  const { serverToolSourceLineage } = await import("../../../convex-dev/runtimeAgentTools");
  const ingestion = await import("../../../convex-dev/runtimeIngestion");
  const writer = new ConvexMemoryRepository(f.ctx, f.reference, "write", f.ctx.db), scope = memoryScope(f.reference);
  const prepared = await prepareSourceContent(scope, serverToolSourceLineage(scope, "declared-source-tool"), root.source.content, { now: () => Date.now() });
  await writer.putSource({ ...prepared.source, contextSourceWitnesses: [root.witness] });
  const event = await ingestion.enqueueSourceEvent(f.ctx, f.reference, prepared.source);
  const facts = Array.from({ length: 12 }, (_, index) => ({ _id: "", factId: `declared-fact-${index}`, tenantId: "tenant-a", memorySpaceId: "space-a", ownerPrincipalId: f.reference.principalId,
    lineage: prepared.source.lineage, extractionPolicyVersion: "controlled-derived-v1", fact: root.source.content + ` fact-${index}`, factType: "knowledge" as const, confidence: 20,
    sourceType: "tool" as const, tags: [], version: 1, createdAt: Date.now(), updatedAt: Date.now() }));
  await expect(writer.commitDerived({ source: prepared.source.lineage, identity: { sourceId: prepared.source.lineage.sourceId, sourceEventId: prepared.source.lineage.sourceEventId, sourceRevision: 1, stage: "facts", semanticPolicyVersion: "controlled-derived-v1" }, chunks: prepared.chunks, facts })).rejects.toMatchObject({ data: { code: "CAPABILITY_UNAVAILABLE" } });
  // Defensive cleanup of pre-existing malformed/imported derived copies. The
  // supported writer above refuses their creation without any model call.
  for (const fact of facts) { const { _id: _id, ...persisted } = fact; f.db.seed("facts", persisted); }
  await writer.commitDerived({ source: prepared.source.lineage, identity: { sourceId: prepared.source.lineage.sourceId, sourceEventId: prepared.source.lineage.sourceEventId, sourceRevision: 1, stage: "vectors", semanticPolicyVersion: "controlled-derived-v1" }, chunks: prepared.chunks });
  expect(await writer.getFact(facts[0]!.factId)).toBeNull();
  for (let index = 0; index < 12; index++) f.db.seed("runtimeBeliefHistory", { tenantId: "tenant-a", memorySpaceId: "space-a", eventId: event.eventId, factId: facts[index]!.factId,
    historyId: `controlled-belief-${index}`, sequence: index + 1, action: "ADD", planCanonical: root.source.content, actorReference: f.reference, createdAt: Date.now() });
  const histories = ["space-a", "another-space"].map(memorySpaceId => f.db.seed("factHistory", { scopeVersion: 1, tenantId: "tenant-a", memorySpaceId, factId: facts[0]!.factId,
    eventId: `host-history-${memorySpaceId}`, action: "UPDATE", newValue: "Unrelated authored history", timestamp: Date.now() }));
  const outside = f.db.seed("facts", { ...facts[0]!, memorySpaceId: "another-space" });
  const unrelated = f.db.seed("runtimeBeliefHistory", { tenantId: "tenant-a", memorySpaceId: "space-a", eventId: "independent-later-event", factId: facts[0]!.factId,
    historyId: "independent-history", sequence: 99, action: "UPDATE", planCanonical: "Independently authored later context", actorReference: f.reference, createdAt: Date.now() });
  await f.call(erasure.eraseSource, root.scope); expect(await purge(f, root.scope)).toBeGreaterThan(20);
  expect(f.db.table("facts").filter(row => row.memorySpaceId === "space-a")).toEqual([]);
  expect(f.db.table("facts").find(row => row._id === outside._id)).toBeDefined();
  expect(f.db.table("factHistory")).toEqual(histories);
  expect(f.db.table("runtimeBeliefHistory")).toEqual([unrelated]);
  expect(f.db.table("runtimeMemoryReceipts")).toEqual([]); expect(f.db.table("runtimeMemoryChunks")).toEqual([]);
});
