/**
 * LLM Client Module for Automatic Fact Extraction
 *
 * Provides a unified interface for calling OpenAI and Anthropic LLMs
 * to extract facts from conversations. Uses require() with import() fallback
 * to support both CJS (including Jest) and ESM environments.
 */

import type { LLMConfig } from "../index.js";

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

/**
 * Extracted fact structure from LLM response
 */
export interface ExtractedFact {
  fact: string;
  factType:
    | "preference"
    | "identity"
    | "knowledge"
    | "relationship"
    | "event"
    | "observation"
    | "custom";
  subject?: string;
  predicate?: string;
  object?: string;
  confidence: number;
  tags?: string[];
}

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
 * Default models for each provider
 */
const DEFAULT_MODELS = {
  openai: "gpt-4o-mini",
  anthropic: "claude-3-haiku-20240307",
} as const;

/**
 * Fact extraction system prompt
 */
const EXTRACTION_SYSTEM_PROMPT = `You are a fact extraction assistant. Extract key facts from conversations that should be remembered long-term.

Guidelines:
- Focus on user preferences, attributes, decisions, events, and relationships
- Write facts in third-person, present tense (e.g., "User prefers X")
- Be specific and actionable
- One fact = one statement
- Avoid redundancy
- Only extract facts that are explicitly stated or strongly implied
- Assign confidence based on how clearly the fact was stated (0.5-1.0)

For each fact, determine the type:
- preference: User likes/dislikes, preferred tools/methods
- identity: Personal attributes, name, role, location
- knowledge: Skills, expertise, domain knowledge
- relationship: Connections to people, organizations, projects
- event: Things that happened, milestones, decisions made
- observation: General observations about user behavior
- custom: Other important facts`;

/**
 * Build the user prompt for fact extraction
 */
function buildExtractionPrompt(
  userMessage: string,
  agentResponse: string,
): string {
  return `Extract facts from this conversation:

User: ${userMessage}
Agent: ${agentResponse}

Return ONLY a JSON object with a "facts" array. Each fact should have:
- fact: The fact statement (clear, third-person, present tense)
- factType: One of "preference", "identity", "knowledge", "relationship", "event", "observation", "custom"
- confidence: Your confidence this is meaningful (0.5-1.0)
- subject: (optional) The entity the fact is about
- predicate: (optional) The relationship or action
- object: (optional) The target of the relationship
- tags: (optional) Array of relevant tags

Example response:
{
  "facts": [
    {
      "fact": "User prefers TypeScript for backend development",
      "factType": "preference",
      "confidence": 0.95,
      "subject": "User",
      "predicate": "prefers",
      "object": "TypeScript for backend",
      "tags": ["programming", "backend"]
    }
  ]
}

If no meaningful facts can be extracted, return: {"facts": []}`;
}

/**
 * Parse LLM response into ExtractedFact array
 */
function parseFactsResponse(content: string): ExtractedFact[] | null {
  try {
    // Try to extract JSON from the response (handle markdown code blocks)
    let jsonStr = content.trim();

    // Remove markdown code blocks if present
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(jsonStr);
    const facts = parsed.facts || parsed;

    if (!Array.isArray(facts)) {
      console.warn("[Cortex LLM] Invalid facts response format - not an array");
      return null;
    }

    // Validate and normalize each fact
    return facts
      .filter((f: unknown) => {
        if (typeof f !== "object" || f === null) return false;
        const fact = f as Record<string, unknown>;
        return (
          typeof fact.fact === "string" && typeof fact.factType === "string"
        );
      })
      .map((f: Record<string, unknown>) => ({
        fact: f.fact as string,
        factType: normalizeFactType(f.factType as string),
        confidence:
          typeof f.confidence === "number"
            ? Math.min(1, Math.max(0, f.confidence))
            : 0.7,
        subject: typeof f.subject === "string" ? f.subject : undefined,
        predicate: typeof f.predicate === "string" ? f.predicate : undefined,
        object: typeof f.object === "string" ? f.object : undefined,
        tags: Array.isArray(f.tags)
          ? f.tags.filter((t): t is string => typeof t === "string")
          : undefined,
      }));
  } catch (error) {
    console.warn("[Cortex LLM] Failed to parse facts response:", error);
    return null;
  }
}

/**
 * Normalize fact type to valid enum value
 */
function normalizeFactType(type: string): ExtractedFact["factType"] {
  const validTypes = [
    "preference",
    "identity",
    "knowledge",
    "relationship",
    "event",
    "observation",
    "custom",
  ];
  const normalized = type.toLowerCase().trim();
  return validTypes.includes(normalized)
    ? (normalized as ExtractedFact["factType"])
    : "custom";
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

      const model =
        this.config.model ||
        process.env.CORTEX_FACT_EXTRACTION_MODEL ||
        DEFAULT_MODELS.openai;

      // Build request options - some models don't support all parameters
      // o1 and o1-mini don't support temperature, max_tokens, or response_format
      const isO1Model = model.startsWith("o1");

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

    const model =
      options.model ||
      this.config.model ||
      process.env.CORTEX_FACT_EXTRACTION_MODEL ||
      DEFAULT_MODELS.openai;

    // Build request options - some models don't support all parameters
    const isO1Model = model.startsWith("o1");

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

      const model =
        this.config.model ||
        process.env.CORTEX_FACT_EXTRACTION_MODEL ||
        DEFAULT_MODELS.anthropic;

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

    const model =
      options.model ||
      this.config.model ||
      process.env.CORTEX_FACT_EXTRACTION_MODEL ||
      DEFAULT_MODELS.anthropic;

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
              ? options.prompt + "\n\nRespond with ONLY a JSON object, no other text."
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
