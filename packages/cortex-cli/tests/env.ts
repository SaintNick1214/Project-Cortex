/**
 * Jest Environment Setup for CLI Tests
 * Loads environment variables BEFORE test modules are imported
 *
 * Uses the same environment as SDK tests (LOCAL_CONVEX_URL, CONVEX_URL, etc.)
 */

import dotenv from "dotenv";
import { resolve } from "path";

// Load from monorepo root
const rootDir = resolve(process.cwd(), "../..");

// Load .env.test first (test defaults)
dotenv.config({ path: resolve(rootDir, ".env.test") });

// Load .env.local second with override=true (local development overrides)
dotenv.config({ path: resolve(rootDir, ".env.local"), override: true });

// Also try loading from CLI package directory
dotenv.config({ path: resolve(process.cwd(), ".env.test") });
dotenv.config({ path: resolve(process.cwd(), ".env.local"), override: true });

// Determine which Convex deployment to test against
const testMode = process.env.CONVEX_TEST_MODE || "auto";
const hasLocalConfig = Boolean(
  process.env.LOCAL_CONVEX_URL || process.env.LOCAL_CONVEX_DEPLOYMENT,
);
const hasManagedConfig = Boolean(
  process.env.CLOUD_CONVEX_URL ||
    (process.env.CONVEX_URL &&
      !process.env.CONVEX_URL.includes("localhost") &&
      !process.env.CONVEX_URL.includes("127.0.0.1")),
);

// Configure CONVEX_URL based on test mode
if (testMode === "local") {
  if (process.env.LOCAL_CONVEX_URL) {
    process.env.CONVEX_URL = process.env.LOCAL_CONVEX_URL;
  }
  console.log(`\n🔧 CLI Testing against LOCAL Convex: ${process.env.CONVEX_URL}`);
} else if (testMode === "managed") {
  if (process.env.CLOUD_CONVEX_URL) {
    process.env.CONVEX_URL = process.env.CLOUD_CONVEX_URL;
  }
  console.log(`\n🔧 CLI Testing against MANAGED Convex: ${process.env.CONVEX_URL}`);
} else if (testMode === "auto") {
  if (hasLocalConfig && !hasManagedConfig) {
    if (process.env.LOCAL_CONVEX_URL) {
      process.env.CONVEX_URL = process.env.LOCAL_CONVEX_URL;
    }
    console.log(`\n🔧 CLI Testing against LOCAL Convex: ${process.env.CONVEX_URL}`);
  } else if (hasManagedConfig && !hasLocalConfig) {
    if (process.env.CLOUD_CONVEX_URL) {
      process.env.CONVEX_URL = process.env.CLOUD_CONVEX_URL;
    }
    console.log(`\n🔧 CLI Testing against MANAGED Convex: ${process.env.CONVEX_URL}`);
  } else if (hasLocalConfig && hasManagedConfig) {
    if (process.env.LOCAL_CONVEX_URL) {
      process.env.CONVEX_URL = process.env.LOCAL_CONVEX_URL;
    }
    console.log(`\n⚠️  Both local and managed configs detected, using LOCAL`);
  }
}

// Verify CONVEX_URL is set
if (!process.env.CONVEX_URL) {
  console.error("⚠️  CONVEX_URL not configured for CLI tests");
  console.error("Configure either:");
  console.error("  - LOCAL_CONVEX_URL for local testing");
  console.error("  - CONVEX_URL for managed testing");
  process.exit(1);
}

// Store deployment type
process.env.CONVEX_DEPLOYMENT_TYPE =
  process.env.CONVEX_URL.includes("localhost") ||
  process.env.CONVEX_URL.includes("127.0.0.1")
    ? "local"
    : "managed";
