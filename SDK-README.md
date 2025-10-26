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

### ✅ Layer 1a: Conversations (COMPLETE - All 9 Operations!)

- **Schema**: `convex-dev/schema.ts` - conversations table with 6 indexes
- **Backend**: `convex-dev/conversations.ts` - 9 Convex operations
- **SDK**: `src/conversations/index.ts` - 9 TypeScript methods
- **Tests**: `tests/conversations.test.ts` - 45 comprehensive E2E tests (100% passing)
- **Interactive**: `tests/interactive-runner.ts` - Menu-driven debugging

**Operations**: create, get, addMessage, list, count, delete, **getHistory**, **search**, **export**

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
│  convex-dev/                                │
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
# All tests (fast, CI-ready)
npm test

# Watch mode (for development - auto-reruns on changes)
npm run test:watch

# Interactive mode (menu-driven, one-by-one testing) ⭐ NEW!
npm run test:interactive

# Debug mode (step-by-step validation with storage inspection)
npm run test:debug

# Coverage report
npm run test:coverage
```

⚠️ **Note**: Use `npm run` for custom scripts (e.g., `npm run test:watch`, NOT `npm test:watch`)

### Test Requirements

- **Convex must be running**: `npm run dev` in one terminal
- **Tests validate both SDK and storage**: Every test checks SDK response + Convex storage
- **Coverage goal**: 80% minimum

### Interactive Tests ⭐ NEW!

Interactive mode provides a **menu-driven interface** for manual testing:

```bash
npm run test:interactive
```

Features:
- 🎮 **Choose what to test** - Pick individual operations from a menu
- 🧹 **Purge database** - Clean slate between tests
- 📊 **Inspect storage** - See database state at any time
- 🎯 **Track state** - Current conversation ID maintained between operations
- 🔄 **Repeat operations** - Run the same test multiple times

Perfect for:
- Learning how the API works
- Debugging specific operations
- Manual validation workflows
- Understanding state changes

### Debug Tests

Debug tests (`*.debug.test.ts`) provide automated step-by-step validation:

```bash
npm run test:debug
```

Output includes:
- 🔥 Each operation as it happens
- 📊 Storage inspection after each step
- ✅ Detailed validation results
- 🔍 Database state visibility

**📖 Full Testing Guide**: See [dev-docs/QUICK-TEST-REFERENCE.md](./dev-docs/QUICK-TEST-REFERENCE.md)

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

// Get paginated message history (NEW!)
const history = await cortex.conversations.getHistory(conversation.conversationId, {
  limit: 20,
  sortOrder: "desc",  // Newest first
});
console.log(`Showing ${history.messages.length} of ${history.total} messages`);

// Search conversations (NEW!)
const results = await cortex.conversations.search({
  query: "important keyword",
  filters: { userId: "user-123", limit: 5 },
});
console.log(`Found ${results.length} conversations`);

// Export for GDPR (NEW!)
const exported = await cortex.conversations.export({
  filters: { userId: "user-123" },
  format: "json",
  includeMetadata: true,
});

// Delete conversation (GDPR)
await cortex.conversations.delete(conversation.conversationId);
```

## 🏗️ Development Workflow

### Adding a New API Layer

1. **Schema** - Update `convex-dev/schema.ts` with new table + indexes
2. **Backend** - Create `convex-dev/[name].ts` with mutations/queries
3. **Types** - Add TypeScript types to `src/types/index.ts`
4. **SDK** - Create `src/[name]/index.ts` with API wrapper
5. **Tests** - Create `tests/[name].test.ts` with E2E tests
6. **Export** - Add to `src/index.ts`

### Example: Adding Immutable Store (Layer 1b)

```bash
# 1. Update schema
# Add immutable table to convex-dev/schema.ts

# 2. Create backend
# Create convex-dev/immutable.ts

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
Project Cortex/          # ← Repository root = SDK root
├── src/                 # SDK source code (ships to npm)
│   ├── conversations/   # Layer 1a SDK ✅
│   │   └── index.ts
│   ├── types/           # TypeScript types
│   │   └── index.ts
│   └── index.ts         # Main SDK entry point
├── tests/               # E2E tests
│   ├── conversations.test.ts       ✅ (13 tests)
│   ├── conversations.debug.test.ts # Debug validation
│   ├── helpers/         # Test utilities
│   │   ├── cleanup.ts   # Table purging
│   │   ├── inspector.ts # Storage inspection
│   │   └── debug.ts     # Debug logging
│   └── README.md
├── convex-dev/          # Local Convex database (for testing)
│   ├── _generated/      # Auto-generated (git-ignored)
│   ├── schema.ts        # Table definitions
│   └── conversations.ts # Layer 1a backend ✅
├── dev-docs/            # SDK development documentation
│   ├── API-Development/ # 📊 API development tracking
│   │   ├── 00-API-ROADMAP.md           # Overall progress
│   │   ├── 01-layer-1a-conversations.md # ✅ Complete
│   │   └── 02-layer-1b-immutable-store.md # ⏳ Pending
│   ├── TESTING-GUIDE.md           # Testing philosophy
│   ├── QUICK-TEST-REFERENCE.md    # Test commands reference
│   └── REORGANIZATION-COMPLETE.md # Structure changes
├── Documentation/       # User-facing SDK documentation
├── examples/            # Example projects
├── .env.local           # Local environment (git-ignored)
├── .env.test            # Test environment template
├── convex.json          # Convex configuration
├── jest.config.mjs      # Jest configuration (ESM)
├── tsconfig.json        # TypeScript config
├── package.json         # Dependencies & scripts
├── SDK-README.md        # This file (SDK-specific)
└── README.md            # Project README
```

## 🔧 Scripts

- `npm run dev` - Start Convex backend locally
- `npm test` - Run all tests
- `npm run test:watch` - Run tests in watch mode (auto-rerun)
- `npm run test:interactive` - Interactive menu-driven testing ⭐ NEW!
- `npm run test:debug` - Run debug tests with step-by-step validation
- `npm run test:coverage` - Generate coverage report
- `npm run lint` - Lint code

## 📖 Documentation

For complete architecture and API documentation, see:

- [Project Cortex Documentation](../Documentation/)
- [Architecture Deep Dive](../Documentation/04-architecture/)
- [API Reference](../Documentation/03-api-reference/)

## 🎯 Implementation Progress

**📊 Detailed Progress Tracking**: See [dev-docs/API-Development/](./dev-docs/API-Development/) folder for complete API development status.

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

Apache License 2.0 - See [LICENSE.md](./LICENSE.md)

## 🔗 Links

- [Convex Documentation](https://docs.convex.dev)
- [Project Cortex Documentation](../Documentation/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
