import { createErasureTransport, prepareErasure, executeErasure, type ErasureTransport } from "../users/erasure";
import type { FunctionReference, FunctionArgs, FunctionReturnType } from "convex/server";
import { writeGraphMutation, type GraphPrimary } from "../graph/erasure";
import type { GraphSyncPolicy } from "../graph/types";
/**
 * Cortex SDK - Memory Spaces API
 *
 * Hive/Collaboration Mode management
 */

import { isRegistryStatisticsUnavailable } from "../agents/statistics";
import { ConvexClient } from "convex/browser";
import { api } from "../common/backendApi";
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
import {
  MemorySpaceValidationError,
  validateMemorySpaceId,
  resolveDomainScope,
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
    private readonly graphSyncPolicy?: GraphSyncPolicy,
  ) {}
  createErasureTransport(options:Parameters<typeof createErasureTransport>[0]):ErasureTransport {return createErasureTransport(options);}
  private mutateGraph<M extends FunctionReference<"mutation", "public">>(reference: M, args: FunctionArgs<M>, explicit?: boolean): Promise<GraphPrimary<FunctionReturnType<M>>> {
    return writeGraphMutation(this.client, this.graphAdapter, this.graphSyncPolicy, reference, args, explicit);
  }
  private executeGraphWrite<T>(operation: () => Promise<T>, name: string, explicit?: boolean): Promise<T> {
    // A configured graph writer has one primary application invocation; delivery retries are separate.
    return this.graphAdapter && explicit !== false ? operation() : this.executeWithResilience(operation, name);
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
    _options?: RegisterMemorySpaceOptions,
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

    const tenantId = resolveDomainScope(this.authContext?.tenantId, params.tenantId);

    let result;
    try {
      result = await this.executeGraphWrite(
        () =>
          this.mutateGraph(api.memorySpaces.register, {
            memorySpaceId: params.memorySpaceId,
            name: params.name,
            type: params.type,
            tenantId, // Multi-tenancy: associate space with tenant
            participants,
            metadata: params.metadata,
          }, _options?.syncToGraph),
        "memorySpaces:register", _options?.syncToGraph,
      );
    } catch (error) {
      this.handleConvexError(error);
    }

    // Sync to graph if requested
    

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

    const tenantId = resolveDomainScope(this.authContext?.tenantId, undefined);

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.memorySpaces.get, {
          memorySpaceId,
          tenantId, // Multi-tenancy: find space within tenant
        }),
      "memorySpaces:get",
    );

    return result as MemorySpace | null;
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

    const tenantId = resolveDomainScope(this.authContext?.tenantId, filter?.tenantId);

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
          tenantId, // Inject tenantId for tenant isolation
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

    const tenantId = resolveDomainScope(this.authContext?.tenantId, undefined);

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.memorySpaces.count, {
          tenantId,
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
    _options?: UpdateMemorySpaceOptions,
  ): Promise<MemorySpace> {
    validateMemorySpaceId(memorySpaceId);
    validateUpdateParams(updates);

    if (updates.name !== undefined) {
      validateName(updates.name);
    }
    if (updates.status !== undefined) {
      validateMemorySpaceStatus(updates.status);
    }

    const tenantId = resolveDomainScope(this.authContext?.tenantId, undefined);

    let result;
    try {
      result = await this.executeGraphWrite(
        () =>
          this.mutateGraph(api.memorySpaces.update, {
          tenantId,
            memorySpaceId,
            name: updates.name,
            metadata: updates.metadata as Record<string, unknown> | undefined,
            status: updates.status,
          }, _options?.syncToGraph),
        "memorySpaces:update", _options?.syncToGraph,
      );
    } catch (error) {
      this.handleConvexError(error);
    }

    // Sync to graph if requested
    

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
      const tenantId = resolveDomainScope(this.authContext?.tenantId, undefined);

    const result = await this.executeGraphWrite(
        () =>
          this.mutateGraph(api.memorySpaces.addParticipant, {
          tenantId,
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

    const tenantId = resolveDomainScope(this.authContext?.tenantId, undefined);

    const result = await this.executeGraphWrite(
      () =>
        this.mutateGraph(api.memorySpaces.removeParticipant, {
          tenantId,
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

    const tenantId = resolveDomainScope(this.authContext?.tenantId, undefined);

    const result = await this.executeGraphWrite(
      () =>
        this.mutateGraph(api.memorySpaces.archive, {
          tenantId,
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

    const tenantId = resolveDomainScope(this.authContext?.tenantId, undefined);

    const result = await this.executeGraphWrite(
      () =>
        this.mutateGraph(api.memorySpaces.reactivate, {
          tenantId,
          memorySpaceId,
        }),
      "memorySpaces:reactivate",
    );

    return result as MemorySpace;
  }

  /**
   * Delete a memory space and its supported exclusive primary data.
   * Requires explicit administrator transport; inspect residual/partial erasure receipt.
   *
   * @example
   * ```typescript
   * const erasureTransport = cortex.memorySpaces.createErasureTransport({
   *   url: process.env.CONVEX_URL!, deploymentKey: process.env.CONVEX_DEPLOY_KEY!,
   * });
   * try {
   *   const result = await cortex.memorySpaces.delete('user-123-personal', {
   *     cascade: true, tenantId: 'team-a', erasureTransport, dryRun: true,
   *     reason: 'Reviewed retention request', confirmId: 'user-123-personal',
   *   });
   *   console.log(result.erasure); // Supported scope; shared/provenance residuals remain.
   * } finally {
   *   erasureTransport.close();
   * }
   * ```
   */
  async delete(
    memorySpaceId: string,
    options: DeleteMemorySpaceOptions,
  ): Promise<DeleteMemorySpaceResult> {
    validateMemorySpaceId(memorySpaceId);
    validateDeleteOptions(memorySpaceId, options);

    const tenantId = resolveDomainScope(this.authContext?.tenantId, options.tenantId);
    const prepared = await prepareErasure({kind:"space", memorySpaceId, tenantId}, options, this.graphAdapter);
    const erasure = await executeErasure(prepared, this.client);
    const count = (table:string)=>erasure.perTable[table]?.deleted??0;
    const registry = erasure.outcomes.some(item=>item.table==="memorySpaces"&&item.deleted===1);
    return {memorySpaceId,deleted:registry,cascade:{conversationsDeleted:count("conversations"),memoriesDeleted:count("memories"),factsDeleted:count("facts"),totalBytes:erasure.outcomes.filter(item=>item.deleted).reduce((sum,item)=>sum+(item.serializedBytes??0),0)},totalBytesKind:"serializedDocumentEstimate",reason:options.reason,deletedAt:erasure.endedAt,erasure};
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

    const tenantId = resolveDomainScope(this.authContext?.tenantId, options?.tenantId);
    try {
      const result = await this.executeWithResilience(async () => {
        try { return { stats: await this.client.query(api.memorySpaces.getStats, {
          memorySpaceId, tenantId, timeWindow: options?.timeWindow, includeParticipants: options?.includeParticipants,
        }) }; } catch (error) {
          if (isRegistryStatisticsUnavailable(error)) return { unavailable: error };
          throw error;
        }
      }, "memorySpaces:getStats");
      if (result.unavailable) throw result.unavailable;
      return result.stats as MemorySpaceStats;
    } catch (error) {
      if (isRegistryStatisticsUnavailable(error)) throw error;
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

    const tenantId = resolveDomainScope(this.authContext?.tenantId, undefined);

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.memorySpaces.findByParticipant, {
          tenantId,
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

    const tenantId = resolveDomainScope(this.authContext?.tenantId, undefined);

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.memorySpaces.search, {
          tenantId,
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

    const tenantId = resolveDomainScope(this.authContext?.tenantId, undefined);

    const result = await this.executeGraphWrite(
      () =>
        this.mutateGraph(api.memorySpaces.updateParticipants, {
          tenantId,
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
