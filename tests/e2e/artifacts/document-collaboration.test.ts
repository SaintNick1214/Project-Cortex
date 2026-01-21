/**
 * E2E Tests: Document Collaboration Flow
 *
 * End-to-end tests simulating real-world document collaboration scenarios:
 * - Create document with initial content
 * - Multiple updates building version history
 * - Navigate with undo/redo
 * - Verify conversation linkage
 * - Multi-user collaboration patterns
 */

import { Cortex } from "../../../src";
import { createTestRunContext } from "../../helpers/isolation";
import {
  generateTenantId,
  generateTenantUserId,
  createTenantAuthContext,
} from "../../helpers/tenancy";

// Test context for isolation
const ctx = createTestRunContext();

// Skip tests if no Convex URL configured
const describeWithConvex = process.env.CONVEX_URL ? describe : describe.skip;

describeWithConvex("E2E: Document Collaboration Flow", () => {
  let cortex: Cortex;
  let testTenantId: string;
  let testUserId: string;
  let testMemorySpaceId: string;

  // Test artifacts to clean up
  const createdArtifactIds: string[] = [];
  const createdConversationIds: string[] = [];

  beforeAll(async () => {
    testTenantId = generateTenantId("doc-collab-e2e");
    testUserId = generateTenantUserId(testTenantId);
    testMemorySpaceId = `space_${ctx.runId}`;

    const authContext = createTenantAuthContext(testTenantId, testUserId);

    cortex = new Cortex({
      convexUrl: process.env.CONVEX_URL!,
      auth: authContext,
    });

    // Register memory space
    await cortex.memorySpaces.register({
      memorySpaceId: testMemorySpaceId,
      name: "Document Collaboration E2E Test Space",
      type: "custom",
    });
  });

  afterAll(async () => {
    // Clean up artifacts
    for (const artifactId of createdArtifactIds) {
      try {
        await cortex.artifacts.delete(artifactId, true);
      } catch {
        // Ignore cleanup errors
      }
    }

    // Clean up conversations
    for (const conversationId of createdConversationIds) {
      try {
        await cortex.conversations.delete(conversationId);
      } catch {
        // Ignore cleanup errors
      }
    }

    // Clean up memory space
    try {
      await cortex.memorySpaces.delete(testMemorySpaceId, {
        cascade: true,
        reason: "Test cleanup",
      });
    } catch {
      // Ignore cleanup errors
    }
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Scenario 1: Multi-Version Document Workflow
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Scenario 1: Multi-Version Document Workflow", () => {
    const documentVersions = [
      { title: "Meeting Notes v1", content: "# Meeting Notes\n\n- Agenda item 1" },
      {
        title: "Meeting Notes v2",
        content: "# Meeting Notes\n\n- Agenda item 1\n- Agenda item 2",
      },
      {
        title: "Meeting Notes v3",
        content: "# Meeting Notes\n\n- Agenda item 1\n- Agenda item 2\n- Action items",
      },
      {
        title: "Meeting Notes - Final",
        content:
          "# Meeting Notes - Final\n\n- Agenda item 1\n- Agenda item 2\n- Action items\n- Next steps",
      },
    ];

    let documentId: string;

    it("should create document with initial content", async () => {
      const artifact = await cortex.artifacts.create({
        memorySpaceId: testMemorySpaceId,
        title: documentVersions[0].title,
        content: documentVersions[0].content,
        kind: "text",
        streamingState: "final",
        tags: ["meeting", "notes"],
        metadata: {
          mimeType: "text/markdown",
          category: "meeting-notes",
        },
      });

      documentId = artifact.artifactId;
      createdArtifactIds.push(documentId);

      expect(artifact.version).toBe(1);
      expect(artifact.versionPointer).toBe(1);
      expect(artifact.content).toBe(documentVersions[0].content);
    });

    it("should build version history with multiple updates", async () => {
      // Update to v2
      let updated = await cortex.artifacts.update(documentId, documentVersions[1].content, {
        title: documentVersions[1].title,
        changeSummary: "Added second agenda item",
      });
      expect(updated.version).toBe(2);
      expect(updated.versionPointer).toBe(2);

      // Update to v3
      updated = await cortex.artifacts.update(documentId, documentVersions[2].content, {
        title: documentVersions[2].title,
        changeSummary: "Added action items section",
      });
      expect(updated.version).toBe(3);
      expect(updated.versionPointer).toBe(3);

      // Update to v4 (final)
      updated = await cortex.artifacts.update(documentId, documentVersions[3].content, {
        title: documentVersions[3].title,
        changeSummary: "Added next steps, marked as final",
      });
      expect(updated.version).toBe(4);
      expect(updated.versionPointer).toBe(4);

      // Verify version history
      const history = await cortex.artifacts.getHistory(documentId);
      expect(history.length).toBe(4);

      for (let i = 0; i < 4; i++) {
        expect(history[i].version).toBe(i + 1);
        expect(history[i].content).toBe(documentVersions[i].content);
      }
    });

    it("should navigate version history with undo/redo", async () => {
      // Start at v4
      let doc = await cortex.artifacts.get(documentId);
      expect(doc?.versionPointer).toBe(4);
      expect(doc?.content).toBe(documentVersions[3].content);

      // Undo to v3
      let undoResult = await cortex.artifacts.undo(documentId);
      expect(undoResult.success).toBe(true);
      expect(undoResult.currentVersion).toBe(3);
      doc = await cortex.artifacts.get(documentId);
      expect(doc?.content).toBe(documentVersions[2].content);

      // Undo to v2
      undoResult = await cortex.artifacts.undo(documentId);
      expect(undoResult.success).toBe(true);
      doc = await cortex.artifacts.get(documentId);
      expect(doc?.content).toBe(documentVersions[1].content);

      // Redo to v3
      const redoResult = await cortex.artifacts.redo(documentId);
      expect(redoResult.success).toBe(true);
      expect(redoResult.currentVersion).toBe(3);
      doc = await cortex.artifacts.get(documentId);
      expect(doc?.content).toBe(documentVersions[2].content);

      // Verify we can retrieve any historical version directly
      const v1 = await cortex.artifacts.getVersion(documentId, 1);
      expect(v1?.content).toBe(documentVersions[0].content);

      // Restore to latest
      await cortex.artifacts.redo(documentId);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Scenario 2: Document with Conversation Reference
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Scenario 2: Document with Conversation Linkage", () => {
    let conversationId: string;
    let documentId: string;

    beforeAll(async () => {
      // Create a conversation
      const conversation = await cortex.conversations.create({
        memorySpaceId: testMemorySpaceId,
        type: "user-agent",
        participants: {
          userId: testUserId,
          agentId: "doc-assistant",
        },
      });
      conversationId = conversation.conversationId;
      createdConversationIds.push(conversationId);
    });

    it("should create document linked to conversation", async () => {
      const artifact = await cortex.artifacts.create({
        memorySpaceId: testMemorySpaceId,
        title: "AI-Generated Summary",
        content: "# Summary\n\nThis document was generated during our conversation.",
        kind: "text",
        streamingState: "final",
        conversationRef: {
          conversationId,
          messageId: "msg-001",
        },
      });

      documentId = artifact.artifactId;
      createdArtifactIds.push(documentId);

      expect(artifact.conversationRef).toBeDefined();
      expect(artifact.conversationRef?.conversationId).toBe(conversationId);
    });

    it("should maintain conversation reference across updates", async () => {
      const updated = await cortex.artifacts.update(
        documentId,
        "# Summary\n\nUpdated content from follow-up conversation.",
        {
          changeSummary: "Updated based on conversation",
        },
      );

      // Conversation reference should be maintained
      expect(updated.conversationRef?.conversationId).toBe(conversationId);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Scenario 3: Concurrent Document Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Scenario 3: Sequential Document Operations", () => {
    it("should handle rapid sequential updates correctly", async () => {
      const artifact = await cortex.artifacts.create({
        memorySpaceId: testMemorySpaceId,
        title: "Rapid Update Test",
        content: "Initial content",
        kind: "text",
        streamingState: "final",
      });

      createdArtifactIds.push(artifact.artifactId);

      // Perform sequential updates
      const updateCount = 5;
      for (let i = 1; i <= updateCount; i++) {
        await cortex.artifacts.update(
          artifact.artifactId,
          `Content version ${i + 1}`,
          { changeSummary: `Update ${i}` },
        );
      }

      // Verify final state
      const final = await cortex.artifacts.get(artifact.artifactId);
      expect(final?.version).toBe(updateCount + 1);
      expect(final?.content).toBe(`Content version ${updateCount + 1}`);

      // Verify complete history
      const history = await cortex.artifacts.getHistory(artifact.artifactId);
      expect(history.length).toBe(updateCount + 1);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Scenario 4: Document Metadata and Tags
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Scenario 4: Document Metadata and Tags", () => {
    let documentId: string;

    it("should create document with rich metadata", async () => {
      const artifact = await cortex.artifacts.create({
        memorySpaceId: testMemorySpaceId,
        title: "Project Proposal",
        content: "# Project Proposal\n\nExecutive summary...",
        kind: "text",
        streamingState: "final",
        tags: ["proposal", "project", "draft"],
        metadata: {
          author: testUserId,
          department: "Engineering",
          priority: "high",
          reviewers: ["alice", "bob"],
          dueDate: "2026-02-01",
        },
      });

      documentId = artifact.artifactId;
      createdArtifactIds.push(documentId);

      expect(artifact.tags).toContain("proposal");
      expect(artifact.tags).toContain("project");
      expect(artifact.metadata?.priority).toBe("high");
    });

    it("should update metadata and tags", async () => {
      const updated = await cortex.artifacts.update(
        documentId,
        "# Project Proposal - Revised\n\nExecutive summary with updates...",
        {
          tags: ["proposal", "project", "reviewed"],
          metadata: {
            author: testUserId,
            department: "Engineering",
            priority: "high",
            reviewers: ["alice", "bob"],
            dueDate: "2026-02-01",
            reviewedAt: Date.now(),
            status: "approved",
          },
        },
      );

      expect(updated.tags).toContain("reviewed");
      expect(updated.tags).not.toContain("draft");
      expect(updated.metadata?.status).toBe("approved");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Scenario 5: Document Soft Delete and Recovery
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Scenario 5: Document Soft Delete", () => {
    it("should soft delete document and exclude from listings", async () => {
      // Create document
      const artifact = await cortex.artifacts.create({
        memorySpaceId: testMemorySpaceId,
        title: "To Be Deleted",
        content: "This document will be soft deleted",
        kind: "text",
        streamingState: "final",
        tags: ["delete-test"],
      });

      createdArtifactIds.push(artifact.artifactId);

      // Soft delete
      const result = await cortex.artifacts.delete(artifact.artifactId, false);
      expect(result.deleted).toBe(true);

      // Should not appear in regular listings
      const listings = await cortex.artifacts.list({
        memorySpaceId: testMemorySpaceId,
        tags: ["delete-test"],
      });

      const found = listings.find((a) => a.artifactId === artifact.artifactId);
      expect(found).toBeUndefined();

      // Should appear when including deleted
      const deletedListings = await cortex.artifacts.list({
        memorySpaceId: testMemorySpaceId,
        tags: ["delete-test"],
        includeDeleted: true,
      });

      const foundDeleted = deletedListings.find(
        (a) => a.artifactId === artifact.artifactId,
      );
      expect(foundDeleted).toBeDefined();
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Scenario 6: Document Version History Filtering
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Scenario 6: Version History Options", () => {
    let documentId: string;

    beforeAll(async () => {
      // Create document with multiple versions
      const artifact = await cortex.artifacts.create({
        memorySpaceId: testMemorySpaceId,
        title: "History Test",
        content: "Version 1",
        kind: "text",
        streamingState: "final",
      });

      documentId = artifact.artifactId;
      createdArtifactIds.push(documentId);

      // Create more versions
      for (let i = 2; i <= 10; i++) {
        await cortex.artifacts.update(documentId, `Version ${i}`);
      }
    });

    it("should retrieve full history", async () => {
      const history = await cortex.artifacts.getHistory(documentId);
      expect(history.length).toBe(10);
    });

    it("should retrieve history with limit", async () => {
      const history = await cortex.artifacts.getHistory(documentId, {
        limit: 3,
      });
      expect(history.length).toBe(3);
    });

    it("should retrieve history with limit", async () => {
      const history = await cortex.artifacts.getHistory(documentId, {
        limit: 7,
      });

      // Should return at most 7 versions
      expect(history.length).toBeLessThanOrEqual(7);
    });
  });
});
