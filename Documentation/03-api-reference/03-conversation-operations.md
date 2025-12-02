# Conversation Operations API

> **Last Updated**: 2025-10-28

Complete API reference for ACID conversation management (Layer 1a).

## Overview

The Conversation Operations API (`cortex.conversations.*`) manages **immutable conversation threads** - the Layer 1a foundation that provides the source of truth for all message history.

**Key Characteristics:**

- ✅ **Immutable** - Messages never modified, only appended
- ✅ **Append-Only** - Conversations grow, never shrink (unless deleted)
- ✅ **ACID Guarantees** - Atomic, consistent, isolated, durable
- ✅ **No Retention Limits** - Kept forever (unlike Vector with retention)
- ✅ **Audit Trail** - Complete message history for compliance
- ✅ **Referenced** - Vector memories link back via `conversationRef`

**Relationship to Other Layers:**

```
Layer 1a: ACID Conversations (THIS API)
└── Immutable source of truth

Layer 2: Vector Memories
└── References Layer 1a via conversationRef

Layer 3: Memory API
└── Uses Layer 1a + Layer 2 (cortex.memory.remember())
```

**Conversation Types:**

| Type          | Participants  | Use Case                                          |
| ------------- | ------------- | ------------------------------------------------- |
| `user-agent`  | User + Agent  | User chatting with AI agent                       |
| `agent-agent` | Agent + Agent | A2A communication (managed by cortex.a2a helpers) |

**Why Layer 1a Exists:**

- ✅ Complete audit trail (Vector has retention limits)
- ✅ Compliance (legal requirement for message history)
- ✅ Context retrieval (can always get full conversation)
- ✅ Source of truth (Vector is index, this is reality)

---

## Core Operations

### create()

Create a new conversation.

**Signature:**

```typescript
cortex.conversations.create(
  params: ConversationInput,
  options?: { syncToGraph?: boolean }
): Promise<Conversation>
```

**Parameters:**

```typescript
interface ConversationInput {
  // Type (REQUIRED)
  type: "user-agent" | "agent-agent";

  // Participants (REQUIRED)
  participants: UserAgentParticipants | AgentAgentParticipants;

  // Metadata (optional)
  metadata?: Record<string, any>;
}

// For user-agent conversations
interface UserAgentParticipants {
  userId: string;
  memorySpaceId: string; // Which memory space this conversation belongs to
  participantId?: string; // Optional: For Hive Mode tracking
}

// For agent-agent conversations (A2A)
interface AgentAgentParticipants {
  agent1: string;
  agent2: string;
}
```

**Returns:**

```typescript
interface Conversation {
  conversationId: string;
  type: "user-agent" | "agent-agent";
  participants: UserAgentParticipants | AgentAgentParticipants;

  messages: Message[]; // Initially empty
  messageCount: number; // Initially 0

  metadata: Record<string, any>;

  createdAt: Date;
  updatedAt: Date;
  lastMessageAt?: Date;
}
```

**Side Effects:**

- Creates new conversation entity in Convex
- Initially contains no messages (append via `addMessage()`)

**Example 1: User-agent conversation**

```typescript
const conversation = await cortex.conversations.create({
  type: "user-agent",
  participants: {
    userId: "user-123",
    memorySpaceId: "support-bot-space",
    participantId: "support-agent",
  },
  metadata: {
    channel: "web-chat",
    source: "website",
  },
});

console.log(conversation.conversationId); // 'conv-abc123'
console.log(conversation.messageCount); // 0 (empty initially)
```

**Example 2: Agent-agent conversation (A2A)**

```typescript
const a2aConvo = await cortex.conversations.create({
  type: "agent-agent",
  participants: {
    agent1: "finance-agent",
    agent2: "hr-agent",
  },
  metadata: {
    createdBy: "finance-agent",
    purpose: "budget-discussion",
  },
});

console.log(a2aConvo.conversationId); // 'a2a-conv-789'
```

**Errors:**

- `CortexError('INVALID_TYPE')` - Type is not 'user-agent' or 'agent-agent'
- `CortexError('INVALID_PARTICIPANTS')` - Participants are malformed
- `CortexError('AGENT_NOT_FOUND')` - Agent ID doesn't exist (if registry enabled)
- `CortexError('CONVEX_ERROR')` - Database error

**See Also:**

- [Conversation History Guide](../02-core-features/06-conversation-history.md#storing-messages)

---

### get()

Retrieve a conversation by ID.

**Signature:**

```typescript
cortex.conversations.get(
  conversationId: string,
  options?: GetOptions
): Promise<Conversation | null>
```

**Parameters:**

```typescript
interface GetOptions {
  includeMessages?: boolean; // Include message array (default: true)
  messageLimit?: number; // Limit messages returned (default: all)
}
```

**Returns:**

- `Conversation` - Complete conversation with messages
- `null` - If conversation doesn't exist

**Example:**

```typescript
const conversation = await cortex.conversations.get("conv-123");

if (conversation) {
  console.log(`Conversation with ${conversation.participants.userId}`);
  console.log(`${conversation.messageCount} total messages`);
  console.log(`Last message: ${conversation.lastMessageAt}`);

  // Access messages
  conversation.messages.forEach((msg) => {
    console.log(`${msg.role}: ${msg.content}`);
  });
}
```

**Errors:**

- `CortexError('INVALID_CONVERSATION_ID')` - Conversation ID is invalid

---

### addMessage()

Add a message to an existing conversation (append-only).

**Signature:**

```typescript
cortex.conversations.addMessage(
  conversationId: string,
  message: MessageInput,
  options?: { syncToGraph?: boolean }
): Promise<Message>
```

**Parameters:**

```typescript
interface MessageInput {
  // User-agent messages
  role?: "user" | "agent" | "system";
  content?: string; // For user-agent
  userId?: string; // If role='user'
  participantId?: string; // If role='agent' (participant in Hive Mode)

  // Agent-agent messages (A2A)
  type?: "a2a";
  from?: string; // For A2A
  to?: string; // For A2A
  text?: string; // For A2A

  // Optional
  timestamp?: Date; // Default: now
  metadata?: Record<string, any>;
}
```

**Returns:**

```typescript
interface Message {
  id: string; // Use this in conversationRef!

  // User-agent fields
  role?: "user" | "agent" | "system";
  content?: string;
  userId?: string;
  participantId?: string; // Hive Mode tracking

  // Agent-agent fields
  type?: "a2a";
  from?: string;
  to?: string;
  text?: string;

  timestamp: Date;
  metadata?: Record<string, any>;
}
```

**Side Effects:**

- Appends message to conversation (immutable)
- Updates conversation `updatedAt` and `lastMessageAt`
- Increments `messageCount`

**Example 1: User-agent conversation**

```typescript
// User message
const userMsg = await cortex.conversations.addMessage("conv-123", {
  role: "user",
  content: "What is my account balance?",
  userId: "user-123",
  timestamp: new Date(),
});

console.log(userMsg.id); // 'msg-001' - use in conversationRef!

// Agent response
const agentMsg = await cortex.conversations.addMessage("conv-123", {
  role: "agent",
  content: "Your account balance is $1,234.56",
  participantId: "support-agent", // Hive Mode
  timestamp: new Date(),
});

console.log(agentMsg.id); // 'msg-002'

// Now create Vector memory referencing these ACID messages
await cortex.vector.store("support-agent", {
  content: "User asked about balance, replied with $1,234.56",
  contentType: "summarized",
  userId: "user-123",
  source: { type: "conversation", userId: "user-123", timestamp: new Date() },
  conversationRef: {
    conversationId: "conv-123",
    messageIds: [userMsg.id, agentMsg.id], // ← Links to ACID!
  },
  metadata: { importance: 70, tags: ["balance", "query"] },
});
```

**Example 2: Agent-agent conversation (A2A)**

```typescript
// A2A message
const a2aMsg = await cortex.conversations.addMessage("a2a-conv-789", {
  type: "a2a",
  from: "finance-agent",
  to: "hr-agent",
  text: "What is the Q4 headcount budget?",
  timestamp: new Date(),
});

console.log(a2aMsg.id); // 'a2a-msg-001'

// cortex.a2a.send() does this automatically + Vector storage!
```

**Errors:**

- `CortexError('CONVERSATION_NOT_FOUND')` - Conversation doesn't exist
- `CortexError('INVALID_MESSAGE')` - Message is malformed
- `CortexError('CONVEX_ERROR')` - Database error

**See Also:**

- [Storing Messages](../02-core-features/06-conversation-history.md#storing-messages)

---

### getHistory()

Get message thread from a conversation with pagination.

**Signature:**

```typescript
cortex.conversations.getHistory(
  conversationId: string,
  options?: HistoryOptions
): Promise<Message[]>
```

**Parameters:**

```typescript
interface HistoryOptions {
  limit?: number; // Max messages (default: 100)
  offset?: number; // Skip N messages (default: 0)
  order?: "asc" | "desc"; // Chronological order (default: 'desc')
  since?: Date; // Messages after date
  until?: Date; // Messages before date
  roles?: ("user" | "agent" | "system")[]; // Filter by role (user-agent only)
}
```

**Returns:**

- `Message[]` - Array of messages (chronologically ordered)

**Example:**

```typescript
// Get last 50 messages
const recent = await cortex.conversations.getHistory("conv-123", {
  limit: 50,
  order: "desc", // Most recent first
});

// Get messages from specific date range
const october = await cortex.conversations.getHistory("conv-123", {
  since: new Date("2025-10-01"),
  until: new Date("2025-10-31"),
  order: "asc", // Chronological
});

// Get only user messages
const userMessages = await cortex.conversations.getHistory("conv-123", {
  roles: ["user"],
  limit: 20,
});

// Display conversation
recent.forEach((msg) => {
  if (msg.role) {
    console.log(`${msg.role}: ${msg.content}`);
  } else {
    console.log(`${msg.from} → ${msg.to}: ${msg.text}`);
  }
});
```

**Errors:**

- `CortexError('CONVERSATION_NOT_FOUND')` - Conversation doesn't exist
- `CortexError('INVALID_OPTIONS')` - Options are malformed

---

### list()

List conversations with filters and pagination.

**Signature:**

```typescript
cortex.conversations.list(
  filters?: ConversationFilters,
  options?: ListOptions
): Promise<ListResult>
```

**Parameters:**

```typescript
interface ConversationFilters {
  // Type
  type?: "user-agent" | "agent-agent";

  // Participants
  userId?: string;
  participantId?: string; // Hive Mode tracking
  "participants.agent1"?: string; // For agent-agent
  "participants.agent2"?: string; // For agent-agent

  // Metadata
  metadata?: Record<string, any>;

  // Dates
  createdBefore?: Date;
  createdAfter?: Date;
  updatedBefore?: Date;
  updatedAfter?: Date;
  lastMessageBefore?: Date;
  lastMessageAfter?: Date;

  // Message count
  messageCount?: number | RangeQuery;
}

interface ListOptions {
  limit?: number; // Default: 50
  offset?: number; // Default: 0
  sortBy?: "createdAt" | "updatedAt" | "lastMessageAt" | "messageCount";
  sortOrder?: "asc" | "desc";
  includeMessages?: boolean; // Include message arrays (default: false)
}

interface ListResult {
  conversations: Conversation[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}
```

**Returns:**

- `ListResult` - Paginated list of conversations

**Example:**

```typescript
// List all user-agent conversations
const userConvos = await cortex.conversations.list({
  type: "user-agent",
  sortBy: "lastMessageAt",
  sortOrder: "desc",
  limit: 50,
});

console.log(`Found ${userConvos.total} conversations`);

// List conversations for specific user
const userHistory = await cortex.conversations.list({
  userId: "user-123",
  sortBy: "lastMessageAt",
  sortOrder: "desc",
});

// List active conversations (recent messages)
const active = await cortex.conversations.list({
  lastMessageAfter: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24h
});

// List A2A conversations between two agents
const a2aConvos = await cortex.conversations.list({
  type: "agent-agent",
  $or: [
    {
      "participants.agent1": "finance-agent",
      "participants.agent2": "hr-agent",
    },
    {
      "participants.agent1": "hr-agent",
      "participants.agent2": "finance-agent",
    },
  ],
});
```

**Errors:**

- `CortexError('INVALID_FILTERS')` - Filters are malformed
- `CortexError('INVALID_PAGINATION')` - Invalid limit/offset

---

### search()

Search conversations by content with filters.

**Signature:**

```typescript
cortex.conversations.search(
  query: string,
  filters?: ConversationFilters,
  options?: SearchOptions
): Promise<SearchResult[]>
```

**Parameters:**

```typescript
interface SearchOptions extends ConversationFilters {
  limit?: number; // Default: 20
  searchIn?: "content" | "metadata" | "both"; // Default: 'content'
  matchMode?: "contains" | "exact" | "fuzzy"; // Default: 'contains'
}
```

**Returns:**

```typescript
interface SearchResult {
  conversation: Conversation;
  matchedMessages: Message[]; // Messages that matched query
  score: number; // Relevance score
  highlights?: string[]; // Matched snippets
}
```

**Example:**

```typescript
// Search for conversations about "refund"
const results = await cortex.conversations.search("refund", {
  type: "user-agent",
  userId: "user-123",
  limit: 10,
});

results.forEach((result) => {
  console.log(`Conversation: ${result.conversation.conversationId}`);
  console.log(`Matched messages: ${result.matchedMessages.length}`);
  result.matchedMessages.forEach((msg) => {
    console.log(`  ${msg.role}: ${msg.content}`);
  });
});

// Search A2A conversations
const a2aResults = await cortex.conversations.search("budget approval", {
  type: "agent-agent",
  "participants.agent1": "finance-agent",
});
```

**Errors:**

- `CortexError('INVALID_QUERY')` - Query is empty
- `CortexError('INVALID_FILTERS')` - Filters are malformed

---

### count()

Count conversations matching filters.

**Signature:**

```typescript
cortex.conversations.count(
  filters?: ConversationFilters
): Promise<number>
```

**Example:**

```typescript
// Total conversations
const total = await cortex.conversations.count();

// Count for specific user
const userCount = await cortex.conversations.count({
  userId: "user-123",
});

// Count active (recent message) conversations
const active = await cortex.conversations.count({
  lastMessageAfter: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
});

// Count A2A conversations
const a2aCount = await cortex.conversations.count({
  type: "agent-agent",
});
```

---

### export()

Export conversations to JSON or CSV.

**Signature:**

```typescript
cortex.conversations.export(
  filters?: ConversationFilters,
  options?: ExportOptions
): Promise<string | ExportData>
```

**Parameters:**

```typescript
interface ExportOptions {
  format: "json" | "csv";
  outputPath?: string;
  includeMetadata?: boolean; // Default: true
  includeFullMessages?: boolean; // Default: true
}
```

**Example:**

```typescript
// Export all conversations for a user (GDPR)
const userData = await cortex.conversations.export(
  {
    userId: "user-123",
  },
  {
    format: "json",
    outputPath: "exports/user-123-conversations.json",
    includeFullMessages: true,
  },
);

// Export conversations from date range
await cortex.conversations.export(
  {
    createdAfter: new Date("2025-10-01"),
    createdBefore: new Date("2025-10-31"),
  },
  {
    format: "csv",
    outputPath: "exports/october-conversations.csv",
  },
);
```

**Errors:**

- `CortexError('INVALID_FORMAT')` - Format not supported
- `CortexError('EXPORT_FAILED')` - File write error

---

### delete()

Delete a conversation and all its messages.

> **Warning:** This is permanent! Consider using Vector memory deletion instead to preserve ACID audit trail.

**Signature:**

```typescript
cortex.conversations.delete(
  conversationId: string,
  options?: { syncToGraph?: boolean }
): Promise<DeletionResult>
```

**Returns:**

```typescript
interface DeletionResult {
  deleted: boolean;
  conversationId: string;
  messagesDeleted: number;
  deletedAt: Date;
  restorable: boolean; // Always false (permanent)
}
```

**Example:**

```typescript
const result = await cortex.conversations.delete("conv-123");

console.log(`Deleted conversation with ${result.messagesDeleted} messages`);
console.log(`Restorable: ${result.restorable}`); // false - permanent!

// WARNING: Vector memories with conversationRef to this conversation
// will have broken references! Usually better to delete Vector only.
```

**Errors:**

- `CortexError('CONVERSATION_NOT_FOUND')` - Conversation doesn't exist
- `CortexError('DELETION_FAILED')` - Delete operation failed

---

### deleteMany()

Bulk delete conversations matching filters.

**Signature:**

```typescript
cortex.conversations.deleteMany(
  filters: ConversationFilters,
  options?: DeleteManyOptions
): Promise<DeleteManyResult>
```

**Parameters:**

```typescript
interface DeleteManyOptions {
  dryRun?: boolean;
  requireConfirmation?: boolean;
  confirmationThreshold?: number; // Default: 10
}

interface DeleteManyResult {
  deleted: number;
  conversationIds: string[];
  totalMessagesDeleted: number;
  wouldDelete?: number; // For dryRun
}
```

**Example:**

```typescript
// Preview deletion
const preview = await cortex.conversations.deleteMany(
  {
    userId: "user-123",
    lastMessageBefore: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
  },
  {
    dryRun: true,
  },
);

console.log(`Would delete ${preview.wouldDelete} old conversations`);

// Execute
if (preview.wouldDelete < 100) {
  const result = await cortex.conversations.deleteMany({
    userId: "user-123",
    lastMessageBefore: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
  });

  console.log(`Deleted ${result.deleted} conversations`);
  console.log(`Total messages deleted: ${result.totalMessagesDeleted}`);
}
```

---

## Advanced Operations

### getMessage()

Get a specific message by ID.

**Signature:**

```typescript
cortex.conversations.getMessage(
  conversationId: string,
  messageId: string
): Promise<Message | null>
```

**Example:**

```typescript
const msg = await cortex.conversations.getMessage("conv-123", "msg-001");

console.log(msg.content);
console.log(msg.timestamp);
```

---

### getMessagesByIds()

Get multiple messages by their IDs (batch retrieval).

**Signature:**

```typescript
cortex.conversations.getMessagesByIds(
  conversationId: string,
  messageIds: string[]
): Promise<Message[]>
```

**Example:**

```typescript
// Get specific messages referenced by Vector memory
const memory = await cortex.memory.get("agent-1", "mem-123");

if (memory.conversationRef) {
  const sourceMessages = await cortex.conversations.getMessagesByIds(
    memory.conversationRef.conversationId,
    memory.conversationRef.messageIds,
  );

  console.log("Original messages that informed this memory:");
  sourceMessages.forEach((msg) => console.log(msg.content));
}
```

---

### findConversation()

Find an existing conversation between participants.

**Signature:**

```typescript
cortex.conversations.findConversation(
  participants: UserAgentParticipants | AgentAgentParticipants
): Promise<Conversation | null>
```

**Example:**

```typescript
// Find existing user-agent conversation
const existing = await cortex.conversations.findConversation({
  userId: 'user-123',
  memorySpaceId: 'support-bot-space',
  participantId: 'support-agent',
});

if (existing) {
  // Reuse existing conversation
  await cortex.conversations.addMessage(existing.conversationId, { ... });
} else {
  // Create new
  const newConvo = await cortex.conversations.create({ ... });
}

// Find A2A conversation
const a2a = await cortex.conversations.findConversation({
  agent1: 'finance-agent',
  agent2: 'hr-agent',
});
```

---

### getOrCreate()

Get existing conversation or create if doesn't exist.

**Signature:**

```typescript
cortex.conversations.getOrCreate(
  params: ConversationInput
): Promise<Conversation>
```

**Example:**

```typescript
// Always get a conversation (creates if needed)
const conversation = await cortex.conversations.getOrCreate({
  type: "user-agent",
  participants: {
    userId: "user-123",
    memorySpaceId: "support-bot-space",
    participantId: "support-agent",
  },
});

// Use immediately
await cortex.conversations.addMessage(conversation.conversationId, {
  role: "user",
  content: "Hello!",
  userId: "user-123",
});
```

---

## GDPR and Deletion

### Conversations Support userId

Conversations with `userId` are targets for GDPR cascade deletion:

```typescript
// Create user conversation (GDPR-enabled)
const convo = await cortex.conversations.create({
  type: "user-agent",
  participants: {
    userId: "user-123", // ← GDPR link
    participantId: "support-agent", // Hive Mode
  },
});

// GDPR cascade deletion
const result = await cortex.users.delete("user-123", {
  cascade: true,
  deleteFromConversations: true, // ← Deletes Layer 1a
});

console.log(`Conversations deleted: ${result.conversationsDeleted}`);
console.log(`Total messages deleted: ${result.totalMessagesDeleted}`);
```

**Preservation Options:**

```typescript
// Delete Vector memories but preserve ACID audit trail
await cortex.users.delete("user-123", {
  cascade: true,
  deleteFromConversations: false, // ← Preserve Layer 1a
  deleteFromVector: true, // Delete Layer 2
});

// Conversations remain for compliance/audit
const preserved = await cortex.conversations.list({ userId: "user-123" });
console.log(`${preserved.total} conversations preserved for audit`);
```

---

## Best Practices

### 1. Create Conversations Early

```typescript
// ✅ Create at start of session
const conversation = await cortex.conversations.getOrCreate({
  type: 'user-agent',
  participants: { userId, memorySpaceId, participantId },
});

// Then use throughout session
await cortex.conversations.addMessage(conversation.conversationId, { ... });
```

### 2. Link Vector Memories to ACID

```typescript
// Always link Vector memories to their ACID source
const msg = await cortex.conversations.addMessage('conv-123', {
  role: 'user',
  content: 'The password is Blue',
  userId: 'user-123',
});

await cortex.vector.store('agent-1', {
  content: 'The password is Blue',
  conversationRef: {
    conversationId: 'conv-123',
    messageIds: [msg.id],  // ← Critical for audit trail!
  },
  ...
});

// Or use cortex.memory.remember() which does this automatically
```

### 3. Preserve for Audit

```typescript
// Don't delete ACID conversations unless legally required
// Instead, delete Vector memories (searchable index)

// ✅ Good: Delete Vector, keep ACID
await cortex.memory.delete("agent-1", "mem-123");
// Vector deleted, ACID preserved ✅

// ⚠️ Caution: Delete ACID (breaks audit trail)
await cortex.conversations.delete("conv-123");
// Permanent, unrestorable ❌
```

### 4. Use Pagination for Large Conversations

```typescript
// ✅ Paginate large conversations
const page1 = await cortex.conversations.getHistory("conv-123", {
  limit: 50,
  offset: 0,
  order: "desc",
});

const page2 = await cortex.conversations.getHistory("conv-123", {
  limit: 50,
  offset: 50,
  order: "desc",
});

// ❌ Don't load huge conversations at once
const all = await cortex.conversations.get("conv-with-10k-messages");
// Could be slow!
```

### 5. Metadata for Organization

```typescript
// Add useful metadata
await cortex.conversations.create({
  type: "user-agent",
  participants: { userId, memorySpaceId, participantId },
  metadata: {
    channel: "web-chat",
    source: "website",
    campaign: "q4-promotion",
    tags: ["support", "billing"],
  },
});

// Query by metadata
const campaignConvos = await cortex.conversations.list({
  metadata: { campaign: "q4-promotion" },
});
```

---

## Integration Patterns

### Pattern 1: With cortex.memory.remember()

```typescript
// Layer 3 handles ACID + Vector automatically
const result = await cortex.memory.remember({
  participantId: "support-agent", // Hive Mode
  conversationId: "conv-123",
  userMessage: "I need help",
  agentResponse: "How can I assist you?",
  userId: "user-123",
  userName: "Alex",
});

// Behind the scenes:
// 1. Adds 2 messages to ACID conversation
// 2. Creates 2 Vector memories with conversationRef
console.log("ACID messages:", result.conversation.messageIds);
console.log(
  "Vector memories:",
  result.memories.map((m) => m.id),
);
```

### Pattern 2: Manual Layer 1 + Layer 2

```typescript
// Step 1: Store in ACID (Layer 1a)
const userMsg = await cortex.conversations.addMessage("conv-123", {
  role: "user",
  content: "What is my balance?",
  userId: "user-123",
});

const agentMsg = await cortex.conversations.addMessage("conv-123", {
  role: "agent",
  content: "$1,234.56",
  participantId: "support-agent", // Hive Mode
});

// Step 2: Index in Vector (Layer 2)
await cortex.vector.store("support-agent", {
  content: "User asked about balance: $1,234.56",
  contentType: "summarized",
  conversationRef: {
    conversationId: "conv-123",
    messageIds: [userMsg.id, agentMsg.id],
  },
  metadata: { importance: 70 },
});
```

### Pattern 3: A2A with cortex.a2a helpers

```typescript
// A2A helpers manage ACID conversations automatically
await cortex.a2a.send({
  from: "finance-agent",
  to: "hr-agent",
  message: "What is the budget?",
});

// Behind the scenes:
// 1. Creates/finds agent-agent conversation in ACID
// 2. Adds message to ACID
// 3. Stores in both agents' Vector memories with conversationRef
```

---

## Graph-Lite Capabilities

Conversations serve as central graph nodes connecting users, agents, contexts, and memories:

**Conversation as Graph Hub:**

- Connects user to agent (via participants)
- Referenced by memories (via conversationRef)
- Referenced by facts (via conversationRef)
- Referenced by contexts (via conversationRef)

**Graph Patterns:**

```typescript
// User → Conversations (1-hop)
const convos = await cortex.conversations.list({ userId: 'user-123' });

// Conversation → Contexts (reverse lookup)
const contexts = await cortex.contexts.search({
  'conversationRef.conversationId': 'conv-456'
});

// Conversation → Memories (reverse lookup)
const memories = await cortex.memory.search('agent-1', '*', {
  'conversationRef.conversationId': 'conv-456'
});

// Complete graph from conversation
{
  conversation: 'conv-456',
  user: 'user-123',
  agent: 'agent-1',
  triggeredWorkflows: contexts,
  generatedMemories: memories
}
```

**Performance:** Conversations are efficiently indexed by userId and memorySpaceId. Finding related entities within a memory space typically takes 20-80ms.

**Learn more:** [Graph-Lite Traversal](../07-advanced-topics/01-graph-lite-traversal.md)

---

## Error Reference

| Error Code                | Description                | Cause                             |
| ------------------------- | -------------------------- | --------------------------------- |
| `INVALID_CONVERSATION_ID` | Conversation ID invalid    | Empty or malformed ID             |
| `CONVERSATION_NOT_FOUND`  | Conversation doesn't exist | Invalid conversationId            |
| `INVALID_TYPE`            | Type is invalid            | Not 'user-agent' or 'agent-agent' |
| `INVALID_PARTICIPANTS`    | Participants malformed     | Bad participant structure         |
| `INVALID_MESSAGE`         | Message is malformed       | Bad message structure             |
| `INVALID_QUERY`           | Query is invalid           | Empty query string                |
| `INVALID_FILTERS`         | Filters malformed          | Bad filter syntax                 |
| `INVALID_PAGINATION`      | Pagination params bad      | Invalid limit/offset              |
| `INVALID_OPTIONS`         | Options malformed          | Bad option structure              |
| `DELETION_FAILED`         | Delete failed              | Database error                    |
| `EXPORT_FAILED`           | Export failed              | File write error                  |
| `CONVEX_ERROR`            | Database error             | Convex operation failed           |

---

## Next Steps

- **[Memory Operations API](./02-memory-operations.md)** - Layer 2 (Vector) and Layer 3 (Memory) APIs
- **[A2A Communication API](./06-a2a-communication.md)** - Agent-to-agent messaging
- **[Types & Interfaces](./11-types-interfaces.md)** - Complete TypeScript definitions

---

**Questions?** Ask in [GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions).
