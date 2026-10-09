/** Explicit, fixed managed-v2 schema. Existing legacy/custom schema is never adopted or dropped. */
import type { GraphAdapter } from "../types";
import { GraphDatabaseError } from "../types";
import { MANAGED_KINDS, MANAGED_LABELS } from "../identity";

const names = MANAGED_KINDS.map(kind => ({kind, label: MANAGED_LABELS[kind],
  name: `cortex_v2_${kind.toLowerCase()}_key`, scope: `cortex_v2_${kind.toLowerCase()}_scope`}));
const list = (value: unknown): string[] => Array.isArray(value) ? value.map(String) : [];
async function inspect(adapter: GraphAdapter) {
  const dialect = await adapter.managedDialect?.();
  if (!adapter.managedRead) throw new GraphDatabaseError("Adapter requires bounded managed reads.", "GRAPH_SCHEMA_MIGRATION_REQUIRED");
  if (!dialect) throw new GraphDatabaseError("This adapter needs managed-v2 dialect support. Upgrade the adapter and explicitly initialize/rebuild.", "GRAPH_SCHEMA_MIGRATION_REQUIRED");
  const constraints = (await adapter.managedRead(dialect === "neo4j" ?
    "SHOW CONSTRAINTS YIELD name, type, entityType, labelsOrTypes, properties RETURN *" : "SHOW CONSTRAINT INFO")).records;
  const indexes = (await adapter.managedRead(dialect === "neo4j" ?
    "SHOW INDEXES YIELD name, type, entityType, labelsOrTypes, properties, state, owningConstraint RETURN *" : "SHOW INDEX INFO")).records;
  return {dialect, constraints, indexes};
}
function constraintMatches(r: Record<string, unknown>, label: string, dialect: string) {
  // Neo4j 5 reports UNIQUENESS; Cypher 25 names the same node constraint NODE_PROPERTY_UNIQUENESS.
  return dialect === "neo4j" ? (r.type === "UNIQUENESS" || r.type === "NODE_PROPERTY_UNIQUENESS") && r.entityType === "NODE" &&
    JSON.stringify(list(r.labelsOrTypes)) === JSON.stringify([label]) && JSON.stringify(list(r.properties)) === '["key"]' :
    r["constraint type"] === "unique" && r.label === label && JSON.stringify(list(r.properties)) === '["key"]';
}
function indexMatches(r: Record<string, unknown>, label: string, property: string, dialect: string) {
  return dialect === "neo4j" ? r.entityType === "NODE" && r.state === "ONLINE" &&
    JSON.stringify(list(r.labelsOrTypes)) === JSON.stringify([label]) && JSON.stringify(list(r.properties)) === JSON.stringify([property]) :
    r.label === label && JSON.stringify(list(r.property)) === JSON.stringify([property]) && r["index type"] === "label+property";
}
export async function verifyGraphSchema(adapter: GraphAdapter): Promise<{valid: boolean; constraints: string[]; indexes: string[]; missing: string[]}> {
  const actual = await inspect(adapter), missing: string[] = [];
  for (const item of names) {
    if (actual.dialect === "neo4j") {
      const named = actual.constraints.find(r => r.name === item.name);
      if (named && !constraintMatches(named, item.label, actual.dialect))
        throw new GraphDatabaseError("A fixed managed schema name has a conflicting definition.", "GRAPH_SCHEMA_CONFLICT");
      const scope = actual.indexes.find(r => r.name === item.scope);
      if (scope && !indexMatches(scope, item.label, "tenantValue", actual.dialect))
        throw new GraphDatabaseError("A fixed managed scope index has a conflicting definition.", "GRAPH_SCHEMA_CONFLICT");
    }
    if (!actual.constraints.some(r => constraintMatches(r, item.label, actual.dialect))) missing.push(item.name);
    if (!actual.indexes.some(r => indexMatches(r, item.label, "key", actual.dialect))) missing.push(`${item.label}.key index`);
    if (!actual.indexes.some(r => indexMatches(r, item.label, "tenantValue", actual.dialect))) missing.push(item.scope);
  }
  return {valid: missing.length === 0, constraints: actual.constraints.map(r => String(r.name ?? `${r.label}.key`)),
    indexes: actual.indexes.map(r => String(r.name ?? `${r.label}.${r.property}`)), missing};
}
export async function assertManagedGraphCompatibility(adapter: GraphAdapter): Promise<void> {
  if (!await adapter.isConnected()) throw new GraphDatabaseError("Managed graph is unavailable.", "GRAPH_UNAVAILABLE");
  const result = await verifyGraphSchema(adapter);
  if (!result.valid) throw new GraphDatabaseError("Managed-v2 graph schema is missing. Run explicit initializeGraphSchema and initialGraphSync with an administrator rebuild transport.", "GRAPH_SCHEMA_MIGRATION_REQUIRED");
}
export async function initializeGraphSchema(adapter: GraphAdapter): Promise<void> {
  // Inspection errors always propagate; a network/auth/syntax error is never already-exists.
  const actual = await inspect(adapter);
  await verifyGraphSchema(adapter); // Detect conflicting fixed names before any creation.
  for (const item of names) {
    if (!actual.constraints.some(r => constraintMatches(r, item.label, actual.dialect))) await adapter.query(actual.dialect === "neo4j" ?
      `CREATE CONSTRAINT ${item.name} IF NOT EXISTS FOR (n:${item.label}) REQUIRE n.key IS UNIQUE` :
      `CREATE CONSTRAINT ON (n:${item.label}) ASSERT n.key IS UNIQUE`);
    if (actual.dialect === "memgraph" && !actual.indexes.some(r => indexMatches(r, item.label, "key", actual.dialect)))
      await adapter.query(`CREATE INDEX ON :${item.label}(key)`);
    if (!actual.indexes.some(r => indexMatches(r, item.label, "tenantValue", actual.dialect))) await adapter.query(actual.dialect === "neo4j" ?
      `CREATE INDEX ${item.scope} IF NOT EXISTS FOR (n:${item.label}) ON (n.tenantValue)` : `CREATE INDEX ON :${item.label}(tenantValue)`);
  }
  await assertManagedGraphCompatibility(adapter);
}
export async function dropGraphSchema(adapter: GraphAdapter, options?: {managedVersion: 2}): Promise<void> {
  if (options?.managedVersion !== 2) throw new GraphDatabaseError("Global schema deletion is retired. Explicitly select managedVersion:2 to drop only fixed Cortex-v2 objects.", "GRAPH_SCHEMA_MIGRATION_REQUIRED");
  const actual = await inspect(adapter);
  await verifyGraphSchema(adapter); // All named shapes are checked before effects.
  for (const item of names) {
    if (actual.dialect === "neo4j") {
      if (actual.constraints.some(r => r.name === item.name && constraintMatches(r, item.label, actual.dialect)))
        await adapter.query(`DROP CONSTRAINT ${item.name} IF EXISTS`);
      if (actual.indexes.some(r => r.name === item.scope && indexMatches(r, item.label, "tenantValue", actual.dialect)))
        await adapter.query(`DROP INDEX ${item.scope} IF EXISTS`);
    } else {
      if (actual.constraints.some(r => constraintMatches(r, item.label, actual.dialect))) await adapter.query(`DROP CONSTRAINT ON (n:${item.label}) ASSERT n.key IS UNIQUE`);
      for (const property of ["key", "tenantValue"]) if (actual.indexes.some(r => indexMatches(r, item.label, property, actual.dialect)))
        await adapter.query(`DROP INDEX ON :${item.label}(${property})`);
    }
  }
}
