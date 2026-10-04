/**
 * Cortex SDK - Attachments API Validation
 *
 * Client-side validation for attachment operations to catch errors before
 * they reach the backend, providing faster feedback and better error messages.
 */

import type { AttachmentType } from "../types";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Custom Error Class
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Custom error class for attachment validation failures
 */
export class AttachmentValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "AttachmentValidationError";
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Constants
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const ATTACHMENT_ID_MAX_LENGTH = 100;
const FILENAME_MAX_LENGTH = 255;
const MAX_LIMIT = 1000;

// Regex patterns (reserved for future format validation)
const _ID_PATTERN = /^[a-zA-Z0-9-_.:]+$/;

// Valid enum values
const VALID_ATTACHMENT_TYPES: AttachmentType[] = [
  "image",
  "audio",
  "video",
  "file",
  "pdf",
];

const VALID_SORT_BY = ["createdAt", "updatedAt"];
const VALID_SORT_ORDER = ["asc", "desc"];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Required Field Validators
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates attachmentId is non-empty string
 */
export function validateAttachmentId(
  attachmentId: unknown,
  fieldName = "attachmentId",
): void {
  if (attachmentId === null || attachmentId === undefined) {
    throw new AttachmentValidationError(
      `${fieldName} is required`,
      "MISSING_ATTACHMENT_ID",
      fieldName,
    );
  }

  if (typeof attachmentId !== "string") {
    throw new AttachmentValidationError(
      `${fieldName} must be a string, got ${typeof attachmentId}`,
      "INVALID_ATTACHMENT_ID",
      fieldName,
    );
  }

  if (attachmentId.trim().length === 0) {
    throw new AttachmentValidationError(
      `${fieldName} is required and cannot be empty`,
      "MISSING_ATTACHMENT_ID",
      fieldName,
    );
  }

  if (attachmentId.length > ATTACHMENT_ID_MAX_LENGTH) {
    throw new AttachmentValidationError(
      `${fieldName} exceeds maximum length of ${ATTACHMENT_ID_MAX_LENGTH} characters`,
      "ATTACHMENT_ID_TOO_LONG",
      fieldName,
    );
  }
}

/**
 * Validates storageId is non-empty string
 */
export function validateStorageId(storageId: unknown): void {
  if (storageId === null || storageId === undefined) {
    throw new AttachmentValidationError(
      "storageId is required",
      "MISSING_STORAGE_ID",
      "storageId",
    );
  }

  if (typeof storageId !== "string") {
    throw new AttachmentValidationError(
      `storageId must be a string, got ${typeof storageId}`,
      "INVALID_STORAGE_ID",
      "storageId",
    );
  }

  if (storageId.trim().length === 0) {
    throw new AttachmentValidationError(
      "storageId is required and cannot be empty",
      "MISSING_STORAGE_ID",
      "storageId",
    );
  }
}

/**
 * Validates memorySpaceId is non-empty string
 */
export function validateMemorySpaceId(memorySpaceId: unknown): void {
  if (memorySpaceId === null || memorySpaceId === undefined) {
    throw new AttachmentValidationError(
      "memorySpaceId is required",
      "MISSING_MEMORY_SPACE_ID",
      "memorySpaceId",
    );
  }

  if (typeof memorySpaceId !== "string") {
    throw new AttachmentValidationError(
      `memorySpaceId must be a string, got ${typeof memorySpaceId}`,
      "INVALID_MEMORY_SPACE_ID",
      "memorySpaceId",
    );
  }

  if (memorySpaceId.trim().length === 0) {
    throw new AttachmentValidationError(
      "memorySpaceId is required and cannot be empty",
      "MISSING_MEMORY_SPACE_ID",
      "memorySpaceId",
    );
  }
}

/**
 * Validates userId is non-empty string
 */
export function validateUserId(userId: unknown): void {
  if (userId === null || userId === undefined) {
    throw new AttachmentValidationError(
      "userId is required",
      "MISSING_USER_ID",
      "userId",
    );
  }

  if (typeof userId !== "string") {
    throw new AttachmentValidationError(
      `userId must be a string, got ${typeof userId}`,
      "INVALID_USER_ID",
      "userId",
    );
  }

  if (userId.trim().length === 0) {
    throw new AttachmentValidationError(
      "userId is required and cannot be empty",
      "MISSING_USER_ID",
      "userId",
    );
  }
}

/**
 * Validates mimeType is valid format
 */
export function validateMimeType(mimeType: unknown): void {
  if (mimeType === null || mimeType === undefined) {
    throw new AttachmentValidationError(
      "mimeType is required",
      "MISSING_MIME_TYPE",
      "mimeType",
    );
  }

  if (typeof mimeType !== "string") {
    throw new AttachmentValidationError(
      `mimeType must be a string, got ${typeof mimeType}`,
      "INVALID_MIME_TYPE",
      "mimeType",
    );
  }

  if (!mimeType.includes("/")) {
    throw new AttachmentValidationError(
      "mimeType must be a valid MIME type (e.g., image/png)",
      "INVALID_MIME_TYPE",
      "mimeType",
    );
  }
}

/**
 * Validates filename is non-empty string
 */
export function validateFilename(filename: unknown): void {
  if (filename === null || filename === undefined) {
    throw new AttachmentValidationError(
      "filename is required",
      "MISSING_FILENAME",
      "filename",
    );
  }

  if (typeof filename !== "string") {
    throw new AttachmentValidationError(
      `filename must be a string, got ${typeof filename}`,
      "INVALID_FILENAME",
      "filename",
    );
  }

  if (filename.trim().length === 0) {
    throw new AttachmentValidationError(
      "filename is required and cannot be empty",
      "MISSING_FILENAME",
      "filename",
    );
  }

  if (filename.length > FILENAME_MAX_LENGTH) {
    throw new AttachmentValidationError(
      `filename exceeds maximum length of ${FILENAME_MAX_LENGTH} characters`,
      "FILENAME_TOO_LONG",
      "filename",
    );
  }
}

/**
 * Validates file size is positive number
 */
export function validateFileSize(size: unknown): void {
  if (size === null || size === undefined) {
    throw new AttachmentValidationError(
      "size is required",
      "MISSING_SIZE",
      "size",
    );
  }

  if (typeof size !== "number") {
    throw new AttachmentValidationError(
      `size must be a number, got ${typeof size}`,
      "INVALID_SIZE",
      "size",
    );
  }

  if (size <= 0) {
    throw new AttachmentValidationError(
      "size must be a positive number",
      "INVALID_SIZE",
      "size",
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Enum Validators
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates attachment type is a valid AttachmentType value
 */
export function validateAttachmentType(type: unknown): void {
  if (type === null || type === undefined) {
    throw new AttachmentValidationError(
      "type is required",
      "MISSING_TYPE",
      "type",
    );
  }

  if (typeof type !== "string") {
    throw new AttachmentValidationError(
      `type must be a string, got ${typeof type}`,
      "INVALID_TYPE",
      "type",
    );
  }

  if (!VALID_ATTACHMENT_TYPES.includes(type as AttachmentType)) {
    throw new AttachmentValidationError(
      `type must be one of: ${VALID_ATTACHMENT_TYPES.join(", ")}. Got "${type}"`,
      "INVALID_TYPE_VALUE",
      "type",
    );
  }
}

/**
 * Validates optional attachment type
 */
export function validateOptionalAttachmentType(type: unknown): void {
  if (type === null || type === undefined) {
    return; // Optional
  }
  validateAttachmentType(type);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Optional Field Validators
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates dimensions object
 */
export function validateDimensions(
  dimensions: unknown,
): void {
  if (dimensions === null || dimensions === undefined) {
    return; // Optional
  }

  if (typeof dimensions !== "object" || Array.isArray(dimensions)) {
    throw new AttachmentValidationError(
      `dimensions must be an object, got ${typeof dimensions}`,
      "INVALID_DIMENSIONS",
      "dimensions",
    );
  }

  const dim = dimensions as Record<string, unknown>;

  if (typeof dim.width !== "number" || dim.width <= 0) {
    throw new AttachmentValidationError(
      "dimensions.width must be a positive number",
      "INVALID_DIMENSIONS",
      "dimensions.width",
    );
  }

  if (typeof dim.height !== "number" || dim.height <= 0) {
    throw new AttachmentValidationError(
      "dimensions.height must be a positive number",
      "INVALID_DIMENSIONS",
      "dimensions.height",
    );
  }
}

/**
 * Validates duration is positive number
 */
export function validateDuration(duration: unknown): void {
  if (duration === null || duration === undefined) {
    return; // Optional
  }

  if (typeof duration !== "number") {
    throw new AttachmentValidationError(
      `duration must be a number, got ${typeof duration}`,
      "INVALID_DURATION",
      "duration",
    );
  }

  if (duration <= 0) {
    throw new AttachmentValidationError(
      "duration must be a positive number",
      "INVALID_DURATION",
      "duration",
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
    return; // Optional
  }

  if (typeof limit !== "number") {
    throw new AttachmentValidationError(
      `limit must be a number, got ${typeof limit}`,
      "INVALID_LIMIT_TYPE",
      "limit",
    );
  }

  if (!Number.isInteger(limit)) {
    throw new AttachmentValidationError(
      `limit must be an integer, got ${limit}`,
      "INVALID_LIMIT_TYPE",
      "limit",
    );
  }

  if (limit < 1) {
    throw new AttachmentValidationError(
      `limit must be at least 1, got ${limit}`,
      "INVALID_LIMIT_RANGE",
      "limit",
    );
  }

  if (limit > MAX_LIMIT) {
    throw new AttachmentValidationError(
      `limit exceeds maximum of ${MAX_LIMIT}, got ${limit}`,
      "INVALID_LIMIT_RANGE",
      "limit",
    );
  }
}

/**
 * Validates sortBy field
 */
export function validateSortBy(sortBy: unknown): void {
  if (sortBy === null || sortBy === undefined) {
    return; // Optional
  }

  if (typeof sortBy !== "string") {
    throw new AttachmentValidationError(
      `sortBy must be a string, got ${typeof sortBy}`,
      "INVALID_SORT_BY_TYPE",
      "sortBy",
    );
  }

  if (!VALID_SORT_BY.includes(sortBy)) {
    throw new AttachmentValidationError(
      `sortBy must be one of: ${VALID_SORT_BY.join(", ")}. Got "${sortBy}"`,
      "INVALID_SORT_BY_VALUE",
      "sortBy",
    );
  }
}

/**
 * Validates sortOrder
 */
export function validateSortOrder(sortOrder: unknown): void {
  if (sortOrder === null || sortOrder === undefined) {
    return; // Optional
  }

  if (typeof sortOrder !== "string") {
    throw new AttachmentValidationError(
      `sortOrder must be a string, got ${typeof sortOrder}`,
      "INVALID_SORT_ORDER_TYPE",
      "sortOrder",
    );
  }

  if (!VALID_SORT_ORDER.includes(sortOrder)) {
    throw new AttachmentValidationError(
      `sortOrder must be one of: ${VALID_SORT_ORDER.join(", ")}. Got "${sortOrder}"`,
      "INVALID_SORT_ORDER_VALUE",
      "sortOrder",
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Composite Validators
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates AttachParams
 */
export function validateAttachParams(params: unknown): void {
  if (params === null || params === undefined) {
    throw new AttachmentValidationError(
      "params is required",
      "MISSING_PARAMS",
      "params",
    );
  }

  if (typeof params !== "object" || Array.isArray(params)) {
    throw new AttachmentValidationError(
      `params must be an object, got ${typeof params}`,
      "INVALID_PARAMS",
      "params",
    );
  }

  const p = params as Record<string, unknown>;

  // Required fields
  validateStorageId(p.storageId);
  validateMemorySpaceId(p.memorySpaceId);
  validateUserId(p.userId);
  validateAttachmentType(p.type);
  validateMimeType(p.mimeType);
  validateFilename(p.filename);
  validateFileSize(p.size);

  // Optional fields
  validateDimensions(p.dimensions);
  validateDuration(p.duration);
}

/**
 * Validates ListAttachmentsFilter
 */
export function validateListAttachmentsFilter(filter: unknown): void {
  if (filter === null || filter === undefined) {
    throw new AttachmentValidationError(
      "filter is required",
      "MISSING_FILTER",
      "filter",
    );
  }

  if (typeof filter !== "object" || Array.isArray(filter)) {
    throw new AttachmentValidationError(
      `filter must be an object, got ${typeof filter}`,
      "INVALID_FILTER",
      "filter",
    );
  }

  const f = filter as Record<string, unknown>;

  // Required field
  validateMemorySpaceId(f.memorySpaceId);

  // Optional fields
  validateOptionalAttachmentType(f.type);
  validateLimit(f.limit);
  validateSortBy(f.sortBy);
  validateSortOrder(f.sortOrder);
}

/**
 * Validates attachment IDs array for bulk operations
 */
export function validateAttachmentIds(attachmentIds: unknown): void {
  if (attachmentIds === null || attachmentIds === undefined) {
    throw new AttachmentValidationError(
      "attachmentIds is required",
      "MISSING_ATTACHMENT_IDS",
      "attachmentIds",
    );
  }

  if (!Array.isArray(attachmentIds)) {
    throw new AttachmentValidationError(
      `attachmentIds must be an array, got ${typeof attachmentIds}`,
      "INVALID_ATTACHMENT_IDS",
      "attachmentIds",
    );
  }

  for (let i = 0; i < attachmentIds.length; i++) {
    validateAttachmentId(attachmentIds[i], `attachmentIds[${i}]`);
  }
}
