"""
Cortex SDK - Python Edition

Open-source SDK for AI agents with persistent memory built on Convex.

Example:
    >>> from cortex import Cortex, CortexConfig, RememberParams
    >>>
    >>> cortex = Cortex(CortexConfig(convex_url="https://your-deployment.convex.cloud"))
    >>>
    >>> result = await cortex.memory.remember(
    ...     RememberParams(
    ...         memory_space_id="agent-1",
    ...         conversation_id="conv-123",
    ...         user_message="I prefer dark mode",
    ...         agent_response="Got it!",
    ...         user_id="user-123",
    ...         user_name="Alex"
    ...     )
    ... )
    >>>
    >>> await cortex.close()
"""

# Main client
# Validation Errors
from .a2a.validators import A2AValidationError
from .agents.validators import AgentValidationError
from .client import Cortex
from .contexts.validators import ContextsValidationError
from .conversations.validators import ConversationValidationError

# Errors
from .errors import (
    A2ATimeoutError,
    AgentCascadeDeletionError,
    CascadeDeletionError,
    CortexError,
    ErrorCode,
    is_a2a_timeout_error,
    is_cascade_deletion_error,
    is_cortex_error,
)
from .facts.validators import FactsValidationError
from .governance.validators import GovernanceValidationError
from .immutable.validators import ImmutableValidationError
from .memory.validators import MemoryValidationError
from .memory_spaces.validators import MemorySpaceValidationError
from .mutable.validators import MutableValidationError

# Configuration
# Core Types - Layer 1
# Core Types - Layer 2
# Core Types - Layer 3
# Core Types - Layer 4 (Memory Convenience)
# Coordination Types
# Governance Types
# A2A Types
# Result Types
# Graph Types
from .types import (
    A2ABroadcastParams,
    A2ABroadcastResult,
    A2AMessage,
    A2ARequestParams,
    A2AResponse,
    A2ASendParams,
    AddMessageInput,
    AgentRegistration,
    AgentStats,
    # Governance
    ComplianceMode,
    ComplianceReport,
    ComplianceReportOptions,
    ComplianceSettings,
    ComplianceTemplate,
    ContentType,
    # Contexts
    Context,
    ContextInput,
    ContextStatus,
    ContextWithChain,
    # Conversations
    Conversation,
    ConversationParticipants,
    ConversationRef,
    ConversationsPolicy,
    ConversationsPurging,
    ConversationsRetention,
    ConversationType,
    CortexConfig,
    CountFactsFilter,
    CreateConversationInput,
    DeleteManyResult,
    DeleteResult,
    DeleteUserOptions,
    EnforcementOptions,
    EnforcementResult,
    EnforcementStats,
    EnforcementStatsOptions,
    EnrichedMemory,
    ExportResult,
    FactRecord,
    FactSourceRef,
    FactsRef,
    FactType,
    ForgetOptions,
    ForgetResult,
    GovernancePolicy,
    GraphConfig,
    GraphConnectionConfig,
    GraphEdge,
    GraphNode,
    GraphPath,
    GraphQueryResult,
    GraphSyncWorkerOptions,
    ImmutableEntry,
    ImmutablePolicy,
    ImmutablePurging,
    # Immutable
    ImmutableRecord,
    ImmutableRef,
    ImmutableRetention,
    ImmutableTypeRetention,
    ImmutableVersion,
    ImportanceRange,
    ListFactsFilter,
    ListResult,
    MemoryEntry,
    MemoryMetadata,
    MemorySource,
    # Memory Spaces
    MemorySpace,
    MemorySpaceStats,
    MemorySpaceStatus,
    MemorySpaceType,
    MemoryVersion,
    Message,
    MutablePolicy,
    MutablePurging,
    # Mutable
    MutableRecord,
    MutableRef,
    MutableRetention,
    PolicyResult,
    PolicyScope,
    QueryByRelationshipFilter,
    QueryBySubjectFilter,
    # Agents
    RegisteredAgent,
    RegisterMemorySpaceParams,
    RememberOptions,
    RememberParams,
    RememberResult,
    RememberStreamParams,
    RememberStreamResult,
    SearchFactsOptions,
    SearchOptions,
    ShortestPathConfig,
    SimulationOptions,
    SimulationResult,
    SourceType,
    StoreFactParams,
    StoreMemoryInput,
    SyncHealthMetrics,
    TraversalConfig,
    UnregisterAgentOptions,
    UnregisterAgentResult,
    UpdateManyResult,
    UserDeleteResult,
    # Users
    UserProfile,
    UserVersion,
    VectorPolicy,
    VectorPurging,
    VectorRetention,
    VerificationResult,
)
from .users.validators import UserValidationError
from .vector.validators import VectorValidationError

# Validation Errors already imported above, UserValidationError completes the set

# Graph Integration (optional import)
try:
    from .graph.adapters import CypherGraphAdapter
    from .graph.schema import (
        drop_graph_schema,
        initialize_graph_schema,
        verify_graph_schema,
    )
    from .graph.worker import GraphSyncWorker

    _GRAPH_AVAILABLE = True
except ImportError:
    _GRAPH_AVAILABLE = False
    CypherGraphAdapter = None  # type: ignore
    initialize_graph_schema = None  # type: ignore[assignment]
    verify_graph_schema = None  # type: ignore[assignment]
    drop_graph_schema = None  # type: ignore[assignment]
    GraphSyncWorker = None  # type: ignore


__version__ = "0.10.0"

__all__ = [
    # Main
    "Cortex",
    # Config
    "CortexConfig",
    "GraphConfig",
    "GraphSyncWorkerOptions",
    "GraphConnectionConfig",
    # Layer 1 Types
    "Conversation",
    "Message",
    "CreateConversationInput",
    "AddMessageInput",
    "ConversationParticipants",
    "ImmutableRecord",
    "ImmutableEntry",
    "ImmutableVersion",
    "MutableRecord",
    # Layer 2 Types
    "MemoryEntry",
    "MemoryMetadata",
    "MemorySource",
    "MemoryVersion",
    "ConversationRef",
    "ImmutableRef",
    "MutableRef",
    "StoreMemoryInput",
    "SearchOptions",
    # Layer 3 Types
    "FactRecord",
    "StoreFactParams",
    "FactSourceRef",
    "FactsRef",
    "CountFactsFilter",
    "ListFactsFilter",
    "QueryByRelationshipFilter",
    "QueryBySubjectFilter",
    "SearchFactsOptions",
    # Layer 4 Types
    "RememberParams",
    "RememberResult",
    "RememberStreamParams",
    "RememberStreamResult",
    "RememberOptions",
    "EnrichedMemory",
    "ForgetOptions",
    "ForgetResult",
    # Coordination
    "Context",
    "ContextInput",
    "ContextWithChain",
    "UserProfile",
    "UserVersion",
    "DeleteUserOptions",
    "UserDeleteResult",
    "RegisteredAgent",
    "AgentRegistration",
    "AgentStats",
    "UnregisterAgentOptions",
    "UnregisterAgentResult",
    "MemorySpace",
    "RegisterMemorySpaceParams",
    "MemorySpaceStats",
    # A2A
    "A2ASendParams",
    "A2AMessage",
    "A2ARequestParams",
    "A2AResponse",
    "A2ABroadcastParams",
    "A2ABroadcastResult",
    # Governance
    "GovernancePolicy",
    "PolicyScope",
    "PolicyResult",
    "ComplianceMode",
    "ComplianceTemplate",
    "ComplianceSettings",
    "ConversationsPolicy",
    "ConversationsRetention",
    "ConversationsPurging",
    "ImmutablePolicy",
    "ImmutableRetention",
    "ImmutablePurging",
    "ImmutableTypeRetention",
    "MutablePolicy",
    "MutableRetention",
    "MutablePurging",
    "VectorPolicy",
    "VectorRetention",
    "VectorPurging",
    "ImportanceRange",
    "EnforcementOptions",
    "EnforcementResult",
    "SimulationOptions",
    "SimulationResult",
    "ComplianceReport",
    "ComplianceReportOptions",
    "EnforcementStats",
    "EnforcementStatsOptions",
    # Results
    "DeleteResult",
    "DeleteManyResult",
    "UpdateManyResult",
    "ListResult",
    "ExportResult",
    "VerificationResult",
    # Graph
    "GraphNode",
    "GraphEdge",
    "GraphPath",
    "GraphQueryResult",
    "TraversalConfig",
    "ShortestPathConfig",
    "SyncHealthMetrics",
    # Errors
    "CortexError",
    "A2ATimeoutError",
    "CascadeDeletionError",
    "AgentCascadeDeletionError",
    "ErrorCode",
    "is_cortex_error",
    "is_a2a_timeout_error",
    "is_cascade_deletion_error",
    # Validation Errors
    "A2AValidationError",
    "AgentValidationError",
    "ContextsValidationError",
    "ConversationValidationError",
    "FactsValidationError",
    "GovernanceValidationError",
    "ImmutableValidationError",
    "MemorySpaceValidationError",
    "MemoryValidationError",
    "MutableValidationError",
    "UserValidationError",
    "VectorValidationError",
    # Type Literals
    "ConversationType",
    "SourceType",
    "ContentType",
    "FactType",
    "ContextStatus",
    "MemorySpaceType",
    "MemorySpaceStatus",
    # Graph (optional)
    "CypherGraphAdapter",
    "initialize_graph_schema",
    "verify_graph_schema",
    "drop_graph_schema",
    "GraphSyncWorker",
]

