import { defineConfig } from "vitest/config";

/**
 * Configuration for integration tests.
 * These tests use mocked SDK but test real component interactions.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/__tests__/integration/**/*.test.ts"],
    testTimeout: 30000, // 30 seconds for integration tests
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/__tests__/**",
      ],
    },
    clearMocks: true,
    restoreMocks: true,
  },
});
