/**
 * Shell Execution Utilities
 *
 * Shared utilities for executing shell commands safely.
 * Used by init wizard and other CLI commands.
 */

import { spawn } from "child_process";
import { existsSync } from "fs";
import path from "path";
import { createRequire } from "module";

// Re-export pure functions from shell-utils (for backwards compatibility)
export {
  isValidProjectName,
  isLocalConvexUrl,
  isDirectoryEmpty,
  ALLOWED_COMMANDS,
} from "./shell-utils.js";

import { ALLOWED_COMMANDS } from "./shell-utils.js";

// Create require function for ES modules (named to avoid conflict with Jest's require)
const esmRequire = createRequire(import.meta.url);

/**
 * Check if a command exists in the system
 */
export async function commandExists(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    // Use platform-specific command (which for Unix, where for Windows)
    const cmd = process.platform === "win32" ? "where" : "which";
    const child = spawn(cmd, [command]);
    child.on("close", (code) => resolve(code === 0));
  });
}

/**
 * Execute a shell command and return the output
 *
 * SECURITY: This function only executes commands from an allowlist.
 * User input is NEVER passed as the command parameter.
 */
export async function execCommand(
  command: string,
  args: string[],
  options: { cwd?: string; env?: Record<string, string | undefined>; quiet?: boolean } = {},
): Promise<{ stdout: string; stderr: string; code: number }> {
  // Validate command is from allowlist (defense in depth)
  if (!ALLOWED_COMMANDS.includes(command)) {
    throw new Error(
      `Invalid command: ${command}. Only allowed: ${ALLOWED_COMMANDS.join(", ")}`,
    );
  }

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      const str = data.toString();
      stdout += str;
      if (!options.quiet) {
        process.stdout.write(str);
      }
    });

    child.stderr?.on("data", (data) => {
      const str = data.toString();
      stderr += str;
      if (!options.quiet) {
        process.stderr.write(str);
      }
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      resolve({ stdout, stderr, code: code ?? 1 });
    });
  });
}

/**
 * Execute a command with live output (stdio: inherit)
 *
 * SECURITY: This function only executes commands from an allowlist.
 * User input is NEVER passed as the command parameter.
 */
export async function execCommandLive(
  command: string,
  args: string[],
  options: { cwd?: string; env?: Record<string, string | undefined> } = {},
): Promise<number> {
  // Validate command is from allowlist (defense in depth)
  if (!ALLOWED_COMMANDS.includes(command)) {
    throw new Error(
      `Invalid command: ${command}. Only allowed: ${ALLOWED_COMMANDS.join(", ")}`,
    );
  }

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: "inherit",
      env: { ...process.env, ...options.env },
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      resolve(code ?? 1);
    });
  });
}


/**
 * Get the path to the installed SDK package
 * @param projectPath - Optional project path to look in (defaults to current directory)
 */
export function getSDKPath(projectPath?: string): string | null {
  try {
    // If projectPath provided, look in that project's node_modules
    if (projectPath) {
      const sdkPath = path.join(
        projectPath,
        "node_modules",
        "@cortexmemory",
        "sdk",
      );
      if (existsSync(sdkPath)) {
        return sdkPath;
      }
    }

    // Fallback: use require.resolve from current location
    const sdkPackageJson = esmRequire.resolve("@cortexmemory/sdk/package.json");
    return path.dirname(sdkPackageJson);
  } catch {
    return null;
  }
}


/**
 * Fetch the latest SDK package.json from npm registry
 */
export async function fetchLatestSDKMetadata(): Promise<{
  convexVersion: string;
  sdkVersion: string;
}> {
  try {
    const result = await execCommand(
      "npm",
      [
        "view",
        "@cortexmemory/sdk",
        "peerDependencies.convex",
        "version",
        "--json",
      ],
      { quiet: true },
    );

    if (result.code !== 0) {
      throw new Error(`npm view failed: ${result.stderr}`);
    }

    const data = JSON.parse(result.stdout);

    let convexVersion: string;
    let sdkVersion: string;

    if (typeof data === "string") {
      throw new Error("Unexpected npm view response format");
    } else {
      convexVersion = data["peerDependencies.convex"] || "^1.29.3";
      sdkVersion = data["version"] || "latest";
    }

    return {
      convexVersion,
      sdkVersion,
    };
  } catch {
    // Fallback to safe defaults
    return {
      convexVersion: "^1.29.3",
      sdkVersion: "latest",
    };
  }
}
