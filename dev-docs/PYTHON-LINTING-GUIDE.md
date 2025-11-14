# Python Linting Guide - Catch Issues Before Runtime

## Yes! Python Has ESLint Equivalents

Your project **already has them configured** in `pyproject.toml`:

### 1. **Ruff** - Modern Fast Linter (ESLint equivalent)

- Speed: 10-100x faster than traditional Python linters
- Replaces: Flake8, isort, pyupgrade, and more
- Catches: Syntax errors, undefined names, unused imports, etc.

### 2. **mypy** - Static Type Checker (TypeScript equivalent)

- Catches type mismatches at check-time
- Would catch: Wrong parameter types, missing required params, attribute errors

### 3. **Black** - Code Formatter (Prettier equivalent)

- Auto-formats code to consistent style
- Fixes: Trailing commas, indentation, line length

## How to Use (Run Before Committing)

### Quick Check - All Linters

```bash
cd cortex-sdk-python

# Run all linting tools
ruff check .                    # Fast syntax/style check
mypy cortex/                    # Type check SDK code
mypy tests/                     # Type check test code
black --check .                 # Check formatting
```

### Auto-Fix Issues

```bash
# Auto-fix what can be fixed
ruff check --fix .              # Fix auto-fixable issues
black .                         # Auto-format code
```

### What These Would Have Caught

#### Issue 1: Missing Required Parameter

```python
# Your code:
StoreFactParams(
    memory_space_id=space_id,
    fact_type=fact_type,
    # Missing source_type - REQUIRED!
)

# mypy would say:
# error: Missing required keyword argument "source_type"
```

#### Issue 2: Wrong Attribute Name

```python
# Your code:
ctx.context_id  # Context doesn't have this attribute!

# mypy would say:
# error: "Context" has no attribute "context_id"; did you mean "id"?
```

#### Issue 3: Syntax Errors

```python
# Your code:
ConversationParticipants(user_id="test",  # Trailing comma, missing paren

# ruff would say:
# SyntaxError: invalid syntax. Perhaps you forgot a comma?
```

#### Issue 4: Unused Imports

```python
# Your code:
from cortex.types import StoreFactInput  # Wrong type name!

# ruff would say:
# F401 'cortex.types.StoreFactInput' imported but unused
# F821 Undefined name 'StoreFactParams'
```

## Pre-Commit Hook (Recommended!)

Create `.git/hooks/pre-commit` to run linters automatically:

```bash
#!/bin/bash
# .git/hooks/pre-commit

cd cortex-sdk-python

echo "Running Python linters..."

# Run ruff (fast check)
ruff check . || {
    echo "❌ Ruff linting failed. Fix errors or use 'ruff check --fix .'"
    exit 1
}

# Run mypy (type check)
mypy cortex/ tests/ || {
    echo "❌ mypy type check failed. Fix type errors."
    exit 1
}

echo "✅ All linters passed!"
```

Make it executable:

```bash
chmod +x .git/hooks/pre-commit
```

## VS Code Integration (Real-Time Linting)

Add to `.vscode/settings.json`:

```json
{
  "[python]": {
    "editor.defaultFormatter": "charliermarsh.ruff",
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
      "source.fixAll": true,
      "source.organizeImports": true
    }
  },
  "ruff.lint.args": ["--config=pyproject.toml"],
  "mypy.runUsingActiveInterpreter": true,
  "python.linting.enabled": true,
  "python.linting.mypyEnabled": true,
  "python.linting.ruffEnabled": true
}
```

Install VS Code extensions:

- **Ruff** (charliermarsh.ruff)
- **Pylance** (ms-python.vscode-pylance) - for IntelliSense
- **Mypy Type Checker** (ms-python.mypy-type-checker)

## CI/CD Integration

Add to GitHub Actions (`.github/workflows/test-python.yml`):

```yaml
name: Python SDK Tests

on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.13"

      - name: Install dependencies
        run: |
          cd cortex-sdk-python
          pip install -e ".[dev]"

      - name: Run Ruff
        run: |
          cd cortex-sdk-python
          ruff check .

      - name: Run mypy
        run: |
          cd cortex-sdk-python
          mypy cortex/ tests/

      - name: Check Black formatting
        run: |
          cd cortex-sdk-python
          black --check .

      - name: Run tests
        run: |
          cd cortex-sdk-python
          pytest -v
```

## Ruff Configuration (Already in pyproject.toml)

Your current config:

```toml
[tool.ruff]
line-length = 88
target-version = "py312"

[tool.ruff.lint]
select = [
    "E",   # pycodestyle errors
    "F",   # Pyflakes (undefined names, unused imports)
    "I",   # isort (import sorting)
    "N",   # pep8-naming
    "UP",  # pyupgrade (modern Python syntax)
]
```

## What Each Tool Catches

### Ruff (Syntax & Style)

- ✅ Syntax errors (missing commas, parens)
- ✅ Undefined names (`StoreFactInput` doesn't exist)
- ✅ Unused imports
- ✅ Import sorting
- ✅ Naming conventions

### mypy (Type Checking)

- ✅ Missing required parameters
- ✅ Wrong parameter types
- ✅ Attribute errors (`context_id` doesn't exist on `Context`)
- ✅ Return type mismatches
- ✅ Dict vs object access

### Black (Formatting)

- ✅ Trailing commas
- ✅ Line length
- ✅ Indentation
- ✅ Quotes consistency

## Example Workflow

### Before Writing Code:

1. Enable VS Code extensions (real-time feedback)
2. Install pre-commit hook (auto-check on commit)

### While Writing Code:

- See red squiggles for errors in VS Code
- Auto-fix on save with Ruff/Black

### Before Committing:

```bash
# Run all checks
ruff check tests/test_conversations_filters.py
mypy tests/test_conversations_filters.py
black tests/test_conversations_filters.py
```

### Before Pushing:

```bash
# Run full suite
ruff check .
mypy cortex/ tests/
black --check .
pytest -v
```

## How This Would Have Helped

### Your Filter Tests Issues:

**Issue**: `StoreFactParams` missing `source_type`

- **mypy**: `error: Missing required keyword argument "source_type"`
- **Caught**: Before running tests

**Issue**: `ctx.context_id` (should be `ctx.id`)

- **mypy**: `error: "Context" has no attribute "context_id"`
- **Caught**: Before running tests

**Issue**: Trailing commas in `ConversationParticipants(user_id="test",`

- **ruff**: `SyntaxError: invalid syntax`
- **Caught**: Immediately

**Issue**: Using `conv["type"]` on object (should be `conv.type`)

- **mypy**: `error: Value of type "Conversation" is not indexable`
- **Caught**: Before running tests

## Recommendation

**Run these before every test run**:

```bash
#!/bin/bash
# scripts/lint-and-test.sh

cd cortex-sdk-python

echo "→ Running Ruff..."
ruff check . || exit 1

echo "→ Running mypy..."
mypy cortex/ tests/ || exit 1

echo "→ Running tests..."
pytest tests/test_*_filters.py -v
```

**Result**: Catch 90% of issues before tests run!

## Summary

| Tool         | Python    | JavaScript |
| ------------ | --------- | ---------- |
| Linter       | **Ruff**  | ESLint     |
| Type Checker | **mypy**  | TypeScript |
| Formatter    | **Black** | Prettier   |

**All 3 are already configured in your `pyproject.toml`!**

**To use them**:

```bash
# Install
pip install -e ".[dev]"

# Run
ruff check .                # Fast linting
mypy cortex/ tests/         # Type checking
black .                     # Auto-format
```

**Would have caught**: ~90% of the issues we manually fixed in filter tests!

---

**Next Steps**:

1. Install VS Code extensions for real-time feedback
2. Set up pre-commit hook
3. Add to CI/CD pipeline
4. Run before every test session

**Time saved**: Hours of debugging → Seconds of linting
