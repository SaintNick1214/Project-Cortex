# Cortex

> **Plug'n'play persistent memory for AI agents, powered by Convex**

[License: FSL-1.1-Apache-2.0](https://fsl.software/)
[TypeScript](https://www.typescriptlang.org/)
[Convex](https://convex.dev)
[Status](https://github.com/SaintNick1214/cortex/discussions)

### 🔒 Security Scanning

[CodeQL](https://github.com/SaintNick1214/Project-Cortex/security/code-scanning)
[Semgrep](https://github.com/SaintNick1214/Project-Cortex/actions/workflows/security.yml)
[Trivy](https://github.com/SaintNick1214/Project-Cortex/actions/workflows/security.yml)
[Gitleaks](https://github.com/SaintNick1214/Project-Cortex/actions/workflows/security.yml)
[Bandit](https://github.com/SaintNick1214/Project-Cortex/actions/workflows/security.yml)
[OpenSSF Scorecard](https://scorecard.dev/viewer/?uri=github.com/SaintNick1214/Project-Cortex)

### ✅ Build & Tests

[TypeScript SDK](https://github.com/SaintNick1214/Project-Cortex/actions/workflows/pr-checks.yml)
[Python SDK](https://github.com/SaintNick1214/Project-Cortex/actions/workflows/pr-checks.yml)
[Vercel AI Provider](https://github.com/SaintNick1214/Project-Cortex/actions/workflows/pr-checks.yml)
[Socket.dev](https://socket.dev/npm/package/@cortexmemory/sdk)

**🌐 [cortexmemory.dev](https://cortexmemory.dev) | 📚 [docs.cortexmemory.dev**](https://docs.cortexmemory.dev)

## 🚀 Status: Production Ready

**Cortex v0.27.x is production-ready** with comprehensive features and battle-tested stability.

**What you get:**

- ✅ **Stable APIs** - TypeScript and Python SDKs with consistent interfaces
- ✅ **Comprehensive Testing** - 124 test files with 18,460+ assertions
- ✅ **CLI Tooling** - Complete project management and development workflow
- ✅ **Security Scanning** - CodeQL, Semgrep, Trivy, Gitleaks, Bandit, OpenSSF Scorecard
- ✅ **Production Demo** - Interactive Vercel AI quickstart with live visualization
- ✅ **Complete Documentation** - Getting started guides, API reference, and tutorials

**Ready to use in production.** Join developers building AI agents with persistent memory.

**Want to follow along?**

- 🌐 [cortexmemory.dev](https://cortexmemory.dev) - Official website and project information
- 📚 [docs.cortexmemory.dev](https://docs.cortexmemory.dev) - Complete documentation and guides
- 💬 [GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions) - Share ideas, ask questions, propose features
- 🐛 [GitHub Issues](https://github.com/SaintNick1214/cortex/issues) - Report bugs, request features, track progress

---

## 🎯 The Vision

Cortex brings enterprise-grade persistent memory to any AI agent system. Built on Convex, it provides flexible, scalable memory that works with any LLM or framework.

**The Problem We're Solving:**

Traditional memory solutions force you to choose between vector databases (Pinecone, Weaviate) or simple storage (Redis), manage complex infrastructure, write custom multi-agent coordination logic, and handle user profiles separately. It's fragmented, complex, and time-consuming.

**The Cortex Solution:**

A unified memory system that gives you everything in one package - production-ready memory that scales automatically, works with any LLM framework, supports any embedding provider, and requires zero infrastructure management.

## 🚀 Quick Start

Get started in under 5 minutes:

### Install & Initialize

```bash
# Install CLI
npm install -g @cortexmemory/cli

# Create project
cortex init my-agent

# Start building
cd my-agent
cortex start
```

**What gets set up:**

- ✅ Cortex SDK with TypeScript support
- ✅ Convex backend functions (deployed automatically)
- ✅ Environment configuration (.env.local)
- ✅ Example code to get you started
- ✅ Optional graph database integration
- ✅ Deployment saved to `~/.cortexrc` for CLI management

### 🎬 Try the Interactive Quickstart

**The fastest way to see Cortex in action** - complete working demo:

```bash
# Option 1: Via CLI
cortex init demo --template vercel-ai-quickstart
cd demo && cortex start
# Open http://localhost:3000

# Option 2: From monorepo
cd packages/vercel-ai-provider/quickstart
npm install && npm run dev
```

**See a production-ready chat app featuring:**

- 🔄 Real-time memory orchestration visualization
- 📊 Layer flow diagram (Memory Space → User → Agent → Conversation → Vector → Facts → Graph)
- 🔀 Memory space switching (multi-tenant isolation)
- ⚡ Streaming with progressive storage
- 🧹 Belief revision (facts update when user changes their mind)

### Your First Memory

```typescript
import { Cortex } from "@cortexmemory/sdk";

const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL!,
});

// Store a memory
await cortex.memory.remember({
  memorySpaceId: "user-123-personal",
  conversationId: "conv-1",
  userMessage: "I prefer dark mode",
  agentResponse: "I'll remember that!",
  userId: "user-123",
  userName: "User",
});

// Search your memories
const results = await cortex.memory.search(
  "user-123-personal",
  "what are the user's preferences?",
);
```

**That's it!** Your AI agent now has persistent memory.

**Next steps:** [Getting Started Guide](/getting-started/introduction) | [CLI Reference](/tools/cli-reference)

---

## ✨ Features

Cortex provides a complete memory system for AI agents:

- 🧠 **Flexible Memory** - Remember anything without hardcoded topics or schemas ✅
- 🔒 **Memory Space Isolation** - Flexible boundaries (per user, team, or project) ✅
- ♾️ **Infinite Context** - Never run out via retrieval (up to 99% token reduction) ✅
- 🔍 **Semantic Search** - AI-powered retrieval with multi-strategy fallback ✅
- ⏱️ **Automatic Versioning** - Updates preserve history, never lose data (10 versions default) ✅
- 👥 **User Profiles** - Rich user context with GDPR cascade deletion ✅
- 🐝 **Hive Mode** - Multi-tool memory sharing (MCP ready) ✅
- 🛡️ **Resilience Layer** - Overload protection with circuit breakers ✅
- 🔧 **CLI Tools** - Complete project management (init, start, dev, deploy) ✅
- 📦 **Vercel AI Integration** - Production-ready with interactive demo ✅
- 🔐 **Sessions** - Multi-session tracking with configurable lifecycle ✅
- 📈 **Governance** - Compliance templates (GDPR, HIPAA, SOC2, FINRA) ✅
- 🧠 **Fact Extraction** - LLM-powered extraction for 60-90% storage savings ✅
- 🔄 **Belief Revision** - Intelligent conflict resolution for facts ✅
- ⚡ **Streaming** - Native streaming support with progressive storage ✅
- 🕸️ **Graph Integration** - Optional Neo4j/Memgraph with orphan detection ✅
- 🔗 **Context Chains** - Hierarchical context sharing across memory spaces ✅
- 📊 **Access Analytics** - Built-in statistics and insights ✅
- 🎯 **Agent Registry** - Optional metadata for discovery and cascade cleanup ✅
- 🚀 **Embedding Agnostic** - Works with OpenAI, Cohere, local models, or any provider ✅
- 🔌 **Multi-Tenancy** - Complete tenant isolation with auth context ✅
- ✅ **Client-Side Validation** - Instant error feedback (<1ms) for all APIs ✅

## ✨ Latest Releases

**v0.27.x - Multi-Tenancy & Authentication (Dec 2025 - Jan 2026)**

- Complete auth context with automatic tenantId propagation
- Sessions API with configurable lifecycle
- Multi-session tracking and management
- Vercel AI SDK v6 Agent architecture support

**v0.24.0 - Belief Revision System (Nov 2025)**

- Automatic fact conflict resolution
- Semantic conflict detection
- Intelligent superseding of outdated facts

**v0.21.0 - Memory Orchestration (Oct 2025)**

- Automatic entity registration
- CLI-first onboarding with interactive dev mode
- Multi-deployment management

**v0.16.0 - Resilience Layer (Sep 2025)**

- Production-ready overload protection
- Rate limiting and circuit breakers
- Priority queue for critical operations

See [What's New](/whats-new) for complete release history.

---

## ✨ Key Differentiators

### 🚀 Infinite Context

- Never run out of context again
- Recall from millions of past messages via retrieval
- Up to 99% token reduction vs traditional accumulation
- Works with any LLM (smaller models perform like SOTA with perfect memory)

### 🐝 Hive Mode

- Multiple AI tools share one memory space
- Zero duplication (Cursor + Claude + custom tools)
- Cross-application memory via MCP
- Your memory follows you everywhere

### 🏢 Enterprise-Ready

- Complete ACID audit trails
- Automatic versioning (temporal queries)
- One-click GDPR cascade deletion
- Governance policies built-in

### 🤝 Multi-Agent Orchestration

- Context Chains for workflow coordination
- A2A communication protocol
- Hive Mode (shared space) OR Collaboration Mode (separate spaces)
- Flexible isolation models

### 🔧 Developer Experience

- Single database (Convex - no polyglot complexity)
- Framework-agnostic (LangChain, Vercel AI, custom)
- Embedding-agnostic (OpenAI, Cohere, local models)
- TypeScript-first with full type safety
- CLI-first workflow with interactive dev mode

### 📊 Unified Architecture

- 4-layer hybrid design (ACID + Vector + Facts + Graph)
- Graph-Lite built-in, native Neo4j/Memgraph optional
- Facts extraction (DIY or Cloud auto)
- All data in one place (Convex)

## 🏗️ Architecture Overview

Cortex is designed with two deployment modes:

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

### Cloud Mode (Managed Service - Coming Q3 2026)

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
│            Your Convex Instance                     │
│  • Convex Cloud (managed)                           │
│  • Self-hosted (local or your infrastructure)       │
└─────────────────────────────────────────────────────┘
```

**Perfect for:** Production deployments with advanced management and analytics.

### Key Design Decisions

- **Built on Convex**: Leverages Convex's reactive backend for optimal performance
- **4-Layer Architecture**: ACID conversations + vector search + facts extraction + graph integration (all working together)
- **Any Convex deployment**: Works with Convex Cloud, localhost, or self-hosted infrastructure
- **Embedding-agnostic**: Optional embeddings from any provider (OpenAI, Cohere, local models)
- **Progressive enhancement**: Works with raw content (text search) or embeddings (semantic search)
- **Flexible agents**: Start simple with string IDs, add structure when needed
- **Flexible dimensions**: Support for any vector dimension (768, 1536, 3072+)
- **Your data, your instance**: Whether direct or cloud mode, data lives in your Convex deployment

## 🌟 Use Cases

- **Chatbots** - Remember user preferences and conversation history
- **Multi-agent Systems** - Coordinate between specialized agents
- **RAG Pipelines** - Store and retrieve relevant context for LLM prompts
- **Customer Support** - Maintain customer context across interactions
- **Personal Assistants** - Long-term memory of user preferences and habits
- **Knowledge Management** - Organizational memory across teams

## 📊 How Cortex Compares


| Feature           | Cortex | Pinecone | Weaviate | Redis |
| ----------------- | ------ | -------- | -------- | ----- |
| Vector Search     | ✅      | ✅        | ✅        | ❌     |
| ACID Transactions | ✅      | ❌        | ❌        | ❌     |
| Facts Extraction  | ✅      | ❌        | ❌        | ❌     |
| Graph Integration | ✅      | ❌        | ❌        | ❌     |
| Real-time Updates | ✅      | ❌        | ❌        | ✅     |
| Versioning        | ✅      | ❌        | ❌        | ❌     |
| Temporal Queries  | ✅      | ❌        | ❌        | ❌     |
| Serverless        | ✅      | ✅        | ❌        | ❌     |
| Context Chains    | ✅      | ❌        | ❌        | ❌     |
| Agent Management  | ✅      | ❌        | ❌        | ❌     |
| User Profiles     | ✅      | ❌        | ❌        | ❌     |
| Open Source Core  | ✅      | ❌        | ✅        | ✅     |
| Self-Hostable     | ✅      | ❌        | ✅        | ✅     |
| All-in-One        | ✅      | ❌        | ❌        | ❌     |


## 📖 Documentation

**📚 [docs.cortexmemory.dev**](https://docs.cortexmemory.dev) - Complete documentation, guides, and API reference

### Getting Started

- [Installation Guide](https://docs.cortexmemory.dev/getting-started/installation) - Multiple installation methods
- [Five-Minute Quickstart](https://docs.cortexmemory.dev/getting-started/five-minute-quickstart) - Build your first agent
- [Core Concepts](https://docs.cortexmemory.dev/getting-started/core-concepts) - Understand the fundamentals
- [Configuration](https://docs.cortexmemory.dev/getting-started/configuration) - Customize Cortex

### Reference

- [API Reference](https://docs.cortexmemory.dev/api-reference/overview) - Full API documentation
- [CLI Reference](/tools/cli-reference) - Complete command documentation
- [System Architecture](https://docs.cortexmemory.dev/architecture/system-overview) - How it works
- [Local Documentation](https://github.com/SaintNick1214/Project-Cortex/tree/main/Documentation) - Repository documentation

## 🤝 Get Involved

We're building Cortex in public and would love your input!

### 💬 Join the Conversation

- **[GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions)** - Best for:
  - 💡 Sharing feature ideas and use cases
  - 🤔 Asking questions about architecture decisions
  - 📣 Providing feedback on the API design
  - 🎯 Discussing roadmap priorities
- **[GitHub Issues](https://github.com/SaintNick1214/cortex/issues)** - Best for:
  - 🐛 Reporting bugs
  - ✨ Requesting specific features
  - 📝 Tracking development progress
  - 🔍 Following implementation work

### 🛠️ Ways to Contribute

1. **Share Your Use Case** - Tell us how you'd use Cortex in your AI agent system
2. **Review the Architecture** - Check our docs and provide feedback on the design
3. **Propose Features** - What would make Cortex perfect for your needs?
4. **Test Builds** - Try out releases and report issues
5. **Improve Documentation** - Help us make the docs clearer and more comprehensive
6. **Spread the Word** - Star the repo, share with others building AI agents

See [CONTRIBUTING.md](/project/contributing) for detailed contribution guidelines.

## 🚦 Roadmap

**Production Ready (Now Available):**

- ✅ Core SDK (TypeScript + Python)
- ✅ CLI tooling with interactive dev mode
- ✅ Vercel AI integration with quickstart demo
- ✅ Complete documentation site
- ✅ Multi-tenancy and authentication
- ✅ Sessions management
- ✅ GDPR compliance features
- ✅ Fact extraction and belief revision
- ✅ Graph database integration (Neo4j/Memgraph)
- ✅ Resilience layer with circuit breakers

**Coming Soon:**

- 🔜 MCP Server (Q1 2026) - Cross-application memory sharing
- 🔜 LangChain Integration (Q2 2026)
- 🔜 LlamaIndex Integration (Q2 2026)
- 🔜 Cloud Mode Preview (Q3 2026) - Analytics, team management, advanced features

**Follow our progress:**

- Check [Project Boards](https://github.com/SaintNick1214/cortex/projects) for current work
- Read [Development Updates](https://github.com/SaintNick1214/cortex/discussions/categories/announcements) for milestone announcements

## 🔒 Security & Privacy

- **Data Isolation**: Each agent's memories are completely isolated
- **Your Infrastructure**: Deploy to your own Convex instance
- **No External Calls**: Cortex never sends data outside your Convex deployment
- **Flexible Access Control**: Implement your own auth layer on top
- **Open Source Core**: Audit the code yourself - full transparency

### Automated Security Scanning

- ✅ **CodeQL** - Static analysis for vulnerabilities
- ✅ **Trivy** - Dependency vulnerability scanning
- ✅ **Gitleaks** - Secret detection
- ✅ **Semgrep** - API security & OWASP Top 10
- ✅ **Bandit & Safety** - Python security scanning
- ✅ **OpenSSF Scorecard** - Supply chain security rating
- ✅ **Dependency Review** - Automated PR checks

### Supply Chain Transparency

Socket.dev may flag "network access" in this package. This is **expected and safe**:

- The SDK requires network access to communicate with Convex (cloud database)
- All network calls go to `*.convex.cloud` endpoints only
- This is documented, audited, and necessary for core functionality
- See `[.socket.dev.yml](https://github.com/SaintNick1214/Project-Cortex/blob/main/.socket.dev.yml)` for our security policy

**Report Security Issues:**

- 🔒 Email: [security@cortexmemory.dev](mailto:security@cortexmemory.dev)
- 🔐 See [SECURITY.md](https://github.com/SaintNick1214/Project-Cortex/blob/main/SECURITY.md) for our security policy

## 📦 Publishing Releases

Cortex SDK uses **dual release workflows**:

**🤖 Automated** (Production - recommended):

- Bump version in `package.json` → Push to `main` → GitHub Action publishes automatically
- Full details: [RELEASE-GUIDE.md](https://github.com/SaintNick1214/Project-Cortex/blob/main/RELEASE-GUIDE.md)

**💻 Manual** (Beta/hotfix - full control):

- Run `npm run release` for interactive publishing
- See: [scripts/release.ps1](https://github.com/SaintNick1214/Project-Cortex/blob/main/scripts/release.ps1)

**Setup**: [.github/SETUP-AUTOMATED-RELEASES.md](https://github.com/SaintNick1214/Project-Cortex/blob/main/.github/SETUP-AUTOMATED-RELEASES.md)

## 📄 License

**Functional Source License (FSL-1.1-Apache-2.0)**

Cortex uses the same license as Convex - the Functional Source License with Apache 2.0 future license.

**Permitted Uses:**

- Internal use and access within your organization
- Non-commercial education and research
- Professional services provided to licensees
- Building applications that use Cortex as a dependency

**Restrictions:**
You may NOT use Cortex to create a competing commercial product or service that offers the same or substantially similar functionality.

**Future Apache 2.0:**
Each version automatically becomes Apache 2.0 licensed two years after release.

See [LICENSE.md](https://github.com/SaintNick1214/Project-Cortex/blob/main/LICENSE.md) for full details.

**Cortex Cloud**: Commercial service (future)

- Optional managed features and analytics
- Free tier planned
- Pay only for advanced features and support

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

- 🌐 Website: [cortexmemory.dev](https://cortexmemory.dev)
- 📚 Documentation: [docs.cortexmemory.dev](https://docs.cortexmemory.dev)
- 📧 Email: [support@cortexmemory.dev](mailto:support@cortexmemory.dev)
- 💬 Discussions: [GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions)
- 🐛 Issues: [GitHub Issues](https://github.com/SaintNick1214/cortex/issues)
- 🐦 Twitter: [@cortexmemory](https://twitter.com/cortexmemory) (coming soon)

---

**⭐ Star this repo if you're building AI agents with persistent memory ⭐**

Built with ❤️ for the AI agent community by [Nicholas Geil](https://github.com/SaintNick1214) / [Saint Nick LLC](https://saintnick.ai)

*Cortex is production-ready. Join [Discussions](https://github.com/SaintNick1214/cortex/discussions) to share your use case and help shape the future of AI agent memory.*