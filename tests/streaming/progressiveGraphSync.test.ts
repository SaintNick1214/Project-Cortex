/**
 * Progressive Graph Sync Tests
 *
 * Tests for progressive graph synchronization during streaming
 * Runs against both Neo4j and Memgraph
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from "@jest/globals";
import { CypherGraphAdapter } from "../../src/graph";
import type { GraphAdapter } from "../../src/graph";
import { ProgressiveGraphSync } from "../../src/memory/streaming/ProgressiveGraphSync";
import type { MemoryEntry } from "../../src/types";

// Check if graph testing is enabled
const GRAPH_TESTING_ENABLED = process.env.GRAPH_TESTING_ENABLED === "true";

const NEO4J_CONFIG = {
  uri: process.env.NEO4J_URI || "bolt://localhost:7687",
  username: process.env.NEO4J_USERNAME || "neo4j",
  password: process.env.NEO4J_PASSWORD || "cortex-dev-password",
};

const MEMGRAPH_CONFIG = {
  uri: process.env.MEMGRAPH_URI || "bolt://localhost:7688",
  username: process.env.MEMGRAPH_USERNAME || "memgraph",
  password: process.env.MEMGRAPH_PASSWORD || "cortex-dev-password",
};

// Skip all tests if graph testing is not enabled
const describeIfEnabled = GRAPH_TESTING_ENABLED ? describe : describe.skip;

// Test both databases
const databases = [
  { name: "Neo4j", config: NEO4J_CONFIG },
  { name: "Memgraph", config: MEMGRAPH_CONFIG },
];

databases.forEach(({ name, config }) => {
  describeIfEnabled(`ProgressiveGraphSync (${name})`, () => {
    let adapter: GraphAdapter;
    let graphSync: ProgressiveGraphSync;

    beforeAll(async () => {
      adapter = new CypherGraphAdapter();
      await adapter.connect(config);
      await adapter.clearDatabase();
    });

    afterAll(async () => {
      await adapter.clearDatabase();
      await adapter.disconnect();
    });

    beforeEach(async () => {
      // Clear database before each test
      await adapter.clearDatabase();

      // Create new instance for each test
      graphSync = new ProgressiveGraphSync(adapter, 1000); // 1s sync interval for testing
    });

    describe("Initialization", () => {
      it("should initialize partial memory node", async () => {
        const partialMemory = {
          memoryId: "mem-partial-test-1",
          memorySpaceId: "test-space",
          userId: "test-user",
          content: "Streaming content...",
        };

        const nodeId = await graphSync.initializePartialNode(partialMemory);

        expect(nodeId).toBeDefined();
        expect(graphSync.getPartialNodeId()).toBe(nodeId);

        // Verify node was created with correct properties
        const node = await adapter.getNode(nodeId);
        expect(node).not.toBeNull();
        expect(node!.label).toBe("Memory");
        expect(node!.properties.memoryId).toBe("mem-partial-test-1");
        expect(node!.properties.isPartial).toBe(true);
        expect(node!.properties.isStreaming).toBe(true);
      });

      it("should record sync event on initialization", async () => {
        const partialMemory = {
          memoryId: "mem-partial-test-2",
          memorySpaceId: "test-space",
          userId: "test-user",
          content: "Test",
        };

        await graphSync.initializePartialNode(partialMemory);

        const events = graphSync.getSyncEvents();
        expect(events.length).toBeGreaterThan(0);
        expect(events[0].eventType).toBe("node-created");
        expect(events[0].nodeId).toBeDefined();
      });
    });

    describe("Progressive Updates", () => {
      it("should update partial node with new content", async () => {
        const partialMemory = {
          memoryId: "mem-update-test",
          memorySpaceId: "test-space",
          userId: "test-user",
          content: "Initial...",
        };

        const nodeId = await graphSync.initializePartialNode(partialMemory);

        // Wait for sync interval to ensure update will happen
        await new Promise((resolve) => setTimeout(resolve, 1100));

        const context = {
          memorySpaceId: "test-space",
          conversationId: "conv-1",
          userId: "test-user",
          userName: "Test User",
          accumulatedText: "Updated content with more text",
          chunkCount: 5,
          estimatedTokens: 100,
          elapsedMs: 500,
          extractedFactIds: [],
          metrics: {} as any,
        };

        await graphSync.updatePartialNode("Updated content", context);

        const updatedNode = await adapter.getNode(nodeId);
        expect(updatedNode).not.toBeNull();
        // Check properties that were actually set
        expect(updatedNode!.properties.chunkCount).toBe(5);
        expect(updatedNode!.properties.estimatedTokens).toBe(100);
      });

      it("should respect sync interval", async () => {
        const partialMemory = {
          memoryId: "mem-interval-test",
          memorySpaceId: "test-space",
          userId: "test-user",
          content: "Test",
        };

        await graphSync.initializePartialNode(partialMemory);

        const context = {
          memorySpaceId: "test-space",
          conversationId: "conv-1",
          userId: "test-user",
          userName: "Test User",
          accumulatedText: "New content",
          chunkCount: 1,
          estimatedTokens: 10,
          elapsedMs: 100,
          extractedFactIds: [],
          metrics: {} as any,
        };

        // Wait for sync interval
        await new Promise((resolve) => setTimeout(resolve, 1100));

        // First update (should happen)
        await graphSync.updatePartialNode("Content 1", context);

        // Second update immediately after (should skip due to interval)
        await graphSync.updatePartialNode("Content 2", context);

        // Only one update event should be recorded (first update, not second)
        const events = graphSync
          .getSyncEvents()
          .filter((e) => e.eventType === "node-updated");
        expect(events.length).toBe(1);
      });

      it("should check shouldSync correctly", async () => {
        const partialMemory = {
          memoryId: "mem-sync-check",
          memorySpaceId: "test-space",
          userId: "test-user",
          content: "Test",
        };

        await graphSync.initializePartialNode(partialMemory);

        // Wait for sync interval to pass
        await new Promise((resolve) => setTimeout(resolve, 1100));

        expect(graphSync.shouldSync()).toBe(true);
      });
    });

    describe("Finalization", () => {
      it("should finalize memory node", async () => {
        const partialMemory = {
          memoryId: "mem-finalize-test",
          memorySpaceId: "test-space",
          userId: "test-user",
          content: "Partial...",
        };

        const nodeId = await graphSync.initializePartialNode(partialMemory);

        const completeMemory: MemoryEntry = {
          _id: "doc-id" as any,
          memoryId: "mem-finalize-test",
          memorySpaceId: "test-space",
          content: "Complete content from stream",
          contentType: "raw",
          sourceType: "conversation",
          sourceTimestamp: Date.now(),
          userId: "test-user",
          importance: 80,
          tags: ["final"],
          version: 1,
          previousVersions: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          accessCount: 0,
        };

        await graphSync.finalizeNode(completeMemory);

        const finalNode = await adapter.getNode(nodeId);
        expect(finalNode!.properties.isPartial).toBe(false);
        expect(finalNode!.properties.isStreaming).toBe(false);
        expect(finalNode!.properties.importance).toBe(80);
        expect(finalNode!.properties.tags).toContain("final");
      });

      it("should record finalization event", async () => {
        const partialMemory = {
          memoryId: "mem-event-test",
          memorySpaceId: "test-space",
          userId: "test-user",
          content: "Test",
        };

        await graphSync.initializePartialNode(partialMemory);

        const completeMemory: MemoryEntry = {
          _id: "doc-id" as any,
          memoryId: "mem-event-test",
          memorySpaceId: "test-space",
          content: "Final",
          contentType: "raw",
          sourceType: "conversation",
          sourceTimestamp: Date.now(),
          userId: "test-user",
          importance: 50,
          tags: [],
          version: 1,
          previousVersions: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          accessCount: 0,
        };

        await graphSync.finalizeNode(completeMemory);

        const events = graphSync.getSyncEvents();
        const finalizeEvent = events.find((e) => e.eventType === "finalized");
        expect(finalizeEvent).toBeDefined();
      });
    });

    describe("Error Handling", () => {
      it("should handle finalization without initialization", async () => {
        const newSync = new ProgressiveGraphSync(adapter);

        const completeMemory: MemoryEntry = {
          _id: "doc-id" as any,
          memoryId: "mem-no-init",
          memorySpaceId: "test-space",
          content: "Content",
          contentType: "raw",
          sourceType: "conversation",
          sourceTimestamp: Date.now(),
          importance: 50,
          tags: [],
          version: 1,
          previousVersions: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          accessCount: 0,
        };

        // Should not throw
        await expect(
          newSync.finalizeNode(completeMemory),
        ).resolves.not.toThrow();
      });

      it("should rollback on failure", async () => {
        const partialMemory = {
          memoryId: "mem-rollback-test",
          memorySpaceId: "test-space",
          userId: "test-user",
          content: "Test",
        };

        const nodeId = await graphSync.initializePartialNode(partialMemory);

        await graphSync.rollback();

        // Node should be deleted
        const deletedNode = await adapter.getNode(nodeId);
        expect(deletedNode).toBeNull();
        expect(graphSync.getPartialNodeId()).toBeNull();
      });
    });

    describe("Sync Events", () => {
      it("should track all sync events", async () => {
        const partialMemory = {
          memoryId: "mem-events-test",
          memorySpaceId: "test-space",
          userId: "test-user",
          content: "Test",
        };

        await graphSync.initializePartialNode(partialMemory);

        const context = {
          memorySpaceId: "test-space",
          conversationId: "conv-1",
          userId: "test-user",
          userName: "Test User",
          accumulatedText: "Updated",
          chunkCount: 1,
          estimatedTokens: 10,
          elapsedMs: 100,
          extractedFactIds: [],
          metrics: {} as any,
        };

        // Wait for interval
        await new Promise((resolve) => setTimeout(resolve, 1100));
        await graphSync.updatePartialNode("Updated", context);

        const completeMemory: MemoryEntry = {
          _id: "doc-id" as any,
          memoryId: "mem-events-test",
          memorySpaceId: "test-space",
          content: "Final",
          contentType: "raw",
          sourceType: "conversation",
          sourceTimestamp: Date.now(),
          importance: 50,
          tags: [],
          version: 1,
          previousVersions: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          accessCount: 0,
        };

        await graphSync.finalizeNode(completeMemory);

        const events = graphSync.getSyncEvents();
        expect(events.length).toBeGreaterThanOrEqual(3); // created, updated, finalized

        const eventTypes = events.map((e) => e.eventType);
        expect(eventTypes).toContain("node-created");
        expect(eventTypes).toContain("node-updated");
        expect(eventTypes).toContain("finalized");
      });
    });

    describe("State Management", () => {
      it("should reset state correctly", async () => {
        const partialMemory = {
          memoryId: "mem-reset-test",
          memorySpaceId: "test-space",
          userId: "test-user",
          content: "Test",
        };

        await graphSync.initializePartialNode(partialMemory);
        expect(graphSync.getPartialNodeId()).not.toBeNull();
        expect(graphSync.getSyncEvents().length).toBeGreaterThan(0);

        graphSync.reset();

        expect(graphSync.getPartialNodeId()).toBeNull();
        expect(graphSync.getSyncEvents().length).toBe(0);
        expect(graphSync.shouldSync()).toBe(false);
      });
    });
  });
});

// Run the same tests for Memgraph
describeIfEnabled("ProgressiveGraphSync (Memgraph)", () => {
  let adapter: GraphAdapter;
  let graphSync: ProgressiveGraphSync;

  beforeAll(async () => {
    adapter = new CypherGraphAdapter();
    await adapter.connect(MEMGRAPH_CONFIG);
    await adapter.clearDatabase();
  });

  afterAll(async () => {
    await adapter.clearDatabase();
    await adapter.disconnect();
  });

  beforeEach(async () => {
    await adapter.clearDatabase();
    graphSync = new ProgressiveGraphSync(adapter, 1000);
  });

  describe("Memgraph-specific tests", () => {
    it("should work with Memgraph backend", async () => {
      const partialMemory = {
        memoryId: "mem-memgraph-test",
        memorySpaceId: "test-space",
        userId: "test-user",
        content: "Memgraph test",
      };

      const nodeId = await graphSync.initializePartialNode(partialMemory);
      expect(nodeId).toBeDefined();

      const node = await adapter.getNode(nodeId);
      expect(node).not.toBeNull();
      expect(node!.label).toBe("Memory");
    });

    it("should handle full lifecycle on Memgraph", async () => {
      const partialMemory = {
        memoryId: "mem-lifecycle",
        memorySpaceId: "test-space",
        userId: "test-user",
        content: "Initial",
      };

      // Initialize
      const nodeId = await graphSync.initializePartialNode(partialMemory);

      // Update
      const context = {
        memorySpaceId: "test-space",
        conversationId: "conv-1",
        userId: "test-user",
        userName: "Test User",
        accumulatedText: "Updated content",
        chunkCount: 3,
        estimatedTokens: 50,
        elapsedMs: 300,
        extractedFactIds: [],
        metrics: {} as any,
      };

      await new Promise((resolve) => setTimeout(resolve, 1100));
      await graphSync.updatePartialNode("Updated", context);

      // Finalize
      const completeMemory: MemoryEntry = {
        _id: "doc-id" as any,
        memoryId: "mem-lifecycle",
        memorySpaceId: "test-space",
        content: "Final content",
        contentType: "raw",
        sourceType: "conversation",
        sourceTimestamp: Date.now(),
        importance: 75,
        tags: ["complete"],
        version: 1,
        previousVersions: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        accessCount: 0,
      };

      await graphSync.finalizeNode(completeMemory);

      // Verify final state
      const finalNode = await adapter.getNode(nodeId);
      expect(finalNode!.properties.isPartial).toBe(false);
      expect(finalNode!.properties.isStreaming).toBe(false);
      expect(finalNode!.properties.importance).toBe(75);

      // Verify all events recorded
      const events = graphSync.getSyncEvents();
      expect(events.length).toBeGreaterThanOrEqual(3);
    });
  });
});

// If graph testing is not enabled, show helpful message
if (!GRAPH_TESTING_ENABLED) {
  describe("Progressive Graph Sync", () => {
    it("should skip tests when graph databases not configured", () => {
      console.log("\n⚠️  Graph database tests skipped");
      console.log(
        "   To enable, set GRAPH_TESTING_ENABLED=true and configure:",
      );
      console.log("   - NEO4J_URI and credentials");
      console.log("   - MEMGRAPH_URI and credentials\n");
      expect(true).toBe(true);
    });
  });
}
