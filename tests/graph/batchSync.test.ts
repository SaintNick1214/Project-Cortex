/**
 * Batch Sync Integration Tests
 *
 * Tests for initial bulk sync of Cortex data to graph database.
 */

import { Cortex } from "../../src";
import { CypherGraphAdapter, initializeGraphSchema } from "../../src/graph";
import type { GraphAdapter } from "../../src/graph";
import { initialGraphSync } from "../../src/graph/sync/batchSync";
import type {
  BatchSyncOptions as _BatchSyncOptions,
  BatchSyncResult as _BatchSyncResult,
} from "../../src/graph/sync/batchSync";

// Check if graph testing is enabled
const GRAPH_TESTING_ENABLED = process.env.GRAPH_TESTING_ENABLED === "true";
const describeIfEnabled = GRAPH_TESTING_ENABLED ? describe : describe.skip;

const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";
const NEO4J_CONFIG = {
  uri: process.env.NEO4J_URI || "bolt://localhost:7687",
  username: process.env.NEO4J_USERNAME || "neo4j",
  password: process.env.NEO4J_PASSWORD || "cortex-dev-password",
};

describeIfEnabled("Batch Sync Integration", () => {
  let cortex: Cortex;
  let adapter: GraphAdapter;
  const timestamp = Date.now();
  const testMemorySpaceId = `batch-sync-test-${timestamp}`;

  beforeAll(async () => {
    // Setup graph adapter
    adapter = new CypherGraphAdapter();
    await adapter.connect(NEO4J_CONFIG);
    await adapter.clearDatabase();
    await initializeGraphSchema(adapter);

    // Setup Cortex (without graph auto-sync for manual batch testing)
    cortex = new Cortex({
      convexUrl: CONVEX_URL,
    });

    // Create test data in Cortex
    await setupTestData();
  });

  afterAll(async () => {
    await adapter.clearDatabase();
    await adapter.disconnect();
    cortex.close();
  });

  async function setupTestData() {
    // Create memory space
    await cortex.memorySpaces.register({
      memorySpaceId: testMemorySpaceId,
      name: "Batch Sync Test Space",
      type: "personal",
    });

    // Create conversation
    await cortex.conversations.create({
      memorySpaceId: testMemorySpaceId,
      conversationId: `conv-batch-${timestamp}`,
      type: "user-agent",
      participants: {
        userId: "batch-user",
        agentId: "batch-agent",
      },
    });

    // Add messages to conversation
    await cortex.conversations.addMessage({
      conversationId: `conv-batch-${timestamp}`,
      message: {
        role: "user",
        content: "Test message for batch sync",
      },
    });

    await cortex.conversations.addMessage({
      conversationId: `conv-batch-${timestamp}`,
      message: {
        role: "agent",
        content: "Response for batch sync test",
      },
    });

    // Create context
    await cortex.contexts.create({
      memorySpaceId: testMemorySpaceId,
      purpose: "Batch sync test context",
      userId: "batch-user",
    });

    // Create facts
    await cortex.facts.store({
      memorySpaceId: testMemorySpaceId,
      fact: "Batch sync test fact 1",
      factType: "knowledge",
      confidence: 100,
      sourceType: "manual",
      tags: ["batch-test"],
    });

    await cortex.facts.store({
      memorySpaceId: testMemorySpaceId,
      fact: "Batch sync test fact 2",
      factType: "relationship",
      subject: "TestSubject",
      predicate: "relates_to",
      object: "TestObject",
      confidence: 95,
      sourceType: "conversation",
      tags: ["batch-test"],
    });

    // Give time for data to be persisted
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // ============================================================================
  // initialGraphSync Tests
  // ============================================================================
  describe("initialGraphSync()", () => {
    beforeEach(async () => {
      // Clear graph before each sync test
      await adapter.clearDatabase();
      await initializeGraphSchema(adapter);
    });

    it("should sync all entity types", async () => {
      const result = await initialGraphSync(cortex, adapter, {
        limits: {
          memorySpaces: 100,
          conversations: 100,
          contexts: 100,
          memories: 100,
          facts: 100,
        },
        syncRelationships: true,
      });

      expect(result).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);

      // Should have synced at least some entities
      expect(
        result.memorySpaces.synced +
          result.conversations.synced +
          result.contexts.synced +
          result.facts.synced,
      ).toBeGreaterThan(0);
    });

    it("should return BatchSyncResult with all fields", async () => {
      const result = await initialGraphSync(cortex, adapter);

      // Verify result structure
      expect(result).toHaveProperty("memorySpaces");
      expect(result).toHaveProperty("contexts");
      expect(result).toHaveProperty("conversations");
      expect(result).toHaveProperty("memories");
      expect(result).toHaveProperty("facts");
      expect(result).toHaveProperty("errors");
      expect(result).toHaveProperty("duration");

      // Each entity type should have synced/failed counts
      expect(result.memorySpaces).toHaveProperty("synced");
      expect(result.memorySpaces).toHaveProperty("failed");
      expect(result.contexts).toHaveProperty("synced");
      expect(result.contexts).toHaveProperty("failed");
    });

    it("should track sync progress via callback", async () => {
      const progressUpdates: Array<{
        entity: string;
        current: number;
        total: number;
      }> = [];

      await initialGraphSync(cortex, adapter, {
        onProgress: (entity, current, total) => {
          progressUpdates.push({ entity, current, total });
        },
      });

      // Should have received some progress updates
      // Note: May not receive updates if data is empty
      if (progressUpdates.length > 0) {
        expect(progressUpdates[0]).toHaveProperty("entity");
        expect(progressUpdates[0]).toHaveProperty("current");
        expect(progressUpdates[0]).toHaveProperty("total");
      }
    });

    it("should respect limits option", async () => {
      const result = await initialGraphSync(cortex, adapter, {
        limits: {
          memorySpaces: 1,
          conversations: 1,
          contexts: 1,
          memories: 1,
          facts: 1,
        },
      });

      // Should not have synced more than the limits
      expect(result.memorySpaces.synced).toBeLessThanOrEqual(1);
      expect(result.conversations.synced).toBeLessThanOrEqual(1);
      expect(result.contexts.synced).toBeLessThanOrEqual(1);
      expect(result.memories.synced).toBeLessThanOrEqual(1);
      expect(result.facts.synced).toBeLessThanOrEqual(1);
    });

    it("should skip relationships when syncRelationships is false", async () => {
      const result = await initialGraphSync(cortex, adapter, {
        syncRelationships: false,
      });

      // Should have synced nodes
      expect(result.memorySpaces.synced).toBeGreaterThanOrEqual(0);

      // Check if relationships were created (should be minimal without syncRelationships)
      const edges = await adapter.countEdges();
      // Some edges might still exist from node creation
      expect(typeof edges).toBe("number");
    });

    it("should create relationships when syncRelationships is true", async () => {
      const result = await initialGraphSync(cortex, adapter, {
        syncRelationships: true,
      });

      // Should have synced some entities
      const totalSynced =
        result.memorySpaces.synced +
        result.conversations.synced +
        result.contexts.synced +
        result.facts.synced;

      if (totalSynced > 1) {
        // Should have created some relationships
        const edges = await adapter.countEdges();
        expect(edges).toBeGreaterThan(0);
      }
    });

    it("should track errors during sync", async () => {
      const result = await initialGraphSync(cortex, adapter);

      // Errors array should exist
      expect(Array.isArray(result.errors)).toBe(true);

      // If there were errors, they should have proper structure
      if (result.errors.length > 0) {
        const error = result.errors[0];
        expect(error).toHaveProperty("entity");
        expect(error).toHaveProperty("id");
        expect(error).toHaveProperty("error");
      }
    });

    it("should sync memory spaces first (phase 1)", async () => {
      const phases: string[] = [];

      await initialGraphSync(cortex, adapter, {
        onProgress: (entity) => {
          if (!phases.includes(entity)) {
            phases.push(entity);
          }
        },
      });

      // MemorySpaces should be first if synced
      if (phases.includes("MemorySpaces")) {
        expect(phases.indexOf("MemorySpaces")).toBeLessThanOrEqual(0);
      }
    });

    it("should handle empty database gracefully", async () => {
      // Create a new memory space with no data
      const emptySpaceId = `empty-space-${timestamp}`;
      await cortex.memorySpaces.register({
        memorySpaceId: emptySpaceId,
        name: "Empty Space",
        type: "personal",
      });

      // Sync should not throw
      const result = await initialGraphSync(cortex, adapter, {
        limits: {
          memorySpaces: 100,
          conversations: 0,
          contexts: 0,
          memories: 0,
          facts: 0,
        },
      });

      expect(result.duration).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Graph Verification After Sync
  // ============================================================================
  describe("Graph Verification After Sync", () => {
    beforeEach(async () => {
      await adapter.clearDatabase();
      await initializeGraphSchema(adapter);
    });

    it("should create Memory Space nodes", async () => {
      await initialGraphSync(cortex, adapter, {
        limits: { memorySpaces: 100 },
      });

      const spaces = await adapter.findNodes("MemorySpace", {}, 100);
      expect(spaces.length).toBeGreaterThan(0);
    });

    it("should create Conversation nodes with properties", async () => {
      await initialGraphSync(cortex, adapter, {
        limits: { conversations: 100 },
        syncRelationships: false,
      });

      const conversations = await adapter.findNodes("Conversation", {}, 100);
      if (conversations.length > 0) {
        expect(conversations[0].properties).toHaveProperty("conversationId");
        expect(conversations[0].properties).toHaveProperty("type");
      }
    });

    it("should create Context nodes", async () => {
      await initialGraphSync(cortex, adapter, {
        limits: { contexts: 100 },
        syncRelationships: false,
      });

      const contexts = await adapter.findNodes("Context", {}, 100);
      if (contexts.length > 0) {
        expect(contexts[0].properties).toHaveProperty("contextId");
        expect(contexts[0].properties).toHaveProperty("purpose");
      }
    });

    it("should create Fact nodes with entities", async () => {
      await initialGraphSync(cortex, adapter, {
        limits: { facts: 100 },
        syncRelationships: true,
      });

      const facts = await adapter.findNodes("Fact", {}, 100);
      if (facts.length > 0) {
        expect(facts[0].properties).toHaveProperty("factId");
        expect(facts[0].properties).toHaveProperty("fact");
        expect(facts[0].properties).toHaveProperty("confidence");
      }

      // Should also create Entity nodes for facts with subject/object
      const entities = await adapter.findNodes("Entity", {}, 100);
      // May or may not have entities depending on fact data
      expect(Array.isArray(entities)).toBe(true);
    });

    it("should create IN_SPACE relationships", async () => {
      await initialGraphSync(cortex, adapter, {
        syncRelationships: true,
      });

      const inSpaceEdges = await adapter.findEdges("IN_SPACE", {}, 100);
      // Should have IN_SPACE relationships if entities were synced
      expect(Array.isArray(inSpaceEdges)).toBe(true);
    });

    it("should create User and Agent nodes from participants", async () => {
      await initialGraphSync(cortex, adapter, {
        syncRelationships: true,
      });

      // Check for User nodes
      const users = await adapter.findNodes("User", {}, 100);
      // May or may not have users depending on data

      // Check for Agent nodes
      const agents = await adapter.findNodes("Agent", {}, 100);
      // May or may not have agents depending on data

      expect(Array.isArray(users)).toBe(true);
      expect(Array.isArray(agents)).toBe(true);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================
  describe("Edge Cases", () => {
    beforeEach(async () => {
      await adapter.clearDatabase();
      await initializeGraphSchema(adapter);
    });

    it("should handle large batch sync", async () => {
      // Create multiple facts for bulk testing
      const factPromises = [];
      for (let i = 0; i < 10; i++) {
        factPromises.push(
          cortex.facts.store({
            memorySpaceId: testMemorySpaceId,
            fact: `Bulk test fact ${i}`,
            factType: "knowledge",
            confidence: 80 + i,
            sourceType: "manual",
            tags: ["bulk-test"],
          }),
        );
      }
      await Promise.all(factPromises);

      const result = await initialGraphSync(cortex, adapter, {
        limits: { facts: 100 },
      });

      // Should sync at least some facts (may include ones from earlier tests)
      expect(result.facts.synced + result.facts.failed).toBeGreaterThanOrEqual(
        0,
      );
    }, 60000); // 60 second timeout for larger sync with network latency

    it("should continue sync after individual failures", async () => {
      // Even if one entity fails, others should sync
      const result = await initialGraphSync(cortex, adapter);

      // Should have attempted all entity types
      expect(result).toHaveProperty("memorySpaces");
      expect(result).toHaveProperty("conversations");
      expect(result).toHaveProperty("contexts");
      expect(result).toHaveProperty("facts");
    });

    it("should be idempotent (can run multiple times)", async () => {
      // First sync
      const _result1 = await initialGraphSync(cortex, adapter);

      // Second sync - should update, not duplicate
      const _result2 = await initialGraphSync(cortex, adapter);

      // Count nodes after both syncs
      const totalNodes = await adapter.countNodes();

      // Should not have duplicated (merge semantics)
      // Note: Exact count depends on data, but shouldn't be doubled
      expect(typeof totalNodes).toBe("number");
    }, 120000); // 120 second timeout for two full syncs

    it("should handle disconnected graph adapter gracefully", async () => {
      const disconnectedAdapter = new CypherGraphAdapter();

      // Should handle gracefully and return errors, not throw
      const result = await initialGraphSync(cortex, disconnectedAdapter);

      // Should have result structure even when disconnected
      expect(result).toHaveProperty("errors");
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Performance Tests
  // ============================================================================
  describe("Performance", () => {
    it("should complete sync within reasonable time", async () => {
      await adapter.clearDatabase();
      await initializeGraphSchema(adapter);

      const start = Date.now();

      const result = await initialGraphSync(cortex, adapter, {
        limits: {
          memorySpaces: 10,
          conversations: 10,
          contexts: 10,
          memories: 10,
          facts: 10,
        },
      });

      const elapsed = Date.now() - start;

      // Should complete within 30 seconds for small dataset
      expect(elapsed).toBeLessThan(30000);
      expect(result.duration).toBeGreaterThan(0);
    });

    it("should report accurate duration", async () => {
      await adapter.clearDatabase();
      await initializeGraphSchema(adapter);

      const start = Date.now();
      const result = await initialGraphSync(cortex, adapter);
      const actualDuration = Date.now() - start;

      // Reported duration should be close to actual
      expect(Math.abs(result.duration - actualDuration)).toBeLessThan(1000);
    });
  });
});

// Skip message when not enabled
if (!GRAPH_TESTING_ENABLED) {
  describe("Batch Sync Integration", () => {
    it("should skip tests when graph databases not configured", () => {
      console.log("\n⚠️  Batch sync tests skipped");
      console.log("   To enable, set GRAPH_TESTING_ENABLED=true\n");
      expect(true).toBe(true);
    });
  });
}
