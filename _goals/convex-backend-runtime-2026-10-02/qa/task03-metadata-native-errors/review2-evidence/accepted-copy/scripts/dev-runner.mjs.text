#!/usr/bin/env node
/**
 * Smart Development Runner
 * Orchestrates Convex development workflows for local, cloud, or dual-mode operation
 *
 * Usage:
 * - npm run dev          → Auto-detect: starts local if available, otherwise cloud
 * - npm run dev:local    → Local only: starts local Convex + dashboard + SDK
 * - npm run dev:cloud    → Cloud only: connects to managed Convex
 *
 * Features:
 * - Starts Convex dev server (local or connects to cloud)
 * - Opens Convex dashboard automatically
 * - Monitors for changes and hot-reloads
 * - Provides clear console output
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

// Parse command line arguments
const args = process.argv.slice(2);
const explicitMode = args.includes("--local")
  ? "local"
  : args.includes("--cloud")
    ? "cloud"
    : null;

// Detect available configurations
const hasLocalConfig = Boolean(
  process.env.LOCAL_CONVEX_URL || process.env.LOCAL_CONVEX_DEPLOYMENT ||
    process.env.CONVEX_URL?.includes("localhost") ||
    process.env.CONVEX_URL?.includes("127.0.0.1"),
);
const hasCloudConfig = Boolean(
  process.env.CLOUD_CONVEX_URL ||
    (process.env.CONVEX_URL &&
      !process.env.CONVEX_URL.includes("localhost") &&
      !process.env.CONVEX_URL.includes("127.0.0.1")),
);

/**
 * Start Convex dev server
 */
function startConvexDev(mode, useLocal) {
  return new Promise((resolve, reject) => {
    const convexArgs = ["dev", "--once", "--until-success"];

    // Configure deployment URL based on mode
    let deploymentUrl = null;
    if (useLocal) {
      deploymentUrl = process.env.LOCAL_CONVEX_URL ||
      (hasLocalConfig ? process.env.CONVEX_URL : undefined) ||
      "http://127.0.0.1:3210";
      convexArgs.push("--url", deploymentUrl);
    } else {
      // Cloud mode - will use CONVEX_DEPLOYMENT from env
      deploymentUrl = process.env.CLOUD_CONVEX_URL || process.env.CONVEX_URL;
    }

    console.log(`\n${"=".repeat(70)}`);
    console.log(
      `🚀 Starting Convex ${mode.toUpperCase()} development server...`,
    );
    if (deploymentUrl) {
      console.log(`   URL: ${deploymentUrl}`);
    }
    console.log(`${"=".repeat(70)}\n`);

    const child = spawn("npx", ["convex", ...convexArgs], {
      env: process.env,
      stdio: "inherit",
      cwd: projectRoot,
    });

    child.on("error", (err) => {
      console.error(`\n❌ Failed to start Convex ${mode} server:`, err);
      reject(err);
    });

    child.on("close", (code) => {
      if (code === 0) {
        console.log(`\n✅ Convex ${mode.toUpperCase()} server initialized\n`);
        resolve();
      } else {
        console.error(
          `\n❌ Convex ${mode} initialization failed with code ${code}\n`,
        );
        reject(new Error(`Convex dev failed with code ${code}`));
      }
    });
  });
}

/**
 * Open Convex dashboard
 */
function openDashboard(mode, useLocal) {
  return new Promise((resolve) => {
    console.log(`\n📊 Opening Convex ${mode.toUpperCase()} dashboard...\n`);

    const dashboardArgs = ["dashboard"];
    if (useLocal) {
      const deploymentUrl =
        process.env.LOCAL_CONVEX_URL ||
      (hasLocalConfig ? process.env.CONVEX_URL : undefined) ||
      "http://127.0.0.1:3210";
      dashboardArgs.push("--url", deploymentUrl);
    } else {
      dashboardArgs.push("--prod");
    }

    const child = spawn("npx", ["convex", ...dashboardArgs], {
      env: process.env,
      stdio: "inherit",
      cwd: projectRoot,
      detached: false,
    });

    child.on("error", (err) => {
      console.error(`\n⚠️  Failed to open dashboard:`, err);
      console.error("   (Continuing anyway...)\n");
    });

    // Dashboard command returns quickly after opening browser
    setTimeout(() => {
      resolve();
    }, 1000);
  });
}

/**
 * Main development orchestration
 */
async function main() {
  console.log("\n🔍 Detecting available Convex configurations...");
  console.log(
    `   Local config: ${hasLocalConfig ? "✅ Found" : "❌ Not found"}`,
  );
  console.log(
    `   Cloud config: ${hasCloudConfig ? "✅ Found" : "❌ Not found"}`,
  );

  let mode = explicitMode;
  let useLocal = false;

  // Determine mode
  if (explicitMode === "local") {
    if (!hasLocalConfig) {
      console.error("\n❌ LOCAL mode requested but configuration not found");
      console.error("   Add to .env.local:");
      console.error("   LOCAL_CONVEX_URL=http://127.0.0.1:3210");
      console.error(
        "   LOCAL_CONVEX_DEPLOYMENT=anonymous:anonymous-cortex-sdk-local\n",
      );
      process.exit(1);
    }
    mode = "local";
    useLocal = true;
  } else if (explicitMode === "cloud") {
    if (!hasCloudConfig) {
      console.error("\n❌ CLOUD mode requested but configuration not found");
      console.error("   Add to .env.local:");
      console.error("   CLOUD_CONVEX_URL=https://your-deployment.convex.cloud");
      console.error('   CLOUD_CONVEX_DEPLOY_KEY="your-deploy-key"\n');
      process.exit(1);
    }
    mode = "cloud";
    useLocal = false;
  } else {
    // Auto mode: prefer local if available, otherwise cloud
    if (hasLocalConfig) {
      mode = "local";
      useLocal = true;
      console.log("   Mode: AUTO → detected LOCAL configuration\n");
    } else if (hasCloudConfig) {
      mode = "cloud";
      useLocal = false;
      console.log("   Mode: AUTO → detected CLOUD configuration\n");
    } else {
      console.error("\n❌ No Convex configuration found");
      console.error("\nConfigure at least one deployment mode in .env.local:");
      console.error("\n  LOCAL (for development):");
      console.error("    LOCAL_CONVEX_URL=http://127.0.0.1:3210");
      console.error(
        "    LOCAL_CONVEX_DEPLOYMENT=anonymous:anonymous-cortex-sdk-local",
      );
      console.error("\n  CLOUD (for managed deployment):");
      console.error(
        "    CLOUD_CONVEX_URL=https://your-deployment.convex.cloud",
      );
      console.error('    CLOUD_CONVEX_DEPLOY_KEY="your-deploy-key"');
      console.error("\nThen run:");
      console.error("  npm run dev:local   → for local development");
      console.error("  npm run dev:cloud   → for cloud development");
      console.error("  npm run dev         → auto-detect\n");
      process.exit(1);
    }
  }

  console.log(`\n🎯 Starting ${mode.toUpperCase()} development mode...\n`);

  // Set up environment variables for SDK and tests
  if (useLocal) {
    process.env.CONVEX_URL =
      process.env.LOCAL_CONVEX_URL ||
      (hasLocalConfig ? process.env.CONVEX_URL : undefined) ||
      "http://127.0.0.1:3210";
    process.env.CONVEX_DEPLOYMENT = process.env.LOCAL_CONVEX_DEPLOYMENT;
  } else {
    process.env.CONVEX_URL =
      process.env.CLOUD_CONVEX_URL || process.env.CONVEX_URL;
    process.env.CONVEX_DEPLOY_KEY = process.env.CLOUD_CONVEX_DEPLOY_KEY;
  }

  try {
    // Start Convex dev server (runs --once --until-success, then exits)
    await startConvexDev(mode, useLocal);

    // Open dashboard
    await openDashboard(mode, useLocal);

    // Now start Convex dev in watch mode (runs indefinitely)
    console.log("\n" + "=".repeat(70));
    console.log("✨ Starting Convex in watch mode...");
    console.log("=".repeat(70));
    console.log(`\n📝 Mode: ${mode.toUpperCase()}`);
    console.log(`🌐 URL: ${process.env.CONVEX_URL}`);
    console.log("\n💡 Available commands (in another terminal):");
    console.log(
      "   npm run test              → run tests against active deployment",
    );
    console.log("   npm run test:interactive  → interactive test runner");
    console.log("   npm run logs              → view deployment logs");
    if (useLocal) {
      console.log("   npm run dev:cloud         → switch to cloud mode");
    } else {
      console.log("   npm run dev:local         → switch to local mode");
    }
    console.log("\n🔄 Watching for changes...");
    console.log("   Press Ctrl+C to stop\n");

    // Start Convex dev in watch mode (no --once flag)
    const watchArgs = ["dev"];
    if (useLocal) {
      const deploymentUrl =
        process.env.LOCAL_CONVEX_URL ||
      (hasLocalConfig ? process.env.CONVEX_URL : undefined) ||
      "http://127.0.0.1:3210";
      watchArgs.push("--url", deploymentUrl);
    }

    const watchChild = spawn("npx", ["convex", ...watchArgs], {
      env: process.env,
      stdio: "inherit",
      cwd: projectRoot,
    });

    watchChild.on("error", (err) => {
      console.error("\n❌ Convex watch mode failed:", err);
      process.exit(1);
    });

    watchChild.on("close", (code) => {
      console.log(`\n👋 Convex dev stopped with code ${code}\n`);
      process.exit(code || 0);
    });

    // Handle shutdown gracefully
    process.on("SIGINT", () => {
      console.log("\n\n👋 Shutting down development environment...\n");
      watchChild.kill("SIGINT");
      setTimeout(() => process.exit(0), 1000);
    });
  } catch (error) {
    console.error("❌ Development setup failed:", error);
    process.exit(1);
  }
}

// Run the development orchestrator
main().catch((error) => {
  console.error("❌ Dev runner failed:", error);
  process.exit(1);
});
