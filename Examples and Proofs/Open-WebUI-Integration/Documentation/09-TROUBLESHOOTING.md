# Troubleshooting Guide - Open WebUI + Cortex Integration

> **Solutions to common issues and debugging strategies**

## Table of Contents
- [Setup Issues](#setup-issues)
- [Convex Connection Problems](#convex-connection-problems)
- [Docker and Networking](#docker-and-networking)
- [Performance Issues](#performance-issues)
- [Memory and Storage](#memory-and-storage)
- [API Errors](#api-errors)
- [Debug Mode](#debug-mode)
- [Getting Help](#getting-help)

---

## Setup Issues

### Issue: `CONVEX_URL` not found

**Symptoms:**
```
Error: CONVEX_URL environment variable is required
```

**Cause:** Environment variable not set or `.env` file not loaded.

**Solution:**
```bash
# 1. Verify .env file exists
ls -la .env

# 2. Check CONVEX_URL is set
cat .env | grep CONVEX_URL

# 3. If missing, deploy Convex first
cd ../../convex-dev
npx convex deploy --prod
# Copy the deployment URL

# 4. Add to .env
echo "CONVEX_URL=https://your-deployment.convex.cloud" >> .env

# 5. Restart services
docker-compose restart
```

---

### Issue: Node.js version mismatch

**Symptoms:**
```
Error: The engine "node" is incompatible with this module
```

**Cause:** Node.js version < 18.0.0

**Solution:**
```bash
# Check version
node --version

# If < 18, upgrade using nvm
nvm install 18
nvm use 18

# Or download from nodejs.org
# https://nodejs.org/en/download/
```

---

### Issue: Docker Compose not found

**Symptoms:**
```bash
docker-compose: command not found
```

**Cause:** Docker Compose v2 uses `docker compose` (no hyphen)

**Solution:**
```bash
# Try without hyphen (v2)
docker compose up -d

# Or create alias
echo 'alias docker-compose="docker compose"' >> ~/.bashrc
source ~/.bashrc
```

---

## Convex Connection Problems

### Issue: Cannot connect to Convex

**Symptoms:**
```
Error: Failed to connect to Convex
ConvexError: ECONNREFUSED
```

**Debugging Steps:**

**1. Verify URL:**
```bash
# Check URL format
echo $CONVEX_URL
# Should be: https://your-deployment.convex.cloud

# Test connectivity
curl -X POST $CONVEX_URL \
  -H "Content-Type: application/json" \
  -d '{"path":"conversations/list","args":{}}'
```

**2. Check Convex Deployment:**
```bash
cd ../../convex-dev
npx convex status

# Expected output:
# ✓ Deployment: your-deployment
# ✓ Status: Active
```

**3. Redeploy Schema:**
```bash
npx convex deploy --prod
```

---

### Issue: Convex function not found

**Symptoms:**
```
Error: Function "conversations/list" not found
```

**Cause:** Schema not deployed or outdated

**Solution:**
```bash
cd ../../convex-dev

# List deployed functions
npx convex functions list

# If empty or incomplete, redeploy
npx convex deploy --prod

# Verify deployment
npx convex functions list
# Should show all cortex functions:
# - conversations/*
# - immutable/*
# - mutable/*
# - vector/*
# - facts/*
# - contexts/*
# - users/*
# - agents/*
# - memorySpaces/*
```

---

### Issue: Convex rate limit exceeded

**Symptoms:**
```
Error: Rate limit exceeded (429)
```

**Cause:** Too many requests in short time (free tier: 1,000/min)

**Solutions:**

**1. Implement Rate Limiting:**
```typescript
import { RateLimiter } from 'limiter';

const limiter = new RateLimiter({
  tokensPerInterval: 100,
  interval: 'minute'
});

async function remember(params) {
  await limiter.removeTokens(1);
  return cortex.memory.remember(params);
}
```

**2. Batch Operations:**
```typescript
// Instead of:
for (const msg of messages) {
  await cortex.memory.remember({...});
}

// Use batch:
const batch = messages.map(msg => ({...}));
await Promise.all(batch.map(params => 
  cortex.memory.remember(params)
));
```

**3. Upgrade Plan:**
```bash
# Contact Convex support for higher limits
# https://www.convex.dev/pricing
```

---

## Docker and Networking

### Issue: Containers can't communicate

**Symptoms:**
```
Error: connect ECONNREFUSED cortex-bridge:3000
```

**Cause:** Containers not on same network

**Solution:**

**1. Verify Network:**
```bash
# List networks
docker network ls

# Inspect network
docker network inspect cortex-network

# Should show both containers
```

**2. Restart with Network:**
```bash
docker-compose down
docker-compose up -d
```

**3. Test Connectivity:**
```bash
# From open-webui container
docker-compose exec open-webui ping cortex-bridge

# Should respond
```

---

### Issue: Port already in use

**Symptoms:**
```
Error: bind: address already in use (port 8080)
```

**Cause:** Port occupied by another service

**Solution:**

**1. Find Process:**
```bash
# Linux/Mac
lsof -i :8080

# Windows
netstat -ano | findstr :8080
```

**2. Kill Process:**
```bash
# Linux/Mac
kill -9 <PID>

# Windows
taskkill /PID <PID> /F
```

**3. Or Change Port:**
```yaml
# docker-compose.yml
services:
  open-webui:
    ports:
      - "8081:8080"  # Changed from 8080:8080
```

---

### Issue: Container keeps restarting

**Symptoms:**
```bash
docker-compose ps
# Shows: Restarting
```

**Debugging:**

**1. Check Logs:**
```bash
docker-compose logs cortex-bridge

# Look for error messages
```

**2. Common Causes:**

**Missing Environment Variable:**
```bash
# Verify all required vars
docker-compose exec cortex-bridge env | grep CONVEX_URL
```

**Health Check Failing:**
```bash
# Check health
docker-compose exec cortex-bridge curl http://localhost:3000/health

# If fails, check server startup
```

**3. Debug Mode:**
```bash
# Run manually without restart
docker-compose run --rm cortex-bridge sh

# Inside container:
node server.js
# See error output
```

---

## Performance Issues

### Issue: Slow memory operations

**Symptoms:**
- `memory.remember()` takes > 5 seconds
- `memory.recall()` takes > 5 seconds

**Causes and Solutions:**

**1. Slow Embedding Generation:**
```bash
# Check OpenAI API response time
time curl https://api.openai.com/v1/embeddings \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"input":"test","model":"text-embedding-3-small"}'

# If > 2s, OpenAI may be slow
# Solution: Implement caching
```

**2. Large Result Sets:**
```typescript
// Instead of:
const memories = await cortex.memory.recall({
  memorySpaceId: userId,
  query: query,
  limit: 1000  // Too many!
});

// Use pagination:
const memories = await cortex.memory.recall({
  memorySpaceId: userId,
  query: query,
  limit: 20  // Reasonable
});
```

**3. Network Latency:**
```bash
# Test Convex latency
time curl -X POST $CONVEX_URL \
  -H "Content-Type: application/json" \
  -d '{"path":"conversations/list","args":{}}'

# If > 500ms, consider:
# - Deploying closer to users
# - Using Convex regions
```

---

### Issue: High memory usage

**Symptoms:**
```bash
docker stats
# Shows cortex-bridge using > 2GB RAM
```

**Causes and Solutions:**

**1. Memory Leaks:**
```typescript
// Ensure connections are closed
try {
  const result = await cortex.memory.remember({...});
} finally {
  // Cleanup if needed
}
```

**2. Large Embeddings in Memory:**
```typescript
// Don't store embeddings in memory
const memories = await cortex.memory.recall({
  memorySpaceId: userId,
  query: query,
  includeEmbedding: false  // Exclude embeddings
});
```

**3. Increase Container Limits:**
```yaml
# docker-compose.yml
services:
  cortex-bridge:
    deploy:
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 1G
```

---

## Memory and Storage

### Issue: Facts not extracted

**Symptoms:**
- `memory.remember()` succeeds but no facts created

**Cause:** Facts extraction disabled or failing

**Solutions:**

**1. Verify Feature Flag:**
```bash
echo $ENABLE_FACTS_EXTRACTION
# Should be: true
```

**2. Check Extraction Config:**
```typescript
await cortex.memory.remember({
  memorySpaceId: userId,
  conversationId: convId,
  userMessage: "Alice works at Acme Corp",
  agentResponse: "Got it!",
  extractFacts: true,  // ← Must be true
  importance: 5
});
```

**3. Manual Extraction:**
```typescript
// If automatic fails, extract manually
const facts = await cortex.facts.extract({
  content: "Alice works at Acme Corp",
  memorySpaceId: userId,
  extractorType: 'llm'
});

console.log('Extracted facts:', facts);
```

---

### Issue: Search returns no results

**Symptoms:**
- `memory.recall()` returns empty array
- Know relevant conversations exist

**Debugging:**

**1. Verify Data Exists:**
```typescript
// List all memories
const allMemories = await cortex.vector.list({
  memorySpaceId: userId,
  limit: 100
});

console.log(`Total memories: ${allMemories.length}`);
```

**2. Check Memory Space ID:**
```typescript
// Ensure memorySpaceId matches
const results = await cortex.memory.recall({
  memorySpaceId: 'user-123',  // Must match storage
  query: 'test'
});
```

**3. Try Different Queries:**
```typescript
// Try exact content
const exact = await cortex.memory.recall({
  memorySpaceId: userId,
  query: 'exact message text',
  limit: 5
});

// Try broader query
const broad = await cortex.memory.recall({
  memorySpaceId: userId,
  query: 'general topic',
  limit: 20
});
```

**4. Check Embeddings:**
```typescript
// Verify embeddings were generated
const memory = await cortex.vector.get(memoryId);
console.log('Has embedding:', memory.embedding !== null);
```

---

## API Errors

### Issue: 401 Unauthorized

**Symptoms:**
```
Error: 401 Unauthorized
ConvexError: Invalid authentication
```

**Cause:** Missing or invalid API key

**Solution:**
```bash
# Verify API key
echo $OPENAI_API_KEY | head -c 10
# Should show: sk-...

# Test key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# If invalid, generate new key at:
# https://platform.openai.com/api-keys
```

---

### Issue: 429 Too Many Requests

**Symptoms:**
```
Error: 429 Too Many Requests
Rate limit exceeded
```

**Solutions:**

**1. Implement Exponential Backoff:**
```typescript
async function rememberWithRetry(params, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await cortex.memory.remember(params);
    } catch (error) {
      if (error.code === 429 && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000;
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }
}
```

**2. Reduce Request Rate:**
```typescript
// Add delay between requests
await cortex.memory.remember(params1);
await new Promise(r => setTimeout(r, 100));  // 100ms delay
await cortex.memory.remember(params2);
```

---

### Issue: 500 Internal Server Error

**Symptoms:**
```
Error: 500 Internal Server Error
```

**Debugging:**

**1. Check Server Logs:**
```bash
docker-compose logs -f cortex-bridge
# Look for stack trace
```

**2. Enable Debug Logging:**
```bash
# In .env
LOG_LEVEL=debug

# Restart
docker-compose restart cortex-bridge

# View detailed logs
docker-compose logs -f cortex-bridge
```

**3. Test Health Endpoint:**
```bash
curl http://localhost:3000/health

# Should return:
# {"status":"healthy","cortex":"connected","timestamp":"..."}
```

---

## Debug Mode

### Enable Verbose Logging

**Cortex Bridge:**
```bash
# In .env
LOG_LEVEL=debug
NODE_ENV=development

# Restart
docker-compose restart cortex-bridge
```

**Open WebUI:**
```bash
# In docker-compose.yml
services:
  open-webui:
    environment:
      - LOG_LEVEL=DEBUG
```

### Test Endpoints Manually

```bash
# Health check
curl http://localhost:3000/health

# Store memory
curl -X POST http://localhost:3000/api/memory/remember \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "conversationId": "test-conv",
    "userMessage": "Test message"
  }'

# Recall memories
curl -X POST http://localhost:3000/api/memory/recall \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "query": "test",
    "limit": 5
  }'
```

### Check Container Status

```bash
# View all containers
docker-compose ps

# Detailed info
docker inspect cortex-bridge

# Resource usage
docker stats

# Network connectivity
docker network inspect cortex-network
```

---

## Getting Help

### Before Asking for Help

Please gather this information:

**1. System Info:**
```bash
# Docker version
docker --version
docker-compose --version

# Node.js version
node --version

# OS
uname -a  # Linux/Mac
systemctl  # Windows
```

**2. Environment:**
```bash
# Sanitized environment
env | grep -E '(CONVEX|NODE_ENV|LOG_LEVEL)' | sed 's/=.*/=***/'
```

**3. Logs:**
```bash
# Last 100 lines
docker-compose logs --tail=100 > logs.txt

# Include timestamps
docker-compose logs --timestamps --tail=100 > logs-with-time.txt
```

**4. Configuration:**
```bash
# Docker Compose config (sanitized)
docker-compose config > config.yml
```

### Where to Get Help

**1. GitHub Issues:**
```
https://github.com/SaintNick1214/Project-Cortex/issues
```
- Bug reports
- Feature requests
- Technical questions

**2. GitHub Discussions:**
```
https://github.com/SaintNick1214/Project-Cortex/discussions
```
- General questions
- Best practices
- Architecture discussions

**3. Documentation:**
```
/Documentation/00-README.md
```
- Complete API reference
- Architecture guides
- Advanced topics

### Issue Template

When reporting issues, use this template:

```markdown
## Issue Description
Brief description of the problem

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Steps to Reproduce
1. Step 1
2. Step 2
3. Step 3

## Environment
- OS: Ubuntu 22.04
- Docker: 24.0.5
- Node.js: 20.10.0
- Cortex SDK: 0.8.0

## Logs
```
Paste relevant logs here
```

## Configuration
```yaml
Paste relevant config (sanitized)
```

## Additional Context
Any other relevant information
```

---

## Quick Reference

### Common Commands

```bash
# Restart everything
docker-compose restart

# View logs
docker-compose logs -f

# Rebuild after code changes
docker-compose up -d --build

# Stop everything
docker-compose down

# Nuclear option (delete everything)
docker-compose down -v

# Check health
curl http://localhost:3000/health
```

### Common Fixes

| Problem | Quick Fix |
|---------|-----------|
| Can't connect | `docker-compose restart` |
| Port in use | Change port in docker-compose.yml |
| Schema not found | `cd convex-dev && npx convex deploy --prod` |
| Out of memory | Increase Docker memory limits |
| Slow performance | Check `OPENAI_API_KEY` and network |

---

## Summary

Most issues fall into these categories:
1. **Setup** - Missing environment variables or configuration
2. **Convex** - Schema not deployed or connection issues
3. **Docker** - Networking or resource constraints
4. **Performance** - Slow embeddings or large result sets
5. **API** - Rate limits or authentication

**General Debugging Strategy:**
1. Check logs (`docker-compose logs -f`)
2. Verify environment variables (`env`)
3. Test endpoints manually (`curl`)
4. Enable debug logging (`LOG_LEVEL=debug`)
5. Restart services (`docker-compose restart`)

If stuck, gather diagnostics and ask for help on GitHub!

---

**Previous:** [08-COMPARISON.md](./08-COMPARISON.md)  
**Next:** [README.md](../README.md) - Quick reference

