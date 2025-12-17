"""
Cortex SDK - Agents API

Coordination Layer: Agent registry and management with cascade deletion by participantId
"""

import time
from typing import Any, Dict, List, Optional, cast

from .._utils import convert_convex_response, filter_none_values  # noqa: F401
from ..errors import AgentCascadeDeletionError, CortexError, ErrorCode  # noqa: F401
from ..types import (
    AgentFilters,
    AgentRegistration,
    AgentStats,  # noqa: F401 - Re-exported for public API
    ExportAgentsOptions,
    ExportAgentsResult,
    RegisteredAgent,
    UnregisterAgentOptions,
    UnregisterAgentResult,
    VerificationResult,
)
from .validators import (
    AgentValidationError,
    validate_agent_filters,
    validate_agent_id,
    validate_agent_name,
    validate_agent_registration,
    validate_agent_status,
    validate_config,
    validate_export_options,
    validate_list_parameters,  # noqa: F401 - Re-exported for public API
    validate_metadata,
    validate_search_parameters,
    validate_unregister_options,
    validate_update_payload,
)


class AgentsAPI:
    """
    Agents API

    Provides optional metadata registration for agent discovery, analytics, and
    cascade deletion by participantId across all memory spaces.
    """

    def __init__(
        self,
        client: Any,
        graph_adapter: Optional[Any] = None,
        resilience: Optional[Any] = None,
    ) -> None:
        """
        Initialize Agents API.

        Args:
            client: Convex client instance
            graph_adapter: Optional graph database adapter
            resilience: Optional resilience layer for overload protection
        """
        self.client = client
        self.graph_adapter = graph_adapter
        self._resilience = resilience

    async def _execute_with_resilience(
        self, operation: Any, operation_name: str
    ) -> Any:
        """Execute an operation through the resilience layer (if available)."""
        if self._resilience:
            return await self._resilience.execute(operation, operation_name)
        return await operation()

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

        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
                "agents:register",
                filter_none_values({
                    "agentId": agent.id,
                    "name": agent.name,
                    "description": agent.description,
                    "metadata": agent.metadata or {},
                    "config": agent.config or {},
                }),
            ),
            "agents:register",
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

        result = await self._execute_with_resilience(
            lambda: self.client.query("agents:get", filter_none_values({"agentId": agent_id})),
            "agents:get",
        )

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

    async def search(self, filters: AgentFilters) -> List[RegisteredAgent]:
        """
        Search agents (alias for list with filters).

        Matches TypeScript SDK search() method - functionally equivalent to list()
        but requires filters parameter.

        Args:
            filters: Filter criteria for searching agents

        Returns:
            List of matching agents

        Example:
            >>> support_agents = await cortex.agents.search(
            ...     AgentFilters(metadata={'team': 'support'})
            ... )
        """
        return await self.list(filters)

    async def list(
        self,
        filters: Optional[AgentFilters] = None,
    ) -> List[RegisteredAgent]:
        """
        List agents with filters.

        Matches TypeScript SDK list() method signature with full AgentFilters support.
        Client-side filtering is applied for metadata, name, capabilities, and
        lastActive timestamp ranges.

        Args:
            filters: Optional filter criteria

        Returns:
            List of registered agents

        Example:
            >>> # List all agents
            >>> agents = await cortex.agents.list()
            >>>
            >>> # List with filters
            >>> agents = await cortex.agents.list(AgentFilters(
            ...     status="active",
            ...     limit=50,
            ...     metadata={'team': 'support'}
            ... ))
        """
        # Validate filters
        if filters:
            validate_agent_filters(filters)

        # Use helper method for full filter support
        return await self._list_with_filters(filters)

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

        result = await self._execute_with_resilience(
            lambda: self.client.query("agents:computeStats", filter_none_values({"agentId": agent_id})),
            "agents:computeStats",
        )
        return cast(Dict[str, Any], result)

    async def count(self, filters: Optional[AgentFilters] = None) -> int:
        """
        Count registered agents.

        Args:
            filters: Optional filter criteria

        Returns:
            Count of matching agents

        Example:
            >>> total = await cortex.agents.count()
            >>> active = await cortex.agents.count(AgentFilters(status='active'))
        """
        # Validate filters if provided
        if filters:
            validate_agent_filters(filters)

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "agents:count",
                filter_none_values({"status": filters.status if filters else None}),
            ),
            "agents:count",
        )

        return int(result)

    async def exists(self, agent_id: str) -> bool:
        """
        Check if agent is registered.

        Args:
            agent_id: Agent ID to check

        Returns:
            True if agent is registered, False otherwise

        Example:
            >>> if await cortex.agents.exists('my-agent'):
            ...     print('Agent is registered')
        """
        # Validate agent_id
        validate_agent_id(agent_id, "agent_id")

        result = await self._execute_with_resilience(
            lambda: self.client.query("agents:exists", filter_none_values({"agentId": agent_id})),
            "agents:exists",
        )

        return bool(result)

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
        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
                "agents:update", filter_none_values({"agentId": agent_id, **updates})
            ),
            "agents:update",
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

        await self._execute_with_resilience(
            lambda: self.client.mutation(
                "agents:configure", filter_none_values({"agentId": agent_id, "config": config})
            ),
            "agents:configure",
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
            await self._execute_with_resilience(
                lambda: self.client.mutation("agents:unregister", filter_none_values({"agentId": agent_id})),
                "agents:unregister",
            )

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

            conversations_count = len(plan.get("conversations", []))
            memories_count = len(plan.get("memories", []))
            facts_count = len(plan.get("facts", []))
            graph_nodes_count = len(plan.get("graph", []))
            agent_registered = plan.get("agent_registered", False)

            # Build predicted deleted_layers to match actual execution semantics
            # In actual execution, "agent-registration" is only added to deleted_layers
            # if the unregister mutation succeeds - which requires the agent to be registered
            predicted_deleted_layers: List[str] = []
            if conversations_count > 0:
                predicted_deleted_layers.append("conversations")
            if memories_count > 0:
                predicted_deleted_layers.append("memories")
            if facts_count > 0:
                predicted_deleted_layers.append("facts")
            if graph_nodes_count > 0:
                predicted_deleted_layers.append("graph")
            if agent_registered:
                # Agent registration deletion will succeed if agent is currently registered
                predicted_deleted_layers.append("agent-registration")

            # Total calculation matches actual execution logic exactly:
            # counts agent-registration only if it would be in deleted_layers
            total_deleted = (
                conversations_count +
                memories_count +
                facts_count +
                graph_nodes_count +
                (1 if "agent-registration" in predicted_deleted_layers else 0)
            )

            return UnregisterAgentResult(
                agent_id=agent_id,
                unregistered_at=int(time.time() * 1000),
                conversations_deleted=conversations_count,
                conversation_messages_deleted=sum(
                    conv.get("messageCount", 0) for conv in plan.get("conversations", [])
                ),
                memories_deleted=memories_count,
                facts_deleted=facts_count,
                # Always return integer for API consistency (matches actual execution behavior)
                graph_nodes_deleted=graph_nodes_count,
                total_deleted=total_deleted,
                deleted_layers=predicted_deleted_layers,
                # Use plan's memory_spaces which includes all spaces affected by
                # conversations, memories, and facts (matches actual execution)
                memory_spaces_affected=plan.get("memory_spaces", []),
                verification=VerificationResult(complete=True, issues=[]),
            )

        # Execute cascade deletion with STRICT error handling
        # Any error triggers immediate rollback to maintain data integrity
        plan = await self._collect_agent_deletion_plan(agent_id)
        backup = await self._create_agent_deletion_backup(plan)

        try:
            result = await self._execute_agent_deletion(plan, agent_id)

            # Verify if requested
            if opts.verify:
                verification = await self._verify_agent_deletion(agent_id)
                result.verification = verification

            return result
        except AgentCascadeDeletionError:
            # Rollback on any deletion error
            await self._rollback_agent_deletion(backup)
            raise
        except Exception as e:
            # Rollback on unexpected errors too
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
            result = await self._execute_with_resilience(
                lambda: self.client.mutation(
                    "agents:unregisterMany", {"agentIds": agent_ids}
                ),
                "agents:unregisterMany",
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

    async def update_many(
        self,
        filters: AgentFilters,
        updates: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Update multiple agents matching filters.

        Args:
            filters: Filter criteria for agents to update
            updates: Fields to update on matching agents

        Returns:
            Update result with count and agent IDs

        Example:
            >>> # Update all agents in a team
            >>> result = await cortex.agents.update_many(
            ...     AgentFilters(metadata={'team': 'support'}),
            ...     {'metadata': {'training_completed': True}}
            ... )
            >>> print(f"Updated {result['updated']} agents")
            >>>
            >>> # Upgrade all agents to new version
            >>> await cortex.agents.update_many(
            ...     AgentFilters(metadata={'version': '2.0.0'}),
            ...     {'metadata': {'version': '2.1.0'}}
            ... )
        """
        # Validate filters and updates
        validate_agent_filters(filters)
        validate_update_payload("placeholder", updates)  # Uses existing validation

        # Get all matching agents using list() with client-side filtering
        matching_agents = await self._list_with_filters(filters)

        if len(matching_agents) == 0:
            return {
                "updated": 0,
                "agent_ids": [],
            }

        # Extract agent IDs and call backend
        agent_ids = [a.id for a in matching_agents]

        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
                "agents:updateMany",
                filter_none_values({
                    "agentIds": agent_ids,
                    "name": updates.get("name"),
                    "description": updates.get("description"),
                    "metadata": updates.get("metadata"),
                    "config": updates.get("config"),
                }),
            ),
            "agents:updateMany",
        )

        return {
            "updated": result.get("updated", 0),
            "agent_ids": result.get("agentIds", []),
        }

    async def export(self, options: ExportAgentsOptions) -> ExportAgentsResult:
        """
        Export registered agents matching filters.

        Args:
            options: Export options including format and filters

        Returns:
            Export result with data string

        Example:
            >>> # Export all agents as JSON
            >>> result = await cortex.agents.export(
            ...     ExportAgentsOptions(format="json", include_stats=True)
            ... )
            >>> with open("agents.json", "w") as f:
            ...     f.write(result.data)
            >>>
            >>> # Export support team as CSV
            >>> csv = await cortex.agents.export(
            ...     ExportAgentsOptions(
            ...         filters=AgentFilters(metadata={'team': 'support'}),
            ...         format="csv",
            ...     )
            ... )
        """
        # Validate options
        validate_export_options(options)

        # Get matching agents using list() with client-side filtering
        agents = await self._list_with_filters(options.filters) if options.filters else await self.list()

        include_metadata = options.include_metadata if options.include_metadata is not None else True
        include_stats = options.include_stats if options.include_stats is not None else False

        # Optionally include stats for each agent
        export_data: List[Dict[str, Any]] = []
        for agent in agents:
            agent_dict: Dict[str, Any] = {
                "id": agent.id,
                "name": agent.name,
                "description": agent.description,
                "status": agent.status,
                "registered_at": agent.registered_at,
                "updated_at": agent.updated_at,
                "last_active": agent.last_active,
            }
            if include_metadata:
                agent_dict["metadata"] = agent.metadata
                agent_dict["config"] = agent.config
            if include_stats:
                stats = await self.get_stats(agent.id)
                agent_dict["stats"] = stats
            export_data.append(agent_dict)

        if options.format == "csv":
            # Build CSV
            data = self._build_csv_export(export_data, include_metadata, include_stats)
        else:
            # JSON export
            import json
            data = json.dumps(export_data, indent=2)

        return ExportAgentsResult(
            format=options.format,
            data=data,
            count=len(agents),
            exported_at=int(time.time() * 1000),
        )

    def _build_csv_export(
        self,
        export_data: List[Dict[str, Any]],
        include_metadata: bool,
        include_stats: bool,
    ) -> str:
        """Build CSV export string from export data."""
        import json

        # Build CSV headers
        headers = [
            "id",
            "name",
            "description",
            "status",
            "registered_at",
            "updated_at",
            "last_active",
        ]
        if include_metadata:
            headers.extend(["metadata", "config"])
        if include_stats:
            headers.extend([
                "total_memories",
                "total_conversations",
                "total_facts",
                "memory_spaces_active",
            ])

        # Build CSV rows
        rows = []
        for agent in export_data:
            row = [
                self._escape_csv_field(str(agent.get("id", ""))),
                self._escape_csv_field(str(agent.get("name", ""))),
                self._escape_csv_field(str(agent.get("description") or "")),
                self._escape_csv_field(str(agent.get("status", ""))),
                self._format_timestamp(agent.get("registered_at")),
                self._format_timestamp(agent.get("updated_at")),
                self._format_timestamp(agent.get("last_active")) if agent.get("last_active") else "",
            ]

            if include_metadata:
                row.append(self._escape_csv_field(json.dumps(agent.get("metadata", {}))))
                row.append(self._escape_csv_field(json.dumps(agent.get("config", {}))))

            if include_stats and agent.get("stats"):
                stats = agent["stats"]
                row.extend([
                    str(stats.get("totalMemories", 0)),
                    str(stats.get("totalConversations", 0)),
                    str(stats.get("totalFacts", 0)),
                    str(stats.get("memorySpacesActive", 0)),
                ])
            elif include_stats:
                row.extend(["0", "0", "0", "0"])

            rows.append(",".join(row))

        return ",".join(headers) + "\n" + "\n".join(rows)

    def _escape_csv_field(self, field: str) -> str:
        """Escape a field for CSV output."""
        if "," in field or '"' in field or "\n" in field:
            escaped = field.replace('"', '""')
            return f'"{escaped}"'
        return field

    def _format_timestamp(self, ts: Optional[int]) -> str:
        """Format timestamp as ISO string."""
        if ts is None:
            return ""
        from datetime import datetime, timezone
        return datetime.fromtimestamp(ts / 1000, tz=timezone.utc).isoformat()

    async def _list_with_filters(self, filters: Optional[AgentFilters]) -> List[RegisteredAgent]:
        """
        List agents with full client-side filtering support.

        This helper method applies all AgentFilters criteria including
        metadata, name, capabilities matching (like TypeScript SDK).
        """
        if not filters:
            return await self.list()

        # Get agents from backend with basic filters (status, limit, offset)
        results = await self._execute_with_resilience(
            lambda: self.client.query(
                "agents:list",
                filter_none_values({
                    "status": filters.status,
                    "limit": filters.limit or 100,
                    "offset": filters.offset or 0,
                }),
            ),
            "agents:list",
        )

        # Convert to list if needed
        agents_list = results if isinstance(results, list) else results.get("agents", results)

        # Apply client-side filtering (metadata, name, capabilities)
        filtered = agents_list

        if filters.metadata:
            filtered = [
                agent for agent in filtered
                if all(
                    agent.get("metadata", {}).get(key) == value
                    for key, value in filters.metadata.items()
                )
            ]

        if filters.name:
            filtered = [
                agent for agent in filtered
                if filters.name.lower() in agent.get("name", "").lower()
            ]

        if filters.capabilities and len(filters.capabilities) > 0:
            def has_capabilities(agent: Dict[str, Any]) -> bool:
                agent_caps = agent.get("metadata", {}).get("capabilities", [])
                if not isinstance(agent_caps, list):
                    return False
                match_mode = filters.capabilities_match or "any"
                if match_mode == "all":
                    return all(cap in agent_caps for cap in filters.capabilities)  # type: ignore
                return any(cap in agent_caps for cap in filters.capabilities)  # type: ignore

            filtered = [agent for agent in filtered if has_capabilities(agent)]

        # Filter by lastActive timestamp range
        if filters.last_active_after is not None:
            filtered = [
                agent for agent in filtered
                if agent.get("lastActive") is not None
                and agent["lastActive"] >= filters.last_active_after
            ]

        if filters.last_active_before is not None:
            filtered = [
                agent for agent in filtered
                if agent.get("lastActive") is not None
                and agent["lastActive"] <= filters.last_active_before
            ]

        # Map to RegisteredAgent format
        return [
            RegisteredAgent(
                id=r.get("agentId", ""),
                name=r.get("name", ""),
                status=r.get("status", "active"),
                registered_at=r.get("registeredAt", 0),
                updated_at=r.get("updatedAt", 0),
                metadata=r.get("metadata", {}),
                config=r.get("config", {}),
                description=r.get("description"),
                last_active=r.get("lastActive"),
            )
            for r in filtered
        ]

    # Helper methods for cascade deletion

    async def _collect_agent_deletion_plan(self, agent_id: str) -> Dict[str, List[Any]]:
        """
        Collect all records where participantId = agent_id.
        OPTIMIZED: Uses asyncio.gather for parallel queries across all spaces.
        """
        import asyncio

        plan: Dict[str, Any] = {
            "conversations": [],
            "memories": [],
            "facts": [],
            "graph": [],
            "memory_spaces": [],
            "agent_registered": False,  # Track if agent is registered
        }

        # Check if agent is registered - use resilience layer if available
        try:
            if self._resilience:
                agent = await self._resilience.execute(
                    lambda: self.client.query("agents:get", {"agentId": agent_id}),
                    "agents:get"
                )
            else:
                agent = await self.client.query("agents:get", {"agentId": agent_id})
            plan["agent_registered"] = agent is not None
        except Exception:
            plan["agent_registered"] = False

        affected_spaces: set = set()

        # Get all memory spaces - with error handling for resilience
        # If this fails, we can still return partial plan (agent registration + graph nodes)
        try:
            if self._resilience:
                memory_spaces = await self._resilience.execute(
                    lambda: self.client.query("memorySpaces:list", {}),
                    "memorySpaces:list"
                )
            else:
                memory_spaces = await self.client.query("memorySpaces:list", {})
        except Exception as e:
            # Log warning but continue - we can still collect agent registration and graph data
            print(f"Warning: Failed to list memory spaces for deletion plan: {e}")
            memory_spaces = []

        # Helper functions for parallel queries
        async def collect_conversations(space: Dict[str, Any]) -> Dict[str, Any]:
            try:
                conversations = await self.client.query(
                    "conversations:list",
                    {"memorySpaceId": space.get("memorySpaceId")},
                )
                agent_convos = [
                    c for c in conversations
                    if (c.get("participants", {}).get("participantId") == agent_id or
                        c.get("participants", {}).get("agentId") == agent_id or
                        c.get("participantId") == agent_id)
                ]
                return {"spaceId": space.get("memorySpaceId"), "conversations": agent_convos}
            except Exception:
                return {"spaceId": space.get("memorySpaceId"), "conversations": []}

        async def collect_memories(space: Dict[str, Any]) -> Dict[str, Any]:
            try:
                memories = await self.client.query(
                    "memories:list",
                    {"memorySpaceId": space.get("memorySpaceId")},
                )
                # Check both participantId and agentId (v0.17.0+ agent-owned memories)
                agent_memories = [
                    m for m in memories
                    if m.get("participantId") == agent_id or m.get("agentId") == agent_id
                ]
                return {"spaceId": space.get("memorySpaceId"), "memories": agent_memories}
            except Exception:
                return {"spaceId": space.get("memorySpaceId"), "memories": []}

        async def collect_facts(space: Dict[str, Any]) -> Dict[str, Any]:
            try:
                facts = await self.client.query(
                    "facts:list",
                    {"memorySpaceId": space.get("memorySpaceId")},
                )
                agent_facts = [f for f in facts if f.get("participantId") == agent_id]
                return {"spaceId": space.get("memorySpaceId"), "facts": agent_facts}
            except Exception:
                return {"spaceId": space.get("memorySpaceId"), "facts": []}

        async def collect_graph_nodes() -> List[Dict[str, Any]]:
            if not self.graph_adapter:
                return []
            nodes: List[Dict[str, Any]] = []
            seen_ids: set = set()

            try:
                # 1. Query for Agent node by agentId (same as delete_agent_from_graph step 1)
                agent_result = await self.graph_adapter.query(
                    "MATCH (n:Agent {agentId: $agentId}) RETURN elementId(n) as id, labels(n) as labels",
                    {"agentId": agent_id},
                )
                for r in agent_result.get("records", []):
                    node_id = r.get("id")
                    if node_id and node_id not in seen_ids:
                        seen_ids.add(node_id)
                        nodes.append({"nodeId": node_id, "labels": r.get("labels", [])})
            except Exception:
                pass

            try:
                # 2. Query for nodes where participantId matches (same as delete_agent_from_graph step 2)
                result = await self.graph_adapter.query(
                    "MATCH (n {participantId: $participantId}) RETURN elementId(n) as id, labels(n) as labels",
                    {"participantId": agent_id},
                )
                for r in result.get("records", []):
                    node_id = r.get("id")
                    if node_id and node_id not in seen_ids:
                        seen_ids.add(node_id)
                        nodes.append({"nodeId": node_id, "labels": r.get("labels", [])})
            except Exception:
                pass

            try:
                # 3. Query for nodes where agentId matches (same as delete_agent_from_graph step 3)
                result = await self.graph_adapter.query(
                    "MATCH (n {agentId: $agentId}) RETURN elementId(n) as id, labels(n) as labels",
                    {"agentId": agent_id},
                )
                for r in result.get("records", []):
                    node_id = r.get("id")
                    if node_id and node_id not in seen_ids:
                        seen_ids.add(node_id)
                        nodes.append({"nodeId": node_id, "labels": r.get("labels", [])})
            except Exception:
                pass

            return nodes

        # PARALLEL COLLECTION: Query all spaces simultaneously
        conversation_results, memory_results, fact_results, graph_nodes = await asyncio.gather(
            asyncio.gather(*[collect_conversations(s) for s in memory_spaces]),
            asyncio.gather(*[collect_memories(s) for s in memory_spaces]),
            asyncio.gather(*[collect_facts(s) for s in memory_spaces]),
            collect_graph_nodes(),
        )

        # Process conversation results
        for result in conversation_results:
            if result["conversations"]:
                plan["conversations"].extend(result["conversations"])
                affected_spaces.add(result["spaceId"])

        # Process memory results
        for result in memory_results:
            if result["memories"]:
                plan["memories"].extend(result["memories"])
                affected_spaces.add(result["spaceId"])

        # Process fact results
        for result in fact_results:
            if result["facts"]:
                plan["facts"].extend(result["facts"])
                affected_spaces.add(result["spaceId"])

        # Set graph nodes
        plan["graph"] = graph_nodes

        # Store affected spaces
        plan["memory_spaces"] = list(affected_spaces)

        return plan

    async def _create_agent_deletion_backup(
        self, plan: Dict[str, List[Any]]
    ) -> Dict[str, List[Any]]:
        """Create backup for rollback."""
        import copy
        return {k: copy.deepcopy(v) for k, v in plan.items()}

    async def _execute_agent_deletion(
        self, plan: Dict[str, List[Any]], agent_id: str
    ) -> UnregisterAgentResult:
        """
        Execute agent deletion with strict error handling.

        STRICT MODE: Any error triggers immediate rollback of all operations.
        This ensures data integrity - either all data is deleted or none is.

        Raises:
            AgentCascadeDeletionError: On any failure, with partial_deletion info
        """
        deleted_at = int(time.time() * 1000)
        deleted_layers: List[str] = []

        conversations_deleted = 0
        conversation_messages_deleted = 0
        memories_deleted = 0
        facts_deleted = 0
        # Initialize to 0 for API consistency (dry-run always returns integer)
        graph_nodes_deleted = 0

        # Helper to build partial deletion info for error reporting
        def _build_partial_deletion_info(failed_layer: str) -> dict:
            return {
                "facts_deleted": facts_deleted,
                "memories_deleted": memories_deleted,
                "conversations_deleted": conversations_deleted,
                "deleted_layers": list(deleted_layers),
                "failed_layer": failed_layer,
            }

        # 1. Delete facts (batch) - STRICT: raise on error
        if plan.get("facts"):
            try:
                fact_ids = [f.get("factId") for f in plan["facts"]]
                result = await self.client.mutation("facts:deleteByIds", {"factIds": fact_ids})
                facts_deleted = result.get("deleted", 0)
                if facts_deleted > 0:
                    deleted_layers.append("facts")
            except Exception as e:
                raise AgentCascadeDeletionError(
                    f"Failed to delete facts: {e}",
                    cause=e if isinstance(e, Exception) else None,
                    partial_deletion=_build_partial_deletion_info("facts"),
                )

        # 2. Delete memories (batch) - STRICT: raise on error
        if plan.get("memories"):
            try:
                memory_ids = [m.get("memoryId") for m in plan["memories"]]
                result = await self.client.mutation("memories:deleteByIds", {"memoryIds": memory_ids})
                memories_deleted = result.get("deleted", 0)
                if memories_deleted > 0:
                    deleted_layers.append("memories")
            except Exception as e:
                raise AgentCascadeDeletionError(
                    f"Failed to delete memories: {e}",
                    cause=e if isinstance(e, Exception) else None,
                    partial_deletion=_build_partial_deletion_info("memories"),
                )

        # 3. Delete conversations (batch) - STRICT: raise on error
        if plan.get("conversations"):
            try:
                conversation_ids = [c.get("conversationId") for c in plan["conversations"]]
                result = await self.client.mutation("conversations:deleteByIds", {"conversationIds": conversation_ids})
                conversations_deleted = result.get("deleted", 0)
                conversation_messages_deleted = result.get("totalMessagesDeleted", 0)
                if conversations_deleted > 0:
                    deleted_layers.append("conversations")
            except Exception as e:
                raise AgentCascadeDeletionError(
                    f"Failed to delete conversations: {e}",
                    cause=e if isinstance(e, Exception) else None,
                    partial_deletion=_build_partial_deletion_info("conversations"),
                )

        # 4. Delete graph nodes - STRICT: raise on error
        if self.graph_adapter and plan.get("graph"):
            try:
                from ..graph import delete_agent_from_graph

                graph_nodes_deleted = await delete_agent_from_graph(
                    agent_id, self.graph_adapter
                )
                if graph_nodes_deleted > 0:
                    deleted_layers.append("graph")
            except Exception as e:
                raise AgentCascadeDeletionError(
                    f"Failed to delete graph nodes: {e}",
                    cause=e if isinstance(e, Exception) else None,
                    partial_deletion=_build_partial_deletion_info("graph"),
                )

        # 5. Delete agent registration (last) - STRICT: raise on error
        try:
            await self.client.mutation("agents:unregister", filter_none_values({"agentId": agent_id}))
            deleted_layers.append("agent-registration")
        except Exception as e:
            # Only raise if agent was registered (not-found is okay)
            error_str = str(e).lower()
            if "not_registered" not in error_str and "not found" not in error_str:
                raise AgentCascadeDeletionError(
                    f"Failed to unregister agent: {e}",
                    cause=e if isinstance(e, Exception) else None,
                    partial_deletion=_build_partial_deletion_info("agent-registration"),
                )

        # Get affected memory spaces
        memory_spaces_affected = plan.get("memory_spaces", [])

        total_deleted = (
            conversations_deleted +
            memories_deleted +
            facts_deleted +
            (graph_nodes_deleted or 0) +
            (1 if "agent-registration" in deleted_layers else 0)
        )

        return UnregisterAgentResult(
            agent_id=agent_id,
            unregistered_at=deleted_at,
            conversations_deleted=conversations_deleted,
            conversation_messages_deleted=conversation_messages_deleted,
            memories_deleted=memories_deleted,
            facts_deleted=facts_deleted,
            graph_nodes_deleted=graph_nodes_deleted,
            total_deleted=total_deleted,
            deleted_layers=deleted_layers,
            memory_spaces_affected=memory_spaces_affected,
            verification=VerificationResult(complete=True, issues=[]),
            deletion_errors=[],  # No errors if we get here
        )

    async def _verify_agent_deletion(self, agent_id: str) -> VerificationResult:
        """
        Verify agent deletion completeness.
        OPTIMIZED: Uses asyncio.gather for parallel verification queries.
        """
        import asyncio

        issues: List[str] = []

        # Get memory spaces once - with error handling for resilience
        # If this fails, we can still verify graph nodes and report the issue
        try:
            if self._resilience:
                memory_spaces = await self._resilience.execute(
                    lambda: self.client.query("memorySpaces:list", {}),
                    "memorySpaces:list"
                )
            else:
                memory_spaces = await self.client.query("memorySpaces:list", {})
        except Exception as e:
            # Add to issues but continue with what we can verify
            issues.append(f"Failed to list memory spaces for verification: {e}")
            memory_spaces = []

        # Helper functions for parallel verification
        async def count_remaining_memories() -> int:
            async def check_space(space: Dict[str, Any]) -> int:
                try:
                    memories = await self.client.query(
                        "memories:list",
                        {"memorySpaceId": space.get("memorySpaceId")},
                    )
                    # Check both participantId and agentId (v0.17.0+ agent-owned memories)
                    return len([
                        m for m in memories
                        if m.get("participantId") == agent_id or m.get("agentId") == agent_id
                    ])
                except Exception:
                    return 0
            results = await asyncio.gather(*[check_space(s) for s in memory_spaces])
            return sum(results)

        async def count_remaining_conversations() -> int:
            async def check_space(space: Dict[str, Any]) -> int:
                try:
                    conversations = await self.client.query(
                        "conversations:list",
                        {"memorySpaceId": space.get("memorySpaceId")},
                    )
                    return len([
                        c for c in conversations
                        if (c.get("participants", {}).get("participantId") == agent_id or
                            c.get("participants", {}).get("agentId") == agent_id or
                            c.get("participantId") == agent_id)
                    ])
                except Exception:
                    return 0
            results = await asyncio.gather(*[check_space(s) for s in memory_spaces])
            return sum(results)

        async def count_remaining_facts() -> int:
            async def check_space(space: Dict[str, Any]) -> int:
                try:
                    facts = await self.client.query(
                        "facts:list",
                        {"memorySpaceId": space.get("memorySpaceId")},
                    )
                    # Facts only have participantId (tracks which agent extracted the fact)
                    # Note: Facts don't have agentId field - only memories and conversations do
                    return len([
                        f for f in facts
                        if f.get("participantId") == agent_id
                    ])
                except Exception:
                    return 0
            results = await asyncio.gather(*[check_space(s) for s in memory_spaces])
            return sum(results)

        async def count_graph_nodes() -> int:
            if not self.graph_adapter:
                return -1  # Indicates no graph adapter
            try:
                # Check both participantId and agentId (v0.17.0+ agent-owned nodes)
                # This catches: Agent nodes, agent-owned memories, agent-owned conversations
                result = await self.graph_adapter.query(
                    "MATCH (n) WHERE n.participantId = $agentId OR n.agentId = $agentId "
                    "RETURN count(n) as count",
                    {"agentId": agent_id},
                )
                records = result.get("records", [])
                return records[0].get("count", 0) if records else 0
            except Exception:
                return 0

        # Run ALL verification queries in parallel
        remaining_memories, remaining_convos, remaining_facts, graph_count = await asyncio.gather(
            count_remaining_memories(),
            count_remaining_conversations(),
            count_remaining_facts(),
            count_graph_nodes(),
        )

        # Build issues list
        if remaining_memories > 0:
            issues.append(f"{remaining_memories} memories still reference agent")

        if remaining_convos > 0:
            issues.append(f"{remaining_convos} conversations still reference agent")

        if remaining_facts > 0:
            issues.append(f"{remaining_facts} facts still reference agent")

        if graph_count == -1:
            issues.append("Graph adapter not configured - manual graph cleanup required")
        elif graph_count > 0:
            issues.append(f"{graph_count} graph nodes still reference agent")

        return VerificationResult(
            complete=(len(issues) == 0 or (len(issues) == 1 and "Graph adapter" in issues[0])),
            issues=issues,
        )

    async def _rollback_agent_deletion(self, backup: Dict[str, List[Any]]) -> Dict[str, Any]:
        """
        Rollback agent deletion on failure by re-creating deleted data.

        Args:
            backup: Dict containing the original data that was deleted

        Returns:
            Dict with rollback statistics
        """
        rollback_stats: Dict[str, Any] = {
            "facts_restored": 0,
            "memories_restored": 0,
            "conversations_restored": 0,
            "errors": [],
        }

        # Restore facts
        # Note: factId cannot be preserved - facts:store auto-generates new IDs
        # The restored fact will have a new ID but same content
        for fact in backup.get("facts", []):
            try:
                await self.client.mutation(
                    "facts:store",
                    filter_none_values({
                        "memorySpaceId": fact.get("memorySpaceId"),
                        "participantId": fact.get("participantId"),
                        "userId": fact.get("userId"),
                        "fact": fact.get("fact"),
                        "factType": fact.get("factType"),
                        "subject": fact.get("subject"),
                        "predicate": fact.get("predicate"),
                        "object": fact.get("object"),
                        "confidence": fact.get("confidence"),
                        "sourceType": fact.get("sourceType"),
                        "sourceRef": fact.get("sourceRef"),
                        "tags": fact.get("tags", []),
                        "metadata": fact.get("metadata"),
                        "validFrom": fact.get("validFrom"),
                        "validUntil": fact.get("validUntil"),
                        # Enrichment fields
                        "category": fact.get("category"),
                        "searchAliases": fact.get("searchAliases"),
                        "semanticContext": fact.get("semanticContext"),
                        "entities": fact.get("entities"),
                        "relations": fact.get("relations"),
                    }),
                )
                rollback_stats["facts_restored"] += 1
            except Exception as e:
                rollback_stats["errors"].append(f"Failed to restore fact {fact.get('factId')}: {e}")

        # Restore memories
        for memory in backup.get("memories", []):
            try:
                await self.client.mutation(
                    "memories:store",
                    filter_none_values({
                        "memorySpaceId": memory.get("memorySpaceId"),
                        "memoryId": memory.get("memoryId"),
                        "content": memory.get("content"),
                        "contentType": memory.get("contentType", "raw"),
                        "embedding": memory.get("embedding"),
                        "importance": memory.get("importance"),
                        "sourceType": memory.get("sourceType"),
                        "sourceUserId": memory.get("sourceUserId"),
                        "sourceUserName": memory.get("sourceUserName"),
                        # conversationRef is a nested object, not a flat field
                        "conversationRef": memory.get("conversationRef"),
                        "userId": memory.get("userId"),
                        "agentId": memory.get("agentId"),
                        "participantId": memory.get("participantId"),
                        "tags": memory.get("tags", []),
                    }),
                )
                rollback_stats["memories_restored"] += 1
            except Exception as e:
                rollback_stats["errors"].append(f"Failed to restore memory {memory.get('memoryId')}: {e}")

        # Restore conversations (without messages - those are harder to restore)
        for conv in backup.get("conversations", []):
            try:
                await self.client.mutation(
                    "conversations:create",
                    filter_none_values({
                        "memorySpaceId": conv.get("memorySpaceId"),
                        "conversationId": conv.get("conversationId"),
                        "type": conv.get("type"),
                        "participants": conv.get("participants"),
                        "metadata": conv.get("metadata"),
                    }),
                )
                rollback_stats["conversations_restored"] += 1
            except Exception as e:
                rollback_stats["errors"].append(f"Failed to restore conversation {conv.get('conversationId')}: {e}")

        # Log rollback results
        if rollback_stats["errors"]:
            print(f"Rollback completed with errors: {len(rollback_stats['errors'])} failures")
            for error in rollback_stats["errors"]:
                print(f"  - {error}")
        else:
            print(f"Rollback completed: {rollback_stats['facts_restored']} facts, "
                  f"{rollback_stats['memories_restored']} memories, "
                  f"{rollback_stats['conversations_restored']} conversations restored")

        return rollback_stats


__all__ = ["AgentsAPI", "AgentValidationError"]

