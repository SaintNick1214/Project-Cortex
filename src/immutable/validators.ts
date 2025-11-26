/**
 * Immutable API Validation
 *
 * Client-side validation for immutable operations to catch errors before
 * they reach the backend, providing faster feedback and better error messages.
 */

import type {
  ImmutableEntry,
  ListImmutableFilter,
  SearchImmutableInput,
  CountImmutableFilter,
} from "../types";

/**
 * Custom error class for immutable validation failures
 */
export class ImmutableValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "ImmutableValidationError";
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Basic Field Validation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates type string is non-empty and valid format
 * Runtime checks for potentially untrusted external input
 */
export function validateType(type: string, fieldName = "type"): void {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (type === undefined || type === null) {
    throw new ImmutableValidationError(
      `Type is required`,
      "MISSING_REQUIRED_FIELD",
      fieldName,
    );
  }

  if (typeof type !== "string" || type.trim().length === 0) {
    throw new ImmutableValidationError(
      `Type must be a non-empty string`,
      "INVALID_TYPE",
      fieldName,
    );
  }

  // Only allow alphanumeric, dash, underscore, dot
  const typeRegex = /^[a-zA-Z0-9_.-]+$/;
  if (!typeRegex.test(type)) {
    throw new ImmutableValidationError(
      `${fieldName} must contain only valid characters (alphanumeric, dash, underscore, dot), got "${type}"`,
      "INVALID_TYPE",
      fieldName,
    );
  }
}

/**
 * Validates ID string is non-empty
 * Runtime checks for potentially untrusted external input
 */
export function validateId(id: string, fieldName = "id"): void {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (id === undefined || id === null) {
    throw new ImmutableValidationError(
      `ID is required`,
      "MISSING_REQUIRED_FIELD",
      fieldName,
    );
  }

  if (typeof id !== "string" || id.trim().length === 0) {
    throw new ImmutableValidationError(
      `ID must be a non-empty string`,
      "INVALID_ID",
      fieldName,
    );
  }
}

/**
 * Validates data is a valid object
 * Runtime checks for potentially untrusted external input
 */
export function validateData(
  data: Record<string, unknown>,
  fieldName = "data",
): void {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (data === null || data === undefined) {
    throw new ImmutableValidationError(
      `Data is required`,
      "MISSING_REQUIRED_FIELD",
      fieldName,
    );
  }

  if (typeof data !== "object" || Array.isArray(data)) {
    throw new ImmutableValidationError(
      `Data must be a valid object`,
      "INVALID_DATA",
      fieldName,
    );
  }
}

/**
 * Validates metadata is object or undefined
 */
export function validateMetadata(
  metadata: Record<string, unknown> | undefined,
  fieldName = "metadata",
): void {
  if (metadata === undefined) {
    return; // undefined is OK
  }

  // Runtime validation - metadata could be null or array from external sources
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (
    typeof metadata !== "object" ||
    metadata === null ||
    Array.isArray(metadata)
  ) {
    throw new ImmutableValidationError(
      `Metadata must be an object`,
      "INVALID_METADATA",
      fieldName,
    );
  }
}

/**
 * Validates userId is string or undefined, non-empty if provided
 */
export function validateUserId(
  userId: string | undefined,
  fieldName = "userId",
): void {
  if (userId === undefined) {
    return; // undefined is OK
  }

  if (typeof userId !== "string" || userId.trim().length === 0) {
    throw new ImmutableValidationError(
      `${fieldName} cannot be empty if provided`,
      "MISSING_REQUIRED_FIELD",
      fieldName,
    );
  }
}

/**
 * Validates version is positive integer >= 1
 */
export function validateVersion(version: number, fieldName = "version"): void {
  if (typeof version !== "number" || isNaN(version) || version < 1) {
    throw new ImmutableValidationError(
      `Version must be a positive integer >= 1`,
      "INVALID_VERSION",
      fieldName,
    );
  }

  if (!Number.isInteger(version)) {
    throw new ImmutableValidationError(
      `Version must be a positive integer`,
      "INVALID_VERSION",
      fieldName,
    );
  }
}

/**
 * Validates timestamp is valid number or Date
 */
export function validateTimestamp(
  timestamp: number | Date,
  fieldName = "timestamp",
): void {
  if (timestamp instanceof Date) {
    if (isNaN(timestamp.getTime())) {
      throw new ImmutableValidationError(
        `Timestamp must be a valid Date object`,
        "INVALID_TIMESTAMP",
        fieldName,
      );
    }
    return;
  }

  if (typeof timestamp !== "number" || isNaN(timestamp) || timestamp < 0) {
    throw new ImmutableValidationError(
      `Timestamp must be a valid Date object or positive number`,
      "INVALID_TIMESTAMP",
      fieldName,
    );
  }
}

/**
 * Validates limit is positive integer or undefined
 */
export function validateLimit(
  limit: number | undefined,
  fieldName = "limit",
): void {
  if (limit === undefined) {
    return; // undefined is OK
  }

  if (
    typeof limit !== "number" ||
    isNaN(limit) ||
    limit < 1 ||
    !Number.isInteger(limit)
  ) {
    throw new ImmutableValidationError(
      `Limit must be a positive integer`,
      "INVALID_LIMIT",
      fieldName,
    );
  }
}

/**
 * Validates keepLatest is positive integer >= 1
 */
export function validateKeepLatest(
  keepLatest: number,
  fieldName = "keepLatest",
): void {
  if (typeof keepLatest !== "number" || isNaN(keepLatest)) {
    throw new ImmutableValidationError(
      `${fieldName} must be a positive integer >= 1, got ${keepLatest}`,
      "INVALID_KEEP_LATEST",
      fieldName,
    );
  }

  if (keepLatest < 1) {
    throw new ImmutableValidationError(
      `${fieldName} must be a positive integer >= 1, got ${keepLatest}`,
      "INVALID_KEEP_LATEST",
      fieldName,
    );
  }

  if (!Number.isInteger(keepLatest)) {
    throw new ImmutableValidationError(
      `${fieldName} must be a positive integer, got ${keepLatest}`,
      "INVALID_KEEP_LATEST",
      fieldName,
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Composite Validation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates complete immutable entry structure
 * Runtime checks for potentially untrusted external input
 */
export function validateImmutableEntry(entry: ImmutableEntry): void {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!entry) {
    throw new ImmutableValidationError(
      "Entry is required",
      "MISSING_REQUIRED_FIELD",
    );
  }

  // Validate required fields
  validateType(entry.type, "type");
  validateId(entry.id, "id");
  validateData(entry.data, "data");

  // Validate optional fields if provided
  if (entry.metadata !== undefined) {
    validateMetadata(entry.metadata, "metadata");
  }

  if (entry.userId !== undefined) {
    validateUserId(entry.userId, "userId");
  }
}

/**
 * Validates list filter structure
 */
export function validateListFilter(filter: ListImmutableFilter): void {
  if (filter.type !== undefined) {
    validateType(filter.type, "type");
  }

  if (filter.userId !== undefined) {
    validateUserId(filter.userId, "userId");
  }

  if (filter.limit !== undefined) {
    validateLimit(filter.limit, "limit");
  }
}

/**
 * Validates search input structure
 * Runtime checks for potentially untrusted external input
 */
export function validateSearchInput(input: SearchImmutableInput): void {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!input) {
    throw new ImmutableValidationError(
      "Search input is required",
      "MISSING_REQUIRED_FIELD",
    );
  }

  // Query is required
  if (
    !input.query ||
    typeof input.query !== "string" ||
    input.query.trim().length === 0
  ) {
    throw new ImmutableValidationError(
      "Search query is required and must be a non-empty string",
      "MISSING_REQUIRED_FIELD",
      "query",
    );
  }

  // Validate optional filters
  if (input.type !== undefined) {
    validateType(input.type, "type");
  }

  if (input.userId !== undefined) {
    validateUserId(input.userId, "userId");
  }

  if (input.limit !== undefined) {
    validateLimit(input.limit, "limit");
  }
}

/**
 * Validates count filter structure
 */
export function validateCountFilter(filter: CountImmutableFilter): void {
  if (filter.type !== undefined) {
    validateType(filter.type, "type");
  }

  if (filter.userId !== undefined) {
    validateUserId(filter.userId, "userId");
  }
}

/**
 * Validates purgeMany filter structure
 * Runtime checks for potentially untrusted external input
 */
export function validatePurgeManyFilter(filter: {
  type?: string;
  userId?: string;
}): void {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!filter) {
    throw new ImmutableValidationError("Filter is required", "INVALID_FILTER");
  }

  // At least one filter must be provided
  if (filter.type === undefined && filter.userId === undefined) {
    throw new ImmutableValidationError(
      "purgeMany requires at least one filter (type or userId)",
      "INVALID_FILTER",
    );
  }

  // Validate provided filters
  if (filter.type !== undefined) {
    validateType(filter.type, "type");
  }

  if (filter.userId !== undefined) {
    validateUserId(filter.userId, "userId");
  }
}
