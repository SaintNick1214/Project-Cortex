import type { Handler } from "hono";
import type { ChatResult } from "./chat.js";

export const MAX_CHAT_BODY_BYTES = 64 * 1024;
const MAX_MESSAGE_LENGTH = 16 * 1024;
const MAX_CONVERSATION_ID_LENGTH = 256;

class InputError extends Error {
  constructor(message: string, readonly status: 400 | 413) {
    super(message);
  }
}

/** Bound bytes before JSON parsing, including chunked requests and misleading headers. */
async function readInput(request: Request): Promise<{ message: string; conversationId?: string }> {
  const declaredSize = Number(request.headers.get("content-length"));
  if (declaredSize > MAX_CHAT_BODY_BYTES) throw new InputError("Request body is too large", 413);
  if (!request.body) throw new InputError("message is required", 400);

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0;
  let text = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_CHAT_BODY_BYTES) {
        await reader.cancel();
        throw new InputError("Request body is too large", 413);
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } catch (error) {
    if (error instanceof InputError) throw error;
    throw new InputError("Request body must be valid UTF-8 JSON", 400);
  } finally {
    reader.releaseLock();
  }

  let body: unknown;
  try { body = JSON.parse(text); }
  catch { throw new InputError("Request body must be valid JSON", 400); }
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new InputError("Request body must be a chat object", 400);
  const input = body as Record<string, unknown>;
  if (Object.keys(input).some(key => key !== "message" && key !== "conversationId"))
    throw new InputError("Only message and conversationId are accepted", 400);
  if (typeof input.message !== "string" || !input.message.trim())
    throw new InputError("message is required", 400);
  if (input.message.length > MAX_MESSAGE_LENGTH)
    throw new InputError("message is too long", 400);
  if (input.conversationId !== undefined &&
      (typeof input.conversationId !== "string" || !input.conversationId.trim() ||
       input.conversationId.length > MAX_CONVERSATION_ID_LENGTH))
    throw new InputError("conversationId must be a nonempty string of at most 256 characters", 400);
  // No attacker-controlled object or array reaches the SDK/component validation path.
  return { message: input.message, conversationId: input.conversationId as string | undefined };
}

/** The production chat route; dependencies are injected for HTTP outcome tests. */
export function createChatHandler(
  chat: (message: string, conversationId: string) => Promise<ChatResult>,
  generateConversationId: () => string,
): Handler {
  return async (context) => {
    try {
      const input = await readInput(context.req.raw);
      const result = await chat(input.message, input.conversationId ?? generateConversationId());
      return context.json(result);
    } catch (error) {
      if (error instanceof InputError) return context.json({ error: error.message }, error.status);
      const message = error instanceof Error ? error.message : "Unknown error";
      return context.json({ error: message }, 500);
    }
  };
}
