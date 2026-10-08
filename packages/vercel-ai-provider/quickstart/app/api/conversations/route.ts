import { randomUUID } from "node:crypto";
import {
  requireSession,
  selectSpace,
  errorResponse,
  AppError,
} from "@/lib/app-auth";
import { withCortex, assertConversationOwner } from "@/lib/cortex";
function projection(conversation: {
  conversationId: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}) {
  return {
    id: conversation.conversationId,
    title:
      typeof conversation.metadata?.title === "string"
        ? conversation.metadata.title
        : "New Chat",
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    messageCount: conversation.messageCount,
  };
}
export async function GET(req: Request) {
  try {
    const account = await requireSession(req),
      params = new URL(req.url).searchParams;
    const space = selectSpace(account, {
      userId: params.get("userId"),
      tenantId: params.get("tenantId"),
      memorySpaceId: params.get("memorySpaceId"),
    });
    const id = params.get("conversationId");
    return await withCortex(account, async (cortex) => {
      if (id) {
        const conversation = await cortex.conversations.get(id, {
          includeMessages: true,
          messageLimit: 100,
        });
        assertConversationOwner(conversation, account, space);
        return Response.json({
          conversation: projection(conversation),
          messages: (conversation.messages ?? []).map((message) => ({
            id: message.id,
            role: message.role === "agent" ? "assistant" : message.role,
            content: message.content,
            createdAt: new Date(message.timestamp),
          })),
        });
      }
      const result = await cortex.conversations.list({
        memorySpaceId: space,
        userId: account.accountId,
        limit: 50,
      });
      for (const conversation of result.conversations)
        assertConversationOwner(conversation, account, space);
      return Response.json({
        conversations: result.conversations
          .map(projection)
          .sort((a, b) => b.updatedAt - a.updatedAt),
      });
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(req: Request) {
  try {
    const account = await requireSession(req),
      body = await req.json();
    const space = selectSpace(account, body);
    if (
      body.title !== undefined &&
      (typeof body.title !== "string" || body.title.length > 200)
    )
      throw new AppError(400, "Invalid title");
    return await withCortex(account, async (cortex) => {
      const conversation = await cortex.conversations.create({
        memorySpaceId: space,
        conversationId: randomUUID(),
        type: "user-agent",
        participants: {
          userId: account.accountId,
          agentId: "quickstart-assistant",
        },
        metadata: { title: body.title || "New Chat" },
      });
      return Response.json({
        success: true,
        conversation: projection(conversation),
      });
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function DELETE(req: Request) {
  try {
    const account = await requireSession(req),
      params = new URL(req.url).searchParams;
    const space = selectSpace(account, {
      userId: params.get("userId"),
      tenantId: params.get("tenantId"),
      memorySpaceId: params.get("memorySpaceId"),
    });
    const id = params.get("conversationId");
    if (!id) throw new AppError(400, "conversationId required");
    return await withCortex(account, async (cortex) => {
      assertConversationOwner(
        await cortex.conversations.get(id),
        account,
        space,
      );
      await cortex.conversations.delete(id);
      return Response.json({ success: true });
    }, process.env.CORTEX_GRAPH_SYNC === "true");
  } catch (error) {
    return errorResponse(error);
  }
}
