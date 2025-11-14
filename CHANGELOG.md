# Changelog

All notable changes to Cortex will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned for v1.0.0

- Complete API stabilization
- Integration examples for all major frameworks
- Real-time graph sync worker
- MCP Server implementation
- Cloud Mode with Graph-Premium

---

## SDK Releases

### [0.9.0] - 2024-11-14

#### 🐍 Python SDK - First Official Release!

**MAJOR:** Complete Python SDK implementation with 100% API parity!

**Full Python SDK (`cortex-memory` on PyPI):**
- 🎉 All TypeScript APIs ported to Python with Pythonic interface
- ✅ 579 comprehensive tests (100% pass rate on Python 3.10-3.14)
- 📦 Published to PyPI: `pip install cortex-memory`
- 🧪 Dual-testing infrastructure (LOCAL + MANAGED Convex, identical to TypeScript)
- 🤝 5 OpenAI integration tests (semantic search, embeddings, GPT-4o-mini summarization)
- 📊 71% code coverage and growing
- 🔒 Complete GDPR cascade deletion with verification
- 🕸️ Full Neo4j/Memgraph graph database integration
- 📡 A2A communication helpers
- 🔄 Streaming support for memory operations
- 📝 100% type annotated (PEP 561 compliant)
- ⚡ Modern async/await with AsyncIO
- 🛠️ Developer-friendly Makefile (`make test`, `make test-local`, `make test-managed`)

**Python-Specific Features:**
- `users.merge()` - Deep merge for user profiles (Python-only)
- Pythonic naming: snake_case methods and parameters
- Dataclasses for all types with full type hints
- Native Python exceptions with detailed error messages
- Comprehensive examples (chatbot, multi-agent, fact extraction, graph integration)

**Package Installation:**
```python
pip install cortex-memory              # Core SDK
pip install "cortex-memory[graph]"     # + Neo4j/Memgraph
pip install "cortex-memory[a2a]"       # + Redis pub/sub
pip install "cortex-memory[all]"       # Everything
```

**Test Parity Achieved:**
- TypeScript: 1,062 tests (6 skipped without OPENAI_API_KEY)
- Python: 579 tests (5 skipped in LOCAL mode, 2 skipped without OPENAI_API_KEY in MANAGED)
- Both SDKs include identical OpenAI integration tests
- Both use trusted publishing for secure automated releases

#### 🌊 Streaming Support & Edge Runtime Compatibility

**Major new feature: First-class streaming support for AI SDK integrations!** Added `memory.rememberStream()` method for native handling of streaming LLM responses, plus verified edge runtime compatibility for Vercel Edge Functions and Cloudflare Workers.

#### ✨ New Features

**1. Stream-Aware Memory Storage**

- **NEW:** `memory.rememberStream()` - Native streaming response support
- Accepts both `ReadableStream<string>` and `AsyncIterable<string>`
- Automatically buffers and stores complete responses
- Returns both memory result AND full response text
- Supports all existing features (embeddings, facts, graph sync)
- **28/28 comprehensive streaming tests passing** (LOCAL + MANAGED)

```typescript
const result = await cortex.memory.rememberStream({
  memorySpaceId: "agent-1",
  conversationId: "conv-123",
  userMessage: "What is the weather?",
  responseStream: stream, // ReadableStream or AsyncIterable
  userId: "user-1",
  userName: "Alex",
  generateEmbedding: embedFn, // Optional
  extractFacts: factsFn, // Optional
});

console.log("Full response:", result.fullResponse);
// result.memories, result.facts available as usual
```

**2. Stream Utility Helpers**

- **NEW:** `streamUtils.ts` - Reusable stream handling utilities
- `consumeStream()` - Auto-detects and consumes any stream type
- `consumeReadableStream()` - Web Streams API support
- `consumeAsyncIterable()` - Async generator support
- `createPassthroughStream()` - Stream observation with callbacks
- Type guards for stream detection
- Proper error handling and stream cleanup

**3. Edge Runtime Compatibility Verified**

- **19/19 edge runtime tests passing** (LOCAL + MANAGED)
- Zero Node.js-specific APIs in core SDK
- Works in Vercel Edge Functions
- Works in Cloudflare Workers
- Uses standard Web Streams API
- Uses standard `convex/browser` (edge-compatible)
- No fs, path, crypto, or other Node.js modules required

**4. New Types**

- `RememberStreamParams` - Parameters for streaming memory storage
- `RememberStreamResult` - Result with full response text
- Full TypeScript support with proper type inference

#### 🧪 Testing

**Comprehensive test coverage for streaming:**

- 28 streaming tests (14 utility + 14 integration)
- Tests ReadableStream and AsyncIterable
- Tests embeddings and fact extraction with streams
- Tests error handling (empty streams, stream errors, whitespace)
- Tests memory space isolation, hive mode, large responses (10K+ chars)
- Tests chunk boundary handling (emoji preservation)

**Edge runtime compatibility verified:**

- 19 edge environment tests
- Tests simulated edge environment (no Node.js globals)
- Tests Convex client in edge context
- Tests streaming in edge context
- Tests Web Streams API compatibility
- Tests real-world edge function scenarios

#### 📊 Test Results

- **Total: 604 tests passing** (585 + 19 edge tests)
- Streaming: 28/28 ✅
- Edge Runtime: 19/19 ✅
- All existing tests: Still passing ✅
- Tested on LOCAL and MANAGED Convex ✅

#### 🎯 Use Cases Enabled

1. **Vercel AI SDK Integration** - Stream responses directly from AI SDK
2. **Edge Function Memory** - Use Cortex in Vercel Edge Functions
3. **Cloudflare Workers** - Deploy memory-enabled agents on Cloudflare
4. **Next.js Server Components** - Stream and store in React Server Components
5. **Real-time Chat Applications** - Stream UI while storing memories

#### 🔧 API Changes

**New Methods:**

- `cortex.memory.rememberStream(params, options?)` - Store streamed responses

**New Exports:**

- `RememberStreamParams` type
- `RememberStreamResult` type
- Stream utilities (for advanced use cases)

**Backward Compatible:** All existing APIs unchanged

---

### [0.8.2] - 2025-11-02

#### 🎉 Create Cortex Memories - Interactive Setup Wizard + SDK Fix

**Major improvement to developer onboarding experience!** Introduced `npm create cortex-memories` - an interactive CLI wizard that sets up complete Cortex projects in under 5 minutes.

#### ✨ New Features

**1. Improved Memory API - Auto-Conversation Creation**

- **FIXED:** `memory.remember()` now automatically creates conversations if they don't exist
- No longer requires manual `conversations.create()` before first use
- True "convenience layer" behavior - handles 100% of stack automatically
- **NEW:** 5 comprehensive tests for auto-conversation creation behavior
- Validates auto-creation, reuse of existing, default participantId, explicit participantId, multiple calls

**Before:**

```typescript
// Required 2 steps
await cortex.conversations.create({ ... });  // Manual step
await cortex.memory.remember({ ... });
```

**After:**

```typescript
// Just one step - conversation auto-created!
await cortex.memory.remember({ ... });
```

**2. Interactive Setup Wizard**

- **NEW:** `create-cortex-memories` npm package for zero-friction project scaffolding
- Interactive prompts guide through entire setup process
- Three Convex setup options:
  - Local development (immediate start, no account needed)
  - New cloud database (with automatic Convex account setup)
  - Existing database (connect to your deployment)
- Optional graph database configuration (Neo4j/Memgraph)
- Automatic dependency installation and backend deployment

**2. Interactive Setup Wizard Updates (create-cortex-memories@0.1.1)**

- **FIXED:** Template code now correctly accesses `memory.importance` (not `memory.metadata.importance`)
- **FIXED:** Conversations API signature (`conversations.get(conversationId)`)
- **FIXED:** Docker Compose v2 compatibility (removed obsolete `version` field)
- **FIXED:** Clean exit handling (no more exit code 254)
- **NEW:** Auto-start graph database with `npm run dev`
- **NEW:** Docker daemon detection before attempting container start
- **NEW:** ESLint configuration and prepublish checks
- Better error messages for all Docker failure scenarios

**3. Improved Package Distribution**

- **FIXED:** `convex-dev/` backend functions now included in published npm package
- Backend functions automatically copied to user's project during setup
- No more manual file copying or configuration needed

**4. Enhanced Documentation**

- **NEW:** Prominent Quick Start section in README
- Step-by-step getting started guide
- Clear examples for first memory storage and search
- Instructions for adding to existing projects

#### 🏗️ What Gets Installed

When running `npm create cortex-memories@latest`:

- Cortex SDK with full TypeScript support
- Complete Convex backend functions (schema, queries, mutations)
- Environment configuration (.env.local)
- Example code demonstrating core features
- Optional graph database docker-compose setup
- Project README with next steps

#### 📦 Package Structure

**New Package:**

- `create-cortex-memories@0.1.1` - Interactive CLI wizard with bug fixes

**Updated Package:**

- `@cortexmemory/sdk@0.8.2` - Auto-conversation creation + `convex-dev/` folder included

#### 🚀 Usage

```bash
# Create new project (wizard will prompt for name)
npm create cortex-memories

# Or specify name directly
npm create cortex-memories my-ai-agent
```

#### 🎯 Developer Experience

This release dramatically simplifies the getting started experience:

- **Before:** Manual setup, copying files, configuring Convex, reading docs
- **After:** One command, interactive wizard, automatic setup, ready to code

Perfect for:

- New users trying Cortex for the first time
- Rapid prototyping and proof-of-concepts
- Workshop and tutorial scenarios
- Adding Cortex to existing projects

---

### [0.8.0] - 2025-10-31

#### 🆕 Coordination Layer APIs - Users & Agents

**Complete implementation of `cortex.users.*` and `cortex.agents.*` Coordination Layer APIs** with cascade deletion across all layers/spaces, graph orphan detection, and comprehensive testing.

#### ✨ New Features

**1. Full User CRUD Operations**

- **NEW:** `cortex.users.get(userId)` - Retrieve user profile by ID
- **NEW:** `cortex.users.update(userId, data)` - Create or update user profile (automatic versioning)
- **NEW:** `cortex.users.delete(userId, options)` - Delete user profile with optional cascade
- **NEW:** `cortex.users.list(filters)` - List user profiles with pagination
- **NEW:** `cortex.users.search(filters)` - Search user profiles
- **NEW:** `cortex.users.count(filters)` - Count user profiles
- **NEW:** `cortex.users.exists(userId)` - Check if user profile exists
- **NEW:** `cortex.users.export(options)` - Export user profiles (JSON/CSV)

**2. Version Operations**

- **NEW:** `cortex.users.getVersion(userId, version)` - Retrieve specific version of user profile
- **NEW:** `cortex.users.getHistory(userId)` - Get complete version history
- **NEW:** `cortex.users.getAtTimestamp(userId, timestamp)` - Time-travel queries

**3. GDPR Cascade Deletion (Same Code for Free SDK & Cloud Mode)**

- **NEW:** Three-phase cascade deletion: Collection → Backup → Execution with rollback
- **Deletes from ALL layers with userId**:
  - ✅ Conversations (Layer 1a)
  - ✅ Immutable records (Layer 1b)
  - ✅ Mutable keys (Layer 1c)
  - ✅ Vector memories (Layer 2)
  - ✅ Facts (Layer 3)
  - ✅ **Graph nodes** (when adapter configured)
  - ✅ User profile (deleted last)
- **Transaction-like rollback** - Automatic rollback on failure with best-effort restoration
- **Verification step** - Checks for orphaned records after deletion
- **Dry run mode** - Preview deletions without executing
- **Graph orphan detection** - Uses `deleteWithOrphanCleanup()` for proper orphan island detection
- **Detailed reporting** - Per-layer deletion counts and affected layers list

**4. Free SDK vs Cloud Mode Architecture**

- **Same Code**: Full cascade deletion implemented in open-source SDK
- **Free SDK**: Works when user provides graph adapter (DIY setup)
- **Cloud Mode Adds**: Legal certificates, GDPR liability guarantees, managed graph adapter, compliance audit trail
- **Graph Integration**: Cascade includes graph nodes when adapter configured
- **Orphan Cleanup**: Automatically detects and removes orphan islands during cascade

#### 📊 Type Additions

**New Interfaces:**

- `UserProfile` - User profile with version and timestamps
- `UserVersion` - Historical version snapshot
- `DeleteUserOptions` - Cascade, verify, and dry run options
- `UserDeleteResult` - Comprehensive deletion report with per-layer counts
- `DeletionPlan` - Collection phase result
- `DeletionBackup` - Rollback snapshots
- `VerificationResult` - Post-deletion verification
- `ListUsersFilter`, `UserFilters`, `ExportUsersOptions`

**New Error Class:**

- `CascadeDeletionError` - Thrown on cascade deletion failures (after rollback)

#### 🏗️ Architecture

**Convex Backend:**

- **NEW:** `convex-dev/users.ts` - Backend queries/mutations for user operations
- Delegates to `immutable.*` with `type='user'`
- Cascade deletion orchestrated in SDK layer for better control

**SDK Layer:**

- **NEW:** `src/users/index.ts` - UsersAPI class with 1000+ lines
- **NEW:** Integration with graph orphan detection system
- **UPDATED:** `src/index.ts` - Added `users` property to Cortex class
- **UPDATED:** `src/types/index.ts` - Added 9 user-related type definitions

#### 🧪 Testing

**Comprehensive Test Suite:**

- **NEW:** `tests/users.test.ts` - 23 E2E tests covering all operations
- **Tests cover**:
  - All CRUD operations with storage validation
  - Version operations (getVersion, getHistory, getAtTimestamp)
  - Simple deletion (profile only)
  - Full cascade deletion across all layers
  - **Graph integration** (automatic when env vars set)
  - Dry run mode
  - Verification with/without graph adapter
  - Export (JSON & CSV)
  - Edge cases (non-existent users, concurrent updates)
  - Integration with other APIs
- **Graph testing**: Automatically detects NEO4J_URI env vars and tests graph cascade
- **All tests pass**: 23/23 on both LOCAL and MANAGED environments

**Test Results:**

```
✅ Graph cascade: Deleted 1 nodes
✅ Integration test complete: Deleted from 4 layers
   Layers: vector, conversations, graph, user-profile
🎉 SUCCESS: All test suites passed!
   ✅ Local tests: PASSED (23 tests)
   ✅ Managed tests: PASSED (23 tests)
```

#### 📚 Documentation

**UPDATED:** `Documentation/03-api-reference/04-user-operations.md`

- Complete API reference for all user operations
- Clear free SDK vs Cloud Mode differentiation
- Graph integration examples with DIY adapter setup
- Implementation details (three-phase approach)
- Multiple code examples for each operation

#### 🎯 Key Achievements

**Free SDK vs Cloud Mode Strategy Validated:**

- ✅ Same code works for both free and managed deployments
- ✅ Graph cascade works with DIY adapter (free) or managed adapter (Cloud)
- ✅ Differentiation is legal guarantees, not technical restrictions
- ✅ Orphan detection included in free SDK

**Production Ready:**

- ✅ 23 comprehensive E2E tests (100% passing)
- ✅ Storage validation for all operations
- ✅ Graph integration tested with both Neo4j and Memgraph
- ✅ Transaction-like rollback on failures
- ✅ Orphan detection and island cleanup
- ✅ No linter errors

#### 🆕 Agents API - Optional Registry with Cascade Deletion

**Complete implementation of `cortex.agents.*` API** for optional metadata registration and convenient cascade deletion by participantId.

#### ✨ New Features (Agents API)

**1. Agent Registry Operations (8 operations)**

- **NEW:** `cortex.agents.register(agent)` - Register agent with metadata, capabilities, team info
- **NEW:** `cortex.agents.get(agentId)` - Get registered agent by ID (returns null if not registered)
- **NEW:** `cortex.agents.list(filters)` - List agents with pagination and status filters
- **NEW:** `cortex.agents.search(filters)` - Search by metadata, capabilities, team
- **NEW:** `cortex.agents.count(filters)` - Count registered agents
- **NEW:** `cortex.agents.update(agentId, updates)` - Update agent metadata
- **NEW:** `cortex.agents.configure(agentId, config)` - Configure agent settings
- **NEW:** `cortex.agents.exists(agentId)` - Check if agent is registered
- **NEW:** `cortex.agents.unregister(agentId, options)` - Remove from registry with optional cascade

**2. Cascade Deletion by participantId (Convenience Feature)**

- **NEW:** Delete all agent data across ALL memory spaces in one call
- **Filters by participantId** (not userId) - queries actual data field
- **Works even if agent never registered** - queries data, not registry
- **Three-phase deletion**: Collection → Backup → Execution with rollback
- **Deletes from**:
  - ✅ Conversations (where participantId in participants)
  - ✅ Memories (where participantId matches)
  - ✅ Facts (where participantId matches)
  - ✅ Graph nodes (where participantId property matches)
  - ✅ Agent registration (deleted last)
- **Transaction-like rollback** - Automatic rollback on failure
- **Verification step** - Checks for orphaned records across all spaces
- **Dry run mode** - Preview deletions without executing
- **Graph orphan detection** - Uses `deleteWithOrphanCleanup()` for proper island cleanup
- **Cross-space summary** - Reports which memory spaces were affected

**3. Agent Statistics**

- **NEW:** Automatic stat computation from actual data (memories, conversations, facts)
- Returns: total memories, conversations, facts, active memory spaces, last active time
- Works for registered and unregistered agents

**4. Optional by Design**

- Agents work without registration (just use string IDs)
- Registration provides: discovery, analytics, team organization, cascade deletion
- Metadata-only layer - doesn't affect core functionality

#### 📊 Type Additions (Agents API)

**New Interfaces:**

- `AgentRegistration` - Registration parameters with metadata/config
- `RegisteredAgent` - Complete agent record with stats
- `AgentStats` - Statistics computed from actual data
- `AgentFilters` - Search/filter parameters with metadata matching
- `UnregisterAgentOptions` - Cascade, verify, and dry run options
- `UnregisterAgentResult` - Comprehensive deletion report with space tracking
- `AgentDeletionPlan` - Collection phase result with affected spaces
- `AgentDeletionBackup` - Rollback snapshots

**New Error Class:**

- `AgentCascadeDeletionError` - Thrown on cascade deletion failures (after rollback)

#### 🏗️ Architecture (Agents API)

**Convex Backend:**

- **NEW:** Updated `convex-dev/schema.ts` - Full agents table with status, metadata, config
- **NEW:** `convex-dev/agents.ts` - Backend queries/mutations (8 operations)
- Separate storage from users (dedicated agents table)
- Cascade deletion orchestrated in SDK layer

**SDK Layer:**

- **NEW:** `src/agents/index.ts` - AgentsAPI class (~500 lines)
- **NEW:** Integration with graph orphan detection system
- **UPDATED:** `src/index.ts` - Added `agents` property to Cortex class
- **UPDATED:** `src/types/index.ts` - Added 9 agent-related type definitions

#### 🧪 Testing (Agents API)

**Comprehensive Test Suite:**

- **NEW:** `tests/agents.test.ts` - 20 E2E tests covering all operations
- **Tests cover**:
  - All registry operations (register, get, list, search, count, update, configure, exists)
  - Simple unregister (no cascade)
  - Full cascade deletion across multiple memory spaces
  - **Cascade without registration** (proves participantId-based queries work)
  - **Graph integration** (automatic when env vars set)
  - Dry run mode
  - Verification with/without graph adapter
  - Statistics computation
  - Edge cases (non-existent agents, no data, etc.)
- **Graph testing**: Automatically detects NEO4J_URI env vars and tests graph cascade
- **All tests pass**: 20/20 on both LOCAL and MANAGED environments

**Test Results:**

```
✅ Created graph node for cascade test
✅ Graph node deleted
✅ Cascade complete: Deleted from 2 spaces
   Layers: memories, conversations, graph, agent-registration
✅ Cascade works without registration (queries by participantId in data)
🎉 SUCCESS: All test suites passed!
   ✅ Local tests: PASSED (20 tests)
   ✅ Managed tests: PASSED (20 tests)
```

#### 📚 Documentation (Agents API)

**UPDATED:** `Documentation/03-api-reference/09-agent-management.md`

- Complete API reference for all agent operations
- Cascade deletion implementation details
- Comparison table: users (userId) vs agents (participantId)
- Graph integration examples
- 4 comprehensive code examples including cascade without registration

**UPDATED:** `Documentation/00-README.md`

- Added Agent Management to coordination section
- Marked as complete with checkmarks

**UPDATED:** `Documentation/03-api-reference/01-overview.md`

- Added Agent Management API to navigation
- Marked Users and Agents as complete

**UPDATED:** `README.md`

- Added "What's New in v0.8.0" section for both APIs
- Updated features list with completion status

#### 🎯 Key Achievements (Combined Users + Agents)

**Cascade Deletion Patterns:**

- ✅ **Users API**: Cascade by `userId` for GDPR compliance
- ✅ **Agents API**: Cascade by `participantId` for convenience cleanup
- ✅ Both use three-phase deletion with rollback
- ✅ Both include graph orphan detection
- ✅ Both work regardless of registration status

**Production Ready:**

- ✅ 43 comprehensive E2E tests (23 users + 20 agents) - 100% passing
- ✅ Storage validation for all operations
- ✅ Graph integration tested with both Neo4j and Memgraph
- ✅ Transaction-like rollback on failures
- ✅ Orphan detection and island cleanup
- ✅ No linter errors

#### 🔗 Related Issues

- Implements Coordination Layer Users and Agents APIs from roadmap
- Closes gap: 4 pending APIs → 1 pending API (only A2A Communication remaining)
- Progress: 89% of APIs complete (8/9)

---

### [0.7.1] - 2025-10-31

#### 🔗 Facts Layer Integration into Memory API

**Complete integration of the Facts layer across all Memory API operations**, creating a unified three-layer pipeline: ACID → Vector → Facts.

#### ✨ New Features

**1. Automatic Fact Extraction**

- **NEW:** `extractFacts` callback in `memory.remember()` - Automatically extracts and stores structured facts during conversation storage
- **NEW:** `extractFacts` callback in `memory.store()` - Direct memory storage with fact extraction
- Facts are automatically linked to source memories and conversations via `sourceRef.memoryId`
- Complete error handling - extraction failures don't break memory storage

**2. Cascade Delete System**

- **UPDATED:** `memory.forget()` - Now cascade deletes associated facts with audit trail
- **UPDATED:** `memory.delete()` - Cascade deletes facts by default (configurable via `cascadeDeleteFacts` option)
- **UPDATED:** `memory.deleteMany()` - Batch cascade delete with complete factId tracking
- **UPDATED:** `memory.archive()` - Marks facts as expired instead of deleting
- All delete operations return `factsDeleted` count and `factIds` array for compliance logging

**3. Automatic Fact Enrichment**

- **UPDATED:** `memory.get()` - Includes related facts when `includeConversation: true`
- **UPDATED:** `memory.search()` - Batch enriches results with facts using efficient lookup maps
- **UPDATED:** `memory.list()` - Optional fact enrichment via `enrichFacts: true` flag
- **UPDATED:** `memory.export()` - Includes facts in JSON exports when `includeFacts: true`

**4. Fact Impact Tracking**

- **UPDATED:** `memory.update()` - Supports fact re-extraction via `reextractFacts` option
- **UPDATED:** `memory.updateMany()` - Returns `factsAffected` count for impact analysis

#### 📊 Type Additions

**New Result Types:**

- `RememberResult` - Added `facts: FactRecord[]`
- `ForgetResult` - Added `factsDeleted: number` and `factIds: string[]`
- `DeleteMemoryResult` - New interface with fact tracking
- `DeleteManyResult` - New interface with batch fact tracking
- `ArchiveResult` - New interface with fact archival tracking
- `UpdateManyResult` - New interface with fact impact tracking
- `StoreMemoryResult` - New interface with extracted facts
- `UpdateMemoryResult` - New interface with re-extracted facts

**Updated Types:**

- `EnrichedMemory` - Added `facts?: FactRecord[]`
- `RememberParams` - Added `extractFacts` callback
- `StoreMemoryInput` - Added `extractFacts` callback
- `ListMemoriesFilter` - Added `enrichFacts?: boolean`
- `ExportMemoriesOptions` - Added `includeFacts?: boolean`

**New Options Interfaces:**

- `DeleteMemoryOptions` - With `cascadeDeleteFacts` flag
- `UpdateMemoryOptions` - With `reextractFacts` and `extractFacts` callback

#### 🧹 Code Quality & Linting

**Complete ESLint Error Resolution:**

- **FIXED:** All 38 TypeScript compilation errors resolved
  - Type safety improvements for `SourceType` (added "a2a" support)
  - Null/undefined handling in conversation enrichment
  - Removed all unused imports and variables
- **FIXED:** 390 of 462 ESLint warnings (84% reduction)
  - Excluded Convex backend from strict type checking (external framework)
  - Fixed 9 floating promise warnings in test cleanup
  - Added proper eslint-disable comments for intentional console logging
  - Improved type safety with `Record<string, unknown>` for metadata fields

**Type Safety Improvements:**

- Enhanced Context types: `data` and `metadata` now properly typed
- Added generic type parameter to `mutable.update<T>()` for type-safe updates
- Improved fact metadata typing across all interfaces
- Neo4j driver interactions properly annotated as external library code

**Test Suite Validation:**

- ✅ All 19 test suites passing (534 tests total)
- ✅ E2E multi-layer graph integration tests passing
- ✅ Both local and managed test environments verified
- Fixed test compatibility with stricter type checking

#### 🏗️ Architecture Improvements

**Helper Methods:**

- `cascadeDeleteFacts()` - Finds and deletes facts linked to memory/conversation
- `archiveFacts()` - Marks facts as expired for soft delete
- `fetchFactsForMemory()` - Efficient fact retrieval

**SourceRef Enhancement:**

- Facts now store `memoryId` in addition to `conversationId` for bidirectional linking
- Enables efficient fact lookup by memory or conversation

#### 📚 Documentation

**New Guides:**

- `Documentation/02-core-features/11-fact-integration.md` - Complete integration guide
- `Documentation/03-api-reference/14-facts-operations.md` - Full Facts API reference

**Updated Guides:**

- `Documentation/02-core-features/02-semantic-search.md` - Added fact integration section
- `Documentation/00-README.md` - Updated navigation and changelog

#### 🧪 Testing

**New Test Suite:**

- `tests/memory-facts-integration.test.ts` - Comprehensive fact integration tests
  - Fact extraction during `remember()`
  - Error handling for failed extractions
  - Cascade delete validation
  - Fact enrichment in `get()` and `search()`
  - Multiple fact extraction
  - SourceRef linking verification

#### 🔄 Backward Compatibility

✅ **Zero breaking changes**

- All fact operations are optional
- Existing code works without modifications
- Facts only extracted when callback provided
- Cascade delete can be disabled via options
- No performance impact when facts not used

#### 🎯 Impact

This release completes the three-layer memory architecture, enabling:

- **Structured knowledge extraction** from unstructured conversations
- **Automatic fact lifecycle management** (create, read, update, delete)
- **Complete audit trails** for compliance and debugging
- **Enhanced retrieval** with fact-based context enrichment
- **Consistent API** - facts integrated across all 11+ memory operations

---

### [0.7.0] - 2025-10-31

#### 🎉 MAJOR RELEASE: Graph Database Integration (Phase 1 & 2)

**This is a landmark release** that adds complete graph database integration to Cortex, enabling advanced relationship queries, knowledge discovery, and multi-layer context enrichment.

#### ✨ Major New Features

**1. Complete Graph Database Integration**

- **NEW MODULE:** `cortex.graph.*` - Full graph database support
- **Supported Databases:** Neo4j Community, Memgraph (primary), Kùzu (experimental)
- **GraphAdapter Interface:** Database-agnostic API for graph operations
- **CypherGraphAdapter:** Production-ready Neo4j/Memgraph implementation
- Works interchangeably with both databases using same Bolt protocol and Cypher language

**2. Multi-Layer Sync System**

- **Sync Utilities:** Complete entity and relationship synchronization
- **15+ Relationship Types:** PARENT_OF, CHILD_OF, MENTIONS, REFERENCES, WORKS_AT, KNOWS, etc.
- **Entity Extraction:** Automatic entity node creation from facts
- **Schema Management:** 8 unique constraints, 22 performance indexes
- **Batch Sync:** Initial sync for existing data with progress tracking

**3. Sophisticated Orphan Detection**

- **Circular-Reference Safe:** Handles A→B, B→A patterns correctly
- **Orphan Island Detection:** Detects and cleans up disconnected circular groups
- **BFS Algorithm:** Visitor tracking prevents infinite loops
- **Entity-Specific Rules:** Configurable orphan rules per node type (Conversation, Entity, etc.)
- **Cascade Deletes:** Automatic cleanup of orphaned nodes on delete operations

**4. Systematic syncToGraph Integration**

- **25 New Option Interfaces:** Consistent `syncToGraph?: boolean` pattern across all APIs
- **Auto-Sync:** `memory.remember()` defaults to `syncToGraph: true` if graph configured
- **Manual Sync:** Low-level APIs (vector, facts, contexts) use opt-in `syncToGraph` option
- **Delete Cascading:** `memory.forget()` cascades deletes with orphan cleanup
- **15+ API Methods Enhanced:** Vector, Facts, Contexts, Conversations, MemorySpaces, and more

**5. Graph Configuration in Cortex**

- **NEW Config:** `CortexConfig.graph` - Optional graph database configuration
- **GraphAdapter Parameter:** Flows through entire SDK
- **Backward Compatible:** Existing code works without graph (zero overhead)
- **Clean Paths:** No graceful failing - graph either works or is skipped cleanly

#### 🎯 Value Proposition Validated

**Multi-Layer Retrieval Enhancement (Proof #7):**

- Query "alice typescript" returns 2 base results (L2 + L3)
- Graph enrichment discovers: +4 connected pieces (conversations, contexts, entity network)
- **Enrichment Factor:** 2-5x more context for <100ms overhead
- **Provenance Trails:** Complete audit trail from memory back to source conversation
- **Knowledge Discovery:** Multi-hop entity relationships (Alice → Company → Bob → TypeScript)

#### 📊 Testing & Validation

**Comprehensive Test Coverage:**

- ✅ **29/29 Tests Passing** (15 unit tests + 14 E2E tests)
- ✅ **7 Comprehensive Proofs** (basic CRUD, sync workflow, context chains, fact graphs, performance, agent networks, multi-layer enhancement)
- ✅ **Validated on:** Neo4j Community (100%), Memgraph (80%)
- ✅ **Both Convex Modes:** LOCAL and MANAGED deployments

**End-to-End Multi-Layer Test:**

- Complex 3,142-character realistic input
- Validates complete cascade: L1a → L2 → L3 → L4 → Graph
- Proves: Storage, retrieval, relationships, provenance, discovery
- **Result:** 18 nodes, 39 relationships, 5x enrichment demonstrated

#### 🏗️ Infrastructure

**Development Setup:**

- **Docker Compose:** Neo4j + Memgraph ready in <5 minutes
- **Environment Variables:** Clean configuration pattern
- **Documentation:** 15+ comprehensive documents (setup, integration, proofs, architecture)

**Code Quality:**

- Zero critical linter errors (2 non-critical warnings)
- Full TypeScript type safety
- Production-grade error handling
- Non-failing graph operations (graceful degradation)

#### 🔧 API Changes

**New Exports:**

```typescript
// Graph module
export { CypherGraphAdapter } from "@cortexmemory/sdk/graph";
export {
  initializeGraphSchema,
  verifyGraphSchema,
} from "@cortexmemory/sdk/graph";
export {
  syncMemoryToGraph,
  syncFactToGraph,
  syncContextToGraph,
} from "@cortexmemory/sdk/graph";
export {
  deleteMemoryFromGraph,
  deleteFactFromGraph,
} from "@cortexmemory/sdk/graph";
export type {
  GraphAdapter,
  GraphNode,
  GraphEdge,
  GraphPath,
} from "@cortexmemory/sdk";

// Enhanced Cortex config
export interface CortexConfig {
  convexUrl: string;
  graph?: {
    adapter: GraphAdapter;
    orphanCleanup?: boolean;
  };
}
```

**Enhanced API Methods:**

```typescript
// All methods now support syncToGraph option
await cortex.vector.store(memorySpaceId, data, { syncToGraph: true });
await cortex.facts.store(params, { syncToGraph: true });
await cortex.contexts.create(params, { syncToGraph: true });
await cortex.memory.remember(params, { syncToGraph: true }); // Default: true if graph configured
await cortex.memory.forget(memoryId, {
  syncToGraph: true,
  deleteConversation: true,
}); // With cascade
```

#### 📦 Dependencies

**Added:**

- `neo4j-driver` ^5.15.0 - Official Neo4j/Memgraph driver (78 packages)

#### 📚 Documentation

**New Documentation:**

- `Documentation/07-advanced-topics/05-graph-database-setup.md` - Quick setup guide
- `src/graph/README.md` - Module documentation and API reference
- `dev-docs/E2E-TEST-RESULTS.md` - Complete test validation results
- `dev-docs/GRAPH-INTEGRATION-COMPLETE.md` - Implementation summary
- 10+ additional architecture and proof documentation files

**Updated Documentation:**

- `Documentation/07-advanced-topics/02-graph-database-integration.md` - Integration patterns
- `Documentation/07-advanced-topics/04-graph-database-selection.md` - Database comparison

#### 📈 Performance Characteristics

**From Comprehensive Testing:**

- **Sync Speed:** ~300 entities/second in batch mode
- **Query Speed:** 4ms for 7-hop traversal (vs 15ms sequential Convex queries)
- **Enrichment Overhead:** +90ms for 2-5x more context
- **Speedup:** 3.8x faster for deep hierarchies (7+ levels)

**Recommendation:**

- Use Graph-Lite (built-in) for 1-3 hop queries and small datasets
- Use Native Graph for 4+ hop queries, large datasets, and complex patterns

#### 🎓 Key Design Decisions

1. **Graph as Enhancement Layer** - Optional, enhances existing functionality
2. **Convex as Source of Truth** - All writes go to Convex first
3. **Opt-In Sync** - Low-level APIs require explicit `syncToGraph: true`
4. **Auto-Sync in Convenience** - `memory.remember()` syncs by default
5. **Sophisticated Orphan Cleanup** - Circular-reference safe deletion
6. **Configuration-Driven** - Graph features only active if configured

#### 🔄 Migration Guide

**No Breaking Changes** - Graph integration is completely optional:

```typescript
// Existing code works unchanged
const cortex = new Cortex({ convexUrl: "..." });
await cortex.memory.remember(params); // Works as before

// Add graph with one config change
const cortex = new Cortex({
  convexUrl: "...",
  graph: { adapter: graphAdapter }, // NEW - optional
});
await cortex.memory.remember(params); // Now auto-syncs to graph!
```

#### 🐛 Bug Fixes

- Fixed Context type export in `src/index.ts`
- Fixed entity node creation to use find-or-create pattern (prevents duplicates)
- Fixed delete cascade to handle both Neo4j (`elementId`) and Memgraph (`id`) functions
- Fixed circular reference detection in orphan cleanup algorithm

#### ⚠️ Known Limitations

- **Memgraph Compatibility:** ~80% (shortestPath not supported, use traversal instead)
- **Real-time Sync:** Phase 2 feature (manual sync fully functional)
- **High-Level GraphAPI:** Planned for future release (low-level adapter fully functional)

#### 📊 Release Statistics

- **Files Created:** 43+
- **Lines Added:** ~8,500
- **Tests Added:** 22 (15 unit + 7 proofs + 14 E2E)
- **Documentation:** 15+ files
- **Implementation Time:** 8 hours (comprehensive session)

#### 🎯 Use Cases

**When to Use Graph Integration:**

- Deep context chains (5+ levels)
- Knowledge graphs with entity relationships
- Multi-hop reasoning requirements
- Provenance and audit trail needs
- Complex multi-agent coordination
- Large-scale fact databases (100s+ facts)

**When Graph-Lite Suffices:**

- Simple 1-3 hop queries
- Small datasets (<50 entities)
- Basic hierarchies
- No complex pattern matching needs

#### 🙏 Acknowledgments

Special thanks to the Convex team for reactive query patterns and the Neo4j community for excellent graph database documentation.

---

### [0.6.0] - 2025-10-30

#### 🚀 REVOLUTIONARY RELEASE: Memory Space Architecture

**This is a transformative release** that fundamentally reimagines how AI agents manage memory. The Memory Space Architecture introduces flexible isolation boundaries, eliminates data duplication, and enables unprecedented collaboration patterns.

#### ✨ Major New Features

**1. Memory Spaces - Flexible Isolation Boundaries**

- **NEW API:** `cortex.memorySpaces.*` - Registry for managing memory spaces
- Supports personal, team, project, and custom memory spaces
- Each space is an isolated container with its own conversations, memories, and facts
- Replaces rigid per-agent isolation with flexible, use-case-driven boundaries
- **Breaking Change:** All APIs now use `memorySpaceId` instead of `agentId`

**2. Hive Mode - Multi-Tool Shared Memory**

- **Game-Changer:** Multiple tools/agents can share ONE memory space
- Eliminates data duplication across tools serving the same user
- `participantId` field tracks which tool/agent contributed what
- Example: Calendar, email, and task tools all write to user's personal hive
- **Result:** No more syncing data between tool-specific databases

**3. Facts Store - Structured Knowledge Layer**

- **NEW API:** `cortex.facts.*` - Layer 3 structured knowledge extraction
- Store facts as semantic triples (subject-predicate-object)
- Immutable version chains with supersedes/supersededBy linking
- Graph-like queries without graph database: `queryBySubject()`, `queryByRelationship()`
- Export to JSON-LD for semantic web compatibility
- **Enables:** Infinite Context capability (retrieve from 10,000+ messages instantly)

**4. Context Chains - Hierarchical Workflow Coordination**

- **NEW API:** `cortex.contexts.*` - Multi-agent workflow coordination
- Parent-child context relationships for task delegation
- Cross-space context sharing for Collaboration Mode
- `grantAccess()` enables secure context sharing between organizations
- Links to source conversations for complete audit trail

**5. Collaboration Mode - Cross-Space Secure Sharing**

- Organizations with separate memory spaces can collaborate
- Shared contexts coordinate workflows across boundaries
- Data stays isolated, only context metadata is shared
- Example: Company A and Company B on joint project with private data

**6. Infinite Context Capability**

- Facts enable instant retrieval from massive conversation histories
- Extract structured knowledge during conversation
- Retrieve specific facts without scanning 10,000+ messages
- **Token Savings:** Query facts instead of passing entire conversation to LLM

#### 🔧 Breaking Changes

**⚠️ BREAKING: API Parameter Changes**

All memory-scoped operations now use `memorySpaceId` instead of `agentId`:

```typescript
// OLD (v0.5.x)
await cortex.vector.store("agent-123", {...});
await cortex.conversations.create({
  type: "user-agent",
  participants: { userId: "user-1", agentId: "agent-123" },
});

// NEW (v0.6.0)
await cortex.vector.store("memspace-123", {...});
await cortex.conversations.create({
  memorySpaceId: "memspace-123",
  type: "user-agent",
  participants: { userId: "user-1", participantId: "agent-123" },
});
```

**Migration Guide:**

1. Rename all `agentId` parameters to `memorySpaceId`
2. In conversation participants, rename `agentId` to `participantId`
3. Update to Hive Mode: Consolidate multiple agent IDs into single memory space
4. Add `participantId` to track contributors (optional but recommended)

**What's NOT Breaking:**

- `immutable.*` and `mutable.*` APIs unchanged (intentionally shared)
- User APIs unchanged
- All data structures compatible (simple field rename)

#### 🎁 New APIs

**cortex.facts.\*** (Layer 3)

- `store()` - Create structured facts
- `get()` - Retrieve by factId
- `list()` - Filter by factType, subject, tags
- `count()` - Count facts
- `search()` - Keyword search across facts
- `update()` - Create new version (immutable chain)
- `delete()` - Soft delete (marks invalid)
- `getHistory()` - Complete version chain
- `queryBySubject()` - Entity-centric queries
- `queryByRelationship()` - Graph traversal
- `export()` - JSON/JSON-LD/CSV export
- `consolidate()` - Merge duplicate facts

**cortex.memorySpaces.\*** (Layer 4)

- `register()` - Create memory space
- `get()` - Retrieve space
- `list()` - Filter by type/status
- `count()` - Count spaces
- `update()` - Modify metadata
- `delete()` - Remove space (with optional cascade)
- `addParticipant()` - Add participant to space
- `removeParticipant()` - Remove participant
- `getStats()` - Aggregate statistics across all layers
- `findByParticipant()` - Find spaces for participant

**cortex.contexts.\*** (Layer 4)

- `create()` - Create root or child context
- `get()` - Retrieve with optional chain
- `update()` - Modify status/data
- `delete()` - Remove with optional cascade
- `list()` - Filter by memorySpace, status, depth
- `count()` - Count contexts
- `search()` - Search contexts
- `getChain()` - Complete hierarchy
- `getRoot()` - Walk to root
- `getChildren()` - Direct/recursive children
- `addParticipant()` - Add to context
- `grantAccess()` - Enable cross-space collaboration

#### ✅ Enhanced Existing APIs

**All Layer 2 (Vector) APIs Updated:**

- `vector.*` and `memory.*` now use `memorySpaceId`
- Added optional `participantId` for Hive Mode tracking
- Memory space isolation enforced
- Permission validation added

**All Layer 1 (Conversations) APIs Updated:**

- `conversations.*` now use `memorySpaceId`
- Participant tracking in `participantId` field
- Support for agent-agent conversations with `memorySpaceIds` array
- Enhanced filtering by memory space

#### 🧪 Testing Improvements

**Comprehensive Test Suite:**

- **NEW:** 5 new test suites (facts, memorySpaces, contexts, hiveMode, integration)
- **UPDATED:** 6 existing suites for memorySpaceId
- **Total:** 378 tests across 11 test suites
- **Coverage:** 756 test executions (378 LOCAL + 378 MANAGED)
- **Success Rate:** 100% on both environments ✅

**New Test Suites:**

- `facts.test.ts` - 53 tests validating structured knowledge
- `memorySpaces.test.ts` - 29 tests for registry management
- `contexts.test.ts` - 31 tests for workflow coordination
- `hiveMode.test.ts` - 8 tests for multi-tool scenarios
- `integration.test.ts` - 7 complex multi-layer scenarios

**Infrastructure:**

- Updated cleanup helpers for all 8 tables
- Added `purgeAll()` to facts, contexts, memorySpaces backends
- Updated `scripts/cleanup-test-data.ts` for comprehensive cleanup
- Created `tests/README.md` explaining all 378 tests

#### 📊 Database Schema Updates

**New Tables:**

- `facts` - Structured knowledge with versioning (7 indexes)
- `contexts` - Workflow coordination (6 indexes)
- `memorySpaces` - Registry with participants (1 index)

**Updated Tables:**

- `conversations` - Added `memorySpaceId`, `participantId`
- `memories` - Added `memorySpaceId`, `participantId` (renamed from agentId)
- Added 8 new indexes for memory space queries

**Deprecated:**

- `agents` table (use `memorySpaces` instead)

#### 📖 Documentation Overhaul

**50+ Files Updated (~24,000 lines):**

- Complete Memory Space Architecture documentation
- New guides: Hive Mode, Infinite Context, Facts Extraction
- All 13 API references updated for memorySpaceId
- All 9 architecture documents updated
- Integration guides for graph databases
- Comprehensive test documentation

**New Documentation:**

- `02-core-features/01-memory-spaces.md` - Complete guide (renamed from agent-memory.md)
- `02-core-features/08-fact-extraction.md` - Facts layer guide
- `02-core-features/10-hive-mode.md` - Hive vs Collaboration modes
- `03-api-reference/13-memory-space-operations.md` - New API reference
- `04-architecture/10-infinite-context.md` - Breakthrough capability
- `07-advanced-topics/03-facts-vs-conversations.md` - Storage strategy analysis
- `tests/README.md` - Complete test suite documentation

#### 🎯 Performance Improvements

- **Hive Mode:** Single query vs N queries (N = number of tools)
- **Facts:** O(1) retrieval vs O(N) message scanning
- **Memory Spaces:** Consolidated storage reduces duplication
- **Indexes:** 8 new indexes for optimized queries

#### 🔐 Security & Compliance

- **GDPR:** All layers support `userId` for cascade deletion
- **Isolation:** Memory space boundaries enforced at database level
- **Access Control:** `grantAccess()` for explicit cross-space sharing
- **Audit Trail:** Complete traceability via conversationRef/sourceRef

#### 🐛 Bug Fixes

- Fixed memory space isolation in get/delete operations
- Fixed search index to use memorySpaceId instead of agentId
- Fixed version chain traversal in getHistory (facts)
- Updated all test helpers for new table structure

#### 📝 Migration Notes

**Automatic Compatibility:**

- Data structures are compatible (field rename only)
- No data migration required for simple rename
- Existing agent-based code can map agentId → memorySpaceId 1:1

**Recommended Migration Path:**

1. Update all `agentId` references to `memorySpaceId`
2. Update conversation participants structure
3. Consider consolidating related agents into Hive spaces
4. Add `participantId` tracking for multi-tool scenarios
5. Leverage Facts API for infinite context capability

**For Hive Mode Migration:**

- Consolidate tool-specific memory spaces into shared hives
- Add `participantId` to track contributors
- Use `memorySpaces.register()` to define hive membership

#### 🌟 Key Benefits

**For Developers:**

- More flexible than per-agent isolation
- Hive Mode eliminates cross-tool data sync
- Facts enable instant retrieval from long conversations
- Context chains simplify multi-agent workflows

**For Users:**

- Better cross-tool memory sharing
- No more "calendar doesn't know what email knows"
- Faster responses (fewer LLM context tokens)
- More accurate structured knowledge

**For Enterprises:**

- Secure cross-organization collaboration
- Complete audit trails
- GDPR-compliant data management
- Scalable to thousands of memory spaces

#### 🔗 Related

- **Memory Space Architecture:** See `Internal Docs/04-MEMORY-SPACE-ARCHITECTURE.md`
- **Hive Mode Guide:** See `Documentation/02-core-features/10-hive-mode.md`
- **Facts Layer:** See `Internal Docs/01-FACTS-LAYER-ARCHITECTURE.md`
- **Migration Guide:** See `Documentation/MIGRATION-v0.6.0.md` (coming soon)

---

### [0.5.1] - 2025-10-27

#### 🐛 Critical Bug Fixes & Testing Improvements

Six critical bugs identified through comprehensive testing and agent review, all verified and fixed.

#### Fixed

**Critical Performance & Correctness Issues**:

1. **Vector Search Local/Managed Fallback** - Added proper try/catch fallback for local Convex deployments
   - Local Convex doesn't support `.similar()` API (verified via Context7 documentation lookup)
   - Now gracefully falls back to manual cosine similarity in local dev
   - Production/managed deployments use optimized database vector indexing
   - Eliminates `TypeError: r.similar is not a function` errors

2. **Environment Variable Loading Order** - Fixed precedence for test configuration
   - Split `setup.ts` into `env.ts` (loads first) and `setup.ts` (hooks only)
   - Changed Jest config to use `setupFiles` for environment (before modules load)
   - Reversed order: `.env.test` first, `.env.local` second with `override: true`
   - Now local settings properly override test defaults AND system environment variables

3. **Cosine Similarity Dimension Validation** - Fixed mathematically incorrect similarity scores
   - Previously used `Math.min()` to handle mismatched dimensions (WRONG)
   - Example: 1536-dim query vs 768-dim stored only compared 768 dims, producing incorrect scores
   - Now validates dimensions match before calculating similarity
   - Filters out mismatched embeddings with clear -1 score marker

4. **purgeAll Security Vulnerability** - Added environment checks to prevent production misuse
   - Was completely unprotected - anyone could delete ALL memories
   - Violated agent isolation principle used throughout codebase
   - Now checks: `CONVEX_SITE_URL`, `NODE_ENV`, `CONVEX_ENVIRONMENT`
   - Allows: localhost, 127.0.0.1, .convex.site, .convex.cloud (dev), test environments
   - Blocks: Production deployments with clear error message

**Test Quality Improvements**:

5. **Semantic Search Test Validation** - Strengthened test to validate ranking quality
   - Previously used `.find()` to match ANY result (could match low-ranked results)
   - Now validates `results[0]` (top-ranked result) contains expected content
   - Ensures semantic search returns MOST relevant result first
   - Better debugging output shows all top results with match indicators

6. **Test Cleanup Fragility** - Eliminated hardcoded agent ID maintenance burden
   - Consolidated duplicate cleanup logic into shared `TestCleanup` helper
   - Added `purgeMemories()` method using new `memories.purgeAll` mutation
   - Removed hardcoded agent ID lists (was fragile, required maintenance)
   - Now purges ALL memories regardless of agent ID (safe for test environments)
   - Future-proof: new tests with any agent ID automatically cleaned

#### Added

**Dual Testing Strategy**:

- **New test modes**: `test:local`, `test:managed`, `test:both` npm scripts
- **Auto-detection**: Automatically selects deployment based on environment variables
- **Environment support**:
  - `LOCAL_CONVEX_URL` for local Convex dev server testing
  - `CONVEX_URL` + `CONVEX_DEPLOY_KEY` for managed deployment testing
  - `CONVEX_TEST_MODE` to manually override auto-detection
- **Deployment type tracking**: `CONVEX_DEPLOYMENT_TYPE` env var for test-specific behavior

**New Files**:

- `tests/env.ts` - Environment loading with dual testing strategy support
- `tests/README.md` - Comprehensive testing guide with dual strategy documentation
- `dev-docs/DUAL-TESTING-STRATEGY.md` - Technical implementation details
- `dev-docs/BUG-FIXES-SUMMARY.md` - Complete bug fix report
- `scripts/cleanup-test-data.ts` - Manual cleanup utility for test environments

**New Backend Mutations**:

- `memories.purgeAll` - Test-only mutation to delete all memories (environment-protected)

#### Changed

**Test Infrastructure**:

- Updated `TestCleanup` helper with `purgeMemories()` and `purgeAll()` methods
- Simplified `tests/setup.ts` to only contain test hooks
- Split Jest setup into `setupFiles` (env.ts) and `setupFilesAfterEnv` (setup.ts)
- Removed duplicate cleanup logic from `memory.test.ts` and `vector.test.ts`

**Documentation**:

- Updated `.env.test` with dual testing strategy examples
- Enhanced test validation with better error messages and debugging output

#### Technical Details

**Verification Methods**:

- Context7 documentation lookup confirmed local Convex limitations
- Comprehensive test validation across both deployment types
- 241/241 tests passing on both local and managed deployments

**Performance**:

- Local mode: ~28 seconds (manual cosine similarity)
- Managed mode: ~137 seconds (includes network latency to cloud)
- Both modes: 100% test coverage maintained

---

### [0.5.0] - 2025-10-27

#### 🎉 Major Release - Memory Convenience API (Layer 3)!

Complete dual-layer orchestration with automatic ACID + Vector management! **All 16 Layer 3 operations plus advanced AI validation.**

#### Added

**Memory Convenience API (Layer 3)** - ALL 16 operations:

**Core Dual-Layer Operations (5)**:

- `remember()` - Store conversation in ACID + Vector automatically (one call does both!)
- `forget()` - Delete from Vector + optionally ACID (dual-layer deletion)
- `get()` with enrichment - Retrieve memory with optional ACID conversation context
- `search()` with enrichment - Search with optional ACID enrichment (batch fetch)
- `store()` - Smart layer detection (validates conversationRef requirements)

**Delegations (11)**:

- `update()`, `delete()`, `list()`, `count()` - Core operations
- `updateMany()`, `deleteMany()` - Bulk operations
- `export()`, `archive()` - Data management
- `getVersion()`, `getHistory()`, `getAtTimestamp()` - Version operations

**Advanced AI Integration Tests (5)**:

- Real embedding validation (text-embedding-3-small, 1536-dim)
- Real LLM summarization (gpt-4o-mini)
- Semantic search recall (finds content with different wording)
- Enrichment validation (dual-layer retrieval)
- Cosine similarity scoring (0-1 range validation)

#### Features

**Dual-Layer Orchestration**:

- One API call stores in both ACID and Vector
- Automatic conversationRef linking
- Embedding generation callback support
- Content extraction/summarization callback support
- Eliminates manual dual-layer management

**Enrichment Capabilities**:

- `get()` can fetch full ACID conversation context
- `search()` can batch-enrich results with ACID data
- Access both summarized (Vector) and original (ACID) content
- Graceful handling of missing conversations

**Developer Experience**:

- Friendly API (`remember`/`forget` vs `store`/`delete`)
- Consistent namespace (`cortex.memory.*`)
- All Layer 2 operations accessible via delegations
- No need to remember which layer to use

**Real AI Validation**:

- Tested with OpenAI text-embedding-3-small (1536-dim)
- Tested with OpenAI gpt-4o-mini (summarization)
- Semantic search proven with real embeddings
- Cosine similarity calculation validated
- Cost: ~$0.0003 per test run (affordable for CI/CD)

#### Enhanced Testing

- +40 tests for Layer 3 (40/40 passing)
- +5 advanced AI integration tests (with real OpenAI)
- Dual-layer orchestration validated
- Enrichment capabilities tested
- Semantic search with real embeddings proven
- **Total tests**: 241 (69 + 54 + 45 + 33 + 35 + 5)

#### Changed

- Updated GitHub Action workflow to support OPENAI_API_KEY
- **Improved version detection**: Now compares with npm registry instead of git history (handles multi-commit pushes)
- Enhanced test setup to load .env.local for API keys
- Fixed cosine similarity calculation (handle zero vectors, no NaN)
- Interactive test menu expanded (11 new options)

**Total**: 70 operations (40 L1 + 14 L2 + 16 L3), 241 tests, 100% passing

**What this means**: Complete foundation for AI agent memory with proven real-world AI integration!

---

### [0.4.5] - 2025-10-27

#### 🔧 Patch Release - Skip Redundant Tests in Publish

Optimizes GitHub Action workflow to skip duplicate test runs during npm publish.

#### Fixed

- Added `--ignore-scripts` to npm publish command
- Skips `prepublishOnly` hook (tests already run in dedicated step)
- Faster publish, avoids timeout issues
- Tests still run (just once, not twice)

**Total**: 54 operations, 201 tests (no API changes)

---

### [0.4.4] - 2025-10-27

#### 🔧 Patch Release - Fix Deploy Command

Corrects Convex deploy command syntax in GitHub Action workflow.

#### Fixed

- Fixed `convex deploy` command to use correct environment variable names
- Uses `CONVEX_DEPLOYMENT` instead of `CONVEX_URL` for deploy
- Added `--yes` flag to skip confirmation in CI

**Total**: 54 operations, 201 tests (no API changes)

---

### [0.4.3] - 2025-10-27

#### 🔧 Patch Release - Deploy Backend in CI

Adds Convex backend deployment to GitHub Action workflow so tests run against deployed functions.

#### Fixed

- Added `npx convex deploy` step to GitHub Action workflow
- Backend functions now deployed before tests run
- Tests now run against actual deployed backend

**Total**: 54 operations, 201 tests (no API changes)

---

### [0.4.2] - 2025-10-27

#### 🔧 Patch Release - Fix Automated Workflow

Fixes GitHub Action workflow to generate Convex code before running tests.

#### Fixed

- Added `npx convex codegen` step to GitHub Action workflow
- Tests now run properly in CI/CD environment

**Total**: 54 operations, 201 tests (no API changes)

---

### [0.4.1] - 2025-10-27

#### 🔧 Patch Release - Automated Publishing

Minor patch to test automated GitHub Action publishing workflow.

#### Added

- GitHub Action workflow for automated npm publishing
- Automated release documentation

#### Changed

- Updated release process to support both automated and manual workflows

**Total**: Still 54 operations, 201 tests (no API changes)

---

### [0.4.0] - 2025-10-26

#### 🎉 Major Release - Vector Memory (Layer 2)!

Complete semantic search and vector memory implementation! **All 14 Layer 2 operations.**

#### Added

**Vector Memory API (Layer 2)** - ALL 14 operations:

**Core Operations (6)**:

- `store()` - Store agent-private memories with optional embeddings
- `get()` - Retrieve memory by ID with agent isolation
- `search()` - Hybrid search (semantic with vectors OR keyword without)
- `delete()` - Delete memories with permission checks
- `list()` - List memories with filters (sourceType, userId)
- `count()` - Count memories

**Advanced Operations (5)**:

- `update()` - Update memory content/metadata (creates versions)
- `getVersion()` - Retrieve specific version
- `getHistory()` - Get complete version history
- `deleteMany()` - Bulk delete with filters
- `export()` - Export to JSON/CSV for GDPR

**Optional Operations (3)**:

- `updateMany()` - Bulk update importance/tags
- `archive()` - Soft delete (restorable)
- `getAtTimestamp()` - Temporal queries (time-travel)

#### Features

**Semantic Search**:

- Bring your own embeddings (OpenAI, Cohere, local, etc.)
- Optional embeddings (keyword search works without)
- Hybrid search capability (vector + text)
- Support 384-3072 dimensions

**Agent Isolation**:

- Private memory per agent
- Permission checks on all operations
- No cross-agent data leakage

**Layer 1 Integration**:

- Reference conversations (conversationRef)
- Reference immutable knowledge (immutableRef)
- Reference mutable data (mutableRef)
- Standalone memories (no ref)

**Versioning**:

- Like immutable, updates create versions
- Version history accessible
- Temporal queries (what was it on X date)

#### Enhanced Testing

- +33 tests for Layer 2 (33/33 passing)
- Agent isolation validated
- Hybrid search tested
- Versioning validated
- Bulk operations tested
- **Total tests**: 201 (69 + 54 + 45 + 33)

**Total**: 54 operations, 201 tests, 100% passing

---

### [0.3.1] - 2025-10-26

#### 🎊 Patch Release - 100% Layer 1 Complete!

Adds `transaction()` - the final missing operation! **All 40 documented Layer 1 operations now implemented.**

#### Added

- `transaction()` - ACID multi-key transactions for mutable store
  - Execute multiple operations atomically (all succeed or all fail)
  - Supports: set, update, delete, increment, decrement
  - Perfect for inventory transfers, order processing, etc.

#### Enhanced Testing

- +6 transaction tests (atomicity, mixed operations, transfers, integration)
- +2 cross-layer integration tests
- **Total tests**: 168 (69 conversations + 54 immutable + 45 mutable)

**Status**: ✅ **100% of documented Layer 1 operations implemented!** (40/40)

---

### [0.3.0] - 2025-10-26

#### 🎉 Major Release - Complete Layer 1!

Third release completes **all Layer 1 ACID Stores** with 9 new operations!

#### Added

**Conversations Advanced Operations**:

- `deleteMany()` - Bulk delete conversations with filters
- `getMessage()` - Retrieve specific message by ID
- `getMessagesByIds()` - Batch retrieve multiple messages
- `findConversation()` - Find existing conversation by participants
- `getOrCreate()` - Atomic get-or-create pattern

**Immutable Advanced Operations**:

- `getAtTimestamp()` - Temporal queries (what was the value at specific time)
- `purgeMany()` - Bulk delete entries with filters
- `purgeVersions()` - Version retention enforcement (keep latest N)

**Mutable Store Complete (Layer 1c)**:

- `set()`, `get()`, `update()`, `delete()` - Core CRUD
- `increment()`, `decrement()` - Atomic numeric operations
- `getRecord()` - Get full record with metadata
- `list()`, `count()`, `exists()` - Querying
- `purgeNamespace()`, `purgeMany()` - Bulk deletion

#### Enhanced Testing

- **Total tests**: 162 (69 conversations + 55 immutable + 38 mutable)
- **New tests**: +26 from v0.2.0
- **Coverage**: ~96%

#### Features

- ✅ Complete ACID foundation (all 3 stores)
- ✅ Temporal queries
- ✅ Bulk operations
- ✅ Find/create patterns
- ✅ Message-level access

**Total**: 35 operations, 162 tests, 100% passing

---

### [0.2.0] - 2025-10-26

#### 🎉 Major Release - Layer 1b Complete!

Second release adds complete **Immutable Store API** (Layer 1b) with automatic versioning.

#### Added

**Immutable Store API (Layer 1b)**:

- `store()` - Store versioned immutable data
- `get()` - Get current version
- `getVersion()` - Get specific historical version
- `getHistory()` - Get complete version history
- `list()` - Filter and list entries
- `search()` - Full-text search
- `count()` - Count entries
- `purge()` - Delete entry (GDPR)

#### Changed

- **Package name**: Renamed from `@cortexmemory/cortex-sdk` to `@cortexmemory/sdk`
- **Total tests**: 99 (54 conversations + 45 immutable)
- **Interactive menu**: Reorganized into categories

---

### [0.1.0] - 2025-10-26

#### 🎉 Initial Release - Conversations API

First public release of Cortex SDK with complete **Conversations API** (Layer 1a).

#### Added

**Conversations API (Layer 1a)**:

- `create()` - Create conversations
- `get()` - Retrieve by ID
- `addMessage()` - Append messages
- `list()`, `search()`, `count()` - Querying
- `delete()`, `export()` - GDPR compliance
- `getHistory()` - Paginated messages

#### Features

- ✅ 9 operations, 45 tests
- ✅ User-agent and agent-agent conversation types
- ✅ ACID guarantees
- ✅ Full-text search
- ✅ JSON/CSV export

---

## Project History

### [0.1.0-alpha] - 2025-10-23

### Added

- Initial alpha release
- Core memory operations (store, retrieve, search, delete, update)
- **Automatic memory versioning** - Updates preserve history (default: 10 versions)
- **Temporal queries** - Query memory state at any point in time
- **Timestamps on all memories** - createdAt, updatedAt, lastAccessed
- Hybrid agent management system (simple IDs + optional registry)
- User profile management
- Context chain support for hierarchical agent coordination
- Vector search with flexible dimensions (768, 1536, 3072+)
- Multi-strategy search retrieval (semantic + keyword + fallback)
- Access analytics and tracking
- Embedding-agnostic architecture
- TypeScript support with full type definitions
- Comprehensive documentation structure
- Code of Conduct and Contributing guidelines
- Security policy and reporting procedures
- Apache License 2.0

### Architecture Decisions

- Built on Convex backend for optimal performance
- **ACID + Vector Hybrid**: Immutable conversation history + searchable memory index with conversationRef links
- Two-tier model: Direct mode (open source) + Cloud mode (managed service)
- Developer brings their own embeddings (optional, embedding-agnostic)
- Progressive enhancement: raw content → embeddings → summarization
- Support for any Convex deployment (Cloud, localhost, self-hosted)
- conversationRef preserves full context even after vector retention cleanup

### Known Limitations

- Alpha stability - API may change
- Limited integration examples (more coming in beta)
- No CLI tools yet
- Documentation in progress
- No official support channels yet

### Breaking Changes

- N/A (initial release)

---

## Version History

### [0.1.0] - 2025-10-23

**Initial Alpha Release**

The first public release of Cortex, bringing enterprise-grade persistent memory to AI agents. This release establishes the core architecture and API surface.

**Status**: Alpha - Use in development, not production
**Migration**: N/A (first release)

---

## Release Notes Format

Each release includes:

### Added

New features and capabilities

### Changed

Changes to existing functionality

### Deprecated

Features that will be removed in future versions

### Removed

Features that have been removed

### Fixed

Bug fixes

### Security

Security improvements and vulnerability fixes

---

## Upgrade Guide

### Upgrading to v0.1.0

This is the initial release - no upgrade needed.

### Future Upgrades

Detailed upgrade instructions will be provided for each version.

---

## Deprecation Policy

Starting with v1.0.0:

- Features will be deprecated for at least one minor version before removal
- Deprecation warnings will be added to the code and docs
- Migration guides will be provided for deprecated features

---

## Support Policy

| Version | Status | End of Support |
| ------- | ------ | -------------- |
| 0.1.x   | Alpha  | TBD            |

Once we reach v1.0.0:

- Latest major version: Full support (features + security)
- Previous major version: Security updates only (6 months)
- Older versions: End of life (no updates)

---

## How to Contribute

Found a bug? Want to request a feature? See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

---

## Stay Updated

- **GitHub Releases**: Watch our repository for release notifications
- **Discord**: Join #announcements for release updates
- **Twitter**: Follow [@cortexmemory](https://twitter.com/cortexmemory)
- **Newsletter**: Subscribe at https://cortexmemory.dev/newsletter

---

**Last Updated**: 2025-10-23
