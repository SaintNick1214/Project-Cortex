import { auth } from "@/app/(auth)/auth";
import { getChatById, updateChatVisibilityById } from "@/lib/db/queries";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const { chatId, visibility } = await request.json();

    if (!chatId || !visibility) {
      return new Response("Missing chatId or visibility", { status: 400 });
    }

    if (visibility !== "private" && visibility !== "public") {
      return new Response("Invalid visibility. Must be 'private' or 'public'", {
        status: 400,
      });
    }

    // Verify ownership
    const chat = await getChatById({ id: chatId });

    if (!chat) {
      return new Response("Chat not found", { status: 404 });
    }

    if (chat.userId !== session.user.id) {
      return new Response("You can only modify your own chats", {
        status: 403,
      });
    }

    // Update visibility
    await updateChatVisibilityById({ chatId, visibility });

    return Response.json({
      success: true,
      visibility,
      shareUrl:
        visibility === "public"
          ? `${process.env.NEXT_PUBLIC_APP_URL || ""}/share/${chatId}`
          : null,
    });
  } catch (error) {
    console.error("Error updating chat visibility:", error);
    return new Response("Internal server error", { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get("chatId");

  if (!chatId) {
    return new Response("Missing chatId", { status: 400 });
  }

  const chat = await getChatById({ id: chatId });

  if (!chat) {
    return new Response("Chat not found", { status: 404 });
  }

  return Response.json({
    chatId: chat.id,
    visibility: chat.visibility,
    isPublic: chat.visibility === "public",
  });
}
