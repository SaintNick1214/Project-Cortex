/**
 * Jest Environment Setup for CLI Tests
 * Loads environment variables BEFORE test modules are imported
 *
 * Priority for Convex URL:
 *   1. CONVEX_URL_CLI (CLI-dedicated instance, used in CI)
 *   2. CONVEX_URL (fallback for local development)
 *   3. .env.local / .env.test files
 *
 * NOTE: Unit tests don't require CONVEX_URL - only E2E tests do.
 * This file should NOT call process.exit() as it breaks unit tests in CI.
 */

import dotenv from "dotenv";
import { resolve } from "path";

// Note: dotenv@17+ auto-injects env vars on import, so .env files may already be loaded
// by the time this code runs. We need to handle this carefully.

// CLI tests use CONVEX_URL_CLI for dedicated database isolation
// This takes priority over any other CONVEX_URL that may have been set (including from auto-injected .env files)
if (process.env.CONVEX_URL_CLI) {
  process.env.CONVEX_URL = process.env.CONVEX_URL_CLI;
}

// Check if CONVEX_URL is already set (e.g., from CI environment or CONVEX_URL_CLI)
const convexUrlAlreadySet = Boolean(process.env.CONVEX_URL);

// Only try to load .env files if CONVEX_URL is not already set
if (!convexUrlAlreadySet) {
  // Load from monorepo root
  const rootDir = resolve(process.cwd(), "../..");

  // Load .env.test first (test defaults)
  dotenv.config({ path: resolve(rootDir, ".env.test") });

  // Load .env.local second with override=true (local development overrides)
  dotenv.config({ path: resolve(rootDir, ".env.local"), override: true });

  // Also try loading from CLI package directory
  dotenv.config({ path: resolve(process.cwd(), ".env.test") });
  dotenv.config({ path: resolve(process.cwd(), ".env.local"), override: true });
}

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

// Configure CONVEX_URL based on test mode (only if not already set from CI)
if (!convexUrlAlreadySet) {
  if (testMode === "local") {
    if (process.env.LOCAL_CONVEX_URL) {
      process.env.CONVEX_URL = process.env.LOCAL_CONVEX_URL;
    }
  } else if (testMode === "managed") {
    if (process.env.CLOUD_CONVEX_URL) {
      process.env.CONVEX_URL = process.env.CLOUD_CONVEX_URL;
    }
  } else if (testMode === "auto") {
    if (hasLocalConfig && !hasManagedConfig) {
      if (process.env.LOCAL_CONVEX_URL) {
        process.env.CONVEX_URL = process.env.LOCAL_CONVEX_URL;
      }
    } else if (hasManagedConfig && !hasLocalConfig) {
      if (process.env.CLOUD_CONVEX_URL) {
        process.env.CONVEX_URL = process.env.CLOUD_CONVEX_URL;
      }
    } else if (hasLocalConfig && hasManagedConfig) {
      if (process.env.LOCAL_CONVEX_URL) {
        process.env.CONVEX_URL = process.env.LOCAL_CONVEX_URL;
      }
    }
  }
}

// Log configuration (only if CONVEX_URL is set)
if (process.env.CONVEX_URL) {
  const isLocal =
    process.env.CONVEX_URL.includes("localhost") ||
    process.env.CONVEX_URL.includes("127.0.0.1");

  // Store deployment type
  process.env.CONVEX_DEPLOYMENT_TYPE = isLocal ? "local" : "managed";
}

// NOTE: Do NOT call process.exit() here - unit tests don't need CONVEX_URL
// Integration tests will fail naturally if CONVEX_URL is not set when they try to connect
