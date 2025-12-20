/**
 * E2E Tests: Facts API (Layer 3)
 *
 * Tests validate:
 * - SDK API calls
 * - Convex mutations/queries
 * - Fact storage and versioning
 * - Graph-like relationships
 * - Memory space isolation
 *
 * PARALLEL-SAFE: Uses TestRunContext for isolated test data
 */

import { Cortex } from "../src";
import { ConvexClient } from "convex/browser";
import { api } from "../convex-dev/_generated/api";
import { createNamedTestRunContext, ScopedCleanup } from "./helpers";

describe("Facts API (Layer 3)", () => {
  // Create unique test run context for parallel-safe execution
  const ctx = createNamedTestRunContext("facts");

  let cortex: Cortex;
  let client: ConvexClient;
  let scopedCleanup: ScopedCleanup;
  const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";

  // Use context generator for test memory space ID
  const TEST_MEMSPACE_ID = ctx.memorySpaceId("test");

  beforeAll(async () => {
    console.log(`\n🧪 Facts API Tests - Run ID: ${ctx.runId}\n`);

    cortex = new Cortex({ convexUrl: CONVEX_URL });
    client = new ConvexClient(CONVEX_URL);
    scopedCleanup = new ScopedCleanup(client, ctx);

    // Note: No global purge - test data is isolated by prefix
    console.log("✅ Test isolation setup complete\n");
  });

  afterAll(async () => {
    // Clean up only data created by this test run
    console.log(`\n🧹 Cleaning up test run ${ctx.runId}...`);
    await scopedCleanup.cleanupAll();
    await client.close();
    console.log(`✅ Test run ${ctx.runId} cleanup complete\n`);
  });

  describe("store()", () => {
    it("stores a preference fact", async () => {
      const fact = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "User prefers dark mode for UI",
        factType: "preference",
        subject: "user-123",
        predicate: "prefers",
        object: "dark-mode",
        confidence: 95,
        sourceType: "conversation",
        tags: ["ui", "theme"],
      });

      expect(fact.factId).toMatch(/^fact-/);
      expect(fact.memorySpaceId).toBe(TEST_MEMSPACE_ID);
      expect(fact.fact).toBe("User prefers dark mode for UI");
      expect(fact.factType).toBe("preference");
      expect(fact.subject).toBe("user-123");
      expect(fact.confidence).toBe(95);
      expect(fact.version).toBe(1);
      expect(fact.supersededBy).toBeUndefined();
    });

    it("stores a knowledge fact with source reference", async () => {
      const fact = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "API password for production is SecurePass123",
        factType: "knowledge",
        subject: "production-api",
        confidence: 90,
        sourceType: "conversation",
        sourceRef: {
          conversationId: "conv-123",
          messageIds: ["msg-1", "msg-2"],
        },
        tags: ["password", "production", "api"],
      });

      expect(fact.factType).toBe("knowledge");
      expect(fact.sourceRef).toBeDefined();
      expect(fact.sourceRef!.conversationId).toBe("conv-123");
      expect(fact.tags).toContain("password");
    });

    it("stores a relationship fact (graph triple)", async () => {
      const fact = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "Alice works at Acme Corp",
        factType: "relationship",
        subject: "user-alice",
        predicate: "works_at",
        object: "company-acme",
        confidence: 100,
        sourceType: "manual",
        tags: ["employment", "relationship"],
      });

      expect(fact.factType).toBe("relationship");
      expect(fact.subject).toBe("user-alice");
      expect(fact.predicate).toBe("works_at");
      expect(fact.object).toBe("company-acme");
    });

    it("supports Hive Mode with participantId", async () => {
      const fact = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        participantId: "tool-extractor-1",
        fact: "User has completed onboarding",
        factType: "event",
        subject: "user-456",
        confidence: 100,
        sourceType: "tool",
        tags: ["onboarding", "milestone"],
      });

      expect(fact.participantId).toBe("tool-extractor-1");
      expect(fact.factType).toBe("event");
    });
  });

  describe("get()", () => {
    let testFactId: string;

    beforeAll(async () => {
      const fact = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "Test fact for retrieval",
        factType: "knowledge",
        confidence: 85,
        sourceType: "system",
        tags: ["test"],
      });

      testFactId = fact.factId;
    });

    it("retrieves existing fact", async () => {
      const fact = await cortex.facts.get(TEST_MEMSPACE_ID, testFactId);

      expect(fact).not.toBeNull();
      expect(fact!.factId).toBe(testFactId);
      expect(fact!.fact).toBe("Test fact for retrieval");
    });

    it("returns null for non-existent fact", async () => {
      const fact = await cortex.facts.get(
        TEST_MEMSPACE_ID,
        "fact-does-not-exist",
      );

      expect(fact).toBeNull();
    });

    it("returns null for fact in different memory space", async () => {
      const fact = await cortex.facts.get("memspace-other", testFactId);

      expect(fact).toBeNull(); // Isolation
    });
  });

  describe("list()", () => {
    beforeAll(async () => {
      // Create diverse facts
      await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "User prefers email notifications",
        factType: "preference",
        subject: "user-list",
        confidence: 90,
        sourceType: "conversation",
        tags: ["notifications", "email"],
      });

      await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "User's name is John Doe",
        factType: "identity",
        subject: "user-list",
        confidence: 100,
        sourceType: "system",
        tags: ["identity", "name"],
      });

      await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "System version is 2.1.0",
        factType: "knowledge",
        confidence: 100,
        sourceType: "system",
        tags: ["version", "system"],
      });
    });

    it("lists all facts for memory space", async () => {
      const facts = await cortex.facts.list({
        memorySpaceId: TEST_MEMSPACE_ID,
      });

      expect(facts.length).toBeGreaterThanOrEqual(3);
      facts.forEach((f) => {
        expect(f.memorySpaceId).toBe(TEST_MEMSPACE_ID);
      });
    });

    it("filters by factType", async () => {
      const prefs = await cortex.facts.list({
        memorySpaceId: TEST_MEMSPACE_ID,
        factType: "preference",
      });

      expect(prefs.length).toBeGreaterThanOrEqual(1);
      prefs.forEach((f) => {
        expect(f.factType).toBe("preference");
      });
    });

    it("filters by subject", async () => {
      const userFacts = await cortex.facts.list({
        memorySpaceId: TEST_MEMSPACE_ID,
        subject: "user-list",
      });

      expect(userFacts.length).toBeGreaterThanOrEqual(2);
      userFacts.forEach((f) => {
        expect(f.subject).toBe("user-list");
      });
    });

    it("filters by tags", async () => {
      const notificationFacts = await cortex.facts.list({
        memorySpaceId: TEST_MEMSPACE_ID,
        tags: ["notifications"],
      });

      expect(notificationFacts.length).toBeGreaterThanOrEqual(1);
      notificationFacts.forEach((f) => {
        expect(f.tags).toContain("notifications");
      });
    });

    it("respects limit parameter", async () => {
      const limited = await cortex.facts.list({
        memorySpaceId: TEST_MEMSPACE_ID,
        limit: 2,
      });

      expect(limited.length).toBeLessThanOrEqual(2);
    });

    it("excludes superseded facts by default", async () => {
      const uniqueTag = `supersede-${Date.now()}`;

      const original = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "Old version",
        factType: "knowledge",
        confidence: 80,
        sourceType: "system",
        tags: [uniqueTag],
      });

      // Update it (supersedes original)
      await cortex.facts.update(TEST_MEMSPACE_ID, original.factId, {
        fact: "New version",
        confidence: 95,
      });

      const current = await cortex.facts.list({
        memorySpaceId: TEST_MEMSPACE_ID,
        tags: [uniqueTag],
      });

      // Should only see latest version
      expect(current.length).toBeGreaterThanOrEqual(1);
      expect(
        current.some((f) => f.fact === "New version" && f.version === 2),
      ).toBe(true);
      // Original should not be in list (superseded)
      expect(
        current.some(
          (f) => f.fact === "Old version" && f.supersededBy !== undefined,
        ),
      ).toBe(false);
    });

    it("includes superseded when requested", async () => {
      const uniqueTag = `supersede-incl-${Date.now()}`;

      const original = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "Old version 2",
        factType: "knowledge",
        confidence: 80,
        sourceType: "system",
        tags: [uniqueTag],
      });

      await cortex.facts.update(TEST_MEMSPACE_ID, original.factId, {
        fact: "New version 2",
        confidence: 95,
      });

      const all = await cortex.facts.list({
        memorySpaceId: TEST_MEMSPACE_ID,
        tags: [uniqueTag],
        includeSuperseded: true,
      });

      expect(all.length).toBeGreaterThanOrEqual(2); // Both versions
    });
  });

  describe("count()", () => {
    it("counts all facts", async () => {
      const count = await cortex.facts.count({
        memorySpaceId: TEST_MEMSPACE_ID,
      });

      expect(count).toBeGreaterThanOrEqual(3);
    });

    it("counts by factType", async () => {
      const prefCount = await cortex.facts.count({
        memorySpaceId: TEST_MEMSPACE_ID,
        factType: "preference",
      });

      expect(prefCount).toBeGreaterThanOrEqual(1);
    });

    it("excludes superseded by default", async () => {
      const active = await cortex.facts.count({
        memorySpaceId: TEST_MEMSPACE_ID,
      });

      const all = await cortex.facts.count({
        memorySpaceId: TEST_MEMSPACE_ID,
        includeSuperseded: true,
      });

      expect(all).toBeGreaterThan(active); // Superseded facts exist
    });
  });

  describe("search()", () => {
    beforeAll(async () => {
      await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "The database password is DbSecret456",
        factType: "knowledge",
        confidence: 95,
        sourceType: "conversation",
        tags: ["password", "database"],
      });

      await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "User enjoys reading science fiction books",
        factType: "preference",
        confidence: 90,
        sourceType: "conversation",
        tags: ["hobbies", "books"],
      });
    });

    it("finds facts using keyword search", async () => {
      const results = await cortex.facts.search(TEST_MEMSPACE_ID, "password");

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((f) => f.fact.includes("password"))).toBe(true);
    });

    it("filters by factType", async () => {
      const prefs = await cortex.facts.search(TEST_MEMSPACE_ID, "user", {
        factType: "preference",
      });

      expect(prefs.length).toBeGreaterThanOrEqual(1);
      prefs.forEach((f) => {
        expect(f.factType).toBe("preference");
      });
    });

    it("filters by minConfidence", async () => {
      const highConf = await cortex.facts.search(TEST_MEMSPACE_ID, "password", {
        minConfidence: 90,
      });

      highConf.forEach((f) => {
        expect(f.confidence).toBeGreaterThanOrEqual(90);
      });
    });

    it("filters by tags", async () => {
      const dbFacts = await cortex.facts.search(TEST_MEMSPACE_ID, "password", {
        tags: ["database"],
      });

      dbFacts.forEach((f) => {
        expect(f.tags).toContain("database");
      });
    });

    it("respects limit", async () => {
      const limited = await cortex.facts.search(TEST_MEMSPACE_ID, "user", {
        limit: 1,
      });

      expect(limited.length).toBeLessThanOrEqual(1);
    });
  });

  describe("update()", () => {
    let originalFactId: string;

    beforeAll(async () => {
      const fact = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "Original fact statement",
        factType: "knowledge",
        confidence: 80,
        sourceType: "system",
        tags: ["update-test"],
      });

      originalFactId = fact.factId;
    });

    it("creates new version when updated", async () => {
      const updated = await cortex.facts.update(
        TEST_MEMSPACE_ID,
        originalFactId,
        {
          fact: "Updated fact statement",
          confidence: 95,
        },
      );

      expect(updated.fact).toBe("Updated fact statement");
      expect(updated.confidence).toBe(95);
      expect(updated.version).toBe(2);
      expect(updated.supersedes).toBe(originalFactId);
    });

    it("marks original as superseded", async () => {
      const original = await cortex.facts.get(TEST_MEMSPACE_ID, originalFactId);

      expect(original).not.toBeNull();
      expect(original!.supersededBy).toBeDefined();
      expect(original!.validUntil).toBeDefined();
    });

    it("throws error for non-existent fact", async () => {
      await expect(
        cortex.facts.update(TEST_MEMSPACE_ID, "fact-does-not-exist", {
          fact: "New fact",
        }),
      ).rejects.toThrow("FACT_NOT_FOUND");
    });

    it("prevents updating other memory space's facts", async () => {
      await expect(
        cortex.facts.update("memspace-other", originalFactId, {
          fact: "Unauthorized update",
        }),
      ).rejects.toThrow("PERMISSION_DENIED");
    });
  });

  describe("delete()", () => {
    it("soft deletes a fact", async () => {
      const fact = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "Fact to delete",
        factType: "knowledge",
        confidence: 80,
        sourceType: "system",
        tags: ["delete-test"],
      });

      const result = await cortex.facts.delete(TEST_MEMSPACE_ID, fact.factId);

      expect(result.deleted).toBe(true);
      expect(result.factId).toBe(fact.factId);

      // Verify it's marked invalid
      const deleted = await cortex.facts.get(TEST_MEMSPACE_ID, fact.factId);

      expect(deleted).not.toBeNull();
      expect(deleted!.validUntil).toBeDefined();
    });

    it("throws error for non-existent fact", async () => {
      await expect(
        cortex.facts.delete(TEST_MEMSPACE_ID, "fact-does-not-exist"),
      ).rejects.toThrow("FACT_NOT_FOUND");
    });

    it("prevents deleting other memory space's facts", async () => {
      const fact = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "Protected fact",
        factType: "knowledge",
        confidence: 80,
        sourceType: "system",
        tags: ["protected"],
      });

      await expect(
        cortex.facts.delete("memspace-other", fact.factId),
      ).rejects.toThrow("PERMISSION_DENIED");
    });
  });

  describe("getHistory()", () => {
    let factId: string;

    beforeAll(async () => {
      const v1 = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "Version 1",
        factType: "knowledge",
        confidence: 70,
        sourceType: "system",
        tags: ["history-test"],
      });

      factId = v1.factId;

      const v2 = await cortex.facts.update(TEST_MEMSPACE_ID, factId, {
        fact: "Version 2",
        confidence: 85,
      });

      await cortex.facts.update(TEST_MEMSPACE_ID, v2.factId, {
        fact: "Version 3",
        confidence: 95,
      });
    });

    it("returns complete version history", async () => {
      const history = await cortex.facts.getHistory(TEST_MEMSPACE_ID, factId);

      expect(history.length).toBeGreaterThanOrEqual(3);
      expect(history[0].fact).toBe("Version 1");
      // Later versions may have different order due to test timing
      expect(history.some((f) => f.fact === "Version 2")).toBe(true);
      expect(history.some((f) => f.fact === "Version 3")).toBe(true);
    });

    it("returns empty for non-existent fact", async () => {
      const history = await cortex.facts.getHistory(
        TEST_MEMSPACE_ID,
        "fact-does-not-exist",
      );

      expect(history).toEqual([]);
    });

    it("respects memory space isolation", async () => {
      const history = await cortex.facts.getHistory("memspace-other", factId);

      expect(history).toEqual([]);
    });
  });

  describe("queryBySubject()", () => {
    beforeAll(async () => {
      await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "Bob prefers morning meetings",
        factType: "preference",
        subject: "user-bob",
        confidence: 90,
        sourceType: "conversation",
        tags: ["meetings"],
      });

      await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "Bob lives in San Francisco",
        factType: "identity",
        subject: "user-bob",
        confidence: 100,
        sourceType: "system",
        tags: ["location"],
      });

      await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "Bob knows Python programming",
        factType: "knowledge",
        subject: "user-bob",
        confidence: 95,
        sourceType: "conversation",
        tags: ["skills"],
      });
    });

    it("returns all facts about a subject", async () => {
      const bobFacts = await cortex.facts.queryBySubject({
        memorySpaceId: TEST_MEMSPACE_ID,
        subject: "user-bob",
      });

      expect(bobFacts.length).toBeGreaterThanOrEqual(3);
      bobFacts.forEach((f) => {
        expect(f.subject).toBe("user-bob");
      });
    });

    it("filters by factType", async () => {
      const bobPrefs = await cortex.facts.queryBySubject({
        memorySpaceId: TEST_MEMSPACE_ID,
        subject: "user-bob",
        factType: "preference",
      });

      expect(bobPrefs.length).toBeGreaterThanOrEqual(1);
      expect(bobPrefs.some((f) => f.fact.includes("morning meetings"))).toBe(
        true,
      );
    });
  });

  describe("queryByRelationship()", () => {
    beforeAll(async () => {
      await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "Charlie works at Google",
        factType: "relationship",
        subject: "user-charlie",
        predicate: "works_at",
        object: "company-google",
        confidence: 100,
        sourceType: "conversation",
        tags: ["employment"],
      });

      await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "Charlie lives in New York",
        factType: "relationship",
        subject: "user-charlie",
        predicate: "lives_in",
        object: "city-nyc",
        confidence: 100,
        sourceType: "system",
        tags: ["location"],
      });
    });

    it("returns facts matching subject and predicate", async () => {
      const employment = await cortex.facts.queryByRelationship({
        memorySpaceId: TEST_MEMSPACE_ID,
        subject: "user-charlie",
        predicate: "works_at",
      });

      expect(employment.length).toBeGreaterThanOrEqual(1);
      expect(employment.some((f) => f.object === "company-google")).toBe(true);
    });

    it("supports graph-like traversal", async () => {
      const location = await cortex.facts.queryByRelationship({
        memorySpaceId: TEST_MEMSPACE_ID,
        subject: "user-charlie",
        predicate: "lives_in",
      });

      expect(location.length).toBeGreaterThanOrEqual(1);
      expect(location.some((f) => f.object === "city-nyc")).toBe(true);
    });
  });

  describe("export()", () => {
    it("exports to JSON format", async () => {
      const exported = await cortex.facts.export({
        memorySpaceId: TEST_MEMSPACE_ID,
        format: "json",
      });

      expect(exported.format).toBe("json");
      expect(exported.count).toBeGreaterThan(0);
      expect(exported.data).toBeTruthy();

      const parsed = JSON.parse(exported.data);

      expect(Array.isArray(parsed)).toBe(true);
    });

    it("exports to JSON-LD format", async () => {
      const exported = await cortex.facts.export({
        memorySpaceId: TEST_MEMSPACE_ID,
        format: "jsonld",
      });

      expect(exported.format).toBe("jsonld");
      expect(exported.data).toContain("@context");
      expect(exported.data).toContain("@graph");

      const parsed = JSON.parse(exported.data);

      expect(parsed["@context"]).toBe("https://schema.org/");
      expect(Array.isArray(parsed["@graph"])).toBe(true);
    });

    it("exports to CSV format", async () => {
      const exported = await cortex.facts.export({
        memorySpaceId: TEST_MEMSPACE_ID,
        format: "csv",
      });

      expect(exported.format).toBe("csv");
      expect(exported.data).toContain("factId");
      expect(exported.data).toContain("fact");

      const lines = exported.data.split("\n");

      expect(lines.length).toBeGreaterThan(1); // Header + data
    });

    it("filters by factType", async () => {
      const prefs = await cortex.facts.export({
        memorySpaceId: TEST_MEMSPACE_ID,
        format: "json",
        factType: "preference",
      });

      const parsed = JSON.parse(prefs.data);

      parsed.forEach((f: any) => {
        expect(f.factType).toBe("preference");
      });
    });
  });

  describe("consolidate()", () => {
    it("merges duplicate facts", async () => {
      const fact1 = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "User prefers dark theme",
        factType: "preference",
        subject: "user-dup",
        confidence: 80,
        sourceType: "conversation",
        tags: ["theme"],
      });

      const fact2 = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "User likes dark mode",
        factType: "preference",
        subject: "user-dup",
        confidence: 90,
        sourceType: "conversation",
        tags: ["theme"],
      });

      const fact3 = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "User prefers dark theme for UI",
        factType: "preference",
        subject: "user-dup",
        confidence: 95,
        sourceType: "conversation",
        tags: ["theme"],
      });

      const result = await cortex.facts.consolidate({
        memorySpaceId: TEST_MEMSPACE_ID,
        factIds: [fact1.factId, fact2.factId, fact3.factId],
        keepFactId: fact3.factId, // Keep highest confidence
      });

      expect(result.consolidated).toBe(true);
      expect(result.keptFactId).toBe(fact3.factId);
      expect(result.mergedCount).toBe(2);

      // Allow time for Convex to commit mutations
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify others marked as superseded
      const fact1After = await cortex.facts.get(TEST_MEMSPACE_ID, fact1.factId);

      expect(fact1After!.supersededBy).toBe(fact3.factId);
    });

    it("updates confidence of kept fact", async () => {
      const facts = await cortex.facts.list({
        memorySpaceId: TEST_MEMSPACE_ID,
        subject: "user-dup",
        tags: ["theme"],
        includeSuperseded: false,
      });

      // Only kept fact should remain active
      expect(facts.length).toBeGreaterThanOrEqual(1);
      // Confidence should be averaged
      expect(facts.some((f) => f.confidence > 80)).toBe(true);
    });

    describe("Error Handling", () => {
      it("should handle non-existent factIds gracefully", async () => {
        // Create one real fact
        const realFact = await cortex.facts.store({
          memorySpaceId: TEST_MEMSPACE_ID,
          fact: "Real fact for consolidation error test",
          factType: "knowledge",
          confidence: 80,
          sourceType: "system",
          tags: ["consolidate-error-test"],
        });

        // Try to consolidate with non-existent factIds
        // Backend should handle gracefully (only consolidate existing ones)
        const result = await cortex.facts.consolidate({
          memorySpaceId: TEST_MEMSPACE_ID,
          factIds: [realFact.factId, "fact-nonexistent-12345"],
          keepFactId: realFact.factId,
        });

        // Should succeed, treating non-existent facts as already handled
        expect(result.consolidated).toBe(true);
        expect(result.keptFactId).toBe(realFact.factId);
      });

      it("should handle cross-memory-space factIds (skip non-matching)", async () => {
        const SPACE_A = ctx.memorySpaceId("consolidate-space-a");
        const SPACE_B = ctx.memorySpaceId("consolidate-space-b");

        // Create fact in space A
        const factA = await cortex.facts.store({
          memorySpaceId: SPACE_A,
          fact: "Fact in space A",
          factType: "knowledge",
          confidence: 80,
          sourceType: "system",
          tags: ["cross-space-consolidate"],
        });

        // Create facts in space B
        const factB1 = await cortex.facts.store({
          memorySpaceId: SPACE_B,
          fact: "Fact 1 in space B",
          factType: "knowledge",
          confidence: 85,
          sourceType: "system",
          tags: ["cross-space-consolidate"],
        });

        const factB2 = await cortex.facts.store({
          memorySpaceId: SPACE_B,
          fact: "Fact 2 in space B",
          factType: "knowledge",
          confidence: 90,
          sourceType: "system",
          tags: ["cross-space-consolidate"],
        });

        // Try to consolidate using space B as memorySpaceId
        // factA should be skipped because it's in space A
        const result = await cortex.facts.consolidate({
          memorySpaceId: SPACE_B,
          factIds: [factA.factId, factB1.factId, factB2.factId],
          keepFactId: factB2.factId,
        });

        expect(result.consolidated).toBe(true);
        expect(result.keptFactId).toBe(factB2.factId);
        // Backend returns factIds.length - 1 regardless of actual merges
        expect(result.mergedCount).toBe(2);

        // Verify factA is unchanged (still in space A, not superseded)
        // Backend skips facts in different memory space during actual merge
        const factACheck = await cortex.facts.get(SPACE_A, factA.factId);
        expect(factACheck).not.toBeNull();
        expect(factACheck!.supersededBy).toBeUndefined();

        // Verify factB1 is superseded by factB2
        await new Promise((resolve) => setTimeout(resolve, 100));
        const factB1Check = await cortex.facts.get(SPACE_B, factB1.factId);
        expect(factB1Check!.supersededBy).toBe(factB2.factId);
      });

      it("should handle all non-existent factIds", async () => {
        // Try to consolidate with all non-existent factIds
        // Backend returns factIds.length - 1 regardless of whether facts exist
        const result = await cortex.facts.consolidate({
          memorySpaceId: TEST_MEMSPACE_ID,
          factIds: ["fact-fake-1", "fact-fake-2", "fact-fake-3"],
          keepFactId: "fact-fake-1",
        });

        // Backend always returns consolidated: true and mergedCount: factIds.length - 1
        expect(result.consolidated).toBe(true);
        expect(result.mergedCount).toBe(2); // 3 factIds - 1 = 2
      });

      it("should handle large consolidation batch", async () => {
        const SPACE = ctx.memorySpaceId("large-consolidate");

        // Create 10 facts
        const facts = await Promise.all(
          Array.from({ length: 10 }, (_, i) =>
            cortex.facts.store({
              memorySpaceId: SPACE,
              fact: `Large batch fact ${i}`,
              factType: "knowledge",
              subject: "large-batch-user",
              confidence: 70 + i * 2,
              sourceType: "system",
              tags: ["large-consolidate"],
            }),
          ),
        );

        const keepFact = facts[9]; // Keep highest confidence
        const factIds = facts.map((f) => f.factId);

        const result = await cortex.facts.consolidate({
          memorySpaceId: SPACE,
          factIds,
          keepFactId: keepFact.factId,
        });

        expect(result.consolidated).toBe(true);
        expect(result.keptFactId).toBe(keepFact.factId);
        expect(result.mergedCount).toBe(9);

        // Allow time for mutations
        await new Promise((resolve) => setTimeout(resolve, 200));

        // Verify only kept fact is active
        const activeFacts = await cortex.facts.list({
          memorySpaceId: SPACE,
          tags: ["large-consolidate"],
          includeSuperseded: false,
        });

        expect(activeFacts.length).toBe(1);
        expect(activeFacts[0].factId).toBe(keepFact.factId);
      });
    });
  });

  describe("Memory Space Isolation", () => {
    it("isolates facts by memory space", async () => {
      await cortex.facts.store({
        memorySpaceId: "memspace-1",
        fact: "Space 1 fact",
        factType: "knowledge",
        confidence: 90,
        sourceType: "system",
        tags: ["isolation"],
      });

      await cortex.facts.store({
        memorySpaceId: "memspace-2",
        fact: "Space 2 fact",
        factType: "knowledge",
        confidence: 90,
        sourceType: "system",
        tags: ["isolation"],
      });

      const space1Facts = await cortex.facts.list({
        memorySpaceId: "memspace-1",
        tags: ["isolation"],
      });

      const space2Facts = await cortex.facts.list({
        memorySpaceId: "memspace-2",
        tags: ["isolation"],
      });

      expect(space1Facts.length).toBeGreaterThanOrEqual(1);
      expect(space2Facts.length).toBeGreaterThanOrEqual(1);
      expect(space1Facts.some((f) => f.fact.includes("Space 1"))).toBe(true);
      expect(space2Facts.some((f) => f.fact.includes("Space 2"))).toBe(true);
    });
  });

  describe("Versioning & Immutability", () => {
    it("creates immutable version chain", async () => {
      const v1 = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "V1",
        factType: "knowledge",
        confidence: 70,
        sourceType: "system",
        tags: ["chain"],
      });

      const v2 = await cortex.facts.update(TEST_MEMSPACE_ID, v1.factId, {
        fact: "V2",
        confidence: 80,
      });

      const _v3 = await cortex.facts.update(TEST_MEMSPACE_ID, v2.factId, {
        fact: "V3",
        confidence: 90,
      });

      // Get history
      const history = await cortex.facts.getHistory(
        TEST_MEMSPACE_ID,
        v1.factId,
      );

      expect(history.length).toBeGreaterThanOrEqual(3);

      // Verify chain structure (oldest should have no supersedes, newest no supersededBy)
      expect(history[0].supersedes).toBeUndefined();
      expect(history[0].supersededBy).toBeDefined();
      expect(history[history.length - 1].supersededBy).toBeUndefined();
      expect(history[history.length - 1].supersedes).toBeDefined();
    });
  });

  describe("Storage Validation", () => {
    it("validates fact structure in database", async () => {
      const fact = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        participantId: "agent-validator",
        fact: "Storage validation test",
        factType: "knowledge",
        subject: "test-entity",
        predicate: "has_property",
        object: "test-value",
        confidence: 88,
        sourceType: "tool",
        sourceRef: {
          memoryId: "mem-123",
        },
        metadata: { custom: "data" },
        tags: ["validation"],
      });

      // Direct database query
      const stored = await client.query(api.facts.get, {
        memorySpaceId: TEST_MEMSPACE_ID,
        factId: fact.factId,
      });

      expect(stored).not.toBeNull();
      expect(stored!.factId).toBe(fact.factId);
      expect(stored!.memorySpaceId).toBe(TEST_MEMSPACE_ID);
      expect(stored!.participantId).toBe("agent-validator");
      expect(stored!.subject).toBe("test-entity");
      expect(stored!.predicate).toBe("has_property");
      expect(stored!.object).toBe("test-value");
      expect(stored!.version).toBe(1);
      expect(stored!.createdAt).toBeGreaterThan(0);
    });
  });

  describe("Graph-Like Relationships", () => {
    beforeAll(async () => {
      // Create relationship graph
      await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "Alice manages team-alpha",
        factType: "relationship",
        subject: "user-alice",
        predicate: "manages",
        object: "team-alpha",
        confidence: 100,
        sourceType: "system",
        tags: ["org-structure"],
      });

      await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "Bob reports to Alice",
        factType: "relationship",
        subject: "user-bob",
        predicate: "reports_to",
        object: "user-alice",
        confidence: 100,
        sourceType: "system",
        tags: ["org-structure"],
      });

      await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "Charlie reports to Alice",
        factType: "relationship",
        subject: "user-charlie",
        predicate: "reports_to",
        object: "user-alice",
        confidence: 100,
        sourceType: "system",
        tags: ["org-structure"],
      });
    });

    it("traverses 'manages' relationship", async () => {
      const managed = await cortex.facts.queryByRelationship({
        memorySpaceId: TEST_MEMSPACE_ID,
        subject: "user-alice",
        predicate: "manages",
      });

      expect(managed.length).toBeGreaterThanOrEqual(1);
      expect(managed.some((f) => f.object === "team-alpha")).toBe(true);
    });

    it("finds all direct reports", async () => {
      const reports = await cortex.facts.list({
        memorySpaceId: TEST_MEMSPACE_ID,
        tags: ["org-structure"],
      });

      const directReports = reports.filter(
        (f) => f.predicate === "reports_to" && f.object === "user-alice",
      );

      expect(directReports.length).toBeGreaterThanOrEqual(2);
      const names = directReports.map((f) => f.subject);

      expect(names).toContain("user-bob");
      expect(names).toContain("user-charlie");
    });
  });

  describe("Hive Mode", () => {
    it("tracks which participant extracted each fact", async () => {
      await cortex.facts.store({
        memorySpaceId: "hive-test",
        participantId: "tool-a",
        fact: "Extracted by tool A",
        factType: "knowledge",
        confidence: 85,
        sourceType: "tool",
        tags: ["hive"],
      });

      await cortex.facts.store({
        memorySpaceId: "hive-test",
        participantId: "tool-b",
        fact: "Extracted by tool B",
        factType: "knowledge",
        confidence: 90,
        sourceType: "tool",
        tags: ["hive"],
      });

      const all = await cortex.facts.list({
        memorySpaceId: "hive-test",
      });

      expect(all.length).toBeGreaterThanOrEqual(2);

      const participants = all.map((f) => f.participantId);

      expect(participants).toContain("tool-a");
      expect(participants).toContain("tool-b");
    });
  });

  describe("Edge Cases", () => {
    it("handles very long fact statements", async () => {
      const longFact = "A".repeat(5000);
      const fact = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: longFact,
        factType: "knowledge",
        confidence: 80,
        sourceType: "system",
        tags: ["long"],
      });

      expect(fact.fact.length).toBe(5000);
    });

    it("handles special characters in facts", async () => {
      const fact = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: 'User said: "Hello, world!" & goodbye <tag>',
        factType: "knowledge",
        confidence: 90,
        sourceType: "conversation",
        tags: ["special-chars"],
      });

      expect(fact.fact).toContain('"');
      expect(fact.fact).toContain("&");
      expect(fact.fact).toContain("<");
    });

    it("handles concurrent fact creations", async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        cortex.facts.store({
          memorySpaceId: TEST_MEMSPACE_ID,
          fact: `Concurrent fact ${i}`,
          factType: "knowledge",
          confidence: 80,
          sourceType: "system",
          tags: ["concurrent"],
        }),
      );

      const results = await Promise.all(promises);

      expect(results.length).toBe(10);
      results.forEach((f) => {
        expect(f.factId).toMatch(/^fact-/);
      });
    });
  });

  describe("Integration with Conversations", () => {
    it("links facts to source conversations", async () => {
      const conv = await cortex.conversations.create({
        memorySpaceId: TEST_MEMSPACE_ID,
        type: "user-agent",
        participants: {
          userId: "user-fact-test",
          agentId: "agent-fact-test",
          participantId: "agent-fact-test",
        },
      });

      await cortex.conversations.addMessage({
        conversationId: conv.conversationId,
        message: {
          role: "user",
          content: "My favorite color is blue",
        },
      });

      const msg =
        conv.messages[0] ||
        (await cortex.conversations.get(conv.conversationId))!.messages[0];

      // Extract fact from conversation
      const fact = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "User's favorite color is blue",
        factType: "preference",
        subject: "user-fact-test",
        predicate: "favorite_color",
        object: "blue",
        confidence: 95,
        sourceType: "conversation",
        sourceRef: {
          conversationId: conv.conversationId,
          messageIds: [msg.id],
        },
        tags: ["color", "preference"],
      });

      expect(fact.sourceRef).toBeDefined();
      expect(fact.sourceRef!.conversationId).toBe(conv.conversationId);
      expect(fact.sourceRef!.messageIds).toContain(msg.id);
    });
  });

  describe("Cross-Operation Consistency", () => {
    it("store → get → search → list → export consistency", async () => {
      const stored = await cortex.facts.store({
        memorySpaceId: "consistency-test",
        fact: "UNIQUE_CONSISTENCY_MARKER fact for testing",
        factType: "knowledge",
        subject: "test-entity",
        confidence: 92,
        sourceType: "system",
        tags: ["consistency", "test"],
      });

      // Get
      const retrieved = await cortex.facts.get(
        "consistency-test",
        stored.factId,
      );

      expect(retrieved).not.toBeNull();
      expect(retrieved!.factId).toBe(stored.factId);

      // Search
      const searchResults = await cortex.facts.search(
        "consistency-test",
        "UNIQUE_CONSISTENCY_MARKER",
      );

      expect(searchResults.length).toBeGreaterThanOrEqual(1);
      expect(searchResults.some((f) => f.factId === stored.factId)).toBe(true);

      // List
      const listed = await cortex.facts.list({
        memorySpaceId: "consistency-test",
        tags: ["consistency"],
      });

      expect(listed.some((f) => f.factId === stored.factId)).toBe(true);

      // Export
      const exported = await cortex.facts.export({
        memorySpaceId: "consistency-test",
        format: "json",
      });

      const parsed = JSON.parse(exported.data);

      expect(parsed.some((f: any) => f.factId === stored.factId)).toBe(true);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // v0.6.1 Field-by-Field Validation Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Field-by-Field Validation (v0.6.1)", () => {
    it("store() preserves all input fields", async () => {
      const INPUT = {
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "Complete field validation fact",
        factType: "knowledge" as const,
        subject: "user-field-test",
        predicate: "has_preference",
        object: "dark-mode",
        confidence: 88,
        sourceType: "conversation" as const,
        participantId: "agent-field-test",
        sourceRef: {
          conversationId: "conv-field-123",
          memoryId: "mem-field-456",
        },
        tags: ["field-test", "validation", "complete"],
      };

      const result = await cortex.facts.store(INPUT);

      // Field-by-field validation
      expect(result.factId).toBeDefined();
      expect(result.memorySpaceId).toBe(INPUT.memorySpaceId);
      expect(result.fact).toBe(INPUT.fact);
      expect(result.factType).toBe(INPUT.factType);
      expect(result.subject).toBe(INPUT.subject);
      expect(result.predicate).toBe(INPUT.predicate);
      expect(result.object).toBe(INPUT.object);
      expect(result.confidence).toBe(INPUT.confidence);
      expect(result.sourceType).toBe(INPUT.sourceType);
      expect(result.participantId).toBe(INPUT.participantId);
      expect(result.tags).toEqual(INPUT.tags);
      expect(result.sourceRef).toBeDefined();
      expect(result.sourceRef!.conversationId).toBe(
        INPUT.sourceRef.conversationId,
      );
      expect(result.sourceRef!.memoryId).toBe(INPUT.sourceRef.memoryId);

      // Verify in database
      const stored = await cortex.facts.get(TEST_MEMSPACE_ID, result.factId);
      expect(stored).toEqual(result);
    });

    it("get() returns exact stored data", async () => {
      const INPUT = {
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "Get validation fact",
        factType: "preference" as const,
        subject: "user-get-validation",
        confidence: 92,
        sourceType: "manual" as const,
        participantId: "tool-get-test",
        tags: ["get-validation"],
      };

      const stored = await cortex.facts.store(INPUT);
      const retrieved = await cortex.facts.get(TEST_MEMSPACE_ID, stored.factId);

      // All fields should match
      expect(retrieved!.factId).toBe(stored.factId);
      expect(retrieved!.fact).toBe(INPUT.fact);
      expect(retrieved!.factType).toBe(INPUT.factType);
      expect(retrieved!.subject).toBe(INPUT.subject);
      expect(retrieved!.confidence).toBe(INPUT.confidence);
      expect(retrieved!.sourceType).toBe(INPUT.sourceType);
      expect(retrieved!.participantId).toBe(INPUT.participantId);
      expect(retrieved!.tags).toEqual(INPUT.tags);
    });

    it("update() creates new version with all original fields", async () => {
      const v1 = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "Original fact version",
        factType: "knowledge",
        subject: "user-update-validation",
        predicate: "original_predicate",
        confidence: 70,
        sourceType: "system",
        participantId: "agent-update-test",
        tags: ["update-test", "v1"],
      });

      const v2 = await cortex.facts.update(TEST_MEMSPACE_ID, v1.factId, {
        fact: "Updated fact version",
        confidence: 90,
        tags: ["update-test", "v2"],
      });

      // Updated fields changed
      expect(v2.fact).toBe("Updated fact version");
      expect(v2.confidence).toBe(90);
      expect(v2.tags).toContain("v2");

      // Original fields preserved
      expect(v2.factType).toBe(v1.factType);
      expect(v2.subject).toBe(v1.subject);
      expect(v2.predicate).toBe(v1.predicate);
      expect(v2.participantId).toBe(v1.participantId);
      expect(v2.sourceType).toBe(v1.sourceType);

      // Version chain maintained
      expect(v2.supersedes).toBe(v1.factId);
    });

    it("list() returns all fields for each fact", async () => {
      const fact1 = await cortex.facts.store({
        memorySpaceId: "facts-list-validation",
        fact: "List validation fact",
        factType: "identity",
        subject: "user-list-valid",
        confidence: 85,
        sourceType: "system",
        participantId: "tool-list-valid",
        tags: ["list-field-validation"],
      });

      const results = await cortex.facts.list({
        memorySpaceId: "facts-list-validation",
      });

      const found = results.find((r) => r.factId === fact1.factId);

      expect(found).toBeDefined();
      expect(found!.fact).toBe(fact1.fact);
      expect(found!.factType).toBe(fact1.factType);
      expect(found!.subject).toBe(fact1.subject);
      expect(found!.confidence).toBe(fact1.confidence);
      expect(found!.participantId).toBe(fact1.participantId);
      expect(found!.tags).toEqual(fact1.tags);
    });

    it("search() returns all fields for each result", async () => {
      await cortex.facts.store({
        memorySpaceId: "facts-search-validation",
        fact: "FACT_SEARCH_MARKER searchable fact content",
        factType: "knowledge",
        subject: "user-search-valid",
        confidence: 88,
        sourceType: "conversation",
        participantId: "agent-search-valid",
        tags: ["search-field-validation"],
      });

      const results = await cortex.facts.search(
        "facts-search-validation",
        "FACT_SEARCH_MARKER",
        { limit: 10 },
      );

      const found = results.find((r) => r.fact.includes("FACT_SEARCH_MARKER"));

      expect(found).toBeDefined();
      expect(found!.factType).toBe("knowledge");
      expect(found!.subject).toBe("user-search-valid");
      expect(found!.confidence).toBe(88);
      expect(found!.participantId).toBe("agent-search-valid");
      expect(found!.tags).toContain("search-field-validation");
    });

    it("queryBySubject() preserves all fields", async () => {
      const SUBJECT = "user-query-by-subject";

      const fact1 = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "First fact about subject",
        factType: "preference",
        subject: SUBJECT,
        predicate: "prefers",
        object: "coffee",
        confidence: 90,
        sourceType: "conversation",
        participantId: "tool-query-subject",
        tags: ["query-subject-test"],
      });

      const results = await cortex.facts.queryBySubject({
        memorySpaceId: TEST_MEMSPACE_ID,
        subject: SUBJECT,
      });

      const found = results.find((r) => r.factId === fact1.factId);

      expect(found).toBeDefined();
      expect(found!.fact).toBe(fact1.fact);
      expect(found!.predicate).toBe(fact1.predicate);
      expect(found!.object).toBe(fact1.object);
      expect(found!.confidence).toBe(fact1.confidence);
      expect(found!.participantId).toBe(fact1.participantId);
    });

    it("sourceRef structure preserved", async () => {
      const sourceRef = {
        conversationId: "conv-source-ref",
        memoryId: "mem-source-ref",
      };

      const fact = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "Fact with source reference",
        factType: "knowledge",
        subject: "user-source-ref",
        confidence: 95,
        sourceType: "conversation",
        sourceRef,
      });

      expect(fact.sourceRef).toBeDefined();
      expect(fact.sourceRef!.conversationId).toBe(sourceRef.conversationId);
      expect(fact.sourceRef!.memoryId).toBe(sourceRef.memoryId);

      // Verify after retrieval
      const retrieved = await cortex.facts.get(TEST_MEMSPACE_ID, fact.factId);

      expect(retrieved!.sourceRef!.conversationId).toBe(
        sourceRef.conversationId,
      );
      expect(retrieved!.sourceRef!.memoryId).toBe(sourceRef.memoryId);
    });

    it("version chain fields maintained", async () => {
      const v1 = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "Version 1",
        factType: "knowledge",
        subject: "user-version-chain",
        confidence: 70,
        sourceType: "system",
      });

      const v2 = await cortex.facts.update(TEST_MEMSPACE_ID, v1.factId, {
        fact: "Version 2",
        confidence: 80,
      });

      const v3 = await cortex.facts.update(TEST_MEMSPACE_ID, v2.factId, {
        fact: "Version 3",
        confidence: 90,
      });

      // Check v1
      const stored1 = await cortex.facts.get(TEST_MEMSPACE_ID, v1.factId);
      expect(stored1!.version).toBe(1);
      expect(stored1!.supersededBy).toBe(v2.factId);
      expect(stored1!.supersedes).toBeUndefined();

      // Check v2
      const stored2 = await cortex.facts.get(TEST_MEMSPACE_ID, v2.factId);
      expect(stored2!.version).toBe(2);
      expect(stored2!.supersedes).toBe(v1.factId);
      expect(stored2!.supersededBy).toBe(v3.factId);

      // Check v3
      const stored3 = await cortex.facts.get(TEST_MEMSPACE_ID, v3.factId);
      expect(stored3!.version).toBe(3);
      expect(stored3!.supersedes).toBe(v2.factId);
      expect(stored3!.supersededBy).toBeUndefined();
    });

    it("timestamps preserved correctly", async () => {
      const fact = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "Timestamp test fact",
        factType: "knowledge",
        subject: "user-timestamp",
        confidence: 80,
        sourceType: "system",
      });

      expect(fact.createdAt).toBeGreaterThan(0);
      expect(fact.updatedAt).toBeDefined();

      const retrieved = await cortex.facts.get(TEST_MEMSPACE_ID, fact.factId);

      expect(retrieved!.createdAt).toBe(fact.createdAt);
      expect(retrieved!.updatedAt).toBe(fact.updatedAt);
    });

    it("count() accurate across all operations", async () => {
      const countBefore = await cortex.facts.count({
        memorySpaceId: "facts-count-validation",
      });

      // Create 5 facts
      for (let i = 0; i < 5; i++) {
        await cortex.facts.store({
          memorySpaceId: "facts-count-validation",
          fact: `Count validation fact ${i}`,
          factType: "knowledge",
          subject: `user-count-${i}`,
          confidence: 80,
          sourceType: "system",
          tags: ["count-validation"],
        });
      }

      const countAfter = await cortex.facts.count({
        memorySpaceId: "facts-count-validation",
      });

      expect(countAfter).toBe(countBefore + 5);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Enrichment Fields Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Enrichment Fields", () => {
    describe("store() with enrichment fields", () => {
      it("should store fact with category field", async () => {
        const fact = await cortex.facts.store({
          memorySpaceId: TEST_MEMSPACE_ID,
          fact: "User prefers to be called Dr. Smith",
          factType: "preference",
          subject: "user-enrichment-1",
          confidence: 95,
          sourceType: "conversation",
          category: "addressing_preference",
          tags: ["enrichment-test"],
        });

        expect(fact.category).toBe("addressing_preference");

        const stored = await cortex.facts.get(TEST_MEMSPACE_ID, fact.factId);
        expect(stored!.category).toBe("addressing_preference");
      });

      it("should store fact with searchAliases", async () => {
        const searchAliases = [
          "title preference",
          "name preference",
          "how to address",
        ];

        const fact = await cortex.facts.store({
          memorySpaceId: TEST_MEMSPACE_ID,
          fact: "User wants to be called by first name",
          factType: "preference",
          subject: "user-enrichment-2",
          confidence: 90,
          sourceType: "conversation",
          searchAliases,
          tags: ["enrichment-test"],
        });

        expect(fact.searchAliases).toEqual(searchAliases);

        const stored = await cortex.facts.get(TEST_MEMSPACE_ID, fact.factId);
        expect(stored!.searchAliases).toEqual(searchAliases);
      });

      it("should store fact with semanticContext", async () => {
        const semanticContext =
          "This fact should be retrieved when the user asks about meeting preferences or scheduling";

        const fact = await cortex.facts.store({
          memorySpaceId: TEST_MEMSPACE_ID,
          fact: "User prefers morning meetings",
          factType: "preference",
          subject: "user-enrichment-3",
          confidence: 88,
          sourceType: "conversation",
          semanticContext,
          tags: ["enrichment-test"],
        });

        expect(fact.semanticContext).toBe(semanticContext);

        const stored = await cortex.facts.get(TEST_MEMSPACE_ID, fact.factId);
        expect(stored!.semanticContext).toBe(semanticContext);
      });

      it("should store fact with entities array", async () => {
        const entities = [
          { name: "Dr. Smith", type: "person", fullValue: "Dr. John Smith" },
          {
            name: "Acme Corp",
            type: "organization",
            fullValue: "Acme Corporation Inc.",
          },
        ];

        const fact = await cortex.facts.store({
          memorySpaceId: TEST_MEMSPACE_ID,
          fact: "Dr. Smith works at Acme Corp",
          factType: "relationship",
          subject: "user-enrichment-4",
          predicate: "works_at",
          object: "Acme Corp",
          confidence: 95,
          sourceType: "conversation",
          entities,
          tags: ["enrichment-test"],
        });

        expect(fact.entities).toEqual(entities);
        expect(fact.entities).toHaveLength(2);

        const stored = await cortex.facts.get(TEST_MEMSPACE_ID, fact.factId);
        expect(stored!.entities).toEqual(entities);
      });

      it("should store fact with relations array", async () => {
        const relations = [
          { subject: "user-123", predicate: "works_at", object: "company-456" },
          { subject: "user-123", predicate: "has_role", object: "engineer" },
        ];

        const fact = await cortex.facts.store({
          memorySpaceId: TEST_MEMSPACE_ID,
          fact: "User is an engineer at TechCorp",
          factType: "knowledge",
          subject: "user-enrichment-5",
          confidence: 92,
          sourceType: "conversation",
          relations,
          tags: ["enrichment-test"],
        });

        expect(fact.relations).toEqual(relations);
        expect(fact.relations).toHaveLength(2);

        const stored = await cortex.facts.get(TEST_MEMSPACE_ID, fact.factId);
        expect(stored!.relations).toEqual(relations);
      });

      it("should store fact with all enrichment fields", async () => {
        const INPUT = {
          memorySpaceId: TEST_MEMSPACE_ID,
          fact: "Complete enrichment test fact",
          factType: "knowledge" as const,
          subject: "user-enrichment-all",
          confidence: 98,
          sourceType: "conversation" as const,
          category: "complete_enrichment",
          searchAliases: ["full test", "all fields", "enrichment"],
          semanticContext:
            "Use this fact for enrichment field validation tests",
          entities: [
            { name: "TestUser", type: "person" },
            {
              name: "TestCompany",
              type: "organization",
              fullValue: "Test Company LLC",
            },
          ],
          relations: [
            {
              subject: "TestUser",
              predicate: "belongs_to",
              object: "TestCompany",
            },
          ],
          tags: ["enrichment-test", "complete"],
        };

        const fact = await cortex.facts.store(INPUT);

        // Validate all enrichment fields
        expect(fact.category).toBe(INPUT.category);
        expect(fact.searchAliases).toEqual(INPUT.searchAliases);
        expect(fact.semanticContext).toBe(INPUT.semanticContext);
        expect(fact.entities).toEqual(INPUT.entities);
        expect(fact.relations).toEqual(INPUT.relations);

        // Verify after retrieval
        const stored = await cortex.facts.get(TEST_MEMSPACE_ID, fact.factId);
        expect(stored!.category).toBe(INPUT.category);
        expect(stored!.searchAliases).toEqual(INPUT.searchAliases);
        expect(stored!.semanticContext).toBe(INPUT.semanticContext);
        expect(stored!.entities).toEqual(INPUT.entities);
        expect(stored!.relations).toEqual(INPUT.relations);
      });
    });

    describe("update() preserves and modifies enrichment fields", () => {
      it("should preserve enrichment fields through update", async () => {
        const v1 = await cortex.facts.store({
          memorySpaceId: TEST_MEMSPACE_ID,
          fact: "Original fact with enrichment",
          factType: "knowledge",
          subject: "user-update-enrichment",
          confidence: 80,
          sourceType: "system",
          category: "test_category",
          searchAliases: ["original", "aliases"],
          semanticContext: "Original context",
          entities: [{ name: "Entity1", type: "test" }],
          relations: [{ subject: "a", predicate: "b", object: "c" }],
          tags: ["update-enrichment-test"],
        });

        // Update only confidence (enrichment fields should be preserved)
        const v2 = await cortex.facts.update(TEST_MEMSPACE_ID, v1.factId, {
          confidence: 95,
        });

        // All enrichment fields should be preserved
        expect(v2.category).toBe("test_category");
        expect(v2.searchAliases).toEqual(["original", "aliases"]);
        expect(v2.semanticContext).toBe("Original context");
        expect(v2.entities).toEqual([{ name: "Entity1", type: "test" }]);
        expect(v2.relations).toEqual([
          { subject: "a", predicate: "b", object: "c" },
        ]);
      });

      it("should update category field", async () => {
        const v1 = await cortex.facts.store({
          memorySpaceId: TEST_MEMSPACE_ID,
          fact: "Fact to update category",
          factType: "knowledge",
          subject: "user-update-category",
          confidence: 80,
          sourceType: "system",
          category: "old_category",
          tags: ["category-update-test"],
        });

        const v2 = await cortex.facts.update(TEST_MEMSPACE_ID, v1.factId, {
          category: "new_category",
        });

        expect(v2.category).toBe("new_category");

        const stored = await cortex.facts.get(TEST_MEMSPACE_ID, v2.factId);
        expect(stored!.category).toBe("new_category");
      });

      it("should update searchAliases field", async () => {
        const v1 = await cortex.facts.store({
          memorySpaceId: TEST_MEMSPACE_ID,
          fact: "Fact to update aliases",
          factType: "knowledge",
          subject: "user-update-aliases",
          confidence: 80,
          sourceType: "system",
          searchAliases: ["old", "aliases"],
          tags: ["aliases-update-test"],
        });

        const newAliases = ["new", "updated", "aliases"];
        const v2 = await cortex.facts.update(TEST_MEMSPACE_ID, v1.factId, {
          searchAliases: newAliases,
        });

        expect(v2.searchAliases).toEqual(newAliases);
      });

      it("should update semanticContext field", async () => {
        const v1 = await cortex.facts.store({
          memorySpaceId: TEST_MEMSPACE_ID,
          fact: "Fact to update context",
          factType: "knowledge",
          subject: "user-update-context",
          confidence: 80,
          sourceType: "system",
          semanticContext: "Old semantic context",
          tags: ["context-update-test"],
        });

        const newContext =
          "New and improved semantic context for better retrieval";
        const v2 = await cortex.facts.update(TEST_MEMSPACE_ID, v1.factId, {
          semanticContext: newContext,
        });

        expect(v2.semanticContext).toBe(newContext);
      });

      it("should update entities field", async () => {
        const v1 = await cortex.facts.store({
          memorySpaceId: TEST_MEMSPACE_ID,
          fact: "Fact to update entities",
          factType: "knowledge",
          subject: "user-update-entities",
          confidence: 80,
          sourceType: "system",
          entities: [{ name: "OldEntity", type: "old" }],
          tags: ["entities-update-test"],
        });

        const newEntities = [
          { name: "NewEntity1", type: "new", fullValue: "Full New Entity 1" },
          { name: "NewEntity2", type: "new" },
        ];
        const v2 = await cortex.facts.update(TEST_MEMSPACE_ID, v1.factId, {
          entities: newEntities,
        });

        expect(v2.entities).toEqual(newEntities);
        expect(v2.entities).toHaveLength(2);
      });

      it("should update relations field", async () => {
        const v1 = await cortex.facts.store({
          memorySpaceId: TEST_MEMSPACE_ID,
          fact: "Fact to update relations",
          factType: "knowledge",
          subject: "user-update-relations",
          confidence: 80,
          sourceType: "system",
          relations: [{ subject: "old", predicate: "old", object: "old" }],
          tags: ["relations-update-test"],
        });

        const newRelations = [
          { subject: "new1", predicate: "relates_to", object: "new2" },
          { subject: "new2", predicate: "belongs_to", object: "new3" },
        ];
        const v2 = await cortex.facts.update(TEST_MEMSPACE_ID, v1.factId, {
          relations: newRelations,
        });

        expect(v2.relations).toEqual(newRelations);
        expect(v2.relations).toHaveLength(2);
      });

      it("should update multiple enrichment fields at once", async () => {
        const v1 = await cortex.facts.store({
          memorySpaceId: TEST_MEMSPACE_ID,
          fact: "Fact for multi-field update",
          factType: "knowledge",
          subject: "user-multi-update",
          confidence: 80,
          sourceType: "system",
          category: "old",
          searchAliases: ["old"],
          semanticContext: "old",
          tags: ["multi-update-test"],
        });

        const v2 = await cortex.facts.update(TEST_MEMSPACE_ID, v1.factId, {
          category: "new",
          searchAliases: ["new", "updated"],
          semanticContext: "New context",
          confidence: 95,
        });

        expect(v2.category).toBe("new");
        expect(v2.searchAliases).toEqual(["new", "updated"]);
        expect(v2.semanticContext).toBe("New context");
        expect(v2.confidence).toBe(95);
      });
    });

    describe("enrichment fields in list results", () => {
      it("should include enrichment fields in list() results", async () => {
        const SPACE = ctx.memorySpaceId("enrichment-list");

        await cortex.facts.store({
          memorySpaceId: SPACE,
          fact: "Enriched fact for list",
          factType: "knowledge",
          subject: "user-list-enrichment",
          confidence: 85,
          sourceType: "system",
          category: "list_test_category",
          searchAliases: ["list", "test"],
          semanticContext: "For list testing",
          tags: ["enrichment-list-test"],
        });

        const results = await cortex.facts.list({
          memorySpaceId: SPACE,
          tags: ["enrichment-list-test"],
        });

        expect(results.length).toBeGreaterThanOrEqual(1);
        const found = results.find((f) => f.category === "list_test_category");
        expect(found).toBeDefined();
        expect(found!.searchAliases).toEqual(["list", "test"]);
        expect(found!.semanticContext).toBe("For list testing");
      });
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Client-Side Validation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Client-Side Validation", () => {
    describe("store() validation", () => {
      it("should throw on missing memorySpaceId", async () => {
        await expect(
          cortex.facts.store({
            memorySpaceId: "",
            fact: "test",
            factType: "knowledge",
            confidence: 90,
            sourceType: "system",
          }),
        ).rejects.toThrow("memorySpaceId is required and cannot be empty");
      });

      it("should throw on empty fact", async () => {
        await expect(
          cortex.facts.store({
            memorySpaceId: TEST_MEMSPACE_ID,
            fact: "",
            factType: "knowledge",
            confidence: 90,
            sourceType: "system",
          }),
        ).rejects.toThrow("fact is required and cannot be empty");
      });

      it("should throw on invalid factType", async () => {
        await expect(
          cortex.facts.store({
            memorySpaceId: TEST_MEMSPACE_ID,
            fact: "test",
            factType: "invalid" as any,
            confidence: 90,
            sourceType: "system",
          }),
        ).rejects.toThrow("Invalid factType");
      });

      it("should throw on confidence < 0", async () => {
        await expect(
          cortex.facts.store({
            memorySpaceId: TEST_MEMSPACE_ID,
            fact: "test",
            factType: "knowledge",
            confidence: -1,
            sourceType: "system",
          }),
        ).rejects.toThrow("confidence must be between 0 and 100");
      });

      it("should throw on confidence > 100", async () => {
        await expect(
          cortex.facts.store({
            memorySpaceId: TEST_MEMSPACE_ID,
            fact: "test",
            factType: "knowledge",
            confidence: 150,
            sourceType: "system",
          }),
        ).rejects.toThrow("confidence must be between 0 and 100");
      });

      it("should throw on invalid sourceType", async () => {
        await expect(
          cortex.facts.store({
            memorySpaceId: TEST_MEMSPACE_ID,
            fact: "test",
            factType: "knowledge",
            confidence: 90,
            sourceType: "invalid" as any,
          }),
        ).rejects.toThrow("Invalid sourceType");
      });

      it("should throw on invalid tags (not array)", async () => {
        await expect(
          cortex.facts.store({
            memorySpaceId: TEST_MEMSPACE_ID,
            fact: "test",
            factType: "knowledge",
            confidence: 90,
            sourceType: "system",
            tags: "not-an-array" as any,
          }),
        ).rejects.toThrow("tags must be an array");
      });

      it("should throw on invalid validFrom/validUntil", async () => {
        await expect(
          cortex.facts.store({
            memorySpaceId: TEST_MEMSPACE_ID,
            fact: "test",
            factType: "knowledge",
            confidence: 90,
            sourceType: "system",
            validFrom: 2000,
            validUntil: 1000,
          }),
        ).rejects.toThrow("validFrom must be before validUntil");
      });

      it("should throw on invalid sourceRef structure", async () => {
        await expect(
          cortex.facts.store({
            memorySpaceId: TEST_MEMSPACE_ID,
            fact: "test",
            factType: "knowledge",
            confidence: 90,
            sourceType: "system",
            sourceRef: "not-an-object" as any,
          }),
        ).rejects.toThrow("sourceRef must be an object");
      });

      it("should throw on invalid metadata (not object)", async () => {
        await expect(
          cortex.facts.store({
            memorySpaceId: TEST_MEMSPACE_ID,
            fact: "test",
            factType: "knowledge",
            confidence: 90,
            sourceType: "system",
            metadata: ["array"] as any,
          }),
        ).rejects.toThrow("metadata must be an object");
      });
    });

    describe("get() validation", () => {
      it("should throw on missing memorySpaceId", async () => {
        await expect(cortex.facts.get("", "fact-123")).rejects.toThrow(
          "memorySpaceId is required and cannot be empty",
        );
      });

      it("should throw on missing factId", async () => {
        await expect(cortex.facts.get(TEST_MEMSPACE_ID, "")).rejects.toThrow(
          "factId is required and cannot be empty",
        );
      });

      it("should throw on invalid factId format", async () => {
        await expect(
          cortex.facts.get(TEST_MEMSPACE_ID, "invalid-id"),
        ).rejects.toThrow('factId must start with "fact-"');
      });
    });

    describe("list() validation", () => {
      it("should throw on missing memorySpaceId", async () => {
        await expect(cortex.facts.list({ memorySpaceId: "" })).rejects.toThrow(
          "memorySpaceId is required and cannot be empty",
        );
      });

      it("should throw on invalid factType", async () => {
        await expect(
          cortex.facts.list({
            memorySpaceId: TEST_MEMSPACE_ID,
            factType: "invalid" as any,
          }),
        ).rejects.toThrow("Invalid factType");
      });

      it("should throw on invalid sourceType", async () => {
        await expect(
          cortex.facts.list({
            memorySpaceId: TEST_MEMSPACE_ID,
            sourceType: "invalid" as any,
          }),
        ).rejects.toThrow("Invalid sourceType");
      });

      it("should throw on invalid confidence", async () => {
        await expect(
          cortex.facts.list({
            memorySpaceId: TEST_MEMSPACE_ID,
            confidence: 150,
          }),
        ).rejects.toThrow("confidence must be between 0 and 100");
      });

      it("should throw on invalid minConfidence", async () => {
        await expect(
          cortex.facts.list({
            memorySpaceId: TEST_MEMSPACE_ID,
            minConfidence: -10,
          }),
        ).rejects.toThrow("minConfidence must be between 0 and 100");
      });

      it("should throw on invalid tagMatch", async () => {
        await expect(
          cortex.facts.list({
            memorySpaceId: TEST_MEMSPACE_ID,
            tagMatch: "invalid" as any,
          }),
        ).rejects.toThrow("Invalid tagMatch");
      });

      it("should throw on negative limit", async () => {
        await expect(
          cortex.facts.list({
            memorySpaceId: TEST_MEMSPACE_ID,
            limit: -5,
          }),
        ).rejects.toThrow("limit must be non-negative");
      });

      it("should throw on negative offset", async () => {
        await expect(
          cortex.facts.list({
            memorySpaceId: TEST_MEMSPACE_ID,
            offset: -10,
          }),
        ).rejects.toThrow("offset must be non-negative");
      });

      it("should throw on invalid sortBy", async () => {
        await expect(
          cortex.facts.list({
            memorySpaceId: TEST_MEMSPACE_ID,
            sortBy: "invalid" as any,
          }),
        ).rejects.toThrow("Invalid sortBy");
      });

      it("should throw on invalid sortOrder", async () => {
        await expect(
          cortex.facts.list({
            memorySpaceId: TEST_MEMSPACE_ID,
            sortOrder: "invalid" as any,
          }),
        ).rejects.toThrow("Invalid sortOrder");
      });

      it("should throw on invalid date range (createdAfter > createdBefore)", async () => {
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        await expect(
          cortex.facts.list({
            memorySpaceId: TEST_MEMSPACE_ID,
            createdAfter: now,
            createdBefore: yesterday,
          }),
        ).rejects.toThrow("createdAfter must be before createdBefore");
      });

      it("should throw on invalid date range (updatedAfter > updatedBefore)", async () => {
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        await expect(
          cortex.facts.list({
            memorySpaceId: TEST_MEMSPACE_ID,
            updatedAfter: now,
            updatedBefore: yesterday,
          }),
        ).rejects.toThrow("updatedAfter must be before updatedBefore");
      });
    });

    describe("count() validation", () => {
      it("should throw on missing memorySpaceId", async () => {
        await expect(cortex.facts.count({ memorySpaceId: "" })).rejects.toThrow(
          "memorySpaceId is required and cannot be empty",
        );
      });

      it("should throw on invalid factType", async () => {
        await expect(
          cortex.facts.count({
            memorySpaceId: TEST_MEMSPACE_ID,
            factType: "invalid" as any,
          }),
        ).rejects.toThrow("Invalid factType");
      });

      it("should throw on invalid confidence", async () => {
        await expect(
          cortex.facts.count({
            memorySpaceId: TEST_MEMSPACE_ID,
            confidence: 200,
          }),
        ).rejects.toThrow("confidence must be between 0 and 100");
      });
    });

    describe("search() validation", () => {
      it("should throw on missing memorySpaceId", async () => {
        await expect(cortex.facts.search("", "test query")).rejects.toThrow(
          "memorySpaceId is required and cannot be empty",
        );
      });

      it("should throw on missing query", async () => {
        await expect(cortex.facts.search(TEST_MEMSPACE_ID, "")).rejects.toThrow(
          "query is required and cannot be empty",
        );
      });

      it("should throw on invalid options", async () => {
        await expect(
          cortex.facts.search(TEST_MEMSPACE_ID, "test", {
            factType: "invalid" as any,
          }),
        ).rejects.toThrow("Invalid factType");
      });
    });

    describe("update() validation", () => {
      it("should throw on missing memorySpaceId", async () => {
        await expect(
          cortex.facts.update("", "fact-123", { confidence: 95 }),
        ).rejects.toThrow("memorySpaceId is required and cannot be empty");
      });

      it("should throw on missing factId", async () => {
        await expect(
          cortex.facts.update(TEST_MEMSPACE_ID, "", { confidence: 95 }),
        ).rejects.toThrow("factId is required and cannot be empty");
      });

      it("should throw on invalid factId format", async () => {
        await expect(
          cortex.facts.update(TEST_MEMSPACE_ID, "invalid-id", {
            confidence: 95,
          }),
        ).rejects.toThrow('factId must start with "fact-"');
      });

      it("should throw on empty updates object", async () => {
        await expect(
          cortex.facts.update(TEST_MEMSPACE_ID, "fact-123", {}),
        ).rejects.toThrow("Update must include at least one field");
      });

      it("should throw on invalid confidence in updates", async () => {
        await expect(
          cortex.facts.update(TEST_MEMSPACE_ID, "fact-123", {
            confidence: 150,
          }),
        ).rejects.toThrow("confidence must be between 0 and 100");
      });

      it("should throw on invalid tags in updates", async () => {
        await expect(
          cortex.facts.update(TEST_MEMSPACE_ID, "fact-123", {
            tags: "not-array" as any,
          }),
        ).rejects.toThrow("tags must be an array");
      });

      it("should throw on invalid metadata in updates", async () => {
        await expect(
          cortex.facts.update(TEST_MEMSPACE_ID, "fact-123", {
            metadata: ["array"] as any,
          }),
        ).rejects.toThrow("metadata must be an object");
      });
    });

    describe("delete() validation", () => {
      it("should throw on missing memorySpaceId", async () => {
        await expect(cortex.facts.delete("", "fact-123")).rejects.toThrow(
          "memorySpaceId is required and cannot be empty",
        );
      });

      it("should throw on missing factId", async () => {
        await expect(cortex.facts.delete(TEST_MEMSPACE_ID, "")).rejects.toThrow(
          "factId is required and cannot be empty",
        );
      });

      it("should throw on invalid factId format", async () => {
        await expect(
          cortex.facts.delete(TEST_MEMSPACE_ID, "invalid-id"),
        ).rejects.toThrow('factId must start with "fact-"');
      });
    });

    describe("getHistory() validation", () => {
      it("should throw on missing memorySpaceId", async () => {
        await expect(cortex.facts.getHistory("", "fact-123")).rejects.toThrow(
          "memorySpaceId is required and cannot be empty",
        );
      });

      it("should throw on missing factId", async () => {
        await expect(
          cortex.facts.getHistory(TEST_MEMSPACE_ID, ""),
        ).rejects.toThrow("factId is required and cannot be empty");
      });

      it("should throw on invalid factId format", async () => {
        await expect(
          cortex.facts.getHistory(TEST_MEMSPACE_ID, "invalid-id"),
        ).rejects.toThrow('factId must start with "fact-"');
      });
    });

    describe("queryBySubject() validation", () => {
      it("should throw on missing memorySpaceId", async () => {
        await expect(
          cortex.facts.queryBySubject({
            memorySpaceId: "",
            subject: "user-123",
          }),
        ).rejects.toThrow("memorySpaceId is required and cannot be empty");
      });

      it("should throw on missing subject", async () => {
        await expect(
          cortex.facts.queryBySubject({
            memorySpaceId: TEST_MEMSPACE_ID,
            subject: "",
          }),
        ).rejects.toThrow("subject is required and cannot be empty");
      });

      it("should throw on invalid factType", async () => {
        await expect(
          cortex.facts.queryBySubject({
            memorySpaceId: TEST_MEMSPACE_ID,
            subject: "user-123",
            factType: "invalid" as any,
          }),
        ).rejects.toThrow("Invalid factType");
      });
    });

    describe("queryByRelationship() validation", () => {
      it("should throw on missing memorySpaceId", async () => {
        await expect(
          cortex.facts.queryByRelationship({
            memorySpaceId: "",
            subject: "user-123",
            predicate: "likes",
          }),
        ).rejects.toThrow("memorySpaceId is required and cannot be empty");
      });

      it("should throw on missing subject", async () => {
        await expect(
          cortex.facts.queryByRelationship({
            memorySpaceId: TEST_MEMSPACE_ID,
            subject: "",
            predicate: "likes",
          }),
        ).rejects.toThrow("subject is required and cannot be empty");
      });

      it("should throw on missing predicate", async () => {
        await expect(
          cortex.facts.queryByRelationship({
            memorySpaceId: TEST_MEMSPACE_ID,
            subject: "user-123",
            predicate: "",
          }),
        ).rejects.toThrow("predicate is required and cannot be empty");
      });

      it("should throw on invalid factType", async () => {
        await expect(
          cortex.facts.queryByRelationship({
            memorySpaceId: TEST_MEMSPACE_ID,
            subject: "user-123",
            predicate: "likes",
            factType: "invalid" as any,
          }),
        ).rejects.toThrow("Invalid factType");
      });
    });

    describe("export() validation", () => {
      it("should throw on missing memorySpaceId", async () => {
        await expect(
          cortex.facts.export({
            memorySpaceId: "",
            format: "json",
          }),
        ).rejects.toThrow("memorySpaceId is required and cannot be empty");
      });

      it("should throw on invalid format", async () => {
        await expect(
          cortex.facts.export({
            memorySpaceId: TEST_MEMSPACE_ID,
            format: "xml" as any,
          }),
        ).rejects.toThrow("Invalid format");
      });

      it("should throw on invalid factType", async () => {
        await expect(
          cortex.facts.export({
            memorySpaceId: TEST_MEMSPACE_ID,
            format: "json",
            factType: "invalid" as any,
          }),
        ).rejects.toThrow("Invalid factType");
      });
    });

    describe("consolidate() validation", () => {
      it("should throw on missing memorySpaceId", async () => {
        await expect(
          cortex.facts.consolidate({
            memorySpaceId: "",
            factIds: ["fact-1", "fact-2"],
            keepFactId: "fact-1",
          }),
        ).rejects.toThrow("memorySpaceId is required and cannot be empty");
      });

      it("should throw on empty factIds array", async () => {
        await expect(
          cortex.facts.consolidate({
            memorySpaceId: TEST_MEMSPACE_ID,
            factIds: [],
            keepFactId: "fact-1",
          }),
        ).rejects.toThrow("factIds must contain at least one element");
      });

      it("should throw on factIds with single element", async () => {
        await expect(
          cortex.facts.consolidate({
            memorySpaceId: TEST_MEMSPACE_ID,
            factIds: ["fact-1"],
            keepFactId: "fact-1",
          }),
        ).rejects.toThrow("consolidation requires at least 2 facts");
      });

      it("should throw on missing keepFactId", async () => {
        await expect(
          cortex.facts.consolidate({
            memorySpaceId: TEST_MEMSPACE_ID,
            factIds: ["fact-1", "fact-2"],
            keepFactId: "",
          }),
        ).rejects.toThrow("keepFactId is required and cannot be empty");
      });

      it("should throw when keepFactId not in factIds", async () => {
        await expect(
          cortex.facts.consolidate({
            memorySpaceId: TEST_MEMSPACE_ID,
            factIds: ["fact-1", "fact-2"],
            keepFactId: "fact-3",
          }),
        ).rejects.toThrow("keepFactId");
      });

      it("should throw on duplicate factIds", async () => {
        await expect(
          cortex.facts.consolidate({
            memorySpaceId: TEST_MEMSPACE_ID,
            factIds: ["fact-1", "fact-2", "fact-1"],
            keepFactId: "fact-1",
          }),
        ).rejects.toThrow("must not contain duplicates");
      });
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Temporal Validity (validAt, validFrom, validUntil) Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Temporal Validity Edge Cases", () => {
    const TEMPORAL_SPACE = ctx.memorySpaceId("temporal");

    describe("validFrom and validUntil boundaries", () => {
      it("should store fact with validFrom and validUntil", async () => {
        const now = Date.now();
        const validFrom = now;
        const validUntil = now + 86400000; // 24 hours from now

        const fact = await cortex.facts.store({
          memorySpaceId: TEMPORAL_SPACE,
          fact: "Temporally valid fact",
          factType: "knowledge",
          subject: "user-temporal",
          confidence: 85,
          sourceType: "system",
          validFrom,
          validUntil,
          tags: ["temporal-test"],
        });

        expect(fact.validFrom).toBe(validFrom);
        expect(fact.validUntil).toBe(validUntil);

        const stored = await cortex.facts.get(TEMPORAL_SPACE, fact.factId);
        expect(stored!.validFrom).toBe(validFrom);
        expect(stored!.validUntil).toBe(validUntil);
      });

      it("should find facts valid at specific timestamp (validAt filter)", async () => {
        const now = Date.now();
        const pastStart = now - 86400000; // 24 hours ago
        const futureEnd = now + 86400000; // 24 hours from now

        // Create fact valid from past to future (should be found at now)
        const validFact = await cortex.facts.store({
          memorySpaceId: TEMPORAL_SPACE,
          fact: "Currently valid fact",
          factType: "knowledge",
          subject: "user-validat-test",
          confidence: 85,
          sourceType: "system",
          validFrom: pastStart,
          validUntil: futureEnd,
          tags: ["validat-test"],
        });

        // Query with validAt = now
        const results = await cortex.facts.list({
          memorySpaceId: TEMPORAL_SPACE,
          validAt: new Date(now),
          tags: ["validat-test"],
        });

        expect(results.length).toBeGreaterThanOrEqual(1);
        expect(results.some((f) => f.factId === validFact.factId)).toBe(true);
      });

      it("should exclude expired facts from validAt query", async () => {
        const now = Date.now();
        const pastStart = now - 172800000; // 48 hours ago
        const pastEnd = now - 86400000; // 24 hours ago (expired)

        // Create expired fact
        const expiredFact = await cortex.facts.store({
          memorySpaceId: TEMPORAL_SPACE,
          fact: "Expired fact",
          factType: "knowledge",
          subject: "user-expired-test",
          confidence: 80,
          sourceType: "system",
          validFrom: pastStart,
          validUntil: pastEnd,
          tags: ["expired-test"],
        });

        // Query with validAt = now (should NOT find expired fact)
        const results = await cortex.facts.list({
          memorySpaceId: TEMPORAL_SPACE,
          validAt: new Date(now),
          tags: ["expired-test"],
        });

        expect(results.some((f) => f.factId === expiredFact.factId)).toBe(
          false,
        );
      });

      it("should exclude future facts from validAt query", async () => {
        const now = Date.now();
        const futureStart = now + 86400000; // Starts 24 hours from now
        const futureEnd = now + 172800000; // Ends 48 hours from now

        // Create future fact (not yet valid)
        const futureFact = await cortex.facts.store({
          memorySpaceId: TEMPORAL_SPACE,
          fact: "Future fact",
          factType: "knowledge",
          subject: "user-future-test",
          confidence: 80,
          sourceType: "system",
          validFrom: futureStart,
          validUntil: futureEnd,
          tags: ["future-test"],
        });

        // Query with validAt = now (should NOT find future fact)
        const results = await cortex.facts.list({
          memorySpaceId: TEMPORAL_SPACE,
          validAt: new Date(now),
          tags: ["future-test"],
        });

        expect(results.some((f) => f.factId === futureFact.factId)).toBe(false);
      });

      it("should find fact at exact boundary timestamp (validFrom)", async () => {
        const exactTime = Date.now() + 1000; // 1 second from now to avoid race
        const validUntil = exactTime + 86400000;

        const fact = await cortex.facts.store({
          memorySpaceId: TEMPORAL_SPACE,
          fact: "Exact boundary fact",
          factType: "knowledge",
          subject: "user-boundary-test",
          confidence: 85,
          sourceType: "system",
          validFrom: exactTime,
          validUntil,
          tags: ["boundary-test"],
        });

        // Wait for exactTime
        await new Promise((resolve) => setTimeout(resolve, 1100));

        // Query at exact validFrom time
        const results = await cortex.facts.list({
          memorySpaceId: TEMPORAL_SPACE,
          validAt: new Date(exactTime),
          tags: ["boundary-test"],
        });

        expect(results.some((f) => f.factId === fact.factId)).toBe(true);
      });

      it("should NOT find fact at exact boundary timestamp (validUntil)", async () => {
        const now = Date.now();
        const validFrom = now - 86400000; // Started 24 hours ago
        const validUntil = now + 100; // Expires in 100ms

        const fact = await cortex.facts.store({
          memorySpaceId: TEMPORAL_SPACE,
          fact: "Expiring soon fact",
          factType: "knowledge",
          subject: "user-expiring-test",
          confidence: 85,
          sourceType: "system",
          validFrom,
          validUntil,
          tags: ["expiring-test"],
        });

        // Wait for expiration
        await new Promise((resolve) => setTimeout(resolve, 200));

        // Query after validUntil
        const results = await cortex.facts.list({
          memorySpaceId: TEMPORAL_SPACE,
          validAt: new Date(validUntil + 50),
          tags: ["expiring-test"],
        });

        expect(results.some((f) => f.factId === fact.factId)).toBe(false);
      });
    });

    describe("validAt with different operations", () => {
      it("should use validAt filter in search()", async () => {
        const now = Date.now();
        const SEARCH_SPACE = ctx.memorySpaceId("search-temporal");

        // Create valid fact
        await cortex.facts.store({
          memorySpaceId: SEARCH_SPACE,
          fact: "TEMPORAL_SEARCH currently valid",
          factType: "knowledge",
          subject: "user-search-temporal",
          confidence: 85,
          sourceType: "system",
          validFrom: now - 86400000,
          validUntil: now + 86400000,
          tags: ["search-temporal"],
        });

        // Create expired fact with same search term
        await cortex.facts.store({
          memorySpaceId: SEARCH_SPACE,
          fact: "TEMPORAL_SEARCH expired",
          factType: "knowledge",
          subject: "user-search-temporal",
          confidence: 80,
          sourceType: "system",
          validFrom: now - 172800000,
          validUntil: now - 86400000, // Expired
          tags: ["search-temporal"],
        });

        // Search with validAt
        const results = await cortex.facts.search(
          SEARCH_SPACE,
          "TEMPORAL_SEARCH",
          { validAt: new Date(now) },
        );

        // Should only find the valid fact
        expect(results.length).toBeGreaterThanOrEqual(1);
        expect(results.every((f) => f.fact.includes("currently valid"))).toBe(
          true,
        );
      });

      it("should use validAt filter in queryBySubject()", async () => {
        const now = Date.now();
        const SUBJECT = "user-queryby-temporal";
        const QUERY_SPACE = ctx.memorySpaceId("query-temporal");

        // Create valid fact
        await cortex.facts.store({
          memorySpaceId: QUERY_SPACE,
          fact: "Subject's valid fact",
          factType: "preference",
          subject: SUBJECT,
          confidence: 90,
          sourceType: "conversation",
          validFrom: now - 86400000,
          validUntil: now + 86400000,
        });

        // Create expired fact for same subject
        await cortex.facts.store({
          memorySpaceId: QUERY_SPACE,
          fact: "Subject's expired fact",
          factType: "knowledge",
          subject: SUBJECT,
          confidence: 85,
          sourceType: "system",
          validFrom: now - 172800000,
          validUntil: now - 86400000, // Expired
        });

        // Query by subject with validAt
        const results = await cortex.facts.queryBySubject({
          memorySpaceId: QUERY_SPACE,
          subject: SUBJECT,
          validAt: new Date(now),
        });

        // Should only find valid fact
        expect(results.length).toBe(1);
        expect(results[0].fact).toBe("Subject's valid fact");
      });

      it("should use validAt filter in count()", async () => {
        const now = Date.now();
        const COUNT_SPACE = ctx.memorySpaceId("count-temporal");

        // Create 3 valid facts
        for (let i = 0; i < 3; i++) {
          await cortex.facts.store({
            memorySpaceId: COUNT_SPACE,
            fact: `Valid fact ${i}`,
            factType: "knowledge",
            subject: "user-count-temporal",
            confidence: 80,
            sourceType: "system",
            validFrom: now - 86400000,
            validUntil: now + 86400000,
            tags: ["count-temporal"],
          });
        }

        // Create 2 expired facts
        for (let i = 0; i < 2; i++) {
          await cortex.facts.store({
            memorySpaceId: COUNT_SPACE,
            fact: `Expired fact ${i}`,
            factType: "knowledge",
            subject: "user-count-temporal",
            confidence: 80,
            sourceType: "system",
            validFrom: now - 172800000,
            validUntil: now - 86400000, // Expired
            tags: ["count-temporal"],
          });
        }

        // Count with validAt
        const count = await cortex.facts.count({
          memorySpaceId: COUNT_SPACE,
          validAt: new Date(now),
          tags: ["count-temporal"],
        });

        expect(count).toBe(3); // Only valid facts
      });
    });

    describe("Facts without validity period", () => {
      it("should include facts without validUntil in validAt queries (default validFrom)", async () => {
        const now = Date.now();
        const NO_VALIDITY_SPACE = ctx.memorySpaceId("no-validity");

        // Create fact without explicit validFrom/validUntil
        // Backend automatically sets validFrom to creation time, validUntil stays undefined
        const alwaysValidFact = await cortex.facts.store({
          memorySpaceId: NO_VALIDITY_SPACE,
          fact: "Always valid fact",
          factType: "knowledge",
          subject: "user-always-valid",
          confidence: 85,
          sourceType: "system",
          // No explicit validFrom/validUntil provided
          tags: ["always-valid-test"],
        });

        // Verify fact was created with auto-set validFrom (backend defaults to now)
        const directGet = await cortex.facts.get(
          NO_VALIDITY_SPACE,
          alwaysValidFact.factId,
        );
        expect(directGet).not.toBeNull();
        // validFrom is automatically set by backend to creation time
        expect(directGet!.validFrom).toBeDefined();
        expect(directGet!.validFrom).toBeLessThanOrEqual(Date.now());
        // validUntil should be undefined (no expiry)
        expect(directGet!.validUntil).toBeUndefined();

        // Query without validAt first to confirm fact exists in list
        const resultsWithoutValidAt = await cortex.facts.list({
          memorySpaceId: NO_VALIDITY_SPACE,
          tags: ["always-valid-test"],
        });
        expect(
          resultsWithoutValidAt.some(
            (f) => f.factId === alwaysValidFact.factId,
          ),
        ).toBe(true);

        // Query with validAt - facts without validUntil (no expiry) should be included
        // Backend logic: (validFrom <= validAt) && (!validUntil || validUntil > validAt)
        const results = await cortex.facts.list({
          memorySpaceId: NO_VALIDITY_SPACE,
          validAt: new Date(now + 1000), // Shortly after creation
          tags: ["always-valid-test"],
        });

        // Should find the fact (no validUntil = never expires)
        expect(results.length).toBeGreaterThan(0);
        expect(results.some((f) => f.factId === alwaysValidFact.factId)).toBe(
          true,
        );
      });

      it("should include facts with only validFrom (no expiry)", async () => {
        const now = Date.now();
        const OPEN_END_SPACE = ctx.memorySpaceId("open-end");

        // Create fact with validFrom but no validUntil (open-ended)
        const openEndedFact = await cortex.facts.store({
          memorySpaceId: OPEN_END_SPACE,
          fact: "Open-ended validity fact",
          factType: "knowledge",
          subject: "user-open-end",
          confidence: 85,
          sourceType: "system",
          validFrom: now - 86400000, // Started 24 hours ago
          // No validUntil - never expires
          tags: ["open-end-test"],
        });

        // Query far in the future
        const futureDate = new Date(now + 365 * 86400000); // 1 year from now
        const results = await cortex.facts.list({
          memorySpaceId: OPEN_END_SPACE,
          validAt: futureDate,
          tags: ["open-end-test"],
        });

        // Should still find the fact (no expiry)
        expect(results.some((f) => f.factId === openEndedFact.factId)).toBe(
          true,
        );
      });
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // deleteMany() Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("deleteMany()", () => {
    const DELETE_MANY_SPACE = ctx.memorySpaceId("delete-many");

    describe("Happy Path", () => {
      it("should delete all facts in a memory space", async () => {
        // Create multiple facts
        const _facts = await Promise.all([
          cortex.facts.store({
            memorySpaceId: DELETE_MANY_SPACE,
            fact: "Fact to delete 1",
            factType: "knowledge",
            confidence: 80,
            sourceType: "system",
            tags: ["delete-all-test"],
          }),
          cortex.facts.store({
            memorySpaceId: DELETE_MANY_SPACE,
            fact: "Fact to delete 2",
            factType: "preference",
            confidence: 85,
            sourceType: "system",
            tags: ["delete-all-test"],
          }),
          cortex.facts.store({
            memorySpaceId: DELETE_MANY_SPACE,
            fact: "Fact to delete 3",
            factType: "identity",
            confidence: 90,
            sourceType: "system",
            tags: ["delete-all-test"],
          }),
        ]);

        // Delete all facts in space
        const result = await cortex.facts.deleteMany({
          memorySpaceId: DELETE_MANY_SPACE,
        });

        expect(result.deleted).toBe(3);
        expect(result.memorySpaceId).toBe(DELETE_MANY_SPACE);

        // Verify all facts are deleted
        const remaining = await cortex.facts.list({
          memorySpaceId: DELETE_MANY_SPACE,
        });
        expect(remaining.length).toBe(0);
      });

      it("should delete facts filtered by userId", async () => {
        const TARGET_USER = `user-delete-${Date.now()}`;
        const OTHER_USER = `user-other-${Date.now()}`;
        const SPACE = ctx.memorySpaceId("delete-by-user");

        // Create facts for different users
        await cortex.facts.store({
          memorySpaceId: SPACE,
          userId: TARGET_USER,
          fact: "Target user fact 1",
          factType: "knowledge",
          confidence: 80,
          sourceType: "system",
        });
        await cortex.facts.store({
          memorySpaceId: SPACE,
          userId: TARGET_USER,
          fact: "Target user fact 2",
          factType: "preference",
          confidence: 85,
          sourceType: "system",
        });
        await cortex.facts.store({
          memorySpaceId: SPACE,
          userId: OTHER_USER,
          fact: "Other user fact",
          factType: "knowledge",
          confidence: 90,
          sourceType: "system",
        });

        // Delete only target user's facts
        const result = await cortex.facts.deleteMany({
          memorySpaceId: SPACE,
          userId: TARGET_USER,
        });

        expect(result.deleted).toBe(2);

        // Verify target user facts deleted
        const targetUserFacts = await cortex.facts.list({
          memorySpaceId: SPACE,
          userId: TARGET_USER,
        });
        expect(targetUserFacts.length).toBe(0);

        // Verify other user's fact still exists
        const otherUserFacts = await cortex.facts.list({
          memorySpaceId: SPACE,
          userId: OTHER_USER,
        });
        expect(otherUserFacts.length).toBe(1);
      });

      it("should delete facts filtered by factType", async () => {
        const SPACE = ctx.memorySpaceId("delete-by-type");

        // Create facts of different types
        await cortex.facts.store({
          memorySpaceId: SPACE,
          fact: "Knowledge fact 1",
          factType: "knowledge",
          confidence: 80,
          sourceType: "system",
        });
        await cortex.facts.store({
          memorySpaceId: SPACE,
          fact: "Knowledge fact 2",
          factType: "knowledge",
          confidence: 85,
          sourceType: "system",
        });
        await cortex.facts.store({
          memorySpaceId: SPACE,
          fact: "Preference fact",
          factType: "preference",
          confidence: 90,
          sourceType: "system",
        });

        // Delete only knowledge facts
        const result = await cortex.facts.deleteMany({
          memorySpaceId: SPACE,
          factType: "knowledge",
        });

        expect(result.deleted).toBe(2);

        // Verify knowledge facts deleted
        const knowledgeFacts = await cortex.facts.list({
          memorySpaceId: SPACE,
          factType: "knowledge",
        });
        expect(knowledgeFacts.length).toBe(0);

        // Verify preference fact still exists
        const preferenceFacts = await cortex.facts.list({
          memorySpaceId: SPACE,
          factType: "preference",
        });
        expect(preferenceFacts.length).toBe(1);
      });

      it("should delete facts filtered by both userId and factType", async () => {
        const TARGET_USER = `user-combo-${Date.now()}`;
        const SPACE = ctx.memorySpaceId("delete-combo");

        // Create mix of facts
        await cortex.facts.store({
          memorySpaceId: SPACE,
          userId: TARGET_USER,
          fact: "Target knowledge",
          factType: "knowledge",
          confidence: 80,
          sourceType: "system",
        });
        await cortex.facts.store({
          memorySpaceId: SPACE,
          userId: TARGET_USER,
          fact: "Target preference",
          factType: "preference",
          confidence: 85,
          sourceType: "system",
        });
        await cortex.facts.store({
          memorySpaceId: SPACE,
          userId: "other-user",
          fact: "Other knowledge",
          factType: "knowledge",
          confidence: 90,
          sourceType: "system",
        });

        // Delete only target user's knowledge facts
        const result = await cortex.facts.deleteMany({
          memorySpaceId: SPACE,
          userId: TARGET_USER,
          factType: "knowledge",
        });

        expect(result.deleted).toBe(1);

        // Verify correct deletion
        const allFacts = await cortex.facts.list({
          memorySpaceId: SPACE,
        });
        expect(allFacts.length).toBe(2);
      });

      it("should return zero when no facts match filters", async () => {
        const SPACE = ctx.memorySpaceId("delete-empty");

        // Create a fact
        await cortex.facts.store({
          memorySpaceId: SPACE,
          userId: "existing-user",
          fact: "Existing fact",
          factType: "knowledge",
          confidence: 80,
          sourceType: "system",
        });

        // Delete with non-matching userId
        const result = await cortex.facts.deleteMany({
          memorySpaceId: SPACE,
          userId: "non-existent-user",
        });

        expect(result.deleted).toBe(0);
        expect(result.memorySpaceId).toBe(SPACE);

        // Original fact still exists
        const facts = await cortex.facts.list({
          memorySpaceId: SPACE,
        });
        expect(facts.length).toBe(1);
      });

      it("should return correct result structure", async () => {
        const SPACE = ctx.memorySpaceId("delete-result");

        await cortex.facts.store({
          memorySpaceId: SPACE,
          fact: "Test fact",
          factType: "knowledge",
          confidence: 80,
          sourceType: "system",
        });

        const result = await cortex.facts.deleteMany({
          memorySpaceId: SPACE,
        });

        // Verify result structure
        expect(result).toHaveProperty("deleted");
        expect(result).toHaveProperty("memorySpaceId");
        expect(typeof result.deleted).toBe("number");
        expect(result.memorySpaceId).toBe(SPACE);
      });
    });

    describe("Validation", () => {
      it("should throw on missing memorySpaceId", async () => {
        await expect(
          cortex.facts.deleteMany({
            memorySpaceId: "",
          }),
        ).rejects.toThrow("memorySpaceId is required and cannot be empty");
      });

      it("should throw on invalid factType", async () => {
        await expect(
          cortex.facts.deleteMany({
            memorySpaceId: TEST_MEMSPACE_ID,
            factType: "invalid-type" as any,
          }),
        ).rejects.toThrow("Invalid factType");
      });
    });
  });
});
