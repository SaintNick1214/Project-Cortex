# Streaming Tests

Comprehensive test suite for Cortex v0.11.0 streaming functionality.

## ✅ Test Philosophy: Actual Data Validation

**Critical**: These tests perform **actual data validation** in databases, not just "no errors" checking.

All tests verify:

- ✅ Data actually exists in Convex
- ✅ Nodes actually exist in graph databases
- ✅ Edges/relationships actually connect nodes
- ✅ Properties match expected values
- ✅ Metrics reflect actual processing

## 📁 Test Structure

### Unit Tests

- `test_stream_metrics.py` - MetricsCollector validation (15 tests)
- `test_stream_processor.py` - StreamProcessor behavior (8 tests)
- `test_chunking_strategies.py` - ResponseChunker validation (10 tests)
- `test_progressive_storage.py` - ProgressiveStorageHandler (8 tests)
- `test_error_recovery.py` - StreamErrorRecovery (9 tests)
- `test_adaptive_processor.py` - AdaptiveStreamProcessor (9 tests)

### Integration Tests

- `test_remember_stream_integration.py` - Full API integration (8 tests)
  - Validates data across all Cortex layers
  - Checks Convex, Vector, Graph consistency
  - Verifies progressive features work together

### Manual Tests

- `manual_test.py` - End-to-end demonstration with console output
  - Visual validation of streaming flow
  - Actual database checks
  - Performance metrics display

## 🚀 Running Tests

### Run All Tests

```bash
cd cortex-sdk-python
python -m pytest tests/streaming/ -v
```

### Run Specific Test File

```bash
python -m pytest tests/streaming/test_stream_metrics.py -v
```

### Run With Coverage

```bash
python -m pytest tests/streaming/ --cov=cortex.memory.streaming --cov-report=html
```

### Run Manual Test

```bash
python tests/streaming/manual_test.py
```

## ⚙️ Prerequisites

### Required Environment Variables

```bash
export CONVEX_URL="https://your-project.convex.cloud"
export NEO4J_URI="bolt://localhost:7687"
export NEO4J_USER="neo4j"
export NEO4J_PASSWORD="password"
export MEMGRAPH_URI="bolt://localhost:7688"  # Optional
export MEMGRAPH_USER=""
export MEMGRAPH_PASSWORD=""
```

### Required Services

1. **Convex Backend**: Must be running with dev schema
2. **Neo4j**: Local instance on port 7687 (required)
3. **Memgraph**: Local instance on port 7688 (optional, for cross-DB tests)

### Start Graph Databases

```bash
# From Project-Cortex root
docker-compose -f docker-compose.graph.yml up -d
```

## 🧪 Test Coverage

**Current**: ~70 tests across 7 files

| Component           | Tests | Coverage                             |
| ------------------- | ----- | ------------------------------------ |
| Stream Metrics      | 15    | Timing, throughput, cost, insights   |
| Stream Processor    | 8     | Chunk processing, hooks, context     |
| Chunking            | 10    | All strategies, overlap, boundaries  |
| Progressive Storage | 8     | Init, update, finalize, rollback     |
| Error Recovery      | 9     | Retry, resume tokens, strategies     |
| Adaptive Processing | 9     | Stream detection, strategy selection |
| Integration         | 8     | Multi-layer validation               |
| Manual              | 1     | End-to-end demonstration             |

## 📊 What These Tests Validate

### ✅ Data Validation (Not Just "No Errors")

- **Convex**: Conversations, messages, memories actually exist
- **Vector**: Memory entries with correct embeddings and metadata
- **Graph**: Nodes exist with correct labels and properties
- **Graph**: Edges exist connecting the right nodes
- **Facts**: Fact records stored with proper source refs

### ✅ Metrics Validation

- Chunk counts match actual chunks processed
- Byte counts match actual content length
- Timing metrics reflect real processing time
- Throughput calculations are mathematically correct
- Cost estimates match token counts

### ✅ Behavior Validation

- Hooks are called with correct events
- Progressive updates happen at intervals
- Error recovery follows specified strategies
- Adaptive processor changes strategies
- Chunking produces correct chunk boundaries

## 🔍 Debugging Failed Tests

If tests fail, check:

1. **Database Connection**:

   ```bash
   # Test Neo4j
   docker exec -it cortex-neo4j cypher-shell -u neo4j -p password

   # Test Memgraph
   docker exec -it cortex-memgraph mgconsole
   ```

2. **Convex Backend**:

   ```bash
   # Check Convex is running
   npx convex dev
   ```

3. **Clear Test Data**:

   ```bash
   python tests/graph/clear_databases.py
   ```

4. **Run Single Test**:
   ```bash
   python -m pytest tests/streaming/test_stream_metrics.py::TestMetricsCollector::test_metrics_initialization -v -s
   ```

## 📝 Adding New Tests

When adding tests:

1. ✅ Always validate actual data, not just absence of errors
2. ✅ Use descriptive test names that explain what's validated
3. ✅ Add CRITICAL comments for key assertions
4. ✅ Include docstrings explaining what's being tested
5. ✅ Clean up test data after tests (use fixtures)

## 🎯 Next Steps

To expand test coverage:

1. Add tests for `fact_extractor.py` (progressive fact extraction)
2. Add tests for `progressive_graph_sync.py` (graph synchronization)
3. Add more edge cases and error scenarios
4. Add performance benchmarks
5. Add cross-database consistency tests

## 📚 Related Documentation

- [Python SDK Documentation](../../Documentation/)
- [TypeScript SDK Tests](../../../tests/streaming/) - Reference implementation
- [IMPLEMENTATION-STATUS.md](../../IMPLEMENTATION-STATUS.md) - Current progress
