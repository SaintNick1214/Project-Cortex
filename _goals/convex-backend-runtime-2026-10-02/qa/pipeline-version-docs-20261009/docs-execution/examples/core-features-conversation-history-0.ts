import type { CortexRuntimeClient } from '@cortexmemory/sdk/runtime';

export async function readHistory(client: CortexRuntimeClient, conversationId: string) {
  const first = await client.messages(conversationId, { limit: 100 });
  if (first.isDone || first.continueCursor === null) return first.page;
  const next = await client.messages(conversationId, { cursor: first.continueCursor });
  return [...first.page, ...next.page];
}
