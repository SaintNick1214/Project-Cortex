"use server";

import { requireScope } from "@/lib/cortex";
import { ChatSDKError } from "@/lib/errors";
import { chatModels } from "@/lib/ai/models";
import { assertModelAvailable } from "@/lib/ai/providers";
import { generateText, type UIMessage } from "ai";
import { cookies } from "next/headers";
import type { VisibilityType } from "@/components/visibility-selector";
import { titlePrompt } from "@/lib/ai/prompts";
import { getTitleModel } from "@/lib/ai/providers";
import {
  deleteMessagesByChatIdAfterTimestamp,
  getMessageById,
  getChatById,
  updateChatVisibilityById,
} from "@/lib/db/queries";
import { getTextFromMessage } from "@/lib/utils";

export async function saveChatModelAsCookie(model: string) {
  await requireScope();
  if (!chatModels.some((candidate) => candidate.id === model))
    throw new ChatSDKError("bad_request:chat");
  const cookieStore = await cookies();
  cookieStore.set("chat-model", model);
}

export async function generateTitleFromUserMessage({
  message,
  chatId,
}: {
  message: UIMessage;
  chatId: string;
}) {
  if (!(await getChatById({ id: chatId })) || message.role !== "user")
    throw new ChatSDKError("not_found:chat");
  assertModelAvailable("openai/gpt-5-mini");
  const { text } = await generateText({
    model: getTitleModel(),
    system: titlePrompt,
    prompt: getTextFromMessage(message),
    abortSignal: AbortSignal.timeout(30000),
  });
  return text
    .replace(/^[#*"\s]+/, "")
    .replace(/["]+$/, "")
    .trim();
}

export async function deleteTrailingMessages({ id }: { id: string }) {
  const [message] = await getMessageById({ id });

  if (!message) throw new ChatSDKError("not_found:chat");
  await deleteMessagesByChatIdAfterTimestamp({
    chatId: message.chatId,
    timestamp: message.createdAt,
  });
}

export async function updateChatVisibility({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: VisibilityType;
}) {
  await updateChatVisibilityById({ chatId, visibility });
}
