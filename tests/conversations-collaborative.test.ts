/**
 * Cortex SDK - Collaborative Conversations Tests
 *
 * Tests the Shareable Chats Phase 4 implementation:
 * - Collaborative conversation creation with multiple users
 * - Message approval workflow
 * - approveMessage() method
 * - rejectMessage() method
 *
 * PARALLEL-SAFE: Uses TestRunContext for isolated test data
 */

import { Cortex } from "../src";
import { createNamedTestRunContext, ScopedCleanup } from "./helpers";
import { generateTenantId, createTenantAuthContext } from "./helpers/tenancy";
import { ConvexClient } from "convex/browser";

describe("Collaborative Conversations (Shareable Chats Phase 4)", () => {
  const ctx = createNamedTestRunContext("collab");

  let cortex: Cortex;
  let client: ConvexClient;
  let scopedCleanup: ScopedCleanup;
  const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";
  const TEST_TENANT_ID = generateTenantId("collab");
  const TEST_USER_ID = `user_${ctx.runId}`;

  beforeAll(async () => {
    console.log(`\n🧪 Collaborative Tests - Run ID: ${ctx.runId}\n`);

    const authContext = createTenantAuthContext(TEST_TENANT_ID, TEST_USER_ID);
    cortex = new Cortex({ convexUrl: CONVEX_URL, auth: authContext });
    client = new ConvexClient(CONVEX_URL);
    scopedCleanup = new ScopedCleanup(client, ctx);

    console.log("✅ Test isolation setup complete\n");
  });

  afterAll(async () => {
    console.log(`\n🧹 Cleaning up test run ${ctx.runId}...`);
    await scopedCleanup.cleanupAll();
    cortex.close();
    await client.close();
    console.log(`✅ Test run ${ctx.runId} cleanup complete\n`);
  });

  describe("Collaborative conversation creation", () => {
    it("creates conversation with multiple userIds", async () => {
      const space = ctx.memorySpaceId("collab-users");
      const user1 = ctx.userId("collab-user-1");
      const user2 = ctx.userId("collab-user-2");
      const user3 = ctx.userId("collab-user-3");
      const agent = ctx.agentId("collab-agent-1");

      const conv = await cortex.conversations.create({
        memorySpaceId: space,
        type: "user-agent",
        participants: {
          userIds: [user1, user2, user3],
          agentId: agent,
        },
      });

      expect(conv.conversationId).toMatch(/^conv-/);
      expect(conv.participants.userIds).toContain(user1);
      expect(conv.participants.userIds).toContain(user2);
      expect(conv.participants.userIds).toContain(user3);
    });

    it("creates conversation with collaborativeSettings (requireApproval=false)", async () => {
      const space = ctx.memorySpaceId("collab-no-approval");
      const user = ctx.userId("collab-user-na");
      const agent = ctx.agentId("collab-agent-na");

      const conv = await cortex.conversations.create({
        memorySpaceId: space,
        type: "user-agent",
        participants: { userId: user, agentId: agent },
        collaborativeSettings: {
          requireApproval: false,
        },
      });

      expect(conv.collaborativeSettings).toBeDefined();
      expect(conv.collaborativeSettings?.requireApproval).toBe(false);
    });

    it("creates conversation with collaborativeSettings (requireApproval=true)", async () => {
      const space = ctx.memorySpaceId("collab-approval");
      const owner = ctx.userId("collab-owner");
      const agent = ctx.agentId("collab-agent-a");

      const conv = await cortex.conversations.create({
        memorySpaceId: space,
        type: "user-agent",
        participants: { userId: owner, agentId: agent },
        collaborativeSettings: {
          requireApproval: true,
          ownerUserId: owner,
        },
      });

      expect(conv.collaborativeSettings?.requireApproval).toBe(true);
      expect(conv.collaborativeSettings?.ownerUserId).toBe(owner);
    });

    it("creates conversation with approvedParticipants list", async () => {
      const space = ctx.memorySpaceId("collab-approved");
      const owner = ctx.userId("collab-owner-ap");
      const approved = ctx.userId("collab-approved-ap");
      const agent = ctx.agentId("collab-agent-ap");

      const conv = await cortex.conversations.create({
        memorySpaceId: space,
        type: "user-agent",
        participants: {
          userIds: [owner, approved],
          agentId: agent,
        },
        collaborativeSettings: {
          requireApproval: true,
          ownerUserId: owner,
          approvedParticipants: [approved],
        },
      });

      expect(conv.collaborativeSettings?.approvedParticipants).toContain(
        approved,
      );
    });
  });

  describe("Message approval workflow", () => {
    it("owner message is auto-approved", async () => {
      const space = ctx.memorySpaceId("msg-owner");
      const owner = ctx.userId("msg-owner-user");
      const agent = ctx.agentId("msg-owner-agent");

      const conv = await cortex.conversations.create({
        memorySpaceId: space,
        type: "user-agent",
        participants: { userId: owner, agentId: agent },
        collaborativeSettings: {
          requireApproval: true,
          ownerUserId: owner,
        },
      });

      // Add message as owner
      const updated = await cortex.conversations.addMessage({
        conversationId: conv.conversationId,
        message: {
          role: "user",
          content: "Owner message",
          participantId: owner,
        },
      });

      const message = updated.messages[updated.messages.length - 1];
      expect(message.approvalStatus).toBe("approved");
    });

    it("non-owner message requires approval", async () => {
      const space = ctx.memorySpaceId("msg-pending");
      const owner = ctx.userId("msg-owner-2");
      const participant = ctx.userId("msg-participant-2");
      const agent = ctx.agentId("msg-agent-2");

      const conv = await cortex.conversations.create({
        memorySpaceId: space,
        type: "user-agent",
        participants: {
          userIds: [owner, participant],
          agentId: agent,
        },
        collaborativeSettings: {
          requireApproval: true,
          ownerUserId: owner,
        },
      });

      // Add message as non-owner participant
      const updated = await cortex.conversations.addMessage({
        conversationId: conv.conversationId,
        message: {
          role: "user",
          content: "Participant message",
          participantId: participant,
        },
      });

      const message = updated.messages[updated.messages.length - 1];
      expect(message.approvalStatus).toBe("pending");
    });

    it("approved participant message is auto-approved", async () => {
      const space = ctx.memorySpaceId("msg-pre-approved");
      const owner = ctx.userId("msg-owner-3");
      const approved = ctx.userId("msg-approved-3");
      const agent = ctx.agentId("msg-agent-3");

      const conv = await cortex.conversations.create({
        memorySpaceId: space,
        type: "user-agent",
        participants: {
          userIds: [owner, approved],
          agentId: agent,
        },
        collaborativeSettings: {
          requireApproval: true,
          ownerUserId: owner,
          approvedParticipants: [approved],
        },
      });

      // Add message as pre-approved participant
      const updated = await cortex.conversations.addMessage({
        conversationId: conv.conversationId,
        message: {
          role: "user",
          content: "Pre-approved participant message",
          participantId: approved,
        },
      });

      const message = updated.messages[updated.messages.length - 1];
      expect(message.approvalStatus).toBe("approved");
    });
  });

  describe("approveMessage()", () => {
    it("approves a pending message", async () => {
      const space = ctx.memorySpaceId("approve-msg");
      const owner = TEST_USER_ID; // Use auth context user as owner
      const participant = ctx.userId("approve-participant");
      const agent = ctx.agentId("approve-agent");

      const conv = await cortex.conversations.create({
        memorySpaceId: space,
        type: "user-agent",
        participants: {
          userIds: [owner, participant],
          agentId: agent,
        },
        collaborativeSettings: {
          requireApproval: true,
          ownerUserId: owner,
        },
      });

      // Add pending message
      const withPending = await cortex.conversations.addMessage({
        conversationId: conv.conversationId,
        message: {
          role: "user",
          content: "Message to approve",
          participantId: participant,
        },
      });

      const pendingMsg = withPending.messages[withPending.messages.length - 1];
      expect(pendingMsg.approvalStatus).toBe("pending");

      // Approve the message
      const approved = await cortex.conversations.approveMessage({
        conversationId: conv.conversationId,
        messageId: pendingMsg.id,
      });

      const approvedMsg = approved.messages.find((m) => m.id === pendingMsg.id);
      expect(approvedMsg?.approvalStatus).toBe("approved");
      expect(approvedMsg?.approvedBy).toBe(owner);
      expect(approvedMsg?.approvedAt).toBeGreaterThan(0);
    });
  });

  describe("rejectMessage()", () => {
    it("rejects a pending message", async () => {
      const space = ctx.memorySpaceId("reject-msg");
      const owner = TEST_USER_ID; // Use auth context user as owner
      const participant = ctx.userId("reject-participant");
      const agent = ctx.agentId("reject-agent");

      const conv = await cortex.conversations.create({
        memorySpaceId: space,
        type: "user-agent",
        participants: {
          userIds: [owner, participant],
          agentId: agent,
        },
        collaborativeSettings: {
          requireApproval: true,
          ownerUserId: owner,
        },
      });

      // Add pending message
      const withPending = await cortex.conversations.addMessage({
        conversationId: conv.conversationId,
        message: {
          role: "user",
          content: "Message to reject",
          participantId: participant,
        },
      });

      const pendingMsg = withPending.messages[withPending.messages.length - 1];

      // Reject the message
      const rejected = await cortex.conversations.rejectMessage({
        conversationId: conv.conversationId,
        messageId: pendingMsg.id,
      });

      const rejectedMsg = rejected.messages.find((m) => m.id === pendingMsg.id);
      expect(rejectedMsg?.approvalStatus).toBe("rejected");
      expect(rejectedMsg?.approvedBy).toBe(owner);
    });
  });

  describe("No approval required (requireApproval=false)", () => {
    it("messages have no approvalStatus when approval not required", async () => {
      const space = ctx.memorySpaceId("no-approval-msg");
      const user = ctx.userId("no-approval-user");
      const agent = ctx.agentId("no-approval-agent");

      const conv = await cortex.conversations.create({
        memorySpaceId: space,
        type: "user-agent",
        participants: { userId: user, agentId: agent },
        collaborativeSettings: {
          requireApproval: false,
        },
      });

      const updated = await cortex.conversations.addMessage({
        conversationId: conv.conversationId,
        message: {
          role: "user",
          content: "No approval needed",
          participantId: user,
        },
      });

      const message = updated.messages[updated.messages.length - 1];
      // When approval is not required, status should be undefined
      expect(message.approvalStatus).toBeUndefined();
    });
  });

  describe("Backward compatibility", () => {
    it("conversation without collaborativeSettings works normally", async () => {
      const space = ctx.memorySpaceId("backward-compat");
      const user = ctx.userId("compat-user");
      const agent = ctx.agentId("compat-agent");

      // Create without collaborativeSettings
      const conv = await cortex.conversations.create({
        memorySpaceId: space,
        type: "user-agent",
        participants: { userId: user, agentId: agent },
      });

      expect(conv.collaborativeSettings).toBeUndefined();

      // Messages should work without approval flow
      const updated = await cortex.conversations.addMessage({
        conversationId: conv.conversationId,
        message: {
          role: "user",
          content: "Normal message",
        },
      });

      const message = updated.messages[updated.messages.length - 1];
      expect(message.approvalStatus).toBeUndefined();
    });
  });
});
