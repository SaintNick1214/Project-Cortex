/**
 * Unit Tests: Recall Limits Configuration
 *
 * Tests the resolveRecallLimits function and RECALL_DEFAULTS configuration.
 * These tests verify the configuration hierarchy:
 * 1. SDK defaults (hardcoded)
 * 2. Environment variables
 * 3. Per-call overrides
 */

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";

// We need to test the config module with different env var states
// So we'll dynamically import it after setting env vars

describe("Recall Limits Configuration", () => {
  // Store original env vars to restore after tests
  const originalEnv: Record<string, string | undefined> = {};
  const envVars = [
    "CORTEX_RECALL_LIMIT_MEMORIES",
    "CORTEX_RECALL_LIMIT_FACTS",
    "CORTEX_RECALL_GRAPH_HOPS",
    "CORTEX_RECALL_GRAPH_ENTITIES_PER_HOP",
    "CORTEX_RECALL_GRAPH_RESULTS_PER_ENTITY",
    "CORTEX_RECALL_LIMIT_TOTAL",
  ];

  beforeEach(() => {
    // Save original env vars
    for (const key of envVars) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
    // Clear module cache to re-evaluate env vars
    jest.resetModules();
  });

  afterEach(() => {
    // Restore original env vars
    for (const key of envVars) {
      if (originalEnv[key] !== undefined) {
        process.env[key] = originalEnv[key];
      } else {
        delete process.env[key];
      }
    }
    jest.resetModules();
  });

  describe("RECALL_DEFAULTS", () => {
    it("has correct hardcoded defaults when no env vars set", async () => {
      const { RECALL_DEFAULTS } = await import("../../src/config");

      expect(RECALL_DEFAULTS.memories).toBe(20);
      expect(RECALL_DEFAULTS.facts).toBe(15);
      expect(RECALL_DEFAULTS.graphHops).toBe(2);
      expect(RECALL_DEFAULTS.graphEntitiesPerHop).toBe(5);
      expect(RECALL_DEFAULTS.graphResultsPerEntity).toBe(3);
      expect(RECALL_DEFAULTS.total).toBe(30);
    });

    it("respects CORTEX_RECALL_LIMIT_MEMORIES env var", async () => {
      process.env.CORTEX_RECALL_LIMIT_MEMORIES = "50";
      const { RECALL_DEFAULTS } = await import("../../src/config");

      expect(RECALL_DEFAULTS.memories).toBe(50);
    });

    it("respects CORTEX_RECALL_LIMIT_FACTS env var", async () => {
      process.env.CORTEX_RECALL_LIMIT_FACTS = "25";
      const { RECALL_DEFAULTS } = await import("../../src/config");

      expect(RECALL_DEFAULTS.facts).toBe(25);
    });

    it("respects CORTEX_RECALL_GRAPH_HOPS env var", async () => {
      process.env.CORTEX_RECALL_GRAPH_HOPS = "3";
      const { RECALL_DEFAULTS } = await import("../../src/config");

      expect(RECALL_DEFAULTS.graphHops).toBe(3);
    });

    it("respects CORTEX_RECALL_GRAPH_ENTITIES_PER_HOP env var", async () => {
      process.env.CORTEX_RECALL_GRAPH_ENTITIES_PER_HOP = "10";
      const { RECALL_DEFAULTS } = await import("../../src/config");

      expect(RECALL_DEFAULTS.graphEntitiesPerHop).toBe(10);
    });

    it("respects CORTEX_RECALL_GRAPH_RESULTS_PER_ENTITY env var", async () => {
      process.env.CORTEX_RECALL_GRAPH_RESULTS_PER_ENTITY = "5";
      const { RECALL_DEFAULTS } = await import("../../src/config");

      expect(RECALL_DEFAULTS.graphResultsPerEntity).toBe(5);
    });

    it("respects CORTEX_RECALL_LIMIT_TOTAL env var", async () => {
      process.env.CORTEX_RECALL_LIMIT_TOTAL = "100";
      const { RECALL_DEFAULTS } = await import("../../src/config");

      expect(RECALL_DEFAULTS.total).toBe(100);
    });

    it("handles invalid env var values by using defaults", async () => {
      process.env.CORTEX_RECALL_LIMIT_MEMORIES = "not-a-number";
      process.env.CORTEX_RECALL_LIMIT_FACTS = "";
      const { RECALL_DEFAULTS } = await import("../../src/config");

      expect(RECALL_DEFAULTS.memories).toBe(20); // Falls back to default
      expect(RECALL_DEFAULTS.facts).toBe(15); // Falls back to default
    });

    it("handles zero values from env vars", async () => {
      process.env.CORTEX_RECALL_GRAPH_HOPS = "0";
      const { RECALL_DEFAULTS } = await import("../../src/config");

      expect(RECALL_DEFAULTS.graphHops).toBe(0);
    });
  });

  describe("resolveRecallLimits", () => {
    it("returns defaults when no overrides provided", async () => {
      const { resolveRecallLimits } = await import("../../src/config");

      const result = resolveRecallLimits();

      expect(result.memories).toBe(20);
      expect(result.facts).toBe(15);
      expect(result.graphHops).toBe(2);
      expect(result.graphEntitiesPerHop).toBe(5);
      expect(result.graphResultsPerEntity).toBe(3);
      expect(result.total).toBe(30);
    });

    it("applies per-call overrides for all fields", async () => {
      const { resolveRecallLimits } = await import("../../src/config");

      const result = resolveRecallLimits({
        memories: 100,
        facts: 50,
        graphHops: 4,
        graphEntitiesPerHop: 20,
        graphResultsPerEntity: 10,
        total: 200,
      });

      expect(result.memories).toBe(100);
      expect(result.facts).toBe(50);
      expect(result.graphHops).toBe(4);
      expect(result.graphEntitiesPerHop).toBe(20);
      expect(result.graphResultsPerEntity).toBe(10);
      expect(result.total).toBe(200);
    });

    it("applies partial overrides, keeping defaults for unspecified fields", async () => {
      const { resolveRecallLimits } = await import("../../src/config");

      const result = resolveRecallLimits({
        memories: 50,
        graphHops: 1,
      });

      expect(result.memories).toBe(50);
      expect(result.facts).toBe(15); // Default
      expect(result.graphHops).toBe(1);
      expect(result.graphEntitiesPerHop).toBe(5); // Default
      expect(result.graphResultsPerEntity).toBe(3); // Default
      expect(result.total).toBe(30); // Default
    });

    it("maps legacy limit param to total", async () => {
      const { resolveRecallLimits } = await import("../../src/config");

      const result = resolveRecallLimits(undefined, 25);

      expect(result.total).toBe(25);
    });

    it("prefers limits.total over legacy limit param", async () => {
      const { resolveRecallLimits } = await import("../../src/config");

      const result = resolveRecallLimits({ total: 50 }, 25);

      expect(result.total).toBe(50); // limits.total takes precedence
    });

    it("uses legacy limit when limits.total is undefined", async () => {
      const { resolveRecallLimits } = await import("../../src/config");

      const result = resolveRecallLimits({ memories: 100 }, 25);

      expect(result.total).toBe(25); // Falls back to legacy
      expect(result.memories).toBe(100);
    });

    it("per-call overrides take precedence over env vars", async () => {
      process.env.CORTEX_RECALL_LIMIT_MEMORIES = "1000";
      const { resolveRecallLimits } = await import("../../src/config");

      const result = resolveRecallLimits({ memories: 5 });

      expect(result.memories).toBe(5); // Per-call override wins
    });

    it("returns fully populated Required<RecallLimits>", async () => {
      const { resolveRecallLimits } = await import("../../src/config");

      const result = resolveRecallLimits({});

      // All fields should be defined (not undefined)
      expect(typeof result.memories).toBe("number");
      expect(typeof result.facts).toBe("number");
      expect(typeof result.graphHops).toBe("number");
      expect(typeof result.graphEntitiesPerHop).toBe("number");
      expect(typeof result.graphResultsPerEntity).toBe("number");
      expect(typeof result.total).toBe("number");
    });

    it("allows disabling graph with graphHops: 0", async () => {
      const { resolveRecallLimits } = await import("../../src/config");

      const result = resolveRecallLimits({ graphHops: 0 });

      expect(result.graphHops).toBe(0);
    });
  });

  describe("Configuration Hierarchy", () => {
    it("follows hierarchy: per-call > env > defaults", async () => {
      // Set env var
      process.env.CORTEX_RECALL_LIMIT_MEMORIES = "100";

      const { resolveRecallLimits, RECALL_DEFAULTS } = await import(
        "../../src/config"
      );

      // RECALL_DEFAULTS should reflect env var
      expect(RECALL_DEFAULTS.memories).toBe(100);

      // Per-call should override env var
      const result = resolveRecallLimits({ memories: 5 });
      expect(result.memories).toBe(5);

      // Without per-call override, should use env var value
      const result2 = resolveRecallLimits({});
      expect(result2.memories).toBe(100);
    });
  });
});
