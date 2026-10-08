import "server-only";
import type { AppScope } from "./cortex";
import { ChatSDKError } from "./errors";
import { privateCall, privateConfiguration } from "./private-backend";
import type { ChatMessage } from "./types";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_CONTEXT_BYTES = 10 * MAX_UPLOAD_BYTES;

/** Inline only registered, caller-owned storage images for the external model. */
export async function resolveOwnedModelUploads(
  messages: ChatMessage[],
  scope: AppScope,
  signal: AbortSignal
): Promise<ChatMessage[]> {
  const files = new Map<
    string,
    { url: string; name: string; mediaType: string }
  >();
  for (const message of messages) {
    for (const part of message.parts) {
      if (part.type !== "file") {
        continue;
      }
      const name = "name" in part ? part.name : part.filename;
      if (
        typeof name !== "string" ||
        !["image/png", "image/jpeg"].includes(part.mediaType)
      ) {
        throw new ChatSDKError("bad_request:chat");
      }
      const file = { url: part.url, name, mediaType: part.mediaType };
      const previous = files.get(file.url);
      if (
        previous &&
        (previous.name !== name || previous.mediaType !== part.mediaType)
      ) {
        throw new ChatSDKError("bad_request:chat");
      }
      files.set(file.url, file);
    }
  }
  if (!files.size) {
    return messages;
  }

  const selected = [...files.values()];
  // Check the entire selected history before fetching any storage body.
  for (let offset = 0; offset < selected.length; offset += 10) {
    await privateCall("app/chatData:verifyUploads", {
      ...scope,
      files: selected.slice(offset, offset + 10),
    });
  }
  const origin = new URL(privateConfiguration().convexUrl).origin;
  for (const file of selected) {
    const url = new URL(file.url);
    if (
      url.origin !== origin ||
      url.username ||
      url.password ||
      url.hash ||
      !/^\/api\/storage\/[A-Za-z0-9_-]+$/.test(url.pathname)
    ) {
      throw new ChatSDKError("bad_request:chat");
    }
  }

  let totalBytes = 0;
  const inline = new Map<string, string>();
  for (const file of selected) {
    const response = await fetch(file.url, {
      credentials: "omit",
      redirect: "error",
      signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
    });
    const mediaType = response.headers
      .get("content-type")
      ?.split(";")[0]
      .trim();
    const length = response.headers.get("content-length");
    if (
      !response.ok ||
      !response.body ||
      mediaType !== file.mediaType ||
      (length !== null &&
        (!/^\d+$/.test(length) || Number(length) > MAX_UPLOAD_BYTES))
    ) {
      await response.body?.cancel();
      throw new ChatSDKError("bad_request:chat");
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        bytes += value.byteLength;
        totalBytes += value.byteLength;
        if (bytes > MAX_UPLOAD_BYTES || totalBytes > MAX_CONTEXT_BYTES) {
          throw new ChatSDKError("bad_request:chat");
        }
        chunks.push(value);
      }
      if (!bytes) {
        throw new ChatSDKError("bad_request:chat");
      }
      inline.set(
        file.url,
        `data:${file.mediaType};base64,${Buffer.concat(chunks).toString("base64")}`
      );
    } catch (error) {
      await reader.cancel().catch(() => undefined);
      throw error;
    } finally {
      reader.releaseLock();
    }
  }
  return messages.map((message) => ({
    ...message,
    parts: message.parts.map((part) => {
      if (part.type !== "file") {
        return part;
      }
      const data = inline.get(part.url);
      if (!data) {
        throw new ChatSDKError("bad_request:chat");
      }
      return { ...part, url: data };
    }),
  }));
}
