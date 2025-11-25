/**
 * Mutable Store API Validation
 *
 * Client-side validation for mutable store operations to catch errors before
 * they reach the backend, providing faster feedback and better error messages.
 */

/**
 * Custom error class for mutable validation failures
 */
export class MutableValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "MutableValidationError";
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Constants
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const NAMESPACE_MAX_LENGTH = 100;
const KEY_MAX_LENGTH = 255;
const MAX_VALUE_SIZE = 1048576; // 1MB in bytes
const MAX_LIMIT = 1000;

// Regex patterns (cached at module level for performance)
const NAMESPACE_PATTERN = /^[a-zA-Z0-9-_.:]+$/;
const KEY_PATTERN = /^[a-zA-Z0-9-_.:/@]+$/;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Required Field Validators
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates namespace is non-empty string
 */
export function validateNamespace(
  namespace: unknown,
  fieldName = "namespace",
): void {
  if (namespace === null || namespace === undefined) {
    throw new MutableValidationError(
      `${fieldName} is required`,
      "MISSING_NAMESPACE",
      fieldName,
    );
  }

  if (typeof namespace !== "string") {
    throw new MutableValidationError(
      `${fieldName} must be a string, got ${typeof namespace}`,
      "INVALID_NAMESPACE",
      fieldName,
    );
  }

  if (namespace.trim().length === 0) {
    throw new MutableValidationError(
      `${fieldName} is required and cannot be empty`,
      "MISSING_NAMESPACE",
      fieldName,
    );
  }
}

/**
 * Validates key is non-empty string
 */
export function validateKey(key: unknown, fieldName = "key"): void {
  if (key === null || key === undefined) {
    throw new MutableValidationError(
      `${fieldName} is required`,
      "MISSING_KEY",
      fieldName,
    );
  }

  if (typeof key !== "string") {
    throw new MutableValidationError(
      `${fieldName} must be a string, got ${typeof key}`,
      "INVALID_KEY",
      fieldName,
    );
  }

  if (key.trim().length === 0) {
    throw new MutableValidationError(
      `${fieldName} is required and cannot be empty`,
      "MISSING_KEY",
      fieldName,
    );
  }
}

/**
 * Validates value is provided (not null/undefined for set operations)
 */
export function validateValue(value: unknown): void {
  if (value === undefined) {
    throw new MutableValidationError(
      "Value is required (use null if you want to store null)",
      "MISSING_VALUE",
      "value",
    );
  }
}

/**
 * Validates userId format if provided
 */
export function validateUserId(userId: unknown): void {
  if (userId === null || userId === undefined) {
    return; // Optional field
  }

  if (typeof userId !== "string") {
    throw new MutableValidationError(
      `userId must be a string, got ${typeof userId}`,
      "INVALID_USER_ID",
      "userId",
    );
  }

  if (userId.trim().length === 0) {
    throw new MutableValidationError(
      "userId cannot be empty",
      "INVALID_USER_ID",
      "userId",
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Format Validators
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates namespace format (alphanumeric, hyphens, underscores, dots, colons)
 */
export function validateNamespaceFormat(namespace: string): void {
  if (namespace.length > NAMESPACE_MAX_LENGTH) {
    throw new MutableValidationError(
      `Namespace exceeds maximum length of ${NAMESPACE_MAX_LENGTH} characters (got ${namespace.length})`,
      "NAMESPACE_TOO_LONG",
      "namespace",
    );
  }

  if (!NAMESPACE_PATTERN.test(namespace)) {
    throw new MutableValidationError(
      `Invalid namespace format "${namespace}". Must contain only alphanumeric characters, hyphens, underscores, dots, and colons`,
      "INVALID_NAMESPACE",
      "namespace",
    );
  }
}

/**
 * Validates key format (allows slash for hierarchical keys)
 */
export function validateKeyFormat(key: string): void {
  if (key.length > KEY_MAX_LENGTH) {
    throw new MutableValidationError(
      `Key exceeds maximum length of ${KEY_MAX_LENGTH} characters (got ${key.length})`,
      "KEY_TOO_LONG",
      "key",
    );
  }

  if (!KEY_PATTERN.test(key)) {
    throw new MutableValidationError(
      `Invalid key format "${key}". Must contain only alphanumeric characters, hyphens, underscores, dots, colons, slashes, and @ symbols`,
      "INVALID_KEY",
      "key",
    );
  }
}

/**
 * Validates keyPrefix format if provided
 */
export function validateKeyPrefix(keyPrefix: unknown): void {
  if (keyPrefix === null || keyPrefix === undefined) {
    return; // Optional field
  }

  if (typeof keyPrefix !== "string") {
    throw new MutableValidationError(
      `keyPrefix must be a string, got ${typeof keyPrefix}`,
      "INVALID_KEY_PREFIX",
      "keyPrefix",
    );
  }

  if (keyPrefix.trim().length === 0) {
    throw new MutableValidationError(
      "keyPrefix cannot be empty",
      "INVALID_KEY_PREFIX",
      "keyPrefix",
    );
  }

  // Key prefix should follow same format rules as keys
  if (!KEY_PATTERN.test(keyPrefix)) {
    throw new MutableValidationError(
      `Invalid keyPrefix format "${keyPrefix}". Must contain only alphanumeric characters, hyphens, underscores, dots, colons, slashes, and @ symbols`,
      "INVALID_KEY_PREFIX",
      "keyPrefix",
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Range Validators
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates limit is positive integer <= 1000
 */
export function validateLimit(limit: unknown): void {
  if (limit === null || limit === undefined) {
    return; // Optional field
  }

  if (typeof limit !== "number") {
    throw new MutableValidationError(
      `limit must be a number, got ${typeof limit}`,
      "INVALID_LIMIT_TYPE",
      "limit",
    );
  }

  if (!Number.isInteger(limit)) {
    throw new MutableValidationError(
      `limit must be an integer, got ${limit}`,
      "INVALID_LIMIT_TYPE",
      "limit",
    );
  }

  if (limit < 0) {
    throw new MutableValidationError(
      `limit must be non-negative, got ${limit}`,
      "INVALID_LIMIT_RANGE",
      "limit",
    );
  }

  if (limit > MAX_LIMIT) {
    throw new MutableValidationError(
      `limit exceeds maximum of ${MAX_LIMIT}, got ${limit}`,
      "INVALID_LIMIT_RANGE",
      "limit",
    );
  }
}

/**
 * Validates amount is a finite number
 */
export function validateAmount(amount: unknown, fieldName = "amount"): void {
  if (amount === null || amount === undefined) {
    return; // Optional field (has default)
  }

  if (typeof amount !== "number") {
    throw new MutableValidationError(
      `${fieldName} must be a number, got ${typeof amount}`,
      "INVALID_AMOUNT_TYPE",
      fieldName,
    );
  }

  if (!Number.isFinite(amount)) {
    throw new MutableValidationError(
      `${fieldName} must be a finite number, got ${amount}`,
      "INVALID_AMOUNT_TYPE",
      fieldName,
    );
  }

  // Warn about zero amount (but allow it)
  if (amount === 0) {
    console.warn(
      `Warning: ${fieldName} is zero, which will have no effect on the value`,
    );
  }
}

/**
 * Validates value size (serialized JSON) is reasonable (< 1MB)
 */
export function validateValueSize(value: unknown): void {
  try {
    const serialized = JSON.stringify(value);
    const sizeInBytes = new Blob([serialized]).size;

    if (sizeInBytes > MAX_VALUE_SIZE) {
      const sizeInMB = (sizeInBytes / 1048576).toFixed(2);
      throw new MutableValidationError(
        `Value exceeds maximum size of 1MB (got ${sizeInMB}MB). Consider splitting data into multiple keys or using a different storage approach.`,
        "VALUE_TOO_LARGE",
        "value",
      );
    }
  } catch (error) {
    if (error instanceof MutableValidationError) {
      throw error;
    }
    // If JSON.stringify fails, let it pass (backend will handle it)
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Type Validators
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates updater is a function
 */
export function validateUpdater(updater: unknown): void {
  if (updater === null || updater === undefined) {
    throw new MutableValidationError(
      "Updater function is required",
      "INVALID_UPDATER_TYPE",
      "updater",
    );
  }

  if (typeof updater !== "function") {
    throw new MutableValidationError(
      `Updater must be a function, got ${typeof updater}`,
      "INVALID_UPDATER_TYPE",
      "updater",
    );
  }
}

/**
 * Validates list filter object structure
 */
export function validateListFilter(filter: unknown): void {
  if (filter === null || filter === undefined) {
    throw new MutableValidationError(
      "Filter is required",
      "MISSING_FILTER",
      "filter",
    );
  }

  if (typeof filter !== "object" || Array.isArray(filter)) {
    throw new MutableValidationError(
      `Filter must be an object, got ${typeof filter}`,
      "INVALID_FILTER",
      "filter",
    );
  }

  const filterObj = filter as Record<string, unknown>;

  if (!filterObj.namespace) {
    throw new MutableValidationError(
      "Filter must include namespace",
      "MISSING_NAMESPACE",
      "filter.namespace",
    );
  }

  // Validate individual filter fields
  validateNamespace(filterObj.namespace, "filter.namespace");
  validateNamespaceFormat(filterObj.namespace as string);

  if (filterObj.keyPrefix !== undefined) {
    validateKeyPrefix(filterObj.keyPrefix);
  }

  if (filterObj.userId !== undefined) {
    validateUserId(filterObj.userId);
  }

  if (filterObj.limit !== undefined) {
    validateLimit(filterObj.limit);
  }
}

/**
 * Validates count filter object structure
 */
export function validateCountFilter(filter: unknown): void {
  if (filter === null || filter === undefined) {
    throw new MutableValidationError(
      "Filter is required",
      "MISSING_FILTER",
      "filter",
    );
  }

  if (typeof filter !== "object" || Array.isArray(filter)) {
    throw new MutableValidationError(
      `Filter must be an object, got ${typeof filter}`,
      "INVALID_FILTER",
      "filter",
    );
  }

  const filterObj = filter as Record<string, unknown>;

  if (!filterObj.namespace) {
    throw new MutableValidationError(
      "Filter must include namespace",
      "MISSING_NAMESPACE",
      "filter.namespace",
    );
  }

  // Validate individual filter fields
  validateNamespace(filterObj.namespace, "filter.namespace");
  validateNamespaceFormat(filterObj.namespace as string);

  if (filterObj.keyPrefix !== undefined) {
    validateKeyPrefix(filterObj.keyPrefix);
  }

  if (filterObj.userId !== undefined) {
    validateUserId(filterObj.userId);
  }
}

/**
 * Validates purgeMany filter object structure
 */
export function validatePurgeFilter(filter: unknown): void {
  if (filter === null || filter === undefined) {
    throw new MutableValidationError(
      "Filter is required",
      "MISSING_FILTER",
      "filter",
    );
  }

  if (typeof filter !== "object" || Array.isArray(filter)) {
    throw new MutableValidationError(
      `Filter must be an object, got ${typeof filter}`,
      "INVALID_FILTER",
      "filter",
    );
  }

  const filterObj = filter as Record<string, unknown>;

  if (!filterObj.namespace) {
    throw new MutableValidationError(
      "Filter must include namespace",
      "MISSING_NAMESPACE",
      "filter.namespace",
    );
  }

  // Validate individual filter fields
  validateNamespace(filterObj.namespace, "filter.namespace");
  validateNamespaceFormat(filterObj.namespace as string);

  if (filterObj.keyPrefix !== undefined) {
    validateKeyPrefix(filterObj.keyPrefix);
  }

  if (filterObj.userId !== undefined) {
    validateUserId(filterObj.userId);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Transaction Validators
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const VALID_OPERATIONS = ["set", "update", "delete", "increment", "decrement"];

/**
 * Validates operations array is non-empty
 */
export function validateOperationsArray(operations: unknown): void {
  if (operations === null || operations === undefined) {
    throw new MutableValidationError(
      "Operations array is required",
      "MISSING_OPERATIONS",
      "operations",
    );
  }

  if (!Array.isArray(operations)) {
    throw new MutableValidationError(
      `Operations must be an array, got ${typeof operations}`,
      "INVALID_OPERATIONS_ARRAY",
      "operations",
    );
  }

  if (operations.length === 0) {
    throw new MutableValidationError(
      "Operations array cannot be empty",
      "EMPTY_OPERATIONS_ARRAY",
      "operations",
    );
  }
}

/**
 * Validates individual transaction operation structure
 */
export function validateTransactionOperation(
  operation: unknown,
  index: number,
): void {
  if (
    operation === null ||
    operation === undefined ||
    typeof operation !== "object"
  ) {
    throw new MutableValidationError(
      `Operation at index ${index} must be an object`,
      "INVALID_TRANSACTION_OPERATION",
      `operations[${index}]`,
    );
  }

  const op = operation as Record<string, unknown>;

  // Validate required fields
  if (!op.op) {
    throw new MutableValidationError(
      `Operation at index ${index} is missing required field "op"`,
      "MISSING_OPERATION_FIELD",
      `operations[${index}].op`,
    );
  }

  if (typeof op.op !== "string" || !VALID_OPERATIONS.includes(op.op)) {
    throw new MutableValidationError(
      `Operation at index ${index} has invalid "op" value "${op.op}". Must be one of: ${VALID_OPERATIONS.join(", ")}`,
      "INVALID_OPERATION_TYPE",
      `operations[${index}].op`,
    );
  }

  if (!op.namespace) {
    throw new MutableValidationError(
      `Operation at index ${index} is missing required field "namespace"`,
      "MISSING_OPERATION_FIELD",
      `operations[${index}].namespace`,
    );
  }

  if (!op.key) {
    throw new MutableValidationError(
      `Operation at index ${index} is missing required field "key"`,
      "MISSING_OPERATION_FIELD",
      `operations[${index}].key`,
    );
  }

  // Validate namespace and key
  validateNamespace(op.namespace, `operations[${index}].namespace`);
  validateNamespaceFormat(op.namespace as string);
  validateKey(op.key, `operations[${index}].key`);
  validateKeyFormat(op.key as string);

  // Validate operation-specific fields
  if (op.op === "set") {
    if (op.value === undefined) {
      throw new MutableValidationError(
        `Operation at index ${index} with op="set" is missing required field "value"`,
        "MISSING_OPERATION_FIELD",
        `operations[${index}].value`,
      );
    }
  } else if (op.op === "update") {
    if (op.value === undefined) {
      throw new MutableValidationError(
        `Operation at index ${index} with op="update" is missing required field "value"`,
        "MISSING_OPERATION_FIELD",
        `operations[${index}].value`,
      );
    }
  } else if (op.op === "increment" || op.op === "decrement") {
    if (op.amount !== undefined) {
      validateAmount(op.amount, `operations[${index}].amount`);
    }
  }
  // delete operation has no additional required fields
}

/**
 * Validates complete transaction operations
 */
export function validateTransactionOperations(operations: unknown[]): void {
  for (let i = 0; i < operations.length; i++) {
    validateTransactionOperation(operations[i], i);
  }
}
