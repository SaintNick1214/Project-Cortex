# Conversation History

> **Last Updated**: 2025-10-23

Persistent message storage and conversation replay for contextual agent interactions.

## Overview

Conversation history captures the complete thread of messages between users and agents. This enables agents to maintain context across sessions, reference past discussions, and provide coherent long-term interactions.

## Core Concept

### ACID Conversations vs Vector Memories

Cortex uses a **two-layer architecture**:

**Layer 1: ACID Conversations** (Source of Truth)
- Immutable message history
- Append-only, never modified
- Complete conversation threads
- No retention limits (keeps forever)
- Legal/audit compliance

**Layer 2: Vector Memories** (Searchable Index)
- Fast searchable knowledge
- Versioned with retention rules
- References Layer 1 via `conversationRef`
- Optimized for retrieval
- Can be raw or summarized

```typescript
// ACID Conversation: Immutable source
{
  conversationId: 'conv-456',
  messages: [
    {
      id: 'msg-001',
      role: 'user',
      text: 'My favorite color is blue',  // ← FULL original, never changes
      userId: 'user-123',
      timestamp: '2025-04-03T10:00:00Z'
    },
    {
      id: 'msg-045',
      role: 'user',
      text: 'Actually I prefer red now',  // ← Appended, msg-001 still exists
      userId: 'user-123',
      timestamp: '2025-08-05T14:00:00Z'
    }
  ]
}

// Vector Memory: Searchable, versioned, references source
{
  id: 'mem-123',
  content: 'User prefers red',  // Current version (raw or summarized)
  embedding: [0.456, ...],  // Optional vector
  conversationRef: {
    conversationId: 'conv-456',
    messageIds: ['msg-045']  // ← Links to ACID source!
  },
  version: 2,
  previousVersions: [
    {
      version: 1,
      content: 'My favorite color is blue',
      conversationRef: { conversationId: 'conv-456', messageIds: ['msg-001'] },
      timestamp: '2025-04-03T10:00:00Z'
    }
  ],  // Subject to retention (default: 10 versions)
  metadata: { importance: 60, tags: ['preferences', 'color'] }
}
```

**Key Insight**: Vector memories can have retention limits (10 versions), but the ACID conversation source is always preserved. You can always retrieve full context via `conversationRef`.

## Basic Operations

### Storing Messages

Conversations are **append-only** - messages are never modified or deleted:

```typescript
// Store a user message (immutable)
const msg1 = await cortex.conversations.addMessage('conv-123', {
  role: 'user',
  content: 'What's the weather like today?',
  userId: 'user-123',
  timestamp: new Date()
});
console.log(msg1.id); // 'msg-001' - use this in conversationRef!

// Store agent response (immutable)
const msg2 = await cortex.conversations.addMessage('conv-123', {
  role: 'agent',
  content: 'The weather is sunny and 72°F.',
  agentId: 'agent-1',
  timestamp: new Date()
});

// Messages are NEVER modified - append-only!
// This conversation history is the source of truth
```

**ACID Properties:**
- **Atomicity**: Message fully stored or not at all
- **Consistency**: Conversation always in valid state
- **Isolation**: Concurrent messages don't interfere
- **Durability**: Once stored, never lost

**Conversation Types:**

Cortex stores TWO types of conversations in ACID:

```typescript
// Type 1: User-Agent Conversations
{
  conversationId: 'conv-456',
  type: 'user-agent',
  participants: {
    userId: 'user-123',
    agentId: 'agent-1'
  },
  messages: [
    { id: 'msg-001', role: 'user', text: '...', timestamp: T1 },
    { id: 'msg-002', role: 'agent', text: '...', timestamp: T2 }
  ]
}

// Type 2: Agent-Agent Conversations (A2A)
{
  conversationId: 'a2a-conv-789',
  type: 'agent-agent',
  participants: {
    agent1: 'finance-agent',
    agent2: 'hr-agent'
  },
  messages: [
    { id: 'a2a-msg-001', from: 'finance-agent', to: 'hr-agent', text: '...', timestamp: T1 },
    { id: 'a2a-msg-002', from: 'hr-agent', to: 'finance-agent', text: '...', timestamp: T2 }
  ]
}
```

Both are **immutable, append-only, kept forever**.

### Retrieving Conversation History

```typescript
// Get recent messages from user-agent conversation
const history = await cortex.conversations.getHistory('conv-123', {
  limit: 50,  // Last 50 messages
  order: 'desc'  // Most recent first
});

history.forEach(msg => {
  console.log(`${msg.role}: ${msg.content}`);
});

// Get A2A conversation history
const a2aHistory = await cortex.conversations.getHistory('a2a-conv-789', {
  limit: 50
});

a2aHistory.forEach(msg => {
  console.log(`${msg.from} → ${msg.to}: ${msg.text}`);
});
```

### Get Specific Conversation

```typescript
// Get user-agent conversation
const conversation = await cortex.conversations.get('conv-123');

console.log({
  id: conversation.id,
  type: conversation.type,  // 'user-agent'
  userId: conversation.participants.userId,
  agentId: conversation.participants.agentId,
  messageCount: conversation.messageCount,
  createdAt: conversation.createdAt,
  lastMessageAt: conversation.lastMessageAt
});

// Get A2A conversation
const a2aConvo = await cortex.conversations.get('a2a-conv-789');

console.log({
  id: a2aConvo.id,
  type: a2aConvo.type,  // 'agent-agent'
  agent1: a2aConvo.participants.agent1,
  agent2: a2aConvo.participants.agent2,
  messageCount: a2aConvo.messageCount
});
```

## Universal Filters for Conversations

> **Core Principle**: Conversation operations support universal filters like memory operations

```typescript
// The same filter patterns work:
const filters = {
  type: 'user-agent',  // or 'agent-agent'
  'participants.userId': 'user-123',
  createdAfter: new Date('2025-10-01'),
  metadata: { channel: 'web' }
};

// List
await cortex.conversations.list(filters);

// Count
await cortex.conversations.count(filters);

// Search
await cortex.conversations.search(query, filters);

// Delete (with caution!)
await cortex.conversations.deleteMany(filters);

// Export
await cortex.conversations.export(filters);
```

**Supported Filters:**
- `type` - 'user-agent' or 'agent-agent'
- `participants.*` - userId, agentId, agent1, agent2
- `createdBefore/After` - Date ranges
- `lastMessageBefore/After` - Activity date ranges
- `messageCount` - Number of messages
- `metadata.*` - Any metadata field

## Conversation Management

### Creating Conversations

```typescript
// Create user-agent conversation
const conversation = await cortex.conversations.create({
  type: 'user-agent',  // Default
  participants: {
    userId: 'user-123',
    agentId: 'agent-1'
  },
  metadata: {
    channel: 'web',
    source: 'chat-widget',
    tags: ['support']
  }
});

console.log(conversation.id); // "conv_abc123"
console.log(conversation.type); // "user-agent"

// Create A2A conversation (usually handled by cortex.a2a.send())
const a2aConvo = await cortex.conversations.create({
  type: 'agent-agent',
  participants: {
    agent1: 'finance-agent',
    agent2: 'hr-agent'
  },
  metadata: {
    purpose: 'budget-coordination',
    tags: ['a2a', 'budget']
  }
});

console.log(a2aConvo.id); // "a2a-conv_xyz789"
console.log(a2aConvo.type); // "agent-agent"
```

### Listing Conversations

```typescript
// Get all user-agent conversations for a user
const userConversations = await cortex.conversations.list({
  type: 'user-agent',
  'participants.userId': 'user-123',
  sortBy: 'lastMessageAt',
  sortOrder: 'desc',
  limit: 20
});

// Get A2A conversations for an agent
const a2aConversations = await cortex.conversations.list({
  type: 'agent-agent',
  participants: { $contains: 'finance-agent' },  // Any conversation involving this agent
  sortBy: 'lastMessageAt',
  sortOrder: 'desc'
});

// Get all conversations (both types)
const allConversations = await cortex.conversations.list({
  sortBy: 'lastMessageAt',
  sortOrder: 'desc',
  limit: 50
});

// Filter by agent
const withSupportAgent = await cortex.conversations.list({
  type: 'user-agent',
  'participants.agentId': 'support-agent'
});
```

### Searching Conversations

```typescript
// Search across user's conversation history
const results = await cortex.conversations.search('user-123', 
  'when did we discuss pricing?',
  {
    type: 'user-agent',  // Only user conversations
    embedding: await embed('pricing discussion'),  // Optional
    limit: 10
  }
);

results.forEach(result => {
  console.log(`Found in conversation ${result.conversationId}:`);
  console.log(`  "${result.snippet}"`);
  console.log(`  Relevance: ${result.score}`);
});

// Search A2A conversations between agents
const a2aResults = await cortex.conversations.search(null,  // No userId for A2A
  'budget discussions',
  {
    type: 'agent-agent',
    participants: { $contains: 'finance-agent' },
    embedding: await embed('budget discussions'),
    limit: 10
  }
);

// Or use Vector Memory for semantic search across both types
const vectorSearch = await cortex.memory.search('finance-agent', 'budget discussions', {
  embedding: await embed('budget discussions'),
  source: { type: { $in: ['conversation', 'a2a'] } }  // Both types
});
// Then retrieve full ACID conversations via conversationRef
```

## Building Context from History

### Recent Context

```typescript
async function buildRecentContext(conversationId: string) {
  // Get last 10 messages from ACID store
  const history = await cortex.conversations.getHistory(conversationId, {
    limit: 10
  });
  
  // Format for LLM
  const context = history.map(msg => 
    `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
  ).join('\n');
  
  return context;
}

// ACID conversations = perfect for recent context
// No vector search needed for chronological retrieval
```

### Relevant Context (Semantic via Vector Memories)

```typescript
async function buildRelevantContext(
  agentId: string,
  userId: string,
  currentMessage: string,
  conversationId: string
) {
  // Search vector memories for relevant knowledge
  const relevantMemories = await cortex.memory.search(agentId, currentMessage, {
    embedding: await embed(currentMessage),  // Semantic search
    userId,
    limit: 5
  });
  
  // For each memory, can retrieve full conversation context
  const enriched = await Promise.all(
    relevantMemories.map(async (memory) => {
      if (memory.conversationRef) {
        // Get full conversation from ACID
        const conversation = await cortex.conversations.get(
          memory.conversationRef.conversationId
        );
        
        // Get the specific message(s)
        const sourceMessages = conversation.messages.filter(m => 
          memory.conversationRef.messageIds.includes(m.id)
        );
        
        return {
          summary: memory.content,  // From vector index
          fullContext: sourceMessages.map(m => m.text).join(' '),  // From ACID
          when: sourceMessages[0].timestamp
        };
      }
      
      return {
        summary: memory.content,
        fullContext: memory.content,  // Non-conversation memory
        when: memory.createdAt
      };
    })
  );
  
  return enriched;
}

// Vector memories = fast semantic search
// ACID conversations = complete context when needed
// conversationRef = the link between them!
```

## Conversation Analytics

### Conversation Metrics

```typescript
const conversation = await cortex.conversations.get('conv-123');

console.log({
  messageCount: conversation.messageCount,
  duration: conversation.lastMessageAt - conversation.createdAt,
  avgResponseTime: conversation.metadata.avgResponseTime,
  userSatisfaction: conversation.metadata.satisfaction
});
```

### User Engagement

```typescript
// Analyze user's conversation patterns
const userConvs = await cortex.conversations.list({
  userId: 'user-123'
});

const stats = {
  totalConversations: userConvs.length,
  totalMessages: userConvs.reduce((sum, c) => sum + c.messageCount, 0),
  avgMessagesPerConv: userConvs.reduce((sum, c) => sum + c.messageCount, 0) / userConvs.length,
  mostActiveAgent: findMostFrequent(userConvs.map(c => c.agentId))
};
```

## Advanced Features

### Conversation Summaries

Generate summaries of long conversations:

```typescript
async function summarizeConversation(conversationId: string) {
  const history = await cortex.conversations.getHistory(conversationId);
  
  // Extract key points
  const summary = await llm.complete({
    prompt: `Summarize this conversation:\n${formatHistory(history)}`,
    maxTokens: 200
  });
  
  // Store summary as metadata
  await cortex.conversations.update(conversationId, {
    metadata: {
      summary: summary,
      summarizedAt: new Date()
    }
  });
  
  // Store as agent memory for future reference
  await cortex.memory.store(agentId, {
    content: `Conversation summary: ${summary}`,
    embedding: await embed(summary),
    metadata: {
      tags: ['summary', 'conversation'],
      conversationId
    }
  });
}
```

### Conversation Topics

Track conversation topics:

```typescript
async function extractConversationTopics(conversationId: string) {
  const history = await cortex.conversations.getHistory(conversationId);
  
  // Extract topics from messages
  const allText = history.map(m => m.content).join(' ');
  const topics = await extractTopics(allText);  // Your topic extraction
  
  // Store as metadata
  await cortex.conversations.update(conversationId, {
    metadata: {
      topics,
      topicsExtractedAt: new Date()
    }
  });
  
  return topics;
}
```

### Message Threading

Link related messages:

```typescript
// Store message with thread reference
await cortex.conversations.addMessage('conv-123', {
  role: 'user',
  content: 'Actually, about what I said earlier...',
  userId: 'user-123',
  metadata: {
    threadId: 'thread-456',  // Links to previous topic
    referencesMessageId: 'msg-789'  // Specific message reference
  }
});

// Retrieve thread
const thread = await cortex.conversations.getThread('conv-123', 'thread-456');
```

## Real-World Patterns

### Pattern: Multi-Session Continuity

```typescript
async function handleReturningUser(userId: string, newMessage: string, agentId: string) {
  // Find user's recent user-agent conversations
  const conversations = await cortex.conversations.list({
    type: 'user-agent',
    'participants.userId': userId,
    'participants.agentId': agentId,
    sortBy: 'lastMessageAt',
    sortOrder: 'desc',
    limit: 5
  });
  
  // Check if continuing previous conversation
  const lastConv = conversations[0];
  const timeSinceLast = lastConv 
    ? Date.now() - lastConv.lastMessageAt.getTime()
    : Infinity;
  
  let conversationId;
  if (timeSinceLast < 30 * 60 * 1000) {  // Less than 30 minutes
    // Continue previous conversation
    conversationId = lastConv.id;
    console.log('Continuing previous conversation');
  } else {
    // Start new conversation
    const newConv = await cortex.conversations.create({
      type: 'user-agent',
      participants: {
        userId,
        agentId
      },
      metadata: {
        channel: 'web',
        sessionId: generateSessionId()
      }
    });
    conversationId = newConv.id;
    console.log('Starting new conversation');
  }
  
  // Add message to ACID conversation (immutable)
  const msg = await cortex.conversations.addMessage(conversationId, {
    role: 'user',
    content: newMessage,
    userId,
    timestamp: new Date()
  });
  
  // Also index in Vector Memory for searchability
  await cortex.memory.store(agentId, {
    content: newMessage,
    contentType: 'raw',
    embedding: await embed(newMessage),  // Optional
    userId,
    source: { type: 'conversation', userId, timestamp: new Date() },
    conversationRef: {
      conversationId,
      messageIds: [msg.id]
    },
    metadata: { importance: 50, tags: ['user-input'] }
  });
  
  return conversationId;
}
```

### Pattern: Context Window Management

```typescript
async function buildContextWindow(conversationId: string, maxTokens: number) {
  // Get all messages
  const messages = await cortex.conversations.getHistory(conversationId);
  
  // Build context from newest to oldest until token limit
  const contextMessages = [];
  let tokenCount = 0;
  
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const msgTokens = estimateTokens(msg.content);
    
    if (tokenCount + msgTokens > maxTokens) {
      break;  // Would exceed limit
    }
    
    contextMessages.unshift(msg);  // Add to front
    tokenCount += msgTokens;
  }
  
  return {
    messages: contextMessages,
    tokenCount,
    totalMessages: messages.length,
    includedMessages: contextMessages.length
  };
}
```

## Cloud Mode Features

> **Cloud Mode Only**: Advanced conversation features

### Conversation Analytics

- Message frequency over time
- Response time metrics
- User engagement scores
- Topic evolution tracking

### Auto-Summarization

Automatic summaries of long conversations:
- Daily summaries
- Per-topic summaries
- Key decision extraction

### Conversation Export

Export full conversations for:
- Compliance requirements
- Training data
- User data requests (GDPR)
- Analysis and reporting

## Best Practices

### 1. Store Complete Metadata

```typescript
// User-agent conversation message
await cortex.conversations.addMessage(conversationId, {
  role: 'user',
  content: message,
  userId,
  timestamp: new Date(),
  metadata: {
    channel: 'web',  // web, mobile, api, etc.
    device: 'desktop',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    sessionId: 'session-123'
  }
});

// A2A conversation message
await cortex.conversations.addMessage(a2aConversationId, {
  from: 'finance-agent',
  to: 'hr-agent',
  text: 'Budget request',
  timestamp: new Date(),
  metadata: {
    contextId: 'ctx-budget-456',
    importance: 85,
    priority: 'high'
  }
});
```

### 2. Handle Long Conversations

```typescript
// Summarize and trim long conversations
async function maintainConversation(conversationId: string) {
  const conversation = await cortex.conversations.get(conversationId);
  
  if (conversation.messageCount > 100) {
    // Summarize older messages
    const older = await cortex.conversations.getHistory(conversationId, {
      limit: 50,
      offset: 50  // Messages 50-100
    });
    
    const summary = await summarizeMessages(older);
    
    // Store summary as first message
    await cortex.conversations.prependMessage(conversationId, {
      role: 'system',
      content: `[Summary of previous discussion: ${summary}]`,
      metadata: { type: 'summary' }
    });
    
    // Archive old messages
    await cortex.conversations.archiveMessages(conversationId, {
      olderThan: older[older.length - 1].timestamp
    });
  }
}
```

### 3. Privacy Considerations

```typescript
// Redact sensitive information before storing in ACID
function redactSensitive(content: string): string {
  return content
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN REDACTED]')
    .replace(/\b\d{16}\b/g, '[CARD REDACTED]')
    .replace(/password[:\s]+\S+/gi, 'password: [REDACTED]');
}

// User-agent message
await cortex.conversations.addMessage(conversationId, {
  role: 'user',
  content: redactSensitive(userMessage),
  userId
});

// A2A message (also redact if contains sensitive data)
await cortex.conversations.addMessage(a2aConversationId, {
  from: 'agent-1',
  to: 'agent-2',
  text: redactSensitive(message)  // Applies to A2A too
});

// ACID is immutable - redact BEFORE storing!
```

## Summary

**ACID Conversations are the source of truth for:**
- ✅ User-agent conversations (chat history)
- ✅ Agent-agent conversations (A2A communication)
- ✅ Complete message threads (immutable, append-only)
- ✅ No retention limits (kept forever)
- ✅ Legal/compliance audit trails

**Vector Memories reference conversations via conversationRef:**
- ✅ Fast searchable knowledge index
- ✅ Versioned with retention rules
- ✅ Can always retrieve full ACID conversation
- ✅ Best of both: fast search + complete history

**Two conversation types:**
- **user-agent**: User chatting with agent
- **agent-agent**: Agent communicating with agent (A2A)

Both use same ACID storage, same immutability guarantees, same API patterns.

## Next Steps

- **[Access Analytics](./07-access-analytics.md)** - Track usage patterns
- **[Agent Memory](./01-agent-memory.md)** - Vector layer that references conversations
- **[A2A Communication](./05-a2a-communication.md)** - Agent-agent conversation helpers
- **[Dimension Strategies](../07-advanced-topics/02-dimension-strategies.md)** - Choosing embedding models

---

**Questions?** Ask in [GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions) or [Discord](https://discord.gg/cortex).

