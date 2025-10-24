# Memory Operations API

> **Last Updated**: 2025-10-24

Complete API reference for agent memory operations.

## Overview

The Memory Operations API provides methods for storing, retrieving, searching, and managing agent memories in the Vector Memory layer with automatic linking to ACID conversations.

**Architecture Context:**
- Operations work on **Vector Memory** (Layer 2)
- Memories can reference **ACID Conversations** (Layer 1) via `conversationRef`
- All operations support **universal filters**
- Automatic **versioning** with configurable retention

## Storage Flow: ACID First, Then Vector

### Why This Order Matters

```
┌─────────────────────────────────────────────┐
│ Layer 1: ACID Conversations (Immutable)     │
│ ↓ STORE HERE FIRST                          │
│ conversation.addMessage() returns msg.id    │
└────────────┬────────────────────────────────┘
             │
             │ msg.id used in conversationRef
             ↓
┌─────────────────────────────────────────────┐
│ Layer 2: Vector Memories (Searchable)       │
│ ↓ THEN INDEX HERE                           │
│ memory.store() with conversationRef         │
└─────────────────────────────────────────────┘
```

### Manual Flow (2 steps)

**For conversation-based memories:**

```typescript
// Step 1: Store raw message in ACID (Layer 1) - MUST BE FIRST
const msg = await cortex.conversations.addMessage('conv-456', {
  role: 'user',
  text: 'The password is Blue',
  userId: 'user-123',
  timestamp: new Date()
});
// Returns: { id: 'msg-789', ... }

// Step 2: Index in Vector Memory (Layer 2) - references Step 1
const memory = await cortex.memory.store('agent-1', {
  content: 'The password is Blue',  // Raw or extracted
  contentType: 'raw',
  embedding: await embed('The password is Blue'),  // Optional
  userId: 'user-123',
  source: {
    type: 'conversation',  // ← Indicates this came from a conversation
    userId: 'user-123',
    userName: 'Alex Johnson',
    timestamp: new Date()
  },
  conversationRef: {  // ← REQUIRED for conversations, links to ACID
    conversationId: 'conv-456',
    messageIds: [msg.id]  // From Step 1's returned ID
  },
  metadata: {
    importance: 100,
    tags: ['password', 'security']
  }
});
```

### Helper Flow (1 step - recommended)

**Use `remember()` to do both automatically:**

```typescript
// Does both ACID + Vector in one call
const result = await cortex.memory.remember({
  agentId: 'agent-1',
  conversationId: 'conv-456',
  userMessage: 'The password is Blue',
  agentResponse: "I'll remember that!",
  userId: 'user-123',
  userName: 'Alex'
});

// Automatically:
// 1. Stored 2 messages in ACID (user + agent)
// 2. Created 2 vector memories with conversationRef
// 3. Linked everything together
```

### Non-Conversation Memories

**For system/tool memories (no ACID conversation):**

```typescript
// No Step 1 needed - just store in Vector
const memory = await cortex.memory.store('agent-1', {
  content: 'Agent initialized successfully',
  contentType: 'raw',
  source: { type: 'system', timestamp: new Date() },
  // No conversationRef - this isn't from a conversation
  metadata: { importance: 30, tags: ['system', 'startup'] }
});
```

### conversationRef Rules

| source.type | conversationRef | Why |
|-------------|-----------------|-----|
| `conversation` | **REQUIRED** | Must link to ACID user-agent conversation |
| `a2a` | **REQUIRED (default)** | Must link to ACID agent-agent conversation |
| `system` | **OMITTED** | Not from a conversation |
| `tool` | **OMITTED** | Not from a conversation |

**Exception:** Set `trackConversation: false` in A2A to opt-out of ACID storage.

---

## Core Operations

### store()

Store a new memory for an agent.

**Signature:**
```typescript
cortex.memory.store(
  agentId: string,
  entry: MemoryInput
): Promise<MemoryEntry>
```

**Parameters:**
```typescript
interface MemoryInput {
  // Content (required)
  content: string;                    // The information to remember
  contentType: 'raw' | 'summarized';  // Type of content
  
  // Embedding (optional but preferred)
  embedding?: number[];               // Vector for semantic search
  
  // Context
  userId?: string;                    // User this relates to
  
  // Source (required)
  source: {
    type: 'conversation' | 'system' | 'tool' | 'a2a';
    userId?: string;
    userName?: string;
    timestamp: Date;
  };
  
  // ACID Link
  // REQUIRED for source.type='conversation' or 'a2a' (default behavior)
  // OMITTED for source.type='system' or 'tool'
  conversationRef?: {
    conversationId: string;           // Link to ACID conversation
    messageIds: string[];             // Specific message(s) that informed this memory
  };
  
  // Metadata (required)
  metadata: {
    importance: number;               // 0-100
    tags: string[];                   // Categorization
    [key: string]: any;               // Custom fields
  };
}
```

**Returns:**
```typescript
interface MemoryEntry {
  id: string;                         // Auto-generated ID
  agentId: string;
  userId?: string;
  content: string;
  contentType: 'raw' | 'summarized';
  embedding?: number[];
  source: MemorySource;
  conversationRef?: ConversationRef;
  metadata: MemoryMetadata;
  version: number;                    // Always 1 for new
  previousVersions: [];               // Empty for new
  createdAt: Date;
  updatedAt: Date;
  lastAccessed?: Date;
  accessCount: number;                // Always 0 for new
}
```

**Example 1: Conversation Memory (conversationRef required)**
```typescript
// FIRST: Store in ACID (you must do this first for conversations)
const msg = await cortex.conversations.addMessage('conv-456', {
  role: 'user',
  text: 'The password is Blue',
  userId: 'user-123'
});

// THEN: Store in Vector (with conversationRef linking to ACID)
const memory = await cortex.memory.store('agent-1', {
  content: 'The password is Blue',
  contentType: 'raw',
  embedding: await embed('The password is Blue'),
  userId: 'user-123',
  source: {
    type: 'conversation',  // ← Conversation type
    userId: 'user-123',
    userName: 'Alex Johnson',
    timestamp: new Date()
  },
  conversationRef: {  // ← REQUIRED for conversations
    conversationId: 'conv-456',
    messageIds: [msg.id]  // From ACID message
  },
  metadata: {
    importance: 100,
    tags: ['password', 'security']
  }
});

console.log(memory.id); // "mem_abc123xyz"
console.log(memory.conversationRef.conversationId); // "conv-456"
```

**Example 2: System Memory (no conversationRef)**
```typescript
// No ACID storage needed - this isn't from a conversation
const memory = await cortex.memory.store('agent-1', {
  content: 'Agent started successfully at 10:00 AM',
  contentType: 'raw',
  source: {
    type: 'system',  // ← System type
    timestamp: new Date()
  },
  // No conversationRef - not from a conversation
  metadata: {
    importance: 20,
    tags: ['system', 'status']
  }
});
```

**Example 3: Use remember() - recommended for conversations**
```typescript
// Helper does both steps automatically
const result = await cortex.memory.remember({
  agentId: 'agent-1',
  conversationId: 'conv-456',
  userMessage: 'The password is Blue',
  agentResponse: "I'll remember that!",
  userId: 'user-123',
  userName: 'Alex'
});

// Automatically:
// 1. Stored 2 messages in ACID
// 2. Created 2 vector memories with conversationRef
```

**Errors:**
- `CortexError('INVALID_AGENT_ID')` - Agent ID is invalid
- `CortexError('INVALID_CONTENT')` - Content is empty or too large
- `CortexError('INVALID_IMPORTANCE')` - Importance not in 0-100 range
- `CortexError('CONVEX_ERROR')` - Database error

**See Also:**
- [Agent Memory Guide](../02-core-features/01-agent-memory.md#storing-memories)
- [Store vs Update Decision](../02-core-features/01-agent-memory.md#store-vs-update-decision)

---

### remember()

**RECOMMENDED HELPER** - Handles both ACID storage and Vector indexing automatically.

**Signature:**
```typescript
cortex.memory.remember(
  params: RememberParams
): Promise<RememberResult>
```

**What it does:**
1. Stores raw messages in **ACID** (Layer 1)
2. Creates vector memories in **Vector Memory** (Layer 2)
3. Automatically links them via `conversationRef`
4. Handles embedding generation (optional)
5. Auto-detects importance and tags

**Parameters:**
```typescript
interface RememberParams {
  agentId: string;
  conversationId: string;             // ACID conversation (create first if new)
  userMessage: string;
  agentResponse: string;
  userId: string;
  userName: string;
  
  // Optional extraction
  extractContent?: (userMessage: string, agentResponse: string) => Promise<string | null>;
  
  // Optional embedding
  generateEmbedding?: (content: string) => Promise<number[] | null>;
  
  // Cloud Mode options
  autoEmbed?: boolean;                // Cloud Mode: auto-generate embeddings
  autoSummarize?: boolean;            // Cloud Mode: auto-summarize content
  
  // Metadata
  importance?: number;                // Auto-detect if not provided
  tags?: string[];                    // Auto-extract if not provided
}
```

**Returns:**
```typescript
interface RememberResult {
  conversation: {
    messageIds: string[];             // IDs stored in ACID Layer 1
    conversationId: string;           // ACID conversation ID
  };
  memories: MemoryEntry[];            // Created in Vector Layer 2 (with conversationRef)
}
```

**Example:**
```typescript
// This ONE call does everything:
const result = await cortex.memory.remember({
  agentId: 'agent-1',
  conversationId: 'conv-456',  // ACID conversation (must exist or be created)
  userMessage: 'The password is Red',
  agentResponse: "I'll remember that!",
  userId: 'user-123',
  userName: 'Alex Johnson',
  
  // Optional: Custom embedding
  generateEmbedding: async (content) => {
    return await embed(content);  // Your embedder
  },
  
  // Or use Cloud Mode
  autoEmbed: true,  // Cortex Cloud handles embeddings
  
  importance: 100,
  tags: ['password', 'security']
});

// What happened:
// 1. Stored in ACID: 2 messages (user + agent)
console.log(`ACID messages: ${result.conversation.messageIds.join(', ')}`); 
// ['msg-001', 'msg-002']

// 2. Created in Vector: 2 memories (both reference ACID)
console.log(`Vector memories: ${result.memories.length}`); // 2
console.log(result.memories[0].conversationRef.conversationId); // 'conv-456'
console.log(result.memories[0].conversationRef.messageIds); // ['msg-001']
```

**Why use `remember()`:**
- ✅ Handles ACID + Vector in one call
- ✅ Automatic conversationRef linking
- ✅ Auto-detects importance and tags
- ✅ Ensures consistency between layers
- ✅ Friendly, intuitive name
- ✅ **This is the main way to store conversation memories**

**Typical usage:**
```typescript
// Natural and simple
await cortex.memory.remember({
  agentId: 'support-agent',
  conversationId: currentConversation,
  userMessage: req.body.message,
  agentResponse: response,
  userId: req.user.id,
  userName: req.user.name
});

// That's it! Everything is stored and linked.
```

**See Also:**
- [Helper Functions](../02-core-features/01-agent-memory.md#helper-store-from-conversation-recommended)
- [Conversation Operations](./04-conversation-operations.md) - Managing ACID conversations

---

### get()

Retrieve a specific memory by ID.

**Signature:**
```typescript
cortex.memory.get(
  agentId: string,
  memoryId: string
): Promise<MemoryEntry | null>
```

**Parameters:**
- `agentId` (string) - Agent that owns the memory
- `memoryId` (string) - Unique memory ID

**Returns:**
- `MemoryEntry` - Complete memory object with version history
- `null` - If memory doesn't exist

**Side Effects:**
- Increments `accessCount`
- Updates `lastAccessed` timestamp

**Example:**
```typescript
const memory = await cortex.memory.get('agent-1', 'mem_abc123');

if (memory) {
  console.log(memory.content);
  console.log(`Version: ${memory.version}`);
  console.log(`Accessed ${memory.accessCount} times`);
  console.log(`Last accessed: ${memory.lastAccessed}`);
  
  // Access version history
  memory.previousVersions?.forEach(v => {
    console.log(`v${v.version}: ${v.content} (${v.timestamp})`);
  });
  
  // Get ACID source if available
  if (memory.conversationRef) {
    const conversation = await cortex.conversations.get(
      memory.conversationRef.conversationId
    );
  }
}
```

**Errors:**
- `CortexError('INVALID_AGENT_ID')` - Agent ID is invalid
- `CortexError('MEMORY_NOT_FOUND')` - Memory doesn't exist
- `CortexError('PERMISSION_DENIED')` - Agent doesn't own this memory

**See Also:**
- [Retrieving Memories](../02-core-features/01-agent-memory.md#retrieving-specific-memories)

---

### search()

Search agent memories with semantic or text search.

**Signature:**
```typescript
cortex.memory.search(
  agentId: string,
  query: string,
  options?: SearchOptions
): Promise<MemoryEntry[]>
```

**Parameters:**
```typescript
interface SearchOptions {
  // Semantic search
  embedding?: number[];               // Query vector (enables semantic search)
  
  // Filtering (universal filters)
  userId?: string;
  tags?: string[];
  tagMatch?: 'any' | 'all';          // Default: 'any'
  importance?: number | RangeQuery;   // Number or { $gte, $lte, $eq }
  minImportance?: number;             // Shorthand for { $gte: n }
  
  // Date filtering
  createdBefore?: Date;
  createdAfter?: Date;
  updatedBefore?: Date;
  updatedAfter?: Date;
  lastAccessedBefore?: Date;
  lastAccessedAfter?: Date;
  
  // Access filtering
  accessCount?: number | RangeQuery;
  version?: number | RangeQuery;
  
  // Source filtering
  'source.type'?: 'conversation' | 'system' | 'tool' | 'a2a';
  
  // Metadata filtering
  metadata?: Record<string, any>;
  
  // Result options
  limit?: number;                     // Default: 20
  offset?: number;                    // Default: 0
  minScore?: number;                  // Similarity threshold (0-1)
  sortBy?: 'score' | 'createdAt' | 'updatedAt' | 'accessCount' | 'importance';
  sortOrder?: 'asc' | 'desc';        // Default: 'desc'
  
  // Strategy
  strategy?: 'auto' | 'semantic' | 'keyword' | 'recent';
  boostImportance?: boolean;          // Boost by importance score
  boostRecent?: boolean;              // Boost recent memories
  boostPopular?: boolean;             // Boost frequently accessed
}

interface RangeQuery {
  $gte?: number;
  $lte?: number;
  $eq?: number;
  $ne?: number;
  $gt?: number;
  $lt?: number;
}
```

**Returns:**
```typescript
interface SearchResult extends MemoryEntry {
  score: number;                      // Similarity score (0-1)
  strategy: 'semantic' | 'keyword' | 'recent';
  highlights?: string[];              // Matched snippets
  explanation?: string;               // Cloud Mode: why matched
}
```

**Example:**
```typescript
// Semantic search with filters
const memories = await cortex.memory.search('agent-1', 'user preferences', {
  embedding: await embed('user preferences'),
  userId: 'user-123',
  tags: ['preferences'],
  minImportance: 50,
  createdAfter: new Date('2025-10-01'),
  limit: 10,
  boostImportance: true
});

memories.forEach(m => {
  console.log(`${m.content} (score: ${m.score}, importance: ${m.metadata.importance})`);
  console.log(`  Strategy: ${m.strategy}`);
  if (m.conversationRef) {
    console.log(`  Source: ACID conversation ${m.conversationRef.conversationId}`);
  }
});
```

**Errors:**
- `CortexError('INVALID_AGENT_ID')` - Agent ID is invalid
- `CortexError('INVALID_EMBEDDING_DIMENSION')` - Embedding dimension mismatch
- `CortexError('CONVEX_ERROR')` - Database error

**See Also:**
- [Semantic Search Guide](../02-core-features/02-semantic-search.md)
- [Universal Filters](../02-core-features/01-agent-memory.md#core-api-principle-universal-filters)

---

### update()

Update a single memory by ID. Automatically creates new version.

**Signature:**
```typescript
cortex.memory.update(
  agentId: string,
  memoryId: string,
  updates: MemoryUpdate
): Promise<MemoryEntry>
```

**Parameters:**
```typescript
interface MemoryUpdate {
  content?: string;
  contentType?: 'raw' | 'summarized';
  embedding?: number[];
  conversationRef?: ConversationRef;  // Update ACID link
  metadata?: Partial<MemoryMetadata>; // Merges with existing
}
```

**Returns:**
- `MemoryEntry` - Updated memory with incremented version

**Side Effects:**
- Creates new version (v2, v3, etc.)
- Preserves previous version in `previousVersions` (subject to retention)
- Updates `updatedAt` timestamp

**Example:**
```typescript
// Update password memory (creates version 2)
const updated = await cortex.memory.update('agent-1', 'mem_abc123', {
  content: 'The password is Green now',
  embedding: await embed('The password is Green now'),
  conversationRef: {
    conversationId: 'conv-456',
    messageIds: ['msg-999']  // New message that updated this
  },
  metadata: {
    importance: 100  // Can update importance
  }
});

console.log(updated.version); // 2
console.log(updated.content); // "The password is Green now"
console.log(updated.previousVersions[0].content); // "The password is Blue"
```

**Errors:**
- `CortexError('MEMORY_NOT_FOUND')` - Memory doesn't exist
- `CortexError('PERMISSION_DENIED')` - Agent doesn't own this memory
- `CortexError('INVALID_UPDATE')` - Update data is invalid

**See Also:**
- [Updating Memories](../02-core-features/01-agent-memory.md#updating-memories)
- [Memory Versioning](../02-core-features/01-agent-memory.md#memory-versioning-automatic)

---

### updateMany()

Bulk update memories matching filters.

**Signature:**
```typescript
cortex.memory.updateMany(
  agentId: string,
  filters: UniversalFilters,
  updates: MemoryUpdate
): Promise<UpdateManyResult>
```

**Parameters:**
- `agentId` (string) - Agent that owns the memories
- `filters` (UniversalFilters) - Same filters as search()
- `updates` (MemoryUpdate) - Fields to update

**Returns:**
```typescript
interface UpdateManyResult {
  updated: number;                    // Count of updated memories
  memoryIds: string[];                // IDs of updated memories
  newVersions: number[];              // New version numbers
}
```

**Example:**
```typescript
// Boost importance of frequently accessed memories
const result = await cortex.memory.updateMany('agent-1', {
  accessCount: { $gte: 10 }
}, {
  metadata: {
    importance: 75  // Bump to high
  }
});

console.log(`Updated ${result.updated} memories`);

// Add tag to all old memories
await cortex.memory.updateMany('agent-1', {
  createdBefore: new Date('2025-01-01')
}, {
  metadata: {
    tags: ['legacy']  // Appends to existing tags
  }
});
```

**Errors:**
- `CortexError('INVALID_FILTERS')` - Filters are malformed
- `CortexError('NO_MEMORIES_MATCHED')` - No memories match filters

**See Also:**
- [Bulk Operations](../02-core-features/01-agent-memory.md#update-many-memories-bulk)

---

### delete()

Delete a single memory by ID.

**Signature:**
```typescript
cortex.memory.delete(
  agentId: string,
  memoryId: string
): Promise<DeletionResult>
```

**Parameters:**
- `agentId` (string) - Agent that owns the memory
- `memoryId` (string) - Memory to delete

**Returns:**
```typescript
interface DeletionResult {
  deleted: number;                    // Always 1 if successful
  memoryId: string;
  restorable: boolean;                // False for delete()
}
```

**Side Effects:**
- Permanently deletes memory from Vector layer
- Does NOT delete ACID conversation (if conversationRef exists)
- Cannot be undone

**Example:**
```typescript
const result = await cortex.memory.delete('agent-1', 'mem_abc123');

console.log(`Deleted memory ${result.memoryId}`);
console.log(`Restorable: ${result.restorable}`); // false

// ACID conversation still accessible if memory had conversationRef
```

**Errors:**
- `CortexError('MEMORY_NOT_FOUND')` - Memory doesn't exist
- `CortexError('PERMISSION_DENIED')` - Agent doesn't own this memory

**See Also:**
- [Deleting Memories](../02-core-features/01-agent-memory.md#deleting-memories)

---

### deleteMany()

Bulk delete memories matching filters.

**Signature:**
```typescript
cortex.memory.deleteMany(
  agentId: string,
  filters: UniversalFilters,
  options?: DeleteOptions
): Promise<DeletionResult>
```

**Parameters:**
```typescript
interface DeleteOptions {
  dryRun?: boolean;                   // Preview without deleting
  requireConfirmation?: boolean;      // Prompt if > threshold
  confirmationThreshold?: number;     // Default: 10
}
```

**Returns:**
```typescript
interface DeletionResult {
  deleted: number;                    // Count deleted
  memoryIds: string[];                // IDs deleted
  restorable: boolean;                // False
  affectedUsers?: string[];           // User IDs affected
  wouldDelete?: number;               // For dryRun
  memories?: MemoryEntry[];           // For dryRun preview
}
```

**Example:**
```typescript
// Preview deletion
const preview = await cortex.memory.deleteMany('agent-1', {
  importance: { $lte: 30 },
  accessCount: { $lte: 1 },
  createdBefore: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
}, { dryRun: true });

console.log(`Would delete ${preview.wouldDelete} memories`);

// Review and confirm
if (preview.wouldDelete < 100) {
  const result = await cortex.memory.deleteMany('agent-1', {
    importance: { $lte: 30 },
    accessCount: { $lte: 1 },
    createdBefore: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  });
  
  console.log(`Deleted ${result.deleted} memories`);
  console.log(`Affected users: ${result.affectedUsers?.join(', ')}`);
}
```

**Errors:**
- `CortexError('INVALID_FILTERS')` - Filters are malformed
- `CortexError('DELETION_CANCELLED')` - User cancelled confirmation

**See Also:**
- [Bulk Deletion](../02-core-features/01-agent-memory.md#delete-by-user-gdpr-compliance)
- [Deletion Best Practices](../02-core-features/01-agent-memory.md#deletion-best-practices)

---

### count()

Count memories matching filters without retrieving them.

**Signature:**
```typescript
cortex.memory.count(
  agentId: string,
  filters?: UniversalFilters
): Promise<number>
```

**Parameters:**
- `agentId` (string) - Agent to count memories for
- `filters` (UniversalFilters, optional) - Same filters as search()

**Returns:**
- `number` - Count of matching memories

**Example:**
```typescript
// Total memories
const total = await cortex.memory.count('agent-1');

// Count critical memories
const critical = await cortex.memory.count('agent-1', {
  importance: { $gte: 90 }
});

// Count for specific user
const userCount = await cortex.memory.count('agent-1', {
  userId: 'user-123'
});

// Complex filter count
const oldUnused = await cortex.memory.count('agent-1', {
  createdBefore: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
  accessCount: { $lte: 1 },
  importance: { $lte: 30 }
});

console.log(`Found ${oldUnused} old, unused, low-importance memories`);
```

**Errors:**
- `CortexError('INVALID_FILTERS')` - Filters are malformed

**See Also:**
- [Counting Memories](../02-core-features/01-agent-memory.md#counting-memories)

---

### list()

List memories with pagination and filtering.

**Signature:**
```typescript
cortex.memory.list(
  agentId: string,
  options?: ListOptions
): Promise<ListResult>
```

**Parameters:**
```typescript
interface ListOptions extends UniversalFilters {
  limit?: number;                     // Default: 50
  offset?: number;                    // Default: 0
  sortBy?: 'createdAt' | 'updatedAt' | 'accessCount' | 'importance';
  sortOrder?: 'asc' | 'desc';        // Default: 'desc'
}
```

**Returns:**
```typescript
interface ListResult {
  memories: MemoryEntry[];
  total: number;                      // Total count (for pagination)
  limit: number;
  offset: number;
  hasMore: boolean;                   // More results available
}
```

**Example:**
```typescript
// Paginated listing
const page1 = await cortex.memory.list('agent-1', {
  limit: 50,
  offset: 0,
  sortBy: 'createdAt',
  sortOrder: 'desc'
});

console.log(`Showing ${page1.memories.length} of ${page1.total} memories`);
console.log(`Has more: ${page1.hasMore}`);

// Filtered listing
const userMemories = await cortex.memory.list('agent-1', {
  userId: 'user-123',
  importance: { $gte: 50 },
  tags: ['important'],
  limit: 100
});
```

**Errors:**
- `CortexError('INVALID_FILTERS')` - Filters are malformed
- `CortexError('INVALID_PAGINATION')` - Invalid limit/offset

**See Also:**
- [Listing Memories](../02-core-features/01-agent-memory.md#listing-memories)

---

### export()

Export memories to JSON or CSV format.

**Signature:**
```typescript
cortex.memory.export(
  agentId: string,
  options?: ExportOptions
): Promise<string | ExportData>
```

**Parameters:**
```typescript
interface ExportOptions extends UniversalFilters {
  format: 'json' | 'csv';
  outputPath?: string;                // File path (returns string if provided)
  includeVersionHistory?: boolean;    // Include previousVersions
  includeConversationContext?: boolean; // Fetch ACID conversations
}
```

**Returns:**
- `string` - File path if `outputPath` provided
- `ExportData` - Structured data if no `outputPath`

**Example:**
```typescript
// Export all memories for a user (GDPR)
const userData = await cortex.memory.export('agent-1', {
  userId: 'user-123',
  format: 'json',
  includeVersionHistory: true,
  includeConversationContext: true  // Include ACID conversations
});

// Export critical memories only
const criticalBackup = await cortex.memory.export('agent-1', {
  importance: { $gte: 90 },
  format: 'json',
  outputPath: 'backups/critical-memories.json'
});

console.log(`Exported to ${criticalBackup}`);
```

**Errors:**
- `CortexError('INVALID_FORMAT')` - Format not supported
- `CortexError('EXPORT_FAILED')` - File write error

**See Also:**
- [Exporting Memories](../02-core-features/01-agent-memory.md#exporting-memories)

---

### archive()

Soft delete (move to archive storage, recoverable).

**Signature:**
```typescript
cortex.memory.archive(
  agentId: string,
  filters: UniversalFilters
): Promise<ArchiveResult>
```

**Parameters:**
- `agentId` (string) - Agent that owns the memories
- `filters` (UniversalFilters) - Same filters as search()

**Returns:**
```typescript
interface ArchiveResult {
  archived: number;
  memoryIds: string[];
  restorable: boolean;                // True
  archiveId: string;                  // Archive batch ID
}
```

**Example:**
```typescript
// Archive old low-importance memories
const result = await cortex.memory.archive('agent-1', {
  importance: { $lte: 20 },
  createdBefore: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
});

console.log(`Archived ${result.archived} memories`);
console.log(`Archive ID: ${result.archiveId}`);

// Restore from archive if needed
const restored = await cortex.memory.restoreFromArchive('agent-1', result.archiveId);
```

**Errors:**
- `CortexError('INVALID_FILTERS')` - Filters are malformed
- `CortexError('ARCHIVE_FAILED')` - Archive operation failed

**See Also:**
- [Soft Delete](../02-core-features/01-agent-memory.md#soft-delete-archive)

---

## Version Operations

### getVersion()

Retrieve a specific version of a memory.

**Signature:**
```typescript
cortex.memory.getVersion(
  agentId: string,
  memoryId: string,
  version: number
): Promise<MemoryVersion | null>
```

**Parameters:**
- `agentId` (string) - Agent that owns the memory
- `memoryId` (string) - Memory ID
- `version` (number) - Version number to retrieve

**Returns:**
- `MemoryVersion` - Specific version
- `null` - If version doesn't exist or was cleaned up by retention

**Example:**
```typescript
// Get version 1
const v1 = await cortex.memory.getVersion('agent-1', 'mem_abc123', 1);

if (v1) {
  console.log(`v1 content: ${v1.content}`);
  console.log(`v1 timestamp: ${v1.timestamp}`);
  if (v1.conversationRef) {
    console.log(`v1 ACID source: ${v1.conversationRef.conversationId}`);
  }
} else {
  console.log('Version 1 cleaned up by retention (but ACID source still available)');
}
```

**Errors:**
- `CortexError('MEMORY_NOT_FOUND')` - Memory doesn't exist
- `CortexError('VERSION_NOT_FOUND')` - Version doesn't exist

**See Also:**
- [Accessing Historical Versions](../02-core-features/01-agent-memory.md#accessing-historical-versions)

---

### getHistory()

Get all versions of a memory.

**Signature:**
```typescript
cortex.memory.getHistory(
  agentId: string,
  memoryId: string
): Promise<MemoryVersion[]>
```

**Parameters:**
- `agentId` (string) - Agent that owns the memory
- `memoryId` (string) - Memory ID

**Returns:**
- `MemoryVersion[]` - Array of all versions (subject to retention)

**Example:**
```typescript
const history = await cortex.memory.getHistory('agent-1', 'mem_abc123');

console.log(`Memory has ${history.length} versions:`);
history.forEach(v => {
  console.log(`v${v.version} (${v.timestamp}): ${v.content}`);
  if (v.conversationRef) {
    console.log(`  ACID: ${v.conversationRef.conversationId}`);
  }
});

// Note: With default retention=10, only last 10 versions returned
// But ACID conversations still have all source messages!
```

**Errors:**
- `CortexError('MEMORY_NOT_FOUND')` - Memory doesn't exist

**See Also:**
- [Version History](../02-core-features/01-agent-memory.md#memory-versioning-automatic)

---

### getAtTimestamp()

Get memory state at a specific point in time (temporal query).

**Signature:**
```typescript
cortex.memory.getAtTimestamp(
  agentId: string,
  memoryId: string,
  timestamp: Date
): Promise<MemoryVersion | null>
```

**Parameters:**
- `agentId` (string) - Agent that owns the memory
- `memoryId` (string) - Memory ID
- `timestamp` (Date) - Point in time to query

**Returns:**
- `MemoryVersion` - Version that was current at that time
- `null` - If memory didn't exist at that time or version cleaned up

**Example:**
```typescript
// What was the password on August 1st?
const historicalMemory = await cortex.memory.getAtTimestamp(
  'agent-1',
  'mem_password',
  new Date('2025-08-01T00:00:00Z')
);

if (historicalMemory) {
  console.log(`Password on Aug 1: ${historicalMemory.content}`);
  
  // Can still get ACID source even if version cleaned up
  if (historicalMemory.conversationRef) {
    const conversation = await cortex.conversations.get(
      historicalMemory.conversationRef.conversationId
    );
    const sourceMsg = conversation.messages.find(m => 
      historicalMemory.conversationRef.messageIds.includes(m.id)
    );
    console.log(`Original message: ${sourceMsg.text}`);
  }
} else {
  console.log('Version not available (cleaned up), check ACID conversations');
}
```

**Errors:**
- `CortexError('MEMORY_NOT_FOUND')` - Memory doesn't exist
- `CortexError('INVALID_TIMESTAMP')` - Timestamp is invalid

**See Also:**
- [Temporal Queries](../02-core-features/01-agent-memory.md#temporal-queries)
- [Conflict Resolution](../02-core-features/01-agent-memory.md#conflict-resolution-example)

---

## Advanced Operations

### smartStore()

Intelligent store with automatic update detection (Cloud Mode helper).

**Signature:**
```typescript
cortex.memory.smartStore(
  agentId: string,
  entry: SmartStoreInput
): Promise<SmartStoreResult>
```

**Parameters:**
```typescript
interface SmartStoreInput extends MemoryInput {
  updateStrategy: 'semantic' | 'topic' | 'key';
  similarityThreshold?: number;       // Default: 0.85
  memoryKey?: string;                 // For 'key' strategy
  autoEmbed?: boolean;                // Cloud Mode: auto-generate embedding
  autoSummarize?: boolean;            // Cloud Mode: auto-summarize content
}
```

**Returns:**
```typescript
interface SmartStoreResult {
  action: 'created' | 'updated';
  id: string;
  version: number;
  oldContent?: string;                // If updated
}
```

**Example:**
```typescript
const result = await cortex.memory.smartStore('agent-1', {
  content: 'Actually I prefer to be called Alex',
  contentType: 'raw',
  userId: 'user-123',
  source: { type: 'conversation', userId: 'user-123', timestamp: new Date() },
  conversationRef: { conversationId: 'conv-456', messageIds: ['msg-999'] },
  metadata: {
    importance: 70,
    tags: ['name', 'preferences']
  },
  updateStrategy: 'semantic',
  similarityThreshold: 0.85,
  autoEmbed: true  // Cloud Mode
});

if (result.action === 'updated') {
  console.log(`Updated existing memory (was: "${result.oldContent}")`);
} else {
  console.log(`Created new memory ${result.id}`);
}
```

**Errors:**
- `CortexError('STRATEGY_FAILED')` - Update detection failed
- `CortexError('CLOUD_MODE_REQUIRED')` - autoEmbed/autoSummarize requires Cloud Mode

**See Also:**
- [Smart Store Helper](../02-core-features/01-agent-memory.md#strategy-4-cortex-smart-store-helper)
- [Store vs Update](../02-core-features/01-agent-memory.md#store-vs-update-decision)

---

## Universal Filters Reference

All filter options that work across operations:

```typescript
interface UniversalFilters {
  // Identity
  userId?: string;
  
  // Tags
  tags?: string[];
  tagMatch?: 'any' | 'all';
  
  // Importance (0-100)
  importance?: number | RangeQuery;
  minImportance?: number;             // Shorthand for { $gte }
  
  // Dates
  createdBefore?: Date;
  createdAfter?: Date;
  updatedBefore?: Date;
  updatedAfter?: Date;
  lastAccessedBefore?: Date;
  lastAccessedAfter?: Date;
  
  // Access patterns
  accessCount?: number | RangeQuery;
  version?: number | RangeQuery;
  
  // Source
  'source.type'?: 'conversation' | 'system' | 'tool' | 'a2a';
  
  // Content
  contentType?: 'raw' | 'summarized';
  
  // ACID link
  'conversationRef.conversationId'?: string;
  
  // Metadata
  metadata?: Record<string, any>;
  
  // Results
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
```

**Operations supporting universal filters:**
- `search()`
- `count()`
- `list()`
- `updateMany()`
- `deleteMany()`
- `archive()`
- `export()`

**See Also:**
- [Universal Filters](../02-core-features/01-agent-memory.md#core-api-principle-universal-filters)

---

## Configuration

### Version Retention

Configure per-agent or globally:

```typescript
// Global configuration
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL,
  defaultVersionRetention: 10  // Keep last 10 versions (default)
});

// Per-agent configuration
await cortex.agents.configure('audit-agent', {
  memoryVersionRetention: -1  // Unlimited (keep all versions)
});

await cortex.agents.configure('temp-agent', {
  memoryVersionRetention: 1  // Only current (no history)
});
```

**See Also:**
- [Version Retention](../02-core-features/01-agent-memory.md#version-retention-configuration)

---

## Error Reference

All memory operation errors:

| Error Code | Description | Cause |
|------------|-------------|-------|
| `INVALID_AGENT_ID` | Agent ID is invalid | Empty or malformed agentId |
| `INVALID_CONTENT` | Content is invalid | Empty content or > 100KB |
| `INVALID_IMPORTANCE` | Importance out of range | Not in 0-100 |
| `INVALID_EMBEDDING_DIMENSION` | Embedding dimension mismatch | Wrong vector size |
| `MEMORY_NOT_FOUND` | Memory doesn't exist | Invalid memoryId |
| `VERSION_NOT_FOUND` | Version doesn't exist | Cleaned up by retention |
| `PERMISSION_DENIED` | Access denied | Agent doesn't own memory |
| `INVALID_FILTERS` | Filters malformed | Bad filter syntax |
| `CONVEX_ERROR` | Database error | Convex operation failed |
| `CLOUD_MODE_REQUIRED` | Feature requires Cloud | autoEmbed/autoSummarize in Direct mode |

**See Also:**
- [Error Handling Guide](./09-error-handling.md)

---

## Next Steps

- **[Agent Management API](./03-agent-management.md)** - Agent registry operations
- **[User Operations API](./04-user-operations.md)** - User profile API
- **[Context Operations API](./05-context-operations.md)** - Context chain API
- **[Types & Interfaces](./08-types-interfaces.md)** - Complete TypeScript definitions

---

**Questions?** Ask in [GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions) or [Discord](https://discord.gg/cortex).

