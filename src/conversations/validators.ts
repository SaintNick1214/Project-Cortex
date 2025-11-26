/**
 * Conversations API Validation
 *
 * Client-side validation for conversation operations to catch errors before
 * they reach the backend, providing faster feedback and better error messages.
 */

import type { ConversationType, CreateConversationInput } from "../types";

/**
 * Custom error class for conversation validation failures
 */
export class ConversationValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "ConversationValidationError";
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Required Field Validators
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates required string field is non-empty
 */
export function validateRequiredString(
  value: string | undefined,
  fieldName: string,
): void {
  if (!value || typeof value !== "string" || value.trim().length === 0) {
    throw new ConversationValidationError(
      `${fieldName} is required and cannot be empty`,
      "MISSING_REQUIRED_FIELD",
      fieldName,
    );
  }
}

/**
 * Validates conversation type enum
 */
export function validateConversationType(type: string): void {
  if (type !== "user-agent" && type !== "agent-agent") {
    throw new ConversationValidationError(
      `Invalid conversation type "${type}". Must be "user-agent" or "agent-agent"`,
      "INVALID_TYPE",
      "type",
    );
  }
}

/**
 * Validates message role enum
 */
export function validateMessageRole(role: string): void {
  if (role !== "user" && role !== "agent" && role !== "system") {
    throw new ConversationValidationError(
      `Invalid message role "${role}". Must be "user", "agent", or "system"`,
      "INVALID_ROLE",
      "role",
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Format Validators
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates ID format (optional - only if provided by user)
 */
export function validateIdFormat(
  id: string | undefined,
  idType: "conversation" | "message",
  fieldName: string,
): void {
  // ID is optional, skip validation if not provided
  if (id === undefined) {
    return;
  }

  if (typeof id !== "string" || id.trim().length === 0) {
    throw new ConversationValidationError(
      `${fieldName} cannot be empty`,
      "INVALID_ID_FORMAT",
      fieldName,
    );
  }

  // Check for invalid characters (newlines, null bytes)
  if (id.includes("\n") || id.includes("\0")) {
    throw new ConversationValidationError(
      `${fieldName} contains invalid characters`,
      "INVALID_ID_FORMAT",
      fieldName,
    );
  }

  // Check reasonable length
  if (id.length > 500) {
    throw new ConversationValidationError(
      `${fieldName} exceeds maximum length of 500 characters`,
      "INVALID_ID_FORMAT",
      fieldName,
    );
  }
}

/**
 * Validates export format enum
 */
export function validateExportFormat(format: string): void {
  if (format !== "json" && format !== "csv") {
    throw new ConversationValidationError(
      `Invalid export format "${format}". Must be "json" or "csv"`,
      "INVALID_FORMAT",
      "format",
    );
  }
}

/**
 * Validates sort order enum
 */
export function validateSortOrder(order: string | undefined): void {
  // Sort order is optional
  if (order === undefined) {
    return;
  }

  if (order !== "asc" && order !== "desc") {
    throw new ConversationValidationError(
      `Invalid sort order "${order}". Must be "asc" or "desc"`,
      "INVALID_SORT_ORDER",
      "sortOrder",
    );
  }
}

/**
 * Validates search query is non-empty
 */
export function validateSearchQuery(query: string): void {
  if (!query || typeof query !== "string" || query.trim().length === 0) {
    throw new ConversationValidationError(
      "Search query is required and cannot be empty",
      "EMPTY_STRING",
      "query",
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Range/Boundary Validators
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates limit is positive integer
 */
export function validateLimit(
  limit: number | undefined,
  fieldName = "limit",
): void {
  if (limit === undefined) {
    return;
  }

  if (typeof limit !== "number" || !Number.isInteger(limit)) {
    throw new ConversationValidationError(
      `${fieldName} must be an integer`,
      "INVALID_RANGE",
      fieldName,
    );
  }

  if (limit < 1 || limit > 1000) {
    throw new ConversationValidationError(
      `${fieldName} must be between 1 and 1000, got ${limit}`,
      "INVALID_RANGE",
      fieldName,
    );
  }
}

/**
 * Validates offset is non-negative integer
 */
export function validateOffset(
  offset: number | undefined,
  fieldName = "offset",
): void {
  if (offset === undefined) {
    return;
  }

  if (typeof offset !== "number" || !Number.isInteger(offset)) {
    throw new ConversationValidationError(
      `${fieldName} must be an integer`,
      "INVALID_RANGE",
      fieldName,
    );
  }

  if (offset < 0) {
    throw new ConversationValidationError(
      `${fieldName} must be >= 0, got ${offset}`,
      "INVALID_RANGE",
      fieldName,
    );
  }
}

/**
 * Validates array is non-empty when provided
 */
export function validateNonEmptyArray<T>(
  arr: T[] | undefined,
  fieldName: string,
): void {
  if (arr === undefined) {
    return;
  }

  if (!Array.isArray(arr)) {
    throw new ConversationValidationError(
      `${fieldName} must be an array`,
      "INVALID_RANGE",
      fieldName,
    );
  }

  if (arr.length === 0) {
    throw new ConversationValidationError(
      `${fieldName} cannot be empty`,
      "EMPTY_ARRAY",
      fieldName,
    );
  }
}

/**
 * Validates array length constraint
 */
export function validateArrayLength<T>(
  arr: T[],
  min: number,
  max: number | undefined,
  fieldName: string,
): void {
  if (!Array.isArray(arr)) {
    throw new ConversationValidationError(
      `${fieldName} must be an array`,
      "INVALID_ARRAY_LENGTH",
      fieldName,
    );
  }

  if (arr.length < min) {
    throw new ConversationValidationError(
      `${fieldName} must have at least ${min} element${min === 1 ? "" : "s"}, got ${arr.length}`,
      "INVALID_ARRAY_LENGTH",
      fieldName,
    );
  }

  if (max !== undefined && arr.length > max) {
    throw new ConversationValidationError(
      `${fieldName} must have at most ${max} element${max === 1 ? "" : "s"}, got ${arr.length}`,
      "INVALID_ARRAY_LENGTH",
      fieldName,
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Date Range Validators
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates date range (start < end)
 */
export function validateDateRange(
  start: number | undefined,
  end: number | undefined,
): void {
  // Only validate if both provided
  if (start === undefined || end === undefined) {
    return;
  }

  if (typeof start !== "number" || typeof end !== "number") {
    throw new ConversationValidationError(
      "Date range values must be numbers (timestamps)",
      "INVALID_DATE_RANGE",
    );
  }

  if (start >= end) {
    throw new ConversationValidationError(
      "Start date must be before end date",
      "INVALID_DATE_RANGE",
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Business Logic Validators
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates participants structure based on conversation type
 */
export function validateParticipants(
  type: ConversationType,
  participants: CreateConversationInput["participants"],
): void {
  // Use as unknown for defensive runtime check (input could come from untrusted source)
  if (!(participants as unknown)) {
    throw new ConversationValidationError(
      "Participants is required",
      "MISSING_REQUIRED_FIELD",
      "participants",
    );
  }

  if (type === "user-agent") {
    // User-agent conversations require userId
    if (!participants.userId || participants.userId.trim().length === 0) {
      throw new ConversationValidationError(
        "user-agent conversations require userId",
        "INVALID_PARTICIPANTS",
        "participants.userId",
      );
    }
  } else {
    // Agent-agent conversations require memorySpaceIds with at least 2 elements
    if (
      !participants.memorySpaceIds ||
      !Array.isArray(participants.memorySpaceIds)
    ) {
      throw new ConversationValidationError(
        "agent-agent conversations require memorySpaceIds array",
        "INVALID_PARTICIPANTS",
        "participants.memorySpaceIds",
      );
    }

    if (participants.memorySpaceIds.length < 2) {
      throw new ConversationValidationError(
        "agent-agent conversations require at least 2 memorySpaceIds",
        "INVALID_PARTICIPANTS",
        "participants.memorySpaceIds",
      );
    }
  }
}

/**
 * Validates no duplicates in array
 */
export function validateNoDuplicates<T>(arr: T[], fieldName: string): void {
  if (!Array.isArray(arr)) {
    throw new ConversationValidationError(
      `${fieldName} must be an array`,
      "INVALID_RANGE",
      fieldName,
    );
  }

  const seen = new Set<T>();
  const duplicates: T[] = [];

  for (const item of arr) {
    if (seen.has(item)) {
      duplicates.push(item);
    }
    seen.add(item);
  }

  if (duplicates.length > 0) {
    throw new ConversationValidationError(
      `${fieldName} contains duplicate values: ${duplicates.join(", ")}`,
      "DUPLICATE_VALUES",
      fieldName,
    );
  }
}
