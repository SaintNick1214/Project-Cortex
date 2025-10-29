#!/usr/bin/env node
/**
 * Smart Test Runner
 * Automatically detects available Convex configurations and runs appropriate test suite(s)
 *
 * Behavior:
 * - If only local config present → run local tests
 * - If only managed config present → run managed tests
 * - If both configs present → run BOTH test suites (local then managed)
 * - Respects explicit CONVEX_TEST_MODE override
 */

import { config } from "dotenv";
import { resolve } from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..");

// Load environment files to detect available configs
config({ path: resolve(projectRoot, ".env.test") });
config({ path: resolve(projectRoot, ".env.local"), override: true });

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

// Get additional Jest args passed to this script
const jestArgs = process.argv.slice(2);

/**
 * Run Jest with specific test mode
 */
function runTests(mode) {
  return new Promise((resolvePromise, rejectPromise) => {
    const env = { ...process.env, CONVEX_TEST_MODE: mode };

    const jestPath = resolve(
      projectRoot,
      "node_modules",
      "jest",
      "bin",
      "jest.js",
    );

    // Build command string for shell execution on Windows
    const jestArgsStr = [
      "--testPathIgnorePatterns=debug",
      "--runInBand",
      ...jestArgs,
    ].join(" ");

    const command = `node --experimental-vm-modules "${jestPath}" ${jestArgsStr}`;

    console.log(`\n${"=".repeat(60)}`);
    console.log(`🚀 Running ${mode.toUpperCase()} tests...`);
    console.log(`${"=".repeat(60)}\n`);

    const child = spawn(command, {
      env,
      stdio: "inherit",
      shell: true,
      cwd: projectRoot,
    });

    child.on("close", (code) => {
      if (code === 0) {
        console.log(
          `\n✅ ${mode.toUpperCase()} tests completed successfully\n`,
        );
        resolvePromise();
      } else {
        console.log(
          `\n❌ ${mode.toUpperCase()} tests failed with code ${code}\n`,
        );
        rejectPromise(new Error(`${mode} tests failed`));
      }
    });

    child.on("error", (err) => {
      console.error(`\n❌ Failed to start ${mode} tests:`, err);
      rejectPromise(err);
    });
  });
}

/**
 * Main test orchestration
 */
async function main() {
  console.log("\n🔍 Detecting available Convex configurations...");
  console.log(
    `   Local config: ${hasLocalConfig ? "✅ Found" : "❌ Not found"}`,
  );
  console.log(
    `   Managed config: ${hasManagedConfig ? "✅ Found" : "❌ Not found"}`,
  );
  console.log(`   Test mode: ${testMode}\n`);

  // Handle explicit test mode
  if (testMode === "local") {
    if (!hasLocalConfig) {
      console.error(
        "❌ LOCAL test mode requested but LOCAL_CONVEX_URL not configured",
      );
      process.exit(1);
    }
    await runTests("local");
    return;
  }

  if (testMode === "managed") {
    if (!hasManagedConfig) {
      console.error(
        "❌ MANAGED test mode requested but CONVEX_URL not configured",
      );
      process.exit(1);
    }
    await runTests("managed");
    return;
  }

  // Auto mode: detect and run appropriate test suite(s)
  if (testMode === "auto") {
    if (!hasLocalConfig && !hasManagedConfig) {
      console.error("❌ No Convex configuration found");
      console.error("Configure either:");
      console.error("  - LOCAL_CONVEX_URL for local testing");
      console.error("  - CONVEX_URL for managed testing");
      process.exit(1);
    }

    const testSuites = [];
    if (hasLocalConfig) testSuites.push("local");
    if (hasManagedConfig) testSuites.push("managed");

    if (testSuites.length === 2) {
      console.log("🎯 Both configurations detected - running DUAL TEST SUITE");
      console.log(
        "   Tests will run against both local AND managed environments\n",
      );
    }

    // Run each test suite sequentially
    for (const suite of testSuites) {
      try {
        await runTests(suite);
      } catch (error) {
        console.error(`\n❌ Test suite failed: ${suite}`);
        process.exit(1);
      }
    }

    // All test suites passed
    if (testSuites.length === 2) {
      console.log("\n" + "=".repeat(60));
      console.log("🎉 SUCCESS: All test suites passed!");
      console.log("   ✅ Local tests: PASSED");
      console.log("   ✅ Managed tests: PASSED");
      console.log("=".repeat(60) + "\n");
    }

    return;
  }

  console.error(`❌ Invalid CONVEX_TEST_MODE: ${testMode}`);
  console.error("Valid modes: local, managed, auto");
  process.exit(1);
}

// Run the test orchestrator
main().catch((error) => {
  console.error("❌ Test runner failed:", error);
  process.exit(1);
});
