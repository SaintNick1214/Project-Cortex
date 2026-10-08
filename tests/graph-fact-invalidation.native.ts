/** Owned native regression: node --import tsx tests/graph-fact-invalidation.native.ts native.json graph.json [receipt.json]
 * Both JSON inputs are private fixture credentials. This probe only accepts loopback services.
 */
import fs from "node:fs";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { ConvexHttpClient } from "convex/browser";
import type { GraphJob, GraphJobReceipt } from "../src/graph/types";
import type { HistoryReceipt } from "../src/facts/history";

const require = createRequire(import.meta.url);
const { Cortex, CypherGraphAdapter, initializeGraphSchema } = require("../dist/index.cjs") as typeof import("../src/index");
const native = JSON.parse(fs.readFileSync(process.argv[2], "utf8")) as { url: string; key: string };
const graphs = JSON.parse(fs.readFileSync(process.argv[3], "utf8")) as Record<string, Parameters<InstanceType<typeof CypherGraphAdapter>["connect"]>[0]>;
assert.equal(new URL(native.url).hostname, "127.0.0.1");
const admin = new ConvexHttpClient(native.url, { logger: false }) as ConvexHttpClient & {
  setAdminAuth(key: string): void;
  function(name: string, component: undefined, args: Record<string, unknown>): Promise<unknown>;
};
admin.setAdminAuth(native.key);
const results: Array<Record<string, unknown>> = [];
for (const [kind, config] of Object.entries(graphs)) {
  assert.equal(new URL(config.uri).hostname, "127.0.0.1");
  const adapter = new CypherGraphAdapter();
  let sdk: InstanceType<typeof Cortex> | undefined;
  try {
    await adapter.connect(config); await initializeGraphSchema(adapter);
    const tenant = `graph-invalidation-${kind}-${Date.now()}`, space = `${tenant}-space`, operationId = `${tenant}-delete`;
    sdk = await Cortex.create({ convexUrl: native.url, convexLogger: false, graph: { adapter, autoSync: false }, auth: { tenantId: tenant, userId: tenant }, resilience: { enabled: false } },
      { deploymentOperator: true, initializeTransport: client => (client as typeof client & { setAdminAuth(key: string): undefined }).setAdminAuth(native.key) });
    await sdk.users.update(tenant, { displayName: "graph invalidation fixture" });
    await sdk.memorySpaces.register({ memorySpaceId: space, type: "personal", participants: [{ id: tenant, type: "user" }] });
    const fact = await sdk.facts.store({ memorySpaceId: space, userId: tenant, fact: "Retained audited fact with a removable current projection", factType: "knowledge", confidence: 100, sourceType: "manual", tags: [] }, { syncToGraph: true });
    const tuple = ["cortex.graph.v2", ["tenant", tenant], "Fact", ["space", space], fact._id];
    const key = createHash("sha256").update(JSON.stringify(tuple)).digest("hex");
    const found = await adapter.managedRead("MATCH (n:CortexV2Fact {key:$key}) RETURN properties(n) AS node", { key });
    assert.equal(found.count, 1);
    assert.equal((found.records[0].node as Record<string, unknown>).physicalSourceId, fact._id);
    assert.equal((found.records[0].node as Record<string, unknown>).tenantValue, tenant);
    await adapter.query("CREATE (:ManualSentinel {tag:$tag})", { tag: tenant });
    const deleted = await sdk.facts.delete(space, fact.factId, { operationId, syncToGraph: true }) as unknown as { deleted: boolean; graphJobs: GraphJobReceipt[]; historyReceipt: HistoryReceipt };
    assert.equal(deleted.deleted, true); assert.equal(deleted.graphJobs.length, 1);
    const job = await admin.function("cliOperator/graphSync:getGraphJob", undefined, { id: deleted.graphJobs[0].id, generation: deleted.graphJobs[0].generation, tenantId: tenant }) as GraphJob;
    assert.equal(job.operation, "delete"); assert.equal(job.state, "synced"); assert.equal(job.identity.physicalSourceId, fact._id);
    assert.deepEqual(job.projection.properties, {}); assert.deepEqual(job.projection.derived, []);
    const retained = await sdk.facts.get(space, fact.factId);
    assert.equal(retained?._id, fact._id); assert.equal(retained?.fact, fact.fact);
    assert.ok(typeof retained?.validUntil === "number" && retained.validUntil <= Date.now());
    const history = await sdk.facts.history(fact.factId);
    assert.equal(history.filter(event => event.action === "DELETE").length, 1);
    assert.equal((await adapter.managedRead("MATCH (n:CortexV2Fact {key:$key}) RETURN n.key AS key", { key })).count, 0);
    const state = await adapter.managedRead("MATCH (s:CortexV2SourceState {key:$key}) RETURN properties(s) AS state", { key });
    assert.equal(state.count, 1); assert.equal((state.records[0].state as Record<string, unknown>).tombstoned, true);
    assert.equal((state.records[0].state as Record<string, unknown>).sourceRevision, job.sourceRevision);
    const replayed = await sdk.facts.delete(space, fact.factId, { operationId, syncToGraph: true }) as unknown as typeof deleted;
    assert.deepEqual(replayed.graphJobs, deleted.graphJobs);
    assert.deepEqual(replayed.historyReceipt, deleted.historyReceipt);
    assert.equal((await sdk.facts.history(fact.factId)).filter(event => event.action === "DELETE").length, 1);
    assert.equal((await adapter.managedRead("MATCH (n:CortexV2Fact {key:$key}) RETURN n.key AS key", { key })).count, 0);
    assert.equal((await adapter.managedRead("MATCH (n:ManualSentinel {tag:$tag}) RETURN n.tag AS tag", { tag: tenant })).count, 1);
    await adapter.query("MATCH (n:ManualSentinel {tag:$tag}) DELETE n", { tag: tenant });
    results.push({ kind, status: "PASS", node: process.version, operation: job.operation, state: job.state, sourceRevision: job.sourceRevision,
      physicalFactRetained: true, deleteHistoryCount: 1, managedFactAbsent: true, sourceTombstoned: true, exactReplay: true, manualGraphPreserved: true });
    console.log(`PASS ${kind} native fact invalidation, captured deletion, history retention and exact replay`);
  } catch (error) {
    const failure = error as { message?: string; code?: string };
    let message = String(failure.message);
    for (const secret of [native.key, ...Object.values(graphs).map(graph => graph.password)].filter((value): value is string => typeof value === "string" && value.length > 0)) message = message.replaceAll(secret, "[REDACTED]");
    results.push({ kind, status: "FAIL", code: failure.code, message });
    console.error(JSON.stringify(results.at(-1))); process.exitCode = 1;
  } finally { if (sdk) await sdk.shutdown(); await adapter.disconnect(); }
}
if (process.argv[4]) fs.writeFileSync(process.argv[4], JSON.stringify(results, null, 2) + "\n");
