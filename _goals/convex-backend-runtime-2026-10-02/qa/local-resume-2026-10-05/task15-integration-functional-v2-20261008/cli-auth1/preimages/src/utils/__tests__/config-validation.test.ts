/**
 * Config Validation Tests
 *
 * Tests for validateAndCleanConfig and loadConfigWithValidation functions.
 * Covers filesystem validation, Convex auth/network error handling, and config cleanup.
 */

 

import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import type { CLIConfig } from "../../types.js";

// Mock modules before importing the module under test
jest.unstable_mockModule("fs", () => ({
  existsSync: jest.fn(),
  readdirSync: jest.fn(() => []),
  readFileSync: jest.fn(),
}));

jest.unstable_mockModule("fs/promises", () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn(),
}));

// Mock the SDK - use any type for mocks to avoid complex ESM typing issues
 
const mockCortexClose: any = jest.fn();
 
const mockMemorySpacesList: any = jest.fn();

jest.unstable_mockModule("@cortexmemory/sdk", () => ({
  Cortex: jest.fn().mockImplementation(() => ({
    memorySpaces: { list: mockMemorySpacesList },
    close: mockCortexClose,
  })),
}));

// Mock cosmiconfig
jest.unstable_mockModule("cosmiconfig", () => ({
  cosmiconfig: jest.fn(() => ({
    search: jest.fn(async () => null),
  })),
}));

// Import after mocks
const { existsSync } = await import("fs");
const { writeFile } = await import("fs/promises");
const { Cortex } = await import("@cortexmemory/sdk");

// Import the module under test
const { validateAndCleanConfig, loadConfigWithValidation } =
  await import("../config.js");

// Cast mocks to any for flexibility in tests (ESM mocks have complex types)
const mockExistsSync = existsSync as any;
const mockWriteFile = writeFile as any;
const mockCortex = Cortex as any;

describe("validateAndCleanConfig", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default: all paths exist
    mockExistsSync.mockReturnValue(true);

    // Reset Cortex mock to use the standard mock functions
    mockCortex.mockImplementation(() => ({
      memorySpaces: { list: mockMemorySpacesList },
      close: mockCortexClose,
    }));

    // Default: Cortex succeeds
    mockMemorySpacesList.mockResolvedValue({ memorySpaces: [] });
  });

  // Requirement 1: validateAndCleanConfig with valid config (no changes, modified=false)
  it("should return modified=false when config is valid and unchanged", async () => {
    mockExistsSync.mockReturnValue(true);
    mockMemorySpacesList.mockResolvedValue({ memorySpaces: [] });

    const config: CLIConfig = {
      deployments: {
        test: { url: "http://test", projectPath: "/exists" },
      },
      default: "test",
      format: "table",
      confirmDangerous: true,
    };

    const result = await validateAndCleanConfig(config, { checkConvex: true });

    expect(result.modified).toBe(false);
    expect(result.config.deployments["test"]).toBeDefined();
    expect(result.removed.deployments).toHaveLength(0);
    expect(result.removed.apps).toHaveLength(0);
  });

  // Requirement 2: Removal of deployment with missing projectPath
  it("should remove deployments with missing projectPath", async () => {
    mockExistsSync.mockReturnValue(false);

    const config: CLIConfig = {
      deployments: {
        test: { url: "http://test", projectPath: "/missing/path" },
      },
      default: "test",
      format: "table",
      confirmDangerous: true,
    };

    const result = await validateAndCleanConfig(config, { checkConvex: false });

    expect(result.modified).toBe(true);
    expect(result.removed.deployments).toContain("test");
    expect(result.config.deployments["test"]).toBeUndefined();
  });

  // Requirement 3: Removal of app with missing projectPath+path
  it("should remove apps with missing path", async () => {
    // Deployment path exists, but app path doesn't
    mockExistsSync.mockImplementation((path: string) => {
      if (path === "/exists") return true;
      if (path === "/exists/missing-app") return false;
      return true;
    });

    const config: CLIConfig = {
      deployments: {
        test: { url: "http://test", projectPath: "/exists" },
      },
      apps: {
        "my-app": {
          type: "basic",
          path: "missing-app",
          projectPath: "/exists",
          enabled: true,
        },
      },
      default: "test",
      format: "table",
      confirmDangerous: true,
    };

    const result = await validateAndCleanConfig(config, { checkConvex: false });

    expect(result.modified).toBe(true);
    expect(result.removed.apps).toContain("my-app");
    expect(result.config.apps?.["my-app"]).toBeUndefined();
  });

  // Requirement 4: Default deployment reassignment when default is removed (picks alphabetically first)
  it("should reassign default to alphabetically first deployment when default is removed", async () => {
    mockExistsSync.mockImplementation((path: string) => {
      if (path === "/missing") return false;
      return true;
    });

    const config: CLIConfig = {
      deployments: {
        alpha: { url: "http://alpha", projectPath: "/alpha" },
        beta: { url: "http://beta", projectPath: "/beta" },
        zulu: { url: "http://zulu", projectPath: "/missing" }, // Will be removed
      },
      default: "zulu", // Default will be removed
      format: "table",
      confirmDangerous: true,
    };

    const result = await validateAndCleanConfig(config, { checkConvex: false });

    expect(result.modified).toBe(true);
    expect(result.removed.deployments).toContain("zulu");
    expect(result.config.default).toBe("alpha"); // Alphabetically first
  });

  // Requirement 5: Default becomes empty string when all deployments removed
  it("should set default to empty string when all deployments are removed", async () => {
    mockExistsSync.mockReturnValue(false);

    const config: CLIConfig = {
      deployments: {
        test1: { url: "http://test1", projectPath: "/missing1" },
        test2: { url: "http://test2", projectPath: "/missing2" },
      },
      default: "test1",
      format: "table",
      confirmDangerous: true,
    };

    const result = await validateAndCleanConfig(config, { checkConvex: false });

    expect(result.modified).toBe(true);
    expect(result.config.default).toBe("");
    expect(Object.keys(result.config.deployments)).toHaveLength(0);
  });

  // Requirement 6: Default reassignment when non-default deployment removed (default unchanged)
  it("should keep default unchanged when a non-default deployment is removed", async () => {
    mockExistsSync.mockImplementation((path: string) => {
      if (path === "/missing") return false;
      return true;
    });

    const config: CLIConfig = {
      deployments: {
        mydefault: { url: "http://default", projectPath: "/exists" },
        toremove: { url: "http://remove", projectPath: "/missing" },
      },
      default: "mydefault",
      format: "table",
      confirmDangerous: true,
    };

    const result = await validateAndCleanConfig(config, { checkConvex: false });

    expect(result.modified).toBe(true);
    expect(result.removed.deployments).toContain("toremove");
    expect(result.config.default).toBe("mydefault"); // Unchanged
  });

  // Requirement 7: Convex auth error (401) triggers removal
  it("should remove deployment on auth error (401)", async () => {
    mockExistsSync.mockReturnValue(true);
    mockMemorySpacesList.mockRejectedValue(new Error("401 Unauthorized"));

    const config: CLIConfig = {
      deployments: {
        test: { url: "http://test", projectPath: "/exists" },
      },
      default: "test",
      format: "table",
      confirmDangerous: true,
    };

    const result = await validateAndCleanConfig(config, { checkConvex: true });

    expect(result.modified).toBe(true);
    expect(result.removed.deployments).toContain("test");
    expect(result.config.deployments["test"]).toBeUndefined();
  });

  // Requirement 8: Convex auth error (403) triggers removal
  it("should remove deployment on auth error (403)", async () => {
    mockExistsSync.mockReturnValue(true);
    mockMemorySpacesList.mockRejectedValue(new Error("403 Forbidden"));

    const config: CLIConfig = {
      deployments: {
        test: { url: "http://test", projectPath: "/exists" },
      },
      default: "test",
      format: "table",
      confirmDangerous: true,
    };

    const result = await validateAndCleanConfig(config, { checkConvex: true });

    expect(result.modified).toBe(true);
    expect(result.removed.deployments).toContain("test");
  });

  // Requirement 9: Convex auth error (message contains "unauthorized") triggers removal
  it('should remove deployment on auth error (message contains "unauthorized")', async () => {
    mockExistsSync.mockReturnValue(true);
    mockMemorySpacesList.mockRejectedValue(
      new Error("Request failed: unauthorized access"),
    );

    const config: CLIConfig = {
      deployments: {
        test: { url: "http://test", projectPath: "/exists" },
      },
      default: "test",
      format: "table",
      confirmDangerous: true,
    };

    const result = await validateAndCleanConfig(config, { checkConvex: true });

    expect(result.modified).toBe(true);
    expect(result.removed.deployments).toContain("test");
  });

  // Requirement 10: Convex network error (ECONNREFUSED) does NOT trigger removal
  it("should keep deployment on network error (ECONNREFUSED)", async () => {
    mockExistsSync.mockReturnValue(true);
    const error = new Error("connect ECONNREFUSED 127.0.0.1:3210");
    (error as Error & { code?: string }).code = "ECONNREFUSED";
    mockMemorySpacesList.mockRejectedValue(error);

    const config: CLIConfig = {
      deployments: {
        test: { url: "http://test", projectPath: "/exists" },
      },
      default: "test",
      format: "table",
      confirmDangerous: true,
    };

    const result = await validateAndCleanConfig(config, { checkConvex: true });

    expect(result.modified).toBe(false);
    expect(result.config.deployments["test"]).toBeDefined();
    expect(result.removed.deployments).toHaveLength(0);
  });

  // Requirement 11: Convex network error (ETIMEDOUT) does NOT trigger removal
  it("should keep deployment on network error (ETIMEDOUT)", async () => {
    mockExistsSync.mockReturnValue(true);
    const error = new Error("connect ETIMEDOUT");
    (error as Error & { code?: string }).code = "ETIMEDOUT";
    mockMemorySpacesList.mockRejectedValue(error);

    const config: CLIConfig = {
      deployments: {
        test: { url: "http://test", projectPath: "/exists" },
      },
      default: "test",
      format: "table",
      confirmDangerous: true,
    };

    const result = await validateAndCleanConfig(config, { checkConvex: true });

    expect(result.modified).toBe(false);
    expect(result.config.deployments["test"]).toBeDefined();
  });

  // Requirement 12: Convex network error (500/502/503/504) does NOT trigger removal
  it("should keep deployment on server errors (500/502/503/504)", async () => {
    mockExistsSync.mockReturnValue(true);

    // Test each server error code
    for (const statusCode of [500, 502, 503, 504]) {
      mockMemorySpacesList.mockRejectedValue(
        new Error(`Server error: ${statusCode}`),
      );

      const config: CLIConfig = {
        deployments: {
          test: { url: "http://test", projectPath: "/exists" },
        },
        default: "test",
        format: "table",
        confirmDangerous: true,
      };

      const result = await validateAndCleanConfig(config, { checkConvex: true });

      expect(result.modified).toBe(false);
      expect(result.config.deployments["test"]).toBeDefined();
    }
  });

  // Requirement 13: Convex timeout (AbortController fires) does NOT trigger removal
  it("should keep deployment on timeout (AbortController)", async () => {
    mockExistsSync.mockReturnValue(true);

    // Simulate a very slow request that will be aborted
    mockMemorySpacesList.mockImplementation(
      () =>
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Operation timed out")), 100);
        }),
    );

    const config: CLIConfig = {
      deployments: {
        test: { url: "http://test", projectPath: "/exists" },
      },
      default: "test",
      format: "table",
      confirmDangerous: true,
    };

    // Use a very short timeout to trigger the abort
    const result = await validateAndCleanConfig(config, {
      checkConvex: true,
      timeout: 50,
    });

    expect(result.modified).toBe(false);
    expect(result.config.deployments["test"]).toBeDefined();
  });

  // Requirement 14: Partial failure: 5 deployments, 2 auth error (removed), 2 valid (kept), 1 timeout (kept)
  it("should handle partial failures correctly", async () => {
    mockExistsSync.mockReturnValue(true);

    // Control behavior based on URL
    mockCortex.mockImplementation(({ convexUrl }: { convexUrl: string }) => {
      return {
        memorySpaces: {
          list: jest.fn().mockImplementation(() => {
            if (convexUrl === "http://auth-error-1" || convexUrl === "http://auth-error-2") {
              return Promise.reject(new Error("401 Unauthorized"));
            }
            if (convexUrl === "http://timeout") {
              return new Promise((_, reject) => {
                setTimeout(() => reject(new Error("timed out")), 100);
              });
            }
            // valid-1 and valid-2 succeed
            return Promise.resolve({ memorySpaces: [] });
          }),
        },
        close: jest.fn(),
      };
    });

    const config: CLIConfig = {
      deployments: {
        "auth-error-1": { url: "http://auth-error-1", projectPath: "/exists" },
        "auth-error-2": { url: "http://auth-error-2", projectPath: "/exists" },
        "valid-1": { url: "http://valid-1", projectPath: "/exists" },
        "valid-2": { url: "http://valid-2", projectPath: "/exists" },
        timeout: { url: "http://timeout", projectPath: "/exists" },
      },
      default: "valid-1",
      format: "table",
      confirmDangerous: true,
    };

    const result = await validateAndCleanConfig(config, {
      checkConvex: true,
      timeout: 50,
    });

    expect(result.modified).toBe(true);

    // Auth errors should be removed
    expect(result.removed.deployments).toContain("auth-error-1");
    expect(result.removed.deployments).toContain("auth-error-2");
    expect(result.config.deployments["auth-error-1"]).toBeUndefined();
    expect(result.config.deployments["auth-error-2"]).toBeUndefined();

    // Valid deployments should be kept
    expect(result.config.deployments["valid-1"]).toBeDefined();
    expect(result.config.deployments["valid-2"]).toBeDefined();

    // Timeout should be kept (fail-safe)
    expect(result.config.deployments["timeout"]).toBeDefined();

    // Exactly 2 removed
    expect(result.removed.deployments).toHaveLength(2);
  });

  // Requirement 15: checkConvex: false skips Convex validation entirely
  it("should skip Convex validation when checkConvex is false", async () => {
    mockExistsSync.mockReturnValue(true);
    mockMemorySpacesList.mockRejectedValue(new Error("401 Unauthorized"));

    const config: CLIConfig = {
      deployments: {
        test: { url: "http://test", projectPath: "/exists" },
      },
      default: "test",
      format: "table",
      confirmDangerous: true,
    };

    const result = await validateAndCleanConfig(config, { checkConvex: false });

    // Should NOT be removed because checkConvex is false
    expect(result.modified).toBe(false);
    expect(result.config.deployments["test"]).toBeDefined();
    expect(result.removed.deployments).toHaveLength(0);
  });

  // Requirement 16: Custom timeout option is respected
  it("should respect custom timeout option", async () => {
    mockExistsSync.mockReturnValue(true);

    // This request will hang longer than the timeout
    mockMemorySpacesList.mockImplementation(
      () =>
        new Promise((resolve) => {
          // This will hang for 500ms, but our timeout should fire first
          setTimeout(() => {
            resolve({ memorySpaces: [] });
          }, 500);
        }),
    );

    const config: CLIConfig = {
      deployments: {
        test: { url: "http://test", projectPath: "/exists" },
      },
      default: "test",
      format: "table",
      confirmDangerous: true,
    };

    const startTime = Date.now();
    const result = await validateAndCleanConfig(config, {
      checkConvex: true,
      timeout: 100, // 100ms timeout
    });
    const elapsed = Date.now() - startTime;

    // Should complete around 100ms (timeout) not 500ms (request)
    expect(elapsed).toBeLessThan(400);
    // Deployment should be kept (timeout is not auth error)
    expect(result.config.deployments["test"]).toBeDefined();
  });

  // Requirement 17: ValidationResult.removed contains correct deployment names
  it("should include correct deployment names in removed list", async () => {
    mockExistsSync.mockImplementation((path: string) => {
      return !path.includes("missing");
    });

    const config: CLIConfig = {
      deployments: {
        "keep-me": { url: "http://keep", projectPath: "/exists" },
        "remove-me-1": { url: "http://rm1", projectPath: "/missing-1" },
        "remove-me-2": { url: "http://rm2", projectPath: "/missing-2" },
      },
      default: "keep-me",
      format: "table",
      confirmDangerous: true,
    };

    const result = await validateAndCleanConfig(config, { checkConvex: false });

    expect(result.removed.deployments).toHaveLength(2);
    expect(result.removed.deployments).toContain("remove-me-1");
    expect(result.removed.deployments).toContain("remove-me-2");
    expect(result.removed.deployments).not.toContain("keep-me");
  });

  // Requirement 18: ValidationResult.removed contains correct app names
  it("should include correct app names in removed list", async () => {
    mockExistsSync.mockImplementation((path: string) => {
      if (path === "/project") return true;
      if (path === "/project/keep-app") return true;
      if (path === "/project/missing-app-1") return false;
      if (path === "/project/missing-app-2") return false;
      return true;
    });

    const config: CLIConfig = {
      deployments: {
        main: { url: "http://main", projectPath: "/project" },
      },
      apps: {
        "keep-app": {
          type: "basic",
          path: "keep-app",
          projectPath: "/project",
          enabled: true,
        },
        "remove-app-1": {
          type: "basic",
          path: "missing-app-1",
          projectPath: "/project",
          enabled: true,
        },
        "remove-app-2": {
          type: "vercel-ai-quickstart",
          path: "missing-app-2",
          projectPath: "/project",
          enabled: true,
        },
      },
      default: "main",
      format: "table",
      confirmDangerous: true,
    };

    const result = await validateAndCleanConfig(config, { checkConvex: false });

    expect(result.removed.apps).toHaveLength(2);
    expect(result.removed.apps).toContain("remove-app-1");
    expect(result.removed.apps).toContain("remove-app-2");
    expect(result.removed.apps).not.toContain("keep-app");
  });

  // Requirement 19: Config is saved when modified
  it("should save config when modified", async () => {
    mockExistsSync.mockReturnValue(false);

    const config: CLIConfig = {
      deployments: {
        test: { url: "http://test", projectPath: "/missing" },
      },
      default: "test",
      format: "table",
      confirmDangerous: true,
    };

    const result = await validateAndCleanConfig(config, { checkConvex: false });

    expect(result.modified).toBe(true);
    // writeFile should have been called (saveUserConfig writes to file)
    expect(writeFile).toHaveBeenCalled();
  });

  // Requirement 20: Config is NOT saved when not modified
  it("should NOT save config when not modified", async () => {
    mockExistsSync.mockReturnValue(true);
    mockMemorySpacesList.mockResolvedValue({ memorySpaces: [] });

    const config: CLIConfig = {
      deployments: {
        test: { url: "http://test", projectPath: "/exists" },
      },
      default: "test",
      format: "table",
      confirmDangerous: true,
    };

    // Clear any previous calls
    mockWriteFile.mockClear();

    const result = await validateAndCleanConfig(config, { checkConvex: true });

    expect(result.modified).toBe(false);
    // writeFile should NOT have been called
    expect(writeFile).not.toHaveBeenCalled();
  });

  // Additional edge case tests

  it("should handle deployment without projectPath (remote-only)", async () => {
    mockExistsSync.mockReturnValue(true);
    mockMemorySpacesList.mockResolvedValue({ memorySpaces: [] });

    const config: CLIConfig = {
      deployments: {
        remote: { url: "http://remote" }, // No projectPath
      },
      default: "remote",
      format: "table",
      confirmDangerous: true,
    };

    const result = await validateAndCleanConfig(config, { checkConvex: true });

    expect(result.modified).toBe(false);
    expect(result.config.deployments["remote"]).toBeDefined();
  });

  it("should handle deployment without url", async () => {
    mockExistsSync.mockReturnValue(true);

    const config: CLIConfig = {
      deployments: {
        nourl: { url: "", projectPath: "/exists" },
      },
      default: "nourl",
      format: "table",
      confirmDangerous: true,
    };

    // With checkConvex true but empty URL, should skip Convex check
    const result = await validateAndCleanConfig(config, { checkConvex: true });

    expect(result.modified).toBe(false);
    expect(result.config.deployments["nourl"]).toBeDefined();
  });

  it("should handle config with no apps property", async () => {
    mockExistsSync.mockReturnValue(true);
    mockMemorySpacesList.mockResolvedValue({ memorySpaces: [] });

    const config: CLIConfig = {
      deployments: {
        test: { url: "http://test", projectPath: "/exists" },
      },
      default: "test",
      format: "table",
      confirmDangerous: true,
      // No apps property
    };

    const result = await validateAndCleanConfig(config, { checkConvex: true });

    expect(result.modified).toBe(false);
    expect(result.removed.apps).toHaveLength(0);
  });

  it("should handle empty deployments object", async () => {
    const config: CLIConfig = {
      deployments: {},
      default: "",
      format: "table",
      confirmDangerous: true,
    };

    const result = await validateAndCleanConfig(config, { checkConvex: true });

    expect(result.modified).toBe(false);
    expect(result.config.default).toBe("");
    expect(Object.keys(result.config.deployments)).toHaveLength(0);
  });

  it('should handle "forbidden" error message', async () => {
    mockExistsSync.mockReturnValue(true);
    mockMemorySpacesList.mockRejectedValue(new Error("Access forbidden"));

    const config: CLIConfig = {
      deployments: {
        test: { url: "http://test", projectPath: "/exists" },
      },
      default: "test",
      format: "table",
      confirmDangerous: true,
    };

    const result = await validateAndCleanConfig(config, { checkConvex: true });

    expect(result.modified).toBe(true);
    expect(result.removed.deployments).toContain("test");
  });

  it('should handle "invalid key" error message', async () => {
    mockExistsSync.mockReturnValue(true);
    mockMemorySpacesList.mockRejectedValue(new Error("invalid key provided"));

    const config: CLIConfig = {
      deployments: {
        test: { url: "http://test", projectPath: "/exists" },
      },
      default: "test",
      format: "table",
      confirmDangerous: true,
    };

    const result = await validateAndCleanConfig(config, { checkConvex: true });

    expect(result.modified).toBe(true);
    expect(result.removed.deployments).toContain("test");
  });

  it('should handle "access denied" error message', async () => {
    mockExistsSync.mockReturnValue(true);
    mockMemorySpacesList.mockRejectedValue(new Error("access denied for user"));

    const config: CLIConfig = {
      deployments: {
        test: { url: "http://test", projectPath: "/exists" },
      },
      default: "test",
      format: "table",
      confirmDangerous: true,
    };

    const result = await validateAndCleanConfig(config, { checkConvex: true });

    expect(result.modified).toBe(true);
    expect(result.removed.deployments).toContain("test");
  });
});

describe("loadConfigWithValidation", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default: all paths exist
    mockExistsSync.mockReturnValue(true);

    // Default: Cortex succeeds
    mockMemorySpacesList.mockResolvedValue({ memorySpaces: [] });
  });

  // Requirement 21: loadConfigWithValidation() combines load + validate
  it("should combine load and validate", async () => {
    mockExistsSync.mockReturnValue(true);
    mockMemorySpacesList.mockResolvedValue({ memorySpaces: [] });

    const result = await loadConfigWithValidation();

    // Should return a CLIConfig (validated)
    expect(result).toHaveProperty("deployments");
    expect(result).toHaveProperty("default");
    expect(result).toHaveProperty("format");
    expect(result).toHaveProperty("confirmDangerous");
  });

  // Requirement 22: loadConfigWithValidation({ checkConvex: false }) skips Convex validation
  it("should skip Convex validation when checkConvex is false", async () => {
    // Even with auth error, should not remove because checkConvex is false
    mockMemorySpacesList.mockRejectedValue(new Error("401 Unauthorized"));

    // This test verifies that the option is passed through
    const result = await loadConfigWithValidation({ checkConvex: false });

    // Should return config without errors
    expect(result).toHaveProperty("deployments");
    expect(result).toHaveProperty("format");
  });

  it("should pass timeout option through", async () => {
    mockExistsSync.mockReturnValue(true);
    mockMemorySpacesList.mockResolvedValue({ memorySpaces: [] });

    const result = await loadConfigWithValidation({
      checkConvex: true,
      timeout: 5000,
    });

    expect(result).toHaveProperty("deployments");
  });
});
