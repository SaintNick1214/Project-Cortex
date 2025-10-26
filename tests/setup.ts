/**
 * Jest Setup
 * Loads environment variables before tests run
 */

import dotenv from "dotenv";
import { resolve } from "path";

// Load .env.test for test environment
dotenv.config({ path: resolve(process.cwd(), ".env.test") });

// Verify CONVEX_URL is set
if (!process.env.CONVEX_URL) {
  console.error("⚠️  CONVEX_URL not found in .env.test");
  console.error(
    "Make sure .env.test exists with: CONVEX_URL=http://127.0.0.1:3210",
  );
}

// Global timeout for closing connections
// This ensures Jest exits even if some cleanup is slow
afterAll(() => {
  // Give Convex clients time to close gracefully
  return new Promise((resolve) => setTimeout(resolve, 100));
});
