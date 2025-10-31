# Graph Database Setup Guide

> **Last Updated**: 2025-10-30

Quick start guide to set up Neo4j **or** Memgraph locally for Cortex graph integration.

## Overview

This guide shows you how to set up a graph database for Cortex using Docker. 

**Choose ONE:**
- **Neo4j** (recommended for most users - stable, mature, large community)
- **Memgraph** (recommended for high performance - faster, in-memory)
- **Both** (only if you're testing the SDK itself across databases)

**Time to complete:** 5 minutes

**Prerequisites:**
- Docker Desktop installed and running
- Basic command line familiarity

## Quick Start (Single Database)

### Option A: Neo4j Only (Recommended)

From the Cortex project root directory:

```bash
# Start Neo4j
docker-compose -f docker-compose.graph.yml up -d neo4j

# Verify it's running
docker ps
```

You should see one container:
- `cortex-neo4j` (running on ports 7474, 7687)

### Option B: Memgraph Only (High Performance)

```bash
# Start Memgraph
docker-compose -f docker-compose.graph.yml up -d memgraph

# Verify it's running
docker ps
```

You should see one container:
- `cortex-memgraph` (running on ports 7688, 3001)

### Option C: Both Databases (SDK Testing Only)

> **Note**: Only run both if you're testing the SDK across different databases. Most users only need one.

```bash
# Start both Neo4j and Memgraph
docker-compose -f docker-compose.graph.yml up -d

# Verify both are running
docker ps
```

You should see two containers:
- `cortex-neo4j` (running on ports 7474, 7687)
- `cortex-memgraph` (running on ports 7688, 3001)

### 2. Wait for Startup

Both databases need 15-30 seconds to initialize on first run:

```bash
# Check Neo4j logs
docker logs cortex-neo4j

# Check Memgraph logs  
docker logs cortex-memgraph

# Wait for health check
docker-compose -f docker-compose.graph.yml ps
```

Look for `healthy` status in the STATE column.

### 3. Access Database UI

**If you started Neo4j:**
- URL: http://localhost:7474
- Username: `neo4j`
- Password: `cortex-dev-password`

**If you started Memgraph:**
- URL: http://localhost:3001
- Username: `memgraph`
- Password: `cortex-dev-password`

### 4. Verify Connection

**Neo4j Browser** (http://localhost:7474):
```cypher
// Run in query box
RETURN "Neo4j connected!" as message
```

**Memgraph Lab** (http://localhost:3001):
```cypher
// Run in query box
RETURN "Memgraph connected!" as message
```

### 5. Configure Environment Variables

Add to `.env.local` in the project root:

**If using Neo4j:**
```bash
# Neo4j Configuration
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=cortex-dev-password
```

**If using Memgraph:**
```bash
# Memgraph Configuration
MEMGRAPH_URI=bolt://localhost:7688
MEMGRAPH_USERNAME=memgraph
MEMGRAPH_PASSWORD=cortex-dev-password
```

**If using Both (SDK testing):**
```bash
# Neo4j Configuration
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=cortex-dev-password

# Memgraph Configuration
MEMGRAPH_URI=bolt://localhost:7688
MEMGRAPH_USERNAME=memgraph
MEMGRAPH_PASSWORD=cortex-dev-password
```

## Which Database Should I Choose?

### Neo4j (Recommended for Most Users)
✅ **Choose Neo4j if you want:**
- Proven, stable production database
- Large community and extensive documentation
- Future scalability (billions of nodes)
- Official support options
- Standard for graph databases

**Best for:** Production deployments, long-term projects, teams

### Memgraph (Recommended for Performance)
✅ **Choose Memgraph if you want:**
- Maximum query performance (in-memory)
- Real-time analytics
- Fast development experience
- Modern architecture

**Best for:** High-performance requirements, real-time use cases

### Both (SDK Contributors Only)
⚠️ **Only run both if you're:**
- Contributing to Cortex SDK development
- Testing SDK features across databases
- Benchmarking performance differences

**Not recommended for:** Application development (choose one!)

## Connection Details

### Neo4j

| Service | Value |
|---------|-------|
| **Bolt URI** | `bolt://localhost:7687` |
| **HTTP UI** | http://localhost:7474 |
| **Username** | `neo4j` |
| **Password** | `cortex-dev-password` |
| **Database** | `neo4j` (default) |

### Memgraph

| Service | Value |
|---------|-------|
| **Bolt URI** | `bolt://localhost:7688` |
| **Lab UI** | http://localhost:3001 |
| **Username** | `memgraph` |
| **Password** | `cortex-dev-password` |
| **Database** | N/A (single database) |

## Usage Commands

### Start/Stop Services

**Single Database (Neo4j or Memgraph):**
```bash
# Start Neo4j
docker-compose -f docker-compose.graph.yml up -d neo4j

# OR start Memgraph
docker-compose -f docker-compose.graph.yml up -d memgraph

# Stop (specify which one)
docker-compose -f docker-compose.graph.yml stop neo4j
docker-compose -f docker-compose.graph.yml stop memgraph

# Restart
docker-compose -f docker-compose.graph.yml restart neo4j
docker-compose -f docker-compose.graph.yml restart memgraph

# Remove (keeps data)
docker-compose -f docker-compose.graph.yml down

# Remove AND delete data (fresh start)
docker-compose -f docker-compose.graph.yml down -v
```

**Both Databases (SDK Testing):**
```bash
# Start both
docker-compose -f docker-compose.graph.yml up -d

# Stop both
docker-compose -f docker-compose.graph.yml stop

# Restart both
docker-compose -f docker-compose.graph.yml restart

# Remove both (keeps data)
docker-compose -f docker-compose.graph.yml down

# Remove both AND data
docker-compose -f docker-compose.graph.yml down -v
```

### View Logs

```bash
# All services
docker-compose -f docker-compose.graph.yml logs

# Follow logs (live)
docker-compose -f docker-compose.graph.yml logs -f

# Specific service
docker-compose -f docker-compose.graph.yml logs neo4j
docker-compose -f docker-compose.graph.yml logs memgraph

# Last 100 lines
docker-compose -f docker-compose.graph.yml logs --tail=100
```

### Check Status

```bash
# Container status
docker-compose -f docker-compose.graph.yml ps

# Health check status
docker-compose -f docker-compose.graph.yml ps --format json | grep -i health
```

## Testing Connection from Code

### TypeScript Example

```typescript
import neo4j from 'neo4j-driver';

// Test Neo4j connection
async function testNeo4j() {
  const driver = neo4j.driver(
    'bolt://localhost:7687',
    neo4j.auth.basic('neo4j', 'cortex-dev-password')
  );
  
  const session = driver.session();
  
  try {
    const result = await session.run('RETURN "Neo4j connected!" as message');
    console.log(result.records[0].get('message'));
  } finally {
    await session.close();
    await driver.close();
  }
}

// Test Memgraph connection (same driver!)
async function testMemgraph() {
  const driver = neo4j.driver(
    'bolt://localhost:7688',
    neo4j.auth.basic('memgraph', 'cortex-dev-password')
  );
  
  const session = driver.session();
  
  try {
    const result = await session.run('RETURN "Memgraph connected!" as message');
    console.log(result.records[0].get('message'));
  } finally {
    await session.close();
    await driver.close();
  }
}

await testNeo4j();
await testMemgraph();
```

## Data Management

### Clear All Data

**Neo4j (via Browser or code):**
```cypher
// Delete all nodes and relationships
MATCH (n) DETACH DELETE n;
```

**Memgraph (via Lab or code):**
```cypher
// Delete all nodes and relationships
MATCH (n) DETACH DELETE n;
```

### Fresh Start

```bash
# Stop containers and remove all data
docker-compose -f docker-compose.graph.yml down -v

# Start fresh
docker-compose -f docker-compose.graph.yml up -d
```

## Troubleshooting

### Issue: Containers won't start

**Solution:**
```bash
# Check if ports are already in use
netstat -an | findstr "7474 7687 7688 3001"

# If ports are in use, stop conflicting services or change ports in docker-compose.graph.yml
```

### Issue: "Connection refused" error

**Solution:**
1. Wait 30 seconds for containers to fully start
2. Check container health:
   ```bash
   docker-compose -f docker-compose.graph.yml ps
   ```
3. Check logs for errors:
   ```bash
   docker-compose -f docker-compose.graph.yml logs
   ```

### Issue: "Authentication failed"

**Solution:**
- Double-check username and password in your code/config
- Neo4j: `neo4j` / `cortex-dev-password`
- Memgraph: `memgraph` / `cortex-dev-password`
- If you changed the password, you may need to reset:
  ```bash
  docker-compose -f docker-compose.graph.yml down -v
  docker-compose -f docker-compose.graph.yml up -d
  ```

### Issue: Neo4j Browser shows "Service Unavailable"

**Solution:**
1. Wait 30 more seconds (Neo4j takes longer to start than Memgraph)
2. Check logs: `docker logs cortex-neo4j`
3. Restart: `docker-compose -f docker-compose.graph.yml restart neo4j`

### Issue: Out of memory errors

**Solution:**
Edit `docker-compose.graph.yml` and reduce memory settings:
```yaml
# Neo4j
- NEO4J_dbms_memory_heap_max__size=1G  # was 2G
- NEO4J_dbms_memory_pagecache_size=512M  # was 1G
```

Then restart:
```bash
docker-compose -f docker-compose.graph.yml restart
```

### Issue: Memgraph Lab won't connect to database

**Solution:**
1. Open http://localhost:3001
2. If connection dialog appears, enter:
   - Host: `localhost:7688` (note: 7688, not 7687)
   - Username: `memgraph`
   - Password: `cortex-dev-password`

## Performance Tips

### Neo4j

- **Indexes:** Create indexes for frequently queried properties
  ```cypher
  CREATE INDEX context_id FOR (c:Context) ON (c.contextId);
  ```

- **Query Profiling:** Use `EXPLAIN` or `PROFILE` to optimize queries
  ```cypher
  PROFILE
  MATCH (c:Context {contextId: 'ctx-123'})
  RETURN c;
  ```

### Memgraph

- **In-Memory:** Memgraph keeps all data in memory (faster but needs RAM)
- **Persistence:** Data is persisted via snapshots to disk
- **Check Memory Usage:** Monitor Docker Desktop or:
  ```bash
  docker stats cortex-memgraph
  ```

## Resource Usage

### Typical Resource Usage

| Database | RAM | Disk | CPU |
|----------|-----|------|-----|
| **Neo4j** | 1-2 GB | 500 MB - 5 GB | Low |
| **Memgraph** | 512 MB - 4 GB | 100 MB (snapshots) | Low |

### Adjust for Your System

**Most Users:**
- Run **only Neo4j** (recommended):
  ```bash
  docker-compose -f docker-compose.graph.yml up -d neo4j
  ```
  
- Or run **only Memgraph** (if you need performance):
  ```bash
  docker-compose -f docker-compose.graph.yml up -d memgraph
  ```

**SDK Contributors/Testers:**
- Run both for cross-database testing:
  ```bash
  docker-compose -f docker-compose.graph.yml up -d
  ```
  Requires 16GB+ RAM for both simultaneously

**High Memory System (16GB+ RAM):**
- Increase memory allocation in `docker-compose.graph.yml` for better performance

## Next Steps

Once your graph database is running:

1. **Verify Setup (run tests):**
   ```bash
   npm test -- graphAdapter.test
   ```
   Expected: ✅ 15/15 tests passing

2. **See It In Action (run a proof):**
   ```bash
   # Best demonstration - fact knowledge graph
   npx tsx tests/graph/proofs/05-fact-graph.proof.ts
   
   # Or try the sync workflow
   npx tsx tests/graph/proofs/02-sync-workflow.proof.ts
   ```

3. **Start Using It:**
   ```bash
   npm install neo4j-driver
   ```
   
   Then see integration examples in:
   - [Graph Database Integration](./02-graph-database-integration.md)
   - `src/graph/README.md`

4. **Learn More:**
   - [Graph Database Integration](./02-graph-database-integration.md) - Full integration guide
   - [Graph Database Selection](./04-graph-database-selection.md) - Choosing Neo4j vs Memgraph

## Reference

### Official Documentation

- **Neo4j:** https://neo4j.com/docs/
- **Memgraph:** https://memgraph.com/docs
- **neo4j-driver:** https://neo4j.com/docs/javascript-manual/current/

### Cortex Documentation

- [Graph-Lite Traversal](./01-graph-lite-traversal.md) - Built-in graph capabilities
- [Graph Database Integration](./02-graph-database-integration.md) - Full integration guide
- [Graph Database Selection](./04-graph-database-selection.md) - Choosing the right database

---

**Questions?** Ask in [GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions) or [Discord](https://discord.gg/cortex).

