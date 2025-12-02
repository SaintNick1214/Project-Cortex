# Testing Guide for create-cortex-memories

## Local Testing

### Method 1: Test Directly (Recommended)

```bash
# From the create-cortex-memories directory
cd packages/create-cortex-memories

# Run the wizard directly
node dist/index.js test-project
```

### Method 2: Test via npm link

```bash
# From the create-cortex-memories directory
npm link

# From anywhere
npm create cortex-memories@latest test-project

# Clean up when done
npm unlink -g create-cortex-memories
```

### Method 3: Test in Isolated Directory

```bash
# Create test directory
mkdir -p /tmp/cortex-test
cd /tmp/cortex-test

# Run wizard (assuming you're in the repo root)
node "$REPO_ROOT/packages/create-cortex-memories/dist/index.js" my-test-app

# Verify output
ls -la my-test-app
```

## Test Scenarios

### Scenario 1: Local Convex Setup

```bash
node dist/index.js test-local-convex
```

**Expected wizard flow:**

1. Project name: `test-local-convex`
2. Installation type: New project
3. Convex setup: Choose "Local development"
4. Graph database: Skip
5. Confirmation: Proceed

**Expected output:**

- ✓ Project files created
- ✓ Convex configured for local
- ✓ .env.local with LOCAL_CONVEX_URL
- ✓ Dependencies installed
- ✓ Cortex backend deployed

**Verify:**

```bash
cd test-local-convex
ls -la  # Should see: src/, convex/, package.json, .env.local, README.md
cat .env.local  # Should contain LOCAL_CONVEX_URL
cat convex/schema.ts  # Should exist
npm run dev  # Should start Convex
```

### Scenario 2: Existing Directory

```bash
mkdir existing-project
cd existing-project
node ../dist/index.js .
```

**Expected wizard flow:**

1. Project name: `existing-project` (detected)
2. Add to existing: Yes
3. Convex setup: Choose option
4. Continue...

### Scenario 3: New Cloud Convex

```bash
node dist/index.js test-cloud-convex
```

**Expected wizard flow:**

1. Project name: `test-cloud-convex`
2. Convex setup: Choose "Create new Convex database"
3. **Should launch Convex CLI login flow**
4. Continue after successful setup

**Requirements:**

- Internet connection
- Convex account (or willingness to create one)

### Scenario 4: With Graph Database

```bash
node dist/index.js test-with-graph
```

**Expected wizard flow:**

1. Standard setup
2. Graph database: Choose "Enable"
3. Graph type: Choose "Neo4j"
4. Deployment: Choose "Local (Docker Compose)"

**Expected output:**

- ✓ docker-compose.graph.yml created
- ✓ neo4j-driver in package.json
- ✓ NEO4J\_\* variables in .env.local
- ✓ src/graph-init.example.ts created

## Validation Checklist

After running the wizard, verify:

- [ ] Project directory created
- [ ] package.json exists with correct name
- [ ] src/index.ts exists with example code
- [ ] convex/ directory with all backend files:
  - [ ] schema.ts
  - [ ] conversations.ts
  - [ ] immutable.ts
  - [ ] mutable.ts
  - [ ] memories.ts
  - [ ] facts.ts
  - [ ] contexts.ts
  - [ ] memorySpaces.ts
  - [ ] users.ts
  - [ ] agents.ts
  - [ ] graphSync.ts
- [ ] .env.local with correct configuration
- [ ] .gitignore exists
- [ ] README.md with project-specific instructions
- [ ] node_modules/ populated
- [ ] convex.json exists

## Common Issues

### Issue: "Could not locate @cortexmemory/sdk"

**Cause:** SDK not installed or not built  
**Solution:**

```bash
# From the repo root
npm run build
npm link
```

### Issue: "convex-dev not found"

**Cause:** convex-dev folder not in SDK package  
**Solution:** Verify package.json includes convex-dev in files array

### Issue: Wizard hangs during Convex setup

**Cause:** Convex CLI waiting for input  
**Solution:** Follow prompts in terminal, may need to login to Convex

### Issue: npm install fails in generated project

**Cause:** Network issues or missing dependencies  
**Solution:** Check internet connection, verify package.json

## Automated Testing (Future)

For CI/CD, we can add:

- Mock Convex responses
- Snapshot testing for generated files
- Integration tests with test Convex instances

## Clean Up Test Projects

```bash
# Remove all test projects
rm -rf test-*
rm -rf /tmp/cortex-test
```
