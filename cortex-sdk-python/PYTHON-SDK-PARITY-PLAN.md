# Python SDK Parity Plan - v0.11.0

## Overview

Bring Python SDK to full parity with TypeScript SDK v0.11.0 changes:
- Enhanced RememberStream API with progressive features
- Graph sync fixes for all APIs
- Comprehensive testing and validation

## Current State

**Python SDK Version**: 0.10.0  
**Target Version**: 0.11.0

**Existing**:
- Basic `remember_stream()` implementation (simple buffering)
- `stream_utils.py` with basic AsyncIterable consumption
- Graph integration (Cypher adapter exists)
- All 9 core APIs present

**Missing**:
- All 12 enhanced streaming features from TypeScript
- Progressive storage, hooks, metrics
- Graph sync bug fixes (4 bugs)
- Comprehensive test coverage (119 streaming tests)
- Data validation tests

## Implementation Plan

### Phase 1: Streaming Types & Infrastructure

**Files to Create**:
1. `cortex/memory/streaming_types.py` - All streaming types (ChunkEvent, ProgressEvent, StreamMetrics, etc.)
2. `cortex/memory/streaming/` directory - New streaming components

**TypeScript → Python Mapping**:
```
src/types/streaming.ts → cortex/memory/streaming_types.py
```

### Phase 2: Streaming Components (9 files)

**Create** (`cortex/memory/streaming/`):
1. `__init__.py` - Package init
2. `stream_metrics.py` - MetricsCollector class
3. `stream_processor.py` - StreamProcessor with hooks
4. `progressive_storage.py` - ProgressiveStorageHandler
5. `fact_extractor.py` - ProgressiveFactExtractor
6. `chunking.py` - ResponseChunker with 4 strategies
7. `error_recovery.py` - StreamErrorRecovery + ResumableStreamError
8. `adaptive.py` - AdaptiveStreamProcessor
9. `graph_sync.py` - ProgressiveGraphSync

**Complexity**: ~2,000 lines of Python code

### Phase 3: Enhanced remember_stream()

**Update**: `cortex/memory/__init__.py`
- Refactor `remember_stream()` method
- Add StreamingOptions parameter
- Integrate all streaming components
- Return EnhancedRememberStreamResult

**Complexity**: ~300 lines

### Phase 4: Stream Utils Enhancement

**Update**: `cortex/memory/stream_utils.py`
- Add RollingContextWindow class
- Add AsyncQueue class  
- Add stream timeout/length utilities
- Add buffering utilities

**Complexity**: ~200 lines

### Phase 5: Graph Sync Fixes

**Update 3 files**:
1. `cortex/agents/__init__.py` - Add graph sync to register()
2. `cortex/graph/adapters/cypher.py` - Fix Memgraph ID conversion in:
   - `create_edge()`
   - `traverse()`
   - `get_node()`
   - `update_node()`
   - `delete_node()`
   - All batch operations

**Complexity**: ~150 lines

### Phase 6: Schema Changes

**Update**: Convex schema (already shared with TypeScript)
- ✅ Already done - schema is shared

**Python SDK just needs to use new mutations**:
- Use `storePartialMemory`
- Use `updatePartialMemory`  
- Use `finalizePartialMemory`

### Phase 7: Testing (119 tests)

**Create Test Files**:
1. `tests/streaming/test_stream_metrics.py` - 15 tests
2. `tests/streaming/test_stream_processor.py` - 11 tests
3. `tests/streaming/test_stream_utils.py` - 12 tests
4. `tests/streaming/test_remember_stream_integration.py` - 10 tests
5. `tests/streaming/test_progressive_graph_sync.py` - 24 tests (Neo4j + Memgraph)
6. `tests/streaming/test_chunking.py` - Tests for all chunking strategies
7. Update existing `tests/test_memory.py` - Add streaming tests

**Manual Validation**:
8. `tests/streaming/manual_test.py` - End-to-end workflows
9. `tests/streaming/chunking_manual_test.py` - Chunking validation

**Graph Validation**:
10. `tests/graph/comprehensive_data_validation.py` - Validate all 9 APIs

**Complexity**: ~3,000 lines of test code

### Phase 8: Documentation

**Update**:
1. `cortex-sdk-python/CHANGELOG.md` - Add v0.11.0 entry
2. `cortex-sdk-python/pyproject.toml` - Bump version to 0.11.0
3. `cortex-sdk-python/README.md` - Update with streaming examples

**Create**:
4. Implementation docs (similar to TypeScript)
5. Graph UI guides
6. Test execution guides

### Phase 9: Validation

**Run**:
1. All streaming tests (must pass 100%)
2. Graph sync data validation (actual database queries)
3. Manual validation scripts
4. Type checking with mypy
5. Linting with ruff

## Estimated Scope

**Total Lines of Code**: ~6,000 lines
**Files to Create**: ~30 files
**Files to Modify**: ~10 files
**Tests to Write**: 119+ tests
**Time Estimate**: 4-6 hours for comprehensive implementation

## Dependencies

**New Python Dependencies Needed**:
- None! All features use standard library or existing dependencies

**Python Advantages**:
- AsyncIterator protocol is native (simpler than TypeScript)
- Type hints with Pydantic for validation
- Easier error handling with exceptions

## Implementation Order

### Week 1: Core Infrastructure
1. ✅ Create streaming types
2. ✅ Create StreamMetrics
3. ✅ Create StreamProcessor
4. ✅ Enhance stream_utils

### Week 2: Progressive Features
5. ✅ Create ProgressiveStorageHandler
6. ✅ Create ProgressiveFactExtractor
7. ✅ Create ChunkingStrategies
8. ✅ Refactor remember_stream()

### Week 3: Error Handling & Graph
9. ✅ Create ErrorRecovery
10. ✅ Create AdaptiveProcessor
11. ✅ Create ProgressiveGraphSync
12. ✅ Fix graph sync bugs

### Week 4: Testing & Validation
13. ✅ Write all unit tests
14. ✅ Write integration tests
15. ✅ Create data validation tests
16. ✅ Update documentation

## Success Criteria

- [ ] All 12 streaming features implemented
- [ ] 119+ tests passing (100%)
- [ ] Graph sync validated for all 9 APIs
- [ ] Zero breaking changes
- [ ] Documentation complete
- [ ] Version bumped to 0.11.0

## Notes

- Python SDK shares Convex backend with TypeScript (schema changes already done)
- Graph databases are same (Neo4j + Memgraph)
- Can reuse test data and validation methodology
- Type system is different but concepts map 1:1

## Next Steps

1. Start with Phase 1 (types & infrastructure)
2. Implement components incrementally
3. Test each component as it's built
4. Validate with actual database queries
5. Update documentation continuously

## Question for User

Given the scope (~6,000 lines, 30 files, 119 tests), would you like me to:

A. **Implement everything now** (comprehensive, 4-6 hours)
B. **Start with core features** (streaming types, metrics, processor first)
C. **Create detailed implementation plan** and implement later
D. **Something else**

What's your preference?
