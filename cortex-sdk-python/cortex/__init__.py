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
    A2AConversation,
    A2AConversationFilters,
    A2AConversationMessage,
    A2AMessage,
    A2ARequestParams,
    A2AResponse,
    A2ASendParams,
    AddMessageInput,
    AgentFilters,
    AgentRegistration,
    AgentStats,
    ExportAgentsOptions,
    ExportAgentsResult,
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
    ConversationDeletionResult,
    ConversationParticipants,
    ConversationRef,
    ConversationSearchResult,
    ConversationsPolicy,
    ConversationsPurging,
    ConversationsRetention,
    ConversationType,
    CountConversationsFilter,
    CortexConfig,
    CountFactsFilter,
    CreateConversationInput,
    DeleteConversationOptions,
    DeleteFactResult,
    DeleteManyConversationsOptions,
    DeleteManyConversationsResult,
    DeleteManyFactsParams,
    DeleteManyFactsResult,
    DeleteManyResult,
    DeleteResult,
    DeleteUserOptions,
    EnforcementOptions,
    EnforcementResult,
    EnforcementStats,
    EnforcementStatsOptions,
    EnrichedMemory,
    ExportResult,
    ExportUsersOptions,
    FactRecord,
    FactSourceRef,
    FactsRef,
    FactType,
    ForgetOptions,
    ForgetResult,
    GetConversationOptions,
    GetHistoryOptions,
    GetHistoryResult,
    GovernancePolicy,
    GraphConfig,
    GraphConnectionConfig,
    GraphEdge,
    GraphNode,
    GraphPath,
    GraphQuery,
    GraphQueryResult,
    GraphSyncWorkerOptions,
    QueryStatistics,
    GraphOperation,
    GraphDeleteResult,
    OrphanRule,
    DeletionContext,
    OrphanCheckResult,
    BatchSyncLimits,
    BatchSyncOptions,
    BatchSyncStats,
    BatchSyncError,
    BatchSyncResult,
    SchemaVerificationResult,
    # Immutable Store
    CountImmutableFilter,
    ImmutableEntry,
    ImmutablePolicy,
    ImmutablePurging,
    ImmutableRecord,
    ImmutableRef,
    ImmutableRetention,
    ImmutableSearchResult,
    ImmutableTypeRetention,
    ImmutableVersion,
    ImmutableVersionExpanded,
    ListImmutableFilter,
    PurgeImmutableResult,
    PurgeManyFilter,
    PurgeManyImmutableResult,
    PurgeVersionsResult,
    SearchImmutableInput,
    StoreImmutableOptions,
    ImportanceRange,
    ListConversationsFilter,
    ListConversationsResult,
    ListFactsFilter,
    ListResult,
    ListUsersFilter,
    ListUsersResult,
    MemoryEntry,
    MemoryMetadata,
    MemorySource,
    # Memory API Result Types
    ArchiveResult,
    DeleteMemoryResult,
    MemoryVersionInfo,
    StoreMemoryResult,
    UpdateMemoryResult,
    # Memory Spaces
    DeleteMemorySpaceCascade,
    DeleteMemorySpaceOptions,
    DeleteMemorySpaceResult,
    GetMemorySpaceStatsOptions,
    ListMemorySpacesFilter,
    ListMemorySpacesResult,
    MemorySpace,
    MemorySpaceParticipant,
    MemorySpaceStats,
    MemorySpaceStatus,
    MemorySpaceType,
    ParticipantUpdates,
    UpdateMemorySpaceOptions,
    MemoryVersion,
    Message,
    MutablePolicy,
    MutablePurging,
    # Mutable
    CountMutableFilter,
    DeleteMutableOptions,
    ListMutableFilter,
    MutableOperation,
    MutableRecord,
    MutableRef,
    MutableRetention,
    PurgeManyMutableFilter,
    PurgeNamespaceOptions,
    SetMutableOptions,
    TransactionResult,
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
    SearchConversationsFilters,
    SearchConversationsInput,
    SearchConversationsOptions,
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


__version__ = "0.21.0"

__all__ = [
    # Main
    "Cortex",
    # Config
    "CortexConfig",
    "GraphConfig",
    "GraphSyncWorkerOptions",
    "GraphConnectionConfig",
    # Layer 1 Types - Conversations
    "Conversation",
    "Message",
    "CreateConversationInput",
    "AddMessageInput",
    "ConversationParticipants",
    "ConversationSearchResult",
    "ConversationDeletionResult",
    "CountConversationsFilter",
    "DeleteConversationOptions",
    "DeleteManyConversationsOptions",
    "DeleteManyConversationsResult",
    "GetConversationOptions",
    "GetHistoryOptions",
    "GetHistoryResult",
    "ListConversationsFilter",
    "ListConversationsResult",
    "SearchConversationsFilters",
    "SearchConversationsInput",
    "SearchConversationsOptions",
    # Layer 1 Types - Immutable
    "CountImmutableFilter",
    "ImmutableEntry",
    "ImmutableRecord",
    "ImmutableSearchResult",
    "ImmutableVersion",
    "ImmutableVersionExpanded",
    "ListImmutableFilter",
    "PurgeImmutableResult",
    "PurgeManyFilter",
    "PurgeManyImmutableResult",
    "PurgeVersionsResult",
    "SearchImmutableInput",
    "StoreImmutableOptions",
    # Layer 1 Types - Mutable
    "CountMutableFilter",
    "DeleteMutableOptions",
    "ListMutableFilter",
    "MutableOperation",
    "MutableRecord",
    "PurgeManyMutableFilter",
    "PurgeNamespaceOptions",
    "SetMutableOptions",
    "TransactionResult",
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
    "DeleteManyFactsParams",
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
    "AgentFilters",
    "AgentStats",
    "ExportAgentsOptions",
    "ExportAgentsResult",
    "UnregisterAgentOptions",
    "UnregisterAgentResult",
    "MemorySpace",
    "MemorySpaceParticipant",
    "RegisterMemorySpaceParams",
    "MemorySpaceStats",
    "ListMemorySpacesFilter",
    "ListMemorySpacesResult",
    "DeleteMemorySpaceOptions",
    "DeleteMemorySpaceCascade",
    "DeleteMemorySpaceResult",
    "GetMemorySpaceStatsOptions",
    "UpdateMemorySpaceOptions",
    "ParticipantUpdates",
    # A2A
    "A2ASendParams",
    "A2AMessage",
    "A2ARequestParams",
    "A2AResponse",
    "A2ABroadcastParams",
    "A2ABroadcastResult",
    "A2AConversation",
    "A2AConversationFilters",
    "A2AConversationMessage",
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
    "GraphQuery",
    "GraphQueryResult",
    "TraversalConfig",
    "ShortestPathConfig",
    "SyncHealthMetrics",
    "QueryStatistics",
    "GraphOperation",
    "GraphDeleteResult",
    "OrphanRule",
    "DeletionContext",
    "OrphanCheckResult",
    "BatchSyncLimits",
    "BatchSyncOptions",
    "BatchSyncStats",
    "BatchSyncError",
    "BatchSyncResult",
    "SchemaVerificationResult",
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

