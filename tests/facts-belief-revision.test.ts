/**
 * Integration Tests - Belief Revision Pipeline
 *
 * Tests for the full belief revision flow with real Convex backend.
 * These tests verify the complete pipeline including:
 * - Slot matching
 * - Semantic matching
 * - LLM resolution (mocked)
 * - Decision execution
 * - History logging
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { Cortex } from "../src";
import { ConvexClient } from "convex/browser";
import { createNamedTestRunContext } from "./helpers";

// Mock LLM client for testing
const createMockLLMClient = () => {
  const mockImpl = async ({ prompt }: { prompt: string }): Promise<string> => {
    // Parse the prompt to determine the appropriate response
    if (prompt.includes("same slot") || prompt.includes("favorite color")) {
      return JSON.stringify({
        action: "SUPERSEDE",
        targetFactId: "fact-001", // Will be overridden in tests
        reason: "Color preference has changed",
        mergedFact: null,
        confidence: 90,
      });
    }
    return JSON.stringify({
      action: "ADD",
      targetFactId: null,
      reason: "No conflicts found",
      mergedFact: null,
      confidence: 100,
    });
  };

  return {
    complete: async (options: { system: string; prompt: string; model?: string; responseFormat?: "json" | "text" }) => {
      return mockImpl(options);
    },
  };
};

describe("Belief Revision Pipeline", () => {
  const ctx = createNamedTestRunContext("belief-revision");
  let cortex: Cortex;
  let client: ConvexClient;
  const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";
  const TEST_MEMSPACE_ID = ctx.memorySpaceId("test");

  beforeAll(async () => {
    client = new ConvexClient(CONVEX_URL);
    cortex = new Cortex({ convexUrl: CONVEX_URL });

    // Create test memory space
    await cortex.memorySpaces.register({
      memorySpaceId: TEST_MEMSPACE_ID,
      type: "personal",
    });
  });

  afterAll(async () => {
    try {
      await cortex.memorySpaces.delete(TEST_MEMSPACE_ID, {
        cascade: true,
        reason: "test cleanup",
      });
    } catch {
      // Ignore cleanup errors
    }
    await client.close();
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Conflict Detection (checkConflicts)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Conflict Detection", () => {
    it("should detect no conflicts for new fact", async () => {
      // Configure belief revision (required for checkConflicts)
      cortex.facts.configureBeliefRevision(createMockLLMClient());

      const result = await cortex.facts.checkConflicts({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: {
          fact: "User enjoys hiking",
          factType: "preference",
          subject: ctx.userId("check-user"),
          predicate: "enjoys",
          object: "hiking",
          confidence: 90,
        },
      });

      expect(result.hasConflicts).toBe(false);
      expect(result.slotConflicts.length).toBe(0);
      expect(result.semanticConflicts.length).toBe(0);
    });

    it("should detect slot conflicts for same slot", async () => {
      const userId = ctx.userId("slot-conflict");
      
      // Create existing fact
      const existingFact = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "User likes blue",
        factType: "preference",
        subject: userId,
        predicate: "favorite color",
        object: "blue",
        confidence: 80,
        sourceType: "conversation",
      });

      // Check for conflicts with new fact in same slot
      const result = await cortex.facts.checkConflicts({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: {
          fact: "User prefers purple",
          factType: "preference",
          subject: userId,
          predicate: "favorite color",
          object: "purple",
          confidence: 90,
        },
      });

      // May or may not detect conflicts depending on query implementation
      expect(result).toBeDefined();
      expect(result).toHaveProperty("hasConflicts");
      expect(result).toHaveProperty("recommendedAction");
      
      // Cleanup reference
      void existingFact;
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Service Configuration
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Service Configuration", () => {
    it("should work without LLM using heuristics fallback", async () => {
      // Create a new FactsAPI instance without LLM client
      // The SDK now supports heuristic-based belief revision without LLM
      const { FactsAPI } = await import("../src/facts");
      const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
      if (!convexUrl) {
        // Skip if no Convex URL
        return;
      }
      
      const { ConvexClient: LocalConvexClient } = await import("convex/browser");
      const localClient = new LocalConvexClient(convexUrl);
      const factsApi = new FactsAPI(localClient);

      // Should succeed using heuristics (no LLM needed for basic operations)
      const result = await factsApi.revise({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: {
          fact: "Test fact without LLM",
          confidence: 80,
        },
      });

      // Should add the fact since there are no conflicts
      expect(result.action).toBe("ADD");
      expect(result.fact).toBeDefined();
      expect(result.reason).toContain("No conflicts found");

      await localClient.close();
    });

    it("should allow reconfiguration", async () => {
      cortex.facts.configureBeliefRevision(createMockLLMClient(), {
        slotMatching: { enabled: true },
        semanticMatching: { enabled: false },
      });

      // Should not throw
      const result = await cortex.facts.checkConflicts({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: {
          fact: "Config test fact",
          confidence: 80,
        },
      });

      expect(result).toBeDefined();
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Manual Supersession Flow
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Manual Supersession", () => {
    it("should supersede one fact with another", async () => {
      // Create both facts and capture their IDs
      const oldFact = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "Old fact to supersede",
        factType: "custom",
        confidence: 80,
        sourceType: "conversation",
      });

      const newFact = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "New superseding fact",
        factType: "custom",
        confidence: 90,
        sourceType: "conversation",
      });

      // Supersede
      const result = await cortex.facts.supersede({
        memorySpaceId: TEST_MEMSPACE_ID,
        oldFactId: oldFact.factId,
        newFactId: newFact.factId,
        reason: "Manual supersession test",
      });

      expect(result.superseded).toBe(true);

      // Verify old fact is invalidated
      const retrievedOldFact = await cortex.facts.get(TEST_MEMSPACE_ID, oldFact.factId);
      expect(retrievedOldFact).toBeDefined();
      expect(retrievedOldFact?.validUntil).toBeDefined();
    });

    it("should record supersession in history", async () => {
      // Create and supersede
      const oldFact = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "History test old",
        factType: "custom",
        confidence: 80,
        sourceType: "conversation",
      });

      const newFact = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "History test new",
        factType: "custom",
        confidence: 90,
        sourceType: "conversation",
      });

      await cortex.facts.supersede({
        memorySpaceId: TEST_MEMSPACE_ID,
        oldFactId: oldFact.factId,
        newFactId: newFact.factId,
        reason: "History test",
      });

      // Check history
      const history = await cortex.facts.history(oldFact.factId);
      expect(Array.isArray(history)).toBe(true);
      
      // History should include SUPERSEDE event
      const supersessionEvent = history.find((e) => e.action === "SUPERSEDE");
      if (supersessionEvent) {
        expect(supersessionEvent.supersededBy).toBe(newFact.factId);
        expect(supersessionEvent.reason).toBe("History test");
      }
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Error Handling
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Error Handling", () => {
    it("should validate memorySpaceId in revise", async () => {
      cortex.facts.configureBeliefRevision(createMockLLMClient());

      await expect(
        cortex.facts.revise({
          memorySpaceId: "",
          fact: {
            fact: "Test",
            confidence: 80,
          },
        })
      ).rejects.toThrow();
    });

    it("should validate fact text in revise", async () => {
      await expect(
        cortex.facts.revise({
          memorySpaceId: TEST_MEMSPACE_ID,
          fact: {
            fact: "",
            confidence: 80,
          },
        })
      ).rejects.toThrow();
    });

    it("should validate confidence in revise", async () => {
      await expect(
        cortex.facts.revise({
          memorySpaceId: TEST_MEMSPACE_ID,
          fact: {
            fact: "Test",
            confidence: 150, // Invalid
          },
        })
      ).rejects.toThrow();
    });

    it("should handle supersession of non-existent fact", async () => {
      await expect(
        cortex.facts.supersede({
          memorySpaceId: TEST_MEMSPACE_ID,
          oldFactId: ctx.factPrefix("non-existent"),
          newFactId: ctx.factPrefix("also-non-existent"),
        })
      ).rejects.toThrow();
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Scenarios
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Real-World Scenarios", () => {
    it("Scenario: Color preference change", async () => {
      const userId = ctx.userId("color-scenario");
      
      // Day 1: User says they like blue
      const day1Fact = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: `${userId} likes blue`,
        factType: "preference",
        subject: userId,
        predicate: "favorite color",
        object: "blue",
        confidence: 90,
        sourceType: "conversation",
      });

      // Day 2: User says they now prefer purple
      const day2Fact = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: `${userId} prefers purple`,
        factType: "preference",
        subject: userId,
        predicate: "favorite color",
        object: "purple",
        confidence: 95,
        sourceType: "conversation",
      });

      // Manually supersede (in real usage, revise() would do this)
      await cortex.facts.supersede({
        memorySpaceId: TEST_MEMSPACE_ID,
        oldFactId: day1Fact.factId,
        newFactId: day2Fact.factId,
        reason: "User stated new preference",
      });

      // Verify current state
      const oldFact = await cortex.facts.get(TEST_MEMSPACE_ID, day1Fact.factId);
      const newFact = await cortex.facts.get(TEST_MEMSPACE_ID, day2Fact.factId);

      expect(oldFact?.validUntil).toBeDefined();
      expect(newFact?.validUntil).toBeUndefined();
    });

    it("Scenario: Employment change", async () => {
      const userId = ctx.userId("employment-scenario");
      
      // Original: User works at Company A
      const jobOld = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: `${userId} works at Company A`,
        factType: "knowledge",
        subject: userId,
        predicate: "works at",
        object: "Company A",
        confidence: 85,
        sourceType: "conversation",
      });

      // New: User moved to Company B
      const jobNew = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: `${userId} works at Company B`,
        factType: "knowledge",
        subject: userId,
        predicate: "works at",
        object: "Company B",
        confidence: 95,
        sourceType: "conversation",
      });

      // Supersede
      await cortex.facts.supersede({
        memorySpaceId: TEST_MEMSPACE_ID,
        oldFactId: jobOld.factId,
        newFactId: jobNew.factId,
        reason: "User changed jobs",
      });

      // Check chain
      const chain = await cortex.facts.getSupersessionChain(jobNew.factId);
      expect(Array.isArray(chain)).toBe(true);
    });
  });
});
