/**
 * Cortex SDK - Auth Context Types
 *
 * Fully extensible authentication context for multi-tenant applications.
 */

/**
 * Authentication method used to obtain credentials
 */
export type AuthMethod = "oauth" | "api_key" | "jwt" | "session" | "custom";

/**
 * Authentication context for Cortex operations.
 *
 * This is the fully-resolved auth context that gets auto-injected
 * into all Cortex operations when provided to the Cortex constructor.
 *
 * @example
 * ```typescript
 * const cortex = new Cortex({
 *   convexUrl: process.env.CONVEX_URL!,
 *   auth: createAuthContext({
 *     userId: 'user-123',
 *     tenantId: 'tenant-456',
 *     metadata: { customField: 'any-value' },
 *   }),
 * });
 *
 * // All operations auto-scoped to auth context
 * await cortex.memory.remember({ ... }); // userId, tenantId auto-injected
 * ```
 */
export interface AuthContext {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Required
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /** Unique user identifier (required) */
  userId: string;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Multi-tenancy (critical for SaaS platforms)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Tenant identifier for multi-tenant applications.
   *
   * When provided, all queries are automatically scoped to this tenant.
   * This is the primary isolation boundary for SaaS applications.
   *
   * @example "tenant-acme-corp"
   */
  tenantId?: string;

  /**
   * Organization identifier within a tenant.
   *
   * For hierarchical multi-tenancy (tenant → organization → user).
   *
   * @example "org-engineering"
   */
  organizationId?: string;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Session tracking
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Current session identifier.
   *
   * If provided, operations are associated with this session.
   * Can be managed via cortex.sessions.* API.
   */
  sessionId?: string;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Auth provider metadata
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Authentication provider name.
   *
   * @example "auth0", "firebase", "clerk", "nextauth", "custom"
   */
  authProvider?: string;

  /**
   * Authentication method used.
   */
  authMethod?: AuthMethod;

  /**
   * Timestamp when authentication occurred (ms since epoch).
   */
  authenticatedAt?: number;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Fully extensible fields
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Raw JWT/provider claims (filtered for safety).
   *
   * Pass through any claims from your auth provider that you need
   * to reference in your application logic.
   *
   * @example
   * ```typescript
   * claims: {
   *   'https://myapp.com/roles': ['admin', 'editor'],
   *   'https://myapp.com/subscription': 'enterprise',
   *   'aud': 'my-api',
   *   'iss': 'auth0',
   * }
   * ```
   */
  claims?: Record<string, unknown>;

  /**
   * Arbitrary developer-defined metadata.
   *
   * Use this for any custom data you need to associate with the
   * auth context. This is NOT stored in Cortex; it's only used
   * for runtime context injection.
   *
   * @example
   * ```typescript
   * metadata: {
   *   internalUserId: 'legacy-id-789',
   *   featureFlags: ['beta-features', 'new-ui'],
   *   region: 'us-west-2',
   *   customField: 'anything you need',
   * }
   * ```
   */
  metadata?: Record<string, unknown>;
}

/**
 * Parameters for creating an AuthContext.
 *
 * Same as AuthContext but with explicit optional typing for creation.
 */
export interface AuthContextParams {
  /** Unique user identifier (required) */
  userId: string;

  /** Tenant identifier for multi-tenant applications */
  tenantId?: string;

  /** Organization identifier within a tenant */
  organizationId?: string;

  /** Current session identifier */
  sessionId?: string;

  /** Authentication provider name */
  authProvider?: string;

  /** Authentication method used */
  authMethod?: AuthMethod;

  /** Timestamp when authentication occurred */
  authenticatedAt?: number;

  /** Raw JWT/provider claims */
  claims?: Record<string, unknown>;

  /** Arbitrary developer-defined metadata */
  metadata?: Record<string, unknown>;
}
