/**
 * User API Validation
 *
 * Client-side validation for user operations to catch errors before
 * they reach the backend, providing faster feedback and better error messages.
 */

import type {
  ListUsersFilter,
  UserFilters,
  DeleteUserOptions,
  ExportUsersOptions,
} from "../types";

/**
 * Custom error class for user validation failures
 */
export class UserValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "UserValidationError";
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Required Field Validators
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates userId is provided and non-empty
 */
export function validateUserId(userId: string, fieldName = "userId"): void {
  if (userId === null || userId === undefined) {
    throw new UserValidationError(
      `${fieldName} is required`,
      "MISSING_USER_ID",
      fieldName,
    );
  }

  if (typeof userId !== "string") {
    throw new UserValidationError(
      `${fieldName} must be a string`,
      "INVALID_USER_ID_FORMAT",
      fieldName,
    );
  }

  if (userId.trim().length === 0) {
    throw new UserValidationError(
      `${fieldName} cannot be empty`,
      "INVALID_USER_ID_FORMAT",
      fieldName,
    );
  }
}

/**
 * Validates data is a non-null object
 */
export function validateData(data: unknown, fieldName = "data"): void {
  if (data === null || data === undefined) {
    throw new UserValidationError(
      `${fieldName} is required`,
      "MISSING_DATA",
      fieldName,
    );
  }

  if (typeof data !== "object") {
    throw new UserValidationError(
      `${fieldName} must be an object`,
      "INVALID_DATA_TYPE",
      fieldName,
    );
  }

  if (Array.isArray(data)) {
    throw new UserValidationError(
      `${fieldName} must be an object, not an array`,
      "INVALID_DATA_TYPE",
      fieldName,
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Format Validators
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates version number is a positive integer >= 1
 */
export function validateVersionNumber(
  version: number,
  fieldName = "version",
): void {
  if (typeof version !== "number") {
    throw new UserValidationError(
      `${fieldName} must be a number`,
      "INVALID_VERSION_NUMBER",
      fieldName,
    );
  }

  if (isNaN(version) || !isFinite(version)) {
    throw new UserValidationError(
      `${fieldName} must be a valid number`,
      "INVALID_VERSION_NUMBER",
      fieldName,
    );
  }

  if (!Number.isInteger(version)) {
    throw new UserValidationError(
      `${fieldName} must be an integer`,
      "INVALID_VERSION_NUMBER",
      fieldName,
    );
  }

  if (version < 1) {
    throw new UserValidationError(
      `${fieldName} must be >= 1, got ${version}`,
      "INVALID_VERSION_RANGE",
      fieldName,
    );
  }
}

/**
 * Validates timestamp is a valid Date object
 */
export function validateTimestamp(
  timestamp: Date,
  fieldName = "timestamp",
): void {
  if (timestamp === null || timestamp === undefined) {
    throw new UserValidationError(
      `${fieldName} is required`,
      "INVALID_TIMESTAMP",
      fieldName,
    );
  }

  if (!(timestamp instanceof Date)) {
    throw new UserValidationError(
      `${fieldName} must be a Date object`,
      "INVALID_TIMESTAMP",
      fieldName,
    );
  }

  if (isNaN(timestamp.getTime())) {
    throw new UserValidationError(
      `${fieldName} must be a valid Date`,
      "INVALID_TIMESTAMP",
      fieldName,
    );
  }
}

/**
 * Validates export format is "json" or "csv"
 */
export function validateExportFormat(format: string): void {
  if (!format || typeof format !== "string") {
    throw new UserValidationError(
      "Export format is required",
      "INVALID_EXPORT_FORMAT",
      "format",
    );
  }

  if (format !== "json" && format !== "csv") {
    throw new UserValidationError(
      `Invalid export format "${format}". Valid formats: json, csv`,
      "INVALID_EXPORT_FORMAT",
      "format",
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Range Validators
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates limit is within acceptable range
 */
export function validateLimit(
  limit: number | undefined,
  fieldName = "limit",
): void {
  if (limit === undefined) {
    return; // Optional parameter
  }

  if (typeof limit !== "number") {
    throw new UserValidationError(
      `${fieldName} must be a number`,
      "INVALID_LIMIT",
      fieldName,
    );
  }

  if (isNaN(limit) || !isFinite(limit)) {
    throw new UserValidationError(
      `${fieldName} must be a valid number`,
      "INVALID_LIMIT",
      fieldName,
    );
  }

  if (limit < 1 || limit > 1000) {
    throw new UserValidationError(
      `${fieldName} must be between 1 and 1000, got ${limit}`,
      "INVALID_LIMIT",
      fieldName,
    );
  }
}

/**
 * Validates offset is non-negative
 */
export function validateOffset(
  offset: number | undefined,
  fieldName = "offset",
): void {
  if (offset === undefined) {
    return; // Optional parameter
  }

  if (typeof offset !== "number") {
    throw new UserValidationError(
      `${fieldName} must be a number`,
      "INVALID_OFFSET",
      fieldName,
    );
  }

  if (isNaN(offset) || !isFinite(offset)) {
    throw new UserValidationError(
      `${fieldName} must be a valid number`,
      "INVALID_OFFSET",
      fieldName,
    );
  }

  if (offset < 0) {
    throw new UserValidationError(
      `${fieldName} must be >= 0, got ${offset}`,
      "INVALID_OFFSET",
      fieldName,
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Structural Validators
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates ListUsersFilter structure
 */
export function validateListUsersFilter(
  filters: ListUsersFilter | undefined,
): void {
  if (filters === undefined) {
    return; // Optional parameter
  }

  if (typeof filters !== "object" || filters === null) {
    throw new UserValidationError(
      "Filters must be an object",
      "INVALID_FILTER_STRUCTURE",
      "filters",
    );
  }

  // Validate individual filter fields
  if (filters.limit !== undefined) {
    validateLimit(filters.limit, "filters.limit");
  }

  if (filters.offset !== undefined) {
    validateOffset(filters.offset, "filters.offset");
  }
}

/**
 * Validates UserFilters structure
 */
export function validateUserFilters(filters: UserFilters | undefined): void {
  if (filters === undefined) {
    return; // Optional parameter
  }

  if (typeof filters !== "object" || filters === null) {
    throw new UserValidationError(
      "Filters must be an object",
      "INVALID_FILTER_STRUCTURE",
      "filters",
    );
  }

  // Validate limit if provided
  if (filters.limit !== undefined) {
    validateLimit(filters.limit, "filters.limit");
  }
}

/**
 * Validates DeleteUserOptions structure
 */
export function validateDeleteUserOptions(
  options: DeleteUserOptions | undefined,
): void {
  if (options === undefined) {
    return; // Optional parameter
  }

  if (typeof options !== "object" || options === null) {
    throw new UserValidationError(
      "Options must be an object",
      "INVALID_DELETE_OPTIONS",
      "options",
    );
  }

  // Validate boolean fields if provided
  if (options.cascade !== undefined && typeof options.cascade !== "boolean") {
    throw new UserValidationError(
      "options.cascade must be a boolean",
      "INVALID_DELETE_OPTIONS",
      "options.cascade",
    );
  }

  if (options.verify !== undefined && typeof options.verify !== "boolean") {
    throw new UserValidationError(
      "options.verify must be a boolean",
      "INVALID_DELETE_OPTIONS",
      "options.verify",
    );
  }

  if (options.dryRun !== undefined && typeof options.dryRun !== "boolean") {
    throw new UserValidationError(
      "options.dryRun must be a boolean",
      "INVALID_DELETE_OPTIONS",
      "options.dryRun",
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Business Logic Validators
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates array of user IDs for bulk operations
 */
export function validateUserIdsArray(
  userIds: string[],
  minLength = 1,
  maxLength = 100,
): void {
  if (!Array.isArray(userIds)) {
    throw new UserValidationError(
      "userIds must be an array",
      "INVALID_DATA_TYPE",
      "userIds",
    );
  }

  if (userIds.length < minLength) {
    throw new UserValidationError(
      `userIds array cannot be empty`,
      "EMPTY_USER_IDS_ARRAY",
      "userIds",
    );
  }

  if (userIds.length > maxLength) {
    throw new UserValidationError(
      `userIds array cannot exceed ${maxLength} items, got ${userIds.length}`,
      "USER_ID_ARRAY_TOO_LARGE",
      "userIds",
    );
  }

  // Validate each userId
  for (let i = 0; i < userIds.length; i++) {
    try {
      validateUserId(userIds[i], `userIds[${i}]`);
    } catch (error) {
      if (error instanceof UserValidationError) {
        throw new UserValidationError(
          `Invalid userId at index ${i}: ${error.message}`,
          error.code,
          `userIds[${i}]`,
        );
      }
      throw error;
    }
  }

  // Check for duplicates
  const uniqueIds = new Set(userIds);
  if (uniqueIds.size !== userIds.length) {
    throw new UserValidationError(
      "Duplicate userIds found in array",
      "INVALID_DATA_TYPE",
      "userIds",
    );
  }
}

/**
 * Validates bulk update options
 */
export function validateBulkUpdateOptions(
  options:
    | {
        skipVersioning?: boolean;
        dryRun?: boolean;
      }
    | undefined,
): void {
  if (options === undefined) {
    return; // Optional parameter
  }

  if (typeof options !== "object" || options === null) {
    throw new UserValidationError(
      "Options must be an object",
      "INVALID_DATA_TYPE",
      "options",
    );
  }

  if (
    options.skipVersioning !== undefined &&
    typeof options.skipVersioning !== "boolean"
  ) {
    throw new UserValidationError(
      "options.skipVersioning must be a boolean",
      "INVALID_DATA_TYPE",
      "options.skipVersioning",
    );
  }

  if (options.dryRun !== undefined && typeof options.dryRun !== "boolean") {
    throw new UserValidationError(
      "options.dryRun must be a boolean",
      "INVALID_DATA_TYPE",
      "options.dryRun",
    );
  }
}

/**
 * Validates bulk delete options
 */
export function validateBulkDeleteOptions(
  options:
    | {
        cascade?: boolean;
        dryRun?: boolean;
      }
    | undefined,
): void {
  if (options === undefined) {
    return; // Optional parameter
  }

  if (typeof options !== "object" || options === null) {
    throw new UserValidationError(
      "Options must be an object",
      "INVALID_DATA_TYPE",
      "options",
    );
  }

  if (options.cascade !== undefined && typeof options.cascade !== "boolean") {
    throw new UserValidationError(
      "options.cascade must be a boolean",
      "INVALID_DATA_TYPE",
      "options.cascade",
    );
  }

  if (options.dryRun !== undefined && typeof options.dryRun !== "boolean") {
    throw new UserValidationError(
      "options.dryRun must be a boolean",
      "INVALID_DATA_TYPE",
      "options.dryRun",
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Export Options Validators
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates export options structure
 */
export function validateExportOptions(
  options: ExportUsersOptions | undefined,
): void {
  if (options === undefined) {
    throw new UserValidationError(
      "Export options are required",
      "MISSING_REQUIRED_PARAMETER",
      "options",
    );
  }

  if (typeof options !== "object" || options === null) {
    throw new UserValidationError(
      "Options must be an object",
      "INVALID_DATA_TYPE",
      "options",
    );
  }

  // Validate format
  validateExportFormat(options.format);

  // Validate filters if provided
  if (options.filters !== undefined) {
    validateUserFilters(options.filters);
  }
}
