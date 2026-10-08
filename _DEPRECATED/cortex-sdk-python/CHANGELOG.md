# Changelog

All notable changes to the Cortex Python SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.31.0] - 2026-01-17

### Full TypeScript SDK 0.31.0 Parity Achieved

This release brings the Python SDK to complete parity with the TypeScript SDK v0.31.0.

### New Features

#### Configurable Recall Limits (v0.31.0 Parity)

New `RecallLimits` dataclass for granular control over recall operations:

```python
from cortex import RecallLimits

result = await cortex.memory.recall(
    RecallParams(
        memory_space_id="user-123-space",
        query="user preferences",
        limits=RecallLimits(
            memories=20,           # Max vector memories to fetch
            facts=15,              # Max facts to fetch
            graph_hops=2,          # Max graph traversal depth
            graph_entities_per_hop=5,  # Entities to expand per hop
            graph_results_per_entity=3,  # Results per entity from graph
            total=30,              # Final result cap after merge/rank
        ),
    )
)
```

**Environment Variables Supported:**
- `CORTEX_RECALL_LIMIT_MEMORIES` (default: 20)
- `CORTEX_RECALL_LIMIT_FACTS` (default: 15)
- `CORTEX_RECALL_GRAPH_HOPS` (default: 2)
- `CORTEX_RECALL_GRAPH_ENTITIES_PER_HOP` (default: 5)
- `CORTEX_RECALL_GRAPH_RESULTS_PER_ENTITY` (default: 3)
- `CORTEX_RECALL_LIMIT_TOTAL` (default: 30)

#### Semantic Fact Search (v0.30.0 Parity)

New `semantic_search()` method on the Facts API for vector-based fact retrieval:

```python
facts = await cortex.facts.semantic_search(
    memory_space_id="user-123-space",
    embedding=query_embedding,  # 1536-dim float array
    options=SemanticSearchFactsOptions(
        min_confidence=80,
        limit=20,
    ),
)
```

#### Enriched Entity Extraction (v0.30.1 Parity)

- `ConflictCandidate` now supports `embedding`, `entities`, and `relations` fields
- New `EnrichedEntityCandidate` and `EnrichedRelationCandidate` types for conflict resolution
- Facts can now store typed entities (person, organization, place, product, concept)

### Multi-Tenancy Enhancements

Added `tenant_id` field across all APIs for SaaS platform isolation:

#### Conversations API
- `Conversation.tenant_id`
- `CreateConversationInput.tenant_id`
- `ListConversationsFilter.tenant_id`
- `CountConversationsFilter.tenant_id`

#### Immutable API
- `ImmutableRecord.tenant_id`
- `ListImmutableFilter.tenant_id`
- `CountImmutableFilter.tenant_id`

#### Mutable API
- `MutableRecord.tenant_id`
- `ListMutableFilter.tenant_id`
- `CountMutableFilter.tenant_id`
- `PurgeNamespaceOptions.tenant_id`
- `PurgeManyMutableFilter.tenant_id`

#### Vector API
- `StoreMemoryInput.tenant_id`
- `ListMemoriesFilter` (new dataclass)
- `CountMemoriesFilter` (new dataclass)

#### Memory API
- `RecallParams.tenant_id`

#### Memory Spaces API
- `MemorySpace.tenant_id`
- `RegisterMemorySpaceParams.tenant_id`
- `ListMemorySpacesFilter.tenant_id`

#### Contexts API
- `Context.tenant_id`
- `ContextInput.tenant_id`
- `ListContextsFilter` (new dataclass)
- `CountContextsFilter` (new dataclass)

#### Users API
- `UserProfile.tenant_id`
- `ListUsersFilter.tenant_id`

#### Agents API
- `RegisteredAgent.tenant_id`
- `AgentRegistration.tenant_id`
- `AgentFilters.tenant_id`

### Sessions API Enhancements

- Fixed tenant isolation in `get()`, `touch()`, and `end()` methods
- All session methods now properly support multi-tenancy

### Governance API Enhancements

Updated session policy types to match TypeScript SDK:

- `SessionLifecyclePolicy` - Renamed `absolute_timeout` to `max_duration`, `auto_extend_on_activity` to `auto_extend`, added `warn_before_expiry`
- `SessionCleanupPolicy` (new) - `auto_expire_idle`, `delete_ended_after`, `archive_after`
- `SessionLimitsPolicy` (new) - `max_active_sessions`, `max_sessions_per_device`
- `SessionPolicy` - Now includes `lifecycle`, `cleanup`, and optional `limits`

### A2A API Enhancements

- Added `format` field to `A2AConversationFilters`
- Added `A2AConversationPeriod` dataclass with `start` and `end` fields
- Added `period` property to `A2AConversation`
- Fixed `A2ATimeoutError.name` attribute

### Graph API Enhancements

#### New Functions
- `update_fact_graph_status()` - Update fact status in graph
- `sync_fact_update_in_place()` - Update fact without supersession
- `sync_fact_full_supersession()` - Full fact supersession with relationships
- `sync_fact_revision_relationship()` - Create REVISED_FROM relationships

#### New Features
- Added `EXTRACTED_WITH` relationship for bidirectional fact-to-memory traceability
- Added `tenant_id` support to all sync and ensure functions
- Enhanced batch sync to include memory spaces, contexts, and conversations
- Expanded schema initialization with 20+ new performance indexes

#### Error Handling
- New `GraphAuthenticationError` class for authentication failures
- Better connection error diagnosis (auth failures, DNS, timeouts)

### New Configuration Module

New `cortex/config.py` module with:
- `resolve_recall_limits()` - Merges user limits with env vars and defaults
- `ResolvedRecallLimits` - Fully resolved limits dataclass
- `get_recall_defaults()` - Gets defaults with env var overrides
- Model resolution functions for fact extraction, conflict resolution, and embeddings

### New Validators

#### Vector API
- `validate_list_filter()`
- `validate_count_filter()`
- `validate_export_options()`
- `validate_delete_many_filter()`
- `validate_update_many_inputs()`

#### Memory Spaces API
- `validate_offset()`
- `validate_sort_by()`
- `validate_sort_order()`

### Type Updates

#### New Dataclasses
- `RecallLimits`
- `SemanticSearchFactsOptions`
- `ListMemoriesFilter`
- `CountMemoriesFilter`
- `ListContextsFilter`
- `CountContextsFilter`
- `UpdateContextParams`
- `DeleteContextResult`
- `UpdateManyContextsResult`
- `DeleteManyContextsResult`
- `ExportContextsResult`
- `SessionCleanupPolicy`
- `SessionLimitsPolicy`
- `A2AConversationPeriod`
- `EnrichedEntityCandidate`
- `EnrichedRelationCandidate`

#### Updated Dataclasses
- `FactRecord` - Added `embedding` field
- `StoreFactParams` - Added `embedding` field
- `UpdateFactInput` - Added `embedding` field
- `ConflictCandidate` - Added `embedding`, `entities`, `relations` fields
- `RecallGraphExpansionConfig` - Added `entities_per_hop`, `results_per_entity` fields
- `BatchSyncLimits` - Added `memory_spaces`, `contexts`, `conversations` fields
- `BatchSyncResult` - Added `memory_spaces`, `contexts`, `conversations` stats
- `QueryStatistics` - Added `labels_removed`, `indexes_added`, `constraints_added` fields

### Breaking Changes

None. All changes are backward compatible.

### Deprecations

- `RecallParams.limit` is deprecated in favor of `RecallParams.limits.total`

---

## [0.27.0] - 2025-12-28

### Multi-Tenancy & Auth Context System

- Complete multi-tenancy with automatic `tenantId` propagation
- New Sessions API for multi-session management
- User profile schemas with validation presets

### New Auth Module (`cortex.auth`)

```python
from cortex.auth import create_auth_context
from cortex import AuthContext, AuthMethod

auth = create_auth_context(
    user_id='user-123',
    tenant_id='tenant-acme',
    organization_id='org-engineering',
    session_id='sess-abc',
    auth_provider='auth0',
    auth_method='oauth',
    claims={'roles': ['admin', 'editor']},
)

cortex = Cortex(CortexConfig(
    convex_url=os.getenv("CONVEX_URL"),
    auth=auth,
))
```

### Sessions API

```python
session = await cortex.sessions.create(CreateSessionParams(
    user_id='user-123',
    tenant_id='tenant-456',
    metadata={'device': 'Chrome on macOS'},
))

await cortex.sessions.touch(session.session_id)
active = await cortex.sessions.get_active('user-123')
await cortex.sessions.end(session.session_id)
```

---

## [0.26.0] - 2025-12-23

### OrchestrationObserver API

- Real-time monitoring of `remember()` and `remember_stream()` pipeline
- Fixed `user_id` propagation in fact extraction
- Subject+FactType matching for belief revision

---

## [0.24.0] - 2025-12-19

### Belief Revision System

- Intelligent fact management with conflict resolution
- Pipeline: Slot matching → Semantic → LLM resolution
- Fact history and audit trail

---

## [0.23.0] - 2025-12-19

### recall() Orchestration API

- Unified context retrieval counterpart to `remember()`
- Multi-signal ranking with configurable weights
- Source breakdown in results

---

## [0.22.0] - 2025-12-19

### Cross-Session Fact Deduplication

- Automatic duplicate fact prevention
- Configurable deduplication strategies: `semantic`, `structural`, `exact`, `none`
- Confidence-based updates for higher-quality facts
