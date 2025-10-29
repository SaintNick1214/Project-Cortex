# Development Workflow Guide

Complete guide to local and cloud development with the Cortex SDK.

## 🎯 Quick Start

```bash
# Auto-detect configuration and start development
npm run dev

# Force local development only
npm run dev:local

# Force cloud development only
npm run dev:cloud
```

## 📋 Table of Contents

- [Overview](#overview)
- [Configuration](#configuration)
- [Development Modes](#development-modes)
- [Testing](#testing)
- [Common Workflows](#common-workflows)
- [Troubleshooting](#troubleshooting)

---

## Overview

Cortex SDK supports **dual-deployment development**:

- **LOCAL**: Anonymous local Convex dev server (fast iteration, no vector search)
- **CLOUD**: Managed Convex deployment (full features including vector search)

The `dev-runner.mjs` script automatically detects your configuration and starts the appropriate development environment.

### What Each Mode Does

| Mode | Convex Server | Dashboard | Vector Search | Best For |
|------|---------------|-----------|---------------|----------|
| **LOCAL** | Starts local server | Opens local dashboard | ❌ Not supported | Rapid iteration, debugging |
| **CLOUD** | Connects to managed | Opens cloud dashboard | ✅ Full support | Vector search testing, production-like |

---

## Configuration

All configuration happens in `.env.local`. The file is structured with clear sections:

### `.env.local` Structure

```env
# =============================================================================
# LOCAL DEVELOPMENT
# =============================================================================
LOCAL_CONVEX_DEPLOYMENT=anonymous:anonymous-cortex-sdk-local
LOCAL_CONVEX_URL=http://127.0.0.1:3210

# =============================================================================
# CLOUD DEVELOPMENT  
# =============================================================================
CLOUD_CONVEX_URL=https://your-deployment.convex.cloud
CLOUD_CONVEX_DEPLOY_KEY=dev:your-deployment|your-key-here

# =============================================================================
# OPENAI API KEY (Optional)
# =============================================================================
OPENAI_API_KEY=sk-...

# =============================================================================
# ACTIVE DEPLOYMENT (Auto-managed - DO NOT EDIT)
# =============================================================================
CONVEX_DEPLOYMENT=anonymous:anonymous-cortex-sdk-local
CONVEX_URL=http://127.0.0.1:3210
```

### Getting Cloud Credentials

1. **Sign up for Convex**: https://www.convex.dev
2. **Create a project** in the Convex dashboard
3. **Get your deployment URL**: 
   - Format: `https://your-deployment.convex.cloud`
4. **Generate a deploy key**:
   - Go to Settings → Deploy Keys
   - Create a new dev deploy key
   - Format: `dev:your-deployment|your-key-here`

### Configuration Examples

<details>
<summary><b>Local Only (Default)</b></summary>

```env
# Minimal config for local development
LOCAL_CONVEX_DEPLOYMENT=anonymous:anonymous-cortex-sdk-local
LOCAL_CONVEX_URL=http://127.0.0.1:3210

CONVEX_DEPLOYMENT=anonymous:anonymous-cortex-sdk-local
CONVEX_URL=http://127.0.0.1:3210
```

**Usage**: `npm run dev` automatically uses local mode

</details>

<details>
<summary><b>Cloud Only</b></summary>

```env
# Managed deployment only
CLOUD_CONVEX_URL=https://expert-buffalo-268.convex.cloud
CLOUD_CONVEX_DEPLOY_KEY=dev:expert-buffalo-268|eyJ2MiI6ImMzM...

CONVEX_URL=https://expert-buffalo-268.convex.cloud
```

**Usage**: `npm run dev` automatically uses cloud mode

</details>

<details>
<summary><b>Both Local and Cloud (Recommended)</b></summary>

```env
# Full dual-deployment setup
LOCAL_CONVEX_DEPLOYMENT=anonymous:anonymous-cortex-sdk-local
LOCAL_CONVEX_URL=http://127.0.0.1:3210

CLOUD_CONVEX_URL=https://expert-buffalo-268.convex.cloud
CLOUD_CONVEX_DEPLOY_KEY=dev:expert-buffalo-268|eyJ2MiI6ImMzM...

# Default to local for rapid iteration
CONVEX_DEPLOYMENT=anonymous:anonymous-cortex-sdk-local
CONVEX_URL=http://127.0.0.1:3210
```

**Usage**: 
- `npm run dev` uses local by default
- `npm run dev:cloud` switches to cloud
- Tests run against both automatically

</details>

---

## Development Modes

### 🚀 Auto Mode: `npm run dev`

**Behavior**:
1. Detects available configuration in `.env.local`
2. Prefers LOCAL if available, falls back to CLOUD
3. Starts Convex dev server
4. Opens dashboard in browser
5. Watches for changes

**Example Output**:
```
🔍 Detecting available Convex configurations...
   Local config: ✅ Found
   Cloud config: ✅ Found
   Mode: AUTO → detected LOCAL configuration

======================================================================
🚀 Starting Convex LOCAL development server...
   URL: http://127.0.0.1:3210
======================================================================

✅ Convex LOCAL server started

📊 Opening Convex LOCAL dashboard...

======================================================================
✨ Development environment ready!
======================================================================

📝 Mode: LOCAL
🌐 URL: http://127.0.0.1:3210

💡 Available commands:
   npm run test              → run tests against active deployment
   npm run test:interactive  → interactive test runner
   npm run logs              → view deployment logs
   npm run dev:cloud         → switch to cloud mode

🔄 Watching for changes...
   Press Ctrl+C to stop
```

### 🏠 Local Mode: `npm run dev:local`

**Explicit local development only**

**Requirements**:
- `LOCAL_CONVEX_URL` must be set in `.env.local`
- Local Convex dev server available

**Starts**:
- Local anonymous Convex deployment
- Local dashboard at `http://127.0.0.1:3210`

**Limitations**:
- ❌ No vector search (`.similar()` not available)
- ❌ No production-like features

**Best For**:
- Fast iteration cycles
- Basic CRUD operations
- Conversation management
- Debugging

**Example**:
```bash
npm run dev:local
# Opens: http://127.0.0.1:3210/_admin
```

### ☁️ Cloud Mode: `npm run dev:cloud`

**Explicit managed deployment only**

**Requirements**:
- `CLOUD_CONVEX_URL` must be set in `.env.local`
- `CLOUD_CONVEX_DEPLOY_KEY` must be set
- Active Convex cloud deployment

**Starts**:
- Connection to managed Convex deployment
- Cloud dashboard for your deployment

**Features**:
- ✅ Full vector search support
- ✅ Production-like environment
- ✅ All Convex features enabled

**Best For**:
- Testing vector/semantic search
- Production-readiness verification
- Advanced features testing
- Performance testing

**Example**:
```bash
npm run dev:cloud
# Opens: https://dashboard.convex.dev
```

---

## Testing

Tests automatically adapt to your configuration and can run against both deployments.

### Test Commands

| Command | Behavior |
|---------|----------|
| `npm test` | Auto-detect: runs against available deployment(s) |
| `npm run test:local` | Force local tests only |
| `npm run test:managed` | Force cloud tests only |
| `npm run test:both` | Explicitly run both suites |
| `npm run test:interactive` | Interactive test runner (uses CONVEX_URL) |
| `npm run test:interactive:local` | Interactive runner against local |
| `npm run test:interactive:cloud` | Interactive runner against cloud |

### Dual Testing Strategy

When **both** LOCAL and CLOUD configs are present, `npm test` runs **TWO test suites**:

```bash
npm test

# Output:
🔍 Detecting available Convex configurations...
   Local config: ✅ Found
   Managed config: ✅ Found
   Test mode: auto

🎯 Both configurations detected - running DUAL TEST SUITE
   Tests will run against both local AND managed environments

============================================================
🚀 Running LOCAL tests...
============================================================
... (local test results) ...
✅ LOCAL tests completed successfully

============================================================
🚀 Running MANAGED tests...
============================================================
... (managed test results) ...
✅ MANAGED tests completed successfully

============================================================
🎉 SUCCESS: All test suites passed!
   ✅ Local tests: PASSED
   ✅ Managed tests: PASSED
============================================================
```

### Test Configuration Detection

The test runner (`scripts/test-runner.mjs`) automatically detects:

| LOCAL Config | CLOUD Config | Test Behavior |
|--------------|--------------|---------------|
| ✅ Present | ❌ Not present | Runs LOCAL tests only |
| ❌ Not present | ✅ Present | Runs CLOUD tests only |
| ✅ Present | ✅ Present | Runs BOTH test suites |
| ❌ Not present | ❌ Not present | ❌ Error: No config found |

### Override Auto-Detection

Force specific test mode with `CONVEX_TEST_MODE`:

```bash
# Force local even if both configs present
CONVEX_TEST_MODE=local npm test

# Force managed even if both configs present  
CONVEX_TEST_MODE=managed npm test
```

---

## Common Workflows

### 🔧 Scenario 1: Local Development (Default)

**Goal**: Fast iteration on SDK features without vector search

**Setup**:
```env
# .env.local
LOCAL_CONVEX_URL=http://127.0.0.1:3210
LOCAL_CONVEX_DEPLOYMENT=anonymous:anonymous-cortex-sdk-local
CONVEX_URL=http://127.0.0.1:3210
```

**Workflow**:
```bash
# Start development
npm run dev

# Make code changes...

# Run tests
npm test

# View logs
npm run logs:local
```

**Advantages**:
- ⚡ Instant deployment (no network latency)
- 🔒 Private (no data sent to cloud)
- 💰 Free (no cloud resources)

**Limitations**:
- ❌ No vector search testing
- ❌ Some features behave differently

---

### 🌩️ Scenario 2: Cloud Development

**Goal**: Test vector search and production-like features

**Setup**:
```env
# .env.local
CLOUD_CONVEX_URL=https://expert-buffalo-268.convex.cloud
CLOUD_CONVEX_DEPLOY_KEY=dev:expert-buffalo-268|eyJ2MiI6...
CONVEX_URL=https://expert-buffalo-268.convex.cloud
```

**Workflow**:
```bash
# Start cloud development
npm run dev:cloud

# Make code changes...

# Run tests (includes vector search)
npm test

# View logs
npm run logs:cloud
```

**Advantages**:
- ✅ Full vector search support
- ✅ Production-like environment
- ✅ All features enabled

**Trade-offs**:
- ⏱️ Network latency on deploys
- 💰 Uses cloud resources

---

### 🔄 Scenario 3: Hybrid Development (Recommended)

**Goal**: Fast local iteration + cloud verification

**Setup**:
```env
# .env.local - BOTH configurations
LOCAL_CONVEX_DEPLOYMENT=anonymous:anonymous-cortex-sdk-local
LOCAL_CONVEX_URL=http://127.0.0.1:3210

CLOUD_CONVEX_URL=https://expert-buffalo-268.convex.cloud
CLOUD_CONVEX_DEPLOY_KEY=dev:expert-buffalo-268|eyJ2MiI6...

# Default to local
CONVEX_URL=http://127.0.0.1:3210
```

**Daily Workflow**:

```bash
# Morning: Start local for fast iteration
npm run dev:local

# Make changes, run local tests frequently
npm run test:local  # Fast feedback loop

# Afternoon: Switch to cloud for vector search testing
# Stop local (Ctrl+C), then:
npm run dev:cloud

# Run full test suite (both environments)
npm test  # Runs against LOCAL then CLOUD

# Verify vector search features work
npm run test:interactive:cloud
```

**Why This Works**:
1. **Local first** → fast iteration, no network latency
2. **Cloud verification** → ensures production features work
3. **Dual testing** → confidence in both environments
4. **Easy switching** → one command to change modes

---

### 🧪 Scenario 4: Interactive Testing

**Goal**: Manual testing with immediate feedback

**Workflow**:

```bash
# Start dev environment (local or cloud)
npm run dev:local  # or npm run dev:cloud

# In another terminal, start interactive runner
npm run test:interactive

# Follow the menu prompts to:
# - Create conversations
# - Store memories
# - Search semantically (cloud only)
# - Inspect storage
# - Clean up test data
```

**Interactive Runner Features**:
- 📝 Step-by-step guided testing
- 🔍 Storage inspection tools
- 🧹 Automatic cleanup
- 💡 Shows what's possible in current mode
- ⚠️ Skips unavailable features gracefully

---

## Troubleshooting

### ❌ Error: "No Convex configuration found"

**Problem**: `.env.local` is missing or incomplete

**Solution**:
```bash
# Create .env.local with at least one configuration:

# Option A: Local only (quick start)
cat > .env.local << 'EOF'
LOCAL_CONVEX_URL=http://127.0.0.1:3210
LOCAL_CONVEX_DEPLOYMENT=anonymous:anonymous-cortex-sdk-local
CONVEX_URL=http://127.0.0.1:3210
EOF

# Option B: Cloud only (requires Convex account)
# Get credentials from https://dashboard.convex.dev
cat > .env.local << 'EOF'
CLOUD_CONVEX_URL=https://your-deployment.convex.cloud
CLOUD_CONVEX_DEPLOY_KEY=dev:your-deployment|your-key
CONVEX_URL=https://your-deployment.convex.cloud
EOF
```

---

### ❌ Error: "LOCAL mode requested but configuration not found"

**Problem**: Ran `npm run dev:local` without LOCAL config

**Solution**:
```env
# Add to .env.local:
LOCAL_CONVEX_URL=http://127.0.0.1:3210
LOCAL_CONVEX_DEPLOYMENT=anonymous:anonymous-cortex-sdk-local
```

---

### ❌ Error: "CLOUD mode requested but configuration not found"

**Problem**: Ran `npm run dev:cloud` without CLOUD config

**Solution**:
1. Go to https://dashboard.convex.dev
2. Create a project
3. Get deployment URL and deploy key
4. Add to `.env.local`:
```env
CLOUD_CONVEX_URL=https://your-deployment.convex.cloud
CLOUD_CONVEX_DEPLOY_KEY=dev:your-deployment|your-key
```

---

### ⚠️ Warning: Vector search fails in local mode

**Problem**: Test tries to use `.similar()` in local mode

**Expected**: Local Convex doesn't support vector search

**Solutions**:
- **Option A**: Switch to cloud mode
  ```bash
  npm run dev:cloud
  npm run test:managed
  ```
- **Option B**: Skip vector tests in local mode
  ```javascript
  const isLocal = process.env.CONVEX_DEPLOYMENT_TYPE === 'local';
  if (isLocal) {
    console.log('Skipping vector search test in local mode');
    return;
  }
  ```

---

### 🐛 Tests fail with "CONVEX_URL not set"

**Problem**: Environment not loaded properly

**Solution**:
```bash
# Ensure .env.local exists and has CONVEX_URL
cat .env.local | grep CONVEX_URL

# Should output:
# CONVEX_URL=http://127.0.0.1:3210  (or your cloud URL)

# If missing, add it:
echo "CONVEX_URL=http://127.0.0.1:3210" >> .env.local
```

---

### 🔄 Switching Between Modes

**Problem**: Want to switch from local to cloud (or vice versa)

**Solution**:
```bash
# Stop current dev server (Ctrl+C)

# Start new mode:
npm run dev:local   # Switch to local
# OR
npm run dev:cloud   # Switch to cloud
```

**Pro Tip**: Keep both configs in `.env.local` and switch with commands:
```bash
# Quick local → cloud → local workflow
npm run dev:local   # Morning: fast iteration
# ... Ctrl+C when ready ...
npm run dev:cloud   # Afternoon: vector testing
# ... Ctrl+C when done ...
npm run dev:local   # Back to local
```

---

## Advanced: Parallel Development (Future)

> **Note**: Not yet implemented. Planned for future release.

**Vision**: Run **both** local and cloud simultaneously in separate processes.

**Planned Commands**:
```bash
# Start both deployments
npm run dev:dual

# SDK connects to both:
# - Port 3210: Local
# - Port 3211: Cloud proxy

# Tests run against both in parallel
```

**Benefits**:
- Test local and cloud simultaneously
- Compare behavior in real-time
- Catch environment-specific bugs faster

**Status**: Designed but not implemented. Contributions welcome!

---

## Summary

### Quick Reference Card

| I Want To... | Command | Config Required |
|-------------|---------|-----------------|
| Start development (any) | `npm run dev` | LOCAL or CLOUD |
| Force local development | `npm run dev:local` | LOCAL only |
| Force cloud development | `npm run dev:cloud` | CLOUD only |
| Run tests | `npm test` | LOCAL or CLOUD |
| Interactive testing | `npm run test:interactive` | CONVEX_URL set |
| View logs | `npm run logs` | Active deployment |
| Test vector search | `npm run test:managed` | CLOUD required |

### Configuration Checklist

- [ ] `.env.local` exists
- [ ] At least one deployment configured (LOCAL or CLOUD)
- [ ] `CONVEX_URL` points to desired deployment
- [ ] (Optional) `OPENAI_API_KEY` for embedding tests
- [ ] (Cloud) `CLOUD_CONVEX_DEPLOY_KEY` is valid

### When to Use Each Mode

| Mode | Use When... |
|------|-------------|
| **LOCAL** | Rapid iteration, debugging, basic features |
| **CLOUD** | Vector search, production features, final testing |
| **HYBRID** | Daily development (local iteration + cloud verification) |

---

## Next Steps

1. **Configure your environment**: Edit `.env.local` with your deployment details
2. **Start developing**: Run `npm run dev` and start coding
3. **Write tests**: Use `npm run test:interactive` to verify features
4. **Deploy to cloud**: When ready, switch to `npm run dev:cloud` for final testing

**Need Help?**
- 📖 [Architecture Docs](../Documentation/04-architecture/01-system-overview.md)
- 🐛 [GitHub Issues](https://github.com/SaintNick1214/Project-Cortex/issues)
- 💬 [Discussions](https://github.com/SaintNick1214/Project-Cortex/discussions)

---

**Happy Coding! 🚀**

