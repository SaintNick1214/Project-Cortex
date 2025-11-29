/**
 * Vector API Validation
 *
 * Client-side validation for vector memory operations to catch errors before
 * they reach the backend, providing faster feedback and better error messages.
 */

import type {
  StoreMemoryInput,
  SearchMemoriesOptions,
  ListMemoriesFilter,
  CountMemoriesFilter,
} from "../types";

/**
 * Custom error class for vector validation failures
 */
export class VectorValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "VectorValidationError";
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Valid Values
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const VALID_CONTENT_TYPES = ["raw", "summarized", "fact"] as const;
const VALID_SOURCE_TYPES = ["conversation", "system", "tool", "a2a"] as const;
const VALID_EXPORT_FORMATS = ["json", "csv"] as const;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ID Validation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates memorySpaceId is a non-empty string
 */
export function validateMemorySpaceId(memorySpaceId: string): void {
  if (
    !memorySpaceId ||
    typeof memorySpaceId !== "string" ||
    memorySpaceId.trim().length === 0
  ) {
    throw new VectorValidationError(
      "memorySpaceId is required and cannot be empty",
      "INVALID_MEMORY_SPACE_ID",
      "memorySpaceId",
    );
  }
}

/**
 * Validates memoryId is a non-empty string
 */
export function validateMemoryId(memoryId: string): void {
  if (
    !memoryId ||
    typeof memoryId !== "string" ||
    memoryId.trim().length === 0
  ) {
    throw new VectorValidationError(
      "memoryId is required and cannot be empty",
      "INVALID_MEMORY_ID",
      "memoryId",
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Enum Validation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates contentType is "raw" | "summarized" | "fact"
 */
export function validateContentType(
  contentType: string,
  fieldName = "contentType",
): void {
  if (
    !contentType ||
    !(VALID_CONTENT_TYPES as readonly string[]).includes(contentType)
  ) {
    throw new VectorValidationError(
      `Invalid ${fieldName} "${contentType}". Valid values: ${VALID_CONTENT_TYPES.join(", ")}`,
      "INVALID_CONTENT_TYPE",
      fieldName,
    );
  }
}

/**
 * Validates sourceType is "conversation" | "system" | "tool" | "a2a"
 */
export function validateSourceType(
  sourceType: string,
  fieldName = "sourceType",
): void {
  if (
    !sourceType ||
    !(VALID_SOURCE_TYPES as readonly string[]).includes(sourceType)
  ) {
    throw new VectorValidationError(
      `Invalid ${fieldName} "${sourceType}". Valid values: ${VALID_SOURCE_TYPES.join(", ")}`,
      "INVALID_SOURCE_TYPE",
      fieldName,
    );
  }
}

/**
 * Validates export format is "json" | "csv"
 */
export function validateExportFormat(format: string): void {
  if (
    !format ||
    !(VALID_EXPORT_FORMATS as readonly string[]).includes(format)
  ) {
    throw new VectorValidationError(
      `Invalid format "${format}". Valid values: ${VALID_EXPORT_FORMATS.join(", ")}`,
      "INVALID_EXPORT_FORMAT",
      "format",
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Range Validation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates importance is a number between 0-100
 */
export function validateImportance(
  importance: number,
  fieldName = "importance",
): void {
  if (typeof importance !== "number" || isNaN(importance)) {
    throw new VectorValidationError(
      `${fieldName} must be a number`,
      "INVALID_IMPORTANCE_RANGE",
      fieldName,
    );
  }

  if (importance < 0 || importance > 100) {
    throw new VectorValidationError(
      `${fieldName} must be between 0 and 100, got ${importance}`,
      "INVALID_IMPORTANCE_RANGE",
      fieldName,
    );
  }
}

/**
 * Validates minScore is a number between 0-1
 */
export function validateMinScore(
  minScore: number,
  fieldName = "minScore",
): void {
  if (typeof minScore !== "number" || isNaN(minScore)) {
    throw new VectorValidationError(
      `${fieldName} must be a number`,
      "INVALID_MIN_SCORE_RANGE",
      fieldName,
    );
  }

  if (minScore < 0 || minScore > 1) {
    throw new VectorValidationError(
      `${fieldName} must be between 0 and 1, got ${minScore}`,
      "INVALID_MIN_SCORE_RANGE",
      fieldName,
    );
  }
}

/**
 * Validates limit is a positive integer
 */
export function validateLimit(limit: number, fieldName = "limit"): void {
  if (typeof limit !== "number" || isNaN(limit)) {
    throw new VectorValidationError(
      `${fieldName} must be a number`,
      "INVALID_LIMIT",
      fieldName,
    );
  }

  if (!Number.isInteger(limit) || limit < 1) {
    throw new VectorValidationError(
      `${fieldName} must be a positive integer (>= 1), got ${limit}`,
      "INVALID_LIMIT",
      fieldName,
    );
  }
}

/**
 * Validates version is a positive integer >= 1
 */
export function validateVersion(version: number, fieldName = "version"): void {
  if (typeof version !== "number" || isNaN(version)) {
    throw new VectorValidationError(
      `${fieldName} must be a number`,
      "INVALID_VERSION",
      fieldName,
    );
  }

  if (!Number.isInteger(version) || version < 1) {
    throw new VectorValidationError(
      `${fieldName} must be a positive integer (>= 1), got ${version}`,
      "INVALID_VERSION",
      fieldName,
    );
  }
}

/**
 * Validates timestamp is a positive number or valid Date
 */
export function validateTimestamp(
  timestamp: number | Date,
  fieldName = "timestamp",
): void {
  if (timestamp instanceof Date) {
    if (isNaN(timestamp.getTime())) {
      throw new VectorValidationError(
        `${fieldName} must be a valid Date`,
        "INVALID_TIMESTAMP",
        fieldName,
      );
    }
    return;
  }

  if (typeof timestamp !== "number" || isNaN(timestamp)) {
    throw new VectorValidationError(
      `${fieldName} must be a number or Date`,
      "INVALID_TIMESTAMP",
      fieldName,
    );
  }

  if (timestamp < 0) {
    throw new VectorValidationError(
      `${fieldName} must be a non-negative number, got ${timestamp}`,
      "INVALID_TIMESTAMP",
      fieldName,
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Array Validation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates tags is an array of strings
 */
export function validateTags(tags: string[], fieldName = "tags"): void {
  if (!Array.isArray(tags)) {
    throw new VectorValidationError(
      `${fieldName} must be an array`,
      "INVALID_TAGS",
      fieldName,
    );
  }

  for (let i = 0; i < tags.length; i++) {
    if (typeof tags[i] !== "string") {
      throw new VectorValidationError(
        `${fieldName}[${i}] must be a string, got ${typeof tags[i]}`,
        "INVALID_TAGS",
        fieldName,
      );
    }
  }
}

/**
 * Validates embedding is an array of numbers if provided
 * Runtime checks for potentially untrusted external input
 */
export function validateEmbedding(
  embedding: number[] | undefined,
  fieldName = "embedding",
): void {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (embedding === undefined || embedding === null) {
    return; // Optional field
  }

  if (!Array.isArray(embedding)) {
    throw new VectorValidationError(
      `${fieldName} must be an array`,
      "INVALID_EMBEDDING",
      fieldName,
    );
  }

  // Empty array is valid (treated as no embedding)
  if (embedding.length === 0) {
    return;
  }

  for (let i = 0; i < embedding.length; i++) {
    if (typeof embedding[i] !== "number" || isNaN(embedding[i])) {
      throw new VectorValidationError(
        `${fieldName}[${i}] must be a number, got ${typeof embedding[i]}`,
        "INVALID_EMBEDDING",
        fieldName,
      );
    }
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Composite Validation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates complete store input structure
 * Runtime checks for potentially untrusted external input
 */
export function validateStoreInput(input: StoreMemoryInput): void {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!input) {
    throw new VectorValidationError(
      "input is required",
      "MISSING_REQUIRED_FIELD",
      "input",
    );
  }

  // Validate content
  if (!input.content || typeof input.content !== "string") {
    throw new VectorValidationError(
      "content is required and must be a string",
      "MISSING_REQUIRED_FIELD",
      "content",
    );
  }

  if (input.content.trim().length === 0) {
    throw new VectorValidationError(
      "content cannot be empty",
      "MISSING_REQUIRED_FIELD",
      "content",
    );
  }

  // Validate contentType
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!input.contentType) {
    throw new VectorValidationError(
      "contentType is required",
      "MISSING_REQUIRED_FIELD",
      "contentType",
    );
  }
  validateContentType(input.contentType, "contentType");

  // Validate source
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!input.source) {
    throw new VectorValidationError(
      "source is required",
      "MISSING_REQUIRED_FIELD",
      "source",
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!input.source.type) {
    throw new VectorValidationError(
      "source.type is required",
      "MISSING_REQUIRED_FIELD",
      "source.type",
    );
  }
  validateSourceType(input.source.type, "source.type");

  // Validate metadata
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!input.metadata) {
    throw new VectorValidationError(
      "metadata is required",
      "MISSING_REQUIRED_FIELD",
      "metadata",
    );
  }

   
  if (
    input.metadata.importance === undefined ||
    input.metadata.importance === null
  ) {
    throw new VectorValidationError(
      "metadata.importance is required",
      "MISSING_REQUIRED_FIELD",
      "metadata.importance",
    );
  }
  validateImportance(input.metadata.importance, "metadata.importance");

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!input.metadata.tags) {
    throw new VectorValidationError(
      "metadata.tags is required",
      "MISSING_REQUIRED_FIELD",
      "metadata.tags",
    );
  }
  validateTags(input.metadata.tags, "metadata.tags");

  // Validate optional embedding
  if (input.embedding !== undefined) {
    validateEmbedding(input.embedding, "embedding");
  }
}

/**
 * Validates search options
 */
export function validateSearchOptions(options?: SearchMemoriesOptions): void {
  if (!options) {
    return; // Options are optional
  }

  if (options.embedding !== undefined) {
    validateEmbedding(options.embedding, "embedding");
  }

  if (options.tags !== undefined) {
    validateTags(options.tags, "tags");
  }

  if (options.sourceType !== undefined) {
    validateSourceType(options.sourceType, "sourceType");
  }

  if (options.minImportance !== undefined) {
    validateImportance(options.minImportance, "minImportance");
  }

  if (options.minScore !== undefined) {
    validateMinScore(options.minScore, "minScore");
  }

  if (options.limit !== undefined) {
    validateLimit(options.limit, "limit");
  }
}

/**
 * Validates list filter
 * Runtime checks for potentially untrusted external input
 */
export function validateListFilter(filter: ListMemoriesFilter): void {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!filter) {
    throw new VectorValidationError(
      "filter is required",
      "MISSING_REQUIRED_FIELD",
      "filter",
    );
  }

  validateMemorySpaceId(filter.memorySpaceId);

  if (filter.sourceType !== undefined) {
    validateSourceType(filter.sourceType, "sourceType");
  }

  if (filter.limit !== undefined) {
    validateLimit(filter.limit, "limit");
  }
}

/**
 * Validates count filter
 * Runtime checks for potentially untrusted external input
 */
export function validateCountFilter(filter: CountMemoriesFilter): void {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!filter) {
    throw new VectorValidationError(
      "filter is required",
      "MISSING_REQUIRED_FIELD",
      "filter",
    );
  }

  validateMemorySpaceId(filter.memorySpaceId);

  if (filter.sourceType !== undefined) {
    validateSourceType(filter.sourceType, "sourceType");
  }
}

/**
 * Validates update input
 * Runtime checks for potentially untrusted external input
 */
export function validateUpdateInput(updates: {
  content?: string;
  embedding?: number[];
  importance?: number;
  tags?: string[];
}): void {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!updates) {
    throw new VectorValidationError(
      "updates is required",
      "MISSING_REQUIRED_FIELD",
      "updates",
    );
  }

  if (updates.importance !== undefined) {
    validateImportance(updates.importance, "importance");
  }

  if (updates.tags !== undefined) {
    validateTags(updates.tags, "tags");
  }

  if (updates.embedding !== undefined) {
    validateEmbedding(updates.embedding, "embedding");
  }
}

/**
 * Validates export options
 * Runtime checks for potentially untrusted external input
 */
export function validateExportOptions(options: {
  memorySpaceId: string;
  userId?: string;
  format: "json" | "csv";
  includeEmbeddings?: boolean;
}): void {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!options) {
    throw new VectorValidationError(
      "options is required",
      "MISSING_REQUIRED_FIELD",
      "options",
    );
  }

  validateMemorySpaceId(options.memorySpaceId);
  validateExportFormat(options.format);
}

/**
 * Validates deleteMany filter
 * Runtime checks for potentially untrusted external input
 */
export function validateDeleteManyFilter(filter: {
  memorySpaceId: string;
  userId?: string;
  sourceType?: "conversation" | "system" | "tool" | "a2a";
}): void {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!filter) {
    throw new VectorValidationError(
      "filter is required",
      "MISSING_REQUIRED_FIELD",
      "filter",
    );
  }

  validateMemorySpaceId(filter.memorySpaceId);

  if (filter.sourceType !== undefined) {
    validateSourceType(filter.sourceType, "sourceType");
  }
}

/**
 * Validates updateMany inputs
 * Runtime checks for potentially untrusted external input
 */
export function validateUpdateManyInputs(
  filter: {
    memorySpaceId: string;
    userId?: string;
    sourceType?: "conversation" | "system" | "tool" | "a2a";
  },
  updates: {
    importance?: number;
    tags?: string[];
  },
): void {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!filter) {
    throw new VectorValidationError(
      "filter is required",
      "MISSING_REQUIRED_FIELD",
      "filter",
    );
  }

  validateMemorySpaceId(filter.memorySpaceId);

  if (filter.sourceType !== undefined) {
    validateSourceType(filter.sourceType, "sourceType");
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!updates) {
    throw new VectorValidationError(
      "updates is required",
      "MISSING_REQUIRED_FIELD",
      "updates",
    );
  }

  if (updates.importance !== undefined) {
    validateImportance(updates.importance, "importance");
  }

  if (updates.tags !== undefined) {
    validateTags(updates.tags, "tags");
  }
}
