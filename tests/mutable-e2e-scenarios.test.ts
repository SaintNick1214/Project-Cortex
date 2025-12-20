/**
 * E2E Tests: Mutable Store Real-World Scenarios
 *
 * Tests validate real-world use cases for the Mutable Store API (Layer 1c):
 * - Shopping Cart: Add/update/remove items, checkout transaction
 * - User Preferences: CRUD operations for user settings
 * - Rate Limiting: Counter-based rate limiting with thresholds
 * - Session Management: Create/validate/expire sessions
 * - Feature Flags: Enable/disable features with partial rollouts
 *
 * PARALLEL-SAFE: Uses unique namespaces for isolation
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { Cortex } from "../src/index";

describe("Mutable Store E2E Scenarios", () => {
  let cortex: Cortex;
  const BASE_ID = `e2e-mutable-${Date.now()}`;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL not set");
    }
    cortex = new Cortex({ convexUrl });
    console.log(`\n🛒 Mutable E2E Scenarios - Run ID: ${BASE_ID}\n`);
  });

  afterAll(async () => {
    // Cleanup namespaces created in tests
    const namespacesToClean = [
      `${BASE_ID}-cart`,
      `${BASE_ID}-prefs`,
      `${BASE_ID}-rate`,
      `${BASE_ID}-sessions`,
      `${BASE_ID}-cache`,
      `${BASE_ID}-feature-flags`,
    ];

    for (const ns of namespacesToClean) {
      try {
        await cortex.mutable.purgeNamespace(ns);
      } catch (_e) {
        // Ignore - namespace might not exist
      }
    }
    console.log(`\n✅ E2E cleanup complete\n`);
  });

  // ══════════════════════════════════════════════════════════════════════
  // E2E: Shopping Cart
  // ══════════════════════════════════════════════════════════════════════

  describe("E2E: Shopping Cart", () => {
    const cartNs = `${BASE_ID}-cart`;

    it("add item to cart", async () => {
      const userId = "user-123";
      const cartKey = `cart:${userId}`;

      // Initialize empty cart
      await cortex.mutable.set(
        cartNs,
        cartKey,
        {
          items: [],
          totalItems: 0,
          totalPrice: 0,
        },
        userId,
      );

      // Add first item
      const cart = (await cortex.mutable.get(cartNs, cartKey)) as {
        items: Array<{
          productId: string;
          name: string;
          quantity: number;
          price: number;
        }>;
        totalItems: number;
        totalPrice: number;
      };

      const newItem = {
        productId: "prod-001",
        name: "Widget",
        quantity: 2,
        price: 29.99,
      };

      cart.items.push(newItem);
      cart.totalItems += newItem.quantity;
      cart.totalPrice += newItem.price * newItem.quantity;

      const updated = await cortex.mutable.set(cartNs, cartKey, cart, userId);

      expect((updated.value as any).items).toHaveLength(1);
      expect((updated.value as any).totalItems).toBe(2);
      expect((updated.value as any).totalPrice).toBeCloseTo(59.98);
    });

    it("update item quantity in cart", async () => {
      const userId = "user-123";
      const cartKey = `cart:${userId}`;

      // Get current cart
      const cart = (await cortex.mutable.get(cartNs, cartKey)) as {
        items: Array<{
          productId: string;
          name: string;
          quantity: number;
          price: number;
        }>;
        totalItems: number;
        totalPrice: number;
      };

      // Find and update item quantity
      const item = cart.items.find((i) => i.productId === "prod-001");
      const oldQuantity = item!.quantity;
      const newQuantity = 5;

      item!.quantity = newQuantity;
      cart.totalItems = cart.totalItems - oldQuantity + newQuantity;
      cart.totalPrice =
        cart.totalPrice - item!.price * oldQuantity + item!.price * newQuantity;

      await cortex.mutable.set(cartNs, cartKey, cart, userId);

      // Verify
      const updatedCart = await cortex.mutable.get(cartNs, cartKey);
      expect((updatedCart as any).totalItems).toBe(5);
      expect((updatedCart as any).totalPrice).toBeCloseTo(149.95);
    });

    it("remove item from cart", async () => {
      const userId = "user-123";
      const cartKey = `cart:${userId}`;

      // Get current cart
      const cart = (await cortex.mutable.get(cartNs, cartKey)) as {
        items: Array<{
          productId: string;
          name: string;
          quantity: number;
          price: number;
        }>;
        totalItems: number;
        totalPrice: number;
      };

      // Remove item
      const itemIndex = cart.items.findIndex((i) => i.productId === "prod-001");
      const removedItem = cart.items[itemIndex];
      cart.items.splice(itemIndex, 1);
      cart.totalItems -= removedItem.quantity;
      cart.totalPrice -= removedItem.price * removedItem.quantity;

      await cortex.mutable.set(cartNs, cartKey, cart, userId);

      // Verify
      const updatedCart = await cortex.mutable.get(cartNs, cartKey);
      expect((updatedCart as any).items).toHaveLength(0);
      expect((updatedCart as any).totalItems).toBe(0);
      expect((updatedCart as any).totalPrice).toBe(0);
    });

    it("checkout transaction (multi-step atomic)", async () => {
      const userId = "user-456";
      const cartKey = `cart:${userId}`;
      const inventoryKey = "inventory:widget";
      const salesKey = "sales:total";

      // Setup: Create cart with items
      await cortex.mutable.set(
        cartNs,
        cartKey,
        {
          items: [
            { productId: "widget", name: "Widget", quantity: 3, price: 10 },
          ],
          totalItems: 3,
          totalPrice: 30,
        },
        userId,
      );

      // Setup: Inventory with 100 widgets
      await cortex.mutable.set(cartNs, inventoryKey, 100);

      // Setup: Sales counter
      await cortex.mutable.set(cartNs, salesKey, 0);

      // Checkout transaction:
      // 1. Decrement inventory by quantity ordered
      // 2. Increment sales counter
      // 3. Clear the cart
      const result = await cortex.mutable.transaction([
        { op: "decrement", namespace: cartNs, key: inventoryKey, amount: 3 },
        { op: "increment", namespace: cartNs, key: salesKey, amount: 30 },
        {
          op: "set",
          namespace: cartNs,
          key: cartKey,
          value: { items: [], totalItems: 0, totalPrice: 0, checkedOut: true },
        },
      ]);

      expect(result.success).toBe(true);
      expect(result.operationsExecuted).toBe(3);

      // Verify final state
      const inventory = await cortex.mutable.get(cartNs, inventoryKey);
      expect(inventory).toBe(97);

      const sales = await cortex.mutable.get(cartNs, salesKey);
      expect(sales).toBe(30);

      const cart = await cortex.mutable.get(cartNs, cartKey);
      expect((cart as any).items).toHaveLength(0);
      expect((cart as any).checkedOut).toBe(true);
    });

    it("abandoned cart cleanup", async () => {
      // Create multiple carts with different users
      const now = Date.now();
      const oneHourAgo = now - 60 * 60 * 1000;

      for (let i = 1; i <= 5; i++) {
        await cortex.mutable.set(
          cartNs,
          `abandoned:cart-${i}`,
          { items: [{ name: `Item ${i}` }], createdAt: oneHourAgo },
          `user-abandoned-${i}`,
        );
      }

      // Create a recent cart
      await cortex.mutable.set(
        cartNs,
        "recent:cart-1",
        { items: [{ name: "Recent Item" }], createdAt: now },
        "user-recent",
      );

      // Count all carts before cleanup
      const beforeCount = await cortex.mutable.count({
        namespace: cartNs,
        keyPrefix: "abandoned:",
      });
      expect(beforeCount).toBe(5);

      // Purge abandoned carts
      const purgeResult = await cortex.mutable.purgeMany({
        namespace: cartNs,
        keyPrefix: "abandoned:",
      });

      expect(purgeResult.deleted).toBe(5);

      // Verify recent cart still exists
      const recentCart = await cortex.mutable.get(cartNs, "recent:cart-1");
      expect(recentCart).not.toBeNull();
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // E2E: User Preferences
  // ══════════════════════════════════════════════════════════════════════

  describe("E2E: User Preferences", () => {
    const prefsNs = `${BASE_ID}-prefs`;

    it("create user preferences", async () => {
      const userId = "user-prefs-001";
      const prefsKey = `prefs:${userId}`;

      const prefs = {
        theme: "dark",
        language: "en",
        notifications: {
          email: true,
          push: false,
          sms: false,
        },
        privacy: {
          shareAnalytics: false,
          publicProfile: true,
        },
      };

      const result = await cortex.mutable.set(prefsNs, prefsKey, prefs, userId);

      expect(result.userId).toBe(userId);
      expect((result.value as any).theme).toBe("dark");
    });

    it("update specific preference", async () => {
      const userId = "user-prefs-001";
      const prefsKey = `prefs:${userId}`;

      // Get current prefs and update
      const current = (await cortex.mutable.get(prefsNs, prefsKey)) as any;
      current.theme = "light";
      current.notifications.push = true;

      await cortex.mutable.set(prefsNs, prefsKey, current, userId);

      // Verify
      const updated = await cortex.mutable.get(prefsNs, prefsKey);
      expect((updated as any).theme).toBe("light");
      expect((updated as any).notifications.push).toBe(true);
      expect((updated as any).language).toBe("en"); // Unchanged
    });

    it("reset to default preferences", async () => {
      const userId = "user-prefs-001";
      const prefsKey = `prefs:${userId}`;

      const defaultPrefs = {
        theme: "system",
        language: "en",
        notifications: {
          email: true,
          push: true,
          sms: false,
        },
        privacy: {
          shareAnalytics: true,
          publicProfile: false,
        },
      };

      await cortex.mutable.set(prefsNs, prefsKey, defaultPrefs, userId);

      const reset = await cortex.mutable.get(prefsNs, prefsKey);
      expect((reset as any).theme).toBe("system");
      expect((reset as any).privacy.shareAnalytics).toBe(true);
    });

    it("delete user preferences (GDPR)", async () => {
      const userId = "user-prefs-001";
      const prefsKey = `prefs:${userId}`;

      // Verify exists
      const before = await cortex.mutable.exists(prefsNs, prefsKey);
      expect(before).toBe(true);

      // Delete
      await cortex.mutable.delete(prefsNs, prefsKey);

      // Verify deleted
      const after = await cortex.mutable.exists(prefsNs, prefsKey);
      expect(after).toBe(false);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // E2E: Rate Limiting
  // ══════════════════════════════════════════════════════════════════════

  describe("E2E: Rate Limiting", () => {
    const rateNs = `${BASE_ID}-rate`;
    const RATE_LIMIT = 10;

    it("track API request count", async () => {
      const userId = "api-user-001";
      const rateKey = `rate:${userId}:api`;

      // Initialize counter
      await cortex.mutable.set(rateNs, rateKey, 0, userId);

      // Simulate API requests
      for (let i = 1; i <= 5; i++) {
        await cortex.mutable.increment(rateNs, rateKey, 1);
      }

      const count = await cortex.mutable.get(rateNs, rateKey);
      expect(count).toBe(5);
    });

    it("check rate limit exceeded", async () => {
      const userId = "api-user-002";
      const rateKey = `rate:${userId}:api`;

      // Initialize at 0
      await cortex.mutable.set(rateNs, rateKey, 0, userId);

      // Simulate requests up to limit
      for (let i = 1; i <= RATE_LIMIT; i++) {
        const result = await cortex.mutable.increment(rateNs, rateKey, 1);
        const currentCount = result.value as number;

        if (currentCount > RATE_LIMIT) {
          console.log(`Rate limit exceeded at request ${i}`);
          break;
        }
      }

      // One more request should exceed
      const result = await cortex.mutable.increment(rateNs, rateKey, 1);
      const finalCount = result.value as number;

      expect(finalCount).toBeGreaterThan(RATE_LIMIT);

      // Application would reject request when count > RATE_LIMIT
      const isRateLimited = finalCount > RATE_LIMIT;
      expect(isRateLimited).toBe(true);
    });

    it("reset rate limit window", async () => {
      const userId = "api-user-002";
      const rateKey = `rate:${userId}:api`;

      // Reset counter (simulating window expiry)
      await cortex.mutable.set(rateNs, rateKey, 0, userId);

      const afterReset = await cortex.mutable.get(rateNs, rateKey);
      expect(afterReset).toBe(0);
    });

    it("track multiple rate limit types", async () => {
      const userId = "api-user-003";

      // Different rate limits for different operations
      await cortex.mutable.set(rateNs, `rate:${userId}:api`, 0, userId);
      await cortex.mutable.set(rateNs, `rate:${userId}:login`, 0, userId);
      await cortex.mutable.set(rateNs, `rate:${userId}:upload`, 0, userId);

      // Simulate different request types
      await cortex.mutable.increment(rateNs, `rate:${userId}:api`, 5);
      await cortex.mutable.increment(rateNs, `rate:${userId}:login`, 2);
      await cortex.mutable.increment(rateNs, `rate:${userId}:upload`, 1);

      // Check all counters
      const apiCount = await cortex.mutable.get(rateNs, `rate:${userId}:api`);
      const loginCount = await cortex.mutable.get(
        rateNs,
        `rate:${userId}:login`,
      );
      const uploadCount = await cortex.mutable.get(
        rateNs,
        `rate:${userId}:upload`,
      );

      expect(apiCount).toBe(5);
      expect(loginCount).toBe(2);
      expect(uploadCount).toBe(1);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // E2E: Session Management
  // ══════════════════════════════════════════════════════════════════════

  describe("E2E: Session Management", () => {
    const sessionNs = `${BASE_ID}-sessions`;

    it("create session", async () => {
      const userId = "session-user-001";
      const sessionId = `session-${Date.now()}`;
      const sessionKey = `sess:${sessionId}`;

      const session = {
        userId,
        createdAt: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
        data: {
          userAgent: "Mozilla/5.0...",
          ip: "192.168.1.1",
          lastActivity: Date.now(),
        },
      };

      const result = await cortex.mutable.set(
        sessionNs,
        sessionKey,
        session,
        userId,
      );

      expect(result.userId).toBe(userId);
      expect((result.value as any).userId).toBe(userId);
      expect((result.value as any).expiresAt).toBeGreaterThan(Date.now());
    });

    it("validate session", async () => {
      const userId = "session-user-002";
      const sessionId = `session-valid-${Date.now()}`;
      const sessionKey = `sess:${sessionId}`;

      // Create valid session
      await cortex.mutable.set(
        sessionNs,
        sessionKey,
        {
          userId,
          createdAt: Date.now(),
          expiresAt: Date.now() + 3600000,
          data: {},
        },
        userId,
      );

      // Validate session exists and not expired
      const session = (await cortex.mutable.get(sessionNs, sessionKey)) as any;
      const isValid = session && session.expiresAt > Date.now();

      expect(isValid).toBe(true);
    });

    it("detect expired session", async () => {
      const userId = "session-user-003";
      const sessionId = `session-expired-${Date.now()}`;
      const sessionKey = `sess:${sessionId}`;

      // Create expired session (expiresAt in the past)
      await cortex.mutable.set(
        sessionNs,
        sessionKey,
        {
          userId,
          createdAt: Date.now() - 86400000,
          expiresAt: Date.now() - 3600000, // Expired 1 hour ago
          data: {},
        },
        userId,
      );

      // Check if expired
      const session = (await cortex.mutable.get(sessionNs, sessionKey)) as any;
      const isExpired = session.expiresAt < Date.now();

      expect(isExpired).toBe(true);
    });

    it("invalidate session (logout)", async () => {
      const userId = "session-user-004";
      const sessionId = `session-logout-${Date.now()}`;
      const sessionKey = `sess:${sessionId}`;

      // Create session
      await cortex.mutable.set(
        sessionNs,
        sessionKey,
        { userId, active: true },
        userId,
      );

      // Logout - delete session
      await cortex.mutable.delete(sessionNs, sessionKey);

      // Verify session doesn't exist
      const session = await cortex.mutable.get(sessionNs, sessionKey);
      expect(session).toBeNull();
    });

    it("list active sessions for user", async () => {
      const userId = "session-user-005";

      // Create multiple sessions
      for (let i = 1; i <= 3; i++) {
        await cortex.mutable.set(
          sessionNs,
          `sess:${userId}:device-${i}`,
          { userId, device: `device-${i}`, active: true },
          userId,
        );
      }

      // List user's sessions
      const sessions = await cortex.mutable.list({
        namespace: sessionNs,
        userId,
      });

      expect(sessions.length).toBeGreaterThanOrEqual(3);
      sessions.forEach((s) => {
        expect(s.userId).toBe(userId);
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // E2E: Feature Flags
  // ══════════════════════════════════════════════════════════════════════

  describe("E2E: Feature Flags", () => {
    const flagsNs = `${BASE_ID}-feature-flags`;

    it("create feature flag", async () => {
      const result = await cortex.mutable.set(flagsNs, "flag:dark-mode", {
        enabled: true,
        rolloutPercentage: 100,
        allowedUsers: [],
        metadata: { description: "Enable dark mode UI" },
      });

      expect((result.value as any).enabled).toBe(true);
    });

    it("check feature flag state", async () => {
      // Check if feature is enabled
      const flag = (await cortex.mutable.get(flagsNs, "flag:dark-mode")) as any;

      expect(flag.enabled).toBe(true);
      expect(flag.rolloutPercentage).toBe(100);
    });

    it("partial rollout feature flag", async () => {
      await cortex.mutable.set(flagsNs, "flag:new-checkout", {
        enabled: true,
        rolloutPercentage: 25,
        allowedUsers: ["beta-tester-1", "beta-tester-2"],
      });

      const flag = (await cortex.mutable.get(
        flagsNs,
        "flag:new-checkout",
      )) as any;

      // Simulate checking if user gets feature
      const userId = "random-user";
      const userHash = userId
        .split("")
        .reduce((a, b) => a + b.charCodeAt(0), 0);
      const userPercentile = userHash % 100;

      const isInRollout =
        flag.allowedUsers.includes(userId) ||
        userPercentile < flag.rolloutPercentage;

      // User might or might not be in rollout
      expect(typeof isInRollout).toBe("boolean");
    });

    it("disable feature flag", async () => {
      // Get current flag
      const current = (await cortex.mutable.get(
        flagsNs,
        "flag:dark-mode",
      )) as any;

      // Disable
      current.enabled = false;
      await cortex.mutable.set(flagsNs, "flag:dark-mode", current);

      // Verify disabled
      const updated = (await cortex.mutable.get(
        flagsNs,
        "flag:dark-mode",
      )) as any;
      expect(updated.enabled).toBe(false);
    });

    it("list all feature flags", async () => {
      // Create a few more flags
      await cortex.mutable.set(flagsNs, "flag:beta-features", {
        enabled: false,
      });
      await cortex.mutable.set(flagsNs, "flag:analytics", { enabled: true });

      // List all flags
      const flags = await cortex.mutable.list({
        namespace: flagsNs,
        keyPrefix: "flag:",
      });

      expect(flags.length).toBeGreaterThanOrEqual(3);
      flags.forEach((f) => {
        expect(f.key).toMatch(/^flag:/);
      });
    });
  });
});
