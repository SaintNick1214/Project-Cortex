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
  //   - "50%" = half of available CPU cores (good balance for I/O-bound tests)
  //   - CI environments: set via --maxWorkers flag for optimal resource usage
  //   - Use --runInBand for debugging to run tests serially
  // ══════════════════════════════════════════════════════════════════════════
  maxWorkers: process.env.CI ? "50%" : "50%",

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
