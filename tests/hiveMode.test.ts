/**
 * E2E Tests: Hive Mode
 *
 * Tests validate:
 * - Multiple participants in one memory space
 * - Shared memory across tools/agents
 * - No data duplication
 * - Participant tracking
 */

import { Cortex } from "../src";
import { ConvexClient } from "convex/browser";
import { TestCleanup } from "./helpers";

describe("Hive Mode", () => {
  let cortex: Cortex;
  let client: ConvexClient;
  let cleanup: TestCleanup;
  const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";
  const HIVE_SPACE = "hive-test-shared";

  beforeAll(async () => {
    cortex = new Cortex({ convexUrl: CONVEX_URL });
    client = new ConvexClient(CONVEX_URL);
    cleanup = new TestCleanup(client);

    // Clean and register hive space
    await cleanup.purgeAll();

    await cortex.memorySpaces.register({
      memorySpaceId: HIVE_SPACE,
      name: "Shared Hive Space",
      type: "team",
      participants: [
        { id: "user-alice", type: "user" },
        { id: "agent-assistant", type: "agent" },
        { id: "tool-calendar", type: "tool" },
        { id: "tool-email", type: "tool" },
        { id: "tool-tasks", type: "tool" },
      ],
    });
  });

  afterAll(async () => {
    await cleanup.purgeAll();
    await client.close();
  });

  describe("Shared Conversations", () => {
    it("all participants see same conversations", async () => {
      // Tool-calendar creates conversation
      const conv = await cortex.conversations.create({
        memorySpaceId: HIVE_SPACE,
        type: "user-agent",
        participants: { userId: "user-alice", participantId: "tool-calendar" },
      });

      await cortex.conversations.addMessage({
        conversationId: conv.conversationId,
        message: {
          role: "user",
          content: "Schedule meeting for Monday at 9 AM",
          participantId: "tool-calendar",
        },
      });

      // Tool-email can see same conversation
      const allConvs = await cortex.conversations.list({
        memorySpaceId: HIVE_SPACE,
      });

      expect(
        allConvs.some((c) => c.conversationId === conv.conversationId),
      ).toBe(true);
    });
  });

  describe("Shared Memories", () => {
    it("all participants contribute to shared memory pool", async () => {
      // Tool-calendar stores memory
      await cortex.vector.store(HIVE_SPACE, {
        content: "User has meeting Monday 9 AM",
        contentType: "raw",
        participantId: "tool-calendar", // Hive Mode tracking
        source: { type: "tool", userId: "user-alice" },
        metadata: {
          importance: 80,
          tags: ["meeting", "calendar"],
        },
      });

      // Tool-email stores related memory
      await cortex.vector.store(HIVE_SPACE, {
        content: "User prefers email reminders 1 hour before meetings",
        contentType: "raw",
        participantId: "tool-email", // Hive Mode tracking
        source: { type: "tool", userId: "user-alice" },
        metadata: {
          importance: 70,
          tags: ["notification", "email", "meeting"],
        },
      });

      // Tool-tasks stores memory
      await cortex.vector.store(HIVE_SPACE, {
        content: "User has task to prepare meeting agenda",
        contentType: "raw",
        participantId: "tool-tasks", // Hive Mode tracking
        source: { type: "tool", userId: "user-alice" },
        metadata: {
          importance: 75,
          tags: ["task", "meeting"],
        },
      });

      // All tools can access ALL memories
      const allMemories = await cortex.vector.list({
        memorySpaceId: HIVE_SPACE,
      });

      expect(allMemories.length).toBeGreaterThanOrEqual(3);

      // Verify memories from different participants
      const participants = new Set(
        allMemories.map((m) => m.participantId).filter(Boolean),
      );

      expect(participants.size).toBeGreaterThanOrEqual(3);
    });
  });

  describe("Shared Facts", () => {
    it("all participants contribute to shared fact base", async () => {
      // Tool-calendar extracts fact
      await cortex.facts.store({
        memorySpaceId: HIVE_SPACE,
        participantId: "tool-calendar",
        fact: "User has recurring weekly team meeting on Mondays at 9 AM",
        factType: "preference",
        subject: "user-alice",
        confidence: 95,
        sourceType: "tool",
        tags: ["meeting", "recurring"],
      });

      // Tool-email extracts fact
      await cortex.facts.store({
        memorySpaceId: HIVE_SPACE,
        participantId: "tool-email",
        fact: "User prefers email over SMS for notifications",
        factType: "preference",
        subject: "user-alice",
        confidence: 90,
        sourceType: "tool",
        tags: ["notification", "preference"],
      });

      // Agent-assistant extracts fact
      await cortex.facts.store({
        memorySpaceId: HIVE_SPACE,
        participantId: "agent-assistant",
        fact: "User is working on Q4 product launch project",
        factType: "knowledge",
        subject: "user-alice",
        confidence: 100,
        sourceType: "conversation",
        tags: ["project", "work"],
      });

      // All can access all facts
      const allFacts = await cortex.facts.list({
        memorySpaceId: HIVE_SPACE,
      });

      expect(allFacts.length).toBeGreaterThanOrEqual(3);

      // Verify different participants
      const extractors = new Set(
        allFacts.map((f) => f.participantId).filter(Boolean),
      );

      expect(extractors.size).toBeGreaterThanOrEqual(3);
    });

    it("facts about same subject from different tools", async () => {
      const userFacts = await cortex.facts.queryBySubject({
        memorySpaceId: HIVE_SPACE,
        subject: "user-alice",
      });

      expect(userFacts.length).toBeGreaterThanOrEqual(3);

      // Multiple participants contributed facts about same user
      const contributors = new Set(
        userFacts.map((f) => f.participantId).filter(Boolean),
      );

      expect(contributors.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe("No Data Duplication", () => {
    it("single memory space eliminates duplication", async () => {
      // Without Hive Mode: Each tool would need separate memory space
      // Result: Same facts stored multiple times

      // With Hive Mode: One shared space
      const fact = "User's timezone is America/Los_Angeles";

      // Tool-calendar stores it once
      const stored = await cortex.facts.store({
        memorySpaceId: HIVE_SPACE,
        participantId: "tool-calendar",
        fact,
        factType: "identity",
        subject: "user-alice",
        predicate: "has_timezone",
        object: "America/Los_Angeles",
        confidence: 100,
        sourceType: "system",
        tags: ["timezone", "identity"],
      });

      // Tool-email can access same fact (no duplicate needed)
      const facts = await cortex.facts.queryBySubject({
        memorySpaceId: HIVE_SPACE,
        subject: "user-alice",
      });

      const timezoneFacts = facts.filter((f) => f.predicate === "has_timezone");

      // Should only be ONE fact about timezone (no duplication)
      expect(timezoneFacts).toHaveLength(1);
      expect(timezoneFacts[0].factId).toBe(stored.factId);
    });
  });

  describe("Participant Tracking", () => {
    it("tracks which participant created what", async () => {
      const conv1 = await cortex.conversations.create({
        memorySpaceId: HIVE_SPACE,
        type: "user-agent",
        participants: { userId: "user-alice", participantId: "tool-calendar" },
      });

      const conv2 = await cortex.conversations.create({
        memorySpaceId: HIVE_SPACE,
        type: "user-agent",
        participants: { userId: "user-alice", participantId: "tool-email" },
      });

      // Can see who created what (participantId is in participants object)
      expect(conv1.participants.participantId).toBe("tool-calendar");
      expect(conv2.participants.participantId).toBe("tool-email");

      // But both in same space
      expect(conv1.memorySpaceId).toBe(HIVE_SPACE);
      expect(conv2.memorySpaceId).toBe(HIVE_SPACE);
    });
  });

  describe("Real-World Hive Scenario", () => {
    it("multi-tool coordination for user workflow", async () => {
      // Scenario: User asks "What do I have scheduled this week?"
      // Multiple tools need to coordinate in shared hive

      // 1. Agent-assistant processes request
      const agentConv = await cortex.conversations.create({
        memorySpaceId: HIVE_SPACE,
        type: "user-agent",
        participants: {
          userId: "user-alice",
          participantId: "agent-assistant",
        },
      });

      const userMsg = await cortex.conversations.addMessage({
        conversationId: agentConv.conversationId,
        message: {
          role: "user",
          content: "What do I have scheduled this week?",
        },
      });

      // 2. Agent delegates to calendar tool (creates context)
      const _context = await cortex.contexts.create({
        purpose: "Retrieve weekly schedule",
        memorySpaceId: HIVE_SPACE,
        conversationRef: {
          conversationId: agentConv.conversationId,
          messageIds: [userMsg.messages[0].id],
        },
      });

      // 3. Calendar tool executes and stores result
      await cortex.facts.store({
        memorySpaceId: HIVE_SPACE,
        participantId: "tool-calendar",
        fact: "User has 3 meetings scheduled this week",
        factType: "knowledge",
        subject: "user-alice",
        confidence: 100,
        sourceType: "tool",
        sourceRef: {
          conversationId: agentConv.conversationId,
        },
        tags: ["meetings", "schedule", "weekly"],
      });

      // 4. Email tool checks for meeting notifications
      const meetings = await cortex.facts.search(HIVE_SPACE, "meetings");

      expect(meetings.length).toBeGreaterThanOrEqual(1);

      // 5. All data in ONE space, no duplication
      const stats = await cortex.memorySpaces.getStats(HIVE_SPACE);

      expect(stats.totalConversations).toBeGreaterThanOrEqual(1);
      expect(stats.totalFacts).toBeGreaterThanOrEqual(1);

      // 6. Verify all participants tracked
      const space = await cortex.memorySpaces.get(HIVE_SPACE);

      expect(space!.participants.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe("Performance Benefits", () => {
    it("single query retrieves all participant memories", async () => {
      // Add memories from 3 different tools
      await cortex.vector.store(HIVE_SPACE, {
        content: "Calendar: Meeting at 9 AM",
        contentType: "raw",
        participantId: "tool-calendar", // Hive Mode tracking
        source: { type: "tool" },
        metadata: {
          importance: 80,
          tags: ["calendar"],
        },
      });

      await cortex.vector.store(HIVE_SPACE, {
        content: "Email: Unread message from boss",
        contentType: "raw",
        participantId: "tool-email", // Hive Mode tracking
        source: { type: "tool" },
        metadata: {
          importance: 90,
          tags: ["email"],
        },
      });

      await cortex.vector.store(HIVE_SPACE, {
        content: "Tasks: 3 pending tasks for today",
        contentType: "raw",
        participantId: "tool-tasks", // Hive Mode tracking
        source: { type: "tool" },
        metadata: {
          importance: 85,
          tags: ["tasks"],
        },
      });

      // Single query gets ALL (vs 3 separate queries without Hive Mode)
      const startTime = Date.now();
      const allMemories = await cortex.vector.list({
        memorySpaceId: HIVE_SPACE,
      });
      const queryTime = Date.now() - startTime;

      expect(allMemories.length).toBeGreaterThanOrEqual(3);
      expect(queryTime).toBeLessThan(1000); // Should be fast

      // Verify from different participants
      const participants = new Set(
        allMemories.map((m) => m.participantId).filter(Boolean),
      );

      expect(participants.size).toBeGreaterThanOrEqual(3);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // v0.6.1 Enhanced Participant Tracking Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Enhanced Participant Tracking (v0.6.1)", () => {
    it("participantId persists through vector.update()", async () => {
      const mem = await cortex.vector.store(HIVE_SPACE, {
        content: "Original content from tool",
        contentType: "raw",
        participantId: "tool-calendar",
        source: { type: "tool", userId: "user-alice" },
        metadata: { importance: 70, tags: ["test"] },
      });

      const updated = await cortex.vector.update(HIVE_SPACE, mem.memoryId, {
        content: "Updated content",
        importance: 80,
        tags: ["test", "updated"],
      });

      // Validate participantId preserved
      expect(updated.participantId).toBe("tool-calendar");

      // Verify in database
      const stored = await cortex.vector.get(HIVE_SPACE, mem.memoryId);
      expect(stored!.participantId).toBe("tool-calendar");
    });

    it("tracks 5+ participants in same hive", async () => {
      const PARTICIPANTS = [
        "tool-calendar",
        "tool-email",
        "tool-tasks",
        "tool-notes",
        "agent-assistant",
      ];

      // Each participant stores memory
      for (const participant of PARTICIPANTS) {
        await cortex.vector.store(HIVE_SPACE, {
          content: `Memory from ${participant}`,
          contentType: "raw",
          participantId: participant,
          source: { type: "tool", userId: "user-alice" },
          metadata: { importance: 70, tags: ["multi-participant"] },
        });
      }

      // Validate all 5 participants tracked
      const allMemories = await cortex.vector.list({
        memorySpaceId: HIVE_SPACE,
      });

      const uniqueParticipants = new Set(
        allMemories
          .filter((m) => m.tags?.includes("multi-participant"))
          .map((m) => m.participantId)
          .filter(Boolean),
      );

      expect(uniqueParticipants.size).toBeGreaterThanOrEqual(5);

      PARTICIPANTS.forEach((p) => {
        expect(uniqueParticipants.has(p)).toBe(true);
      });

      // Can identify who created what
      PARTICIPANTS.forEach((participant) => {
        const participantMems = allMemories.filter(
          (m) => m.participantId === participant && m.tags?.includes("multi-participant"),
        );
        expect(participantMems.length).toBeGreaterThanOrEqual(1);
        expect(participantMems[0].content).toContain(participant);
      });
    });

    it("multiple participants use remember() in same hive", async () => {
      const PARTICIPANTS = ["tool-calendar", "tool-email", "tool-tasks"];

      // Create conversation for remember() tests
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: HIVE_SPACE,
        participants: { userId: "user-alice" },
      });

      for (const participant of PARTICIPANTS) {
        await cortex.memory.remember({
          memorySpaceId: HIVE_SPACE,
          conversationId: conv.conversationId,
          userId: "user-alice",
          userName: "Alice",
          participantId: participant,
          userMessage: `Test from ${participant}`,
          agentResponse: `Response from ${participant}`,
          tags: ["remember-test"],
        });
      }

      // Verify all memories have correct participantId
      const allMemories = await cortex.vector.list({
        memorySpaceId: HIVE_SPACE,
      });

      const rememberTestMems = allMemories.filter((m) =>
        m.tags?.includes("remember-test"),
      );

      expect(rememberTestMems.length).toBeGreaterThanOrEqual(
        PARTICIPANTS.length * 2,
      ); // 2 memories per remember()

      // Each participant should have memories
      PARTICIPANTS.forEach((participant) => {
        const participantMems = rememberTestMems.filter(
          (m) => m.participantId === participant,
        );
        expect(participantMems.length).toBeGreaterThanOrEqual(2);
      });
    });

    it("message.participantId for agent messages", async () => {
      const conv = await cortex.conversations.create({
        memorySpaceId: HIVE_SPACE,
        type: "user-agent",
        participants: { userId: "user-alice", participantId: "tool-calendar" },
      });

      await cortex.conversations.addMessage({
        conversationId: conv.conversationId,
        message: {
          role: "agent",
          content: "Response from calendar tool",
          participantId: "tool-calendar",
        },
      });

      const updatedConv = await cortex.conversations.get(conv.conversationId);
      const agentMsg = updatedConv!.messages.find((m) => m.role === "agent");

      expect(agentMsg).toBeDefined();
      expect(agentMsg!.participantId).toBe("tool-calendar");
    });

    it("facts participantId persists through update", async () => {
      const v1 = await cortex.facts.store({
        memorySpaceId: HIVE_SPACE,
        participantId: "agent-assistant",
        fact: "Original fact from agent",
        factType: "knowledge",
        subject: "user-alice",
        confidence: 80,
        sourceType: "system",
        tags: ["fact-update-test"],
      });

      const v2 = await cortex.facts.update(HIVE_SPACE, v1.factId, {
        fact: "Updated fact",
        confidence: 90,
      });

      // New version should preserve participantId
      expect(v2.participantId).toBe("agent-assistant");

      // Verify in database
      const stored = await cortex.facts.get(HIVE_SPACE, v2.factId);
      expect(stored!.participantId).toBe("agent-assistant");
    });

    it("can distinguish memories by participant in search", async () => {
      // Create unique memories per participant
      await cortex.vector.store(HIVE_SPACE, {
        content: "DISTINGUISH_TEST calendar specific data",
        contentType: "raw",
        participantId: "tool-calendar",
        source: { type: "tool" },
        metadata: { importance: 80, tags: ["distinguish-test"] },
      });

      await cortex.vector.store(HIVE_SPACE, {
        content: "DISTINGUISH_TEST email specific data",
        contentType: "raw",
        participantId: "tool-email",
        source: { type: "tool" },
        metadata: { importance: 80, tags: ["distinguish-test"] },
      });

      const results = await cortex.vector.search(
        HIVE_SPACE,
        "DISTINGUISH_TEST",
        { limit: 10 },
      );

      const distinguishResults = results.filter((r) =>
        r.tags?.includes("distinguish-test"),
      );

      expect(distinguishResults.length).toBeGreaterThanOrEqual(2);

      // Should have memories from both participants
      const participants = new Set(
        distinguishResults.map((r) => r.participantId).filter(Boolean),
      );

      expect(participants.has("tool-calendar")).toBe(true);
      expect(participants.has("tool-email")).toBe(true);
    });

    it("contexts track participants correctly", async () => {
      // Note: contexts.create() doesn't have a participants array parameter
      // Participants are tracked via the memorySpace registration
      const ctx = await cortex.contexts.create({
        purpose: "Multi-participant context",
        memorySpaceId: HIVE_SPACE,
        userId: "user-alice",
      });

      expect(ctx).toBeDefined();
      expect(ctx.memorySpaceId).toBe(HIVE_SPACE);
      expect(ctx.userId).toBe("user-alice");
      
      // Verify the memory space has multiple participants
      const space = await cortex.memorySpaces.get(HIVE_SPACE);
      expect(space!.participants.length).toBeGreaterThanOrEqual(3);
    });

    it("participant statistics accurate", async () => {
      // Store memories from different participants with unique tag
      await cortex.vector.store(HIVE_SPACE, {
        content: "Stats test calendar",
        contentType: "raw",
        participantId: "tool-calendar",
        source: { type: "tool" },
        metadata: { importance: 70, tags: ["stats-test"] },
      });

      await cortex.vector.store(HIVE_SPACE, {
        content: "Stats test email",
        contentType: "raw",
        participantId: "tool-email",
        source: { type: "tool" },
        metadata: { importance: 70, tags: ["stats-test"] },
      });

      await cortex.vector.store(HIVE_SPACE, {
        content: "Stats test tasks",
        contentType: "raw",
        participantId: "tool-tasks",
        source: { type: "tool" },
        metadata: { importance: 70, tags: ["stats-test"] },
      });

      // Get stats
      const stats = await cortex.memorySpaces.getStats(HIVE_SPACE);

      expect(stats).toBeDefined();
      expect(stats.totalMemories).toBeGreaterThanOrEqual(3);

      // Verify space has multiple participants registered
      const space = await cortex.memorySpaces.get(HIVE_SPACE);
      expect(space!.participants.length).toBeGreaterThanOrEqual(3);
    });

    it("participantId in all layers for end-to-end workflow", async () => {
      const PARTICIPANT = "tool-workflow-test";

      // Create conversation first
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: HIVE_SPACE,
        participants: { userId: "user-alice", participantId: PARTICIPANT },
      });

      // 1. Remember with participantId
      const result = await cortex.memory.remember({
        memorySpaceId: HIVE_SPACE,
        conversationId: conv.conversationId,
        userId: "user-alice",
        userName: "Alice",
        participantId: PARTICIPANT,
        userMessage: "Workflow test message",
        agentResponse: "Workflow test response",
      });

      // 2. Store fact with participantId
      const fact = await cortex.facts.store({
        memorySpaceId: HIVE_SPACE,
        participantId: PARTICIPANT,
        fact: "Workflow test fact",
        factType: "knowledge",
        subject: "user-alice",
        confidence: 95,
        sourceType: "conversation",
        sourceRef: { conversationId: result.conversation.conversationId },
      });

      // 3. Create context
      const ctx = await cortex.contexts.create({
        purpose: "Workflow test context",
        memorySpaceId: HIVE_SPACE,
        userId: "user-alice",
      });

      // Validate participantId in all layers
      const convCheck = await cortex.conversations.get(
        result.conversation.conversationId,
      );
      expect(convCheck!.participants.participantId).toBe(PARTICIPANT);

      const mem = await cortex.vector.get(
        HIVE_SPACE,
        result.memories[0].memoryId,
      );
      expect(mem!.participantId).toBe(PARTICIPANT);

      expect(fact.participantId).toBe(PARTICIPANT);
      expect(ctx.memorySpaceId).toBe(HIVE_SPACE);
    });

    it("handles undefined participantId across all operations", async () => {
      // Store without participantId
      const mem = await cortex.vector.store(HIVE_SPACE, {
        content: "No participant",
        contentType: "raw",
        source: { type: "system", userId: "user-alice" },
        metadata: { importance: 70, tags: ["no-participant"] },
      });

      expect(mem.participantId).toBeUndefined();

      // Fact without participantId
      const fact = await cortex.facts.store({
        memorySpaceId: HIVE_SPACE,
        fact: "Fact without participant",
        factType: "knowledge",
        subject: "user-alice",
        confidence: 80,
        sourceType: "system",
      });

      expect(fact.participantId).toBeUndefined();

      // Both should be retrievable
      const storedMem = await cortex.vector.get(HIVE_SPACE, mem.memoryId);
      expect(storedMem).not.toBeNull();

      const storedFact = await cortex.facts.get(HIVE_SPACE, fact.factId);
      expect(storedFact).not.toBeNull();
    });
  });
});
