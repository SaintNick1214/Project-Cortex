# A2A Communication API

> **Last Updated**: 2025-12-10

Complete API reference for agent-to-agent communication helpers.

## Overview

The A2A Communication API (`cortex.a2a.*`) provides **convenience helpers** for inter-agent communication. It's not a separate storage system - it's syntactic sugar over the standard memory system with `source.type='a2a'`.

**Infrastructure Requirement:**

Some A2A operations require **real-time pub/sub infrastructure**:

| Operation           | Pub/Sub Required | Works Without | Why                                                     |
| ------------------- | ---------------- | ------------- | ------------------------------------------------------- |
| `send()`            | ❌ No            | ✅ Yes        | Fire-and-forget (async)                                 |
| `request()`         | ✅ Yes           | ❌ No         | Needs real-time response notification                   |
| `broadcast()`       | ✅ Yes (optimal) | ⚠️ Degraded   | Can store without pub/sub, but no delivery confirmation |
| `subscribe()`       | ✅ Yes           | ❌ No         | Real-time inbox notifications _(Planned)_               |
| `getConversation()` | ❌ No            | ✅ Yes        | Database query only                                     |

**Pub/Sub Options:**

- **Direct Mode**: Bring your own Redis, RabbitMQ, NATS, or similar
- **Cloud Mode**: Pub/sub infrastructure included and optimized

**Key Insight:** A2A = Agent Memory + Pub/Sub (optional) + Convenience

```typescript
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Approach 1: A2A Helper (RECOMMENDED - 7 lines)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
await cortex.a2a.send({
  from: "finance-agent",
  to: "hr-agent",
  message: "What is the Q4 budget?",
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
  memorySpaceId: "finance-agent-space",
  conversationId,
  userMessage: "What is the Q4 budget?",
  agentResponse: "[Sent to hr-agent]",
  userId: "finance-agent", // Sender as "user"
  userName: "Finance Agent",
});

// Store in receiver's memory (ACID + Vector)
await cortex.memory.remember({
  memorySpaceId: "hr-agent-space",
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
  text: "What is the Q4 budget?",
  timestamp: new Date(),
});

// 3. Store in sender's Vector memory (Layer 2)
await cortex.vector.store("finance-agent", {
  content: "Sent to hr-agent: What is the Q4 budget?",
  contentType: "raw",
  embedding: await embed("What is the Q4 budget?"), // Optional
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
  content: "Received from finance-agent: What is the Q4 budget?",
  contentType: "raw",
  embedding: await embed("What is the Q4 budget?"),
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

- Handles ACID conversation management
- Stores in BOTH agents automatically
- Consistent metadata and tagging
- One call instead of four
- 85% less code

**Architecture Integration:**

```
Layer 1a: ACID Conversations
└── A2A conversations (type='agent-agent') ← Immutable threads

Layer 2: Vector Memories
├── Sender memory (source.type='a2a', direction='outbound')
└── Receiver memory (source.type='a2a', direction='inbound')
    Both reference ACID via conversationRef

Pub/Sub Infrastructure (for real-time operations)
├── Direct Mode: Your Redis/RabbitMQ/NATS
└── Cloud Mode: Cortex-managed infrastructure

A2A Helpers:
└── Convenience wrappers (handle ACID + bidirectional Vector storage + pub/sub)
```

**Why use A2A helpers:**

- ✅ **Reduce code** - 7 lines instead of 40+
- ✅ **Bidirectional** - Automatically stores in both agents
- ✅ **ACID tracking** - Manages A2A conversations automatically
- ✅ **Real-time** - Pub/sub notifications (BYO or Cloud-provided)
- ✅ **Consistent** - Standard tagging and linking
- ✅ **Fewer bugs** - Less code to maintain

---

## Configuration

### Direct Mode: Developer Manages Execution + Pub/Sub

**What Cortex provides:**

- Storage APIs (database operations)
- Metadata conventions (messageType, inReplyTo, etc.)
- Patterns for request-response

**What YOU must provide:**

- Agent execution infrastructure (how agents run)
- Pub/sub infrastructure (your own Redis, RabbitMQ, etc.)
- Agent subscription handlers (connecting agents to pub/sub)

**Example Setup (Direct Mode):**

```typescript
import Redis from "ioredis"; // Standard ioredis package

// 1. Your Redis instance
const redis = new Redis(process.env.REDIS_URL);

// 2. Cortex SDK (storage only)
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL,
});

// 3. YOUR agent execution + subscription logic
async function runAgent(memorySpaceId: string) {
  // Subscribe to memory space's inbox channel
  redis.subscribe(`memoryspace:${memorySpaceId}:inbox`, (err) => {
    if (err) throw err;
  });

  // Handle incoming notifications
  redis.on("message", async (channel, message) => {
    const notification = JSON.parse(message);

    if (notification.type === "a2a-request") {
      // 1. Fetch from Cortex storage
      const request = await cortex.memory.get(
        memorySpaceId,
        notification.memoryId,
      );

      // 2. Process with your agent logic
      const answer = await yourAgentLogic(request.content);

      // 3. Store response in Cortex
      await cortex.a2a.send({
        from: memorySpaceId,
        to: notification.from,
        message: answer,
        metadata: {
          messageType: "response",
          inReplyTo: notification.messageId,
        },
      });

      // 4. Publish response notification (your pub/sub)
      await redis.publish(
        `agent:${notification.from}:responses:${notification.messageId}`,
        JSON.stringify({ response: answer }),
      );
    }
  });
}

// 4. Manual request() implementation (you build this)
async function manualRequest(
  from: string,
  to: string,
  message: string,
  timeout = 30000,
) {
  // Send via Cortex (stores in database)
  const sent = await cortex.a2a.send({
    from,
    to,
    message,
    metadata: {
      messageType: "request",
      requiresResponse: true,
    },
  });

  // Publish notification (your pub/sub)
  await redis.publish(
    `agent:${to}:inbox`,
    JSON.stringify({
      type: "a2a-request",
      messageId: sent.messageId,
      memoryId: sent.receiverMemoryId,
      from,
    }),
  );

  // Wait for response (your pub/sub)
  return new Promise((resolve, reject) => {
    const channel = `agent:${from}:responses:${sent.messageId}`;

    redis.subscribe(channel);
    const handler = (ch, msg) => {
      if (ch === channel) {
        redis.unsubscribe(channel);
        redis.off("message", handler);
        resolve(JSON.parse(msg));
      }
    };
    redis.on("message", handler);

    setTimeout(() => {
      redis.unsubscribe(channel);
      redis.off("message", handler);
      reject(new Error("Timeout"));
    }, timeout);
  });
}

// Start your agents
runAgent("hr-agent");
runAgent("finance-agent");

// Use your manual request
const response = await manualRequest(
  "finance-agent",
  "hr-agent",
  "What is the budget?",
);
```

**Key Points:**

- Cortex provides **storage APIs** (database operations)
- YOU provide **execution** (agent runners) + **pub/sub** (Redis/RabbitMQ)
- YOU wire them together (subscriptions, notifications)
- Cortex just provides the patterns and storage conventions

### Cloud Mode: Cortex Manages Everything

> **Cloud Feature**: Cloud Mode messaging layer provides managed pub/sub infrastructure (planned).

In Cloud Mode, Cortex will provide:

```typescript
const cortex = new Cortex({
  mode: "cloud",
  apiKey: process.env.CORTEX_CLOUD_KEY,
});

// request() works automatically
const response = await cortex.a2a.request({
  from: "finance-agent",
  to: "hr-agent",
  message: "What is the budget?",
});
// Cloud handles:
// ✅ Pub/sub infrastructure (managed Redis)
// ✅ Agent execution (webhooks or serverless functions)
// ✅ Subscription wiring (automatic)
```

---

## Core Helpers

### send()

Send a message from one agent to another. Stores in ACID conversation + both agents' Vector memories.

> **No Pub/Sub Required**: This is a fire-and-forget operation. Works in all modes without pub/sub.

**Signature:**

```typescript
cortex.a2a.send(
  params: A2ASendParams
): Promise<A2AMessage>
```

**Parameters:**

```typescript
interface A2ASendParams {
  // Required
  from: string; // Sender agent ID
  to: string; // Receiver agent ID
  message: string; // The message content

  // Optional linking
  userId?: string; // If about a specific user (GDPR-enabled)
  contextId?: string; // If part of a workflow

  // Optional control
  importance?: number; // 0-100 (default: 60)
  trackConversation?: boolean; // Store in ACID (default: true)

  // Cloud Mode
  autoEmbed?: boolean; // Auto-generate embeddings (Cloud Mode)

  // Metadata
  metadata?: {
    tags?: string[];
    priority?: "low" | "normal" | "high" | "urgent";
    [key: string]: any;
  };
}
```

**Returns:**

```typescript
interface A2AMessage {
  messageId: string; // Unique message ID
  sentAt: number; // Unix timestamp (milliseconds)

  // ACID tracking
  conversationId?: string; // ACID conversation (if trackConversation=true)
  acidMessageId?: string; // Message ID in ACID

  // Vector storage
  senderMemoryId: string; // Memory ID in sender's storage
  receiverMemoryId: string; // Memory ID in receiver's storage
}
```

**Side Effects:**

- Creates/updates A2A conversation in Layer 1a (ACID) - unless `trackConversation: false`
- Stores memory in sender's Vector index (Layer 2) with `conversationRef`
- Stores memory in receiver's Vector index (Layer 2) with `conversationRef`
- Both memories reference same ACID message

**Example 1: Basic send**

```typescript
const result = await cortex.a2a.send({
  from: "sales-agent",
  to: "support-agent",
  message: "Customer is asking about enterprise pricing",
  importance: 70,
});

console.log(`Message ${result.messageId} sent`);
console.log(`ACID conversation: ${result.conversationId}`);
console.log(`Sender memory: ${result.senderMemoryId}`);
console.log(`Receiver memory: ${result.receiverMemoryId}`);
```

**Example 2: With user context**

```typescript
// A2A about a specific user (GDPR-enabled)
await cortex.a2a.send({
  from: "support-agent",
  to: "billing-agent",
  message: "User-123 requesting invoice for October",
  userId: "user-123", // ← Links to user (enables GDPR cascade)
  importance: 75,
  metadata: {
    tags: ["billing", "invoice", "request"],
    requestType: "invoice",
  },
});

// Later: GDPR deletion includes this A2A message
await cortex.users.delete("user-123", { cascade: true });
// A2A message deleted from both agents! ✅
```

**Example 3: With workflow context**

```typescript
// A2A as part of larger workflow
const context = await cortex.contexts.create({
  purpose: "Process refund for order #789",
  memorySpaceId: "supervisor-agent-space",
  userId: "user-123",
});

await cortex.a2a.send({
  from: "supervisor-agent",
  to: "finance-agent",
  message: "Please approve $500 refund",
  userId: "user-123",
  contextId: context.id, // ← Links to workflow
  importance: 85,
});

// Finance agent can access full context
const ctx = await cortex.contexts.get(context.id);
console.log("Workflow purpose:", ctx.purpose);
```

**Example 4: Fire-and-forget (no ACID tracking)**

```typescript
// Low-value notification (skip ACID to save storage)
await cortex.a2a.send({
  from: "agent-1",
  to: "agent-2",
  message: "FYI: Daily report generated",
  trackConversation: false, // ← Skip ACID storage
  importance: 30,
});

// Still stores in Vector memories (both agents)
// But no conversationRef (not tracked in ACID)
```

**Errors:**

- `CortexError('INVALID_AGENT_ID')` - from or to is invalid
- `CortexError('INVALID_MESSAGE')` - Message is empty or too large
- `CortexError('USER_NOT_FOUND')` - userId doesn't reference existing user
- `CortexError('CONTEXT_NOT_FOUND')` - contextId doesn't exist
- `CortexError('CONVEX_ERROR')` - Database error

**See Also:**

- [A2A Communication Guide](../02-core-features/05-a2a-communication.md#send-bidirectional-storage)

---

### request()

Send a request and wait for response (synchronous request-response pattern).

> **Requires Pub/Sub Infrastructure**: This operation requires real-time messaging.
>
> - **Direct Mode**: Configure your own Redis/RabbitMQ/NATS adapter (see Configuration)
> - **Cloud Mode**: Pub/sub infrastructure included automatically

**How it works:**

1. **Agent A** calls `request()` → Stores in database + publishes to Agent B's inbox channel
2. **Agent B** receives pub/sub notification → Fetches from database → Processes → Responds
3. **Agent B** sends response → Stores in database + publishes to Agent A's response channel
4. **Agent A** receives pub/sub notification → Returns response to caller

**Storage:** Convex (persistent)  
**Notifications:** Pub/sub (ephemeral, real-time)

**Signature:**

```typescript
cortex.a2a.request(
  params: A2ARequestParams
): Promise<A2AResponse>
```

**Parameters:**

```typescript
interface A2ARequestParams {
  // Required
  from: string;
  to: string;
  message: string;

  // Timeout control
  timeout?: number; // ms (default: 30000)
  retries?: number; // Retry attempts (default: 1)

  // Optional linking
  userId?: string;
  contextId?: string;

  // Optional
  importance?: number; // 0-100
}
```

**Returns:**

```typescript
interface A2AResponse {
  response: string; // Response message
  messageId: string; // Original request message ID
  responseMessageId: string; // Response message ID
  respondedAt: number; // Unix timestamp (milliseconds)
  responseTime: number; // ms
}
```

**Side Effects:**

- Sends request via `send()` (creates ACID + Vector memories)
- Publishes notification to receiver's inbox channel (pub/sub)
- Subscribes to response channel (pub/sub)
- Marks request as responded when answer received
- Throws timeout error if no response within timeout period

**Example 1: Basic request**

```typescript
try {
  const response = await cortex.a2a.request({
    from: "finance-agent",
    to: "hr-agent",
    message: "What is the Q4 headcount budget?",
    timeout: 30000, // 30 seconds
    importance: 85,
  });

  console.log(`Response: ${response.response}`);
  console.log(`Response time: ${response.responseTime}ms`);
} catch (error) {
  if (error instanceof A2ATimeoutError) {
    console.log("HR agent did not respond within 30 seconds");
    // Fallback logic
  }
}
```

**Example 2: With retries**

```typescript
// Auto-retry on timeout
const response = await cortex.a2a.request({
  from: "agent-1",
  to: "agent-2",
  message: "Complex calculation needed",
  timeout: 60000, // 60 second timeout
  retries: 3, // Will retry up to 3 times
  importance: 85,
});

// Total possible wait: 60s × 3 = 180s max
```

**Example 3: Receiver handles requests (you implement this)**

```typescript
// Direct Mode: YOU implement agent execution + pub/sub handling
// See Configuration section for complete example

// In Cloud Mode: This would be automatic via webhooks
```

**Alternative: Batch processing without pub/sub**

```typescript
// If you need to manually check for requests (batch processing)
async function handleIncomingRequests(memorySpaceId: string) {
  const requests = await cortex.memory.search(memorySpaceId, "*", {
    source: { type: "a2a" },
    metadata: {
      messageType: "request",
      requiresResponse: true,
      responded: { $ne: true },
    },
    sortBy: "createdAt",
    sortOrder: "asc",
  });

  for (const request of requests) {
    const answer = await processRequest(request.content);

    await cortex.a2a.send({
      from: agentId,
      to: request.source.fromAgent,
      message: answer,
      metadata: {
        messageType: "response",
        inReplyTo: request.metadata.messageId,
      },
    });

    await cortex.memory.update(memorySpaceId, request.id, {
      metadata: { responded: true, respondedAt: new Date() },
    });
  }
}

// Run on schedule
cron.schedule("*/5 * * * *", () => handleIncomingRequests("hr-agent"));
```

**Errors:**

- `CortexError('INVALID_AGENT_ID')` - from or to is invalid
- `CortexError('PUBSUB_NOT_CONFIGURED')` - No pub/sub adapter configured
- `A2ATimeoutError('NO_RESPONSE')` - No response within timeout
- `CortexError('CONVEX_ERROR')` - Database error

**See Also:**

- [Request-Response Pattern](../02-core-features/05-a2a-communication.md#request-synchronous-request-response)

---

### broadcast()

Send one message to multiple agents efficiently.

> **Requires Pub/Sub Infrastructure**: Optimized delivery requires real-time messaging.
>
> - **Direct Mode**: Configure your own pub/sub adapter
> - **Cloud Mode**: Pub/sub infrastructure included

**Signature:**

```typescript
cortex.a2a.broadcast(
  params: A2ABroadcastParams
): Promise<A2ABroadcastResult>
```

**Parameters:**

```typescript
interface A2ABroadcastParams {
  // Required
  from: string;
  to: string[]; // Multiple recipients
  message: string;

  // Optional linking
  userId?: string;
  contextId?: string;

  // Optional
  importance?: number; // 0-100
  trackConversation?: boolean; // Default: true

  // Metadata
  metadata?: {
    tags?: string[];
    [key: string]: any;
  };
}
```

**Returns:**

```typescript
interface A2ABroadcastResult {
  messageId: string; // Broadcast ID (same for all)
  sentAt: number; // Unix timestamp (milliseconds)
  recipients: string[];

  // Storage results
  senderMemoryIds: string[]; // One per recipient
  receiverMemoryIds: string[]; // One per recipient
  memoriesCreated: number; // Total (sender + receiver for each)

  // ACID tracking (if trackConversation=true)
  conversationIds?: string[]; // One per recipient
}
```

**Side Effects:**

- Creates N memories in sender's storage (one per recipient)
- Creates N memories in receivers' storage (one per sender)
- Total: 2N memories created
- Each pair gets separate A2A conversation in ACID (if tracking enabled)

**Example 1: Team announcement**

```typescript
const result = await cortex.a2a.broadcast({
  from: "manager-agent",
  to: ["dev-agent-1", "dev-agent-2", "qa-agent", "designer-agent"],
  message: "Sprint review meeting Friday at 2 PM",
  importance: 70,
  metadata: {
    tags: ["meeting", "sprint-review", "team"],
    meetingId: "meeting-456",
  },
});

console.log(`Broadcast to ${result.recipients.length} agents`);
console.log(`Created ${result.memoriesCreated} total memories`);
// 4 recipients = 8 memories (4 sender + 4 receiver)
```

**Example 2: Policy update broadcast**

```typescript
// Notify all agents about policy change
const allAgents = await cortex.agents.list();

await cortex.a2a.broadcast({
  from: "admin-agent",
  to: allAgents.map((a) => a.id),
  message: "New policy: All refunds over $1000 require manager approval",
  importance: 90,
  metadata: {
    tags: ["policy", "announcement", "important"],
    policyId: "POL-789",
    effectiveDate: new Date("2025-11-01"),
  },
});

// Each agent can query their announcements
const announcements = await cortex.memory.search("agent-1", "*", {
  source: { type: "a2a" },
  metadata: { broadcast: true },
  tags: ["announcement"],
  limit: 10,
});
```

**Errors:**

- `CortexError('INVALID_AGENT_ID')` - from or any to[] is invalid
- `CortexError('INVALID_MESSAGE')` - Message is empty or too large
- `CortexError('EMPTY_RECIPIENTS')` - to[] is empty
- `CortexError('PUBSUB_NOT_CONFIGURED')` - No pub/sub adapter configured
- `CortexError('CONVEX_ERROR')` - Database error

**See Also:**

- [Broadcast Communication](../02-core-features/05-a2a-communication.md#broadcast-one-to-many)

---

### getConversation()

Get chronological conversation between two agents with rich filtering.

**Signature:**

```typescript
cortex.a2a.getConversation(
  agent1: string,
  agent2: string,
  filters?: ConversationFilters
): Promise<A2AConversation>
```

**Parameters:**

```typescript
interface ConversationFilters {
  // Time range
  since?: Date;
  until?: Date;

  // Filtering
  minImportance?: number; // 0-100
  tags?: string[];
  userId?: string; // A2A about specific user

  // Pagination
  limit?: number; // Default: 100
  offset?: number;

  // Format
  format?: "chronological"; // Default
}
```

**Returns:**

```typescript
interface A2AConversation {
  participants: [string, string];
  conversationId?: string; // ACID conversation ID (if exists)
  messageCount: number;

  messages: A2AConversationMessage[];

  period: {
    start: number; // Unix timestamp (milliseconds)
    end: number; // Unix timestamp (milliseconds)
  };

  tags?: string[]; // Filtered tags
  canRetrieveFullHistory: boolean; // True if ACID conversation exists
}

interface A2AConversationMessage {
  from: string;
  to: string;
  message: string;
  importance: number;
  timestamp: number; // Unix timestamp (milliseconds)
  messageId: string;
  memoryId: string; // Vector memory ID
  acidMessageId?: string; // ACID message ID (if tracked)
  tags?: string[];
  direction?: string; // 'outbound' or 'inbound'
  broadcast?: boolean; // True if part of a broadcast
  broadcastId?: string; // Broadcast ID (if broadcast)
}
```

**Side Effects:**

- None (read-only)

**Example 1: Get complete conversation**

```typescript
// Get all communication between two agents
const convo = await cortex.a2a.getConversation("finance-agent", "hr-agent");

console.log(`${convo.messageCount} messages exchanged`);
convo.messages.forEach((msg) => {
  console.log(`[${msg.timestamp}] ${msg.from} → ${msg.to}`);
  console.log(`  ${msg.message}`);
});

// Can retrieve full ACID history if needed
if (convo.canRetrieveFullHistory) {
  const fullHistory = await cortex.conversations.get(convo.conversationId);
  console.log(
    "Complete conversation:",
    fullHistory.messages.length,
    "messages",
  );
}
```

**Example 2: Filtered conversation**

```typescript
// Get only important budget-related messages from last 30 days
const filtered = await cortex.a2a.getConversation("finance-agent", "hr-agent", {
  since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  minImportance: 70,
  tags: ["budget"],
  limit: 50,
});

console.log(`Found ${filtered.messageCount} important budget discussions`);
```

**Example 3: User-specific A2A**

```typescript
// Get all A2A about a specific user
const userRelated = await cortex.a2a.getConversation(
  "support-agent",
  "billing-agent",
  {
    userId: "user-123", // Only A2A about this user
    since: new Date("2025-10-01"),
  },
);

console.log(`${userRelated.messageCount} messages about user-123`);
```

**Errors:**

- `CortexError('INVALID_AGENT_ID')` - agent1 or agent2 is invalid
- `CortexError('INVALID_FILTERS')` - Filters are malformed

**See Also:**

- [Get Conversation](../02-core-features/05-a2a-communication.md#get-conversation-rich-filtering)

---

## Querying A2A Messages (Using Memory API)

Since A2A uses the memory system, you can use **any memory operation** on A2A messages:

### Finding A2A Messages

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

// Messages with specific agent
const withHR = await cortex.memory.search("finance-agent", "*", {
  source: { type: "a2a" },
  metadata: {
    $or: [{ toAgent: "hr-agent" }, { fromAgent: "hr-agent" }],
  },
});
```

### Semantic Search on A2A

```typescript
// Semantic search across A2A messages
const results = await cortex.memory.search(
  "agent-1",
  "did we discuss the budget increase?",
  {
    embedding: await embed("budget increase discussion"),
    source: { type: "a2a" },
    minImportance: 50,
    limit: 10,
  },
);

results.forEach((m) => {
  console.log(`${m.content} (score: ${m.score})`);
  console.log(`  With: ${m.metadata.toAgent || m.metadata.fromAgent}`);
});
```

### Finding Unanswered Requests

```typescript
// Pending requests needing response
const pending = await cortex.memory.search("hr-agent", "*", {
  source: { type: "a2a" },
  metadata: {
    messageType: "request",
    requiresResponse: true,
    responded: { $ne: true },
  },
  sortBy: "createdAt",
  sortOrder: "asc", // Oldest first
});

console.log(`${pending.length} pending requests`);
```

### Counting A2A Messages

```typescript
// Total A2A messages
const total = await cortex.memory.count("agent-1", {
  source: { type: "a2a" },
});

// Sent vs received
const sentCount = await cortex.memory.count("agent-1", {
  source: { type: "a2a" },
  metadata: { direction: "outbound" },
});

const receivedCount = await cortex.memory.count("agent-1", {
  source: { type: "a2a" },
  metadata: { direction: "inbound" },
});

console.log(`Sent: ${sentCount}, Received: ${receivedCount}`);
```

---

## Integration with Other Systems

### A2A + Contexts (Workflow Coordination)

```typescript
// Create workflow context
const context = await cortex.contexts.create({
  purpose: "Process refund request",
  memorySpaceId: "supervisor-agent-space",
  userId: "user-123",
});

// Delegate via A2A linked to context
await cortex.a2a.send({
  from: "supervisor-agent",
  to: "specialist-agent",
  message: "Please handle refund for ticket #456",
  userId: "user-123",
  contextId: context.id, // ← Links to workflow
  importance: 85,
});

// Specialist can access context
const ctx = await cortex.contexts.get(context.id);

// Find all A2A for this workflow
const workflowComms = await cortex.memory.search("supervisor-agent", "*", {
  source: { type: "a2a" },
  metadata: { contextId: context.id },
});
```

### A2A + Conversations (User-Triggered)

```typescript
// User makes request
const userMsg = await cortex.conversations.addMessage("conv-456", {
  role: "user",
  text: "I need help with my refund",
  userId: "user-123",
});

// Create context linked to conversation
const context = await cortex.contexts.create({
  purpose: "Handle user refund request",
  memorySpaceId: "support-agent-space",
  userId: "user-123",
  conversationRef: {
    conversationId: "conv-456",
    messageIds: [userMsg.id],
  },
});

// A2A delegation with full traceability
await cortex.a2a.send({
  from: "support-agent",
  to: "finance-agent",
  message: "User needs refund approval for $500",
  userId: "user-123",
  contextId: context.id,
});

// Finance agent can trace back to original user request
const ctx = await cortex.contexts.get(context.id, {
  includeConversation: true,
});
console.log("Original user request:", ctx.triggerMessages[0].text);
```

### A2A + Users (GDPR Cascade)

```typescript
// A2A about a user
await cortex.a2a.send({
  from: "support-agent",
  to: "billing-agent",
  message: "User requesting account deletion",
  userId: "user-123", // ← GDPR link
  importance: 95,
});

// User requests deletion
const result = await cortex.users.delete("user-123", { cascade: true });

console.log(`A2A messages deleted: ${result.vectorMemoriesDeleted}`);
// Includes the A2A message above! ✅
```

---

## Advanced Patterns

### Pattern 1: Complete Traceability

```typescript
// Full traceability: User → Context → A2A → Memories

// 1. User conversation (Layer 1a - ACID)
const userMsg = await cortex.conversations.addMessage("conv-456", {
  role: "user",
  text: "I need a refund",
  userId: "user-123",
});

// 2. Workflow context (linked to conversation)
const context = await cortex.contexts.create({
  purpose: "Process refund",
  memorySpaceId: "supervisor-agent-space",
  userId: "user-123",
  conversationRef: {
    conversationId: "conv-456",
    messageIds: [userMsg.id],
  },
});

// 3. A2A delegation (linked to context AND conversation)
const a2aResult = await cortex.a2a.send({
  from: "supervisor-agent",
  to: "specialist-agent",
  message: "Handle refund for user",
  userId: "user-123",
  contextId: context.id,
});

// Now specialist agent can access:
// - A2A message (in their memory)
const a2aMemory = await cortex.memory.get(
  "specialist-agent",
  a2aResult.receiverMemoryId,
);

// - Context chain
const ctx = await cortex.contexts.get(a2aMemory.metadata.contextId);

// - Original user conversation (via context)
const userConvo = await cortex.conversations.get(
  ctx.conversationRef.conversationId,
);

// Complete audit trail! ✅
```

### Pattern 2: A2A Communication Analytics

```typescript
// Analyze communication patterns
async function analyzeA2ACommunication(
  memorySpaceId: string,
  period: number = 30,
) {
  const since = new Date(Date.now() - period * 24 * 60 * 60 * 1000);

  // All A2A in period
  const allA2A = await cortex.memory.search(memorySpaceId, "*", {
    source: { type: "a2a" },
    createdAfter: since,
  });

  // Sent vs received
  const sent = allA2A.filter((m) => m.metadata.direction === "outbound");
  const received = allA2A.filter((m) => m.metadata.direction === "inbound");

  // By partner agent
  const partners = {};
  allA2A.forEach((m) => {
    const partner = m.metadata.toAgent || m.metadata.fromAgent;
    partners[partner] = (partners[partner] || 0) + 1;
  });

  // By importance
  const critical = allA2A.filter((m) => m.metadata.importance >= 90).length;
  const important = allA2A.filter((m) => m.metadata.importance >= 70).length;

  return {
    total: allA2A.length,
    sent: sent.length,
    received: received.length,
    partners,
    avgImportance:
      allA2A.reduce((sum, m) => sum + m.metadata.importance, 0) / allA2A.length,
    critical,
    important,
  };
}

const stats = await analyzeA2ACommunication("finance-agent", 30);
console.log("Last 30 days:", stats);
```

### Pattern 3: Bulk Operations on A2A

```typescript
// Mark old A2A messages as archived
await cortex.memory.updateMany(
  "agent-1",
  {
    source: { type: "a2a" },
    createdBefore: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    importance: { $lte: 50 },
  },
  {
    metadata: { archived: true },
  },
);

// Delete trivial old A2A
await cortex.memory.deleteMany("agent-1", {
  source: { type: "a2a" },
  importance: { $lte: 30 },
  createdBefore: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
  accessCount: { $lte: 1 },
});

// Export A2A for audit
await cortex.memory.export("agent-1", {
  source: { type: "a2a" },
  createdAfter: new Date("2025-10-01"),
  createdBefore: new Date("2025-10-31"),
  format: "json",
  outputPath: "audits/october-a2a.json",
});
```

---

## A2A Message Structure

When you use A2A helpers, messages are stored as standard Vector memories with specific structure:

```typescript
// Sender's memory
interface A2ASenderMemory extends MemoryEntry {
  memorySpaceId: string; // Sender's memory space
  content: string; // 'Sent to {recipient}: {message}'

  source: {
    type: "a2a";
    fromAgent: string; // Sender
    toAgent: string; // Recipient
    timestamp: Date;
  };

  conversationRef?: {
    // Links to ACID A2A conversation
    conversationId: string; // e.g., 'a2a-conv-789'
    messageIds: string[];
  };

  metadata: {
    importance: number; // 0-100
    tags: string[]; // Includes 'a2a', 'sent', recipient
    direction: "outbound";
    messageId: string; // A2A message ID

    // Optional
    contextId?: string; // Workflow link
    userId?: string; // User link (GDPR)
    broadcast?: boolean; // If broadcast
    broadcastId?: string;
    messageType?: "request" | "response";
    inReplyTo?: string; // For responses
    requiresResponse?: boolean;
    responded?: boolean;
  };
}

// Receiver's memory (similar structure with direction='inbound')
```

**This means all memory operations work on A2A:**

- `cortex.memory.search()` - Semantic or text search
- `cortex.memory.get()` - Retrieve by ID
- `cortex.memory.update()` - Update (creates version)
- `cortex.memory.delete()` - Delete
- `cortex.memory.count()` - Count
- All universal filters apply!

---

## When to Use Each Approach

### Use A2A Helpers When:

✅ **Simple send** - One agent to another  
✅ **Request-response** - Need synchronous answer  
✅ **Broadcasting** - One to many  
✅ **Viewing conversation** - Chronological thread between two agents  
✅ **Less code** - Want convenience

### Use Memory API Directly When:

✅ **Complex queries** - Semantic search, multiple filters  
✅ **Bulk operations** - updateMany, deleteMany on A2A messages  
✅ **Custom logic** - Need full control  
✅ **Advanced filtering** - Combining many criteria  
✅ **Performance** - Optimizing specific queries

### Mix Both:

```typescript
// Send with helper (convenience)
await cortex.a2a.send({
  from: "agent-1",
  to: "agent-2",
  message: "Important update",
  importance: 85,
});

// Query with memory API (power)
const important = await cortex.memory.search("agent-2", "update", {
  embedding: await embed("update"),
  source: { type: "a2a" },
  importance: { $gte: 80 },
  createdAfter: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
});
```

---

## Best Practices

### 1. Set Appropriate Importance

```typescript
// A2A importance guidelines (0-100 scale)
const A2A_IMPORTANCE = {
  CRITICAL_DECISION: 95, // Major decisions, approvals
  URGENT_REQUEST: 85, // Time-sensitive requests
  IMPORTANT_INFO: 75, // Key information sharing
  STANDARD_COLLAB: 60, // Regular collaboration (default)
  STATUS_UPDATE: 50, // Routine updates
  FYI: 40, // Nice-to-know information
  NOTIFICATION: 30, // Low-priority notifications
  DEBUG: 10, // Debug/diagnostic messages
};

await cortex.a2a.send({
  from: "agent-1",
  to: "agent-2",
  message: "Board approved budget increase",
  importance: A2A_IMPORTANCE.CRITICAL_DECISION,
});
```

### 2. Use Tags for Organization

```typescript
await cortex.a2a.send({
  from: "agent-1",
  to: "agent-2",
  message: "Approved budget increase",
  importance: 90,
  metadata: {
    tags: [
      "a2a", // Automatic
      "approval", // Action type
      "budget", // Topic
      "finance", // Department
      "urgent", // Priority
    ],
    approvalType: "budget",
    approvedAmount: 50000,
  },
});

// Query by tags
const approvals = await cortex.memory.search("agent-1", "*", {
  source: { type: "a2a" },
  tags: ["approval", "budget"],
});
```

### 3. Link to Contexts for Workflows

```typescript
// Always link A2A to context when part of workflow
const context = await cortex.contexts.create({
  purpose: "Process refund",
  memorySpaceId: "supervisor-agent-space",
});

await cortex.a2a.send({
  from: "supervisor-agent",
  to: "specialist-agent",
  message: "Handle this refund",
  contextId: context.id, // ← Links to workflow
});
```

### 4. Track Conversation for Audit

```typescript
// ✅ Default: Track in ACID (audit trail)
await cortex.a2a.send({
  from: "agent-1",
  to: "agent-2",
  message: "Important decision",
  importance: 90,
  // trackConversation: true (default)
});

// ⚠️ Only skip for ephemeral, low-value messages
await cortex.a2a.send({
  from: "agent-1",
  to: "agent-2",
  message: "Heartbeat ping",
  importance: 10,
  trackConversation: false, // Skip ACID (save storage)
});
```

### 5. Handle Request Timeouts

```typescript
// Use try-catch for request() pattern
async function askWithFallback(from: string, to: string, message: string) {
  try {
    const response = await cortex.a2a.request({
      from,
      to,
      message,
      timeout: 30000,
      retries: 2,
    });

    return response.response;
  } catch (error) {
    if (error instanceof A2ATimeoutError) {
      // Fallback to async
      await cortex.a2a.send({
        from,
        to,
        message: `${message} (respond when ready)`,
        metadata: { async: true },
      });

      return null; // Will check later
    }
    throw error;
  }
}
```

---

## Comparison: Helper vs Direct

| Operation        | A2A Helper              | Memory API Direct            | Lines of Code     |
| ---------------- | ----------------------- | ---------------------------- | ----------------- |
| Send message     | `a2a.send()`            | ACID + 2× Vector stores      | 7 vs 40+          |
| Request-response | `a2a.request()`         | Send + polling loop          | 5 vs 35+          |
| Broadcast        | `a2a.broadcast()`       | Loop + N×2 stores            | 8 vs 50+          |
| Get conversation | `a2a.getConversation()` | Bidirectional search + merge | 6 vs 40+          |
| **Total saved**  | **26 lines**            | **165+ lines**               | **85% reduction** |

**The helpers are pure convenience** - everything they do can be done with the memory API directly. But they eliminate boilerplate and ensure consistency.

---

## Cloud Mode Features

> **Cloud Mode Only**: Enhanced A2A features with Cortex Cloud

### A2A Analytics Dashboard

- Communication frequency between agent pairs
- Average response times
- Bottleneck identification (slow responders)
- Collaboration graphs and network visualization
- Topic clustering from A2A messages

### Smart Routing

- AI suggests which agent to ask based on expertise
- Learns from communication patterns
- Automatic load balancing

### Automated Summarization

- Daily/weekly A2A summaries per agent
- Topic extraction and clustering
- Action item detection

---

## Graph-Lite Capabilities

A2A communication creates an **agent collaboration graph**:

**Graph Structure:**

- Nodes: Agents
- Edges: Messages (with properties: direction, importance, timestamp)

**A2A as Directed Graph:**

```
finance-agent
  ├──[SENT_TO {importance: 85}]──> hr-agent
  ├──[SENT_TO {importance: 90}]──> legal-agent
  ├──[RECEIVED_FROM]<──────────── ceo-agent
  └──[SENT_TO]────────────────────> ops-agent
```

**Graph Queries via Memory API:**

```typescript
// 1-hop: Direct collaborators
const sent = await cortex.memory.search('finance-agent', '*', {
  source: { type: 'a2a' },
  metadata: { direction: 'outbound' }
});

const directCollaborators = new Set(sent.map(m => m.metadata.toAgent));

// 2-hop: Collaborator's collaborators
const secondDegree = new Set();
for (const agent of directCollaborators) {
  const their Connections = await cortex.memory.search(agent, '*', {
    source: { type: 'a2a' },
    metadata: { direction: 'outbound' }
  });

  theirConnections.forEach(m => {
    if (m.metadata.toAgent !== 'finance-agent') {
      secondDegree.add(m.metadata.toAgent);
    }
  });
}

// Build weighted graph (edge weights = message count + importance)
const edges = new Map();
sent.forEach(m => {
  const partner = m.metadata.toAgent;
  const current = edges.get(partner) || { count: 0, avgImportance: 0 };

  edges.set(partner, {
    count: current.count + 1,
    avgImportance: (current.avgImportance * current.count + m.metadata.importance) / (current.count + 1)
  });
});
```

**Performance:**

- 1-hop (direct collaborators): 20-50ms
- 2-hop (network expansion): 100-200ms
- 3-hop: 200-400ms (consider graph DB for frequent deep queries)

**Network Analysis:**

For advanced graph analytics (community detection, centrality, influence metrics), consider integrating a graph database:

**Learn more:** [Graph Database Integration](../07-advanced-topics/02-graph-database-integration.md)

---

## Error Reference

All A2A operation errors:

| Error Code              | Description           | Cause                                      |
| ----------------------- | --------------------- | ------------------------------------------ |
| `INVALID_AGENT_ID`      | Agent ID is invalid   | Empty or malformed from/to                 |
| `INVALID_MESSAGE`       | Message is invalid    | Empty or > 100KB                           |
| `EMPTY_RECIPIENTS`      | No recipients         | to[] array is empty                        |
| `PUBSUB_NOT_CONFIGURED` | Pub/sub required      | request()/broadcast() need pub/sub adapter |
| `USER_NOT_FOUND`        | User doesn't exist    | userId doesn't reference existing user     |
| `CONTEXT_NOT_FOUND`     | Context doesn't exist | contextId is invalid                       |
| `A2A_TIMEOUT_ERROR`     | Request timeout       | No response within timeout                 |
| `CONVEX_ERROR`          | Database error        | Convex operation failed                    |

**See Also:**

- [Error Handling Guide](./12-error-handling.md)

---

## Next Steps

- **[Conversation Operations API](./03-conversation-operations.md)** - ACID conversation management
- **[Memory Operations API](./02-memory-operations.md)** - Underlying memory system
- **[Context Operations API](./05-context-operations.md)** - Workflow coordination
- **[Types & Interfaces](./11-types-interfaces.md)** - Complete TypeScript definitions

---

**Questions?** Ask in [GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions).
