# Layer 3 Planning Complete - Ready to Implement

**Date**: October 27, 2025  
**Status**: 📋 **Planning Complete - Ready for Implementation**  
**Target**: v0.5.0 (Core 5 operations)

---

## 🎯 What Was Planned

### Layer 3: Memory Convenience API

**Purpose**: High-level helpers that orchestrate Layers 1 & 2 automatically

**Total Operations**: 17

- **Unique** (5): New functionality requiring implementation
- **Delegations** (12): Thin wrappers to `cortex.vector.*`

---

## 📋 Complete Operations List

### Core Dual-Layer Operations (5 unique - HIGH PRIORITY)

| #   | Operation                  | What It Does                                       | Complexity             |
| --- | -------------------------- | -------------------------------------------------- | ---------------------- |
| 1   | `remember()`               | Store conversation in ACID + create Vector indexes | **High** (~80 lines)   |
| 2   | `forget()`                 | Delete from Vector + optionally ACID               | **Medium** (~60 lines) |
| 3   | `get()` with enrichment    | Get Vector + optionally fetch ACID context         | **Medium** (~50 lines) |
| 4   | `search()` with enrichment | Search Vector + optionally enrich with ACID        | **Medium** (~60 lines) |
| 5   | `store()`                  | Smart layer detection + delegate                   | **Low** (~30 lines)    |

**Total unique**: ~280 lines of new code

### Simple Delegations (12 operations - LOW PRIORITY)

Thin wrappers (3-5 lines each):

| #   | Operation          | Delegates To              |
| --- | ------------------ | ------------------------- |
| 6   | `update()`         | `vector.update()`         |
| 7   | `delete()`         | `vector.delete()`         |
| 8   | `list()`           | `vector.list()`           |
| 9   | `count()`          | `vector.count()`          |
| 10  | `updateMany()`     | `vector.updateMany()`     |
| 11  | `deleteMany()`     | `vector.deleteMany()`     |
| 12  | `export()`         | `vector.export()`         |
| 13  | `archive()`        | `vector.archive()`        |
| 14  | `getVersion()`     | `vector.getVersion()`     |
| 15  | `getHistory()`     | `vector.getHistory()`     |
| 16  | `getAtTimestamp()` | `vector.getAtTimestamp()` |

**Total delegations**: ~50 lines of wrapper code

### Advanced (Future - v0.6.0+)

| #   | Operation      | Purpose                                           |
| --- | -------------- | ------------------------------------------------- |
| 17  | `smartStore()` | Auto-detect create vs update using LLM/similarity |

---

## 📊 Implementation Estimate

### Code to Write

| Component                                   | Lines      | Complexity |
| ------------------------------------------- | ---------- | ---------- |
| Types (`src/types/index.ts`)                | ~100       | Low        |
| SDK (`src/memory/index.ts`)                 | ~330       | Medium     |
| Tests (`tests/memory.test.ts`)              | ~800       | Medium     |
| Interactive (`tests/interactive-runner.ts`) | ~300       | Low        |
| **Total**                                   | **~1,530** | **Medium** |

### Timeline Estimate

**v0.5.0 MVP (Core 5 operations)**:

- Day 1: Types + `remember()` + tests (10-12 tests)
- Day 2: `forget()` + `get()` enrichment + tests (10-12 tests)
- Day 3: `search()` enrichment + `store()` + tests (10-12 tests)
- Day 4: Integration tests + interactive menu (8-10 tests)
- Day 5: Polish + documentation sync

**Estimated**: 4-5 days for MVP (5 operations, 40-50 tests)

**v0.5.1 Delegations (12 operations)**:

- Day 6: All delegations + validation tests (15-20 tests)

**Total**: 5-6 days for complete Layer 3

---

## 🎊 What Layer 3 Enables

### Before (Manual Dual-Layer)

```typescript
// Step 1: Store in ACID
const userMsg = await cortex.conversations.addMessage(conversationId, {
  role: "user",
  content: "The password is Blue",
  userId: "user-123",
});

const agentMsg = await cortex.conversations.addMessage(conversationId, {
  role: "agent",
  content: "I'll remember that!",
  agentId: "agent-1",
});

// Step 2: Index in Vector
await cortex.vector.store("agent-1", {
  content: "The password is Blue",
  conversationRef: {
    conversationId,
    messageIds: [userMsg.id],
  },
  source: { type: "conversation", userId: "user-123" },
  metadata: { importance: 100, tags: ["password"] },
});

await cortex.vector.store("agent-1", {
  content: "I'll remember that!",
  conversationRef: {
    conversationId,
    messageIds: [agentMsg.id],
  },
  source: { type: "conversation", userId: "user-123" },
  metadata: { importance: 50, tags: ["response"] },
});

// 4 API calls, manual linking, error-prone
```

### After (Layer 3 Convenience)

```typescript
// One call does everything!
await cortex.memory.remember({
  agentId: "agent-1",
  conversationId,
  userMessage: "The password is Blue",
  agentResponse: "I'll remember that!",
  userId: "user-123",
  userName: "Alex",
  generateEmbedding: async (content) => await embed(content),
});

// 1 API call, automatic linking, clean ✨
```

---

## 📚 Documentation Status

### Already Documented ✅

All 17 Layer 3 operations are **fully documented**:

1. **[Memory Operations API](../../Documentation/03-api-reference/02-memory-operations.md)**
   - Lines 311-322: Layer 3 overview
   - Lines 358-1781: All 17 operations documented with examples

2. **[Agent Memory Guide](../../Documentation/02-core-features/01-agent-memory.md)**
   - Usage examples throughout
   - Best practices
   - Real-world patterns

3. **[Types & Interfaces](../../Documentation/03-api-reference/11-types-interfaces.md)**
   - Lines 243-310: All Layer 3 types defined

**Documentation coverage**: 100% ✅

---

## 🔧 Implementation Plan

### Phase 1: Core Operations (v0.5.0)

**File**: `src/memory/index.ts`

```typescript
export class MemoryAPI {
  private client: ConvexClient;
  private conversations: ConversationsAPI;
  private vector: VectorAPI;

  constructor(client: ConvexClient) {
    this.client = client;
    this.conversations = new ConversationsAPI(client);
    this.vector = new VectorAPI(client);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Core Dual-Layer Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async remember(params: RememberParams): Promise<RememberResult> {
    // Implementation here (~80 lines)
  }

  async forget(
    agentId: string,
    memoryId: string,
    options?: ForgetOptions,
  ): Promise<ForgetResult> {
    // Implementation here (~60 lines)
  }

  async get(
    agentId: string,
    memoryId: string,
    options?: GetOptions,
  ): Promise<MemoryEntry | EnrichedMemory | null> {
    // Implementation here (~50 lines)
  }

  async search(
    agentId: string,
    query: string,
    options?: SearchOptions,
  ): Promise<MemoryEntry[] | EnrichedMemory[]> {
    // Implementation here (~60 lines)
  }

  async store(agentId: string, input: MemoryInput): Promise<MemoryEntry> {
    // Implementation here (~30 lines)
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Delegations (thin wrappers)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async update(...args) {
    return this.vector.update(...args);
  }
  async delete(...args) {
    return this.vector.delete(...args);
  }
  async list(...args) {
    return this.vector.list(...args);
  }
  async count(...args) {
    return this.vector.count(...args);
  }
  // ... 8 more delegations
}
```

**File**: `src/index.ts` (main export)

```typescript
export class Cortex {
  public conversations: ConversationsAPI;
  public immutable: ImmutableAPI;
  public mutable: MutableAPI;
  public vector: VectorAPI;
  public memory: MemoryAPI; // ⭐ NEW!

  constructor(config: CortexConfig) {
    this.client = new ConvexClient(config.convexUrl);
    this.conversations = new ConversationsAPI(this.client);
    this.immutable = new ImmutableAPI(this.client);
    this.mutable = new MutableAPI(this.client);
    this.vector = new VectorAPI(this.client);
    this.memory = new MemoryAPI(this.client); // ⭐ NEW!
  }
}
```

---

## 🧪 Test Coverage Plan

### remember() Tests (~10 tests)

```typescript
describe("remember()", () => {
  it("stores both messages in ACID");
  it("creates 2 vector memories with conversationRef");
  it("links vector memories to ACID messages correctly");
  it("handles embedding generation");
  it("handles content extraction");
  it("validates importance and tags");
  it("throws error for non-existent conversation");
  it("handles partial failure gracefully");
  it("validates returned structure");
  it("ACID and Vector isolation verified");
});
```

### forget() Tests (~6 tests)

```typescript
describe("forget()", () => {
  it("deletes from vector");
  it("preserves ACID by default");
  it("deletes from ACID when deleteConversation=true");
  it("handles missing memory");
  it("handles missing conversation");
  it("validates return structure");
});
```

### Enriched get() Tests (~8 tests)

```typescript
describe("get() with enrichment", () => {
  it("returns vector only by default");
  it("enriches with ACID when includeConversation=true");
  it("fetches source messages correctly");
  it("handles missing conversation gracefully");
  it("handles multiple source messages");
  it("works for system memories (no conversationRef)");
  it("validates EnrichedMemory structure");
  it("performance: single ACID fetch");
});
```

### Enriched search() Tests (~10 tests)

```typescript
describe("search() with enrichment", () => {
  it("returns vector only by default");
  it("enriches all results when enrichConversation=true");
  it("batch fetches conversations (not N+1)");
  it("handles mixed results (some with conv, some without)");
  it("handles missing conversations gracefully");
  it("preserves search order after enrichment");
  it("validates enriched results");
  it("performance: batch ACID fetch");
  it("filters work with enrichment");
  it("limit respected after enrichment");
});
```

### store() Tests (~6 tests)

```typescript
describe("store()", () => {
  it("requires conversationRef for source.type=conversation");
  it("allows standalone for source.type=system");
  it("delegates to vector.store() correctly");
  it("validates source.type");
  it("throws error for missing conversationRef");
  it("validates return structure");
});
```

### Delegation Tests (~15 tests)

```typescript
describe("Delegations", () => {
  it("update() delegates to vector.update()");
  it("delete() delegates to vector.delete()");
  it("list() delegates to vector.list()");
  it("count() delegates to vector.count()");
  // ... 11 more delegation validations
});
```

### Integration Tests (~10 tests)

```typescript
describe("Integration", () => {
  it("remember() → search(enrich) → get(enrich) → forget() flow");
  it("ACID preserved after vector delete()");
  it("ACID deleted after forget(deleteConversation=true)");
  it("enrichment fetches correct conversations");
  it("cross-layer consistency");
  // ... more integration scenarios
});
```

**Total**: 55-75 tests estimated

---

## 🎯 v0.5.0 Release Plan

### What Gets Implemented

**Core 5 operations**:

1. ✅ `remember()` - Dual-layer storage
2. ✅ `forget()` - Dual-layer deletion
3. ✅ `get()` - With enrichment
4. ✅ `search()` - With enrichment
5. ✅ `store()` - Smart detection

**Tests**: 40-50 comprehensive tests

**Timeline**: 4-5 days

### What Gets Delayed

**12 delegations** → v0.5.1 (quick follow-up)
**`smartStore()`** → v0.6.0+ (advanced)

---

## 📦 Files to Create/Modify

### New Files

1. **`src/memory/index.ts`** - Main MemoryAPI class (~330 lines)
2. **`tests/memory.test.ts`** - E2E tests (~800 lines)

### Modified Files

1. **`src/types/index.ts`** - Add Layer 3 types (~100 lines)
2. **`src/index.ts`** - Export MemoryAPI (~5 lines)
3. **`tests/interactive-runner.ts`** - Add Layer 3 menu (~300 lines)
4. **`tests/helpers/cleanup.ts`** - No changes needed (already has all layers)

---

## ✅ Prerequisites (All Met!)

- ✅ Layer 1 complete (40 operations, 168 tests)
- ✅ Layer 2 complete (14 operations, 33 tests)
- ✅ ConversationsAPI exists and working
- ✅ VectorAPI exists and working
- ✅ All Layer 3 operations documented
- ✅ Types defined
- ✅ Usage examples in documentation

**Ready to implement!** 🚀

---

## 🎯 Success Criteria

**v0.5.0 is ready when**:

- [ ] 5 core operations implemented
- [ ] 40+ tests passing
- [ ] Integration with Layers 1 & 2 validated
- [ ] Interactive menu complete
- [ ] Documentation aligned
- [ ] No regressions in existing 201 tests

**Package**:

- Operations: 59 total (40 L1 + 14 L2 + 5 L3)
- Tests: 240+ total
- Complete foundation for AI agent memory

---

## 📄 Documentation Created

1. **`dev-docs/API-Development/04-layer-3-memory-api.md`**
   - Complete operations checklist (17 operations)
   - Implementation phases
   - TypeScript interfaces
   - Testing strategy
   - Pseudocode examples
   - Success criteria

2. **`dev-docs/API-Development/00-API-ROADMAP.md`** (updated)
   - Layer 3 added to progress table
   - Statistics updated (54/104 operations)
   - Milestone 4 added
   - Layer 3 achievements section

3. **`dev-docs/LAYER3-PLANNING-COMPLETE.md`** (this file)
   - Planning summary
   - Complete operations list
   - Implementation estimates
   - Prerequisites check

---

## 🚀 Next Actions

### To Start Implementation

```bash
# 1. Create types
# src/types/index.ts - Add RememberParams, ForgetOptions, etc.

# 2. Create MemoryAPI class
# src/memory/index.ts - New file

# 3. Start with remember()
# Most important operation, highest value

# 4. Add tests as you go
# tests/memory.test.ts - New file

# 5. Test end-to-end
# Use interactive runner
```

### To Complete v0.5.0

1. Implement 5 core operations
2. Write 40-50 tests
3. Add to interactive menu
4. Verify no regressions
5. Update CHANGELOG to v0.5.0
6. Publish!

---

## 📋 Quick Reference

**What Layer 3 does differently**:

| Feature      | Layer 2 (vector.\*)    | Layer 3 (memory.\*)          |
| ------------ | ---------------------- | ---------------------------- |
| **Store**    | Manual conversationRef | Automatic linking            |
| **Get**      | Vector only            | Vector + optional ACID       |
| **Search**   | Vector only            | Vector + optional enrichment |
| **Delete**   | Vector only            | Vector + optional ACID       |
| **API**      | Explicit               | Convenience wrapper          |
| **Use When** | Direct control needed  | Standard development         |

**Recommended**: Use `cortex.memory.*` (Layer 3) for most development.  
**Advanced**: Use `cortex.vector.*` (Layer 2) for fine-grained control.

---

**Status**: 📋 **Planning Complete - Ready to Code!**  
**Next**: Implement `remember()` first (highest priority)  
**Target**: v0.5.0 release with 5 core operations

**Let's build the friendliest memory API!** 🎊
