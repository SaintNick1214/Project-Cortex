import { describe, expect, it, jest } from "@jest/globals";
import { MANAGED_KINDS, MANAGED_LABELS } from "../../src/graph/identity";
import {
  dropGraphSchema,
  initializeGraphSchema,
  verifyGraphSchema,
} from "../../src/graph/schema/initSchema";
import type { GraphAdapter } from "../../src/graph/types";

function fixture(type: string, conflictingDefinition?: Record<string, unknown>) {
  const constraints = MANAGED_KINDS.map((kind) => ({
    name: `cortex_v2_${kind.toLowerCase()}_key`,
    type,
    entityType: "NODE",
    labelsOrTypes: [MANAGED_LABELS[kind]],
    properties: ["key"],
  }));
  if (conflictingDefinition) Object.assign(constraints[0], conflictingDefinition);
  const indexes = MANAGED_KINDS.flatMap((kind) => ["key", "tenantValue"].map((property) => ({
    name: `cortex_v2_${kind.toLowerCase()}_${property === "key" ? "key" : "scope"}`,
    type: "RANGE",
    entityType: "NODE",
    labelsOrTypes: [MANAGED_LABELS[kind]],
    properties: [property],
    state: "ONLINE",
  })));
  const query = jest.fn<GraphAdapter["query"]>();
  const managedRead = jest.fn<NonNullable<GraphAdapter["managedRead"]>>()
    .mockImplementation(async (cypher) => {
      const records = cypher.startsWith("SHOW CONSTRAINTS") ? constraints : indexes;
      return { records, count: records.length };
    });
  const adapter = {
    isConnected: async () => true,
    managedDialect: async () => "neo4j" as const,
    managedRead,
    query,
  } as unknown as GraphAdapter;
  return { adapter, query, constraints };
}

describe.each(["UNIQUENESS", "NODE_PROPERTY_UNIQUENESS"])("managed schema with %s node uniqueness", (type) => {
  it("verifies every managed kind and idempotently initializes without schema writes", async () => {
    const { adapter, query } = fixture(type);
    const verified = await verifyGraphSchema(adapter);
    expect(verified.valid).toBe(true);
    expect(verified.missing).toEqual([]);
    expect(verified.constraints).toHaveLength(MANAGED_KINDS.length);
    expect(verified.indexes).toHaveLength(MANAGED_KINDS.length * 2);
    await initializeGraphSchema(adapter);
    expect(query).not.toHaveBeenCalled();
  });

  it.each([
    { entityType: "RELATIONSHIP" },
    { labelsOrTypes: ["ForeignLabel"] },
    { labelsOrTypes: [MANAGED_LABELS.Memory, "ForeignLabel"] },
    { properties: ["foreignKey"] },
    { properties: ["key", "foreignKey"] },
    { type: "NODE_KEY" },
    { type: "NODE_PROPERTY_EXISTENCE" },
    { type: "RELATIONSHIP_UNIQUENESS" },
  ])("refuses conflicting fixed names before initialization or deletion effects: %j", async (definition) => {
    const { adapter, query, constraints } = fixture(type, definition);
    const original = JSON.stringify(constraints);
    await expect(verifyGraphSchema(adapter)).rejects.toMatchObject({ code: "GRAPH_SCHEMA_CONFLICT" });
    await expect(initializeGraphSchema(adapter)).rejects.toMatchObject({ code: "GRAPH_SCHEMA_CONFLICT" });
    await expect(dropGraphSchema(adapter, { managedVersion: 2 })).rejects.toMatchObject({ code: "GRAPH_SCHEMA_CONFLICT" });
    expect(query).not.toHaveBeenCalled();
    expect(JSON.stringify(constraints)).toBe(original);
  });
});
