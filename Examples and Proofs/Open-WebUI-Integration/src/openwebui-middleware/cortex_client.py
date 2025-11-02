"""
Cortex Client
Python client for communicating with Cortex Bridge service
"""

import os
import logging
from typing import Optional, Dict, List, Any
import httpx
from fastapi import HTTPException

logger = logging.getLogger(__name__)

CORTEX_BRIDGE_URL = os.getenv("CORTEX_BRIDGE_URL", "http://cortex-bridge:3000")

class CortexClient:
    """
    Client for communicating with Cortex Bridge
    Provides Python interface to Cortex SDK running in Node.js
    """
    
    def __init__(self, bridge_url: str = CORTEX_BRIDGE_URL):
        self.bridge_url = bridge_url
        self.client = httpx.AsyncClient(timeout=30.0)
        logger.info(f"CortexClient initialized with bridge URL: {bridge_url}")
    
    async def close(self):
        """Close the HTTP client"""
        await self.client.aclose()
    
    # ============================================================================
    # MEMORY OPERATIONS
    # ============================================================================
    
    async def remember(
        self,
        user_id: str,
        conversation_id: str,
        user_message: str,
        agent_response: Optional[str] = None,
        context_id: Optional[str] = None,
        participant_id: Optional[str] = None,
        importance: Optional[int] = None,
        extract_facts: Optional[bool] = None,
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
                    "importance": importance,
                    "extractFacts": extract_facts,
                    "metadata": metadata or {}
                }
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logger.error(f"Error storing memory: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    async def recall(
        self,
        user_id: str,
        query: str,
        limit: int = 10,
        context_id: Optional[str] = None,
        participant_id: Optional[str] = None,
        min_importance: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> List[Dict]:
        """Recall memories from Cortex using semantic search"""
        try:
            response = await self.client.post(
                f"{self.bridge_url}/api/memory/recall",
                json={
                    "userId": user_id,
                    "query": query,
                    "limit": limit,
                    "contextId": context_id,
                    "participantId": participant_id,
                    "minImportance": min_importance,
                    "startDate": start_date,
                    "endDate": end_date
                }
            )
            response.raise_for_status()
            data = response.json()
            return data.get("memories", [])
        except httpx.HTTPError as e:
            logger.error(f"Error recalling memories: {e}")
            # Return empty list as fallback
            return []
    
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
        except httpx.HTTPError as e:
            logger.error(f"Error updating response: {e}")
    
    async def forget(
        self,
        memory_space_id: str,
        memory_id: str,
        delete_facts: bool = True,
        delete_conversation: bool = False
    ) -> Dict:
        """Delete a memory with optional cascade"""
        try:
            response = await self.client.delete(
                f"{self.bridge_url}/api/memory/forget",
                json={
                    "memorySpaceId": memory_space_id,
                    "memoryId": memory_id,
                    "deleteFacts": delete_facts,
                    "deleteConversation": delete_conversation
                }
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logger.error(f"Error forgetting memory: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    # ============================================================================
    # USER MANAGEMENT
    # ============================================================================
    
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
        except httpx.HTTPError as e:
            logger.error(f"Error creating user: {e}")
    
    async def get_user(self, user_id: str) -> Optional[Dict]:
        """Get user profile"""
        try:
            response = await self.client.get(
                f"{self.bridge_url}/api/users/{user_id}"
            )
            response.raise_for_status()
            data = response.json()
            return data.get("user")
        except httpx.HTTPError as e:
            logger.error(f"Error getting user: {e}")
            return None
    
    async def delete_user(
        self,
        user_id: str,
        cascade: bool = True,
        verify: bool = True
    ) -> Dict:
        """Delete user with GDPR cascade"""
        try:
            response = await self.client.delete(
                f"{self.bridge_url}/api/users/{user_id}",
                json={
                    "cascade": cascade,
                    "verify": verify
                }
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logger.error(f"Error deleting user: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    # ============================================================================
    # CONTEXT CHAINS
    # ============================================================================
    
    async def create_context(
        self,
        name: str,
        memory_space_id: str,
        description: Optional[str] = None,
        parent_id: Optional[str] = None,
        metadata: Optional[Dict] = None
    ) -> Dict:
        """Create hierarchical context"""
        try:
            response = await self.client.post(
                f"{self.bridge_url}/api/contexts/create",
                json={
                    "name": name,
                    "description": description,
                    "memorySpaceId": memory_space_id,
                    "parentId": parent_id,
                    "metadata": metadata or {}
                }
            )
            response.raise_for_status()
            data = response.json()
            return data.get("context")
        except httpx.HTTPError as e:
            logger.error(f"Error creating context: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    async def list_contexts(self, memory_space_id: str) -> List[Dict]:
        """List contexts for memory space"""
        try:
            response = await self.client.get(
                f"{self.bridge_url}/api/contexts/{memory_space_id}"
            )
            response.raise_for_status()
            data = response.json()
            return data.get("contexts", [])
        except httpx.HTTPError as e:
            logger.error(f"Error listing contexts: {e}")
            return []
    
    async def get_context_chain(self, context_id: str) -> Dict:
        """Get full context chain"""
        try:
            response = await self.client.get(
                f"{self.bridge_url}/api/contexts/{context_id}/chain"
            )
            response.raise_for_status()
            data = response.json()
            return data.get("chain")
        except httpx.HTTPError as e:
            logger.error(f"Error getting context chain: {e}")
            return {}
    
    # ============================================================================
    # FACTS
    # ============================================================================
    
    async def get_facts(
        self,
        memory_space_id: str,
        context_id: Optional[str] = None,
        fact_type: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict]:
        """Get extracted facts"""
        try:
            params = {
                "limit": limit
            }
            if context_id:
                params["contextId"] = context_id
            if fact_type:
                params["factType"] = fact_type
            
            response = await self.client.get(
                f"{self.bridge_url}/api/facts/{memory_space_id}",
                params=params
            )
            response.raise_for_status()
            data = response.json()
            return data.get("facts", [])
        except httpx.HTTPError as e:
            logger.error(f"Error getting facts: {e}")
            return []
    
    async def extract_facts(
        self,
        content: str,
        memory_space_id: str,
        extractor_type: str = "llm",
        metadata: Optional[Dict] = None
    ) -> List[Dict]:
        """Extract facts from text"""
        try:
            response = await self.client.post(
                f"{self.bridge_url}/api/facts/extract",
                json={
                    "content": content,
                    "memorySpaceId": memory_space_id,
                    "extractorType": extractor_type,
                    "metadata": metadata or {}
                }
            )
            response.raise_for_status()
            data = response.json()
            return data.get("facts", [])
        except httpx.HTTPError as e:
            logger.error(f"Error extracting facts: {e}")
            return []
    
    # ============================================================================
    # AGENT REGISTRY
    # ============================================================================
    
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
        except httpx.HTTPError as e:
            logger.error(f"Error registering agent: {e}")
    
    async def list_agents(self) -> List[Dict]:
        """List all registered agents"""
        try:
            response = await self.client.get(
                f"{self.bridge_url}/api/agents"
            )
            response.raise_for_status()
            data = response.json()
            return data.get("agents", [])
        except httpx.HTTPError as e:
            logger.error(f"Error listing agents: {e}")
            return []


# Global client instance
cortex_client = CortexClient()


def build_context_prompt(memories: List[Dict], user_message: str) -> str:
    """
    Build enriched prompt with Cortex memories
    
    Args:
        memories: List of memory objects from Cortex
        user_message: Current user message
    
    Returns:
        Enriched prompt with context
    """
    if not memories:
        return user_message
    
    context = "# Relevant Context from Memory:\n\n"
    for i, memory in enumerate(memories, 1):
        content = memory.get('content', '')
        timestamp = memory.get('timestamp', '')
        similarity = memory.get('similarity', 0)
        
        context += f"{i}. {content}\n"
        if timestamp:
            context += f"   (from {timestamp}"
            if similarity:
                context += f", relevance: {similarity:.2f}"
            context += ")\n"
        context += "\n"
    
    context += f"\n# Current Question:\n{user_message}\n"
    
    context += "\nUse the above context to provide a more informed and personalized response.\n"
    
    return context

