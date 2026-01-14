/**
 * Unit Tests: Model Resolution Configuration
 *
 * Tests the model resolution functions for different LLM usage areas.
 * These tests verify the configuration hierarchy:
 * 1. Per-call config (highest priority)
 * 2. Environment variables
 * 3. Provider-specific defaults
 */

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";

describe("Model Resolution Configuration", () => {
  // Store original env vars to restore after tests
  const originalEnv: Record<string, string | undefined> = {};
  const envVars = [
    "CORTEX_FACT_EXTRACTION_MODEL",
    "CORTEX_CONFLICT_RESOLUTION_MODEL",
    "CORTEX_EMBEDDING_MODEL",
  ];

  beforeEach(() => {
    // Save original env vars
    for (const key of envVars) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
    // Clear module cache to re-evaluate env vars
    jest.resetModules();
  });

  afterEach(() => {
    // Restore original env vars
    for (const key of envVars) {
      if (originalEnv[key] !== undefined) {
        process.env[key] = originalEnv[key];
      } else {
        delete process.env[key];
      }
    }
    jest.resetModules();
  });

  describe("MODEL_DEFAULTS", () => {
    it("has correct defaults for OpenAI fact extraction", async () => {
      const { MODEL_DEFAULTS } = await import("../../src/config");

      expect(MODEL_DEFAULTS.factExtraction.openai).toBe("gpt-4o-2024-11-20");
    });

    it("has correct defaults for Anthropic fact extraction", async () => {
      const { MODEL_DEFAULTS } = await import("../../src/config");

      expect(MODEL_DEFAULTS.factExtraction.anthropic).toBe(
        "claude-3-haiku-20240307",
      );
    });

    it("has correct defaults for OpenAI conflict resolution", async () => {
      const { MODEL_DEFAULTS } = await import("../../src/config");

      expect(MODEL_DEFAULTS.conflictResolution.openai).toBe("gpt-4o-2024-11-20");
    });

    it("has correct defaults for Anthropic conflict resolution", async () => {
      const { MODEL_DEFAULTS } = await import("../../src/config");

      expect(MODEL_DEFAULTS.conflictResolution.anthropic).toBe(
        "claude-3-haiku-20240307",
      );
    });

    it("has correct default for embedding model", async () => {
      const { MODEL_DEFAULTS } = await import("../../src/config");

      expect(MODEL_DEFAULTS.embedding).toBe("text-embedding-3-small");
    });
  });

  describe("resolveFactExtractionModel", () => {
    it("returns configModel when provided", async () => {
      const { resolveFactExtractionModel } = await import("../../src/config");

      const result = resolveFactExtractionModel("gpt-4-turbo", "openai");

      expect(result).toBe("gpt-4-turbo");
    });

    it("returns env var when configModel not provided", async () => {
      process.env.CORTEX_FACT_EXTRACTION_MODEL = "gpt-4o";
      const { resolveFactExtractionModel } = await import("../../src/config");

      const result = resolveFactExtractionModel(undefined, "openai");

      expect(result).toBe("gpt-4o");
    });

    it("returns OpenAI default when no config or env var", async () => {
      const { resolveFactExtractionModel } = await import("../../src/config");

      const result = resolveFactExtractionModel(undefined, "openai");

      expect(result).toBe("gpt-4o-2024-11-20");
    });

    it("returns Anthropic default when no config or env var", async () => {
      const { resolveFactExtractionModel } = await import("../../src/config");

      const result = resolveFactExtractionModel(undefined, "anthropic");

      expect(result).toBe("claude-3-haiku-20240307");
    });

    it("defaults to OpenAI when provider not specified", async () => {
      const { resolveFactExtractionModel } = await import("../../src/config");

      const result = resolveFactExtractionModel();

      expect(result).toBe("gpt-4o-2024-11-20");
    });

    it("configModel takes priority over env var", async () => {
      process.env.CORTEX_FACT_EXTRACTION_MODEL = "gpt-4o";
      const { resolveFactExtractionModel } = await import("../../src/config");

      const result = resolveFactExtractionModel("gpt-4-turbo", "openai");

      expect(result).toBe("gpt-4-turbo");
    });
  });

  describe("resolveConflictResolutionModel", () => {
    it("returns configModel when provided", async () => {
      const { resolveConflictResolutionModel } = await import("../../src/config");

      const result = resolveConflictResolutionModel("gpt-4-turbo", "openai");

      expect(result).toBe("gpt-4-turbo");
    });

    it("returns CORTEX_CONFLICT_RESOLUTION_MODEL env var when set", async () => {
      process.env.CORTEX_CONFLICT_RESOLUTION_MODEL = "gpt-4o";
      const { resolveConflictResolutionModel } = await import("../../src/config");

      const result = resolveConflictResolutionModel(undefined, "openai");

      expect(result).toBe("gpt-4o");
    });

    it("falls back to CORTEX_FACT_EXTRACTION_MODEL when CORTEX_CONFLICT_RESOLUTION_MODEL not set", async () => {
      process.env.CORTEX_FACT_EXTRACTION_MODEL = "gpt-4o-mini";
      const { resolveConflictResolutionModel } = await import("../../src/config");

      const result = resolveConflictResolutionModel(undefined, "openai");

      expect(result).toBe("gpt-4o-mini");
    });

    it("returns OpenAI default when no config or env vars", async () => {
      const { resolveConflictResolutionModel } = await import("../../src/config");

      const result = resolveConflictResolutionModel(undefined, "openai");

      expect(result).toBe("gpt-4o-2024-11-20");
    });

    it("returns Anthropic default when no config or env vars", async () => {
      const { resolveConflictResolutionModel } = await import("../../src/config");

      const result = resolveConflictResolutionModel(undefined, "anthropic");

      expect(result).toBe("claude-3-haiku-20240307");
    });

    it("CORTEX_CONFLICT_RESOLUTION_MODEL takes priority over CORTEX_FACT_EXTRACTION_MODEL", async () => {
      process.env.CORTEX_FACT_EXTRACTION_MODEL = "gpt-4o-mini";
      process.env.CORTEX_CONFLICT_RESOLUTION_MODEL = "gpt-4o";
      const { resolveConflictResolutionModel } = await import("../../src/config");

      const result = resolveConflictResolutionModel(undefined, "openai");

      expect(result).toBe("gpt-4o");
    });

    it("configModel takes priority over all env vars", async () => {
      process.env.CORTEX_FACT_EXTRACTION_MODEL = "gpt-4o-mini";
      process.env.CORTEX_CONFLICT_RESOLUTION_MODEL = "gpt-4o";
      const { resolveConflictResolutionModel } = await import("../../src/config");

      const result = resolveConflictResolutionModel("gpt-4-turbo", "openai");

      expect(result).toBe("gpt-4-turbo");
    });
  });

  describe("resolveEmbeddingModel", () => {
    it("returns configModel when provided", async () => {
      const { resolveEmbeddingModel } = await import("../../src/config");

      const result = resolveEmbeddingModel("text-embedding-3-large");

      expect(result).toBe("text-embedding-3-large");
    });

    it("returns env var when configModel not provided", async () => {
      process.env.CORTEX_EMBEDDING_MODEL = "text-embedding-ada-002";
      const { resolveEmbeddingModel } = await import("../../src/config");

      const result = resolveEmbeddingModel();

      expect(result).toBe("text-embedding-ada-002");
    });

    it("returns default when no config or env var", async () => {
      const { resolveEmbeddingModel } = await import("../../src/config");

      const result = resolveEmbeddingModel();

      expect(result).toBe("text-embedding-3-small");
    });

    it("configModel takes priority over env var", async () => {
      process.env.CORTEX_EMBEDDING_MODEL = "text-embedding-ada-002";
      const { resolveEmbeddingModel } = await import("../../src/config");

      const result = resolveEmbeddingModel("text-embedding-3-large");

      expect(result).toBe("text-embedding-3-large");
    });
  });

  describe("Configuration Hierarchy", () => {
    it("follows hierarchy: configModel > env > defaults for fact extraction", async () => {
      // Set env var
      process.env.CORTEX_FACT_EXTRACTION_MODEL = "gpt-4o";

      const { resolveFactExtractionModel } = await import("../../src/config");

      // Config should override env var
      expect(resolveFactExtractionModel("gpt-4-turbo", "openai")).toBe(
        "gpt-4-turbo",
      );

      // Without config, should use env var
      expect(resolveFactExtractionModel(undefined, "openai")).toBe("gpt-4o");
    });

    it("follows hierarchy: configModel > CONFLICT_RESOLUTION env > FACT_EXTRACTION env > defaults", async () => {
      // Set both env vars
      process.env.CORTEX_FACT_EXTRACTION_MODEL = "gpt-4o-mini";
      process.env.CORTEX_CONFLICT_RESOLUTION_MODEL = "gpt-4o";

      const { resolveConflictResolutionModel } = await import("../../src/config");

      // Config should override all
      expect(resolveConflictResolutionModel("gpt-4-turbo", "openai")).toBe(
        "gpt-4-turbo",
      );

      // Without config, should use CONFLICT_RESOLUTION env var
      expect(resolveConflictResolutionModel(undefined, "openai")).toBe("gpt-4o");

      // Clear CONFLICT_RESOLUTION env var, should fall back to FACT_EXTRACTION
      delete process.env.CORTEX_CONFLICT_RESOLUTION_MODEL;
      jest.resetModules();
      const { resolveConflictResolutionModel: resolve2 } = await import(
        "../../src/config"
      );
      expect(resolve2(undefined, "openai")).toBe("gpt-4o-mini");
    });

    it("follows hierarchy: configModel > env > defaults for embedding", async () => {
      // Set env var
      process.env.CORTEX_EMBEDDING_MODEL = "text-embedding-ada-002";

      const { resolveEmbeddingModel } = await import("../../src/config");

      // Config should override env var
      expect(resolveEmbeddingModel("text-embedding-3-large")).toBe(
        "text-embedding-3-large",
      );

      // Without config, should use env var
      expect(resolveEmbeddingModel()).toBe("text-embedding-ada-002");
    });
  });
});
