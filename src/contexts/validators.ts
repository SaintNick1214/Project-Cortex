/**
 * Contexts API Validation
 *
 * Client-side validation for contexts operations to catch errors before
 * they reach the backend, providing faster feedback and better error messages.
 */

/**
 * Custom error class for contexts validation failures
 */
export class ContextsValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "ContextsValidationError";
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Required Field Validators
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates that a value is a non-empty string
 */
export function validateRequiredString(
  value: unknown,
  fieldName: string,
): void {
  if (
    value === null ||
    value === undefined ||
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    throw new ContextsValidationError(
      `${fieldName} is required and cannot be empty`,
      "MISSING_REQUIRED_FIELD",
      fieldName,
    );
  }
}

/**
 * Validates purpose field (non-empty, not whitespace-only)
 */
export function validatePurpose(purpose: string): void {
  if (!purpose || typeof purpose !== "string") {
    throw new ContextsValidationError(
      "purpose is required and cannot be empty",
      "MISSING_REQUIRED_FIELD",
      "purpose",
    );
  }

  if (purpose.trim().length === 0) {
    throw new ContextsValidationError(
      "purpose cannot contain only whitespace",
      "WHITESPACE_ONLY",
      "purpose",
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Format Validators
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates contextId format: must match pattern /^ctx-\d+-[a-z0-9]+$/
 */
export function validateContextIdFormat(contextId: string): void {
  const contextIdRegex = /^ctx-\d+-[a-z0-9]+$/;
  if (!contextIdRegex.test(contextId)) {
    throw new ContextsValidationError(
      `Invalid contextId format "${contextId}". Expected format: "ctx-{timestamp}-{random}" (e.g., "ctx-1234567890-abc123")`,
      "INVALID_CONTEXT_ID_FORMAT",
      "contextId",
    );
  }
}

/**
 * Validates conversationId format: must start with "conv-"
 */
export function validateConversationIdFormat(conversationId: string): void {
  if (!conversationId.startsWith("conv-")) {
    throw new ContextsValidationError(
      `Invalid conversationId format "${conversationId}". Must start with "conv-"`,
      "INVALID_CONVERSATION_ID_FORMAT",
      "conversationId",
    );
  }
}

/**
 * Validates status enum value
 */
const VALID_STATUSES = ["active", "completed", "cancelled", "blocked"] as const;

export function validateStatus(status: string): void {
  if (!status || typeof status !== "string") {
    throw new ContextsValidationError(
      "status is required and must be a string",
      "INVALID_STATUS",
      "status",
    );
  }

  if (!(VALID_STATUSES as readonly string[]).includes(status)) {
    throw new ContextsValidationError(
      `Invalid status "${status}". Valid statuses: ${VALID_STATUSES.join(", ")}`,
      "INVALID_STATUS",
      "status",
    );
  }
}

/**
 * Validates export format enum value
 */
const VALID_FORMATS = ["json", "csv"] as const;

export function validateExportFormat(format: string): void {
  if (!format || typeof format !== "string") {
    throw new ContextsValidationError(
      "format is required and must be a string",
      "INVALID_FORMAT",
      "format",
    );
  }

  if (!(VALID_FORMATS as readonly string[]).includes(format)) {
    throw new ContextsValidationError(
      `Invalid format "${format}". Valid formats: ${VALID_FORMATS.join(", ")}`,
      "INVALID_FORMAT",
      "format",
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Range Validators
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates depth value (must be >= 0)
 */
export function validateDepth(depth: number): void {
  if (typeof depth !== "number" || isNaN(depth)) {
    throw new ContextsValidationError(
      "depth must be a number",
      "INVALID_RANGE",
      "depth",
    );
  }

  if (depth < 0) {
    throw new ContextsValidationError(
      `depth must be >= 0, got ${depth}`,
      "INVALID_RANGE",
      "depth",
    );
  }
}

/**
 * Validates limit value (must be > 0 and <= 1000)
 */
export function validateLimit(limit: number): void {
  if (typeof limit !== "number" || isNaN(limit)) {
    throw new ContextsValidationError(
      "limit must be a number",
      "INVALID_RANGE",
      "limit",
    );
  }

  if (limit <= 0) {
    throw new ContextsValidationError(
      `limit must be > 0, got ${limit}`,
      "INVALID_RANGE",
      "limit",
    );
  }

  if (limit > 1000) {
    throw new ContextsValidationError(
      `limit must be <= 1000, got ${limit}`,
      "INVALID_RANGE",
      "limit",
    );
  }
}

/**
 * Validates version number (must be integer >= 1)
 */
export function validateVersion(version: number): void {
  if (typeof version !== "number" || isNaN(version)) {
    throw new ContextsValidationError(
      "version must be a number",
      "INVALID_RANGE",
      "version",
    );
  }

  if (version < 1) {
    throw new ContextsValidationError(
      `version must be >= 1, got ${version}`,
      "INVALID_RANGE",
      "version",
    );
  }

  if (!Number.isInteger(version)) {
    throw new ContextsValidationError(
      `version must be an integer, got ${version}`,
      "INVALID_RANGE",
      "version",
    );
  }
}

/**
 * Validates timestamp value (must be > 0)
 */
export function validateTimestamp(timestamp: number, fieldName: string): void {
  if (typeof timestamp !== "number" || isNaN(timestamp)) {
    throw new ContextsValidationError(
      `${fieldName} must be a number`,
      "INVALID_RANGE",
      fieldName,
    );
  }

  if (timestamp <= 0) {
    throw new ContextsValidationError(
      `${fieldName} must be > 0, got ${timestamp}`,
      "INVALID_RANGE",
      fieldName,
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Type Validators
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates that data is an object (not null, not array)
 */
export function validateDataObject(data: unknown): void {
  if (
    data === null ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    throw new ContextsValidationError(
      "data must be an object",
      "INVALID_TYPE",
      "data",
    );
  }
}

/**
 * Validates conversationRef structure
 */
export function validateConversationRef(ref: unknown): void {
  if (ref === null || typeof ref !== "object" || Array.isArray(ref)) {
    throw new ContextsValidationError(
      "conversationRef must be an object",
      "INVALID_TYPE",
      "conversationRef",
    );
  }

  const refObj = ref as Record<string, unknown>;

  if (!refObj.conversationId || typeof refObj.conversationId !== "string") {
    throw new ContextsValidationError(
      "conversationRef must include conversationId string",
      "MISSING_REQUIRED_FIELD",
      "conversationRef.conversationId",
    );
  }

  // Validate conversationId format
  validateConversationIdFormat(refObj.conversationId);

  // If messageIds is provided, validate it's an array
  if (refObj.messageIds !== undefined) {
    if (!Array.isArray(refObj.messageIds)) {
      throw new ContextsValidationError(
        "conversationRef.messageIds must be an array",
        "INVALID_TYPE",
        "conversationRef.messageIds",
      );
    }
  }
}

/**
 * Validates Date object
 */
export function validateDateObject(date: unknown, fieldName: string): void {
  if (!(date instanceof Date)) {
    throw new ContextsValidationError(
      `${fieldName} must be a Date object`,
      "INVALID_DATE",
      fieldName,
    );
  }

  if (isNaN(date.getTime())) {
    throw new ContextsValidationError(
      `${fieldName} must be a valid Date object`,
      "INVALID_DATE",
      fieldName,
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Business Logic Validators
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates that an array is non-empty
 */
export function validateNonEmptyArray(arr: unknown[], fieldName: string): void {
  if (!Array.isArray(arr)) {
    throw new ContextsValidationError(
      `${fieldName} must be an array`,
      "INVALID_TYPE",
      fieldName,
    );
  }

  if (arr.length === 0) {
    throw new ContextsValidationError(
      `${fieldName} cannot be empty`,
      "EMPTY_ARRAY",
      fieldName,
    );
  }
}

/**
 * Validates that updates object has at least one field
 */
export function validateUpdatesObject(updates: Record<string, unknown>): void {
  // Use as unknown for defensive runtime check (input could come from untrusted source)
  if (
    (updates as unknown) === null ||
    typeof updates !== "object" ||
    Array.isArray(updates)
  ) {
    throw new ContextsValidationError(
      "updates must be an object",
      "INVALID_TYPE",
      "updates",
    );
  }

  const keys = Object.keys(updates);
  if (keys.length === 0) {
    throw new ContextsValidationError(
      "updates must include at least one field to update",
      "EMPTY_UPDATES",
      "updates",
    );
  }
}

/**
 * Validates that filters object has at least one defined value
 */
export function validateHasFilters(filters: Record<string, unknown>): void {
  // Use as unknown for defensive runtime check (input could come from untrusted source)
  if (
    (filters as unknown) === null ||
    typeof filters !== "object" ||
    Array.isArray(filters)
  ) {
    throw new ContextsValidationError(
      "filters must be an object",
      "INVALID_TYPE",
      "filters",
    );
  }

  // Check if at least one filter has a defined value
  const hasDefinedFilter = Object.values(filters).some(
    (value) => value !== undefined,
  );

  if (!hasDefinedFilter) {
    throw new ContextsValidationError(
      "filters must include at least one defined filter field",
      "EMPTY_FILTERS",
      "filters",
    );
  }
}
