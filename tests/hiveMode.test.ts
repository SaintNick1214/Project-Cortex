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
      const context = await cortex.contexts.create({
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
});
