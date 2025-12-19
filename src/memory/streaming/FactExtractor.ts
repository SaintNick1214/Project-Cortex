/**
 * Progressive Fact Extractor
 *
 * Extracts facts incrementally during streaming with deduplication
 * to avoid storing redundant information as content accumulates.
 *
 * Now supports cross-session deduplication via DeduplicationConfig.
 */

import type { FactRecord } from "../../types";
import type { ProgressiveFact } from "../../types/streaming";
import type { FactsAPI } from "../../facts";
import {
  FactDeduplicationService,
  type DeduplicationConfig,
  type DeduplicationStrategy,
} from "../../facts/deduplication";

type FactType =
  | "preference"
  | "identity"
  | "knowledge"
  | "relationship"
  | "event"
  | "observation"
  | "custom";

/**
 * Configuration for ProgressiveFactExtractor
 */
export interface ProgressiveFactExtractorConfig {
  /**
   * Deduplication configuration for cross-session fact deduplication.
   *
   * - 'semantic': Embedding-based similarity (most accurate, requires generateEmbedding)
   * - 'structural': Subject + predicate + object match (fast, good accuracy)
   * - 'exact': Normalized text match (fastest, lowest accuracy)
   * - 'none' or false: In-memory only deduplication (previous behavior)
   *
   * @default 'structural' for streaming (balance of speed and accuracy)
   */
  deduplication?: DeduplicationConfig | DeduplicationStrategy | false;

  /**
   * Character threshold for triggering extraction during streaming.
   * @default 500
   */
  extractionThreshold?: number;
}

/**
 * Extracts facts progressively during streaming
 */
export class ProgressiveFactExtractor {
  private readonly factsAPI: FactsAPI;
  private readonly extractionThreshold: number;
  private readonly memorySpaceId: string;
  private readonly userId: string;
  private readonly participantId?: string;
  private readonly deduplicationConfig?: DeduplicationConfig;

  private extractedFacts: Map<string, FactRecord> = new Map();
  private lastExtractionPoint: number = 0;
  private extractionCount: number = 0;

  constructor(
    factsAPI: FactsAPI,
    memorySpaceId: string,
    userId: string,
    participantId?: string,
    config?: ProgressiveFactExtractorConfig,
  ) {
    this.factsAPI = factsAPI;
    this.memorySpaceId = memorySpaceId;
    this.userId = userId;
    this.participantId = participantId;
    this.extractionThreshold = config?.extractionThreshold ?? 500;

    // Resolve deduplication config
    // Default to 'structural' for streaming (faster than semantic, still effective)
    if (config?.deduplication !== false) {
      this.deduplicationConfig = FactDeduplicationService.resolveConfig(
        config?.deduplication ?? "structural",
      );
    }
  }

  /**
   * Check if we should extract facts based on content length
   */
  shouldExtract(contentLength: number): boolean {
    return contentLength - this.lastExtractionPoint >= this.extractionThreshold;
  }

  /**
   * Extract facts from a chunk of content
   */
  async extractFromChunk(
    content: string,
    chunkNumber: number,
    extractFacts: (
      userMessage: string,
      agentResponse: string,
    ) => Promise<Array<{
      fact: string;
      factType: string;
      subject?: string;
      predicate?: string;
      object?: string;
      confidence: number;
      tags?: string[];
    }> | null>,
    userMessage: string,
    conversationId: string,
    syncToGraph: boolean = false,
  ): Promise<ProgressiveFact[]> {
    const newFacts: ProgressiveFact[] = [];

    try {
      // Extract facts from current content
      const factsToStore = await extractFacts(userMessage, content);

      if (!factsToStore || factsToStore.length === 0) {
        this.lastExtractionPoint = content.length;
        return newFacts;
      }

      // Store each extracted fact with deduplication
      for (const factData of factsToStore) {
        // Generate a simple key for deduplication
        const factKey = this.generateFactKey(factData.fact, factData.subject);

        // Check if we've already stored this fact
        if (this.extractedFacts.has(factKey)) {
          // Skip duplicate - might update confidence if higher
          const existing = this.extractedFacts.get(factKey)!;
          if (factData.confidence > existing.confidence) {
            // Update confidence in database
            try {
              await this.factsAPI.update(
                this.memorySpaceId,
                existing.factId,
                { confidence: factData.confidence },
                { syncToGraph },
              );
            } catch (error) {
              console.warn("Failed to update fact confidence:", error);
            }
          }
          continue;
        }

        // Store new fact with cross-session deduplication
        try {
          const storeParams = {
            memorySpaceId: this.memorySpaceId,
            participantId: this.participantId,
            userId: this.userId,
            fact: factData.fact,
            factType: factData.factType as FactType,
            subject: factData.subject || this.userId,
            predicate: factData.predicate,
            object: factData.object,
            confidence: factData.confidence,
            sourceType: "conversation" as const,
            sourceRef: {
              conversationId,
              messageIds: [],
            },
            tags: [
              ...(factData.tags || []),
              "progressive",
              `chunk-${chunkNumber}`,
            ],
          };

          let storedFact: FactRecord;
          let wasDeduped = false;

          // Use storeWithDedup if deduplication is configured
          if (this.deduplicationConfig) {
            const result = await this.factsAPI.storeWithDedup(storeParams, {
              syncToGraph,
              deduplication: this.deduplicationConfig,
            });
            storedFact = result.fact;
            wasDeduped = result.deduplication?.matchedExisting ?? false;
          } else {
            // Fallback to regular store (in-memory only dedup)
            storedFact = await this.factsAPI.store(storeParams, { syncToGraph });
          }

          // Track this fact
          this.extractedFacts.set(factKey, storedFact);
          this.extractionCount++;

          newFacts.push({
            factId: storedFact.factId,
            extractedAtChunk: chunkNumber,
            confidence: factData.confidence,
            fact: factData.fact,
            deduped: wasDeduped,
          });
        } catch (error) {
          console.warn("Failed to store progressive fact:", error);
          // Continue with other facts
        }
      }

      this.lastExtractionPoint = content.length;
    } catch (error) {
      console.warn("Progressive fact extraction failed:", error);
      // Don't fail the entire stream - fact extraction is optional
    }

    return newFacts;
  }

  /**
   * Finalize extraction with full content
   * Performs final fact extraction and deduplication
   */
  async finalizeExtraction(
    userMessage: string,
    fullAgentResponse: string,
    extractFacts: (
      userMessage: string,
      agentResponse: string,
    ) => Promise<Array<{
      fact: string;
      factType: string;
      subject?: string;
      predicate?: string;
      object?: string;
      confidence: number;
      tags?: string[];
    }> | null>,
    conversationId: string,
    memoryId: string,
    messageIds: string[],
    syncToGraph: boolean = false,
  ): Promise<FactRecord[]> {
    try {
      // Extract facts from complete response
      const finalFactsToStore = await extractFacts(
        userMessage,
        fullAgentResponse,
      );

      if (!finalFactsToStore || finalFactsToStore.length === 0) {
        return Array.from(this.extractedFacts.values());
      }

      // Deduplicate against progressive facts
      const uniqueFinalFacts = await this.deduplicateFacts(finalFactsToStore);

      // Store any new facts found in final extraction with cross-session deduplication
      for (const factData of uniqueFinalFacts) {
        try {
          const storeParams = {
            memorySpaceId: this.memorySpaceId,
            participantId: this.participantId,
            userId: this.userId,
            fact: factData.fact,
            factType: factData.factType as FactType,
            subject: factData.subject || this.userId,
            predicate: factData.predicate,
            object: factData.object,
            confidence: factData.confidence,
            sourceType: "conversation" as const,
            sourceRef: {
              conversationId,
              messageIds,
              memoryId,
            },
            tags: factData.tags || [],
          };

          let storedFact: FactRecord;

          // Use storeWithDedup if deduplication is configured
          if (this.deduplicationConfig) {
            const result = await this.factsAPI.storeWithDedup(storeParams, {
              syncToGraph,
              deduplication: this.deduplicationConfig,
            });
            storedFact = result.fact;
          } else {
            storedFact = await this.factsAPI.store(storeParams, { syncToGraph });
          }

          const factKey = this.generateFactKey(factData.fact, factData.subject);
          this.extractedFacts.set(factKey, storedFact);
        } catch (error) {
          console.warn("Failed to store final fact:", error);
        }
      }

      // Update all facts with final memory reference
      await this.updateFactsWithMemoryRef(memoryId, messageIds, syncToGraph);

      return Array.from(this.extractedFacts.values());
    } catch (error) {
      console.warn("Final fact extraction failed:", error);
      return Array.from(this.extractedFacts.values());
    }
  }

  /**
   * Deduplicate facts against already extracted ones
   */
  private async deduplicateFacts(
    newFacts: Array<{
      fact: string;
      factType: string;
      subject?: string;
      predicate?: string;
      object?: string;
      confidence: number;
      tags?: string[];
    }>,
  ): Promise<
    Array<{
      fact: string;
      factType: string;
      subject?: string;
      predicate?: string;
      object?: string;
      confidence: number;
      tags?: string[];
    }>
  > {
    const uniqueFacts = [];

    for (const fact of newFacts) {
      const factKey = this.generateFactKey(fact.fact, fact.subject);

      if (!this.extractedFacts.has(factKey)) {
        uniqueFacts.push(fact);
      } else {
        // Check if new fact has higher confidence
        const existing = this.extractedFacts.get(factKey)!;
        if (fact.confidence > existing.confidence + 10) {
          // Significantly higher confidence - worth updating
          uniqueFacts.push(fact);
        }
      }
    }

    return uniqueFacts;
  }

  /**
   * Generate a key for fact deduplication
   * Simple implementation - could be enhanced with fuzzy matching
   */
  private generateFactKey(fact: string, subject?: string): string {
    // Normalize the fact text
    const normalized = fact.toLowerCase().trim();

    // Include subject if available for better distinction
    const key = subject ? `${subject}::${normalized}` : normalized;

    return key;
  }

  /**
   * Update all extracted facts with final memory reference
   * Note: sourceRef cannot be updated after creation, so we just remove progressive tags
   */
  private async updateFactsWithMemoryRef(
    memoryId: string,
    messageIds: string[],
    syncToGraph: boolean,
  ): Promise<void> {
    const updatePromises = Array.from(this.extractedFacts.values()).map(
      async (fact) => {
        try {
          // Remove progressive tag to mark as finalized
          await this.factsAPI.update(
            this.memorySpaceId,
            fact.factId,
            {
              tags: fact.tags.filter((tag) => tag !== "progressive"),
            },
            { syncToGraph },
          );
        } catch (error) {
          console.warn(
            `Failed to update fact ${fact.factId} with memory ref:`,
            error,
          );
        }
      },
    );

    await Promise.allSettled(updatePromises);
  }

  /**
   * Get all extracted facts
   */
  getExtractedFacts(): FactRecord[] {
    return Array.from(this.extractedFacts.values());
  }

  /**
   * Get extraction statistics
   */
  getStats(): {
    totalFactsExtracted: number;
    extractionPoints: number;
    averageFactsPerExtraction: number;
  } {
    return {
      totalFactsExtracted: this.extractedFacts.size,
      extractionPoints: this.extractionCount,
      averageFactsPerExtraction:
        this.extractionCount > 0
          ? this.extractedFacts.size / this.extractionCount
          : 0,
    };
  }

  /**
   * Reset extractor state
   */
  reset(): void {
    this.extractedFacts.clear();
    this.lastExtractionPoint = 0;
    this.extractionCount = 0;
  }
}
