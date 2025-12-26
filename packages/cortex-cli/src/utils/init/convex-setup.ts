/**
 * Convex setup handlers
 *
 * Handles setting up Convex for the init wizard.
 * Supports non-interactive setup using Convex CLI flags.
 */

import fs from "fs-extra";
import path from "path";
import prompts from "prompts";
import { execCommand, execCommandLive, commandExists } from "../shell.js";
import type { ConvexConfig } from "./types.js";
import pc from "picocolors";
import ora from "ora";

// ============================================================================
// Auth Status and Login
// ============================================================================

/**
 * Convex auth status result
 */
export interface ConvexAuthStatus {
  isLoggedIn: boolean;
  teamSlug?: string;
  teamName?: string;
}

/**
 * Check Convex login status and get team information
 *
 * Runs `npx convex login status` and parses the output to determine:
 * - Whether the user is logged in
 * - The team slug (from output like "- Cortex Memory (nicholasgeil)")
 *
 * Note: Convex CLI writes to stderr, so we check both stdout and stderr.
 */
export async function getConvexAuthStatus(): Promise<ConvexAuthStatus> {
  try {
    const { stdout, stderr } = await execCommand(
      "npx",
      ["convex", "login", "status"],
      {
        quiet: true,
      },
    );

    // Convex CLI writes to stderr, so check both
    const output = stdout + stderr;
    const isLoggedIn = output.includes("Status: Logged in");

    // Parse team from output: "- Cortex Memory (nicholasgeil)"
    const teamMatch = output.match(/-\s+(.+?)\s+\(([a-zA-Z0-9_-]+)\)/);

    return {
      isLoggedIn,
      teamSlug: teamMatch?.[2],
      teamName: teamMatch?.[1],
    };
  } catch {
    return { isLoggedIn: false };
  }
}

/**
 * Ensure user is logged in to Convex
 *
 * If not logged in, triggers `npx convex login` which opens browser for OAuth.
 * Returns the team slug after successful login.
 */
export async function ensureConvexAuth(): Promise<ConvexAuthStatus> {
  let status = await getConvexAuthStatus();

  if (!status.isLoggedIn) {
    console.log(pc.yellow("\n   First-time Convex setup requires login"));
    console.log(pc.dim("   A browser window will open for authentication\n"));

    // Trigger login with device name (opens browser automatically)
    const exitCode = await execCommandLive(
      "npx",
      ["convex", "login", "--device-name", "cortex-init"],
      {},
    );

    if (exitCode !== 0) {
      throw new Error("Convex login failed");
    }

    // Re-fetch status to get team slug
    status = await getConvexAuthStatus();

    if (!status.isLoggedIn) {
      throw new Error("Convex login failed - please try again");
    }
  }

  if (status.teamSlug) {
    console.log(
      pc.dim(`   Logged in to team: ${status.teamName} (${status.teamSlug})`),
    );
  }

  return status;
}

// ============================================================================
// Project Name Utilities
// ============================================================================

/**
 * Sanitize project name for Convex
 *
 * - Lowercase
 * - Replace special chars with dashes
 * - Collapse multiple dashes
 * - Truncate to 60 chars (Convex limit is 64, leave room for suffix)
 */
export function sanitizeProjectName(name: string): string {
  let sanitized = name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-") // Replace invalid chars with dash
    .replace(/-+/g, "-") // Collapse multiple dashes
    .replace(/^-|-$/g, ""); // Remove leading/trailing dashes

  // Truncate to 60 chars (Convex limit is 64, leave room for auto-suffix)
  if (sanitized.length > 60) {
    sanitized = sanitized.substring(0, 60);
  }

  return sanitized || "cortex-project";
}

// ============================================================================
// Setup Options
// ============================================================================

/**
 * Options for non-interactive Convex setup
 */
export interface ConvexSetupOptions {
  /** Team slug (from convex login status) */
  teamSlug: string;
  /** Sanitized project name */
  projectName: string;
  /** Use local backend instead of cloud */
  useLocalBackend?: boolean;
}

// ============================================================================
// Setup Functions
// ============================================================================

/**
 * Setup new Convex database (cloud or local)
 *
 * Uses non-interactive flags when options are provided:
 * - `--configure new --team X --project Y`
 * - `--dev-deployment local` for local backend
 */
export async function setupNewConvex(
  projectPath: string,
  options?: ConvexSetupOptions,
): Promise<ConvexConfig> {
  const isLocal = options?.useLocalBackend ?? false;
  const modeLabel = isLocal ? "local" : "cloud";

  console.log(pc.cyan(`\n   Setting up new Convex database (${modeLabel})...`));

  // Clean up any existing Convex state that might interfere
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

  // Build command and args
  const command = hasConvex ? "convex" : "npx";
  let args: string[];

  if (options?.teamSlug && options?.projectName) {
    // Non-interactive mode with all flags
    args = hasConvex
      ? [
          "dev",
          "--once",
          "--configure",
          "new",
          "--team",
          options.teamSlug,
          "--project",
          options.projectName,
        ]
      : [
          "convex",
          "dev",
          "--once",
          "--configure",
          "new",
          "--team",
          options.teamSlug,
          "--project",
          options.projectName,
        ];

    // Add local backend flag if requested
    if (isLocal) {
      args.push("--dev-deployment", "local");
    }

    console.log(pc.dim(`   Project: ${options.projectName}`));
    console.log(pc.dim(`   Team: ${options.teamSlug}`));
    if (isLocal) {
      console.log(pc.dim("   Backend: local"));
    }
    console.log();
  } else {
    // Fallback to interactive mode (legacy behavior)
    args = hasConvex
      ? ["dev", "--once", "--until-success"]
      : ["convex", "dev", "--once", "--until-success"];

    console.log(
      pc.dim("   Running Convex setup (this may prompt for login)..."),
    );
    console.log(
      pc.dim("   Follow the prompts to create your Convex project\n"),
    );
  }

  // Override any inherited Convex env vars
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
  const finalEnvPath = path.join(projectPath, ".env.local");
  let convexUrl = "";
  let deployKey = "";
  let deployment = "";

  try {
    const envContent = await fs.readFile(finalEnvPath, "utf-8");
    const urlMatch = envContent.match(/CONVEX_URL=(.+)/);
    const keyMatch = envContent.match(/CONVEX_DEPLOY_KEY=(.+)/);
    const depMatch = envContent.match(/CONVEX_DEPLOYMENT=([^\s#]+)/);

    if (urlMatch) {
      convexUrl = urlMatch[1].trim();
    }
    if (keyMatch) {
      deployKey = keyMatch[1].trim();
    }
    if (depMatch) {
      deployment = depMatch[1].trim();
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
        value.includes("convex.cloud") ||
        value.includes("convex.site") ||
        value.includes("localhost")
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
    deployment: deployment || undefined,
  };
}

/**
 * Setup with existing Convex database
 *
 * Uses non-interactive flags when options are provided:
 * - `--configure existing --team X --project Y`
 */
export async function setupExistingConvex(
  projectPath?: string,
  options?: Omit<ConvexSetupOptions, "useLocalBackend">,
): Promise<ConvexConfig> {
  console.log(pc.cyan("\n   Configuring existing Convex database..."));

  // If we have options, use non-interactive mode
  if (options?.teamSlug && options?.projectName && projectPath) {
    console.log(pc.dim(`   Project: ${options.projectName}`));
    console.log(pc.dim(`   Team: ${options.teamSlug}\n`));

    const hasConvex = await commandExists("convex");
    const command = hasConvex ? "convex" : "npx";
    const args = hasConvex
      ? [
          "dev",
          "--once",
          "--configure",
          "existing",
          "--team",
          options.teamSlug,
          "--project",
          options.projectName,
        ]
      : [
          "convex",
          "dev",
          "--once",
          "--configure",
          "existing",
          "--team",
          options.teamSlug,
          "--project",
          options.projectName,
        ];

    // Clean env vars
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
      // The Convex CLI already printed the actual error to the console.
      // Throw a generic error - the user has already seen the real reason.
      throw new Error(
        `Convex CLI failed with exit code ${exitCode}. Check the output above for details.`,
      );
    }

    // Read the generated .env.local
    const envLocalPath = path.join(projectPath, ".env.local");
    let convexUrl = "";
    let deployKey = "";
    let deployment = "";

    try {
      const envContent = await fs.readFile(envLocalPath, "utf-8");
      const urlMatch = envContent.match(/CONVEX_URL=(.+)/);
      const keyMatch = envContent.match(/CONVEX_DEPLOY_KEY=(.+)/);
      const depMatch = envContent.match(/CONVEX_DEPLOYMENT=([^\s#]+)/);

      if (urlMatch) convexUrl = urlMatch[1].trim();
      if (keyMatch) deployKey = keyMatch[1].trim();
      if (depMatch) deployment = depMatch[1].trim();
    } catch {
      // File may not exist yet
    }

    console.log(pc.green("\n   Convex database configured"));
    if (convexUrl) {
      console.log(pc.dim(`   URL: ${convexUrl}`));
    }

    return {
      convexUrl,
      deployKey: deployKey || undefined,
      deployment: deployment || undefined,
    };
  }

  // Fallback: Interactive mode (legacy behavior)
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
 * Note: This is now handled by setupNewConvex with useLocalBackend: true
 * Kept for backwards compatibility.
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
  console.log(pc.dim("   This may prompt for configuration on first run\n"));

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
