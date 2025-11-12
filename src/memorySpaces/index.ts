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
      metadata?: any;
      status?: "active" | "archived";
    },
  ): Promise<MemorySpace> {
    const result = await this.client.mutation(api.memorySpaces.update, {
      memorySpaceId,
      name: updates.name,
      metadata: updates.metadata,
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
      metadata?: Record<string, any>;
    },
  ): Promise<MemorySpace> {
    const result = await this.client.mutation(api.memorySpaces.archive, {
      memorySpaceId,
      reason: options?.reason,
      metadata: options?.metadata,
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
    const result = await this.client.query(api.memorySpaces.findByParticipant, {
      participantId,
    });

    return result as MemorySpace[];
  }
}
