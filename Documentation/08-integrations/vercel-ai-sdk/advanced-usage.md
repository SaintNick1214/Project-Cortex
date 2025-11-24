# Advanced Usage

Advanced patterns and configurations for Cortex Memory Provider.

## Custom Embedding Providers

### OpenAI Embeddings

```typescript
import { embed } from "ai";
import { openai } from "@ai-sdk/openai";

const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: "my-agent",
  userId: "user-123",

  embeddingProvider: {
    generate: async (text) => {
      const { embedding } = await embed({
        model: openai.embedding("text-embedding-3-large"),
        value: text,
      });
      return embedding;
    },
  },
});
```

### Local Embeddings (Transformers.js)

```typescript
import { pipeline } from "@xenova/transformers";

const embedder = await pipeline(
  "feature-extraction",
  "Xenova/all-MiniLM-L6-v2",
);

const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: "local-agent",
  userId: "user-123",

  embeddingProvider: {
    generate: async (text) => {
      const output = await embedder(text, { pooling: "mean", normalize: true });
      return Array.from(output.data);
    },
  },
});
```

## Fact Extraction

```typescript
import { generateObject } from "ai";
import { z } from "zod";

const factSchema = z.object({
  facts: z.array(
    z.object({
      fact: z.string(),
      type: z.enum(["preference", "identity", "knowledge"]),
      confidence: z.number(),
    }),
  ),
});

const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: "smart-agent",
  userId: "user-123",

  enableFactExtraction: true,
  extractFacts: async (userMsg, agentResp) => {
    const { object } = await generateObject({
      model: openai("gpt-5-nano"),
      schema: factSchema,
      prompt: `Extract facts from: "${userMsg}" and "${agentResp}"`,
    });

    return object.facts.map((f) => ({
      fact: f.fact,
      factType: f.type,
      confidence: f.confidence,
    }));
  },
});
```

## Performance Optimization

See full docs for caching, batching, and optimization strategies.
