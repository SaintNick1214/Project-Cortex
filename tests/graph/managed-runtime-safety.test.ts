/** Mandatory graph job: real owned engines and authenticated native persistence. */
import { randomUUID } from "node:crypto";
import { describe, expect, it, beforeAll, afterAll, jest } from "@jest/globals";
import { Cortex } from "../helpers/deployment-operator";
import { nativeTarget } from "../helpers/native-ci";
import { Cortex as PublicCortex } from "../../src";
import { CypherGraphAdapter, initializeGraphSchema } from "../../src/graph";
import { primaryGraphIdentity } from "../../src/graph/identity";
import type { GraphAdapter, GraphConnectionConfig } from "../../src/graph/types";
import type { Session } from "neo4j-driver";

const native = nativeTarget();
const configs: Record<string, GraphConnectionConfig> = {
  neo4j: { uri: process.env.NEO4J_URI!, username: process.env.NEO4J_USERNAME!, password: process.env.NEO4J_PASSWORD! },
  memgraph: { uri: process.env.MEMGRAPH_URI!, username: process.env.MEMGRAPH_USERNAME || "cortex-ci", password: process.env.MEMGRAPH_PASSWORD || "cortex-ci-owned-test" },
};
for (const [engine, config] of Object.entries(configs)) {
  if (!config.uri?.startsWith("bolt://127.0.0.1:")) throw new Error("Graph proofs require explicitly selected owned loopback services.");
  describe(`managed ${engine} runtime safety`, () => {
    const tag = `managed-runtime-${engine}-${randomUUID()}`;
    let inspector: CypherGraphAdapter;
    let sentinelId: string;
    let sentinelBytes: unknown;
    async function sentinel() { expect(await inspector.getNode(sentinelId)).toEqual(sentinelBytes); }
    beforeAll(async () => {
      inspector = new CypherGraphAdapter(); await inspector.connect(config);
      await initializeGraphSchema(inspector);
      sentinelId = await inspector.createNode({ label: "OwnedRuntimeSentinel", properties: { tag, value: "unchanged", revision: 1 } });
      sentinelBytes = await inspector.getNode(sentinelId);
    });
    afterAll(async () => {
      if (inspector) {
        if (sentinelId) { await sentinel(); await inspector.deleteNode(sentinelId); }
        await inspector.query("MATCH (n:OwnedRuntimeCrud {tag:$tag}) DETACH DELETE n", { tag });
        await inspector.disconnect();
      }
    });
    it("preserves sentinel identity and properties through connection probes", async () => {
      const adapter = new CypherGraphAdapter();
      await adapter.connect(config); await adapter.disconnect(); await sentinel();
      if (engine === "neo4j") {
        const failed = new CypherGraphAdapter();
        await expect(failed.connect({ ...config, password: "deliberately-wrong-proof-password" })).rejects.toThrow(/authentication failed/);
        expect(await failed.isConnected()).toBe(false); await failed.disconnect(); await sentinel();
      }
    });
    it("preserves sentinel through real fallback CRUD and directed traversal", async () => {
      const adapter = new CypherGraphAdapter();
      const internal = adapter as unknown as { getSession(): Session };
      const original = internal.getSession.bind(adapter);
      jest.spyOn(internal, "getSession").mockImplementation(() => {
        const session = original(), run = session.run.bind(session);
        session.run = ((...args: Parameters<Session["run"]>) => {
          if (args[0] === "RETURN elementId(null) AS id") throw Object.assign(new Error("Function 'elementId' doesn't exist."), { code: "Memgraph.ClientError.MemgraphError.MemgraphError" });
          return run(...args);
        }) as Session["run"];
        return session;
      });
      await adapter.connect(config);
      const ids: string[] = [];
      try {
        const one = await adapter.createNode({ label: "OwnedRuntimeCrud", properties: { tag, name: "first", revision: 1 } }); ids.push(one);
        const two = await adapter.createNode({ label: "OwnedRuntimeCrud", properties: { tag, name: "second" } }); ids.push(two);
        await adapter.updateNode(one, { revision: 2 }); expect((await adapter.getNode(one))?.properties.revision).toBe(2);
        const edge = await adapter.createEdge({ type: "OWNED_RUNTIME_LINK", from: one, to: two, properties: { tag } });
        expect((await adapter.findNodes("OwnedRuntimeCrud", { tag })).map(node => node.id).sort()).toEqual([one, two].sort());
        expect(await adapter.findEdges("OWNED_RUNTIME_LINK", { tag })).toEqual([expect.objectContaining({ id: edge, from: one, to: two })]);
        expect((await adapter.traverse({ startId: one, maxDepth: 1, direction: "OUTGOING", relationshipTypes: ["OWNED_RUNTIME_LINK"] })).some(node => node.id === two)).toBe(true);
        const path = await adapter.findPath({ fromId: one, toId: two, maxHops: 2, direction: "OUTGOING", relationshipTypes: ["OWNED_RUNTIME_LINK"] });
        expect(path?.nodes.map(node => node.id)).toEqual([one, two]);
        expect(path?.relationships).toEqual([expect.objectContaining({ id: edge, from: one, to: two })]);
        await adapter.deleteEdge(edge);
        expect(await adapter.traverse({ startId: one, maxDepth: 1, direction: "OUTGOING", relationshipTypes: ["OWNED_RUNTIME_LINK"] })).toHaveLength(0);
        expect(await adapter.findPath({ fromId: one, toId: two, maxHops: 2, direction: "OUTGOING", relationshipTypes: ["OWNED_RUNTIME_LINK"] })).toBeNull();
        await sentinel();
      } finally {
        for (const id of ids) await adapter.deleteNode(id);
        expect(await adapter.findNodes("OwnedRuntimeCrud", { tag })).toHaveLength(0);
        await adapter.disconnect(); await sentinel();
      }
    });
    it("leaves caller-owned adapter usable after SDK shutdown", async () => {
      const adapter = new CypherGraphAdapter(); await adapter.connect(config);
      const cortex = new Cortex({ convexUrl: native.url, convexLogger: false, graph: { adapter, autoSync: false }, graphEnabled: false, resilience: { enabled: false } });
      try { await cortex.shutdown(); expect(await adapter.isConnected()).toBe(true); await sentinel(); }
      finally { await adapter.disconnect(); }
    });
    it("releases the actual automatically owned graph after SDK shutdown", async () => {
      const cortex = await PublicCortex.create({ convexUrl: native.url, convexLogger: false, graphEnabled: true, graphConnection: config, resilience: { enabled: false } },
        { deploymentOperator: true, initializeTransport(client) { (client as unknown as { setAdminAuth(key: string): void }).setAdminAuth(native.key); } });
      const owned = (cortex as unknown as { ownedGraphAdapter: GraphAdapter }).ownedGraphAdapter;
      expect(await owned.isConnected()).toBe(true);
      await cortex.shutdown();
      expect(await owned.isConnected()).toBe(false);
      await sentinel();
    });
    it("persists native memory and managed facts, recalls scoped graph data and preserves caller ownership", async () => {
      const tenant = `${tag}-tenant`, space = `${tag}-space`, user = `${tag}-user`;
      const cortex = new Cortex({ convexUrl: native.url, convexLogger: false, graphEnabled: false, graph: { adapter: inspector, autoSync: false },
        auth: { tenantId: tenant, userId: user }, resilience: { enabled: false } });
      try {
        await cortex.users.update(user, { name: "Graph proof user" });
        await cortex.memorySpaces.register({ memorySpaceId: space, type: "personal", name: "Owned managed graph fixture", participants: [{ id: user, type: "user" }] });
        const remembered = await cortex.memory.remember({ memorySpaceId: space, conversationId: `${tag}-conversation`, userMessage: "Sapphire bicycle preference",
          agentResponse: "Sapphire bicycle recorded", userId: user, userName: "Graph proof user", agentId: `${tag}-agent` });
        expect(remembered.memories.length).toBeGreaterThanOrEqual(2);
        const fact = await cortex.facts.store({ memorySpaceId: space, userId: user, fact: "Sapphire connects to bicycle", factType: "relationship",
          subject: "sapphire", predicate: "relates to", object: "bicycle", confidence: 95, sourceType: "manual" }, { syncToGraph: true });
        const key = primaryGraphIdentity("Fact", fact._id, { tenantKnown: true, tenantId: tenant, memorySpaceId: space }).key;
        const graphFact = await inspector.managedRead("MATCH (n:CortexV2Fact {key:$key}) RETURN properties(n) AS node", { key });
        expect(graphFact.count).toBe(1);
        expect(graphFact.records[0].node).toMatchObject({ physicalSourceId: fact._id, tenantValue: tenant, spaceValue: space });
        const related = await cortex.facts.store({ memorySpaceId: space, userId: user, fact: "A hidden secondary preference", factType: "relationship",
          subject: "bicycle", predicate: "relates to", object: "opal", confidence: 95, sourceType: "manual" }, { syncToGraph: true });
        const recalled = await cortex.memory.recall({ memorySpaceId: space, query: "sapphire", userId: user, limit: 10 });
        expect(recalled.totalResults).toBeGreaterThan(0); expect(JSON.stringify(recalled)).toContain("Sapphire");
        expect(recalled.sources.graph.count).toBeGreaterThan(0); expect(recalled.graphExpansionApplied).toBe(true);
        await cortex.facts.delete(space, related.factId, { syncToGraph: true });
        await cortex.facts.delete(space, fact.factId, { syncToGraph: true });
        expect((await inspector.managedRead("MATCH (n:CortexV2Fact {key:$key}) RETURN n.key AS key", { key })).count).toBe(0);
        await sentinel();
      } finally {
        await cortex.shutdown(); expect(await inspector.isConnected()).toBe(true);
        await sentinel();
      }
    }, 180000);
  });
}
