/** Native handler bodies with transactional rollback and controlled model ports.
 * Hosted OCC is the preserved failing receipt, not claimed by these offline tests. */
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { getFunctionName } from "convex/server";
import { ConvexError } from "convex/values";
import type { ActionCtx, MutationCtx } from "../../../convex-dev/_generated/server";
import type { MemoryModel } from "../../../src/domain/contracts";
import { canonicalModelJson } from "../../../src/domain/model-policy";
import { semanticHash } from "../../../src/domain/profile";
import { INGESTION_LEASE_MS } from "../../../src/domain/ingestion";
import { candidate, ingestion, ingestionFixture, installIngestionMockRoot } from "./fixture";
import { clock } from "../runtimeTranscript/fixture";
type Fixture = Awaited<ReturnType<typeof ingestionFixture>>;
type Stage = "extract" | "facts" | "vectors";
function stage(f: Fixture, eventId: string, key: Stage = "extract") {
  return f.db.table("runtimeIngestionStages").find(row => row.eventId === eventId && row.stage === key)!;
}
function model() {
  return { extract: jest.fn<MemoryModel["extract"]>(async () => ({ facts: [candidate("coral")] })),
    resolve: jest.fn<MemoryModel["resolve"]>(async () => { throw new Error("Unexpected resolver"); }),
    embed: jest.fn<MemoryModel["embed"]>(async request => ({ profile: request.profile,
      vectors: request.texts.map(() => Array<number>(request.profile.dimensions).fill(0.1)) })) };
}
async function worker(f: Fixture, eventId: string, ownedModel = model(), key: Stage = "extract") {
  const factory = jest.fn(() => ownedModel);
  await ingestion.processStageHandler(f.ctx as unknown as ActionCtx, { reference: f.reference, eventId, stage: key }, factory);
  return { factory, model: ownedModel };
}
async function queued(f: Fixture) {
  return await ingestion.enqueueSourceEvent(f.ctx, f.reference, await f.source("My favorite color is coral."));
}
function transientClaims(f: Fixture, count = Infinity) {
  const invoke = f.ctx.runMutation.bind(f.ctx); let failed = 0;
  f.ctx.runMutation = (async (ref, args) => {
    if (getFunctionName(ref) === "runtimeIngestion:claim" && failed++ < count) throw new Error("OCC_RETRY_EXHAUSTED");
    return await invoke(ref, args);
  }) as MutationCtx["runMutation"];
}
describe("bounded recovery of never-dispatched ingestion claims", () => {
  beforeEach(() => installIngestionMockRoot()); afterEach(() => { jest.restoreAllMocks(); });
  test("fully rolled-back claim recovers the same intent once without duplicate model effects", async () => {
    const f = await ingestionFixture(), event = await queued(f), invoke = f.ctx.runMutation.bind(f.ctx), ownedModel = model();
    let failed = false, aborted: Record<string, unknown> | undefined;
    f.ctx.runMutation = (async (ref, args) => {
      if (getFunctionName(ref) === "runtimeIngestion:claim" && !failed) {
        failed = true;
        return await f.transaction(async () => {
          aborted = await invoke(ref, args) as Record<string, unknown>;
          throw new Error("OCC_RETRY_EXHAUSTED_AFTER_ATOMIC_ROLLBACK");
        });
      }
      return await invoke(ref, args);
    }) as MutationCtx["runMutation"];
    const initial = await worker(f, event.eventId, ownedModel);
    expect(initial.factory).not.toHaveBeenCalled(); expect(f.db.table("runtimeIngestionJobs")).toHaveLength(0);
    expect(f.db.table("runtimeBudgetAccounts")).toHaveLength(0); expect(f.db.table("runtimeModelOperations")).toHaveLength(0);
    expect(stage(f, event.eventId)).toMatchObject({ state: "pending", attempt: 1, leaseVersion: 0,
      claimWait: { deadline: clock + INGESTION_LEASE_MS, notBefore: clock + 250, wakes: 1, failedClaimAt: clock } });
    expect(f.db.table("runtimeIngestionScopes")[0]).toMatchObject({ factsThrough: 0, vectorsThrough: 0 });
    jest.spyOn(Date, "now").mockReturnValue(clock + 250);
    await worker(f, event.eventId, ownedModel);
    expect(ownedModel.extract).toHaveBeenCalledTimes(1); expect(ownedModel.extract.mock.calls[0]![0]).toMatchObject({
      operationId: `${event.eventId}:extract:1`, attempt: 1 });
    expect(stage(f, event.eventId)).toMatchObject({ state: "complete", attempt: 1, leaseVersion: 1,
      leaseExpiresAt: clock + INGESTION_LEASE_MS });
    expect(f.db.table("runtimeIngestionJobs")).toHaveLength(1);
    expect(f.db.table("runtimeIngestionJobs")[0].runBudgetId).toBe(aborted!.runBudgetId);
    await worker(f, event.eventId, ownedModel);
    expect(ownedModel.extract).toHaveBeenCalledTimes(1); expect(ownedModel.resolve).not.toHaveBeenCalled();
  });
  test("a committed claim with a lost response is not redispatched and retires to sticky unknown", async () => {
    const f = await ingestionFixture(), event = await queued(f), invoke = f.ctx.runMutation.bind(f.ctx), ownedModel = model();
    let lost = false;
    f.ctx.runMutation = (async (ref, args) => {
      const value = await invoke(ref, args);
      if (getFunctionName(ref) === "runtimeIngestion:claim" && !lost) { lost = true; throw new Error("RESPONSE_LOST_AFTER_COMMIT"); }
      return value;
    }) as MutationCtx["runMutation"];
    expect((await worker(f, event.eventId, ownedModel)).factory).not.toHaveBeenCalled();
    expect(stage(f, event.eventId)).toMatchObject({ state: "running", attempt: 1, leaseVersion: 1 });
    expect(stage(f, event.eventId).claimWait).toBeUndefined(); expect(f.db.table("runtimeIngestionJobs")).toHaveLength(1);
    await worker(f, event.eventId, ownedModel); expect(ownedModel.extract).not.toHaveBeenCalled();
    jest.spyOn(Date, "now").mockReturnValue(clock + INGESTION_LEASE_MS + 1);
    const expiration = f.scheduled.find(item => item.name === "runtimeIngestion:expireStage")!;
    await f.call(ingestion.expireStage, expiration.args as Record<string, unknown>);
    expect(stage(f, event.eventId)).toMatchObject({ state: "unknown", failureCode: "INTERRUPTED_REQUIRES_RECONCILIATION" });
    await worker(f, event.eventId, ownedModel); expect(ownedModel.extract).not.toHaveBeenCalled();
    expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
  });
  test.each([false, true])("existing paid operation on a pending intent stays unknown, expired=%s", async expired => {
    const f = await ingestionFixture(), event = await queued(f), ownedModel = model();
    const semanticId = await semanticHash(canonicalModelJson(["memory.extract", `${event.eventId}:extract:1`,
      f.db.table("runtimeIngestionEvents")[0].extractionVersion]));
    const operation = f.db.seed("runtimeModelOperations", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId,
      principalId: f.reference.principalId, semanticId, operationKey: "memory.extract", reservedUnits: 100000 });
    if (expired) {
      await f.db.patch("runtimeIngestionStages", stage(f, event.eventId)._id, { attempt: 1, leaseExpiresAt: clock + INGESTION_LEASE_MS,
        claimWait: { deadline: clock + INGESTION_LEASE_MS, notBefore: clock + 250, wakes: 1, failedClaimAt: clock } });
      jest.spyOn(Date, "now").mockReturnValue(clock + INGESTION_LEASE_MS + 1);
    }
    transientClaims(f, 1); await worker(f, event.eventId, ownedModel);
    expect(stage(f, event.eventId)).toMatchObject({ state: "unknown", attempt: 1, failureCode: "INDEXING_CLAIM_OUTCOME_UNKNOWN" });
    if (!expired) expect(stage(f, event.eventId).claimWait).toBeUndefined();
    expect(ownedModel.extract).not.toHaveBeenCalled();
    expect(f.db.table("runtimeModelOperations")).toEqual([operation]); expect(f.db.table("runtimeIngestionJobs")).toHaveLength(0);
    await expect(f.call(ingestion.retry, { eventId: event.eventId, stage: "extract" })).rejects.toMatchObject({ data: { code: "RETRY_NOT_SAFE" } });
  });
  test("bounded repeated claim conflicts preserve original identity and deadline then fail visibly", async () => {
    const f = await ingestionFixture(), event = await queued(f), ownedModel = model(); transientClaims(f);
    for (let wake = 1; wake <= 4; wake++) {
      await worker(f, event.eventId, ownedModel);
      const row = stage(f, event.eventId), wait = row.claimWait as { deadline: number; notBefore: number; wakes: number };
      expect(row).toMatchObject({ state: "pending", attempt: 1, leaseVersion: 0 });
      expect(wait.deadline).toBe(clock + INGESTION_LEASE_MS); expect(wait.wakes).toBe(wake);
      jest.spyOn(Date, "now").mockReturnValue(wait.notBefore);
    }
    await worker(f, event.eventId, ownedModel);
    expect(stage(f, event.eventId)).toMatchObject({ state: "failed", attempt: 1, failureCode: "CLAIM_WAIT_EXPIRED" });
    expect(ownedModel.extract).not.toHaveBeenCalled(); expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
    expect(f.db.table("runtimeBudgetAccounts")).toHaveLength(0);
    expect(f.db.table("runtimeIngestionEvents")[0].factsState).toBe("failed");
  });
  test("original queued deadline expires without a wake and stale expiration cannot change a successor", async () => {
    const f = await ingestionFixture(), event = await queued(f), ownedModel = model(); transientClaims(f, 1);
    await worker(f, event.eventId, ownedModel);
    const expiration = f.scheduled.find(item => item.name === "runtimeIngestion:expireStage")!.args as Record<string, unknown>;
    jest.spyOn(Date, "now").mockReturnValue(clock + INGESTION_LEASE_MS);
    await f.call(ingestion.expireStage, { ...expiration, leaseVersion: 9 });
    expect(stage(f, event.eventId).state).toBe("pending");
    await f.call(ingestion.expireStage, expiration);
    expect(stage(f, event.eventId)).toMatchObject({ state: "failed", attempt: 1, failureCode: "CLAIM_WAIT_EXPIRED" });
    await worker(f, event.eventId, ownedModel); expect(ownedModel.extract).not.toHaveBeenCalled();
    expect(f.db.table("runtimeIngestionScopes")[0]).toMatchObject({ factsThrough: 0, vectorsThrough: 0 });
  });
  test.each(["POLICY_DENIED", "BUDGET_EXCEEDED"])("definitive %s failure is not looped or queued", async code => {
    const f = await ingestionFixture(), event = await queued(f), invoke = f.ctx.runMutation.bind(f.ctx), ownedModel = model();
    f.ctx.runMutation = (async (ref, args) => {
      if (getFunctionName(ref) === "runtimeIngestion:claim") throw new ConvexError({ code, outcome: "not_dispatched" });
      return await invoke(ref, args);
    }) as MutationCtx["runMutation"];
    await worker(f, event.eventId, ownedModel);
    expect(stage(f, event.eventId)).toMatchObject({ state: "failed", failureCode: "INDEXING_ADMISSION_FAILED", attempt: 1 });
    expect(stage(f, event.eventId).claimWait).toBeUndefined(); expect(ownedModel.extract).not.toHaveBeenCalled();
    expect(f.scheduled.filter(item => item.name === "runtimeIngestion:processStage")).toHaveLength(1);
  });
  test("fresh revoked authority prevents recovery and keeps the real failed stage sticky", async () => {
    const f = await ingestionFixture(), event = await queued(f), ownedModel = model(); f.grant.revokedAt = Date.now();
    await worker(f, event.eventId, ownedModel);
    expect(stage(f, event.eventId)).toMatchObject({ state: "failed", failureCode: "INDEXING_ADMISSION_FAILED" });
    expect(stage(f, event.eventId).claimWait).toBeUndefined(); expect(ownedModel.extract).not.toHaveBeenCalled();
    const before = structuredClone(stage(f, event.eventId));
    await expect(f.call(ingestion.recoverClaim, { reference: f.reference, eventId: event.eventId, stage: "extract", failedClaimAt: clock })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    expect(stage(f, event.eventId)).toEqual(before);
  });
  test("a lost recovery response is idempotent and early duplicate wakes cannot bypass backoff", async () => {
    const f = await ingestionFixture(), event = await queued(f), invoke = f.ctx.runMutation.bind(f.ctx), ownedModel = model();
    let lost = false;
    f.ctx.runMutation = (async (ref, args) => {
      if (getFunctionName(ref) === "runtimeIngestion:claim") throw new ConvexError({ code: "CLAIM_TRANSPORT_UNKNOWN", outcome: "uncertain" });
      const result = await invoke(ref, args);
      if (getFunctionName(ref) === "runtimeIngestion:recoverClaim" && !lost) { lost = true; throw new Error("RECOVERY_RESPONSE_LOST"); }
      return result;
    }) as MutationCtx["runMutation"];
    await worker(f, event.eventId, ownedModel);
    expect(stage(f, event.eventId)).toMatchObject({ state: "pending", attempt: 1, claimWait: { wakes: 1, notBefore: clock + 250 } });
    expect(f.scheduled.filter(item => item.name === "runtimeIngestion:processStage")).toHaveLength(2);
    f.ctx.runMutation = invoke;
    await worker(f, event.eventId, ownedModel);
    expect(ownedModel.extract).not.toHaveBeenCalled(); expect(f.db.table("runtimeIngestionJobs")).toHaveLength(0);
    expect(stage(f, event.eventId)).toMatchObject({ state: "pending", attempt: 1, claimWait: { wakes: 1 } });
  });
  test("unconfirmed recovery cannot turn an uncertain claim into a manually retryable failure", async () => {
    const f = await ingestionFixture(), event = await queued(f), invoke = f.ctx.runMutation.bind(f.ctx), ownedModel = model();
    let recoveries = 0;
    f.ctx.runMutation = (async (ref, args) => {
      const name = getFunctionName(ref);
      if (name === "runtimeIngestion:claim") throw new Error("CLAIM_RESPONSE_UNKNOWN");
      if (name === "runtimeIngestion:recoverClaim") { recoveries++; throw new Error("RECOVERY_TRANSPORT_UNAVAILABLE"); }
      return await invoke(ref, args);
    }) as MutationCtx["runMutation"];
    await worker(f, event.eventId, ownedModel);
    expect(recoveries).toBe(3); expect(ownedModel.extract).not.toHaveBeenCalled();
    expect(stage(f, event.eventId)).toMatchObject({ state: "unknown", failureCode: "INDEXING_CLAIM_OUTCOME_UNKNOWN", attempt: 1 });
    await expect(f.call(ingestion.retry, { eventId: event.eventId, stage: "extract" })).rejects.toMatchObject({ data: { code: "RETRY_NOT_SAFE" } });
  });
  test.each(["claim", "capacity"])("%s wait first: combined waits cannot extend the earliest original lease", async first => {
    const f = await ingestionFixture(), event = await ingestion.enqueueSourceEvent(f.ctx, f.reference,
      await f.source("External assistant context", "combined-wait", 1, "assistant"));
    const ownedModel = model();
    if (first === "claim") {
      transientClaims(f, 1); await worker(f, event.eventId, ownedModel, "vectors");
    } else {
      await f.claim(event.eventId, "vectors");
      const row = stage(f, event.eventId, "vectors");
      await f.db.patch("runtimeIngestionStages", row._id, { state: "pending", capacityWait: {
        deadline: clock + 10000, notBefore: clock + 250, wakes: 1 }, leaseExpiresAt: clock + 10000 });
      transientClaims(f, 1); await worker(f, event.eventId, ownedModel, "vectors");
    }
    const row = stage(f, event.eventId, "vectors");
    // Controlled scheduling state models an already verified unreserved refusal;
    // the existing capacity tests separately exercise its financial proof.
    if (first === "claim") await f.db.patch("runtimeIngestionStages", row._id, { capacityWait: {
      deadline: clock + 10000, notBefore: clock + 250, wakes: 1 }, leaseExpiresAt: clock + 10000 });
    const before = structuredClone(stage(f, event.eventId, "vectors"));
    jest.spyOn(Date, "now").mockReturnValue(clock + 250);
    const owned = await f.claim(event.eventId, "vectors");
    expect(owned.attempt).toBe(1);
    expect(stage(f, event.eventId, "vectors").leaseExpiresAt).toBe(clock + 10000);
    expect(stage(f, event.eventId, "vectors").claimWait).toEqual(before.claimWait);
    expect(ownedModel.embed).not.toHaveBeenCalled(); expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
  });
  test("duplicate recovery at the final allowed wake remains idempotent and a real failed event stays failed", async () => {
    const f = await ingestionFixture(), event = await queued(f); transientClaims(f);
    let failedClaimAt = clock;
    for (let wake = 1; wake <= 4; wake++) {
      await worker(f, event.eventId);
      const wait = stage(f, event.eventId).claimWait as { notBefore: number; failedClaimAt: number };
      failedClaimAt = wait.failedClaimAt;
      jest.spyOn(Date, "now").mockReturnValue(wait.notBefore);
    }
    const before = structuredClone(stage(f, event.eventId)), scheduled = f.scheduled.length;
    await f.call(ingestion.recoverClaim, { reference: f.reference, eventId: event.eventId, stage: "extract", failedClaimAt });
    expect(stage(f, event.eventId)).toEqual(before); expect(f.scheduled).toHaveLength(scheduled);
    await f.call(ingestion.failUnclaimed, { reference: f.reference, eventId: event.eventId, stage: "extract" });
    const failed = structuredClone(stage(f, event.eventId));
    await f.call(ingestion.recoverClaim, { reference: f.reference, eventId: event.eventId, stage: "extract", failedClaimAt });
    expect(stage(f, event.eventId)).toEqual(failed);
    expect(failed).toMatchObject({ state: "failed", failureCode: "INDEXING_ADMISSION_FAILED" });
  });
});
