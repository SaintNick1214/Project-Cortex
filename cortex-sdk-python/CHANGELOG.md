# Changelog - Cortex Python SDK

All notable changes to the Python SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.9.0] - 2024-11-14

### 🎉 First Official PyPI Release!

**100% Feature Parity with TypeScript SDK Achieved!**

#### Added

**OpenAI Integration Tests (5 new tests):**
- Real embedding generation with text-embedding-3-small
- Semantic search validation (non-keyword matching)
- GPT-4o-mini summarization quality testing
- Similarity score validation (0-1 range)
- Enriched conversation context retrieval
- All tests gracefully skip without OPENAI_API_KEY
- 2 tests skip in LOCAL mode (require MANAGED for vector search)

**Test Infrastructure Enhancements:**
- Total tests: 574 → 579 (5 new OpenAI tests)
- 100% pass rate on Python 3.10, 3.11, 3.12, 3.13, 3.14
- Dual-testing: `make test` runs BOTH LOCAL and MANAGED suites automatically
- Makefile commands mirror TypeScript npm scripts
- Zero test warnings (suppressed Neo4j deprecations)

**Development Tools:**
- `Makefile` for npm-like commands (`make test`, `make test-local`, `make test-managed`)
- `./test` wrapper script for quick testing
- Comprehensive release documentation in `dev-docs/python-sdk/`

#### Fixed

**Critical Bug Fixes:**
- Fixed `_score` field preservation in vector search results (similarity scoring now works)
- Fixed `spaces_list` variable scope in `users.delete()` cascade deletion
- Fixed `conversation_ref` dict/object handling in memory enrichment
- Fixed `contexts.list()` return format handling
- Fixed `agents.list()` to support status filtering
- Fixed `memory_spaces.update()` to flatten updates dict

**API Alignment:**
- `agents.register()` now matches backend (no initial status, defaults to "active")
- `agents.update()` supports status changes via updates dict
- `contexts.update()` requires updates dict (not keyword args)
- Agent capabilities stored in `metadata.capabilities` (matches TypeScript pattern)

**Type System:**
- Added `_score` and `score` optional fields to `MemoryEntry` for similarity ranking
- Updated `convert_convex_response()` to preserve `_score` from backend

#### Changed

**Documentation Organization:**
- Moved all dev docs to `dev-docs/python-sdk/` (proper location per project rules)
- Only README.md, LICENSE.md, CHANGELOG.md remain in package root
- Created comprehensive PyPI release guides and checklists

**Package Metadata:**
- Version: 0.8.2 → 0.9.0 (sync with TypeScript SDK)
- Added Python 3.13 and 3.14 support classifiers
- Modern SPDX license format
- Added `Framework :: AsyncIO` and `Typing :: Typed` classifiers

**Testing:**
- Fixed embedding consistency test to use mock embeddings (not real OpenAI)
- All OpenAI tests properly skip in LOCAL mode where vector search unavailable
- Enhanced test output formatting

#### Infrastructure

**PyPI Publishing Pipeline:**
- GitHub Actions workflow for automated PyPI publishing
- Trusted publishing configured (no API tokens needed)
- Tag-based releases: `py-v*` pattern
- Only publishes from `main` branch (matches development workflow)
- Includes test run before publish

**CI/CD:**
- Multi-version testing (Python 3.10-3.13) on every push
- Automatic mypy and ruff checks
- Coverage reporting

## [0.8.2] - 2024-11-04

### Added - Initial Python SDK Release

#### Core Infrastructure

- Main Cortex client class with graph integration support
- Complete type system with 50+ dataclasses
- Structured error handling with all error codes
- Async/await throughout matching TypeScript SDK

#### Layer 1 (ACID Stores)

- ConversationsAPI - 13 methods for immutable conversation threads
- ImmutableAPI - 9 methods for shared versioned data
- MutableAPI - 12 methods for shared live data with atomic updates

#### Layer 2 (Vector Index)

- VectorAPI - 13 methods for searchable memories with embeddings
- Semantic search support
- Versioning and retention

#### Layer 3 (Facts)

- FactsAPI - 10 methods for structured knowledge extraction
- Support for all fact types (preference, identity, knowledge, relationship, event)
- Temporal validity and confidence scoring

#### Layer 4 (Convenience & Coordination)

- MemoryAPI - 14 methods as high-level convenience wrapper
- ContextsAPI - 17 methods for hierarchical workflow coordination
- UsersAPI - 11 methods with full GDPR cascade deletion
- AgentsAPI - 8 methods for optional registry with cascade cleanup
- MemorySpacesAPI - 9 methods for memory space management

#### Graph Integration

- CypherGraphAdapter for Neo4j and Memgraph
- Graph sync utilities for all entities
- Orphan detection and cleanup
- GraphSyncWorker for real-time sync
- Schema initialization and management

#### A2A Communication

- A2AAPI - 4 methods for agent-to-agent messaging
- Send, request, broadcast operations
- Conversation retrieval

#### Testing & Documentation

- Pytest configuration and fixtures
- Example tests for memory, conversations, and users
- 4 complete example applications
- Comprehensive documentation with migration guide
- Python developer guide
- TypeScript to Python migration guide

#### Package Distribution

- PyPI-ready package configuration
- setup.py and pyproject.toml
- Type stubs (py.typed marker)
- MANIFEST.in for package distribution

### Features - 100% Parity with TypeScript SDK

- ✅ All 140+ methods implemented
- ✅ Same API structure and naming (with Python conventions)
- ✅ Complete type safety with dataclasses
- ✅ Full error handling with error codes
- ✅ Graph database integration
- ✅ GDPR cascade deletion across all layers
- ✅ Agent cascade deletion by participantId
- ✅ Facts extraction and storage
- ✅ Context chains for workflows
- ✅ Memory spaces for Hive and Collaboration modes
- ✅ A2A communication helpers

### Documentation

- Complete README with quick start
- Python developer guide
- TypeScript to Python migration guide
- Implementation summary
- 4 working examples
- Inline docstrings on all public methods

### Testing

- Pytest configuration
- Async test support
- Test fixtures for Cortex client
- Example tests for core functionality

## [Future] - Planned Features

### Integrations

- LangChain memory adapter
- FastAPI middleware
- Django integration
- Flask extension

### Enhancements

- Connection pooling
- Bulk operation optimizations
- Async context managers
- Sync wrapper utility class

### Documentation

- Sphinx-generated API docs
- Video tutorials
- Jupyter notebooks
- More examples

---

For the complete history including TypeScript SDK changes, see: ../CHANGELOG.md
