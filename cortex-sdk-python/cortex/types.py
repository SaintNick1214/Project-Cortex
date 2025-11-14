"""
Cortex SDK - Type Definitions

Complete type system for all Cortex operations, matching the TypeScript SDK.
"""

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any, Literal, Callable, Protocol
from datetime import datetime


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Core Type Aliases
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ConversationType = Literal["user-agent", "agent-agent"]
SourceType = Literal["conversation", "system", "tool", "a2a"]
ContentType = Literal["raw", "summarized"]
FactType = Literal["preference", "identity", "knowledge", "relationship", "event", "custom"]
ContextStatus = Literal["active", "completed", "cancelled", "blocked"]
MessageRole = Literal["user", "agent", "system"]
MemorySpaceType = Literal["personal", "team", "project", "custom"]
MemorySpaceStatus = Literal["active", "archived"]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Layer 1a: Conversations
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@dataclass
class Message:
    """A message in a conversation."""
    id: str
    role: MessageRole
    content: str
    timestamp: int
    participant_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class ConversationParticipants:
    """Conversation participants."""
    user_id: Optional[str] = None
    participant_id: Optional[str] = None
    memory_space_ids: Optional[List[str]] = None


@dataclass
class Conversation:
    """ACID conversation record."""
    _id: str
    conversation_id: str
    memory_space_id: str
    type: ConversationType
    participants: ConversationParticipants
    messages: List[Message]
    message_count: int
    metadata: Optional[Dict[str, Any]]
    created_at: int
    updated_at: int
    participant_id: Optional[str] = None


@dataclass
class CreateConversationInput:
    """Input for creating a conversation."""
    memory_space_id: str
    type: ConversationType
    participants: ConversationParticipants
    conversation_id: Optional[str] = None
    participant_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class AddMessageInput:
    """Input for adding a message to conversation."""
    conversation_id: str
    role: MessageRole
    content: str
    participant_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class ConversationSearchResult:
    """Result from conversation search."""
    conversation: Conversation
    matched_messages: List[Message]
    highlights: List[str]
    score: float


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Layer 1b: Immutable Store
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@dataclass
class ImmutableVersion:
    """A version of an immutable record."""
    version: int
    data: Dict[str, Any]
    timestamp: int
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class ImmutableRecord:
    """Immutable store record with versioning."""
    _id: str
    type: str
    id: str
    data: Dict[str, Any]
    version: int
    previous_versions: List[ImmutableVersion]
    created_at: int
    updated_at: int
    user_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class ImmutableEntry:
    """Input for storing immutable data."""
    type: str
    id: str
    data: Dict[str, Any]
    user_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Layer 1c: Mutable Store
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@dataclass
class MutableRecord:
    """Mutable store record (current value only)."""
    _id: str
    namespace: str
    key: str
    value: Any
    created_at: int
    updated_at: int
    access_count: int
    user_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    last_accessed: Optional[int] = None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Layer 2: Vector Memory
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@dataclass
class ConversationRef:
    """Reference to ACID conversation."""
    conversation_id: str
    message_ids: List[str]


@dataclass
class ImmutableRef:
    """Reference to immutable store record."""
    type: str
    id: str
    version: Optional[int] = None


@dataclass
class MutableRef:
    """Reference to mutable store snapshot."""
    namespace: str
    key: str
    snapshot_value: Any
    snapshot_at: int


@dataclass
class MemoryMetadata:
    """Metadata for memory entries."""
    importance: int  # 0-100
    tags: List[str] = field(default_factory=list)
    # Allow any additional metadata fields
    extra: Dict[str, Any] = field(default_factory=dict)


@dataclass
class MemoryVersion:
    """A version of a memory entry."""
    version: int
    content: str
    embedding: Optional[List[float]]
    timestamp: int


@dataclass
class MemoryEntry:
    """Vector memory entry."""
    _id: str
    memory_id: str
    memory_space_id: str
    content: str
    content_type: ContentType
    source_type: SourceType
    source_timestamp: int
    importance: int
    tags: List[str]
    version: int
    previous_versions: List[MemoryVersion]
    created_at: int
    updated_at: int
    access_count: int
    participant_id: Optional[str] = None
    user_id: Optional[str] = None
    embedding: Optional[List[float]] = None
    source_user_id: Optional[str] = None
    source_user_name: Optional[str] = None
    conversation_ref: Optional[ConversationRef] = None
    immutable_ref: Optional[ImmutableRef] = None
    mutable_ref: Optional[MutableRef] = None
    last_accessed: Optional[int] = None
    _score: Optional[float] = None  # Similarity score from vector search (managed mode only)
    score: Optional[float] = None  # Alias for _score


@dataclass
class MemorySource:
    """Source information for a memory."""
    type: SourceType
    timestamp: int
    user_id: Optional[str] = None
    user_name: Optional[str] = None


@dataclass
class StoreMemoryInput:
    """Input for storing a vector memory."""
    content: str
    content_type: ContentType
    source: MemorySource
    metadata: MemoryMetadata
    participant_id: Optional[str] = None
    embedding: Optional[List[float]] = None
    user_id: Optional[str] = None
    conversation_ref: Optional[ConversationRef] = None
    immutable_ref: Optional[ImmutableRef] = None
    mutable_ref: Optional[MutableRef] = None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Layer 3: Facts
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@dataclass
class FactSourceRef:
    """Source reference for a fact."""
    conversation_id: Optional[str] = None
    message_ids: Optional[List[str]] = None
    memory_id: Optional[str] = None


@dataclass
class FactRecord:
    """Structured fact record."""
    _id: str
    fact_id: str
    memory_space_id: str
    fact: str
    fact_type: FactType
    confidence: int  # 0-100
    source_type: Literal["conversation", "system", "tool", "manual", "a2a"]
    tags: List[str]
    created_at: int
    updated_at: int
    version: int
    participant_id: Optional[str] = None
    subject: Optional[str] = None
    predicate: Optional[str] = None
    object: Optional[str] = None
    source_ref: Optional[FactSourceRef] = None
    metadata: Optional[Dict[str, Any]] = None
    valid_from: Optional[int] = None
    valid_until: Optional[int] = None
    superseded_by: Optional[str] = None
    supersedes: Optional[str] = None


@dataclass
class StoreFactParams:
    """Parameters for storing a fact."""
    memory_space_id: str
    fact: str
    fact_type: FactType
    confidence: int
    source_type: Literal["conversation", "system", "tool", "manual", "a2a"]
    participant_id: Optional[str] = None
    subject: Optional[str] = None
    predicate: Optional[str] = None
    object: Optional[str] = None
    source_ref: Optional[FactSourceRef] = None
    metadata: Optional[Dict[str, Any]] = None
    tags: Optional[List[str]] = None
    valid_from: Optional[int] = None
    valid_until: Optional[int] = None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Layer 4: Memory Convenience API
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@dataclass
class RememberParams:
    """Parameters for remembering a conversation."""
    memory_space_id: str
    conversation_id: str
    user_message: str
    agent_response: str
    user_id: str
    user_name: str
    participant_id: Optional[str] = None
    importance: Optional[int] = None
    tags: Optional[List[str]] = None
    extract_content: Optional[Callable[[str, str], Any]] = None
    generate_embedding: Optional[Callable[[str], Any]] = None
    extract_facts: Optional[Callable[[str, str], Any]] = None
    auto_embed: Optional[bool] = None
    auto_summarize: Optional[bool] = None


@dataclass
class RememberResult:
    """Result from remember operation."""
    conversation: Dict[str, Any]  # messageIds and conversationId
    memories: List[MemoryEntry]
    facts: List[FactRecord]


@dataclass
class RememberStreamParams:
    """Parameters for remember_stream() - streaming variant of remember()."""
    memory_space_id: str
    conversation_id: str
    user_message: str
    response_stream: Any  # AsyncIterable[str] - async generator or iterator
    user_id: str
    user_name: str
    participant_id: Optional[str] = None
    importance: Optional[int] = None
    tags: Optional[List[str]] = None
    extract_content: Optional[Callable[[str, str], Any]] = None
    generate_embedding: Optional[Callable[[str], Any]] = None
    extract_facts: Optional[Callable[[str, str], Any]] = None
    auto_embed: Optional[bool] = None
    auto_summarize: Optional[bool] = None


@dataclass
class RememberStreamResult:
    """Result from remember_stream() including full streamed response."""
    conversation: Dict[str, Any]  # messageIds and conversationId
    memories: List[MemoryEntry]
    facts: List[FactRecord]
    full_response: str  # Complete text from consumed stream


@dataclass
class EnrichedMemory:
    """Memory with enriched conversation and facts."""
    memory: MemoryEntry
    conversation: Optional[Conversation] = None
    source_messages: Optional[List[Message]] = None
    facts: Optional[List[FactRecord]] = None


@dataclass
class ForgetOptions:
    """Options for forgetting a memory."""
    delete_conversation: bool = False
    delete_entire_conversation: bool = False
    sync_to_graph: Optional[bool] = None


@dataclass
class ForgetResult:
    """Result from forget operation."""
    memory_deleted: bool
    conversation_deleted: bool
    messages_deleted: int
    facts_deleted: int
    fact_ids: List[str]
    restorable: bool


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Coordination: Contexts
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@dataclass
class ContextVersion:
    """A version of a context."""
    version: int
    status: str
    data: Any
    timestamp: int
    updated_by: str


@dataclass
class Context:
    """Context chain node for workflow coordination."""
    id: str
    memory_space_id: str
    purpose: str
    status: ContextStatus
    depth: int
    child_ids: List[str]
    participants: List[str]
    data: Dict[str, Any]
    created_at: int
    updated_at: int
    version: int
    root_id: str
    parent_id: Optional[str] = None
    user_id: Optional[str] = None
    conversation_ref: Optional[ConversationRef] = None
    description: Optional[str] = None
    completed_at: Optional[int] = None
    previous_versions: Optional[List[ContextVersion]] = None
    granted_access: Optional[List[Dict[str, Any]]] = None


@dataclass
class ContextInput:
    """Input for creating a context."""
    purpose: str
    memory_space_id: str
    parent_id: Optional[str] = None
    user_id: Optional[str] = None
    conversation_ref: Optional[ConversationRef] = None
    data: Optional[Dict[str, Any]] = None
    status: Optional[ContextStatus] = None
    description: Optional[str] = None


@dataclass
class ContextWithChain:
    """Context with full chain information."""
    current: Context
    root: Context
    children: List[Context]
    siblings: List[Context]
    ancestors: List[Context]
    depth: int
    parent: Optional[Context] = None
    conversation: Optional[Conversation] = None
    trigger_messages: Optional[List[Message]] = None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Coordination: Users
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@dataclass
class UserVersion:
    """A version of a user profile."""
    version: int
    data: Dict[str, Any]
    timestamp: int


@dataclass
class UserProfile:
    """User profile with versioning."""
    id: str
    data: Dict[str, Any]
    version: int
    created_at: int
    updated_at: int


@dataclass
class DeleteUserOptions:
    """Options for deleting a user."""
    cascade: bool = False
    verify: bool = True
    dry_run: bool = False


@dataclass
class VerificationResult:
    """Result of deletion verification."""
    complete: bool
    issues: List[str]


@dataclass
class UserDeleteResult:
    """Result from user deletion."""
    user_id: str
    deleted_at: int
    conversations_deleted: int
    conversation_messages_deleted: int
    immutable_records_deleted: int
    mutable_keys_deleted: int
    vector_memories_deleted: int
    facts_deleted: int
    total_deleted: int
    deleted_layers: List[str]
    verification: VerificationResult
    graph_nodes_deleted: Optional[int] = None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Coordination: Agents
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@dataclass
class AgentStats:
    """Statistics for an agent."""
    total_memories: int
    total_conversations: int
    total_facts: int
    memory_spaces_active: int
    last_active: Optional[int] = None


@dataclass
class RegisteredAgent:
    """Registered agent metadata."""
    id: str
    name: str
    status: str
    registered_at: int
    updated_at: int
    metadata: Dict[str, Any]
    config: Dict[str, Any]
    description: Optional[str] = None
    last_active: Optional[int] = None
    stats: Optional[AgentStats] = None


@dataclass
class AgentRegistration:
    """Input for registering an agent."""
    id: str
    name: str
    description: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    config: Optional[Dict[str, Any]] = None


@dataclass
class UnregisterAgentOptions:
    """Options for unregistering an agent."""
    cascade: bool = False
    verify: bool = True
    dry_run: bool = False


@dataclass
class UnregisterAgentResult:
    """Result from agent unregistration."""
    agent_id: str
    unregistered_at: int
    conversations_deleted: int
    conversation_messages_deleted: int
    memories_deleted: int
    facts_deleted: int
    total_deleted: int
    deleted_layers: List[str]
    memory_spaces_affected: List[str]
    verification: VerificationResult
    graph_nodes_deleted: Optional[int] = None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Memory Spaces
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@dataclass
class MemorySpaceParticipant:
    """Participant in a memory space."""
    id: str
    type: str
    joined_at: int


@dataclass
class MemorySpace:
    """Memory space registry entry."""
    _id: str
    memory_space_id: str
    type: MemorySpaceType
    participants: List[MemorySpaceParticipant]
    metadata: Dict[str, Any]
    status: MemorySpaceStatus
    created_at: int
    updated_at: int
    name: Optional[str] = None


@dataclass
class RegisterMemorySpaceParams:
    """Parameters for registering a memory space."""
    memory_space_id: str
    type: MemorySpaceType
    name: Optional[str] = None
    participants: Optional[List[Dict[str, str]]] = None
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class MemorySpaceStats:
    """Statistics for a memory space."""
    memory_space_id: str
    total_memories: int
    total_conversations: int
    total_facts: int
    total_messages: int
    storage: Dict[str, int]
    top_tags: List[str]
    importance_breakdown: Dict[str, int]
    avg_search_time: Optional[str] = None
    participants: Optional[List[Dict[str, Any]]] = None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# A2A Communication
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@dataclass
class A2ASendParams:
    """Parameters for sending an A2A message."""
    from_agent: str
    to_agent: str
    message: str
    user_id: Optional[str] = None
    context_id: Optional[str] = None
    importance: Optional[int] = None
    track_conversation: bool = True
    auto_embed: Optional[bool] = None
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class A2AMessage:
    """Result from A2A send operation."""
    message_id: str
    sent_at: int
    sender_memory_id: str
    receiver_memory_id: str
    conversation_id: Optional[str] = None
    acid_message_id: Optional[str] = None


@dataclass
class A2ARequestParams:
    """Parameters for A2A request."""
    from_agent: str
    to_agent: str
    message: str
    timeout: int = 30000
    retries: int = 1
    user_id: Optional[str] = None
    context_id: Optional[str] = None
    importance: Optional[int] = None


@dataclass
class A2AResponse:
    """Response from A2A request."""
    response: str
    message_id: str
    response_message_id: str
    responded_at: int
    response_time: int


@dataclass
class A2ABroadcastParams:
    """Parameters for A2A broadcast."""
    from_agent: str
    to_agents: List[str]
    message: str
    user_id: Optional[str] = None
    context_id: Optional[str] = None
    importance: Optional[int] = None
    track_conversation: bool = True
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class A2ABroadcastResult:
    """Result from A2A broadcast."""
    message_id: str
    sent_at: int
    recipients: List[str]
    sender_memory_ids: List[str]
    receiver_memory_ids: List[str]
    memories_created: int
    conversation_ids: Optional[List[str]] = None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Filter Types
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@dataclass
class RangeQuery:
    """Range query for numeric fields."""
    gte: Optional[float] = None
    lte: Optional[float] = None
    eq: Optional[float] = None
    ne: Optional[float] = None
    gt: Optional[float] = None
    lt: Optional[float] = None


@dataclass
class SearchOptions:
    """Options for searching memories."""
    embedding: Optional[List[float]] = None
    user_id: Optional[str] = None
    participant_id: Optional[str] = None
    tags: Optional[List[str]] = None
    tag_match: Literal["any", "all"] = "any"
    importance: Optional[int] = None
    min_importance: Optional[int] = None
    created_before: Optional[int] = None
    created_after: Optional[int] = None
    updated_before: Optional[int] = None
    updated_after: Optional[int] = None
    last_accessed_before: Optional[int] = None
    last_accessed_after: Optional[int] = None
    access_count: Optional[int] = None
    version: Optional[int] = None
    source_type: Optional[SourceType] = None
    content_type: Optional[ContentType] = None
    limit: Optional[int] = None
    offset: Optional[int] = None
    min_score: Optional[float] = None
    sort_by: Optional[str] = None
    sort_order: Literal["asc", "desc"] = "desc"
    strategy: Optional[Literal["auto", "semantic", "keyword", "recent"]] = None
    boost_importance: bool = False
    boost_recent: bool = False
    boost_popular: bool = False
    enrich_conversation: bool = False


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Result Types
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@dataclass
class DeleteResult:
    """Generic deletion result."""
    deleted: bool
    deleted_at: int


@dataclass
class DeleteManyResult:
    """Result from bulk delete operation."""
    deleted: int
    memory_ids: List[str]
    facts_deleted: int
    fact_ids: List[str]


@dataclass
class UpdateManyResult:
    """Result from bulk update operation."""
    updated: int
    memory_ids: List[str]
    new_versions: List[int]
    facts_affected: int


@dataclass
class ListResult:
    """Generic list result with pagination."""
    total: int
    limit: int
    offset: int
    has_more: bool
    items: List[Any]


@dataclass
class ExportResult:
    """Result from export operation."""
    format: str
    data: str
    count: int
    exported_at: int


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Graph Database Types
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@dataclass
class GraphNode:
    """Graph database node."""
    label: str
    properties: Dict[str, Any]
    id: Optional[str] = None


@dataclass
class GraphEdge:
    """Graph database edge/relationship."""
    type: str
    from_node: str
    to_node: str
    properties: Optional[Dict[str, Any]] = None
    id: Optional[str] = None


@dataclass
class GraphPath:
    """Path between nodes in graph."""
    nodes: List[GraphNode]
    relationships: List[GraphEdge]
    length: int


@dataclass
class GraphConnectionConfig:
    """Graph database connection configuration."""
    uri: str
    username: str
    password: str
    database: Optional[str] = None
    max_connection_pool_size: Optional[int] = None
    connection_timeout: Optional[int] = None


@dataclass
class GraphQueryResult:
    """Result from graph query."""
    records: List[Dict[str, Any]]
    count: int
    summary: Optional[Dict[str, Any]] = None


@dataclass
class TraversalConfig:
    """Configuration for graph traversal."""
    start_id: str
    relationship_types: List[str]
    max_depth: int
    direction: Literal["OUTGOING", "INCOMING", "BOTH"] = "BOTH"


@dataclass
class ShortestPathConfig:
    """Configuration for shortest path query."""
    from_id: str
    to_id: str
    max_hops: int
    relationship_types: Optional[List[str]] = None


@dataclass
class SyncHealthMetrics:
    """Health metrics for graph sync worker."""
    is_running: bool
    total_processed: int
    success_count: int
    failure_count: int
    avg_sync_time_ms: float
    queue_size: int
    last_sync_at: Optional[int] = None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Configuration Types
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@dataclass
class GraphSyncWorkerOptions:
    """Options for graph sync worker."""
    batch_size: int = 100
    retry_attempts: int = 3
    verbose: bool = False


@dataclass
class GraphConfig:
    """Graph database configuration."""
    adapter: Any  # GraphAdapter protocol
    orphan_cleanup: bool = True
    auto_sync: bool = False
    sync_worker_options: Optional[GraphSyncWorkerOptions] = None


@dataclass
class CortexConfig:
    """Main Cortex SDK configuration."""
    convex_url: str
    graph: Optional[GraphConfig] = None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Option Types (for graph sync support across all APIs)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@dataclass
class GraphSyncOption:
    """Standard graph sync option for all operations."""
    sync_to_graph: Optional[bool] = None


@dataclass
class CreateConversationOptions(GraphSyncOption):
    """Options for creating a conversation."""
    pass


@dataclass
class AddMessageOptions(GraphSyncOption):
    """Options for adding a message."""
    pass


@dataclass
class DeleteConversationOptions(GraphSyncOption):
    """Options for deleting a conversation."""
    pass


@dataclass
class StoreMemoryOptions(GraphSyncOption):
    """Options for storing a memory."""
    pass


@dataclass
class UpdateMemoryOptions(GraphSyncOption):
    """Options for updating a memory."""
    reextract_facts: bool = False
    extract_facts: Optional[Callable] = None


@dataclass
class DeleteMemoryOptions(GraphSyncOption):
    """Options for deleting a memory."""
    cascade_delete_facts: bool = True


@dataclass
class StoreFactOptions(GraphSyncOption):
    """Options for storing a fact."""
    pass


@dataclass
class UpdateFactOptions(GraphSyncOption):
    """Options for updating a fact."""
    pass


@dataclass
class DeleteFactOptions(GraphSyncOption):
    """Options for deleting a fact."""
    pass


@dataclass
class CreateContextOptions(GraphSyncOption):
    """Options for creating a context."""
    pass


@dataclass
class UpdateContextOptions(GraphSyncOption):
    """Options for updating a context."""
    pass


@dataclass
class DeleteContextOptions(GraphSyncOption):
    """Options for deleting a context."""
    cascade_children: bool = False
    orphan_children: bool = False


@dataclass
class RememberOptions(GraphSyncOption):
    """Options for remember operation."""
    extract_facts: bool = False
    extract_content: Optional[Callable] = None
    generate_embedding: Optional[Callable] = None
    auto_embed: Optional[bool] = None
    auto_summarize: Optional[bool] = None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Graph Adapter Protocol
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class GraphAdapter(Protocol):
    """Protocol defining the interface for graph database adapters."""

    async def connect(self, config: GraphConnectionConfig) -> None:
        """Connect to the graph database."""
        ...

    async def disconnect(self) -> None:
        """Disconnect from the graph database."""
        ...

    async def create_node(self, node: GraphNode) -> str:
        """Create a node and return its ID."""
        ...

    async def update_node(self, node_id: str, properties: Dict[str, Any]) -> None:
        """Update node properties."""
        ...

    async def delete_node(self, node_id: str) -> None:
        """Delete a node."""
        ...

    async def create_edge(self, edge: GraphEdge) -> str:
        """Create an edge and return its ID."""
        ...

    async def delete_edge(self, edge_id: str) -> None:
        """Delete an edge."""
        ...

    async def query(self, cypher: str, params: Optional[Dict[str, Any]] = None) -> GraphQueryResult:
        """Execute a Cypher query."""
        ...

    async def find_nodes(self, label: str, properties: Dict[str, Any], limit: int = 1) -> List[GraphNode]:
        """Find nodes by label and properties."""
        ...

    async def traverse(self, config: TraversalConfig) -> List[GraphNode]:
        """Multi-hop graph traversal."""
        ...

    async def find_path(self, config: ShortestPathConfig) -> Optional[GraphPath]:
        """Find shortest path between nodes."""
        ...

