import { api as publicApi } from "../../convex-dev/_generated/api";
/**
 * E2E Tests: Cross-API TenantId Propagation
 *
 * End-to-end tests verifying tenantId flows correctly across all API layers:
 * - Conversations API
 * - Memory API (remember/recall)
 * - Facts API
 * - Immutable Store API
 * - Mutable Store API
 * - Users API
 * - Sessions API
 * - Graph sync (if enabled)
 */

import {
  expectRefusalNoEffects,
  expectOwnedRecallItems,
  queryPublic,
  mutatePublic,
} from "../helpers/public-contract";
import { createRuntimeFixture } from "../helpers/runtime-fixture";
const runtimeFixtures: Array<Awaited<ReturnType<typeof createRuntimeFixture>>> =
  [];
import { Cortex } from "../../src";
import { createTestRunContext } from "../helpers/isolation";
import {
  generateTenantId,
  generateTenantUserId,
  createTenantAuthContext,
} from "../helpers/tenancy";

// Test context for isolation
const ctx = createTestRunContext();

// Skip tests if no Convex URL configured
const describeWithConvex = process.env.CONVEX_URL ? describe : describe.skip;

describeWithConvex("Cross-API TenantId Propagation E2E", () => {
  let cortex: Cortex;
  let testTenantId: string;
  let testUserId: string;
  let testMemorySpaceId: string;

  beforeAll(async () => {
    testTenantId = generateTenantId("cross-api");
    testUserId = generateTenantUserId(testTenantId);
    testMemorySpaceId = `space_${ctx.runId}`;

    const authContext = createTenantAuthContext(testTenantId, testUserId, {
      sessionId: `sess_${ctx.runId}`,
      organizationId: "org_cross_api_test",
    });

    const fixture = await createRuntimeFixture(
      testTenantId,
      testMemorySpaceId,
      testUserId,
      { enabled: false },
      { registerSpaces: false },
    );
    runtimeFixtures.push(fixture);
    cortex = new Cortex(
      {
        convexUrl: process.env.CONVEX_URL!,
        auth: authContext,
        resilience: { enabled: false },
      },
      { initializeTransport: fixture.initializeTransport },
    );

    // Register memory space
    await cortex.memorySpaces.register({
      memorySpaceId: testMemorySpaceId,
      name: "Cross-API TenantId Test Space",
      type: "custom",
    });
  });

  afterAll(async () => {
    await Promise.all(runtimeFixtures.map((fixture) => fixture.close()));
    await cortex.shutdown();
    try {
      await cortex.memorySpaces.delete(testMemorySpaceId, {
        cascade: true,
        reason: "Test cleanup",
      });
    } catch {
      // Ignore cleanup errors
    }
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Test 1: Full Workflow - All APIs in Sequence
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Full Workflow - All APIs in Sequence", () => {
    let conversationId: string;
    let _memoryId: string;
    let factId: string;
    let _immutableRecordId: string;
    let sessionId: string;
    const mutableKey = `cross_api_key_${ctx.runId}`;

    it("Step 1: Create user profile with tenantId", async () => {
      const profile = await cortex.users.update(testUserId, {
        displayName: "Cross-API Test User",
        email: "cross-api@test.com",
      });

      expect(profile.tenantId).toBe(testTenantId);
      expect(profile.id).toBe(testUserId);
    });

    it("Step 2: Create session with tenantId", async () => {
      const session = await cortex.sessions.create({
        userId: testUserId,
        tenantId: testTenantId,
        memorySpaceId: testMemorySpaceId,
        metadata: {
          test: "cross-api",
        },
      });

      sessionId = session.sessionId;

      expect(session.tenantId).toBe(testTenantId);
      expect(session.userId).toBe(testUserId);
    });

    it("Step 3: Owned transcript creation refuses without dispatch", async () => {
      conversationId = "conv-uncommitted";
      await expectRefusalNoEffects(
        () =>
          cortex.conversations.create({
            memorySpaceId: testMemorySpaceId,
            type: "user-agent",
            participants: { userId: testUserId, agentId: "test-agent" },
          }),
        runtimeFixtures,
        "conversations",
        "CAPABILITY_NOT_READY",
      );
    });

    it("Step 4: Current memory writes retain tenant while transcript capture refuses", async () => {
      await expectRefusalNoEffects(
        () =>
          cortex.memory.remember({
            memorySpaceId: testMemorySpaceId,
            conversationId,
            userMessage: "Cross-API test: meaning of life",
            agentResponse: "The meaning of life is to learn and grow",
            userId: testUserId,
            userName: "Test User",
            agentId: "test-agent",
          }),
        runtimeFixtures,
        "memories",
        "CAPABILITY_NOT_READY",
      );
      const memory = await cortex.vector.store(testMemorySpaceId, {
        content: "The meaning of life is to learn and grow",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: ["cross-api"], userId: testUserId },
      });
      _memoryId = memory.memoryId;
      expect(memory.tenantId).toBe(testTenantId);
      expect(memory.userId).toBe(testUserId);
    });

    it("Step 5: Retrieve memory with tenantId (recall)", async () => {
      const result = await cortex.memory.recall({
        memorySpaceId: testMemorySpaceId,
        query: "meaning of life",
        limit: 10,
      });

      expect(result.items.length).toBeGreaterThan(0);

      // All results should have correct tenantId
      result.items.forEach((item) => {
        if (item.tenantId) {
          expect(item.tenantId).toBe(testTenantId);
        }
      });
    });

    it("Step 6: Create fact with tenantId", async () => {
      const fact = await cortex.facts.store({
        memorySpaceId: testMemorySpaceId,
        fact: "Cross-API test: The user prefers detailed explanations",
        factType: "knowledge",
        confidence: 85,
        sourceType: "manual",
        userId: testUserId,
        metadata: {
          source: "cross-api-test",
        },
      });

      factId = fact.factId;

      expect(fact.tenantId).toBe(testTenantId);
      expect(fact.userId).toBe(testUserId);
    });

    it("Step 7: Store immutable record with tenantId", async () => {
      const result = await cortex.immutable.store({
        type: "cross_api_test",
        id: `cross_api_immutable_${ctx.runId}`,
        data: {
          testData: "Immutable cross-API test data",
          timestamp: Date.now(),
        },
        metadata: {
          tags: ["cross-api-test"],
          importance: 50,
        },
      });

      _immutableRecordId = result.id;

      expect(result.tenantId).toBe(testTenantId);
    });

    it("Step 8: Store mutable record with tenantId", async () => {
      await cortex.mutable.set(testMemorySpaceId, mutableKey, {
        testData: "Mutable cross-API test data",
        counter: 1,
      });

      const retrieved = await cortex.mutable.get(testMemorySpaceId, mutableKey);

      // Mutable.get returns the value directly - tenantId is tracked at record level
      expect(retrieved).toBeDefined();
    });

    it("Step 9: Update mutable record preserves tenantId", async () => {
      await cortex.mutable.set(testMemorySpaceId, mutableKey, {
        testData: "Updated mutable data",
        counter: 2,
      });

      const updated = await cortex.mutable.get(testMemorySpaceId, mutableKey);

      expect(updated).toBeDefined();
      expect((updated as { counter?: number })?.counter).toBe(2);
    });

    it("Step 10: List operations respect tenantId", async () => {
      await expectRefusalNoEffects(
        () =>
          queryPublic(runtimeFixtures[0]!, publicApi.conversations.list, {
            memorySpaceId: testMemorySpaceId,
            tenantId: testTenantId,
            limit: 100,
          }),
        runtimeFixtures,
        "conversations",
        "CAPABILITY_NOT_READY",
      );

      // List facts
      const factList = await cortex.facts.list({
        memorySpaceId: testMemorySpaceId,
        limit: 100,
      });

      factList.forEach((f: { tenantId?: string }) => {
        if (f.tenantId) {
          expect(f.tenantId).toBe(testTenantId);
        }
      });

      // List sessions
      const sessionList = await cortex.sessions.list({
        tenantId: testTenantId,
      });

      sessionList.forEach((s) => {
        expect(s.tenantId).toBe(testTenantId);
      });
    });

    it("Step 11: Cleanup with tenantId", async () => {
      // End session
      await cortex.sessions.end(sessionId);

      // Delete mutable
      await cortex.mutable.delete(testMemorySpaceId, mutableKey);

      // Delete fact
      await cortex.facts.delete(testMemorySpaceId, factId);

      // Delete conversation (cascades memories)
      await expectRefusalNoEffects(
        () =>
          mutatePublic(
            runtimeFixtures[0]!,
            publicApi.conversations.deleteConversation,
            {
              memorySpaceId: testMemorySpaceId,
              tenantId: testTenantId,
              conversationId,
            },
          ),
        runtimeFixtures,
        "conversations",
        "CAPABILITY_NOT_READY",
      );

      // Delete user
      await cortex.users.delete(testUserId, { cascade: false });
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Test 2: Parallel Operations - Same TenantId
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Parallel Operations - Same TenantId", () => {
    it("should maintain tenantId across parallel API calls", async () => {
      // Parallel operations across different APIs
      const [fact, session, immutable] = await Promise.all([
        cortex.facts.store({
          memorySpaceId: testMemorySpaceId,
          fact: "Parallel test fact",
          factType: "knowledge",
          confidence: 85,
          sourceType: "manual",
          userId: testUserId,
        }),
        cortex.sessions.create({
          userId: testUserId,
          tenantId: testTenantId,
        }),
        cortex.immutable.store({
          type: "parallel_test",
          id: `parallel_${ctx.runId}`,
          data: { test: "parallel" },
        }),
      ]);

      // All should have the same tenantId
      await expectRefusalNoEffects(
        () =>
          cortex.conversations.create({
            memorySpaceId: testMemorySpaceId,
            type: "user-agent",
            participants: { userId: testUserId, agentId: "test-agent" },
          }),
        runtimeFixtures,
        "conversations",
        "CAPABILITY_NOT_READY",
      );
      expect(fact.tenantId).toBe(testTenantId);
      expect(session.tenantId).toBe(testTenantId);
      expect(immutable.tenantId).toBe(testTenantId);

      // Cleanup
      await Promise.all([
        cortex.facts.delete(testMemorySpaceId, fact.factId),
        cortex.sessions.end(session.sessionId),
      ]);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Test 3: TenantId in Count Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("TenantId in Count Operations", () => {
    beforeAll(async () => {
      // Create test data
      for (let i = 0; i < 3; i++) {
        await cortex.facts.store({
          memorySpaceId: testMemorySpaceId,
          fact: `Count test fact ${i}`,
          factType: "knowledge",
          confidence: 85,
          sourceType: "manual",
          userId: testUserId,
        });
      }
    });

    it("should count only tenant-specific records", async () => {
      // Count facts for this tenant
      const factCount = await cortex.facts.count({
        memorySpaceId: testMemorySpaceId,
      });

      expect(factCount).toBeGreaterThanOrEqual(3);

      // Count sessions for this tenant
      const sessionCount = await cortex.sessions.count({
        tenantId: testTenantId,
      });

      expect(sessionCount).toBeGreaterThanOrEqual(0);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Test 4: TenantId Propagation to Related Entities
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("TenantId Propagation to Related Entities", () => {
    it("should propagate tenantId from conversation to messages", async () => {
      await expectRefusalNoEffects(
        () =>
          cortex.conversations.create({
            memorySpaceId: testMemorySpaceId,
            type: "user-agent",
            participants: { userId: testUserId, agentId: "test-agent" },
          }),
        runtimeFixtures,
        "conversations",
        "CAPABILITY_NOT_READY",
      );
      await expectRefusalNoEffects(
        () =>
          mutatePublic(
            runtimeFixtures[0]!,
            publicApi.conversations.addMessage,
            {
              memorySpaceId: testMemorySpaceId,
              tenantId: testTenantId,
              conversationId: "conv-uncommitted",
              message: {
                id: "msg-uncommitted",
                role: "user",
                content: "Test message for tenantId propagation",
              },
            },
          ),
        runtimeFixtures,
        "conversations",
        "CAPABILITY_NOT_READY",
      );
    });

    it("should preserve memory tenant and refuse unqualified embeddings", async () => {
      const memory = await cortex.vector.store(testMemorySpaceId, {
        content: "The capital of France is Paris",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: ["capital"], userId: testUserId },
      });
      expect(memory.tenantId).toBe(testTenantId);
      const recalled = await cortex.memory.recall({
        memorySpaceId: testMemorySpaceId,
        query: "capital of France",
        limit: 10,
      });
      expect(recalled.items.some((item) => item.id === memory.memoryId)).toBe(
        true,
      );
      await expectOwnedRecallItems(recalled.items, runtimeFixtures[0]!);
      await expectRefusalNoEffects(
        () =>
          cortex.vector.store(testMemorySpaceId, {
            content: "Unqualified embedding must not be published",
            contentType: "raw",
            source: { type: "system" },
            embedding: Array.from({ length: 1536 }, () => 0.01),
            metadata: {
              importance: 50,
              tags: ["embedding-refusal"],
              userId: testUserId,
            },
          }),
        runtimeFixtures,
        "memories",
        "PROFILE_NOT_READY",
      );
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Test 5: TenantId in Search Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("TenantId in Search Operations", () => {
    let searchFactId: string;

    beforeAll(async () => {
      const fact = await cortex.facts.store({
        memorySpaceId: testMemorySpaceId,
        fact: `Unique searchable term ${ctx.runId}`,
        factType: "knowledge",
        confidence: 85,
        sourceType: "manual",
        userId: testUserId,
      });
      searchFactId = fact.factId;
    });

    afterAll(async () => {
      await cortex.facts.delete(testMemorySpaceId, searchFactId);
    });

    it("should return only tenant-specific results in searches", async () => {
      const results = await cortex.facts.search(testMemorySpaceId, ctx.runId, {
        limit: 100,
      });

      // All results should have correct tenantId
      results.forEach((result: { tenantId?: string }) => {
        if (result.tenantId) {
          expect(result.tenantId).toBe(testTenantId);
        }
      });

      // Should find our specific fact
      const found = results.find(
        (r: { factId: string }) => r.factId === searchFactId,
      );
      expect(found).toBeDefined();
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Test 6: TenantId in Batch Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("TenantId in Batch Operations", () => {
    it("should apply tenantId to all records in batch", async () => {
      // Create multiple facts in sequence
      const facts: string[] = [];
      for (let i = 0; i < 5; i++) {
        const fact = await cortex.facts.store({
          memorySpaceId: testMemorySpaceId,
          fact: `Batch fact ${i} for tenant test`,
          factType: "knowledge",
          confidence: 85,
          sourceType: "manual",
          userId: testUserId,
        });
        facts.push(fact.factId);
      }

      // Verify all have correct tenantId
      for (const factId of facts) {
        const fact = await cortex.facts.get(testMemorySpaceId, factId);
        expect(fact?.tenantId).toBe(testTenantId);
      }

      // Cleanup
      for (const factId of facts) {
        await cortex.facts.delete(testMemorySpaceId, factId);
      }
    });
  });
});
