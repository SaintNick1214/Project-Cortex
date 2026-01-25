/**
 * Cortex SDK - Conversation Snapshots Tests
 *
 * Tests the Shareable Chats Phase 3 implementation:
 * - snapshot() method with all options
 * - getSnapshot() method
 * - listSnapshots() method
 * - deleteSnapshot() method
 * - PII redaction verification
 *
 * PARALLEL-SAFE: Uses TestRunContext for isolated test data
 */

import { Cortex } from "../src";
import { createNamedTestRunContext, ScopedCleanup } from "./helpers";
import { generateTenantId, createTenantAuthContext } from "./helpers/tenancy";
import { ConvexClient } from "convex/browser";

describe("Conversation Snapshots (Shareable Chats Phase 3)", () => {
  const ctx = createNamedTestRunContext("snapshots");

  let cortex: Cortex;
  let client: ConvexClient;
  let scopedCleanup: ScopedCleanup;
  const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";
  const TEST_TENANT_ID = generateTenantId("snapshots");
  const TEST_USER_ID = `user_${ctx.runId}`;

  beforeAll(async () => {
    console.log(`\n🧪 Snapshots Tests - Run ID: ${ctx.runId}\n`);

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

  describe("snapshot()", () => {
    it("creates a basic snapshot", async () => {
      const space = ctx.memorySpaceId("snap-basic");
      const user = ctx.userId("snap-user-1");
      const agent = ctx.agentId("snap-agent-1");

      // Create a conversation with messages
      const conv = await cortex.conversations.create({
        memorySpaceId: space,
        type: "user-agent",
        participants: { userId: user, agentId: agent },
      });

      // Add some messages
      await cortex.conversations.addMessage({
        conversationId: conv.conversationId,
        message: { role: "user", content: "Hello, this is a test message" },
      });
      await cortex.conversations.addMessage({
        conversationId: conv.conversationId,
        message: { role: "agent", content: "Hello! I received your message." },
      });

      // Create snapshot
      const result = await cortex.conversations.snapshot({
        conversationId: conv.conversationId,
      });

      expect(result.snapshotId).toMatch(/^snap-/);
      expect(result.snapshot.conversationId).toBe(conv.conversationId);
      expect(result.snapshot.status).toBe("active");
      expect(result.snapshot.messageCount).toBe(2);
      expect(result.snapshot.messages.length).toBe(2);
    });

    it("creates snapshot with PII redaction enabled", async () => {
      const space = ctx.memorySpaceId("snap-pii");
      const user = ctx.userId("snap-user-2");
      const agent = ctx.agentId("snap-agent-2");

      const conv = await cortex.conversations.create({
        memorySpaceId: space,
        type: "user-agent",
        participants: { userId: user, agentId: agent },
      });

      // Add message with PII
      await cortex.conversations.addMessage({
        conversationId: conv.conversationId,
        message: {
          role: "user",
          content: "My email is test@example.com and phone is 555-123-4567",
        },
      });

      // Create snapshot with PII redaction
      const result = await cortex.conversations.snapshot({
        conversationId: conv.conversationId,
        redactPII: true,
      });

      expect(result.snapshot.redaction.piiRedacted).toBe(true);
      // Check that PII was redacted
      const messageContent = result.snapshot.messages[0].content;
      expect(messageContent).toContain("[EMAIL]");
      expect(messageContent).toContain("[PHONE]");
      expect(messageContent).not.toContain("test@example.com");
      expect(messageContent).not.toContain("555-123-4567");
    });

    it("creates snapshot with redactBefore timestamp", async () => {
      const space = ctx.memorySpaceId("snap-before");
      const user = ctx.userId("snap-user-3");
      const agent = ctx.agentId("snap-agent-3");

      const conv = await cortex.conversations.create({
        memorySpaceId: space,
        type: "user-agent",
        participants: { userId: user, agentId: agent },
      });

      // Add first message
      await cortex.conversations.addMessage({
        conversationId: conv.conversationId,
        message: { role: "user", content: "First message (should be redacted)" },
      });

      // Record timestamp
      const cutoffTime = Date.now();

      // Wait a bit then add second message
      await new Promise((r) => setTimeout(r, 50));
      await cortex.conversations.addMessage({
        conversationId: conv.conversationId,
        message: { role: "user", content: "Second message (should be kept)" },
      });

      // Create snapshot with redactBefore
      const result = await cortex.conversations.snapshot({
        conversationId: conv.conversationId,
        redactBefore: cutoffTime,
      });

      expect(result.snapshot.redaction.messagesRedactedBefore).toBe(cutoffTime);
      // Only the second message should be in the snapshot
      expect(result.snapshot.messageCount).toBe(1);
      expect(result.snapshot.messages[0].content).toBe(
        "Second message (should be kept)",
      );
    });

    it("creates snapshot with custom redactions", async () => {
      const space = ctx.memorySpaceId("snap-custom");
      const user = ctx.userId("snap-user-4");
      const agent = ctx.agentId("snap-agent-4");

      const conv = await cortex.conversations.create({
        memorySpaceId: space,
        type: "user-agent",
        participants: { userId: user, agentId: agent },
      });

      await cortex.conversations.addMessage({
        conversationId: conv.conversationId,
        message: {
          role: "user",
          content: "My secret code is ABC123 and password is mypass",
        },
      });

      // Create snapshot with custom redactions
      const result = await cortex.conversations.snapshot({
        conversationId: conv.conversationId,
        redactPII: true,
        customRedactions: [
          { pattern: "ABC123", replacement: "[SECRET_CODE]" },
          { pattern: "mypass", replacement: "[PASSWORD]" },
        ],
      });

      const messageContent = result.snapshot.messages[0].content;
      expect(messageContent).toContain("[SECRET_CODE]");
      expect(messageContent).toContain("[PASSWORD]");
      expect(messageContent).not.toContain("ABC123");
      expect(messageContent).not.toContain("mypass");
    });

    it("preserves conversation metadata in snapshot", async () => {
      const space = ctx.memorySpaceId("snap-meta");
      const user = ctx.userId("snap-user-5");
      const agent = ctx.agentId("snap-agent-5");

      const conv = await cortex.conversations.create({
        memorySpaceId: space,
        type: "user-agent",
        participants: { userId: user, agentId: agent },
      });

      const result = await cortex.conversations.snapshot({
        conversationId: conv.conversationId,
      });

      expect(result.snapshot.conversationType).toBe("user-agent");
      expect(result.snapshot.participants.userId).toBe(user);
      expect(result.snapshot.participants.agentId).toBe(agent);
      expect(result.snapshot.memorySpaceId).toBe(space);
      expect(result.snapshot.createdBy).toBeDefined();
      expect(result.snapshot.snapshotOf).toBeGreaterThan(0);
    });
  });

  describe("getSnapshot()", () => {
    it("retrieves a snapshot by ID", async () => {
      const space = ctx.memorySpaceId("get-snap");
      const user = ctx.userId("get-snap-user");
      const agent = ctx.agentId("get-snap-agent");

      const conv = await cortex.conversations.create({
        memorySpaceId: space,
        type: "user-agent",
        participants: { userId: user, agentId: agent },
      });

      const created = await cortex.conversations.snapshot({
        conversationId: conv.conversationId,
      });

      const retrieved = await cortex.conversations.getSnapshot(
        created.snapshotId,
      );

      expect(retrieved).not.toBeNull();
      expect(retrieved?.snapshotId).toBe(created.snapshotId);
      expect(retrieved?.conversationId).toBe(conv.conversationId);
    });

    it("returns null for non-existent snapshot", async () => {
      const result = await cortex.conversations.getSnapshot("snap-nonexistent");
      expect(result).toBeNull();
    });

    it("returns null for deleted snapshot", async () => {
      const space = ctx.memorySpaceId("del-snap-get");
      const user = ctx.userId("del-snap-user");
      const agent = ctx.agentId("del-snap-agent");

      const conv = await cortex.conversations.create({
        memorySpaceId: space,
        type: "user-agent",
        participants: { userId: user, agentId: agent },
      });

      const created = await cortex.conversations.snapshot({
        conversationId: conv.conversationId,
      });

      // Delete the snapshot
      await cortex.conversations.deleteSnapshot(created.snapshotId);

      // Should return null for deleted snapshot
      const retrieved = await cortex.conversations.getSnapshot(
        created.snapshotId,
      );
      expect(retrieved).toBeNull();
    });
  });

  describe("listSnapshots()", () => {
    it("lists all snapshots for a conversation", async () => {
      const space = ctx.memorySpaceId("list-snap");
      const user = ctx.userId("list-snap-user");
      const agent = ctx.agentId("list-snap-agent");

      const conv = await cortex.conversations.create({
        memorySpaceId: space,
        type: "user-agent",
        participants: { userId: user, agentId: agent },
      });

      // Create multiple snapshots
      await cortex.conversations.snapshot({
        conversationId: conv.conversationId,
      });
      await cortex.conversations.snapshot({
        conversationId: conv.conversationId,
      });

      const snapshots = await cortex.conversations.listSnapshots(
        conv.conversationId,
      );

      expect(snapshots.length).toBeGreaterThanOrEqual(2);
      expect(
        snapshots.every((s) => s.conversationId === conv.conversationId),
      ).toBe(true);
    });

    it("excludes deleted snapshots from list", async () => {
      const space = ctx.memorySpaceId("list-del-snap");
      const user = ctx.userId("list-del-user");
      const agent = ctx.agentId("list-del-agent");

      const conv = await cortex.conversations.create({
        memorySpaceId: space,
        type: "user-agent",
        participants: { userId: user, agentId: agent },
      });

      // Create and delete a snapshot
      const toDelete = await cortex.conversations.snapshot({
        conversationId: conv.conversationId,
      });
      await cortex.conversations.deleteSnapshot(toDelete.snapshotId);

      // Create another snapshot
      const kept = await cortex.conversations.snapshot({
        conversationId: conv.conversationId,
      });

      const snapshots = await cortex.conversations.listSnapshots(
        conv.conversationId,
      );

      // Should not include deleted snapshot
      expect(snapshots.find((s) => s.snapshotId === toDelete.snapshotId)).toBeUndefined();
      expect(snapshots.find((s) => s.snapshotId === kept.snapshotId)).toBeDefined();
    });
  });

  describe("deleteSnapshot()", () => {
    it("deletes an existing snapshot", async () => {
      const space = ctx.memorySpaceId("delete-snap");
      const user = ctx.userId("delete-snap-user");
      const agent = ctx.agentId("delete-snap-agent");

      const conv = await cortex.conversations.create({
        memorySpaceId: space,
        type: "user-agent",
        participants: { userId: user, agentId: agent },
      });

      const created = await cortex.conversations.snapshot({
        conversationId: conv.conversationId,
      });

      const result = await cortex.conversations.deleteSnapshot(
        created.snapshotId,
      );

      expect(result.deleted).toBe(true);
    });
  });

  describe("PII Redaction Patterns", () => {
    it("redacts email addresses", async () => {
      const space = ctx.memorySpaceId("pii-email");
      const user = ctx.userId("pii-user-email");
      const agent = ctx.agentId("pii-agent-email");

      const conv = await cortex.conversations.create({
        memorySpaceId: space,
        type: "user-agent",
        participants: { userId: user, agentId: agent },
      });

      await cortex.conversations.addMessage({
        conversationId: conv.conversationId,
        message: {
          role: "user",
          content: "Contact me at john.doe@company.com or jane@example.org",
        },
      });

      const result = await cortex.conversations.snapshot({
        conversationId: conv.conversationId,
        redactPII: true,
      });

      const content = result.snapshot.messages[0].content;
      expect(content).not.toContain("john.doe@company.com");
      expect(content).not.toContain("jane@example.org");
      expect(content.match(/\[EMAIL\]/g)?.length).toBe(2);
    });

    it("redacts phone numbers", async () => {
      const space = ctx.memorySpaceId("pii-phone");
      const user = ctx.userId("pii-user-phone");
      const agent = ctx.agentId("pii-agent-phone");

      const conv = await cortex.conversations.create({
        memorySpaceId: space,
        type: "user-agent",
        participants: { userId: user, agentId: agent },
      });

      await cortex.conversations.addMessage({
        conversationId: conv.conversationId,
        message: {
          role: "user",
          content: "Call me at (555) 123-4567 or 555.987.6543",
        },
      });

      const result = await cortex.conversations.snapshot({
        conversationId: conv.conversationId,
        redactPII: true,
      });

      const content = result.snapshot.messages[0].content;
      expect(content).not.toContain("555");
      expect(content.match(/\[PHONE\]/g)?.length).toBeGreaterThanOrEqual(1);
    });

    it("redacts IP addresses", async () => {
      const space = ctx.memorySpaceId("pii-ip");
      const user = ctx.userId("pii-user-ip");
      const agent = ctx.agentId("pii-agent-ip");

      const conv = await cortex.conversations.create({
        memorySpaceId: space,
        type: "user-agent",
        participants: { userId: user, agentId: agent },
      });

      await cortex.conversations.addMessage({
        conversationId: conv.conversationId,
        message: {
          role: "user",
          content: "The server IP is 192.168.1.100",
        },
      });

      const result = await cortex.conversations.snapshot({
        conversationId: conv.conversationId,
        redactPII: true,
      });

      const content = result.snapshot.messages[0].content;
      expect(content).not.toContain("192.168.1.100");
      expect(content).toContain("[IP_ADDRESS]");
    });
  });
});
