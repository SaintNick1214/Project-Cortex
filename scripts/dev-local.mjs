#!/usr/bin/env node
/**
 * Cross-platform local development script
 * Starts both Convex backend (local mode) and SDK build watcher
 */

import { spawn } from "child_process";
import { ConvexClient } from "convex/browser";

const LOCAL_URL = "http://127.0.0.1:3210";
const VERIFY_TIMEOUT = 5000; // 5 seconds

console.log("\n" + "=".repeat(60));
console.log("  🚀 Starting Local Development Environment");
console.log("=".repeat(60));
console.log("\n📦 Cortex SDK - Local Development Mode");
console.log("\nStarting:");
console.log("  1. Convex Backend (local) - API functions & database");
console.log("  2. SDK Build Watcher - Cortex SDK source compilation");
console.log("\n" + "=".repeat(60) + "\n");

// Start Convex local backend
console.log("🔧 Starting Convex local backend...\n");
const convexProcess = spawn("npx", ["convex", "dev", "--local"], {
  stdio: ["inherit", "pipe", "pipe"],
  shell: true,
});

// Start SDK build watcher
console.log("🔧 Starting SDK build watcher...\n");
const sdkProcess = spawn("npm", ["run", "build:watch"], {
  stdio: ["inherit", "pipe", "pipe"],
  shell: true,
});

// Prefix output for clarity
convexProcess.stdout?.on("data", (data) => {
  process.stdout.write(`[Convex]  ${data}`);
});

convexProcess.stderr?.on("data", (data) => {
  process.stderr.write(`[Convex]  ${data}`);
});

sdkProcess.stdout?.on("data", (data) => {
  process.stdout.write(`[SDK]     ${data}`);
});

sdkProcess.stderr?.on("data", (data) => {
  process.stderr.write(`[SDK]     ${data}`);
});

// Verify Convex connection after startup
setTimeout(async () => {
  try {
    const client = new ConvexClient(LOCAL_URL);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    console.log("\n" + "=".repeat(60));
    console.log("✅ Local Development Environment Ready!");
    console.log("=".repeat(60));
    console.log(`\n📡 Convex Backend: ${LOCAL_URL}`);
    console.log("📦 SDK: Watching for changes...");
    console.log("\n💡 Usage:");
    console.log("   - SDK changes will auto-rebuild");
    console.log("   - Convex function changes will auto-deploy");
    console.log("   - Run tests: npm run test:local");
    console.log("\n" + "=".repeat(60) + "\n");
    
    client.close();
  } catch (error) {
    console.error("\n⚠️  Could not verify Convex connection");
    console.error("   Backend may still be starting up...\n");
  }
}, VERIFY_TIMEOUT);

// Handle cleanup
const cleanup = () => {
  console.log("\n\n🛑 Shutting down local development environment...");
  convexProcess.kill();
  sdkProcess.kill();
  setTimeout(() => process.exit(0), 1000);
};

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

// Monitor process exits
convexProcess.on("exit", (code) => {
  if (code !== 0 && code !== null) {
    console.error(`\n❌ Convex process exited with code ${code}`);
    sdkProcess.kill();
    process.exit(code);
  }
});

sdkProcess.on("exit", (code) => {
  if (code !== 0 && code !== null) {
    console.error(`\n❌ SDK build watcher exited with code ${code}`);
    convexProcess.kill();
    process.exit(code);
  }
});

