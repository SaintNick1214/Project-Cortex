import type { ConvexClient } from "convex/browser";
import { getFunctionName } from "convex/server";
import { MemoryAPI, type MemoryAPIDependencies } from "../../src/memory";
import { FactsAPI } from "../../src/facts";
import { VectorAPI } from "../../src/vector";
import { createAuthContext } from "../../src/auth/context";
import type { SourceType } from "../../src/types";
import { enableDeploymentOperator } from "../../src/common/deploymentOperator";

const sources: SourceType[] = ["conversation", "system", "tool", "a2a", "fact-extraction"];
const filter = { memorySpaceId: "selected-space", tenantId: "selected-tenant", userId: "selected-user", participantId: "selected-participant", sourceType: "fact-extraction" as const };
function memory(id: string, overrides: Record<string, unknown> = {}) {
  return { _id: id, memoryId: `logical-${id}`, ...filter, content: id, contentType: "raw", sourceTimestamp: 1, importance: 50, tags: [], version: 1, previousVersions: [], createdAt: 1, updatedAt: 1, accessCount: 0, ...overrides };
}

/** Stateful explicit operator paging/cascade fixture. Public handler cases below
 * select a separate unmarked transport with a fixed authenticated tenant. */
function fixture(count = 129, operator = true) {
  const owned = Array.from({ length: count }, (_, index) => memory(`owned-${index}`));
  const controls = [memory("other-source", { sourceType: "system" }), memory("other-tenant", { tenantId: "foreign-tenant" }), memory("other-space", { memorySpaceId: "foreign-space" }), memory("other-user", { userId: "foreign-user" }), memory("other-participant", { participantId: "foreign-participant" })];
  let rows = [...owned, ...controls];
  const facts: Array<Record<string, any>> = [];
  let scans = 0;
  const state = { changeOnReselection: false };
  const calls: Array<{ name: string; args: Record<string, any> }> = [];
  const registrations: string[] = [];
  const selected = (args: Record<string, any>) => rows.filter(row => ["memorySpaceId", "tenantId", "userId", "participantId", "sourceType"].every(key => args[key] === undefined || (row as Record<string, unknown>)[key] === args[key]));
  const client = {
    query: async (reference: unknown, args: Record<string, any>) => {
      const registration = getFunctionName(reference as Parameters<typeof getFunctionName>[0]);
      registrations.push(registration);
      const name = registration.replace(/^cliOperator\//, "");
      calls.push({ name, args });
      if (name === "memories:count") return selected(operator ? args : { ...args, tenantId: filter.tenantId }).length;
      if (!operator && name === "memories:list") return selected({ ...args, tenantId: filter.tenantId }).slice(0, args.limit ?? 100);
      if (name === "facts:candidatePage") return { page: [], isDone: true, continueCursor: "end" };
      if (name !== "memories:domainPage") throw new Error(`Unexpected query ${name}`);
      if (args.paginationOpts.cursor === null) scans++;
      const start = Number(args.paginationOpts.cursor ?? 0);
      const matches = selected(args);
      const page = matches.slice(start, start + args.paginationOpts.numItems);
      return { page, isDone: start + page.length >= matches.length, continueCursor: String(start + page.length), fingerprints: Object.fromEntries(page.map(row => [row._id, (state.changeOnReselection && scans > 1 ? "b" : "a").repeat(64)])) };
    },
    mutation: async (reference: unknown, args: Record<string, any>) => {
      const registration = getFunctionName(reference as Parameters<typeof getFunctionName>[0]);
      registrations.push(registration);
      const name = registration.replace(/^cliOperator\//, "");
      calls.push({ name, args });
      if (!operator && name === "memories:count") return selected({ ...args, tenantId: filter.tenantId }).length;
      if (!operator && name === "memories:list") return selected({ ...args, tenantId: filter.tenantId }).slice(0, args.limit ?? 100);
      if (name === "memories:store") {
        const stored = memory("created-memory", { ...args, userId: args.userId, participantId: args.participantId });
        rows.push(stored);
        return stored;
      }
      if (name === "memories:update") {
        const stored = rows.find(row => row.memoryId === args.memoryId && row.memorySpaceId === args.memorySpaceId);
        if (!stored) throw new Error("Missing selected memory");
        stored.content = args.content;
        return stored;
      }
      if (name === "facts:store") {
        if (![...sources, "manual"].includes(args.sourceType)) throw new Error("Invalid native fact source");
        const stored = { _id: `fact-document-${facts.length}`, factId: `fact-${facts.length}`, ...args, version: 1, createdAt: 1, updatedAt: 1 };
        facts.push(stored);
        return stored;
      }
      if (name !== "memories:eraseSelected") throw new Error(`Unexpected mutation ${name}`);
      const row = rows.find(item => item._id === args.physicalId);
      if (!row || row.tenantId !== args.tenantId || row.memorySpaceId !== args.memorySpaceId || args.expectedFingerprint !== "a".repeat(64)) throw new Error("Wrong mutation target");
      rows = rows.filter(item => item._id !== row._id);
      return { deleted: true };
    },
  } as unknown as ConvexClient;
  if (operator) enableDeploymentOperator(client);
  return { client, calls, registrations, state, owned, controls, facts, remaining: () => rows };
}

function api(kind: "memory" | "vector", f: ReturnType<typeof fixture>, configured = true) {
  const authContext = configured ? createAuthContext({ userId: "actor", tenantId: filter.tenantId }) : undefined;
  return kind === "memory"
    ? new MemoryAPI(f.client, undefined, undefined, { authContext } as MemoryAPIDependencies)
    : new VectorAPI(f.client, undefined, undefined, authContext);
}

describe.each(["memory", "vector"] as const)("explicit operator %s source filters", kind => {
  test.each(sources)("count keeps the supported %s source and exact scope", async sourceType => {
    const f = fixture(1);
    const chosen = { ...filter, sourceType };
    const result = await api(kind, f).count(chosen);
    expect(result).toBe(sourceType === "fact-extraction" || sourceType === "system" ? 1 : 0);
    expect(f.calls).toEqual([{ name: "memories:count", args: chosen }]);
    expect(f.registrations).toEqual(["cliOperator/memories:count"]);
  });

  test.each([true, false])("list/count/clear cross the page boundary and preserve foreign controls (configured=%s)", async configured => {
    const f = fixture();
    const subject = api(kind, f, configured);
    expect(await subject.count(filter)).toBe(129);
    const listed = await subject.list({ ...filter, limit: 200 });
    expect(listed).toEqual(f.owned);
    expect(f.calls.filter(call => call.name === "memories:domainPage").map(call => call.args.paginationOpts.cursor)).toEqual([null, "128"]);
    const result = await subject.deleteMany(filter);
    expect(result).toMatchObject({ deleted: 129, memoryIds: f.owned.map(row => row.memoryId), partial: { confirmedCount: 129, remainingPhysicalIds: [], unknownPhysicalIds: [] } });
    if (kind === "memory") expect(result).toMatchObject({ factsDeleted: 0, factIds: [] });
    expect(f.remaining()).toEqual(f.controls);
    expect(await subject.count(filter)).toBe(0);
    expect(await subject.list({ ...filter, limit: 200 })).toEqual([]);
    for (const call of f.calls.filter(call => call.name.startsWith("memories:"))) {
      expect(call.args.tenantId).toBe(filter.tenantId);
      expect(call.args.memorySpaceId).toBe(filter.memorySpaceId);
      if (call.name !== "memories:eraseSelected") expect(call.args).toMatchObject(filter);
    }
    const mutations = f.calls.filter(call => call.name === "memories:eraseSelected");
    expect(mutations.map(call => call.args.physicalId)).toEqual(f.owned.map(row => row._id));
    expect(mutations.every(call => call.args.expectedFingerprint === "a".repeat(64))).toBe(true);
    if (kind === "memory") expect(mutations.every(call => call.args.requireNoLinkedFacts === true)).toBe(true);
  });

  test.each(["count", "list", "deleteMany"] as const)("%s rejects an invalid source before any transport", async method => {
    const f = fixture(1);
    await expect(api(kind, f)[method]({ ...filter, sourceType: "fact-extracton" } as any)).rejects.toMatchObject({ code: "INVALID_SOURCE_TYPE", field: "sourceType" });
    expect(f.calls).toEqual([]);
    expect(f.remaining()).toEqual([...f.owned, ...f.controls]);
  });

  test("a conflicting selected tenant refuses before reads or mutation", async () => {
    const f = fixture(1);
    await expect(api(kind, f).deleteMany({ ...filter, tenantId: "foreign-tenant" })).rejects.toThrow("TENANT_SCOPE_MISMATCH");
    expect(f.calls).toEqual([]);
    expect(f.remaining()).toEqual([...f.owned, ...f.controls]);
  });

  test("changed selected preimages refuse before destructive effects", async () => {
    const f = fixture(1);
    f.state.changeOnReselection = true;
    await expect(api(kind, f).deleteMany(filter)).rejects.toThrow("DOMAIN_SELECTION_CHANGED");
    expect(f.calls.some(call => call.name === "memories:eraseSelected")).toBe(false);
    expect(f.remaining()).toEqual([...f.owned, ...f.controls]);
  });

  test("an empty fact-extraction selection preserves all controls", async () => {
    const f = fixture(0);
    const result = await api(kind, f).deleteMany(filter);
    expect(result).toMatchObject({ deleted: 0, memoryIds: [], partial: { confirmedCount: 0, outcomes: [] } });
    expect(f.remaining()).toEqual(f.controls);
    expect(f.calls.some(call => call.name === "memories:eraseSelected")).toBe(false);
  });
});

describe.each(["memory", "vector"] as const)("public %s registered source filters", kind => {
  test.each(sources)("count forwards supported %s without unsupported authority selectors", async sourceType => {
    const f = fixture(1, false);
    const chosen = { memorySpaceId: filter.memorySpaceId, userId: filter.userId, sourceType };
    const result = await api(kind, f).count(chosen);
    expect(result).toBe(sourceType === "fact-extraction" ? 2 : sourceType === "system" ? 1 : 0);
    expect(f.calls).toEqual([{ name: "memories:count", args: chosen }]);
    expect(f.registrations).toEqual(["memories:count"]);
  });
  test("list uses the registered scoped handler and preserves foreign controls", async () => {
    const f = fixture(1, false);
    const chosen = { memorySpaceId: filter.memorySpaceId, userId: filter.userId, sourceType: filter.sourceType, limit: 20 };
    const result = await api(kind, f).list(chosen);
    expect(result).toEqual([f.owned[0], f.controls[4]]);
    expect(f.registrations).toEqual(["memories:list"]);
    expect(f.calls[0].args).toMatchObject(chosen);
    expect(f.calls[0].args).not.toHaveProperty("tenantId");
    expect(f.calls[0].args).not.toHaveProperty("participantId");
    expect(f.remaining()).toEqual([...f.owned, ...f.controls]);
  });
  test.each(["list", "count"] as const)("%s refuses an explicitly requested participant selector before I/O", async method => {
    const f = fixture(1, false);
    await expect(api(kind, f)[method](filter)).rejects.toMatchObject({ code: "UNSUPPORTED_PUBLIC_SELECTOR", selector: "participantId" });
    expect(f.calls).toEqual([]); expect(f.remaining()).toEqual([...f.owned, ...f.controls]);
  });
});

test("MemoryAPI clear still requires an additional destructive filter", async () => {
  const f = fixture(1);
  await expect(api("memory", f).deleteMany({ memorySpaceId: filter.memorySpaceId, tenantId: filter.tenantId })).rejects.toMatchObject({ code: "INVALID_FILTER" });
  expect(f.calls).toEqual([]);
  expect(f.remaining()).toEqual([...f.owned, ...f.controls]);
});

test.each(["store", "update"] as const)("memory %s forwards fact-extraction provenance through the actual FactsAPI", async method => {
  const f = fixture(method === "store" ? 0 : 1);
  const subject = api("memory", f) as MemoryAPI;
  const extractFacts = async (content: string) => [{ fact: `extracted ${content}`, factType: "knowledge" as const, confidence: 90 }];
  const result = method === "store"
    ? await subject.store(filter.memorySpaceId, { content: "new text", contentType: "raw", source: { type: "fact-extraction" }, metadata: { importance: 50, tags: ["kept-tag"] }, tenantId: filter.tenantId, userId: filter.userId, participantId: filter.participantId, extractFacts })
    : await subject.update(filter.memorySpaceId, f.owned[0].memoryId, { content: "new text" }, { reextractFacts: true, extractFacts });
  const returnedFacts = "facts" in result ? result.facts : result.factsReextracted;
  expect(returnedFacts).toEqual(f.facts);
  expect(f.facts).toHaveLength(1);
  expect(f.facts[0]).toMatchObject({ memorySpaceId: filter.memorySpaceId, tenantId: filter.tenantId, userId: filter.userId, participantId: filter.participantId, sourceType: "fact-extraction", fact: "extracted new text", sourceRef: { memoryId: result.memory.memoryId } });
  expect(f.remaining().filter(row => row._id.startsWith("other-"))).toEqual(f.controls);
  expect(f.calls.filter(call => call.name === "facts:store")).toHaveLength(1);
});

test.each([...sources, "manual"] as const)("actual fact store retains its six-source %s contract", async sourceType => {
  const f = fixture(0);
  const subject = new FactsAPI(f.client, undefined, undefined, createAuthContext({ userId: "actor", tenantId: filter.tenantId }));
  const result = await subject.store({ memorySpaceId: filter.memorySpaceId, userId: filter.userId, participantId: filter.participantId, fact: "owned fact", factType: "knowledge", confidence: 90, sourceType });
  expect(result).toMatchObject({ sourceType, tenantId: filter.tenantId, fact: "owned fact" });
  expect(f.calls).toHaveLength(1);
  expect(f.facts).toEqual([result]);
});

test("actual fact store still rejects an invalid source before effects", async () => {
  const f = fixture(0);
  const subject = new FactsAPI(f.client);
  await expect(subject.store({ memorySpaceId: filter.memorySpaceId, fact: "owned fact", factType: "knowledge", confidence: 90, sourceType: "fact-extracton" } as any)).rejects.toMatchObject({ code: "INVALID_SOURCE_TYPE", field: "sourceType" });
  expect(f.calls).toEqual([]);
  expect(f.facts).toEqual([]);
  expect(f.remaining()).toEqual(f.controls);
});

test.each(["memory", "vector"] as const)("%s filters keep manual exclusive to the fact provenance contract", async kind => {
  const f = fixture(1);
  await expect(api(kind, f).count({ ...filter, sourceType: "manual" } as any)).rejects.toMatchObject({ code: "INVALID_SOURCE_TYPE" });
  expect(f.calls).toEqual([]);
});
