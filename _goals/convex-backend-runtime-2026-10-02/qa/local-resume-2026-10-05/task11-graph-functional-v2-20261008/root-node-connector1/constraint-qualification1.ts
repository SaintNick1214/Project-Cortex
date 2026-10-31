import fs from "node:fs";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import neo4j from "neo4j-driver";
import { CypherProjectionConnector } from "../../../../../../src/graph/runtime/index.js";

const directory = path.dirname(fileURLToPath(import.meta.url));
const credentials = JSON.parse(fs.readFileSync("/Users/SaintNick/.codex/tmp/cortex-task11-graph-6c189764d39e/credentials.json", "utf8")) as
  Record<"neo4j" | "memgraph", { uri: string; username: string; password: string; containerId: string }>;
const output: Record<string, unknown> = { version: 1, scope: "ACTUAL_OWNED_GRAPH_CONNECTOR_CONSTRAINT_READINESS",
  node: process.version, task11Accepted: false, backendWorkerQualified: false, modelCalls: 0, services: [] };
const services: Record<string, unknown>[] = [];
try {
  assert.equal(process.version, "v24.15.0");
  for (const engine of ["neo4j", "memgraph"] as const) {
    const c = credentials[engine];
    const inspected = JSON.parse(execFileSync("docker", ["inspect", c.containerId], { encoding: "utf8" })) as
      { State: { Running: boolean }; Config: { Labels: Record<string, string> } }[];
    assert.equal(inspected.length, 1); assert.equal(inspected[0].State.Running, true);
    assert.equal(inspected[0].Config.Labels["cortex.owner"], "backend-runtime-completion");
    assert.equal(inspected[0].Config.Labels["cortex.task"], "11");
    for (let connection = 0; connection < 2; connection++) {
      const connector = new CypherProjectionConnector({ engine, ...c,
        tenantId: "task11-root-readiness", memorySpaceId: "task11-root-readiness-space", connectorId: `task11-root-${engine}` });
      try {
        await connector.connect(); assert.equal(await connector.inspectSource("absent-readonly-probe"), null);
      } finally { await connector.close(); }
    }
    const driver = neo4j.driver(c.uri, neo4j.auth.basic(c.username, c.password), { maxConnectionPoolSize: 1,
      connectionTimeout: 5000, connectionAcquisitionTimeout: 5000, maxTransactionRetryTime: 0 });
    const session = driver.session();
    try {
      const count = (await session.run("MATCH (n) RETURN count(n) AS count", {}, { timeout: 5000 })).records[0].get("count").toNumber() as number;
      assert.equal(count, 0);
      const constraints = await session.run(engine === "neo4j" ? "SHOW CONSTRAINTS YIELD type, labelsOrTypes, properties RETURN type, labelsOrTypes, properties" : "SHOW CONSTRAINT INFO", {}, { timeout: 5000 });
      const metadata = constraints.records.map(row => row.toObject());
      assert.equal(metadata.length, 5);
      services.push({ engine, containerId: c.containerId, readiness: "PASS", repeatedFreshConnectorConnects: 2,
        inspectedAbsentSource: true, uniqueConstraintMetadata: metadata, contentNodeCount: count,
        graphContentWrites: 0, clientsClosed: true });
    } finally { try { await session.close(); } finally { await driver.close(); } }
  }
  output.status = "PASS";
} catch (error) {
  output.status = "FAIL"; output.error = { name: error instanceof Error ? error.name : "unknown",
    code: typeof error === "object" && error && "code" in error ? error.code : undefined,
    message: error instanceof Error ? error.message.replaceAll(credentials.neo4j.password, "[redacted]").replaceAll(credentials.memgraph.password, "[redacted]") : "unknown" };
  process.exitCode = 1;
} finally {
  output.services = services; fs.writeFileSync(path.join(directory, "constraint-qualification1.json"), JSON.stringify(output, null, 2) + "\n");
  process.stdout.write(JSON.stringify(output) + "\n");
}
