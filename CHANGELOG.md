# Changelog

All notable changes to Cortex will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned for v1.0.0

- Layer 2: Vector Memory API (semantic search)
- Layer 3: Memory Convenience API
- Coordination APIs (Users, Contexts, Agents, A2A)
- Complete API stabilization
- Production-ready documentation
- Integration examples for all major frameworks
- Performance benchmarks

---

## SDK Releases

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
