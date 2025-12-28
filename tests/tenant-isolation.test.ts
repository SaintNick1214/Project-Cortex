/**
 * Integration Tests: Tenant Isolation
 *
 * Critical tests verifying that:
 * - Data from one tenant cannot be accessed by another
 * - Operations are properly scoped by tenantId
 * - Cross-tenant queries return only appropriate data
 */

import { Cortex } from "../src";
import { createTestRunContext } from "./helpers/isolation";
import {
  generateTenantId,
  generateTenantUserId,
  generateTenantMemorySpaceId,
  createTenantAuthContext,
  TenantTestContext,
  verifyTenantIsolation,
} from "./helpers/tenancy";

// Test context for isolation
const ctx = createTestRunContext();

// Skip tests if no Convex URL configured
const describeWithConvex = process.env.CONVEX_URL ? describe : describe.skip;

describeWithConvex("Tenant Isolation", () => {
  // Two completely separate tenants
  let tenantA: TenantTestContext;
  let tenantB: TenantTestContext;

  beforeAll(async () => {
    // Create Tenant A context
    const tenantAId = generateTenantId("iso-tenant-a");
    const userAId = generateTenantUserId(tenantAId);
    const spaceAId = generateTenantMemorySpaceId(tenantAId);
    const authA = createTenantAuthContext(tenantAId, userAId);

    const cortexA = new Cortex({
      convexUrl: process.env.CONVEX_URL!,
      auth: authA,
    });

    tenantA = {
      tenantId: tenantAId,
      userId: userAId,
      memorySpaceId: spaceAId,
      cortex: cortexA,
      authContext: authA,
    };

    // Create Tenant B context
    const tenantBId = generateTenantId("iso-tenant-b");
    const userBId = generateTenantUserId(tenantBId);
    const spaceBId = generateTenantMemorySpaceId(tenantBId);
    const authB = createTenantAuthContext(tenantBId, userBId);

    const cortexB = new Cortex({
      convexUrl: process.env.CONVEX_URL!,
      auth: authB,
    });

    tenantB = {
      tenantId: tenantBId,
      userId: userBId,
      memorySpaceId: spaceBId,
      cortex: cortexB,
      authContext: authB,
    };

    // Register memory spaces for both tenants
    await tenantA.cortex.memorySpaces.register({
      memorySpaceId: tenantA.memorySpaceId,
      name: `Tenant A Space - ${ctx.runId}`,
      type: "team",
    });

    await tenantB.cortex.memorySpaces.register({
      memorySpaceId: tenantB.memorySpaceId,
      name: `Tenant B Space - ${ctx.runId}`,
      type: "team",
    });
  });

  afterAll(async () => {
    // Cleanup both tenant spaces
    try {
      await tenantA.cortex.memorySpaces.delete(tenantA.memorySpaceId, {
        cascade: true,
        reason: "Test cleanup",
      });
    } catch {
      // Ignore
    }

    try {
      await tenantB.cortex.memorySpaces.delete(tenantB.memorySpaceId, {
        cascade: true,
        reason: "Test cleanup",
      });
    } catch {
      // Ignore
    }
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Conversation Isolation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Conversation Isolation", () => {
    let conversationAId: string;

    beforeAll(async () => {
      // Create a conversation in Tenant A
      const conv = await tenantA.cortex.conversations.create({
        memorySpaceId: tenantA.memorySpaceId,
        type: "user-agent",
        participants: { userId: tenantA.userId, agentId: `agent_${tenantA.tenantId}` },
      });
      conversationAId = conv.conversationId;
    });

    afterAll(async () => {
      try {
        await tenantA.cortex.conversations.delete(conversationAId);
      } catch {
        // Ignore
      }
    });

    it("should not allow Tenant B to access Tenant A conversation", async () => {
      // Attempt to get Tenant A's conversation using Tenant B's context
      const conv = await tenantB.cortex.conversations.get(conversationAId);

      // Should either return null or throw access denied
      expect(conv).toBeNull();
    });

    it("should not show Tenant A conversations in Tenant B list", async () => {
      const convBResult = await tenantB.cortex.conversations.list({
        memorySpaceId: tenantA.memorySpaceId, // Trying to list from A's space
        limit: 100,
      });

      // Should either be empty or only contain Tenant B's conversations
      const tenantAConvs = convBResult.conversations.filter(
        (c: { conversationId: string }) => c.conversationId === conversationAId
      );
      expect(tenantAConvs.length).toBe(0);
    });

    it("should show Tenant A conversations in Tenant A list", async () => {
      const convAResult = await tenantA.cortex.conversations.list({
        memorySpaceId: tenantA.memorySpaceId,
        limit: 100,
      });

      const tenantAConvs = convAResult.conversations.filter(
        (c: { conversationId: string }) => c.conversationId === conversationAId
      );
      expect(tenantAConvs.length).toBe(1);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Memory Isolation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Memory Isolation", () => {
    let tenantAMemoryId: string;
    let tenantAAgentId: string;

    beforeAll(async () => {
      // Create agent ID for tenant A
      tenantAAgentId = `agent_${tenantA.tenantId}`;

      // Create memory in Tenant A
      const conv = await tenantA.cortex.conversations.create({
        memorySpaceId: tenantA.memorySpaceId,
        type: "user-agent",
        participants: { userId: tenantA.userId, agentId: tenantAAgentId },
      });

      const result = await tenantA.cortex.memory.remember({
        memorySpaceId: tenantA.memorySpaceId,
        conversationId: conv.conversationId,
        userMessage: "Secret information for Tenant A only",
        agentResponse: "I understand this is confidential",
        userId: tenantA.userId,
        agentId: tenantAAgentId, // Required when userId is provided
      });

      tenantAMemoryId = result.memories[0]._id;
    });

    it("should not return Tenant A memories in Tenant B recall", async () => {
      // Tenant B attempts to recall Tenant A's secret information
      const result = await tenantB.cortex.memory.recall({
        memorySpaceId: tenantA.memorySpaceId,
        query: "Secret information",
        limit: 100,
      });

      // Should not find Tenant A's memory
      const leakedItems = result.items.filter(
        (item) => item.id === tenantAMemoryId
      );
      expect(leakedItems.length).toBe(0);
    });

    it("should return Tenant A memories in Tenant A recall", async () => {
      const result = await tenantA.cortex.memory.recall({
        memorySpaceId: tenantA.memorySpaceId,
        query: "Secret information",
        limit: 100,
      });

      // Should find the memory
      expect(result.items.length).toBeGreaterThan(0);
    });

    it("should not list Tenant A memories from Tenant B", async () => {
      const memories = await tenantB.cortex.memory.list({
        memorySpaceId: tenantA.memorySpaceId,
        limit: 100,
      });

      // Should not contain Tenant A's memory
      const leaked = (memories as { memoryId: string }[]).filter(
        (m) => m.memoryId === tenantAMemoryId
      );
      expect(leaked.length).toBe(0);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Facts Isolation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Facts Isolation", () => {
    let tenantAFactId: string;

    beforeAll(async () => {
      // Create a fact in Tenant A
      const fact = await tenantA.cortex.facts.store({
        memorySpaceId: tenantA.memorySpaceId,
        fact: "Tenant A's secret: API key is xyz123",
        factType: "knowledge",
        confidence: 85,
        sourceType: "manual",
        userId: tenantA.userId,
      });
      tenantAFactId = fact.factId;
    });

    afterAll(async () => {
      try {
        await tenantA.cortex.facts.delete(tenantA.memorySpaceId, tenantAFactId);
      } catch {
        // Ignore
      }
    });

    it("should not allow Tenant B to get Tenant A fact", async () => {
      try {
        const fact = await tenantB.cortex.facts.get(
          tenantA.memorySpaceId,
          tenantAFactId
        );
        // If it returns, it should be null
        expect(fact).toBeNull();
      } catch {
        // Access denied is also acceptable
        expect(true).toBe(true);
      }
    });

    it("should not list Tenant A facts from Tenant B", async () => {
      const facts = await tenantB.cortex.facts.list({
        memorySpaceId: tenantA.memorySpaceId,
        limit: 100,
      });

      // Should not contain Tenant A's fact
      const leaked = facts.filter(
        (f: { factId: string }) => f.factId === tenantAFactId
      );
      expect(leaked.length).toBe(0);
    });

    it("should not allow Tenant B to search Tenant A facts", async () => {
      const results = await tenantB.cortex.facts.search(
        tenantA.memorySpaceId,
        "API key",
        { limit: 100 }
      );

      // Should not find Tenant A's secret fact
      const leaked = results.filter(
        (f: { factId: string }) => f.factId === tenantAFactId
      );
      expect(leaked.length).toBe(0);
    });

    it("should allow Tenant A to access own facts", async () => {
      const fact = await tenantA.cortex.facts.get(
        tenantA.memorySpaceId,
        tenantAFactId
      );
      expect(fact).not.toBeNull();
      expect(fact?.factId).toBe(tenantAFactId);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Immutable Store Isolation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Immutable Store Isolation", () => {
    let tenantARecordId: string;
    const immutableType = "tenant-secret";
    const secretId = `tenant-a-secret-config-${Date.now()}`;

    beforeAll(async () => {
      // Store immutable data in Tenant A
      const result = await tenantA.cortex.immutable.store({
        type: immutableType,
        id: secretId,
        data: { secretData: "This is Tenant A's secret configuration" },
        metadata: { owner: tenantA.userId },
      });
      tenantARecordId = result.id;
    });

    it("should not allow Tenant B to get Tenant A immutable record", async () => {
      const record = await tenantB.cortex.immutable.get(immutableType, secretId);

      expect(record).toBeNull();
    });

    it("should not list Tenant A immutable records from Tenant B", async () => {
      const records = await tenantB.cortex.immutable.list({
        type: immutableType,
        limit: 100,
      });

      const leaked = records.filter(
        (r: { id: string }) => r.id === tenantARecordId
      );
      expect(leaked.length).toBe(0);
    });

    it("should allow Tenant A to access own immutable records", async () => {
      const record = await tenantA.cortex.immutable.get(immutableType, secretId);

      expect(record).not.toBeNull();
      expect(record?.id).toBe(tenantARecordId);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Mutable Store Isolation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Mutable Store Isolation", () => {
    const mutableKey = `tenant-a-settings-${ctx.runId}`;

    beforeAll(async () => {
      // Store mutable data in Tenant A
      await tenantA.cortex.mutable.set(
        tenantA.memorySpaceId,
        mutableKey,
        { settings: { theme: "dark", secretToken: "abc123" } }
      );
    });

    afterAll(async () => {
      try {
        await tenantA.cortex.mutable.delete(tenantA.memorySpaceId, mutableKey);
      } catch {
        // Ignore
      }
    });

    it("should not allow Tenant B to get Tenant A mutable record", async () => {
      const record = await tenantB.cortex.mutable.get(
        tenantA.memorySpaceId,
        mutableKey
      );

      expect(record).toBeNull();
    });

    it("should not list Tenant A mutable keys from Tenant B", async () => {
      const records = await tenantB.cortex.mutable.list({
        namespace: tenantA.memorySpaceId,
        limit: 100,
      });

      const leaked = records.filter(
        (r: { key: string }) => r.key === mutableKey
      );
      expect(leaked.length).toBe(0);
    });

    it("should not allow Tenant B to overwrite Tenant A mutable record", async () => {
      // Tenant B attempts to overwrite Tenant A's data
      await tenantB.cortex.mutable.set(
        tenantA.memorySpaceId,
        mutableKey,
        { malicious: "data" }
      );

      // Verify Tenant A's data is unchanged
      const record = await tenantA.cortex.mutable.get(
        tenantA.memorySpaceId,
        mutableKey
      );

      // Mutable.get returns the value directly, not an object with .value
      expect((record as { settings?: { theme?: string } })?.settings?.theme).toBe("dark");
    });

    it("should allow Tenant A to access own mutable records", async () => {
      const record = await tenantA.cortex.mutable.get(
        tenantA.memorySpaceId,
        mutableKey
      );

      expect(record).not.toBeNull();
      expect((record as { settings?: { secretToken?: string } })?.settings?.secretToken).toBe("abc123");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // User Data Isolation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("User Data Isolation", () => {
    beforeAll(async () => {
      // Create user profile in Tenant A
      await tenantA.cortex.users.update(tenantA.userId, {
        displayName: "Tenant A User",
        email: "user-a@tenant-a.com",
      });

      // Create user profile in Tenant B
      await tenantB.cortex.users.update(tenantB.userId, {
        displayName: "Tenant B User",
        email: "user-b@tenant-b.com",
      });
    });

    afterAll(async () => {
      try {
        await tenantA.cortex.users.delete(tenantA.userId, { cascade: false });
        await tenantB.cortex.users.delete(tenantB.userId, { cascade: false });
      } catch {
        // Ignore
      }
    });

    it("should not allow Tenant B to get Tenant A user profile", async () => {
      const user = await tenantB.cortex.users.get(tenantA.userId);

      // Should either be null or only return limited info
      if (user) {
        // If returned, tenant should not match
        expect(user.tenantId).not.toBe(tenantA.tenantId);
      } else {
        expect(user).toBeNull();
      }
    });

    it("should not list Tenant A users from Tenant B", async () => {
      const result = await tenantB.cortex.users.list({ limit: 100 });

      // Should not contain Tenant A's user
      const leaked = result.users.filter(
        (u: { id: string }) => u.id === tenantA.userId
      );
      expect(leaked.length).toBe(0);
    });

    it("should not allow Tenant B to modify Tenant A user", async () => {
      // Tenant B attempts to modify Tenant A's user
      try {
        await tenantB.cortex.users.update(tenantA.userId, {
          displayName: "Modified by Tenant B",
        });
      } catch {
        // Expected to fail
      }

      // Verify Tenant A's data is unchanged
      const user = await tenantA.cortex.users.get(tenantA.userId);
      expect(user?.data?.displayName).toBe("Tenant A User");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Session Isolation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Session Isolation", () => {
    let tenantASessionId: string;

    beforeAll(async () => {
      // Create session in Tenant A
      const session = await tenantA.cortex.sessions.create({
        userId: tenantA.userId,
        tenantId: tenantA.tenantId,
        metadata: { source: "isolation-test" },
      });
      tenantASessionId = session.sessionId;
    });

    afterAll(async () => {
      try {
        await tenantA.cortex.sessions.end(tenantASessionId);
      } catch {
        // Ignore
      }
    });

    it("should not allow Tenant B to get Tenant A session", async () => {
      const session = await tenantB.cortex.sessions.get(tenantASessionId);

      // Should be null - different tenant
      expect(session).toBeNull();
    });

    it("should not list Tenant A sessions from Tenant B", async () => {
      const sessions = await tenantB.cortex.sessions.list({
        tenantId: tenantA.tenantId,
      });

      // Should be empty - can't query another tenant's sessions
      expect(sessions.length).toBe(0);
    });

    it("should not allow Tenant B to end Tenant A session", async () => {
      try {
        await tenantB.cortex.sessions.end(tenantASessionId);
      } catch {
        // Expected to fail
      }

      // Verify session is still active
      const session = await tenantA.cortex.sessions.get(tenantASessionId);
      expect(session?.status).toBe("active");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Memory Space Isolation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Memory Space Isolation", () => {
    it("should not allow Tenant B to access Tenant A memory space", async () => {
      const space = await tenantB.cortex.memorySpaces.get(tenantA.memorySpaceId);

      // Should be null or throw
      if (space) {
        // If returned, verify it's not the same data
        expect(space.tenantId).not.toBe(tenantA.tenantId);
      }
    });

    it("should not list Tenant A memory spaces from Tenant B", async () => {
      const result = await tenantB.cortex.memorySpaces.list({ limit: 100 });

      const leaked = result.spaces.filter(
        (s: { memorySpaceId: string }) =>
          s.memorySpaceId === tenantA.memorySpaceId
      );
      expect(leaked.length).toBe(0);
    });

    it("should not allow Tenant B to delete Tenant A memory space", async () => {
      try {
        await tenantB.cortex.memorySpaces.delete(tenantA.memorySpaceId, {
          cascade: true,
          reason: "Cross-tenant deletion attempt",
        });
      } catch {
        // Expected to fail
      }

      // Verify space still exists
      const space = await tenantA.cortex.memorySpaces.get(tenantA.memorySpaceId);
      expect(space).not.toBeNull();
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Cross-Tenant Data Integrity
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Cross-Tenant Data Integrity", () => {
    it("should maintain separate counts per tenant", async () => {
      // Create some data in both tenants
      await tenantA.cortex.facts.store({
        memorySpaceId: tenantA.memorySpaceId,
        fact: "Tenant A count test fact 1",
        factType: "knowledge",
        confidence: 85,
        sourceType: "manual",
        userId: tenantA.userId,
      });

      await tenantA.cortex.facts.store({
        memorySpaceId: tenantA.memorySpaceId,
        fact: "Tenant A count test fact 2",
        factType: "knowledge",
        confidence: 85,
        sourceType: "manual",
        userId: tenantA.userId,
      });

      await tenantB.cortex.facts.store({
        memorySpaceId: tenantB.memorySpaceId,
        fact: "Tenant B count test fact 1",
        factType: "knowledge",
        confidence: 85,
        sourceType: "manual",
        userId: tenantB.userId,
      });

      // Count facts per tenant
      const countA = await tenantA.cortex.facts.count({
        memorySpaceId: tenantA.memorySpaceId,
      });

      const countB = await tenantB.cortex.facts.count({
        memorySpaceId: tenantB.memorySpaceId,
      });

      // Counts should be independent
      expect(countA).toBeGreaterThanOrEqual(2);
      expect(countB).toBeGreaterThanOrEqual(1);

      // Tenant A trying to count from B's space should return 0
      const crossCount = await tenantA.cortex.facts.count({
        memorySpaceId: tenantB.memorySpaceId,
      });
      expect(crossCount).toBe(0);
    });

    it("should not leak data in search results", async () => {
      const uniqueSearchTerm = `unique-term-${ctx.runId}`;

      // Create fact with unique term in Tenant A
      await tenantA.cortex.facts.store({
        memorySpaceId: tenantA.memorySpaceId,
        fact: `This fact contains ${uniqueSearchTerm} and is private`,
        factType: "knowledge",
        confidence: 85,
        sourceType: "manual",
        userId: tenantA.userId,
      });

      // Tenant B searches for the unique term
      const results = await tenantB.cortex.facts.search(
        tenantB.memorySpaceId,
        uniqueSearchTerm,
        { limit: 100 }
      );

      // Should not find Tenant A's fact
      const leaked = results.filter((f: { fact?: string }) =>
        f.fact?.includes(uniqueSearchTerm)
      );
      expect(leaked.length).toBe(0);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Helper Function Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Isolation Helper Verification", () => {
    it("should correctly identify isolated conversations", async () => {
      // Create conversation in Tenant A
      const conv = await tenantA.cortex.conversations.create({
        memorySpaceId: tenantA.memorySpaceId,
        type: "user-agent",
        participants: { userId: tenantA.userId, agentId: `agent_${tenantA.tenantId}` },
      });

      const result = await verifyTenantIsolation(tenantA, tenantB, {
        dataType: "conversations",
        recordId: conv.conversationId,
      });

      expect(result.isolated).toBe(true);

      // Cleanup
      await tenantA.cortex.conversations.delete(conv.conversationId);
    });
  });
});
