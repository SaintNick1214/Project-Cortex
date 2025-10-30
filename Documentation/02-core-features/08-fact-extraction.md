# Fact Extraction

> **Last Updated**: 2025-10-28

Automatic extraction of salient facts from conversations using LLM intelligence for efficient, focused memory storage.

## Overview

Instead of storing entire conversations verbatim, **fact extraction** distills dialogue into discrete, actionable knowledge units. This approach dramatically reduces storage, improves retrieval relevance, and saves token costs when providing context to LLMs.

Research has shown that fact-based memory can achieve 60-90% storage reduction and 70-90% latency improvements compared to storing raw conversations.

**Example:**

```
Raw Conversation (402 tokens):
User: "Hey, I wanted to let you know I just moved from Paris to London last week.
       I'm still settling in but I found a great flat in Shoreditch. The commute to
       my office in Canary Wharf is about 30 minutes on the tube. Oh, and I'm working
       at Acme Corp now as a senior engineer. Really excited about the new role!"
Agent: "That's wonderful! Congratulations on both the move and the new position.
        London is a great city. How are you finding the adjustment so far?"

Extracted Facts (45 tokens):
1. User moved from Paris to London (last week)
2. User lives in Shoreditch neighborhood
3. User works at Acme Corp
4. User's role: Senior Engineer
5. User's office location: Canary Wharf
6. User's commute: 30 minutes via tube

Storage: 89% reduction ✅
Retrieval: More precise ✅
```

## Facts vs Raw Conversations

### Raw Conversation Storage (Default)

**Pros:**

- Complete context preserved
- No information loss
- Audit trail maintained
- No LLM processing needed
- Simple and straightforward

**Cons:**

- Large storage footprint
- Higher token costs (when feeding to LLM)
- Slower retrieval (search through verbose text)
- Context window fills up quickly

**When to use:**

- Legal/compliance requirements (need verbatim records)
- Debugging and troubleshooting
- Training data collection
- When storage cost isn't a concern

### Fact-Based Storage (Enhanced)

**Pros:**

- 60-90% storage reduction (proven in production)
- Faster retrieval (concise facts)
- Lower token costs (compact context)
- More relevant results (noise filtered out)
- Better for long-term knowledge

**Cons:**

- Requires LLM processing (latency + cost)
- Potential information loss (if extraction imperfect)
- More complex implementation
- Depends on LLM accuracy

**When to use:**

- Long-running conversations (hundreds of messages)
- Knowledge accumulation over time
- Performance-critical applications
- Token-cost-sensitive scenarios

### Hybrid Approach (Recommended)

Store **both** raw conversations (in ACID layer) **and** extracted facts (in vector layer):

```typescript
await cortex.memory.remember({
  memorySpaceId: "user-123-personal",
  conversationId: "conv-123",
  userMessage: "I moved to London and work at Acme Corp",
  agentResponse: "Congratulations!",
  userId: "user-123",
  userName: "Alex",

  extractFacts: true, // Extract facts
  storeRaw: true, // Also store raw (default)
});

// Result:
// - Raw conversation in ACID layer (compliance ✅)
// - Extracted facts in vector layer (efficiency ✅)
// - Best of both worlds!
```

## Manual Fact Extraction (Direct Mode)

### Step 1: Extract Facts with LLM

```typescript
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function extractFacts(conversation: string): Promise<ExtractedFact[]> {
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content:
          "You are a fact extraction assistant. Extract key facts from conversations that should be remembered long-term.",
      },
      {
        role: "user",
        content: `
Extract facts from this conversation:

${conversation}

Return ONLY a JSON array of facts. Each fact should have:
- fact: The fact statement (clear, third-person, present tense)
- category: Type (preference, attribute, event, decision, relationship)
- confidence: Your confidence this is meaningful (0-1)

Example:
[
  {
    "fact": "User prefers TypeScript for backend development",
    "category": "preference", 
    "confidence": 0.95
  }
]
`,
      },
    ],
    temperature: 0.2, // Low temperature for consistency
    response_format: { type: "json_object" },
  });

  const result = JSON.parse(response.choices[0].message.content);

  return result.facts || result; // Handle different response formats
}

// Usage
const facts = await extractFacts(`
User: "I prefer TypeScript over JavaScript for backend work"
Agent: "I'll remember that!"
`);

console.log(facts);
// [{ fact: "User prefers TypeScript for backend development", category: "preference", confidence: 0.95 }]
```

### Step 2: Store Facts in Immutable Layer

```typescript
async function storeFact(
  fact: ExtractedFact,
  conversationRef: { conversationId: string; messageIds: string[] },
  userId?: string,
) {
  // Store in immutable (type='fact')
  const factRecord = await cortex.immutable.store({
    type: "fact",
    id: generateFactId(), // or use UUID
    data: {
      fact: fact.fact,
      category: fact.category,
      confidence: fact.confidence,
      extractedAt: new Date().toISOString(),
      extractedBy: "gpt-4",
    },
    userId,
    conversationRef,
    metadata: {
      publishedBy: "fact-extraction-pipeline",
      tags: [fact.category, "extracted-fact"],
      importance: calculateImportance(fact),
    },
  });

  return factRecord;
}

function calculateImportance(fact: ExtractedFact): number {
  // Simple heuristic
  const categoryWeights = {
    preference: 70,
    attribute: 60,
    event: 75,
    decision: 85,
    relationship: 65,
  };

  const baseImportance = categoryWeights[fact.category] || 50;
  const confidenceBoost = fact.confidence * 20;

  return Math.min(100, baseImportance + confidenceBoost);
}
```

### Step 3: Index in Vector Layer

```typescript
async function indexFactInVector(fact: ImmutableRecord, memorySpaceId: string) {
  // Generate embedding
  const embedding = await embed(fact.data.fact);

  // Store in vector layer
  await cortex.vector.store(memorySpaceId, {
    content: fact.data.fact,
    contentType: "fact", // Mark as fact
    embedding,
    userId: fact.userId,
    source: {
      type: "fact-extraction",
      extractedFrom: "conversation",
      timestamp: new Date(),
    },
    immutableRef: {
      type: "fact",
      id: fact.id,
      version: fact.version,
    },
    conversationRef: fact.conversationRef,
    metadata: {
      importance: fact.metadata.importance,
      tags: fact.metadata.tags,
      category: fact.data.category,
      confidence: fact.data.confidence,
    },
  });
}
```

### Step 4: Complete Workflow

```typescript
async function rememberWithFactExtraction(params: {
  memorySpaceId: string;
  conversationId: string;
  userMessage: string;
  agentResponse: string;
  userId: string;
  userName: string;
}) {
  // 1. Store raw conversation in ACID
  const userMsg = await cortex.conversations.addMessage(params.conversationId, {
    role: "user",
    content: params.userMessage,
    userId: params.userId,
  });

  const agentMsg = await cortex.conversations.addMessage(
    params.conversationId,
    {
      role: "agent",
      content: params.agentResponse,
      memorySpaceId: params.memorySpaceId,
    },
  );

  // 2. Extract facts
  const conversationText = `User: ${params.userMessage}\nAgent: ${params.agentResponse}`;
  const extractedFacts = await extractFacts(conversationText);

  // 3. Store each fact
  const storedFacts = [];

  for (const fact of extractedFacts) {
    // Check for duplicates first
    const similar = await findSimilarFacts(
      fact,
      params.memorySpaceId,
      params.userId,
    );

    if (similar.length === 0 || similar[0].score < 0.85) {
      // New fact, store it
      const factRecord = await storeFact(
        fact,
        {
          conversationId: params.conversationId,
          messageIds: [userMsg.id, agentMsg.id],
        },
        params.userId,
      );

      // Index in vector
      await indexFactInVector(factRecord, params.memorySpaceId);

      storedFacts.push(factRecord);
    } else {
      console.log(`Skipping duplicate fact: ${fact.fact}`);
    }
  }

  return {
    conversation: { messageIds: [userMsg.id, agentMsg.id] },
    facts: storedFacts,
  };
}
```

## Deduplication and Conflict Resolution

### Finding Similar Facts

```typescript
async function findSimilarFacts(
  newFact: ExtractedFact,
  memorySpaceId: string,
  userId?: string,
): Promise<MemoryEntry[]> {
  // Generate embedding for new fact
  const embedding = await embed(newFact.fact);

  // Search for similar existing facts
  const similar = await cortex.memory.search(memorySpaceId, newFact.fact, {
    embedding,
    userId,
    contentType: "fact", // Only search facts
    minScore: 0.8, // 80% similarity threshold
    limit: 5,
  });

  return similar;
}
```

### Resolving Conflicts

```typescript
async function resolveFactConflict(
  newFact: ExtractedFact,
  existingFacts: MemoryEntry[],
): Promise<"CREATE" | "UPDATE" | "IGNORE"> {
  if (existingFacts.length === 0) {
    return "CREATE";
  }

  const topMatch = existingFacts[0];

  // Very similar = ignore duplicate
  if (topMatch.score > 0.95) {
    return "IGNORE";
  }

  // Moderately similar = might be update
  if (topMatch.score > 0.85) {
    // Use LLM to decide
    const decision = await llm.complete(`
Is this new fact an update to the existing fact?

New: "${newFact.fact}"
Existing: "${topMatch.content}"

Respond with one word: CREATE (separate fact) or UPDATE (refine existing) or IGNORE (already captured)
    `);

    return decision.trim().toUpperCase() as "CREATE" | "UPDATE" | "IGNORE";
  }

  // Low similarity = create new
  return "CREATE";
}
```

### Updating Facts

```typescript
async function updateFact(
  existingFactId: string,
  newFactText: string,
  source: ConversationRef,
) {
  // Update in immutable (creates new version)
  const updated = await cortex.immutable.store({
    type: "fact",
    id: existingFactId, // Same ID = new version
    data: {
      fact: newFactText,
      category: "preference", // Preserve category
      confidence: 0.95,
      updatedReason: "new-information",
    },
    conversationRef: source,
    metadata: {
      importance: 70,
      tags: ["preference", "updated"],
    },
  });

  // Update vector index
  const embedding = await embed(newFactText);

  // Find vector entry for this fact
  const vectorEntries = await cortex.memory.search("agent-1", "*", {
    immutableRef: { type: "fact", id: existingFactId },
    limit: 1,
  });

  if (vectorEntries.length > 0) {
    await cortex.memory.update("agent-1", vectorEntries[0].id, {
      content: newFactText,
      embedding,
      conversationRef: source,
    });
  }

  console.log(`Fact updated: ${existingFactId} (now v${updated.version})`);
}
```

## Prompt Engineering

### Template: General Facts

```typescript
const GENERAL_FACT_EXTRACTION = `
You are a fact extraction assistant. Extract key facts from the conversation that should be remembered long-term.

Guidelines:
- Focus on user preferences, attributes, decisions, events, and relationships
- Write facts in third-person, present tense (e.g., "User prefers X")
- Be specific and actionable
- One fact = one statement
- Avoid redundancy

Conversation:
{conversation_text}

Previously known facts (avoid duplicates):
{existing_facts}

Extract facts as JSON array:
[
  {
    "fact": "Clear, concise fact statement",
    "category": "preference|attribute|event|decision|relationship",
    "confidence": 0.0-1.0
  }
]

Return ONLY the JSON array.
`;
```

### Template: User Preferences

```typescript
const PREFERENCE_EXTRACTION = `
Extract ONLY user preferences from this conversation.

Preferences include:
- Likes/dislikes
- Preferred tools, languages, frameworks, methods
- Communication style preferences
- Working preferences (remote, hours, etc.)
- Product/service preferences

Conversation:
{conversation_text}

Output JSON array:
[{"fact": "User prefers X over Y", "confidence": 0.9}]
`;
```

### Template: Events and Actions

```typescript
const EVENT_EXTRACTION = `
Extract significant events or actions from this conversation.

Include:
- Tasks completed or started
- Decisions made
- Milestones reached
- Problems encountered
- Status changes

Add temporal context when mentioned.

Conversation:
{conversation_text}

Output JSON array with temporal details:
[{"fact": "User completed X on DATE", "category": "event", "confidence": 0.95}]
`;
```

### Template: Entity Relationships (for Graph)

```typescript
const ENTITY_RELATION_EXTRACTION = `
Extract entities and their relationships for a knowledge graph.

Entities: People, organizations, projects, tools, locations, concepts
Relationships: works_at, manages, uses, knows, located_in, part_of, etc.

Conversation:
{conversation_text}

Output JSON:
{
  "facts": [
    {"fact": "User works at Acme Corp", "category": "relationship", "confidence": 0.95}
  ],
  "entities": [
    {"name": "User", "type": "person"},
    {"name": "Acme Corp", "type": "organization"}
  ],
  "relations": [
    {"subject": "User", "predicate": "works_at", "object": "Acme Corp", "confidence": 0.95}
  ]
}
`;
```

## Retrieval Patterns

### Searching Facts

```typescript
// Search facts semantically
const facts = await cortex.memory.search("agent-1", "user employment", {
  embedding: await embed("user employment"),
  userId: "user-123",
  contentType: "fact", // Only search facts
  limit: 5,
});

console.log(
  "Employment facts:",
  facts.map((f) => f.content),
);
// ["User works at Acme Corp", "User's role: Senior Engineer", ...]
```

### Filtering by Category

```typescript
// Get only preference facts
const preferences = await cortex.memory.search("agent-1", "*", {
  userId: "user-123",
  contentType: "fact",
  metadata: { category: "preference" },
  sortBy: "importance",
  sortOrder: "desc",
});

// Get only events
const events = await cortex.memory.search("agent-1", "*", {
  userId: "user-123",
  contentType: "fact",
  metadata: { category: "event" },
  sortBy: "createdAt",
  sortOrder: "desc",
});
```

### Combining Facts with Context

```typescript
async function buildFactBasedContext(
  memorySpaceId: string,
  userId: string,
  query: string,
) {
  // Get relevant facts
  const facts = await cortex.memory.search(memorySpaceId, query, {
    embedding: await embed(query),
    userId,
    contentType: "fact",
    minImportance: 50,
    limit: 10,
  });

  // Format for LLM context
  const factContext = facts
    .map(
      (f) => `- ${f.content} (confidence: ${f.metadata.confidence || "N/A"})`,
    )
    .join("\n");

  // Optionally get full source conversations for high-importance facts
  const criticalFacts = facts.filter((f) => f.metadata.importance >= 90);

  for (const fact of criticalFacts) {
    if (fact.conversationRef) {
      const conversation = await cortex.conversations.get(
        fact.conversationRef.conversationId,
      );

      console.log(`Source conversation for critical fact "${fact.content}":`);
      console.log(conversation.messages.slice(-3)); // Last 3 messages
    }
  }

  return {
    facts: factContext,
    criticalFactSources: criticalFacts,
  };
}
```

## Storage Architecture

### Facts in Immutable Layer

```typescript
// Stored via cortex.immutable.store()
{
  type: 'fact',
  id: 'fact-abc123',

  data: {
    fact: "User prefers TypeScript for backend development",
    category: "preference",
    confidence: 0.95,
    entities: ["TypeScript", "backend"],  // Optional
    relations: [                          // Optional (for graph)
      {
        subject: "User",
        predicate: "prefers",
        object: "TypeScript",
        confidence: 0.95
      }
    ],
    extractedBy: "gpt-4",
    extractedAt: "2025-10-28T10:30:00Z"
  },

  userId: "user-123",

  conversationRef: {
    conversationId: "conv-456",
    messageIds: ["msg-789", "msg-790"]
  },

  metadata: {
    publishedBy: "fact-extraction-pipeline",
    tags: ["preference", "programming", "backend"],
    importance: 75
  },

  version: 1,  // Automatic versioning
  previousVersions: [],
  createdAt: 1698500000000,
  updatedAt: 1698500000000
}
```

### Facts in Vector Layer

```typescript
// Indexed via cortex.vector.store()
{
  memorySpaceId: "user-123-personal",
  userId: "user-123",

  content: "User prefers TypeScript for backend development",
  contentType: "fact",  // NEW content type
  embedding: [0.234, -0.891, ...],  // For semantic search

  source: {
    type: "fact-extraction",
    extractedFrom: "conversation",
    timestamp: Date
  },

  // Link to immutable fact
  immutableRef: {
    type: "fact",
    id: "fact-abc123",
    version: 1
  },

  // Also link to source conversation
  conversationRef: {
    conversationId: "conv-456",
    messageIds: ["msg-789", "msg-790"]
  },

  metadata: {
    importance: 75,
    tags: ["preference", "programming", "backend"],
    category: "preference",
    confidence: 0.95
  },

  version: 1,
  accessCount: 0,
  createdAt: Date,
  updatedAt: Date
}
```

**Benefits of Dual Storage:**

- Immutable layer: Versioned facts, shared across agents, compliance
- Vector layer: Fast semantic search, agent-specific, retrieval-optimized
- conversationRef: Always trace back to source (audit trail)

## Cloud Mode: Automatic Extraction

### Zero-Code Fact Extraction

```typescript
const cortex = new Cortex({
  mode: "cloud",
  apiKey: process.env.CORTEX_CLOUD_KEY,
});

// Just enable auto-extraction
await cortex.memory.remember({
  memorySpaceId: "user-123-personal",
  conversationId: "conv-123",
  userMessage: "I moved to London last week and started working at Acme Corp",
  agentResponse: "Congratulations on both!",
  userId: "user-123",
  userName: "Alex",

  autoExtractFacts: true, // ← That's it!
});

// Cortex Cloud automatically:
// 1. Stores raw conversation in ACID
// 2. Extracts facts via LLM
// 3. Checks for duplicates
// 4. Resolves conflicts
// 5. Stores facts in immutable
// 6. Indexes in vector
// 7. Links everything via refs

// No LLM API key needed ✅
// No prompt engineering needed ✅
// No deduplication code needed ✅
```

### Cloud Extraction Options

```typescript
await cortex.memory.remember({
  memorySpaceId: "user-123-personal",
  conversationId: "conv-123",
  userMessage,
  agentResponse,
  userId,
  userName,

  // Cloud Mode options
  autoExtractFacts: true, // Extract facts
  factCategories: ["preference", "attribute"], // Which categories
  minFactConfidence: 0.7, // Discard low-confidence
  storeRaw: true, // Also keep raw (default)
  autoImportance: true, // LLM assigns importance
  syncToGraph: true, // Sync to graph DB (if Graph-Premium)
});
```

### Pricing

**Cloud Mode Fact Extraction:**

- $0.001 per extraction operation (includes LLM call + storage)
- Free tier:
  - Pro: 1,000 extractions/month
  - Scale: 10,000 extractions/month
  - Enterprise: Unlimited

**Example Costs:**

```
10K conversations/month with fact extraction:
- 10,000 × $0.001 = $10/month
- Saves ~900K tokens vs raw storage
- Token savings value: ~$900 at $1/1M tokens
- Net savings: $890/month! ✅
```

## Performance Optimization

### Batch Extraction

```typescript
// Extract facts from multiple conversations at once
async function batchExtractFacts(
  conversations: Array<{
    id: string;
    messages: Message[];
  }>,
) {
  // Combine into single LLM call
  const batchPrompt = conversations
    .map(
      (conv, i) => `Conversation ${i + 1}:\n${formatMessages(conv.messages)}`,
    )
    .join("\n\n---\n\n");

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "user",
        content: `
Extract facts from these ${conversations.length} conversations.

${batchPrompt}

Return JSON object with keys "0", "1", etc. mapping to facts arrays.
`,
      },
    ],
    temperature: 0.2,
  });

  const results = JSON.parse(response.choices[0].message.content);

  // Map back to conversation IDs
  const factsByConversation = new Map();

  conversations.forEach((conv, i) => {
    factsByConversation.set(conv.id, results[i.toString()] || []);
  });

  return factsByConversation;
}
```

### Async Extraction (Non-Blocking)

```typescript
// Don't block user interaction on fact extraction
async function rememberAsync(params: RememberParams) {
  // 1. Store raw conversation immediately
  const conversationResult = await cortex.conversations.addMessage(
    params.conversationId,
    {
      role: "user",
      content: params.userMessage,
      userId: params.userId,
    },
  );

  // 2. Queue fact extraction for background processing
  if (params.extractFacts) {
    queueFactExtraction({
      conversationId: params.conversationId,
      messageIds: [conversationResult.id],
      memorySpaceId: params.memorySpaceId,
      userId: params.userId,
    });
  }

  // 3. Return immediately (facts extracted async)
  return { conversationId: params.conversationId };
}

// Background worker processes queue
async function factExtractionWorker() {
  while (true) {
    const job = await dequeueFactExtraction();

    if (job) {
      try {
        await processFactExtraction(job);
      } catch (error) {
        console.error("Background extraction failed:", error);
      }
    }

    await sleep(1000);
  }
}
```

## Real-World Examples

### Example 1: Customer Support

```typescript
// Store support interaction with fact extraction
await cortex.memory.remember({
  memorySpaceId: "support-bot-space",
  conversationId: "conv-support-456",
  userMessage:
    "My account email is alex@example.com and I need to update my billing address to 123 Main St, London",
  agentResponse: "I can help with that. I've noted your email and new address.",
  userId: "customer-abc",
  userName: "Alex Johnson",
  extractFacts: true,
});

// Extracted facts:
// 1. Customer's email: alex@example.com
// 2. Customer's billing address: 123 Main St, London
// 3. Customer requested billing address update

// Next interaction - facts are immediately available
const facts = await cortex.memory.search("support-agent", "customer email", {
  userId: "customer-abc",
  contentType: "fact",
});

console.log(facts[0].content);
// "Customer's email: alex@example.com"
```

### Example 2: Code Assistant

```typescript
// Extract coding preferences
await cortex.memory.remember({
  memorySpaceId: "user-dev-workspace",
  conversationId: "conv-coding-789",
  userMessage:
    "I prefer React with TypeScript and use Tailwind for styling. I follow the Airbnb style guide.",
  agentResponse: "Got it! I'll keep that in mind for future suggestions.",
  userId: "dev-user-123",
  userName: "Developer",
  extractFacts: true,
});

// Extracted facts:
// 1. User prefers React framework
// 2. User prefers TypeScript language
// 3. User uses Tailwind CSS
// 4. User follows Airbnb style guide

// Later code suggestions can reference these facts
const prefs = await cortex.memory.search("code-assistant", "user tech stack", {
  userId: "dev-user-123",
  contentType: "fact",
  metadata: { category: "preference" },
});

// Generate code using preferences
const codeContext = prefs.map((p) => p.content).join("; ");
// "User prefers React framework; User prefers TypeScript language; User uses Tailwind CSS"
```

### Example 3: Healthcare (with Graph)

```typescript
// Extract medical facts with relationships
await cortex.memory.remember({
  memorySpaceId: "medical-assistant-space",
  conversationId: "conv-patient-101",
  userMessage:
    "I was diagnosed with Type 2 diabetes in 2020. My doctor is Dr. Smith at City Hospital. I take Metformin daily.",
  agentResponse: "Thank you for sharing that information.",
  userId: "patient-456",
  userName: "Patient",
  extractFacts: true,
  syncToGraph: true, // Cloud Mode + Graph-Premium
});

// Extracted facts with entities and relations:
// Facts:
// 1. Patient diagnosed with Type 2 diabetes (2020)
// 2. Patient's doctor: Dr. Smith at City Hospital
// 3. Patient takes Metformin daily

// Entities: Patient, Type 2 diabetes, Dr. Smith, City Hospital, Metformin

// Relations (synced to graph):
// (Patient)-[:DIAGNOSED_WITH]->(Type 2 diabetes)
// (Patient)-[:TREATED_BY]->(Dr. Smith)
// (Dr. Smith)-[:WORKS_AT]->(City Hospital)
// (Patient)-[:TAKES]->(Metformin)

// Graph query: Find all patients of Dr. Smith
// MATCH (:Entity {name: 'Dr. Smith'})<-[:TREATED_BY]-(patients)
// RETURN patients
```

## Token Savings Analysis

### Measuring Efficiency

```typescript
async function analyzeTokenSavings(conversationId: string) {
  const conversation = await cortex.conversations.get(conversationId);

  // Calculate raw token count
  const rawText = conversation.messages
    .map(m => m.content)
    .join('\n');
  const rawTokens = estimateTokens(rawText);

  // Get extracted facts
  const facts = await cortex.immutable.list({
    type: 'fact',
    'conversationRef.conversationId': conversationId
  });

  // Calculate fact token count
  const factText = facts.records
    .map(f => f.data.fact)
    .join('\n');
  const factTokens = estimateTokens(factText);

  const savings = ((rawTokens - factTokens) / rawTokens) * 100;

  return {
    rawTokens,
    factTokens,
    savingsPercent: savings.toFixed(1),
    savingsAbsolute: rawTokens - factTokens
  };
}

// Example result
{
  rawTokens: 1250,
  factTokens: 125,
  savingsPercent: '90.0',
  savingsAbsolute: 1125
}

// 90% savings achieved! ✅
```

### Cost Comparison

```
10K conversations/month:
- Raw storage: 1.25M tokens to embed
- Fact storage: 125K tokens to embed
- Embedding cost savings: $0.13 × 1.125M = $146/month

Search latency:
- Raw: ~100ms (large vectors to compare)
- Facts: ~30ms (small, precise vectors)
- 70% faster retrieval ✅

LLM context:
- Raw: 1250 tokens/conversation
- Facts: 125 tokens/conversation
- 90% more room for other context ✅
```

## Best Practices

### 1. Extract Facts for Long-Term Memory

```typescript
// ✅ Use facts for persistent knowledge
await cortex.memory.remember({
  extractFacts: true, // Long-term preferences, attributes
  storeRaw: true, // Keep raw for compliance
});

// ⚠️ Raw only for temporary context
await cortex.memory.remember({
  extractFacts: false, // Session-specific chatter
  storeRaw: true,
});
```

### 2. Tune Confidence Threshold

```typescript
// Discard low-confidence facts
const CONFIDENCE_THRESHOLD = 0.7;

const validFacts = extractedFacts.filter(
  (f) => f.confidence >= CONFIDENCE_THRESHOLD,
);

// Store only high-confidence facts
for (const fact of validFacts) {
  await storeFact(fact, conversationRef, userId);
}
```

### 3. Review and Refine Prompts

```typescript
// Test extraction quality
async function testFactExtraction() {
  const testCases = [
    {
      input: "I prefer dark mode and work in San Francisco",
      expectedFacts: ["User prefers dark mode", "User works in San Francisco"],
    },
  ];

  for (const test of testCases) {
    const extracted = await extractFacts(test.input);

    console.log("Input:", test.input);
    console.log("Expected:", test.expectedFacts);
    console.log(
      "Extracted:",
      extracted.map((f) => f.fact),
    );

    // Evaluate accuracy
    const accuracy = calculateAccuracy(test.expectedFacts, extracted);
    console.log("Accuracy:", accuracy);
  }
}
```

### 4. Implement Conflict Resolution

```typescript
// Don't create duplicate facts
async function storeFactWithDedup(
  fact: ExtractedFact,
  memorySpaceId: string,
  userId: string,
) {
  // Check for similar
  const similar = await findSimilarFacts(fact, memorySpaceId, userId);

  if (similar.length > 0 && similar[0].score > 0.9) {
    console.log(`Duplicate fact detected: "${fact.fact}"`);
    console.log(`Similar to: "${similar[0].content}"`);
    return null; // Skip
  }

  // Store new fact
  return await storeFact(fact, conversationRef, userId);
}
```

### 5. Link Facts to Conversations

```typescript
// ✅ Always include conversationRef for audit trail
await cortex.immutable.store({
  type: "fact",
  id: factId,
  data: { fact: "User prefers TypeScript" },
  conversationRef: {
    conversationId: "conv-123",
    messageIds: ["msg-456"], // ← Source message
  },
});

// Later: Trace back to source
const fact = await cortex.immutable.get("fact", factId);
const conversation = await cortex.conversations.get(
  fact.conversationRef.conversationId,
);

console.log("Fact came from conversation:", conversation.conversationId);
```

## Troubleshooting

### Facts Not Being Created

**Check extraction output:**

```typescript
const facts = await extractFacts(conversation);
console.log("Extracted:", facts);

if (facts.length === 0) {
  console.log("No facts extracted - check prompt or conversation content");
}
```

**Verify LLM response:**

```typescript
// Log full LLM response
const response = await openai.chat.completions.create({ ... });
console.log('Raw LLM output:', response.choices[0].message.content);

// Check if valid JSON
try {
  JSON.parse(response.choices[0].message.content);
} catch (error) {
  console.error('LLM returned invalid JSON:', error);
}
```

### Facts Too Generic

**Problem:** Facts like "User said something" (not specific)

**Solution:** Improve prompt specificity:

```typescript
const IMPROVED_PROMPT = `
Extract facts that are:
- Specific (not "User likes movies" but "User prefers sci-fi movies")
- Actionable (can be used to personalize responses)
- Verifiable (clearly stated in conversation)

Avoid:
- Vague statements
- Inferring beyond what was said
- Meta-facts about the conversation itself
`;
```

### Duplicate Facts Accumulating

**Problem:** Similar facts not being deduplicated

**Solutions:**

1. Lower similarity threshold:

```typescript
const similar = await findSimilarFacts(fact, memorySpaceId, userId);
if (similar.length > 0 && similar[0].score > 0.8) {
  // Was 0.85
  return "IGNORE";
}
```

2. Use LLM for semantic deduplication:

```typescript
const isDuplicate = await llm.complete(`
Are these facts essentially the same?
1. "${newFact.fact}"
2. "${existingFact.content}"

Answer: YES or NO
`);
```

3. Periodic consolidation:

```typescript
// Run nightly to merge similar facts
async function consolidateFacts(memorySpaceId: string, userId: string) {
  const allFacts = await cortex.memory.search(memorySpaceId, "*", {
    userId,
    contentType: "fact",
    limit: 1000,
  });

  // Find and merge duplicates
  // (implementation left as exercise)
}
```

## Next Steps

- **[Facts vs Conversations Trade-offs](./03-facts-vs-conversations.md)** - Detailed comparison
- **[Graph Database Integration](./02-graph-database-integration.md)** - Add graph for entity relationships
- **[Semantic Search](../02-core-features/02-semantic-search.md)** - Search fact efficiently
- **[Immutable Store API](../03-api-reference/07-immutable-store-api.md)** - Storage layer for facts

---

**Questions?** Ask in [GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions) or [Discord](https://discord.gg/cortex).
