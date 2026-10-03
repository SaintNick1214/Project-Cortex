/**
 * Cortex SDK - Slot-Based Fact Matching
 *
 * Provides fast O(1) slot-based matching for facts that represent
 * the same semantic "slot" (e.g., favorite_color, location, employment).
 *
 * This is the first stage of the belief revision pipeline, catching
 * obvious conflicts before more expensive semantic/LLM processing.
 */

import type { ConvexClient } from "convex/browser";
import type { FactRecord } from "../types";

import { DEFAULT_PREDICATE_CLASSES, extractSlot, normalizeSubject } from "../domain/slots.js";
import type { SlotMatch, SlotMatchingConfig, SlotConflictResult } from "../domain/slots.js";
export { DEFAULT_PREDICATE_CLASSES, normalizeSubject, normalizePredicate, classifyPredicate, extractSlot } from "../domain/slots.js";
export type { SlotMatch, SlotMatchingConfig, SlotConflictResult } from "../domain/slots.js";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SlotMatchingService
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Service for slot-based fact conflict detection
 *
 * @example
 * ```typescript
 * const slotService = new SlotMatchingService(convexClient);
 *
 * // Check if a new fact conflicts with existing facts in the same slot
 * const result = await slotService.findSlotConflicts(
 *   {
 *     subject: "user-123",
 *     predicate: "prefers purple",
 *     object: "purple",
 *   },
 *   "memory-space-1"
 * );
 *
 * if (result.hasConflict) {
 *   console.log("Found conflicting facts:", result.conflictingFacts);
 * }
 * ```
 */
export class SlotMatchingService {
  private customClasses?: Record<string, string[]>;

  constructor(
    private client: ConvexClient,
    config?: SlotMatchingConfig,
  ) {
    this.customClasses = config?.predicateClasses;
  }

  /**
   * Find existing facts that occupy the same slot as the candidate
   *
   * @param candidate - The fact candidate to check
   * @param memorySpaceId - Memory space to search in
   * @param userId - Optional user ID filter
   * @returns Slot conflict result
   */
  async findSlotConflicts(
    candidate: {
      subject?: string;
      predicate?: string;
      object?: string;
    },
    memorySpaceId: string,
    userId?: string,
  ): Promise<SlotConflictResult> {
    // Extract slot from candidate
    const slot = extractSlot(
      candidate.subject,
      candidate.predicate,
      this.customClasses,
    );

    // If we can't extract a slot, no conflict detection possible
    if (!slot) {
      return {
        hasConflict: false,
        conflictingFacts: [],
      };
    }

    // Query for facts with the same subject
    const subjectFacts = await this.queryBySubject(
      memorySpaceId,
      candidate.subject!,
      userId,
    );

    // Filter to facts in the same slot class
    const conflictingFacts = subjectFacts.filter((fact) => {
      const factSlot = extractSlot(
        fact.subject,
        fact.predicate,
        this.customClasses,
      );
      return (
        factSlot &&
        factSlot.predicateClass === slot.predicateClass &&
        fact.supersededBy === undefined // Only active facts
      );
    });

    return {
      hasConflict: conflictingFacts.length > 0,
      slot,
      conflictingFacts,
    };
  }

  /**
   * Query facts by subject from the database
   */
  private async queryBySubject(
    memorySpaceId: string,
    subject: string,
    userId?: string,
  ): Promise<FactRecord[]> {
    try {
      // Dynamic import to avoid ESM issues in test environments
      const { api } = await import("../../convex-dev/_generated/api");
      const facts = await this.client.query(api.facts.queryBySubject, {
        memorySpaceId,
        subject: normalizeSubject(subject),
        userId,
        includeSuperseded: false,
        limit: 100, // Reasonable limit for slot matching
      });
      return facts as FactRecord[];
    } catch {
      // Fallback if query fails
      return [];
    }
  }

  /**
   * Get the slot for a fact (useful for debugging/inspection)
   */
  getSlot(
    subject: string | undefined,
    predicate: string | undefined,
  ): SlotMatch | null {
    return extractSlot(subject, predicate, this.customClasses);
  }

  /**
   * Check if two facts would be in the same slot
   */
  sameSlot(
    fact1: { subject?: string; predicate?: string },
    fact2: { subject?: string; predicate?: string },
  ): boolean {
    const slot1 = extractSlot(
      fact1.subject,
      fact1.predicate,
      this.customClasses,
    );
    const slot2 = extractSlot(
      fact2.subject,
      fact2.predicate,
      this.customClasses,
    );

    if (!slot1 || !slot2) {
      return false;
    }

    return (
      slot1.subject === slot2.subject &&
      slot1.predicateClass === slot2.predicateClass
    );
  }

  /**
   * Get all predicate classes (default + custom)
   */
  getPredicateClasses(): Record<string, string[]> {
    return this.customClasses
      ? { ...DEFAULT_PREDICATE_CLASSES, ...this.customClasses }
      : DEFAULT_PREDICATE_CLASSES;
  }

  /**
   * Get the default predicate classes
   */
  static getDefaultPredicateClasses(): Record<string, string[]> {
    return DEFAULT_PREDICATE_CLASSES;
  }
}
