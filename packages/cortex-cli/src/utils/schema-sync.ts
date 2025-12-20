/**
 * Schema Sync Utility
 *
 * Syncs Convex schema files from @cortexmemory/sdk to the project's convex folder.
 * This ensures the project always has the latest schema that matches the SDK version.
 */

import { existsSync, readFileSync } from "fs";
import { copyFile, mkdir } from "fs/promises";
import { createHash } from "crypto";
import { join, dirname } from "path";
import pc from "picocolors";

/**
 * Result of schema sync operation
 */
export interface SchemaSyncResult {
  /** Whether any files were synced */
  synced: boolean;
  /** List of files that were updated */
  filesUpdated: string[];
  /** List of files that were added (new) */
  filesAdded: string[];
  /** SDK version the schema came from */
  sdkVersion: string;
  /** Path to the SDK's convex-dev folder */
  sdkConvexPath: string;
  /** Path to the project's convex folder */
  projectConvexPath: string;
  /** Error message if sync failed */
  error?: string;
}

/**
 * Files to sync from SDK to project
 * These are the Convex backend files that define the schema and mutations
 */
const SCHEMA_FILES = [
  "schema.ts",
  "a2a.ts",
  "admin.ts",
  "agents.ts",
  "contexts.ts",
  "conversations.ts",
  "facts.ts",
  "governance.ts",
  "graphSync.ts",
  "immutable.ts",
  "memories.ts",
  "memorySpaces.ts",
  "mutable.ts",
  "users.ts",
  "tsconfig.json",
];

/**
 * Find the @cortexmemory/sdk package in the project's node_modules
 */
function findSdkPath(projectPath: string): string | null {
  // Check in project's node_modules
  const directPath = join(projectPath, "node_modules", "@cortexmemory", "sdk");
  if (existsSync(directPath)) {
    return directPath;
  }

  // Walk up the directory tree looking for node_modules
  let currentPath = projectPath;
  while (currentPath !== dirname(currentPath)) {
    const parentModules = join(currentPath, "node_modules", "@cortexmemory", "sdk");
    if (existsSync(parentModules)) {
      return parentModules;
    }
    currentPath = dirname(currentPath);
  }

  return null;
}

/**
 * Get the SDK version from package.json
 */
function getSdkVersion(sdkPath: string): string {
  try {
    const packageJsonPath = join(sdkPath, "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    return packageJson.version || "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Calculate MD5 hash of a file for comparison
 */
function getFileHash(filePath: string): string | null {
  try {
    const content = readFileSync(filePath);
    return createHash("md5").update(content).digest("hex");
  } catch {
    return null;
  }
}

/**
 * Sync Convex schema files from SDK to project
 *
 * @param projectPath - Path to the project root (where convex/ folder should be)
 * @param options - Sync options
 * @returns Sync result with details about what was updated
 */
export async function syncConvexSchema(
  projectPath: string,
  options?: {
    /** Only check, don't actually copy files */
    dryRun?: boolean;
    /** Force sync even if files match */
    force?: boolean;
    /** Quiet mode - don't print progress */
    quiet?: boolean;
  }
): Promise<SchemaSyncResult> {
  const result: SchemaSyncResult = {
    synced: false,
    filesUpdated: [],
    filesAdded: [],
    sdkVersion: "unknown",
    sdkConvexPath: "",
    projectConvexPath: join(projectPath, "convex"),
  };

  // Find SDK package
  const sdkPath = findSdkPath(projectPath);
  if (!sdkPath) {
    result.error = "@cortexmemory/sdk not found in node_modules. Please install it first.";
    return result;
  }

  // Check for convex-dev folder in SDK
  const sdkConvexPath = join(sdkPath, "convex-dev");
  if (!existsSync(sdkConvexPath)) {
    result.error = `SDK convex-dev folder not found at ${sdkConvexPath}. SDK may be outdated.`;
    return result;
  }

  result.sdkConvexPath = sdkConvexPath;
  result.sdkVersion = getSdkVersion(sdkPath);

  // Ensure project's convex folder exists
  if (!existsSync(result.projectConvexPath)) {
    if (!options?.dryRun) {
      await mkdir(result.projectConvexPath, { recursive: true });
    }
  }

  // Compare and sync each file
  for (const fileName of SCHEMA_FILES) {
    const sdkFilePath = join(sdkConvexPath, fileName);
    const projectFilePath = join(result.projectConvexPath, fileName);

    // Skip if SDK doesn't have this file
    if (!existsSync(sdkFilePath)) {
      continue;
    }

    const sdkHash = getFileHash(sdkFilePath);
    const projectHash = getFileHash(projectFilePath);
    const fileExists = existsSync(projectFilePath);

    // Check if file needs updating
    const needsUpdate = options?.force || sdkHash !== projectHash;

    if (needsUpdate) {
      if (!options?.dryRun) {
        await copyFile(sdkFilePath, projectFilePath);
      }

      if (fileExists) {
        result.filesUpdated.push(fileName);
      } else {
        result.filesAdded.push(fileName);
      }
      result.synced = true;
    }
  }

  return result;
}

/**
 * Print schema sync result to console
 */
export function printSyncResult(result: SchemaSyncResult, quiet?: boolean): void {
  if (quiet) return;

  if (result.error) {
    console.log(pc.red(`   ✗ Schema sync failed: ${result.error}`));
    return;
  }

  if (!result.synced) {
    console.log(pc.dim(`   Schema files are up to date (SDK v${result.sdkVersion})`));
    return;
  }

  console.log(pc.cyan(`   ↓ Synced schema from @cortexmemory/sdk v${result.sdkVersion}`));

  if (result.filesUpdated.length > 0) {
    console.log(pc.dim(`     Updated: ${result.filesUpdated.join(", ")}`));
  }

  if (result.filesAdded.length > 0) {
    console.log(pc.dim(`     Added: ${result.filesAdded.join(", ")}`));
  }
}

/**
 * Check if schema sync is needed (without modifying files)
 */
export async function checkSchemaSync(projectPath: string): Promise<{
  needsSync: boolean;
  filesOutdated: string[];
  filesMissing: string[];
  sdkVersion: string;
}> {
  const result = await syncConvexSchema(projectPath, { dryRun: true });

  return {
    needsSync: result.synced,
    filesOutdated: result.filesUpdated,
    filesMissing: result.filesAdded,
    sdkVersion: result.sdkVersion,
  };
}
