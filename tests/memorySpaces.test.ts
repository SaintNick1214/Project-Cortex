/**
 * E2E Tests: Memory Spaces Registry API
 *
 * Tests validate:
 * - Memory space registration and management
 * - Participant tracking
 * - Statistics and analytics
 * - Hive Mode scenarios
 */

import { Cortex } from "../src";
import { ConvexClient } from "convex/browser";
import { api } from "../convex-dev/_generated/api";
import { TestCleanup } from "./helpers";

describe("Memory Spaces Registry API", () => {
  let cortex: Cortex;
  let client: ConvexClient;
  let cleanup: TestCleanup;
  const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";

  beforeAll(async () => {
    cortex = new Cortex({ convexUrl: CONVEX_URL });
    client = new ConvexClient(CONVEX_URL);
    cleanup = new TestCleanup(client);

    await cleanup.purgeAll();
  });

  afterAll(async () => {
    await cleanup.purgeAll();
    await client.close();
  });

  describe("register()", () => {
    it("registers a personal memory space", async () => {
      const space = await cortex.memorySpaces.register({
        memorySpaceId: "user-alice-personal",
        name: "Alice's Personal Space",
        type: "personal",
        participants: [
          { id: "user-alice", type: "user" },
          { id: "agent-assistant", type: "agent" },
        ],
        metadata: { tier: "premium" },
      });

      expect(space.memorySpaceId).toBe("user-alice-personal");
      expect(space.name).toBe("Alice's Personal Space");
      expect(space.type).toBe("personal");
      expect(space.participants).toHaveLength(2);
      expect(space.status).toBe("active");
    });

    it("registers a team memory space", async () => {
      const space = await cortex.memorySpaces.register({
        memorySpaceId: "team-engineering",
        name: "Engineering Team",
        type: "team",
        participants: [
          { id: "user-bob", type: "user" },
          { id: "user-charlie", type: "user" },
          { id: "agent-code-review", type: "agent" },
        ],
      });

      expect(space.type).toBe("team");
      expect(space.participants).toHaveLength(3);
    });

    it("registers a project memory space", async () => {
      const space = await cortex.memorySpaces.register({
        memorySpaceId: "project-q4-launch",
        name: "Q4 Product Launch",
        type: "project",
        participants: [
          { id: "user-pm", type: "user" },
          { id: "agent-planner", type: "agent" },
          { id: "tool-analytics", type: "tool" },
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
      await cortex.memorySpaces.register({
        memorySpaceId: "duplicate-test",
        type: "personal",
        participants: [],
      });

      await expect(
        cortex.memorySpaces.register({
          memorySpaceId: "duplicate-test",
          type: "team",
          participants: [],
        }),
      ).rejects.toThrow("MEMORYSPACE_ALREADY_EXISTS");
    });
  });

  describe("get()", () => {
    beforeAll(async () => {
      await cortex.memorySpaces.register({
        memorySpaceId: "get-test-space",
        name: "Test Space",
        type: "personal",
        participants: [{ id: "user-test", type: "user" }],
      });
    });

    it("retrieves existing memory space", async () => {
      const space = await cortex.memorySpaces.get("get-test-space");

      expect(space).not.toBeNull();
      expect(space!.memorySpaceId).toBe("get-test-space");
      expect(space!.name).toBe("Test Space");
    });

    it("returns null for non-existent space", async () => {
      const space = await cortex.memorySpaces.get("does-not-exist");

      expect(space).toBeNull();
    });
  });

  describe("list()", () => {
    beforeAll(async () => {
      await cortex.memorySpaces.register({
        memorySpaceId: "list-personal-1",
        type: "personal",
        participants: [],
      });

      await cortex.memorySpaces.register({
        memorySpaceId: "list-team-1",
        type: "team",
        participants: [],
      });

      await cortex.memorySpaces.register({
        memorySpaceId: "list-project-1",
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
    beforeAll(async () => {
      await cortex.memorySpaces.register({
        memorySpaceId: "update-test-space",
        name: "Original Name",
        type: "personal",
        participants: [],
      });
    });

    it("updates name", async () => {
      const updated = await cortex.memorySpaces.update("update-test-space", {
        name: "Updated Name",
      });

      expect(updated.name).toBe("Updated Name");
    });

    it("updates metadata", async () => {
      const updated = await cortex.memorySpaces.update("update-test-space", {
        metadata: { tier: "enterprise", features: ["analytics"] },
      });

      expect(updated.metadata.tier).toBe("enterprise");
    });

    it("updates status", async () => {
      const updated = await cortex.memorySpaces.update("update-test-space", {
        status: "archived",
      });

      expect(updated.status).toBe("archived");
    });

    it("throws error for non-existent space", async () => {
      await expect(
        cortex.memorySpaces.update("does-not-exist", { name: "Test" }),
      ).rejects.toThrow("MEMORYSPACE_NOT_FOUND");
    });
  });

  describe("addParticipant()", () => {
    beforeAll(async () => {
      await cortex.memorySpaces.register({
        memorySpaceId: "participant-test-space",
        type: "team",
        participants: [{ id: "user-1", type: "user" }],
      });
    });

    it("adds new participant", async () => {
      const updated = await cortex.memorySpaces.addParticipant(
        "participant-test-space",
        {
          id: "agent-helper",
          type: "agent",
          joinedAt: Date.now(),
        },
      );

      expect(updated.participants).toHaveLength(2);
      expect(updated.participants.some((p) => p.id === "agent-helper")).toBe(
        true,
      );
    });

    it("throws error for duplicate participant", async () => {
      await expect(
        cortex.memorySpaces.addParticipant("participant-test-space", {
          id: "user-1",
          type: "user",
          joinedAt: Date.now(),
        }),
      ).rejects.toThrow("PARTICIPANT_ALREADY_EXISTS");
    });
  });

  describe("removeParticipant()", () => {
    beforeAll(async () => {
      await cortex.memorySpaces.register({
        memorySpaceId: "remove-participant-space",
        type: "team",
        participants: [
          { id: "user-1", type: "user" },
          { id: "user-2", type: "user" },
        ],
      });
    });

    it("removes participant", async () => {
      const updated = await cortex.memorySpaces.removeParticipant(
        "remove-participant-space",
        "user-2",
      );

      expect(updated.participants).toHaveLength(1);
      expect(updated.participants.some((p) => p.id === "user-2")).toBe(false);
    });
  });

  describe("delete()", () => {
    it("deletes empty space", async () => {
      await cortex.memorySpaces.register({
        memorySpaceId: "delete-test-space",
        type: "personal",
        participants: [],
      });

      const result = await cortex.memorySpaces.delete("delete-test-space");

      expect(result.deleted).toBe(true);
      expect(result.memorySpaceId).toBe("delete-test-space");

      // Verify deleted
      const space = await cortex.memorySpaces.get("delete-test-space");

      expect(space).toBeNull();
    });

    it("deletes space with cascade", async () => {
      // Create space with data
      await cortex.memorySpaces.register({
        memorySpaceId: "cascade-test-space",
        type: "team",
        participants: [],
      });

      // Add some data
      await cortex.conversations.create({
        memorySpaceId: "cascade-test-space",
        type: "user-agent",
        participants: { userId: "user-test", participantId: "agent-test" },
      });

      await cortex.facts.store({
        memorySpaceId: "cascade-test-space",
        fact: "Test fact",
        factType: "knowledge",
        confidence: 90,
        sourceType: "system",
        tags: ["test"],
      });

      // Delete with cascade
      const result = await cortex.memorySpaces.delete("cascade-test-space", {
        cascade: true,
      });

      expect(result.deleted).toBe(true);
      expect(result.cascaded).toBe(true);
    });
  });

  describe("getStats()", () => {
    beforeAll(async () => {
      await cortex.memorySpaces.register({
        memorySpaceId: "stats-test-space",
        type: "team",
        participants: [
          { id: "user-1", type: "user" },
          { id: "user-2", type: "user" },
        ],
      });

      // Add some data
      await cortex.conversations.create({
        memorySpaceId: "stats-test-space",
        type: "user-agent",
        participants: { userId: "user-1", participantId: "agent-1" },
      });

      await cortex.conversations.addMessage({
        conversationId: (
          await cortex.conversations.list({
            memorySpaceId: "stats-test-space",
          })
        )[0].conversationId,
        message: { role: "user", content: "Test message" },
      });

      await cortex.vector.store("stats-test-space", {
        content: "Test memory",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });

      await cortex.facts.store({
        memorySpaceId: "stats-test-space",
        fact: "Test fact",
        factType: "knowledge",
        confidence: 90,
        sourceType: "system",
        tags: ["test"],
      });
    });

    it("returns comprehensive statistics", async () => {
      const stats = await cortex.memorySpaces.getStats("stats-test-space");

      expect(stats.memorySpaceId).toBe("stats-test-space");
      expect(stats.totalConversations).toBeGreaterThanOrEqual(1);
      expect(stats.totalMessages).toBeGreaterThanOrEqual(1);
      expect(stats.totalMemories).toBeGreaterThanOrEqual(1);
      expect(stats.totalFacts).toBeGreaterThanOrEqual(1);
    });

    it("throws error for non-existent space", async () => {
      await expect(
        cortex.memorySpaces.getStats("does-not-exist"),
      ).rejects.toThrow("MEMORYSPACE_NOT_FOUND");
    });
  });

  describe("findByParticipant()", () => {
    beforeAll(async () => {
      // Create test spaces, ignore if they already exist
      try {
        await cortex.memorySpaces.register({
          memorySpaceId: "participant-search-1",
          type: "personal",
          participants: [{ id: "user-david", type: "user" }],
        });
      } catch (_error) {
        // Already exists, that's fine
      }

      try {
        await cortex.memorySpaces.register({
          memorySpaceId: "participant-search-2",
          type: "team",
          participants: [
            { id: "user-david", type: "user" },
            { id: "user-eve", type: "user" },
          ],
        });
      } catch (_error) {
        // Already exists, that's fine
      }

      try {
        await cortex.memorySpaces.register({
          memorySpaceId: "participant-search-3",
          type: "project",
          participants: [{ id: "user-eve", type: "user" }],
        });
      } catch (_error) {
        // Already exists, that's fine
      }
    });

    it("finds all spaces for a participant", async () => {
      const spaces = await cortex.memorySpaces.findByParticipant("user-david");

      expect(spaces.length).toBeGreaterThanOrEqual(2);
      spaces.forEach((s) => {
        expect(s.participants.some((p) => p.id === "user-david")).toBe(true);
      });
    });

    it("returns empty for participant not in any space", async () => {
      const spaces = await cortex.memorySpaces.findByParticipant("user-nobody");

      expect(spaces.length).toBe(0);
    });
  });

  describe("Hive Mode Scenarios", () => {
    it("supports multiple tools sharing one space", async () => {
      const hiveSpace = await cortex.memorySpaces.register({
        memorySpaceId: "hive-multitools",
        name: "Multi-Tool Hive",
        type: "team",
        participants: [
          { id: "user-owner", type: "user" },
          { id: "tool-calendar", type: "tool" },
          { id: "tool-email", type: "tool" },
          { id: "tool-tasks", type: "tool" },
          { id: "agent-coordinator", type: "agent" },
        ],
      });

      expect(hiveSpace.participants).toHaveLength(5);

      // All tools can contribute to same space
      // First create a conversation
      const conv = await cortex.conversations.create({
        memorySpaceId: "hive-multitools",
        type: "user-agent",
        participants: { userId: "user-owner", participantId: "tool-calendar" },
      });

      await cortex.memory.remember({
        memorySpaceId: "hive-multitools",
        participantId: "tool-calendar",
        conversationId: conv.conversationId,
        userMessage: "Meeting scheduled for Monday",
        agentResponse: "Added to calendar",
        userId: "user-owner",
        userName: "Owner",
      });

      await cortex.facts.store({
        memorySpaceId: "hive-multitools",
        participantId: "tool-tasks",
        fact: "User prefers morning meetings",
        factType: "preference",
        confidence: 90,
        sourceType: "tool",
        tags: ["meetings"],
      });

      // Verify all in same space
      const stats = await cortex.memorySpaces.getStats("hive-multitools");

      expect(stats.totalMemories).toBeGreaterThanOrEqual(2);
      expect(stats.totalFacts).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Storage Validation", () => {
    it("validates memory space structure in database", async () => {
      const _space = await cortex.memorySpaces.register({
        memorySpaceId: "validation-space",
        name: "Validation Test",
        type: "custom",
        participants: [
          { id: "user-val", type: "user" },
          { id: "agent-val", type: "agent" },
        ],
        metadata: { custom: "data" },
      });

      // Direct database query
      const stored = await client.query(api.memorySpaces.get, {
        memorySpaceId: "validation-space",
      });

      expect(stored).not.toBeNull();
      expect(stored!.memorySpaceId).toBe("validation-space");
      expect(stored!.participants).toHaveLength(2);
      expect(stored!.status).toBe("active");
      expect(stored!.createdAt).toBeGreaterThan(0);
    });
  });

  describe("Lifecycle Management", () => {
    it("creates -> updates -> archives -> deletes", async () => {
      // Create
      const space = await cortex.memorySpaces.register({
        memorySpaceId: "lifecycle-space",
        name: "Lifecycle Test",
        type: "project",
        participants: [{ id: "user-lifecycle", type: "user" }],
      });

      expect(space.status).toBe("active");

      // Update
      const updated = await cortex.memorySpaces.update("lifecycle-space", {
        name: "Updated Lifecycle",
        metadata: { phase: "development" },
      });

      expect(updated.name).toBe("Updated Lifecycle");

      // Archive
      const archived = await cortex.memorySpaces.update("lifecycle-space", {
        status: "archived",
      });

      expect(archived.status).toBe("archived");

      // Delete
      const result = await cortex.memorySpaces.delete("lifecycle-space");

      expect(result.deleted).toBe(true);

      // Verify deleted
      const deleted = await cortex.memorySpaces.get("lifecycle-space");

      expect(deleted).toBeNull();
    });
  });

  describe("New API Methods", () => {
    describe("search()", () => {
      beforeEach(async () => {
        // Clean up any existing test memory spaces first
        try {
          await cortex.memorySpaces.delete("engineering-team");
        } catch (error) {
          // Ignore if doesn't exist
        }
        try {
          await cortex.memorySpaces.delete("design-team");
        } catch (error) {
          // Ignore if doesn't exist
        }
        try {
          await cortex.memorySpaces.delete("user-alice-personal");
        } catch (error) {
          // Ignore if doesn't exist
        }

        // Now register fresh test spaces
        await cortex.memorySpaces.register({
          memorySpaceId: "engineering-team",
          name: "Engineering Team Workspace",
          type: "team",
          metadata: { department: "engineering", project: "apollo" },
        });

        await cortex.memorySpaces.register({
          memorySpaceId: "design-team",
          name: "Design Team Workspace",
          type: "team",
          metadata: { department: "design" },
        });

        await cortex.memorySpaces.register({
          memorySpaceId: "user-alice-personal",
          name: "Alice Personal Space",
          type: "personal",
          metadata: { owner: "alice" },
        });
      });

      afterEach(async () => {
        // Clean up test memory spaces
        try {
          await cortex.memorySpaces.delete("engineering-team");
        } catch (error) {
          // Ignore if doesn't exist
        }
        try {
          await cortex.memorySpaces.delete("design-team");
        } catch (error) {
          // Ignore if doesn't exist
        }
        try {
          await cortex.memorySpaces.delete("user-alice-personal");
        } catch (error) {
          // Ignore if doesn't exist
        }
      });

      it("searches by name", async () => {
        const results = await cortex.memorySpaces.search("Engineering");

        expect(results.length).toBeGreaterThan(0);
        expect(results.some((s) => s.name?.includes("Engineering"))).toBe(true);
      });

      it("searches by memorySpaceId", async () => {
        const results = await cortex.memorySpaces.search("design");

        expect(results.length).toBeGreaterThan(0);
        expect(results.some((s) => s.memorySpaceId.includes("design"))).toBe(
          true,
        );
      });

      it("searches by metadata", async () => {
        const results = await cortex.memorySpaces.search("apollo");

        expect(results.length).toBeGreaterThan(0);
        expect(results.some((s) => s.metadata?.project === "apollo")).toBe(
          true,
        );
      });

      it("filters by type", async () => {
        const results = await cortex.memorySpaces.search("Team", {
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
        expect(spaceIds).toContain("engineering-team");
        expect(spaceIds).toContain("design-team");
      });

      it("filters by status", async () => {
        await cortex.memorySpaces.archive("design-team");

        const activeResults = await cortex.memorySpaces.search("Team", {
          status: "active",
        });
        const archivedResults = await cortex.memorySpaces.search("Team", {
          status: "archived",
        });

        expect(
          activeResults.some((s) => s.memorySpaceId === "design-team"),
        ).toBe(false);
        expect(
          archivedResults.some((s) => s.memorySpaceId === "design-team"),
        ).toBe(true);
      });

      it("limits results", async () => {
        const results = await cortex.memorySpaces.search("", { limit: 2 });

        expect(results.length).toBeLessThanOrEqual(2);
      });
    });

    describe("updateParticipants()", () => {
      beforeEach(async () => {
        // Cleanup any existing participant-test space
        try {
          await cortex.memorySpaces.delete("participant-test");
        } catch (error) {
          // Doesn't exist, continue
        }
      });

      it("adds participants", async () => {
        await cortex.memorySpaces.register({
          memorySpaceId: "participant-test",
          type: "team",
          participants: [{ id: "user-1", type: "user" }] as any,
        });

        const now = Date.now();
        await cortex.memorySpaces.updateParticipants("participant-test", {
          add: [
            { id: "agent-1", type: "agent", joinedAt: now },
            { id: "tool-1", type: "tool", joinedAt: now },
          ],
        });

        const updated = await cortex.memorySpaces.get("participant-test");

        expect(updated?.participants).toHaveLength(3);
        expect(updated?.participants.some((p) => p.id === "agent-1")).toBe(
          true,
        );
        expect(updated?.participants.some((p) => p.id === "tool-1")).toBe(true);
      });

      it("removes participants", async () => {
        await cortex.memorySpaces.register({
          memorySpaceId: "participant-test",
          type: "team",
          participants: [
            { id: "user-1", type: "user" },
            { id: "agent-1", type: "agent" },
            { id: "tool-1", type: "tool" },
          ] as any,
        });

        await cortex.memorySpaces.updateParticipants("participant-test", {
          remove: ["agent-1", "tool-1"],
        });

        const updated = await cortex.memorySpaces.get("participant-test");

        expect(updated?.participants).toHaveLength(1);
        expect(updated?.participants[0].id).toBe("user-1");
      });

      it("adds and removes in one call", async () => {
        await cortex.memorySpaces.register({
          memorySpaceId: "participant-test",
          type: "team",
          participants: [{ id: "old-agent", type: "agent" }] as any,
        });

        const now = Date.now();
        await cortex.memorySpaces.updateParticipants("participant-test", {
          add: [{ id: "new-agent", type: "agent", joinedAt: now }],
          remove: ["old-agent"],
        });

        const updated = await cortex.memorySpaces.get("participant-test");

        expect(updated?.participants).toHaveLength(1);
        expect(updated?.participants[0].id).toBe("new-agent");
      });

      it("prevents duplicate participants", async () => {
        await cortex.memorySpaces.register({
          memorySpaceId: "participant-test",
          type: "team",
          participants: [{ id: "agent-1", type: "agent" }] as any,
        });

        const now = Date.now();
        await cortex.memorySpaces.updateParticipants("participant-test", {
          add: [
            { id: "agent-1", type: "agent", joinedAt: now }, // Duplicate
            { id: "agent-2", type: "agent", joinedAt: now },
          ],
        });

        const updated = await cortex.memorySpaces.get("participant-test");

        expect(updated?.participants).toHaveLength(2);
      });
    });
  });
});
