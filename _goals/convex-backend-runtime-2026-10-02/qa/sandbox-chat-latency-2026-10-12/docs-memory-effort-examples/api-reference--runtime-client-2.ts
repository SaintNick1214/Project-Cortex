import type { CortexRuntimeClient } from '@cortexmemory/sdk/runtime';

export async function captureExchange(client: CortexRuntimeClient, requestId: string) {
  const captured = await client.remember({
    conversationId: 'external-chat-1',
    requestId,
    userMessage: 'I play cello.',
    agentResponse: 'Thanks for telling me.',
    metadata: { channel: 'support' },
  });
  return client.rememberStatus(captured.receiptId);
}
