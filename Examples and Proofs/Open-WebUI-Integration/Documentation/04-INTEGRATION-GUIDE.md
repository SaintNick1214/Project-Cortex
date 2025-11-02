# Integration Guide - Open WebUI + Cortex

> **Step-by-step guide to integrating Cortex memory into Open WebUI**

This guide walks you through the complete integration process, from initial setup to production deployment.

## Table of Contents
- [Phase 1: Setup](#phase-1-setup)
- [Phase 2: Memory Hooks](#phase-2-memory-hooks)
- [Phase 3: Feature Integration](#phase-3-feature-integration)
- [Phase 4: Testing](#phase-4-testing)
- [Phase 5: Production Deployment](#phase-5-production-deployment)

---

## Phase 1: Setup

### Step 1.1: Prerequisites

**Required Software:**
```bash
# Check versions
node --version    # Should be 18.0.0+
python --version  # Should be 3.11+
docker --version  # Should be 24.0+
git --version     # Any recent version
```

**Required Accounts:**
- Convex account (free tier: [convex.dev](https://convex.dev))
- OpenAI API key (for embeddings)
- LLM provider API key (OpenAI, Anthropic, or local Ollama)

### Step 1.2: Clone and Directory Setup

```bash
# Clone the Cortex repository
git clone https://github.com/SaintNick1214/Project-Cortex.git
cd Project-Cortex

# Navigate to integration directory
cd "Examples and Proofs/Open-WebUI-Integration"

# Create necessary directories
mkdir -p src/cortex-bridge src/openwebui-middleware data
```

### Step 1.3: Environment Configuration

Create `.env` file:

```bash
# Copy template
cp .env.example .env

# Edit with your values
nano .env
```

**Required Environment Variables:**
```bash
# ============================================
# CONVEX CONFIGURATION
# ============================================
CONVEX_URL=https://your-deployment.convex.cloud

# ============================================
# OPENAI (for embeddings)
# ============================================
OPENAI_API_KEY=sk-...

# ============================================
# LLM PROVIDER (choose one or more)
# ============================================
# Option 1: OpenAI
OPENAI_API_KEY=sk-...

# Option 2: Anthropic Claude
ANTHROPIC_API_KEY=sk-ant-...

# Option 3: Local Ollama
OLLAMA_BASE_URL=http://localhost:11434

# ============================================
# OPEN WEBUI CONFIGURATION
# ============================================
WEBUI_SECRET_KEY=$(openssl rand -hex 32)
WEBUI_JWT_SECRET_KEY=$(openssl rand -hex 32)

# Database (SQLite for dev, PostgreSQL for prod)
DATABASE_URL=sqlite:///data/webui.db

# ============================================
# CORTEX BRIDGE CONFIGURATION
# ============================================
CORTEX_BRIDGE_PORT=3000
CORTEX_BRIDGE_HOST=0.0.0.0

# ============================================
# FEATURE FLAGS
# ============================================
ENABLE_FACTS_EXTRACTION=true
ENABLE_CONTEXT_CHAINS=true
ENABLE_MULTI_AGENT=true
ENABLE_USER_PROFILES=true
```

### Step 1.4: Deploy Cortex Schema to Convex

```bash
# Install Convex CLI globally
npm install -g convex

# Navigate to Convex directory
cd ../../convex-dev

# Login to Convex
convex login

# Initialize (first time only)
convex dev  # Press Ctrl+C after deployment URL appears

# Or deploy to production
convex deploy --prod

# Copy deployment URL to .env file
# CONVEX_URL=https://your-deployment.convex.cloud

# Return to integration directory
cd "../Examples and Proofs/Open-WebUI-Integration"
```

### Step 1.5: Verify Setup

```bash
# Test Convex connection
curl -X POST $CONVEX_URL \
  -H "Content-Type: application/json" \
  -d '{"path":"conversations/list","args":{}}'

# Should return: {"data":[],"status":"success"}
```

---

## Phase 2: Memory Hooks

This phase creates the bridge between Open WebUI and Cortex.

### Step 2.1: Create Cortex Bridge Service

**Create `src/cortex-bridge/package.json`:**
```json
{
  "name": "cortex-bridge",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "dependencies": {
    "@cortexmemory/sdk": "^0.8.0",
    "convex": "^1.28.0",
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "openai": "^4.20.0",
    "winston": "^3.11.0"
  }
}
```

**Create `src/cortex-bridge/server.js`:**
```javascript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Cortex } from '@cortexmemory/sdk';
import OpenAI from 'openai';
import winston from 'winston';

dotenv.config();

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'cortex-bridge.log' })
  ]
});

// Initialize Cortex
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL
});

// Initialize OpenAI for embeddings
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Initialize Express
const app = express();
app.use(cors());
app.use(express.json());

// ============================================
// MEMORY OPERATIONS
// ============================================

/**
 * Store a conversation in Cortex
 */
app.post('/api/memory/remember', async (req, res) => {
  try {
    const {
      userId,
      conversationId,
      userMessage,
      agentResponse,
      contextId,
      participantId,
      metadata
    } = req.body;

    // Generate embedding for semantic search
    const embedding = await generateEmbedding(userMessage);

    // Store in Cortex
    const result = await cortex.memory.remember({
      memorySpaceId: userId,
      conversationId: conversationId || `conv-${Date.now()}`,
      userMessage,
      agentResponse: agentResponse || null,
      userId,
      embedding,
      contextId,
      participantId: participantId || 'default',
      importance: 5,
      extractFacts: process.env.ENABLE_FACTS_EXTRACTION === 'true',
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString()
      }
    });

    logger.info('Memory stored', { conversationId: result.conversationId });
    
    res.json({
      success: true,
      conversationId: result.conversationId,
      memoryId: result.memoryId
    });
  } catch (error) {
    logger.error('Error storing memory', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Recall memories from Cortex
 */
app.post('/api/memory/recall', async (req, res) => {
  try {
    const {
      userId,
      query,
      limit = 10,
      contextId,
      participantId
    } = req.body;

    // Generate query embedding
    const embedding = await generateEmbedding(query);

    // Recall from Cortex
    const memories = await cortex.memory.recall({
      memorySpaceId: userId,
      query,
      embedding,
      limit,
      contextId,
      participantId,
      includeEmbedding: false
    });

    logger.info('Memories recalled', {
      userId,
      count: memories.length
    });

    res.json({
      success: true,
      memories,
      count: memories.length
    });
  } catch (error) {
    logger.error('Error recalling memories', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update conversation with agent response
 */
app.post('/api/memory/update-response', async (req, res) => {
  try {
    const { conversationId, agentResponse } = req.body;

    await cortex.conversations.update({
      conversationId,
      agentResponse
    });

    logger.info('Conversation updated', { conversationId });
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Error updating conversation', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// USER MANAGEMENT
// ============================================

app.post('/api/users/create', async (req, res) => {
  try {
    const { userId, name, email, metadata } = req.body;

    await cortex.users.create({
      userId,
      name,
      email,
      metadata
    });

    logger.info('User created', { userId });
    res.json({ success: true });
  } catch (error) {
    logger.error('Error creating user', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users/:userId', async (req, res) => {
  try {
    const user = await cortex.users.get(req.params.userId);
    res.json({ success: true, user });
  } catch (error) {
    res.status(404).json({ error: 'User not found' });
  }
});

// ============================================
// CONTEXT CHAINS
// ============================================

app.post('/api/contexts/create', async (req, res) => {
  try {
    const { name, description, memorySpaceId, parentId, metadata } = req.body;

    const context = await cortex.contexts.create({
      name,
      description,
      memorySpaceId,
      parentId,
      metadata
    });

    logger.info('Context created', { contextId: context.contextId });
    res.json({ success: true, context });
  } catch (error) {
    logger.error('Error creating context', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/contexts/:memorySpaceId', async (req, res) => {
  try {
    const contexts = await cortex.contexts.list(req.params.memorySpaceId);
    res.json({ success: true, contexts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// FACTS
// ============================================

app.get('/api/facts/:memorySpaceId', async (req, res) => {
  try {
    const { contextId, limit = 50 } = req.query;

    const facts = await cortex.facts.query({
      memorySpaceId: req.params.memorySpaceId,
      contextId,
      limit: parseInt(limit)
    });

    res.json({ success: true, facts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// AGENTS
// ============================================

app.post('/api/agents/register', async (req, res) => {
  try {
    const { agentId, name, capabilities, metadata } = req.body;

    await cortex.agents.register({
      agentId,
      name,
      capabilities,
      metadata
    });

    logger.info('Agent registered', { agentId });
    res.json({ success: true });
  } catch (error) {
    logger.error('Error registering agent', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/agents', async (req, res) => {
  try {
    const agents = await cortex.agents.list();
    res.json({ success: true, agents });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// UTILITIES
// ============================================

async function generateEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text
    });
    return response.data[0].embedding;
  } catch (error) {
    logger.error('Error generating embedding', { error: error.message });
    throw error;
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    cortex: cortex ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Start server
const PORT = process.env.CORTEX_BRIDGE_PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Cortex Bridge running on port ${PORT}`);
  console.log(`🚀 Cortex Bridge ready at http://localhost:${PORT}`);
});
```

### Step 2.2: Create Open WebUI Middleware

**Create `src/openwebui-middleware/cortex_integration.py`:**
```python
"""
Open WebUI Middleware for Cortex Integration
Intercepts chat requests and adds Cortex memory operations
"""

import os
import httpx
import logging
from typing import Optional, Dict, List, Any
from fastapi import HTTPException

logger = logging.getLogger(__name__)

CORTEX_BRIDGE_URL = os.getenv("CORTEX_BRIDGE_URL", "http://cortex-bridge:3000")

class CortexClient:
    """Client for communicating with Cortex Bridge"""
    
    def __init__(self, bridge_url: str = CORTEX_BRIDGE_URL):
        self.bridge_url = bridge_url
        self.client = httpx.AsyncClient(timeout=30.0)
    
    async def remember(
        self,
        user_id: str,
        conversation_id: str,
        user_message: str,
        agent_response: Optional[str] = None,
        context_id: Optional[str] = None,
        participant_id: Optional[str] = None,
        metadata: Optional[Dict] = None
    ) -> Dict:
        """Store a conversation in Cortex"""
        try:
            response = await self.client.post(
                f"{self.bridge_url}/api/memory/remember",
                json={
                    "userId": user_id,
                    "conversationId": conversation_id,
                    "userMessage": user_message,
                    "agentResponse": agent_response,
                    "contextId": context_id,
                    "participantId": participant_id,
                    "metadata": metadata or {}
                }
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Error storing memory: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    async def recall(
        self,
        user_id: str,
        query: str,
        limit: int = 10,
        context_id: Optional[str] = None,
        participant_id: Optional[str] = None
    ) -> List[Dict]:
        """Recall memories from Cortex"""
        try:
            response = await self.client.post(
                f"{self.bridge_url}/api/memory/recall",
                json={
                    "userId": user_id,
                    "query": query,
                    "limit": limit,
                    "contextId": context_id,
                    "participantId": participant_id
                }
            )
            response.raise_for_status()
            data = response.json()
            return data.get("memories", [])
        except Exception as e:
            logger.error(f"Error recalling memories: {e}")
            return []  # Fallback to empty
    
    async def update_response(
        self,
        conversation_id: str,
        agent_response: str
    ) -> None:
        """Update conversation with agent response"""
        try:
            response = await self.client.post(
                f"{self.bridge_url}/api/memory/update-response",
                json={
                    "conversationId": conversation_id,
                    "agentResponse": agent_response
                }
            )
            response.raise_for_status()
        except Exception as e:
            logger.error(f"Error updating response: {e}")
    
    async def create_user(
        self,
        user_id: str,
        name: str,
        email: str,
        metadata: Optional[Dict] = None
    ) -> None:
        """Create user profile in Cortex"""
        try:
            response = await self.client.post(
                f"{self.bridge_url}/api/users/create",
                json={
                    "userId": user_id,
                    "name": name,
                    "email": email,
                    "metadata": metadata or {}
                }
            )
            response.raise_for_status()
        except Exception as e:
            logger.error(f"Error creating user: {e}")
    
    async def register_agent(
        self,
        agent_id: str,
        name: str,
        capabilities: List[str],
        metadata: Optional[Dict] = None
    ) -> None:
        """Register an agent in Cortex"""
        try:
            response = await self.client.post(
                f"{self.bridge_url}/api/agents/register",
                json={
                    "agentId": agent_id,
                    "name": name,
                    "capabilities": capabilities,
                    "metadata": metadata or {}
                }
            )
            response.raise_for_status()
        except Exception as e:
            logger.error(f"Error registering agent: {e}")

# Global client instance
cortex_client = CortexClient()

def build_context_prompt(memories: List[Dict], user_message: str) -> str:
    """Build enriched prompt with Cortex memories"""
    if not memories:
        return user_message
    
    context = "# Relevant Context from Memory:\n\n"
    for i, memory in enumerate(memories, 1):
        context += f"{i}. {memory.get('content', '')}\n"
        if 'timestamp' in memory:
            context += f"   (from {memory['timestamp']})\n"
        context += "\n"
    
    context += f"\n# Current Question:\n{user_message}\n"
    return context
```

### Step 2.3: Integrate Middleware into Open WebUI

**Modify Open WebUI's chat endpoint** (typically in `backend/apps/webui/routers/chats.py`):

```python
from .cortex_integration import cortex_client, build_context_prompt

@router.post("/chat")
async def chat_endpoint(
    request: ChatRequest,
    user: User = Depends(get_current_user)
):
    """Chat endpoint with Cortex memory integration"""
    
    # 1. Store user message in Cortex
    conversation_result = await cortex_client.remember(
        user_id=user.id,
        conversation_id=request.conversation_id or f"conv-{int(time.time())}",
        user_message=request.message,
        context_id=request.context_id,
        participant_id=request.model_id,
        metadata={
            "model": request.model_id,
            "temperature": request.temperature,
            "ip_address": request.client.host
        }
    )
    
    conversation_id = conversation_result["conversationId"]
    
    # 2. Recall relevant context from Cortex
    memories = await cortex_client.recall(
        user_id=user.id,
        query=request.message,
        limit=10,
        context_id=request.context_id,
        participant_id=request.model_id
    )
    
    # 3. Build enriched prompt with context
    enriched_prompt = build_context_prompt(memories, request.message)
    
    # 4. Call LLM with enriched prompt
    response = await llm_client.generate(
        model=request.model_id,
        prompt=enriched_prompt,
        temperature=request.temperature
    )
    
    # 5. Update conversation with agent response
    await cortex_client.update_response(
        conversation_id=conversation_id,
        agent_response=response
    )
    
    # 6. Return response to user
    return {"response": response, "conversation_id": conversation_id}
```

---

## Phase 3: Feature Integration

### Step 3.1: Context Chain Selector

Add UI component for selecting context (optional enhancement):

**Create `src/openwebui-middleware/context_routes.py`:**
```python
from fastapi import APIRouter, Depends
from .cortex_integration import cortex_client

router = APIRouter(prefix="/api/cortex/contexts", tags=["contexts"])

@router.get("/")
async def list_contexts(user: User = Depends(get_current_user)):
    """List all contexts for user"""
    response = await httpx.get(
        f"{CORTEX_BRIDGE_URL}/api/contexts/{user.id}"
    )
    return response.json()

@router.post("/")
async def create_context(
    name: str,
    description: str,
    parent_id: Optional[str] = None,
    user: User = Depends(get_current_user)
):
    """Create new context"""
    response = await httpx.post(
        f"{CORTEX_BRIDGE_URL}/api/contexts/create",
        json={
            "name": name,
            "description": description,
            "memorySpaceId": user.id,
            "parentId": parent_id
        }
    )
    return response.json()
```

### Step 3.2: Facts Viewer

**Create `src/openwebui-middleware/facts_routes.py`:**
```python
@router.get("/api/cortex/facts")
async def get_facts(
    context_id: Optional[str] = None,
    limit: int = 50,
    user: User = Depends(get_current_user)
):
    """Get extracted facts"""
    response = await httpx.get(
        f"{CORTEX_BRIDGE_URL}/api/facts/{user.id}",
        params={"contextId": context_id, "limit": limit}
    )
    return response.json()
```

### Step 3.3: Multi-Agent Switcher

**Register agents on startup:**
```python
# In Open WebUI startup
await cortex_client.register_agent(
    agent_id="gpt-4",
    name="GPT-4",
    capabilities=["reasoning", "coding", "analysis"],
    metadata={"provider": "openai"}
)

await cortex_client.register_agent(
    agent_id="claude-3-opus",
    name="Claude 3 Opus",
    capabilities=["reasoning", "writing"],
    metadata={"provider": "anthropic"}
)
```

---

## Phase 4: Testing

### Step 4.1: Unit Tests

**Test Cortex Bridge:**
```bash
cd src/cortex-bridge
npm test
```

**Test Open WebUI Middleware:**
```bash
cd src/openwebui-middleware
pytest tests/
```

### Step 4.2: Integration Tests

```bash
# Start services
docker-compose up -d

# Run integration tests
npm run test:integration

# Test endpoints
curl -X POST http://localhost:3000/api/memory/remember \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "conversationId": "test-conv",
    "userMessage": "Hello Cortex!"
  }'
```

### Step 4.3: End-to-End Tests

```bash
# Use Playwright or similar
npx playwright test e2e/chat-with-memory.spec.ts
```

---

## Phase 5: Production Deployment

See [06-DEPLOYMENT.md](./06-DEPLOYMENT.md) for detailed production deployment instructions.

---

## Troubleshooting

See [09-TROUBLESHOOTING.md](./09-TROUBLESHOOTING.md) for common issues and solutions.

---

## Next Steps

- **[05-API-INTEGRATION.md](./05-API-INTEGRATION.md)** - Detailed API usage
- **[06-DEPLOYMENT.md](./06-DEPLOYMENT.md)** - Production deployment
- **[07-USAGE-EXAMPLES.md](./07-USAGE-EXAMPLES.md)** - Real-world scenarios

