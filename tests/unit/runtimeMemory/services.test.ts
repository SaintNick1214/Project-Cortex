import { describe, expect, it } from "@jest/globals";
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
  it.each(["remember", "recall"])("registered public %s cannot invoke a provider without configured policy", async (operation) => {
    const f = setup();
    await expect(registeredHandler<{ text: string; requestId: string; tenantId: string; memorySpaceId: string }, unknown>(operation === "remember" ? remember : recall)(f.actionCtx as unknown as Parameters<ReturnType<typeof registeredHandler>>[0],
      { text: "dark", requestId: "public-1", tenantId: "tenant-a", memorySpaceId: "space-a" })).rejects.toMatchObject({ data: { code: "POLICY_NOT_CONFIGURED" } });
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
