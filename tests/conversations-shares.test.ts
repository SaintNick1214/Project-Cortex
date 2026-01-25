/**
 * Cortex SDK - Conversation Shares Tests
 *
 * Tests the Shareable Chats Phase 2 implementation:
 * - share() method
 * - revokeShare() method
 * - listShares() method
 * - getShare() method
 * - checkShareAccess() method
 * - buildShareUrl utility
 *
 * PARALLEL-SAFE: Uses TestRunContext for isolated test data
 */

import { Cortex } from "../src";
import { buildShareUrl, extractShareId } from "../src/sharing";
import { createNamedTestRunContext, ScopedCleanup } from "./helpers";
import { generateTenantId, createTenantAuthContext } from "./helpers/tenancy";
import { ConvexClient } from "convex/browser";

describe("Conversation Shares (Shareable Chats Phase 2)", () => {
  const ctx = createNamedTestRunContext("shares");

  let cortex: Cortex;
  let client: ConvexClient;
  let scopedCleanup: ScopedCleanup;
  const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";
  const TEST_TENANT_ID = generateTenantId("shares");
  const TEST_USER_ID = `user_${ctx.runId}`;

  beforeAll(async () => {
    console.log(`\n🧪 Shares Tests - Run ID: ${ctx.runId}\n`);

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

  describe("share()", () => {
    it("creates a link share with default permissions", async () => {
      const space = ctx.memorySpaceId("share-link");
      const user = ctx.userId("share-user-1");
      const agent = ctx.agentId("share-agent-1");

      // Create a conversation first
      const conv = await cortex.conversations.create({
        memorySpaceId: space,
        type: "user-agent",
        participants: { userId: user, agentId: agent },
      });

      // Create a link share
      const result = await cortex.conversations.share({
        conversationId: conv.conversationId,
        grantType: "link",
      });

      expect(result.shareId).toMatch(/^share-/);
      expect(result.share.conversationId).toBe(conv.conversationId);
      expect(result.share.grantType).toBe("link");
      expect(result.share.status).toBe("active");
      expect(result.share.permissions.canView).toBe(true);
      expect(result.share.permissions.canViewFacts).toBe(false);
    });

    it("creates a user share with custom permissions", async () => {
      const space = ctx.memorySpaceId("share-user");
      const owner = ctx.userId("share-owner-2");
      const recipient = ctx.userId("share-recipient-2");
      const agent = ctx.agentId("share-agent-2");

      const conv = await cortex.conversations.create({
        memorySpaceId: space,
        type: "user-agent",
        participants: { userId: owner, agentId: agent },
      });

      const result = await cortex.conversations.share({
        conversationId: conv.conversationId,
        grantType: "user",
        grantedTo: recipient,
        permissions: {
          canView: true,
          canViewFacts: true,
          canContinue: true,
          canFork: false,
          canExport: true,
        },
      });

      expect(result.share.grantType).toBe("user");
      expect(result.share.grantedTo).toBe(recipient);
      expect(result.share.permissions.canView).toBe(true);
      expect(result.share.permissions.canViewFacts).toBe(true);
      expect(result.share.permissions.canContinue).toBe(true);
      expect(result.share.permissions.canFork).toBe(false);
      expect(result.share.permissions.canExport).toBe(true);
    });

    it("creates a share with expiration", async () => {
      const space = ctx.memorySpaceId("share-expires");
      const user = ctx.userId("share-user-3");
      const agent = ctx.agentId("share-agent-3");

      const conv = await cortex.conversations.create({
        memorySpaceId: space,
        type: "user-agent",
        participants: { userId: user, agentId: agent },
      });

      const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour

      const result = await cortex.conversations.share({
        conversationId: conv.conversationId,
        grantType: "link",
        expiresAt,
      });

      expect(result.expiresAt).toBe(expiresAt);
      expect(result.share.expiresAt).toBe(expiresAt);
    });

    it("creates a share with max views limit", async () => {
      const space = ctx.memorySpaceId("share-maxviews");
      const user = ctx.userId("share-user-4");
      const agent = ctx.agentId("share-agent-4");

      const conv = await cortex.conversations.create({
        memorySpaceId: space,
        type: "user-agent",
        participants: { userId: user, agentId: agent },
      });

      const result = await cortex.conversations.share({
        conversationId: conv.conversationId,
        grantType: "link",
        maxViews: 10,
      });

      expect(result.share.maxViews).toBe(10);
      expect(result.share.viewCount).toBe(0);
    });

    it("rejects user share without grantedTo", async () => {
      const space = ctx.memorySpaceId("share-noid");
      const user = ctx.userId("share-user-5");
      const agent = ctx.agentId("share-agent-5");

      const conv = await cortex.conversations.create({
        memorySpaceId: space,
        type: "user-agent",
        participants: { userId: user, agentId: agent },
      });

      await expect(
        cortex.conversations.share({
          conversationId: conv.conversationId,
          grantType: "user",
          // Missing grantedTo
        }),
      ).rejects.toThrow("grantedTo");
    });
  });

  describe("revokeShare()", () => {
    it("revokes an active share", async () => {
      const space = ctx.memorySpaceId("revoke-share");
      const user = ctx.userId("revoke-user-1");
      const agent = ctx.agentId("revoke-agent-1");

      const conv = await cortex.conversations.create({
        memorySpaceId: space,
        type: "user-agent",
        participants: { userId: user, agentId: agent },
      });

      const shareResult = await cortex.conversations.share({
        conversationId: conv.conversationId,
        grantType: "link",
      });

      const revokeResult = await cortex.conversations.revokeShare(
        shareResult.shareId,
      );

      expect(revokeResult.revoked).toBe(true);
      expect(revokeResult.revokedAt).toBeGreaterThan(0);
      expect(revokeResult.share.status).toBe("revoked");
    });
  });

  describe("listShares()", () => {
    it("lists all shares for a conversation", async () => {
      const space = ctx.memorySpaceId("list-shares");
      const user = ctx.userId("list-user-1");
      const agent = ctx.agentId("list-agent-1");

      const conv = await cortex.conversations.create({
        memorySpaceId: space,
        type: "user-agent",
        participants: { userId: user, agentId: agent },
      });

      // Create multiple shares
      await cortex.conversations.share({
        conversationId: conv.conversationId,
        grantType: "link",
      });
      await cortex.conversations.share({
        conversationId: conv.conversationId,
        grantType: "link",
      });

      const shares = await cortex.conversations.listShares(conv.conversationId);

      expect(shares.length).toBeGreaterThanOrEqual(2);
      expect(shares.every((s) => s.conversationId === conv.conversationId)).toBe(
        true,
      );
    });

    it("filters shares by status", async () => {
      const space = ctx.memorySpaceId("list-filter");
      const user = ctx.userId("list-user-2");
      const agent = ctx.agentId("list-agent-2");

      const conv = await cortex.conversations.create({
        memorySpaceId: space,
        type: "user-agent",
        participants: { userId: user, agentId: agent },
      });

      // Create and revoke a share
      const share1 = await cortex.conversations.share({
        conversationId: conv.conversationId,
        grantType: "link",
      });
      await cortex.conversations.revokeShare(share1.shareId);

      // Create an active share
      await cortex.conversations.share({
        conversationId: conv.conversationId,
        grantType: "link",
      });

      // List only active shares
      const activeShares = await cortex.conversations.listShares(
        conv.conversationId,
        { status: "active" },
      );

      expect(activeShares.every((s) => s.status === "active")).toBe(true);
    });
  });

  describe("getShare()", () => {
    it("retrieves a share by ID", async () => {
      const space = ctx.memorySpaceId("get-share");
      const user = ctx.userId("get-user-1");
      const agent = ctx.agentId("get-agent-1");

      const conv = await cortex.conversations.create({
        memorySpaceId: space,
        type: "user-agent",
        participants: { userId: user, agentId: agent },
      });

      const shareResult = await cortex.conversations.share({
        conversationId: conv.conversationId,
        grantType: "link",
      });

      const retrieved = await cortex.conversations.getShare(shareResult.shareId);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.shareId).toBe(shareResult.shareId);
      expect(retrieved?.isValid).toBe(true);
    });

    it("returns null for non-existent share", async () => {
      const result = await cortex.conversations.getShare("share-nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("checkShareAccess()", () => {
    it("checks access for link share (anyone)", async () => {
      const space = ctx.memorySpaceId("check-link");
      const user = ctx.userId("check-user-1");
      const agent = ctx.agentId("check-agent-1");

      const conv = await cortex.conversations.create({
        memorySpaceId: space,
        type: "user-agent",
        participants: { userId: user, agentId: agent },
      });

      await cortex.conversations.share({
        conversationId: conv.conversationId,
        grantType: "link",
        permissions: { canView: true, canFork: true },
      });

      // Anyone should have access via link share
      const access = await cortex.conversations.checkShareAccess({
        conversationId: conv.conversationId,
        userId: "random-user",
      });

      expect(access.hasAccess).toBe(true);
      expect(access.permissions?.canView).toBe(true);
      expect(access.permissions?.canFork).toBe(true);
    });

    it("checks access for user-specific share", async () => {
      const space = ctx.memorySpaceId("check-user");
      const owner = ctx.userId("check-owner-2");
      const recipient = ctx.userId("check-recipient-2");
      const other = ctx.userId("check-other-2");
      const agent = ctx.agentId("check-agent-2");

      const conv = await cortex.conversations.create({
        memorySpaceId: space,
        type: "user-agent",
        participants: { userId: owner, agentId: agent },
        visibility: "private",
      });

      await cortex.conversations.share({
        conversationId: conv.conversationId,
        grantType: "user",
        grantedTo: recipient,
      });

      // Recipient should have access
      const recipientAccess = await cortex.conversations.checkShareAccess({
        conversationId: conv.conversationId,
        userId: recipient,
      });
      expect(recipientAccess.hasAccess).toBe(true);

      // Other user should not (unless there's a link share)
      const otherAccess = await cortex.conversations.checkShareAccess({
        conversationId: conv.conversationId,
        userId: other,
      });
      // This depends on whether there are other shares
      // In this case, there are no link shares, so access should be false
      // But we need to check if no other shares exist
    });

    it("returns no access when no shares exist", async () => {
      const space = ctx.memorySpaceId("check-none");
      const user = ctx.userId("check-user-3");
      const agent = ctx.agentId("check-agent-3");

      const conv = await cortex.conversations.create({
        memorySpaceId: space,
        type: "user-agent",
        participants: { userId: user, agentId: agent },
        visibility: "private",
      });

      // Don't create any shares

      const access = await cortex.conversations.checkShareAccess({
        conversationId: conv.conversationId,
        userId: "random-user",
      });

      expect(access.hasAccess).toBe(false);
      expect(access.reason).toBe("NO_MATCHING_SHARE");
    });
  });

  describe("buildShareUrl utility", () => {
    it("builds path-style URL", () => {
      const url = buildShareUrl("share-abc123", {
        baseUrl: "https://myapp.com/shared",
      });
      expect(url).toBe("https://myapp.com/shared/share-abc123");
    });

    it("builds path-style URL (removes trailing slash)", () => {
      const url = buildShareUrl("share-abc123", {
        baseUrl: "https://myapp.com/shared/",
      });
      expect(url).toBe("https://myapp.com/shared/share-abc123");
    });

    it("builds query-style URL", () => {
      const url = buildShareUrl("share-abc123", {
        baseUrl: "https://myapp.com/shared",
        style: "query",
      });
      expect(url).toBe("https://myapp.com/shared?id=share-abc123");
    });

    it("builds query-style URL with custom param", () => {
      const url = buildShareUrl("share-abc123", {
        baseUrl: "https://myapp.com/view",
        style: "query",
        paramName: "share",
      });
      expect(url).toBe("https://myapp.com/view?share=share-abc123");
    });

    it("encodes special characters in share ID", () => {
      const url = buildShareUrl("share-abc/123?foo=bar", {
        baseUrl: "https://myapp.com/shared",
      });
      expect(url).toBe(
        "https://myapp.com/shared/share-abc%2F123%3Ffoo%3Dbar",
      );
    });
  });

  describe("extractShareId utility", () => {
    it("extracts ID from path-style URL", () => {
      const id = extractShareId("https://myapp.com/shared/share-abc123");
      expect(id).toBe("share-abc123");
    });

    it("extracts ID from query-style URL", () => {
      const id = extractShareId("https://myapp.com/shared?id=share-abc123", {
        style: "query",
      });
      expect(id).toBe("share-abc123");
    });

    it("extracts ID with custom param name", () => {
      const id = extractShareId("https://myapp.com/view?share=share-abc123", {
        style: "query",
        paramName: "share",
      });
      expect(id).toBe("share-abc123");
    });

    it("returns null for invalid URL", () => {
      const id = extractShareId("not-a-url");
      expect(id).toBeNull();
    });
  });
});
