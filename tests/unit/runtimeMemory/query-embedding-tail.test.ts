/** Original native repository guards; controlled embeddings are not live service evidence. */
import { expect, it, jest } from "@jest/globals";
import { getFunctionName } from "convex/server";
import type { ActionCtx } from "../../../convex-dev/_generated/server";
import type { MemoryModel } from "../../../src/domain/contracts";
import { DEFAULT_EMBEDDING_PROFILE as profile, LARGE_EMBEDDING_PROFILE } from "../../../src/domain/profile";
import { createActionMemoryRepository, memoryScope } from "../../../convex-dev/runtimeMemoryRepository";
import type { MemoryDeliveryBindings } from "../../../convex-dev/runtimeMemoryRepository";
import { explicitSourceLineage, finishRecallFromEmbedding, recallMemory, rememberMemory } from "../../../convex-dev/runtimeMemoryServices";
import { memoryFixture } from "./fixture";

const embedding = Array.from({ length: 1536 }, (_, i) => i === 0 ? 1 : 0);
const input = { text: "orchid tea", requestId: "tail-query", limit: 10 };
async function fixture() {
  let selected = profile;
  const f = memoryFixture({ profile: () => selected });
  const model: MemoryModel = {
    extract: async () => ({ facts: [{ fact: "User likes orchid tea", factType: "preference", subject: "User", predicate: "likes", object: "orchid tea", confidence: 0.9, tags: [], entities: [], relations: [] }] }),
    resolve: async () => { throw Error("UNEXPECTED_SECONDARY_MODEL"); },
    embed: async request => ({ profile: request.profile, vectors: request.texts.map(() => [...embedding]) }),
  };
  const writer = createActionMemoryRepository(f.actionCtx, f.reference, "write");
  await rememberMemory({ repository: writer, model, clock: { now: () => 1000 } },
    { text: "User likes orchid tea", lineage: explicitSourceLineage(memoryScope(f.reference), "tail-source") });
  const deliveries: MemoryDeliveryBindings[] = [], calls: string[] = [];
  let deliveryFault: (() => void) | undefined;
  const ctx = { ...f.actionCtx,
    runQuery: (async (ref, args) => { calls.push(getFunctionName(ref)); return f.actionCtx.runQuery(ref, args); }) as ActionCtx["runQuery"],
    runMutation: (async (ref, args) => {
      const name = getFunctionName(ref); calls.push(name);
      if (name === "runtimeMemory:finalDelivery") { deliveries.push(JSON.parse(JSON.stringify((args as { bindings: MemoryDeliveryBindings }).bindings)) as MemoryDeliveryBindings); deliveryFault?.(); }
      return f.actionCtx.runMutation(ref, args);
    }) as ActionCtx["runMutation"],
  };
  const repository = () => createActionMemoryRepository(ctx, f.reference, "read");
  return { ...f, model, deliveries, calls, repository, select: () => { selected = LARGE_EMBEDDING_PROFILE; },
    deliveryFault: (fn: () => void) => { deliveryFault = fn; } };
}
it.each(["staged", "legacy-serial"])("shared tail preserves nonempty native result, ranking/context and exact delivery bindings (%s)", async kind => {
  const f = await fixture();
  const originalNative = f.repository(), tailNative = f.repository();
  // The native stage port is nonenumerable; older injected adapter wrappers omit it.
  const original = kind === "legacy-serial" ? { ...originalNative } : originalNative;
  const tail = kind === "legacy-serial" ? { ...tailNative } : tailNative;
  const expected = await recallMemory({ repository: original, model: f.model, clock: { now: () => 1000 } }, input);
  const actual = await finishRecallFromEmbedding({ repository: tail, clock: { now: () => 1000 } }, input,
    { profile }, { profile, vectors: [[...embedding]] });
  expect(actual).toEqual(expected); expect(actual.items).toHaveLength(2);
  expect(actual.context).toContain("User likes orchid tea");
  expect(f.deliveries).toHaveLength(2); expect(f.deliveries[1]).toEqual(f.deliveries[0]);
  expect(f.deliveries[0].facts).toHaveLength(1); expect(f.deliveries[0].vectors).toHaveLength(1);
});
it.each(["revoked", "source-hash", "source-tombstone", "fact-version", "profile"])("fresh native final delivery refuses late %s in the shared tail", async fault => {
  const f = await fixture(), repository = f.repository();
  f.deliveryFault(() => {
    if (fault === "revoked") f.grant.revokedAt = 1000;
    if (fault === "source-hash") f.db.table("runtimeMemorySources")[0].contentHash = "a".repeat(64);
    if (fault === "source-tombstone") f.db.table("runtimeMemorySources")[0].tombstonedAt = 1000;
    if (fault === "fact-version") f.db.table("facts")[0].version = 2;
    if (fault === "profile") f.select();
  });
  await expect(finishRecallFromEmbedding({ repository, clock: { now: () => 1000 } }, input,
    { profile }, { profile, vectors: [[...embedding]] })).rejects.toThrow();
  expect(f.deliveries).toHaveLength(1); expect(f.calls.filter(name => name === "runtimeMemory:finalDelivery")).toHaveLength(1);
});
it("a real consumed grant expiry is checked again against the Action clock after final RPC returns", async () => {
  const nativeNow = jest.spyOn(Date, "now").mockReturnValue(1000);
  try {
    const f = await fixture(); f.grant.expiresAt = 2000;
    await expect(finishRecallFromEmbedding({ repository: f.repository(), clock: { now: () => 2000 } }, input,
      { profile }, { profile, vectors: [[...embedding]] })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    expect(f.deliveries).toHaveLength(1);
  } finally { nativeNow.mockRestore(); }
});
it.each(["profile", "dimensions", "nonfinite"])("invalid %s embedding starts no source/fact/vector delivery work", async fault => {
  const f = await fixture();
  const result = { profile: fault === "profile" ? LARGE_EMBEDDING_PROFILE : profile,
    vectors: fault === "dimensions" ? [[1]] : fault === "nonfinite" ? [[NaN, ...embedding.slice(1)]] : [[...embedding]] };
  await expect(finishRecallFromEmbedding({ repository: f.repository(), clock: { now: () => 1000 } }, input, { profile }, result)).rejects.toThrow();
  expect(f.calls).toEqual([]); expect(f.deliveries).toEqual([]);
});
