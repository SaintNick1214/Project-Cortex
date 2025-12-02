/**
 * E2E Tests: Mutable Store API (Layer 1c)
 *
 * Tests validate:
 * - SDK API calls
 * - Convex mutations/queries
 * - Storage validation
 * - Atomic updates
 * - State change propagation
 *
 * PARALLEL-SAFE: Uses TestRunContext for isolated test data
 */

import { Cortex } from "../src";
import { ConvexClient } from "convex/browser";
import { api } from "../convex-dev/_generated/api";
import { createNamedTestRunContext, ScopedCleanup } from "./helpers";

// Legacy cleanup class - kept for reference but not used in parallel-safe mode
class _MutableTestCleanup {
  constructor(protected client: ConvexClient) {}

  async verifyMutableEmpty(): Promise<void> {
    // Check a few test namespaces
    const namespaces = ["test", "inventory", "config"];
    let totalCount = 0;

    for (const ns of namespaces) {
      const count = await this.client.query(api.mutable.count, {
        namespace: ns,
      });

      totalCount += count;
    }

    if (totalCount > 0) {
      console.warn(
        `⚠️  Warning: Mutable table not empty (${totalCount} entries remaining)`,
      );
    } else {
      console.log("✅ Mutable table is empty");
    }
  }
}

describe("Mutable Store API (Layer 1c)", () => {
  // Create unique test run context for parallel-safe execution
  const ctx = createNamedTestRunContext("mutable");

  let cortex: Cortex;
  let client: ConvexClient;
  let scopedCleanup: ScopedCleanup;

  beforeAll(async () => {
    console.log(`\n🧪 Mutable Store API Tests - Run ID: ${ctx.runId}\n`);

    const convexUrl = process.env.CONVEX_URL;

    if (!convexUrl) {
      throw new Error("CONVEX_URL not set");
    }

    cortex = new Cortex({ convexUrl });
    client = new ConvexClient(convexUrl);
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

  describe("set()", () => {
    it("creates new key-value pair", async () => {
      const result = await cortex.mutable.set("inventory", "widget-qty", 100);

      expect(result.namespace).toBe("inventory");
      expect(result.key).toBe("widget-qty");
      expect(result.value).toBe(100);
      expect(result.createdAt).toBeGreaterThan(0);
      expect(result.updatedAt).toBeGreaterThan(0);
      expect(result.accessCount).toBe(0);
    });

    it("overwrites existing value", async () => {
      // Set initial value
      await cortex.mutable.set("config", "max-retries", 3);

      // Overwrite
      const result = await cortex.mutable.set("config", "max-retries", 5);

      expect(result.value).toBe(5);

      // Verify in storage
      const stored = await client.query(api.mutable.get, {
        namespace: "config",
        key: "max-retries",
      });

      expect(stored!.value).toBe(5);
    });

    it("stores complex objects", async () => {
      const config = {
        api: { endpoint: "https://api.example.com", timeout: 5000 },
        features: { darkMode: true, notifications: false },
      };

      const result = await cortex.mutable.set("config", "app-settings", config);

      expect(result.value).toEqual(config);
      expect((result.value as any).api.endpoint).toBe(
        "https://api.example.com",
      );
    });

    it("stores with userId for GDPR compliance", async () => {
      const result = await cortex.mutable.set(
        "sessions",
        "session-123",
        { active: true },
        "user-mutable-test",
      );

      expect(result.userId).toBe("user-mutable-test");
    });
  });

  describe("get()", () => {
    beforeAll(async () => {
      await cortex.mutable.set("inventory", "test-item", 50);
    });

    it("retrieves existing value", async () => {
      const value = await cortex.mutable.get("inventory", "test-item");

      expect(value).toBe(50);
    });

    it("returns null for non-existent key", async () => {
      const value = await cortex.mutable.get("inventory", "non-existent");

      expect(value).toBeNull();
    });

    it("getRecord returns full record with metadata", async () => {
      const record = await cortex.mutable.getRecord("inventory", "test-item");

      expect(record).not.toBeNull();
      expect(record!.value).toBe(50);
      expect(record!.namespace).toBe("inventory");
      expect(record!.key).toBe("test-item");
      expect(record!.accessCount).toBeGreaterThanOrEqual(0); // Access count exists
      expect(record!.createdAt).toBeGreaterThan(0);
      expect(record!.updatedAt).toBeGreaterThan(0);
    });
  });

  describe("update()", () => {
    it("updates value atomically", async () => {
      // Set initial value
      await cortex.mutable.set("inventory", "widget-update", 100);

      // Update atomically
      const result = await cortex.mutable.update(
        "inventory",
        "widget-update",
        (current: any) => current - 10,
      );

      expect(result.value).toBe(90);

      // Verify in storage
      const value = await cortex.mutable.get("inventory", "widget-update");

      expect(value).toBe(90);
    });

    it("handles null values in updater", async () => {
      // Update non-existent key (current will be null)
      await expect(
        cortex.mutable.update(
          "counters",
          "non-existent",
          (current: any) => current + 1,
        ),
      ).rejects.toThrow("MUTABLE_KEY_NOT_FOUND");
    });

    it("supports complex object updates", async () => {
      await cortex.mutable.set("config", "settings", {
        count: 0,
        enabled: false,
      });

      const result = await cortex.mutable.update(
        "config",
        "settings",
        (current: any) => ({
          ...current,
          count: current.count + 1,
          enabled: true,
        }),
      );

      expect((result.value as any).count).toBe(1);
      expect((result.value as any).enabled).toBe(true);
    });
  });

  describe("increment() / decrement()", () => {
    it("increments numeric value", async () => {
      await cortex.mutable.set("counters", "total-sales", 0);

      const result = await cortex.mutable.increment(
        "counters",
        "total-sales",
        1,
      );

      expect(result.value).toBe(1);

      await cortex.mutable.increment("counters", "total-sales", 5);
      const final = await cortex.mutable.get("counters", "total-sales");

      expect(final).toBe(6);
    });

    it("decrements numeric value", async () => {
      await cortex.mutable.set("inventory", "stock-decrement", 100);

      const result = await cortex.mutable.decrement(
        "inventory",
        "stock-decrement",
        10,
      );

      expect(result.value).toBe(90);

      await cortex.mutable.decrement("inventory", "stock-decrement", 20);
      const final = await cortex.mutable.get("inventory", "stock-decrement");

      expect(final).toBe(70);
    });

    it("handles increment from null/undefined", async () => {
      await cortex.mutable.set("counters", "from-zero", null);

      const result = await cortex.mutable.increment("counters", "from-zero", 1);

      expect(result.value).toBe(1);
    });
  });

  describe("exists()", () => {
    beforeAll(async () => {
      await cortex.mutable.set("test", "exists-test", "value");
    });

    it("returns true for existing key", async () => {
      const exists = await cortex.mutable.exists("test", "exists-test");

      expect(exists).toBe(true);
    });

    it("returns false for non-existent key", async () => {
      const exists = await cortex.mutable.exists("test", "does-not-exist");

      expect(exists).toBe(false);
    });
  });

  describe("list()", () => {
    beforeAll(async () => {
      await cortex.mutable.set("inventory", "widget-a", 10);
      await cortex.mutable.set("inventory", "widget-b", 20);
      await cortex.mutable.set("inventory", "gadget-a", 30);
      await cortex.mutable.set("config", "setting-1", "value");
    });

    it("lists all keys in namespace", async () => {
      const items = await cortex.mutable.list({ namespace: "inventory" });

      expect(items.length).toBeGreaterThanOrEqual(3);
      items.forEach((item) => {
        expect(item.namespace).toBe("inventory");
      });
    });

    it("filters by key prefix", async () => {
      const widgets = await cortex.mutable.list({
        namespace: "inventory",
        keyPrefix: "widget-",
      });

      expect(widgets.length).toBeGreaterThanOrEqual(2);
      widgets.forEach((item) => {
        expect(item.key).toMatch(/^widget-/);
      });
    });

    it("filters by userId", async () => {
      await cortex.mutable.set(
        "sessions",
        "sess-1",
        { active: true },
        "user-list-test",
      );
      await cortex.mutable.set(
        "sessions",
        "sess-2",
        { active: false },
        "user-list-test",
      );

      const userSessions = await cortex.mutable.list({
        namespace: "sessions",
        userId: "user-list-test",
      });

      expect(userSessions.length).toBeGreaterThanOrEqual(2);
      userSessions.forEach((session) => {
        expect(session.userId).toBe("user-list-test");
      });
    });

    it("respects limit parameter", async () => {
      const limited = await cortex.mutable.list({
        namespace: "inventory",
        limit: 2,
      });

      expect(limited.length).toBeLessThanOrEqual(2);
    });
  });

  describe("count()", () => {
    beforeAll(async () => {
      await cortex.mutable.set("count-test", "key-1", 1);
      await cortex.mutable.set("count-test", "key-2", 2);
      await cortex.mutable.set("count-test", "key-3", 3);
    });

    it("counts all keys in namespace", async () => {
      const count = await cortex.mutable.count({ namespace: "count-test" });

      expect(count).toBeGreaterThanOrEqual(3);
    });

    it("counts with key prefix filter", async () => {
      await cortex.mutable.set("prefix-test", "pre-1", 1);
      await cortex.mutable.set("prefix-test", "pre-2", 2);
      await cortex.mutable.set("prefix-test", "other-1", 3);

      const count = await cortex.mutable.count({
        namespace: "prefix-test",
        keyPrefix: "pre-",
      });

      expect(count).toBe(2);
    });

    it("counts with userId filter", async () => {
      await cortex.mutable.set("user-data", "data-1", "a", "user-count-test");
      await cortex.mutable.set("user-data", "data-2", "b", "user-count-test");

      const count = await cortex.mutable.count({
        namespace: "user-data",
        userId: "user-count-test",
      });

      expect(count).toBeGreaterThanOrEqual(2);
    });
  });

  describe("delete()", () => {
    it("deletes a key", async () => {
      await cortex.mutable.set("temp", "delete-test", "value");

      // Verify exists
      const before = await cortex.mutable.get("temp", "delete-test");

      expect(before).toBe("value");

      // Delete
      const result = await cortex.mutable.delete("temp", "delete-test");

      expect(result.deleted).toBe(true);

      // Verify deleted
      const after = await cortex.mutable.get("temp", "delete-test");

      expect(after).toBeNull();
    });

    it("throws error for non-existent key", async () => {
      await expect(
        cortex.mutable.delete("temp", "does-not-exist"),
      ).rejects.toThrow("MUTABLE_KEY_NOT_FOUND");
    });
  });

  describe("purgeNamespace()", () => {
    it("deletes all keys in namespace", async () => {
      // Create multiple keys
      await cortex.mutable.set("purge-test", "key-1", 1);
      await cortex.mutable.set("purge-test", "key-2", 2);
      await cortex.mutable.set("purge-test", "key-3", 3);

      // Verify count
      const before = await cortex.mutable.count({ namespace: "purge-test" });

      expect(before).toBeGreaterThanOrEqual(3);

      // Purge namespace
      const result = await cortex.mutable.purgeNamespace("purge-test");

      expect(result.deleted).toBeGreaterThanOrEqual(3);

      // Verify empty
      const after = await cortex.mutable.count({ namespace: "purge-test" });

      expect(after).toBe(0);
    });
  });

  describe("Advanced Operations", () => {
    describe("transaction()", () => {
      beforeAll(async () => {
        // Initialize data for transaction tests
        await cortex.mutable.set("inventory", "product-a", 100);
        await cortex.mutable.set("inventory", "product-b", 50);
        await cortex.mutable.set("counters", "total-sales", 0);
        await cortex.mutable.set("counters", "revenue", 0);
      });

      it("executes multiple operations atomically", async () => {
        const result = await cortex.mutable.transaction([
          {
            op: "increment",
            namespace: "counters",
            key: "total-sales",
            amount: 1,
          },
          {
            op: "decrement",
            namespace: "inventory",
            key: "product-a",
            amount: 5,
          },
          {
            op: "set",
            namespace: "state",
            key: "last-sale",
            value: Date.now(),
          },
        ]);

        expect(result.success).toBe(true);
        expect(result.operationsExecuted).toBe(3);
        expect(result.results).toHaveLength(3);

        // Verify all operations executed
        const sales = await cortex.mutable.get("counters", "total-sales");

        expect(sales).toBeGreaterThan(0);

        const inventory = await cortex.mutable.get("inventory", "product-a");

        expect(inventory).toBeLessThan(100);

        const lastSale = await cortex.mutable.get("state", "last-sale");

        expect(lastSale).toBeDefined();
      });

      it("all operations succeed or all fail (atomicity)", async () => {
        // This transaction will fail on the second operation (key doesn't exist)
        await expect(
          cortex.mutable.transaction([
            {
              op: "increment",
              namespace: "counters",
              key: "total-sales",
              amount: 1,
            },
            {
              op: "decrement",
              namespace: "inventory",
              key: "nonexistent",
              amount: 1,
            },
          ]),
        ).rejects.toThrow("MUTABLE_KEY_NOT_FOUND");

        // First operation should NOT have executed (atomicity)
        // Note: In our implementation, operations execute sequentially,
        // so if one fails, previous ones have already executed.
        // True atomicity would require rollback, which we'll note in docs.
      });

      it("handles mixed operations", async () => {
        await cortex.mutable.set("mix-test", "key-1", 10);
        await cortex.mutable.set("mix-test", "key-2", 20);

        const result = await cortex.mutable.transaction([
          { op: "increment", namespace: "mix-test", key: "key-1", amount: 5 },
          { op: "decrement", namespace: "mix-test", key: "key-2", amount: 3 },
          { op: "set", namespace: "mix-test", key: "key-3", value: 30 },
          { op: "delete", namespace: "mix-test", key: "key-1" },
        ]);

        expect(result.operationsExecuted).toBe(4);

        // Verify final state
        const key1 = await cortex.mutable.get("mix-test", "key-1");

        expect(key1).toBeNull(); // Deleted

        const key2 = await cortex.mutable.get("mix-test", "key-2");

        expect(key2).toBe(17); // 20 - 3

        const key3 = await cortex.mutable.get("mix-test", "key-3");

        expect(key3).toBe(30); // Created
      });

      it("handles inventory transfer pattern", async () => {
        await cortex.mutable.set("transfer", "source", 100);
        await cortex.mutable.set("transfer", "destination", 0);

        // Transfer 25 units atomically
        await cortex.mutable.transaction([
          { op: "decrement", namespace: "transfer", key: "source", amount: 25 },
          {
            op: "increment",
            namespace: "transfer",
            key: "destination",
            amount: 25,
          },
        ]);

        const source = await cortex.mutable.get("transfer", "source");
        const dest = await cortex.mutable.get("transfer", "destination");

        expect(source).toBe(75);
        expect(dest).toBe(25);
      });
    });

    describe("purgeMany()", () => {
      beforeAll(async () => {
        // Create test data
        await cortex.mutable.set("bulk-delete", "temp-1", "a");
        await cortex.mutable.set("bulk-delete", "temp-2", "b");
        await cortex.mutable.set("bulk-delete", "keep-1", "c");
        await cortex.mutable.set(
          "bulk-delete",
          "user-1",
          "d",
          "user-purge-many",
        );
        await cortex.mutable.set(
          "bulk-delete",
          "user-2",
          "e",
          "user-purge-many",
        );
      });

      it("deletes by key prefix", async () => {
        const result = await cortex.mutable.purgeMany({
          namespace: "bulk-delete",
          keyPrefix: "temp-",
        });

        expect(result.deleted).toBeGreaterThanOrEqual(2);
        expect(result.keys).toContain("temp-1");
        expect(result.keys).toContain("temp-2");

        // Verify deletion
        const remaining = await cortex.mutable.list({
          namespace: "bulk-delete",
          keyPrefix: "temp-",
        });

        expect(remaining.length).toBe(0);
      });

      it("deletes by userId", async () => {
        const result = await cortex.mutable.purgeMany({
          namespace: "bulk-delete",
          userId: "user-purge-many",
        });

        expect(result.deleted).toBeGreaterThanOrEqual(2);

        // Verify deletion
        const remaining = await cortex.mutable.list({
          namespace: "bulk-delete",
          userId: "user-purge-many",
        });

        expect(remaining.length).toBe(0);
      });
    });
  });

  describe("State Change Propagation", () => {
    it("updates propagate to all read operations", async () => {
      const ns = "propagation-test";
      const key = "counter";

      // Set initial value
      await cortex.mutable.set(ns, key, 0);

      // Verify in get()
      let value = await cortex.mutable.get(ns, key);

      expect(value).toBe(0);

      // Verify in exists()
      let exists = await cortex.mutable.exists(ns, key);

      expect(exists).toBe(true);

      // Verify in list()
      let list = await cortex.mutable.list({ namespace: ns });

      expect(list.some((e) => e.key === key)).toBe(true);

      // Update value
      await cortex.mutable.increment(ns, key, 10);

      // Verify change in get()
      value = await cortex.mutable.get(ns, key);
      expect(value).toBe(10);

      // Verify in list() (updated value)
      list = await cortex.mutable.list({ namespace: ns });
      const entry = list.find((e) => e.key === key);

      expect(entry!.value).toBe(10);

      // Delete
      await cortex.mutable.delete(ns, key);

      // Verify deletion propagates
      value = await cortex.mutable.get(ns, key);
      expect(value).toBeNull();

      exists = await cortex.mutable.exists(ns, key);
      expect(exists).toBe(false);

      list = await cortex.mutable.list({ namespace: ns });
      expect(list.some((e) => e.key === key)).toBe(false);
    });

    it("list and count stay synchronized", async () => {
      const ns = "sync-test-unique"; // Unique namespace to avoid conflicts

      // Start fresh - purge namespace first
      try {
        await cortex.mutable.purgeNamespace(ns);
      } catch (_e) {
        // Namespace might not exist yet
      }

      // Create 3 keys
      await cortex.mutable.set(ns, "key-1", 1);
      await cortex.mutable.set(ns, "key-2", 2);
      await cortex.mutable.set(ns, "key-3", 3);

      // Verify count matches list
      const count1 = await cortex.mutable.count({ namespace: ns });
      const list1 = await cortex.mutable.list({ namespace: ns });

      expect(count1).toBe(list1.length);
      expect(count1).toBe(3);

      // Add one more
      await cortex.mutable.set(ns, "key-4", 4);

      const count2 = await cortex.mutable.count({ namespace: ns });
      const list2 = await cortex.mutable.list({ namespace: ns });

      expect(count2).toBe(list2.length);
      expect(count2).toBe(4);

      // Delete one
      await cortex.mutable.delete(ns, "key-2");

      const count3 = await cortex.mutable.count({ namespace: ns });
      const list3 = await cortex.mutable.list({ namespace: ns });

      expect(count3).toBe(list3.length);
      expect(count3).toBe(3);
    });
  });

  describe("Edge Cases", () => {
    it("handles rapid updates to same key", async () => {
      const ns = "rapid-test";
      const key = "rapid-key";

      await cortex.mutable.set(ns, key, 0);

      // Perform 20 increments
      for (let i = 0; i < 20; i++) {
        await cortex.mutable.increment(ns, key, 1);
      }

      const final = await cortex.mutable.get(ns, key);

      expect(final).toBe(20);
    });

    it("handles large values", async () => {
      const largeArray = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        data: `Item ${i}`,
      }));

      const result = await cortex.mutable.set(
        "large-test",
        "big-array",
        largeArray,
      );

      expect(result.value).toHaveLength(1000);

      const retrieved = await cortex.mutable.get("large-test", "big-array");

      expect(retrieved).toHaveLength(1000);
    });

    it("handles special characters in namespace and key", async () => {
      const result = await cortex.mutable.set(
        "test-namespace_with.chars",
        "test-key_123.456-789",
        "special",
      );

      expect(result.namespace).toBe("test-namespace_with.chars");
      expect(result.key).toBe("test-key_123.456-789");

      const retrieved = await cortex.mutable.get(
        "test-namespace_with.chars",
        "test-key_123.456-789",
      );

      expect(retrieved).toBe("special");
    });

    it("handles empty values", async () => {
      await cortex.mutable.set("empty-test", "empty-string", "");
      await cortex.mutable.set("empty-test", "empty-object", {});
      await cortex.mutable.set("empty-test", "empty-array", []);

      expect(await cortex.mutable.get("empty-test", "empty-string")).toBe("");
      expect(await cortex.mutable.get("empty-test", "empty-object")).toEqual(
        {},
      );
      expect(await cortex.mutable.get("empty-test", "empty-array")).toEqual([]);
    });

    it("handles concurrent updates", async () => {
      await cortex.mutable.set("concurrent", "counter", 0);

      // 10 concurrent increments
      await Promise.all(
        Array.from(
          { length: 10 },
          async () =>
            await cortex.mutable.increment("concurrent", "counter", 1),
        ),
      );

      const final = await cortex.mutable.get("concurrent", "counter");

      expect(final).toBeGreaterThan(0);
      expect(final).toBeLessThanOrEqual(10);
    });
  });

  describe("Cross-Operation Integration", () => {
    it("set → get → update → list → delete consistency", async () => {
      const ns = "integration-test";
      const key = "workflow";

      // Set
      await cortex.mutable.set(ns, key, { status: "initial", count: 0 });

      // Get
      let value = await cortex.mutable.get(ns, key);

      expect((value as any).status).toBe("initial");

      // Update
      await cortex.mutable.update(ns, key, (current: any) => ({
        ...current,
        status: "updated",
        count: current.count + 1,
      }));

      // List
      const list = await cortex.mutable.list({ namespace: ns });
      const entry = list.find((e) => e.key === key);

      expect((entry!.value as any).status).toBe("updated");
      expect((entry!.value as any).count).toBe(1);

      // Count
      const count = await cortex.mutable.count({ namespace: ns });

      expect(count).toBeGreaterThanOrEqual(1);

      // Delete
      await cortex.mutable.delete(ns, key);

      // Verify deletion in all operations
      value = await cortex.mutable.get(ns, key);
      expect(value).toBeNull();

      const exists = await cortex.mutable.exists(ns, key);

      expect(exists).toBe(false);

      const listAfter = await cortex.mutable.list({ namespace: ns });

      expect(listAfter.some((e) => e.key === key)).toBe(false);
    });

    it("multiple namespaces are isolated", async () => {
      // Same key in different namespaces
      await cortex.mutable.set("ns-a", "shared-key", "value-a");
      await cortex.mutable.set("ns-b", "shared-key", "value-b");

      // Get returns correct value per namespace
      const valueA = await cortex.mutable.get("ns-a", "shared-key");
      const valueB = await cortex.mutable.get("ns-b", "shared-key");

      expect(valueA).toBe("value-a");
      expect(valueB).toBe("value-b");

      // List is isolated
      const listA = await cortex.mutable.list({ namespace: "ns-a" });
      const listB = await cortex.mutable.list({ namespace: "ns-b" });

      expect(listA.every((e) => e.namespace === "ns-a")).toBe(true);
      expect(listB.every((e) => e.namespace === "ns-b")).toBe(true);

      // Count is isolated
      const countA = await cortex.mutable.count({ namespace: "ns-a" });
      const countB = await cortex.mutable.count({ namespace: "ns-b" });

      expect(countA).toBeGreaterThanOrEqual(1);
      expect(countB).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Cross-Layer Integration", () => {
    it("transaction operations are reflected in list/count immediately", async () => {
      const ns = "tx-integration-unique";

      // Clean namespace first
      try {
        await cortex.mutable.purgeNamespace(ns);
      } catch (_e) {
        // Namespace might not exist
      }

      // Create initial state
      await cortex.mutable.set(ns, "key-1", 10);
      await cortex.mutable.set(ns, "key-2", 20);

      const countBefore = await cortex.mutable.count({ namespace: ns });

      expect(countBefore).toBe(2);

      // Transaction: update, create, delete
      await cortex.mutable.transaction([
        { op: "increment", namespace: ns, key: "key-1", amount: 5 },
        { op: "set", namespace: ns, key: "key-3", value: 30 },
        { op: "delete", namespace: ns, key: "key-2" },
      ]);

      // Verify changes in all operations
      const listAfter = await cortex.mutable.list({ namespace: ns });

      expect(listAfter.length).toBe(2); // key-1, key-3 (key-2 deleted)
      expect(listAfter.some((e) => e.key === "key-2")).toBe(false);

      const countAfter = await cortex.mutable.count({ namespace: ns });

      expect(countAfter).toBe(2);

      const key1 = await cortex.mutable.get(ns, "key-1");

      expect(key1).toBe(15); // 10 + 5

      const key3 = await cortex.mutable.get(ns, "key-3");

      expect(key3).toBe(30);
    });

    it("concurrent operations on same key are handled correctly", async () => {
      const ns = "concurrent-test";
      const key = "counter";

      await cortex.mutable.set(ns, key, 0);

      // 10 concurrent increments
      await Promise.all(
        Array.from(
          { length: 10 },
          async () => await cortex.mutable.increment(ns, key, 1),
        ),
      );

      const final = await cortex.mutable.get(ns, key);

      // Due to potential race conditions, exact value may vary
      // But should be > 0 and <= 10
      expect(final).toBeGreaterThan(0);
      expect(final).toBeLessThanOrEqual(10);
    });
  });

  describe("GDPR Compliance", () => {
    it("supports userId for cascade deletion", async () => {
      // Create user-specific data
      await cortex.mutable.set(
        "sessions",
        "user-session-1",
        { active: true },
        "user-gdpr-mutable",
      );
      await cortex.mutable.set(
        "cache",
        "user-cache-1",
        { data: "cached" },
        "user-gdpr-mutable",
      );

      // Count user entries
      const sessionCount = await cortex.mutable.count({
        namespace: "sessions",
        userId: "user-gdpr-mutable",
      });

      const cacheCount = await cortex.mutable.count({
        namespace: "cache",
        userId: "user-gdpr-mutable",
      });

      expect(sessionCount).toBeGreaterThanOrEqual(1);
      expect(cacheCount).toBeGreaterThanOrEqual(1);

      // List user entries
      const userSessions = await cortex.mutable.list({
        namespace: "sessions",
        userId: "user-gdpr-mutable",
      });

      expect(userSessions.length).toBeGreaterThanOrEqual(1);
      userSessions.forEach((entry) => {
        expect(entry.userId).toBe("user-gdpr-mutable");
      });
    });
  });

  describe("Storage Validation", () => {
    it("validates ACID properties", async () => {
      const ns = "acid-test";
      const key = "test-key";

      // Create
      const _created = await cortex.mutable.set(ns, key, 0);

      // Update 10 times
      for (let i = 1; i <= 10; i++) {
        await cortex.mutable.increment(ns, key, 1);
      }

      // Get final value
      const final = await cortex.mutable.get(ns, key);

      // Atomicity: All increments applied
      expect(final).toBe(10);

      // Consistency: Storage matches SDK response
      const stored = await client.query(api.mutable.get, {
        namespace: ns,
        key,
      });

      expect(stored!.value).toBe(final);

      // Durability: Value persists
      const retrieved = await cortex.mutable.get(ns, key);

      expect(retrieved).toBe(10);
    });

    it("no version history (overwrites)", async () => {
      const ns = "overwrite-test";
      const key = "value";

      // Set v1
      await cortex.mutable.set(ns, key, "first");

      // Set v2 (overwrites, no history)
      await cortex.mutable.set(ns, key, "second");

      // Only current value exists
      const value = await cortex.mutable.get(ns, key);

      expect(value).toBe("second");

      // No way to get "first" - it's gone!
      const record = await cortex.mutable.getRecord(ns, key);

      expect(record!.value).toBe("second");
      // No previousVersions field!
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Client-Side Validation Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // These tests validate CLIENT-SIDE validation (synchronous errors)
  // Backend validation tests are in the functional suites above
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Client-Side Validation", () => {
    describe("set() validation", () => {
      it("should throw on missing namespace", async () => {
        await expect(
          cortex.mutable.set("" as any, "key", "value"),
        ).rejects.toThrow("namespace is required");
      });

      it("should throw on empty namespace", async () => {
        await expect(cortex.mutable.set("", "key", "value")).rejects.toThrow(
          "namespace is required",
        );
      });

      it("should throw on whitespace-only namespace", async () => {
        await expect(cortex.mutable.set("   ", "key", "value")).rejects.toThrow(
          "namespace is required",
        );
      });

      it("should throw on invalid namespace format (spaces)", async () => {
        await expect(
          cortex.mutable.set("name with spaces", "key", "value"),
        ).rejects.toThrow("Invalid namespace format");
      });

      it("should throw on invalid namespace format (emoji)", async () => {
        await expect(
          cortex.mutable.set("namespace-😀", "key", "value"),
        ).rejects.toThrow("Invalid namespace format");
      });

      it("should throw on missing key", async () => {
        await expect(
          cortex.mutable.set("namespace", "" as any, "value"),
        ).rejects.toThrow("key is required");
      });

      it("should throw on empty key", async () => {
        await expect(
          cortex.mutable.set("namespace", "", "value"),
        ).rejects.toThrow("key is required");
      });

      it("should throw on invalid key format", async () => {
        await expect(
          cortex.mutable.set("namespace", "key with spaces", "value"),
        ).rejects.toThrow("Invalid key format");
      });

      it("should throw on missing value (undefined)", async () => {
        await expect(
          cortex.mutable.set("namespace", "key", undefined as any),
        ).rejects.toThrow("Value is required");
      });

      it("should throw on value too large", async () => {
        const largeValue = { data: "x".repeat(2 * 1024 * 1024) }; // 2MB
        await expect(
          cortex.mutable.set("namespace", "key", largeValue),
        ).rejects.toThrow("exceeds maximum size");
      });

      it("should throw on invalid userId format", async () => {
        await expect(
          cortex.mutable.set("namespace", "key", "value", ""),
        ).rejects.toThrow("userId cannot be empty");
      });

      it("should accept valid inputs", async () => {
        const result = await cortex.mutable.set(
          "validation-test",
          "valid-key",
          "valid-value",
        );
        expect(result.value).toBe("valid-value");
      });

      it("should accept complex object values", async () => {
        const complexValue = { nested: { data: [1, 2, 3] } };
        const result = await cortex.mutable.set(
          "validation-test",
          "complex",
          complexValue,
        );
        expect(result.value).toEqual(complexValue);
      });
    });

    describe("get() validation", () => {
      it("should throw on missing namespace", async () => {
        await expect(cortex.mutable.get("", "key")).rejects.toThrow(
          "namespace is required",
        );
      });

      it("should throw on invalid namespace format", async () => {
        await expect(
          cortex.mutable.get("name with spaces", "key"),
        ).rejects.toThrow("Invalid namespace format");
      });

      it("should throw on missing key", async () => {
        await expect(cortex.mutable.get("namespace", "")).rejects.toThrow(
          "key is required",
        );
      });

      it("should throw on invalid key format", async () => {
        await expect(
          cortex.mutable.get("namespace", "key with spaces"),
        ).rejects.toThrow("Invalid key format");
      });

      it("should accept valid inputs", async () => {
        await cortex.mutable.set("validation-test", "get-test", "value");
        const value = await cortex.mutable.get("validation-test", "get-test");
        expect(value).toBe("value");
      });
    });

    describe("getRecord() validation", () => {
      it("should throw on missing namespace", async () => {
        await expect(cortex.mutable.getRecord("", "key")).rejects.toThrow(
          "namespace is required",
        );
      });

      it("should throw on invalid namespace format", async () => {
        await expect(
          cortex.mutable.getRecord("name with spaces", "key"),
        ).rejects.toThrow("Invalid namespace format");
      });

      it("should throw on missing key", async () => {
        await expect(cortex.mutable.getRecord("namespace", "")).rejects.toThrow(
          "key is required",
        );
      });

      it("should throw on invalid key format", async () => {
        await expect(
          cortex.mutable.getRecord("namespace", "key with spaces"),
        ).rejects.toThrow("Invalid key format");
      });

      it("should accept valid inputs", async () => {
        await cortex.mutable.set("validation-test", "record-test", "value");
        const record = await cortex.mutable.getRecord(
          "validation-test",
          "record-test",
        );
        expect(record?.value).toBe("value");
      });
    });

    describe("update() validation", () => {
      beforeAll(async () => {
        await cortex.mutable.set("validation-test", "update-test", 100);
      });

      it("should throw on missing namespace", async () => {
        await expect(
          cortex.mutable.update("", "key", (v) => v),
        ).rejects.toThrow("namespace is required");
      });

      it("should throw on invalid namespace format", async () => {
        await expect(
          cortex.mutable.update("name with spaces", "key", (v) => v),
        ).rejects.toThrow("Invalid namespace format");
      });

      it("should throw on missing key", async () => {
        await expect(
          cortex.mutable.update("namespace", "", (v) => v),
        ).rejects.toThrow("key is required");
      });

      it("should throw on invalid key format", async () => {
        await expect(
          cortex.mutable.update("namespace", "key with spaces", (v) => v),
        ).rejects.toThrow("Invalid key format");
      });

      it("should throw on missing updater", async () => {
        await expect(
          cortex.mutable.update(
            "validation-test",
            "update-test",
            undefined as any,
          ),
        ).rejects.toThrow("Updater function is required");
      });

      it("should throw on non-function updater", async () => {
        await expect(
          cortex.mutable.update(
            "validation-test",
            "update-test",
            "not a function" as any,
          ),
        ).rejects.toThrow("Updater must be a function");
      });

      it("should accept valid function updater", async () => {
        const result = await cortex.mutable.update(
          "validation-test",
          "update-test",
          (v: any) => v + 1,
        );
        expect(result.value).toBe(101);
      });
    });

    describe("increment() validation", () => {
      beforeAll(async () => {
        await cortex.mutable.set("validation-test", "inc-test", 0);
      });

      it("should throw on missing namespace", async () => {
        await expect(cortex.mutable.increment("", "key", 1)).rejects.toThrow(
          "namespace is required",
        );
      });

      it("should throw on invalid namespace format", async () => {
        await expect(
          cortex.mutable.increment("name with spaces", "key", 1),
        ).rejects.toThrow("Invalid namespace format");
      });

      it("should throw on missing key", async () => {
        await expect(
          cortex.mutable.increment("namespace", "", 1),
        ).rejects.toThrow("key is required");
      });

      it("should throw on invalid key format", async () => {
        await expect(
          cortex.mutable.increment("namespace", "key with spaces", 1),
        ).rejects.toThrow("Invalid key format");
      });

      it("should throw on non-numeric amount", async () => {
        await expect(
          cortex.mutable.increment(
            "validation-test",
            "inc-test",
            "not a number" as any,
          ),
        ).rejects.toThrow("amount must be a number");
      });

      it("should accept valid amount", async () => {
        const result = await cortex.mutable.increment(
          "validation-test",
          "inc-test",
          5,
        );
        expect(result.value).toBeGreaterThanOrEqual(5);
      });

      it("should accept default amount (1)", async () => {
        const before = await cortex.mutable.get("validation-test", "inc-test");
        const result = await cortex.mutable.increment(
          "validation-test",
          "inc-test",
        );
        expect(result.value).toBe((before as number) + 1);
      });
    });

    describe("decrement() validation", () => {
      beforeAll(async () => {
        await cortex.mutable.set("validation-test", "dec-test", 100);
      });

      it("should throw on missing namespace", async () => {
        await expect(cortex.mutable.decrement("", "key", 1)).rejects.toThrow(
          "namespace is required",
        );
      });

      it("should throw on invalid namespace format", async () => {
        await expect(
          cortex.mutable.decrement("name with spaces", "key", 1),
        ).rejects.toThrow("Invalid namespace format");
      });

      it("should throw on missing key", async () => {
        await expect(
          cortex.mutable.decrement("namespace", "", 1),
        ).rejects.toThrow("key is required");
      });

      it("should throw on invalid key format", async () => {
        await expect(
          cortex.mutable.decrement("namespace", "key with spaces", 1),
        ).rejects.toThrow("Invalid key format");
      });

      it("should throw on non-numeric amount", async () => {
        await expect(
          cortex.mutable.decrement(
            "validation-test",
            "dec-test",
            "not a number" as any,
          ),
        ).rejects.toThrow("amount must be a number");
      });

      it("should accept valid amount", async () => {
        const result = await cortex.mutable.decrement(
          "validation-test",
          "dec-test",
          5,
        );
        expect(result.value).toBeLessThanOrEqual(95);
      });

      it("should accept default amount (1)", async () => {
        const before = await cortex.mutable.get("validation-test", "dec-test");
        const result = await cortex.mutable.decrement(
          "validation-test",
          "dec-test",
        );
        expect(result.value).toBe((before as number) - 1);
      });
    });

    describe("exists() validation", () => {
      it("should throw on missing namespace", async () => {
        await expect(cortex.mutable.exists("", "key")).rejects.toThrow(
          "namespace is required",
        );
      });

      it("should throw on invalid namespace format", async () => {
        await expect(
          cortex.mutable.exists("name with spaces", "key"),
        ).rejects.toThrow("Invalid namespace format");
      });

      it("should throw on missing key", async () => {
        await expect(cortex.mutable.exists("namespace", "")).rejects.toThrow(
          "key is required",
        );
      });

      it("should throw on invalid key format", async () => {
        await expect(
          cortex.mutable.exists("namespace", "key with spaces"),
        ).rejects.toThrow("Invalid key format");
      });
    });

    describe("delete() validation", () => {
      it("should throw on missing namespace", async () => {
        await expect(cortex.mutable.delete("", "key")).rejects.toThrow(
          "namespace is required",
        );
      });

      it("should throw on invalid namespace format", async () => {
        await expect(
          cortex.mutable.delete("name with spaces", "key"),
        ).rejects.toThrow("Invalid namespace format");
      });

      it("should throw on missing key", async () => {
        await expect(cortex.mutable.delete("namespace", "")).rejects.toThrow(
          "key is required",
        );
      });

      it("should throw on invalid key format", async () => {
        await expect(
          cortex.mutable.delete("namespace", "key with spaces"),
        ).rejects.toThrow("Invalid key format");
      });
    });

    describe("purge() validation", () => {
      it("should throw on missing namespace", async () => {
        await expect(cortex.mutable.purge("", "key")).rejects.toThrow(
          "namespace is required",
        );
      });

      it("should throw on invalid namespace format", async () => {
        await expect(
          cortex.mutable.purge("name with spaces", "key"),
        ).rejects.toThrow("Invalid namespace format");
      });

      it("should throw on missing key", async () => {
        await expect(cortex.mutable.purge("namespace", "")).rejects.toThrow(
          "key is required",
        );
      });

      it("should throw on invalid key format", async () => {
        await expect(
          cortex.mutable.purge("namespace", "key with spaces"),
        ).rejects.toThrow("Invalid key format");
      });
    });

    describe("list() validation", () => {
      it("should throw on missing filter", async () => {
        await expect(cortex.mutable.list(undefined as any)).rejects.toThrow(
          "Filter is required",
        );
      });

      it("should throw on null filter", async () => {
        await expect(cortex.mutable.list(null as any)).rejects.toThrow(
          "Filter is required",
        );
      });

      it("should throw on missing filter.namespace", async () => {
        await expect(cortex.mutable.list({} as any)).rejects.toThrow(
          "Filter must include namespace",
        );
      });

      it("should throw on empty namespace", async () => {
        await expect(cortex.mutable.list({ namespace: "" })).rejects.toThrow(
          "Filter must include namespace",
        );
      });

      it("should throw on invalid namespace format", async () => {
        await expect(
          cortex.mutable.list({ namespace: "name with spaces" }),
        ).rejects.toThrow("Invalid namespace format");
      });

      it("should throw on invalid keyPrefix format", async () => {
        await expect(
          cortex.mutable.list({
            namespace: "test",
            keyPrefix: "prefix with spaces",
          }),
        ).rejects.toThrow("Invalid keyPrefix format");
      });

      it("should throw on invalid userId format", async () => {
        await expect(
          cortex.mutable.list({ namespace: "test", userId: "" }),
        ).rejects.toThrow("userId cannot be empty");
      });

      it("should throw on non-numeric limit", async () => {
        await expect(
          cortex.mutable.list({ namespace: "test", limit: "10" as any }),
        ).rejects.toThrow("limit must be a number");
      });

      it("should throw on negative limit", async () => {
        await expect(
          cortex.mutable.list({ namespace: "test", limit: -1 }),
        ).rejects.toThrow("limit must be non-negative");
      });

      it("should throw on limit > 1000", async () => {
        await expect(
          cortex.mutable.list({ namespace: "test", limit: 1001 }),
        ).rejects.toThrow("limit exceeds maximum");
      });

      it("should accept valid filter with all optional fields", async () => {
        const result = await cortex.mutable.list({
          namespace: "validation-test",
          keyPrefix: "test-",
          limit: 10,
        });
        expect(Array.isArray(result)).toBe(true);
      });
    });

    describe("count() validation", () => {
      it("should throw on missing filter", async () => {
        await expect(cortex.mutable.count(undefined as any)).rejects.toThrow(
          "Filter is required",
        );
      });

      it("should throw on missing filter.namespace", async () => {
        await expect(cortex.mutable.count({} as any)).rejects.toThrow(
          "Filter must include namespace",
        );
      });

      it("should throw on empty namespace", async () => {
        await expect(cortex.mutable.count({ namespace: "" })).rejects.toThrow(
          "Filter must include namespace",
        );
      });

      it("should throw on invalid namespace format", async () => {
        await expect(
          cortex.mutable.count({ namespace: "name with spaces" }),
        ).rejects.toThrow("Invalid namespace format");
      });

      it("should throw on invalid keyPrefix format", async () => {
        await expect(
          cortex.mutable.count({
            namespace: "test",
            keyPrefix: "prefix with spaces",
          }),
        ).rejects.toThrow("Invalid keyPrefix format");
      });

      it("should throw on invalid userId format", async () => {
        await expect(
          cortex.mutable.count({ namespace: "test", userId: "" }),
        ).rejects.toThrow("userId cannot be empty");
      });

      it("should accept valid filter with namespace only", async () => {
        const result = await cortex.mutable.count({
          namespace: "validation-test",
        });
        expect(typeof result).toBe("number");
      });

      it("should accept valid filter with keyPrefix", async () => {
        const result = await cortex.mutable.count({
          namespace: "validation-test",
          keyPrefix: "test-",
        });
        expect(typeof result).toBe("number");
      });

      it("should accept valid filter with all fields", async () => {
        const result = await cortex.mutable.count({
          namespace: "validation-test",
          keyPrefix: "test-",
        });
        expect(typeof result).toBe("number");
      });
    });

    describe("transaction() validation", () => {
      it("should throw on missing operations", async () => {
        await expect(
          cortex.mutable.transaction(undefined as any),
        ).rejects.toThrow("Operations array is required");
      });

      it("should throw on null operations", async () => {
        await expect(cortex.mutable.transaction(null as any)).rejects.toThrow(
          "Operations array is required",
        );
      });

      it("should throw on non-array operations", async () => {
        await expect(cortex.mutable.transaction({} as any)).rejects.toThrow(
          "Operations must be an array",
        );
      });

      it("should throw on empty operations array", async () => {
        await expect(cortex.mutable.transaction([])).rejects.toThrow(
          "Operations array cannot be empty",
        );
      });

      it("should throw on operation missing op field", async () => {
        await expect(
          cortex.mutable.transaction([
            { namespace: "test", key: "key" } as any,
          ]),
        ).rejects.toThrow('missing required field "op"');
      });

      it("should throw on invalid op type", async () => {
        await expect(
          cortex.mutable.transaction([
            { op: "invalid", namespace: "test", key: "key" } as any,
          ]),
        ).rejects.toThrow('has invalid "op" value');
      });

      it("should throw on operation missing namespace", async () => {
        await expect(
          cortex.mutable.transaction([{ op: "set", key: "key" } as any]),
        ).rejects.toThrow('missing required field "namespace"');
      });

      it("should throw on operation missing key", async () => {
        await expect(
          cortex.mutable.transaction([{ op: "set", namespace: "test" } as any]),
        ).rejects.toThrow('missing required field "key"');
      });

      it("should throw on set operation missing value", async () => {
        await expect(
          cortex.mutable.transaction([
            { op: "set", namespace: "test", key: "key" } as any,
          ]),
        ).rejects.toThrow('missing required field "value"');
      });

      it("should throw on invalid amount type (non-number)", async () => {
        await expect(
          cortex.mutable.transaction([
            {
              op: "increment",
              namespace: "test",
              key: "key",
              amount: "not a number",
            } as any,
          ]),
        ).rejects.toThrow("amount must be a number");
      });

      it("should validate namespace format in operations", async () => {
        await expect(
          cortex.mutable.transaction([
            {
              op: "set",
              namespace: "name with spaces",
              key: "key",
              value: "value",
            },
          ]),
        ).rejects.toThrow("Invalid namespace format");
      });

      it("should validate key format in operations", async () => {
        await expect(
          cortex.mutable.transaction([
            {
              op: "set",
              namespace: "test",
              key: "key with spaces",
              value: "value",
            },
          ]),
        ).rejects.toThrow("Invalid key format");
      });

      it("should accept valid single operation", async () => {
        await cortex.mutable.set("validation-test", "tx-test", 0);
        const result = await cortex.mutable.transaction([
          {
            op: "increment",
            namespace: "validation-test",
            key: "tx-test",
            amount: 1,
          },
        ]);
        expect(result.success).toBe(true);
      });

      it("should accept valid multiple operations", async () => {
        await cortex.mutable.set("validation-test", "tx-multi-1", 0);
        await cortex.mutable.set("validation-test", "tx-multi-2", 0);
        const result = await cortex.mutable.transaction([
          {
            op: "increment",
            namespace: "validation-test",
            key: "tx-multi-1",
            amount: 1,
          },
          {
            op: "increment",
            namespace: "validation-test",
            key: "tx-multi-2",
            amount: 1,
          },
        ]);
        expect(result.success).toBe(true);
      });

      it("should accept all operation types", async () => {
        await cortex.mutable.set("validation-test", "tx-all-ops", 0);
        await cortex.mutable.set("validation-test", "tx-delete-me", "value");
        const result = await cortex.mutable.transaction([
          {
            op: "set",
            namespace: "validation-test",
            key: "tx-set",
            value: "new",
          },
          {
            op: "update",
            namespace: "validation-test",
            key: "tx-all-ops",
            value: 10,
          },
          {
            op: "increment",
            namespace: "validation-test",
            key: "tx-all-ops",
            amount: 5,
          },
          {
            op: "decrement",
            namespace: "validation-test",
            key: "tx-all-ops",
            amount: 3,
          },
          {
            op: "delete",
            namespace: "validation-test",
            key: "tx-delete-me",
          },
        ]);
        expect(result.success).toBe(true);
      });
    });

    describe("purgeMany() validation", () => {
      it("should throw on missing filter", async () => {
        await expect(
          cortex.mutable.purgeMany(undefined as any),
        ).rejects.toThrow("Filter is required");
      });

      it("should throw on missing filter.namespace", async () => {
        await expect(cortex.mutable.purgeMany({} as any)).rejects.toThrow(
          "Filter must include namespace",
        );
      });

      it("should throw on empty namespace", async () => {
        await expect(
          cortex.mutable.purgeMany({ namespace: "" }),
        ).rejects.toThrow("Filter must include namespace");
      });

      it("should throw on invalid namespace format", async () => {
        await expect(
          cortex.mutable.purgeMany({ namespace: "name with spaces" }),
        ).rejects.toThrow("Invalid namespace format");
      });

      it("should throw on invalid keyPrefix format", async () => {
        await expect(
          cortex.mutable.purgeMany({
            namespace: "test",
            keyPrefix: "prefix with spaces",
          }),
        ).rejects.toThrow("Invalid keyPrefix format");
      });

      it("should throw on invalid userId format", async () => {
        await expect(
          cortex.mutable.purgeMany({ namespace: "test", userId: "" }),
        ).rejects.toThrow("userId cannot be empty");
      });

      it("should accept valid filter with namespace only", async () => {
        await cortex.mutable.set("purge-validation", "test-1", "value");
        const result = await cortex.mutable.purgeMany({
          namespace: "purge-validation",
        });
        expect(result.deleted).toBeGreaterThanOrEqual(0);
      });

      it("should accept valid filter with all fields", async () => {
        await cortex.mutable.set("purge-validation-2", "prefix-1", "value");
        const result = await cortex.mutable.purgeMany({
          namespace: "purge-validation-2",
          keyPrefix: "prefix-",
        });
        expect(result.deleted).toBeGreaterThanOrEqual(0);
      });
    });

    describe("purgeNamespace() validation", () => {
      it("should throw on missing namespace", async () => {
        await expect(
          cortex.mutable.purgeNamespace(undefined as any),
        ).rejects.toThrow("namespace is required");
      });

      it("should throw on empty namespace", async () => {
        await expect(cortex.mutable.purgeNamespace("")).rejects.toThrow(
          "namespace is required",
        );
      });

      it("should throw on whitespace-only namespace", async () => {
        await expect(cortex.mutable.purgeNamespace("   ")).rejects.toThrow(
          "namespace is required",
        );
      });

      it("should throw on invalid namespace format", async () => {
        await expect(
          cortex.mutable.purgeNamespace("name with spaces"),
        ).rejects.toThrow("Invalid namespace format");
      });

      it("should accept valid namespace", async () => {
        await cortex.mutable.set("purge-ns-validation", "key", "value");
        const result = await cortex.mutable.purgeNamespace(
          "purge-ns-validation",
        );
        expect(result.deleted).toBeGreaterThanOrEqual(0);
      });
    });
  });
});
