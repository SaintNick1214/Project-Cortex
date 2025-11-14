# PyPI Trusted Publisher Setup Guide

## Step-by-Step Instructions

### Step 1: Complete Organization Setup (Your Current Form)

Fill out the organization form with:

**Organization Account Name:** `cortexmemory`  
**Organization Display Name:** `Cortex Memory`  
**Organization URL:** `https://github.com/SaintNick1214/Project-Cortex`  
**Organization Description:**
```
AI agent memory SDK built on Convex. Provides ACID storage, vector search, conversation management, and knowledge graphs for building agents with persistent, infinite-context memory.
```

**Organization Membership Size:** Select your team size  
**Anticipated Usage:**
```
Publishing the official Cortex Memory Python SDK to provide Python developers with the same powerful memory capabilities available in the TypeScript SDK. The package enables AI agents to remember conversations, search semantically, extract facts, and maintain context across interactions.
```

**Organization Type:** `Company`

### Step 2: Add Trusted Publisher (After Org Approval)

Navigate to: https://pypi.org/manage/account/publishing/

Click "Add a new publisher" and fill in:

**PyPI Project Name:** `cortex-memory`

**Owner:** `SaintNick1214`

**Repository name:** `Project-Cortex`

**Workflow name:** `publish-python.yml`

**Environment name:** `pypi`

Click "Add"

### Step 3: Configure GitHub Environment

1. Go to: https://github.com/SaintNick1214/Project-Cortex/settings/environments
2. Click "New environment"
3. Name: `pypi`
4. **Environment protection rules** (recommended):
   - ✅ Required reviewers: You
   - ✅ Deployment branches: `main` only
5. Click "Save protection rules"

## How Releases Will Work

Once setup is complete:

```bash
# 1. Update version in pyproject.toml (already done: 0.9.0)

# 2. Tag and push
git tag py-v0.9.0 -m "Python SDK v0.9.0 release"
git push origin py-v0.9.0

# 3. GitHub Actions automatically:
#    ✅ Runs all 579 tests
#    ✅ Builds wheel and sdist
#    ✅ Publishes to PyPI
#    ✅ No API tokens needed!
```

## What's Already Configured

✅ Package built and validated:
- `cortex_memory-0.9.0-py3-none-any.whl` (67KB)
- `cortex_memory-0.9.0.tar.gz` (64KB)

✅ GitHub Actions workflow created:
- `.github/workflows/publish-python.yml`

✅ Package metadata complete:
- Name: `cortex-memory`
- Version: `0.9.0`
- Python: `>=3.10`
- All dependencies specified

## Next Steps

1. **Complete the organization form** (your current screenshot)
2. **Wait for approval** (usually same day)
3. **Add trusted publisher** (Step 2 above)
4. **Create GitHub environment** (Step 3 above)
5. **Test the pipeline:**
   ```bash
   git tag py-v0.9.0
   git push origin py-v0.9.0
   ```

## Installation After Release

Users will install with:

```bash
pip install cortex-memory
pip install cortex-memory[graph]  # With Neo4j support
pip install cortex-memory[all]    # All optional features
```

## Comparison with npm

| Feature | npm | PyPI |
|---------|-----|------|
| **Scoped packages** | ✅ `@cortexmemory/sdk` | ❌ No scopes |
| **Package name** | `@cortexmemory/sdk` | `cortex-memory` |
| **Install command** | `npm install @cortexmemory/sdk` | `pip install cortex-memory` |
| **Trusted publishing** | ✅ Supported | ✅ Supported |
| **Auto publish on tag** | ✅ Yes | ✅ Yes |

Both use the same modern, secure workflow!

---

**Questions?** Check `PYPI-RELEASE-GUIDE.md` or contact support@cortexmemory.dev

