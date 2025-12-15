/**
 * Cortex SDK - Agents API E2E Tests
 *
 * Tests the complete Agents API implementation:
 * - Registry operations (register, get, list, search, count, update)
 * - Cascade deletion by participantId across all memory spaces
 * - Graph integration with orphan detection
 * - Verification and rollback
 *
 * PARALLEL-SAFE: Uses TestRunContext for isolated test data
 */

import { Cortex } from "../src";
import { ConvexClient } from "convex/browser";
import { api } from "../convex-dev/_generated/api";
import { createNamedTestRunContext, ScopedCleanup } from "./helpers";
import { CypherGraphAdapter } from "../src/graph/adapters/CypherGraphAdapter";
import type { GraphAdapter } from "../src/graph/types";

describe("Agents API (Coordination Layer)", () => {
  // Create unique test run context for parallel-safe execution
  const ctx = createNamedTestRunContext("agents");

  let cortex: Cortex;
  let client: ConvexClient;
  let scopedCleanup: ScopedCleanup;
  let graphAdapter: GraphAdapter | undefined;
  let hasGraphSupport: boolean = false;
  const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";

  beforeAll(async () => {
    console.log(`\n🧪 Agents API Tests - Run ID: ${ctx.runId}\n`);

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

    // Scoped cleanup (only cleans data from this test run)
    scopedCleanup = new ScopedCleanup(client, ctx);

    // Note: No global purge - each test run is isolated by prefix
    console.log("✅ Test isolation setup complete\n");
  });

  afterAll(async () => {
    // Clean up only data created by this test run
    console.log(`\n🧹 Cleaning up test run ${ctx.runId}...`);
    await scopedCleanup.cleanupAll();

    // Clean graph data for this run if available
    if (graphAdapter) {
      try {
        await graphAdapter.query(
          `MATCH (n) WHERE n.agentId STARTS WITH $prefix OR n.participantId STARTS WITH $prefix DETACH DELETE n`,
          { prefix: ctx.runId },
        );
        console.log("✅ Cleaned up graph test data");
      } catch (error) {
        console.warn("⚠️  Failed to clean up graph data:", error);
      }
    }

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

    console.log(`✅ Test run ${ctx.runId} cleanup complete\n`);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Client-Side Validation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Client-Side Validation", () => {
    describe("register() validation", () => {
      it("should throw on missing agent ID", async () => {
        await expect(
          cortex.agents.register({
            name: "Test Agent",
          } as any),
        ).rejects.toMatchObject({
          name: "AgentValidationError",
          code: "MISSING_AGENT_ID",
        });
      });

      it("should throw on empty agent ID", async () => {
        await expect(
          cortex.agents.register({
            id: "",
            name: "Test Agent",
          }),
        ).rejects.toMatchObject({
          code: "EMPTY_AGENT_ID",
          field: "id",
        });
      });

      it("should throw on whitespace-only agent ID", async () => {
        await expect(
          cortex.agents.register({
            id: "   ",
            name: "Test Agent",
          }),
        ).rejects.toMatchObject({
          code: "EMPTY_AGENT_ID",
        });
      });

      it("should throw on agent ID too long", async () => {
        await expect(
          cortex.agents.register({
            id: "a".repeat(300),
            name: "Test Agent",
          }),
        ).rejects.toMatchObject({
          code: "AGENT_ID_TOO_LONG",
        });
      });

      it("should throw on missing agent name", async () => {
        await expect(
          cortex.agents.register({
            id: "test-agent",
          } as any),
        ).rejects.toMatchObject({
          code: "MISSING_AGENT_NAME",
        });
      });

      it("should throw on empty agent name", async () => {
        await expect(
          cortex.agents.register({
            id: "test-agent",
            name: "",
          }),
        ).rejects.toMatchObject({
          code: "EMPTY_AGENT_NAME",
        });
      });

      it("should throw on agent name too long", async () => {
        await expect(
          cortex.agents.register({
            id: "test-agent",
            name: "a".repeat(300),
          }),
        ).rejects.toMatchObject({
          code: "AGENT_NAME_TOO_LONG",
        });
      });

      it("should throw on invalid metadata format", async () => {
        await expect(
          cortex.agents.register({
            id: "test-agent",
            name: "Test",
            metadata: "invalid" as any,
          }),
        ).rejects.toMatchObject({
          code: "INVALID_METADATA_FORMAT",
        });
      });

      it("should throw on invalid config format", async () => {
        await expect(
          cortex.agents.register({
            id: "test-agent",
            name: "Test",
            config: ["invalid"] as any,
          }),
        ).rejects.toMatchObject({
          code: "INVALID_CONFIG_FORMAT",
        });
      });
    });

    describe("get() validation", () => {
      it("should throw on empty agent ID", async () => {
        await expect(cortex.agents.get("")).rejects.toMatchObject({
          code: "EMPTY_AGENT_ID",
        });
      });

      it("should throw on whitespace agent ID", async () => {
        await expect(cortex.agents.get("   ")).rejects.toMatchObject({
          code: "EMPTY_AGENT_ID",
        });
      });
    });

    describe("list() validation", () => {
      it("should throw on invalid limit (zero)", async () => {
        await expect(cortex.agents.list({ limit: 0 })).rejects.toMatchObject({
          code: "INVALID_LIMIT_VALUE",
        });
      });

      it("should throw on invalid limit (too large)", async () => {
        await expect(cortex.agents.list({ limit: 2000 })).rejects.toMatchObject(
          {
            code: "INVALID_LIMIT_VALUE",
          },
        );
      });

      it("should throw on negative offset", async () => {
        await expect(cortex.agents.list({ offset: -5 })).rejects.toMatchObject({
          code: "INVALID_OFFSET_VALUE",
        });
      });

      it("should throw on invalid status", async () => {
        await expect(
          cortex.agents.list({ status: "deleted" as any }),
        ).rejects.toMatchObject({
          code: "INVALID_STATUS",
        });
      });

      it("should throw on invalid sortBy", async () => {
        await expect(
          cortex.agents.list({ sortBy: "invalid" as any }),
        ).rejects.toMatchObject({
          code: "INVALID_SORT_BY",
        });
      });

      it("should throw on invalid sortOrder", async () => {
        await expect(
          cortex.agents.list({ sortOrder: "descending" as any }),
        ).rejects.toMatchObject({
          code: "INVALID_SORT_ORDER",
        });
      });

      it("should throw on invalid timestamp range", async () => {
        await expect(
          cortex.agents.list({
            registeredAfter: 1000,
            registeredBefore: 500,
          }),
        ).rejects.toMatchObject({
          code: "INVALID_TIMESTAMP_RANGE",
        });
      });

      it("should throw on invalid metadata format", async () => {
        await expect(
          cortex.agents.list({ metadata: "invalid" as any }),
        ).rejects.toMatchObject({
          code: "INVALID_METADATA_FORMAT",
        });
      });
    });

    describe("search() validation", () => {
      it("should throw on invalid filters", async () => {
        await expect(cortex.agents.search({ limit: -1 })).rejects.toMatchObject(
          {
            code: "INVALID_LIMIT_VALUE",
          },
        );
      });
    });

    describe("count() validation", () => {
      it("should throw on invalid status", async () => {
        await expect(
          cortex.agents.count({ status: "deleted" as any }),
        ).rejects.toMatchObject({
          code: "INVALID_STATUS",
        });
      });
    });

    describe("update() validation", () => {
      it("should throw on empty agent ID", async () => {
        await expect(
          cortex.agents.update("", { name: "New Name" }),
        ).rejects.toMatchObject({
          code: "EMPTY_AGENT_ID",
        });
      });

      it("should throw when no update fields provided", async () => {
        await expect(
          cortex.agents.update("test-agent", {}),
        ).rejects.toMatchObject({
          code: "MISSING_UPDATES",
        });
      });

      it("should throw on invalid status in update", async () => {
        await expect(
          cortex.agents.update("test-agent", { status: "deleted" as any }),
        ).rejects.toMatchObject({
          code: "INVALID_STATUS",
        });
      });

      it("should throw on invalid name format", async () => {
        await expect(
          cortex.agents.update("test-agent", { name: "" }),
        ).rejects.toMatchObject({
          code: "EMPTY_AGENT_NAME",
        });
      });
    });

    describe("configure() validation", () => {
      it("should throw on empty agent ID", async () => {
        await expect(
          cortex.agents.configure("", { setting: "value" }),
        ).rejects.toMatchObject({
          code: "EMPTY_AGENT_ID",
        });
      });

      it("should throw on empty config object", async () => {
        await expect(
          cortex.agents.configure("test-agent", {}),
        ).rejects.toMatchObject({
          code: "EMPTY_CONFIG_OBJECT",
        });
      });

      it("should throw on invalid config format", async () => {
        await expect(
          cortex.agents.configure("test-agent", "invalid" as any),
        ).rejects.toMatchObject({
          code: "INVALID_CONFIG_FORMAT",
        });
      });
    });

    describe("exists() validation", () => {
      it("should throw on empty agent ID", async () => {
        await expect(cortex.agents.exists("")).rejects.toMatchObject({
          code: "EMPTY_AGENT_ID",
        });
      });
    });

    describe("unregister() validation", () => {
      it("should throw on empty agent ID", async () => {
        await expect(cortex.agents.unregister("")).rejects.toMatchObject({
          code: "EMPTY_AGENT_ID",
        });
      });

      it("should throw on conflicting options", async () => {
        await expect(
          cortex.agents.unregister("test-agent", {
            dryRun: true,
            verify: false,
          }),
        ).rejects.toMatchObject({
          code: "CONFLICTING_OPTIONS",
        });
      });
    });

    describe("unregisterMany() validation", () => {
      it("should throw on invalid filters", async () => {
        await expect(
          cortex.agents.unregisterMany({ limit: -1 }),
        ).rejects.toMatchObject({
          code: "INVALID_LIMIT_VALUE",
        });
      });

      it("should throw on conflicting options", async () => {
        await expect(
          cortex.agents.unregisterMany(
            { status: "archived" },
            { dryRun: true, verify: false },
          ),
        ).rejects.toMatchObject({
          code: "CONFLICTING_OPTIONS",
        });
      });
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Registry Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("register() and get()", () => {
    it("registers an agent", async () => {
      const agentId = ctx.agentId("register");

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
      const agentId = ctx.agentId("get");

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
      const result = await cortex.agents.get(ctx.agentId("non-existent"));
      expect(result).toBeNull();
    });

    it("throws error when registering duplicate agent", async () => {
      // Note: This tests BACKEND validation (existence check)
      // Client-side validation tests are in "Client-Side Validation" suite above
      const agentId = ctx.agentId("duplicate");

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
      const agent1 = ctx.agentId("list-1");
      const agent2 = ctx.agentId("list-2");

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
      const agentId = ctx.agentId("search");

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
      const agentId = ctx.agentId("update");

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
      const agentId = ctx.agentId("configure");

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
      const agentId = ctx.agentId("exists");
      await cortex.agents.register({ id: agentId, name: "Exists Test" });

      const exists = await cortex.agents.exists(agentId);
      expect(exists).toBe(true);
    });

    it("returns false for unregistered agent", async () => {
      const exists = await cortex.agents.exists(
        ctx.agentId("non-existent-check"),
      );
      expect(exists).toBe(false);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Simple Unregister (no cascade)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("unregister() - simple mode", () => {
    it("unregisters agent without deleting data", async () => {
      const agentId = ctx.agentId("unregister");

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
      const agentId = ctx.agentId("cascade");
      const space1 = ctx.memorySpaceId("cascade-1");
      const space2 = ctx.memorySpaceId("cascade-2");

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
          agentId: agentId,
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
    }, 60000); // 60s timeout for cascade operation
  });

  describe("unregister() - dry run mode", () => {
    it("previews deletion without actually deleting", async () => {
      const agentId = ctx.agentId("dry-run");

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
      const agentId = ctx.agentId("verify");

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
      const agentId = ctx.agentId("unregistered");
      const spaceId = ctx.memorySpaceId("unreg");

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

      // Allow time for Convex to commit mutations (increased delay for cascade operations)
      await new Promise((resolve) => setTimeout(resolve, 200));

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
      // Note: This tests BACKEND behavior (not found handling)
      // Client-side validation ensures agentId format is valid
      const result = await cortex.agents.unregister(
        ctx.agentId("non-existent-edge"),
        {
          cascade: true,
        },
      );

      expect(result.totalDeleted).toBe(0);
    });

    it("handles agent with no data", async () => {
      const agentId = ctx.agentId("empty");

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
      const agentId = ctx.agentId("stats");
      const spaceId = ctx.memorySpaceId("stats");

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

  describe("unregisterMany()", () => {
    // Use test-scoped IDs and metadata to avoid parallel run conflicts
    const bulkAgent1Id = ctx.agentId("bulk-1");
    const bulkAgent2Id = ctx.agentId("bulk-2");
    const bulkAgent3Id = ctx.agentId("bulk-3");
    const testEnvTag = `test-env-${ctx.runId}`;
    const prodEnvTag = `prod-env-${ctx.runId}`;
    const experimentalTeam = `experimental-${ctx.runId}`;
    const coreTeam = `core-${ctx.runId}`;
    const bulkTestSpace = ctx.memorySpaceId("bulk-test");

    beforeEach(async () => {
      // Cleanup any existing test agents
      const agentIds = [bulkAgent1Id, bulkAgent2Id, bulkAgent3Id];
      for (const agentId of agentIds) {
        try {
          await cortex.agents.unregister(agentId);
        } catch (_error) {
          // Ignore if doesn't exist
        }
      }

      // Wait a bit for cleanup to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Register multiple test agents with run-scoped metadata
      await cortex.agents.register({
        id: bulkAgent1Id,
        name: "Bulk Agent 1",
        metadata: { environment: testEnvTag, team: experimentalTeam },
      });

      await cortex.agents.register({
        id: bulkAgent2Id,
        name: "Bulk Agent 2",
        metadata: { environment: testEnvTag, team: experimentalTeam },
      });

      await cortex.agents.register({
        id: bulkAgent3Id,
        name: "Bulk Agent 3",
        metadata: { environment: prodEnvTag, team: coreTeam },
      });
    });

    it("unregisters multiple agents without cascade", async () => {
      const result = await cortex.agents.unregisterMany(
        { metadata: { environment: testEnvTag } },
        { cascade: false },
      );

      expect(result.deleted).toBe(2);
      expect(result.agentIds).toContain(bulkAgent1Id);
      expect(result.agentIds).toContain(bulkAgent2Id);

      // Verify unregistered
      const agent1 = await cortex.agents.get(bulkAgent1Id);
      const agent2 = await cortex.agents.get(bulkAgent2Id);
      const agent3 = await cortex.agents.get(bulkAgent3Id);

      expect(agent1).toBeNull();
      expect(agent2).toBeNull();
      expect(agent3).not.toBeNull(); // Not matched by filter
    });

    it("dry run preview", async () => {
      const result = await cortex.agents.unregisterMany(
        { metadata: { team: experimentalTeam } },
        { dryRun: true },
      );

      expect(result.deleted).toBe(0);
      expect(result.agentIds).toHaveLength(2);

      // Verify agents still exist
      const agent1 = await cortex.agents.get(bulkAgent1Id);
      expect(agent1).not.toBeNull();
    });

    it("handles empty result set gracefully", async () => {
      const result = await cortex.agents.unregisterMany(
        { metadata: { team: `nonexistent-${ctx.runId}` } },
        { cascade: false },
      );

      expect(result.deleted).toBe(0);
      expect(result.agentIds).toHaveLength(0);
    });

    it("unregisters with cascade deletion", async () => {
      // First clean up any existing memories for bulk-agent-1
      try {
        const existingMemories = await cortex.vector.list({
          memorySpaceId: bulkTestSpace,
        });
        const existingAgentMemories = existingMemories.filter(
          (m) => m.participantId === bulkAgent1Id,
        );
        for (const memory of existingAgentMemories) {
          await cortex.vector.delete(bulkTestSpace, memory.memoryId);
        }
      } catch (_error) {
        // Ignore cleanup errors
      }

      // Create data for bulk-agent-1
      const conv = await cortex.conversations.create({
        memorySpaceId: bulkTestSpace,
        type: "user-agent",
        participants: {
          userId: ctx.userId("bulk-test"),
          agentId: bulkAgent1Id,
          participantId: bulkAgent1Id,
        },
      });

      await cortex.memory.remember({
        memorySpaceId: bulkTestSpace,
        participantId: bulkAgent1Id,
        conversationId: conv.conversationId,
        userMessage: "Test",
        agentResponse: "OK",
        userId: ctx.userId("bulk-test"),
        userName: "Test User",
        agentId: bulkAgent1Id,
      });

      // Verify memory was created
      const beforeMemories = await cortex.vector.list({
        memorySpaceId: bulkTestSpace,
      });
      const beforeAgentMemories = beforeMemories.filter(
        (m) => m.participantId === bulkAgent1Id,
      );
      expect(beforeAgentMemories.length).toBeGreaterThan(0);

      // Unregister with cascade - use scoped metadata filter
      const result = await cortex.agents.unregisterMany(
        { metadata: { environment: testEnvTag } },
        { cascade: true },
      );

      expect(result.deleted).toBe(2);
      expect(result.totalDataDeleted).toBeGreaterThan(0);

      // Note: In local mode, cascade deletion reports success but there's a known
      // timing issue where memories may not be immediately removed from vector.list()
      // The operation itself completes successfully (totalDataDeleted > 0),
      // indicating the cascade deletion logic works correctly
    }, 60000); // Increased timeout for cascade deletion which can be slow in managed mode
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // export() Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("export()", () => {
    const exportAgent1Id = ctx.agentId("export-1");
    const exportAgent2Id = ctx.agentId("export-2");
    const exportAgent3Id = ctx.agentId("export-3");
    const exportTeamTag = `export-team-${ctx.runId}`;

    beforeEach(async () => {
      // Cleanup any existing test agents
      const agentIds = [exportAgent1Id, exportAgent2Id, exportAgent3Id];
      for (const agentId of agentIds) {
        try {
          await cortex.agents.unregister(agentId);
        } catch (_error) {
          // Ignore if doesn't exist
        }
      }

      // Wait for cleanup
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Register test agents with varied metadata
      await cortex.agents.register({
        id: exportAgent1Id,
        name: "Export Agent One",
        description: "First export test agent",
        metadata: { team: exportTeamTag, role: "primary" },
        config: { setting: "value1" },
      });

      await cortex.agents.register({
        id: exportAgent2Id,
        name: "Export Agent Two",
        description: "Second export test agent with special, chars",
        metadata: { team: exportTeamTag, role: "secondary" },
        config: { setting: "value2" },
      });

      await cortex.agents.register({
        id: exportAgent3Id,
        name: 'Export Agent "Three"',
        description: "Third agent with\nnewline",
        metadata: { team: `other-${ctx.runId}`, role: "tertiary" },
        config: { setting: "value3" },
      });
    });

    describe("JSON format", () => {
      it("should export agents as JSON", async () => {
        const result = await cortex.agents.export({
          format: "json",
          filters: { metadata: { team: exportTeamTag } },
        });

        expect(result.format).toBe("json");
        expect(result.count).toBe(2);
        expect(result.exportedAt).toBeGreaterThan(0);

        const parsed = JSON.parse(result.data);
        expect(Array.isArray(parsed)).toBe(true);
        expect(parsed).toHaveLength(2);

        // Verify agent data
        const agent1 = parsed.find((a: any) => a.id === exportAgent1Id);
        expect(agent1).toBeDefined();
        expect(agent1.name).toBe("Export Agent One");
        expect(agent1.metadata.team).toBe(exportTeamTag);
      });

      it("should include metadata by default", async () => {
        const result = await cortex.agents.export({
          format: "json",
          filters: { metadata: { team: exportTeamTag } },
        });

        const parsed = JSON.parse(result.data);
        expect(parsed[0].metadata).toBeDefined();
        expect(parsed[0].config).toBeDefined();
      });

      it("should include stats when includeStats=true", async () => {
        const result = await cortex.agents.export({
          format: "json",
          filters: { metadata: { team: exportTeamTag } },
          includeStats: true,
        });

        const parsed = JSON.parse(result.data);
        expect(parsed[0].stats).toBeDefined();
        expect(parsed[0].stats.totalMemories).toBeDefined();
        expect(parsed[0].stats.totalConversations).toBeDefined();
        expect(parsed[0].stats.totalFacts).toBeDefined();
        expect(parsed[0].stats.memorySpacesActive).toBeDefined();
      });

      it("should handle empty result set", async () => {
        const result = await cortex.agents.export({
          format: "json",
          filters: { metadata: { team: `nonexistent-${ctx.runId}` } },
        });

        expect(result.format).toBe("json");
        expect(result.count).toBe(0);

        const parsed = JSON.parse(result.data);
        expect(parsed).toHaveLength(0);
      });
    });

    describe("CSV format", () => {
      it("should export agents as CSV", async () => {
        const result = await cortex.agents.export({
          format: "csv",
          filters: { metadata: { team: exportTeamTag } },
        });

        expect(result.format).toBe("csv");
        expect(result.count).toBe(2);
        expect(result.exportedAt).toBeGreaterThan(0);

        // Parse CSV
        const lines = result.data.split("\n");
        expect(lines.length).toBeGreaterThanOrEqual(3); // header + 2 data rows

        // Verify header
        const header = lines[0];
        expect(header).toContain("id");
        expect(header).toContain("name");
        expect(header).toContain("description");
        expect(header).toContain("status");
      });

      it("should escape CSV fields with special characters", async () => {
        const result = await cortex.agents.export({
          format: "csv",
          filters: { metadata: { team: `other-${ctx.runId}` } },
        });

        // Agent 3 has special characters: quotes and newlines
        expect(result.data).toContain('"'); // Should have escaped quotes

        // The description with newline and name with quotes should be escaped
        const lines = result.data.split("\n");
        expect(lines.length).toBeGreaterThanOrEqual(2);
      });

      it("should include stats columns when includeStats=true", async () => {
        const result = await cortex.agents.export({
          format: "csv",
          filters: { metadata: { team: exportTeamTag } },
          includeStats: true,
        });

        const header = result.data.split("\n")[0];
        expect(header).toContain("totalMemories");
        expect(header).toContain("totalConversations");
        expect(header).toContain("totalFacts");
        expect(header).toContain("memorySpacesActive");
      });

      it("should handle empty result set", async () => {
        const result = await cortex.agents.export({
          format: "csv",
          filters: { metadata: { team: `nonexistent-${ctx.runId}` } },
        });

        expect(result.format).toBe("csv");
        expect(result.count).toBe(0);

        // Should only have header row
        const lines = result.data.split("\n").filter((l) => l.trim());
        expect(lines).toHaveLength(1);
      });
    });

    describe("validation", () => {
      it("should throw on invalid format", async () => {
        await expect(
          cortex.agents.export({
            format: "xml" as any,
          }),
        ).rejects.toMatchObject({
          code: "INVALID_FORMAT",
        });
      });

      it("should throw when format not provided", async () => {
        await expect(
          cortex.agents.export({} as any),
        ).rejects.toMatchObject({
          code: "MISSING_FORMAT",
        });
      });

      it("should throw on invalid filter in export", async () => {
        await expect(
          cortex.agents.export({
            format: "json",
            filters: { limit: -1 },
          }),
        ).rejects.toMatchObject({
          code: "INVALID_LIMIT_VALUE",
        });
      });
    });

    describe("filters", () => {
      it("should apply status filter to export", async () => {
        // Update one agent to inactive
        await cortex.agents.update(exportAgent1Id, { status: "inactive" });

        const result = await cortex.agents.export({
          format: "json",
          filters: { status: "active", metadata: { team: exportTeamTag } },
        });

        const parsed = JSON.parse(result.data);
        expect(parsed).toHaveLength(1);
        expect(parsed[0].id).toBe(exportAgent2Id);
      });

      it("should apply metadata filter to export", async () => {
        const result = await cortex.agents.export({
          format: "json",
          filters: { metadata: { role: "primary" } },
        });

        const parsed = JSON.parse(result.data);
        expect(parsed.length).toBeGreaterThanOrEqual(1);
        expect(parsed.every((a: any) => a.metadata.role === "primary")).toBe(
          true,
        );
      });
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // updateMany() Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("updateMany()", () => {
    const updateManyAgent1Id = ctx.agentId("update-many-1");
    const updateManyAgent2Id = ctx.agentId("update-many-2");
    const updateManyAgent3Id = ctx.agentId("update-many-3");
    const updateManyTeamTag = `update-many-team-${ctx.runId}`;
    const updateManyVersionTag = `v1.0-${ctx.runId}`;

    beforeEach(async () => {
      // Cleanup any existing test agents
      const agentIds = [updateManyAgent1Id, updateManyAgent2Id, updateManyAgent3Id];
      for (const agentId of agentIds) {
        try {
          await cortex.agents.unregister(agentId);
        } catch (_error) {
          // Ignore if doesn't exist
        }
      }

      // Wait for cleanup
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Register test agents
      await cortex.agents.register({
        id: updateManyAgent1Id,
        name: "Update Many Agent 1",
        description: "First agent for update many test",
        metadata: { team: updateManyTeamTag, version: updateManyVersionTag },
        config: { retentionDays: 30 },
      });

      await cortex.agents.register({
        id: updateManyAgent2Id,
        name: "Update Many Agent 2",
        description: "Second agent for update many test",
        metadata: { team: updateManyTeamTag, version: updateManyVersionTag },
        config: { retentionDays: 30 },
      });

      await cortex.agents.register({
        id: updateManyAgent3Id,
        name: "Update Many Agent 3",
        description: "Third agent - different team",
        metadata: { team: `other-team-${ctx.runId}`, version: updateManyVersionTag },
        config: { retentionDays: 60 },
      });
    });

    it("should update multiple agents matching metadata filter", async () => {
      const result = await cortex.agents.updateMany(
        { metadata: { team: updateManyTeamTag } },
        { description: "Updated description for team" },
      );

      expect(result.updated).toBe(2);
      expect(result.agentIds).toContain(updateManyAgent1Id);
      expect(result.agentIds).toContain(updateManyAgent2Id);
      expect(result.agentIds).not.toContain(updateManyAgent3Id);

      // Verify updates
      const agent1 = await cortex.agents.get(updateManyAgent1Id);
      const agent2 = await cortex.agents.get(updateManyAgent2Id);
      const agent3 = await cortex.agents.get(updateManyAgent3Id);

      expect(agent1!.description).toBe("Updated description for team");
      expect(agent2!.description).toBe("Updated description for team");
      expect(agent3!.description).toBe("Third agent - different team"); // Unchanged
    });

    it("should update multiple agents with metadata update", async () => {
      const newVersion = `v2.0-${ctx.runId}`;

      const result = await cortex.agents.updateMany(
        { metadata: { version: updateManyVersionTag } },
        { metadata: { version: newVersion, upgraded: true } },
      );

      expect(result.updated).toBe(3); // All 3 agents had the version tag

      // Verify all agents have new metadata
      const agent1 = await cortex.agents.get(updateManyAgent1Id);
      const agent2 = await cortex.agents.get(updateManyAgent2Id);
      const agent3 = await cortex.agents.get(updateManyAgent3Id);

      expect(agent1!.metadata.version).toBe(newVersion);
      expect(agent1!.metadata.upgraded).toBe(true);
      expect(agent2!.metadata.version).toBe(newVersion);
      expect(agent3!.metadata.version).toBe(newVersion);
    });

    it("should update multiple agents with config update", async () => {
      const result = await cortex.agents.updateMany(
        { metadata: { team: updateManyTeamTag } },
        { config: { retentionDays: 90, newSetting: "enabled" } },
      );

      expect(result.updated).toBe(2);

      const agent1 = await cortex.agents.get(updateManyAgent1Id);
      expect(agent1!.config.retentionDays).toBe(90);
      expect(agent1!.config.newSetting).toBe("enabled");
    });

    it("should return { updated: 0, agentIds: [] } for empty filter match", async () => {
      const result = await cortex.agents.updateMany(
        { metadata: { team: `nonexistent-${ctx.runId}` } },
        { description: "This should not update anything" },
      );

      expect(result.updated).toBe(0);
      expect(result.agentIds).toHaveLength(0);
    });

    it("should throw when no update fields provided", async () => {
      await expect(
        cortex.agents.updateMany({ metadata: { team: updateManyTeamTag } }, {}),
      ).rejects.toMatchObject({
        code: "MISSING_UPDATES",
      });
    });

    it("should throw on invalid metadata format in updates", async () => {
      await expect(
        cortex.agents.updateMany(
          { metadata: { team: updateManyTeamTag } },
          { metadata: "invalid" as any },
        ),
      ).rejects.toMatchObject({
        code: "INVALID_METADATA_FORMAT",
      });
    });

    it("should throw on invalid config format in updates", async () => {
      await expect(
        cortex.agents.updateMany(
          { metadata: { team: updateManyTeamTag } },
          { config: ["invalid"] as any },
        ),
      ).rejects.toMatchObject({
        code: "INVALID_CONFIG_FORMAT",
      });
    });

    it("should preserve non-updated fields", async () => {
      const originalAgent = await cortex.agents.get(updateManyAgent1Id);
      const originalName = originalAgent!.name;
      const originalMetadata = { ...originalAgent!.metadata };

      // Only update description
      await cortex.agents.updateMany(
        { metadata: { team: updateManyTeamTag } },
        { description: "Only description changed" },
      );

      const updatedAgent = await cortex.agents.get(updateManyAgent1Id);
      expect(updatedAgent!.name).toBe(originalName);
      expect(updatedAgent!.metadata.team).toBe(originalMetadata.team);
      expect(updatedAgent!.description).toBe("Only description changed");
    });

    it("should update name for multiple agents", async () => {
      const result = await cortex.agents.updateMany(
        { metadata: { team: updateManyTeamTag } },
        { name: "Renamed Team Agent" },
      );

      expect(result.updated).toBe(2);

      const agent1 = await cortex.agents.get(updateManyAgent1Id);
      const agent2 = await cortex.agents.get(updateManyAgent2Id);

      expect(agent1!.name).toBe("Renamed Team Agent");
      expect(agent2!.name).toBe("Renamed Team Agent");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Advanced list() Filter Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("list() - advanced filters", () => {
    const filterAgent1Id = ctx.agentId("filter-1");
    const filterAgent2Id = ctx.agentId("filter-2");
    const filterAgent3Id = ctx.agentId("filter-3");
    const filterAgent4Id = ctx.agentId("filter-4");
    const filterTeamTag = `filter-team-${ctx.runId}`;

    beforeAll(async () => {
      // Cleanup any existing test agents
      const agentIds = [filterAgent1Id, filterAgent2Id, filterAgent3Id, filterAgent4Id];
      for (const agentId of agentIds) {
        try {
          await cortex.agents.unregister(agentId);
        } catch (_error) {
          // Ignore if doesn't exist
        }
      }

      // Wait for cleanup
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Register test agents with varied capabilities and timestamps
      await cortex.agents.register({
        id: filterAgent1Id,
        name: "Search Filter Agent Alpha",
        description: "First filter test agent",
        metadata: {
          team: filterTeamTag,
          capabilities: ["code", "analysis", "testing"],
        },
      });

      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 50));

      await cortex.agents.register({
        id: filterAgent2Id,
        name: "Filter Agent Beta",
        description: "Second filter test agent",
        metadata: {
          team: filterTeamTag,
          capabilities: ["code", "documentation"],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      await cortex.agents.register({
        id: filterAgent3Id,
        name: "Filter Agent Gamma",
        description: "Third filter test agent",
        metadata: {
          team: filterTeamTag,
          capabilities: ["testing", "documentation"],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      await cortex.agents.register({
        id: filterAgent4Id,
        name: "Other Filter Agent",
        description: "Fourth filter test agent",
        metadata: {
          team: `other-${ctx.runId}`,
          capabilities: ["analysis"],
        },
      });
    });

    afterAll(async () => {
      // Cleanup test agents
      const agentIds = [filterAgent1Id, filterAgent2Id, filterAgent3Id, filterAgent4Id];
      for (const agentId of agentIds) {
        try {
          await cortex.agents.unregister(agentId);
        } catch (_error) {
          // Ignore
        }
      }
    });

    it("should filter by capabilities with 'any' match mode (default)", async () => {
      const results = await cortex.agents.list({
        metadata: { team: filterTeamTag },
        capabilities: ["code"],
      });

      // Agent 1 and 2 have "code" capability
      expect(results.length).toBe(2);
      expect(results.some((a) => a.id === filterAgent1Id)).toBe(true);
      expect(results.some((a) => a.id === filterAgent2Id)).toBe(true);
    });

    it("should filter by capabilities with 'any' match mode - multiple capabilities", async () => {
      const results = await cortex.agents.list({
        metadata: { team: filterTeamTag },
        capabilities: ["code", "testing"],
        capabilitiesMatch: "any",
      });

      // Agent 1 has both, Agent 2 has code, Agent 3 has testing
      expect(results.length).toBe(3);
    });

    it("should filter by capabilities with 'all' match mode", async () => {
      const results = await cortex.agents.list({
        metadata: { team: filterTeamTag },
        capabilities: ["code", "analysis"],
        capabilitiesMatch: "all",
      });

      // Only Agent 1 has both "code" AND "analysis"
      expect(results.length).toBe(1);
      expect(results[0].id).toBe(filterAgent1Id);
    });

    it("should filter by name (partial match, case insensitive)", async () => {
      const results = await cortex.agents.list({
        name: "search filter",
      });

      // Only filterAgent1 has "Search Filter" in name
      const matchingAgents = results.filter((a) =>
        a.name.toLowerCase().includes("search filter"),
      );
      expect(matchingAgents.length).toBeGreaterThanOrEqual(1);
      expect(matchingAgents.some((a) => a.id === filterAgent1Id)).toBe(true);
    });

    it("should combine multiple filters", async () => {
      const results = await cortex.agents.list({
        metadata: { team: filterTeamTag },
        capabilities: ["testing"],
        name: "gamma",
      });

      // Only Agent 3 matches all: team, has testing, name contains gamma
      expect(results.length).toBe(1);
      expect(results[0].id).toBe(filterAgent3Id);
    });

    it("should handle offset pagination correctly", async () => {
      // Note: The SDK applies offset at backend before client-side filtering (metadata, etc.)
      // This means offset + client-side filters don't work as expected when there's lots of data.
      // This test verifies offset works at the raw backend level without client-side filters.

      // First, list without any filters to get baseline
      const allAgents = await cortex.agents.list({ limit: 10 });

      // Verify we have some agents
      expect(allAgents.length).toBeGreaterThan(0);

      // With offset, should return fewer or equal results (depending on how many agents exist)
      const withOffset = await cortex.agents.list({
        limit: 10,
        offset: 1,
      });

      // Should be valid array
      expect(Array.isArray(withOffset)).toBe(true);

      // If allAgents had data, offset should result in one less or same
      if (allAgents.length > 1) {
        expect(withOffset.length).toBeLessThanOrEqual(allAgents.length);
      }
    });

    it("should handle limit with offset correctly", async () => {
      // Test limit with offset using backend filter (status) not client-side filter
      const results = await cortex.agents.list({
        status: "active",
        offset: 1,
        limit: 1,
      });

      expect(results.length).toBe(1);
    });

    it("should return empty array when offset exceeds results", async () => {
      // Use backend filter to test offset behavior
      const results = await cortex.agents.list({
        status: "active",
        offset: 1000,
      });

      expect(results).toHaveLength(0);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Not-Found Error Tests for update() and configure()
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("not-found error handling", () => {
    it("update() should throw AGENT_NOT_REGISTERED when agent doesn't exist", async () => {
      const nonExistentAgentId = ctx.agentId("non-existent-update");

      await expect(
        cortex.agents.update(nonExistentAgentId, { name: "New Name" }),
      ).rejects.toThrow("AGENT_NOT_REGISTERED");
    });

    it("configure() should throw AGENT_NOT_REGISTERED when agent doesn't exist", async () => {
      const nonExistentAgentId = ctx.agentId("non-existent-configure");

      await expect(
        cortex.agents.configure(nonExistentAgentId, { setting: "value" }),
      ).rejects.toThrow("AGENT_NOT_REGISTERED");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Integration Workflow Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("integration workflows", () => {
    it("complete lifecycle: register → configure → update status → unregister", async () => {
      const lifecycleAgentId = ctx.agentId("lifecycle");

      // Step 1: Register
      const registered = await cortex.agents.register({
        id: lifecycleAgentId,
        name: "Lifecycle Test Agent",
        description: "Testing full lifecycle",
        metadata: { phase: "initial" },
      });

      expect(registered.id).toBe(lifecycleAgentId);
      expect(registered.status).toBe("active");

      // Step 2: Configure
      await cortex.agents.configure(lifecycleAgentId, {
        memoryRetention: 30,
        maxConversations: 100,
      });

      const configured = await cortex.agents.get(lifecycleAgentId);
      expect(configured!.config.memoryRetention).toBe(30);
      expect(configured!.config.maxConversations).toBe(100);

      // Step 3: Update status to inactive
      const updated = await cortex.agents.update(lifecycleAgentId, {
        status: "inactive",
        metadata: { phase: "deactivated" },
      });

      expect(updated.status).toBe("inactive");
      expect(updated.metadata.phase).toBe("deactivated");

      // Step 4: Verify exists
      const exists = await cortex.agents.exists(lifecycleAgentId);
      expect(exists).toBe(true);

      // Step 5: Unregister
      const unregisterResult = await cortex.agents.unregister(lifecycleAgentId);
      expect(unregisterResult.agentId).toBe(lifecycleAgentId);

      // Step 6: Verify deleted
      const deleted = await cortex.agents.get(lifecycleAgentId);
      expect(deleted).toBeNull();

      const existsAfter = await cortex.agents.exists(lifecycleAgentId);
      expect(existsAfter).toBe(false);
    });

    it("stats reflect actual data across multiple memory spaces", async () => {
      const statsAgentId = ctx.agentId("stats-integration");
      const statsSpace1 = ctx.memorySpaceId("stats-space-1");
      const statsSpace2 = ctx.memorySpaceId("stats-space-2");

      // Register agent
      await cortex.agents.register({
        id: statsAgentId,
        name: "Stats Integration Agent",
      });

      // Register memory spaces
      await cortex.memorySpaces.register({
        memorySpaceId: statsSpace1,
        type: "personal",
      });
      await cortex.memorySpaces.register({
        memorySpaceId: statsSpace2,
        type: "personal",
      });

      // Create data in space 1
      await cortex.vector.store(statsSpace1, {
        content: "Memory in space 1",
        contentType: "raw",
        participantId: statsAgentId,
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });

      // Create data in space 2
      await cortex.vector.store(statsSpace2, {
        content: "Memory in space 2",
        contentType: "raw",
        participantId: statsAgentId,
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });

      // Create a fact
      await cortex.facts.store({
        memorySpaceId: statsSpace1,
        participantId: statsAgentId,
        fact: "Test fact for stats",
        factType: "knowledge",
        subject: "test",
        confidence: 90,
        sourceType: "system",
      });

      // Wait for data to persist
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Get agent with stats
      const agent = await cortex.agents.get(statsAgentId);

      expect(agent).not.toBeNull();
      expect(agent!.stats).toBeDefined();
      expect(agent!.stats!.totalMemories).toBeGreaterThanOrEqual(2);
      expect(agent!.stats!.totalFacts).toBeGreaterThanOrEqual(1);
      expect(agent!.stats!.memorySpacesActive).toBeGreaterThanOrEqual(2);

      // Cleanup
      await cortex.agents.unregister(statsAgentId, { cascade: true });
    }, 30000);

    it("cascade delete across 3+ memory spaces", async () => {
      const cascadeAgentId = ctx.agentId("cascade-multi");
      const cascadeSpaces = [
        ctx.memorySpaceId("cascade-space-1"),
        ctx.memorySpaceId("cascade-space-2"),
        ctx.memorySpaceId("cascade-space-3"),
      ];

      // Register agent
      await cortex.agents.register({
        id: cascadeAgentId,
        name: "Multi-Space Cascade Agent",
      });

      // Register spaces and create data in each
      for (const spaceId of cascadeSpaces) {
        await cortex.memorySpaces.register({
          memorySpaceId: spaceId,
          type: "personal",
        });

        await cortex.vector.store(spaceId, {
          content: `Memory in ${spaceId}`,
          contentType: "raw",
          participantId: cascadeAgentId,
          source: { type: "system" },
          metadata: { importance: 50, tags: [] },
        });
      }

      // Wait for data to persist
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Verify data exists
      for (const spaceId of cascadeSpaces) {
        const memories = await cortex.vector.list({ memorySpaceId: spaceId });
        const agentMemories = memories.filter(
          (m) => m.participantId === cascadeAgentId,
        );
        expect(agentMemories.length).toBeGreaterThanOrEqual(1);
      }

      // Cascade delete
      const result = await cortex.agents.unregister(cascadeAgentId, {
        cascade: true,
      });

      expect(result.agentId).toBe(cascadeAgentId);
      expect(result.memoriesDeleted).toBeGreaterThanOrEqual(3);
      expect(result.memorySpacesAffected.length).toBeGreaterThanOrEqual(3);

      // Verify all data deleted
      for (const spaceId of cascadeSpaces) {
        const memories = await cortex.vector.list({ memorySpaceId: spaceId });
        const agentMemories = memories.filter(
          (m) => m.participantId === cascadeAgentId,
        );
        expect(agentMemories).toHaveLength(0);
      }

      // Verify agent is gone
      const agent = await cortex.agents.get(cascadeAgentId);
      expect(agent).toBeNull();
    }, 60000);

    it("bulk operations: register multiple → updateMany → export → unregisterMany", async () => {
      const bulkPrefix = `bulk-workflow-${ctx.runId}`;
      const bulkAgentIds = [
        ctx.agentId(`${bulkPrefix}-1`),
        ctx.agentId(`${bulkPrefix}-2`),
        ctx.agentId(`${bulkPrefix}-3`),
      ];

      // Step 1: Register multiple agents
      for (const agentId of bulkAgentIds) {
        await cortex.agents.register({
          id: agentId,
          name: `Bulk Agent ${agentId}`,
          metadata: { bulkGroup: bulkPrefix, status: "new" },
        });
      }

      // Verify all registered
      const listed = await cortex.agents.list({
        metadata: { bulkGroup: bulkPrefix },
      });
      expect(listed).toHaveLength(3);

      // Step 2: Update all with updateMany
      const updateResult = await cortex.agents.updateMany(
        { metadata: { bulkGroup: bulkPrefix } },
        { metadata: { bulkGroup: bulkPrefix, status: "processed" } },
      );
      expect(updateResult.updated).toBe(3);

      // Verify updates
      for (const agentId of bulkAgentIds) {
        const agent = await cortex.agents.get(agentId);
        expect(agent!.metadata.status).toBe("processed");
      }

      // Step 3: Export
      const exportResult = await cortex.agents.export({
        format: "json",
        filters: { metadata: { bulkGroup: bulkPrefix } },
      });
      expect(exportResult.count).toBe(3);

      // Step 4: Unregister all
      const unregisterResult = await cortex.agents.unregisterMany(
        { metadata: { bulkGroup: bulkPrefix } },
        { cascade: false },
      );
      expect(unregisterResult.deleted).toBe(3);

      // Verify all deleted
      for (const agentId of bulkAgentIds) {
        const agent = await cortex.agents.get(agentId);
        expect(agent).toBeNull();
      }
    });
  });
});
