/**
 * Facts API Validation
 *
 * Client-side validation for facts operations to catch errors before
 * they reach the backend, providing faster feedback and better error messages.
 */

import type { UpdateFactInput } from "../types";

/**
 * Custom error class for facts validation failures
 */
export class FactsValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "FactsValidationError";
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Enum Constants
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const VALID_FACT_TYPES = [
  "preference",
  "identity",
  "knowledge",
  "relationship",
  "event",
  "observation",
  "custom",
] as const;

const VALID_SOURCE_TYPES = [
  "conversation",
  "system",
  "tool",
  "manual",
  "a2a",
] as const;

const VALID_EXPORT_FORMATS = ["json", "jsonld", "csv"] as const;

const VALID_SORT_BY_FIELDS = [
  "createdAt",
  "updatedAt",
  "confidence",
  "version",
] as const;

const VALID_TAG_MATCH = ["any", "all"] as const;
const VALID_SORT_ORDER = ["asc", "desc"] as const;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Required Field Validators
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates required string fields (non-null, non-empty, trimmed)
 */
export function validateRequiredString(
  value: string | undefined,
  fieldName: string,
): void {
  if (!value || typeof value !== "string" || value.trim().length === 0) {
    throw new FactsValidationError(
      `${fieldName} is required and cannot be empty`,
      "MISSING_REQUIRED_FIELD",
      fieldName,
    );
  }
}

/**
 * Validates required number fields (non-null, is number)
 */
export function validateRequiredNumber(
  value: number | undefined,
  fieldName: string,
): void {
  // Use as unknown for defensive runtime checks (value could come from untrusted input)
  if (
    (value as unknown) === undefined ||
    (value as unknown) === null ||
    typeof value !== "number"
  ) {
    throw new FactsValidationError(
      `${fieldName} is required and must be a number`,
      "MISSING_REQUIRED_FIELD",
      fieldName,
    );
  }

  if (isNaN(value)) {
    throw new FactsValidationError(
      `${fieldName} must be a valid number, got NaN`,
      "MISSING_REQUIRED_FIELD",
      fieldName,
    );
  }
}

/**
 * Validates required enum value
 */
export function validateRequiredEnum<T>(
  value: T | undefined,
  fieldName: string,
  allowedValues: readonly T[],
): void {
  if (value === undefined || value === null) {
    throw new FactsValidationError(
      `${fieldName} is required`,
      "MISSING_REQUIRED_FIELD",
      fieldName,
    );
  }

  if (!allowedValues.includes(value)) {
    throw new FactsValidationError(
      `Invalid ${fieldName} "${String(value)}". Valid values: ${allowedValues.join(", ")}`,
      `INVALID_${fieldName.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`,
      fieldName,
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Format Validators
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates factId format (should match "fact-*")
 */
export function validateFactIdFormat(
  factId: string,
  fieldName = "factId",
): void {
  if (!factId || typeof factId !== "string") {
    throw new FactsValidationError(
      `${fieldName} must be a non-empty string`,
      "INVALID_FACT_ID_FORMAT",
      fieldName,
    );
  }

  if (!factId.startsWith("fact-")) {
    throw new FactsValidationError(
      `${fieldName} must start with "fact-", got "${factId}"`,
      "INVALID_FACT_ID_FORMAT",
      fieldName,
    );
  }
}

/**
 * Validates memorySpaceId is non-empty
 */
export function validateMemorySpaceId(memorySpaceId: string): void {
  validateRequiredString(memorySpaceId, "memorySpaceId");
}

/**
 * Validates array of strings (tags, factIds)
 */
export function validateStringArray(
  arr: unknown,
  fieldName: string,
  allowEmpty = true,
): void {
  if (!Array.isArray(arr)) {
    throw new FactsValidationError(
      `${fieldName} must be an array`,
      "INVALID_ARRAY",
      fieldName,
    );
  }

  if (!allowEmpty && arr.length === 0) {
    throw new FactsValidationError(
      `${fieldName} must contain at least one element`,
      "EMPTY_ARRAY",
      fieldName,
    );
  }

  for (let i = 0; i < arr.length; i++) {
    if (typeof arr[i] !== "string") {
      throw new FactsValidationError(
        `${fieldName} must contain only strings, found ${typeof arr[i]} at index ${i}`,
        "INVALID_ARRAY",
        fieldName,
      );
    }
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Range/Boundary Validators
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates confidence score (0-100)
 */
export function validateConfidence(
  confidence: number,
  fieldName = "confidence",
): void {
  validateRequiredNumber(confidence, fieldName);

  if (confidence < 0 || confidence > 100) {
    throw new FactsValidationError(
      `${fieldName} must be between 0 and 100, got ${confidence}`,
      "INVALID_CONFIDENCE",
      fieldName,
    );
  }
}

/**
 * Validates non-negative integer (limit, offset)
 */
export function validateNonNegativeInteger(
  value: number | undefined,
  fieldName: string,
): void {
  if (value === undefined) {
    return;
  }

  if (typeof value !== "number" || isNaN(value)) {
    throw new FactsValidationError(
      `${fieldName} must be a valid number`,
      "INVALID_ARRAY",
      fieldName,
    );
  }

  if (value < 0) {
    throw new FactsValidationError(
      `${fieldName} must be non-negative, got ${value}`,
      "INVALID_ARRAY",
      fieldName,
    );
  }

  if (!Number.isInteger(value)) {
    throw new FactsValidationError(
      `${fieldName} must be an integer, got ${value}`,
      "INVALID_ARRAY",
      fieldName,
    );
  }
}

/**
 * Validates pagination parameters
 */
export function validatePagination(limit?: number, offset?: number): void {
  if (limit !== undefined) {
    validateNonNegativeInteger(limit, "limit");
  }
  if (offset !== undefined) {
    validateNonNegativeInteger(offset, "offset");
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Enum Validators
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates factType
 */
export function validateFactType(factType: string): void {
  if (!(VALID_FACT_TYPES as readonly string[]).includes(factType)) {
    throw new FactsValidationError(
      `Invalid factType "${factType}". Valid types: ${VALID_FACT_TYPES.join(", ")}`,
      "INVALID_FACT_TYPE",
      "factType",
    );
  }
}

/**
 * Validates sourceType
 */
export function validateSourceType(sourceType: string): void {
  if (!(VALID_SOURCE_TYPES as readonly string[]).includes(sourceType)) {
    throw new FactsValidationError(
      `Invalid sourceType "${sourceType}". Valid types: ${VALID_SOURCE_TYPES.join(", ")}`,
      "INVALID_SOURCE_TYPE",
      "sourceType",
    );
  }
}

/**
 * Validates export format
 */
export function validateExportFormat(format: string): void {
  if (!(VALID_EXPORT_FORMATS as readonly string[]).includes(format)) {
    throw new FactsValidationError(
      `Invalid format "${format}". Valid formats: ${VALID_EXPORT_FORMATS.join(", ")}`,
      "INVALID_EXPORT_FORMAT",
      "format",
    );
  }
}

/**
 * Validates sortBy field
 */
export function validateSortBy(sortBy: string): void {
  if (!(VALID_SORT_BY_FIELDS as readonly string[]).includes(sortBy)) {
    throw new FactsValidationError(
      `Invalid sortBy "${sortBy}". Valid fields: ${VALID_SORT_BY_FIELDS.join(", ")}`,
      "INVALID_SORT_BY",
      "sortBy",
    );
  }
}

/**
 * Validates tagMatch
 */
export function validateTagMatch(tagMatch: string): void {
  if (!(VALID_TAG_MATCH as readonly string[]).includes(tagMatch)) {
    throw new FactsValidationError(
      `Invalid tagMatch "${tagMatch}". Valid values: ${VALID_TAG_MATCH.join(", ")}`,
      "INVALID_TAG_MATCH",
      "tagMatch",
    );
  }
}

/**
 * Validates sortOrder
 */
export function validateSortOrder(sortOrder: string): void {
  if (!(VALID_SORT_ORDER as readonly string[]).includes(sortOrder)) {
    throw new FactsValidationError(
      `Invalid sortOrder "${sortOrder}". Valid values: ${VALID_SORT_ORDER.join(", ")}`,
      "INVALID_SORT_ORDER",
      "sortOrder",
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Date Validators
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates Date object is valid
 */
export function validateDate(date: Date | undefined, fieldName: string): void {
  if (date === undefined) {
    return;
  }

  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new FactsValidationError(
      `${fieldName} must be a valid Date object`,
      "INVALID_DATE_RANGE",
      fieldName,
    );
  }
}

/**
 * Validates date range (start < end)
 */
export function validateDateRange(
  start: Date | undefined,
  end: Date | undefined,
  startFieldName: string,
  endFieldName: string,
): void {
  if (!start || !end) {
    return;
  }

  validateDate(start, startFieldName);
  validateDate(end, endFieldName);

  if (start.getTime() >= end.getTime()) {
    throw new FactsValidationError(
      `${startFieldName} must be before ${endFieldName}`,
      "INVALID_DATE_RANGE",
    );
  }
}

/**
 * Validates validity period
 */
export function validateValidityPeriod(
  validFrom?: number,
  validUntil?: number,
): void {
  if (validFrom === undefined || validUntil === undefined) {
    return;
  }

  if (typeof validFrom !== "number" || typeof validUntil !== "number") {
    throw new FactsValidationError(
      "validFrom and validUntil must be numbers (timestamps)",
      "INVALID_VALIDITY_PERIOD",
    );
  }

  if (isNaN(validFrom) || isNaN(validUntil)) {
    throw new FactsValidationError(
      "validFrom and validUntil must be valid timestamps",
      "INVALID_VALIDITY_PERIOD",
    );
  }

  if (validFrom >= validUntil) {
    throw new FactsValidationError(
      "validFrom must be before validUntil",
      "INVALID_VALIDITY_PERIOD",
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Business Logic Validators
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates at least one field is provided for update
 */
export function validateUpdateHasFields(updates: UpdateFactInput): void {
  const hasFields =
    updates.fact !== undefined ||
    updates.confidence !== undefined ||
    updates.tags !== undefined ||
    updates.validUntil !== undefined ||
    updates.metadata !== undefined;

  if (!hasFields) {
    throw new FactsValidationError(
      "Update must include at least one field (fact, confidence, tags, validUntil, or metadata)",
      "INVALID_UPDATE",
    );
  }
}

/**
 * Validates consolidation parameters
 */
export function validateConsolidation(
  factIds: string[],
  keepFactId: string,
): void {
  // Must have at least 2 facts
  if (factIds.length < 2) {
    throw new FactsValidationError(
      `consolidation requires at least 2 facts, got ${factIds.length}`,
      "INVALID_CONSOLIDATION",
      "factIds",
    );
  }

  // keepFactId must be in factIds
  if (!factIds.includes(keepFactId)) {
    throw new FactsValidationError(
      `keepFactId "${keepFactId}" must be in factIds array`,
      "INVALID_CONSOLIDATION",
      "keepFactId",
    );
  }

  // No duplicate factIds
  const uniqueIds = new Set(factIds);
  if (uniqueIds.size !== factIds.length) {
    throw new FactsValidationError(
      "factIds array must not contain duplicates",
      "INVALID_CONSOLIDATION",
      "factIds",
    );
  }
}

/**
 * Validates sourceRef structure
 */
export function validateSourceRef(sourceRef: unknown): void {
  if (sourceRef === null || typeof sourceRef !== "object") {
    throw new FactsValidationError(
      "sourceRef must be an object",
      "INVALID_METADATA",
      "sourceRef",
    );
  }

  const ref = sourceRef as Record<string, unknown>;

  // Validate optional fields if present
  if (
    ref.conversationId !== undefined &&
    typeof ref.conversationId !== "string"
  ) {
    throw new FactsValidationError(
      "sourceRef.conversationId must be a string",
      "INVALID_METADATA",
      "sourceRef.conversationId",
    );
  }

  if (ref.messageIds !== undefined) {
    if (!Array.isArray(ref.messageIds)) {
      throw new FactsValidationError(
        "sourceRef.messageIds must be an array",
        "INVALID_METADATA",
        "sourceRef.messageIds",
      );
    }
    for (const id of ref.messageIds) {
      if (typeof id !== "string") {
        throw new FactsValidationError(
          "sourceRef.messageIds must contain only strings",
          "INVALID_METADATA",
          "sourceRef.messageIds",
        );
      }
    }
  }

  if (ref.memoryId !== undefined && typeof ref.memoryId !== "string") {
    throw new FactsValidationError(
      "sourceRef.memoryId must be a string",
      "INVALID_METADATA",
      "sourceRef.memoryId",
    );
  }
}

/**
 * Validates metadata is object
 */
export function validateMetadata(metadata: unknown): void {
  if (metadata === null || typeof metadata !== "object") {
    throw new FactsValidationError(
      "metadata must be an object",
      "INVALID_METADATA",
      "metadata",
    );
  }

  if (Array.isArray(metadata)) {
    throw new FactsValidationError(
      "metadata must be an object, not an array",
      "INVALID_METADATA",
      "metadata",
    );
  }
}
