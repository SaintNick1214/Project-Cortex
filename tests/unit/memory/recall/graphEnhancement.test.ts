/**
 * Unit Tests: Graph Enhancement for recall() Orchestration
 *
 * Tests entity extraction and graph expansion utilities.
 */

import { describe, it, expect } from "@jest/globals";
import {
  extractEntitiesFromResults,
} from "../../../../src/memory/recall/graphEnhancement";
import type { FactRecord, MemoryEntry } from "../../../../src/types";

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
      const facts = [createMockFact({ subject: "Alice", object: "Acme Corp" })];

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
        createMockFact({
          subject: "Alice",
          object: "Project X",
          factId: "fact-2",
        }),
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

});
