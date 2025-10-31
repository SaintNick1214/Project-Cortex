# Cortex Documentation

> **Complete guide to building AI agents with persistent memory**

Welcome to the Cortex documentation! This guide will help you understand, integrate, and master Cortex in your AI agent systems.

## 📚 Documentation Structure

### 🚀 Getting Started

Start here if you're new to Cortex:

- **[Introduction](./01-getting-started/01-introduction.md)** - Mission, vision, and why Cortex exists
- **[Installation](./01-getting-started/02-installation.md)** - Set up Cortex in your project
- **[Five-Minute Quickstart](./01-getting-started/03-five-minute-quickstart.md)** - Build your first memory-enabled agent
- **[Core Concepts](./01-getting-started/04-core-concepts.md)** - Understand the fundamentals
- **[Configuration](./01-getting-started/05-configuration.md)** - Configure Cortex for your needs

### ✨ Core Features

Deep dives into Cortex capabilities:

- **[Memory Spaces](./02-core-features/01-memory-spaces.md)** - Isolated memory banks for agents
- **[Semantic Search](./02-core-features/02-semantic-search.md)** - AI-powered memory retrieval
- **[User Profiles](./02-core-features/03-user-profiles.md)** - Store and manage user context
- **[Context Chains](./02-core-features/04-context-chains.md)** - Hierarchical agent coordination
- **[A2A Communication](./02-core-features/05-a2a-communication.md)** - Agent-to-agent memory tracking
- **[Conversation History](./02-core-features/06-conversation-history.md)** - Persist message threads
- **[Access Analytics](./02-core-features/07-access-analytics.md)** - Usage patterns and insights
- **[Fact Extraction](./02-core-features/08-fact-extraction.md)** - Storage trade-offs: facts vs conversations
- **[MCP Server](./02-core-features/09-mcp-server.md)** - Cross-application memory sharing
- **[Hive Mode](./02-core-features/10-hive-mode.md)** - Multi-participant agent coordination
- **[Fact Integration](./02-core-features/11-fact-integration.md)** - Automatic fact extraction in Memory API

### 📖 API Reference

Complete API documentation (organized by architectural layers):

**Getting Started:**

- **[Overview](./03-api-reference/01-overview.md)** - API conventions and patterns

**Core Memory System (Layers 1-3):**

- **[Memory Operations](./03-api-reference/02-memory-operations.md)** - Layer 3 convenience + Layers 1-2 overview
- **[Conversation Operations](./03-api-reference/03-conversation-operations.md)** - Layer 1a: ACID conversations

**User & Coordination:**

- **[User Operations](./03-api-reference/04-user-operations.md)** - User profiles + GDPR cascade ✅
- **[Agent Management](./03-api-reference/09-agent-management.md)** - Agent registry + cleanup ✅
- **[Context Operations](./03-api-reference/05-context-operations.md)** - Workflow coordination ✅
- **[A2A Communication](./03-api-reference/06-a2a-communication.md)** - Agent messaging patterns

**Advanced Storage (Layer 1b-c):**

- **[Immutable Store](./03-api-reference/07-immutable-store-api.md)** - Layer 1b: Shared versioned data
- **[Mutable Store](./03-api-reference/08-mutable-store-api.md)** - Layer 1c: Shared live data

**Supporting APIs:**

- **[Governance Policies](./03-api-reference/10-governance-policies-api.md)** - Retention and compliance
- **[Memory Space Operations](./03-api-reference/13-memory-space-operations.md)** - Hive/Collaboration Mode management ✅
- **[Facts Operations](./03-api-reference/14-facts-operations.md)** - Structured knowledge extraction and storage ✅
- **[Graph Operations](./03-api-reference/15-graph-operations.md)** - Graph database integration ✅

**Reference:**

- **[Types & Interfaces](./03-api-reference/11-types-interfaces.md)** - TypeScript definitions
- **[Error Handling](./03-api-reference/12-error-handling.md)** - Error codes and debugging

### 🏗️ Architecture

Understanding how Cortex works:

- **[System Overview](./04-architecture/01-system-overview.md)** - High-level architecture
- **[Data Models](./04-architecture/02-data-models.md)** - Convex schemas and indexes
- **[Convex Integration](./04-architecture/03-convex-integration.md)** - How Cortex uses Convex
- **[Vector Embeddings](./04-architecture/04-vector-embeddings.md)** - Embedding strategy
- **[Search Strategy](./04-architecture/05-search-strategy.md)** - Multi-strategy retrieval
- **[Context Chain Design](./04-architecture/06-context-chain-design.md)** - Context propagation
- **[Agent Registry](./04-architecture/07-agent-registry.md)** - Optional registry architecture
- **[Performance](./04-architecture/08-performance.md)** - Scaling and optimization
- **[Security & Privacy](./04-architecture/09-security-privacy.md)** - Data protection

### 🔗 Integration Guides

Framework-specific integration:

- **[LangChain](./05-integration-guides/01-langchain.md)** - LangChain memory integration
- **[Vercel AI SDK](./05-integration-guides/02-vercel-ai-sdk.md)** - Vercel AI SDK usage
- **[LlamaIndex](./05-integration-guides/03-llamaindex.md)** - LlamaIndex compatibility
- **[OpenAI](./05-integration-guides/04-openai.md)** - OpenAI embeddings + Cortex
- **[Anthropic](./05-integration-guides/05-anthropic.md)** - Claude integration
- **[Next.js](./05-integration-guides/06-nextjs.md)** - Next.js app examples
- **[Express](./05-integration-guides/07-express.md)** - Express REST API
- **[Remix](./05-integration-guides/08-remix.md)** - Remix integration
- **[Custom Frameworks](./05-integration-guides/09-custom.md)** - Roll your own

### 🍳 Recipes

Practical examples and patterns:

- **[Simple Chatbot](./06-recipes/01-simple-chatbot.md)** - Basic chatbot with memory
- **[Multi-Agent System](./06-recipes/02-multi-agent-system.md)** - Agent orchestration
- **[RAG Pipeline](./06-recipes/03-rag-pipeline.md)** - Retrieval-augmented generation
- **[Personalization](./06-recipes/04-personalization.md)** - User-specific experiences
- **[Hierarchical Agents](./06-recipes/05-hierarchical-agents.md)** - Manager-worker patterns
- **[Knowledge Base](./06-recipes/06-knowledge-base.md)** - Shared organizational knowledge
- **[Conversation Summaries](./06-recipes/07-conversation-summaries.md)** - Auto-summarization
- **[Importance Scoring](./06-recipes/08-importance-scoring.md)** - Custom importance logic
- **[Memory Migration](./06-recipes/09-memory-migration.md)** - Import from other systems

### 🎓 Advanced Topics

Expert-level content:

**Graph Capabilities:**

- **[Graph-Lite Traversal](./07-advanced-topics/01-graph-lite-traversal.md)** - Built-in graph queries and relationship navigation
- **[Graph Database Integration](./07-advanced-topics/02-graph-database-integration.md)** - Complete integration guide for Neo4j, Memgraph
- **[Graph Database Selection](./07-advanced-topics/04-graph-database-selection.md)** - Compare graph DB options
- **[Graph Database Setup](./07-advanced-topics/05-graph-database-setup.md)** - ✨ **NEW** Quick setup guide (<5 minutes)

**Storage Optimization:**

- **[Facts vs Conversations](./07-advanced-topics/03-facts-vs-conversations.md)** - Storage strategy trade-offs and efficiency
- **[Dimension Strategies](./07-advanced-topics/02-dimension-strategies.md)** - Choosing vector dimensions and models
- **[Memory Pruning](./07-advanced-topics/04-memory-pruning.md)** - Strategic cleanup (planned)

**Integration & Extensibility:**

- **[Embedding Providers](./07-advanced-topics/01-embedding-providers.md)** - OpenAI, Cohere, local models (planned)
- **[Custom Search Logic](./07-advanced-topics/03-custom-search-logic.md)** - Extend search behavior (planned)
- **[Multi-Tenant](./07-advanced-topics/05-multi-tenant.md)** - Multi-tenant architecture (planned)
- **[Cross-Context Search](./07-advanced-topics/06-cross-context-search.md)** - Search across context chains (planned)
- **[Performance Tuning](./07-advanced-topics/07-performance-tuning.md)** - Query optimization (planned)
- **[Backup & Restore](./07-advanced-topics/08-backup-restore.md)** - Data management (planned)
- **[Extending Cortex](./07-advanced-topics/09-extending-cortex.md)** - Plugin system (planned)

### 🚀 Deployment

Production deployment guides:

- **[Production Checklist](./08-deployment/01-production-checklist.md)** - Pre-launch verification
- **[Convex Setup](./08-deployment/02-convex-setup.md)** - Convex project configuration
- **[Environment Config](./08-deployment/03-environment-config.md)** - Dev vs staging vs prod
- **[Monitoring](./08-deployment/04-monitoring.md)** - Observability and alerts
- **[Cost Optimization](./08-deployment/05-cost-optimization.md)** - Reduce Convex costs
- **[Scaling Guide](./08-deployment/06-scaling-guide.md)** - Scale to millions of users
- **[Disaster Recovery](./08-deployment/07-disaster-recovery.md)** - Backup strategies

### 🔄 Migration Guides

Moving from other solutions:

- **[From Project Constellation](./09-migration-guides/01-from-constellation.md)** - Migrate from Constellation
- **[From LangChain](./09-migration-guides/02-from-langchain.md)** - LangChain memory → Cortex
- **[From Pinecone](./09-migration-guides/03-from-pinecone.md)** - Pinecone → Cortex
- **[From Weaviate](./09-migration-guides/04-from-weaviate.md)** - Weaviate → Cortex
- **[From Redis](./09-migration-guides/05-from-redis.md)** - Redis → Cortex
- **[From Custom Solutions](./09-migration-guides/06-from-custom.md)** - Any system → Cortex

### 🤝 Contributing

Help improve Cortex:

- **[Development Setup](./10-contributing/01-development-setup.md)** - Local dev environment
- **[Code Standards](./10-contributing/02-code-standards.md)** - TypeScript conventions
- **[Testing Guide](./10-contributing/03-testing-guide.md)** - Test requirements
- **[Documentation Guide](./10-contributing/04-documentation-guide.md)** - Writing docs
- **[Release Process](./10-contributing/05-release-process.md)** - Versioning and publishing

### 📚 Reference

Additional resources:

- **[FAQ](./11-reference/01-faq.md)** - Frequently asked questions
- **[Troubleshooting](./11-reference/02-troubleshooting.md)** - Common issues and solutions
- **[Changelog](./11-reference/03-changelog.md)** - Version history
- **[Roadmap](./11-reference/04-roadmap.md)** - Future features
- **[Comparison](./11-reference/05-comparison.md)** - vs Pinecone, Weaviate, etc.
- **[Glossary](./11-reference/06-glossary.md)** - Terms and definitions
- **[Examples Index](./11-reference/07-examples-index.md)** - All code examples

## 🎯 Quick Links

### I want to...

- **Start from scratch** → [Installation](./01-getting-started/02-installation.md)
- **Understand concepts** → [Core Concepts](./01-getting-started/04-core-concepts.md)
- **See code examples** → [Recipes](./06-recipes/01-simple-chatbot.md)
- **Integrate with my framework** → [Integration Guides](./05-integration-guides/01-langchain.md)
- **Deploy to production** → [Production Checklist](./08-deployment/01-production-checklist.md)
- **Migrate from X** → [Migration Guides](./09-migration-guides/01-from-constellation.md)
- **Contribute** → [Development Setup](./10-contributing/01-development-setup.md)
- **Troubleshoot an issue** → [Troubleshooting](./11-reference/02-troubleshooting.md)

## 📖 Documentation Conventions

### Code Examples

All code examples are:

- **Copy-paste ready** - Run them directly
- **TypeScript** - Fully typed
- **Commented** - Explain the "why"
- **Real-world** - Not toy examples

### Callouts

We use special callouts for important information:

> **Note**: General information or tips

> **Warning**: Important caveats or gotchas

> **Danger**: Critical issues that could cause data loss

### Version Indicators

- `v0.1.0+` - Feature available since this version
- `deprecated` - Will be removed in future version
- `experimental` - API may change

## 🆘 Getting Help

Can't find what you need?

1. **Search Docs** - Use the search bar (top right)
2. **Check FAQ** - Common questions answered in [FAQ](./11-reference/01-faq.md)
3. **GitHub Discussions** - Ask the community
4. **Discord** - Real-time help in #help channel
5. **Email** - Contact support@cortexmemory.dev

## 🐛 Found an Issue?

Documentation problems? Please help us improve:

1. **Typo or minor fix** - Submit a PR directly
2. **Missing content** - Open an issue describing what's needed
3. **Confusing section** - Tell us what's unclear
4. **Wrong information** - Please report immediately

See [Documentation Guide](./10-contributing/04-documentation-guide.md) for contribution guidelines.

## 🌟 What's New?

Recent documentation additions:

- **2025-10-31**: 🎉 **v0.7.0 - Graph Database Integration**
  - Complete graph database support (Neo4j, Memgraph)
  - Real-time sync worker with reactive queries
  - syncToGraph option across all APIs
  - Multi-layer context enrichment (2-5x more context!)
  - Sophisticated orphan detection
  - New: [Graph Operations API](./03-api-reference/15-graph-operations.md)
  - New: [Graph Database Setup Guide](./07-advanced-topics/05-graph-database-setup.md)
  - Updated: All API docs with syncToGraph options

- **2025-10-30**: Complete Facts layer integration into Memory API with automatic extraction, cascade delete, and enrichment
- **2025-10-28**: Graph-Lite capabilities, Graph DB integration guides, Fact Extraction, MCP Server documentation
- **2025-10-23**: Initial documentation structure created

See [Changelog](./11-reference/03-changelog.md) for full history.

## 📄 License

All documentation is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

The Cortex code is licensed under [Apache License 2.0](../LICENSE.md).

---

**Last Updated**: 2025-10-31

---

Ready to get started? Head to [Introduction](./01-getting-started/01-introduction.md) →
