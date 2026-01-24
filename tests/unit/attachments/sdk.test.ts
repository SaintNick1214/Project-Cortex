/**
 * Unit Tests: Attachments SDK
 *
 * Tests for AttachmentsAPI class with mocked Convex client.
 * Covers all API methods and all supported modalities:
 * - image (PNG, JPEG, GIF, WEBP)
 * - audio (MP3, WAV, OGG)
 * - video (MP4, WEBM)
 * - pdf
 * - file (generic)
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { AttachmentsAPI } from "../../../src/attachments";
import type {
  Attachment,
  AttachParams,
  ListAttachmentsFilter,
  AttachmentType,
} from "../../../src/types";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Mock Setup
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Mock types - use ReturnType to avoid typing issues
type MockConvexClient = {
  mutation: ReturnType<typeof jest.fn>;
  query: ReturnType<typeof jest.fn>;
};

function createMockClient(): MockConvexClient {
  return {
    mutation: jest.fn(),
    query: jest.fn(),
  };
}

type MockResilienceLayer = {
  execute: ReturnType<typeof jest.fn>;
};

function createMockResilience(): MockResilienceLayer {
  return {
    execute: jest.fn((fn: () => Promise<unknown>) => fn()),
  };
}

function createMockAuthContext(tenantId?: string) {
  return tenantId ? { tenantId } : undefined;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Test Data Factories
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const now = Date.now();

function createMockAttachment(overrides: Partial<Attachment> = {}): Attachment {
  return {
    _id: "doc_123",
    attachmentId: "attach-abc123",
    memorySpaceId: "space-123",
    userId: "user-456",
    storageId: "storage-789",
    type: "image",
    mimeType: "image/png",
    filename: "test.png",
    size: 1024,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// Modality-specific test data
const MODALITY_TEST_DATA: Record<AttachmentType, Partial<Attachment>> = {
  image: {
    type: "image",
    mimeType: "image/png",
    filename: "photo.png",
    size: 2048000, // 2MB
    dimensions: { width: 1920, height: 1080 },
  },
  audio: {
    type: "audio",
    mimeType: "audio/mpeg",
    filename: "recording.mp3",
    size: 5242880, // 5MB
    duration: 180, // 3 minutes
  },
  video: {
    type: "video",
    mimeType: "video/mp4",
    filename: "clip.mp4",
    size: 52428800, // 50MB
    dimensions: { width: 1920, height: 1080 },
    duration: 60, // 1 minute
  },
  pdf: {
    type: "pdf",
    mimeType: "application/pdf",
    filename: "document.pdf",
    size: 1048576, // 1MB
    extractedText: "Sample PDF content extracted via OCR",
  },
  file: {
    type: "file",
    mimeType: "application/octet-stream",
    filename: "data.bin",
    size: 512000,
  },
};

// MIME type variations for each modality
const MIME_TYPE_VARIATIONS: Record<AttachmentType, string[]> = {
  image: ["image/png", "image/jpeg", "image/gif", "image/webp"],
  audio: ["audio/mpeg", "audio/wav", "audio/ogg", "audio/webm"],
  video: ["video/mp4", "video/webm", "video/quicktime"],
  pdf: ["application/pdf"],
  file: ["application/octet-stream", "application/zip", "text/plain"],
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// generateUploadUrl Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("AttachmentsAPI.generateUploadUrl", () => {
  let client: MockConvexClient;
  let resilience: MockResilienceLayer;
  let api: AttachmentsAPI;

  beforeEach(() => {
    client = createMockClient();
    resilience = createMockResilience();
    api = new AttachmentsAPI(client as unknown as never, resilience as never);
  });

  it("should generate upload URL successfully", async () => {
    const mockUrl = "https://convex.cloud/upload/abc123";
    client.mutation.mockResolvedValue({ uploadUrl: mockUrl });

    const result = await api.generateUploadUrl();

    expect(result.uploadUrl).toBe(mockUrl);
    expect(client.mutation).toHaveBeenCalledTimes(1);
  });

  it("should pass tenant ID when auth context provided", async () => {
    const authContext = { tenantId: "tenant-abc" };
    const tenantApi = new AttachmentsAPI(
      client as unknown as never,
      resilience as never,
      authContext as never
    );
    client.mutation.mockResolvedValue({ uploadUrl: "https://example.com" });

    await tenantApi.generateUploadUrl();

    const callArgs = client.mutation.mock.calls[0][1];
    expect(callArgs.tenantId).toBe("tenant-abc");
  });

  it("should use resilience layer when available", async () => {
    client.mutation.mockResolvedValue({ uploadUrl: "https://example.com" });

    await api.generateUploadUrl();

    expect(resilience.execute).toHaveBeenCalledTimes(1);
    expect(resilience.execute).toHaveBeenCalledWith(
      expect.any(Function),
      "attachments:generateUploadUrl"
    );
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// attach Tests - All Modalities
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("AttachmentsAPI.attach", () => {
  let client: MockConvexClient;
  let resilience: MockResilienceLayer;
  let api: AttachmentsAPI;

  beforeEach(() => {
    client = createMockClient();
    resilience = createMockResilience();
    api = new AttachmentsAPI(client as unknown as never, resilience as never);
  });

  // Test each modality type
  const modalities: AttachmentType[] = ["image", "audio", "video", "pdf", "file"];

  modalities.forEach((modality) => {
    describe(`${modality} modality`, () => {
      const testData = MODALITY_TEST_DATA[modality];
      const mimeTypes = MIME_TYPE_VARIATIONS[modality];

      it(`should attach ${modality} with correct metadata`, async () => {
        const mockResponse = createMockAttachment(testData);
        client.mutation.mockResolvedValue(mockResponse);

        const params: AttachParams = {
          storageId: "storage-new",
          memorySpaceId: "space-123",
          userId: "user-456",
          type: modality,
          mimeType: testData.mimeType!,
          filename: testData.filename!,
          size: testData.size!,
          dimensions: testData.dimensions,
          duration: testData.duration,
        };

        const result = await api.attach(params);

        expect(result.type).toBe(modality);
        expect(result.mimeType).toBe(testData.mimeType);
        expect(result.filename).toBe(testData.filename);
        expect(client.mutation).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            type: modality,
            mimeType: testData.mimeType,
          })
        );
      });

      // Test MIME type variations
      mimeTypes.forEach((mimeType) => {
        it(`should accept ${mimeType} MIME type`, async () => {
          const mockResponse = createMockAttachment({ ...testData, mimeType });
          client.mutation.mockResolvedValue(mockResponse);

          const params: AttachParams = {
            storageId: "storage-new",
            memorySpaceId: "space-123",
            userId: "user-456",
            type: modality,
            mimeType,
            filename: testData.filename!,
            size: testData.size!,
          };

          const result = await api.attach(params);

          expect(result.mimeType).toBe(mimeType);
        });
      });

      // Test modality-specific features
      if (modality === "image" || modality === "video") {
        it(`should store dimensions for ${modality}`, async () => {
          const mockResponse = createMockAttachment(testData);
          client.mutation.mockResolvedValue(mockResponse);

          const params: AttachParams = {
            storageId: "storage-new",
            memorySpaceId: "space-123",
            userId: "user-456",
            type: modality,
            mimeType: testData.mimeType!,
            filename: testData.filename!,
            size: testData.size!,
            dimensions: { width: 1920, height: 1080 },
          };

          await api.attach(params);

          expect(client.mutation).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
              dimensions: { width: 1920, height: 1080 },
            })
          );
        });
      }

      if (modality === "audio" || modality === "video") {
        it(`should store duration for ${modality}`, async () => {
          const mockResponse = createMockAttachment(testData);
          client.mutation.mockResolvedValue(mockResponse);

          const params: AttachParams = {
            storageId: "storage-new",
            memorySpaceId: "space-123",
            userId: "user-456",
            type: modality,
            mimeType: testData.mimeType!,
            filename: testData.filename!,
            size: testData.size!,
            duration: 120,
          };

          await api.attach(params);

          expect(client.mutation).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
              duration: 120,
            })
          );
        });
      }
    });
  });

  it("should link attachment to conversation", async () => {
    const mockResponse = createMockAttachment({ conversationId: "conv-123" });
    client.mutation.mockResolvedValue(mockResponse);

    const params: AttachParams = {
      storageId: "storage-new",
      memorySpaceId: "space-123",
      userId: "user-456",
      type: "image",
      mimeType: "image/png",
      filename: "test.png",
      size: 1024,
      conversationId: "conv-123",
    };

    await api.attach(params);

    expect(client.mutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ conversationId: "conv-123" })
    );
  });

  it("should link attachment to message", async () => {
    const mockResponse = createMockAttachment({ messageId: "msg-456" });
    client.mutation.mockResolvedValue(mockResponse);

    const params: AttachParams = {
      storageId: "storage-new",
      memorySpaceId: "space-123",
      userId: "user-456",
      type: "image",
      mimeType: "image/png",
      filename: "test.png",
      size: 1024,
      messageId: "msg-456",
    };

    await api.attach(params);

    expect(client.mutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ messageId: "msg-456" })
    );
  });

  it("should include custom metadata", async () => {
    const mockResponse = createMockAttachment();
    client.mutation.mockResolvedValue(mockResponse);

    const customMetadata = { source: "camera", location: "office" };
    const params: AttachParams = {
      storageId: "storage-new",
      memorySpaceId: "space-123",
      userId: "user-456",
      type: "image",
      mimeType: "image/png",
      filename: "test.png",
      size: 1024,
      metadata: customMetadata,
    };

    await api.attach(params);

    expect(client.mutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ metadata: customMetadata })
    );
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// get Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("AttachmentsAPI.get", () => {
  let client: MockConvexClient;
  let resilience: MockResilienceLayer;
  let api: AttachmentsAPI;

  beforeEach(() => {
    client = createMockClient();
    resilience = createMockResilience();
    api = new AttachmentsAPI(client as unknown as never, resilience as never);
  });

  it("should retrieve attachment by ID", async () => {
    const mockAttachment = createMockAttachment();
    client.query.mockResolvedValue(mockAttachment);

    const result = await api.get("attach-abc123");

    expect(result).toEqual(mockAttachment);
    expect(client.query).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ attachmentId: "attach-abc123" })
    );
  });

  it("should return null for non-existent attachment", async () => {
    client.query.mockResolvedValue(null);

    const result = await api.get("non-existent");

    expect(result).toBeNull();
  });

  // Test retrieval of each modality
  const modalities: AttachmentType[] = ["image", "audio", "video", "pdf", "file"];

  modalities.forEach((modality) => {
    it(`should correctly parse ${modality} attachment`, async () => {
      const mockAttachment = createMockAttachment(MODALITY_TEST_DATA[modality]);
      client.query.mockResolvedValue(mockAttachment);

      const result = await api.get("attach-123");

      expect(result?.type).toBe(modality);
      if (modality === "image" || modality === "video") {
        expect(result?.dimensions).toBeDefined();
      }
      if (modality === "audio" || modality === "video") {
        expect(result?.duration).toBeDefined();
      }
    });
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// getUrl Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("AttachmentsAPI.getUrl", () => {
  let client: MockConvexClient;
  let resilience: MockResilienceLayer;
  let api: AttachmentsAPI;

  beforeEach(() => {
    client = createMockClient();
    resilience = createMockResilience();
    api = new AttachmentsAPI(client as unknown as never, resilience as never);
  });

  it("should return signed download URL", async () => {
    const mockUrl = "https://convex.cloud/download/signed-url-abc123";
    client.query.mockResolvedValue({ url: mockUrl });

    const result = await api.getUrl("attach-abc123");

    expect(result).toBe(mockUrl);
    expect(client.query).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ attachmentId: "attach-abc123" })
    );
  });

  it("should return null for non-existent attachment", async () => {
    client.query.mockResolvedValue(null);

    const result = await api.getUrl("non-existent");

    expect(result).toBeNull();
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// list Tests - Filtering by Modality
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("AttachmentsAPI.list", () => {
  let client: MockConvexClient;
  let resilience: MockResilienceLayer;
  let api: AttachmentsAPI;

  beforeEach(() => {
    client = createMockClient();
    resilience = createMockResilience();
    api = new AttachmentsAPI(client as unknown as never, resilience as never);
  });

  it("should list all attachments in memory space", async () => {
    const mockResponse = {
      attachments: [createMockAttachment(), createMockAttachment({ attachmentId: "attach-2" })],
      total: 2,
      hasMore: false,
    };
    client.query.mockResolvedValue(mockResponse);

    const filter: ListAttachmentsFilter = { memorySpaceId: "space-123" };
    const result = await api.list(filter);

    expect(result.attachments).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.hasMore).toBe(false);
  });

  // Test filtering by each modality type
  const modalities: AttachmentType[] = ["image", "audio", "video", "pdf", "file"];

  modalities.forEach((modality) => {
    it(`should filter by ${modality} type`, async () => {
      const mockAttachment = createMockAttachment(MODALITY_TEST_DATA[modality]);
      const mockResponse = {
        attachments: [mockAttachment],
        total: 1,
        hasMore: false,
      };
      client.query.mockResolvedValue(mockResponse);

      const filter: ListAttachmentsFilter = {
        memorySpaceId: "space-123",
        type: modality,
      };
      const result = await api.list(filter);

      expect(result.attachments[0].type).toBe(modality);
      expect(client.query).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ type: modality })
      );
    });
  });

  it("should filter by conversation", async () => {
    const mockResponse = {
      attachments: [createMockAttachment({ conversationId: "conv-123" })],
      total: 1,
      hasMore: false,
    };
    client.query.mockResolvedValue(mockResponse);

    const filter: ListAttachmentsFilter = {
      memorySpaceId: "space-123",
      conversationId: "conv-123",
    };
    await api.list(filter);

    expect(client.query).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ conversationId: "conv-123" })
    );
  });

  it("should filter by message", async () => {
    const mockResponse = {
      attachments: [createMockAttachment({ messageId: "msg-456" })],
      total: 1,
      hasMore: false,
    };
    client.query.mockResolvedValue(mockResponse);

    const filter: ListAttachmentsFilter = {
      memorySpaceId: "space-123",
      messageId: "msg-456",
    };
    await api.list(filter);

    expect(client.query).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ messageId: "msg-456" })
    );
  });

  it("should paginate results with cursor", async () => {
    const mockResponse = {
      attachments: [createMockAttachment()],
      total: 100,
      hasMore: true,
      cursor: "cursor-page2",
    };
    client.query.mockResolvedValue(mockResponse);

    const filter: ListAttachmentsFilter = {
      memorySpaceId: "space-123",
      limit: 10,
    };
    const result = await api.list(filter);

    expect(result.hasMore).toBe(true);
    expect(result.cursor).toBe("cursor-page2");
  });

  it("should sort by createdAt ascending", async () => {
    const mockResponse = { attachments: [], total: 0, hasMore: false };
    client.query.mockResolvedValue(mockResponse);

    const filter: ListAttachmentsFilter = {
      memorySpaceId: "space-123",
      sortBy: "createdAt",
      sortOrder: "asc",
    };
    await api.list(filter);

    expect(client.query).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ sortBy: "createdAt", sortOrder: "asc" })
    );
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// getByConversation / getByMessage Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("AttachmentsAPI.getByConversation", () => {
  let client: MockConvexClient;
  let api: AttachmentsAPI;

  beforeEach(() => {
    client = createMockClient();
    api = new AttachmentsAPI(client as unknown as never);
  });

  it("should get all attachments for a conversation", async () => {
    const mockAttachments = [
      createMockAttachment({ conversationId: "conv-123", type: "image" }),
      createMockAttachment({ conversationId: "conv-123", type: "pdf", attachmentId: "attach-2" }),
    ];
    client.query.mockResolvedValue(mockAttachments);

    const result = await api.getByConversation("conv-123");

    expect(result).toHaveLength(2);
    expect(result[0].conversationId).toBe("conv-123");
  });
});

describe("AttachmentsAPI.getByMessage", () => {
  let client: MockConvexClient;
  let api: AttachmentsAPI;

  beforeEach(() => {
    client = createMockClient();
    api = new AttachmentsAPI(client as unknown as never);
  });

  it("should get all attachments for a message", async () => {
    const mockAttachments = [
      createMockAttachment({ messageId: "msg-456", type: "image" }),
    ];
    client.query.mockResolvedValue(mockAttachments);

    const result = await api.getByMessage("msg-456");

    expect(result).toHaveLength(1);
    expect(result[0].messageId).toBe("msg-456");
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// count Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("AttachmentsAPI.count", () => {
  let client: MockConvexClient;
  let api: AttachmentsAPI;

  beforeEach(() => {
    client = createMockClient();
    api = new AttachmentsAPI(client as unknown as never);
  });

  it("should count all attachments in memory space", async () => {
    // Convex backend returns raw number
    client.query.mockResolvedValue(42);

    const result = await api.count({ memorySpaceId: "space-123" });

    expect(result).toBe(42);
  });

  // Test counting by each modality
  const modalities: AttachmentType[] = ["image", "audio", "video", "pdf", "file"];

  modalities.forEach((modality) => {
    it(`should count ${modality} attachments`, async () => {
      client.query.mockResolvedValue(10);

      await api.count({ memorySpaceId: "space-123", type: modality });

      expect(client.query).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ type: modality })
      );
    });
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// delete / deleteMany Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("AttachmentsAPI.delete", () => {
  let client: MockConvexClient;
  let api: AttachmentsAPI;

  beforeEach(() => {
    client = createMockClient();
    api = new AttachmentsAPI(client as unknown as never);
  });

  it("should delete attachment by ID", async () => {
    client.mutation.mockResolvedValue({ success: true });

    await api.delete("attach-abc123");

    expect(client.mutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ attachmentId: "attach-abc123" })
    );
  });

  it("should throw for non-existent attachment", async () => {
    client.mutation.mockRejectedValue({ data: "Attachment not found" });

    await expect(api.delete("non-existent")).rejects.toThrow("Attachment not found");
  });
});

describe("AttachmentsAPI.deleteMany", () => {
  let client: MockConvexClient;
  let api: AttachmentsAPI;

  beforeEach(() => {
    client = createMockClient();
    api = new AttachmentsAPI(client as unknown as never);
  });

  it("should delete multiple attachments", async () => {
    const mockResponse = { deleted: 3, total: 3 };
    client.mutation.mockResolvedValue(mockResponse);

    const result = await api.deleteMany(["attach-1", "attach-2", "attach-3"]);

    expect(result.deleted).toBe(3);
    expect(result.total).toBe(3);
    expect(client.mutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        attachmentIds: ["attach-1", "attach-2", "attach-3"],
      })
    );
  });

  it("should report partial failures", async () => {
    const mockResponse = {
      deleted: 2,
      total: 3,
      errors: [{ attachmentId: "attach-3", error: "Not found" }],
    };
    client.mutation.mockResolvedValue(mockResponse);

    const result = await api.deleteMany(["attach-1", "attach-2", "attach-3"]);

    expect(result.deleted).toBe(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors![0].attachmentId).toBe("attach-3");
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Multi-Tenancy Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("AttachmentsAPI Multi-Tenancy", () => {
  let client: MockConvexClient;
  let resilience: MockResilienceLayer;

  beforeEach(() => {
    client = createMockClient();
    resilience = createMockResilience();
  });

  it("should include tenantId in all operations", async () => {
    const tenantApi = new AttachmentsAPI(
      client as unknown as never,
      resilience as never,
      createMockAuthContext("tenant-xyz") as never
    );

    // Test attach
    client.mutation.mockResolvedValue(createMockAttachment({ tenantId: "tenant-xyz" }));
    await tenantApi.attach({
      storageId: "storage-1",
      memorySpaceId: "space-1",
      userId: "user-1",
      type: "image",
      mimeType: "image/png",
      filename: "test.png",
      size: 1024,
    });
    expect(client.mutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tenantId: "tenant-xyz" })
    );

    // Test get
    client.query.mockResolvedValue(createMockAttachment());
    await tenantApi.get("attach-123");
    expect(client.query).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tenantId: "tenant-xyz" })
    );

    // Test list
    client.query.mockResolvedValue({ attachments: [], total: 0, hasMore: false });
    await tenantApi.list({ memorySpaceId: "space-1" });
    expect(client.query).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tenantId: "tenant-xyz" })
    );

    // Test delete
    client.mutation.mockResolvedValue({ success: true });
    await tenantApi.delete("attach-123");
    expect(client.mutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tenantId: "tenant-xyz" })
    );
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Error Handling Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("AttachmentsAPI Error Handling", () => {
  let client: MockConvexClient;
  let api: AttachmentsAPI;

  beforeEach(() => {
    client = createMockClient();
    api = new AttachmentsAPI(client as unknown as never);
  });

  it("should handle Convex errors with data property", async () => {
    client.mutation.mockRejectedValue({
      data: { code: "NOT_FOUND", message: "Attachment not found" },
    });

    await expect(api.delete("non-existent")).rejects.toThrow();
  });

  it("should propagate network errors", async () => {
    client.mutation.mockRejectedValue(new Error("Network timeout"));

    await expect(api.delete("attach-123")).rejects.toThrow("Network timeout");
  });
});
