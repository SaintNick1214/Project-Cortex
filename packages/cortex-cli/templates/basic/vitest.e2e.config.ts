import { defineConfig } from "vitest/config";

/**
 * Configuration for E2E tests.
 * These tests require real Convex backend and optionally OpenAI API key.
 *
 * Run with:
 *   CONVEX_URL=<url> npm run test:e2e
 *   CONVEX_URL=<url> OPENAI_API_KEY=<key> npm run test:e2e
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/__tests__/e2e/**/*.test.ts"],
    testTimeout: 180000, // 3 minutes for E2E tests (fact extraction takes time)
    hookTimeout: 60000, // 1 minute for setup/teardown
    clearMocks: true,
    restoreMocks: true,
    // Run E2E tests sequentially to avoid rate limits
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
