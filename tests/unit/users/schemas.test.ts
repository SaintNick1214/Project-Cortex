/**
 * Unit Tests: User Schemas
 *
 * Tests for StandardUserProfile and validation presets.
 * No Convex dependency - pure unit tests.
 */

import {
  validateUserProfile,
  validationPresets,
  createUserProfile,
} from "../../../src/users/schemas";
import type { StandardUserProfile, ValidationPreset } from "../../../src/users/schemas";

describe("User Schemas", () => {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // StandardUserProfile - Basic Validation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("StandardUserProfile - Basic Validation", () => {
    it("should accept minimal valid profile with displayName", () => {
      const profile: StandardUserProfile = {
        displayName: "John Doe",
      };

      const result = validateUserProfile(profile);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should accept full profile with all standard fields", () => {
      const profile: StandardUserProfile = {
        displayName: "Jane Smith",
        email: "jane@example.com",
        avatarUrl: "https://example.com/avatar.jpg",
        preferences: {
          theme: "dark",
          language: "en",
        },
        platformMetadata: {
          plan: "premium",
          signupDate: "2024-01-15",
        },
      };

      const result = validateUserProfile(profile, validationPresets.standard);
      expect(result.valid).toBe(true);
    });

    it("should reject profile missing displayName with minimal preset", () => {
      const profile = {
        email: "user@example.com",
      } as StandardUserProfile;

      const result = validateUserProfile(profile, validationPresets.minimal);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("displayName"))).toBe(true);
    });

    it("should reject empty displayName", () => {
      const profile: StandardUserProfile = {
        displayName: "",
      };

      const result = validateUserProfile(profile, validationPresets.minimal);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("empty"))).toBe(true);
    });

    it("should reject displayName with only whitespace", () => {
      const profile: StandardUserProfile = {
        displayName: "   ",
      };

      const result = validateUserProfile(profile, validationPresets.minimal);
      expect(result.valid).toBe(false);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Email Validation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Email Validation", () => {
    it("should accept valid email formats with standard preset", () => {
      const validEmails = [
        "user@example.com",
        "user.name@example.com",
        "user+tag@example.com",
        "user@subdomain.example.com",
        "user123@example.co.uk",
        "a@b.co",
      ];

      validEmails.forEach((email) => {
        const profile: StandardUserProfile = {
          displayName: "Test",
          email,
        };
        const result = validateUserProfile(profile, validationPresets.standard);
        expect(result.valid).toBe(true);
      });
    });

    it("should reject invalid email formats with standard preset", () => {
      const invalidEmails = [
        "not-an-email",
        "@example.com",
        "user@",
        "user@ example.com",
      ];

      invalidEmails.forEach((email) => {
        const profile: StandardUserProfile = {
          displayName: "Test",
          email,
        };
        const result = validateUserProfile(profile, validationPresets.standard);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes("email"))).toBe(true);
      });
    });

    it("should accept undefined email (optional field)", () => {
      const profile: StandardUserProfile = {
        displayName: "John",
        email: undefined,
      };

      const result = validateUserProfile(profile, validationPresets.minimal);
      expect(result.valid).toBe(true);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Preferences - Extensibility
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Preferences - Extensibility", () => {
    it("should accept arbitrary preference structure", () => {
      const profile: StandardUserProfile = {
        displayName: "John",
        preferences: {
          theme: "dark",
          fontSize: 14,
          notifications: {
            email: true,
            push: false,
            sms: false,
          },
          customSetting: "custom-value",
          arrayPref: [1, 2, 3],
        },
      };

      const result = validateUserProfile(profile);
      expect(result.valid).toBe(true);
    });

    it("should accept empty preferences object", () => {
      const profile: StandardUserProfile = {
        displayName: "John",
        preferences: {},
      };

      const result = validateUserProfile(profile);
      expect(result.valid).toBe(true);
    });

    it("should accept deeply nested preferences", () => {
      const profile: StandardUserProfile = {
        displayName: "John",
        preferences: {
          level1: {
            level2: {
              level3: {
                level4: {
                  value: "deep",
                },
              },
            },
          },
        },
      };

      const result = validateUserProfile(profile);
      expect(result.valid).toBe(true);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PlatformMetadata - Extensibility
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("PlatformMetadata - Extensibility", () => {
    it("should accept arbitrary platform metadata", () => {
      const profile: StandardUserProfile = {
        displayName: "John",
        platformMetadata: {
          stripeCustomerId: "cus_123abc",
          subscriptionTier: "enterprise",
          features: ["feature_a", "feature_b"],
          quotas: {
            apiCalls: 10000,
            storage: "100GB",
          },
        },
      };

      const result = validateUserProfile(profile);
      expect(result.valid).toBe(true);
    });

    it("should accept empty platformMetadata object", () => {
      const profile: StandardUserProfile = {
        displayName: "John",
        platformMetadata: {},
      };

      const result = validateUserProfile(profile);
      expect(result.valid).toBe(true);
    });

    it("should accept any developer-defined fields", () => {
      const profile: StandardUserProfile = {
        displayName: "John",
        platformMetadata: {
          customField1: "value1",
          customField2: { nested: true },
          customField3: [1, "two", { three: 3 }],
        },
      };

      const result = validateUserProfile(profile);
      expect(result.valid).toBe(true);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Custom Fields (Index Signature)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Custom Fields (Index Signature)", () => {
    it("should accept arbitrary additional fields", () => {
      const profile: StandardUserProfile = {
        displayName: "John",
        customField1: "value",
        customField2: 123,
        customField3: { nested: true },
      };

      const result = validateUserProfile(profile);
      expect(result.valid).toBe(true);
      expect(profile.customField1).toBe("value");
    });

    it("should preserve custom fields through validation", () => {
      const profile: StandardUserProfile = {
        displayName: "John",
        myCustomThing: "preserved",
      };

      const result = validateUserProfile(profile);
      expect(result.valid).toBe(true);
      expect(profile.myCustomThing).toBe("preserved");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Validation Presets
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Validation Presets", () => {
    describe("strict preset", () => {
      it("should require displayName AND email", () => {
        const profileWithoutEmail: StandardUserProfile = {
          displayName: "John",
        };

        const result = validateUserProfile(
          profileWithoutEmail,
          validationPresets.strict
        );
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes("email"))).toBe(true);
      });

      it("should validate email format", () => {
        const profileWithBadEmail: StandardUserProfile = {
          displayName: "John",
          email: "not-an-email",
        };

        const result = validateUserProfile(
          profileWithBadEmail,
          validationPresets.strict
        );
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes("email"))).toBe(true);
      });

      it("should accept valid strict profile", () => {
        const validProfile: StandardUserProfile = {
          displayName: "John Doe",
          email: "john@example.com",
        };

        const result = validateUserProfile(
          validProfile,
          validationPresets.strict
        );
        expect(result.valid).toBe(true);
      });

      it("should enforce max data size", () => {
        // Create a profile that exceeds 64KB
        const largeData = "x".repeat(70 * 1024); // 70KB
        const profile: StandardUserProfile = {
          displayName: "John",
          email: "john@example.com",
          platformMetadata: {
            largeField: largeData,
          },
        };

        const result = validateUserProfile(profile, validationPresets.strict);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes("exceeds maximum size"))).toBe(
          true
        );
      });
    });

    describe("minimal preset", () => {
      it("should only require displayName", () => {
        const profile: StandardUserProfile = {
          displayName: "John",
        };

        const result = validateUserProfile(profile, validationPresets.minimal);
        expect(result.valid).toBe(true);
      });

      it("should not validate email format", () => {
        const profile: StandardUserProfile = {
          displayName: "John",
          email: "invalid-email", // Won't be validated
        };

        // minimal preset doesn't validate email format
        const result = validateUserProfile(profile, validationPresets.minimal);
        expect(result.valid).toBe(true);
      });
    });

    describe("none preset", () => {
      it("should accept any profile", () => {
        const emptyProfile = {} as StandardUserProfile;

        const result = validateUserProfile(emptyProfile, validationPresets.none);
        expect(result.valid).toBe(true);
      });

      it("should skip all validation", () => {
        const invalidProfile = {
          displayName: "", // Empty
          email: "bad", // Invalid
        } as unknown as StandardUserProfile;

        const result = validateUserProfile(
          invalidProfile,
          validationPresets.none
        );
        expect(result.valid).toBe(true);
      });
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // validationPresets constant
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("validationPresets constant", () => {
    it("should have strict preset with correct config", () => {
      expect(validationPresets.strict).toBeDefined();
      expect(validationPresets.strict.requiredFields).toContain("displayName");
      expect(validationPresets.strict.requiredFields).toContain("email");
      expect(validationPresets.strict.validateEmail).toBe(true);
      expect(validationPresets.strict.maxDataSize).toBe(64 * 1024);
    });

    it("should have minimal preset with correct config", () => {
      expect(validationPresets.minimal).toBeDefined();
      expect(validationPresets.minimal.requiredFields).toContain("displayName");
      expect(validationPresets.minimal.requiredFields).not.toContain("email");
    });

    it("should have none preset with empty config", () => {
      expect(validationPresets.none).toBeDefined();
      expect(Object.keys(validationPresets.none)).toHaveLength(0);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // createUserProfile
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("createUserProfile", () => {
    it("should create profile with defaults", () => {
      const profile = createUserProfile(
        { displayName: "Alice" },
        { status: "active", preferences: { theme: "light" } }
      );

      expect(profile.displayName).toBe("Alice");
      expect(profile.status).toBe("active");
      expect((profile.preferences as any)?.theme).toBe("light");
    });

    it("should throw on missing displayName", () => {
      expect(() => createUserProfile({} as any)).toThrow(
        "displayName is required"
      );
    });

    it("should override defaults with provided values", () => {
      const profile = createUserProfile(
        { displayName: "Alice", status: "inactive" },
        { status: "active" }
      );

      expect(profile.status).toBe("inactive");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Edge Cases
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Edge Cases", () => {
    it("should handle Unicode in displayName", () => {
      const profile: StandardUserProfile = {
        displayName: "日本語名前",
      };

      const result = validateUserProfile(profile);
      expect(result.valid).toBe(true);
    });

    it("should handle emoji in displayName", () => {
      const profile: StandardUserProfile = {
        displayName: "John 🚀 Doe",
      };

      const result = validateUserProfile(profile);
      expect(result.valid).toBe(true);
    });

    it("should handle null values in custom fields", () => {
      const profile: StandardUserProfile = {
        displayName: "John",
        customField: null,
      };

      // null values should be acceptable
      const result = validateUserProfile(profile);
      expect(result.valid).toBe(true);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Real-World Scenarios
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Real-World Scenarios", () => {
    it("should handle typical SaaS user profile", () => {
      const profile: StandardUserProfile = {
        displayName: "Jane Smith",
        email: "jane@company.com",
        avatarUrl: "https://gravatar.com/avatar/abc123",
        preferences: {
          theme: "system",
          language: "en-US",
          timezone: "America/New_York",
          notifications: {
            email: true,
            inApp: true,
            marketing: false,
          },
        },
        platformMetadata: {
          plan: "professional",
          teamId: "team_abc",
          role: "admin",
          seats: 10,
          features: ["analytics", "integrations", "api_access"],
        },
        // Custom fields
        department: "Engineering",
        employeeId: "EMP-12345",
      };

      const result = validateUserProfile(profile, validationPresets.strict);
      expect(result.valid).toBe(true);
    });

    it("should handle chatbot platform user", () => {
      const profile: StandardUserProfile = {
        displayName: "ChatUser_42",
        preferences: {
          botPersonality: "friendly",
          responseLength: "concise",
          topics: ["tech", "sports"],
        },
        platformMetadata: {
          messageCount: 1500,
          firstSeen: "2024-01-01T00:00:00Z",
          lastActive: "2024-12-27T12:00:00Z",
        },
      };

      const result = validateUserProfile(profile);
      expect(result.valid).toBe(true);
    });

    it("should handle minimal guest user", () => {
      const profile: StandardUserProfile = {
        displayName: "Guest User",
      };

      const result = validateUserProfile(profile, validationPresets.minimal);
      expect(result.valid).toBe(true);
    });
  });
});
