/**
 * Memory Operations Routes
 * Handles remember, recall, and forget operations
 */

import express from "express";
import logger from "../utils/logger.js";
import { generateEmbedding } from "../utils/embeddings.js";

const router = express.Router();

/**
 * Initialize routes with Cortex instance
 */
export function createMemoryRoutes(cortex) {
  /**
   * POST /api/memory/remember
   * Store a conversation in Cortex with automatic embedding
   */
  router.post("/remember", async (req, res) => {
    try {
      const {
        userId,
        conversationId,
        userMessage,
        agentResponse,
        contextId,
        participantId,
        importance,
        extractFacts,
        metadata,
      } = req.body;

      // Validation
      if (!userId || !userMessage) {
        return res.status(400).json({
          success: false,
          error: "userId and userMessage are required",
        });
      }

      // Generate embedding for semantic search
      const embedding = await generateEmbedding(userMessage);

      logger.info("Storing memory", {
        userId,
        conversationId: conversationId || "auto-generated",
        hasResponse: !!agentResponse,
      });

      // Store in Cortex (extractFacts parameter removed - not supported by SDK)
      const result = await cortex.memory.remember({
        memorySpaceId: userId,
        conversationId: conversationId || `conv-${Date.now()}`,
        userMessage,
        agentResponse: agentResponse || null,
        userId,
        embedding,
        contextId,
        participantId: participantId || "default",
        importance: importance || 5,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
          source: "openwebui",
        },
      });

      logger.info("Memory stored successfully", {
        conversationId: result.conversationId,
        memoryId: result.memoryId,
      });

      res.json({
        success: true,
        memory_id: result.memoryId || "",
        conversation_id: result.conversationId || "",
        facts_extracted: result.extractedFacts?.length || 0,
        storage_location: "convex"
      });
    } catch (error) {
      logger.error("Error storing memory", {
        error: error.message,
        stack: error.stack,
      });
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /api/memory/recall
   * Semantic search for relevant memories
   */
  router.post("/recall", async (req, res) => {
    try {
      const {
        userId,
        query,
        limit = 10,
        contextId,
        participantId,
        minImportance,
        startDate,
        endDate,
      } = req.body;

      // Validation
      if (!userId || !query) {
        return res.status(400).json({
          success: false,
          error: "userId and query are required",
        });
      }

      // Generate query embedding
      const embedding = await generateEmbedding(query);

      logger.info("Recalling memories", {
        userId,
        query: query.substring(0, 50),
        limit,
      });

      // Query multiple Cortex layers for comprehensive results
      logger.info("Querying all Cortex layers", { userId, query, limit });
      
      const layerResults = {
        vector: [],
        facts: [],
        conversations: []
      };
      
      // Layer 2: Vector semantic search (primary)
      try {
        const vectorResults = await cortex.memory.search(userId, query, {
          limit: parseInt(limit)
        });
        layerResults.vector = vectorResults || [];
        logger.info(`Layer 2 (Vector): ${layerResults.vector.length} results`);
      } catch (error) {
        logger.error("Vector search failed:", error.message);
      }
      
      // Layer 1: Direct conversation search (if available)
      try {
        const convos = await cortex.conversations.list(userId, {
          limit: parseInt(limit)
        });
        layerResults.conversations = convos || [];
        logger.info(`Layer 1 (ACID): ${layerResults.conversations.length} conversations`);
      } catch (error) {
        logger.debug("Conversation list not available:", error.message);
      }
      
      // Layer 3: Facts search (if facts exist)
      try {
        const facts = await cortex.facts.list({
          memorySpaceId: userId,
          limit: Math.min(parseInt(limit), 10)
        });
        layerResults.facts = facts || [];
        logger.info(`Layer 3 (Facts): ${layerResults.facts.length} facts`);
      } catch (error) {
        logger.debug("Facts search not available:", error.message);
      }

      // Combine and format all results with layer attribution
      const allMemories = [];
      
      // Add vector results
      layerResults.vector.forEach(m => {
        allMemories.push({
          text: m.content || m.text || "",
          similarity: m.similarity || 0.85,
          timestamp: new Date(m.createdAt || m._creationTime).toISOString(),
          conversation_id: m.conversationRef?.conversationId || "",
          memory_id: m.memoryId || m._id,
          layer: "Vector (L2)",
          metadata: m.metadata || {}
        });
      });
      
      // Add facts as memories
      layerResults.facts.forEach(f => {
        allMemories.push({
          text: `FACT: ${f.content || f.value || JSON.stringify(f)}`,
          similarity: 0.90, // Facts are highly relevant
          timestamp: new Date(f.createdAt || f._creationTime).toISOString(),
          conversation_id: "",
          memory_id: f.factId || f._id,
          layer: "Facts (L3)",
          metadata: { factType: f.factType || 'extracted' }
        });
      });

      logger.info("Total memories across all layers", {
        userId,
        vector: layerResults.vector.length,
        facts: layerResults.facts.length,
        conversations: layerResults.conversations.length,
        total: allMemories.length
      });

      res.json({
        success: true,
        memories: allMemories,
        count: allMemories.length,
        layerBreakdown: {
          "Layer 1 (ACID)": layerResults.conversations.length,
          "Layer 2 (Vector)": layerResults.vector.length,
          "Layer 3 (Facts)": layerResults.facts.length,
          "Layer 4 (Graph)": 0  // Not implemented in this proof
        }
      });
    } catch (error) {
      logger.error("Error recalling memories", {
        error: error.message,
        stack: error.stack,
      });
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /api/memory/update-response
   * Update conversation with agent response after LLM generation
   */
  router.post("/update-response", async (req, res) => {
    try {
      const { conversationId, agentResponse } = req.body;

      // Validation
      if (!conversationId || !agentResponse) {
        return res.status(400).json({
          success: false,
          error: "conversationId and agentResponse are required",
        });
      }

      logger.info("Updating conversation response", { conversationId });

      // Update in Cortex
      await cortex.conversations.update({
        conversationId,
        agentResponse,
      });

      logger.info("Conversation updated", { conversationId });

      res.json({ success: true });
    } catch (error) {
      logger.error("Error updating conversation", {
        error: error.message,
        stack: error.stack,
      });
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * DELETE /api/memory/forget
   * Delete a memory with optional cascade to facts and conversation
   */
  router.delete("/forget", async (req, res) => {
    try {
      const { memorySpaceId, memoryId, deleteFacts, deleteConversation } =
        req.body;

      // Validation
      if (!memorySpaceId || !memoryId) {
        return res.status(400).json({
          success: false,
          error: "memorySpaceId and memoryId are required",
        });
      }

      logger.info("Forgetting memory", { memorySpaceId, memoryId });

      const result = await cortex.memory.forget(memorySpaceId, memoryId, {
        deleteFacts: deleteFacts !== undefined ? deleteFacts : true,
        deleteConversation: deleteConversation || false,
      });

      logger.info("Memory forgotten", {
        memoryId,
        factsDeleted: result.factsDeleted,
      });

      res.json({
        success: true,
        memoryDeleted: result.memoryDeleted,
        factsDeleted: result.factsDeleted,
        conversationDeleted: result.conversationDeleted,
      });
    } catch (error) {
      logger.error("Error forgetting memory", {
        error: error.message,
        stack: error.stack,
      });
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * DELETE /api/memory/clear/:userId
   * Clear all memories for a user
   */
  router.delete("/clear/:userId", async (req, res) => {
    try {
      const { userId } = req.params;

      logger.info("Clearing all memories for user", { userId });

      // Call Cortex to delete all user memories
      // Note: Cortex SDK may not have a direct "delete all" method
      // This is a placeholder for GDPR compliance functionality
      
      // For demo, just return success
      // In production, implement: await cortex.users.deleteAllData(userId)
      
      res.json({
        success: true,
        message: `All memories cleared for user ${userId}`,
        userId,
        note: "Demo mode - actual deletion not implemented"
      });
    } catch (error) {
      logger.error("Error clearing memories", {
        error: error.message,
        stack: error.stack,
      });
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  return router;
}

export default createMemoryRoutes;
