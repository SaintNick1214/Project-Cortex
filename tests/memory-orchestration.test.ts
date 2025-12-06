/**
 * E2E Tests: Memory Orchestration
 *
 * Tests the new full-orchestration behavior of cortex.memory.remember():
 * - Auto-registration of memory spaces
 * - Auto-creation of user profiles
 * - Auto-registration of agents
 * - Owner validation (userId OR agentId required)
 * - skipLayers functionality
 * - Default memorySpaceId behavior
 */

import { Cortex } from "../src";
import type { SkippableLayer } from "../src/types";
import { ConvexClient } from "convex/browser";
import { createTestRunContext } from "./helpers/isolation";
import { jest } from "@jest/globals";

// Create test run context for parallel execution isolation
const ctx = createTestRunContext();

describe("Memory Orchestration", () => {
  let cortex: Cortex;
  let client: ConvexClient;
  const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";

  // Use ctx-scoped IDs for parallel execution isolation
  const TEST_PREFIX = ctx.runId;

  beforeAll(async () => {
    cortex = new Cortex({ convexUrl: CONVEX_URL });
    client = new ConvexClient(CONVEX_URL);
  });

  afterAll(async () => {
    await client.close();
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Validation Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Owner Validation", () => {
    it("should require either userId or agentId", async () => {
      await expect(
        cortex.memory.remember({
          memorySpaceId: `${TEST_PREFIX}-space-1`,
          conversationId: `${TEST_PREFIX}-conv-1`,
          userMessage: "Hello",
          agentResponse: "Hi there!",
          // Neither userId nor agentId provided
        }),
      ).rejects.toThrow("Either userId or agentId must be provided");
    });

    it("should accept userId with userName and agentId", async () => {
      const result = await cortex.memory.remember({
        memorySpaceId: `${TEST_PREFIX}-space-2`,
        conversationId: `${TEST_PREFIX}-conv-2`,
        userMessage: "Hello",
        agentResponse: "Hi there!",
        userId: `${TEST_PREFIX}-user-1`,
        userName: "Test User",
        agentId: `${TEST_PREFIX}-agent-user-conv`,
      });

      expect(result.memories.length).toBeGreaterThan(0);
      expect(result.conversation.conversationId).toBe(`${TEST_PREFIX}-conv-2`);
    });

    it("should require agentId when userId is provided", async () => {
      await expect(
        cortex.memory.remember({
          memorySpaceId: `${TEST_PREFIX}-space-no-agent`,
          conversationId: `${TEST_PREFIX}-conv-no-agent`,
          userMessage: "Hello",
          agentResponse: "Hi!",
          userId: `${TEST_PREFIX}-user-no-agent`,
          userName: "No Agent User",
          // agentId not provided - should fail
        }),
      ).rejects.toThrow("agentId is required when userId is provided");
    });

    it("should accept agentId without userId", async () => {
      // Note: Agent-only memories skip conversations by default since
      // the conversation model requires either:
      // - userId for "user-agent" type
      // - memorySpaceIds array for "agent-agent" (Hive Mode)
      const result = await cortex.memory.remember({
        memorySpaceId: `${TEST_PREFIX}-space-3`,
        conversationId: `${TEST_PREFIX}-conv-3`,
        userMessage: "System event",
        agentResponse: "Acknowledged",
        agentId: `${TEST_PREFIX}-agent-1`,
        skipLayers: ["conversations"], // Skip conversation for agent-only
      });

      expect(result.memories.length).toBeGreaterThan(0);
    });

    it("should require userName when userId is provided", async () => {
      await expect(
        cortex.memory.remember({
          memorySpaceId: `${TEST_PREFIX}-space-4`,
          conversationId: `${TEST_PREFIX}-conv-4`,
          userMessage: "Hello",
          agentResponse: "Hi!",
          userId: `${TEST_PREFIX}-user-2`,
          agentId: `${TEST_PREFIX}-agent-no-name`,
          // userName not provided
        }),
      ).rejects.toThrow("userName is required when userId is provided");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Memory Space Auto-Registration Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Memory Space Auto-Registration", () => {
    it("should auto-register memory space if not exists", async () => {
      const newSpaceId = `${TEST_PREFIX}-new-space-${Date.now()}`;

      // Verify space doesn't exist
      const spaceBefore = await cortex.memorySpaces.get(newSpaceId);
      expect(spaceBefore).toBeNull();

      // Call remember - should auto-register
      await cortex.memory.remember({
        memorySpaceId: newSpaceId,
        conversationId: `${TEST_PREFIX}-conv-new-1`,
        userMessage: "Hello",
        agentResponse: "Hi!",
        userId: `${TEST_PREFIX}-user-auto-space`,
        userName: "Auto Space User",
        agentId: `${TEST_PREFIX}-agent-auto-space`,
      });

      // Verify space now exists
      const spaceAfter = await cortex.memorySpaces.get(newSpaceId);
      expect(spaceAfter).not.toBeNull();
      expect(spaceAfter?.memorySpaceId).toBe(newSpaceId);
    });

    it("should use default memorySpaceId with warning when not provided", async () => {
      // Capture console.warn
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      const result = await cortex.memory.remember({
        // memorySpaceId not provided
        conversationId: `${TEST_PREFIX}-conv-default-1`,
        userMessage: "Hello",
        agentResponse: "Hi!",
        userId: `${TEST_PREFIX}-user-default`,
        userName: "Default Space User",
        agentId: `${TEST_PREFIX}-agent-default`,
      });

      // Verify warning was emitted
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("No memorySpaceId provided"),
      );
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("default"));

      // Verify result is valid
      expect(result.memories.length).toBeGreaterThan(0);

      warnSpy.mockRestore();
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // User Auto-Creation Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("User Auto-Creation", () => {
    it("should auto-create user profile if not exists", async () => {
      const newUserId = `${TEST_PREFIX}-new-user-${Date.now()}`;

      // Verify user doesn't exist
      const userBefore = await cortex.users.get(newUserId);
      expect(userBefore).toBeNull();

      // Call remember - should auto-create user
      await cortex.memory.remember({
        memorySpaceId: `${TEST_PREFIX}-space-user-auto`,
        conversationId: `${TEST_PREFIX}-conv-user-auto-1`,
        userMessage: "Hello",
        agentResponse: "Hi!",
        userId: newUserId,
        userName: "Auto Created User",
        agentId: `${TEST_PREFIX}-agent-user-auto`,
      });

      // Verify user now exists
      const userAfter = await cortex.users.get(newUserId);
      expect(userAfter).not.toBeNull();
      expect(userAfter?.id).toBe(newUserId);
    });

    it("should skip user creation when 'users' is in skipLayers", async () => {
      const newUserId = `${TEST_PREFIX}-skip-user-${Date.now()}`;

      // Verify user doesn't exist
      const userBefore = await cortex.users.get(newUserId);
      expect(userBefore).toBeNull();

      // Call remember with skipLayers: ['users']
      await cortex.memory.remember({
        memorySpaceId: `${TEST_PREFIX}-space-skip-user`,
        conversationId: `${TEST_PREFIX}-conv-skip-user-1`,
        userMessage: "Hello",
        agentResponse: "Hi!",
        userId: newUserId,
        userName: "Skip User Test",
        agentId: `${TEST_PREFIX}-agent-skip-user`,
        skipLayers: ["users"],
      });

      // Verify user was NOT created
      const userAfter = await cortex.users.get(newUserId);
      expect(userAfter).toBeNull();
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Agent Auto-Registration Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Agent Auto-Registration", () => {
    it("should auto-register agent if not exists", async () => {
      const newAgentId = `${TEST_PREFIX}-new-agent-${Date.now()}`;

      // Verify agent doesn't exist
      const agentBefore = await cortex.agents.exists(newAgentId);
      expect(agentBefore).toBe(false);

      // Call remember with agentId - should auto-register
      // Skip conversations since agent-only memories don't support user-agent conversations
      await cortex.memory.remember({
        memorySpaceId: `${TEST_PREFIX}-space-agent-auto`,
        conversationId: `${TEST_PREFIX}-conv-agent-auto-1`,
        userMessage: "System task",
        agentResponse: "Task completed",
        agentId: newAgentId,
        skipLayers: ["conversations"], // Agent-only memories skip conversations
      });

      // Verify agent now exists
      const agentAfter = await cortex.agents.exists(newAgentId);
      expect(agentAfter).toBe(true);
    });

    it("should skip agent creation when 'agents' is in skipLayers", async () => {
      const newAgentId = `${TEST_PREFIX}-skip-agent-${Date.now()}`;

      // Verify agent doesn't exist
      const agentBefore = await cortex.agents.exists(newAgentId);
      expect(agentBefore).toBe(false);

      // Call remember with skipLayers: ['agents', 'conversations']
      // Agent-only memories skip conversations since they require user-agent or Hive Mode setup
      await cortex.memory.remember({
        memorySpaceId: `${TEST_PREFIX}-space-skip-agent`,
        conversationId: `${TEST_PREFIX}-conv-skip-agent-1`,
        userMessage: "Task",
        agentResponse: "Done",
        agentId: newAgentId,
        skipLayers: ["agents", "conversations"], // Skip both agent creation and conversations
      });

      // Verify agent was NOT created
      const agentAfter = await cortex.agents.exists(newAgentId);
      expect(agentAfter).toBe(false);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Skip Layers Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("skipLayers Functionality", () => {
    it("should skip conversation layer when 'conversations' is in skipLayers", async () => {
      const convId = `${TEST_PREFIX}-skip-conv-${Date.now()}`;

      await cortex.memory.remember({
        memorySpaceId: `${TEST_PREFIX}-space-skip-conv`,
        conversationId: convId,
        userMessage: "Hello",
        agentResponse: "Hi!",
        userId: `${TEST_PREFIX}-user-skip-conv`,
        userName: "Skip Conv User",
        agentId: `${TEST_PREFIX}-agent-skip-conv`,
        skipLayers: ["conversations"],
      });

      // Verify conversation was NOT created
      const conv = await cortex.conversations.get(convId);
      expect(conv).toBeNull();
    });

    it("should skip vector layer when 'vector' is in skipLayers", async () => {
      const spaceId = `${TEST_PREFIX}-space-skip-vector`;
      const convId = `${TEST_PREFIX}-conv-skip-vector-${Date.now()}`;

      const result = await cortex.memory.remember({
        memorySpaceId: spaceId,
        conversationId: convId,
        userMessage: "Hello",
        agentResponse: "Hi!",
        userId: `${TEST_PREFIX}-user-skip-vector`,
        userName: "Skip Vector User",
        agentId: `${TEST_PREFIX}-agent-skip-vector`,
        skipLayers: ["vector"],
      });

      // Verify no vector memories were created
      expect(result.memories.length).toBe(0);
    });

    it("should skip facts layer when 'facts' is in skipLayers", async () => {
      const result = await cortex.memory.remember({
        memorySpaceId: `${TEST_PREFIX}-space-skip-facts`,
        conversationId: `${TEST_PREFIX}-conv-skip-facts-${Date.now()}`,
        userMessage: "My name is John",
        agentResponse: "Nice to meet you, John!",
        userId: `${TEST_PREFIX}-user-skip-facts`,
        userName: "Skip Facts User",
        agentId: `${TEST_PREFIX}-agent-skip-facts`,
        skipLayers: ["facts"],
        // Even with extractFacts, should not extract due to skipLayers
        extractFacts: async () => [
          {
            fact: "User name is John",
            factType: "identity" as const,
            confidence: 100,
          },
        ],
      });

      // Verify no facts were created
      expect(result.facts.length).toBe(0);
    });

    it("should accept multiple skipLayers", async () => {
      const skipLayers: SkippableLayer[] = [
        "users",
        "agents",
        "facts",
        "graph",
      ];

      const result = await cortex.memory.remember({
        memorySpaceId: `${TEST_PREFIX}-space-multi-skip`,
        conversationId: `${TEST_PREFIX}-conv-multi-skip-${Date.now()}`,
        userMessage: "Hello",
        agentResponse: "Hi!",
        userId: `${TEST_PREFIX}-user-multi-skip`,
        userName: "Multi Skip User",
        agentId: `${TEST_PREFIX}-agent-multi-skip`,
        skipLayers,
      });

      // Should still create memories (only users, agents, facts, graph skipped)
      expect(result.memories.length).toBeGreaterThan(0);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Combined Owner Tests (userId + agentId)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Combined Ownership", () => {
    it("should auto-register both user and agent when both provided", async () => {
      const newUserId = `${TEST_PREFIX}-combo-user-${Date.now()}`;
      const newAgentId = `${TEST_PREFIX}-combo-agent-${Date.now()}`;

      // Verify neither exists
      const userBefore = await cortex.users.get(newUserId);
      const agentBefore = await cortex.agents.exists(newAgentId);
      expect(userBefore).toBeNull();
      expect(agentBefore).toBe(false);

      // Call remember with both userId and agentId
      await cortex.memory.remember({
        memorySpaceId: `${TEST_PREFIX}-space-combo`,
        conversationId: `${TEST_PREFIX}-conv-combo-${Date.now()}`,
        userMessage: "Hello from user",
        agentResponse: "Response from agent",
        userId: newUserId,
        userName: "Combo User",
        agentId: newAgentId,
      });

      // Verify both were created
      const userAfter = await cortex.users.get(newUserId);
      const agentAfter = await cortex.agents.exists(newAgentId);
      expect(userAfter).not.toBeNull();
      expect(agentAfter).toBe(true);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Full Orchestration Test
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Full Orchestration Flow", () => {
    it("should orchestrate all layers in one remember() call", async () => {
      const timestamp = Date.now();
      const spaceId = `${TEST_PREFIX}-full-orch-space-${timestamp}`;
      const userId = `${TEST_PREFIX}-full-orch-user-${timestamp}`;
      const agentId = `${TEST_PREFIX}-full-orch-agent-${timestamp}`;
      const convId = `${TEST_PREFIX}-full-orch-conv-${timestamp}`;

      // All entities should not exist initially
      const spaceBefore = await cortex.memorySpaces.get(spaceId);
      const userBefore = await cortex.users.get(userId);
      expect(spaceBefore).toBeNull();
      expect(userBefore).toBeNull();

      // Single remember() call
      const result = await cortex.memory.remember({
        memorySpaceId: spaceId,
        conversationId: convId,
        userMessage: "My favorite color is blue",
        agentResponse: "I'll remember that blue is your favorite color!",
        userId,
        userName: "Full Orch User",
        agentId,
        extractFacts: async () => [
          {
            fact: "User favorite color is blue",
            factType: "preference" as const,
            subject: userId,
            predicate: "prefers_color",
            object: "blue",
            confidence: 90,
          },
        ],
      });

      // Verify all orchestrations happened
      // 1. Memory space was created
      const spaceAfter = await cortex.memorySpaces.get(spaceId);
      expect(spaceAfter).not.toBeNull();
      expect(spaceAfter?.memorySpaceId).toBe(spaceId);

      // 2. User was created
      const userAfter = await cortex.users.get(userId);
      expect(userAfter).not.toBeNull();
      expect(userAfter?.id).toBe(userId);

      // 3. Conversation was created
      const conv = await cortex.conversations.get(convId);
      expect(conv).not.toBeNull();
      expect(conv?.messageCount).toBeGreaterThan(0);

      // 4. Vector memories were created
      expect(result.memories.length).toBeGreaterThan(0);

      // 5. Facts were extracted
      expect(result.facts.length).toBe(1);
      expect(result.facts[0].fact).toBe("User favorite color is blue");
      expect(result.facts[0].factType).toBe("preference");
    });
  });
});
