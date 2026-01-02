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
- **[Auth Integration](./01-getting-started/06-auth-integration.md)** - Authentication setup and patterns

### ✨ Core Features

Deep dives into Cortex capabilities:

- **[Memory Orchestration](./02-core-features/00-memory-orchestration.md)** - Automatic entity registration and coordination
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
- **[Streaming Support](./02-core-features/12-streaming-support.md)** - Native LLM response streaming with auto-storage
- **[Resilience Layer](./02-core-features/13-resilience-layer.md)** - Rate limiting, circuit breakers, and overload protection
- **[Sessions Management](./02-core-features/14-sessions-management.md)** - Multi-session tracking and isolation
- **[Governance Policies](./02-core-features/15-governance-policies.md)** - Retention policies and compliance controls
- **[Graph Integration](./02-core-features/16-graph-integration.md)** - Graph database capabilities and patterns
- **[Isolation Boundaries](./02-core-features/17-isolation-boundaries.md)** - Security model and data separation
- **[Authentication](./02-core-features/18-authentication.md)** - Authentication patterns and best practices

### 📖 API Reference

Complete API documentation (organized by architectural layers):

**Getting Started:**

- **[Overview](./03-api-reference/01-overview.md)** - API conventions and patterns

**Core Memory System (Layers 1-3):**

- **[Memory Operations](./03-api-reference/02-memory-operations.md)** - Layer 3 convenience + Layers 1-2 overview
- **[Conversation Operations](./03-api-reference/03-conversation-operations.md)** - Layer 1a: ACID conversations

**User & Coordination:**

- **[User Operations](./03-api-reference/04-user-operations.md)** - User profiles + GDPR cascade
- **[Agent Management](./03-api-reference/09-agent-management.md)** - Agent registry + cleanup
- **[Context Operations](./03-api-reference/05-context-operations.md)** - Workflow coordination
- **[A2A Communication](./03-api-reference/06-a2a-communication.md)** - Agent messaging patterns

**Advanced Storage (Layer 1b-c):**

- **[Immutable Store](./03-api-reference/07-immutable-store-api.md)** - Layer 1b: Shared versioned data
- **[Mutable Store](./03-api-reference/08-mutable-store-api.md)** - Layer 1c: Shared live data

**Supporting APIs:**

- **[Governance Policies](./03-api-reference/10-governance-policies-api.md)** - Retention and compliance
- **[Memory Space Operations](./03-api-reference/11-memory-space-operations.md)** - Hive/Collaboration Mode management
- **[Facts Operations](./03-api-reference/12-facts-operations.md)** - Structured knowledge extraction and storage
- **[Graph Operations](./03-api-reference/13-graph-operations.md)** - Graph database integration
- **[Sessions Operations](./03-api-reference/14-sessions-operations.md)** - Session lifecycle and management
- **[Auth Context API](./03-api-reference/15-auth-context-api.md)** - Authentication context and user identity

**Reference:**

- **[Types & Interfaces](./05-reference/01-types-interfaces.md)** - TypeScript definitions
- **[Error Handling](./05-reference/02-error-handling.md)** - Error codes and debugging

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
- **[Infinite Context](./04-architecture/10-infinite-context.md)** - Unlimited context window capabilities

### 🔧 Tools

Command-line tools and utilities:

- **[CLI Reference](./06-tools/01-cli-reference.md)** - Complete Cortex CLI documentation
  - Project initialization and lifecycle (`cortex init`, `cortex dev`)
  - Configuration and deployment management
  - Data operations (memory, users, spaces, facts, conversations)
  - Database operations (backup, restore, statistics)
  - Development utilities and debugging

### 🔗 Integrations

Framework and tool integrations:

**Production Ready:**

- **[Vercel AI SDK](./08-integrations/vercel-ai-sdk/00-README.md)** - Complete Next.js integration with quickstart demo
  - [Getting Started](./08-integrations/vercel-ai-sdk/01-getting-started.md) - Installation and quickstart
  - [API Reference](./08-integrations/vercel-ai-sdk/02-api-reference.md) - Complete API documentation
  - [Advanced Usage](./08-integrations/vercel-ai-sdk/03-advanced-usage.md) - Advanced patterns and techniques
  - [Memory Spaces](./08-integrations/vercel-ai-sdk/04-memory-spaces.md) - Isolation and collaboration modes
  - [Hive Mode](./08-integrations/vercel-ai-sdk/05-hive-mode.md) - Multi-agent coordination
  - [Migration from mem0](./08-integrations/vercel-ai-sdk/06-migration-from-mem0.md) - Migration guide
  - [Troubleshooting](./08-integrations/vercel-ai-sdk/07-troubleshooting.md) - Common issues and solutions

**Integration Guides:**

- **[Authentication Providers](./08-integrations/01-auth-providers.md)** - DIY patterns for Auth0, Clerk, NextAuth, Firebase

**Planned:**

- LangChain.js, LlamaIndex.TS, MCP Servers

### 🎓 Advanced Topics

Expert-level content:

**Graph Capabilities:**

- **[Graph Capabilities](./07-advanced-topics/01-graph-capabilities.md)** - Complete graph integration overview
- **[Graph Database Integration](./07-advanced-topics/02-graph-database-integration.md)** - Complete integration guide for Neo4j, Memgraph

**Storage & Monitoring:**

- **[Facts vs Conversations](./07-advanced-topics/03-facts-vs-conversations.md)** - Storage strategy trade-offs and efficiency
- **[Orchestration Observer](./07-advanced-topics/04-orchestration-observer.md)** - System monitoring and observability

## 🎯 Quick Links

### I want to...

- **Start from scratch** → [Install CLI](./01-getting-started/02-installation.md) and run `cortex init`
- **See a working example** → Run the [Vercel AI Quickstart](./08-integrations/vercel-ai-sdk/01-getting-started.md#quickstart-demo)
- **Understand concepts** → [Core Concepts](./01-getting-started/04-core-concepts.md)
- **Learn the CLI** → [CLI Reference](./06-tools/01-cli-reference.md)
- **Use the SDK** → [Memory Operations API](./03-api-reference/02-memory-operations.md)
- **Set up authentication** → [Auth Integration](./01-getting-started/06-auth-integration.md)
- **Enable graph database** → [Graph Capabilities](./07-advanced-topics/01-graph-capabilities.md)

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

1. **Search Docs** - Use the search functionality in your editor
2. **GitHub Discussions** - Ask the community
3. **Email** - Contact support@cortexmemory.dev

## 🐛 Found an Issue?

Documentation problems? Please help us improve:

1. **Typo or minor fix** - Submit a PR directly
2. **Missing content** - Open an issue describing what's needed
3. **Confusing section** - Tell us what's unclear
4. **Wrong information** - Please report immediately

## 🌟 What's New?

Recent releases:

- **2025-12-18**: 🎉 **v0.21.0 - CLI-First Installation**
  - New `cortex init` command for project initialization
  - Interactive dev mode with live dashboard (`cortex dev`)
  - Multi-deployment management (`cortex use`, `cortex config list`)
  - Graph database setup integrated into init wizard

- **2025-12-01**: 🎉 **v0.16.0 - Resilience Layer**
  - Built-in protection against server overload
  - Token bucket rate limiting, concurrency control, priority queues
  - Circuit breaker pattern with automatic recovery
  - Tuned for [Convex platform limits](https://docs.convex.dev/production/state/limits)
  - Presets for different use cases (realTimeAgent, batchProcessing, hiveMode)

- **2025-10-31**: 🎉 **v0.7.0 - Graph Database Integration**
  - Complete graph database support (Neo4j, Memgraph)
  - Real-time sync worker with reactive queries
  - syncToGraph option across all APIs
  - Multi-layer context enrichment (2-5x more context!)
  - Sophisticated orphan detection

See the project's [CHANGELOG.md](https://github.com/SaintNick1214/Project-Cortex/blob/main/CHANGELOG.md) for full version history.

## 📄 License

All documentation is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

The Cortex code is licensed under [FSL-1.1-Apache-2.0](https://github.com/SaintNick1214/Project-Cortex/blob/main/LICENSE.md) (becomes Apache 2.0 after 2 years).

---

**Last Updated**: 2026-01-01

---

Ready to get started? Head to [Introduction](./01-getting-started/01-introduction.md) →
