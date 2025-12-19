/**
 * Env File Utilities Tests
 *
 * Tests pure functions from env-file.ts that don't require file system mocking.
 */

import { describe, it, expect } from "@jest/globals";
import {
  serializeEnvFile,
  setEnvVar,
  removeEnvVar,
  getDeploymentEnvKeys,
} from "../env-file.js";
import type { EnvLine } from "../env-file.js";

describe("env-file utilities", () => {
  describe("serializeEnvFile", () => {
    it("should serialize lines back to string", () => {
      const lines: EnvLine[] = [
        { type: "comment", raw: "# Comment" },
        { type: "variable", raw: "KEY=value", key: "KEY", value: "value" },
        { type: "empty", raw: "" },
      ];

      const result = serializeEnvFile(lines);

      expect(result).toBe("# Comment\nKEY=value\n");
    });

    it("should handle empty lines array", () => {
      const result = serializeEnvFile([]);

      expect(result).toBe("");
    });

    it("should preserve original formatting", () => {
      const lines: EnvLine[] = [
        { type: "variable", raw: "KEY=value with spaces", key: "KEY", value: "value with spaces" },
        { type: "variable", raw: "EMPTY=", key: "EMPTY", value: "" },
      ];

      const result = serializeEnvFile(lines);

      expect(result).toBe("KEY=value with spaces\nEMPTY=");
    });
  });

  describe("setEnvVar", () => {
    it("should add new variable", () => {
      const lines: EnvLine[] = [
        { type: "variable", raw: "EXISTING=value", key: "EXISTING", value: "value" },
      ];

      const result = setEnvVar(lines, "NEW_VAR", "new_value");

      expect(result).toHaveLength(2);
      expect(result[1]).toEqual({
        type: "variable",
        raw: "NEW_VAR=new_value",
        key: "NEW_VAR",
        value: "new_value",
      });
    });

    it("should update existing variable", () => {
      const lines: EnvLine[] = [
        { type: "variable", raw: "KEY=old", key: "KEY", value: "old" },
      ];

      const result = setEnvVar(lines, "KEY", "new");

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: "variable",
        raw: "KEY=new",
        key: "KEY",
        value: "new",
      });
    });

    it("should insert before trailing empty lines", () => {
      const lines: EnvLine[] = [
        { type: "variable", raw: "FIRST=1", key: "FIRST", value: "1" },
        { type: "empty", raw: "" },
        { type: "empty", raw: "" },
      ];

      const result = setEnvVar(lines, "NEW", "value");

      expect(result).toHaveLength(4);
      expect(result[1]).toEqual({
        type: "variable",
        raw: "NEW=value",
        key: "NEW",
        value: "value",
      });
      expect(result[2].type).toBe("empty");
      expect(result[3].type).toBe("empty");
    });

    it("should handle empty lines array", () => {
      const lines: EnvLine[] = [];

      const result = setEnvVar(lines, "KEY", "value");

      expect(result).toHaveLength(1);
      expect(result[0].key).toBe("KEY");
    });

    it("should handle URL values with special characters", () => {
      const lines: EnvLine[] = [];

      const result = setEnvVar(lines, "URL", "http://example.com?foo=bar&baz=qux");

      expect(result[0].value).toBe("http://example.com?foo=bar&baz=qux");
    });
  });

  describe("removeEnvVar", () => {
    it("should remove existing variable", () => {
      const lines: EnvLine[] = [
        { type: "variable", raw: "KEEP=value", key: "KEEP", value: "value" },
        { type: "variable", raw: "REMOVE=value", key: "REMOVE", value: "value" },
      ];

      const result = removeEnvVar(lines, "REMOVE");

      expect(result).toHaveLength(1);
      expect(result[0].key).toBe("KEEP");
    });

    it("should do nothing if variable does not exist", () => {
      const lines: EnvLine[] = [
        { type: "variable", raw: "KEY=value", key: "KEY", value: "value" },
      ];

      const result = removeEnvVar(lines, "NONEXISTENT");

      expect(result).toHaveLength(1);
      expect(result[0].key).toBe("KEY");
    });

    it("should preserve comments and empty lines", () => {
      const lines: EnvLine[] = [
        { type: "comment", raw: "# Comment" },
        { type: "variable", raw: "REMOVE=value", key: "REMOVE", value: "value" },
        { type: "empty", raw: "" },
      ];

      const result = removeEnvVar(lines, "REMOVE");

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe("comment");
      expect(result[1].type).toBe("empty");
    });

    it("should remove all occurrences with same key", () => {
      const lines: EnvLine[] = [
        { type: "variable", raw: "KEY=first", key: "KEY", value: "first" },
        { type: "variable", raw: "OTHER=value", key: "OTHER", value: "value" },
        { type: "variable", raw: "KEY=second", key: "KEY", value: "second" },
      ];

      const result = removeEnvVar(lines, "KEY");

      expect(result).toHaveLength(1);
      expect(result[0].key).toBe("OTHER");
    });
  });

  describe("getDeploymentEnvKeys", () => {
    it("should return local keys for local deployment", () => {
      const keys = getDeploymentEnvKeys("local");

      expect(keys).toEqual({
        urlKey: "LOCAL_CONVEX_URL",
        keyKey: "LOCAL_CONVEX_DEPLOY_KEY",
        deploymentKey: "LOCAL_CONVEX_DEPLOYMENT",
      });
    });

    it("should return local keys for LOCAL (uppercase)", () => {
      const keys = getDeploymentEnvKeys("LOCAL");

      expect(keys).toEqual({
        urlKey: "LOCAL_CONVEX_URL",
        keyKey: "LOCAL_CONVEX_DEPLOY_KEY",
        deploymentKey: "LOCAL_CONVEX_DEPLOYMENT",
      });
    });

    it("should return cloud keys for cloud deployment", () => {
      const keys = getDeploymentEnvKeys("cloud");

      expect(keys).toEqual({
        urlKey: "CLOUD_CONVEX_URL",
        keyKey: "CLOUD_CONVEX_DEPLOY_KEY",
      });
    });

    it("should return cloud keys for production deployment", () => {
      const keys = getDeploymentEnvKeys("production");

      expect(keys).toEqual({
        urlKey: "CLOUD_CONVEX_URL",
        keyKey: "CLOUD_CONVEX_DEPLOY_KEY",
      });
    });

    it("should return cloud keys for prod deployment", () => {
      const keys = getDeploymentEnvKeys("prod");

      expect(keys).toEqual({
        urlKey: "CLOUD_CONVEX_URL",
        keyKey: "CLOUD_CONVEX_DEPLOY_KEY",
      });
    });

    it("should return custom keys for custom deployment names", () => {
      const keys = getDeploymentEnvKeys("staging");

      expect(keys).toEqual({
        urlKey: "STAGING_CONVEX_URL",
        keyKey: "STAGING_CONVEX_DEPLOY_KEY",
      });
    });

    it("should sanitize special characters in custom names", () => {
      const keys = getDeploymentEnvKeys("my-custom-env");

      expect(keys).toEqual({
        urlKey: "MY_CUSTOM_ENV_CONVEX_URL",
        keyKey: "MY_CUSTOM_ENV_CONVEX_DEPLOY_KEY",
      });
    });

    it("should handle names with numbers", () => {
      const keys = getDeploymentEnvKeys("staging2");

      expect(keys).toEqual({
        urlKey: "STAGING2_CONVEX_URL",
        keyKey: "STAGING2_CONVEX_DEPLOY_KEY",
      });
    });

    it("should handle mixed case input", () => {
      const keys = getDeploymentEnvKeys("MyDeployment");

      expect(keys).toEqual({
        urlKey: "MYDEPLOYMENT_CONVEX_URL",
        keyKey: "MYDEPLOYMENT_CONVEX_DEPLOY_KEY",
      });
    });
  });
});
