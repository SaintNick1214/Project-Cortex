/**
 * Unit Tests: Graph Enhancement for recall() Orchestration
 *
 * Tests entity extraction and graph expansion utilities.
 */

import { describe, it, expect, jest } from "@jest/globals";
import {
  extractEntitiesFromResults,
  expandViaGraph,
  type GraphExpansionConfig,
} from "../../../../src/memory/recall/graphEnhancement";
import type { FactRecord, MemoryEntry } from "../../../../src/types";
import type { GraphAdapter } from "../../../../src/graph/types";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Test Fixtures
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function createMockMemory(overrides: Partial<MemoryEntry> = {}): MemoryEntry {
  return {
    _id: "internal-id",
    memoryId: "mem-1",
    memorySpaceId: "space-1",
    content: "User prefers dark mode",
    contentType: "raw",
    sourceType: "conversation",
    sourceTimestamp: Date.now(),
    importance: 75,
    tags: ["preference"],
    version: 1,
    previousVersions: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    accessCount: 1,
    ...overrides,
  };
}

function createMockFact(overrides: Partial<FactRecord> = {}): FactRecord {
  return {
    _id: "internal-id",
    factId: "fact-1",
    memorySpaceId: "space-1",
    fact: "User prefers dark mode",
    factType: "preference",
    subject: "user-123",
    predicate: "prefers",
    object: "dark mode",
    confidence: 90,
    sourceType: "conversation",
    tags: ["ui"],
    version: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

function createMockGraphAdapter(
  overrides: Partial<GraphAdapter> = {}
): GraphAdapter {
  return {
    connect: jest.fn<GraphAdapter["connect"]>(),
    disconnect: jest.fn<GraphAdapter["disconnect"]>(),
    isConnected: jest.fn<GraphAdapter["isConnected"]>().mockResolvedValue(true),
    createNode: jest.fn<GraphAdapter["createNode"]>(),
    mergeNode: jest.fn<GraphAdapter["mergeNode"]>(),
    getNode: jest.fn<GraphAdapter["getNode"]>(),
    updateNode: jest.fn<GraphAdapter["updateNode"]>(),
    deleteNode: jest.fn<GraphAdapter["deleteNode"]>(),
    findNodes: jest.fn<GraphAdapter["findNodes"]>().mockResolvedValue([]),
    createEdge: jest.fn<GraphAdapter["createEdge"]>(),
    deleteEdge: jest.fn<GraphAdapter["deleteEdge"]>(),
    findEdges: jest.fn<GraphAdapter["findEdges"]>(),
    query: jest.fn<GraphAdapter["query"]>(),
    traverse: jest.fn<GraphAdapter["traverse"]>().mockResolvedValue([]),
    findPath: jest.fn<GraphAdapter["findPath"]>(),
    batchWrite: jest.fn<GraphAdapter["batchWrite"]>(),
    countNodes: jest.fn<GraphAdapter["countNodes"]>(),
    countEdges: jest.fn<GraphAdapter["countEdges"]>(),
    clearDatabase: jest.fn<GraphAdapter["clearDatabase"]>(),
    ...overrides,
  } as GraphAdapter;
}

describe("Graph Enhancement", () => {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // extractEntitiesFromResults Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("extractEntitiesFromResults", () => {
    it("extracts entities from fact subjects", () => {
      const facts = [
        createMockFact({ subject: "Alice" }),
        createMockFact({ subject: "Bob", factId: "fact-2" }),
      ];

      const entities = extractEntitiesFromResults([], facts);

      expect(entities).toContain("Alice");
      expect(entities).toContain("Bob");
    });

    it("extracts entities from fact objects", () => {
      const facts = [
        createMockFact({ subject: "Alice", object: "Acme Corp" }),
      ];

      const entities = extractEntitiesFromResults([], facts);

      expect(entities).toContain("Alice");
      expect(entities).toContain("Acme Corp");
    });

    it("extracts userId from memories as entity", () => {
      const memories = [
        createMockMemory({ userId: "user-123" }),
        createMockMemory({ userId: "user-456", memoryId: "mem-2" }),
      ];

      const entities = extractEntitiesFromResults(memories, []);

      expect(entities).toContain("user-123");
      expect(entities).toContain("user-456");
    });

    it("extracts enriched entities from facts", () => {
      const facts = [
        createMockFact({
          entities: [
            { name: "Alice", type: "person" },
            { name: "Acme Corp", type: "organization" },
          ],
        }),
      ];

      const entities = extractEntitiesFromResults([], facts);

      expect(entities).toContain("Alice");
      expect(entities).toContain("Acme Corp");
    });

    it("deduplicates entities", () => {
      const facts = [
        createMockFact({ subject: "Alice", object: "Acme Corp" }),
        createMockFact({ subject: "Alice", object: "Project X", factId: "fact-2" }),
      ];

      const entities = extractEntitiesFromResults([], facts);

      // Alice should only appear once
      const aliceCount = entities.filter((e) => e === "Alice").length;
      expect(aliceCount).toBe(1);
    });

    it("filters out empty or whitespace-only entities", () => {
      const facts = [
        createMockFact({ subject: "", object: "   " }),
        createMockFact({ subject: "Alice", factId: "fact-2" }),
      ];

      const entities = extractEntitiesFromResults([], facts);

      expect(entities).toContain("Alice");
      expect(entities).not.toContain("");
      expect(entities).not.toContain("   ");
    });

    it("filters out excessively long entity names", () => {
      const longName = "A".repeat(150); // > 100 chars
      const facts = [
        createMockFact({ subject: longName }),
        createMockFact({ subject: "Alice", factId: "fact-2" }),
      ];

      const entities = extractEntitiesFromResults([], facts);

      expect(entities).toContain("Alice");
      expect(entities).not.toContain(longName);
    });

    it("returns empty array for no inputs", () => {
      const entities = extractEntitiesFromResults([], []);

      expect(entities).toHaveLength(0);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // expandViaGraph Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("expandViaGraph", () => {
    const defaultConfig: GraphExpansionConfig = {
      maxDepth: 2,
      relationshipTypes: [],
      expandFromFacts: true,
      expandFromMemories: true,
    };

    it("returns empty array when no graph adapter provided", async () => {
      const entities = await expandViaGraph(
        ["Alice", "Bob"],
        undefined as unknown as GraphAdapter,
        defaultConfig
      );

      expect(entities).toHaveLength(0);
    });

    it("returns empty array when initial entities is empty", async () => {
      const mockAdapter = createMockGraphAdapter();

      const entities = await expandViaGraph([], mockAdapter, defaultConfig);

      expect(entities).toHaveLength(0);
      expect(mockAdapter.findNodes).not.toHaveBeenCalled();
    });

    it("returns empty when graph is not connected", async () => {
      const mockAdapter = createMockGraphAdapter({
        isConnected: jest.fn<GraphAdapter["isConnected"]>().mockResolvedValue(false),
      });

      const entities = await expandViaGraph(["Alice"], mockAdapter, defaultConfig);

      expect(entities).toHaveLength(0);
    });

    it("finds entity nodes and traverses graph", async () => {
      const mockAdapter = createMockGraphAdapter({
        findNodes: jest.fn<GraphAdapter["findNodes"]>().mockResolvedValue([
          { label: "Entity", id: "node-1", properties: { name: "Alice" } },
        ]),
        traverse: jest.fn<GraphAdapter["traverse"]>().mockResolvedValue([
          { label: "Entity", id: "node-2", properties: { name: "Bob" } },
          { label: "Entity", id: "node-3", properties: { name: "Carol" } },
        ]),
      });

      const entities = await expandViaGraph(["Alice"], mockAdapter, defaultConfig);

      expect(mockAdapter.findNodes).toHaveBeenCalledWith(
        "Entity",
        { name: "Alice" },
        1
      );
      expect(mockAdapter.traverse).toHaveBeenCalled();
      expect(entities).toContain("Bob");
      expect(entities).toContain("Carol");
    });

    it("removes initial entities from discovered entities", async () => {
      const mockAdapter = createMockGraphAdapter({
        findNodes: jest.fn<GraphAdapter["findNodes"]>().mockResolvedValue([
          { label: "Entity", id: "node-1", properties: { name: "Alice" } },
        ]),
        traverse: jest.fn<GraphAdapter["traverse"]>().mockResolvedValue([
          { label: "Entity", id: "node-1", properties: { name: "Alice" } }, // Same as initial
          { label: "Entity", id: "node-2", properties: { name: "Bob" } },
        ]),
      });

      const entities = await expandViaGraph(["Alice"], mockAdapter, defaultConfig);

      // Alice should be removed since it was in initial entities
      expect(entities).not.toContain("Alice");
      expect(entities).toContain("Bob");
    });

    it("respects maxDepth configuration", async () => {
      const mockAdapter = createMockGraphAdapter({
        findNodes: jest.fn<GraphAdapter["findNodes"]>().mockResolvedValue([
          { label: "Entity", id: "node-1", properties: { name: "Alice" } },
        ]),
        traverse: jest.fn<GraphAdapter["traverse"]>().mockResolvedValue([]),
      });

      const config: GraphExpansionConfig = {
        ...defaultConfig,
        maxDepth: 3,
      };

      await expandViaGraph(["Alice"], mockAdapter, config);

      expect(mockAdapter.traverse).toHaveBeenCalledWith(
        expect.objectContaining({ maxDepth: 3 })
      );
    });

    it("respects relationshipTypes filter", async () => {
      const mockAdapter = createMockGraphAdapter({
        findNodes: jest.fn<GraphAdapter["findNodes"]>().mockResolvedValue([
          { label: "Entity", id: "node-1", properties: { name: "Alice" } },
        ]),
        traverse: jest.fn<GraphAdapter["traverse"]>().mockResolvedValue([]),
      });

      const config: GraphExpansionConfig = {
        ...defaultConfig,
        relationshipTypes: ["WORKS_AT", "KNOWS"],
      };

      await expandViaGraph(["Alice"], mockAdapter, config);

      expect(mockAdapter.traverse).toHaveBeenCalledWith(
        expect.objectContaining({
          relationshipTypes: ["WORKS_AT", "KNOWS"],
        })
      );
    });

    it("limits initial entities to prevent performance issues", async () => {
      const mockAdapter = createMockGraphAdapter({
        findNodes: jest.fn<GraphAdapter["findNodes"]>().mockResolvedValue([
          { label: "Entity", id: "node-1", properties: { name: "Entity1" } },
        ]),
        traverse: jest.fn<GraphAdapter["traverse"]>().mockResolvedValue([]),
      });

      // Create 20 initial entities (more than the limit of 10)
      const manyEntities = Array.from({ length: 20 }, (_, i) => `Entity${i}`);

      await expandViaGraph(manyEntities, mockAdapter, defaultConfig);

      // Should only process first 10
      expect(mockAdapter.findNodes).toHaveBeenCalledTimes(10);
    });

    it("handles graph errors gracefully", async () => {
      const mockAdapter = createMockGraphAdapter({
        isConnected: jest.fn<GraphAdapter["isConnected"]>().mockRejectedValue(
          new Error("Connection failed")
        ),
      });

      // Should not throw, just return empty
      const entities = await expandViaGraph(["Alice"], mockAdapter, defaultConfig);

      expect(entities).toHaveLength(0);
    });

    it("continues when individual entity lookup fails", async () => {
      let callCount = 0;
      const mockAdapter = createMockGraphAdapter({
        findNodes: jest.fn<GraphAdapter["findNodes"]>().mockImplementation(async () => {
          callCount++;
          if (callCount === 1) {
            throw new Error("First entity failed");
          }
          return [{ label: "Entity", id: "node-2", properties: { name: "Bob" } }];
        }),
        traverse: jest.fn<GraphAdapter["traverse"]>().mockResolvedValue([
          { label: "Entity", id: "node-3", properties: { name: "Carol" } },
        ]),
      });

      const entities = await expandViaGraph(["Alice", "Bob"], mockAdapter, defaultConfig);

      // Should still find Carol via Bob even though Alice lookup failed
      expect(entities).toContain("Carol");
    });

    it("only extracts entities from Entity-labeled nodes", async () => {
      const mockAdapter = createMockGraphAdapter({
        findNodes: jest.fn<GraphAdapter["findNodes"]>().mockResolvedValue([
          { label: "Entity", id: "node-1", properties: { name: "Alice" } },
        ]),
        traverse: jest.fn<GraphAdapter["traverse"]>().mockResolvedValue([
          { label: "Entity", id: "node-2", properties: { name: "Bob" } },
          { label: "Memory", id: "node-3", properties: { name: "SomeMemory" } }, // Not an Entity
          { label: "Fact", id: "node-4", properties: { name: "SomeFact" } }, // Not an Entity
        ]),
      });

      const entities = await expandViaGraph(["Alice"], mockAdapter, defaultConfig);

      expect(entities).toContain("Bob");
      expect(entities).not.toContain("SomeMemory");
      expect(entities).not.toContain("SomeFact");
    });
  });
});
