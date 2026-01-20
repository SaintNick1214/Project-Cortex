/**
 * E2E Tests: AI Code Generation Flow
 *
 * End-to-end tests simulating real-world AI code generation scenarios:
 * - AI creates code artifact via streaming
 * - Content streams progressively
 * - Artifact finalized with version history
 * - AI updates code via tool call
 * - User navigates version history with undo/redo
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

describeWithConvex("E2E: AI Code Generation Flow", () => {
  let cortex: Cortex;
  let testTenantId: string;
  let testUserId: string;
  let testMemorySpaceId: string;

  // Test artifacts to clean up
  const createdArtifactIds: string[] = [];

  beforeAll(async () => {
    testTenantId = generateTenantId("ai-code-e2e");
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
      name: "AI Code Generation E2E Test Space",
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
  // Scenario 1: Complete AI Code Generation with Streaming
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Scenario 1: AI-Generated Code with Streaming", () => {
    const aiGeneratedCode = `export async function fetchUserData(userId: string): Promise<User> {
  const response = await fetch(\`/api/users/\${userId}\`);
  if (!response.ok) {
    throw new Error(\`Failed to fetch user: \${response.status}\`);
  }
  return response.json();
}`;

    it("should stream code artifact from AI response", async () => {
      // Step 1: AI tool call creates artifact in draft state
      const artifact = await cortex.artifacts.create({
        memorySpaceId: testMemorySpaceId,
        title: "User Data Fetcher",
        content: "", // Start with empty content
        kind: "code",
        streamingState: "draft",
        tags: ["typescript", "api", "generated"],
        metadata: {
          language: "typescript",
          generatedBy: "ai-assistant",
        },
      });

      createdArtifactIds.push(artifact.artifactId);

      expect(artifact.artifactId).toMatch(/^art-/);
      expect(artifact.streamingState).toBe("draft");
      expect(artifact.version).toBe(1);

      // Step 2: Start streaming session (AI begins generating)
      const startResult = await cortex.artifacts.startStreaming({
        artifactId: artifact.artifactId,
      });

      expect(startResult.sessionId).toBeDefined();
      expect(startResult.success).toBe(true);
      expect(startResult.currentState).toBe("streaming");

      const sessionId = startResult.sessionId;

      // Step 3: Stream content in chunks (simulating AI token generation)
      const chunks = aiGeneratedCode.match(/.{1,50}/g) || [];

      for (const chunk of chunks) {
        const chunkResult = await cortex.artifacts.appendContent({
          artifactId: artifact.artifactId,
          sessionId,
          chunk,
        });

        expect(chunkResult.success).toBe(true);
        expect(chunkResult.chunkBytes).toBeGreaterThan(0);
      }

      // Step 4: Finalize streaming (AI finished generating)
      const finalResult = await cortex.artifacts.finalizeStreaming({
        artifactId: artifact.artifactId,
        sessionId,
        changeSummary: "Initial AI-generated code",
      });

      expect(finalResult.success).toBe(true);
      expect(finalResult.currentState).toBe("final");

      // Step 5: Verify artifact is retrievable with complete content
      const retrieved = await cortex.artifacts.get(artifact.artifactId);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.content).toBe(aiGeneratedCode);
      expect(retrieved?.title).toBe("User Data Fetcher");
      expect(retrieved?.kind).toBe("code");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Scenario 2: AI Updates Code with Version History
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Scenario 2: AI Updates Code with Version History", () => {
    const originalCode = `function greet(name: string) {
  return "Hello, " + name;
}`;

    const updatedCode = `function greet(name: string, greeting = "Hello") {
  return \`\${greeting}, \${name}!\`;
}`;

    let artifactId: string;

    beforeAll(async () => {
      // Create initial artifact
      const artifact = await cortex.artifacts.create({
        memorySpaceId: testMemorySpaceId,
        title: "Greeting Function",
        content: originalCode,
        kind: "code",
        streamingState: "final",
        tags: ["typescript", "function"],
      });

      artifactId = artifact.artifactId;
      createdArtifactIds.push(artifactId);
    });

    it("should update artifact via AI tool and maintain version history", async () => {
      // Step 1: Verify initial state
      const initial = await cortex.artifacts.get(artifactId);
      expect(initial?.content).toBe(originalCode);
      expect(initial?.version).toBe(1);

      // Step 2: AI updates the artifact (simulating updateArtifact tool call)
      const updated = await cortex.artifacts.update(artifactId, updatedCode, {
        changeSummary: "Added customizable greeting parameter",
        changedBy: "ai-assistant",
      });

      expect(updated.content).toBe(updatedCode);
      expect(updated.version).toBe(2);

      // Step 3: Verify version history
      const history = await cortex.artifacts.getHistory(artifactId);
      expect(history.length).toBe(2);

      // First version (create)
      expect(history[0].version).toBe(1);
      expect(history[0].changeType).toBe("create");
      expect(history[0].content).toBe(originalCode);

      // Second version (update)
      expect(history[1].version).toBe(2);
      expect(history[1].changeType).toBe("update");
      expect(history[1].content).toBe(updatedCode);
    });

    it("should support undo/redo navigation", async () => {
      // Step 1: Undo to previous version
      const undoResult = await cortex.artifacts.undo(artifactId);
      expect(undoResult.success).toBe(true);
      expect(undoResult.currentVersion).toBe(1);

      const afterUndo = await cortex.artifacts.get(artifactId);
      expect(afterUndo?.content).toBe(originalCode);

      // Step 2: Verify version is still 2 but pointer is 1
      expect(afterUndo?.version).toBe(2);
      expect(afterUndo?.versionPointer).toBe(1);

      // Step 3: Redo to restore
      const redoResult = await cortex.artifacts.redo(artifactId);
      expect(redoResult.success).toBe(true);
      expect(redoResult.currentVersion).toBe(2);

      // Step 4: Verify final state
      const final = await cortex.artifacts.get(artifactId);
      expect(final?.content).toBe(updatedCode);
      expect(final?.versionPointer).toBe(2);
    });

    it("should handle undo at initial version gracefully", async () => {
      // Reset to version 1
      await cortex.artifacts.undo(artifactId);

      // Try to undo again - should throw UNDO_NOT_AVAILABLE
      await expect(cortex.artifacts.undo(artifactId)).rejects.toThrow(
        /UNDO_NOT_AVAILABLE/,
      );

      // Clean up - restore to latest
      await cortex.artifacts.redo(artifactId);
    });

    it("should handle redo at latest version gracefully", async () => {
      // Verify at latest version
      const current = await cortex.artifacts.get(artifactId);
      expect(current?.versionPointer).toBe(current?.version);

      // Try to redo - should throw REDO_NOT_AVAILABLE
      await expect(cortex.artifacts.redo(artifactId)).rejects.toThrow(
        /REDO_NOT_AVAILABLE/,
      );
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Scenario 3: Multiple AI Updates with Complex History
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Scenario 3: Multiple Updates with Complex History Navigation", () => {
    const versions = [
      "// v1: Initial\nconst x = 1;",
      "// v2: Added y\nconst x = 1;\nconst y = 2;",
      "// v3: Added z\nconst x = 1;\nconst y = 2;\nconst z = 3;",
      "// v4: Added sum\nconst x = 1;\nconst y = 2;\nconst z = 3;\nconst sum = x + y + z;",
    ];

    let artifactId: string;

    beforeAll(async () => {
      // Create artifact with first version
      const artifact = await cortex.artifacts.create({
        memorySpaceId: testMemorySpaceId,
        title: "Progressive Code",
        content: versions[0],
        kind: "code",
        streamingState: "final",
      });

      artifactId = artifact.artifactId;
      createdArtifactIds.push(artifactId);

      // Create subsequent versions
      for (let i = 1; i < versions.length; i++) {
        await cortex.artifacts.update(artifactId, versions[i], {
          changeSummary: `AI update v${i + 1}`,
        });
      }
    });

    it("should have 4 versions in history", async () => {
      const history = await cortex.artifacts.getHistory(artifactId);
      expect(history.length).toBe(4);

      for (let i = 0; i < 4; i++) {
        expect(history[i].version).toBe(i + 1);
        expect(history[i].content).toBe(versions[i]);
      }
    });

    it("should retrieve specific versions", async () => {
      for (let i = 1; i <= 4; i++) {
        const version = await cortex.artifacts.getVersion(artifactId, i);
        expect(version).not.toBeNull();
        expect(version?.version).toBe(i);
        expect(version?.content).toBe(versions[i - 1]);
      }
    });

    it("should navigate through all versions with undo", async () => {
      // Start at v4
      let artifact = await cortex.artifacts.get(artifactId);
      expect(artifact?.versionPointer).toBe(4);

      // Undo to v3
      let undoResult = await cortex.artifacts.undo(artifactId);
      expect(undoResult.success).toBe(true);
      expect(undoResult.currentVersion).toBe(3);
      artifact = await cortex.artifacts.get(artifactId);
      expect(artifact?.content).toBe(versions[2]);

      // Undo to v2
      undoResult = await cortex.artifacts.undo(artifactId);
      expect(undoResult.success).toBe(true);
      artifact = await cortex.artifacts.get(artifactId);
      expect(artifact?.content).toBe(versions[1]);

      // Undo to v1
      undoResult = await cortex.artifacts.undo(artifactId);
      expect(undoResult.success).toBe(true);
      artifact = await cortex.artifacts.get(artifactId);
      expect(artifact?.content).toBe(versions[0]);

      // Restore to latest for other tests
      await cortex.artifacts.redo(artifactId);
      await cortex.artifacts.redo(artifactId);
      await cortex.artifacts.redo(artifactId);
    });

    it("should handle invalid version request", async () => {
      // Request non-existent version
      const result = await cortex.artifacts.getVersion(artifactId, 99);
      expect(result).toBeNull();
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Scenario 4: Streaming Pause/Resume Flow
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Scenario 4: Streaming Pause/Resume", () => {
    it("should support pause and resume during streaming", async () => {
      // Create artifact
      const artifact = await cortex.artifacts.create({
        memorySpaceId: testMemorySpaceId,
        title: "Pausable Stream",
        content: "",
        kind: "code",
        streamingState: "draft",
      });

      createdArtifactIds.push(artifact.artifactId);

      // Start streaming
      const { sessionId } = await cortex.artifacts.startStreaming({
        artifactId: artifact.artifactId,
      });

      // Append some content
      await cortex.artifacts.appendContent({
        artifactId: artifact.artifactId,
        sessionId,
        chunk: "First chunk. ",
      });

      // Pause streaming
      const pauseResult = await cortex.artifacts.pauseStreaming({
        artifactId: artifact.artifactId,
        sessionId,
      });
      expect(pauseResult.success).toBe(true);
      expect(pauseResult.currentState).toBe("paused");

      // Resume streaming
      const resumeResult = await cortex.artifacts.resumeStreaming({
        artifactId: artifact.artifactId,
        sessionId,
      });
      expect(resumeResult.success).toBe(true);
      expect(resumeResult.currentState).toBe("streaming");

      // Continue appending
      await cortex.artifacts.appendContent({
        artifactId: artifact.artifactId,
        sessionId,
        chunk: "Second chunk after resume.",
      });

      // Finalize
      const finalResult = await cortex.artifacts.finalizeStreaming({
        artifactId: artifact.artifactId,
        sessionId,
      });

      expect(finalResult.success).toBe(true);
      expect(finalResult.currentState).toBe("final");

      // Verify final content
      const finalArtifact = await cortex.artifacts.get(artifact.artifactId);
      expect(finalArtifact?.content).toBe("First chunk. Second chunk after resume.");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Scenario 5: Streaming Cancel and Error Recovery
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Scenario 5: Streaming Cancellation", () => {
    it("should cancel streaming and revert to draft", async () => {
      // Create artifact
      const artifact = await cortex.artifacts.create({
        memorySpaceId: testMemorySpaceId,
        title: "Cancellable Stream",
        content: "Initial content",
        kind: "code",
        streamingState: "final",
      });

      createdArtifactIds.push(artifact.artifactId);

      // Start streaming (this would create a new version being streamed)
      const { sessionId } = await cortex.artifacts.startStreaming({
        artifactId: artifact.artifactId,
      });

      // Append some content
      await cortex.artifacts.appendContent({
        artifactId: artifact.artifactId,
        sessionId,
        chunk: "New streaming content...",
      });

      // Cancel streaming
      const cancelResult = await cortex.artifacts.cancelStreaming({
        artifactId: artifact.artifactId,
        sessionId,
      });

      expect(cancelResult.success).toBe(true);
      expect(cancelResult.currentState).toBe("draft");

      // Verify state is reset
      const retrieved = await cortex.artifacts.get(artifact.artifactId);
      expect(retrieved?.streamingState).toBe("draft");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Scenario 6: Artifact Listing and Filtering
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Scenario 6: Listing and Filtering Artifacts", () => {
    beforeAll(async () => {
      // Create artifacts with different kinds and tags
      const testArtifacts = [
        {
          title: "Filter Test - Code 1",
          content: "const a = 1;",
          kind: "code" as const,
          tags: ["test", "javascript"],
        },
        {
          title: "Filter Test - Code 2",
          content: "const b = 2;",
          kind: "code" as const,
          tags: ["test", "typescript"],
        },
        {
          title: "Filter Test - Text",
          content: "Some documentation",
          kind: "text" as const,
          tags: ["test", "docs"],
        },
      ];

      for (const config of testArtifacts) {
        const artifact = await cortex.artifacts.create({
          memorySpaceId: testMemorySpaceId,
          ...config,
          streamingState: "final",
        });
        createdArtifactIds.push(artifact.artifactId);
      }
    });

    it("should list artifacts by kind", async () => {
      const codeArtifacts = await cortex.artifacts.list({
        memorySpaceId: testMemorySpaceId,
        kind: "code",
      });

      expect(
        codeArtifacts.every((a) => a.kind === "code"),
      ).toBe(true);
      expect(codeArtifacts.length).toBeGreaterThanOrEqual(2);
    });

    it("should list artifacts by tags", async () => {
      const testTaggedArtifacts = await cortex.artifacts.list({
        memorySpaceId: testMemorySpaceId,
        tags: ["test"],
      });

      expect(testTaggedArtifacts.length).toBeGreaterThanOrEqual(3);
    });

    it("should count artifacts matching filter", async () => {
      const count = await cortex.artifacts.count({
        memorySpaceId: testMemorySpaceId,
        streamingState: "final",
      });

      expect(count).toBeGreaterThanOrEqual(3);
    });
  });
});
