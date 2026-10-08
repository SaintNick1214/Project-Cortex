/**
 * Unit Tests: Result Processor for recall() Orchestration
 *
 * Tests the merge, deduplicate, rank, and format functions.
 */

import { describe, it, expect } from "@jest/globals";
import {
  memoryToRecallItem,
  factToRecallItem,
  mergeResults,
  deduplicateResults,
  rankResults,
  formatForLLM,
  processRecallResults,
  RANKING_WEIGHTS,
} from "../../../../src/memory/recall/resultProcessor";
import type {
  FactRecord,
  MemoryEntry,
  RecallItem,
} from "../../../../src/types";

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
    messageRole: "user",
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

describe("Result Processor", () => {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // memoryToRecallItem Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("memoryToRecallItem", () => {
    it("converts memory to RecallItem with correct fields", () => {
      const memory = createMockMemory();
      const item = memoryToRecallItem(memory, "vector", 0.8);

      expect(item.type).toBe("memory");
      expect(item.id).toBe("mem-1");
      expect(item.content).toBe("User prefers dark mode");
      expect(item.score).toBe(0.8);
      expect(item.source).toBe("vector");
      expect(item.memory).toBe(memory);
      expect(item.fact).toBeUndefined();
    });

    it("uses default score of 0.5 when not provided", () => {
      const memory = createMockMemory();
      const item = memoryToRecallItem(memory, "graph-expanded");

      expect(item.score).toBe(0.5);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // factToRecallItem Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("factToRecallItem", () => {
    it("converts fact to RecallItem with correct fields", () => {
      const fact = createMockFact();
      const item = factToRecallItem(fact, "facts", 0.9);

      expect(item.type).toBe("fact");
      expect(item.id).toBe("fact-1");
      expect(item.content).toBe("User prefers dark mode");
      expect(item.score).toBe(0.9);
      expect(item.source).toBe("facts");
      expect(item.fact).toBe(fact);
      expect(item.memory).toBeUndefined();
    });

    it("includes subject and object in graphContext", () => {
      const fact = createMockFact({
        subject: "Alice",
        object: "Acme Corp",
      });
      const item = factToRecallItem(fact, "facts");

      expect(item.graphContext?.connectedEntities).toContain("Alice");
      expect(item.graphContext?.connectedEntities).toContain("Acme Corp");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // mergeResults Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("mergeResults", () => {
    it("merges results from all sources", () => {
      const vectorMemories = [createMockMemory({ memoryId: "v-mem-1" })];
      const directFacts = [createMockFact({ factId: "d-fact-1" })];
      const graphMemories = [createMockMemory({ memoryId: "g-mem-1" })];
      const graphFacts = [createMockFact({ factId: "g-fact-1" })];

      const merged = mergeResults(
        vectorMemories,
        directFacts,
        graphMemories,
        graphFacts,
        ["discovered-entity"],
      );

      expect(merged.length).toBe(4);

      // Check sources are correctly assigned
      const vectorItem = merged.find((i) => i.id === "v-mem-1");
      expect(vectorItem?.source).toBe("vector");

      const factsItem = merged.find((i) => i.id === "d-fact-1");
      expect(factsItem?.source).toBe("facts");

      const graphMemItem = merged.find((i) => i.id === "g-mem-1");
      expect(graphMemItem?.source).toBe("graph-expanded");

      const graphFactItem = merged.find((i) => i.id === "g-fact-1");
      expect(graphFactItem?.source).toBe("graph-expanded");
    });

    it("assigns higher base score to primary sources", () => {
      const vectorMemories = [createMockMemory({ memoryId: "v-mem-1" })];
      const graphMemories = [createMockMemory({ memoryId: "g-mem-1" })];

      const merged = mergeResults(vectorMemories, [], graphMemories, [], []);

      const vectorItem = merged.find((i) => i.id === "v-mem-1");
      const graphItem = merged.find((i) => i.id === "g-mem-1");

      expect(vectorItem?.score).toBe(0.7);
      expect(graphItem?.score).toBe(0.5);
    });

    it("adds discovered entities to graph-expanded items", () => {
      const graphMemories = [createMockMemory({ memoryId: "g-mem-1" })];
      const discoveredEntities = ["Alice", "Bob", "Acme Corp"];

      const merged = mergeResults(
        [],
        [],
        graphMemories,
        [],
        discoveredEntities,
      );

      const graphItem = merged.find((i) => i.id === "g-mem-1");
      expect(graphItem?.graphContext?.connectedEntities).toEqual(
        expect.arrayContaining(discoveredEntities),
      );
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // deduplicateResults Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("deduplicateResults", () => {
    it("removes duplicate items by ID", () => {
      const items: RecallItem[] = [
        memoryToRecallItem(createMockMemory({ memoryId: "mem-1" }), "vector"),
        memoryToRecallItem(
          createMockMemory({ memoryId: "mem-1" }),
          "graph-expanded",
        ),
        memoryToRecallItem(createMockMemory({ memoryId: "mem-2" }), "vector"),
      ];

      const deduped = deduplicateResults(items);

      expect(deduped.length).toBe(2);
      expect(deduped.map((i) => i.id)).toEqual(["mem-1", "mem-2"]);
    });

    it("keeps primary source over graph-expanded when merging duplicates", () => {
      const items: RecallItem[] = [
        memoryToRecallItem(createMockMemory({ memoryId: "mem-1" }), "vector"),
        memoryToRecallItem(
          createMockMemory({ memoryId: "mem-1" }),
          "graph-expanded",
        ),
      ];

      const deduped = deduplicateResults(items);

      expect(deduped.length).toBe(1);
      expect(deduped[0].source).toBe("vector");
    });

    it("merges graph context when deduplicating", () => {
      const vectorItem = memoryToRecallItem(
        createMockMemory({ memoryId: "mem-1" }),
        "vector",
      );
      vectorItem.graphContext = { connectedEntities: ["Alice"] };

      const graphItem = memoryToRecallItem(
        createMockMemory({ memoryId: "mem-1" }),
        "graph-expanded",
      );
      graphItem.graphContext = {
        connectedEntities: ["Bob", "Carol"],
        relationshipPath: "graph-traversal",
      };

      const deduped = deduplicateResults([vectorItem, graphItem]);

      expect(deduped.length).toBe(1);
      expect(deduped[0].graphContext?.connectedEntities).toEqual(
        expect.arrayContaining(["Alice", "Bob", "Carol"]),
      );
    });

    it("boosts score when item found in multiple sources", () => {
      const vectorItem = memoryToRecallItem(
        createMockMemory({ memoryId: "mem-1" }),
        "vector",
      );
      vectorItem.score = 0.7;

      const graphItem = memoryToRecallItem(
        createMockMemory({ memoryId: "mem-1" }),
        "graph-expanded",
      );

      const deduped = deduplicateResults([vectorItem, graphItem]);

      expect(deduped[0].score).toBeGreaterThan(0.7);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // rankResults Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("rankResults", () => {
    it("sorts items by score descending", () => {
      const items: RecallItem[] = [
        { ...memoryToRecallItem(createMockMemory(), "vector"), score: 0.3 },
        {
          ...memoryToRecallItem(
            createMockMemory({ memoryId: "mem-2" }),
            "vector",
          ),
          score: 0.9,
        },
        {
          ...memoryToRecallItem(
            createMockMemory({ memoryId: "mem-3" }),
            "vector",
          ),
          score: 0.6,
        },
      ];

      const ranked = rankResults(items);

      expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
      expect(ranked[1].score).toBeGreaterThan(ranked[2].score);
    });

    it("weighs high confidence facts higher", () => {
      const lowConfidence = factToRecallItem(
        createMockFact({ factId: "fact-low", confidence: 30 }),
        "facts",
      );
      const highConfidence = factToRecallItem(
        createMockFact({ factId: "fact-high", confidence: 95 }),
        "facts",
      );

      const ranked = rankResults([lowConfidence, highConfidence]);

      expect(ranked[0].id).toBe("fact-high");
    });

    it("weighs high importance memories higher", () => {
      const lowImportance = memoryToRecallItem(
        createMockMemory({ memoryId: "mem-low", importance: 10 }),
        "vector",
      );
      const highImportance = memoryToRecallItem(
        createMockMemory({ memoryId: "mem-high", importance: 95 }),
        "vector",
      );

      const ranked = rankResults([lowImportance, highImportance]);

      expect(ranked[0].id).toBe("mem-high");
    });

    it("boosts user messages", () => {
      const agentMemory = memoryToRecallItem(
        createMockMemory({
          memoryId: "mem-agent",
          messageRole: "agent",
          importance: 80,
        }),
        "vector",
      );
      const userMemory = memoryToRecallItem(
        createMockMemory({
          memoryId: "mem-user",
          messageRole: "user",
          importance: 80,
        }),
        "vector",
      );

      const ranked = rankResults([agentMemory, userMemory]);

      // User message should be boosted
      expect(ranked[0].id).toBe("mem-user");
    });

    it("boosts highly connected items", () => {
      const lowConnected = memoryToRecallItem(
        createMockMemory({ memoryId: "mem-low" }),
        "vector",
      );
      lowConnected.graphContext = { connectedEntities: ["Alice"] };

      const highConnected = memoryToRecallItem(
        createMockMemory({ memoryId: "mem-high" }),
        "vector",
      );
      highConnected.graphContext = {
        connectedEntities: ["Alice", "Bob", "Carol", "Dave", "Eve"],
      };

      const ranked = rankResults([lowConnected, highConnected]);

      expect(ranked[0].id).toBe("mem-high");
    });

    it("clamps scores to [0, 1]", () => {
      const item = memoryToRecallItem(createMockMemory(), "vector");
      item.score = 2.0; // Artificially high

      const ranked = rankResults([item]);

      expect(ranked[0].score).toBeLessThanOrEqual(1.0);
      expect(ranked[0].score).toBeGreaterThanOrEqual(0);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // formatForLLM Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("formatForLLM", () => {
    it("generates structured context with facts section", () => {
      const items: RecallItem[] = [
        factToRecallItem(
          createMockFact({ fact: "User prefers dark mode", confidence: 95 }),
          "facts",
        ),
      ];

      const context = formatForLLM(items);

      expect(context).toContain("## Relevant Context");
      expect(context).toContain("### Known Facts");
      expect(context).toContain("User prefers dark mode");
      expect(context).toContain("confidence: 95%");
    });

    it("generates structured context with conversation section", () => {
      const items: RecallItem[] = [
        memoryToRecallItem(
          createMockMemory({ content: "Call me Alex", messageRole: "user" }),
          "vector",
        ),
      ];

      const context = formatForLLM(items);

      expect(context).toContain("### Conversation History");
      expect(context).toContain("[user]: Call me Alex");
    });

    it("includes both sections when both types present", () => {
      const items: RecallItem[] = [
        factToRecallItem(createMockFact({ fact: "Known fact" }), "facts"),
        memoryToRecallItem(
          createMockMemory({ content: "User said this", messageRole: "user" }),
          "vector",
        ),
      ];

      const context = formatForLLM(items);

      expect(context).toContain("### Known Facts");
      expect(context).toContain("### Conversation History");
    });

    it("returns empty string for empty items array", () => {
      const context = formatForLLM([]);

      expect(context).toBe("");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // processRecallResults Tests (Full Pipeline)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("processRecallResults", () => {
    it("processes empty results gracefully", () => {
      const result = processRecallResults([], [], [], [], []);

      expect(result.items).toHaveLength(0);
      expect(result.sources.vector.count).toBe(0);
      expect(result.sources.facts.count).toBe(0);
      expect(result.sources.graph.count).toBe(0);
    });

    it("applies limit correctly", () => {
      const vectorMemories = Array.from({ length: 10 }, (_, i) =>
        createMockMemory({ memoryId: `mem-${i}` }),
      );

      const result = processRecallResults(vectorMemories, [], [], [], [], {
        limit: 5,
      });

      expect(result.items.length).toBe(5);
    });

    it("generates context when formatForLLM is true (default)", () => {
      const vectorMemories = [createMockMemory()];

      const result = processRecallResults(vectorMemories, [], [], [], []);

      expect(result.context).toBeDefined();
      expect(result.context).toContain("## Relevant Context");
    });

    it("skips context generation when formatForLLM is false", () => {
      const vectorMemories = [createMockMemory()];

      const result = processRecallResults(vectorMemories, [], [], [], [], {
        formatForLLM: false,
      });

      expect(result.context).toBeUndefined();
    });

    it("builds correct source breakdown", () => {
      const vectorMemories = [createMockMemory({ memoryId: "v-1" })];
      const directFacts = [
        createMockFact({ factId: "f-1" }),
        createMockFact({ factId: "f-2" }),
      ];
      const graphMemories = [createMockMemory({ memoryId: "g-1" })];
      const graphFacts = [createMockFact({ factId: "gf-1" })];
      const discoveredEntities = ["Alice", "Bob"];

      const result = processRecallResults(
        vectorMemories,
        directFacts,
        graphMemories,
        graphFacts,
        discoveredEntities,
      );

      expect(result.sources.vector.count).toBe(1);
      expect(result.sources.facts.count).toBe(2);
      expect(result.sources.graph.count).toBe(2); // graphMemories + graphFacts
      expect(result.sources.graph.expandedEntities).toEqual(discoveredEntities);
    });

    it("deduplicates before applying limit", () => {
      // Same ID appears in both vector and graph-expanded
      const vectorMemories = [createMockMemory({ memoryId: "duplicate-id" })];
      const graphMemories = [createMockMemory({ memoryId: "duplicate-id" })];

      const result = processRecallResults(
        vectorMemories,
        [],
        graphMemories,
        [],
        [],
        {
          limit: 10,
        },
      );

      // Should only have 1 item after deduplication
      expect(result.items.length).toBe(1);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Ranking Weights Validation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("RANKING_WEIGHTS", () => {
    it("weights sum to 1.0 for normalized scoring", () => {
      const sum =
        RANKING_WEIGHTS.semantic +
        RANKING_WEIGHTS.confidence +
        RANKING_WEIGHTS.importance +
        RANKING_WEIGHTS.recency +
        RANKING_WEIGHTS.graphConnectivity;

      expect(sum).toBeCloseTo(1.0);
    });
  });
});
