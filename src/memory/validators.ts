/**
 * Memory API Validation
 *
 * Client-side validation for memory operations to catch errors before
 * they reach the backend, providing faster feedback and better error messages.
 */

import type {
  RememberParams,
  StoreMemoryInput,
  SearchMemoryOptions,
  SourceType,
} from "../types";

/**
 * Custom error class for memory validation failures
 */
export class MemoryValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "MemoryValidationError";
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Required Field Validators
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates memorySpaceId is non-empty string
 */
export function validateMemorySpaceId(
  memorySpaceId: string,
  fieldName = "memorySpaceId",
): void {
  if (typeof memorySpaceId !== "string") {
    throw new MemoryValidationError(
      `${fieldName} is required and must be a string`,
      "MISSING_REQUIRED_FIELD",
      fieldName,
    );
  }

  if (memorySpaceId.trim().length === 0) {
    throw new MemoryValidationError(
      `${fieldName} cannot be empty`,
      "MISSING_REQUIRED_FIELD",
      fieldName,
    );
  }
}

/**
 * Validates memoryId is non-empty string
 */
export function validateMemoryId(
  memoryId: string,
  fieldName = "memoryId",
): void {
  if (typeof memoryId !== "string") {
    throw new MemoryValidationError(
      `${fieldName} is required and must be a string`,
      "MISSING_REQUIRED_FIELD",
      fieldName,
    );
  }

  if (memoryId.trim().length === 0) {
    throw new MemoryValidationError(
      `${fieldName} cannot be empty`,
      "MISSING_REQUIRED_FIELD",
      fieldName,
    );
  }
}

/**
 * Validates userId is non-empty string
 */
export function validateUserId(userId: string, fieldName = "userId"): void {
  if (typeof userId !== "string") {
    throw new MemoryValidationError(
      `${fieldName} is required and must be a string`,
      "MISSING_REQUIRED_FIELD",
      fieldName,
    );
  }

  if (userId.trim().length === 0) {
    throw new MemoryValidationError(
      `${fieldName} cannot be empty`,
      "MISSING_REQUIRED_FIELD",
      fieldName,
    );
  }
}

/**
 * Validates conversationId is non-empty string
 */
export function validateConversationId(
  conversationId: string,
  fieldName = "conversationId",
): void {
  if (typeof conversationId !== "string") {
    throw new MemoryValidationError(
      `${fieldName} is required and must be a string`,
      "MISSING_REQUIRED_FIELD",
      fieldName,
    );
  }

  if (conversationId.trim().length === 0) {
    throw new MemoryValidationError(
      `${fieldName} cannot be empty`,
      "MISSING_REQUIRED_FIELD",
      fieldName,
    );
  }
}

/**
 * Validates content is non-empty string
 */
export function validateContent(content: string, fieldName = "content"): void {
  if (typeof content !== "string") {
    throw new MemoryValidationError(
      `${fieldName} is required and must be a string`,
      "MISSING_REQUIRED_FIELD",
      fieldName,
    );
  }

  if (content.trim().length === 0) {
    throw new MemoryValidationError(
      `${fieldName} cannot be empty`,
      "MISSING_REQUIRED_FIELD",
      fieldName,
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Format Validators
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const ID_FORMAT_REGEX = /^[a-zA-Z0-9_-]+$/;

/**
 * Validates ID format (alphanumeric, hyphens, underscores)
 */
export function validateIdFormat(id: string, fieldName: string): void {
  if (!ID_FORMAT_REGEX.test(id)) {
    throw new MemoryValidationError(
      `${fieldName} contains invalid characters. Only alphanumeric, hyphens, and underscores are allowed`,
      "INVALID_ID_FORMAT",
      fieldName,
    );
  }
}

const VALID_CONTENT_TYPES = ["raw", "summarized", "fact"] as const;

/**
 * Validates contentType is one of allowed values
 */
export function validateContentType(contentType: string): void {
  if (!(VALID_CONTENT_TYPES as readonly string[]).includes(contentType)) {
    throw new MemoryValidationError(
      `Invalid contentType "${contentType}". Valid types: ${VALID_CONTENT_TYPES.join(", ")}`,
      "INVALID_FORMAT",
      "contentType",
    );
  }
}

const VALID_SOURCE_TYPES = ["conversation", "system", "tool", "a2a"] as const;

/**
 * Validates sourceType is one of allowed values
 */
export function validateSourceType(sourceType: string): void {
  if (!(VALID_SOURCE_TYPES as readonly string[]).includes(sourceType)) {
    throw new MemoryValidationError(
      `Invalid sourceType "${sourceType}". Valid types: ${VALID_SOURCE_TYPES.join(", ")}`,
      "INVALID_SOURCE_TYPE",
      "sourceType",
    );
  }
}

const VALID_EXPORT_FORMATS = ["json", "csv"] as const;

/**
 * Validates export format is one of allowed values
 */
export function validateExportFormat(format: string): void {
  if (!(VALID_EXPORT_FORMATS as readonly string[]).includes(format)) {
    throw new MemoryValidationError(
      `Invalid format "${format}". Valid formats: ${VALID_EXPORT_FORMATS.join(", ")}`,
      "INVALID_FORMAT",
      "format",
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Range/Boundary Validators
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates importance is between 0-100
 */
export function validateImportance(
  importance: number,
  fieldName = "importance",
): void {
  if (typeof importance !== "number" || isNaN(importance)) {
    throw new MemoryValidationError(
      `${fieldName} must be a number`,
      "INVALID_IMPORTANCE",
      fieldName,
    );
  }

  if (importance < 0 || importance > 100) {
    throw new MemoryValidationError(
      `${fieldName} must be between 0 and 100, got ${importance}`,
      "INVALID_IMPORTANCE",
      fieldName,
    );
  }
}

/**
 * Validates version is positive integer >= 1
 */
export function validateVersion(version: number, fieldName = "version"): void {
  if (typeof version !== "number" || isNaN(version)) {
    throw new MemoryValidationError(
      `${fieldName} must be a number`,
      "NEGATIVE_NUMBER",
      fieldName,
    );
  }

  if (version < 1 || !Number.isInteger(version)) {
    throw new MemoryValidationError(
      `${fieldName} must be a positive integer >= 1, got ${version}`,
      "NEGATIVE_NUMBER",
      fieldName,
    );
  }
}

/**
 * Validates limit is positive integer >= 1
 */
export function validateLimit(limit: number, fieldName = "limit"): void {
  if (typeof limit !== "number" || isNaN(limit)) {
    throw new MemoryValidationError(
      `${fieldName} must be a number`,
      "NEGATIVE_NUMBER",
      fieldName,
    );
  }

  if (limit < 1) {
    throw new MemoryValidationError(
      `${fieldName} must be a positive integer >= 1, got ${limit}`,
      "NEGATIVE_NUMBER",
      fieldName,
    );
  }
}

/**
 * Validates timestamp is valid
 */
export function validateTimestamp(
  timestamp: number | Date,
  fieldName = "timestamp",
): void {
  if (timestamp instanceof Date) {
    if (isNaN(timestamp.getTime())) {
      throw new MemoryValidationError(
        `${fieldName} is an invalid Date object`,
        "INVALID_TIMESTAMP",
        fieldName,
      );
    }
    return;
  }

  if (typeof timestamp !== "number" || isNaN(timestamp)) {
    throw new MemoryValidationError(
      `${fieldName} must be a valid timestamp (number) or Date object`,
      "INVALID_TIMESTAMP",
      fieldName,
    );
  }

  if (timestamp < 0) {
    throw new MemoryValidationError(
      `${fieldName} cannot be negative, got ${timestamp}`,
      "INVALID_TIMESTAMP",
      fieldName,
    );
  }
}

/**
 * Validates minScore is between 0-1
 */
export function validateMinScore(
  minScore: number,
  fieldName = "minScore",
): void {
  if (typeof minScore !== "number" || isNaN(minScore)) {
    throw new MemoryValidationError(
      `${fieldName} must be a number`,
      "INVALID_FORMAT",
      fieldName,
    );
  }

  if (minScore < 0 || minScore > 1) {
    throw new MemoryValidationError(
      `${fieldName} must be between 0 and 1 (similarity score), got ${minScore}`,
      "INVALID_FORMAT",
      fieldName,
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Embedding Validators
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates embedding is array of finite numbers
 */
export function validateEmbedding(
  embedding: number[],
  fieldName = "embedding",
): void {
  if (!Array.isArray(embedding)) {
    throw new MemoryValidationError(
      `${fieldName} must be an array of numbers`,
      "INVALID_EMBEDDING",
      fieldName,
    );
  }

  if (embedding.length === 0) {
    throw new MemoryValidationError(
      `${fieldName} cannot be empty`,
      "INVALID_EMBEDDING",
      fieldName,
    );
  }

  for (let i = 0; i < embedding.length; i++) {
    const value = embedding[i];
    if (typeof value !== "number" || !isFinite(value)) {
      throw new MemoryValidationError(
        `${fieldName}[${i}] must be a finite number, got ${value}`,
        "INVALID_EMBEDDING",
        fieldName,
      );
    }
  }
}

/**
 * Validates embedding dimension matches expected
 */
export function validateEmbeddingDimension(
  embedding: number[],
  expectedDim: number,
): void {
  if (embedding.length !== expectedDim) {
    throw new MemoryValidationError(
      `Embedding dimension mismatch: expected ${expectedDim}, got ${embedding.length}`,
      "INVALID_EMBEDDING",
      "embedding",
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Array Validators
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates tags array contains non-empty strings
 */
export function validateTags(tags: string[], fieldName = "tags"): void {
  if (!Array.isArray(tags)) {
    throw new MemoryValidationError(
      `${fieldName} must be an array`,
      "INVALID_FORMAT",
      fieldName,
    );
  }

  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i];
    if (typeof tag !== "string" || tag.trim().length === 0) {
      throw new MemoryValidationError(
        `${fieldName}[${i}] must be a non-empty string`,
        "INVALID_FORMAT",
        fieldName,
      );
    }
  }
}

/**
 * Validates messageIds array is non-empty with non-empty strings
 */
export function validateMessageIds(
  messageIds: string[],
  fieldName = "messageIds",
): void {
  if (!Array.isArray(messageIds)) {
    throw new MemoryValidationError(
      `${fieldName} must be an array`,
      "INVALID_FORMAT",
      fieldName,
    );
  }

  if (messageIds.length === 0) {
    throw new MemoryValidationError(
      `${fieldName} cannot be empty`,
      "EMPTY_ARRAY",
      fieldName,
    );
  }

  for (let i = 0; i < messageIds.length; i++) {
    const id = messageIds[i];
    if (typeof id !== "string" || id.trim().length === 0) {
      throw new MemoryValidationError(
        `${fieldName}[${i}] must be a non-empty string`,
        "INVALID_FORMAT",
        fieldName,
      );
    }
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Structural Validators
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates RememberParams structure
 */
export function validateRememberParams(params: RememberParams): void {
  // Required fields
  validateMemorySpaceId(params.memorySpaceId);
  validateConversationId(params.conversationId);
  validateContent(params.userMessage, "userMessage");
  validateContent(params.agentResponse, "agentResponse");
  validateUserId(params.userId);

  if (!params.userName || typeof params.userName !== "string") {
    throw new MemoryValidationError(
      "userName is required and must be a string",
      "MISSING_REQUIRED_FIELD",
      "userName",
    );
  }

  if (params.userName.trim().length === 0) {
    throw new MemoryValidationError(
      "userName cannot be empty",
      "MISSING_REQUIRED_FIELD",
      "userName",
    );
  }

  // Optional fields validation
  if (params.importance !== undefined) {
    validateImportance(params.importance);
  }

  if (params.tags) {
    validateTags(params.tags);
  }

  if (params.participantId !== undefined) {
    if (
      typeof params.participantId !== "string" ||
      params.participantId.trim().length === 0
    ) {
      throw new MemoryValidationError(
        "participantId must be a non-empty string if provided",
        "INVALID_FORMAT",
        "participantId",
      );
    }
  }
}

/**
 * Validates StoreMemoryInput structure
 */
export function validateStoreMemoryInput(input: StoreMemoryInput): void {
  // Required fields
  validateContent(input.content);
  validateContentType(input.contentType);

  // Runtime validation for potentially untrusted external input
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!input.source || typeof input.source !== "object") {
    throw new MemoryValidationError(
      "source is required and must be an object",
      "MISSING_REQUIRED_FIELD",
      "source",
    );
  }

  validateSourceType(input.source.type);

  // Runtime validation for potentially untrusted external input
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!input.metadata || typeof input.metadata !== "object") {
    throw new MemoryValidationError(
      "metadata is required and must be an object",
      "MISSING_REQUIRED_FIELD",
      "metadata",
    );
  }

  validateImportance(input.metadata.importance);
  validateTags(input.metadata.tags);

  // Optional fields validation
  if (input.embedding !== undefined) {
    validateEmbedding(input.embedding);
  }

  if (input.userId !== undefined) {
    validateUserId(input.userId, "userId");
  }

  if (input.participantId !== undefined) {
    if (
      typeof input.participantId !== "string" ||
      input.participantId.trim().length === 0
    ) {
      throw new MemoryValidationError(
        "participantId must be a non-empty string if provided",
        "INVALID_FORMAT",
        "participantId",
      );
    }
  }
}

/**
 * Validates SearchMemoryOptions
 */
export function validateSearchOptions(options: SearchMemoryOptions): void {
  if (options.embedding !== undefined) {
    validateEmbedding(options.embedding);
  }

  if (options.minScore !== undefined) {
    validateMinScore(options.minScore);
  }

  if (options.limit !== undefined) {
    validateLimit(options.limit);
  }

  if (options.tags) {
    validateTags(options.tags);
  }

  if (options.minImportance !== undefined) {
    validateImportance(options.minImportance, "minImportance");
  }

  if (options.userId !== undefined) {
    validateUserId(options.userId, "userId");
  }

  if (options.sourceType !== undefined) {
    validateSourceType(options.sourceType);
  }
}

/**
 * Validates update options has at least one field
 */
export function validateUpdateOptions(updates: {
  content?: string;
  embedding?: number[];
  importance?: number;
  tags?: string[];
}): void {
  const hasUpdates =
    updates.content !== undefined ||
    updates.embedding !== undefined ||
    updates.importance !== undefined ||
    updates.tags !== undefined;

  if (!hasUpdates) {
    throw new MemoryValidationError(
      "At least one update field must be provided (content, embedding, importance, or tags)",
      "INVALID_FORMAT",
    );
  }

  // Validate individual fields if present
  if (updates.content !== undefined) {
    validateContent(updates.content);
  }

  if (updates.embedding !== undefined) {
    validateEmbedding(updates.embedding);
  }

  if (updates.importance !== undefined) {
    validateImportance(updates.importance);
  }

  if (updates.tags !== undefined) {
    validateTags(updates.tags);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Business Logic Validators
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates conversationRef is required when sourceType is conversation
 */
export function validateConversationRefRequirement(
  sourceType: SourceType,
  conversationRef?: unknown,
): void {
  if (sourceType === "conversation" && !conversationRef) {
    throw new MemoryValidationError(
      'conversationRef is required when source.type is "conversation"',
      "MISSING_CONVERSATION_REF",
      "conversationRef",
    );
  }
}

/**
 * Validates stream object is valid
 */
export function validateStreamObject(
  stream: unknown,
): void {
  if (!stream || typeof stream !== "object") {
    throw new MemoryValidationError(
      "responseStream must be a ReadableStream or AsyncIterable object",
      "INVALID_STREAM",
      "responseStream",
    );
  }

  // Check if it's a ReadableStream or AsyncIterable
  const hasReader = "getReader" in stream;
  const hasIterator =
    Symbol.asyncIterator in stream || Symbol.iterator in stream;

  if (!hasReader && !hasIterator) {
    throw new MemoryValidationError(
      "responseStream must be a ReadableStream (with getReader) or AsyncIterable (with Symbol.asyncIterator)",
      "INVALID_STREAM",
      "responseStream",
    );
  }
}

/**
 * Validates filter has at least one criterion
 */
export function validateFilterCombination(filter: {
  memorySpaceId: string;
  userId?: string;
  sourceType?: string;
}): void {
  // For deleteMany, we require at least one additional filter beyond memorySpaceId
  // to prevent accidental mass deletion
  const hasAdditionalFilter = filter.userId !== undefined || filter.sourceType !== undefined;

  if (!hasAdditionalFilter) {
    throw new MemoryValidationError(
      "Filter must include at least one criterion (userId or sourceType) in addition to memorySpaceId to prevent accidental mass deletion",
      "INVALID_FILTER",
    );
  }
}
