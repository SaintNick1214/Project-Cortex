/**
 * User Management Routes
 * Handles user profiles and GDPR compliance
 */

import express from 'express';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * Initialize routes with Cortex instance
 */
export function createUserRoutes(cortex) {
  /**
   * POST /api/users/create
   * Create a new user profile
   */
  router.post('/create', async (req, res) => {
    try {
      const { userId, name, email, metadata } = req.body;

      // Validation
      if (!userId || !name || !email) {
        return res.status(400).json({
          success: false,
          error: 'userId, name, and email are required'
        });
      }

      logger.info('Creating user profile', { userId, name });

      await cortex.users.create({
        userId,
        name,
        email,
        metadata: metadata || {}
      });

      logger.info('User created successfully', { userId });

      res.json({ success: true, userId });
    } catch (error) {
      logger.error('Error creating user', {
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
   * GET /api/users/:userId
   * Get user profile by ID
   */
  router.get('/:userId', async (req, res) => {
    try {
      const { userId } = req.params;

      logger.debug('Fetching user profile', { userId });

      const user = await cortex.users.get(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      res.json({
        success: true,
        user
      });
    } catch (error) {
      logger.error('Error fetching user', {
        error: error.message,
        userId: req.params.userId
      });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * PUT /api/users/:userId
   * Update user profile
   */
  router.put('/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const { name, email, metadata } = req.body;

      logger.info('Updating user profile', { userId });

      const user = await cortex.users.update({
        userId,
        name,
        email,
        metadata
      });

      logger.info('User updated successfully', { userId });

      res.json({
        success: true,
        user
      });
    } catch (error) {
      logger.error('Error updating user', {
        error: error.message,
        userId: req.params.userId
      });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * DELETE /api/users/:userId
   * GDPR-compliant cascade deletion
   */
  router.delete('/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const { cascade = false, verify = true } = req.body;

      logger.warn('Deleting user (GDPR)', {
        userId,
        cascade,
        verify
      });

      const result = await cortex.users.delete(userId, {
        cascade,
        verify
      });

      logger.info('User deleted', {
        userId,
        totalDeleted: result.totalDeleted,
        layers: result.deletedLayers
      });

      res.json({
        success: true,
        result
      });
    } catch (error) {
      logger.error('Error deleting user', {
        error: error.message,
        userId: req.params.userId
      });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
}

export default createUserRoutes;

