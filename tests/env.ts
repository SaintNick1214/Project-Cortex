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
// Note: In auto mode, the test-runner.mjs script handles detection and orchestration
// This file just configures the environment for each individual test run
const testMode = process.env.CONVEX_TEST_MODE || "auto"; // "local", "managed", or "auto"
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
  // Explicit local mode
  if (process.env.LOCAL_CONVEX_URL) {
    process.env.CONVEX_URL = process.env.LOCAL_CONVEX_URL;
  }
  console.log(`\n🧪 Testing against LOCAL Convex: ${process.env.CONVEX_URL}`);
  console.log(
    `   Note: Vector search (.similar()) not supported in local mode\n`,
  );
} else if (testMode === "managed") {
  // Explicit managed mode - prefer CLOUD_CONVEX_URL if set
  if (process.env.CLOUD_CONVEX_URL) {
    process.env.CONVEX_URL = process.env.CLOUD_CONVEX_URL;
  }
  console.log(`\n🧪 Testing against MANAGED Convex: ${process.env.CONVEX_URL}`);
  console.log(`   Note: Vector search fully supported in managed mode\n`);
} else if (testMode === "auto") {
  // Auto mode - detect which config is available
  // Note: If both configs are present, the test-runner.mjs script will run tests twice
  if (hasLocalConfig && !hasManagedConfig) {
    // Only local config present
    if (process.env.LOCAL_CONVEX_URL) {
      process.env.CONVEX_URL = process.env.LOCAL_CONVEX_URL;
    }
    console.log(`\n🧪 Testing against LOCAL Convex: ${process.env.CONVEX_URL}`);
    console.log(
      `   Note: Vector search (.similar()) not supported in local mode\n`,
    );
  } else if (hasManagedConfig && !hasLocalConfig) {
    // Only managed config present - prefer CLOUD_CONVEX_URL if set
    if (process.env.CLOUD_CONVEX_URL) {
      process.env.CONVEX_URL = process.env.CLOUD_CONVEX_URL;
    }
    console.log(
      `\n🧪 Testing against MANAGED Convex: ${process.env.CONVEX_URL}`,
    );
    console.log(`   Note: Vector search fully supported in managed mode\n`);
  } else if (hasLocalConfig && hasManagedConfig) {
    // Both configs present - should not happen if using test-runner.mjs
    // Default to local for backward compatibility if run directly
    if (process.env.LOCAL_CONVEX_URL) {
      process.env.CONVEX_URL = process.env.LOCAL_CONVEX_URL;
    }
    console.log(`\n⚠️  Both local and managed configs detected in auto mode`);
    console.log(
      `   Using LOCAL by default. Use 'npm test' to run both suites.`,
    );
    console.log(`   Or set CONVEX_TEST_MODE=local|managed explicitly.\n`);
  }
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
process.env.CONVEX_DEPLOYMENT_TYPE =
  process.env.CONVEX_URL.includes("localhost") ||
  process.env.CONVEX_URL.includes("127.0.0.1")
    ? "local"
    : "managed";

// ============================================================================
// Graph Database Configuration (Optional)
// ============================================================================
// Load graph database connection settings for graph integration tests

// Check if graph database testing is enabled
const graphTestingEnabled = Boolean(
  process.env.NEO4J_URI || process.env.MEMGRAPH_URI,
);

if (graphTestingEnabled) {
  console.log("\n📊 Graph database testing ENABLED");

  if (process.env.NEO4J_URI) {
    console.log(`   Neo4j: ${process.env.NEO4J_URI}`);
  }

  if (process.env.MEMGRAPH_URI) {
    console.log(`   Memgraph: ${process.env.MEMGRAPH_URI}`);
  }

  console.log();
} else {
  console.log(
    "\n📊 Graph database testing DISABLED (no graph DB URIs configured)",
  );
  console.log("   To enable: Set NEO4J_URI and/or MEMGRAPH_URI in .env.local");
  console.log(
    "   See: Documentation/07-advanced-topics/05-graph-database-setup.md\n",
  );
}

// Store graph testing status for tests
process.env.GRAPH_TESTING_ENABLED = graphTestingEnabled ? "true" : "false";
