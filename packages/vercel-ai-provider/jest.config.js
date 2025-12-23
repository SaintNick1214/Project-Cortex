/**
 * Jest Configuration for Vercel AI Provider
 *
 * Three test projects:
 * - unit: Fast unit tests with mocked dependencies
 * - integration: Integration tests with mocked SDK but real component interactions
 * - e2e: End-to-end tests with real Convex backend and LLM calls
 */

const baseConfig = {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: "tsconfig.test.json",
      },
    ],
  },
  setupFilesAfterEnv: ["<rootDir>/tests/helpers/setup.ts"],
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.test.ts",
    "!src/**/*.spec.ts",
    "!src/**/__tests__/**",
  ],
};

export default {
  ...baseConfig,
  // Use projects for different test types
  projects: [
    {
      ...baseConfig,
      displayName: "unit",
      testMatch: ["<rootDir>/tests/unit/**/*.test.ts"],
      testTimeout: 10000,
      testEnvironmentOptions: {
        JEST_PROJECT: "unit",
      },
    },
    {
      ...baseConfig,
      displayName: "integration",
      testMatch: ["<rootDir>/tests/integration/**/*.test.ts"],
      testTimeout: 30000,
      testEnvironmentOptions: {
        JEST_PROJECT: "integration",
      },
    },
    {
      ...baseConfig,
      displayName: "e2e",
      testMatch: ["<rootDir>/tests/e2e/**/*.test.ts"],
      testTimeout: 120000,
      testEnvironmentOptions: {
        JEST_PROJECT: "e2e",
      },
    },
  ],
  // Coverage thresholds
  // Note: Branch coverage is slightly relaxed due to complex async error handling paths
  // that are difficult to test without real backend failures
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
