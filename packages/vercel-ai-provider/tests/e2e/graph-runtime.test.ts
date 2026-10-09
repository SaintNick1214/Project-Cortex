/** Required isolated graph job: native provider persistence, without paid calls. */
import { randomUUID } from "node:crypto";
import { jest, afterAll } from "@jest/globals";
import { Cortex as SDK, CypherGraphAdapter, initializeGraphSchema, createGraphErasureTransport, type GraphConnectionConfig } from "@cortexmemory/sdk";
import { createCortexMemoryAsync } from "../../src/index";
import { CortexMemoryProvider } from "../../src/provider";
import { Cortex, nativeProviderCredentials } from "../helpers/operator-client";

const url = process.env.CONVEX_URL!;
const credentials = nativeProviderCredentials(url);
const created: SDK[] = [], originalCreate = SDK.create.bind(SDK);
const observedCreate = jest.spyOn(SDK, "create").mockImplementation(async (...args) => {
  const cortex = await originalCreate(...args); created.push(cortex); return cortex;
});
afterAll(() => observedCreate.mockRestore());
const configs: Record<string, GraphConnectionConfig> = {
  neo4j: { uri: process.env.NEO4J_URI!, username: process.env.NEO4J_USERNAME!, password: process.env.NEO4J_PASSWORD! },
  memgraph: { uri: process.env.MEMGRAPH_URI!, username: process.env.MEMGRAPH_USERNAME || "cortex-ci", password: process.env.MEMGRAPH_PASSWORD || "cortex-ci-owned-test" },
};
for (const [engine, connection] of Object.entries(configs)) {
  if (!connection.uri?.startsWith("bolt://127.0.0.1:")) throw new Error("Provider graph proofs require explicit owned loopback services.");
  it(`real ${engine} manual provider adapter stays usable after factory disposal`, async () => {
    const adapter = new CypherGraphAdapter(); await adapter.connect(connection); await initializeGraphSchema(adapter);
    const tag = `provider-manual-${randomUUID()}`;
    const owner = await createCortexMemoryAsync({ convexUrl: url, memorySpaceId: tag, userId: `${tag}-user`, agentId: `${tag}-agent`,
      enableGraphMemory: false, graphConfig: { adapter } }, credentials);
    try {
      await owner.close();
      const id = await adapter.createNode({ label: "OwnedProviderSentinel", properties: { tag } });
      try { expect((await adapter.getNode(id))?.properties.tag).toBe(tag); }
      finally { await adapter.deleteNode(id); }
    } finally { await owner.close(); await adapter.disconnect(); }
  });
  it(`real ${engine} provider sync persists recall across borrowed wrappers`, async () => {
    const space = `provider-runtime-${engine}-${randomUUID()}`, user = `${space}-user`, agent = `${space}-agent`, conversation = `${space}-conversation`;
    const config = { convexUrl: url, memorySpaceId: space, userId: user, userName: user, agentId: agent, conversationId: conversation,
      enableGraphMemory: true, graphConfig: connection };
    const clean = new Cortex({ convexUrl: url });
    const inspector = new CypherGraphAdapter(); await inspector.connect(connection);
    const owner = await createCortexMemoryAsync(config, credentials);
    try {
      // Let the graph-enabled provider capture its own space creation before
      // dependent conversation/memory jobs. Existing graph-off data needs rebuild.
      const model = { provider: "local-proof", modelId: "deterministic-owned", specificationVersion: "v2", supportedUrls: {} };
      const one = owner(model), two = owner(model);
      await Promise.all([one.close(), two.close(), one.close()]);
      await owner.remember("Provider sapphire bicycle preference", "Provider sapphire bicycle retained");
      const search = await owner.search("sapphire bicycle");
      expect(search.length).toBeGreaterThan(0); expect(JSON.stringify(search)).toContain("sapphire");
      const memories = await clean.vector.list({ memorySpaceId: space });
      // Automatic graph configuration delivers the durable queue in background.
      // Wait for the actual physical projections, and fail if they never arrive.
      const deadline = Date.now() + 10000;
      let projected = await inspector.managedRead("MATCH (n:CortexV2Memory {spaceValue:$space, tenantTag:'knownTenantless'}) RETURN n.physicalSourceId AS id", { space });
      while (projected.count !== 2 && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 50));
        projected = await inspector.managedRead("MATCH (n:CortexV2Memory {spaceValue:$space, tenantTag:'knownTenantless'}) RETURN n.physicalSourceId AS id", { space });
      }
      if (projected.count !== 2) throw new Error(`Native background graph delivery incomplete: ${JSON.stringify(created.at(-1)?.getGraphSyncWorker()?.getMetrics())}`);
      expect(projected.records.map(row => row.id).sort()).toEqual(memories.map(memory => memory._id).sort());
      expect(projected.count).toBe(2);
      const conversations = await inspector.managedRead("MATCH (n:CortexV2Conversation {spaceValue:$space, tenantTag:'knownTenantless'}) RETURN n.physicalSourceId AS id", { space });
      expect(conversations.count).toBe(1);
      const standalone = await CortexMemoryProvider.create(model, config, credentials);
      await Promise.all([standalone.close(), standalone.close()]);
      expect((await owner.search("sapphire bicycle")).length).toBeGreaterThan(0);
      await Promise.all([owner.close(), owner.close()]);
      const recall = await clean.memory.recall({ memorySpaceId: space, query: "sapphire bicycle", userId: user });
      expect(recall.totalResults).toBeGreaterThan(0); expect(recall.context?.toLowerCase()).toContain("sapphire");
    } finally {
      await owner.close();
      const erasure = clean.memorySpaces.createErasureTransport({ url, deploymentKey: credentials.deploymentKey });
      const disposal = createGraphErasureTransport({ url, deploymentKey: credentials.deploymentKey });
      try {
        await clean.memorySpaces.delete(space, { cascade: true, reason: "owned provider proof cleanup", confirmId: space,
          erasureTransport: erasure, graphParticipant: { adapter: inspector, disposalTransport: disposal } });
        await inspector.query("MATCH(n) WHERE n.spaceValue=$space OR n.logicalId IN $ids DETACH DELETE n", { space, ids: [user, agent, conversation] });
        expect(await clean.memorySpaces.get(space)).toBeNull();
      } finally {
        erasure.close(); disposal.close(); await clean.shutdown(); await inspector.disconnect();
      }
    }
  }, 60000);
}
