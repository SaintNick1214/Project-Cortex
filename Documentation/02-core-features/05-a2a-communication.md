# Agent-to-Agent (A2A) Communication

> **Last Updated**: 2026-01-01

Convenience helpers for inter-agent communication built on top of Agent Memory.

## Overview

A2A communication is **not a separate storage system** - it's a set of convenience helpers that make inter-agent communication easier while using the standard agent memory system underneath.

**A2A = Agent Memory with source.type = 'a2a'**

```typescript
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Approach 1: A2A Helper (RECOMMENDED - 7 lines)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
await cortex.a2a.send({
  from: "finance-agent",
  to: "hr-agent",
  message: "What is the Q4 headcount budget?",
  importance: 85,
});
// Done! Handles ACID + both Vector memories automatically ✅

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Approach 2: Layer 3 remember() (Better than manual - 20 lines)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Get/create A2A conversation
const conversationId = await getOrCreateA2AConversation(
  "finance-agent",
  "hr-agent",
);

// Store in sender's memory (ACID + Vector)
await cortex.memory.remember({
  agentId: "finance-agent",
  conversationId,
  userMessage: "What is the Q4 budget?",
  agentResponse: "[Sent to hr-agent]",
  userId: "finance-agent", // Sender as "user"
  userName: "Finance Agent",
});

// Store in receiver's memory (ACID + Vector)
await cortex.memory.remember({
  agentId: "hr-agent",
  conversationId,
  userMessage: "[From finance-agent]",
  agentResponse: "What is the Q4 budget?",
  userId: "finance-agent", // Sender as source
  userName: "Finance Agent",
});
// Works, but awkward (remember() is for user-agent, not agent-agent)
// Still need to manage conversationId manually
// Have to call remember() twice (once per agent)

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Approach 3: Manual Layer 1 + Layer 2 (Most code - 50+ lines)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. Get or create A2A conversation in ACID (Layer 1a)
let conversationId;
const existing = await cortex.conversations.search({
  type: "agent-agent",
  participants: { $all: ["finance-agent", "hr-agent"] },
});

if (existing.length > 0) {
  conversationId = existing[0].conversationId;
} else {
  const conv = await cortex.conversations.create({
    type: "agent-agent",
    participants: { agent1: "finance-agent", agent2: "hr-agent" },
  });
  conversationId = conv.conversationId;
}

// 2. Add message to ACID conversation
const msg = await cortex.conversations.addMessage(conversationId, {
  type: "a2a",
  from: "finance-agent",
  to: "hr-agent",
  text: "What is the Q4 headcount budget?",
  timestamp: new Date(),
});

// 3. Store in sender's Vector memory (Layer 2)
await cortex.vector.store("finance-agent", {
  content: "Sent to hr-agent: What is the Q4 headcount budget?",
  contentType: "raw",
  embedding: await embed("What is the Q4 headcount budget?"),
  source: {
    type: "a2a",
    fromAgent: "finance-agent",
    toAgent: "hr-agent",
    timestamp: new Date(),
  },
  conversationRef: {
    conversationId,
    messageIds: [msg.id], // Links to ACID
  },
  metadata: {
    importance: 85,
    tags: ["a2a", "sent", "hr-agent"],
    direction: "outbound",
  },
});

// 4. Store in receiver's Vector memory (Layer 2)
await cortex.vector.store("hr-agent", {
  content: "Received from finance-agent: What is the Q4 headcount budget?",
  contentType: "raw",
  embedding: await embed("What is the Q4 headcount budget?"),
  source: {
    type: "a2a",
    fromAgent: "finance-agent",
    toAgent: "hr-agent",
    timestamp: new Date(),
  },
  conversationRef: {
    conversationId,
    messageIds: [msg.id], // Same ACID message
  },
  metadata: {
    importance: 85,
    tags: ["a2a", "received", "finance-agent"],
    direction: "inbound",
  },
});

// That's 50+ lines vs 7 lines with cortex.a2a.send()! 😱
```

**Code Reduction:**

| Approach                     | Lines of Code | Handles ACID | Bidirectional          | Complexity |
| ---------------------------- | ------------- | ------------ | ---------------------- | ---------- |
| **cortex.a2a.send()**        | 7             | ✅ Automatic | ✅ Both agents         | Low        |
| **cortex.memory.remember()** | ~20           | ✅ Automatic | ❌ One agent (call 2×) | Medium     |
| **Manual (Layer 1+2)**       | 50+           | ⚠️ Manual    | ❌ One agent (call 2×) | High       |

**Why cortex.a2a.send() is best for A2A:**

- Handles ACID conversation management (creates/finds agent-agent conversations)
- Stores in BOTH agents automatically (bidirectional)
- Consistent metadata and tagging
- One call instead of managing conversationId + 2× vector stores
- 85% less code

**How A2A fits in Cortex's architecture:**

- **ACID Conversations** (Layer 1): Stores complete A2A message threads
- **Vector Memories** (Layer 2): Searchable index with `source.type = 'a2a'`
- **conversationRef**: Links Vector memories to ACID conversation (default behavior)
- Can link to `contextId` (if part of workflow)
- Can have `userId` if A2A is about a specific user

## Core Concept

### A2A = Agent Memory with source.type = 'a2a'

Under the hood, A2A uses the **full 4-layer architecture** (ACID + Vector + Facts + Graph):

### Layer 1: ACID A2A Conversation (Immutable Thread)

```typescript
// Convex Table: conversations
{
  conversationId: 'a2a-conv-789',
  type: 'agent-agent',             // ← A2A conversation type
  participants: {
    agent1: 'finance-agent',
    agent2: 'hr-agent'
  },
  messages: [
    {
      id: 'a2a-msg-001',
      from: 'finance-agent',
      to: 'hr-agent',
      text: 'What is the Q4 budget?',
      timestamp: '2025-10-23T10:00:00Z'
    },
    {
      id: 'a2a-msg-002',
      from: 'hr-agent',
      to: 'finance-agent',
      text: '$50K approved',
      timestamp: '2025-10-23T10:00:15Z'
    }
  ],
  createdAt: Date,
  updatedAt: Date
}
// ← Immutable, append-only, kept forever (compliance, audit trail)
```

### Layer 2: Vector Memory Index (Searchable)

```typescript
// When you call cortex.a2a.send()...
// Sender's memory:
{
  id: 'mem_abc123',
  agentId: 'finance-agent',        // Sender's memory
  userId: 'user-123',              // Optional: if about a specific user

  content: 'Asked HR about budget',
  contentType: 'raw',
  embedding: [0.234, ...],         // Optional: for semantic search

  source: {
    type: 'a2a',                    // ← This marks it as A2A!
    fromAgent: 'finance-agent',
    toAgent: 'hr-agent',
    timestamp: new Date()
  },

  conversationRef: {                // ← Links to ACID A2A conversation!
    conversationId: 'a2a-conv-789',
    messageIds: ['a2a-msg-001']
  },

  metadata: {
    importance: 85,                 // 0-100 scale
    tags: ['a2a', 'sent', 'hr-agent'],
    direction: 'outbound',
    messageId: 'a2a-msg-001'
  },

  version: 1,
  createdAt: Date,
  updatedAt: Date
}

// Receiver's memory (automatically created):
{
  id: 'mem_def456',
  agentId: 'hr-agent',             // Receiver's memory
  userId: 'user-123',              // Same user context

  content: 'Received from Finance about budget',
  contentType: 'raw',
  embedding: [0.234, ...],         // Same embedding (if provided)

  source: {
    type: 'a2a',
    fromAgent: 'finance-agent',
    toAgent: 'hr-agent',
    timestamp: new Date()
  },

  conversationRef: {                // ← Same ACID conversation!
    conversationId: 'a2a-conv-789',
    messageIds: ['a2a-msg-001']
  },

  metadata: {
    importance: 85,
    tags: ['a2a', 'received', 'finance-agent'],
    direction: 'inbound',
    messageId: 'a2a-msg-001'
  }
}
```

**Benefits of ACID + Vector for A2A:**

- ✅ Complete A2A conversation history preserved in ACID (immutable, forever)
- ✅ Fast searchable index in Vector Memory
- ✅ Version retention on Vector, complete history in ACID
- ✅ Audit trail for agent communications
- ✅ Can display A2A conversation threads
- ✅ Same architecture as user conversations
- ✅ Compliance and debugging made easy

**When conversationRef might be omitted:**

- Fire-and-forget notifications
- Ephemeral status updates
- Set `trackConversation: false` to opt-out
- But **default is to track** (better audit trail)

## A2A Convenience Helpers

### 1. Send (Bidirectional Storage)

Send a message and automatically store in both agents:

```typescript
// Stores in BOTH agents automatically
const result = await cortex.a2a.send({
  from: "finance-agent",
  to: "hr-agent",
  message: "What is the Q4 headcount budget?",
  importance: 85, // 0-100 scale
  userId: "user-123", // Optional: if related to a user
  contextId: "ctx-456", // Optional: link to context chain
  metadata: {
    tags: ["budget", "headcount", "q4"],
    priority: "urgent",
  },
});

console.log(result);
// {
//   messageId: 'a2a-msg-123',
//   sentAt: Date,
//   senderMemoryId: 'mem-abc',     // Memory ID in sender's storage
//   receiverMemoryId: 'mem-def'    // Memory ID in receiver's storage
// }
```

**Under the Hood:**

```typescript
// cortex.a2a.send() does this:
async function send(params) {
  const messageId = generateId();
  const timestamp = new Date();

  // 1. Get or create A2A conversation in ACID (default: track conversation)
  const trackConversation = params.trackConversation !== false; // Default: true
  let conversationId,
    messageIds = [];

  if (trackConversation) {
    // Get existing A2A conversation or create new one
    conversationId = await getOrCreateA2AConversation(params.from, params.to);

    // Add message to ACID conversation (immutable)
    const msg = await cortex.conversations.addMessage(conversationId, {
      type: "a2a",
      from: params.from,
      to: params.to,
      text: params.message,
      timestamp,
    });

    messageIds = [msg.id];
  }

  // 2. Optional: Generate embedding if autoEmbed enabled (Cloud Mode)
  const embedding = params.autoEmbed ? await embed(params.message) : undefined;

  // 3. Store in sender's Vector Memory (Layer 2 - with ACID reference)
  const senderMemory = await cortex.vector.store(params.from, {
    content: `Sent to ${params.to}: ${params.message}`,
    contentType: "raw",
    embedding,
    userId: params.userId,
    source: {
      type: "a2a",
      fromAgent: params.from,
      toAgent: params.to,
      timestamp,
    },
    conversationRef: conversationId
      ? { conversationId, messageIds }
      : undefined,
    metadata: {
      importance: params.importance || 60,
      tags: ["a2a", "sent", params.to, ...(params.metadata?.tags || [])],
      direction: "outbound",
      messageId,
      ...(params.contextId && { contextId: params.contextId }),
      ...params.metadata,
    },
  });

  // 4. Store in receiver's Vector Memory (Layer 2 - with same ACID reference)
  const receiverMemory = await cortex.vector.store(params.to, {
    content: `Received from ${params.from}: ${params.message}`,
    contentType: "raw",
    embedding,
    userId: params.userId,
    source: {
      type: "a2a",
      fromAgent: params.from,
      toAgent: params.to,
      timestamp,
    },
    conversationRef: conversationId
      ? { conversationId, messageIds }
      : undefined,
    metadata: {
      importance: params.importance || 60,
      tags: ["a2a", "received", params.from, ...(params.metadata?.tags || [])],
      direction: "inbound",
      messageId,
      ...(params.contextId && { contextId: params.contextId }),
      ...params.metadata,
    },
  });

  return {
    messageId,
    sentAt: timestamp,
    conversationId, // ACID conversation ID
    senderMemoryId: senderMemory.id,
    receiverMemoryId: receiverMemory.id,
  };
}

// Helper: Get or create A2A conversation
async function getOrCreateA2AConversation(agent1: string, agent2: string) {
  // Look for existing conversation between these agents
  const existing = await cortex.conversations.search({
    type: "agent-agent",
    participants: { $all: [agent1, agent2] },
  });

  if (existing.length > 0) {
    return existing[0].conversationId;
  }

  // Create new A2A conversation
  const conversation = await cortex.conversations.create({
    type: "agent-agent",
    participants: { agent1, agent2 },
    metadata: {
      createdBy: agent1,
      firstMessageTimestamp: new Date(),
    },
  });

  return conversation.conversationId;
}
```

**Why use the helper:**

- ✅ 40+ lines → 7 lines (handles ACID + Vector + linking)
- ✅ Automatic bidirectional storage (both agents)
- ✅ Automatic ACID conversation management
- ✅ Consistent tagging and linking
- ✅ Message ID linking across layers
- ✅ Less code = fewer bugs

**Opting out of conversation tracking:**

```typescript
// For fire-and-forget notifications (no ACID tracking)
await cortex.a2a.send({
  from: "agent-1",
  to: "agent-2",
  message: "FYI: Task completed",
  trackConversation: false, // Skip ACID storage
  importance: 30, // Low importance notification
});

// Stores in Vector Memory only (no conversationRef)
// Use for: status updates, ephemeral notifications, high-volume low-value messages
```

### 2. Request (Synchronous Request-Response)

Send a request and wait for response with timeout:

```typescript
// Send request and wait for response
const response = await cortex.a2a.request({
  from: "finance-agent",
  to: "hr-agent",
  message: "What is the Q4 headcount budget?",
  timeout: 30000, // 30 seconds (default)
  importance: 85,
  retries: 2, // Auto-retry if timeout (default: 1)
});

console.log(response);
// {
//   response: '5 new hires approved',
//   messageId: 'a2a-msg-123',
//   respondedAt: Date,
//   responseTime: 2453  // ms
// }
```

**Under the Hood:**

```typescript
async function request(params) {
  // 1. Send the request
  const sent = await send({
    from: params.from,
    to: params.to,
    message: params.message,
    importance: params.importance,
    metadata: {
      messageType: "request",
      requiresResponse: true,
      requestTimeout: params.timeout,
    },
  });

  // 2. Wait for response (polls receiver's outgoing messages)
  const startTime = Date.now();
  const timeout = params.timeout || 30000;

  while (Date.now() - startTime < timeout) {
    // Check if receiver responded
    const responses = await cortex.memory.search(params.to, "*", {
      source: { type: "a2a" },
      metadata: {
        inReplyTo: sent.messageId,
        messageType: "response",
      },
      limit: 1,
    });

    if (responses.length > 0) {
      // Got response!
      return {
        response: responses[0].content,
        messageId: sent.messageId,
        respondedAt: responses[0].createdAt,
        responseTime: Date.now() - startTime,
      };
    }

    await sleep(100); // Poll every 100ms
  }

  // Timeout
  throw new A2ATimeoutError(
    `No response from ${params.to} within ${timeout}ms`,
  );
}
```

**Why use the helper:**

- ✅ Automatic polling
- ✅ Timeout handling
- ✅ Auto-retry on failure
- ✅ Response time tracking
- ✅ 30+ lines of polling logic → 1 function call

### 3. Broadcast (One-to-Many)

Send to multiple agents efficiently:

```typescript
// Broadcast to entire team
const result = await cortex.a2a.broadcast({
  from: "ceo-agent",
  to: ["finance-agent", "hr-agent", "ops-agent"],
  message: "Board meeting moved to Friday 3 PM",
  importance: 75,
  metadata: {
    tags: ["announcement", "meeting", "urgent"],
  },
});

console.log(result);
// {
//   messageId: 'a2a-broadcast-456',
//   sentAt: Date,
//   recipients: ['finance-agent', 'hr-agent', 'ops-agent'],
//   memoriesCreated: 6,  // 2 per recipient (sender + receiver)
//   senderMemoryIds: ['mem-1', 'mem-2', 'mem-3'],
//   receiverMemoryIds: ['mem-4', 'mem-5', 'mem-6']
// }
```

**Under the Hood:**

```typescript
async function broadcast(params) {
  const messageId = generateId();
  const timestamp = new Date();
  const results = {
    messageId,
    sentAt: timestamp,
    recipients: params.to,
    senderMemoryIds: [],
    receiverMemoryIds: [],
  };

  // Store for sender (one memory referencing all recipients) - Layer 2
  for (const recipient of params.to) {
    const senderMem = await cortex.vector.store(params.from, {
      content: `Broadcast to ${recipient}: ${params.message}`,
      contentType: "raw",
      userId: params.userId,
      source: {
        type: "a2a",
        fromAgent: params.from,
        toAgent: recipient,
        timestamp,
      },
      metadata: {
        importance: params.importance || 60,
        tags: [
          "a2a",
          "broadcast",
          "sent",
          recipient,
          ...(params.metadata?.tags || []),
        ],
        direction: "outbound",
        messageId,
        broadcastId: messageId,
        recipientCount: params.to.length,
      },
    });
    results.senderMemoryIds.push(senderMem.id);

    // Store for each receiver (Layer 2)
    const receiverMem = await cortex.vector.store(recipient, {
      content: `Broadcast from ${params.from}: ${params.message}`,
      contentType: "raw",
      userId: params.userId,
      source: {
        type: "a2a",
        fromAgent: params.from,
        toAgent: recipient,
        timestamp,
      },
      metadata: {
        importance: params.importance || 60,
        tags: [
          "a2a",
          "broadcast",
          "received",
          params.from,
          ...(params.metadata?.tags || []),
        ],
        direction: "inbound",
        messageId,
        broadcastId: messageId,
      },
    });
    results.receiverMemoryIds.push(receiverMem.id);
  }

  return {
    ...results,
    memoriesCreated:
      results.senderMemoryIds.length + results.receiverMemoryIds.length,
  };
}
```

**Why use the helper:**

- ✅ 40+ lines of loop code → 1 function call
- ✅ Automatic recipient tracking
- ✅ Broadcast ID linking
- ✅ Bulk storage optimization

### 4. Get Conversation (Rich Filtering)

Get chronological conversation between two agents - can use ACID or Vector:

```typescript
// Option 1: Get from ACID (complete, unfiltered conversation)
const acidConversation = await cortex.conversations.getA2AConversation(
  "finance-agent",
  "hr-agent",
);

console.log(acidConversation);
// {
//   conversationId: 'a2a-conv-789',
//   participants: { agent1: 'finance-agent', agent2: 'hr-agent' },
//   messages: [
//     { id: 'a2a-msg-001', from: 'finance-agent', text: '...', timestamp: T1 },
//     { id: 'a2a-msg-002', from: 'hr-agent', text: '...', timestamp: T2 },
//     // ... ALL messages (complete history)
//   ]
// }

// Option 2: Get from Vector Memory (filtered, searchable)
const conversation = await cortex.a2a.getConversation(
  "finance-agent",
  "hr-agent",
  {
    // Time filtering
    since: new Date("2025-10-01"),
    until: new Date("2025-10-31"),

    // Importance filtering
    minImportance: 50, // Skip trivial messages

    // Topic filtering
    tags: ["budget", "approval"],

    // User filtering (A2A about specific user)
    userId: "user-123",

    // Pagination
    limit: 50,
    offset: 0,

    // Format
    format: "chronological", // Default
  },
);

console.log(conversation);
// {
//   participants: ['finance-agent', 'hr-agent'],
//   messageCount: 23,  // Filtered count
//   conversationId: 'a2a-conv-789',  // ACID source
//   messages: [
//     {
//       from: 'finance-agent',
//       to: 'hr-agent',
//       message: 'What is the Q4 budget?',
//       importance: 85,
//       timestamp: Date,
//       messageId: 'a2a-msg-123',
//       acidMessageId: 'a2a-msg-001'  // Reference to ACID
//     },
//     // ... filtered by criteria
//   ],
//   period: { start: Date, end: Date },
//   tags: ['budget', 'approval']
// }

// Can always get complete unfiltered history from ACID
const fullHistory = await cortex.conversations.get(conversation.conversationId);
```

**Under the Hood:**

```typescript
async function getConversation(agent1, agent2, filters = {}) {
  // Strategy 1: Try to get ACID conversation first (if exists)
  const acidConversation = await cortex.conversations.search({
    type: "agent-agent",
    participants: { $all: [agent1, agent2] },
  });

  const conversationId = acidConversation[0]?.conversationId;

  if (conversationId && !filters.minImportance && !filters.tags) {
    // No filtering - return complete ACID conversation
    const full = await cortex.conversations.get(conversationId);
    return formatA2AConversation(full, filters);
  }

  // Strategy 2: Query Vector Memory for filtered results
  // Get messages from agent1 to agent2
  const sent = await cortex.memory.search(agent1, "*", {
    source: { type: "a2a" },
    metadata: {
      direction: "outbound",
      toAgent: agent2,
    },
    ...(filters.userId && { userId: filters.userId }),
    ...(filters.tags && { tags: filters.tags }),
    ...(filters.minImportance && { minImportance: filters.minImportance }),
    ...(filters.since && { createdAfter: filters.since }),
    ...(filters.until && { createdBefore: filters.until }),
    limit: filters.limit || 1000,
  });

  // Get messages from agent2 to agent1
  const received = await cortex.memory.search(agent1, "*", {
    source: { type: "a2a" },
    metadata: {
      direction: "inbound",
      fromAgent: agent2,
    },
    ...(filters.userId && { userId: filters.userId }),
    ...(filters.tags && { tags: filters.tags }),
    ...(filters.minImportance && { minImportance: filters.minImportance }),
    ...(filters.since && { createdAfter: filters.since }),
    ...(filters.until && { createdBefore: filters.until }),
    limit: filters.limit || 1000,
  });

  // Combine and sort chronologically
  const allMessages = [...sent, ...received]
    .map((m) => ({
      from: m.metadata.direction === "outbound" ? agent1 : agent2,
      to: m.metadata.direction === "outbound" ? agent2 : agent1,
      message: m.content,
      importance: m.metadata.importance,
      timestamp: m.createdAt,
      messageId: m.metadata.messageId,
      memoryId: m.id,
      acidMessageId: m.conversationRef?.messageIds[0], // Link to ACID
      tags: m.metadata.tags,
    }))
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  return {
    participants: [agent1, agent2],
    conversationId, // ACID conversation ID (if exists)
    messageCount: allMessages.length,
    messages: allMessages,
    period: {
      start: allMessages[0]?.timestamp,
      end: allMessages[allMessages.length - 1]?.timestamp,
    },
    tags: filters.tags,
    canRetrieveFullHistory: !!conversationId, // Can get from ACID
  };
}
```

**Why use the helper:**

- ✅ 50+ lines → 3 lines (handles ACID lookup + Vector filtering)
- ✅ Automatic bidirectional querying
- ✅ Chronological sorting
- ✅ Clean conversation format
- ✅ Handles pagination
- ✅ Links to ACID source for complete history

## Complete A2A API

```typescript
interface A2AHelper {
  // Send message (stores in ACID + both Vector memories)
  send(params: {
    from: string;
    to: string;
    message: string;
    importance?: number; // 0-100, default: 60
    userId?: string; // Optional: if A2A is about a user
    contextId?: string; // Optional: link to context chain
    trackConversation?: boolean; // Default: true (store in ACID)
    autoEmbed?: boolean; // Cloud Mode: auto-generate embeddings
    metadata?: {
      tags?: string[];
      priority?: "low" | "normal" | "high" | "urgent";
      [key: string]: any;
    };
  }): Promise<A2AMessage>;

  // Request with timeout (synchronous request-response)
  request(params: {
    from: string;
    to: string;
    message: string;
    timeout?: number; // ms, default: 30000
    importance?: number;
    retries?: number; // default: 1
    userId?: string;
    contextId?: string;
  }): Promise<A2AResponse>;

  // Broadcast (one-to-many)
  broadcast(params: {
    from: string;
    to: string[];
    message: string;
    importance?: number;
    userId?: string;
    contextId?: string;
    metadata?: any;
  }): Promise<A2ABroadcastResult>;

  // Get conversation (rich filtering)
  getConversation(
    agent1: string,
    agent2: string,
    filters?: {
      since?: Date;
      until?: Date;
      minImportance?: number;
      tags?: string[];
      userId?: string;
      limit?: number;
      offset?: number;
      format?: "chronological";
    },
  ): Promise<A2AConversation>;
}

// Remember: All of these use cortex.memory underneath!
```

## Using A2A Helpers

### Basic Communication

```typescript
// Simple one-way message
await cortex.a2a.send({
  from: "sales-agent",
  to: "support-agent",
  message: "Customer is asking about enterprise pricing",
  importance: 70,
});

// Sender sees:
const sent = await cortex.memory.search("sales-agent", "*", {
  source: { type: "a2a" },
  metadata: { direction: "outbound", toAgent: "support-agent" },
  limit: 10,
});

// Receiver sees:
const inbox = await cortex.memory.search("support-agent", "*", {
  source: { type: "a2a" },
  metadata: { direction: "inbound", fromAgent: "sales-agent" },
  limit: 10,
});
```

### Request-Response Pattern

```typescript
// Agent asks another agent and waits for response
async function askAboutBudget(fromAgent: string, toAgent: string) {
  try {
    const response = await cortex.a2a.request({
      from: fromAgent,
      to: toAgent,
      message: "What is your Q4 budget allocation?",
      timeout: 30000,
      importance: 85,
      retries: 2, // Will retry twice if timeout
    });

    console.log(`Response: ${response.response}`);
    console.log(`Response time: ${response.responseTime}ms`);

    return response.response;
  } catch (error) {
    if (error instanceof A2ATimeoutError) {
      console.log(`${toAgent} didn't respond within 30 seconds`);
      // Fallback logic
      return null;
    }
    throw error;
  }
}

// The receiving agent responds like this:
async function handleIncomingRequests(agentId: string) {
  // Get pending requests (using memory filters!)
  const requests = await cortex.memory.search(agentId, "*", {
    source: { type: "a2a" },
    metadata: {
      messageType: "request",
      requiresResponse: true,
      responded: { $ne: true }, // Not yet responded
    },
  });

  for (const request of requests) {
    // Process and respond
    const response = await processRequest(request.content);

    // Send response (links back to request)
    await cortex.a2a.send({
      from: agentId,
      to: request.source.fromAgent,
      message: response,
      importance: request.metadata.importance,
      metadata: {
        messageType: "response",
        inReplyTo: request.metadata.messageId,
      },
    });

    // Mark request as responded (update original memory)
    await cortex.memory.update(agentId, request.id, {
      metadata: {
        ...request.metadata,
        responded: true,
        respondedAt: new Date(),
      },
    });
  }
}
```

### Broadcast Communication

```typescript
// Notify entire team
const result = await cortex.a2a.broadcast({
  from: "manager-agent",
  to: ["dev-agent-1", "dev-agent-2", "qa-agent", "designer-agent"],
  message: "Sprint review meeting Friday at 2 PM",
  importance: 70,
  contextId: "ctx-sprint-23",
  metadata: {
    tags: ["meeting", "sprint-review", "team"],
    meetingId: "meeting-456",
  },
});

console.log(`Broadcast sent to ${result.recipients.length} agents`);
console.log(`Created ${result.memoriesCreated} memories`);

// Each recipient can query their messages
const myMessages = await cortex.memory.search("dev-agent-1", "*", {
  source: { type: "a2a" },
  metadata: {
    broadcast: true,
    fromAgent: "manager-agent",
  },
});
```

### Conversation View

```typescript
// Get chronological conversation between two agents
const convo = await cortex.a2a.getConversation("finance-agent", "hr-agent", {
  since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
  minImportance: 50, // Skip low-importance messages
  tags: ["budget"], // Only budget-related
  limit: 100,
});

// Display as chat thread
convo.messages.forEach((msg) => {
  console.log(`[${formatTime(msg.timestamp)}] ${msg.from} → ${msg.to}`);
  console.log(`  ${msg.message}`);
  console.log(`  Importance: ${msg.importance}/100`);
});

// Or use standard memory search for more control
const customQuery = await cortex.memory.search("finance-agent", "*", {
  source: { type: "a2a" },
  metadata: {
    $or: [{ toAgent: "hr-agent" }, { fromAgent: "hr-agent" }],
  },
  tags: ["budget"],
  minImportance: 50,
  createdAfter: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  sortBy: "createdAt",
  sortOrder: "asc", // Chronological
});
```

## Querying A2A Communications

Since A2A uses agent memory, use standard memory queries:

### Find All A2A Messages

```typescript
// All A2A for an agent
const allA2A = await cortex.memory.search("agent-1", "*", {
  source: { type: "a2a" },
});

// Sent messages only
const sent = await cortex.memory.search("agent-1", "*", {
  source: { type: "a2a" },
  metadata: { direction: "outbound" },
});

// Received messages only
const received = await cortex.memory.search("agent-1", "*", {
  source: { type: "a2a" },
  metadata: { direction: "inbound" },
});
```

### Find Messages with Specific Agent

```typescript
// All communication with HR agent
const withHR = await cortex.memory.search("finance-agent", "*", {
  source: { type: "a2a" },
  metadata: {
    $or: [
      { toAgent: "hr-agent" }, // Sent to HR
      { fromAgent: "hr-agent" }, // Received from HR
    ],
  },
});

// Sent to HR only
const sentToHR = await cortex.memory.search("finance-agent", "*", {
  source: { type: "a2a" },
  metadata: {
    direction: "outbound",
    toAgent: "hr-agent",
  },
});
```

### Find by Topic/Tags

```typescript
// All budget-related A2A messages
const budgetComms = await cortex.memory.search("finance-agent", "*", {
  source: { type: "a2a" },
  tags: ["budget"],
});

// Urgent A2A messages
const urgent = await cortex.memory.search("agent-1", "*", {
  source: { type: "a2a" },
  importance: { $gte: 85 },
  metadata: { priority: "urgent" },
});
```

### Find Unanswered Requests

```typescript
// Pending requests needing response
const pending = await cortex.memory.search("hr-agent", "*", {
  source: { type: "a2a" },
  metadata: {
    messageType: "request",
    requiresResponse: true,
    responded: { $ne: true }, // Not responded yet
  },
  sortBy: "createdAt",
  sortOrder: "asc", // Oldest first
});

console.log(`${pending.length} pending requests`);
```

## Real-World Patterns

### Pattern 1: Delegation with Full Traceability

```typescript
// User requests refund (stored in ACID)
const userMsg = await cortex.conversations.addMessage("conv-456", {
  role: "user",
  text: "I need a refund for order #789",
  userId: "customer-abc",
});

// Create context for workflow
const context = await cortex.contexts.create({
  purpose: "Process refund for order #789",
  agentId: "supervisor-agent",
  userId: "customer-abc",
  conversationRef: {
    conversationId: "conv-456",
    messageIds: [userMsg.id], // Links to ACID source
  },
  data: { importance: 85, tags: ["refund", "urgent"] },
});

// Supervisor delegates via A2A (with full traceability)
const result = await cortex.a2a.send({
  from: "supervisor-agent",
  to: "specialist-agent",
  message: "Please handle the customer refund for ticket #456",
  importance: 85,
  userId: "customer-abc", // User this is about
  contextId: context.id, // Links to workflow
  conversationRef: {
    // Links back to original user message!
    conversationId: "conv-456",
    messageIds: [userMsg.id],
  },
  metadata: {
    tags: ["delegation", "refund", "urgent"],
    ticketId: "TICKET-456",
  },
});

// Now specialist has complete traceability:
// 1. Can access context chain
const ctx = await cortex.contexts.get(context.id);

// 2. Can see original user conversation from ACID
if (ctx.conversationRef) {
  const conversation = await cortex.conversations.get(
    ctx.conversationRef.conversationId,
  );
  const originalRequest = conversation.messages.find(
    (m) => m.id === userMsg.id,
  );
  console.log("Original user request:", originalRequest.text);
}

// 3. Can query the delegation in their memory
const delegations = await cortex.memory.search("specialist-agent", "*", {
  source: { type: "a2a" },
  tags: ["delegation"],
  metadata: { contextId: context.id },
});
```

### Pattern 2: Team Announcements

```typescript
// Manager announces to team
const team = ["agent-1", "agent-2", "agent-3"];

await cortex.a2a.broadcast({
  from: "manager-agent",
  to: team,
  message: "New policy: All refunds over $1000 require manager approval",
  importance: 90,
  metadata: {
    tags: ["policy", "announcement", "important"],
    policyId: "POL-789",
  },
});

// Each agent queries their announcements
const announcements = await cortex.memory.search("agent-1", "*", {
  source: { type: "a2a" },
  metadata: { broadcast: true },
  tags: ["announcement"],
  sortBy: "createdAt",
  sortOrder: "desc",
  limit: 10,
});
```

### Pattern 3: Collaboration History with Full Audit Trail

```typescript
// Get collaboration history for audit
async function getCollaborationAudit(
  agent1: string,
  agent2: string,
  startDate: Date,
  endDate: Date,
) {
  // Get A2A conversation (from Vector Memory)
  const conversation = await cortex.a2a.getConversation(agent1, agent2, {
    since: startDate,
    until: endDate,
    minImportance: 70, // Only important communications
  });

  // Optionally enrich with ACID conversation sources (if any A2A linked to user convos)
  const enriched = await Promise.all(
    conversation.messages.map(async (msg) => {
      const memory = await cortex.memory.get(agent1, msg.memoryId);

      if (memory.conversationRef) {
        // This A2A was handling a user conversation
        const userConvo = await cortex.conversations.get(
          memory.conversationRef.conversationId,
        );
        return {
          ...msg,
          originatedFromUser: true,
          userConversation: userConvo.conversationId,
        };
      }

      return msg;
    }),
  );

  // Format for audit report
  return {
    agents: [agent1, agent2],
    period: { start: startDate, end: endDate },
    totalCommunications: conversation.messageCount,
    criticalCommunications: conversation.messages.filter(
      (m) => m.importance >= 90,
    ).length,
    userTriggered: enriched.filter((m) => m.originatedFromUser).length,
    topics: [...new Set(conversation.messages.flatMap((m) => m.tags))],
    timeline: enriched.map((m) => ({
      timestamp: m.timestamp,
      from: m.from,
      to: m.to,
      summary: m.message.substring(0, 100),
      importance: m.importance,
      userTriggered: m.originatedFromUser || false,
    })),
  };
}
```

## Direct Memory Access (When Needed)

Sometimes you need more control - use memory API directly with full hybrid architecture power:

```typescript
// Complex semantic query across A2A messages
const complexQuery = await cortex.memory.search("agent-1", "budget approval", {
  embedding: await embed("budget approval"), // Semantic search
  source: { type: "a2a" }, // Only A2A
  importance: { $gte: 80, $lte: 95 }, // Specific range
  createdAfter: new Date("2025-10-01"),
  accessCount: { $gte: 5 }, // Frequently referenced
  version: { $gte: 2 }, // Has been updated
  metadata: {
    fromAgent: "finance-agent",
    priority: "urgent",
    responded: true,
    contextId: "ctx-budget-456", // Part of budget workflow
  },
});

// For each result, can access linked data
for (const memory of complexQuery) {
  console.log("A2A message:", memory.content);
  console.log("Importance:", memory.metadata.importance);

  // If linked to user conversation, get full ACID context
  if (memory.conversationRef) {
    const conversation = await cortex.conversations.get(
      memory.conversationRef.conversationId,
    );
    console.log("Original user request:", conversation.messages[0].text);
  }

  // If linked to workflow, get context
  if (memory.metadata.contextId) {
    const context = await cortex.contexts.get(memory.metadata.contextId);
    console.log("Workflow purpose:", context.purpose);
  }
}

// You have full power of:
// - Vector Memory search (semantic or text)
// - ACID conversation retrieval (via conversationRef)
// - Context chain navigation (via contextId)
// - Universal filters (all work together!)
```

## Best Practices

### 1. Use Helpers for Simple Cases

```typescript
// ✅ Simple send? Use helper
await cortex.a2a.send({ from, to, message, importance });

// ✅ Simple query? Use helper
const convo = await cortex.a2a.getConversation(agent1, agent2);

// ⚠️ Complex query? Use memory directly
const complex = await cortex.memory.search(agentId, query, {
  // ... complex filters
});
```

### 2. Set Appropriate Importance

```typescript
// A2A importance guidelines
const A2A_IMPORTANCE = {
  CRITICAL_DECISION: 95, // Major decisions, approvals
  URGENT_REQUEST: 85, // Time-sensitive requests
  IMPORTANT_INFO: 75, // Key information sharing
  STANDARD_COLLAB: 60, // Regular collaboration (default)
  STATUS_UPDATE: 50, // Routine updates
  FYI: 40, // Nice-to-know information
  NOTIFICATION: 30, // Low-priority notifications
};

await cortex.a2a.send({
  from: "agent-1",
  to: "agent-2",
  message: "FYI: Report generated",
  importance: A2A_IMPORTANCE.FYI,
});
```

### 3. Tag A2A Messages Well

```typescript
await cortex.a2a.send({
  from: "agent-1",
  to: "agent-2",
  message: "Approved budget increase",
  importance: 90,
  metadata: {
    tags: [
      "a2a", // Already added automatically
      "approval", // Action type
      "budget", // Topic
      "finance", // Department
      "urgent", // Priority indicator
    ],
    approvalType: "budget",
    approvedAmount: 50000,
  },
});

// Query by tags (using memory API)
const approvals = await cortex.memory.search("agent-1", "*", {
  source: { type: "a2a" },
  tags: ["approval", "budget"],
});
```

### 4. Link to Context Chains

```typescript
// Always link A2A to context when part of larger workflow
const context = await cortex.contexts.create({
  purpose: "Process refund request",
  agentId: "supervisor-agent",
  userId: "user-123",
});

// Delegate with context
await cortex.a2a.send({
  from: "supervisor-agent",
  to: "finance-agent",
  message: "Please approve $500 refund",
  importance: 85,
  userId: "user-123",
  contextId: context.id, // Link to workflow
});

// Finance agent can access full context
const ctx = await cortex.contexts.get(context.id);
```

## When to Use Each Approach

### Use A2A Helpers When:

- ✅ Simple send/receive
- ✅ Request-response pattern
- ✅ Broadcasting to multiple agents
- ✅ Viewing conversation between two agents
- ✅ You want less code

### Use Memory API Directly When:

- ✅ Complex queries (semantic search, multiple filters)
- ✅ Bulk operations (updateMany, deleteMany)
- ✅ Need full control
- ✅ Custom source types
- ✅ Advanced filtering

### Mix Both Approaches:

```typescript
// Send with helper
await cortex.a2a.send({
  from: "agent-1",
  to: "agent-2",
  message: "Important update",
  importance: 85,
});

// Query with memory API for complex filters
const important = await cortex.memory.search("agent-2", "update", {
  embedding: await embed("update"),
  source: { type: "a2a" },
  importance: { $gte: 80 },
  createdAfter: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
});
```

## Cloud Mode Features

> **Cloud Mode Only**: Enhanced A2A features with Cortex Cloud

### A2A Analytics Dashboard

- Communication frequency between agent pairs
- Average response times
- Bottleneck identification
- Collaboration graphs

### Smart Routing

- AI suggests which agent to ask
- Based on past communication patterns
- Expertise detection

### Automated Summarization

- Daily/weekly A2A summaries per agent
- Topic clustering
- Action item extraction

## Troubleshooting

### Request Timeouts

```typescript
// If requests timeout frequently
try {
  const response = await cortex.a2a.request({
    from: "agent-1",
    to: "agent-2",
    message: "Complex query",
    timeout: 60000, // Increase timeout to 60s
    retries: 3, // More retries
  });
} catch (error) {
  if (error instanceof A2ATimeoutError) {
    // Fallback to async
    await cortex.a2a.send({
      from: "agent-1",
      to: "agent-2",
      message: "Complex query (respond when ready)",
      metadata: { async: true },
    });
  }
}
```

### Finding Lost Messages

```typescript
// Search across all A2A messages semantically
const results = await cortex.memory.search(
  "agent-1",
  "did we discuss the budget increase?",
  {
    embedding: await embed("budget increase discussion"),
    source: { type: "a2a" },
    limit: 10,
  },
);

// Find messages never responded to
const unanswered = await cortex.memory.search("agent-1", "*", {
  source: { type: "a2a" },
  metadata: {
    messageType: "request",
    requiresResponse: true,
    responded: { $ne: true },
  },
  createdBefore: new Date(Date.now() - 24 * 60 * 60 * 1000), // Over 24h old
});
```

## A2A as Agent Communication Graph

Agent-to-agent communication creates a **directed graph of agent relationships**:

**Nodes:** Agents  
**Edges:** Messages (with properties: direction, timestamp, importance, content)

### Visualizing the Communication Graph

```
finance-agent
  │
  ├──[SENT_TO {importance: 85, timestamp: T1}]──> hr-agent
  │
  ├──[SENT_TO {importance: 90}]──────────────────> legal-agent
  │
  ├──[RECEIVED_FROM {importance: 75}]<───────────── ceo-agent
  │
  └──[SENT_TO {importance: 70}]──────────────────> ops-agent
```

### Graph Query Examples

**Find direct collaborators (1-hop):**

```typescript
const sentTo = await cortex.memory.search("finance-agent", "*", {
  source: { type: "a2a" },
  metadata: { direction: "outbound" },
});

const collaborators = new Set(sentTo.map((m) => m.metadata.toAgent));
console.log("Direct collaborators:", Array.from(collaborators));
// ['hr-agent', 'legal-agent', 'ops-agent']
```

**Find 2nd-degree connections (2-hop):**

```typescript
const secondDegree = new Set();

for (const agent of collaborators) {
  const theirConnections = await cortex.memory.search(agent, "*", {
    source: { type: "a2a" },
    metadata: { direction: "outbound" },
  });

  theirConnections.forEach((m) => {
    if (m.metadata.toAgent !== "finance-agent") {
      secondDegree.add(m.metadata.toAgent);
    }
  });
}

console.log("2nd-degree network:", Array.from(secondDegree));
```

**Build weighted collaboration graph:**

```typescript
async function buildCollaborationGraph(agentId: string) {
  const a2a = await cortex.memory.search(agentId, "*", {
    source: { type: "a2a" },
    metadata: { direction: "outbound" },
  });

  // Count messages and avg importance per edge
  const edges = new Map();

  a2a.forEach((m) => {
    const partner = m.metadata.toAgent;
    const current = edges.get(partner) || { count: 0, totalImportance: 0 };

    edges.set(partner, {
      count: current.count + 1,
      totalImportance: current.totalImportance + m.metadata.importance,
      avgImportance:
        (current.totalImportance + m.metadata.importance) / (current.count + 1),
    });
  });

  return Array.from(edges.entries()).map(([partner, stats]) => ({
    from: agentId,
    to: partner,
    weight: stats.count,
    avgImportance: stats.avgImportance,
  }));
}

// Result: Weighted graph edges for visualization or analysis
```

### Graph-Lite Performance

A2A queries are graph traversals:

- 1-hop (direct collaborators): 20-50ms ✅
- 2-hop (collaborator's collaborators): 100-200ms ✅
- 3-hop: 200-400ms ⚠️ (consider graph DB if common)

For advanced agent network analysis (community detection, influence metrics), see [Graph Database Integration](../07-advanced-topics/02-graph-database-integration.md).

## Summary

**A2A Communication is a convenience layer that:**

- Reduces code by 60-80% for common patterns
- Handles bidirectional storage automatically
- Provides clean, semantic APIs
- Uses agent memory underneath (Vector Memory layer, no separate storage)
- Works alongside direct memory access when needed
- Integrates with full Cortex architecture (ACID, Vector, Contexts, Profiles)
- **Forms an agent communication graph** (queryable via Graph-Lite or native graph DB)

**Under the hood:**

- Every A2A message is a vector memory with `source.type = 'a2a'`
- Uses all memory features: versioning, universal filters, search, ACID refs, etc.
- Can be queried using standard `cortex.memory` API
- Optional `conversationRef` if handling user conversation
- Optional `contextId` if part of workflow
- Optional `embedding` for semantic search
- Helpers just add convenience, not limitations

**Complete Architecture Integration:**

```
┌────────────────────────────────────────────────────┐
│               ACID Conversations                    │
│  ┌─────────────────┐    ┌─────────────────┐       │
│  │ User Conversation│    │ A2A Conversation│       │
│  │   (conv-456)    │    │ (a2a-conv-789)  │       │
│  └─────────────────┘    └─────────────────┘       │
│  Immutable, append-only, kept forever              │
└──────────┬──────────────────────┬──────────────────┘
           │                      │
           │ conversationRef      │ conversationRef
           ↓                      ↓
┌────────────────────────────────────────────────────┐
│              Vector Memories                        │
│  ┌─────────────────┐    ┌─────────────────┐       │
│  │ User-Agent Memo │    │   A2A Memory    │       │
│  │ source='convo'  │    │ source='a2a'    │       │
│  └─────────────────┘    └─────────────────┘       │
│  Searchable, versioned (retention rules)           │
└────────────────────────────────────────────────────┘
           ↑
           │ metadata.contextId
           │
┌────────────────────────────────────────────────────┐
│              Context Chains                         │
│  Workflow coordination, can also have conversationRef│
└────────────────────────────────────────────────────┘
```

**The Key Insight:**

- A2A conversations ARE stored in ACID (by default)
- Just like user conversations, but type='agent-agent'
- Vector memories reference ACID via conversationRef
- Same benefits: retention cleanup doesn't lose audit trail
- Can opt-out with trackConversation: false for ephemeral messages

## Next Steps

- **[Conversation History](./06-conversation-history.md)** - Message persistence patterns
- **[Agent Memory](./01-memory-spaces.md)** - Understand the underlying storage
- **[Context Chains](./04-context-chains.md)** - Link A2A to workflows

---

**Questions?** Ask in [GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions).
