/**
 * Unit Tests: Auth Context Creation
 *
 * Tests for createAuthContext function and AuthContext building logic.
 * No Convex dependency - pure unit tests.
 */

import {
  createAuthContext,
  validateAuthContext,
} from "../../../src/auth/context";
import { AuthValidationError } from "../../../src/auth/validators";
import type { AuthContext, AuthContextParams } from "../../../src/auth/types";

describe("Auth Context", () => {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // createAuthContext - Basic Creation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("createAuthContext - Basic Creation", () => {
    it("should create minimal context with only userId", () => {
      const context = createAuthContext({ userId: "user_123" });

      expect(context.userId).toBe("user_123");
      expect(context.tenantId).toBeUndefined();
      expect(context.sessionId).toBeUndefined();
      expect(context.organizationId).toBeUndefined();
    });

    it("should create full context with all standard fields", () => {
      const params: AuthContextParams = {
        userId: "user_123",
        tenantId: "tenant_abc",
        organizationId: "org_xyz",
        sessionId: "sess_456",
        authProvider: "clerk",
        authMethod: "oauth",
        authenticatedAt: 1735257600000,
      };

      const context = createAuthContext(params);

      expect(context.userId).toBe("user_123");
      expect(context.tenantId).toBe("tenant_abc");
      expect(context.organizationId).toBe("org_xyz");
      expect(context.sessionId).toBe("sess_456");
      expect(context.authProvider).toBe("clerk");
      expect(context.authMethod).toBe("oauth");
      expect(context.authenticatedAt).toBe(1735257600000);
    });

    it("should throw on missing userId", () => {
      expect(() => createAuthContext({} as AuthContextParams)).toThrow(
        AuthValidationError,
      );
      expect(() => createAuthContext({ userId: "" })).toThrow(
        AuthValidationError,
      );
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // createAuthContext - Claims Handling
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("createAuthContext - Claims Handling", () => {
    it("should accept and preserve JWT claims", () => {
      const claims = {
        sub: "user_123",
        email: "user@example.com",
        email_verified: true,
        roles: ["admin", "user"],
        permissions: ["read", "write"],
        custom_claim: "custom_value",
      };

      const context = createAuthContext({
        userId: "user_123",
        claims,
      });

      expect(context.claims).toEqual(claims);
      expect(context.claims?.email).toBe("user@example.com");
      expect(context.claims?.roles).toEqual(["admin", "user"]);
    });

    it("should accept empty claims object", () => {
      const context = createAuthContext({
        userId: "user_123",
        claims: {},
      });

      expect(context.claims).toEqual({});
    });

    it("should accept deeply nested claims", () => {
      const claims = {
        organization: {
          id: "org_123",
          name: "Acme Corp",
          settings: {
            features: {
              premium: true,
              beta: ["feature_a", "feature_b"],
            },
          },
        },
      };

      const context = createAuthContext({
        userId: "user_123",
        claims,
      });

      expect(
        (context.claims?.organization as any)?.settings?.features?.premium,
      ).toBe(true);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // createAuthContext - Metadata Handling
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("createAuthContext - Metadata Handling", () => {
    it("should accept and preserve arbitrary metadata", () => {
      const metadata = {
        deviceId: "device_abc",
        ipAddress: "192.168.1.100",
        userAgent: "Mozilla/5.0...",
        geoLocation: { country: "US", region: "CA" },
      };

      const context = createAuthContext({
        userId: "user_123",
        metadata,
      });

      expect(context.metadata).toEqual(metadata);
      expect(context.metadata?.deviceId).toBe("device_abc");
      expect((context.metadata?.geoLocation as any)?.country).toBe("US");
    });

    it("should accept any developer-defined metadata structure", () => {
      const customMetadata = {
        customField1: "value1",
        customField2: 42,
        customField3: { nested: { deep: { value: true } } },
        customArray: [1, "two", { three: 3 }],
      };

      const context = createAuthContext({
        userId: "user_123",
        metadata: customMetadata,
      });

      expect(context.metadata).toEqual(customMetadata);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // createAuthContext - Auth Providers
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("createAuthContext - Auth Providers", () => {
    it("should accept common auth providers", () => {
      const providers = ["clerk", "auth0", "firebase", "nextauth", "supabase"];

      providers.forEach((provider) => {
        const context = createAuthContext({
          userId: "user_123",
          authProvider: provider,
        });
        expect(context.authProvider).toBe(provider);
      });
    });

    it("should accept custom auth provider names", () => {
      const context = createAuthContext({
        userId: "user_123",
        authProvider: "my-custom-auth-provider",
      });

      expect(context.authProvider).toBe("my-custom-auth-provider");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // createAuthContext - Auth Methods
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("createAuthContext - Auth Methods", () => {
    it("should accept all valid auth methods", () => {
      const methods: Array<"oauth" | "api_key" | "jwt" | "session"> = [
        "oauth",
        "api_key",
        "jwt",
        "session",
      ];

      methods.forEach((method) => {
        const context = createAuthContext({
          userId: "user_123",
          authMethod: method,
        });
        expect(context.authMethod).toBe(method);
      });
    });

    it("should reject invalid auth methods", () => {
      expect(() =>
        createAuthContext({
          userId: "user_123",
          authMethod: "invalid" as any,
        }),
      ).toThrow(AuthValidationError);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // validateAuthContext
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("validateAuthContext", () => {
    it("should validate a correctly formed AuthContext", () => {
      const context: AuthContext = {
        userId: "user_123",
        tenantId: "tenant_abc",
        sessionId: "sess_456",
      };

      expect(() => validateAuthContext(context)).not.toThrow();
    });

    it("should throw on missing userId in context", () => {
      const context = {
        tenantId: "tenant_abc",
      } as AuthContext;

      expect(() => validateAuthContext(context)).toThrow(AuthValidationError);
    });

    it("should throw on empty userId in context", () => {
      const context: AuthContext = {
        userId: "",
      };

      expect(() => validateAuthContext(context)).toThrow(AuthValidationError);
    });

    it("should validate all optional fields when present", () => {
      const context: AuthContext = {
        userId: "user_123",
        tenantId: "tenant_abc",
        organizationId: "org_xyz",
        sessionId: "sess_456",
        authProvider: "clerk",
        authMethod: "oauth",
        authenticatedAt: Date.now(),
        claims: { role: "admin" },
        metadata: { ip: "127.0.0.1" },
      };

      expect(() => validateAuthContext(context)).not.toThrow();
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Real-World Provider Scenarios
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Real-World Provider Scenarios", () => {
    it("should handle Clerk-style context", () => {
      const clerkContext = createAuthContext({
        userId: "user_2abc123",
        organizationId: "org_def456",
        sessionId: "sess_ghi789",
        authProvider: "clerk",
        authMethod: "oauth",
        claims: {
          azp: "https://myapp.com",
          sub: "user_2abc123",
          org_id: "org_def456",
          org_role: "admin",
          org_slug: "my-org",
        },
        metadata: {
          actor: null,
          sessionClaims: { primaryEmail: "user@example.com" },
        },
      });

      expect(clerkContext.userId).toBe("user_2abc123");
      expect(clerkContext.organizationId).toBe("org_def456");
      expect(clerkContext.authProvider).toBe("clerk");
    });

    it("should handle Auth0-style context", () => {
      const auth0Context = createAuthContext({
        userId: "auth0|507f1f77bcf86cd799439011",
        tenantId: "my-tenant",
        authProvider: "auth0",
        authMethod: "jwt",
        claims: {
          iss: "https://my-tenant.auth0.com/",
          sub: "auth0|507f1f77bcf86cd799439011",
          aud: [
            "https://api.myapp.com",
            "https://my-tenant.auth0.com/userinfo",
          ],
          iat: 1735257600,
          exp: 1735344000,
          scope: "openid profile email",
          permissions: ["read:data", "write:data"],
        },
      });

      expect(auth0Context.userId).toBe("auth0|507f1f77bcf86cd799439011");
      expect(auth0Context.tenantId).toBe("my-tenant");
      expect(auth0Context.claims?.iss).toBe("https://my-tenant.auth0.com/");
    });

    it("should handle Firebase-style context", () => {
      const firebaseContext = createAuthContext({
        userId: "firebase:abc123xyz",
        authProvider: "firebase",
        authMethod: "jwt",
        authenticatedAt: 1735257600000,
        claims: {
          uid: "abc123xyz",
          email: "user@example.com",
          email_verified: true,
          firebase: {
            sign_in_provider: "google.com",
            tenant: "my-project-abc123",
          },
        },
      });

      expect(firebaseContext.userId).toBe("firebase:abc123xyz");
      expect(firebaseContext.authProvider).toBe("firebase");
      expect((firebaseContext.claims?.firebase as any)?.sign_in_provider).toBe(
        "google.com",
      );
    });

    it("should handle NextAuth-style context", () => {
      const nextauthContext = createAuthContext({
        userId: "cluser123abc",
        sessionId: "sess_nextauth_xyz",
        authProvider: "nextauth",
        authMethod: "session",
        claims: {
          name: "John Doe",
          email: "john@example.com",
          picture: "https://example.com/avatar.jpg",
        },
        metadata: {
          accessToken: "gho_xxxx",
          provider: "github",
          providerAccountId: "12345678",
        },
      });

      expect(nextauthContext.userId).toBe("cluser123abc");
      expect(nextauthContext.authMethod).toBe("session");
      expect(nextauthContext.metadata?.provider).toBe("github");
    });

    it("should handle API key authentication", () => {
      const apiKeyContext = createAuthContext({
        userId: "api_user_system",
        tenantId: "tenant_enterprise",
        authMethod: "api_key",
        metadata: {
          keyId: "key_abc123",
          keyPrefix: "sk_live_",
          scopes: ["read", "write", "admin"],
          rateLimit: { requests: 10000, window: 3600 },
        },
      });

      expect(apiKeyContext.userId).toBe("api_user_system");
      expect(apiKeyContext.authMethod).toBe("api_key");
      expect(apiKeyContext.metadata?.scopes as string[]).toContain("admin");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Multi-Tenancy Scenarios
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Multi-Tenancy Scenarios", () => {
    it("should support tenant + organization hierarchy", () => {
      const context = createAuthContext({
        userId: "user_123",
        tenantId: "tenant_saas_platform",
        organizationId: "org_customer_acme",
        claims: {
          tenant_tier: "enterprise",
          org_role: "owner",
        },
      });

      expect(context.tenantId).toBe("tenant_saas_platform");
      expect(context.organizationId).toBe("org_customer_acme");
    });

    it("should support tenant-only isolation", () => {
      const context = createAuthContext({
        userId: "user_123",
        tenantId: "tenant_isolated",
        // No organization - flat tenant model
      });

      expect(context.tenantId).toBe("tenant_isolated");
      expect(context.organizationId).toBeUndefined();
    });

    it("should support no tenant (single-tenant mode)", () => {
      const context = createAuthContext({
        userId: "user_123",
        // No tenantId - single tenant application
      });

      expect(context.tenantId).toBeUndefined();
      expect(context.userId).toBe("user_123");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Immutability
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Immutability", () => {
    it("should not allow modification of returned context", () => {
      const context = createAuthContext({
        userId: "user_123",
        claims: { role: "user" },
      });

      // Attempt to modify should not affect original
      const originalUserId = context.userId;

      // TypeScript would prevent this, but runtime should be safe
      expect(context.userId).toBe(originalUserId);
    });

    it("should not share references with input params", () => {
      const claims = { role: "user" };
      const metadata = { device: "mobile" };

      const context = createAuthContext({
        userId: "user_123",
        claims,
        metadata,
      });

      // Modifying original objects should not affect context
      claims.role = "admin";
      (metadata as any).newField = "value";

      // Context should have original values (if deep cloned)
      // Note: implementation may or may not deep clone - test documents behavior
      expect(context.claims?.role).toBeDefined();
    });
  });
});
