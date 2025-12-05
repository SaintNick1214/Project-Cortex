/**
 * E2E Tests: Memory Spaces Registry API
 *
 * Tests validate:
 * - Memory space registration and management
 * - Participant tracking
 * - Statistics and analytics
 * - Hive Mode scenarios
 *
 * PARALLEL-SAFE: Uses TestRunContext for isolated test data
 */

import { Cortex } from "../src";
import { ConvexClient } from "convex/browser";
import { api } from "../convex-dev/_generated/api";
import { createNamedTestRunContext, ScopedCleanup } from "./helpers";

describe("Memory Spaces Registry API", () => {
  // Create unique test run context for parallel-safe execution
  const ctx = createNamedTestRunContext("memspaces");

  let cortex: Cortex;
  let client: ConvexClient;
  let scopedCleanup: ScopedCleanup;
  const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";

  beforeAll(async () => {
    console.log(`\n🧪 Memory Spaces API Tests - Run ID: ${ctx.runId}\n`);

    cortex = new Cortex({ convexUrl: CONVEX_URL });
    client = new ConvexClient(CONVEX_URL);
    scopedCleanup = new ScopedCleanup(client, ctx);

    // Note: No global purge - test data is isolated by prefix
    console.log("✅ Test isolation setup complete\n");
  });

  afterAll(async () => {
    console.log(`\n🧹 Cleaning up test run ${ctx.runId}...`);
    await scopedCleanup.cleanupAll();
    await client.close();
    console.log(`✅ Test run ${ctx.runId} cleanup complete\n`);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Client-Side Validation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Client-Side Validation", () => {
    describe("register validation", () => {
      it("should throw on missing memorySpaceId", async () => {
        await expect(
          cortex.memorySpaces.register({
            memorySpaceId: "",
            type: "personal",
          } as any),
        ).rejects.toThrow("memorySpaceId");
      });

      it("should throw on invalid memorySpaceId format", async () => {
        await expect(
          cortex.memorySpaces.register({
            memorySpaceId: "space with spaces",
            type: "personal",
          }),
        ).rejects.toThrow("Invalid memorySpaceId format");
      });

      it("should throw on missing type", async () => {
        await expect(
          cortex.memorySpaces.register({
            memorySpaceId: "valid-id",
          } as any),
        ).rejects.toThrow("type is required");
      });

      it("should throw on invalid type", async () => {
        await expect(
          cortex.memorySpaces.register({
            memorySpaceId: "valid-id",
            type: "invalid" as any,
          }),
        ).rejects.toThrow("Invalid type");
      });

      it("should throw on empty participant id in array", async () => {
        await expect(
          cortex.memorySpaces.register({
            memorySpaceId: "valid-id",
            type: "personal",
            participants: [{ id: "", type: "user" }],
          }),
        ).rejects.toThrow("participant.id");
      });

      it("should throw on invalid participant structure", async () => {
        await expect(
          cortex.memorySpaces.register({
            memorySpaceId: "valid-id",
            type: "personal",
            participants: [{ id: "" }] as any,
          }),
        ).rejects.toThrow("participant");
      });

      it("should throw on duplicate participant IDs", async () => {
        await expect(
          cortex.memorySpaces.register({
            memorySpaceId: "valid-id",
            type: "personal",
            participants: [
              { id: "user-1", type: "user" },
              { id: "user-1", type: "agent" },
            ],
          }),
        ).rejects.toThrow("Duplicate participant");
      });

      it("should throw on invalid name length", async () => {
        await expect(
          cortex.memorySpaces.register({
            memorySpaceId: "valid-id",
            type: "personal",
            name: "a".repeat(300),
          }),
        ).rejects.toThrow("name");
      });
    });

    describe("get validation", () => {
      it("should throw on empty memorySpaceId", async () => {
        await expect(cortex.memorySpaces.get("")).rejects.toThrow(
          "memorySpaceId",
        );
      });

      it("should throw on whitespace memorySpaceId", async () => {
        await expect(cortex.memorySpaces.get("   ")).rejects.toThrow(
          "memorySpaceId",
        );
      });
    });

    describe("list validation", () => {
      it("should throw on invalid type", async () => {
        await expect(
          cortex.memorySpaces.list({ type: "invalid" as any }),
        ).rejects.toThrow("Invalid type");
      });

      it("should throw on invalid status", async () => {
        await expect(
          cortex.memorySpaces.list({ status: "deleted" as any }),
        ).rejects.toThrow("Invalid status");
      });

      it("should throw on invalid limit", async () => {
        await expect(cortex.memorySpaces.list({ limit: 0 })).rejects.toThrow(
          "limit",
        );
      });

      it("should throw on negative limit", async () => {
        await expect(cortex.memorySpaces.list({ limit: -10 })).rejects.toThrow(
          "limit",
        );
      });
    });

    describe("count validation", () => {
      it("should throw on invalid type", async () => {
        await expect(
          cortex.memorySpaces.count({ type: "PERSONAL" as any }),
        ).rejects.toThrow("Invalid type");
      });

      it("should throw on invalid status", async () => {
        await expect(
          cortex.memorySpaces.count({ status: "inactive" as any }),
        ).rejects.toThrow("Invalid status");
      });
    });

    describe("update validation", () => {
      it("should throw on empty memorySpaceId", async () => {
        await expect(
          cortex.memorySpaces.update("", { name: "Test" }),
        ).rejects.toThrow("memorySpaceId");
      });

      it("should throw on no updates provided", async () => {
        await expect(
          cortex.memorySpaces.update("valid-id", {}),
        ).rejects.toThrow("At least one");
      });

      it("should throw on invalid status", async () => {
        await expect(
          cortex.memorySpaces.update("valid-id", { status: "deleted" as any }),
        ).rejects.toThrow("Invalid status");
      });

      it("should throw on invalid name", async () => {
        await expect(
          cortex.memorySpaces.update("valid-id", { name: "   " }),
        ).rejects.toThrow("name");
      });
    });

    describe("addParticipant validation", () => {
      it("should throw on empty memorySpaceId", async () => {
        await expect(
          cortex.memorySpaces.addParticipant("", {
            id: "user-1",
            type: "user",
            joinedAt: Date.now(),
          }),
        ).rejects.toThrow("memorySpaceId");
      });

      it("should throw on missing participant.id", async () => {
        await expect(
          cortex.memorySpaces.addParticipant("valid-id", {
            type: "user",
            joinedAt: Date.now(),
          } as any),
        ).rejects.toThrow("participant.id");
      });

      it("should throw on missing participant.type", async () => {
        await expect(
          cortex.memorySpaces.addParticipant("valid-id", {
            id: "user-1",
            joinedAt: Date.now(),
          } as any),
        ).rejects.toThrow("participant.type");
      });

      it("should throw on invalid joinedAt", async () => {
        await expect(
          cortex.memorySpaces.addParticipant("valid-id", {
            id: "user-1",
            type: "user",
            joinedAt: -1,
          }),
        ).rejects.toThrow("joinedAt");
      });
    });

    describe("removeParticipant validation", () => {
      it("should throw on empty memorySpaceId", async () => {
        await expect(
          cortex.memorySpaces.removeParticipant("", "user-1"),
        ).rejects.toThrow("memorySpaceId");
      });

      it("should throw on empty participantId", async () => {
        await expect(
          cortex.memorySpaces.removeParticipant("valid-id", ""),
        ).rejects.toThrow("participantId");
      });

      it("should throw on whitespace participantId", async () => {
        await expect(
          cortex.memorySpaces.removeParticipant("valid-id", "   "),
        ).rejects.toThrow("participantId");
      });
    });

    describe("search validation", () => {
      it("should throw on empty query", async () => {
        await expect(cortex.memorySpaces.search("")).rejects.toThrow("query");
      });

      it("should throw on whitespace query", async () => {
        await expect(cortex.memorySpaces.search("   ")).rejects.toThrow(
          "query",
        );
      });

      it("should throw on invalid type filter", async () => {
        await expect(
          cortex.memorySpaces.search("test", { type: "invalid" as any }),
        ).rejects.toThrow("Invalid type");
      });

      it("should throw on invalid limit", async () => {
        await expect(
          cortex.memorySpaces.search("test", { limit: 0 }),
        ).rejects.toThrow("limit");
      });
    });

    describe("updateParticipants validation", () => {
      it("should throw on empty memorySpaceId", async () => {
        await expect(
          cortex.memorySpaces.updateParticipants("", {
            add: [{ id: "user-1", type: "user", joinedAt: Date.now() }],
          }),
        ).rejects.toThrow("memorySpaceId");
      });

      it("should throw when no updates provided", async () => {
        await expect(
          cortex.memorySpaces.updateParticipants("valid-id", {}),
        ).rejects.toThrow("At least one");
      });

      it("should throw on invalid add participants", async () => {
        await expect(
          cortex.memorySpaces.updateParticipants("valid-id", {
            add: [{ id: "", type: "user", joinedAt: Date.now() }],
          }),
        ).rejects.toThrow("participant");
      });

      it("should throw on empty participant ID to remove", async () => {
        await expect(
          cortex.memorySpaces.updateParticipants("valid-id", {
            remove: [""],
          }),
        ).rejects.toThrow("Participant ID");
      });
    });

    describe("archive, reactivate, delete, getStats validation", () => {
      it("should throw on empty memorySpaceId for archive", async () => {
        await expect(cortex.memorySpaces.archive("")).rejects.toThrow(
          "memorySpaceId",
        );
      });

      it("should throw on empty memorySpaceId for reactivate", async () => {
        await expect(cortex.memorySpaces.reactivate("")).rejects.toThrow(
          "memorySpaceId",
        );
      });

      it("should throw on empty memorySpaceId for delete", async () => {
        await expect(cortex.memorySpaces.delete("")).rejects.toThrow(
          "memorySpaceId",
        );
      });

      it("should throw on empty memorySpaceId for getStats", async () => {
        await expect(cortex.memorySpaces.getStats("")).rejects.toThrow(
          "memorySpaceId",
        );
      });
    });

    describe("findByParticipant validation", () => {
      it("should throw on empty participantId", async () => {
        await expect(cortex.memorySpaces.findByParticipant("")).rejects.toThrow(
          "participantId",
        );
      });

      it("should throw on whitespace participantId", async () => {
        await expect(
          cortex.memorySpaces.findByParticipant("   "),
        ).rejects.toThrow("participantId");
      });
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Backend Validation Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("register()", () => {
    // Note: Backend validation tests below
    // Client-side validation tests are in "Client-Side Validation" suite

    it("registers a personal memory space", async () => {
      // Use test-scoped IDs
      const personalSpaceId = ctx.memorySpaceId("alice-personal");
      const userAlice = ctx.userId("alice");
      const agentAssistant = ctx.agentId("assistant");

      const space = await cortex.memorySpaces.register({
        memorySpaceId: personalSpaceId,
        name: "Alice's Personal Space",
        type: "personal",
        participants: [
          { id: userAlice, type: "user" },
          { id: agentAssistant, type: "agent" },
        ],
        metadata: { tier: "premium" },
      });

      expect(space.memorySpaceId).toBe(personalSpaceId);
      expect(space.name).toBe("Alice's Personal Space");
      expect(space.type).toBe("personal");
      expect(space.participants).toHaveLength(2);
      expect(space.status).toBe("active");
    });

    it("registers a team memory space", async () => {
      // Use test-scoped IDs
      const teamSpaceId = ctx.memorySpaceId("team-engineering");
      const userBob = ctx.userId("bob");
      const userCharlie = ctx.userId("charlie");
      const agentCodeReview = ctx.agentId("code-review");

      const space = await cortex.memorySpaces.register({
        memorySpaceId: teamSpaceId,
        name: "Engineering Team",
        type: "team",
        participants: [
          { id: userBob, type: "user" },
          { id: userCharlie, type: "user" },
          { id: agentCodeReview, type: "agent" },
        ],
      });

      expect(space.type).toBe("team");
      expect(space.participants).toHaveLength(3);
    });

    it("registers a project memory space", async () => {
      // Use test-scoped IDs
      const projectSpaceId = ctx.memorySpaceId("project-q4");
      const userPM = ctx.userId("pm");
      const agentPlanner = ctx.agentId("planner");
      const toolAnalytics = `tool-analytics-${ctx.runId}`;

      const space = await cortex.memorySpaces.register({
        memorySpaceId: projectSpaceId,
        name: "Q4 Product Launch",
        type: "project",
        participants: [
          { id: userPM, type: "user" },
          { id: agentPlanner, type: "agent" },
          { id: toolAnalytics, type: "tool" },
        ],
        metadata: {
          deadline: "2025-12-31",
          budget: 50000,
          priority: "high",
        },
      });

      expect(space.type).toBe("project");
      expect(space.metadata.priority).toBe("high");
    });

    it("throws error for duplicate memorySpaceId", async () => {
      // Use test-scoped ID
      const duplicateSpaceId = ctx.memorySpaceId("duplicate-test");

      // Note: This tests BACKEND validation (existence check)
      await cortex.memorySpaces.register({
        memorySpaceId: duplicateSpaceId,
        type: "personal",
        participants: [],
      });

      await expect(
        cortex.memorySpaces.register({
          memorySpaceId: duplicateSpaceId,
          type: "team",
          participants: [],
        }),
      ).rejects.toThrow("MEMORYSPACE_ALREADY_EXISTS");
    });
  });

  describe("get()", () => {
    // Use test-scoped ID
    const getTestSpaceId = ctx.memorySpaceId("get-test");
    const testUser = ctx.userId("get-test");

    beforeAll(async () => {
      await cortex.memorySpaces.register({
        memorySpaceId: getTestSpaceId,
        name: "Test Space",
        type: "personal",
        participants: [{ id: testUser, type: "user" }],
      });
    });

    it("retrieves existing memory space", async () => {
      const space = await cortex.memorySpaces.get(getTestSpaceId);

      expect(space).not.toBeNull();
      expect(space!.memorySpaceId).toBe(getTestSpaceId);
      expect(space!.name).toBe("Test Space");
    });

    it("returns null for non-existent space", async () => {
      const space = await cortex.memorySpaces.get(`nonexistent-${ctx.runId}`);

      expect(space).toBeNull();
    });
  });

  describe("list()", () => {
    // Use test-scoped IDs
    const listPersonal1 = ctx.memorySpaceId("list-personal-1");
    const listTeam1 = ctx.memorySpaceId("list-team-1");
    const listProject1 = ctx.memorySpaceId("list-project-1");

    beforeAll(async () => {
      await cortex.memorySpaces.register({
        memorySpaceId: listPersonal1,
        type: "personal",
        participants: [],
      });

      await cortex.memorySpaces.register({
        memorySpaceId: listTeam1,
        type: "team",
        participants: [],
      });

      await cortex.memorySpaces.register({
        memorySpaceId: listProject1,
        type: "project",
        participants: [],
        metadata: {},
      });
    });

    it("lists all memory spaces", async () => {
      const spaces = await cortex.memorySpaces.list();

      expect(spaces.length).toBeGreaterThanOrEqual(3);
    });

    it("filters by type", async () => {
      const teams = await cortex.memorySpaces.list({ type: "team" });

      expect(teams.length).toBeGreaterThanOrEqual(1);
      teams.forEach((s) => {
        expect(s.type).toBe("team");
      });
    });

    it("filters by status", async () => {
      const active = await cortex.memorySpaces.list({ status: "active" });

      active.forEach((s) => {
        expect(s.status).toBe("active");
      });
    });

    it("respects limit parameter", async () => {
      const limited = await cortex.memorySpaces.list({ limit: 2 });

      expect(limited.length).toBeLessThanOrEqual(2);
    });
  });

  describe("count()", () => {
    it("counts all spaces", async () => {
      const count = await cortex.memorySpaces.count();

      expect(count).toBeGreaterThanOrEqual(3);
    });

    it("counts by type", async () => {
      const teamCount = await cortex.memorySpaces.count({ type: "team" });

      expect(teamCount).toBeGreaterThanOrEqual(1);
    });

    it("counts by status", async () => {
      const activeCount = await cortex.memorySpaces.count({ status: "active" });

      expect(activeCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe("update()", () => {
    // Use test-scoped ID
    const updateSpaceId = ctx.memorySpaceId("update-test");

    beforeAll(async () => {
      await cortex.memorySpaces.register({
        memorySpaceId: updateSpaceId,
        name: "Original Name",
        type: "personal",
        participants: [],
      });
    });

    it("updates name", async () => {
      const updated = await cortex.memorySpaces.update(updateSpaceId, {
        name: "Updated Name",
      });

      expect(updated.name).toBe("Updated Name");
    });

    it("updates metadata", async () => {
      const updated = await cortex.memorySpaces.update(updateSpaceId, {
        metadata: { tier: "enterprise", features: ["analytics"] },
      });

      expect(updated.metadata.tier).toBe("enterprise");
    });

    it("updates status", async () => {
      const updated = await cortex.memorySpaces.update(updateSpaceId, {
        status: "archived",
      });

      expect(updated.status).toBe("archived");
    });

    it("throws error for non-existent space", async () => {
      await expect(
        cortex.memorySpaces.update(`nonexistent-${ctx.runId}`, {
          name: "Test",
        }),
      ).rejects.toThrow("MEMORYSPACE_NOT_FOUND");
    });
  });

  describe("addParticipant()", () => {
    // Use test-scoped IDs
    const addParticipantSpaceId = ctx.memorySpaceId("add-participant-test");
    const user1 = ctx.userId("add-part-user-1");
    const agentHelper = ctx.agentId("helper");

    beforeAll(async () => {
      await cortex.memorySpaces.register({
        memorySpaceId: addParticipantSpaceId,
        type: "team",
        participants: [{ id: user1, type: "user" }],
      });
    });

    it("adds new participant", async () => {
      const updated = await cortex.memorySpaces.addParticipant(
        addParticipantSpaceId,
        {
          id: agentHelper,
          type: "agent",
          joinedAt: Date.now(),
        },
      );

      expect(updated.participants).toHaveLength(2);
      expect(updated.participants.some((p) => p.id === agentHelper)).toBe(true);
    });

    it("throws error for duplicate participant", async () => {
      await expect(
        cortex.memorySpaces.addParticipant(addParticipantSpaceId, {
          id: user1,
          type: "user",
          joinedAt: Date.now(),
        }),
      ).rejects.toThrow("PARTICIPANT_ALREADY_EXISTS");
    });
  });

  describe("removeParticipant()", () => {
    // Use test-scoped IDs
    const removeParticipantSpaceId = ctx.memorySpaceId("remove-participant");

    beforeAll(async () => {
      await cortex.memorySpaces.register({
        memorySpaceId: removeParticipantSpaceId,
        type: "team",
        participants: [
          { id: ctx.userId("remove-user-1"), type: "user" },
          { id: ctx.userId("remove-user-2"), type: "user" },
        ],
      });
    });

    it("removes participant", async () => {
      const updated = await cortex.memorySpaces.removeParticipant(
        removeParticipantSpaceId,
        ctx.userId("remove-user-2"),
      );

      expect(updated.participants).toHaveLength(1);
      expect(
        updated.participants.some((p) => p.id === ctx.userId("remove-user-2")),
      ).toBe(false);
    });
  });

  describe("delete()", () => {
    it("deletes empty space", async () => {
      // Use test-scoped ID to avoid parallel conflicts
      const deleteSpaceId = ctx.memorySpaceId("delete-empty");

      await cortex.memorySpaces.register({
        memorySpaceId: deleteSpaceId,
        type: "personal",
        participants: [],
      });

      const result = await cortex.memorySpaces.delete(deleteSpaceId);

      expect(result.deleted).toBe(true);
      expect(result.memorySpaceId).toBe(deleteSpaceId);

      // Verify deleted
      const space = await cortex.memorySpaces.get(deleteSpaceId);

      expect(space).toBeNull();
    });

    it("deletes space with cascade", async () => {
      // Use test-scoped ID to avoid parallel conflicts
      const cascadeSpaceId = ctx.memorySpaceId("delete-cascade");

      // Create space with data
      await cortex.memorySpaces.register({
        memorySpaceId: cascadeSpaceId,
        type: "team",
        participants: [],
      });

      // Add some data
      await cortex.conversations.create({
        memorySpaceId: cascadeSpaceId,
        type: "user-agent",
        participants: {
          userId: ctx.userId("cascade-test"),
          agentId: ctx.agentId("cascade-test"),
          participantId: ctx.agentId("cascade-test"),
        },
      });

      await cortex.facts.store({
        memorySpaceId: cascadeSpaceId,
        fact: `Test fact - ${ctx.runId}`,
        factType: "knowledge",
        confidence: 90,
        sourceType: "system",
        tags: [ctx.runId],
      });

      // Delete with cascade
      const result = await cortex.memorySpaces.delete(cascadeSpaceId, {
        cascade: true,
      });

      expect(result.deleted).toBe(true);
      expect(result.cascaded).toBe(true);
    });
  });

  describe("getStats()", () => {
    // Use test-scoped IDs to avoid parallel conflicts
    const statsSpaceId = ctx.memorySpaceId("stats");
    const statsUser1 = ctx.userId("stats-1");
    const statsUser2 = ctx.userId("stats-2");
    const statsAgent = ctx.agentId("stats");

    beforeAll(async () => {
      await cortex.memorySpaces.register({
        memorySpaceId: statsSpaceId,
        type: "team",
        participants: [
          { id: statsUser1, type: "user" },
          { id: statsUser2, type: "user" },
        ],
      });

      // Add some data
      await cortex.conversations.create({
        memorySpaceId: statsSpaceId,
        type: "user-agent",
        participants: { userId: statsUser1, participantId: statsAgent },
      });

      await cortex.conversations.addMessage({
        conversationId: (
          await cortex.conversations.list({
            memorySpaceId: statsSpaceId,
          })
        )[0].conversationId,
        message: { role: "user", content: "Test message" },
      });

      await cortex.vector.store(statsSpaceId, {
        content: "Test memory",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });

      await cortex.facts.store({
        memorySpaceId: statsSpaceId,
        fact: `Test fact - ${ctx.runId}`,
        factType: "knowledge",
        confidence: 90,
        sourceType: "system",
        tags: [ctx.runId],
      });
    });

    it("returns comprehensive statistics", async () => {
      const stats = await cortex.memorySpaces.getStats(statsSpaceId);

      expect(stats.memorySpaceId).toBe(statsSpaceId);
      expect(stats.totalConversations).toBeGreaterThanOrEqual(1);
      expect(stats.totalMessages).toBeGreaterThanOrEqual(1);
      expect(stats.totalMemories).toBeGreaterThanOrEqual(1);
      expect(stats.totalFacts).toBeGreaterThanOrEqual(1);
    });

    it("throws error for non-existent space", async () => {
      await expect(
        cortex.memorySpaces.getStats(`nonexistent-${ctx.runId}`),
      ).rejects.toThrow("MEMORYSPACE_NOT_FOUND");
    });
  });

  describe("findByParticipant()", () => {
    // Use test-scoped IDs to avoid parallel conflicts
    const searchSpace1 = ctx.memorySpaceId("search-1");
    const searchSpace2 = ctx.memorySpaceId("search-2");
    const searchSpace3 = ctx.memorySpaceId("search-3");
    const userDavid = ctx.userId("david");
    const userEve = ctx.userId("eve");

    beforeAll(async () => {
      // Create test spaces, ignore if they already exist
      try {
        await cortex.memorySpaces.register({
          memorySpaceId: searchSpace1,
          type: "personal",
          participants: [{ id: userDavid, type: "user" }],
        });
      } catch (_error) {
        // Already exists, that's fine
      }

      try {
        await cortex.memorySpaces.register({
          memorySpaceId: searchSpace2,
          type: "team",
          participants: [
            { id: userDavid, type: "user" },
            { id: userEve, type: "user" },
          ],
        });
      } catch (_error) {
        // Already exists, that's fine
      }

      try {
        await cortex.memorySpaces.register({
          memorySpaceId: searchSpace3,
          type: "project",
          participants: [{ id: userEve, type: "user" }],
        });
      } catch (_error) {
        // Already exists, that's fine
      }
    });

    it("finds all spaces for a participant", async () => {
      const spaces = await cortex.memorySpaces.findByParticipant(userDavid);

      expect(spaces.length).toBeGreaterThanOrEqual(2);
      spaces.forEach((s) => {
        expect(s.participants.some((p) => p.id === userDavid)).toBe(true);
      });
    });

    it("returns empty for participant not in any space", async () => {
      const spaces = await cortex.memorySpaces.findByParticipant(
        `user-nobody-${ctx.runId}`,
      );

      expect(spaces.length).toBe(0);
    });
  });

  describe("Hive Mode Scenarios", () => {
    it("supports multiple tools sharing one space", async () => {
      // Use test-scoped IDs
      const hiveSpaceId = ctx.memorySpaceId("hive-multitools");
      const userOwner = ctx.userId("owner");
      const toolCalendar = `tool-calendar-${ctx.runId}`;
      const toolEmail = `tool-email-${ctx.runId}`;
      const toolTasks = `tool-tasks-${ctx.runId}`;
      const agentCoordinator = ctx.agentId("coordinator");

      const hiveSpace = await cortex.memorySpaces.register({
        memorySpaceId: hiveSpaceId,
        name: "Multi-Tool Hive",
        type: "team",
        participants: [
          { id: userOwner, type: "user" },
          { id: toolCalendar, type: "tool" },
          { id: toolEmail, type: "tool" },
          { id: toolTasks, type: "tool" },
          { id: agentCoordinator, type: "agent" },
        ],
      });

      expect(hiveSpace.participants).toHaveLength(5);

      // All tools can contribute to same space
      // First create a conversation
      const conv = await cortex.conversations.create({
        memorySpaceId: hiveSpaceId,
        type: "user-agent",
        participants: { userId: userOwner, participantId: toolCalendar },
      });

      await cortex.memory.remember({
        memorySpaceId: hiveSpaceId,
        participantId: toolCalendar,
        conversationId: conv.conversationId,
        userMessage: "Meeting scheduled for Monday",
        agentResponse: "Added to calendar",
        userId: userOwner,
        userName: "Owner",
        agentId: agentCoordinator,
      });

      await cortex.facts.store({
        memorySpaceId: hiveSpaceId,
        participantId: toolTasks,
        fact: `User prefers morning meetings - ${ctx.runId}`,
        factType: "preference",
        confidence: 90,
        sourceType: "tool",
        tags: ["meetings", ctx.runId],
      });

      // Verify all in same space
      const stats = await cortex.memorySpaces.getStats(hiveSpaceId);

      expect(stats.totalMemories).toBeGreaterThanOrEqual(2);
      expect(stats.totalFacts).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Storage Validation", () => {
    it("validates memory space structure in database", async () => {
      // Use test-scoped IDs
      const validationSpaceId = ctx.memorySpaceId("validation");
      const userVal = ctx.userId("val");
      const agentVal = ctx.agentId("val");

      const _space = await cortex.memorySpaces.register({
        memorySpaceId: validationSpaceId,
        name: "Validation Test",
        type: "custom",
        participants: [
          { id: userVal, type: "user" },
          { id: agentVal, type: "agent" },
        ],
        metadata: { custom: "data" },
      });

      // Direct database query
      const stored = await client.query(api.memorySpaces.get, {
        memorySpaceId: validationSpaceId,
      });

      expect(stored).not.toBeNull();
      expect(stored!.memorySpaceId).toBe(validationSpaceId);
      expect(stored!.participants).toHaveLength(2);
      expect(stored!.status).toBe("active");
      expect(stored!.createdAt).toBeGreaterThan(0);
    });
  });

  describe("Lifecycle Management", () => {
    it("creates -> updates -> archives -> deletes", async () => {
      // Use test-scoped IDs
      const lifecycleSpaceId = ctx.memorySpaceId("lifecycle");
      const lifecycleUser = ctx.userId("lifecycle");

      // Create
      const space = await cortex.memorySpaces.register({
        memorySpaceId: lifecycleSpaceId,
        name: "Lifecycle Test",
        type: "project",
        participants: [{ id: lifecycleUser, type: "user" }],
      });

      expect(space.status).toBe("active");

      // Update
      const updated = await cortex.memorySpaces.update(lifecycleSpaceId, {
        name: "Updated Lifecycle",
        metadata: { phase: "development" },
      });

      expect(updated.name).toBe("Updated Lifecycle");

      // Archive
      const archived = await cortex.memorySpaces.update(lifecycleSpaceId, {
        status: "archived",
      });

      expect(archived.status).toBe("archived");

      // Delete
      const result = await cortex.memorySpaces.delete(lifecycleSpaceId);

      expect(result.deleted).toBe(true);

      // Verify deleted
      const deleted = await cortex.memorySpaces.get(lifecycleSpaceId);

      expect(deleted).toBeNull();
    });
  });

  describe("New API Methods", () => {
    describe("search()", () => {
      // Use test-scoped IDs to avoid parallel conflicts
      const engineeringSpace = ctx.memorySpaceId("engineering-team");
      const designSpace = ctx.memorySpaceId("design-team");
      const aliceSpace = ctx.memorySpaceId("alice-personal");
      // Use unique searchable terms scoped to this run
      const projectTag = `apollo-${ctx.runId}`;
      const searchTerm = ctx.runId; // Use runId as a unique searchable term

      beforeEach(async () => {
        // Clean up any existing test memory spaces first
        try {
          await cortex.memorySpaces.delete(engineeringSpace);
        } catch (_error) {
          // Ignore if doesn't exist
        }
        try {
          await cortex.memorySpaces.delete(designSpace);
        } catch (_error) {
          // Ignore if doesn't exist
        }
        try {
          await cortex.memorySpaces.delete(aliceSpace);
        } catch (_error) {
          // Ignore if doesn't exist
        }

        // Now register fresh test spaces with unique searchable content
        await cortex.memorySpaces.register({
          memorySpaceId: engineeringSpace,
          name: `Engineering Team ${searchTerm}`,
          type: "team",
          metadata: { department: "engineering", project: projectTag },
        });

        await cortex.memorySpaces.register({
          memorySpaceId: designSpace,
          name: `Design Team ${searchTerm}`,
          type: "team",
          metadata: { department: "design" },
        });

        await cortex.memorySpaces.register({
          memorySpaceId: aliceSpace,
          name: `Alice Personal ${searchTerm}`,
          type: "personal",
          metadata: { owner: "alice" },
        });
      });

      afterEach(async () => {
        // Clean up test memory spaces
        try {
          await cortex.memorySpaces.delete(engineeringSpace);
        } catch (_error) {
          // Ignore if doesn't exist
        }
        try {
          await cortex.memorySpaces.delete(designSpace);
        } catch (_error) {
          // Ignore if doesn't exist
        }
        try {
          await cortex.memorySpaces.delete(aliceSpace);
        } catch (_error) {
          // Ignore if doesn't exist
        }
      });

      it("searches by name", async () => {
        // Search using our unique searchTerm
        const results = await cortex.memorySpaces.search(searchTerm);

        expect(results.length).toBeGreaterThan(0);
        expect(results.some((s) => s.name?.includes(searchTerm))).toBe(true);
      });

      it("searches by memorySpaceId", async () => {
        // Search using a portion of the memorySpaceId which contains runId
        const results = await cortex.memorySpaces.search(ctx.runId);

        expect(results.length).toBeGreaterThan(0);
        expect(results.some((s) => s.memorySpaceId.includes(ctx.runId))).toBe(
          true,
        );
      });

      it("searches by metadata", async () => {
        const results = await cortex.memorySpaces.search(projectTag);

        expect(results.length).toBeGreaterThan(0);
        expect(results.some((s) => s.metadata?.project === projectTag)).toBe(
          true,
        );
      });

      it("filters by type", async () => {
        // Search with our unique term and filter by type
        const results = await cortex.memorySpaces.search(searchTerm, {
          type: "team",
        });

        // Should find at least our 2 test spaces
        expect(results.length).toBeGreaterThanOrEqual(2);

        // All results should be team type
        for (const space of results) {
          expect(space.type).toBe("team");
        }

        // Verify our test spaces are included
        const spaceIds = results.map((s) => s.memorySpaceId);
        expect(spaceIds).toContain(engineeringSpace);
        expect(spaceIds).toContain(designSpace);
      });

      it("filters by status", async () => {
        await cortex.memorySpaces.archive(designSpace);

        // Search with unique term so we only get our test spaces
        const activeResults = await cortex.memorySpaces.search(searchTerm, {
          status: "active",
        });
        const archivedResults = await cortex.memorySpaces.search(searchTerm, {
          status: "archived",
        });

        expect(activeResults.some((s) => s.memorySpaceId === designSpace)).toBe(
          false,
        );
        expect(
          archivedResults.some((s) => s.memorySpaceId === designSpace),
        ).toBe(true);
      });

      it("limits results", async () => {
        const results = await cortex.memorySpaces.search(searchTerm, {
          limit: 2,
        });

        expect(results.length).toBeLessThanOrEqual(2);
      });
    });

    describe("updateParticipants()", () => {
      // Use test-scoped IDs
      const participantTestSpace = ctx.memorySpaceId("participant-test");
      const user1 = ctx.userId("p-user-1");
      const agent1 = ctx.agentId("p-agent-1");
      const tool1 = `tool-${ctx.runId}-1`;

      beforeEach(async () => {
        // Cleanup any existing participant-test space
        try {
          await cortex.memorySpaces.delete(participantTestSpace);
        } catch (_error) {
          // Doesn't exist, continue
        }
      });

      it("adds participants", async () => {
        await cortex.memorySpaces.register({
          memorySpaceId: participantTestSpace,
          type: "team",
          participants: [{ id: user1, type: "user" }] as any,
        });

        const now = Date.now();
        await cortex.memorySpaces.updateParticipants(participantTestSpace, {
          add: [
            { id: agent1, type: "agent", joinedAt: now },
            { id: tool1, type: "tool", joinedAt: now },
          ],
        });

        const updated = await cortex.memorySpaces.get(participantTestSpace);

        expect(updated?.participants).toHaveLength(3);
        expect(updated?.participants.some((p) => p.id === agent1)).toBe(true);
        expect(updated?.participants.some((p) => p.id === tool1)).toBe(true);
      });

      it("removes participants", async () => {
        await cortex.memorySpaces.register({
          memorySpaceId: participantTestSpace,
          type: "team",
          participants: [
            { id: user1, type: "user" },
            { id: agent1, type: "agent" },
            { id: tool1, type: "tool" },
          ] as any,
        });

        await cortex.memorySpaces.updateParticipants(participantTestSpace, {
          remove: [agent1, tool1],
        });

        const updated = await cortex.memorySpaces.get(participantTestSpace);

        expect(updated?.participants).toHaveLength(1);
        expect(updated?.participants[0].id).toBe(user1);
      });

      it("adds and removes in one call", async () => {
        const oldAgent = ctx.agentId("old-agent");
        const newAgent = ctx.agentId("new-agent");

        await cortex.memorySpaces.register({
          memorySpaceId: participantTestSpace,
          type: "team",
          participants: [{ id: oldAgent, type: "agent" }] as any,
        });

        const now = Date.now();
        await cortex.memorySpaces.updateParticipants(participantTestSpace, {
          add: [{ id: newAgent, type: "agent", joinedAt: now }],
          remove: [oldAgent],
        });

        const updated = await cortex.memorySpaces.get(participantTestSpace);

        expect(updated?.participants).toHaveLength(1);
        expect(updated?.participants[0].id).toBe(newAgent);
      });

      it("prevents duplicate participants", async () => {
        const dupAgent1 = ctx.agentId("dup-agent-1");
        const dupAgent2 = ctx.agentId("dup-agent-2");

        await cortex.memorySpaces.register({
          memorySpaceId: participantTestSpace,
          type: "team",
          participants: [{ id: dupAgent1, type: "agent" }] as any,
        });

        const now = Date.now();
        await cortex.memorySpaces.updateParticipants(participantTestSpace, {
          add: [
            { id: dupAgent1, type: "agent", joinedAt: now }, // Duplicate
            { id: dupAgent2, type: "agent", joinedAt: now },
          ],
        });

        const updated = await cortex.memorySpaces.get(participantTestSpace);

        expect(updated?.participants).toHaveLength(2);
      });
    });
  });
});
