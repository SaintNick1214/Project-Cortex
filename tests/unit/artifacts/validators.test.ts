/**
 * Unit Tests: Artifact Validators
 *
 * Tests for artifact validation functions.
 * No Convex dependency - pure unit tests.
 */

import {
  validateArtifactId,
  validateArtifactIdFormat,
  validateTitle,
  validateTitleLength,
  validateContent,
  validateContentSize,
  validateKind,
  validateStreamingState,
  validateTags,
  validateLimit,
  validateOffset,
  validateVersion,
  validateSessionId,
  validateTimestamp,
  validateSortBy,
  validateSortOrder,
  validateCreateOptions,
  validateUpdateOptions,
  validateListFilter,
  validateCountFilter,
  ArtifactValidationError,
} from "../../../src/artifacts/validators";

describe("Artifact Validators", () => {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // validateArtifactId
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("validateArtifactId", () => {
    it("should accept valid artifact IDs", () => {
      expect(() => validateArtifactId("art-abc123")).not.toThrow();
      expect(() => validateArtifactId("art:abc.123")).not.toThrow();
      expect(() => validateArtifactId("artifact_v1")).not.toThrow();
      expect(() => validateArtifactId("a")).not.toThrow();
    });

    it("should reject null values", () => {
      expect(() => validateArtifactId(null)).toThrow(ArtifactValidationError);
      expect(() => validateArtifactId(null)).toThrow("is required");
    });

    it("should reject undefined values", () => {
      expect(() => validateArtifactId(undefined)).toThrow(ArtifactValidationError);
      expect(() => validateArtifactId(undefined)).toThrow("is required");
    });

    it("should reject empty strings", () => {
      expect(() => validateArtifactId("")).toThrow(ArtifactValidationError);
      expect(() => validateArtifactId("")).toThrow("cannot be empty");
    });

    it("should reject whitespace-only strings", () => {
      expect(() => validateArtifactId("   ")).toThrow(ArtifactValidationError);
      expect(() => validateArtifactId("   ")).toThrow("cannot be empty");
    });

    it("should reject non-string types", () => {
      expect(() => validateArtifactId(123 as unknown)).toThrow(ArtifactValidationError);
      expect(() => validateArtifactId(123 as unknown)).toThrow("must be a string");
      expect(() => validateArtifactId({} as unknown)).toThrow(ArtifactValidationError);
      expect(() => validateArtifactId([] as unknown)).toThrow(ArtifactValidationError);
    });

    it("should use custom field name in error message", () => {
      expect(() => validateArtifactId(null, "myField")).toThrow("myField is required");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // validateArtifactIdFormat
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("validateArtifactIdFormat", () => {
    it("should accept valid formats", () => {
      expect(() => validateArtifactIdFormat("art-abc123")).not.toThrow();
      expect(() => validateArtifactIdFormat("art:abc.123")).not.toThrow();
      expect(() => validateArtifactIdFormat("artifact_v1")).not.toThrow();
      expect(() => validateArtifactIdFormat("-artifact")).not.toThrow();
      expect(() => validateArtifactIdFormat("ABC123")).not.toThrow();
    });

    it("should accept IDs at max length (100 chars)", () => {
      const maxId = "a".repeat(100);
      expect(() => validateArtifactIdFormat(maxId)).not.toThrow();
    });

    it("should reject IDs exceeding max length", () => {
      const longId = "a".repeat(101);
      expect(() => validateArtifactIdFormat(longId)).toThrow(ArtifactValidationError);
      expect(() => validateArtifactIdFormat(longId)).toThrow("exceeds maximum length");
    });

    it("should reject IDs with invalid characters", () => {
      expect(() => validateArtifactIdFormat("art@#$%")).toThrow(ArtifactValidationError);
      expect(() => validateArtifactIdFormat("art@#$%")).toThrow("Invalid artifactId format");
    });

    it("should reject Unicode characters", () => {
      expect(() => validateArtifactIdFormat("art-über")).toThrow(ArtifactValidationError);
      expect(() => validateArtifactIdFormat("日本語")).toThrow(ArtifactValidationError);
    });

    it("should reject IDs with spaces", () => {
      expect(() => validateArtifactIdFormat("art abc")).toThrow(ArtifactValidationError);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // validateTitle
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("validateTitle", () => {
    it("should accept valid titles", () => {
      expect(() => validateTitle("My Document")).not.toThrow();
      expect(() => validateTitle("Über Doc 日本語")).not.toThrow();
      expect(() => validateTitle("12345")).not.toThrow();
      expect(() => validateTitle("a")).not.toThrow();
    });

    it("should reject null values", () => {
      expect(() => validateTitle(null)).toThrow(ArtifactValidationError);
      expect(() => validateTitle(null)).toThrow("title is required");
    });

    it("should reject undefined values", () => {
      expect(() => validateTitle(undefined)).toThrow(ArtifactValidationError);
    });

    it("should reject empty strings", () => {
      expect(() => validateTitle("")).toThrow(ArtifactValidationError);
      expect(() => validateTitle("")).toThrow("cannot be empty");
    });

    it("should reject whitespace-only strings", () => {
      expect(() => validateTitle("   ")).toThrow(ArtifactValidationError);
    });

    it("should reject non-string types", () => {
      expect(() => validateTitle(123 as unknown)).toThrow(ArtifactValidationError);
      expect(() => validateTitle(123 as unknown)).toThrow("must be a string");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // validateTitleLength
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("validateTitleLength", () => {
    it("should accept titles at max length (500 chars)", () => {
      const maxTitle = "a".repeat(500);
      expect(() => validateTitleLength(maxTitle)).not.toThrow();
    });

    it("should reject titles exceeding max length", () => {
      const longTitle = "a".repeat(501);
      expect(() => validateTitleLength(longTitle)).toThrow(ArtifactValidationError);
      expect(() => validateTitleLength(longTitle)).toThrow("exceeds maximum length");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // validateContent
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("validateContent", () => {
    it("should accept valid content", () => {
      expect(() => validateContent("Hello world")).not.toThrow();
      expect(() => validateContent("")).not.toThrow(); // Empty is allowed
    });

    it("should reject undefined values", () => {
      expect(() => validateContent(undefined)).toThrow(ArtifactValidationError);
      expect(() => validateContent(undefined)).toThrow("content is required");
    });

    it("should reject non-string types", () => {
      expect(() => validateContent({ foo: "bar" } as unknown)).toThrow(ArtifactValidationError);
      expect(() => validateContent({ foo: "bar" } as unknown)).toThrow("must be a string");
      expect(() => validateContent(123 as unknown)).toThrow(ArtifactValidationError);
    });

    it("should accept null (different from undefined for content)", () => {
      // Note: null is treated as missing, so this should throw
      expect(() => validateContent(null as unknown)).toThrow(ArtifactValidationError);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // validateContentSize
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("validateContentSize", () => {
    it("should accept content within size limits", () => {
      expect(() => validateContentSize("Hello")).not.toThrow();
      expect(() => validateContentSize("")).not.toThrow();
    });

    it("should reject content exceeding 10MB", () => {
      // Create a string that exceeds 10MB
      const largeContent = "a".repeat(10 * 1024 * 1024 + 1);
      expect(() => validateContentSize(largeContent)).toThrow(ArtifactValidationError);
      expect(() => validateContentSize(largeContent)).toThrow("exceeds maximum size");
    });

    it("should handle multi-byte UTF-8 correctly", () => {
      // Each Japanese char is 3 bytes in UTF-8
      // This creates ~3MB of data
      const japaneseContent = "日".repeat(1000000);
      expect(() => validateContentSize(japaneseContent)).not.toThrow();
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // validateKind
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("validateKind", () => {
    it("should accept all valid kinds", () => {
      const validKinds = ["text", "code", "sheet", "image", "diagram", "html", "custom"];
      validKinds.forEach(kind => {
        expect(() => validateKind(kind)).not.toThrow();
      });
    });

    it("should accept null (optional field defaults)", () => {
      expect(() => validateKind(null)).not.toThrow();
    });

    it("should accept undefined (optional field)", () => {
      expect(() => validateKind(undefined)).not.toThrow();
    });

    it("should reject invalid kind values", () => {
      expect(() => validateKind("pdf")).toThrow(ArtifactValidationError);
      expect(() => validateKind("pdf")).toThrow("must be one of:");
    });

    it("should be case sensitive", () => {
      expect(() => validateKind("TEXT")).toThrow(ArtifactValidationError);
      expect(() => validateKind("Code")).toThrow(ArtifactValidationError);
    });

    it("should reject empty string", () => {
      expect(() => validateKind("")).toThrow(ArtifactValidationError);
    });

    it("should reject non-string types", () => {
      expect(() => validateKind(123 as unknown)).toThrow(ArtifactValidationError);
      expect(() => validateKind(123 as unknown)).toThrow("must be a string");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // validateStreamingState
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("validateStreamingState", () => {
    it("should accept all valid streaming states", () => {
      const validStates = ["draft", "streaming", "paused", "final", "error"];
      validStates.forEach(state => {
        expect(() => validateStreamingState(state)).not.toThrow();
      });
    });

    it("should accept null (optional field)", () => {
      expect(() => validateStreamingState(null)).not.toThrow();
    });

    it("should accept undefined (optional field)", () => {
      expect(() => validateStreamingState(undefined)).not.toThrow();
    });

    it("should reject invalid state values", () => {
      expect(() => validateStreamingState("pending")).toThrow(ArtifactValidationError);
      expect(() => validateStreamingState("pending")).toThrow("must be one of:");
    });

    it("should reject non-string types", () => {
      expect(() => validateStreamingState(1 as unknown)).toThrow(ArtifactValidationError);
      expect(() => validateStreamingState(1 as unknown)).toThrow("must be a string");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // validateTags
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("validateTags", () => {
    it("should accept valid tags array", () => {
      expect(() => validateTags(["tag1", "tag2"])).not.toThrow();
      expect(() => validateTags(["tag-with-hyphen", "tag_with_underscore"])).not.toThrow();
      expect(() => validateTags(["tag.with.dots", "tag:with:colons"])).not.toThrow();
    });

    it("should accept empty array", () => {
      expect(() => validateTags([])).not.toThrow();
    });

    it("should accept null (optional)", () => {
      expect(() => validateTags(null)).not.toThrow();
    });

    it("should accept undefined (optional)", () => {
      expect(() => validateTags(undefined)).not.toThrow();
    });

    it("should accept max 50 tags", () => {
      const fiftyTags = Array.from({ length: 50 }, (_, i) => `tag${i}`);
      expect(() => validateTags(fiftyTags)).not.toThrow();
    });

    it("should reject more than 50 tags", () => {
      const fiftyOneTags = Array.from({ length: 51 }, (_, i) => `tag${i}`);
      expect(() => validateTags(fiftyOneTags)).toThrow(ArtifactValidationError);
      expect(() => validateTags(fiftyOneTags)).toThrow("exceeds maximum");
    });

    it("should accept tags at max length (100 chars)", () => {
      const maxTag = "a".repeat(100);
      expect(() => validateTags([maxTag])).not.toThrow();
    });

    it("should reject tags exceeding max length", () => {
      const longTag = "a".repeat(101);
      expect(() => validateTags([longTag])).toThrow(ArtifactValidationError);
      expect(() => validateTags([longTag])).toThrow("exceeds maximum length");
    });

    it("should reject non-array types", () => {
      expect(() => validateTags("tag" as unknown)).toThrow(ArtifactValidationError);
      expect(() => validateTags("tag" as unknown)).toThrow("must be an array");
    });

    it("should reject non-string elements", () => {
      expect(() => validateTags(["tag", 123 as unknown])).toThrow(ArtifactValidationError);
      expect(() => validateTags(["tag", 123 as unknown])).toThrow("must be a string");
    });

    it("should reject tags with invalid characters", () => {
      expect(() => validateTags(["tag@#$"])).toThrow(ArtifactValidationError);
      expect(() => validateTags(["tag@#$"])).toThrow("invalid characters");
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

    it("should accept null (optional)", () => {
      expect(() => validateLimit(null)).not.toThrow();
    });

    it("should accept undefined (optional)", () => {
      expect(() => validateLimit(undefined)).not.toThrow();
    });

    it("should reject limit < 1", () => {
      expect(() => validateLimit(0)).toThrow(ArtifactValidationError);
      expect(() => validateLimit(-1)).toThrow(ArtifactValidationError);
    });

    it("should reject limit > 1000", () => {
      expect(() => validateLimit(1001)).toThrow(ArtifactValidationError);
      expect(() => validateLimit(1001)).toThrow("exceeds maximum");
    });

    it("should reject non-integer values", () => {
      expect(() => validateLimit(50.5)).toThrow(ArtifactValidationError);
      expect(() => validateLimit(50.5)).toThrow("must be an integer");
    });

    it("should reject non-number types", () => {
      expect(() => validateLimit("50" as unknown)).toThrow(ArtifactValidationError);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // validateOffset
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("validateOffset", () => {
    it("should accept valid offsets", () => {
      expect(() => validateOffset(0)).not.toThrow();
      expect(() => validateOffset(100)).not.toThrow();
    });

    it("should accept null (optional)", () => {
      expect(() => validateOffset(null)).not.toThrow();
    });

    it("should accept undefined (optional)", () => {
      expect(() => validateOffset(undefined)).not.toThrow();
    });

    it("should reject negative offsets", () => {
      expect(() => validateOffset(-1)).toThrow(ArtifactValidationError);
      expect(() => validateOffset(-1)).toThrow("must be non-negative");
    });

    it("should reject non-integer values", () => {
      expect(() => validateOffset(10.5)).toThrow(ArtifactValidationError);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // validateVersion
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("validateVersion", () => {
    it("should accept valid versions", () => {
      expect(() => validateVersion(1)).not.toThrow();
      expect(() => validateVersion(100)).not.toThrow();
    });

    it("should reject null (required field)", () => {
      expect(() => validateVersion(null)).toThrow(ArtifactValidationError);
      expect(() => validateVersion(null)).toThrow("is required");
    });

    it("should reject undefined (required field)", () => {
      expect(() => validateVersion(undefined)).toThrow(ArtifactValidationError);
    });

    it("should reject version < 1", () => {
      expect(() => validateVersion(0)).toThrow(ArtifactValidationError);
      expect(() => validateVersion(-1)).toThrow(ArtifactValidationError);
    });

    it("should reject non-integer values", () => {
      expect(() => validateVersion(1.5)).toThrow(ArtifactValidationError);
    });

    it("should reject non-number types", () => {
      expect(() => validateVersion("1" as unknown)).toThrow(ArtifactValidationError);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // validateSessionId
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("validateSessionId", () => {
    it("should accept valid session IDs", () => {
      expect(() => validateSessionId("stream-abc123-xyz789")).not.toThrow();
      expect(() => validateSessionId("sess_123")).not.toThrow();
    });

    it("should reject null", () => {
      expect(() => validateSessionId(null)).toThrow(ArtifactValidationError);
      expect(() => validateSessionId(null)).toThrow("is required");
    });

    it("should reject undefined", () => {
      expect(() => validateSessionId(undefined)).toThrow(ArtifactValidationError);
    });

    it("should reject empty strings", () => {
      expect(() => validateSessionId("")).toThrow(ArtifactValidationError);
      expect(() => validateSessionId("")).toThrow("cannot be empty");
    });

    it("should reject whitespace-only strings", () => {
      expect(() => validateSessionId("   ")).toThrow(ArtifactValidationError);
    });

    it("should reject non-string types", () => {
      expect(() => validateSessionId(123 as unknown)).toThrow(ArtifactValidationError);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // validateTimestamp
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("validateTimestamp", () => {
    it("should accept valid timestamps", () => {
      expect(() => validateTimestamp(Date.now(), "createdAt")).not.toThrow();
      expect(() => validateTimestamp(1234567890000, "updatedAt")).not.toThrow();
    });

    it("should accept null (optional)", () => {
      expect(() => validateTimestamp(null, "createdAt")).not.toThrow();
    });

    it("should accept undefined (optional)", () => {
      expect(() => validateTimestamp(undefined, "createdAt")).not.toThrow();
    });

    it("should reject negative timestamps", () => {
      expect(() => validateTimestamp(-1, "createdAt")).toThrow(ArtifactValidationError);
    });

    it("should reject non-number types", () => {
      expect(() => validateTimestamp("123" as unknown, "createdAt")).toThrow(ArtifactValidationError);
    });

    it("should include field name in error", () => {
      expect(() => validateTimestamp(-1, "myField")).toThrow("myField");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // validateSortBy
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("validateSortBy", () => {
    it("should accept valid sort fields", () => {
      expect(() => validateSortBy("createdAt")).not.toThrow();
      expect(() => validateSortBy("updatedAt")).not.toThrow();
      expect(() => validateSortBy("title")).not.toThrow();
      expect(() => validateSortBy("accessCount")).not.toThrow();
    });

    it("should accept null (optional)", () => {
      expect(() => validateSortBy(null)).not.toThrow();
    });

    it("should reject invalid sort fields", () => {
      expect(() => validateSortBy("invalid")).toThrow(ArtifactValidationError);
      expect(() => validateSortBy("invalid")).toThrow("must be one of:");
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

    it("should accept null (optional)", () => {
      expect(() => validateSortOrder(null)).not.toThrow();
    });

    it("should reject invalid sort orders", () => {
      expect(() => validateSortOrder("ascending")).toThrow(ArtifactValidationError);
      expect(() => validateSortOrder("ASC")).toThrow(ArtifactValidationError);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // validateCreateOptions
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("validateCreateOptions", () => {
    it("should accept valid create options", () => {
      const validOptions = {
        memorySpaceId: "space-123",
        title: "Test Artifact",
        content: "Test content",
        kind: "text",
      };
      expect(() => validateCreateOptions(validOptions)).not.toThrow();
    });

    it("should accept options with all fields", () => {
      const fullOptions = {
        memorySpaceId: "space-123",
        title: "Test Artifact",
        content: "Test content",
        kind: "code",
        streamingState: "draft",
        tags: ["tag1", "tag2"],
        artifactId: "custom-id",
      };
      expect(() => validateCreateOptions(fullOptions)).not.toThrow();
    });

    it("should reject null options", () => {
      expect(() => validateCreateOptions(null)).toThrow(ArtifactValidationError);
      expect(() => validateCreateOptions(null)).toThrow("options is required");
    });

    it("should reject missing memorySpaceId", () => {
      const invalidOptions = {
        title: "Test",
        content: "Content",
      };
      expect(() => validateCreateOptions(invalidOptions)).toThrow(ArtifactValidationError);
    });

    it("should reject missing title", () => {
      const invalidOptions = {
        memorySpaceId: "space-123",
        content: "Content",
      };
      expect(() => validateCreateOptions(invalidOptions)).toThrow(ArtifactValidationError);
    });

    it("should reject missing content", () => {
      const invalidOptions = {
        memorySpaceId: "space-123",
        title: "Test",
      };
      expect(() => validateCreateOptions(invalidOptions)).toThrow(ArtifactValidationError);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // validateUpdateOptions
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("validateUpdateOptions", () => {
    it("should accept null (optional)", () => {
      expect(() => validateUpdateOptions(null)).not.toThrow();
    });

    it("should accept undefined (optional)", () => {
      expect(() => validateUpdateOptions(undefined)).not.toThrow();
    });

    it("should accept valid update options", () => {
      const validOptions = {
        title: "Updated Title",
        tags: ["new-tag"],
      };
      expect(() => validateUpdateOptions(validOptions)).not.toThrow();
    });

    it("should reject invalid title in options", () => {
      const invalidOptions = {
        title: 123,
      };
      expect(() => validateUpdateOptions(invalidOptions)).toThrow(ArtifactValidationError);
    });

    it("should reject invalid tags in options", () => {
      const invalidOptions = {
        tags: "not-an-array",
      };
      expect(() => validateUpdateOptions(invalidOptions)).toThrow(ArtifactValidationError);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // validateListFilter
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("validateListFilter", () => {
    it("should accept valid filter with required memorySpaceId", () => {
      const validFilter = {
        memorySpaceId: "space-123",
      };
      expect(() => validateListFilter(validFilter)).not.toThrow();
    });

    it("should accept filter with all options", () => {
      const fullFilter = {
        memorySpaceId: "space-123",
        kind: "code",
        streamingState: "final",
        tags: ["important"],
        limit: 20,
        offset: 0,
        sortBy: "createdAt",
        sortOrder: "desc",
      };
      expect(() => validateListFilter(fullFilter)).not.toThrow();
    });

    it("should reject null filter", () => {
      expect(() => validateListFilter(null)).toThrow(ArtifactValidationError);
      expect(() => validateListFilter(null)).toThrow("filter is required");
    });

    it("should reject missing memorySpaceId", () => {
      const invalidFilter = {
        kind: "text",
      };
      expect(() => validateListFilter(invalidFilter)).toThrow(ArtifactValidationError);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // validateCountFilter
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("validateCountFilter", () => {
    it("should accept valid count filter", () => {
      const validFilter = {
        memorySpaceId: "space-123",
      };
      expect(() => validateCountFilter(validFilter)).not.toThrow();
    });

    it("should accept count filter with optional fields", () => {
      const fullFilter = {
        memorySpaceId: "space-123",
        kind: "code",
        streamingState: "final",
        tags: ["important"],
      };
      expect(() => validateCountFilter(fullFilter)).not.toThrow();
    });

    it("should reject null filter", () => {
      expect(() => validateCountFilter(null)).toThrow(ArtifactValidationError);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ArtifactValidationError
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("ArtifactValidationError", () => {
    it("should be instanceof Error", () => {
      const error = new ArtifactValidationError("test error", "TEST_CODE");
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ArtifactValidationError);
    });

    it("should have correct name", () => {
      const error = new ArtifactValidationError("test", "TEST_CODE");
      expect(error.name).toBe("ArtifactValidationError");
    });

    it("should include code property", () => {
      const error = new ArtifactValidationError("test message", "TEST_CODE");
      expect(error.code).toBe("TEST_CODE");
    });

    it("should include field property when provided", () => {
      const error = new ArtifactValidationError(
        "invalid value",
        "INVALID_VALUE",
        "artifactId",
      );
      expect(error.field).toBe("artifactId");
      expect(error.message).toContain("invalid value");
    });

    it("should not require field property", () => {
      const error = new ArtifactValidationError("test message", "TEST_CODE");
      expect(error.field).toBeUndefined();
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Edge Cases
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Edge Cases", () => {
    it("should handle artifact IDs with all allowed special characters", () => {
      expect(() => validateArtifactIdFormat("a-b_c.d:e")).not.toThrow();
    });

    it("should handle boundary values for tags array", () => {
      // Exactly 50 tags with exactly 100 char each
      const boundaryTags = Array.from({ length: 50 }, () => "a".repeat(100));
      expect(() => validateTags(boundaryTags)).not.toThrow();
    });

    it("should handle content with various encodings", () => {
      const mixedContent = "Hello 世界 🌍 مرحبا";
      expect(() => validateContent(mixedContent)).not.toThrow();
    });

    it("should handle very long but valid titles", () => {
      const longTitle = "a".repeat(500);
      expect(() => validateTitle(longTitle)).not.toThrow();
      expect(() => validateTitleLength(longTitle)).not.toThrow();
    });
  });
});
