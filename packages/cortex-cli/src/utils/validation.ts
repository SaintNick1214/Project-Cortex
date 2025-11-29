/**
 * Input Validation Utilities
 *
 * Provides validation functions for CLI inputs
 */

import pc from "picocolors";
import type { MemorySpaceType, MemorySpaceStatus, FactType, OutputFormat } from "../types.js";

/**
 * Validation error
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Validate a memory space ID
 */
export function validateMemorySpaceId(id: string): void {
  if (!id || typeof id !== "string") {
    throw new ValidationError("Memory space ID is required");
  }

  if (id.trim().length === 0) {
    throw new ValidationError("Memory space ID cannot be empty");
  }

  if (id.length > 255) {
    throw new ValidationError("Memory space ID is too long (max 255 characters)");
  }

  // Check for valid characters
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new ValidationError(
      "Memory space ID can only contain letters, numbers, underscores, and hyphens",
    );
  }
}

/**
 * Validate a user ID
 */
export function validateUserId(id: string): void {
  if (!id || typeof id !== "string") {
    throw new ValidationError("User ID is required");
  }

  if (id.trim().length === 0) {
    throw new ValidationError("User ID cannot be empty");
  }

  if (id.length > 255) {
    throw new ValidationError("User ID is too long (max 255 characters)");
  }
}

/**
 * Validate a memory ID
 */
export function validateMemoryId(id: string): void {
  if (!id || typeof id !== "string") {
    throw new ValidationError("Memory ID is required");
  }

  if (id.trim().length === 0) {
    throw new ValidationError("Memory ID cannot be empty");
  }
}

/**
 * Validate a conversation ID
 */
export function validateConversationId(id: string): void {
  if (!id || typeof id !== "string") {
    throw new ValidationError("Conversation ID is required");
  }

  if (id.trim().length === 0) {
    throw new ValidationError("Conversation ID cannot be empty");
  }
}

/**
 * Validate a fact ID
 */
export function validateFactId(id: string): void {
  if (!id || typeof id !== "string") {
    throw new ValidationError("Fact ID is required");
  }

  if (id.trim().length === 0) {
    throw new ValidationError("Fact ID cannot be empty");
  }
}

/**
 * Validate memory space type
 */
export function validateMemorySpaceType(type: string): MemorySpaceType {
  const validTypes: MemorySpaceType[] = ["personal", "team", "project", "custom"];
  if (!validTypes.includes(type as MemorySpaceType)) {
    throw new ValidationError(
      `Invalid memory space type: ${type}. Valid types are: ${validTypes.join(", ")}`,
    );
  }
  return type as MemorySpaceType;
}

/**
 * Validate memory space status
 */
export function validateMemorySpaceStatus(status: string): MemorySpaceStatus {
  const validStatuses: MemorySpaceStatus[] = ["active", "archived"];
  if (!validStatuses.includes(status as MemorySpaceStatus)) {
    throw new ValidationError(
      `Invalid memory space status: ${status}. Valid statuses are: ${validStatuses.join(", ")}`,
    );
  }
  return status as MemorySpaceStatus;
}

/**
 * Validate fact type
 */
export function validateFactType(type: string): FactType {
  const validTypes: FactType[] = [
    "preference",
    "identity",
    "knowledge",
    "relationship",
    "event",
    "observation",
    "custom",
  ];
  if (!validTypes.includes(type as FactType)) {
    throw new ValidationError(
      `Invalid fact type: ${type}. Valid types are: ${validTypes.join(", ")}`,
    );
  }
  return type as FactType;
}

/**
 * Validate output format
 */
export function validateOutputFormat(format: string): OutputFormat {
  const validFormats: OutputFormat[] = ["table", "json", "csv"];
  if (!validFormats.includes(format as OutputFormat)) {
    throw new ValidationError(
      `Invalid output format: ${format}. Valid formats are: ${validFormats.join(", ")}`,
    );
  }
  return format as OutputFormat;
}

/**
 * Validate a limit (pagination)
 */
export function validateLimit(limit: number, max = 1000): number {
  if (isNaN(limit) || limit < 1) {
    throw new ValidationError("Limit must be a positive number");
  }
  if (limit > max) {
    throw new ValidationError(`Limit cannot exceed ${max}`);
  }
  return limit;
}

/**
 * Validate a URL
 */
export function validateUrl(url: string): void {
  if (!url || typeof url !== "string") {
    throw new ValidationError("URL is required");
  }

  try {
    new URL(url);
  } catch {
    throw new ValidationError(`Invalid URL: ${url}`);
  }
}

/**
 * Validate file path
 */
export function validateFilePath(path: string): void {
  if (!path || typeof path !== "string") {
    throw new ValidationError("File path is required");
  }

  if (path.trim().length === 0) {
    throw new ValidationError("File path cannot be empty");
  }
}

/**
 * Validate search query
 */
export function validateSearchQuery(query: string): void {
  if (!query || typeof query !== "string") {
    throw new ValidationError("Search query is required");
  }

  if (query.trim().length === 0) {
    throw new ValidationError("Search query cannot be empty");
  }

  if (query.length > 1000) {
    throw new ValidationError("Search query is too long (max 1000 characters)");
  }
}

/**
 * Require confirmation for dangerous operations
 */
export async function requireConfirmation(
  message: string,
  options?: { confirmDangerous?: boolean },
): Promise<boolean> {
  // If confirmDangerous is disabled in config, skip confirmation
  if (options?.confirmDangerous === false) {
    return true;
  }

  // Import prompts dynamically to avoid issues in non-interactive environments
  const prompts = await import("prompts");

  const response = await prompts.default({
    type: "confirm",
    name: "confirmed",
    message: pc.yellow(message),
    initial: false,
  });

  return response.confirmed ?? false;
}

/**
 * Require exact text confirmation for very dangerous operations
 */
export async function requireExactConfirmation(
  expectedText: string,
  message?: string,
): Promise<boolean> {
  const prompts = await import("prompts");

  const response = await prompts.default({
    type: "text",
    name: "confirmation",
    message:
      message ??
      pc.red(
        `This is an irreversible operation. Type "${expectedText}" to confirm:`,
      ),
  });

  return response.confirmation === expectedText;
}

/**
 * Parse array argument from comma-separated string
 */
export function parseArrayArg(value: string): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Parse key-value pairs from "key=value" format
 */
export function parseKeyValueArg(value: string): Record<string, string> {
  if (!value) return {};

  const result: Record<string, string> = {};
  const pairs = value.split(",");

  for (const pair of pairs) {
    const [key, val] = pair.split("=").map((s) => s.trim());
    if (key && val) {
      result[key] = val;
    }
  }

  return result;
}
