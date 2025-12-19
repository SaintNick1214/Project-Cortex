/**
 * Client Utilities Tests
 */

import { describe, it, expect } from "@jest/globals";
import type { CLIConfig } from "../../types.js";
import { getDeploymentInfo } from "../client.js";

// Note: createClient, closeClient, testConnection, and withClient
// involve actual SDK instantiation. Those are better tested as integration tests.
// Here we test the pure utility functions.

describe("client utilities", () => {
  const mockConfig: CLIConfig = {
    deployments: {
      local: {
        url: "http://127.0.0.1:3210",
        deployment: "test:local-deployment",
      },
      cloud: {
        url: "https://test-app.convex.cloud",
        key: "test-deploy-key",
      },
      staging: {
        url: "https://staging.convex.cloud",
      },
    },
    default: "local",
    format: "table",
    confirmDangerous: true,
  };

  describe("getDeploymentInfo", () => {
    it("should return local deployment info", () => {
      const info = getDeploymentInfo(mockConfig, { deployment: "local" });

      expect(info.url).toBe("http://127.0.0.1:3210");
      expect(info.deployment).toBe("test:local-deployment");
      expect(info.isLocal).toBe(true);
      expect(info.hasKey).toBe(false);
    });

    it("should return cloud deployment info", () => {
      const info = getDeploymentInfo(mockConfig, { deployment: "cloud" });

      expect(info.url).toBe("https://test-app.convex.cloud");
      expect(info.isLocal).toBe(false);
      expect(info.hasKey).toBe(true);
    });

    it("should return staging deployment info (no key)", () => {
      const info = getDeploymentInfo(mockConfig, { deployment: "staging" });

      expect(info.url).toBe("https://staging.convex.cloud");
      expect(info.isLocal).toBe(false);
      expect(info.hasKey).toBe(false);
    });

    it("should detect localhost as local", () => {
      const localhostConfig: CLIConfig = {
        ...mockConfig,
        deployments: {
          test: { url: "http://localhost:3210" },
        },
        default: "test",
      };

      const info = getDeploymentInfo(localhostConfig, {});

      expect(info.isLocal).toBe(true);
    });

    it("should detect 127.0.0.1 as local", () => {
      const info = getDeploymentInfo(mockConfig, { deployment: "local" });

      expect(info.isLocal).toBe(true);
    });

    it("should use default deployment when none specified", () => {
      const info = getDeploymentInfo(mockConfig, {});

      expect(info.url).toBe("http://127.0.0.1:3210");
      expect(info.deployment).toBe("test:local-deployment");
    });

    it("should respect url override from options", () => {
      const info = getDeploymentInfo(mockConfig, {
        url: "http://custom:8080",
      });

      expect(info.url).toBe("http://custom:8080");
    });

    it("should detect key presence correctly", () => {
      const infoWithKey = getDeploymentInfo(mockConfig, {
        deployment: "cloud",
      });
      expect(infoWithKey.hasKey).toBe(true);

      const infoWithoutKey = getDeploymentInfo(mockConfig, {
        deployment: "local",
      });
      expect(infoWithoutKey.hasKey).toBe(false);
    });
  });
});

// Integration tests for createClient, testConnection, withClient
// would be in tests/integration/ and require actual Convex connectivity
