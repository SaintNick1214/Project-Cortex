/**
 * Cortex SDK - Memory Spaces API
 *
 * Hive/Collaboration Mode management
 */

import { ConvexClient } from "convex/browser";
import { api } from "../../convex-dev/_generated/api";
import type {
  MemorySpace,
  MemorySpaceStats,
  RegisterMemorySpaceOptions,
  RegisterMemorySpaceParams,
  ListMemorySpacesFilter,
  ListMemorySpacesResult,
  DeleteMemorySpaceOptions,
  DeleteMemorySpaceResult,
  GetMemorySpaceStatsOptions,
  UpdateMemorySpaceOptions,
} from "../types";
import type { GraphAdapter } from "../graph/types";
import { syncMemorySpaceToGraph } from "../graph";
import {
  MemorySpaceValidationError,
  validateMemorySpaceId,
  validateMemorySpaceType,
  validateMemorySpaceStatus,
  validateLimit,
  validateParticipant,
  validateParticipants,
  validateSearchQuery,
  validateName,
  validateUpdateParams,
  validateDeleteOptions,
  validateTimeWindow,
} from "./validators";
import type { ResilienceLayer } from "../resilience";
import type { AuthContext } from "../auth/types";

export class MemorySpacesAPI {
  constructor(
    private client: ConvexClient,
    private graphAdapter?: GraphAdapter,
    private resilience?: ResilienceLayer,
    private authContext?: AuthContext,
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

  /**
   * Handle ConvexError from direct Convex calls (queries that don't go through resilience)
   * Extracts error.data and includes it in the thrown error message
   */
  private handleConvexError(error: unknown): never {
    if (
      error &&
      typeof error === "object" &&
      "data" in error &&
      (error as { data: unknown }).data !== undefined
    ) {
      const convexError = error as { data: unknown };
      const errorData =
        typeof convexError.data === "string"
          ? convexError.data
          : JSON.stringify(convexError.data);
      throw new Error(errorData);
    }
    throw error;
  }

  /**
   * Register a new memory space
   *
   * @example
   * ```typescript
   * const space = await cortex.memorySpaces.register({
   *   memorySpaceId: 'team-alpha',
   *   name: 'Team Alpha Workspace',
   *   type: 'team',
   *   participants: [
   *     { id: 'user-1', type: 'user', joinedAt: Date.now() },
   *     { id: 'agent-assistant', type: 'agent', joinedAt: Date.now() },
   *   ],
   * });
   * ```
   */
  async register(
    params: RegisterMemorySpaceParams,
    options?: RegisterMemorySpaceOptions,
  ): Promise<MemorySpace> {
    // Validate required fields
    validateMemorySpaceId(params.memorySpaceId);
    // Runtime validation for potentially untrusted external input
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!params.type) {
      throw new MemorySpaceValidationError(
        "type is required",
        "MISSING_TYPE",
        "type",
      );
    }
    validateMemorySpaceType(params.type);

    // Validate optional fields
    if (params.name !== undefined) {
      validateName(params.name);
    }
    if (params.participants !== undefined) {
      validateParticipants(params.participants);
    }

    const now = Date.now();
    const participants =
      params.participants?.map((p) => ({
        ...p,
        joinedAt: now,
      })) || [];

    let result;
    try {
      result = await this.executeWithResilience(
        () =>
          this.client.mutation(api.memorySpaces.register, {
            memorySpaceId: params.memorySpaceId,
            name: params.name,
            type: params.type,
            participants,
            metadata: params.metadata,
          }),
        "memorySpaces:register",
      );
    } catch (error) {
      this.handleConvexError(error);
    }

    // Sync to graph if requested
    if (options?.syncToGraph && this.graphAdapter) {
      try {
        await syncMemorySpaceToGraph(result as MemorySpace, this.graphAdapter);
      } catch (error) {
        console.warn("Failed to sync memory space to graph:", error);
      }
    }

    return result as MemorySpace;
  }

  /**
   * Get memory space by ID
   *
   * @example
   * ```typescript
   * const space = await cortex.memorySpaces.get('team-alpha');
   * ```
   */
  async get(memorySpaceId: string): Promise<MemorySpace | null> {
    validateMemorySpaceId(memorySpaceId);

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.memorySpaces.get, {
          memorySpaceId,
        }),
      "memorySpaces:get",
    );

    const space = result as MemorySpace | null;

    // Enforce tenant isolation: verify the memory space belongs to this tenant
    if (space && this.authContext?.tenantId) {
      if (space.tenantId !== this.authContext.tenantId) {
        return null; // Memory space belongs to a different tenant
      }
    }

    return space;
  }

  /**
   * List memory spaces with pagination and sorting
   *
   * @example
   * ```typescript
   * // Basic listing
   * const teams = await cortex.memorySpaces.list({
   *   type: 'team',
   *   status: 'active',
   * });
   *
   * // With pagination and sorting
   * const result = await cortex.memorySpaces.list({
   *   type: 'personal',
   *   limit: 20,
   *   offset: 0,
   *   sortBy: 'createdAt',
   *   sortOrder: 'desc',
   * });
   * console.log(`Found ${result.total} spaces, showing ${result.spaces.length}`);
   *
   * // Filter by participant (Hive Mode)
   * const cursorSpaces = await cortex.memorySpaces.list({
   *   participant: 'cursor',
   * });
   * ```
   */
  async list(filter?: ListMemorySpacesFilter): Promise<ListMemorySpacesResult> {
    if (filter?.type) {
      validateMemorySpaceType(filter.type);
    }
    if (filter?.status) {
      validateMemorySpaceStatus(filter.status);
    }
    if (filter?.limit !== undefined) {
      validateLimit(filter.limit, 1000);
    }
    if (
      filter?.participant !== undefined &&
      filter.participant.trim().length === 0
    ) {
      throw new MemorySpaceValidationError(
        "participant filter cannot be empty",
        "INVALID_PARTICIPANT",
        "participant",
      );
    }

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.memorySpaces.list, {
          type: filter?.type,
          status: filter?.status,
          participant: filter?.participant,
          limit: filter?.limit,
          offset: filter?.offset,
          sortBy: filter?.sortBy,
          sortOrder: filter?.sortOrder,
          tenantId: this.authContext?.tenantId, // Inject tenantId for tenant isolation
        }),
      "memorySpaces:list",
    );

    return result as ListMemorySpacesResult;
  }

  /**
   * Count memory spaces
   *
   * @example
   * ```typescript
   * const activeCount = await cortex.memorySpaces.count({ status: 'active' });
   * ```
   */
  async count(filter?: {
    type?: "personal" | "team" | "project" | "custom";
    status?: "active" | "archived";
  }): Promise<number> {
    if (filter?.type) {
      validateMemorySpaceType(filter.type);
    }
    if (filter?.status) {
      validateMemorySpaceStatus(filter.status);
    }

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.memorySpaces.count, {
          type: filter?.type,
          status: filter?.status,
        }),
      "memorySpaces:count",
    );

    return result;
  }

  /**
   * Update memory space metadata
   *
   * @example
   * ```typescript
   * // Update name and status
   * await cortex.memorySpaces.update('team-alpha', {
   *   name: 'Updated Name',
   *   status: 'archived',
   * });
   *
   * // Update with graph sync
   * await cortex.memorySpaces.update('team-alpha', {
   *   metadata: { lastReview: Date.now() },
   * }, { syncToGraph: true });
   * ```
   */
  async update(
    memorySpaceId: string,
    updates: {
      name?: string;
      metadata?: Record<string, unknown>;
      status?: "active" | "archived";
    },
    options?: UpdateMemorySpaceOptions,
  ): Promise<MemorySpace> {
    validateMemorySpaceId(memorySpaceId);
    validateUpdateParams(updates);

    if (updates.name !== undefined) {
      validateName(updates.name);
    }
    if (updates.status !== undefined) {
      validateMemorySpaceStatus(updates.status);
    }

    let result;
    try {
      result = await this.executeWithResilience(
        () =>
          this.client.mutation(api.memorySpaces.update, {
            memorySpaceId,
            name: updates.name,
            metadata: updates.metadata as Record<string, unknown> | undefined,
            status: updates.status,
          }),
        "memorySpaces:update",
      );
    } catch (error) {
      this.handleConvexError(error);
    }

    // Sync to graph if requested
    if (options?.syncToGraph && this.graphAdapter) {
      try {
        await syncMemorySpaceToGraph(result as MemorySpace, this.graphAdapter);
      } catch (error) {
        console.warn("Failed to sync memory space update to graph:", error);
      }
    }

    return result as MemorySpace;
  }

  /**
   * Add participant to memory space
   *
   * @example
   * ```typescript
   * await cortex.memorySpaces.addParticipant('team-alpha', {
   *   id: 'tool-analyzer',
   *   type: 'tool',
   *   joinedAt: Date.now(),
   * });
   * ```
   */
  async addParticipant(
    memorySpaceId: string,
    participant: {
      id: string;
      type: string;
      joinedAt: number;
    },
  ): Promise<MemorySpace> {
    validateMemorySpaceId(memorySpaceId);
    validateParticipant(participant);

    try {
      const result = await this.executeWithResilience(
        () =>
          this.client.mutation(api.memorySpaces.addParticipant, {
            memorySpaceId,
            participant,
          }),
        "memorySpaces:addParticipant",
      );

      return result as MemorySpace;
    } catch (error) {
      this.handleConvexError(error);
    }
  }

  /**
   * Remove participant from memory space
   *
   * @example
   * ```typescript
   * await cortex.memorySpaces.removeParticipant('team-alpha', 'tool-analyzer');
   * ```
   */
  async removeParticipant(
    memorySpaceId: string,
    participantId: string,
  ): Promise<MemorySpace> {
    validateMemorySpaceId(memorySpaceId);
    if (!participantId || participantId.trim().length === 0) {
      throw new MemorySpaceValidationError(
        "participantId is required and cannot be empty",
        "MISSING_PARTICIPANT_ID",
        "participantId",
      );
    }

    const result = await this.executeWithResilience(
      () =>
        this.client.mutation(api.memorySpaces.removeParticipant, {
          memorySpaceId,
          participantId,
        }),
      "memorySpaces:removeParticipant",
    );

    return result as MemorySpace;
  }

  /**
   * Archive memory space (marks as inactive but preserves data)
   *
   * @example
   * ```typescript
   * await cortex.memorySpaces.archive('project-apollo', {
   *   reason: 'Project completed successfully'
   * });
   * ```
   */
  async archive(
    memorySpaceId: string,
    options?: {
      reason?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<MemorySpace> {
    validateMemorySpaceId(memorySpaceId);

    const result = await this.executeWithResilience(
      () =>
        this.client.mutation(api.memorySpaces.archive, {
          memorySpaceId,
          reason: options?.reason,
          metadata: options?.metadata as Record<string, unknown> | undefined,
        }),
      "memorySpaces:archive",
    );

    return result as MemorySpace;
  }

  /**
   * Reactivate archived memory space
   *
   * @example
   * ```typescript
   * await cortex.memorySpaces.reactivate('project-apollo');
   * ```
   */
  async reactivate(memorySpaceId: string): Promise<MemorySpace> {
    validateMemorySpaceId(memorySpaceId);

    const result = await this.executeWithResilience(
      () =>
        this.client.mutation(api.memorySpaces.reactivate, {
          memorySpaceId,
        }),
      "memorySpaces:reactivate",
    );

    return result as MemorySpace;
  }

  /**
   * Delete memory space and all associated data
   *
   * @example
   * ```typescript
   * // GDPR deletion request
   * const result = await cortex.memorySpaces.delete('user-123-personal', {
   *   cascade: true,
   *   reason: 'GDPR deletion request from user-123',
   *   confirmId: 'user-123-personal', // Safety check
   * });
   *
   * console.log(`Deleted ${result.cascade.memoriesDeleted} memories`);
   * console.log(`Deleted ${result.cascade.conversationsDeleted} conversations`);
   * console.log(`Deleted ${result.cascade.factsDeleted} facts`);
   * ```
   */
  async delete(
    memorySpaceId: string,
    options: DeleteMemorySpaceOptions,
  ): Promise<DeleteMemorySpaceResult> {
    validateMemorySpaceId(memorySpaceId);
    validateDeleteOptions(memorySpaceId, options);

    // Enforce tenant isolation: verify the memory space belongs to this tenant before deleting
    if (this.authContext?.tenantId) {
      const space = await this.get(memorySpaceId);
      if (!space) {
        throw new Error(`Memory space not found: ${memorySpaceId}`);
      }
      if (space.tenantId !== this.authContext.tenantId) {
        throw new Error(`Cannot delete memory space from another tenant`);
      }
    }

    const result = await this.executeWithResilience(
      () =>
        this.client.mutation(api.memorySpaces.deleteSpace, {
          memorySpaceId,
          cascade: options.cascade,
          reason: options.reason,
          confirmId: options.confirmId,
        }),
      "memorySpaces:delete",
    );

    return result as DeleteMemorySpaceResult;
  }

  /**
   * Get memory space statistics with optional time window and participant breakdown
   *
   * @example
   * ```typescript
   * // Basic stats
   * const stats = await cortex.memorySpaces.getStats('team-alpha');
   * console.log(`${stats.totalConversations} conversations, ${stats.totalMemories} memories`);
   *
   * // With time window
   * const weekStats = await cortex.memorySpaces.getStats('team-alpha', {
   *   timeWindow: '7d',
   * });
   * console.log(`Activity this week: ${weekStats.memoriesThisWindow} memories`);
   *
   * // With participant breakdown (Hive Mode)
   * const hiveStats = await cortex.memorySpaces.getStats('team-engineering-workspace', {
   *   timeWindow: '7d',
   *   includeParticipants: true,
   * });
   * hiveStats.participants?.forEach((p) => {
   *   console.log(`${p.participantId}: ${p.memoriesStored} memories`);
   * });
   * ```
   */
  async getStats(
    memorySpaceId: string,
    options?: GetMemorySpaceStatsOptions,
  ): Promise<MemorySpaceStats> {
    validateMemorySpaceId(memorySpaceId);

    if (options?.timeWindow) {
      validateTimeWindow(options.timeWindow);
    }

    try {
      const result = await this.executeWithResilience(
        () =>
          this.client.query(api.memorySpaces.getStats, {
            memorySpaceId,
            timeWindow: options?.timeWindow,
            includeParticipants: options?.includeParticipants,
          }),
        "memorySpaces:getStats",
      );

      return result as MemorySpaceStats;
    } catch (error) {
      this.handleConvexError(error);
    }
  }

  /**
   * Find memory spaces by participant
   *
   * @example
   * ```typescript
   * const userSpaces = await cortex.memorySpaces.findByParticipant('user-123');
   * ```
   */
  async findByParticipant(participantId: string): Promise<MemorySpace[]> {
    if (!participantId || participantId.trim().length === 0) {
      throw new MemorySpaceValidationError(
        "participantId is required and cannot be empty",
        "MISSING_PARTICIPANT_ID",
        "participantId",
      );
    }

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.memorySpaces.findByParticipant, {
          participantId,
        }),
      "memorySpaces:findByParticipant",
    );

    return result as MemorySpace[];
  }

  /**
   * Search memory spaces by name or metadata
   *
   * @example
   * ```typescript
   * const results = await cortex.memorySpaces.search('engineering', {
   *   type: 'team',
   *   status: 'active',
   *   limit: 10
   * });
   * ```
   */
  async search(
    query: string,
    options?: {
      type?: "personal" | "team" | "project" | "custom";
      status?: "active" | "archived";
      limit?: number;
    },
  ): Promise<MemorySpace[]> {
    validateSearchQuery(query);

    if (options?.type) {
      validateMemorySpaceType(options.type);
    }
    if (options?.status) {
      validateMemorySpaceStatus(options.status);
    }
    if (options?.limit !== undefined) {
      validateLimit(options.limit, 1000);
    }

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.memorySpaces.search, {
          query,
          type: options?.type,
          status: options?.status,
          limit: options?.limit,
        }),
      "memorySpaces:search",
    );

    return result as MemorySpace[];
  }

  /**
   * Update participants (combined add/remove)
   *
   * @example
   * ```typescript
   * await cortex.memorySpaces.updateParticipants('user-123-personal', {
   *   add: [{ id: 'github-copilot', type: 'ai-tool', joinedAt: Date.now() }],
   *   remove: ['old-tool']
   * });
   * ```
   */
  async updateParticipants(
    memorySpaceId: string,
    updates: {
      add?: Array<{ id: string; type: string; joinedAt: number }>;
      remove?: string[];
    },
  ): Promise<MemorySpace> {
    validateMemorySpaceId(memorySpaceId);

    // At least one operation required
    if (!updates.add && !updates.remove) {
      throw new MemorySpaceValidationError(
        "At least one of 'add' or 'remove' must be provided",
        "EMPTY_UPDATES",
      );
    }

    // Validate add participants
    if (updates.add && updates.add.length > 0) {
      validateParticipants(updates.add);
    }

    // Validate remove participant IDs
    if (updates.remove && updates.remove.length > 0) {
      for (const id of updates.remove) {
        if (!id || id.trim().length === 0) {
          throw new MemorySpaceValidationError(
            "Participant ID to remove cannot be empty",
            "MISSING_PARTICIPANT_ID",
          );
        }
      }
    }

    const result = await this.executeWithResilience(
      () =>
        this.client.mutation(api.memorySpaces.updateParticipants, {
          memorySpaceId,
          add: updates.add,
          remove: updates.remove,
        }),
      "memorySpaces:updateParticipants",
    );

    return result as MemorySpace;
  }
}

// Export validation error for users who want to catch it specifically
export { MemorySpaceValidationError } from "./validators";
