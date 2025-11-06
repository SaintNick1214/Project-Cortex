# Testing Quick Start

> **Development Documentation** - Quick start for running Python SDK tests

## Before Running Tests

### 1. Check Convex Backend is Running

```bash
# Test if backend responds
curl http://127.0.0.1:3210

# If you get a response, Convex is running ✅
# If connection refused, start Convex ↓
```

### 2. Start Convex Backend (if needed)

```bash
# Terminal 1: From project root
cd /Users/SaintNick/Documents/Cortex/Project-Cortex
npm run dev:local

# Wait for: "Convex functions ready!"
# Server will be at: http://127.0.0.1:3210
```

### 3. Run Basic Tests

```bash
# Terminal 2: Activate Python environment
cd cortex-sdk-python
source .venv/bin/activate

# Run basic connectivity tests first
pytest tests/test_00_basic.py -v -s

# If those pass, run all tests
pytest -v
```

## Test Phases

### Phase 1: Basic Tests (test_00_basic.py)

These verify your environment is set up correctly:

- ✅ Environment variables loaded from .env.local
- ✅ All modules can be imported
- ✅ convex package is installed
- ✅ Cortex can be initialized
- ✅ Connection to Convex backend works

**Run first:**
```bash
pytest tests/test_00_basic.py -v -s
```

### Phase 2: API Tests

Once basic tests pass, run API-specific tests:

```bash
pytest tests/test_conversations.py -v
pytest tests/test_memory.py -v
pytest tests/test_users.py -v
```

### Phase 3: Full Suite

```bash
pytest -v
```

## Troubleshooting

### ImportError: No module named 'convex'

```bash
pip install convex
# Or
pip install -e ".[dev]"
```

### CONVEX_URL not set

```bash
# Check .env.local exists
ls -la /Users/SaintNick/Documents/Cortex/Project-Cortex/.env.local

# Check it has CONVEX_URL
cat /Users/SaintNick/Documents/Cortex/Project-Cortex/.env.local | grep CONVEX_URL
```

### Connection refused

```bash
# Convex backend not running
# Start it from project root:
cd /Users/SaintNick/Documents/Cortex/Project-Cortex
npm run dev:local
```

### Test failures

First check if basic tests pass:
```bash
pytest tests/test_00_basic.py -v -s
```

If basic tests fail, fix environment first.
If basic tests pass but others fail, it's likely API issues.

## Expected Test Run

```bash
$ pytest tests/test_00_basic.py -v -s

tests/test_00_basic.py::test_environment_variables 
CONVEX_URL: http://127.0.0.1:3210
✅ Environment variables loaded
PASSED

tests/test_00_basic.py::test_imports 
✅ All main imports successful
PASSED

tests/test_00_basic.py::test_convex_client_import 
✅ Convex client available
PASSED

tests/test_00_basic.py::test_cortex_initialization 
✅ Cortex initialized and closed successfully
PASSED

tests/test_00_basic.py::test_convex_connection 
✅ Convex connection successful
   Conversations found: 0
PASSED

======================== 5 passed in 0.5s ========================
```

If you see this, you're ready to run the full test suite!

---

**Quick Reference:**

1. Start Convex: `npm run dev:local` (from project root)
2. Activate env: `source .venv/bin/activate`
3. Basic tests: `pytest tests/test_00_basic.py -v -s`
4. Full tests: `pytest -v`

