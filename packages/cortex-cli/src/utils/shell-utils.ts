/**
 * Shell Utilities - Pure Functions
 *
 * Pure utility functions that don't require ESM-specific features.
 * Separated for testability with Jest.
 */

import { existsSync, readdirSync } from "fs";

/**
 * Allowlist of safe commands that can be executed
 */
export const ALLOWED_COMMANDS = [
  "npx",
  "convex",
  "npm",
  "pnpm",
  "yarn",
  "bun",
  "git",
  "node",
  "docker",
  // Process inspection commands (for kill menu)
  "lsof",
  "pgrep",
  "ps",
];

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
 * Parse Convex URL to determine if it's local or cloud
 */
export function isLocalConvexUrl(url: string): boolean {
  return url.includes("localhost") || url.includes("127.0.0.1");
}

/** Normalize registry metadata from npm 11's objects and npm 12's arrays. */
export function parseNpmViewJson(output: string): Record<string, string> {
  const parsed: unknown = JSON.parse(output);
  const metadata = Array.isArray(parsed) ? parsed.at(-1) : parsed;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new Error("Unexpected npm view response format");
  }
  return metadata as Record<string, string>;
}
