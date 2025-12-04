#!/usr/bin/env node

/**
 * Updates dependencies across all packages in the monorepo
 * Usage: node scripts/update-deps.mjs [--dry-run] [--no-install]
 */

import { execSync } from "child_process";
import { readdirSync, statSync } from "fs";
import { join, relative, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const NO_INSTALL = args.includes("--no-install");

// Colors
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
};

const log = (msg, color = "") => console.log(`${color}${msg}${c.reset}`);

function findPackageDirs(dir, results = []) {
  for (const entry of readdirSync(dir)) {
    if (["node_modules", "dist", ".git", "coverage"].includes(entry) || entry.startsWith(".")) continue;
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      findPackageDirs(fullPath, results);
    } else if (entry === "package.json") {
      results.push(dir);
    }
  }
  return results;
}

function run(cmd, cwd) {
  try {
    return execSync(cmd, { cwd, encoding: "utf-8", timeout: 60000, env: { ...process.env, CI: "1" } });
  } catch (e) {
    return e.stdout || "";
  }
}

console.log();
log("╔════════════════════════════════════════════════════════════╗", c.blue);
log("║           Monorepo Dependency Updater                      ║", c.blue);
log("╚════════════════════════════════════════════════════════════╝", c.blue);

if (DRY_RUN) log("\n🔍 DRY RUN MODE", c.yellow);
if (NO_INSTALL) log("⏭️  Skipping npm install", c.yellow);

const packageDirs = findPackageDirs(ROOT);
log(`\nFound ${packageDirs.length} packages\n`, c.bold);

const results = [];

for (const dir of packageDirs) {
  const name = relative(ROOT, dir) || "(root)";
  const ncuCmd = DRY_RUN ? "ncu" : "ncu -u";
  
  log(`📦 ${name}`, c.cyan + c.bold);
  
  const output = run(ncuCmd, dir);
  const updates = output.split("\n").filter(l => l.includes("→") || l.includes("->"));
  
  if (updates.length > 0) {
    updates.forEach(u => log(`   ${u.trim()}`, c.yellow));
    results.push({ name, updates, updated: true });
    
    if (!DRY_RUN && !NO_INSTALL) {
      log("   Installing...", c.dim);
      run("npm install", dir);
      log("   ✓ Done", c.green);
    }
  } else {
    log("   ✓ Up to date", c.green);
    results.push({ name, updates: [], updated: false });
  }
}

// Summary
console.log();
log("════════════════════════════════════════════════════════════", c.blue);
log("                         SUMMARY", c.blue + c.bold);
log("════════════════════════════════════════════════════════════", c.blue);

const updated = results.filter(r => r.updated);
const current = results.filter(r => !r.updated);

if (updated.length > 0) {
  log(`\n📈 Packages updated (${updated.length}):`, c.cyan);
  for (const pkg of updated) {
    log(`\n   ${pkg.name}:`, c.yellow);
    pkg.updates.forEach(u => log(`      ${u.trim()}`, c.dim));
  }
}

if (current.length > 0) {
  log(`\n✅ Already current (${current.length}):`, c.green);
  current.forEach(p => log(`   ${p.name}`, c.dim));
}

console.log();
log(`Total: ${results.length} | Updated: ${updated.length} | Current: ${current.length}`, c.bold);
console.log();
