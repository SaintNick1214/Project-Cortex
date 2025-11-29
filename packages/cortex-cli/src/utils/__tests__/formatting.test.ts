/**
 * Formatting Utilities Tests
 */

import { describe, it, expect } from "@jest/globals";
import {
  formatJSON,
  formatCSV,
  formatTimestamp,
  formatRelativeTime,
  formatBytes,
  formatCount,
} from "../formatting.js";

describe("formatting utilities", () => {
  describe("formatJSON", () => {
    it("should format objects as pretty JSON", () => {
      const data = { key: "value", num: 42 };
      const result = formatJSON(data);
      expect(result).toBe(JSON.stringify(data, null, 2));
    });

    it("should format arrays", () => {
      const data = [1, 2, 3];
      const result = formatJSON(data);
      expect(result).toBe(JSON.stringify(data, null, 2));
    });

    it("should handle null", () => {
      expect(formatJSON(null)).toBe("null");
    });

    it("should handle strings", () => {
      expect(formatJSON("test")).toBe('"test"');
    });
  });

  describe("formatCSV", () => {
    it("should format array of objects as CSV", () => {
      const data = [
        { name: "Alice", age: 30 },
        { name: "Bob", age: 25 },
      ];
      const result = formatCSV(data);
      expect(result).toContain("name,age");
      expect(result).toContain("Alice,30");
      expect(result).toContain("Bob,25");
    });

    it("should handle custom headers", () => {
      const data = [{ name: "Test", extra: "ignored" }];
      const result = formatCSV(data, ["name"]);
      expect(result).toContain("name");
      expect(result).not.toContain("extra");
    });

    it("should escape values with commas", () => {
      const data = [{ text: "hello, world" }];
      const result = formatCSV(data);
      expect(result).toContain('"hello, world"');
    });

    it("should escape values with quotes", () => {
      const data = [{ text: 'say "hello"' }];
      const result = formatCSV(data);
      expect(result).toContain('"say ""hello"""');
    });

    it("should handle empty array", () => {
      expect(formatCSV([])).toBe("");
    });

    it("should wrap single object in array", () => {
      const data = { name: "Test" };
      const result = formatCSV(data);
      expect(result).toContain("name");
      expect(result).toContain("Test");
    });
  });

  describe("formatTimestamp", () => {
    it("should format timestamp as locale string", () => {
      const timestamp = new Date("2025-01-15T10:30:00Z").getTime();
      const result = formatTimestamp(timestamp);
      expect(result).toBeTruthy();
      expect(typeof result).toBe("string");
    });

    it("should handle current timestamp", () => {
      const result = formatTimestamp(Date.now());
      expect(result).toBeTruthy();
    });
  });

  describe("formatRelativeTime", () => {
    it('should format recent time as "just now"', () => {
      const timestamp = Date.now() - 30000; // 30 seconds ago
      const result = formatRelativeTime(timestamp);
      expect(result).toBe("just now");
    });

    it("should format minutes ago", () => {
      const timestamp = Date.now() - 5 * 60 * 1000; // 5 minutes ago
      const result = formatRelativeTime(timestamp);
      expect(result).toBe("5m ago");
    });

    it("should format hours ago", () => {
      const timestamp = Date.now() - 3 * 60 * 60 * 1000; // 3 hours ago
      const result = formatRelativeTime(timestamp);
      expect(result).toBe("3h ago");
    });

    it("should format days ago", () => {
      const timestamp = Date.now() - 2 * 24 * 60 * 60 * 1000; // 2 days ago
      const result = formatRelativeTime(timestamp);
      expect(result).toBe("2d ago");
    });
  });

  describe("formatBytes", () => {
    it("should format bytes", () => {
      expect(formatBytes(500)).toBe("500.0 B");
    });

    it("should format kilobytes", () => {
      expect(formatBytes(1024)).toBe("1.0 KB");
      expect(formatBytes(2048)).toBe("2.0 KB");
    });

    it("should format megabytes", () => {
      expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
    });

    it("should format gigabytes", () => {
      expect(formatBytes(1024 * 1024 * 1024)).toBe("1.0 GB");
    });

    it("should handle zero", () => {
      expect(formatBytes(0)).toBe("0.0 B");
    });
  });

  describe("formatCount", () => {
    it("should format singular", () => {
      expect(formatCount(1, "memory", "memories")).toBe("1 memory");
      expect(formatCount(1, "user")).toBe("1 user");
    });

    it("should format plural", () => {
      expect(formatCount(5, "memory", "memories")).toBe("5 memories");
      expect(formatCount(0, "memory", "memories")).toBe("0 memories");
    });

    it("should auto-pluralize without explicit plural", () => {
      expect(formatCount(2, "user")).toBe("2 users");
    });

    it("should format large numbers with commas", () => {
      expect(formatCount(1000, "item")).toBe("1,000 items");
      expect(formatCount(1000000, "record")).toBe("1,000,000 records");
    });
  });
});
