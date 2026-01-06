# {{PROJECT_NAME}}

AI agent with persistent memory powered by [Cortex Memory SDK](https://cortexmemory.dev).

This demo shows how Cortex orchestrates data through memory layers - the same logic used in the Vercel AI quickstart, but without any UI dependencies.

## Quick Start

### 1. Start Convex Backend

```bash
npm run dev
```

Leave this running. It watches for changes and keeps the Convex server active.

### 2. Chat via CLI

```bash
npm start
```

This starts an interactive CLI where you can chat and see memory orchestration in real-time.

### 3. Or use the HTTP API

```bash
npm run server
```

Then send requests:

```bash
curl -X POST http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "My name is Alex and I work at Acme Corp"}'
```

## Features

### Rich Console Output

Watch data flow through all memory layers in real-time:

```
You: My name is Alex and I work at Acme Corp

┌────────────────────────────────────────────────────────────────────┐
│  MEMORY ORCHESTRATION                                              │
├────────────────────────────────────────────────────────────────────┤
│  📦 Memory Space   ✓ complete (2ms)                                │
│     → ID: basic-demo                                               │
│                                                                    │
│  👤 User           ✓ complete (5ms)                                │
│     → ID: demo-user                                                │
│     → Name: Demo User                                              │
│                                                                    │
│  🤖 Agent          ✓ complete (3ms)                                │
│     → ID: basic-assistant                                          │
│     → Name: Cortex CLI Assistant                                   │
│                                                                    │
│  💬 Conversation   ✓ complete (8ms)                                │
│     → ID: conv-abc123                                              │
│     → Messages: 2                                                  │
│                                                                    │
│  🎯 Vector Store   ✓ complete (45ms)                               │
│     → Embedded with 1536 dimensions                                │
│     → Importance: 75                                               │
│                                                                    │
│  💡 Facts          ✓ complete [NEW] (120ms)                        │
│     → Extracted 2 facts:                                           │
│       • "User's name is Alex" (identity, 95%)                      │
│       • "User works at Acme Corp" (employment, 90%)                │
│                                                                    │
│  🕸️ Graph          ○ skipped (not configured)                      │
├────────────────────────────────────────────────────────────────────┤
│  Total: 183ms                                                      │
└────────────────────────────────────────────────────────────────────┘
```

### CLI Commands

| Command | Description |
|---------|-------------|
| `/recall <query>` | Search memories without storing |
| `/facts` | List all stored facts |
| `/history` | Show conversation history |
| `/new` | Start a new conversation |
| `/config` | Show current configuration |
| `/clear` | Clear the screen |
| `/exit` | Exit the demo |

### HTTP API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/chat` | POST | Chat and store memory |
| `/recall` | GET | Search memories (`?query=...`) |
| `/facts` | GET | List stored facts |
| `/history/:id` | GET | Get conversation history |
| `/health` | GET | Health check |

## Configuration

All configuration is via environment variables in `.env.local`:

```env
# Required
CONVEX_URL=https://your-project.convex.cloud

# Optional: Enable AI responses (otherwise runs in echo mode)
OPENAI_API_KEY=sk-...

# Optional: Customize identifiers
MEMORY_SPACE_ID=basic-demo
USER_ID=demo-user
USER_NAME=Demo User
AGENT_ID=basic-assistant
AGENT_NAME=Cortex CLI Assistant

# Optional: Feature flags
CORTEX_FACT_EXTRACTION=true    # Enable automatic fact extraction
CORTEX_GRAPH_SYNC=false        # Enable graph database sync

# Optional: Debug mode
DEBUG=true
```

## Project Structure

```
.
├── src/
│   ├── index.ts      # CLI entry point
│   ├── server.ts     # HTTP server entry point
│   ├── chat.ts       # Core chat/memory logic
│   ├── cortex.ts     # SDK client configuration
│   ├── llm.ts        # Optional OpenAI integration
│   └── display.ts    # Rich console output
├── convex/           # Cortex backend functions
├── .env.local        # Environment configuration
├── dev-runner.mjs    # Development helper
└── package.json
```

## How It Works

1. **Recall** - Before responding, Cortex searches for relevant memories and facts
2. **Generate** - Uses OpenAI (if configured) or echo mode to generate a response
3. **Remember** - Stores the exchange through all memory layers:
   - **Memory Space** - Isolated namespace
   - **User** - User profile tracking
   - **Agent** - Agent registration
   - **Conversation** - Message storage
   - **Vector** - Semantic embeddings for search
   - **Facts** - Extracted structured information
   - **Graph** - Entity relationships (optional)

## Testing

The project includes comprehensive tests:

```bash
# Run all unit tests
npm test

# Run with coverage
npm run test:coverage

# Run integration tests (mocked SDK)
npm run test:integration

# Run e2e tests (requires real backend)
npm run test:e2e

# Run all tests
npm run test:all
```

### E2E Test Requirements

E2E tests require additional setup:

1. **Memory flow tests** - Need `CONVEX_URL` pointing to a deployed Cortex backend
2. **Fact extraction tests** - Also need `OPENAI_API_KEY` for LLM-powered extraction
3. **Server tests** - Need the HTTP server running (`npm run server`)

```bash
# Run memory flow e2e tests
CONVEX_URL=https://your-project.convex.cloud npm run test:e2e

# Run fact extraction tests (requires OpenAI)
CONVEX_URL=https://your-project.convex.cloud \
OPENAI_API_KEY=sk-... \
npm run test:e2e

# Run server e2e tests
# Terminal 1: Start server
CONVEX_URL=https://your-project.convex.cloud npm run server
# Terminal 2: Run tests
npm run test:e2e
```

## Next Steps

### Enable AI Responses

Set `OPENAI_API_KEY` in `.env.local` for real AI-powered responses instead of echo mode.

### Enable Graph Database

For entity relationship queries:

1. Start Neo4j: `docker-compose -f docker-compose.graph.yml up -d`
2. Set `CORTEX_GRAPH_SYNC=true` in `.env.local`

### Explore the API

- [Cortex Documentation](https://cortexmemory.dev/docs)
- [API Reference](https://cortexmemory.dev/docs/api-reference)
- [GitHub Repository](https://github.com/SaintNick1214/Project-Cortex)

## Support

- [GitHub Issues](https://github.com/SaintNick1214/Project-Cortex/issues)
- [GitHub Discussions](https://github.com/SaintNick1214/Project-Cortex/discussions)

## License

FSL-1.1-Apache-2.0
