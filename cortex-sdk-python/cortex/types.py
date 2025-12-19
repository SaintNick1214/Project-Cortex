"""
Cortex SDK - Type Definitions

Complete type system for all Cortex operations, matching the TypeScript SDK.
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable, Dict, List, Literal, Optional, Protocol

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Core Type Aliases
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ConversationType = Literal["user-agent", "agent-agent"]
SourceType = Literal["conversation", "system", "tool", "a2a"]
ContentType = Literal["raw", "summarized"]
FactType = Literal["preference", "identity", "knowledge", "relationship", "event", "observation", "custom"]
ContextStatus = Literal["active", "completed", "cancelled", "blocked"]
MessageRole = Literal["user", "agent", "system"]
MemorySpaceType = Literal["personal", "team", "project", "custom"]
MemorySpaceStatus = Literal["active", "archived"]

# Skippable layers for memory orchestration
# - 'users': Don't auto-create user profile
# - 'agents': Don't auto-register agent
# - 'conversations': Don't store in ACID conversations
# - 'vector': Don't store in vector index
# - 'facts': Don't extract/store facts
# - 'graph': Don't sync to graph database
SkippableLayer = Literal["users", "agents", "conversations", "vector", "facts", "graph"]


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
    user_id: Optional[str] = None  # The human user in the conversation
    agent_id: Optional[str] = None  # The agent/assistant in the conversation
    participant_id: Optional[str] = None  # Hive Mode: who created this
    memory_space_ids: Optional[List[str]] = None  # Collaboration Mode (agent-agent)


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


@dataclass
class GetConversationOptions:
    """Options for getting a conversation."""
    include_messages: Optional[bool] = None  # Default: true
    message_limit: Optional[int] = None  # Limit messages returned


@dataclass
class ListConversationsFilter:
    """Comprehensive filter for listing conversations (v0.21.0+)."""
    type: Optional[ConversationType] = None
    user_id: Optional[str] = None
    memory_space_id: Optional[str] = None
    participant_id: Optional[str] = None  # Hive Mode tracking
    created_before: Optional[int] = None
    created_after: Optional[int] = None
    updated_before: Optional[int] = None
    updated_after: Optional[int] = None
    last_message_before: Optional[int] = None
    last_message_after: Optional[int] = None
    message_count: Optional[int] = None  # Exact match, or use message_count_min/max
    message_count_min: Optional[int] = None
    message_count_max: Optional[int] = None
    limit: Optional[int] = None
    offset: Optional[int] = None
    sort_by: Optional[Literal["createdAt", "updatedAt", "lastMessageAt", "messageCount"]] = None
    sort_order: Optional[Literal["asc", "desc"]] = None
    include_messages: Optional[bool] = None


@dataclass
class ListConversationsResult:
    """Result from listing conversations with pagination metadata."""
    conversations: List[Conversation]
    total: int
    limit: int
    offset: int
    has_more: bool


@dataclass
class CountConversationsFilter:
    """Filter for counting conversations."""
    type: Optional[ConversationType] = None
    user_id: Optional[str] = None
    memory_space_id: Optional[str] = None


@dataclass
class GetHistoryOptions:
    """Options for getting conversation history."""
    limit: Optional[int] = None
    offset: Optional[int] = None
    sort_order: Optional[Literal["asc", "desc"]] = None
    since: Optional[int] = None  # Messages after timestamp
    until: Optional[int] = None  # Messages before timestamp
    roles: Optional[List[MessageRole]] = None  # Filter by role


@dataclass
class GetHistoryResult:
    """Result from getting conversation history."""
    messages: List[Message]
    total: int
    has_more: bool
    conversation_id: str


@dataclass
class ConversationDeletionResult:
    """Result from deleting a conversation."""
    deleted: bool
    conversation_id: str
    messages_deleted: int
    deleted_at: int
    restorable: bool  # Always false for conversations


@dataclass
class DeleteManyConversationsOptions:
    """Options for bulk conversation deletion."""
    dry_run: Optional[bool] = None  # Preview what would be deleted
    require_confirmation: Optional[bool] = None  # Require explicit confirmation
    confirmation_threshold: Optional[int] = None  # Threshold for auto-confirm (default: 10)


@dataclass
class DeleteManyConversationsResult:
    """Result from bulk conversation deletion."""
    deleted: int
    conversation_ids: List[str]
    total_messages_deleted: int
    would_delete: Optional[int] = None  # For dryRun mode
    dry_run: Optional[bool] = None


@dataclass
class SearchConversationsOptions:
    """Search options for conversations."""
    search_in: Optional[Literal["content", "metadata", "both"]] = None  # Default: "content"
    match_mode: Optional[Literal["contains", "exact", "fuzzy"]] = None  # Default: "contains"


@dataclass
class SearchConversationsFilters:
    """Filters for conversation search."""
    type: Optional[ConversationType] = None
    user_id: Optional[str] = None
    memory_space_id: Optional[str] = None
    date_start: Optional[int] = None
    date_end: Optional[int] = None
    limit: Optional[int] = None


@dataclass
class SearchConversationsInput:
    """Input for searching conversations."""
    query: str
    filters: Optional[SearchConversationsFilters] = None
    options: Optional[SearchConversationsOptions] = None


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


@dataclass
class ImmutableVersionExpanded:
    """Expanded version with full type/id information.

    Returned by get_version(), get_history(), and get_at_timestamp().
    """
    type: str
    id: str
    version: int
    data: Dict[str, Any]
    timestamp: int
    created_at: int
    user_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class ListImmutableFilter:
    """Filter for listing immutable entries."""
    type: Optional[str] = None
    user_id: Optional[str] = None
    limit: Optional[int] = None


@dataclass
class SearchImmutableInput:
    """Input for searching immutable entries."""
    query: str
    type: Optional[str] = None
    user_id: Optional[str] = None
    limit: Optional[int] = None


@dataclass
class ImmutableSearchResult:
    """Result from immutable search operation."""
    entry: "ImmutableRecord"
    score: float
    highlights: List[str] = field(default_factory=list)


@dataclass
class CountImmutableFilter:
    """Filter for counting immutable entries."""
    type: Optional[str] = None
    user_id: Optional[str] = None


@dataclass
class StoreImmutableOptions:
    """Options for storing immutable data."""
    sync_to_graph: Optional[bool] = None


@dataclass
class PurgeImmutableResult:
    """Result from purging an immutable entry."""
    deleted: bool
    type: str
    id: str
    versions_deleted: int


@dataclass
class PurgeManyFilter:
    """Filter for bulk purging immutable entries."""
    type: Optional[str] = None
    user_id: Optional[str] = None


@dataclass
class PurgeManyImmutableResult:
    """Result from bulk purging immutable entries."""
    deleted: int
    total_versions_deleted: int
    entries: List[Dict[str, str]] = field(default_factory=list)


@dataclass
class PurgeVersionsResult:
    """Result from purging old versions."""
    versions_purged: int
    versions_remaining: int


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
    user_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    access_count: Optional[int] = None
    last_accessed: Optional[int] = None


@dataclass
class ListMutableFilter:
    """Filter for listing mutable records."""
    namespace: str
    key_prefix: Optional[str] = None
    user_id: Optional[str] = None
    limit: Optional[int] = None
    offset: Optional[int] = None
    updated_after: Optional[int] = None
    updated_before: Optional[int] = None
    sort_by: Optional[Literal["key", "updatedAt", "accessCount"]] = None
    sort_order: Optional[Literal["asc", "desc"]] = None


@dataclass
class CountMutableFilter:
    """Filter for counting mutable records."""
    namespace: str
    user_id: Optional[str] = None
    key_prefix: Optional[str] = None
    updated_after: Optional[int] = None
    updated_before: Optional[int] = None


@dataclass
class PurgeManyMutableFilter:
    """Filter for purging multiple mutable records."""
    namespace: str
    key_prefix: Optional[str] = None
    user_id: Optional[str] = None
    updated_before: Optional[int] = None
    last_accessed_before: Optional[int] = None


@dataclass
class PurgeNamespaceOptions:
    """Options for purging a mutable namespace."""
    dry_run: Optional[bool] = None


@dataclass
class SetMutableOptions:
    """Options for mutable set operation."""
    sync_to_graph: Optional[bool] = None


@dataclass
class DeleteMutableOptions:
    """Options for mutable delete operation."""
    sync_to_graph: Optional[bool] = None


@dataclass
class MutableOperation:
    """Single operation in a mutable transaction."""
    op: Literal["set", "update", "delete", "increment", "decrement"]
    namespace: str
    key: str
    value: Optional[Any] = None
    amount: Optional[int] = None


@dataclass
class TransactionResult:
    """Result from a mutable transaction."""
    success: bool
    operations_executed: int
    results: List[Any] = field(default_factory=list)


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
class FactsRef:
    """Reference to Layer 3 fact for memory-fact linking."""
    fact_id: str
    version: Optional[int] = None


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
    participant_id: Optional[str] = None  # Hive Mode tracking
    user_id: Optional[str] = None  # For user-owned memories
    agent_id: Optional[str] = None  # For agent-owned memories
    embedding: Optional[List[float]] = None
    source_user_id: Optional[str] = None
    source_user_name: Optional[str] = None
    message_role: Optional[Literal["user", "agent", "system"]] = None  # For semantic search weighting
    conversation_ref: Optional[ConversationRef] = None
    immutable_ref: Optional[ImmutableRef] = None
    mutable_ref: Optional[MutableRef] = None
    facts_ref: Optional[FactsRef] = None  # Reference to Layer 3 fact
    last_accessed: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None  # Flexible metadata (for A2A direction, messageId, etc.)
    _score: Optional[float] = None  # Similarity score from vector search (managed mode only)
    score: Optional[float] = None  # Alias for _score
    # Enrichment fields (for bullet-proof retrieval)
    enriched_content: Optional[str] = None  # Concatenated searchable content for embedding
    fact_category: Optional[str] = None  # Category for filtering (e.g., "addressing_preference")


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
    participant_id: Optional[str] = None  # Hive Mode tracking
    embedding: Optional[List[float]] = None
    user_id: Optional[str] = None  # For user-owned memories
    agent_id: Optional[str] = None  # For agent-owned memories
    message_role: Optional[Literal["user", "agent", "system"]] = None  # For semantic search weighting
    conversation_ref: Optional[ConversationRef] = None
    immutable_ref: Optional[ImmutableRef] = None
    mutable_ref: Optional[MutableRef] = None
    facts_ref: Optional[FactsRef] = None  # Reference to Layer 3 fact
    # Enrichment fields (for bullet-proof retrieval)
    enriched_content: Optional[str] = None  # Concatenated searchable content for embedding
    fact_category: Optional[str] = None  # Category for filtering (e.g., "addressing_preference")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Layer 3: Facts
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@dataclass
class EnrichedEntity:
    """Entity extracted from enriched fact extraction."""
    name: str
    type: str
    full_value: Optional[str] = None


@dataclass
class EnrichedRelation:
    """Relation extracted from enriched fact extraction."""
    subject: str
    predicate: str
    object: str


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
    participant_id: Optional[str] = None  # Hive Mode tracking
    user_id: Optional[str] = None  # GDPR compliance - links to user
    subject: Optional[str] = None
    predicate: Optional[str] = None
    object: Optional[str] = None
    source_ref: Optional[FactSourceRef] = None
    metadata: Optional[Dict[str, Any]] = None
    valid_from: Optional[int] = None
    valid_until: Optional[int] = None
    superseded_by: Optional[str] = None
    supersedes: Optional[str] = None
    # Enrichment fields (for bullet-proof retrieval)
    category: Optional[str] = None  # Specific sub-category (e.g., "addressing_preference")
    search_aliases: Optional[List[str]] = None  # Alternative search terms
    semantic_context: Optional[str] = None  # Usage context sentence
    entities: Optional[List[EnrichedEntity]] = None  # Extracted entities with types
    relations: Optional[List[EnrichedRelation]] = None  # Subject-predicate-object triples for graph


@dataclass
class StoreFactParams:
    """Parameters for storing a fact."""
    memory_space_id: str
    fact: str
    fact_type: FactType
    confidence: int
    source_type: Literal["conversation", "system", "tool", "manual", "a2a"]
    participant_id: Optional[str] = None  # Hive Mode tracking
    user_id: Optional[str] = None  # GDPR compliance - links to user
    subject: Optional[str] = None
    predicate: Optional[str] = None
    object: Optional[str] = None
    source_ref: Optional[FactSourceRef] = None
    metadata: Optional[Dict[str, Any]] = None
    tags: Optional[List[str]] = None
    valid_from: Optional[int] = None
    valid_until: Optional[int] = None
    # Enrichment fields (for bullet-proof retrieval)
    category: Optional[str] = None  # Specific sub-category (e.g., "addressing_preference")
    search_aliases: Optional[List[str]] = None  # Alternative search terms
    semantic_context: Optional[str] = None  # Usage context sentence
    entities: Optional[List[EnrichedEntity]] = None  # Extracted entities with types
    relations: Optional[List[EnrichedRelation]] = None  # Subject-predicate-object triples for graph


@dataclass
class UpdateFactInput:
    """Input for updating a fact."""
    fact: Optional[str] = None
    confidence: Optional[int] = None
    tags: Optional[List[str]] = None
    valid_until: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None
    # Enrichment fields (for bullet-proof retrieval)
    category: Optional[str] = None  # Specific sub-category
    search_aliases: Optional[List[str]] = None  # Alternative search terms
    semantic_context: Optional[str] = None  # Usage context sentence
    entities: Optional[List[EnrichedEntity]] = None  # Extracted entities with types
    relations: Optional[List[EnrichedRelation]] = None  # Subject-predicate-object triples


@dataclass
class ListFactsFilter:
    """Universal filters for listing facts (v0.9.1+)."""
    # Required
    memory_space_id: str

    # Fact-specific filters
    fact_type: Optional[FactType] = None
    subject: Optional[str] = None
    predicate: Optional[str] = None
    object: Optional[str] = None
    min_confidence: Optional[int] = None
    confidence: Optional[int] = None  # Exact match

    # Universal filters (Cortex standard)
    user_id: Optional[str] = None
    participant_id: Optional[str] = None
    tags: Optional[List[str]] = None
    tag_match: Optional[Literal["any", "all"]] = None
    source_type: Optional[Literal["conversation", "system", "tool", "manual"]] = None

    # Date filters
    created_before: Optional[datetime] = None
    created_after: Optional[datetime] = None
    updated_before: Optional[datetime] = None
    updated_after: Optional[datetime] = None

    # Version filters
    version: Optional[int] = None
    include_superseded: Optional[bool] = None

    # Temporal validity filters
    valid_at: Optional[datetime] = None  # Facts valid at specific time

    # Metadata filters
    metadata: Optional[Dict[str, Any]] = None

    # Result options
    limit: Optional[int] = None
    offset: Optional[int] = None
    sort_by: Optional[Literal["createdAt", "updatedAt", "confidence", "version"]] = None
    sort_order: Optional[Literal["asc", "desc"]] = None


@dataclass
class CountFactsFilter:
    """Universal filters for counting facts (v0.9.1+)."""
    # Required
    memory_space_id: str

    # Fact-specific filters
    fact_type: Optional[FactType] = None
    subject: Optional[str] = None
    predicate: Optional[str] = None
    object: Optional[str] = None
    min_confidence: Optional[int] = None
    confidence: Optional[int] = None

    # Universal filters
    user_id: Optional[str] = None
    participant_id: Optional[str] = None
    tags: Optional[List[str]] = None
    tag_match: Optional[Literal["any", "all"]] = None
    source_type: Optional[Literal["conversation", "system", "tool", "manual"]] = None
    created_before: Optional[datetime] = None
    created_after: Optional[datetime] = None
    updated_before: Optional[datetime] = None
    updated_after: Optional[datetime] = None
    version: Optional[int] = None
    include_superseded: Optional[bool] = None
    valid_at: Optional[datetime] = None
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class SearchFactsOptions:
    """Universal filters for searching facts (v0.9.1+)."""
    # Fact-specific filters
    fact_type: Optional[FactType] = None
    subject: Optional[str] = None
    predicate: Optional[str] = None
    object: Optional[str] = None
    min_confidence: Optional[int] = None
    confidence: Optional[int] = None

    # Universal filters
    user_id: Optional[str] = None
    participant_id: Optional[str] = None
    tags: Optional[List[str]] = None
    tag_match: Optional[Literal["any", "all"]] = None
    source_type: Optional[Literal["conversation", "system", "tool", "manual"]] = None
    created_before: Optional[datetime] = None
    created_after: Optional[datetime] = None
    updated_before: Optional[datetime] = None
    updated_after: Optional[datetime] = None
    version: Optional[int] = None
    include_superseded: Optional[bool] = None
    valid_at: Optional[datetime] = None
    metadata: Optional[Dict[str, Any]] = None
    limit: Optional[int] = None
    offset: Optional[int] = None
    sort_by: Optional[Literal["confidence", "createdAt", "updatedAt"]] = None  # Note: search doesn't return scores
    sort_order: Optional[Literal["asc", "desc"]] = None


@dataclass
class QueryBySubjectFilter:
    """Universal filters for queryBySubject (v0.9.1+)."""
    # Required
    memory_space_id: str
    subject: str

    # Fact-specific filters
    fact_type: Optional[FactType] = None
    predicate: Optional[str] = None
    object: Optional[str] = None
    min_confidence: Optional[int] = None
    confidence: Optional[int] = None

    # Universal filters
    user_id: Optional[str] = None
    participant_id: Optional[str] = None
    tags: Optional[List[str]] = None
    tag_match: Optional[Literal["any", "all"]] = None
    source_type: Optional[Literal["conversation", "system", "tool", "manual"]] = None
    created_before: Optional[datetime] = None
    created_after: Optional[datetime] = None
    updated_before: Optional[datetime] = None
    updated_after: Optional[datetime] = None
    version: Optional[int] = None
    include_superseded: Optional[bool] = None
    valid_at: Optional[datetime] = None
    metadata: Optional[Dict[str, Any]] = None
    limit: Optional[int] = None
    offset: Optional[int] = None
    sort_by: Optional[Literal["createdAt", "updatedAt", "confidence"]] = None
    sort_order: Optional[Literal["asc", "desc"]] = None


@dataclass
class QueryByRelationshipFilter:
    """Universal filters for queryByRelationship (v0.9.1+)."""
    # Required
    memory_space_id: str
    subject: str
    predicate: str

    # Fact-specific filters
    object: Optional[str] = None
    fact_type: Optional[FactType] = None
    min_confidence: Optional[int] = None
    confidence: Optional[int] = None

    # Universal filters
    user_id: Optional[str] = None
    participant_id: Optional[str] = None
    tags: Optional[List[str]] = None
    tag_match: Optional[Literal["any", "all"]] = None
    source_type: Optional[Literal["conversation", "system", "tool", "manual"]] = None
    created_before: Optional[datetime] = None
    created_after: Optional[datetime] = None
    updated_before: Optional[datetime] = None
    updated_after: Optional[datetime] = None
    version: Optional[int] = None
    include_superseded: Optional[bool] = None
    valid_at: Optional[datetime] = None
    metadata: Optional[Dict[str, Any]] = None
    limit: Optional[int] = None
    offset: Optional[int] = None
    sort_by: Optional[Literal["createdAt", "updatedAt", "confidence"]] = None
    sort_order: Optional[Literal["asc", "desc"]] = None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Layer 4: Memory Convenience API
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@dataclass
class StoreMemoryResult:
    """Result from store() operation."""
    memory: MemoryEntry
    facts: List[FactRecord] = field(default_factory=list)


@dataclass
class UpdateMemoryResult:
    """Result from update() operation."""
    memory: MemoryEntry
    facts_reextracted: Optional[List[FactRecord]] = None


@dataclass
class DeleteMemoryResult:
    """Result from delete() operation."""
    deleted: bool
    memory_id: str
    facts_deleted: int
    fact_ids: List[str] = field(default_factory=list)


@dataclass
class ArchiveResult:
    """Result from archive() operation."""
    archived: bool
    memory_id: str
    restorable: bool
    facts_archived: int
    fact_ids: List[str] = field(default_factory=list)


@dataclass
class MemoryVersionInfo:
    """Version information for temporal queries."""
    memory_id: str
    version: int
    content: str
    timestamp: int
    embedding: Optional[List[float]] = None


@dataclass
class RememberParams:
    """Parameters for remembering a conversation.

    Ownership rules:
    - For user-agent conversations: user_id, user_name, AND agent_id are all required
    - For agent-only memories: only agent_id is required (skip conversations layer)

    Use skip_layers to explicitly opt-out of specific layers:
    - 'users': Don't auto-create user profile
    - 'agents': Don't auto-register agent
    - 'conversations': Don't store in ACID conversations
    - 'vector': Don't store in vector index
    - 'facts': Don't extract/store facts
    - 'graph': Don't sync to graph database
    """
    memory_space_id: str
    conversation_id: str
    user_message: str
    agent_response: str
    user_id: Optional[str] = None  # User owner (requires agent_id and user_name when provided)
    user_name: Optional[str] = None  # Required when user_id is provided
    agent_id: Optional[str] = None  # Agent owner (required when user_id is provided)
    participant_id: Optional[str] = None  # Hive Mode: who created this
    skip_layers: Optional[List[str]] = None  # Layers to explicitly skip during orchestration
    importance: Optional[int] = None
    tags: Optional[List[str]] = None
    extract_content: Optional[Callable[[str, str], Any]] = None
    generate_embedding: Optional[Callable[[str], Any]] = None
    extract_facts: Optional[Callable[[str, str], Any]] = None
    auto_embed: Optional[bool] = None
    auto_summarize: Optional[bool] = None
    fact_deduplication: Optional[Any] = None  # DeduplicationStrategy | DeduplicationConfig | False


@dataclass
class RememberResult:
    """Result from remember operation."""
    conversation: Dict[str, Any]  # messageIds and conversationId
    memories: List[MemoryEntry]
    facts: List[FactRecord]


@dataclass
class RememberStreamParams:
    """Parameters for remember_stream() - streaming variant of remember().

    Ownership rules:
    - For user-agent conversations: user_id, user_name, AND agent_id are all required
    - For agent-only memories: only agent_id is required (skip conversations layer)

    Use skip_layers to explicitly opt-out of specific layers:
    - 'users': Don't auto-create user profile
    - 'agents': Don't auto-register agent
    - 'conversations': Don't store in ACID conversations
    - 'vector': Don't store in vector index
    - 'facts': Don't extract/store facts
    - 'graph': Don't sync to graph database
    """
    memory_space_id: str
    conversation_id: str
    user_message: str
    response_stream: Any  # AsyncIterable[str] - async generator or iterator
    user_id: Optional[str] = None  # User owner (requires agent_id and user_name when provided)
    user_name: Optional[str] = None  # Required when user_id is provided
    agent_id: Optional[str] = None  # Agent owner (required when user_id is provided)
    participant_id: Optional[str] = None  # Hive Mode: who created this
    skip_layers: Optional[List[str]] = None  # Layers to explicitly skip during orchestration
    importance: Optional[int] = None
    tags: Optional[List[str]] = None
    extract_content: Optional[Callable[[str, str], Any]] = None
    generate_embedding: Optional[Callable[[str], Any]] = None
    extract_facts: Optional[Callable[[str, str], Any]] = None
    auto_embed: Optional[bool] = None
    auto_summarize: Optional[bool] = None
    fact_deduplication: Optional[Any] = None  # DeduplicationStrategy | DeduplicationConfig | False


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
    descendants: List[Context]
    depth: int
    total_nodes: int
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


@dataclass
class ListUsersFilter:
    """Filter options for listing users with pagination and sorting.

    Supports comprehensive filtering including date ranges, sorting,
    and client-side text filtering for displayName and email.

    Attributes:
        limit: Maximum results to return (default: 50, max: 1000)
        offset: Skip first N results for pagination (default: 0)
        created_after: Filter by createdAt > timestamp (Unix ms)
        created_before: Filter by createdAt < timestamp (Unix ms)
        updated_after: Filter by updatedAt > timestamp (Unix ms)
        updated_before: Filter by updatedAt < timestamp (Unix ms)
        sort_by: Sort by field (default: "createdAt")
        sort_order: Sort order (default: "desc")
        display_name: Filter by displayName (client-side, contains match)
        email: Filter by email (client-side, contains match)
    """
    limit: Optional[int] = None
    offset: Optional[int] = None
    created_after: Optional[int] = None
    created_before: Optional[int] = None
    updated_after: Optional[int] = None
    updated_before: Optional[int] = None
    sort_by: Optional[Literal["createdAt", "updatedAt"]] = None
    sort_order: Optional[Literal["asc", "desc"]] = None
    display_name: Optional[str] = None
    email: Optional[str] = None


@dataclass
class ListUsersResult:
    """Paginated result from listing users.

    Attributes:
        users: Array of user profiles
        total: Total count before pagination
        limit: Limit used for this query
        offset: Offset used for this query
        has_more: Whether there are more results beyond this page
    """
    users: List[UserProfile]
    total: int
    limit: int
    offset: int
    has_more: bool


@dataclass
class ExportUsersOptions:
    """Options for exporting user profiles.

    Attributes:
        format: Export format ('json' or 'csv')
        filters: Optional filters to apply before export
        include_version_history: Include previousVersions array in export
        include_conversations: Query and include user's conversations
        include_memories: Query and include user's memories across all memory spaces
    """
    format: Literal["json", "csv"]
    filters: Optional["ListUsersFilter"] = None
    include_version_history: Optional[bool] = None
    include_conversations: Optional[bool] = None
    include_memories: Optional[bool] = None


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
    """Result from agent unregistration.

    Uses GDPR-style best-effort cascade deletion:
    - Continues on individual layer failures
    - Reports what succeeded and what failed
    - Maximizes data deletion even if some operations fail
    """
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
    deletion_errors: List[str] = field(default_factory=list)  # Errors from best-effort deletion


@dataclass
class AgentFilters:
    """Filter options for listing/searching agents.

    Matches TypeScript SDK AgentFilters interface for full parity.
    """
    metadata: Optional[Dict[str, Any]] = None
    name: Optional[str] = None  # Search in agent name (case-insensitive contains)
    capabilities: Optional[List[str]] = None  # Filter by capabilities in metadata.capabilities
    capabilities_match: Optional[Literal["any", "all"]] = None  # "any" (default) or "all"
    status: Optional[Literal["active", "inactive", "archived"]] = None
    registered_after: Optional[int] = None  # Unix timestamp in milliseconds
    registered_before: Optional[int] = None  # Unix timestamp in milliseconds
    last_active_after: Optional[int] = None  # Filter agents last active after timestamp
    last_active_before: Optional[int] = None  # Filter agents last active before timestamp
    limit: Optional[int] = None  # Max results (1-1000, default 100)
    offset: Optional[int] = None  # Pagination offset
    sort_by: Optional[Literal["name", "registeredAt", "lastActive"]] = None
    sort_order: Optional[Literal["asc", "desc"]] = None


@dataclass
class ExportAgentsOptions:
    """Options for exporting agents.

    Matches TypeScript SDK ExportAgentsOptions interface.
    """
    format: Literal["json", "csv"]
    filters: Optional[AgentFilters] = None
    include_metadata: bool = True
    include_stats: bool = False


@dataclass
class ExportAgentsResult:
    """Result from agent export.

    Matches TypeScript SDK ExportAgentsResult interface.
    """
    format: str
    data: str
    count: int
    exported_at: int


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
    memories_this_window: Optional[int] = None  # Count within time window
    conversations_this_window: Optional[int] = None  # Count within time window
    avg_search_time: Optional[str] = None
    participants: Optional[List[Dict[str, Any]]] = None


@dataclass
class ListMemorySpacesFilter:
    """Filter options for listing memory spaces."""
    type: Optional[MemorySpaceType] = None
    status: Optional[MemorySpaceStatus] = None
    participant: Optional[str] = None
    limit: Optional[int] = None
    offset: Optional[int] = None
    sort_by: Optional[Literal["createdAt", "updatedAt", "name"]] = None
    sort_order: Optional[Literal["asc", "desc"]] = None


@dataclass
class ListMemorySpacesResult:
    """Result from listing memory spaces with pagination."""
    spaces: List[MemorySpace]
    total: int
    has_more: bool
    offset: int


@dataclass
class DeleteMemorySpaceOptions:
    """Options for deleting a memory space."""
    cascade: bool
    reason: str
    confirm_id: Optional[str] = None
    sync_to_graph: Optional[bool] = None


@dataclass
class DeleteMemorySpaceCascade:
    """Cascade deletion counts for memory space deletion."""
    conversations_deleted: int
    memories_deleted: int
    facts_deleted: int
    total_bytes: int


@dataclass
class DeleteMemorySpaceResult:
    """Result from deleting a memory space."""
    memory_space_id: str
    deleted: bool
    cascade: DeleteMemorySpaceCascade
    reason: str
    deleted_at: int


@dataclass
class GetMemorySpaceStatsOptions:
    """Options for getting memory space statistics."""
    time_window: Optional[Literal["24h", "7d", "30d", "90d", "all"]] = None
    include_participants: Optional[bool] = None


@dataclass
class UpdateMemorySpaceOptions:
    """Options for updating a memory space."""
    sync_to_graph: Optional[bool] = None


@dataclass
class ParticipantUpdates:
    """Updates for memory space participants."""
    add: Optional[List[Dict[str, Any]]] = None
    remove: Optional[List[str]] = None


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


@dataclass
class A2AConversationFilters:
    """Filters for getConversation.

    All filter fields are optional. The since/until fields accept Unix timestamps
    in milliseconds (matching TypeScript SDK's Date.getTime()).
    """
    since: Optional[int] = None  # Unix timestamp (ms) - filter by start date
    until: Optional[int] = None  # Unix timestamp (ms) - filter by end date
    min_importance: Optional[int] = None  # Minimum importance filter (0-100)
    tags: Optional[List[str]] = None  # Filter by tags
    user_id: Optional[str] = None  # Filter A2A about specific user
    limit: int = 100  # Maximum messages to return
    offset: int = 0  # Pagination offset


@dataclass
class A2AConversationMessage:
    """Individual message in A2A conversation.

    Represents a single message exchanged between two agents.
    """
    from_agent: str  # Sender agent ID
    to_agent: str  # Receiver agent ID
    message: str  # Message content
    importance: int  # Importance level (0-100)
    timestamp: int  # Unix timestamp (ms)
    message_id: str  # Unique message ID
    memory_id: str  # Vector memory ID
    acid_message_id: Optional[str] = None  # ACID message ID (if tracked)
    tags: Optional[List[str]] = None  # Tags
    direction: Optional[str] = None  # "inbound" or "outbound"
    broadcast: Optional[bool] = None  # True if part of broadcast
    broadcast_id: Optional[str] = None  # Broadcast ID if applicable


@dataclass
class A2AConversation:
    """A2A conversation result.

    Represents a conversation between two agents with message history
    and metadata about the conversation period.
    """
    participants: List[str]  # Tuple of 2 agent IDs
    message_count: int  # Total message count (before pagination)
    messages: List[A2AConversationMessage]  # Conversation messages
    period_start: int  # Start of time period covered (Unix timestamp ms)
    period_end: int  # End of time period covered (Unix timestamp ms)
    can_retrieve_full_history: bool  # True if ACID conversation exists
    conversation_id: Optional[str] = None  # ACID conversation ID (if exists)
    tags: Optional[List[str]] = None  # Tags found in messages


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
    query_category: Optional[str] = None  # Category boost for bullet-proof retrieval
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
class GraphQuery:
    """A graph query with Cypher and optional parameters."""
    cypher: str
    params: Optional[Dict[str, Any]] = None


@dataclass
class GraphQueryResult:
    """Result from graph query."""
    records: List[Dict[str, Any]]
    count: int
    summary: Optional[Dict[str, Any]] = None
    stats: Optional["QueryStatistics"] = None


@dataclass
class QueryStatistics:
    """Query execution statistics."""
    nodes_created: int = 0
    nodes_deleted: int = 0
    relationships_created: int = 0
    relationships_deleted: int = 0
    properties_set: int = 0
    labels_added: int = 0


@dataclass
class GraphOperation:
    """Batch operation for graph write."""
    operation: Literal["CREATE_NODE", "UPDATE_NODE", "DELETE_NODE", "CREATE_EDGE", "DELETE_EDGE"]
    node_type: Optional[str] = None
    node_id: Optional[str] = None
    properties: Optional[Dict[str, Any]] = None
    edge_type: Optional[str] = None
    source_id: Optional[str] = None
    target_id: Optional[str] = None


@dataclass
class OrphanRule:
    """Orphan detection rules for different node types."""
    node_type: str
    keep_if_referenced_by: List[str]
    never_auto_delete: bool = False


@dataclass
class DeletionContext:
    """Context for tracking deletions."""
    reason: str
    rules: List[OrphanRule]
    deleted_ids: List[str] = field(default_factory=list)
    visited_ids: List[str] = field(default_factory=list)


@dataclass
class OrphanCheckResult:
    """Result of orphan detection."""
    is_orphan: bool
    referenced_by: List[str] = field(default_factory=list)
    circular_island: bool = False


@dataclass
class GraphDeleteResult:
    """Result of cascading delete operation."""
    deleted_nodes: List[str] = field(default_factory=list)
    deleted_edges: List[str] = field(default_factory=list)
    orphan_islands: List[List[str]] = field(default_factory=list)


@dataclass
class BatchSyncLimits:
    """Limits for batch sync operations per entity type."""
    memories: int = 10000
    facts: int = 10000
    users: int = 1000
    agents: int = 1000


@dataclass
class BatchSyncStats:
    """Stats for a single entity type in batch sync."""
    synced: int = 0
    failed: int = 0
    skipped: int = 0


@dataclass
class BatchSyncError:
    """Error from batch sync operation."""
    entity_type: str
    entity_id: str
    error: str


@dataclass
class BatchSyncResult:
    """Full result from batch graph sync."""
    memories: BatchSyncStats = field(default_factory=BatchSyncStats)
    facts: BatchSyncStats = field(default_factory=BatchSyncStats)
    users: BatchSyncStats = field(default_factory=BatchSyncStats)
    agents: BatchSyncStats = field(default_factory=BatchSyncStats)
    errors: List[BatchSyncError] = field(default_factory=list)
    duration: int = 0


@dataclass
class BatchSyncOptions:
    """Options for batch graph sync."""
    limits: Optional[BatchSyncLimits] = None
    sync_relationships: bool = True
    on_progress: Optional[Any] = None  # Callback function


@dataclass
class SchemaVerificationResult:
    """Result from schema verification."""
    valid: bool
    missing: List[str] = field(default_factory=list)
    extra: List[str] = field(default_factory=list)


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
class LLMConfig:
    """
    LLM configuration for automatic fact extraction.

    When configured, enables automatic fact extraction from conversations
    during remember() operations (unless explicitly skipped via skip_layers).
    """
    provider: Literal["openai", "anthropic", "custom"]
    api_key: str
    model: Optional[str] = None
    extract_facts: Optional[Callable] = None
    max_tokens: int = 1000
    temperature: float = 0.1


@dataclass
class CortexConfig:
    """Main Cortex SDK configuration."""
    convex_url: str
    graph: Optional[GraphConfig] = None
    resilience: Optional[Any] = None  # ResilienceConfig from resilience module
    llm: Optional[LLMConfig] = None  # LLM config for auto fact extraction


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
class DeleteManyFactsParams:
    """Parameters for deleting multiple facts."""
    # Required
    memory_space_id: str

    # Optional filters
    user_id: Optional[str] = None  # Filter by user (GDPR cleanup)
    fact_type: Optional[FactType] = None  # Filter by fact type


@dataclass
class DeleteFactResult:
    """Result from deleting a fact."""
    deleted: bool
    fact_id: str


@dataclass
class DeleteManyFactsResult:
    """Result from deleting multiple facts."""
    deleted: int
    memory_space_id: str


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
    """
    Protocol defining the interface for graph database adapters.

    Supports Neo4j, Memgraph, and other Cypher-compatible graph databases.
    """

    # ============================================================================
    # Connection Management
    # ============================================================================

    async def connect(self, config: GraphConnectionConfig) -> None:
        """
        Connect to the graph database.

        Args:
            config: Connection configuration
        """
        ...

    async def disconnect(self) -> None:
        """Disconnect from the graph database."""
        ...

    async def is_connected(self) -> bool:
        """
        Test the database connection.

        Returns:
            True if connected, False otherwise
        """
        ...

    # ============================================================================
    # Node Operations
    # ============================================================================

    async def create_node(self, node: GraphNode) -> str:
        """
        Create a node in the graph.

        Args:
            node: Node to create

        Returns:
            The created node ID
        """
        ...

    async def merge_node(
        self, node: GraphNode, match_properties: Dict[str, Any]
    ) -> str:
        """
        Merge (upsert) a node in the graph.

        Uses MERGE semantics: creates if not exists, matches if exists.
        Updates properties on existing nodes. Idempotent and safe for concurrent ops.

        Args:
            node: Node to merge
            match_properties: Properties to match on (for finding existing node)

        Returns:
            Node ID (existing or newly created)
        """
        ...

    async def get_node(self, node_id: str) -> Optional[GraphNode]:
        """
        Get a node by ID.

        Args:
            node_id: Node ID

        Returns:
            The node, or None if not found
        """
        ...

    async def update_node(self, node_id: str, properties: Dict[str, Any]) -> None:
        """
        Update a node's properties.

        Args:
            node_id: Node ID
            properties: Properties to update
        """
        ...

    async def delete_node(self, node_id: str, detach: bool = True) -> None:
        """
        Delete a node.

        Args:
            node_id: Node ID
            detach: If True, also deletes connected relationships
        """
        ...

    async def find_nodes(
        self,
        label: str,
        properties: Optional[Dict[str, Any]] = None,
        limit: int = 100,
    ) -> List[GraphNode]:
        """
        Find nodes by label and properties.

        Args:
            label: Node label
            properties: Properties to match
            limit: Maximum number of results

        Returns:
            List of matching nodes
        """
        ...

    # ============================================================================
    # Edge Operations
    # ============================================================================

    async def create_edge(self, edge: GraphEdge) -> str:
        """
        Create an edge (relationship) between two nodes.

        Args:
            edge: Edge to create

        Returns:
            The created edge ID
        """
        ...

    async def delete_edge(self, edge_id: str) -> None:
        """
        Delete an edge.

        Args:
            edge_id: Edge ID
        """
        ...

    async def find_edges(
        self,
        edge_type: str,
        properties: Optional[Dict[str, Any]] = None,
        limit: int = 100,
    ) -> List[GraphEdge]:
        """
        Find edges by type and properties.

        Args:
            edge_type: Edge type
            properties: Properties to match
            limit: Maximum number of results

        Returns:
            List of matching edges
        """
        ...

    # ============================================================================
    # Query Operations
    # ============================================================================

    async def query(
        self,
        query: "GraphQuery | str",
        params: Optional[Dict[str, Any]] = None,
    ) -> GraphQueryResult:
        """
        Execute a raw Cypher query.

        Args:
            query: Query object or Cypher string
            params: Optional query parameters

        Returns:
            Query results
        """
        ...

    async def traverse(self, config: TraversalConfig) -> List[GraphNode]:
        """
        Traverse the graph from a starting node.

        Args:
            config: Traversal configuration

        Returns:
            List of connected nodes
        """
        ...

    async def find_path(self, config: ShortestPathConfig) -> Optional[GraphPath]:
        """
        Find the shortest path between two nodes.

        Args:
            config: Shortest path configuration

        Returns:
            The path, or None if no path exists
        """
        ...

    # ============================================================================
    # Batch Operations
    # ============================================================================

    async def batch_write(self, operations: List[GraphOperation]) -> None:
        """
        Execute multiple operations in a single transaction.

        Args:
            operations: Array of operations to execute
        """
        ...

    # ============================================================================
    # Utility Operations
    # ============================================================================

    async def count_nodes(self, label: Optional[str] = None) -> int:
        """
        Count nodes in the database.

        Args:
            label: Optional label to filter by

        Returns:
            The count
        """
        ...

    async def count_edges(self, edge_type: Optional[str] = None) -> int:
        """
        Count edges in the database.

        Args:
            edge_type: Optional type to filter by

        Returns:
            The count
        """
        ...

    async def clear_database(self) -> None:
        """
        Clear all data from the database.

        WARNING: This deletes all nodes and relationships!
        """
        ...



# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Governance Policies API
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ComplianceMode = Literal["GDPR", "HIPAA", "SOC2", "FINRA", "Custom"]
ComplianceTemplate = Literal["GDPR", "HIPAA", "SOC2", "FINRA"]


@dataclass
class ConversationsRetention:
    """Conversations retention settings."""
    delete_after: str  # '7y', '30d', etc.
    purge_on_user_request: bool
    archive_after: Optional[str] = None


@dataclass
class ConversationsPurging:
    """Conversations purging settings."""
    auto_delete: bool
    delete_inactive_after: Optional[str] = None


@dataclass
class ConversationsPolicy:
    """Conversations governance policy."""
    retention: ConversationsRetention
    purging: ConversationsPurging


@dataclass
class ImmutableTypeRetention:
    """Retention settings for a specific immutable type."""
    versions_to_keep: int  # -1 = unlimited
    delete_after: Optional[str] = None


@dataclass
class ImmutableRetention:
    """Immutable retention settings."""
    default_versions: int
    by_type: Dict[str, ImmutableTypeRetention] = field(default_factory=dict)


@dataclass
class ImmutablePurging:
    """Immutable purging settings."""
    auto_cleanup_versions: bool
    purge_unused_after: Optional[str] = None


@dataclass
class ImmutablePolicy:
    """Immutable governance policy."""
    retention: ImmutableRetention
    purging: ImmutablePurging


@dataclass
class MutableRetention:
    """Mutable retention settings."""
    default_ttl: Optional[str] = None
    purge_inactive_after: Optional[str] = None


@dataclass
class MutablePurging:
    """Mutable purging settings."""
    auto_delete: bool
    delete_unaccessed_after: Optional[str] = None


@dataclass
class MutablePolicy:
    """Mutable governance policy."""
    retention: MutableRetention
    purging: MutablePurging


@dataclass
class ImportanceRange:
    """Importance range for version retention."""
    range: List[int]  # [min, max]
    versions: int


@dataclass
class VectorRetention:
    """Vector retention settings."""
    default_versions: int
    by_importance: List[ImportanceRange] = field(default_factory=list)
    by_source_type: Optional[Dict[str, int]] = None


@dataclass
class VectorPurging:
    """Vector purging settings."""
    auto_cleanup_versions: bool
    delete_orphaned: bool


@dataclass
class VectorPolicy:
    """Vector governance policy."""
    retention: VectorRetention
    purging: VectorPurging


@dataclass
class ComplianceSettings:
    """Compliance settings."""
    mode: ComplianceMode
    data_retention_years: int
    require_justification: List[int]
    audit_logging: bool


@dataclass
class GovernancePolicy:
    """Complete governance policy for organization or memory space."""
    conversations: ConversationsPolicy
    immutable: ImmutablePolicy
    mutable: MutablePolicy
    vector: VectorPolicy
    compliance: ComplianceSettings
    organization_id: Optional[str] = None
    memory_space_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for Convex."""
        return {
            "organizationId": self.organization_id,
            "memorySpaceId": self.memory_space_id,
            "conversations": {
                "retention": {
                    "deleteAfter": self.conversations.retention.delete_after,
                    "archiveAfter": self.conversations.retention.archive_after,
                    "purgeOnUserRequest": self.conversations.retention.purge_on_user_request,
                },
                "purging": {
                    "autoDelete": self.conversations.purging.auto_delete,
                    "deleteInactiveAfter": self.conversations.purging.delete_inactive_after,
                },
            },
            "immutable": {
                "retention": {
                    "defaultVersions": self.immutable.retention.default_versions,
                    "byType": {
                        k: {
                            "versionsToKeep": v.versions_to_keep,
                            "deleteAfter": v.delete_after,
                        }
                        for k, v in self.immutable.retention.by_type.items()
                    },
                },
                "purging": {
                    "autoCleanupVersions": self.immutable.purging.auto_cleanup_versions,
                    "purgeUnusedAfter": self.immutable.purging.purge_unused_after,
                },
            },
            "mutable": {
                "retention": {
                    "defaultTTL": self.mutable.retention.default_ttl,
                    "purgeInactiveAfter": self.mutable.retention.purge_inactive_after,
                },
                "purging": {
                    "autoDelete": self.mutable.purging.auto_delete,
                    "deleteUnaccessedAfter": self.mutable.purging.delete_unaccessed_after,
                },
            },
            "vector": {
                "retention": {
                    "defaultVersions": self.vector.retention.default_versions,
                    "byImportance": [
                        {"range": r.range, "versions": r.versions}
                        for r in self.vector.retention.by_importance
                    ],
                    "bySourceType": self.vector.retention.by_source_type,
                },
                "purging": {
                    "autoCleanupVersions": self.vector.purging.auto_cleanup_versions,
                    "deleteOrphaned": self.vector.purging.delete_orphaned,
                },
            },
            "compliance": {
                "mode": self.compliance.mode,
                "dataRetentionYears": self.compliance.data_retention_years,
                "requireJustification": self.compliance.require_justification,
                "auditLogging": self.compliance.audit_logging,
            },
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "GovernancePolicy":
        """Create from dictionary (Convex response)."""
        return cls(
            organization_id=data.get("organizationId"),
            memory_space_id=data.get("memorySpaceId"),
            conversations=ConversationsPolicy(
                retention=ConversationsRetention(
                    delete_after=data["conversations"]["retention"]["deleteAfter"],
                    archive_after=data["conversations"]["retention"].get("archiveAfter"),
                    purge_on_user_request=data["conversations"]["retention"]["purgeOnUserRequest"],
                ),
                purging=ConversationsPurging(
                    auto_delete=data["conversations"]["purging"]["autoDelete"],
                    delete_inactive_after=data["conversations"]["purging"].get("deleteInactiveAfter"),
                ),
            ),
            immutable=ImmutablePolicy(
                retention=ImmutableRetention(
                    default_versions=data["immutable"]["retention"]["defaultVersions"],
                    by_type={
                        k: ImmutableTypeRetention(
                            versions_to_keep=v["versionsToKeep"],
                            delete_after=v.get("deleteAfter"),
                        )
                        for k, v in data["immutable"]["retention"].get("byType", {}).items()
                    },
                ),
                purging=ImmutablePurging(
                    auto_cleanup_versions=data["immutable"]["purging"]["autoCleanupVersions"],
                    purge_unused_after=data["immutable"]["purging"].get("purgeUnusedAfter"),
                ),
            ),
            mutable=MutablePolicy(
                retention=MutableRetention(
                    default_ttl=data["mutable"]["retention"].get("defaultTTL"),
                    purge_inactive_after=data["mutable"]["retention"].get("purgeInactiveAfter"),
                ),
                purging=MutablePurging(
                    auto_delete=data["mutable"]["purging"]["autoDelete"],
                    delete_unaccessed_after=data["mutable"]["purging"].get("deleteUnaccessedAfter"),
                ),
            ),
            vector=VectorPolicy(
                retention=VectorRetention(
                    default_versions=data["vector"]["retention"]["defaultVersions"],
                    by_importance=[
                        ImportanceRange(range=r["range"], versions=r["versions"])
                        for r in data["vector"]["retention"].get("byImportance", [])
                    ],
                    by_source_type=data["vector"]["retention"].get("bySourceType"),
                ),
                purging=VectorPurging(
                    auto_cleanup_versions=data["vector"]["purging"]["autoCleanupVersions"],
                    delete_orphaned=data["vector"]["purging"]["deleteOrphaned"],
                ),
            ),
            compliance=ComplianceSettings(
                mode=data["compliance"]["mode"],
                data_retention_years=data["compliance"]["dataRetentionYears"],
                require_justification=data["compliance"]["requireJustification"],
                audit_logging=data["compliance"]["auditLogging"],
            ),
        )


@dataclass
class PolicyScope:
    """Policy scope (organization or memory space)."""
    organization_id: Optional[str] = None
    memory_space_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for Convex."""
        result: Dict[str, Any] = {}
        if self.organization_id:
            result["organizationId"] = self.organization_id
        if self.memory_space_id:
            result["memorySpaceId"] = self.memory_space_id
        return result


@dataclass
class PolicyResult:
    """Result from setting a policy."""
    policy_id: str
    applied_at: int
    scope: Dict[str, Any]
    success: bool

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "PolicyResult":
        """Create from dictionary (Convex response)."""
        return cls(
            policy_id=data["policyId"],
            applied_at=data["appliedAt"],
            scope=data["scope"],
            success=data["success"],
        )


@dataclass
class EnforcementOptions:
    """Options for manual policy enforcement."""
    layers: Optional[List[str]] = None
    rules: Optional[List[str]] = None
    scope: Optional[PolicyScope] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for Convex."""
        result: Dict[str, Any] = {}
        if self.layers:
            result["layers"] = self.layers
        if self.rules:
            result["rules"] = self.rules
        if self.scope:
            scope_dict = self.scope.to_dict()
            if scope_dict:  # Only add if not empty
                result["scope"] = scope_dict
        return result


@dataclass
class EnforcementResult:
    """Result from policy enforcement."""
    enforced_at: int
    versions_deleted: int
    records_purged: int
    storage_freed: float  # MB
    affected_layers: List[str]

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "EnforcementResult":
        """Create from dictionary (Convex response)."""
        return cls(
            enforced_at=data["enforcedAt"],
            versions_deleted=data["versionsDeleted"],
            records_purged=data["recordsPurged"],
            storage_freed=data["storageFreed"],
            affected_layers=data["affectedLayers"],
        )


@dataclass
class SimulationOptions:
    """Options for policy simulation."""
    organization_id: Optional[str] = None
    memory_space_id: Optional[str] = None
    vector: Optional[VectorPolicy] = None
    conversations: Optional[ConversationsPolicy] = None
    immutable: Optional[ImmutablePolicy] = None
    mutable: Optional[MutablePolicy] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for Convex."""
        result: Dict[str, Any] = {}
        if self.organization_id:
            result["organizationId"] = self.organization_id
        if self.memory_space_id:
            result["memorySpaceId"] = self.memory_space_id
        # Add other fields as needed
        return result


@dataclass
class SimulationBreakdown:
    """Breakdown of simulation impact by layer."""
    affected: int
    storage_mb: float


@dataclass
class SimulationResult:
    """Result from policy simulation."""
    versions_affected: int
    records_affected: int
    storage_freed: float  # MB
    cost_savings: float  # USD/month
    breakdown: Dict[str, Any]

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "SimulationResult":
        """Create from dictionary (Convex response)."""
        return cls(
            versions_affected=data["versionsAffected"],
            records_affected=data["recordsAffected"],
            storage_freed=data["storageFreed"],
            cost_savings=data["costSavings"],
            breakdown=data.get("breakdown", {}),
        )


@dataclass
class ComplianceReportOptions:
    """Options for compliance report generation."""
    organization_id: Optional[str] = None
    memory_space_id: Optional[str] = None
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for Convex."""
        result: Dict[str, Any] = {}
        if self.organization_id:
            result["organizationId"] = self.organization_id
        if self.memory_space_id:
            result["memorySpaceId"] = self.memory_space_id
        result["period"] = {
            "start": int(self.period_start.timestamp() * 1000) if self.period_start else 0,
            "end": int(self.period_end.timestamp() * 1000) if self.period_end else 0,
        }
        return result


@dataclass
class ComplianceLayerStatus:
    """Compliance status for a specific layer."""
    total: int
    deleted: int
    archived: int
    compliance_status: str


@dataclass
class ComplianceReport:
    """Detailed compliance report."""
    organization_id: Optional[str]
    memory_space_id: Optional[str]
    period: Dict[str, int]
    generated_at: int
    conversations: Dict[str, Any]
    immutable: Dict[str, Any]
    vector: Dict[str, Any]
    data_retention: Dict[str, Any]
    user_requests: Dict[str, Any]

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ComplianceReport":
        """Create from dictionary (Convex response)."""
        return cls(
            organization_id=data.get("organizationId"),
            memory_space_id=data.get("memorySpaceId"),
            period=data["period"],
            generated_at=data["generatedAt"],
            conversations=data["conversations"],
            immutable=data["immutable"],
            vector=data["vector"],
            data_retention=data["dataRetention"],
            user_requests=data["userRequests"],
        )


@dataclass
class EnforcementStatsOptions:
    """Options for enforcement statistics."""
    period: str  # "7d", "30d", "90d", "1y"
    organization_id: Optional[str] = None
    memory_space_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for Convex."""
        result: Dict[str, Any] = {"period": self.period}
        if self.organization_id:
            result["organizationId"] = self.organization_id
        if self.memory_space_id:
            result["memorySpaceId"] = self.memory_space_id
        return result


@dataclass
class EnforcementStats:
    """Statistics about policy enforcement."""
    period: Dict[str, int]
    conversations: Dict[str, int]
    immutable: Dict[str, int]
    vector: Dict[str, int]
    mutable: Dict[str, int]
    storage_freed: float  # MB
    cost_savings: float  # USD

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "EnforcementStats":
        """Create from dictionary (Convex response)."""
        return cls(
            period=data["period"],
            conversations=data["conversations"],
            immutable=data["immutable"],
            vector=data["vector"],
            mutable=data["mutable"],
            storage_freed=data["storageFreed"],
            cost_savings=data["costSavings"],
        )
