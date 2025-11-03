# Backend Integration - Open WebUI + Cortex

> **Complete Python Backend Code for Cortex Integration**

This document provides the complete backend integration code, including error handling, logging, and production considerations.

## Table of Contents

- [Overview](#overview)
- [Cortex Client Module](#cortex-client-module)
- [Chat Router Modifications](#chat-router-modifications)
- [Configuration](#configuration)
- [Error Handling](#error-handling)
- [Testing](#testing)

---

## Overview

The backend integration injects Cortex memory into Open WebUI's chat flow at two key points:

1. **Before LLM Call**: Recall relevant memories and augment system prompt
2. **After LLM Response**: Store conversation for future recall

```python
# High-level flow
async def chat_endpoint(request):
    # 1. Recall memories (if Cortex enabled)
    memories = await recall_memories(user_id, query)

    # 2. Augment prompt with memories
    request.system_prompt += build_context(memories)

    # 3. Call LLM with enhanced context
    response = await call_llm(request)

    # 4. Store conversation (if Cortex enabled)
    await store_memory(user_message, ai_response)

    # 5. Return response with Cortex metadata
    return response
```

---

## Cortex Client Module

### Complete Implementation

**File**: `open-webui-fork/backend/apps/cortex/client.py`

```python
"""
Cortex Client for Open WebUI
Complete async HTTP client for Cortex Bridge integration
"""

import httpx
import logging
import time
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime

log = logging.getLogger(__name__)


# ============================================================================
# Data Models
# ============================================================================

class Memory(BaseModel):
    """Memory recall result with metadata"""
    text: str
    similarity: float
    timestamp: str
    conversation_id: str
    memory_id: str
    metadata: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        frozen = True  # Immutable


class MemoryResponse(BaseModel):
    """Response from remember endpoint"""
    success: bool
    memory_id: str
    conversation_id: str
    facts_extracted: int = 0
    storage_location: str = ""

    class Config:
        frozen = True


class Context(BaseModel):
    """Context information"""
    context_id: str
    name: str
    parent_id: Optional[str] = None
    hierarchy: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class CortexHealth(BaseModel):
    """Health check response"""
    status: str
    cortex: str
    bridge_version: str = ""


# ============================================================================
# Cortex Client
# ============================================================================

class CortexClient:
    """
    Async HTTP client for Cortex Bridge

    Provides Python interface to Cortex SDK running in Node.js bridge.
    Handles connection pooling, retries, timeouts, and error handling.

    Usage:
        client = CortexClient("http://localhost:3000")
        memories = await client.recall_memories(user_id, query)
        result = await client.remember(user_id, conv_id, message, response)
    """

    def __init__(
        self,
        bridge_url: str,
        timeout: float = 30.0,
        max_retries: int = 3,
        retry_delay: float = 1.0
    ):
        self.bridge_url = bridge_url.rstrip('/')
        self.timeout = timeout
        self.max_retries = max_retries
        self.retry_delay = retry_delay

        # Create persistent HTTP client with connection pooling
        self.client = httpx.AsyncClient(
            timeout=httpx.Timeout(timeout),
            limits=httpx.Limits(
                max_keepalive_connections=10,
                max_connections=20
            )
        )

        # Metrics
        self._total_recalls = 0
        self._total_stores = 0
        self._failed_recalls = 0
        self._failed_stores = 0

        log.info(
            f"CortexClient initialized: {bridge_url} "
            f"(timeout={timeout}s, retries={max_retries})"
        )

    async def close(self):
        """Close HTTP client and cleanup"""
        await self.client.aclose()
        log.info(
            f"CortexClient closed - "
            f"Recalls: {self._total_recalls} (failed: {self._failed_recalls}), "
            f"Stores: {self._total_stores} (failed: {self._failed_stores})"
        )

    async def health_check(self) -> Optional[CortexHealth]:
        """
        Check if Cortex Bridge is healthy

        Returns:
            CortexHealth object if successful, None if failed
        """
        try:
            response = await self.client.get(f"{self.bridge_url}/health")

            if response.status_code == 200:
                data = response.json()
                return CortexHealth(**data)
            else:
                log.warning(f"Cortex health check returned {response.status_code}")
                return None

        except Exception as e:
            log.error(f"Cortex health check failed: {e}")
            return None

    async def recall_memories(
        self,
        user_id: str,
        query: str,
        limit: int = 5,
        context_id: Optional[str] = None,
        min_similarity: float = 0.7
    ) -> List[Memory]:
        """
        Retrieve relevant memories for a query using semantic search

        Args:
            user_id: User identifier (memory space)
            query: Search query text
            limit: Maximum memories to return (default: 5)
            context_id: Optional context to scope search
            min_similarity: Minimum similarity threshold (0.0-1.0)

        Returns:
            List of Memory objects sorted by relevance (similarity desc)
            Returns empty list on error (fail-safe)

        Example:
            memories = await client.recall_memories(
                user_id="alice-123",
                query="What are my preferences?",
                limit=5
            )

            for memory in memories:
                print(f"{memory.similarity:.0%}: {memory.text}")
        """
        self._total_recalls += 1
        start_time = time.time()

        try:
            payload = {
                "userId": user_id,
                "query": query,
                "limit": limit,
                "minSimilarity": min_similarity
            }

            if context_id:
                payload["contextId"] = context_id

            # Retry logic for transient failures
            last_exception = None
            for attempt in range(self.max_retries):
                try:
                    response = await self.client.post(
                        f"{self.bridge_url}/api/memory/recall",
                        json=payload
                    )

                    response.raise_for_status()
                    data = response.json()

                    memories = [Memory(**m) for m in data.get("memories", [])]

                    duration = time.time() - start_time
                    log.debug(
                        f"Recalled {len(memories)} memories for '{query[:50]}...' "
                        f"in {duration:.2f}s (attempt {attempt + 1})"
                    )

                    return memories

                except httpx.HTTPError as e:
                    last_exception = e
                    if attempt < self.max_retries - 1:
                        await asyncio.sleep(self.retry_delay * (attempt + 1))
                        continue
                    raise

        except Exception as e:
            self._failed_recalls += 1
            log.error(f"Error recalling memories: {e}", exc_info=True)

            # Fail-safe: return empty list so chat can continue
            return []

    async def remember(
        self,
        user_id: str,
        conversation_id: str,
        user_message: str,
        agent_response: str,
        context_id: Optional[str] = None,
        extract_facts: bool = True,
        importance: int = 5,
        metadata: Optional[Dict] = None
    ) -> Optional[MemoryResponse]:
        """
        Store conversation in Cortex with automatic embedding

        Args:
            user_id: User identifier
            conversation_id: Conversation identifier
            user_message: User's message text
            agent_response: AI agent's response text
            context_id: Optional context chain
            extract_facts: Whether to extract structured facts
            importance: Memory importance (1-10)
            metadata: Additional metadata to store

        Returns:
            MemoryResponse with memory_id and facts count
            Returns None on error (fail-safe)

        Example:
            result = await client.remember(
                user_id="alice-123",
                conversation_id="conv-20251103-1423",
                user_message="I prefer TypeScript",
                agent_response="Noted! TypeScript is great...",
                extract_facts=True
            )

            if result:
                print(f"Stored: {result.memory_id}")
                print(f"Facts: {result.facts_extracted}")
        """
        self._total_stores += 1
        start_time = time.time()

        try:
            payload = {
                "userId": user_id,
                "conversationId": conversation_id,
                "userMessage": user_message,
                "agentResponse": agent_response,
                "extractFacts": extract_facts,
                "importance": importance,
                "metadata": metadata or {},
                "timestamp": datetime.utcnow().isoformat()
            }

            if context_id:
                payload["contextId"] = context_id

            # Retry logic
            last_exception = None
            for attempt in range(self.max_retries):
                try:
                    response = await self.client.post(
                        f"{self.bridge_url}/api/memory/remember",
                        json=payload
                    )

                    response.raise_for_status()
                    data = response.json()

                    result = MemoryResponse(**data)

                    duration = time.time() - start_time
                    log.debug(
                        f"Stored memory {result.memory_id} "
                        f"({result.facts_extracted} facts) "
                        f"in {duration:.2f}s (attempt {attempt + 1})"
                    )

                    return result

                except httpx.HTTPError as e:
                    last_exception = e
                    if attempt < self.max_retries - 1:
                        await asyncio.sleep(self.retry_delay * (attempt + 1))
                        continue
                    raise

        except Exception as e:
            self._failed_stores += 1
            log.error(f"Error storing memory: {e}", exc_info=True)

            # Fail-safe: return None so chat can continue
            return None

    async def get_context(self, context_id: str) -> Optional[Context]:
        """Get context information"""
        try:
            response = await self.client.get(
                f"{self.bridge_url}/api/contexts/{context_id}"
            )
            response.raise_for_status()
            return Context(**response.json())
        except Exception as e:
            log.error(f"Error fetching context: {e}")
            return None

    def get_metrics(self) -> Dict[str, int]:
        """Get client metrics"""
        return {
            "total_recalls": self._total_recalls,
            "total_stores": self._total_stores,
            "failed_recalls": self._failed_recalls,
            "failed_stores": self._failed_stores,
            "success_rate_recall": (
                (self._total_recalls - self._failed_recalls) / self._total_recalls * 100
                if self._total_recalls > 0 else 100.0
            ),
            "success_rate_store": (
                (self._total_stores - self._failed_stores) / self._total_stores * 100
                if self._total_stores > 0 else 100.0
            )
        }


# ============================================================================
# Utility Functions
# ============================================================================

def build_context_from_memories(memories: List[Memory], max_tokens: int = 1000) -> str:
    """
    Build context injection text from recalled memories

    Formats memories for inclusion in system prompt. Includes similarity
    scores and timestamps for transparency.

    Args:
        memories: List of Memory objects
        max_tokens: Approximate max tokens (rough estimate: 1 token ≈ 4 chars)

    Returns:
        Formatted context string ready for system prompt injection
    """
    if not memories:
        return ""

    context_lines = [
        "\n" + "="*70,
        "RELEVANT CONTEXT FROM PREVIOUS CONVERSATIONS",
        "="*70,
        "\nUse this information to provide personalized, contextual responses:\n"
    ]

    max_chars = max_tokens * 4  # Rough estimate
    current_chars = sum(len(line) for line in context_lines)

    for i, memory in enumerate(memories, 1):
        memory_text = (
            f"\n{i}. {memory.text}\n"
            f"   (Conversation: {memory.timestamp}, "
            f"Relevance: {int(memory.similarity * 100)}%)"
        )

        if current_chars + len(memory_text) > max_chars:
            context_lines.append(
                f"\n[{len(memories) - i + 1} more memories available but truncated for brevity]"
            )
            break

        context_lines.append(memory_text)
        current_chars += len(memory_text)

    context_lines.append("\n" + "="*70 + "\n")

    return "\n".join(context_lines)


def should_extract_facts(message: str, response: str) -> bool:
    """
    Heuristic to determine if facts should be extracted

    Extract facts when conversations contain:
    - Personal information
    - Preferences and opinions
    - Technical details
    - Structured data

    Skip for:
    - Short conversations
    - Greetings/goodbyes
    - Questions without answers
    """
    combined = f"{message} {response}".lower()

    # Skip if too short
    if len(combined) < 50:
        return False

    # Skip greetings
    greetings = ["hello", "hi", "hey", "goodbye", "bye", "thanks"]
    if any(greet in combined[:30] for greet in greetings):
        return False

    # Extract if contains personal info markers
    personal_markers = [
        "i am", "i'm", "my name", "i prefer", "i like", "i work",
        "email", "phone", "address", "location"
    ]
    if any(marker in combined for marker in personal_markers):
        return True

    # Extract if response is substantial (likely contains useful info)
    if len(response) > 200:
        return True

    return False


# ============================================================================
# Global Client Instance
# ============================================================================

# Global client - initialized in main.py
cortex_client: Optional[CortexClient] = None


def initialize_cortex(
    bridge_url: str,
    timeout: float = 30.0,
    max_retries: int = 3
) -> CortexClient:
    """
    Initialize global Cortex client

    Call this once at application startup.
    """
    global cortex_client
    cortex_client = CortexClient(bridge_url, timeout, max_retries)
    return cortex_client


async def shutdown_cortex():
    """
    Cleanup Cortex client

    Call this at application shutdown.
    """
    global cortex_client
    if cortex_client:
        await cortex_client.close()
        cortex_client = None
```

---

## Chat Router Modifications

### Complete Modified Chat Endpoint

**File**: `open-webui-fork/backend/apps/webui/routers/chats.py`

```python
"""
Chat Router with Cortex Integration
Modified to inject memory recall before LLM and store after response
"""

import time
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

# Existing Open WebUI imports
from apps.webui.models.users import User, get_current_user
# ... other existing imports

# Cortex integration
from apps.cortex.client import (
    cortex_client,
    build_context_from_memories,
    should_extract_facts
)
from config import ENABLE_CORTEX_MEMORY

log = logging.getLogger(__name__)

router = APIRouter()


# ============================================================================
# Request/Response Models
# ============================================================================

class ChatRequest(BaseModel):
    """Chat request with Cortex extensions"""
    message: str
    chat_id: Optional[str] = None
    model: str
    system_prompt: Optional[str] = None
    context_id: Optional[str] = None  # Cortex context
    enable_memory: bool = True  # Per-request override


class ChatResponse(BaseModel):
    """Chat response with Cortex metadata"""
    text: str
    model: str
    cortex: Optional[dict] = None  # Cortex metadata


# ============================================================================
# Main Chat Endpoint
# ============================================================================

@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    user: User = Depends(get_current_user)
):
    """
    Enhanced chat endpoint with Cortex memory integration

    Flow:
    1. Check if Cortex enabled
    2. Recall relevant memories
    3. Augment system prompt with context
    4. Call LLM with enhanced prompt
    5. Store conversation in Cortex
    6. Return response with metadata
    """

    # Initialize response metadata
    cortex_data = {}
    memories_used = []

    # Determine if we should use Cortex for this request
    use_cortex = (
        ENABLE_CORTEX_MEMORY and
        cortex_client is not None and
        request.enable_memory
    )

    # ========================================================================
    # PHASE 1: RECALL MEMORIES (Before LLM)
    # ========================================================================

    if use_cortex:
        try:
            recall_start = time.time()

            # Recall relevant memories
            memories = await cortex_client.recall_memories(
                user_id=user.id,
                query=request.message,
                limit=5,
                context_id=request.context_id,
                min_similarity=0.7
            )

            recall_duration = time.time() - recall_start

            if memories:
                memories_used = memories

                # Build context injection
                context_injection = build_context_from_memories(
                    memories,
                    max_tokens=1000
                )

                # Augment system prompt
                if not request.system_prompt:
                    request.system_prompt = ""

                request.system_prompt = (
                    f"{request.system_prompt}\n{context_injection}"
                )

                # Store metadata
                cortex_data = {
                    "memoriesRecalled": len(memories),
                    "similarityScores": [m.similarity for m in memories],
                    "memories": [
                        {
                            "text": (
                                m.text[:100] + "..."
                                if len(m.text) > 100
                                else m.text
                            ),
                            "similarity": m.similarity,
                            "timestamp": m.timestamp,
                            "memoryId": m.memory_id
                        }
                        for m in memories
                    ],
                    "recallDuration": round(recall_duration, 3)
                }

                log.info(
                    f"Recalled {len(memories)} memories for user {user.id} "
                    f"in {recall_duration:.2f}s"
                )
            else:
                log.debug(f"No memories found for query: {request.message[:50]}...")
                cortex_data["memoriesRecalled"] = 0

        except Exception as e:
            log.error(f"Memory recall failed: {e}", exc_info=True)
            # Continue without memories on error
            cortex_data["recallError"] = str(e)

    # ========================================================================
    # PHASE 2: CALL LLM (Existing Open WebUI Logic)
    # ========================================================================

    try:
        llm_start = time.time()

        # Call your existing LLM function here
        # This is Open WebUI's existing logic
        response_text = await call_llm_api(
            message=request.message,
            model=request.model,
            system_prompt=request.system_prompt,
            # ... other parameters
        )

        llm_duration = time.time() - llm_start

        if use_cortex:
            cortex_data["llmDuration"] = round(llm_duration, 3)

    except Exception as e:
        log.error(f"LLM call failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"LLM error: {str(e)}")

    # ========================================================================
    # PHASE 3: STORE CONVERSATION (After LLM)
    # ========================================================================

    if use_cortex:
        try:
            store_start = time.time()

            # Determine if we should extract facts
            extract_facts = should_extract_facts(
                request.message,
                response_text
            )

            # Store conversation
            memory_result = await cortex_client.remember(
                user_id=user.id,
                conversation_id=(
                    request.chat_id or
                    f"chat_{user.id}_{int(time.time())}"
                ),
                user_message=request.message,
                agent_response=response_text,
                context_id=request.context_id,
                extract_facts=extract_facts,
                importance=5,  # Default importance
                metadata={
                    "model": request.model,
                    "memoriesUsed": len(memories_used),
                    "timestamp": time.time()
                }
            )

            store_duration = time.time() - store_start

            if memory_result:
                cortex_data.update({
                    "memoryId": memory_result.memory_id,
                    "factsExtracted": memory_result.facts_extracted,
                    "storeDuration": round(store_duration, 3)
                })

                log.info(
                    f"Stored memory {memory_result.memory_id} "
                    f"({memory_result.facts_extracted} facts) "
                    f"in {store_duration:.2f}s"
                )
            else:
                log.warning("Memory storage returned None")
                cortex_data["storeError"] = "Storage failed"

        except Exception as e:
            log.error(f"Memory storage failed: {e}", exc_info=True)
            # Continue even if storage fails
            cortex_data["storeError"] = str(e)

    # ========================================================================
    # PHASE 4: RETURN RESPONSE
    # ========================================================================

    return ChatResponse(
        text=response_text,
        model=request.model,
        cortex=cortex_data if cortex_data else None
    )


# ============================================================================
# Additional Endpoints
# ============================================================================

@router.get("/cortex/metrics")
async def get_cortex_metrics(user: User = Depends(get_current_user)):
    """Get Cortex client metrics"""
    if not cortex_client:
        raise HTTPException(status_code=503, detail="Cortex not enabled")

    return cortex_client.get_metrics()


@router.post("/cortex/search")
async def search_memories(
    query: str,
    limit: int = 10,
    user: User = Depends(get_current_user)
):
    """Direct memory search endpoint for demo pages"""
    if not cortex_client:
        raise HTTPException(status_code=503, detail="Cortex not enabled")

    memories = await cortex_client.recall_memories(
        user_id=user.id,
        query=query,
        limit=limit
    )

    return {"memories": memories}
```

---

## Configuration

**File**: `open-webui-fork/backend/config.py`

```python
# ... existing config

####################################
# CORTEX INTEGRATION
####################################

# Cortex Bridge URL
CORTEX_BRIDGE_URL = os.environ.get(
    "CORTEX_BRIDGE_URL",
    "http://localhost:3000"
)

# Enable/disable Cortex memory
ENABLE_CORTEX_MEMORY = (
    os.environ.get("ENABLE_CORTEX_MEMORY", "false").lower() == "true"
)

# Cortex settings
CORTEX_TIMEOUT = float(os.environ.get("CORTEX_TIMEOUT", "30.0"))
CORTEX_MAX_RETRIES = int(os.environ.get("CORTEX_MAX_RETRIES", "3"))
CORTEX_MIN_SIMILARITY = float(os.environ.get("CORTEX_MIN_SIMILARITY", "0.7"))

# Log configuration
if ENABLE_CORTEX_MEMORY:
    log.info(f"✓ Cortex Memory ENABLED")
    log.info(f"  Bridge URL: {CORTEX_BRIDGE_URL}")
    log.info(f"  Timeout: {CORTEX_TIMEOUT}s")
    log.info(f"  Max Retries: {CORTEX_MAX_RETRIES}")
    log.info(f"  Min Similarity: {CORTEX_MIN_SIMILARITY}")
else:
    log.info("✗ Cortex Memory DISABLED")
```

---

## Error Handling

### Best Practices

```python
# 1. Always fail-safe
try:
    memories = await cortex_client.recall_memories(...)
except Exception:
    memories = []  # Continue without memories

# 2. Log errors with context
log.error(f"Cortex error for user {user_id}: {e}", exc_info=True)

# 3. Include metrics in responses
cortex_data["recallError"] = str(e)

# 4. Health checks
if cortex_client:
    health = await cortex_client.health_check()
    if not health:
        log.warning("Cortex Bridge unhealthy")
```

---

## Testing

### Unit Tests

```python
# test_cortex_client.py
import pytest
from apps.cortex.client import CortexClient, Memory

@pytest.mark.asyncio
async def test_recall_memories():
    client = CortexClient("http://localhost:3000")

    memories = await client.recall_memories(
        user_id="test-user",
        query="test query"
    )

    assert isinstance(memories, list)
    assert all(isinstance(m, Memory) for m in memories)

    await client.close()
```

### Integration Tests

```bash
# Start Cortex Bridge
cd src/cortex-bridge
node server.js &

# Run backend tests
cd open-webui-fork/backend
pytest tests/test_cortex_integration.py -v
```

---

## Next Steps

- **Visual Components** → [06-VISUAL-COMPONENTS.md](06-VISUAL-COMPONENTS.md)
- **Demo Pages** → [07-DEMO-PAGES.md](07-DEMO-PAGES.md)
- **Deployment** → [09-DEPLOYMENT.md](09-DEPLOYMENT.md)
