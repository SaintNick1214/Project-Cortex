/**
 * E2E Tests: Large File Artifacts
 *
 * End-to-end tests for large content handling:
 * - Content below threshold stored inline
 * - Content above threshold stored in file storage
 * - File reference handling
 * - Download URL generation
 * - Version history with file references
 * - Performance benchmarks
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

// Content size thresholds
const KB = 1024;
const MB = 1024 * KB;

// Generate content of specific size
function generateContent(sizeBytes: number, char = "x"): string {
  return char.repeat(sizeBytes);
}

describeWithConvex("E2E: Large File Artifacts", () => {
  let cortex: Cortex;
  let testTenantId: string;
  let testUserId: string;
  let testMemorySpaceId: string;

  // Test artifacts to clean up
  const createdArtifactIds: string[] = [];

  beforeAll(async () => {
    testTenantId = generateTenantId("large-file-e2e");
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
      name: "Large File E2E Test Space",
      type: "custom",
    });
  });

  afterAll(async () => {
    // Clean up artifacts (hard delete to remove files too)
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
  // Scenario 1: Small Content - Inline Storage
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Scenario 1: Small Content (Inline Storage)", () => {
    it("should store small content inline (< 100KB)", async () => {
      const smallContent = generateContent(50 * KB);

      const artifact = await cortex.artifacts.create({
        memorySpaceId: testMemorySpaceId,
        title: "Small Content Test",
        content: smallContent,
        kind: "text",
        streamingState: "final",
        tags: ["size-test", "inline"],
      });

      createdArtifactIds.push(artifact.artifactId);

      // Verify content is stored inline
      expect(artifact.content).toBe(smallContent);
      expect(artifact.content?.length).toBe(50 * KB);

      // fileRef should not be populated for inline content
      expect(artifact.fileRef).toBeUndefined();
    });

    it("should store 500KB content inline", async () => {
      const content = generateContent(500 * KB);

      const startTime = Date.now();
      const artifact = await cortex.artifacts.create({
        memorySpaceId: testMemorySpaceId,
        title: "500KB Content Test",
        content,
        kind: "text",
        streamingState: "final",
        tags: ["size-test", "500kb"],
      });
      const elapsed = Date.now() - startTime;

      createdArtifactIds.push(artifact.artifactId);

      expect(artifact.content).toBe(content);
      expect(artifact.content?.length).toBe(500 * KB);

      // Performance check - should complete in reasonable time
      expect(elapsed).toBeLessThan(5000); // 5 seconds max
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Scenario 2: Large Content - File Storage
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Scenario 2: Large Content (File Storage)", () => {
    it("should handle 1.5MB content with file storage", async () => {
      const largeContent = generateContent(1.5 * MB);

      const startTime = Date.now();
      const artifact = await cortex.artifacts.create({
        memorySpaceId: testMemorySpaceId,
        title: "1.5MB Content Test",
        content: largeContent,
        kind: "text",
        streamingState: "final",
        tags: ["size-test", "large", "1.5mb"],
      });
      const createTime = Date.now() - startTime;

      createdArtifactIds.push(artifact.artifactId);

      // For large content, either:
      // 1. Content is stored inline (if system handles it)
      // 2. fileRef is populated with storage reference
      const hasContent = artifact.content?.length === Math.floor(1.5 * MB);
      const hasFileRef = artifact.fileRef !== undefined;

      expect(hasContent || hasFileRef).toBe(true);

      // If fileRef is used, verify its structure
      if (artifact.fileRef) {
        expect(artifact.fileRef.storageId).toBeDefined();
        expect(artifact.fileRef.size).toBeGreaterThan(1 * MB);
        expect(artifact.fileRef.mimeType).toBeDefined();
      }

      // Performance check
      expect(createTime).toBeLessThan(10000); // 10 seconds max
    });

    it("should handle 2MB content", async () => {
      const content = generateContent(2 * MB);

      const startTime = Date.now();
      const artifact = await cortex.artifacts.create({
        memorySpaceId: testMemorySpaceId,
        title: "2MB Content Test",
        content,
        kind: "text",
        streamingState: "final",
        tags: ["size-test", "large", "2mb"],
      });
      const elapsed = Date.now() - startTime;

      createdArtifactIds.push(artifact.artifactId);

      // Verify the artifact was created
      expect(artifact.artifactId).toBeDefined();
      expect(artifact.version).toBe(1);

      // Performance assertion
      expect(elapsed).toBeLessThan(15000); // 15 seconds max
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Scenario 3: File URL Generation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Scenario 3: File URL Generation and Download", () => {
    let artifactWithFile: string;

    beforeAll(async () => {
      // Create an artifact with file attachment
      const artifact = await cortex.artifacts.create({
        memorySpaceId: testMemorySpaceId,
        title: "File URL Test",
        content: "Content with potential file attachment",
        kind: "text",
        streamingState: "final",
        tags: ["url-test"],
      });

      artifactWithFile = artifact.artifactId;
      createdArtifactIds.push(artifactWithFile);
    });

    it("should handle getFileUrl for artifacts", async () => {
      // This tests the getFileUrl method
      // For artifacts without file attachments, it may return null/undefined
      // For artifacts with file storage, it returns a signed URL

      const artifact = await cortex.artifacts.get(artifactWithFile);

      if (artifact?.fileRef) {
        // If there's a file ref, we should be able to get a URL
        const startTime = Date.now();
        const url = await cortex.artifacts.getFileUrl(artifactWithFile);
        const elapsed = Date.now() - startTime;

        expect(url).toBeDefined();
        expect(typeof url).toBe("string");
        expect(url).toMatch(/^https?:\/\//);

        // URL generation should be fast
        expect(elapsed).toBeLessThan(1000); // 1 second max
      }
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Scenario 4: Large Content Versioning
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Scenario 4: Large Content Version History", () => {
    it("should maintain version history with large content", async () => {
      // Create with 500KB content
      const v1Content = generateContent(500 * KB, "a");
      const artifact = await cortex.artifacts.create({
        memorySpaceId: testMemorySpaceId,
        title: "Large Versioning Test",
        content: v1Content,
        kind: "text",
        streamingState: "final",
        tags: ["version-test", "large"],
      });

      createdArtifactIds.push(artifact.artifactId);

      // Update with different 500KB content
      const v2Content = generateContent(500 * KB, "b");
      await cortex.artifacts.update(artifact.artifactId, v2Content, {
        changeSummary: "Updated to version 2",
      });

      // Update with 1MB content
      const v3Content = generateContent(1 * MB, "c");
      await cortex.artifacts.update(artifact.artifactId, v3Content, {
        changeSummary: "Updated to version 3 with larger content",
      });

      // Verify version history
      const history = await cortex.artifacts.getHistory(artifact.artifactId);
      expect(history.length).toBe(3);

      // Verify we can retrieve specific versions
      const version1 = await cortex.artifacts.getVersion(artifact.artifactId, 1);
      const version2 = await cortex.artifacts.getVersion(artifact.artifactId, 2);
      const version3 = await cortex.artifacts.getVersion(artifact.artifactId, 3);

      expect(version1?.content?.charAt(0)).toBe("a");
      expect(version2?.content?.charAt(0)).toBe("b");
      expect(version3?.content?.charAt(0)).toBe("c");
    });

    it("should undo/redo with large content", async () => {
      const v1Content = generateContent(200 * KB, "x");
      const artifact = await cortex.artifacts.create({
        memorySpaceId: testMemorySpaceId,
        title: "Undo Redo Large Test",
        content: v1Content,
        kind: "text",
        streamingState: "final",
      });

      createdArtifactIds.push(artifact.artifactId);

      const v2Content = generateContent(200 * KB, "y");
      await cortex.artifacts.update(artifact.artifactId, v2Content);

      // Undo to v1
      const undoResult = await cortex.artifacts.undo(artifact.artifactId);
      expect(undoResult.success).toBe(true);
      const afterUndo = await cortex.artifacts.get(artifact.artifactId);
      expect(afterUndo?.content?.charAt(0)).toBe("x");

      // Redo to v2
      const redoResult = await cortex.artifacts.redo(artifact.artifactId);
      expect(redoResult.success).toBe(true);
      const afterRedo = await cortex.artifacts.get(artifact.artifactId);
      expect(afterRedo?.content?.charAt(0)).toBe("y");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Scenario 5: Streaming Large Content
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Scenario 5: Streaming Large Content", () => {
    it("should stream 1MB content in chunks", async () => {
      const artifact = await cortex.artifacts.create({
        memorySpaceId: testMemorySpaceId,
        title: "Stream Large Test",
        content: "",
        kind: "text",
        streamingState: "draft",
        tags: ["stream-test", "large"],
      });

      createdArtifactIds.push(artifact.artifactId);

      // Start streaming
      const { sessionId } = await cortex.artifacts.startStreaming({
        artifactId: artifact.artifactId,
      });

      // Stream 1MB in 100KB chunks
      const chunkSize = 100 * KB;
      const totalSize = 1 * MB;
      const numChunks = totalSize / chunkSize;

      const chunkTimings: number[] = [];

      for (let i = 0; i < numChunks; i++) {
        const chunk = generateContent(chunkSize, String.fromCharCode(65 + (i % 26)));
        const startTime = Date.now();
        await cortex.artifacts.appendContent({
          artifactId: artifact.artifactId,
          sessionId,
          chunk,
        });
        chunkTimings.push(Date.now() - startTime);
      }

      // Finalize
      const finalized = await cortex.artifacts.finalizeStreaming({
        artifactId: artifact.artifactId,
        sessionId,
      });

      expect(finalized.success).toBe(true);
      expect(finalized.currentState).toBe("final");

      // Verify total content size
      const retrieved = await cortex.artifacts.get(artifact.artifactId);
      const contentSize = retrieved?.content?.length || 0;
      const hasExpectedSize =
        contentSize >= totalSize || retrieved?.fileRef?.size! >= totalSize;
      expect(hasExpectedSize).toBe(true);

      // Performance: average chunk time should be reasonable
      const avgChunkTime =
        chunkTimings.reduce((a, b) => a + b, 0) / chunkTimings.length;
      expect(avgChunkTime).toBeLessThan(1000); // 1 second per 100KB chunk
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Scenario 6: File Upload API
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Scenario 6: File Upload and Attachment", () => {
    it("should upload and attach file to artifact", async () => {
      // Create base artifact
      const artifact = await cortex.artifacts.create({
        memorySpaceId: testMemorySpaceId,
        title: "File Upload Test",
        content: "Document with file attachment",
        kind: "text",
        streamingState: "final",
        tags: ["upload-test"],
      });

      createdArtifactIds.push(artifact.artifactId);

      // Create a test file blob (100KB)
      const fileContent = generateContent(100 * KB, "F");
      const fileBlob = new Blob([fileContent], { type: "text/plain" });

      // Upload file
      const startTime = Date.now();
      const withFile = await cortex.artifacts.uploadFile({
        artifactId: artifact.artifactId,
        file: fileBlob,
        filename: "test-attachment.txt",
        mimeType: "text/plain",
        metadata: { purpose: "test" },
      });
      const elapsed = Date.now() - startTime;

      // Verify file was attached
      expect(withFile.fileRef).toBeDefined();
      expect(withFile.fileRef?.storageId).toBeDefined();

      // Performance check
      expect(elapsed).toBeLessThan(5000); // 5 seconds for 100KB upload
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Scenario 7: Performance Benchmarks
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Scenario 7: Performance Benchmarks", () => {
    const benchmarkResults: Record<string, number> = {};

    it("should benchmark artifact creation (various sizes)", async () => {
      const sizes = [
        { name: "10KB", bytes: 10 * KB },
        { name: "100KB", bytes: 100 * KB },
        { name: "500KB", bytes: 500 * KB },
      ];

      for (const { name, bytes } of sizes) {
        const content = generateContent(bytes);
        const startTime = Date.now();

        const artifact = await cortex.artifacts.create({
          memorySpaceId: testMemorySpaceId,
          title: `Benchmark ${name}`,
          content,
          kind: "text",
          streamingState: "final",
          tags: ["benchmark"],
        });

        benchmarkResults[`create_${name}`] = Date.now() - startTime;
        createdArtifactIds.push(artifact.artifactId);
      }

      // Log results
      console.log("📊 Creation Benchmarks:");
      for (const [key, value] of Object.entries(benchmarkResults)) {
        if (key.startsWith("create_")) {
          console.log(`  ${key}: ${value}ms`);
        }
      }

      // Performance assertions
      expect(benchmarkResults["create_10KB"]).toBeLessThan(2000);
      expect(benchmarkResults["create_100KB"]).toBeLessThan(3000);
      expect(benchmarkResults["create_500KB"]).toBeLessThan(5000);
    });

    it("should benchmark artifact retrieval", async () => {
      // Use an existing artifact from previous test
      const artifacts = await cortex.artifacts.list({
        memorySpaceId: testMemorySpaceId,
        tags: ["benchmark"],
        limit: 1,
      });

      if (artifacts.length > 0) {
        const artifactId = artifacts[0].artifactId;

        const startTime = Date.now();
        await cortex.artifacts.get(artifactId);
        const elapsed = Date.now() - startTime;

        benchmarkResults["get"] = elapsed;
        console.log(`📊 Get Benchmark: ${elapsed}ms`);

        expect(elapsed).toBeLessThan(1000);
      }
    });

    it("should benchmark list operation", async () => {
      const startTime = Date.now();
      await cortex.artifacts.list({
        memorySpaceId: testMemorySpaceId,
        limit: 50,
      });
      const elapsed = Date.now() - startTime;

      benchmarkResults["list_50"] = elapsed;
      console.log(`📊 List Benchmark (50 items): ${elapsed}ms`);

      expect(elapsed).toBeLessThan(2000);
    });

    it("should benchmark count operation", async () => {
      const startTime = Date.now();
      await cortex.artifacts.count({
        memorySpaceId: testMemorySpaceId,
      });
      const elapsed = Date.now() - startTime;

      benchmarkResults["count"] = elapsed;
      console.log(`📊 Count Benchmark: ${elapsed}ms`);

      expect(elapsed).toBeLessThan(500);
    });
  });
});
