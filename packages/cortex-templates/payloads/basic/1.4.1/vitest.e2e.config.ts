import { defineConfig } from "vitest/config";

/**
 * Configuration for E2E tests.
 * Read-only installed-run controls require an explicitly verified disposable backend.
 *
 * Run with:
 *   CORTEX_E2E_TARGET_VERIFIED=true CORTEX_E2E_RUN_ID=<existing-run> npm run test:e2e
 * Host JWT, tenant, space and deployment selectors must also be configured.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/__tests__/e2e/**/*.test.ts"],
    testTimeout: 180000, // Bounded read-only installed controls; no new inference.
    hookTimeout: 60000, // 1 minute for setup/teardown
    clearMocks: true,
    restoreMocks: true,
    // Run E2E tests sequentially to avoid rate limits
    pool: "forks",
    maxWorkers: 1,
  },
});
