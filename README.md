# Cortex

> **Plug'n'play persistent memory for AI agents, powered by Convex**

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Convex](https://img.shields.io/badge/Powered%20by-Convex-purple.svg)](https://convex.dev)
[![Status](https://img.shields.io/badge/Status-In%20Development-yellow.svg)](https://github.com/SaintNick1214/cortex/discussions)
[![Socket Badge](https://badge.socket.dev/npm/package/@cortexmemory/sdk/0.3.1)](https://badge.socket.dev/npm/package/@cortexmemory/sdk/0.3.1)

## 🚧 Project Status: In Active Development

**Cortex is currently in the design and early implementation phase.** We're building a production-ready memory system for AI agents, and we're doing it in public!

**What this means:**

- 📝 Architecture and documentation are actively being refined
- 💻 Core SDK implementation is in progress
- 🎯 API design is stabilizing but may still change
- 🤝 Community input is shaping the direction

**Want to contribute or follow along?**

- 💬 [GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions) - Share ideas, ask questions, propose features
- 🐛 [GitHub Issues](https://github.com/SaintNick1214/cortex/issues) - Report bugs, request features, track progress
- 📖 [Documentation](./Documentation/00-README.md) - In-depth architecture and design decisions

---

## 🎯 The Vision

Cortex brings enterprise-grade persistent memory to any AI agent system. Built on Convex, it provides flexible, scalable memory that works with any LLM or framework.

**The Problem We're Solving:**

Traditional memory solutions force you to choose between vector databases (Pinecone, Weaviate) or simple storage (Redis), manage complex infrastructure, write custom multi-agent coordination logic, and handle user profiles separately. It's fragmented, complex, and time-consuming.

**The Cortex Solution:**

A unified memory system that gives you everything in one package - production-ready memory that scales automatically, works with any LLM framework, supports any embedding provider, and requires zero infrastructure management.

## ✨ Planned Features

These are the features we're building into Cortex:

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
- 🕸️ **Graph-Lite Queries** - Built-in graph-like traversals and relationship queries
- 🧠 **Fact Extraction** - LLM-powered fact extraction for 60-90% storage savings (optional)
- 🔌 **MCP Server** - Cross-application memory sharing (Cursor, Claude, custom tools)
- 📊 **Optional Graph DB** - Integrate Neo4j, Memgraph, or Kùzu for advanced graph queries

## 🏗️ Architecture Overview

Cortex is being designed with two deployment modes:

### Direct Mode (Open Source)

```
┌─────────────────────────────────────────────────────┐
│                   Your Application                  │
│         (Next.js, Express, LangChain, etc.)         │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│            Cortex SDK (Open Source)                 │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐  │
│  │    Memory    │  │   Context    │  │   User    │  │
│  │  Operations  │  │    Chains    │  │ Profiles  │  │
│  └──────────────┘  └──────────────┘  └───────────┘  │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│            Your Convex Instance                     │
│  • Convex Cloud (managed)                           │
│  • Self-hosted (local or your infrastructure)       │
└─────────────────────────────────────────────────────┘
```

**Perfect for:** Getting started, prototyping, and self-managed deployments.

### Cloud Mode (Managed Service)

```
┌─────────────────────────────────────────────────────┐
│                   Your Application                  │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│            Cortex SDK (same code!)                  │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│               Cortex Cloud API                      │
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

**Perfect for:** Production deployments with advanced management and analytics.

### Key Design Decisions

- **Built on Convex**: Leverages Convex's reactive backend for optimal performance
- **ACID + Vector Hybrid**: Immutable conversation history + searchable memory index (linked via conversationRef)
- **Any Convex deployment**: Works with Convex Cloud, localhost, or self-hosted infrastructure
- **Embedding-agnostic**: Optional embeddings from any provider (OpenAI, Cohere, local models)
- **Progressive enhancement**: Works with raw content (text search) or embeddings (semantic search)
- **Hybrid agents**: Start simple with string IDs, add structure when needed
- **Flexible dimensions**: Support for any vector dimension (768, 1536, 3072+)
- **Your data, your instance**: Whether direct or cloud mode, data lives in your Convex deployment

## 🌟 Planned Use Cases

- **Chatbots** - Remember user preferences and conversation history
- **Multi-agent Systems** - Coordinate between specialized agents
- **RAG Pipelines** - Store and retrieve relevant context for LLM prompts
- **Customer Support** - Maintain customer context across interactions
- **Personal Assistants** - Long-term memory of user preferences and habits
- **Knowledge Management** - Organizational memory across teams

## 📊 How Cortex Compares

| Feature           | Cortex | Pinecone | Weaviate | Redis |
| ----------------- | ------ | -------- | -------- | ----- |
| Vector Search     | ✅     | ✅       | ✅       | ❌    |
| ACID Transactions | ✅     | ❌       | ❌       | ❌    |
| Real-time Updates | ✅     | ❌       | ❌       | ✅    |
| Versioning        | ✅     | ❌       | ❌       | ❌    |
| Temporal Queries  | ✅     | ❌       | ❌       | ❌    |
| Serverless        | ✅     | ✅       | ❌       | ❌    |
| Context Chains    | ✅     | ❌       | ❌       | ❌    |
| Agent Management  | ✅     | ❌       | ❌       | ❌    |
| User Profiles     | ✅     | ❌       | ❌       | ❌    |
| Open Source Core  | ✅     | ❌       | ✅       | ✅    |
| Self-Hostable     | ✅     | ❌       | ✅       | ✅    |
| All-in-One        | ✅     | ❌       | ❌       | ❌    |

## 📖 Documentation

Dive deep into our architecture and design decisions:

- [Documentation Home](./Documentation/00-README.md)
- [Getting Started Guide](./Documentation/01-getting-started/01-introduction.md)
- [Core Concepts](./Documentation/01-getting-started/04-core-concepts.md)
- [API Reference](./Documentation/03-api-reference/01-overview.md)
- [System Architecture](./Documentation/04-architecture/01-system-overview.md)
- [Recipes & Examples](./Documentation/06-recipes/01-simple-chatbot.md)
- [Migration from Constellation](./Documentation/09-migration-guides/01-from-constellation.md)

## 🤝 Get Involved

We're building Cortex in public and would love your input!

### 💬 Join the Conversation

- **[GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions)** - Best for:
  - 💡 Sharing feature ideas and use cases
  - 🤔 Asking questions about architecture decisions
  - 📣 Providing feedback on the API design
  - 🎯 Discussing roadmap priorities

- **[GitHub Issues](https://github.com/SaintNick1214/cortex/issues)** - Best for:
  - 🐛 Reporting bugs (when we have code to break!)
  - ✨ Requesting specific features
  - 📝 Tracking development progress
  - 🔍 Following implementation work

### 🛠️ Ways to Contribute

1. **Share Your Use Case** - Tell us how you'd use Cortex in your AI agent system
2. **Review the Architecture** - Check our docs and provide feedback on the design
3. **Propose Features** - What would make Cortex perfect for your needs?
4. **Test Early Builds** - Try out alpha/beta releases and report issues
5. **Improve Documentation** - Help us make the docs clearer and more comprehensive
6. **Spread the Word** - Star the repo, share with others building AI agents

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed contribution guidelines.

## 🚦 Development Roadmap

**Current Phase: Foundation (Q4 2025)**

- ✅ Core architecture design
- ✅ Documentation framework
- 🔄 Convex schema implementation
- 🔄 Core SDK development
- 🔜 Unit test framework
- 🔜 Integration tests

**Next Phases:**

- **Q1 2026**: Alpha release (Direct Mode)
  - Core memory operations working
  - Basic agent management
  - Essential documentation
  - Developer preview for feedback

- **Q2 2026**: Beta release
  - Full Direct Mode implementation
  - Context chains and user profiles
  - Integration examples (LangChain, Vercel AI SDK)
  - Production-ready documentation

- **Q3 2026**: v1.0 Public Launch
  - Stable API
  - Comprehensive test coverage
  - Performance optimization
  - Migration tools

- **Q4 2026**: Cloud Mode Preview
  - Analytics and insights
  - Team management features
  - Advanced monitoring
  - Enterprise features

**Follow our progress:**

- Check [Project Boards](https://github.com/SaintNick1214/cortex/projects) for current work
- Read [Development Updates](https://github.com/SaintNick1214/cortex/discussions/categories/announcements) for milestone announcements
- Join [Discord](https://discord.gg/cortex) for real-time development chat (coming soon)

## 🔒 Security & Privacy

- **Data Isolation**: Each agent's memories are completely isolated
- **Your Infrastructure**: Deploy to your own Convex instance
- **No External Calls**: Cortex never sends data outside your Convex deployment
- **Flexible Access Control**: Implement your own auth layer on top
- **Open Source Core**: Audit the code yourself - full transparency

## 📦 Publishing Releases

Cortex SDK uses **dual release workflows**:

**🤖 Automated** (Production - recommended):

- Bump version in `package.json` → Push to `main` → GitHub Action publishes automatically
- Full details: [RELEASE-GUIDE.md](./RELEASE-GUIDE.md)

**💻 Manual** (Beta/hotfix - full control):

- Run `npm run release` for interactive publishing
- See: [scripts/release.ps1](./scripts/release.ps1)

**Setup**: [.github/SETUP-AUTOMATED-RELEASES.md](.github/SETUP-AUTOMATED-RELEASES.md)

## 🎯 Why Cortex?

### Unique Differentiators

**🚀 Infinite Context**

- Never run out of context again
- Recall from millions of past messages via retrieval
- Up to 99% token reduction vs traditional accumulation
- Works with any LLM (smaller models perform like SOTA with perfect memory)

**🐝 Hive Mode**

- Multiple AI tools share one memory space
- Zero duplication (Cursor + Claude + custom tools)
- Cross-application memory via MCP
- Your memory follows you everywhere

**🏢 Enterprise-Ready**

- Complete ACID audit trails
- Automatic versioning (temporal queries)
- One-click GDPR cascade deletion
- Governance policies built-in

**🤝 Multi-Agent Orchestration**

- Context Chains for workflow coordination
- A2A communication protocol
- Hive Mode (shared space) OR Collaboration Mode (separate spaces)
- Flexible isolation models

**🔧 Developer Experience**

- Single database (Convex - no polyglot complexity)
- Framework-agnostic (LangChain, Vercel AI, custom)
- Embedding-agnostic (OpenAI, Cohere, local models)
- TypeScript-first with full type safety

**📊 Unified Architecture**

- 4-layer design (ACID + Vector + Facts + Convenience)
- Graph-Lite built-in, native graph DB optional
- Facts extraction (DIY or Cloud auto)
- All data in one place (Convex)

## 📄 License

**Open Source Core**: Apache License 2.0

- The Cortex SDK is and will remain open source
- Free for commercial use
- Includes explicit patent grant and protection
- See [LICENSE.md](./LICENSE.md) for details

**Cortex Cloud**: Commercial service (future)

- Optional managed features and analytics
- Free tier planned
- Pay only for advanced features and support

**Why Apache 2.0?**

- Aligns with Convex (also Apache 2.0)
- Explicit patent protection for users and contributors
- Enterprise-friendly and legally clear
- Same permissiveness as MIT with better legal protections

## 🙏 Acknowledgments

Cortex is built on the shoulders of giants:

- [Convex](https://convex.dev) - The reactive backend platform powering Cortex
- [Project Constellation](https://github.com/SaintNick1214/constellation) - The original inspiration for this system
- The open source AI community - For pushing the boundaries of what's possible

## 🎯 Origin Story

Cortex was born out of building [Project Constellation](https://github.com/SaintNick1214/constellation), an enterprise multi-agent AI system for Microsoft Teams. While building Constellation, we realized the memory system we needed didn't exist - so we're extracting and open-sourcing it as Cortex.

**What makes Cortex different:**

- Designed for real-world production use (not a prototype)
- Battle-tested patterns from building multi-agent systems
- Built by developers who needed it, for developers who need it
- Focus on developer experience and simplicity

## 📮 Contact & Support

- 📧 Email: support@cortexmemory.dev
- 💬 Discussions: [GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions)
- 🐛 Issues: [GitHub Issues](https://github.com/SaintNick1214/cortex/issues)
- 📖 Docs: [Documentation](./Documentation/00-README.md)
- 🐦 Twitter: [@cortexmemory](https://twitter.com/cortexmemory) (coming soon)

---

<div align="center">

**⭐ Star this repo to follow our progress ⭐**

Built with ❤️ for the AI agent community by [Nicholas Geil](https://github.com/SaintNick1214) / [Saint Nick LLC](https://saintnick.ai)

_Cortex is in active development. Join [Discussions](https://github.com/SaintNick1214/cortex/discussions) to shape the future of AI agent memory._

</div>
