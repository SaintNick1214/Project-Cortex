/**
 * Facts Operations Routes
 * Handles facts extraction and querying
 */

import express from "express";
import logger from "../utils/logger.js";

const router = express.Router();

/**
 * Initialize routes with Cortex instance
 */
export function createFactsRoutes(cortex) {
  /**
   * GET /api/facts/:memorySpaceId
   * Query facts for a memory space
   */
  router.get("/:memorySpaceId", async (req, res) => {
    try {
      const { memorySpaceId } = req.params;
      const { contextId, factType, limit = 50 } = req.query;

      logger.debug("Querying facts", { memorySpaceId, contextId, factType });

      const facts = await cortex.facts.list({
        memorySpaceId,
        contextId,
        factType,
        limit: parseInt(limit),
      });

      res.json({
        success: true,
        facts,
        count: facts.length,
      });
    } catch (error) {
      logger.error("Error querying facts", {
        error: error.message,
        memorySpaceId: req.params.memorySpaceId,
      });
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /api/facts/extract
   * Manually extract facts from text
   */
  router.post("/extract", async (req, res) => {
    try {
      const {
        content,
        memorySpaceId,
        extractorType = "llm",
        metadata,
      } = req.body;

      // Validation
      if (!content || !memorySpaceId) {
        return res.status(400).json({
          success: false,
          error: "content and memorySpaceId are required",
        });
      }

      logger.info("Extracting facts", {
        memorySpaceId,
        contentLength: content.length,
        extractorType,
      });

      const facts = await cortex.facts.extract({
        content,
        memorySpaceId,
        extractorType,
        metadata: metadata || {},
      });

      logger.info("Facts extracted", {
        memorySpaceId,
        count: facts.length,
      });

      res.json({
        success: true,
        facts,
        count: facts.length,
      });
    } catch (error) {
      logger.error("Error extracting facts", {
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
   * POST /api/facts/query
   * Query facts with specific filters
   */
  router.post("/query", async (req, res) => {
    try {
      const {
        memorySpaceId,
        entity,
        attribute,
        value,
        factType,
        limit = 50,
      } = req.body;

      // Validation
      if (!memorySpaceId) {
        return res.status(400).json({
          success: false,
          error: "memorySpaceId is required",
        });
      }

      logger.debug("Querying facts with filters", {
        memorySpaceId,
        entity,
        factType,
      });

      const facts = await cortex.facts.query({
        memorySpaceId,
        entity,
        attribute,
        value,
        factType,
        limit: parseInt(limit),
      });

      res.json({
        success: true,
        facts,
        count: facts.length,
      });
    } catch (error) {
      logger.error("Error querying facts", {
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

export default createFactsRoutes;
