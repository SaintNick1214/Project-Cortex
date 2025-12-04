/**
 * LLM Client Module for Automatic Fact Extraction
 *
 * Provides a unified interface for calling OpenAI and Anthropic LLMs
 * to extract facts from conversations. Uses dynamic imports to avoid
 * requiring LLM SDKs as hard dependencies.
 */

import type { LLMConfig } from "../index.js";

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
 * LLM Client interface for fact extraction
 */
export interface LLMClient {
  extractFacts(
    userMessage: string,
    agentResponse: string,
  ): Promise<ExtractedFact[] | null>;
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
        return typeof fact.fact === "string" && typeof fact.factType === "string";
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
function normalizeFactType(
  type: string,
): ExtractedFact["factType"] {
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
      // Dynamic import to avoid requiring openai as hard dependency
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const OpenAI = (await import("openai")).default as any;

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
        { role: "user", content: buildExtractionPrompt(userMessage, agentResponse) },
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
      // Dynamic import to avoid requiring anthropic as hard dependency
      // @ts-expect-error - Dynamic import of optional dependency
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Anthropic = (await import("@anthropic-ai/sdk")).default as any;

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const textBlock = response.content.find((block: any) => block.type === "text");
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
      await import("openai");
      return true;
    } else if (provider === "anthropic") {
      // @ts-expect-error - Dynamic import of optional dependency
      await import("@anthropic-ai/sdk");
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
