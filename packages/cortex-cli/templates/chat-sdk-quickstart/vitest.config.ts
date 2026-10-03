import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./"),
    },
  },
  test: {
    coverage: {
      exclude: ["lib/editor/**", "lib/ai/tools/**", "**/*.d.ts"],
      include: ["lib/**/*.ts"],
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
    environment: "jsdom",
    exclude: ["tests/e2e/**", "node_modules/**"],
    globals: true,
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    setupFiles: ["./tests/helpers/setup.ts"],
    // Prevent test timeouts for async operations
    testTimeout: 10_000,
  },
});
