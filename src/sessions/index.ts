/**
 * Cortex SDK - Sessions API
 *
 * Native session management with fully extensible metadata.
 * Sessions are stored in Convex for real-time reactivity.
 */

import { randomBytes } from "crypto";
import type { ConvexClient } from "convex/browser";
import { api } from "../../convex-dev/_generated/api";
import type {
  Session,
  CreateSessionParams,
  SessionFilters,
  ExpireSessionsOptions,
  EndSessionsResult,
} from "./types";
import type { ResilienceLayer } from "../resilience";
import type { GraphAdapter } from "../graph/types";
import {
  validateSessionId,
  validateUserId,
  validateSessionFilters,
  validateCreateSessionParams,
} from "./validators";

// Re-export types
export type {
  Session,
  SessionStatus,
  SessionMetadata,
  CreateSessionParams,
  SessionFilters,
  ExpireSessionsOptions,
  EndSessionsResult,
} from "./types";

// Re-export error
export { SessionValidationError } from "./validators";

import type { AuthContext } from "../auth/types";

/**
 * Sessions API
 *
 * Provides native session management for multi-session applications.
 * Session lifecycle is controlled via governance policies.
 */
export class SessionsAPI {
  constructor(
    private readonly client: ConvexClient,
    private readonly graphAdapter?: GraphAdapter,
    private readonly resilience?: ResilienceLayer,
    private readonly authContext?: AuthContext,
  ) {}

  /**
   * Execute an operation through the resilience layer (if available)
   */
  private async executeWithResilience<T>(
    operation: () => Promise<T>,
    operationName: string,
  ): Promise<T> {
    if (this.resilience) {
      return this.resilience.execute(operation, operationName);
    }
    return operation();
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Core Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Create a new session for a user.
   *
   * @param params - Session creation parameters
   * @returns Created session
   *
   * @example
   * ```typescript
   * const session = await cortex.sessions.create({
   *   userId: 'user-123',
   *   tenantId: 'tenant-456',
   *   memorySpaceId: 'workspace-abc',
   *   metadata: {
   *     device: 'Chrome on macOS',
   *     browser: 'Chrome 120',
   *     ip: '192.168.1.1',
   *     location: 'San Francisco, CA',
   *   },
   * });
   * ```
   */
  async create(params: CreateSessionParams): Promise<Session> {
    validateCreateSessionParams(params);

    const now = Date.now();
    const sessionId = params.sessionId || this.generateSessionId();

    const session = await this.executeWithResilience(
      () =>
        this.client.mutation(api.sessions.create, {
          sessionId,
          userId: params.userId,
          tenantId: params.tenantId ?? this.authContext?.tenantId, // Fall back to auth context
          memorySpaceId: params.memorySpaceId,
          metadata: params.metadata,
          startedAt: now,
          expiresAt: params.expiresAt,
        }),
      "sessions:create",
    );

    return session as Session;
  }

  /**
   * Get a session by ID.
   *
   * @param sessionId - Session ID to retrieve
   * @returns Session or null if not found
   *
   * @example
   * ```typescript
   * const session = await cortex.sessions.get('sess-123');
   * if (session && session.status === 'active') {
   *   console.log('Session is active');
   * }
   * ```
   */
  async get(sessionId: string): Promise<Session | null> {
    validateSessionId(sessionId);

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.sessions.get, {
          sessionId,
        }),
      "sessions:get",
    );

    return result as Session | null;
  }

  /**
   * Get or create a session for a user.
   *
   * If the user has an active session, returns it.
   * Otherwise, creates a new session.
   *
   * @param userId - User ID
   * @param metadata - Optional session metadata
   * @returns Session (existing or newly created)
   *
   * @example
   * ```typescript
   * const session = await cortex.sessions.getOrCreate('user-123', {
   *   device: 'Mobile Safari',
   * });
   * ```
   */
  async getOrCreate(
    userId: string,
    metadata?: Record<string, unknown>,
  ): Promise<Session> {
    validateUserId(userId);

    // Check for existing active session
    const active = await this.getActive(userId);
    if (active.length > 0) {
      // Return the most recently active session
      return active[0]!;
    }

    // Create new session
    return this.create({
      userId,
      metadata,
    });
  }

  /**
   * Update session activity timestamp (touch).
   *
   * @param sessionId - Session ID to touch
   *
   * @example
   * ```typescript
   * // Keep session alive during user activity
   * await cortex.sessions.touch('sess-123');
   * ```
   */
  async touch(sessionId: string): Promise<void> {
    validateSessionId(sessionId);

    await this.executeWithResilience(
      () =>
        this.client.mutation(api.sessions.touch, {
          sessionId,
        }),
      "sessions:touch",
    );
  }

  /**
   * End a session.
   *
   * @param sessionId - Session ID to end
   *
   * @example
   * ```typescript
   * // End session on logout
   * await cortex.sessions.end('sess-123');
   * ```
   */
  async end(sessionId: string): Promise<void> {
    validateSessionId(sessionId);

    await this.executeWithResilience(
      () =>
        this.client.mutation(api.sessions.end, {
          sessionId,
        }),
      "sessions:end",
    );
  }

  /**
   * End all sessions for a user.
   *
   * @param userId - User ID
   * @returns Result with count of ended sessions
   *
   * @example
   * ```typescript
   * // End all sessions on password change
   * const result = await cortex.sessions.endAll('user-123');
   * console.log(`Ended ${result.ended} sessions`);
   * ```
   */
  async endAll(userId: string): Promise<EndSessionsResult> {
    validateUserId(userId);

    const result = await this.executeWithResilience(
      () =>
        this.client.mutation(api.sessions.endAll, {
          userId,
        }),
      "sessions:endAll",
    );

    return result as EndSessionsResult;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Query Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * List sessions with filters.
   *
   * @param filters - Filter parameters
   * @returns Array of matching sessions
   *
   * @example
   * ```typescript
   * // List all active sessions for a tenant
   * const sessions = await cortex.sessions.list({
   *   tenantId: 'tenant-456',
   *   status: 'active',
   * });
   * ```
   */
  async list(filters: SessionFilters): Promise<Session[]> {
    validateSessionFilters(filters);

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.sessions.list, {
          userId: filters.userId,
          tenantId: filters.tenantId,
          memorySpaceId: filters.memorySpaceId,
          status: filters.status,
          limit: filters.limit,
          offset: filters.offset,
        }),
      "sessions:list",
    );

    return result as Session[];
  }

  /**
   * Count sessions with filters.
   *
   * @param filters - Filter parameters
   * @returns Count of matching sessions
   *
   * @example
   * ```typescript
   * const activeCount = await cortex.sessions.count({
   *   tenantId: 'tenant-456',
   *   status: 'active',
   * });
   * ```
   */
  async count(filters: SessionFilters): Promise<number> {
    validateSessionFilters(filters);

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.sessions.count, {
          userId: filters.userId,
          tenantId: filters.tenantId,
          memorySpaceId: filters.memorySpaceId,
          status: filters.status,
        }),
      "sessions:count",
    );

    return result as number;
  }

  /**
   * Get active sessions for a user.
   *
   * @param userId - User ID
   * @returns Array of active sessions
   *
   * @example
   * ```typescript
   * const active = await cortex.sessions.getActive('user-123');
   * console.log(`User has ${active.length} active sessions`);
   * ```
   */
  async getActive(userId: string): Promise<Session[]> {
    validateUserId(userId);

    return this.list({
      userId,
      status: "active",
    });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Maintenance Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Expire idle sessions based on governance policies.
   *
   * This is typically called by a scheduled job or governance enforcement.
   *
   * @param options - Expiration options
   * @returns Result with count of expired sessions
   *
   * @example
   * ```typescript
   * // Expire sessions idle for more than 30 minutes
   * const result = await cortex.sessions.expireIdle({
   *   idleTimeout: 30 * 60 * 1000, // 30 minutes in ms
   * });
   * console.log(`Expired ${result.expired} idle sessions`);
   *
   * // Expire for specific tenant
   * const tenantResult = await cortex.sessions.expireIdle({
   *   tenantId: 'tenant-456',
   *   idleTimeout: 15 * 60 * 1000, // 15 minutes
   * });
   * ```
   */
  async expireIdle(
    options?: ExpireSessionsOptions,
  ): Promise<{ expired: number }> {
    const result = await this.executeWithResilience(
      () =>
        this.client.mutation(api.sessions.expireIdle, {
          tenantId: options?.tenantId,
          idleTimeout: options?.idleTimeout ?? 30 * 60 * 1000, // Default 30 min
        }),
      "sessions:expireIdle",
    );

    return result as { expired: number };
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Private Helpers
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Generate a cryptographically secure unique session ID
   */
  private generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = randomBytes(8).toString("hex");
    return `sess-${timestamp}-${randomPart}`;
  }
}
