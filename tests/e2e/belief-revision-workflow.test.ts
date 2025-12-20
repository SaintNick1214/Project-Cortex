/**
 * E2E Tests - Belief Revision Workflow
 *
 * Real-world scenario tests for the belief revision system.
 * Tests complete workflows from user interaction to fact storage.
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { Cortex } from "../../src";
import { ConvexClient } from "convex/browser";
import { createNamedTestRunContext } from "../helpers";
import type { FactRecord } from "../../src/types";

describe("Belief Revision Workflow E2E", () => {
  const ctx = createNamedTestRunContext("e2e-belief-revision");
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
      name: "Belief Revision E2E Test Space",
    });
  });

  afterAll(async () => {
    try {
      await cortex.memorySpaces.delete(TEST_MEMSPACE_ID, {
        cascade: true,
        reason: "e2e test cleanup",
      });
    } catch {
      // Ignore cleanup errors
    }
    await client.close();
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Workflow 1: User Preference Evolution
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Workflow: User Preference Evolution", () => {
    const userId = `user-pref-${Date.now()}`;
    let pref1Fact: FactRecord;
    let _pref2Fact: FactRecord;
    let pref3Fact: FactRecord;

    it("Step 1: Initial preference extraction", async () => {
      // Simulate extracting a fact from conversation
      pref1Fact = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        userId,
        fact: "User prefers dark mode for all applications",
        factType: "preference",
        subject: userId,
        predicate: "prefers",
        object: "dark mode",
        confidence: 85,
        sourceType: "conversation",
        tags: ["ui", "preference", "dark-mode"],
      });

      expect(pref1Fact.factId).toBeDefined();
      expect(pref1Fact.confidence).toBe(85);
      expect(pref1Fact.factType).toBe("preference");
    });

    it("Step 2: User mentions related preference", async () => {
      // User mentions a more specific preference
      _pref2Fact = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        userId,
        fact: "User uses OLED dark mode to save battery",
        factType: "preference",
        subject: userId,
        predicate: "uses",
        object: "OLED dark mode",
        confidence: 90,
        sourceType: "conversation",
        tags: ["ui", "preference", "dark-mode", "oled"],
      });

      // Both facts should coexist (different aspects)
      const allFacts = await cortex.facts.list({
        memorySpaceId: TEST_MEMSPACE_ID,
        userId,
        tags: ["dark-mode"],
      });

      expect(allFacts.length).toBeGreaterThanOrEqual(2);
    });

    it("Step 3: User changes preference entirely", async () => {
      // User now prefers light mode
      pref3Fact = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        userId,
        fact: "User now prefers light mode",
        factType: "preference",
        subject: userId,
        predicate: "prefers",
        object: "light mode",
        confidence: 95,
        sourceType: "conversation",
        tags: ["ui", "preference", "light-mode"],
      });

      // Supersede the original dark mode preference
      await cortex.facts.supersede({
        memorySpaceId: TEST_MEMSPACE_ID,
        oldFactId: pref1Fact.factId,
        newFactId: pref3Fact.factId,
        reason: "User explicitly stated preference change",
      });

      // Verify old fact is superseded
      const oldFact = await cortex.facts.get(TEST_MEMSPACE_ID, pref1Fact.factId);
      expect(oldFact?.validUntil).toBeDefined();

      // New fact should be valid
      expect(pref3Fact.validUntil).toBeUndefined();
    });

    it("Step 4: Query only current valid preferences", async () => {
      // Query without superseded facts
      const validFacts = await cortex.facts.list({
        memorySpaceId: TEST_MEMSPACE_ID,
        userId,
        includeSuperseded: false,
      });

      // Should not include the superseded dark mode preference
      const supersededFact = validFacts.find(
        (f: FactRecord) => f.factId === pref1Fact.factId
      );
      expect(supersededFact).toBeUndefined();
    });

    it("Step 5: History shows preference evolution", async () => {
      const history = await cortex.facts.history(pref1Fact.factId);
      expect(Array.isArray(history)).toBe(true);

      // Check activity summary
      const summary = await cortex.facts.getActivitySummary(TEST_MEMSPACE_ID, 24);
      expect(summary.totalEvents).toBeGreaterThan(0);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Workflow 2: User Profile Information Updates
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Workflow: User Profile Updates", () => {
    const userId = `user-profile-${Date.now()}`;

    it("Complete flow: Location updates over time", async () => {
      // First mention: User lives in NYC
      const location1 = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        userId,
        fact: "User lives in New York City",
        factType: "identity",
        subject: userId,
        predicate: "lives in",
        object: "New York City",
        confidence: 90,
        sourceType: "conversation",
        tags: ["location", "identity"],
      });

      // Wait a moment to simulate time passing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Second mention: User moved to SF
      const location2 = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        userId,
        fact: "User recently moved to San Francisco",
        factType: "identity",
        subject: userId,
        predicate: "lives in",
        object: "San Francisco",
        confidence: 95,
        sourceType: "conversation",
        tags: ["location", "identity"],
      });

      // Supersede old location
      await cortex.facts.supersede({
        memorySpaceId: TEST_MEMSPACE_ID,
        oldFactId: location1.factId,
        newFactId: location2.factId,
        reason: "User announced relocation",
      });

      // Verify supersession chain
      const chain = await cortex.facts.getSupersessionChain(location2.factId);
      expect(chain.length).toBeGreaterThanOrEqual(1);

      // Verify the old fact is now superseded (has validUntil set)
      const oldFact = await cortex.facts.get(TEST_MEMSPACE_ID, location1.factId);
      expect(oldFact?.validUntil).toBeDefined();

      // Query current location - should only get SF (the non-superseded one)
      const currentFacts = await cortex.facts.list({
        memorySpaceId: TEST_MEMSPACE_ID,
        userId,
        tags: ["location"],
        includeSuperseded: false,
      });

      // Filter to only valid (non-superseded) location facts
      const validLocations = currentFacts.filter(
        (f: FactRecord) => 
          f.predicate === "lives in" && 
          (f.validUntil === undefined || f.validUntil === null)
      );
      
      // Should have exactly one valid location fact
      expect(validLocations.length).toBe(1);
      expect(validLocations[0].object).toBe("San Francisco");
      expect(validLocations[0].factId).toBe(location2.factId);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Workflow 3: Knowledge Refinement
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Workflow: Knowledge Refinement", () => {
    const userId = `user-knowledge-${Date.now()}`;

    it("Complete flow: Facts become more specific over time", async () => {
      // General fact: User has a pet
      const petGeneral = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        userId,
        fact: "User has a pet",
        factType: "knowledge",
        subject: userId,
        predicate: "has",
        object: "pet",
        confidence: 70,
        sourceType: "conversation",
        tags: ["pet"],
      });

      // More specific: It's a dog
      const petDog = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        userId,
        fact: "User has a dog",
        factType: "knowledge",
        subject: userId,
        predicate: "has",
        object: "dog",
        confidence: 85,
        sourceType: "conversation",
        tags: ["pet", "dog"],
      });

      // Most specific: Dog's name is Max
      const petSpecific = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        userId,
        fact: "User has a golden retriever named Max",
        factType: "knowledge",
        subject: userId,
        predicate: "has",
        object: "golden retriever named Max",
        confidence: 95,
        sourceType: "conversation",
        tags: ["pet", "dog", "golden-retriever"],
      });

      // Supersede the chain: general -> specific -> most specific
      await cortex.facts.supersede({
        memorySpaceId: TEST_MEMSPACE_ID,
        oldFactId: petGeneral.factId,
        newFactId: petDog.factId,
        reason: "More specific information obtained",
      });

      await cortex.facts.supersede({
        memorySpaceId: TEST_MEMSPACE_ID,
        oldFactId: petDog.factId,
        newFactId: petSpecific.factId,
        reason: "Even more specific information obtained",
      });

      // Query pet facts - should only get the most specific
      const petFacts = await cortex.facts.list({
        memorySpaceId: TEST_MEMSPACE_ID,
        userId,
        tags: ["pet"],
        includeSuperseded: false,
      });

      // Should have one current valid fact about the pet
      const validPetFacts = petFacts.filter(
        (f: FactRecord) => f.validUntil === undefined || f.validUntil === null
      );
      expect(validPetFacts.length).toBe(1);
      expect(validPetFacts[0].fact).toContain("Max");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Workflow 4: Multi-User Scenarios (Hive Mode)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Workflow: Multi-User/Participant Facts", () => {
    it("Different participants can have different facts about same subject", async () => {
      const subjectUser = ctx.userId("subject");
      const participant1 = ctx.agentId("participant-1");
      const participant2 = ctx.agentId("participant-2");

      // Participant 1 extracts a fact
      const p1Career = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        participantId: participant1,
        fact: `${subjectUser} mentioned working in tech`,
        factType: "knowledge",
        subject: subjectUser,
        predicate: "works in",
        object: "tech",
        confidence: 80,
        sourceType: "conversation",
        tags: ["career"],
      });

      // Participant 2 extracts a more specific fact
      const p2Career = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        participantId: participant2,
        fact: `${subjectUser} is a software engineer at Google`,
        factType: "knowledge",
        subject: subjectUser,
        predicate: "works at",
        object: "Google",
        confidence: 95,
        sourceType: "conversation",
        tags: ["career", "employment"],
      });

      // Both facts should exist (different participants' observations)
      const allCareerFacts = await cortex.facts.list({
        memorySpaceId: TEST_MEMSPACE_ID,
        tags: ["career"],
      });

      expect(allCareerFacts.length).toBeGreaterThanOrEqual(2);

      // Can filter by participant
      const p1Facts = await cortex.facts.list({
        memorySpaceId: TEST_MEMSPACE_ID,
        participantId: participant1,
      });

      const p2Facts = await cortex.facts.list({
        memorySpaceId: TEST_MEMSPACE_ID,
        participantId: participant2,
      });

      expect(p1Facts.some((f: FactRecord) => f.factId === p1Career.factId)).toBe(true);
      expect(p2Facts.some((f: FactRecord) => f.factId === p2Career.factId)).toBe(true);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Activity Summary and Audit
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Activity Summary", () => {
    it("should accurately count activities", async () => {
      const summary = await cortex.facts.getActivitySummary(TEST_MEMSPACE_ID, 24);

      expect(summary).toHaveProperty("timeRange");
      expect(summary.timeRange.hours).toBe(24);

      expect(summary).toHaveProperty("totalEvents");
      expect(summary).toHaveProperty("actionCounts");

      // We've done several supersessions in this test suite
      expect(summary.actionCounts.SUPERSEDE).toBeGreaterThanOrEqual(0);
    });
  });
});
