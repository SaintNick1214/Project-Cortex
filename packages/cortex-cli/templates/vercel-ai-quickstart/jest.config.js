/**
 * Jest Configuration for Vercel AI Quickstart
 *
 * Three test projects:
 * - unit: Fast unit tests with mocked dependencies
 * - integration: Integration tests for API routes with mocked SDK
 * - e2e: End-to-end tests with real Cortex backend (requires CONVEX_URL, OPENAI_API_KEY)
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
    {
      ...baseConfig,
      displayName: "e2e",
      testMatch: ["<rootDir>/tests/e2e/**/*.test.ts"],
      testTimeout: 120000, // 2 minutes for real network calls
    },
  ],
};
