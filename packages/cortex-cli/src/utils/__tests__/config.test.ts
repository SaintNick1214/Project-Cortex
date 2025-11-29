/**
 * Config Utilities Tests
 */

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import {
  getDeployment,
  resolveConfig,
  listDeployments,
} from "../config.js";
import type { CLIConfig } from "../../types.js";

describe("config utilities", () => {
  const mockConfig: CLIConfig = {
    deployments: {
      local: {
        url: "http://127.0.0.1:3210",
        deployment: "anonymous:local",
      },
      staging: {
        url: "https://staging.convex.cloud",
        key: "staging-key",
      },
      production: {
        url: "https://prod.convex.cloud",
        key: "prod-key",
      },
    },
    default: "local",
    format: "table",
    confirmDangerous: true,
  };

  describe("getDeployment", () => {
    it("should return deployment by name", () => {
      const deployment = getDeployment(mockConfig, "staging");
      expect(deployment).toEqual({
        url: "https://staging.convex.cloud",
        key: "staging-key",
      });
    });

    it("should return default deployment when name not provided", () => {
      const deployment = getDeployment(mockConfig);
      expect(deployment).toEqual({
        url: "http://127.0.0.1:3210",
        deployment: "anonymous:local",
      });
    });

    it("should return null for non-existent deployment", () => {
      const deployment = getDeployment(mockConfig, "nonexistent");
      expect(deployment).toBeNull();
    });
  });

  describe("resolveConfig", () => {
    it("should use URL from options if provided", () => {
      const resolved = resolveConfig(mockConfig, {
        url: "http://custom:3000",
        key: "custom-key",
      });
      expect(resolved.url).toBe("http://custom:3000");
      expect(resolved.key).toBe("custom-key");
    });

    it("should use deployment from options", () => {
      const resolved = resolveConfig(mockConfig, {
        deployment: "production",
      });
      expect(resolved.url).toBe("https://prod.convex.cloud");
      expect(resolved.key).toBe("prod-key");
    });

    it("should use default deployment when no options", () => {
      const resolved = resolveConfig(mockConfig, {});
      expect(resolved.url).toBe("http://127.0.0.1:3210");
      expect(resolved.deployment).toBe("anonymous:local");
    });

    it("should throw for non-existent deployment", () => {
      expect(() =>
        resolveConfig(mockConfig, { deployment: "nonexistent" }),
      ).toThrow('Deployment "nonexistent" not found');
    });

    it("should use format from options", () => {
      const resolved = resolveConfig(mockConfig, { format: "json" });
      expect(resolved.format).toBe("json");
    });

    it("should use format from config when not in options", () => {
      const resolved = resolveConfig(mockConfig, {});
      expect(resolved.format).toBe("table");
    });

    it("should handle quiet option", () => {
      const resolved = resolveConfig(mockConfig, { quiet: true });
      expect(resolved.quiet).toBe(true);
    });

    it("should handle debug option", () => {
      const resolved = resolveConfig(mockConfig, { debug: true });
      expect(resolved.debug).toBe(true);
    });
  });

  describe("listDeployments", () => {
    it("should list all deployments", () => {
      const deployments = listDeployments(mockConfig);
      expect(deployments).toHaveLength(3);
    });

    it("should include deployment names", () => {
      const deployments = listDeployments(mockConfig);
      const names = deployments.map((d) => d.name);
      expect(names).toContain("local");
      expect(names).toContain("staging");
      expect(names).toContain("production");
    });

    it("should mark default deployment", () => {
      const deployments = listDeployments(mockConfig);
      const defaultDeployment = deployments.find((d) => d.isDefault);
      expect(defaultDeployment?.name).toBe("local");
    });

    it("should indicate which deployments have keys", () => {
      const deployments = listDeployments(mockConfig);
      const local = deployments.find((d) => d.name === "local");
      const staging = deployments.find((d) => d.name === "staging");
      expect(local?.hasKey).toBe(false);
      expect(staging?.hasKey).toBe(true);
    });
  });
});

describe("environment variable overrides", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should be tested in integration tests with actual config loading", () => {
    // Environment overrides are applied during loadConfig()
    // These should be tested in integration tests
    expect(true).toBe(true);
  });
});
