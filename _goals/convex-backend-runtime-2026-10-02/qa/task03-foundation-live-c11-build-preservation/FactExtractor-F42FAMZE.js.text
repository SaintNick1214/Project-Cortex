import {
  FactDeduplicationService
} from "./chunk-VEHCF6HD.js";
import "./chunk-24X3JR4G.js";
import "./chunk-3RG5ZIWI.js";

// src/memory/streaming/FactExtractor.ts
var ProgressiveFactExtractor = class {
  factsAPI;
  extractionThreshold;
  memorySpaceId;
  userId;
  participantId;
  deduplicationConfig;
  extractedFacts = /* @__PURE__ */ new Map();
  lastExtractionPoint = 0;
  extractionCount = 0;
  constructor(factsAPI, memorySpaceId, userId, participantId, config) {
    this.factsAPI = factsAPI;
    this.memorySpaceId = memorySpaceId;
    this.userId = userId;
    this.participantId = participantId;
    this.extractionThreshold = config?.extractionThreshold ?? 500;
    if (config?.deduplication !== false) {
      this.deduplicationConfig = FactDeduplicationService.resolveConfig(
        config?.deduplication ?? "structural"
      );
    }
  }
  /**
   * Check if we should extract facts based on content length
   */
  shouldExtract(contentLength) {
    return contentLength - this.lastExtractionPoint >= this.extractionThreshold;
  }
  /**
   * Extract facts from a chunk of content
   */
  async extractFromChunk(content, chunkNumber, extractFacts, userMessage, conversationId) {
    const newFacts = [];
    try {
      const factsToStore = await extractFacts(userMessage, content);
      if (!factsToStore || factsToStore.length === 0) {
        this.lastExtractionPoint = content.length;
        return newFacts;
      }
      for (const factData of factsToStore) {
        const factKey = this.generateFactKey(factData.fact, factData.subject);
        if (this.extractedFacts.has(factKey)) {
          const existing = this.extractedFacts.get(factKey);
          if (factData.confidence > existing.confidence) {
            try {
              await this.factsAPI.update(
                this.memorySpaceId,
                existing.factId,
                { confidence: factData.confidence }
              );
            } catch (error) {
              console.warn("Failed to update fact confidence:", error);
            }
          }
          continue;
        }
        try {
          const storeParams = {
            memorySpaceId: this.memorySpaceId,
            participantId: this.participantId,
            userId: this.userId,
            fact: factData.fact,
            factType: factData.factType,
            subject: factData.subject || this.userId,
            predicate: factData.predicate,
            object: factData.object,
            confidence: factData.confidence,
            sourceType: "conversation",
            sourceRef: {
              conversationId,
              messageIds: []
            },
            tags: [
              ...factData.tags || [],
              "progressive",
              `chunk-${chunkNumber}`
            ]
          };
          let storedFact;
          let wasDeduped = false;
          if (this.deduplicationConfig) {
            const result = await this.factsAPI.storeWithDedup(storeParams, {
              deduplication: this.deduplicationConfig
            });
            storedFact = result.fact;
            wasDeduped = result.deduplication?.matchedExisting ?? false;
          } else {
            storedFact = await this.factsAPI.store(storeParams);
          }
          this.extractedFacts.set(factKey, storedFact);
          this.extractionCount++;
          newFacts.push({
            factId: storedFact.factId,
            extractedAtChunk: chunkNumber,
            confidence: factData.confidence,
            fact: factData.fact,
            deduped: wasDeduped
          });
        } catch (error) {
          console.warn("Failed to store progressive fact:", error);
        }
      }
      this.lastExtractionPoint = content.length;
    } catch (error) {
      console.warn("Progressive fact extraction failed:", error);
    }
    return newFacts;
  }
  /**
   * Finalize extraction with full content
   * Performs final fact extraction and deduplication
   */
  async finalizeExtraction(userMessage, fullAgentResponse, extractFacts, conversationId, memoryId, messageIds) {
    try {
      const finalFactsToStore = await extractFacts(
        userMessage,
        fullAgentResponse
      );
      if (!finalFactsToStore || finalFactsToStore.length === 0) {
        return Array.from(this.extractedFacts.values());
      }
      const uniqueFinalFacts = await this.deduplicateFacts(finalFactsToStore);
      for (const factData of uniqueFinalFacts) {
        try {
          const storeParams = {
            memorySpaceId: this.memorySpaceId,
            participantId: this.participantId,
            userId: this.userId,
            fact: factData.fact,
            factType: factData.factType,
            subject: factData.subject || this.userId,
            predicate: factData.predicate,
            object: factData.object,
            confidence: factData.confidence,
            sourceType: "conversation",
            sourceRef: {
              conversationId,
              messageIds,
              memoryId
            },
            tags: factData.tags || []
          };
          let storedFact;
          if (this.deduplicationConfig) {
            const result = await this.factsAPI.storeWithDedup(storeParams, {
              deduplication: this.deduplicationConfig
            });
            storedFact = result.fact;
          } else {
            storedFact = await this.factsAPI.store(storeParams);
          }
          const factKey = this.generateFactKey(factData.fact, factData.subject);
          this.extractedFacts.set(factKey, storedFact);
        } catch (error) {
          console.warn("Failed to store final fact:", error);
        }
      }
      await this.updateFactsWithMemoryRef(memoryId, messageIds);
      return Array.from(this.extractedFacts.values());
    } catch (error) {
      console.warn("Final fact extraction failed:", error);
      return Array.from(this.extractedFacts.values());
    }
  }
  /**
   * Deduplicate facts against already extracted ones
   */
  async deduplicateFacts(newFacts) {
    const uniqueFacts = [];
    for (const fact of newFacts) {
      const factKey = this.generateFactKey(fact.fact, fact.subject);
      if (!this.extractedFacts.has(factKey)) {
        uniqueFacts.push(fact);
      } else {
        const existing = this.extractedFacts.get(factKey);
        if (fact.confidence > existing.confidence + 10) {
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
  generateFactKey(fact, subject) {
    const normalized = fact.toLowerCase().trim();
    const key = subject ? `${subject}::${normalized}` : normalized;
    return key;
  }
  /**
   * Update all extracted facts with final memory reference
   * Note: sourceRef cannot be updated after creation, so we just remove progressive tags
   * Graph sync is automatic when graphAdapter is configured
   */
  async updateFactsWithMemoryRef(_memoryId, _messageIds) {
    const updatePromises = Array.from(this.extractedFacts.values()).map(
      async (fact) => {
        try {
          await this.factsAPI.update(this.memorySpaceId, fact.factId, {
            tags: fact.tags.filter((tag) => tag !== "progressive")
          });
        } catch (error) {
          console.warn(
            `Failed to update fact ${fact.factId} with memory ref:`,
            error
          );
        }
      }
    );
    await Promise.allSettled(updatePromises);
  }
  /**
   * Get all extracted facts
   */
  getExtractedFacts() {
    return Array.from(this.extractedFacts.values());
  }
  /**
   * Get extraction statistics
   */
  getStats() {
    return {
      totalFactsExtracted: this.extractedFacts.size,
      extractionPoints: this.extractionCount,
      averageFactsPerExtraction: this.extractionCount > 0 ? this.extractedFacts.size / this.extractionCount : 0
    };
  }
  /**
   * Reset extractor state
   */
  reset() {
    this.extractedFacts.clear();
    this.lastExtractionPoint = 0;
    this.extractionCount = 0;
  }
};
export {
  ProgressiveFactExtractor
};
