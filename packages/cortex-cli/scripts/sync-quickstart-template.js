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

const SOURCE = path.join(
  __dirname,
  "../../vercel-ai-provider/quickstart"
);
const DEST = path.join(__dirname, "../templates/vercel-ai-quickstart");

// Files and folders to exclude from copy
const EXCLUDE = [
  "node_modules",
  "package-lock.json",
  ".next",
  ".env.local",
  "tsconfig.tsbuildinfo",
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
 * Main sync function
 */
function sync() {
  // Check if source exists
  if (!fs.existsSync(SOURCE)) {
    console.log(
      "[sync-quickstart] Source not found, skipping (standalone install)"
    );
    console.log(`  Looked for: ${SOURCE}`);
    return;
  }

  console.log("[sync-quickstart] Syncing quickstart template...");
  console.log(`  From: ${SOURCE}`);
  console.log(`  To:   ${DEST}`);

  // Remove existing destination
  if (fs.existsSync(DEST)) {
    fs.rmSync(DEST, { recursive: true, force: true });
  }

  // Copy files
  copyDir(SOURCE, DEST);

  // Count files copied
  let fileCount = 0;
  function countFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
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
