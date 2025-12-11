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

    const exitCode = await execCommandLive(command, args, { cwd: projectPath });

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
 */
export async function setupLocalConvex(): Promise<ConvexConfig> {
  console.log(pc.cyan("\n   Configuring local Convex..."));
  console.log(
    pc.yellow("   Note: Local Convex does not support vector search"),
  );
  console.log(
    pc.dim(
      "   Use for rapid development, switch to cloud for production features\n",
    ),
  );

  const localUrl = "http://127.0.0.1:3210";

  console.log(pc.green("   Local Convex configured"));
  console.log(pc.dim(`   URL: ${localUrl}`));
  console.log(
    pc.dim("   Deployment will happen automatically in the next step"),
  );

  return {
    convexUrl: localUrl,
    deployment: "anonymous:anonymous-local",
  };
}

/**
 * Deploy Cortex backend functions to Convex
 */
export async function deployToConvex(
  projectPath: string,
  config: ConvexConfig,
  isLocal: boolean = false,
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

    if (isLocal) {
      args.push("--local");
    }

    // Set environment for deployment
    const env: Record<string, string | undefined> = {
      ...process.env,
      CONVEX_URL: config.convexUrl,
      ...(config.deployKey && { CONVEX_DEPLOY_KEY: config.deployKey }),
    };

    // Run convex dev --once with live output (allows interactive prompts)
    const exitCode = await execCommandLive(command, args, {
      cwd: projectPath,
      env,
    });

    if (exitCode !== 0) {
      throw new Error("Failed to deploy Cortex backend");
    }

    console.log(pc.green("\n   Backend deployed to Convex"));
    if (isLocal) {
      console.log(
        pc.dim("   Local Convex is now running at " + config.convexUrl),
      );
    } else {
      console.log(pc.dim("   All functions and schema are deployed"));
    }
  } catch (error) {
    console.error(pc.red("\n   Deployment failed"));
    throw error;
  }
}
