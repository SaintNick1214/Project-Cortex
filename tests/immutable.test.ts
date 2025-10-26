/**
 * E2E Tests: Immutable Store API (Layer 1b)
 *
 * Tests validate:
 * - SDK API calls
 * - Convex mutations/queries
 * - Storage validation
 * - Versioning behavior
 */

import { Cortex } from "../src";
import { ConvexClient } from "convex/browser";
import { api } from "../convex-dev/_generated/api";
import { TestCleanup } from "./helpers";

// Extend TestCleanup for immutable table
class ImmutableTestCleanup extends TestCleanup {
  async purgeImmutable(): Promise<number> {
    console.log("🧹 Purging immutable table...");
    const entries = await this.client.query(api.immutable.list, {});

    let deleted = 0;
    for (const entry of entries) {
      try {
        await this.client.mutation(api.immutable.purge, {
          type: entry.type,
          id: entry.id,
        });
        deleted++;
      } catch (error: any) {
        if (error.message?.includes("IMMUTABLE_ENTRY_NOT_FOUND")) {
          continue;
        }
        throw error;
      }
    }

    console.log(`✅ Purged ${deleted} immutable entries`);
    return deleted;
  }

  async verifyImmutableEmpty(): Promise<void> {
    const count = await this.client.query(api.immutable.count, {});
    if (count > 0) {
      console.warn(
        `⚠️  Warning: Immutable table not empty (${count} entries remaining)`,
      );
    } else {
      console.log("✅ Immutable table is empty");
    }
  }
}

describe("Immutable Store API (Layer 1b)", () => {
  let cortex: Cortex;
  let client: ConvexClient;
  let cleanup: ImmutableTestCleanup;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL not set");
    }

    cortex = new Cortex({ convexUrl });
    client = new ConvexClient(convexUrl);
    cleanup = new ImmutableTestCleanup(client);

    // Clean table before tests
    await cleanup.purgeImmutable();
    await cleanup.verifyImmutableEmpty();
  });

  afterAll(async () => {
    await client.close();
  });

  describe("store()", () => {
    it("creates version 1 for new entry", async () => {
      const result = await cortex.immutable.store({
        type: "kb-article",
        id: "refund-policy",
        data: {
          title: "Refund Policy",
          content: "Refunds available within 30 days",
        },
        metadata: {
          publishedBy: "admin",
          tags: ["policy", "refunds"],
        },
      });

      // Validate SDK response
      expect(result.type).toBe("kb-article");
      expect(result.id).toBe("refund-policy");
      expect(result.version).toBe(1);
      expect(result.data.title).toBe("Refund Policy");
      expect(result.previousVersions).toEqual([]);
      expect(result.createdAt).toBeGreaterThan(0);
      expect(result.updatedAt).toBeGreaterThan(0);

      // Validate Convex storage
      const stored = await client.query(api.immutable.get, {
        type: "kb-article",
        id: "refund-policy",
      });

      expect(stored).not.toBeNull();
      expect(stored!.version).toBe(1);
      expect(stored!.previousVersions).toHaveLength(0);
    });

    it("increments version for existing entry", async () => {
      // Create v1
      const v1 = await cortex.immutable.store({
        type: "kb-article",
        id: "warranty-policy",
        data: {
          title: "Warranty Policy",
          duration: "30 days",
        },
      });

      expect(v1.version).toBe(1);

      // Update to v2
      const v2 = await cortex.immutable.store({
        type: "kb-article",
        id: "warranty-policy",
        data: {
          title: "Warranty Policy Updated",
          duration: "60 days",
        },
      });

      // Validate v2
      expect(v2.version).toBe(2);
      expect(v2.data.duration).toBe("60 days");
      expect(v2.previousVersions).toHaveLength(1);
      expect(v2.previousVersions[0].version).toBe(1);
      expect(v2.previousVersions[0].data.duration).toBe("30 days");

      // Validate storage
      const stored = await client.query(api.immutable.get, {
        type: "kb-article",
        id: "warranty-policy",
      });

      expect(stored!.version).toBe(2);
      expect(stored!.previousVersions).toHaveLength(1);
    });

    it("stores entry with userId for GDPR compliance", async () => {
      const result = await cortex.immutable.store({
        type: "feedback",
        id: "feedback-001",
        userId: "user-123",
        data: {
          rating: 5,
          comment: "Great service!",
        },
      });

      expect(result.userId).toBe("user-123");

      // Validate storage
      const stored = await client.query(api.immutable.get, {
        type: "feedback",
        id: "feedback-001",
      });

      expect(stored!.userId).toBe("user-123");
    });

    it("preserves metadata across versions", async () => {
      const v1 = await cortex.immutable.store({
        type: "policy",
        id: "privacy-policy",
        data: { content: "v1" },
        metadata: {
          publishedBy: "admin",
          tags: ["privacy"],
          importance: 90,
        },
      });

      const v2 = await cortex.immutable.store({
        type: "policy",
        id: "privacy-policy",
        data: { content: "v2" },
        // Not providing metadata - should preserve from v1
      });

      expect(v2.metadata?.publishedBy).toBe("admin");
      expect(v2.metadata?.tags).toContain("privacy");
    });
  });

  describe("get()", () => {
    it("retrieves current version of entry", async () => {
      // Create entry
      await cortex.immutable.store({
        type: "kb-article",
        id: "shipping-policy",
        data: {
          title: "Shipping Policy",
          freeShippingOver: 50,
        },
      });

      // Retrieve it
      const retrieved = await cortex.immutable.get(
        "kb-article",
        "shipping-policy",
      );

      expect(retrieved).not.toBeNull();
      expect(retrieved!.type).toBe("kb-article");
      expect(retrieved!.id).toBe("shipping-policy");
      expect(retrieved!.version).toBe(1);
      expect(retrieved!.data.freeShippingOver).toBe(50);
    });

    it("returns null for non-existent entry", async () => {
      const result = await cortex.immutable.get("kb-article", "does-not-exist");
      expect(result).toBeNull();
    });

    it("returns latest version after updates", async () => {
      // Create v1
      await cortex.immutable.store({
        type: "config",
        id: "app-settings",
        data: { darkMode: false },
      });

      // Update to v2
      await cortex.immutable.store({
        type: "config",
        id: "app-settings",
        data: { darkMode: true },
      });

      // Get should return v2
      const current = await cortex.immutable.get("config", "app-settings");

      expect(current!.version).toBe(2);
      expect(current!.data.darkMode).toBe(true);
    });
  });

  describe("getVersion()", () => {
    beforeAll(async () => {
      // Create entry with multiple versions
      await cortex.immutable.store({
        type: "kb-article",
        id: "terms-of-service",
        data: { content: "Version 1" },
      });

      await cortex.immutable.store({
        type: "kb-article",
        id: "terms-of-service",
        data: { content: "Version 2" },
      });

      await cortex.immutable.store({
        type: "kb-article",
        id: "terms-of-service",
        data: { content: "Version 3" },
      });
    });

    it("retrieves specific version", async () => {
      const v1 = await cortex.immutable.getVersion(
        "kb-article",
        "terms-of-service",
        1,
      );

      expect(v1).not.toBeNull();
      expect(v1!.version).toBe(1);
      expect(v1!.data.content).toBe("Version 1");
    });

    it("retrieves middle version", async () => {
      const v2 = await cortex.immutable.getVersion(
        "kb-article",
        "terms-of-service",
        2,
      );

      expect(v2).not.toBeNull();
      expect(v2!.version).toBe(2);
      expect(v2!.data.content).toBe("Version 2");
    });

    it("retrieves current version", async () => {
      const v3 = await cortex.immutable.getVersion(
        "kb-article",
        "terms-of-service",
        3,
      );

      expect(v3).not.toBeNull();
      expect(v3!.version).toBe(3);
      expect(v3!.data.content).toBe("Version 3");
    });

    it("returns null for non-existent version", async () => {
      const v99 = await cortex.immutable.getVersion(
        "kb-article",
        "terms-of-service",
        99,
      );

      expect(v99).toBeNull();
    });

    it("returns null for non-existent entry", async () => {
      const result = await cortex.immutable.getVersion(
        "kb-article",
        "does-not-exist",
        1,
      );

      expect(result).toBeNull();
    });
  });

  describe("getHistory()", () => {
    beforeAll(async () => {
      // Create entry with 5 versions
      for (let i = 1; i <= 5; i++) {
        await cortex.immutable.store({
          type: "audit-log",
          id: "system-changes",
          data: {
            change: `Change ${i}`,
            timestamp: Date.now(),
          },
        });
      }
    });

    it("retrieves all versions in order", async () => {
      const history = await cortex.immutable.getHistory(
        "audit-log",
        "system-changes",
      );

      expect(history).toHaveLength(5);

      // Check versions are in order
      for (let i = 0; i < history.length; i++) {
        expect(history[i].version).toBe(i + 1);
        expect(history[i].data.change).toBe(`Change ${i + 1}`);
      }
    });

    it("includes all version metadata", async () => {
      const history = await cortex.immutable.getHistory(
        "audit-log",
        "system-changes",
      );

      history.forEach((version) => {
        expect(version.type).toBe("audit-log");
        expect(version.id).toBe("system-changes");
        expect(version.timestamp).toBeGreaterThan(0);
        expect(version.createdAt).toBeGreaterThan(0);
      });
    });

    it("returns empty array for non-existent entry", async () => {
      const history = await cortex.immutable.getHistory(
        "audit-log",
        "does-not-exist",
      );

      expect(history).toEqual([]);
    });
  });

  describe("list()", () => {
    beforeAll(async () => {
      // Create test data
      await cortex.immutable.store({
        type: "kb-article",
        id: "article-1",
        data: { title: "Article 1" },
      });

      await cortex.immutable.store({
        type: "kb-article",
        id: "article-2",
        data: { title: "Article 2" },
      });

      await cortex.immutable.store({
        type: "policy",
        id: "policy-1",
        data: { title: "Policy 1" },
      });

      await cortex.immutable.store({
        type: "feedback",
        id: "feedback-1",
        userId: "user-list-test",
        data: { rating: 5 },
      });

      await cortex.immutable.store({
        type: "feedback",
        id: "feedback-2",
        userId: "user-list-test",
        data: { rating: 4 },
      });
    });

    it("lists all entries (no filter)", async () => {
      const entries = await cortex.immutable.list();

      expect(entries.length).toBeGreaterThan(0);
    });

    it("filters by type", async () => {
      const articles = await cortex.immutable.list({
        type: "kb-article",
      });

      expect(articles.length).toBeGreaterThanOrEqual(2);
      articles.forEach((entry) => {
        expect(entry.type).toBe("kb-article");
      });
    });

    it("filters by userId", async () => {
      const userEntries = await cortex.immutable.list({
        userId: "user-list-test",
      });

      expect(userEntries.length).toBeGreaterThanOrEqual(2);
      userEntries.forEach((entry) => {
        expect(entry.userId).toBe("user-list-test");
      });
    });

    it("respects limit parameter", async () => {
      const limited = await cortex.immutable.list({
        limit: 2,
      });

      expect(limited.length).toBeLessThanOrEqual(2);
    });
  });

  describe("search()", () => {
    beforeAll(async () => {
      // Create searchable content
      await cortex.immutable.store({
        type: "kb-article",
        id: "refund-guide",
        data: {
          title: "Refund Guide",
          content: "How to request a refund for your purchase",
        },
      });

      await cortex.immutable.store({
        type: "kb-article",
        id: "return-guide",
        data: {
          title: "Return Guide",
          content: "How to return items without a refund",
        },
      });

      await cortex.immutable.store({
        type: "kb-article",
        id: "shipping-guide",
        data: {
          title: "Shipping Guide",
          content: "Shipping information and tracking",
        },
      });
    });

    it("finds entries containing search query", async () => {
      const results = await cortex.immutable.search({
        query: "refund",
      });

      expect(results.length).toBeGreaterThanOrEqual(2);

      // All results should contain "refund"
      results.forEach((result) => {
        const dataString = JSON.stringify(result.entry.data).toLowerCase();
        expect(dataString).toContain("refund");
      });
    });

    it("filters by type", async () => {
      const results = await cortex.immutable.search({
        query: "guide",
        type: "kb-article",
      });

      expect(results.length).toBeGreaterThan(0);
      results.forEach((result) => {
        expect(result.entry.type).toBe("kb-article");
      });
    });

    it("includes highlights", async () => {
      const results = await cortex.immutable.search({
        query: "shipping",
        limit: 1,
      });

      expect(results[0].highlights.length).toBeGreaterThan(0);
      results[0].highlights.forEach((highlight) => {
        expect(highlight.toLowerCase()).toContain("shipping");
      });
    });

    it("returns empty array when no matches", async () => {
      const results = await cortex.immutable.search({
        query: "nonexistent-xyz-query",
      });

      expect(results).toEqual([]);
    });

    it("respects limit parameter", async () => {
      const results = await cortex.immutable.search({
        query: "guide",
        limit: 1,
      });

      expect(results.length).toBeLessThanOrEqual(1);
    });
  });

  describe("count()", () => {
    beforeAll(async () => {
      // Create entries for counting
      await cortex.immutable.store({
        type: "count-test",
        id: "entry-1",
        data: { value: 1 },
      });

      await cortex.immutable.store({
        type: "count-test",
        id: "entry-2",
        data: { value: 2 },
      });

      await cortex.immutable.store({
        type: "other-type",
        id: "entry-3",
        data: { value: 3 },
      });
    });

    it("counts all entries", async () => {
      const total = await cortex.immutable.count();

      expect(total).toBeGreaterThan(0);
    });

    it("counts by type", async () => {
      const count = await cortex.immutable.count({
        type: "count-test",
      });

      expect(count).toBeGreaterThanOrEqual(2);
    });

    it("counts by userId", async () => {
      // Create user-specific entry
      await cortex.immutable.store({
        type: "user-data",
        id: "data-1",
        userId: "user-count-test",
        data: { value: 1 },
      });

      const count = await cortex.immutable.count({
        userId: "user-count-test",
      });

      expect(count).toBeGreaterThanOrEqual(1);
    });
  });

  describe("purge()", () => {
    it("deletes an immutable entry and all versions", async () => {
      // Create entry with multiple versions
      await cortex.immutable.store({
        type: "temp-data",
        id: "delete-test",
        data: { version: 1 },
      });

      await cortex.immutable.store({
        type: "temp-data",
        id: "delete-test",
        data: { version: 2 },
      });

      await cortex.immutable.store({
        type: "temp-data",
        id: "delete-test",
        data: { version: 3 },
      });

      // Verify it exists
      const before = await cortex.immutable.get("temp-data", "delete-test");
      expect(before).not.toBeNull();
      expect(before!.version).toBe(3);

      // Delete it
      const result = await cortex.immutable.purge("temp-data", "delete-test");

      expect(result.deleted).toBe(true);
      expect(result.versionsDeleted).toBe(3);

      // Verify deletion
      const after = await cortex.immutable.get("temp-data", "delete-test");
      expect(after).toBeNull();
    });

    it("throws error for non-existent entry", async () => {
      await expect(
        cortex.immutable.purge("temp-data", "does-not-exist"),
      ).rejects.toThrow("IMMUTABLE_ENTRY_NOT_FOUND");
    });
  });

  describe("Versioning", () => {
    it("maintains version history correctly", async () => {
      const type = "versioning-test";
      const id = "history-test";

      // Create 10 versions
      for (let i = 1; i <= 10; i++) {
        await cortex.immutable.store({
          type,
          id,
          data: {
            version: i,
            content: `Content for version ${i}`,
          },
        });
      }

      // Get current (should be v10)
      const current = await cortex.immutable.get(type, id);
      expect(current!.version).toBe(10);
      expect(current!.previousVersions).toHaveLength(9);

      // Get all history
      const history = await cortex.immutable.getHistory(type, id);
      expect(history).toHaveLength(10);

      // Verify each version
      for (let i = 0; i < history.length; i++) {
        expect(history[i].version).toBe(i + 1);
        expect(history[i].data.version).toBe(i + 1);
      }
    });

    it("preserves previous version timestamps", async () => {
      const type = "timestamp-test";
      const id = "timestamps";

      // Create v1
      await cortex.immutable.store({
        type,
        id,
        data: { value: 1 },
      });

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Create v2
      await cortex.immutable.store({
        type,
        id,
        data: { value: 2 },
      });

      // Get entry
      const entry = await cortex.immutable.get(type, id);

      expect(entry!.version).toBe(2);
      expect(entry!.previousVersions).toHaveLength(1);
      expect(entry!.previousVersions[0].timestamp).toBeLessThan(
        entry!.updatedAt,
      );
    });
  });

  describe("Storage Validation", () => {
    it("validates ACID properties", async () => {
      const type = "acid-test";
      const id = "acid-entry";

      // Create entry
      const created = await cortex.immutable.store({
        type,
        id,
        data: { value: "initial" },
      });

      // Update 5 times
      for (let i = 1; i <= 5; i++) {
        await cortex.immutable.store({
          type,
          id,
          data: { value: `update-${i}` },
        });
      }

      // Retrieve and validate
      const final = await cortex.immutable.get(type, id);

      // Atomicity: All versions are present
      expect(final!.version).toBe(6);
      expect(final!.previousVersions).toHaveLength(5);

      // Consistency: Version numbers are sequential
      for (let i = 0; i < final!.previousVersions.length; i++) {
        expect(final!.previousVersions[i].version).toBe(i + 1);
      }

      // Durability: Storage matches SDK response
      const stored = await client.query(api.immutable.get, {
        type,
        id,
      });

      expect(stored!.version).toBe(final!.version);
      expect(stored!.previousVersions.length).toBe(
        final!.previousVersions.length,
      );
    });
  });

  describe("GDPR Compliance", () => {
    it("supports userId for cascade deletion", async () => {
      // Create user-specific entries
      await cortex.immutable.store({
        type: "feedback",
        id: "gdpr-feedback-1",
        userId: "user-gdpr-test",
        data: { rating: 5 },
      });

      await cortex.immutable.store({
        type: "survey",
        id: "gdpr-survey-1",
        userId: "user-gdpr-test",
        data: { answers: ["yes", "no"] },
      });

      // Count user entries
      const count = await cortex.immutable.count({
        userId: "user-gdpr-test",
      });

      expect(count).toBeGreaterThanOrEqual(2);

      // List user entries
      const entries = await cortex.immutable.list({
        userId: "user-gdpr-test",
      });

      expect(entries.length).toBeGreaterThanOrEqual(2);
      entries.forEach((entry) => {
        expect(entry.userId).toBe("user-gdpr-test");
      });
    });
  });

  describe("State Change Propagation", () => {
    it("updates propagate to all read operations", async () => {
      const type = "propagation-test";
      const id = "state-change";

      // Create v1
      await cortex.immutable.store({
        type,
        id,
        data: {
          status: "draft",
          content: "Initial content",
          keywords: ["initial", "draft"],
        },
      });

      // Verify v1 in all operations
      let current = await cortex.immutable.get(type, id);
      expect(current!.version).toBe(1);
      expect(current!.data.status).toBe("draft");

      let history = await cortex.immutable.getHistory(type, id);
      expect(history).toHaveLength(1);

      let searchResults = await cortex.immutable.search({ query: "draft" });
      expect(searchResults.some((r) => r.entry.id === id)).toBe(true);

      // Update to v2
      await cortex.immutable.store({
        type,
        id,
        data: {
          status: "published",
          content: "Updated content",
          keywords: ["published", "updated"],
        },
      });

      // Verify v2 in all operations
      current = await cortex.immutable.get(type, id);
      expect(current!.version).toBe(2);
      expect(current!.data.status).toBe("published");

      history = await cortex.immutable.getHistory(type, id);
      expect(history).toHaveLength(2);
      expect(history[1].version).toBe(2);
      expect(history[1].data.status).toBe("published");

      // Search should find new content
      searchResults = await cortex.immutable.search({ query: "published" });
      expect(searchResults.some((r) => r.entry.id === id)).toBe(true);

      // Old search should NOT find it
      const draftResults = await cortex.immutable.search({ query: "draft" });
      const hasDraft = draftResults.some((r) => r.entry.id === id);
      expect(hasDraft).toBe(false); // "draft" no longer in current version

      // getVersion(1) should still have old data
      const v1 = await cortex.immutable.getVersion(type, id, 1);
      expect(v1!.data.status).toBe("draft");
    });

    it("list operations reflect updates immediately", async () => {
      const type = "list-propagation-test";

      // Create multiple entries
      await cortex.immutable.store({
        type,
        id: "entry-1",
        data: { value: 1 },
      });

      await cortex.immutable.store({
        type,
        id: "entry-2",
        data: { value: 2 },
      });

      // List should show 2
      let list = await cortex.immutable.list({ type });
      expect(list.length).toBe(2);

      // Count should show 2
      let count = await cortex.immutable.count({ type });
      expect(count).toBe(2);

      // Add third entry
      await cortex.immutable.store({
        type,
        id: "entry-3",
        data: { value: 3 },
      });

      // List should immediately show 3
      list = await cortex.immutable.list({ type });
      expect(list.length).toBe(3);

      // Count should immediately show 3
      count = await cortex.immutable.count({ type });
      expect(count).toBe(3);

      // Delete one
      await cortex.immutable.purge(type, "entry-2");

      // List should immediately show 2
      list = await cortex.immutable.list({ type });
      expect(list.length).toBe(2);
      expect(list.some((e) => e.id === "entry-2")).toBe(false);

      // Count should immediately show 2
      count = await cortex.immutable.count({ type });
      expect(count).toBe(2);
    });

    it("search reflects content changes across versions", async () => {
      const type = "search-propagation";
      const id = "article";

      // Create with keyword "apple"
      await cortex.immutable.store({
        type,
        id,
        data: {
          title: "Fruit Guide",
          content: "All about apples and their benefits",
        },
      });

      // Search for "apple" - should find it
      let results = await cortex.immutable.search({ query: "apple" });
      expect(results.some((r) => r.entry.id === id)).toBe(true);

      // Search for "orange" - should NOT find it
      results = await cortex.immutable.search({ query: "orange" });
      expect(results.some((r) => r.entry.id === id)).toBe(false);

      // Update to mention "orange" instead
      await cortex.immutable.store({
        type,
        id,
        data: {
          title: "Fruit Guide",
          content: "All about oranges and their benefits",
        },
      });

      // Search for "orange" - should NOW find it
      results = await cortex.immutable.search({ query: "orange" });
      expect(results.some((r) => r.entry.id === id)).toBe(true);

      // Search for "apple" - should NOT find it (current version)
      results = await cortex.immutable.search({ query: "apple" });
      expect(results.some((r) => r.entry.id === id)).toBe(false);
    });
  });

  describe("Edge Cases", () => {
    it("handles many versions (20+)", async () => {
      const type = "stress-test";
      const id = "many-versions";

      // Create 25 versions
      for (let i = 1; i <= 25; i++) {
        await cortex.immutable.store({
          type,
          id,
          data: {
            iteration: i,
            timestamp: Date.now(),
          },
        });
      }

      // Get current - should be v25
      const current = await cortex.immutable.get(type, id);
      expect(current!.version).toBe(25);
      expect(current!.data.iteration).toBe(25);
      expect(current!.previousVersions).toHaveLength(24);

      // Get history - should have all 25
      const history = await cortex.immutable.getHistory(type, id);
      expect(history).toHaveLength(25);

      // Verify each version
      for (let i = 0; i < history.length; i++) {
        expect(history[i].version).toBe(i + 1);
        expect(history[i].data.iteration).toBe(i + 1);
      }

      // Get specific versions
      const v1 = await cortex.immutable.getVersion(type, id, 1);
      expect(v1!.data.iteration).toBe(1);

      const v10 = await cortex.immutable.getVersion(type, id, 10);
      expect(v10!.data.iteration).toBe(10);

      const v25 = await cortex.immutable.getVersion(type, id, 25);
      expect(v25!.data.iteration).toBe(25);
    });

    it("handles empty data object", async () => {
      const result = await cortex.immutable.store({
        type: "empty-test",
        id: "empty-data",
        data: {},
      });

      expect(result.data).toEqual({});
      expect(result.version).toBe(1);

      const retrieved = await cortex.immutable.get("empty-test", "empty-data");
      expect(retrieved!.data).toEqual({});
    });

    it("handles large data objects", async () => {
      // Create ~10KB data object
      const largeData = {
        items: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          description: `Description for item ${i}`,
        })),
      };

      const result = await cortex.immutable.store({
        type: "large-test",
        id: "large-data",
        data: largeData,
      });

      expect(result.data.items).toHaveLength(1000);

      const retrieved = await cortex.immutable.get("large-test", "large-data");
      expect(retrieved!.data.items).toHaveLength(1000);
    });

    it("handles special characters in type and id", async () => {
      const result = await cortex.immutable.store({
        type: "test-type_with.special-chars",
        id: "test-id_123.456-789",
        data: { value: "special" },
      });

      expect(result.type).toBe("test-type_with.special-chars");
      expect(result.id).toBe("test-id_123.456-789");

      const retrieved = await cortex.immutable.get(
        "test-type_with.special-chars",
        "test-id_123.456-789",
      );
      expect(retrieved).not.toBeNull();
    });

    it("handles rapid sequential updates", async () => {
      const type = "rapid-test";
      const id = "rapid-updates";

      // Perform 10 rapid updates
      const promises = [];
      for (let i = 1; i <= 10; i++) {
        promises.push(
          cortex.immutable.store({
            type,
            id,
            data: { value: i },
          }),
        );
      }

      await Promise.all(promises);

      // Should have a version (might not be exactly 10 due to race conditions)
      const final = await cortex.immutable.get(type, id);
      expect(final!.version).toBeGreaterThan(0);
      expect(final!.version).toBeLessThanOrEqual(10);
    });
  });

  describe("Cross-Operation Integration", () => {
    it("store → list → search → count consistency", async () => {
      const type = "integration-test";
      const testId = "consistency-check";

      // Store entry
      await cortex.immutable.store({
        type,
        id: testId,
        data: {
          title: "Consistency Test",
          content: "Testing cross-operation consistency with keyword FINDME",
        },
      });

      // Verify in list
      const listResults = await cortex.immutable.list({ type });
      const inList = listResults.some((e) => e.id === testId);
      expect(inList).toBe(true);

      // Verify in search
      const searchResults = await cortex.immutable.search({
        query: "FINDME",
        type,
      });
      const inSearch = searchResults.some((r) => r.entry.id === testId);
      expect(inSearch).toBe(true);

      // Verify in count
      const count = await cortex.immutable.count({ type });
      expect(count).toBeGreaterThanOrEqual(1);

      // Update the entry
      await cortex.immutable.store({
        type,
        id: testId,
        data: {
          title: "Consistency Test Updated",
          content: "Updated content without the keyword",
        },
      });

      // List should still show it
      const listAfter = await cortex.immutable.list({ type });
      expect(listAfter.some((e) => e.id === testId)).toBe(true);

      // Search for old keyword should NOT find it
      const searchOld = await cortex.immutable.search({
        query: "FINDME",
        type,
      });
      expect(searchOld.some((r) => r.entry.id === testId)).toBe(false);

      // Search for new content should find it
      const searchNew = await cortex.immutable.search({
        query: "Updated",
        type,
      });
      expect(searchNew.some((r) => r.entry.id === testId)).toBe(true);

      // Count should be unchanged
      const countAfter = await cortex.immutable.count({ type });
      expect(countAfter).toBe(count);
    });

    it("version history accessible after many updates", async () => {
      const type = "history-access-test";
      const id = "historical-entry";

      // Create 15 versions with different searchable content
      const versions = [];
      for (let i = 1; i <= 15; i++) {
        const result = await cortex.immutable.store({
          type,
          id,
          data: {
            version: i,
            content: `Version ${i} content with keyword V${i}`,
            timestamp: Date.now(),
          },
        });
        versions.push(result);

        // Small delay to ensure distinct timestamps
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      // Current should be v15
      const current = await cortex.immutable.get(type, id);
      expect(current!.version).toBe(15);
      expect(current!.data.version).toBe(15);

      // Should be able to get ANY historical version
      for (let v = 1; v <= 15; v++) {
        const historical = await cortex.immutable.getVersion(type, id, v);
        expect(historical).not.toBeNull();
        expect(historical!.version).toBe(v);
        expect(historical!.data.version).toBe(v);
      }

      // Full history should have all 15
      const fullHistory = await cortex.immutable.getHistory(type, id);
      expect(fullHistory).toHaveLength(15);

      // Verify they're in chronological order
      for (let i = 1; i < fullHistory.length; i++) {
        expect(fullHistory[i].timestamp).toBeGreaterThanOrEqual(
          fullHistory[i - 1].timestamp,
        );
      }
    });

    it("metadata changes propagate correctly", async () => {
      const type = "metadata-test";
      const id = "meta-entry";

      // Create with initial metadata
      await cortex.immutable.store({
        type,
        id,
        data: { value: 1 },
        metadata: {
          tags: ["initial"],
          importance: 50,
        },
      });

      // Update data but not metadata (should preserve)
      await cortex.immutable.store({
        type,
        id,
        data: { value: 2 },
      });

      let current = await cortex.immutable.get(type, id);
      expect(current!.metadata?.tags).toContain("initial");
      expect(current!.metadata?.importance).toBe(50);

      // Update with new metadata
      await cortex.immutable.store({
        type,
        id,
        data: { value: 3 },
        metadata: {
          tags: ["updated"],
          importance: 80,
        },
      });

      current = await cortex.immutable.get(type, id);
      expect(current!.metadata?.tags).toContain("updated");
      expect(current!.metadata?.importance).toBe(80);
    });
  });

  describe("Advanced Operations", () => {
    describe("getAtTimestamp()", () => {
      let type: string;
      let id: string;
      let v1Timestamp: number;
      let v2Timestamp: number;
      let v3Timestamp: number;

      beforeAll(async () => {
        type = "temporal-test";
        id = "time-travel";

        // Create v1
        const v1 = await cortex.immutable.store({
          type,
          id,
          data: { value: "v1", status: "draft" },
        });
        v1Timestamp = v1.updatedAt;

        await new Promise((resolve) => setTimeout(resolve, 50));

        // Create v2
        const v2 = await cortex.immutable.store({
          type,
          id,
          data: { value: "v2", status: "review" },
        });
        v2Timestamp = v2.updatedAt;

        await new Promise((resolve) => setTimeout(resolve, 50));

        // Create v3
        const v3 = await cortex.immutable.store({
          type,
          id,
          data: { value: "v3", status: "published" },
        });
        v3Timestamp = v3.updatedAt;
      });

      it("returns current version for future timestamp", async () => {
        const future = Date.now() + 10000;
        const result = await cortex.immutable.getAtTimestamp(type, id, future);

        expect(result).not.toBeNull();
        expect(result!.version).toBe(3);
        expect(result!.data.value).toBe("v3");
      });

      it("returns correct version for timestamp between updates", async () => {
        // At v1 timestamp, should get v1
        const atV1 = await cortex.immutable.getAtTimestamp(
          type,
          id,
          v1Timestamp,
        );
        expect(atV1!.version).toBe(1);
        expect(atV1!.data.value).toBe("v1");

        // At v2 timestamp, should get v2
        const atV2 = await cortex.immutable.getAtTimestamp(
          type,
          id,
          v2Timestamp,
        );
        expect(atV2!.version).toBe(2);
        expect(atV2!.data.value).toBe("v2");

        // At v3 timestamp, should get v3
        const atV3 = await cortex.immutable.getAtTimestamp(
          type,
          id,
          v3Timestamp,
        );
        expect(atV3!.version).toBe(3);
        expect(atV3!.data.value).toBe("v3");
      });

      it("returns null for timestamp before creation", async () => {
        const past = v1Timestamp - 1000;
        const result = await cortex.immutable.getAtTimestamp(type, id, past);

        expect(result).toBeNull();
      });

      it("returns null for non-existent entry", async () => {
        const result = await cortex.immutable.getAtTimestamp(
          "type",
          "nonexistent",
          Date.now(),
        );

        expect(result).toBeNull();
      });
    });

    describe("purgeMany()", () => {
      beforeAll(async () => {
        // Create entries for bulk purge
        for (let i = 1; i <= 5; i++) {
          await cortex.immutable.store({
            type: "bulk-purge-test",
            id: `entry-${i}`,
            data: { value: i },
          });
        }

        for (let i = 1; i <= 3; i++) {
          await cortex.immutable.store({
            type: "bulk-purge-test",
            id: `user-entry-${i}`,
            userId: "user-purge-many",
            data: { value: i },
          });
        }
      });

      it("deletes multiple entries by type", async () => {
        const result = await cortex.immutable.purgeMany({
          type: "bulk-purge-test",
        });

        expect(result.deleted).toBeGreaterThanOrEqual(8);
        expect(result.entries.length).toBe(result.deleted);

        // Verify deletion
        const remaining = await cortex.immutable.list({
          type: "bulk-purge-test",
        });
        expect(remaining.length).toBe(0);
      });

      it("deletes by userId filter", async () => {
        // Create fresh user-specific entries
        await cortex.immutable.store({
          type: "user-data-unique",
          id: "data-1",
          userId: "user-purge-specific-unique",
          data: { value: 1 },
        });

        await cortex.immutable.store({
          type: "user-data-unique",
          id: "data-2",
          userId: "user-purge-specific-unique",
          data: { value: 2 },
        });

        // Verify count before
        const countBefore = await cortex.immutable.count({
          userId: "user-purge-specific-unique",
        });
        expect(countBefore).toBe(2);

        const result = await cortex.immutable.purgeMany({
          userId: "user-purge-specific-unique",
        });

        expect(result.deleted).toBe(2);

        // Verify deletion
        const remaining = await cortex.immutable.list({
          userId: "user-purge-specific-unique",
        });
        expect(remaining.length).toBe(0);
      });
    });

    describe("purgeVersions()", () => {
      it("deletes old versions while keeping recent ones", async () => {
        const type = "version-cleanup";
        const id = "pruned-entry";

        // Create 10 versions
        for (let i = 1; i <= 10; i++) {
          await cortex.immutable.store({
            type,
            id,
            data: { iteration: i },
          });
        }

        // Verify 10 versions exist
        const before = await cortex.immutable.get(type, id);
        expect(before!.version).toBe(10);
        expect(before!.previousVersions).toHaveLength(9);

        // Keep only latest 5
        const result = await cortex.immutable.purgeVersions(type, id, 5);

        expect(result.versionsPurged).toBe(5);
        expect(result.versionsRemaining).toBe(5);

        // Verify only 5 versions remain
        const after = await cortex.immutable.get(type, id);
        expect(after!.version).toBe(10); // Current version unchanged
        expect(after!.previousVersions).toHaveLength(4); // 4 previous + 1 current = 5

        // Old versions should be gone
        const v1 = await cortex.immutable.getVersion(type, id, 1);
        expect(v1).toBeNull();

        // Recent versions should exist
        const v10 = await cortex.immutable.getVersion(type, id, 10);
        expect(v10).not.toBeNull();
      });

      it("returns 0 purged if already within limit", async () => {
        const type = "no-purge-needed";
        const id = "entry";

        // Create only 3 versions
        for (let i = 1; i <= 3; i++) {
          await cortex.immutable.store({
            type,
            id,
            data: { value: i },
          });
        }

        // Try to keep 5 (more than exists)
        const result = await cortex.immutable.purgeVersions(type, id, 5);

        expect(result.versionsPurged).toBe(0);
        expect(result.versionsRemaining).toBe(3);
      });

      it("throws error for non-existent entry", async () => {
        await expect(
          cortex.immutable.purgeVersions("type", "nonexistent", 5),
        ).rejects.toThrow("IMMUTABLE_ENTRY_NOT_FOUND");
      });
    });
  });

  describe("Type Isolation", () => {
    it("entries of different types are properly isolated", async () => {
      // Create entries with same ID but different types
      await cortex.immutable.store({
        type: "type-a",
        id: "shared-id",
        data: { source: "type-a" },
      });

      await cortex.immutable.store({
        type: "type-b",
        id: "shared-id",
        data: { source: "type-b" },
      });

      // Get should return correct type
      const typeA = await cortex.immutable.get("type-a", "shared-id");
      expect(typeA!.data.source).toBe("type-a");

      const typeB = await cortex.immutable.get("type-b", "shared-id");
      expect(typeB!.data.source).toBe("type-b");

      // List by type should be isolated
      const listA = await cortex.immutable.list({ type: "type-a" });
      expect(listA.every((e) => e.type === "type-a")).toBe(true);

      const listB = await cortex.immutable.list({ type: "type-b" });
      expect(listB.every((e) => e.type === "type-b")).toBe(true);

      // Count by type should be isolated
      const countA = await cortex.immutable.count({ type: "type-a" });
      const countB = await cortex.immutable.count({ type: "type-b" });
      expect(countA).toBeGreaterThanOrEqual(1);
      expect(countB).toBeGreaterThanOrEqual(1);
    });
  });
});
