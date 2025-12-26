#!/usr/bin/env node
/**
 * Flaky Test Investigation Script
 * 
 * Runs memory-openai.test.ts 20 times against ts-sdk-tests Convex project,
 * clearing the database before each run using admin:clearTable (same as CLI).
 * 
 * Usage:
 *   node scripts/test-memory-openai-20x.mjs
 * 
 * Environment:
 *   CONVEX_URL - Set to ts-sdk-tests Convex URL (managed mode required for vector search)
 *   OPENAI_API_KEY - Required for embedding tests
 */

import { spawn, spawnSync } from "child_process";
import { ConvexClient } from "convex/browser";
import * as dotenv from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const rootDir = resolve(__dirname, "..");

// Load environment from ts-sdk-tests or local
dotenv.config({ path: resolve(rootDir, ".env.local"), override: true });

// Allow override via command line
const CONVEX_URL = process.argv[2] || process.env.CONVEX_URL;
const TOTAL_RUNS = 20;
const MAX_LIMIT = 1000;

if (!CONVEX_URL) {
  console.error("❌ CONVEX_URL not set. Please set in .env.local or pass as argument.");
  process.exit(1);
}

if (!process.env.OPENAI_API_KEY) {
  console.error("❌ OPENAI_API_KEY not set. Required for this test.");
  process.exit(1);
}

console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║  FLAKY TEST INVESTIGATION: memory-openai.test.ts                             ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Target: ${CONVEX_URL.padEnd(60)}║
║  Runs:   ${TOTAL_RUNS.toString().padEnd(60)}║
╚══════════════════════════════════════════════════════════════════════════════╝
`);

// Deploy Convex functions first
async function deployConvex() {
  console.log("🚀 Deploying Convex functions...");
  
  const result = spawnSync("npx", ["convex", "deploy", "--yes"], {
    cwd: rootDir,
    env: { 
      ...process.env, 
      CONVEX_DEPLOYMENT: process.env.CONVEX_DEPLOYMENT,
      CONVEX_DEPLOY_KEY: process.env.CLOUD_CONVEX_DEPLOY_KEY || process.env.CONVEX_DEPLOY_KEY
    },
    stdio: ["inherit", "pipe", "pipe"],
    encoding: "utf-8"
  });
  
  if (result.status !== 0) {
    console.error("❌ Failed to deploy Convex functions");
    console.error(result.stderr);
    process.exit(1);
  }
  console.log("   ✅ Deployed successfully");
}

// Create Convex client for clearing database
let client;

async function initClient() {
  client = new ConvexClient(CONVEX_URL);
}

// Clear database using admin:clearTable (same method as CLI)
async function clearDatabase() {
  console.log("🧹 Clearing database using admin:clearTable...");
  
  const tables = [
    "conversations",
    "memories", 
    "facts",
    "contexts",
    "memorySpaces",
    "immutable",
    "mutable",
    "agents",
    "graphSyncQueue",
    "governancePolicies",
    "governanceEnforcement"
  ];
  
  let totalDeleted = 0;
  
  for (const table of tables) {
    try {
      let hasMore = true;
      while (hasMore) {
        const result = await client.mutation("admin:clearTable", { 
          table, 
          limit: MAX_LIMIT 
        });
        totalDeleted += result.deleted;
        hasMore = result.hasMore;
      }
    } catch (e) {
      // Table might not exist or be empty - that's OK
    }
  }
  
  console.log(`   ✅ Cleared ${totalDeleted} records`);
}

function runTest() {
  return new Promise((resolvePromise) => {
    // Run the full test file to ensure prerequisites (stores memories) run first
    // This simulates CI conditions where all tests in file run sequentially
    const testProcess = spawn(
      "node",
      [
        "--experimental-vm-modules",
        "node_modules/jest/bin/jest.js",
        "tests/memory-openai.test.ts",
        "--forceExit",
        "--no-coverage",
        "--runInBand" // Serial execution within file to ensure proper test order
      ],
      {
        cwd: rootDir,
        env: {
          ...process.env,
          CONVEX_URL,
          CONVEX_TEST_MODE: "managed",
          NODE_OPTIONS: "--experimental-vm-modules"
        },
        stdio: ["inherit", "pipe", "pipe"]
      }
    );
    
    let stdout = "";
    let stderr = "";
    
    testProcess.stdout.on("data", (data) => {
      stdout += data.toString();
      // Print live output for visibility
      process.stdout.write(data);
    });
    
    testProcess.stderr.on("data", (data) => {
      stderr += data.toString();
      process.stderr.write(data);
    });
    
    testProcess.on("close", (code) => {
      resolvePromise({
        success: code === 0,
        stdout,
        stderr,
        exitCode: code
      });
    });
  });
}

async function main() {
  // Deploy Convex functions first
  await deployConvex();
  
  // Initialize Convex client
  await initClient();
  
  const results = [];
  const failures = [];
  
  for (let i = 1; i <= TOTAL_RUNS; i++) {
    console.log(`\n${"═".repeat(78)}`);
    console.log(`Run ${i}/${TOTAL_RUNS}`);
    console.log(`${"═".repeat(78)}`);
    
    // Clear database before each run
    await clearDatabase();
    
    // Small delay to ensure Convex is ready
    await new Promise(r => setTimeout(r, 1000));
    
    // Run the test
    console.log("🧪 Running test...");
    const startTime = Date.now();
    const result = await runTest();
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    results.push({
      run: i,
      success: result.success,
      duration,
      exitCode: result.exitCode
    });
    
    if (result.success) {
      console.log(`   ✅ PASSED (${duration}s)`);
    } else {
      console.log(`   ❌ FAILED (${duration}s)`);
      failures.push({
        run: i,
        stdout: result.stdout,
        stderr: result.stderr
      });
      
      // Log failure details
      if (result.stderr) {
        console.log("\n   Error output:");
        const errorLines = result.stderr.split("\n").slice(-15).join("\n");
        console.log(`   ${errorLines.replace(/\n/g, "\n   ")}`);
      }
    }
  }
  
  // Summary
  console.log(`\n${"═".repeat(78)}`);
  console.log("SUMMARY");
  console.log(`${"═".repeat(78)}`);
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`\n   Passed: ${passed}/${TOTAL_RUNS}`);
  console.log(`   Failed: ${failed}/${TOTAL_RUNS}`);
  console.log(`   Pass Rate: ${((passed / TOTAL_RUNS) * 100).toFixed(1)}%`);
  
  if (failed > 0) {
    console.log(`\n   ⚠️  Test is FLAKY - ${failed} failure(s) detected`);
    console.log(`\n   Failed runs: ${failures.map(f => f.run).join(", ")}`);
  } else {
    console.log(`\n   ✅ Test is STABLE - all ${TOTAL_RUNS} runs passed`);
  }
  
  // Timing stats
  const durations = results.map(r => parseFloat(r.duration));
  const avgDuration = (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(1);
  const minDuration = Math.min(...durations).toFixed(1);
  const maxDuration = Math.max(...durations).toFixed(1);
  
  console.log(`\n   Timing:`);
  console.log(`     Average: ${avgDuration}s`);
  console.log(`     Min:     ${minDuration}s`);
  console.log(`     Max:     ${maxDuration}s`);
  
  console.log(`\n${"═".repeat(78)}\n`);
  
  // Close client
  if (client) {
    await client.close();
  }
  
  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("❌ Script failed:", err);
  if (client) {
    await client.close();
  }
  process.exit(1);
});
