/** Managed-v2 projections for recall unit contracts; all authority is explicit. */
import { jest } from "@jest/globals";
import { derivedGraphIdentity, identityProperties, primaryGraphIdentity } from "../../src/graph/identity";
import type { GraphAdapter, GraphScope } from "../../src/graph/types";

export const recallScope: GraphScope = { tenantKnown: true, tenantId: "recall-tenant", memorySpaceId: "recall-space" };
export const expansionConfig = { maxDepth: 2, relationshipTypes: ["MENTIONS"], expandFromFacts: true, expandFromMemories: true };
export function entityNode(name: string, scope = recallScope) {
  return { ...derivedGraphIdentity("Entity", name, scope, "concept").properties, name: name.toLowerCase(), type: "concept" };
}
export function nativeNode(kind: "Memory" | "Fact", logicalId: string, physicalId: string, scope = recallScope) {
  return { ...identityProperties(primaryGraphIdentity(kind, physicalId, scope)), [kind === "Memory" ? "memoryId" : "factId"]: logicalId };
}
export function managedRecallFixture(nodes: Record<string, unknown>[] = [entityNode("related")]) {
  const seeds = new Map<string, ReturnType<typeof entityNode>>();
  const managedRead = jest.fn<(query: string, params?: Record<string, unknown>) => Promise<{ records: Record<string, unknown>[]; count: number }>>()
    .mockImplementation(async (query, params = {}) => {
      if (query.startsWith("MATCH (n:CortexV2Entity)")) {
        const name = String(params.name);
        const seed = seeds.get(name) ?? entityNode(name);
        seeds.set(name, seed);
        return { records: [{ node: seed }], count: 1 };
      }
      return { records: nodes.map(node => ({ nodes: [node], node })), count: nodes.length };
    });
  const isConnected = jest.fn<() => Promise<boolean>>().mockResolvedValue(true);
  const legacyRead = jest.fn();
  const adapter = { managedRead, isConnected, findNodes: legacyRead, traverse: legacyRead, query: legacyRead } as unknown as GraphAdapter;
  return { adapter, managedRead, isConnected, legacyRead, seeds, nodes };
}
