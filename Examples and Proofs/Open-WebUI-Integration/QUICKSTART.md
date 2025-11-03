# QUICKSTART - Open WebUI + Cortex Integration

> **Get the Cortex-Integrated Open WebUI Running in 10 Minutes**

## Prerequisites Check

```bash
# Verify you have:
node --version    # 18.0.0+
python --version  # 3.11+
docker --version  # 24.0+
```

**Required**:

- Convex deployment URL (from `npm create cortex-memories`)
- OpenAI API key (for embeddings)

---

## Option 1: Quick Test (Standalone Services)

**Best for**: Testing backend integration without Docker

### Step 1: Start Convex (If Not Running)

```bash
# Terminal 1
cd Project-Cortex/convex-dev
npm run dev

# Wait for: "✔ Convex functions ready!"
# Keep this terminal open
```

### Step 2: Start Cortex Bridge

```bash
# Terminal 2
cd "Project-Cortex/Examples and Proofs/Open-WebUI-Integration/src/cortex-bridge"

# Install dependencies (first time only)
npm install

# Start bridge
node server.js

# Should see:
# ✓ Loaded Cortex SDK
# 🚀 Cortex Bridge ready at http://localhost:3000
```

### Step 3: Start Open WebUI Backend

```bash
# Terminal 3
cd "Project-Cortex/Examples and Proofs/Open-WebUI-Integration/open-webui-fork/backend"

# Create virtual environment (first time only)
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set environment
export CORTEX_BRIDGE_URL=http://localhost:3000
export ENABLE_CORTEX_MEMORY=true
export DATA_DIR=./data

# Start backend
uvicorn open_webui.main:app --reload --host 0.0.0.0 --port 8080

# Should see:
# ✓ Cortex Memory ENABLED
# ✓ Cortex integration initialized and healthy
```

### Step 4: Test Cortex Integration

```bash
# Terminal 4
# Check status
curl http://localhost:8080/api/v1/cortex/status

# Expected:
# {"enabled": true, "healthy": true, "bridge_url": "http://localhost:3000"}

# Success! Backend integration working ✅
```

### Step 5: Start Frontend (Optional - For Demo Page)

```bash
# Terminal 5
cd "Project-Cortex/Examples and Proofs/Open-WebUI-Integration/open-webui-fork"

# Install dependencies (first time only)
npm install

# Start dev server
npm run dev

# Access demo page: http://localhost:5173/cortex/demos/memory
```

---

## Option 2: Docker Deployment

**Best for**: Production-like environment

### Step 1: Configure Environment

```bash
cd "Project-Cortex/Examples and Proofs/Open-WebUI-Integration"

# Create environment file
cp env.example .env.local

# Edit with your credentials
nano .env.local

# Required variables:
# CONVEX_URL=https://your-deployment.convex.cloud
# OPENAI_API_KEY=sk-your-key-here
# DB_PASSWORD=secure-password
# WEBUI_SECRET_KEY=long-random-string
# WEBUI_JWT_SECRET_KEY=another-long-random-string
```

### Step 2: Build Cortex SDK

```bash
# Must build SDK first for Docker volume mount
cd Project-Cortex
npm run build

# Verify
ls -la dist/index.js
```

### Step 3: Deploy Stack

```bash
cd "Project-Cortex/Examples and Proofs/Open-WebUI-Integration"

# Copy .env.local to .env for Docker Compose
cp .env.local .env

# Start everything
docker-compose -f docker-compose.full.yml up -d

# Check status
docker-compose -f docker-compose.full.yml ps

# View logs
docker-compose -f docker-compose.full.yml logs -f

# Access: http://localhost:8080
```

---

## Verification

### 1. Check Cortex Status

```bash
curl http://localhost:8080/api/v1/cortex/status
```

**Expected Response**:

```json
{
  "enabled": true,
  "healthy": true,
  "bridge_url": "http://cortex-bridge:3000",
  "metrics": {
    "total_recalls": 0,
    "total_stores": 0
  }
}
```

### 2. Test Memory Demo (With Auth)

```bash
# First, create account at http://localhost:8080
# Then get auth token from browser dev tools

# Test demo chat
curl -X POST http://localhost:8080/api/v1/cortex/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{"message": "I prefer TypeScript for backend development"}'
```

**Expected Response**:

```json
{
  "text": "Response with context...",
  "cortex": {
    "memoriesRecalled": 0,
    "memoryId": "mem_abc123",
    "factsExtracted": 1,
    "recallDuration": 0.123,
    "storeDuration": 0.089
  }
}
```

### 3. Search Memories

```bash
curl -X POST http://localhost:8080/api/v1/cortex/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{"query": "preferences", "limit": 5}'
```

**Expected**: List of memories with similarity scores

---

## Access Points

| Service       | URL                                        | Purpose                       |
| ------------- | ------------------------------------------ | ----------------------------- |
| Open WebUI    | http://localhost:8080                      | Main application              |
| Memory Demo   | http://localhost:5173/cortex/demos/memory  | Interactive demo (dev server) |
| Cortex Status | http://localhost:8080/api/v1/cortex/status | Integration status            |
| Cortex Bridge | http://localhost:3000/health               | Bridge health                 |
| API Docs      | http://localhost:8080/docs                 | OpenAPI docs (dev mode)       |

---

## Troubleshooting

### Cortex Not Enabled

**Issue**: Status shows `"enabled": false`

**Fix**:

```bash
# Check environment
echo $ENABLE_CORTEX_MEMORY  # Should be "true"

# If not set:
export ENABLE_CORTEX_MEMORY=true

# Restart backend
```

### Bridge Not Healthy

**Issue**: Status shows `"healthy": false`

**Fix**:

```bash
# Check Cortex Bridge
curl http://localhost:3000/health

# If fails, check logs
docker-compose logs cortex-bridge  # Docker
# OR
tail -f src/cortex-bridge/logs/combined.log  # Standalone

# Verify CONVEX_URL is set
echo $CONVEX_URL
```

### Port Already in Use

**Issue**: Error binding to port 3000 or 8080

**Fix**:

```bash
# Find process
lsof -i :3000  # Or :8080

# Kill it
kill -9 <PID>

# Or change port in .env.local
```

---

## What You Should See

### 1. Backend Logs (Success)

```
INFO: ✓ Cortex Memory ENABLED
INFO:   Bridge URL: http://localhost:3000
INFO: CortexClient initialized: http://localhost:3000
INFO: ✓ Cortex integration initialized and healthy
INFO: Application startup complete
INFO: Uvicorn running on http://0.0.0.0:8080
```

### 2. Cortex Bridge Logs (Success)

```
✓ Loaded Cortex SDK from local build
🚀 Cortex Bridge ready at http://localhost:3000

Endpoints:
  POST /api/memory/remember
  POST /api/memory/recall
  GET  /api/users/:userId
  ...
```

### 3. Frontend Demo Page

Navigate to http://localhost:5173/cortex/demos/memory

**You should see**:

- Chat interface
- Memory search panel
- Info panel explaining features
- Professional gradient styling

**Try it**:

1. Type: "I prefer TypeScript"
2. See response with 🧠 memory badge
3. Type: "What languages do I like?"
4. See memories recalled with similarity scores

---

## Next Steps

### To See Full Visual Proof

1. **Integrate into Main Chat** (requires finding Open WebUI's message component)
2. **Build Remaining Demo Pages** (contexts, facts, agents, metrics)
3. **Add Memory Sidebar** (code ready in Documentation/06-VISUAL-COMPONENTS.md)
4. **Create Comparison View** (design in Documentation/08-SIDE-BY-SIDE-COMPARISON.md)

### To Deploy to Production

1. Follow [Documentation/09-DEPLOYMENT.md](Documentation/09-DEPLOYMENT.md)
2. Configure environment for production
3. Set up SSL/TLS
4. Add monitoring
5. Deploy with Docker

---

## Support

- **Full Documentation**: [Documentation/00-PROJECT-OVERVIEW.md](Documentation/00-PROJECT-OVERVIEW.md)
- **Architecture**: [Documentation/01-ARCHITECTURE.md](Documentation/01-ARCHITECTURE.md)
- **Troubleshooting**: [Documentation/11-TROUBLESHOOTING.md](Documentation/11-TROUBLESHOOTING.md)

---

**Status**: Backend integration complete and testable!  
**Next**: Frontend visual components and demo pages  
**Goal**: Complete visual proof showing Cortex working in real chat
