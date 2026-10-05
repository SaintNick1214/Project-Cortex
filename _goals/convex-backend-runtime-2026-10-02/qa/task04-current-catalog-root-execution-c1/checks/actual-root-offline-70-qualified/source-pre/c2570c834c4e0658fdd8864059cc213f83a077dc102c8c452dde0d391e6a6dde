/**
 * Unit Tests: Attachment Validators
 *
 * Tests for attachment validation functions.
 * No Convex dependency - pure unit tests.
 */

import {
  validateAttachmentId,
  validateStorageId,
  validateMemorySpaceId,
  validateUserId,
  validateMimeType,
  validateFilename,
  validateFileSize,
  validateAttachmentType,
  validateDimensions,
  validateDuration,
  validateLimit,
  validateSortBy,
  validateSortOrder,
  validateAttachParams,
  validateListAttachmentsFilter,
  validateAttachmentIds,
  AttachmentValidationError,
} from "../../../src/attachments/validators";

describe("Attachment Validators", () => {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // validateAttachmentId
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("validateAttachmentId", () => {
    it("should accept valid attachment IDs", () => {
      expect(() => validateAttachmentId("attach-abc123")).not.toThrow();
      expect(() => validateAttachmentId("attachment_v1")).not.toThrow();
      expect(() => validateAttachmentId("a")).not.toThrow();
    });

    it("should reject null values", () => {
      expect(() => validateAttachmentId(null)).toThrow(AttachmentValidationError);
      expect(() => validateAttachmentId(null)).toThrow("is required");
    });

    it("should reject undefined values", () => {
      expect(() => validateAttachmentId(undefined)).toThrow(AttachmentValidationError);
      expect(() => validateAttachmentId(undefined)).toThrow("is required");
    });

    it("should reject empty strings", () => {
      expect(() => validateAttachmentId("")).toThrow(AttachmentValidationError);
      expect(() => validateAttachmentId("")).toThrow("cannot be empty");
    });

    it("should reject whitespace-only strings", () => {
      expect(() => validateAttachmentId("   ")).toThrow(AttachmentValidationError);
      expect(() => validateAttachmentId("   ")).toThrow("cannot be empty");
    });

    it("should reject non-string types", () => {
      expect(() => validateAttachmentId(123 as unknown)).toThrow(AttachmentValidationError);
      expect(() => validateAttachmentId(123 as unknown)).toThrow("must be a string");
      expect(() => validateAttachmentId({} as unknown)).toThrow(AttachmentValidationError);
      expect(() => validateAttachmentId([] as unknown)).toThrow(AttachmentValidationError);
    });

    it("should accept IDs at max length (100 chars)", () => {
      const maxId = "a".repeat(100);
      expect(() => validateAttachmentId(maxId)).not.toThrow();
    });

    it("should reject IDs exceeding max length", () => {
      const longId = "a".repeat(101);
      expect(() => validateAttachmentId(longId)).toThrow(AttachmentValidationError);
      expect(() => validateAttachmentId(longId)).toThrow("exceeds maximum length");
    });

    it("should use custom field name in error message", () => {
      expect(() => validateAttachmentId(null, "myField")).toThrow("myField is required");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // validateStorageId
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("validateStorageId", () => {
    it("should accept valid storage IDs", () => {
      expect(() => validateStorageId("kg2abc123xyz")).not.toThrow();
      expect(() => validateStorageId("storage_id_1")).not.toThrow();
    });

    it("should reject null values", () => {
      expect(() => validateStorageId(null)).toThrow(AttachmentValidationError);
      expect(() => validateStorageId(null)).toThrow("storageId is required");
    });

    it("should reject empty strings", () => {
      expect(() => validateStorageId("")).toThrow(AttachmentValidationError);
      expect(() => validateStorageId("")).toThrow("cannot be empty");
    });

    it("should reject non-string types", () => {
      expect(() => validateStorageId(123 as unknown)).toThrow(AttachmentValidationError);
      expect(() => validateStorageId(123 as unknown)).toThrow("must be a string");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // validateMemorySpaceId
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("validateMemorySpaceId", () => {
    it("should accept valid memory space IDs", () => {
      expect(() => validateMemorySpaceId("space-123")).not.toThrow();
      expect(() => validateMemorySpaceId("user_space")).not.toThrow();
    });

    it("should reject null values", () => {
      expect(() => validateMemorySpaceId(null)).toThrow(AttachmentValidationError);
      expect(() => validateMemorySpaceId(null)).toThrow("memorySpaceId is required");
    });

    it("should reject empty strings", () => {
      expect(() => validateMemorySpaceId("")).toThrow(AttachmentValidationError);
      expect(() => validateMemorySpaceId("")).toThrow("cannot be empty");
    });

    it("should reject non-string types", () => {
      expect(() => validateMemorySpaceId(123 as unknown)).toThrow(AttachmentValidationError);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // validateUserId
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("validateUserId", () => {
    it("should accept valid user IDs", () => {
      expect(() => validateUserId("user-123")).not.toThrow();
      expect(() => validateUserId("john_doe")).not.toThrow();
    });

    it("should reject null values", () => {
      expect(() => validateUserId(null)).toThrow(AttachmentValidationError);
      expect(() => validateUserId(null)).toThrow("userId is required");
    });

    it("should reject empty strings", () => {
      expect(() => validateUserId("")).toThrow(AttachmentValidationError);
      expect(() => validateUserId("")).toThrow("cannot be empty");
    });

    it("should reject non-string types", () => {
      expect(() => validateUserId(123 as unknown)).toThrow(AttachmentValidationError);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // validateMimeType
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("validateMimeType", () => {
    it("should accept valid MIME types", () => {
      expect(() => validateMimeType("image/png")).not.toThrow();
      expect(() => validateMimeType("image/jpeg")).not.toThrow();
      expect(() => validateMimeType("application/pdf")).not.toThrow();
      expect(() => validateMimeType("audio/mpeg")).not.toThrow();
      expect(() => validateMimeType("video/mp4")).not.toThrow();
      expect(() => validateMimeType("application/octet-stream")).not.toThrow();
    });

    it("should reject null values", () => {
      expect(() => validateMimeType(null)).toThrow(AttachmentValidationError);
      expect(() => validateMimeType(null)).toThrow("mimeType is required");
    });

    it("should reject empty strings", () => {
      expect(() => validateMimeType("")).toThrow(AttachmentValidationError);
    });

    it("should reject invalid MIME type format", () => {
      expect(() => validateMimeType("invalid")).toThrow(AttachmentValidationError);
      expect(() => validateMimeType("invalid")).toThrow("valid MIME type");
      expect(() => validateMimeType("png")).toThrow(AttachmentValidationError);
    });

    it("should reject non-string types", () => {
      expect(() => validateMimeType(123 as unknown)).toThrow(AttachmentValidationError);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // validateFilename
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("validateFilename", () => {
    it("should accept valid filenames", () => {
      expect(() => validateFilename("photo.png")).not.toThrow();
      expect(() => validateFilename("document.pdf")).not.toThrow();
      expect(() => validateFilename("my file (1).jpg")).not.toThrow();
      expect(() => validateFilename("file_with_underscores.txt")).not.toThrow();
    });

    it("should reject null values", () => {
      expect(() => validateFilename(null)).toThrow(AttachmentValidationError);
      expect(() => validateFilename(null)).toThrow("filename is required");
    });

    it("should reject empty strings", () => {
      expect(() => validateFilename("")).toThrow(AttachmentValidationError);
      expect(() => validateFilename("")).toThrow("cannot be empty");
    });

    it("should accept filenames at max length (255 chars)", () => {
      const maxFilename = "a".repeat(251) + ".txt";
      expect(() => validateFilename(maxFilename)).not.toThrow();
    });

    it("should reject filenames exceeding max length", () => {
      const longFilename = "a".repeat(256);
      expect(() => validateFilename(longFilename)).toThrow(AttachmentValidationError);
      expect(() => validateFilename(longFilename)).toThrow("exceeds maximum length");
    });

    it("should reject non-string types", () => {
      expect(() => validateFilename(123 as unknown)).toThrow(AttachmentValidationError);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // validateFileSize
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("validateFileSize", () => {
    it("should accept valid file sizes", () => {
      expect(() => validateFileSize(1)).not.toThrow();
      expect(() => validateFileSize(1024)).not.toThrow();
      expect(() => validateFileSize(1048576)).not.toThrow();
    });

    it("should reject null values", () => {
      expect(() => validateFileSize(null)).toThrow(AttachmentValidationError);
      expect(() => validateFileSize(null)).toThrow("size is required");
    });

    it("should reject non-number types", () => {
      expect(() => validateFileSize("1024" as unknown)).toThrow(AttachmentValidationError);
      expect(() => validateFileSize("1024" as unknown)).toThrow("must be a number");
    });

    it("should reject zero", () => {
      expect(() => validateFileSize(0)).toThrow(AttachmentValidationError);
      expect(() => validateFileSize(0)).toThrow("must be a positive number");
    });

    it("should reject negative numbers", () => {
      expect(() => validateFileSize(-1)).toThrow(AttachmentValidationError);
      expect(() => validateFileSize(-1)).toThrow("must be a positive number");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // validateAttachmentType
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("validateAttachmentType", () => {
    it("should accept valid attachment types", () => {
      expect(() => validateAttachmentType("image")).not.toThrow();
      expect(() => validateAttachmentType("audio")).not.toThrow();
      expect(() => validateAttachmentType("video")).not.toThrow();
      expect(() => validateAttachmentType("file")).not.toThrow();
      expect(() => validateAttachmentType("pdf")).not.toThrow();
    });

    it("should reject null values", () => {
      expect(() => validateAttachmentType(null)).toThrow(AttachmentValidationError);
      expect(() => validateAttachmentType(null)).toThrow("type is required");
    });

    it("should reject invalid type values", () => {
      expect(() => validateAttachmentType("document" as unknown)).toThrow(
        AttachmentValidationError
      );
      expect(() => validateAttachmentType("document" as unknown)).toThrow("must be one of");
      expect(() => validateAttachmentType("IMAGE" as unknown)).toThrow(AttachmentValidationError);
    });

    it("should reject non-string types", () => {
      expect(() => validateAttachmentType(123 as unknown)).toThrow(AttachmentValidationError);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // validateDimensions
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("validateDimensions", () => {
    it("should accept valid dimensions", () => {
      expect(() => validateDimensions({ width: 100, height: 100 })).not.toThrow();
      expect(() => validateDimensions({ width: 1920, height: 1080 })).not.toThrow();
      expect(() => validateDimensions({ width: 1, height: 1 })).not.toThrow();
    });

    it("should accept undefined (optional)", () => {
      expect(() => validateDimensions(undefined)).not.toThrow();
    });

    it("should reject missing width", () => {
      expect(() => validateDimensions({ height: 100 } as unknown)).toThrow(
        AttachmentValidationError
      );
      expect(() => validateDimensions({ height: 100 } as unknown)).toThrow("width");
    });

    it("should reject missing height", () => {
      expect(() => validateDimensions({ width: 100 } as unknown)).toThrow(
        AttachmentValidationError
      );
      expect(() => validateDimensions({ width: 100 } as unknown)).toThrow("height");
    });

    it("should reject non-positive dimensions", () => {
      expect(() => validateDimensions({ width: 0, height: 100 })).toThrow(
        AttachmentValidationError
      );
      expect(() => validateDimensions({ width: -1, height: 100 })).toThrow(
        AttachmentValidationError
      );
      expect(() => validateDimensions({ width: 100, height: 0 })).toThrow(
        AttachmentValidationError
      );
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // validateDuration
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("validateDuration", () => {
    it("should accept valid durations", () => {
      expect(() => validateDuration(1)).not.toThrow();
      expect(() => validateDuration(60.5)).not.toThrow();
      expect(() => validateDuration(3600)).not.toThrow();
    });

    it("should accept undefined (optional)", () => {
      expect(() => validateDuration(undefined)).not.toThrow();
    });

    it("should reject non-number types", () => {
      expect(() => validateDuration("60" as unknown)).toThrow(AttachmentValidationError);
      expect(() => validateDuration("60" as unknown)).toThrow("must be a number");
    });

    it("should reject zero", () => {
      expect(() => validateDuration(0)).toThrow(AttachmentValidationError);
      expect(() => validateDuration(0)).toThrow("must be a positive number");
    });

    it("should reject negative numbers", () => {
      expect(() => validateDuration(-1)).toThrow(AttachmentValidationError);
      expect(() => validateDuration(-1)).toThrow("must be a positive number");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // validateLimit
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("validateLimit", () => {
    it("should accept valid limits", () => {
      expect(() => validateLimit(1)).not.toThrow();
      expect(() => validateLimit(50)).not.toThrow();
      expect(() => validateLimit(1000)).not.toThrow();
    });

    it("should accept undefined (optional)", () => {
      expect(() => validateLimit(undefined)).not.toThrow();
    });

    it("should reject non-integer types", () => {
      expect(() => validateLimit("50" as unknown)).toThrow(AttachmentValidationError);
      expect(() => validateLimit("50" as unknown)).toThrow("must be a number");
    });

    it("should reject zero", () => {
      expect(() => validateLimit(0)).toThrow(AttachmentValidationError);
      expect(() => validateLimit(0)).toThrow("must be at least 1");
    });

    it("should reject negative numbers", () => {
      expect(() => validateLimit(-1)).toThrow(AttachmentValidationError);
    });

    it("should reject values exceeding max limit", () => {
      expect(() => validateLimit(1001)).toThrow(AttachmentValidationError);
      expect(() => validateLimit(1001)).toThrow("exceeds maximum");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // validateSortBy
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("validateSortBy", () => {
    it("should accept valid sort fields", () => {
      expect(() => validateSortBy("createdAt")).not.toThrow();
      expect(() => validateSortBy("updatedAt")).not.toThrow();
    });

    it("should accept undefined (optional)", () => {
      expect(() => validateSortBy(undefined)).not.toThrow();
    });

    it("should reject invalid sort fields", () => {
      expect(() => validateSortBy("filename" as unknown)).toThrow(AttachmentValidationError);
      expect(() => validateSortBy("filename" as unknown)).toThrow("must be one of");
    });

    it("should reject non-string types", () => {
      expect(() => validateSortBy(123 as unknown)).toThrow(AttachmentValidationError);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // validateSortOrder
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("validateSortOrder", () => {
    it("should accept valid sort orders", () => {
      expect(() => validateSortOrder("asc")).not.toThrow();
      expect(() => validateSortOrder("desc")).not.toThrow();
    });

    it("should accept undefined (optional)", () => {
      expect(() => validateSortOrder(undefined)).not.toThrow();
    });

    it("should reject invalid sort orders", () => {
      expect(() => validateSortOrder("ascending" as unknown)).toThrow(AttachmentValidationError);
      expect(() => validateSortOrder("ascending" as unknown)).toThrow("must be one of");
    });

    it("should reject non-string types", () => {
      expect(() => validateSortOrder(123 as unknown)).toThrow(AttachmentValidationError);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // validateAttachParams
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("validateAttachParams", () => {
    const validParams = {
      storageId: "kg2abc123",
      memorySpaceId: "space-123",
      userId: "user-123",
      type: "image" as const,
      mimeType: "image/png",
      filename: "photo.png",
      size: 1024,
    };

    it("should accept valid params", () => {
      expect(() => validateAttachParams(validParams)).not.toThrow();
    });

    it("should accept params with optional fields", () => {
      expect(() =>
        validateAttachParams({
          ...validParams,
          conversationId: "conv-123",
          messageId: "msg-123",
          dimensions: { width: 100, height: 100 },
          duration: 60,
          metadata: { custom: "value" },
        })
      ).not.toThrow();
    });

    it("should reject null params", () => {
      expect(() => validateAttachParams(null as unknown)).toThrow(AttachmentValidationError);
      expect(() => validateAttachParams(null as unknown)).toThrow("params is required");
    });

    it("should reject missing required fields", () => {
      const { storageId: _storageId, ...withoutStorageId } = validParams;
      expect(() => validateAttachParams(withoutStorageId as unknown)).toThrow(
        AttachmentValidationError
      );

      const { memorySpaceId: _memorySpaceId, ...withoutMemorySpaceId } = validParams;
      expect(() => validateAttachParams(withoutMemorySpaceId as unknown)).toThrow(
        AttachmentValidationError
      );

      const { userId: _userId, ...withoutUserId } = validParams;
      expect(() => validateAttachParams(withoutUserId as unknown)).toThrow(
        AttachmentValidationError
      );
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // validateListAttachmentsFilter
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("validateListAttachmentsFilter", () => {
    const validFilter = {
      memorySpaceId: "space-123",
    };

    it("should accept valid filter", () => {
      expect(() => validateListAttachmentsFilter(validFilter)).not.toThrow();
    });

    it("should accept filter with optional fields", () => {
      expect(() =>
        validateListAttachmentsFilter({
          ...validFilter,
          conversationId: "conv-123",
          type: "image" as const,
          limit: 50,
          sortBy: "createdAt" as const,
          sortOrder: "desc" as const,
        })
      ).not.toThrow();
    });

    it("should reject null filter", () => {
      expect(() => validateListAttachmentsFilter(null as unknown)).toThrow(
        AttachmentValidationError
      );
      expect(() => validateListAttachmentsFilter(null as unknown)).toThrow("filter is required");
    });

    it("should reject missing memorySpaceId", () => {
      expect(() => validateListAttachmentsFilter({} as unknown)).toThrow(
        AttachmentValidationError
      );
      expect(() => validateListAttachmentsFilter({} as unknown)).toThrow("memorySpaceId");
    });

    it("should reject invalid optional fields", () => {
      expect(() =>
        validateListAttachmentsFilter({
          ...validFilter,
          limit: 0,
        })
      ).toThrow(AttachmentValidationError);

      expect(() =>
        validateListAttachmentsFilter({
          ...validFilter,
          sortBy: "invalid" as unknown,
        })
      ).toThrow(AttachmentValidationError);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // validateAttachmentIds
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("validateAttachmentIds", () => {
    it("should accept valid attachment ID arrays", () => {
      expect(() => validateAttachmentIds(["attach-1", "attach-2"])).not.toThrow();
      expect(() => validateAttachmentIds(["attach-1"])).not.toThrow();
    });

    it("should reject null values", () => {
      expect(() => validateAttachmentIds(null)).toThrow(AttachmentValidationError);
      expect(() => validateAttachmentIds(null)).toThrow("attachmentIds is required");
    });

    it("should reject non-array values", () => {
      expect(() => validateAttachmentIds("attach-1" as unknown)).toThrow(
        AttachmentValidationError
      );
      expect(() => validateAttachmentIds("attach-1" as unknown)).toThrow("must be an array");
    });

    it("should reject arrays with invalid IDs", () => {
      expect(() => validateAttachmentIds(["attach-1", null as unknown])).toThrow(
        AttachmentValidationError
      );
      expect(() => validateAttachmentIds(["attach-1", ""])).toThrow(AttachmentValidationError);
    });
  });
});
