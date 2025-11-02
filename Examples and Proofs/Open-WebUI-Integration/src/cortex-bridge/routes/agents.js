/**
 * Agent Registry Routes
 * Handles agent registration and management
 */

import express from 'express';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * Initialize routes with Cortex instance
 */
export function createAgentRoutes(cortex) {
  /**
   * POST /api/agents/register
   * Register an AI agent
   */
  router.post('/register', async (req, res) => {
    try {
      const { agentId, name, capabilities, metadata } = req.body;

      // Validation
      if (!agentId || !name) {
        return res.status(400).json({
          success: false,
          error: 'agentId and name are required'
        });
      }

      logger.info('Registering agent', { agentId, name });

      await cortex.agents.register({
        agentId,
        name,
        capabilities: capabilities || [],
        metadata: metadata || {}
      });

      logger.info('Agent registered', { agentId });

      res.json({
        success: true,
        agentId
      });
    } catch (error) {
      logger.error('Error registering agent', {
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
   * GET /api/agents
   * List all registered agents
   */
  router.get('/', async (req, res) => {
    try {
      logger.debug('Listing agents');

      const agents = await cortex.agents.list();

      res.json({
        success: true,
        agents
      });
    } catch (error) {
      logger.error('Error listing agents', {
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
   * GET /api/agents/:agentId
   * Get agent details
   */
  router.get('/:agentId', async (req, res) => {
    try {
      const { agentId } = req.params;

      logger.debug('Getting agent', { agentId });

      const agent = await cortex.agents.get(agentId);

      if (!agent) {
        return res.status(404).json({
          success: false,
          error: 'Agent not found'
        });
      }

      res.json({
        success: true,
        agent
      });
    } catch (error) {
      logger.error('Error getting agent', {
        error: error.message,
        agentId: req.params.agentId
      });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * DELETE /api/agents/:agentId
   * Unregister agent with optional cascade deletion
   */
  router.delete('/:agentId', async (req, res) => {
    try {
      const { agentId } = req.params;
      const { cascade = false, verify = true } = req.body;

      logger.warn('Unregistering agent', { agentId, cascade });

      const result = await cortex.agents.unregister(agentId, {
        cascade,
        verify
      });

      logger.info('Agent unregistered', {
        agentId,
        totalDeleted: result.totalDeleted
      });

      res.json({
        success: true,
        result
      });
    } catch (error) {
      logger.error('Error unregistering agent', {
        error: error.message,
        agentId: req.params.agentId
      });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
}

export default createAgentRoutes;

