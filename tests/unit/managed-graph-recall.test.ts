import { describe, it, expect, jest } from "@jest/globals";
import { expandViaGraph, extractEntitiesFromQuery, fetchRelatedMemories, fetchRelatedFacts, performGraphExpansion } from "../../src/memory/recall/graphEnhancement";
import { entityNode, nativeNode, managedRecallFixture, recallScope, expansionConfig } from "../helpers/managed-recall-fixture";

describe("managed graph expansion bounds and identity", () => {
  it.each([undefined, 3])("bounds initial seeds with entitiesPerHop=%s", async entitiesPerHop => {
    const f = managedRecallFixture();
    const names = Array.from({ length: 10 }, (_, n) => `entity${n}`);
    expect(await expandViaGraph(names, f.adapter, { ...expansionConfig, entitiesPerHop }, recallScope)).toEqual(["related"]);
    expect(f.managedRead.mock.calls.filter(([query]) => query.startsWith("MATCH (n:"))).toHaveLength(entitiesPerHop ?? 5);
    expect(f.legacyRead).not.toHaveBeenCalled();
  });
  it("uses only the exact tenant and space, allowed relations and bounded depth", async () => {
    const f = managedRecallFixture();
    await expandViaGraph(["initial"], f.adapter, { ...expansionConfig, maxDepth: 3 }, recallScope);
    const [query, args] = f.managedRead.mock.calls[1];
    expect(query).toContain("[*1..3]");
    expect(args).toMatchObject({ tenantTag: "tenant", tenantValue: "recall-tenant", space: "recall-space", relationships: ["MENTIONS"] });
    expect(query).toContain("all(n IN nodes(path)");
    expect(query).toContain("r.sourceTuple=startNode(r).tupleJson");
  });
  it.each([{ maxDepth: 11 }, { maxDepth: 1.5 }, { entitiesPerHop: 0 }, { entitiesPerHop: 65 }, { relationshipTypes: ["UNSCOPED"] }])("refuses invalid finite options %p before I/O", async change => {
    const f = managedRecallFixture();
    await expect(expandViaGraph(["initial"], f.adapter, { ...expansionConfig, ...change }, recallScope)).rejects.toMatchObject({ code: "GRAPH_QUERY_BUDGET" });
    expect(f.managedRead).not.toHaveBeenCalled();
  });
  it("keeps empty seed and disabled depth as true no-ops", async () => {
    const f = managedRecallFixture();
    expect(await expandViaGraph([], f.adapter, expansionConfig)).toEqual([]);
    expect(await expandViaGraph(["initial"], f.adapter, { ...expansionConfig, maxDepth: 0 })).toEqual([]);
    expect(f.managedRead).not.toHaveBeenCalled();
  });
  it("refuses unknown authority before reading", async () => {
    const f = managedRecallFixture();
    await expect(expandViaGraph(["initial"], f.adapter, expansionConfig)).rejects.toMatchObject({ code: "GRAPH_IDENTITY_REQUIRED" });
    expect(f.managedRead).not.toHaveBeenCalled();
  });
  it("refuses missing managed reads rather than using an unscoped adapter", async () => {
    const f = managedRecallFixture(); delete f.adapter.managedRead;
    await expect(expandViaGraph(["initial"], f.adapter, expansionConfig, recallScope)).rejects.toMatchObject({ code: "GRAPH_SCHEMA_MIGRATION_REQUIRED" });
    expect(f.legacyRead).not.toHaveBeenCalled();
  });
  it("propagates read failures rather than returning a misleading empty success", async () => {
    const f = managedRecallFixture(); f.managedRead.mockRejectedValueOnce(new Error("managed read failed"));
    await expect(expandViaGraph(["initial"], f.adapter, expansionConfig, recallScope)).rejects.toThrow("managed read failed");
    expect(f.legacyRead).not.toHaveBeenCalled();
  });
  it.each(["seed", "path"])("refuses over-budget %s results", async stage => {
    const f = managedRecallFixture();
    if (stage === "path") f.managedRead.mockResolvedValueOnce({ records: [{ node: entityNode("initial") }], count: 1 });
    f.managedRead.mockResolvedValueOnce({ records: [], count: 65 });
    await expect(expandViaGraph(["initial"], f.adapter, expansionConfig, recallScope)).rejects.toMatchObject({ code: "GRAPH_QUERY_BUDGET" });
  });
  it.each([entityNode("foreign", { ...recallScope, tenantId: "foreign" }), entityNode("foreign", { ...recallScope, memorySpaceId: "foreign" }), { ...entityNode("bad"), key: "substituted" }, { kind: "LegacyEntity", name: "bad" }])("rejects mismatched or legacy path projection %p", async node => {
    const f = managedRecallFixture([node]);
    await expect(expandViaGraph(["initial"], f.adapter, expansionConfig, recallScope)).rejects.toMatchObject({ code: "GRAPH_IDENTITY_MISMATCH" });
  });
  it("deduplicates entities and captures exact native physical selections", async () => {
    const f = managedRecallFixture([entityNode("initial"), entityNode("related"), entityNode("related"), nativeNode("Memory", "memory1", "physical1")]);
    const selected: Parameters<typeof expandViaGraph>[4] = [];
    expect(await expandViaGraph(["initial"], f.adapter, expansionConfig, recallScope, selected)).toEqual(["related"]);
    expect(selected).toEqual([{ kind: "Memory", physicalSourceId: "physical1", logicalId: "memory1", scope: recallScope }]);
  });
  it("query extraction uses managed scope and refuses unavailable connections", async () => {
    const f = managedRecallFixture();
    expect(await extractEntitiesFromQuery("initial related", f.adapter, recallScope)).toContain("initial");
    expect(f.managedRead.mock.calls[0][1]).toMatchObject({ tenantValue: "recall-tenant", space: "recall-space" });
    f.isConnected.mockResolvedValue(false);
    await expect(extractEntitiesFromQuery("initial", f.adapter, recallScope)).rejects.toMatchObject({ code: "GRAPH_EXPANSION_UNAVAILABLE" });
  });
});

describe("graph native rereads and pipeline limits", () => {
  function selections(kind: "Memory" | "Fact", count = 8) {
    return Array.from({ length: count }, (_, i) => ({ kind, logicalId: `${kind}${i}`, physicalSourceId: `physical-${kind}${i}`, scope: recallScope }));
  }
  function reader(kind: "Memory" | "Fact") {
    const get = jest.fn<(...args: unknown[]) => Promise<unknown>>().mockImplementation(async (_space, id) => ({
      _id: `physical-${String(id)}`, memorySpaceId: recallScope.memorySpaceId, tenantId: recallScope.tenantId,
      [kind === "Memory" ? "memoryId" : "factId"]: id,
    }));
    return { get, search: jest.fn(), queryBySubject: jest.fn() };
  }
  it.each(["Memory", "Fact"] as const)("limits exact %s rereads and skips already processed IDs", async kind => {
    const api = reader(kind), selected = selections(kind), processed = new Set([`${kind}0`]);
    const results = kind === "Memory"
      ? await fetchRelatedMemories(["related"], "recall-space", api as never, processed, 2, selected, recallScope)
      : await fetchRelatedFacts(["related"], "recall-space", api as never, processed, 2, selected, recallScope);
    expect(results).toHaveLength(2); expect(api.get).toHaveBeenCalledTimes(2);
    expect(api.get).toHaveBeenNthCalledWith(1, "recall-space", `${kind}1`, { tenantId: "recall-tenant" });
    expect(processed).toEqual(new Set([`${kind}0`, `${kind}1`, `${kind}2`]));
    expect(api.search).not.toHaveBeenCalled(); expect(api.queryBySubject).not.toHaveBeenCalled();
  });
  it.each(["Memory", "Fact"] as const)("does not adopt a logical replacement for physical %s", async kind => {
    const api = reader(kind); api.get.mockResolvedValue({ _id: "replacement", memorySpaceId: "recall-space", tenantId: "recall-tenant" });
    const result = kind === "Memory"
      ? fetchRelatedMemories([], "recall-space", api as never, new Set(), 2, selections(kind), recallScope)
      : fetchRelatedFacts([], "recall-space", api as never, new Set(), 2, selections(kind), recallScope);
    await expect(result).rejects.toMatchObject({ code: "GRAPH_PRIMARY_CHANGED" });
  });
  it("does not search by entity names when no physical selection exists", async () => {
    const api = reader("Memory");
    expect(await fetchRelatedMemories(["related"], "recall-space", api as never, new Set(), 10, [], recallScope)).toEqual([]);
    expect(api.get).not.toHaveBeenCalled(); expect(api.search).not.toHaveBeenCalled();
  });
  it.each([0, -1, 1.5])("handles finite result window %s before rereads", async limit => {
    const api = reader("Memory"), result = fetchRelatedMemories([], "recall-space", api as never, new Set(), limit, selections("Memory"), recallScope);
    if (limit === 0) expect(await result).toEqual([]);
    else await expect(result).rejects.toMatchObject({ code: "GRAPH_QUERY_BUDGET" });
    expect(api.get).not.toHaveBeenCalled();
  });
  it("refuses owning-space mismatch before native reads", async () => {
    const api = reader("Memory");
    await expect(fetchRelatedMemories([], "foreign-space", api as never, new Set(), 1, selections("Memory"), recallScope)).rejects.toMatchObject({ code: "GRAPH_IDENTITY_REQUIRED" });
    expect(api.get).not.toHaveBeenCalled();
  });
  it.each([undefined, 1])("pipeline keeps default or explicit results-per-entity=%s", async resultsPerEntity => {
    const selected = [...selections("Memory"), ...selections("Fact")];
    const f = managedRecallFixture([entityNode("one"), entityNode("two"), ...selected.map(s => nativeNode(s.kind, s.logicalId, s.physicalSourceId))]);
    const memory = reader("Memory"), facts = reader("Fact");
    const result = await performGraphExpansion([], [{ subject: "initial", factId: "already" }] as never,
      "recall-space", f.adapter, memory as never, facts as never, { ...expansionConfig, entitiesPerHop: 2, resultsPerEntity }, undefined, recallScope);
    expect(result.discoveredEntities).toEqual(["one", "two"]);
    expect(result.relatedMemories).toHaveLength(2 * (resultsPerEntity ?? 3));
    expect(result.relatedFacts).toHaveLength(2 * (resultsPerEntity ?? 3));
    expect(result.processedIds.has("already")).toBe(true);
  });
  it("graph-off pipeline retains processed IDs with no graph or native calls", async () => {
    const f = managedRecallFixture(), memory = reader("Memory"), facts = reader("Fact");
    const result = await performGraphExpansion([{ memoryId: "already" }] as never, [], "recall-space", undefined,
      memory as never, facts as never, expansionConfig);
    expect(result).toEqual({ discoveredEntities: [], relatedMemories: [], relatedFacts: [], processedIds: new Set(["already"]) });
    expect(f.managedRead).not.toHaveBeenCalled(); expect(memory.get).not.toHaveBeenCalled(); expect(facts.get).not.toHaveBeenCalled();
  });
});
