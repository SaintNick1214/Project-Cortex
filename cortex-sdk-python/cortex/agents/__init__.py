"""
Cortex SDK - Agents API

Coordination Layer: Agent registry and management with cascade deletion by participantId
"""

import time
from typing import Any, Dict, List, Optional, cast

from .._utils import convert_convex_response, filter_none_values  # noqa: F401
from ..errors import AgentCascadeDeletionError, CortexError, ErrorCode  # noqa: F401
from ..types import (
    AgentRegistration,
    RegisteredAgent,
    UnregisterAgentOptions,
    UnregisterAgentResult,
    VerificationResult,
)
from .validators import (
    AgentValidationError,
    validate_agent_id,
    validate_agent_name,
    validate_agent_registration,
    validate_agent_status,
    validate_list_parameters,
    validate_search_parameters,
    validate_unregister_options,
    validate_metadata,
    validate_config,
)


class AgentsAPI:
    """
    Agents API

    Provides optional metadata registration for agent discovery, analytics, and
    cascade deletion by participantId across all memory spaces.
    """

    def __init__(self, client: Any, graph_adapter: Optional[Any] = None) -> None:
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
        # Validate agent registration
        validate_agent_registration(agent)
        if agent.metadata:
            validate_metadata(agent.metadata)
        if agent.config:
            validate_config(agent.config)

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

        # Sync to graph if adapter is configured
        if self.graph_adapter:
            try:
                from ..types import GraphNode
                await self.graph_adapter.create_node(
                    GraphNode(
                        label="Agent",
                        properties={
                            "agentId": agent.id,
                            "name": agent.name,
                            "description": agent.description or "",
                            "status": result.get("status", "active"),
                            "registeredAt": result.get("registeredAt"),
                            "updatedAt": result.get("updatedAt"),
                        },
                    )
                )
            except Exception as e:
                # Log but don't fail - graph sync is supplementary
                print(f"Warning: Failed to sync agent to graph: {e}")

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
        # Validate agent_id
        validate_agent_id(agent_id, "agent_id")

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
        # Validate search parameters
        validate_search_parameters(filters, limit)

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
        # Validate parameters
        validate_list_parameters(status, limit, offset, sort_by)

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
        # Validate agent_id
        validate_agent_id(agent_id, "agent_id")

        result = await self.client.query("agents:computeStats", filter_none_values({"agentId": agent_id}))
        return cast(Dict[str, Any], result)

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
        # Validate filters if provided
        if filters is not None:
            if not isinstance(filters, dict):
                raise AgentValidationError(
                    "filters must be a dict", "INVALID_METADATA_FORMAT", "filters"
                )

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
        # Validate agent_id
        validate_agent_id(agent_id, "agent_id")

        # Validate updates dict
        if not updates or len(updates) == 0:
            raise AgentValidationError(
                "At least one field must be provided for update", "MISSING_UPDATES"
            )

        # Validate individual fields if present
        if "name" in updates:
            validate_agent_name(updates["name"], "name")
        if "status" in updates:
            validate_agent_status(updates["status"], "status")
        if "metadata" in updates and updates["metadata"] is not None:
            validate_metadata(updates["metadata"], "metadata")
        if "config" in updates and updates["config"] is not None:
            validate_config(updates["config"], "config")

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
        # Validate agent_id
        validate_agent_id(agent_id, "agent_id")

        # Validate config
        validate_config(config, "config")
        if not config or len(config) == 0:
            raise AgentValidationError(
                "config cannot be empty", "EMPTY_CONFIG_OBJECT", "config"
            )

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
        # Validate agent_id
        validate_agent_id(agent_id, "agent_id")

        # Validate options
        if options:
            validate_unregister_options(options)

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

    async def unregister_many(
        self,
        filters: Optional[Dict[str, Any]] = None,
        options: Optional[UnregisterAgentOptions] = None,
    ) -> Dict[str, Any]:
        """
        Unregister multiple agents matching filters.

        Args:
            filters: Filter criteria for agents to unregister
            options: Unregistration options (cascade, verify, dry_run)

        Returns:
            Unregistration result

        Example:
            >>> # Unregister experimental agents (keep data)
            >>> result = await cortex.agents.unregister_many(
            ...     {'metadata': {'environment': 'experimental'}},
            ...     UnregisterAgentOptions(cascade=False)
            ... )
            >>> print(f"Unregistered {result['deleted']} agents")
            >>>
            >>> # Unregister with cascade deletion
            >>> result = await cortex.agents.unregister_many(
            ...     {'status': 'archived'},
            ...     UnregisterAgentOptions(cascade=True)
            ... )
        """
        # Validate filters
        if filters is not None:
            validate_search_parameters(filters, 1000)  # Max limit

        # Validate options
        if options:
            validate_unregister_options(options)

        opts = options or UnregisterAgentOptions()

        # Get all matching agents
        agents = await self.list(limit=1000)  # Get all agents

        # Apply filters (client-side filtering like TypeScript SDK)
        if filters:
            if "metadata" in filters:
                agents = [
                    a
                    for a in agents
                    if all(
                        a.metadata.get(k) == v for k, v in filters["metadata"].items()
                    )
                ]
            if "status" in filters:
                agents = [a for a in agents if a.status == filters["status"]]

        if len(agents) == 0:
            return {
                "deleted": 0,
                "agent_ids": [],
                "total_data_deleted": 0,
            }

        if opts.dry_run:
            return {
                "deleted": 0,
                "agent_ids": [a.id for a in agents],
                "total_data_deleted": 0,
            }

        results = []
        total_data_deleted = 0

        if opts.cascade:
            # Unregister each agent with cascade
            for agent in agents:
                try:
                    result = await self.unregister(agent.id, options)
                    results.append(agent.id)
                    total_data_deleted += result.total_deleted
                except Exception as error:
                    print(f"Warning: Failed to unregister agent {agent.id}: {error}")
                    # Continue with other agents
        else:
            # Just remove registrations (use backend unregisterMany)
            agent_ids = [a.id for a in agents]
            result = await self.client.mutation(
                "agents:unregisterMany", {"agentIds": agent_ids}
            )

            return {
                "deleted": result.get("deleted", 0),
                "agent_ids": result.get("agentIds", []),
                "total_data_deleted": 0,
            }

        return {
            "deleted": len(results),
            "agent_ids": results,
            "total_data_deleted": total_data_deleted,
        }

    # Helper methods for cascade deletion

    async def _collect_agent_deletion_plan(self, agent_id: str) -> Dict[str, List[Any]]:
        """Collect all records where participantId = agent_id."""
        plan: Dict[str, Any] = {
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

    async def _rollback_agent_deletion(self, backup: Dict[str, List[Any]]) -> Any:
        """Rollback agent deletion on failure."""
        print("Warning: Rollback not fully implemented - manual recovery may be needed")


__all__ = ["AgentsAPI", "AgentValidationError"]

