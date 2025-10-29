# Cortex SDK Testing Guide

> **Quick Start**: See [DEV-QUICK-START.md](../dev-docs/DEV-QUICK-START.md) for fast setup
> 
> **Full Guide**: See [DEV-WORKFLOW-GUIDE.md](../dev-docs/DEV-WORKFLOW-GUIDE.md) for comprehensive documentation

## Dual Testing Strategy

The Cortex SDK supports testing against both **local** and **managed** Convex deployments to validate functionality differences and ensure compatibility across environments.

### Environment Configuration

Configure your `.env.local` file with the appropriate variables:

```bash
# Local Convex (for development)
LOCAL_CONVEX_DEPLOYMENT=anonymous:anonymous-cortex-sdk-local
LOCAL_CONVEX_URL=http://127.0.0.1:3210

# Managed Convex (for production-like testing)
CLOUD_CONVEX_URL=https://your-deployment.convex.cloud
CLOUD_CONVEX_DEPLOY_KEY=dev:your-deployment|your-key-here

# Active deployment (set automatically by dev-runner.mjs)
CONVEX_URL=http://127.0.0.1:3210  # or your cloud URL

# Optional: OpenAI API key for embedding tests
OPENAI_API_KEY=sk-...
```

**Note**: The new workflow uses `CLOUD_CONVEX_URL` and `CLOUD_CONVEX_DEPLOY_KEY` to distinguish cloud configuration from the active `CONVEX_URL`.

### Test Commands

#### Run All Tests (Auto-detect environment)

```bash
npm test
```

**Smart Dual Testing Behavior:**

- If **only local** config present → runs local tests
- If **only managed** config present → runs managed tests
- If **both configs** present → runs **BOTH** test suites sequentially (local then managed)
- This ensures comprehensive testing across all available environments

#### Test Against Local Convex

```bash
npm run test:local
```

- Uses `LOCAL_CONVEX_URL`
- **Note:** Vector search (`.similar()`) is NOT supported in local mode
- Falls back to manual cosine similarity calculation
- Ideal for rapid development iterations

#### Test Against Managed Convex

```bash
npm run test:managed
```

- Uses `CONVEX_URL`
- **Full vector search support** with `.similar()` API
- Tests production-like environment
- Validates optimized database vector indexing

#### Test Both Environments Sequentially (Explicit)

```bash
npm run test:both
```

- Explicitly runs `test:local` first, then `test:managed`
- Alternative to `npm test` when you want to force both test suites to run
- Validates compatibility across both deployment types
- Catches environment-specific issues
- **Note:** `npm test` automatically does this if both configs are detected

### Key Differences

| Feature                      | Local Convex       | Managed Convex        |
| ---------------------------- | ------------------ | --------------------- |
| Vector Search (`.similar()`) | ❌ Not supported   | ✅ Fully supported    |
| Cosine Similarity            | ✅ Manual fallback | ✅ Optimized DB-level |
| Performance                  | Slower (in-memory) | Faster (indexed)      |
| Startup Time                 | Fast               | Requires deployment   |
| Best For                     | Development        | Production testing    |

### GitHub Actions

For CI/CD, configure secrets:

**Local Testing (always available):**

- Runs automatically with local Convex backend

**Managed Testing (requires secrets):**

- `CONVEX_URL`: Your managed deployment URL
- `CONVEX_DEPLOY_KEY`: Deployment authentication key

Example workflow:

```yaml
- name: Test against local Convex
  run: npm run test:local

- name: Test against managed Convex
  run: npm run test:managed
  env:
    CONVEX_URL: ${{ secrets.CONVEX_URL }}
    CONVEX_DEPLOY_KEY: ${{ secrets.CONVEX_DEPLOY_KEY }}
```

### Manual Test Mode Selection

You can also manually override the test mode:

```bash
# Force local mode
CONVEX_TEST_MODE=local npm test

# Force managed mode
CONVEX_TEST_MODE=managed npm test
```

### Deployment Type Detection

Tests automatically detect the deployment type and adjust behavior:

```typescript
// In test code
const isLocal = process.env.CONVEX_DEPLOYMENT_TYPE === "local";
const isManaged = process.env.CONVEX_DEPLOYMENT_TYPE === "managed";

// Skip tests that require managed Convex features
if (isLocal) {
  test.skip("vector search with .similar() API", () => {
    // This test requires managed Convex
  });
}
```

### Troubleshooting

**Issue:** Tests fail with "CONVEX_URL not configured"

- **Solution:** Set either `LOCAL_CONVEX_URL` or `CONVEX_URL` in `.env.local`

**Issue:** "r.similar is not a function" error in local tests

- **Expected:** This is normal - local Convex doesn't support `.similar()`
- **Solution:** The code automatically falls back to manual cosine similarity

**Issue:** Slow test performance in local mode

- **Expected:** Manual similarity calculation is slower than indexed search
- **Solution:** Use `npm run test:managed` for production-like performance

## Additional Test Commands

- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate coverage report
- `npm run test:debug` - Run tests with detailed logging
- `npm run test:interactive` - Interactive test runner
