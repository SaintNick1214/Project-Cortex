# Changelog - Cortex Python SDK

All notable changes to the Python SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.25.0] - 2025-12-23

### 🎯 OrchestrationObserver API - Real-time Memory Pipeline Monitoring

Added `OrchestrationObserver` API for real-time monitoring of the `remember()` and `remember_stream()` orchestration pipeline. This mirrors the TypeScript SDK implementation and enables building responsive UIs and debugging tools.

#### New Types

```python
from cortex import (
    MemoryLayer,          # "memorySpace" | "user" | "agent" | "conversation" | "vector" | "facts" | "graph"
    LayerStatus,          # "pending" | "in_progress" | "complete" | "error" | "skipped"
    RevisionAction,       # "CREATE" | "UPDATE" | "SUPERSEDE" | "NONE"
    LayerEvent,           # Event emitted when a layer's status changes
    LayerEventData,       # Data payload for completed layers
    LayerEventError,      # Error details for failed layers
    OrchestrationSummary, # Summary of completed orchestration
    OrchestrationObserver # Protocol for observer implementations
)
```

#### Usage Example

```python
class MyObserver:
    def on_orchestration_start(self, orchestration_id: str) -> None:
        print(f"Starting: {orchestration_id}")
    
    def on_layer_update(self, event: LayerEvent) -> None:
        print(f"Layer {event.layer}: {event.status} ({event.latency_ms}ms)")
    
    def on_orchestration_complete(self, summary: OrchestrationSummary) -> None:
        print(f"Done in {summary.total_latency_ms}ms")

result = await cortex.memory.remember(
    RememberParams(
        memory_space_id="user-space",
        conversation_id="conv-123",
        user_message="Hello",
        agent_response="Hi there!",
        user_id="user-1",
        user_name="Alex",
        agent_id="assistant",
        observer=MyObserver(),  # NEW: Pass observer for real-time monitoring
    )
)
```

---

### 🐛 Bug Fix: `user_id` and `source_ref` Propagation in Fact Extraction

Fixed a regression where `user_id`, `participant_id`, and `source_ref` were not being propagated to facts extracted via the belief revision pipeline during `remember()`. This caused:

- `facts.list(userId=...)` filter not working for extracted facts
- GDPR cascade delete failing to remove facts associated with users
- `source_ref` (conversation link) being lost for extracted facts

```python
# Before: user_id was None for facts created via belief revision
result = await cortex.memory.remember(
    RememberParams(
        memory_space_id="test-space",
        conversation_id="conv-123",
        user_message="I prefer dark mode",
        agent_response="Got it!",
        user_id="user-123",  # This was NOT propagated
        # ...
    )
)
assert result.facts[0].user_id == "user-123"  # FAILED!

# After: All parameters properly propagated
assert result.facts[0].user_id == "user-123"  # ✓ PASSES
assert result.facts[0].participant_id == "agent-1"  # ✓ PASSES  
assert result.facts[0].source_ref is not None  # ✓ PASSES
```

---

### 🧠 Belief Revision Enhancements - Subject+FactType Matching & Fixes

This release significantly improves the belief revision pipeline with better conflict detection and proper supersession handling.

#### 🎯 New: Subject + FactType Matching (Stage 2.5)

Added a new pipeline stage that catches conflicts missed by slot and semantic matching:

```python
# Example: These facts share subject="User" and factType="preference"
# Even with different predicates ("likes" vs "prefers"), they're now candidates
# for LLM conflict resolution
fact1 = "User likes blue"      # subject=User, factType=preference
fact2 = "User prefers purple"  # subject=User, factType=preference
# → Stage 2.5 identifies these as potential conflicts → LLM decides: SUPERSEDE
```

**Pipeline Flow:**
1. Slot Matching (exact predicate classes)
2. Semantic Matching (embedding similarity)
3. **Subject+FactType Matching (NEW)** - catches same-category facts
4. LLM Resolution (nuanced decision)

#### 🔧 Fixed: SUPERSEDE Action Now Uses `facts:supersede`

Previously, SUPERSEDE used `facts:update` which only set `validUntil`, leaving the old fact still appearing as "active" in queries. Now uses the dedicated `facts:supersede` mutation that:
- Sets `supersededBy` to link old → new fact
- Sets `validUntil` timestamp on old fact
- Properly excludes superseded facts from `facts.list(includeSuperseded=False)`

#### 🔧 Fixed: UPDATE Action Uses `facts:updateInPlace`

Changed UPDATE action from `facts:update` to `facts:updateInPlace` to perform true in-place modifications without creating new fact versions.

#### 🔋 "Batteries Included" Mode

BeliefRevisionService now initializes automatically without requiring explicit configuration:

```python
# Before: Required explicit LLM client or config
cortex = Cortex(convex_url="...")  # No belief revision!

# After: Always available, uses heuristics when no LLM configured
cortex = Cortex(convex_url="...")  # Belief revision works via get_default_decision()
```

#### 📊 Enhanced Pipeline Result

`ReviseResult.pipeline` now includes the new stage:

```python
result = await cortex.facts.revise(params)
print(result.pipeline)
# {
#   "slot_matching": {"executed": True, "matched": False},
#   "semantic_matching": {"executed": True, "matched": False},
#   "subject_type_matching": {"executed": True, "matched": True, "fact_ids": ["fact-123"]},  # NEW
#   "llm_resolution": {"executed": True, "decision": "SUPERSEDE"}
# }
```

## [0.24.0] - 2025-12-19

### 🧠 Belief Revision System - Intelligent Fact Management

A complete belief revision pipeline that determines whether a new fact should CREATE, UPDATE, SUPERSEDE, or IGNORE based on slot-based matching, semantic similarity, and LLM conflict resolution.

#### The Problem

Previously, storing facts could lead to duplicates or contradictory information:

```python
# Old way - manual conflict handling 😤
await cortex.facts.store(fact1)  # "User likes blue"
await cortex.facts.store(fact2)  # "User prefers purple" - Now you have two color preferences!
```

#### The Solution

Now `facts.revise()` handles intelligent fact management automatically:

```python
# New way - belief revision ✨
from cortex.facts import ReviseParams, ConflictCandidate

result = await cortex.facts.revise(ReviseParams(
    memory_space_id="agent-1",
    fact=ConflictCandidate(
        fact="User prefers purple",
        subject="user-123",
        predicate="favorite color",
        object="purple",
        confidence=90,
    ),
))

print(f"Action: {result.action}")  # SUPERSEDE - old color preference replaced
print(f"Reason: {result.reason}")  # "Color preference has changed"
```

#### 🚀 Pipeline Stages

1. **Slot Matching (Fast Path)** - O(1) detection of facts in same semantic slot (e.g., `favorite_color`, `location`, `employment`)
2. **Semantic Matching (Catch-All)** - Vector similarity for facts without clear slot classification
3. **LLM Conflict Resolution** - Nuanced decisions using few-shot prompted LLM
4. **Execute & Log** - Apply decision and record to fact history audit trail

#### 🎯 Available Actions

| Action | When Used | Example |
|--------|-----------|---------|
| **ADD** | Genuinely new information | First fact about a topic |
| **UPDATE** | Refines existing fact | "User has a dog" → "User has a dog named Rex" |
| **SUPERSEDE** | Replaces contradictory fact | "Lives in NYC" → "Lives in SF" |
| **NONE** | Already captured | Less specific duplicate |

#### 📦 New Modules

- `cortex/facts/slot_matching.py` - Predicate classification and slot-based matching
- `cortex/facts/conflict_prompts.py` - LLM prompt templates for conflict resolution
- `cortex/facts/belief_revision.py` - Main orchestration service
- `cortex/facts/history.py` - Fact change history and audit trail

#### 🔧 New API Methods

```python
# Configure belief revision with LLM client
cortex.facts.configure_belief_revision(
    llm_client=my_llm,
    config=BeliefRevisionConfig(
        slot_matching=SlotMatchingConfigOptions(enabled=True),
        semantic_matching=SemanticMatchingConfigOptions(threshold=0.7),
        llm_resolution=LLMResolutionConfigOptions(enabled=True),
    )
)

# Intelligent fact storage with belief revision
result = await cortex.facts.revise(params)

# Preview conflicts without storing
conflicts = await cortex.facts.check_conflicts(params)

# Manually supersede facts
await cortex.facts.supersede(
    memory_space_id="space-1",
    old_fact_id="fact-old",
    new_fact_id="fact-new",
    reason="User stated updated preference",
)

# Query fact change history
events = await cortex.facts.history("fact-123")
changes = await cortex.facts.get_changes(ChangeFilter(
    memory_space_id="space-1",
    action="SUPERSEDE",
))

# Get supersession chain (knowledge evolution)
chain = await cortex.facts.get_supersession_chain("fact-456")

# Activity summary
summary = await cortex.facts.get_activity_summary("space-1", hours=24)
```

#### 🔗 Graph Integration

New graph sync functions for supersession relationships:

```python
from cortex.graph import (
    sync_fact_supersession,
    sync_fact_revision,
    get_fact_supersession_chain_from_graph,
    remove_fact_supersession_relationships,
)

# Sync supersession to graph
await sync_fact_supersession("fact-old", "fact-new", adapter, "User moved")
```

#### 🎓 Default Predicate Classes

Built-in slot classification for common fact types:

- `favorite_color` - Color preferences
- `location` - Where user lives/is based
- `employment` - Job and company info
- `age` - Age and birthday
- `name` - Name and nickname
- `relationship_status` - Marital/dating status
- `education` - Schools and degrees
- `language` - Languages spoken
- `food_preference` - Dietary info
- `hobby` - Interests and hobbies
- `pet` - Pet information
- And more...

## [0.23.0] - 2025-12-19

### 🔮 recall() Orchestration API - Unified Context Retrieval

**Complete counterpart to `remember()`.** Just as `remember()` orchestrates storing memories across all layers (conversations, vector, facts, graph), `recall()` now orchestrates retrieving them - giving you unified, ranked, LLM-ready context in a single call.

#### The Problem

Previously, retrieving full context required multiple API calls and manual merging:

```python
# Old way - manual orchestration 😤
vector_results = await cortex.vector.search(space_id, query)
facts_results = await cortex.facts.search(space_id, query)
# Then manually merge, deduplicate, rank, and format...
```

#### The Solution

Now `memory.recall()` handles everything automatically:

```python
# New way - full orchestration ✨
result = await cortex.memory.recall(
    RecallParams(
        memory_space_id="agent-1",
        query="user preferences",
    )
)

# Use directly in LLM prompts
response = await llm.chat(
    messages=[
        {"role": "system", "content": f"Context:\n{result.context}"},
        {"role": "user", "content": user_message},
    ]
)
```

#### ✨ What recall() Does

1. **Parallel Search** - Searches vector memories (Layer 2) and facts (Layer 3) simultaneously
2. **Graph Expansion** - Leverages graph relationships to discover related context (Layer 4)
3. **Smart Merging** - Combines results from all sources with source tracking
4. **Deduplication** - Removes duplicates that appear in multiple sources
5. **Multi-Signal Ranking** - Scores by relevance, confidence, importance, recency, and graph connectivity
6. **LLM Formatting** - Generates ready-to-inject markdown context string

#### 🎯 Batteries Included Defaults

Designed for AI chatbot and multi-agent use cases - all sources enabled by default:

| Option                 | Default                | Description                        |
| ---------------------- | ---------------------- | ---------------------------------- |
| `sources.vector`       | `True`                 | Search vector memories             |
| `sources.facts`        | `True`                 | Search facts directly              |
| `sources.graph`        | `True` (if configured) | Query graph relationships          |
| `format_for_llm`       | `True`                 | Generate LLM-ready context         |
| `include_conversation` | `True`                 | Enrich with ACID conversation data |
| `limit`                | `20`                   | Maximum results to return          |

#### 📊 Ranking Algorithm

Multi-signal scoring with configurable weights:

| Signal             | Weight | Description                   |
| ------------------ | ------ | ----------------------------- |
| Semantic           | 35%    | Vector similarity score       |
| Confidence         | 20%    | Fact confidence (0-100)       |
| Importance         | 15%    | Memory importance (0-100)     |
| Recency            | 15%    | Time decay (30-day half-life) |
| Graph Connectivity | 15%    | Connected entity count        |

Plus boosts for:

- **Highly connected items** (>3 entities): 1.2x boost
- **User messages**: 1.1x boost (more likely to contain preferences)

#### 🎓 Usage Examples

**Minimal usage (full orchestration):**

```python
from cortex import RecallParams

result = await cortex.memory.recall(
    RecallParams(
        memory_space_id="agent-1",
        query="user preferences",
    )
)

# Inject context directly
print(result.context)  # Formatted markdown for LLM
```

**With filters:**

```python
from cortex import RecallParams, RecallSourceConfig

result = await cortex.memory.recall(
    RecallParams(
        memory_space_id="agent-1",
        query="dark mode preferences",
        user_id="user-123",
        min_importance=50,
        min_confidence=80,
        limit=10,
    )
)
```

**Disable specific sources:**

```python
result = await cortex.memory.recall(
    RecallParams(
        memory_space_id="agent-1",
        query="test",
        sources=RecallSourceConfig(
            vector=True,
            facts=False,  # Skip facts
            graph=False,  # Skip graph expansion
        ),
    )
)
```

#### 📦 New Types

| Type                         | Description                         |
| ---------------------------- | ----------------------------------- |
| `RecallParams`               | Input parameters for recall()       |
| `RecallResult`               | Output with items, sources, context |
| `RecallItem`                 | Individual memory or fact item      |
| `RecallSourceBreakdown`      | Per-source result counts            |
| `RecallSourceConfig`         | Source selection options            |
| `RecallGraphExpansionConfig` | Graph traversal options             |
| `RecallGraphContext`         | Graph context per item              |

#### 🧪 Remember/Recall Symmetry

The API is designed for symmetric usage:

```python
# Store with full orchestration
await cortex.memory.remember(RememberParams(...))

# Retrieve with full orchestration
result = await cortex.memory.recall(RecallParams(...))
```

Everything stored via `remember()` is retrievable via `recall()`, with proper deduplication and ranking applied.

---

## [0.22.0] - 2025-12-19

### 🎯 Cross-Session Fact Deduplication

**Automatic duplicate fact prevention across conversations.** No more storing "User's name is Alex" 50 times!

Port of TypeScript SDK 0.22.0 feature to Python SDK.

#### The Problem

Previously, each `remember()` call stored facts independently:

```python
# Conversation 1
await cortex.memory.remember(...)  # Stores: "User's name is Alex"

# Conversation 2
await cortex.memory.remember(...)  # Stores: "User's name is Alex" (duplicate!)

# After 10 conversations: 10 identical facts! 😱
```

#### The Solution

Now `memory.remember()` automatically deduplicates facts across sessions:

```python
# Conversation 1
await cortex.memory.remember(...)  # Stores: "User's name is Alex"

# Conversation 2
await cortex.memory.remember(...)  # Detects duplicate, skips storage ✨

# After 10 conversations: Still just 1 fact! 🎉
```

#### ✨ New Features

| Feature                        | Description                                                                       |
| ------------------------------ | --------------------------------------------------------------------------------- |
| **Automatic Deduplication**    | `memory.remember()` defaults to semantic deduplication (falls back to structural) |
| **Configurable Strategies**    | `exact`, `structural`, `semantic`, or `none`                                      |
| **`facts.store_with_dedup()`** | New method for manual fact storage with deduplication                             |
| **Confidence-Based Updates**   | Higher confidence facts update existing lower-confidence duplicates               |

#### 🔄 Deduplication Strategies

| Strategy     | Speed      | Accuracy | Description                                          |
| ------------ | ---------- | -------- | ---------------------------------------------------- |
| `none`       | ⚡ Fastest | None     | Skip deduplication entirely                          |
| `exact`      | ⚡ Fast    | Low      | Normalized text match                                |
| `structural` | ⚡ Fast    | Medium   | Subject + predicate + object match                   |
| `semantic`   | 🐢 Slower  | High     | Embedding similarity (requires `generate_embedding`) |

#### 🎓 Usage Examples

**Default behavior (recommended):**

```python
# Deduplication is ON by default (semantic → structural fallback)
await cortex.memory.remember(
    RememberParams(
        memory_space_id="agent-1",
        conversation_id="conv-123",
        user_message="I'm Alex",
        agent_response="Nice to meet you!",
        user_id="user-123",
        user_name="Alex",
        agent_id="assistant",
        extract_facts=my_fact_extractor,
    )
)
```

**Disable deduplication:**

```python
await cortex.memory.remember(
    RememberParams(
        memory_space_id="agent-1",
        conversation_id="conv-123",
        user_message="I'm Alex",
        agent_response="Nice to meet you!",
        user_id="user-123",
        user_name="Alex",
        agent_id="assistant",
        extract_facts=my_fact_extractor,
        fact_deduplication=False,  # Disable deduplication
    )
)
```

**Manual deduplication with `store_with_dedup()`:**

```python
from cortex import StoreFactParams, DeduplicationConfig
from cortex.facts import StoreFactWithDedupOptions

result = await cortex.facts.store_with_dedup(
    StoreFactParams(
        memory_space_id="agent-1",
        fact="User prefers dark mode",
        fact_type="preference",
        subject="user-123",
        predicate="prefers",
        object="dark mode",
        confidence=95,
        source_type="conversation",
    ),
    StoreFactWithDedupOptions(
        deduplication=DeduplicationConfig(strategy="structural"),
    )
)

if result.deduplication and result.deduplication.get("matched_existing"):
    print(f"Duplicate found! Using existing fact: {result.fact.fact_id}")
else:
    print(f"New fact stored: {result.fact.fact_id}")
```

#### 📦 New Package Exports

```python
from cortex import (
    # Deduplication types
    DeduplicationConfig,
    DeduplicationStrategy,
    DuplicateResult,
    FactCandidate,
    FactDeduplicationService,
    StoreFactWithDedupOptions,
    StoreWithDedupResult,
)
```

#### 🆕 New Types

| Type                        | Description                                                                  |
| --------------------------- | ---------------------------------------------------------------------------- |
| `DeduplicationStrategy`     | Literal type: `"none" \| "exact" \| "structural" \| "semantic"`              |
| `DeduplicationConfig`       | Configuration with `strategy`, `similarity_threshold`, `generate_embedding`  |
| `FactCandidate`             | Candidate fact for deduplication check                                       |
| `DuplicateResult`           | Result of duplicate detection with `is_duplicate`, `existing_fact`, etc.     |
| `StoreWithDedupResult`      | Result from `store_with_dedup()` with `fact`, `was_updated`, `deduplication` |
| `StoreFactWithDedupOptions` | Options for `store_with_dedup()`                                             |

#### 🆕 New Methods

| Method                                      | Description                                 |
| ------------------------------------------- | ------------------------------------------- |
| `facts.store_with_dedup()`                  | Store fact with cross-session deduplication |
| `FactDeduplicationService.find_duplicate()` | Find duplicate fact in database             |
| `FactDeduplicationService.resolve_config()` | Resolve deduplication config with fallbacks |

#### 🆕 New Parameters

| Type                   | Parameter            | Description                                           |
| ---------------------- | -------------------- | ----------------------------------------------------- |
| `RememberParams`       | `fact_deduplication` | Deduplication strategy, config, or `False` to disable |
| `RememberStreamParams` | `fact_deduplication` | Same as above for streaming                           |

#### ⚠️ Migration Notes

- **No breaking changes** - existing code works unchanged
- **Default behavior changed** - `remember()` now deduplicates by default (semantic → structural fallback)
- To restore previous behavior: `fact_deduplication=False`

---

## [0.21.0] - 2025-12-14

### 🎯 Memory API TypeScript SDK Parity

**Full type safety achieved for Memory API return types. All Memory API methods now return strongly-typed dataclasses instead of generic `Dict[str, Any]` for improved developer experience and type checking.**

#### ✨ New Return Type Dataclasses

**5 new dataclasses added to `cortex/types.py`:**

| Type                 | Description                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| `StoreMemoryResult`  | Result from `store()` with `memory` and `facts` fields                                             |
| `UpdateMemoryResult` | Result from `update()` with `memory` and optional `facts_reextracted`                              |
| `DeleteMemoryResult` | Result from `delete()` with `deleted`, `memory_id`, `facts_deleted`, `fact_ids`                    |
| `ArchiveResult`      | Result from `archive()` with `archived`, `memory_id`, `restorable`, `facts_archived`, `fact_ids`   |
| `MemoryVersionInfo`  | Version info for temporal queries with `memory_id`, `version`, `content`, `timestamp`, `embedding` |

#### 🔄 Updated Method Return Types

| Method               | Before                     | After                         |
| -------------------- | -------------------------- | ----------------------------- |
| `store()`            | `Dict[str, Any]`           | `StoreMemoryResult`           |
| `update()`           | `Dict[str, Any]`           | `UpdateMemoryResult`          |
| `delete()`           | `Dict[str, Any]`           | `DeleteMemoryResult`          |
| `archive()`          | `Dict[str, Any]`           | `ArchiveResult`               |
| `get_version()`      | `Optional[Dict[str, Any]]` | `Optional[MemoryVersionInfo]` |
| `get_history()`      | `List[Dict[str, Any]]`     | `List[MemoryVersionInfo]`     |
| `get_at_timestamp()` | `Optional[Dict[str, Any]]` | `Optional[MemoryVersionInfo]` |
| `update_many()`      | `Dict[str, Any]`           | `UpdateManyResult`            |
| `delete_many()`      | `Dict[str, Any]`           | `DeleteManyResult`            |

#### 🎓 Usage Examples

```python
from cortex import Cortex, CortexConfig, StoreMemoryInput, MemorySource, MemoryMetadata

cortex = Cortex(CortexConfig(convex_url="..."))

# store() now returns StoreMemoryResult
result = await cortex.memory.store(
    'agent-1',
    StoreMemoryInput(
        content='User prefers dark mode',
        content_type='raw',
        source=MemorySource(type='system', timestamp=now),
        metadata=MemoryMetadata(importance=60, tags=['preferences'])
    )
)
print(f"Stored memory: {result.memory.memory_id}")
print(f"Extracted facts: {len(result.facts)}")

# get_history() now returns List[MemoryVersionInfo]
history = await cortex.memory.get_history('agent-1', 'mem-123')
for version in history:
    print(f"v{version.version}: {version.content[:50]}...")
```

#### 📦 New Package Exports

All new types are exported from `cortex`:

```python
from cortex import (
    StoreMemoryResult,
    UpdateMemoryResult,
    DeleteMemoryResult,
    ArchiveResult,
    MemoryVersionInfo,
)
```

#### ⚠️ Migration Notes

This is a **type-level change only**. The actual return data is the same - only the type annotations and return structure have changed from generic dicts to dataclasses. Existing code accessing dictionary keys will need to be updated to use attribute access:

```python
# Before (v0.20.0)
result = await cortex.memory.store(...)
memory_id = result["memory"].memory_id

# After (v0.21.0)
result = await cortex.memory.store(...)
memory_id = result.memory.memory_id
```

---

### 🤝 A2A API Enhancements

**Full TypeScript SDK 0.21.0 parity achieved for A2A Communication API.**

#### New Types

Three new dataclasses for typed A2A conversation handling:

- `A2AConversationFilters` - Filters for `get_conversation()` with since/until, min_importance, tags, user_id, and pagination
- `A2AConversationMessage` - Individual message in A2A conversation with all metadata fields
- `A2AConversation` - Complete A2A conversation result with typed messages and period data

```python
from cortex.types import A2AConversation, A2AConversationFilters, A2AConversationMessage

# Using filters object
filters = A2AConversationFilters(
    min_importance=70,
    tags=["budget"],
    limit=50
)
convo = await cortex.a2a.get_conversation("finance-agent", "hr-agent", filters=filters)

# Access typed response
print(f"{convo.message_count} messages exchanged")
print(f"Period: {convo.period_start} to {convo.period_end}")
for msg in convo.messages:
    print(f"{msg.from_agent} -> {msg.to_agent}: {msg.message}")
```

#### Enhanced Methods

- `get_conversation()` - Now returns typed `A2AConversation` instead of `Dict[str, Any]`
  - Accepts optional `A2AConversationFilters` object OR individual parameters (backward compatible)
  - Messages are now typed `A2AConversationMessage` objects with all metadata
  - Period data extracted into `period_start` and `period_end` fields

- `request()` - Enhanced error handling for pub/sub configuration errors
  - Now extracts `messageId` from PUBSUB_NOT_CONFIGURED error messages (matches TypeScript)
  - Provides clearer error messages about pub/sub infrastructure requirements

#### Type Updates

| Type                     | Fields Added   | Description                                                          |
| ------------------------ | -------------- | -------------------------------------------------------------------- |
| `A2AConversationFilters` | All fields new | Filter object for get_conversation                                   |
| `A2AConversationMessage` | All fields new | Typed message with from_agent, to_agent, direction, broadcast fields |
| `A2AConversation`        | All fields new | Typed conversation result with period_start, period_end              |

#### Backward Compatibility

✅ **Zero Breaking Changes**

- `get_conversation()` still accepts individual parameters (since, until, min_importance, etc.)
- Existing code continues to work without modification
- New `filters` parameter is optional

---

### 🗄️ Mutable API Enhancements

**Full TypeScript SDK 0.21.0 parity achieved for Mutable Store API.**

#### New Types

Eight new dataclasses for typed Mutable operations:

- `ListMutableFilter` - Filter object for `list()` with namespace, key_prefix, user_id, limit, offset, updated_after/before, sort_by, sort_order
- `CountMutableFilter` - Filter object for `count()` with namespace, user_id, key_prefix, updated_after/before
- `PurgeManyMutableFilter` - Filter object for `purge_many()` with namespace, key_prefix, user_id, updated_before, last_accessed_before
- `PurgeNamespaceOptions` - Options for `purge_namespace()` with dry_run
- `SetMutableOptions` - Options for `set()` with sync_to_graph
- `DeleteMutableOptions` - Options for `delete()` with sync_to_graph
- `MutableOperation` - Single operation in a transaction (op, namespace, key, value, amount)
- `TransactionResult` - Result from `transaction()` with success, operations_executed, results

```python
from cortex.types import (
    ListMutableFilter, CountMutableFilter, PurgeManyMutableFilter,
    PurgeNamespaceOptions, MutableOperation, TransactionResult,
)

# List with filter object (supports all filter options)
items = await cortex.mutable.list(ListMutableFilter(
    namespace='inventory',
    key_prefix='widget-',
    sort_by='updatedAt',
    sort_order='desc',
    limit=50,
))

# Count with filter object
count = await cortex.mutable.count(CountMutableFilter(
    namespace='inventory',
    updated_after=last_24_hours,
))

# Atomic transaction with multiple operations
result = await cortex.mutable.transaction([
    MutableOperation(op='increment', namespace='counters', key='sales', amount=1),
    MutableOperation(op='decrement', namespace='inventory', key='widget-qty', amount=1),
    MutableOperation(op='set', namespace='state', key='last-sale', value=timestamp),
])
```

#### Enhanced Methods

- `set()` - Added `metadata` and `options` parameters for graph sync support
- `get()` - Now returns just the value (use `get_record()` for full record)
- `update()` - Now uses backend `mutable:update` mutation (eliminates race condition)
- `increment()` / `decrement()` - Now use direct backend calls (atomic operations)
- `list()` - Now accepts `ListMutableFilter` with offset, updated_after/before, sort_by, sort_order
- `count()` - Now accepts `CountMutableFilter` with updated_after/before
- `delete()` - Added `options` parameter for graph sync support
- `purge_namespace()` - Added `PurgeNamespaceOptions` with dry_run support
- `purge_many()` - Now accepts `PurgeManyMutableFilter` with last_accessed_before
- `transaction()` - Now uses array-based operations (matches TypeScript SDK)

#### New Methods

- `purge()` - Alias for `delete()` for API consistency

#### Fixed Issues

- **Race condition fixed**: `increment()` and `decrement()` now use atomic backend operations
- **Race condition fixed**: `update()` now uses backend `mutable:update` instead of get-then-set
- **dryRun support**: `purge_namespace()` now properly passes `dryRun` to backend

#### Breaking Changes

⚠️ **Method Signature Changes**

These changes match the TypeScript SDK and improve type safety:

```python
# Before (v0.20.0) - positional arguments
items = await cortex.mutable.list('inventory', key_prefix='widget-', limit=50)
count = await cortex.mutable.count('inventory', key_prefix='widget-')
await cortex.mutable.purge_many('cache', updated_before=timestamp)
await cortex.mutable.purge_namespace('temp', dry_run=True)

# After (v0.21.0) - filter objects
items = await cortex.mutable.list(ListMutableFilter(
    namespace='inventory', key_prefix='widget-', limit=50
))
count = await cortex.mutable.count(CountMutableFilter(
    namespace='inventory', key_prefix='widget-'
))
await cortex.mutable.purge_many(PurgeManyMutableFilter(
    namespace='cache', updated_before=timestamp
))
await cortex.mutable.purge_namespace('temp', PurgeNamespaceOptions(dry_run=True))
```

- `get()` now returns the value directly, not the full record
- `transaction()` now takes a list of `MutableOperation` instead of a callback

---

### 📦 Immutable API Enhancements

**Full TypeScript SDK 0.21.0 parity achieved for Immutable Store API.**

#### New Types

Nine new dataclasses for typed Immutable operations:

- `ImmutableVersionExpanded` - Expanded version with type/id info (returned by get_version, get_history, get_at_timestamp)
- `ListImmutableFilter` - Filter object for `list()` with type, user_id, limit
- `SearchImmutableInput` - Input object for `search()` with query, type, user_id, limit
- `ImmutableSearchResult` - Typed search result with entry, score, highlights
- `CountImmutableFilter` - Filter object for `count()` with type, user_id
- `StoreImmutableOptions` - Options for `store()` with sync_to_graph
- `PurgeImmutableResult` - Typed result from `purge()` with deleted, type, id, versions_deleted
- `PurgeManyFilter` - Filter object for `purge_many()` with type, user_id
- `PurgeManyImmutableResult` - Typed result from `purge_many()` with deleted, total_versions_deleted, entries
- `PurgeVersionsResult` - Typed result from `purge_versions()` with versions_purged, versions_remaining

```python
from cortex.types import (
    ImmutableVersionExpanded, ListImmutableFilter, SearchImmutableInput,
    ImmutableSearchResult, CountImmutableFilter, StoreImmutableOptions,
    PurgeImmutableResult, PurgeManyFilter, PurgeManyImmutableResult,
    PurgeVersionsResult,
)

# Store with graph sync option
record = await cortex.immutable.store(
    ImmutableEntry(type='kb-article', id='guide-1', data={'title': 'Guide'}),
    StoreImmutableOptions(sync_to_graph=True)
)

# List with filter object
articles = await cortex.immutable.list(ListImmutableFilter(
    type='kb-article',
    limit=50,
))

# Search with typed input and result
results = await cortex.immutable.search(SearchImmutableInput(
    query='refund process',
    type='kb-article',
    limit=10,
))
for result in results:
    print(f"Score: {result.score}, Title: {result.entry.data.get('title')}")

# Get version returns expanded type with full info
version = await cortex.immutable.get_version('kb-article', 'guide-1', 1)
if version:
    print(f"Type: {version.type}, ID: {version.id}, Version: {version.version}")

# Timestamp with datetime support
from datetime import datetime
version = await cortex.immutable.get_at_timestamp(
    'policy', 'refund-policy',
    datetime(2025, 1, 1)  # Now accepts datetime, not just int
)
```

#### Enhanced Methods

- `store()` - Added optional `options` parameter with `sync_to_graph` for graph database sync
- `get_version()` - Now returns `ImmutableVersionExpanded` with type/id info
- `get_history()` - Now returns `List[ImmutableVersionExpanded]` with full info per version
- `get_at_timestamp()` - Now accepts `Union[int, datetime]` and returns `ImmutableVersionExpanded`
- `list()` - Now accepts `ListImmutableFilter` object
- `search()` - Now accepts `SearchImmutableInput` and returns `List[ImmutableSearchResult]`
- `count()` - Now accepts `CountImmutableFilter` object
- `purge()` - Now returns typed `PurgeImmutableResult`
- `purge_many()` - Now accepts `PurgeManyFilter` and returns `PurgeManyImmutableResult`
- `purge_versions()` - Now returns typed `PurgeVersionsResult`

#### Breaking Changes

⚠️ **Method Signature Changes**

These changes match the TypeScript SDK and improve type safety:

```python
# Before (v0.20.0) - positional/keyword arguments
articles = await cortex.immutable.list(type='kb-article', limit=50)
results = await cortex.immutable.search('refund', type='kb-article')
count = await cortex.immutable.count(type='kb-article')
await cortex.immutable.purge_many(type='old-data', user_id='user-123', dry_run=True)
await cortex.immutable.purge_versions('kb-article', 'guide-1', keep_latest=5, older_than=timestamp)

# After (v0.21.0) - filter/input objects and typed returns
articles = await cortex.immutable.list(ListImmutableFilter(type='kb-article', limit=50))
results = await cortex.immutable.search(SearchImmutableInput(query='refund', type='kb-article'))
count = await cortex.immutable.count(CountImmutableFilter(type='kb-article'))
result = await cortex.immutable.purge_many(PurgeManyFilter(type='old-data', user_id='user-123'))
result = await cortex.immutable.purge_versions('kb-article', 'guide-1', keep_latest=5)  # older_than removed
```

- `purge_many()`: Removed `created_before` and `dry_run` parameters (not in TypeScript SDK)
- `purge_versions()`: `keep_latest` is now required, `older_than` parameter removed
- `search()`: Returns `List[ImmutableSearchResult]` instead of `List[Dict[str, Any]]`
- `get_version()`, `get_history()`, `get_at_timestamp()`: Return `ImmutableVersionExpanded` instead of `ImmutableVersion`

---

### 🛡️ Governance API Resilience Layer Fix

**Fixed missing resilience layer wrapping for Governance API. All 8 methods now route through `_execute_with_resilience()` for overload protection.**

In v0.20.0, the Governance API was accidentally omitted from the resilience layer update. This fix ensures all Governance operations receive the same protection as other APIs.

#### Methods Updated

| Method                    | Operation Name                   |
| ------------------------- | -------------------------------- |
| `set_policy()`            | `governance:setPolicy`           |
| `get_policy()`            | `governance:getPolicy`           |
| `set_agent_override()`    | `governance:setAgentOverride`    |
| `get_template()`          | `governance:getTemplate`         |
| `enforce()`               | `governance:enforce`             |
| `simulate()`              | `governance:simulate`            |
| `get_compliance_report()` | `governance:getComplianceReport` |
| `get_enforcement_stats()` | `governance:getEnforcementStats` |

#### Benefits

- Rate limiting, circuit breaking, and priority queuing now apply to Governance operations
- `governance:enforce` automatically classified as `high` priority
- `governance:simulate` and `governance:getComplianceReport` classified as `background` priority
- Consistent error handling and retry behavior with other APIs

---

### 🔧 Contexts API Bug Fixes

**Full TypeScript SDK 0.21.0 parity achieved for Contexts API.**

#### Bug Fixes

- **`export()`** - Fixed endpoint name: was calling `contexts:export` instead of `contexts:exportContexts`
- **`update_many()`** - Fixed parameter format: filters now flattened to top-level (was incorrectly nested in `filters` key)
- **`delete_many()`** - Fixed parameter format: filters now flattened to top-level (was incorrectly nested in `filters` key)

#### Type Updates

| Type               | Fields Added                 | Description                                  |
| ------------------ | ---------------------------- | -------------------------------------------- |
| `ContextWithChain` | `descendants: List[Context]` | List of all descendant contexts in the chain |
| `ContextWithChain` | `total_nodes: int`           | Total number of nodes in the context chain   |

---

### 🔍 Vector API Enhancements

**Full TypeScript SDK 0.21.0 parity achieved for Vector API.**

#### New Methods

- **`restore_from_archive()`** - Restore a memory from archive
  - Returns `{ restored: bool, memoryId: str, memory: MemoryEntry }`
  - Validates memory_space_id and memory_id before execution
  - Converts returned memory to `MemoryEntry` dataclass

```python
# Restore an archived memory
result = await cortex.vector.restore_from_archive('agent-1', 'mem-123')
print(f"Restored: {result['restored']}")
print(f"Memory: {result['memory'].content}")
```

#### Enhanced Methods

- **`search()`** - Now supports `query_category` parameter for bullet-proof retrieval
  - Matching category gives +30% score boost
  - Aligns with enriched fact extraction system

```python
# Search with category boosting
results = await cortex.vector.search(
    'agent-1',
    'what should I call the user',
    SearchOptions(
        embedding=await embed(query),
        query_category='addressing_preference',  # NEW: Category boost
    )
)
```

- **`delete_many()`** - Signature aligned with TypeScript SDK
  - Now uses flat filter parameters instead of nested dict
  - Returns `{ deleted: int, memoryIds: List[str] }`

```python
# Old signature (deprecated pattern)
await cortex.vector.delete_many('agent-1', {'source_type': 'system'})

# New signature (TypeScript parity)
await cortex.vector.delete_many(
    memory_space_id='agent-1',
    source_type='system',
)
```

- **`update_many()`** - Signature aligned with TypeScript SDK
  - Now uses flat filter and update parameters
  - Returns `{ updated: int, memoryIds: List[str] }`

```python
# Old signature (deprecated pattern)
await cortex.vector.update_many('agent-1', {'user_id': 'user-123'}, {'importance': 75})

# New signature (TypeScript parity)
await cortex.vector.update_many(
    memory_space_id='agent-1',
    source_type='system',
    importance=20,
)
```

- **`export()`** - Fixed Convex function name
  - Now calls `memories:exportMemories` (was incorrectly calling `memories:export`)

#### Type Updates

| Type            | Field Added                     | Description                               |
| --------------- | ------------------------------- | ----------------------------------------- |
| `SearchOptions` | `query_category: Optional[str]` | Category boost for bullet-proof retrieval |

#### Validation Updates

- Added `query_category` validation to `validate_search_options()`
- `update_many()` now validates that at least one update field is provided

---

### 🏠 Memory Spaces API Enhancements

**Full TypeScript SDK 0.21.0 parity achieved for Memory Spaces API.**

#### New Methods

Three new methods for participant management:

- `add_participant()` - Add a single participant to a memory space
- `remove_participant()` - Remove a single participant from a memory space
- `find_by_participant()` - Find all memory spaces containing a specific participant

```python
# Add a participant
await cortex.memory_spaces.add_participant(
    'team-alpha',
    {'id': 'tool-analyzer', 'type': 'tool', 'joinedAt': int(time.time() * 1000)}
)

# Remove a participant
await cortex.memory_spaces.remove_participant('team-alpha', 'tool-analyzer')

# Find spaces by participant
spaces = await cortex.memory_spaces.find_by_participant('user-123')
```

#### Enhanced Methods

- `list()` - Now accepts `ListMemorySpacesFilter` object and returns `ListMemorySpacesResult`
  - Added `sort_by` and `sort_order` parameters
  - Returns typed result with pagination metadata (total, has_more, offset)

- `update()` - Added `options` parameter for graph sync support
  - New `UpdateMemorySpaceOptions` with `sync_to_graph` field

- `update_participants()` - Fixed signature to match TypeScript SDK
  - Now accepts `ParticipantUpdates` object with typed `add` (list of participant dicts) instead of list of IDs
  - `add` now expects `[{'id': str, 'type': str, 'joinedAt': int}]`

- `get_stats()` - Now accepts `GetMemorySpaceStatsOptions` and forwards params to backend
  - Added `time_window` support ('24h', '7d', '30d', '90d', 'all')
  - Added `include_participants` for Hive Mode participant breakdown

- `delete()` - Now accepts `DeleteMemorySpaceOptions` and returns typed `DeleteMemorySpaceResult`
  - Required `cascade` and `reason` fields for audit trail
  - Optional `confirm_id` safety check
  - Returns structured cascade deletion counts

- `get()` - Removed extra `include_stats` parameter not in TypeScript SDK

#### New Types

Eight new dataclasses for Memory Spaces operations:

- `ListMemorySpacesFilter` - Filter object with type, status, participant, pagination, sorting
- `ListMemorySpacesResult` - Typed result with spaces, total, has_more, offset
- `DeleteMemorySpaceOptions` - Options with cascade, reason, confirm_id, sync_to_graph
- `DeleteMemorySpaceCascade` - Cascade deletion counts
- `DeleteMemorySpaceResult` - Deletion result with cascade details
- `GetMemorySpaceStatsOptions` - Options with time_window, include_participants
- `UpdateMemorySpaceOptions` - Options with sync_to_graph
- `ParticipantUpdates` - Combined add/remove updates for update_participants

```python
from cortex.types import (
    ListMemorySpacesFilter, ListMemorySpacesResult,
    DeleteMemorySpaceOptions, DeleteMemorySpaceResult,
    GetMemorySpaceStatsOptions, UpdateMemorySpaceOptions,
    ParticipantUpdates,
)

# List with filter
result = await cortex.memory_spaces.list(
    ListMemorySpacesFilter(
        type='team',
        status='active',
        sort_by='createdAt',
        sort_order='desc'
    )
)
print(f"Found {result.total} spaces")

# Delete with typed options
result = await cortex.memory_spaces.delete(
    'old-space',
    DeleteMemorySpaceOptions(
        cascade=True,
        reason='GDPR deletion request',
        confirm_id='old-space'
    )
)
print(f"Deleted {result.cascade.memories_deleted} memories")
```

#### Validation Updates

- Added `validate_time_window()` for stats time window validation
- Added `validate_delete_options()` for delete options validation

#### Type Updates

| Type                     | Fields Added                                        | Description                 |
| ------------------------ | --------------------------------------------------- | --------------------------- |
| `MemorySpaceStats`       | `memories_this_window`, `conversations_this_window` | Time window activity counts |
| `MemorySpaceParticipant` | -                                                   | Now exported for public use |

---

### 📋 Facts API Enhancements

**Full TypeScript SDK 0.21.0 parity achieved for Facts API.**

#### New Types

Three new dataclasses for typed Facts operations:

- `UpdateFactInput` - Input type for `update()` with all updatable fields including enrichment
- `DeleteFactResult` - Typed result from `delete()` with `deleted` and `fact_id` fields
- `DeleteManyFactsResult` - Typed result from `delete_many()` with `deleted` count and `memory_space_id`

```python
from cortex.types import UpdateFactInput, DeleteFactResult, DeleteManyFactsResult

# Typed update input
updated = await cortex.facts.update(
    'agent-1',
    'fact-123',
    UpdateFactInput(
        confidence=99,
        tags=['verified', 'important'],
        # Enrichment fields supported
        category='addressing_preference',
        search_aliases=['name', 'nickname', 'what to call'],
        semantic_context='Use when greeting the user',
    )
)

# Typed delete result
result: DeleteFactResult = await cortex.facts.delete('agent-1', 'fact-123')
print(f"Deleted: {result.deleted}, ID: {result.fact_id}")

# Typed delete many result
many_result: DeleteManyFactsResult = await cortex.facts.delete_many(
    DeleteManyFactsParams(memory_space_id='agent-1', fact_type='preference')
)
print(f"Deleted {many_result.deleted} facts from {many_result.memory_space_id}")
```

#### Enhanced Methods

- **`store()`** - Now passes all enrichment fields to Convex backend
  - `category` - Specific sub-category for filtering
  - `search_aliases` - Alternative search terms for bullet-proof retrieval
  - `semantic_context` - Usage context sentence
  - `entities` - Extracted entities with name, type, and full_value
  - `relations` - Subject-predicate-object triples for graph sync

- **`update()`** - Complete rewrite with full parity
  - Now accepts `UpdateFactInput` dataclass OR legacy `Dict[str, Any]`
  - Proper snake_case to camelCase field mapping for Convex
  - Full enrichment field support (category, search_aliases, semantic_context, entities, relations)
  - Backward compatible with existing dict-based usage

- **`delete()`** - Returns typed `DeleteFactResult` instead of `Dict[str, bool]`

- **`delete_many()`** - Returns typed `DeleteManyFactsResult` instead of `Dict[str, Any]`

#### Type Updates

| Type                    | Fields                                                                                                                             | Description                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `UpdateFactInput`       | `fact`, `confidence`, `tags`, `valid_until`, `metadata`, `category`, `search_aliases`, `semantic_context`, `entities`, `relations` | Typed input for fact updates with enrichment |
| `DeleteFactResult`      | `deleted: bool`, `fact_id: str`                                                                                                    | Typed result from delete operation           |
| `DeleteManyFactsResult` | `deleted: int`, `memory_space_id: str`                                                                                             | Typed result from bulk delete                |

#### Validation Updates

- **`validate_update_has_fields()`** - Now checks for enrichment fields in addition to basic fields
  - Supports both camelCase (Convex) and snake_case (Python) field names
  - Validates category, searchAliases/search_aliases, semanticContext/semantic_context, entities, relations

#### Backward Compatibility

✅ **Zero Breaking Changes**

- `update()` still accepts `Dict[str, Any]` for legacy code
- `delete()` and `delete_many()` return typed dataclasses that support attribute access
- Existing code continues to work without modification

---

### 👤 Users API Enhancements

**Full TypeScript SDK 0.21.0 parity achieved for Users API.**

#### New Types

Three new dataclasses for comprehensive user management:

- `ListUsersFilter` - Comprehensive filter dataclass with date/sort/pagination options
- `ListUsersResult` - Typed paginated result for list operations
- `ExportUsersOptions` - Typed export options with format and inclusion flags

```python
from cortex import ListUsersFilter, ListUsersResult, ExportUsersOptions

# Using comprehensive filters
filters = ListUsersFilter(
    created_after=int((time.time() - 7 * 24 * 60 * 60) * 1000),  # Last 7 days
    sort_by='createdAt',
    sort_order='desc',
    display_name='alex',  # Client-side filter
    limit=20
)

# Typed result
result = await cortex.users.list(filters)
print(f"Found {result.total} users, showing {len(result.users)}")
print(f"Has more: {result.has_more}")
```

#### Enhanced Methods

| Method          | Before                                  | After                                          |
| --------------- | --------------------------------------- | ---------------------------------------------- |
| `list()`        | `list(limit=50, offset=0)` returns dict | `list(filters?)` returns `ListUsersResult`     |
| `search()`      | `search(filters?, limit)`               | `search(filters?)` with full `ListUsersFilter` |
| `merge()`       | Throws if user not found                | Creates user if not found (matches TS)         |
| `export()`      | Returns dict                            | Returns string (JSON/CSV)                      |
| `update_many()` | Only accepts list of IDs                | Accepts IDs or filters, supports `dry_run`     |
| `delete_many()` | Only accepts list of IDs                | Accepts IDs or filters, supports `dry_run`     |

#### Usage Examples

```python
from cortex import ListUsersFilter, ExportUsersOptions

# list() with full filtering
result = await cortex.users.list(ListUsersFilter(
    created_after=int((time.time() - 30 * 24 * 60 * 60) * 1000),
    sort_by='updatedAt',
    sort_order='desc',
    limit=50
))

# search() with client-side filters
users = await cortex.users.search(ListUsersFilter(
    display_name='alex',
    email='@company.com'
))

# merge() now creates if not found
profile = await cortex.users.merge('new-user', {'displayName': 'New User'})

# export() with typed options
json_export = await cortex.users.export(ExportUsersOptions(
    format='json',
    include_version_history=True,
    include_conversations=True
))

# Bulk operations with filters and dry run
preview = await cortex.users.delete_many(
    ListUsersFilter(updated_before=int((time.time() - 365 * 24 * 60 * 60) * 1000)),
    {'dry_run': True}
)
print(f"Would delete {len(preview['user_ids'])} users")

# Execute when ready
result = await cortex.users.delete_many(
    preview['user_ids'],
    {'cascade': True}
)
```

#### New Validators

- `validate_list_users_filter()` - Full validation for filter fields, date ranges, sort options
- `validate_export_options()` - Format and inclusion flags validation
- `validate_bulk_update_options()` - Dry run and skip_versioning validation
- `validate_bulk_delete_options()` - Cascade and dry_run validation

---

### 🔄 Conversations API Full Parity

**Full TypeScript SDK 0.21.0 parity achieved for Conversations API.**

All Conversations API methods now match the TypeScript SDK signatures, return types, and filtering capabilities.

#### New Types

| Type                             | Description                                                     |
| -------------------------------- | --------------------------------------------------------------- |
| `GetConversationOptions`         | Options for `get()` with `include_messages` and `message_limit` |
| `ListConversationsFilter`        | Comprehensive filter with dates, pagination, sorting            |
| `ListConversationsResult`        | Result with pagination metadata (`total`, `has_more`, etc.)     |
| `CountConversationsFilter`       | Filter object for `count()`                                     |
| `GetHistoryOptions`              | Options with `since`, `until`, `roles`, `offset` filters        |
| `GetHistoryResult`               | Result with messages and pagination info                        |
| `ConversationDeletionResult`     | Enriched deletion result with `messages_deleted`, `deleted_at`  |
| `DeleteManyConversationsOptions` | Options with `dry_run`, `confirmation_threshold`                |
| `DeleteManyConversationsResult`  | Result with `would_delete` for dry run                          |
| `SearchConversationsOptions`     | Options with `search_in`, `match_mode`                          |
| `SearchConversationsFilters`     | Filters for search                                              |
| `SearchConversationsInput`       | Input object for search                                         |

#### Enhanced Methods

**1. `get()` - Now accepts options:**

```python
# Get without messages (faster for metadata-only queries)
conv = await cortex.conversations.get('conv-123', GetConversationOptions(
    include_messages=False
))

# Limit messages returned
conv = await cortex.conversations.get('conv-123', GetConversationOptions(
    message_limit=10
))
```

**2. `list()` - Now uses filter object and returns `ListConversationsResult`:**

```python
result = await cortex.conversations.list(ListConversationsFilter(
    memory_space_id='space-123',
    sort_by='lastMessageAt',
    sort_order='desc',
    created_after=int(time.time() * 1000) - 7 * 24 * 60 * 60 * 1000,
    limit=10,
    offset=20,
))
print(f"Found {result.total} conversations, hasMore: {result.has_more}")
```

**3. `count()` - Now uses filter object:**

```python
count = await cortex.conversations.count(CountConversationsFilter(
    memory_space_id='user-123-personal'
))
```

**4. `delete()` - Now returns `ConversationDeletionResult`:**

```python
result = await cortex.conversations.delete('conv-123')
print(f"Deleted {result.messages_deleted} messages")
print(f"Restorable: {result.restorable}")  # Always false
```

**5. `delete_many()` - Now accepts options with dry run:**

```python
# Preview what would be deleted
preview = await cortex.conversations.delete_many(
    {'user_id': 'user-123'},
    DeleteManyConversationsOptions(dry_run=True)
)
print(f"Would delete {preview.would_delete} conversations")

# Execute with threshold
result = await cortex.conversations.delete_many(
    {'user_id': 'user-123'},
    DeleteManyConversationsOptions(confirmation_threshold=100)
)
```

**6. `get_history()` - Now accepts full options:**

```python
# Filter by date range
recent = await cortex.conversations.get_history(
    'conv-abc123',
    GetHistoryOptions(
        since=int(time.time() * 1000) - 24 * 60 * 60 * 1000,  # Last 24h
    )
)

# Filter by roles
user_messages = await cortex.conversations.get_history(
    'conv-abc123',
    GetHistoryOptions(roles=['user'])
)
```

**7. `search()` - Now accepts input object with options:**

```python
results = await cortex.conversations.search(
    SearchConversationsInput(
        query='account balance',
        options=SearchConversationsOptions(
            search_in='both',  # Search content and metadata
            match_mode='fuzzy',
        )
    )
)
```

#### Breaking Changes

| Method          | Before                                          | After                                                              |
| --------------- | ----------------------------------------------- | ------------------------------------------------------------------ |
| `list()`        | Positional params, returns `List[Conversation]` | `ListConversationsFilter` param, returns `ListConversationsResult` |
| `count()`       | Positional params                               | `CountConversationsFilter` param                                   |
| `delete()`      | Returns `Dict[str, bool]`                       | Returns `ConversationDeletionResult`                               |
| `delete_many()` | Positional params, returns `Dict`               | Filter dict + options, returns `DeleteManyConversationsResult`     |
| `get_history()` | Positional params                               | `GetHistoryOptions` param                                          |
| `search()`      | Positional params                               | `SearchConversationsInput` param                                   |

#### Migration Guide

```python
# Before (v0.20.x)
conversations = await cortex.conversations.list(
    type='user-agent',
    user_id='user-123',
    limit=10
)

# After (v0.21.0)
result = await cortex.conversations.list(ListConversationsFilter(
    type='user-agent',
    user_id='user-123',
    limit=10
))
conversations = result.conversations
```

---

### 🔗 Graph API Enhancements

**Full TypeScript SDK 0.21.0 parity achieved for Graph Database Integration.**

#### New Modules

| Module                          | Description                                                       |
| ------------------------------- | ----------------------------------------------------------------- |
| `cortex.graph.errors`           | Error classes for graph database operations                       |
| `cortex.graph.orphan_detection` | Sophisticated orphan detection with circular reference protection |
| `cortex.graph.batch_sync`       | Batch sync functions for initial graph synchronization            |
| `cortex.graph.schema`           | Schema initialization, verification, and management               |
| `cortex.graph.adapters.cypher`  | CypherGraphAdapter for Neo4j and Memgraph                         |
| `cortex.graph.worker`           | Real-time reactive GraphSyncWorker                                |

#### New Types

**15 new dataclasses added to `cortex/types.py`:**

| Type                       | Description                                                         |
| -------------------------- | ------------------------------------------------------------------- |
| `GraphQuery`               | Cypher query with parameters                                        |
| `QueryStatistics`          | Query execution statistics (nodes/edges created, deleted, etc.)     |
| `GraphOperation`           | Batch operation for graph write (CREATE_NODE, UPDATE_NODE, etc.)    |
| `OrphanRule`               | Orphan detection rules for different node types                     |
| `DeletionContext`          | Context for tracking deletions (prevents circular reference issues) |
| `OrphanCheckResult`        | Result of orphan detection with circular island detection           |
| `GraphDeleteResult`        | Result of cascading delete operation                                |
| `BatchSyncLimits`          | Limits for batch sync operations per entity type                    |
| `BatchSyncOptions`         | Options for batch graph sync with progress callback                 |
| `BatchSyncStats`           | Stats for a single entity type in batch sync                        |
| `BatchSyncError`           | Error from batch sync operation                                     |
| `BatchSyncResult`          | Full result from batch graph sync                                   |
| `SchemaVerificationResult` | Result from schema verification                                     |

#### Updated Types

| Type                 | Changes                                                       |
| -------------------- | ------------------------------------------------------------- |
| `GraphQueryResult`   | Added `stats: Optional[QueryStatistics]` field                |
| `TraversalConfig`    | Added `filter`, `filter_params` fields for filtered traversal |
| `ShortestPathConfig` | Added `direction` field for directed path search              |
| `GraphAdapter`       | Updated protocol with all 13+ methods matching TypeScript SDK |

#### Error Classes

New error hierarchy in `cortex.graph.errors`:

```python
from cortex.graph.errors import (
    GraphDatabaseError,      # Base error for graph operations
    GraphConnectionError,    # Connection failures
    GraphQueryError,         # Query execution failures
    GraphNotFoundError,      # Node/edge not found
    GraphSchemaError,        # Schema operation failures
    GraphSyncError,          # Sync operation failures
)
```

#### Orphan Detection

Sophisticated orphan detection with circular reference protection:

```python
from cortex.graph import (
    ORPHAN_RULES,
    create_deletion_context,
    detect_orphan,
    delete_with_orphan_cleanup,
    can_run_orphan_cleanup,
)

# Create deletion context with orphan rules
ctx = create_deletion_context("Delete Memory mem-123", ORPHAN_RULES)

# Delete with automatic orphan cleanup
result = await delete_with_orphan_cleanup(node_id, "Memory", ctx, adapter)
print(f"Deleted {len(result.deleted_nodes)} nodes")
print(f"Orphan islands cleaned: {len(result.orphan_islands)}")
```

**Default Orphan Rules:**

| Node Type                   | Rule                                            |
| --------------------------- | ----------------------------------------------- |
| `Conversation`              | Keep if referenced by Memory, Fact, or Context  |
| `Entity`                    | Keep if referenced by any Fact                  |
| `User`                      | Never auto-delete (shared across memory spaces) |
| `Participant`               | Never auto-delete (Hive Mode participants)      |
| `MemorySpace`               | Never auto-delete (critical isolation boundary) |
| `Memory`, `Fact`, `Context` | Only delete if explicitly requested             |

#### New Helper Functions

**Node lookup and creation helpers:**

```python
from cortex.graph import (
    find_graph_node_id,        # Find graph node by Cortex ID
    ensure_user_node,          # Ensure User node exists
    ensure_agent_node,         # Ensure Agent node exists
    ensure_participant_node,   # Ensure Participant node exists (Hive Mode)
    ensure_entity_node,        # Ensure Entity node exists
    ensure_enriched_entity_node,  # Ensure enriched Entity node
)

# Find existing node
node_id = await find_graph_node_id("Memory", "mem-123", adapter)

# Ensure nodes exist (creates if not exists)
user_id = await ensure_user_node("user-123", adapter)
agent_id = await ensure_agent_node("agent-456", adapter)
```

#### Enhanced Delete Functions

All delete functions now return `GraphDeleteResult`:

```python
from cortex.graph import (
    delete_memory_from_graph,
    delete_conversation_from_graph,
    delete_fact_from_graph,
    delete_context_from_graph,
    delete_memory_space_from_graph,  # NEW
    delete_immutable_from_graph,     # NEW
    delete_mutable_from_graph,       # NEW
)

result = await delete_memory_from_graph("mem-123", adapter)
print(f"Deleted nodes: {result.deleted_nodes}")
print(f"Deleted edges: {result.deleted_edges}")
```

#### A2A Relationships

Agent-to-Agent communication relationships:

```python
from cortex.graph import sync_a2a_relationships

# Sync A2A relationships for a2a memories
await sync_a2a_relationships(memory, adapter)
```

#### CypherGraphAdapter

Full GraphAdapter implementation for Neo4j and Memgraph:

```python
from cortex.graph.adapters import CypherGraphAdapter
from cortex.types import GraphConnectionConfig

adapter = CypherGraphAdapter()
await adapter.connect(GraphConnectionConfig(
    uri='bolt://localhost:7687',
    username='neo4j',
    password='password'
))

# All GraphAdapter methods supported:
# - connect(), disconnect(), is_connected()
# - create_node(), merge_node(), get_node(), update_node(), delete_node(), find_nodes()
# - create_edge(), delete_edge(), find_edges()
# - query(), traverse(), find_path()
# - batch_write()
# - count_nodes(), count_edges(), clear_database()
```

#### Batch Sync

Initial graph sync for existing data:

```python
from cortex.graph.batch_sync import initial_graph_sync
from cortex.types import BatchSyncOptions, BatchSyncLimits

result = await initial_graph_sync(cortex, adapter, BatchSyncOptions(
    limits=BatchSyncLimits(memories=10000, facts=10000),
    sync_relationships=True,
    on_progress=lambda entity, current, total: print(f"{entity}: {current}/{total}")
))

print(f"Synced {result.memories.synced} memories")
print(f"Synced {result.facts.synced} facts")
print(f"Duration: {result.duration}ms")
```

#### Schema Management

Initialize and verify graph database schema:

```python
from cortex.graph.schema import (
    initialize_graph_schema,
    verify_graph_schema,
    drop_graph_schema,
)

# Initialize schema (creates constraints and indexes)
await initialize_graph_schema(adapter)

# Verify schema is correct
result = await verify_graph_schema(adapter)
if not result.valid:
    print(f"Missing: {result.missing}")

# Drop schema (for testing/reset)
await drop_graph_schema(adapter)
```

#### GraphSyncWorker

Real-time reactive worker for continuous sync:

```python
from cortex.graph.worker import GraphSyncWorker
from cortex.types import GraphSyncWorkerOptions

worker = GraphSyncWorker(cortex, adapter, GraphSyncWorkerOptions(
    batch_size=100,
    retry_attempts=3,
    verbose=True
))

# Set callbacks
worker.on_success(lambda entity_type, entity_id: print(f"Synced: {entity_type}/{entity_id}"))
worker.on_error(lambda entity_id, error: print(f"Failed: {entity_id}: {error}"))

# Start worker
await worker.start()

# Check health
metrics = worker.get_health()
print(f"Processed: {metrics.total_processed}, Queue: {metrics.queue_size}")

# Stop worker
await worker.stop()
```

#### Backward Compatibility

✅ **Zero Breaking Changes**

- Existing sync functions continue to work
- Delete functions now return `GraphDeleteResult` (supports attribute access)
- All new features are additive

---

## [0.20.0] - 2025-12-06

### 🛡️ Complete Resilience Layer API Coverage

**All Python SDK API modules now route through the resilience layer for overload protection. Rate limiting, circuit breaking, and priority queuing are automatically applied to every backend call. Full TypeScript SDK parity.**

#### ✨ Enhanced Features

**1. Comprehensive API Coverage**

All API modules now use `_execute_with_resilience()` for backend calls:

| Module             | Calls Wrapped |
| ------------------ | ------------- |
| `FactsAPI`         | 12 operations |
| `MemorySpacesAPI`  | 11 operations |
| `ImmutableAPI`     | 11 operations |
| `MutableAPI`       | 10 operations |
| `MemoryAPI`        | 7 operations  |
| `ConversationsAPI` | 12 operations |
| `ContextsAPI`      | 11 operations |
| `VectorAPI`        | 10 operations |
| `UsersAPI`         | 5 operations  |
| `AgentsAPI`        | 5 operations  |
| `A2AAPI`           | 4 operations  |

**2. Streaming Handler Support**

Resilience layer now flows through to streaming components:

```python
from cortex.memory.streaming import ProgressiveStorageHandler, StreamErrorRecovery

# Handlers now accept optional resilience parameter
handler = ProgressiveStorageHandler(
    client=client,
    resilience=resilience_layer,  # NEW: optional resilience
    ...
)

recovery = StreamErrorRecovery(
    client=client,
    resilience=resilience_layer,  # NEW: optional resilience
)
```

**3. Consistent Lambda Pattern**

All wrapped calls use a consistent pattern:

```python
result = await self._execute_with_resilience(
    lambda: self.client.mutation("api:operation", {...}),
    "api:operation",  # Operation name for priority/metrics
)
```

#### 🧪 Test Coverage

New `TestAPIResilienceIntegration` test class verifies:

- API calls flow through resilience layer when configured
- APIs work gracefully without resilience (fallback to direct calls)
- Correct operation names are passed for priority classification
- Errors propagate correctly through resilience layer
- Streaming handlers support resilience parameter

#### 🔧 Technical Details

- **Cascade deletion excluded**: `_execute_deletion` and `_rollback_deletion` methods intentionally bypass resilience for strict transactional integrity
- **Backward compatible**: APIs work identically when `resilience=None`
- **Zero config change**: Existing `CortexConfig.resilience` enables protection across all APIs

---

## [0.19.1] - 2025-12-03

### 🛡️ Idempotent Graph Sync Operations

**Graph sync operations now use MERGE instead of CREATE for resilient, idempotent operations. Full TypeScript SDK parity. Re-running scripts or handling race conditions no longer causes constraint violation errors.**

#### ✨ New Features

**1. `merge_node()` Method**

New method on `GraphAdapter` protocol that uses Cypher `MERGE` semantics:

- Creates node if not exists
- Matches existing node if it does
- Updates properties on match
- Safe for concurrent operations

```python
# Idempotent - safe to call multiple times
node_id = await adapter.merge_node(
    GraphNode(
        label="MemorySpace",
        properties={"memorySpaceId": "space-123", "name": "Main"}
    ),
    {"memorySpaceId": "space-123"}  # Match properties
)
```

**2. All Sync Utilities Now Idempotent**

Updated sync functions to use `merge_node()`:

- `sync_memory_space_to_graph()`
- `sync_context_to_graph()`
- `sync_conversation_to_graph()`
- `sync_memory_to_graph()`
- `sync_fact_to_graph()`

#### 🔧 Technical Details

- Graph operations no longer fail with "Node already exists" errors
- Scripts can be safely re-run without clearing Neo4j/Memgraph
- Race conditions in parallel memory creation are handled gracefully
- Existing data is updated rather than causing conflicts

---

## [0.19.0] - 2025-12-03

### 🔗 Automatic Graph Database Configuration

**Zero-configuration graph database integration via environment variables. Just set `CORTEX_GRAPH_SYNC=true` and connection credentials for automatic graph sync during `remember()` calls. Full TypeScript SDK parity.**

#### ✨ New Features

**1. Automatic Graph Configuration**

Enable with two environment variables:

```bash
# Gate 1: Connection credentials (Neo4j OR Memgraph)
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=password

# OR
MEMGRAPH_URI=bolt://localhost:7688
MEMGRAPH_USERNAME=memgraph
MEMGRAPH_PASSWORD=password

# Gate 2: Explicit opt-in
CORTEX_GRAPH_SYNC=true
```

Graph is now automatically configured with `Cortex.create()`:

```python
import os
from cortex import Cortex
from cortex.types import CortexConfig

# With env vars: CORTEX_GRAPH_SYNC=true, NEO4J_URI=bolt://localhost:7687
cortex = await Cortex.create(CortexConfig(convex_url=os.getenv("CONVEX_URL")))
# Graph is automatically connected and sync worker started
```

**2. Factory Pattern for Async Configuration**

New `Cortex.create()` classmethod that enables async auto-configuration:

```python
# Factory method - enables graph auto-config
cortex = await Cortex.create(CortexConfig(convex_url="..."))

# Constructor still works (backward compatible, no graph auto-config)
cortex = Cortex(CortexConfig(convex_url="..."))
```

**3. Priority Handling**

- Explicit `CortexConfig.graph` always takes priority over env vars
- If both `NEO4J_URI` and `MEMGRAPH_URI` are set, Neo4j is used with a warning
- Auto-sync worker is automatically started when auto-configured

#### 🛡️ Safety Features

- **Two-gate opt-in**: Requires both connection credentials AND `CORTEX_GRAPH_SYNC=true`
- **Graceful error handling**: Connection failures log error and return None
- **Backward compatible**: Existing `Cortex()` usage unchanged

---

## [0.18.0] - 2025-12-03

### 🤖 Automatic LLM Fact Extraction

**Zero-configuration fact extraction from conversations using OpenAI or Anthropic. Just set environment variables and facts are automatically extracted during `remember()` calls. Full TypeScript SDK parity.**

#### ✨ New Features

**1. Automatic Fact Extraction**

Enable with two environment variables:

```bash
# Gate 1: API key (OpenAI or Anthropic)
OPENAI_API_KEY=sk-...
# or
ANTHROPIC_API_KEY=sk-ant-...

# Gate 2: Explicit opt-in
CORTEX_FACT_EXTRACTION=true

# Optional: Custom model
CORTEX_FACT_EXTRACTION_MODEL=gpt-4o
```

Facts are now automatically extracted during `remember()`:

```python
from cortex import Cortex
from cortex.types import CortexConfig, RememberParams

cortex = Cortex(CortexConfig(convex_url=os.getenv("CONVEX_URL")))

result = await cortex.memory.remember(
    RememberParams(
        memory_space_id="my-space",
        conversation_id="conv-123",
        user_message="I prefer TypeScript for backend development",
        agent_response="Great choice!",
        user_id="user-123",
        agent_id="assistant-v1",
    )
)

# Automatically extracts and stores:
# ExtractedFact(fact="User prefers TypeScript for backend", fact_type="preference", confidence=0.95)
```

**2. LLM Client Module**

New `cortex/llm/__init__.py` module with:

- `LLMClient` abstract base class
- `OpenAIClient` - Uses OpenAI's JSON mode for reliable extraction
- `AnthropicClient` - Uses Claude's structured output
- `create_llm_client(config)` factory function
- Graceful fallback if SDK not installed

**3. Optional Dependencies**

LLM SDKs are now optional dependencies:

```bash
# Install with LLM support
pip install cortex-memory[llm]      # Both OpenAI and Anthropic
pip install cortex-memory[openai]   # OpenAI only
pip install cortex-memory[anthropic] # Anthropic only
```

#### 🔧 Configuration

**Explicit Config (overrides env vars):**

```python
from cortex.types import CortexConfig, LLMConfig

cortex = Cortex(
    CortexConfig(
        convex_url="...",
        llm=LLMConfig(
            provider="openai",
            api_key="sk-...",
            model="gpt-4o",
            temperature=0.1,
            max_tokens=1000,
        ),
    )
)
```

**Custom Extractor:**

```python
async def custom_extractor(user_msg: str, agent_msg: str):
    # Your custom extraction logic
    return [{"fact": "...", "factType": "preference", "confidence": 0.9}]

cortex = Cortex(
    CortexConfig(
        convex_url="...",
        llm=LLMConfig(
            provider="custom",
            api_key="unused",
            extract_facts=custom_extractor,
        ),
    )
)
```

#### 🛡️ Safety Features

- **Two-gate opt-in**: Requires both API key AND `CORTEX_FACT_EXTRACTION=true`
- **Graceful degradation**: Missing SDK logs warning, doesn't break `remember()`
- **Explicit override**: `CortexConfig.llm` always takes priority over env vars

---

## [0.17.0] - 2025-12-03

### 🔄 Memory Orchestration - Enhanced Owner Attribution & skipLayers Support

**Complete overhaul of memory orchestration to enforce proper user-agent conversation modeling and add explicit layer control. User-agent conversations now require both `user_id` and `agent_id`, and all layers can be explicitly skipped via `skip_layers`. Full TypeScript SDK parity achieved.**

#### ✨ New Features

**1. Mandatory Agent Attribution for User Conversations**

When a `user_id` is provided, `agent_id` is now required:

```python
from cortex import Cortex
from cortex.types import RememberParams

cortex = Cortex(CortexConfig(convex_url=os.getenv("CONVEX_URL")))

# ✅ Correct - both user and agent specified
result = await cortex.memory.remember(
    RememberParams(
        memory_space_id="my-space",
        conversation_id="conv-123",
        user_message="Hello!",
        agent_response="Hi there!",
        user_id="user-123",
        user_name="Alice",
        agent_id="assistant-v1",  # Now required for user-agent conversations
    )
)

# ✅ Correct - agent-only (no user)
result = await cortex.memory.remember(
    RememberParams(
        memory_space_id="my-space",
        conversation_id="conv-456",
        user_message="System task",
        agent_response="Completed",
        agent_id="worker-agent",
    )
)

# ❌ Error - user without agent
result = await cortex.memory.remember(
    RememberParams(
        user_id="user-123",
        user_name="Alice",
        # Missing agent_id - will throw!
    )
)
```

**2. Agent ID Support Across All Layers**

- **Conversations**: `participants.agent_id` field added
- **Memories**: `agent_id` field for agent-owned memories
- **Indexes**: Optimized queries by agent_id

#### 📊 Type Updates

| Type                       | Field Added | Purpose                                         |
| -------------------------- | ----------- | ----------------------------------------------- |
| `MemoryEntry`              | `agent_id`  | Agent-owned memory attribution                  |
| `StoreMemoryInput`         | `agent_id`  | Pass agent ownership to store                   |
| `ConversationParticipants` | `agent_id`  | Agent participant tracking                      |
| `RememberParams`           | `agent_id`  | Required for user-agent conversations           |
| `RememberStreamParams`     | `agent_id`  | Required for streaming user-agent conversations |

#### 🔧 Validation Rules

| Scenario                 | Required Fields                      |
| ------------------------ | ------------------------------------ |
| User-agent conversation  | `user_id` + `user_name` + `agent_id` |
| Agent-only (system/tool) | `agent_id` only                      |

#### ⚠️ Breaking Changes

- `cortex.memory.remember()` now throws if `user_id` is provided without `agent_id`
- `user_id` and `user_name` are now optional (were required in 0.16.x)
- Error: `"agent_id is required when user_id is provided. User-agent conversations require both a user and an agent participant."`

#### Migration

Update existing `remember()` calls to include `agent_id`:

```python
# Before (v0.16.x)
await cortex.memory.remember(
    RememberParams(
        user_id="user-123",
        user_name="Alice",
        # ... other params
    )
)

# After (v0.17.0)
await cortex.memory.remember(
    RememberParams(
        user_id="user-123",
        user_name="Alice",
        agent_id="your-agent-id",  # Add this
        # ... other params
    )
)
```

### 🎛️ skipLayers - Explicit Layer Control

**Control which layers execute during memory orchestration with the new `skip_layers` parameter.**

#### ✨ New Features

**1. Skippable Layer Type**

New `SkippableLayer` type defines which layers can be explicitly skipped:

```python
from cortex.types import SkippableLayer

# Valid layers to skip:
# - 'users': Don't auto-create user profile
# - 'agents': Don't auto-register agent
# - 'conversations': Don't store in ACID conversations
# - 'vector': Don't store in vector index
# - 'facts': Don't extract/store facts
# - 'graph': Don't sync to graph database
```

**2. skip_layers Parameter**

Control orchestration behavior on a per-call basis:

```python
# ✅ Skip specific layers
result = await cortex.memory.remember(
    RememberParams(
        memory_space_id="my-space",
        conversation_id="conv-456",
        user_message="Quick question",
        agent_response="Quick answer",
        agent_id="assistant-v1",
        skip_layers=["facts", "graph"],  # Only skip facts & graph
    )
)

# ✅ Vector-only storage (agent memories)
result = await cortex.memory.remember(
    RememberParams(
        memory_space_id="my-space",
        conversation_id="agent-memory-1",
        user_message="Internal processing note",
        agent_response="Processed",
        agent_id="worker-agent",
        skip_layers=["conversations", "users"],  # Vector-only
    )
)
```

**3. Auto-Registration Helpers**

New internal helper methods for automatic entity registration:

- `_ensure_user_exists()`: Auto-creates user profile if not exists
- `_ensure_agent_exists()`: Auto-registers agent if not exists
- `_ensure_memory_space_exists()`: Auto-registers memory space if not exists
- `_should_skip_layer()`: Checks if a layer should be skipped
- `_get_fact_extractor()`: Gets fact extractor with fallback chain

#### 📋 Default Behavior

All layers are **enabled by default**. Use `skip_layers` to explicitly opt-out:

| Layer           | Default               | Skippable                          |
| --------------- | --------------------- | ---------------------------------- |
| `memorySpace`   | Always runs           | ❌ Cannot skip                     |
| `users`         | Auto-create           | ✅ `skip_layers=['users']`         |
| `agents`        | Auto-register         | ✅ `skip_layers=['agents']`        |
| `conversations` | Store in ACID         | ✅ `skip_layers=['conversations']` |
| `vector`        | Index for search      | ✅ `skip_layers=['vector']`        |
| `facts`         | Extract if configured | ✅ `skip_layers=['facts']`         |
| `graph`         | Sync if adapter       | ✅ `skip_layers=['graph']`         |

#### 🔄 TypeScript SDK Parity

| Feature               | TypeScript | Python                         |
| --------------------- | ---------- | ------------------------------ |
| `skipLayers` param    | ✅         | ✅ (as `skip_layers`)          |
| `SkippableLayer` type | ✅         | ✅                             |
| `shouldSkipLayer()`   | ✅         | ✅ (as `_should_skip_layer()`) |
| Layer conditionals    | ✅         | ✅                             |
| Auto-registration     | ✅         | ✅                             |

---

## [0.16.0] - 2025-12-01

### 🛡️ Resilience Layer - Production-Ready Overload Protection

**Complete implementation of a 4-layer resilience system protecting against server overload during extreme traffic bursts.**

#### ✨ New Features

**1. Token Bucket Rate Limiter**

Smooths out bursty traffic into a sustainable flow:

```python
from cortex import Cortex, CortexConfig
from cortex.resilience import ResilienceConfig, RateLimiterConfig

cortex = Cortex(CortexConfig(
    convex_url=os.getenv("CONVEX_URL"),
    resilience=ResilienceConfig(
        rate_limiter=RateLimiterConfig(
            bucket_size=200,     # Allow bursts up to 200
            refill_rate=100,     # Sustain 100 ops/sec
        )
    )
))
```

**2. Concurrency Limiter (Semaphore)**

Controls the number of concurrent in-flight requests:

```python
resilience=ResilienceConfig(
    concurrency=ConcurrencyConfig(
        max_concurrent=20,    # Max 20 parallel requests
        queue_size=1000,      # Queue up to 1000 pending
        timeout=30.0,         # 30s timeout for queued requests
    )
)
```

**3. Priority Queue**

In-memory queue that prioritizes critical operations:

| Priority     | Examples                         | Behavior               |
| ------------ | -------------------------------- | ---------------------- |
| `critical`   | `users:delete`                   | Bypass circuit breaker |
| `high`       | `memory:remember`, `facts:store` | Priority processing    |
| `normal`     | Most operations                  | Standard queue         |
| `low`        | `memory:search`, `vector:search` | Deferrable             |
| `background` | `governance:simulate`            | Lowest priority        |

Priorities are **automatically assigned** based on operation name patterns.

**4. Circuit Breaker**

Prevents cascading failures by failing fast when backend is unhealthy:

```python
resilience=ResilienceConfig(
    circuit_breaker=CircuitBreakerConfig(
        failure_threshold=5,   # Open after 5 failures
        success_threshold=2,   # Close after 2 successes
        timeout=30.0,          # 30s before half-open retry
    ),
    on_circuit_open=lambda failures: print(f"Circuit opened after {failures} failures")
)
```

**5. Resilience Presets**

Pre-configured presets for common use cases:

```python
from cortex.resilience import ResiliencePresets

# Default - balanced for most use cases
Cortex(CortexConfig(convex_url=url, resilience=ResiliencePresets.default))

# Real-time agent - low latency, smaller buffers
Cortex(CortexConfig(convex_url=url, resilience=ResiliencePresets.real_time_agent))

# Batch processing - large queues, patient retries
Cortex(CortexConfig(convex_url=url, resilience=ResiliencePresets.batch_processing))

# Hive mode - many agents, conservative limits
Cortex(CortexConfig(convex_url=url, resilience=ResiliencePresets.hive_mode))

# Disabled - bypass all protection (not recommended)
Cortex(CortexConfig(convex_url=url, resilience=ResiliencePresets.disabled))
```

**6. Metrics & Monitoring**

```python
metrics = cortex.get_resilience_metrics()

print(f"Rate limiter: {metrics.rate_limiter.available}/{metrics.rate_limiter.bucket_size} tokens")
print(f"Concurrency: {metrics.concurrency.active}/{metrics.concurrency.max} active")
print(f"Queue: {metrics.queue.size} pending")
print(f"Circuit: {metrics.circuit_breaker.state} ({metrics.circuit_breaker.failures} failures)")

# Health check
is_healthy = cortex.is_healthy()  # False if circuit is open
```

**7. Graceful Shutdown**

```python
# Wait for pending operations to complete
await cortex.shutdown(timeout_s=30.0)

# Or immediate close
await cortex.close()
```

#### 📦 New Modules

**Python (`cortex/resilience/`):**

- `types.py` - Configuration dataclasses and exceptions
- `token_bucket.py` - Token bucket rate limiter
- `semaphore.py` - Async semaphore with queue
- `priorities.py` - Operation priority mapping
- `priority_queue.py` - Priority-based request queue
- `circuit_breaker.py` - Circuit breaker pattern
- `__init__.py` - ResilienceLayer orchestrator and presets

#### 🧪 Testing

- **40 new Python tests** covering all resilience components
- All existing tests now run through resilience layer by default
- Integration tests validate end-to-end protection

#### 📚 New Types

```python
from typing import Literal
from dataclasses import dataclass

Priority = Literal["critical", "high", "normal", "low", "background"]

@dataclass
class ResilienceConfig:
    enabled: bool = True
    rate_limiter: Optional[RateLimiterConfig] = None
    concurrency: Optional[ConcurrencyConfig] = None
    circuit_breaker: Optional[CircuitBreakerConfig] = None
    queue: Optional[QueueConfig] = None
    on_circuit_open: Optional[Callable[[int], None]] = None
    on_circuit_close: Optional[Callable[[], None]] = None
    on_queue_full: Optional[Callable[[Priority], None]] = None

@dataclass
class ResilienceMetrics:
    rate_limiter: RateLimiterMetrics
    concurrency: ConcurrencyMetrics
    queue: QueueMetrics
    circuit_breaker: CircuitBreakerMetrics

# Custom exceptions
class CircuitOpenError(Exception): ...
class QueueFullError(Exception): ...
class AcquireTimeoutError(Exception): ...
class RateLimitExceededError(Exception): ...
```

#### 🔄 Backward Compatibility

✅ **Zero Breaking Changes**

- Resilience is **enabled by default** with balanced settings
- All existing code works without modification
- Pass `resilience=ResilienceConfig(enabled=False)` to disable
- Existing tests automatically run through resilience layer

#### 🎯 Production Benefits

- **Burst Protection**: Handle 10x traffic spikes gracefully
- **Cascade Prevention**: Circuit breaker isolates failures
- **Priority Handling**: Critical ops (deletes) bypass queue
- **Graceful Degradation**: Low-priority ops queue during overload
- **Zero Config**: Works out of the box with sensible defaults
- **Full Observability**: Metrics for dashboards and alerting

---

## [0.15.1] - 2025-11-29

### 🔍 Semantic Search Quality - Agent Acknowledgment Filtering

**Fixes an edge case where agent acknowledgments like "I've noted your email address" could outrank user facts in semantic search due to word overlap (e.g., "address" matching both contexts).**

#### 🐛 Bug Fixes

**1. Agent Acknowledgment Noise Filtering**

Agent responses that are pure acknowledgments (no meaningful facts) are now filtered from vector storage:

- ✅ **ACID storage preserved** - Full conversation history maintained
- ✅ **Vector storage filtered** - Acknowledgments don't pollute semantic search
- ✅ **Automatic detection** - Patterns like "Got it!", "I've noted", "I'll remember" are identified

```python
# Before: Both stored in vector (agent response pollutes search)
await cortex.memory.remember(
    RememberParams(
        user_message="My name is Alex",
        agent_response="Got it!",  # Would appear in semantic search
        ...
    )
)

# After: Only user fact stored in vector
# "Got it!" still in ACID for conversation history
# But won't appear when searching "what to call the user"
```

**2. Role-Based Search Weighting**

- User messages receive 25% boost in semantic search scoring
- Detected acknowledgments receive 50% penalty (defense-in-depth)
- `message_role` field tracks source for intelligent ranking

#### 🎯 Impact

Queries like "what should I address the user as" now reliably return user facts ("My name is Alex") instead of agent acknowledgments ("I've noted your email address") that happen to contain semantically similar words.

---

## [0.15.0] - 2025-11-30

### 🎯 Enriched Fact Extraction - Bullet-Proof Semantic Search

**Comprehensive enhancement to fact extraction and retrieval, ensuring extracted facts always rank #1 in semantic search through rich metadata, search aliases, and category-based boosting.**

#### ✨ New Features

**1. Enriched Fact Extraction System**

Facts can now store rich metadata optimized for retrieval:

- **`category`** - Specific sub-category for filtering (e.g., "addressing_preference")
- **`search_aliases`** - Array of alternative search terms that should match this fact
- **`semantic_context`** - Usage context sentence explaining when/how to use this information
- **`entities`** - Array of extracted entities with name, type, and optional full_value
- **`relations`** - Array of subject-predicate-object triples for graph integration

```python
await cortex.facts.store(
    StoreFactParams(
        memory_space_id="agent-1",
        fact="User prefers to be called Alex",
        fact_type="identity",
        confidence=95,
        source_type="conversation",

        # Enrichment fields (NEW)
        category="addressing_preference",
        search_aliases=["name", "nickname", "what to call", "address as", "greet"],
        semantic_context="Use 'Alex' when addressing, greeting, or referring to this user",
        entities=[
            EnrichedEntity(name="Alex", type="preferred_name", full_value="Alexander Johnson"),
        ],
        relations=[
            EnrichedRelation(subject="user", predicate="prefers_to_be_called", object="Alex"),
        ],
    )
)
```

**2. Enhanced Search Boosting**

Vector memory search now applies intelligent boosting:

| Condition                                                 | Boost |
| --------------------------------------------------------- | ----- |
| User message role (`message_role="user"`)                 | +20%  |
| Matching `fact_category` (when `query_category` provided) | +30%  |
| Has `enriched_content` field                              | +10%  |

```python
# Search with category boosting
results = await cortex.memory.search(
    memory_space_id,
    query,
    SearchOptions(
        embedding=await generate_embedding(query),
        query_category="addressing_preference",  # Boost matching facts
    )
)
```

**3. Enriched Content for Vector Indexing**

New `enriched_content` field on memories concatenates all searchable content for embedding.

**4. Enhanced Graph Synchronization**

Graph sync now creates richer entity nodes and relationship edges from enriched facts:

- **Entity nodes** include `entity_type` and `full_value` properties
- **Relations** create typed edges (e.g., `PREFERS_TO_BE_CALLED`)
- **MENTIONS edges** link facts to extracted entities with role metadata

**5. New Types (Python)**

```python
@dataclass
class EnrichedEntity:
    """Entity extracted from enriched fact extraction."""
    name: str
    type: str
    full_value: Optional[str] = None


@dataclass
class EnrichedRelation:
    """Relation extracted from enriched fact extraction."""
    subject: str
    predicate: str
    object: str
```

Updated dataclasses:

- `StoreFactParams` - Added `category`, `search_aliases`, `semantic_context`, `entities`, `relations`
- `FactRecord` - Added same enrichment fields
- `StoreMemoryInput` - Added `enriched_content`, `fact_category`
- `MemoryEntry` - Added `enriched_content`, `fact_category`

#### 📊 Schema Changes

**Facts Table (Layer 3):**

- `category` - Specific sub-category
- `searchAliases` - Alternative search terms
- `semanticContext` - Usage context
- `entities` - Extracted entities with types
- `relations` - Relationship triples for graph

**Memories Table (Layer 2):**

- `enrichedContent` - Concatenated searchable content
- `factCategory` - Category for boosting
- `factsRef` - Reference to Layer 3 fact

#### 🧪 Testing

- Enhanced semantic search tests with strict top-1 validation
- Validates bullet-proof retrieval: correct result must be #1

#### 📚 Documentation

- Updated Facts Operations API with enrichment fields and examples
- Updated Memory Operations API with query_category and enriched_content
- New "Enriched Fact Extraction" section explaining the system architecture

#### 🔄 Backward Compatibility

✅ **Zero Breaking Changes**

- All enrichment fields are optional
- Existing code works without modifications
- No data migration required

---

## [0.14.0] - 2025-11-29

### 🤖 A2A (Agent-to-Agent) Communication API

**Full implementation of the A2A Communication API, enabling seamless inter-agent communication with ACID guarantees and bidirectional memory storage.**

#### ✨ New Features

**1. A2A API Methods**

Four new methods for agent-to-agent communication:

- **`send()`** - Fire-and-forget message between agents (no pub/sub required)
- **`request()`** - Synchronous request-response pattern (requires pub/sub infrastructure)
- **`broadcast()`** - One-to-many communication to multiple agents
- **`get_conversation()`** - Retrieve conversation history with rich filtering

**2. Bidirectional Memory Storage**

Each A2A message automatically creates:

- Memory in sender's space (direction: "outbound")
- Memory in receiver's space (direction: "inbound")
- ACID conversation tracking (optional, enabled by default)

```python
from cortex import Cortex, CortexConfig, A2ASendParams

cortex = Cortex(CortexConfig(convex_url="..."))

result = await cortex.a2a.send(
    A2ASendParams(
        from_agent="sales-agent",
        to_agent="support-agent",
        message="Customer asking about enterprise pricing",
        importance=70
    )
)
print(f"Message {result.message_id} sent")
```

**3. Client-Side Validation**

Comprehensive validation for all A2A operations:

- Agent ID format validation
- Message content and size limits (100KB max)
- Importance range (0-100)
- Timeout and retry configuration
- Recipients array validation for broadcasts
- Conversation filter validation

```python
from cortex import A2AValidationError

try:
    await cortex.a2a.send(params)
except A2AValidationError as e:
    print(f"Validation failed: {e.code} - {e.field}")
```

**4. Type Updates**

- Added `metadata: Optional[Dict[str, Any]]` field to `MemoryEntry` for A2A-specific data
- New types: `A2ASendParams`, `A2AMessage`, `A2ARequestParams`, `A2AResponse`, `A2ABroadcastParams`, `A2ABroadcastResult`

#### 🧪 Testing

- 50 new A2A tests covering core operations, validation, integration, and edge cases
- All tests passing against local and cloud Convex deployments

#### 🔄 Migration Guide

**No migration required** - This is a non-breaking addition.

To use A2A, simply access `cortex.a2a`:

```python
cortex = Cortex(CortexConfig(convex_url="..."))
await cortex.a2a.send(A2ASendParams(from_agent="agent-1", to_agent="agent-2", message="Hello"))
```

---

## [0.12.0] - 2025-11-25

### 🎯 Client-Side Validation - All APIs

**Comprehensive client-side validation added to all 11 APIs to catch errors before backend calls, providing faster feedback (<1ms vs 50-200ms) and better developer experience.**

#### ✨ New Features

**1. Client-Side Validation Framework**

All 11 APIs now validate inputs before making backend calls:

- **Governance API** - Policy structure, period formats, importance ranges, version counts, scopes, date ranges
- **Memory API** - Memory space IDs, content validation, importance scores, source types, conversation/immutable/mutable refs
- **Conversations API** - Conversation types, participant validation, message validation, query filters
- **Facts API** - Fact types, confidence scores, subject/predicate/object, temporal validity
- **Immutable API** - Type/ID validation, version numbers, data size limits
- **Mutable API** - Namespace/key validation, value size limits, TTL formats
- **Agents API** - Agent ID format, metadata validation, status values
- **Users API** - User ID validation, profile data structure
- **Contexts API** - Context purpose, status transitions, parent-child relationships
- **Memory Spaces API** - Space type validation, participant structure
- **Vector API** - Memory space IDs, embeddings dimensions, importance ranges

**2. Custom Validation Error Classes**

Each API has a dedicated validation error class for precise error handling:

```python
from cortex.governance import GovernanceValidationError

try:
    await cortex.governance.set_policy(policy)
except GovernanceValidationError as e:
    print(f"Validation failed: {e.code} - {e.field}")
```

**3. Validation Benefits**

- ⚡ **Faster Feedback**: Errors caught in <1ms (vs 50-200ms backend round-trip)
- 📝 **Better Error Messages**: Clear descriptions with fix suggestions and field names
- 🔒 **Defense in Depth**: Client validation + backend validation for security
- 🧪 **Complete Test Coverage**: 180+ validation tests
- 💰 **Reduced Backend Load**: Invalid requests never reach Convex
- 🎯 **Improved DX**: Developers get immediate feedback

**4. Python-Specific Considerations**

- Accepts both `int` and `float` for numeric fields (JSON deserialization)
- Proper `isinstance()` type guards for validation
- Pythonic error messages with f-strings
- Integration with existing `CortexError` hierarchy

#### 🧪 Testing

- 180+ new validation tests
- All tests passing (35 governance, 145 across other APIs)
- Zero breaking changes to public API

#### 🔄 Migration Guide

**No migration required** - This is a non-breaking enhancement. All existing code continues to work, but now gets faster error feedback.

Optional: Catch validation errors specifically for better error handling:

```python
from cortex.memory import MemoryValidationError

try:
    await cortex.memory.remember(params)
except MemoryValidationError as e:
    # Handle validation errors (instant, client-side)
    print(f"Validation error: {e.code} in field {e.field}")
except Exception as e:
    # Handle backend errors (database, network)
    print(f"Backend error: {e}")
```

---

## [0.11.0] - 2025-11-23

### 🎉 Major Release - Enhanced Streaming API & Cross-Database Graph Support

**Complete streaming orchestration with progressive storage, real-time fact extraction, error recovery, adaptive processing, comprehensive test suite, and production-ready graph database compatibility for both Neo4j and Memgraph.**

**Highlights**:

- 🚀 8 new streaming component modules (2,137 lines)
- 🔧 Graph adapter fixes for Neo4j + Memgraph compatibility (150 lines)
- ✅ 70+ tests with actual data validation (3,363 lines)
- 📦 100% feature parity with TypeScript SDK v0.11.0
- 🎯 Production-ready with complete test coverage

#### ✨ New Features - Part 1: Streaming API

**1. Enhanced `remember_stream()` API**

The `remember_stream()` method has been completely refactored from a simple wrapper into a full streaming orchestration system with:

- **Progressive Storage**: Store partial responses during streaming with automatic rollback on failure
- **Real-time Fact Extraction**: Extract facts incrementally as content arrives with deduplication
- **Streaming Hooks**: Monitor stream progress with `onChunk`, `onProgress`, `onError`, and `onComplete` callbacks
- **Error Recovery**: Multiple recovery strategies (store-partial, rollback, retry, best-effort)
- **Resume Capability**: Generate resume tokens for interrupted streams
- **Adaptive Processing**: Automatically adjust processing based on stream characteristics (fast/slow/bursty/steady)
- **Automatic Chunking**: Break very long responses into manageable chunks
- **Progressive Graph Sync**: Real-time graph database synchronization during streaming
- **Performance Metrics**: Comprehensive metrics including throughput, latency, cost estimates, and bottleneck detection

**2. New Streaming Components** - 8 Core Modules

All located in `cortex/memory/streaming/`:

1. **`stream_metrics.py`** (232 lines) - `MetricsCollector` class
   - Real-time performance tracking (timing, throughput, costs)
   - Chunk statistics (min, max, median, std dev)
   - Stream type detection (fast/slow/bursty/steady)
   - Bottleneck detection and recommendations
   - Cost estimation based on token counts

2. **`stream_processor.py`** (174 lines) - `StreamProcessor` core engine
   - AsyncIterable stream consumption
   - Hook lifecycle management (onChunk, onProgress, onError, onComplete)
   - Context updates during streaming
   - Metrics integration
   - Safe hook execution (errors don't break stream)

3. **`progressive_storage_handler.py`** (202 lines) - `ProgressiveStorageHandler`
   - Initialize partial memory storage
   - Incremental content updates during streaming
   - Update interval management (time-based)
   - Memory finalization with embeddings
   - Rollback capability for failed streams
   - Update history tracking

4. **`fact_extractor.py`** (278 lines) - `ProgressiveFactExtractor`
   - Incremental fact extraction during streaming
   - Automatic deduplication (prevents duplicate facts)
   - Confidence-based fact updates
   - Final extraction and consolidation
   - Extraction statistics and tracking

5. **`chunking_strategies.py`** (282 lines) - `ResponseChunker`
   - **Token-based**: Split by token count (~1 token = 4 chars)
   - **Sentence-based**: Split at sentence boundaries
   - **Paragraph-based**: Split at paragraph breaks
   - **Fixed-size**: Split by character count with overlap
   - **Semantic**: Placeholder for embedding-based chunking
   - Overlap handling and boundary preservation
   - Infinite loop prevention (validates overlap < max_size)

6. **`error_recovery.py`** (248 lines) - `StreamErrorRecovery`
   - **Store-partial**: Save progress on failure
   - **Rollback**: Clean up partial data
   - **Retry**: Exponential backoff retry logic
   - **Best-effort**: Save what's possible
   - Resume token generation and validation
   - Token expiration and checksum verification

7. **`adaptive_processor.py`** (242 lines) - `AdaptiveStreamProcessor`
   - Real-time stream characteristic analysis
   - Dynamic strategy adjustment (buffer size, update intervals)
   - Stream type detection with variance calculation
   - Chunking and fact extraction recommendations
   - Performance optimization suggestions

8. **`progressive_graph_sync.py`** (151 lines) - `ProgressiveGraphSync`
   - Initialize partial nodes during streaming
   - Incremental node updates (content preview, stats)
   - Node finalization when stream completes
   - Sync event tracking for debugging
   - Rollback support for failed streams
   - Interval-based sync to reduce database load

**3. Enhanced Streaming Types** - Comprehensive Type System

New types in `cortex/memory/streaming_types.py`:

- `StreamingOptions` - 20+ configuration options
- `ChunkEvent`, `ProgressEvent`, `StreamCompleteEvent` - Stream lifecycle events
- `StreamMetrics` - Performance metrics (timing, throughput, processing stats)
- `StreamHooks` - Callback hooks for monitoring
- `ProgressiveFact` - Progressive fact extraction results
- `GraphSyncEvent` - Graph synchronization events
- `StreamError`, `RecoveryOptions`, `RecoveryResult` - Error handling
- `ResumeContext` - Resume capability for interrupted streams
- `ChunkingConfig`, `ContentChunk` - Content chunking
- `ProcessingStrategy` - Adaptive processing strategies
- `EnhancedRememberStreamResult` - Enhanced result with metrics and insights

**4. Enhanced Stream Utilities**

Enhanced `cortex/memory/stream_utils.py` with new utilities:

- `RollingContextWindow` - Keep last N characters in memory
- `AsyncQueue` - Async queue for processing items
- `with_stream_timeout()` - Timeout wrapper for streams
- `with_max_length()` - Length-limited streams
- `buffer_stream()` - Buffer chunks for batch processing

#### 🔧 Breaking Changes

- `remember_stream()` now returns `EnhancedRememberStreamResult` instead of `RememberStreamResult`
- `remember_stream()` options parameter now accepts `StreamingOptions` for advanced features

**5. Cross-Database Graph Compatibility** - Critical Bug Fixes

Enhanced `cortex/graph/adapters/cypher.py` with automatic database detection:

- **Auto-Detection**: Automatically detects Neo4j vs Memgraph on connection
- **ID Handling**: Neo4j uses `elementId()` returning strings, Memgraph uses `id()` returning integers
- **Smart Conversion**: `_convert_id_for_query()` converts IDs to correct type for each database
- **Universal Operations**: All graph operations work seamlessly on both databases

**Fixed Operations**:

- `create_node()` - Uses correct ID function for each DB
- `update_node()` - Converts IDs before queries
- `delete_node()` - Handles both string and integer IDs
- `create_edge()` - Converts both from/to node IDs
- `delete_edge()` - Proper ID conversion for edge deletion
- `traverse()` - Start ID conversion for multi-hop traversal
- `find_path()` - From/to ID conversion for path finding

**6. Comprehensive Test Suite** - 70+ Tests with Actual Data Validation

Created complete test infrastructure with **actual database validation** (not just "no errors"):

**Unit Tests** (59 tests across 6 files):

- `tests/streaming/test_stream_metrics.py` - 15 tests validating actual metrics, timing, and cost calculations
- `tests/streaming/test_chunking_strategies.py` - 10 tests validating chunk boundaries, overlaps, and strategies
- `tests/streaming/test_progressive_storage.py` - 8 tests validating storage timing and state transitions
- `tests/streaming/test_error_recovery.py` - 9 tests validating resume tokens and recovery strategies
- `tests/streaming/test_adaptive_processor.py` - 9 tests validating stream type detection and strategy selection
- `tests/streaming/test_stream_processor.py` - 8 tests validating chunk processing and hook invocation

**Integration Tests** (14 tests across 2 files):

- `tests/streaming/test_remember_stream_integration.py` - 8 tests validating data across all Cortex layers
  - Validates Convex conversation storage
  - Validates Vector memory storage
  - Validates Graph node/edge creation
  - Validates metrics accuracy
  - Validates progressive features
  - Validates hooks invocation
- `tests/graph/test_comprehensive_data_validation.py` - 6 tests validating graph operations
  - Agent registration → actual node in Neo4j/Memgraph
  - Memory storage → nodes AND edges created
  - Fact storage → nodes with all properties
  - Traverse → returns actual connected nodes

**Manual Validation Scripts** (3 files):

- `tests/streaming/manual_test.py` - End-to-end streaming demo with console output
- `tests/graph/comprehensive_validation.py` - Validates all APIs that sync to graph
- `tests/graph/clear_databases.py` - Database cleanup utility

**Test Infrastructure**:

- `tests/conftest.py` - Shared pytest fixtures and configuration
- `tests/run_streaming_tests.sh` - Automated test runner script
- `tests/README.md` - Complete test documentation (240 lines)
- `tests/streaming/README.md` - Streaming test guide (210 lines)

**Critical Testing Philosophy**:
All tests perform **actual data validation**:

- ✅ Query databases to verify data exists
- ✅ Check node/edge properties match expectations
- ✅ Validate metrics reflect actual processing
- ✅ Confirm relationships between entities
- ❌ No reliance on "it didn't error" testing

#### 🐛 Bug Fixes

- **Fixed**: Stream consumption to properly handle AsyncIterable protocol
- **Fixed**: Memgraph ID type mismatch - now converts string IDs to integers for Memgraph queries
- **Fixed**: Graph operations failing on Memgraph due to elementId() not being supported
- **Fixed**: Traverse operation not working on Memgraph - now uses correct ID function
- **Fixed**: Create/update/delete operations failing with Memgraph integer IDs
- **Improved**: Error handling and recovery in streaming operations
- **Improved**: Database type detection and automatic ID handling

#### 📚 Documentation

- **Updated**: API documentation for `remember_stream()` with comprehensive examples
- **Added**: Inline documentation for all 8 streaming components (extensive docstrings)
- **Added**: Complete type documentation for 25+ streaming types
- **Created**: Test documentation (450+ lines across 2 README files)
- **Created**: Implementation completion summary (IMPLEMENTATION-COMPLETE.md)
- **Created**: Feature parity tracking (PYTHON-SDK-V0.11.0-COMPLETE.md)
- **Updated**: This CHANGELOG with comprehensive v0.11.0 notes

#### 🔄 Migration Guide

**Before (v0.10.0)**:

```python
# Simple streaming
result = await cortex.memory.remember_stream({
    'memorySpaceId': 'agent-1',
    'conversationId': 'conv-123',
    'userMessage': 'Hello',
    'responseStream': stream,
    'userId': 'user-1',
    'userName': 'Alex'
})
# Returns: RememberStreamResult
```

**After (v0.11.0)**:

```python
# Enhanced streaming with full features
result = await cortex.memory.remember_stream({
    'memorySpaceId': 'agent-1',
    'conversationId': 'conv-123',
    'userMessage': 'Hello',
    'responseStream': stream,
    'userId': 'user-1',
    'userName': 'Alex',
    'extractFacts': extract_facts_fn,
}, {
    'storePartialResponse': True,
    'progressiveFactExtraction': True,
    'hooks': {
        'onChunk': lambda e: print(f'Chunk: {e.chunk}'),
        'onProgress': lambda e: print(f'Progress: {e.bytes_processed}'),
    },
    'partialFailureHandling': 'store-partial',
    'enableAdaptiveProcessing': True,
})
# Returns: EnhancedRememberStreamResult with metrics and insights
```

#### 📦 Implementation Completeness

**Streaming API**: ✅ 100% Complete (2,137 lines)

- 8/8 streaming component modules implemented
- Full type system with 25+ types
- Complete parity with TypeScript SDK streaming features
- Enhanced `remember_stream()` orchestration method
- 5 stream utility functions

**Graph Database Support**: ✅ 100% Complete (150 lines of fixes)

- Auto-detection of Neo4j vs Memgraph
- ID function abstraction and conversion
- All 7 graph operations fixed for cross-database compatibility
- Tested on both Neo4j and Memgraph

**Test Coverage**: ✅ 70+ Tests (3,363 lines)

- 59 unit tests across 6 files
- 14 integration tests across 2 files
- 3 manual validation scripts
- Complete test infrastructure (runner, fixtures, docs)
- **All tests validate actual data in databases**

**Total Implementation**:

- **22 files created**
- **4 files modified**
- **~6,500+ lines of code**
- **100% feature parity with TypeScript SDK**

#### 🎯 Production Readiness

This release achieves:

- ✅ Complete streaming feature set
- ✅ Cross-database graph compatibility
- ✅ Comprehensive test coverage with actual data validation
- ✅ Production-quality error handling
- ✅ Performance monitoring and optimization
- ✅ Complete documentation

**The Python SDK is now production-ready with full parity to TypeScript SDK v0.11.0.**

#### 🔗 Related

- Matches TypeScript SDK v0.11.0 streaming features exactly
- Includes graph sync fixes discovered during TypeScript validation
- Uses same testing philosophy: actual data validation, not "no errors"
- See TypeScript CHANGELOG for additional context

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

#### ✨ New Features - Part 2: Missing API Implementation

**Implemented all remaining documented APIs that were missing from the SDK, achieving 100% documentation parity.**

**1. Memory API (`cortex.memory.*`)**

- **NEW:** `restore_from_archive()` - Restore archived memories with facts
  - Removes 'archived' tag
  - Restores importance to reasonable default (50+)
  - Returns restored memory with full metadata
  - Example: `await cortex.memory.restore_from_archive('space-1', 'mem-123')`

**2. Vector API (`cortex.vector.*`)**

- **FIXED:** `search()` now properly forwards `min_score` parameter to backend
  - Previously parameter was accepted but ignored
  - Now correctly filters results by similarity threshold
  - Example: `SearchOptions(min_score=0.7)` filters results with score >= 0.7

**3. Agents API (`cortex.agents.*`)**

- **NEW:** `unregister_many()` - Bulk unregister agents with optional cascade
  - Filter by metadata, status, or specific agent IDs
  - Supports dry run mode for preview
  - Cascade deletion removes all agent data across memory spaces
  - Returns count and list of unregistered agent IDs
  - Example: `await cortex.agents.unregister_many({'status': 'archived'}, UnregisterAgentOptions(cascade=True))`

**4. Contexts API (`cortex.contexts.*`)** - Already Complete!

All 9 documented methods were already implemented in Python SDK:

- ✅ `update_many()` - Bulk update contexts (pre-existing)
- ✅ `delete_many()` - Bulk delete contexts (pre-existing)
- ✅ `export()` - Export to JSON/CSV (pre-existing)
- ✅ `remove_participant()` - Remove participant from context (pre-existing)
- ✅ `get_by_conversation()` - Find contexts by conversation ID (pre-existing)
- ✅ `find_orphaned()` - Find contexts with missing parents (pre-existing)
- ✅ `get_version()` - Get specific version (pre-existing)
- ✅ `get_history()` - Get all versions (pre-existing)
- ✅ `get_at_timestamp()` - Temporal query (pre-existing)

**5. Memory Spaces API (`cortex.memory_spaces.*`)** - Already Complete!

All documented methods were already implemented:

- ✅ `search()` - Text search across name/metadata (pre-existing)
- ✅ `update_participants()` - Combined add/remove participants (pre-existing)

**6. Users API (`cortex.users.*`)** - Already Complete!

All documented methods were already implemented:

- ✅ `get_or_create()` - Get or create with defaults (pre-existing)
- ✅ `merge()` - Deep merge partial updates (pre-existing)

#### 🔧 Backend Changes (Convex)

**Schema Updates:**

- Added versioning fields to `contexts` table:
  - `version: number` - Current version number
  - `previousVersions: array` - Version history with status, data, timestamp, updatedBy

**New Convex Mutations:**

- `contexts:updateMany` - Bulk update contexts with filters
- `contexts:deleteMany` - Bulk delete with optional cascade
- `contexts:removeParticipant` - Remove participant from list
- `memorySpaces:updateParticipants` - Combined add/remove participants
- `memories:restoreFromArchive` - Restore archived memory
- `agents:unregisterMany` - Bulk unregister agents

**New Convex Queries:**

- `contexts:exportContexts` - Export contexts to JSON/CSV
- `contexts:getByConversation` - Find contexts by conversation ID
- `contexts:findOrphaned` - Find orphaned contexts
- `contexts:getVersion` - Get specific version
- `contexts:getHistory` - Get all versions
- `contexts:getAtTimestamp` - Temporal query
- `memorySpaces:search` - Text search across spaces

**Enhanced Convex Queries:**

- `memories:search` - Now accepts `minScore` parameter for similarity filtering
- `contexts:create` - Now initializes version=1 and previousVersions=[]
- `contexts:update` - Now creates version snapshots

#### 🧪 Testing

**New Tests:**

- `tests/test_memory.py` - Added 2 tests for `restore_from_archive()`
  - Test successful restoration from archive
  - Test error when restoring non-archived memory
- `tests/test_agents.py` - Added 2 tests for `unregister_many()`
  - Test bulk unregister without cascade
  - Test dry run mode

**All Tests Passing:**

- ✅ Ruff linter: All checks passed (cortex/ directory)
- ✅ Mypy type checker: Success (28 source files)
- ✅ New API tests: All passing
- ✅ Integration tests: All passing

#### 📊 Completeness Status

**Python SDK vs Documentation:**

- ✅ **100% Documentation Parity Achieved**
- ✅ All 17 missing documented APIs now implemented
- ✅ Backend functions deployed and operational
- ✅ Comprehensive test coverage added
- ✅ Type safety verified with mypy

**API Count by Module:**

- Users API: 11/11 methods ✅ (2 were already implemented)
- Contexts API: 17/17 methods ✅ (9 were already implemented)
- Memory Spaces API: 9/9 methods ✅ (2 were already implemented)
- Memory API: 14/14 methods ✅ (1 newly added)
- Agents API: 9/9 methods ✅ (1 newly added)
- Vector API: 13/13 methods ✅ (1 fixed)
- **Total: 73/73 documented methods** ✅

#### 🔄 API Parity

✅ **100% API Parity with TypeScript SDK**

- All 8 governance operations implemented
- All 4 compliance templates available
- All 17 missing APIs now implemented
- Pythonic naming conventions (snake_case)
- Full type annotations with dataclasses
- Complete test coverage

#### 💡 Usage Examples

**Restore from Archive:**

```python
# Archive a memory
await cortex.memory.archive('agent-1', 'mem-123')

# Restore it later
restored = await cortex.memory.restore_from_archive('agent-1', 'mem-123')
print(f"Restored: {restored['restored']}")
```

**Bulk Unregister Agents:**

```python
from cortex import UnregisterAgentOptions

# Unregister all experimental agents
result = await cortex.agents.unregister_many(
    filters={'metadata': {'environment': 'experimental'}},
    options=UnregisterAgentOptions(cascade=False)
)
print(f"Unregistered {result['deleted']} agents")
```

**Context Versioning:**

```python
# Get version history
history = await cortex.contexts.get_history('ctx-123')
for version in history:
    print(f"v{version['version']}: {version['status']}")

# Get specific version
v1 = await cortex.contexts.get_version('ctx-123', 1)

# Temporal query
august_state = await cortex.contexts.get_at_timestamp(
    'ctx-123',
    int(datetime(2025, 8, 1).timestamp() * 1000)
)
```

**Search Memory Spaces:**

```python
# Search by name or metadata
spaces = await cortex.memory_spaces.search('engineering', {
    'type': 'team',
    'status': 'active'
})

# Update participants
await cortex.memory_spaces.update_participants('team-space', {
    'add': [{'id': 'new-bot', 'type': 'agent', 'joinedAt': int(time.time() * 1000)}],
    'remove': ['old-bot']
})
```

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
- gpt-5-nano summarization quality testing
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
ons)

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
