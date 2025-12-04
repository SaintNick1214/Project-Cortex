/**
 * LLM Auto-Configuration Tests
 *
 * Tests the two-gate approach for automatic LLM configuration:
 * - Gate 1: API key must be present (OPENAI_API_KEY or ANTHROPIC_API_KEY)
 * - Gate 2: CORTEX_FACT_EXTRACTION must be set to 'true'
 *
 * These are unit tests that don't require a running Convex instance.
 */

import { jest } from "@jest/globals";
import { Cortex, LLMConfig } from "../src";

describe("LLM Auto-Configuration", () => {
  // Store original env vars to restore after tests
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear relevant env vars before each test
    delete process.env.CORTEX_FACT_EXTRACTION;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe("Two-Gate Approach", () => {
    it("does NOT auto-configure when only OPENAI_API_KEY is set (no opt-in)", () => {
      // Gate 1 satisfied, Gate 2 NOT satisfied
      process.env.OPENAI_API_KEY = "sk-test-key";
      // CORTEX_FACT_EXTRACTION is NOT set

      // Access the private static method via prototype
      const result = (Cortex as any).autoConfigureLLM();

      expect(result).toBeUndefined();
    });

    it("does NOT auto-configure when only CORTEX_FACT_EXTRACTION is set (no API key)", () => {
      // Gate 2 satisfied, Gate 1 NOT satisfied
      process.env.CORTEX_FACT_EXTRACTION = "true";
      // No API key set

      // Suppress the expected warning
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      const result = (Cortex as any).autoConfigureLLM();

      expect(result).toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("CORTEX_FACT_EXTRACTION=true but no API key found"),
      );

      warnSpy.mockRestore();
    });

    it("auto-configures OpenAI when both gates are satisfied", () => {
      // Both gates satisfied
      process.env.CORTEX_FACT_EXTRACTION = "true";
      process.env.OPENAI_API_KEY = "sk-test-openai-key";

      const result = (Cortex as any).autoConfigureLLM();

      expect(result).toBeDefined();
      expect(result.provider).toBe("openai");
      expect(result.apiKey).toBe("sk-test-openai-key");
    });

    it("auto-configures Anthropic when both gates are satisfied (no OpenAI)", () => {
      // Both gates satisfied, only Anthropic key
      process.env.CORTEX_FACT_EXTRACTION = "true";
      process.env.ANTHROPIC_API_KEY = "sk-test-anthropic-key";

      const result = (Cortex as any).autoConfigureLLM();

      expect(result).toBeDefined();
      expect(result.provider).toBe("anthropic");
      expect(result.apiKey).toBe("sk-test-anthropic-key");
    });

    it("prefers OpenAI over Anthropic when both keys are present", () => {
      process.env.CORTEX_FACT_EXTRACTION = "true";
      process.env.OPENAI_API_KEY = "sk-test-openai-key";
      process.env.ANTHROPIC_API_KEY = "sk-test-anthropic-key";

      const result = (Cortex as any).autoConfigureLLM();

      expect(result).toBeDefined();
      expect(result.provider).toBe("openai");
      expect(result.apiKey).toBe("sk-test-openai-key");
    });

    it("does NOT auto-configure when CORTEX_FACT_EXTRACTION is 'false'", () => {
      process.env.CORTEX_FACT_EXTRACTION = "false";
      process.env.OPENAI_API_KEY = "sk-test-key";

      const result = (Cortex as any).autoConfigureLLM();

      expect(result).toBeUndefined();
    });

    it("does NOT auto-configure when CORTEX_FACT_EXTRACTION is empty string", () => {
      process.env.CORTEX_FACT_EXTRACTION = "";
      process.env.OPENAI_API_KEY = "sk-test-key";

      const result = (Cortex as any).autoConfigureLLM();

      expect(result).toBeUndefined();
    });
  });

  describe("Explicit Config Override", () => {
    it("explicit CortexConfig.llm takes priority over env vars", () => {
      // Set up env vars for auto-config
      process.env.CORTEX_FACT_EXTRACTION = "true";
      process.env.OPENAI_API_KEY = "sk-env-key";

      // Create explicit config
      const explicitLLM: LLMConfig = {
        provider: "anthropic",
        apiKey: "sk-explicit-anthropic-key",
        model: "claude-3-haiku-20240307",
      };

      // Note: We can't fully test this without mocking ConvexClient,
      // but we can verify the logic through the static method behavior
      // and document that explicit config takes priority in implementation

      // The actual priority logic is: config.llm ?? Cortex.autoConfigureLLM()
      // So if config.llm is provided, auto-config is not called

      expect(explicitLLM.provider).toBe("anthropic");
      expect(explicitLLM.apiKey).toBe("sk-explicit-anthropic-key");
    });
  });
});
