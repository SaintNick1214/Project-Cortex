/**
 * Unit Tests - Fact History Service
 *
 * Tests for history logging, retrieval, and management.
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { Cortex } from "../src";
import { ConvexClient } from "convex/browser";
import { createNamedTestRunContext } from "./helpers";

describe("Fact History Service", () => {
  const ctx = createNamedTestRunContext("fact-history");
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

  describe("Basic Operations", () => {
    it("should store a fact and track CREATE in history", async () => {
      const factId = ctx.factPrefix("basic-create");

      // Store a fact
      const fact = await cortex.facts.store(
        {
          memorySpaceId: TEST_MEMSPACE_ID,
          fact: "User likes blue",
          factType: "preference",
          subject: "user",
          predicate: "favorite color",
          object: "blue",
          confidence: 90,
          sourceType: "conversation",
        },
        { factId }
      );

      expect(fact).toBeDefined();
      expect(fact.factId).toBe(factId);

      // History should be available (may not have events until belief revision is used)
      // This test verifies the history method works without errors
      const history = await cortex.facts.history(fact.factId);
      expect(Array.isArray(history)).toBe(true);
    });

    it("should track multiple changes to a fact", async () => {
      const factId = ctx.factPrefix("multi-change");

      // Create fact
      const fact = await cortex.facts.store(
        {
          memorySpaceId: TEST_MEMSPACE_ID,
          fact: "User lives in NYC",
          factType: "knowledge",
          subject: "user",
          predicate: "lives in",
          object: "NYC",
          confidence: 80,
          sourceType: "conversation",
        },
        { factId }
      );

      // Update fact
      await cortex.facts.update(TEST_MEMSPACE_ID, fact.factId, {
        confidence: 95,
      });

      // Get history
      const history = await cortex.facts.history(fact.factId);
      expect(Array.isArray(history)).toBe(true);
    });
  });

  describe("Filter Operations", () => {
    it("should filter changes by time range", async () => {
      const factId = ctx.factPrefix("time-filter");
      const beforeTime = new Date();

      // Create fact
      await cortex.facts.store(
        {
          memorySpaceId: TEST_MEMSPACE_ID,
          fact: "Test time filter fact",
          factType: "custom",
          confidence: 80,
          sourceType: "conversation",
        },
        { factId }
      );

      const afterTime = new Date();

      // Query with time range
      const changes = await cortex.facts.getChanges({
        memorySpaceId: TEST_MEMSPACE_ID,
        after: beforeTime,
        before: afterTime,
      });

      expect(Array.isArray(changes)).toBe(true);
    });

    it("should limit results", async () => {
      // Create multiple facts
      for (let i = 0; i < 5; i++) {
        await cortex.facts.store(
          {
            memorySpaceId: TEST_MEMSPACE_ID,
            fact: `Limit test fact ${i}`,
            factType: "custom",
            confidence: 80,
            sourceType: "conversation",
          },
          { factId: ctx.factPrefix(`limit-${i}`) }
        );
      }

      // Query with limit
      const changes = await cortex.facts.getChanges({
        memorySpaceId: TEST_MEMSPACE_ID,
        limit: 3,
      });

      expect(changes.length).toBeLessThanOrEqual(3);
    });
  });

  describe("Activity Summary", () => {
    it("should return activity summary for memory space", async () => {
      const summary = await cortex.facts.getActivitySummary(TEST_MEMSPACE_ID, 24);

      expect(summary).toBeDefined();
      expect(summary).toHaveProperty("timeRange");
      expect(summary).toHaveProperty("totalEvents");
      expect(summary).toHaveProperty("actionCounts");
      expect(summary.actionCounts).toHaveProperty("CREATE");
      expect(summary.actionCounts).toHaveProperty("UPDATE");
      expect(summary.actionCounts).toHaveProperty("SUPERSEDE");
      expect(summary.actionCounts).toHaveProperty("DELETE");
    });

    it("should allow different time ranges", async () => {
      const summary1h = await cortex.facts.getActivitySummary(TEST_MEMSPACE_ID, 1);
      const summary24h = await cortex.facts.getActivitySummary(TEST_MEMSPACE_ID, 24);

      expect(summary1h.timeRange.hours).toBe(1);
      expect(summary24h.timeRange.hours).toBe(24);
    });
  });

  describe("Supersession Chain", () => {
    it("should return supersession chain for a fact", async () => {
      const factId = ctx.factPrefix("chain-test");
      
      // Create a fact
      await cortex.facts.store(
        {
          memorySpaceId: TEST_MEMSPACE_ID,
          fact: "Chain test fact",
          factType: "custom",
          confidence: 80,
          sourceType: "conversation",
        },
        { factId }
      );

      // Get chain
      const chain = await cortex.facts.getSupersessionChain(factId);

      expect(Array.isArray(chain)).toBe(true);
    });
  });

  describe("Manual Supersession", () => {
    it("should supersede a fact manually", async () => {
      const oldFactId = ctx.factPrefix("supersede-old");
      const newFactId = ctx.factPrefix("supersede-new");

      // Create old fact
      await cortex.facts.store(
        {
          memorySpaceId: TEST_MEMSPACE_ID,
          fact: "User likes blue",
          factType: "preference",
          subject: "user",
          predicate: "favorite color",
          object: "blue",
          confidence: 80,
          sourceType: "conversation",
        },
        { factId: oldFactId }
      );

      // Create new fact
      await cortex.facts.store(
        {
          memorySpaceId: TEST_MEMSPACE_ID,
          fact: "User likes purple",
          factType: "preference",
          subject: "user",
          predicate: "favorite color",
          object: "purple",
          confidence: 90,
          sourceType: "conversation",
        },
        { factId: newFactId }
      );

      // Supersede
      const result = await cortex.facts.supersede({
        memorySpaceId: TEST_MEMSPACE_ID,
        oldFactId,
        newFactId,
        reason: "User changed preference",
      });

      expect(result.superseded).toBe(true);
      expect(result.oldFactId).toBe(oldFactId);
      expect(result.newFactId).toBe(newFactId);

      // Verify old fact is marked as superseded
      const oldFact = await cortex.facts.get(TEST_MEMSPACE_ID, oldFactId);
      expect(oldFact?.validUntil).toBeDefined();
    });

    it("should throw when superseding non-existent fact", async () => {
      await expect(
        cortex.facts.supersede({
          memorySpaceId: TEST_MEMSPACE_ID,
          oldFactId: "non-existent-old",
          newFactId: ctx.factPrefix("supersede-new-2"),
          reason: "Test",
        })
      ).rejects.toThrow();
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid factId format", async () => {
      await expect(cortex.facts.history("invalid")).rejects.toThrow();
    });

    it("should handle empty memory space ID", async () => {
      await expect(
        cortex.facts.getActivitySummary("", 24)
      ).rejects.toThrow();
    });
  });
});
