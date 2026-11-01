/** Actual native handler bodies with controlled DB/scheduler/model ports.
 * This is offline ordering/rollback evidence, not hosted OCC or paid inference. */
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { getFunctionName } from "convex/server";
import { ConvexError } from "convex/values";
import type { ActionCtx, MutationCtx } from "../../../convex-dev/_generated/server";
import type { AttributedFact, MemoryModel } from "../../../src/domain/contracts";
import type { ModelCallRequest, ModelPolicySnapshotV1 } from "../../../src/domain/model-policy";
import { canonicalModelJson } from "../../../src/domain/model-policy";
import { DEFAULT_EMBEDDING_PROFILE, semanticHash } from "../../../src/domain/profile";
import { planBeliefs } from "../../../src/domain/belief-plan";
import { ingestionFixture, ingestion, beliefs, installIngestionMockRoot, candidate } from "./fixture";
import { ledger, clock } from "../runtimeTranscript/fixture";
const context = await import("../../../convex-dev/runtimeMemoryContext");
type Fixture = Awaited<ReturnType<typeof ingestionFixture>>;
type Lease = { reference: Fixture["reference"]; eventId: string; stage: "extract" | "facts" | "vectors"; attempt: number; leaseVersion: number };
function model(overrides: Partial<MemoryModel> = {}): MemoryModel {
  return { extract: jest.fn(async () => ({ facts: [candidate("coral")] })),
    resolve: jest.fn(async () => { throw new Error("No automatic paid replan allowed"); }),
    embed: jest.fn<MemoryModel["embed"]>(async request => ({ profile: request.profile, vectors: request.texts.map(() => Array<number>(request.profile.dimensions).fill(0.1)) })), ...overrides };
}
async function worker(f: Fixture, eventId: string, stage: Lease["stage"], ownedModel: MemoryModel) {
  return await ingestion.processStageHandler(f.ctx as unknown as ActionCtx, { reference: f.reference, eventId, stage }, () => ownedModel);
}
function stage(f: Fixture, eventId: string, key: Lease["stage"]) {
  return f.db.table("runtimeIngestionStages").find(row => row.eventId === eventId && row.stage === key)!;
}
async function extracted(f: Fixture, id: string, value = "coral") {
  const event = await ingestion.enqueueSourceEvent(f.ctx, f.reference, await f.source(`User prefers ${value}`, id));
  await f.extraction(event.eventId, [candidate(value)]); return event;
}
async function lease(f: Fixture, eventId: string, key: Lease["stage"]): Promise<Lease> {
  const owned = await f.claim(eventId, key);
  return { reference: f.reference, eventId, stage: key, attempt: owned.attempt as number, leaseVersion: owned.leaseVersion as number };
}
async function plan(f: Fixture, owned: Lease) {
  const input = await f.call<Awaited<ReturnType<typeof ingestion.requireStageLease>> & { extraction: string; existing: [] }>(ingestion.stageInput, owned);
  return await planBeliefs({ eventId: input.event.eventId, sequence: input.event.sequence, source: input.source,
    candidates: JSON.parse(input.extraction) as AttributedFact[], existing: input.existing, resolve: async () => { throw new Error("Unexpected resolver"); } });
}
async function admission(f: Fixture, owned: Lease) {
  const input = await ingestion.requireStageLease(f.ctx, owned);
  const job = f.db.table("runtimeIngestionJobs").find(row => row.eventId === owned.eventId)!;
  const snapshot = JSON.parse(input.stage.policyCanonical!) as ModelPolicySnapshotV1;
  const semanticId = await semanticHash(canonicalModelJson(["embedding.memory", `${owned.eventId}:vectors:${owned.attempt}`, input.event.profile.profileId]));
  const request: ModelCallRequest = { semanticId, childCallId: "server-derived", texts: [input.source.content],
    inputTokens: 1, outputTokens: 0, toolSteps: 0, timeoutMs: Math.min(1000, snapshot.limits.timeoutMs), reservationUnits: 1,
    promptVersion: snapshot.pins.promptVersion, schemaVersion: snapshot.pins.schemaVersion,
    extractionVersion: snapshot.pins.extractionVersion, toolRegistryVersion: snapshot.pins.toolRegistryVersion,
    tools: [], options: { maxRetries: 0 }, profile: input.event.profile, batch: { ordinal: 0, start: 0, end: 1 } };
  return { reference: f.reference, operationKey: "embedding.memory" as const, runBudgetId: job.runBudgetId as string,
    semanticId, ordinal: 0, source: { sourceId: input.source.lineage.sourceId, sourceEventId: input.source.lineage.sourceEventId,
      sourceRevision: input.source.lineage.sourceRevision, contentHash: input.source.contentHash }, requestCanonical: canonicalModelJson(request) };
}
async function waitingFixture() {
  const f = await ingestionFixture();
  const held = await ingestion.enqueueSourceEvent(f.ctx, f.reference, await f.source("External assistant context", "holder", 1, "assistant"));
  const heldLease = await lease(f, held.eventId, "vectors");
  const tenant = f.db.table("runtimeBudgetAccounts").find(row => row.kind === "tenant")!;
  await f.db.patch("runtimeBudgetAccounts", tenant._id, { concurrencyLimit: 1 });
  const reservation = await f.call<{ attemptId: string }>(ledger.admit, await admission(f, heldLease));
  const target = await ingestion.enqueueSourceEvent(f.ctx, f.reference, await f.source("Second assistant context", "target", 1, "assistant"));
  return { f, heldLease, reservation, target };
}
async function refuseOnce(f: Fixture, eventId: string) {
  const embed = jest.fn<MemoryModel["embed"]>(async () => {
    const row = stage(f, eventId, "vectors");
    const owned: Lease = { reference: f.reference, eventId, stage: "vectors", attempt: row.attempt as number, leaseVersion: row.leaseVersion as number };
    await f.call(ledger.admit, await admission(f, owned));
    throw new Error("Capacity fixture must refuse before native dispatch");
  });
  await worker(f, eventId, "vectors", model({ embed })); return embed;
}
describe("repeat capture extraction and native CAS recovery", () => {
  beforeEach(() => installIngestionMockRoot()); afterEach(() => { jest.restoreAllMocks(); });
  test("two equal confirmed extractions race: stale original CAS rejects, fresh NONE finishes with one belief and no resolver", async () => {
    const f = await ingestionFixture(); const first = await extracted(f, "capture-first"); const second = await extracted(f, "capture-second");
    const firstLease = await lease(f, first.eventId, "facts"), firstPlan = await plan(f, firstLease);
    const oldMutation = f.ctx.runMutation.bind(f.ctx); let casRejected = false, replans = 0;
    f.ctx.runMutation = (async (ref, args) => {
      const name = getFunctionName(ref);
      const result = await oldMutation(ref, args);
      if (name === "runtimeIngestion:persistDraft" && (args as Lease).stage === "facts" && (args as Lease).eventId === second.eventId) {
        await f.call(beliefs.commit, { ...firstLease, planCanonical: canonicalModelJson(firstPlan) });
      }
      return result;
    }) as MutationCtx["runMutation"];
    const previous = f.ctx.runMutation.bind(f.ctx);
    f.ctx.runMutation = (async (ref, args) => {
      const name = getFunctionName(ref);
      if (name === "runtimeBeliefs:replan") replans++;
      try { return await previous(ref, args); } catch (error) {
        if (name === "runtimeBeliefs:commit" && error instanceof ConvexError && error.data.code === "FACT_VERSION_CONFLICT") casRejected = true;
        throw error;
      }
    }) as MutationCtx["runMutation"];
    const controlled = model(); await worker(f, second.eventId, "facts", controlled);
    expect(casRejected).toBe(true); expect(replans).toBe(1);
    expect(controlled.extract).not.toHaveBeenCalled(); expect(controlled.resolve).not.toHaveBeenCalled();
    expect(f.db.table("facts")).toHaveLength(1); expect(f.db.table("facts")[0]).toMatchObject({ version: 1, lineage: { sourceId: "capture-first" } });
    expect(f.db.table("runtimeBeliefHistory").map(row => row.action)).toEqual(["ADD", "NONE"]);
    expect(f.db.table("runtimeBeliefOutbox")).toHaveLength(2); expect(f.db.table("runtimeMemoryReceipts")).toHaveLength(2);
    expect(stage(f, first.eventId, "extract").attempt).toBe(1); expect(stage(f, second.eventId, "extract").attempt).toBe(1);
    expect(stage(f, second.eventId, "facts")).toMatchObject({ state: "complete", attempt: 1 });
    await worker(f, second.eventId, "facts", controlled); expect(f.db.table("runtimeBeliefHistory")).toHaveLength(2);
    await worker(f, first.eventId, "vectors", controlled); await worker(f, second.eventId, "vectors", controlled);
    await context.refreshScopeWatermarks(f.ctx, f.reference);
    expect(f.db.table("runtimeIngestionScopes")[0]).toMatchObject({ factsThrough: 2, vectorsThrough: 2 });
  });
  test("an equal capture after the first commit uses exact NONE without another billable conflict call", async () => {
    const f = await ingestionFixture(); const first = await extracted(f, "first"); const controlled = model();
    await worker(f, first.eventId, "facts", controlled); const second = await extracted(f, "second");
    await worker(f, second.eventId, "facts", controlled);
    expect(controlled.resolve).not.toHaveBeenCalled(); expect(controlled.extract).not.toHaveBeenCalled();
    expect(f.db.table("facts")).toHaveLength(1); expect(f.db.table("runtimeBeliefHistory").map(row => row.action)).toEqual(["ADD", "NONE"]);
  });
  test.each(["different", "older"] as const)("%s source cannot turn a stale paid plan into a silent overwrite", async mode => {
    const f = await ingestionFixture(); const first = await extracted(f, "first", "coral"); const second = await extracted(f, "second", mode === "different" ? "blue" : "coral");
    const firstLease = await lease(f, first.eventId, "facts"), secondLease = await lease(f, second.eventId, "facts");
    const firstPlan = await plan(f, firstLease), secondPlan = await plan(f, secondLease);
    const winner = mode === "older" ? secondLease : firstLease, winnerPlan = mode === "older" ? secondPlan : firstPlan;
    const loser = mode === "older" ? firstLease : secondLease, loserPlan = mode === "older" ? firstPlan : secondPlan;
    await f.call(ingestion.persistDraft, { ...loser, payloadCanonical: canonicalModelJson(loserPlan) });
    await f.call(beliefs.commit, { ...winner, planCanonical: canonicalModelJson(winnerPlan) });
    const before = canonicalModelJson(f.db.table("facts"));
    await expect(f.call(beliefs.commit, { ...loser, planCanonical: canonicalModelJson(loserPlan) })).rejects.toMatchObject({ data: { code: "FACT_VERSION_CONFLICT" } });
    await expect(f.call(beliefs.replan, { ...loser, planCanonical: canonicalModelJson(loserPlan) })).rejects.toMatchObject({ data: {
      code: mode === "older" ? "BELIEF_ORDER_CONFLICT" : "REPLAN_REQUIRED" } });
    expect(canonicalModelJson(f.db.table("facts"))).toBe(before); expect(f.db.table("runtimeBeliefHistory")).toHaveLength(1);
    expect(stage(f, loser.eventId, "extract").state).toBe("complete");
  });
  test.each(["grant", "tombstone", "edit", "lease", "policy"] as const)("fresh %s fence rejects replan and keeps the confirmed extraction", async mode => {
    const f = await ingestionFixture(); const event = await extracted(f, "fenced"); const owned = await lease(f, event.eventId, "facts"), proposal = await plan(f, owned);
    await f.call(ingestion.persistDraft, { ...owned, payloadCanonical: canonicalModelJson(proposal) });
    if (mode === "grant") await f.db.patch("runtimeAuthGrants", f.grant._id, { revokedAt: clock });
    if (mode === "tombstone") f.db.seed("runtimeAuthTombstones", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId, resourceType: "source", resourceId: "fenced", deletedAt: clock });
    if (mode === "edit") await f.source("Changed source", "fenced", 2);
    if (mode === "lease") await f.db.patch("runtimeIngestionStages", stage(f, event.eventId, "facts")._id, { leaseExpiresAt: clock });
    if (mode === "policy") await f.db.patch("runtimeIngestionStages", stage(f, event.eventId, "facts")._id, { policyCanonical: "{}" });
    await expect(f.call(beliefs.replan, { ...owned, planCanonical: canonicalModelJson(proposal) })).rejects.toBeDefined();
    expect(f.db.table("facts")).toHaveLength(0); expect(f.db.table("runtimeBeliefOutbox")).toHaveLength(0);
    expect(stage(f, event.eventId, "extract")).toMatchObject({ state: "complete", attempt: 1 });
  });
});
describe("known unreserved capacity scheduling", () => {
  beforeEach(() => installIngestionMockRoot()); afterEach(() => { jest.restoreAllMocks(); });
  test("occupied actual slot waits, release permits one wake with the SAME attempt/deadline; duplicates cannot dispatch again", async () => {
    const { f, heldLease, reservation, target } = await waitingFixture();
    const refused = await refuseOnce(f, target.eventId);
    const pending = stage(f, target.eventId, "vectors");
    expect(pending).toMatchObject({ state: "pending", attempt: 1, capacityWait: { wakes: 1, notBefore: clock + 250 } });
    const deadline = (pending.capacityWait as { deadline: number }).deadline;
    expect(deadline).toBeLessThanOrEqual(clock + 120000);
    expect(f.db.table("runtimeModelAttempts")).toHaveLength(1); expect(refused).toHaveBeenCalledTimes(1);
    await worker(f, target.eventId, "vectors", model()); expect(stage(f, target.eventId, "vectors").state).toBe("pending");
    await f.call(ledger.releaseNotDispatched, { reference: f.reference, attemptId: reservation.attemptId });
    expect(stage(f, heldLease.eventId, "vectors").state).toBe("running");
    jest.spyOn(Date, "now").mockReturnValue(clock + 250);
    const embedded = model(); await worker(f, target.eventId, "vectors", embedded); await worker(f, target.eventId, "vectors", embedded);
    expect(stage(f, target.eventId, "vectors")).toMatchObject({ state: "complete", attempt: 1, leaseExpiresAt: deadline });
    expect(embedded.embed).toHaveBeenCalledTimes(1); expect(f.db.table("runtimeMemoryVectors")).toHaveLength(1);
    // The controlled model supplies vectors; no hosted/paid attempt is claimed.
    expect(f.db.table("runtimeModelAttempts")).toHaveLength(1);
  });
  test.each(["money", "window", "cancelled", "uncertain", "no-proof"] as const)("%s is not a known capacity queue", async mode => {
    const { f, target } = await waitingFixture();
    if (mode === "money" || mode === "window") {
      const tenant = f.db.table("runtimeBudgetAccounts").find(row => row.kind === "tenant")!;
      await f.db.patch("runtimeBudgetAccounts", tenant._id, mode === "money" ? { settledUnits: tenant.limitUnits } : { windowEnd: clock });
    }
    if (mode === "cancelled") {
      // A native policy/claim refusal occurs before construction/dispatch.
      const tenant = f.db.table("runtimeBudgetAccounts").find(row => row.kind === "tenant")!;
      await f.db.patch("runtimeBudgetAccounts", tenant._id, { cancelled: true });
    }
    const controlled = model({ embed: async () => {
      if (mode === "no-proof") throw new ConvexError({ code: "BUDGET_EXCEEDED", outcome: "not_dispatched" });
      if (mode === "uncertain") throw new ConvexError({ code: "BUDGET_EXCEEDED", outcome: "uncertain", capacity: { reason: "concurrency" } });
      const row = stage(f, target.eventId, "vectors");
      await f.call(ledger.admit, await admission(f, { reference: f.reference, eventId: target.eventId, stage: "vectors", attempt: row.attempt as number, leaseVersion: row.leaseVersion as number }));
      throw new Error("Capacity fixture must refuse before native dispatch");
    } });
    await worker(f, target.eventId, "vectors", controlled);
    expect(stage(f, target.eventId, "vectors").state).toBe(mode === "uncertain" ? "unknown" : "failed");
    expect(stage(f, target.eventId, "vectors").capacityWait).toBeUndefined();
    expect(f.db.table("runtimeModelAttempts")).toHaveLength(1); expect(f.db.table("runtimeMemoryVectors")).toHaveLength(0);
  });
  test.each(["grant", "delete", "edit", "deadline", "policy", "profile", "cancel"] as const)("%s during waiting cannot dispatch or advance readiness", async mode => {
    const { f, target, reservation } = await waitingFixture(); await refuseOnce(f, target.eventId);
    expect(stage(f, target.eventId, "vectors").state).toBe("pending");
    await f.call(ledger.releaseNotDispatched, { reference: f.reference, attemptId: reservation.attemptId });
    if (mode === "grant") await f.db.patch("runtimeAuthGrants", f.grant._id, { revokedAt: clock });
    if (mode === "delete") f.db.seed("runtimeAuthTombstones", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId, resourceType: "source", resourceId: "target", deletedAt: clock });
    if (mode === "edit") await f.source("Changed context", "target", 2, "assistant");
    if (mode === "policy") await f.db.patch("runtimeIngestionStages", stage(f, target.eventId, "vectors")._id, { policyCanonical: "{}" });
    if (mode === "profile") await f.db.patch("runtimeIngestionEvents", f.db.table("runtimeIngestionEvents").find(row => row.eventId === target.eventId)!._id,
      { profile: { ...DEFAULT_EMBEDDING_PROFILE, profileId: "unsupported" } });
    if (mode === "cancel") await f.call(ledger.cancelBudget, { reference: f.reference,
      runBudgetId: f.db.table("runtimeIngestionJobs").find(row => row.eventId === target.eventId)!.runBudgetId });
    const deadline = (stage(f, target.eventId, "vectors").capacityWait as { deadline: number }).deadline;
    jest.spyOn(Date, "now").mockReturnValue(mode === "deadline" ? deadline : clock + 250);
    const controlled = model(); await worker(f, target.eventId, "vectors", controlled);
    expect(controlled.embed).not.toHaveBeenCalled(); expect(f.db.table("runtimeMemoryVectors")).toHaveLength(0);
    expect(stage(f, target.eventId, "vectors").state).toBe("failed");
    if (mode === "deadline") expect(stage(f, target.eventId, "vectors").failureCode).toBe("CAPACITY_WAIT_EXPIRED");
  });
  test("successive occupied wakes keep one semantic identity and the first deadline without resetting liability", async () => {
    const { f, target } = await waitingFixture(); await refuseOnce(f, target.eventId);
    const first = stage(f, target.eventId, "vectors"), deadline = (first.capacityWait as { deadline: number }).deadline;
    const accounts = canonicalModelJson(f.db.table("runtimeBudgetAccounts"));
    jest.spyOn(Date, "now").mockReturnValue(clock + 250); await refuseOnce(f, target.eventId);
    expect(stage(f, target.eventId, "vectors")).toMatchObject({ state: "pending", attempt: 1, leaseVersion: 2,
      capacityWait: { deadline, wakes: 2, notBefore: clock + 750 } });
    expect(canonicalModelJson(f.db.table("runtimeBudgetAccounts"))).toBe(accounts);
    expect(f.db.table("runtimeModelAttempts")).toHaveLength(1); expect(f.db.table("runtimeMemoryVectors")).toHaveLength(0);
  });
  test("a lost unclaimed capacity wake expires durably and an obsolete callback cannot retire its successor", async () => {
    const { f, target } = await waitingFixture(); await refuseOnce(f, target.eventId);
    jest.spyOn(Date, "now").mockReturnValue(clock + 250); await refuseOnce(f, target.eventId);
    const pending = stage(f, target.eventId, "vectors"), deadline = (pending.capacityWait as { deadline: number }).deadline;
    const token = { reference: f.reference, eventId: target.eventId, stage: "vectors", attempt: pending.attempt, leaseVersion: pending.leaseVersion };
    jest.spyOn(Date, "now").mockReturnValue(deadline);
    await f.call(ingestion.expireStage, { ...token, leaseVersion: (token.leaseVersion as number) - 1 });
    expect(stage(f, target.eventId, "vectors").state).toBe("pending");
    await f.call(ingestion.expireStage, token);
    expect(stage(f, target.eventId, "vectors")).toMatchObject({ state: "failed", failureCode: "CAPACITY_WAIT_EXPIRED", attempt: 1 });
    const writes = f.db.writes; await f.call(ingestion.expireStage, token); expect(f.db.writes).toBe(writes);
    expect(f.db.table("runtimeMemoryVectors")).toHaveLength(0); expect(f.db.table("runtimeModelAttempts")).toHaveLength(1);
  });
  test("permanent money exhaustion after a concurrency refusal prevents the native queue from accepting stale reason metadata", async () => {
    const { f, target } = await waitingFixture();
    const controlled = model({ embed: async () => {
      const row = stage(f, target.eventId, "vectors"), args = await admission(f, { reference: f.reference, eventId: target.eventId,
        stage: "vectors", attempt: row.attempt as number, leaseVersion: row.leaseVersion as number });
      try { await f.call(ledger.admit, args); } catch (error) {
        expect(error).toMatchObject({ data: { capacity: { reason: "concurrency" } } });
        const run = f.db.table("runtimeBudgetAccounts").find(account => account.runBudgetId === args.runBudgetId)!;
        await f.db.patch("runtimeBudgetAccounts", run._id, { settledUnits: run.limitUnits });
        throw error;
      }
      throw new Error("Expected native capacity refusal");
    } });
    await worker(f, target.eventId, "vectors", controlled);
    expect(stage(f, target.eventId, "vectors")).toMatchObject({ state: "failed" });
    expect(stage(f, target.eventId, "vectors").capacityWait).toBeUndefined(); expect(f.db.table("runtimeModelAttempts")).toHaveLength(1);
  });
  test("a forged capacity error after actual reservation cannot queue or free/replace the held native attempt", async () => {
    const f = await ingestionFixture(); const event = await ingestion.enqueueSourceEvent(f.ctx, f.reference, await f.source("Context", "target", 1, "assistant"));
    const controlled = model({ embed: async () => {
      const row = stage(f, event.eventId, "vectors"), args = await admission(f, { reference: f.reference, eventId: event.eventId, stage: "vectors", attempt: row.attempt as number, leaseVersion: row.leaseVersion as number });
      await f.call(ledger.admit, args);
      throw new ConvexError({ code: "BUDGET_EXCEEDED", outcome: "not_dispatched", capacity: { version: 1, origin: "unreserved-admission", reason: "concurrency",
        operationKey: args.operationKey, runBudgetId: args.runBudgetId, semanticId: args.semanticId, ordinal: 0 } });
    } });
    await worker(f, event.eventId, "vectors", controlled);
    expect(stage(f, event.eventId, "vectors")).toMatchObject({ state: "unknown" });
    expect(stage(f, event.eventId, "vectors").capacityWait).toBeUndefined();
    expect(f.db.table("runtimeModelAttempts")).toHaveLength(1); expect(f.db.table("runtimeModelAttempts")[0].state).toBe("reserved");
    expect(f.db.table("runtimeBudgetAccounts").filter(row => row.kind === "run")[0].activeConcurrency).toBe(1);
  });
});
