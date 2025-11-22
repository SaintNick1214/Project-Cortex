/**
 * Utility functions for create-cortex-memories
 */

import { spawn } from "child_process";
import { existsSync, readdirSync } from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

// Create require function for ES modules
const require = createRequire(import.meta.url);

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
 * SECURITY: This function is only called with hardcoded commands (npm, convex, etc.)
 * from within the wizard. User input is NEVER passed as the command parameter.
 * Commands are validated from a safe allowlist.
 */
export async function execCommand(
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): Promise<{ stdout: string; stderr: string; code: number }> {
  // Allowlist of safe commands used by the wizard
  const ALLOWED_COMMANDS = ['npx', 'convex', 'npm', 'pnpm', 'yarn', 'bun', 'git', 'node'];
  
  // Validate command is from allowlist (defense in depth)
  if (!ALLOWED_COMMANDS.includes(command)) {
    throw new Error(`Invalid command: ${command}. Only allowed: ${ALLOWED_COMMANDS.join(', ')}`);
  }
  
  return new Promise((resolve, reject) => {
    // semgrep ignore: javascript.lang.security.detect-child-process.detect-child-process
    // Justification: command is validated against allowlist above, not user-controllable
    const child = spawn(command, args, {
      ...options,
      env: { ...process.env, ...options.env },
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
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
 * Execute a command with live output
 * 
 * SECURITY: This function is only called with hardcoded commands (npx, convex, npm, etc.)
 * from within the wizard. User input is NEVER passed as the command parameter.
 * Commands are validated from a safe allowlist.
 */
export async function execCommandLive(
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): Promise<number> {
  // Allowlist of safe commands used by the wizard
  const ALLOWED_COMMANDS = ['npx', 'convex', 'npm', 'pnpm', 'yarn', 'bun', 'git'];
  
  // Validate command is from allowlist (defense in depth)
  if (!ALLOWED_COMMANDS.includes(command)) {
    throw new Error(`Invalid command: ${command}. Only allowed: ${ALLOWED_COMMANDS.join(', ')}`);
  }
  
  return new Promise((resolve, reject) => {
    // semgrep ignore: javascript.lang.security.detect-child-process.detect-child-process
    // Justification: command is validated against allowlist above, not user-controllable
    const child = spawn(command, args, {
      ...options,
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
 * Validate project name
 */
export function isValidProjectName(name: string): boolean {
  return /^[a-z0-9-_]+$/.test(name);
}

/**
 * Check if directory is empty
 */
export function isDirectoryEmpty(dirPath: string): boolean {
  if (!existsSync(dirPath)) {
    return true;
  }
  const files = readdirSync(dirPath);
  return files.length === 0 || (files.length === 1 && files[0] === ".git");
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
    const sdkPackageJson = require.resolve("@cortexmemory/sdk/package.json");
    return path.dirname(sdkPackageJson);
  } catch {
    return null;
  }
}

/**
 * Parse Convex URL to determine if it's local or cloud
 */
export function isLocalConvexUrl(url: string): boolean {
  return url.includes("localhost") || url.includes("127.0.0.1");
}
