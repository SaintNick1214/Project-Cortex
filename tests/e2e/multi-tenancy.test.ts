/**
 * E2E Tests: Multi-Tenancy
 *
 * End-to-end tests simulating real-world multi-tenant scenarios:
 * - SaaS platform with multiple customer tenants
 * - Tenant data isolation across all operations
 * - Cross-tenant queries (should fail)
 * - Tenant-scoped analytics and reporting
 */

import { Cortex } from "../../src";
import { createTestRunContext } from "../helpers/isolation";
import {
  generateTenantId,
  generateTenantUserId,
  generateTenantMemorySpaceId,
  createTenantAuthContext,
  TenantTestContext,
} from "../helpers/tenancy";

// Test context for isolation
const _ctx = createTestRunContext();

// Skip tests if no Convex URL configured
const describeWithConvex = process.env.CONVEX_URL ? describe : describe.skip;

describeWithConvex("Multi-Tenancy E2E", () => {
  // Simulate a SaaS platform with multiple customers
  const tenants: {
    acmeCorp: TenantTestContext;
    globexInc: TenantTestContext;
    initech: TenantTestContext;
  } = {} as any;

  beforeAll(async () => {
    // Setup Acme Corp tenant
    const acmeId = generateTenantId("acme-corp");
    const acmeUserId = generateTenantUserId(acmeId);
    const acmeSpaceId = generateTenantMemorySpaceId(acmeId);
    const acmeAuth = createTenantAuthContext(acmeId, acmeUserId, {
      organizationId: "org_acme",
      claims: { plan: "enterprise", seats: 100 },
    });

    tenants.acmeCorp = {
      tenantId: acmeId,
      userId: acmeUserId,
      memorySpaceId: acmeSpaceId,
      cortex: new Cortex({
        convexUrl: process.env.CONVEX_URL!,
        auth: acmeAuth,
      }),
      authContext: acmeAuth,
    };

    // Setup Globex Inc tenant
    const globexId = generateTenantId("globex-inc");
    const globexUserId = generateTenantUserId(globexId);
    const globexSpaceId = generateTenantMemorySpaceId(globexId);
    const globexAuth = createTenantAuthContext(globexId, globexUserId, {
      organizationId: "org_globex",
      claims: { plan: "professional", seats: 25 },
    });

    tenants.globexInc = {
      tenantId: globexId,
      userId: globexUserId,
      memorySpaceId: globexSpaceId,
      cortex: new Cortex({
        convexUrl: process.env.CONVEX_URL!,
        auth: globexAuth,
      }),
      authContext: globexAuth,
    };

    // Setup Initech tenant
    const initechId = generateTenantId("initech");
    const initechUserId = generateTenantUserId(initechId);
    const initechSpaceId = generateTenantMemorySpaceId(initechId);
    const initechAuth = createTenantAuthContext(initechId, initechUserId, {
      organizationId: "org_initech",
      claims: { plan: "starter", seats: 5 },
    });

    tenants.initech = {
      tenantId: initechId,
      userId: initechUserId,
      memorySpaceId: initechSpaceId,
      cortex: new Cortex({
        convexUrl: process.env.CONVEX_URL!,
        auth: initechAuth,
      }),
      authContext: initechAuth,
    };

    // Register memory spaces for all tenants
    await tenants.acmeCorp.cortex.memorySpaces.register({
      memorySpaceId: tenants.acmeCorp.memorySpaceId,
      name: "Acme Corp Main Space",
      type: "team",
    });

    await tenants.globexInc.cortex.memorySpaces.register({
      memorySpaceId: tenants.globexInc.memorySpaceId,
      name: "Globex Inc Main Space",
      type: "team",
    });

    await tenants.initech.cortex.memorySpaces.register({
      memorySpaceId: tenants.initech.memorySpaceId,
      name: "Initech Main Space",
      type: "team",
    });
  });

  afterAll(async () => {
    // Cleanup all tenant spaces
    for (const tenant of Object.values(tenants)) {
      try {
        await tenant.cortex.memorySpaces.delete(tenant.memorySpaceId, {
          cascade: true,
          reason: "Test cleanup",
        });
      } catch {
        // Ignore
      }
    }
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Scenario 1: Parallel Tenant Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Scenario 1: Parallel Tenant Operations", () => {
    it("should handle concurrent operations across tenants", async () => {
      // All tenants perform operations simultaneously
      const results = await Promise.all([
        // Acme Corp creates a conversation
        tenants.acmeCorp.cortex.conversations.create({
          memorySpaceId: tenants.acmeCorp.memorySpaceId,
          type: "user-agent",
          participants: { userId: tenants.acmeCorp.userId, agentId: `agent_${tenants.acmeCorp.tenantId}` },
        }),

        // Globex creates a conversation
        tenants.globexInc.cortex.conversations.create({
          memorySpaceId: tenants.globexInc.memorySpaceId,
          type: "user-agent",
          participants: { userId: tenants.globexInc.userId, agentId: `agent_${tenants.globexInc.tenantId}` },
        }),

        // Initech creates a conversation
        tenants.initech.cortex.conversations.create({
          memorySpaceId: tenants.initech.memorySpaceId,
          type: "user-agent",
          participants: { userId: tenants.initech.userId, agentId: `agent_${tenants.initech.tenantId}` },
        }),
      ]);

      // Verify each tenant got their own conversation
      expect(results[0].tenantId).toBe(tenants.acmeCorp.tenantId);
      expect(results[1].tenantId).toBe(tenants.globexInc.tenantId);
      expect(results[2].tenantId).toBe(tenants.initech.tenantId);

      // Cleanup
      await tenants.acmeCorp.cortex.conversations.delete(results[0].conversationId);
      await tenants.globexInc.cortex.conversations.delete(results[1].conversationId);
      await tenants.initech.cortex.conversations.delete(results[2].conversationId);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Scenario 2: Tenant-Specific Data Storage
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Scenario 2: Tenant-Specific Data Storage", () => {
    it("should store and retrieve tenant-specific facts", async () => {
      // Each tenant stores sensitive business data
      const acmeFact = await tenants.acmeCorp.cortex.facts.store({
        memorySpaceId: tenants.acmeCorp.memorySpaceId,
        fact: "Acme Corp's Q4 revenue target: $10M",
        factType: "knowledge",
        confidence: 85,
        sourceType: "manual",
        userId: tenants.acmeCorp.userId,
        metadata: { category: "financial", confidential: true },
      });

      const globexFact = await tenants.globexInc.cortex.facts.store({
        memorySpaceId: tenants.globexInc.memorySpaceId,
        fact: "Globex Inc's new product launch: March 2025",
        factType: "knowledge",
        confidence: 85,
        sourceType: "manual",
        userId: tenants.globexInc.userId,
        metadata: { category: "product", confidential: true },
      });

      const initechFact = await tenants.initech.cortex.facts.store({
        memorySpaceId: tenants.initech.memorySpaceId,
        fact: "Initech's hiring plan: 20 engineers in Q1",
        factType: "knowledge",
        confidence: 85,
        sourceType: "manual",
        userId: tenants.initech.userId,
        metadata: { category: "hr", confidential: true },
      });

      // Verify each tenant can only see their own data
      const acmeSearch = await tenants.acmeCorp.cortex.facts.search(
        tenants.acmeCorp.memorySpaceId,
        "revenue product hiring",
        { limit: 100 }
      );

      // Acme should only find their own fact
      expect(
        acmeSearch.some((f: { factId: string }) => f.factId === acmeFact.factId)
      ).toBe(true);
      expect(
        acmeSearch.some(
          (f: { factId: string }) => f.factId === globexFact.factId
        )
      ).toBe(false);
      expect(
        acmeSearch.some(
          (f: { factId: string }) => f.factId === initechFact.factId
        )
      ).toBe(false);

      // Cleanup
      await tenants.acmeCorp.cortex.facts.delete(
        tenants.acmeCorp.memorySpaceId,
        acmeFact.factId
      );
      await tenants.globexInc.cortex.facts.delete(
        tenants.globexInc.memorySpaceId,
        globexFact.factId
      );
      await tenants.initech.cortex.facts.delete(
        tenants.initech.memorySpaceId,
        initechFact.factId
      );
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Scenario 3: Multi-User Within Tenant
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Scenario 3: Multi-User Within Tenant", () => {
    it("should support multiple users within same tenant", async () => {
      // Create additional users in Acme Corp
      const acmeUser2Id = generateTenantUserId(tenants.acmeCorp.tenantId);
      const _acmeUser3Id = generateTenantUserId(tenants.acmeCorp.tenantId);

      // User 1 creates a memory
      const conv = await tenants.acmeCorp.cortex.conversations.create({
        memorySpaceId: tenants.acmeCorp.memorySpaceId,
        type: "user-agent",
        participants: { userId: tenants.acmeCorp.userId, agentId: `agent_${tenants.acmeCorp.tenantId}` },
      });

      await tenants.acmeCorp.cortex.memory.remember({
        memorySpaceId: tenants.acmeCorp.memorySpaceId,
        conversationId: conv.conversationId,
        userMessage: "User 1's conversation about project Alpha",
        agentResponse: "I'll help with project Alpha",
        userId: tenants.acmeCorp.userId,
        userName: "Acme User 1",
        agentId: `agent_${tenants.acmeCorp.tenantId}`,
      });

      // User 2 creates a memory
      const conv2 = await tenants.acmeCorp.cortex.conversations.create({
        memorySpaceId: tenants.acmeCorp.memorySpaceId,
        type: "user-agent",
        participants: { userId: acmeUser2Id, agentId: `agent_${tenants.acmeCorp.tenantId}` },
      });

      await tenants.acmeCorp.cortex.memory.remember({
        memorySpaceId: tenants.acmeCorp.memorySpaceId,
        conversationId: conv2.conversationId,
        userMessage: "User 2's conversation about project Beta",
        agentResponse: "I'll help with project Beta",
        userId: acmeUser2Id,
        userName: "Acme User 2",
        agentId: `agent_${tenants.acmeCorp.tenantId}`,
      });

      // Recall within tenant should find both users' data
      const recall = await tenants.acmeCorp.cortex.memory.recall({
        memorySpaceId: tenants.acmeCorp.memorySpaceId,
        query: "project",
        limit: 100,
      });

      expect(recall.items.length).toBeGreaterThanOrEqual(2);

      // But other tenants should not see any of it
      const globexRecall = await tenants.globexInc.cortex.memory.recall({
        memorySpaceId: tenants.acmeCorp.memorySpaceId,
        query: "project Alpha Beta",
        limit: 100,
      });

      expect(globexRecall.items.length).toBe(0);

      // Cleanup
      await tenants.acmeCorp.cortex.conversations.delete(conv.conversationId);
      await tenants.acmeCorp.cortex.conversations.delete(conv2.conversationId);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Scenario 4: Cross-Tenant Access Prevention
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Scenario 4: Cross-Tenant Access Prevention", () => {
    let acmeConversationId: string;
    let acmeFactId: string;

    beforeAll(async () => {
      // Create data in Acme Corp
      const conv = await tenants.acmeCorp.cortex.conversations.create({
        memorySpaceId: tenants.acmeCorp.memorySpaceId,
        type: "user-agent",
        participants: { userId: tenants.acmeCorp.userId, agentId: `agent_${tenants.acmeCorp.tenantId}` },
      });
      acmeConversationId = conv.conversationId;

      const fact = await tenants.acmeCorp.cortex.facts.store({
        memorySpaceId: tenants.acmeCorp.memorySpaceId,
        fact: "Acme's secret: password is hunter2",
        factType: "knowledge",
        confidence: 85,
        sourceType: "manual",
        userId: tenants.acmeCorp.userId,
      });
      acmeFactId = fact.factId;
    });

    afterAll(async () => {
      await tenants.acmeCorp.cortex.conversations.delete(acmeConversationId);
      await tenants.acmeCorp.cortex.facts.delete(
        tenants.acmeCorp.memorySpaceId,
        acmeFactId
      );
    });

    it("should prevent Globex from accessing Acme conversation", async () => {
      const result = await tenants.globexInc.cortex.conversations.get(
        acmeConversationId
      );

      expect(result).toBeNull();
    });

    it("should prevent Initech from accessing Acme facts", async () => {
      const result = await tenants.initech.cortex.facts.get(
        tenants.acmeCorp.memorySpaceId,
        acmeFactId
      );

      expect(result).toBeNull();
    });

    it("should prevent cross-tenant fact deletion", async () => {
      // Globex tries to delete Acme's fact
      try {
        await tenants.globexInc.cortex.facts.delete(
          tenants.acmeCorp.memorySpaceId,
          acmeFactId
        );
      } catch {
        // Expected to fail
      }

      // Verify fact still exists for Acme
      const fact = await tenants.acmeCorp.cortex.facts.get(
        tenants.acmeCorp.memorySpaceId,
        acmeFactId
      );
      expect(fact).not.toBeNull();
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Scenario 5: Tenant Session Management
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Scenario 5: Tenant Session Management", () => {
    it("should isolate sessions by tenant", async () => {
      // Create sessions in each tenant
      const acmeSession = await tenants.acmeCorp.cortex.sessions.create({
        userId: tenants.acmeCorp.userId,
        tenantId: tenants.acmeCorp.tenantId,
      });

      const globexSession = await tenants.globexInc.cortex.sessions.create({
        userId: tenants.globexInc.userId,
        tenantId: tenants.globexInc.tenantId,
      });

      // Each tenant should only see their own sessions
      const acmeSessions = await tenants.acmeCorp.cortex.sessions.list({
        tenantId: tenants.acmeCorp.tenantId,
      });

      const globexSessions = await tenants.globexInc.cortex.sessions.list({
        tenantId: tenants.globexInc.tenantId,
      });

      // Verify isolation
      expect(
        acmeSessions.some((s) => s.sessionId === acmeSession.sessionId)
      ).toBe(true);
      expect(
        acmeSessions.some((s) => s.sessionId === globexSession.sessionId)
      ).toBe(false);

      expect(
        globexSessions.some((s) => s.sessionId === globexSession.sessionId)
      ).toBe(true);
      expect(
        globexSessions.some((s) => s.sessionId === acmeSession.sessionId)
      ).toBe(false);

      // Cleanup
      await tenants.acmeCorp.cortex.sessions.end(acmeSession.sessionId);
      await tenants.globexInc.cortex.sessions.end(globexSession.sessionId);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Scenario 6: Tenant Data Export
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Scenario 6: Tenant Data Export", () => {
    it("should export only tenant-specific user data", async () => {
      // Create user profiles in each tenant
      await tenants.acmeCorp.cortex.users.update(tenants.acmeCorp.userId, {
        displayName: "Alice from Acme",
        email: "alice@acme.com",
      });

      await tenants.globexInc.cortex.users.update(tenants.globexInc.userId, {
        displayName: "Bob from Globex",
        email: "bob@globex.com",
      });

      // Export Acme's users
      const acmeResult = await tenants.acmeCorp.cortex.users.list({
        limit: 100,
      });

      // Tenant filtering should work - all returned users should have Acme's tenantId
      // (users without tenantId from before tenant isolation feature are filtered out)
      const usersWithTenant = acmeResult.users.filter(
        (u: { tenantId?: string }) => u.tenantId !== undefined
      );
      expect(usersWithTenant.length).toBeGreaterThan(0);
      expect(
        usersWithTenant.every(
          (u: { tenantId?: string }) => u.tenantId === tenants.acmeCorp.tenantId
        )
      ).toBe(true);

      // Should include the Acme user we created
      expect(
        acmeResult.users.some(
          (u: { id: string }) => u.id === tenants.acmeCorp.userId
        )
      ).toBe(true);

      // Should not include Globex users
      expect(
        acmeResult.users.some(
          (u: { id: string }) => u.id === tenants.globexInc.userId
        )
      ).toBe(false);

      // Cleanup
      await tenants.acmeCorp.cortex.users.delete(tenants.acmeCorp.userId, {
        cascade: false,
      });
      await tenants.globexInc.cortex.users.delete(tenants.globexInc.userId, {
        cascade: false,
      });
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Scenario 7: Tenant Lifecycle (Onboarding/Offboarding)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Scenario 7: Tenant Lifecycle", () => {
    it("should onboard new tenant with isolated resources", async () => {
      // New customer signs up
      const newTenantId = generateTenantId("new-customer");
      const newUserId = generateTenantUserId(newTenantId);
      const newSpaceId = generateTenantMemorySpaceId(newTenantId);

      const newTenantAuth = createTenantAuthContext(newTenantId, newUserId);
      const newTenantCortex = new Cortex({
        convexUrl: process.env.CONVEX_URL!,
        auth: newTenantAuth,
      });

      // Onboard tenant - create memory space
      await newTenantCortex.memorySpaces.register({
        memorySpaceId: newSpaceId,
        name: "New Customer Space",
        type: "team",
      });

      // Create initial user profile
      await newTenantCortex.users.update(newUserId, {
        displayName: "New Customer Admin",
        email: "admin@newcustomer.com",
      });

      // Create initial session
      const session = await newTenantCortex.sessions.create({
        userId: newUserId,
        tenantId: newTenantId,
      });

      // Verify tenant is operational
      expect(session.tenantId).toBe(newTenantId);

      // Verify isolation from existing tenants
      const acmeList = await tenants.acmeCorp.cortex.memorySpaces.list({
        limit: 100,
      });
      expect(
        acmeList.spaces.some(
          (s: { memorySpaceId: string }) => s.memorySpaceId === newSpaceId
        )
      ).toBe(false);

      // Cleanup (simulating offboarding)
      await newTenantCortex.sessions.end(session.sessionId);
      await newTenantCortex.users.delete(newUserId, { cascade: false });
      await newTenantCortex.memorySpaces.delete(newSpaceId, { cascade: true, reason: "Test cleanup" });
    });
  });
});
