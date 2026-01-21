/**
 * Unit Tests: Artifacts TypeScript SDK
 *
 * Tests for ArtifactsAPI class with mocked Convex client.
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { ArtifactsAPI, ArtifactValidationError } from "../../../src/artifacts";

// Mock types - use ReturnType to avoid typing issues
type MockConvexClient = {
  mutation: ReturnType<typeof jest.fn>;
  query: ReturnType<typeof jest.fn>;
};

type MockGraphAdapter = {
  createNode: ReturnType<typeof jest.fn>;
  updateNode: ReturnType<typeof jest.fn>;
  deleteNode: ReturnType<typeof jest.fn>;
  createEdge: ReturnType<typeof jest.fn>;
};

type MockResilienceLayer = {
  execute: ReturnType<typeof jest.fn>;
};

// Helper to create mock client
function createMockClient(): MockConvexClient {
  return {
    mutation: jest.fn(),
    query: jest.fn(),
  };
}

function createMockGraphAdapter(): MockGraphAdapter {
  return {
    createNode: jest.fn<any>().mockResolvedValue(undefined),
    updateNode: jest.fn<any>().mockResolvedValue(undefined),
    deleteNode: jest.fn<any>().mockResolvedValue(undefined),
    createEdge: jest.fn<any>().mockResolvedValue(undefined),
  };
}

function createMockResilienceLayer(): MockResilienceLayer {
  return {
    execute: jest.fn((fn: () => Promise<unknown>) => fn()),
  };
}

// Mock artifact response
const mockArtifactResponse = {
  _id: "id_123",
  artifactId: "art-abc123",
  memorySpaceId: "space-123",
  kind: "text",
  title: "Test Artifact",
  content: "Test content",
  streamingState: "draft",
  version: 1,
  versionPointer: 1,
  versionHistory: [
    {
      version: 1,
      content: "Test content",
      title: "Test Artifact",
      timestamp: Date.now(),
      changeType: "create",
    },
  ],
  tags: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

describe("ArtifactsAPI", () => {
  let artifactsApi: ArtifactsAPI;
  let mockClient: MockConvexClient;
  let mockGraphAdapter: MockGraphAdapter;
  let mockResilience: MockResilienceLayer;

  beforeEach(() => {
    mockClient = createMockClient();
    mockGraphAdapter = createMockGraphAdapter();
    mockResilience = createMockResilienceLayer();

    artifactsApi = new ArtifactsAPI(
      mockClient as any,
      mockGraphAdapter as any,
      mockResilience as any,
      { tenantId: "test-tenant" } as any,
    );
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // create()
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("create()", () => {
    it("should create artifact with valid options", async () => {
      mockClient.mutation.mockResolvedValue(mockArtifactResponse);

      const result = await artifactsApi.create({
        memorySpaceId: "space-123",
        title: "Test Artifact",
        content: "Test content",
        kind: "text",
      });

      expect(result.artifactId).toBe("art-abc123");
      expect(mockClient.mutation).toHaveBeenCalled();
    });

    it("should throw validation error for empty title", async () => {
      await expect(
        artifactsApi.create({
          memorySpaceId: "space-123",
          title: "",
          content: "content",
        })
      ).rejects.toThrow(ArtifactValidationError);
    });

    it("should throw validation error for missing memorySpaceId", async () => {
      await expect(
        artifactsApi.create({
          memorySpaceId: "",
          title: "Title",
          content: "content",
        })
      ).rejects.toThrow(ArtifactValidationError);
    });

    it("should sync to graph adapter when available", async () => {
      mockClient.mutation.mockResolvedValue(mockArtifactResponse);

      await artifactsApi.create({
        memorySpaceId: "space-123",
        title: "Test",
        content: "content",
      });

      expect(mockGraphAdapter.createNode).toHaveBeenCalled();
    });

    it("should use resilience layer when available", async () => {
      mockClient.mutation.mockResolvedValue(mockArtifactResponse);

      await artifactsApi.create({
        memorySpaceId: "space-123",
        title: "Test",
        content: "content",
      });

      expect(mockResilience.execute).toHaveBeenCalled();
    });

    it("should include tenantId from auth context", async () => {
      mockClient.mutation.mockResolvedValue(mockArtifactResponse);

      await artifactsApi.create({
        memorySpaceId: "space-123",
        title: "Test",
        content: "content",
      });

      const callArgs = mockClient.mutation.mock.calls[0][1];
      expect(callArgs.tenantId).toBe("test-tenant");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // get()
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("get()", () => {
    it("should return artifact when found", async () => {
      mockClient.query.mockResolvedValue(mockArtifactResponse);

      const result = await artifactsApi.get("art-abc123");

      expect(result).not.toBeNull();
      expect(result?.artifactId).toBe("art-abc123");
    });

    it("should return null when not found", async () => {
      mockClient.query.mockResolvedValue(null);

      const result = await artifactsApi.get("nonexistent");

      expect(result).toBeNull();
    });

    it("should throw validation error for empty ID", async () => {
      await expect(artifactsApi.get("")).rejects.toThrow(ArtifactValidationError);
    });

    it("should throw validation error for invalid ID format", async () => {
      await expect(artifactsApi.get("invalid@id")).rejects.toThrow(ArtifactValidationError);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // update()
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("update()", () => {
    const updatedArtifact = {
      ...mockArtifactResponse,
      content: "Updated content",
      version: 2,
      versionPointer: 2,
    };

    it("should update artifact content", async () => {
      mockClient.mutation.mockResolvedValue(updatedArtifact);

      const result = await artifactsApi.update("art-abc123", "Updated content");

      expect(result.version).toBe(2);
      expect(result.content).toBe("Updated content");
    });

    it("should update with options", async () => {
      mockClient.mutation.mockResolvedValue(updatedArtifact);

      const result = await artifactsApi.update("art-abc123", "Updated content", {
        title: "New Title",
        changeSummary: "Updated the content",
      });

      expect(result).toBeDefined();
      expect(mockClient.mutation).toHaveBeenCalled();
    });

    it("should throw validation error for empty artifactId", async () => {
      await expect(
        artifactsApi.update("", "content")
      ).rejects.toThrow(ArtifactValidationError);
    });

    it("should update graph on success", async () => {
      mockClient.mutation.mockResolvedValue(updatedArtifact);

      await artifactsApi.update("art-abc123", "Updated content");

      expect(mockGraphAdapter.updateNode).toHaveBeenCalled();
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // delete()
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("delete()", () => {
    it("should soft delete by default", async () => {
      mockClient.mutation.mockResolvedValue({
        deleted: true,
        artifactId: "art-abc123",
      });

      const result = await artifactsApi.delete("art-abc123");

      expect(result.deleted).toBe(true);
      expect(mockGraphAdapter.updateNode).toHaveBeenCalled();
    });

    it("should hard delete when specified", async () => {
      mockClient.mutation.mockResolvedValue({
        deleted: true,
        artifactId: "art-abc123",
        versionsPurged: 1,
        filesDetached: 0,
      });

      const result = await artifactsApi.delete("art-abc123", true);

      expect(result.deleted).toBe(true);
      expect(mockGraphAdapter.deleteNode).toHaveBeenCalled();
    });

    it("should throw validation error for empty ID", async () => {
      await expect(artifactsApi.delete("")).rejects.toThrow(ArtifactValidationError);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // list()
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("list()", () => {
    it("should list artifacts with filter", async () => {
      // SDK extracts .artifacts from the response
      mockClient.query.mockResolvedValue({
        artifacts: [mockArtifactResponse],
        total: 1,
        limit: 50,
        offset: 0,
        hasMore: false,
      });

      const result = await artifactsApi.list({
        memorySpaceId: "space-123",
        kind: "text",
      });

      expect(result).toHaveLength(1);
      expect(result[0].kind).toBe("text");
    });

    it("should throw validation error for missing memorySpaceId", async () => {
      await expect(
        artifactsApi.list({ memorySpaceId: "" })
      ).rejects.toThrow(ArtifactValidationError);
    });

    it("should throw validation error for invalid kind", async () => {
      await expect(
        artifactsApi.list({ memorySpaceId: "space-123", kind: "invalid" as any })
      ).rejects.toThrow(ArtifactValidationError);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // count()
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("count()", () => {
    it("should return count", async () => {
      mockClient.query.mockResolvedValue(5);

      const result = await artifactsApi.count({
        memorySpaceId: "space-123",
      });

      expect(result).toBe(5);
    });

    it("should throw validation error for missing memorySpaceId", async () => {
      await expect(
        artifactsApi.count({ memorySpaceId: "" })
      ).rejects.toThrow(ArtifactValidationError);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // undo()
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("undo()", () => {
    it("should undo successfully", async () => {
      mockClient.mutation.mockResolvedValue({
        success: true,
        artifactId: "art-abc123",
        previousVersion: 2,
        currentVersion: 1,
        canUndo: false,
        canRedo: true,
      });

      const result = await artifactsApi.undo("art-abc123");

      expect(result.success).toBe(true);
      expect(result.currentVersion).toBe(1);
    });

    it("should throw validation error for empty ID", async () => {
      await expect(artifactsApi.undo("")).rejects.toThrow(ArtifactValidationError);
    });

    it("should propagate UNDO_NOT_AVAILABLE error", async () => {
      mockClient.mutation.mockRejectedValue({ data: "UNDO_NOT_AVAILABLE" });

      await expect(artifactsApi.undo("art-abc123")).rejects.toThrow();
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // redo()
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("redo()", () => {
    it("should redo successfully", async () => {
      mockClient.mutation.mockResolvedValue({
        success: true,
        artifactId: "art-abc123",
        previousVersion: 1,
        currentVersion: 2,
        canUndo: true,
        canRedo: false,
      });

      const result = await artifactsApi.redo("art-abc123");

      expect(result.success).toBe(true);
      expect(result.currentVersion).toBe(2);
    });

    it("should throw validation error for empty ID", async () => {
      await expect(artifactsApi.redo("")).rejects.toThrow(ArtifactValidationError);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // getHistory()
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("getHistory()", () => {
    it("should return version history", async () => {
      // SDK extracts .history from the response
      mockClient.query.mockResolvedValue({
        history: [
          { version: 1, content: "v1", timestamp: Date.now(), artifactId: "art-abc123", isCurrent: false, changeType: "create" },
          { version: 2, content: "v2", timestamp: Date.now(), artifactId: "art-abc123", isCurrent: true, changeType: "update" },
        ],
        artifactId: "art-abc123",
        currentVersion: 2,
        versionPointer: 2,
        total: 2,
        limit: 50,
        offset: 0,
        hasMore: false,
        canUndo: true,
        canRedo: false,
      });

      const result = await artifactsApi.getHistory("art-abc123");

      expect(result).toHaveLength(2);
    });

    it("should throw validation error for empty ID", async () => {
      await expect(artifactsApi.getHistory("")).rejects.toThrow(ArtifactValidationError);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // getVersion()
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("getVersion()", () => {
    it("should return specific version", async () => {
      mockClient.query.mockResolvedValue({
        version: 2,
        content: "v2 content",
        timestamp: Date.now(),
      });

      const result = await artifactsApi.getVersion("art-abc123", 2);

      expect(result).not.toBeNull();
      expect(result?.version).toBe(2);
    });

    it("should return null for invalid version", async () => {
      mockClient.query.mockResolvedValue(null);

      const result = await artifactsApi.getVersion("art-abc123", 999);

      expect(result).toBeNull();
    });

    it("should throw validation error for invalid version number", async () => {
      await expect(
        artifactsApi.getVersion("art-abc123", 0)
      ).rejects.toThrow(ArtifactValidationError);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Streaming Methods
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("startStreaming()", () => {
    it("should start streaming session", async () => {
      mockClient.mutation.mockResolvedValue({
        sessionId: "stream-abc123",
        artifact: mockArtifactResponse,
      });

      const result = await artifactsApi.startStreaming({
        artifactId: "art-abc123",
      });

      expect(result.sessionId).toBe("stream-abc123");
    });

    it("should throw validation error for empty artifactId", async () => {
      await expect(
        artifactsApi.startStreaming({ artifactId: "" })
      ).rejects.toThrow(ArtifactValidationError);
    });
  });

  describe("appendContent()", () => {
    it("should append content chunk", async () => {
      // appendContent returns status object, not full artifact
      mockClient.mutation.mockResolvedValue({
        success: true,
        artifactId: "art-abc123",
        sessionId: "stream-abc123",
        chunkBytes: 8,
        totalBytesReceived: 20,
        contentLength: 20,
        timestamp: Date.now(),
      });

      const result = await artifactsApi.appendContent({
        artifactId: "art-abc123",
        sessionId: "stream-abc123",
        chunk: " + chunk",
      });

      expect(result.totalBytesReceived).toBeDefined();
      expect(result.chunkBytes).toBeGreaterThan(0);
    });

    it("should throw validation error for missing sessionId", async () => {
      await expect(
        artifactsApi.appendContent({
          artifactId: "art-abc123",
          sessionId: "",
          chunk: "content",
        })
      ).rejects.toThrow(ArtifactValidationError);
    });
  });

  describe("pauseStreaming()", () => {
    it("should pause streaming", async () => {
      mockClient.mutation.mockResolvedValue({
        success: true,
        artifactId: "art-abc123",
        sessionId: "stream-abc123",
        pausedAt: Date.now(),
        previousState: "streaming",
        currentState: "paused",
        bytesReceived: 100,
        contentPreserved: true,
      });

      const result = await artifactsApi.pauseStreaming({
        artifactId: "art-abc123",
        sessionId: "stream-abc123",
      });

      expect(result.currentState).toBe("paused");
    });
  });

  describe("resumeStreaming()", () => {
    it("should resume streaming", async () => {
      mockClient.mutation.mockResolvedValue({
        success: true,
        artifactId: "art-abc123",
        sessionId: "stream-abc123",
        resumedAt: Date.now(),
        previousState: "paused",
        currentState: "streaming",
        bytesReceived: 100,
      });

      const result = await artifactsApi.resumeStreaming({
        artifactId: "art-abc123",
        sessionId: "stream-abc123",
      });

      expect(result.currentState).toBe("streaming");
    });
  });

  describe("cancelStreaming()", () => {
    it("should cancel streaming", async () => {
      mockClient.mutation.mockResolvedValue({
        success: true,
        artifactId: "art-abc123",
        sessionId: "stream-abc123",
        cancelledAt: Date.now(),
        previousState: "streaming" as const,
        currentState: "draft",
        contentPreserved: false,
        bytesReceived: 50,
        contentLength: 100,
      });

      const result = await artifactsApi.cancelStreaming({
        artifactId: "art-abc123",
        sessionId: "stream-abc123",
      });

      expect(result.currentState).toBe("draft");
    });
  });

  describe("finalizeStreaming()", () => {
    it("should finalize streaming and update graph", async () => {
      mockClient.mutation.mockResolvedValue({
        success: true,
        artifactId: "art-abc123",
        sessionId: "stream-abc123",
        finalizedAt: Date.now(),
        previousState: "streaming",
        currentState: "final",
        contentLength: 100,
        bytesReceived: 100,
        totalDurationMs: 5000,
        versionCreated: true,
        version: 2,
      });

      const result = await artifactsApi.finalizeStreaming({
        artifactId: "art-abc123",
        sessionId: "stream-abc123",
      });

      expect(result.currentState).toBe("final");
      expect(mockGraphAdapter.updateNode).toHaveBeenCalled();
    });
  });

  describe("setStreamingState()", () => {
    it("should set streaming state and update graph", async () => {
      mockClient.mutation.mockResolvedValue({
        success: true,
        artifactId: "art-abc123",
        previousState: "draft" as const,
        currentState: "error" as const,
        updatedAt: Date.now(),
      });

      const result = await artifactsApi.setStreamingState("art-abc123", "error");

      expect(result.currentState).toBe("error");
      expect(mockGraphAdapter.updateNode).toHaveBeenCalled();
    });

    it("should throw validation error for invalid state", async () => {
      await expect(
        artifactsApi.setStreamingState("art-abc123", "invalid" as any)
      ).rejects.toThrow(ArtifactValidationError);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // File Methods
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("getFileUrl()", () => {
    it("should return file URL", async () => {
      mockClient.query.mockResolvedValue({ url: "https://storage.example.com/file.png" });

      const result = await artifactsApi.getFileUrl("art-abc123");

      expect(result).toBe("https://storage.example.com/file.png");
    });

    it("should throw validation error for empty artifactId", async () => {
      await expect(
        artifactsApi.getFileUrl("")
      ).rejects.toThrow(ArtifactValidationError);
    });
  });

  describe("detachFile()", () => {
    it("should detach file from artifact", async () => {
      mockClient.mutation.mockResolvedValue({
        success: true,
        artifactId: "art-abc123",
        previousFileRef: {
          storageId: "storage-123",
          mimeType: "image/png",
          size: 1024,
        },
        fileDeleted: false,
        version: 1,
        updatedAt: Date.now(),
      });

      const result = await artifactsApi.detachFile("art-abc123", false);

      expect(result.success).toBe(true);
    });

    it("should throw validation error for empty artifactId", async () => {
      await expect(
        artifactsApi.detachFile("", false)
      ).rejects.toThrow(ArtifactValidationError);
    });
  });
});
