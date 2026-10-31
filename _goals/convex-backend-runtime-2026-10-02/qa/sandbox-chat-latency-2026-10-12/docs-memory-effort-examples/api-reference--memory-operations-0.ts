import type { Cortex } from '@cortexmemory/sdk';

export async function ingestApprovedExchange(cortex: Cortex, spaceId: string) {
  const result = await cortex.memory.remember({
    memorySpaceId: spaceId,
    conversationId: 'admin-import-001',
    userId: 'user-123',
    userName: 'Alex',
    userMessage: 'My preferred delivery window is Tuesday morning.',
    agentResponse: 'I recorded Tuesday morning as your preference.',
    importance: 70,
    tags: ['delivery'],
  }, { extractFacts: false, beliefRevision: false });
  return { conversationId: result.conversation.conversationId,
    memoryIds: result.memories.map(memory => memory.memoryId) };
}

export async function searchApprovedMemory(cortex: Cortex, spaceId: string) {
  const results = await cortex.memory.search(spaceId, 'delivery', {
    userId: 'user-123', limit: 10, minImportance: 50,
    enrichConversation: true,
  });
  return results.map(result => ({ id: result.memory.memoryId,
    text: result.memory.content, sourceMessages: result.sourceMessages ?? [] }));
}
