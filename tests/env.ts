/**
 * Jest Environment Setup
 * Loads environment variables BEFORE test modules are imported
 * This runs via setupFiles (not setupFilesAfterEnv) to ensure
 * environment variables are available during module initialization
 * 
 * Supports dual testing strategy:
 * - LOCAL_CONVEX_* variables: Run tests against local Convex dev server
 * - CONVEX_* variables: Run tests against managed Convex deployment
 * - Both present: Run both test suites (configured via CONVEX_TEST_MODE)
 */

import dotenv from "dotenv";
import { resolve } from "path";

// Load .env.test first (test defaults)
dotenv.config({ path: resolve(process.cwd(), ".env.test") });

// Load .env.local second with override=true (local development overrides for test defaults AND system env vars)
dotenv.config({ path: resolve(process.cwd(), ".env.local"), override: true });

// Determine which Convex deployment to test against
const testMode = process.env.CONVEX_TEST_MODE || "auto"; // "local", "managed", or "auto"
const hasLocalConfig = !!(process.env.LOCAL_CONVEX_URL || process.env.LOCAL_CONVEX_DEPLOYMENT);
const hasManagedConfig = !!(process.env.CONVEX_URL && !process.env.CONVEX_URL.includes("localhost") && !process.env.CONVEX_URL.includes("127.0.0.1"));

// Configure CONVEX_URL based on test mode
if (testMode === "local" || (testMode === "auto" && hasLocalConfig && !hasManagedConfig)) {
  // Use local Convex
  if (process.env.LOCAL_CONVEX_URL) {
    process.env.CONVEX_URL = process.env.LOCAL_CONVEX_URL;
  }
  console.log(`\n🧪 Testing against LOCAL Convex: ${process.env.CONVEX_URL}`);
  console.log(`   Note: Vector search (.similar()) not supported in local mode\n`);
} else if (testMode === "managed" || (testMode === "auto" && hasManagedConfig)) {
  // Use managed Convex (CONVEX_URL already set)
  console.log(`\n🧪 Testing against MANAGED Convex: ${process.env.CONVEX_URL}`);
  console.log(`   Note: Vector search fully supported in managed mode\n`);
} else if (testMode === "auto" && hasLocalConfig) {
  // Default to local if both are present (for backward compatibility)
  if (process.env.LOCAL_CONVEX_URL) {
    process.env.CONVEX_URL = process.env.LOCAL_CONVEX_URL;
  }
  console.log(`\n🧪 Testing against LOCAL Convex: ${process.env.CONVEX_URL}`);
  console.log(`   Tip: Set CONVEX_TEST_MODE=managed to test against managed deployment\n`);
}

// Verify CONVEX_URL is set
if (!process.env.CONVEX_URL) {
  console.error("⚠️  CONVEX_URL not configured");
  console.error("Configure either:");
  console.error("  - LOCAL_CONVEX_URL for local testing");
  console.error("  - CONVEX_URL for managed testing");
  process.exit(1);
}

// Store which deployment type is being tested (used by tests)
process.env.CONVEX_DEPLOYMENT_TYPE = process.env.CONVEX_URL.includes("localhost") || process.env.CONVEX_URL.includes("127.0.0.1") ? "local" : "managed";

