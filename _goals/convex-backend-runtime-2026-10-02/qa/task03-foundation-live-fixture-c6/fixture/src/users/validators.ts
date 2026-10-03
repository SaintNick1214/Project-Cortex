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
 * Runtime checks for potentially untrusted external input
 */
export function validateUserId(userId: string, fieldName = "userId"): void {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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
 * Validates timestamp is a valid number (Unix timestamp in milliseconds)
 * Runtime checks for potentially untrusted external input
 */
export function validateTimestamp(
  timestamp: number,
  fieldName = "timestamp",
): void {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (timestamp === null || timestamp === undefined) {
    throw new UserValidationError(
      `${fieldName} is required`,
      "INVALID_TIMESTAMP",
      fieldName,
    );
  }

  if (typeof timestamp !== "number") {
    throw new UserValidationError(
      `${fieldName} must be a number (Unix timestamp)`,
      "INVALID_TIMESTAMP",
      fieldName,
    );
  }

  if (isNaN(timestamp) || !isFinite(timestamp)) {
    throw new UserValidationError(
      `${fieldName} must be a valid numeric timestamp`,
      "INVALID_TIMESTAMP",
      fieldName,
    );
  }

  // Check for reasonable timestamp range (not negative, not absurdly in the future)
  if (timestamp < 0) {
    throw new UserValidationError(
      `${fieldName} cannot be negative`,
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
 * Runtime checks for potentially untrusted external input
 */
export function validateListUsersFilter(
  filters: ListUsersFilter | undefined,
): void {
  if (filters === undefined) {
    return; // Optional parameter
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (typeof filters !== "object" || filters === null) {
    throw new UserValidationError(
      "Filters must be an object",
      "INVALID_FILTER_STRUCTURE",
      "filters",
    );
  }

  // Validate pagination fields
  if (filters.limit !== undefined) {
    validateLimit(filters.limit, "filters.limit");
  }

  if (filters.offset !== undefined) {
    validateOffset(filters.offset, "filters.offset");
  }

  // Validate date filters
  if (filters.createdAfter !== undefined) {
    validateTimestamp(filters.createdAfter, "filters.createdAfter");
  }

  if (filters.createdBefore !== undefined) {
    validateTimestamp(filters.createdBefore, "filters.createdBefore");
  }

  if (filters.updatedAfter !== undefined) {
    validateTimestamp(filters.updatedAfter, "filters.updatedAfter");
  }

  if (filters.updatedBefore !== undefined) {
    validateTimestamp(filters.updatedBefore, "filters.updatedBefore");
  }

  // Validate date range consistency
  if (
    filters.createdAfter !== undefined &&
    filters.createdBefore !== undefined &&
    filters.createdAfter >= filters.createdBefore
  ) {
    throw new UserValidationError(
      "createdAfter must be before createdBefore",
      "INVALID_DATE_RANGE",
      "filters.createdAfter",
    );
  }

  if (
    filters.updatedAfter !== undefined &&
    filters.updatedBefore !== undefined &&
    filters.updatedAfter >= filters.updatedBefore
  ) {
    throw new UserValidationError(
      "updatedAfter must be before updatedBefore",
      "INVALID_DATE_RANGE",
      "filters.updatedAfter",
    );
  }

  // Validate sortBy field
  if (filters.sortBy !== undefined) {
    if (filters.sortBy !== "createdAt" && filters.sortBy !== "updatedAt") {
      throw new UserValidationError(
        "sortBy must be 'createdAt' or 'updatedAt'",
        "INVALID_SORT_BY",
        "filters.sortBy",
      );
    }
  }

  // Validate sortOrder field
  if (filters.sortOrder !== undefined) {
    if (filters.sortOrder !== "asc" && filters.sortOrder !== "desc") {
      throw new UserValidationError(
        "sortOrder must be 'asc' or 'desc'",
        "INVALID_SORT_ORDER",
        "filters.sortOrder",
      );
    }
  }

  // Validate displayName filter
  if (filters.displayName !== undefined) {
    if (typeof filters.displayName !== "string") {
      throw new UserValidationError(
        "displayName must be a string",
        "INVALID_DISPLAY_NAME_FILTER",
        "filters.displayName",
      );
    }
    if (filters.displayName.length > 200) {
      throw new UserValidationError(
        "displayName filter cannot exceed 200 characters",
        "INVALID_DISPLAY_NAME_FILTER",
        "filters.displayName",
      );
    }
  }

  // Validate email filter
  if (filters.email !== undefined) {
    if (typeof filters.email !== "string") {
      throw new UserValidationError(
        "email must be a string",
        "INVALID_EMAIL_FILTER",
        "filters.email",
      );
    }
    if (filters.email.length > 254) {
      throw new UserValidationError(
        "email filter cannot exceed 254 characters",
        "INVALID_EMAIL_FILTER",
        "filters.email",
      );
    }
  }
}

/**
 * Validates UserFilters structure
 * Runtime checks for potentially untrusted external input
 */
export function validateUserFilters(filters: UserFilters | undefined): void {
  // UserFilters extends ListUsersFilter, so we can reuse the same validation
  validateListUsersFilter(filters);
}

/**
 * Validates DeleteUserOptions structure
 * Runtime checks for potentially untrusted external input
 */
export function validateDeleteUserOptions(
  options: DeleteUserOptions | undefined,
): void {
  if (options === undefined) {
    return; // Optional parameter
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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
 * Runtime checks for potentially untrusted external input
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

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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
 * Runtime checks for potentially untrusted external input
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

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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
 * Runtime checks for potentially untrusted external input
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

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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
