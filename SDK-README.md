# Cortex SDK

Open-source SDK for building AI agents with persistent memory, built on [Convex](https://convex.dev).

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start Convex backend (local development)
npm run dev

# In another terminal, run tests
npm test
```

## 📦 Current Status

### ✅ Layer 1a: Conversations (COMPLETE)

- **Schema**: `convex/schema.ts` - conversations table with indexes
- **Backend**: `convex/conversations.ts` - Convex mutations/queries
- **SDK**: `src/conversations/index.ts` - TypeScript API wrapper
- **Tests**: `tests/conversations.test.ts` - 13 comprehensive E2E tests

### ⏳ Coming Next

- Layer 1b: Immutable Store
- Layer 1c: Mutable Store
- Layer 2: Vector Memory (memories table)
- Layer 3: Memory API (convenience wrapper)
- Coordination: Users, Contexts, A2A Communication

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│  Cortex SDK (TypeScript)                    │
│  src/                                       │
│  - conversations/  (Layer 1a) ✅            │
│  - immutable/      (Layer 1b) ⏳            │
│  - mutable/        (Layer 1c) ⏳            │
│  - memories/       (Layer 2)  ⏳            │
│  - memory/         (Layer 3)  ⏳            │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  Convex Backend                             │
│  convex/                                    │
│  - schema.ts       (Table definitions)      │
│  - conversations.ts (Mutations/Queries) ✅  │
│  - immutable.ts    ⏳                       │
│  - mutable.ts      ⏳                       │
│  - memories.ts     ⏳                       │
└─────────────────────────────────────────────┘
```

## 🧪 Testing

### Run Tests

```bash
# All tests
npm test

# Watch mode (for development)
npm run test:watch

# Coverage report
npm run test:coverage
```

### Test Requirements

- **Convex must be running**: `npm run dev` in one terminal
- **Tests validate both SDK and storage**: Every test checks SDK response + Convex storage
- **Coverage goal**: 80% minimum

### Test Pattern

```typescript
// 1. Create via SDK
const result = await cortex.conversations.create({ ... });

// 2. Validate SDK response
expect(result.conversationId).toBeDefined();

// 3. Validate Convex storage
const stored = await client.query(api.conversations.get, {
  conversationId: result.conversationId,
});
expect(stored).toMatchObject({ ... });
```

## 📚 API Usage

### Initialize SDK

```typescript
import { Cortex } from "cortex-sdk";

const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL,
});
```

### Conversations API (Layer 1a)

```typescript
// Create a user-agent conversation
const conversation = await cortex.conversations.create({
  type: "user-agent",
  participants: {
    userId: "user-123",
    agentId: "agent-456",
  },
});

// Add a message
await cortex.conversations.addMessage({
  conversationId: conversation.conversationId,
  message: {
    role: "user",
    content: "Hello, agent!",
  },
});

// Retrieve conversation
const retrieved = await cortex.conversations.get(conversation.conversationId);

// List conversations
const conversations = await cortex.conversations.list({
  userId: "user-123",
  limit: 10,
});

// Delete conversation (GDPR)
await cortex.conversations.delete(conversation.conversationId);
```

## 🏗️ Development Workflow

### Adding a New API Layer

1. **Schema** - Update `convex/schema.ts` with new table + indexes
2. **Backend** - Create `convex/[name].ts` with mutations/queries
3. **Types** - Add TypeScript types to `src/types/index.ts`
4. **SDK** - Create `src/[name]/index.ts` with API wrapper
5. **Tests** - Create `tests/[name].test.ts` with E2E tests
6. **Export** - Add to `src/index.ts`

### Example: Adding Immutable Store (Layer 1b)

```bash
# 1. Update schema
# Add immutable table to convex/schema.ts

# 2. Create backend
# Create convex/immutable.ts

# 3. Create SDK wrapper
# Create src/immutable/index.ts

# 4. Add to main SDK
# Update src/index.ts

# 5. Create tests
# Create tests/immutable.test.ts

# 6. Run tests
npm test
```

## 📁 Project Structure

```
cortex-sdk/
├── convex/              # Convex backend
│   ├── _generated/      # Auto-generated (git-ignored)
│   ├── schema.ts        # Table definitions
│   ├── conversations.ts # Layer 1a backend ✅
│   └── convex.config.ts # Convex configuration
├── src/                 # SDK source code
│   ├── conversations/   # Layer 1a SDK ✅
│   │   └── index.ts
│   ├── types/           # TypeScript types
│   │   └── index.ts
│   └── index.ts         # Main SDK entry point
├── tests/               # E2E tests
│   ├── conversations.test.ts ✅ (26 tests)
│   └── README.md
├── API-Development/     # 📊 API development tracking
│   ├── 00-API-ROADMAP.md           # Overall progress
│   ├── 01-layer-1a-conversations.md # ✅ Complete
│   ├── 02-layer-1b-immutable-store.md # ⏳ Pending
│   └── README.md
├── .env.local           # Local environment (git-ignored)
├── .env.test            # Test environment template
├── jest.config.mjs      # Jest configuration (ESM)
├── tsconfig.json        # TypeScript config
├── package.json         # Dependencies
└── README.md            # This file
```

## 🔧 Scripts

- `npm run dev` - Start Convex backend locally
- `npm test` - Run all tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate coverage report
- `npm run lint` - Lint code

## 📖 Documentation

For complete architecture and API documentation, see:

- [Project Cortex Documentation](../Documentation/)
- [Architecture Deep Dive](../Documentation/04-architecture/)
- [API Reference](../Documentation/03-api-reference/)

## 🎯 Implementation Progress

**📊 Detailed Progress Tracking**: See [API-Development/](./API-Development/) folder for complete API development status.

### Completed ✅

- [x] Project setup with Convex
- [x] Schema for conversations table
- [x] Conversations backend (mutations/queries)
- [x] Conversations SDK wrapper
- [x] Testing infrastructure (Jest)
- [x] E2E tests with storage validation (26 tests passing)

### Next Steps 🎯

1. **Layer 1b: Immutable Store**
   - Schema + backend
   - SDK wrapper
   - E2E tests

2. **Layer 1c: Mutable Store**
   - Schema + backend
   - SDK wrapper
   - E2E tests

3. **Layer 2: Vector Memory**
   - Schema with vector index
   - Embedding support
   - Search API
   - E2E tests

4. **Layer 3: Memory API**
   - Convenience wrapper over Layer 1 + 2
   - `cortex.memory.store()`, `cortex.memory.search()`
   - E2E tests

5. **Coordination Layers**
   - Users API (GDPR cascade)
   - Contexts API (hierarchical workflows)
   - A2A Communication helpers

## 🤝 Contributing

This SDK is built layer-by-layer, with comprehensive tests for each layer before moving to the next. Every API must include:

1. Convex schema with proper indexes
2. Backend mutations/queries
3. TypeScript SDK wrapper
4. E2E tests validating both SDK and storage
5. 80%+ test coverage

## 📝 License

MIT (to be confirmed)

## 🔗 Links

- [Convex Documentation](https://docs.convex.dev)
- [Project Cortex Documentation](../Documentation/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
