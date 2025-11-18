/**
 * Middleware for memory context injection and user resolution
 */

import type { MemoryEntry } from "@cortexmemory/sdk";
// Prompt types handled dynamically to support all AI SDK versions
import type {
  ContextInjectionStrategy,
  CortexMemoryConfig,
  Logger,
} from "./types";

/**
 * Resolve user ID from config (handles both static string and function)
 */
export async function resolveUserId(
  config: CortexMemoryConfig,
  logger: Logger,
): Promise<string> {
  try {
    if (typeof config.userId === "function") {
      const userId = await Promise.resolve(config.userId());
      if (!userId || typeof userId !== "string") {
        throw new Error("userId function must return a non-empty string");
      }
      return userId;
    }
    return config.userId;
  } catch (error) {
    logger.error("Failed to resolve userId:", error);
    throw new Error(
      `Failed to resolve userId: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Resolve conversation ID from config or generate a new one
 */
export async function resolveConversationId(
  config: CortexMemoryConfig,
  logger: Logger,
): Promise<string> {
  try {
    if (config.conversationId) {
      if (typeof config.conversationId === "function") {
        const convId = await Promise.resolve(config.conversationId());
        if (!convId || typeof convId !== "string") {
          throw new Error(
            "conversationId function must return a non-empty string",
          );
        }
        return convId;
      }
      return config.conversationId;
    }

    // Generate new conversation ID
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `conv-${timestamp}-${random}`;
  } catch (error) {
    logger.error("Failed to resolve conversationId:", error);
    throw new Error(
      `Failed to resolve conversationId: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Build memory context string from retrieved memories
 */
export function buildMemoryContext(
  memories: MemoryEntry[],
  config: CortexMemoryConfig,
  logger: Logger,
): string {
  if (memories.length === 0) {
    logger.debug("No memories to inject");
    return "";
  }

  // Use custom context builder if provided
  if (config.customContextBuilder) {
    try {
      const context = config.customContextBuilder(memories);
      logger.debug(`Built custom context (${context.length} chars)`);
      return context;
    } catch (error) {
      logger.error("Custom context builder failed:", error);
      // Fall back to default
    }
  }

  // Default context builder
  const contextLines = memories.map((memory, index) => {
    const content =
      "content" in memory ? memory.content : memory.memory?.content || "";
    const importance =
      "metadata" in memory
        ? memory.metadata?.importance || 50
        : memory.memory?.metadata?.importance || 50;

    return `${index + 1}. ${content} (importance: ${importance}/100)`;
  });

  const context = `Relevant context from past conversations:\n${contextLines.join("\n")}`;
  logger.debug(
    `Built default context (${context.length} chars, ${memories.length} memories)`,
  );

  return context;
}

/**
 * Inject memory context into messages based on strategy
 */
export function injectMemoryContext(
  messages: any,
  memories: MemoryEntry[],
  config: CortexMemoryConfig,
  logger: Logger,
): any {
  if (memories.length === 0) {
    logger.debug("No memories to inject, returning original messages");
    return messages;
  }

  const contextString = buildMemoryContext(memories, config, logger);

  if (!contextString) {
    return messages;
  }

  const strategy = config.contextInjectionStrategy || "system";

  switch (strategy) {
    case "system": {
      // Prepend to system message or create new system message
      const hasSystemMessage =
        messages.length > 0 && messages[0].role === "system";

      if (hasSystemMessage) {
        // Append to existing system message
        logger.debug("Injecting context into existing system message");
        return [
          {
            ...messages[0],
            content: `${messages[0].content}\n\n${contextString}`,
          },
          ...messages.slice(1),
        ];
      } else {
        // Create new system message at start
        logger.debug("Creating new system message with context");
        return [
          {
            role: "system" as const,
            content: contextString,
          },
          ...messages,
        ];
      }
    }

    case "user": {
      // Append to last user message
      const lastUserIndex = messages.findLastIndex((m) => m.role === "user");

      if (lastUserIndex === -1) {
        logger.warn("No user message found, cannot inject context");
        return messages;
      }

      logger.debug(
        `Injecting context into user message at index ${lastUserIndex}`,
      );

      return [
        ...messages.slice(0, lastUserIndex),
        {
          ...messages[lastUserIndex],
          content: `${messages[lastUserIndex].content}\n\nRelevant context:\n${contextString}`,
        },
        ...messages.slice(lastUserIndex + 1),
      ];
    }

    case "custom": {
      // Custom strategy not supported without customContextBuilder
      logger.warn(
        "Custom strategy requires customContextBuilder, using system fallback",
      );
      return injectMemoryContext(
        messages,
        memories,
        { ...config, contextInjectionStrategy: "system" },
        logger,
      );
    }

    default:
      logger.warn(`Unknown strategy: ${strategy}, using original messages`);
      return messages;
  }
}

/**
 * Extract last user message content from messages array
 */
export function getLastUserMessage(
  messages: LanguageModelV1Prompt,
): string | null {
  const lastUserMessage = messages.findLast((m) => m.role === "user");
  if (!lastUserMessage || lastUserMessage.role !== "user") return null;

  // Handle content parts
  const content = lastUserMessage.content;
  if (Array.isArray(content)) {
    // Extract text from parts
    const textParts = content
      .filter((part: any) => part.type === "text")
      .map((part: any) => part.text);
    return textParts.join(" ") || null;
  }

  return null;
}

/**
 * Generate a unique ID
 */
export function generateId(prefix: string = "id"): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Validate configuration
 */
export function validateConfig(config: CortexMemoryConfig): void {
  if (!config.convexUrl) {
    throw new Error("convexUrl is required");
  }

  if (!config.memorySpaceId) {
    throw new Error("memorySpaceId is required");
  }

  if (!config.userId) {
    throw new Error("userId is required");
  }

  if (config.memorySearchLimit !== undefined && config.memorySearchLimit < 0) {
    throw new Error("memorySearchLimit must be >= 0");
  }

  if (
    config.minMemoryRelevance !== undefined &&
    (config.minMemoryRelevance < 0 || config.minMemoryRelevance > 1)
  ) {
    throw new Error("minMemoryRelevance must be between 0 and 1");
  }

  if (
    config.defaultImportance !== undefined &&
    (config.defaultImportance < 0 || config.defaultImportance > 100)
  ) {
    throw new Error("defaultImportance must be between 0 and 100");
  }
}
