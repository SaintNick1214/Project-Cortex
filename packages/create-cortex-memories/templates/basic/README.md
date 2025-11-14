# {{PROJECT_NAME}}

AI agent with persistent memory powered by [Cortex Memory SDK](https://github.com/SaintNick1214/Project-Cortex).

## Getting Started

Your Convex backend functions are deployed and configured!

### For Local Development

**Terminal 1** - Start Convex:

```bash
npm run dev
```

Leave this running. It watches for changes and keeps Convex server active.

**Terminal 2** - Run your agent:

```bash
npm start
```

### For Cloud Deployments

Your Convex is already running in the cloud, so just:

```bash
npm start
```

## Project Structure

```
.
├── src/
│   └── index.ts          # Your AI agent code
├── convex/               # Cortex backend functions (deployed to Convex)
│   ├── schema.ts         # Database schema
│   ├── conversations.ts  # Conversation management
│   ├── memories.ts       # Memory storage and search
│   └── ...              # Other Cortex functions
├── .env.local           # Environment configuration (not committed)
└── package.json
```

## What You Get

- **Persistent Memory** - Your agent remembers conversations indefinitely
- **Semantic Search** - Find relevant memories using natural language
- **ACID Storage** - Reliable, consistent data storage
- **Vector Search** - Optional embedding-based search (cloud only)
- **User Profiles** - Manage user data and preferences
- **Multi-Agent Support** - Coordinate between multiple agents

## Next Steps

### Add Vector Embeddings

For semantic search, add an embedding provider:

```typescript
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

await cortex.memory.remember({
  memorySpaceId: "my-agent",
  conversationId: "conv-1",
  userMessage: "message",
  agentResponse: "response",
  userId: "user-1",
  userName: "User",
  generateEmbedding: async (text) => {
    const result = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    return result.data[0].embedding;
  },
});
```

### Enable Graph Database

For advanced relationship queries, set up a graph database:

1. Start Neo4j: `docker-compose -f docker-compose.graph.yml up -d`
2. See `src/graph-init.example.ts` for setup code

### Learn More

- [Documentation](https://github.com/SaintNick1214/Project-Cortex/tree/main/Documentation)
- [API Reference](https://github.com/SaintNick1214/Project-Cortex/tree/main/Documentation/03-api-reference)
- [Examples](https://github.com/SaintNick1214/Project-Cortex/tree/main/Examples)

## Support

- [GitHub Issues](https://github.com/SaintNick1214/Project-Cortex/issues)
- [GitHub Discussions](https://github.com/SaintNick1214/Project-Cortex/discussions)

## License

Apache-2.0
