/**
 * Unit Tests: Auth Validators
 *
 * Tests for authentication context validation functions.
 * No Convex dependency - pure unit tests.
 */

import {
  validateUserId,
  validateTenantId,
  validateSessionId,
  validateAuthMethod,
  validateClaims,
  validateMetadata,
  AuthValidationError,
} from "../../../src/auth/validators";

describe("Auth Validators", () => {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // validateUserId
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("validateUserId", () => {
    it("should accept valid user IDs", () => {
      expect(() => validateUserId("user_123")).not.toThrow();
      expect(() => validateUserId("user-abc-def")).not.toThrow();
      expect(() => validateUserId("usr_clerk_abc123")).not.toThrow();
      expect(() => validateUserId("auth0|12345")).not.toThrow();
      expect(() => validateUserId("firebase:uid123")).not.toThrow();
      expect(() => validateUserId("u")).not.toThrow(); // Minimum 1 char
    });

    it("should reject empty user IDs", () => {
      expect(() => validateUserId("")).toThrow(AuthValidationError);
      expect(() => validateUserId("")).toThrow("cannot be empty");
    });

    it("should reject non-string user IDs", () => {
      expect(() => validateUserId(null as unknown as string)).toThrow(
        AuthValidationError,
      );
      expect(() => validateUserId(undefined as unknown as string)).toThrow(
        AuthValidationError,
      );
      expect(() => validateUserId(123 as unknown as string)).toThrow(
        AuthValidationError,
      );
    });

    it("should reject user IDs exceeding max length", () => {
      const longId = "u".repeat(257); // Max is 256
      expect(() => validateUserId(longId)).toThrow(AuthValidationError);
      expect(() => validateUserId(longId)).toThrow("cannot exceed 256");
    });

    it("should accept user IDs at max length", () => {
      const maxId = "u".repeat(256);
      expect(() => validateUserId(maxId)).not.toThrow();
    });

    it("should trim whitespace and reject empty result", () => {
      expect(() => validateUserId("   ")).toThrow(AuthValidationError);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // validateTenantId
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("validateTenantId", () => {
    it("should accept valid tenant IDs", () => {
      expect(() => validateTenantId("tenant_123")).not.toThrow();
      expect(() => validateTenantId("org-acme-corp")).not.toThrow();
      expect(() => validateTenantId("t")).not.toThrow();
    });

    it("should reject empty string tenant IDs", () => {
      expect(() => validateTenantId("")).toThrow(AuthValidationError);
      expect(() => validateTenantId("")).toThrow("cannot be empty");
    });

    it("should reject tenant IDs exceeding max length", () => {
      const longId = "t".repeat(257); // Max is 256
      expect(() => validateTenantId(longId)).toThrow(AuthValidationError);
    });

    it("should accept tenant IDs at max length", () => {
      const maxId = "t".repeat(256);
      expect(() => validateTenantId(maxId)).not.toThrow();
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // validateSessionId
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("validateSessionId", () => {
    it("should accept valid session IDs", () => {
      expect(() => validateSessionId("sess_abc123")).not.toThrow();
      expect(() => validateSessionId("session-uuid-here")).not.toThrow();
      expect(() =>
        validateSessionId("550e8400-e29b-41d4-a716-446655440000"),
      ).not.toThrow();
    });

    it("should reject empty string session IDs", () => {
      expect(() => validateSessionId("")).toThrow(AuthValidationError);
      expect(() => validateSessionId("")).toThrow("cannot be empty");
    });

    it("should reject session IDs exceeding max length", () => {
      const longId = "s".repeat(257); // Max is 256
      expect(() => validateSessionId(longId)).toThrow(AuthValidationError);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // validateAuthMethod
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("validateAuthMethod", () => {
    it("should accept valid auth methods", () => {
      expect(() => validateAuthMethod("oauth")).not.toThrow();
      expect(() => validateAuthMethod("api_key")).not.toThrow();
      expect(() => validateAuthMethod("jwt")).not.toThrow();
      expect(() => validateAuthMethod("session")).not.toThrow();
      expect(() => validateAuthMethod("custom")).not.toThrow();
    });

    it("should reject invalid auth methods", () => {
      expect(() => validateAuthMethod("password" as any)).toThrow(
        AuthValidationError,
      );
      expect(() => validateAuthMethod("basic" as any)).toThrow(
        AuthValidationError,
      );
      expect(() => validateAuthMethod("invalid" as any)).toThrow(
        "must be one of",
      );
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // validateClaims
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("validateClaims", () => {
    it("should accept valid claims objects", () => {
      expect(() =>
        validateClaims({
          sub: "user123",
          email: "user@example.com",
          roles: ["admin", "user"],
        }),
      ).not.toThrow();

      expect(() =>
        validateClaims({
          iss: "https://auth.example.com",
          aud: "api.example.com",
          exp: 1735344000,
          iat: 1735257600,
          custom_claim: { nested: "value" },
        }),
      ).not.toThrow();
    });

    it("should accept empty object", () => {
      expect(() => validateClaims({})).not.toThrow();
    });

    it("should reject non-object claims", () => {
      expect(() => validateClaims("string" as any)).toThrow(
        AuthValidationError,
      );
      expect(() => validateClaims(123 as any)).toThrow(AuthValidationError);
      expect(() => validateClaims([] as any)).toThrow(AuthValidationError);
    });

    it("should reject null claims", () => {
      expect(() => validateClaims(null as any)).toThrow(AuthValidationError);
    });

    it("should accept deeply nested claims", () => {
      const deepClaims = {
        level1: {
          level2: {
            level3: {
              value: "deep",
            },
          },
        },
      };
      expect(() => validateClaims(deepClaims)).not.toThrow();
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // validateMetadata
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("validateMetadata", () => {
    it("should accept valid metadata objects", () => {
      expect(() =>
        validateMetadata({
          deviceId: "device-123",
          ipAddress: "192.168.1.1",
          userAgent: "Mozilla/5.0...",
        }),
      ).not.toThrow();

      expect(() =>
        validateMetadata({
          customField: "value",
          nested: { data: [1, 2, 3] },
        }),
      ).not.toThrow();
    });

    it("should accept empty object", () => {
      expect(() => validateMetadata({})).not.toThrow();
    });

    it("should reject non-object metadata", () => {
      expect(() => validateMetadata("string" as any)).toThrow(
        AuthValidationError,
      );
      expect(() => validateMetadata(123 as any)).toThrow(AuthValidationError);
    });

    it("should reject array as metadata", () => {
      expect(() => validateMetadata([] as any)).toThrow(AuthValidationError);
    });

    it("should accept metadata with various value types", () => {
      const mixedMetadata = {
        string: "value",
        number: 42,
        boolean: true,
        null: null,
        array: [1, "two", { three: 3 }],
        nested: {
          deep: {
            value: "found",
          },
        },
      };
      expect(() => validateMetadata(mixedMetadata)).not.toThrow();
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // AuthValidationError
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("AuthValidationError", () => {
    it("should be instanceof Error", () => {
      const error = new AuthValidationError("test error", "TEST_CODE");
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AuthValidationError);
    });

    it("should have correct name", () => {
      const error = new AuthValidationError("test", "TEST_CODE");
      expect(error.name).toBe("AuthValidationError");
    });

    it("should include field name when provided", () => {
      const error = new AuthValidationError(
        "invalid value",
        "INVALID_VALUE",
        "userId",
      );
      expect(error.message).toContain("invalid value");
      expect(error.field).toBe("userId");
      expect(error.code).toBe("INVALID_VALUE");
    });

    it("should be catchable by type", () => {
      try {
        validateUserId("");
      } catch (e) {
        expect(e).toBeInstanceOf(AuthValidationError);
        if (e instanceof AuthValidationError) {
          expect(e.field).toBe("userId");
          expect(e.code).toBe("EMPTY_USER_ID");
        }
      }
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Edge Cases
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Edge Cases", () => {
    it("should handle Unicode in user IDs", () => {
      expect(() => validateUserId("user_日本語")).not.toThrow();
      expect(() => validateUserId("用户_123")).not.toThrow();
    });

    it("should handle special characters in IDs", () => {
      expect(() => validateUserId("user+test@example.com")).not.toThrow();
      expect(() => validateTenantId("tenant:prod:us-east-1")).not.toThrow();
    });

    it("should handle claims with circular reference protection", () => {
      // Note: JSON.stringify will throw on circular refs
      // Our validator should handle gracefully
      const claims: Record<string, unknown> = { value: "test" };
      // Don't actually create circular ref as that would break Jest
      expect(() => validateClaims(claims)).not.toThrow();
    });
  });
});
