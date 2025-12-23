/**
 * Jest setup file for Vercel AI Provider tests
 *
 * Works in both CJS (unit/integration tests) and ESM (E2E tests with --experimental-vm-modules)
 */

import * as dotenv from "dotenv";
import * as path from "path";

// Get __dirname in a way that works for both CJS and ESM
// In CJS, __dirname is defined globally
// In ESM, we need to derive it from import.meta.url
let currentDir: string;
try {
  // Try CJS first (most common case for unit tests)
  currentDir = __dirname;
} catch {
  // Fall back to process.cwd() - env files are relative to package root anyway
  currentDir = process.cwd();
}

// Load environment variables from .env files
// Try multiple locations for flexibility
const envPaths = [
  path.resolve(currentDir, ".env.local"),
  path.resolve(currentDir, ".env"),
  path.resolve(currentDir, "../../.env.local"),
  path.resolve(currentDir, "../../.env"),
  path.resolve(currentDir, "../../../../.env.local"),
  path.resolve(currentDir, "../../../../.env"),
];

for (const envPath of envPaths) {
  dotenv.config({ path: envPath });
}

// Extend Jest timeout for E2E tests (individual tests can override)
// Note: jest is a global in Jest environment
if (typeof jest !== "undefined") {
  jest.setTimeout(30000);
}

// Suppress console output during tests unless DEBUG is set
if (!process.env.DEBUG && typeof jest !== "undefined") {
  global.console = {
    ...console,
    log: jest.fn() as unknown as typeof console.log,
    debug: jest.fn() as unknown as typeof console.debug,
    info: jest.fn() as unknown as typeof console.info,
    // Keep warn and error for visibility
    warn: console.warn,
    error: console.error,
  };
}

// Global test utilities
if (typeof beforeAll !== "undefined") {
  beforeAll(() => {
    // Verify required env vars for E2E tests
    if (process.env.JEST_PROJECT === "e2e") {
      if (!process.env.CONVEX_URL) {
        console.warn(
          "⚠️  CONVEX_URL not set - E2E tests will fail. Set it in .env.local",
        );
      }
      if (!process.env.OPENAI_API_KEY) {
        console.warn(
          "⚠️  OPENAI_API_KEY not set - E2E tests with LLM calls will fail",
        );
      }
    }
  });
}

// Clean up after all tests
if (typeof afterAll !== "undefined") {
  afterAll(async () => {
    // Give any pending async operations time to complete
    await new Promise((resolve) => setTimeout(resolve, 100));
  });
}
