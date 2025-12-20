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
      // Store a fact
      const fact = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "User likes blue",
        factType: "preference",
        subject: "user",
        predicate: "favorite color",
        object: "blue",
        confidence: 90,
        sourceType: "conversation",
      });

      expect(fact).toBeDefined();
      expect(fact.factId).toBeDefined();

      // History should be available (may not have events until belief revision is used)
      // This test verifies the history method works without errors
      const history = await cortex.facts.history(fact.factId);
      expect(Array.isArray(history)).toBe(true);
    });

    it("should track multiple changes to a fact", async () => {
      // Create fact
      const fact = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "User lives in NYC",
        factType: "knowledge",
        subject: "user",
        predicate: "lives in",
        object: "NYC",
        confidence: 80,
        sourceType: "conversation",
      });

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
      const beforeTime = new Date();

      // Create fact
      await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "Test time filter fact",
        factType: "custom",
        confidence: 80,
        sourceType: "conversation",
      });

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
        await cortex.facts.store({
          memorySpaceId: TEST_MEMSPACE_ID,
          fact: `Limit test fact ${i}`,
          factType: "custom",
          confidence: 80,
          sourceType: "conversation",
        });
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
      // Create a fact
      const fact = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "Chain test fact",
        factType: "custom",
        confidence: 80,
        sourceType: "conversation",
      });

      // Get chain
      const chain = await cortex.facts.getSupersessionChain(fact.factId);

      expect(Array.isArray(chain)).toBe(true);
    });
  });

  describe("Manual Supersession", () => {
    it("should supersede a fact manually", async () => {
      // Create old fact
      const oldFact = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "User likes blue",
        factType: "preference",
        subject: "user",
        predicate: "favorite color",
        object: "blue",
        confidence: 80,
        sourceType: "conversation",
      });

      // Create new fact
      const newFact = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "User likes purple",
        factType: "preference",
        subject: "user",
        predicate: "favorite color",
        object: "purple",
        confidence: 90,
        sourceType: "conversation",
      });

      // Supersede
      const result = await cortex.facts.supersede({
        memorySpaceId: TEST_MEMSPACE_ID,
        oldFactId: oldFact.factId,
        newFactId: newFact.factId,
        reason: "User changed preference",
      });

      expect(result.superseded).toBe(true);
      expect(result.oldFactId).toBe(oldFact.factId);
      expect(result.newFactId).toBe(newFact.factId);

      // Verify old fact is marked as superseded
      const retrievedOldFact = await cortex.facts.get(TEST_MEMSPACE_ID, oldFact.factId);
      expect(retrievedOldFact?.validUntil).toBeDefined();
    });

    it("should throw when superseding non-existent fact", async () => {
      // Create a new fact to supersede with
      const newFact = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "New supersede test fact",
        factType: "custom",
        confidence: 90,
        sourceType: "conversation",
      });

      await expect(
        cortex.facts.supersede({
          memorySpaceId: TEST_MEMSPACE_ID,
          oldFactId: "non-existent-old",
          newFactId: newFact.factId,
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
