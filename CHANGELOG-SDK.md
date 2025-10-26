# Changelog

All notable changes to the Cortex SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-10-26

### 🎉 Initial Release

First public release of Cortex SDK with complete **Conversations API** (Layer 1a).

### Added

#### Core Operations
- `create()` - Create user-agent and agent-agent conversations
- `get()` - Retrieve conversations by ID
- `addMessage()` - Append messages to conversations (immutable)
- `list()` - Filter and list conversations
- `count()` - Count conversations with filters
- `delete()` - GDPR-compliant conversation deletion

#### Advanced Features
- `getHistory()` - Paginated message retrieval with sorting
- `search()` - Full-text search across conversations with highlights
- `export()` - Export conversations to JSON or CSV for GDPR compliance

#### Testing & Development Tools
- 45 comprehensive E2E tests (100% passing)
- Interactive test runner for step-by-step debugging
- Storage inspection and validation tools
- Automated test cleanup utilities

#### Architecture
- ACID-compliant conversation storage
- Two conversation types: user-agent and agent-agent
- Append-only message history (immutable)
- 6 optimized database indexes
- Full TypeScript type safety

### Features

- ✅ **ACID Guarantees** - Atomicity, Consistency, Isolation, Durability
- ✅ **Immutable History** - Messages never change once added
- ✅ **Dual Conversation Types** - User↔Agent and Agent↔Agent
- ✅ **Flexible Filtering** - Filter by user, agent, type, date
- ✅ **Pagination Support** - Handle large conversations efficiently
- ✅ **Full-Text Search** - Find conversations by keywords
- ✅ **GDPR Compliance** - Delete and export user data
- ✅ **Auto-generated IDs** - Optional custom IDs supported
- ✅ **TypeScript First** - Complete type definitions

### Technical Details

- Built on Convex.dev for reactive database
- ESM and CommonJS support
- TypeScript 5.9+
- Node.js 18+ required
- Zero runtime dependencies (peer dependency: convex ^1.28.0)

### Documentation

- Complete API reference
- Getting started guide
- Architecture documentation
- Interactive testing guide
- Release process documentation

### Performance

- Get by ID: < 10ms (indexed)
- List with filters: < 30ms (indexed)
- Add message: < 20ms
- Search: < 100ms
- Export: < 200ms

---

## [Unreleased]

### Planned for v0.2.0
- Layer 1b: Immutable Store API
- Versioned immutable data storage
- Historical versioning support

### Planned for v0.3.0
- Layer 1c: Mutable Store API
- Live operational data management

### Planned for v0.4.0
- Layer 2: Vector Memory API
- Semantic search with embeddings
- Memory indexing and retrieval

### Planned for v0.5.0
- Layer 3: Memory Convenience API
- High-level helpers for common workflows

### Planned for v0.6.0
- Coordination APIs: Users, Contexts, Agents, A2A Communication

### Planned for v1.0.0
- Production release
- All layers complete
- Performance optimization
- Enhanced documentation

---

## Version History

- [0.1.0] - 2025-10-26 - Initial release (Conversations API)

---

**Note**: This SDK is under active development. APIs may change before v1.0.0. We follow semantic versioning, so breaking changes will increment the minor version until v1.0.0.

