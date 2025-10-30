# Development Quick Start

> **TL;DR**: Fast reference for daily development workflows

## 🚀 First Time Setup

```bash
# 1. Copy example config
cp .env.local.example .env.local  # (or create manually)

# 2. Configure for your needs:
# - LOCAL: Fast iteration (no vector search)
# - CLOUD: Full features (vector search enabled)

# 3. Start development
npm run dev
```

## 📝 Configuration (.env.local)

### Local Only (Fastest Setup)
```env
LOCAL_CONVEX_URL=http://127.0.0.1:3210
LOCAL_CONVEX_DEPLOYMENT=anonymous:anonymous-cortex-sdk-local
CONVEX_URL=http://127.0.0.1:3210
```

### Cloud Only (Full Features)
```env
CLOUD_CONVEX_URL=https://your-deployment.convex.cloud
CLOUD_CONVEX_DEPLOY_KEY=dev:your-deployment|your-key
CONVEX_URL=https://your-deployment.convex.cloud
```

### Both (Recommended)
```env
# Local
LOCAL_CONVEX_URL=http://127.0.0.1:3210
LOCAL_CONVEX_DEPLOYMENT=anonymous:anonymous-cortex-sdk-local

# Cloud
CLOUD_CONVEX_URL=https://your-deployment.convex.cloud
CLOUD_CONVEX_DEPLOY_KEY=dev:your-deployment|your-key

# Default to local for speed
CONVEX_URL=http://127.0.0.1:3210
```

## 🎯 Common Commands

### Development
```bash
npm run dev          # Auto-detect: prefers local if available
npm run dev:local    # Force local (fast iteration)
npm run dev:cloud    # Force cloud (full features)
```

### Testing
```bash
npm test                       # Auto: runs against available deployment(s)
npm run test:local             # Force local tests
npm run test:managed           # Force cloud tests
npm run test:interactive       # Interactive test runner
npm run test:interactive:local # Interactive against local
npm run test:interactive:cloud # Interactive against cloud
```

### Logs
```bash
npm run logs         # View deployment logs
npm run logs:local   # View local logs
npm run logs:cloud   # View cloud logs
```

## 🔄 Typical Workflow

### Morning: Local Development
```bash
npm run dev:local           # Start local Convex
# ... code changes ...
npm run test:local          # Quick test cycle
```

### Afternoon: Cloud Verification
```bash
# Ctrl+C to stop local
npm run dev:cloud           # Switch to cloud
npm test                    # Run full test suite (both)
npm run test:interactive:cloud  # Manual vector search testing
```

## 🆚 Local vs Cloud

| Feature | Local | Cloud |
|---------|-------|-------|
| **Speed** | ⚡ Instant | 🐌 Network latency |
| **Vector Search** | ❌ Not supported | ✅ Full support |
| **Cost** | 💚 Free | 💰 Uses credits |
| **Privacy** | 🔒 Fully private | ☁️ Data in cloud |
| **Production-like** | ❌ Limited | ✅ Identical |

**Recommendation**: Use local for iteration, cloud for verification.

## ❓ Quick Troubleshooting

### "No Convex configuration found"
**Fix**: Add to `.env.local`:
```env
LOCAL_CONVEX_URL=http://127.0.0.1:3210
CONVEX_URL=http://127.0.0.1:3210
```

### Vector search fails
**Cause**: Running local mode (doesn't support vector search)

**Fix**: Switch to cloud
```bash
npm run dev:cloud
npm run test:managed
```

### Tests hang or timeout
**Check**:
1. Is Convex running? (`npm run dev` in another terminal)
2. Is `CONVEX_URL` correct in `.env.local`?
3. For cloud: Is deploy key valid?

### Want to switch modes
```bash
# Stop current (Ctrl+C)
npm run dev:local  # or npm run dev:cloud
```

## 📚 Full Documentation

For complete details, see:
- [DEV-WORKFLOW-GUIDE.md](./DEV-WORKFLOW-GUIDE.md) - Comprehensive guide
- [DUAL_TESTING.md](../scripts/DUAL_TESTING.md) - Testing strategy
- [README.md](../README.md) - Project overview

## 🎓 Examples

<details>
<summary><b>Example: Test Vector Search on Cloud</b></summary>

```bash
# 1. Configure cloud in .env.local
CLOUD_CONVEX_URL=https://your-deployment.convex.cloud
CLOUD_CONVEX_DEPLOY_KEY=dev:your-deployment|key
OPENAI_API_KEY=sk-your-openai-key

# 2. Start cloud development
npm run dev:cloud

# 3. Run interactive test runner
npm run test:interactive:cloud

# 4. In the menu, choose:
#    - Create conversation
#    - Store memory with embedding
#    - Search semantically
#    - Verify results
```

</details>

<details>
<summary><b>Example: Fast Local Iteration</b></summary>

```bash
# 1. Configure local in .env.local
LOCAL_CONVEX_URL=http://127.0.0.1:3210
CONVEX_URL=http://127.0.0.1:3210

# 2. Start local development
npm run dev:local

# 3. Make code changes in src/

# 4. Run tests (auto-reloads on change)
npm run test:local

# 5. Iterate rapidly (no network latency!)
```

</details>

<details>
<summary><b>Example: Dual Testing (Both Environments)</b></summary>

```bash
# 1. Configure BOTH in .env.local
LOCAL_CONVEX_URL=http://127.0.0.1:3210
CLOUD_CONVEX_URL=https://your-deployment.convex.cloud
CLOUD_CONVEX_DEPLOY_KEY=dev:your-deployment|key

# 2. Run comprehensive test suite
npm test

# Output:
# 🚀 Running LOCAL tests...
# ✅ LOCAL tests completed successfully
# 🚀 Running MANAGED tests...
# ✅ MANAGED tests completed successfully
# 🎉 SUCCESS: All test suites passed!
```

</details>

---

**Ready to build?** Run `npm run dev` and start coding! 🚀

