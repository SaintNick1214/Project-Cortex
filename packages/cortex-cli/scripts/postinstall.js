#!/usr/bin/env node

/**
 * Cortex CLI Postinstall Script
 *
 * Automatically installs shell completion for the cortex CLI.
 * Supports zsh, bash, and fish shells.
 *
 * This script runs after `npm install -g @cortexmemory/cli`
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const home = homedir();

// Marker comments for identifying our additions
const MARKER_START = '# >>> cortex completion >>>';
const MARKER_END = '# <<< cortex completion <<<';

/**
 * Get the completion scripts directory (relative to this script)
 */
function getCompletionsDir() {
  return join(__dirname, 'completions');
}

/**
 * Get the target directory for completion scripts (~/.cortex/completions/)
 */
function getTargetDir() {
  return join(home, '.cortex', 'completions');
}

/**
 * Ensure directory exists
 */
function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Check if a file already contains our completion setup
 */
function hasCompletionSetup(filePath) {
  if (!existsSync(filePath)) {
    return false;
  }
  const content = readFileSync(filePath, 'utf-8');
  return content.includes(MARKER_START);
}

/**
 * Detect the user's shell
 */
function detectShell() {
  const shell = process.env.SHELL || '';
  if (shell.includes('zsh')) return 'zsh';
  if (shell.includes('bash')) return 'bash';
  if (shell.includes('fish')) return 'fish';
  return null;
}

/**
 * Get the shell RC file path
 */
function getShellRcPath(shell) {
  switch (shell) {
    case 'zsh':
      return join(home, '.zshrc');
    case 'bash':
      // Check for .bashrc first, then .bash_profile
      const bashrc = join(home, '.bashrc');
      const bashProfile = join(home, '.bash_profile');
      if (existsSync(bashrc)) return bashrc;
      if (existsSync(bashProfile)) return bashProfile;
      return bashrc; // Default to .bashrc
    case 'fish':
      return join(home, '.config', 'fish', 'config.fish');
    default:
      return null;
  }
}

/**
 * Get the source line for shell RC file
 */
function getSourceLine(shell, targetPath) {
  switch (shell) {
    case 'zsh':
      return `[[ -f "${targetPath}" ]] && source "${targetPath}"`;
    case 'bash':
      return `[[ -f "${targetPath}" ]] && source "${targetPath}"`;
    case 'fish':
      return `test -f "${targetPath}"; and source "${targetPath}"`;
    default:
      return null;
  }
}

/**
 * Install completion for a specific shell
 */
function installCompletion(shell) {
  const completionsDir = getCompletionsDir();
  const targetDir = getTargetDir();

  // Source completion script
  const sourceFile = join(completionsDir, `cortex.${shell}`);
  if (!existsSync(sourceFile)) {
    return false;
  }

  // Ensure target directory exists
  ensureDir(targetDir);

  // Copy completion script to target
  const targetFile = join(targetDir, `cortex.${shell}`);
  copyFileSync(sourceFile, targetFile);

  // Get shell RC file
  const rcPath = getShellRcPath(shell);
  if (!rcPath) {
    return false;
  }

  // Check if already installed
  if (hasCompletionSetup(rcPath)) {
    return true; // Already installed
  }

  // Ensure RC file's parent directory exists (for fish)
  ensureDir(dirname(rcPath));

  // Create RC file if it doesn't exist
  if (!existsSync(rcPath)) {
    writeFileSync(rcPath, '', 'utf-8');
  }

  // Add source line to RC file
  const sourceLine = getSourceLine(shell, targetFile);
  if (!sourceLine) {
    return false;
  }

  const completionBlock = `
${MARKER_START}
${sourceLine}
${MARKER_END}
`;

  appendFileSync(rcPath, completionBlock, 'utf-8');
  return true;
}

/**
 * Main installation function
 */
function main() {
  // Skip if running in CI or non-interactive environment
  if (process.env.CI || process.env.CORTEX_SKIP_COMPLETION) {
    return;
  }

  // Detect shell
  const shell = detectShell();
  if (!shell) {
    // Unknown shell, skip silently
    return;
  }

  try {
    // Install completion for detected shell
    installCompletion(shell);

    // Also try to install for other common shells if their RC files exist
    const otherShells = ['zsh', 'bash', 'fish'].filter(s => s !== shell);
    for (const otherShell of otherShells) {
      const rcPath = getShellRcPath(otherShell);
      if (rcPath && existsSync(rcPath)) {
        installCompletion(otherShell);
      }
    }
  } catch (error) {
    // Silently fail - completion is not critical
    // User can manually run `cortex completion <shell>` if needed
  }
}

main();
