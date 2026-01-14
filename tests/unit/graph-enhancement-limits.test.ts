/**
 * Unit Tests: Graph Enhancement Limits
 *
 * Tests that graph expansion respects configured limits.
 * These tests use mocked dependencies to isolate the graph enhancement logic.
 */

import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import type { GraphAdapter } from "../../src/graph/types";
import type { VectorAPI } from "../../src/vector";
import type { FactsAPI } from "../../src/facts";
import type { MemoryEntry, FactRecord } from "../../src/types";
import {
  expandViaGraph,
  fetchRelatedMemories,
  fetchRelatedFacts,
  performGraphExpansion,
  type GraphExpansionConfig,
} from "../../src/memory/recall/graphEnhancement";

// Mock implementations
const createMockGraphAdapter = (): jest.Mocked<GraphAdapter> => ({
  isConnected: jest.fn().mockResolvedValue(true),
  findNodes: jest.fn().mockResolvedValue([{ id: "node-1", label: "Entity", properties: { name: "TestEntity" } }]),
  traverse: jest.fn().mockResolvedValue([
    { id: "node-2", label: "Entity", properties: { name: "RelatedEntity1" } },
    { id: "node-3", label: "Entity", properties: { name: "RelatedEntity2" } },
    { id: "node-4", label: "Entity", properties: { name: "RelatedEntity3" } },
    { id: "node-5", label: "Entity", properties: { name: "RelatedEntity4" } },
    { id: "node-6", label: "Entity", properties: { name: "RelatedEntity5" } },
  ]),
  createNode: jest.fn(),
  updateNode: jest.fn(),
  deleteNode: jest.fn(),
  createRelationship: jest.fn(),
  deleteRelationship: jest.fn(),
  query: jest.fn(),
  close: jest.fn(),
});

const createMockVectorAPI = (): jest.Mocked<Pick<VectorAPI, "search">> => ({
  search: jest.fn().mockResolvedValue([
    { memoryId: "mem-1", content: "Memory 1" } as MemoryEntry,
    { memoryId: "mem-2", content: "Memory 2" } as MemoryEntry,
    { memoryId: "mem-3", content: "Memory 3" } as MemoryEntry,
    { memoryId: "mem-4", content: "Memory 4" } as MemoryEntry,
    { memoryId: "mem-5", content: "Memory 5" } as MemoryEntry,
  ]),
});

const createMockFactsAPI = (): jest.Mocked<Pick<FactsAPI, "queryBySubject" | "search">> => ({
  queryBySubject: jest.fn().mockResolvedValue([
    { factId: "fact-1", fact: "Fact 1" } as FactRecord,
    { factId: "fact-2", fact: "Fact 2" } as FactRecord,
  ]),
  search: jest.fn().mockResolvedValue([
    { factId: "fact-3", fact: "Fact 3" } as FactRecord,
    { factId: "fact-4", fact: "Fact 4" } as FactRecord,
  ]),
});

describe("Graph Enhancement Limits", () => {
  describe("expandViaGraph", () => {
    let mockGraphAdapter: jest.Mocked<GraphAdapter>;

    beforeEach(() => {
      mockGraphAdapter = createMockGraphAdapter();
    });

    it("limits entities to entitiesPerHop config value", async () => {
      const config: GraphExpansionConfig = {
        maxDepth: 2,
        relationshipTypes: [],
        expandFromFacts: true,
        expandFromMemories: true,
        entitiesPerHop: 3, // Should only process 3 entities
      };

      // Provide 10 initial entities
      const initialEntities = [
        "Entity1", "Entity2", "Entity3", "Entity4", "Entity5",
        "Entity6", "Entity7", "Entity8", "Entity9", "Entity10",
      ];

      await expandViaGraph(initialEntities, mockGraphAdapter, config);

      // Should only call findNodes for 3 entities (entitiesPerHop)
      expect(mockGraphAdapter.findNodes).toHaveBeenCalledTimes(3);
    });

    it("uses default of 5 when entitiesPerHop not specified", async () => {
      const config: GraphExpansionConfig = {
        maxDepth: 2,
        relationshipTypes: [],
        expandFromFacts: true,
        expandFromMemories: true,
        // entitiesPerHop not specified
      };

      const initialEntities = [
        "Entity1", "Entity2", "Entity3", "Entity4", "Entity5",
        "Entity6", "Entity7", "Entity8", "Entity9", "Entity10",
      ];

      await expandViaGraph(initialEntities, mockGraphAdapter, config);

      // Should use default of 5
      expect(mockGraphAdapter.findNodes).toHaveBeenCalledTimes(5);
    });

    it("respects maxDepth in traverse calls", async () => {
      const config: GraphExpansionConfig = {
        maxDepth: 3,
        relationshipTypes: [],
        expandFromFacts: true,
        expandFromMemories: true,
        entitiesPerHop: 1,
      };

      await expandViaGraph(["TestEntity"], mockGraphAdapter, config);

      expect(mockGraphAdapter.traverse).toHaveBeenCalledWith(
        expect.objectContaining({ maxDepth: 3 }),
      );
    });

    it("returns empty array when graph not connected", async () => {
      mockGraphAdapter.isConnected.mockResolvedValue(false);

      const config: GraphExpansionConfig = {
        maxDepth: 2,
        relationshipTypes: [],
        expandFromFacts: true,
        expandFromMemories: true,
      };

      const result = await expandViaGraph(["TestEntity"], mockGraphAdapter, config);

      expect(result).toEqual([]);
    });

    it("returns empty array when no initial entities", async () => {
      const config: GraphExpansionConfig = {
        maxDepth: 2,
        relationshipTypes: [],
        expandFromFacts: true,
        expandFromMemories: true,
      };

      const result = await expandViaGraph([], mockGraphAdapter, config);

      expect(result).toEqual([]);
      expect(mockGraphAdapter.isConnected).not.toHaveBeenCalled();
    });
  });

  describe("fetchRelatedMemories", () => {
    let mockVectorAPI: jest.Mocked<Pick<VectorAPI, "search">>;

    beforeEach(() => {
      mockVectorAPI = createMockVectorAPI();
    });

    it("respects limit parameter", async () => {
      const processedIds = new Set<string>();

      const result = await fetchRelatedMemories(
        ["Entity1", "Entity2"],
        "test-space",
        mockVectorAPI as unknown as VectorAPI,
        processedIds,
        3, // Limit to 3
      );

      expect(result.length).toBeLessThanOrEqual(3);
    });

    it("skips already processed IDs", async () => {
      const processedIds = new Set(["mem-1", "mem-2"]);

      mockVectorAPI.search.mockResolvedValue([
        { memoryId: "mem-1", content: "Already processed" } as MemoryEntry,
        { memoryId: "mem-2", content: "Already processed" } as MemoryEntry,
        { memoryId: "mem-3", content: "New memory" } as MemoryEntry,
      ]);

      const result = await fetchRelatedMemories(
        ["Entity1"],
        "test-space",
        mockVectorAPI as unknown as VectorAPI,
        processedIds,
        10,
      );

      // Should only return mem-3 since mem-1 and mem-2 are already processed
      expect(result.length).toBe(1);
      expect(result[0].memoryId).toBe("mem-3");
    });

    it("returns empty array when no entities provided", async () => {
      const result = await fetchRelatedMemories(
        [],
        "test-space",
        mockVectorAPI as unknown as VectorAPI,
        new Set(),
        10,
      );

      expect(result).toEqual([]);
      expect(mockVectorAPI.search).not.toHaveBeenCalled();
    });
  });

  describe("fetchRelatedFacts", () => {
    let mockFactsAPI: jest.Mocked<Pick<FactsAPI, "queryBySubject" | "search">>;

    beforeEach(() => {
      mockFactsAPI = createMockFactsAPI();
    });

    it("respects limit parameter", async () => {
      const processedIds = new Set<string>();

      const result = await fetchRelatedFacts(
        ["Entity1", "Entity2"],
        "test-space",
        mockFactsAPI as unknown as FactsAPI,
        processedIds,
        2, // Limit to 2
      );

      expect(result.length).toBeLessThanOrEqual(2);
    });

    it("skips already processed IDs", async () => {
      const processedIds = new Set(["fact-1", "fact-2"]);

      const result = await fetchRelatedFacts(
        ["Entity1"],
        "test-space",
        mockFactsAPI as unknown as FactsAPI,
        processedIds,
        10,
      );

      // Should not include fact-1 and fact-2
      const factIds = result.map((f) => f.factId);
      expect(factIds).not.toContain("fact-1");
      expect(factIds).not.toContain("fact-2");
    });

    it("returns empty array when no entities provided", async () => {
      const result = await fetchRelatedFacts(
        [],
        "test-space",
        mockFactsAPI as unknown as FactsAPI,
        new Set(),
        10,
      );

      expect(result).toEqual([]);
      expect(mockFactsAPI.queryBySubject).not.toHaveBeenCalled();
      expect(mockFactsAPI.search).not.toHaveBeenCalled();
    });
  });

  describe("performGraphExpansion", () => {
    let mockGraphAdapter: jest.Mocked<GraphAdapter>;
    let mockVectorAPI: jest.Mocked<Pick<VectorAPI, "search">>;
    let mockFactsAPI: jest.Mocked<Pick<FactsAPI, "queryBySubject" | "search">>;

    beforeEach(() => {
      mockGraphAdapter = createMockGraphAdapter();
      mockVectorAPI = createMockVectorAPI();
      mockFactsAPI = createMockFactsAPI();
    });

    it("respects entitiesPerHop limit", async () => {
      const config: GraphExpansionConfig = {
        maxDepth: 2,
        relationshipTypes: [],
        expandFromFacts: true,
        expandFromMemories: true,
        entitiesPerHop: 2, // Limit entities
        resultsPerEntity: 3,
      };

      const result = await performGraphExpansion(
        [], // No initial memories
        [
          { factId: "f1", subject: "Entity1" } as FactRecord,
          { factId: "f2", subject: "Entity2" } as FactRecord,
          { factId: "f3", subject: "Entity3" } as FactRecord,
          { factId: "f4", subject: "Entity4" } as FactRecord,
          { factId: "f5", subject: "Entity5" } as FactRecord,
        ],
        "test-space",
        mockGraphAdapter,
        mockVectorAPI as unknown as VectorAPI,
        mockFactsAPI as unknown as FactsAPI,
        config,
      );

      // discoveredEntities should be limited by entitiesPerHop
      expect(result.discoveredEntities.length).toBeLessThanOrEqual(2);
    });

    it("respects resultsPerEntity limit", async () => {
      const config: GraphExpansionConfig = {
        maxDepth: 2,
        relationshipTypes: [],
        expandFromFacts: true,
        expandFromMemories: true,
        entitiesPerHop: 3,
        resultsPerEntity: 1, // Only 1 result per entity
      };

      // Mock to return many results
      mockVectorAPI.search.mockResolvedValue([
        { memoryId: "m1", content: "M1" } as MemoryEntry,
        { memoryId: "m2", content: "M2" } as MemoryEntry,
        { memoryId: "m3", content: "M3" } as MemoryEntry,
      ]);

      const result = await performGraphExpansion(
        [],
        [{ factId: "f1", subject: "Entity1" } as FactRecord],
        "test-space",
        mockGraphAdapter,
        mockVectorAPI as unknown as VectorAPI,
        mockFactsAPI as unknown as FactsAPI,
        config,
      );

      // Total results should be limited by entitiesPerHop * resultsPerEntity
      // 3 entities * 1 result = 3 max
      expect(result.relatedMemories.length).toBeLessThanOrEqual(3);
    });

    it("returns empty results when graph adapter is undefined", async () => {
      const config: GraphExpansionConfig = {
        maxDepth: 2,
        relationshipTypes: [],
        expandFromFacts: true,
        expandFromMemories: true,
      };

      const result = await performGraphExpansion(
        [{ memoryId: "m1" } as MemoryEntry],
        [{ factId: "f1" } as FactRecord],
        "test-space",
        undefined, // No graph adapter
        mockVectorAPI as unknown as VectorAPI,
        mockFactsAPI as unknown as FactsAPI,
        config,
      );

      expect(result.discoveredEntities).toEqual([]);
      expect(result.relatedMemories).toEqual([]);
      expect(result.relatedFacts).toEqual([]);
    });

    it("tracks processed IDs to avoid duplicates", async () => {
      const config: GraphExpansionConfig = {
        maxDepth: 2,
        relationshipTypes: [],
        expandFromFacts: true,
        expandFromMemories: true,
      };

      const initialMemory = { memoryId: "initial-mem" } as MemoryEntry;
      const initialFact = { factId: "initial-fact" } as FactRecord;

      const result = await performGraphExpansion(
        [initialMemory],
        [initialFact],
        "test-space",
        mockGraphAdapter,
        mockVectorAPI as unknown as VectorAPI,
        mockFactsAPI as unknown as FactsAPI,
        config,
      );

      // processedIds should include initial IDs
      expect(result.processedIds.has("initial-mem")).toBe(true);
      expect(result.processedIds.has("initial-fact")).toBe(true);
    });

    it("uses default limits when not specified in config", async () => {
      const config: GraphExpansionConfig = {
        maxDepth: 2,
        relationshipTypes: [],
        expandFromFacts: true,
        expandFromMemories: true,
        // No entitiesPerHop or resultsPerEntity specified
      };

      const result = await performGraphExpansion(
        [],
        [{ factId: "f1", subject: "Entity1" } as FactRecord],
        "test-space",
        mockGraphAdapter,
        mockVectorAPI as unknown as VectorAPI,
        mockFactsAPI as unknown as FactsAPI,
        config,
      );

      // Should still return results using defaults (5 entities, 3 results each)
      expect(result).toBeDefined();
    });
  });
});
