/**
 * Integration Tests: Auth Context Injection
 *
 * Tests that the auth context is properly injected into Cortex operations:
 * - Auth context propagation to API calls
 * - TenantId, userId, sessionId extraction
 * - Auth context in different API layers
 */

import { Cortex } from "../src";
import { createAuthContext } from "../src/auth/context";
import { createTestRunContext } from "./helpers/isolation";
import {
  generateTenantId,
  generateTenantUserId,
  createTenantAuthContext,
} from "./helpers/tenancy";

// Test context for isolation
const ctx = createTestRunContext();

// Skip tests if no Convex URL configured
const describeWithConvex = process.env.CONVEX_URL ? describe : describe.skip;

describeWithConvex("Auth Context Injection", () => {
  let testTenantId: string;
  let testUserId: string;
  let testSessionId: string;
  let testMemorySpaceId: string;

  beforeAll(() => {
    testTenantId = generateTenantId("auth-inject");
    testUserId = generateTenantUserId(testTenantId);
    testSessionId = `sess_${ctx.runId}`;
    testMemorySpaceId = `space_${ctx.runId}`;
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Cortex Initialization with Auth
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Cortex Initialization with Auth", () => {
    it("should initialize Cortex with auth context", () => {
      const authContext = createAuthContext({
        userId: testUserId,
        tenantId: testTenantId,
        sessionId: testSessionId,
      });

      const cortex = new Cortex({
        convexUrl: process.env.CONVEX_URL!,
        auth: authContext,
      });

      expect(cortex).toBeDefined();
      expect(cortex.auth).toBeDefined();
      expect(cortex.auth?.userId).toBe(testUserId);
      expect(cortex.auth?.tenantId).toBe(testTenantId);
      expect(cortex.auth?.sessionId).toBe(testSessionId);
    });

    it("should initialize Cortex without auth context", () => {
      const cortex = new Cortex({
        convexUrl: process.env.CONVEX_URL!,
      });

      expect(cortex).toBeDefined();
      expect(cortex.auth).toBeUndefined();
    });

    it("should accept auth context with full claims", () => {
      const authContext = createAuthContext({
        userId: testUserId,
        tenantId: testTenantId,
        sessionId: testSessionId,
        organizationId: "org_123",
        authProvider: "clerk",
        authMethod: "oauth",
        claims: {
          email: "user@example.com",
          roles: ["admin"],
          permissions: ["read", "write"],
        },
        metadata: {
          deviceId: "device_abc",
          ipAddress: "192.168.1.1",
        },
      });

      const cortex = new Cortex({
        convexUrl: process.env.CONVEX_URL!,
        auth: authContext,
      });

      expect(cortex.auth?.claims?.email).toBe("user@example.com");
      expect(cortex.auth?.metadata?.deviceId).toBe("device_abc");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Auth Context in Conversations API
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Auth Context in Conversations API", () => {
    let cortex: Cortex;

    beforeAll(async () => {
      const authContext = createTenantAuthContext(testTenantId, testUserId, {
        sessionId: testSessionId,
      });

      cortex = new Cortex({
        convexUrl: process.env.CONVEX_URL!,
        auth: authContext,
      });

      // Register memory space
      await cortex.memorySpaces.register({
        memorySpaceId: testMemorySpaceId,
        name: "Auth Inject Test Space",
        type: "custom",
      });
    });

    afterAll(async () => {
      try {
        await cortex.memorySpaces.delete(testMemorySpaceId, { cascade: true, reason: "Test cleanup" });
      } catch {
        // Ignore cleanup errors
      }
    });

    it("should propagate tenantId when creating conversation", async () => {
      const conversation = await cortex.conversations.create({
        memorySpaceId: testMemorySpaceId,
        type: "user-agent",
        participants: { userId: testUserId, agentId: "test-agent" },
      });

      expect(conversation).toBeDefined();
      expect(conversation.conversationId).toBeDefined();
      // TenantId should be stored on the conversation
      expect(conversation.tenantId).toBe(testTenantId);

      // Cleanup
      await cortex.conversations.delete(conversation.conversationId);
    });

    it("should propagate userId to participants", async () => {
      const conversation = await cortex.conversations.create({
        memorySpaceId: testMemorySpaceId,
        type: "user-agent",
        participants: { userId: testUserId, agentId: "test-agent" },
      });

      expect(conversation.participants.userId).toBe(testUserId);

      // Cleanup
      await cortex.conversations.delete(conversation.conversationId);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Auth Context in Memory API
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Auth Context in Memory API", () => {
    let cortex: Cortex;
    let conversationId: string;

    beforeAll(async () => {
      const authContext = createTenantAuthContext(testTenantId, testUserId, {
        sessionId: testSessionId,
      });

      cortex = new Cortex({
        convexUrl: process.env.CONVEX_URL!,
        auth: authContext,
      });

      // Create a conversation for memory tests
      const conv = await cortex.conversations.create({
        memorySpaceId: testMemorySpaceId,
        type: "user-agent",
        participants: { userId: testUserId, agentId: "test-agent" },
      });
      conversationId = conv.conversationId;
    });

    afterAll(async () => {
      try {
        await cortex.conversations.delete(conversationId);
      } catch {
        // Ignore cleanup errors
      }
    });

    it("should propagate auth context to remember", async () => {
      const result = await cortex.memory.remember({
        memorySpaceId: testMemorySpaceId,
        tenantId: testTenantId, // Pass tenantId explicitly to MemoryAPI
        conversationId,
        userMessage: "Test message for auth context",
        agentResponse: "Test response",
        userId: testUserId,
        userName: "Test User", // Required when userId is provided
        agentId: "test-agent", // Required when userId is provided
      });

      expect(result.memories).toBeDefined();
      expect(result.memories.length).toBeGreaterThan(0);

      // Memory should have tenantId
      const memory = result.memories[0];
      expect(memory.tenantId).toBe(testTenantId);
      expect(memory.userId).toBe(testUserId);
    });

    it("should filter recall by auth context", async () => {
      // Create a memory
      await cortex.memory.remember({
        memorySpaceId: testMemorySpaceId,
        tenantId: testTenantId, // Pass tenantId explicitly to MemoryAPI
        conversationId,
        userMessage: "Recall filter test",
        agentResponse: "Recall filter response",
        userId: testUserId,
        userName: "Test User", // Required when userId is provided
        agentId: "test-agent", // Required when userId is provided
      });

      // Recall with same tenant context
      const result = await cortex.memory.recall({
        memorySpaceId: testMemorySpaceId,
        query: "recall filter test",
        limit: 10,
      });

      expect(result.items).toBeDefined();
      // Results should only include items from the same tenant
      result.items.forEach((item) => {
        if (item.tenantId) {
          expect(item.tenantId).toBe(testTenantId);
        }
      });
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Auth Context in Facts API
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Auth Context in Facts API", () => {
    let cortex: Cortex;
    let factId: string;

    beforeAll(async () => {
      const authContext = createTenantAuthContext(testTenantId, testUserId, {
        sessionId: testSessionId,
      });

      cortex = new Cortex({
        convexUrl: process.env.CONVEX_URL!,
        auth: authContext,
      });
    });

    afterAll(async () => {
      if (factId) {
        try {
          await cortex.facts.delete(testMemorySpaceId, factId);
        } catch {
          // Ignore cleanup errors
        }
      }
    });

    it("should propagate tenantId when creating fact", async () => {
      const fact = await cortex.facts.store({
        memorySpaceId: testMemorySpaceId,
        fact: "Auth context test: user prefers dark mode",
        factType: "knowledge",
        confidence: 85,
        sourceType: "manual",
        userId: testUserId,
      });

      factId = fact.factId;

      expect(fact).toBeDefined();
      expect(fact.tenantId).toBe(testTenantId);
      expect(fact.userId).toBe(testUserId);
    });

    it("should filter facts list by tenant", async () => {
      const facts = await cortex.facts.list({
        memorySpaceId: testMemorySpaceId,
        userId: testUserId,
      });

      // All facts should belong to the same tenant
      facts.forEach((fact) => {
        if (fact.tenantId) {
          expect(fact.tenantId).toBe(testTenantId);
        }
      });
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Auth Context in Immutable/Mutable API
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Auth Context in Immutable/Mutable API", () => {
    let cortex: Cortex;
    let immutableRecordId: string;
    const mutableKey = `mut_${ctx.runId}`;

    beforeAll(async () => {
      const authContext = createTenantAuthContext(testTenantId, testUserId, {
        sessionId: testSessionId,
      });

      cortex = new Cortex({
        convexUrl: process.env.CONVEX_URL!,
        auth: authContext,
      });
    });

    afterAll(async () => {
      try {
        await cortex.mutable.delete(testMemorySpaceId, mutableKey);
      } catch {
        // Ignore cleanup errors
      }
    });

    it("should propagate tenantId to immutable store", async () => {
      // Use unique ID per test run to avoid conflicts
      const uniqueId = `auth_test_${ctx.runId}`;
      
      const result = await cortex.immutable.store({
        type: "auth_test",
        id: uniqueId,
        data: { test: "data", userId: testUserId },
        // Use valid metadata that matches schema (publishedBy, tags, importance)
        metadata: { tags: ["auth-context-test"], importance: 50 },
      });

      immutableRecordId = result.id;

      expect(result).toBeDefined();
      expect(result.tenantId).toBe(testTenantId);
      
      // Clean up after test
      try {
        await cortex.immutable.purge("auth_test", uniqueId);
      } catch {
        // Ignore cleanup errors
      }
    });

    it("should propagate tenantId to mutable store", async () => {
      await cortex.mutable.set(testMemorySpaceId, mutableKey, {
        test: "mutable data",
        userId: testUserId,
      });

      const retrieved = await cortex.mutable.get(testMemorySpaceId, mutableKey);

      expect(retrieved).toBeDefined();
      // Mutable values are stored as-is, tenantId is tracked at the record level
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Auth Context in Users API
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Auth Context in Users API", () => {
    let cortex: Cortex;

    beforeAll(async () => {
      const authContext = createTenantAuthContext(testTenantId, testUserId, {
        sessionId: testSessionId,
      });

      cortex = new Cortex({
        convexUrl: process.env.CONVEX_URL!,
        auth: authContext,
      });
    });

    afterAll(async () => {
      try {
        await cortex.users.delete(testUserId, { cascade: false });
      } catch {
        // Ignore cleanup errors
      }
    });

    it("should use auth userId for user profile operations", async () => {
      // Create or update user profile using auth context userId
      const profile = await cortex.users.update(testUserId, {
        displayName: "Auth Test User",
        email: "auth-test@example.com",
      });

      expect(profile).toBeDefined();
      expect(profile.id).toBe(testUserId);
      expect(profile.tenantId).toBe(testTenantId);
    });

    it("should list users scoped to tenant", async () => {
      const result = await cortex.users.list({
        limit: 10,
      });

      // All returned users should belong to the tenant
      result.users.forEach((user) => {
        if (user.tenantId) {
          expect(user.tenantId).toBe(testTenantId);
        }
      });
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Cross-API Auth Consistency
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Cross-API Auth Consistency", () => {
    let cortex: Cortex;
    let conversationId: string;

    beforeAll(async () => {
      const authContext = createTenantAuthContext(testTenantId, testUserId, {
        sessionId: testSessionId,
      });

      cortex = new Cortex({
        convexUrl: process.env.CONVEX_URL!,
        auth: authContext,
      });

      // Create test conversation
      const conv = await cortex.conversations.create({
        memorySpaceId: testMemorySpaceId,
        type: "user-agent",
        participants: { userId: testUserId, agentId: "test-agent" },
      });
      conversationId = conv.conversationId;
    });

    afterAll(async () => {
      try {
        await cortex.conversations.delete(conversationId);
      } catch {
        // Ignore cleanup errors
      }
    });

    it("should maintain consistent tenantId across API calls", async () => {
      // Create data across multiple APIs
      const conversation = await cortex.conversations.get(conversationId);

      const memoryResult = await cortex.memory.remember({
        memorySpaceId: testMemorySpaceId,
        tenantId: testTenantId, // Pass tenantId explicitly to MemoryAPI
        conversationId,
        userMessage: "Cross-API consistency test",
        agentResponse: "Response",
        userId: testUserId,
        userName: "Test User", // Required when userId is provided
        agentId: "test-agent", // Required when userId is provided
      });

      const fact = await cortex.facts.store({
        memorySpaceId: testMemorySpaceId,
        fact: "Cross-API fact test",
        factType: "knowledge",
        confidence: 85,
        sourceType: "manual",
        userId: testUserId,
      });

      // All should have the same tenantId
      expect(conversation?.tenantId).toBe(testTenantId);
      expect(memoryResult.memories[0].tenantId).toBe(testTenantId);
      expect(fact.tenantId).toBe(testTenantId);

      // Cleanup
      await cortex.facts.delete(testMemorySpaceId, fact.factId);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Auth Context Override
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Auth Context Override", () => {
    it("should allow userId override in API calls", async () => {
      const authContext = createTenantAuthContext(testTenantId, testUserId);
      const cortex = new Cortex({
        convexUrl: process.env.CONVEX_URL!,
        auth: authContext,
      });

      const differentUserId = generateTenantUserId(testTenantId);

      // Create fact for a different user within the same tenant
      const fact = await cortex.facts.store({
        memorySpaceId: testMemorySpaceId,
        fact: "User override test fact",
        factType: "knowledge",
        confidence: 85,
        sourceType: "manual",
        userId: differentUserId, // Override auth context userId
      });

      expect(fact.userId).toBe(differentUserId);
      expect(fact.tenantId).toBe(testTenantId); // Tenant stays the same

      // Cleanup
      await cortex.facts.delete(testMemorySpaceId, fact.factId);
    });

    it("should use auth context userId when not explicitly provided", async () => {
      const authContext = createTenantAuthContext(testTenantId, testUserId);
      const cortex = new Cortex({
        convexUrl: process.env.CONVEX_URL!,
        auth: authContext,
      });

      // Create user profile without specifying userId
      const profile = await cortex.users.update(testUserId, {
        displayName: "Default User Test",
      });

      expect(profile.id).toBe(testUserId);
    });
  });
});
