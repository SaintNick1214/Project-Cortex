# Architecture - Open WebUI + Cortex Integration

> **How Cortex Integrates Into Open WebUI's Chat Flow**

## Table of Contents
- [Open WebUI Architecture](#open-webui-architecture)
- [Cortex Integration Architecture](#cortex-integration-architecture)
- [Data Flow](#data-flow)
- [Component Architecture](#component-architecture)
- [Integration Points](#integration-points)
- [Visual Component Architecture](#visual-component-architecture)

---

## Open WebUI Architecture

### Overview

Open WebUI is a full-stack web application for AI chat interfaces:

```
┌─────────────────────────────────────────────────────┐
│                   Open WebUI                         │
│                                                      │
│  ┌────────────────────┐    ┌─────────────────────┐ │
│  │  Frontend (Port    │◄──►│  Backend (Port      │ │
│  │  8080)             │    │  8080/api)          │ │
│  │                    │    │                     │ │
│  │  • Svelte 4        │    │  • Python 3.11+     │ │
│  │  • SvelteKit       │    │  • FastAPI          │ │
│  │  • Tailwind CSS    │    │  • SQLAlchemy       │ │
│  │  • TypeScript      │    │  • Async I/O        │ │
│  └────────────────────┘    └──────────┬──────────┘ │
│                                       │             │
└───────────────────────────────────────┼─────────────┘
                                        │
                                        ▼
                            ┌──────────────────────┐
                            │  PostgreSQL or       │
                            │  SQLite Database     │
                            └──────────────────────┘
```

### Frontend Structure

**Location**: `open-webui-fork/src/`

```
src/
├── routes/                    # SvelteKit routes (pages)
│   ├── (app)/                # Main application
│   │   ├── c/[id]/          # Chat conversation route
│   │   └── +layout.svelte   # App layout wrapper
│   └── api/                  # Frontend API endpoints
│
├── lib/
│   ├── components/           # Reusable Svelte components
│   │   ├── chat/            # Chat UI components
│   │   │   ├── Chat.svelte
│   │   │   ├── Messages/
│   │   │   │   ├── UserMessage.svelte
│   │   │   │   ├── ResponseMessage.svelte
│   │   │   │   └── SystemMessage.svelte
│   │   │   └── MessageInput.svelte
│   │   │
│   │   ├── layout/          # Layout components
│   │   │   ├── Navbar.svelte
│   │   │   └── Sidebar.svelte
│   │   │
│   │   └── common/          # Common UI elements
│   │
│   ├── stores/              # Svelte stores (state management)
│   │   ├── chats.ts        # Chat history
│   │   └── user.ts         # User state
│   │
│   └── apis/                # API client functions
│       ├── chats/          # Chat API calls
│       └── models/         # Model management
│
└── app.html                 # HTML template
```

**Key Frontend Concepts**:
- **SvelteKit**: File-based routing, server-side rendering
- **Stores**: Reactive state management
- **Components**: Reusable UI building blocks
- **API Layer**: TypeScript functions calling backend

### Backend Structure

**Location**: `open-webui-fork/backend/`

```
backend/
├── open_webui/
│   ├── routers/             # API route handlers
│   │   ├── chats.py        # Chat endpoints
│   │   ├── openai.py       # OpenAI proxy ⭐ INTEGRATION POINT
│   │   └── users.py        # User management
│   │
│   ├── models/              # Database models
│   │   ├── chats.py
│   │   └── users.py
│   │
│   ├── config.py            # Configuration ⭐ INTEGRATION POINT
│   └── main.py              # FastAPI app ⭐ INTEGRATION POINT
│
└── requirements.txt         # Python dependencies
```

**Key Backend Concepts**:
- **FastAPI**: Async Python web framework
- **Routers**: Endpoint handlers organized by domain
- **Models**: SQLAlchemy ORM for database
- **Middleware**: Request/response processing

### Chat Message Flow (Original)

```
User Types Message
       │
       ▼
[MessageInput.svelte]
       │ POST /api/openai/chat/completions
       ▼
[openai.py router]
       │ 1. Load conversation
       │ 2. Format messages
       │ 3. Call LLM API
       ▼
[OpenAI/Anthropic API]
       │ Stream response
       ▼
[openai.py router]
       │ 4. Save to database
       │ 5. Return response
       ▼
[ResponseMessage.svelte]
       │ Display to user
       ▼
User Sees Response
```

---

## Cortex Integration Architecture

### High-Level Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                    Open WebUI (Modified)                          │
│                                                                   │
│  ┌──────────────────┐         ┌──────────────────────┐          │
│  │  Svelte Frontend │         │  Python Backend      │          │
│  │  + Cortex UI     │         │  + Cortex Client     │          │
│  │                  │         │                      │          │
│  │  • Chat UI       │◄────────┤  • Cortex Router     │          │
│  │  • MemoryBadge   │         │  • Client Module     │          │
│  │  • Sidebar       │         │  • Memory Injection  │          │
│  │  • Demo Pages    │         │                      │          │
│  └──────────────────┘         └─────────┬────────────┘          │
│                                          │                        │
└──────────────────────────────────────────┼────────────────────────┘
                                           │ HTTP
                                           ▼
                                ┌──────────────────┐
                                │  Cortex Bridge   │
                                │  (Node.js)       │
                                │                  │
                                │  • Memory API    │
                                │  • Contexts API  │
                                │  • Facts API     │
                                │  • Agents API    │
                                └─────────┬────────┘
                                          │
                                          ▼
                                ┌──────────────────┐
                                │  Cortex SDK      │
                                │  (TypeScript)    │
                                └─────────┬────────┘
                                          │
                                          ▼
                                    ┌──────────┐
                                    │  Convex  │
                                    └──────────┘
```

**Integration Points**:
1. **Backend**: Modified chat router calls Cortex before/after LLM
2. **Frontend**: Visual components show Cortex activity
3. **Bridge**: Node.js service exposes Cortex SDK via HTTP
4. **Storage**: Convex database stores all memory data

---

## Data Flow

### Complete Chat Flow With Cortex

```
User: "I prefer TypeScript for backend"
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│ 1. FRONTEND: MessageInput.svelte                        │
│    • Captures user input                                │
│    • POST /api/openai/chat/completions                  │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│ 2. BACKEND: openai.py router                            │
│    • Receives chat request                              │
│    • Checks: if ENABLE_CORTEX_MEMORY                    │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│ 3. CORTEX CLIENT: recall_memories()                     │
│    • HTTP POST to bridge: /api/memory/recall            │
│    • Query: user message                                │
│    • User: current user ID                              │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│ 4. CORTEX BRIDGE: Memory route handler                  │
│    • await cortex.memory.search()                       │
│    • Returns: relevant memories + similarity scores     │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│ 5. BACKEND: Augment system prompt                       │
│    • Inject memories into context                       │
│    • Format: "User previously mentioned: ..."           │
│    • Add to system prompt before LLM call               │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│ 6. LLM API: Process with enhanced context               │
│    • OpenAI/Anthropic receives augmented prompt         │
│    • Returns response aware of past context             │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│ 7. CORTEX CLIENT: remember()                            │
│    • HTTP POST to bridge: /api/memory/remember          │
│    • Store: user message + AI response                  │
│    • Auto-generate embeddings                           │
│    • Optional: extract facts                            │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│ 8. BACKEND: Return response with metadata               │
│    • Response text                                      │
│    • Cortex metadata: {                                 │
│        memoriesRecalled: 3,                             │
│        similarityScores: [0.95, 0.89, 0.84],            │
│        memoryId: "mem_123",                             │
│        factsExtracted: 1                                │
│      }                                                   │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│ 9. FRONTEND: ResponseMessage.svelte                     │
│    • Displays AI response                               │
│    • IF cortexData present:                             │
│      - Show MemoryBadge: "🧠 3 memories"                │
│      - Show similarity scores on hover                  │
│      - Update MemorySidebar                             │
└─────────────────────────────────────────────────────────┘
```

### Comparison Mode Data Flow

When user toggles "Compare Mode":

```
┌──────────────────────────────────────────────┐
│  User sends: "What did we discuss?"          │
└───────────────┬──────────────────────────────┘
                │
        ┌───────┴────────┐
        │                │
        ▼                ▼
┌───────────────┐  ┌───────────────┐
│ LEFT SIDE     │  │ RIGHT SIDE    │
│ (NO Cortex)   │  │ (WITH Cortex) │
└───────┬───────┘  └───────┬───────┘
        │                  │
        ▼                  ▼
┌───────────────┐  ┌───────────────┐
│ Direct LLM    │  │ Recall → LLM  │
│ No context    │  │ With context  │
└───────┬───────┘  └───────┬───────┘
        │                  │
        ▼                  ▼
┌───────────────┐  ┌───────────────┐
│ "I don't      │  │ "We discussed │
│  have prior   │  │  your TypeS...│
│  context"     │  │  🧠 3 memories│
└───────────────┘  └───────────────┘
```

---

## Component Architecture

### Backend Integration

**File**: `open-webui-fork/backend/open_webui/integrations/cortex/client.py`

```python
class CortexClient:
    """Client for Cortex Bridge HTTP API"""
    
    def __init__(self, bridge_url: str):
        self.bridge_url = bridge_url
        self.client = httpx.AsyncClient()
    
    async def recall_memories(
        self, 
        user_id: str, 
        query: str, 
        limit: int = 5
    ) -> List[Memory]:
        """Retrieve relevant memories for context injection"""
        response = await self.client.post(
            f"{self.bridge_url}/api/memory/recall",
            json={"userId": user_id, "query": query, "limit": limit}
        )
        return response.json()["memories"]
    
    async def remember(
        self,
        user_id: str,
        conversation_id: str,
        user_message: str,
        agent_response: str,
        extract_facts: bool = True
    ) -> MemoryResponse:
        """Store conversation in Cortex"""
        response = await self.client.post(
            f"{self.bridge_url}/api/memory/remember",
            json={
                "userId": user_id,
                "conversationId": conversation_id,
                "userMessage": user_message,
                "agentResponse": agent_response,
                "extractFacts": extract_facts
            }
        )
        return MemoryResponse(**response.json())
```

**File**: `open-webui-fork/backend/open_webui/routers/cortex.py`

```python
from open_webui.integrations.cortex import cortex_client, build_context_from_memories
from open_webui.config import ENABLE_CORTEX_MEMORY

@router.post("/chat")
async def cortex_demo_chat(
    request: ChatRequest,
    user: User = Depends(get_verified_user)
):
    cortex_data = {}
    
    # 1. Recall relevant memories if Cortex enabled
    if ENABLE_CORTEX_MEMORY and cortex_client:
        memories = await cortex_client.recall_memories(
            user_id=user.id,
            query=request.message,
            limit=5
        )
        
        # 2. Augment system prompt with memories
        context_injection = build_context_from_memories(memories)
        request.system_prompt = f"{request.system_prompt}\n{context_injection}"
        
        cortex_data = {
            "memoriesRecalled": len(memories),
            "similarityScores": [m.similarity for m in memories]
        }
    
    # 3. Call LLM with enhanced context
    response = await call_llm(request)
    
    # 4. Store conversation in Cortex
    if ENABLE_CORTEX_MEMORY and cortex_client:
        memory_result = await cortex_client.remember(
            user_id=user.id,
            conversation_id=request.chat_id,
            user_message=request.message,
            agent_response=response.text,
            extract_facts=True
        )
        
        cortex_data.update({
            "memoryId": memory_result.memory_id,
            "factsExtracted": memory_result.facts_extracted
        })
    
    # 5. Return response with Cortex metadata
    return ChatResponse(
        text=response.text,
        cortex=cortex_data
    )
```

---

## Visual Component Architecture

### Frontend Component Hierarchy

```
App Layout (routes/(app)/+layout.svelte)
│
├─ Navbar.svelte
│  └─ CortexToggle.svelte ⭐ NEW
│
├─ Sidebar.svelte (modified)
│  ├─ Chats List
│  └─ Cortex Demos Menu ⭐ NEW
│
└─ Main Content Area
   │
   ├─ Chat View (routes/c/[id]/+page.svelte)
   │  │
   │  ├─ Chat.svelte
   │  │  ├─ Messages Container
   │  │  │  ├─ UserMessage.svelte
   │  │  │  └─ ResponseMessage.svelte (modified)
   │  │  │     ├─ Message Text
   │  │  │     └─ MemoryBadge.svelte ⭐ NEW
   │  │  │        └─ MemoryTooltip.svelte ⭐ NEW
   │  │  │
   │  │  └─ MessageInput.svelte
   │  │
   │  └─ MemorySidebar.svelte ⭐ NEW
   │     ├─ Recent Memories List
   │     ├─ Active Context Display
   │     └─ Facts Extracted Counter
   │
   ├─ Comparison View (routes/cortex/compare/+page.svelte) ⭐ NEW
   │  ├─ Left Panel (No Cortex)
   │  └─ Right Panel (With Cortex)
   │
   └─ Demo Pages (routes/cortex/demos/*) ⭐ NEW
      ├── memory/+page.svelte
      ├── contexts/+page.svelte
      ├── facts/+page.svelte
      ├── agents/+page.svelte
      └── metrics/+page.svelte
```

### Key Visual Components

**1. MemoryBadge.svelte**

```svelte
<script>
  export let memoriesRecalled = 0;
  export let similarityScores = [];
</script>

{#if memoriesRecalled > 0}
  <div class="memory-badge">
    <span class="icon">🧠</span>
    <span class="count">{memoriesRecalled} memories</span>
    <span class="similarity">
      ({Math.round(similarityScores[0] * 100)}%)
    </span>
  </div>
{/if}
```

**2. MemorySidebar.svelte**

```svelte
<script>
  import { cortexStore } from '$lib/stores/cortex';
  
  $: recentMemories = $cortexStore.recentMemories;
  $: factsCount = $cortexStore.factsCount;
</script>

<aside class="memory-sidebar">
  <h3>Memory Insights</h3>
  
  <section>
    <h4>Recent Recalls ({recentMemories.length})</h4>
    {#each recentMemories as memory}
      <div class="memory-item">
        <div>{memory.text}</div>
        <div>{memory.similarity}% match</div>
      </div>
    {/each}
  </section>
  
  <section>
    <h4>Session Stats</h4>
    <div>💡 {factsCount} facts extracted</div>
  </section>
</aside>
```

---

## Integration Points

### Backend Integration Points

1. **`backend/open_webui/config.py`** - Add Cortex configuration
2. **`backend/open_webui/integrations/cortex/client.py`** - Cortex HTTP client
3. **`backend/open_webui/routers/cortex.py`** - Demo endpoints
4. **`backend/open_webui/main.py`** - Initialize Cortex on startup

### Frontend Integration Points

1. **`src/lib/stores/cortex.ts`** - Cortex state management
2. **`src/lib/components/cortex/`** - Visual indicator components
3. **`src/routes/cortex/demos/`** - Feature demonstration pages
4. **`src/routes/cortex/compare/`** - Side-by-side comparison

### External Integration Points

1. **Cortex Bridge** (port 3000) - HTTP API gateway
2. **Convex** - Database backend for Cortex
3. **OpenAI** - Embeddings generation (via Cortex Bridge)

---

## Visual Component Details

### MemoryBadge Component

**Purpose**: Show memory recall activity on chat messages

**Features**:
- Displays count of memories recalled
- Shows top similarity score
- Hover tooltip with memory details
- Click to view full memory list

**Styling**:
- Gradient background (purple to blue)
- Rounded pill shape
- Shadow on hover
- Smooth transitions

### MemorySidebar Component

**Purpose**: Real-time memory insights panel

**Features**:
- Recent memory recalls with similarity scores
- Active context chain display
- Facts extraction counter
- Session statistics
- Collapsible/expandable

**Layout**:
- Fixed position on right side
- Slide-in/out animation
- Sticky header
- Scrollable content

### ComparisonView Component

**Purpose**: Side-by-side before/after demonstration

**Features**:
- Split-screen layout
- Dual chat state (with/without Cortex)
- Shared input sends to both
- Visual difference highlighting
- Metrics comparison

---

## State Management

### Cortex Store

**File**: `src/lib/stores/cortex.ts`

```typescript
export interface CortexState {
  recentMemories: Memory[];
  activeContext: string | null;
  factsCount: number;
  enabled: boolean;
  sidebarOpen: boolean;
}

export const cortexStore = createCortexStore();

// Methods:
// - addMemories(memories)
// - setContext(context)
// - incrementFacts(count)
// - toggleSidebar()
// - reset()
```

---

## Next Steps

- **Implementation Details** → [04-INTEGRATION-GUIDE.md](04-INTEGRATION-GUIDE.md)
- **Visual Components Code** → [06-VISUAL-COMPONENTS.md](06-VISUAL-COMPONENTS.md)
- **Backend Integration Code** → [05-BACKEND-INTEGRATION.md](05-BACKEND-INTEGRATION.md)
- **Deployment Guide** → [09-DEPLOYMENT.md](09-DEPLOYMENT.md)
