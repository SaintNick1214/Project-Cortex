import { describe, expect, it, jest } from "@jest/globals";
import { getFunctionName } from "convex/server";
import type { MemoryModel } from "../../../src/domain/contracts";
import { DEFAULT_EMBEDDING_PROFILE } from "../../../src/domain/profile";
import { ConvexMemoryRepository, createActionMemoryRepository, memoryScope } from "../../../convex-dev/runtimeMemoryRepository";
import { explicitSourceLineage, recallMemory, rememberMemory, unconfiguredMemoryModel } from "../../../convex-dev/runtimeMemoryServices";
import { recall, remember } from "../../../convex-dev/runtimeMemory";
import { memoryFixture, registeredHandler } from "./fixture";

const result = { facts: [{ fact: "User prefers dark mode", factType: "preference", subject: "user-a", predicate: "prefers",
  object: "dark mode", confidence: 0.91, tags: ["ui"], entities: [], relations: [] }] };
function modelFixture() {
  const operations: { purpose: string; operationId: string; texts?: readonly string[] }[] = [];
  const model: MemoryModel = {
    extract: async (request) => { operations.push(request); return result; },
    resolve: async () => { throw new Error("Unexpected conflict/model recursion"); },
    embed: async (request) => { operations.push(request); return { profile: DEFAULT_EMBEDDING_PROFILE,
      vectors: request.texts.map(() => Array.from({ length: 1536 }, (_, i) => i === 0 ? 1 : 0)) }; },
  };
  return { model, operations };
}
function setup() {
  const f = memoryFixture(); const m = modelFixture();
  const repository = createActionMemoryRepository(f.actionCtx, f.reference, "write");
  const adapters = { repository, model: m.model, clock: { now: () => 1000 } };
  const lineage = explicitSourceLineage(memoryScope(f.reference), "request-1");
  return { ...f, ...m, repository, adapters, lineage };
}
describe("modern backend memory services", () => {
  it("persists normalized source/chunks/vectors and authoritative facts with one confidence conversion", async () => {
    const f = setup(); const outcome = await rememberMemory(f.adapters, { text: "  I prefer dark mode\r\n", lineage: f.lineage });
    expect(outcome).toMatchObject({ created: true, sourceRevision: 1, facts: [{ confidence: 91, ownerPrincipalId: f.principal._id }] });
    expect(f.db.table("facts")[0]!._id).toMatch(/^facts:/);
    expect(outcome.facts[0]).not.toHaveProperty("_id");
    expect(f.db.table("runtimeMemorySources")).toHaveLength(1);
    expect(f.db.table("runtimeMemorySources")[0]!.content).toBe("I prefer dark mode");
    expect(f.db.table("runtimeMemoryChunks")).toHaveLength(1);
    expect(f.db.table("runtimeMemoryVectors")).toHaveLength(1);
    expect(f.db.table("runtimeMemoryReceipts")).toHaveLength(1);
    expect(f.operations.map((op) => op.purpose)).toEqual(["memory.extract", "embedding.memory"]);
  });
  it("replays identical normalized source/derived payload without duplicate facts or receipts", async () => {
    const f = setup(); const first = await rememberMemory(f.adapters, { text: "dark", lineage: f.lineage });
    f.adapters.clock.now = () => 9000;
    const second = await rememberMemory(f.adapters, { text: " dark ", lineage: f.lineage });
    expect(second).toEqual({ ...first, created: false });
    expect(f.db.table("facts")).toHaveLength(1); expect(f.db.table("facts")[0]!.confidence).toBe(91);
    expect(f.db.table("runtimeMemoryReceipts")).toHaveLength(1);
    // Model seam gets stable operation identities; Task04 governs paid dispatch reuse.
    expect(f.operations[0]!.operationId).toBe(f.operations[2]!.operationId);
  });
  it("rejects source key reuse with different normalized content before a second model call", async () => {
    const f = setup(); await rememberMemory(f.adapters, { text: "dark", lineage: f.lineage });
    await expect(rememberMemory(f.adapters, { text: "light", lineage: f.lineage })).rejects.toMatchObject({ data: { code: "IDEMPOTENCY_CONFLICT" } });
    expect(f.operations).toHaveLength(2); expect(f.db.table("runtimeMemorySources")[0]!.content).toBe("dark");
  });
  it.each(["principal", "membership", "grant"] as const)("rejects revoked %s before inference or new data", async (record) => {
    const f = setup(); f[record].revokedAt = 2000;
    await expect(rememberMemory(f.adapters, { text: "dark", lineage: f.lineage })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    expect(f.operations).toHaveLength(0); expect(f.db.table("runtimeMemorySources")).toHaveLength(0);
  });
  it("rechecks revocation after extraction and before the next billable dispatch", async () => {
    const f = setup(); f.model.extract = async () => { f.operations.push({ purpose: "memory.extract", operationId: "extract" }); f.grant.revokedAt = 2000; return result; };
    await expect(rememberMemory(f.adapters, { text: "dark", lineage: f.lineage })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    expect(f.operations.map((op) => op.purpose)).toEqual(["memory.extract"]);
    expect(f.db.table("facts")).toHaveLength(0); expect(f.db.table("runtimeMemoryReceipts")).toHaveLength(0);
  });
  it("rechecks source tombstone before the next model dispatch", async () => {
    const f = setup(); f.model.extract = async () => { f.db.table("runtimeMemorySources")[0]!.tombstonedAt = 2000; return result; };
    await expect(rememberMemory(f.adapters, { text: "dark", lineage: f.lineage })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    expect(f.operations).toHaveLength(0); expect(f.db.table("runtimeMemoryVectors")).toHaveLength(0);
  });
  it("rejects revocation after embeddings without committing any derived data", async () => {
    const f = setup(); const embed = f.model.embed;
    f.model.embed = async (request) => { const output = await embed(request); f.grant.revokedAt = 2000; return output; };
    await expect(rememberMemory(f.adapters, { text: "dark", lineage: f.lineage })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    expect(f.db.table("facts")).toHaveLength(0); expect(f.db.table("runtimeMemoryChunks")).toHaveLength(0);
    expect(f.db.table("runtimeMemoryVectors")).toHaveLength(0); expect(f.db.table("runtimeMemoryReceipts")).toHaveLength(0);
  });
  it("embeds attributed assistant context without extracting assistant claims as facts", async () => {
    const f = setup(); await rememberMemory(f.adapters, { text: "I guess the user is a doctor", lineage: { ...f.lineage, role: "assistant", trust: "assistant_claim" } });
    expect(f.operations.map((op) => op.purpose)).toEqual(["embedding.memory"]);
    expect(f.db.table("facts")).toHaveLength(0); expect(f.db.table("runtimeMemoryVectors")).toHaveLength(1);
  });
  it("fails closed on incompatible model profile/dimensions before committing vectors", async () => {
    const f = setup(); f.model.embed = async () => ({ profile: { ...DEFAULT_EMBEDDING_PROFILE, modelId: "other-model" }, vectors: [[1]] });
    await expect(rememberMemory(f.adapters, { text: "dark", lineage: f.lineage })).rejects.toThrow("PROFILE_NOT_READY");
    expect(f.db.table("runtimeMemoryVectors")).toHaveLength(0); expect(f.db.table("facts")).toHaveLength(0);
  });
  it("uses actual scoped internal selection and shared ranking/context for recall", async () => {
    const f = setup(); await rememberMemory(f.adapters, { text: "dark", lineage: f.lineage });
    const recalled = await recallMemory({ ...f.adapters, repository: createActionMemoryRepository(f.actionCtx, f.reference, "read") }, { text: " preferences ", requestId: "recall-1", limit: 10 });
    expect(recalled.items).toHaveLength(2); expect(recalled.context).toContain("confidence: 91%");
    expect(recalled.context).toContain("[user]: dark"); expect(recalled.profileId).toBe(DEFAULT_EMBEDDING_PROFILE.profileId);
    expect(f.searches[0]).toMatchObject({ table: "runtimeMemoryVectors", index: "by_default_embedding_v1",
      filter: { key: "scopeProfileOwnerKey", value: JSON.stringify(["tenant-a", "space-a", DEFAULT_EMBEDDING_PROFILE.profileId, f.principal._id]) } });
  });
  it("delivers current facts when ordered belief resolution supersedes an unused preflight fact during query embedding", async () => {
    // Reproduces the observed Run2 ordering in client-checks/run2-fact-source-race.json:
    // first fact read -> query embedding await -> old fact superseded -> current facts read.
    // The pure peer controls timing; actual adapter/registered final delivery enforce freshness.
    const f = setup();
    f.model.extract = async () => ({ facts: [{ ...result.facts[0]!, subject: "User", predicate: "prefers",
      fact: "User prefers cobalt jasmine tea as their sandbox tea.", object: "cobalt jasmine tea" }] });
    await rememberMemory(f.adapters, { text: "My preferred sandbox tea is cobalt jasmine tea. Remember this preference for future chats.", lineage: f.lineage });
    const oldFact = f.db.table("facts")[0]!;
    f.model.extract = async () => ({ facts: [{ ...result.facts[0]!, subject: "User", predicate: "prefers",
      fact: "User prefers sandbox tea.", object: "sandbox tea" }] });
    await rememberMemory(f.adapters, { text: "What is my preferred sandbox tea? Recall the preference from my earlier chat.",
      lineage: explicitSourceLineage(memoryScope(f.reference), "request-2") });
    const currentFact = f.db.table("facts")[1]!;
    let enterEmbedding!: () => void; let releaseEmbedding!: () => void;
    const entered = new Promise<void>(resolve => { enterEmbedding = resolve; });
    const released = new Promise<void>(resolve => { releaseEmbedding = resolve; });
    const embed = f.model.embed;
    const queryEmbedding = jest.fn<MemoryModel["embed"]>(async request => {
      enterEmbedding(); await released; return await embed(request);
    });
    f.model.embed = queryEmbedding;
    const consumed: string[][] = [], factReadLimits: number[] = [];
    const ctx = { ...f.actionCtx, runQuery: (async (ref, args) => {
      if (getFunctionName(ref) === "runtimeMemory:readFacts") factReadLimits.push((args as { query: { limit: number } }).query.limit);
      return await f.actionCtx.runQuery(ref, args);
    }) as typeof f.actionCtx.runQuery, runMutation: (async (ref, args) => {
      if (getFunctionName(ref) === "runtimeMemory:finalDelivery") {
        consumed.push((args as { bindings: { facts: { factId: string }[] } }).bindings.facts.map(fact => fact.factId));
      }
      return await f.actionCtx.runMutation(ref, args);
    }) as typeof f.actionCtx.runMutation };
    const pending = recallMemory({ ...f.adapters, repository: createActionMemoryRepository(ctx, f.reference, "read") },
      { text: "sandbox tea", requestId: "recall-race", limit: 10 });
    await entered;
    await f.db.patch("facts", oldFact._id, { supersededBy: currentFact.factId, version: 2, updatedAt: 1791840847908 });
    releaseEmbedding();
    const recalled = await pending;
    expect(recalled.items.filter(item => item.type === "fact").map(item => item.id)).toEqual([currentFact.factId]);
    expect(recalled.context).toContain("User prefers sandbox tea.");
    expect(consumed).toEqual([[currentFact.factId]]);
    expect(factReadLimits).toEqual([10]);
    expect(queryEmbedding).toHaveBeenCalledTimes(1);
    expect(f.operations.filter(operation => operation.purpose === "embedding.query")).toHaveLength(1);
    expect(f.policyRequests).toHaveLength(0);
  });
  it("retains an independently authorized read preflight for an older injected adapter without assertReadAuthority", async () => {
    const f = setup(); await rememberMemory(f.adapters, { text: "dark", lineage: f.lineage });
    const reader = createActionMemoryRepository(f.actionCtx, f.reference, "read");
    const { assertReadAuthority: _optionalReadCheck, stageRecallReads: _optionalStagedReads, ...repository } = reader;
    const listFacts = jest.spyOn(repository, "listFacts");
    const recalled = await recallMemory({ ...f.adapters, repository }, { text: "dark", requestId: "legacy-read", limit: 10 });
    expect(recalled.context).toContain("User prefers dark mode");
    expect(listFacts.mock.calls).toEqual([[{ limit: 1 }], [{ limit: 10 }]]);
    expect(f.operations.filter(operation => operation.purpose === "embedding.query")).toHaveLength(1);
  });
  it.each(["current", "legacy"] as const)("%s write-only adapter denies recall before profile selection or embedding", async kind => {
    const f = setup(); f.grant.capabilities = ["write"];
    const reader = createActionMemoryRepository(f.actionCtx, f.reference, "write");
    const { assertReadAuthority: _optionalReadCheck, ...legacy } = reader;
    const repository = kind === "current" ? reader : legacy;
    const resolveProfile = jest.fn<NonNullable<MemoryModel["resolveProfile"]>>().mockResolvedValue({ profile: DEFAULT_EMBEDDING_PROFILE });
    const embed = jest.fn<MemoryModel["embed"]>(f.model.embed);
    await expect(recallMemory({ ...f.adapters, repository, model: { ...f.model, resolveProfile, embed } },
      { text: "dark", requestId: "write-only-read", limit: 10 })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    expect(resolveProfile).not.toHaveBeenCalled(); expect(embed).not.toHaveBeenCalled(); expect(f.db.writes).toBe(0);
  });
  it.each(["remember", "recall"])("registered public %s cannot invoke a provider without configured policy", async (operation) => {
    const f = setup();
    await expect(registeredHandler<{ text: string; requestId: string; tenantId: string; memorySpaceId: string }, unknown>(operation === "remember" ? remember : recall)(f.actionCtx as unknown as Parameters<ReturnType<typeof registeredHandler>>[0],
      { text: "dark", requestId: "public-1", tenantId: "tenant-a", memorySpaceId: "space-a" })).rejects.toMatchObject({ data: { version: 1, code: "CAPABILITY_UNAVAILABLE", message: "Memory capability unavailable.", retryable: false, outcome: "not_dispatched" } });
    expect(f.db.writes).toBe(0); expect(f.db.table("runtimeMemorySources")).toHaveLength(0);
    expect(f.db.table("facts")).toHaveLength(0); expect(f.db.table("runtimeMemoryVectors")).toHaveLength(0);
  });
  it("unconfigured resolve also fails closed and cannot enter public orchestration", async () => {
    await expect(unconfiguredMemoryModel().resolve({ purpose: "facts.resolve", operationId: "resolve", policyVersion: "p1", attempt: 1,
      system: "system", prompt: "prompt", candidate: {} as Parameters<MemoryModel["resolve"]>[0]["candidate"] })).rejects.toMatchObject({ data: { code: "POLICY_NOT_CONFIGURED" } });
  });
  it("query repository refuses writes even with a grant containing write", async () => {
    const f = setup(); const reader = new ConvexMemoryRepository(f.ctx, f.reference, "read");
    await expect(reader.putSource({} as Parameters<typeof reader.putSource>[0])).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    expect(f.db.writes).toBe(0);
  });
});

describe("remember write permission", () => {
  it("write-only memory admission returns only this successful commit's facts without a general read query", async () => {
    const f = setup(); f.grant.capabilities = ["write"];
    const outcome = await rememberMemory(f.adapters, { text: "dark", lineage: f.lineage });
    expect(outcome.facts).toHaveLength(1); expect(outcome.facts[0]).toMatchObject({ factId: f.db.table("facts")[0]!.factId, confidence: 91 });
    expect(outcome.facts[0]).not.toHaveProperty("_id");
    const calls = f.operations.length;
    await expect(recallMemory(f.adapters, { text: "dark", requestId: "read-forgery", limit: 1 })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    expect(f.operations).toHaveLength(calls);
    expect(f.db.table("facts")).toHaveLength(1);
  });
});
