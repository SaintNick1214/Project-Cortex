/**
 * Cortex SDK - Auth Context Validators
 *
 * Client-side validation for auth context parameters.
 */

import type { AuthContextParams, AuthMethod } from "./types";

/**
 * Validation error for auth context operations
 */
export class AuthValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "AuthValidationError";
  }
}

const VALID_AUTH_METHODS: AuthMethod[] = [
  "oauth",
  "api_key",
  "jwt",
  "session",
  "custom",
];

/**
 * Validate userId format
 */
export function validateUserId(userId: unknown): asserts userId is string {
  if (typeof userId !== "string") {
    throw new AuthValidationError(
      "userId must be a string",
      "INVALID_USER_ID",
      "userId",
    );
  }

  if (userId.trim().length === 0) {
    throw new AuthValidationError(
      "userId cannot be empty",
      "EMPTY_USER_ID",
      "userId",
    );
  }

  if (userId.length > 256) {
    throw new AuthValidationError(
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
    throw new AuthValidationError(
      "tenantId must be a string",
      "INVALID_TENANT_ID",
      "tenantId",
    );
  }

  if (tenantId.trim().length === 0) {
    throw new AuthValidationError(
      "tenantId cannot be empty",
      "EMPTY_TENANT_ID",
      "tenantId",
    );
  }

  if (tenantId.length > 256) {
    throw new AuthValidationError(
      "tenantId cannot exceed 256 characters",
      "TENANT_ID_TOO_LONG",
      "tenantId",
    );
  }
}

/**
 * Validate organizationId format
 */
export function validateOrganizationId(
  organizationId: unknown,
): asserts organizationId is string {
  if (typeof organizationId !== "string") {
    throw new AuthValidationError(
      "organizationId must be a string",
      "INVALID_ORGANIZATION_ID",
      "organizationId",
    );
  }

  if (organizationId.trim().length === 0) {
    throw new AuthValidationError(
      "organizationId cannot be empty",
      "EMPTY_ORGANIZATION_ID",
      "organizationId",
    );
  }

  if (organizationId.length > 256) {
    throw new AuthValidationError(
      "organizationId cannot exceed 256 characters",
      "ORGANIZATION_ID_TOO_LONG",
      "organizationId",
    );
  }
}

/**
 * Validate sessionId format
 */
export function validateSessionId(
  sessionId: unknown,
): asserts sessionId is string {
  if (typeof sessionId !== "string") {
    throw new AuthValidationError(
      "sessionId must be a string",
      "INVALID_SESSION_ID",
      "sessionId",
    );
  }

  if (sessionId.trim().length === 0) {
    throw new AuthValidationError(
      "sessionId cannot be empty",
      "EMPTY_SESSION_ID",
      "sessionId",
    );
  }

  if (sessionId.length > 256) {
    throw new AuthValidationError(
      "sessionId cannot exceed 256 characters",
      "SESSION_ID_TOO_LONG",
      "sessionId",
    );
  }
}

/**
 * Validate authMethod value
 */
export function validateAuthMethod(
  authMethod: unknown,
): asserts authMethod is AuthMethod {
  if (typeof authMethod !== "string") {
    throw new AuthValidationError(
      "authMethod must be a string",
      "INVALID_AUTH_METHOD",
      "authMethod",
    );
  }

  if (!VALID_AUTH_METHODS.includes(authMethod as AuthMethod)) {
    throw new AuthValidationError(
      `authMethod must be one of: ${VALID_AUTH_METHODS.join(", ")}`,
      "INVALID_AUTH_METHOD_VALUE",
      "authMethod",
    );
  }
}

/**
 * Validate claims object
 */
export function validateClaims(
  claims: unknown,
): asserts claims is Record<string, unknown> {
  if (claims === null || typeof claims !== "object" || Array.isArray(claims)) {
    throw new AuthValidationError(
      "claims must be a plain object",
      "INVALID_CLAIMS",
      "claims",
    );
  }
}

/**
 * Validate metadata object
 */
export function validateMetadata(
  metadata: unknown,
): asserts metadata is Record<string, unknown> {
  if (
    metadata === null ||
    typeof metadata !== "object" ||
    Array.isArray(metadata)
  ) {
    throw new AuthValidationError(
      "metadata must be a plain object",
      "INVALID_METADATA",
      "metadata",
    );
  }
}

/**
 * Validate complete auth context params
 */
export function validateAuthContextParams(
  params: unknown,
): asserts params is AuthContextParams {
  if (params === null || typeof params !== "object") {
    throw new AuthValidationError(
      "Auth context params must be an object",
      "INVALID_PARAMS",
    );
  }

  const p = params as Record<string, unknown>;

  // Required field
  if (!("userId" in p)) {
    throw new AuthValidationError(
      "userId is required",
      "MISSING_USER_ID",
      "userId",
    );
  }
  validateUserId(p.userId);

  // Optional fields
  if (p.tenantId !== undefined) {
    validateTenantId(p.tenantId);
  }

  if (p.organizationId !== undefined) {
    validateOrganizationId(p.organizationId);
  }

  if (p.sessionId !== undefined) {
    validateSessionId(p.sessionId);
  }

  if (p.authProvider !== undefined) {
    if (typeof p.authProvider !== "string") {
      throw new AuthValidationError(
        "authProvider must be a string",
        "INVALID_AUTH_PROVIDER",
        "authProvider",
      );
    }
  }

  if (p.authMethod !== undefined) {
    validateAuthMethod(p.authMethod);
  }

  if (p.authenticatedAt !== undefined) {
    if (typeof p.authenticatedAt !== "number" || p.authenticatedAt < 0) {
      throw new AuthValidationError(
        "authenticatedAt must be a positive number (ms since epoch)",
        "INVALID_AUTHENTICATED_AT",
        "authenticatedAt",
      );
    }
  }

  if (p.claims !== undefined) {
    validateClaims(p.claims);
  }

  if (p.metadata !== undefined) {
    validateMetadata(p.metadata);
  }
}
