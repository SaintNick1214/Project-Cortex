/**
 * .env File Management Utilities
 *
 * Handles reading, writing, and modifying .env.local files
 */

import { readFile } from "fs/promises";
import { join } from "path";
import { parse as parseDotenv } from "dotenv";
import { atomicPrivateWrite, validateDeploymentName } from "./config.js";
import { validateUrl } from "./validation.js";

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
  /** Parser fragments already contain their original separators. */
  exact?: boolean;
}

export async function parseEnvFile(path: string): Promise<EnvLine[]> {
  let content: string;
  try {
    content = await readFile(path, "utf-8");
  } catch (error) {
    // File doesn't exist - return empty lines (avoids TOCTOU race condition)
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return [];
    }
    throw error;
  }

  // Match the loader's assignment forms and consume complete quoted multiline blocks.
  // Unmatched text remains byte-for-byte raw; embedded KEY= text is never a separate line.
  const assignments =
    /^\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?[ \t]*(?:#.*)?$/gm;
  const lines: EnvLine[] = [];
  const appendRaw = (raw: string) => {
    if (!raw) return;
    lines.push({ type: raw.trim() ? "comment" : "empty", raw, exact: true });
  };
  let cursor = 0;
  for (const match of content.matchAll(assignments)) {
    appendRaw(content.slice(cursor, match.index));
    const matched = match[0];
    const prefix = matched.match(/^\s*/)?.[0] ?? "";
    const body = matched.slice(prefix.length);
    const suffix = body.match(/[\r\n][ \t\r\n]*$/)?.[0] ?? "";
    appendRaw(prefix);
    const raw = suffix ? body.slice(0, -suffix.length) : body;
    const key = match[1];
    const parsed = parseDotenv(raw);
    lines.push({ type: "variable", raw, key, value: parsed[key], exact: true });
    appendRaw(suffix);
    cursor = match.index! + matched.length;
  }
  appendRaw(content.slice(cursor));

  return lines;
}

/**
 * Serialize env lines back to a string
 */
export function serializeEnvFile(lines: EnvLine[]): string {
  return lines
    .map((line) => line.raw)
    .join(lines.some((line) => line.exact) ? "" : "\n");
}

/** Use standard dotenv literals only, proved by the installed loader's pure parser. */
export function serializeEnvAssignment(key: string, value: string): string {
  if (
    !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) ||
    [...value].some((char) => [0, 10, 13].includes(char.charCodeAt(0)))
  )
    throw new Error("Invalid environment variable name/value");
  const candidates = [`${key}=${value}`];
  for (const quote of ["'", '"', "`"])
    if (!value.includes(quote))
      candidates.push(`${key}=${quote}${value}${quote}`);
  for (const candidate of candidates) {
    const parsed = parseDotenv(candidate);
    if (Object.keys(parsed).length === 1 && parsed[key] === value)
      return candidate;
  }
  throw new Error(
    "Cannot save environment value literally with dotenv quoting; choose a value without conflicting quote delimiters",
  );
}

/**
 * Set or update an environment variable in the parsed lines
 */
export function setEnvVar(
  lines: EnvLine[],
  key: string,
  value: string,
): EnvLine[] {
  const raw = serializeEnvAssignment(key, value);
  const exact = lines.some((line) => line.exact);
  const existingIndex = lines.findIndex(
    (line) => line.type === "variable" && line.key === key,
  );
  const newLine: EnvLine = {
    type: "variable",
    raw,
    key,
    value,
    ...(exact ? { exact: true } : {}),
  };
  if (existingIndex >= 0) {
    lines = lines.filter(
      (line, index) =>
        index === existingIndex || line.type !== "variable" || line.key !== key,
    );
    lines[existingIndex] = newLine;
  } else if (exact) {
    const content = serializeEnvFile(lines);
    if (content && !content.endsWith("\n") && !content.endsWith("\r"))
      lines.push({ type: "empty", raw: "\n", exact: true });
    lines.push(newLine, { type: "empty", raw: "\n", exact: true });
  } else {
    let insertIndex = lines.length;
    while (insertIndex > 0 && lines[insertIndex - 1].type === "empty")
      insertIndex--;
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
  validateDeploymentName(name);
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

export interface PreparedEnvUpdate {
  path: string;
  content: string;
}

/** Compute and verify the complete env mutation before any configuration write. */
export async function prepareDeploymentEnvUpdate(
  name: string,
  url: string,
  key?: string,
): Promise<PreparedEnvUpdate> {
  validateUrl(url);
  const path = getEnvLocalPath();
  const envKeys = getDeploymentEnvKeys(name);
  let lines = await parseEnvFile(path);
  lines = setEnvVar(lines, envKeys.urlKey, url);
  lines =
    key !== undefined
      ? setEnvVar(lines, envKeys.keyKey, key)
      : removeEnvVar(lines, envKeys.keyKey);
  const content = serializeEnvFile(lines);
  const parsed = parseDotenv(content);
  if (
    parsed[envKeys.urlKey] !== url ||
    (key === undefined
      ? Object.hasOwn(parsed, envKeys.keyKey)
      : parsed[envKeys.keyKey] !== key)
  )
    throw new Error(
      "Cannot safely update targeted .env.local assignments; inspect their syntax before retrying",
    );
  return { path, content };
}

export async function prepareDeploymentEnvRemoval(
  name: string,
): Promise<PreparedEnvUpdate | null> {
  const path = getEnvLocalPath();
  const envKeys = getDeploymentEnvKeys(name);
  let lines = await parseEnvFile(path);
  if (!lines.length) return null;
  for (const key of [envKeys.urlKey, envKeys.keyKey, envKeys.deploymentKey])
    if (key) lines = removeEnvVar(lines, key);
  const content = serializeEnvFile(lines);
  const parsed = parseDotenv(content);
  if (
    [envKeys.urlKey, envKeys.keyKey, envKeys.deploymentKey].some(
      (key) => key && Object.hasOwn(parsed, key),
    )
  )
    throw new Error(
      "Cannot safely remove targeted .env.local assignments; inspect their syntax before retrying",
    );
  return { path, content };
}

export async function writePreparedEnvUpdate(
  update: PreparedEnvUpdate | null | undefined,
): Promise<void> {
  if (update) await atomicPrivateWrite(update.path, update.content);
}

export async function addDeploymentToEnv(
  name: string,
  url: string,
  key?: string,
): Promise<void> {
  await writePreparedEnvUpdate(
    await prepareDeploymentEnvUpdate(name, url, key),
  );
}

export async function removeDeploymentFromEnv(name: string): Promise<void> {
  await writePreparedEnvUpdate(await prepareDeploymentEnvRemoval(name));
}
