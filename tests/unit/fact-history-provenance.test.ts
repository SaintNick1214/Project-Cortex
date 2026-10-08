import { FactsAPI } from "../../src/facts";
import { createHash } from "node:crypto";
import type { ConvexClient } from "convex/browser";
import { getFunctionName } from "convex/server";
import * as backend from "../../convex-dev/factHistory";
import * as facts from "../../convex-dev/facts";
import {
  canonical,
  digest,
  clean,
  CaptureBudget,
  relationship,
  eventReceipt,
  type Fact,
} from "../../convex-dev/lib/factHistoryProvenance";
import {
  FactHistoryService,
  HistoryDeletePartialError,
  type HistoryReceipt,
} from "../../src/facts/history";
import type { Id } from "../../convex-dev/_generated/dataModel";

function exportArgs(registration: unknown): string {
  if (
    typeof registration !== "function" ||
    !("exportArgs" in registration) ||
    typeof registration.exportArgs !== "function"
  )
    throw new Error("registration missing validator");
  return (registration.exportArgs as () => string)();
}

describe("durable fact provenance and public history", () => {
  it("canonicalizes official Convex values and SHA256 without collapsing absence/null/bytes", () => {
    const value = {
      z: undefined,
      b: BigInt(-3),
      a: new Uint8Array([1, 2, 3]).buffer,
      n: null,
    };
    expect(digest(value)).toBe(
      createHash("sha256").update(canonical(value)).digest("hex"),
    );
    expect(canonical(value)).toBe(
      canonical({ n: null, a: value.a, b: BigInt(-3) }),
    );
    expect(canonical({ a: undefined })).not.toBe(canonical({ a: null }));
    expect(canonical({ z: "é", Z: 2, a: 3 })).toBe('{"Z":2,"a":3,"z":"é"}');
    expect(clean({ nested: { a: undefined, b: 2 } })).toEqual({
      nested: { b: 2 },
    });
  });
  it("keeps migration internal, fixed candidate page and legacy array query registrations", () => {
    expect(backend.migrateEvidence.isInternal).toBe(true);
    expect(backend.migrateEvidence).not.toHaveProperty("isPublic");
    expect(facts.candidatePage.isPublic).toBe(true);
    const args = JSON.parse(exportArgs(facts.candidatePage));
    expect(
      args.value.operation.fieldType.value.map(
        (v: { value: string }) => v.value,
      ),
    ).toEqual(["list", "queryBySubject", "findByStructure"]);
    for (const query of [
      facts.list,
      facts.queryBySubject,
      facts.findByStructure,
    ])
      expect(JSON.parse(exportArgs(query)).value).not.toHaveProperty(
        "candidatePage",
      );
  });
  it("refuses raw/document/write/response bounds and uses actual whole-call counters", async () => {
    const budget = new CaptureBudget(2);
    expect(() => budget.reserve(3)).toThrow("FACT_HISTORY_BUDGET_EXCEEDED");
    expect(() =>
      new CaptureBudget().write({ fact: "x".repeat(1024 * 1024) }),
    ).toThrow();
    expect(() =>
      new CaptureBudget().result("x".repeat(8 * 1024 * 1024)),
    ).toThrow();
    const ctx = {
      meta: {
        getTransactionMetrics: async () => ({
          documentsRead: { used: 3 },
          bytesRead: { used: 0 },
          bytesWritten: { used: 0 },
        }),
      },
    };
    await expect(budget.finish(ctx as never, {})).rejects.toThrow(
      "FACT_HISTORY_BUDGET_EXCEEDED",
    );
  });
  it("never binds a legacy logical link to a current physical identity", () => {
    const fact = {
      _id: "source",
      factId: "fact-1",
      memorySpaceId: "space",
      supersedes: "fact-reused",
    } as Fact;
    expect(relationship(fact, "supersedes")).toEqual({
      state: "unknown",
      logicalFactId: "fact-reused",
    });
    expect(
      relationship({ ...fact, supersedes: undefined }, "supersedes"),
    ).toEqual({ state: "absent" });
    expect(() =>
      relationship(
        {
          ...fact,
          supersedesEndpoint: {
            state: "known",
            scopeVersion: 1,
            logicalFactId: "fact-reused",
            memorySpaceId: "space",
            tenantId: "foreign",
            factDocumentId: "other" as Id<"facts">,
          },
        },
        "supersedes",
      ),
    ).toThrow();
  });
  it("emits the same receipt order on insert and index replay", () => {
    const old = {
      eventId: "old",
      _id: "old",
      pendingRichEvent: { payload: { eventRole: "old" } },
      affectedFactIds: ["o", "n"],
      resultFactId: "n",
    };
    const fresh = {
      ...old,
      eventId: "new",
      _id: "new",
      pendingRichEvent: { payload: { eventRole: "new" } },
    };
    expect(eventReceipt([old, fresh] as never)).toEqual(
      eventReceipt([fresh, old] as never),
    );
  });
  it("reads all >1000 rows and preserves scope/context rather than treating tenantless as all", async () => {
    const calls: Record<string, unknown>[] = [];
    const rows = Array.from({ length: 1051 }, (_, i) => ({
      action: i % 2 ? "UPDATE" : "CREATE",
      eventId: String(i),
      sourceFactId: String(i),
      timestamp: i,
    }));
    const client = {
      query: async (_ref: unknown, args: Record<string, unknown>) => {
        calls.push(args);
        const cursor = (args.paginationOpts as { cursor: string | null })
          .cursor;
        const start = cursor ? Number(cursor) : 0;
        return {
          page: rows.slice(start, start + 256),
          continueCursor: String(start + 256),
          isDone: start + 256 >= rows.length,
        };
      },
    } as unknown as ConvexClient;
    const history = new FactHistoryService(client, undefined, {
      userId: "actor",
      tenantId: "A",
    });
    expect(await history.countByAction("space")).toEqual({
      CREATE: 526,
      UPDATE: 525,
      SUPERSEDE: 0,
      DELETE: 0,
      total: 1051,
    });
    expect(calls).toHaveLength(5);
    expect(calls.every((a) => a.tenantId === "A")).toBe(true);
    await expect(
      history.getHistory("fact-1", 10, { tenantId: "B" }),
    ).rejects.toThrow("FACT_HISTORY_SCOPE_MISMATCH");
    expect(calls).toHaveLength(5);
  });
  it("publishes only original pending anchors, with no fact writes after source loss", async () => {
    const seen: string[] = [];
    const client = {
      mutation: async (
        ref: Parameters<typeof getFunctionName>[0],
        args: { eventId: string },
      ) => {
        seen.push(getFunctionName(ref));
        return { eventId: args.eventId };
      },
    } as unknown as ConvexClient;
    const history = new FactHistoryService(client, undefined, {
      userId: "actor",
      tenantId: "A",
    });
    const receipt = {
      committed: true,
      events: [
        {
          eventId: "event",
          _id: "anchor",
          pending: {
            version: 1,
            payload: {
              tenantId: "A",
              memorySpaceId: "space",
              operationId: "operation",
              phase: "store",
              eventRole: "source",
            },
            absentFields: [],
            payloadDigest: "original",
          },
        },
      ],
      affectedFactIds: ["deleted-source"],
    } as unknown as HistoryReceipt;
    expect(await history.retryHistory(receipt)).toEqual({
      eventIds: ["event"],
    });
    expect(await history.retryHistory(receipt)).toEqual({
      eventIds: ["event"],
    });
    expect(seen).toEqual([
      "factHistory:publishPendingEvent",
      "factHistory:publishPendingEvent",
    ]);
    await expect(
      history.retryHistory({
        ...receipt,
        events: [{ ...receipt.events[0], pending: undefined }],
      }),
    ).rejects.toThrow("FACT_HISTORY_PENDING_EVENT_UNRESOLVED");
  });
  it("reports committed page deletions honestly when a later call fails", async () => {
    let calls = 0;
    const client = {
      mutation: async () => {
        if (calls++) throw new Error("transport");
        return { page: [], deleted: 4, continueCursor: "next", isDone: false };
      },
    } as unknown as ConvexClient;
    await expect(
      new FactHistoryService(client).deleteByMemorySpace("space"),
    ).rejects.toMatchObject({ name: "HistoryDeletePartialError", deleted: 4 });
    expect(new HistoryDeletePartialError(4, new Error())).toBeInstanceOf(Error);
  });
});

describe("physical fact deletion partial receipts", () => {
  it("preserves one acknowledged physical commit and later transport UNKNOWN without retry", async () => {
    const sends: string[] = [];
    const documents = [{_id: "first"}, {_id: "second"}, {_id: "third"}];
    const deleteIntents = documents.map(row => ({physicalId: row._id, operationId: `delete-${row._id}`, requestDigest: "a".repeat(64), request: {selectedPhysicalId: row._id}}));
    const client = {
      query: async (reference: Parameters<ConvexClient["query"]>[0]) => {
        if (getFunctionName(reference) === "factHistory:getOperationReceipt") return null;
        return {page: documents, fingerprints: Object.fromEntries(documents.map(row => [row._id, "b".repeat(64)])), deleteIntents, continueCursor: "", isDone: true};
      },
      mutation: async (_reference: unknown, args: {selectedPhysicalId: string}) => {
        sends.push(args.selectedPhysicalId);
        if (sends.length > 1) throw new Error("transport lost");
        return {deleted: 1};
      },
    } as unknown as ConvexClient;
    await expect(new FactsAPI(client).deleteMany({memorySpaceId: "space"})).rejects.toMatchObject({
      name: "DomainOperationPartialError",
      partial: {confirmedCount: 1, possibleCount: 2, confirmedPhysicalIds: ["first"], unknownPhysicalIds: ["second"], unstartedPhysicalIds: ["third"]},
    });
    expect(sends).toEqual(["first", "second"]);
  });
});

it("refuses inconsistent raw logical and every saved relationship state in both directions", () => {
  const base = {
    _id: "source",
    factId: "fact-source",
    memorySpaceId: "space",
    tenantId: "A",
  };
  const known = {
    state: "known",
    logicalFactId: "fact-target",
    factDocumentId: "target",
    memorySpaceId: "space",
    tenantId: "A",
    scopeVersion: 1,
  };
  for (const direction of ["supersedes", "supersededBy"] as const) {
    const key =
      direction === "supersedes"
        ? "supersedesEndpoint"
        : "supersededByEndpoint";
    for (const [logical, saved] of [
      ["fact-target", { state: "absent" }],
      [undefined, known],
      [undefined, { state: "unknown", logicalFactId: "fact-target" }],
      ["other", known],
      ["other", { state: "unknown", logicalFactId: "fact-target" }],
      [undefined, { state: "absent", logicalFactId: "fact-target" }],
      [
        "fact-target",
        {
          state: "unknown",
          logicalFactId: "fact-target",
          factDocumentId: "target",
        },
      ],
    ]) {
      expect(() =>
        relationship(
          { ...base, [direction]: logical, [key]: saved } as Fact,
          direction,
        ),
      ).toThrow("FACT_HISTORY_RELATIONSHIP_CONFLICT");
    }
    expect(
      relationship(
        { ...base, [direction]: "fact-target", [key]: known } as Fact,
        direction,
      ),
    ).toEqual(known);
    expect(
      relationship(
        {
          ...base,
          [direction]: "fact-target",
          [key]: { state: "unknown", logicalFactId: "fact-target" },
        } as Fact,
        direction,
      ).state,
    ).toBe("unknown");
  }
});

describe("acknowledged commitment with unresolved secondary receipt", () => {
  it.each(["missing", "unavailable"] as const)(
    "retains phase/scope/operation with %s receipt and never invents a result",
    async (disposition) => {
      let mutations = 0;
      const requests: Record<string, unknown>[] = [];
      const { ConvexError } = await import("convex/values");
      const client = {
        mutation: async () => {
          mutations++;
          throw new ConvexError("FACT_HISTORY_COMMITTED_RESULT_UNAVAILABLE");
        },
        query: async (_fn: unknown, args: Record<string, unknown>) => {
          requests.push(args);
          if (disposition === "unavailable")
            throw new Error("receipt transport unavailable");
          return null;
        },
      } as unknown as ConvexClient;
      const api = new FactsAPI(client);
      let caught: unknown;
      try {
        await api.update(
          "space",
          "fact-one",
          { confidence: 80 },
          { operationId: "original-operation", tenantId: "A" },
        );
      } catch (error) {
        caught = error;
      }
      expect(caught).toMatchObject({
        name: "FactCommittedReceiptUnresolvedError",
        committed: true,
        phase: "committed_receipt_unresolved",
        operationId: "original-operation",
        mutationPhase: "update",
        scope: { memorySpaceId: "space", tenantId: "A" },
        receiptDisposition: disposition,
      });
      expect(caught).not.toHaveProperty("receipt");
      expect(caught).not.toHaveProperty("resultFactId");
      expect(mutations).toBe(1);
      expect(requests).toEqual([
        {
          memorySpaceId: "space",
          tenantId: "A",
          operationId: "original-operation",
          phase: "update",
        },
      ]);
    },
  );
});

describe("history time and purge batch validation before transport", () => {
  it("rejects invalid dates/raw selectors/hours and limits without a query or mutation", async () => {
    let queries = 0,
      mutations = 0;
    const client = {
      query: async () => {
        queries++;
        throw new Error("query forbidden");
      },
      mutation: async () => {
        mutations++;
        throw new Error("mutation forbidden");
      },
    } as unknown as ConvexClient;
    const h = new FactHistoryService(client);
    for (const value of [NaN, Infinity, -Infinity, true, "1", null]) {
      await expect(
        (async () => {
          for await (const _p of h.pages({ after: value as number })) {
            /*exhaust*/
          }
        })(),
      ).rejects.toThrow("INVALID_TIME_RANGE");
      await expect(
        h.getActivitySummary("space", value as number),
      ).rejects.toThrow("INVALID_TIME_RANGE");
    }
    for (const date of [
      new Date(NaN),
      false,
      "date",
      Object.create(Date.prototype),
    ]) {
      await expect(
        h.getChanges({ memorySpaceId: "space", after: date as Date }),
      ).rejects.toThrow("INVALID_TIME_RANGE");
      await expect(h.countByAction("space", date as Date)).rejects.toThrow(
        "INVALID_TIME_RANGE",
      );
      await expect(h.purgeOldEvents(date as Date, "space")).rejects.toThrow(
        "INVALID_TIME_RANGE",
      );
    }
    await expect(
      h.getChanges({
        memorySpaceId: "space",
        after: new Date(2),
        before: new Date(1),
      }),
    ).rejects.toThrow("INVALID_TIME_RANGE");
    for (const hours of [0, -1, 1e300, 1e20])
      await expect(h.getActivitySummary("space", hours)).rejects.toThrow(
        "INVALID_TIME_RANGE",
      );
    for (const limit of [-1, 0, NaN, Infinity, -Infinity, 1.5, true, "1"])
      await expect(
        h.purgeOldEvents(new Date(1), "space", limit as number),
      ).rejects.toThrow("INVALID_PAGE_SIZE");
    expect({ queries, mutations }).toEqual({ queries: 0, mutations: 0 });
  });
  it("uses valid purge limit as a batch hint while exhausting cursor ranges", async () => {
    const calls: Record<string, unknown>[] = [];
    const client = {
      mutation: async (_fn: unknown, args: Record<string, unknown>) => {
        calls.push(args);
        return {
          page: [],
          deleted: 1,
          isDone: calls.length === 3,
          continueCursor: String(calls.length),
        };
      },
    } as unknown as ConvexClient;
    expect(
      await new FactHistoryService(client).purgeOldEvents(
        new Date(100),
        "space",
        1,
      ),
    ).toEqual({ deleted: 3, remaining: 0 });
    expect(
      calls.map((c) => (c.paginationOpts as { numItems: number }).numItems),
    ).toEqual([1, 1, 1]);
    expect(calls.map((c) => c.limit)).toEqual([1, 1, 1]);
  });
});

it("registered history handlers refuse invalid time/limit before any database read or write", async () => {
  let reads = 0,
    writes = 0;
  const ctx = {
    db: {
      query: () => {
        reads++;
        throw new Error("database read forbidden");
      },
      delete: () => {
        writes++;
        throw new Error("database write forbidden");
      },
    },
  };
  async function invoke(registration: unknown, args: Record<string, unknown>) {
    if (
      typeof registration !== "function" ||
      !("_handler" in registration) ||
      typeof registration._handler !== "function"
    )
      throw new Error("handler unavailable");
    return registration._handler(ctx, args);
  }
  for (const registration of [
    backend.page,
    backend.getChangesByTimeRange,
    backend.countByAction,
    backend.deleteByFactId,
    backend.deleteByUserId,
    backend.deleteByOwner,
    backend.deleteByMemorySpace,
  ])
    for (const value of [NaN, Infinity, -Infinity])
      await expect(
        invoke(registration, {
          memorySpaceId: "space",
          factId: "fact-one",
          userId: "actor",
          ownerUserId: "owner",
          after: value,
          paginationOpts: { numItems: 1, cursor: null },
        }),
      ).rejects.toThrow("INVALID_TIME_RANGE");
  for (const limit of [-1, NaN, Infinity, 1.5])
    await expect(
      invoke(backend.purgeOldEvents, {
        olderThan: 100,
        limit,
        paginationOpts: { numItems: 1, cursor: null },
      }),
    ).rejects.toThrow("INVALID_PAGE_SIZE");
  await expect(
    invoke(backend.getActivitySummary, {
      memorySpaceId: "space",
      hours: 1e300,
    }),
  ).rejects.toThrow("INVALID_TIME_RANGE");
  expect({ reads, writes }).toEqual({ reads: 0, writes: 0 });
});
