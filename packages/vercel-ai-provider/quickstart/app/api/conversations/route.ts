/**
 * Conversations API Route
 *
 * GET: List conversations for a user (chat history)
 * POST: Create a new conversation
 * DELETE: Delete a conversation
 */

import { getCortex } from "@/lib/cortex";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversationId");
    const userId = searchParams.get("userId");
    const memorySpaceId = searchParams.get("memorySpaceId") || "quickstart-demo";

    const cortex = getCortex();

    // If conversationId is provided, fetch single conversation with messages
    if (conversationId) {
      const conversation = await cortex.conversations.get(conversationId, {
        includeMessages: true,
        messageLimit: 100,
      });

      if (!conversation) {
        return Response.json(
          { error: "Conversation not found" },
          { status: 404 }
        );
      }

      // Transform messages to the format expected by AI SDK useChat
      const messages = (conversation.messages || []).map((msg) => ({
        id: msg.id,
        role: msg.role as "user" | "assistant",
        content: msg.content,
        createdAt: new Date(msg.timestamp),
      }));

      return Response.json({
        conversation: {
          id: conversation.conversationId,
          title: (conversation.metadata?.title as string) || getDefaultTitle(conversation),
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
          messageCount: conversation.messageCount || 0,
        },
        messages,
      });
    }

    // List conversations for user (requires userId)
    if (!userId) {
      return Response.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    // Get conversations for the user
    const result = await cortex.conversations.list({
      memorySpaceId,
      userId,
      limit: 50,
    });

    // Map conversations to a simpler format for the UI
    const conversations = result.conversations.map((conv) => ({
      id: conv.conversationId,
      title: (conv.metadata?.title as string) || getDefaultTitle(conv),
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      messageCount: conv.messageCount || 0,
    }));

    // Sort by updatedAt descending (most recent first)
    conversations.sort((a, b) => b.updatedAt - a.updatedAt);

    return Response.json({ conversations });
  } catch (error) {
    console.error("[Conversations Error]", error);

    return Response.json(
      { error: "Failed to fetch conversations" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, memorySpaceId = "quickstart-demo", title } = body;

    if (!userId) {
      return Response.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    const cortex = getCortex();

    // Create a new conversation
    const conversationId = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const conversation = await cortex.conversations.create({
      memorySpaceId,
      conversationId,
      type: "user-agent",
      participants: {
        userId,
        agentId: "quickstart-assistant",
      },
      metadata: {
        title: title || "New Chat",
      },
    });

    return Response.json({
      success: true,
      conversation: {
        id: conversation.conversationId,
        title: (conversation.metadata?.title as string) || "New Chat",
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        messageCount: 0,
      },
    });
  } catch (error) {
    console.error("[Conversation Create Error]", error);

    return Response.json(
      { error: "Failed to create conversation" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversationId");

    if (!conversationId) {
      return Response.json(
        { error: "conversationId is required" },
        { status: 400 }
      );
    }

    const cortex = getCortex();

    await cortex.conversations.delete(conversationId);

    return Response.json({ success: true });
  } catch (error) {
    console.error("[Conversation Delete Error]", error);

    return Response.json(
      { error: "Failed to delete conversation" },
      { status: 500 }
    );
  }
}

/**
 * Generate a default title from conversation data
 */
function getDefaultTitle(conv: { createdAt: number; messageCount?: number }): string {
  const date = new Date(conv.createdAt);
  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `Chat at ${timeStr}`;
}
