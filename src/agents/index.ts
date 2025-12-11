/**
 * Cortex SDK - Agents API
 *
 * Coordination Layer: Optional agent metadata registry with cascade deletion
 *
 * Key Principle: Agents work without registration (just use string IDs).
 * Registration provides discovery, analytics, and convenient cascade deletion.
 */

import type { ConvexClient } from "convex/browser";
import { api } from "../../convex-dev/_generated/api";
import type {
  AgentRegistration,
  RegisteredAgent,
  AgentStats,
  AgentFilters,
  UnregisterAgentOptions,
  UnregisterAgentResult,
  AgentDeletionPlan,
  AgentDeletionBackup,
  VerificationResult,
  Conversation,
  MemoryEntry,
  FactRecord,
  ExportAgentsOptions,
  ExportAgentsResult,
} from "../types";
import {
  AgentValidationError,
  validateAgentId,
  validateAgentRegistration,
  validateAgentFilters,
  validateUnregisterOptions,
  validateMetadata,
  validateConfig,
  validateUpdatePayload,
  validateExportOptions,
} from "./validators";

// Type for Convex agent query results
interface ConvexAgentRecord {
  agentId: string;
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
  config?: Record<string, unknown>;
  status: string;
  registeredAt: number;
  updatedAt: number;
  lastActive?: number;
}

// Type for Neo4j record results
interface Neo4jNodeRecord {
  id: string;
  labels: string[];
}

// Type for Neo4j count results
interface Neo4jCountRecord {
  count: number;
}
import type { GraphAdapter } from "../graph/types";
import {
  deleteWithOrphanCleanup,
  createDeletionContext,
  ORPHAN_RULES,
} from "../graph/sync/orphanDetection";

/**
 * Custom error for cascade deletion failures
 */
export class AgentCascadeDeletionError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AgentCascadeDeletionError";
  }
}

/**
 * Agents API
 *
 * Provides optional metadata registration for agents. Agents work without
 * registration - this is purely for discovery, analytics, and convenient
 * cascade deletion.
 *
 * Key Difference from Users API:
 * - Users: Cascade by userId (GDPR compliance, required)
 * - Agents: Cascade by participantId (convenience, optional)
 */
import type { ResilienceLayer } from "../resilience";

export class AgentsAPI {
  constructor(
    private readonly client: ConvexClient,
    private readonly graphAdapter?: GraphAdapter,
    private readonly resilience?: ResilienceLayer,
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

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Registry Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Register an agent in the registry
   *
   * @example
   * ```typescript
   * const agent = await cortex.agents.register({
   *   id: 'support-agent',
   *   name: 'Customer Support Bot',
   *   description: 'Handles customer inquiries',
   *   metadata: {
   *     team: 'support',
   *     capabilities: ['troubleshooting', 'empathy']
   *   }
   * });
   * ```
   */
  async register(agent: AgentRegistration): Promise<RegisteredAgent> {
    // Validate agent registration
    validateAgentRegistration(agent);
    if (agent.metadata) validateMetadata(agent.metadata);
    if (agent.config) validateConfig(agent.config);

    let result;
    try {
      result = await this.executeWithResilience(
        () =>
          this.client.mutation(api.agents.register, {
            agentId: agent.id,
            name: agent.name,
            description: agent.description,
            metadata: agent.metadata,
            config: agent.config,
          }),
        "agents:register",
      );
    } catch (error) {
      this.handleConvexError(error);
    }

    if (!result) {
      throw new Error(`Failed to register agent ${agent.id}`);
    }

    // Sync to graph if configured
    if (this.graphAdapter) {
      try {
        await this.graphAdapter.createNode({
          label: "Agent",
          properties: {
            agentId: result.agentId,
            name: result.name,
            description: result.description || null,
            status: result.status,
            registeredAt: result.registeredAt,
            updatedAt: result.updatedAt,
            lastActive: result.lastActive || null,
          },
        });
      } catch (error) {
        console.warn("Failed to sync agent to graph:", error);
        // Don't fail the operation - graph sync is non-critical
      }
    }

    // Compute stats
    const stats = await this.getAgentStats(agent.id);

    return {
      id: result.agentId,
      name: result.name,
      description: result.description,
      metadata: (result.metadata as Record<string, unknown> | undefined) ?? {},
      config: (result.config as Record<string, unknown> | undefined) ?? {},
      status: result.status,
      registeredAt: result.registeredAt,
      updatedAt: result.updatedAt,
      lastActive: result.lastActive,
      stats,
    };
  }

  /**
   * Get agent registration by ID
   *
   * @example
   * ```typescript
   * const agent = await cortex.agents.get('support-agent');
   * if (agent) {
   *   console.log(agent.name, agent.metadata.team);
   * }
   * ```
   */
  async get(agentId: string): Promise<RegisteredAgent | null> {
    // Validate agentId
    validateAgentId(agentId, "agentId");

    const result = await this.executeWithResilience(
      () => this.client.query(api.agents.get, { agentId }),
      "agents:get",
    );

    if (!result) {
      return null;
    }

    // Compute stats
    const stats = await this.getAgentStats(agentId);

    return {
      id: result.agentId,
      name: result.name,
      description: result.description,
      metadata: (result.metadata as Record<string, unknown> | undefined) ?? {},
      config: (result.config as Record<string, unknown> | undefined) ?? {},
      status: result.status,
      registeredAt: result.registeredAt,
      updatedAt: result.updatedAt,
      lastActive: result.lastActive,
      stats,
    };
  }

  /**
   * List agents with filters
   *
   * @example
   * ```typescript
   * const agents = await cortex.agents.list({ limit: 50 });
   * ```
   */
  async list(filters?: AgentFilters): Promise<RegisteredAgent[]> {
    // Validate filters
    if (filters) {
      validateAgentFilters(filters);
    }

    const results = await this.executeWithResilience(
      () =>
        this.client.query(api.agents.list, {
          status: filters?.status,
          limit: filters?.limit,
          offset: filters?.offset,
        }),
      "agents:list",
    );

    // Client-side filtering for metadata, name, capabilities
    let filtered = results;

    if (filters?.metadata) {
      filtered = filtered.filter((agent: ConvexAgentRecord) => {
        return Object.entries(filters.metadata!).every(
          ([key, value]) => agent.metadata?.[key] === value,
        );
      });
    }

    if (filters?.name) {
      filtered = filtered.filter((agent: ConvexAgentRecord) =>
        agent.name.toLowerCase().includes(filters.name!.toLowerCase()),
      );
    }

    if (filters?.capabilities && filters.capabilities.length > 0) {
      filtered = filtered.filter((agent: ConvexAgentRecord) => {
        const agentCaps = Array.isArray(agent.metadata?.capabilities)
          ? (agent.metadata.capabilities as string[])
          : [];
        // Support capabilitiesMatch: "any" (default) or "all"
        const matchMode = filters.capabilitiesMatch ?? "any";
        if (matchMode === "all") {
          return filters.capabilities!.every((cap) => agentCaps.includes(cap));
        }
        return filters.capabilities!.some((cap) => agentCaps.includes(cap));
      });
    }

    // Filter by lastActive timestamp range
    if (filters?.lastActiveAfter !== undefined) {
      filtered = filtered.filter(
        (agent: ConvexAgentRecord) =>
          agent.lastActive !== undefined &&
          agent.lastActive >= filters.lastActiveAfter!,
      );
    }

    if (filters?.lastActiveBefore !== undefined) {
      filtered = filtered.filter(
        (agent: ConvexAgentRecord) =>
          agent.lastActive !== undefined &&
          agent.lastActive <= filters.lastActiveBefore!,
      );
    }

    // Map to RegisteredAgent format (stats computed on-demand in get())
    return filtered.map((r: ConvexAgentRecord) => ({
      id: r.agentId,
      name: r.name,
      description: r.description,
      metadata: r.metadata ?? {},
      config: r.config ?? {},
      status: r.status as "active" | "inactive" | "archived",
      registeredAt: r.registeredAt,
      updatedAt: r.updatedAt,
      lastActive: r.lastActive,
    })) as RegisteredAgent[];
  }

  /**
   * Search agents (alias for list with filters)
   *
   * @example
   * ```typescript
   * const supportAgents = await cortex.agents.search({
   *   metadata: { team: 'support' }
   * });
   * ```
   */
  async search(filters: AgentFilters): Promise<RegisteredAgent[]> {
    return this.list(filters);
  }

  /**
   * Count registered agents
   *
   * @example
   * ```typescript
   * const total = await cortex.agents.count();
   * console.log(`Total agents: ${total}`);
   * ```
   */
  async count(filters?: AgentFilters): Promise<number> {
    // Validate filters
    if (filters) {
      validateAgentFilters(filters);
    }

    return await this.executeWithResilience(
      () =>
        this.client.query(api.agents.count, {
          status: filters?.status,
        }),
      "agents:count",
    );
  }

  /**
   * Update agent registration
   *
   * @example
   * ```typescript
   * await cortex.agents.update('support-agent', {
   *   metadata: { team: 'customer-success' }
   * });
   * ```
   */
  async update(
    agentId: string,
    updates: Partial<AgentRegistration> & { status?: string },
  ): Promise<RegisteredAgent> {
    // Validate update payload
    validateUpdatePayload(agentId, updates);

    const result = await this.executeWithResilience(
      () =>
        this.client.mutation(api.agents.update, {
          agentId,
          name: updates.name,
          description: updates.description,
          metadata: updates.metadata,
          config: updates.config,
          status: (updates as { status?: "active" | "inactive" | "archived" })
            .status,
        }),
      "agents:update",
    );

    if (!result) {
      throw new Error(`Failed to update agent ${agentId}`);
    }

    // Compute stats
    const stats = await this.getAgentStats(agentId);

    return {
      id: result.agentId,
      name: result.name,
      description: result.description,
      metadata: (result.metadata as Record<string, unknown> | undefined) ?? {},
      config: (result.config as Record<string, unknown> | undefined) ?? {},
      status: result.status,
      registeredAt: result.registeredAt,
      updatedAt: result.updatedAt,
      lastActive: result.lastActive,
      stats,
    };
  }

  /**
   * Configure agent settings
   *
   * @example
   * ```typescript
   * await cortex.agents.configure('audit-agent', {
   *   memoryVersionRetention: -1  // Unlimited
   * });
   * ```
   */
  async configure(
    agentId: string,
    config: Record<string, unknown>,
  ): Promise<void> {
    // Validate agentId and config
    validateAgentId(agentId, "agentId");
    validateConfig(config, "config");
    if (Object.keys(config).length === 0) {
      throw new AgentValidationError(
        "config cannot be empty",
        "EMPTY_CONFIG_OBJECT",
        "config",
      );
    }

    await this.executeWithResilience(
      () =>
        this.client.mutation(api.agents.update, {
          agentId,
          config,
        }),
      "agents:configure",
    );
  }

  /**
   * Check if agent is registered
   *
   * @example
   * ```typescript
   * if (await cortex.agents.exists('my-agent')) {
   *   console.log('Agent is registered');
   * }
   * ```
   */
  async exists(agentId: string): Promise<boolean> {
    // Validate agentId
    validateAgentId(agentId, "agentId");

    return await this.executeWithResilience(
      () => this.client.query(api.agents.exists, { agentId }),
      "agents:exists",
    );
  }

  /**
   * Unregister agent with optional cascade deletion by participantId
   *
   * @param agentId - Agent ID to unregister
   * @param options - Unregistration options
   * @param options.cascade - Delete all data where participantId = agentId (default: false)
   * @param options.verify - Verify deletion completeness (default: true)
   * @param options.dryRun - Preview what would be deleted (default: false)
   *
   * @example
   * ```typescript
   * // Simple unregister (keep data)
   * await cortex.agents.unregister('old-agent');
   *
   * // Cascade delete all agent data
   * const result = await cortex.agents.unregister('old-agent', {
   *   cascade: true
   * });
   * console.log(`Deleted ${result.totalDeleted} records from ${result.memorySpacesAffected.length} spaces`);
   * ```
   */
  async unregister(
    agentId: string,
    options?: UnregisterAgentOptions,
  ): Promise<UnregisterAgentResult> {
    // Validate agentId and options
    validateAgentId(agentId, "agentId");
    if (options) {
      validateUnregisterOptions(options);
    }

    const cascade = options?.cascade ?? false;
    const verify = options?.verify ?? true;
    const dryRun = options?.dryRun ?? false;

    if (!cascade) {
      // Simple unregister: just remove registration
      if (!dryRun) {
        await this.executeWithResilience(
          () => this.client.mutation(api.agents.unregister, { agentId }),
          "agents:unregister",
        );
      }

      return {
        agentId,
        unregisteredAt: Date.now(),
        conversationsDeleted: 0,
        conversationMessagesDeleted: 0,
        memoriesDeleted: 0,
        factsDeleted: 0,
        graphNodesDeleted: 0,
        verification: {
          complete: true,
          issues: [],
        },
        totalDeleted: dryRun ? 0 : 1,
        deletedLayers: dryRun ? [] : ["agent-registration"],
        memorySpacesAffected: [],
      };
    }

    // PHASE 1: Collect all records where participantId = agentId
    const deletionPlan = await this.collectAgentDeletionTargets(agentId);

    // Calculate totals
    const totals = this.calculateDeletionTotals(deletionPlan);

    if (dryRun) {
      return {
        agentId,
        unregisteredAt: Date.now(),
        ...totals,
        verification: {
          complete: true,
          issues: [
            `DRY RUN: Would delete ${totals.totalDeleted} total records across ${deletionPlan.memorySpaces.length} spaces`,
          ],
        },
        deletedLayers: this.getAffectedLayers(deletionPlan),
        memorySpacesAffected: deletionPlan.memorySpaces,
      };
    }

    // PHASE 2: Backup records for rollback
    const backups = await this.backupRecords(deletionPlan);

    // PHASE 3: Execute cascade deletion with rollback on failure
    try {
      const result = await this.executeAgentCascadeDeletion(
        agentId,
        deletionPlan,
      );

      // PHASE 4: Verify deletion (if requested)
      if (verify) {
        const verification = await this.verifyAgentDeletion(agentId);
        result.verification = verification;
      }

      return result;
    } catch (error) {
      // ROLLBACK: Restore backed up records
      await this.rollbackAgentDeletion(backups);
      throw new AgentCascadeDeletionError(
        `Cascade deletion failed for agent ${agentId}, rolled back all changes`,
        error,
      );
    }
  }

  /**
   * Unregister multiple agents matching filters
   *
   * @param filters - Filter criteria for agents to unregister
   * @param options - Unregistration options
   * @returns Unregistration result
   *
   * @example
   * ```typescript
   * // Unregister experimental agents (keep data)
   * const result = await cortex.agents.unregisterMany(
   *   { metadata: { environment: 'experimental' } },
   *   { cascade: false }
   * );
   * console.log(`Unregistered ${result.deleted} agents`);
   *
   * // Unregister and cascade delete all data
   * const result = await cortex.agents.unregisterMany(
   *   { status: 'archived' },
   *   { cascade: true }
   * );
   * ```
   */
  async unregisterMany(
    filters: AgentFilters,
    options?: UnregisterAgentOptions,
  ): Promise<{
    deleted: number;
    agentIds: string[];
    totalDataDeleted?: number;
  }> {
    // Validate filters and options
    validateAgentFilters(filters);
    if (options) {
      validateUnregisterOptions(options);
    }

    // Get all matching agents
    const agents = await this.list(filters);

    if (agents.length === 0) {
      return {
        deleted: 0,
        agentIds: [],
        totalDataDeleted: 0,
      };
    }

    if (options?.dryRun) {
      return {
        deleted: 0,
        agentIds: agents.map((a) => a.id),
      };
    }

    const results: string[] = [];
    let totalDataDeleted = 0;

    if (options?.cascade) {
      // Unregister each agent with cascade
      for (const agent of agents) {
        try {
          const result = await this.unregister(agent.id, options);
          results.push(agent.id);
          totalDataDeleted += result.totalDeleted;
        } catch (error) {
          console.error(`Failed to unregister agent ${agent.id}:`, error);
          // Continue with other agents
        }
      }
    } else {
      // Just remove registrations (use backend unregisterMany)
      const agentIds = agents.map((a) => a.id);
      const result = await this.executeWithResilience(
        () =>
          this.client.mutation(api.agents.unregisterMany, {
            agentIds,
          }),
        "agents:unregisterMany",
      );

      return {
        deleted: result.deleted,
        agentIds: result.agentIds,
      };
    }

    return {
      deleted: results.length,
      agentIds: results,
      totalDataDeleted,
    };
  }

  /**
   * Update multiple agents matching filters
   *
   * @param filters - Filter criteria for agents to update
   * @param updates - Fields to update on matching agents
   * @returns Update result with count and agent IDs
   *
   * @example
   * ```typescript
   * // Update all agents in a team
   * const result = await cortex.agents.updateMany(
   *   { metadata: { team: 'support' } },
   *   { metadata: { trainingCompleted: true } }
   * );
   * console.log(`Updated ${result.updated} agents`);
   *
   * // Upgrade all agents to new version
   * await cortex.agents.updateMany(
   *   { metadata: { version: '2.0.0' } },
   *   { metadata: { version: '2.1.0' } }
   * );
   * ```
   */
  async updateMany(
    filters: AgentFilters,
    updates: Partial<AgentRegistration>,
  ): Promise<{ updated: number; agentIds: string[] }> {
    // Validate filters and updates
    validateAgentFilters(filters);
    if (updates.metadata) validateMetadata(updates.metadata);
    if (updates.config) validateConfig(updates.config);

    // Check that at least one update field is provided
    const hasUpdates =
      updates.name !== undefined ||
      updates.description !== undefined ||
      updates.metadata !== undefined ||
      updates.config !== undefined;

    if (!hasUpdates) {
      throw new AgentValidationError(
        "At least one field must be provided for update (name, description, metadata, or config)",
        "MISSING_UPDATES",
      );
    }

    // Get all matching agents
    const agents = await this.list(filters);

    if (agents.length === 0) {
      return {
        updated: 0,
        agentIds: [],
      };
    }

    // Extract agent IDs and call backend
    const agentIds = agents.map((a) => a.id);

    const result = await this.executeWithResilience(
      () =>
        this.client.mutation(api.agents.updateMany, {
          agentIds,
          name: updates.name,
          description: updates.description,
          metadata: updates.metadata,
          config: updates.config,
        }),
      "agents:updateMany",
    );

    return {
      updated: result.updated,
      agentIds: result.agentIds,
    };
  }

  /**
   * Export registered agents matching filters
   *
   * @param options - Export options including format and filters
   * @returns Export result with data string
   *
   * @example
   * ```typescript
   * // Export all agents as JSON
   * const result = await cortex.agents.export({
   *   format: "json",
   *   includeStats: true,
   * });
   * fs.writeFileSync("agents.json", result.data);
   *
   * // Export support team as CSV
   * const csv = await cortex.agents.export({
   *   filters: { metadata: { team: "support" } },
   *   format: "csv",
   * });
   * ```
   */
  async export(options: ExportAgentsOptions): Promise<ExportAgentsResult> {
    // Validate options
    validateExportOptions(options);

    // Use list() for client-side filtering (metadata, capabilities, name)
    // then format the results
    const agents = await this.list(options.filters);

    const includeMetadata = options.includeMetadata !== false;
    const includeStats = options.includeStats ?? false;

    // Optionally include stats for each agent
    let exportData: Array<Record<string, unknown>> = agents as unknown as Array<
      Record<string, unknown>
    >;
    if (includeStats) {
      exportData = await Promise.all(
        agents.map(async (agent) => {
          const stats = await this.getAgentStats(agent.id);
          return { ...agent, stats } as Record<string, unknown>;
        }),
      );
    }

    if (options.format === "csv") {
      // Build CSV headers
      const headers = [
        "id",
        "name",
        "description",
        "status",
        "registeredAt",
        "updatedAt",
        "lastActive",
      ];
      if (includeMetadata) {
        headers.push("metadata", "config");
      }
      if (includeStats) {
        headers.push(
          "totalMemories",
          "totalConversations",
          "totalFacts",
          "memorySpacesActive",
        );
      }

      // Build CSV rows
      const rows = exportData.map((a) => {
        const row = [
          this.escapeCsvField(String(a.id)),
          this.escapeCsvField(String(a.name)),
          this.escapeCsvField(String(a.description || "")),
          this.escapeCsvField(String(a.status)),
          new Date(a.registeredAt as number).toISOString(),
          new Date(a.updatedAt as number).toISOString(),
          a.lastActive
            ? new Date(a.lastActive as number).toISOString()
            : "",
        ];

        if (includeMetadata) {
          row.push(
            this.escapeCsvField(JSON.stringify(a.metadata)),
            this.escapeCsvField(JSON.stringify(a.config)),
          );
        }

        if (includeStats && a.stats) {
          const stats = a.stats as AgentStats;
          row.push(
            String(stats.totalMemories),
            String(stats.totalConversations),
            String(stats.totalFacts),
            String(stats.memorySpacesActive),
          );
        }

        return row.join(",");
      });

      return {
        format: "csv",
        data: [headers.join(","), ...rows].join("\n"),
        count: agents.length,
        exportedAt: Date.now(),
      };
    }

    // JSON export (default)
    return {
      format: "json",
      data: JSON.stringify(exportData, null, 2),
      count: agents.length,
      exportedAt: Date.now(),
    };
  }

  /**
   * Escape a field for CSV output
   */
  private escapeCsvField(field: string): string {
    // If field contains comma, quote, or newline, wrap in quotes and escape quotes
    if (field.includes(",") || field.includes('"') || field.includes("\n")) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Private Helper Methods - Statistics
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Get agent statistics
   */
  private async getAgentStats(agentId: string): Promise<AgentStats> {
    const stats = await this.executeWithResilience(
      () => this.client.query(api.agents.computeStats, { agentId }),
      "agents:computeStats",
    );
    return stats as AgentStats;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Private Helper Methods - Cascade Deletion by participantId
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * PHASE 1: Collect all records where participantId = agentId
   * This queries across ALL memory spaces IN PARALLEL for performance
   */
  private async collectAgentDeletionTargets(
    agentId: string,
  ): Promise<AgentDeletionPlan> {
    const plan: AgentDeletionPlan = {
      conversations: [],
      memories: [],
      facts: [],
      graph: [],
      agentRegistration: null,
      memorySpaces: [],
    };

    const affectedSpaces = new Set<string>();

    // Get all memory spaces
    const memorySpacesResult = await this.client.query(api.memorySpaces.list, {});
    const memorySpacesList = memorySpacesResult.spaces;

    // PARALLEL COLLECTION: Query all spaces for all data types simultaneously
    // This reduces N*3 sequential calls to 3 parallel batches
    const [conversationResults, memoryResults, factResults, graphNodes] =
      await Promise.all([
        // Collect all conversations in parallel across spaces
        Promise.all(
          memorySpacesList.map((space: { memorySpaceId: string }) =>
            this.client
              .query(api.conversations.list, {
                memorySpaceId: space.memorySpaceId,
              })
              .then((result) => {
                const conversations = (
                  result as { conversations: Conversation[] }
                ).conversations;
                return {
                  spaceId: space.memorySpaceId,
                  conversations: conversations.filter(
                    (c) =>
                      c.participants.participantId === agentId ||
                      c.participants.agentId === agentId ||
                      c.participantId === agentId,
                  ),
                };
              })
              .catch(() => ({
                spaceId: space.memorySpaceId,
                conversations: [] as Conversation[],
              })),
          ),
        ),

        // Collect all memories in parallel across spaces
        Promise.all(
          memorySpacesList.map((space: { memorySpaceId: string }) =>
            this.client
              .query(api.memories.list, {
                memorySpaceId: space.memorySpaceId,
              })
              .then((memories) => ({
                spaceId: space.memorySpaceId,
                memories: (memories as MemoryEntry[]).filter(
                  (m) => m.participantId === agentId,
                ),
              }))
              .catch(() => ({ spaceId: space.memorySpaceId, memories: [] as MemoryEntry[] })),
          ),
        ),

        // Collect all facts in parallel across spaces
        Promise.all(
          memorySpacesList.map((space: { memorySpaceId: string }) =>
            this.client
              .query(api.facts.list, {
                memorySpaceId: space.memorySpaceId,
              })
              .then((facts) => ({
                spaceId: space.memorySpaceId,
                facts: (facts as FactRecord[]).filter(
                  (f) => f.participantId === agentId,
                ),
              }))
              .catch(() => ({ spaceId: space.memorySpaceId, facts: [] as FactRecord[] })),
          ),
        ),

        // Collect graph nodes (single query, already efficient)
        this.graphAdapter
          ? this.collectGraphNodes(agentId).catch(() => [])
          : Promise.resolve([]),
      ]);

    // Process conversation results
    for (const result of conversationResults) {
      if (result.conversations.length > 0) {
        plan.conversations.push(...result.conversations);
        affectedSpaces.add(result.spaceId);
      }
    }

    // Process memory results
    for (const result of memoryResults) {
      if (result.memories.length > 0) {
        plan.memories.push(...result.memories);
        affectedSpaces.add(result.spaceId);
      }
    }

    // Process fact results
    for (const result of factResults) {
      if (result.facts.length > 0) {
        plan.facts.push(...result.facts);
        affectedSpaces.add(result.spaceId);
      }
    }

    // Set graph nodes
    plan.graph = graphNodes;

    // Get agent registration
    const registration = await this.get(agentId);
    plan.agentRegistration = registration;

    // Store affected spaces
    plan.memorySpaces = Array.from(affectedSpaces);

    return plan;
  }

  /**
   * Collect graph nodes where participantId = agentId
   */
  private async collectGraphNodes(
    agentId: string,
  ): Promise<Array<{ nodeId: string; labels: string[] }>> {
    if (!this.graphAdapter) {
      return [];
    }

    try {
      const result = await this.graphAdapter.query(
        `MATCH (n {participantId: $participantId}) RETURN elementId(n) as id, labels(n) as labels`,
        { participantId: agentId },
      );

      return result.records.map((record) => {
        const node = record as unknown as Neo4jNodeRecord;
        return {
          nodeId: node.id,
          labels: node.labels,
        };
      });
    } catch (error) {
      console.warn("Failed to query graph nodes:", error);
      return [];
    }
  }

  /**
   * PHASE 2: Backup records for rollback
   */
  private async backupRecords(
    plan: AgentDeletionPlan,
  ): Promise<AgentDeletionBackup> {
    return {
      conversations: JSON.parse(
        JSON.stringify(plan.conversations),
      ) as Conversation[],
      memories: JSON.parse(JSON.stringify(plan.memories)) as MemoryEntry[],
      facts: JSON.parse(JSON.stringify(plan.facts)) as FactRecord[],
      agentRegistration: plan.agentRegistration
        ? (JSON.parse(
            JSON.stringify(plan.agentRegistration),
          ) as unknown as RegisteredAgent)
        : null,
    };
  }

  /**
   * PHASE 3: Execute cascade deletion in reverse dependency order
   * OPTIMIZED: Uses batch deletes instead of individual API calls
   */
  private async executeAgentCascadeDeletion(
    agentId: string,
    plan: AgentDeletionPlan,
  ): Promise<UnregisterAgentResult> {
    const result: UnregisterAgentResult = {
      agentId,
      unregisteredAt: Date.now(),
      conversationsDeleted: 0,
      conversationMessagesDeleted: 0,
      memoriesDeleted: 0,
      factsDeleted: 0,
      graphNodesDeleted: 0,
      verification: {
        complete: false,
        issues: [],
      },
      totalDeleted: 0,
      deletedLayers: [],
      memorySpacesAffected: plan.memorySpaces,
    };

    // Delete in reverse dependency order: facts → memories → conversations → graph → registration
    // OPTIMIZED: Use batch deletes instead of individual calls

    // 1. Delete facts (batch)
    if (plan.facts.length > 0) {
      try {
        const factIds = plan.facts.map((f) => f.factId);
        const deleteResult = await this.client.mutation(api.facts.deleteByIds, {
          factIds,
        });
        result.factsDeleted = deleteResult.deleted;
        result.deletedLayers.push("facts");
      } catch (error) {
        throw new Error(`Failed to batch delete facts: ${error}`);
      }
    }

    // 2. Delete memories (batch)
    if (plan.memories.length > 0) {
      try {
        const memoryIds = plan.memories.map((m) => m.memoryId);
        const deleteResult = await this.client.mutation(
          api.memories.deleteByIds,
          { memoryIds },
        );
        result.memoriesDeleted = deleteResult.deleted;
        result.deletedLayers.push("memories");
      } catch (error) {
        throw new Error(`Failed to batch delete memories: ${error}`);
      }
    }

    // 3. Delete conversations (batch)
    if (plan.conversations.length > 0) {
      try {
        const conversationIds = plan.conversations.map((c) => c.conversationId);
        const deleteResult = await this.client.mutation(
          api.conversations.deleteByIds,
          { conversationIds },
        );
        result.conversationsDeleted = deleteResult.deleted;
        result.conversationMessagesDeleted = deleteResult.totalMessagesDeleted;
        result.deletedLayers.push("conversations");
      } catch (error) {
        throw new Error(`Failed to batch delete conversations: ${error}`);
      }
    }

    // 4. Delete graph nodes (with orphan detection) - parallel where possible
    if (this.graphAdapter && plan.graph.length > 0) {
      const deletionContext = createDeletionContext(
        `Agent cascade deletion for ${agentId}`,
        {
          ...ORPHAN_RULES,
          // Override rules for agent deletion (explicitly requested)
          Agent: { explicitOnly: false, neverDelete: false },
          Participant: { explicitOnly: false, neverDelete: false },
        },
      );

      // Process graph nodes in parallel batches of 10 for better performance
      const BATCH_SIZE = 10;
      for (let i = 0; i < plan.graph.length; i += BATCH_SIZE) {
        const batch = plan.graph.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(async (node) => {
            try {
              return await deleteWithOrphanCleanup(
                node.nodeId,
                node.labels[0] || "Agent",
                deletionContext,
                this.graphAdapter!,
              );
            } catch (error) {
              console.warn(
                `Failed to delete graph node ${node.nodeId}:`,
                error,
              );
              return { deletedNodes: [], orphanIslands: [] };
            }
          }),
        );

        for (const deleteResult of batchResults) {
          result.graphNodesDeleted =
            (result.graphNodesDeleted || 0) + deleteResult.deletedNodes.length;
        }
      }

      if (result.graphNodesDeleted && result.graphNodesDeleted > 0) {
        result.deletedLayers.push("graph");
      }
    }

    // 5. Delete agent registration (last)
    if (plan.agentRegistration) {
      try {
        await this.client.mutation(api.agents.unregister, { agentId });
        result.deletedLayers.push("agent-registration");
      } catch (error) {
        throw new Error(`Failed to unregister agent ${agentId}: ${error}`);
      }
    }

    // Calculate total
    result.totalDeleted =
      result.conversationsDeleted +
      result.memoriesDeleted +
      result.factsDeleted +
      (result.graphNodesDeleted || 0) +
      (plan.agentRegistration ? 1 : 0);

    return result;
  }

  /**
   * ROLLBACK: Restore backed up records
   */
  private async rollbackAgentDeletion(
    backups: AgentDeletionBackup,
  ): Promise<void> {
    console.warn("Rolling back agent cascade deletion...");

    // Note: This is best-effort rollback
    // Conversations and memories have complex IDs, so restoration requires manual intervention

    if (backups.agentRegistration) {
      try {
        await this.client.mutation(api.agents.register, {
          agentId: backups.agentRegistration.id,
          name: backups.agentRegistration.name,
          description: backups.agentRegistration.description,
          metadata: backups.agentRegistration.metadata,
          config: backups.agentRegistration.config,
        });
      } catch (error) {
        console.error("Failed to restore agent registration:", error);
      }
    }

    console.warn(
      "Rollback completed for agent registration (data restoration requires manual intervention)",
    );
  }

  /**
   * PHASE 4: Verify deletion completeness
   * OPTIMIZED: Runs all verification queries in parallel
   */
  private async verifyAgentDeletion(
    agentId: string,
  ): Promise<VerificationResult> {
    const issues: string[] = [];

    // Get memory spaces once
    const memorySpacesResult = await this.client.query(api.memorySpaces.list, {});
    const memorySpacesList = memorySpacesResult.spaces;

    // Run ALL verification queries in parallel for maximum performance
    const [memoryCounts, conversationCounts, factCounts, graphCount] =
      await Promise.all([
        // Check for remaining memories (parallel across all spaces)
        Promise.all(
          memorySpacesList.map((space: { memorySpaceId: string }) =>
            this.client
              .query(api.memories.list, { memorySpaceId: space.memorySpaceId })
              .then(
                (memories) =>
                  (memories as MemoryEntry[]).filter(
                    (m) => m.participantId === agentId,
                  ).length,
              )
              .catch(() => 0),
          ),
        ),

        // Check for remaining conversations (parallel across all spaces)
        Promise.all(
          memorySpacesList.map((space: { memorySpaceId: string }) =>
            this.client
              .query(api.conversations.list, {
                memorySpaceId: space.memorySpaceId,
              })
              .then((result) => {
                const conversations = (
                  result as { conversations: Conversation[] }
                ).conversations;
                return conversations.filter(
                  (c) =>
                    c.participants.participantId === agentId ||
                    c.participants.agentId === agentId ||
                    c.participantId === agentId,
                ).length;
              })
              .catch(() => 0),
          ),
        ),

        // Check for remaining facts (parallel across all spaces)
        Promise.all(
          memorySpacesList.map((space: { memorySpaceId: string }) =>
            this.client
              .query(api.facts.list, { memorySpaceId: space.memorySpaceId })
              .then(
                (facts) =>
                  (facts as FactRecord[]).filter(
                    (f) => f.participantId === agentId,
                  ).length,
              )
              .catch(() => 0),
          ),
        ),

        // Check graph nodes
        this.graphAdapter
          ? this.countGraphNodes(agentId).catch(() => 0)
          : Promise.resolve(-1), // -1 indicates no graph adapter
      ]);

    // Sum up results
    const remainingMemories = memoryCounts.reduce((a, b) => a + b, 0);
    const remainingConvos = conversationCounts.reduce((a, b) => a + b, 0);
    const remainingFacts = factCounts.reduce((a, b) => a + b, 0);

    // Build issues list
    if (remainingMemories > 0) {
      issues.push(
        `${remainingMemories} memories still reference participantId`,
      );
    }

    if (remainingConvos > 0) {
      issues.push(
        `${remainingConvos} conversations still reference participantId`,
      );
    }

    if (remainingFacts > 0) {
      issues.push(`${remainingFacts} facts still reference participantId`);
    }

    if (graphCount === -1) {
      issues.push(
        "Graph adapter not configured - manual graph cleanup required",
      );
    } else if (graphCount > 0) {
      issues.push(`${graphCount} graph nodes still reference participantId`);
    }

    return {
      complete:
        issues.length === 0 ||
        (issues.length === 1 && issues[0].includes("Graph adapter")),
      issues,
    };
  }

  /**
   * Count remaining graph nodes for agent
   */
  private async countGraphNodes(agentId: string): Promise<number> {
    if (!this.graphAdapter) {
      return 0;
    }

    try {
      const result = await this.graphAdapter.query(
        `MATCH (n {participantId: $participantId}) RETURN count(n) as count`,
        { participantId: agentId },
      );
      const record = result.records[0] as unknown as
        | Neo4jCountRecord
        | undefined;
      return record?.count ?? 0;
    } catch (error) {
      console.warn("Failed to count graph nodes:", error);
      return 0;
    }
  }

  /**
   * Calculate deletion totals from plan
   */
  private calculateDeletionTotals(plan: AgentDeletionPlan): {
    conversationsDeleted: number;
    conversationMessagesDeleted: number;
    memoriesDeleted: number;
    factsDeleted: number;
    graphNodesDeleted?: number;
    totalDeleted: number;
  } {
    const conversationsDeleted = plan.conversations.length;
    const conversationMessagesDeleted = plan.conversations.reduce(
      (sum, c) => sum + (c.messageCount || 0),
      0,
    );
    const memoriesDeleted = plan.memories.length;
    const factsDeleted = plan.facts.length;
    const graphNodesDeleted = plan.graph.length;

    const totalDeleted =
      conversationsDeleted +
      memoriesDeleted +
      factsDeleted +
      graphNodesDeleted +
      (plan.agentRegistration ? 1 : 0);

    return {
      conversationsDeleted,
      conversationMessagesDeleted,
      memoriesDeleted,
      factsDeleted,
      graphNodesDeleted,
      totalDeleted,
    };
  }

  /**
   * Get affected layers from deletion plan
   */
  private getAffectedLayers(plan: AgentDeletionPlan): string[] {
    const layers: string[] = [];

    if (plan.conversations.length > 0) layers.push("conversations");
    if (plan.memories.length > 0) layers.push("memories");
    if (plan.facts.length > 0) layers.push("facts");
    if (plan.graph.length > 0) layers.push("graph");
    if (plan.agentRegistration) layers.push("agent-registration");

    return layers;
  }
}

// Export validation error for users who want to catch it specifically
export { AgentValidationError } from "./validators";
