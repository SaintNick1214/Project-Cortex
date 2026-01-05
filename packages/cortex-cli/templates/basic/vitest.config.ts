import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [
      "src/**/*.test.ts",
      "src/__tests__/**/*.test.ts",
    ],
    // Unit tests run fast
    testTimeout: 10000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/__tests__/**",
        "src/index.ts", // Entry point, tested via integration
        "src/server.ts", // Entry point, tested via integration
      ],
    },
    clearMocks: true,
    restoreMocks: true,
    // Separate pools for different test types
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
