# Cortex Python SDK Tests

Comprehensive test suite for Cortex SDK v0.11.0 with **actual data validation**.

## 🎯 Test Philosophy

**Critical Principle**: All tests validate **actual data in databases**, not just "no errors".

Every test:

- ✅ Verifies data exists where expected
- ✅ Checks properties match requirements
- ✅ Validates relationships between entities
- ✅ Confirms metrics reflect reality

## 📁 Test Structure

```
tests/
├── streaming/              # Streaming API tests (70+ tests)
│   ├── test_stream_metrics.py
│   ├── test_stream_processor.py
│   ├── test_chunking_strategies.py
│   ├── test_progressive_storage.py
│   ├── test_error_recovery.py
│   ├── test_adaptive_processor.py
│   ├── test_remember_stream_integration.py
│   ├── manual_test.py
│   └── README.md
│
├── graph/                  # Graph integration tests
│   ├── test_comprehensive_data_validation.py
│   ├── comprehensive_validation.py  # Manual validation
│   └── clear_databases.py
│
├── conftest.py            # Shared fixtures
└── run_streaming_tests.sh # Test runner
```

## 🚀 Quick Start

### 1. Setup Environment

```bash
# Required
export CONVEX_URL="https://your-project.convex.cloud"
export NEO4J_URI="bolt://localhost:7687"
export NEO4J_USER="neo4j"
export NEO4J_PASSWORD="password"

# Optional (for Memgraph tests)
export MEMGRAPH_URI="bolt://localhost:7688"
export MEMGRAPH_USER=""
export MEMGRAPH_PASSWORD=""
```

### 2. Start Services

```bash
# From Project-Cortex root
docker-compose -f docker-compose.graph.yml up -d

# Start Convex dev
npx convex dev
```

### 3. Run Tests

```bash
# All streaming tests
./tests/run_streaming_tests.sh

# Or use pytest directly
python -m pytest tests/streaming/ -v

# Single test file
python -m pytest tests/streaming/test_stream_metrics.py -v

# With coverage
python -m pytest tests/streaming/ --cov=cortex.memory.streaming --cov-report=html
```

## 🧪 Test Categories

### Unit Tests (50+ tests)

Fast tests with mocked dependencies:

- `test_stream_metrics.py` - 15 tests
- `test_chunking_strategies.py` - 10 tests
- `test_progressive_storage.py` - 8 tests
- `test_error_recovery.py` - 9 tests
- `test_adaptive_processor.py` - 9 tests

### Integration Tests (20+ tests)

Tests requiring live databases:

- `test_stream_processor.py` - 8 tests
- `test_remember_stream_integration.py` - 8 tests
- `test_comprehensive_data_validation.py` - 6 tests

### Manual Tests

Interactive tests with console output:

- `streaming/manual_test.py` - Full streaming demo
- `graph/comprehensive_validation.py` - Graph validation across all APIs
- `graph/clear_databases.py` - Database cleanup utility

## 📊 What Gets Validated

### Convex (Layer 1)

- ✅ Conversations exist with correct message counts
- ✅ Messages contain expected content
- ✅ Metadata is properly stored

### Vector (Layer 2)

- ✅ Memory entries exist with correct IDs
- ✅ Embeddings are generated when requested
- ✅ Conversation references are linked

### Facts (Layer 3)

- ✅ Fact records exist with proper structure
- ✅ Subject-predicate-object triples are correct
- ✅ Confidence scores match expectations

### Graph (External)

- ✅ Nodes exist with correct labels
- ✅ Properties match database records
- ✅ Edges connect the right nodes
- ✅ Traversal returns expected paths

### Streaming

- ✅ Metrics match actual stream processing
- ✅ Hooks receive correct events
- ✅ Progressive features update incrementally
- ✅ Error recovery strategies work as specified

## 🔍 Running Specific Tests

### Run Only Fast Unit Tests

```bash
python -m pytest tests/streaming/ -m unit -v
```

### Run Only Integration Tests

```bash
python -m pytest tests/streaming/ -m integration -v
```

### Run Only Graph Tests

```bash
python -m pytest tests/streaming/ -m graph -v
```

### Run Single Test Method

```bash
python -m pytest tests/streaming/test_stream_metrics.py::TestMetricsCollector::test_metrics_initialization -v
```

## 🐛 Debugging Failed Tests

### 1. Check Database Connectivity

```bash
# Neo4j
docker exec -it cortex-neo4j cypher-shell -u neo4j -p password

# Memgraph
docker exec -it cortex-memgraph mgconsole
```

### 2. Clear Test Data

```bash
python tests/graph/clear_databases.py
```

### 3. Verify Convex Backend

```bash
# Check Convex is running
npx convex dev

# View Convex dashboard
# Check for any errors in function logs
```

### 4. Run Manual Validation

```bash
# Comprehensive graph validation
python tests/graph/comprehensive_validation.py

# Streaming validation
python tests/streaming/manual_test.py
```

### 5. Enable Verbose Output

```bash
python -m pytest tests/streaming/test_stream_metrics.py -v -s --tb=long
```

## 📈 Test Coverage Goals

**Current Coverage**: ~70 tests

| Category         | Target | Current | Status  |
| ---------------- | ------ | ------- | ------- |
| Stream Metrics   | 15     | 15      | ✅ 100% |
| Stream Processor | 10     | 8       | ✅ 80%  |
| Chunking         | 10     | 10      | ✅ 100% |
| Storage          | 10     | 8       | ✅ 80%  |
| Error Recovery   | 10     | 9       | ✅ 90%  |
| Adaptive         | 10     | 9       | ✅ 90%  |
| Integration      | 15     | 8       | ⏳ 53%  |
| Graph Validation | 10     | 6       | ⏳ 60%  |

**To Reach 119 Tests**: Add more edge cases and error scenarios

## ✅ Test Quality Checklist

When writing tests, ensure:

- [ ] Test name describes what's being validated
- [ ] Docstring explains the test purpose
- [ ] CRITICAL comments mark key assertions
- [ ] Actual data is validated (not just no errors)
- [ ] Test cleans up after itself
- [ ] Error messages are descriptive

## 🎓 Example: Good vs Bad Test

### ❌ Bad Test (No Data Validation)

```python
async def test_agent_registration():
    # Just checks no error occurred
    await client.agents.register(agent_id="test", name="Test")
    assert True  # No validation!
```

### ✅ Good Test (Actual Data Validation)

```python
async def test_agent_registration_creates_graph_node():
    """Validates agent node exists in graph with correct properties"""
    agent_id = "test-agent"
    await client.agents.register(agent_id=agent_id, name="Test", sync_to_graph=True)

    # CRITICAL: Verify node actually exists
    nodes = await graph.find_nodes("Agent", {"agentId": agent_id}, 1)
    assert len(nodes) == 1, "Agent node not found!"
    assert nodes[0].properties["name"] == "Test"
```

## 📚 Related Documentation

- [Streaming Tests README](streaming/README.md) - Detailed streaming test docs
- [TypeScript Tests](../../tests/) - Reference implementation
- [IMPLEMENTATION-STATUS.md](../IMPLEMENTATION-STATUS.md) - Current status

## 🚀 Next Steps

To expand test coverage:

1. Add more edge case tests for each component
2. Add performance benchmark tests
3. Add concurrency tests for streaming
4. Add cross-database consistency tests
5. Add failure scenario tests (network issues, database down, etc.)
