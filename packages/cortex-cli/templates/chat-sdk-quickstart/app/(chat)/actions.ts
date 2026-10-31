"use server";
import type { UIMessage } from "ai";
import { cookies } from "next/headers";
import type { VisibilityType } from "@/components/visibility-selector";
import { submitDocument } from "@/lib/artifacts/server";
export async function saveChatModelAsCookie(model: string) {
  (await cookies()).set("chat-model", model);
}
export async function generateTitleFromUserMessage({
  message,
  token,
  conversationId,
  parentRunId,
}: {
  message: UIMessage;
  token: string;
  conversationId: string;
  parentRunId: string;
}) {
  return submitDocument(token, {
    conversationId,
    intent: "title",
    parentRunId,
    prompt: message.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n"),
    requestId: `title:${message.id}`,
    version: 1,
  });
}
export async function deleteTrailingMessages(_args: { id: string }) {
  throw new Error(
    "Use authenticated canonical transcript removal on the backend."
  );
}
export async function updateChatVisibility(_args: {
  chatId: string;
  visibility: VisibilityType;
}) {
  throw new Error(
    "Provision conversation sharing through the authorized backend."
  );
}
