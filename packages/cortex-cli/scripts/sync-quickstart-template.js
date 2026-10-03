#!/usr/bin/env node
/**
 * Sync Quickstart Template
 *
 * Copies the Vercel AI quickstart from vercel-ai-provider/quickstart
 * to cortex-cli/templates/vercel-ai-quickstart.
 *
 * This ensures the CLI always has the latest quickstart template
 * without maintaining duplicate files.
 *
 * Run: node scripts/sync-quickstart-template.js
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE = path.join(__dirname, "../../vercel-ai-provider/quickstart");
const DEST = path.join(__dirname, "../templates/vercel-ai-quickstart");

// Files and folders to exclude from copy
const EXCLUDE = [
  "node_modules",
  "package-lock.json",
  ".next",
  ".env.local",
  "tsconfig.tsbuildinfo",
  "coverage",
  "test-results",
  "playwright-report",
];

/**
 * Recursively copy directory, excluding specified patterns
 */
function copyDir(src, dest) {
  // Create destination directory
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    // Skip excluded files/folders
    if (EXCLUDE.includes(entry.name)) {
      continue;
    }

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Recursively remove directory with retries
 * More robust than fs.rmSync for directories with many files
 */
function removeDir(dir) {
  if (!fs.existsSync(dir)) return;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (EXCLUDE.includes(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      removeDir(fullPath);
    } else {
      fs.unlinkSync(fullPath);
    }
  }
  if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
}

/**
 * Main sync function
 */
function sync() {
  // Check if source exists
  if (!fs.existsSync(SOURCE)) {
    console.log(
      "[sync-quickstart] Source not found, skipping (standalone install)",
    );
    console.log(`  Looked for: ${SOURCE}`);
    return;
  }

  console.log("[sync-quickstart] Syncing quickstart template...");
  console.log(`  From: ${SOURCE}`);
  console.log(`  To:   ${DEST}`);

  // Remove existing destination using recursive helper
  if (fs.existsSync(DEST)) {
    removeDir(DEST);
  }

  // Copy files
  copyDir(SOURCE, DEST);

  const manifestPath = path.join(DEST, "package.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.dependencies["@cortexmemory/sdk"] = "file:../../../..";
  manifest.dependencies["@cortexmemory/vercel-ai-provider"] = "file:../../../vercel-ai-provider";
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

  // Keep standalone source installs reproducible after moving the template.
  const sourceLock = path.join(SOURCE, "package-lock.json");
  if (fs.existsSync(sourceLock)) {
    const lock = JSON.parse(fs.readFileSync(sourceLock, "utf8"));
    const rebase = (relativePath) =>
      path.relative(DEST, path.resolve(SOURCE, relativePath)).split(path.sep).join("/");
    lock.packages = Object.fromEntries(
      Object.entries(lock.packages).map(([key, value]) => [
        key && !key.startsWith("node_modules/") ? rebase(key) : key,
        value.link ? { ...value, resolved: rebase(value.resolved) } : value,
      ]),
    );
    lock.packages[""].dependencies = manifest.dependencies;
    lock.packages[""].devDependencies = manifest.devDependencies;
    lock.packages[""].engines = manifest.engines;
    fs.writeFileSync(path.join(DEST, "package-lock.json"), JSON.stringify(lock, null, 2) + "\n");
  }

  // Count files copied
  let fileCount = 0;
  function countFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (EXCLUDE.includes(entry.name)) continue;
      if (entry.isDirectory()) {
        countFiles(path.join(dir, entry.name));
      } else {
        fileCount++;
      }
    }
  }
  countFiles(DEST);

  console.log(`[sync-quickstart] ✓ Copied ${fileCount} files`);
}

// Run
sync();
