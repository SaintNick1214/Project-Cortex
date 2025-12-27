/**
 * Cortex SDK - Auth Context Creation and Validation
 *
 * Factory functions for creating and validating AuthContext objects.
 */

import type { AuthContext, AuthContextParams } from "./types";
import { validateAuthContextParams, AuthValidationError } from "./validators";

/**
 * Create a validated AuthContext from parameters.
 *
 * This is the primary way to create an auth context for use with Cortex.
 * All parameters are validated before the context is created.
 *
 * @param params - Auth context parameters
 * @returns Validated AuthContext object
 * @throws AuthValidationError if validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const authContext = createAuthContext({
 *   userId: 'user-123',
 * });
 *
 * // With multi-tenancy
 * const authContext = createAuthContext({
 *   userId: 'user-123',
 *   tenantId: 'tenant-456',
 *   organizationId: 'org-engineering',
 * });
 *
 * // With session tracking
 * const authContext = createAuthContext({
 *   userId: 'user-123',
 *   tenantId: 'tenant-456',
 *   sessionId: 'sess-abc',
 * });
 *
 * // With provider info and claims
 * const authContext = createAuthContext({
 *   userId: 'user-123',
 *   tenantId: 'tenant-456',
 *   authProvider: 'auth0',
 *   authMethod: 'oauth',
 *   authenticatedAt: Date.now(),
 *   claims: {
 *     'https://myapp.com/roles': ['admin'],
 *     'https://myapp.com/subscription': 'enterprise',
 *   },
 * });
 *
 * // With custom metadata
 * const authContext = createAuthContext({
 *   userId: 'user-123',
 *   metadata: {
 *     internalUserId: 'legacy-789',
 *     featureFlags: ['beta-features'],
 *     region: 'us-west-2',
 *   },
 * });
 *
 * // Use with Cortex
 * const cortex = new Cortex({
 *   convexUrl: process.env.CONVEX_URL!,
 *   auth: authContext,
 * });
 * ```
 */
export function createAuthContext(params: AuthContextParams): AuthContext {
  // Validate all parameters
  validateAuthContextParams(params);

  // Build the auth context with only defined values
  const context: AuthContext = {
    userId: params.userId,
  };

  if (params.tenantId !== undefined) {
    context.tenantId = params.tenantId;
  }

  if (params.organizationId !== undefined) {
    context.organizationId = params.organizationId;
  }

  if (params.sessionId !== undefined) {
    context.sessionId = params.sessionId;
  }

  if (params.authProvider !== undefined) {
    context.authProvider = params.authProvider;
  }

  if (params.authMethod !== undefined) {
    context.authMethod = params.authMethod;
  }

  if (params.authenticatedAt !== undefined) {
    context.authenticatedAt = params.authenticatedAt;
  }

  if (params.claims !== undefined) {
    // Shallow copy to prevent mutation
    context.claims = { ...params.claims };
  }

  if (params.metadata !== undefined) {
    // Shallow copy to prevent mutation
    context.metadata = { ...params.metadata };
  }

  return context;
}

/**
 * Validate an existing AuthContext object.
 *
 * Use this to validate auth contexts that were created elsewhere
 * (e.g., from a JWT payload or external auth provider).
 *
 * @param context - Object to validate as AuthContext
 * @returns true if valid
 * @throws AuthValidationError if validation fails
 *
 * @example
 * ```typescript
 * // Validate JWT payload as auth context
 * const jwtPayload = decodeJwt(token);
 * validateAuthContext({
 *   userId: jwtPayload.sub,
 *   tenantId: jwtPayload.tenant_id,
 *   claims: jwtPayload,
 * });
 * ```
 */
export function validateAuthContext(context: unknown): context is AuthContext {
  validateAuthContextParams(context);
  return true;
}

/**
 * Extract auth context fields that should be injected into API operations.
 *
 * This is used internally by the SDK to auto-inject auth context
 * into operations like memory.remember(), facts.store(), etc.
 *
 * @param context - AuthContext to extract from
 * @returns Object with userId and tenantId (if present)
 */
export function extractInjectionFields(context: AuthContext): {
  userId: string;
  tenantId?: string;
  sessionId?: string;
} {
  const fields: { userId: string; tenantId?: string; sessionId?: string } = {
    userId: context.userId,
  };

  if (context.tenantId) {
    fields.tenantId = context.tenantId;
  }

  if (context.sessionId) {
    fields.sessionId = context.sessionId;
  }

  return fields;
}

// Re-export error for convenience
export { AuthValidationError } from "./validators";
