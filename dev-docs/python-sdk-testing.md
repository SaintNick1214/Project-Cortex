# Python SDK Testing Guide

> **Development Documentation** - For contributors and maintainers

## Quick Reference

```bash
# If Convex backend is already running (check .env.local):
cd cortex-sdk-python
source .venv/bin/activate          # Python 3.13
pytest                              # Uses CONVEX_URL from .env.local

# If you need to start Convex backend first:
cd /Users/SaintNick/Documents/Cortex/Project-Cortex
npm run dev:local                   # Terminal 1
# Then run tests (Terminal 2)

# Test with different Python versions:
source .venv/bin/activate           # Python 3.13
pytest
source .venv-12/bin/activate        # Python 3.12
pytest

# Full test suite (all combinations):
./run-complete-tests.sh
```

## Overview

This guide covers testing the Cortex Python SDK against both LOCAL and MANAGED Convex deployments, matching the dual-testing approach used in the TypeScript SDK.

## Prerequisites

### Python Versions

The SDK supports **Python 3.12 and 3.13**. We test against both versions:

- ✅ **Python 3.13** - Primary development (`.venv`)
- ✅ **Python 3.12** - Compatibility testing (`.venv-12`)

### Setting Up Python Environments

```bash
cd cortex-sdk-python

# Python 3.13 environment (primary)
python3.13 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

# Python 3.12 environment (compatibility)
python3.12 -m venv .venv-12
source .venv-12/bin/activate
pip install -e ".[dev]"
```

## Understanding Convex Setup

### What is Convex?

The Python SDK uses the [convex PyPI package](https://pypi.org/project/convex/) (v0.7.0+) as a **client library** to connect to a **Convex backend server** (which runs separately).

**Two Components:**

1. **Convex Python Client** (`pip install convex`) - ✅ Already in requirements
2. **Convex Backend Server** - Must be running (local/docker/cloud)

### Convex Backend Options

The backend server (not the Python client) can run in multiple ways:

#### Option 1: LOCAL Mode (Development Server) - Already Configured!

Your `.env.local` already has this configured:

```bash
LOCAL_CONVEX_URL=http://127.0.0.1:3210
LOCAL_CONVEX_DEPLOYMENT=anonymous:anonymous-Project-Cortex
```

**If the local backend is already running**, you're all set! If not, start it:

```bash
# From Project-Cortex root
cd /Users/SaintNick/Documents/Cortex/Project-Cortex
npm run dev:local

# Starts Convex backend at http://127.0.0.1:3210
```

#### Option 2: MANAGED Mode (Cloud) - Already Running!

Your `.env.local` shows this is already configured and running:

```bash
CLOUD_CONVEX_URL=https://expert-buffalo-268.convex.cloud
CONVEX_URL=http://127.0.0.1:3210  # Currently set to LOCAL
```

**The cloud backend is already running** - just change `CONVEX_URL` to use it:

```bash
export CONVEX_URL="https://expert-buffalo-268.convex.cloud"
```

### Environment Variables

The Python SDK reads `CONVEX_URL` from environment variables. The `.env.local` file in the project root is **automatically loaded** by the test suite.

**Current Configuration (from .env.local):**

```bash
CONVEX_URL=http://127.0.0.1:3210  # Currently using LOCAL
```

**To switch to MANAGED:**

```bash
export CONVEX_URL="https://expert-buffalo-268.convex.cloud"
```

**The Python tests automatically load .env.local**, so if CONVEX_URL is set there, you don't need to export it manually!

## Environment Configuration

The Python SDK uses the same `.env.local` configuration as the TypeScript SDK. See the root `.env.local` file for complete configuration.

### Required Environment Variables

```bash
# From .env.local

# LOCAL DEVELOPMENT
LOCAL_CONVEX_DEPLOYMENT=anonymous:anonymous-Project-Cortex
LOCAL_CONVEX_URL=http://127.0.0.1:3210

# CLOUD DEVELOPMENT
CLOUD_CONVEX_URL=https://expert-buffalo-268.convex.cloud
CLOUD_CONVEX_DEPLOY_KEY=dev:expert-buffalo-268|<key>

# GRAPH DATABASE (Optional)
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=cortex-dev-password

MEMGRAPH_URI=bolt://localhost:7688
MEMGRAPH_USERNAME=memgraph
MEMGRAPH_PASSWORD=cortex-dev-password

# OPENAI (Optional - for embedding tests)
OPENAI_API_KEY=<your-key>
```

## Test Infrastructure

### Directory Structure

```
cortex-sdk-python/
├── tests/
│   ├── conftest.py              # Pytest fixtures
│   ├── __init__.py
│   ├── test_conversations.py    # Layer 1a tests
│   ├── test_immutable.py        # Layer 1b tests
│   ├── test_mutable.py          # Layer 1c tests
│   ├── test_vector.py           # Layer 2 tests
│   ├── test_facts.py            # Layer 3 tests
│   ├── test_memory.py           # Layer 4 tests
│   ├── test_contexts.py         # Context tests
│   ├── test_users.py            # User + GDPR tests
│   ├── test_agents.py           # Agent tests
│   ├── test_memory_spaces.py    # Memory space tests
│   ├── test_a2a.py              # A2A tests
│   └── graph/
│       ├── test_adapter.py      # Graph adapter tests
│       ├── test_sync.py         # Graph sync tests
│       └── test_orphan.py       # Orphan detection tests
└── pytest.ini                   # Pytest configuration
```

### Pytest Configuration

The `pytest.ini` file configures:

```ini
[pytest]
minversion = 8.0
testpaths = tests
asyncio_mode = auto          # Auto-detect async tests
addopts =
    -ra                      # Show all test results
    -q                       # Quiet output
    --strict-markers         # Strict marker validation
    --cov=cortex             # Coverage
    --cov-report=term-missing
    --cov-report=html

markers =
    asyncio: mark test as async
    integration: mark test as integration test
    graph: mark test as requiring graph database
    slow: mark test as slow running
```

## Running Tests

### Install Dependencies

```bash
cd cortex-sdk-python

# Install package with dev dependencies
pip install -e ".[dev]"

# Or install from requirements
pip install -r requirements-dev.txt
```

### Basic Test Commands

```bash
# Run all tests
pytest

# Run with verbose output
pytest -v

# Run with coverage
pytest --cov=cortex --cov-report=html

# Run specific test file
pytest tests/test_memory.py

# Run specific test
pytest tests/test_memory.py::test_remember_basic -v

# Run tests by marker
pytest -m asyncio          # Only async tests
pytest -m integration      # Only integration tests
pytest -m graph            # Only graph tests
```

### Multi-Version Testing (Python 3.12 + 3.13)

Test against both supported Python versions:

**Python 3.13 (Primary - .venv):**

```bash
cd cortex-sdk-python

# Activate Python 3.13 environment
source .venv/bin/activate

# Verify version
python --version  # Should show Python 3.13.x

# Run tests
pytest -v
```

**Python 3.12 (Compatibility - .venv-12):**

```bash
cd cortex-sdk-python

# Activate Python 3.12 environment
source .venv-12/bin/activate

# Verify version
python --version  # Should show Python 3.12.x

# Run tests
pytest -v
```

**Automated Multi-Version Testing:**

```bash
# Create a multi-version test runner
cat > run-multiversion-tests.sh << 'EOF'
#!/bin/bash
set -e

echo "======================================"
echo "Python 3.13 Tests"
echo "======================================"
source .venv/bin/activate
python --version
pytest --cov=cortex --cov-report=term-missing
deactivate

echo ""
echo "======================================"
echo "Python 3.12 Tests"
echo "======================================"
source .venv-12/bin/activate
python --version
pytest
deactivate

echo ""
echo "✅ All tests passed on Python 3.12 and 3.13!"
EOF

chmod +x run-multiversion-tests.sh
./run-multiversion-tests.sh
```

### Dual Testing (LOCAL vs MANAGED Convex)

Following the TypeScript SDK pattern, run tests against both LOCAL and MANAGED Convex:

**Step 1: Verify Convex Backend is Running**

Check `.env.local` - if `CONVEX_URL` is set, the backend might already be running:

```bash
# Check current setting
cat ../.env.local | grep CONVEX_URL
# CONVEX_URL=http://127.0.0.1:3210

# Test if backend is responding
curl http://127.0.0.1:3210
```

If not running, start it:

```bash
# Terminal 1: Start Convex backend
cd /Users/SaintNick/Documents/Cortex/Project-Cortex
npm run dev:local

# Wait for: "Convex dev server running at http://127.0.0.1:3210"
```

**Step 2: Run Tests - LOCAL Mode**

```bash
# Terminal 2: Run Python tests
cd cortex-sdk-python
source .venv/bin/activate

# .env.local is auto-loaded, but you can override:
# export CONVEX_URL="http://127.0.0.1:3210"  # Optional

pytest -v
```

**Step 3: Run Tests - MANAGED Mode**

```bash
# Use cloud deployment (already running)
cd cortex-sdk-python
source .venv/bin/activate
export CONVEX_URL="https://expert-buffalo-268.convex.cloud"
pytest -v
```

**Complete Automated Test Script (All Combinations):**

```bash
# Test: Python 3.12 + 3.13 × LOCAL + MANAGED = 4 test runs
cat > run-complete-tests.sh << 'EOF'
#!/bin/bash
set -e

PROJECT_ROOT="/Users/SaintNick/Documents/Cortex/Project-Cortex"
SDK_DIR="$PROJECT_ROOT/cortex-sdk-python"

cd "$SDK_DIR"

# Test combinations
PYTHON_VERSIONS=("3.13:.venv" "3.12:.venv-12")
CONVEX_MODES=("LOCAL:http://127.0.0.1:3210" "MANAGED:https://expert-buffalo-268.convex.cloud")

for py_version in "${PYTHON_VERSIONS[@]}"; do
    IFS=':' read -r version venv <<< "$py_version"

    for convex_mode in "${CONVEX_MODES[@]}"; do
        IFS=':' read -r mode url <<< "$convex_mode"

        echo ""
        echo "======================================"
        echo "Python $version + Convex $mode"
        echo "======================================"

        source "$venv/bin/activate"
        export CONVEX_URL="$url"

        python --version
        echo "CONVEX_URL=$CONVEX_URL"

        if [ "$version" = "3.13" ] && [ "$mode" = "LOCAL" ]; then
            # Full coverage on primary config
            pytest --cov=cortex --cov-report=term-missing
        else
            # Just run tests on other configs
            pytest -v
        fi

        deactivate
    done
done

echo ""
echo "✅ All tests passed on all combinations!"
echo "   - Python 3.12 + 3.13"
echo "   - LOCAL + MANAGED Convex"
EOF

chmod +x run-complete-tests.sh
./run-complete-tests.sh
```

## Test Fixtures

### Core Fixtures (`conftest.py`)

```python
import pytest
import os
from cortex import Cortex, CortexConfig

@pytest.fixture
async def cortex_client():
    """Fixture for Cortex client."""
    convex_url = os.getenv("CONVEX_URL", "http://localhost:3210")
    config = CortexConfig(convex_url=convex_url)
    client = Cortex(config)
    yield client
    await client.close()

@pytest.fixture
async def cortex_with_graph():
    """Fixture for Cortex with graph integration."""
    neo4j_uri = os.getenv("NEO4J_URI")
    if not neo4j_uri:
        pytest.skip("NEO4J_URI not configured")

    from cortex import GraphConfig, GraphConnectionConfig
    from cortex.graph import CypherGraphAdapter, initialize_graph_schema

    graph = CypherGraphAdapter()
    await graph.connect(
        GraphConnectionConfig(
            uri=neo4j_uri,
            username=os.getenv("NEO4J_USERNAME", "neo4j"),
            password=os.getenv("NEO4J_PASSWORD", "password")
        )
    )

    await initialize_graph_schema(graph)

    config = CortexConfig(
        convex_url=os.getenv("CONVEX_URL"),
        graph=GraphConfig(adapter=graph, auto_sync=False)
    )
    client = Cortex(config)

    yield client

    await client.close()
    await graph.disconnect()

@pytest.fixture
def test_user_id():
    """Generate unique test user ID."""
    import time, random
    return f"test-user-{int(time.time())}-{random.randint(1000, 9999)}"
```

## Test Organization

### Unit Tests

Test individual API modules in isolation:

```python
# tests/test_memory.py
import pytest
from cortex import RememberParams

@pytest.mark.asyncio
async def test_remember_basic(cortex_client, test_user_id):
    """Test basic remember operation."""
    result = await cortex_client.memory.remember(
        RememberParams(
            memory_space_id="test-agent",
            conversation_id="test-conv",
            user_message="Test",
            agent_response="Response",
            user_id=test_user_id,
            user_name="Tester"
        )
    )

    assert len(result.memories) == 2
    assert result.conversation["conversationId"] == "test-conv"
```

### Integration Tests

Test cross-layer functionality:

```python
# tests/test_cross_layer.py
import pytest

@pytest.mark.integration
@pytest.mark.asyncio
async def test_remember_with_facts(cortex_client, test_user_id):
    """Test remember with fact extraction."""

    async def extract_facts(user_msg, agent_msg):
        return [{
            "fact": "User prefers dark mode",
            "factType": "preference",
            "confidence": 95
        }]

    result = await cortex_client.memory.remember(
        RememberParams(
            ...,
            extract_facts=extract_facts
        )
    )

    assert len(result.facts) > 0
```

### Graph Tests

Test graph database integration:

```python
# tests/graph/test_sync.py
import pytest

@pytest.mark.graph
@pytest.mark.asyncio
async def test_graph_sync(cortex_with_graph, test_user_id):
    """Test auto-sync to graph database."""

    result = await cortex_with_graph.memory.remember(params)

    # Verify in graph
    graph = cortex_with_graph.graph_adapter
    nodes = await graph.find_nodes(
        "Memory",
        {"memoryId": result.memories[0].memory_id},
        1
    )

    assert len(nodes) == 1
```

## GDPR Testing

### Cascade Deletion Tests

```python
# tests/test_gdpr.py
import pytest
from cortex import DeleteUserOptions

@pytest.mark.asyncio
async def test_gdpr_cascade(cortex_client, test_user_id):
    """Test GDPR cascade deletion across all layers."""

    # Create user with data
    await cortex_client.users.update(test_user_id, {"name": "Test"})

    # Create memories
    await cortex_client.memory.remember(...)

    # Delete with cascade
    result = await cortex_client.users.delete(
        test_user_id,
        DeleteUserOptions(cascade=True, verify=True)
    )

    # Verify deletion
    assert result.verification.complete
    assert len(result.verification.issues) == 0
    assert result.total_deleted > 0

    # Verify user is gone
    user = await cortex_client.users.get(test_user_id)
    assert user is None
```

## Performance Testing

### Benchmark Tests

```python
# tests/test_performance.py
import pytest
import time

@pytest.mark.slow
@pytest.mark.asyncio
async def test_bulk_remember_performance(cortex_client):
    """Benchmark bulk memory operations."""

    start = time.time()

    # Store 100 memories
    results = await asyncio.gather(*[
        cortex_client.memory.remember(
            RememberParams(
                memory_space_id="perf-test",
                conversation_id=f"conv-{i}",
                user_message=f"Message {i}",
                agent_response=f"Response {i}",
                user_id="perf-user",
                user_name="Perf"
            )
        )
        for i in range(100)
    ])

    elapsed = time.time() - start

    assert len(results) == 100
    assert elapsed < 10.0  # Should complete in under 10 seconds

    print(f"Stored 100 memories in {elapsed:.2f}s")
```

## Continuous Integration

### GitHub Actions Workflow

Create `.github/workflows/python-sdk-tests.yml`:

```yaml
name: Python SDK Tests

on:
  push:
    paths:
      - "cortex-sdk-python/**"
  pull_request:
    paths:
      - "cortex-sdk-python/**"

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: ["3.12", "3.13"]

    steps:
      - uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: ${{ matrix.python-version }}

      - name: Install dependencies
        run: |
          cd cortex-sdk-python
          pip install -e ".[dev]"

      - name: Start Convex (LOCAL)
        run: |
          npm run dev:local &
          sleep 5  # Wait for Convex to start

      - name: Run tests (LOCAL)
        env:
          CONVEX_URL: http://localhost:3210
        run: |
          cd cortex-sdk-python
          pytest --cov=cortex --cov-report=xml

      - name: Run tests (MANAGED)
        env:
          CONVEX_URL: ${{ secrets.CLOUD_CONVEX_URL }}
        run: |
          cd cortex-sdk-python
          pytest

      - name: Upload coverage
        if: matrix.python-version == '3.13'
        uses: codecov/codecov-action@v3
        with:
          file: ./cortex-sdk-python/coverage.xml
```

## Coverage Requirements

### Target Coverage

- **Overall**: 90%+ code coverage
- **Critical paths**: 100% coverage
  - GDPR cascade deletion
  - Memory remember/forget
  - Graph sync operations

### Generate Coverage Report

```bash
# Run tests with coverage
pytest --cov=cortex --cov-report=html --cov-report=term

# View HTML report
open htmlcov/index.html

# Check coverage percentage
pytest --cov=cortex --cov-report=term-missing
```

## Test Data Cleanup

### Automatic Cleanup in Fixtures

```python
@pytest.fixture
async def cortex_client_with_cleanup(cortex_client):
    """Cortex client with automatic test data cleanup."""
    test_memory_spaces = []
    test_user_ids = []

    yield cortex_client, test_memory_spaces, test_user_ids

    # Cleanup after test
    for memory_space_id in test_memory_spaces:
        try:
            await cortex_client.memory_spaces.delete(
                memory_space_id,
                cascade=True,
                reason="Test cleanup"
            )
        except:
            pass

    for user_id in test_user_ids:
        try:
            await cortex_client.users.delete(user_id)
        except:
            pass
```

### Manual Cleanup Script

```bash
# tests/cleanup.py
import asyncio
import os
from cortex import Cortex, CortexConfig

async def cleanup_test_data():
    """Clean up test data from Convex."""
    cortex = Cortex(CortexConfig(
        convex_url=os.getenv("CONVEX_URL")
    ))

    # Delete test memory spaces
    spaces = await cortex.memory_spaces.list(limit=1000)
    for space in spaces.get("spaces", []):
        if space.memory_space_id.startswith("test-"):
            await cortex.memory_spaces.delete(
                space.memory_space_id,
                cascade=True,
                reason="Test cleanup"
            )

    # Delete test users
    users = await cortex.users.list(limit=1000)
    for user in users.get("users", []):
        if user.id.startswith("test-user-"):
            await cortex.users.delete(user.id)

    await cortex.close()
    print("✅ Test data cleaned up")

if __name__ == "__main__":
    asyncio.run(cleanup_test_data())
```

## Graph Database Testing

### Prerequisites

Start graph databases using Docker:

```bash
# From project root
docker-compose -f docker-compose.graph.yml up -d neo4j

# Or start Memgraph
docker-compose -f docker-compose.graph.yml up -d memgraph
```

### Graph-Specific Tests

```bash
# Run only graph tests
pytest -m graph

# Skip graph tests if database not available
pytest -m "not graph"
```

### Graph Test Example

```python
@pytest.mark.graph
@pytest.mark.asyncio
async def test_graph_orphan_detection(cortex_with_graph):
    """Test orphan detection on deletion."""

    # Create memory → conversation relationship
    result = await cortex_with_graph.memory.remember(params)

    memory_id = result.memories[0].memory_id
    conv_id = result.conversation["conversationId"]

    # Delete memory with orphan cleanup
    await cortex_with_graph.memory.forget(
        memory_space_id,
        memory_id,
        ForgetOptions(
            delete_conversation=True,
            sync_to_graph=True
        )
    )

    # Verify orphan cleanup
    graph = cortex_with_graph.graph_adapter
    conv_nodes = await graph.find_nodes(
        "Conversation",
        {"conversationId": conv_id},
        1
    )

    # Conversation should be deleted (orphaned)
    assert len(conv_nodes) == 0
```

## Test Markers

Use markers to categorize tests:

```python
@pytest.mark.asyncio        # Async test (required for all async tests)
@pytest.mark.integration    # Integration test (slower)
@pytest.mark.graph          # Requires graph database
@pytest.mark.slow           # Slow running test
```

Run specific marker groups:

```bash
# Only async tests
pytest -m asyncio

# Only integration tests
pytest -m integration

# Exclude slow tests
pytest -m "not slow"

# Only graph tests
pytest -m graph
```

## Debugging Tests

### Verbose Output

```bash
# Show print statements
pytest -s

# Very verbose
pytest -vv

# Show local variables on failure
pytest --showlocals
```

### Run Single Test with Debugging

```python
# Add breakpoint
import pdb; pdb.set_trace()

# Run test
pytest tests/test_memory.py::test_remember_basic -s
```

### Test in REPL

```bash
# Start Python REPL with test environment
python -i -m pytest tests/test_memory.py --collect-only
```

## Type Checking

### Run mypy

```bash
# Type check the SDK
mypy cortex --strict

# Type check tests
mypy tests
```

### Common Type Issues

```python
# ❌ Missing type hint
async def remember(params):
    ...

# ✅ With type hint
async def remember(params: RememberParams) -> RememberResult:
    ...
```

## Linting

### Run ruff

```bash
# Lint the SDK
ruff check cortex

# Auto-fix issues
ruff check cortex --fix

# Format with black
black cortex tests
```

## Code Quality Checklist

Before committing:

- [ ] All tests pass (LOCAL + MANAGED)
- [ ] Coverage >= 90%
- [ ] Type checking passes (`mypy --strict`)
- [ ] Linting passes (`ruff check`)
- [ ] Code formatted (`black`)
- [ ] No print statements (use logging)
- [ ] Docstrings on all public methods
- [ ] Examples updated if API changed

## Common Test Patterns

### Test Template

```python
import pytest
from cortex import ...

@pytest.mark.asyncio
async def test_feature_name(cortex_client, test_user_id):
    """Test description."""
    # Arrange
    params = ...

    # Act
    result = await cortex_client.method(params)

    # Assert
    assert result is not None
    assert result.field == expected_value
```

### Parameterized Tests

```python
@pytest.mark.parametrize("importance", [0, 50, 100])
@pytest.mark.asyncio
async def test_remember_with_importance(cortex_client, importance):
    """Test remember with different importance values."""
    result = await cortex_client.memory.remember(
        RememberParams(..., importance=importance)
    )
    assert result.memories[0].importance == importance
```

### Error Testing

```python
@pytest.mark.asyncio
async def test_invalid_importance_raises_error(cortex_client):
    """Test that invalid importance raises CortexError."""
    from cortex import CortexError, ErrorCode

    with pytest.raises(CortexError) as exc_info:
        await cortex_client.memory.remember(
            RememberParams(..., importance=150)  # Invalid!
        )

    assert exc_info.value.code == ErrorCode.INVALID_IMPORTANCE
```

## Testing Best Practices

1. **Use fixtures** - Don't repeat setup code
2. **Clean up** - Remove test data after tests
3. **Use markers** - Categorize tests appropriately
4. **Test both modes** - LOCAL and MANAGED Convex
5. **Parametrize** - Test multiple values
6. **Async tests** - Always use `@pytest.mark.asyncio`
7. **Unique IDs** - Generate unique test IDs to avoid conflicts
8. **Error paths** - Test error conditions
9. **Integration** - Test cross-layer functionality
10. **Graph tests** - Mark with `@pytest.mark.graph`

## Troubleshooting

### Tests Hanging

```bash
# Add timeout
pytest --timeout=30

# Show which test is running
pytest -v --tb=short
```

### Import Errors

```bash
# Reinstall in editable mode
pip install -e ".[dev]"

# Verify installation
python -c "from cortex import Cortex; print('OK')"
```

### Database Connection Issues

```bash
# Verify Convex is running
curl http://127.0.0.1:3210

# Verify Neo4j is running
docker ps | grep neo4j

# Check logs
docker logs neo4j
```

## Resources

- [pytest documentation](https://docs.pytest.org/)
- [pytest-asyncio documentation](https://pytest-asyncio.readthedocs.io/)
- [TypeScript SDK Testing](./DUAL_TESTING.md) - Same patterns apply
- [Main Testing Guide](../tests/README.md) - TypeScript test approach

## Support

For testing questions:

- 💬 [GitHub Discussions](https://github.com/SaintNick1214/Project-Cortex/discussions)
- 🐛 [GitHub Issues](https://github.com/SaintNick1214/Project-Cortex/issues)

---

**Last Updated**: 2025-11-06
