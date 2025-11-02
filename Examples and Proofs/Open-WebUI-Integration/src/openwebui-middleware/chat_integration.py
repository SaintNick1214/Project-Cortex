"""
Chat Integration Module
Example integration showing how to override Open WebUI chat endpoint with Cortex memory
"""

import time
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import logging

from .cortex_client import cortex_client, build_context_prompt

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatRequest(BaseModel):
    """Chat request model"""
    message: str
    conversation_id: Optional[str] = None
    context_id: Optional[str] = None
    model_id: str = "gpt-4"
    temperature: float = 0.7
    max_tokens: int = 2000


class ChatResponse(BaseModel):
    """Chat response model"""
    response: str
    conversation_id: str
    memories_recalled: int = 0


# This is a REFERENCE implementation showing the pattern
# In real Open WebUI integration, you would modify the existing chat endpoint

@router.post("/cortex")
async def chat_with_cortex_memory(
    request: ChatRequest,
    user_id: str = "demo-user"  # In real app, get from authentication
):
    """
    Chat endpoint with Cortex memory integration
    
    This demonstrates the pattern for integrating Cortex memory
    into Open WebUI's chat endpoint
    """
    try:
        # Generate conversation ID if not provided
        conversation_id = request.conversation_id or f"conv-{int(time.time())}"
        
        # ========================================================================
        # STEP 1: Store user message in Cortex
        # ========================================================================
        logger.info(f"Storing user message in Cortex (conversation: {conversation_id})")
        
        conversation_result = await cortex_client.remember(
            user_id=user_id,
            conversation_id=conversation_id,
            user_message=request.message,
            context_id=request.context_id,
            participant_id=request.model_id,
            importance=5,
            extract_facts=True,  # Enable facts extraction
            metadata={
                "model": request.model_id,
                "temperature": request.temperature,
                "max_tokens": request.max_tokens
            }
        )
        
        # ========================================================================
        # STEP 2: Recall relevant context from Cortex (Semantic Search)
        # ========================================================================
        logger.info(f"Recalling relevant context for: {request.message[:50]}...")
        
        memories = await cortex_client.recall(
            user_id=user_id,
            query=request.message,
            limit=10,
            context_id=request.context_id,
            participant_id=request.model_id,
            min_importance=3
        )
        
        logger.info(f"Recalled {len(memories)} relevant memories")
        
        # ========================================================================
        # STEP 3: Build enriched prompt with context
        # ========================================================================
        enriched_prompt = build_context_prompt(memories, request.message)
        
        # ========================================================================
        # STEP 4: Call LLM with enriched prompt
        # ========================================================================
        # In real implementation, call your LLM provider here
        # For this demo, we'll return a mock response
        
        llm_response = f"""Based on the context provided, here's my response to: "{request.message}"

[This is where the actual LLM response would go. In a real implementation, you would call OpenAI, Anthropic, Ollama, or another LLM provider with the enriched prompt containing {len(memories)} relevant memories from your conversation history.]

The enriched prompt included context from your previous conversations, ensuring continuity and personalization."""
        
        # ========================================================================
        # STEP 5: Update conversation with agent response
        # ========================================================================
        await cortex_client.update_response(
            conversation_id=conversation_id,
            agent_response=llm_response
        )
        
        logger.info(f"Conversation updated with response")
        
        # ========================================================================
        # STEP 6: Return response to user
        # ========================================================================
        return ChatResponse(
            response=llm_response,
            conversation_id=conversation_id,
            memories_recalled=len(memories)
        )
        
    except Exception as e:
        logger.error(f"Error in chat endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cortex/memories/{user_id}")
async def get_user_memories(
    user_id: str,
    query: Optional[str] = None,
    limit: int = 20
):
    """Get user's conversation memories"""
    try:
        if query:
            memories = await cortex_client.recall(
                user_id=user_id,
                query=query,
                limit=limit
            )
        else:
            # For browsing, you'd use cortex.memory.list()
            # This is a simplified version
            memories = []
        
        return {
            "success": True,
            "memories": memories,
            "count": len(memories)
        }
    except Exception as e:
        logger.error(f"Error getting memories: {e}")
        raise HTTPException(status_code=500, detail=str(e))

