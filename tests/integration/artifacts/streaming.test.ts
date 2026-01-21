/**
 * Artifacts API - Streaming Lifecycle Integration Tests
 *
 * Tests the complete streaming workflow:
 * - Start → Append × N → Finalize lifecycle
 * - Pause/Resume operations
 * - Error recovery
 * - State machine validation
 *
 * PARALLEL-SAFE: Uses TestRunContext for isolated test data
 *
 * Test IDs: INT-CRUD-005, INT-SL-001 through INT-SL-003
 */

import { Cortex } from "../../../src";
import { ConvexClient } from "convex/browser";
import { createNamedTestRunContext } from "../../helpers/isolation";
import { generateTenantId, createTenantAuthContext } from "../../helpers/tenancy";

// Skip tests if no Convex URL configured
const describeWithConvex = process.env.CONVEX_URL ? describe : describe.skip;

describeWithConvex("Artifacts Streaming Lifecycle Integration", () => {
  // Create unique test run context for parallel-safe execution
  const ctx = createNamedTestRunContext("artifacts-streaming");

  let cortex: Cortex;
  let client: ConvexClient;
  const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";

  // Multi-tenancy: Generate tenant-specific IDs
  const TEST_TENANT_ID = generateTenantId("artifacts-streaming");
  const TEST_USER_ID = `user_${ctx.runId}`;

  // Track created spaces for cleanup
  const createdSpaces: string[] = [];

  // Helper to create and track memory spaces
  const setupTestSpace = async (suffix: string): Promise<string> => {
    const spaceId = ctx.memorySpaceId(suffix);
    await cortex.memorySpaces.register({
      memorySpaceId: spaceId,
      name: `Test Space ${suffix}`,
      type: "project",
    });
    createdSpaces.push(spaceId);
    return spaceId;
  };

  beforeAll(async () => {
    console.log(`\n🧪 Artifacts Streaming Integration Tests - Run ID: ${ctx.runId}\n`);
    console.log(`   TenantId: ${TEST_TENANT_ID}\n`);

    // Initialize SDK with auth context for multi-tenancy
    const authContext = createTenantAuthContext(TEST_TENANT_ID, TEST_USER_ID);
    cortex = new Cortex({ convexUrl: CONVEX_URL, auth: authContext });

    // Direct client for storage validation
    client = new ConvexClient(CONVEX_URL);

    console.log("✅ Test isolation setup complete\n");
  });

  afterAll(async () => {
    console.log(`\n🧹 Cleaning up test run ${ctx.runId}...`);

    // Cascade cleanup all test data via memory space deletion
    for (const spaceId of createdSpaces) {
      try {
        await cortex.memorySpaces.delete(spaceId, {
          cascade: true,
          reason: "Test cleanup",
        });
      } catch {
        // Ignore cleanup errors
      }
    }

    cortex.close();
    await client.close();
    console.log(`✅ Test run ${ctx.runId} cleanup complete\n`);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // INT-CRUD-005: Streaming Workflow: Start → Append × N → Finalize
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("INT-CRUD-005: Streaming workflow", () => {
    it("should complete full streaming lifecycle", async () => {
      const spaceId = await setupTestSpace("streaming-full");

      // Create draft artifact for streaming
      const artifact = await cortex.artifacts.create({
        memorySpaceId: spaceId,
        kind: "code",
        content: "", // Empty for streaming
        title: "Streaming Full Test",
        streamingState: "draft",
      });

      expect(artifact.streamingState).toBe("draft");

      // Start streaming
      const startResult = await cortex.artifacts.startStreaming({
        artifactId: artifact.artifactId,
      });

      expect(startResult.sessionId).toBeDefined();
      expect(startResult.success).toBe(true);
      expect(startResult.currentState).toBe("streaming");

      const sessionId = startResult.sessionId;

      // Append content chunks
      const chunks = ["function ", "hello", "()", " { ", "return 'Hi!'; }"];
      for (const chunk of chunks) {
        await cortex.artifacts.appendContent({
          artifactId: artifact.artifactId,
          sessionId,
          chunk,
        });
      }

      // Verify mid-stream state
      let current = await cortex.artifacts.get(artifact.artifactId);
      expect(current?.streamingState).toBe("streaming");
      expect(current?.content).toBe("function hello() { return 'Hi!'; }");

      // Finalize streaming
      const finalResult = await cortex.artifacts.finalizeStreaming({
        artifactId: artifact.artifactId,
        sessionId,
        changeSummary: "Streaming complete",
      });

      expect(finalResult.success).toBe(true);
      expect(finalResult.currentState).toBe("final");
      expect(finalResult.versionCreated).toBe(true);

      // Verify final state
      current = await cortex.artifacts.get(artifact.artifactId);
      expect(current?.streamingState).toBe("final");
      expect(current?.content).toBe("function hello() { return 'Hi!'; }");
    });

    it("should validate sessionId during append", async () => {
      const spaceId = await setupTestSpace("streaming-session");

      const artifact = await cortex.artifacts.create({
        memorySpaceId: spaceId,
        kind: "text",
        content: "",
        title: "Session Validation Test",
        streamingState: "draft",
      });

      const { sessionId } = await cortex.artifacts.startStreaming({
        artifactId: artifact.artifactId,
      });

      // Append with wrong sessionId should fail
      await expect(
        cortex.artifacts.appendContent({
          artifactId: artifact.artifactId,
          sessionId: "wrong-session-id",
          chunk: "test",
        }),
      ).rejects.toThrow();

      // Append with correct sessionId should succeed
      const result = await cortex.artifacts.appendContent({
        artifactId: artifact.artifactId,
        sessionId,
        chunk: "correct chunk",
      });

      expect(result.success).toBe(true);
      expect(result.chunkBytes).toBeGreaterThan(0);
    });

    it("should track bytes received during streaming", async () => {
      const spaceId = await setupTestSpace("streaming-bytes");

      const artifact = await cortex.artifacts.create({
        memorySpaceId: spaceId,
        kind: "text",
        content: "",
        title: "Bytes Tracking Test",
        streamingState: "draft",
      });

      const { sessionId } = await cortex.artifacts.startStreaming({
        artifactId: artifact.artifactId,
      });

      const result1 = await cortex.artifacts.appendContent({
        artifactId: artifact.artifactId,
        sessionId,
        chunk: "Hello, ",
      });
      expect(result1.success).toBe(true);

      const result2 = await cortex.artifacts.appendContent({
        artifactId: artifact.artifactId,
        sessionId,
        chunk: "World!",
      });
      expect(result2.success).toBe(true);

      const current = await cortex.artifacts.get(artifact.artifactId);
      expect(current?.content?.length).toBe(13); // "Hello, World!"
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // INT-SL-001: Full Streaming State Machine
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("INT-SL-001: Full streaming state machine", () => {
    it("should traverse all valid streaming states", async () => {
      const spaceId = await setupTestSpace("streaming-states");

      // Create in draft state
      const artifact = await cortex.artifacts.create({
        memorySpaceId: spaceId,
        kind: "text",
        content: "",
        title: "State Machine Test",
        streamingState: "draft",
      });
      expect(artifact.streamingState).toBe("draft");

      // draft → streaming
      const { sessionId } = await cortex.artifacts.startStreaming({
        artifactId: artifact.artifactId,
      });

      let current = await cortex.artifacts.get(artifact.artifactId);
      expect(current?.streamingState).toBe("streaming");

      // Append some content
      await cortex.artifacts.appendContent({
        artifactId: artifact.artifactId,
        sessionId,
        chunk: "Hello ",
      });

      // streaming → paused
      await cortex.artifacts.pauseStreaming({
        artifactId: artifact.artifactId,
        sessionId,
      });

      current = await cortex.artifacts.get(artifact.artifactId);
      expect(current?.streamingState).toBe("paused");

      // paused → streaming (resume)
      await cortex.artifacts.resumeStreaming({
        artifactId: artifact.artifactId,
        sessionId,
      });

      current = await cortex.artifacts.get(artifact.artifactId);
      expect(current?.streamingState).toBe("streaming");

      // Append more content
      await cortex.artifacts.appendContent({
        artifactId: artifact.artifactId,
        sessionId,
        chunk: "World!",
      });

      // streaming → final
      await cortex.artifacts.finalizeStreaming({
        artifactId: artifact.artifactId,
        sessionId,
      });

      current = await cortex.artifacts.get(artifact.artifactId);
      expect(current?.streamingState).toBe("final");
      expect(current?.content).toBe("Hello World!");
    });

    it("should handle cancel streaming", async () => {
      const spaceId = await setupTestSpace("streaming-cancel");

      const artifact = await cortex.artifacts.create({
        memorySpaceId: spaceId,
        kind: "text",
        content: "",
        title: "Cancel Streaming Test",
        streamingState: "draft",
      });

      const { sessionId } = await cortex.artifacts.startStreaming({
        artifactId: artifact.artifactId,
      });

      await cortex.artifacts.appendContent({
        artifactId: artifact.artifactId,
        sessionId,
        chunk: "Partial content",
      });

      // Cancel returns to draft
      const cancelResult = await cortex.artifacts.cancelStreaming({
        artifactId: artifact.artifactId,
        sessionId,
      });

      expect(cancelResult.success).toBe(true);
      expect(cancelResult.currentState).toBe("draft");

      const current = await cortex.artifacts.get(artifact.artifactId);
      expect(current?.streamingState).toBe("draft");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // INT-SL-002: Streaming Error Recovery
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("INT-SL-002: Streaming error recovery", () => {
    it("should handle error state and retry workflow", async () => {
      const spaceId = await setupTestSpace("streaming-error");

      const artifact = await cortex.artifacts.create({
        memorySpaceId: spaceId,
        kind: "text",
        content: "",
        title: "Error Recovery Test",
        streamingState: "draft",
      });

      // Start streaming
      const { sessionId } = await cortex.artifacts.startStreaming({
        artifactId: artifact.artifactId,
      });

      // Append partial content
      await cortex.artifacts.appendContent({
        artifactId: artifact.artifactId,
        sessionId,
        chunk: "Partial content before error",
      });

      // Set error state
      await cortex.artifacts.setStreamingState(artifact.artifactId, "error");

      let current = await cortex.artifacts.get(artifact.artifactId);
      expect(current?.streamingState).toBe("error");
      expect(current?.content).toBe("Partial content before error"); // Preserved

      // Return to draft for retry
      await cortex.artifacts.setStreamingState(artifact.artifactId, "draft");

      current = await cortex.artifacts.get(artifact.artifactId);
      expect(current?.streamingState).toBe("draft");
      expect(current?.content).toBe("Partial content before error"); // Still preserved
    });

    it("should allow restart after cancel", async () => {
      const spaceId = await setupTestSpace("streaming-restart");

      const artifact = await cortex.artifacts.create({
        memorySpaceId: spaceId,
        kind: "text",
        content: "",
        title: "Restart After Cancel Test",
        streamingState: "draft",
      });

      // First attempt
      const { sessionId: session1 } = await cortex.artifacts.startStreaming({
        artifactId: artifact.artifactId,
      });

      await cortex.artifacts.appendContent({
        artifactId: artifact.artifactId,
        sessionId: session1,
        chunk: "First attempt",
      });

      await cortex.artifacts.cancelStreaming({
        artifactId: artifact.artifactId,
        sessionId: session1,
      });

      // Second attempt with new session
      const { sessionId: session2 } = await cortex.artifacts.startStreaming({
        artifactId: artifact.artifactId,
      });

      expect(session2).not.toBe(session1);

      await cortex.artifacts.appendContent({
        artifactId: artifact.artifactId,
        sessionId: session2,
        chunk: "Second attempt",
      });

      await cortex.artifacts.finalizeStreaming({
        artifactId: artifact.artifactId,
        sessionId: session2,
      });

      const current = await cortex.artifacts.get(artifact.artifactId);
      expect(current?.streamingState).toBe("final");
      // Content from first attempt + second attempt
      expect(current?.content).toContain("attempt");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // INT-SL-003: Invalid State Transitions Rejected
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("INT-SL-003: Invalid state transitions rejected", () => {
    it("should reject startStreaming on final artifact", async () => {
      const spaceId = await setupTestSpace("invalid-final-start");

      const artifact = await cortex.artifacts.create({
        memorySpaceId: spaceId,
        kind: "text",
        content: "Final content",
        title: "Invalid Final Start Test",
        streamingState: "final",
      });

      // Cannot start streaming on final artifact
      await expect(
        cortex.artifacts.startStreaming({
          artifactId: artifact.artifactId,
        }),
      ).rejects.toThrow();
    });

    it("should reject pauseStreaming on draft artifact", async () => {
      const spaceId = await setupTestSpace("invalid-draft-pause");

      const artifact = await cortex.artifacts.create({
        memorySpaceId: spaceId,
        kind: "text",
        content: "",
        title: "Invalid Draft Pause Test",
        streamingState: "draft",
      });

      // Cannot pause a draft artifact
      await expect(
        cortex.artifacts.pauseStreaming({
          artifactId: artifact.artifactId,
          sessionId: "fake-session",
        }),
      ).rejects.toThrow();
    });

    it("should allow finalizeStreaming on paused artifact (complete partial content)", async () => {
      // State machine allows: paused → final to "complete partial content"
      // This is intentional - user may decide partial content is acceptable
      const spaceId = await setupTestSpace("paused-finalize");

      const artifact = await cortex.artifacts.create({
        memorySpaceId: spaceId,
        kind: "text",
        content: "",
        title: "Paused Finalize Test",
        streamingState: "draft",
      });

      const { sessionId } = await cortex.artifacts.startStreaming({
        artifactId: artifact.artifactId,
      });

      // Add some content before pausing
      await cortex.artifacts.appendContent({
        artifactId: artifact.artifactId,
        sessionId,
        chunk: "Partial content before pause",
      });

      await cortex.artifacts.pauseStreaming({
        artifactId: artifact.artifactId,
        sessionId,
      });

      // Finalize from paused state should succeed (per state machine)
      const result = await cortex.artifacts.finalizeStreaming({
        artifactId: artifact.artifactId,
        sessionId,
      });

      expect(result.success).toBe(true);
      expect(result.previousState).toBe("paused");
      expect(result.currentState).toBe("final");

      // Verify artifact is finalized with partial content
      const finalized = await cortex.artifacts.get(artifact.artifactId);
      expect(finalized?.streamingState).toBe("final");
      expect(finalized?.content).toContain("Partial content before pause");
    });

    it("should reject appendContent on non-streaming artifact", async () => {
      const spaceId = await setupTestSpace("invalid-append");

      const artifact = await cortex.artifacts.create({
        memorySpaceId: spaceId,
        kind: "text",
        content: "Not streaming",
        title: "Invalid Append Test",
        streamingState: "draft",
      });

      // Cannot append to draft without starting
      await expect(
        cortex.artifacts.appendContent({
          artifactId: artifact.artifactId,
          sessionId: "any-session",
          chunk: "test",
        }),
      ).rejects.toThrow();
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Multiple Streaming Sessions
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Multiple streaming sessions", () => {
    it("should handle sequential streaming sessions on same artifact", async () => {
      const spaceId = await setupTestSpace("streaming-sequential");

      const artifact = await cortex.artifacts.create({
        memorySpaceId: spaceId,
        kind: "text",
        content: "",
        title: "Sequential Sessions Test",
        streamingState: "draft",
      });

      // First streaming session
      const { sessionId: session1 } = await cortex.artifacts.startStreaming({
        artifactId: artifact.artifactId,
      });

      await cortex.artifacts.appendContent({
        artifactId: artifact.artifactId,
        sessionId: session1,
        chunk: "First session content. ",
      });

      await cortex.artifacts.finalizeStreaming({
        artifactId: artifact.artifactId,
        sessionId: session1,
      });

      let current = await cortex.artifacts.get(artifact.artifactId);
      expect(current?.version).toBe(2);

      // Set back to draft for second session
      await cortex.artifacts.setStreamingState(artifact.artifactId, "draft");

      // Second streaming session
      const { sessionId: session2 } = await cortex.artifacts.startStreaming({
        artifactId: artifact.artifactId,
      });

      await cortex.artifacts.appendContent({
        artifactId: artifact.artifactId,
        sessionId: session2,
        chunk: "Second session content.",
      });

      await cortex.artifacts.finalizeStreaming({
        artifactId: artifact.artifactId,
        sessionId: session2,
      });

      current = await cortex.artifacts.get(artifact.artifactId);
      expect(current?.version).toBe(3);
      expect(current?.content).toContain("session content");
    });
  });
});
