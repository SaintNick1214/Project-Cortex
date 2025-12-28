/**
 * Cortex SDK - Sessions API Validators
 *
 * Client-side validation for session operations.
 */

import type {
  CreateSessionParams,
  SessionFilters,
  SessionStatus,
} from "./types";

/**
 * Validation error for session operations
 */
export class SessionValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "SessionValidationError";
  }
}

const VALID_STATUSES: SessionStatus[] = ["active", "idle", "ended"];

/**
 * Validate sessionId format
 */
export function validateSessionId(
  sessionId: unknown,
): asserts sessionId is string {
  if (typeof sessionId !== "string") {
    throw new SessionValidationError(
      "sessionId must be a string",
      "INVALID_SESSION_ID",
      "sessionId",
    );
  }

  if (sessionId.trim().length === 0) {
    throw new SessionValidationError(
      "sessionId cannot be empty",
      "EMPTY_SESSION_ID",
      "sessionId",
    );
  }

  if (sessionId.length > 256) {
    throw new SessionValidationError(
      "sessionId cannot exceed 256 characters",
      "SESSION_ID_TOO_LONG",
      "sessionId",
    );
  }
}

/**
 * Validate userId format
 */
export function validateUserId(userId: unknown): asserts userId is string {
  if (typeof userId !== "string") {
    throw new SessionValidationError(
      "userId must be a string",
      "INVALID_USER_ID",
      "userId",
    );
  }

  if (userId.trim().length === 0) {
    throw new SessionValidationError(
      "userId cannot be empty",
      "EMPTY_USER_ID",
      "userId",
    );
  }

  if (userId.length > 256) {
    throw new SessionValidationError(
      "userId cannot exceed 256 characters",
      "USER_ID_TOO_LONG",
      "userId",
    );
  }
}

/**
 * Validate tenantId format
 */
export function validateTenantId(
  tenantId: unknown,
): asserts tenantId is string {
  if (typeof tenantId !== "string") {
    throw new SessionValidationError(
      "tenantId must be a string",
      "INVALID_TENANT_ID",
      "tenantId",
    );
  }

  if (tenantId.trim().length === 0) {
    throw new SessionValidationError(
      "tenantId cannot be empty",
      "EMPTY_TENANT_ID",
      "tenantId",
    );
  }

  if (tenantId.length > 256) {
    throw new SessionValidationError(
      "tenantId cannot exceed 256 characters",
      "TENANT_ID_TOO_LONG",
      "tenantId",
    );
  }
}

/**
 * Validate session status
 */
export function validateStatus(
  status: unknown,
): asserts status is SessionStatus {
  if (typeof status !== "string") {
    throw new SessionValidationError(
      "status must be a string",
      "INVALID_STATUS",
      "status",
    );
  }

  if (!VALID_STATUSES.includes(status as SessionStatus)) {
    throw new SessionValidationError(
      `status must be one of: ${VALID_STATUSES.join(", ")}`,
      "INVALID_STATUS_VALUE",
      "status",
    );
  }
}

/**
 * Validate CreateSessionParams
 */
export function validateCreateSessionParams(
  params: unknown,
): asserts params is CreateSessionParams {
  if (params === null || typeof params !== "object") {
    throw new SessionValidationError(
      "Session params must be an object",
      "INVALID_PARAMS",
    );
  }

  const p = params as Record<string, unknown>;

  // userId is required
  if (!("userId" in p)) {
    throw new SessionValidationError(
      "userId is required",
      "MISSING_USER_ID",
      "userId",
    );
  }
  validateUserId(p.userId);

  // Optional fields
  if (p.sessionId !== undefined) {
    validateSessionId(p.sessionId);
  }

  if (p.tenantId !== undefined) {
    validateTenantId(p.tenantId);
  }

  if (p.memorySpaceId !== undefined) {
    if (typeof p.memorySpaceId !== "string") {
      throw new SessionValidationError(
        "memorySpaceId must be a string",
        "INVALID_MEMORY_SPACE_ID",
        "memorySpaceId",
      );
    }
  }

  if (p.expiresAt !== undefined) {
    if (typeof p.expiresAt !== "number" || p.expiresAt < 0) {
      throw new SessionValidationError(
        "expiresAt must be a positive number (ms since epoch)",
        "INVALID_EXPIRES_AT",
        "expiresAt",
      );
    }
  }

  if (p.metadata !== undefined) {
    if (
      p.metadata === null ||
      typeof p.metadata !== "object" ||
      Array.isArray(p.metadata)
    ) {
      throw new SessionValidationError(
        "metadata must be a plain object",
        "INVALID_METADATA",
        "metadata",
      );
    }
  }
}

/**
 * Validate SessionFilters
 */
export function validateSessionFilters(
  filters: unknown,
): asserts filters is SessionFilters {
  if (filters === null || typeof filters !== "object") {
    throw new SessionValidationError(
      "Session filters must be an object",
      "INVALID_FILTERS",
    );
  }

  const f = filters as Record<string, unknown>;

  if (f.userId !== undefined) {
    validateUserId(f.userId);
  }

  if (f.tenantId !== undefined) {
    validateTenantId(f.tenantId);
  }

  if (f.memorySpaceId !== undefined) {
    if (typeof f.memorySpaceId !== "string") {
      throw new SessionValidationError(
        "memorySpaceId must be a string",
        "INVALID_MEMORY_SPACE_ID",
        "memorySpaceId",
      );
    }
  }

  if (f.status !== undefined) {
    validateStatus(f.status);
  }

  if (f.limit !== undefined) {
    if (typeof f.limit !== "number" || f.limit < 1 || f.limit > 1000) {
      throw new SessionValidationError(
        "limit must be a number between 1 and 1000",
        "INVALID_LIMIT",
        "limit",
      );
    }
  }

  if (f.offset !== undefined) {
    if (typeof f.offset !== "number" || f.offset < 0) {
      throw new SessionValidationError(
        "offset must be a non-negative number",
        "INVALID_OFFSET",
        "offset",
      );
    }
  }
}
