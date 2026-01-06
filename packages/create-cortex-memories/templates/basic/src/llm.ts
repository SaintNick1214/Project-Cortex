/**
 * LLM Integration (Optional)
 *
 * Provides AI-powered responses when OPENAI_API_KEY is set.
 * Falls back to echo mode with memory context when no API key is available.
 */

import type { Memory, Fact } from "./chat.js";
import { CONFIG } from "./cortex.js";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Configuration
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const SYSTEM_PROMPT = `You are a helpful AI assistant with long-term memory powered by Cortex.

Your capabilities:
- You remember everything users tell you across conversations
- You can recall facts, preferences, and context from past interactions
- You naturally reference what you've learned about the user

Behavior guidelines:
- When you remember something from a previous conversation, mention it naturally
- If asked about something you learned, reference it specifically
- Be conversational and friendly
- Help demonstrate the memory system by showing what you remember

Example interactions:
- User: "My name is Alex" → Remember and use their name
- User: "I work at Acme Corp" → Remember their employer
- User: "My favorite color is blue" → Remember their preference
- User: "What do you know about me?" → List everything you remember`;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LLM State
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

let openaiClient: unknown = null;
let llmAvailable = false;

/**
 * Check if LLM is available
 */
export function isLLMAvailable(): boolean {
  return llmAvailable || !!process.env.OPENAI_API_KEY;
}

/**
 * Initialize OpenAI client if API key is available
 */
async function getOpenAIClient(): Promise<unknown> {
  if (openaiClient) return openaiClient;

  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  try {
    const { default: OpenAI } = await import("openai");
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    llmAvailable = true;
    return openaiClient;
  } catch {
    // OpenAI not installed
    return null;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Response Generation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Generate a response using LLM or echo mode
 */
export async function generateResponse(
  userMessage: string,
  memories: Memory[],
  facts: Fact[],
): Promise<string> {
  const client = await getOpenAIClient();

  if (client) {
    return generateLLMResponse(client, userMessage, memories, facts);
  } else {
    return generateEchoResponse(userMessage, memories, facts);
  }
}

/**
 * Generate response using OpenAI
 */
async function generateLLMResponse(
  client: unknown,
  userMessage: string,
  memories: Memory[],
  facts: Fact[],
): Promise<string> {
  // Build context from memories and facts
  const context = buildContext(memories, facts);

  // Build messages array
  const messages = [
    { role: "system" as const, content: SYSTEM_PROMPT },
  ];

  // Add memory context if available
  if (context) {
    messages.push({
      role: "system" as const,
      content: `Here is what you remember about this user:\n\n${context}`,
    });
  }

  // Add user message
  messages.push({ role: "user" as const, content: userMessage });

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const openai = client as any;
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 500,
      temperature: 0.7,
    });

    return completion.choices[0]?.message?.content || "I couldn't generate a response.";
  } catch (error) {
    if (CONFIG.debug) {
      console.error("[Debug] OpenAI error:", error);
    }
    // Fall back to echo mode on error
    return generateEchoResponse(userMessage, memories, facts);
  }
}

/**
 * Generate echo response (no LLM)
 */
function generateEchoResponse(
  userMessage: string,
  memories: Memory[],
  facts: Fact[],
): string {
  const lines: string[] = [];

  lines.push(`I heard you say: "${userMessage}"`);
  lines.push("");

  if (memories.length > 0 || facts.length > 0) {
    lines.push("📚 Here's what I remember about you:");
    lines.push("");

    if (facts.length > 0) {
      lines.push("Facts:");
      for (const fact of facts.slice(0, 5)) {
        const type = fact.factType ? ` [${fact.factType}]` : "";
        lines.push(`  • ${fact.content}${type}`);
      }
      if (facts.length > 5) {
        lines.push(`  ... and ${facts.length - 5} more facts`);
      }
      lines.push("");
    }

    if (memories.length > 0) {
      lines.push("Recent conversations:");
      for (const mem of memories.slice(0, 3)) {
        const content = mem.content?.slice(0, 80) || "";
        lines.push(`  • ${content}${content.length >= 80 ? "..." : ""}`);
      }
      if (memories.length > 3) {
        lines.push(`  ... and ${memories.length - 3} more memories`);
      }
    }
  } else {
    lines.push("💭 I don't have any memories of you yet.");
    lines.push("   Tell me something about yourself!");
  }

  lines.push("");
  lines.push("ℹ️  Running in echo mode (no OPENAI_API_KEY)");
  lines.push("   Set OPENAI_API_KEY in .env.local for AI responses.");

  return lines.join("\n");
}

/**
 * Build context string from memories and facts
 */
function buildContext(memories: Memory[], facts: Fact[]): string {
  const parts: string[] = [];

  // Add facts
  if (facts.length > 0) {
    parts.push("Known facts about the user:");
    for (const fact of facts) {
      const type = fact.factType ? ` (${fact.factType})` : "";
      parts.push(`- ${fact.content}${type}`);
    }
    parts.push("");
  }

  // Add relevant memories
  if (memories.length > 0) {
    parts.push("Relevant past conversations:");
    for (const mem of memories.slice(0, 5)) {
      parts.push(`- ${mem.content}`);
    }
  }

  return parts.join("\n");
}
