/**
 * Core Chat Logic
 *
 * Handles the chat flow: recall → generate response → remember
 * This mirrors the Vercel AI quickstart's chat route logic.
 */

import {
  getCortex,
  CONFIG,
  buildRememberParams,
  createLayerObserver,
} from "./cortex.js";
import {
  printRecallResults,
  printOrchestrationComplete,
  printInfo,
  startSpinner,
  stopSpinner,
} from "./display.js";
import { generateResponse, isLLMAvailable } from "./llm.js";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface ChatResult {
  response: string;
  conversationId: string;
  memoriesRecalled: number;
  factsRecalled: number;
}

export interface Memory {
  content?: string;
  importance?: number;
  source?: string;
  conversationId?: string;
}

export interface Fact {
  content?: string;
  factType?: string;
  confidence?: number;
  subject?: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Conversation State
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

let currentConversationId: string | null = null;

/**
 * Generate a new conversation ID
 */
export function generateConversationId(): string {
  return `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Get or create current conversation ID
 */
export function getConversationId(): string {
  if (!currentConversationId) {
    currentConversationId = generateConversationId();
  }
  return currentConversationId;
}

/**
 * Start a new conversation
 */
export function newConversation(): string {
  currentConversationId = generateConversationId();
  printInfo(`Started new conversation: ${currentConversationId}`);
  return currentConversationId;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Main Chat Function
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Process a chat message through the full memory pipeline
 *
 * 1. Recall relevant memories and facts
 * 2. Generate response (LLM or echo)
 * 3. Remember the exchange (triggers layer orchestration)
 */
export async function chat(
  userMessage: string,
  conversationId?: string,
): Promise<ChatResult> {
  const cortex = getCortex();
  const convId = conversationId || getConversationId();

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Step 1: Recall relevant memories
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  let memories: Memory[] = [];
  let facts: Fact[] = [];

  startSpinner("Searching memories...");

  try {
    // Use the unified recall API (v0.23.0+)
    const recallResult = await cortex.memory.recall({
      memorySpaceId: CONFIG.memorySpaceId,
      query: userMessage,
      limit: 10,
      sources: {
        vector: true,
        facts: true,
        graph: CONFIG.enableGraphMemory,
      },
    });

    // Extract memories and facts from the correct result structure
    // SDK returns: result.sources.vector.items and result.sources.facts.items
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = recallResult as any;
    memories = (result.sources?.vector?.items || result.memories || []) as Memory[];
    facts = (result.sources?.facts?.items || result.facts || []) as Fact[];

    stopSpinner(true, `Found ${memories.length} memories, ${facts.length} facts`);

    // Display recall results
    printRecallResults(memories, facts);
  } catch (error) {
    stopSpinner(false, "No memories found (starting fresh)");
    // Recall might fail if no memories exist yet - that's ok
    if (CONFIG.debug) {
      console.log("[Debug] Recall error (may be empty):", error);
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Step 2: Generate response
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  startSpinner("Thinking...");
  const response = await generateResponse(userMessage, memories, facts);
  stopSpinner(true, "Response generated");

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Step 3: Remember the exchange (triggers orchestration)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const startTime = Date.now();

  try {
    const params = await buildRememberParams({
      userMessage,
      agentResponse: response,
      conversationId: convId,
    });

    // Add layer observer for console output - uses 'observer' not 'layerObserver'
    await cortex.memory.remember({
      ...params,
      observer: createLayerObserver(),
    });

    // Print orchestration summary
    const totalMs = Date.now() - startTime;
    printOrchestrationComplete(totalMs);
  } catch (error) {
    console.error("Failed to store memory:", error);
    // Still return the response even if storage fails
  }

  return {
    response,
    conversationId: convId,
    memoriesRecalled: memories.length,
    factsRecalled: facts.length,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Query Functions
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Search memories without storing anything
 */
export async function recallMemories(query: string): Promise<void> {
  const cortex = getCortex();

  startSpinner("Searching memories...");

  try {
    const recallResult = await cortex.memory.recall({
      memorySpaceId: CONFIG.memorySpaceId,
      query,
      limit: 10,
      sources: {
        vector: true,
        facts: true,
        graph: CONFIG.enableGraphMemory,
      },
    });

    // Extract from correct result structure
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = recallResult as any;
    const memories = (result.sources?.vector?.items || result.memories || []) as Memory[];
    const facts = (result.sources?.facts?.items || result.facts || []) as Fact[];

    stopSpinner(true, `Found ${memories.length} memories, ${facts.length} facts`);
    printRecallResults(memories, facts);
  } catch (error) {
    stopSpinner(false, "Recall failed");
    console.error("Recall failed:", error);
  }
}

/**
 * List all facts in the memory space
 */
export async function listFacts(): Promise<void> {
  const cortex = getCortex();

  startSpinner("Loading facts...");

  try {
    const result = await cortex.facts.list({
      memorySpaceId: CONFIG.memorySpaceId,
      limit: 20,
    });

    const facts = (result.facts || result || []) as Fact[];

    stopSpinner(true, `Found ${facts.length} facts`);
    printRecallResults([], facts);
  } catch (error) {
    stopSpinner(false, "Failed to load facts");
    console.error("List facts failed:", error);
  }
}

/**
 * Get conversation history
 */
export async function getHistory(): Promise<void> {
  const cortex = getCortex();
  const convId = currentConversationId;

  if (!convId) {
    printInfo("No active conversation");
    return;
  }

  startSpinner("Loading history...");

  try {
    const conversation = await cortex.conversations.get(convId);

    if (conversation && conversation.messages) {
      stopSpinner(true, `Found ${conversation.messages.length} messages`);
      console.log("");
      console.log(`📜 Conversation: ${convId}`);
      console.log(`   Messages: ${conversation.messages.length}`);
      console.log("");

      for (const msg of conversation.messages.slice(-10)) {
        const role = msg.role === "user" ? "You" : "Assistant";
        const content =
          typeof msg.content === "string"
            ? msg.content
            : JSON.stringify(msg.content);
        console.log(`   ${role}: ${content.slice(0, 60)}${content.length > 60 ? "..." : ""}`);
      }
      console.log("");
    } else {
      stopSpinner(false, "Conversation not found or empty");
    }
  } catch (error) {
    stopSpinner(false, "Failed to load history");
    console.error("Get history failed:", error);
  }
}

/**
 * Print current configuration
 */
export function printConfig(): void {
  console.log("");
  console.log("⚙️  Configuration:");
  console.log(`   Memory Space: ${CONFIG.memorySpaceId}`);
  console.log(`   User: ${CONFIG.userId} (${CONFIG.userName})`);
  console.log(`   Agent: ${CONFIG.agentId} (${CONFIG.agentName})`);
  console.log(`   Fact Extraction: ${CONFIG.enableFactExtraction ? "enabled" : "disabled"}`);
  console.log(`   Graph Sync: ${CONFIG.enableGraphMemory ? "enabled" : "disabled"}`);
  console.log(`   LLM: ${isLLMAvailable() ? "OpenAI (enabled)" : "Echo mode (no API key)"}`);
  console.log(`   Conversation: ${currentConversationId || "none"}`);
  console.log("");
}
