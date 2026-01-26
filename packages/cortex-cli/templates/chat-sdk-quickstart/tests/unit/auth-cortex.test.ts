/**
 * Unit Tests for lib/auth-cortex.ts
 *
 * Tests the Auth.js to Cortex auth context bridge:
 * - getCortexAuthContext
 * - createCortexAuthContextFromSession
 * - getUserIdFromSession
 * - isAuthenticated
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/app/(auth)/auth";
import type { AuthSession } from "@/lib/auth-cortex";

// Mock the createAuthContext function from SDK
vi.mock("@cortexmemory/sdk", () => ({
  createAuthContext: vi.fn((input) => ({
    ...input,
    _type: "AuthContext",
  })),
}));

// auth is already mocked in setup.ts, but we need to type it properly
const mockAuth = auth as ReturnType<typeof vi.fn>;

describe("lib/auth-cortex", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getCortexAuthContext", () => {
    it("returns AuthContext when session has valid user", async () => {
      mockAuth.mockResolvedValue({
        user: {
          id: "user-123",
          email: "test@example.com",
          name: "Test User",
          type: "regular",
        },
        expires: "2025-12-31T23:59:59.999Z",
      });

      const { getCortexAuthContext } = await import("@/lib/auth-cortex");

      const result = await getCortexAuthContext();

      expect(result).toBeDefined();
      expect(result?.userId).toBe("user-123");
      expect(result?.authProvider).toBe("nextauth");
      expect(result?.authMethod).toBe("session");
      expect(result?.metadata).toEqual({
        email: "test@example.com",
        name: "Test User",
        userType: "regular",
      });
    });

    it("returns null when session is null", async () => {
      mockAuth.mockResolvedValue(null);

      const { getCortexAuthContext } = await import("@/lib/auth-cortex");

      const result = await getCortexAuthContext();

      expect(result).toBeNull();
    });

    it("returns null when session has no user", async () => {
      mockAuth.mockResolvedValue({
        expires: "2025-12-31T23:59:59.999Z",
      });

      const { getCortexAuthContext } = await import("@/lib/auth-cortex");

      const result = await getCortexAuthContext();

      expect(result).toBeNull();
    });

    it("returns null when user has no id", async () => {
      mockAuth.mockResolvedValue({
        user: {
          email: "test@example.com",
          name: "Test User",
        },
        expires: "2025-12-31T23:59:59.999Z",
      });

      const { getCortexAuthContext } = await import("@/lib/auth-cortex");

      const result = await getCortexAuthContext();

      expect(result).toBeNull();
    });

    it("handles null email and name in metadata", async () => {
      mockAuth.mockResolvedValue({
        user: {
          id: "user-123",
          email: null,
          name: null,
        },
      });

      const { getCortexAuthContext } = await import("@/lib/auth-cortex");

      const result = await getCortexAuthContext();

      expect(result).toBeDefined();
      expect(result?.metadata?.email).toBeUndefined();
      expect(result?.metadata?.name).toBeUndefined();
    });
  });

  describe("createCortexAuthContextFromSession", () => {
    it("creates AuthContext from valid session", async () => {
      const session: AuthSession = {
        user: {
          id: "user-456",
          email: "session@example.com",
          name: "Session User",
          type: "premium",
        },
      };

      const { createCortexAuthContextFromSession } = await import(
        "@/lib/auth-cortex"
      );

      const result = createCortexAuthContextFromSession(session);

      expect(result).toBeDefined();
      expect(result?.userId).toBe("user-456");
      expect(result?.authProvider).toBe("nextauth");
      expect(result?.metadata?.userType).toBe("premium");
    });

    it("returns null for null session", async () => {
      const { createCortexAuthContextFromSession } = await import(
        "@/lib/auth-cortex"
      );

      const result = createCortexAuthContextFromSession(null);

      expect(result).toBeNull();
    });

    it("returns null when session user has no id", async () => {
      const session: AuthSession = {
        user: {
          email: "no-id@example.com",
        },
      };

      const { createCortexAuthContextFromSession } = await import(
        "@/lib/auth-cortex"
      );

      const result = createCortexAuthContextFromSession(session);

      expect(result).toBeNull();
    });

    it("returns null when session has empty user object", async () => {
      const session: AuthSession = {
        user: {},
      };

      const { createCortexAuthContextFromSession } = await import(
        "@/lib/auth-cortex"
      );

      const result = createCortexAuthContextFromSession(session);

      expect(result).toBeNull();
    });
  });

  describe("getUserIdFromSession", () => {
    it("returns user id when session has valid user", async () => {
      const session: AuthSession = {
        user: { id: "user-789" },
      };

      const { getUserIdFromSession } = await import("@/lib/auth-cortex");

      expect(getUserIdFromSession(session)).toBe("user-789");
    });

    it("returns 'anonymous' as default when session is null", async () => {
      const { getUserIdFromSession } = await import("@/lib/auth-cortex");

      expect(getUserIdFromSession(null)).toBe("anonymous");
    });

    it("returns custom fallback when provided", async () => {
      const { getUserIdFromSession } = await import("@/lib/auth-cortex");

      expect(getUserIdFromSession(null, "guest-user")).toBe("guest-user");
    });

    it("returns fallback when user has no id", async () => {
      const session: AuthSession = {
        user: { email: "no-id@example.com" },
      };

      const { getUserIdFromSession } = await import("@/lib/auth-cortex");

      expect(getUserIdFromSession(session, "fallback-id")).toBe("fallback-id");
    });
  });

  describe("isAuthenticated", () => {
    it("returns true when session has user with id", async () => {
      const session: AuthSession = {
        user: { id: "user-123" },
      };

      const { isAuthenticated } = await import("@/lib/auth-cortex");

      expect(isAuthenticated(session)).toBe(true);
    });

    it("returns false for null session", async () => {
      const { isAuthenticated } = await import("@/lib/auth-cortex");

      expect(isAuthenticated(null)).toBe(false);
    });

    it("returns false when session has no user", async () => {
      const session: AuthSession = {};

      const { isAuthenticated } = await import("@/lib/auth-cortex");

      expect(isAuthenticated(session)).toBe(false);
    });

    it("returns false when user has no id", async () => {
      const session: AuthSession = {
        user: { email: "no-id@example.com" },
      };

      const { isAuthenticated } = await import("@/lib/auth-cortex");

      expect(isAuthenticated(session)).toBe(false);
    });

    it("returns false when user id is empty string", async () => {
      const session: AuthSession = {
        user: { id: "" },
      };

      const { isAuthenticated } = await import("@/lib/auth-cortex");

      // Empty string is falsy
      expect(isAuthenticated(session)).toBe(false);
    });
  });
});
