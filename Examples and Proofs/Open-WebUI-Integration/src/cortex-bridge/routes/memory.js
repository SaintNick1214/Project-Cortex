/**
 * Memory Operations Routes
 * Handles remember, recall, and forget operations
 */

import express from 'express';
import logger from '../utils/logger.js';
import { generateEmbedding } from '../utils/embeddings.js';

const router = express.Router();

/**
 * Initialize routes with Cortex instance
 */
export function createMemoryRoutes(cortex) {
  /**
   * POST /api/memory/remember
   * Store a conversation in Cortex with automatic embedding
   */
  router.post('/remember', async (req, res) => {
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
        metadata
      } = req.body;

      // Validation
      if (!userId || !userMessage) {
        return res.status(400).json({
          success: false,
          error: 'userId and userMessage are required'
        });
      }

      // Generate embedding for semantic search
      const embedding = await generateEmbedding(userMessage);

      logger.info('Storing memory', {
        userId,
        conversationId: conversationId || 'auto-generated',
        hasResponse: !!agentResponse
      });

      // Store in Cortex
      const result = await cortex.memory.remember({
        memorySpaceId: userId,
        conversationId: conversationId || `conv-${Date.now()}`,
        userMessage,
        agentResponse: agentResponse || null,
        userId,
        embedding,
        contextId,
        participantId: participantId || 'default',
        importance: importance || 5,
        extractFacts: extractFacts !== undefined ? extractFacts : 
                      process.env.ENABLE_FACTS_EXTRACTION === 'true',
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
          source: 'openwebui'
        }
      });

      logger.info('Memory stored successfully', {
        conversationId: result.conversationId,
        memoryId: result.memoryId
      });

      res.json({
        success: true,
        conversationId: result.conversationId,
        memoryId: result.memoryId,
        extractedFacts: result.extractedFacts?.length || 0
      });
    } catch (error) {
      logger.error('Error storing memory', {
        error: error.message,
        stack: error.stack
      });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/memory/recall
   * Semantic search for relevant memories
   */
  router.post('/recall', async (req, res) => {
    try {
      const {
        userId,
        query,
        limit = 10,
        contextId,
        participantId,
        minImportance,
        startDate,
        endDate
      } = req.body;

      // Validation
      if (!userId || !query) {
        return res.status(400).json({
          success: false,
          error: 'userId and query are required'
        });
      }

      // Generate query embedding
      const embedding = await generateEmbedding(query);

      logger.info('Recalling memories', {
        userId,
        query: query.substring(0, 50),
        limit
      });

      // Recall from Cortex
      const memories = await cortex.memory.recall({
        memorySpaceId: userId,
        query,
        embedding,
        limit: parseInt(limit),
        contextId,
        participantId,
        minImportance,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        includeEmbedding: false
      });

      logger.info('Memories recalled', {
        userId,
        count: memories.length
      });

      res.json({
        success: true,
        memories,
        count: memories.length
      });
    } catch (error) {
      logger.error('Error recalling memories', {
        error: error.message,
        stack: error.stack
      });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/memory/update-response
   * Update conversation with agent response after LLM generation
   */
  router.post('/update-response', async (req, res) => {
    try {
      const { conversationId, agentResponse } = req.body;

      // Validation
      if (!conversationId || !agentResponse) {
        return res.status(400).json({
          success: false,
          error: 'conversationId and agentResponse are required'
        });
      }

      logger.info('Updating conversation response', { conversationId });

      // Update in Cortex
      await cortex.conversations.update({
        conversationId,
        agentResponse
      });

      logger.info('Conversation updated', { conversationId });

      res.json({ success: true });
    } catch (error) {
      logger.error('Error updating conversation', {
        error: error.message,
        stack: error.stack
      });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * DELETE /api/memory/forget
   * Delete a memory with optional cascade to facts and conversation
   */
  router.delete('/forget', async (req, res) => {
    try {
      const { memorySpaceId, memoryId, deleteFacts, deleteConversation } = req.body;

      // Validation
      if (!memorySpaceId || !memoryId) {
        return res.status(400).json({
          success: false,
          error: 'memorySpaceId and memoryId are required'
        });
      }

      logger.info('Forgetting memory', { memorySpaceId, memoryId });

      const result = await cortex.memory.forget(memorySpaceId, memoryId, {
        deleteFacts: deleteFacts !== undefined ? deleteFacts : true,
        deleteConversation: deleteConversation || false
      });

      logger.info('Memory forgotten', {
        memoryId,
        factsDeleted: result.factsDeleted
      });

      res.json({
        success: true,
        memoryDeleted: result.memoryDeleted,
        factsDeleted: result.factsDeleted,
        conversationDeleted: result.conversationDeleted
      });
    } catch (error) {
      logger.error('Error forgetting memory', {
        error: error.message,
        stack: error.stack
      });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
}

export default createMemoryRoutes;

