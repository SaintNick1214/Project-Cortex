# Troubleshooting Guide - Open WebUI + Cortex

> **Common Issues and Solutions**

## Quick Diagnostics

```bash
# Check all services
docker-compose -f docker-compose.full.yml ps

# View logs
docker-compose logs cortex-bridge
docker-compose logs open-webui

# Test connectivity
curl http://localhost:3000/health  # Cortex Bridge
curl http://localhost:8080/health   # Open WebUI
```

---

## Cortex Bridge Issues

### Issue: Bridge Won't Start

**Symptoms**:

```
Error: CONVEX_URL environment variable is required
```

**Solution**:

```bash
# 1. Verify .env.local exists
cat .env.local | grep CONVEX_URL

# 2. If missing, add it
echo "CONVEX_URL=https://your-deployment.convex.cloud" >> .env.local

# 3. Restart bridge
docker-compose restart cortex-bridge
```

### Issue: SDK Import Error

**Symptoms**:

```
Error: Cannot find module '../../../../dist/index.js'
```

**Solution**:

```bash
# Build Cortex SDK
cd Project-Cortex
npm run build

# Verify dist exists
ls -la dist/index.js

# Restart bridge
cd "Examples and Proofs/Open-WebUI-Integration"
docker-compose restart cortex-bridge
```

### Issue: OpenAI Embeddings Failing

**Symptoms**:

```
Error generating embeddings: 401 Unauthorized
```

**Solution**:

```bash
# Check API key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# If invalid, update .env.local
nano .env.local  # Update OPENAI_API_KEY
docker-compose restart cortex-bridge
```

---

## Open WebUI Integration Issues

### Issue: Cortex Not Initializing

**Symptoms**:

- No memory badges appear
- Logs show: "Cortex Memory DISABLED"

**Solution**:

```python
# Check config.py
print(ENABLE_CORTEX_MEMORY)  # Should be True
print(CORTEX_BRIDGE_URL)      # Should be http://cortex-bridge:3000

# Verify environment
docker exec open-webui env | grep CORTEX

# If missing, update docker-compose.yml and restart
```

### Issue: Memory Recall Returns Empty

**Symptoms**:

```python
memories = await cortex_client.recall_memories(...)
print(len(memories))  # 0
```

**Causes & Solutions**:

**1. No memories stored yet**

```bash
# Check if any memories exist
curl -X POST http://localhost:3000/api/memory/recall \
  -H "Content-Type: application/json" \
  -d '{"userId":"test-user","query":"test","limit":10}'
```

**2. Similarity threshold too high**

```python
# Lower min_similarity
memories = await cortex_client.recall_memories(
    user_id=user_id,
    query=query,
    min_similarity=0.5  # Lower from 0.7
)
```

**3. Wrong user ID**

```python
# Verify user ID matches storage
log.info(f"Searching for user_id: {user_id}")
```

### Issue: Chat Endpoint 500 Error

**Symptoms**:

```
500 Internal Server Error
```

**Solution**:

```bash
# Check Open WebUI logs
docker-compose logs --tail=50 open-webui

# Common causes:
# 1. Cortex Bridge not reachable
curl http://cortex-bridge:3000/health  # From within container

# 2. Missing async/await
# Ensure all cortex_client calls use 'await'

# 3. Uncaught exception
# Check logs for Python stack trace
```

---

## Svelte Component Issues

### Issue: MemoryBadge Not Appearing

**Symptoms**:

- Chat works but no 🧠 badges

**Solution**:

**1. Check if cortexData is passed to component**

```svelte
<!-- In ResponseMessage.svelte -->
<script>
  export let cortexData = null;
  console.log('cortexData:', cortexData);  // Debug
</script>

{#if cortexData}
  <MemoryBadge {...cortexData} />
{/if}
```

**2. Verify backend returns cortex field**

```python
# In chats.py
response = ChatResponse(
    text=response_text,
    cortex=cortex_data  # Must be set!
)
```

**3. Check import path**

```svelte
import MemoryBadge from '$lib/components/cortex/MemoryBadge.svelte';
```

### Issue: Sidebar Not Opening

**Symptoms**:

- Toggle button doesn't work

**Solution**:

```typescript
// Check cortex store
import { cortexStore } from "$lib/stores/cortex";

// Debug state
cortexStore.subscribe((state) => {
  console.log("Sidebar open:", state.sidebarOpen);
});

// Verify toggle function
cortexStore.toggleSidebar();
```

---

## Docker Issues

### Issue: Container Crash Loop

**Symptoms**:

```
Container cortex-bridge is unhealthy
```

**Solution**:

```bash
# Check container logs
docker logs cortex-bridge

# Common causes:
# 1. Missing environment variable
docker inspect cortex-bridge | grep -A 20 Env

# 2. Port already in use
lsof -i :3000

# 3. Build failure
docker-compose build --no-cache cortex-bridge
```

### Issue: Services Can't Communicate

**Symptoms**:

```
Connection refused to cortex-bridge:3000
```

**Solution**:

```bash
# Verify network
docker network ls | grep cortex

# Check service names
docker-compose ps

# Test connectivity between containers
docker exec open-webui curl http://cortex-bridge:3000/health
```

---

## Database Issues

### Issue: PostgreSQL Connection Failed

**Symptoms**:

```
could not connect to server: Connection refused
```

**Solution**:

```bash
# Check PostgreSQL status
docker-compose ps postgres

# View PostgreSQL logs
docker-compose logs postgres

# Verify credentials
docker exec postgres psql -U openwebui -d openwebui -c "SELECT 1"

# Reset database (WARNING: deletes data)
docker-compose down -v
docker-compose up -d
```

---

## Performance Issues

### Issue: Slow Memory Recall

**Symptoms**:

- Responses take 5+ seconds
- Logs show: "Recalled ... in 4.5s"

**Solutions**:

**1. Reduce recall limit**

```python
memories = await cortex_client.recall_memories(
    user_id=user_id,
    query=query,
    limit=3  # Reduce from 5
)
```

**2. Enable caching in bridge**

```javascript
// In src/cortex-bridge/utils/embeddings.js
// Cache is already implemented, verify it's working
```

**3. Use faster embedding model**

```javascript
// In embeddings.js
const model = "text-embedding-3-small"; // Faster than 3-large
```

---

## Common Errors

### Error: "Module not found: @cortexmemory/sdk"

**Cause**: SDK not built or path incorrect

**Solution**:

```bash
cd Project-Cortex
npm run build
ls -la dist/  # Verify files exist
```

### Error: "CORS policy blocked"

**Cause**: Frontend can't call Bridge directly

**Solution**:

```javascript
// Bridge should only be called by backend
// Frontend calls backend, backend calls bridge

// Correct flow:
// Frontend → /api/chat → Backend → Bridge
```

### Error: "Port 3000 already in use"

**Solution**:

```bash
# Find process
lsof -i :3000

# Kill it
kill -9 <PID>

# Or change port in .env.local
CORTEX_BRIDGE_PORT=3001
```

---

## Debug Mode

### Enable Debug Logging

**Backend**:

```python
# In config.py
logging.basicConfig(level=logging.DEBUG)
```

**Bridge**:

```bash
# In .env.local
LOG_LEVEL=debug
NODE_ENV=development
```

**View Debug Logs**:

```bash
docker-compose logs -f --tail=100
```

---

## Getting Help

### Information to Provide

When reporting issues, include:

```bash
# 1. Versions
docker --version
node --version
python --version

# 2. Health checks
curl http://localhost:3000/health
curl http://localhost:8080/health

# 3. Environment (sanitized)
cat .env.local | grep -v "API_KEY\|SECRET"

# 4. Logs
docker-compose logs --tail=100 > issue-logs.txt

# 5. Error message
# Copy exact error from logs
```

### Support Channels

- GitHub Issues: [Project-Cortex/issues](https://github.com/SaintNick1214/Project-Cortex/issues)
- Documentation: [00-PROJECT-OVERVIEW.md](00-PROJECT-OVERVIEW.md)
- Discord: TBD

---

## Preventive Measures

### Before Deploying

```bash
# 1. Verify all dependencies
docker-compose config

# 2. Run health checks
./scripts/health-check.sh

# 3. Test with minimal config
# Use SQLite first, then PostgreSQL

# 4. Monitor logs during first deploy
docker-compose up  # No -d flag
```

### Regular Maintenance

```bash
# Weekly
docker-compose logs | grep ERROR > weekly-errors.log

# Monthly
docker system prune -a --volumes  # Clean unused resources

# Before updates
docker-compose down
git pull
docker-compose build --no-cache
docker-compose up -d
```

---

## Next Steps

- **Back to Overview** → [00-PROJECT-OVERVIEW.md](00-PROJECT-OVERVIEW.md)
- **Integration Guide** → [04-INTEGRATION-GUIDE.md](04-INTEGRATION-GUIDE.md)
- **Deployment** → [09-DEPLOYMENT.md](09-DEPLOYMENT.md)
