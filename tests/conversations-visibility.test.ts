/**
 * Cortex SDK - Conversations Visibility Tests
 *
 * Tests the Shareable Chats Phase 1 implementation:
 * - Visibility field on create
 * - checkAccess() method
 * - setVisibility() method
 *
 * PARALLEL-SAFE: Uses TestRunContext for isolated test data
 */

import { Cortex } from "../src";
import { ConvexClient } from "convex/browser";
import { createNamedTestRunContext, ScopedCleanup } from "./helpers";
import { generateTenantId, createTenantAuthContext } from "./helpers/tenancy";

describe("Conversations Visibility (Shareable Chats Phase 1)", () => {
  // Create unique test run context for parallel-safe execution
  const ctx = createNamedTestRunContext("visibility");

  let cortex: Cortex;
  let client: ConvexClient;
  let scopedCleanup: ScopedCleanup;
  const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";
  const TEST_TENANT_ID = generateTenantId("visibility");
  const TEST_USER_ID = `user_${ctx.runId}`;

  beforeAll(async () => {
    console.log(`\n🧪 Visibility Tests - Run ID: ${ctx.runId}\n`);
    console.log(`   TenantId: ${TEST_TENANT_ID}\n`);

    // Initialize SDK with auth context for multi-tenancy
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

  describe("create() with visibility", () => {
    it("creates conversation with default visibility (undefined/private)", async () => {
      const space = ctx.memorySpaceId("vis-default");
      const user = ctx.userId("vis-user-1");
      const agent = ctx.agentId("vis-agent-1");

      const result = await cortex.conversations.create({
        memorySpaceId: space,
        type: "user-agent",
        participants: {
          userId: user,
          agentId: agent,
        },
      });

      // Visibility should be undefined (defaults to 'private')
      expect(result.visibility).toBeUndefined();
      expect(result.conversationId).toMatch(/^conv-/);
    });

    it("creates conversation with explicit private visibility", async () => {
      const space = ctx.memorySpaceId("vis-private");
      const user = ctx.userId("vis-user-2");
      const agent = ctx.agentId("vis-agent-2");

      const result = await cortex.conversations.create({
        memorySpaceId: space,
        type: "user-agent",
        participants: {
          userId: user,
          agentId: agent,
        },
        visibility: "private",
      });

      expect(result.visibility).toBe("private");
    });

    it("creates conversation with space visibility", async () => {
      const space = ctx.memorySpaceId("vis-space");
      const user = ctx.userId("vis-user-3");
      const agent = ctx.agentId("vis-agent-3");

      const result = await cortex.conversations.create({
        memorySpaceId: space,
        type: "user-agent",
        participants: {
          userId: user,
          agentId: agent,
        },
        visibility: "space",
      });

      expect(result.visibility).toBe("space");
    });

    it("creates conversation with public visibility", async () => {
      const space = ctx.memorySpaceId("vis-public");
      const user = ctx.userId("vis-user-4");
      const agent = ctx.agentId("vis-agent-4");

      const result = await cortex.conversations.create({
        memorySpaceId: space,
        type: "user-agent",
        participants: {
          userId: user,
          agentId: agent,
        },
        visibility: "public",
      });

      expect(result.visibility).toBe("public");
    });

    it("rejects invalid visibility value", async () => {
      const space = ctx.memorySpaceId("vis-invalid");
      const user = ctx.userId("vis-user-5");
      const agent = ctx.agentId("vis-agent-5");

      await expect(
        cortex.conversations.create({
          memorySpaceId: space,
          type: "user-agent",
          participants: {
            userId: user,
            agentId: agent,
          },
          // @ts-expect-error - Testing invalid visibility
          visibility: "invalid-value",
        }),
      ).rejects.toThrow("Invalid visibility");
    });
  });

  describe("checkAccess()", () => {
    it("returns full access for owner", async () => {
      const space = ctx.memorySpaceId("access-owner");
      const owner = ctx.userId("access-owner-1");
      const agent = ctx.agentId("access-agent-1");

      // Create a conversation
      const conv = await cortex.conversations.create({
        memorySpaceId: space,
        type: "user-agent",
        participants: {
          userId: owner,
          agentId: agent,
        },
        visibility: "private",
      });

      // Check access as owner
      const access = await cortex.conversations.checkAccess({
        conversationId: conv.conversationId,
        userId: owner,
      });

      expect(access.canView).toBe(true);
      expect(access.canEdit).toBe(true);
      expect(access.reason).toBe("OWNER");
      expect(access.visibility).toBe("private");
    });

    it("returns no access for private conversation (non-owner)", async () => {
      const space = ctx.memorySpaceId("access-private");
      const owner = ctx.userId("access-owner-2");
      const other = ctx.userId("access-other-2");
      const agent = ctx.agentId("access-agent-2");

      // Create a private conversation
      const conv = await cortex.conversations.create({
        memorySpaceId: space,
        type: "user-agent",
        participants: {
          userId: owner,
          agentId: agent,
        },
        visibility: "private",
      });

      // Check access as non-owner
      const access = await cortex.conversations.checkAccess({
        conversationId: conv.conversationId,
        userId: other,
      });

      expect(access.canView).toBe(false);
      expect(access.canEdit).toBe(false);
      expect(access.reason).toBe("PRIVATE_VISIBILITY");
    });

    it("returns view access for public conversation (non-owner)", async () => {
      const space = ctx.memorySpaceId("access-public");
      const owner = ctx.userId("access-owner-3");
      const other = ctx.userId("access-other-3");
      const agent = ctx.agentId("access-agent-3");

      // Create a public conversation
      const conv = await cortex.conversations.create({
        memorySpaceId: space,
        type: "user-agent",
        participants: {
          userId: owner,
          agentId: agent,
        },
        visibility: "public",
      });

      // Check access as non-owner
      const access = await cortex.conversations.checkAccess({
        conversationId: conv.conversationId,
        userId: other,
      });

      expect(access.canView).toBe(true);
      expect(access.canEdit).toBe(false);
      expect(access.reason).toBe("PUBLIC_VISIBILITY");
      expect(access.visibility).toBe("public");
    });

    it("returns view access for space visibility (same space)", async () => {
      const space = ctx.memorySpaceId("access-space");
      const owner = ctx.userId("access-owner-4");
      const spaceMember = ctx.userId("access-member-4");
      const agent = ctx.agentId("access-agent-4");

      // Create a space-visible conversation
      const conv = await cortex.conversations.create({
        memorySpaceId: space,
        type: "user-agent",
        participants: {
          userId: owner,
          agentId: agent,
        },
        visibility: "space",
      });

      // Check access as space member
      const access = await cortex.conversations.checkAccess({
        conversationId: conv.conversationId,
        userId: spaceMember,
        memorySpaceId: space,
      });

      expect(access.canView).toBe(true);
      expect(access.canEdit).toBe(false);
      expect(access.reason).toBe("SPACE_MEMBER");
      expect(access.visibility).toBe("space");
    });

    it("returns no access for space visibility (different space)", async () => {
      const space = ctx.memorySpaceId("access-space-diff");
      const otherSpace = ctx.memorySpaceId("access-space-other");
      const owner = ctx.userId("access-owner-5");
      const other = ctx.userId("access-other-5");
      const agent = ctx.agentId("access-agent-5");

      // Create a space-visible conversation
      const conv = await cortex.conversations.create({
        memorySpaceId: space,
        type: "user-agent",
        participants: {
          userId: owner,
          agentId: agent,
        },
        visibility: "space",
      });

      // Check access from different space
      const access = await cortex.conversations.checkAccess({
        conversationId: conv.conversationId,
        userId: other,
        memorySpaceId: otherSpace,
      });

      expect(access.canView).toBe(false);
      expect(access.canEdit).toBe(false);
      expect(access.reason).toBe("NOT_IN_MEMORY_SPACE");
    });

    it("returns not found for non-existent conversation", async () => {
      const access = await cortex.conversations.checkAccess({
        conversationId: "conv-nonexistent-12345",
        userId: ctx.userId("access-any"),
      });

      expect(access.canView).toBe(false);
      expect(access.canEdit).toBe(false);
      expect(access.reason).toBe("CONVERSATION_NOT_FOUND");
      expect(access.visibility).toBeNull();
    });
  });

  describe("setVisibility()", () => {
    it("changes visibility from private to public", async () => {
      const space = ctx.memorySpaceId("set-vis-1");
      // Use the auth context user ID for ownership
      const user = TEST_USER_ID;
      const agent = ctx.agentId("set-vis-agent-1");

      // Create with private visibility
      const conv = await cortex.conversations.create({
        memorySpaceId: space,
        type: "user-agent",
        participants: {
          userId: user,
          agentId: agent,
        },
        visibility: "private",
      });

      expect(conv.visibility).toBe("private");

      // Change to public
      const updated = await cortex.conversations.setVisibility({
        conversationId: conv.conversationId,
        visibility: "public",
      });

      expect(updated.visibility).toBe("public");
      expect(updated.conversationId).toBe(conv.conversationId);
    });

    it("changes visibility from public to space", async () => {
      const space = ctx.memorySpaceId("set-vis-2");
      const user = TEST_USER_ID;
      const agent = ctx.agentId("set-vis-agent-2");

      // Create with public visibility
      const conv = await cortex.conversations.create({
        memorySpaceId: space,
        type: "user-agent",
        participants: {
          userId: user,
          agentId: agent,
        },
        visibility: "public",
      });

      // Change to space
      const updated = await cortex.conversations.setVisibility({
        conversationId: conv.conversationId,
        visibility: "space",
      });

      expect(updated.visibility).toBe("space");
    });

    it("changes visibility from space to private", async () => {
      const space = ctx.memorySpaceId("set-vis-3");
      const user = TEST_USER_ID;
      const agent = ctx.agentId("set-vis-agent-3");

      // Create with space visibility
      const conv = await cortex.conversations.create({
        memorySpaceId: space,
        type: "user-agent",
        participants: {
          userId: user,
          agentId: agent,
        },
        visibility: "space",
      });

      // Change to private
      const updated = await cortex.conversations.setVisibility({
        conversationId: conv.conversationId,
        visibility: "private",
      });

      expect(updated.visibility).toBe("private");
    });

    it("rejects invalid visibility value", async () => {
      const space = ctx.memorySpaceId("set-vis-invalid");
      const user = TEST_USER_ID;
      const agent = ctx.agentId("set-vis-agent-invalid");

      const conv = await cortex.conversations.create({
        memorySpaceId: space,
        type: "user-agent",
        participants: {
          userId: user,
          agentId: agent,
        },
      });

      await expect(
        cortex.conversations.setVisibility({
          conversationId: conv.conversationId,
          // @ts-expect-error - Testing invalid visibility
          visibility: "invalid",
        }),
      ).rejects.toThrow("Invalid visibility");
    });
  });

  describe("getOrCreate() with visibility", () => {
    it("creates new conversation with visibility", async () => {
      const space = ctx.memorySpaceId("getorcreate-vis");
      const user = ctx.userId("getorcreate-user");
      const agent = ctx.agentId("getorcreate-agent");

      const result = await cortex.conversations.getOrCreate({
        memorySpaceId: space,
        type: "user-agent",
        participants: {
          userId: user,
          agentId: agent,
        },
        visibility: "public",
      });

      expect(result.visibility).toBe("public");
      expect(result.conversationId).toMatch(/^conv-/);
    });

    it("returns existing conversation (ignores new visibility)", async () => {
      const space = ctx.memorySpaceId("getorcreate-exist");
      const user = ctx.userId("getorcreate-user-2");
      const agent = ctx.agentId("getorcreate-agent-2");

      // Create first with private
      const first = await cortex.conversations.getOrCreate({
        memorySpaceId: space,
        type: "user-agent",
        participants: {
          userId: user,
          agentId: agent,
        },
        visibility: "private",
      });

      expect(first.visibility).toBe("private");

      // Try to "create" again with public (should return existing)
      const second = await cortex.conversations.getOrCreate({
        memorySpaceId: space,
        type: "user-agent",
        participants: {
          userId: user,
          agentId: agent,
        },
        visibility: "public", // This should be ignored
      });

      // Should return the same conversation with original visibility
      expect(second.conversationId).toBe(first.conversationId);
      expect(second.visibility).toBe("private");
    });
  });
});
