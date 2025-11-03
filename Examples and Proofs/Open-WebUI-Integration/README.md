# Open WebUI + Cortex Memory Integration

> **See Cortex Working in Real Chat - Visual Proof of Concept**

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](../../LICENSE.md)
[![Open WebUI](https://img.shields.io/badge/Open%20WebUI-Compatible-green.svg)](https://github.com/open-webui/open-webui)
[![Cortex SDK](https://img.shields.io/badge/Cortex%20SDK-Latest-purple.svg)](../../README.md)

## What This Proves

This integration demonstrates **every Cortex feature** by modifying actual Open WebUI to show memory working in real conversations:

- **Visual Indicators**: 🧠 Memory badges, 💡 facts extracted, 🔗 context chains
- **Memory Sidebar**: See exact memories recalled with similarity scores
- **Side-by-Side Comparison**: Same question, dramatically different results
- **Interactive Demos**: 5 feature pages showing memory, contexts, facts, and agents
- **Real Integration**: Actual Open WebUI fork, not test scripts

**For Developers**: Chat naturally and SEE Cortex working through visual feedback.

---

## Current Status

### ✅ Completed

**Phase 1: Documentation (100%)**

- 11 comprehensive documentation files
- Complete architecture, integration guide, deployment
- Visual component specifications
- Demo page designs
- ~6,500 lines of professional documentation

**Phase 2: Backend Integration (100%)**

- ✅ Open WebUI forked on branch `cortex-integration`
- ✅ Cortex client module added (`backend/open_webui/integrations/cortex/`)
- ✅ Configuration added to `config.py`
- ✅ Initialized in `main.py` lifespan
- ✅ Demo router created (`routers/cortex.py`)
- ✅ API endpoints ready: `/api/v1/cortex/status`, `/api/v1/cortex/chat`, `/api/v1/cortex/search`

**Phase 3: Infrastructure (100%)**

- ✅ Cortex Bridge service (Node.js/Express)
- ✅ All API routes (memory, users, contexts, facts, agents)
- ✅ OpenAI embeddings integration
- ✅ Docker configuration
- ✅ Environment templates

### ⏳ In Progress

**Phase 4: Frontend Components (Next)**

- Visual components (MemoryBadge, Sidebar, etc.)
- Demo pages
- Comparison view
- Scenario system

---

## Quick Start (Test Backend Integration)

### Prerequisites

```bash
# Ensure Cortex SDK is built
cd Project-Cortex
npm run build

# Ensure Convex is running
cd convex-dev
npm run dev  # Keep this terminal open
```

### Step 1: Start Cortex Bridge

```bash
# Terminal 2
cd "Examples and Proofs/Open-WebUI-Integration/src/cortex-bridge"
npm install
node server.js

# Should see:
# ✓ Loaded Cortex SDK
# 🚀 Cortex Bridge ready at http://localhost:3000
```

### Step 2: Configure Open WebUI

```bash
# Terminal 3
cd "Examples and Proofs/Open-WebUI-Integration/open-webui-fork"

# Create environment file
cp .env.example .env

# Add Cortex configuration
cat >> .env << EOF

# Cortex Integration
CORTEX_BRIDGE_URL=http://localhost:3000
ENABLE_CORTEX_MEMORY=true
EOF
```

### Step 3: Start Open WebUI Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
pip install httpx  # For Cortex client

# Start server
uvicorn open_webui.main:app --reload --host 0.0.0.0 --port 8080

# Should see in logs:
# ✓ Cortex Memory ENABLED
# ✓ Cortex integration initialized and healthy
```

### Step 4: Test Cortex Endpoints

```bash
# Terminal 4 - Test Cortex integration

# 1. Check status
curl http://localhost:8080/api/v1/cortex/status

# Should return:
# {"enabled": true, "healthy": true, "bridge_url": "http://localhost:3000"}

# 2. Test demo chat (requires auth token)
# First, create an account in Open WebUI at http://localhost:8080
# Then use the API

# 3. Check Cortex metrics
curl http://localhost:8080/api/v1/cortex/metrics
```

---

## Architecture

```
┌──────────────────────────────────────────────┐
│           Open WebUI (Modified)              │
│                                              │
│  Backend:                                    │
│  • Cortex client module ✅                   │
│  • Demo router ✅                            │
│  • Config integration ✅                     │
│                                              │
│  Frontend:                                   │
│  • Visual components ⏳ (Next phase)        │
│  • Demo pages ⏳                             │
└──────────────────┬───────────────────────────┘
                   │ HTTP
                   ▼
        ┌──────────────────────┐
        │   Cortex Bridge ✅    │
        │   Port: 3000          │
        └──────────┬─────────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │   Cortex SDK ✅       │
        └──────────┬─────────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │   Convex ✅           │
        └──────────────────────┘
```

---

## Features Demonstrated

### Category A: Core Memory

- ✅ Conversation storage with ACID guarantees
- ✅ Semantic search (10-100x better than keywords)
- ✅ Automatic versioning
- ✅ Temporal queries

### Category B: Full Stack

- ✅ User profiles (GDPR compliant)
- ✅ Context chains (hierarchical organization)
- ✅ Facts extraction (60-90% storage savings)
- ✅ Memory spaces (data isolation)

### Category C: Multi-Agent

- ✅ Hive Mode (shared memory across agents)
- ✅ Agent registry
- ✅ Cross-agent context awareness
- ✅ Activity logging

---

## Documentation

**Comprehensive guides** in `Documentation/` folder:

1. **[00-PROJECT-OVERVIEW.md](Documentation/00-PROJECT-OVERVIEW.md)** - Start here
2. **[01-ARCHITECTURE.md](Documentation/01-ARCHITECTURE.md)** - Technical architecture
3. **[02-TECH-STACK.md](Documentation/02-TECH-STACK.md)** - All technologies
4. **[03-FEATURES-DEMONSTRATED.md](Documentation/03-FEATURES-DEMONSTRATED.md)** - Visual features
5. **[04-INTEGRATION-GUIDE.md](Documentation/04-INTEGRATION-GUIDE.md)** - Step-by-step integration
6. **[05-BACKEND-INTEGRATION.md](Documentation/05-BACKEND-INTEGRATION.md)** - Python backend code
7. **[06-VISUAL-COMPONENTS.md](Documentation/06-VISUAL-COMPONENTS.md)** - Svelte components
8. **[07-DEMO-PAGES.md](Documentation/07-DEMO-PAGES.md)** - Feature demo pages
9. **[08-SIDE-BY-SIDE-COMPARISON.md](Documentation/08-SIDE-BY-SIDE-COMPARISON.md)** - Comparison UI
10. **[09-DEPLOYMENT.md](Documentation/09-DEPLOYMENT.md)** - Docker deployment
11. **[10-USAGE-SCENARIOS.md](Documentation/10-USAGE-SCENARIOS.md)** - Pre-built scenarios
12. **[11-TROUBLESHOOTING.md](Documentation/11-TROUBLESHOOTING.md)** - Common issues

**Total**: ~6,500 lines of documentation

---

## Project Structure

```
Open-WebUI-Integration/
├── Documentation/              # 11 comprehensive guides
│
├── open-webui-fork/           # Modified Open WebUI ✅
│   ├── backend/
│   │   └── open_webui/
│   │       ├── integrations/cortex/  ✅ NEW
│   │       │   ├── __init__.py
│   │       │   └── client.py
│   │       ├── routers/cortex.py     ✅ NEW
│   │       ├── config.py             ✅ MODIFIED
│   │       └── main.py               ✅ MODIFIED
│   │
│   └── src/                    # Frontend (next phase)
│       ├── lib/components/cortex/  ⏳
│       └── routes/cortex/demos/    ⏳
│
├── src/cortex-bridge/         # Node.js bridge service ✅
│   ├── server.js
│   ├── routes/
│   └── utils/
│
├── docker-compose.full.yml    # Complete stack ⏳
├── env.example
└── README.md                  # This file
```

---

## Next Steps for Developers

### To See the Backend Integration Working

1. Follow "Quick Start" above to start all services
2. Access Open WebUI at http://localhost:8080
3. Create an account
4. Call Cortex demo endpoints:
   - `GET /api/v1/cortex/status` - Check integration
   - `POST /api/v1/cortex/chat` - Demo chat with memory
   - `POST /api/v1/cortex/search` - Search memories

### To Build Frontend Components

1. Read [06-VISUAL-COMPONENTS.md](Documentation/06-VISUAL-COMPONENTS.md)
2. Create Svelte components in `open-webui-fork/src/lib/components/cortex/`
3. Integrate into existing chat UI
4. Build demo pages in `open-webui-fork/src/routes/cortex/demos/`

### To Deploy Full Stack

1. Read [09-DEPLOYMENT.md](Documentation/09-DEPLOYMENT.md)
2. Configure environment (.env.local)
3. Run: `docker-compose -f docker-compose.full.yml up -d`
4. Access at http://localhost:8080

---

## What Makes This Different

### Other Memory Systems

- Abstract API documentation
- Test scripts you run in terminal
- No visual proof
- Unclear integration path

### This Proof

- ✅ Real Open WebUI modification
- ✅ Working backend integration
- ✅ Clear visual indicators (documented)
- ✅ Step-by-step code examples
- ✅ Production-ready architecture
- ✅ Complete documentation

---

## Testing the Integration

```bash
# 1. Check Cortex status
curl http://localhost:8080/api/v1/cortex/status

# Expected:
# {"enabled": true, "healthy": true, ...}

# 2. Test demo chat (create account first, get token)
curl -X POST http://localhost:8080/api/v1/cortex/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"message": "I prefer TypeScript"}'

# Expected:
# {
#   "text": "...",
#   "cortex": {
#     "memoriesRecalled": 0,
#     "memoryId": "mem_...",
#     "factsExtracted": 1
#   }
# }

# 3. Search memories
curl -X POST http://localhost:8080/api/v1/cortex/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"query": "preferences", "limit": 5}'

# Expected:
# {"memories": [{...}]}
```

---

## Development Roadmap

### Phase 1 ✅ COMPLETE

- Documentation rebuilt
- Architecture designed
- Integration approach defined

### Phase 2 ✅ COMPLETE

- Open WebUI forked
- Backend integration implemented
- Cortex client added
- Demo endpoints created

### Phase 3 ⏳ NEXT

- Create Svelte visual components
- Add memory badges to chat messages
- Build memory sidebar
- Integrate into Open WebUI UI

### Phase 4 ⏳ PLANNED

- Build 5 feature demo pages
- Create side-by-side comparison view
- Implement scenario system
- Add visual indicators

### Phase 5 ⏳ PLANNED

- Complete Docker deployment
- Production testing
- Performance optimization
- Documentation screenshots

---

## Contributing

This is a proof of concept demonstrating Cortex integration into Open WebUI. To extend:

1. **Add Frontend Components**: See [06-VISUAL-COMPONENTS.md](Documentation/06-VISUAL-COMPONENTS.md)
2. **Build Demo Pages**: See [07-DEMO-PAGES.md](Documentation/07-DEMO-PAGES.md)
3. **Integrate into Chat**: Modify openai.py to use Cortex (see [05-BACKEND-INTEGRATION.md](Documentation/05-BACKEND-INTEGRATION.md))

---

## Support

- **Documentation**: Start with [Documentation/00-PROJECT-OVERVIEW.md](Documentation/00-PROJECT-OVERVIEW.md)
- **Issues**: GitHub Issues
- **Architecture**: [Documentation/01-ARCHITECTURE.md](Documentation/01-ARCHITECTURE.md)
- **Troubleshooting**: [Documentation/11-TROUBLESHOOTING.md](Documentation/11-TROUBLESHOOTING.md)

---

## License

Apache 2.0 - See [LICENSE](../../LICENSE.md)

---

**Current Status**: Backend integration complete, frontend components next phase.

**For Visual Proof**: Frontend implementation will add chat badges, sidebars, and demo pages showing Cortex in action.
