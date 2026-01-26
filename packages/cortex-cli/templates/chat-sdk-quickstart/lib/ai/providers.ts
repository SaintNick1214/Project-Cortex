import { gateway } from "@ai-sdk/gateway";
import { createOpenAI, type OpenAIProvider } from "@ai-sdk/openai";
import { createAnthropic, type AnthropicProvider } from "@ai-sdk/anthropic";
import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
  type LanguageModelV1,
} from "ai";
import { isTestEnvironment } from "../constants";

const THINKING_SUFFIX_REGEX = /-thinking$/;

// Lazy-initialized provider instances (created on first use, not module load)
let _openai: OpenAIProvider | null = null;
let _anthropic: AnthropicProvider | null = null;

/**
 * Get OpenAI provider (lazy initialization)
 */
function getOpenAIProvider(): OpenAIProvider | null {
  if (_openai) return _openai;
  
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey && !process.env.AI_GATEWAY_API_KEY) {
    _openai = createOpenAI({ apiKey });
    return _openai;
  }
  return null;
}

/**
 * Get Anthropic provider (lazy initialization)
 */
function getAnthropicProvider(): AnthropicProvider | null {
  if (_anthropic) return _anthropic;
  
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey && !process.env.AI_GATEWAY_API_KEY) {
    _anthropic = createAnthropic({ apiKey });
    return _anthropic;
  }
  return null;
}

/**
 * Check if we should use direct providers (evaluated at runtime)
 */
function shouldUseDirectProviders(): boolean {
  return !process.env.AI_GATEWAY_API_KEY && Boolean(process.env.OPENAI_API_KEY);
}

export const myProvider = isTestEnvironment
  ? (() => {
      const {
        artifactModel,
        chatModel,
        reasoningModel,
        titleModel,
      } = require("./models.mock");
      return customProvider({
        languageModels: {
          "chat-model": chatModel,
          "chat-model-reasoning": reasoningModel,
          "title-model": titleModel,
          "artifact-model": artifactModel,
        },
      });
    })()
  : null;

/**
 * Get a language model by ID.
 * Supports both AI Gateway format (provider/model) and direct provider format.
 * Falls back to OpenAI if using direct providers.
 */
export function getLanguageModel(modelId: string): LanguageModelV1 {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel(modelId);
  }

  const isReasoningModel =
    modelId.includes("reasoning") || modelId.endsWith("-thinking");

  // If using AI Gateway (no OPENAI_API_KEY or has AI_GATEWAY_API_KEY)
  if (!shouldUseDirectProviders()) {
    if (isReasoningModel) {
      const gatewayModelId = modelId.replace(THINKING_SUFFIX_REGEX, "");
      return wrapLanguageModel({
        model: gateway.languageModel(gatewayModelId),
        middleware: extractReasoningMiddleware({ tagName: "thinking" }),
      });
    }
    return gateway.languageModel(modelId);
  }

  // Using direct providers - parse the model ID (format: provider/model)
  const [providerName, ...modelParts] = modelId.split("/");
  const model = modelParts.join("/");

  const openai = getOpenAIProvider();
  const anthropic = getAnthropicProvider();

  // Map gateway model IDs to direct provider models
  if (providerName === "openai" && openai) {
    // Map gateway model names to OpenAI model names
    const modelMap: Record<string, string> = {
      "gpt-5.2": "gpt-4o",
      "gpt-4.1-mini": "gpt-4o-mini",
    };
    const openaiModel = modelMap[model] || model;
    console.log(`[AI] Using OpenAI directly: ${modelId} -> ${openaiModel}`);
    return openai(openaiModel);
  }

  if (providerName === "anthropic" && anthropic) {
    // Map gateway model names to Anthropic model names
    const modelMap: Record<string, string> = {
      "claude-haiku-4.5": "claude-3-5-haiku-latest",
      "claude-sonnet-4.5": "claude-sonnet-4-20250514",
      "claude-opus-4.5": "claude-sonnet-4-20250514", // Fallback to Sonnet
    };
    const anthropicModel = modelMap[model] || model;
    console.log(`[AI] Using Anthropic directly: ${modelId} -> ${anthropicModel}`);

    if (isReasoningModel) {
      return wrapLanguageModel({
        model: anthropic(anthropicModel),
        middleware: extractReasoningMiddleware({ tagName: "thinking" }),
      });
    }
    return anthropic(anthropicModel);
  }

  // Google, xAI, etc. - fall back to OpenAI if available
  if (openai) {
    console.warn(`[AI] Provider "${providerName}" not configured, falling back to OpenAI gpt-4o`);
    return openai("gpt-4o");
  }

  // Last resort: try gateway anyway (will fail without API key)
  console.warn(`[AI] No direct provider available, trying gateway for ${modelId}`);
  return gateway.languageModel(modelId);
}

export function getTitleModel(): LanguageModelV1 {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("title-model");
  }

  // Use OpenAI for title generation if available (fast and cheap)
  const openai = getOpenAIProvider();
  if (openai) {
    return openai("gpt-4o-mini");
  }

  return gateway.languageModel("google/gemini-2.5-flash-lite");
}

export function getArtifactModel(): LanguageModelV1 {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("artifact-model");
  }

  // Use Anthropic for artifacts if available, otherwise OpenAI
  const anthropic = getAnthropicProvider();
  if (anthropic) {
    return anthropic("claude-3-5-haiku-latest");
  }
  
  const openai = getOpenAIProvider();
  if (openai) {
    return openai("gpt-4o-mini");
  }

  return gateway.languageModel("anthropic/claude-haiku-4.5");
}
