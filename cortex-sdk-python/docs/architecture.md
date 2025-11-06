# Cortex Python SDK - Architecture

## 4-Layer Architecture (Fully Implemented)

The Python SDK implements the complete 4-layer Cortex architecture:

```
Layer 1: ACID Stores (Source of Truth)
├── ConversationsAPI     ✅ 13 methods - Immutable conversation threads
├── ImmutableAPI         ✅ 9 methods - Shared versioned data
└── MutableAPI           ✅ 12 methods - Shared live data

Layer 2: Vector Index (Searchable Memory)
└── VectorAPI            ✅ 13 methods - Embedded memories

Layer 3: Facts Store (Structured Knowledge)
└── FactsAPI             ✅ 10 methods - LLM-extracted facts

Layer 4: Convenience + Coordination
├── MemoryAPI            ✅ 14 methods - Primary interface
├── ContextsAPI          ✅ 17 methods - Workflow coordination
├── UsersAPI             ✅ 11 methods - GDPR compliance
├── AgentsAPI            ✅ 8 methods - Optional registry
└── MemorySpacesAPI      ✅ 9 methods - Space management

Helpers
└── A2AAPI               ✅ 4 methods - Agent-to-agent communication

Graph Integration
├── CypherGraphAdapter   ✅ Neo4j/Memgraph support
├── Sync utilities       ✅ All entity types
├── Orphan detection     ✅ Circular reference handling
└── GraphSyncWorker      ✅ Real-time reactive sync
```

## Package Structure

```
cortex/
├── client.py              # Main Cortex class
├── types.py               # All dataclass definitions (50+)
├── errors.py              # Error handling system
├── conversations/         # Layer 1a
├── immutable/             # Layer 1b
├── mutable/               # Layer 1c
├── vector/                # Layer 2
├── facts/                 # Layer 3
├── memory/                # Layer 4 - Primary API
├── contexts/              # Coordination
├── users/                 # GDPR cascade deletion
├── agents/                # Agent registry
├── memory_spaces/         # Space management
├── a2a/                   # A2A helpers
└── graph/                 # Graph integration
    ├── adapters/          # CypherGraphAdapter
    ├── sync/              # Sync utilities + orphan detection
    ├── schema/            # Schema management
    └── worker/            # GraphSyncWorker
```

## Key Design Decisions

### Type Safety
- Uses Python dataclasses for all types
- Full type hints throughout
- Pydantic for complex validation
- Protocol for GraphAdapter interface

### Async-First
- Native Python async/await
- All operations are async
- Matches TypeScript SDK pattern
- asyncio.gather for parallel operations

### Error Handling
- Structured CortexError with codes
- 50+ error codes defined
- Type guards for error checking
- Matches TypeScript error system

### Graph Integration
- Optional Neo4j/Memgraph support
- Async Neo4j Python driver
- Auto-sync capabilities
- Orphan detection on deletions

For detailed implementation notes, see the [Developer Guide](./guides/developer-guide.md).

