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
from .client import Cortex

# Configuration
from .types import (
    CortexConfig,
    GraphConfig,
    GraphSyncWorkerOptions,
    GraphConnectionConfig,
)

# Core Types - Layer 1
from .types import (
    # Conversations
    Conversation,
    Message,
    CreateConversationInput,
    AddMessageInput,
    ConversationParticipants,
    ConversationType,
    # Immutable
    ImmutableRecord,
    ImmutableEntry,
    ImmutableVersion,
    # Mutable
    MutableRecord,
)

# Core Types - Layer 2
from .types import (
    MemoryEntry,
    MemoryMetadata,
    MemorySource,
    MemoryVersion,
    ConversationRef,
    ImmutableRef,
    MutableRef,
    StoreMemoryInput,
    SearchOptions,
    SourceType,
    ContentType,
)

# Core Types - Layer 3
from .types import (
    FactRecord,
    StoreFactParams,
    FactType,
    FactSourceRef,
)

# Core Types - Layer 4 (Memory Convenience)
from .types import (
    RememberParams,
    RememberResult,
    RememberStreamParams,
    RememberStreamResult,
    RememberOptions,
    EnrichedMemory,
    ForgetOptions,
    ForgetResult,
)

# Coordination Types
from .types import (
    # Contexts
    Context,
    ContextInput,
    ContextWithChain,
    ContextStatus,
    # Users
    UserProfile,
    UserVersion,
    DeleteUserOptions,
    UserDeleteResult,
    VerificationResult,
    # Agents
    RegisteredAgent,
    AgentRegistration,
    AgentStats,
    UnregisterAgentOptions,
    UnregisterAgentResult,
    # Memory Spaces
    MemorySpace,
    RegisterMemorySpaceParams,
    MemorySpaceStats,
    MemorySpaceType,
    MemorySpaceStatus,
)

# A2A Types
from .types import (
    A2ASendParams,
    A2AMessage,
    A2ARequestParams,
    A2AResponse,
    A2ABroadcastParams,
    A2ABroadcastResult,
)

# Result Types
from .types import (
    DeleteResult,
    DeleteManyResult,
    UpdateManyResult,
    ListResult,
    ExportResult,
)

# Graph Types
from .types import (
    GraphNode,
    GraphEdge,
    GraphPath,
    GraphQueryResult,
    TraversalConfig,
    ShortestPathConfig,
    SyncHealthMetrics,
)

# Errors
from .errors import (
    CortexError,
    A2ATimeoutError,
    CascadeDeletionError,
    AgentCascadeDeletionError,
    ErrorCode,
    is_cortex_error,
    is_a2a_timeout_error,
    is_cascade_deletion_error,
)

# Graph Integration (optional import)
try:
    from .graph.adapters import CypherGraphAdapter
    from .graph.schema import (
        initialize_graph_schema,
        verify_graph_schema,
        drop_graph_schema,
    )
    from .graph.worker import GraphSyncWorker

    _GRAPH_AVAILABLE = True
except ImportError:
    _GRAPH_AVAILABLE = False
    CypherGraphAdapter = None
    initialize_graph_schema = None
    verify_graph_schema = None
    drop_graph_schema = None
    GraphSyncWorker = None


__version__ = "0.8.2"

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

