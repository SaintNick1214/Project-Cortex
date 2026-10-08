import { createErasureTransport, prepareErasure, executeErasure, ErasureError, type ErasureReceipt, type ErasureTransport } from "./erasure";
import { graphOffResult } from "../graph/erasure";
/**
 * Cortex SDK - Users API
 *
 * Coordination Layer: User profiles and supported administrative erasure
 */

import type { ConvexClient } from "convex/browser";
import { api } from "../common/backendApi";
import type {
  UserProfile,
  UserVersion,
  DeleteUserOptions,
  UserDeleteResult,
  ListUsersFilter,
  ListUsersResult,
  UserFilters,
  ExportUsersOptions,
  Conversation,
  ImmutableRecord,
  MemoryEntry,
} from "../types";

import {
  createUserExportTransport,
  exportUserData,
  resolveUserExportIdentity,
  serializeUserExportEvent,
  type UserExportDataOptions,
  type UserExportEvent,
  type UserExportTransportOptions,
  type UserExportTransport,
} from "./export";

import type { GraphAdapter } from "../graph/types";
import {
  UserValidationError,
  validateUserId,
  resolveDomainScope,
  validateUserCountFilter,
  validateUserCountResult,
  validateData,
  validateVersionNumber,
  validateTimestamp,
  validateListUsersFilter,
  validateUserFilters,
  validateDeleteUserOptions,
  validateExportOptions,
  validateUserIdsArray,
  validateBulkUpdateOptions,
  validateBulkDeleteOptions,
} from "./validators";

/**
 * Custom error for cascade deletion failures
 */
export class CascadeDeletionError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
    public readonly receipt?: ErasureReceipt,
  ) {
    super(message);
    this.name = "CascadeDeletionError";
  }
}

/** Server-confirmed profile write receipt when the updated profile cannot be read. */
export interface UserProfileWriteReceipt {
  updated: true;
  type: string;
  id: string;
  tenantId: string;
  memorySpaceId: string | undefined;
  createdId?: string;
}

/** The write committed, but returning a hydrated profile requires read capability. */
export class UserProfileWriteReceiptError extends Error {
  readonly code = "PROFILE_WRITE_COMMITTED_READ_UNAVAILABLE";
  readonly retryable = false;
  readonly outcome = "committed";
  readonly requiredCapability = "read";
  readonly receipt: Readonly<UserProfileWriteReceipt>;

  constructor(receipt: UserProfileWriteReceipt) {
    super(
      "The user profile write committed, but the updated profile is unavailable " +
        "without read capability. Do not retry the committed write.",
    );
    this.name = "UserProfileWriteReceiptError";
    this.receipt = Object.freeze({
      updated: receipt.updated,
      type: receipt.type,
      id: receipt.id,
      tenantId: receipt.tenantId,
      memorySpaceId: receipt.memorySpaceId,
      ...(receipt.createdId === undefined ? {} : { createdId: receipt.createdId }),
    });
  }
}

// Export validation error for users who want to catch it specifically
export { UserValidationError } from "./validators";

import type { ResilienceLayer } from "../resilience";
import type { AuthContext } from "../auth/types";

/**
 * Users API
 *
 * Provides convenience wrappers over immutable store (type='user') with the
 * supported exclusive-primary erasure through explicit maintenance transport.
 *
 * Cascade requires the fixed administrator erasure transport and exact tenant scope.
 * Shared/foreign/operational/provenance residuals remain in the returned receipt.
 * A configured graph requires its matching explicit graph participant; no universal
 * physical erasure or legal guarantee is supplied by this API.
 */
export class UsersAPI {
  constructor(
    private readonly client: ConvexClient,
    private readonly graphAdapter?: GraphAdapter,
    private readonly resilience?: ResilienceLayer,
    private readonly authContext?: AuthContext,
  ) {}

  /** Creates only the fixed administrative export transport; never changes SDK identity. */
  createExportTransport(
    options: UserExportTransportOptions,
  ): UserExportTransport {
    return createUserExportTransport(options);
  }

  createErasureTransport(options:Parameters<typeof createErasureTransport>[0]):ErasureTransport {
    return createErasureTransport(options);
  }

  /** Canonical JSON text for exportData events; publish after the terminal manifest. */
  serializeExportEvent(event: UserExportEvent): string {
    return serializeUserExportEvent(event);
  }

  /** Administrative complete export. Consume through the terminal manifest before publishing a bundle. */
  exportData(
    userId: string,
    options: UserExportDataOptions,
  ): AsyncGenerator<UserExportEvent> {
    return exportUserData(
      resolveUserExportIdentity(
        userId,
        options.tenantId,
        this.authContext?.tenantId,
      ),
      options,
    );
  }

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
   * Get user profile by ID
   *
   * @example
   * ```typescript
   * const user = await cortex.users.get('user-123');
   * if (user) {
   *   console.log(user.data.displayName);
   * }
   * ```
   */
  async get(userId: string): Promise<UserProfile | null> {
    // Client-side validation
    validateUserId(userId);

    const tenantId = resolveDomainScope(this.authContext?.tenantId, undefined);

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.immutable.get, {
          type: "user",
          id: userId,
          tenantId, // Tenant isolation
        }),
      "users:get",
    );

    if (!result) {
      return null;
    }

    if (result.tenantId !== tenantId) return null;

    return {
      id: result.id,
      tenantId: result.tenantId, // Include tenantId in response
      data: (result.data as Record<string, unknown> | undefined) ?? {},
      version: result.version,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }

  /**
   * Update user profile (creates new version by default)
   *
   * Throws UserProfileWriteReceiptError if the write committed but the backend
   * returned a safe receipt because the updated profile could not be read.
   *
   * @param userId - User ID to update
   * @param data - Profile data to store
   * @param options - Update options
   * @param options.skipVersioning - Don't create new version (default: false)
   * @param options.versionReason - Why this update happened (stored in metadata)
   * @param options.merge - Merge with existing data (default: true)
   *
   * @example
   * ```typescript
   * // Basic update (merges with existing, creates new version)
   * const updated = await cortex.users.update('user-123', {
   *   displayName: 'Alex Johnson',
   *   email: 'alex@example.com',
   *   preferences: { theme: 'dark' }
   * });
   *
   * // Skip versioning for routine updates
   * await cortex.users.update('user-123', {
   *   lastSeen: new Date().toISOString()
   * ```
   */
  async update(
    userId: string,
    data: Record<string, unknown>,
  ): Promise<UserProfile> {
    // Client-side validation
    validateUserId(userId);
    validateData(data, "data");

    // Default behavior: merge with existing data
    let finalData = data;
    const existing = await this.get(userId);
    if (existing) {
      finalData = this.deepMerge(existing.data, data);
    }

    const tenantId = resolveDomainScope(this.authContext?.tenantId, undefined);

    const result = graphOffResult(await this.executeWithResilience(
      () =>
        this.client.mutation(api.immutable.store, {
          type: "user",
          id: userId,
          data: finalData,
          tenantId, // Inject tenantId from auth context
        }),
      "users:update",
    ));

    if (!result) {
      // Use a static error message to avoid leaking user-controlled identifiers into logs
      throw new Error("Failed to store user profile");
    }

    // Interpret the committed response after resilience completes so this outcome
    // cannot trigger another mutation attempt or an automatic follow-up read.
    if ("updated" in result) {
      throw new UserProfileWriteReceiptError(result);
    }

    return {
      id: result.id,
      tenantId: result.tenantId, // Include tenantId in response
      data: (result.data as Record<string, unknown> | undefined) ?? {},
      version: result.version,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }

  /**
   * Delete a profile or explicitly erase its supported exclusive primary scope
   *
   * @param userId - User ID to delete
   * @param options - Deletion options
   * @param options.cascade - Use explicit administrator transport for supported erasure (default: false)
   * @param options.verify - Run verification after deletion (default: true)
   * @param options.dryRun - Preview what would be deleted without actually deleting (default: false)
   *
   * @example
   * ```typescript
   * // Simple deletion (user profile only)
   * await cortex.users.delete('user-123');
   *
   * // Preview supported erasure; shared/provenance residuals remain in the receipt.
   * const erasureTransport = cortex.users.createErasureTransport({
   *   url: process.env.CONVEX_URL!, deploymentKey: process.env.CONVEX_DEPLOY_KEY!,
   * });
   * try {
   *   const result = await cortex.users.delete('user-123', {
   *     cascade: true, tenantId: 'team-a', erasureTransport, dryRun: true,
   *   });
   *   console.log(result.erasure); // Not universal physical erasure.
   * } finally {
   *   erasureTransport.close();
   * }
   * ```
   */
  async delete(
    userId: string,
    options?: DeleteUserOptions,
  ): Promise<UserDeleteResult> {
    // Client-side validation
    validateUserId(userId);
    validateDeleteUserOptions(options);

    const cascade = options?.cascade ?? false;
    const verify = options?.verify ?? true;
    const dryRun = options?.dryRun ?? false;

    if (!cascade) {
      const tenantId = resolveDomainScope(this.authContext?.tenantId, options?.tenantId);
      // Simple delete: just user profile from immutable
      if (!dryRun) {
        graphOffResult(await this.executeWithResilience(
          () =>
            this.client.mutation(api.immutable.purge, {
              type: "user",
              id: userId,
              tenantId, // Multi-tenancy: scope to tenant
            }),
          "users:delete",
        ));
      }

      const complete = !dryRun && verify ? (await this.executeWithResilience(
        () => this.client.query(api.immutable.get, {type:"user",id:userId,tenantId}),
        "users:delete:verify-profile",
      )) === null : false;

      return {
        userId,
        deletedAt: Date.now(),
        conversationsDeleted: 0,
        conversationMessagesDeleted: 0,
        immutableRecordsDeleted: 0,
        mutableKeysDeleted: 0,
        vectorMemoriesDeleted: 0,
        factsDeleted: 0,
        graphNodesDeleted: 0,
        verification: {
          complete,
          scope: "user-profile",
          issues: [],
        },
        totalDeleted: dryRun ? 0 : 1,
        deletedLayers: dryRun ? [] : ["user-profile"],
      };
    }

    const tenantId = resolveDomainScope(this.authContext?.tenantId, options?.tenantId);
    try {
      const prepared = await prepareErasure({kind:"user", userId, tenantId}, options ?? {}, this.graphAdapter);
      return this.erasureUserResult(userId, await executeErasure(prepared, this.client));
    } catch (error) {
      if (error instanceof ErasureError) throw new CascadeDeletionError(error.message, error, error.receipt);
      throw error;
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Query Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * List user profiles with pagination, filtering, and sorting
   *
   * @param filters - Filter and pagination options
   * @returns ListUsersResult with pagination metadata
   *
   * @example
   * ```typescript
   * // Basic listing with limit
   * const result = await cortex.users.list({ limit: 50 });
   * console.log(`Found ${result.total} users, showing ${result.users.length}`);
   *
   * // With date filters and sorting
   * const recent = await cortex.users.list({
   *   createdAfter: Date.now() - 7 * 24 * 60 * 60 * 1000,
   *   sortBy: 'createdAt',
   *   sortOrder: 'desc',
   *   limit: 20
   * });
   *
   * // Pagination
   * const page2 = await cortex.users.list({ limit: 10, offset: 10 });
   * ```
   */
  async list(filters?: ListUsersFilter): Promise<ListUsersResult> {
    // Client-side validation
    validateListUsersFilter(filters);

    const tenantId = resolveDomainScope(this.authContext?.tenantId, filters?.tenantId);

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.immutable.list, {
          type: "user",
          limit: filters?.limit,
          offset: filters?.offset,
          createdAfter: filters?.createdAfter,
          createdBefore: filters?.createdBefore,
          updatedAfter: filters?.updatedAfter,
          updatedBefore: filters?.updatedBefore,
          sortBy: filters?.sortBy,
          sortOrder: filters?.sortOrder,
          tenantId, // Inject tenantId for tenant isolation
        }),
      "users:list",
    );

    // Extract entries from the new response format
    const entries = (
      result as { entries: ImmutableRecord[]; total: number; hasMore: boolean }
    ).entries;
    const total = (result as { total: number }).total;
    const hasMore = (result as { hasMore: boolean }).hasMore;

    // Map to UserProfile
    let users = entries.map((r: ImmutableRecord) => ({
      id: r.id,
      tenantId: r.tenantId, // Include tenantId for multi-tenancy
      data: r.data,
      version: r.version,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    // Apply client-side filters for nested data properties
    if (filters?.displayName) {
      const searchName = filters.displayName.toLowerCase();
      users = users.filter((u) => {
        const name = u.data.displayName as string | undefined;
        return name?.toLowerCase().includes(searchName);
      });
    }

    if (filters?.email) {
      const searchEmail = filters.email.toLowerCase();
      users = users.filter((u) => {
        const email = u.data.email as string | undefined;
        return email?.toLowerCase().includes(searchEmail);
      });
    }

    return {
      users,
      total,
      limit: filters?.limit || 50,
      offset: filters?.offset || 0,
      hasMore,
    };
  }

  /**
   * Search user profiles with filters
   *
   * @param filters - Filter, sorting, and pagination options
   * @returns Array of matching user profiles
   *
   * @example
   * ```typescript
   * // Search with date filter
   * const recentUsers = await cortex.users.search({
   *   createdAfter: Date.now() - 30 * 24 * 60 * 60 * 1000,
   *   limit: 100
   * });
   *
   * // Search by displayName (client-side filter)
   * const alexUsers = await cortex.users.search({
   *   displayName: 'alex',
   *   limit: 50
   * });
   *
   * // Search with sorting
   * const sorted = await cortex.users.search({
   *   sortBy: 'updatedAt',
   *   sortOrder: 'desc'
   * });
   * ```
   */
  async search(filters: UserFilters): Promise<UserProfile[]> {
    // Client-side validation
    validateUserFilters(filters);

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.immutable.list, {
          type: "user",
          limit: filters.limit,
          offset: filters.offset,
          createdAfter: filters.createdAfter,
          createdBefore: filters.createdBefore,
          updatedAfter: filters.updatedAfter,
          updatedBefore: filters.updatedBefore,
          sortBy: filters.sortBy,
          sortOrder: filters.sortOrder,
          tenantId: this.authContext?.tenantId, // Multi-tenancy: scope to tenant
        }),
      "users:search",
    );

    // Extract entries from the new response format
    const entries = (result as { entries: ImmutableRecord[] }).entries;

    // Map to UserProfile
    let users = entries.map((r: ImmutableRecord) => ({
      id: r.id,
      data: r.data,
      version: r.version,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    // Apply client-side filters for nested data properties
    if (filters.displayName) {
      const searchName = filters.displayName.toLowerCase();
      users = users.filter((u) => {
        const name = u.data.displayName as string | undefined;
        return name?.toLowerCase().includes(searchName);
      });
    }

    if (filters.email) {
      const searchEmail = filters.email.toLowerCase();
      users = users.filter((u) => {
        const email = u.data.email as string | undefined;
        return email?.toLowerCase().includes(searchEmail);
      });
    }

    return users;
  }

  /**
   * Count user profiles with optional filters
   *
   * @param filters - Optional filter parameters
   * @returns Count of matching user profiles
   *
   * @example
   * ```typescript
   * // Total users
   * const total = await cortex.users.count();
   * console.log(`Total users: ${total}`);
   *
   * // Count recent users (last 30 days)
   * const recentCount = await cortex.users.count({
   *   createdAfter: Date.now() - 30 * 24 * 60 * 60 * 1000
   * });
   *
   * // Count users updated this week
   * const activeCount = await cortex.users.count({
   *   updatedAfter: Date.now() - 7 * 24 * 60 * 60 * 1000
   * });
   * ```
   */
  async count(filters?: UserFilters): Promise<number> {
    validateUserCountFilter(filters);
    const tenantId = resolveDomainScope(this.authContext?.tenantId, filters?.tenantId);
    const result: unknown = await this.executeWithResilience(
      () => this.client.query(api.immutable.count, {
        type: "user",
        tenantId,
        createdAfter: filters?.createdAfter,
        createdBefore: filters?.createdBefore,
        updatedAfter: filters?.updatedAfter,
        updatedBefore: filters?.updatedBefore,
      }),
      "users:count",
    );
    validateUserCountResult(result);
    return result;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Version Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Get specific version of user profile
   *
   * @example
   * ```typescript
   * const v1 = await cortex.users.getVersion('user-123', 1);
   * ```
   */
  async getVersion(
    userId: string,
    version: number,
  ): Promise<UserVersion | null> {
    // Client-side validation
    validateUserId(userId);
    validateVersionNumber(version);

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.immutable.getVersion, {
          type: "user",
          id: userId,
          version,
          tenantId: this.authContext?.tenantId, // Multi-tenancy: scope to tenant
        }),
      "users:getVersion",
    );

    if (!result) {
      return null;
    }

    return {
      version: result.version,
      data: (result.data as Record<string, unknown> | undefined) ?? {},
      timestamp: result.timestamp,
    };
  }

  /**
   * Get version history of user profile
   *
   * @example
   * ```typescript
   * const history = await cortex.users.getHistory('user-123');
   * console.log(`User has ${history.length} versions`);
   * ```
   */
  async getHistory(userId: string): Promise<UserVersion[]> {
    // Client-side validation
    validateUserId(userId);

    const tenantId = resolveDomainScope(this.authContext?.tenantId, undefined);

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.immutable.getHistory, {
          tenantId,
          type: "user",
          id: userId,
        }),
      "users:getHistory",
    );

    return result.map(
      (v: { version: number; data: unknown; timestamp: number }) => ({
        version: v.version,
        data: (v.data as Record<string, unknown> | undefined) ?? {},
        timestamp: v.timestamp,
      }),
    );
  }

  /**
   * Get user profile at specific timestamp
   *
   * @example
   * ```typescript
   * const snapshot = await cortex.users.getAtTimestamp(
   *   'user-123',
   *   new Date('2025-10-01')
   * );
   * ```
   */
  async getAtTimestamp(
    userId: string,
    timestamp: Date,
  ): Promise<UserVersion | null> {
    // Client-side validation
    validateUserId(userId);
    validateTimestamp(timestamp.getTime());

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.immutable.getAtTimestamp, {
          type: "user",
          id: userId,
          timestamp: timestamp.getTime(),
        }),
      "users:getAtTimestamp",
    );

    if (!result) {
      return null;
    }

    return {
      version: result.version,
      data: (result.data as Record<string, unknown> | undefined) ?? {},
      timestamp: result.timestamp,
    };
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Utility Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Check if user profile exists
   *
   * @example
   * ```typescript
   * if (await cortex.users.exists('user-123')) {
   *   console.log('User exists');
   * }
   * ```
   */
  async exists(userId: string): Promise<boolean> {
    // Client-side validation
    validateUserId(userId);

    const user = await this.get(userId);
    return user !== null;
  }

  /**
   * Get user profile or create with defaults if doesn't exist
   *
   * @param userId - User ID
   * @param defaults - Default profile data if user doesn't exist
   * @returns User profile (existing or newly created)
   *
   * @example
   * ```typescript
   * const user = await cortex.users.getOrCreate('user-123', {
   *   displayName: 'Guest User',
   *   preferences: { theme: 'light' },
   *   metadata: { tier: 'free' }
   * });
   * ```
   */
  async getOrCreate(
    userId: string,
    defaults?: Record<string, unknown>,
  ): Promise<UserProfile> {
    // Client-side validation
    validateUserId(userId);
    if (defaults !== undefined) {
      validateData(defaults, "defaults");
    }

    // Try to get existing user
    const existing = await this.get(userId);

    if (existing) {
      return existing;
    }

    // Create with defaults (immutable.store handles upsert)
    return await this.update(userId, defaults || {});
  }

  /**
   * Merge partial updates with existing profile
   *
   * This is an alias for update() with merge behavior, which is the default.
   *
   * @param userId - User ID
   * @param updates - Partial updates to merge with existing data
   * @returns Updated user profile
   *
   * @example
   * ```typescript
   * // Existing: { displayName: 'Alex', preferences: { theme: 'dark', language: 'en' } }
   * await cortex.users.merge('user-123', {
   *   preferences: { notifications: true }  // Adds notifications, keeps theme and language
   * });
   * // Result: { displayName: 'Alex', preferences: { theme: 'dark', language: 'en', notifications: true } }
   * ```
   */
  async merge(
    userId: string,
    updates: Record<string, unknown>,
  ): Promise<UserProfile> {
    // Client-side validation
    validateUserId(userId);
    validateData(updates, "updates");

    const existing = await this.get(userId);

    if (!existing) {
      // If user doesn't exist, just store the updates
      return await this.update(userId, updates);
    }

    // Deep merge existing data with updates
    const mergedData = this.deepMerge(existing.data, updates);

    return await this.update(userId, mergedData);
  }

  /**
   * Helper: Deep merge two objects
   */
  private deepMerge(
    target: Record<string, unknown>,
    source: Record<string, unknown>,
  ): Record<string, unknown> {
    const result = { ...target };

    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        const sourceValue = source[key];
        const targetValue = target[key];

        if (
          sourceValue &&
          typeof sourceValue === "object" &&
          !Array.isArray(sourceValue) &&
          targetValue &&
          typeof targetValue === "object" &&
          !Array.isArray(targetValue)
        ) {
          // Recursively merge nested objects
          result[key] = this.deepMerge(
            targetValue as Record<string, unknown>,
            sourceValue as Record<string, unknown>,
          );
        } else {
          // Overwrite with source value
          result[key] = sourceValue;
        }
      }
    }

    return result;
  }

  /**
   * Export user profiles with optional related data
   *
   * @param options - Export options including format and what to include
   * @returns Exported data as JSON or CSV string
   *
   * @example
   * ```typescript
   * // Basic JSON export
   * const json = await cortex.users.export({ format: 'json' });
   *
   * // Export with version history
   * const withHistory = await cortex.users.export({
   *   format: 'json',
   *   includeVersionHistory: true
   * });
   *
   * // Limited aggregate export of selected profile and related domains; use exportData for the complete supported bundle
   * const gdprExport = await cortex.users.export({
   *   format: 'json',
   *   filters: { displayName: 'alex' },
   *   includeVersionHistory: true,
   *   includeConversations: true,
   *   includeMemories: true
   * });
   * ```
   */
  async export(options?: ExportUsersOptions): Promise<string> {
    // Client-side validation
    validateExportOptions(options);

    const result = await this.list(options?.filters);
    const users = result.users;

    // Build export data structure
    const exportData: Array<{
      id: string;
      data: Record<string, unknown>;
      version: number;
      createdAt: number;
      updatedAt: number;
      versionHistory?: Array<{
        version: number;
        data: Record<string, unknown>;
        timestamp: number;
      }>;
      conversations?: Conversation[];
      memories?: MemoryEntry[];
    }> = [];

    for (const user of users) {
      const userData: (typeof exportData)[number] = {
        id: user.id,
        data: user.data,
        version: user.version,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };

      // Include version history if requested
      if (options?.includeVersionHistory) {
        try {
          const history = await this.getHistory(user.id);
          userData.versionHistory = history;
        } catch (_e) {
          // Skip if history unavailable
        }
      }

      // Include conversations if requested
      if (options?.includeConversations) {
        try {
          const convosResult = await this.client.query(api.conversations.list, {
            userId: user.id,
          });
          // Handle both array and paginated result formats
          const convos = Array.isArray(convosResult)
            ? convosResult
            : (convosResult as { conversations: Conversation[] }).conversations;
          userData.conversations = convos as Conversation[];
        } catch (_e) {
          // Skip if conversations unavailable
        }
      }

      // Include memories if requested
      // Note: memories.list requires memorySpaceId, so we extract memory spaces
      // from the user's conversations first
      if (options?.includeMemories) {
        try {
          const allMemories: MemoryEntry[] = [];

          // Get memory space IDs from conversations
          if (userData.conversations && userData.conversations.length > 0) {
            const memorySpaceIds = new Set<string>();
            for (const convo of userData.conversations) {
              if (convo.memorySpaceId) {
                memorySpaceIds.add(convo.memorySpaceId);
              }
            }

            // Query memories from each memory space
            for (const memorySpaceId of memorySpaceIds) {
              try {
                const memories = await this.client.query(api.memories.list, {
                  memorySpaceId,
                  userId: user.id,
                });
                if (Array.isArray(memories)) {
                  allMemories.push(...(memories as MemoryEntry[]));
                }
              } catch (_memErr) {
                // Skip unavailable memory spaces
              }
            }
          }

          userData.memories = allMemories;
        } catch (_e) {
          // Skip if memories unavailable
        }
      }

      exportData.push(userData);
    }

    if (options?.format === "csv") {
      // CSV export - flatten structure
      const headers = [
        "id",
        "version",
        "createdAt",
        "updatedAt",
        "data",
        ...(options.includeVersionHistory ? ["versionHistoryCount"] : []),
        ...(options.includeConversations ? ["conversationsCount"] : []),
        ...(options.includeMemories ? ["memoriesCount"] : []),
      ];

      const rows = exportData.map((u) => [
        u.id,
        u.version.toString(),
        new Date(u.createdAt).toISOString(),
        new Date(u.updatedAt).toISOString(),
        JSON.stringify(u.data),
        ...(options.includeVersionHistory
          ? [(u.versionHistory?.length || 0).toString()]
          : []),
        ...(options.includeConversations
          ? [(u.conversations?.length || 0).toString()]
          : []),
        ...(options.includeMemories
          ? [(u.memories?.length || 0).toString()]
          : []),
      ]);

      return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    }

    // JSON export (default)
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Bulk update multiple users by explicit IDs or filters
   *
   * @param userIdsOrFilters - Array of user IDs OR UserFilters object
   * @param updates - Updates to apply to matching users
   * @param options - Update options
   * @returns Update result with count and affected userIds
   * @throws UserProfileWriteReceiptError if an item committed without a readable
   * profile. Earlier items may already have committed; do not replay the batch.
   *
   * @example
   * ```typescript
   * // Update by explicit IDs
   * const result = await cortex.users.updateMany(
   *   ['user-1', 'user-2', 'user-3'],
   *   { data: { status: 'active' } }
   * );
   *
   * // Update by filters (all users created in last 7 days)
   * const filtered = await cortex.users.updateMany(
   *   { createdAfter: Date.now() - 7 * 24 * 60 * 60 * 1000 },
   *   { data: { welcomeEmailSent: true } }
   * );
   *
   * // Dry run to preview
   * const preview = await cortex.users.updateMany(
   *   { displayName: 'alex' },
   *   { data: { verified: true } },
   *   { dryRun: true }
   * );
   * console.log(`Would update ${preview.userIds.length} users`);
   * ```
   */
  async updateMany(
    userIdsOrFilters: string[] | UserFilters,
    updates: { data: Record<string, unknown> },
    options?: { skipVersioning?: boolean; dryRun?: boolean },
  ): Promise<{ updated: number; userIds: string[] }> {
    // Runtime validation for potentially untrusted external input
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!updates || !updates.data) {
      throw new UserValidationError(
        "updates.data is required",
        "MISSING_DATA",
        "updates.data",
      );
    }
    validateData(updates.data, "updates.data");
    validateBulkUpdateOptions(options);

    // Determine if we're using userIds array or filters
    let targetUserIds: string[];

    if (Array.isArray(userIdsOrFilters)) {
      // Explicit userIds array
      validateUserIdsArray(userIdsOrFilters, 1, 100);
      targetUserIds = userIdsOrFilters;
    } else {
      // Filter-based selection - search for matching users
      validateUserFilters(userIdsOrFilters);
      const matchingUsers = await this.search(userIdsOrFilters);
      targetUserIds = matchingUsers.map((u) => u.id);

      // Limit to 100 users for safety
      if (targetUserIds.length > 100) {
        throw new UserValidationError(
          `Filter matched ${targetUserIds.length} users, maximum is 100. Add more specific filters or use limit.`,
          "TOO_MANY_MATCHES",
          "filters",
        );
      }
    }

    if (options?.dryRun) {
      return {
        updated: 0,
        userIds: targetUserIds,
      };
    }

    const results: string[] = [];

    for (const userId of targetUserIds) {
      try {
        const user = await this.get(userId);
        if (user) {
          await this.update(userId, updates.data);
          results.push(userId);
        }
      } catch (error) {
        // A committed write must not be reported as an unsuccessful bulk item.
        if (error instanceof UserProfileWriteReceiptError) {
          throw error;
        }
        // Continue on ordinary errors, preserving existing bulk behavior.
        continue;
      }
    }

    return {
      updated: results.length,
      userIds: results,
    };
  }

  /**
   * Bulk delete multiple users by explicit IDs or filters
   *
   * @param userIdsOrFilters - Array of user IDs OR UserFilters object
   * @param options - Delete options (cascade, dryRun)
   * @returns Delete result with count and affected userIds
   *
   * @example
   * ```typescript
   * const erasureTransport = cortex.users.createErasureTransport({
   *   url: process.env.CONVEX_URL!, deploymentKey: process.env.CONVEX_DEPLOY_KEY!,
   * });
   * try {
   *   const preview = await cortex.users.deleteMany(['user-1', 'user-2'], {
   *     cascade: true, tenantId: 'team-a', erasureTransport, dryRun: true,
   *   });
   *   console.log(preview); // Inspect per-user supported-scope receipts and residuals.
   * } finally {
   *   erasureTransport.close();
   * }
   * ```
   */
  async deleteMany(
    userIdsOrFilters: string[] | UserFilters,
    options?: DeleteUserOptions,
  ): Promise<{ deleted: number; userIds: string[]; complete: boolean; outcomes: UserDeleteResult[]; unstarted: string[] }> {
    validateBulkDeleteOptions(options);
    validateDeleteUserOptions(options);
    const tenantId = resolveDomainScope(this.authContext?.tenantId, options?.tenantId);
    let targetUserIds: string[];
    if (Array.isArray(userIdsOrFilters)) {
      validateUserIdsArray(userIdsOrFilters, 1, 100);
      targetUserIds = [...new Set(userIdsOrFilters)];
    } else {
      validateUserFilters(userIdsOrFilters);
      resolveDomainScope(tenantId, userIdsOrFilters.tenantId);
      targetUserIds = [];
      let offset = 0;
      for (;;) {
        if (options?.signal?.aborted) throw new ErasureError("ERASURE_CANCELLED");
        const page = await this.list({...userIdsOrFilters, tenantId, limit:500, offset});
        targetUserIds.push(...page.users.map(user=>user.id));
        if (!page.hasMore) break;
        offset += 500;
      }
      targetUserIds = [...new Set(targetUserIds)];
    }
    const outcomes: UserDeleteResult[] = [], unstarted = [...targetUserIds], committed: string[] = [];
    if (options?.cascade) {
      // Full all-user preparation is completed before the first mutation.
      const prepared = [];
      for (const userId of targetUserIds) prepared.push(await prepareErasure({kind:"user", userId, tenantId}, options, this.graphAdapter));
      for (let index=0;index<prepared.length;index++) {
        try {
          const receipt = await executeErasure(prepared[index], this.client);
          outcomes.push(this.erasureUserResult(targetUserIds[index], receipt));
          unstarted.shift();
          if (receipt.outcomes.some(item=>item.deleted)) committed.push(targetUserIds[index]);
        } catch (error) {
          const partial = new CascadeDeletionError("Bulk erasure stopped; prior commits and unstarted users are retained.", error, error instanceof ErasureError ? error.receipt : undefined);
          if (partial.receipt && (partial.receipt.executed || partial.receipt.outcomes.length > 0 || partial.receipt.unknown.length > 0)) unstarted.shift();
          Object.assign(partial,{outcomes,unstarted,deleted:committed.length,userIds:committed});
          throw partial;
        }
      }
    } else {
      for (const userId of targetUserIds) {const result=await this.delete(userId,options);outcomes.push(result);unstarted.shift();if(result.totalDeleted)committed.push(userId);}
    }
    return {deleted:committed.length,userIds:options?.dryRun?targetUserIds:committed,complete:outcomes.every(result=>result.verification.complete),outcomes,unstarted};
  }

  /** Compatibility fields count received native primary commits only. */
  private erasureUserResult(userId:string, receipt:ErasureReceipt):UserDeleteResult {
    const count=(table:string)=>receipt.perTable[table]?.deleted??0;
    const roots = new Set(receipt.planned.filter(row => row.table === "immutable" && row.action === "root").map(row => row.id));
    const profilesDeleted = receipt.outcomes.reduce((sum, item) => sum + (item.table === "immutable" && roots.has(item.id) && item.state === "committed" ? item.deleted : 0), 0);
    const immutableRecordsDeleted = Math.max(0, count("immutable") - profilesDeleted);
    const deletedLayers = Object.entries(receipt.perTable).flatMap(([table, value]) => {
      if (value.deleted === 0 || (table === "immutable" && immutableRecordsDeleted === 0)) return [];
      return [table === "memories" ? "vector" : table];
    });
    if (receipt.graph.nodesDeleted > 0) deletedLayers.push("graph");
    if (profilesDeleted > 0) deletedLayers.push("user-profile");
    return {userId,deletedAt:receipt.endedAt,conversationsDeleted:count("conversations"),conversationMessagesDeleted:receipt.outcomes.reduce((sum,item)=>sum+item.messages,0),immutableRecordsDeleted,mutableKeysDeleted:count("mutable"),vectorMemoriesDeleted:count("memories"),factsDeleted:count("facts"),graphNodesDeleted:receipt.graph.nodesDeleted,totalDeleted:receipt.totalDeleted,deletedLayers,verification:{complete:receipt.verification.complete,issues:receipt.errors},erasure:receipt};
  }

}
