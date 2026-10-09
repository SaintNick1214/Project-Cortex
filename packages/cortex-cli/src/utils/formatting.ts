/**
 * Output Formatting Utilities
 *
 * Handles formatting data for display in various formats:
 * - Table (default, human-readable)
 * - JSON (machine-readable)
 * - CSV (for exports)
 */

import Table from "cli-table3";
import pc from "picocolors";
import ora from "ora";
import { convexToJson } from "convex/values";
import type { OutputFormat, CLIConfig, ValidationResult } from "../types.js";
import { validateAndCleanConfig } from "./config.js";

/**
 * Format data based on the specified format
 */
export function formatOutput(
  data: unknown,
  format: OutputFormat,
  options?: {
    headers?: string[];
    title?: string;
  },
): string {
  switch (format) {
    case "json":
      return formatJSON(data);
    case "csv":
      return formatCSV(data, options?.headers);
    case "table":
    default:
      return formatTable(data, options?.headers, options?.title);
  }
}

/**
 * Format data as JSON
 */
export function formatJSON(data: unknown): string {
  return stringifyJSON(data, 2);
}

function stringifyJSON(data: unknown, space?: number): string {
  return JSON.stringify(data, (_key, value) => {
    if (
      typeof value === "bigint" || value instanceof ArrayBuffer ||
      (typeof value === "number" && (!Number.isFinite(value) || Object.is(value, -0)))
    ) {
      return convexToJson(value);
    }
    return value;
  }, space);
}

/**
 * Format data as CSV
 */
export function formatCSV(data: unknown, headers?: string[]): string {
  if (!Array.isArray(data)) {
    data = [data];
  }

  const rows = data as Record<string, unknown>[];
  if (rows.length === 0) {
    return "";
  }

  // Determine headers from first row if not provided
  const columnHeaders = headers ?? Object.keys(rows[0]);

  // Create CSV content
  const csvRows = [
    columnHeaders.join(","),
    ...rows.map((row) =>
      columnHeaders
        .map((header) => {
          const raw = row[header];
          const value =
            raw !== null && typeof raw === "object"
              ? stringifyJSON(raw)
              : String(raw ?? "");
          // Handle values that need quoting
          if (
            typeof value === "string" &&
            (value.includes(",") ||
              value.includes('"') ||
              value.includes("\n") ||
              value.includes("\r"))
          ) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return String(value ?? "");
        })
        .join(","),
    ),
  ];

  return csvRows.join("\n");
}

/**
 * Format data as a table
 */
export function formatTable(
  data: unknown,
  headers?: string[],
  title?: string,
): string {
  if (!Array.isArray(data)) {
    data = [data];
  }

  const rows = data as Record<string, unknown>[];
  if (rows.length === 0) {
    return pc.dim("No data to display");
  }

  // Determine headers from first row if not provided
  const columnHeaders = headers ?? Object.keys(rows[0]);

  // Create table
  const table = new Table({
    head: columnHeaders.map((h) => pc.cyan(h)),
    style: {
      head: [],
      border: [],
    },
  });

  // Add rows
  for (const row of rows) {
    table.push(
      columnHeaders.map((header) => {
        const value = row[header];
        return formatValue(value);
      }),
    );
  }

  let output = "";
  if (title) {
    output += pc.bold(pc.white(title)) + "\n\n";
  }
  output += table.toString();

  return output;
}

/**
 * Format a single value for display
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return pc.dim("-");
  }

  if (typeof value === "boolean") {
    return value ? pc.green("✓") : pc.red("✗");
  }

  if (typeof value === "number") {
    return pc.yellow(String(value));
  }

  if (value instanceof Date) {
    return formatTimestamp(value.getTime());
  }

  if (typeof value === "object") {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return pc.dim("[]");
      }
      return value.slice(0, 3).join(", ") + (value.length > 3 ? "..." : "");
    }
    return pc.dim("[object]");
  }

  const str = String(value);
  // Truncate long strings
  if (str.length > 50) {
    // For paths, truncate from the beginning to show the important end
    if (str.includes("/") || str.includes("\\")) {
      return "..." + str.substring(str.length - 47);
    }
    return str.substring(0, 47) + "...";
  }
  return str;
}

/**
 * Format a timestamp for display
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

/**
 * Format a relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ago`;
  }
  if (hours > 0) {
    return `${hours}h ago`;
  }
  if (minutes > 0) {
    return `${minutes}m ago`;
  }
  return "just now";
}

/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let unitIndex = 0;
  let size = bytes;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Format a count with proper pluralization
 */
export function formatCount(
  count: number,
  singular: string,
  plural?: string,
): string {
  const word = count === 1 ? singular : (plural ?? `${singular}s`);
  return `${count.toLocaleString()} ${word}`;
}

let diagnosticOptions: {
  format?: string;
  quiet?: boolean;
  secrets?: string[];
} = {};
export function configureDiagnostics(options: typeof diagnosticOptions): void {
  diagnosticOptions = options;
}
export function redactSecrets(message: string): string {
  for (const secret of diagnosticOptions.secrets ?? [])
    if (secret) message = message.split(secret).join("***");
  return message;
}
function diagnostic(message: string): void {
  if (!diagnosticOptions.quiet) console.error(redactSecrets(message));
}

/**
 * Print a success message
 */
export function printSuccess(message: string): void {
  diagnostic(pc.green(`✔ ${message}`));
}

/**
 * Print an error message
 */
export function printError(message: string): void {
  console.error(pc.red(`✖ ${redactSecrets(message)}`));
}

/**
 * Print a warning message
 */
export function printWarning(message: string): void {
  diagnostic(pc.yellow(`⚠ ${message}`));
}

/**
 * Print an info message
 */
export function printInfo(message: string): void {
  diagnostic(pc.blue(`ℹ ${message}`));
}

/**
 * Print a header/title
 */
export function printHeader(title: string): void {
  console.log();
  console.log(pc.bold(pc.white(title)));
  console.log(pc.dim("─".repeat(title.length)));
}

/**
 * Print a key-value pair
 */
export function printKeyValue(key: string, value: unknown): void {
  console.log(`  ${pc.cyan(key)}: ${formatValue(value)}`);
}

/**
 * Print a section with key-value pairs
 */
export function printSection(
  title: string,
  data: Record<string, unknown>,
): void {
  printHeader(title);
  for (const [key, value] of Object.entries(data)) {
    printKeyValue(key, value);
  }
  console.log();
}

/**
 * Print a divider line
 */
export function printDivider(): void {
  console.log(pc.dim("─".repeat(40)));
}

/**
 * Create a simple progress indicator
 */
export function createProgressText(current: number, total: number): string {
  const percentage = Math.round((current / total) * 100);
  const filled = Math.round(percentage / 5);
  const bar = "█".repeat(filled) + "░".repeat(20 - filled);
  return `[${bar}] ${percentage}%`;
}

/**
 * Display notification about cleaned stale config entries
 *
 * Used after observational validation to report retained entries and diagnostics.
 */
export function displayCleanupNotification(validation: ValidationResult): void {
  for (const issue of validation.diagnostics)
    diagnostic(pc.dim(`   ${issue.name}: ${issue.kind} — ${issue.message}`));
}

/** Connectivity diagnostics stay on stderr; never intercept process streams. */
export async function runValidationWithSpinner(
  config: CLIConfig,
  options?: { checkConvex?: boolean; timeout?: number },
): Promise<ValidationResult> {
  const spinner =
    diagnosticOptions.format !== "json" &&
    !diagnosticOptions.quiet &&
    process.stderr.isTTY &&
    (options?.checkConvex ?? true) &&
    Object.keys(config.deployments).length
      ? ora({ text: "Checking deployments...", stream: process.stderr }).start()
      : undefined;
  try {
    return await validateAndCleanConfig(config, options);
  } finally {
    spinner?.stop();
  }
}
