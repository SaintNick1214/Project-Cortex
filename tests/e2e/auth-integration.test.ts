/**
 * E2E Tests: Auth Integration
 *
 * End-to-end tests simulating real-world authentication scenarios:
 * - OAuth flow simulation (Clerk, Auth0, Firebase, NextAuth)
 * - API key authentication
 * - JWT token handling
 * - Session-based authentication
 */

import { Cortex } from "../../src";
import { createAuthContext } from "../../src/auth/context";
import { createTestRunContext } from "../helpers/isolation";
import {
  generateTenantId,
  generateTenantUserId,
} from "../helpers/tenancy";

// Test context for isolation
const ctx = createTestRunContext();

// Skip tests if no Convex URL configured
const describeWithConvex = process.env.CONVEX_URL ? describe : describe.skip;

describeWithConvex("Auth Integration E2E", () => {
  let testMemorySpaceId: string;

  beforeAll(async () => {
    testMemorySpaceId = `space_auth_e2e_${ctx.runId}`;

    // Create a temp Cortex to register memory space
    const tempCortex = new Cortex({
      convexUrl: process.env.CONVEX_URL!,
    });

    await tempCortex.memorySpaces.register({
      memorySpaceId: testMemorySpaceId,
      name: "Auth E2E Test Space",
      type: "custom",
    });
  });

  afterAll(async () => {
    try {
      const tempCortex = new Cortex({
        convexUrl: process.env.CONVEX_URL!,
      });
      await tempCortex.memorySpaces.delete(testMemorySpaceId, { cascade: true, reason: "Test cleanup" });
    } catch {
      // Ignore cleanup errors
    }
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Scenario 1: Clerk OAuth Integration
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Scenario 1: Clerk OAuth Integration", () => {
    it("should initialize Cortex with Clerk-style auth context", async () => {
      // Simulate Clerk session data
      const clerkAuthContext = createAuthContext({
        userId: "user_2abc123xyz789",
        organizationId: "org_def456uvw",
        sessionId: "sess_ghi789rst",
        tenantId: "tenant_clerk_demo",
        authProvider: "clerk",
        authMethod: "oauth",
        authenticatedAt: Date.now(),
        claims: {
          azp: "https://myapp.example.com",
          sub: "user_2abc123xyz789",
          org_id: "org_def456uvw",
          org_role: "admin",
          org_slug: "my-organization",
          email: "user@example.com",
          email_verified: true,
          first_name: "John",
          last_name: "Doe",
        },
        metadata: {
          sessionClaims: {
            primaryEmail: "user@example.com",
            publicMetadata: { role: "admin" },
          },
        },
      });

      const cortex = new Cortex({
        convexUrl: process.env.CONVEX_URL!,
        auth: clerkAuthContext,
      });

      // Verify auth context is properly set
      expect(cortex.auth?.userId).toBe("user_2abc123xyz789");
      expect(cortex.auth?.organizationId).toBe("org_def456uvw");
      expect(cortex.auth?.authProvider).toBe("clerk");

      // Create a conversation with this auth
      const conv = await cortex.conversations.create({
        memorySpaceId: testMemorySpaceId,
        type: "user-agent",
        participants: { userId: clerkAuthContext.userId, agentId: "test-agent" },
      });

      expect(conv.tenantId).toBe("tenant_clerk_demo");

      // Cleanup
      await cortex.conversations.delete(conv.conversationId);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Scenario 2: Auth0 JWT Integration
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Scenario 2: Auth0 JWT Integration", () => {
    it("should initialize Cortex with Auth0-style auth context", async () => {
      // Simulate Auth0 decoded JWT
      const auth0AuthContext = createAuthContext({
        userId: "auth0|507f1f77bcf86cd799439011",
        tenantId: "my-auth0-tenant",
        authProvider: "auth0",
        authMethod: "jwt",
        authenticatedAt: Date.now(),
        claims: {
          iss: "https://my-tenant.auth0.com/",
          sub: "auth0|507f1f77bcf86cd799439011",
          aud: [
            "https://api.myapp.com",
            "https://my-tenant.auth0.com/userinfo",
          ],
          iat: Math.floor(Date.now() / 1000) - 3600,
          exp: Math.floor(Date.now() / 1000) + 3600,
          azp: "my-client-id",
          scope: "openid profile email",
          permissions: ["read:data", "write:data"],
        },
        metadata: {
          app_metadata: {
            plan: "enterprise",
            features: ["advanced-analytics", "custom-integrations"],
          },
          user_metadata: {
            preferences: { theme: "dark" },
          },
        },
      });

      const cortex = new Cortex({
        convexUrl: process.env.CONVEX_URL!,
        auth: auth0AuthContext,
      });

      // Verify auth context
      expect(cortex.auth?.userId).toBe("auth0|507f1f77bcf86cd799439011");
      expect(cortex.auth?.authProvider).toBe("auth0");
      expect((cortex.auth?.claims?.permissions as string[])?.length).toBe(2);

      // Create a fact with this auth
      const fact = await cortex.facts.store({
        memorySpaceId: testMemorySpaceId,
        fact: "User authenticated via Auth0",
        factType: "knowledge",
        confidence: 85,
        sourceType: "manual",
        userId: auth0AuthContext.userId,
      });

      expect(fact.tenantId).toBe("my-auth0-tenant");

      // Cleanup
      await cortex.facts.delete(testMemorySpaceId, fact.factId);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Scenario 3: Firebase Auth Integration
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Scenario 3: Firebase Auth Integration", () => {
    it("should initialize Cortex with Firebase-style auth context", async () => {
      // Simulate Firebase decoded token
      const firebaseAuthContext = createAuthContext({
        userId: "firebase:abc123xyz789",
        tenantId: "my-firebase-project",
        authProvider: "firebase",
        authMethod: "jwt",
        authenticatedAt: Date.now(),
        claims: {
          uid: "abc123xyz789",
          email: "user@example.com",
          email_verified: true,
          name: "Jane Smith",
          picture: "https://example.com/avatar.jpg",
          firebase: {
            sign_in_provider: "google.com",
            tenant: "my-firebase-project",
            identities: {
              "google.com": ["123456789"],
              email: ["user@example.com"],
            },
          },
        },
        metadata: {
          customClaims: {
            admin: false,
            premium: true,
          },
        },
      });

      const cortex = new Cortex({
        convexUrl: process.env.CONVEX_URL!,
        auth: firebaseAuthContext,
      });

      // Verify auth context
      expect(cortex.auth?.userId).toBe("firebase:abc123xyz789");
      expect(cortex.auth?.authProvider).toBe("firebase");
      expect(cortex.auth?.claims?.email).toBe("user@example.com");

      // Create session
      const session = await cortex.sessions.create({
        userId: firebaseAuthContext.userId,
        tenantId: "my-firebase-project",
        metadata: {
          provider: "google.com",
        },
      });

      expect(session.tenantId).toBe("my-firebase-project");

      // Cleanup
      await cortex.sessions.end(session.sessionId);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Scenario 4: NextAuth Session Integration
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Scenario 4: NextAuth Session Integration", () => {
    it("should initialize Cortex with NextAuth-style auth context", async () => {
      // Simulate NextAuth session
      const nextauthAuthContext = createAuthContext({
        userId: "cluser123abc456",
        sessionId: "sess_nextauth_xyz789",
        tenantId: "nextauth-demo-app",
        authProvider: "nextauth",
        authMethod: "session",
        authenticatedAt: Date.now(),
        claims: {
          name: "Bob Wilson",
          email: "bob@example.com",
          picture: "https://example.com/bob.jpg",
        },
        metadata: {
          provider: "github",
          providerAccountId: "12345678",
          accessToken: "gho_xxxx", // In real scenario, handle carefully
          accessTokenExpires: Date.now() + 3600000,
        },
      });

      const cortex = new Cortex({
        convexUrl: process.env.CONVEX_URL!,
        auth: nextauthAuthContext,
      });

      // Verify auth context
      expect(cortex.auth?.userId).toBe("cluser123abc456");
      expect(cortex.auth?.authProvider).toBe("nextauth");
      expect(cortex.auth?.authMethod).toBe("session");

      // Store user profile
      await cortex.users.update(nextauthAuthContext.userId, {
        displayName: "Bob Wilson",
        email: "bob@example.com",
        avatarUrl: "https://example.com/bob.jpg",
        platformMetadata: {
          githubId: "12345678",
        },
      });

      // Verify profile
      const profile = await cortex.users.get(nextauthAuthContext.userId);
      expect(profile?.data?.displayName).toBe("Bob Wilson");

      // Cleanup
      await cortex.users.delete(nextauthAuthContext.userId, {
        cascade: false,
      });
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Scenario 5: API Key Authentication
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Scenario 5: API Key Authentication", () => {
    it("should initialize Cortex with API key auth context", async () => {
      // Simulate API key authentication
      const apiKeyAuthContext = createAuthContext({
        userId: "api_service_account",
        tenantId: "enterprise_tenant",
        authMethod: "api_key",
        authenticatedAt: Date.now(),
        claims: {
          keyId: "key_live_abc123",
          scope: ["read", "write", "admin"],
        },
        metadata: {
          keyPrefix: "sk_live_",
          environment: "production",
          rateLimit: {
            requests: 10000,
            window: 3600,
          },
        },
      });

      const cortex = new Cortex({
        convexUrl: process.env.CONVEX_URL!,
        auth: apiKeyAuthContext,
      });

      // Verify auth context
      expect(cortex.auth?.userId).toBe("api_service_account");
      expect(cortex.auth?.authMethod).toBe("api_key");
      expect((cortex.auth?.claims?.scope as string[])?.length).toBe(3);

      // Perform operations
      const conv = await cortex.conversations.create({
        memorySpaceId: testMemorySpaceId,
        type: "user-agent",
        participants: { userId: apiKeyAuthContext.userId, agentId: "test-agent" },
      });

      expect(conv.tenantId).toBe("enterprise_tenant");

      // Cleanup
      await cortex.conversations.delete(conv.conversationId);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Scenario 6: Custom Auth Provider
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Scenario 6: Custom Auth Provider", () => {
    it("should work with custom auth provider", async () => {
      // Custom enterprise SSO
      const customAuthContext = createAuthContext({
        userId: "emp_12345@acmecorp",
        tenantId: "acme_enterprise",
        organizationId: "acme_engineering",
        authProvider: "acme-sso",
        authMethod: "oauth",
        authenticatedAt: Date.now(),
        claims: {
          employeeId: "12345",
          department: "engineering",
          team: "platform",
          manager: "emp_67890@acmecorp",
          roles: ["developer", "team_lead"],
          clearanceLevel: "confidential",
        },
        metadata: {
          ldapDn: "CN=John Doe,OU=Engineering,DC=acme,DC=corp",
          groups: ["platform-team", "all-engineering"],
          vpnConnected: true,
          deviceId: "ACME-LAPTOP-1234",
        },
      });

      const cortex = new Cortex({
        convexUrl: process.env.CONVEX_URL!,
        auth: customAuthContext,
      });

      // Verify auth context
      expect(cortex.auth?.userId).toBe("emp_12345@acmecorp");
      expect(cortex.auth?.authProvider).toBe("acme-sso");
      expect(cortex.auth?.claims?.department).toBe("engineering");

      // Create organizational data
      const fact = await cortex.facts.store({
        memorySpaceId: testMemorySpaceId,
        fact: "Platform team uses microservices architecture",
        factType: "knowledge",
        confidence: 85,
        sourceType: "manual",
        userId: customAuthContext.userId,
        metadata: {
          department: "engineering",
          team: "platform",
        },
      });

      expect(fact.tenantId).toBe("acme_enterprise");

      // Cleanup
      await cortex.facts.delete(testMemorySpaceId, fact.factId);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Scenario 7: Auth Context Refresh
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Scenario 7: Auth Context Refresh", () => {
    it("should work with refreshed auth context", async () => {
      const tenantId = generateTenantId("refresh-test");
      const userId = generateTenantUserId(tenantId);

      // Initial auth context
      const initialAuth = createAuthContext({
        userId,
        tenantId,
        sessionId: "sess_initial",
        authProvider: "test",
        authMethod: "jwt",
        authenticatedAt: Date.now() - 3600000, // 1 hour ago
      });

      const cortex1 = new Cortex({
        convexUrl: process.env.CONVEX_URL!,
        auth: initialAuth,
      });

      // Create initial data
      const conv = await cortex1.conversations.create({
        memorySpaceId: testMemorySpaceId,
        type: "user-agent",
        participants: { userId },
      });

      // Simulate token refresh - new auth context
      const refreshedAuth = createAuthContext({
        userId, // Same user
        tenantId, // Same tenant
        sessionId: "sess_refreshed",
        authProvider: "test",
        authMethod: "jwt",
        authenticatedAt: Date.now(), // Fresh token
      });

      const cortex2 = new Cortex({
        convexUrl: process.env.CONVEX_URL!,
        auth: refreshedAuth,
      });

      // Should be able to access same data
      const retrieved = await cortex2.conversations.get(conv.conversationId);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.conversationId).toBe(conv.conversationId);

      // Cleanup
      await cortex2.conversations.delete(conv.conversationId);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Scenario 8: Minimal Auth (Just userId)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Scenario 8: Minimal Auth (Just userId)", () => {
    it("should work with minimal auth context", async () => {
      // Simplest possible auth context
      const minimalAuth = createAuthContext({
        userId: "simple_user_123",
      });

      const cortex = new Cortex({
        convexUrl: process.env.CONVEX_URL!,
        auth: minimalAuth,
      });

      // Should still work
      expect(cortex.auth?.userId).toBe("simple_user_123");
      expect(cortex.auth?.tenantId).toBeUndefined();

      // Create data without tenant scoping
      const conv = await cortex.conversations.create({
        memorySpaceId: testMemorySpaceId,
        type: "user-agent",
        participants: { userId: minimalAuth.userId, agentId: "test-agent" },
      });

      expect(conv.conversationId).toBeDefined();

      // Cleanup
      await cortex.conversations.delete(conv.conversationId);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Scenario 9: Full Auth with All Fields
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Scenario 9: Full Auth with All Fields", () => {
    it("should handle comprehensive auth context", async () => {
      const fullAuth = createAuthContext({
        userId: "full_user_xyz",
        tenantId: "full_tenant",
        organizationId: "full_org",
        sessionId: "full_session",
        authProvider: "comprehensive",
        authMethod: "oauth",
        authenticatedAt: Date.now(),
        claims: {
          // Standard JWT claims
          iss: "https://auth.example.com",
          sub: "full_user_xyz",
          aud: "api.example.com",
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
          nbf: Math.floor(Date.now() / 1000),

          // Custom claims
          email: "full@example.com",
          roles: ["admin", "user", "developer"],
          permissions: ["read", "write", "delete", "admin"],
          features: ["feature_a", "feature_b"],
          limits: {
            maxMessages: 10000,
            maxStorage: "10GB",
          },
        },
        metadata: {
          // Device info
          device: {
            type: "desktop",
            os: "macOS",
            browser: "Chrome",
          },
          // Location
          location: {
            ip: "192.168.1.1",
            country: "US",
            region: "CA",
          },
          // App-specific
          appVersion: "2.0.0",
          featureFlags: ["new_ui", "beta"],
        },
      });

      const cortex = new Cortex({
        convexUrl: process.env.CONVEX_URL!,
        auth: fullAuth,
      });

      // Verify all fields
      expect(cortex.auth?.userId).toBe("full_user_xyz");
      expect(cortex.auth?.tenantId).toBe("full_tenant");
      expect(cortex.auth?.organizationId).toBe("full_org");
      expect(cortex.auth?.sessionId).toBe("full_session");
      expect(cortex.auth?.authProvider).toBe("comprehensive");
      expect(cortex.auth?.authMethod).toBe("oauth");
      expect((cortex.auth?.claims?.roles as string[])?.length).toBe(3);
      expect((cortex.auth?.metadata?.device as { type: string })?.type).toBe(
        "desktop"
      );

      // Create data with full context
      const fact = await cortex.facts.store({
        memorySpaceId: testMemorySpaceId,
        fact: "Full auth test fact",
        factType: "knowledge",
        confidence: 85,
        sourceType: "manual",
        userId: fullAuth.userId,
      });

      expect(fact.tenantId).toBe("full_tenant");

      // Cleanup
      await cortex.facts.delete(testMemorySpaceId, fact.factId);
    });
  });
});
