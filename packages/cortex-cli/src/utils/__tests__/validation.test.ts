/**
 * Validation Utilities Tests
 */

import { describe, it, expect } from "@jest/globals";
import {
  validateMemorySpaceId,
  validateUserId,
  validateMemoryId,
  validateConversationId,
  validateFactId,
  validateMemorySpaceType,
  validateMemorySpaceStatus,
  validateFactType,
  validateOutputFormat,
  validateLimit,
  validateUrl,
  validateFilePath,
  validateSearchQuery,
  parseArrayArg,
  parseKeyValueArg,
  ValidationError,
} from "../validation.js";

describe("validation utilities", () => {
  describe("validateMemorySpaceId", () => {
    it("should accept valid memory space IDs", () => {
      expect(() => validateMemorySpaceId("agent-1")).not.toThrow();
      expect(() => validateMemorySpaceId("my_space")).not.toThrow();
      expect(() => validateMemorySpaceId("Space123")).not.toThrow();
      expect(() => validateMemorySpaceId("a-b_c-123")).not.toThrow();
    });

    it("should reject empty string", () => {
      expect(() => validateMemorySpaceId("")).toThrow(ValidationError);
      expect(() => validateMemorySpaceId("   ")).toThrow(ValidationError);
    });

    it("should reject null/undefined", () => {
      expect(() => validateMemorySpaceId(null as unknown as string)).toThrow(ValidationError);
      expect(() => validateMemorySpaceId(undefined as unknown as string)).toThrow(ValidationError);
    });

    it("should reject IDs with invalid characters", () => {
      expect(() => validateMemorySpaceId("space with spaces")).toThrow(ValidationError);
      expect(() => validateMemorySpaceId("space@special")).toThrow(ValidationError);
      expect(() => validateMemorySpaceId("space/path")).toThrow(ValidationError);
    });

    it("should reject IDs that are too long", () => {
      const longId = "a".repeat(256);
      expect(() => validateMemorySpaceId(longId)).toThrow(ValidationError);
    });
  });

  describe("validateUserId", () => {
    it("should accept valid user IDs", () => {
      expect(() => validateUserId("user-123")).not.toThrow();
      expect(() => validateUserId("user@example.com")).not.toThrow();
      expect(() => validateUserId("12345")).not.toThrow();
    });

    it("should reject empty string", () => {
      expect(() => validateUserId("")).toThrow(ValidationError);
    });

    it("should reject IDs that are too long", () => {
      const longId = "u".repeat(256);
      expect(() => validateUserId(longId)).toThrow(ValidationError);
    });
  });

  describe("validateMemoryId", () => {
    it("should accept valid memory IDs", () => {
      expect(() => validateMemoryId("mem-abc123")).not.toThrow();
    });

    it("should reject empty string", () => {
      expect(() => validateMemoryId("")).toThrow(ValidationError);
    });
  });

  describe("validateConversationId", () => {
    it("should accept valid conversation IDs", () => {
      expect(() => validateConversationId("conv-123")).not.toThrow();
    });

    it("should reject empty string", () => {
      expect(() => validateConversationId("")).toThrow(ValidationError);
    });
  });

  describe("validateFactId", () => {
    it("should accept valid fact IDs", () => {
      expect(() => validateFactId("fact-xyz")).not.toThrow();
    });

    it("should reject empty string", () => {
      expect(() => validateFactId("")).toThrow(ValidationError);
    });
  });

  describe("validateMemorySpaceType", () => {
    it("should accept valid types", () => {
      expect(validateMemorySpaceType("personal")).toBe("personal");
      expect(validateMemorySpaceType("team")).toBe("team");
      expect(validateMemorySpaceType("project")).toBe("project");
      expect(validateMemorySpaceType("custom")).toBe("custom");
    });

    it("should reject invalid types", () => {
      expect(() => validateMemorySpaceType("invalid")).toThrow(ValidationError);
      expect(() => validateMemorySpaceType("")).toThrow(ValidationError);
    });
  });

  describe("validateMemorySpaceStatus", () => {
    it("should accept valid statuses", () => {
      expect(validateMemorySpaceStatus("active")).toBe("active");
      expect(validateMemorySpaceStatus("archived")).toBe("archived");
    });

    it("should reject invalid statuses", () => {
      expect(() => validateMemorySpaceStatus("deleted")).toThrow(ValidationError);
    });
  });

  describe("validateFactType", () => {
    it("should accept valid fact types", () => {
      expect(validateFactType("preference")).toBe("preference");
      expect(validateFactType("identity")).toBe("identity");
      expect(validateFactType("knowledge")).toBe("knowledge");
      expect(validateFactType("relationship")).toBe("relationship");
      expect(validateFactType("event")).toBe("event");
      expect(validateFactType("observation")).toBe("observation");
      expect(validateFactType("custom")).toBe("custom");
    });

    it("should reject invalid fact types", () => {
      expect(() => validateFactType("invalid")).toThrow(ValidationError);
    });
  });

  describe("validateOutputFormat", () => {
    it("should accept valid formats", () => {
      expect(validateOutputFormat("table")).toBe("table");
      expect(validateOutputFormat("json")).toBe("json");
      expect(validateOutputFormat("csv")).toBe("csv");
    });

    it("should reject invalid formats", () => {
      expect(() => validateOutputFormat("xml")).toThrow(ValidationError);
    });
  });

  describe("validateLimit", () => {
    it("should accept valid limits", () => {
      expect(validateLimit(1)).toBe(1);
      expect(validateLimit(50)).toBe(50);
      expect(validateLimit(1000)).toBe(1000);
    });

    it("should reject zero or negative", () => {
      expect(() => validateLimit(0)).toThrow(ValidationError);
      expect(() => validateLimit(-1)).toThrow(ValidationError);
    });

    it("should reject limits exceeding max", () => {
      expect(() => validateLimit(1001)).toThrow(ValidationError);
      expect(() => validateLimit(101, 100)).toThrow(ValidationError);
    });

    it("should respect custom max", () => {
      expect(validateLimit(50, 100)).toBe(50);
      expect(() => validateLimit(101, 100)).toThrow(ValidationError);
    });
  });

  describe("validateUrl", () => {
    it("should accept valid URLs", () => {
      expect(() => validateUrl("http://localhost:3210")).not.toThrow();
      expect(() => validateUrl("https://example.convex.cloud")).not.toThrow();
      expect(() => validateUrl("http://127.0.0.1:8080")).not.toThrow();
    });

    it("should reject invalid URLs", () => {
      expect(() => validateUrl("not-a-url")).toThrow(ValidationError);
      expect(() => validateUrl("")).toThrow(ValidationError);
    });
  });

  describe("validateFilePath", () => {
    it("should accept valid file paths", () => {
      expect(() => validateFilePath("output.json")).not.toThrow();
      expect(() => validateFilePath("./data/export.csv")).not.toThrow();
      expect(() => validateFilePath("/absolute/path/file.txt")).not.toThrow();
    });

    it("should reject empty paths", () => {
      expect(() => validateFilePath("")).toThrow(ValidationError);
      expect(() => validateFilePath("   ")).toThrow(ValidationError);
    });
  });

  describe("validateSearchQuery", () => {
    it("should accept valid queries", () => {
      expect(() => validateSearchQuery("password")).not.toThrow();
      expect(() => validateSearchQuery("user preferences")).not.toThrow();
    });

    it("should reject empty queries", () => {
      expect(() => validateSearchQuery("")).toThrow(ValidationError);
      expect(() => validateSearchQuery("   ")).toThrow(ValidationError);
    });

    it("should reject queries that are too long", () => {
      const longQuery = "q".repeat(1001);
      expect(() => validateSearchQuery(longQuery)).toThrow(ValidationError);
    });
  });

  describe("parseArrayArg", () => {
    it("should parse comma-separated values", () => {
      expect(parseArrayArg("a,b,c")).toEqual(["a", "b", "c"]);
      expect(parseArrayArg("user-1, user-2, user-3")).toEqual(["user-1", "user-2", "user-3"]);
    });

    it("should handle single value", () => {
      expect(parseArrayArg("single")).toEqual(["single"]);
    });

    it("should handle empty string", () => {
      expect(parseArrayArg("")).toEqual([]);
    });

    it("should filter out empty values", () => {
      expect(parseArrayArg("a,,b,")).toEqual(["a", "b"]);
    });
  });

  describe("parseKeyValueArg", () => {
    it("should parse key=value pairs", () => {
      expect(parseKeyValueArg("key1=value1,key2=value2")).toEqual({
        key1: "value1",
        key2: "value2",
      });
    });

    it("should handle single pair", () => {
      expect(parseKeyValueArg("name=test")).toEqual({ name: "test" });
    });

    it("should handle empty string", () => {
      expect(parseKeyValueArg("")).toEqual({});
    });

    it("should handle whitespace", () => {
      expect(parseKeyValueArg(" key = value ")).toEqual({ key: "value" });
    });
  });
});
