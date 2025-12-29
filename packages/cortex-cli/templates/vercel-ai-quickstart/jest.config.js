/**
 * Jest Configuration for Vercel AI Quickstart
 *
 * Two test projects:
 * - unit: Fast unit tests with mocked dependencies
 * - integration: Integration tests for API routes with mocked SDK
 */

const baseConfig = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleNameMapper: {
    // Handle path aliases from tsconfig
    "^@/(.*)$": "<rootDir>/$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.json",
      },
    ],
  },
  setupFilesAfterEnv: ["<rootDir>/tests/helpers/setup.ts"],
  // Ignore Next.js build output
  testPathIgnorePatterns: ["/node_modules/", "/.next/"],
};

module.exports = {
  ...baseConfig,
  projects: [
    {
      ...baseConfig,
      displayName: "unit",
      testMatch: ["<rootDir>/tests/unit/**/*.test.ts"],
      testTimeout: 10000,
    },
    {
      ...baseConfig,
      displayName: "integration",
      testMatch: ["<rootDir>/tests/integration/**/*.test.ts"],
      testTimeout: 30000,
    },
  ],
};
