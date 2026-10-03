/**
 * LLM Client Module for Automatic Fact Extraction
 *
 * Provides a unified interface for calling OpenAI and Anthropic LLMs
 * to extract facts from conversations. Uses require() with import() fallback
 * to support both CJS (including Jest) and ESM environments.
 */

import type { LLMConfig } from "../index.js";
import {
  resolveFactExtractionModel,
  resolveConflictResolutionModel,
} from "../config.js";

/**
 * Helper to load OpenAI SDK in both CJS and ESM environments.
 * Uses require() first for CJS/Jest compatibility, falls back to dynamic import for ESM.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadOpenAI(): Promise<any> {
  // Try require() first - works in CJS and Jest without --experimental-vm-modules
  if (typeof require !== "undefined") {
    try {
      const mod = require("openai");
      return mod.default || mod;
    } catch {
      // require() failed, fall through to dynamic import
    }
  }

  // Fall back to dynamic import for pure ESM environments
  return (await import("openai")).default;
}

/**
 * Helper to load Anthropic SDK in both CJS and ESM environments.
 * Uses require() first for CJS/Jest compatibility, falls back to dynamic import for ESM.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadAnthropic(): Promise<any> {
  // Try require() first - works in CJS and Jest without --experimental-vm-modules
  if (typeof require !== "undefined") {
    try {
      const mod = require("@anthropic-ai/sdk");
      return mod.default || mod;
    } catch {
      // require() failed, fall through to dynamic import
    }
  }

  // Fall back to dynamic import for pure ESM environments
  return (await import("@anthropic-ai/sdk")).default;
}

import { EXTRACTION_SYSTEM_PROMPT, buildExtractionPrompt, parseFactsResponse } from "../domain/extraction.js";
import type { ExtractedFact } from "../domain/extraction.js";
export type { ExtractedEntity, ExtractedRelation, ExtractedFact } from "../domain/extraction.js";

/**
 * LLM Client interface for fact extraction and general completion
 */
export interface LLMClient {
  /**
   * Extract facts from a conversation exchange
   */
  extractFacts(
    userMessage: string,
    agentResponse: string,
  ): Promise<ExtractedFact[] | null>;

  /**
   * General completion for belief revision conflict resolution
   * Optional - required for belief revision feature
   */
  complete?(options: {
    system: string;
    prompt: string;
    model?: string;
    responseFormat?: "json" | "text";
  }): Promise<string>;
}

/**
 * OpenAI LLM Client implementation
 */
class OpenAIClient implements LLMClient {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  async extractFacts(
    userMessage: string,
    agentResponse: string,
  ): Promise<ExtractedFact[] | null> {
    try {
      // Use helper that prefers require() for CJS/Jest compatibility
      const OpenAI = await loadOpenAI();

      const client = new OpenAI({ apiKey: this.config.apiKey });

      // Use centralized model resolution with proper fallback chain
      const model = resolveFactExtractionModel(this.config.model, "openai");

      // Build request options - some models don't support all parameters
      // o1 models don't support temperature, max_tokens, or response_format
      // gpt-5 models use max_completion_tokens instead of max_tokens
      const isO1Model = model.startsWith("o1");
      const isGpt5Model = model.startsWith("gpt-5");

      const messages = [
        { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
        {
          role: "user",
          content: buildExtractionPrompt(userMessage, agentResponse),
        },
      ];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let response: any;

      if (isO1Model) {
        response = await client.chat.completions.create({
          model,
          messages,
        });
      } else if (isGpt5Model) {
        // GPT-5 base models (gpt-5, gpt-5-nano) have issues with max_completion_tokens
        // but work reliably with response_format: json_object
        // gpt-5.1+ work with all params but we use consistent handling
        response = await client.chat.completions.create({
          model,
          messages,
          response_format: { type: "json_object" },
        });
      } else {
        response = await client.chat.completions.create({
          model,
          messages,
          temperature: this.config.temperature ?? 0.1,
          max_tokens: this.config.maxTokens ?? 1000,
          response_format: { type: "json_object" },
        });
      }

      const content = response.choices?.[0]?.message?.content;
      if (!content) {
        console.warn("[Cortex LLM] OpenAI returned empty response");
        return null;
      }

      return parseFactsResponse(content);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("Cannot find module")
      ) {
        console.error(
          "[Cortex LLM] OpenAI SDK not installed. Run: npm install openai",
        );
      } else {
        console.error("[Cortex LLM] OpenAI extraction failed:", error);
      }
      return null;
    }
  }

  /**
   * General completion for belief revision conflict resolution
   */
  async complete(options: {
    system: string;
    prompt: string;
    model?: string;
    responseFormat?: "json" | "text";
  }): Promise<string> {
    // Use helper that prefers require() for CJS/Jest compatibility
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const OpenAI = await loadOpenAI();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const client = new OpenAI({ apiKey: this.config.apiKey });

    // Use centralized model resolution for conflict resolution
    // options.model takes priority (per-call override), then falls back to config/env/default
    const model = options.model || resolveConflictResolutionModel(this.config.model, "openai");

    // Build request options - some models don't support all parameters
    // o1 models don't support temperature, max_tokens, or response_format
    // gpt-5 models use max_completion_tokens instead of max_tokens
    const isO1Model = model.startsWith("o1");
    const isGpt5Model = model.startsWith("gpt-5");

    const messages = [
      { role: "system", content: options.system },
      { role: "user", content: options.prompt },
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let response: any;

    if (isO1Model) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      response = await client.chat.completions.create({
        model,
        messages,
      });
    } else if (isGpt5Model) {
      // GPT-5 base models have issues with max_completion_tokens alone
      // Use response_format for reliable JSON output
      const requestOptions: Record<string, unknown> = {
        model,
        messages,
      };

      if (options.responseFormat === "json") {
        requestOptions.response_format = { type: "json_object" };
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      response = await client.chat.completions.create(requestOptions);
    } else {
      const requestOptions: Record<string, unknown> = {
        model,
        messages,
        temperature: this.config.temperature ?? 0.1,
        max_tokens: this.config.maxTokens ?? 2000,
      };

      if (options.responseFormat === "json") {
        requestOptions.response_format = { type: "json_object" };
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      response = await client.chat.completions.create(requestOptions);
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("[Cortex LLM] OpenAI returned empty response");
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return content;
  }
}

/**
 * Anthropic LLM Client implementation
 */
class AnthropicClient implements LLMClient {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  async extractFacts(
    userMessage: string,
    agentResponse: string,
  ): Promise<ExtractedFact[] | null> {
    try {
      // Use helper that prefers require() for CJS/Jest compatibility
      const Anthropic = await loadAnthropic();

      const client = new Anthropic({ apiKey: this.config.apiKey });

      // Use centralized model resolution with proper fallback chain
      const model = resolveFactExtractionModel(this.config.model, "anthropic");

      // Anthropic uses tool_use for structured JSON output
      const response = await client.messages.create({
        model,
        max_tokens: this.config.maxTokens ?? 1000,
        system: EXTRACTION_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content:
              buildExtractionPrompt(userMessage, agentResponse) +
              "\n\nRespond with ONLY the JSON object, no other text.",
          },
        ],
        temperature: this.config.temperature ?? 0.1,
      });

      // Extract text content from response
      const textBlock = response.content.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (block: any) => block.type === "text",
      );
      if (!textBlock || textBlock.type !== "text") {
        console.warn("[Cortex LLM] Anthropic returned no text content");
        return null;
      }

      return parseFactsResponse(textBlock.text);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("Cannot find module")
      ) {
        console.error(
          "[Cortex LLM] Anthropic SDK not installed. Run: npm install @anthropic-ai/sdk",
        );
      } else {
        console.error("[Cortex LLM] Anthropic extraction failed:", error);
      }
      return null;
    }
  }

  /**
   * General completion for belief revision conflict resolution
   */
  async complete(options: {
    system: string;
    prompt: string;
    model?: string;
    responseFormat?: "json" | "text";
  }): Promise<string> {
    // Use helper that prefers require() for CJS/Jest compatibility
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const Anthropic = await loadAnthropic();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const client = new Anthropic({ apiKey: this.config.apiKey });

    // Use centralized model resolution for conflict resolution
    // options.model takes priority (per-call override), then falls back to config/env/default
    const model = options.model || resolveConflictResolutionModel(this.config.model, "anthropic");

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const response = await client.messages.create({
      model,
      max_tokens: this.config.maxTokens ?? 2000,
      system: options.system,
      messages: [
        {
          role: "user",
          content:
            options.responseFormat === "json"
              ? options.prompt +
                "\n\nRespond with ONLY a JSON object, no other text."
              : options.prompt,
        },
      ],
      temperature: this.config.temperature ?? 0.1,
    });

    // Extract text content from response
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const textBlock = response.content.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      (block: any) => block.type === "text",
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("[Cortex LLM] Anthropic returned no text content");
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    return textBlock.text;
  }
}

/**
 * Create an LLM client based on the provided configuration
 */
export function createLLMClient(config: LLMConfig): LLMClient | null {
  switch (config.provider) {
    case "openai":
      return new OpenAIClient(config);
    case "anthropic":
      return new AnthropicClient(config);
    case "custom":
      // Custom provider requires extractFacts function to be provided
      if (config.extractFacts) {
        return {
          extractFacts: config.extractFacts,
        };
      }
      console.warn(
        "[Cortex LLM] Custom provider requires extractFacts function in config",
      );
      return null;
    default:
      console.warn(`[Cortex LLM] Unknown provider: ${config.provider}`);
      return null;
  }
}

/**
 * Check if LLM SDK is available for the given provider
 */
export async function isLLMAvailable(
  provider: "openai" | "anthropic",
): Promise<boolean> {
  try {
    if (provider === "openai") {
      await loadOpenAI();
      return true;
    } else if (provider === "anthropic") {
      await loadAnthropic();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
