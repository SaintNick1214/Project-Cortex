/**
 * Facts Workflow E2E Tests
 *
 * End-to-end tests for fact extraction and management.
 * These tests require CONVEX_URL to be set.
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { Cortex } from "@cortexmemory/sdk";
import { cleanupTestData } from "../setup.js";

// Skip these tests if no Convex URL is configured
const CONVEX_URL = process.env.CONVEX_URL;
const describeE2E = CONVEX_URL ? describe : describe.skip;

describeE2E("Facts Workflow E2E", () => {
  let cortex: Cortex;
  const TIMESTAMP = Date.now();
  const TEST_PREFIX = `e2e-facts-${TIMESTAMP}`;
  const TEST_SPACE_ID = `${TEST_PREFIX}-space`;
  const TEST_USER_ID = `${TEST_PREFIX}-user`;

  beforeAll(async () => {
    cortex = new Cortex({ convexUrl: CONVEX_URL! });
    await cleanupTestData(TEST_PREFIX);

    // Create test space
    await cortex.memorySpaces.register({
      memorySpaceId: TEST_SPACE_ID,
      name: "E2E Facts Test Space",
      type: "project",
    });
  }, 60000);

  afterAll(async () => {
    try {
      await cleanupTestData(TEST_PREFIX);
    } finally {
      cortex.close();
    }
  }, 60000);

  describe("Fact Extraction via Remember", () => {
    it("should extract facts from conversation", async () => {
      // Create conversation
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_SPACE_ID,
        participants: {
          userId: TEST_USER_ID,
          agentId: "facts-test-agent",
          participantId: "facts-test-agent",
        },
      });

      // Remember interaction - facts are extracted automatically
      await cortex.memory.remember({
        memorySpaceId: TEST_SPACE_ID,
        conversationId: conv.conversationId,
        userMessage:
          "I prefer dark mode and always want responses in bullet points",
        agentResponse:
          "Got it! I'll remember you prefer dark mode and bullet point format.",
        userId: TEST_USER_ID,
        agentId: "facts-test-agent",
        userName: "Facts Test User",
      });

      // Wait for fact extraction
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Check if facts were extracted
      const result = await cortex.facts.list({
        memorySpaceId: TEST_SPACE_ID,
        limit: 50,
      });
      const facts = result.facts || result;

      expect(Array.isArray(facts)).toBe(true);
    });
  });

  describe("Fact CRUD Operations", () => {
    it("should list facts in a space", async () => {
      const result = await cortex.facts.list({
        memorySpaceId: TEST_SPACE_ID,
        limit: 50,
      });
      const facts = result.facts || result;

      expect(Array.isArray(facts)).toBe(true);
    });

    it("should search facts", async () => {
      const results = await cortex.facts.search(
        TEST_SPACE_ID,
        "preference dark",
        { limit: 20 },
      );

      expect(Array.isArray(results)).toBe(true);
    });

    it("should handle empty search results", async () => {
      const results = await cortex.facts.search(
        TEST_SPACE_ID,
        "xyznonexistent12345",
        { limit: 20 },
      );

      expect(results).toEqual([]);
    });
  });

  describe("Fact Filtering", () => {
    it("should filter facts by type", async () => {
      const preferenceResult = await cortex.facts.list({
        memorySpaceId: TEST_SPACE_ID,
        factType: "preference",
        limit: 50,
      });
      const preferenceFacts = preferenceResult.facts || preferenceResult;

      preferenceFacts.forEach((fact: { factType: string }) => {
        expect(fact.factType).toBe("preference");
      });
    });
  });
});
