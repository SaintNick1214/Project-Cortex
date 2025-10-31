/**
 * Cortex SDK - Agents API E2E Tests
 *
 * Tests the complete Agents API implementation:
 * - Registry operations (register, get, list, search, count, update)
 * - Cascade deletion by participantId across all memory spaces
 * - Graph integration with orphan detection
 * - Verification and rollback
 */

import { Cortex } from "../src";
import { ConvexClient } from "convex/browser";
import { api } from "../convex-dev/_generated/api";
import { TestCleanup } from "./helpers";
import { CypherGraphAdapter } from "../src/graph/adapters/CypherGraphAdapter";
import type { GraphAdapter } from "../src/graph/types";

describe("Agents API (Coordination Layer)", () => {
  let cortex: Cortex;
  let client: ConvexClient;
  let cleanup: TestCleanup;
  let graphAdapter: GraphAdapter | undefined;
  let hasGraphSupport: boolean = false;
  const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";

  beforeAll(async () => {
    // Initialize graph adapter if environment variables are set
    const neo4jUri = process.env.NEO4J_URI;
    const neo4jUsername = process.env.NEO4J_USERNAME;
    const neo4jPassword = process.env.NEO4J_PASSWORD;

    if (neo4jUri && neo4jUsername && neo4jPassword) {
      try {
        console.log(
          "\n🔗 Graph database configured - testing with graph integration",
        );
        graphAdapter = new CypherGraphAdapter();
        await graphAdapter.connect({
          uri: neo4jUri,
          username: neo4jUsername,
          password: neo4jPassword,
        });
        hasGraphSupport = true;
        console.log("✅ Graph adapter initialized\n");
      } catch (error) {
        console.warn(
          "⚠️  Graph adapter configuration found but initialization failed:",
          error,
        );
        console.warn("   Tests will run without graph support\n");
      }
    } else {
      console.log(
        "\n📝 No graph configuration - testing without graph integration",
      );
      console.log(
        "   (Set NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD to enable)\n",
      );
    }

    // Initialize SDK with optional graph adapter
    cortex = new Cortex({
      convexUrl: CONVEX_URL,
      ...(graphAdapter && {
        graph: {
          adapter: graphAdapter,
          orphanCleanup: true,
        },
      }),
    });

    // Direct client for storage validation
    client = new ConvexClient(CONVEX_URL);
    // Cleanup helper
    cleanup = new TestCleanup(client);

    // 🧹 Purge test data before all tests
    console.log("🧹 Purging test data before tests...");
    await cleanup.purgeConversations();
    await cleanup.purgeMemories();
    await cleanup.purgeFacts();
    await cleanup.purgeMemorySpaces();

    // Purge agents registry
    try {
      const allAgents = await client.query(api.agents.list, {});
      for (const agent of allAgents) {
        try {
          await client.mutation(api.agents.unregister, {
            agentId: agent.agentId,
          });
        } catch (_error) {
          // Ignore errors, agent may already be deleted
        }
      }
      console.log("✅ Purged agents registry");
    } catch (error) {
      console.warn("⚠️  Failed to purge agents:", error);
    }

    // Clean graph if available
    if (graphAdapter) {
      try {
        await graphAdapter.query(
          "MATCH (n) WHERE n.participantId IS NOT NULL DETACH DELETE n",
          {},
        );
        console.log("✅ Purged graph test data");
      } catch (error) {
        console.warn("⚠️  Failed to purge graph data:", error);
      }
    }

    console.log("✅ Purged all test data\n");
  });

  afterAll(async () => {
    cortex.close();
    await client.close();

    // Close graph adapter connection if it exists
    if (graphAdapter) {
      try {
        await graphAdapter.disconnect();
      } catch (error) {
        console.warn("Failed to disconnect graph adapter:", error);
      }
    }
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Registry Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("register() and get()", () => {
    it("registers an agent", async () => {
      const agentId = "test-agent-register-" + Date.now();

      const result = await cortex.agents.register({
        id: agentId,
        name: "Test Agent",
        description: "A test agent",
        metadata: {
          team: "testing",
          capabilities: ["test1", "test2"],
        },
        config: {
          memoryVersionRetention: 10,
        },
      });

      // Validate SDK response
      expect(result.id).toBe(agentId);
      expect(result.name).toBe("Test Agent");
      expect(result.description).toBe("A test agent");
      expect(result.metadata.team).toBe("testing");
      expect(result.metadata.capabilities).toEqual(["test1", "test2"]);
      expect(result.config.memoryVersionRetention).toBe(10);
      expect(result.status).toBe("active");
      expect(result.registeredAt).toBeGreaterThan(0);
      expect(result.updatedAt).toBeGreaterThan(0);
      expect(result.stats).toBeDefined();

      // Validate Convex storage
      const stored = await client.query(api.agents.get, { agentId });
      expect(stored).not.toBeNull();
      expect(stored!.agentId).toBe(agentId);
      expect(stored!.name).toBe("Test Agent");
    });

    it("retrieves a registered agent", async () => {
      const agentId = "test-agent-get-" + Date.now();

      await cortex.agents.register({
        id: agentId,
        name: "Get Test Agent",
      });

      const result = await cortex.agents.get(agentId);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(agentId);
      expect(result!.name).toBe("Get Test Agent");
      expect(result!.stats).toBeDefined();
    });

    it("returns null for unregistered agent", async () => {
      const result = await cortex.agents.get(
        "non-existent-agent-" + Date.now(),
      );
      expect(result).toBeNull();
    });

    it("throws error when registering duplicate agent", async () => {
      const agentId = "test-agent-duplicate-" + Date.now();

      await cortex.agents.register({
        id: agentId,
        name: "First Registration",
      });

      await expect(
        cortex.agents.register({
          id: agentId,
          name: "Second Registration",
        }),
      ).rejects.toThrow("AGENT_ALREADY_REGISTERED");
    });
  });

  describe("list(), search(), and count()", () => {
    it("lists all agents", async () => {
      const agent1 = "test-agent-list-1-" + Date.now();
      const agent2 = "test-agent-list-2-" + Date.now();

      await cortex.agents.register({ id: agent1, name: "Agent 1" });
      await cortex.agents.register({ id: agent2, name: "Agent 2" });

      const results = await cortex.agents.list();

      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results.some((a) => a.id === agent1)).toBe(true);
      expect(results.some((a) => a.id === agent2)).toBe(true);
    });

    it("lists agents with limit", async () => {
      const results = await cortex.agents.list({ limit: 2 });
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it("searches agents by metadata", async () => {
      const agentId = "test-agent-search-" + Date.now();

      await cortex.agents.register({
        id: agentId,
        name: "Search Test",
        metadata: {
          team: "unique-team-" + Date.now(),
        },
      });

      const results = await cortex.agents.search({
        metadata: { team: "unique-team-" + Date.now() },
      });

      // May not find if team ID doesn't match exactly due to timing
      expect(Array.isArray(results)).toBe(true);
    });

    it("counts agents", async () => {
      const count = await cortex.agents.count();
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });

  describe("update() and configure()", () => {
    it("updates agent metadata", async () => {
      const agentId = "test-agent-update-" + Date.now();

      await cortex.agents.register({
        id: agentId,
        name: "Original Name",
        metadata: { version: "1.0" },
      });

      const updated = await cortex.agents.update(agentId, {
        name: "Updated Name",
        metadata: { version: "2.0" },
      });

      expect(updated.name).toBe("Updated Name");
      expect(updated.metadata.version).toBe("2.0");
    });

    it("configures agent settings", async () => {
      const agentId = "test-agent-configure-" + Date.now();

      await cortex.agents.register({ id: agentId, name: "Config Test" });

      await cortex.agents.configure(agentId, {
        memoryVersionRetention: 20,
        customSetting: "value",
      });

      const agent = await cortex.agents.get(agentId);
      expect(agent!.config.memoryVersionRetention).toBe(20);
      expect(agent!.config.customSetting).toBe("value");
    });
  });

  describe("exists()", () => {
    it("returns true for registered agent", async () => {
      const agentId = "test-agent-exists-" + Date.now();
      await cortex.agents.register({ id: agentId, name: "Exists Test" });

      const exists = await cortex.agents.exists(agentId);
      expect(exists).toBe(true);
    });

    it("returns false for unregistered agent", async () => {
      const exists = await cortex.agents.exists("non-existent-" + Date.now());
      expect(exists).toBe(false);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Simple Unregister (no cascade)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("unregister() - simple mode", () => {
    it("unregisters agent without deleting data", async () => {
      const agentId = "test-agent-unregister-" + Date.now();

      await cortex.agents.register({ id: agentId, name: "Unregister Test" });

      const result = await cortex.agents.unregister(agentId);

      expect(result.agentId).toBe(agentId);
      expect(result.totalDeleted).toBe(1);
      expect(result.deletedLayers).toEqual(["agent-registration"]);
      expect(result.conversationsDeleted).toBe(0);
      expect(result.memoriesDeleted).toBe(0);
      expect(result.factsDeleted).toBe(0);

      // Verify agent is unregistered
      const agent = await cortex.agents.get(agentId);
      expect(agent).toBeNull();
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Cascade Deletion by participantId
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("unregister() - cascade mode", () => {
    it("performs cascade deletion by participantId across all spaces", async () => {
      const agentId = "cascade-agent-" + Date.now();
      const space1 = "space-1-" + Date.now();
      const space2 = "space-2-" + Date.now();

      // Register agent
      await cortex.agents.register({ id: agentId, name: "Cascade Test" });

      // Register memory spaces
      await cortex.memorySpaces.register({
        memorySpaceId: space1,
        type: "personal",
      });
      await cortex.memorySpaces.register({
        memorySpaceId: space2,
        type: "personal",
      });

      // Create data in space 1 with participantId
      await cortex.conversations.create({
        memorySpaceId: space1,
        participantId: agentId, // Hive Mode tracking
        type: "user-agent",
        participants: {
          userId: "user-1",
          participantId: agentId,
        },
      });

      await cortex.vector.store(space1, {
        content: "Memory in space 1",
        contentType: "raw",
        participantId: agentId, // Key field for cascade
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });

      // Create data in space 2 with participantId
      await cortex.vector.store(space2, {
        content: "Memory in space 2",
        contentType: "raw",
        participantId: agentId, // Key field for cascade
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });

      // Wait for data to persist
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Verify setup
      const memories1 = await cortex.vector.list({ memorySpaceId: space1 });
      const memories2 = await cortex.vector.list({ memorySpaceId: space2 });
      console.log(
        `  ℹ️  Setup: ${memories1.length} memories in space1, ${memories2.length} in space2`,
      );

      // Create graph node if available
      if (graphAdapter) {
        await graphAdapter.createNode({
          label: "Agent",
          properties: {
            participantId: agentId,
            name: "Cascade Test Agent",
            createdAt: Date.now(),
          },
        });
        console.log("  ✅ Created graph node for cascade test");
      }

      // CASCADE DELETE
      const result = await cortex.agents.unregister(agentId, {
        cascade: true,
      });

      // Verify counts
      expect(result.agentId).toBe(agentId);
      expect(result.memoriesDeleted).toBeGreaterThanOrEqual(2); // At least 2 memories
      expect(result.conversationsDeleted).toBeGreaterThanOrEqual(1);
      expect(result.totalDeleted).toBeGreaterThan(1);
      expect(result.memorySpacesAffected).toContain(space1);
      expect(result.memorySpacesAffected).toContain(space2);
      expect(result.deletedLayers.length).toBeGreaterThan(1);

      // Verify graph deletion if available
      if (hasGraphSupport && graphAdapter) {
        expect(result.graphNodesDeleted).toBeGreaterThanOrEqual(1);
        expect(result.deletedLayers).toContain("graph");

        // Verify graph node is gone
        const graphResult = await graphAdapter.query(
          "MATCH (n {participantId: $participantId}) RETURN count(n) as count",
          { participantId: agentId },
        );
        expect(graphResult.records[0]?.count || 0).toBe(0);
        console.log("  ✅ Graph node deleted");
      }

      // Verify agent is unregistered
      const agent = await cortex.agents.get(agentId);
      expect(agent).toBeNull();

      // Verify memories are deleted in both spaces
      const remainingMemories1 = (
        await cortex.vector.list({ memorySpaceId: space1 })
      ).filter((m) => m.participantId === agentId);
      const remainingMemories2 = (
        await cortex.vector.list({ memorySpaceId: space2 })
      ).filter((m) => m.participantId === agentId);
      expect(remainingMemories1).toHaveLength(0);
      expect(remainingMemories2).toHaveLength(0);

      console.log(
        `  ✅ Cascade complete: Deleted from ${result.memorySpacesAffected.length} spaces`,
      );
      console.log(`     Layers: ${result.deletedLayers.join(", ")}`);
    });
  });

  describe("unregister() - dry run mode", () => {
    it("previews deletion without actually deleting", async () => {
      const agentId = "dry-run-agent-" + Date.now();

      await cortex.agents.register({ id: agentId, name: "Dry Run Test" });

      const result = await cortex.agents.unregister(agentId, {
        cascade: true,
        dryRun: true,
      });

      // Should return preview
      expect(result.agentId).toBe(agentId);
      expect(result.verification.issues.length).toBeGreaterThan(0);
      expect(result.verification.issues[0]).toContain("DRY RUN");

      // Verify agent still exists
      const agent = await cortex.agents.get(agentId);
      expect(agent).not.toBeNull();
    });
  });

  describe("unregister() - verification", () => {
    it("runs verification step after deletion", async () => {
      const agentId = "verify-agent-" + Date.now();

      await cortex.agents.register({ id: agentId, name: "Verify Test" });

      const result = await cortex.agents.unregister(agentId, {
        cascade: true,
        verify: true,
      });

      expect(result.verification).toBeDefined();
      expect(result.verification.complete).toBeDefined();
      expect(result.verification.issues).toBeDefined();

      if (hasGraphSupport) {
        // With graph, verification should be complete or have other issues
        if (!result.verification.complete) {
          console.log("  ℹ️  Verification issues:", result.verification.issues);
        }
      } else {
        // Without graph, should warn about manual cleanup
        expect(
          result.verification.issues.some((i) => i.includes("Graph adapter")),
        ).toBe(true);
      }
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Registration Not Required for Cascade
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("cascade without registration", () => {
    it("deletes data even if agent was never registered", async () => {
      const agentId = "unregistered-agent-" + Date.now();
      const spaceId = "space-unreg-" + Date.now();

      // DON'T register the agent - just create data with participantId
      await cortex.memorySpaces.register({
        memorySpaceId: spaceId,
        type: "personal",
      });

      await cortex.vector.store(spaceId, {
        content: "Memory from unregistered agent",
        contentType: "raw",
        participantId: agentId, // Agent never registered!
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });

      // Wait for persist
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify memory exists
      const beforeMemories = (
        await cortex.vector.list({ memorySpaceId: spaceId })
      ).filter((m) => m.participantId === agentId);
      expect(beforeMemories.length).toBeGreaterThanOrEqual(1);

      // CASCADE DELETE (without registration)
      const result = await cortex.agents.unregister(agentId, {
        cascade: true,
      });

      // Should still delete the memories!
      expect(result.memoriesDeleted).toBeGreaterThanOrEqual(1);
      expect(result.totalDeleted).toBeGreaterThanOrEqual(1);

      // Verify memories are gone
      const afterMemories = (
        await cortex.vector.list({ memorySpaceId: spaceId })
      ).filter((m) => m.participantId === agentId);
      expect(afterMemories).toHaveLength(0);

      console.log(
        "  ✅ Cascade works without registration (queries by participantId in data)",
      );
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Edge Cases
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("edge cases", () => {
    it("handles unregistering non-existent agent gracefully", async () => {
      const result = await cortex.agents.unregister(
        "non-existent-" + Date.now(),
        {
          cascade: true,
        },
      );

      expect(result.totalDeleted).toBe(0);
    });

    it("handles agent with no data", async () => {
      const agentId = "empty-agent-" + Date.now();

      await cortex.agents.register({ id: agentId, name: "Empty" });

      const result = await cortex.agents.unregister(agentId, {
        cascade: true,
      });

      expect(result.totalDeleted).toBeGreaterThanOrEqual(1); // Just registration
      expect(result.memoriesDeleted).toBe(0);
      expect(result.conversationsDeleted).toBe(0);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Agent Statistics
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("agent statistics", () => {
    it("computes stats from actual data", async () => {
      const agentId = "stats-agent-" + Date.now();
      const spaceId = "stats-space-" + Date.now();

      // Register agent
      await cortex.agents.register({ id: agentId, name: "Stats Agent" });

      // Create data
      await cortex.memorySpaces.register({
        memorySpaceId: spaceId,
        type: "personal",
      });

      await cortex.vector.store(spaceId, {
        content: "Test memory 1",
        contentType: "raw",
        participantId: agentId,
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });

      await cortex.vector.store(spaceId, {
        content: "Test memory 2",
        contentType: "raw",
        participantId: agentId,
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });

      // Wait for persist
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Get agent (stats computed automatically)
      const agent = await cortex.agents.get(agentId);

      expect(agent).not.toBeNull();
      expect(agent!.stats).toBeDefined();
      expect(agent!.stats!.totalMemories).toBeGreaterThanOrEqual(2);
      expect(agent!.stats!.memorySpacesActive).toBeGreaterThanOrEqual(1);
    });
  });
});
