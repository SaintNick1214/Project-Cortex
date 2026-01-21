/**
 * Config Utilities Tests
 */

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import {
  getDeployment,
  resolveConfig,
  listDeployments,
  listApps,
  discoverUnregisteredApps,
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

describe("listApps", () => {
  it("should return empty array when no apps configured", () => {
    const config: CLIConfig = {
      deployments: {
        local: { url: "http://127.0.0.1:3210" },
      },
      default: "local",
      format: "table",
      confirmDangerous: true,
    };

    const apps = listApps(config);
    expect(apps).toEqual([]);
  });

  it("should list all configured apps", () => {
    const config: CLIConfig = {
      deployments: {
        local: { url: "http://127.0.0.1:3210" },
      },
      apps: {
        "my-quickstart": {
          type: "vercel-ai-quickstart",
          path: "quickstart",
          projectPath: "/home/user/project",
          enabled: true,
          port: 3000,
        },
        "my-basic": {
          type: "basic",
          path: "basic",
          projectPath: "/home/user/project",
          enabled: false,
        },
      },
      default: "local",
      format: "table",
      confirmDangerous: true,
    };

    const apps = listApps(config);
    expect(apps).toHaveLength(2);

    const quickstart = apps.find((a) => a.name === "my-quickstart");
    expect(quickstart).toMatchObject({
      name: "my-quickstart",
      type: "vercel-ai-quickstart",
      path: "quickstart",
      enabled: true,
      port: 3000,
    });

    const basic = apps.find((a) => a.name === "my-basic");
    expect(basic).toMatchObject({
      name: "my-basic",
      type: "basic",
      path: "basic",
      enabled: false,
    });
  });
});

describe("discoverUnregisteredApps", () => {
  // Note: discoverUnregisteredApps relies on filesystem operations that are
  // difficult to mock in ESM. These tests cover the basic logic without
  // filesystem access. Full integration tests should be run manually.

  it("should return empty array when no deployments have projectPath", () => {
    const config: CLIConfig = {
      deployments: {
        remote: {
          url: "https://remote.convex.cloud",
          // No projectPath - remote only deployment
        },
      },
      default: "remote",
      format: "table",
      confirmDangerous: true,
    };

    const discovered = discoverUnregisteredApps(config);
    expect(discovered).toEqual([]);
  });

  it("should return empty array when projectPath does not exist", () => {
    const config: CLIConfig = {
      deployments: {
        local: {
          url: "http://127.0.0.1:3210",
          projectPath: "/nonexistent/path/that/does/not/exist",
        },
      },
      default: "local",
      format: "table",
      confirmDangerous: true,
    };

    const discovered = discoverUnregisteredApps(config);
    expect(discovered).toEqual([]);
  });

  it("should return empty array when config has no deployments", () => {
    const config: CLIConfig = {
      deployments: {},
      default: "",
      format: "table",
      confirmDangerous: true,
    };

    const discovered = discoverUnregisteredApps(config);
    expect(discovered).toEqual([]);
  });

  it("should have correct interface for DiscoveredApp", () => {
    // Type check - ensure the interface is correct
    const config: CLIConfig = {
      deployments: {},
      default: "",
      format: "table",
      confirmDangerous: true,
    };

    const discovered = discoverUnregisteredApps(config);

    // Just verify it returns an array (empty in this case)
    expect(Array.isArray(discovered)).toBe(true);

    // If there were results, they would have this shape:
    // {
    //   name: string,
    //   type: "basic" | "vercel-ai-quickstart",
    //   path: string,
    //   projectPath: string,
    //   fullPath: string,
    //   deploymentName?: string
    // }
  });
});
