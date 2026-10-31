import type { CortexRuntimeClient } from "@cortexmemory/sdk/runtime";

export async function generateDocument(
  client: CortexRuntimeClient,
  requestId: string,
  prompt: string,
  conversationId?: string,
) {
  return client.submitContentJob({
    version: 1,
    requestId,
    intent: "text",
    prompt,
    ...(conversationId === undefined ? {} : { conversationId }),
  });
}
