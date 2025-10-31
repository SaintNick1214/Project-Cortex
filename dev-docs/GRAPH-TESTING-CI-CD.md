# Graph Testing in CI/CD Pipelines

> **Status**: ✅ **Smart Skip Pattern Implemented**  
> **Result**: Graph tests automatically skip when no database configured

---

## ✅ Automatic Test Skipping

### How It Works

**All graph tests use smart skip pattern**:

```typescript
// In tests/env.ts
const graphTestingEnabled = Boolean(
  process.env.NEO4J_URI || process.env.MEMGRAPH_URI
);
process.env.GRAPH_TESTING_ENABLED = graphTestingEnabled ? "true" : "false";

// In all graph test files
const GRAPH_TESTING_ENABLED = process.env.GRAPH_TESTING_ENABLED === "true";
const describeIfEnabled = GRAPH_TESTING_ENABLED ? describe : describe.skip;

describeIfEnabled("Graph Adapter (Neo4j)", () => {
  // Tests only run if NEO4J_URI is set!
});
```

**Result**: Tests skip gracefully if graph databases aren't configured! ✅

---

## 🤖 CI/CD Behavior

### Scenario 1: No Graph Database (Default)

**Environment**: GitHub Actions, no graph DB configured  
**Environment Variables**: NEO4J_URI and MEMGRAPH_URI not set  

**What Happens**:
```
📊 Graph database testing DISABLED (no graph DB URIs configured)
   To enable: Set NEO4J_URI and/or MEMGRAPH_URI in .env.local

Test Suites: 3 passed, 3 total
Tests:       39 skipped, 0 passed, 39 total

✅ All test suites passed!
```

**Result**: All graph tests skip, CI passes ✅

### Scenario 2: With Graph Database

**Environment**: Local dev or CI with graph DB  
**Environment Variables**: NEO4J_URI=bolt://localhost:7687  

**What Happens**:
```
📊 Graph database testing ENABLED
   Neo4j: bolt://localhost:7687

Test Suites: 3 passed, 3 total
Tests:       5 skipped, 34 passed, 39 total

✅ All test suites passed!
```

**Result**: Graph tests run and pass ✅

---

## 💡 Recommendations for CI/CD

### Option 1: Skip Graph Tests (Recommended for Most Projects)

**Setup**: No configuration needed  
**Behavior**: Graph tests auto-skip  
**CI Time**: Fast (no graph DB startup)  
**Cost**: Free  

**Use when**:
- Graph is optional feature
- Users can test locally if using graph
- CI focuses on core Cortex features

### Option 2: Neo4j in Docker (For Complete CI Coverage)

**Add to GitHub Actions workflow**:

```yaml
name: Test with Graph

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      neo4j:
        image: neo4j:5-community
        env:
          NEO4J_AUTH: neo4j/test-password
        ports:
          - 7687:7687
        options: >-
          --health-cmd "cypher-shell -u neo4j -p test-password 'RETURN 1'"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '22'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run all tests (including graph)
        env:
          NEO4J_URI: bolt://localhost:7687
          NEO4J_USERNAME: neo4j
          NEO4J_PASSWORD: test-password
        run: npm test
```

**Result**: All 34 graph tests run in CI ✅

### Option 3: Cloud Graph DB (For Production CI)

**Setup**:
- Use Neo4j Aura free tier
- Or Memgraph Cloud free tier
- Store connection string in GitHub Secrets

**GitHub Actions**:
```yaml
- name: Run all tests
  env:
    NEO4J_URI: ${{ secrets.NEO4J_AURA_URI }}
    NEO4J_USERNAME: ${{ secrets.NEO4J_USERNAME }}
    NEO4J_PASSWORD: ${{ secrets.NEO4J_PASSWORD }}
  run: npm test
```

**Pros**: Persistent graph database  
**Cons**: Requires cloud account  

---

## 🎯 Current CI/CD Status

### ✅ Smart Defaults Work Perfectly

**Without configuration**:
- Graph tests skip automatically
- CI passes
- Zero configuration needed
- Users who don't use graph aren't affected

**With configuration**:
- Set NEO4J_URI in environment
- Graph tests run automatically
- Full validation

**This is the ideal pattern!** ✅

---

## 📝 Documentation for Users

### For CI/CD Pipelines

**Default (no graph)**:
```yaml
# No setup needed - graph tests auto-skip
- run: npm test
```

**With graph (Docker)**:
```yaml
services:
  neo4j:
    image: neo4j:5-community
    env:
      NEO4J_AUTH: neo4j/password
    ports:
      - 7687:7687

steps:
  - run: npm test
    env:
      NEO4J_URI: bolt://localhost:7687
      NEO4J_USERNAME: neo4j
      NEO4J_PASSWORD: password
```

**With graph (Cloud)**:
```yaml
- run: npm test
  env:
    NEO4J_URI: ${{ secrets.NEO4J_URI }}
    NEO4J_USERNAME: ${{ secrets.NEO4J_USERNAME }}
    NEO4J_PASSWORD: ${{ secrets.NEO4J_PASSWORD }}
```

---

## ✅ Conclusion

**We were smart!** ✅

All graph tests use the `describeIfEnabled` pattern which:
- Automatically detects graph database availability
- Skips gracefully if not configured
- Runs fully if configured
- Zero CI configuration needed for default case
- Easy to enable if desired

**CI/CD pipelines will work perfectly out of the box!** 🎉

---

**Recommendation**: 
- Default CI: Let graph tests skip (fast, free, works)
- Advanced CI: Add Neo4j Docker service (complete coverage)
- Production CI: Use cloud graph DB (persistent)

All three approaches work with existing test infrastructure!

