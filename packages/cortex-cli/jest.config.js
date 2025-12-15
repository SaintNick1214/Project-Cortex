/** @type {import('jest').Config} */

// Shared configuration that all projects inherit
const sharedConfig = {
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
        tsconfig: {
          module: "ESNext",
          moduleResolution: "node",
        },
      },
    ],
  },
  transformIgnorePatterns: ["node_modules/(?!convex)"],
};

export default {
  ...sharedConfig,
  roots: ["<rootDir>/tests", "<rootDir>/src"],
  testMatch: ["**/*.test.ts"],
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  setupFiles: ["<rootDir>/tests/env.ts"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/__tests__/**",
    "!src/index.ts",
    // Exclude templates - these are scaffolding files
    "!src/templates/**",
    // Exclude type definitions
    "!src/types.ts",
    // Exclude command implementations - these require SDK integration testing
    "!src/commands/**",
    // Exclude init utilities - these are complex setup wizards
    "!src/utils/init/**",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  coverageThreshold: {
    global: {
      branches: 35,
      functions: 35,
      lines: 35,
      statements: 35,
    },
  },
  // Test organization - each project inherits sharedConfig
  projects: [
    {
      ...sharedConfig,
      displayName: "unit",
      rootDir: "<rootDir>",
      testMatch: ["<rootDir>/src/utils/__tests__/**/*.test.ts"],
      setupFiles: ["<rootDir>/tests/env.ts"],
      // Unit tests don't need setupFilesAfterEnv
      setupFilesAfterEnv: [],
    },
    {
      ...sharedConfig,
      displayName: "commands",
      rootDir: "<rootDir>",
      testMatch: ["<rootDir>/tests/commands/**/*.test.ts"],
      setupFiles: ["<rootDir>/tests/env.ts"],
      setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
    },
    {
      ...sharedConfig,
      displayName: "e2e",
      rootDir: "<rootDir>",
      testMatch: ["<rootDir>/tests/e2e/**/*.test.ts"],
      setupFiles: ["<rootDir>/tests/env.ts"],
      setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
      // E2E tests need longer timeout
      testTimeout: 120000,
    },
  ],
  verbose: true,
  testTimeout: 60000, // 60 seconds for Convex operations with resilience layer retries
  forceExit: true,
};
