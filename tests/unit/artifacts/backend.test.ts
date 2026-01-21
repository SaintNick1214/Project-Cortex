/**
 * Unit Tests: Artifacts Backend (Convex)
 *
 * Tests for Convex backend mutations and queries.
 * Uses mocked Convex context for unit testing.
 */

// Note: In real implementation, you would use convex-test package
// This file demonstrates the test structure with mock utilities

type MockArtifact = {
  _id: string;
  artifactId: string;
  memorySpaceId: string;
  tenantId?: string;
  kind: string;
  title?: string;
  content: string;
  streamingState: string;
  version: number;
  versionPointer: number;
  versionHistory: Array<{
    version: number;
    content: string;
    title?: string;
    timestamp: number;
    changeType: string;
    changeSummary?: string;
  }>;
  tags: string[];
  isDeleted?: boolean;
  createdAt: number;
  updatedAt: number;
  streamingMetadata?: {
    sessionId?: string;
    startedAt?: number;
    bytesReceived?: number;
  };
};

// Mock Convex testing helper
class MockConvexTestingHelper {
  private artifacts: Map<string, MockArtifact> = new Map();
  private idCounter = 1;

  async mutation(
    api: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    if (api === "artifacts:create") {
      return this.handleCreate(args);
    }
    if (api === "artifacts:update") {
      return this.handleUpdate(args);
    }
    if (api === "artifacts:deleteArtifact") {
      return this.handleDelete(args);
    }
    if (api === "artifacts:undo") {
      return this.handleUndo(args);
    }
    if (api === "artifacts:redo") {
      return this.handleRedo(args);
    }
    if (api === "artifacts:setStreamingState") {
      return this.handleSetStreamingState(args);
    }
    if (api === "artifacts:purgeAll") {
      this.artifacts.clear();
      return { deleted: 0 };
    }
    throw new Error(`Unknown mutation: ${api}`);
  }

  async query(
    api: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    if (api === "artifacts:get") {
      return this.handleGet(args);
    }
    if (api === "artifacts:list") {
      return this.handleList(args);
    }
    if (api === "artifacts:count") {
      return this.handleCount(args);
    }
    if (api === "artifacts:getVersion") {
      return this.handleGetVersion(args);
    }
    if (api === "artifacts:getHistory") {
      return this.handleGetHistory(args);
    }
    throw new Error(`Unknown query: ${api}`);
  }

  private handleCreate(args: Record<string, unknown>): MockArtifact {
    const now = Date.now();
    const artifactId = (args.artifactId as string) ||
      `art-${now}-${Math.random().toString(36).substring(2, 11)}`;

    // Check for duplicate
    const _existingKey = args.tenantId
      ? `${args.tenantId}:${artifactId}`
      : artifactId;

    for (const [_key, artifact] of this.artifacts.entries()) {
      if (args.tenantId) {
        if (artifact.tenantId === args.tenantId && artifact.artifactId === artifactId) {
          throw new Error("ARTIFACT_ALREADY_EXISTS");
        }
      } else {
        if (artifact.artifactId === artifactId && !artifact.tenantId) {
          throw new Error("ARTIFACT_ALREADY_EXISTS");
        }
      }
    }

    const artifact: MockArtifact = {
      _id: `id_${this.idCounter++}`,
      artifactId,
      memorySpaceId: args.memorySpaceId as string,
      tenantId: args.tenantId as string | undefined,
      kind: args.kind as string,
      title: args.title as string | undefined,
      content: args.content as string,
      streamingState: (args.streamingState as string) || "draft",
      version: 1,
      versionPointer: 1,
      versionHistory: [
        {
          version: 1,
          content: args.content as string,
          title: args.title as string | undefined,
          timestamp: now,
          changeType: "create",
          changeSummary: "Initial creation",
        },
      ],
      tags: (args.tags as string[]) || [],
      createdAt: now,
      updatedAt: now,
    };

    this.artifacts.set(artifact._id, artifact);
    return artifact;
  }

  private handleUpdate(args: Record<string, unknown>): MockArtifact {
    const artifact = this.findArtifact(args.artifactId as string, args.tenantId as string | undefined);

    if (!artifact) {
      throw new Error("ARTIFACT_NOT_FOUND");
    }

    if (artifact.isDeleted) {
      throw new Error("ARTIFACT_IS_DELETED");
    }

    const now = Date.now();
    const newContent = (args.content as string) ?? artifact.content;
    const newTitle = (args.title as string) ?? artifact.title;
    const newVersion = artifact.versionPointer + 1;

    // Branch from undo state if needed
    let versionHistory = [...artifact.versionHistory];
    if (artifact.versionPointer < artifact.version) {
      versionHistory = versionHistory.filter(v => v.version <= artifact.versionPointer);
    }

    versionHistory.push({
      version: newVersion,
      content: newContent,
      title: newTitle,
      timestamp: now,
      changeType: "update",
      changeSummary: args.changeSummary as string | undefined,
    });

    artifact.content = newContent;
    artifact.title = newTitle;
    artifact.version = newVersion;
    artifact.versionPointer = newVersion;
    artifact.versionHistory = versionHistory;
    artifact.tags = (args.tags as string[]) ?? artifact.tags;
    artifact.updatedAt = now;

    return artifact;
  }

  private handleDelete(args: Record<string, unknown>): Record<string, unknown> {
    const artifact = this.findArtifact(args.artifactId as string, args.tenantId as string | undefined);

    if (!artifact) {
      throw new Error("ARTIFACT_NOT_FOUND");
    }

    const now = Date.now();

    if (args.hard) {
      this.artifacts.delete(artifact._id);
      return {
        deleted: true,
        artifactId: args.artifactId,
        deletedAt: now,
        permanent: true,
        versionsDeleted: artifact.version,
      };
    }

    artifact.isDeleted = true;
    artifact.updatedAt = now;

    return {
      deleted: true,
      artifactId: args.artifactId,
      deletedAt: now,
      permanent: false,
      restorable: true,
    };
  }

  private handleUndo(args: Record<string, unknown>): Record<string, unknown> {
    const artifact = this.findArtifact(args.artifactId as string, args.tenantId as string | undefined);

    if (!artifact) {
      throw new Error("ARTIFACT_NOT_FOUND");
    }

    if (artifact.versionPointer <= 1) {
      throw new Error("UNDO_NOT_AVAILABLE");
    }

    const newPointer = artifact.versionPointer - 1;
    const targetVersion = artifact.versionHistory.find(v => v.version === newPointer);

    if (!targetVersion) {
      throw new Error("VERSION_NOT_FOUND");
    }

    artifact.content = targetVersion.content;
    artifact.title = targetVersion.title;
    artifact.versionPointer = newPointer;
    artifact.updatedAt = Date.now();

    return {
      success: true,
      artifactId: args.artifactId,
      previousVersion: artifact.versionPointer + 1,
      currentVersion: newPointer,
      canUndo: newPointer > 1,
      canRedo: true,
    };
  }

  private handleRedo(args: Record<string, unknown>): Record<string, unknown> {
    const artifact = this.findArtifact(args.artifactId as string, args.tenantId as string | undefined);

    if (!artifact) {
      throw new Error("ARTIFACT_NOT_FOUND");
    }

    if (artifact.versionPointer >= artifact.version) {
      throw new Error("REDO_NOT_AVAILABLE");
    }

    const newPointer = artifact.versionPointer + 1;
    const targetVersion = artifact.versionHistory.find(v => v.version === newPointer);

    if (!targetVersion) {
      throw new Error("VERSION_NOT_FOUND");
    }

    artifact.content = targetVersion.content;
    artifact.title = targetVersion.title;
    artifact.versionPointer = newPointer;
    artifact.updatedAt = Date.now();

    return {
      success: true,
      artifactId: args.artifactId,
      previousVersion: artifact.versionPointer - 1,
      currentVersion: newPointer,
      canUndo: true,
      canRedo: newPointer < artifact.version,
    };
  }

  private handleSetStreamingState(args: Record<string, unknown>): Record<string, unknown> {
    const artifact = this.findArtifact(args.artifactId as string, args.tenantId as string | undefined);

    if (!artifact) {
      throw new Error("ARTIFACT_NOT_FOUND");
    }

    const previousState = artifact.streamingState;
    artifact.streamingState = args.streamingState as string;
    artifact.updatedAt = Date.now();

    return {
      success: true,
      artifactId: args.artifactId,
      previousState,
      currentState: args.streamingState,
      updatedAt: artifact.updatedAt,
    };
  }

  private handleGet(args: Record<string, unknown>): MockArtifact | null {
    const artifact = this.findArtifact(args.artifactId as string, args.tenantId as string | undefined);
    return artifact || null;
  }

  private handleList(args: Record<string, unknown>): { artifacts: MockArtifact[]; total: number } {
    let artifacts = Array.from(this.artifacts.values());

    // Apply filters
    if (args.memorySpaceId) {
      artifacts = artifacts.filter(a => a.memorySpaceId === args.memorySpaceId);
    }
    if (args.tenantId) {
      artifacts = artifacts.filter(a => a.tenantId === args.tenantId);
    }
    if (args.kind) {
      artifacts = artifacts.filter(a => a.kind === args.kind);
    }
    if (args.streamingState) {
      artifacts = artifacts.filter(a => a.streamingState === args.streamingState);
    }
    if (!args.includeDeleted) {
      artifacts = artifacts.filter(a => !a.isDeleted);
    }

    const total = artifacts.length;
    const limit = Math.min((args.limit as number) || 50, 100);
    const offset = (args.offset as number) || 0;

    artifacts = artifacts.slice(offset, offset + limit);

    return { artifacts, total };
  }

  private handleCount(args: Record<string, unknown>): number {
    let artifacts = Array.from(this.artifacts.values());

    if (args.memorySpaceId) {
      artifacts = artifacts.filter(a => a.memorySpaceId === args.memorySpaceId);
    }
    if (args.kind) {
      artifacts = artifacts.filter(a => a.kind === args.kind);
    }
    if (!args.includeDeleted) {
      artifacts = artifacts.filter(a => !a.isDeleted);
    }

    return artifacts.length;
  }

  private handleGetVersion(args: Record<string, unknown>): Record<string, unknown> | null {
    const artifact = this.findArtifact(args.artifactId as string, args.tenantId as string | undefined);

    if (!artifact) {
      return null;
    }

    const versionEntry = artifact.versionHistory.find(v => v.version === args.version);
    if (!versionEntry) {
      return null;
    }

    return {
      artifactId: artifact.artifactId,
      version: versionEntry.version,
      content: versionEntry.content,
      title: versionEntry.title,
      timestamp: versionEntry.timestamp,
      changeType: versionEntry.changeType,
      changeSummary: versionEntry.changeSummary,
      isCurrent: versionEntry.version === artifact.versionPointer,
    };
  }

  private handleGetHistory(args: Record<string, unknown>): Record<string, unknown> | null {
    const artifact = this.findArtifact(args.artifactId as string, args.tenantId as string | undefined);

    if (!artifact) {
      return null;
    }

    return {
      history: artifact.versionHistory.map(v => ({
        ...v,
        artifactId: artifact.artifactId,
        isCurrent: v.version === artifact.versionPointer,
      })),
      total: artifact.versionHistory.length,
      currentVersion: artifact.versionPointer,
      latestVersion: artifact.version,
      canUndo: artifact.versionPointer > 1,
      canRedo: artifact.versionPointer < artifact.version,
    };
  }

  private findArtifact(artifactId: string, tenantId?: string): MockArtifact | undefined {
    for (const artifact of this.artifacts.values()) {
      if (tenantId) {
        if (artifact.tenantId === tenantId && artifact.artifactId === artifactId) {
          return artifact;
        }
      } else {
        if (artifact.artifactId === artifactId && !artifact.tenantId) {
          return artifact;
        }
      }
    }
    return undefined;
  }
}

describe("Artifacts Backend", () => {
  let t: MockConvexTestingHelper;

  beforeEach(async () => {
    t = new MockConvexTestingHelper();
    await t.mutation("artifacts:purgeAll", {});
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Create Mutation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("create mutation", () => {
    it("should create artifact with auto-generated ID", async () => {
      const result = await t.mutation("artifacts:create", {
        memorySpaceId: "test-space",
        kind: "text",
        content: "Hello world",
        title: "Test Artifact",
      }) as MockArtifact;

      expect(result.artifactId).toMatch(/^art-\d+-[a-z0-9]+$/);
      expect(result.version).toBe(1);
      expect(result.versionPointer).toBe(1);
      expect(result.streamingState).toBe("draft");
      expect(result.versionHistory).toHaveLength(1);
      expect(result.content).toBe("Hello world");
    });

    it("should create artifact with custom ID", async () => {
      const result = await t.mutation("artifacts:create", {
        artifactId: "my-custom-id",
        memorySpaceId: "test-space",
        kind: "code",
        content: "console.log('hello');",
      }) as MockArtifact;

      expect(result.artifactId).toBe("my-custom-id");
    });

    it("should reject duplicate artifactId within tenant", async () => {
      await t.mutation("artifacts:create", {
        artifactId: "my-doc",
        memorySpaceId: "test-space",
        tenantId: "tenant-1",
        kind: "text",
        content: "v1",
      });

      await expect(
        t.mutation("artifacts:create", {
          artifactId: "my-doc",
          memorySpaceId: "test-space",
          tenantId: "tenant-1",
          kind: "text",
          content: "v2",
        })
      ).rejects.toThrow("ARTIFACT_ALREADY_EXISTS");
    });

    it("should allow same artifactId across different tenants", async () => {
      await t.mutation("artifacts:create", {
        artifactId: "shared-id",
        memorySpaceId: "test-space",
        tenantId: "tenant-1",
        kind: "text",
        content: "tenant 1 content",
      });

      const result = await t.mutation("artifacts:create", {
        artifactId: "shared-id",
        memorySpaceId: "test-space",
        tenantId: "tenant-2",
        kind: "text",
        content: "tenant 2 content",
      }) as MockArtifact;

      expect(result.artifactId).toBe("shared-id");
      expect(result.tenantId).toBe("tenant-2");
    });

    it("should initialize version history with initial entry", async () => {
      const result = await t.mutation("artifacts:create", {
        memorySpaceId: "test-space",
        kind: "text",
        content: "Initial content",
        title: "My Title",
      }) as MockArtifact;

      expect(result.versionHistory).toHaveLength(1);
      expect(result.versionHistory[0]).toMatchObject({
        version: 1,
        content: "Initial content",
        title: "My Title",
        changeType: "create",
      });
    });

    it("should set default streaming state to draft", async () => {
      const result = await t.mutation("artifacts:create", {
        memorySpaceId: "test-space",
        kind: "text",
        content: "content",
      }) as MockArtifact;

      expect(result.streamingState).toBe("draft");
    });

    it("should set empty tags by default", async () => {
      const result = await t.mutation("artifacts:create", {
        memorySpaceId: "test-space",
        kind: "text",
        content: "content",
      }) as MockArtifact;

      expect(result.tags).toEqual([]);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Update Mutation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("update mutation", () => {
    it("should increment version and update history", async () => {
      const created = await t.mutation("artifacts:create", {
        memorySpaceId: "test-space",
        kind: "code",
        content: "v1 content",
      }) as MockArtifact;

      const updated = await t.mutation("artifacts:update", {
        artifactId: created.artifactId,
        content: "v2 content",
        changeSummary: "Updated content",
      }) as MockArtifact;

      expect(updated.version).toBe(2);
      expect(updated.versionPointer).toBe(2);
      expect(updated.content).toBe("v2 content");
      expect(updated.versionHistory).toHaveLength(2);
      expect(updated.versionHistory[1].changeSummary).toBe("Updated content");
    });

    it("should throw ARTIFACT_NOT_FOUND for invalid ID", async () => {
      await expect(
        t.mutation("artifacts:update", {
          artifactId: "nonexistent",
          content: "new content",
        })
      ).rejects.toThrow("ARTIFACT_NOT_FOUND");
    });

    it("should throw ARTIFACT_IS_DELETED for deleted artifact", async () => {
      const created = await t.mutation("artifacts:create", {
        memorySpaceId: "test-space",
        kind: "text",
        content: "content",
      }) as MockArtifact;

      await t.mutation("artifacts:deleteArtifact", {
        artifactId: created.artifactId,
      });

      await expect(
        t.mutation("artifacts:update", {
          artifactId: created.artifactId,
          content: "new content",
        })
      ).rejects.toThrow("ARTIFACT_IS_DELETED");
    });

    it("should branch from undo state discarding future versions", async () => {
      const created = await t.mutation("artifacts:create", {
        memorySpaceId: "test-space",
        kind: "text",
        content: "v1",
      }) as MockArtifact;

      await t.mutation("artifacts:update", {
        artifactId: created.artifactId,
        content: "v2",
      });

      await t.mutation("artifacts:update", {
        artifactId: created.artifactId,
        content: "v3",
      });

      // Undo to v2
      await t.mutation("artifacts:undo", {
        artifactId: created.artifactId,
      });

      // Update from v2 (should branch)
      const branched = await t.mutation("artifacts:update", {
        artifactId: created.artifactId,
        content: "v3-branch",
      }) as MockArtifact;

      expect(branched.version).toBe(3);
      expect(branched.versionHistory).toHaveLength(3);
      expect(branched.content).toBe("v3-branch");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Delete Mutation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("deleteArtifact mutation", () => {
    it("should soft delete by default", async () => {
      const created = await t.mutation("artifacts:create", {
        memorySpaceId: "test-space",
        kind: "text",
        content: "content",
      }) as MockArtifact;

      const result = await t.mutation("artifacts:deleteArtifact", {
        artifactId: created.artifactId,
      }) as Record<string, unknown>;

      expect(result.deleted).toBe(true);
      expect(result.permanent).toBe(false);
      expect(result.restorable).toBe(true);
    });

    it("should hard delete when specified", async () => {
      const created = await t.mutation("artifacts:create", {
        memorySpaceId: "test-space",
        kind: "text",
        content: "content",
      }) as MockArtifact;

      const result = await t.mutation("artifacts:deleteArtifact", {
        artifactId: created.artifactId,
        hard: true,
      }) as Record<string, unknown>;

      expect(result.deleted).toBe(true);
      expect(result.permanent).toBe(true);

      // Verify it's actually gone
      const found = await t.query("artifacts:get", {
        artifactId: created.artifactId,
      });
      expect(found).toBeNull();
    });

    it("should throw ARTIFACT_NOT_FOUND for invalid ID", async () => {
      await expect(
        t.mutation("artifacts:deleteArtifact", {
          artifactId: "nonexistent",
        })
      ).rejects.toThrow("ARTIFACT_NOT_FOUND");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Undo Mutation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("undo mutation", () => {
    it("should restore previous version content", async () => {
      const created = await t.mutation("artifacts:create", {
        memorySpaceId: "test-space",
        kind: "text",
        content: "Original content",
        title: "Original title",
      }) as MockArtifact;

      await t.mutation("artifacts:update", {
        artifactId: created.artifactId,
        content: "Updated content",
        title: "Updated title",
      });

      const undone = await t.mutation("artifacts:undo", {
        artifactId: created.artifactId,
      }) as Record<string, unknown>;

      expect(undone.currentVersion).toBe(1);
      expect(undone.canUndo).toBe(false);
      expect(undone.canRedo).toBe(true);

      const artifact = await t.query("artifacts:get", {
        artifactId: created.artifactId,
      }) as MockArtifact;
      expect(artifact.content).toBe("Original content");
      expect(artifact.title).toBe("Original title");
    });

    it("should throw UNDO_NOT_AVAILABLE at version 1", async () => {
      const created = await t.mutation("artifacts:create", {
        memorySpaceId: "test-space",
        kind: "text",
        content: "content",
      }) as MockArtifact;

      await expect(
        t.mutation("artifacts:undo", {
          artifactId: created.artifactId,
        })
      ).rejects.toThrow("UNDO_NOT_AVAILABLE");
    });

    it("should throw ARTIFACT_NOT_FOUND for invalid ID", async () => {
      await expect(
        t.mutation("artifacts:undo", {
          artifactId: "nonexistent",
        })
      ).rejects.toThrow("ARTIFACT_NOT_FOUND");
    });

    it("should allow multiple undos", async () => {
      const created = await t.mutation("artifacts:create", {
        memorySpaceId: "test-space",
        kind: "text",
        content: "v1",
      }) as MockArtifact;

      await t.mutation("artifacts:update", {
        artifactId: created.artifactId,
        content: "v2",
      });

      await t.mutation("artifacts:update", {
        artifactId: created.artifactId,
        content: "v3",
      });

      // First undo: v3 -> v2
      await t.mutation("artifacts:undo", {
        artifactId: created.artifactId,
      });

      // Second undo: v2 -> v1
      const result = await t.mutation("artifacts:undo", {
        artifactId: created.artifactId,
      }) as Record<string, unknown>;

      expect(result.currentVersion).toBe(1);
      expect(result.canUndo).toBe(false);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Redo Mutation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("redo mutation", () => {
    it("should restore newer version after undo", async () => {
      const created = await t.mutation("artifacts:create", {
        memorySpaceId: "test-space",
        kind: "text",
        content: "v1",
      }) as MockArtifact;

      await t.mutation("artifacts:update", {
        artifactId: created.artifactId,
        content: "v2",
      });

      await t.mutation("artifacts:undo", {
        artifactId: created.artifactId,
      });

      const redone = await t.mutation("artifacts:redo", {
        artifactId: created.artifactId,
      }) as Record<string, unknown>;

      expect(redone.currentVersion).toBe(2);
      expect(redone.canUndo).toBe(true);
      expect(redone.canRedo).toBe(false);
    });

    it("should throw REDO_NOT_AVAILABLE at latest version", async () => {
      const created = await t.mutation("artifacts:create", {
        memorySpaceId: "test-space",
        kind: "text",
        content: "content",
      }) as MockArtifact;

      await expect(
        t.mutation("artifacts:redo", {
          artifactId: created.artifactId,
        })
      ).rejects.toThrow("REDO_NOT_AVAILABLE");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Get Query
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("get query", () => {
    it("should return artifact by ID", async () => {
      const created = await t.mutation("artifacts:create", {
        memorySpaceId: "test-space",
        kind: "text",
        content: "content",
      }) as MockArtifact;

      const found = await t.query("artifacts:get", {
        artifactId: created.artifactId,
      }) as MockArtifact;

      expect(found).not.toBeNull();
      expect(found.artifactId).toBe(created.artifactId);
    });

    it("should return null for invalid ID", async () => {
      const found = await t.query("artifacts:get", {
        artifactId: "nonexistent",
      });

      expect(found).toBeNull();
    });

    it("should enforce tenant isolation", async () => {
      const artifact = await t.mutation("artifacts:create", {
        memorySpaceId: "test-space",
        tenantId: "tenant-a",
        kind: "text",
        content: "secret",
      }) as MockArtifact;

      // Same tenant - success
      const found = await t.query("artifacts:get", {
        artifactId: artifact.artifactId,
        tenantId: "tenant-a",
      });
      expect(found).not.toBeNull();

      // Different tenant - not found
      const notFound = await t.query("artifacts:get", {
        artifactId: artifact.artifactId,
        tenantId: "tenant-b",
      });
      expect(notFound).toBeNull();
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // List Query
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("list query", () => {
    it("should list artifacts by memorySpaceId", async () => {
      await t.mutation("artifacts:create", {
        memorySpaceId: "space-1",
        kind: "text",
        content: "content 1",
      });

      await t.mutation("artifacts:create", {
        memorySpaceId: "space-2",
        kind: "text",
        content: "content 2",
      });

      const result = await t.query("artifacts:list", {
        memorySpaceId: "space-1",
      }) as { artifacts: MockArtifact[]; total: number };

      expect(result.artifacts).toHaveLength(1);
      expect(result.artifacts[0].memorySpaceId).toBe("space-1");
    });

    it("should filter by kind", async () => {
      await t.mutation("artifacts:create", {
        memorySpaceId: "test-space",
        kind: "code",
        content: "console.log()",
      });

      await t.mutation("artifacts:create", {
        memorySpaceId: "test-space",
        kind: "text",
        content: "Hello",
      });

      const result = await t.query("artifacts:list", {
        memorySpaceId: "test-space",
        kind: "code",
      }) as { artifacts: MockArtifact[] };

      expect(result.artifacts).toHaveLength(1);
      expect(result.artifacts[0].kind).toBe("code");
    });

    it("should filter by streamingState", async () => {
      await t.mutation("artifacts:create", {
        memorySpaceId: "test-space",
        kind: "text",
        content: "draft content",
        streamingState: "draft",
      });

      await t.mutation("artifacts:create", {
        memorySpaceId: "test-space",
        kind: "text",
        content: "final content",
        streamingState: "final",
      });

      const result = await t.query("artifacts:list", {
        memorySpaceId: "test-space",
        streamingState: "final",
      }) as { artifacts: MockArtifact[] };

      expect(result.artifacts).toHaveLength(1);
      expect(result.artifacts[0].streamingState).toBe("final");
    });

    it("should exclude deleted by default", async () => {
      const created = await t.mutation("artifacts:create", {
        memorySpaceId: "test-space",
        kind: "text",
        content: "content",
      }) as MockArtifact;

      await t.mutation("artifacts:deleteArtifact", {
        artifactId: created.artifactId,
      });

      const result = await t.query("artifacts:list", {
        memorySpaceId: "test-space",
      }) as { artifacts: MockArtifact[] };

      expect(result.artifacts).toHaveLength(0);
    });

    it("should include deleted when specified", async () => {
      const created = await t.mutation("artifacts:create", {
        memorySpaceId: "test-space",
        kind: "text",
        content: "content",
      }) as MockArtifact;

      await t.mutation("artifacts:deleteArtifact", {
        artifactId: created.artifactId,
      });

      const result = await t.query("artifacts:list", {
        memorySpaceId: "test-space",
        includeDeleted: true,
      }) as { artifacts: MockArtifact[] };

      expect(result.artifacts).toHaveLength(1);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Count Query
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("count query", () => {
    it("should count artifacts by memorySpaceId", async () => {
      await t.mutation("artifacts:create", {
        memorySpaceId: "test-space",
        kind: "text",
        content: "content 1",
      });

      await t.mutation("artifacts:create", {
        memorySpaceId: "test-space",
        kind: "code",
        content: "content 2",
      });

      const count = await t.query("artifacts:count", {
        memorySpaceId: "test-space",
      });

      expect(count).toBe(2);
    });

    it("should count with filters", async () => {
      await t.mutation("artifacts:create", {
        memorySpaceId: "test-space",
        kind: "code",
        content: "console.log()",
      });

      await t.mutation("artifacts:create", {
        memorySpaceId: "test-space",
        kind: "text",
        content: "Hello",
      });

      const count = await t.query("artifacts:count", {
        memorySpaceId: "test-space",
        kind: "code",
      });

      expect(count).toBe(1);
    });

    it("should return zero for no matches", async () => {
      const count = await t.query("artifacts:count", {
        memorySpaceId: "empty-space",
      });

      expect(count).toBe(0);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GetVersion Query
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("getVersion query", () => {
    it("should return specific version", async () => {
      const created = await t.mutation("artifacts:create", {
        memorySpaceId: "test-space",
        kind: "text",
        content: "v1 content",
      }) as MockArtifact;

      await t.mutation("artifacts:update", {
        artifactId: created.artifactId,
        content: "v2 content",
      });

      const v1 = await t.query("artifacts:getVersion", {
        artifactId: created.artifactId,
        version: 1,
      }) as Record<string, unknown>;

      expect(v1).not.toBeNull();
      expect(v1.version).toBe(1);
      expect(v1.content).toBe("v1 content");
    });

    it("should return null for invalid version", async () => {
      const created = await t.mutation("artifacts:create", {
        memorySpaceId: "test-space",
        kind: "text",
        content: "content",
      }) as MockArtifact;

      const result = await t.query("artifacts:getVersion", {
        artifactId: created.artifactId,
        version: 999,
      });

      expect(result).toBeNull();
    });

    it("should include isCurrent flag", async () => {
      const created = await t.mutation("artifacts:create", {
        memorySpaceId: "test-space",
        kind: "text",
        content: "content",
      }) as MockArtifact;

      const v1 = await t.query("artifacts:getVersion", {
        artifactId: created.artifactId,
        version: 1,
      }) as Record<string, unknown>;

      expect(v1.isCurrent).toBe(true);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GetHistory Query
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("getHistory query", () => {
    it("should return full version history", async () => {
      const created = await t.mutation("artifacts:create", {
        memorySpaceId: "test-space",
        kind: "text",
        content: "v1",
      }) as MockArtifact;

      await t.mutation("artifacts:update", {
        artifactId: created.artifactId,
        content: "v2",
      });

      await t.mutation("artifacts:update", {
        artifactId: created.artifactId,
        content: "v3",
      });

      const result = await t.query("artifacts:getHistory", {
        artifactId: created.artifactId,
      }) as Record<string, unknown>;

      expect(result.history).toHaveLength(3);
      expect(result.total).toBe(3);
      expect(result.currentVersion).toBe(3);
      expect(result.latestVersion).toBe(3);
      expect(result.canUndo).toBe(true);
      expect(result.canRedo).toBe(false);
    });

    it("should return null for nonexistent artifact", async () => {
      const result = await t.query("artifacts:getHistory", {
        artifactId: "nonexistent",
      });

      expect(result).toBeNull();
    });

    it("should correctly report canUndo and canRedo after undo", async () => {
      const created = await t.mutation("artifacts:create", {
        memorySpaceId: "test-space",
        kind: "text",
        content: "v1",
      }) as MockArtifact;

      await t.mutation("artifacts:update", {
        artifactId: created.artifactId,
        content: "v2",
      });

      await t.mutation("artifacts:undo", {
        artifactId: created.artifactId,
      });

      const result = await t.query("artifacts:getHistory", {
        artifactId: created.artifactId,
      }) as Record<string, unknown>;

      expect(result.currentVersion).toBe(1);
      expect(result.latestVersion).toBe(2);
      expect(result.canUndo).toBe(false);
      expect(result.canRedo).toBe(true);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SetStreamingState Mutation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("setStreamingState mutation", () => {
    it("should update streaming state", async () => {
      const created = await t.mutation("artifacts:create", {
        memorySpaceId: "test-space",
        kind: "text",
        content: "content",
      }) as MockArtifact;

      const result = await t.mutation("artifacts:setStreamingState", {
        artifactId: created.artifactId,
        streamingState: "final",
      }) as Record<string, unknown>;

      expect(result.success).toBe(true);
      expect(result.previousState).toBe("draft");
      expect(result.currentState).toBe("final");
    });

    it("should throw ARTIFACT_NOT_FOUND for invalid ID", async () => {
      await expect(
        t.mutation("artifacts:setStreamingState", {
          artifactId: "nonexistent",
          streamingState: "final",
        })
      ).rejects.toThrow("ARTIFACT_NOT_FOUND");
    });
  });
});
