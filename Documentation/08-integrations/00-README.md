# Integrations

Official and community integrations for Cortex Memory.

## Production Ready Integrations

### Vercel AI SDK ✅ PRODUCTION READY

**Package**: `@cortexmemory/vercel-ai-provider`  
**Version**: v0.27.2  
**SDK Compatibility**: Cortex SDK v0.21.0+  
**Status**: Production Ready ✅

Add persistent memory to Next.js applications with full streaming support, layer visualization, and memory orchestration.

**Features:**

- ✅ Automatic memory retrieval and storage
- ✅ Streaming with progressive storage
- ✅ Memory Spaces for multi-tenancy
- ✅ Hive Mode for cross-application memory
- ✅ Interactive quickstart demo
- ✅ Layer flow visualization
- ✅ Edge runtime compatible
- ✅ TypeScript native
- ✅ Self-hosted with Convex

**Quick Start:**

```bash
# Option 1: Run the quickstart demo (recommended)
cd packages/vercel-ai-provider/quickstart
npm install && npm run dev

# Option 2: Use CLI to scaffold new project
cortex init my-app --template vercel-ai-quickstart
```

**Example:**

```typescript
import { createCortexMemory } from "@cortexmemory/vercel-ai-provider";
import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";

const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: "my-chatbot",
  userId: "user-123",
  agentId: "my-assistant", // Required in v0.17.0+
});

const result = await streamText({
  model: cortexMemory(openai("gpt-4o-mini")),
  messages,
});
```

**Learn More:**

- [📖 Getting Started Guide](./vercel-ai-sdk/01-getting-started.md)
- [🎯 API Reference](./vercel-ai-sdk/02-api-reference.md)
- [🚀 Quickstart Demo](https://github.com/SaintNick1214/Project-Cortex/tree/main/packages/vercel-ai-provider/quickstart)

---

## Integration Guides

### Authentication

**Status**: 🔧 DIY Integration Guide  
**Documentation**: [01-auth-providers.md](./01-auth-providers.md)

Cortex provides a framework-agnostic AuthContext API. This guide shows patterns for integrating with Auth0, Clerk, NextAuth, Firebase, or custom JWT systems.

**⚠️ Important:** Cortex does NOT include specific auth provider packages. You integrate your existing auth system using the AuthContext API.

**What you get:**

- ✅ Generic integration patterns
- ✅ AuthContext API documentation
- ✅ Example adapters for common providers
- ✅ DIY implementation guidance

**What Cortex provides:**

- `createAuthContext()` function
- Automatic user/tenant field injection
- Multi-tenant isolation support
- Session tracking integration

**What you provide:**

- Your auth system (Auth0, Clerk, etc.)
- Code to extract userId/tenantId from tokens
- User validation logic

[View Auth Integration Patterns →](./01-auth-providers.md)

---

## Planned Integrations

These integrations are planned but not yet implemented:

### LangChain.js

**Status**: 🔄 Planned  
**Target**: Q2 2026

### LlamaIndex.TS

**Status**: 🔄 Planned  
**Target**: Q2 2026

### MCP Servers

**Status**: 🔄 Planned  
**Target**: Q1 2026

---

## Community Integrations

None yet. Build an integration and share it with the community!

---

## Integration Requests

Want an integration with your favorite framework?

- [Open an issue](https://github.com/SaintNick1214/Project-Cortex/issues/new)
- [Start a discussion](https://github.com/SaintNick1214/Project-Cortex/discussions)
- [Contribute](/project/contributing)

---

## See Also

- [Core Features](../02-core-features/00-memory-orchestration.md)
- [API Reference](../03-api-reference/01-overview.md)
- [Memory Spaces](../02-core-features/01-memory-spaces.md)
- [Authentication](../02-core-features/18-authentication.md)
