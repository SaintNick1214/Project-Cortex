/**
 * Jest setup file for Vercel AI Provider tests
 */

import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables from .env files
// Try multiple locations for flexibility
const envPaths = [
  path.resolve(__dirname, "../../.env.local"),
  path.resolve(__dirname, "../../.env"),
  path.resolve(__dirname, "../../../../.env.local"),
  path.resolve(__dirname, "../../../../.env"),
];

for (const envPath of envPaths) {
  dotenv.config({ path: envPath });
}

// Extend Jest timeout for E2E tests (individual tests can override)
jest.setTimeout(30000);

// Suppress console output during tests unless DEBUG is set
if (!process.env.DEBUG) {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    // Keep warn and error for visibility
    warn: console.warn,
    error: console.error,
  };
}

// Global test utilities
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

// Clean up after all tests
afterAll(async () => {
  // Give any pending async operations time to complete
  await new Promise((resolve) => setTimeout(resolve, 100));
});
