# Introduction to Cortex

> **Last Updated**: 2025-01-29

## Welcome to Cortex

Cortex is a plug'n'play persistent memory system for AI agents, powered by Convex. It brings enterprise-grade memory capabilities to any AI application, allowing your agents to remember, learn, and build context over time.

## The Problem

Building AI agents with persistent memory is **hard**:

### Traditional Approaches Fall Short

**Vector Databases (Pinecone, Weaviate, Qdrant)**
- ❌ Only handle embeddings, not complete memory systems
- ❌ Require separate infrastructure for user data, conversations, metadata
- ❌ Complex to set up and manage
- ❌ No built-in agent coordination or context chains
- ❌ Expensive at scale

**Simple Storage (Redis, PostgreSQL)**
- ❌ No semantic search capabilities
- ❌ Manual implementation of memory retrieval logic
- ❌ No agent-specific memory isolation
- ❌ Limited to keyword search
- ❌ Requires custom indexing and optimization

**LLM Framework Memory (LangChain, LlamaIndex)**
- ❌ Tightly coupled to specific frameworks
- ❌ Limited persistence options
- ❌ Basic memory strategies only
- ❌ No multi-agent coordination
- ❌ Difficult to migrate between frameworks

**Custom Solutions**
- ❌ Weeks or months of development time
- ❌ Ongoing maintenance burden
- ❌ Hard to scale and optimize
- ❌ Difficult to get right (edge cases, performance, security)
- ❌ Reinventing the wheel for every project

### What Developers Really Need

AI agents need memory that is:

1. **Flexible** - Remember anything without predefined schemas
2. **Persistent** - Never forget, survive restarts and deployments
3. **Isolated** - Each agent has private, secure storage
4. **Searchable** - Find relevant memories using semantic search
5. **Fast** - Sub-second retrieval even with millions of memories
6. **Scalable** - Grow from prototype to millions of users
7. **Simple** - Plug in and start using in minutes, not weeks
8. **Framework-agnostic** - Work with any LLM or AI framework

## The Cortex Solution

Cortex solves all these problems with a single, unified system:

```typescript
// That's it - full persistent memory in 3 lines
const cortex = new Cortex({ convexUrl: process.env.CONVEX_URL });

await cortex.memory.store('agent-1', {
  content: 'User prefers dark mode',
  embedding: await getEmbedding('User prefers dark mode'),
  metadata: { importance: 'high', tags: ['preferences'] }
});

const memories = await cortex.memory.search('agent-1', 
  'what are the user preferences?'
);
```

### Key Capabilities

**🧠 Flexible Memory**
- Remember ANY information without hardcoded topics or schemas
- No predefined categories - agents learn naturally
- Store text, embeddings, metadata, and relationships

**🔒 Private Memory Banks**
- Complete isolation between agents
- Each agent has its own secure storage
- No accidental data leakage

**♾️ Long-term Persistence**
- Memories last forever (no automatic expiration)
- Survive restarts, deployments, and migrations
- Built on Convex's durable backend

**🔍 Semantic Search**
- AI-powered understanding, not just keyword matching
- Multi-strategy retrieval with intelligent fallbacks
- Support for any embedding model (OpenAI, Cohere, local)

**📊 Flexible Vector Dimensions**
- Support 768, 1536, 3072, or any custom dimension
- Choose the right model for your performance/accuracy tradeoff
- Per-memory-entry flexibility

**🔗 Context Chains**
- Hierarchical context sharing for multi-agent systems
- Manager agents can see subordinate contexts
- No information silos

**👥 User Profiles**
- Rich user context and preferences
- Cross-conversation memory
- Personalization support

**📈 Built-in Analytics**
- Track memory access patterns
- Understand what agents remember most
- Optimize based on usage data

**🎯 Hybrid Agent Management**
- Start simple with string IDs
- Add optional registry for advanced features
- Progressive enhancement as your system grows

**🚀 Zero Infrastructure**
- No servers to manage
- Automatic scaling
- Deploy to your own Convex instance
- Pay only for what you use

## Why Cortex?

### Built on Convex

Cortex leverages [Convex](https://convex.dev), a reactive backend platform that provides:

- **ACID Transactions** - Your data is always consistent
- **Real-time Updates** - Changes propagate instantly
- **Vector Search** - Built-in support for embeddings
- **Serverless** - Scales automatically, pay per use
- **Type-safe** - Full TypeScript support
- **Developer Experience** - Hot reload, time travel debugging

**Flexible Deployment**: Cortex works with Convex however you run it:
- ☁️ **Convex Cloud** (recommended) - Fully managed, no ops required
- 💻 **Local Development** - `npx convex dev` for fast iteration
- 🏢 **Self-Hosted** - Deploy Convex to your own infrastructure

### Embedding-Agnostic

Unlike vector databases that lock you into their ecosystem, Cortex is **embedding-agnostic**:

```typescript
// Use OpenAI
const embedding = await openai.embeddings.create({
  model: 'text-embedding-3-large',
  input: text
});

// Or Cohere
const embedding = await cohere.embed({
  texts: [text],
  model: 'embed-english-v3.0'
});

// Or local models
const embedding = await localModel.encode(text);

// Cortex doesn't care - just store it
await cortex.memory.store(agentId, {
  content: text,
  embedding: embedding.data[0].embedding
});
```

### Framework-Agnostic

Works with any AI framework:

- **LangChain** - Drop-in memory replacement
- **Vercel AI SDK** - Middleware for automatic memory
- **LlamaIndex** - Compatible storage backend
- **OpenAI Assistants** - Vector store integration
- **Custom** - Use the core API directly

### Open Source

Cortex is MIT licensed:

- ✅ Free for commercial use
- ✅ Modify and distribute freely
- ✅ No vendor lock-in
- ✅ Community-driven development
- ✅ Transparent roadmap

## Design Principles

Cortex is built on these core principles:

### 1. Developer Experience First

Every API is designed to be:
- **Intuitive** - Works the way you expect
- **Typed** - Full TypeScript support
- **Documented** - Clear examples and guides
- **Debuggable** - Helpful error messages

### 2. Progressive Enhancement

Start simple, add complexity when needed:

```typescript
// Day 1: Simple usage (direct mode)
await cortex.memory.store('my-agent', { content: '...' });

// Day 30: Add structure when it helps
await cortex.agents.register({
  id: 'my-agent',
  metadata: { team: 'support', capabilities: [...] }
});

// Day 90: Upgrade to cloud mode for analytics
const insights = await cortex.analytics.getAgentInsights('my-agent');
```

### 3. No Opinions on Embeddings

You choose:
- Which embedding model to use
- When to generate embeddings
- How to optimize for your use case

Cortex just stores and retrieves - you control the AI.

### 4. Data Ownership

Your data, your infrastructure:
- Data stays in your Convex account (both modes)
- No external data processing
- Full control and compliance
- You manage access and security

### 5. Two Deployment Options

**Direct Mode (Open Source)**
- Connect directly to your Convex instance
- Full functionality
- Self-managed
- Free forever

**Cloud Mode (Managed Service)**
- Additional analytics and insights
- Team collaboration features
- Optimization recommendations
- Priority support
- Built on top of your Convex instance

### 6. Production-Ready

Built for real applications:
- ACID transactions (via Convex)
- Automatic scaling (via Convex)
- Security best practices
- Comprehensive error handling
- Performance optimization

## Architecture Overview

### Direct Mode (Open Source)

```
┌─────────────────────────────────────────────────────────┐
│                  Your Application                        │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│              Cortex SDK (Open Source)                    │
│  • Memory Operations  • Context Chains                   │
│  • Agent Management   • User Profiles                    │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│              Your Convex Instance                        │
│  (You manage, you pay Convex directly)                  │
└─────────────────────────────────────────────────────────┘
```

### Cloud Mode (Managed Service)

```
┌─────────────────────────────────────────────────────────┐
│                  Your Application                        │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│              Cortex SDK (Same API!)                      │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│              Cortex Cloud Platform                       │
│  • Analytics Dashboard    • Cost Optimization            │
│  • Team Collaboration     • Migration Tools              │
│  • Advanced Features      • Priority Support             │
└───────────────────────┬─────────────────────────────────┘
                        │ (using your credentials)
                        ▼
┌─────────────────────────────────────────────────────────┐
│              Your Convex Instance                        │
│  (Your data stays in your account)                      │
└─────────────────────────────────────────────────────────┘
```

**Key Point**: In both modes, your data lives in your Convex instance. Cortex Cloud adds management tools without moving your data.

## Use Cases

Cortex powers a wide range of AI applications:

### 1. Chatbots & Virtual Assistants
Remember user preferences, conversation history, and context across sessions.

### 2. Customer Support Agents
Maintain customer context, previous interactions, and issue history for personalized support.

### 3. Multi-Agent Systems
Coordinate between specialized agents with hierarchical context sharing.

### 4. RAG Pipelines
Store and retrieve relevant context for language model prompts with semantic search.

### 5. Personal AI Assistants
Long-term memory of user habits, preferences, and information for personalized experiences.

### 6. Knowledge Management
Organizational memory that grows over time, accessible to all agents.

### 7. Code Assistants
Remember project structure, coding preferences, and past solutions.

### 8. Content Generation
Store style guidelines, past content, and user feedback for consistent generation.

## What Cortex Is Not

To set clear expectations:

- **Not an LLM** - Cortex doesn't generate text or embeddings
- **Not a vector database** - It's a complete memory system (uses vector search internally)
- **Not a Convex replacement** - It's built on top of Convex, enhancing it for AI use cases
- **Not framework-specific** - Works with any AI framework
- **Not opinionated about AI** - You choose your models and strategies
- **Not a data host** - Your data stays in your Convex instance (even in cloud mode)

## Getting Started

Ready to add persistent memory to your AI agents?

1. **[Install Cortex](./02-installation.md)** - Get set up in 5 minutes
2. **[Quick Start](./03-five-minute-quickstart.md)** - Build your first memory-enabled agent  
3. **[Core Concepts](./04-core-concepts.md)** - Understand how Cortex works
4. **[Recipes](../06-recipes/01-simple-chatbot.md)** - See real-world examples

> **Note**: Cortex is in early development. The open source SDK (direct mode) is being built first, with cloud mode features coming later based on community feedback.

## Community & Support

Join the Cortex community:

- **[Discord](https://discord.gg/cortex)** - Chat with developers
- **[GitHub Discussions](https://github.com/yourusername/cortex/discussions)** - Ask questions
- **[Twitter](https://twitter.com/cortexmemory)** - Follow updates
- **[Email](mailto:hello@cortexmemory.dev)** - Direct support

## Next Steps

Continue to [Installation](./02-installation.md) to get Cortex running in your project →

---

**Questions?** Check out the [FAQ](../11-reference/01-faq.md) or join our [Discord](https://discord.gg/cortex).

