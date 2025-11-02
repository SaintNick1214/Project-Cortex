# API Integration Details - Open WebUI + Cortex

> **Complete reference for Cortex SDK APIs used in the integration**

This document provides detailed information about all Cortex SDK APIs used in the Open WebUI integration, including code examples, parameters, return values, and best practices.

## Table of Contents
- [Memory API (Layer 4)](#memory-api-layer-4)
- [User Management API](#user-management-api)
- [Context Chains API](#context-chains-api)
- [Facts API (Layer 3)](#facts-api-layer-3)
- [Agent Registry API](#agent-registry-api)
- [Memory Spaces API](#memory-spaces-api)
- [Lower Layer APIs](#lower-layer-apis)
- [Error Handling](#error-handling)

---

## Memory API (Layer 4)

The Memory API is the primary high-level API for most use cases. It orchestrates Layers 1-3 automatically.

### `cortex.memory.remember()`

**Purpose**: Store a conversation with automatic embedding generation and optional fact extraction.

**Signature**:
```typescript
remember(params: RememberParams): Promise<RememberResult>
```

**Parameters**:
```typescript
interface RememberParams {
  // Required
  memorySpaceId: string;          // User ID or shared space ID
  conversationId: string;          // Unique conversation identifier
  userMessage: string;             // User's message
  
  // Optional
  agentResponse?: string;          // Agent's response (can be added later)
  userId?: string;                 // User ID (if different from memorySpaceId)
  userName?: string;               // User's display name
  embedding?: number[];            // Pre-generated embedding (optional)
  contextId?: string;              // Context chain ID
  participantId?: string;          // Agent/participant ID
  importance?: number;             // 1-10, default: 5
  extractFacts?: boolean;          // Enable auto fact extraction
  syncToGraph?: boolean;           // Sync to graph database
  metadata?: Record<string, any>;  // Additional metadata
}
```

**Return Value**:
```typescript
interface RememberResult {
  conversationId: string;          // Conversation ID
  memoryId: string;                // Memory ID (Layer 2)
  success: boolean;
  extractedFacts?: FactRecord[];   // If extractFacts: true
  timestamp: Date;
}
```

**Example Usage**:
```typescript
// Store user message with automatic embedding
const result = await cortex.memory.remember({
  memorySpaceId: 'user-123',
  conversationId: 'conv-456',
  userMessage: 'How do I deploy to production?',
  agentResponse: 'Here are the deployment steps...',
  userId: 'user-123',
  userName: 'Alice',
  contextId: 'project-deployment',
  participantId: 'gpt-4',
  importance: 7,
  extractFacts: true,  // Extract facts automatically
  metadata: {
    model: 'gpt-4',
    temperature: 0.7,
    tokens: 250
  }
});

console.log(`Stored conversation: ${result.conversationId}`);
console.log(`Memory ID: ${result.memoryId}`);
if (result.extractedFacts) {
  console.log(`Extracted ${result.extractedFacts.length} facts`);
}
```

**Best Practices**:
- ✅ Always provide `memorySpaceId` (user ID)
- ✅ Generate unique `conversationId` per conversation
- ✅ Set `importance` based on message significance
- ✅ Enable `extractFacts` for long-term knowledge storage
- ✅ Include relevant `metadata` for debugging

---

### `cortex.memory.recall()`

**Purpose**: Semantic search across conversation history with multi-strategy fallback.

**Signature**:
```typescript
recall(options: SearchMemoryOptions): Promise<EnrichedMemory[]>
```

**Parameters**:
```typescript
interface SearchMemoryOptions {
  // Required
  memorySpaceId: string;           // User ID or shared space ID
  query: string;                   // Search query
  
  // Optional
  embedding?: number[];            // Pre-generated query embedding
  limit?: number;                  // Max results (default: 10)
  contextId?: string;              // Filter by context
  participantId?: string;          // Filter by agent
  includeParentContexts?: boolean; // Include parent contexts
  includeEmbedding?: boolean;      // Include embeddings in results
  startDate?: Date;                // Temporal filter (start)
  endDate?: Date;                  // Temporal filter (end)
  minImportance?: number;          // Filter by importance
}
```

**Return Value**:
```typescript
interface EnrichedMemory {
  memoryId: string;
  conversationId: string;
  content: string;                 // User message + agent response
  userMessage: string;
  agentResponse?: string;
  similarity?: number;             // 0-1 cosine similarity
  importance: number;
  timestamp: Date;
  userId?: string;
  userName?: string;
  contextId?: string;
  participantId?: string;
  metadata?: Record<string, any>;
  embedding?: number[];            // If includeEmbedding: true
}
```

**Example Usage**:
```typescript
// Semantic search with context filtering
const memories = await cortex.memory.recall({
  memorySpaceId: 'user-123',
  query: 'deployment strategies',
  limit: 10,
  contextId: 'project-deployment',
  participantId: 'gpt-4',
  minImportance: 5,
  startDate: new Date('2025-10-01'),
  includeEmbedding: false
});

console.log(`Found ${memories.length} relevant memories`);
memories.forEach((memory, i) => {
  console.log(`${i+1}. [${memory.similarity?.toFixed(2)}] ${memory.content}`);
  console.log(`   From: ${memory.timestamp.toISOString()}`);
});
```

**Multi-Strategy Retrieval**:
Cortex automatically tries multiple strategies in order:
1. **Vector Search** (cosine similarity on embeddings)
2. **Fact Search** (structured knowledge queries)
3. **Text Search** (full-text search fallback)
4. **Fuzzy Search** (if all else fails)

**Best Practices**:
- ✅ Set appropriate `limit` (10-20 for chat context)
- ✅ Use `contextId` to scope searches to specific projects
- ✅ Filter by `participantId` for agent-specific recalls
- ✅ Use temporal filters for time-based queries
- ✅ Check `similarity` scores (>0.8 = highly relevant)

---

### `cortex.memory.forget()`

**Purpose**: Delete a memory with cascade options.

**Signature**:
```typescript
forget(
  memorySpaceId: string,
  memoryId: string,
  options?: ExtendedForgetOptions
): Promise<ForgetResult>
```

**Parameters**:
```typescript
interface ExtendedForgetOptions {
  deleteFacts?: boolean;           // Delete linked facts (default: true)
  deleteConversation?: boolean;    // Delete source conversation
  archiveOnly?: boolean;           // Soft delete (mark as deleted)
  syncToGraph?: boolean;           // Sync deletion to graph
}
```

**Example Usage**:
```typescript
// Delete memory and all related data
const result = await cortex.memory.forget(
  'user-123',
  'memory-789',
  {
    deleteFacts: true,
    deleteConversation: false,  // Keep conversation for audit
    syncToGraph: true
  }
);

console.log(`Deleted memory, ${result.factsDeleted} facts removed`);
```

---

## User Management API

### `cortex.users.create()`

**Purpose**: Create a user profile in Cortex.

**Signature**:
```typescript
create(params: CreateUserParams): Promise<UserRecord>
```

**Parameters**:
```typescript
interface CreateUserParams {
  userId: string;                  // Unique user ID
  name: string;                    // Display name
  email: string;                   // Email address
  metadata?: {
    preferences?: Record<string, any>;
    role?: string;
    department?: string;
    [key: string]: any;
  };
}
```

**Example Usage**:
```typescript
await cortex.users.create({
  userId: 'alice-123',
  name: 'Alice Johnson',
  email: 'alice@example.com',
  metadata: {
    preferences: {
      theme: 'dark',
      language: 'en',
      model: 'gpt-4'
    },
    role: 'developer',
    department: 'engineering'
  }
});
```

---

### `cortex.users.get()`

**Purpose**: Retrieve user profile.

**Signature**:
```typescript
get(userId: string): Promise<UserRecord>
```

**Example Usage**:
```typescript
const user = await cortex.users.get('alice-123');
console.log(`User: ${user.name}`);
console.log(`Preferences:`, user.metadata?.preferences);
```

---

### `cortex.users.update()`

**Purpose**: Update user profile.

**Example Usage**:
```typescript
await cortex.users.update({
  userId: 'alice-123',
  metadata: {
    preferences: {
      model: 'gpt-4-turbo',
      temperature: 0.8
    }
  }
});
```

---

### `cortex.users.delete()`

**Purpose**: GDPR-compliant cascade deletion.

**Signature**:
```typescript
delete(
  userId: string,
  options?: {
    cascade?: boolean;             // Delete ALL user data (default: false)
    verify?: boolean;              // Check for orphaned records
    syncToGraph?: boolean;         // Sync deletion to graph
  }
): Promise<DeleteResult>
```

**Example Usage**:
```typescript
// Complete GDPR deletion
const result = await cortex.users.delete('alice-123', {
  cascade: true,   // Delete across ALL layers
  verify: true     // Check for orphans
});

console.log(`Deleted user and ${result.conversationsDeleted} conversations`);
console.log(`Memories deleted: ${result.memoriesDeleted}`);
console.log(`Facts deleted: ${result.factsDeleted}`);
```

**What Gets Deleted**:
- ✅ User profile
- ✅ All conversations (Layer 1)
- ✅ All vector memories (Layer 2)
- ✅ All facts (Layer 3)
- ✅ All context chains
- ✅ Graph relationships (if enabled)

---

## Context Chains API

### `cortex.contexts.create()`

**Purpose**: Create hierarchical workflow contexts.

**Signature**:
```typescript
create(params: CreateContextParams): Promise<ContextRecord>
```

**Parameters**:
```typescript
interface CreateContextParams {
  name: string;                    // Context name
  description?: string;            // Description
  memorySpaceId: string;           // Owner memory space
  parentId?: string;               // Parent context ID (null = root)
  metadata?: {
    deadline?: string;
    priority?: 'high' | 'medium' | 'low';
    assignedTo?: string;
    [key: string]: any;
  };
}
```

**Example Usage**:
```typescript
// Create project (root context)
const project = await cortex.contexts.create({
  name: 'Website Redesign',
  description: 'Q4 2025 website overhaul',
  memorySpaceId: 'team-eng',
  parentId: null,
  metadata: {
    deadline: '2025-12-31',
    priority: 'high'
  }
});

// Create sprint (child context)
const sprint = await cortex.contexts.create({
  name: 'Sprint 1: Homepage',
  description: 'Focus on landing page',
  memorySpaceId: 'team-eng',
  parentId: project.contextId,
  metadata: {
    startDate: '2025-11-01',
    endDate: '2025-11-15'
  }
});

// Create task (grandchild context)
const task = await cortex.contexts.create({
  name: 'Hero Section Design',
  description: 'Design new hero section',
  memorySpaceId: 'team-eng',
  parentId: sprint.contextId,
  metadata: {
    assignedTo: 'alice-123'
  }
});
```

---

### `cortex.contexts.list()`

**Purpose**: List all contexts for a memory space.

**Example Usage**:
```typescript
const contexts = await cortex.contexts.list('team-eng');
console.log(`Found ${contexts.length} contexts`);

// Build hierarchy
const rootContexts = contexts.filter(c => !c.parentId);
rootContexts.forEach(root => {
  console.log(`\n${root.name}`);
  const children = contexts.filter(c => c.parentId === root.contextId);
  children.forEach(child => {
    console.log(`  ├─ ${child.name}`);
  });
});
```

---

### `cortex.contexts.getChain()`

**Purpose**: Get full context chain (from root to current).

**Example Usage**:
```typescript
const chain = await cortex.contexts.getChain(task.contextId);
console.log('Context chain:');
chain.forEach((ctx, i) => {
  console.log(`${'  '.repeat(i)}${ctx.name}`);
});
// Output:
// Website Redesign
//   Sprint 1: Homepage
//     Hero Section Design
```

---

## Facts API (Layer 3)

### `cortex.facts.extract()`

**Purpose**: Extract structured facts from text.

**Signature**:
```typescript
extract(params: ExtractFactsParams): Promise<FactRecord[]>
```

**Parameters**:
```typescript
interface ExtractFactsParams {
  content: string;                 // Text to extract from
  memorySpaceId: string;
  conversationId?: string;
  memoryId?: string;
  extractorType?: 'llm' | 'rule-based';
  metadata?: Record<string, any>;
}
```

**Example Usage**:
```typescript
const facts = await cortex.facts.extract({
  content: 'Alice works at Acme Corp as a Senior Engineer specializing in TypeScript',
  memorySpaceId: 'user-123',
  extractorType: 'llm',
  metadata: { source: 'manual' }
});

facts.forEach(fact => {
  console.log(`${fact.entity} | ${fact.attribute} | ${fact.value}`);
});
// Output:
// Alice | employer | Acme Corp
// Alice | role | Senior Engineer
// Alice | specialization | TypeScript
```

---

### `cortex.facts.query()`

**Purpose**: Query structured facts.

**Example Usage**:
```typescript
const facts = await cortex.facts.query({
  memorySpaceId: 'user-123',
  entity: 'Alice',
  limit: 10
});

console.log(`Found ${facts.length} facts about Alice`);
facts.forEach(fact => {
  console.log(`- ${fact.attribute}: ${fact.value}`);
});
```

---

### `cortex.facts.list()`

**Purpose**: List all facts in a memory space.

**Example Usage**:
```typescript
const allFacts = await cortex.facts.list({
  memorySpaceId: 'user-123',
  contextId: 'project-xyz',
  limit: 100
});
```

---

## Agent Registry API

### `cortex.agents.register()`

**Purpose**: Register an AI agent.

**Signature**:
```typescript
register(params: RegisterAgentParams): Promise<AgentRecord>
```

**Parameters**:
```typescript
interface RegisterAgentParams {
  agentId: string;                 // Unique agent ID
  name: string;                    // Display name
  capabilities?: string[];         // ['reasoning', 'coding', 'writing']
  metadata?: {
    provider?: string;             // 'openai', 'anthropic', 'ollama'
    model?: string;                // 'gpt-4', 'claude-3-opus'
    contextWindow?: number;
    [key: string]: any;
  };
}
```

**Example Usage**:
```typescript
// Register GPT-4
await cortex.agents.register({
  agentId: 'gpt-4',
  name: 'GPT-4',
  capabilities: ['reasoning', 'coding', 'analysis'],
  metadata: {
    provider: 'openai',
    model: 'gpt-4-turbo',
    contextWindow: 128000
  }
});

// Register Claude
await cortex.agents.register({
  agentId: 'claude-3-opus',
  name: 'Claude 3 Opus',
  capabilities: ['reasoning', 'writing', 'analysis'],
  metadata: {
    provider: 'anthropic',
    model: 'claude-3-opus',
    contextWindow: 200000
  }
});
```

---

### `cortex.agents.list()`

**Purpose**: List all registered agents.

**Example Usage**:
```typescript
const agents = await cortex.agents.list();
console.log('Available agents:');
agents.forEach(agent => {
  console.log(`- ${agent.name} (${agent.agentId})`);
  console.log(`  Capabilities: ${agent.capabilities?.join(', ')}`);
});
```

---

### `cortex.agents.unregister()`

**Purpose**: Remove agent with cascade deletion.

**Example Usage**:
```typescript
// Remove agent and all its data
await cortex.agents.unregister('gpt-4', {
  cascade: true,   // Delete all memories by this agent
  verify: true     // Check for orphans
});
```

---

## Memory Spaces API

### `cortex.memorySpaces.create()`

**Purpose**: Create memory space with mode (hive/isolated/collaboration).

**Parameters**:
```typescript
interface CreateMemorySpaceParams {
  memorySpaceId: string;
  name: string;
  mode: 'hive' | 'isolated' | 'collaboration';
  participants?: Array<{
    participantId: string;
    role?: string;
  }>;
  metadata?: Record<string, any>;
}
```

**Example Usage**:
```typescript
// Hive Mode - Shared memory
await cortex.memorySpaces.create({
  memorySpaceId: 'design-team-hive',
  name: 'Design Team Hive',
  mode: 'hive',
  participants: [
    { participantId: 'gpt-4', role: 'designer' },
    { participantId: 'claude-3', role: 'copywriter' },
    { participantId: 'gemini-pro', role: 'researcher' }
  ]
});

// Isolated Mode - Private memory
await cortex.memorySpaces.create({
  memorySpaceId: 'gpt-4-private',
  name: 'GPT-4 Private Space',
  mode: 'isolated',
  participants: [{ participantId: 'gpt-4' }]
});
```

---

## Lower Layer APIs

For advanced use cases, you can access lower-layer APIs directly:

### Layer 1: Conversations (ACID)
```typescript
// Direct conversation operations
await cortex.conversations.create({...});
await cortex.conversations.get(conversationId);
await cortex.conversations.update({...});
await cortex.conversations.delete(conversationId);
```

### Layer 2: Vector Memory
```typescript
// Direct vector operations
await cortex.vector.store({...});
await cortex.vector.search({...});
await cortex.vector.delete(memoryId);
```

### Layer 1b: Immutable Store
```typescript
// Versioned data storage
await cortex.immutable.create({...});
await cortex.immutable.getVersion(id, version);
```

### Layer 1c: Mutable Store
```typescript
// Live state management
await cortex.mutable.set({...});
await cortex.mutable.get(key);
```

---

## Error Handling

### Common Error Types

```typescript
try {
  await cortex.memory.remember({...});
} catch (error) {
  if (error.code === 'CONVEX_TIMEOUT') {
    // Retry logic
  } else if (error.code === 'INVALID_EMBEDDING') {
    // Handle embedding generation failure
  } else if (error.code === 'MEMORY_SPACE_NOT_FOUND') {
    // Create memory space first
  } else {
    // Generic error handling
    console.error('Unexpected error:', error);
  }
}
```

### Best Practices

**1. Always Handle Errors:**
```typescript
try {
  const result = await cortex.memory.remember({...});
  return result;
} catch (error) {
  logger.error('Failed to store memory', { error });
  throw new HTTPException(500, 'Memory storage failed');
}
```

**2. Use Timeouts:**
```typescript
const timeout = 30000; // 30 seconds
const result = await Promise.race([
  cortex.memory.recall({...}),
  new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Timeout')), timeout)
  )
]);
```

**3. Implement Retries:**
```typescript
async function rememberWithRetry(params, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await cortex.memory.remember(params);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}
```

---

## API Rate Limits

**Convex Limits** (default free tier):
- 1,000 requests/minute
- 10 GB data storage
- 1 GB/month bandwidth

**Recommended Practices:**
- ✅ Batch operations when possible
- ✅ Cache frequently accessed data
- ✅ Use webhooks for real-time updates
- ✅ Implement exponential backoff

---

## Summary

This integration uses **12 primary Cortex APIs**:

**Core Memory:**
- `memory.remember()` - Store conversations
- `memory.recall()` - Semantic search
- `memory.forget()` - Delete with cascade

**User Management:**
- `users.create()` - Create profiles
- `users.get()` - Retrieve profiles
- `users.delete()` - GDPR deletion

**Organization:**
- `contexts.create()` - Hierarchical contexts
- `contexts.list()` - List contexts
- `contexts.getChain()` - Get hierarchy

**Knowledge:**
- `facts.extract()` - Extract facts
- `facts.query()` - Query facts

**Multi-Agent:**
- `agents.register()` - Register agents
- `memorySpaces.create()` - Create spaces

Next: [06-DEPLOYMENT.md](./06-DEPLOYMENT.md) - Production deployment guide

