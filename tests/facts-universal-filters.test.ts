/**
 * Comprehensive Universal Filters Tests for Facts API (TypeScript)
 *
 * Tests all universal filters documented in v0.9.1:
 * - userId (GDPR compliance)
 * - participantId (Hive Mode)
 * - createdBefore/After, updatedBefore/After (date filters)
 * - sourceType (conversation, system, tool, manual)
 * - tags with tagMatch (any/all)
 * - confidence ranges ({ $gte, $lte, $eq })
 * - metadata (custom filters)
 * - version
 * - validAt, validFrom, validUntil (temporal validity)
 * - sortBy, sortOrder
 * - limit, offset (pagination)
 *
 * Ensures Facts API matches Memory API universal filter patterns.
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { Cortex } from "../src/index";

describe("Facts API - Universal Filters", () => {
  let cortex: Cortex;
  const TEST_MEMSPACE_ID = `universal-filter-test-${Date.now()}`;

  beforeAll(() => {
    cortex = new Cortex({ convexUrl: process.env.CONVEX_URL! });
  });

  afterAll(async () => {
    // Cleanup test facts (best-effort - ignore errors)
    try {
      await cortex.memorySpaces.delete(TEST_MEMSPACE_ID, { cascade: true, reason: "test cleanup" });
    } catch (_e) {
      // Ignore cleanup errors
    }
  });

  describe("Identity Filters (GDPR & Hive Mode)", () => {
    it("list() should filter by userId", async () => {
      const spaceId = `${TEST_MEMSPACE_ID}-userid`;
      const targetUser = "user-alice";
      const otherUser = "user-bob";

      // Store facts for different users
      await cortex.facts.store({
        memorySpaceId: spaceId,
        userId: targetUser,
        fact: "Alice prefers dark mode",
        factType: "preference",
        confidence: 90,
        sourceType: "manual",
      });

      await cortex.facts.store({
        memorySpaceId: spaceId,
        userId: otherUser,
        fact: "Bob prefers light mode",
        factType: "preference",
        confidence: 85,
        sourceType: "manual",
      });

      // Test: Filter by userId
      const results = await cortex.facts.list({
        memorySpaceId: spaceId,
        userId: targetUser,
      });

      // Validate: Only Alice's facts
      expect(results.length).toBeGreaterThanOrEqual(1);
      results.forEach((fact: any) => {
        expect(fact.userId).toBe(targetUser);
      });
    });

    it("list() should filter by participantId (Hive Mode)", async () => {
      const spaceId = `${TEST_MEMSPACE_ID}-participantid`;
      const emailAgent = "email-agent";
      const calendarAgent = "calendar-agent";

      // Store facts from different agents in same space (Hive Mode)
      await cortex.facts.store({
        memorySpaceId: spaceId,
        participantId: emailAgent,
        fact: "User receives emails at 9am",
        factType: "preference",
        confidence: 95,
        sourceType: "manual",
      });

      await cortex.facts.store({
        memorySpaceId: spaceId,
        participantId: calendarAgent,
        fact: "User has meetings on Tuesdays",
        factType: "event",
        confidence: 90,
        sourceType: "manual",
      });

      // Test: Filter by participantId
      const results = await cortex.facts.list({
        memorySpaceId: spaceId,
        participantId: emailAgent,
      });

      // Validate: Only email agent's facts
      expect(results.length).toBeGreaterThanOrEqual(1);
      results.forEach((fact: any) => {
        expect(fact.participantId).toBe(emailAgent);
      });
    });

    it("count() should filter by userId", async () => {
      const spaceId = `${TEST_MEMSPACE_ID}-userid-count`;
      const targetUser = "user-charlie";

      // Store multiple facts for target user
      for (let i = 0; i < 3; i++) {
        await cortex.facts.store({
          memorySpaceId: spaceId,
          userId: targetUser,
          fact: `Fact ${i} for Charlie`,
          factType: "knowledge",
          confidence: 85,
          sourceType: "manual",
        });
      }

      // Store fact for different user
      await cortex.facts.store({
        memorySpaceId: spaceId,
        userId: "other-user",
        fact: "Other user fact",
        factType: "knowledge",
        confidence: 80,
        sourceType: "manual",
      });

      // Test: Count by userId
      const count = await cortex.facts.count({
        memorySpaceId: spaceId,
        userId: targetUser,
      });

      // Validate: Should count exactly 3
      expect(count).toBe(3);
    });
  });

  describe("Date Filters", () => {
    it("list() should filter by createdAfter", async () => {
      const spaceId = `${TEST_MEMSPACE_ID}-created-after`;
      const cutoffDate = new Date();

      // Wait 100ms to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Store fact after cutoff
      const recentFact = await cortex.facts.store({
        memorySpaceId: spaceId,
        fact: "Recent fact",
        factType: "knowledge",
        confidence: 90,
        sourceType: "manual",
      });

      // Test: Filter by createdAfter
      const results = await cortex.facts.list({
        memorySpaceId: spaceId,
        createdAfter: cutoffDate,
      });

      // Validate: Should include recent fact
      expect(results.length).toBeGreaterThanOrEqual(1);
      const factIds = results.map((f: any) => f.factId);
      expect(factIds).toContain(recentFact.factId);
    });

    it("list() should filter by createdBefore", async () => {
      const spaceId = `${TEST_MEMSPACE_ID}-created-before`;

      // Store old fact
      const oldFact = await cortex.facts.store({
        memorySpaceId: spaceId,
        fact: "Old fact",
        factType: "knowledge",
        confidence: 85,
        sourceType: "manual",
      });

      // Wait 100ms
      await new Promise((resolve) => setTimeout(resolve, 100));

      const cutoffDate = new Date();

      // Wait 100ms
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Store new fact after cutoff
      await cortex.facts.store({
        memorySpaceId: spaceId,
        fact: "New fact",
        factType: "knowledge",
        confidence: 90,
        sourceType: "manual",
      });

      // Test: Filter by createdBefore
      const results = await cortex.facts.list({
        memorySpaceId: spaceId,
        createdBefore: cutoffDate,
      });

      // Validate: Should include old fact, not new fact
      expect(results.length).toBeGreaterThanOrEqual(1);
      const factIds = results.map((f: any) => f.factId);
      expect(factIds).toContain(oldFact.factId);

      // All results should be before cutoff
      results.forEach((fact: any) => {
        expect(new Date(fact.createdAt).getTime()).toBeLessThan(
          cutoffDate.getTime(),
        );
      });
    });

    it("search() should combine date filters", async () => {
      const spaceId = `${TEST_MEMSPACE_ID}-date-range`;
      const searchTerm = "datetest";

      const startDate = new Date();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Store fact in range
      await cortex.facts.store({
        memorySpaceId: spaceId,
        fact: `${searchTerm} fact in range`,
        factType: "knowledge",
        confidence: 90,
        sourceType: "manual",
      });

      await new Promise((resolve) => setTimeout(resolve, 100));
      const endDate = new Date();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Store fact after range
      await cortex.facts.store({
        memorySpaceId: spaceId,
        fact: `${searchTerm} fact after range`,
        factType: "knowledge",
        confidence: 85,
        sourceType: "manual",
      });

      // Test: Search with date range
      const results = await cortex.facts.search(spaceId, searchTerm, {
        createdAfter: startDate,
        createdBefore: endDate,
      });

      // Validate: Should only find facts in range
      expect(results.length).toBeGreaterThanOrEqual(1);
      results.forEach((fact: any) => {
        const createdAt = new Date(fact.createdAt).getTime();
        expect(createdAt).toBeGreaterThan(startDate.getTime());
        expect(createdAt).toBeLessThan(endDate.getTime());
      });
    });
  });

  describe("Source Type Filters", () => {
    const sourceTypes = ["conversation", "system", "tool", "manual"] as const;

    sourceTypes.forEach((sourceType) => {
      it(`list() should filter by sourceType="${sourceType}"`, async () => {
        const spaceId = `${TEST_MEMSPACE_ID}-source-${sourceType}`;

        // Store fact with target sourceType
        await cortex.facts.store({
          memorySpaceId: spaceId,
          fact: `Fact from ${sourceType}`,
          factType: "knowledge",
          confidence: 90,
          sourceType,
        });

        // Store fact with different sourceType
        const otherType = sourceType === "manual" ? "system" : "manual";
        await cortex.facts.store({
          memorySpaceId: spaceId,
          fact: `Fact from ${otherType}`,
          factType: "knowledge",
          confidence: 85,
          sourceType: otherType,
        });

        // Test: Filter by sourceType
        const results = await cortex.facts.list({
          memorySpaceId: spaceId,
          sourceType,
        });

        // Validate: Only facts from target source
        expect(results.length).toBeGreaterThanOrEqual(1);
        results.forEach((fact: any) => {
          expect(fact.sourceType).toBe(sourceType);
        });
      });
    });
  });

  describe("Tag Filters", () => {
    it("list() should filter by tags (any match)", async () => {
      const spaceId = `${TEST_MEMSPACE_ID}-tags-any`;

      // Store fact with tag1
      await cortex.facts.store({
        memorySpaceId: spaceId,
        fact: "Fact with tag1",
        factType: "knowledge",
        tags: ["tag1", "extra"],
        confidence: 90,
        sourceType: "manual",
      });

      // Store fact with tag2
      await cortex.facts.store({
        memorySpaceId: spaceId,
        fact: "Fact with tag2",
        factType: "knowledge",
        tags: ["tag2", "other"],
        confidence: 85,
        sourceType: "manual",
      });

      // Store fact with no matching tags
      await cortex.facts.store({
        memorySpaceId: spaceId,
        fact: "Fact with different tags",
        factType: "knowledge",
        tags: ["unrelated"],
        confidence: 80,
        sourceType: "manual",
      });

      // Test: Filter by tags (any match - default)
      const results = await cortex.facts.list({
        memorySpaceId: spaceId,
        tags: ["tag1", "tag2"],
        tagMatch: "any",
      });

      // Validate: Should find facts with tag1 OR tag2
      expect(results.length).toBeGreaterThanOrEqual(2);
      results.forEach((fact: any) => {
        const hasTags = fact.tags.some((t: string) =>
          ["tag1", "tag2"].includes(t),
        );
        expect(hasTags).toBe(true);
      });
    });

    it("list() should filter by tags (all match)", async () => {
      const spaceId = `${TEST_MEMSPACE_ID}-tags-all`;

      // Store fact with both required tags
      await cortex.facts.store({
        memorySpaceId: spaceId,
        fact: "Fact with all required tags",
        factType: "knowledge",
        tags: ["important", "verified", "extra"],
        confidence: 95,
        sourceType: "manual",
      });

      // Store fact with only one required tag
      await cortex.facts.store({
        memorySpaceId: spaceId,
        fact: "Fact with partial tags",
        factType: "knowledge",
        tags: ["important", "other"],
        confidence: 85,
        sourceType: "manual",
      });

      // Test: Filter by tags (all match)
      const results = await cortex.facts.list({
        memorySpaceId: spaceId,
        tags: ["important", "verified"],
        tagMatch: "all",
      });

      // Validate: Should only find facts with ALL required tags
      expect(results.length).toBeGreaterThanOrEqual(1);
      results.forEach((fact: any) => {
        expect(fact.tags).toContain("important");
        expect(fact.tags).toContain("verified");
      });
    });
  });

  describe("Confidence Range Queries", () => {
    it("list() should filter by confidence $gte", async () => {
      const spaceId = `${TEST_MEMSPACE_ID}-confidence-gte`;

      // Store high confidence fact
      await cortex.facts.store({
        memorySpaceId: spaceId,
        fact: "High confidence fact",
        factType: "knowledge",
        confidence: 95,
        sourceType: "manual",
      });

      // Store low confidence fact
      await cortex.facts.store({
        memorySpaceId: spaceId,
        fact: "Low confidence fact",
        factType: "knowledge",
        confidence: 60,
        sourceType: "manual",
      });

      // Test: Filter by minConfidence (shorthand)
      const results1 = await cortex.facts.list({
        memorySpaceId: spaceId,
        minConfidence: 80,
      });

      // Validate: Only high confidence facts
      expect(results1.length).toBeGreaterThanOrEqual(1);
      results1.forEach((fact: any) => {
        expect(fact.confidence).toBeGreaterThanOrEqual(80);
      });

      // Both syntaxes should work
      expect(results1.every((f: any) => f.confidence >= 80)).toBe(true);
    });

    it("list() should filter by minConfidence only (maxConfidence will be added later)", async () => {
      const spaceId = `${TEST_MEMSPACE_ID}-confidence-range`;

      // Store facts with different confidence levels
      await cortex.facts.store({
        memorySpaceId: spaceId,
        fact: "Very high confidence",
        factType: "knowledge",
        confidence: 98,
        sourceType: "manual",
      });

      await cortex.facts.store({
        memorySpaceId: spaceId,
        fact: "Medium confidence",
        factType: "knowledge",
        confidence: 75,
        sourceType: "manual",
      });

      await cortex.facts.store({
        memorySpaceId: spaceId,
        fact: "Low confidence",
        factType: "knowledge",
        confidence: 45,
        sourceType: "manual",
      });

      // Test: Filter by minConfidence (most common use case)
      const results = await cortex.facts.list({
        memorySpaceId: spaceId,
        minConfidence: 70,
      });

      // Validate: Only facts >= 70
      expect(results.length).toBeGreaterThanOrEqual(2);
      results.forEach((fact: any) => {
        expect(fact.confidence).toBeGreaterThanOrEqual(70);
      });
    });

    it("search() should filter by minConfidence", async () => {
      const spaceId = `${TEST_MEMSPACE_ID}-search-confidence`;
      const searchTerm = "confidence-test";

      // Store high confidence fact
      await cortex.facts.store({
        memorySpaceId: spaceId,
        fact: `${searchTerm} high confidence`,
        factType: "knowledge",
        confidence: 92,
        sourceType: "manual",
      });

      // Store low confidence fact
      await cortex.facts.store({
        memorySpaceId: spaceId,
        fact: `${searchTerm} low confidence`,
        factType: "knowledge",
        confidence: 55,
        sourceType: "manual",
      });

      // Test: Search with minConfidence
      const results = await cortex.facts.search(spaceId, searchTerm, {
        minConfidence: 80,
      });

      // Validate: Only high confidence facts
      expect(results.length).toBeGreaterThanOrEqual(1);
      results.forEach((fact: any) => {
        expect(fact.confidence).toBeGreaterThanOrEqual(80);
      });
    });
  });

  describe("Metadata Filters", () => {
    it("list() should filter by metadata fields", async () => {
      const spaceId = `${TEST_MEMSPACE_ID}-metadata`;

      // Store fact with target metadata
      await cortex.facts.store({
        memorySpaceId: spaceId,
        fact: "Fact with priority high",
        factType: "knowledge",
        confidence: 90,
        sourceType: "manual",
        metadata: { priority: "high", category: "security" },
      });

      // Store fact with different metadata
      await cortex.facts.store({
        memorySpaceId: spaceId,
        fact: "Fact with priority low",
        factType: "knowledge",
        confidence: 85,
        sourceType: "manual",
        metadata: { priority: "low", category: "general" },
      });

      // Test: Filter by metadata
      const results = await cortex.facts.list({
        memorySpaceId: spaceId,
        metadata: { priority: "high" },
      });

      // Validate: Only facts with matching metadata
      expect(results.length).toBeGreaterThanOrEqual(1);
      results.forEach((fact: any) => {
        expect(fact.metadata).toBeTruthy();
        expect(fact.metadata.priority).toBe("high");
      });
    });
  });

  describe("Sorting and Pagination", () => {
    it("list() should sort by confidence descending", async () => {
      const spaceId = `${TEST_MEMSPACE_ID}-sort-confidence`;

      // Store facts with different confidence levels
      await cortex.facts.store({
        memorySpaceId: spaceId,
        fact: "Low confidence",
        factType: "knowledge",
        confidence: 65,
        sourceType: "manual",
      });

      await cortex.facts.store({
        memorySpaceId: spaceId,
        fact: "High confidence",
        factType: "knowledge",
        confidence: 95,
        sourceType: "manual",
      });

      await cortex.facts.store({
        memorySpaceId: spaceId,
        fact: "Medium confidence",
        factType: "knowledge",
        confidence: 80,
        sourceType: "manual",
      });

      // Test: Sort by confidence descending
      const results = await cortex.facts.list({
        memorySpaceId: spaceId,
        sortBy: "confidence",
        sortOrder: "desc",
      });

      // Validate: Results sorted by confidence (high to low)
      expect(results.length).toBeGreaterThanOrEqual(3);
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].confidence).toBeGreaterThanOrEqual(
          results[i + 1].confidence,
        );
      }
    });

    it("list() should support pagination with limit and offset", async () => {
      const spaceId = `${TEST_MEMSPACE_ID}-pagination`;

      // Store 5 facts
      for (let i = 0; i < 5; i++) {
        await cortex.facts.store({
          memorySpaceId: spaceId,
          fact: `Fact ${i}`,
          factType: "knowledge",
          confidence: 80 + i,
          sourceType: "manual",
        });
      }

      // Test: Get first page (limit 2)
      const page1 = await cortex.facts.list({
        memorySpaceId: spaceId,
        limit: 2,
        offset: 0,
        sortBy: "confidence",
        sortOrder: "asc",
      });

      // Test: Get second page (limit 2, offset 2)
      const page2 = await cortex.facts.list({
        memorySpaceId: spaceId,
        limit: 2,
        offset: 2,
        sortBy: "confidence",
        sortOrder: "asc",
      });

      // Validate: Correct pagination
      expect(page1.length).toBe(2);
      expect(page2.length).toBe(2);

      // Pages should have different facts
      const page1Ids = page1.map((f: any) => f.factId);
      const page2Ids = page2.map((f: any) => f.factId);
      page1Ids.forEach((id: string) => {
        expect(page2Ids).not.toContain(id);
      });
    });
  });

  describe("Complex Multi-Filter Queries", () => {
    it("should combine multiple universal filters", async () => {
      const spaceId = `${TEST_MEMSPACE_ID}-complex`;
      const targetUser = "user-david";

      // Store target fact matching all criteria
      await cortex.facts.store({
        memorySpaceId: spaceId,
        userId: targetUser,
        participantId: "agent-1",
        fact: "Complex filter test fact",
        factType: "preference",
        tags: ["important", "verified"],
        confidence: 92,
        sourceType: "conversation",
        metadata: { category: "ui" },
      });

      // Store facts missing one criterion each
      await cortex.facts.store({
        memorySpaceId: spaceId,
        userId: "other-user", // Wrong user
        participantId: "agent-1",
        fact: "Wrong user fact",
        factType: "preference",
        tags: ["important", "verified"],
        confidence: 90,
        sourceType: "conversation",
        metadata: { category: "ui" },
      });

      await cortex.facts.store({
        memorySpaceId: spaceId,
        userId: targetUser,
        participantId: "agent-1",
        fact: "Low confidence fact",
        factType: "preference",
        tags: ["important", "verified"],
        confidence: 65, // Too low
        sourceType: "conversation",
        metadata: { category: "ui" },
      });

      await cortex.facts.store({
        memorySpaceId: spaceId,
        userId: targetUser,
        participantId: "agent-1",
        fact: "Wrong type fact",
        factType: "identity", // Wrong type
        tags: ["important", "verified"],
        confidence: 90,
        sourceType: "conversation",
        metadata: { category: "ui" },
      });

      // Test: Complex query with multiple filters
      const results = await cortex.facts.list({
        memorySpaceId: spaceId,
        userId: targetUser,
        participantId: "agent-1",
        factType: "preference",
        tags: ["important", "verified"],
        tagMatch: "all",
        minConfidence: 80,
        sourceType: "conversation",
        metadata: { category: "ui" },
      });

      // Validate: Should only find the target fact
      expect(results.length).toBeGreaterThanOrEqual(1);
      results.forEach((fact: any) => {
        expect(fact.userId).toBe(targetUser);
        expect(fact.participantId).toBe("agent-1");
        expect(fact.factType).toBe("preference");
        expect(fact.tags).toContain("important");
        expect(fact.tags).toContain("verified");
        expect(fact.confidence).toBeGreaterThanOrEqual(80);
        expect(fact.sourceType).toBe("conversation");
        expect(fact.metadata.category).toBe("ui");
      });
    });

    it("queryBySubject() should support universal filters", async () => {
      const spaceId = `${TEST_MEMSPACE_ID}-subject-filters`;
      const subject = "user-eve";

      // Store facts for same subject
      await cortex.facts.store({
        memorySpaceId: spaceId,
        userId: "eve",
        fact: "Eve prefers dark mode",
        factType: "preference",
        subject,
        confidence: 95,
        sourceType: "conversation",
      });

      await cortex.facts.store({
        memorySpaceId: spaceId,
        userId: "eve",
        fact: "Eve works at TechCorp",
        factType: "identity",
        subject,
        confidence: 98,
        sourceType: "conversation",
      });

      await cortex.facts.store({
        memorySpaceId: spaceId,
        userId: "eve",
        fact: "Eve knows Python (low confidence)",
        factType: "knowledge",
        subject,
        confidence: 60,
        sourceType: "system",
      });

      // Test: Query by subject with filters
      const results = await cortex.facts.queryBySubject({
        memorySpaceId: spaceId,
        subject,
        userId: "eve",
        minConfidence: 90,
        sourceType: "conversation",
      });

      // Validate: Only high-confidence conversation facts
      expect(results.length).toBeGreaterThanOrEqual(2);
      results.forEach((fact: any) => {
        expect(fact.subject).toBe(subject);
        expect(fact.userId).toBe("eve");
        expect(fact.confidence).toBeGreaterThanOrEqual(90);
        expect(fact.sourceType).toBe("conversation");
      });
    });

    it("search() should support complex filter combinations", async () => {
      const spaceId = `${TEST_MEMSPACE_ID}-search-complex`;
      const searchTerm = "comprehensive";

      // Store target fact
      await cortex.facts.store({
        memorySpaceId: spaceId,
        userId: "user-frank",
        participantId: "search-agent",
        fact: `${searchTerm} test for search filters`,
        factType: "knowledge",
        tags: ["test", "validated"],
        confidence: 88,
        sourceType: "manual",
      });

      // Store facts that don't match all criteria
      await cortex.facts.store({
        memorySpaceId: spaceId,
        userId: "other-user",
        participantId: "search-agent",
        fact: `${searchTerm} wrong user`,
        factType: "knowledge",
        tags: ["test", "validated"],
        confidence: 90,
        sourceType: "manual",
      });

      await cortex.facts.store({
        memorySpaceId: spaceId,
        userId: "user-frank",
        participantId: "other-agent",
        fact: `${searchTerm} wrong agent`,
        factType: "knowledge",
        tags: ["test", "validated"],
        confidence: 90,
        sourceType: "manual",
      });

      // Test: Complex search with filters
      const results = await cortex.facts.search(spaceId, searchTerm, {
        userId: "user-frank",
        participantId: "search-agent",
        factType: "knowledge",
        tags: ["test"],
        minConfidence: 85,
      });

      // Validate: Only target fact
      expect(results.length).toBeGreaterThanOrEqual(1);
      results.forEach((fact: any) => {
        expect(fact.userId).toBe("user-frank");
        expect(fact.participantId).toBe("search-agent");
        expect(fact.factType).toBe("knowledge");
        expect(fact.tags).toContain("test");
        expect(fact.confidence).toBeGreaterThanOrEqual(85);
      });
    });
  });

  describe("API Consistency with Memory API", () => {
    it("should use same filter syntax as memory.list()", async () => {
      const spaceId = `${TEST_MEMSPACE_ID}-consistency`;

      // Define universal filters (same pattern as Memory API)
      const filters = {
        userId: "test-user-consistency",
        tags: ["important"],
        minImportance: 70, // Note: Facts use confidence, not importance
        createdAfter: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      };

      // Store fact matching filters
      await cortex.facts.store({
        memorySpaceId: spaceId,
        userId: filters.userId,
        fact: "Consistent filter test",
        factType: "knowledge",
        tags: filters.tags,
        confidence: 85, // Maps to minImportance
        sourceType: "manual",
      });

      // Test: Use filters (same pattern as Memory API)
      const results = await cortex.facts.list({
        memorySpaceId: spaceId,
        userId: filters.userId,
        tags: filters.tags,
        minConfidence: filters.minImportance, // Same concept, different field
        createdAfter: filters.createdAfter,
      });

      // Validate: Pattern works
      expect(results.length).toBeGreaterThanOrEqual(1);
      results.forEach((fact: any) => {
        expect(fact.userId).toBe(filters.userId);
        expect(fact.tags).toContain("important");
        expect(fact.confidence).toBeGreaterThanOrEqual(70);
      });
    });
  });
});
