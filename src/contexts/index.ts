/**
 * Cortex SDK - Context Chains API
 *
 * Hierarchical workflow coordination for multi-agent tasks
 */

import { ConvexClient } from "convex/browser";
import { api } from "../../convex-dev/_generated/api";
import type { GraphAdapter } from "../graph/types";
import {
  syncContextToGraph,
  syncContextRelationships,
  deleteContextFromGraph,
} from "../graph";
import type {
  CreateContextOptions,
  UpdateContextOptions,
  DeleteContextOptions,
} from "../types";
import type { AuthContext } from "../auth/types";
import {
  validateRequiredString,
  validatePurpose,
  validateContextIdFormat,
  validateConversationIdFormat,
  validateStatus,
  validateExportFormat,
  validateDepth,
  validateLimit,
  validateVersion,
  validateTimestamp,
  validateDataObject,
  validateConversationRef,
  validateDateObject,
  validateUpdatesObject,
  validateHasFilters,
} from "./validators";

export interface ContextVersion {
  version: number;
  status: string;
  data?: Record<string, unknown>;
  timestamp: number;
  updatedBy?: string;
}

export interface Context {
  _id: string;
  contextId: string;
  memorySpaceId: string;
  tenantId?: string; // Multi-tenancy: SaaS platform isolation
  purpose: string;
  description?: string;
  userId?: string;
  parentId?: string;
  rootId?: string;
  depth: number;
  childIds: string[];
  status: "active" | "completed" | "cancelled" | "blocked";
  conversationRef?: {
    conversationId: string;
    messageIds?: string[];
  };
  participants: string[];
  grantedAccess?: Array<{
    memorySpaceId: string;
    scope: string;
    grantedAt: number;
  }>;
  data?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  version: number;
  previousVersions?: ContextVersion[];
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

export interface ContextChain {
  current: Context;
  parent?: Context;
  root: Context;
  children: Context[];
  siblings: Context[];
  ancestors: Context[];
  descendants: Context[];
  depth: number;
  totalNodes: number;
}

export interface ContextWithConversation extends ContextChain {
  conversation?: {
    _id: string;
    conversationId: string;
    messages: Array<{
      id: string;
      role: string;
      content: string;
      timestamp: number;
    }>;
  };
  triggerMessages?: Array<{
    id: string;
    role: string;
    content: string;
    timestamp: number;
  }>;
}

export interface CreateContextParams {
  purpose: string;
  memorySpaceId: string;
  description?: string;
  userId?: string;
  parentId?: string;
  conversationRef?: {
    conversationId: string;
    messageIds?: string[];
  };
  data?: Record<string, unknown>;
  status?: "active" | "completed" | "cancelled" | "blocked";
}

export interface UpdateContextParams {
  status?: "active" | "completed" | "cancelled" | "blocked";
  description?: string;
  data?: Record<string, unknown>;
  completedAt?: number;
}

export interface ListContextsFilter {
  memorySpaceId?: string;
  userId?: string;
  status?: "active" | "completed" | "cancelled" | "blocked";
  parentId?: string;
  rootId?: string;
  depth?: number;
  limit?: number;
}

export interface CountContextsFilter {
  memorySpaceId?: string;
  userId?: string;
  status?: "active" | "completed" | "cancelled" | "blocked";
}

import type { ResilienceLayer } from "../resilience";

export class ContextsAPI {
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
   * Handle ConvexError from direct Convex calls
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
   * Create a new context
   *
   * @example
   * ```typescript
   * const context = await cortex.contexts.create({
   *   purpose: 'Process customer refund',
   *   memorySpaceId: 'supervisor-space',
   *   userId: 'user-123',
   *   conversationRef: {
   *     conversationId: 'conv-456',
   *     messageIds: ['msg-089'],
   *   },
   * });
   * ```
   */
  async create(
    params: CreateContextParams,
    _options?: CreateContextOptions,
  ): Promise<Context> {
    // Client-side validation
    validatePurpose(params.purpose);
    validateRequiredString(params.memorySpaceId, "memorySpaceId");

    if (params.userId !== undefined) {
      validateRequiredString(params.userId, "userId");
    }

    if (params.parentId !== undefined) {
      validateContextIdFormat(params.parentId);
    }

    if (params.status !== undefined) {
      validateStatus(params.status);
    }

    if (params.conversationRef !== undefined) {
      validateConversationRef(params.conversationRef);
    }

    if (params.data !== undefined) {
      validateDataObject(params.data);
    }

    let result;
    try {
      result = await this.executeWithResilience(
        () =>
          this.client.mutation(api.contexts.create, {
            purpose: params.purpose,
            memorySpaceId: params.memorySpaceId,
            tenantId: this.authContext?.tenantId, // Multi-tenancy
            description: params.description,
            userId: params.userId,
            parentId: params.parentId,
            conversationRef: params.conversationRef,
            data: params.data,
            status: params.status,
          }),
        "contexts:create",
      );
    } catch (error) {
      this.handleConvexError(error);
    }

    // Sync to graph if requested
    if (this.graphAdapter) {
      try {
        const nodeId = await syncContextToGraph(
          result as Context,
          this.graphAdapter,
        );
        await syncContextRelationships(
          result as Context,
          nodeId,
          this.graphAdapter,
        );
      } catch (error) {
        console.warn("Failed to sync context to graph:", error);
      }
    }

    return result as Context;
  }

  /**
   * Get context by ID
   *
   * @example
   * ```typescript
   * const context = await cortex.contexts.get('ctx-123');
   *
   * // Get with full chain
   * const chain = await cortex.contexts.get('ctx-123', { includeChain: true });
   *
   * // Get with conversation context
   * const enriched = await cortex.contexts.get('ctx-123', {
   *   includeChain: true,
   *   includeConversation: true
   * });
   * ```
   */
  async get(
    contextId: string,
    options?: { includeChain?: boolean; includeConversation?: boolean },
  ): Promise<Context | ContextChain | ContextWithConversation | null> {
    // Client-side validation
    validateRequiredString(contextId, "contextId");
    validateContextIdFormat(contextId);

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.contexts.get, {
          contextId,
          tenantId: this.authContext?.tenantId, // Multi-tenancy
          includeChain: options?.includeChain,
          includeConversation: options?.includeConversation,
        }),
      "contexts:get",
    );

    return result as Context | ContextChain | ContextWithConversation | null;
  }

  /**
   * Update a context
   *
   * @example
   * ```typescript
   * await cortex.contexts.update('ctx-123', {
   *   status: 'completed',
   *   data: { result: 'success' },
   * });
   * ```
   */
  async update(
    contextId: string,
    updates: UpdateContextParams,
    _options?: UpdateContextOptions,
  ): Promise<Context> {
    // Client-side validation
    validateRequiredString(contextId, "contextId");
    validateContextIdFormat(contextId);

    if (updates.status !== undefined) {
      validateStatus(updates.status);
    }

    if (updates.data !== undefined) {
      validateDataObject(updates.data);
    }

    if (updates.completedAt !== undefined) {
      validateTimestamp(updates.completedAt, "completedAt");
    }

    const result = await this.executeWithResilience(
      () =>
        this.client.mutation(api.contexts.update, {
          contextId,
          tenantId: this.authContext?.tenantId, // Multi-tenancy
          status: updates.status,
          description: updates.description,
          data: updates.data,
          completedAt: updates.completedAt,
        }),
      "contexts:update",
    );

    // Update in graph if requested
    if (this.graphAdapter) {
      try {
        const nodes = await this.graphAdapter.findNodes(
          "Context",
          { contextId },
          1,
        );
        if (nodes.length > 0) {
          await this.graphAdapter.updateNode(
            nodes[0].id!,
            updates as unknown as Record<string, unknown>,
          );
        }
      } catch (error) {
        console.warn("Failed to update context in graph:", error);
      }
    }

    return result as Context;
  }

  /**
   * Delete a context
   *
   * @example
   * ```typescript
   * // Delete single context (must have no children)
   * await cortex.contexts.delete('ctx-123');
   *
   * // Delete context and all descendants
   * await cortex.contexts.delete('ctx-123', { cascadeChildren: true });
   *
   * // Allow orphaning (remove parent, keep children as new roots)
   * await cortex.contexts.delete('ctx-123', { orphanChildren: true });
   * ```
   */
  async delete(
    contextId: string,
    options?: DeleteContextOptions & {
      cascadeChildren?: boolean;
      orphanChildren?: boolean;
    },
  ): Promise<{
    deleted: boolean;
    contextId: string;
    descendantsDeleted: number;
    orphanedChildren?: string[];
  }> {
    // Client-side validation
    validateRequiredString(contextId, "contextId");
    validateContextIdFormat(contextId);

    let result;
    try {
      result = await this.executeWithResilience(
        () =>
          this.client.mutation(api.contexts.deleteContext, {
            contextId,
            tenantId: this.authContext?.tenantId, // Multi-tenancy
            cascadeChildren: options?.cascadeChildren,
            orphanChildren: options?.orphanChildren,
          }),
        "contexts:delete",
      );
    } catch (error) {
      this.handleConvexError(error);
    }

    // Delete from graph with orphan cleanup
    if (this.graphAdapter) {
      try {
        await deleteContextFromGraph(contextId, this.graphAdapter, true);
      } catch (error) {
        console.warn("Failed to delete context from graph:", error);
      }
    }

    return result as {
      deleted: boolean;
      contextId: string;
      descendantsDeleted: number;
      orphanedChildren?: string[];
    };
  }

  /**
   * List contexts
   *
   * @example
   * ```typescript
   * const contexts = await cortex.contexts.list({
   *   memorySpaceId: 'finance-space',
   *   status: 'active',
   * });
   * ```
   */
  async list(filter?: ListContextsFilter): Promise<Context[]> {
    // Client-side validation
    if (filter) {
      if (filter.memorySpaceId !== undefined) {
        validateRequiredString(filter.memorySpaceId, "memorySpaceId");
      }
      if (filter.userId !== undefined) {
        validateRequiredString(filter.userId, "userId");
      }
      if (filter.status !== undefined) {
        validateStatus(filter.status);
      }
      if (filter.parentId !== undefined) {
        validateContextIdFormat(filter.parentId);
      }
      if (filter.rootId !== undefined) {
        validateContextIdFormat(filter.rootId);
      }
      if (filter.depth !== undefined) {
        validateDepth(filter.depth);
      }
      if (filter.limit !== undefined) {
        validateLimit(filter.limit);
      }
    }

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.contexts.list, {
          memorySpaceId: filter?.memorySpaceId,
          tenantId: this.authContext?.tenantId, // Multi-tenancy
          userId: filter?.userId,
          status: filter?.status,
          parentId: filter?.parentId,
          rootId: filter?.rootId,
          depth: filter?.depth,
          limit: filter?.limit,
        }),
      "contexts:list",
    );

    return result as Context[];
  }

  /**
   * Count contexts
   *
   * @example
   * ```typescript
   * const count = await cortex.contexts.count({
   *   memorySpaceId: 'supervisor-space',
   *   status: 'active',
   * });
   * ```
   */
  async count(filter?: CountContextsFilter): Promise<number> {
    // Client-side validation
    if (filter) {
      if (filter.memorySpaceId !== undefined) {
        validateRequiredString(filter.memorySpaceId, "memorySpaceId");
      }
      if (filter.userId !== undefined) {
        validateRequiredString(filter.userId, "userId");
      }
      if (filter.status !== undefined) {
        validateStatus(filter.status);
      }
    }

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.contexts.count, {
          memorySpaceId: filter?.memorySpaceId,
          userId: filter?.userId,
          status: filter?.status,
        }),
      "contexts:count",
    );

    return result;
  }

  /**
   * Search contexts (alias for list with filters)
   *
   * @example
   * ```typescript
   * const contexts = await cortex.contexts.search({
   *   userId: 'user-123',
   *   status: 'active',
   * });
   * ```
   */
  async search(filter?: ListContextsFilter): Promise<Context[]> {
    return await this.list(filter);
  }

  /**
   * Get complete chain from any context
   *
   * @example
   * ```typescript
   * const chain = await cortex.contexts.getChain('ctx-child');
   * console.log(chain.root.purpose);
   * console.log(chain.children.length);
   * ```
   */
  async getChain(contextId: string): Promise<ContextChain> {
    // Client-side validation
    validateRequiredString(contextId, "contextId");
    validateContextIdFormat(contextId);

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.contexts.getChain, {
          contextId,
        }),
      "contexts:getChain",
    );

    return result as ContextChain;
  }

  /**
   * Get root context
   *
   * @example
   * ```typescript
   * const root = await cortex.contexts.getRoot('ctx-deeply-nested');
   * ```
   */
  async getRoot(contextId: string): Promise<Context> {
    // Client-side validation
    validateRequiredString(contextId, "contextId");
    validateContextIdFormat(contextId);

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.contexts.getRoot, {
          contextId,
        }),
      "contexts:getRoot",
    );

    return result as Context;
  }

  /**
   * Get children of a context
   *
   * @example
   * ```typescript
   * const children = await cortex.contexts.getChildren('ctx-root');
   *
   * // Get all descendants recursively
   * const all = await cortex.contexts.getChildren('ctx-root', { recursive: true });
   * ```
   */
  async getChildren(
    contextId: string,
    options?: {
      status?: "active" | "completed" | "cancelled" | "blocked";
      recursive?: boolean;
    },
  ): Promise<Context[]> {
    // Client-side validation
    validateRequiredString(contextId, "contextId");
    validateContextIdFormat(contextId);

    if (options?.status !== undefined) {
      validateStatus(options.status);
    }

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.contexts.getChildren, {
          contextId,
          status: options?.status,
          recursive: options?.recursive,
        }),
      "contexts:getChildren",
    );

    return result as Context[];
  }

  /**
   * Add participant to context
   *
   * @example
   * ```typescript
   * await cortex.contexts.addParticipant('ctx-123', 'legal-agent-space');
   * ```
   */
  async addParticipant(
    contextId: string,
    participantId: string,
  ): Promise<Context> {
    // Client-side validation
    validateRequiredString(contextId, "contextId");
    validateContextIdFormat(contextId);
    validateRequiredString(participantId, "participantId");

    const result = await this.executeWithResilience(
      () =>
        this.client.mutation(api.contexts.addParticipant, {
          contextId,
          participantId,
        }),
      "contexts:addParticipant",
    );

    return result as Context;
  }

  /**
   * Grant cross-space access to a context (Collaboration Mode)
   *
   * @example
   * ```typescript
   * await cortex.contexts.grantAccess('ctx-123', 'partner-space', 'read-only');
   * ```
   */
  async grantAccess(
    contextId: string,
    targetMemorySpaceId: string,
    scope: string,
  ): Promise<Context> {
    // Client-side validation
    validateRequiredString(contextId, "contextId");
    validateContextIdFormat(contextId);
    validateRequiredString(targetMemorySpaceId, "targetMemorySpaceId");
    validateRequiredString(scope, "scope");

    const result = await this.executeWithResilience(
      () =>
        this.client.mutation(api.contexts.grantAccess, {
          contextId,
          targetMemorySpaceId,
          scope,
        }),
      "contexts:grantAccess",
    );

    return result as Context;
  }

  /**
   * Update many contexts matching filters
   *
   * @example
   * ```typescript
   * await cortex.contexts.updateMany(
   *   { status: 'completed', completedBefore: Date.now() - 30*24*60*60*1000 },
   *   { data: { archived: true } }
   * );
   * ```
   */
  async updateMany(
    filters: {
      memorySpaceId?: string;
      userId?: string;
      status?: "active" | "completed" | "cancelled" | "blocked";
      parentId?: string;
      rootId?: string;
    },
    updates: {
      status?: "active" | "completed" | "cancelled" | "blocked";
      data?: Record<string, unknown>;
    },
  ): Promise<{ updated: number; contextIds: string[] }> {
    // Client-side validation
    validateHasFilters(filters);
    validateUpdatesObject(updates);

    if (filters.memorySpaceId !== undefined) {
      validateRequiredString(filters.memorySpaceId, "memorySpaceId");
    }

    if (filters.userId !== undefined) {
      validateRequiredString(filters.userId, "userId");
    }

    if (filters.status !== undefined) {
      validateStatus(filters.status);
    }

    if (filters.parentId !== undefined) {
      validateContextIdFormat(filters.parentId);
    }

    if (filters.rootId !== undefined) {
      validateContextIdFormat(filters.rootId);
    }

    if (updates.status !== undefined) {
      validateStatus(updates.status);
    }

    if (updates.data !== undefined) {
      validateDataObject(updates.data);
    }

    const result = await this.executeWithResilience(
      () =>
        this.client.mutation(api.contexts.updateMany, {
          memorySpaceId: filters.memorySpaceId,
          userId: filters.userId,
          status: filters.status,
          parentId: filters.parentId,
          rootId: filters.rootId,
          updates,
        }),
      "contexts:updateMany",
    );

    return result as { updated: number; contextIds: string[] };
  }

  /**
   * Delete many contexts matching filters
   *
   * @example
   * ```typescript
   * await cortex.contexts.deleteMany({
   *   status: 'cancelled',
   *   completedBefore: Date.now() - 90*24*60*60*1000
   * }, { cascadeChildren: true });
   * ```
   */
  async deleteMany(
    filters: {
      memorySpaceId?: string;
      userId?: string;
      status?: "active" | "completed" | "cancelled" | "blocked";
      completedBefore?: number;
    },
    options?: { cascadeChildren?: boolean },
  ): Promise<{ deleted: number; contextIds: string[] }> {
    // Client-side validation
    validateHasFilters(filters);

    if (filters.memorySpaceId !== undefined) {
      validateRequiredString(filters.memorySpaceId, "memorySpaceId");
    }

    if (filters.userId !== undefined) {
      validateRequiredString(filters.userId, "userId");
    }

    if (filters.status !== undefined) {
      validateStatus(filters.status);
    }

    if (filters.completedBefore !== undefined) {
      validateTimestamp(filters.completedBefore, "completedBefore");
    }

    const result = await this.executeWithResilience(
      () =>
        this.client.mutation(api.contexts.deleteMany, {
          memorySpaceId: filters.memorySpaceId,
          userId: filters.userId,
          status: filters.status,
          completedBefore: filters.completedBefore,
          cascadeChildren: options?.cascadeChildren,
        }),
      "contexts:deleteMany",
    );

    return result as { deleted: number; contextIds: string[] };
  }

  /**
   * Export contexts to JSON or CSV
   *
   * @example
   * ```typescript
   * const exported = await cortex.contexts.export(
   *   { userId: 'user-123' },
   *   { format: 'json', includeChain: true, includeVersionHistory: true }
   * );
   * ```
   */
  async export(
    filters?: {
      memorySpaceId?: string;
      userId?: string;
      status?: "active" | "completed" | "cancelled" | "blocked";
    },
    options?: {
      format: "json" | "csv";
      includeChain?: boolean;
      includeVersionHistory?: boolean;
    },
  ): Promise<{
    format: string;
    data: string;
    count: number;
    exportedAt: number;
  }> {
    // Client-side validation
    if (options?.format) {
      validateExportFormat(options.format);
    }

    if (filters) {
      if (filters.memorySpaceId !== undefined) {
        validateRequiredString(filters.memorySpaceId, "memorySpaceId");
      }

      if (filters.userId !== undefined) {
        validateRequiredString(filters.userId, "userId");
      }

      if (filters.status !== undefined) {
        validateStatus(filters.status);
      }
    }

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.contexts.exportContexts, {
          memorySpaceId: filters?.memorySpaceId,
          userId: filters?.userId,
          status: filters?.status,
          format: options?.format || "json",
          includeChain: options?.includeChain,
          includeVersionHistory: options?.includeVersionHistory,
        }),
      "contexts:export",
    );

    return result as {
      format: string;
      data: string;
      count: number;
      exportedAt: number;
    };
  }

  /**
   * Remove participant from context
   *
   * @example
   * ```typescript
   * await cortex.contexts.removeParticipant('ctx-123', 'old-agent-space');
   * ```
   */
  async removeParticipant(
    contextId: string,
    participantId: string,
  ): Promise<Context> {
    // Client-side validation
    validateRequiredString(contextId, "contextId");
    validateContextIdFormat(contextId);
    validateRequiredString(participantId, "participantId");

    const result = await this.executeWithResilience(
      () =>
        this.client.mutation(api.contexts.removeParticipant, {
          contextId,
          participantId,
        }),
      "contexts:removeParticipant",
    );

    return result as Context;
  }

  /**
   * Get all contexts originating from a specific conversation
   *
   * @example
   * ```typescript
   * const contexts = await cortex.contexts.getByConversation('conv-456');
   * ```
   */
  async getByConversation(conversationId: string): Promise<Context[]> {
    // Client-side validation
    validateRequiredString(conversationId, "conversationId");
    validateConversationIdFormat(conversationId);

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.contexts.getByConversation, {
          conversationId,
        }),
      "contexts:getByConversation",
    );

    return result as Context[];
  }

  /**
   * Find contexts whose parent no longer exists
   *
   * @example
   * ```typescript
   * const orphaned = await cortex.contexts.findOrphaned();
   * console.log(`Found ${orphaned.length} orphaned contexts`);
   * ```
   */
  async findOrphaned(): Promise<Context[]> {
    const result = await this.executeWithResilience(
      () => this.client.query(api.contexts.findOrphaned, {}),
      "contexts:findOrphaned",
    );

    return result as Context[];
  }

  /**
   * Get specific version of a context
   *
   * @example
   * ```typescript
   * const v1 = await cortex.contexts.getVersion('ctx-123', 1);
   * ```
   */
  async getVersion(
    contextId: string,
    version: number,
  ): Promise<{
    version: number;
    status: string;
    data?: Record<string, unknown>;
    timestamp: number;
    updatedBy?: string;
  } | null> {
    // Client-side validation
    validateRequiredString(contextId, "contextId");
    validateContextIdFormat(contextId);
    validateVersion(version);

    return (await this.executeWithResilience(
      () =>
        this.client.query(api.contexts.getVersion, {
          contextId,
          version,
        }),
      "contexts:getVersion",
    )) as {
      version: number;
      status: string;
      data?: Record<string, unknown>;
      timestamp: number;
      updatedBy?: string;
    } | null;
  }

  /**
   * Get all versions of a context
   *
   * @example
   * ```typescript
   * const history = await cortex.contexts.getHistory('ctx-123');
   * console.log(`Context has ${history.length} versions`);
   * ```
   */
  async getHistory(contextId: string): Promise<
    Array<{
      version: number;
      status: string;
      data?: Record<string, unknown>;
      timestamp: number;
      updatedBy?: string;
    }>
  > {
    // Client-side validation
    validateRequiredString(contextId, "contextId");
    validateContextIdFormat(contextId);

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.contexts.getHistory, {
          contextId,
        }),
      "contexts:getHistory",
    );

    return result as Array<{
      version: number;
      status: string;
      data?: Record<string, unknown>;
      timestamp: number;
      updatedBy?: string;
    }>;
  }

  /**
   * Get context state at specific point in time
   *
   * @example
   * ```typescript
   * const historical = await cortex.contexts.getAtTimestamp(
   *   'ctx-123',
   *   new Date('2025-10-20')
   * );
   * ```
   */
  async getAtTimestamp(
    contextId: string,
    timestamp: Date,
  ): Promise<{
    version: number;
    status: string;
    data?: Record<string, unknown>;
    timestamp: number;
    updatedBy?: string;
  } | null> {
    // Client-side validation
    validateRequiredString(contextId, "contextId");
    validateContextIdFormat(contextId);
    validateDateObject(timestamp, "timestamp");

    return (await this.executeWithResilience(
      () =>
        this.client.query(api.contexts.getAtTimestamp, {
          contextId,
          timestamp: timestamp.getTime(),
        }),
      "contexts:getAtTimestamp",
    )) as {
      version: number;
      status: string;
      data?: Record<string, unknown>;
      timestamp: number;
      updatedBy?: string;
    } | null;
  }
}

// Export validation error for users who want to catch it specifically
export { ContextsValidationError } from "./validators";
