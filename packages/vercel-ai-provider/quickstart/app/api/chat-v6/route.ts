/**
 * Chat API Route (AI SDK v6 Style)
 *
 * This route demonstrates the AI SDK v6 pattern using:
 * - createAgentUIStreamResponse for simplified streaming
 * - ToolLoopAgent for reusable agent configuration
 * - Type-safe call options for memory context
 *
 * Compare this to the v5-style route.ts which uses
 * createUIMessageStreamResponse + streamText directly.
 *
 * @example Client usage:
 * ```typescript
 * const { messages, sendMessage } = useChat({
 *   transport: new DefaultChatTransport({
 *     api: '/api/chat-v6',
 *     body: { memorySpaceId, userId, conversationId },
 *   }),
 * });
 * ```
 */

import { createAgentUIStreamResponse, convertToModelMessages } from "ai";
import { memoryAgent } from "@/lib/agents/memory-agent";
import { getCortex } from "@/lib/cortex";

/**
 * Generate a title from the first user message
 */
function generateTitle(message: string): string {
  let title = message.slice(0, 50);
  if (message.length > 50) {
    const lastSpace = title.lastIndexOf(" ");
    if (lastSpace > 20) {
      title = title.slice(0, lastSpace);
    }
    title += "...";
  }
  return title;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      messages,
      memorySpaceId = "quickstart-demo",
      userId = "demo-user",
      conversationId: providedConversationId,
    } = body;

    // Generate conversation ID if not provided
    const conversationId =
      providedConversationId ||
      `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const isNewConversation = !providedConversationId;

    // If new conversation, create it in Cortex
    if (isNewConversation) {
      const firstUserMessage = messages.find(
        (m: { role: string }) => m.role === "user"
      );
      let messageText = "";

      if (firstUserMessage) {
        if (typeof firstUserMessage.content === "string") {
          messageText = firstUserMessage.content;
        } else if (firstUserMessage.parts) {
          messageText = firstUserMessage.parts
            .filter(
              (p: { type: string; text?: string }) =>
                p.type === "text" && p.text
            )
            .map((p: { text: string }) => p.text)
            .join("");
        }
      }

      if (messageText) {
        try {
          const cortex = getCortex();
          await cortex.conversations.create({
            memorySpaceId,
            conversationId,
            type: "user-agent",
            participants: {
              userId,
              agentId: "cortex-memory-agent",
            },
            metadata: { title: generateTitle(messageText) },
          });
        } catch (error) {
          console.error("Failed to create conversation:", error);
        }
      }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // AI SDK v6: createAgentUIStreamResponse
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //
    // This is the key difference from v5:
    // - No need to manually create UIMessageStream
    // - No need to manually merge streams
    // - The agent handles the tool loop automatically
    //
    // The agent's prepareCall function injects memories,
    // and the callOptionsSchema ensures type safety.
    //
    return createAgentUIStreamResponse({
      agent: memoryAgent,
      messages,
      options: {
        userId,
        memorySpaceId,
        conversationId,
      },
    });
  } catch (error) {
    console.error("[Chat v6 API Error]", error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
