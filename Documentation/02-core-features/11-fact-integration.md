# Fact Integration in Memory API

> **Last Updated**: 2025-10-31

Automatic extraction and storage of structured facts from conversations, integrated into the complete three-layer memory pipeline.

## Overview

The Facts layer completes Cortex's three-layer architecture:

- **Layer 1 (ACID)**: Raw conversation storage
- **Layer 2 (Vector)**: Searchable memory embeddings  
- **Layer 3 (Facts)**: Structured knowledge extraction

When you call `memory.remember()` with an `extractFacts` callback, Cortex automatically:

1. Stores the conversation in ACID
2. Creates searchable memory embeddings in Vector
3. Extracts and stores structured facts
4. Links all three layers together via `sourceRef`
5. Syncs to graph database (if configured)

## Quick Start

```typescript
import { Cortex } from "@cortexclick/cortex";

const cortex = new Cortex({ client: convexClient });

// Define fact extraction function
const extractFacts = async (userMessage: string, agentResponse: string) => {
  // Use LLM or custom logic to extract facts
  return [
    {
      fact: "User prefers dark mode",
      factType: "preference",
      subject: "user-123",
      predicate: "prefers",
      object: "dark mode",
      confidence: 95,
      tags: ["ui", "settings"],
    },
  ];
};

// Remember with fact extraction
const result = await cortex.memory.remember({
  memorySpaceId: "agent-1",
  conversationId: "conv-123",
  userMessage: "I like dark mode better",
  agentResponse: "I'll remember your preference!",
  userId: "user-123",
  userName: "Alex",
  extractFacts,  // Facts automatically extracted and stored
});

console.log(`Extracted ${result.facts.length} facts`);
// result.facts contains the extracted, stored facts with IDs
```

## Fact Structure

Each fact includes:

```typescript
interface ExtractedFact {
  fact: string;              // Human-readable fact statement
  factType: FactType;        // Category of fact
  subject?: string;          // Primary entity (e.g., "user-123")
  predicate?: string;        // Relationship (e.g., "prefers")
  object?: string;           // Secondary entity (e.g., "dark mode")
  confidence: number;        // 0-100: extraction confidence
  tags?: string[];           // Classification tags
}

type FactType = "preference" | "identity" | "knowledge" | "relationship" | "event" | "custom";
```

### Fact Types

| Type | Use Case | Example |
|------|----------|---------|
| **preference** | User likes/dislikes | "User prefers dark mode" |
| **identity** | Who/what someone is | "User is a software engineer" |
| **knowledge** | Information/skills | "User knows Python and TypeScript" |
| **relationship** | Connections between entities | "User works_at Google" |
| **event** | Time-based occurrences | "User joined on 2025-01-15" |
| **custom** | Domain-specific facts | "User has_subscription premium" |

## Integration with Memory Operations

### Remember with Facts

Facts are automatically stored and linked:

```typescript
const result = await cortex.memory.remember({
  memorySpaceId: "agent-1",
  conversationId: "conv-123",
  userMessage: "I'm a developer at Microsoft working on AI",
  agentResponse: "Great! What projects are you working on?",
  userId: "user-123",
  userName: "Alex",
  extractFacts: async (user, agent) => {
    return [
      {
        fact: "User is a developer",
        factType: "identity",
        subject: "user-123",
        confidence: 95,
        tags: ["profession"],
      },
      {
        fact: "User works at Microsoft",
        factType: "relationship",
        subject: "user-123",
        predicate: "works_at",
        object: "Microsoft",
        confidence: 98,
        tags: ["employment"],
      },
      {
        fact: "User works on AI projects",
        factType: "knowledge",
        subject: "user-123",
        confidence: 90,
        tags: ["expertise"],
      },
    ];
  },
});

// Access extracted facts
result.facts.forEach(fact => {
  console.log(`Fact: ${fact.fact}`);
  console.log(`Linked to memory: ${fact.sourceRef?.memoryId}`);
  console.log(`Linked to conversation: ${fact.sourceRef?.conversationId}`);
});
```

### Retrieve with Fact Enrichment

Facts are automatically included in enriched results:

```typescript
// Get single memory with facts
const enriched = await cortex.memory.get("agent-1", "mem-123", {
  includeConversation: true,  // Enables enrichment including facts
});

if (enriched.facts) {
  console.log(`Found ${enriched.facts.length} related facts`);
}

// Search with fact enrichment
const results = await cortex.memory.search("agent-1", "user preferences", {
  embedding: await embed("user preferences"),
  enrichConversation: true,  // Facts automatically included
});

results.forEach(result => {
  console.log(`Memory: ${result.memory.content}`);
  if (result.facts) {
    result.facts.forEach(fact => {
      console.log(`  - Fact: ${fact.fact} (${fact.confidence}% confidence)`);
    });
  }
});
```

### Cascade Delete

Facts are automatically deleted when memories are removed:

```typescript
// Delete memory - facts cascade deleted
const deleteResult = await cortex.memory.forget("agent-1", "mem-123", {
  deleteConversation: true,
});

console.log(`Deleted ${deleteResult.factsDeleted} facts`);
console.log(`Fact IDs: ${deleteResult.factIds.join(", ")}`); // Audit trail
```

## Fact Extraction Strategies

### Strategy 1: LLM-Based Extraction

Use an LLM to intelligently extract facts:

```typescript
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const extractFactsWithLLM = async (userMessage: string, agentResponse: string) => {
  const prompt = `Extract structured facts from this conversation:
User: ${userMessage}
Agent: ${agentResponse}

Return facts as JSON array with format:
[{
  "fact": "clear fact statement",
  "factType": "preference|identity|knowledge|relationship|event|custom",
  "subject": "who/what this is about",
  "predicate": "relationship type (optional)",
  "object": "related entity (optional)",
  "confidence": 0-100,
  "tags": ["relevant", "tags"]
}]`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  const extracted = JSON.parse(response.choices[0].message.content);
  return extracted.facts || [];
};

// Use in remember
await cortex.memory.remember({
  memorySpaceId: "agent-1",
  conversationId: "conv-123",
  userMessage: "I'm allergic to peanuts and love Italian food",
  agentResponse: "I'll remember your dietary needs!",
  userId: "user-123",
  userName: "Alex",
  extractFacts: extractFactsWithLLM,
});
```

### Strategy 2: Rule-Based Extraction

Use patterns and keywords for deterministic extraction:

```typescript
const extractFactsWithRules = async (userMessage: string, agentResponse: string) => {
  const facts = [];
  const text = userMessage.toLowerCase();

  // Preference patterns
  if (text.includes("prefer") || text.includes("like") || text.includes("love")) {
    const preferenceMatch = text.match(/(prefer|like|love)s?\s+([^.,!?]+)/);
    if (preferenceMatch) {
      facts.push({
        fact: `User prefers ${preferenceMatch[2]}`,
        factType: "preference",
        confidence: 85,
        tags: ["auto-extracted"],
      });
    }
  }

  // Identity patterns  
  if (text.includes("i am") || text.includes("i'm")) {
    const identityMatch = text.match(/i(?:'m| am)\s+(?:a|an)?\s*([^.,!?]+)/);
    if (identityMatch) {
      facts.push({
        fact: `User is ${identityMatch[1]}`,
        factType: "identity",
        confidence: 90,
        tags: ["auto-extracted"],
      });
    }
  }

  return facts;
};
```

### Strategy 3: Hybrid Approach

Combine rule-based and LLM extraction:

```typescript
const extractFactsHybrid = async (userMessage: string, agentResponse: string) => {
  // Quick rule-based extraction for common patterns
  const ruleFacts = await extractFactsWithRules(userMessage, agentResponse);

  // Use LLM only if message is complex or rule-based found nothing
  if (ruleFacts.length === 0 && userMessage.length > 50) {
    return await extractFactsWithLLM(userMessage, agentResponse);
  }

  return ruleFacts;
};
```

## Confidence Scoring

Confidence indicates extraction reliability (0-100):

| Range | Interpretation | Use Case |
|-------|----------------|----------|
| 90-100 | Very high confidence | Direct quotes, explicit statements |
| 70-89 | High confidence | Clear implications, strong context |
| 50-69 | Medium confidence | Reasonable inferences |
| 30-49 | Low confidence | Weak signals, ambiguous |
| 0-29 | Very low confidence | Speculative, requires verification |

```typescript
const extractFactsWithConfidence = async (userMsg: string, agentMsg: string) => {
  const facts = [];

  // Direct statement - high confidence
  if (userMsg.includes("My email is")) {
    facts.push({
      fact: "User provided email address",
      factType: "identity",
      confidence: 98,  // Very high - explicit
      tags: ["contact"],
    });
  }

  // Implicit preference - medium confidence
  if (userMsg.includes("usually use")) {
    facts.push({
      fact: "User has usage preference",
      factType: "preference",
      confidence: 65,  // Medium - implied
      tags: ["behavior"],
    });
  }

  return facts;
};
```

## Error Handling

Fact extraction errors don't break memory storage:

```typescript
const extractFacts = async (userMessage: string, agentResponse: string) => {
  try {
    // Attempt extraction
    const response = await llm.extract(userMessage, agentResponse);
    return response.facts;
  } catch (error) {
    // Extraction failed - log but don't throw
    console.warn("Fact extraction failed:", error);
    return [];  // Return empty array, memory still saved
  }
};

// Memory is stored even if fact extraction fails
const result = await cortex.memory.remember({
  memorySpaceId: "agent-1",
  conversationId: "conv-123",
  userMessage: "Test",
  agentResponse: "Response",
  userId: "user-123",
  userName: "Alex",
  extractFacts,  // May fail, that's OK
});

// result.memories will always be populated
// result.facts may be empty if extraction failed
```

## Querying Facts

Access facts through the Facts API or via memory enrichment:

```typescript
// Direct fact query
const userFacts = await cortex.facts.list({
  memorySpaceId: "agent-1",
  subject: "user-123",
  factType: "preference",
});

// Search facts
const foodFacts = await cortex.facts.search("agent-1", "food preferences", {
  factType: "preference",
  minConfidence: 70,
});

// Via memory enrichment (recommended)
const memories = await cortex.memory.search("agent-1", "user preferences", {
  enrichConversation: true,  // Facts automatically included
});
```

## Best Practices

### 1. Extract Atomic Facts

```typescript
// ❌ Bad: Compound fact
{
  fact: "User is 25 years old from California and likes hiking",
  factType: "identity",
  confidence: 80,
}

// ✅ Good: Atomic facts
[
  {
    fact: "User is 25 years old",
    factType: "identity",
    confidence: 95,
  },
  {
    fact: "User is from California",
    factType: "identity",
    confidence: 95,
  },
  {
    fact: "User likes hiking",
    factType: "preference",
    confidence: 90,
  },
]
```

### 2. Use Consistent Subject IDs

```typescript
// ✅ Good: Consistent subject identification
const extractFacts = async (userMsg, agentMsg, userId) => {
  return [{
    fact: "User prefers email notifications",
    factType: "preference",
    subject: userId,  // Always use same ID format
    confidence: 90,
  }];
};
```

### 3. Tag for Organization

```typescript
const facts = [{
  fact: "User speaks English and Spanish",
  factType: "knowledge",
  confidence: 95,
  tags: ["language", "communication", "multilingual"],  // Multiple relevant tags
}];
```

### 4. Set Appropriate Confidence

```typescript
// Base confidence on source reliability
const extractFacts = async (userMsg, agentMsg) => {
  if (userMsg.startsWith("My name is")) {
    return [{
      fact: "User stated their name",
      confidence: 99,  // Direct statement
    }];
  }
  
  if (userMsg.includes("might prefer")) {
    return [{
      fact: "User may have preference",
      confidence: 50,  // Uncertain
    }];
  }
};
```

## Performance Considerations

### Async Extraction

Fact extraction happens in parallel with other operations:

```typescript
// Extraction doesn't block memory storage
const result = await cortex.memory.remember({
  memorySpaceId: "agent-1",
  conversationId: "conv-123",
  userMessage: "Long message with lots of facts...",
  agentResponse: "Response",
  userId: "user-123",
  userName: "Alex",
  extractFacts: async (user, agent) => {
    // This can take time without blocking
    return await slowLLMExtraction(user, agent);
  },
});
// Memories stored immediately, facts stored in parallel
```

### Batch Extraction

For high-volume scenarios, batch fact extraction:

```typescript
const pendingExtractions = [];

// Queue extractions
for (const conversation of conversations) {
  pendingExtractions.push(
    cortex.memory.remember({
      ...conversation,
      extractFacts: quickExtraction,  // Fast, simple extraction
    })
  );
}

// Process in parallel
await Promise.all(pendingExtractions);
```

## Next Steps

- **[Semantic Search](./02-semantic-search.md)** - Query facts via memory search
- **[Context Chains](./04-context-chains.md)** - Propagate facts across agents
- **[Facts API Reference](../03-api-reference/14-facts-operations.md)** - Complete facts API documentation
- **[Memory API Reference](../03-api-reference/02-memory-operations.md)** - Memory operations with fact integration
- **[Fact Extraction (Storage Trade-offs)](./08-fact-extraction.md)** - Detailed analysis of facts vs raw storage

---

**Questions?** Ask in [GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions) or [Discord](https://discord.gg/cortex).

