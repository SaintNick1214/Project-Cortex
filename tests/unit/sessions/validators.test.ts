/**
 * Unit Tests: Session Validators
 *
 * Tests for session validation functions.
 * No Convex dependency - pure unit tests.
 */

import {
  validateSessionId,
  validateCreateSessionParams,
  validateSessionFilters,
  validateStatus,
  SessionValidationError,
} from "../../../src/sessions/validators";
import type {
  CreateSessionParams,
  SessionFilters,
  SessionStatus,
} from "../../../src/sessions/types";

describe("Session Validators", () => {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // validateSessionId
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("validateSessionId", () => {
    it("should accept valid session IDs", () => {
      expect(() => validateSessionId("sess_abc123")).not.toThrow();
      expect(() => validateSessionId("session-uuid-v4")).not.toThrow();
      expect(() =>
        validateSessionId("550e8400-e29b-41d4-a716-446655440000")
      ).not.toThrow();
      expect(() => validateSessionId("s")).not.toThrow();
    });

    it("should reject empty session IDs", () => {
      expect(() => validateSessionId("")).toThrow(SessionValidationError);
      expect(() => validateSessionId("")).toThrow("cannot be empty");
    });

    it("should reject non-string session IDs", () => {
      expect(() => validateSessionId(null as unknown as string)).toThrow(
        SessionValidationError
      );
      expect(() => validateSessionId(undefined as unknown as string)).toThrow(
        SessionValidationError
      );
      expect(() => validateSessionId(123 as unknown as string)).toThrow(
        SessionValidationError
      );
    });

    it("should reject session IDs exceeding max length", () => {
      const longId = "s".repeat(257);
      expect(() => validateSessionId(longId)).toThrow(SessionValidationError);
      expect(() => validateSessionId(longId)).toThrow("cannot exceed 256");
    });

    it("should accept session IDs at max length", () => {
      const maxId = "s".repeat(256);
      expect(() => validateSessionId(maxId)).not.toThrow();
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // validateCreateSessionParams
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("validateCreateSessionParams", () => {
    it("should accept minimal valid params", () => {
      const params: CreateSessionParams = {
        userId: "user_123",
      };

      expect(() => validateCreateSessionParams(params)).not.toThrow();
    });

    it("should accept full params with all optional fields", () => {
      const params: CreateSessionParams = {
        userId: "user_123",
        tenantId: "tenant_abc",
        memorySpaceId: "space_xyz",
        metadata: {
          deviceId: "device_123",
          ipAddress: "192.168.1.1",
        },
        expiresAt: Date.now() + 86400000, // 24 hours from now
      };

      expect(() => validateCreateSessionParams(params)).not.toThrow();
    });

    it("should reject missing userId", () => {
      const params = {} as CreateSessionParams;

      expect(() => validateCreateSessionParams(params)).toThrow(
        SessionValidationError
      );
      expect(() => validateCreateSessionParams(params)).toThrow(
        "userId is required"
      );
    });

    it("should reject empty userId", () => {
      const params: CreateSessionParams = {
        userId: "",
      };

      expect(() => validateCreateSessionParams(params)).toThrow(
        SessionValidationError
      );
    });

    it("should reject invalid metadata type", () => {
      const params: CreateSessionParams = {
        userId: "user_123",
        metadata: "invalid" as any,
      };

      expect(() => validateCreateSessionParams(params)).toThrow(
        SessionValidationError
      );
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // validateSessionFilters
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("validateSessionFilters", () => {
    it("should accept empty filters", () => {
      const filters: SessionFilters = {};

      expect(() => validateSessionFilters(filters)).not.toThrow();
    });

    it("should accept valid userId filter", () => {
      const filters: SessionFilters = {
        userId: "user_123",
      };

      expect(() => validateSessionFilters(filters)).not.toThrow();
    });

    it("should accept valid tenantId filter", () => {
      const filters: SessionFilters = {
        tenantId: "tenant_abc",
      };

      expect(() => validateSessionFilters(filters)).not.toThrow();
    });

    it("should accept valid status filter", () => {
      const filters: SessionFilters = {
        status: "active",
      };

      expect(() => validateSessionFilters(filters)).not.toThrow();
    });

    it("should accept all status values", () => {
      const statuses: SessionStatus[] = ["active", "idle", "ended"];

      statuses.forEach((status) => {
        const filters: SessionFilters = { status };
        expect(() => validateSessionFilters(filters)).not.toThrow();
      });
    });

    it("should reject invalid status", () => {
      const filters = {
        status: "invalid" as SessionStatus,
      };

      expect(() => validateSessionFilters(filters)).toThrow(
        SessionValidationError
      );
    });

    it("should accept combined filters", () => {
      const filters: SessionFilters = {
        userId: "user_123",
        tenantId: "tenant_abc",
        status: "active",
        memorySpaceId: "space_xyz",
      };

      expect(() => validateSessionFilters(filters)).not.toThrow();
    });

    it("should accept pagination parameters", () => {
      const filters: SessionFilters = {
        userId: "user_123",
        limit: 50,
        offset: 10,
      };

      expect(() => validateSessionFilters(filters)).not.toThrow();
    });

    it("should reject negative limit", () => {
      const filters: SessionFilters = {
        limit: -1,
      };

      expect(() => validateSessionFilters(filters)).toThrow(
        SessionValidationError
      );
    });

    it("should reject limit exceeding maximum", () => {
      const filters: SessionFilters = {
        limit: 1001, // Max is 1000
      };

      expect(() => validateSessionFilters(filters)).toThrow(
        SessionValidationError
      );
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // validateStatus
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("validateStatus", () => {
    it("should accept valid statuses", () => {
      expect(() => validateStatus("active")).not.toThrow();
      expect(() => validateStatus("idle")).not.toThrow();
      expect(() => validateStatus("ended")).not.toThrow();
    });

    it("should reject invalid statuses", () => {
      expect(() => validateStatus("pending" as any)).toThrow(
        SessionValidationError
      );
      expect(() => validateStatus("expired" as any)).toThrow(
        SessionValidationError
      );
      expect(() => validateStatus("" as any)).toThrow(SessionValidationError);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SessionValidationError
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("SessionValidationError", () => {
    it("should be instanceof Error", () => {
      const error = new SessionValidationError("test error", "TEST_CODE");
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(SessionValidationError);
    });

    it("should have correct name", () => {
      const error = new SessionValidationError("test", "TEST_CODE");
      expect(error.name).toBe("SessionValidationError");
    });

    it("should include field name when provided", () => {
      const error = new SessionValidationError(
        "invalid value",
        "INVALID_VALUE",
        "sessionId"
      );
      expect(error.message).toContain("invalid value");
      expect(error.field).toBe("sessionId");
      expect(error.code).toBe("INVALID_VALUE");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Edge Cases
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Edge Cases", () => {
    it("should handle very long but valid session IDs", () => {
      const longId = "sess_" + "a".repeat(250); // Just under max
      expect(() => validateSessionId(longId)).not.toThrow();
    });

    it("should handle Unicode in session IDs", () => {
      // Some providers might include Unicode
      expect(() => validateSessionId("sess_测试123")).not.toThrow();
    });

    it("should handle metadata with various value types", () => {
      const params: CreateSessionParams = {
        userId: "user_123",
        metadata: {
          string: "value",
          number: 42,
          boolean: true,
          null: null,
          array: [1, 2, 3],
          nested: { deep: { value: true } },
        },
      };
      expect(() => validateCreateSessionParams(params)).not.toThrow();
    });
  });
});
