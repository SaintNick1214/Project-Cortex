/**
 * Unit Tests for lib/cortex.ts
 *
 * Tests the Cortex SDK client helpers: getCortex, getCortexWithAuth,
 * getMemorySpaceId, and getAgentId.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMockAuthContext } from "../helpers/mock-cortex";

// Mock the Cortex SDK before importing the module under test
vi.mock("@cortexmemory/sdk", () => ({
  Cortex: vi.fn().mockImplementation((config) => ({
    _config: config,
    conversations: {},
    artifacts: {},
    memory: {},
  })),
}));

describe("lib/cortex", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Store original env
    originalEnv = { ...process.env };

    // Clear module cache to reset singleton
    vi.resetModules();
  });

  afterEach(() => {
    // Restore environment
    process.env = originalEnv;
  });

  describe("getCortex", () => {
    it("creates a Cortex client with convexUrl from environment", async () => {
      process.env.CONVEX_URL = "https://test-convex.cloud";

      const { getCortex } = await import("@/lib/cortex");

      const client = getCortex();

      expect(client).toBeDefined();
      expect(client._config).toEqual({
        convexUrl: "https://test-convex.cloud",
      });
    });

    it("returns singleton instance on subsequent calls", async () => {
      process.env.CONVEX_URL = "https://test-convex.cloud";

      const { getCortex } = await import("@/lib/cortex");

      const instance1 = getCortex();
      const instance2 = getCortex();

      expect(instance1).toBe(instance2);
    });

    it("throws error when CONVEX_URL is not set", async () => {
      delete process.env.CONVEX_URL;

      const { getCortex } = await import("@/lib/cortex");

      expect(() => getCortex()).toThrow(
        "CONVEX_URL environment variable is required",
      );
    });
  });

  describe("getCortexWithAuth", () => {
    it("creates authenticated Cortex client with auth context", async () => {
      process.env.CONVEX_URL = "https://test-convex.cloud";

      const { getCortexWithAuth } = await import("@/lib/cortex");
      const authContext = createMockAuthContext({ userId: "user-456" });

      const client = getCortexWithAuth(authContext);

      expect(client).toBeDefined();
      expect(client._config).toEqual({
        convexUrl: "https://test-convex.cloud",
        auth: authContext,
      });
    });

    it("creates new instance each call (not singleton)", async () => {
      process.env.CONVEX_URL = "https://test-convex.cloud";

      const { getCortexWithAuth } = await import("@/lib/cortex");
      const authContext1 = createMockAuthContext({ userId: "user-1" });
      const authContext2 = createMockAuthContext({ userId: "user-2" });

      const instance1 = getCortexWithAuth(authContext1);
      const instance2 = getCortexWithAuth(authContext2);

      // Each call creates a new instance for different auth contexts
      expect(instance1._config.auth.userId).toBe("user-1");
      expect(instance2._config.auth.userId).toBe("user-2");
    });

    it("throws error when CONVEX_URL is not set", async () => {
      delete process.env.CONVEX_URL;

      const { getCortexWithAuth } = await import("@/lib/cortex");
      const authContext = createMockAuthContext();

      expect(() => getCortexWithAuth(authContext)).toThrow(
        "CONVEX_URL environment variable is required",
      );
    });
  });

  describe("getMemorySpaceId", () => {
    it("returns MEMORY_SPACE_ID from environment when set", async () => {
      process.env.MEMORY_SPACE_ID = "custom-memory-space";

      const { getMemorySpaceId } = await import("@/lib/cortex");

      expect(getMemorySpaceId()).toBe("custom-memory-space");
    });

    it("returns default 'chat-sdk-demo' when env not set", async () => {
      delete process.env.MEMORY_SPACE_ID;

      const { getMemorySpaceId } = await import("@/lib/cortex");

      expect(getMemorySpaceId()).toBe("chat-sdk-demo");
    });

    it("returns default when env is empty string", async () => {
      process.env.MEMORY_SPACE_ID = "";

      const { getMemorySpaceId } = await import("@/lib/cortex");

      // Empty string is falsy, so default is returned
      expect(getMemorySpaceId()).toBe("chat-sdk-demo");
    });
  });

  describe("getAgentId", () => {
    it("returns AGENT_ID from environment when set", async () => {
      process.env.AGENT_ID = "custom-agent-id";

      const { getAgentId } = await import("@/lib/cortex");

      expect(getAgentId()).toBe("custom-agent-id");
    });

    it("returns default 'chat-assistant' when env not set", async () => {
      delete process.env.AGENT_ID;

      const { getAgentId } = await import("@/lib/cortex");

      expect(getAgentId()).toBe("chat-assistant");
    });

    it("returns default when env is empty string", async () => {
      process.env.AGENT_ID = "";

      const { getAgentId } = await import("@/lib/cortex");

      // Empty string is falsy, so default is returned
      expect(getAgentId()).toBe("chat-assistant");
    });
  });
});
