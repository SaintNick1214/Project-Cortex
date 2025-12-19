/**
 * Tests for ProgressiveFactExtractor
 *
 * Comprehensive coverage for progressive fact extraction during streaming,
 * including deduplication, threshold-based extraction, and final extraction.
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { ProgressiveFactExtractor } from "../../src/memory/streaming/FactExtractor";
import type { FactsAPI } from "../../src/facts";
import type { FactRecord } from "../../src/types";

// Mock FactsAPI
function createMockFactsAPI(): FactsAPI {
  const storedFacts: FactRecord[] = [];
  let factIdCounter = 1;

  const storeFn = jest.fn(async (input: any) => {
    const fact: FactRecord = {
      _id: `doc-${factIdCounter}` as any,
      factId: `fact-${factIdCounter++}`,
      memorySpaceId: input.memorySpaceId,
      userId: input.userId,
      participantId: input.participantId,
      fact: input.fact,
      factType: input.factType,
      subject: input.subject,
      predicate: input.predicate,
      object: input.object,
      confidence: input.confidence,
      sourceType: input.sourceType,
      sourceRef: input.sourceRef,
      tags: input.tags || [],
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    storedFacts.push(fact);
    return fact;
  });

  return {
    store: storeFn,
    // storeWithDedup delegates to store for testing (returns StoreWithDedupResult)
    storeWithDedup: jest.fn(async (input: any, _options?: any) => {
      const fact = await storeFn(input);
      return {
        fact,
        wasUpdated: false,
        deduplication: { strategy: "structural", matchedExisting: false },
      };
    }),
    update: jest.fn(async (_memorySpaceId: string, factId: string, updates: any) => {
      const fact = storedFacts.find((f) => f.factId === factId);
      if (fact) {
        Object.assign(fact, updates);
      }
      return fact;
    }),
    get: jest.fn(async (_memorySpaceId: string, factId: string) => {
      return storedFacts.find((f) => f.factId === factId) || null;
    }),
    list: jest.fn(async () => storedFacts),
    delete: jest.fn(),
    search: jest.fn(),
    count: jest.fn(),
    deleteMany: jest.fn(),
    updateMany: jest.fn(),
  } as unknown as FactsAPI;
}

// Mock fact extraction function
function createMockExtractFacts(factsToReturn: any[] | null) {
  return jest.fn(async (_userMsg: string, _agentResp: string) => factsToReturn);
}

describe("ProgressiveFactExtractor", () => {
  let extractor: ProgressiveFactExtractor;
  let mockFactsAPI: FactsAPI;

  beforeEach(() => {
    mockFactsAPI = createMockFactsAPI();
    extractor = new ProgressiveFactExtractor(
      mockFactsAPI,
      "test-space",
      "test-user",
      "test-participant",
      { extractionThreshold: 500 },
    );
  });

  describe("constructor", () => {
    it("should create instance with default threshold", () => {
      const defaultExtractor = new ProgressiveFactExtractor(
        mockFactsAPI,
        "test-space",
        "test-user",
      );
      // Default threshold is 500
      expect(defaultExtractor.shouldExtract(500)).toBe(true);
      expect(defaultExtractor.shouldExtract(499)).toBe(false);
    });

    it("should create instance with custom threshold", () => {
      const customExtractor = new ProgressiveFactExtractor(
        mockFactsAPI,
        "test-space",
        "test-user",
        undefined,
        { extractionThreshold: 200 },
      );
      expect(customExtractor.shouldExtract(200)).toBe(true);
      expect(customExtractor.shouldExtract(199)).toBe(false);
    });

    it("should accept optional participantId", () => {
      const noParticipant = new ProgressiveFactExtractor(
        mockFactsAPI,
        "test-space",
        "test-user",
      );
      expect(noParticipant).toBeDefined();
    });
  });

  describe("shouldExtract()", () => {
    it("should return true when content exceeds threshold", () => {
      expect(extractor.shouldExtract(500)).toBe(true);
      expect(extractor.shouldExtract(1000)).toBe(true);
    });

    it("should return false when content is below threshold", () => {
      expect(extractor.shouldExtract(499)).toBe(false);
      expect(extractor.shouldExtract(0)).toBe(false);
    });

    it("should track extraction points after extraction", async () => {
      const extractFacts = createMockExtractFacts([
        { fact: "Test fact", factType: "knowledge", confidence: 90 },
      ]);

      // First extraction at 500 chars
      await extractor.extractFromChunk(
        "x".repeat(500),
        1,
        extractFacts,
        "user message",
        "conv-1",
      );

      // Next extraction should require 1000 chars (500 + 500)
      expect(extractor.shouldExtract(999)).toBe(false);
      expect(extractor.shouldExtract(1000)).toBe(true);
    });

    it("should handle exact threshold boundary", () => {
      expect(extractor.shouldExtract(500)).toBe(true);
    });
  });

  describe("extractFromChunk()", () => {
    it("should extract and store facts from chunk", async () => {
      const extractFacts = createMockExtractFacts([
        {
          fact: "User likes blue",
          factType: "preference",
          subject: "user",
          predicate: "likes",
          object: "blue",
          confidence: 95,
          tags: ["color"],
        },
      ]);

      const result = await extractor.extractFromChunk(
        "My favorite color is blue",
        1,
        extractFacts,
        "What is your favorite color?",
        "conv-1",
      );

      expect(result).toHaveLength(1);
      expect(result[0].fact).toBe("User likes blue");
      expect(result[0].confidence).toBe(95);
      expect(result[0].extractedAtChunk).toBe(1);
      expect(result[0].deduped).toBe(false);

      expect(mockFactsAPI.storeWithDedup).toHaveBeenCalledWith(
        expect.objectContaining({
          memorySpaceId: "test-space",
          userId: "test-user",
          participantId: "test-participant",
          fact: "User likes blue",
          factType: "preference",
        }),
        expect.any(Object),
      );
    });

    it("should handle multiple facts in single chunk", async () => {
      const extractFacts = createMockExtractFacts([
        { fact: "Fact 1", factType: "knowledge", confidence: 90 },
        { fact: "Fact 2", factType: "preference", confidence: 85 },
        { fact: "Fact 3", factType: "identity", confidence: 80 },
      ]);

      const result = await extractor.extractFromChunk(
        "Multiple facts content",
        1,
        extractFacts,
        "user message",
        "conv-1",
      );

      expect(result).toHaveLength(3);
      expect(mockFactsAPI.storeWithDedup).toHaveBeenCalledTimes(3);
    });

    it("should deduplicate facts with same key", async () => {
      const extractFacts = createMockExtractFacts([
        { fact: "User likes blue", factType: "preference", confidence: 90 },
      ]);

      // First extraction
      await extractor.extractFromChunk(
        "My favorite color is blue",
        1,
        extractFacts,
        "user message",
        "conv-1",
      );

      // Second extraction with same fact should be deduped
      const result2 = await extractor.extractFromChunk(
        "My favorite color is blue - I really love blue",
        2,
        extractFacts,
        "user message",
        "conv-1",
      );

      // Should not store duplicate
      expect(result2).toHaveLength(0);
      expect(mockFactsAPI.storeWithDedup).toHaveBeenCalledTimes(1);
    });

    it("should update confidence if higher", async () => {
      const extractFacts1 = createMockExtractFacts([
        { fact: "User likes blue", factType: "preference", confidence: 70 },
      ]);

      await extractor.extractFromChunk(
        "My favorite color is blue",
        1,
        extractFacts1,
        "user message",
        "conv-1",
      );

      // Higher confidence for same fact
      const extractFacts2 = createMockExtractFacts([
        { fact: "User likes blue", factType: "preference", confidence: 95 },
      ]);

      await extractor.extractFromChunk(
        "My favorite color is definitely blue",
        2,
        extractFacts2,
        "user message",
        "conv-1",
      );

      expect(mockFactsAPI.update).toHaveBeenCalledWith(
        "test-space",
        expect.any(String),
        expect.objectContaining({ confidence: 95 }),
        expect.any(Object),
      );
    });

    it("should handle null from extractFacts function", async () => {
      const extractFacts = createMockExtractFacts(null);

      const result = await extractor.extractFromChunk(
        "No facts here",
        1,
        extractFacts,
        "user message",
        "conv-1",
      );

      expect(result).toHaveLength(0);
      expect(mockFactsAPI.storeWithDedup).not.toHaveBeenCalled();
    });

    it("should handle empty array from extractFacts function", async () => {
      const extractFacts = createMockExtractFacts([]);

      const result = await extractor.extractFromChunk(
        "No facts here",
        1,
        extractFacts,
        "user message",
        "conv-1",
      );

      expect(result).toHaveLength(0);
      expect(mockFactsAPI.storeWithDedup).not.toHaveBeenCalled();
    });

    it("should update lastExtractionPoint after extraction", async () => {
      const extractFacts = createMockExtractFacts([]);

      await extractor.extractFromChunk(
        "x".repeat(600),
        1,
        extractFacts,
        "user message",
        "conv-1",
      );

      // Should now need 600 + 500 = 1100 chars
      expect(extractor.shouldExtract(1099)).toBe(false);
      expect(extractor.shouldExtract(1100)).toBe(true);
    });

    it("should add progressive and chunk tags", async () => {
      const extractFacts = createMockExtractFacts([
        { fact: "Test fact", factType: "knowledge", confidence: 90 },
      ]);

      await extractor.extractFromChunk(
        "Test content",
        5,
        extractFacts,
        "user message",
        "conv-1",
      );

      expect(mockFactsAPI.storeWithDedup).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: expect.arrayContaining(["progressive", "chunk-5"]),
        }),
        expect.any(Object),
      );
    });

    it("should handle syncToGraph option", async () => {
      const extractFacts = createMockExtractFacts([
        { fact: "Test fact", factType: "knowledge", confidence: 90 },
      ]);

      await extractor.extractFromChunk(
        "Test content",
        1,
        extractFacts,
        "user message",
        "conv-1",
        true, // syncToGraph
      );

      expect(mockFactsAPI.storeWithDedup).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ syncToGraph: true }),
      );
    });

    it("should handle fact storage errors gracefully", async () => {
      const failingStoreWithDedup = jest.fn<() => Promise<any>>();
      failingStoreWithDedup.mockRejectedValue(new Error("Storage error"));
      const failingFactsAPI = {
        ...createMockFactsAPI(),
        storeWithDedup: failingStoreWithDedup,
      } as unknown as FactsAPI;

      const extractor2 = new ProgressiveFactExtractor(
        failingFactsAPI,
        "test-space",
        "test-user",
      );

      const extractFacts = createMockExtractFacts([
        { fact: "Test fact", factType: "knowledge", confidence: 90 },
      ]);

      // Should not throw, just return empty
      const result = await extractor2.extractFromChunk(
        "Test content",
        1,
        extractFacts,
        "user message",
        "conv-1",
      );

      expect(result).toHaveLength(0);
    });

    it("should handle extractFacts function errors gracefully", async () => {
      const extractFacts = jest.fn<() => Promise<any>>();
      extractFacts.mockRejectedValue(new Error("Extract error"));

      const result = await extractor.extractFromChunk(
        "Test content",
        1,
        extractFacts as any,
        "user message",
        "conv-1",
      );

      expect(result).toHaveLength(0);
    });

    it("should use userId as default subject when not provided", async () => {
      const extractFacts = createMockExtractFacts([
        { fact: "Test fact", factType: "knowledge", confidence: 90 },
        // No subject provided
      ]);

      await extractor.extractFromChunk(
        "Test content",
        1,
        extractFacts,
        "user message",
        "conv-1",
      );

      expect(mockFactsAPI.storeWithDedup).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: "test-user",
        }),
        expect.any(Object),
      );
    });
  });

  describe("finalizeExtraction()", () => {
    it("should extract facts from full response", async () => {
      const extractFacts = createMockExtractFacts([
        { fact: "Final fact", factType: "knowledge", confidence: 95 },
      ]);

      const result = await extractor.finalizeExtraction(
        "user message",
        "full agent response",
        extractFacts,
        "conv-1",
        "mem-1",
        ["msg-1", "msg-2"],
      );

      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it("should deduplicate against progressively extracted facts", async () => {
      // First extract some facts progressively
      const progressiveExtract = createMockExtractFacts([
        { fact: "User likes blue", factType: "preference", confidence: 90 },
      ]);

      await extractor.extractFromChunk(
        "I like blue",
        1,
        progressiveExtract,
        "user message",
        "conv-1",
      );

      // Final extraction returns same fact - should be deduped
      const finalExtract = createMockExtractFacts([
        { fact: "User likes blue", factType: "preference", confidence: 90 },
      ]);

      const result = await extractor.finalizeExtraction(
        "user message",
        "I like blue",
        finalExtract,
        "conv-1",
        "mem-1",
        ["msg-1"],
      );

      // Should return the already extracted fact, not store a new one
      expect(result).toHaveLength(1);
      // storeWithDedup should only be called once (from progressive)
      expect(mockFactsAPI.storeWithDedup).toHaveBeenCalledTimes(1);
    });

    it("should store new facts found in final extraction", async () => {
      // Progressive extraction finds one fact
      const progressiveExtract = createMockExtractFacts([
        { fact: "User likes blue", factType: "preference", confidence: 90 },
      ]);

      await extractor.extractFromChunk(
        "I like blue",
        1,
        progressiveExtract,
        "user message",
        "conv-1",
      );

      // Final extraction finds additional fact
      const finalExtract = createMockExtractFacts([
        { fact: "User likes blue", factType: "preference", confidence: 90 },
        { fact: "User lives in NYC", factType: "identity", confidence: 85 },
      ]);

      const result = await extractor.finalizeExtraction(
        "user message",
        "I like blue and live in NYC",
        finalExtract,
        "conv-1",
        "mem-1",
        ["msg-1"],
      );

      expect(result).toHaveLength(2);
      // storeWithDedup should be called twice (once progressive, once final)
      expect(mockFactsAPI.storeWithDedup).toHaveBeenCalledTimes(2);
    });

    it("should return progressively extracted facts when no new final facts", async () => {
      const progressiveExtract = createMockExtractFacts([
        { fact: "Test fact", factType: "knowledge", confidence: 90, tags: [] },
      ]);

      await extractor.extractFromChunk(
        "content",
        1,
        progressiveExtract,
        "user message",
        "conv-1",
      );

      const finalExtract = createMockExtractFacts([]);

      const result = await extractor.finalizeExtraction(
        "user message",
        "full response",
        finalExtract,
        "conv-1",
        "mem-1",
        ["msg-1"],
      );

      // Should return the progressively extracted facts
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].fact).toBe("Test fact");
    });

    it("should handle null from final extractFacts", async () => {
      const extractFacts = createMockExtractFacts(null);

      const result = await extractor.finalizeExtraction(
        "user message",
        "full response",
        extractFacts,
        "conv-1",
        "mem-1",
        ["msg-1"],
      );

      expect(result).toEqual([]);
    });

    it("should handle errors gracefully", async () => {
      const extractFacts = jest.fn<() => Promise<any>>();
      extractFacts.mockRejectedValue(new Error("Final error"));

      const result = await extractor.finalizeExtraction(
        "user message",
        "full response",
        extractFacts as any,
        "conv-1",
        "mem-1",
        ["msg-1"],
      );

      // Should return existing facts, not throw
      expect(Array.isArray(result)).toBe(true);
    });

    it("should include sourceRef with memoryId and messageIds", async () => {
      const extractFacts = createMockExtractFacts([
        { fact: "New fact", factType: "knowledge", confidence: 90 },
      ]);

      await extractor.finalizeExtraction(
        "user message",
        "full response",
        extractFacts,
        "conv-1",
        "mem-123",
        ["msg-1", "msg-2"],
      );

      expect(mockFactsAPI.storeWithDedup).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceRef: expect.objectContaining({
            conversationId: "conv-1",
            messageIds: ["msg-1", "msg-2"],
            memoryId: "mem-123",
          }),
        }),
        expect.any(Object),
      );
    });

    it("should pass syncToGraph option", async () => {
      const extractFacts = createMockExtractFacts([
        { fact: "New fact", factType: "knowledge", confidence: 90 },
      ]);

      await extractor.finalizeExtraction(
        "user message",
        "full response",
        extractFacts,
        "conv-1",
        "mem-1",
        ["msg-1"],
        true, // syncToGraph
      );

      expect(mockFactsAPI.storeWithDedup).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ syncToGraph: true }),
      );
    });
  });

  describe("getExtractedFacts()", () => {
    it("should return empty array initially", () => {
      const facts = extractor.getExtractedFacts();
      expect(facts).toEqual([]);
    });

    it("should return all extracted facts", async () => {
      const extractFacts = createMockExtractFacts([
        { fact: "Fact 1", factType: "knowledge", confidence: 90 },
        { fact: "Fact 2", factType: "preference", confidence: 85 },
      ]);

      await extractor.extractFromChunk(
        "content",
        1,
        extractFacts,
        "user message",
        "conv-1",
      );

      const facts = extractor.getExtractedFacts();
      expect(facts).toHaveLength(2);
    });

    it("should return a copy, not the internal array", async () => {
      const extractFacts = createMockExtractFacts([
        { fact: "Fact 1", factType: "knowledge", confidence: 90 },
      ]);

      await extractor.extractFromChunk(
        "content",
        1,
        extractFacts,
        "user message",
        "conv-1",
      );

      const facts1 = extractor.getExtractedFacts();
      const facts2 = extractor.getExtractedFacts();

      // Should be equal but not the same reference
      expect(facts1).toEqual(facts2);
    });
  });

  describe("getStats()", () => {
    it("should return zero stats initially", () => {
      const stats = extractor.getStats();
      expect(stats.totalFactsExtracted).toBe(0);
      expect(stats.extractionPoints).toBe(0);
      expect(stats.averageFactsPerExtraction).toBe(0);
    });

    it("should track extraction statistics", async () => {
      const extractFacts = createMockExtractFacts([
        { fact: "Fact 1", factType: "knowledge", confidence: 90 },
        { fact: "Fact 2", factType: "preference", confidence: 85 },
      ]);

      await extractor.extractFromChunk(
        "content",
        1,
        extractFacts,
        "user message",
        "conv-1",
      );

      const stats = extractor.getStats();
      expect(stats.totalFactsExtracted).toBe(2);
      // extractionPoints tracks each fact stored (not extraction calls)
      expect(stats.extractionPoints).toBe(2);
      // average = totalFactsExtracted / extractionPoints = 2/2 = 1
      expect(stats.averageFactsPerExtraction).toBe(1);
    });

    it("should calculate average correctly over multiple extractions", async () => {
      // First extraction: 2 facts
      const extractFacts1 = createMockExtractFacts([
        { fact: "Fact 1", factType: "knowledge", confidence: 90 },
        { fact: "Fact 2", factType: "preference", confidence: 85 },
      ]);

      await extractor.extractFromChunk(
        "x".repeat(500),
        1,
        extractFacts1,
        "user message",
        "conv-1",
      );

      // Second extraction: 1 fact
      const extractFacts2 = createMockExtractFacts([
        { fact: "Fact 3", factType: "knowledge", confidence: 80 },
      ]);

      await extractor.extractFromChunk(
        "x".repeat(1000),
        2,
        extractFacts2,
        "user message",
        "conv-1",
      );

      const stats = extractor.getStats();
      expect(stats.totalFactsExtracted).toBe(3);
      // extractionPoints tracks each fact stored
      expect(stats.extractionPoints).toBe(3);
      // average = totalFactsExtracted / extractionPoints = 3/3 = 1
      expect(stats.averageFactsPerExtraction).toBe(1);
    });
  });

  describe("reset()", () => {
    it("should clear all state", async () => {
      const extractFacts = createMockExtractFacts([
        { fact: "Fact 1", factType: "knowledge", confidence: 90 },
      ]);

      await extractor.extractFromChunk(
        "content",
        1,
        extractFacts,
        "user message",
        "conv-1",
      );

      expect(extractor.getExtractedFacts().length).toBe(1);

      extractor.reset();

      expect(extractor.getExtractedFacts()).toEqual([]);
      expect(extractor.getStats().totalFactsExtracted).toBe(0);
      expect(extractor.getStats().extractionPoints).toBe(0);
    });

    it("should reset lastExtractionPoint", async () => {
      const extractFacts = createMockExtractFacts([]);

      await extractor.extractFromChunk(
        "x".repeat(600),
        1,
        extractFacts,
        "user message",
        "conv-1",
      );

      // Need 1100 chars now
      expect(extractor.shouldExtract(500)).toBe(false);

      extractor.reset();

      // Back to needing 500 chars
      expect(extractor.shouldExtract(500)).toBe(true);
    });

    it("should allow reuse after reset", async () => {
      const extractFacts1 = createMockExtractFacts([
        { fact: "Fact 1", factType: "knowledge", confidence: 90 },
      ]);

      await extractor.extractFromChunk(
        "content",
        1,
        extractFacts1,
        "user message",
        "conv-1",
      );

      extractor.reset();

      const extractFacts2 = createMockExtractFacts([
        { fact: "Fact 2", factType: "preference", confidence: 85 },
      ]);

      await extractor.extractFromChunk(
        "new content",
        1,
        extractFacts2,
        "user message",
        "conv-2",
      );

      expect(extractor.getExtractedFacts()).toHaveLength(1);
      expect(extractor.getExtractedFacts()[0].fact).toBe("Fact 2");
    });
  });

  describe("Edge Cases", () => {
    it("should handle very long fact text", async () => {
      const longFact = "A".repeat(10000);
      const extractFacts = createMockExtractFacts([
        { fact: longFact, factType: "knowledge", confidence: 90 },
      ]);

      const result = await extractor.extractFromChunk(
        "content",
        1,
        extractFacts,
        "user message",
        "conv-1",
      );

      expect(result).toHaveLength(1);
      expect(result[0].fact).toBe(longFact);
    });

    it("should handle unicode in facts", async () => {
      const extractFacts = createMockExtractFacts([
        { fact: "User's name is 田中太郎 🎉", factType: "identity", confidence: 95 },
      ]);

      const result = await extractor.extractFromChunk(
        "content",
        1,
        extractFacts,
        "user message",
        "conv-1",
      );

      expect(result).toHaveLength(1);
      expect(result[0].fact).toBe("User's name is 田中太郎 🎉");
    });

    it("should handle fact with empty tags array", async () => {
      const extractFacts = createMockExtractFacts([
        { fact: "Test", factType: "knowledge", confidence: 90, tags: [] },
      ]);

      const result = await extractor.extractFromChunk(
        "content",
        1,
        extractFacts,
        "user message",
        "conv-1",
      );

      expect(result).toHaveLength(1);
    });

    it("should handle fact without optional fields", async () => {
      const extractFacts = createMockExtractFacts([
        { fact: "Minimal fact", factType: "observation", confidence: 50 },
        // No subject, predicate, object, tags
      ]);

      const result = await extractor.extractFromChunk(
        "content",
        1,
        extractFacts,
        "user message",
        "conv-1",
      );

      expect(result).toHaveLength(1);
    });

    it("should handle zero confidence", async () => {
      const extractFacts = createMockExtractFacts([
        { fact: "Low confidence fact", factType: "knowledge", confidence: 0 },
      ]);

      const result = await extractor.extractFromChunk(
        "content",
        1,
        extractFacts,
        "user message",
        "conv-1",
      );

      expect(result).toHaveLength(1);
      expect(result[0].confidence).toBe(0);
    });

    it("should handle 100 confidence", async () => {
      const extractFacts = createMockExtractFacts([
        { fact: "High confidence fact", factType: "knowledge", confidence: 100 },
      ]);

      const result = await extractor.extractFromChunk(
        "content",
        1,
        extractFacts,
        "user message",
        "conv-1",
      );

      expect(result).toHaveLength(1);
      expect(result[0].confidence).toBe(100);
    });

    it("should handle all fact types", async () => {
      const factTypes = [
        "preference",
        "identity",
        "knowledge",
        "relationship",
        "event",
        "observation",
        "custom",
      ];

      for (const factType of factTypes) {
        extractor.reset();
        const extractFacts = createMockExtractFacts([
          { fact: `${factType} fact`, factType, confidence: 90 },
        ]);

        const result = await extractor.extractFromChunk(
          `content for ${factType}`,
          1,
          extractFacts,
          "user message",
          "conv-1",
        );

        expect(result).toHaveLength(1);
      }
    });
  });
});
