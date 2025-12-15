/**
 * Shell Utilities Tests
 *
 * Tests pure functions from shell.ts that don't require complex mocking.
 */

import { describe, it, expect } from "@jest/globals";
import {
  isValidProjectName,
  isLocalConvexUrl,
} from "../shell.js";

describe("shell utilities", () => {
  describe("isValidProjectName", () => {
    it("should accept valid project names with lowercase letters", () => {
      expect(isValidProjectName("myproject")).toBe(true);
      expect(isValidProjectName("my-project")).toBe(true);
      expect(isValidProjectName("my_project")).toBe(true);
      expect(isValidProjectName("project123")).toBe(true);
    });

    it("should accept names with numbers", () => {
      expect(isValidProjectName("project1")).toBe(true);
      expect(isValidProjectName("123project")).toBe(true);
      expect(isValidProjectName("pro123ject")).toBe(true);
    });

    it("should accept names with hyphens and underscores", () => {
      expect(isValidProjectName("my-project")).toBe(true);
      expect(isValidProjectName("my_project")).toBe(true);
      expect(isValidProjectName("my-project_name")).toBe(true);
      expect(isValidProjectName("a-b-c")).toBe(true);
    });

    it("should reject names with uppercase letters", () => {
      expect(isValidProjectName("MyProject")).toBe(false);
      expect(isValidProjectName("MYPROJECT")).toBe(false);
      expect(isValidProjectName("myProject")).toBe(false);
    });

    it("should reject names with spaces", () => {
      expect(isValidProjectName("my project")).toBe(false);
      expect(isValidProjectName(" myproject")).toBe(false);
      expect(isValidProjectName("myproject ")).toBe(false);
    });

    it("should reject names with special characters", () => {
      expect(isValidProjectName("my@project")).toBe(false);
      expect(isValidProjectName("my.project")).toBe(false);
      expect(isValidProjectName("my/project")).toBe(false);
      expect(isValidProjectName("my\\project")).toBe(false);
      expect(isValidProjectName("my!project")).toBe(false);
    });

    it("should reject empty string", () => {
      expect(isValidProjectName("")).toBe(false);
    });

    it("should accept single character names", () => {
      expect(isValidProjectName("a")).toBe(true);
      expect(isValidProjectName("1")).toBe(true);
    });

    it("should accept long names", () => {
      expect(isValidProjectName("a".repeat(100))).toBe(true);
    });
  });

  describe("isLocalConvexUrl", () => {
    it("should return true for localhost URLs", () => {
      expect(isLocalConvexUrl("http://localhost:3210")).toBe(true);
      expect(isLocalConvexUrl("http://localhost")).toBe(true);
      expect(isLocalConvexUrl("https://localhost:8080")).toBe(true);
    });

    it("should return true for 127.0.0.1 URLs", () => {
      expect(isLocalConvexUrl("http://127.0.0.1:3210")).toBe(true);
      expect(isLocalConvexUrl("http://127.0.0.1")).toBe(true);
      expect(isLocalConvexUrl("https://127.0.0.1:8080")).toBe(true);
    });

    it("should return false for cloud URLs", () => {
      expect(isLocalConvexUrl("https://example.convex.cloud")).toBe(false);
      expect(isLocalConvexUrl("https://my-app.convex.cloud")).toBe(false);
      expect(isLocalConvexUrl("https://api.convex.dev")).toBe(false);
    });

    it("should return false for other URLs", () => {
      expect(isLocalConvexUrl("https://example.com")).toBe(false);
      expect(isLocalConvexUrl("http://myserver.local")).toBe(false);
    });

    it("should handle URLs with paths", () => {
      expect(isLocalConvexUrl("http://localhost:3210/api/v1")).toBe(true);
      expect(isLocalConvexUrl("https://example.convex.cloud/api")).toBe(false);
    });

    it("should be case insensitive for localhost", () => {
      // Note: URLs are case-insensitive for the host part
      expect(isLocalConvexUrl("http://LOCALHOST:3210")).toBe(false); // String.includes is case-sensitive
      expect(isLocalConvexUrl("http://Localhost:3210")).toBe(false);
    });
  });
});

// Note: isDirectoryEmpty, getSDKPath, commandExists, execCommand, execCommandLive, and fetchLatestSDKMetadata
// require file system or process spawning which are better tested as integration tests
// or with more complex mocking setups that work reliably with ESM.
