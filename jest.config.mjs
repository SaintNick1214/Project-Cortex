/** @type {import('jest').Config} */
export default {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  testMatch: ["**/*.test.ts"],
  setupFiles: ["<rootDir>/tests/env.ts"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.d.ts", "!src/**/index.ts"],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  testTimeout: 60000, // 60 seconds for Convex operations with resilience layer retries
  forceExit: true, // Exit after tests complete (helps with Convex client cleanup)

  // ══════════════════════════════════════════════════════════════════════════
  // PARALLELISM CONFIGURATION
  // ══════════════════════════════════════════════════════════════════════════
  // Tests use TestRunContext (tests/helpers/isolation.ts) for unique prefixed
  // entity IDs, enabling safe parallel execution without data conflicts.
  //
  // maxWorkers: Controls parallel test file execution
  //   - Local: "50%" = half of CPU cores (leaves resources for other tasks)
  //   - CI: "75%" = more aggressive since tests are I/O-bound (network waits)
  //   - CI also uses --shard for distributing tests across multiple runners
  //   - Use --runInBand for debugging to run tests serially
  //
  // maxConcurrency: Controls test.concurrent() parallelism WITHIN files
  //   - Default is 5, we increase to 10 for faster I/O-bound tests
  //   - Only affects tests marked with it.concurrent() or test.concurrent()
  // ══════════════════════════════════════════════════════════════════════════
  maxWorkers: process.env.CI ? "75%" : "50%",
  maxConcurrency: 10,

  extensionsToTreatAsEsm: [".ts"],
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
  reporters: ["default", "<rootDir>/tests/test-timing-reporter.cjs"],
};
