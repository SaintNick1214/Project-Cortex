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
} from "./validators";

export class MemorySpacesAPI {
  constructor(
    private client: ConvexClient,
    private graphAdapter?: GraphAdapter,
  ) {}

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

    const result = await this.client.mutation(api.memorySpaces.register, {
      memorySpaceId: params.memorySpaceId,
      name: params.name,
      type: params.type,
      participants,
      metadata: params.metadata,
    });

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

    const result = await this.client.query(api.memorySpaces.get, {
      memorySpaceId,
    });

    return result as MemorySpace | null;
  }

  /**
   * List memory spaces
   *
   * @example
   * ```typescript
   * const teams = await cortex.memorySpaces.list({
   *   type: 'team',
   *   status: 'active',
   * });
   * ```
   */
  async list(filter?: {
    type?: "personal" | "team" | "project" | "custom";
    status?: "active" | "archived";
    limit?: number;
  }): Promise<MemorySpace[]> {
    if (filter?.type) {
      validateMemorySpaceType(filter.type);
    }
    if (filter?.status) {
      validateMemorySpaceStatus(filter.status);
    }
    if (filter?.limit !== undefined) {
      validateLimit(filter.limit, 1000);
    }

    const result = await this.client.query(api.memorySpaces.list, {
      type: filter?.type,
      status: filter?.status,
      limit: filter?.limit,
    });

    return result as MemorySpace[];
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

    const result = await this.client.query(api.memorySpaces.count, {
      type: filter?.type,
      status: filter?.status,
    });

    return result;
  }

  /**
   * Update memory space
   *
   * @example
   * ```typescript
   * await cortex.memorySpaces.update('team-alpha', {
   *   name: 'Updated Name',
   *   status: 'archived',
   * });
   * ```
   */
  async update(
    memorySpaceId: string,
    updates: {
      name?: string;
      metadata?: Record<string, unknown>;
      status?: "active" | "archived";
    },
  ): Promise<MemorySpace> {
    validateMemorySpaceId(memorySpaceId);
    validateUpdateParams(updates);

    if (updates.name !== undefined) {
      validateName(updates.name);
    }
    if (updates.status !== undefined) {
      validateMemorySpaceStatus(updates.status);
    }

    const result = await this.client.mutation(api.memorySpaces.update, {
      memorySpaceId,
      name: updates.name,
      metadata: updates.metadata as Record<string, unknown> | undefined,
      status: updates.status,
    });

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

    const result = await this.client.mutation(api.memorySpaces.addParticipant, {
      memorySpaceId,
      participant,
    });

    return result as MemorySpace;
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

    const result = await this.client.mutation(
      api.memorySpaces.removeParticipant,
      {
        memorySpaceId,
        participantId,
      },
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

    const result = await this.client.mutation(api.memorySpaces.archive, {
      memorySpaceId,
      reason: options?.reason,
      metadata: options?.metadata as Record<string, unknown> | undefined,
    });

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

    const result = await this.client.mutation(api.memorySpaces.reactivate, {
      memorySpaceId,
    });

    return result as MemorySpace;
  }

  /**
   * Delete memory space
   *
   * @example
   * ```typescript
   * await cortex.memorySpaces.delete('team-alpha', { cascade: true });
   * ```
   */
  async delete(
    memorySpaceId: string,
    options?: { cascade?: boolean },
  ): Promise<{
    deleted: boolean;
    memorySpaceId: string;
    cascaded: boolean;
  }> {
    validateMemorySpaceId(memorySpaceId);

    const result = await this.client.mutation(api.memorySpaces.deleteSpace, {
      memorySpaceId,
      cascade: options?.cascade || false,
    });

    return result as {
      deleted: boolean;
      memorySpaceId: string;
      cascaded: boolean;
    };
  }

  /**
   * Get memory space statistics
   *
   * @example
   * ```typescript
   * const stats = await cortex.memorySpaces.getStats('team-alpha');
   * console.log(`${stats.conversationCount} conversations, ${stats.memoryCount} memories`);
   * ```
   */
  async getStats(memorySpaceId: string): Promise<MemorySpaceStats> {
    validateMemorySpaceId(memorySpaceId);

    const result = await this.client.query(api.memorySpaces.getStats, {
      memorySpaceId,
    });

    return result as MemorySpaceStats;
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

    const result = await this.client.query(api.memorySpaces.findByParticipant, {
      participantId,
    });

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

    const result = await this.client.query(api.memorySpaces.search, {
      query,
      type: options?.type,
      status: options?.status,
      limit: options?.limit,
    });

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

    const result = await this.client.mutation(
      api.memorySpaces.updateParticipants,
      {
        memorySpaceId,
        add: updates.add,
        remove: updates.remove,
      },
    );

    return result as MemorySpace;
  }
}

// Export validation error for users who want to catch it specifically
export { MemorySpaceValidationError } from "./validators";
