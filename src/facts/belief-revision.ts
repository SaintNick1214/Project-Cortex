/**
 * Cortex SDK - Belief Revision Service
 *
 * Main orchestration service for the belief revision pipeline.
 * Determines whether a new fact should CREATE, UPDATE, SUPERSEDE, or be IGNORED.
 *
 * Pipeline flow:
 * 1. Slot matching (fast path)
 * 2. Semantic matching (catch-all)
 * 3. LLM conflict resolution (nuanced decisions)
 * 4. Execute decision
 * 5. Log history
 * 6. Sync to graph
 */

import type { ConvexClient } from "convex/browser";
import type { FactRecord } from "../types";
import type { GraphAdapter } from "../graph/types";
import {
  SlotMatchingService,
  type SlotMatchingConfig,
  type SlotConflictResult,
} from "./slot-matching";
import {
  type ConflictDecision,
  type ConflictCandidate,
  type ConflictAction,
  buildConflictResolutionPrompt,
  parseConflictDecision,
  validateConflictDecision,
  getDefaultDecision,
} from "./conflict-prompts";
import { FactDeduplicationService, type DeduplicationConfig } from "./deduplication";

/**
 * LLM client interface for belief revision conflict resolution.
 *
 * This is separate from the base LLMClient to allow for different
 * implementations (e.g., OpenAI, Anthropic) while keeping the
 * belief revision logic generic.
 */
export interface BeliefRevisionLLMClient {
  /**
   * Complete a prompt with system and user messages.
   *
   * @param options Completion options
   * @returns The model's response as a string
   */
  complete(options: {
    system: string;
    prompt: string;
    model?: string;
    responseFormat?: "json" | "text";
  }): Promise<string>;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Configuration for belief revision
 */
export interface BeliefRevisionConfig {
  /** Slot matching configuration */
  slotMatching?: {
    /** Enable slot matching (default: true) */
    enabled?: boolean;
    /** Custom predicate classes */
    predicateClasses?: Record<string, string[]>;
  };

  /** Semantic matching configuration */
  semanticMatching?: {
    /** Enable semantic matching (default: true) */
    enabled?: boolean;
    /** Similarity threshold (default: 0.7, lower than dedup's 0.85) */
    threshold?: number;
    /** Max candidates to consider */
    limit?: number;
    /** Embedding function for semantic search */
    generateEmbedding?: (text: string) => Promise<number[]>;
  };

  /** LLM resolution configuration */
  llmResolution?: {
    /** Enable LLM resolution (default: true if llmClient provided) */
    enabled?: boolean;
    /** Custom model to use */
    model?: string;
  };

  /** History logging configuration */
  history?: {
    /** Enable history logging (default: true) */
    enabled?: boolean;
    /** Days to retain history */
    retentionDays?: number;
  };
}

/**
 * Parameters for the revise operation
 */
export interface ReviseParams {
  /** Memory space to operate in */
  memorySpaceId: string;
  /** The new fact to evaluate */
  fact: ConflictCandidate;
  /** Optional user ID filter */
  userId?: string;
  /** Optional participant ID */
  participantId?: string;
}

/**
 * Result of the revise operation
 */
export interface ReviseResult {
  /** The action that was taken */
  action: ConflictAction;
  /** The resulting fact record */
  fact: FactRecord;
  /** Facts that were superseded (if any) */
  superseded: FactRecord[];
  /** Explanation for the decision */
  reason: string;
  /** Confidence in the decision */
  confidence: number;
  /** Pipeline stages that were executed */
  pipeline: {
    slotMatching?: { executed: boolean; matched: boolean; factIds?: string[] };
    semanticMatching?: { executed: boolean; matched: boolean; factIds?: string[] };
    subjectTypeMatching?: { executed: boolean; matched: boolean; factIds?: string[] };
    llmResolution?: { executed: boolean; decision?: ConflictAction };
  };
}

/**
 * Result of conflict check (preview without execution)
 */
export interface ConflictCheckResult {
  /** Whether conflicts were found */
  hasConflicts: boolean;
  /** Slot-based conflicts */
  slotConflicts: FactRecord[];
  /** Semantic conflicts */
  semanticConflicts: Array<{ fact: FactRecord; score: number }>;
  /** Recommended action (without executing) */
  recommendedAction: ConflictAction;
  /** Recommendation reason */
  reason: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BeliefRevisionService
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Belief revision service for intelligent fact management
 *
 * @example
 * ```typescript
 * const beliefRevision = new BeliefRevisionService(
 *   convexClient,
 *   llmClient,
 *   graphAdapter,
 *   {
 *     slotMatching: { enabled: true },
 *     semanticMatching: { enabled: true, threshold: 0.7 },
 *     llmResolution: { enabled: true },
 *   }
 * );
 *
 * const result = await beliefRevision.revise({
 *   memorySpaceId: "space-1",
 *   fact: {
 *     fact: "User prefers purple",
 *     subject: "user-123",
 *     predicate: "favorite color",
 *     object: "purple",
 *     confidence: 90,
 *   },
 * });
 *
 * console.log(`Action: ${result.action}, Reason: ${result.reason}`);
 * ```
 */
export class BeliefRevisionService {
  private slotMatcher: SlotMatchingService;
  private deduplicationService: FactDeduplicationService;
  private config: BeliefRevisionConfig;

  constructor(
    private client: ConvexClient,
    private llmClient?: BeliefRevisionLLMClient,
    private graphAdapter?: GraphAdapter,
    config?: BeliefRevisionConfig,
  ) {
    this.config = config || {};

    // Initialize slot matching service
    const slotConfig: SlotMatchingConfig = {
      enabled: config?.slotMatching?.enabled ?? true,
      predicateClasses: config?.slotMatching?.predicateClasses,
    };
    this.slotMatcher = new SlotMatchingService(client, slotConfig);

    // Initialize deduplication service (for semantic matching)
    this.deduplicationService = new FactDeduplicationService(client);
  }

  /**
   * Main entry point: evaluate a new fact and determine the appropriate action
   */
  async revise(params: ReviseParams): Promise<ReviseResult> {
    const pipelineResult: ReviseResult["pipeline"] = {};
    let candidates: FactRecord[] = [];
    let action: ConflictAction = "ADD";
    let targetFact: FactRecord | null = null;
    let reason = "No conflicts found - adding new fact";
    let confidence = 100;

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Stage 1: Slot Matching (Fast Path)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (this.config.slotMatching?.enabled !== false) {
      const slotResult = await this.findSlotConflicts(params);
      pipelineResult.slotMatching = {
        executed: true,
        matched: slotResult.hasConflict,
        factIds: slotResult.conflictingFacts.map((f) => f.factId),
      };

      if (slotResult.hasConflict) {
        candidates = slotResult.conflictingFacts;
      }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Stage 2: Semantic Matching (if no slot matches)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (
      candidates.length === 0 &&
      this.config.semanticMatching?.enabled !== false
    ) {
      const semanticResult = await this.findSemanticConflicts(params);
      pipelineResult.semanticMatching = {
        executed: true,
        matched: semanticResult.length > 0,
        factIds: semanticResult.map((r) => r.fact.factId),
      };

      if (semanticResult.length > 0) {
        candidates = semanticResult.map((r) => r.fact);
      }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Stage 2.5: Subject + FactType Matching (if no candidates yet)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (candidates.length === 0) {
      const subjectTypeCandidates = await this.findSubjectTypeConflicts(params);
      pipelineResult.subjectTypeMatching = {
        executed: true,
        matched: subjectTypeCandidates.length > 0,
        factIds: subjectTypeCandidates.map((f) => f.factId),
      };

      if (subjectTypeCandidates.length > 0) {
        candidates = subjectTypeCandidates;
      }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Stage 3: LLM Resolution (if candidates found)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (candidates.length > 0) {
      const decision = await this.resolveWithLLM(params.fact, candidates);
      pipelineResult.llmResolution = {
        executed: true,
        decision: decision.action,
      };

      action = decision.action;
      reason = decision.reason;
      confidence = decision.confidence ?? 75;

      if (decision.targetFactId) {
        targetFact = candidates.find((f) => f.factId === decision.targetFactId) || null;
      }

      // Handle UPDATE with merged fact
      if (action === "UPDATE" && decision.mergedFact && targetFact) {
        params.fact.fact = decision.mergedFact;
      }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Stage 4: Execute Decision
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const executionResult = await this.executeDecision(
      action,
      params,
      targetFact,
      reason,
    );

    return {
      action,
      fact: executionResult.fact,
      superseded: executionResult.superseded,
      reason,
      confidence,
      pipeline: pipelineResult,
    };
  }

  /**
   * Check for conflicts without executing (preview mode)
   */
  async checkConflicts(params: ReviseParams): Promise<ConflictCheckResult> {
    const slotConflicts: FactRecord[] = [];
    const semanticConflicts: Array<{ fact: FactRecord; score: number }> = [];

    // Check slot conflicts
    if (this.config.slotMatching?.enabled !== false) {
      const slotResult = await this.findSlotConflicts(params);
      if (slotResult.hasConflict) {
        slotConflicts.push(...slotResult.conflictingFacts);
      }
    }

    // Check semantic conflicts
    if (this.config.semanticMatching?.enabled !== false) {
      const semanticResult = await this.findSemanticConflicts(params);
      semanticConflicts.push(...semanticResult);
    }

    // Get recommended action
    const allCandidates = [
      ...slotConflicts,
      ...semanticConflicts.map((r) => r.fact),
    ];
    const uniqueCandidates = this.deduplicateFacts(allCandidates);

    let recommendedAction: ConflictAction = "ADD";
    let reason = "No conflicts found";

    if (uniqueCandidates.length > 0) {
      const decision = await this.resolveWithLLM(params.fact, uniqueCandidates);
      recommendedAction = decision.action;
      reason = decision.reason;
    }

    return {
      hasConflicts: slotConflicts.length > 0 || semanticConflicts.length > 0,
      slotConflicts,
      semanticConflicts,
      recommendedAction,
      reason,
    };
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Private: Pipeline Stages
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Stage 1: Find slot-based conflicts
   */
  private async findSlotConflicts(
    params: ReviseParams,
  ): Promise<SlotConflictResult> {
    return this.slotMatcher.findSlotConflicts(
      {
        subject: params.fact.subject,
        predicate: params.fact.predicate,
        object: params.fact.object,
      },
      params.memorySpaceId,
      params.userId,
    );
  }

  /**
   * Stage 2: Find semantic conflicts
   */
  private async findSemanticConflicts(
    params: ReviseParams,
  ): Promise<Array<{ fact: FactRecord; score: number }>> {
    const config: DeduplicationConfig = {
      strategy: "semantic",
      similarityThreshold: this.config.semanticMatching?.threshold ?? 0.7,
      generateEmbedding: this.config.semanticMatching?.generateEmbedding,
    };

    // If no embedding function, fall back to structural
    if (!config.generateEmbedding) {
      config.strategy = "structural";
    }

    const result = await this.deduplicationService.findDuplicate(
      {
        fact: params.fact.fact,
        factType: params.fact.factType || "custom",
        subject: params.fact.subject,
        predicate: params.fact.predicate,
        object: params.fact.object,
        confidence: params.fact.confidence,
        tags: params.fact.tags,
      },
      params.memorySpaceId,
      config,
      params.userId,
    );

    if (result.isDuplicate && result.existingFact) {
      return [
        {
          fact: result.existingFact,
          score: result.similarityScore ?? 1.0,
        },
      ];
    }

    return [];
  }

  /**
   * Stage 2.5: Find conflicts by subject + factType
   * 
   * This stage catches conflicts that slip through slot and semantic matching
   * by querying for facts with the same subject AND factType. For example,
   * "User likes blue" and "User prefers purple" both have subject="user" and
   * factType="preference", making them candidates for LLM review even if their
   * predicates differ.
   */
  private async findSubjectTypeConflicts(
    params: ReviseParams,
  ): Promise<FactRecord[]> {
    // Skip if no subject or factType - can't match without these
    if (!params.fact.subject || !params.fact.factType) {
      return [];
    }

    const { api } = await import("../../convex-dev/_generated/api");
    const facts = await this.client.query(api.facts.list, {
      memorySpaceId: params.memorySpaceId,
      userId: params.userId,
      subject: params.fact.subject,
      factType: params.fact.factType as any,
      includeSuperseded: false,
      limit: 20, // Reasonable limit for LLM processing
    });

    return facts as FactRecord[];
  }

  /**
   * Stage 3: Resolve conflict with LLM
   */
  private async resolveWithLLM(
    newFact: ConflictCandidate,
    existingFacts: FactRecord[],
  ): Promise<ConflictDecision> {
    // If LLM is disabled or unavailable, use default heuristics
    if (
      this.config.llmResolution?.enabled === false ||
      !this.llmClient
    ) {
      return getDefaultDecision(newFact, existingFacts);
    }

    try {
      // Build prompt
      const { system, user } = buildConflictResolutionPrompt(
        newFact,
        existingFacts,
        { includeExamples: true },
      );

      // Call LLM
      const response = await this.llmClient.complete({
        system,
        prompt: user,
        model: this.config.llmResolution?.model,
        responseFormat: "json",
      });

      // Parse response
      const decision = parseConflictDecision(response);

      // Validate decision
      const validation = validateConflictDecision(decision, existingFacts);
      if (!validation.valid) {
        console.warn(
          `[Cortex] LLM decision validation failed: ${validation.error}. Falling back to default.`,
        );
        return getDefaultDecision(newFact, existingFacts);
      }

      return decision;
    } catch (error) {
      console.warn(
        `[Cortex] LLM conflict resolution failed: ${error}. Falling back to default.`,
      );
      return getDefaultDecision(newFact, existingFacts);
    }
  }

  /**
   * Stage 4: Execute the decision
   */
  private async executeDecision(
    action: ConflictAction,
    params: ReviseParams,
    targetFact: FactRecord | null,
    _reason: string,
  ): Promise<{ fact: FactRecord; superseded: FactRecord[] }> {
    const { api } = await import("../../convex-dev/_generated/api");
    const superseded: FactRecord[] = [];

    switch (action) {
      case "NONE": {
        // Return existing fact without changes
        if (targetFact) {
          return { fact: targetFact, superseded: [] };
        }
        // Fallback: create new fact anyway
        break;
      }

      case "UPDATE": {
        if (targetFact) {
          // Update the existing fact in place (no new version created)
          const updated = await this.client.mutation(api.facts.updateInPlace, {
            memorySpaceId: params.memorySpaceId,
            factId: targetFact.factId,
            fact: params.fact.fact,
            confidence: params.fact.confidence,
            tags: params.fact.tags,
          });
          return { fact: updated as FactRecord, superseded: [] };
        }
        break;
      }

      case "SUPERSEDE": {
        if (targetFact) {
          // Create new fact
          const newFact = await this.client.mutation(api.facts.store, {
            memorySpaceId: params.memorySpaceId,
            participantId: params.participantId,
            userId: params.userId,
            fact: params.fact.fact,
            factType: (params.fact.factType as any) || "custom",
            subject: params.fact.subject,
            predicate: params.fact.predicate,
            object: params.fact.object,
            confidence: params.fact.confidence,
            sourceType: "conversation",
            tags: params.fact.tags || [],
          });

          // Mark old fact as superseded by the new fact
          // This sets both supersededBy and validUntil, and links the facts together
          await this.client.mutation(api.facts.supersede, {
            memorySpaceId: params.memorySpaceId,
            oldFactId: targetFact.factId,
            newFactId: (newFact as FactRecord).factId,
            reason: _reason,
          });

          // Update supersededBy relationship (done via update mutation)
          superseded.push(targetFact);

          return { fact: newFact as FactRecord, superseded };
        }
        break;
      }

      case "ADD":
      default: {
        // Create new fact
        const newFact = await this.client.mutation(api.facts.store, {
          memorySpaceId: params.memorySpaceId,
          participantId: params.participantId,
          userId: params.userId,
          fact: params.fact.fact,
          factType: (params.fact.factType as any) || "custom",
          subject: params.fact.subject,
          predicate: params.fact.predicate,
          object: params.fact.object,
          confidence: params.fact.confidence,
          sourceType: "conversation",
          tags: params.fact.tags || [],
        });
        return { fact: newFact as FactRecord, superseded: [] };
      }
    }

    // Fallback: create new fact
    const newFact = await this.client.mutation(api.facts.store, {
      memorySpaceId: params.memorySpaceId,
      participantId: params.participantId,
      userId: params.userId,
      fact: params.fact.fact,
      factType: (params.fact.factType as any) || "custom",
      subject: params.fact.subject,
      predicate: params.fact.predicate,
      object: params.fact.object,
      confidence: params.fact.confidence,
      sourceType: "conversation",
      tags: params.fact.tags || [],
    });
    return { fact: newFact as FactRecord, superseded: [] };
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Private: Utilities
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Remove duplicate facts from array (by factId)
   */
  private deduplicateFacts(facts: FactRecord[]): FactRecord[] {
    const seen = new Set<string>();
    return facts.filter((f) => {
      if (seen.has(f.factId)) {
        return false;
      }
      seen.add(f.factId);
      return true;
    });
  }

  /**
   * Get the current configuration
   */
  getConfig(): BeliefRevisionConfig {
    return this.config;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<BeliefRevisionConfig>): void {
    this.config = { ...this.config, ...config };

    // Reinitialize slot matcher if predicate classes changed
    if (config.slotMatching?.predicateClasses) {
      this.slotMatcher = new SlotMatchingService(this.client, {
        enabled: this.config.slotMatching?.enabled ?? true,
        predicateClasses: this.config.slotMatching?.predicateClasses,
      });
    }
  }
}

// Export types
export type {
  ConflictAction,
  ConflictDecision,
  ConflictCandidate,
} from "./conflict-prompts";
