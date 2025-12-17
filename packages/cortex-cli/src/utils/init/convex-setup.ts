/**
 * Convex setup handlers
 *
 * Handles setting up Convex for the init wizard.
 */

import fs from "fs-extra";
import path from "path";
import prompts from "prompts";
import { execCommandLive, commandExists } from "../shell.js";
import type { ConvexConfig } from "./types.js";
import pc from "picocolors";
import ora from "ora";

// Note: execCommand is not used in this file anymore but keeping ora for setupNewConvex/setupExistingConvex

/**
 * Setup new Convex database (cloud)
 */
export async function setupNewConvex(
  projectPath: string,
): Promise<ConvexConfig> {
  console.log(pc.cyan("\n   Setting up new Convex database..."));

  // Clean up any existing Convex state that might interfere
  // This prevents "DeploymentNotFound" errors from old cached state
  const convexStatePath = path.join(projectPath, ".convex");
  if (await fs.pathExists(convexStatePath)) {
    console.log(pc.dim("   Cleaning up old Convex state..."));
    await fs.remove(convexStatePath);
  }

  // Also clean up .env.local which may have old CONVEX_DEPLOYMENT reference
  const envLocalPath = path.join(projectPath, ".env.local");
  if (await fs.pathExists(envLocalPath)) {
    console.log(pc.dim("   Removing old .env.local (will be recreated)..."));
    await fs.remove(envLocalPath);
  }

  // Check if convex CLI is available
  const hasConvex = await commandExists("convex");

  if (!hasConvex) {
    console.log(pc.yellow("   Convex CLI not found globally, will use npx"));
  }

  const spinner = ora("Initializing Convex...").start();

  try {
    // Run convex dev --once --until-success
    spinner.stop();
    console.log(
      pc.dim("   Running Convex setup (this may prompt for login)..."),
    );
    console.log(
      pc.dim("   Follow the prompts to create your Convex project\n"),
    );

    const command = hasConvex ? "convex" : "npx";
    const args = hasConvex
      ? ["dev", "--once", "--until-success"]
      : ["convex", "dev", "--once", "--until-success"];

    // Override any inherited Convex env vars that might interfere with fresh setup
    // (e.g., from parent directory's .env.local being injected by dotenv)
    // Setting to empty string effectively clears them for the child process
    const cleanConvexEnv = {
      CONVEX_URL: "",
      CONVEX_DEPLOYMENT: "",
      CONVEX_DEPLOY_KEY: "",
    };

    const exitCode = await execCommandLive(command, args, { 
      cwd: projectPath,
      env: cleanConvexEnv,
    });

    if (exitCode !== 0) {
      throw new Error(`Convex setup failed with exit code ${exitCode}`);
    }

    // Read the generated .env.local to get CONVEX_URL
    const envLocalPath = path.join(projectPath, ".env.local");
    let convexUrl = "";
    let deployKey = "";

    try {
      const envContent = await fs.readFile(envLocalPath, "utf-8");
      const urlMatch = envContent.match(/CONVEX_URL=(.+)/);
      const keyMatch = envContent.match(/CONVEX_DEPLOY_KEY=(.+)/);

      if (urlMatch) {
        convexUrl = urlMatch[1].trim();
      }
      if (keyMatch) {
        deployKey = keyMatch[1].trim();
      }
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code !== "ENOENT") {
        throw error;
      }
    }

    if (!convexUrl) {
      // Fallback: prompt user for URL
      const response = await prompts({
        type: "text",
        name: "url",
        message: "Enter your Convex deployment URL:",
        validate: (value) =>
          value.includes("convex.cloud") || value.includes("convex.site")
            ? true
            : "Please enter a valid Convex URL",
      });

      convexUrl = response.url;
    }

    console.log(pc.green("\n   Convex database configured"));
    console.log(pc.dim(`   URL: ${convexUrl}`));

    return {
      convexUrl,
      deployKey: deployKey || undefined,
    };
  } catch (error) {
    spinner.stop();
    throw new Error(`Failed to setup Convex: ${error}`);
  }
}

/**
 * Setup with existing Convex database
 */
export async function setupExistingConvex(): Promise<ConvexConfig> {
  console.log(pc.cyan("\n   Configuring existing Convex database..."));

  const response = await prompts([
    {
      type: "text",
      name: "convexUrl",
      message: "Enter your Convex deployment URL:",
      validate: (value) => {
        if (!value) return "URL is required";
        if (!value.startsWith("http")) return "Please enter a valid URL";
        return true;
      },
    },
    {
      type: "text",
      name: "deployKey",
      message: "Enter your Convex deploy key (optional, press Enter to skip):",
    },
  ]);

  if (!response.convexUrl) {
    throw new Error("Convex URL is required");
  }

  // Validate connection
  const spinner = ora("Validating Convex connection...").start();

  try {
    const isValid =
      response.convexUrl.includes("convex.cloud") ||
      response.convexUrl.includes("convex.site") ||
      response.convexUrl.includes("localhost");

    if (!isValid) {
      spinner.fail("Invalid Convex URL format");
      throw new Error("Invalid Convex URL");
    }

    spinner.succeed("Convex connection validated");
    console.log(pc.dim(`   URL: ${response.convexUrl}`));

    return {
      convexUrl: response.convexUrl,
      deployKey: response.deployKey || undefined,
    };
  } catch (error) {
    spinner.fail("Failed to validate Convex connection");
    throw error;
  }
}

/**
 * Setup local Convex for development
 * 
 * Note: Convex's --local flag requires a cloud project to be set up first.
 * So we create the cloud project during init, then the user can run
 * `cortex start --local` or `convex dev --local` for local development.
 */
export async function setupLocalConvex(): Promise<ConvexConfig> {
  console.log(pc.cyan("\n   Setting up Convex for local development..."));
  console.log(
    pc.yellow("   Note: A Convex cloud project will be created first"),
  );
  console.log(
    pc.dim("   After setup, run 'cortex start --local' for local development"),
  );
  console.log(
    pc.dim("   Local mode: faster iteration, but no vector search\n"),
  );

  // Return empty config - the actual URL will come from convex dev
  return {
    convexUrl: "", // Will be filled in after convex dev runs
  };
}

/**
 * Deploy Cortex backend functions to Convex
 * 
 * Note: We don't use --local flag during init because Convex requires
 * a cloud project to exist first. Users can run --local after setup.
 */
export async function deployToConvex(
  projectPath: string,
  config: ConvexConfig,
  _isLocal: boolean = false, // Ignored - always deploy to cloud first
): Promise<void> {
  console.log(pc.cyan("\n   Deploying Cortex backend to Convex..."));
  console.log(
    pc.dim("   This may prompt for configuration on first run\n"),
  );

  try {
    // Check if convex CLI is available
    const hasConvex = await commandExists("convex");

    // Build command and args based on whether convex is installed globally
    let command: string;
    let args: string[];

    if (hasConvex) {
      command = "convex";
      args = ["dev", "--once", "--until-success"];
    } else {
      command = "npx";
      args = ["convex", "dev", "--once", "--until-success"];
    }

    // Note: We don't add --local here because:
    // 1. Convex requires a cloud project to exist first
    // 2. --local on a fresh project causes "DeploymentNotFound" errors
    // Users can run `cortex start --local` after setup completes

    // Set environment for deployment (only if URL is provided)
    const env: Record<string, string | undefined> = {
      ...process.env,
    };
    
    if (config.convexUrl) {
      env.CONVEX_URL = config.convexUrl;
    }
    if (config.deployKey) {
      env.CONVEX_DEPLOY_KEY = config.deployKey;
    }

    // Run convex dev --once with live output (allows interactive prompts)
    const exitCode = await execCommandLive(command, args, {
      cwd: projectPath,
      env,
    });

    if (exitCode !== 0) {
      throw new Error("Failed to deploy Cortex backend");
    }

    console.log(pc.green("\n   Backend deployed to Convex"));
    console.log(pc.dim("   All functions and schema are deployed"));
  } catch (error) {
    console.error(pc.red("\n   Deployment failed"));
    throw error;
  }
}
