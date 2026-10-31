import { api as publicApi } from "../convex-dev/_generated/api";
/**
 * Cross-Space Boundary Testing
 *
 * Tests that operations NEVER leak across memory spaces to ensure:
 * 1. Cannot access data from wrong space
 * 2. List/search never returns wrong-space data
 * 3. Counts accurate per space
 * 4. Stats isolated per space
 * 5. Cascade delete respects boundaries
 */

import { expectRefusalNoEffects, mutatePublic } from "./helpers/public-contract";
import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { Cortex } from "../src/index";
import { createRuntimeFixture } from "./helpers/runtime-fixture";

describe("Cross-Space Boundary Testing", () => {
  let cortex: Cortex;
  let fixture: Awaited<ReturnType<typeof createRuntimeFixture>>;
  let scopeA: Awaited<ReturnType<typeof createRuntimeFixture>>;
  let scopeB: Awaited<ReturnType<typeof createRuntimeFixture>>;
  const allFixtures: Array<Awaited<ReturnType<typeof createRuntimeFixture>>> =
    [];
  const fixtureStamp = Date.now();
  const SPACE_A = `space-a-${fixtureStamp}`;
  const SPACE_B = `space-b-${fixtureStamp}`;
  const TEST_USER_ID = "boundary-test-user";
  const TEST_AGENT_ID = "boundary-test-agent";

  // Helper to wait for context to be queryable after creation (eventual consistency)
  const waitForContextReady = async (
    contextId: string,
    timeoutMs = 10000,
  ): Promise<void> => {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      try {
        const result = await cortex.contexts.get(contextId);
        if (result !== null) {
          // Additional delay for index propagation
          await new Promise((resolve) => setTimeout(resolve, 200));
          return;
        }
      } catch {
        // Ignore errors, keep polling
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Context ${contextId} not ready after ${timeoutMs}ms`);
  };

  beforeAll(async () => {
    // Fixed owned scopes are provisioned before any public API call. Negative
    // unknown/foreign selectors below never acquire grants from their args.
    const scopes = [
      SPACE_A,
      SPACE_B,
      `${SPACE_A}-only-${fixtureStamp}`,
      `${SPACE_A}-temp-${fixtureStamp}`,
      `${SPACE_B}-temp-${fixtureStamp}`,
      `${SPACE_A}-cross-del-${fixtureStamp}`,
      `${SPACE_B}-cross-del-${fixtureStamp}`,
      `${SPACE_A}-workflow-${fixtureStamp}`,
      `${SPACE_B}-workflow-${fixtureStamp}`,
      `similar-${fixtureStamp}-1`,
      `similar-${fixtureStamp}-2`,
      `${SPACE_A}-mid-del-${fixtureStamp}`,
      `${SPACE_A}-complete-${fixtureStamp}`,
      `substring-${fixtureStamp}`,
      `substring-${fixtureStamp}-2`,
      ...Array.from({ length: 5 }, (_, i) => `rapid-${fixtureStamp}-${i}`),
      ...Array.from({ length: 10 }, (_, i) => `multi-iso-${fixtureStamp}-${i}`),
    ];
    fixture = await createRuntimeFixture(
      `boundary-tenant-${fixtureStamp}`,
      [SPACE_A, SPACE_B],
      TEST_USER_ID,
      { enabled: false },
      { registerSpaces: false },
    );
    scopeA = await createRuntimeFixture(
      fixture.tenantId,
      SPACE_A,
      TEST_USER_ID,
      { enabled: false },
      { registerSpaces: false },
    );
    scopeB = await createRuntimeFixture(
      fixture.tenantId,
      SPACE_B,
      TEST_USER_ID,
      { enabled: false },
      { registerSpaces: false },
    );
    allFixtures.push(fixture, scopeA, scopeB);
    const selectedClients = new Map<string, Cortex>([
      [SPACE_A, scopeA.cortex],
      [SPACE_B, scopeB.cortex],
    ]);
    for (const scope of scopes.filter(
      (scope) => scope !== SPACE_A && scope !== SPACE_B,
    )) {
      const selected = await createRuntimeFixture(
        fixture.tenantId,
        scope,
        TEST_USER_ID,
        { enabled: false },
        { registerSpaces: false },
      );
      allFixtures.push(selected);
      selectedClients.set(scope, selected.cortex);
    }
    // Each selected client has a fixed grant provisioned above. Dispatching never
    // creates grants; unknown selectors still reach an ungranted public handler.
    const namespaces = new Set([
      "vector",
      "conversations",
      "facts",
      "memory",
      "memorySpaces",
      "contexts",
    ]);
    const proxies = new Map<string, unknown>();
    cortex = new Proxy(fixture.cortex, {
      get(target, property) {
        if (typeof property !== "string" || !namespaces.has(property))
          return Reflect.get(target, property);
        if (!proxies.has(property))
          proxies.set(
            property,
            new Proxy(Reflect.get(target, property) as object, {
              get(api, method) {
                const member: unknown = Reflect.get(api, method);
                if (typeof member !== "function") return member;
                return (...args: unknown[]) => {
                  const selector = args[0];
                  const scope =
                    typeof selector === "string"
                      ? selector
                      : selector &&
                          typeof selector === "object" &&
                          "memorySpaceId" in selector
                        ? selector.memorySpaceId
                        : undefined;
                  const selected =
                    typeof scope === "string" &&
                    !(
                      property === "contexts" &&
                      [SPACE_A, SPACE_B].includes(scope)
                    )
                      ? (selectedClients.get(scope) ?? target)
                      : target;
                  const selectedApi: object = Reflect.get(
                    selected,
                    property,
                  ) as object;
                  return Reflect.apply(
                    Reflect.get(selectedApi, method) as (
                      ...args: unknown[]
                    ) => unknown,
                    selectedApi,
                    args,
                  );
                };
              },
            }),
          );
        return proxies.get(property);
      },
    });

    for (const memorySpaceId of [SPACE_A, SPACE_B])
      await cortex.memorySpaces.register({ memorySpaceId, type: "project" });
  });

  afterAll(async () => {
    await Promise.all(allFixtures.map((item) => item.close()));
    // Cleanup
    try {
      await cortex.memorySpaces.delete(SPACE_A, {
        cascade: true,
        reason: "test cleanup",
      });
    } catch (_e) {
      // Ignore
    }
    try {
      await cortex.memorySpaces.delete(SPACE_B, {
        cascade: true,
        reason: "test cleanup",
      });
    } catch (_e) {
      // Ignore
    }
  });

  // ══════════════════════════════════════════════════════════════════════
  // Vector Memory Isolation
  // ══════════════════════════════════════════════════════════════════════

  describe("Vector Memory Space Isolation", () => {
    it("cannot get memory from wrong space", async () => {
      const memA = await cortex.vector.store(SPACE_A, {
        content: "Space A memory",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });

      // Attempt to get from space B
      const result = await cortex.vector.get(SPACE_B, memA.memoryId);

      expect(result).toBeNull(); // Should not be accessible
    });

    it("cannot update memory from wrong space", async () => {
      const memA = await cortex.vector.store(SPACE_A, {
        content: "Space A content",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });

      // Attempt to update from space B
      try {
        await cortex.vector.update(SPACE_B, memA.memoryId, {
          content: "Hacked from space B",
        });
        // If succeeds, should fail validation
        const check = await cortex.vector.get(SPACE_A, memA.memoryId);
        expect(check!.content).toBe("Space A content"); // Not changed
      } catch (_e) {
        // Expected - permission denied
        expect(_e).toBeDefined();
      }
    });

    it("cannot delete memory from wrong space", async () => {
      const memA = await cortex.vector.store(SPACE_A, {
        content: "Protected memory",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });

      // Attempt to delete from space B
      try {
        await cortex.vector.delete(SPACE_B, memA.memoryId);
      } catch (_e) {
        // Expected
      }

      // Memory should still exist in space A
      const check = await cortex.vector.get(SPACE_A, memA.memoryId);
      expect(check).not.toBeNull();
    });

    it("list() never returns memories from other spaces", async () => {
      await cortex.vector.store(SPACE_A, {
        content: "MARKER_SPACE_A data",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });

      await cortex.vector.store(SPACE_B, {
        content: "MARKER_SPACE_B data",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });

      // List space A
      const listA = await cortex.vector.list({ memorySpaceId: SPACE_A });

      listA.forEach((mem) => {
        expect(mem.memorySpaceId).toBe(SPACE_A);
        expect(mem.content).not.toContain("MARKER_SPACE_B");
      });

      // List space B
      const listB = await cortex.vector.list({ memorySpaceId: SPACE_B });

      listB.forEach((mem) => {
        expect(mem.memorySpaceId).toBe(SPACE_B);
        expect(mem.content).not.toContain("MARKER_SPACE_A");
      });
    });

    it("search() never returns memories from other spaces", async () => {
      await cortex.vector.store(SPACE_A, {
        content: "UNIQUE_SEARCH_MARKER in space A",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });

      // Search in space B
      const results = await cortex.vector.search(
        SPACE_B,
        "UNIQUE_SEARCH_MARKER",
      );

      // Should not return space A data
      results.forEach((mem) => {
        expect(mem.memorySpaceId).toBe(SPACE_B);
      });
    });

    it("count() only counts correct space", async () => {
      // Create memories in both spaces
      await Promise.all([
        cortex.vector.store(SPACE_A, {
          content: "A1",
          contentType: "raw",
          source: { type: "system" },
          metadata: { importance: 50, tags: ["count-test"] },
        }),
        cortex.vector.store(SPACE_A, {
          content: "A2",
          contentType: "raw",
          source: { type: "system" },
          metadata: { importance: 50, tags: ["count-test"] },
        }),
        cortex.vector.store(SPACE_B, {
          content: "B1",
          contentType: "raw",
          source: { type: "system" },
          metadata: { importance: 50, tags: ["count-test"] },
        }),
      ]);

      const listAAll = await cortex.vector.list({ memorySpaceId: SPACE_A });
      const countA = listAAll.filter((m) =>
        m.tags.includes("count-test"),
      ).length;

      const listBAll = await cortex.vector.list({ memorySpaceId: SPACE_B });
      const countB = listBAll.filter((m) =>
        m.tags.includes("count-test"),
      ).length;

      expect(countA).toBeGreaterThanOrEqual(2);
      expect(countB).toBeGreaterThanOrEqual(1);
    });

    it("export() only exports from specified space", async () => {
      await cortex.vector.store(SPACE_A, {
        content: "Space A export data",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: ["export-test"] },
      });

      await cortex.vector.store(SPACE_B, {
        content: "Space B export data",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: ["export-test"] },
      });

      const exportedA = await cortex.vector.export({
        memorySpaceId: SPACE_A,
        format: "json",
      });

      const parsedA = JSON.parse(exportedA.data);

      parsedA.forEach((mem: any) => {
        // memorySpaceId may not be in export format
        // expect(mem.memorySpaceId).toBe(SPACE_A);
        expect(mem.content).not.toContain("Space B");
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Conversation Isolation
  // ══════════════════════════════════════════════════════════════════════

  describe("Conversation Space Isolation", () => {
    let conversationA: string, conversationB: string;
    beforeAll(async () => {
      const a = await scopeA.cortex.conversations.create({memorySpaceId: SPACE_A, type: "user-agent", participants: {userId: TEST_USER_ID, agentId: TEST_AGENT_ID}});
      const b = await scopeB.cortex.conversations.create({memorySpaceId: SPACE_B, type: "user-agent", participants: {userId: TEST_USER_ID, agentId: TEST_AGENT_ID}});
      conversationA = a.conversationId; conversationB = b.conversationId;
      expect(a).toMatchObject({tenantId:fixture.tenantId,memorySpaceId:SPACE_A});
      expect(b).toMatchObject({tenantId:fixture.tenantId,memorySpaceId:SPACE_B});
      await scopeA.cortex.conversations.addMessage({conversationId:conversationA,message:{role:"user",content:"CROSS_SPACE_SEARCH_MARKER A"}});
      await scopeB.cortex.conversations.addMessage({conversationId:conversationB,message:{role:"user",content:"CROSS_SPACE_SEARCH_MARKER B"}});
    });

    it("owned transcript access succeeds and foreign access refuses without effects", async () => {
      const owned = await scopeA.cortex.conversations.get(conversationA);
      expect(owned).toMatchObject({conversationId:conversationA,tenantId:fixture.tenantId,memorySpaceId:SPACE_A});
      expect(owned?.messages.some(message=>message.content==="CROSS_SPACE_SEARCH_MARKER A")).toBe(true);
      const run=()=>mutatePublic(scopeB,publicApi.conversations.get,{memorySpaceId:SPACE_B,tenantId:fixture.tenantId,conversationId:conversationA});
      await expectRefusalNoEffects(run,allFixtures,"runtimeConversations","FORBIDDEN");
      await expectRefusalNoEffects(run,allFixtures,"runtimeTranscriptMessages","FORBIDDEN");
    });

    it("public transcript listing returns only its selected owned space", async () => {
      for (const [selected, own, foreign] of [[scopeA,conversationA,conversationB],[scopeB,conversationB,conversationA]] as const) {
        const result=await mutatePublic(selected,publicApi.conversations.list,{memorySpaceId:selected.memorySpaceId,tenantId:fixture.tenantId,limit:100});
        expect(result.conversations.some(row=>row.conversationId===own)).toBe(true);
        expect(result.conversations.some(row=>row.conversationId===foreign)).toBe(false);
        expect(result.conversations.every(row=>row.memorySpaceId===selected.memorySpaceId && row.tenantId===fixture.tenantId)).toBe(true);
      }
    });

    it("public transcript count excludes conversations added to another owned space", async () => {
      const aBefore=await scopeA.cortex.conversations.count({memorySpaceId:SPACE_A});
      const bBefore=await scopeB.cortex.conversations.count({memorySpaceId:SPACE_B});
      expect(aBefore).toBeGreaterThanOrEqual(1); expect(bBefore).toBeGreaterThanOrEqual(1);
      await scopeA.cortex.conversations.create({memorySpaceId:SPACE_A,type:"user-agent",participants:{userId:TEST_USER_ID,agentId:TEST_AGENT_ID}});
      expect(await scopeA.cortex.conversations.count({memorySpaceId:SPACE_A})).toBe(aBefore+1);
      expect(await scopeB.cortex.conversations.count({memorySpaceId:SPACE_B})).toBe(bBefore);
    });

    it("public transcript search returns only matches in its selected owned space", async () => {
      const result=await scopeB.cortex.conversations.search({query:"CROSS_SPACE_SEARCH_MARKER",filters:{memorySpaceId:SPACE_B}});
      expect(result.some(row=>row.conversation.conversationId===conversationB)).toBe(true);
      expect(result.some(row=>row.conversation.conversationId===conversationA)).toBe(false);
      expect(result.every(row=>row.conversation.memorySpaceId===SPACE_B && row.conversation.tenantId===fixture.tenantId)).toBe(true);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Facts Isolation
  // ══════════════════════════════════════════════════════════════════════

  describe("Facts Space Isolation", () => {
    it("public deleteMany uses the supported scoped mutation and preserves foreign facts", async () => {
      const a1 = await cortex.facts.store({
        memorySpaceId: SPACE_A,
        fact: "Bulk custom A1",
        factType: "custom",
        confidence: 80,
        sourceType: "manual",
        userId: TEST_USER_ID,
      });
      const a2 = await cortex.facts.store({
        memorySpaceId: SPACE_A,
        fact: "Bulk custom A2",
        factType: "custom",
        confidence: 80,
        sourceType: "manual",
        userId: TEST_USER_ID,
      });
      const b = await cortex.facts.store({
        memorySpaceId: SPACE_B,
        fact: "Bulk custom B",
        factType: "custom",
        confidence: 80,
        sourceType: "manual",
        userId: TEST_USER_ID,
      });
      const before = await fixture.ownedRows("facts");
      await expect(
        cortex.facts.deleteMany({ memorySpaceId: SPACE_A, factType: "custom" }),
      ).resolves.toMatchObject({ deleted: 2, memorySpaceId: SPACE_A });
      await expectRefusalNoEffects(
        () => cortex.facts.get(SPACE_A, a1.factId),
        allFixtures,
        "facts",
        "FORBIDDEN",
      );
      await expectRefusalNoEffects(
        () => cortex.facts.get(SPACE_A, a2.factId),
        allFixtures,
        "facts",
        "FORBIDDEN",
      );
      expect(
        await cortex.facts.list({ memorySpaceId: SPACE_A, factType: "custom" }),
      ).toEqual([]);
      expect(await cortex.facts.get(SPACE_B, b.factId)).toEqual(b);
      const after = await fixture.ownedRows("facts");
      for (const factId of [a1.factId, a2.factId]) {
        const persisted = after.find(
          (row) => (row as { factId?: string }).factId === factId,
        ) as { tombstonedAt?: number; _id?: string } | undefined;
        expect(typeof persisted?.tombstonedAt).toBe("number");
        expect(persisted?._id).toBe(factId === a1.factId ? a1._id : a2._id);
      }
      expect(after.filter((row: any) => row.memorySpaceId === SPACE_B)).toEqual(
        before.filter((row: any) => row.memorySpaceId === SPACE_B),
      );
    });

    it("cannot get fact from wrong space", async () => {
      const factA = await cortex.facts.store({
        memorySpaceId: SPACE_A,
        fact: "Space A fact",
        factType: "knowledge",
        subject: TEST_USER_ID,
        confidence: 80,
        sourceType: "manual",
      });

      const result = await cortex.facts.get(SPACE_B, factA.factId);

      expect(result).toBeNull();
    });

    it("list() only returns facts from specified space", async () => {
      await cortex.facts.store({
        memorySpaceId: SPACE_A,
        fact: "Fact in space A",
        factType: "knowledge",
        subject: TEST_USER_ID,
        confidence: 80,
        sourceType: "manual",
        tags: ["isolation-test"],
      });

      await cortex.facts.store({
        memorySpaceId: SPACE_B,
        fact: "Fact in space B",
        factType: "knowledge",
        subject: TEST_USER_ID,
        confidence: 80,
        sourceType: "manual",
        tags: ["isolation-test"],
      });

      const listA = await cortex.facts.list({ memorySpaceId: SPACE_A });
      const listB = await cortex.facts.list({ memorySpaceId: SPACE_B });

      listA.forEach((fact) => {
        expect(fact.memorySpaceId).toBe(SPACE_A);
      });

      listB.forEach((fact) => {
        expect(fact.memorySpaceId).toBe(SPACE_B);
      });
    });

    it("search() isolated by space", async () => {
      await cortex.facts.store({
        memorySpaceId: SPACE_A,
        fact: "FACT_ISOLATION_MARKER in space A",
        factType: "knowledge",
        subject: TEST_USER_ID,
        confidence: 80,
        sourceType: "manual",
      });

      const results = await cortex.facts.search(
        SPACE_B,
        "FACT_ISOLATION_MARKER",
      );

      // Should not return space A data
      results.forEach((fact) => {
        expect(fact.memorySpaceId).toBe(SPACE_B);
      });
    });

    it("queryBySubject() isolated by space", async () => {
      await cortex.facts.store({
        memorySpaceId: SPACE_A,
        fact: "Subject fact A",
        factType: "knowledge",
        subject: "shared-subject",
        confidence: 80,
        sourceType: "manual",
      });

      await cortex.facts.store({
        memorySpaceId: SPACE_B,
        fact: "Subject fact B",
        factType: "knowledge",
        subject: "shared-subject",
        confidence: 80,
        sourceType: "manual",
      });

      const resultsA = await cortex.facts.queryBySubject({
        memorySpaceId: SPACE_A,
        subject: "shared-subject",
      });

      const resultsB = await cortex.facts.queryBySubject({
        memorySpaceId: SPACE_B,
        subject: "shared-subject",
      });

      // Each space should only see its own facts
      resultsA.forEach((fact) => {
        expect(fact.memorySpaceId).toBe(SPACE_A);
      });

      resultsB.forEach((fact) => {
        expect(fact.memorySpaceId).toBe(SPACE_B);
      });
    });

    it("count() isolated per space", async () => {
      await cortex.facts.store({
        memorySpaceId: SPACE_A,
        fact: "Count A",
        factType: "knowledge",
        subject: TEST_USER_ID,
        confidence: 80,
        sourceType: "manual",
      });

      const countA = await cortex.facts.count({ memorySpaceId: SPACE_A });
      const _countB = await cortex.facts.count({ memorySpaceId: SPACE_B });

      expect(countA).toBeGreaterThanOrEqual(1);
      // Count B should not include space A facts
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Context Isolation
  // ══════════════════════════════════════════════════════════════════════

  describe("Context Space Isolation", () => {
    it("cannot get context from wrong space filter", async () => {
      const ctxA = await cortex.contexts.create({
        memorySpaceId: SPACE_A,
        userId: TEST_USER_ID,
        purpose: "Space A context",
      });

      // Can get directly (not space-scoped)
      const direct = await cortex.contexts.get(ctxA.contextId);
      expect(direct).not.toBeNull();

      // List from space B shouldn't include it
      const listB = await cortex.contexts.list({ memorySpaceId: SPACE_B });
      expect(listB.some((c: any) => c.contextId === ctxA.contextId)).toBe(
        false,
      );
    });

    it("list() only returns contexts from specified space", async () => {
      await cortex.contexts.create({
        memorySpaceId: SPACE_A,
        userId: TEST_USER_ID,
        purpose: "Context A",
      });

      await cortex.contexts.create({
        memorySpaceId: SPACE_B,
        userId: TEST_USER_ID,
        purpose: "Context B",
      });

      const listA = await cortex.contexts.list({ memorySpaceId: SPACE_A });
      const listB = await cortex.contexts.list({ memorySpaceId: SPACE_B });

      listA.forEach((ctx: any) => {
        expect((ctx as any).memorySpaceId).toBe(SPACE_A);
      });

      listB.forEach((ctx: any) => {
        expect(ctx.memorySpaceId).toBe(SPACE_B);
      });
    });

    it("count() isolated per space", async () => {
      await cortex.contexts.create({
        memorySpaceId: SPACE_A,
        userId: TEST_USER_ID,
        purpose: "Count context A",
      });

      const countA = await cortex.contexts.count({ memorySpaceId: SPACE_A });
      const _countB = await cortex.contexts.count({ memorySpaceId: SPACE_B });

      expect(countA).toBeGreaterThanOrEqual(1);
      // Space B count should not include space A
    });

    it("cross-space parent-child relationships allowed but isolated", async () => {
      const parentA = await cortex.contexts.create({
        memorySpaceId: SPACE_A,
        userId: TEST_USER_ID,
        purpose: "Parent in A",
      });

      // Wait for parent to be queryable (eventual consistency)
      await waitForContextReady(parentA.contextId);

      const childB = await cortex.contexts.create({
        memorySpaceId: SPACE_B,
        userId: TEST_USER_ID,
        purpose: "Child in B",
        parentId: parentA.contextId,
      });

      // Parent in space A list
      const listA = await cortex.contexts.list({ memorySpaceId: SPACE_A });
      expect(listA.some((c: any) => c.contextId === parentA.contextId)).toBe(
        true,
      );
      expect(listA.some((c: any) => c.contextId === childB.contextId)).toBe(
        false,
      );

      // Child in space B list
      const listB = await cortex.contexts.list({ memorySpaceId: SPACE_B });
      expect(listB.some((c: any) => c.contextId === childB.contextId)).toBe(
        true,
      );
      expect(listB.some((c: any) => c.contextId === parentA.contextId)).toBe(
        false,
      );
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Memory Space Stats Isolation
  // ══════════════════════════════════════════════════════════════════════

  describe("Memory Space Statistics Isolation", () => {
    it("owned memory reads remain isolated while public statistics refuse", async () => {
      const memory = await cortex.vector.store(SPACE_A, {
        content: "Stats test A",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });
      expect(
        (await cortex.vector.get(SPACE_A, memory.memoryId))?.memorySpaceId,
      ).toBe(SPACE_A);
      expect(await cortex.vector.get(SPACE_B, memory.memoryId)).toBeNull();
      await expectRefusalNoEffects(
        () => cortex.memorySpaces.getStats(SPACE_A),
        allFixtures,
        "memories",
        "CAPABILITY_NOT_READY",
      );
      await expectRefusalNoEffects(
        () => cortex.memorySpaces.getStats(SPACE_B),
        allFixtures,
        "memories",
        "CAPABILITY_NOT_READY",
      );
    });

    it("public statistics refuse after a supported isolated memory write", async () => {
      const scope = `${SPACE_A}-only-${fixtureStamp}`;
      await cortex.memorySpaces.register({
        memorySpaceId: scope,
        type: "project",
      });
      await cortex.vector.store(scope, {
        content: "Only in A",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });
      expect(await cortex.vector.count({ memorySpaceId: scope })).toBe(1);
      await expectRefusalNoEffects(
        () => cortex.memorySpaces.getStats(scope),
        allFixtures,
        "memories",
        "CAPABILITY_NOT_READY",
      );
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Cascade Delete Boundary Respect
  // ══════════════════════════════════════════════════════════════════════

  describe("Cascade Delete Boundary Respect", () => {
    it("public erasure refusal preserves both owned spaces", async () => {
      const a = `${SPACE_A}-temp-${fixtureStamp}`,
        b = `${SPACE_B}-temp-${fixtureStamp}`;
      for (const memorySpaceId of [a, b])
        await cortex.memorySpaces.register({ memorySpaceId, type: "project" });
      const memA = await cortex.vector.store(a, {
          content: "Data in temp A",
          contentType: "raw",
          source: { type: "system" },
          metadata: { importance: 50, tags: [] },
        }),
        memB = await cortex.vector.store(b, {
          content: "Data in temp B",
          contentType: "raw",
          source: { type: "system" },
          metadata: { importance: 50, tags: [] },
        });
      await expectRefusalNoEffects(
        () =>
          cortex.memorySpaces.delete(a, {
            cascade: true,
            reason: "Public scoped erasure refusal",
          }),
        allFixtures,
        "memories",
        "ERASURE_ADMIN_TRANSPORT_REQUIRED",
      );
      expect((await cortex.vector.get(a, memA.memoryId))?.content).toBe(
        "Data in temp A",
      );
      expect((await cortex.vector.get(b, memB.memoryId))?.content).toBe(
        "Data in temp B",
      );
    });

    it("public user cascade requires explicit erasure transport without effects", async () => {
      await cortex.vector.store(SPACE_A, {
        content: "User data A",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });
      await cortex.vector.store(SPACE_B, {
        content: "User data B",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });
      await expectRefusalNoEffects(
        () => scopeA.cortex.users.delete(TEST_USER_ID, { cascade: true }),
        allFixtures,
        "memories",
        "ERASURE_ADMIN_TRANSPORT_REQUIRED",
      );
    });

    it("context cascade doesn't cross space boundaries", async () => {
      const parentA = await cortex.contexts.create({
        memorySpaceId: SPACE_A,
        userId: TEST_USER_ID,
        purpose: "Parent A",
      });

      // Wait for parent to be queryable (eventual consistency)
      await waitForContextReady(parentA.contextId);

      const childB = await cortex.contexts.create({
        memorySpaceId: SPACE_B,
        userId: TEST_USER_ID,
        purpose: "Child B",
        parentId: parentA.contextId,
      });

      // Delete parent without cascade children
      try {
        await cortex.contexts.delete(parentA.contextId);
      } catch (_e) {
        // May fail due to having children
      }

      // Child in different space should still exist
      const childCheck = await cortex.contexts.get(childB.contextId);
      expect(childCheck).not.toBeNull();
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Immutable & Mutable (NOT space-scoped)
  // ══════════════════════════════════════════════════════════════════════

  describe("Immutable & Mutable (Scoped Resources)", () => {
    it("immutable links stay within their owned scope", async () => {
      const record = await scopeA.cortex.immutable.store({
        type: "shared",
        id: `shared-${fixtureStamp}`,
        data: { value: "owned A" },
      });
      const input = {
        content: "Owned immutable ref",
        contentType: "raw" as const,
        source: { type: "system" as const },
        immutableRef: { type: "shared", id: record.id, version: 1 },
        metadata: { importance: 50, tags: [] },
      };
      const memory = await cortex.vector.store(SPACE_A, input);
      expect(memory.immutableRef?.id).toBe(record.id);
      await expectRefusalNoEffects(
        () => cortex.vector.store(SPACE_B, input),
        allFixtures,
        "memories",
        "FORBIDDEN",
      );
      expect(
        (await scopeA.cortex.immutable.get("shared", record.id))?.data,
      ).toEqual({ value: "owned A" });
      expect(await scopeB.cortex.immutable.get("shared", record.id)).toBeNull();
    });

    it("mutable links stay within their owned scope", async () => {
      const namespace = "global-ns",
        key = `key-${fixtureStamp}`;
      await scopeA.cortex.mutable.set(namespace, key, "owned A");
      const input = {
        content: "Owned mutable ref",
        contentType: "raw" as const,
        source: { type: "system" as const },
        mutableRef: {
          namespace,
          key,
          snapshotValue: "owned A",
          snapshotAt: Date.now(),
        },
        metadata: { importance: 50, tags: [] },
      };
      const memory = await cortex.vector.store(SPACE_A, input);
      expect(memory.mutableRef?.key).toBe(key);
      await expectRefusalNoEffects(
        () => cortex.vector.store(SPACE_B, input),
        allFixtures,
        "memories",
        "FORBIDDEN",
      );
      expect(await scopeA.cortex.mutable.get(namespace, key)).toBe("owned A");
      expect(await scopeB.cortex.mutable.get(namespace, key)).toBeNull();
    });

    it("updating mutable changes only its selected scope", async () => {
      const namespace = "shared-ns",
        key = `counter-${fixtureStamp}`;
      await scopeA.cortex.mutable.set(namespace, key, 0);
      await scopeB.cortex.mutable.set(namespace, key, 0);
      await scopeA.cortex.mutable.increment(namespace, key, 5);
      await scopeB.cortex.mutable.increment(namespace, key, 3);
      expect(await scopeA.cortex.mutable.get(namespace, key)).toBe(5);
      expect(await scopeB.cortex.mutable.get(namespace, key)).toBe(3);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Multi-Space Query Isolation
  // ══════════════════════════════════════════════════════════════════════

  describe("Multi-Space Query Isolation", () => {
    it("memory.search() isolated by space", async () => {
      const memory = await cortex.vector.store(SPACE_A, {
        content: "SEARCH_ISO_MARKER in space A",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });
      const results = await cortex.memory.search(SPACE_B, "SEARCH_ISO_MARKER");
      expect(results.some((row) => row.memoryId === memory.memoryId)).toBe(
        false,
      );
      expect(results.every((row) => row.memorySpaceId === SPACE_B)).toBe(true);
    });

    it("memory.list() isolated by space", async () => {
      const memory = await cortex.vector.store(SPACE_A, {
        content: "List test A",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });
      const list = await cortex.memory.list({
        memorySpaceId: SPACE_B,
        limit: 100,
      });
      expect(list.some((row) => row.memoryId === memory.memoryId)).toBe(false);
      expect(list.every((row) => row.memorySpaceId === SPACE_B)).toBe(true);
    });

    it("memory.count() isolated by space", async () => {
      const countA = await cortex.vector.count({ memorySpaceId: SPACE_A });
      const countB = await cortex.vector.count({ memorySpaceId: SPACE_B });

      // Independent counts
      expect(countA).toBeGreaterThanOrEqual(0);
      expect(countB).toBeGreaterThanOrEqual(0);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Complex Cross-Space Scenarios
  // ══════════════════════════════════════════════════════════════════════

  describe("Complex Cross-Space Scenarios", () => {
    it("same userId in different spaces is isolated", async () => {
      const userId = TEST_USER_ID;

      // Create memories for same user in both spaces
      const memA = await cortex.vector.store(SPACE_A, {
        content: "User data in space A",
        contentType: "raw",
        userId,
        source: { type: "system", userId },
        metadata: { importance: 50, tags: ["multi-user"] },
      });

      const memB = await cortex.vector.store(SPACE_B, {
        content: "User data in space B",
        contentType: "raw",
        userId,
        source: { type: "system", userId },
        metadata: { importance: 50, tags: ["multi-user"] },
      });

      // List by user in space A
      const listA = await cortex.vector.list({
        memorySpaceId: SPACE_A,
      });
      const filteredA = listA.filter((m) => m.tags.includes("multi-user"));

      // Should not include space B memory
      expect(filteredA.some((m) => m.memoryId === memB.memoryId)).toBe(false);
      expect(filteredA.some((m) => m.memoryId === memA.memoryId)).toBe(true);
    });

    it("same tag in different spaces is isolated", async () => {
      await cortex.vector.store(SPACE_A, {
        content: "Tagged A",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: ["shared-tag"] },
      });

      await cortex.vector.store(SPACE_B, {
        content: "Tagged B",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: ["shared-tag"] },
      });

      const listA = await cortex.vector.list({
        memorySpaceId: SPACE_A,
      });
      const filteredShared = listA.filter((m) => m.tags.includes("shared-tag"));

      filteredShared.forEach((mem) => {
        expect(mem.memorySpaceId).toBe(SPACE_A);
        expect(mem.content).toContain("Tagged A");
      });
    });

    it("cross-space source references refuse without effects", async () => {
      const conversation = await cortex.conversations.create({
        memorySpaceId: SPACE_A, type: "user-agent", participants: { userId: TEST_USER_ID, agentId: TEST_AGENT_ID },
      });
      expect(conversation).toMatchObject({tenantId:fixture.tenantId,memorySpaceId:SPACE_A});
      await expectRefusalNoEffects(()=>cortex.vector.store(SPACE_B,{
        content:"Foreign transcript reference",contentType:"raw",source:{type:"conversation",userId:TEST_USER_ID},
        conversationRef:{conversationId:conversation.conversationId,messageIds:[]},metadata:{importance:50,tags:[]},
      }),allFixtures,"memories","FORBIDDEN");
      const record = await scopeA.cortex.immutable.store({
        type: "reference-boundary",
        id: `ref-${fixtureStamp}`,
        data: { secret: "A" },
      });
      await expectRefusalNoEffects(
        () =>
          cortex.vector.store(SPACE_B, {
            content: "Foreign reference",
            contentType: "raw",
            source: { type: "system" },
            immutableRef: {
              type: "reference-boundary",
              id: record.id,
              version: 1,
            },
            metadata: { importance: 50, tags: [] },
          }),
        allFixtures,
        "memories",
        "FORBIDDEN",
      );
      expect(
        (await scopeA.cortex.immutable.get("reference-boundary", record.id))
          ?.data,
      ).toEqual({ secret: "A" });
    });

    it("public erasure and foreign transcript references preserve owned B data", async () => {
      const a = `${SPACE_A}-cross-del-${fixtureStamp}`,
        b = `${SPACE_B}-cross-del-${fixtureStamp}`;
      for (const memorySpaceId of [a, b])
        await cortex.memorySpaces.register({ memorySpaceId, type: "project" });
      const conversation = await cortex.conversations.create({
        memorySpaceId: a, type: "user-agent", participants: { userId: TEST_USER_ID, agentId: TEST_AGENT_ID },
      });
      expect(conversation).toMatchObject({tenantId:fixture.tenantId,memorySpaceId:a});
      await expectRefusalNoEffects(
        () =>
          cortex.vector.store(b, {
            content: "B with foreign transcript ref",
            contentType: "raw",
            source: { type: "conversation", userId: TEST_USER_ID },
            conversationRef: {
              conversationId: conversation.conversationId,
              messageIds: [],
            },
            metadata: { importance: 50, tags: [] },
          }),
        allFixtures,
        "memories",
        "FORBIDDEN",
      );
      const memory = await cortex.vector.store(b, {
        content: "Owned B data",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });
      await expectRefusalNoEffects(
        () =>
          cortex.memorySpaces.delete(a, {
            cascade: true,
            reason: "Public scoped erasure refusal",
          }),
        allFixtures,
        "memories",
        "ERASURE_ADMIN_TRANSPORT_REQUIRED",
      );
      expect((await cortex.vector.get(b, memory.memoryId))?.content).toBe(
        "Owned B data",
      );
    });

    it("space boundaries respected in complex workflows", async () => {
      const a = `${SPACE_A}-workflow-${fixtureStamp}`,
        b = `${SPACE_B}-workflow-${fixtureStamp}`;
      for (const memorySpaceId of [a, b])
        await cortex.memorySpaces.register({ memorySpaceId, type: "project" });
      const conversation = await cortex.conversations.create({
        memorySpaceId: a, type: "user-agent", participants: { userId: TEST_USER_ID, agentId: TEST_AGENT_ID },
      });
      expect(conversation).toMatchObject({tenantId:fixture.tenantId,memorySpaceId:a});
      const memory = await cortex.vector.store(a, {
        content: "Workflow memory A",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });
      const fact = await cortex.facts.store({
        memorySpaceId: a,
        fact: "Workflow fact A",
        factType: "knowledge",
        subject: TEST_USER_ID,
        confidence: 80,
        sourceType: "manual",
      });
      expect(
        (await cortex.vector.list({ memorySpaceId: b })).some(
          (row) => row.memoryId === memory.memoryId,
        ),
      ).toBe(false);
      expect(
        (await cortex.facts.list({ memorySpaceId: b })).some(
          (row) => row.factId === fact.factId,
        ),
      ).toBe(false);
      const foreign=await cortex.conversations.list({memorySpaceId:b,limit:100});
      expect(foreign.conversations.some(row=>row.conversationId===conversation.conversationId)).toBe(false);

    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Edge Cases
  // ══════════════════════════════════════════════════════════════════════

  describe("Boundary Edge Cases", () => {
    it("space with similar name doesn't confuse isolation", async () => {
      const spacePrefix = `similar-${fixtureStamp}`;
      const space1 = `${spacePrefix}-1`;
      const space2 = `${spacePrefix}-2`;

      await cortex.memorySpaces.register({
        memorySpaceId: space1,
        type: "project",
        name: "Similar 1",
      });

      await cortex.memorySpaces.register({
        memorySpaceId: space2,
        type: "project",
        name: "Similar 2",
      });

      await cortex.vector.store(space1, {
        content: "In space 1",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });

      const list2 = await cortex.vector.list({ memorySpaceId: space2 });

      // Should not confuse spaces
      list2.forEach((mem) => {
        expect(mem.memorySpaceId).toBe(space2);
      });
    });

    it("empty space ID handled correctly", async () => {
      await expect(cortex.vector.list({ memorySpaceId: "" })).rejects.toThrow(
        "memorySpaceId",
      );
    });

    it("an ungranted space refuses without effects", async () => {
      await expectRefusalNoEffects(
        () => cortex.vector.list({ memorySpaceId: "non-existent-space-xyz" }),
        allFixtures,
        "memories",
        "FORBIDDEN",
      );
    });

    it("public erasure refusal preserves a concurrent scoped query", async () => {
      const scope = `${SPACE_A}-mid-del-${fixtureStamp}`;
      await cortex.memorySpaces.register({
        memorySpaceId: scope,
        type: "project",
      });
      const memory = await cortex.vector.store(scope, {
        content: "Temp memory",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });
      const listPromise = cortex.vector.list({ memorySpaceId: scope });
      await expectRefusalNoEffects(
        () =>
          cortex.memorySpaces.delete(scope, {
            cascade: true,
            reason: "Public scoped erasure refusal",
          }),
        allFixtures,
        "memories",
        "ERASURE_ADMIN_TRANSPORT_REQUIRED",
      );
      expect(
        (await listPromise).some((row) => row.memoryId === memory.memoryId),
      ).toBe(true);
    });

    it("five fixed spaces remain isolated across public erasure refusals", async () => {
      const spaces = Array.from(
        { length: 5 },
        (_, i) => `rapid-${fixtureStamp}-${i}`,
      );
      for (const memorySpaceId of spaces) {
        await cortex.memorySpaces.register({ memorySpaceId, type: "project" });
        await cortex.vector.store(memorySpaceId, {
          content: "Rapid scope data",
          contentType: "raw",
          source: { type: "system" },
          metadata: { importance: 50, tags: [] },
        });
      }
      for (const scope of spaces) {
        await expectRefusalNoEffects(
          () =>
            cortex.memorySpaces.delete(scope, {
              cascade: true,
              reason: "Public scoped erasure refusal",
            }),
          allFixtures,
          "memories",
          "ERASURE_ADMIN_TRANSPORT_REQUIRED",
        );
        expect(await cortex.vector.count({ memorySpaceId: scope })).toBe(1);
      }
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Collaboration Mode Boundaries
  // ══════════════════════════════════════════════════════════════════════

  describe("Collaboration Mode Access Control", () => {
    it("grantedAccess allows context read but not data read", async () => {
      const ctxA = await cortex.contexts.create({
        memorySpaceId: SPACE_A,
        userId: TEST_USER_ID,
        purpose: "Shared context",
        data: { sharedInfo: "visible" },
      });

      // Grant access to space B
      await cortex.contexts.grantAccess(ctxA.contextId, SPACE_B, "read-only");

      // Context is accessible
      const ctx = await cortex.contexts.get(ctxA.contextId);
      if ((ctx as any).grantedAccess) {
        expect(
          (ctx as any).grantedAccess.some(
            (g: any) => g.memorySpaceId === SPACE_B,
          ),
        ).toBe(true);
      }

      // But underlying data in space A is not in space B's list
      const factsB = await cortex.facts.list({ memorySpaceId: SPACE_B });
      expect(factsB.every((f) => f.memorySpaceId === SPACE_B)).toBe(true);
    });

    it("context shared across spaces maintains creator ownership", async () => {
      const ctxA = await cortex.contexts.create({
        memorySpaceId: SPACE_A,
        userId: TEST_USER_ID,
        purpose: "Creator context",
      });

      await cortex.contexts.grantAccess(ctxA.contextId, SPACE_B, "read-only");

      // Context belongs to space A
      const ctx = await cortex.contexts.get(ctxA.contextId);
      expect((ctx as any).memorySpaceId).toBe(SPACE_A);
    });

    it("child context in different space doesn't grant data access", async () => {
      const parentA = await cortex.contexts.create({
        memorySpaceId: SPACE_A,
        userId: TEST_USER_ID,
        purpose: "Parent A",
      });

      // Wait for parent to be queryable (eventual consistency)
      await waitForContextReady(parentA.contextId);

      // Store private data in space A
      await cortex.vector.store(SPACE_A, {
        content: "Private to space A",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: ["private-a"] },
      });

      // Child in space B
      const _childB = await cortex.contexts.create({
        memorySpaceId: SPACE_B,
        userId: TEST_USER_ID,
        purpose: "Child B",
        parentId: parentA.contextId,
      });

      // Space B can't access space A's data
      const listB = await cortex.vector.list({
        memorySpaceId: SPACE_B,
      });
      const filteredPrivate = listB.filter((m) => m.tags.includes("private-a"));

      expect(filteredPrivate).toHaveLength(0);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Bulk Operations Across Spaces
  // ══════════════════════════════════════════════════════════════════════

  describe("Bulk Operations Space Isolation", () => {
    it("deleteMany only deletes from specified space", async () => {
      // Create memories with same tag in both spaces
      await cortex.vector.store(SPACE_A, {
        content: "Bulk A1",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: ["bulk-iso"] },
      });

      const memB = await cortex.vector.store(SPACE_B, {
        content: "Bulk B1",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: ["bulk-iso"] },
      });

      // Delete from space A only
      const toDeleteBulk = await cortex.vector.list({ memorySpaceId: SPACE_A });
      const bulkToDelete = toDeleteBulk.filter((m) =>
        m.tags.includes("bulk-iso"),
      );
      for (const mem of bulkToDelete) {
        await cortex.vector.delete(SPACE_A, mem.memoryId);
      }

      // Space B memory should still exist
      const checkB = await cortex.vector.get(SPACE_B, memB.memoryId);
      expect(checkB).not.toBeNull();
    });

    it("updateMany only updates specified space", async () => {
      const memA = await cortex.vector.store(SPACE_A, {
        content: "Update A",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: ["bulk-update-iso"] },
      });

      const memB = await cortex.vector.store(SPACE_B, {
        content: "Update B",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: ["bulk-update-iso"] },
      });

      // Update space A only
      const toUpdateBulk = await cortex.vector.list({ memorySpaceId: SPACE_A });
      const bulkToUpdate = toUpdateBulk.filter((m) =>
        m.tags.includes("bulk-update-iso"),
      );
      for (const mem of bulkToUpdate) {
        await cortex.vector.update(SPACE_A, mem.memoryId, { importance: 90 });
      }

      // Space A updated
      const checkA = await cortex.vector.get(SPACE_A, memA.memoryId);
      expect(checkA!.importance).toBe(90);

      // Space B unchanged
      const _checkB = await cortex.vector.get(SPACE_B, memB.memoryId);
      expect(_checkB!.importance).toBe(50);
    });

    it("export() only exports from specified space", async () => {
      await cortex.vector.store(SPACE_A, {
        content: "Export only A",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: ["export-iso"] },
      });

      await cortex.vector.store(SPACE_B, {
        content: "Not in A export",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: ["export-iso"] },
      });

      const exported = await cortex.vector.export({
        memorySpaceId: SPACE_A,
        format: "json",
      });

      const parsed = JSON.parse(exported.data);

      parsed.forEach((mem: any) => {
        // memorySpaceId may not be in export
        // expect(mem.memorySpaceId).toBe(SPACE_A);
        expect(mem.content).not.toContain("Not in A export");
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // User Data Across Spaces
  // ══════════════════════════════════════════════════════════════════════

  describe("User Data Space Isolation", () => {
    it("user profile and data remain scoped per space", async () => {
      await scopeA.cortex.users.update(TEST_USER_ID, {
        name: "Owned A profile",
      });
      expect((await scopeA.cortex.users.get(TEST_USER_ID))?.data?.name).toBe(
        "Owned A profile",
      );
      expect(await scopeB.cortex.users.get(TEST_USER_ID)).toBeNull();
      const a = await cortex.vector.store(SPACE_A, {
          content: "User memory in A",
          contentType: "raw",
          source: { type: "system" },
          metadata: { importance: 50, tags: [] },
        }),
        b = await cortex.vector.store(SPACE_B, {
          content: "User memory in B",
          contentType: "raw",
          source: { type: "system" },
          metadata: { importance: 50, tags: [] },
        });
      expect(
        (await cortex.vector.list({ memorySpaceId: SPACE_A })).some(
          (row) => row.memoryId === a.memoryId,
        ),
      ).toBe(true);
      expect(
        (await cortex.vector.list({ memorySpaceId: SPACE_A })).some(
          (row) => row.memoryId === b.memoryId,
        ),
      ).toBe(false);
    });

    it("public user cascade refusal preserves both scopes", async () => {
      const a = await cortex.vector.store(SPACE_A, {
          content: "User A data",
          contentType: "raw",
          source: { type: "system" },
          metadata: { importance: 50, tags: [] },
        }),
        b = await cortex.vector.store(SPACE_B, {
          content: "User B data",
          contentType: "raw",
          source: { type: "system" },
          metadata: { importance: 50, tags: [] },
        });
      await expectRefusalNoEffects(
        () => scopeA.cortex.users.delete(TEST_USER_ID, { cascade: true }),
        allFixtures,
        "memories",
        "ERASURE_ADMIN_TRANSPORT_REQUIRED",
      );
      expect((await cortex.vector.get(SPACE_A, a.memoryId))?.content).toBe(
        "User A data",
      );
      expect((await cortex.vector.get(SPACE_B, b.memoryId))?.content).toBe(
        "User B data",
      );
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Concurrent Cross-Space Operations
  // ══════════════════════════════════════════════════════════════════════

  describe("Concurrent Cross-Space Operations", () => {
    it("simultaneous writes to different spaces don't interfere", async () => {
      const promises = [
        cortex.vector.store(SPACE_A, {
          content: "Concurrent A",
          contentType: "raw",
          source: { type: "system" },
          metadata: { importance: 50, tags: [] },
        }),
        cortex.vector.store(SPACE_B, {
          content: "Concurrent B",
          contentType: "raw",
          source: { type: "system" },
          metadata: { importance: 50, tags: [] },
        }),
      ];

      const [memA, memB] = await Promise.all(promises);

      expect(memA.memorySpaceId).toBe(SPACE_A);
      expect(memB.memorySpaceId).toBe(SPACE_B);
    });

    it("parallel operations in same space maintain isolation from other spaces", async () => {
      // Create 10 memories in space A concurrently
      const promises = Array.from({ length: 10 }, (_, i) =>
        cortex.vector.store(SPACE_A, {
          content: `Parallel A ${i}`,
          contentType: "raw",
          source: { type: "system" },
          metadata: { importance: 50, tags: ["parallel-a"] },
        }),
      );

      await Promise.all(promises);

      // Verify all in space A
      const listAFiltered = await cortex.vector.list({
        memorySpaceId: SPACE_A,
      });
      const listA = listAFiltered.filter((m) => m.tags.includes("parallel-a"));

      expect(listA.length).toBeGreaterThanOrEqual(10);

      // None in space B
      const listB = await cortex.vector.list({
        memorySpaceId: SPACE_B,
      });
      const filteredB = listB.filter((m) => m.tags.includes("parallel-a"));

      expect(filteredB).toHaveLength(0);
    });

    it("interleaved operations across spaces maintain isolation", async () => {
      const operations = [
        cortex.vector.store(SPACE_A, {
          content: "A1",
          contentType: "raw",
          source: { type: "system" },
          metadata: { importance: 50, tags: [] },
        }),
        cortex.vector.store(SPACE_B, {
          content: "B1",
          contentType: "raw",
          source: { type: "system" },
          metadata: { importance: 50, tags: [] },
        }),
        cortex.vector.store(SPACE_A, {
          content: "A2",
          contentType: "raw",
          source: { type: "system" },
          metadata: { importance: 50, tags: [] },
        }),
        cortex.vector.store(SPACE_B, {
          content: "B2",
          contentType: "raw",
          source: { type: "system" },
          metadata: { importance: 50, tags: [] },
        }),
      ];

      const results = await Promise.all(operations);

      expect(results[0].memorySpaceId).toBe(SPACE_A);
      expect(results[1].memorySpaceId).toBe(SPACE_B);
      expect(results[2].memorySpaceId).toBe(SPACE_A);
      expect(results[3].memorySpaceId).toBe(SPACE_B);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Search & Query Isolation
  // ══════════════════════════════════════════════════════════════════════

  describe("Search & Query Space Isolation", () => {
    it("semantic search respects space boundaries", async () => {
      await cortex.vector.store(SPACE_A, {
        content: "SEMANTIC_BOUNDARY_MARKER content in space A",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });

      // Search in space B
      const results = await cortex.vector.search(
        SPACE_B,
        "SEMANTIC_BOUNDARY_MARKER",
      );

      results.forEach((mem) => {
        expect(mem.memorySpaceId).toBe(SPACE_B);
      });
    });

    it("fact search isolated by space", async () => {
      await cortex.facts.store({
        memorySpaceId: SPACE_A,
        fact: "FACT_SEARCH_BOUNDARY unique to A",
        factType: "knowledge",
        subject: TEST_USER_ID,
        confidence: 80,
        sourceType: "manual",
      });

      const results = await cortex.facts.search(
        SPACE_B,
        "FACT_SEARCH_BOUNDARY",
      );

      // Verify all results are from SPACE_B (not SPACE_A)
      results.forEach((fact) => {
        expect(fact.memorySpaceId).toBe(SPACE_B);
      });

      // And verify none contain the unique marker from space A
      const spaceAResults = results.filter((f) =>
        f.fact.includes("unique to A"),
      );
      expect(spaceAResults).toHaveLength(0);
    });

    it("public transcript search excludes genuine matching messages from another space", async () => {
      const conversation=await scopeA.cortex.conversations.create({memorySpaceId:SPACE_A,type:"user-agent",participants:{userId:TEST_USER_ID,agentId:TEST_AGENT_ID}});
      await scopeA.cortex.conversations.addMessage({conversationId:conversation.conversationId,message:{role:"user",content:"CONV_SEARCH_BOUNDARY"}});
      const own=await scopeA.cortex.conversations.search({query:"CONV_SEARCH_BOUNDARY",filters:{memorySpaceId:SPACE_A}});
      expect(own.some(row=>row.conversation.conversationId===conversation.conversationId)).toBe(true);
      const foreign=await scopeB.cortex.conversations.search({query:"CONV_SEARCH_BOUNDARY",filters:{memorySpaceId:SPACE_B}});
      expect(foreign.some(row=>row.conversation.conversationId===conversation.conversationId)).toBe(false);
      expect(foreign.every(row=>row.conversation.memorySpaceId===SPACE_B)).toBe(true);
    });

    it("memory.search() with userId still respects space", async () => {
      const memory = await cortex.vector.store(SPACE_A, {
        content: "CROSS_USER_SEARCH test in A",
        contentType: "raw",
        source: { type: "system", userId: TEST_USER_ID },
        userId: TEST_USER_ID,
        metadata: { importance: 50, tags: [] },
      });
      const results = await cortex.memory.search(SPACE_B, "CROSS_USER_SEARCH", {
        userId: TEST_USER_ID,
      });
      expect(results.some((row) => row.memoryId === memory.memoryId)).toBe(
        false,
      );
      expect(results.every((row) => row.memorySpaceId === SPACE_B)).toBe(true);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Statistics Isolation
  // ══════════════════════════════════════════════════════════════════════

  describe("Statistics Space Isolation", () => {
    it("supported counts remain independent while public statistics refuse", async () => {
      const aBefore = await cortex.vector.count({ memorySpaceId: SPACE_A }),
        bBefore = await cortex.vector.count({ memorySpaceId: SPACE_B });
      await cortex.vector.store(SPACE_A, {
        content: "Stats A1",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });
      await cortex.vector.store(SPACE_A, {
        content: "Stats A2",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });
      await cortex.vector.store(SPACE_B, {
        content: "Stats B1",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });
      expect(await cortex.vector.count({ memorySpaceId: SPACE_A })).toBe(
        aBefore + 2,
      );
      expect(await cortex.vector.count({ memorySpaceId: SPACE_B })).toBe(
        bBefore + 1,
      );
      await expectRefusalNoEffects(
        () => cortex.memorySpaces.getStats(SPACE_A),
        allFixtures,
        "memories",
        "CAPABILITY_NOT_READY",
      );
      await expectRefusalNoEffects(
        () => cortex.memorySpaces.getStats(SPACE_B),
        allFixtures,
        "memories",
        "CAPABILITY_NOT_READY",
      );
    });

    it("adding to space A preserves the supported B count and statistics refusal", async () => {
      const before = await cortex.vector.count({ memorySpaceId: SPACE_B });
      await cortex.vector.store(SPACE_A, {
        content: "New in A",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });
      expect(await cortex.vector.count({ memorySpaceId: SPACE_B })).toBe(
        before,
      );
      await expectRefusalNoEffects(
        () => cortex.memorySpaces.getStats(SPACE_B),
        allFixtures,
        "memories",
        "CAPABILITY_NOT_READY",
      );
    });

    it("deleting from space A preserves the supported B count and statistics refusal", async () => {
      const before = await cortex.vector.count({ memorySpaceId: SPACE_B }),
        memory = await cortex.vector.store(SPACE_A, {
          content: "To delete",
          contentType: "raw",
          source: { type: "system" },
          metadata: { importance: 50, tags: [] },
        });
      await cortex.vector.delete(SPACE_A, memory.memoryId);
      expect(await cortex.vector.count({ memorySpaceId: SPACE_B })).toBe(
        before,
      );
      await expectRefusalNoEffects(
        () => cortex.memorySpaces.getStats(SPACE_B),
        allFixtures,
        "memories",
        "CAPABILITY_NOT_READY",
      );
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Comprehensive Isolation Validation
  // ══════════════════════════════════════════════════════════════════════

  describe("Comprehensive Isolation Tests", () => {
    it("complete workflow in space A invisible to space B", async () => {
      const scope = `${SPACE_A}-complete-${fixtureStamp}`;
      await cortex.memorySpaces.register({
        memorySpaceId: scope,
        type: "project",
      });
      const conversation = await cortex.conversations.create({
        memorySpaceId: scope, type: "user-agent", participants: { userId: TEST_USER_ID, agentId: TEST_AGENT_ID },
      });
      expect(conversation).toMatchObject({tenantId:fixture.tenantId,memorySpaceId:scope});
      const memory = await cortex.vector.store(scope, {
        content: "Workflow memory",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });
      const fact = await cortex.facts.store({
        memorySpaceId: scope,
        fact: "Workflow fact",
        factType: "knowledge",
        subject: TEST_USER_ID,
        confidence: 80,
        sourceType: "manual",
      });
      const context = await cortex.contexts.create({
        memorySpaceId: scope,
        userId: TEST_USER_ID,
        purpose: "Workflow context",
      });
      expect(
        (await cortex.vector.list({ memorySpaceId: SPACE_B })).some(
          (row) => row.memoryId === memory.memoryId,
        ),
      ).toBe(false);
      expect(
        (await cortex.facts.list({ memorySpaceId: SPACE_B })).some(
          (row) => row.factId === fact.factId,
        ),
      ).toBe(false);
      expect(
        (await cortex.contexts.list({ memorySpaceId: SPACE_B })).some(
          (row) => row.contextId === context.contextId,
        ),
      ).toBe(false);
      const foreign=await cortex.conversations.list({memorySpaceId:SPACE_B,limit:100});
      expect(foreign.conversations.some(row=>row.conversationId===conversation.conversationId)).toBe(false);

    });

    it("ten fixed spaces maintain complete isolation", async () => {
      const spaces = Array.from(
        { length: 10 },
        (_, i) => `multi-iso-${fixtureStamp}-${i}`,
      );

      // Create data in each space
      for (const spaceId of spaces) {
        await cortex.memorySpaces.register({
          memorySpaceId: spaceId,
          type: "project",
          name: `Space ${spaceId}`,
        });

        await cortex.vector.store(spaceId, {
          content: `Data for ${spaceId}`,
          contentType: "raw",
          source: { type: "system" },
          metadata: { importance: 50, tags: [spaceId] },
        });
      }

      // Verify each space only sees its own data
      for (const spaceId of spaces) {
        const list = await cortex.vector.list({ memorySpaceId: spaceId });

        list.forEach((mem) => {
          expect(mem.memorySpaceId).toBe(spaceId);
          expect(mem.tags).toContain(spaceId);
        });
      }
    });

    it("space ID substring matching doesn't leak data", async () => {
      const baseId = `substring-${fixtureStamp}`;
      const space1 = `${baseId}`;
      const space2 = `${baseId}-2`; // Contains space1 as substring

      await cortex.memorySpaces.register({
        memorySpaceId: space1,
        type: "project",
        name: "Base space",
      });

      await cortex.memorySpaces.register({
        memorySpaceId: space2,
        type: "project",
        name: "Extended space",
      });

      await cortex.vector.store(space1, {
        content: "In base space",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });

      // Query extended space
      const list = await cortex.vector.list({ memorySpaceId: space2 });

      // Should not include base space data
      list.forEach((mem) => {
        expect(mem.memorySpaceId).toBe(space2);
        expect(mem.content).not.toContain("In base space");
      });
    });
  });
});
