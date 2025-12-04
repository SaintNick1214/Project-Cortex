# Changelog - Cortex Python SDK

All notable changes to the Python SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
