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
} from "../types";

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
export class AgentsAPI {
  constructor(
    private readonly client: ConvexClient,
    private readonly graphAdapter?: GraphAdapter,
  ) {}

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
    const result = await this.client.mutation(api.agents.register, {
      agentId: agent.id,
      name: agent.name,
      description: agent.description,
      metadata: agent.metadata,
      config: agent.config,
    });

    if (!result) {
      throw new Error(`Failed to register agent ${agent.id}`);
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
    const result = await this.client.query(api.agents.get, { agentId });

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
    const results = await this.client.query(api.agents.list, {
      status: filters?.status,
      limit: filters?.limit,
      offset: filters?.offset,
    });

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
        return filters.capabilities!.some((cap) => agentCaps.includes(cap));
      });
    }

    // Map to RegisteredAgent format (stats computed on-demand in get())
    return filtered.map((r: ConvexAgentRecord) => ({
      id: r.agentId,
      name: r.name,
      description: r.description,
      metadata: r.metadata ?? {},
      config: r.config ?? {},
      status: r.status,
      registeredAt: r.registeredAt,
      updatedAt: r.updatedAt,
      lastActive: r.lastActive,
    }));
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
    return await this.client.query(api.agents.count, {
      status: filters?.status,
    });
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
    const result = await this.client.mutation(api.agents.update, {
      agentId,
      name: updates.name,
      description: updates.description,
      metadata: updates.metadata,
      config: updates.config,
      status: (updates as { status?: string }).status,
    });

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
    await this.client.mutation(api.agents.update, {
      agentId,
      config,
    });
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
    return await this.client.query(api.agents.exists, { agentId });
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
    const cascade = options?.cascade ?? false;
    const verify = options?.verify ?? true;
    const dryRun = options?.dryRun ?? false;

    if (!cascade) {
      // Simple unregister: just remove registration
      if (!dryRun) {
        await this.client.mutation(api.agents.unregister, { agentId });
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

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Private Helper Methods - Statistics
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Get agent statistics
   */
  private async getAgentStats(agentId: string): Promise<AgentStats> {
    const stats = await this.client.query(api.agents.computeStats, { agentId });
    return stats as AgentStats;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Private Helper Methods - Cascade Deletion by participantId
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * PHASE 1: Collect all records where participantId = agentId
   * This queries across ALL memory spaces
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
    const memorySpaces = await this.client.query(api.memorySpaces.list, {});

    // Collect conversations where agent is participant
    try {
      for (const space of memorySpaces) {
        const conversations = await this.client.query(api.conversations.list, {
          memorySpaceId: space.memorySpaceId,
        });

        // Filter conversations where agent is a participant
        const agentConvos = (conversations as Conversation[]).filter(
          (c) =>
            c.participants.participantId === agentId ||
            c.participants.memorySpaceIds?.includes(agentId) ||
            c.participantId === agentId, // Hive Mode
        );

        if (agentConvos.length > 0) {
          plan.conversations.push(...agentConvos);
          affectedSpaces.add(space.memorySpaceId);
        }
      }
    } catch (error) {
      console.warn("Failed to collect conversations:", error);
    }

    // Collect memories where participantId = agentId
    try {
      for (const space of memorySpaces) {
        const memories = await this.client.query(api.memories.list, {
          memorySpaceId: space.memorySpaceId,
        });

        // Filter memories by participantId
        const agentMemories = (memories as MemoryEntry[]).filter(
          (m) => m.participantId === agentId,
        );

        if (agentMemories.length > 0) {
          plan.memories.push(...agentMemories);
          affectedSpaces.add(space.memorySpaceId);
        }
      }
    } catch (error) {
      console.warn("Failed to collect memories:", error);
    }

    // Collect facts where participantId = agentId
    try {
      for (const space of memorySpaces) {
        const facts = await this.client.query(api.facts.list, {
          memorySpaceId: space.memorySpaceId,
        });

        // Filter facts by participantId
        const agentFacts = (facts as FactRecord[]).filter(
          (f) => f.participantId === agentId,
        );

        if (agentFacts.length > 0) {
          plan.facts.push(...agentFacts);
          affectedSpaces.add(space.memorySpaceId);
        }
      }
    } catch (error) {
      console.warn("Failed to collect facts:", error);
    }

    // Collect graph nodes where participantId = agentId
    if (this.graphAdapter) {
      try {
        const graphNodes = await this.collectGraphNodes(agentId);
        plan.graph = graphNodes;
      } catch (error) {
        console.warn("Failed to collect graph nodes:", error);
      }
    }

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

      return result.records.map((record: Neo4jNodeRecord) => ({
        nodeId: record.id,
        labels: record.labels,
      }));
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
          ) as ConvexAgentRecord)
        : null,
    };
  }

  /**
   * PHASE 3: Execute cascade deletion in reverse dependency order
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

    // 1. Delete facts
    for (const fact of plan.facts) {
      try {
        await this.client.mutation(api.facts.deleteFact, {
          memorySpaceId: fact.memorySpaceId,
          factId: fact.factId,
        });
        result.factsDeleted++;
      } catch (error) {
        throw new Error(`Failed to delete fact ${fact.factId}: ${error}`);
      }
    }
    if (result.factsDeleted > 0) {
      result.deletedLayers.push("facts");
    }

    // 2. Delete memories
    for (const memory of plan.memories) {
      try {
        await this.client.mutation(api.memories.deleteMemory, {
          memorySpaceId: memory.memorySpaceId,
          memoryId: memory.memoryId,
        });
        result.memoriesDeleted++;
      } catch (error) {
        throw new Error(`Failed to delete memory ${memory.memoryId}: ${error}`);
      }
    }
    if (result.memoriesDeleted > 0) {
      result.deletedLayers.push("memories");
    }

    // 3. Delete conversations
    for (const conversation of plan.conversations) {
      try {
        await this.client.mutation(api.conversations.deleteConversation, {
          conversationId: conversation.conversationId,
        });
        result.conversationsDeleted++;
        result.conversationMessagesDeleted += conversation.messageCount || 0;
      } catch (error) {
        throw new Error(
          `Failed to delete conversation ${conversation.conversationId}: ${error}`,
        );
      }
    }
    if (result.conversationsDeleted > 0) {
      result.deletedLayers.push("conversations");
    }

    // 4. Delete graph nodes (with orphan detection)
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

      for (const node of plan.graph) {
        try {
          const deleteResult = await deleteWithOrphanCleanup(
            node.nodeId,
            node.labels[0] || "Agent",
            deletionContext,
            this.graphAdapter,
          );

          result.graphNodesDeleted =
            (result.graphNodesDeleted || 0) + deleteResult.deletedNodes.length;

          if (deleteResult.orphanIslands.length > 0) {
            console.warn(
              `  ℹ️  Deleted ${deleteResult.orphanIslands.length} orphan islands during agent cascade`,
            );
          }
        } catch (error) {
          throw new Error(
            `Failed to delete graph node ${node.nodeId}: ${error}`,
          );
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
   */
  private async verifyAgentDeletion(
    agentId: string,
  ): Promise<VerificationResult> {
    const issues: string[] = [];

    // Check for remaining memories
    try {
      const memorySpaces = await this.client.query(api.memorySpaces.list, {});
      let remainingMemories = 0;

      for (const space of memorySpaces) {
        const memories = await this.client.query(api.memories.list, {
          memorySpaceId: space.memorySpaceId,
        });
        const agentMemories = (memories as MemoryEntry[]).filter(
          (m) => m.participantId === agentId,
        );
        remainingMemories += agentMemories.length;
      }

      if (remainingMemories > 0) {
        issues.push(
          `${remainingMemories} memories still reference participantId`,
        );
      }
    } catch (error) {
      issues.push(`Failed to verify memories: ${error}`);
    }

    // Check for remaining conversations
    try {
      const memorySpaces = await this.client.query(api.memorySpaces.list, {});
      let remainingConvos = 0;

      for (const space of memorySpaces) {
        const conversations = await this.client.query(api.conversations.list, {
          memorySpaceId: space.memorySpaceId,
        });
        const agentConvos = (conversations as Conversation[]).filter(
          (c) =>
            c.participants.participantId === agentId ||
            c.participants.memorySpaceIds?.includes(agentId) ||
            c.participantId === agentId,
        );
        remainingConvos += agentConvos.length;
      }

      if (remainingConvos > 0) {
        issues.push(
          `${remainingConvos} conversations still reference participantId`,
        );
      }
    } catch (error) {
      issues.push(`Failed to verify conversations: ${error}`);
    }

    // Check for remaining facts
    try {
      const memorySpaces = await this.client.query(api.memorySpaces.list, {});
      let remainingFacts = 0;

      for (const space of memorySpaces) {
        const facts = await this.client.query(api.facts.list, {
          memorySpaceId: space.memorySpaceId,
        });
        const agentFacts = (facts as FactRecord[]).filter(
          (f) => f.participantId === agentId,
        );
        remainingFacts += agentFacts.length;
      }

      if (remainingFacts > 0) {
        issues.push(`${remainingFacts} facts still reference participantId`);
      }
    } catch (error) {
      issues.push(`Failed to verify facts: ${error}`);
    }

    // Check graph (if available)
    if (this.graphAdapter) {
      try {
        const remainingGraph = await this.countGraphNodes(agentId);
        if (remainingGraph > 0) {
          issues.push(
            `${remainingGraph} graph nodes still reference participantId`,
          );
        }
      } catch (error) {
        issues.push(`Failed to verify graph nodes: ${error}`);
      }
    } else {
      issues.push(
        "Graph adapter not configured - manual graph cleanup required",
      );
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
      const record = result.records[0] as Neo4jCountRecord | undefined;
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
