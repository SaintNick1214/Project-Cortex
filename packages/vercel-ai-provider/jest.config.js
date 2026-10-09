/**
 * Jest Configuration for Vercel AI Provider
 *
 * Test projects:
 * - unit / unit-react: CommonJS tests preserving hoisted dependency mocks
 * - unit-remote: ESM tests using the actual AI SDK 7 stream parser
 * - integration: Integration tests with mocked SDK but real component interactions
 * - e2e: End-to-end tests with real Convex backend and LLM calls
 * - e2e-remote: Verified backend-owned runtime contract, without application inference keys
 */

const baseConfig = {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts", ".tsx"],
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
    "react/**/*.ts",
    "react/**/*.tsx",
    "!src/**/*.test.ts",
    "!src/**/*.spec.ts",
    "!src/**/__tests__/**",
    "!react/**/*.test.ts",
    "!react/**/*.test.tsx",
  ],
};

// These suites use jest.mock hoisting. Enabling the VM ESM runtime for the
// remote suite must not change their module or mock semantics.
const commonJsConfig = {
  ...baseConfig,
  preset: "ts-jest",
  extensionsToTreatAsEsm: [],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      { useESM: false, tsconfig: "tsconfig.test.json" },
    ],
  },
};

export default {
  ...baseConfig,
  // Use projects for different test types
  projects: [
    {
      ...commonJsConfig,
      displayName: "unit",
      testMatch: ["<rootDir>/tests/unit/**/*.test.ts"],
      testPathIgnorePatterns: ["<rootDir>/tests/unit/remote\\.test\\.ts$"],
      testTimeout: 10000,
      testEnvironmentOptions: {
        JEST_PROJECT: "unit",
      },
    },
    {
      ...commonJsConfig,
      displayName: "unit-react",
      testEnvironment: "jsdom",
      testMatch: ["<rootDir>/tests/unit/**/*.test.tsx"],
      testTimeout: 10000,
      testEnvironmentOptions: {
        JEST_PROJECT: "unit-react",
      },
    },
    {
      ...baseConfig,
      displayName: "unit-remote",
      testMatch: ["<rootDir>/tests/unit/remote.test.ts"],
      testTimeout: 10000,
      testEnvironmentOptions: {
        JEST_PROJECT: "unit-remote",
      },
    },
    {
      ...commonJsConfig,
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
      testPathIgnorePatterns: ["<rootDir>/tests/e2e/remote-runtime\\.test\\.ts$"],
      testTimeout: 180000, // 3 minutes for E2E tests hitting real APIs
      testEnvironmentOptions: {
        JEST_PROJECT: "e2e",
      },
    },
    {
      ...baseConfig,
      displayName: "e2e-remote",
      testMatch: ["<rootDir>/tests/e2e/remote-runtime.test.ts"],
      testTimeout: 180000,
      transform: {
        "^.+\\.tsx?$": ["ts-jest", { useESM: true, tsconfig: {
          rootDir: "../..", target: "ES2022", module: "ESNext", moduleResolution: "bundler",
          lib: ["ES2023", "DOM"], strict: true, esModuleInterop: true, skipLibCheck: true,
          jsx: "react-jsx", types: ["node", "jest"],
        } }],
      },
      testEnvironmentOptions: { JEST_PROJECT: "e2e-remote" },
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
