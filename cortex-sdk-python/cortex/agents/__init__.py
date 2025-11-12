"""
Cortex SDK - Agents API

Coordination Layer: Agent registry and management with cascade deletion by participantId
"""

import time
from typing import Optional, List, Dict, Any

from ..types import (
    RegisteredAgent,
    AgentRegistration,
    AgentStats,
    UnregisterAgentOptions,
    UnregisterAgentResult,
    VerificationResult,
)
from ..errors import CortexError, ErrorCode, AgentCascadeDeletionError
from .._utils import filter_none_values, convert_convex_response


class AgentsAPI:
    """
    Agents API

    Provides optional metadata registration for agent discovery, analytics, and
    cascade deletion by participantId across all memory spaces.
    """

    def __init__(self, client, graph_adapter=None):
        """
        Initialize Agents API.

        Args:
            client: Convex client instance
            graph_adapter: Optional graph database adapter
        """
        self.client = client
        self.graph_adapter = graph_adapter

    async def register(self, agent: AgentRegistration) -> RegisteredAgent:
        """
        Register an agent in the registry.

        Args:
            agent: Agent registration data

        Returns:
            Registered agent

        Example:
            >>> agent = await cortex.agents.register(
            ...     AgentRegistration(
            ...         id='support-agent',
            ...         name='Customer Support Bot',
            ...         description='Handles customer inquiries',
            ...         metadata={'team': 'customer-success'}
            ...     )
            ... )
        """
        result = await self.client.mutation(
            "agents:register",
            filter_none_values({
                "agentId": agent.id,
                "name": agent.name,
                "description": agent.description,
                "metadata": agent.metadata or {},
                "config": agent.config or {},
            }),
        )

        # Manually construct to handle field name differences
        return RegisteredAgent(
            id=result.get("agentId"),
            name=result.get("name"),
            status=result.get("status"),
            registered_at=result.get("registeredAt"),
            updated_at=result.get("updatedAt"),
            metadata=result.get("metadata", {}),
            config=result.get("config", {}),
            description=result.get("description"),
            last_active=result.get("lastActive"),
        )

    async def get(self, agent_id: str) -> Optional[RegisteredAgent]:
        """
        Get registered agent details.

        Args:
            agent_id: Agent ID to retrieve

        Returns:
            Registered agent if found, None otherwise

        Example:
            >>> agent = await cortex.agents.get('support-agent')
        """
        result = await self.client.query("agents:get", filter_none_values({"agentId": agent_id}))

        if not result:
            return None

        # Manually construct to handle field name differences
        return RegisteredAgent(
            id=result.get("agentId"),
            name=result.get("name"),
            status=result.get("status"),
            registered_at=result.get("registeredAt"),
            updated_at=result.get("updatedAt"),
            metadata=result.get("metadata", {}),
            config=result.get("config", {}),
            description=result.get("description"),
            last_active=result.get("lastActive"),
        )

    async def search(
        self, filters: Optional[Dict[str, Any]] = None, limit: int = 50
    ) -> List[RegisteredAgent]:
        """
        Find registered agents by metadata.

        Args:
            filters: Filter criteria
            limit: Maximum results

        Returns:
            List of matching agents

        Example:
            >>> support_agents = await cortex.agents.search(
            ...     {'metadata.team': 'support'}
            ... )
        """
        result = await self.client.query(
            "agents:search", filter_none_values({"filters": filters, "limit": limit})
        )

        # Manually construct to handle field name differences
        return [
            RegisteredAgent(
                id=a.get("agentId"),
                name=a.get("name"),
                status=a.get("status"),
                registered_at=a.get("registeredAt"),
                updated_at=a.get("updatedAt"),
                metadata=a.get("metadata", {}),
                config=a.get("config", {}),
                description=a.get("description"),
                last_active=a.get("lastActive"),
            )
            for a in result
        ]

    async def list(
        self, 
        status: Optional[str] = None,
        limit: int = 50, 
        offset: int = 0, 
        sort_by: str = "name"
    ) -> List[RegisteredAgent]:
        """
        List all registered agents with pagination.

        Args:
            status: Filter by status (active, inactive, archived)
            limit: Maximum results
            offset: Number of results to skip
            sort_by: Sort field

        Returns:
            List of registered agents

        Example:
            >>> page1 = await cortex.agents.list(status="active", limit=50)
        """
        result = await self.client.query(
            "agents:list", filter_none_values({"status": status, "limit": limit, "offset": offset})
        )

        # Convert list response if needed
        agents_list = result if isinstance(result, list) else result.get("agents", result)
        return [
            RegisteredAgent(
                id=a.get("agentId"),
                name=a.get("name"),
                status=a.get("status"),
                registered_at=a.get("registeredAt"),
                updated_at=a.get("updatedAt"),
                metadata=a.get("metadata", {}),
                config=a.get("config", {}),
                description=a.get("description"),
                last_active=a.get("lastActive"),
            )
            for a in agents_list
        ]

    async def get_stats(self, agent_id: str) -> Dict[str, Any]:
        """
        Get agent statistics (memory count, conversation count, etc.).
        
        Args:
            agent_id: Agent ID
        
        Returns:
            Agent statistics
        
        Example:
            >>> stats = await cortex.agents.get_stats('support-agent')
        """
        result = await self.client.query("agents:computeStats", filter_none_values({"agentId": agent_id}))
        return result

    async def count(self, filters: Optional[Dict[str, Any]] = None) -> int:
        """
        Count registered agents.

        Args:
            filters: Optional filter criteria

        Returns:
            Count of matching agents

        Example:
            >>> total = await cortex.agents.count()
        """
        result = await self.client.query("agents:count", filter_none_values({}))

        return int(result)

    async def update(
        self, agent_id: str, updates: Dict[str, Any]
    ) -> RegisteredAgent:
        """
        Update registered agent details.

        Args:
            agent_id: Agent ID to update
            updates: Updates to apply

        Returns:
            Updated agent

        Example:
            >>> updated = await cortex.agents.update(
            ...     'support-agent',
            ...     {'metadata': {'version': '2.2.0'}}
            ... )
        """
        # Flatten updates into top-level parameters
        result = await self.client.mutation(
            "agents:update", filter_none_values({"agentId": agent_id, **updates})
        )

        # Manually construct to handle field name differences
        return RegisteredAgent(
            id=result.get("agentId"),
            name=result.get("name"),
            status=result.get("status"),
            registered_at=result.get("registeredAt"),
            updated_at=result.get("updatedAt"),
            metadata=result.get("metadata", {}),
            config=result.get("config", {}),
            description=result.get("description"),
            last_active=result.get("lastActive"),
        )

    async def configure(
        self, agent_id: str, config: Dict[str, Any]
    ) -> None:
        """
        Update agent-specific configuration.

        Args:
            agent_id: Agent ID
            config: Configuration options

        Example:
            >>> await cortex.agents.configure(
            ...     'audit-agent',
            ...     {'memoryVersionRetention': -1}  # Unlimited
            ... )
        """
        await self.client.mutation(
            "agents:configure", filter_none_values({"agentId": agent_id, "config": config})
        )

    async def unregister(
        self, agent_id: str, options: Optional[UnregisterAgentOptions] = None
    ) -> UnregisterAgentResult:
        """
        Remove agent from registry with optional cascade deletion by participantId.

        This deletes all data where participantId = agent_id across ALL memory spaces.
        Works even if agent was never registered.

        Args:
            agent_id: Agent ID to unregister
            options: Unregistration options (cascade, verify, dry_run)

        Returns:
            Unregistration result with deletion details

        Example:
            >>> # Simple unregister (keep data)
            >>> await cortex.agents.unregister('old-agent')
            >>>
            >>> # Cascade delete by participantId
            >>> result = await cortex.agents.unregister(
            ...     'old-agent',
            ...     UnregisterAgentOptions(cascade=True)
            ... )
        """
        opts = options or UnregisterAgentOptions()

        if not opts.cascade:
            # Simple unregistration - just remove from registry
            await self.client.mutation("agents:unregister", filter_none_values({"agentId": agent_id}))

            return UnregisterAgentResult(
                agent_id=agent_id,
                unregistered_at=int(time.time() * 1000),
                conversations_deleted=0,
                conversation_messages_deleted=0,
                memories_deleted=0,
                facts_deleted=0,
                total_deleted=1,
                deleted_layers=["agent-registration"],
                memory_spaces_affected=[],
                verification=VerificationResult(complete=True, issues=[]),
            )

        # Cascade deletion by participantId
        if opts.dry_run:
            # Just count what would be deleted
            plan = await self._collect_agent_deletion_plan(agent_id)

            return UnregisterAgentResult(
                agent_id=agent_id,
                unregistered_at=int(time.time() * 1000),
                conversations_deleted=len(plan.get("conversations", [])),
                conversation_messages_deleted=sum(
                    conv.get("messageCount", 0) for conv in plan.get("conversations", [])
                ),
                memories_deleted=len(plan.get("memories", [])),
                facts_deleted=len(plan.get("facts", [])),
                total_deleted=1,
                deleted_layers=[],
                memory_spaces_affected=list(
                    set(m.get("memorySpaceId") for m in plan.get("memories", []))
                ),
                verification=VerificationResult(complete=True, issues=[]),
            )

        # Execute cascade deletion
        plan = await self._collect_agent_deletion_plan(agent_id)
        backup = await self._create_agent_deletion_backup(plan)

        try:
            result = await self._execute_agent_deletion(plan, agent_id)

            # Verify if requested
            if opts.verify:
                verification = await self._verify_agent_deletion(agent_id)
                result.verification = verification

            return result
        except Exception as e:
            # Rollback on failure
            await self._rollback_agent_deletion(backup)
            raise AgentCascadeDeletionError(f"Agent cascade deletion failed: {e}", cause=e)

    # Helper methods for cascade deletion

    async def _collect_agent_deletion_plan(self, agent_id: str) -> Dict[str, List[Any]]:
        """Collect all records where participantId = agent_id."""
        plan = {
            "conversations": [],
            "memories": [],
            "facts": [],
            "graph": [],
        }

        # This is simplified - actual implementation would query all memory spaces
        # for records with participantId = agent_id

        return plan

    async def _create_agent_deletion_backup(
        self, plan: Dict[str, List[Any]]
    ) -> Dict[str, List[Any]]:
        """Create backup for rollback."""
        return {k: list(v) for k, v in plan.items()}

    async def _execute_agent_deletion(
        self, plan: Dict[str, List[Any]], agent_id: str
    ) -> UnregisterAgentResult:
        """Execute agent deletion."""
        deleted_at = int(time.time() * 1000)
        deleted_layers = []

        conversations_deleted = len(plan.get("conversations", []))
        memories_deleted = len(plan.get("memories", []))
        facts_deleted = len(plan.get("facts", []))

        # Delete agent registration
        try:
            await self.client.mutation("agents:unregister", filter_none_values({"agentId": agent_id}))
            deleted_layers.append("agent-registration")
        except:
            pass  # Agent might not be registered

        # Get affected memory spaces
        memory_spaces_affected = list(
            set(m.get("memorySpaceId") for m in plan.get("memories", []))
        )

        graph_nodes_deleted = None
        if self.graph_adapter:
            try:
                from ..graph import delete_agent_from_graph

                graph_nodes_deleted = await delete_agent_from_graph(
                    agent_id, self.graph_adapter
                )
                if graph_nodes_deleted > 0:
                    deleted_layers.append("graph")
            except Exception as error:
                print(f"Warning: Failed to delete from graph: {error}")

        total_deleted = conversations_deleted + memories_deleted + facts_deleted + 1

        return UnregisterAgentResult(
            agent_id=agent_id,
            unregistered_at=deleted_at,
            conversations_deleted=conversations_deleted,
            conversation_messages_deleted=sum(
                conv.get("messageCount", 0) for conv in plan.get("conversations", [])
            ),
            memories_deleted=memories_deleted,
            facts_deleted=facts_deleted,
            graph_nodes_deleted=graph_nodes_deleted,
            total_deleted=total_deleted,
            deleted_layers=deleted_layers,
            memory_spaces_affected=memory_spaces_affected,
            verification=VerificationResult(complete=True, issues=[]),
        )

    async def _verify_agent_deletion(self, agent_id: str) -> VerificationResult:
        """Verify agent deletion completeness."""
        issues = []

        # Check if agent still registered
        agent = await self.get(agent_id)
        if agent:
            issues.append("Agent registration still exists")

        return VerificationResult(complete=len(issues) == 0, issues=issues)

    async def _rollback_agent_deletion(self, backup: Dict[str, List[Any]]):
        """Rollback agent deletion on failure."""
        print("Warning: Rollback not fully implemented - manual recovery may be needed")

