#!/usr/bin/env node

/**
 * Setup Script for Open WebUI + Cortex Integration
 * Validates environment and guides through setup
 */

import { readFileSync, existsSync } from "fs";
import { execSync } from "child_process";

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const RESET = "\x1b[0m";

function log(msg, color = RESET) {
  console.log(`${color}${msg}${RESET}`);
}

function checkEnvFile() {
  log("\n📝 Checking environment configuration...", BLUE);

  const envFiles = [".env.local", ".env"];
  let envFile = null;

  for (const file of envFiles) {
    if (existsSync(file)) {
      envFile = file;
      log(`   ✅ Found: ${file}`, GREEN);
      break;
    }
  }

  if (!envFile) {
    log("   ❌ No environment file found!", RED);
    log("\n   Please create .env.local:", YELLOW);
    log("   cp env.local.template .env.local", YELLOW);
    log(
      "   Then edit .env.local with your CONVEX_URL and OPENAI_API_KEY\n",
      YELLOW,
    );
    return false;
  }

  // Check required variables
  const env = readFileSync(envFile, "utf8");
  const required = ["CONVEX_URL", "OPENAI_API_KEY"];
  const missing = [];

  for (const key of required) {
    const regex = new RegExp(`^${key}=.+`, "m");
    if (!regex.test(env) || env.match(regex)[0].endsWith("=")) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    log(`   ⚠️  Missing required variables:`, YELLOW);
    missing.forEach((key) => log(`      - ${key}`, YELLOW));
    log(`\n   Please edit ${envFile} and set these variables\n`, YELLOW);
    return false;
  }

  log("   ✅ All required variables set", GREEN);
  return true;
}

function checkDocker() {
  log("\n🐳 Checking Docker...", BLUE);

  try {
    execSync("docker --version", { stdio: "ignore" });
    log("   ✅ Docker installed", GREEN);
  } catch (error) {
    log("   ❌ Docker not found!", RED);
    log(
      "   Please install Docker Desktop: https://www.docker.com/products/docker-desktop\n",
      YELLOW,
    );
    return false;
  }

  try {
    execSync("docker compose version", { stdio: "ignore" });
    log("   ✅ Docker Compose available", GREEN);
  } catch (error) {
    log("   ⚠️  Docker Compose not found (trying docker-compose...)", YELLOW);
    try {
      execSync("docker-compose --version", { stdio: "ignore" });
      log("   ✅ docker-compose (v1) available", GREEN);
    } catch (e) {
      log("   ❌ Docker Compose not available!", RED);
      return false;
    }
  }

  return true;
}

function checkConvex() {
  log("\n🔗 Checking Convex deployment...", BLUE);

  const envFile = existsSync(".env.local") ? ".env.local" : ".env";
  if (!existsSync(envFile)) {
    log("   ⚠️  Cannot check without environment file", YELLOW);
    return true;
  }

  const env = readFileSync(envFile, "utf8");
  const convexUrl = env.match(/^CONVEX_URL=(.+)$/m)?.[1];

  if (convexUrl && convexUrl !== "https://your-deployment.convex.cloud") {
    log(`   ✅ Convex URL configured: ${convexUrl}`, GREEN);

    // Check if local
    if (convexUrl.includes("127.0.0.1") || convexUrl.includes("localhost")) {
      log("   ℹ️  Using LOCAL Convex deployment", BLUE);
      log(
        "   Make sure Convex is running: npm run dev (in convex-dev/)",
        YELLOW,
      );
    } else {
      log("   ℹ️  Using CLOUD Convex deployment", BLUE);
    }
  } else {
    log("   ⚠️  CONVEX_URL not configured", YELLOW);
    log("   Deploy Convex schema first:", YELLOW);
    log("   cd ../../convex-dev && npx convex deploy --prod\n", YELLOW);
    return false;
  }

  return true;
}

function printNextSteps() {
  log("\n========================================", GREEN);
  log("✅ Setup Complete!", GREEN);
  log("========================================\n", GREEN);

  log("Next steps:\n");
  log("1. Start the Cortex Bridge:", BLUE);
  log("   npm run deploy", YELLOW);
  log("");
  log("2. Check if it's running:", BLUE);
  log("   npm run health", YELLOW);
  log("");
  log("3. View logs:", BLUE);
  log("   npm run logs", YELLOW);
  log("");
  log("4. Run examples:", BLUE);
  log("   npm run test:basic", YELLOW);
  log("   npm run test:multi-agent", YELLOW);
  log("   npm run test:all", YELLOW);
  log("");
  log("5. Stop when done:", BLUE);
  log("   npm run stop", YELLOW);
  log("");
}

// Main
console.log("\n🚀 Open WebUI + Cortex Integration Setup\n");

let allGood = true;

allGood = checkEnvFile() && allGood;
allGood = checkDocker() && allGood;
allGood = checkConvex() && allGood;

if (allGood) {
  printNextSteps();
} else {
  log(
    "\n❌ Setup incomplete. Please fix the issues above and try again.\n",
    RED,
  );
  process.exit(1);
}
