/**
 * Memory Spaces API Validation
 *
 * Client-side validation for memory space operations to catch errors before
 * they reach the backend, providing faster feedback and better error messages.
 */

/**
 * Custom error class for memory space validation failures
 */
export class MemorySpaceValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "MemorySpaceValidationError";
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Memory Space ID Validation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates memory space ID
 */
export function validateMemorySpaceId(
  id: string,
  fieldName = "memorySpaceId",
): void {
  if (!id || typeof id !== "string" || id.trim().length === 0) {
    throw new MemorySpaceValidationError(
      `${fieldName} is required and cannot be empty`,
      "MISSING_MEMORYSPACE_ID",
      fieldName,
    );
  }

  const trimmedId = id.trim();

  // Check length
  if (trimmedId.length > 128) {
    throw new MemorySpaceValidationError(
      `${fieldName} must be 128 characters or less, got ${trimmedId.length}`,
      "INVALID_MEMORYSPACE_ID",
      fieldName,
    );
  }

  // Check for safe characters (alphanumeric, hyphens, underscores, dots)
  const validPattern = /^[a-zA-Z0-9_-]+$/;
  if (!validPattern.test(trimmedId)) {
    throw new MemorySpaceValidationError(
      `Invalid ${fieldName} format "${trimmedId}". Only alphanumeric characters, hyphens, and underscores are allowed`,
      "INVALID_MEMORYSPACE_ID",
      fieldName,
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Type and Status Validation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const VALID_TYPES = ["personal", "team", "project", "custom"] as const;
const VALID_STATUSES = ["active", "archived"] as const;

/**
 * Validates memory space type
 */
export function validateMemorySpaceType(type: string): void {
  if (!type || typeof type !== "string") {
    throw new MemorySpaceValidationError(
      "type is required and must be a string",
      "INVALID_TYPE",
      "type",
    );
  }

  if (!(VALID_TYPES as readonly string[]).includes(type)) {
    throw new MemorySpaceValidationError(
      `Invalid type "${type}". Valid types: ${VALID_TYPES.join(", ")}`,
      "INVALID_TYPE",
      "type",
    );
  }
}

/**
 * Validates memory space status
 */
export function validateMemorySpaceStatus(status: string): void {
  if (!status || typeof status !== "string") {
    throw new MemorySpaceValidationError(
      "status is required and must be a string",
      "INVALID_STATUS",
      "status",
    );
  }

  if (!(VALID_STATUSES as readonly string[]).includes(status)) {
    throw new MemorySpaceValidationError(
      `Invalid status "${status}". Valid statuses: ${VALID_STATUSES.join(", ")}`,
      "INVALID_STATUS",
      "status",
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Limit and Range Validation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates limit parameter
 */
export function validateLimit(limit: number, max = 1000): void {
  if (typeof limit !== "number" || isNaN(limit)) {
    throw new MemorySpaceValidationError(
      "limit must be a number",
      "INVALID_LIMIT",
      "limit",
    );
  }

  if (limit < 1) {
    throw new MemorySpaceValidationError(
      `limit must be at least 1, got ${limit}`,
      "INVALID_LIMIT",
      "limit",
    );
  }

  if (limit > max) {
    throw new MemorySpaceValidationError(
      `limit must be at most ${max}, got ${limit}`,
      "INVALID_LIMIT",
      "limit",
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Participant Validation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates a single participant object
 */
export function validateParticipant(participant: unknown): void {
  if (!participant || typeof participant !== "object") {
    throw new MemorySpaceValidationError(
      "Participant must be an object",
      "INVALID_PARTICIPANT",
    );
  }

  const p = participant as Record<string, unknown>;

  // Validate id
  if (!p.id || typeof p.id !== "string" || p.id.trim().length === 0) {
    throw new MemorySpaceValidationError(
      "participant.id is required and cannot be empty",
      "MISSING_PARTICIPANT_ID",
      "participant.id",
    );
  }

  // Validate type
  if (!p.type || typeof p.type !== "string" || p.type.trim().length === 0) {
    throw new MemorySpaceValidationError(
      "participant.type is required and cannot be empty",
      "MISSING_PARTICIPANT_TYPE",
      "participant.type",
    );
  }

  // Validate joinedAt if provided
  if (p.joinedAt !== undefined) {
    if (typeof p.joinedAt !== "number" || isNaN(p.joinedAt)) {
      throw new MemorySpaceValidationError(
        "participant.joinedAt must be a number",
        "INVALID_TIMESTAMP",
        "participant.joinedAt",
      );
    }

    if (p.joinedAt < 0) {
      throw new MemorySpaceValidationError(
        `participant.joinedAt must be a positive number, got ${p.joinedAt}`,
        "INVALID_TIMESTAMP",
        "participant.joinedAt",
      );
    }
  }
}

/**
 * Validates an array of participants
 */
export function validateParticipants(participants: unknown): void {
  if (!Array.isArray(participants)) {
    throw new MemorySpaceValidationError(
      "participants must be an array",
      "INVALID_PARTICIPANT",
    );
  }

  // Empty arrays are valid - a memory space can have no participants
  if (participants.length === 0) {
    return;
  }

  // Track participant IDs to check for duplicates
  const participantIds = new Set<string>();

  for (let i = 0; i < participants.length; i++) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const participant = participants[i];

    // Validate individual participant
    validateParticipant(participant);

    // Check for duplicates
    const p = participant as { id: string };
    if (participantIds.has(p.id)) {
      throw new MemorySpaceValidationError(
        `Duplicate participant ID "${p.id}" found in participants array`,
        "DUPLICATE_PARTICIPANT",
        "participants",
      );
    }
    participantIds.add(p.id);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// String Field Validation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates search query
 */
export function validateSearchQuery(query: string): void {
  if (!query || typeof query !== "string") {
    throw new MemorySpaceValidationError(
      "Search query is required and must be a string",
      "EMPTY_QUERY",
      "query",
    );
  }

  const trimmedQuery = query.trim();
  if (trimmedQuery.length === 0) {
    throw new MemorySpaceValidationError(
      "Search query cannot be empty",
      "EMPTY_QUERY",
      "query",
    );
  }

  if (trimmedQuery.length > 500) {
    throw new MemorySpaceValidationError(
      `Search query must be 500 characters or less, got ${trimmedQuery.length}`,
      "EMPTY_QUERY",
      "query",
    );
  }
}

/**
 * Validates name field
 */
export function validateName(name: string | undefined): void {
  if (name === undefined) {
    return;
  }

  if (typeof name !== "string") {
    throw new MemorySpaceValidationError(
      "name must be a string",
      "INVALID_NAME",
      "name",
    );
  }

  const trimmedName = name.trim();
  if (trimmedName.length === 0) {
    throw new MemorySpaceValidationError(
      "name cannot be empty when provided",
      "INVALID_NAME",
      "name",
    );
  }

  if (trimmedName.length > 200) {
    throw new MemorySpaceValidationError(
      `name must be 200 characters or less, got ${trimmedName.length}`,
      "INVALID_NAME",
      "name",
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Offset Validation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates offset parameter
 */
export function validateOffset(offset: number): void {
  if (typeof offset !== "number" || isNaN(offset)) {
    throw new MemorySpaceValidationError(
      "offset must be a number",
      "INVALID_OFFSET",
      "offset",
    );
  }

  if (offset < 0) {
    throw new MemorySpaceValidationError(
      `offset must be at least 0, got ${offset}`,
      "INVALID_OFFSET",
      "offset",
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Sort Validation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const VALID_SORT_BY = ["createdAt", "updatedAt", "name"] as const;
const VALID_SORT_ORDER = ["asc", "desc"] as const;

/**
 * Validates sortBy parameter
 */
export function validateSortBy(sortBy: string): void {
  if (!sortBy || typeof sortBy !== "string") {
    throw new MemorySpaceValidationError(
      "sortBy is required and must be a string",
      "INVALID_SORT_BY",
      "sortBy",
    );
  }

  if (!(VALID_SORT_BY as readonly string[]).includes(sortBy)) {
    throw new MemorySpaceValidationError(
      `Invalid sortBy "${sortBy}". Valid values: ${VALID_SORT_BY.join(", ")}`,
      "INVALID_SORT_BY",
      "sortBy",
    );
  }
}

/**
 * Validates sortOrder parameter
 */
export function validateSortOrder(sortOrder: string): void {
  if (!sortOrder || typeof sortOrder !== "string") {
    throw new MemorySpaceValidationError(
      "sortOrder is required and must be a string",
      "INVALID_SORT_ORDER",
      "sortOrder",
    );
  }

  if (!(VALID_SORT_ORDER as readonly string[]).includes(sortOrder)) {
    throw new MemorySpaceValidationError(
      `Invalid sortOrder "${sortOrder}". Valid values: ${VALID_SORT_ORDER.join(", ")}`,
      "INVALID_SORT_ORDER",
      "sortOrder",
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Time Window Validation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const VALID_TIME_WINDOWS = ["24h", "7d", "30d", "90d", "all"] as const;

/**
 * Validates timeWindow parameter
 */
export function validateTimeWindow(timeWindow: string): void {
  if (!timeWindow || typeof timeWindow !== "string") {
    throw new MemorySpaceValidationError(
      "timeWindow is required and must be a string",
      "INVALID_TIME_WINDOW",
      "timeWindow",
    );
  }

  if (!(VALID_TIME_WINDOWS as readonly string[]).includes(timeWindow)) {
    throw new MemorySpaceValidationError(
      `Invalid timeWindow "${timeWindow}". Valid values: ${VALID_TIME_WINDOWS.join(", ")}`,
      "INVALID_TIME_WINDOW",
      "timeWindow",
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Delete Options Validation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates delete options
 */
export function validateDeleteOptions(
  memorySpaceId: string,
  options: { cascade: boolean; reason: string; confirmId?: string },
): void {
  if (options.cascade !== true) {
    throw new MemorySpaceValidationError(
      "cascade must be true to delete a memory space",
      "CASCADE_REQUIRED",
      "cascade",
    );
  }

  if (!options.reason || typeof options.reason !== "string" || options.reason.trim().length === 0) {
    throw new MemorySpaceValidationError(
      "reason is required and cannot be empty",
      "MISSING_REASON",
      "reason",
    );
  }

  if (options.confirmId !== undefined && options.confirmId !== memorySpaceId) {
    throw new MemorySpaceValidationError(
      `confirmId "${options.confirmId}" does not match memorySpaceId "${memorySpaceId}"`,
      "CONFIRM_ID_MISMATCH",
      "confirmId",
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Update Validation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates that update parameters contain at least one field
 * Runtime validation for potentially untrusted external input
 */
export function validateUpdateParams(updates: Record<string, unknown>): void {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!updates || typeof updates !== "object") {
    throw new MemorySpaceValidationError(
      "Updates must be an object",
      "EMPTY_UPDATES",
    );
  }

  const keys = Object.keys(updates);
  if (keys.length === 0) {
    throw new MemorySpaceValidationError(
      "At least one field must be provided for update",
      "EMPTY_UPDATES",
    );
  }
}
