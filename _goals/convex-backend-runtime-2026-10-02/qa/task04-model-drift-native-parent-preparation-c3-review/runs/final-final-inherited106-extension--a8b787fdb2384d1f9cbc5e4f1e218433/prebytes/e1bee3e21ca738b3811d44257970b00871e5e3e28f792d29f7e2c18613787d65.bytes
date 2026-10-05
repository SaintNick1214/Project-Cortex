/**
 * Cortex SDK - Artifacts API Validation
 *
 * Client-side validation for artifact operations to catch errors before
 * they reach the backend, providing faster feedback and better error messages.
 */

import type { ArtifactKind, StreamingState } from "../types";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Custom Error Class
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Custom error class for artifact validation failures
 */
export class ArtifactValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "ArtifactValidationError";
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Constants
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const ARTIFACT_ID_MAX_LENGTH = 100;
const TITLE_MAX_LENGTH = 500;
const CONTENT_MAX_SIZE = 10 * 1024 * 1024; // 10MB in bytes
const MAX_TAGS = 50;
const TAG_MAX_LENGTH = 100;
const MAX_LIMIT = 1000;

// Regex patterns (cached at module level for performance)
const ARTIFACT_ID_PATTERN = /^[a-zA-Z0-9-_.:]+$/;
const TAG_PATTERN = /^[a-zA-Z0-9-_.:]+$/;

// Valid enum values
const VALID_KINDS: ArtifactKind[] = [
  "text",
  "code",
  "sheet",
  "image",
  "diagram",
  "html",
  "custom",
];
const VALID_STREAMING_STATES: StreamingState[] = [
  "draft",
  "streaming",
  "paused",
  "final",
  "error",
];
const VALID_SORT_BY = ["createdAt", "updatedAt", "title", "accessCount"];
const VALID_SORT_ORDER = ["asc", "desc"];
const VALID_TAG_MATCH = ["any", "all"];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Required Field Validators
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates artifactId is non-empty string
 */
export function validateArtifactId(
  artifactId: unknown,
  fieldName = "artifactId",
): void {
  if (artifactId === null || artifactId === undefined) {
    throw new ArtifactValidationError(
      `${fieldName} is required`,
      "MISSING_ARTIFACT_ID",
      fieldName,
    );
  }

  if (typeof artifactId !== "string") {
    throw new ArtifactValidationError(
      `${fieldName} must be a string, got ${typeof artifactId}`,
      "INVALID_ARTIFACT_ID",
      fieldName,
    );
  }

  if (artifactId.trim().length === 0) {
    throw new ArtifactValidationError(
      `${fieldName} is required and cannot be empty`,
      "MISSING_ARTIFACT_ID",
      fieldName,
    );
  }
}

/**
 * Validates artifactId format (alphanumeric, hyphens, underscores, dots, colons)
 */
export function validateArtifactIdFormat(artifactId: string): void {
  if (artifactId.length > ARTIFACT_ID_MAX_LENGTH) {
    throw new ArtifactValidationError(
      `artifactId exceeds maximum length of ${ARTIFACT_ID_MAX_LENGTH} characters (got ${artifactId.length})`,
      "ARTIFACT_ID_TOO_LONG",
      "artifactId",
    );
  }

  if (!ARTIFACT_ID_PATTERN.test(artifactId)) {
    throw new ArtifactValidationError(
      `Invalid artifactId format "${artifactId}". Must contain only alphanumeric characters, hyphens, underscores, dots, and colons`,
      "INVALID_ARTIFACT_ID",
      "artifactId",
    );
  }
}

/**
 * Validates title is non-empty string
 */
export function validateTitle(title: unknown): void {
  if (title === null || title === undefined) {
    throw new ArtifactValidationError(
      "title is required",
      "MISSING_TITLE",
      "title",
    );
  }

  if (typeof title !== "string") {
    throw new ArtifactValidationError(
      `title must be a string, got ${typeof title}`,
      "INVALID_TITLE",
      "title",
    );
  }

  if (title.trim().length === 0) {
    throw new ArtifactValidationError(
      "title is required and cannot be empty",
      "MISSING_TITLE",
      "title",
    );
  }
}

/**
 * Validates title length
 */
export function validateTitleLength(title: string): void {
  if (title.length > TITLE_MAX_LENGTH) {
    throw new ArtifactValidationError(
      `title exceeds maximum length of ${TITLE_MAX_LENGTH} characters (got ${title.length})`,
      "TITLE_TOO_LONG",
      "title",
    );
  }
}

/**
 * Validates content is provided
 */
export function validateContent(content: unknown): void {
  if (content === undefined) {
    throw new ArtifactValidationError(
      "content is required",
      "MISSING_CONTENT",
      "content",
    );
  }

  if (typeof content !== "string") {
    throw new ArtifactValidationError(
      `content must be a string, got ${typeof content}`,
      "INVALID_CONTENT",
      "content",
    );
  }
}

/**
 * Validates content size (max 10MB)
 */
export function validateContentSize(content: string): void {
  const sizeInBytes = new Blob([content]).size;

  if (sizeInBytes > CONTENT_MAX_SIZE) {
    const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2);
    throw new ArtifactValidationError(
      `content exceeds maximum size of 10MB (got ${sizeInMB}MB)`,
      "CONTENT_TOO_LARGE",
      "content",
    );
  }
}

/**
 * Validates memorySpaceId is non-empty string
 */
export function validateMemorySpaceId(memorySpaceId: unknown): void {
  if (memorySpaceId === null || memorySpaceId === undefined) {
    throw new ArtifactValidationError(
      "memorySpaceId is required",
      "MISSING_MEMORY_SPACE_ID",
      "memorySpaceId",
    );
  }

  if (typeof memorySpaceId !== "string") {
    throw new ArtifactValidationError(
      `memorySpaceId must be a string, got ${typeof memorySpaceId}`,
      "INVALID_MEMORY_SPACE_ID",
      "memorySpaceId",
    );
  }

  if (memorySpaceId.trim().length === 0) {
    throw new ArtifactValidationError(
      "memorySpaceId is required and cannot be empty",
      "MISSING_MEMORY_SPACE_ID",
      "memorySpaceId",
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Enum Validators
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates kind is a valid ArtifactKind value
 */
export function validateKind(kind: unknown): void {
  if (kind === null || kind === undefined) {
    return; // Optional, defaults to "text"
  }

  if (typeof kind !== "string") {
    throw new ArtifactValidationError(
      `kind must be a string, got ${typeof kind}`,
      "INVALID_KIND_TYPE",
      "kind",
    );
  }

  if (!VALID_KINDS.includes(kind as ArtifactKind)) {
    throw new ArtifactValidationError(
      `kind must be one of: ${VALID_KINDS.join(", ")}. Got "${kind}"`,
      "INVALID_KIND_VALUE",
      "kind",
    );
  }
}

/**
 * Validates streamingState is a valid StreamingState value
 */
export function validateStreamingState(streamingState: unknown): void {
  if (streamingState === null || streamingState === undefined) {
    return; // Optional, defaults to "draft"
  }

  if (typeof streamingState !== "string") {
    throw new ArtifactValidationError(
      `streamingState must be a string, got ${typeof streamingState}`,
      "INVALID_STREAMING_STATE_TYPE",
      "streamingState",
    );
  }

  if (!VALID_STREAMING_STATES.includes(streamingState as StreamingState)) {
    throw new ArtifactValidationError(
      `streamingState must be one of: ${VALID_STREAMING_STATES.join(", ")}. Got "${streamingState}"`,
      "INVALID_STREAMING_STATE_VALUE",
      "streamingState",
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Array Validators
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates tags array
 */
export function validateTags(tags: unknown): void {
  if (tags === null || tags === undefined) {
    return; // Optional
  }

  if (!Array.isArray(tags)) {
    throw new ArtifactValidationError(
      `tags must be an array, got ${typeof tags}`,
      "INVALID_TAGS_TYPE",
      "tags",
    );
  }

  if (tags.length > MAX_TAGS) {
    throw new ArtifactValidationError(
      `tags array exceeds maximum of ${MAX_TAGS} items (got ${tags.length})`,
      "TOO_MANY_TAGS",
      "tags",
    );
  }

  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i];
    if (typeof tag !== "string") {
      throw new ArtifactValidationError(
        `tags[${i}] must be a string, got ${typeof tag}`,
        "INVALID_TAG_TYPE",
        `tags[${i}]`,
      );
    }
    if (tag.length > TAG_MAX_LENGTH) {
      throw new ArtifactValidationError(
        `tags[${i}] exceeds maximum length of ${TAG_MAX_LENGTH} characters`,
        "TAG_TOO_LONG",
        `tags[${i}]`,
      );
    }
    if (!TAG_PATTERN.test(tag)) {
      throw new ArtifactValidationError(
        `tags[${i}] contains invalid characters. Must contain only alphanumeric characters, hyphens, underscores, dots, and colons`,
        "INVALID_TAG_FORMAT",
        `tags[${i}]`,
      );
    }
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
    throw new ArtifactValidationError(
      `limit must be a number, got ${typeof limit}`,
      "INVALID_LIMIT_TYPE",
      "limit",
    );
  }

  if (!Number.isInteger(limit)) {
    throw new ArtifactValidationError(
      `limit must be an integer, got ${limit}`,
      "INVALID_LIMIT_TYPE",
      "limit",
    );
  }

  if (limit < 1) {
    throw new ArtifactValidationError(
      `limit must be at least 1, got ${limit}`,
      "INVALID_LIMIT_RANGE",
      "limit",
    );
  }

  if (limit > MAX_LIMIT) {
    throw new ArtifactValidationError(
      `limit exceeds maximum of ${MAX_LIMIT}, got ${limit}`,
      "INVALID_LIMIT_RANGE",
      "limit",
    );
  }
}

/**
 * Validates offset is non-negative integer
 */
export function validateOffset(offset: unknown): void {
  if (offset === null || offset === undefined) {
    return; // Optional
  }

  if (typeof offset !== "number") {
    throw new ArtifactValidationError(
      `offset must be a number, got ${typeof offset}`,
      "INVALID_OFFSET_TYPE",
      "offset",
    );
  }

  if (!Number.isInteger(offset)) {
    throw new ArtifactValidationError(
      `offset must be an integer, got ${offset}`,
      "INVALID_OFFSET_TYPE",
      "offset",
    );
  }

  if (offset < 0) {
    throw new ArtifactValidationError(
      `offset must be non-negative, got ${offset}`,
      "INVALID_OFFSET_RANGE",
      "offset",
    );
  }
}

/**
 * Validates timestamp is a valid Unix timestamp (positive number)
 */
export function validateTimestamp(timestamp: unknown, fieldName: string): void {
  if (timestamp === null || timestamp === undefined) {
    return; // Optional
  }

  if (typeof timestamp !== "number") {
    throw new ArtifactValidationError(
      `${fieldName} must be a number, got ${typeof timestamp}`,
      "INVALID_TIMESTAMP_TYPE",
      fieldName,
    );
  }

  if (!Number.isFinite(timestamp) || timestamp < 0) {
    throw new ArtifactValidationError(
      `${fieldName} must be a valid Unix timestamp (positive number), got ${timestamp}`,
      "INVALID_TIMESTAMP_VALUE",
      fieldName,
    );
  }
}

/**
 * Validates version is a positive integer
 */
export function validateVersion(version: unknown): void {
  if (version === null || version === undefined) {
    throw new ArtifactValidationError(
      "version is required",
      "MISSING_VERSION",
      "version",
    );
  }

  if (typeof version !== "number") {
    throw new ArtifactValidationError(
      `version must be a number, got ${typeof version}`,
      "INVALID_VERSION_TYPE",
      "version",
    );
  }

  if (!Number.isInteger(version) || version < 1) {
    throw new ArtifactValidationError(
      `version must be a positive integer, got ${version}`,
      "INVALID_VERSION",
      "version",
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Sort Validators
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates sortBy field
 */
export function validateSortBy(sortBy: unknown): void {
  if (sortBy === null || sortBy === undefined) {
    return; // Optional
  }

  if (typeof sortBy !== "string") {
    throw new ArtifactValidationError(
      `sortBy must be a string, got ${typeof sortBy}`,
      "INVALID_SORT_BY_TYPE",
      "sortBy",
    );
  }

  if (!VALID_SORT_BY.includes(sortBy)) {
    throw new ArtifactValidationError(
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
    throw new ArtifactValidationError(
      `sortOrder must be a string, got ${typeof sortOrder}`,
      "INVALID_SORT_ORDER_TYPE",
      "sortOrder",
    );
  }

  if (!VALID_SORT_ORDER.includes(sortOrder)) {
    throw new ArtifactValidationError(
      `sortOrder must be one of: ${VALID_SORT_ORDER.join(", ")}. Got "${sortOrder}"`,
      "INVALID_SORT_ORDER_VALUE",
      "sortOrder",
    );
  }
}

/**
 * Validates tagMatch
 */
export function validateTagMatch(tagMatch: unknown): void {
  if (tagMatch === null || tagMatch === undefined) {
    return; // Optional
  }

  if (typeof tagMatch !== "string") {
    throw new ArtifactValidationError(
      `tagMatch must be a string, got ${typeof tagMatch}`,
      "INVALID_TAG_MATCH_TYPE",
      "tagMatch",
    );
  }

  if (!VALID_TAG_MATCH.includes(tagMatch)) {
    throw new ArtifactValidationError(
      `tagMatch must be one of: ${VALID_TAG_MATCH.join(", ")}. Got "${tagMatch}"`,
      "INVALID_TAG_MATCH_VALUE",
      "tagMatch",
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Object Validators
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates FileReference object
 */
export function validateFileReference(fileRef: unknown): void {
  if (fileRef === null || fileRef === undefined) {
    throw new ArtifactValidationError(
      "fileRef is required",
      "MISSING_FILE_REF",
      "fileRef",
    );
  }

  if (typeof fileRef !== "object" || Array.isArray(fileRef)) {
    throw new ArtifactValidationError(
      `fileRef must be an object, got ${typeof fileRef}`,
      "INVALID_FILE_REF",
      "fileRef",
    );
  }

  const ref = fileRef as Record<string, unknown>;

  // Required fields
  if (!ref.fileId || typeof ref.fileId !== "string") {
    throw new ArtifactValidationError(
      "fileRef.fileId is required and must be a string",
      "INVALID_FILE_REF",
      "fileRef.fileId",
    );
  }

  if (!ref.filename || typeof ref.filename !== "string") {
    throw new ArtifactValidationError(
      "fileRef.filename is required and must be a string",
      "INVALID_FILE_REF",
      "fileRef.filename",
    );
  }

  if (!ref.mimeType || typeof ref.mimeType !== "string") {
    throw new ArtifactValidationError(
      "fileRef.mimeType is required and must be a string",
      "INVALID_FILE_REF",
      "fileRef.mimeType",
    );
  }

  if (typeof ref.sizeBytes !== "number" || ref.sizeBytes < 0) {
    throw new ArtifactValidationError(
      "fileRef.sizeBytes is required and must be a non-negative number",
      "INVALID_FILE_REF",
      "fileRef.sizeBytes",
    );
  }

  if (!ref.url || typeof ref.url !== "string") {
    throw new ArtifactValidationError(
      "fileRef.url is required and must be a string",
      "INVALID_FILE_REF",
      "fileRef.url",
    );
  }
}

/**
 * Validates streaming session ID
 */
export function validateSessionId(sessionId: unknown): void {
  if (sessionId === null || sessionId === undefined) {
    throw new ArtifactValidationError(
      "sessionId is required",
      "MISSING_SESSION_ID",
      "sessionId",
    );
  }

  if (typeof sessionId !== "string") {
    throw new ArtifactValidationError(
      `sessionId must be a string, got ${typeof sessionId}`,
      "INVALID_SESSION_ID",
      "sessionId",
    );
  }

  if (sessionId.trim().length === 0) {
    throw new ArtifactValidationError(
      "sessionId cannot be empty",
      "INVALID_SESSION_ID",
      "sessionId",
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Composite Validators
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates CreateArtifactOptions
 */
export function validateCreateOptions(options: unknown): void {
  if (options === null || options === undefined) {
    throw new ArtifactValidationError(
      "options is required",
      "MISSING_OPTIONS",
      "options",
    );
  }

  if (typeof options !== "object" || Array.isArray(options)) {
    throw new ArtifactValidationError(
      `options must be an object, got ${typeof options}`,
      "INVALID_OPTIONS",
      "options",
    );
  }

  const opts = options as Record<string, unknown>;

  // Required fields
  validateMemorySpaceId(opts.memorySpaceId);
  validateTitle(opts.title);
  validateTitleLength(opts.title as string);
  validateContent(opts.content);
  validateContentSize(opts.content as string);

  // Optional fields
  validateKind(opts.kind);
  validateStreamingState(opts.streamingState);
  validateTags(opts.tags);

  // Validate artifactId if provided
  if (opts.artifactId !== undefined) {
    validateArtifactId(opts.artifactId);
    validateArtifactIdFormat(opts.artifactId as string);
  }
}

/**
 * Validates UpdateArtifactOptions
 */
export function validateUpdateOptions(options: unknown): void {
  if (options === null || options === undefined) {
    return; // Optional parameter
  }

  if (typeof options !== "object" || Array.isArray(options)) {
    throw new ArtifactValidationError(
      `options must be an object, got ${typeof options}`,
      "INVALID_OPTIONS",
      "options",
    );
  }

  const opts = options as Record<string, unknown>;

  // All fields are optional
  if (opts.title !== undefined) {
    validateTitle(opts.title);
    validateTitleLength(opts.title as string);
  }

  validateKind(opts.kind);
  validateTags(opts.tags);
}

/**
 * Validates ListArtifactsFilter
 */
export function validateListFilter(filter: unknown): void {
  if (filter === null || filter === undefined) {
    throw new ArtifactValidationError(
      "filter is required",
      "MISSING_FILTER",
      "filter",
    );
  }

  if (typeof filter !== "object" || Array.isArray(filter)) {
    throw new ArtifactValidationError(
      `filter must be an object, got ${typeof filter}`,
      "INVALID_FILTER",
      "filter",
    );
  }

  const f = filter as Record<string, unknown>;

  // Required field
  validateMemorySpaceId(f.memorySpaceId);

  // Optional fields
  validateKind(f.kind);
  validateStreamingState(f.streamingState);
  validateTags(f.tags);
  validateTagMatch(f.tagMatch);
  validateLimit(f.limit);
  validateOffset(f.offset);
  validateSortBy(f.sortBy);
  validateSortOrder(f.sortOrder);
  validateTimestamp(f.createdAfter, "createdAfter");
  validateTimestamp(f.createdBefore, "createdBefore");
  validateTimestamp(f.updatedAfter, "updatedAfter");
  validateTimestamp(f.updatedBefore, "updatedBefore");
}

/**
 * Validates CountArtifactsFilter
 */
export function validateCountFilter(filter: unknown): void {
  if (filter === null || filter === undefined) {
    throw new ArtifactValidationError(
      "filter is required",
      "MISSING_FILTER",
      "filter",
    );
  }

  if (typeof filter !== "object" || Array.isArray(filter)) {
    throw new ArtifactValidationError(
      `filter must be an object, got ${typeof filter}`,
      "INVALID_FILTER",
      "filter",
    );
  }

  const f = filter as Record<string, unknown>;

  // Required field
  validateMemorySpaceId(f.memorySpaceId);

  // Optional fields
  validateKind(f.kind);
  validateStreamingState(f.streamingState);
  validateTags(f.tags);
  validateTagMatch(f.tagMatch);
}

/**
 * Validates GetArtifactHistoryOptions
 */
export function validateHistoryOptions(options: unknown): void {
  if (options === null || options === undefined) {
    return; // Optional parameter
  }

  if (typeof options !== "object" || Array.isArray(options)) {
    throw new ArtifactValidationError(
      `options must be an object, got ${typeof options}`,
      "INVALID_OPTIONS",
      "options",
    );
  }

  const opts = options as Record<string, unknown>;

  validateLimit(opts.limit);

  if (opts.fromVersion !== undefined) {
    if (
      typeof opts.fromVersion !== "number" ||
      !Number.isInteger(opts.fromVersion) ||
      opts.fromVersion < 1
    ) {
      throw new ArtifactValidationError(
        "fromVersion must be a positive integer",
        "INVALID_FROM_VERSION",
        "fromVersion",
      );
    }
  }

  if (opts.toVersion !== undefined) {
    if (
      typeof opts.toVersion !== "number" ||
      !Number.isInteger(opts.toVersion) ||
      opts.toVersion < 1
    ) {
      throw new ArtifactValidationError(
        "toVersion must be a positive integer",
        "INVALID_TO_VERSION",
        "toVersion",
      );
    }
  }
}

/**
 * Validates streaming start parameters
 */
export function validateStartStreamingParams(params: unknown): void {
  if (params === null || params === undefined) {
    throw new ArtifactValidationError(
      "params is required",
      "MISSING_PARAMS",
      "params",
    );
  }

  if (typeof params !== "object" || Array.isArray(params)) {
    throw new ArtifactValidationError(
      `params must be an object, got ${typeof params}`,
      "INVALID_PARAMS",
      "params",
    );
  }

  const p = params as Record<string, unknown>;

  validateArtifactId(p.artifactId);
  validateArtifactIdFormat(p.artifactId as string);
}

/**
 * Validates append content parameters
 */
export function validateAppendContentParams(params: unknown): void {
  if (params === null || params === undefined) {
    throw new ArtifactValidationError(
      "params is required",
      "MISSING_PARAMS",
      "params",
    );
  }

  if (typeof params !== "object" || Array.isArray(params)) {
    throw new ArtifactValidationError(
      `params must be an object, got ${typeof params}`,
      "INVALID_PARAMS",
      "params",
    );
  }

  const p = params as Record<string, unknown>;

  validateArtifactId(p.artifactId);
  validateArtifactIdFormat(p.artifactId as string);
  validateSessionId(p.sessionId);

  if (p.chunk === undefined || typeof p.chunk !== "string") {
    throw new ArtifactValidationError(
      "chunk is required and must be a string",
      "INVALID_CHUNK",
      "chunk",
    );
  }
}
