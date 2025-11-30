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
import {
  createNamedTestRunContext,
  ScopedCleanup,
} from "./helpers";

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
});
