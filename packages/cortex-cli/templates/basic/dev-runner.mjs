#!/usr/bin/env node
/* eslint-disable no-undef */
/**
 * Development runner for Cortex projects
 * Starts Convex in watch mode
 */

import { spawn } from "child_process";
import { config } from "dotenv";
import { existsSync } from "fs";

// Load environment variables
config({ path: ".env.local" });

const CONVEX_URL = process.env.CONVEX_URL || "";
const isLocal =
  CONVEX_URL.includes("localhost") || CONVEX_URL.includes("127.0.0.1");
const hasGraphConfig = process.env.NEO4J_URI || process.env.NEO4J_USERNAME;
const hasDockerCompose = existsSync("./docker-compose.graph.yml");

console.log("🚀 Starting Cortex development environment...\n");

// Start graph database if configured
if (hasGraphConfig && hasDockerCompose) {
  console.log("🕸️  Starting graph database...");

  // First check if Docker daemon is running
  const dockerCheck = spawn("docker", ["info"], { stdio: "pipe" });

  const dockerRunning = await new Promise((resolve) => {
    let stderr = "";
    dockerCheck.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    dockerCheck.on("close", (code) => {
      if (
        code !== 0 &&
        stderr.includes("Cannot connect to the Docker daemon")
      ) {
        console.log("   ❌ Docker is not running");
        console.log("   💡 Start Docker Desktop and run npm run dev again");
        console.log("");
        resolve(false);
      } else {
        resolve(true);
      }
    });

    dockerCheck.on("error", () => {
      console.log("   ⚠️  Docker not installed");
      console.log("   💡 Install: https://docker.com/products/docker-desktop");
      console.log("");
      resolve(false);
    });
  });

  if (!dockerRunning) {
    // Skip graph database startup
  } else {
    // Docker is running, start/restart containers
    // Use 'up -d' which will start existing stopped containers or create new ones
    const dockerUp = spawn(
      "docker-compose",
      ["-f", "docker-compose.graph.yml", "up", "-d", "--remove-orphans"],
      {
        stdio: "pipe",
      },
    );

    await new Promise((resolve) => {
      let stdout = "";
      let stderr = "";

      dockerUp.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      dockerUp.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      dockerUp.on("close", (code) => {
        if (code === 0) {
          // Check if containers started or were already running
          if (stdout.includes("Running") || stdout.includes("Started")) {
            if (stdout.includes("Running")) {
              console.log("   ✓ Graph database already running");
            } else {
              console.log("   ✓ Graph database started");
            }

            if (
              process.env.NEO4J_URI?.includes("neo4j") ||
              stdout.includes("neo4j")
            ) {
              console.log("   Browser: http://localhost:7474");
            } else {
              console.log("   Lab: http://localhost:3000");
            }
          } else {
            console.log("   ✓ Graph database ready");
          }
        } else {
          console.log("   ⚠️  Failed to start graph database");

          // Check common issues
          if (stderr.includes("Cannot connect to the Docker daemon")) {
            console.log("   ❌ Docker is not running");
            console.log("   💡 Start Docker Desktop and try again");
          } else if (
            stderr.includes("already in use") ||
            stderr.includes("Conflict")
          ) {
            console.log(
              "   ⚠️  Container name conflict (old stopped container)",
            );
            console.log("   💡 Fix: docker rm cortex-neo4j cortex-memgraph");
            console.log("   Then run: npm run dev");
          } else if (stderr.includes("already running")) {
            console.log("   ✓ Container already running (that's fine!)");
          } else if (stderr) {
            console.log(
              "   Error:",
              stderr.split("\n").find((l) => l.trim()) || stderr.split("\n")[0],
            );
          }
        }
        resolve();
      });

      dockerUp.on("error", () => {
        console.log("   ⚠️  docker-compose command not found");
        console.log(
          "   💡 Install Docker Desktop: https://docker.com/products/docker-desktop",
        );
        resolve();
      });
    });
    console.log("");
  }
}

if (isLocal) {
  console.log("📝 Mode: LOCAL");
  console.log("🌐 Convex: http://127.0.0.1:3210");
} else {
  console.log("📝 Mode: CLOUD");
  console.log("🌐 Convex:", CONVEX_URL);
}

console.log("\n🔄 Watching for changes...");
console.log("   Press Ctrl+C to stop\n");

// Start Convex dev in watch mode
const args = ["convex", "dev"];

if (isLocal) {
  args.push("--url", "http://127.0.0.1:3210");
}

const child = spawn("npx", args, {
  stdio: "inherit",
  env: process.env,
});

child.on("error", (err) => {
  console.error("❌ Failed to start Convex:", err);
  process.exit(1);
});

child.on("close", (code) => {
  if (code !== 0 && !stopping) {
    // Only show error if we're not intentionally stopping
    console.error(`\n❌ Convex exited unexpectedly with code ${code}`);
    process.exit(code);
  }
});

// Handle Ctrl+C
let stopping = false;
process.on("SIGINT", () => {
  if (stopping) return; // Prevent double execution
  stopping = true;

  console.log("\n\n👋 Stopping development environment...");

  // Kill Convex gracefully
  child.kill("SIGTERM");

  // Stop graph database if it was started
  if (hasGraphConfig && hasDockerCompose) {
    console.log("🕸️  Stopping graph database...");
    const dockerDown = spawn(
      "docker-compose",
      ["-f", "docker-compose.graph.yml", "stop"],
      {
        stdio: "pipe",
      },
    );

    dockerDown.on("close", () => {
      console.log("   ✓ Graph database stopped");
      process.exit(0);
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      console.log("   ⏱️  Timeout - forcing exit");
      process.exit(0);
    }, 5000);
  } else {
    process.exit(0);
  }
});
