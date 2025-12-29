/**
 * App Template Sync Utility
 *
 * Syncs template files from the CLI's bundled templates to installed apps.
 * This ensures installed apps can receive updates to components, routes, etc.
 *
 * Similar to schema-sync.ts but for app source files.
 *
 * Files that are NEVER synced (user configuration):
 * - .env.local (user secrets)
 * - node_modules/ (dependencies)
 * - package-lock.json (dependency lock)
 * - .next/ (build output)
 * - convex/_generated/ (generated code)
 *
 * Files that are synced with caution:
 * - package.json (merged, not overwritten - adds missing deps/scripts)
 * - convex/ files (handled separately by schema-sync)
 */

import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { copyFile, mkdir, writeFile } from "fs/promises";
import { createHash } from "crypto";
import { join, dirname, relative } from "path";
import { fileURLToPath } from "url";
import pc from "picocolors";
import type { AppConfig } from "../types.js";

// ES module equivalents of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Files/directories that should NEVER be synced (user data/config)
 */
const NEVER_SYNC = [
  ".env.local",
  ".env",
  "node_modules",
  "package-lock.json",
  ".next",
  ".turbo",
  "convex/_generated",
  ".cortex-app-*.pid",
  ".cortex-app-*.log",
];

/**
 * Files that need special handling (not simple overwrite)
 */
const SPECIAL_HANDLING = [
  "package.json", // Merge dependencies/scripts
  "convex/", // Handled by schema-sync
];

/**
 * Result of template sync operation
 */
export interface TemplateSyncResult {
  /** Whether any files were synced */
  synced: boolean;
  /** List of files that were updated */
  filesUpdated: string[];
  /** List of files that were added (new) */
  filesAdded: string[];
  /** List of files that were skipped (user modified) */
  filesSkipped: string[];
  /** CLI version the template came from */
  cliVersion: string;
  /** Path to the CLI's template folder */
  templatePath: string;
  /** Path to the installed app */
  appPath: string;
  /** Error message if sync failed */
  error?: string;
  /** Whether using development override path */
  isDevOverride?: boolean;
}

/**
 * File comparison result
 */
interface FileComparison {
  relativePath: string;
  templateHash: string;
  appHash: string | null;
  existsInApp: boolean;
  needsUpdate: boolean;
}

/**
 * Find the CLI's template directory
 *
 * Order of precedence:
 * 1. CORTEX_SDK_DEV_PATH/packages/cortex-cli/templates (for CLI development)
 * 2. Relative to this file (installed CLI)
 */
function findTemplatePath(appType: string): string | null {
  // Check for development override first
  const devPath = process.env.CORTEX_SDK_DEV_PATH;
  if (devPath) {
    const devTemplatePath = join(devPath, "packages", "cortex-cli", "templates", appType);
    if (existsSync(devTemplatePath)) {
      return devTemplatePath;
    }
  }

  // Check relative to this file (from dist/utils/)
  const possiblePaths = [
    join(__dirname, "../../templates", appType),
    join(__dirname, "../../../templates", appType),
    join(__dirname, "../../../../templates", appType),
  ];

  for (const tryPath of possiblePaths) {
    if (existsSync(tryPath)) {
      return tryPath;
    }
  }

  return null;
}

/**
 * Get the CLI version from package.json
 */
function getCliVersion(): string {
  try {
    const possiblePaths = [
      join(__dirname, "../../package.json"),
      join(__dirname, "../../../package.json"),
    ];

    for (const tryPath of possiblePaths) {
      if (existsSync(tryPath)) {
        const packageJson = JSON.parse(readFileSync(tryPath, "utf-8"));
        return packageJson.version || "unknown";
      }
    }
    return "unknown";
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
 * Check if a path should be excluded from sync
 */
function shouldExclude(relativePath: string): boolean {
  for (const pattern of NEVER_SYNC) {
    if (pattern.includes("*")) {
      // Simple glob matching for patterns like ".cortex-app-*.pid"
      const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
      if (regex.test(relativePath)) return true;
    } else if (relativePath === pattern || relativePath.startsWith(pattern + "/")) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a path needs special handling
 */
function needsSpecialHandling(relativePath: string): boolean {
  for (const pattern of SPECIAL_HANDLING) {
    if (relativePath === pattern || relativePath.startsWith(pattern)) {
      return true;
    }
  }
  return false;
}

/**
 * Recursively discover all files in a directory
 */
function discoverFiles(
  dirPath: string,
  basePath: string,
  files: string[] = [],
): string[] {
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      const relativePath = relative(basePath, fullPath);

      // Skip excluded paths
      if (shouldExclude(relativePath)) continue;

      if (entry.isDirectory()) {
        discoverFiles(fullPath, basePath, files);
      } else {
        files.push(relativePath);
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  return files;
}

/**
 * Compare template files with installed app files
 */
function compareFiles(
  templatePath: string,
  appPath: string,
  templateFiles: string[],
): FileComparison[] {
  const comparisons: FileComparison[] = [];

  for (const relativePath of templateFiles) {
    const templateFilePath = join(templatePath, relativePath);
    const appFilePath = join(appPath, relativePath);

    const templateHash = getFileHash(templateFilePath);
    const appHash = getFileHash(appFilePath);
    const existsInApp = existsSync(appFilePath);

    // Skip special handling files from direct comparison
    if (needsSpecialHandling(relativePath)) {
      continue;
    }

    if (!templateHash) continue;

    comparisons.push({
      relativePath,
      templateHash,
      appHash,
      existsInApp,
      needsUpdate: !existsInApp || templateHash !== appHash,
    });
  }

  return comparisons;
}

/**
 * Map app type to template directory name
 */
function getTemplateDir(appType: string): string {
  const typeMap: Record<string, string> = {
    "vercel-ai-quickstart": "vercel-ai-quickstart",
  };
  return typeMap[appType] || appType;
}

/**
 * Sync template files to an installed app
 *
 * @param app - App configuration
 * @param options - Sync options
 * @returns Sync result with details about what was updated
 */
export async function syncAppTemplate(
  app: AppConfig,
  options?: {
    /** Only check, don't actually copy files */
    dryRun?: boolean;
    /** Force sync even if files match */
    force?: boolean;
    /** Quiet mode - don't print progress */
    quiet?: boolean;
  },
): Promise<TemplateSyncResult> {
  const appPath = join(app.projectPath, app.path);
  const templateDir = getTemplateDir(app.type);

  const result: TemplateSyncResult = {
    synced: false,
    filesUpdated: [],
    filesAdded: [],
    filesSkipped: [],
    cliVersion: getCliVersion(),
    templatePath: "",
    appPath,
    isDevOverride: false,
  };

  // Check if using development override
  const devPath = process.env.CORTEX_SDK_DEV_PATH;
  result.isDevOverride = !!devPath && existsSync(devPath);

  // Find template path
  const templatePath = findTemplatePath(templateDir);
  if (!templatePath) {
    result.error = `Template not found for app type: ${app.type}`;
    return result;
  }

  result.templatePath = templatePath;

  // Check if app exists
  if (!existsSync(appPath)) {
    result.error = `App not found at: ${appPath}`;
    return result;
  }

  // Discover all template files
  const templateFiles = discoverFiles(templatePath, templatePath);
  if (templateFiles.length === 0) {
    result.error = `No template files found at: ${templatePath}`;
    return result;
  }

  // Compare files
  const comparisons = compareFiles(templatePath, appPath, templateFiles);

  // Filter to files that need updating
  const filesToSync = comparisons.filter((c) => options?.force || c.needsUpdate);

  if (filesToSync.length === 0) {
    return result;
  }

  // Perform sync
  for (const comparison of filesToSync) {
    const templateFilePath = join(templatePath, comparison.relativePath);
    const appFilePath = join(appPath, comparison.relativePath);

    if (!options?.dryRun) {
      // Ensure directory exists
      const dir = dirname(appFilePath);
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }

      // Copy file
      await copyFile(templateFilePath, appFilePath);
    }

    if (comparison.existsInApp) {
      result.filesUpdated.push(comparison.relativePath);
    } else {
      result.filesAdded.push(comparison.relativePath);
    }
    result.synced = true;
  }

  return result;
}

/**
 * Check if template sync is needed (without modifying files)
 */
export async function checkTemplateSync(app: AppConfig): Promise<{
  needsSync: boolean;
  filesOutdated: string[];
  filesMissing: string[];
  cliVersion: string;
  totalTemplateFiles: number;
}> {
  const result = await syncAppTemplate(app, { dryRun: true });

  return {
    needsSync: result.synced,
    filesOutdated: result.filesUpdated,
    filesMissing: result.filesAdded,
    cliVersion: result.cliVersion,
    totalTemplateFiles: result.filesUpdated.length + result.filesAdded.length,
  };
}

/**
 * Print template sync result to console
 */
export function printTemplateSyncResult(
  result: TemplateSyncResult,
  quiet?: boolean,
): void {
  if (quiet) return;

  if (result.error) {
    console.log(pc.red(`   ✗ Template sync failed: ${result.error}`));
    return;
  }

  // Show dev mode indicator
  const devIndicator = result.isDevOverride
    ? pc.magenta(" [DEV OVERRIDE]")
    : "";

  if (!result.synced) {
    const source = result.isDevOverride
      ? `local CLI${devIndicator}`
      : `CLI v${result.cliVersion}`;
    console.log(pc.dim(`   Template files are up to date (${source})`));
    return;
  }

  const source = result.isDevOverride
    ? `local CLI${devIndicator}`
    : `@cortexmemory/cli v${result.cliVersion}`;
  console.log(pc.cyan(`   ↓ Synced template from ${source}`));

  if (result.isDevOverride) {
    console.log(pc.dim(`     Source: ${result.templatePath}`));
  }

  const totalChanges = result.filesUpdated.length + result.filesAdded.length;
  if (totalChanges <= 5) {
    if (result.filesUpdated.length > 0) {
      console.log(pc.dim(`     Updated: ${result.filesUpdated.join(", ")}`));
    }
    if (result.filesAdded.length > 0) {
      console.log(pc.dim(`     Added: ${result.filesAdded.join(", ")}`));
    }
  } else {
    console.log(pc.dim(`     Updated ${result.filesUpdated.length} files, added ${result.filesAdded.length} files`));
  }
}

/**
 * Get a summary of what would be synced
 */
export async function getTemplateSyncSummary(app: AppConfig): Promise<{
  appType: string;
  appPath: string;
  cliVersion: string;
  filesToUpdate: string[];
  filesToAdd: string[];
  totalChanges: number;
  error?: string;
}> {
  const result = await syncAppTemplate(app, { dryRun: true });

  return {
    appType: app.type,
    appPath: join(app.projectPath, app.path),
    cliVersion: result.cliVersion,
    filesToUpdate: result.filesUpdated,
    filesToAdd: result.filesAdded,
    totalChanges: result.filesUpdated.length + result.filesAdded.length,
    error: result.error,
  };
}
