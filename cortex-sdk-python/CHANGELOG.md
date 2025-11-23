# Changelog - Cortex Python SDK

All notable changes to the Python SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.10.0] - 2025-11-21

### 🎉 Major Release - Governance Policies API

**Complete implementation of centralized governance policies for data retention, purging, and compliance across all Cortex layers.**

#### ✨ New Features

**1. Governance Policies API (`cortex.governance.*`)** - 8 Core Operations

- **NEW:** `set_policy()` - Set organization-wide or memory-space-specific governance policies
- **NEW:** `get_policy()` - Retrieve current governance policy (includes org defaults + overrides)
- **NEW:** `set_agent_override()` - Override policy for specific memory spaces
- **NEW:** `get_template()` - Get pre-configured compliance templates (GDPR, HIPAA, SOC2, FINRA)
- **NEW:** `enforce()` - Manually trigger policy enforcement across layers
- **NEW:** `simulate()` - Preview policy impact without applying (cost savings, storage freed)
- **NEW:** `get_compliance_report()` - Generate detailed compliance reports
- **NEW:** `get_enforcement_stats()` - Get enforcement statistics over time periods

**2. Multi-Layer Governance**

Policies govern all Cortex storage layers:

- **Layer 1a (Conversations)**: Retention periods, archive rules, GDPR purge-on-request
- **Layer 1b (Immutable)**: Version retention by type, automatic cleanup
- **Layer 1c (Mutable)**: TTL settings, inactivity purging
- **Layer 2 (Vector)**: Version retention by importance, orphan cleanup

**3. Compliance Templates**

Four pre-configured compliance templates:

- **GDPR**: 7-year retention, right-to-be-forgotten, audit logging
- **HIPAA**: 6-year retention, unlimited audit logs, conservative purging
- **SOC2**: 7-year audit retention, comprehensive logging, access controls
- **FINRA**: 7-year retention, unlimited versioning, strict retention

#### 📚 New Types (Python)

- `GovernancePolicy` - Complete policy dataclass
- `PolicyScope` - Organization or memory space scope
- `PolicyResult` - Policy application result
- `ComplianceMode` - Literal type for compliance modes
- `ComplianceTemplate` - Literal type for templates
- `ComplianceSettings` - Compliance configuration
- `ConversationsPolicy`, `ConversationsRetention`, `ConversationsPurging`
- `ImmutablePolicy`, `ImmutableRetention`, `ImmutablePurging`, `ImmutableTypeRetention`
- `MutablePolicy`, `MutableRetention`, `MutablePurging`
- `VectorPolicy`, `VectorRetention`, `VectorPurging`
- `ImportanceRange` - Importance-based retention rules
- `EnforcementOptions`, `EnforcementResult`
- `SimulationOptions`, `SimulationResult`, `SimulationBreakdown`
- `ComplianceReport`, `ComplianceReportOptions`
- `EnforcementStats`, `EnforcementStatsOptions`

#### 🧪 Testing

**Comprehensive Test Suite:**

- **NEW:** `tests/test_governance.py` - 13 comprehensive tests
- **Test coverage:**
  - Policy management (set, get, override)
  - All 4 compliance templates (GDPR, HIPAA, SOC2, FINRA)
  - Template application
  - Manual enforcement
  - Policy simulation
  - Compliance reporting
  - Enforcement statistics (multiple time periods)
  - Integration scenarios (GDPR workflow)

#### 🎓 Usage Examples

**Basic GDPR Compliance:**

```python
# Apply GDPR template
policy = await cortex.governance.get_template("GDPR")
policy.organization_id = "my-org"
await cortex.governance.set_policy(policy)
```

**Memory-Space Override:**

```python
# Audit agent needs unlimited retention
override = GovernancePolicy(
    memory_space_id="audit-agent",
    vector=VectorPolicy(
        retention=VectorRetention(default_versions=-1)
    )
)
await cortex.governance.set_agent_override("audit-agent", override)
```

**Test Before Applying:**

```python
# Simulate policy impact
impact = await cortex.governance.simulate(
    SimulationOptions(organization_id="my-org")
)

if impact.cost_savings > 50:
    await cortex.governance.set_policy(new_policy)
```

**Compliance Reporting:**

```python
from datetime import datetime, timedelta

report = await cortex.governance.get_compliance_report(
    ComplianceReportOptions(
        organization_id="my-org",
        period_start=datetime(2025, 1, 1),
        period_end=datetime(2025, 12, 31)
    )
)

print(f"Status: {report.conversations['complianceStatus']}")
```

#### 🔄 API Parity

✅ **100% API Parity with TypeScript SDK**

- All 8 governance operations implemented
- All 4 compliance templates available
- Pythonic naming conventions (snake_case)
- Full type annotations with dataclasses
- Complete test coverage

---

## [0.9.2] - 2025-11-19

### 🐛 Critical Bug Fix - Facts Missing user_id During Extraction

**Fixed missing parameter propagation from Memory API to Facts API during fact extraction.**

#### Fixed

**Parameter Propagation Bug (Critical for Multi-User)**:

1. **Missing `user_id` in Fact Extraction** - Facts extracted via `memory.remember()` were missing `user_id` field
   - **Fixed:** `cortex/memory/__init__.py` line 234 - Added `user_id=params.user_id` in `remember()` fact extraction
   - **Fixed:** `cortex/memory/__init__.py` line 658 - Added `user_id=input.user_id` in `store()` fact extraction
   - **Fixed:** `cortex/memory/__init__.py` line 741 - Added `user_id=updated_memory.user_id` and `participant_id=updated_memory.participant_id` in `update()` fact extraction
   - **Impact:** Facts can now be filtered by `user_id`, GDPR cascade deletion works, multi-user isolation works correctly
   - **Root Cause:** Integration layer wasn't passing parameters through from Memory API to Facts API
   - **Affected versions:** v0.9.0, v0.9.1 (if Python SDK had 0.9.1)

2. **Test Coverage Added** - Comprehensive parameter propagation tests
   - Added test: `test_remember_fact_extraction_parameter_propagation()`
   - Enhanced test: `test_remember_with_fact_extraction()` now validates `user_id` and `participant_id`
   - Verifies: `user_id`, `participant_id`, `memory_space_id`, `source_ref`, and all other parameters reach Facts API
   - Validates: Filtering by `user_id` works after extraction
   - These tests would have caught the bug if they existed before

#### Migration

**No breaking changes.** This is a bug fix that makes the SDK work as intended.

If you were working around this bug by manually storing facts instead of using extraction:

```python
# Before (workaround)
result = await cortex.memory.remember(RememberParams(...))
# Then manually store facts with user_id
for fact in extracted_facts:
    await cortex.facts.store(StoreFactParams(
        **fact,
        user_id=params.user_id,  # Had to add manually
    ))

# After (works correctly now)
result = await cortex.memory.remember(
    RememberParams(
        user_id='user-123',
        extract_facts=async_extract_facts,
        ...
    )
)
# user_id is now automatically propagated to facts ✅
```

---

## [0.9.1] - 2025-11-18

### 🐛 Critical Bug Fix - Facts API Universal Filters

**Fixed inconsistency in Facts API that violated Cortex's universal filters design principle.**

#### Fixed

**Facts API Universal Filters (Breaking Inconsistency)**:

1. **Missing Universal Filters in Facts API** - Facts operations were missing standard Cortex filters
   - Added `user_id` field to `FactRecord` for GDPR compliance
   - Added `user_id` to `StoreFactParams` for cascade deletion support
   - **CREATED:** `ListFactsFilter` dataclass - Full universal filter support (25+ options)
   - **CREATED:** `CountFactsFilter` dataclass - Full universal filter support
   - **CREATED:** `SearchFactsOptions` dataclass - Full universal filter support
   - **CREATED:** `QueryBySubjectFilter` dataclass - Comprehensive filter interface
   - **CREATED:** `QueryByRelationshipFilter` dataclass - Comprehensive filter interface
   - Previously could only filter by: memory_space_id, fact_type, subject, tags (5 options)
   - Now supports: user_id, participant_id, dates, source_type, tag_match, confidence, metadata, sorting, pagination (25+ options)

2. **Critical Bug in store() Method** - user_id parameter not passed to backend
   - Fixed: Added `"userId": params.user_id` to mutation call (line 70)
   - Impact: user_id now correctly stored and filterable for GDPR compliance

3. **API Consistency Achieved** - Facts API now matches Memory API patterns
   - Same filter syntax works across `memory.*` and `facts.*` operations
   - GDPR-friendly: Can filter facts by `user_id` for data export/deletion
   - Hive Mode: Can filter facts by `participant_id` to track agent contributions
   - Date filters: Can query recent facts, facts in date ranges
   - Confidence ranges: Can filter by quality thresholds
   - Complex queries: Combine multiple filters for precise fact retrieval

#### Changed

**Method Signatures Updated** (Breaking Changes):

**Before (v0.9.0)**:

```python
# Limited positional/keyword arguments
facts = await cortex.facts.list("agent-1", fact_type="preference")
facts = await cortex.facts.search("agent-1", "query", min_confidence=80)
count = await cortex.facts.count("agent-1", fact_type="preference")
```

**After (v0.9.1)**:

```python
# Comprehensive filter objects
from cortex.types import ListFactsFilter, SearchFactsOptions, CountFactsFilter

facts = await cortex.facts.list(
    ListFactsFilter(memory_space_id="agent-1", fact_type="preference")
)

facts = await cortex.facts.search(
    "agent-1", "query", SearchFactsOptions(min_confidence=80)
)

count = await cortex.facts.count(
    CountFactsFilter(memory_space_id="agent-1", fact_type="preference")
)
```

**Updated Methods**:

- `list()` - Now accepts `ListFactsFilter` instead of individual parameters
- `count()` - Now accepts `CountFactsFilter` instead of individual parameters
- `search()` - Now accepts optional `SearchFactsOptions` instead of individual parameters
- `query_by_subject()` - Now accepts `QueryBySubjectFilter` instead of individual parameters
- `query_by_relationship()` - Now accepts `QueryByRelationshipFilter` instead of individual parameters

**Migration Guide**:

All existing test files updated to use new filter objects. Update your code:

```python
# Old (v0.9.0)
facts = await cortex.facts.list(
    memory_space_id="agent-1",
    fact_type="preference",
    subject="user-123"
)

# New (v0.9.1)
from cortex.types import ListFactsFilter
facts = await cortex.facts.list(
    ListFactsFilter(
        memory_space_id="agent-1",
        fact_type="preference",
        subject="user-123"
    )
)
```

#### Enhanced

**New Filter Capabilities**:

All Facts query operations now support comprehensive universal filters:

```python
from cortex.types import ListFactsFilter
from datetime import datetime, timedelta

facts = await cortex.facts.list(
    ListFactsFilter(
        memory_space_id="agent-1",
        # Identity filters (GDPR & Hive Mode) - NEW
        user_id="user-123",
        participant_id="email-agent",
        # Fact-specific
        fact_type="preference",
        subject="user-123",
        min_confidence=80,
        # Source filtering - NEW
        source_type="conversation",
        # Tag filtering with match strategy - NEW
        tags=["verified", "important"],
        tag_match="all",  # Must have ALL tags
        # Date filtering - NEW
        created_after=datetime.now() - timedelta(days=7),
        # Metadata filtering - NEW
        metadata={"priority": "high"},
        # Sorting and pagination - NEW
        sort_by="confidence",
        sort_order="desc",
        limit=20,
        offset=0,
    )
)
```

**Backend Bug Fixes** (Convex):

- Fixed unsafe sort field type casting (could crash on empty result sets)
- Added field validation for sortBy parameter
- Added missing filter implementations in `queryBySubject` (confidence, updatedBefore/After, validAt, metadata)
- Added missing filter implementations in `queryByRelationship` (confidence, updatedBefore/After, validAt, metadata)

#### Testing

**Test Results:**

- **LOCAL**: 72/72 tests passing (100%) ✅
- **MANAGED**: 72/72 tests passing (100%) ✅
- **Total**: 144 test executions (100% success rate)

**New Tests:**

- `tests/test_facts_universal_filters.py` - 20 comprehensive test cases covering all universal filters

**Updated Tests:**

- `tests/test_facts.py` - Updated 3 tests for new signatures
- `tests/test_facts_filters.py` - Updated 10 tests for new signatures

#### Benefits

✅ **API Consistency** - Facts API now follows same patterns as Memory API  
✅ **GDPR Compliance** - Can filter by `user_id` for data export and deletion  
✅ **Hive Mode Support** - Can filter by `participant_id` for multi-agent tracking  
✅ **Powerful Queries** - 25+ filter options vs 5 previously (500% increase)  
✅ **Better Developer Experience** - Learn filters once, use everywhere

#### Package Exports

**New Exports**:

```python
from cortex.types import (
    ListFactsFilter,          # NEW
    CountFactsFilter,         # NEW
    SearchFactsOptions,       # NEW
    QueryBySubjectFilter,     # NEW
    QueryByRelationshipFilter # NEW
)
```

---

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
