/** Real selected native backend; canonical writers, graph disabled, no LLM service. */
import { nativeAdmin, nativeTarget, nativeOperator, type NativeAdmin, operatorClient, operatorFunctionName, proofPrefix, publicFunctionName } from "./helpers/native-ci";
import { ConvexHttpClient, type ConvexClient } from "convex/browser";
import { makeFunctionReference, getFunctionName } from "convex/server";
import type { Id } from "../convex-dev/_generated/dataModel";
import type { FactRecord } from "../src/types";
import { FactsAPI } from "../src/facts";
import {
  FactHistoryService,
  HistoryWriteAfterCommitError,
  FactCommitOutcomeUnknownError,
  HistoryDeletePartialError,
} from "../src/facts/history";
import { convexToJson } from "convex/values";
import { canonical } from "../convex-dev/lib/factHistoryProvenance";
const prefix = proofPrefix("task18-repair3-ts-sdk");
const nativeClient = nativeOperator();
const admin = nativeAdmin();
const expected: Record<string, unknown> = { prefix };
const ref = (name: string) => makeFunctionReference<"mutation">(name);
const internal = <T = unknown>(name: string, args: Record<string, unknown>) =>
  admin.function(operatorFunctionName(name), undefined, args) as Promise<T>;
const sdk = (tenantId?: string, client: ConvexHttpClient = nativeClient) =>
  new FactsAPI(
    operatorClient(client) as unknown as ConvexClient,
    undefined,
    undefined,
    { userId: "actor", tenantId },
    undefined,
    { llmResolution: { enabled: false } },
  );
const history = (tenantId?: string, client: ConvexHttpClient = nativeClient) =>
  new FactHistoryService(operatorClient(client) as unknown as ConvexClient, undefined, {
    userId: "actor",
    tenantId,
  });
const seed = (
  space: string,
  factId: string,
  tenantId?: string,
  extra: Record<string, unknown> = {},
) =>
  internal<FactRecord>("ownedHistoryFixture:seedFact", {
    memorySpaceId: space,
    factId,
    tenantId,
    userId: "owner",
    ...extra,
  });
const get = (id: string) =>
  internal<FactRecord | null>("ownedHistoryFixture:source", { id });
async function rows(space: string, tenantId?: string) {
  const result = [];
  for await (const page of history(tenantId).pages({ memorySpaceId: space }))
    result.push(...page);
  return result;
}


describe("Task18 actual SDK retained histories and isolated physical lifecycle", () => {
  it("ordinary update and dedup update append one version each, then delete/reuse retains original chain", async () => {
    const space = prefix + "-versions",
      api = sdk("A");
    const original = await api.store({
      memorySpaceId: space,
      userId: "owner",
      fact: "Owner likes blue",
      factType: "preference",
      confidence: 40,
      sourceType: "manual",
      tags: [],
    });
    const foreign = await seed(space, original.factId, "B");
    const first = await api.update(
      space,
      original.factId,
      { confidence: 60 },
      { operationId: prefix + "-version", expectedSourceFactId: original._id },
    );
    const replay = await api.update(
      space,
      original.factId,
      { confidence: 60 },
      { operationId: prefix + "-version", expectedSourceFactId: original._id },
    );
    expect(replay._id).toBe(first._id);
    const dedup = await api.storeWithDedup(
      {
        memorySpaceId: space,
        userId: "owner",
        fact: "Owner likes blue",
        factType: "preference",
        confidence: 90,
        sourceType: "manual",
        tags: [],
      },
      { deduplication: "exact" },
    );
    expect(dedup.wasUpdated).toBe(true);
    expect(dedup.fact.version).toBe(3);
    expect(dedup.fact.supersedesEndpoint?.factDocumentId).toBe(first._id);
    const originals = [original._id, first._id, dedup.fact._id];
    expect(
      new Set(
        (
          await history("A").getSupersessionChain(original.factId, {
            memorySpaceId: space,
          })
        ).map((n) => n.sourceFactId),
      ),
    ).toEqual(new Set(originals));
    expect((await get(foreign._id))?.supersededBy).toBeUndefined();
    expect((await api.deleteMany({ memorySpaceId: space })).deleted).toBe(3);
    const replacement = await seed(space, original.factId, "A");
    const retained = await rows(space, "A");
    expect(new Set(retained.map((e) => e.sourceFactId))).toEqual(
      new Set(originals),
    );
    expect(retained.filter((e) => e.action === "DELETE")).toHaveLength(3);
    expect(
      retained.every(
        (e) =>
          e.scopeVersion === 1 &&
          e.tenantId === "A" &&
          e.ownerUserId === "owner",
      ),
    ).toBe(true);
    expect(
      retained.some(
        (e) =>
          e.sourceFactId === replacement._id || e.sourceFactId === foreign._id,
      ),
    ).toBe(false);
    expected.versions = {
      originals,
      replacement: replacement._id,
      foreign: foreign._id,
      eventIds: retained.map((e) => e.eventId),
    };
  });
  it("manual pair publishes actor separately, no third cloned fact, replay survives sources disappearing", async () => {
    const space = prefix + "-manual",
      api = sdk("A");
    const old = await seed(space, "fact-old", "A"),
      fresh = await seed(space, "fact-new", "A");
    const args = {
      memorySpaceId: space,
      oldFactId: old.factId,
      newFactId: fresh.factId,
      operationId: prefix + "-manual",
      reason: "original reason",
      expectedOldFactId: old._id as Id<"facts">,
      expectedNewFactId: fresh._id as Id<"facts">,
    };
    await api.supersede(args);
    expect((await get(old._id))?.supersededByEndpoint?.factDocumentId).toBe(
      fresh._id,
    );
    expect((await get(fresh._id))?.supersedesEndpoint?.factDocumentId).toBe(
      old._id,
    );
    const initial = await rows(space, "A");
    expect(initial).toHaveLength(2);
    expect(
      initial.every(
        (e) =>
          e.userId === "actor" &&
          e.ownerUserId === "owner" &&
          e.reason === "original reason",
      ),
    ).toBe(true);
    const stored = await internal<FactRecord[]>(
      "ownedHistoryFixture:factsInSpace",
      { memorySpaceId: space },
    );
    expect(stored).toHaveLength(2);
    await api.deleteMany({ memorySpaceId: space });
    await api.supersede(args);
    expect(
      (await rows(space, "A")).filter(
        (e) => e.operationId === args.operationId,
      ),
    ).toHaveLength(2);
    expected.manual = {
      originals: [old._id, fresh._id],
      eventIds: initial.map((e) => e.eventId),
    };
  });
  it("consolidate keeps real multiple predecessors and guards every source physical identity", async () => {
    const space = prefix + "-consolidate",
      api = sdk("A");
    const sources: FactRecord[] = [];
    for (const id of ["fact-k", "fact-p1", "fact-p2"])
      sources.push(await seed(space, id, "A"));
    const guards = sources.map((f) => ({
      factId: f.factId,
      factDocumentId: f._id as Id<"facts">,
    }));
    const args = {
      memorySpaceId: space,
      factIds: sources.map((f) => f.factId),
      keepFactId: sources[0].factId,
      operationId: prefix + "-consolidate",
      expectedFactIds: guards,
    };
    expect((await api.consolidate(args)).mergedCount).toBe(2);
    await api.consolidate(args);
    expect((await get(sources[0]._id))?.supersedes).toBeUndefined();
    expect((await get(sources[0]._id))?.confidence).toBe(70);
    for (const source of sources.slice(1))
      expect(
        (await get(source._id))?.supersededByEndpoint?.factDocumentId,
      ).toBe(sources[0]._id);
    expect(
      new Set(
        (
          await history("A").getSupersessionChain(sources[0].factId, {
            memorySpaceId: space,
          })
        ).map((n) => n.sourceFactId),
      ),
    ).toEqual(new Set(sources.map((f) => f._id)));
    await api.deleteMany({ memorySpaceId: space });
    const replacement = await seed(space, sources[0].factId, "A");
    const retained = await rows(space, "A");
    expect(
      retained.filter(
        (e) =>
          e.supersededByEndpoint?.factDocumentId === sources[0]._id &&
          e.operationKind === "consolidate",
      ),
    ).toHaveLength(2);
    expect(retained.some((e) => e.sourceFactId === replacement._id)).toBe(
      false,
    );
    expected.consolidate = {
      originals: sources.map((f) => f._id),
      replacement: replacement._id,
      eventIds: retained.map((e) => e.eventId),
    };
  });
  it("real lost response reconciles retained operation and never produces a second version", async () => {
    const space = prefix + "-lost";
    const original = await seed(space, "fact-old", "A");
    let dropped = false;
    const facade = {
      query: nativeClient.query.bind(nativeClient),
      mutation: async (
        reference: Parameters<typeof getFunctionName>[0],
        args: Record<string, unknown>,
      ) => {
        const result = await nativeClient.mutation(
          reference as never,
          args as never,
        );
        if (publicFunctionName(getFunctionName(reference)) === "facts:update" && !dropped) {
          dropped = true;
          throw new Error("response lost after native commit");
        }
        return result;
      },
    };
    const api = sdk("A", facade as unknown as ConvexHttpClient),
      operationId = prefix + "-lost";
    await expect(
      api.update(space, original.factId, { confidence: 90 }, { operationId }),
    ).rejects.toBeInstanceOf(FactCommitOutcomeUnknownError);
    const receipt = await history("A").getOperationReceipt(
      space,
      operationId,
      "update",
    );
    expect(receipt?.committed).toBe(true);
    expect(Object.isFrozen(receipt)).toBe(true);
    const retried = await api.update(
      space,
      original.factId,
      { confidence: 90 },
      { operationId },
    );
    expect(retried._id).toBe(receipt?.resultFactId);
    expect(
      await internal<FactRecord[]>("ownedHistoryFixture:factsInSpace", {
        memorySpaceId: space,
      }),
    ).toHaveLength(2);
  });
  it("postcommit publication failure carries original rich payload and history-only retry after deletion", async () => {
    const space = prefix + "-publish";
    const old = await seed(space, "fact-old", "A"),
      fresh = await seed(space, "fact-new", "A");
    const facade = {
      query: nativeClient.query.bind(nativeClient),
      mutation: async (
        reference: Parameters<typeof getFunctionName>[0],
        args: Record<string, unknown>,
      ) => {
        if (publicFunctionName(getFunctionName(reference)) === "factHistory:publishPendingEvent")
          throw new Error("publication unavailable");
        return nativeClient.mutation(reference as never, args as never);
      },
    };
    let failure: HistoryWriteAfterCommitError | undefined;
    try {
      await sdk("A", facade as unknown as ConvexHttpClient).supersede({
        memorySpaceId: space,
        oldFactId: old.factId,
        newFactId: fresh.factId,
        reason: "original pending",
        operationId: prefix + "-pending",
      });
    } catch (error) {
      if (error instanceof HistoryWriteAfterCommitError) failure = error;
      else throw error;
    }
    expect(failure?.committed).toBe(true);
    expect(failure?.receipt.events).toHaveLength(2);
    await sdk("A").deleteMany({ memorySpaceId: space });
    await history("A").retryHistory(failure!.receipt);
    await history("A").retryHistory(failure!.receipt);
    const published = (await rows(space, "A")).filter(
      (e) => e.reason === "original pending",
    );
    expect(published).toHaveLength(2);
    expect(
      published.every(
        (e) =>
          e.oldValue === old.fact &&
          e.newValue === fresh.fact &&
          e.ownerUserId === "owner" &&
          e.userId === "actor",
      ),
    ).toBe(true);
    const anchor = failure!.receipt.events[0];
    await expect(
      nativeClient.mutation(ref("factHistory:publishPendingEvent"), {
        tenantId: "A",
        memorySpaceId: space,
        operationId: prefix + "-pending",
        phase: "supersede",
        eventRole: anchor.pending!.payload.eventRole,
        eventId: anchor.eventId,
        pending: {
          ...anchor.pending!,
          absentFields: [...anchor.pending!.absentFields, "reason"],
        },
      }),
    ).rejects.toThrow("FACT_HISTORY_OPERATION_CONFLICT");
  });
  it("completes >1000 actual SDK events without truncation and keeps strict known tenantless default", async () => {
    const space = prefix + "-volume";
    const source = await seed(space, "fact-volume", "A"),
      foreign = await seed(space, "fact-volume", "B"),
      tenantless = await seed(space, "fact-volume");
    const h = history("A");
    for (let batch = 0; batch < 1051; batch += 8)
      await Promise.all(
        Array.from({ length: Math.min(8, 1051 - batch) }, (_, i) =>
          h.log({
            memorySpaceId: space,
            factId: source.factId,
            sourceFactId: source._id as Id<"facts">,
            action: "UPDATE",
            newValue: String(batch + i),
            userId: "actor",
          }),
        ),
      );
    await history("B").log({
      memorySpaceId: space,
      factId: foreign.factId,
      action: "UPDATE",
      userId: "actor",
    });
    await history().log({
      memorySpaceId: space,
      factId: tenantless.factId,
      action: "UPDATE",
      userId: "actor",
    });
    const own = await rows(space, "A");
    expect(own).toHaveLength(1051);
    expect(new Set(own.map((e) => e.eventId)).size).toBe(1051);
    expect(own.every((e) => e.sourceFactId === source._id)).toBe(true);
    expect((await h.countByAction(space)).total).toBe(1051);
    expect((await rows(space)).map((e) => e.sourceFactId)).toEqual([
      tenantless._id,
    ]);
    const removed = await h.deleteByMemorySpace(space).catch((error: unknown) => {
      if (error instanceof HistoryDeletePartialError) {
        const nested = error.originalCause as { originalCause?: unknown };
        throw new Error(
          `Volume history deletion failed after ${error.deleted}: ${String(error.originalCause)}; native cause: ${String(nested?.originalCause)}`,
          { cause: error },
        );
      }
      throw error;
    });
    expect(removed.deleted).toBe(1051);
    expect(await rows(space, "A")).toEqual([]);
    expect(await rows(space, "B")).toHaveLength(1);
    expected.volume = {
      source: source._id,
      foreign: foreign._id,
      tenantless: tenantless._id,
      eventIds: own.map((e) => e.eventId),
      count: 1051,
    };
  }, 180000);
  it("whole-call native counters enforce near-document/write/encoded budgets and roll back generated clone on overflow", async () => {
    const space = prefix + "-budgets";
    const source = await seed(space, "fact-fit", "A", {
      fact: "x".repeat(180000),
    });
    const measured = await internal<{
      value: FactRecord;
      native: {
        documentsRead: { used: number };
        bytesRead: { used: number };
        bytesWritten: { used: number };
      };
    }>("ownedHistoryFixture:measureWriter", {
      operation: "update",
      input: {
        memorySpaceId: space,
        tenantId: "A",
        factId: source.factId,
        confidence: 90,
        operationId: prefix + "-fit",
      },
    });
    // Whole-call native reads include current ownership and lifecycle hooks.
    // The guarded writer independently enforces its provenance CaptureBudget.
    expect(measured.native.documentsRead.used).toBeLessThanOrEqual(128);
    expect(measured.native.bytesRead.used).toBeLessThanOrEqual(
      12 * 1024 * 1024,
    );
    expect(measured.native.bytesWritten.used).toBeLessThanOrEqual(
      3 * 1024 * 1024,
    );
    expect(Buffer.byteLength(canonical(measured.value))).toBeLessThanOrEqual(
      8 * 1024 * 1024,
    );
    await new Promise((resolve) => setTimeout(resolve, 1100)); // Native owned fixture has a 4MiB/s write ceiling.
    const hugeSpace = prefix + "-overflow";
    const huge = await seed(hugeSpace, "fact-huge", "A", {
      fact: "x".repeat(300000),
    });
    await expect(
      nativeClient.mutation(ref("facts:update"), {
        memorySpaceId: hugeSpace,
        tenantId: "A",
        factId: huge.factId,
        confidence: 95,
        operationId: prefix + "-overflow",
      }),
    ).rejects.toThrow("FACT_HISTORY_BUDGET_EXCEEDED");
    expect(
      await internal<FactRecord[]>("ownedHistoryFixture:factsInSpace", {
        memorySpaceId: hugeSpace,
      }),
    ).toHaveLength(1);
    expect((await get(huge._id))?.supersededBy).toBeUndefined();
    expect(await rows(hugeSpace, "A")).toEqual([]);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const deleteSpace = prefix + "-delete-overflow";
    const deleteHuge = await seed(deleteSpace, "fact-delete-huge", "A", {
      fact: "x".repeat(900000),
    });
    await expect(
      sdk("A").deleteMany({ memorySpaceId: deleteSpace }),
    ).rejects.toThrow();
    expect(await get(deleteHuge._id)).not.toBeNull();
    expect(await rows(deleteSpace, "A")).toEqual([]);
    expected.budgets = {
      source: source._id,
      result: measured.value._id,
      native: measured.native,
      huge: huge._id,
      argumentEncodedBytes: Buffer.byteLength(
        canonical({ fact: "x".repeat(180000) }),
      ),
      resultEncodedBytes: Buffer.byteLength(canonical(measured.value)),
      atomicOverflowRollback: true,
    };
  });
});

describe("Task18 native provenance source closure, finite all-source proof and negatives", () => {
  it("captures exact original space/memory/conversation physical IDs and joint association with complete native counters", async () => {
    const space = prefix + "-origins";
    const origin = await internal<{
      space: Id<"memorySpaces">;
      conversation: string;
      memory: string;
      memoryId: string;
      conversationId: string;
    }>("ownedHistoryFixture:seedOrigins", {
      memorySpaceId: space,
      tenantId: "A",
      logicalId: "same",
      bytes: 750000,
    });
    const foreign = await internal<{ conversation: string; memory: string }>(
      "ownedHistoryFixture:seedOrigins",
      { memorySpaceId: space, tenantId: "B", logicalId: "same", bytes: 1 },
    );
    const source = await seed(space, "fact-origin", "A", {
      userId: undefined,
      sourceRef: {
        memoryId: origin.memoryId,
        conversationId: origin.conversationId,
      },
    });
    const measured = await internal<{
      value: FactRecord;
      native: {
        documentsRead: { used: number };
        bytesRead: { used: number };
        bytesWritten: { used: number };
      };
    }>("ownedHistoryFixture:measureWriter", {
      operation: "update",
      input: {
        memorySpaceId: space,
        tenantId: "A",
        factId: source.factId,
        confidence: 90,
        operationId: prefix + "-origin",
      },
    });
    expect(measured.native.documentsRead.used).toBeLessThanOrEqual(192);
    expect(measured.native.bytesRead.used).toBeLessThanOrEqual(
      12 * 1024 * 1024,
    );
    expect(measured.native.bytesRead.used).toBeGreaterThan(1400000);
    const events = await rows(space, "A");
    expect(events).toHaveLength(2);
    for (const event of events) {
      expect(event.sourceMemorySpaceId).toBe(origin.space);
      expect(event.sourceMemoryId).toBe(origin.memory);
      expect(event.sourceConversationId).toBe(origin.conversation);
      expect(event.associatedUserIds).toEqual(["collaborator", "target"]);
      expect(event.ownerKnown).toBe(true);
      expect(event.ownerUserId).toBeUndefined();
      expect(event.sourceMemoryId).not.toBe(foreign.memory);
    }
    const physical = [];
    for await (const page of history("A").pages({
      sourceMemorySpaceId: origin.space,
      memorySpaceId: space,
    }))
      physical.push(...page);
    expect(physical.map((e) => e.eventId).sort()).toEqual(
      events.map((e) => e.eventId).sort(),
    );
    expected.origins = {
      origin,
      foreign,
      source: source._id,
      result: measured.value._id,
      native: measured.native,
      eventIds: events.map((e) => e.eventId),
    };
  });
  it("an explicitly foreign-owned source memory cannot infer conversation participants as fact association", async () => {
    const space = prefix + "-foreign-memory";
    const origin = await internal<{ memoryId: string; conversationId: string }>(
      "ownedHistoryFixture:seedOrigins",
      {
        memorySpaceId: space,
        tenantId: "A",
        logicalId: "foreign",
        memoryOwner: "foreign-owner",
      },
    );
    const fact = await seed(space, "fact-unowned", "A", {
      userId: undefined,
      sourceRef: { memoryId: origin.memoryId },
    });
    await history("A").log({
      memorySpaceId: space,
      factId: fact.factId,
      action: "UPDATE",
    });
    const event = (await rows(space, "A"))[0];
    expect(event.associatedUserIds).toEqual(["foreign-owner"]);
    expect(event.sourceConversationId).toBeUndefined();
  });
  it("preflights the complete legacy candidate set before deletion and refuses public missing-source audit reconstruction", async () => {
    const space = prefix + "-legacy";
    const source = await seed(space, "fact-legacy", "A");
    await history("A").log({
      memorySpaceId: space,
      factId: source.factId,
      action: "UPDATE",
      userId: "actor",
    });
    const ledger = await internal<{
      eventDocumentId: string;
      snapshot: Record<string, unknown>;
    }>("ownedHistoryFixture:seedLegacy", {
      sourceFactId: source._id,
      userId: "actor",
    });
    await expect(history("A").deleteByMemorySpace(space)).rejects.toThrow();
    await expect(
      new ConvexHttpClient(nativeTarget().url).mutation(ref("factHistory:migrateEvidence"), {
        ...ledger,
        dryRun: false,
      }),
    ).rejects.toThrow("Could not find public function");
    const dry = await internal<{ changed: boolean }>(
      "factHistory:migrateEvidence",
      { ...ledger, dryRun: true },
    );
    expect(dry.changed).toBe(false);
    await internal("ownedHistoryFixture:removeSources", { ids: [source._id] });
    const replacement = await seed(space, source.factId, "B");
    await expect(
      history("A").log({
        memorySpaceId: space,
        factId: source.factId,
        action: "DELETE",
      }),
    ).rejects.toThrow("FACT_HISTORY_SOURCE_REQUIRED");
    await internal("factHistory:migrateEvidence", { ...ledger, dryRun: false });
    const retained = await rows(space, "A");
    expect(retained).toHaveLength(2);
    expect(retained.every((e) => e.sourceFactId === source._id)).toBe(true);
    expect(retained.some((e) => e.sourceFactId === replacement._id)).toBe(
      false,
    );
    await expect(
      internal("factHistory:migrateEvidence", {
        ...ledger,
        snapshot: { ...ledger.snapshot, ownerUserId: "contradiction" },
        dryRun: false,
      }),
    ).rejects.toThrow("FACT_HISTORY_MIGRATION_CONFLICT");
    expected.legacy = {
      original: source._id,
      replacement: replacement._id,
      ledger,
      eventIds: retained.map((e) => e.eventId),
      preflightNoWrites: true,
    };
  });
  it("wrong physical sources, duplicate identity, unknown links, excessive consolidation and capture failure cause no writer effects", async () => {
    const space = prefix + "-negative";
    const a = await seed(space, "fact-a", "A"),
      b = await seed(space, "fact-b", "A"),
      foreign = await seed(space, "fact-a", "B");
    await expect(
      sdk("A").update(
        space,
        a.factId,
        { confidence: 90 },
        { expectedSourceFactId: foreign._id },
      ),
    ).rejects.toThrow("FACT_HISTORY_SOURCE_MISMATCH");
    await expect(
      sdk("A").supersede({
        memorySpaceId: space,
        oldFactId: a.factId,
        newFactId: b.factId,
        expectedOldFactId: b._id as Id<"facts">,
      }),
    ).rejects.toThrow("FACT_HISTORY_SOURCE_MISMATCH");
    await expect(
      nativeClient.mutation(ref("facts:consolidate"), {
        memorySpaceId: space,
        tenantId: "A",
        factIds: [a.factId, b.factId, "fact-c", "fact-d"],
        keepFactId: a.factId,
      }),
    ).rejects.toThrow("FACT_HISTORY_CONSOLIDATION_BUDGET");
    const duplicate = await seed(space, a.factId, "A");
    await expect(
      sdk("A").update(space, a.factId, { confidence: 90 }),
    ).rejects.toThrow("FACT_HISTORY_SOURCE_AMBIGUOUS");
    const unknown = await seed(space, "fact-unknown", "A", {
      supersedes: "logical-never-evidenced",
    });
    await expect(
      sdk("A").update(space, unknown.factId, { confidence: 90 }),
    ).rejects.toThrow("FACT_HISTORY_RELATIONSHIP_UNRESOLVED");
    expect((await get(a._id))?.supersededBy).toBeUndefined();
    expect((await get(b._id))?.supersedes).toBeUndefined();
    expect(await rows(space, "A")).toEqual([]);
    const captureSpace = prefix + "-capture-rollback";
    const p = await seed(captureSpace, "fact-p", "A"),
      q = await seed(captureSpace, "fact-q", "A");
    await internal("ownedHistoryFixture:duplicateSpace", {
      memorySpaceId: captureSpace,
      tenantId: "A",
    });
    await internal("ownedHistoryFixture:duplicateSpace", {
      memorySpaceId: captureSpace,
      tenantId: "A",
    });
    await expect(
      sdk("A").supersede({
        memorySpaceId: captureSpace,
        oldFactId: p.factId,
        newFactId: q.factId,
      }),
    ).rejects.toThrow("FACT_HISTORY_SOURCE_AMBIGUOUS");
    expect((await get(p._id))?.supersededBy).toBeUndefined();
    expect((await get(q._id))?.supersedes).toBeUndefined();
    expect(await rows(captureSpace, "A")).toEqual([]);
    await expect(
      sdk("A").deleteMany({ memorySpaceId: captureSpace }),
    ).rejects.toThrow();
    expect(await get(p._id)).not.toBeNull();
    expect(await get(q._id)).not.toBeNull();
    expect(await rows(captureSpace, "A")).toEqual([]);
    expected.negatives = {
      a: a._id,
      b: b._id,
      foreign: foreign._id,
      duplicate: duplicate._id,
      unknown: unknown._id,
      capturePair: [p._id, q._id],
      atomicRollback: true,
    };
  });
});

describe("Task18 all-source consolidation native read proof", () => {
  it("measures three distinct direct source tuples in one native transaction without recursive expansion", async () => {
    const space = prefix + "-three-proof",
      sources: FactRecord[] = [];
    for (let i = 0; i < 3; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1100));
      const origin = await internal<{
        memoryId: string;
        conversationId: string;
      }>("ownedHistoryFixture:seedOrigins", {
        memorySpaceId: space,
        tenantId: "A",
        logicalId: String(i),
        bytes: 250000,
        registerSpace: i === 0,
      });
      sources.push(
        await seed(space, "fact-proof-" + i, "A", {
          userId: undefined,
          sourceRef: {
            memoryId: origin.memoryId,
            conversationId: origin.conversationId,
          },
        }),
      );
    }
    const input = {
      memorySpaceId: space,
      tenantId: "A",
      factIds: sources.map((f) => f.factId),
      keepFactId: sources[0].factId,
      operationId: prefix + "-three-proof",
      expectedFactIds: sources.map((f) => ({
        factId: f.factId,
        factDocumentId: f._id,
      })),
    };
    const measured = await internal<{
      value: { historyReceipt: unknown };
      native: {
        documentsRead: { used: number };
        bytesRead: { used: number };
        bytesWritten: { used: number };
      };
    }>("ownedHistoryFixture:measureWriter", {
      operation: "consolidate",
      input,
    });
    expect(measured.native.documentsRead.used).toBeLessThanOrEqual(256);
    expect(measured.native.bytesRead.used).toBeGreaterThan(4400000);
    expect(measured.native.bytesRead.used).toBeLessThanOrEqual(
      12 * 1024 * 1024,
    );
    expect(measured.native.bytesWritten.used).toBeLessThanOrEqual(
      3 * 1024 * 1024,
    );
    expect(await rows(space, "A")).toHaveLength(3);
    expected.threeSourceProof = {
      originals: sources.map((f) => f._id),
      native: measured.native,
      encodedReceiptBytes: Buffer.byteLength(canonical(measured.value)),
      encodedArgumentBytes: Buffer.byteLength(canonical(input)),
    };
  });
});

describe("Task18 native directed traversal and legacy consumers", () => {
  it("appends a twelve-version chain with bounded per-operation proof, and rejects a stored directed cycle", async () => {
    const space = prefix + "-deep",
      api = sdk("A");
    const first = await seed(space, "fact-deep", "A");
    const originals = [first._id];
    let last = first;
    for (let i = 0; i < 11; i++) {
      last = await api.update(
        space,
        last.factId,
        { confidence: 60 + i },
        { expectedSourceFactId: last._id, operationId: prefix + "-deep-" + i },
      );
      originals.push(last._id);
    }
    const chain = await history("A").getSupersessionChain(first.factId, {
      memorySpaceId: space,
    });
    expect(new Set(chain.map((n) => n.sourceFactId))).toEqual(
      new Set(originals),
    );
    expect(chain).toHaveLength(12);
    const cycleSpace = prefix + "-cycle";
    const cycle = await internal<{ ids: string[]; logical: string }>(
      "ownedHistoryFixture:seedCycle",
      { memorySpaceId: cycleSpace, tenantId: "A" },
    );
    await expect(
      history("A").getSupersessionChain(cycle.logical, {
        memorySpaceId: cycleSpace,
      }),
    ).rejects.toThrow("FACT_HISTORY_RELATIONSHIP_CYCLE");
    const selfSpace = prefix + "-self";
    const self = await seed(selfSpace, "fact-self", "A");
    await expect(
      api.supersede({
        memorySpaceId: selfSpace,
        oldFactId: self.factId,
        newFactId: self.factId,
      }),
    ).rejects.toThrow("FACT_HISTORY_RELATIONSHIP_CONFLICT");
    expect(await rows(selfSpace, "A")).toEqual([]);
    expected.deep = {
      originals,
      eventIds: (await rows(space, "A")).map((e) => e.eventId),
      cycle,
    };
  });
  it("all legacy named queries still return arrays with exact ordinary filters", async () => {
    const space = prefix + "-legacy-arrays",
      api = sdk("A");
    const own = await api.store({
      memorySpaceId: space,
      userId: "owner",
      fact: "Scoped array",
      factType: "custom",
      subject: "user",
      predicate: "works at",
      object: "Cortex",
      confidence: 90,
      sourceType: "manual",
      tags: ["selected"],
    });
    await new FactsAPI(
      nativeClient as unknown as ConvexClient,
      undefined,
      undefined,
      { userId: "owner", tenantId: "B" },
    ).store({
      memorySpaceId: space,
      userId: "owner",
      fact: "Foreign array",
      factType: "custom",
      subject: "user",
      confidence: 95,
      sourceType: "manual",
      tags: ["selected"],
    });
    const query = (name: string, args: Record<string, unknown>) =>
      nativeClient.query(makeFunctionReference<"query">(name), args);
    const list = await query("facts:list", {
      memorySpaceId: space,
      tenantId: "A",
    });
    const subject = await query("facts:queryBySubject", {
      memorySpaceId: space,
      tenantId: "A",
      subject: "user",
      tags: ["selected"],
      tagMatch: "all",
      minConfidence: 85,
      sortBy: "confidence",
      sortOrder: "desc",
      limit: 1,
      offset: 0,
    });
    const structure = await query("facts:findByStructure", {
      memorySpaceId: space,
      tenantId: "A",
      subject: "user",
      predicate: "works at",
      object: "Cortex",
      limit: 1,
    });
    for (const result of [list, subject, structure]) {
      expect(Array.isArray(result)).toBe(true);
      expect((result as FactRecord[]).map((f) => f._id)).toEqual([own._id]);
    }
    expect(
      await query("facts:queryBySubject", {
        memorySpaceId: space,
        tenantId: "A",
        subject: "user",
        tags: ["wrong"],
      }),
    ).toEqual([]);
  });
});

describe("Task18 repair1 independent scope, migration and endpoint regressions", () => {
  it("retains resolved per-call tenant through all physical chain pages including deleted and reused originals", async () => {
    const prior = expected as { prefix: string; versions: { originals: string[] } };
    const space = prior.prefix + "-versions";
    const initial = (await rows(space, "A")).find(
      (e) => e.sourceFactId === prior.versions.originals[0],
    )!;
    for (const h of [history("A"), history()]) {
      const chain = await h.getSupersessionChain(initial.factId, {
        tenantId: "A",
        memorySpaceId: space,
      });
      expect(new Set(chain.map((e) => e.sourceFactId))).toEqual(
        new Set(prior.versions.originals),
      );
    }
    const fresh = prefix + "-scope-repair",
      ids: Record<string, string> = {};
    for (const tenant of ["A", "B", undefined]) {
      const fact = await seed(fresh, "fact-scope", tenant);
      ids[tenant ?? "none"] = fact._id;
      await history(tenant).log({
        memorySpaceId: fresh,
        factId: fact.factId,
        action: "UPDATE",
      });
    }
    for (const tenant of ["A", "B", undefined]) {
      const expectedId = ids[tenant ?? "none"];
      expect(
        (
          await history(tenant).getSupersessionChain("fact-scope", {
            memorySpaceId: fresh,
          })
        ).map((e) => e.sourceFactId),
      ).toEqual([expectedId]);
      expect(
        (
          await history().getSupersessionChain("fact-scope", {
            tenantId: tenant,
            memorySpaceId: fresh,
          })
        ).map((e) => e.sourceFactId),
      ).toEqual([expectedId]);
    }
    await expect(
      history("A").getSupersessionChain("fact-scope", {
        tenantId: "B",
        memorySpaceId: fresh,
      }),
    ).rejects.toThrow("FACT_HISTORY_SCOPE_MISMATCH");
    expected.repairScope = {
      priorOriginals: prior.versions.originals,
      ids,
      perCallAndContextExact: true,
    };
  });
  it("migration validates every supplied surviving physical origin and endpoint before dry-run or apply", async () => {
    const space = prefix + "-migration-repair";
    type Origins = {
      space: string;
      memory: string;
      conversation: string;
      memoryId: string;
      conversationId: string;
    };
    const origin = await internal<Origins>("ownedHistoryFixture:seedOrigins", {
      memorySpaceId: space,
      tenantId: "A",
      logicalId: "ledger",
      bytes: 750000,
    });
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const unrelated = await internal<Origins>(
      "ownedHistoryFixture:seedOrigins",
      {
        memorySpaceId: space + "-unrelated",
        tenantId: "A",
        logicalId: "ledger",
      },
    );
    const foreign = await internal<Origins>("ownedHistoryFixture:seedOrigins", {
      memorySpaceId: space,
      tenantId: "B",
      logicalId: "ledger",
    });
    const wrongLogical = await internal<Origins>(
      "ownedHistoryFixture:seedOrigins",
      {
        memorySpaceId: space,
        tenantId: "A",
        logicalId: "different",
        registerSpace: false,
      },
    );
    const source = await internal<FactRecord>("ownedHistoryFixture:seedFact", {
      memorySpaceId: space,
      tenantId: "A",
      factId: "fact-source",
      sourceRef: {
        memoryId: origin.memoryId,
        conversationId: origin.conversationId,
        messageIds: ["message"],
      },
    });
    const foreignSource = await internal<FactRecord>(
      "ownedHistoryFixture:seedFact",
      {
        memorySpaceId: space,
        tenantId: "B",
        factId: source.factId,
        sourceRef: {
          memoryId: origin.memoryId,
          conversationId: origin.conversationId,
          messageIds: ["message"],
        },
      },
    );
    const previous = await seed(space, "fact-previous", "A"),
      next = await seed(space, "fact-next", "A"),
      foreignEndpoint = await seed(space, previous.factId, "B");
    await internal("ownedHistoryFixture:configureLedgerRelationships", {
      id: source._id,
      previous: previous._id,
      next: next._id,
    });
    const ledger = await internal<{
      eventDocumentId: string;
      snapshot: Record<string, unknown>;
    }>("ownedHistoryFixture:seedLegacy", {
      sourceFactId: source._id,
      userId: "actor",
    });
    const original = await internal("ownedHistoryFixture:historyDocument", {
      id: ledger.eventDocumentId,
    });
    const ep = ledger.snapshot.supersedesEndpoint as Record<string, unknown>;
    const conflicts = [
      { sourceFactId: foreignSource._id },
      { sourceFactId: next._id },
      { ownerUserId: "forged" },
      { sourceRef: { memoryId: "memory-forged" } },
      { sourceMemorySpaceId: unrelated.space },
      { sourceMemorySpaceId: foreign.space },
      { sourceMemoryId: foreign.memory },
      { sourceMemoryId: wrongLogical.memory },
      { sourceConversationId: foreign.conversation },
      { sourceConversationId: wrongLogical.conversation },
      { associatedUserIds: ["forged"] },
      { associationKnown: false },
      { supersedesEndpoint: { ...ep, factDocumentId: source._id } },
      { supersedesEndpoint: { ...ep, factDocumentId: foreignEndpoint._id } },
      { supersedesEndpoint: { ...ep, factDocumentId: next._id } },
      { supersedesEndpoint: { ...ep, tenantId: "B" } },
      { supersededByEndpoint: { state: "absent" } },
    ];
    for (const contradiction of conflicts)
      for (const dryRun of [true, false]) {
        await expect(
          internal("factHistory:migrateEvidence", {
            ...ledger,
            snapshot: { ...ledger.snapshot, ...contradiction },
            dryRun,
          }),
        ).rejects.toThrow("FACT_HISTORY_");
        expect(
          await internal("ownedHistoryFixture:historyDocument", {
            id: ledger.eventDocumentId,
          }),
        ).toEqual(original);
      }
    const wrong = new ConvexHttpClient(
      nativeTarget().url,
    ) as ConvexHttpClient & NativeAdmin;
    wrong.setAdminAuth("task18-wrong-key");
    await expect(
      (new ConvexHttpClient(nativeTarget().url) as ConvexHttpClient & NativeAdmin).function(
        operatorFunctionName("factHistory:migrateEvidence"),
        undefined,
        { ...ledger, dryRun: true },
      ),
    ).rejects.toThrow();
    await expect(
      wrong.function(operatorFunctionName("factHistory:migrateEvidence"), undefined, {
        ...ledger,
        dryRun: true,
      }),
    ).rejects.toThrow();
    const measured = await internal<{
      value: { changed: boolean };
      native: {
        documentsRead: { used: number };
        bytesRead: { used: number };
        bytesWritten: { used: number };
      };
    }>("ownedHistoryFixture:measureMigration", {
      input: { ...ledger, dryRun: true },
    });
    expect(measured.value.changed).toBe(false);
    expect(measured.native.documentsRead.used).toBeLessThanOrEqual(16);
    expect(measured.native.bytesRead.used).toBeGreaterThan(1400000);
    expect(measured.native.bytesRead.used).toBeLessThanOrEqual(
      12 * 1024 * 1024,
    );
    expect(
      await internal("factHistory:migrateEvidence", {
        ...ledger,
        dryRun: false,
      }),
    ).toEqual({ changed: true, dryRun: false });
    expect(
      await internal("factHistory:migrateEvidence", {
        ...ledger,
        dryRun: false,
      }),
    ).toEqual({ changed: false, dryRun: false });
    const migrated = await rows(space, "A");
    expect(migrated).toHaveLength(1);
    expect(migrated[0].sourceFactId).toBe(source._id);
    expect(migrated[0].sourceMemoryId).toBe(origin.memory);
    expect(migrated[0].sourceConversationId).toBe(origin.conversation);
    // First apply after every original has vanished still uses the trusted creation ledger.
    const deletedLedger = await internal<{
      eventDocumentId: string;
      snapshot: Record<string, unknown>;
    }>("ownedHistoryFixture:seedLegacy", {
      sourceFactId: source._id,
      userId: "actor",
    });
    await internal("ownedHistoryFixture:removeSources", {
      ids: [source._id, previous._id, next._id],
    });
    await internal("ownedHistoryFixture:removeOrigins", {
      space: origin.space,
      memory: origin.memory,
      conversation: origin.conversation,
    });
    const replacement = await seed(space, source.factId, "A");
    expect(
      await internal("factHistory:migrateEvidence", {
        ...deletedLedger,
        dryRun: true,
      }),
    ).toEqual({ changed: false, dryRun: true });
    expect(
      await internal("factHistory:migrateEvidence", {
        ...deletedLedger,
        dryRun: false,
      }),
    ).toEqual({ changed: true, dryRun: false });
    expect(
      await internal("factHistory:migrateEvidence", {
        ...deletedLedger,
        dryRun: false,
      }),
    ).toEqual({ changed: false, dryRun: false });
    expect((await rows(space, "A")).map((e) => e.sourceFactId)).toEqual([
      source._id,
      source._id,
    ]);
    expect(
      await internal("factHistory:migrateEvidence", {
        ...ledger,
        dryRun: true,
      }),
    ).toEqual({ changed: false, dryRun: true });
    expected.repairMigration = {
      ledger,
      deletedLedger,
      replacement: replacement._id,
      origin,
      contradictions: conflicts.length,
      zeroEffects: true,
      native: measured.native,
      deletedOriginalLedgerReplay: true,
    };
  });
  it("malformed saved endpoint states cannot overwrite occupied raw relationships in any retained writer", async () => {
    const outcomes = [];
    for (const direction of ["supersedes", "supersededBy"] as const)
      for (const mode of [
        "populatedAbsent",
        "missingKnown",
        "missingUnknown",
        "knownMismatch",
        "unknownMismatch",
      ] as const)
        for (const operation of [
          "update",
          "supersede",
          "consolidate",
        ] as const) {
          const space =
            prefix + "-malformed-" + direction + "-" + mode + "-" + operation;
          const a = await seed(space, "fact-old", "A"),
            b = await seed(space, "fact-new", "A");
          await internal("ownedHistoryFixture:malformRelationship", {
            id: a._id,
            target: b._id,
            direction,
            mode,
          });
          const beforeA = await get(a._id),
            beforeB = await get(b._id);
          const input =
            operation === "update"
              ? {
                  memorySpaceId: space,
                  tenantId: "A",
                  factId: a.factId,
                  confidence: 99,
                }
              : operation === "supersede"
                ? {
                    memorySpaceId: space,
                    tenantId: "A",
                    oldFactId: a.factId,
                    newFactId: b.factId,
                  }
                : {
                    memorySpaceId: space,
                    tenantId: "A",
                    factIds: [a.factId, b.factId],
                    keepFactId: b.factId,
                  };
          await expect(
            nativeClient.mutation(ref("facts:" + operation), input),
          ).rejects.toThrow("FACT_HISTORY_RELATIONSHIP_CONFLICT");
          expect(await get(a._id)).toEqual(beforeA);
          expect(await get(b._id)).toEqual(beforeB);
          expect(await rows(space, "A")).toEqual([]);
          expect(
            (
              await internal<FactRecord[]>("ownedHistoryFixture:factsInSpace", {
                memorySpaceId: space,
              })
            )
              .map((f) => f._id)
              .sort(),
          ).toEqual([a._id, b._id].sort());
          outcomes.push({ direction, mode, operation, ids: [a._id, b._id] });
        }
    expected.repairMalformed = { outcomes, allZeroEffects: true };
  });
});

describe("Task18 repair2 complete public histories and honest phase receipts", () => {
  it("public histories retain live2 and consolidate3 exact physical vertices in A/B/tenantless and refuse deleted/reused originals", async () => {
    const space = prefix + "-public-history",
      logical = "fact-public-original";
    const scopeResults = [];
    for (const tenantId of ["A", "B", undefined]) {
      const first = await seed(space, logical, tenantId);
      const second = await sdk(tenantId).update(
        space,
        logical,
        { confidence: 91 },
        {
          operationId: prefix + "-public-" + (tenantId ?? "none"),
          expectedSourceFactId: first._id,
        },
      );
      const ids = new Set([first._id, second._id]);
      expect(
        new Set(
          (await sdk(tenantId).getHistory(space, logical)).map((f) => f._id),
        ),
      ).toEqual(ids);
      expect(
        new Set(
          (await sdk().getHistory(space, logical, { tenantId })).map(
            (f) => f._id,
          ),
        ),
      ).toEqual(ids);
      scopeResults.push({ tenantId: tenantId ?? null, ids: [...ids] });
    }
    await expect(
      sdk("A").getHistory(space, logical, { tenantId: "B" }),
    ).rejects.toThrow("SCOPE_MISMATCH");
    const consolidateSpace = prefix + "-public-consolidate";
    const inputs = await Promise.all(
      [1, 2, 3].map((i) =>
        seed(consolidateSpace, "fact-public-consolidate-" + i, "A"),
      ),
    );
    await sdk("A").consolidate({
      memorySpaceId: consolidateSpace,
      factIds: inputs.map((f) => f.factId),
      keepFactId: inputs[0].factId,
      operationId: prefix + "-public-consolidate",
    });
    expect(
      new Set(
        (await sdk("A").getHistory(consolidateSpace, inputs[0].factId)).map(
          (f) => f._id,
        ),
      ),
    ).toEqual(new Set(inputs.map((f) => f._id)));
    await internal("ownedHistoryFixture:removeSources", {
      ids: [inputs[1]._id],
    });
    const replacement = await seed(consolidateSpace, inputs[1].factId, "A");
    await expect(
      sdk("A").getHistory(consolidateSpace, inputs[0].factId),
    ).rejects.toThrow("FACT_HISTORY_");
    expect(
      new Set(
        (
          await history("A").getSupersessionChain(inputs[0].factId, {
            memorySpaceId: consolidateSpace,
          })
        ).map((n) => n.sourceFactId),
      ),
    ).toEqual(new Set(inputs.map((f) => f._id)));
    const purgedSpace = prefix + "-public-purged-audit";
    const purgedFirst = await seed(purgedSpace, "fact-purged-original", "A");
    await sdk("A").update(purgedSpace, purgedFirst.factId, { confidence: 80 });
    await history("A").deleteByMemorySpace(purgedSpace);
    await expect(
      sdk("A").getHistory(purgedSpace, purgedFirst.factId),
    ).rejects.toThrow("RELATIONSHIP_UNRESOLVED");
    expected.repair2Public = {
      space,
      logical,
      scopes: scopeResults,
      consolidation: {
        space: consolidateSpace,
        originals: inputs.map((f) => f._id),
        replacement: replacement._id,
        refusedIncompleteLegacyShape: true,
      },
    };
  });
  it("NONE log transport failure is typed noncommitted decision_log and forwards original conversation context without fact writes", async () => {
    const space = prefix + "-none-log";
    const original = await sdk("A").store({
      memorySpaceId: space,
      fact: "User likes blue",
      factType: "preference",
      confidence: 90,
      sourceType: "manual",
      userId: "owner",
      subject: "person",
      tags: [],
    });
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const client = {
      query: nativeClient.query.bind(nativeClient),
      mutation: async (
        fn: Parameters<typeof getFunctionName>[0],
        args: Record<string, unknown>,
      ) => {
        calls.push({ name: publicFunctionName(getFunctionName(fn)), args });
        throw new Error("decision history unavailable");
      },
    };
    await expect(
      sdk("A", client as unknown as ConvexHttpClient).revise({
        memorySpaceId: space,
        userId: "owner",
        sourceRef: { conversationId: "original-decision-context" },
        fact: {
          fact: original.fact,
          factType: "preference",
          subject: "person",
          confidence: 50,
        },
      }),
    ).rejects.toMatchObject({
      name: "DecisionLogError",
      committed: false,
      phase: "decision_log",
    });
    expect(calls.map((c) => c.name)).toEqual(["factHistory:logEvent"]);
    expect(calls[0].args.conversationId).toBe("original-decision-context");
    expect(await get(original._id)).toEqual(original);
    expect(await rows(space, "A")).toEqual([]);
    expected.repair2None = {
      space,
      original: original._id,
      calls: calls.map((c) => c.name),
      conversationContext: calls[0].args.conversationId,
      phase: "decision_log",
      committed: false,
    };
  });
  it("acknowledged deleted-output replay exposes retained committed identity and refuses changed request without another writer", async () => {
    const space = prefix + "-unavailable",
      first = await seed(space, "fact-unavailable", "A"),
      operationId = prefix + "-unavailable";
    let lost = false;
    const client = {
      query: nativeClient.query.bind(nativeClient),
      mutation: async (
        fn: Parameters<typeof getFunctionName>[0],
        args: Record<string, unknown>,
      ) => {
        const value = await nativeClient.mutation(fn, args);
        if (publicFunctionName(getFunctionName(fn)) === "facts:update" && !lost) {
          lost = true;
          await internal("ownedHistoryFixture:removeSources", {
            ids: [first._id, (value as FactRecord)._id],
          });
          throw new Error("lost after result deletion");
        }
        return value;
      },
    };
    const options = { operationId, expectedSourceFactId: first._id };
    await expect(
      sdk("A", client as unknown as ConvexHttpClient).update(
        space,
        first.factId,
        { confidence: 80 },
        options,
      ),
    ).rejects.toBeInstanceOf(FactCommitOutcomeUnknownError);
    const receipt = await history("A").getOperationReceipt(
      space,
      operationId,
      "update",
    );
    expect(receipt?.committed).toBe(true);
    const before = await rows(space, "A");
    await expect(
      sdk().update(
        space,
        first.factId,
        { confidence: 80 },
        { ...options, tenantId: "A" },
      ),
    ).rejects.toMatchObject({
      name: "FactCommittedResultUnavailableError",
      committed: true,
      receipt,
    });
    await expect(
      sdk("A").update(space, first.factId, { confidence: 81 }, options),
    ).rejects.toThrow("OPERATION_CONFLICT");
    expect(await rows(space, "A")).toEqual(before);
    for (const receiptDisposition of ["missing", "unavailable"] as const) {
      let writerCalls = 0;
      const secondaryFailure = {
        mutation: async (
          fn: Parameters<typeof getFunctionName>[0],
          args: Record<string, unknown>,
        ) => {
          writerCalls++;
          return nativeClient.mutation(fn, args);
        },
        query: async (
          fn: Parameters<typeof getFunctionName>[0],
          args: Record<string, unknown>,
        ) => {
          if (publicFunctionName(getFunctionName(fn)) === "factHistory:getOperationReceipt") {
            if (receiptDisposition === "missing") return null;
            throw new Error("secondary receipt transport failed");
          }
          return nativeClient.query(fn, args);
        },
      };
      await expect(
        sdk("A", secondaryFailure as unknown as ConvexHttpClient).update(
          space,
          first.factId,
          { confidence: 80 },
          options,
        ),
      ).rejects.toMatchObject({
        name: "FactCommittedReceiptUnresolvedError",
        committed: true,
        phase: "committed_receipt_unresolved",
        operationId,
        scope: { tenantId: "A", memorySpaceId: space },
        receiptDisposition,
      });
      expect(writerCalls).toBe(1);
      expect(await rows(space, "A")).toEqual(before);
    }
    expected.repair2Unavailable = {
      space,
      operationId,
      original: first._id,
      receipt,
      exactReplayCommitted: true,
      changedReplayRefused: true,
    };
  });
  it("migration refuses absent/ineligible original conversation edges on dry/apply but permits a missing ORIGINAL memory ledger", async () => {
    type Origin = {
      space: string;
      memory: string;
      conversation: string;
      memoryId: string;
      conversationId: string;
    };
    const outcomes = [];
    for (const kind of [
      "absent-memory-edge",
      "empty-owner",
      "empty-direct-deleted-conversation",
    ]) {
      const space = prefix + "-association-" + kind;
      const origin = await internal<Origin>("ownedHistoryFixture:seedOrigins", {
        memorySpaceId: space,
        tenantId: "A",
        logicalId: kind,
        ...(kind === "absent-memory-edge"
          ? { noMemoryConversation: true }
          : {}),
        ...(kind === "empty-owner" ? { memoryOwner: "" } : {}),
      });
      const source = await internal<FactRecord>(
        "ownedHistoryFixture:seedFact",
        {
          memorySpaceId: space,
          tenantId: "A",
          factId: "fact-association",
          sourceRef: {
            memoryId: origin.memoryId,
            ...(kind === "empty-direct-deleted-conversation"
              ? { conversationId: "" }
              : {}),
          },
        },
      );
      const ledger = await internal<{
        eventDocumentId: string;
        snapshot: Record<string, unknown>;
      }>("ownedHistoryFixture:seedLegacy", {
        sourceFactId: source._id,
        userId: "actor",
      });
      expect(ledger.snapshot.sourceConversationId).toBeUndefined();
      expect(ledger.snapshot.associatedUserIds).toEqual([]);
      if (kind === "empty-direct-deleted-conversation")
        await internal("ownedHistoryFixture:removeOriginRecord", {
          id: origin.conversation,
        });
      const before = await internal("ownedHistoryFixture:historyDocument", {
        id: ledger.eventDocumentId,
      });
      for (const dryRun of [true, false]) {
        await expect(
          internal("factHistory:migrateEvidence", {
            ...ledger,
            snapshot: {
              ...ledger.snapshot,
              sourceConversationId: origin.conversation,
              associatedUserIds: ["collaborator", "target"],
            },
            dryRun,
          }),
        ).rejects.toThrow("MIGRATION_CONFLICT");
        expect(
          await internal("ownedHistoryFixture:historyDocument", {
            id: ledger.eventDocumentId,
          }),
        ).toEqual(before);
        expect(await get(source._id)).toEqual(source);
      }
      await internal("factHistory:migrateEvidence", {
        ...ledger,
        dryRun: false,
      });
      outcomes.push({ kind, ledger, zeroPatchesBoth: true });
    }
    const space = prefix + "-missing-original-memory",
      origin = await internal<Origin>("ownedHistoryFixture:seedOrigins", {
        memorySpaceId: space,
        tenantId: "A",
        logicalId: "missing-original",
      });
    const source = await internal<FactRecord>("ownedHistoryFixture:seedFact", {
      memorySpaceId: space,
      tenantId: "A",
      factId: "fact-missing-memory",
      sourceRef: { memoryId: origin.memoryId },
    });
    const ledger = await internal<{
      eventDocumentId: string;
      snapshot: Record<string, unknown>;
    }>("ownedHistoryFixture:seedLegacy", {
      sourceFactId: source._id,
      userId: "actor",
    });
    expect(ledger.snapshot.sourceConversationId).toBe(origin.conversation);
    await internal("ownedHistoryFixture:removeOriginRecord", {
      id: origin.memory,
    });
    const replacement = await internal<Origin>(
      "ownedHistoryFixture:seedOrigins",
      {
        memorySpaceId: space,
        tenantId: "A",
        logicalId: "missing-original",
        registerSpace: false,
        noMemoryConversation: true,
      },
    );
    expect(
      await internal("factHistory:migrateEvidence", {
        ...ledger,
        dryRun: true,
      }),
    ).toEqual({ changed: false, dryRun: true });
    expect(
      await internal("factHistory:migrateEvidence", {
        ...ledger,
        dryRun: false,
      }),
    ).toEqual({ changed: true, dryRun: false });
    expect(
      await internal("factHistory:migrateEvidence", {
        ...ledger,
        dryRun: false,
      }),
    ).toEqual({ changed: false, dryRun: false });
    const saved = await internal<Record<string, unknown>>(
      "ownedHistoryFixture:historyDocument",
      { id: ledger.eventDocumentId },
    );
    expect(saved.sourceMemoryId).toBe(origin.memory);
    expect(saved.sourceConversationId).toBe(origin.conversation);
    expect(saved.sourceMemoryId).not.toBe(replacement.memory);
    expected.repair2Association = {
      negatives: outcomes,
      missingOriginal: {
        ledger,
        original: origin,
        replacement,
        preserved: true,
      },
    };
  });
});

describe("Task18 repair3 time and purge limit native outcome proofs", () => {
  it("rejects nonfinite read/delete windows and purge hints before any effects, including explicit page override", async () => {
    const space = prefix + "-time-negative",
      source = await seed(space, "fact-time-negative", "A");
    for (const time of [0, 1, 2])
      await internal("ownedHistoryFixture:seedBoundaryEvent", {
        sourceFactId: source._id,
        timestamp: time,
      });
    const before = await rows(space, "A"),
      results = [];
    const windows = [
      { after: NaN },
      { before: NaN },
      { after: Infinity },
      { before: Infinity },
      { after: -Infinity },
      { before: -Infinity },
      { after: 2, before: 1 },
    ];
    for (const name of ["page", "getChangesByTimeRange", "countByAction"])
      for (const window of windows) {
        const args = {
          tenantId: "A",
          memorySpaceId: space,
          ...window,
          ...(name === "page"
            ? { paginationOpts: { numItems: 256, cursor: null } }
            : {}),
        };
        await expect(
          nativeClient.query(
            makeFunctionReference<"query">("factHistory:" + name),
            args,
          ),
        ).rejects.toThrow("INVALID_TIME_RANGE");
        expect(await rows(space, "A")).toEqual(before);
        results.push({
          name,
          arguments: convexToJson(args),
          zeroEffects: true,
        });
      }
    for (const name of [
      "deleteByFactId",
      "deleteByUserId",
      "deleteByOwner",
      "deleteByMemorySpace",
    ])
      for (const window of windows) {
        const specific =
          name === "deleteByFactId"
            ? { factId: source.factId }
            : name === "deleteByUserId"
              ? { userId: "boundary-actor" }
              : name === "deleteByOwner"
                ? { ownerUserId: "owner" }
                : {};
        const args = {
          tenantId: "A",
          memorySpaceId: space,
          ...specific,
          ...window,
        };
        await expect(
          nativeClient.mutation(ref("factHistory:" + name), args),
        ).rejects.toThrow("INVALID_TIME_RANGE");
        expect(await rows(space, "A")).toEqual(before);
        expect(await get(source._id)).toEqual(source);
        results.push({
          name,
          arguments: convexToJson(args),
          zeroEffects: true,
        });
      }
    for (const olderThan of [NaN, Infinity, -Infinity]) {
      const args = { tenantId: "A", memorySpaceId: space, olderThan };
      await expect(
        nativeClient.mutation(ref("factHistory:purgeOldEvents"), args),
      ).rejects.toThrow("INVALID_TIME_RANGE");
      expect(await rows(space, "A")).toEqual(before);
      results.push({
        name: "purgeOldEvents",
        arguments: convexToJson(args),
        zeroEffects: true,
      });
    }
    for (const limit of [-1, 0, NaN, Infinity, -Infinity, 1.5])
      for (const paginationOpts of [undefined, { numItems: 1, cursor: null }]) {
        const args = {
          tenantId: "A",
          memorySpaceId: space,
          olderThan: 3,
          limit,
          paginationOpts,
        };
        await expect(
          nativeClient.mutation(ref("factHistory:purgeOldEvents"), args),
        ).rejects.toThrow("INVALID_PAGE_SIZE");
        expect(await rows(space, "A")).toEqual(before);
        results.push({
          name: "purgeOldEvents",
          arguments: convexToJson(args),
          zeroEffects: true,
        });
      }
    await expect(
      nativeClient.mutation(ref("factHistory:purgeOldEvents"), {
        tenantId: "A",
        memorySpaceId: space,
        olderThan: 3,
        limit: 1,
        paginationOpts: { numItems: 257, cursor: null },
      }),
    ).rejects.toThrow("INVALID_PAGE_SIZE");
    for (const hours of [NaN, Infinity, -Infinity, 0, 1e300, 1e308])
      await expect(
        nativeClient.query(
          makeFunctionReference<"query">("factHistory:getActivitySummary"),
          { tenantId: "A", memorySpaceId: space, hours },
        ),
      ).rejects.toThrow("INVALID_TIME_RANGE");
    expected.repair3Invalid = {
      space,
      source: source._id,
      eventIds: before.map((e) => e.eventId),
      cases: results,
    };
  });
  it("valid inclusive windows and strict purge cutoff preserve equal/after events at epoch and large representable dates", async () => {
    const outcomes = [];
    for (const cutoff of [0, 1e14]) {
      const space = prefix + "-time-boundary-" + cutoff,
        source = await seed(space, "fact-time-boundary", "A");
      const events = [];
      for (const time of [cutoff - 1, cutoff, cutoff + 1])
        events.push(
          await internal<{ eventId: string; timestamp: number }>(
            "ownedHistoryFixture:seedBoundaryEvent",
            { sourceFactId: source._id, timestamp: time },
          ),
        );
      const equal = await history("A").getChanges({
        memorySpaceId: space,
        after: new Date(cutoff),
        before: new Date(cutoff),
      });
      expect(equal.map((e) => e.eventId)).toEqual([events[1].eventId]);
      expect(
        (
          await history("A").countByAction(
            space,
            new Date(cutoff),
            new Date(cutoff),
          )
        ).total,
      ).toBe(1);
      const result = await history("A").purgeOldEvents(
        new Date(cutoff),
        space,
        1,
      );
      expect(result).toEqual({ deleted: 1, remaining: 0 });
      expect(new Set((await rows(space, "A")).map((e) => e.eventId))).toEqual(
        new Set(events.slice(1).map((e) => e.eventId)),
      );
      expect(
        await nativeClient.mutation(ref("factHistory:purgeOldEvents"), {
          tenantId: "A",
          memorySpaceId: space,
          olderThan: cutoff,
          limit: 1000,
          paginationOpts: { numItems: 256, cursor: null },
        }),
      ).toMatchObject({ deleted: 0, isDone: true, remaining: 0 });
      const backendSummary = await nativeClient.query(
        makeFunctionReference<"query">("factHistory:getActivitySummary"),
        { tenantId: "A", memorySpaceId: space, hours: 0.5 },
      );
      const sdkSummary = await history("A").getActivitySummary(space, 0.5);
      // Epoch records are before the window; year 5138 records are after it.
      expect(backendSummary.totalEvents).toBe(0);
      expect(sdkSummary.totalEvents).toBe(0);
      outcomes.push({
        space,
        cutoff,
        source: source._id,
        events,
        strictEqualityPreserved: true,
        boundedActivityBeforeAndAfter: true,
      });
    }
    const summary = await history("A").getActivitySummary(
      outcomes[0].space,
      0.5,
    );
    expect(Number.isFinite(Date.parse(summary.timeRange.since))).toBe(true);
    expected.repair3Boundaries = outcomes;
  });
});
