/**
 * E2E Tests: Multi-Tenancy
 *
 * End-to-end tests simulating real-world multi-tenant scenarios:
 * - SaaS platform with multiple customer tenants
 * - Tenant data isolation across all operations
 * - Cross-tenant queries (should fail)
 * - Tenant-scoped analytics and reporting
 */

import { expectRefusalNoEffects } from "../helpers/public-contract";
import { createRuntimeFixture } from "../helpers/runtime-fixture";
const runtimeFixtures: Array<Awaited<ReturnType<typeof createRuntimeFixture>>> =
  [];
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

  const sharedUserId = `admin-${_ctx.runId}`;
  const onboardingTenantId = generateTenantId("new-customer");
  const onboardingUserId = generateTenantUserId(onboardingTenantId);
  const onboardingSpaceId = generateTenantMemorySpaceId(onboardingTenantId);
  let sharedAcme: Awaited<ReturnType<typeof createRuntimeFixture>>;
  let sharedGlobex: Awaited<ReturnType<typeof createRuntimeFixture>>;
  let secondAcme: Awaited<ReturnType<typeof createRuntimeFixture>>;
  let onboarding: Awaited<ReturnType<typeof createRuntimeFixture>>;

  beforeAll(async () => {
    // Setup Acme Corp tenant
    const acmeId = generateTenantId("acme-corp");
    const acmeUserId = generateTenantUserId(acmeId);
    const acmeSpaceId = generateTenantMemorySpaceId(acmeId);
    const acmeAuth = createTenantAuthContext(acmeId, acmeUserId, {
      organizationId: "org_acme",
      claims: { plan: "enterprise", seats: 100 },
    });

    const acmeFixture = await createRuntimeFixture(
      acmeId,
      acmeSpaceId,
      acmeUserId,
      { enabled: false },
      { registerSpaces: false },
    );
    runtimeFixtures.push(acmeFixture);
    tenants.acmeCorp = {
      tenantId: acmeId,
      userId: acmeUserId,
      memorySpaceId: acmeSpaceId,
      cortex: new Cortex(
        {
          convexUrl: process.env.CONVEX_URL!,
          auth: acmeAuth,
          resilience: { enabled: false },
        },
        { initializeTransport: acmeFixture.initializeTransport },
      ),
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

    const globexFixture = await createRuntimeFixture(
      globexId,
      globexSpaceId,
      globexUserId,
      { enabled: false },
      { registerSpaces: false },
    );
    runtimeFixtures.push(globexFixture);
    tenants.globexInc = {
      tenantId: globexId,
      userId: globexUserId,
      memorySpaceId: globexSpaceId,
      cortex: new Cortex(
        {
          convexUrl: process.env.CONVEX_URL!,
          auth: globexAuth,
          resilience: { enabled: false },
        },
        { initializeTransport: globexFixture.initializeTransport },
      ),
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

    const initechFixture = await createRuntimeFixture(
      initechId,
      initechSpaceId,
      initechUserId,
      { enabled: false },
      { registerSpaces: false },
    );
    runtimeFixtures.push(initechFixture);
    tenants.initech = {
      tenantId: initechId,
      userId: initechUserId,
      memorySpaceId: initechSpaceId,
      cortex: new Cortex(
        {
          convexUrl: process.env.CONVEX_URL!,
          auth: initechAuth,
          resilience: { enabled: false },
        },
        { initializeTransport: initechFixture.initializeTransport },
      ),
      authContext: initechAuth,
    };

    sharedAcme = await createRuntimeFixture(
      acmeId,
      acmeSpaceId,
      sharedUserId,
      { enabled: false },
      { registerSpaces: false },
    );
    sharedGlobex = await createRuntimeFixture(
      globexId,
      globexSpaceId,
      sharedUserId,
      { enabled: false },
      { registerSpaces: false },
    );
    secondAcme = await createRuntimeFixture(
      acmeId,
      acmeSpaceId,
      generateTenantUserId(acmeId),
      { enabled: false },
      { registerSpaces: false },
    );
    onboarding = await createRuntimeFixture(
      onboardingTenantId,
      onboardingSpaceId,
      onboardingUserId,
      { enabled: false },
      { registerSpaces: false },
    );
    runtimeFixtures.push(sharedAcme, sharedGlobex, secondAcme, onboarding);

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
    try {
      // Cleanup all tenant spaces
      for (const tenant of Object.values(tenants)) {
        try {
          await tenant.cortex.memorySpaces.delete(tenant.memorySpaceId, {
            cascade: true,
            reason: "Test cleanup",
          });
        } catch {
          // Public erasure requires an explicit transport.
        }
      }
    } finally {
      await Promise.all([
        ...Object.values(tenants).map((tenant) => tenant.cortex.shutdown()),
        ...runtimeFixtures.map((fixture) => fixture.close()),
      ]);
    }
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Scenario 1: Parallel Tenant Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Scenario 1: Parallel Tenant Operations", () => {
    it("should handle concurrent operations across tenants", async () => {
      const values = Object.values(tenants);
      const results = await Promise.all(
        values.map((tenant) =>
          tenant.cortex.facts.store({
            memorySpaceId: tenant.memorySpaceId,
            fact: "Parallel tenant operation",
            factType: "knowledge",
            confidence: 85,
            sourceType: "manual",
            userId: tenant.userId,
          }),
        ),
      );
      for (const [index, tenant] of values.entries()) {
        expect(results[index]!.tenantId).toBe(tenant.tenantId);
        expect(
          (
            await tenant.cortex.facts.get(
              tenant.memorySpaceId,
              results[index]!.factId,
            )
          )?.factId,
        ).toBe(results[index]!.factId);
        await expectRefusalNoEffects(
          () =>
            tenant.cortex.conversations.create({
              memorySpaceId: tenant.memorySpaceId,
              type: "user-agent",
              participants: { userId: tenant.userId, agentId: "test-agent" },
            }),
          runtimeFixtures,
          "conversations",
          "CAPABILITY_NOT_READY",
        );
        await tenant.cortex.facts.delete(
          tenant.memorySpaceId,
          results[index]!.factId,
        );
      }
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
        { limit: 100 },
      );

      // Acme should only find their own fact
      expect(
        acmeSearch.some(
          (f: { factId: string }) => f.factId === acmeFact.factId,
        ),
      ).toBe(true);
      expect(
        acmeSearch.some(
          (f: { factId: string }) => f.factId === globexFact.factId,
        ),
      ).toBe(false);
      expect(
        acmeSearch.some(
          (f: { factId: string }) => f.factId === initechFact.factId,
        ),
      ).toBe(false);

      // Cleanup
      await tenants.acmeCorp.cortex.facts.delete(
        tenants.acmeCorp.memorySpaceId,
        acmeFact.factId,
      );
      await tenants.globexInc.cortex.facts.delete(
        tenants.globexInc.memorySpaceId,
        globexFact.factId,
      );
      await tenants.initech.cortex.facts.delete(
        tenants.initech.memorySpaceId,
        initechFact.factId,
      );
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Scenario 3: Multi-User Within Tenant
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Scenario 3: Multi-User Within Tenant", () => {
    it("should support multiple users within same tenant", async () => {
      const first = await tenants.acmeCorp.cortex.vector.store(
        tenants.acmeCorp.memorySpaceId,
        {
          content: "project Alpha for user1",
          contentType: "raw",
          source: { type: "system" },
          metadata: {
            importance: 50,
            tags: ["project"],
            userId: tenants.acmeCorp.userId,
          },
        },
      );
      const second = await secondAcme.cortex.vector.store(
        tenants.acmeCorp.memorySpaceId,
        {
          content: "project Beta for user2",
          contentType: "raw",
          source: { type: "system" },
          metadata: {
            importance: 50,
            tags: ["project"],
            userId: secondAcme.userId,
          },
        },
      );
      const recall = await tenants.acmeCorp.cortex.memory.recall({
        memorySpaceId: tenants.acmeCorp.memorySpaceId,
        query: "project",
        limit: 100,
      });
      expect(recall.items.some((item) => item.id === first.memoryId)).toBe(
        true,
      );
      expect(recall.items.some((item) => item.id === second.memoryId)).toBe(
        true,
      );
      await expectRefusalNoEffects(
        () =>
          tenants.globexInc.cortex.memory.recall({
            memorySpaceId: tenants.acmeCorp.memorySpaceId,
            query: "project Alpha Beta",
            limit: 100,
          }),
        runtimeFixtures,
        "memories",
        "FORBIDDEN",
      );
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Scenario 4: Cross-Tenant Access Prevention
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Scenario 4: Cross-Tenant Access Prevention", () => {
    let acmeFactId: string;

    beforeAll(async () => {
      await expectRefusalNoEffects(
        () =>
          tenants.acmeCorp.cortex.conversations.create({
            memorySpaceId: tenants.acmeCorp.memorySpaceId,
            type: "user-agent",
            participants: {
              userId: tenants.acmeCorp.userId,
              agentId: "test-agent",
            },
          }),
        runtimeFixtures,
        "conversations",
        "CAPABILITY_NOT_READY",
      );
      const fact = await tenants.acmeCorp.cortex.facts.store({
        memorySpaceId: tenants.acmeCorp.memorySpaceId,
        fact: "Acme secret password hunter2",
        factType: "knowledge",
        confidence: 85,
        sourceType: "manual",
        userId: tenants.acmeCorp.userId,
      });
      acmeFactId = fact.factId;
    });

    afterAll(async () => {
      await tenants.acmeCorp.cortex.facts.delete(
        tenants.acmeCorp.memorySpaceId,
        acmeFactId,
      );
    });

    it("should prevent Globex from accessing Acme conversation", async () => {
      await expectRefusalNoEffects(
        () =>
          tenants.globexInc.cortex.conversations.create({
            memorySpaceId: tenants.acmeCorp.memorySpaceId,
            type: "user-agent",
            participants: {
              userId: tenants.globexInc.userId,
              agentId: "test-agent",
            },
          }),
        runtimeFixtures,
        "conversations",
        "FORBIDDEN",
      );
    });

    it("should prevent Initech from accessing Acme facts", async () => {
      await expectRefusalNoEffects(
        () =>
          tenants.initech.cortex.facts.get(
            tenants.acmeCorp.memorySpaceId,
            acmeFactId,
          ),
        runtimeFixtures,
        "facts",
        "FORBIDDEN",
      );
    });

    it("should prevent cross-tenant fact deletion", async () => {
      await expectRefusalNoEffects(
        () =>
          tenants.globexInc.cortex.facts.delete(
            tenants.acmeCorp.memorySpaceId,
            acmeFactId,
          ),
        runtimeFixtures,
        "facts",
        "FORBIDDEN",
      );
      expect(
        (
          await tenants.acmeCorp.cortex.facts.get(
            tenants.acmeCorp.memorySpaceId,
            acmeFactId,
          )
        )?.factId,
      ).toBe(acmeFactId);
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
        acmeSessions.some((s) => s.sessionId === acmeSession.sessionId),
      ).toBe(true);
      expect(
        acmeSessions.some((s) => s.sessionId === globexSession.sessionId),
      ).toBe(false);

      expect(
        globexSessions.some((s) => s.sessionId === globexSession.sessionId),
      ).toBe(true);
      expect(
        globexSessions.some((s) => s.sessionId === acmeSession.sessionId),
      ).toBe(false);

      // Cleanup
      await tenants.acmeCorp.cortex.sessions.end(acmeSession.sessionId);
      await tenants.globexInc.cortex.sessions.end(globexSession.sessionId);
    });

    it("should isolate endAll by tenant when same userId exists in multiple tenants", async () => {
      // Critical test: In multi-tenant SaaS, userIds like "admin" might exist in multiple tenants

      // Create sessions with same userId in both tenants
      const acmeSession1 = await sharedAcme.cortex.sessions.create({
        userId: sharedUserId,
        tenantId: tenants.acmeCorp.tenantId,
      });
      const acmeSession2 = await sharedAcme.cortex.sessions.create({
        userId: sharedUserId,
        tenantId: tenants.acmeCorp.tenantId,
      });

      const globexSession1 = await sharedGlobex.cortex.sessions.create({
        userId: sharedUserId,
        tenantId: tenants.globexInc.tenantId,
      });
      const globexSession2 = await sharedGlobex.cortex.sessions.create({
        userId: sharedUserId,
        tenantId: tenants.globexInc.tenantId,
      });

      // End all sessions for this user ONLY in Acme tenant
      const result = await sharedAcme.cortex.sessions.endAll(sharedUserId, {
        tenantId: tenants.acmeCorp.tenantId,
      });

      // Should have ended exactly 2 sessions (Acme's)
      expect(result.ended).toBe(2);
      expect(result.sessionIds).toContain(acmeSession1.sessionId);
      expect(result.sessionIds).toContain(acmeSession2.sessionId);

      // Verify Acme sessions are ended
      const acmeSession1After = await sharedAcme.cortex.sessions.get(
        acmeSession1.sessionId,
      );
      const acmeSession2After = await sharedAcme.cortex.sessions.get(
        acmeSession2.sessionId,
      );
      expect(acmeSession1After?.status).toBe("ended");
      expect(acmeSession2After?.status).toBe("ended");

      // Verify Globex sessions are STILL ACTIVE (tenant isolation working!)
      const globexSession1After = await sharedGlobex.cortex.sessions.get(
        globexSession1.sessionId,
      );
      const globexSession2After = await sharedGlobex.cortex.sessions.get(
        globexSession2.sessionId,
      );
      expect(globexSession1After?.status).toBe("active");
      expect(globexSession2After?.status).toBe("active");

      // Cleanup Globex sessions
      await sharedGlobex.cortex.sessions.endAll(sharedUserId, {
        tenantId: tenants.globexInc.tenantId,
      });
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
        (u: { tenantId?: string }) => u.tenantId !== undefined,
      );
      expect(usersWithTenant.length).toBeGreaterThan(0);
      expect(
        usersWithTenant.every(
          (u: { tenantId?: string }) =>
            u.tenantId === tenants.acmeCorp.tenantId,
        ),
      ).toBe(true);

      // Should include the Acme user we created
      expect(
        acmeResult.users.some(
          (u: { id: string }) => u.id === tenants.acmeCorp.userId,
        ),
      ).toBe(true);

      // Should not include Globex users
      expect(
        acmeResult.users.some(
          (u: { id: string }) => u.id === tenants.globexInc.userId,
        ),
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
      const newTenantId = onboardingTenantId;
      const newUserId = onboardingUserId;
      const newSpaceId = onboardingSpaceId;

      const newTenantCortex = onboarding.cortex;

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
          (s: { memorySpaceId: string }) => s.memorySpaceId === newSpaceId,
        ),
      ).toBe(false);

      // Cleanup (simulating offboarding)
      await newTenantCortex.sessions.end(session.sessionId);
      await newTenantCortex.users.delete(newUserId, { cascade: false });
      const spaceBefore = await newTenantCortex.memorySpaces.get(newSpaceId);
      await expect(
        newTenantCortex.memorySpaces.delete(newSpaceId, {
          cascade: true,
          reason: "Offboarding requires explicit erasure transport",
        }),
      ).rejects.toThrow("ERASURE_ADMIN_TRANSPORT_REQUIRED");
      expect(await newTenantCortex.memorySpaces.get(newSpaceId)).toEqual(
        spaceBefore,
      );
    });
  });
});
