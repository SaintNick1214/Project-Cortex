import type { Cortex } from '@cortexmemory/sdk';

export async function readHistoryPage(cortex: Cortex, conversationId: string,
  tenantId: string, offset = 0) {
  const page = await cortex.conversations.getHistory(conversationId, {
    tenantId, limit: 50, offset, sortOrder: 'asc', roles: ['user', 'agent'],
  });
  return { messages: page.messages, total: page.total,
    nextOffset: page.hasMore ? offset + page.messages.length : undefined };
}
