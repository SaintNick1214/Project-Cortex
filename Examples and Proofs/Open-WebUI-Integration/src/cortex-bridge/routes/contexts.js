/**
 * Context Chain Routes
 * Handles hierarchical workflow contexts
 */

import express from 'express';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * Initialize routes with Cortex instance
 */
export function createContextRoutes(cortex) {
  /**
   * POST /api/contexts/create
   * Create a new context (root or child)
   */
  router.post('/create', async (req, res) => {
    try {
      const { name, description, memorySpaceId, parentId, metadata } = req.body;

      // Validation
      if (!name || !memorySpaceId) {
        return res.status(400).json({
          success: false,
          error: 'name and memorySpaceId are required'
        });
      }

      logger.info('Creating context', { name, memorySpaceId, parentId });

      const context = await cortex.contexts.create({
        purpose: name,
        description,
        memorySpaceId,
        parentId,
        data: metadata || {}
      });

      logger.info('Context created', { contextId: context.id });

      res.json({
        success: true,
        context
      });
    } catch (error) {
      logger.error('Error creating context', {
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
   * GET /api/contexts/:memorySpaceId
   * List all contexts for a memory space
   */
  router.get('/:memorySpaceId', async (req, res) => {
    try {
      const { memorySpaceId } = req.params;

      logger.debug('Listing contexts', { memorySpaceId });

      const contexts = await cortex.contexts.list({
        memorySpaceId
      });

      res.json({
        success: true,
        contexts
      });
    } catch (error) {
      logger.error('Error listing contexts', {
        error: error.message,
        memorySpaceId: req.params.memorySpaceId
      });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/contexts/:contextId/chain
   * Get full context chain (hierarchy)
   */
  router.get('/:contextId/chain', async (req, res) => {
    try {
      const { contextId } = req.params;

      logger.debug('Getting context chain', { contextId });

      const chain = await cortex.contexts.getChain(contextId);

      res.json({
        success: true,
        chain
      });
    } catch (error) {
      logger.error('Error getting context chain', {
        error: error.message,
        contextId: req.params.contextId
      });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * PUT /api/contexts/:contextId
   * Update context status or data
   */
  router.put('/:contextId', async (req, res) => {
    try {
      const { contextId } = req.params;
      const { status, data, description } = req.body;

      logger.info('Updating context', { contextId, status });

      const context = await cortex.contexts.update(contextId, {
        status,
        data,
        description
      });

      logger.info('Context updated', { contextId });

      res.json({
        success: true,
        context
      });
    } catch (error) {
      logger.error('Error updating context', {
        error: error.message,
        contextId: req.params.contextId
      });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * DELETE /api/contexts/:contextId
   * Delete context with optional cascade
   */
  router.delete('/:contextId', async (req, res) => {
    try {
      const { contextId } = req.params;
      const { cascadeChildren = false } = req.body;

      logger.warn('Deleting context', { contextId, cascadeChildren });

      const result = await cortex.contexts.delete(contextId, {
        cascadeChildren
      });

      logger.info('Context deleted', {
        contextId,
        deleted: result.deleted
      });

      res.json({
        success: true,
        result
      });
    } catch (error) {
      logger.error('Error deleting context', {
        error: error.message,
        contextId: req.params.contextId
      });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
}

export default createContextRoutes;

