# Integration Guide - Open WebUI + Cortex

> **Step-by-Step: Modify Open WebUI to Use Cortex Memory**

This guide walks through the complete integration process, from forking Open WebUI to deploying the Cortex-enabled version.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Phase 1: Setup](#phase-1-setup)
- [Phase 2: Backend Integration](#phase-2-backend-integration)
- [Phase 3: Frontend Visual Components](#phase-3-frontend-visual-components)
- [Phase 4: Demo Pages](#phase-4-demo-pages)
- [Phase 5: Testing](#phase-5-testing)
- [Phase 6: Production Deployment](#phase-6-production-deployment)

---

## Prerequisites

### Required Software

```bash
# Check versions
node --version    # Should be 18.0.0+
python --version  # Should be 3.11+
docker --version  # Should be 24.0+
git --version     # Any recent version
```

### Required Accounts & Keys

- ✅ Convex account (free tier: convex.dev)
- ✅ OpenAI API key (for embeddings)
- ✅ LLM provider API key (OpenAI/Anthropic) or local Ollama

### Skills Required

- Python (FastAPI, async/await)
- JavaScript/TypeScript (Svelte basics)
- Docker basics
- Git basics

---

## Phase 1: Setup

### Step 1.1: Fork and Clone Open WebUI

```bash
# Navigate to integration directory
cd "Examples and Proofs/Open-WebUI-Integration"

# Clone Open WebUI
git clone https://github.com/open-webui/open-webui.git open-webui-fork
cd open-webui-fork

# Create integration branch
git checkout -b cortex-integration

# Verify structure
ls -la
# Should see: backend/, src/, package.json, etc.
```

### Step 1.2: Start Cortex Bridge

```bash
# In separate terminal, start Cortex Bridge
cd "../src/cortex-bridge"

# Install dependencies
npm install

# Create .env if doesn't exist
cp ../../.env.local .env

# Start bridge
node server.js

# Should see:
# ✓ Loaded Cortex SDK from local build
# 🚀 Cortex Bridge ready at http://localhost:3000
```

### Step 1.3: Configure Environment

**File**: `open-webui-fork/.env`

```bash
# Copy example
cp .env.example .env

# Add Cortex configuration
echo "" >> .env
echo "# Cortex Integration" >> .env
echo "CORTEX_BRIDGE_URL=http://localhost:3000" >> .env
echo "ENABLE_CORTEX_MEMORY=true" >> .env
```

---

## Phase 2: Backend Integration

### Step 2.1: Add Configuration

**File**: `open-webui-fork/backend/config.py`

**Add at end of file:**

```python
####################################
# CORTEX INTEGRATION
####################################

CORTEX_BRIDGE_URL = os.environ.get("CORTEX_BRIDGE_URL", "")
ENABLE_CORTEX_MEMORY = os.environ.get("ENABLE_CORTEX_MEMORY", "false").lower() == "true"

# Log configuration
if ENABLE_CORTEX_MEMORY:
    log.info(f"Cortex Memory ENABLED - Bridge URL: {CORTEX_BRIDGE_URL}")
else:
    log.info("Cortex Memory DISABLED")
```

### Step 2.2: Create Cortex Client Module

**File**: `open-webui-fork/backend/apps/cortex/__init__.py`

```python
"""Cortex integration module for Open WebUI"""
```

**File**: `open-webui-fork/backend/apps/cortex/client.py`

```python
"""
Cortex Client
Async HTTP client for Cortex Bridge communication
"""

import httpx
import logging
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

log = logging.getLogger(__name__)


class Memory(BaseModel):
    """Memory recall result"""
    text: str
    similarity: float
    timestamp: str
    conversation_id: str
    metadata: Dict[str, Any] = Field(default_factory=dict)


class MemoryResponse(BaseModel):
    """Response from remember endpoint"""
    memory_id: str
    conversation_id: str
    facts_extracted: int = 0
    success: bool = True


class CortexClient:
    """
    Client for communicating with Cortex Bridge
    Provides Python interface to Cortex SDK
    """

    def __init__(self, bridge_url: str):
        self.bridge_url = bridge_url
        self.client = httpx.AsyncClient(timeout=30.0)
        log.info(f"CortexClient initialized: {bridge_url}")

    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()

    async def health_check(self) -> bool:
        """Check if bridge is responding"""
        try:
            response = await self.client.get(f"{self.bridge_url}/health")
            return response.status_code == 200
        except Exception as e:
            log.error(f"Cortex Bridge health check failed: {e}")
            return False

    async def recall_memories(
        self,
        user_id: str,
        query: str,
        limit: int = 5,
        context_id: Optional[str] = None
    ) -> List[Memory]:
        """
        Retrieve relevant memories for a query

        Args:
            user_id: User identifier
            query: Search query text
            limit: Maximum memories to return
            context_id: Optional context to scope search

        Returns:
            List of Memory objects with similarity scores
        """
        try:
            payload = {
                "userId": user_id,
                "query": query,
                "limit": limit
            }

            if context_id:
                payload["contextId"] = context_id

            response = await self.client.post(
                f"{self.bridge_url}/api/memory/recall",
                json=payload
            )

            response.raise_for_status()
            data = response.json()

            memories = [Memory(**m) for m in data.get("memories", [])]
            log.debug(f"Recalled {len(memories)} memories for query: {query[:50]}...")

            return memories

        except Exception as e:
            log.error(f"Error recalling memories: {e}")
            return []

    async def remember(
        self,
        user_id: str,
        conversation_id: str,
        user_message: str,
        agent_response: str,
        context_id: Optional[str] = None,
        extract_facts: bool = True,
        metadata: Optional[Dict] = None
    ) -> Optional[MemoryResponse]:
        """
        Store conversation in Cortex

        Args:
            user_id: User identifier
            conversation_id: Conversation identifier
            user_message: User's message text
            agent_response: AI agent's response
            context_id: Optional context
            extract_facts: Whether to extract facts
            metadata: Additional metadata

        Returns:
            MemoryResponse with memory_id and facts count
        """
        try:
            payload = {
                "userId": user_id,
                "conversationId": conversation_id,
                "userMessage": user_message,
                "agentResponse": agent_response,
                "extractFacts": extract_facts,
                "metadata": metadata or {}
            }

            if context_id:
                payload["contextId"] = context_id

            response = await self.client.post(
                f"{self.bridge_url}/api/memory/remember",
                json=payload
            )

            response.raise_for_status()
            data = response.json()

            result = MemoryResponse(**data)
            log.debug(f"Stored memory: {result.memory_id}")

            return result

        except Exception as e:
            log.error(f"Error storing memory: {e}")
            return None


def build_context_from_memories(memories: List[Memory]) -> str:
    """
    Build context injection text from recalled memories

    Args:
        memories: List of Memory objects

    Returns:
        Formatted context string for system prompt
    """
    if not memories:
        return ""

    context_lines = [
        "\n## Relevant Context from Previous Conversations\n",
        "Use this information to provide more personalized and contextual responses:\n"
    ]

    for i, memory in enumerate(memories, 1):
        context_lines.append(
            f"{i}. {memory.text} "
            f"(from conversation on {memory.timestamp}, "
            f"similarity: {int(memory.similarity * 100)}%)"
        )

    return "\n".join(context_lines)


# Global client instance
# Will be initialized in main.py
cortex_client: Optional[CortexClient] = None


def initialize_cortex(bridge_url: str) -> CortexClient:
    """Initialize global Cortex client"""
    global cortex_client
    cortex_client = CortexClient(bridge_url)
    return cortex_client
```

### Step 2.3: Initialize Client in Main

**File**: `open-webui-fork/backend/main.py`

**Add after imports:**

```python
from apps.cortex.client import initialize_cortex
from config import CORTEX_BRIDGE_URL, ENABLE_CORTEX_MEMORY
```

**Add before `app = FastAPI(...)` line:**

```python
# Initialize Cortex if enabled
if ENABLE_CORTEX_MEMORY and CORTEX_BRIDGE_URL:
    initialize_cortex(CORTEX_BRIDGE_URL)
    log.info("Cortex integration initialized")
```

### Step 2.4: Modify Chat Router

**File**: `open-webui-fork/backend/apps/webui/routers/chats.py`

**Add imports at top:**

```python
from apps.cortex.client import cortex_client, build_context_from_memories
from config import ENABLE_CORTEX_MEMORY
```

**Find the main chat endpoint (usually `@router.post("/chat")` or similar)**

**Modify to add Cortex integration:**

```python
@router.post("/chat")
async def chat(
    request: ChatRequest,
    user: User = Depends(get_current_user)
):
    """
    Chat endpoint with Cortex memory integration
    """

    # Initialize response metadata
    cortex_data = {}

    # CORTEX INTEGRATION: Recall relevant memories
    if ENABLE_CORTEX_MEMORY and cortex_client:
        try:
            # Recall memories for context
            memories = await cortex_client.recall_memories(
                user_id=user.id,
                query=request.message,
                limit=5,
                context_id=request.context_id if hasattr(request, 'context_id') else None
            )

            if memories:
                # Augment system prompt with memories
                context_injection = build_context_from_memories(memories)

                if not request.system_prompt:
                    request.system_prompt = ""

                request.system_prompt = f"{request.system_prompt}\n{context_injection}"

                # Store metadata for response
                cortex_data = {
                    "memoriesRecalled": len(memories),
                    "similarityScores": [m.similarity for m in memories],
                    "memories": [
                        {
                            "text": m.text[:100] + "..." if len(m.text) > 100 else m.text,
                            "similarity": m.similarity,
                            "timestamp": m.timestamp
                        }
                        for m in memories
                    ]
                }

                log.info(f"Recalled {len(memories)} memories for user {user.id}")

        except Exception as e:
            log.error(f"Error recalling memories: {e}")
            # Continue without memories on error

    # Call LLM with enhanced context
    # (existing LLM call code here)
    response = await call_llm_api(request)  # Your existing function

    # CORTEX INTEGRATION: Store conversation
    if ENABLE_CORTEX_MEMORY and cortex_client:
        try:
            memory_result = await cortex_client.remember(
                user_id=user.id,
                conversation_id=request.chat_id or f"chat_{user.id}_{int(time.time())}",
                user_message=request.message,
                agent_response=response.text,
                context_id=request.context_id if hasattr(request, 'context_id') else None,
                extract_facts=True,
                metadata={
                    "model": request.model,
                    "timestamp": datetime.utcnow().isoformat()
                }
            )

            if memory_result:
                cortex_data.update({
                    "memoryId": memory_result.memory_id,
                    "factsExtracted": memory_result.facts_extracted
                })

                log.info(f"Stored memory: {memory_result.memory_id}")

        except Exception as e:
            log.error(f"Error storing memory: {e}")
            # Continue even if storage fails

    # Add Cortex metadata to response
    if cortex_data:
        if not hasattr(response, 'cortex'):
            response.cortex = cortex_data
        else:
            response.cortex.update(cortex_data)

    return response
```

### Step 2.5: Update Requirements

**File**: `open-webui-fork/backend/requirements.txt`

**Add:**

```
httpx>=0.25.2
```

### Step 2.6: Test Backend Integration

```bash
# From open-webui-fork directory
cd backend

# Create venv if not exists
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install requirements
pip install -r requirements.txt

# Start backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Should see in logs:
# INFO: Cortex integration initialized
# INFO: Cortex Memory ENABLED - Bridge URL: http://localhost:3000
```

**Test in another terminal:**

```bash
# Check health
curl http://localhost:8000/health

# Should include Cortex status
```

---

## Phase 3: Frontend Visual Components

### Step 3.1: Create Cortex Store

**File**: `open-webui-fork/src/lib/stores/cortex.ts`

```typescript
import { writable, derived } from "svelte/store";

export interface Memory {
  text: string;
  similarity: number;
  timestamp: string;
}

export interface CortexData {
  memoriesRecalled: number;
  similarityScores: number[];
  memories: Memory[];
  memoryId?: string;
  factsExtracted?: number;
  enabled: boolean;
}

export interface CortexState {
  recentMemories: Memory[];
  activeContext: string | null;
  factsCount: number;
  enabled: boolean;
}

// Create writable store
function createCortexStore() {
  const { subscribe, set, update } = writable<CortexState>({
    recentMemories: [],
    activeContext: null,
    factsCount: 0,
    enabled: true,
  });

  return {
    subscribe,
    setMemories: (memories: Memory[]) => {
      update((state) => ({
        ...state,
        recentMemories: memories,
      }));
    },
    setContext: (context: string | null) => {
      update((state) => ({
        ...state,
        activeContext: context,
      }));
    },
    incrementFacts: (count: number = 1) => {
      update((state) => ({
        ...state,
        factsCount: state.factsCount + count,
      }));
    },
    toggle: () => {
      update((state) => ({
        ...state,
        enabled: !state.enabled,
      }));
    },
    reset: () => {
      set({
        recentMemories: [],
        activeContext: null,
        factsCount: 0,
        enabled: true,
      });
    },
  };
}

export const cortexStore = createCortexStore();
```

### Step 3.2: Create Memory Badge Component

**File**: `open-webui-fork/src/lib/components/cortex/MemoryBadge.svelte`

```svelte
<script lang="ts">
  export let memoriesRecalled: number = 0;
  export let similarityScores: number[] = [];
  export let memories: any[] = [];

  let showTooltip = false;

  function formatSimilarity(score: number): string {
    return `${Math.round(score * 100)}%`;
  }
</script>

{#if memoriesRecalled > 0}
  <div
    class="memory-badge"
    on:mouseenter={() => showTooltip = true}
    on:mouseleave={() => showTooltip = false}
  >
    <span class="icon">🧠</span>
    <span class="count">{memoriesRecalled} memories</span>
    {#if similarityScores.length > 0}
      <span class="similarity">
        ({formatSimilarity(similarityScores[0])} match)
      </span>
    {/if}

    {#if showTooltip && memories.length > 0}
      <div class="tooltip">
        <div class="tooltip-header">Memories Used:</div>
        {#each memories.slice(0, 3) as memory, i}
          <div class="tooltip-item">
            <div class="tooltip-text">{memory.text}</div>
            <div class="tooltip-similarity">
              {formatSimilarity(memory.similarity)} similarity
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .memory-badge {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.75rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-radius: 1rem;
    font-size: 0.875rem;
    cursor: pointer;
    transition: transform 0.2s;
  }

  .memory-badge:hover {
    transform: scale(1.05);
  }

  .icon {
    font-size: 1rem;
  }

  .similarity {
    opacity: 0.9;
    font-size: 0.8125rem;
  }

  .tooltip {
    position: absolute;
    bottom: 100%;
    left: 0;
    margin-bottom: 0.5rem;
    padding: 0.75rem;
    background: rgba(0, 0, 0, 0.95);
    border-radius: 0.5rem;
    min-width: 300px;
    max-width: 400px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    z-index: 1000;
  }

  .tooltip-header {
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: #667eea;
  }

  .tooltip-item {
    padding: 0.5rem 0;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .tooltip-text {
    font-size: 0.875rem;
    line-height: 1.4;
    margin-bottom: 0.25rem;
  }

  .tooltip-similarity {
    font-size: 0.75rem;
    color: #a8b3cf;
  }
</style>
```

### Step 3.3: Modify Response Message Component

**File**: `open-webui-fork/src/lib/components/chat/Messages/ResponseMessage.svelte`

**Add import:**

```svelte
<script>
  // ... existing imports
  import MemoryBadge from '$lib/components/cortex/MemoryBadge.svelte';

  // ... existing props
  export let cortexData = null;
</script>
```

**Add badge after message content:**

```svelte
<!-- Message content -->
<div class="message-content">
  {@html formattedContent}
</div>

<!-- Cortex badges -->
{#if cortexData}
  <div class="cortex-indicators">
    <MemoryBadge
      memoriesRecalled={cortexData.memoriesRecalled || 0}
      similarityScores={cortexData.similarityScores || []}
      memories={cortexData.memories || []}
    />

    {#if cortexData.factsExtracted > 0}
      <div class="facts-badge">
        💡 {cortexData.factsExtracted} facts extracted
      </div>
    {/if}
  </div>
{/if}
```

**Add styles:**

```svelte
<style>
  .cortex-indicators {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
    flex-wrap: wrap;
  }

  .facts-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.75rem;
    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    color: white;
    border-radius: 1rem;
    font-size: 0.875rem;
  }
</style>
```

---

## Phase 4: Demo Pages

### Step 4.1: Create Memory Demo Page

**File**: `open-webui-fork/src/routes/cortex/demos/memory/+page.svelte`

```svelte
<script>
  import { onMount } from 'svelte';
  import Chat from '$lib/components/chat/Chat.svelte';

  let memories = [];
  let searchQuery = '';
  let searchResults = [];

  async function searchMemories() {
    // Call backend API to search memories
    const response = await fetch('/api/cortex/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: searchQuery })
    });

    searchResults = await response.json();
  }

  onMount(() => {
    // Load recent memories
  });
</script>

<div class="demo-page">
  <h1>Memory Demo</h1>
  <p>Chat naturally and watch memories accumulate. Search semantic

ally to see relevant recalls.</p>

  <div class="demo-layout">
    <div class="chat-section">
      <Chat demoMode="memory" />
    </div>

    <div class="memory-panel">
      <h2>Memory Search</h2>
      <div class="search-box">
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="Search memories..."
        />
        <button on:click={searchMemories}>Search</button>
      </div>

      {#if searchResults.length > 0}
        <div class="results">
          {#each searchResults as result}
            <div class="result-item">
              <div class="result-text">{result.text}</div>
              <div class="result-score">{Math.round(result.similarity * 100)}% match</div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .demo-page {
    max-width: 1400px;
    margin: 0 auto;
    padding: 2rem;
  }

  .demo-layout {
    display: grid;
    grid-template-columns: 1fr 400px;
    gap: 2rem;
    margin-top: 2rem;
  }

  .memory-panel {
    background: white;
    padding: 1.5rem;
    border-radius: 0.5rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .search-box {
    display: flex;
    gap: 0.5rem;
    margin: 1rem 0;
  }

  .search-box input {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 0.25rem;
  }

  .result-item {
    padding: 1rem;
    margin: 0.5rem 0;
    background: #f5f5f5;
    border-radius: 0.25rem;
  }

  .result-score {
    font-size: 0.875rem;
    color: #667eea;
    margin-top: 0.25rem;
  }
</style>
```

---

## Phase 5: Testing

### Test Checklist

```bash
# 1. Backend Health
curl http://localhost:8000/health

# 2. Cortex Bridge Health
curl http://localhost:3000/health

# 3. Memory Storage
# Send a chat message and check logs for:
# "Stored memory: mem_..."

# 4. Memory Recall
# Send follow-up question and check logs for:
# "Recalled X memories for query..."

# 5. Visual Indicators
# Open browser, chat, and verify you see:
# - 🧠 badges on responses
# - Hover tooltips work
# - Sidebar updates
```

---

## Phase 6: Production Deployment

### Docker Compose Setup

**File**: `docker-compose.full.yml` (in integration root)

```yaml
version: "3.8"

services:
  cortex-bridge:
    build: ./src/cortex-bridge
    environment:
      - CONVEX_URL=${CONVEX_URL}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    ports:
      - "3000:3000"

  open-webui:
    build: ./open-webui-fork
    environment:
      - CORTEX_BRIDGE_URL=http://cortex-bridge:3000
      - ENABLE_CORTEX_MEMORY=true
      - DATABASE_URL=postgresql://user:pass@postgres:5432/openwebui
    ports:
      - "8080:8080"
    depends_on:
      - cortex-bridge
      - postgres

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=openwebui
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

**Deploy:**

```bash
docker-compose -f docker-compose.full.yml up -d
```

---

## Next Steps

- **Backend Details** → [05-BACKEND-INTEGRATION.md](05-BACKEND-INTEGRATION.md)
- **Visual Components** → [06-VISUAL-COMPONENTS.md](06-VISUAL-COMPONENTS.md)
- **Demo Pages** → [07-DEMO-PAGES.md](07-DEMO-PAGES.md)
- **Deployment** → [09-DEPLOYMENT.md](09-DEPLOYMENT.md)
