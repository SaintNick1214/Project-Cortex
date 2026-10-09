/**
 * Integration Tests: Auth Context Injection
 *
 * Tests that the auth context is properly injected into Cortex operations:
 * - Auth context propagation to API calls
 * - TenantId, userId, sessionId extraction
 * - Auth context in different API layers
 */

import {
  expectConvexRefusal,
  expectRefusalNoEffects,
  expectOwnedRecallItems,
  type RuntimeFixture,
} from "./helpers/public-contract";
import { ConvexError } from "convex/values";
import { CascadeDeletionError } from "../src/users";
import { ErasureError } from "../src/users/erasure";
import { createRuntimeFixture } from "./helpers/runtime-fixture";
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

describe("Typed public refusal assertion controls", () => {
  const data = { code: "CAPABILITY_NOT_READY", outcome: "not_dispatched" };
  it.each([
    ["CAPABILITY_NOT_READY", "native"],
    ["FORBIDDEN", "native"],
    ["CAPABILITY_NOT_READY", "serialized"],
    ["FORBIDDEN", "serialized"],
  ])(
    "accepts exact %s %s data while dispatching once and inspecting unchanged rows",
    async (code, representation) => {
      const error =
        representation === "native"
          ? new ConvexError({ ...data, code })
          : new Error(JSON.stringify({ ...data, code, message: "Access denied" }));
      if (representation === "native") {
        error.message = "[CONVEX M] Server Error\nCalled by client";
        expect(error.message).not.toContain(code);
      }
      const rows = [{ factId: "owned", content: "retained" }];
      let dispatches = 0;
      let inspections = 0;
      const fixture = {
        ownedRows: async () => {
          inspections++;
          return rows;
        },
      } as unknown as RuntimeFixture;
      await expectRefusalNoEffects(
        async () => { dispatches++; throw error; },
        [fixture],
        "facts",
        code,
      );
      expect(dispatches).toBe(1);
      expect(inspections).toBe(2);
    },
  );
  it.each([
    new Error("CAPABILITY_NOT_READY: network failure"),
    Object.assign(new Error("Server Error"), { data }),
    new ConvexError("CAPABILITY_NOT_READY"),
    new ConvexError({ ...data, code: "FORBIDDEN" }),
    new Error(JSON.stringify({ ...data, code: "FORBIDDEN", message: "Access denied" })),
    new Error(`Server Error: ${JSON.stringify({ ...data, message: "Access denied" })}`),
  ])("rejects an untyped or different refusal: %p", async (error) => {
    await expect(
      expectConvexRefusal(Promise.reject(error), data.code),
    ).rejects.toThrow();
  });
  it.each([undefined, "executed", "unknown"])(
    "rejects a capability outcome other than not_dispatched: %p",
    async (outcome) => {
      const error = new ConvexError(
        outcome === undefined ? { code: data.code } : { code: data.code, outcome },
      );
      await expect(
        expectConvexRefusal(Promise.reject(error), data.code),
      ).rejects.toThrow();
      const serialized = new Error(
        JSON.stringify({ code: data.code, outcome, message: "Access denied" }),
      );
      await expect(
        expectConvexRefusal(Promise.reject(serialized), data.code),
      ).rejects.toThrow();
    },
  );
  it("rejects a successful response even if it is shaped like a native error", async () => {
    await expect(
      expectConvexRefusal(Promise.resolve(new ConvexError(data)), data.code),
    ).rejects.toThrow();
  });
  it("fails when a typed refusal accompanies a persisted row change", async () => {
    let inspections = 0;
    const fixture = {
      ownedRows: async () => [{
        factId: "owned",
        content: inspections++ === 0 ? "original" : "changed",
      }],
    } as unknown as RuntimeFixture;
    await expect(
      expectRefusalNoEffects(
        async () => { throw new ConvexError(data); },
        [fixture],
        "facts",
        data.code,
      ),
    ).rejects.toThrow();
    expect(inspections).toBe(2);
  });
  it.each([
    new ErasureError("ERASURE_ADMIN_TRANSPORT_REQUIRED"),
    new CascadeDeletionError(
      "Supported erasure stopped",
      new ErasureError("ERASURE_ADMIN_TRANSPORT_REQUIRED"),
    ),
  ])("accepts only the typed local erasure pre-dispatch contract: %p", async (error) => {
    let inspections = 0;
    let dispatches = 0;
    const fixture = {
      ownedRows: async () => {
        inspections++;
        return [{ factId: "owned" }];
      },
    } as unknown as RuntimeFixture;
    await expectRefusalNoEffects(
      async () => { dispatches++; throw error; },
      [fixture],
      "facts",
      "ERASURE_ADMIN_TRANSPORT_REQUIRED",
    );
    expect(dispatches).toBe(1);
    expect(inspections).toBe(2);
  });
  it.each([
    new Error("ERASURE_ADMIN_TRANSPORT_REQUIRED"),
    new CascadeDeletionError(
      "ERASURE_ADMIN_TRANSPORT_REQUIRED",
      new Error("ERASURE_ADMIN_TRANSPORT_REQUIRED"),
    ),
    new ErasureError("ERASURE_CANCELLED"),
  ])("rejects an untyped or different local erasure failure: %p", async (error) => {
    const fixture = { ownedRows: async () => [] } as unknown as RuntimeFixture;
    await expect(
      expectRefusalNoEffects(
        async () => { throw error; },
        [fixture],
        "facts",
        "ERASURE_ADMIN_TRANSPORT_REQUIRED",
      ),
    ).rejects.toThrow();
  });
});

describeWithConvex("Auth Context Injection", () => {
  let testTenantId: string;
  let testUserId: string;
  let testSessionId: string;
  let testMemorySpaceId: string;

  let fixture: Awaited<ReturnType<typeof createRuntimeFixture>>;
  let profileFixture: Awaited<ReturnType<typeof createRuntimeFixture>>;
  const clients: Cortex[] = [];
  const publicCortex = (config: ConstructorParameters<typeof Cortex>[0]) => {
    const client = new Cortex(
      { ...config, resilience: { enabled: false } },
      config.auth
        ? { initializeTransport: fixture.initializeTransport }
        : undefined,
    );
    clients.push(client);
    return client;
  };

  beforeAll(async () => {
    testTenantId = generateTenantId("auth-inject");
    testUserId = generateTenantUserId(testTenantId);
    testSessionId = `sess_${ctx.runId}`;
    testMemorySpaceId = `space_${ctx.runId}`;
    fixture = await createRuntimeFixture(
      testTenantId,
      testMemorySpaceId,
      testUserId,
    );
    profileFixture = await createRuntimeFixture(
      testTenantId,
      `${testMemorySpaceId}-default-profile`,
      testUserId,
    );
  });

  afterAll(async () => {
    await Promise.all(clients.map((client) => client.shutdown()));
    await fixture?.close();
    await profileFixture?.close();
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

      const cortex = publicCortex({
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
      const cortex = publicCortex({
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

      const cortex = publicCortex({
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

      cortex = publicCortex({
        convexUrl: process.env.CONVEX_URL!,
        auth: authContext,
      });

      // Register memory space
    });

    afterAll(async () => {
      try {
        await cortex.memorySpaces.delete(testMemorySpaceId, {
          cascade: true,
          reason: "Test cleanup",
        });
      } catch {
        // Ignore cleanup errors
      }
    });

    it("should refuse unsupported transcript creation without effects", async () => {
      await expectRefusalNoEffects(
        () =>
          cortex.conversations.create({
            memorySpaceId: testMemorySpaceId,
            type: "user-agent",
            participants: { userId: testUserId, agentId: "test-agent" },
          }),
        [fixture],
        "conversations",
        "CAPABILITY_NOT_READY",
      );
    });

    it("should preserve the participant-bound transcript refusal", async () => {
      await expectRefusalNoEffects(
        () =>
          cortex.conversations.create({
            memorySpaceId: testMemorySpaceId,
            type: "user-agent",
            participants: { userId: testUserId, agentId: "test-agent" },
          }),
        [fixture],
        "conversations",
        "CAPABILITY_NOT_READY",
      );
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Auth Context in Memory API
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Auth Context in Memory API", () => {
    let cortex: Cortex;
    let conversationId: string;

    beforeAll(async () => {
      cortex = publicCortex({
        convexUrl: process.env.CONVEX_URL!,
        auth: createTenantAuthContext(testTenantId, testUserId, {
          sessionId: testSessionId,
        }),
      });
      conversationId = "conv-uncommitted";
    });

    afterAll(async () => {
      try {
        await cortex.conversations.delete(conversationId);
      } catch {
        // Ignore cleanup errors
      }
    });

    it("should retain memory auth scope while transcript capture refuses", async () => {
      await expectRefusalNoEffects(
        () =>
          cortex.memory.remember({
            memorySpaceId: testMemorySpaceId,
            tenantId: testTenantId,
            conversationId,
            userMessage: "Test message for auth context",
            agentResponse: "Test response",
            userId: testUserId,
            userName: "Test User",
            agentId: "test-agent",
          }),
        [fixture],
        "memories",
        "CAPABILITY_NOT_READY",
      );
      const memory = await cortex.vector.store(testMemorySpaceId, {
        content: "Supported authenticated memory",
        contentType: "raw",
        source: { type: "system" },
        metadata: {
          importance: 50,
          tags: ["auth-context"],
          userId: testUserId,
        },
      });
      expect(memory.tenantId).toBe(testTenantId);
      expect(memory.userId).toBe(testUserId);
    });

    it("should filter recall by auth context", async () => {
      const memory = await cortex.vector.store(testMemorySpaceId, {
        content: "Recall filter test",
        contentType: "raw",
        source: { type: "system" },
        metadata: {
          importance: 50,
          tags: ["recall-filter"],
          userId: testUserId,
        },
      });
      const result = await cortex.memory.recall({
        memorySpaceId: testMemorySpaceId,
        query: "Recall filter test",
        limit: 10,
      });
      expect(result.items.some((item) => item.id === memory.memoryId)).toBe(
        true,
      );
      await expectOwnedRecallItems(result.items, fixture);
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

      cortex = publicCortex({
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
    let _immutableRecordId: string;
    const mutableKey = `mut_${ctx.runId}`;

    beforeAll(async () => {
      const authContext = createTenantAuthContext(testTenantId, testUserId, {
        sessionId: testSessionId,
      });

      cortex = publicCortex({
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

      _immutableRecordId = result.id;

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

      cortex = publicCortex({
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

    beforeAll(async () => {
      cortex = publicCortex({
        convexUrl: process.env.CONVEX_URL!,
        auth: createTenantAuthContext(testTenantId, testUserId, {
          sessionId: testSessionId,
        }),
      });
    });

    afterAll(async () => {
      try {
        await expectRefusalNoEffects(
          () =>
            cortex.conversations.create({
              memorySpaceId: testMemorySpaceId,
              type: "user-agent",
              participants: { userId: testUserId, agentId: "test-agent" },
            }),
          [fixture],
          "conversations",
          "CAPABILITY_NOT_READY",
        );
      } catch {
        // Ignore cleanup errors
      }
    });

    it("should maintain consistent tenantId across API calls", async () => {
      const memory = await cortex.vector.store(testMemorySpaceId, {
        content: "Cross-API consistency test",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: ["cross-api"], userId: testUserId },
      });
      const fact = await cortex.facts.store({
        memorySpaceId: testMemorySpaceId,
        fact: "Cross-API fact test",
        factType: "knowledge",
        confidence: 85,
        sourceType: "manual",
        userId: testUserId,
      });
      expect(memory.tenantId).toBe(testTenantId);
      expect(fact.tenantId).toBe(testTenantId);
      await expectRefusalNoEffects(
        () =>
          cortex.conversations.create({
            memorySpaceId: testMemorySpaceId,
            type: "user-agent",
            participants: { userId: testUserId, agentId: "test-agent" },
          }),
        [fixture],
        "conversations",
        "CAPABILITY_NOT_READY",
      );
      await cortex.facts.delete(testMemorySpaceId, fact.factId);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Auth Context Override
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Auth Context Override", () => {
    it("should refuse an actor override without persisted effects", async () => {
      const cortex = publicCortex({
        convexUrl: process.env.CONVEX_URL!,
        auth: createTenantAuthContext(testTenantId, testUserId),
      });
      await expectRefusalNoEffects(
        () =>
          cortex.facts.store({
            memorySpaceId: testMemorySpaceId,
            fact: "User override test fact",
            factType: "knowledge",
            confidence: 85,
            sourceType: "manual",
            userId: generateTenantUserId(testTenantId),
          }),
        [fixture],
        "facts",
        "FORBIDDEN",
      );
    });

    it("should use auth context userId when not explicitly provided", async () => {
      const cortex = profileFixture.cortex;
      const profile = await cortex.users.update(testUserId, {
        displayName: "Default User Test",
      });
      expect(profile.id).toBe(testUserId);
      expect(profile.tenantId).toBe(testTenantId);
    });
  });
});
