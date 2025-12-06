/**
 * .env File Management Utilities
 *
 * Handles reading, writing, and modifying .env.local files
 */

import { readFile, writeFile } from "fs/promises";
import { join } from "path";

/**
 * Get the path to the project's .env.local file
 */
export function getEnvLocalPath(): string {
  return join(process.cwd(), ".env.local");
}

/**
 * Parse a .env file into a Map (preserves order and comments)
 */
export interface EnvLine {
  type: "comment" | "empty" | "variable";
  raw: string;
  key?: string;
  value?: string;
}

export async function parseEnvFile(path: string): Promise<EnvLine[]> {
  let content: string;
  try {
    content = await readFile(path, "utf-8");
  } catch (error) {
    // File doesn't exist - return empty lines (avoids TOCTOU race condition)
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const lines: EnvLine[] = [];

  for (const raw of content.split("\n")) {
    const trimmed = raw.trim();

    if (trimmed === "") {
      lines.push({ type: "empty", raw });
    } else if (trimmed.startsWith("#")) {
      lines.push({ type: "comment", raw });
    } else {
      const match = raw.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (match) {
        lines.push({
          type: "variable",
          raw,
          key: match[1],
          value: match[2],
        });
      } else {
        // Treat malformed lines as comments
        lines.push({ type: "comment", raw });
      }
    }
  }

  return lines;
}

/**
 * Serialize env lines back to a string
 */
export function serializeEnvFile(lines: EnvLine[]): string {
  return lines.map((line) => line.raw).join("\n");
}

/**
 * Set or update an environment variable in the parsed lines
 */
export function setEnvVar(
  lines: EnvLine[],
  key: string,
  value: string,
): EnvLine[] {
  const existingIndex = lines.findIndex(
    (line) => line.type === "variable" && line.key === key,
  );

  const newLine: EnvLine = {
    type: "variable",
    raw: `${key}=${value}`,
    key,
    value,
  };

  if (existingIndex >= 0) {
    lines[existingIndex] = newLine;
  } else {
    // Add at the end, but before any trailing empty lines
    let insertIndex = lines.length;
    while (insertIndex > 0 && lines[insertIndex - 1].type === "empty") {
      insertIndex--;
    }
    lines.splice(insertIndex, 0, newLine);
  }

  return lines;
}

/**
 * Remove an environment variable from the parsed lines
 */
export function removeEnvVar(lines: EnvLine[], key: string): EnvLine[] {
  return lines.filter(
    (line) => !(line.type === "variable" && line.key === key),
  );
}

/**
 * Get the env var keys for a deployment name
 */
export function getDeploymentEnvKeys(name: string): {
  urlKey: string;
  keyKey: string;
  deploymentKey?: string;
} {
  const normalized = name.toLowerCase();

  if (normalized === "local") {
    return {
      urlKey: "LOCAL_CONVEX_URL",
      keyKey: "LOCAL_CONVEX_DEPLOY_KEY",
      deploymentKey: "LOCAL_CONVEX_DEPLOYMENT",
    };
  }

  if (
    normalized === "cloud" ||
    normalized === "production" ||
    normalized === "prod"
  ) {
    return {
      urlKey: "CLOUD_CONVEX_URL",
      keyKey: "CLOUD_CONVEX_DEPLOY_KEY",
    };
  }

  // For custom deployment names, use uppercase with underscores
  const prefix = name.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  return {
    urlKey: `${prefix}_CONVEX_URL`,
    keyKey: `${prefix}_CONVEX_DEPLOY_KEY`,
  };
}

/**
 * Add a deployment to .env.local
 */
export async function addDeploymentToEnv(
  name: string,
  url: string,
  key?: string,
): Promise<void> {
  const envPath = getEnvLocalPath();
  let lines = await parseEnvFile(envPath);

  const envKeys = getDeploymentEnvKeys(name);

  // Set URL
  lines = setEnvVar(lines, envKeys.urlKey, url);

  // Set deploy key if provided
  if (key) {
    lines = setEnvVar(lines, envKeys.keyKey, key);
  }

  await writeFile(envPath, serializeEnvFile(lines), "utf-8");
}

/**
 * Remove a deployment from .env.local
 */
export async function removeDeploymentFromEnv(name: string): Promise<void> {
  const envPath = getEnvLocalPath();

  // parseEnvFile handles non-existent files gracefully (returns empty array)
  // This avoids TOCTOU race condition from using existsSync
  let lines = await parseEnvFile(envPath);

  // If file doesn't exist (empty lines), nothing to remove
  if (lines.length === 0) {
    return;
  }

  const envKeys = getDeploymentEnvKeys(name);

  // Remove all related keys
  lines = removeEnvVar(lines, envKeys.urlKey);
  lines = removeEnvVar(lines, envKeys.keyKey);
  if (envKeys.deploymentKey) {
    lines = removeEnvVar(lines, envKeys.deploymentKey);
  }

  await writeFile(envPath, serializeEnvFile(lines), "utf-8");
}
