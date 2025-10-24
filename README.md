# Cortex

> **Plug'n'play persistent memory for AI agents, powered by Convex**

[![npm version](https://badge.fury.io/js/@cortex%2Fmemory.svg)](https://www.npmjs.com/package/@cortex/memory)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Convex](https://img.shields.io/badge/Powered%20by-Convex-purple.svg)](https://convex.dev)

Cortex brings enterprise-grade persistent memory to any AI agent system. Built on Convex, it provides flexible, scalable memory that works with any LLM or framework.

## ✨ Features

- 🧠 **Flexible Memory** - Remember anything without hardcoded topics or schemas
- 🔒 **Private Memory Banks** - Each agent has isolated, secure storage
- ♾️ **Long-term Persistence** - Memories last forever with automatic indexing
- ⏱️ **Automatic Versioning** - Updates preserve history, never lose data (10 versions default)
- 🗄️ **ACID + Vector Hybrid** - Immutable conversation source + fast searchable index
- 🔍 **Semantic Search** - AI-powered retrieval with multi-strategy fallback
- 📊 **Vector Embeddings** - Optional but preferred, support any dimension (768, 1536, 3072+)
- 🔗 **Context Chains** - Hierarchical context sharing across agent teams
- 👥 **User Profiles** - Rich user context and preferences
- 📈 **Access Analytics** - Built-in tracking and insights
- 🎯 **Hybrid Agent Management** - Simple IDs or full registry, your choice
- 🚀 **Embedding Agnostic** - Works with OpenAI, Cohere, local models, or any provider

## 🚀 Quick Start

### Install

```bash
npm install @cortex/memory convex
```

### Direct Mode (Free, Open Source)

```typescript
import { Cortex } from '@cortex/memory';

// Connect directly to your Convex instance
const cortex = new Cortex({
  mode: 'direct',
  convexUrl: process.env.CONVEX_URL,
});

// Store a memory
await cortex.memory.store('agent-1', {
  content: 'User mentioned their dog is named Max',
  embedding: await getEmbedding('User mentioned their dog is named Max'),
  userId: 'user-123',
  source: {
    type: 'conversation',
    userId: 'user-123',
    userName: 'Alex',
    timestamp: new Date()
  },
  metadata: { importance: 60, tags: ['pets', 'personal'] }
});

// Search memories (filtered to specific user)
const memories = await cortex.memory.search('agent-1', 
  'what is the user\'s dog name?',
  { 
    embedding: await getEmbedding('what is the user\'s dog name?'),
    userId: 'user-123'  // Only search this user's context
  }
);

console.log(memories[0].content); // "User mentioned their dog is named Max"
console.log(memories[0].source.userName); // "Alex"

// ⏱️ Automatic versioning - updates preserve history
await cortex.memory.update('agent-1', memories[0].id, {
  content: 'User mentioned their dog Max passed away - now has a cat named Whiskers',
});

// View version history
const updated = await cortex.memory.get('agent-1', memories[0].id);
console.log(updated.version); // 2
console.log(updated.previousVersions[0].content); // "User mentioned their dog is named Max"
console.log(updated.content); // "...now has a cat named Whiskers"
```

### Cloud Mode (Managed Service)

```typescript
import { Cortex } from '@cortex/memory';

// Use Cortex Cloud for analytics and advanced features
const cortex = new Cortex({
  mode: 'cloud',
  apiKey: process.env.CORTEX_API_KEY,
  // Connect your Convex instance via Cortex Cloud dashboard
});

// Same API - but with analytics, cost optimization, and more
await cortex.memory.store('agent-1', { /* ... */ });
```

> **Note**: Cortex Cloud is in development. Join the waitlist at [cortexmemory.dev](https://cortexmemory.dev)

## 🎯 Why Cortex?

**Traditional memory solutions** require you to:
- Choose between vector DBs (Pinecone, Weaviate) or simple storage (Redis)
- Manage infrastructure, scaling, and backups
- Write custom logic for multi-agent coordination
- Handle user profiles and context separately

**Cortex** gives you everything in one package:
- ✅ Production-ready memory system that scales automatically
- ✅ Works with any LLM framework (LangChain, Vercel AI SDK, custom)
- ✅ Bring your own embeddings (OpenAI, Cohere, local models)
- ✅ Built on Convex's reactive, serverless backend
- ✅ Zero infrastructure management

## 📚 Core Concepts

### Memory Operations
```typescript
// Store
await cortex.memory.store(agentId, { content, embedding, metadata });

// Search (semantic + keyword)
await cortex.memory.search(agentId, query, { embedding });

// Retrieve specific memory
await cortex.memory.get(agentId, memoryId);

// Delete
await cortex.memory.delete(agentId, memoryId);
```

### Agent Management (Hybrid Approach)
```typescript
// Simple: Just use string IDs
await cortex.memory.store('agent-123', { ... });

// Advanced: Register for analytics and discovery
await cortex.agents.register({
  id: 'agent-123',
  name: 'Customer Support Bot',
  metadata: { team: 'support', capabilities: ['empathy'] }
});

// Query registered agents
const agents = await cortex.agents.search({ team: 'support' });
```

### Context Chains
```typescript
// Create a context chain for hierarchical agent collaboration
const context = await cortex.contexts.create({
  purpose: 'Handle customer refund request',
  agentId: 'supervisor-agent',
});

// Child agents can access the full context
const fullContext = await cortex.contexts.get(context.id);
console.log(fullContext.chain); // Complete hierarchy
```

### User Profiles
```typescript
// Store user information
await cortex.users.update('user-123', {
  displayName: 'John Doe',
  preferences: { theme: 'dark', language: 'en' },
  metadata: { tier: 'premium' }
});

// Retrieve user context
const user = await cortex.users.get('user-123');
```

## 🏗️ Architecture

Cortex provides two deployment modes to fit your needs:

### Direct Mode (Open Source)

```
┌─────────────────────────────────────────────────────┐
│                   Your Application                   │
│         (Next.js, Express, LangChain, etc.)         │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│            Cortex SDK (Open Source)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │    Memory    │  │   Context    │  │   User    │ │
│  │  Operations  │  │    Chains    │  │ Profiles  │ │
│  └──────────────┘  └──────────────┘  └───────────┘ │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│            Your Convex Instance                      │
│  • Convex Cloud (managed)                           │
│  • Self-hosted (local or your infrastructure)       │
└─────────────────────────────────────────────────────┘
```

Perfect for getting started, prototyping, and self-managed deployments.

> **Works with any Convex deployment** - Convex Cloud, localhost, or your own infrastructure

### Cloud Mode (Managed Service)

```
┌─────────────────────────────────────────────────────┐
│                   Your Application                   │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│            Cortex SDK (same code!)                   │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│               Cortex Cloud API                       │
│  • Analytics & Insights  • Team Management          │
│  • Cost Optimization     • Advanced Features        │
│  • Migration Tools       • Priority Support         │
└────────────────────┬────────────────────────────────┘
                     │ (using your Convex credentials)
                     ▼
┌─────────────────────────────────────────────────────┐
│            Your Convex Instance                      │
│  • Convex Cloud (managed)                           │
│  • Self-hosted (local or your infrastructure)       │
└─────────────────────────────────────────────────────┘
```

Adds powerful management tools while your data remains in your Convex instance.

> **Works with any Convex deployment** - Cloud mode features work regardless of where you run Convex

**Key Design Decisions:**
- **Built on Convex**: Leverages Convex's reactive backend for optimal performance
- **ACID + Vector Hybrid**: Immutable conversation history + searchable memory index (linked via conversationRef)
- **Any Convex deployment**: Works with Convex Cloud, localhost, or self-hosted infrastructure
- **Embedding-agnostic**: Optional embeddings from any provider (OpenAI, Cohere, local models)
- **Progressive enhancement**: Works with raw content (text search) or embeddings (semantic search)
- **Hybrid agents**: Start simple with string IDs, add structure when needed
- **Flexible dimensions**: Support for any vector dimension (768, 1536, 3072+)
- **Your data, your instance**: Whether direct or cloud mode, data lives in your Convex deployment
- **Same API**: Switch between direct and cloud mode with a config change

## 📖 Documentation

- [Getting Started](./docs/01-getting-started/01-introduction.md)
- [Core Concepts](./docs/01-getting-started/04-core-concepts.md)
- [API Reference](./docs/03-api-reference/01-overview.md)
- [Architecture](./docs/04-architecture/01-system-overview.md)
- [Recipes & Examples](./docs/06-recipes/01-simple-chatbot.md)
- [Migration Guides](./docs/09-migration-guides/01-from-constellation.md)

## 🤝 Integration Examples

### LangChain
```typescript
import { CortexMemory } from '@cortex/memory/langchain';

const memory = new CortexMemory({
  cortex,
  agentId: 'langchain-agent',
});

// Use with any LangChain chain
const chain = new ConversationChain({ memory });
```

### Vercel AI SDK
```typescript
import { cortexMiddleware } from '@cortex/memory/vercel-ai';

export const POST = cortexMiddleware(async (req) => {
  const { messages } = await req.json();
  // Cortex automatically stores and retrieves context
});
```

### OpenAI Assistants
```typescript
import { cortexVectorStore } from '@cortex/memory/openai';

const assistant = await openai.beta.assistants.create({
  model: 'gpt-4',
  tools: [{ type: 'retrieval' }],
  file_ids: await cortexVectorStore.syncToOpenAI(cortex, 'agent-1'),
});
```

## 🌟 Use Cases

- **Chatbots** - Remember user preferences and conversation history
- **Multi-agent Systems** - Coordinate between specialized agents
- **RAG Pipelines** - Store and retrieve relevant context for LLM prompts
- **Customer Support** - Maintain customer context across interactions
- **Personal Assistants** - Long-term memory of user preferences and habits
- **Knowledge Management** - Organizational memory across teams

## 🔒 Security & Privacy

- **Data Isolation**: Each agent's memories are completely isolated
- **Your Infrastructure**: Deploy to your own Convex instance
- **No External Calls**: Cortex never sends data outside your Convex deployment
- **Flexible Access Control**: Implement your own auth layer on top

## 📊 Comparison

| Feature | Cortex | Pinecone | Weaviate | Redis |
|---------|--------|----------|----------|-------|
| Vector Search | ✅ | ✅ | ✅ | ❌ |
| ACID Transactions | ✅ | ❌ | ❌ | ❌ |
| Real-time Updates | ✅ | ❌ | ❌ | ✅ |
| Automatic Versioning | ✅ | ❌ | ❌ | ❌ |
| Temporal Queries | ✅ | ❌ | ❌ | ❌ |
| Serverless | ✅ | ✅ | ❌ | ❌ |
| Context Chains | ✅ | ❌ | ❌ | ❌ |
| Agent Management | ✅ | ❌ | ❌ | ❌ |
| User Profiles | ✅ | ❌ | ❌ | ❌ |
| Open Source Core | ✅ | ❌ | ✅ | ✅ |
| Self-Hostable | ✅ | ❌ | ✅ | ✅ |
| Managed Option | 🔜 | ✅ | ✅ | ✅ |
| All-in-One | ✅ | ❌ | ❌ | ❌ |

> **Note**: Cortex is built on [Convex](https://convex.dev), leveraging their reactive backend for optimal performance.

## 🎯 Deployment Modes

### When to Use Each Mode

**Direct Mode** is perfect for:
- 🚀 Getting started quickly
- 🧪 Prototyping and experimentation
- 🏠 Self-managed deployments
- 💰 Cost-sensitive projects
- 🔓 Maximum control and transparency

**Cloud Mode** is designed for:
- 📊 Teams needing analytics and insights
- 🎯 Production deployments requiring observability
- 👥 Multi-agent systems with complex coordination
- 💼 Enterprise features (SSO, audit logs, SLA)
- 🚀 Organizations wanting managed optimization

> **Important**: Both modes work with any Convex deployment (Convex Cloud, localhost, or self-hosted). Your data always stays in your Convex instance - Cortex Cloud only provides management tools and analytics.

## 🛠️ Development

```bash
# Clone the repository
git clone https://github.com/SaintNick1214/cortex.git
cd cortex

# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed development guidelines.

## 📄 License

**Open Source Core**: Apache License 2.0
- The Cortex SDK is and will remain open source
- Free for commercial use
- Includes explicit patent grant and protection
- See [LICENSE.md](./LICENSE.md) for details

**Cortex Cloud**: Commercial service (coming soon)
- Optional managed features and analytics
- Free tier available
- Pay for advanced features and support

**Why Apache 2.0?**
- Aligns with Convex (also Apache 2.0)
- Explicit patent protection for users and contributors
- Enterprise-friendly and legally clear
- Same permissiveness as MIT with better legal protections

Copyright © 2025 Nicholas Geil / Saint Nick LLC

## 🙏 Acknowledgments

Cortex is built on the shoulders of giants:
- [Convex](https://convex.dev) - The reactive backend platform
- [Project Constellation](https://github.com/yourusername/constellation) - The original inspiration
- The open source AI community

## 🚦 Status

**Current Version**: 0.1.0 (Early Development)

Cortex is in active development. We're building in public and iterating on the architecture based on community feedback.

**What's Available:**
- ✅ Core architecture and documentation
- ✅ Open source SDK design (in progress)
- 🔜 Direct mode implementation
- 🔜 Cloud mode infrastructure
- 🔜 First beta release

**Roadmap:**
- **Q4 2025**: Open source SDK beta (direct mode)
- **Q1 2026**: Cortex Cloud private beta
- **Q2 2026**: Public launch
- **Q3 2026**: Enterprise features

Join our [Discord](https://discord.gg/cortex) to follow development and provide input!

## 💬 Community

- [Discord](https://discord.gg/cortex) - Chat with the community
- [GitHub Discussions](https://github.com/yourusername/cortex/discussions) - Ask questions, share ideas
- [Twitter](https://twitter.com/cortexmemory) - Follow for updates

## 📮 Support

- 📧 Email: support@cortexmemory.dev
- 🐛 Issues: [GitHub Issues](https://github.com/yourusername/cortex/issues)
- 📖 Docs: [Documentation](./docs/00-README.md)

---

**Built with ❤️ for the AI agent community**

