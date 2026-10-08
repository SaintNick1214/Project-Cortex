/** Deterministic named matching stages and actual phase receipts. */
import { readFileSync, writeFileSync } from "node:fs";
import { ConvexHttpClient, type ConvexClient } from "convex/browser";
import { ConvexError } from "convex/values";
import { getFunctionName } from "convex/server";
import { FactsAPI } from "../src/facts";
import { SlotMatchingService } from "../src/facts/slot-matching";
import { FactDeduplicationService } from "../src/facts/deduplication";
import {
  FactHistoryService,
  RevisionAfterCommitError,
} from "../src/facts/history";
import type { FactRecord } from "../src/types";
const proof =
  "/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/cli-sandbox-2026/fact-history-provenance";
const prefix = "task18-repair3-ts-revision-" + Date.now();
const client = new ConvexHttpClient("http://127.0.0.1:45410");
interface OwnedAdmin {
  setAdminAuth(key: string): void;
  function(
    name: string,
    format: undefined,
    args: Record<string, unknown>,
  ): Promise<unknown>;
}
const admin = new ConvexHttpClient(
  "http://127.0.0.1:45410",
) as ConvexHttpClient & OwnedAdmin;
const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
const tracked = {
  query: async (
    reference: Parameters<typeof getFunctionName>[0],
    args: Record<string, unknown>,
  ) => {
    calls.push({ name: getFunctionName(reference), args });
    return client.query(reference as never, args as never);
  },
  mutation: client.mutation.bind(client),
} as unknown as ConvexClient;
const sdk = (c = tracked) =>
  new FactsAPI(
    c,
    undefined,
    undefined,
    { userId: "actor", tenantId: "A" },
    undefined,
    { llmResolution: { enabled: false } },
  );
const expected: Record<string, unknown> = { prefix };
const rows = (space: string) =>
  admin.function("ownedHistoryFixture:factsInSpace", undefined, {
    memorySpaceId: space,
  }) as Promise<FactRecord[]>;
beforeAll(() => {
  expect(process.env.HOME).toBe(proof + "/home");
  expect(process.env.HOME).toBe(process.env.CORTEX_TEST_HOME_ROOT);
  expect(process.env.CONVEX_URL).toBe("http://127.0.0.1:45410");
  admin.setAdminAuth(
    (
      JSON.parse(
        readFileSync(
          proof + "/project/.convex/local/default/config.json",
          "utf8",
        ),
      ) as { adminKey: string }
    ).adminKey,
  );
});
afterAll(() =>
  writeFileSync(
    proof + "/repair3/ts-revision-native-expected.json",
    JSON.stringify(expected, null, 2) + "\n",
  ),
);
async function store(
  space: string,
  tenantId: string,
  fact = "User likes blue",
) {
  return new FactsAPI(client as unknown as ConvexClient, undefined, undefined, {
    userId: "owner",
    tenantId,
  }).store({
    memorySpaceId: space,
    userId: "owner",
    fact,
    factType: "preference",
    subject: "user",
    predicate: "favorite color",
    object: "blue",
    confidence: 50,
    sourceType: "manual",
    tags: [],
  });
}
describe("Task18 native revision discovery and honest committed phase state", () => {
  it("runs slot, structural, exact, semantic-list and subject/type stages with tenant collisions", async () => {
    const space = prefix + "-stages";
    const a = await store(space, "A"),
      b = await store(space, "B");
    const slot = await new SlotMatchingService(tracked, {
      enabled: true,
    }).findSlotConflicts(
      { subject: "user", predicate: "favorite color", object: "purple" },
      space,
      "owner",
      "A",
    );
    expect(slot.conflictingFacts.map((f) => f._id)).toEqual([a._id]);
    const dedup = new FactDeduplicationService(tracked),
      same = {
        fact: a.fact,
        factType: "preference",
        subject: "user",
        predicate: "favorite color",
        object: "blue",
        confidence: 90,
      };
    const structural = await dedup.findDuplicate(
      same,
      space,
      { strategy: "structural" },
      "owner",
      "A",
    );
    expect(structural.existingFact?._id).toBe(a._id);
    const exact = await dedup.findDuplicate(
      { ...same, subject: undefined, predicate: undefined, object: undefined },
      space,
      { strategy: "exact" },
      "owner",
      "A",
    );
    expect(exact.existingFact?._id).toBe(a._id);
    const semantic = await dedup.findDuplicate(
      {
        ...same,
        fact: "totally different vocabulary",
        subject: undefined,
        predicate: undefined,
        object: undefined,
      },
      space,
      { strategy: "semantic", generateEmbedding: async () => [1, 0] },
      "owner",
      "A",
    );
    expect(semantic.existingFact?._id).toBe(a._id);
    expect(semantic.matchedBy).toBe("semantic");
    const api = sdk();
    api.configureBeliefRevision(undefined, {
      slotMatching: { enabled: false },
      semanticMatching: { enabled: false },
      llmResolution: { enabled: false },
    });
    const result = await api.revise({
      memorySpaceId: space,
      userId: "owner",
      fact: { ...same, confidence: 80 },
    });
    expect(result.action).toBe("UPDATE");
    expect(result.fact._id).toBe(a._id);
    expect(result.pipeline.subjectTypeMatching?.factIds).toEqual([a.factId]);
    expect((await rows(space)).find((f) => f._id === b._id)?.confidence).toBe(
      50,
    );
    const pages = calls.filter((c) => c.name === "facts:candidatePage");
    expect(pages.every((c) => c.args.tenantId === "A")).toBe(true);
    expect(
      new Set(
        pages.map(
          (c) => (c.args.paginationOpts as { numItems: number }).numItems,
        ),
      ),
    ).toEqual(new Set([100, 1, 50, 20]));
    expected.stages = {
      target: a._id,
      foreign: b._id,
      caps: pages.map(
        (c) => (c.args.paginationOpts as { numItems: number }).numItems,
      ),
      selected: a._id,
    };
  });
  it("a transport discovery failure produces zero native writes", async () => {
    const space = prefix + "-discovery-error";
    await store(space, "A");
    let writes = 0;
    const failed = {
      query: async () => {
        throw new Error("transport unavailable");
      },
      mutation: async () => {
        writes++;
        throw new Error("unexpected write");
      },
    } as unknown as ConvexClient;
    await expect(
      sdk(failed).revise({
        memorySpaceId: space,
        userId: "owner",
        fact: {
          fact: "User likes purple",
          factType: "preference",
          subject: "user",
          predicate: "favorite color",
          object: "purple",
          confidence: 90,
        },
      }),
    ).rejects.toMatchObject({ name: "FactsDiscoveryError" });
    expect(writes).toBe(0);
    expect(await rows(space)).toHaveLength(1);
  });
  it.each(["definite", "lost"] as const)(
    "keeps preceding store committed when link is %s and never claims rollback after response loss",
    async (kind) => {
      const space = prefix + "-" + kind;
      const original = await store(space, "A");
      const facade = {
        query: client.query.bind(client),
        mutation: async (
          reference: Parameters<typeof getFunctionName>[0],
          args: Record<string, unknown>,
        ) => {
          if (getFunctionName(reference) === "facts:supersede") {
            if (kind === "definite")
              throw new ConvexError("FORCED_LINK_ROLLBACK");
            await client.mutation(reference as never, args as never);
            throw new Error("native link committed; response lost");
          }
          return client.mutation(reference as never, args as never);
        },
      } as unknown as ConvexClient;
      let failure: RevisionAfterCommitError | undefined;
      try {
        await sdk(facade).revise({
          memorySpaceId: space,
          userId: "owner",
          fact: {
            fact: "User now likes purple",
            factType: "preference",
            subject: "user",
            predicate: "favorite color",
            object: "purple",
            confidence: 90,
          },
        });
      } catch (error) {
        if (error instanceof RevisionAfterCommitError) failure = error;
        else throw error;
      }
      expect(failure?.receipt.store.committed).toBe(true);
      expect(failure?.receipt.link).toEqual(
        kind === "definite" ? { committed: false } : { outcome: "unknown" },
      );
      expect(await rows(space)).toHaveLength(2);
      const retained = await rows(space),
        created = retained.find(
          (f) => f._id === failure!.receipt.store.createdDocumentId,
        )!;
      expect(created).toBeDefined();
      expect(created.supersedesEndpoint?.state).toBe(
        kind === "definite" ? "absent" : "known",
      );
      const history = new FactHistoryService(
        client as unknown as ConvexClient,
        undefined,
        { userId: "actor", tenantId: "A" },
      );
      const pair = await history.getOperationReceipt(
        space,
        failure!.receipt.intent.operationId,
        "revision_link",
      );
      expect(pair?.committed ?? false).toBe(kind === "lost");
      await history.retryHistory(failure!.receipt.store.storeAnchor!);
      expect(await rows(space)).toHaveLength(2);
      expect(
        retained.find((f) => f._id === original._id)?.supersededByEndpoint
          ?.state,
      ).toBe(kind === "definite" ? "absent" : "known");
      expected[kind] = {
        original: original._id,
        created: created._id,
        receipt: failure!.receipt,
        pairCommitted: !!pair,
      };
    },
  );
});
