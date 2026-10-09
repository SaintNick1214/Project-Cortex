import type { ConvexClient } from "convex/browser";
import { getFunctionName } from "convex/server";
import {
  collectCandidates,
  scopedPages,
  FactsDiscoveryError,
  resolveFactScope,
  type PageRange,
} from "../../src/facts/discovery";
import { SlotMatchingService } from "../../src/facts/slot-matching";
import { FactDeduplicationService } from "../../src/facts/deduplication";
import { BeliefRevisionService } from "../../src/facts/belief-revision";
import type { FactRecord } from "../../src/types";

describe("writer discovery exact scope and native cursor protocol", () => {
  it.each([{ leftRows: [] }, { leftRows: [1] }])(
    "finishes a bounded split child with global isDone=false and rows $leftRows, then visits the parent tail",
    async ({ leftRows }) => {
      const ranges: PageRange[] = [];
      const rows: number[] = [];
      for await (const page of scopedPages<number>(async (range) => {
        ranges.push({ ...range });
        if (range.cursor === null && range.endCursor === null)
          return {
            page: [999],
            isDone: false,
            continueCursor: "tail",
            pageStatus: "SplitRequired",
            splitCursor: "middle",
          };
        if (range.endCursor === "middle")
          return {
            page: range.cursor === null ? leftRows : [],
            isDone: false,
            continueCursor: "middle",
          };
        return { page: [2], isDone: true, continueCursor: "end" };
      }, "bounded-child"))
        rows.push(...page);
      expect(rows).toEqual([...leftRows, 2]);
      expect(ranges).toEqual([
        { cursor: null, endCursor: null },
        { cursor: null, endCursor: "middle" },
        { cursor: "middle", endCursor: null },
      ]);
    },
  );
  it.each([1, 3])(
    "preserves exact scoped physical candidates and cap %i across a bounded native child",
    async (cap) => {
      const calls: Record<string, unknown>[] = [];
      // Discovery consumes native FactRecord rows; only identity/scope are relevant here.
      const rows = [1, 2, 3].map((i) => ({
        _id: `owned-${i}`,
        factId: `fact-${i}`,
        tenantId: "A",
        memorySpaceId: "s",
      })) as unknown as FactRecord[];
      const client = {
        query: async (
          ref: Parameters<typeof getFunctionName>[0],
          args: Record<string, unknown>,
        ) => {
          expect(getFunctionName(ref)).toBe("facts:candidatePage");
          calls.push(args);
          const range = args.paginationOpts as PageRange;
          if (range.cursor === null && range.endCursor === null)
            return {
              page: [{ _id: "provisional-foreign" }],
              isDone: false,
              continueCursor: "tail",
              pageStatus: "SplitRequired",
              splitCursor: "middle",
            };
          if (range.endCursor === "middle")
            return {
              page: range.cursor === null ? rows.slice(0, 2) : [],
              isDone: false,
              continueCursor: "middle",
            };
          return { page: rows.slice(2), isDone: true, continueCursor: "done" };
        },
      } as unknown as ConvexClient;
      expect(
        await collectCandidates(
          client,
          "queryBySubject",
          { tenantId: "A", memorySpaceId: "s", subject: "owner", limit: 999 },
          cap,
        ),
      ).toEqual(rows.slice(0, cap));
      expect(calls).toHaveLength(cap === 1 ? 2 : 3);
      for (const call of calls) {
        expect(call).toMatchObject({
          tenantId: "A",
          memorySpaceId: "s",
          subject: "owner",
          operation: "queryBySubject",
          paginationOpts: { numItems: cap },
        });
        expect(call).not.toHaveProperty("limit");
      }
    },
  );
  it("retains unbounded nonprogress refusal instead of treating a repeated cursor as completion", async () => {
    let calls = 0;
    const consume = async () => {
      for await (const _rows of scopedPages(async () => {
        calls++;
        return { page: [], isDone: false, continueCursor: "same" };
      }, "unbounded")) {
        /* exhaust */
      }
    };
    await expect(consume()).rejects.toMatchObject({
      stage: "unbounded",
      originalCause: { message: "Non-advancing cursor" },
    });
    expect(calls).toBe(2);
  });
  it("propagates a parent-tail transport refusal after yielding a completed bounded child", async () => {
    const refusal = new Error("tail unavailable");
    let calls = 0;
    const consume = async () => {
      for await (const _rows of scopedPages(async (range) => {
        calls++;
        if (range.cursor === null && range.endCursor === null)
          return {
            page: [],
            isDone: false,
            continueCursor: "tail",
            pageStatus: "SplitRequired",
            splitCursor: "middle",
          };
        if (range.endCursor === "middle")
          return { page: [], isDone: false, continueCursor: "middle" };
        throw refusal;
      }, "bounded-tail")) {
        /* exhaust */
      }
    };
    await expect(consume()).rejects.toMatchObject({
      stage: "bounded-tail",
      originalCause: refusal,
    });
    expect(calls).toBe(3);
  });
  it("preserves both native split children and original parent tail; discards provisional rows", async () => {
    const ranges: PageRange[] = [];
    const result: number[] = [];
    for await (const rows of scopedPages<number>(async (range) => {
      ranges.push(range);
      if (range.cursor === null && range.endCursor === null)
        return {
          page: [999],
          isDone: false,
          continueCursor: "tail",
          pageStatus: "SplitRequired",
          splitCursor: "middle",
        };
      return range.endCursor === "middle"
        ? { page: [1], isDone: true, continueCursor: "middle" }
        : { page: [2], isDone: true, continueCursor: "end" };
    }, "split"))
      result.push(...rows);
    expect(result).toEqual([1, 2]);
    expect(ranges).toEqual([
      { cursor: null, endCursor: null },
      { cursor: null, endCursor: "middle" },
      { cursor: "middle", endCursor: null },
    ]);
  });
  it("continues empty filtered pages and stops calls on cooperative consumer cancellation", async () => {
    let count = 0;
    const iterator = scopedPages<number>(async () => {
      count++;
      return count === 1
        ? { page: [], isDone: false, continueCursor: "second" }
        : { page: [3], isDone: false, continueCursor: "third" };
    }, "empty");
    expect(await iterator.next()).toEqual({ value: [], done: false });
    expect(await iterator.next()).toEqual({ value: [3], done: false });
    await iterator.return(undefined);
    expect(count).toBe(2);
  });
  it("refuses nonadvancing, invalid split, invalid envelope and transport errors", async () => {
    for (const reply of [
      { page: [], isDone: false, continueCursor: "" },
      {
        page: [],
        isDone: false,
        continueCursor: "x",
        pageStatus: "SplitRequired",
        splitCursor: null,
      },
      null,
    ]) {
      const loop = scopedPages(async () => reply as never, "bad");
      await expect(
        (async () => {
          for await (const _rows of loop) {
            /* exhaust */
          }
        })(),
      ).rejects.toBeInstanceOf(FactsDiscoveryError);
    }
    await expect(
      collectCandidates(
        {
          query: async () => {
            throw new Error("failed");
          },
        } as unknown as ConvexClient,
        "list",
        { memorySpaceId: "s" },
        100,
      ),
    ).rejects.toMatchObject({ stage: "list" });
  });
  it("uses one fixed endpoint with operation and original matching caps", async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const client = {
      query: async (
        ref: Parameters<typeof getFunctionName>[0],
        args: Record<string, unknown>,
      ) => {
        calls.push({ name: getFunctionName(ref), args });
        return { page: [], isDone: true, continueCursor: "done" };
      },
      mutation: async () => {
        throw new Error("must not write");
      },
    } as unknown as ConvexClient;
    await new SlotMatchingService(client, { enabled: true }).findSlotConflicts(
      { subject: "user", predicate: "favorite color" },
      "s",
      "owner",
      "A",
    );
    const dedup = new FactDeduplicationService(client);
    const candidate = {
      fact: "new words",
      factType: "custom",
      subject: "user",
      predicate: "p",
      object: "o",
      confidence: 90,
    };
    await dedup.findDuplicate(
      candidate,
      "s",
      { strategy: "structural" },
      "owner",
      "A",
    );
    await dedup.findDuplicate(
      candidate,
      "s",
      { strategy: "exact" },
      "owner",
      "A",
    );
    await dedup.findDuplicate(
      candidate,
      "s",
      { strategy: "semantic", generateEmbedding: async () => [1, 0] },
      "owner",
      "A",
    );
    expect(
      calls.every(
        (c) =>
          c.name === "facts:candidatePage" &&
          c.args.tenantId === "A" &&
          c.args.memorySpaceId === "s",
      ),
    ).toBe(true);
    expect(
      calls.map((c) => [
        (c.args as { operation: string }).operation,
        (c.args.paginationOpts as { numItems: number }).numItems,
      ]),
    ).toEqual([
      ["queryBySubject", 100],
      ["findByStructure", 1],
      ["list", 100],
      ["findByStructure", 1],
      ["list", 100],
      ["list", 50],
    ]);
    expect(calls.every((c) => !("limit" in c.args))).toBe(true);
  });
  it("propagates every discovery failure before any revise mutation", async () => {
    for (const config of [
      { slotMatching: { enabled: true }, semanticMatching: { enabled: false } },
      { slotMatching: { enabled: false }, semanticMatching: { enabled: true } },
      {
        slotMatching: { enabled: false },
        semanticMatching: { enabled: false },
      },
    ]) {
      let writes = 0;
      const client = {
        query: async () => {
          throw new Error("discovery unavailable");
        },
        mutation: async () => {
          writes++;
        },
      } as unknown as ConvexClient;
      await expect(
        new BeliefRevisionService(client, undefined, undefined, config).revise({
          memorySpaceId: "s",
          tenantId: "A",
          fact: {
            fact: "new value",
            subject: "user",
            predicate: "favorite color",
            factType: "preference",
            confidence: 90,
          },
        }),
      ).rejects.toBeInstanceOf(FactsDiscoveryError);
      expect(writes).toBe(0);
    }
    expect(resolveFactScope(undefined, undefined)).toBeUndefined();
    expect(() => resolveFactScope("A", "B")).toThrow(
      "FACT_HISTORY_SCOPE_MISMATCH",
    );
  });
});

// Complete scans have per-call native limits, not an arbitrary SDK terminal cap.
it("reaches a valid terminal page100001 without limiting complete scans", async () => {
  let calls = 0,
    yielded = 0;
  for await (const _page of scopedPages(
    async () => ({
      page: [],
      continueCursor: String(++calls),
      isDone: calls === 100001,
    }),
    "long-valid",
  ))
    yielded++;
  expect(calls).toBe(100001);
  expect(yielded).toBe(100001);
});

describe("repeated split request ranges", () => {
  it("refuses alternating split ranges before a fourth external call", async () => {
    const requests: PageRange[] = [];
    const run = async () => {
      for await (const _rows of scopedPages(async (range) => {
        requests.push({ ...range });
        if (requests.length >= 10)
          throw new Error("external stop must not occur");
        return {
          page: [],
          isDone: false,
          continueCursor: "ignored",
          pageStatus: "SplitRequired",
          splitCursor: range.endCursor === "A" ? "B" : "A",
        };
      }, "split-cycle")) {
        /* exhaust */
      }
    };
    await expect(run()).rejects.toMatchObject({
      stage: "split-cycle",
      originalCause: { message: "Repeated page request range" },
    });
    expect(requests).toEqual([
      { cursor: null, endCursor: null },
      { cursor: null, endCursor: "A" },
      { cursor: null, endCursor: "B" },
    ]);
  });
});
