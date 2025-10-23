# Core Concepts

> **Last Updated**: 2025-10-23

Understanding these core concepts will help you make the most of Cortex. This guide covers the fundamental building blocks of the system.

> **Note on Feature Availability**: Cortex offers two deployment modes (Direct and Cloud). This guide covers all core concepts regardless of mode. As we develop the platform, certain advanced features may be available only in cloud mode. We'll clearly mark these distinctions as they're finalized.

## Table of Contents

- [Memory](#memory)
- [Agents](#agents)
- [Embeddings](#embeddings)
- [Search Strategies](#search-strategies)
- [User Profiles](#user-profiles)
- [Context Chains](#context-chains)
- [Analytics](#analytics)
- [Data Flow](#data-flow)

---

## Memory

### What is Memory?

In Cortex, a **memory** is a piece of information that an agent stores for later retrieval. It consists of:

```typescript
interface MemoryEntry {
  id: string;                    // Unique identifier
  agentId: string;               // Which agent owns this
  content: string;               // The actual information
  embedding?: number[];          // Vector for semantic search
  metadata: {
    importance: 'low' | 'medium' | 'high';
    tags: string[];              // Categorization
    [key: string]: any;          // Custom metadata
  };
  createdAt: Date;              // When stored
  lastAccessed?: Date;          // Last retrieval
  accessCount: number;          // Usage tracking
}
```

### Types of Memories

**1. Conversation Memories**
Information from user interactions:
```typescript
await cortex.memory.store('agent-1', {
  content: 'User mentioned they work in San Francisco',
  embedding: await embed('User mentioned they work in San Francisco'),
  metadata: {
    importance: 'medium',
    tags: ['location', 'personal', 'user-info']
  }
});
```

**2. Knowledge Memories**
Facts and information the agent learns:
```typescript
await cortex.memory.store('agent-1', {
  content: 'Product X costs $49.99 with a 20% discount for annual billing',
  embedding: await embed('Product X pricing'),
  metadata: {
    importance: 'high',
    tags: ['pricing', 'product-x', 'business']
  }
});
```

**3. Task Memories**
What the agent has done:
```typescript
await cortex.memory.store('agent-1', {
  content: 'Sent password reset email to user@example.com at 2025-10-23 10:30',
  embedding: await embed('password reset action'),
  metadata: {
    importance: 'high',
    tags: ['action', 'security', 'completed']
  }
});
```

**4. Agent-to-Agent (A2A) Memories**
Communications between agents:
```typescript
await cortex.memory.store('finance-agent', {
  content: 'Received approval from CEO agent for $50k budget increase',
  embedding: await embed('budget approval'),
  metadata: {
    importance: 'high',
    tags: ['a2a', 'approval', 'budget'],
    fromAgent: 'ceo-agent'
  }
});
```

### Memory Lifecycle

```
┌──────────┐       ┌──────────┐       ┌──────────┐       ┌──────────┐
│ Created  │──────>│ Indexed  │──────>│ Accessed │──────>│ Archived │
└──────────┘       └──────────┘       └──────────┘       └──────────┘
     │                                       │                   │
     │                                       ▼                   ▼
     │                                 ┌──────────┐       ┌──────────┐
     └────────────────────────────────>│ Updated  │       │ Deleted  │
                                       └──────────┘       └──────────┘
```

### Memory Importance

Cortex supports three importance levels:

**Low** - Casual information
- Observations
- Preferences about minor things
- General conversation

**Medium** (default) - Useful information
- User preferences
- Specific facts
- Most day-to-day information

**High** - Critical information
- Passwords, credentials
- Deadlines and commitments
- Important decisions
- Security-relevant data

```typescript
// Cortex can help determine importance
const importance = determineImportance(content);

// Or you specify it explicitly
await cortex.memory.store(agentId, {
  content: 'Security code is 1234',
  metadata: { importance: 'high' }
});
```

---

## Agents

### What is an Agent?

An **agent** in Cortex is any entity that stores and retrieves memories. It could be:

- A chatbot
- A specialized AI assistant (HR, Finance, Code Assistant)
- A background task processor
- A human operator (in human-in-the-loop systems)

### Hybrid Agent Management

Cortex uses a **hybrid approach** - start simple, add structure when needed.

#### Level 1: Simple String IDs

Perfect for getting started:

```typescript
// Just use string identifiers
await cortex.memory.store('customer-support-bot', { ... });
await cortex.memory.search('customer-support-bot', 'user preferences');
```

**Pros:**
- Zero ceremony
- Works immediately
- Maximum flexibility

**Cons:**
- No built-in analytics
- No agent discovery
- Manual coordination

#### Level 2: Agent Registry

Add when you need analytics and coordination:

```typescript
// Register an agent with metadata
await cortex.agents.register({
  id: 'customer-support-bot',
  name: 'Customer Support Bot',
  description: 'Handles customer inquiries and issues',
  metadata: {
    team: 'support',
    capabilities: ['empathy', 'problem-solving', 'escalation'],
    version: '2.1.0',
    owner: 'support-team@company.com'
  }
});

// Now you get enhanced analytics
const stats = await cortex.analytics.getAgentStats('customer-support-bot');
// { memoriesStored: 1543, avgAccessTime: '23ms', ... }

// And agent discovery
const supportAgents = await cortex.agents.search({ 
  team: 'support' 
});
```

**Pros:**
- Rich analytics
- Agent discovery
- Better observability

**When to use:**
- Multiple agents
- Need analytics
- Team collaboration

### Agent Isolation

Each agent's memories are **completely isolated**:

```typescript
// Agent 1 stores a memory
await cortex.memory.store('agent-1', {
  content: 'Secret information for agent-1'
});

// Agent 2 cannot see it
const memories = await cortex.memory.search('agent-2', 'secret');
// Returns: [] (empty - different agent)

// Only agent-1 can access
const memories = await cortex.memory.search('agent-1', 'secret');
// Returns: [{ content: 'Secret information for agent-1', ... }]
```

This ensures:
- Data privacy
- No accidental leakage
- Clear boundaries
- Easy debugging

---

## Embeddings

### What are Embeddings?

**Embeddings** are numerical vectors that represent the semantic meaning of text. They enable semantic search - finding related content by meaning, not just keywords.

```
"The cat sat on the mat"
↓
[0.234, -0.891, 0.445, ..., 0.123]  // 768, 1536, or 3072 dimensions
```

### Embedding-Agnostic Design

Cortex **does not generate embeddings** - you bring your own:

```typescript
// Choose your provider
const embedding = await yourEmbeddingProvider.embed(text);

// Cortex just stores and searches
await cortex.memory.store(agentId, {
  content: text,
  embedding: embedding  // Your vectors
});
```

**Why this design?**
- ✅ Use any embedding model
- ✅ Optimize for your use case
- ✅ Upgrade models independently
- ✅ No vendor lock-in
- ✅ Fine-tune for your domain

### Popular Embedding Providers

**OpenAI**
```typescript
import OpenAI from 'openai';
const openai = new OpenAI();

const result = await openai.embeddings.create({
  model: 'text-embedding-3-large',  // 3072 dimensions
  input: text
});

const embedding = result.data[0].embedding;
```

**Cohere**
```typescript
import { CohereClient } from 'cohere-ai';
const cohere = new CohereClient();

const result = await cohere.embed({
  texts: [text],
  model: 'embed-english-v3.0',  // 1024 dimensions
  inputType: 'search_document'
});

const embedding = result.embeddings[0];
```

**Local Models (Transformers.js)**
```typescript
import { pipeline } from '@xenova/transformers';

const extractor = await pipeline(
  'feature-extraction',
  'Xenova/all-MiniLM-L6-v2'  // 384 dimensions
);

const output = await extractor(text, {
  pooling: 'mean',
  normalize: true
});

const embedding = Array.from(output.data);
```

### Flexible Dimensions

Cortex supports **any** vector dimension:

```typescript
// Small and fast (768 dimensions)
await cortex.memory.store(agentId, {
  content: text,
  embedding: smallEmbedding,  // [768 numbers]
  metadata: { dimension: 768 }
});

// Balanced (1536 dimensions) - OpenAI default
await cortex.memory.store(agentId, {
  content: text,
  embedding: standardEmbedding,  // [1536 numbers]
  metadata: { dimension: 1536 }
});

// High accuracy (3072 dimensions)
await cortex.memory.store(agentId, {
  content: text,
  embedding: largeEmbedding,  // [3072 numbers]
  metadata: { dimension: 3072 }
});
```

**Tradeoffs:**

| Dimensions | Speed | Accuracy | Cost | Use Case |
|------------|-------|----------|------|----------|
| 384-768    | Fast  | Good     | Low  | High-volume, real-time |
| 1536       | Medium| Better   | Medium | General purpose |
| 3072       | Slower| Best     | High | When accuracy is critical |

**Default Recommendation**: 3072 dimensions (OpenAI text-embedding-3-large) for the best accuracy. Scale down if you need faster search.

---

## Search Strategies

Cortex uses **multi-strategy search** for robust memory retrieval.

### Strategy 1: Semantic Search (Vector)

Primary method - finds similar meanings:

```typescript
const memories = await cortex.memory.search('agent-1', 
  'what is the user\'s favorite color?',
  {
    embedding: await embed('what is the user\'s favorite color?'),
    limit: 10
  }
);
```

This finds: "User loves blue" even though query says "favorite" and "color" separately.

### Strategy 2: Keyword Search

Fallback when vector search finds nothing:

```typescript
// Extracts keywords: ['user', 'favorite', 'color']
// Searches for any memory containing these words
```

Useful for:
- Exact term matching
- Names and IDs
- Technical terms

### Strategy 3: Recent Memories

Final fallback - returns recent memories:

```typescript
// When all else fails, return the 20 most recent memories
// User might find what they need through recency
```

### Combined Strategy

Cortex automatically tries all strategies:

```
User Query
    │
    ├─> Try Semantic Search (embedding)
    │   ├─> Results found? ✓ Return them
    │   └─> No results? Continue...
    │
    ├─> Try Keyword Search
    │   ├─> Results found? ✓ Return them
    │   └─> No results? Continue...
    │
    └─> Return Recent Memories
        └─> Always returns something
```

### Custom Search Options

Fine-tune search behavior:

```typescript
await cortex.memory.search('agent-1', query, {
  embedding: await embed(query),
  limit: 20,                           // Max results
  minScore: 0.7,                       // Similarity threshold
  tags: ['preferences'],               // Filter by tags
  importance: 'medium',                // Minimum importance
  dateRange: {                         // Time filter
    start: new Date('2025-01-01'),
    end: new Date('2025-01-31')
  }
});
```

---

## User Profiles

### What are User Profiles?

**User profiles** store information about users across all agents and conversations.

```typescript
interface UserProfile {
  id: string;                    // Unique user ID
  displayName: string;           // How to address them
  email?: string;                // Contact info
  preferences: {
    theme?: 'light' | 'dark';
    language?: string;
    timezone?: string;
    [key: string]: any;          // Custom preferences
  };
  metadata: {
    tier?: 'free' | 'pro' | 'enterprise';
    signupDate?: Date;
    lastSeen?: Date;
    [key: string]: any;          // Custom metadata
  };
}
```

### Creating and Updating

```typescript
// Create a user profile
await cortex.users.update('user-123', {
  displayName: 'Alice Johnson',
  email: 'alice@example.com',
  preferences: {
    theme: 'dark',
    language: 'en',
    timezone: 'America/Los_Angeles'
  },
  metadata: {
    tier: 'pro',
    signupDate: new Date(),
    company: 'Acme Corp'
  }
});

// Update specific fields
await cortex.users.update('user-123', {
  preferences: {
    theme: 'light'  // Only updates theme
  },
  metadata: {
    lastSeen: new Date()
  }
});
```

### Retrieving Profiles

```typescript
// Get a user's profile
const user = await cortex.users.get('user-123');

// Use in agent interactions
const greeting = `Hello ${user.displayName}! I see you prefer ${user.preferences.theme} mode.`;
```

### Cross-Agent User Context

User profiles are shared across all agents:

```typescript
// Agent 1 stores user preference
await cortex.users.update('user-123', {
  preferences: { communicationStyle: 'formal' }
});

// Agent 2 can access it
const user = await cortex.users.get('user-123');
if (user.preferences.communicationStyle === 'formal') {
  response = formatFormal(response);
}
```

---

## Context Chains

### What are Context Chains?

**Context chains** enable hierarchical context sharing in multi-agent systems.

Think of it like a management hierarchy where:
- Managers see their team's work
- Teams share knowledge within their context
- Everyone can access relevant historical context

### Creating a Context

```typescript
const context = await cortex.contexts.create({
  purpose: 'Handle customer refund request',
  agentId: 'supervisor-agent',
  userId: 'user-123',
  metadata: {
    ticketId: 'TICKET-456',
    priority: 'high'
  }
});

// Returns: { id: 'ctx_abc123', ... }
```

### Creating Child Contexts

```typescript
// Supervisor delegates to finance agent
const financeContext = await cortex.contexts.create({
  purpose: 'Process $500 refund',
  agentId: 'finance-agent',
  parentId: context.id,  // Link to parent
  metadata: {
    amount: 500,
    reason: 'defective product'
  }
});
```

### Accessing Full Context

Any agent in the chain can see the complete hierarchy:

```typescript
// Finance agent looks up the full context
const fullContext = await cortex.contexts.get(financeContext.id, {
  includeChain: true
});

console.log(fullContext);
// {
//   current: { purpose: 'Process $500 refund', ... },
//   parent: { purpose: 'Handle customer refund request', ... },
//   root: { purpose: 'Handle customer refund request', ... },
//   children: [],
//   depth: 2
// }
```

### Context Chain Visualization

```
Root Context (Supervisor)
  "Handle customer refund request"
        │
        ├─> Child Context (Finance)
        │   "Process $500 refund"
        │
        └─> Child Context (Customer Relations)
            "Send apology email"
```

### Use Cases

**1. Hierarchical Agents**
Manager agents delegate to worker agents with shared context.

**2. Task Decomposition**
Break complex tasks into subtasks while maintaining context.

**3. Audit Trails**
Track the full history of how a task was handled.

**4. Knowledge Sharing**
Teams share context without exposing unrelated information.

---

## Analytics

> **Cloud Mode Feature**: Advanced analytics are planned for Cortex Cloud. Basic usage tracking will be available in both modes.

### What are Analytics?

**Analytics** help you understand how agents use memory:

```typescript
const stats = await cortex.analytics.getAgentStats('customer-bot');

console.log(stats);
// {
//   totalMemories: 15432,
//   memoriesThisWeek: 234,
//   avgSearchTime: '23ms',
//   topTags: ['preferences', 'support', 'product-info'],
//   accessPatterns: {
//     mostAccessed: [{ id: 'mem_123', count: 45 }, ...],
//     leastAccessed: [{ id: 'mem_789', count: 1 }, ...],
//   },
//   importanceBreakdown: {
//     high: 234,
//     medium: 12043,
//     low: 3155
//   }
// }
```

### Access Tracking

Every memory tracks its usage:

```typescript
const memory = await cortex.memory.get('agent-1', 'mem_123');

console.log({
  accessCount: memory.accessCount,      // How many times accessed
  lastAccessed: memory.lastAccessed,    // When last accessed
  createdAt: memory.createdAt          // When created
});
```

### Usage Insights

```typescript
// Find unused memories (potential cleanup)
const unused = await cortex.analytics.findUnusedMemories('agent-1', {
  olderThan: '30d',
  maxAccessCount: 1
});

// Find hot memories (frequently accessed)
const hot = await cortex.analytics.findHotMemories('agent-1', {
  minAccessCount: 10,
  timeWindow: '7d'
});
```

---

## Data Flow

### Complete Memory Lifecycle

```
┌────────────────────────────────────────────────────────────┐
│                    User Interaction                         │
└────────────────────┬───────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────┐
│                 Your Application                            │
│  • Generate embedding (your provider)                       │
│  • Call cortex.memory.store()                              │
└────────────────────┬───────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────┐
│                   Cortex Layer                              │
│  • Validate input                                           │
│  • Add metadata (timestamps, IDs)                          │
│  • Store in Convex                                          │
└────────────────────┬───────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────┐
│                  Convex Backend                             │
│  • ACID transaction                                         │
│  • Index embedding for vector search                        │
│  • Store in durable storage                                 │
│  • Trigger real-time updates                                │
└─────────────────────────────────────────────────────────────┘

                     │
                     ▼
┌────────────────────────────────────────────────────────────┐
│              Memory Available for Search                    │
└─────────────────────────────────────────────────────────────┘
```

### Search Flow

```
User Query → Generate Embedding → Cortex Search →
  │
  ├─> Vector Search (Convex)
  │   └─> Returns matches by similarity
  │
  ├─> Keyword Search (Convex)
  │   └─> Returns matches by text
  │
  └─> Recent Memories (Convex)
      └─> Returns by timestamp

→ Combine & Rank → Return to Application → Present to User
```

---

## Common Patterns

### Pattern 1: Store on User Message

```typescript
// User sends message
const userMessage = req.body.message;

// Generate embedding
const embedding = await embed(userMessage);

// Store for this agent
await cortex.memory.store(agentId, {
  content: userMessage,
  embedding,
  metadata: {
    importance: 'medium',
    tags: ['user-input'],
    userId: req.user.id
  }
});
```

### Pattern 2: Search Before Response

```typescript
// Before generating response, search relevant memories
const memories = await cortex.memory.search(
  agentId,
  userMessage,
  { embedding: await embed(userMessage), limit: 5 }
);

// Include memories in prompt
const context = memories.map(m => m.content).join('\n');
const prompt = `
Context from memory:
${context}

User: ${userMessage}
Agent:
`;

const response = await llm.complete(prompt);
```

### Pattern 3: Store Agent Response

```typescript
// After generating response, store it too
await cortex.memory.store(agentId, {
  content: `I told the user: ${agentResponse}`,
  embedding: await embed(agentResponse),
  metadata: {
    importance: 'medium',
    tags: ['agent-response'],
    userId: req.user.id
  }
});
```

---

## Next Steps

Now that you understand the core concepts:

1. **[See Examples](../06-recipes/01-simple-chatbot.md)** - Real-world implementations
2. **[API Reference](../03-api-reference/02-memory-operations.md)** - Complete API documentation
3. **[Architecture](../04-architecture/01-system-overview.md)** - Deep dive into how it works
4. **[Advanced Topics](../07-advanced-topics/01-embedding-providers.md)** - Optimization and scaling

---

**Questions?** Check the [FAQ](../11-reference/01-faq.md) or ask in [Discord](https://discord.gg/cortex).

