#!/usr/bin/env node

/**
 * Cortex CLI Preuninstall Script
 *
 * Removes shell completion configuration when the CLI is uninstalled.
 * Cleans up ~/.cortex/completions/ and removes source lines from shell RC files.
 *
 * This script runs before `npm uninstall -g @cortexmemory/cli`
 */

import { existsSync, readFileSync, writeFileSync, rmSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const home = homedir();

// Marker comments for identifying our additions
const MARKER_START = '# >>> cortex completion >>>';
const MARKER_END = '# <<< cortex completion <<<';

/**
 * Get the target directory for completion scripts (~/.cortex/completions/)
 */
function getTargetDir() {
  return join(home, '.cortex', 'completions');
}

/**
 * Get shell RC file paths to clean up
 */
function getShellRcPaths() {
  return [
    join(home, '.zshrc'),
    join(home, '.bashrc'),
    join(home, '.bash_profile'),
    join(home, '.config', 'fish', 'config.fish'),
  ];
}

/**
 * Remove completion block from a shell RC file
 */
function removeCompletionFromRc(rcPath) {
  if (!existsSync(rcPath)) {
    return;
  }

  const content = readFileSync(rcPath, 'utf-8');

  // Check if our completion setup exists
  if (!content.includes(MARKER_START)) {
    return;
  }

  // Remove the completion block (including markers and content between them)
  const regex = new RegExp(
    `\\n?${escapeRegex(MARKER_START)}[\\s\\S]*?${escapeRegex(MARKER_END)}\\n?`,
    'g'
  );

  const newContent = content.replace(regex, '\n');

  // Write cleaned content back
  writeFileSync(rcPath, newContent, 'utf-8');
}

/**
 * Escape special regex characters
 */
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Remove completion scripts directory
 */
function removeCompletionsDir() {
  const targetDir = getTargetDir();
  if (existsSync(targetDir)) {
    rmSync(targetDir, { recursive: true, force: true });
  }

  // Also remove parent .cortex directory if empty
  const cortexDir = join(home, '.cortex');
  if (existsSync(cortexDir)) {
    try {
      const files = readdirSync(cortexDir);
      if (files.length === 0) {
        rmSync(cortexDir, { recursive: true, force: true });
      }
    } catch {
      // Directory not empty or other error, leave it
    }
  }
}

/**
 * Main uninstall function
 */
function main() {
  // Skip if running in CI
  if (process.env.CI || process.env.CORTEX_SKIP_COMPLETION) {
    return;
  }

  try {
    // Remove completion setup from all shell RC files
    const rcPaths = getShellRcPaths();
    for (const rcPath of rcPaths) {
      removeCompletionFromRc(rcPath);
    }

    // Remove completion scripts directory
    removeCompletionsDir();
  } catch {
    // Silently fail - cleanup is not critical
  }
}

main();
