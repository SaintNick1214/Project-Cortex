/**
 * E2E Tests: Context Chains API
 *
 * Tests validate:
 * - Hierarchical workflow coordination
 * - Parent-child relationships
 * - Cross-space context sharing (Collaboration Mode)
 * - Chain traversal
 */

import { Cortex } from "../src";
import { ConvexClient } from "convex/browser";
// api is available via setupCortex if needed
import { TestCleanup } from "./helpers";

describe("Context Chains API", () => {
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

  describe("create()", () => {
    it("creates root context", async () => {
      const context = await cortex.contexts.create({
        purpose: "Process customer refund",
        memorySpaceId: "supervisor-space",
        userId: "user-123",
        data: {
          amount: 500,
          ticketId: "TICKET-456",
        },
      });

      expect(context.contextId).toMatch(/^ctx-/);
      expect(context.purpose).toBe("Process customer refund");
      expect(context.memorySpaceId).toBe("supervisor-space");
      expect(context.depth).toBe(0);
      expect(context.rootId).toBe(context.contextId); // Root points to self
      expect(context.status).toBe("active");
    });

    it("creates child context", async () => {
      const root = await cortex.contexts.create({
        purpose: "Approval workflow",
        memorySpaceId: "manager-space",
      });

      const child = await cortex.contexts.create({
        purpose: "Finance approval",
        memorySpaceId: "finance-space",
        parentId: root.contextId,
      });

      expect(child.depth).toBe(1);
      expect(child.parentId).toBe(root.contextId);
      expect(child.rootId).toBe(root.contextId);
    });

    it("links context to conversation", async () => {
      const conv = await cortex.conversations.create({
        memorySpaceId: "test-space",
        type: "user-agent",
        participants: { userId: "user-test", participantId: "agent-test" },
      });

      const msg = await cortex.conversations.addMessage({
        conversationId: conv.conversationId,
        message: { role: "user", content: "I need a refund" },
      });

      const context = await cortex.contexts.create({
        purpose: "Handle refund request",
        memorySpaceId: "supervisor-space",
        userId: "user-test",
        conversationRef: {
          conversationId: conv.conversationId,
          messageIds: [msg.messages[0].id],
        },
      });

      expect(context.conversationRef).toBeDefined();
      expect(context.conversationRef!.conversationId).toBe(conv.conversationId);
    });

    it("throws error for non-existent parent", async () => {
      // Note: This tests BACKEND validation (requires DB lookup)
      // Using a properly formatted contextId that doesn't exist in the database
      await expect(
        cortex.contexts.create({
          purpose: "Orphan context",
          memorySpaceId: "test-space",
          parentId: "ctx-9999999999-nonexistent",
        }),
      ).rejects.toThrow("PARENT_NOT_FOUND");
    });
  });

  describe("get()", () => {
    let testContextId: string;

    beforeAll(async () => {
      const context = await cortex.contexts.create({
        purpose: "Test context for retrieval",
        memorySpaceId: "test-space",
        data: { test: true },
      });

      testContextId = context.contextId;
    });

    it("retrieves existing context", async () => {
      const context = await cortex.contexts.get(testContextId);

      expect(context).not.toBeNull();
      expect((context as any).contextId).toBe(testContextId);
    });

    it("returns null for non-existent context", async () => {
      // Using a properly formatted contextId that doesn't exist in the database
      const context = await cortex.contexts.get("ctx-9999999999-nonexistent");

      expect(context).toBeNull();
    });

    it("includes full chain when requested", async () => {
      const root = await cortex.contexts.create({
        purpose: "Root for chain test",
        memorySpaceId: "supervisor-space",
      });

      const child1 = await cortex.contexts.create({
        purpose: "Child 1",
        memorySpaceId: "worker-1-space",
        parentId: root.contextId,
      });

      const child2 = await cortex.contexts.create({
        purpose: "Child 2",
        memorySpaceId: "worker-2-space",
        parentId: root.contextId,
      });

      const chain = await cortex.contexts.get(child1.contextId, {
        includeChain: true,
      });

      expect(chain).toBeDefined();
      expect((chain as any).current).toBeDefined();
      expect((chain as any).root).toBeDefined();
      expect((chain as any).parent).toBeDefined();
      expect((chain as any).siblings).toHaveLength(1);
      expect((chain as any).siblings[0].contextId).toBe(child2.contextId);
    });
  });

  describe("update()", () => {
    it("updates context status", async () => {
      const context = await cortex.contexts.create({
        purpose: "Update test",
        memorySpaceId: "test-space",
      });

      const updated = await cortex.contexts.update(context.contextId, {
        status: "completed",
      });

      expect(updated.status).toBe("completed");
      expect(updated.completedAt).toBeDefined();
    });

    it("updates context data", async () => {
      const context = await cortex.contexts.create({
        purpose: "Data update test",
        memorySpaceId: "test-space",
        data: { step: 1 },
      });

      const updated = await cortex.contexts.update(context.contextId, {
        data: { step: 2, progress: "50%" },
      });

      expect(updated.data).toBeDefined();
      expect((updated.data as any).step).toBe(2);
      expect((updated.data as any).progress).toBe("50%");
    });
  });

  describe("delete()", () => {
    it("deletes context without children", async () => {
      const context = await cortex.contexts.create({
        purpose: "Delete test",
        memorySpaceId: "test-space",
      });

      const result = await cortex.contexts.delete(context.contextId);

      expect(result.deleted).toBe(true);

      // Verify deleted
      const deleted = await cortex.contexts.get(context.contextId);

      expect(deleted).toBeNull();
    });

    it("throws error when deleting parent with children", async () => {
      // Note: This tests BACKEND validation (requires DB lookup)
      const root = await cortex.contexts.create({
        purpose: "Parent with children",
        memorySpaceId: "supervisor-space",
      });

      await cortex.contexts.create({
        purpose: "Child",
        memorySpaceId: "worker-space",
        parentId: root.contextId,
      });

      await expect(cortex.contexts.delete(root.contextId)).rejects.toThrow(
        "HAS_CHILDREN",
      );
    });

    it("deletes with cascade", async () => {
      const root = await cortex.contexts.create({
        purpose: "Cascade test root",
        memorySpaceId: "supervisor-space",
      });

      const child1 = await cortex.contexts.create({
        purpose: "Cascade child 1",
        memorySpaceId: "worker-space",
        parentId: root.contextId,
      });

      await cortex.contexts.create({
        purpose: "Cascade child 2",
        memorySpaceId: "worker-space",
        parentId: root.contextId,
      });

      // Grandchild
      await cortex.contexts.create({
        purpose: "Grandchild",
        memorySpaceId: "worker-space",
        parentId: child1.contextId,
      });

      const result = await cortex.contexts.delete(root.contextId, {
        cascadeChildren: true,
      });

      expect(result.deleted).toBe(true);
      expect(result.descendantsDeleted).toBeGreaterThanOrEqual(3);
    });
  });

  describe("list()", () => {
    beforeAll(async () => {
      await cortex.contexts.create({
        purpose: "List test 1",
        memorySpaceId: "space-a",
        status: "active",
      });

      await cortex.contexts.create({
        purpose: "List test 2",
        memorySpaceId: "space-a",
        status: "completed",
      });

      await cortex.contexts.create({
        purpose: "List test 3",
        memorySpaceId: "space-b",
        status: "active",
      });
    });

    it("lists all contexts", async () => {
      const contexts = await cortex.contexts.list();

      expect(contexts.length).toBeGreaterThanOrEqual(3);
    });

    it("filters by memorySpaceId", async () => {
      const contexts = await cortex.contexts.list({
        memorySpaceId: "space-a",
      });

      expect(contexts.length).toBeGreaterThanOrEqual(2);
      contexts.forEach((c) => {
        expect(c.memorySpaceId).toBe("space-a");
      });
    });

    it("filters by status", async () => {
      const active = await cortex.contexts.list({ status: "active" });

      active.forEach((c) => {
        expect(c.status).toBe("active");
      });
    });

    it("filters by depth", async () => {
      const roots = await cortex.contexts.list({ depth: 0 });

      roots.forEach((c) => {
        expect(c.depth).toBe(0);
      });
    });
  });

  describe("count()", () => {
    it("counts all contexts", async () => {
      const count = await cortex.contexts.count();

      expect(count).toBeGreaterThanOrEqual(1);
    });

    it("counts by memorySpaceId", async () => {
      const count = await cortex.contexts.count({
        memorySpaceId: "space-a",
      });

      expect(count).toBeGreaterThanOrEqual(1);
    });

    it("counts by status", async () => {
      const activeCount = await cortex.contexts.count({ status: "active" });

      expect(activeCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe("getChain()", () => {
    let rootId: string;
    let child1Id: string;
    let child2Id: string;
    let grandchildId: string;

    beforeAll(async () => {
      const root = await cortex.contexts.create({
        purpose: "Chain test root",
        memorySpaceId: "supervisor-space",
      });
      rootId = root.contextId;

      const child1 = await cortex.contexts.create({
        purpose: "Chain child 1",
        memorySpaceId: "worker-1-space",
        parentId: rootId,
      });
      child1Id = child1.contextId;

      const child2 = await cortex.contexts.create({
        purpose: "Chain child 2",
        memorySpaceId: "worker-2-space",
        parentId: rootId,
      });
      child2Id = child2.contextId;

      const grandchild = await cortex.contexts.create({
        purpose: "Chain grandchild",
        memorySpaceId: "worker-1-space",
        parentId: child1Id,
      });
      grandchildId = grandchild.contextId;
    });

    it("returns complete chain", async () => {
      const chain = await cortex.contexts.getChain(child1Id);

      expect(chain.current.contextId).toBe(child1Id);
      expect(chain.root.contextId).toBe(rootId);
      expect(chain.parent!.contextId).toBe(rootId);
      expect(chain.children).toHaveLength(1);
      expect(chain.children[0].contextId).toBe(grandchildId);
      expect(chain.siblings).toHaveLength(1);
      expect(chain.siblings[0].contextId).toBe(child2Id);
      expect(chain.depth).toBe(1);
    });

    it("returns chain from root", async () => {
      const chain = await cortex.contexts.getChain(rootId);

      expect(chain.depth).toBe(0);
      expect(chain.parent).toBeFalsy(); // null or undefined for root
      expect(chain.children).toHaveLength(2);
    });

    it("returns chain from leaf", async () => {
      const chain = await cortex.contexts.getChain(grandchildId);

      expect(chain.depth).toBe(2);
      expect(chain.ancestors).toHaveLength(2); // root + child1
      expect(chain.children).toHaveLength(0);
    });
  });

  describe("getRoot()", () => {
    it("returns root from any depth", async () => {
      const root = await cortex.contexts.create({
        purpose: "Root for getRoot test",
        memorySpaceId: "supervisor-space",
      });

      const child = await cortex.contexts.create({
        purpose: "Child",
        memorySpaceId: "worker-space",
        parentId: root.contextId,
      });

      const grandchild = await cortex.contexts.create({
        purpose: "Grandchild",
        memorySpaceId: "worker-space",
        parentId: child.contextId,
      });

      const foundRoot = await cortex.contexts.getRoot(grandchild.contextId);

      expect(foundRoot.contextId).toBe(root.contextId);
      expect(foundRoot.depth).toBe(0);
    });
  });

  describe("getChildren()", () => {
    let parentId: string;

    beforeAll(async () => {
      const parent = await cortex.contexts.create({
        purpose: "Parent for children test",
        memorySpaceId: "supervisor-space",
      });
      parentId = parent.contextId;

      await cortex.contexts.create({
        purpose: "Active child",
        memorySpaceId: "worker-space",
        parentId,
        status: "active",
      });

      await cortex.contexts.create({
        purpose: "Completed child",
        memorySpaceId: "worker-space",
        parentId,
        status: "completed",
      });
    });

    it("returns all direct children", async () => {
      const children = await cortex.contexts.getChildren(parentId);

      expect(children).toHaveLength(2);
    });

    it("filters children by status", async () => {
      const activeChildren = await cortex.contexts.getChildren(parentId, {
        status: "active",
      });

      expect(activeChildren.length).toBeGreaterThanOrEqual(1);
      activeChildren.forEach((c) => {
        expect(c.status).toBe("active");
      });
    });

    it("returns descendants recursively", async () => {
      const root = await cortex.contexts.create({
        purpose: "Recursive test root",
        memorySpaceId: "supervisor-space",
      });

      const child = await cortex.contexts.create({
        purpose: "Child",
        memorySpaceId: "worker-space",
        parentId: root.contextId,
      });

      await cortex.contexts.create({
        purpose: "Grandchild",
        memorySpaceId: "worker-space",
        parentId: child.contextId,
      });

      const descendants = await cortex.contexts.getChildren(root.contextId, {
        recursive: true,
      });

      expect(descendants.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("addParticipant()", () => {
    it("adds participant to context", async () => {
      const context = await cortex.contexts.create({
        purpose: "Participant test",
        memorySpaceId: "supervisor-space",
      });

      const updated = await cortex.contexts.addParticipant(
        context.contextId,
        "legal-agent-space",
      );

      expect(updated.participants).toHaveLength(2);
      expect(updated.participants).toContain("legal-agent-space");
    });
  });

  describe("grantAccess() - Collaboration Mode", () => {
    it("grants cross-space access", async () => {
      const context = await cortex.contexts.create({
        purpose: "Collaboration test",
        memorySpaceId: "company-a-space",
        data: { confidential: false },
      });

      const updated = await cortex.contexts.grantAccess(
        context.contextId,
        "company-b-space",
        "read-only",
      );

      expect(updated.grantedAccess).toBeDefined();
      expect(updated.grantedAccess!.length).toBeGreaterThanOrEqual(1);
      expect(
        updated.grantedAccess!.some(
          (g) => g.memorySpaceId === "company-b-space",
        ),
      ).toBe(true);
    });
  });

  describe("Hierarchy Management", () => {
    it("maintains parent-child relationships", async () => {
      const root = await cortex.contexts.create({
        purpose: "Hierarchy root",
        memorySpaceId: "supervisor-space",
      });

      const child = await cortex.contexts.create({
        purpose: "Hierarchy child",
        memorySpaceId: "worker-space",
        parentId: root.contextId,
      });

      // Get root - should show child in childIds
      const rootRefreshed = await cortex.contexts.get(root.contextId);

      expect((rootRefreshed as any).childIds).toContain(child.contextId);
    });

    it("computes depth correctly", async () => {
      const root = await cortex.contexts.create({
        purpose: "Depth test root",
        memorySpaceId: "supervisor-space",
      });

      const child = await cortex.contexts.create({
        purpose: "Depth child",
        memorySpaceId: "worker-space",
        parentId: root.contextId,
      });

      const grandchild = await cortex.contexts.create({
        purpose: "Depth grandchild",
        memorySpaceId: "worker-space",
        parentId: child.contextId,
      });

      expect(root.depth).toBe(0);
      expect(child.depth).toBe(1);
      expect(grandchild.depth).toBe(2);
    });
  });

  describe("Cross-Operation Integration", () => {
    it("create → update → list → delete consistency", async () => {
      const created = await cortex.contexts.create({
        purpose: "Integration test context",
        memorySpaceId: "integration-space",
        data: { tag: "INTEGRATION_MARKER" },
      });

      // Update
      await cortex.contexts.update(created.contextId, {
        status: "completed",
      });

      // List
      const listed = await cortex.contexts.list({
        memorySpaceId: "integration-space",
      });

      expect(listed.some((c) => c.contextId === created.contextId)).toBe(true);

      // Count
      const count = await cortex.contexts.count({
        memorySpaceId: "integration-space",
        status: "completed",
      });

      expect(count).toBeGreaterThanOrEqual(1);

      // Delete
      await cortex.contexts.delete(created.contextId);

      // Verify deleted
      const deleted = await cortex.contexts.get(created.contextId);

      expect(deleted).toBeNull();
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Client-Side Validation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Client-Side Validation", () => {
    describe("create() validation", () => {
      it("should throw on missing purpose", async () => {
        await expect(
          cortex.contexts.create({
            purpose: "",
            memorySpaceId: "test-space",
          }),
        ).rejects.toThrow("purpose");
      });

      it("should throw on whitespace-only purpose", async () => {
        await expect(
          cortex.contexts.create({
            purpose: "   ",
            memorySpaceId: "test-space",
          }),
        ).rejects.toThrow("whitespace");
      });

      it("should throw on missing memorySpaceId", async () => {
        await expect(
          cortex.contexts.create({
            purpose: "Test",
            memorySpaceId: "",
          }),
        ).rejects.toThrow("memorySpaceId");
      });

      it("should throw on invalid parentId format", async () => {
        await expect(
          cortex.contexts.create({
            purpose: "Test",
            memorySpaceId: "test-space",
            parentId: "invalid-format",
          }),
        ).rejects.toThrow("Invalid contextId format");
      });

      it("should throw on invalid status", async () => {
        await expect(
          cortex.contexts.create({
            purpose: "Test",
            memorySpaceId: "test-space",
            status: "pending" as any,
          }),
        ).rejects.toThrow("Invalid status");
      });

      it("should throw on invalid conversationRef", async () => {
        await expect(
          cortex.contexts.create({
            purpose: "Test",
            memorySpaceId: "test-space",
            conversationRef: {} as any,
          }),
        ).rejects.toThrow("conversationId");
      });

      it("should throw on invalid data type", async () => {
        await expect(
          cortex.contexts.create({
            purpose: "Test",
            memorySpaceId: "test-space",
            data: "not an object" as any,
          }),
        ).rejects.toThrow("data must be an object");
      });
    });

    describe("get() validation", () => {
      it("should throw on missing contextId", async () => {
        await expect(cortex.contexts.get("")).rejects.toThrow("contextId");
      });

      it("should throw on invalid contextId format", async () => {
        await expect(cortex.contexts.get("invalid-id")).rejects.toThrow(
          "Invalid contextId format",
        );
      });
    });

    describe("update() validation", () => {
      it("should throw on missing contextId", async () => {
        await expect(
          cortex.contexts.update("", { status: "completed" }),
        ).rejects.toThrow("contextId");
      });

      it("should throw on invalid contextId format", async () => {
        await expect(
          cortex.contexts.update("invalid-id", { status: "completed" }),
        ).rejects.toThrow("Invalid contextId format");
      });

      it("should throw on invalid status", async () => {
        await expect(
          cortex.contexts.update("ctx-123-abc", { status: "done" as any }),
        ).rejects.toThrow("Invalid status");
      });

      it("should throw on invalid completedAt timestamp", async () => {
        await expect(
          cortex.contexts.update("ctx-123-abc", { completedAt: -1 }),
        ).rejects.toThrow("must be > 0");
      });
    });

    describe("delete() validation", () => {
      it("should throw on missing contextId", async () => {
        await expect(cortex.contexts.delete("")).rejects.toThrow("contextId");
      });

      it("should throw on invalid contextId format", async () => {
        await expect(cortex.contexts.delete("invalid-id")).rejects.toThrow(
          "Invalid contextId format",
        );
      });
    });

    describe("list() validation", () => {
      it("should throw on invalid depth", async () => {
        await expect(cortex.contexts.list({ depth: -1 })).rejects.toThrow(
          "depth must be >= 0",
        );
      });

      it("should throw on invalid limit", async () => {
        await expect(cortex.contexts.list({ limit: 0 })).rejects.toThrow(
          "limit must be > 0",
        );
      });

      it("should throw on limit exceeding max", async () => {
        await expect(cortex.contexts.list({ limit: 1001 })).rejects.toThrow(
          "limit must be <= 1000",
        );
      });

      it("should throw on invalid status", async () => {
        await expect(
          cortex.contexts.list({ status: "pending" as any }),
        ).rejects.toThrow("Invalid status");
      });

      it("should throw on invalid parentId format", async () => {
        await expect(
          cortex.contexts.list({ parentId: "invalid-format" }),
        ).rejects.toThrow("Invalid contextId format");
      });

      it("should throw on invalid rootId format", async () => {
        await expect(
          cortex.contexts.list({ rootId: "invalid-format" }),
        ).rejects.toThrow("Invalid contextId format");
      });
    });

    describe("count() validation", () => {
      it("should throw on invalid status", async () => {
        await expect(
          cortex.contexts.count({ status: "pending" as any }),
        ).rejects.toThrow("Invalid status");
      });
    });

    describe("getChain() validation", () => {
      it("should throw on missing contextId", async () => {
        await expect(cortex.contexts.getChain("")).rejects.toThrow("contextId");
      });

      it("should throw on invalid contextId format", async () => {
        await expect(cortex.contexts.getChain("invalid-id")).rejects.toThrow(
          "Invalid contextId format",
        );
      });
    });

    describe("getRoot() validation", () => {
      it("should throw on missing contextId", async () => {
        await expect(cortex.contexts.getRoot("")).rejects.toThrow("contextId");
      });

      it("should throw on invalid contextId format", async () => {
        await expect(cortex.contexts.getRoot("invalid-id")).rejects.toThrow(
          "Invalid contextId format",
        );
      });
    });

    describe("getChildren() validation", () => {
      it("should throw on missing contextId", async () => {
        await expect(cortex.contexts.getChildren("")).rejects.toThrow(
          "contextId",
        );
      });

      it("should throw on invalid contextId format", async () => {
        await expect(cortex.contexts.getChildren("invalid-id")).rejects.toThrow(
          "Invalid contextId format",
        );
      });

      it("should throw on invalid status option", async () => {
        await expect(
          cortex.contexts.getChildren("ctx-123-abc", {
            status: "pending" as any,
          }),
        ).rejects.toThrow("Invalid status");
      });
    });

    describe("addParticipant() validation", () => {
      it("should throw on missing contextId", async () => {
        await expect(
          cortex.contexts.addParticipant("", "participant-123"),
        ).rejects.toThrow("contextId");
      });

      it("should throw on invalid contextId format", async () => {
        await expect(
          cortex.contexts.addParticipant("invalid-id", "participant-123"),
        ).rejects.toThrow("Invalid contextId format");
      });

      it("should throw on empty participantId", async () => {
        await expect(
          cortex.contexts.addParticipant("ctx-123-abc", ""),
        ).rejects.toThrow("participantId");
      });
    });

    describe("removeParticipant() validation", () => {
      it("should throw on missing contextId", async () => {
        await expect(
          cortex.contexts.removeParticipant("", "participant-123"),
        ).rejects.toThrow("contextId");
      });

      it("should throw on empty participantId", async () => {
        await expect(
          cortex.contexts.removeParticipant("ctx-123-abc", ""),
        ).rejects.toThrow("participantId");
      });
    });

    describe("grantAccess() validation", () => {
      it("should throw on missing contextId", async () => {
        await expect(
          cortex.contexts.grantAccess("", "space-123", "read-only"),
        ).rejects.toThrow("contextId");
      });

      it("should throw on empty targetMemorySpaceId", async () => {
        await expect(
          cortex.contexts.grantAccess("ctx-123-abc", "", "read-only"),
        ).rejects.toThrow("targetMemorySpaceId");
      });

      it("should throw on empty scope", async () => {
        await expect(
          cortex.contexts.grantAccess("ctx-123-abc", "space-123", ""),
        ).rejects.toThrow("scope");
      });
    });

    describe("updateMany() validation", () => {
      it("should throw on empty filters", async () => {
        await expect(
          cortex.contexts.updateMany({}, { status: "completed" }),
        ).rejects.toThrow("filters must include at least one");
      });

      it("should throw on empty updates", async () => {
        await expect(
          cortex.contexts.updateMany({ memorySpaceId: "test" }, {}),
        ).rejects.toThrow("updates must include at least one");
      });

      it("should throw on invalid filter status", async () => {
        await expect(
          cortex.contexts.updateMany(
            { status: "pending" as any },
            { data: {} },
          ),
        ).rejects.toThrow("Invalid status");
      });

      it("should throw on invalid update status", async () => {
        await expect(
          cortex.contexts.updateMany(
            { memorySpaceId: "test" },
            { status: "done" as any },
          ),
        ).rejects.toThrow("Invalid status");
      });
    });

    describe("deleteMany() validation", () => {
      it("should throw on empty filters", async () => {
        await expect(cortex.contexts.deleteMany({})).rejects.toThrow(
          "filters must include at least one",
        );
      });

      it("should throw on invalid completedBefore", async () => {
        await expect(
          cortex.contexts.deleteMany({ completedBefore: -1 }),
        ).rejects.toThrow("must be > 0");
      });

      it("should throw on invalid status", async () => {
        await expect(
          cortex.contexts.deleteMany({ status: "pending" as any }),
        ).rejects.toThrow("Invalid status");
      });
    });

    describe("export() validation", () => {
      it("should throw on invalid format", async () => {
        await expect(
          cortex.contexts.export({}, { format: "xml" as any }),
        ).rejects.toThrow("Invalid format");
      });

      it("should throw on invalid filter status", async () => {
        await expect(
          cortex.contexts.export(
            { status: "pending" as any },
            { format: "json" },
          ),
        ).rejects.toThrow("Invalid status");
      });
    });

    describe("getByConversation() validation", () => {
      it("should throw on missing conversationId", async () => {
        await expect(cortex.contexts.getByConversation("")).rejects.toThrow(
          "conversationId",
        );
      });

      it("should throw on invalid conversationId format", async () => {
        await expect(
          cortex.contexts.getByConversation("invalid-id"),
        ).rejects.toThrow("Invalid conversationId format");
      });
    });

    describe("getVersion() validation", () => {
      it("should throw on missing contextId", async () => {
        await expect(cortex.contexts.getVersion("", 1)).rejects.toThrow(
          "contextId",
        );
      });

      it("should throw on invalid contextId format", async () => {
        await expect(
          cortex.contexts.getVersion("invalid-id", 1),
        ).rejects.toThrow("Invalid contextId format");
      });

      it("should throw on invalid version number", async () => {
        await expect(
          cortex.contexts.getVersion("ctx-123-abc", 0),
        ).rejects.toThrow("version must be >= 1");
      });

      it("should throw on negative version", async () => {
        await expect(
          cortex.contexts.getVersion("ctx-123-abc", -1),
        ).rejects.toThrow("version must be >= 1");
      });

      it("should throw on non-integer version", async () => {
        await expect(
          cortex.contexts.getVersion("ctx-123-abc", 1.5),
        ).rejects.toThrow("version must be an integer");
      });
    });

    describe("getHistory() validation", () => {
      it("should throw on missing contextId", async () => {
        await expect(cortex.contexts.getHistory("")).rejects.toThrow(
          "contextId",
        );
      });

      it("should throw on invalid contextId format", async () => {
        await expect(cortex.contexts.getHistory("invalid-id")).rejects.toThrow(
          "Invalid contextId format",
        );
      });
    });

    describe("getAtTimestamp() validation", () => {
      it("should throw on missing contextId", async () => {
        await expect(
          cortex.contexts.getAtTimestamp("", new Date()),
        ).rejects.toThrow("contextId");
      });

      it("should throw on invalid contextId format", async () => {
        await expect(
          cortex.contexts.getAtTimestamp("invalid-id", new Date()),
        ).rejects.toThrow("Invalid contextId format");
      });

      it("should throw on invalid date", async () => {
        await expect(
          cortex.contexts.getAtTimestamp("ctx-123-abc", new Date("invalid")),
        ).rejects.toThrow("must be a valid Date");
      });

      it("should throw on non-Date object", async () => {
        await expect(
          cortex.contexts.getAtTimestamp("ctx-123-abc", 1234567890 as any),
        ).rejects.toThrow("must be a Date object");
      });
    });
  });
});
