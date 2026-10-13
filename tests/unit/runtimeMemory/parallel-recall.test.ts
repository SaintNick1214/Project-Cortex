/** Actual read adapters/handlers with controlled DB and model ports; no managed
 * ANN, provider billing, native OCC, or wall-clock SLO evidence is claimed. */
import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { getFunctionName } from "convex/server";
import type { MemoryModel, MemoryRepository } from "../../../src/domain/contracts";
import { DEFAULT_EMBEDDING_PROFILE as profile } from "../../../src/domain/profile";
import { createActionMemoryRepository, memoryScope } from "../../../convex-dev/runtimeMemoryRepository";
import type { MemoryDeliveryBindings } from "../../../convex-dev/runtimeMemoryRepository";
import { explicitSourceLineage, recallMemory, rememberMemory } from "../../../convex-dev/runtimeMemoryServices";
import { memoryFixture } from "./fixture";

afterEach(() => { jest.restoreAllMocks(); });
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const embedding = Array.from({ length: profile.dimensions }, (_, i) => i === 0 ? 1 : 0);
const request = { text: "preferences", requestId: "parallel-query", limit: 10 };
function peer() {
  const f = memoryFixture();
  const { stageRecallReads: _staged, ...unstaged } = createActionMemoryRepository(f.actionCtx, f.reference, "read");
  const repository: MemoryRepository = unstaged;
  const calls: string[] = [];
  const authority = jest.spyOn(repository, "recheckAuthority").mockImplementation(async () => { calls.push("authority"); });
  const read = jest.spyOn(repository, "assertReadAuthority").mockImplementation(async () => { calls.push("read"); });
  const ready = jest.spyOn(repository, "assertProfileReady").mockImplementation(async () => { calls.push("ready"); });
  const vectors = jest.spyOn(repository, "searchVectors").mockImplementation(async () => { calls.push("vectors"); return []; });
  const facts = jest.spyOn(repository, "listFacts").mockImplementation(async () => { calls.push("facts"); return []; });
  const delivery = jest.spyOn(repository, "finalDelivery").mockImplementation(async () => { calls.push("delivery"); return { version: 1 }; });
  repository.stageRecallReads = () => ({ searchVectors: repository.searchVectors, listFacts: repository.listFacts, commit: () => {} });
  const resolveProfile = jest.fn<NonNullable<MemoryModel["resolveProfile"]>>(async () => { calls.push("profile"); return { profile }; });
  const embed = jest.fn<MemoryModel["embed"]>(async () => { calls.push("embed"); return { profile, vectors: [embedding] }; });
  const model: MemoryModel = { resolveProfile, embed, extract: async () => { throw Error("UNEXPECTED_EXTRACT"); }, resolve: async () => { throw Error("UNEXPECTED_RESOLVE"); } };
  return { repository, model, calls, authority, read, ready, vectors, facts, delivery, resolveProfile, embed,
    adapters: { repository, model, clock: { now: () => 1000 } } };
}
describe("recall guarded branch settlement", () => {
  it("starts both reads only after every original guard and one validated embedding, and joins before delivery", async () => {
    const f = peer(), embedded = deferred<Awaited<ReturnType<MemoryModel["embed"]>>>(), embedStarted = deferred<void>();
    const vectorStarted = deferred<void>(), factStarted = deferred<void>();
    const vector = deferred<Awaited<ReturnType<MemoryRepository["searchVectors"]>>>(), fact = deferred<Awaited<ReturnType<MemoryRepository["listFacts"]>>>();
    f.embed.mockImplementation(async () => { f.calls.push("embed"); embedStarted.resolve(); return embedded.promise; });
    f.vectors.mockImplementation(async () => { f.calls.push("vectors"); vectorStarted.resolve(); return vector.promise; });
    f.facts.mockImplementation(async () => { f.calls.push("facts"); factStarted.resolve(); return fact.promise; });
    const pending = recallMemory(f.adapters, request);
    await embedStarted.promise;
    expect(f.calls).toEqual(["authority", "read", "profile", "ready", "embed"]);
    expect(f.vectors).not.toHaveBeenCalled(); expect(f.facts).not.toHaveBeenCalled();
    embedded.resolve({ profile, vectors: [embedding] }); await Promise.all([vectorStarted.promise, factStarted.promise]);
    expect(f.vectors).toHaveBeenCalledWith({ text: request.text, profile, embedding }, request.limit);
    expect(f.facts).toHaveBeenCalledWith({ limit: request.limit });
    fact.resolve([]); await Promise.resolve(); expect(f.delivery).not.toHaveBeenCalled();
    vector.resolve([]); expect(await pending).toEqual({ items: [], context: "", profileId: profile.profileId });
    expect(f.calls).toEqual(["authority", "read", "profile", "ready", "embed", "vectors", "facts", "authority", "delivery"]);
    expect(f.embed).toHaveBeenCalledTimes(1);
  });
  it.each(["request", "limit", "text", "authority", "read", "profile", "ready", "embed", "embedding-profile", "embedding-dimensions", "embedding-nonfinite"])(
    "starts neither recall branch on %s failure", async failure => {
      const f = peer(); let input = request;
      if (failure === "request") input = { ...request, requestId: "" };
      if (failure === "limit") input = { ...request, limit: 0 };
      if (failure === "text") input = { ...request, text: " " };
      const fail = async () => { throw Error(`GUARD_${failure}`); };
      if (failure === "authority") f.authority.mockImplementation(fail);
      if (failure === "read") f.read.mockImplementation(fail);
      if (failure === "profile") f.resolveProfile.mockImplementation(fail);
      if (failure === "ready") f.ready.mockImplementation(fail);
      if (failure === "embed") f.embed.mockImplementation(fail);
      if (failure === "embedding-profile") f.embed.mockResolvedValue({ profile: { ...profile, modelId: "incompatible" }, vectors: [embedding] });
      if (failure === "embedding-dimensions") f.embed.mockResolvedValue({ profile, vectors: [[1]] });
      if (failure === "embedding-nonfinite") f.embed.mockResolvedValue({ profile, vectors: [[NaN, ...embedding.slice(1)]] });
      await expect(recallMemory(f.adapters, input)).rejects.toThrow();
      expect(f.vectors).not.toHaveBeenCalled(); expect(f.facts).not.toHaveBeenCalled(); expect(f.delivery).not.toHaveBeenCalled();
      expect(f.embed).toHaveBeenCalledTimes(["embed", "embedding-profile", "embedding-dimensions", "embedding-nonfinite"].includes(failure) ? 1 : 0);
    });
  it.each(["vector-first", "fact-first"])("owns both late failures with vector error priority (%s)", async order => {
    const f = peer(), vectors = deferred<never>(), facts = deferred<never>();
    const vectorStarted = deferred<void>(), factStarted = deferred<void>();
    const vectorError = new Error("VECTOR_READ_FAILED"), factError = new Error("FACT_READ_FAILED");
    f.vectors.mockImplementation(async () => { vectorStarted.resolve(); return vectors.promise; });
    f.facts.mockImplementation(async () => { factStarted.resolve(); return facts.promise; });
    let settled = false;
    const pending = recallMemory(f.adapters, request).then(value => { settled = true; return value; }, error => { settled = true; return error; });
    await Promise.all([vectorStarted.promise, factStarted.promise]);
    (order === "vector-first" ? vectors : facts).reject(order === "vector-first" ? vectorError : factError);
    await Promise.resolve(); await Promise.resolve(); expect(settled).toBe(false); expect(f.delivery).not.toHaveBeenCalled();
    (order === "vector-first" ? facts : vectors).reject(order === "vector-first" ? factError : vectorError);
    expect(await pending).toBe(vectorError); expect(f.embed).toHaveBeenCalledTimes(1); expect(f.delivery).not.toHaveBeenCalled();
  });
  it.each(["vector", "fact"])("owns a synchronous %s throw and the peer's later rejection", async branch => {
    const f = peer(), late = deferred<never>(), started = deferred<void>();
    const vectorError = Error("SYNC_OR_LATE_VECTOR"), factError = Error("SYNC_OR_LATE_FACT");
    f.vectors.mockImplementation(() => { if (branch === "vector") throw vectorError; started.resolve(); return late.promise; });
    f.facts.mockImplementation(() => { if (branch === "fact") throw factError; started.resolve(); return late.promise; });
    let settled = false;
    const pending = recallMemory(f.adapters, request).catch(error => { settled = true; return error; });
    await started.promise; await Promise.resolve(); expect(settled).toBe(false);
    late.reject(branch === "vector" ? factError : vectorError);
    expect(await pending).toBe(vectorError); expect(f.vectors).toHaveBeenCalledTimes(1); expect(f.facts).toHaveBeenCalledTimes(1); expect(f.delivery).not.toHaveBeenCalled();
  });
  it.each(["vector", "fact"])("does not commit or deliver when only %s fails", async branch => {
    const f = peer(), error = Error(`ONLY_${branch}_FAILED`), commit = jest.fn();
    f.repository.stageRecallReads = () => ({ searchVectors: f.repository.searchVectors, listFacts: f.repository.listFacts, commit });
    (branch === "vector" ? f.vectors : f.facts).mockRejectedValue(error);
    await expect(recallMemory(f.adapters, request)).rejects.toBe(error);
    expect(commit).not.toHaveBeenCalled(); expect(f.delivery).not.toHaveBeenCalled(); expect(f.embed).toHaveBeenCalledTimes(1);
  });
  it("owns both synchronous branch throws and preserves vector priority", async () => {
    const f = peer(), vectorError = Error("SYNCHRONOUS_VECTOR"), factError = Error("SYNCHRONOUS_FACT");
    f.vectors.mockImplementation(() => { throw vectorError; }); f.facts.mockImplementation(() => { throw factError; });
    await expect(recallMemory(f.adapters, request)).rejects.toBe(vectorError);
    expect(f.vectors).toHaveBeenCalledTimes(1); expect(f.facts).toHaveBeenCalledTimes(1); expect(f.delivery).not.toHaveBeenCalled();
  });
  it("keeps unstaged injected adapters serial and does not start facts after vector failure", async () => {
    const f = peer(), error = Error("LEGACY_VECTOR_FAILED"); delete f.repository.stageRecallReads;
    f.vectors.mockRejectedValue(error);
    await expect(recallMemory(f.adapters, request)).rejects.toBe(error);
    expect(f.vectors).toHaveBeenCalledTimes(1); expect(f.facts).not.toHaveBeenCalled(); expect(f.delivery).not.toHaveBeenCalled();
    expect(f.embed).toHaveBeenCalledTimes(1);
  });
});

async function nativeFixture() {
  const f = memoryFixture();
  const model: MemoryModel = { extract: async () => ({ facts: [{ fact: "User likes tea", factType: "preference", subject: "User", predicate: "likes", object: "tea", confidence: 0.91, tags: [], entities: [], relations: [] }] }),
    resolve: async () => { throw Error("UNEXPECTED_RESOLVE"); }, embed: async request => ({ profile: request.profile, vectors: request.texts.map(() => embedding) }) };
  const writer = createActionMemoryRepository(f.actionCtx, f.reference, "write");
  for (const id of ["fact-only", "shared", "vector-only"]) await rememberMemory({ repository: writer, model, clock: { now: () => 1000 } },
    { text: `Evidence from ${id}`, lineage: explicitSourceLineage(memoryScope(f.reference), id) });
  const sources = f.db.table("runtimeMemorySources");
  const ids = sources.map(row => (row.lineage as { sourceId: string }).sourceId);
  f.db.rows.set("facts", f.db.table("facts").filter(row => (row.lineage as { sourceId: string }).sourceId !== ids[2]));
  f.db.rows.set("runtimeMemoryVectors", f.db.table("runtimeMemoryVectors").filter(row => row.sourceId !== ids[0]));
  const bindings: MemoryDeliveryBindings[] = [];
  const ctx = { ...f.actionCtx, runMutation: (async (ref, args) => {
    if (getFunctionName(ref) === "runtimeMemory:finalDelivery") bindings.push(JSON.parse(JSON.stringify((args as { bindings: MemoryDeliveryBindings }).bindings)) as MemoryDeliveryBindings);
    return f.actionCtx.runMutation(ref, args);
  }) as typeof f.actionCtx.runMutation };
  return { ...f, model, ctx, bindings, ids };
}
describe("actual Action branch bookkeeping", () => {
  it.each(["vector-first", "fact-first"])("overlaps native reads and keeps exact serial result/context/delivery bindings (%s)", async order => {
    const f = await nativeFixture();
    const serial = createActionMemoryRepository(f.ctx, f.reference, "read");
    // Reference peer forces the accepted serial read/capture order while using
    // the original actual adapter methods, not the new staging implementation.
    const serialDone = deferred<void>();
    serial.stageRecallReads = () => ({ searchVectors: async (...args) => { try { return await serial.searchVectors(...args); } finally { serialDone.resolve(); } },
      listFacts: async query => { await serialDone.promise; return serial.listFacts(query); }, commit: () => {} });
    const expected = await recallMemory({ repository: serial, model: f.model, clock: { now: () => 1000 } }, request);
    const vectorStarted = deferred<void>(), factStarted = deferred<void>(), vectorRelease = deferred<void>(), factRelease = deferred<void>();
    const completed: string[] = [], vectorRead = deferred<void>(), factRead = deferred<void>();
    const ctx = { ...f.ctx, runQuery: (async (ref, args) => {
      const name = getFunctionName(ref);
      if (name === "runtimeMemory:readFacts") { factStarted.resolve(); await factRelease.promise; }
      if (name === "runtimeMemory:readVectorMatches") { vectorStarted.resolve(); await vectorRelease.promise; }
      const value = await f.ctx.runQuery(ref, args);
      if (name === "runtimeMemory:readFacts") { completed.push("fact"); factRead.resolve(); }
      if (name === "runtimeMemory:readVectorMatches") { completed.push("vector"); vectorRead.resolve(); }
      return value;
    }) as typeof f.ctx.runQuery };
    const pending = recallMemory({ repository: createActionMemoryRepository(ctx, f.reference, "read"), model: f.model, clock: { now: () => 1000 } }, request);
    await Promise.all([vectorStarted.promise, factStarted.promise]); expect(f.bindings).toHaveLength(1);
    (order === "vector-first" ? vectorRelease : factRelease).resolve();
    // Wait for an actual branch read completion before releasing its peer.
    await (order === "vector-first" ? vectorRead : factRead).promise;
    (order === "vector-first" ? factRelease : vectorRelease).resolve();
    expect(await pending).toEqual(expected); expect(f.bindings[1]).toEqual(f.bindings[0]);
    expect(completed).toEqual(order === "vector-first" ? ["vector", "fact"] : ["fact", "vector"]);
    expect(f.bindings[1]!.sources.map(value => [value.sourceId, value.permission])).toEqual([
      [f.ids[1], "canViewMemories"], [f.ids[2], "canViewMemories"], [f.ids[0], "canViewFacts"], [f.ids[1], "canViewFacts"],
    ]);
    expect(f.bindings[1]!.facts).toHaveLength(2); expect(f.bindings[1]!.vectors).toHaveLength(2);
    expect(expected.items).toHaveLength(4);
  });
});
