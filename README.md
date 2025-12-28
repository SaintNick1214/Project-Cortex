# Cortex

> **Plug'n'play persistent memory for AI agents, powered by Convex**

[![License: FSL-1.1-Apache-2.0](https://img.shields.io/badge/License-FSL--1.1--Apache--2.0-blue.svg)](https://fsl.software/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Convex](https://img.shields.io/badge/Powered%20by-Convex-purple.svg)](https://convex.dev)
[![Status](https://img.shields.io/badge/Status-Working-green.svg)](https://github.com/SaintNick1214/cortex/discussions)

### 🔒 Security Scanning

[![CodeQL](https://img.shields.io/badge/CodeQL-Passing-brightgreen?logo=github)](https://github.com/SaintNick1214/Project-Cortex/security/code-scanning)
[![Semgrep](https://img.shields.io/badge/Semgrep-OWASP%20Top%2010-brightgreen?logo=semgrep)](https://github.com/SaintNick1214/Project-Cortex/actions/workflows/security.yml)
[![Trivy](https://img.shields.io/badge/Trivy-Dependencies-brightgreen?logo=aquasecurity)](https://github.com/SaintNick1214/Project-Cortex/actions/workflows/security.yml)
[![Gitleaks](https://img.shields.io/badge/Gitleaks-No%20Secrets-brightgreen?logo=git)](https://github.com/SaintNick1214/Project-Cortex/actions/workflows/security.yml)
[![Bandit](https://img.shields.io/badge/Bandit-Python-brightgreen?logo=python)](https://github.com/SaintNick1214/Project-Cortex/actions/workflows/security.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/SaintNick1214/Project-Cortex/badge)](https://scorecard.dev/viewer/?uri=github.com/SaintNick1214/Project-Cortex)

### ✅ Build & Tests

[![TypeScript SDK](https://img.shields.io/badge/TypeScript%20SDK-Passing-brightgreen?logo=typescript)](https://github.com/SaintNick1214/Project-Cortex/actions/workflows/pr-checks.yml)
[![Python SDK](https://img.shields.io/badge/Python%20SDK-Passing-brightgreen?logo=python)](https://github.com/SaintNick1214/Project-Cortex/actions/workflows/pr-checks.yml)
[![Vercel AI Provider](https://img.shields.io/badge/Vercel%20AI%20Provider-Passing-brightgreen?logo=vercel)](https://github.com/SaintNick1214/Project-Cortex/actions/workflows/pr-checks.yml)
[![Socket.dev](https://badge.socket.dev/npm/package/@cortexmemory/sdk/0.10.0)](https://socket.dev/npm/package/@cortexmemory/sdk)

**🌐 [cortexmemory.dev](https://cortexmemory.dev) | 📚 [docs.cortexmemory.dev](https://docs.cortexmemory.dev)**

## 🚧 Project Status: In Active Development

**Cortex is currently in the design and early implementation phase.** We're building a production-ready memory system for AI agents, and we're doing it in public!

**What this means:**

- 📝 Architecture and documentation are actively being refined
- 💻 Core SDK implementation is in progress
- 🎯 API design is stabilizing but may still change
- 🤝 Community input is shaping the direction

**Want to contribute or follow along?**

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

## ✨ Features

Cortex provides a complete memory system for AI agents:

- 🧠 **Flexible Memory** - Remember anything without hardcoded topics or schemas ✅
- 🔒 **Memory Space Isolation** - Flexible boundaries (per user, team, or project) ✅
- ♾️ **Long-term Persistence** - Memories last forever with automatic indexing ✅
- ⏱️ **Automatic Versioning** - Updates preserve history, never lose data (10 versions default) ✅
- 🗄️ **4-Layer Hybrid Architecture** - ACID conversations + vector search + facts extraction + graph integration ✅
- 🔍 **Semantic Search** - AI-powered retrieval with multi-strategy fallback ✅
- 📊 **Vector Embeddings** - Optional but preferred, support any dimension (768, 1536, 3072+) ✅
- 🔗 **Context Chains** - Hierarchical context sharing across memory spaces ✅
- 👥 **User Profiles** - Rich user context with GDPR cascade deletion ✅
- 📈 **Access Analytics** - Built-in statistics and insights ✅
- 🎯 **Agent Registry** - Optional metadata for discovery and cascade cleanup ✅
- 🚀 **Embedding Agnostic** - Works with OpenAI, Cohere, local models, or any provider ✅
- 🕸️ **Graph Database Integration** - Neo4j/Memgraph support with orphan detection ✅
- 🧠 **Fact Extraction** - LLM-powered fact extraction for 60-90% storage savings ✅
- 🛡️ **Governance Policies** - Centralized data retention, purging, and compliance (GDPR, HIPAA, SOC2, FINRA) ✅
- 🔌 **MCP Server** - Cross-application memory sharing (planned)
- 💬 **A2A Communication** - Inter-space messaging helpers (planned)
- ✅ **Client-Side Validation** - Instant error feedback (<1ms) for all 11 APIs ✅
- 🛡️ **Resilience Layer** - Rate limiting, circuit breaker, priority queue for overload protection ✅

## ✨ What's New in v0.16.0

### Resilience Layer - Production-Ready Overload Protection

**NEW: Built-in protection against server overload during extreme traffic bursts:**

- ⚡ **Token Bucket Rate Limiter** - Smooths bursty traffic (100 tokens, 50/sec refill default)
- 🚦 **Concurrency Limiter** - Controls parallel requests (20 max concurrent, 1000 queue)
- 🎯 **Priority Queue** - Critical ops (deletes) get priority, low-priority ops queue
- 🔌 **Circuit Breaker** - Fails fast when backend is unhealthy (5 failures → open)
- 📊 **Full Metrics** - Monitor rate limiter, queue depth, circuit state

```typescript
import { Cortex, ResiliencePresets } from "@cortexmemory/sdk";

// Default - enabled with balanced settings (no config needed!)
const cortex = new Cortex({ convexUrl: process.env.CONVEX_URL! });

// Or use a preset for your use case
const realtimeCortex = new Cortex({
  convexUrl: process.env.CONVEX_URL!,
  resilience: ResiliencePresets.realTimeAgent, // Low latency
});

const batchCortex = new Cortex({
  convexUrl: process.env.CONVEX_URL!,
  resilience: ResiliencePresets.batchProcessing, // Large queues
});

// Monitor health
console.log(cortex.isHealthy()); // false if circuit is open
console.log(cortex.getResilienceMetrics()); // Full metrics

// Graceful shutdown
await cortex.shutdown(30000); // Wait up to 30s for pending ops
```

**Zero breaking changes** - resilience is enabled by default with sensible settings. All existing code works without modification.

---

## ✨ What's New in v0.12.0

### Client-Side Validation - Instant Error Feedback

**All 11 APIs now validate inputs client-side before making backend calls:**

- ⚡ **10-200x faster error feedback** (<1ms vs 50-200ms backend round-trip)
- 📝 **Better error messages** with field names and fix suggestions
- 🔒 **Defense in depth** with both client and backend validation
- 🧪 **420+ validation tests** across both TypeScript and Python SDKs

```typescript
// ❌ Before v0.12.0 - Wait for backend to validate
await cortex.governance.setPolicy({
  conversations: { retention: { deleteAfter: "7years" } }, // Invalid format
});
// → 50-200ms wait → Error thrown

// ✅ After v0.12.0 - Instant validation
await cortex.governance.setPolicy({
  conversations: { retention: { deleteAfter: "7years" } }, // Invalid format
});
// → <1ms → GovernanceValidationError with helpful message:
//   "Invalid period format '7years'. Must be in format like '7d', '30m', or '1y'"

// Optional: Catch validation errors specifically
import { GovernanceValidationError } from "@cortexmemory/sdk";

try {
  await cortex.governance.setPolicy(policy);
} catch (error) {
  if (error instanceof GovernanceValidationError) {
    console.log(`Validation failed: ${error.code} - ${error.field}`);
    // Fix input and retry immediately
  }
}
```

**Validation Coverage:**

- ✅ Governance API (9 validators) - Period formats, ranges, scopes, dates
- ✅ Memory API (12 validators) - IDs, content, importance, source types
- ✅ All 9 other APIs (62+ validators total)

---

## ✨ What's New in v0.10.0

### Governance Policies API - Enterprise Compliance Made Simple

**NEW: `cortex.governance.*`** - Centralized control over data retention, purging, and compliance:

- **8 Core Operations**: setPolicy, getPolicy, setAgentOverride, getTemplate, enforce, simulate, getComplianceReport, getEnforcementStats
- **4 Compliance Templates**: GDPR, HIPAA, SOC2, FINRA (one-click compliance)
- **Multi-Layer Governance**: Manage retention across conversations, immutable, mutable, and vector layers
- **Policy Simulation**: Test policies before applying (impact analysis, cost savings)
- **Compliance Reporting**: Detailed reports with per-layer compliance status
- **Flexible Scoping**: Organization-wide policies with memory-space overrides
- **Automatic Enforcement**: Policies enforced on write operations
- **Audit Trail**: Complete enforcement history and statistics

```typescript
// Apply GDPR template
const policy = await cortex.governance.getTemplate("GDPR");
await cortex.governance.setPolicy({
  ...policy,
  organizationId: "my-org",
});

// Override for audit agent (unlimited retention)
await cortex.governance.setAgentOverride("audit-agent", {
  vector: { retention: { defaultVersions: -1 } },
});

// Simulate policy impact before applying
const impact = await cortex.governance.simulate(newPolicy);
console.log(
  `Would save ${impact.storageFreed} MB, $${impact.costSavings}/month`,
);

// Generate compliance report
const report = await cortex.governance.getComplianceReport({
  organizationId: "my-org",
  period: { start: new Date("2025-01-01"), end: new Date("2025-12-31") },
});
```

**Enterprise Value:**

- ✅ One-click GDPR, HIPAA, SOC2, FINRA compliance
- ✅ Automatic data lifecycle management
- ✅ Cost optimization insights
- ✅ Complete audit trails

---

## ✨ What's New in v0.9.0

### Streaming Support - Native Edge Runtime Compatibility

**NEW: `memory.rememberStream()`** - First-class streaming support for AI responses:

- **Stream any response format**: ReadableStream or AsyncIterable
- **Edge runtime compatible**: Works in Vercel Edge Functions, Cloudflare Workers
- **Zero buffering required**: Handles stream consumption internally
- **All features supported**: Embeddings, facts extraction, graph sync
- **Production ready**: 28/28 streaming tests + 19/19 edge tests passing

```typescript
// With Vercel AI SDK streaming
const stream = await generateText({ model: "gpt-5-nano", messages });

const result = await cortex.memory.rememberStream({
  memorySpaceId: "agent-1",
  conversationId: "conv-123",
  userMessage: "What is the weather?",
  responseStream: stream, // ReadableStream or AsyncIterable
  userId: "user-1",
  userName: "Alex",
});

console.log("Full response:", result.fullResponse);
// All memories stored automatically once stream completes
```

**Edge Runtime verified**: All SDK operations work in edge environments - no Node.js APIs used.

---

## ✨ What's New in v0.8.0

### Users & Agents APIs - GDPR Compliance & Cascade Deletion

Complete implementation of coordination layer APIs with powerful cascade deletion:

**Users API (`cortex.users.*`)** - GDPR Compliance

- User profile management with automatic versioning
- **GDPR cascade deletion by userId** across all layers
- Works in free SDK (DIY graph) and Cloud Mode (managed + legal guarantees)
- Deletes from: conversations, immutable, mutable, vector, facts, graph
- Transaction-like rollback on failures
- 23/23 tests passing on LOCAL and MANAGED

**Agents API (`cortex.agents.*`)** - Optional Registry

- Optional metadata registration for discovery and analytics
- **Cascade deletion by participantId** across all memory spaces
- Works even if agent was never registered
- Deletes from: conversations, memories, facts, graph
- Graph orphan detection included
- 20/20 tests passing on LOCAL and MANAGED

```typescript
// GDPR cascade deletion by userId
await cortex.users.delete("user-123", {
  cascade: true, // Deletes across ALL layers
  verify: true, // Checks for orphaned records
});

// Agent cleanup by participantId
await cortex.agents.unregister("agent-xyz", {
  cascade: true, // Deletes across ALL memory spaces
  verify: true, // Includes graph orphan detection
});
```

## 🚀 Quick Start

Get started with Cortex in under 5 minutes:

### Install the Cortex CLI

```bash
npm install -g @cortexmemory/cli
```

### Create Your First Cortex Project

```bash
cortex init my-cortex-agent
```

The interactive wizard will guide you through:

- **Project Setup** - Choose new project or add to existing
- **Convex Configuration** - Local development, new cloud database, or existing database
- **Graph Database** - Optional Neo4j/Memgraph integration with Docker
- **Automatic Setup** - Installs dependencies and deploys backend functions

### What Gets Set Up

✅ Cortex SDK with TypeScript support  
✅ Convex backend functions (deployed automatically)  
✅ Environment configuration (.env.local)  
✅ Example code to get you started  
✅ Optional graph database integration  
✅ Deployment saved to `~/.cortexrc` for CLI management

### Start Building

```bash
cd my-cortex-agent
cortex start           # Starts Convex + graph DB (if configured)
# Or use interactive dev mode:
cortex dev             # Live dashboard with keyboard shortcuts
```

### Your First Memory

```typescript
import { Cortex } from "@cortexmemory/sdk";

const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL!,
});

// Store a memory
await cortex.memory.remember({
  memorySpaceId: "my-agent",
  conversationId: "conv-1",
  userMessage: "I prefer dark mode",
  agentResponse: "Got it! I'll remember that.",
  userId: "user-123",
  userName: "User",
});

// Search your memories
const results = await cortex.memory.search(
  "my-agent",
  "what are the user's preferences?",
);
```

**That's it!** Your AI agent now has persistent memory.

### Adding to Existing Project

```bash
cd your-existing-project
cortex init .
```

### CLI Commands

Once installed, manage your Cortex projects with:

```bash
cortex status          # View all deployments and their status
cortex start           # Start all enabled deployments
cortex stop            # Stop all running services
cortex dev             # Interactive dev mode with live dashboard
cortex config list     # View configured deployments
cortex use <name>      # Switch between deployments
```

> **Note:** `npm create cortex-memories` is still available as an alternative, but `cortex init` is recommended as it provides additional features like multi-deployment management and interactive dev mode.

---

## ✨ What's New in v0.7.0

### Graph Database Integration

Add powerful graph database capabilities to Cortex for advanced relationship queries:

```typescript
import { Cortex } from "@cortexmemory/sdk";
import { CypherGraphAdapter, initializeGraphSchema } from "@cortexmemory/sdk/graph";

// Setup graph database
const graph = new CypherGraphAdapter();
await graph.connect({ uri: "bolt://localhost:7687", ... });
await initializeGraphSchema(graph);

// Initialize Cortex with graph
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL!,
  graph: { adapter: graph }
});

// Use normally - auto-syncs to graph!
await cortex.memory.remember({
  memorySpaceId: "agent-1",
  conversationId: "conv-123",
  userMessage: "Alice works at Acme Corp using TypeScript",
  agentResponse: "Got it!",
  userId: "alice",
  userName: "Alice"
});

// Graph enrichment provides 2-5x more context:
// - Discovers entity relationships (Alice knows Bob, Bob uses TypeScript)
// - Reconstructs full context chains (parent-child workflows)
// - Traces provenance (memory → conversation → context → user)
// - Enables multi-hop knowledge discovery
```

**When to use:**

- Deep context chains (5+ levels)
- Knowledge graphs with entity relationships
- Multi-hop reasoning (Alice → Company → Bob → Technology)
- Provenance tracking and audit trails
- Complex multi-agent coordination

**Performance:** 3.8x faster for deep traversals, <100ms enrichment overhead

See [Graph Database Setup Guide](./Documentation/07-advanced-topics/05-graph-database-setup.md) for quick start!

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
| Facts Extraction  | ✅     | ❌       | ❌       | ❌    |
| Graph Integration | ✅     | ❌       | ❌       | ❌    |
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

**📚 [docs.cortexmemory.dev](https://docs.cortexmemory.dev)** - Complete documentation, guides, and API reference

### Getting Started

- [Installation Guide](https://docs.cortexmemory.dev/getting-started/installation) - Multiple installation methods
- [Five-Minute Quickstart](https://docs.cortexmemory.dev/getting-started/quickstart) - Build your first agent
- [Core Concepts](https://docs.cortexmemory.dev/getting-started/core-concepts) - Understand the fundamentals
- [Configuration](https://docs.cortexmemory.dev/getting-started/configuration) - Customize Cortex

### Reference

- [API Reference](https://docs.cortexmemory.dev/api-reference/overview) - Full API documentation
- [System Architecture](https://docs.cortexmemory.dev/architecture/system-overview) - How it works
- [Recipes & Examples](https://docs.cortexmemory.dev/recipes/simple-chatbot) - Real-world patterns
- [Local Documentation](./Documentation/00-README.md) - Repository documentation

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

- 4-layer hybrid design (ACID + Vector + Facts + Graph)
- Graph-Lite built-in, native Neo4j/Memgraph optional
- Facts extraction (DIY or Cloud auto)
- All data in one place (Convex)

## 🔒 Security

Cortex maintains enterprise-grade security practices:

**Automated Security Scanning:**

- ✅ **CodeQL** - Static analysis for vulnerabilities
- ✅ **Trivy** - Dependency vulnerability scanning
- ✅ **Gitleaks** - Secret detection
- ✅ **Semgrep** - API security & OWASP Top 10
- ✅ **Bandit & Safety** - Python security scanning
- ✅ **OpenSSF Scorecard** - Supply chain security rating
- ✅ **Dependency Review** - Automated PR checks

**Supply Chain Transparency:**

Socket.dev may flag "network access" in this package. This is **expected and safe**:

- The SDK requires network access to communicate with Convex (cloud database)
- All network calls go to `*.convex.cloud` endpoints only
- This is documented, audited, and necessary for core functionality
- See [`.socket.dev.yml`](./.socket.dev.yml) for our security policy

**Report Security Issues:**

- 🔒 Email: security@cortexmemory.dev
- 🔐 See [SECURITY.md](./SECURITY.md) for our security policy

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

See [LICENSE.md](./LICENSE.md) for full details.

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
- 📧 Email: support@cortexmemory.dev
- 💬 Discussions: [GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions)
- 🐛 Issues: [GitHub Issues](https://github.com/SaintNick1214/cortex/issues)
- 🐦 Twitter: [@cortexmemory](https://twitter.com/cortexmemory) (coming soon)

---

<div align="center">

**⭐ Star this repo to follow our progress ⭐**

Built with ❤️ for the AI agent community by [Nicholas Geil](https://github.com/SaintNick1214) / [Saint Nick LLC](https://saintnick.ai)

_Cortex is in active development. Join [Discussions](https://github.com/SaintNick1214/cortex/discussions) to shape the future of AI agent memory._

</div>
