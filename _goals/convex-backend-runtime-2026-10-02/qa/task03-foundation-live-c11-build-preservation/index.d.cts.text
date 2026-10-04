import { ConvexClient, ConvexHttpClient } from 'convex/browser';

/**
 * Cortex SDK - Sessions API Types
 *
 * Fully extensible session management types.
 */
/**
 * Session status
 */
type SessionStatus = "active" | "idle" | "ended";
/**
 * Session metadata - fully extensible
 *
 * Suggested fields (all optional, add any custom fields):
 * - device: string (e.g., "Chrome on macOS")
 * - browser: string (e.g., "Chrome 120")
 * - browserVersion: string
 * - os: string (e.g., "macOS 14.0")
 * - deviceType: string (e.g., "desktop", "mobile", "tablet")
 * - ip: string
 * - location: string (e.g., "San Francisco, CA")
 * - timezone: string (e.g., "America/Los_Angeles")
 * - language: string (e.g., "en-US")
 * - userAgent: string
 *
 * Add any custom fields your application needs.
 */
interface SessionMetadata {
    /** Device description (e.g., "Chrome on macOS") */
    device?: string;
    /** Browser name */
    browser?: string;
    /** Browser version */
    browserVersion?: string;
    /** Operating system */
    os?: string;
    /** Device type: desktop, mobile, tablet */
    deviceType?: "desktop" | "mobile" | "tablet" | string;
    /** Client IP address */
    ip?: string;
    /** Geographic location */
    location?: string;
    /** Timezone identifier */
    timezone?: string;
    /** Language preference */
    language?: string;
    /** Full user agent string */
    userAgent?: string;
    /** Any additional custom fields */
    [key: string]: unknown;
}
/**
 * Session record stored in Convex
 */
interface Session {
    /** Convex document ID */
    _id: string;
    /** Unique session identifier */
    sessionId: string;
    /** User this session belongs to */
    userId: string;
    /** Tenant ID for multi-tenant applications */
    tenantId?: string;
    /** Memory space associated with this session */
    memorySpaceId?: string;
    /** Current session status */
    status: SessionStatus;
    /** When the session started (ms since epoch) */
    startedAt: number;
    /** When the session was last active (ms since epoch) */
    lastActiveAt: number;
    /** When the session ended (ms since epoch) */
    endedAt?: number;
    /** When the session expires (ms since epoch) */
    expiresAt?: number;
    /** Fully extensible metadata */
    metadata?: SessionMetadata;
    /** Number of messages in this session */
    messageCount: number;
    /** Number of memories created in this session */
    memoryCount: number;
}
/**
 * Parameters for creating a session
 */
interface CreateSessionParams {
    /** Optional session ID (auto-generated if not provided) */
    sessionId?: string;
    /** User ID (required) */
    userId: string;
    /** Tenant ID for multi-tenant applications */
    tenantId?: string;
    /** Memory space to associate with this session */
    memorySpaceId?: string;
    /** Session expiration time (ms since epoch) */
    expiresAt?: number;
    /** Fully extensible metadata */
    metadata?: SessionMetadata;
}
/**
 * Filters for listing sessions
 */
interface SessionFilters {
    /** Filter by user ID */
    userId?: string;
    /** Filter by tenant ID */
    tenantId?: string;
    /** Filter by memory space ID */
    memorySpaceId?: string;
    /** Filter by session status */
    status?: SessionStatus;
    /** Maximum results to return */
    limit?: number;
    /** Offset for pagination */
    offset?: number;
}
/**
 * Options for expiring idle sessions
 */
interface ExpireSessionsOptions {
    /** Only expire sessions for this tenant */
    tenantId?: string;
    /** Idle timeout in milliseconds (default: 30 minutes) */
    idleTimeout?: number;
}
/**
 * Options for ending all sessions for a user
 */
interface EndAllOptions {
    /**
     * Tenant ID for multi-tenant isolation.
     * When provided, only ends sessions for the user within that tenant.
     * Without this (and no AuthContext), ALL sessions for the userId across ALL tenants are ended.
     */
    tenantId?: string;
}
/**
 * Result from ending sessions
 */
interface EndSessionsResult {
    /** Number of sessions ended */
    ended: number;
    /** Session IDs that were ended */
    sessionIds: string[];
}

/**
 * Cortex SDK - Auth Context Types
 *
 * Fully extensible authentication context for multi-tenant applications.
 */
/**
 * Authentication method used to obtain credentials
 */
type AuthMethod = "oauth" | "api_key" | "jwt" | "session" | "custom";
/**
 * Authentication context for Cortex operations.
 *
 * This is the fully-resolved auth context that gets auto-injected
 * into all Cortex operations when provided to the Cortex constructor.
 *
 * @example
 * ```typescript
 * const cortex = new Cortex({
 *   convexUrl: process.env.CONVEX_URL!,
 *   auth: createAuthContext({
 *     userId: 'user-123',
 *     tenantId: 'tenant-456',
 *     metadata: { customField: 'any-value' },
 *   }),
 * });
 *
 * // All operations auto-scoped to auth context
 * await cortex.memory.remember({ ... }); // userId, tenantId auto-injected
 * ```
 */
interface AuthContext {
    /** Unique user identifier (required) */
    userId: string;
    /**
     * Tenant identifier for multi-tenant applications.
     *
     * When provided, all queries are automatically scoped to this tenant.
     * This is the primary isolation boundary for SaaS applications.
     *
     * @example "tenant-acme-corp"
     */
    tenantId?: string;
    /**
     * Organization identifier within a tenant.
     *
     * For hierarchical multi-tenancy (tenant → organization → user).
     *
     * @example "org-engineering"
     */
    organizationId?: string;
    /**
     * Current session identifier.
     *
     * If provided, operations are associated with this session.
     * Can be managed via cortex.sessions.* API.
     */
    sessionId?: string;
    /**
     * Authentication provider name.
     *
     * @example "auth0", "firebase", "clerk", "nextauth", "custom"
     */
    authProvider?: string;
    /**
     * Authentication method used.
     */
    authMethod?: AuthMethod;
    /**
     * Timestamp when authentication occurred (ms since epoch).
     */
    authenticatedAt?: number;
    /**
     * Raw JWT/provider claims (filtered for safety).
     *
     * Pass through any claims from your auth provider that you need
     * to reference in your application logic.
     *
     * @example
     * ```typescript
     * claims: {
     *   'https://myapp.com/roles': ['admin', 'editor'],
     *   'https://myapp.com/subscription': 'enterprise',
     *   'aud': 'my-api',
     *   'iss': 'auth0',
     * }
     * ```
     */
    claims?: Record<string, unknown>;
    /**
     * Arbitrary developer-defined metadata.
     *
     * Use this for any custom data you need to associate with the
     * auth context. This is NOT stored in Cortex; it's only used
     * for runtime context injection.
     *
     * @example
     * ```typescript
     * metadata: {
     *   internalUserId: 'legacy-id-789',
     *   featureFlags: ['beta-features', 'new-ui'],
     *   region: 'us-west-2',
     *   customField: 'anything you need',
     * }
     * ```
     */
    metadata?: Record<string, unknown>;
}
/**
 * Parameters for creating an AuthContext.
 *
 * Same as AuthContext but with explicit optional typing for creation.
 */
interface AuthContextParams {
    /** Unique user identifier (required) */
    userId: string;
    /** Tenant identifier for multi-tenant applications */
    tenantId?: string;
    /** Organization identifier within a tenant */
    organizationId?: string;
    /** Current session identifier */
    sessionId?: string;
    /** Authentication provider name */
    authProvider?: string;
    /** Authentication method used */
    authMethod?: AuthMethod;
    /** Timestamp when authentication occurred */
    authenticatedAt?: number;
    /** Raw JWT/provider claims */
    claims?: Record<string, unknown>;
    /** Arbitrary developer-defined metadata */
    metadata?: Record<string, unknown>;
}

/**
 * Streaming-specific type definitions for RememberStream API
 *
 * Comprehensive types for progressive streaming, real-time processing,
 * error recovery, and advanced streaming features.
 */

/**
 * Event emitted for each chunk received from the stream
 */
interface ChunkEvent {
    chunk: string;
    chunkNumber: number;
    accumulated: string;
    timestamp: number;
    estimatedTokens: number;
}
/**
 * Progress update during streaming
 */
interface ProgressEvent {
    bytesProcessed: number;
    chunks: number;
    elapsedMs: number;
    estimatedCompletion?: number;
    currentPhase?: "streaming" | "fact-extraction" | "storage" | "finalization";
}
/**
 * Event emitted when stream completes successfully
 */
interface StreamCompleteEvent {
    fullResponse: string;
    totalChunks: number;
    durationMs: number;
    factsExtracted: number;
}
/**
 * Hooks for stream lifecycle events
 */
interface StreamHooks {
    onChunk?: (event: ChunkEvent) => void | Promise<void>;
    onProgress?: (event: ProgressEvent) => void | Promise<void>;
    onError?: (error: StreamError) => void | Promise<void>;
    onComplete?: (event: StreamCompleteEvent) => void | Promise<void>;
}
/**
 * Comprehensive streaming performance metrics
 */
interface StreamMetrics {
    startTime: number;
    firstChunkLatency: number;
    streamDurationMs: number;
    totalChunks: number;
    totalBytes: number;
    averageChunkSize: number;
    chunksPerSecond: number;
    factsExtracted: number;
    partialUpdates: number;
    errorCount: number;
    retryCount: number;
    estimatedTokens: number;
    estimatedCost?: number;
}
/**
 * Update record for partial storage
 */
interface PartialUpdate {
    timestamp: number;
    memoryId: string;
    contentLength: number;
    chunkNumber: number;
}
/**
 * Progressive fact extraction result
 */
interface ProgressiveFact {
    factId: string;
    extractedAtChunk: number;
    confidence: number;
    fact: string;
    deduped?: boolean;
}
/**
 * Graph sync event during streaming
 */
interface GraphSyncEvent {
    timestamp: number;
    eventType: "node-created" | "node-updated" | "relationship-created" | "finalized";
    nodeId?: string;
    details?: string;
}
/**
 * Failure handling strategy
 */
type FailureStrategy = "store-partial" | "rollback" | "retry" | "best-effort";
/**
 * Error context for debugging
 */
interface ErrorContext {
    phase: "initialization" | "streaming" | "fact-extraction" | "storage" | "finalization";
    chunkNumber: number;
    bytesProcessed: number;
    partialMemoryId?: string;
    lastSuccessfulUpdate?: number;
}
/**
 * Stream error with recovery information
 */
interface StreamError {
    code: string;
    message: string;
    recoverable: boolean;
    partialDataSaved: boolean;
    resumeToken?: string;
    context: ErrorContext;
    originalError?: Error;
}
/**
 * Recovery options for stream errors
 */
interface RecoveryOptions {
    strategy: FailureStrategy;
    maxRetries?: number;
    retryDelay?: number;
    preservePartialData?: boolean;
    notifyOnRecovery?: boolean;
}
/**
 * Result of recovery attempt
 */
interface RecoveryResult {
    success: boolean;
    strategy: FailureStrategy;
    partialMemoryId?: string;
    resumeToken?: string;
    error?: Error;
}
/**
 * Context for resuming interrupted streams
 */
interface ResumeContext {
    resumeToken: string;
    lastProcessedChunk: number;
    accumulatedContent: string;
    partialMemoryId: string;
    factsExtracted: string[];
    timestamp: number;
    checksum: string;
}
/**
 * Partial memory result for recovery
 */
interface PartialMemoryResult {
    memoryId: string;
    content: string;
    isPartial: true;
    timestamp: number;
    resumeToken?: string;
}
/**
 * Strategy for breaking content into chunks
 */
type ChunkStrategy = "token" | "sentence" | "paragraph" | "fixed" | "semantic";
/**
 * Configuration for content chunking
 */
interface ChunkingConfig {
    strategy: ChunkStrategy;
    maxChunkSize: number;
    overlapSize?: number;
    preserveBoundaries?: boolean;
}
/**
 * Metadata for a content chunk
 */
interface ChunkMetadata {
    parentMemoryId?: string;
    chunkIndex: number;
    totalChunks?: number;
    startOffset: number;
    endOffset: number;
    hasOverlap: boolean;
}
/**
 * A single content chunk
 */
interface ContentChunk {
    content: string;
    chunkIndex: number;
    startOffset: number;
    endOffset: number;
    metadata: ChunkMetadata;
}
/**
 * Stream type classification
 */
type StreamType = "fast" | "slow" | "bursty" | "steady";
/**
 * Processing strategy for adaptive behavior
 */
interface ProcessingStrategy {
    bufferSize: number;
    factExtractionFrequency: number;
    partialUpdateInterval: number;
    enablePredictiveLoading: boolean;
}
/**
 * Options for memory-efficient streaming
 */
interface MemoryEfficiencyOptions {
    maxBufferSize: number;
    useStreaming: boolean;
    incrementalEmbeddings: boolean;
    lazyFactStorage: boolean;
    compressPartialStorage: boolean;
}
/**
 * Embedding merge strategy for chunked content
 */
type EmbeddingMergeStrategy = "concatenate" | "average" | "hierarchical";
/**
 * Comprehensive streaming options extending RememberOptions
 */
interface StreamingOptions {
    syncToGraph?: boolean;
    progressiveGraphSync?: boolean;
    graphSyncInterval?: number;
    beliefRevision?: boolean;
    storePartialResponse?: boolean;
    partialResponseInterval?: number;
    progressiveFactExtraction?: boolean;
    factExtractionThreshold?: number;
    chunkSize?: number;
    chunkingStrategy?: ChunkStrategy;
    maxSingleMemorySize?: number;
    hooks?: StreamHooks;
    partialFailureHandling?: FailureStrategy;
    maxRetries?: number;
    retryDelay?: number;
    generateResumeToken?: boolean;
    streamTimeout?: number;
    maxBufferSize?: number;
    incrementalEmbeddings?: boolean;
    embeddingMergeStrategy?: EmbeddingMergeStrategy;
    enableAdaptiveProcessing?: boolean;
    maxResponseLength?: number;
}
/**
 * Internal streaming context for processing
 */
interface StreamContext {
    memorySpaceId: string;
    conversationId: string;
    userId: string;
    userName: string;
    accumulatedText: string;
    chunkCount: number;
    estimatedTokens: number;
    elapsedMs: number;
    partialMemoryId?: string;
    extractedFactIds: string[];
    graphNodeId?: string;
    metrics: StreamMetrics;
}
/**
 * Performance insights and recommendations
 */
interface PerformanceInsights {
    bottlenecks: string[];
    recommendations: string[];
    costEstimate?: number;
}
/**
 * Progressive processing results
 */
interface ProgressiveProcessing {
    factsExtractedDuringStream: ProgressiveFact[];
    partialStorageHistory: PartialUpdate[];
    graphSyncEvents?: GraphSyncEvent[];
}
/**
 * Enhanced result from rememberStream with comprehensive metadata
 */
interface EnhancedRememberStreamResult extends RememberResult {
    fullResponse: string;
    streamMetrics: StreamMetrics;
    progressiveProcessing?: ProgressiveProcessing;
    errors?: StreamError[];
    recovered?: boolean;
    resumeToken?: string;
    performance?: PerformanceInsights;
}
/**
 * Enhanced parameters for rememberStream
 */
interface EnhancedRememberStreamParams {
    memorySpaceId: string;
    participantId?: string;
    conversationId: string;
    userMessage: string;
    responseStream: ReadableStream<string> | AsyncIterable<string>;
    userId: string;
    userName: string;
    extractContent?: (userMessage: string, agentResponse: string) => Promise<string | null>;
    generateEmbedding?: (content: string) => Promise<number[] | null>;
    extractFacts?: (userMessage: string, agentResponse: string) => Promise<Array<{
        fact: string;
        factType: "preference" | "identity" | "knowledge" | "relationship" | "event" | "observation" | "custom";
        subject?: string;
        predicate?: string;
        object?: string;
        confidence: number;
        tags?: string[];
    }> | null>;
    autoEmbed?: boolean;
    autoSummarize?: boolean;
    importance?: number;
    tags?: string[];
    resumeFrom?: ResumeContext;
    streamTimeout?: number;
    maxResponseLength?: number;
    chunkProcessor?: (chunk: string, context: StreamContext) => Promise<ProcessedChunk>;
    embedChunks?: boolean;
    mergeStrategy?: EmbeddingMergeStrategy;
    partialFailureHandling?: FailureStrategy;
    resumeToken?: string;
}
/**
 * Processed chunk result
 */
interface ProcessedChunk {
    content: string;
    shouldStore: boolean;
    extractedFacts?: Array<{
        fact: string;
        factType: string;
        confidence: number;
        tags?: string[];
    }>;
    metadata?: Record<string, unknown>;
}

/**
 * Available deduplication strategies
 *
 * - 'none': Skip deduplication (fastest, no accuracy)
 * - 'exact': Normalized text match (fast, low accuracy)
 * - 'structural': Subject + predicate + object match (fast, medium accuracy)
 * - 'semantic': Embedding similarity search (slower, highest accuracy)
 */
type DeduplicationStrategy = "none" | "exact" | "structural" | "semantic";
/**
 * Configuration for fact deduplication
 */
interface DeduplicationConfig {
    /** Deduplication strategy to use */
    strategy: DeduplicationStrategy;
    /**
     * Similarity threshold for semantic matching (0-1)
     * Only used when strategy is 'semantic'
     * @default 0.85
     */
    similarityThreshold?: number;
    /**
     * Function to generate embeddings for semantic matching
     * Required when strategy is 'semantic', otherwise ignored
     */
    generateEmbedding?: (text: string) => Promise<number[]>;
}
/**
 * Candidate fact for deduplication check
 */
interface FactCandidate {
    fact: string;
    factType: string;
    subject?: string;
    predicate?: string;
    object?: string;
    confidence: number;
    tags?: string[];
}
/**
 * Result of duplicate detection
 */
interface DuplicateResult {
    /** Whether a duplicate was found */
    isDuplicate: boolean;
    /** The existing fact if a duplicate was found */
    existingFact?: FactRecord;
    /** Similarity score (0-1) for semantic matches, 1.0 for exact/structural */
    similarityScore?: number;
    /** Which strategy detected the duplicate */
    matchedBy?: DeduplicationStrategy;
    /** Whether the new fact has higher confidence than existing */
    shouldUpdate?: boolean;
}
/**
 * Result of store with deduplication
 */
interface StoreWithDedupResult {
    /** The fact record (new or existing) */
    fact: FactRecord;
    /** Whether an existing fact was updated instead of creating new */
    wasUpdated: boolean;
    /** Deduplication details */
    deduplication?: {
        strategy: DeduplicationStrategy;
        matchedExisting: boolean;
        similarityScore?: number;
    };
}

/**
 * Cortex SDK - TypeScript Types
 */
type ConversationType = "user-agent" | "agent-agent";
/**
 * Conversation visibility for shareable chats
 * - 'private': Only owner can access (default)
 * - 'space': Anyone in the memory space can access
 * - 'public': Anyone with the conversationId can access
 */
type ConversationVisibility = "private" | "space" | "public";
/** Message approval status for collaborative conversations */
type MessageApprovalStatus = "pending" | "approved" | "rejected";
interface Message {
    id: string;
    role: "user" | "agent" | "system";
    content: string;
    timestamp: number;
    participantId?: string;
    metadata?: Record<string, unknown>;
    /** Approval status for collaborative conversations (Phase 4) */
    approvalStatus?: MessageApprovalStatus;
    /** UserId who approved/rejected the message */
    approvedBy?: string;
    /** Timestamp of approval/rejection */
    approvedAt?: number;
}
/** Settings for collaborative conversations (Phase 4) */
interface CollaborativeSettings {
    /** Whether messages from non-owners require approval */
    requireApproval: boolean;
    /** The owner who can approve messages */
    ownerUserId?: string;
    /** IDs of approved participants who don't need approval */
    approvedParticipants?: string[];
}
interface Conversation {
    _id: string;
    conversationId: string;
    memorySpaceId: string;
    tenantId?: string;
    participantId?: string;
    type: ConversationType;
    participants: {
        userId?: string;
        agentId?: string;
        userIds?: string[];
        participantId?: string;
        memorySpaceIds?: string[];
    };
    messages: Message[];
    messageCount: number;
    metadata?: Record<string, unknown>;
    createdAt: number;
    updatedAt: number;
    /** Visibility for shareable chats. Defaults to 'private' if undefined. */
    visibility?: ConversationVisibility;
    /** Settings for collaborative conversations (Phase 4) */
    collaborativeSettings?: CollaborativeSettings;
}
interface CreateConversationInput {
    conversationId?: string;
    memorySpaceId: string;
    tenantId?: string;
    participantId?: string;
    type: ConversationType;
    participants: {
        userId?: string;
        agentId?: string;
        userIds?: string[];
        participantId?: string;
        memorySpaceIds?: string[];
    };
    metadata?: Record<string, unknown>;
    /** Visibility for shareable chats. Defaults to 'private'. */
    visibility?: ConversationVisibility;
    /** Settings for collaborative conversations (Phase 4) */
    collaborativeSettings?: CollaborativeSettings;
}
/** Input for approving/rejecting a message (Phase 4) */
interface ApproveMessageInput {
    conversationId: string;
    messageId: string;
}
/**
 * Input for checking access to a conversation
 */
interface CheckAccessInput {
    conversationId: string;
    userId?: string;
    memorySpaceId?: string;
}
/**
 * Result of an access check
 */
interface CheckAccessResult {
    canView: boolean;
    canEdit: boolean;
    reason: string;
    visibility: ConversationVisibility | null;
}
/**
 * Input for setting conversation visibility
 */
interface SetVisibilityInput {
    conversationId: string;
    visibility: ConversationVisibility;
}
/** Type of share grant */
type ShareGrantType = "user" | "space" | "link" | "domain";
/** Share status */
type ShareStatus = "active" | "revoked" | "expired";
/** Granular permissions for a share */
interface SharePermissions {
    canView: boolean;
    canViewFacts: boolean;
    canViewMemories: boolean;
    canContinue: boolean;
    canFork: boolean;
    canExport: boolean;
}
/** A conversation share record */
interface ConversationShare {
    _id: string;
    shareId: string;
    conversationId: string;
    grantedBy: string;
    sourceMemorySpaceId: string;
    grantType: ShareGrantType;
    grantedTo?: string;
    permissions: SharePermissions;
    expiresAt?: number;
    maxViews?: number;
    viewCount: number;
    redactBefore?: number;
    redactSensitive: boolean;
    status: ShareStatus;
    tenantId?: string;
    createdAt: number;
    revokedAt?: number;
    /** Runtime validation - not stored */
    isValid?: boolean;
    invalidReason?: string;
}
/** Input for creating a share */
interface CreateShareInput {
    conversationId: string;
    grantType: ShareGrantType;
    grantedTo?: string;
    permissions?: Partial<SharePermissions>;
    expiresAt?: number;
    maxViews?: number;
    redactBefore?: number;
    redactSensitive?: boolean;
}
/** Result of creating a share */
interface CreateShareResult {
    shareId: string;
    expiresAt?: number;
    share: ConversationShare;
}
/** Filter for listing shares */
interface ListSharesFilter {
    conversationId?: string;
    status?: ShareStatus;
    grantType?: ShareGrantType;
}
/** Result of revoking a share */
interface RevokeShareResult {
    revoked: boolean;
    revokedAt: number;
    share: ConversationShare;
}
/** Result of checking share-based access */
interface CheckShareAccessResult {
    hasAccess: boolean;
    permissions: SharePermissions | null;
    share: {
        shareId: string;
        grantType: ShareGrantType;
        expiresAt?: number;
        viewCount: number;
        maxViews?: number;
        redactBefore?: number;
        redactSensitive: boolean;
    } | null;
    reason: string;
}
/** Snapshot status */
type SnapshotStatus = "active" | "archived" | "deleted";
/** Custom redaction rule */
interface CustomRedaction {
    pattern: string;
    replacement: string;
}
/** Snapshot redaction metadata */
interface SnapshotRedaction {
    piiRedacted: boolean;
    messagesRedactedBefore?: number;
    customRedactions?: CustomRedaction[];
}
/** Snapshot included content flags */
interface SnapshotIncludedContent {
    messages: boolean;
    facts: boolean;
    memories: boolean;
}
/** Snapshot fact */
interface SnapshotFact {
    factId: string;
    fact: string;
    factType: string;
    confidence: number;
}
/** A conversation snapshot record */
interface ConversationSnapshot {
    _id: string;
    snapshotId: string;
    conversationId: string;
    messages: Message[];
    conversationType: ConversationType;
    participants: {
        userId?: string;
        agentId?: string;
        participantId?: string;
        memorySpaceIds?: string[];
    };
    messageCount: number;
    includedContent: SnapshotIncludedContent;
    redaction: SnapshotRedaction;
    facts?: SnapshotFact[];
    createdBy: string;
    memorySpaceId: string;
    tenantId?: string;
    status: SnapshotStatus;
    createdAt: number;
    snapshotOf: number;
}
/** Input for creating a snapshot */
interface CreateSnapshotInput {
    conversationId: string;
    redactPII?: boolean;
    redactBefore?: number;
    customRedactions?: CustomRedaction[];
    includeFacts?: boolean;
    includeMemories?: boolean;
}
/** Result of creating a snapshot */
interface CreateSnapshotResult {
    snapshotId: string;
    snapshot: ConversationSnapshot;
}
/** Filter for listing snapshots */
interface ListSnapshotsFilter {
    conversationId?: string;
    includeArchived?: boolean;
}
interface AddMessageInput {
    conversationId: string;
    message: {
        id?: string;
        role: "user" | "agent" | "system";
        content: string;
        participantId?: string;
        metadata?: Record<string, unknown>;
    };
}
interface ListConversationsFilter {
    type?: ConversationType;
    userId?: string;
    tenantId?: string;
    memorySpaceId?: string;
    participantId?: string;
    createdBefore?: number;
    createdAfter?: number;
    updatedBefore?: number;
    updatedAfter?: number;
    lastMessageBefore?: number;
    lastMessageAfter?: number;
    messageCount?: number | {
        min?: number;
        max?: number;
    };
    metadata?: Record<string, unknown>;
    limit?: number;
    offset?: number;
    sortBy?: "createdAt" | "updatedAt" | "lastMessageAt" | "messageCount";
    sortOrder?: "asc" | "desc";
    includeMessages?: boolean;
}
interface ListConversationsResult {
    conversations: Conversation[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
}
interface CountConversationsFilter {
    type?: ConversationType;
    userId?: string;
    tenantId?: string;
    memorySpaceId?: string;
}
interface GetHistoryOptions {
    limit?: number;
    offset?: number;
    sortOrder?: "asc" | "desc";
    since?: number;
    until?: number;
    roles?: ("user" | "agent" | "system")[];
}
interface GetConversationOptions {
    includeMessages?: boolean;
    messageLimit?: number;
}
interface SearchConversationsInput {
    query: string;
    filters?: {
        type?: ConversationType;
        userId?: string;
        memorySpaceId?: string;
        dateRange?: {
            start?: number;
            end?: number;
        };
        limit?: number;
    };
    options?: SearchConversationsOptions;
}
interface SearchConversationsOptions {
    searchIn?: "content" | "metadata" | "both";
    matchMode?: "contains" | "exact" | "fuzzy";
}
interface ConversationSearchResult {
    conversation: Conversation;
    matchedMessages: Message[];
    highlights: string[];
    score: number;
}
interface ExportConversationsOptions {
    filters?: {
        userId?: string;
        participantId?: string;
        memorySpaceId?: string;
        conversationIds?: string[];
        type?: ConversationType;
        dateRange?: {
            start?: number;
            end?: number;
        };
    };
    format: "json" | "csv";
    includeMetadata?: boolean;
}
interface ExportResult {
    format: "json" | "csv";
    data: string;
    count: number;
    exportedAt: number;
}
interface ConversationDeletionResult {
    deleted: boolean;
    conversationId: string;
    messagesDeleted: number;
    deletedAt: number;
    restorable: boolean;
}
interface DeleteManyConversationsOptions {
    dryRun?: boolean;
    requireConfirmation?: boolean;
    confirmationThreshold?: number;
}
interface DeleteManyConversationsResult {
    deleted: number;
    conversationIds: string[];
    totalMessagesDeleted: number;
    wouldDelete?: number;
    dryRun?: boolean;
}
interface ImmutableEntry {
    type: string;
    id: string;
    data: Record<string, unknown>;
    userId?: string;
    metadata?: {
        publishedBy?: string;
        tags?: string[];
        importance?: number;
        [key: string]: unknown;
    };
}
interface ImmutableRecord {
    _id: string;
    type: string;
    id: string;
    data: Record<string, unknown>;
    tenantId?: string;
    userId?: string;
    version: number;
    previousVersions: ImmutableVersion[];
    metadata?: {
        publishedBy?: string;
        tags?: string[];
        importance?: number;
        [key: string]: unknown;
    };
    createdAt: number;
    updatedAt: number;
}
interface ImmutableVersion {
    version: number;
    data: Record<string, unknown>;
    timestamp: number;
    metadata?: Record<string, unknown>;
}
interface ImmutableVersionExpanded {
    type: string;
    id: string;
    version: number;
    data: Record<string, unknown>;
    userId?: string;
    metadata?: Record<string, unknown>;
    timestamp: number;
    createdAt: number;
}
interface ListImmutableFilter {
    type?: string;
    userId?: string;
    tenantId?: string;
    limit?: number;
}
interface SearchImmutableInput {
    query: string;
    type?: string;
    userId?: string;
    limit?: number;
}
interface ImmutableSearchResult {
    entry: ImmutableRecord;
    score: number;
    highlights: string[];
}
interface CountImmutableFilter {
    type?: string;
    userId?: string;
    tenantId?: string;
}
interface MutableRecord {
    _id: string;
    namespace: string;
    key: string;
    value: unknown;
    tenantId?: string;
    userId?: string;
    metadata?: Record<string, unknown>;
    createdAt: number;
    updatedAt: number;
}
interface SetMutableInput {
    namespace: string;
    key: string;
    value: unknown;
    tenantId?: string;
    userId?: string;
    metadata?: Record<string, unknown>;
}
interface UpdateMutableInput {
    namespace: string;
    key: string;
    updater: (current: unknown) => unknown;
}
interface ListMutableFilter {
    namespace: string;
    keyPrefix?: string;
    tenantId?: string;
    userId?: string;
    limit?: number;
    offset?: number;
    updatedAfter?: number;
    updatedBefore?: number;
    sortBy?: "key" | "updatedAt" | "accessCount";
    sortOrder?: "asc" | "desc";
}
interface CountMutableFilter {
    namespace: string;
    tenantId?: string;
    userId?: string;
    keyPrefix?: string;
    updatedAfter?: number;
    updatedBefore?: number;
}
interface PurgeNamespaceOptions {
    dryRun?: boolean;
    /** Tenant ID for multi-tenancy isolation (auto-injected from AuthContext) */
    tenantId?: string;
}
/**
 * Filter options for purgeMany operation
 */
interface PurgeManyFilter {
    /** Required namespace to purge from */
    namespace: string;
    /** Filter by key prefix */
    keyPrefix?: string;
    /** Filter by user ID */
    userId?: string;
    /** Delete keys updated before this timestamp (ms since epoch) */
    updatedBefore?: number;
    /** Tenant ID for multi-tenancy isolation (auto-injected from AuthContext) */
    tenantId?: string;
}
type SourceType = "conversation" | "system" | "tool" | "a2a" | "fact-extraction";
type ContentType = "raw" | "summarized" | "fact";
interface ConversationRef {
    conversationId: string;
    messageIds: string[];
}
interface ImmutableRef {
    type: string;
    id: string;
    version?: number;
}
interface MutableRef {
    namespace: string;
    key: string;
    snapshotValue: unknown;
    snapshotAt: number;
}
interface FactsRef {
    factId: string;
    version?: number;
}
interface MemoryMetadata {
    importance: number;
    tags: string[];
    [key: string]: unknown;
}
interface MemoryVersion {
    version: number;
    content: string;
    embedding?: number[];
    timestamp: number;
}
interface MemoryEntry {
    _id: string;
    memoryId: string;
    memorySpaceId: string;
    tenantId?: string;
    participantId?: string;
    userId?: string;
    agentId?: string;
    content: string;
    contentType: ContentType;
    embedding?: number[];
    sourceType: SourceType;
    sourceUserId?: string;
    sourceUserName?: string;
    sourceTimestamp: number;
    messageRole?: "user" | "agent" | "system";
    conversationRef?: ConversationRef;
    immutableRef?: ImmutableRef;
    mutableRef?: MutableRef;
    factsRef?: FactsRef;
    importance: number;
    tags: string[];
    enrichedContent?: string;
    factCategory?: string;
    version: number;
    previousVersions: MemoryVersion[];
    createdAt: number;
    updatedAt: number;
    lastAccessed?: number;
    accessCount: number;
}
interface StoreMemoryInput {
    content: string;
    contentType: ContentType;
    tenantId?: string;
    participantId?: string;
    embedding?: number[];
    userId?: string;
    agentId?: string;
    messageRole?: "user" | "agent" | "system";
    enrichedContent?: string;
    factCategory?: string;
    source: {
        type: SourceType;
        userId?: string;
        userName?: string;
        timestamp?: number;
    };
    conversationRef?: ConversationRef;
    immutableRef?: ImmutableRef;
    mutableRef?: MutableRef;
    factsRef?: FactsRef;
    metadata: MemoryMetadata;
    extractFacts?: (content: string) => Promise<Array<{
        fact: string;
        factType: "preference" | "identity" | "knowledge" | "relationship" | "event" | "observation" | "custom";
        subject?: string;
        predicate?: string;
        object?: string;
        confidence: number;
        tags?: string[];
    }> | null>;
}
interface SearchMemoriesOptions {
    embedding?: number[];
    userId?: string;
    tags?: string[];
    sourceType?: SourceType;
    minImportance?: number;
    limit?: number;
    minScore?: number;
    /** Category to boost for bullet-proof retrieval (e.g., "addressing_preference") */
    queryCategory?: string;
}
interface ListMemoriesFilter {
    memorySpaceId: string;
    tenantId?: string;
    userId?: string;
    participantId?: string;
    sourceType?: SourceType;
    limit?: number;
    enrichFacts?: boolean;
}
interface CountMemoriesFilter {
    memorySpaceId: string;
    tenantId?: string;
    userId?: string;
    participantId?: string;
    sourceType?: SourceType;
}
/**
 * Layers that can be explicitly skipped during remember() orchestration.
 *
 * - 'users': Don't auto-create user profile
 * - 'agents': Don't auto-register agent
 * - 'conversations': Don't store messages in ACID conversation layer
 * - 'vector': Don't store in vector memory layer
 * - 'facts': Don't auto-extract facts (even if LLM configured)
 * - 'graph': Don't sync to graph database (even if configured)
 */
type SkippableLayer = "users" | "agents" | "conversations" | "vector" | "facts" | "graph";
interface RememberParams {
    /**
     * Memory space for isolation. If not provided, defaults to 'default'
     * with a warning. Auto-registers the memory space if it doesn't exist.
     */
    memorySpaceId?: string;
    /**
     * Multi-tenancy: SaaS platform isolation.
     * When provided, all data is scoped to this tenant.
     * Note: If using authContext, tenantId is auto-injected unless explicitly provided here.
     */
    tenantId?: string;
    /**
     * Conversation ID. Required.
     */
    conversationId: string;
    /**
     * The user's message content. Required.
     */
    userMessage: string;
    /**
     * The agent's response content. Required.
     */
    agentResponse: string;
    /**
     * User ID for user-owned memories. At least one of userId or agentId is required.
     * Auto-creates user profile if it doesn't exist (unless 'users' is in skipLayers).
     */
    userId?: string;
    /**
     * Agent ID for agent-owned memories. At least one of userId or agentId is required.
     * Auto-registers agent if it doesn't exist (unless 'agents' is in skipLayers).
     */
    agentId?: string;
    /**
     * Display name for the user (used in conversation tracking).
     * Required when userId is provided.
     */
    userName?: string;
    /**
     * Participant ID for Hive Mode tracking.
     * This tracks WHO stored the memory within a shared memory space,
     * distinct from userId/agentId which indicates ownership.
     */
    participantId?: string;
    /**
     * Layers to explicitly skip during orchestration.
     * By default, all configured layers are enabled.
     */
    skipLayers?: SkippableLayer[];
    extractContent?: (userMessage: string, agentResponse: string) => Promise<string | null>;
    generateEmbedding?: (content: string) => Promise<number[] | null>;
    extractFacts?: (userMessage: string, agentResponse: string) => Promise<Array<{
        fact: string;
        factType: "preference" | "identity" | "knowledge" | "relationship" | "event" | "observation" | "custom";
        subject?: string;
        predicate?: string;
        object?: string;
        confidence: number;
        tags?: string[];
    }> | null>;
    autoEmbed?: boolean;
    autoSummarize?: boolean;
    importance?: number;
    tags?: string[];
    /**
     * Fact deduplication strategy. Defaults to 'semantic' for maximum effectiveness.
     *
     * - 'semantic': Embedding-based similarity (most accurate, requires generateEmbedding)
     * - 'structural': Subject + predicate + object match (fast, good accuracy)
     * - 'exact': Normalized text match (fastest, lowest accuracy)
     * - false: Disable deduplication (previous behavior)
     *
     * The generateEmbedding function (if provided) is automatically reused for semantic matching.
     *
     * @default 'semantic' (with fallback to 'structural' if no generateEmbedding)
     */
    factDeduplication?: "semantic" | "structural" | "exact" | false;
    /**
     * Observer for real-time orchestration monitoring.
     *
     * Provides callbacks for tracking layer-by-layer progress during
     * the remember() orchestration flow. Integration-agnostic.
     *
     * @example
     * ```typescript
     * await cortex.memory.remember({
     *   memorySpaceId: 'user-123-space',
     *   conversationId: 'conv-123',
     *   userMessage: 'My name is Alex',
     *   agentResponse: "Nice to meet you, Alex!",
     *   userId: 'user-123',
     *   userName: 'Alex',
     *   agentId: 'assistant',
     *   observer: {
     *     onLayerUpdate: (event) => {
     *       console.log(`${event.layer}: ${event.status}`);
     *     },
     *   },
     * });
     * ```
     */
    observer?: OrchestrationObserver;
}
interface RememberResult {
    conversation: {
        messageIds: string[];
        conversationId: string;
    };
    memories: MemoryEntry[];
    facts: FactRecord[];
    /**
     * Belief revision actions taken for each extracted fact (v0.24.0+)
     *
     * Only populated when belief revision is enabled (default when LLM configured).
     * Each entry describes what action was taken for a fact and why.
     *
     * @example
     * ```typescript
     * const result = await cortex.memory.remember({...});
     * for (const revision of result.factRevisions ?? []) {
     *   console.log(`${revision.action}: ${revision.fact.fact}`);
     *   if (revision.superseded?.length) {
     *     console.log(`  Superseded: ${revision.superseded.map(f => f.fact).join(', ')}`);
     *   }
     * }
     * ```
     */
    factRevisions?: Array<{
        /** Action taken: ADD (new), UPDATE (merged), SUPERSEDE (replaced), NONE (skipped) */
        action: "ADD" | "UPDATE" | "SUPERSEDE" | "NONE";
        /** The resulting fact (or existing fact for NONE) */
        fact: FactRecord;
        /** Facts that were superseded by this action */
        superseded?: FactRecord[];
        /** Reason for the action from LLM or heuristics */
        reason?: string;
    }>;
}
/**
 * Parameters for rememberStream()
 *
 * Similar to RememberParams but accepts streaming response instead of complete string
 */
interface RememberStreamParams {
    /**
     * Memory space for isolation. If not provided, defaults to 'default'
     * with a warning. Auto-registers the memory space if it doesn't exist.
     */
    memorySpaceId?: string;
    /**
     * Conversation ID. Required.
     */
    conversationId: string;
    /**
     * The user's message content. Required.
     */
    userMessage: string;
    /**
     * The streaming response from the agent.
     */
    responseStream: ReadableStream<string> | AsyncIterable<string>;
    /**
     * User ID for user-owned memories. At least one of userId or agentId is required.
     * Auto-creates user profile if it doesn't exist (unless 'users' is in skipLayers).
     */
    userId?: string;
    /**
     * Agent ID for agent-owned memories. At least one of userId or agentId is required.
     * Auto-registers agent if it doesn't exist (unless 'agents' is in skipLayers).
     */
    agentId?: string;
    /**
     * Display name for the user (used in conversation tracking).
     * Required when userId is provided.
     */
    userName?: string;
    /**
     * Participant ID for Hive Mode tracking.
     * This tracks WHO stored the memory within a shared memory space,
     * distinct from userId/agentId which indicates ownership.
     */
    participantId?: string;
    /**
     * Layers to explicitly skip during orchestration.
     * By default, all configured layers are enabled.
     */
    skipLayers?: SkippableLayer[];
    extractContent?: (userMessage: string, agentResponse: string) => Promise<string | null>;
    generateEmbedding?: (content: string) => Promise<number[] | null>;
    extractFacts?: (userMessage: string, agentResponse: string) => Promise<Array<{
        fact: string;
        factType: "preference" | "identity" | "knowledge" | "relationship" | "event" | "observation" | "custom";
        subject?: string;
        predicate?: string;
        object?: string;
        confidence: number;
        tags?: string[];
    }> | null>;
    autoEmbed?: boolean;
    autoSummarize?: boolean;
    importance?: number;
    tags?: string[];
    /**
     * Fact deduplication strategy. Defaults to 'semantic' for maximum effectiveness.
     *
     * - 'semantic': Embedding-based similarity (most accurate, requires generateEmbedding)
     * - 'structural': Subject + predicate + object match (fast, good accuracy)
     * - 'exact': Normalized text match (fastest, lowest accuracy)
     * - false: Disable deduplication (previous behavior)
     *
     * The generateEmbedding function (if provided) is automatically reused for semantic matching.
     *
     * @default 'semantic' (with fallback to 'structural' if no generateEmbedding)
     */
    factDeduplication?: "semantic" | "structural" | "exact" | false;
    /**
     * Observer for real-time orchestration monitoring.
     *
     * Provides callbacks for tracking layer-by-layer progress during
     * the rememberStream() orchestration flow. Integration-agnostic.
     */
    observer?: OrchestrationObserver;
}
/**
 * Result from rememberStream()
 *
 * Includes the standard RememberResult plus the complete response text
 */
interface RememberStreamResult extends RememberResult {
    fullResponse: string;
}
interface ForgetOptions {
    deleteConversation?: boolean;
    deleteEntireConversation?: boolean;
}
interface ForgetResult {
    memoryDeleted: boolean;
    conversationDeleted: boolean;
    messagesDeleted: number;
    factsDeleted: number;
    factIds: string[];
    restorable: boolean;
}
interface GetMemoryOptions {
    includeConversation?: boolean;
}
interface EnrichedMemory {
    memory: MemoryEntry;
    conversation?: Conversation;
    sourceMessages?: Message[];
    facts?: FactRecord[];
}
interface SearchMemoryOptions extends SearchMemoriesOptions {
    enrichConversation?: boolean;
}
type EnrichedSearchResult = EnrichedMemory & {
    score?: number;
};
interface DeleteMemoryResult {
    deleted: boolean;
    memoryId: string;
    factsDeleted: number;
    factIds: string[];
}
interface DeleteManyResult {
    deleted: number;
    memoryIds: string[];
    factsDeleted: number;
    factIds: string[];
}
interface ArchiveResult {
    archived: boolean;
    memoryId: string;
    restorable: boolean;
    factsArchived: number;
    factIds: string[];
}
interface UpdateManyResult {
    updated: number;
    memoryIds: string[];
    factsAffected: number;
}
interface StoreMemoryResult {
    memory: MemoryEntry;
    facts: FactRecord[];
}
interface UpdateMemoryResult {
    memory: MemoryEntry;
    factsReextracted?: FactRecord[];
}
interface ExportMemoriesOptions {
    memorySpaceId: string;
    userId?: string;
    format: "json" | "csv";
    includeEmbeddings?: boolean;
    includeFacts?: boolean;
}
interface EnrichedEntity {
    name: string;
    type: string;
    fullValue?: string;
}
interface EnrichedRelation {
    subject: string;
    predicate: string;
    object: string;
}
interface FactRecord {
    _id: string;
    factId: string;
    memorySpaceId: string;
    tenantId?: string;
    participantId?: string;
    userId?: string;
    fact: string;
    factType: "preference" | "identity" | "knowledge" | "relationship" | "event" | "observation" | "custom";
    subject?: string;
    predicate?: string;
    object?: string;
    confidence: number;
    sourceType: "conversation" | "system" | "tool" | "manual" | "a2a";
    sourceRef?: {
        conversationId?: string;
        messageIds?: string[];
        memoryId?: string;
    };
    metadata?: Record<string, unknown>;
    tags: string[];
    category?: string;
    searchAliases?: string[];
    semanticContext?: string;
    entities?: EnrichedEntity[];
    relations?: EnrichedRelation[];
    validFrom?: number;
    validUntil?: number;
    version: number;
    supersededBy?: string;
    supersedes?: string;
    createdAt: number;
    updatedAt: number;
    embedding?: number[];
}
interface StoreFactParams {
    memorySpaceId: string;
    tenantId?: string;
    participantId?: string;
    userId?: string;
    fact: string;
    factType: "preference" | "identity" | "knowledge" | "relationship" | "event" | "observation" | "custom";
    subject?: string;
    predicate?: string;
    object?: string;
    confidence: number;
    sourceType: "conversation" | "system" | "tool" | "manual" | "a2a";
    sourceRef?: {
        conversationId?: string;
        messageIds?: string[];
        memoryId?: string;
    };
    metadata?: Record<string, unknown>;
    tags?: string[];
    category?: string;
    searchAliases?: string[];
    semanticContext?: string;
    entities?: EnrichedEntity[];
    relations?: EnrichedRelation[];
    validFrom?: number;
    validUntil?: number;
    embedding?: number[];
}
interface ListFactsFilter {
    memorySpaceId: string;
    tenantId?: string;
    factType?: "preference" | "identity" | "knowledge" | "relationship" | "event" | "observation" | "custom";
    subject?: string;
    predicate?: string;
    object?: string;
    minConfidence?: number;
    confidence?: number;
    userId?: string;
    participantId?: string;
    tags?: string[];
    tagMatch?: "any" | "all";
    sourceType?: "conversation" | "system" | "tool" | "manual";
    createdBefore?: Date;
    createdAfter?: Date;
    updatedBefore?: Date;
    updatedAfter?: Date;
    version?: number;
    includeSuperseded?: boolean;
    validAt?: Date;
    metadata?: Record<string, unknown>;
    limit?: number;
    offset?: number;
    sortBy?: "createdAt" | "updatedAt" | "confidence" | "version";
    sortOrder?: "asc" | "desc";
}
interface CountFactsFilter {
    memorySpaceId: string;
    tenantId?: string;
    factType?: "preference" | "identity" | "knowledge" | "relationship" | "event" | "observation" | "custom";
    subject?: string;
    predicate?: string;
    object?: string;
    minConfidence?: number;
    confidence?: number;
    userId?: string;
    participantId?: string;
    tags?: string[];
    tagMatch?: "any" | "all";
    sourceType?: "conversation" | "system" | "tool" | "manual";
    createdBefore?: Date;
    createdAfter?: Date;
    updatedBefore?: Date;
    updatedAfter?: Date;
    version?: number;
    includeSuperseded?: boolean;
    validAt?: Date;
    metadata?: Record<string, unknown>;
}
interface SearchFactsOptions {
    factType?: "preference" | "identity" | "knowledge" | "relationship" | "event" | "observation" | "custom";
    subject?: string;
    predicate?: string;
    object?: string;
    minConfidence?: number;
    confidence?: number;
    userId?: string;
    participantId?: string;
    tags?: string[];
    tagMatch?: "any" | "all";
    sourceType?: "conversation" | "system" | "tool" | "manual";
    createdBefore?: Date;
    createdAfter?: Date;
    updatedBefore?: Date;
    updatedAfter?: Date;
    version?: number;
    includeSuperseded?: boolean;
    validAt?: Date;
    metadata?: Record<string, unknown>;
    limit?: number;
    offset?: number;
    sortBy?: "confidence" | "createdAt" | "updatedAt";
    sortOrder?: "asc" | "desc";
}
interface QueryBySubjectFilter {
    memorySpaceId: string;
    subject: string;
    factType?: "preference" | "identity" | "knowledge" | "relationship" | "event" | "observation" | "custom";
    predicate?: string;
    object?: string;
    minConfidence?: number;
    confidence?: number;
    userId?: string;
    participantId?: string;
    tags?: string[];
    tagMatch?: "any" | "all";
    sourceType?: "conversation" | "system" | "tool" | "manual";
    createdBefore?: Date;
    createdAfter?: Date;
    updatedBefore?: Date;
    updatedAfter?: Date;
    version?: number;
    includeSuperseded?: boolean;
    validAt?: Date;
    metadata?: Record<string, unknown>;
    limit?: number;
    offset?: number;
    sortBy?: "createdAt" | "updatedAt" | "confidence";
    sortOrder?: "asc" | "desc";
}
interface QueryByRelationshipFilter {
    memorySpaceId: string;
    subject: string;
    predicate: string;
    object?: string;
    factType?: "preference" | "identity" | "knowledge" | "relationship" | "event" | "observation" | "custom";
    minConfidence?: number;
    confidence?: number;
    userId?: string;
    participantId?: string;
    tags?: string[];
    tagMatch?: "any" | "all";
    sourceType?: "conversation" | "system" | "tool" | "manual";
    createdBefore?: Date;
    createdAfter?: Date;
    updatedBefore?: Date;
    updatedAfter?: Date;
    version?: number;
    includeSuperseded?: boolean;
    validAt?: Date;
    metadata?: Record<string, unknown>;
    limit?: number;
    offset?: number;
    sortBy?: "createdAt" | "updatedAt" | "confidence";
    sortOrder?: "asc" | "desc";
}
interface UpdateFactInput {
    fact?: string;
    confidence?: number;
    tags?: string[];
    validUntil?: number;
    metadata?: Record<string, unknown>;
    category?: string;
    searchAliases?: string[];
    semanticContext?: string;
    entities?: EnrichedEntity[];
    relations?: EnrichedRelation[];
    embedding?: number[];
}
/**
 * Options for semantic search on facts (v0.30.0+)
 *
 * Uses vector embeddings to find semantically related facts,
 * unlike text search which requires keyword matching.
 */
interface SemanticSearchFactsOptions {
    /** Multi-tenancy filter */
    tenantId?: string;
    /** Filter by user who created the fact */
    userId?: string;
    /** Minimum confidence threshold (0-100) */
    minConfidence?: number;
    /** Include superseded facts (default: false) */
    includeSuperseded?: boolean;
    /** Minimum similarity score (0-1, default: 0.3) */
    minScore?: number;
    /** Maximum results to return (default: 20) */
    limit?: number;
    /** Filter by tags (any match) */
    tags?: string[];
    /** Filter facts created after this date */
    createdAfter?: Date;
    /** Filter facts created before this date */
    createdBefore?: Date;
}
interface DeleteManyFactsParams {
    memorySpaceId: string;
    userId?: string;
    factType?: "preference" | "identity" | "knowledge" | "relationship" | "event" | "observation" | "custom";
}
interface DeleteManyFactsResult {
    deleted: number;
    memorySpaceId: string;
}
interface MemorySpace {
    _id: string;
    memorySpaceId: string;
    tenantId?: string;
    name?: string;
    type: "personal" | "team" | "project" | "custom";
    participants: Array<{
        id: string;
        type: string;
        joinedAt: number;
    }>;
    metadata: Record<string, unknown>;
    status: "active" | "archived";
    createdAt: number;
    updatedAt: number;
}
interface RegisterMemorySpaceParams {
    memorySpaceId: string;
    tenantId?: string;
    name?: string;
    type: "personal" | "team" | "project" | "custom";
    participants?: Array<{
        id: string;
        type: string;
    }>;
    metadata?: Record<string, unknown>;
}
interface MemorySpaceStats {
    memorySpaceId: string;
    totalMemories: number;
    totalConversations: number;
    totalFacts: number;
    totalMessages: number;
    storage: {
        conversationsBytes: number;
        memoriesBytes: number;
        factsBytes: number;
        totalBytes: number;
    };
    avgSearchTime?: string;
    topTags: string[];
    importanceBreakdown: {
        critical: number;
        high: number;
        medium: number;
        low: number;
        trivial: number;
    };
    participants?: Array<{
        participantId: string;
        memoriesStored: number;
        conversationsStored: number;
        factsExtracted: number;
        firstActive: number;
        lastActive: number;
        avgImportance: number;
        topTags: string[];
    }>;
    memoriesThisWindow?: number;
    conversationsThisWindow?: number;
}
interface ListMemorySpacesFilter {
    type?: "personal" | "team" | "project" | "custom";
    status?: "active" | "archived";
    tenantId?: string;
    participant?: string;
    limit?: number;
    offset?: number;
    sortBy?: "createdAt" | "updatedAt" | "name";
    sortOrder?: "asc" | "desc";
}
interface ListMemorySpacesResult {
    spaces: MemorySpace[];
    total: number;
    hasMore: boolean;
    offset: number;
}
interface DeleteMemorySpaceOptions {
    cascade: boolean;
    reason: string;
    confirmId?: string;
}
interface DeleteMemorySpaceResult {
    memorySpaceId: string;
    deleted: true;
    cascade: {
        conversationsDeleted: number;
        memoriesDeleted: number;
        factsDeleted: number;
        totalBytes: number;
    };
    reason: string;
    deletedAt: number;
}
interface GetMemorySpaceStatsOptions {
    tenantId?: string;
    timeWindow?: "24h" | "7d" | "30d" | "90d" | "all";
    includeParticipants?: boolean;
}
interface UpdateMemorySpaceOptions {
}
interface AgentRegistration {
    memorySpaceId?: string;
    id: string;
    tenantId?: string;
    name: string;
    description?: string;
    metadata?: Record<string, unknown>;
    config?: Record<string, unknown>;
}
interface RegisteredAgent {
    memorySpaceId?: string;
    id: string;
    tenantId?: string;
    name: string;
    description?: string;
    metadata: Record<string, unknown>;
    config: Record<string, unknown>;
    status: "active" | "inactive" | "archived";
    registeredAt: number;
    updatedAt: number;
    lastActive?: number;
    stats?: AgentStats;
}
interface AgentStats {
    totalMemories: number;
    totalConversations: number;
    totalFacts: number;
    memorySpacesActive: number;
    lastActive?: number;
}
/**
 * Filters for listing and searching agents.
 *
 * @remarks
 * **Pagination Limitation:** The `offset` and `limit` filters are applied at the database
 * level BEFORE the following client-side filters are applied:
 * - `metadata`
 * - `name`
 * - `capabilities`
 * - `lastActiveAfter`
 * - `lastActiveBefore`
 *
 * This means combining `offset` with any of the above filters may produce unexpected results.
 * For reliable pagination with these filters, either:
 * 1. Use `offset`/`limit` only with `status` (which is applied at the database level)
 * 2. Fetch all results without `offset` and paginate client-side
 */
interface AgentFilters {
    memorySpaceId?: string;
    /** Filter by tenant ID (database-level filter - safe to use with offset/limit) */
    tenantId?: string;
    /** Filter by metadata key-value pairs (client-side filter - see pagination limitation) */
    metadata?: Record<string, unknown>;
    /** Filter by agent name, case-insensitive partial match (client-side filter - see pagination limitation) */
    name?: string;
    /** Filter by capabilities (client-side filter - see pagination limitation) */
    capabilities?: string[];
    /** Match mode for capabilities: "any" (default) matches agents with at least one capability, "all" requires all capabilities */
    capabilitiesMatch?: "any" | "all";
    /** Filter by agent status (database-level filter - safe to use with offset/limit) */
    status?: "active" | "inactive" | "archived";
    registeredAfter?: number;
    registeredBefore?: number;
    /** Filter agents last active after this timestamp (client-side filter - see pagination limitation) */
    lastActiveAfter?: number;
    /** Filter agents last active before this timestamp (client-side filter - see pagination limitation) */
    lastActiveBefore?: number;
    /** Maximum number of results to return (applied at database level before client-side filters) */
    limit?: number;
    /**
     * Number of results to skip (applied at database level before client-side filters).
     * WARNING: Using offset with metadata, name, capabilities, or timestamp filters may
     * produce unexpected results. See AgentFilters documentation for details.
     */
    offset?: number;
    sortBy?: "name" | "registeredAt" | "lastActive";
    sortOrder?: "asc" | "desc";
}
interface ExportAgentsOptions {
    filters?: AgentFilters;
    format: "json" | "csv";
    includeMetadata?: boolean;
    includeStats?: boolean;
}
interface ExportAgentsResult {
    format: "json" | "csv";
    data: string;
    count: number;
    exportedAt: number;
}
interface UnregisterAgentOptions {
    /** Enable cascade deletion by participantId across all memory spaces (default: false) */
    cascade?: boolean;
    /** Run verification after deletion (default: true) */
    verify?: boolean;
    /** Preview what would be deleted without actually deleting (default: false) */
    dryRun?: boolean;
}
interface UnregisterAgentResult {
    agentId: string;
    unregisteredAt: number;
    conversationsDeleted: number;
    conversationMessagesDeleted: number;
    memoriesDeleted: number;
    factsDeleted: number;
    graphNodesDeleted?: number;
    verification: {
        complete: boolean;
        issues: string[];
    };
    totalDeleted: number;
    deletedLayers: string[];
    memorySpacesAffected: string[];
}
interface AgentDeletionPlan {
    conversations: Conversation[];
    memories: MemoryEntry[];
    facts: FactRecord[];
    graph: Array<{
        nodeId: string;
        labels: string[];
    }>;
    agentRegistration: RegisteredAgent | null;
    memorySpaces: string[];
}
interface AgentDeletionBackup {
    conversations: Conversation[];
    memories: MemoryEntry[];
    facts: FactRecord[];
    agentRegistration: RegisteredAgent | null;
}
/**
 * Parameters for sending an A2A message
 */
interface A2ASendParams {
    /** Sender agent ID */
    from: string;
    /** Receiver agent ID */
    to: string;
    /** Message content */
    message: string;
    /** Optional user ID (enables GDPR cascade) */
    userId?: string;
    /** Optional context/workflow ID */
    contextId?: string;
    /** Importance level 0-100 (default: 60) */
    importance?: number;
    /** Store in ACID conversation (default: true) */
    trackConversation?: boolean;
    /** Auto-generate embeddings (Cloud Mode only) */
    autoEmbed?: boolean;
    /** Optional metadata */
    metadata?: {
        tags?: string[];
        priority?: "low" | "normal" | "high" | "urgent";
        [key: string]: unknown;
    };
}
/**
 * Result from A2A send operation
 */
interface A2AMessage {
    /** Unique message ID */
    messageId: string;
    /** Timestamp when sent */
    sentAt: number;
    /** ACID conversation ID (if trackConversation=true) */
    conversationId?: string;
    /** Message ID in ACID conversation */
    acidMessageId?: string;
    /** Memory ID in sender's storage */
    senderMemoryId: string;
    /** Memory ID in receiver's storage */
    receiverMemoryId: string;
}
/**
 * Parameters for A2A request (synchronous request-response)
 */
interface A2ARequestParams {
    /** Sender agent ID */
    from: string;
    /** Receiver agent ID */
    to: string;
    /** Request message */
    message: string;
    /** Timeout in milliseconds (default: 30000) */
    timeout?: number;
    /** Number of retry attempts (default: 1) */
    retries?: number;
    /** Optional user ID (enables GDPR cascade) */
    userId?: string;
    /** Optional context/workflow ID */
    contextId?: string;
    /** Importance level 0-100 */
    importance?: number;
}
/**
 * Response from A2A request
 */
interface A2AResponse {
    /** Response message content */
    response: string;
    /** Original request message ID */
    messageId: string;
    /** Response message ID */
    responseMessageId: string;
    /** Timestamp when responded */
    respondedAt: number;
    /** Response time in milliseconds */
    responseTime: number;
}
/**
 * Parameters for A2A broadcast (one-to-many)
 */
interface A2ABroadcastParams {
    /** Sender agent ID */
    from: string;
    /** Array of recipient agent IDs */
    to: string[];
    /** Message content */
    message: string;
    /** Optional user ID (enables GDPR cascade) */
    userId?: string;
    /** Optional context/workflow ID */
    contextId?: string;
    /** Importance level 0-100 (default: 60) */
    importance?: number;
    /** Store in ACID conversation (default: true) */
    trackConversation?: boolean;
    /** Optional metadata */
    metadata?: {
        tags?: string[];
        [key: string]: unknown;
    };
}
/**
 * Result from A2A broadcast
 */
interface A2ABroadcastResult {
    /** Broadcast message ID */
    messageId: string;
    /** Timestamp when sent */
    sentAt: number;
    /** Array of recipient agent IDs */
    recipients: string[];
    /** Memory IDs in sender's storage (one per recipient) */
    senderMemoryIds: string[];
    /** Memory IDs in receivers' storage (one per recipient) */
    receiverMemoryIds: string[];
    /** Total memories created (sender + receiver for each) */
    memoriesCreated: number;
    /** Conversation IDs (if trackConversation=true) */
    conversationIds?: string[];
}
/**
 * Filters for getConversation
 */
interface A2AConversationFilters {
    /** Filter by start date */
    since?: Date;
    /** Filter by end date */
    until?: Date;
    /** Minimum importance filter (0-100) */
    minImportance?: number;
    /** Filter by tags */
    tags?: string[];
    /** Filter A2A about specific user */
    userId?: string;
    /** Maximum messages to return (default: 100) */
    limit?: number;
    /** Pagination offset */
    offset?: number;
    /** Output format */
    format?: "chronological";
}
/**
 * A2A conversation result
 */
interface A2AConversation {
    /** The two participants */
    participants: [string, string];
    /** ACID conversation ID (if exists) */
    conversationId?: string;
    /** Total message count (before pagination) */
    messageCount: number;
    /** Conversation messages */
    messages: A2AConversationMessage[];
    /** Time period covered */
    period: {
        start: number;
        end: number;
    };
    /** Tags found in messages */
    tags?: string[];
    /** True if ACID conversation exists for full history */
    canRetrieveFullHistory: boolean;
}
/**
 * Individual message in A2A conversation
 */
interface A2AConversationMessage {
    /** Sender agent ID */
    from: string;
    /** Receiver agent ID */
    to: string;
    /** Message content */
    message: string;
    /** Importance level */
    importance: number;
    /** Timestamp */
    timestamp: number;
    /** Message ID */
    messageId: string;
    /** Vector memory ID */
    memoryId: string;
    /** ACID message ID (if tracked) */
    acidMessageId?: string;
    /** Tags */
    tags?: string[];
}
/**
 * A2A timeout error
 */
declare class A2ATimeoutError extends Error {
    readonly messageId: string;
    readonly timeout: number;
    readonly name = "A2ATimeoutError";
    constructor(message: string, messageId: string, timeout: number);
}
interface UserProfile {
    id: string;
    tenantId?: string;
    data: Record<string, unknown>;
    version: number;
    createdAt: number;
    updatedAt: number;
}
interface UserVersion {
    version: number;
    data: Record<string, unknown>;
    timestamp: number;
}
interface DeleteUserOptions {
    /** Enable cascade deletion across all layers (default: false) */
    cascade?: boolean;
    /** Run verification after deletion (default: true) */
    verify?: boolean;
    /** Preview what would be deleted without actually deleting (default: false) */
    dryRun?: boolean;
}
interface UserDeleteResult {
    userId: string;
    deletedAt: number;
    conversationsDeleted: number;
    conversationMessagesDeleted: number;
    immutableRecordsDeleted: number;
    mutableKeysDeleted: number;
    vectorMemoriesDeleted: number;
    factsDeleted: number;
    graphNodesDeleted?: number;
    verification: {
        complete: boolean;
        issues: string[];
    };
    totalDeleted: number;
    deletedLayers: string[];
}
interface DeletionPlan {
    conversations: Conversation[];
    immutable: ImmutableRecord[];
    mutable: MutableRecord[];
    vector: MemoryEntry[];
    facts: FactRecord[];
    graph: Array<{
        nodeId: string;
        labels: string[];
    }>;
    userProfile: UserProfile | null;
}
interface DeletionBackup {
    conversations: Conversation[];
    immutable: ImmutableRecord[];
    mutable: MutableRecord[];
    vector: MemoryEntry[];
    facts: FactRecord[];
    userProfile: UserProfile | null;
}
interface VerificationResult {
    complete: boolean;
    issues: string[];
}
interface ListUsersFilter {
    /** Filter by tenant ID for multi-tenant isolation */
    tenantId?: string;
    /** Maximum results to return (default: 50, max: 1000) */
    limit?: number;
    /** Skip first N results for pagination (default: 0) */
    offset?: number;
    /** Filter by createdAt > timestamp */
    createdAfter?: number;
    /** Filter by createdAt < timestamp */
    createdBefore?: number;
    /** Filter by updatedAt > timestamp */
    updatedAfter?: number;
    /** Filter by updatedAt < timestamp */
    updatedBefore?: number;
    /** Sort by field (default: "createdAt") */
    sortBy?: "createdAt" | "updatedAt";
    /** Sort order (default: "desc") */
    sortOrder?: "asc" | "desc";
    /** Filter by displayName (client-side, contains match) */
    displayName?: string;
    /** Filter by email (client-side, contains match) */
    email?: string;
}
interface UserFilters extends ListUsersFilter {
}
interface ListUsersResult {
    /** Array of user profiles */
    users: UserProfile[];
    /** Total count before pagination */
    total: number;
    /** Limit used for this query */
    limit: number;
    /** Offset used for this query */
    offset: number;
    /** Whether there are more results beyond this page */
    hasMore: boolean;
}
interface ExportUsersOptions {
    filters?: UserFilters;
    format: "json" | "csv";
    /** Include previousVersions array in export */
    includeVersionHistory?: boolean;
    /** Query and include user's conversations */
    includeConversations?: boolean;
    /** Query and include user's memories across all memory spaces */
    includeMemories?: boolean;
}

type ComplianceMode = "GDPR" | "HIPAA" | "SOC2" | "FINRA" | "Custom";
type ComplianceTemplate = "GDPR" | "HIPAA" | "SOC2" | "FINRA";
/**
 * Session lifecycle policy configuration.
 *
 * Controls session timeout, auto-extension, and cleanup behavior.
 * Configurable per-tenant or per-organization via GovernancePolicy.
 */
interface SessionLifecyclePolicy {
    /**
     * Idle timeout before session becomes idle/expires.
     * Format: duration string ('30m', '1h', '24h')
     * @default '30m'
     */
    idleTimeout: string;
    /**
     * Maximum session duration regardless of activity.
     * Format: duration string ('12h', '24h', '7d')
     * @default '24h'
     */
    maxDuration: string;
    /**
     * Automatically extend session on activity.
     * @default true
     */
    autoExtend: boolean;
    /**
     * Warn user before session expires.
     * Format: duration string ('5m', '15m')
     */
    warnBeforeExpiry?: string;
}
/**
 * Session cleanup policy configuration.
 */
interface SessionCleanupPolicy {
    /**
     * Automatically expire idle sessions.
     * @default true
     */
    autoExpireIdle: boolean;
    /**
     * Delete ended sessions after this duration.
     * Format: duration string ('7d', '30d', '90d')
     */
    deleteEndedAfter?: string;
    /**
     * Archive sessions before deletion.
     * Format: duration string
     */
    archiveAfter?: string;
}
/**
 * Session limits policy configuration.
 */
interface SessionLimitsPolicy {
    /**
     * Maximum concurrent active sessions per user.
     */
    maxActiveSessions?: number;
    /**
     * Maximum sessions per device type.
     */
    maxSessionsPerDevice?: number;
}
/**
 * Complete session policy configuration for GovernancePolicy.
 */
interface SessionPolicy {
    lifecycle: SessionLifecyclePolicy;
    cleanup: SessionCleanupPolicy;
    limits?: SessionLimitsPolicy;
}
interface GovernancePolicy {
    organizationId?: string;
    memorySpaceId?: string;
    conversations: {
        retention: {
            deleteAfter: string;
            archiveAfter?: string;
            purgeOnUserRequest: boolean;
        };
        purging: {
            autoDelete: boolean;
            deleteInactiveAfter?: string;
        };
    };
    immutable: {
        retention: {
            defaultVersions: number;
            byType: Record<string, {
                versionsToKeep: number;
                deleteAfter?: string;
            }>;
        };
        purging: {
            autoCleanupVersions: boolean;
            purgeUnusedAfter?: string;
        };
    };
    mutable: {
        retention: {
            defaultTTL?: string;
            purgeInactiveAfter?: string;
        };
        purging: {
            autoDelete: boolean;
            deleteUnaccessedAfter?: string;
        };
    };
    vector: {
        retention: {
            defaultVersions: number;
            byImportance: Array<{
                range: [number, number];
                versions: number;
            }>;
            bySourceType?: Record<string, number>;
        };
        purging: {
            autoCleanupVersions: boolean;
            deleteOrphaned: boolean;
        };
    };
    sessions?: SessionPolicy;
    compliance: {
        mode: ComplianceMode;
        dataRetentionYears: number;
        requireJustification: number[];
        auditLogging: boolean;
    };
}
interface PolicyScope {
    organizationId?: string;
    memorySpaceId?: string;
}
interface PolicyResult {
    policyId: string;
    appliedAt: number;
    scope: PolicyScope;
    success: boolean;
}
interface EnforcementOptions {
    layers?: ("conversations" | "immutable" | "mutable" | "vector")[];
    rules?: ("retention" | "purging")[];
    scope?: PolicyScope;
}
interface EnforcementResult {
    enforcedAt: number;
    versionsDeleted: number;
    recordsPurged: number;
    storageFreed: number;
    affectedLayers: string[];
}
interface SimulationOptions extends Partial<GovernancePolicy> {
}
interface SimulationResult {
    versionsAffected: number;
    recordsAffected: number;
    storageFreed: number;
    costSavings: number;
    breakdown: {
        conversations?: {
            affected: number;
            storageMB: number;
        };
        immutable?: {
            affected: number;
            storageMB: number;
        };
        mutable?: {
            affected: number;
            storageMB: number;
        };
        vector?: {
            affected: number;
            storageMB: number;
        };
    };
}
interface ComplianceReportOptions {
    organizationId?: string;
    memorySpaceId?: string;
    period: {
        start: Date;
        end: Date;
    };
}
interface ComplianceReport {
    organizationId?: string;
    memorySpaceId?: string;
    period: {
        start: number;
        end: number;
    };
    generatedAt: number;
    conversations: {
        total: number;
        deleted: number;
        archived: number;
        complianceStatus: "COMPLIANT" | "NON_COMPLIANT" | "WARNING";
    };
    immutable: {
        entities: number;
        totalVersions: number;
        versionsDeleted: number;
        complianceStatus: "COMPLIANT" | "NON_COMPLIANT" | "WARNING";
    };
    vector: {
        memories: number;
        versionsDeleted: number;
        orphanedCleaned: number;
        complianceStatus: "COMPLIANT" | "NON_COMPLIANT" | "WARNING";
    };
    dataRetention: {
        oldestRecord: number;
        withinPolicy: boolean;
    };
    userRequests: {
        deletionRequests: number;
        fulfilled: number;
        avgFulfillmentTime: string;
    };
}
interface EnforcementStatsOptions {
    period: string;
    organizationId?: string;
    memorySpaceId?: string;
}
interface EnforcementStats {
    period: {
        start: number;
        end: number;
    };
    conversations: {
        purged: number;
        archived: number;
    };
    immutable: {
        versionsDeleted: number;
        entitiesPurged: number;
    };
    vector: {
        versionsDeleted: number;
        memoriesPurged: number;
    };
    mutable: {
        keysDeleted: number;
    };
    storageFreed: number;
    costSavings: number;
}
/**
 * Graph sync option placeholder for backward compatibility.
 *
 * As of v0.29.0, graph sync is automatic when CORTEX_GRAPH_SYNC=true is set.
 * The syncToGraph option has been removed - graph sync is now controlled
 * entirely by the environment variable and graphAdapter configuration.
 *
 * @deprecated The syncToGraph option is no longer used. Graph sync is automatic
 * when CORTEX_GRAPH_SYNC=true and graph credentials are configured.
 */
interface GraphSyncOption {
}
interface CreateConversationOptions extends GraphSyncOption {
}
interface AddMessageOptions extends GraphSyncOption {
}
interface UpdateConversationOptions extends GraphSyncOption {
}
interface DeleteConversationOptions extends GraphSyncOption {
}
interface StoreImmutableOptions extends GraphSyncOption {
}
interface UpdateImmutableOptions extends GraphSyncOption {
}
interface DeleteImmutableOptions extends GraphSyncOption {
}
interface SetMutableOptions extends GraphSyncOption {
}
interface UpdateMutableOptions extends GraphSyncOption {
}
interface DeleteMutableOptions extends GraphSyncOption {
}
interface StoreMemoryOptions extends GraphSyncOption {
}
interface UpdateMemoryOptions extends GraphSyncOption {
    reextractFacts?: boolean;
    extractFacts?: (content: string) => Promise<Array<{
        fact: string;
        factType: "preference" | "identity" | "knowledge" | "relationship" | "event" | "observation" | "custom";
        subject?: string;
        predicate?: string;
        object?: string;
        confidence: number;
        tags?: string[];
    }> | null>;
}
interface UpdateMemoryOptions extends GraphSyncOption {
}
interface DeleteMemoryOptions extends GraphSyncOption {
    cascadeDeleteFacts?: boolean;
}
interface DeleteMemoryOptions extends GraphSyncOption {
}
interface StoreFactOptions extends GraphSyncOption {
}
interface UpdateFactOptions extends GraphSyncOption {
}
interface DeleteFactOptions extends GraphSyncOption {
}
interface ContextVersion$1 {
    version: number;
    status: string;
    data?: Record<string, unknown>;
    timestamp: number;
    updatedBy?: string;
}
interface CreateContextOptions extends GraphSyncOption {
}
interface UpdateContextOptions extends GraphSyncOption {
}
interface DeleteContextOptions extends GraphSyncOption {
}
interface ParticipantUpdates {
    add?: Array<{
        id: string;
        type: string;
        joinedAt: number;
    }>;
    remove?: string[];
}
interface RegisterMemorySpaceOptions extends GraphSyncOption {
}
interface UnregisterMemorySpaceOptions extends GraphSyncOption {
}
/**
 * Options for memory.remember() convenience method
 * Graph sync is automatic when CORTEX_GRAPH_SYNC=true and graphAdapter is configured
 */
interface RememberOptions extends GraphSyncOption {
    /** Extract facts from conversation (default: false) */
    extractFacts?: boolean;
    /** Custom extraction function */
    extractContent?: (userMessage: string, agentResponse: string) => Promise<string | null>;
    /** Custom embedding function */
    generateEmbedding?: (content: string) => Promise<number[] | null>;
    /** Cloud Mode options */
    autoEmbed?: boolean;
    autoSummarize?: boolean;
    /**
     * Belief Revision configuration (v0.24.0+)
     *
     * When enabled, extracted facts are checked against existing facts
     * to determine if they should CREATE, UPDATE, SUPERSEDE, or be skipped.
     *
     * Set to `false` to disable belief revision entirely for this call.
     */
    beliefRevision?: {
        /** Enable belief revision (default: true if Cortex configured) */
        enabled?: boolean;
        /** Enable slot-based matching for fast conflict detection (default: true) */
        slotMatching?: boolean;
        /** Enable LLM-based conflict resolution for nuanced decisions (default: true) */
        llmResolution?: boolean;
    } | false;
}
/**
 * Extended forget options
 * Graph sync is automatic when CORTEX_GRAPH_SYNC=true and graphAdapter is configured
 */
interface ExtendedForgetOptions extends ForgetOptions, GraphSyncOption {
}
/**
 * Options for memory recall with graph enrichment (legacy - use RecallParams instead)
 */
interface RecallOptions extends GraphSyncOption {
    /** Use graph for enrichment (default: true if graph configured) */
    enrichWithGraph?: boolean;
    /** Maximum depth for graph traversal enrichment */
    maxEnrichmentDepth?: number;
    /** Include full conversation history */
    includeConversation?: boolean;
}
/**
 * Configurable limits for recall() operations.
 *
 * Controls how many results to fetch from each source and how deep
 * to traverse the knowledge graph. All fields are optional and default
 * to environment variables or sensible hardcoded defaults.
 *
 * Configuration hierarchy (highest priority first):
 * 1. Per-call override (this interface)
 * 2. Environment variables (CORTEX_RECALL_*)
 * 3. SDK defaults
 *
 * @example
 * ```typescript
 * // Override specific limits
 * const result = await cortex.memory.recall({
 *   memorySpaceId: 'space-1',
 *   query: 'user preferences',
 *   limits: {
 *     memories: 50,      // More memories
 *     facts: 5,          // Fewer facts
 *     graphHops: 1,      // Shallow graph traversal
 *   }
 * });
 *
 * // Disable graph entirely for fast lookups
 * const result = await cortex.memory.recall({
 *   memorySpaceId: 'space-1',
 *   query: 'quick lookup',
 *   limits: { graphHops: 0 }
 * });
 * ```
 */
interface RecallLimits {
    /**
     * Maximum memories to fetch from vector search.
     * Env: CORTEX_RECALL_LIMIT_MEMORIES
     * Default: 20
     */
    memories?: number;
    /**
     * Maximum facts to fetch from semantic/text search.
     * Env: CORTEX_RECALL_LIMIT_FACTS
     * Default: 15
     */
    facts?: number;
    /**
     * Graph traversal depth.
     * - 0: Disabled (no graph expansion)
     * - 1: Immediate relationships only
     * - 2: Two-hop traversal (default)
     * Env: CORTEX_RECALL_GRAPH_HOPS
     * Default: 2
     */
    graphHops?: number;
    /**
     * Maximum entities to expand per graph hop.
     * Controls the branching factor of graph traversal.
     * Env: CORTEX_RECALL_GRAPH_ENTITIES_PER_HOP
     * Default: 5
     */
    graphEntitiesPerHop?: number;
    /**
     * Maximum memories/facts to fetch per discovered entity.
     * Env: CORTEX_RECALL_GRAPH_RESULTS_PER_ENTITY
     * Default: 3
     */
    graphResultsPerEntity?: number;
    /**
     * Final aggregate limit on total results returned.
     * Applied after merge, dedupe, and ranking.
     * Env: CORTEX_RECALL_LIMIT_TOTAL
     * Default: 30
     */
    total?: number;
}
/**
 * Parameters for the recall() orchestration API.
 *
 * Batteries included by default - just provide memorySpaceId and query
 * to get full orchestrated retrieval across all layers.
 *
 * @example
 * ```typescript
 * // Minimal usage - full orchestration
 * const result = await cortex.memory.recall({
 *   memorySpaceId: 'user-123-space',
 *   query: 'user preferences',
 * });
 *
 * // Inject context into LLM
 * const response = await llm.chat({
 *   messages: [
 *     { role: 'system', content: `You are helpful.\n\n${result.context}` },
 *     { role: 'user', content: userMessage },
 *   ],
 * });
 * ```
 */
interface RecallParams {
    /** Memory space to search in */
    memorySpaceId: string;
    /** Natural language query */
    query: string;
    /** Pre-computed embedding for semantic search (recommended for best results) */
    embedding?: number[];
    /** Filter by user ID (common in H2A chatbots) */
    userId?: string;
    /** Filter by tenant ID for multi-tenancy (SaaS platform isolation) */
    tenantId?: string;
    /**
     * Source selection - ALL ENABLED BY DEFAULT.
     * Only specify to DISABLE sources.
     */
    sources?: {
        /** Search vector memories (Layer 2). Default: true */
        vector?: boolean;
        /** Search facts directly (Layer 3). Default: true */
        facts?: boolean;
        /** Query graph for relationships. Default: true if graph configured */
        graph?: boolean;
    };
    /**
     * Graph expansion configuration - ENABLED BY DEFAULT if graph configured.
     * Graph is the key to relational context discovery.
     */
    graphExpansion?: {
        /** Enable graph expansion. Default: true if graph configured */
        enabled?: boolean;
        /** Maximum traversal depth. Default: 2 */
        maxDepth?: number;
        /** Relationship types to follow. Default: all types */
        relationshipTypes?: string[];
        /** Expand from discovered facts. Default: true */
        expandFromFacts?: boolean;
        /** Expand from discovered memories. Default: true */
        expandFromMemories?: boolean;
    };
    /** Minimum importance score (0-100) */
    minImportance?: number;
    /** Minimum confidence for facts (0-100) */
    minConfidence?: number;
    /** Filter by tags */
    tags?: string[];
    /** Only include items created after this date */
    createdAfter?: Date;
    /** Only include items created before this date */
    createdBefore?: Date;
    /**
     * Structured limits for per-source control.
     * See RecallLimits interface for detailed options.
     * Defaults come from environment variables or SDK defaults.
     */
    limits?: RecallLimits;
    /**
     * Maximum number of results (backward compatibility).
     * Alias for limits.total - if both provided, limits.total takes precedence.
     * @deprecated Use limits.total instead for clarity
     * Default: 30
     */
    limit?: number;
    /** Enrich with ACID conversation data. Default: true */
    includeConversation?: boolean;
    /** Generate LLM-ready context string. Default: true */
    formatForLLM?: boolean;
    /**
     * Observer for real-time recall orchestration monitoring.
     *
     * Provides callbacks for tracking layer-by-layer progress during
     * the recall() context retrieval flow. Integration-agnostic.
     *
     * @example
     * ```typescript
     * const result = await cortex.memory.recall({
     *   memorySpaceId: 'space-1',
     *   query: 'user preferences',
     *   observer: {
     *     onRecallStart: (id) => console.log(`Started: ${id}`),
     *     onLayerUpdate: (event) => console.log(`${event.layer}: ${event.status}`),
     *     onRecallComplete: (summary) => console.log(`Done in ${summary.totalLatencyMs}ms`),
     *   },
     * });
     * ```
     */
    observer?: OrchestrationObserver;
}
/**
 * Individual item in recall results - either a memory or a fact.
 */
interface RecallItem {
    /** Item type */
    type: "memory" | "fact";
    /** Unique identifier */
    id: string;
    /** Content string for display/LLM injection */
    content: string;
    /** Combined ranking score (0-1) */
    score: number;
    /** Source of this item */
    source: "vector" | "facts" | "graph-expanded";
    /** Multi-tenancy: Tenant this item belongs to */
    tenantId?: string;
    /** User who owns this item */
    userId?: string;
    /** Original memory data (if type === 'memory') */
    memory?: MemoryEntry;
    /** Original fact data (if type === 'fact') */
    fact?: FactRecord;
    /** Graph context for this item */
    graphContext?: {
        /** Entities connected to this item */
        connectedEntities: string[];
        /** Relationship path that led to discovery */
        relationshipPath?: string;
    };
    /** Enriched conversation data (if includeConversation: true) */
    conversation?: Conversation;
    /** Source messages from conversation */
    sourceMessages?: Message[];
}
/**
 * Source breakdown in recall results.
 */
interface RecallSourceBreakdown {
    /** Vector search results */
    vector: {
        count: number;
        items: MemoryEntry[];
    };
    /** Facts search results */
    facts: {
        count: number;
        items: FactRecord[];
    };
    /** Graph expansion results */
    graph: {
        count: number;
        expandedEntities: string[];
    };
}
/**
 * Result from the recall() orchestration API.
 *
 * Provides unified, deduplicated, ranked results from all sources
 * with LLM-ready context formatting.
 */
interface RecallResult {
    /** Unified results (merged, deduped, ranked) */
    items: RecallItem[];
    /** Breakdown by source */
    sources: RecallSourceBreakdown;
    /**
     * Formatted context for LLM injection.
     * Present when formatForLLM: true (default).
     *
     * @example
     * ```typescript
     * const response = await llm.chat({
     *   messages: [
     *     { role: 'system', content: `Context:\n${result.context}` },
     *     { role: 'user', content: userMessage },
     *   ],
     * });
     * ```
     */
    context?: string;
    /** Total number of results before limit */
    totalResults: number;
    /** Query execution time in milliseconds */
    queryTimeMs: number;
    /** Whether graph expansion was applied */
    graphExpansionApplied: boolean;
}

/**
 * Memory orchestration layer identifiers
 *
 * These represent the layers that are orchestrated during remember() calls:
 * - memorySpace: Auto-registers memory space if it doesn't exist
 * - user: Auto-creates user profile if userId is provided
 * - agent: Auto-registers agent if agentId is provided
 * - conversation: Stores messages in ACID conversation layer
 * - vector: Creates searchable vector memories
 * - facts: Auto-extracts facts if LLM is configured
 * - graph: Syncs entities to graph database if configured
 */
type MemoryLayer = "memorySpace" | "user" | "agent" | "conversation" | "vector" | "facts" | "graph" | "context";
/**
 * Layer status during orchestration
 */
type LayerStatus = "pending" | "in_progress" | "complete" | "error" | "skipped";
/**
 * Revision action taken by the belief revision system
 *
 * Matches ConflictAction from the belief revision pipeline:
 * - ADD: New fact created (no conflicts)
 * - UPDATE: Existing fact updated in place
 * - SUPERSEDE: Old fact replaced by new one
 * - NONE: Duplicate skipped
 */
type RevisionAction = "ADD" | "UPDATE" | "SUPERSEDE" | "NONE";
/**
 * Event emitted when a layer's status changes during orchestration
 *
 * @example
 * ```typescript
 * const observer: OrchestrationObserver = {
 *   onLayerUpdate: (event) => {
 *     console.log(`Layer ${event.layer}: ${event.status}`);
 *     if (event.latencyMs) {
 *       console.log(`  Took ${event.latencyMs}ms`);
 *     }
 *   },
 * };
 * ```
 */
interface LayerEvent {
    /** Which layer this event is for */
    layer: MemoryLayer;
    /** Current status of the layer */
    status: LayerStatus;
    /** Timestamp when this status was set */
    timestamp: number;
    /** Time elapsed since orchestration started (ms) */
    latencyMs?: number;
    /**
     * Phase of the orchestration this event belongs to.
     * - "recall": Context retrieval phase (before LLM response)
     * - "remember": Memory storage phase (after LLM response)
     */
    phase: "recall" | "remember";
    /** Data stored in this layer (if complete) */
    data?: {
        /** ID of the stored record */
        id?: string;
        /** Summary or preview of the data */
        preview?: string;
        /** Additional metadata */
        metadata?: Record<string, unknown>;
    };
    /** Error details (if error status) */
    error?: {
        message: string;
        code?: string;
    };
    /**
     * Revision action taken (for facts layer with belief revision enabled)
     */
    revisionAction?: RevisionAction;
    /**
     * Facts that were superseded by this action
     * Only present when revisionAction is "SUPERSEDE"
     */
    supersededFacts?: string[];
}
/**
 * Summary of the recall phase (context retrieval)
 *
 * Returned when recall orchestration completes. Contains context
 * retrieved from various memory layers for LLM injection.
 */
interface RecallSummary {
    /** Unique ID for this orchestration run */
    orchestrationId: string;
    /** Phase identifier */
    phase: "recall";
    /** Total time for recall orchestration (ms) */
    totalLatencyMs: number;
    /** Status of each layer queried during recall */
    layers: Partial<Record<MemoryLayer, LayerEvent>>;
    /** Retrieved context ready for LLM injection */
    context: {
        /** Formatted context string for LLM prompt */
        formatted?: string;
        /** Number of memories retrieved */
        memoriesCount: number;
        /** Number of facts retrieved */
        factsCount: number;
        /** Number of graph entities retrieved */
        graphEntitiesCount: number;
    };
}
/**
 * Summary of the full orchestration flow
 *
 * Returned when remember orchestration completes (all layers processed).
 */
interface OrchestrationSummary {
    /** Unique ID for this orchestration run */
    orchestrationId: string;
    /** Phase identifier */
    phase: "remember";
    /** Total time for all layers (ms) */
    totalLatencyMs: number;
    /** Status of each layer */
    layers: Record<MemoryLayer, LayerEvent>;
    /** IDs of records created */
    createdIds: {
        conversationId?: string;
        memoryIds?: string[];
        factIds?: string[];
    };
}
/**
 * Observer for phase-aware memory orchestration
 *
 * Provides real-time monitoring of recall() and remember() orchestration
 * flows. Events include phase information to distinguish between context
 * retrieval (recall) and memory storage (remember) operations.
 *
 * This is integration-agnostic - any integration (Vercel AI SDK, LangChain,
 * custom) can use this interface.
 *
 * @example
 * ```typescript
 * // Phase-aware usage with recall() and remember()
 * const observer: OrchestrationObserver = {
 *   onRecallStart: (id) => console.log(`Recall started: ${id}`),
 *   onRecallComplete: (summary) => console.log(`Context retrieved in ${summary.totalLatencyMs}ms`),
 *   onRememberStart: (id) => console.log(`Remember started: ${id}`),
 *   onRememberComplete: (summary) => console.log(`Stored in ${summary.totalLatencyMs}ms`),
 *   onLayerUpdate: (event) => console.log(`[${event.phase}] ${event.layer}: ${event.status}`),
 * };
 *
 * // Use with recall()
 * const context = await cortex.memory.recall({
 *   memorySpaceId: 'space-1',
 *   query: 'user preferences',
 *   observer,
 * });
 *
 * // Use with remember()
 * await cortex.memory.remember({
 *   memorySpaceId: 'user-123-space',
 *   conversationId: 'conv-123',
 *   userMessage: 'My name is Alex',
 *   agentResponse: "Nice to meet you, Alex!",
 *   userId: 'user-123',
 *   userName: 'Alex',
 *   agentId: 'assistant',
 *   observer,
 * });
 * ```
 */
interface OrchestrationObserver {
    /**
     * Called when recall phase starts (context retrieval).
     * Recall happens before the LLM generates a response.
     */
    onRecallStart?: (orchestrationId: string) => void | Promise<void>;
    /**
     * Called when recall phase completes.
     * Contains retrieved context and timing information.
     */
    onRecallComplete?: (summary: RecallSummary) => void | Promise<void>;
    /**
     * Called when remember phase starts (memory storage).
     * Remember happens after the LLM generates a response.
     */
    onRememberStart?: (orchestrationId: string) => void | Promise<void>;
    /**
     * Called when remember phase completes (all layers done).
     * Contains created record IDs and timing information.
     */
    onRememberComplete?: (summary: OrchestrationSummary) => void | Promise<void>;
    /**
     * Called when a layer's status changes during either phase.
     * The event.phase field indicates which phase the update is for.
     */
    onLayerUpdate?: (event: LayerEvent) => void | Promise<void>;
}
/**
 * Artifact kind representing the content type
 * See 00-unified-specification.md for canonical values
 */
type ArtifactKind = "text" | "code" | "sheet" | "image" | "diagram" | "html" | "custom";
/**
 * Streaming state representing the artifact lifecycle
 * See 00-unified-specification.md for state transitions
 */
type StreamingState = "draft" | "streaming" | "paused" | "final" | "error";
/**
 * Reference to an attached file
 */
interface FileReference {
    /** Unique file identifier */
    fileId: string;
    /** Original filename */
    filename: string;
    /** MIME type of the file */
    mimeType: string;
    /** File size in bytes */
    sizeBytes: number;
    /** URL to access the file (signed URL or permanent) */
    url: string;
    /** When the URL expires (for signed URLs) */
    urlExpiresAt?: number;
    /** File metadata */
    metadata?: Record<string, unknown>;
    /** When the file was attached */
    attachedAt: number;
}
/**
 * Reference to file stored in Convex storage
 */
interface ArtifactFileRef {
    /** Convex storage ID */
    storageId: string;
    /** Content MIME type */
    mimeType: string;
    /** Size in bytes */
    size: number;
    /** SHA-256 checksum */
    checksum?: string;
    /** Original filename */
    originalFilename?: string;
}
/**
 * Individual version entry in artifact history
 * See 00-unified-specification.md for canonical structure
 */
interface ArtifactVersion {
    /** Version number (1-based, auto-incremented) */
    version: number;
    /** Content at this version (if inline) */
    content?: string;
    /** File reference at this version (if stored in file storage) */
    fileRef?: ArtifactFileRef;
    /** Title at this version */
    title?: string;
    /** When this version was created */
    timestamp: number;
    /** Who made this change (agentId or userId) */
    changedBy?: string;
    /** Type of change */
    changeType: "create" | "update" | "undo" | "redo";
    /** Brief description of changes */
    changeSummary?: string;
}
/**
 * Kind-specific configuration for artifacts
 */
interface ArtifactKindConfig {
    /** Name for "custom" kind */
    customKind?: string;
    /** MIME type (e.g., "text/markdown") */
    mimeType?: string;
    /** For code: programming language */
    language?: string;
    /** For html: framework used */
    framework?: string;
    /** For sheet/custom: data schema */
    schema?: unknown;
}
/**
 * Streaming session metadata
 */
interface StreamingMetadata {
    /** Active streaming session ID */
    sessionId?: string;
    /** When streaming began */
    startedAt?: number;
    /** Last chunk timestamp */
    lastChunkAt?: number;
    /** Progress tracking */
    bytesReceived?: number;
    /** Estimated total bytes */
    estimatedTotal?: number;
    /** Error details if state is "error" */
    errorMessage?: string;
    /** Programmatic error code */
    errorCode?: string;
}
/**
 * Collaborator entry for shared artifacts
 */
interface ArtifactCollaborator {
    /** User or agent ID */
    id: string;
    /** Type of collaborator */
    type: "user" | "agent";
    /** Access role */
    role: "owner" | "editor" | "viewer";
    /** When added */
    addedAt: number;
    /** Last edit timestamp */
    lastEditAt?: number;
}
/**
 * Artifact statistics
 */
interface ArtifactStats {
    /** Character count */
    characterCount?: number;
    /** Word count */
    wordCount?: number;
    /** Line count */
    lineCount?: number;
    /** Token count (for LLM context) */
    tokenCount?: number;
}
/**
 * Reference to source memory
 */
interface ArtifactMemoryRef {
    /** Memory ID */
    memoryId: string;
    /** Relevance score (0-100) */
    relevance?: number;
}
/**
 * Main Artifact record
 */
interface Artifact {
    /** Convex document ID */
    _id: string;
    /** Public artifact identifier */
    artifactId: string;
    /** Memory space this artifact belongs to */
    memorySpaceId: string;
    /** Multi-tenancy: SaaS platform isolation */
    tenantId?: string;
    /** User who owns this artifact */
    userId?: string;
    /** Agent who owns this artifact */
    agentId?: string;
    /** Participant ID for Hive Mode tracking */
    participantId?: string;
    /** Artifact kind for content type */
    kind: ArtifactKind;
    /** Kind-specific configuration */
    kindConfig?: ArtifactKindConfig;
    /** Inline content (<1MB) */
    content?: string;
    /** File reference for large content (>1MB) */
    fileRef?: ArtifactFileRef;
    /** Display title */
    title: string;
    /** Brief description */
    description?: string;
    /** Tags for categorization */
    tags: string[];
    /** Streaming lifecycle state */
    streamingState: StreamingState;
    /** Streaming session metadata */
    streamingMetadata?: StreamingMetadata;
    /** Current version number */
    version: number;
    /** Active version pointer for undo/redo navigation */
    versionPointer: number;
    /** Version history for undo/redo */
    versionHistory: ArtifactVersion[];
    /** Currently attached files */
    attachedFiles?: FileReference[];
    /** Reference to source conversation */
    conversationRef?: {
        conversationId: string;
        messageId?: string;
        turnIndex?: number;
    };
    /** References to source memories */
    memoryRefs?: ArtifactMemoryRef[];
    /** Collaborators for shared artifacts */
    collaborators?: ArtifactCollaborator[];
    /** Content statistics */
    stats?: ArtifactStats;
    /** Custom metadata */
    metadata?: Record<string, unknown>;
    /** When the artifact was created */
    createdAt: number;
    /** When the artifact was last updated */
    updatedAt: number;
    /** When the artifact was last accessed */
    lastAccessedAt?: number;
    /** Total access count */
    accessCount?: number;
    /** Whether the artifact is deleted */
    isDeleted?: boolean;
    /** When the artifact was deleted */
    deletedAt?: number;
    /** Who deleted the artifact */
    deletedBy?: string;
}
/**
 * Options for creating a new artifact
 */
interface CreateArtifactOptions {
    /** Memory space ID (required) */
    memorySpaceId: string;
    /** Artifact title (required) */
    title: string;
    /** Initial content (required) */
    content: string;
    /** Artifact kind (default: "text") */
    kind?: ArtifactKind;
    /** Kind-specific configuration */
    kindConfig?: ArtifactKindConfig;
    /** Initial streaming state (default: "draft") */
    streamingState?: StreamingState;
    /** Custom artifact ID (auto-generated if not provided) */
    artifactId?: string;
    /** Multi-tenancy: SaaS platform isolation */
    tenantId?: string;
    /** User who owns this artifact */
    userId?: string;
    /** Agent who owns this artifact */
    agentId?: string;
    /** Participant ID for Hive Mode tracking */
    participantId?: string;
    /** Brief description */
    description?: string;
    /** Custom metadata */
    metadata?: Record<string, unknown>;
    /** Initial tags */
    tags?: string[];
    /** Reference to source conversation */
    conversationRef?: {
        conversationId: string;
        messageId?: string;
        turnIndex?: number;
    };
    /** References to source memories */
    memoryRefs?: ArtifactMemoryRef[];
}
/**
 * Options for updating an artifact's content
 */
interface UpdateArtifactOptions {
    /** Optional new title */
    title?: string;
    /** Optional new kind */
    kind?: ArtifactKind;
    /** Optional metadata updates (merged with existing) */
    metadata?: Record<string, unknown>;
    /** Optional tag updates (replaces existing) */
    tags?: string[];
    /** Brief description of changes for version history */
    changeSummary?: string;
    /** User or agent who made this change */
    changedBy?: string;
}
/**
 * Filter for listing artifacts
 */
interface ListArtifactsFilter {
    /** Memory space ID (required) */
    memorySpaceId: string;
    /** Filter by tenant ID */
    tenantId?: string;
    /** Filter by user ID */
    userId?: string;
    /** Filter by agent ID */
    agentId?: string;
    /** Filter by participant ID */
    participantId?: string;
    /** Filter by kind */
    kind?: ArtifactKind;
    /** Filter by streaming state */
    streamingState?: StreamingState;
    /** Filter by tags (any match) */
    tags?: string[];
    /** Tag match mode */
    tagMatch?: "any" | "all";
    /** Title search (contains, case-insensitive) */
    titleContains?: string;
    /** Filter by creation date */
    createdAfter?: number;
    createdBefore?: number;
    /** Filter by update date */
    updatedAfter?: number;
    updatedBefore?: number;
    /** Result limit (default: 50, max: 1000) */
    limit?: number;
    /** Pagination offset */
    offset?: number;
    /** Sort field */
    sortBy?: "createdAt" | "updatedAt";
    /** Sort direction */
    sortOrder?: "asc" | "desc";
    /** Include soft-deleted artifacts */
    includeDeleted?: boolean;
}
/**
 * Filter for counting artifacts
 */
interface CountArtifactsFilter {
    /** Memory space ID (required) */
    memorySpaceId: string;
    /** Filter by tenant ID */
    tenantId?: string;
    /** Filter by user ID */
    userId?: string;
    /** Filter by kind */
    kind?: ArtifactKind;
    /** Filter by streaming state */
    streamingState?: StreamingState;
    /** Include soft-deleted artifacts */
    includeDeleted?: boolean;
    /** Filter by creation time (after) */
    createdAfter?: number;
    /** Filter by creation time (before) */
    createdBefore?: number;
}
/**
 * Options for artifact history retrieval
 */
interface GetArtifactHistoryOptions {
    /** Limit number of versions returned */
    limit?: number;
    /** Pagination offset */
    offset?: number;
    /** Sort order (asc = oldest first, desc = newest first) */
    sortOrder?: "asc" | "desc";
}
/**
 * Result from artifact deletion
 */
interface DeleteArtifactResult {
    /** Whether the artifact was deleted */
    deleted: boolean;
    /** ID of the deleted artifact */
    artifactId: string;
    /** Number of versions purged (hard delete only) */
    versionsPurged?: number;
    /** Number of files detached (hard delete only) */
    filesDetached?: number;
}
/**
 * Result from bulk artifact operations
 */
interface BulkArtifactResult {
    /** Number of artifacts affected */
    affected: number;
    /** IDs of affected artifacts */
    artifactIds: string[];
    /** Any errors encountered */
    errors?: Array<{
        artifactId: string;
        error: string;
    }>;
}
/**
 * Parameters for starting a streaming session
 */
interface StartStreamingParams {
    /** Artifact ID to stream to */
    artifactId: string;
}
/**
 * Parameters for appending content during streaming
 */
interface AppendContentParams {
    /** Artifact ID */
    artifactId: string;
    /** Session ID from startStreaming */
    sessionId: string;
    /** Content chunk to append */
    chunk: string;
}
/**
 * Parameters for streaming session operations (pause/resume/cancel)
 */
interface StreamingSessionParams {
    /** Artifact ID */
    artifactId: string;
    /** Session ID from startStreaming */
    sessionId: string;
}
/**
 * Parameters for finalizing a streaming session
 */
interface FinalizeStreamingParams {
    /** Artifact ID */
    artifactId: string;
    /** Session ID from startStreaming */
    sessionId: string;
    /** Summary of the streaming session for version history */
    changeSummary?: string;
}
/**
 * Attachment type representing the kind of file
 */
type AttachmentType = "image" | "audio" | "video" | "file" | "pdf";
/**
 * Dimensions for image/video attachments
 */
interface AttachmentDimensions {
    /** Width in pixels */
    width: number;
    /** Height in pixels */
    height: number;
}
/**
 * Attachment record representing a stored file
 */
interface Attachment {
    /** Internal Convex document ID */
    _id: string;
    /** Unique attachment identifier */
    attachmentId: string;
    /** Memory space isolation */
    memorySpaceId: string;
    /** Multi-tenancy: SaaS platform isolation */
    tenantId?: string;
    /** User who uploaded this attachment */
    userId: string;
    /** Linked conversation (optional) */
    conversationId?: string;
    /** Linked message (optional) */
    messageId?: string;
    /** Linked memory (optional) */
    memoryId?: string;
    /** Linked artifact (optional) */
    artifactId?: string;
    /** Convex storage ID for the file */
    storageId: string;
    /** Type of attachment */
    type: AttachmentType;
    /** MIME type (e.g., "image/png") */
    mimeType: string;
    /** Original filename */
    filename: string;
    /** File size in bytes */
    size: number;
    /** Extracted text from OCR/PDF parsing (future) */
    extractedText?: string;
    /** Audio/video transcript (future) */
    transcript?: string;
    /** Embedding for semantic search (future) */
    embedding?: number[];
    /** Image/video dimensions */
    dimensions?: AttachmentDimensions;
    /** Audio/video duration in seconds */
    duration?: number;
    /** Custom metadata */
    metadata?: Record<string, unknown>;
    /** Creation timestamp */
    createdAt: number;
    /** Last update timestamp */
    updatedAt: number;
}
/**
 * Parameters for attaching an uploaded file
 */
interface AttachParams {
    /** Convex storage ID from upload */
    storageId: string;
    /** Memory space to associate with */
    memorySpaceId: string;
    /** User who owns this attachment */
    userId: string;
    /** Type of attachment */
    type: AttachmentType;
    /** MIME type (e.g., "image/png") */
    mimeType: string;
    /** Original filename */
    filename: string;
    /** File size in bytes */
    size: number;
    /** Link to conversation (optional) */
    conversationId?: string;
    /** Link to specific message (optional) */
    messageId?: string;
    /** Link to memory (optional) */
    memoryId?: string;
    /** Link to artifact (optional) */
    artifactId?: string;
    /** Image/video dimensions (optional) */
    dimensions?: AttachmentDimensions;
    /** Audio/video duration in seconds (optional) */
    duration?: number;
    /** Custom metadata (optional) */
    metadata?: Record<string, unknown>;
    /** Multi-tenancy: tenant ID */
    tenantId?: string;
}
/**
 * Filter for listing attachments
 */
interface ListAttachmentsFilter {
    /** Required: memory space to list from */
    memorySpaceId: string;
    /** Filter by conversation */
    conversationId?: string;
    /** Filter by message */
    messageId?: string;
    /** Filter by memory */
    memoryId?: string;
    /** Filter by artifact */
    artifactId?: string;
    /** Filter by user */
    userId?: string;
    /** Filter by attachment type */
    type?: AttachmentType;
    /** Maximum results (1-1000, default 50) */
    limit?: number;
    /** Pagination cursor */
    cursor?: string;
    /** Sort field */
    sortBy?: "createdAt" | "updatedAt";
    /** Sort order */
    sortOrder?: "asc" | "desc";
    /** Multi-tenancy: tenant ID */
    tenantId?: string;
}
/**
 * Result from listing attachments
 */
interface ListAttachmentsResult {
    /** Array of attachments */
    attachments: Attachment[];
    /** Total count matching filter */
    total: number;
    /** Next page cursor (if more results exist) */
    cursor?: string;
    /** Whether more results exist */
    hasMore: boolean;
}
/**
 * Result from generating an upload URL
 */
interface UploadUrlResult {
    /** Pre-signed upload URL */
    uploadUrl: string;
}
/**
 * Result from bulk delete operation
 */
interface DeleteManyAttachmentsResult {
    /** Number of attachments deleted */
    deleted: number;
    /** Total number of attachments requested */
    total: number;
    /** Any errors encountered */
    errors?: Array<{
        attachmentId: string;
        error: string;
    }>;
}

/**
 * Graph Database Integration - Type Definitions
 *
 * Defines interfaces for graph database operations, supporting Neo4j, Memgraph,
 * and other Cypher-compatible graph databases.
 */
/**
 * Graph node representation
 */
interface GraphNode {
    /** Node label (e.g., 'Context', 'Memory', 'Fact') */
    label: string;
    /** Node properties (key-value pairs) */
    properties: Record<string, unknown>;
    /** Optional node ID (set by graph database after creation) */
    id?: string;
}
/**
 * Graph edge (relationship) representation
 */
interface GraphEdge {
    /** Relationship type (e.g., 'CHILD_OF', 'MENTIONS', 'SENT_TO') */
    type: string;
    /** Source node ID */
    from: string;
    /** Target node ID */
    to: string;
    /** Optional relationship properties */
    properties?: Record<string, unknown>;
    /** Optional edge ID (set by graph database after creation) */
    id?: string;
}
/**
 * Cypher query with parameters
 */
interface GraphQuery {
    /** Cypher query string */
    cypher: string;
    /** Query parameters (for parameterized queries) */
    params?: Record<string, unknown>;
}
/**
 * Path between nodes in graph
 */
interface GraphPath {
    /** Nodes in the path */
    nodes: GraphNode[];
    /** Relationships in the path */
    relationships: GraphEdge[];
    /** Path length (number of hops) */
    length: number;
}
/**
 * Graph database connection configuration
 */
interface GraphConnectionConfig {
    /** Bolt URI (e.g., 'bolt://localhost:7687', 'neo4j+s://cloud.neo4j.io') */
    uri: string;
    /** Username for authentication */
    username: string;
    /** Password for authentication */
    password: string;
    /** Optional database name (Neo4j 4.0+) */
    database?: string;
    /** Optional connection pool configuration */
    maxConnectionPoolSize?: number;
    /** Optional connection timeout (ms) */
    connectionTimeout?: number;
}
/**
 * Result from a graph query
 */
interface GraphQueryResult {
    /** Records returned by the query */
    records: Record<string, unknown>[];
    /** Number of records returned */
    count: number;
    /** Optional query statistics (nodes created, relationships created, etc.) */
    stats?: QueryStatistics;
}
/**
 * Query execution statistics
 */
interface QueryStatistics {
    /** Number of nodes created */
    nodesCreated?: number;
    /** Number of nodes deleted */
    nodesDeleted?: number;
    /** Number of relationships created */
    relationshipsCreated?: number;
    /** Number of relationships deleted */
    relationshipsDeleted?: number;
    /** Number of properties set */
    propertiesSet?: number;
    /** Number of labels added */
    labelsAdded?: number;
    /** Number of labels removed */
    labelsRemoved?: number;
    /** Number of indexes added */
    indexesAdded?: number;
    /** Number of constraints added */
    constraintsAdded?: number;
}
/**
 * Batch operation for graph write
 */
interface GraphOperation {
    /** Operation type */
    type: "CREATE_NODE" | "UPDATE_NODE" | "DELETE_NODE" | "CREATE_EDGE" | "DELETE_EDGE";
    /** Operation data */
    data: GraphNode | GraphEdge | {
        id: string;
        properties?: Record<string, unknown>;
    };
}
/**
 * Graph traversal configuration
 */
interface TraversalConfig {
    /** Starting node ID */
    startId: string;
    /** Relationship types to follow (empty = all types) */
    relationshipTypes?: string[];
    /** Maximum depth to traverse */
    maxDepth: number;
    /** Optional direction: 'OUTGOING', 'INCOMING', or 'BOTH' */
    direction?: "OUTGOING" | "INCOMING" | "BOTH";
    /** Optional filter predicate (Cypher WHERE clause) */
    filter?: string;
    /** Optional filter parameters */
    filterParams?: Record<string, unknown>;
}
/**
 * Shortest path query configuration
 */
interface ShortestPathConfig {
    /** Source node ID */
    fromId: string;
    /** Target node ID */
    toId: string;
    /** Maximum number of hops to search */
    maxHops: number;
    /** Optional relationship types to follow */
    relationshipTypes?: string[];
    /** Optional direction */
    direction?: "OUTGOING" | "INCOMING" | "BOTH";
}
/**
 * Graph database adapter interface
 *
 * Provides a unified interface for graph database operations,
 * supporting Neo4j, Memgraph, and other Cypher-compatible databases.
 */
interface GraphAdapter {
    /**
     * Connect to the graph database
     *
     * @param config Connection configuration
     * @returns Promise that resolves when connected
     */
    connect(config: GraphConnectionConfig): Promise<void>;
    /**
     * Disconnect from the graph database
     *
     * @returns Promise that resolves when disconnected
     */
    disconnect(): Promise<void>;
    /**
     * Test the database connection
     *
     * @returns Promise that resolves to true if connected, false otherwise
     */
    isConnected(): Promise<boolean>;
    /**
     * Create a node in the graph
     *
     * @param node Node to create
     * @returns Promise that resolves to the created node ID
     */
    createNode(node: GraphNode): Promise<string>;
    /**
     * Merge (upsert) a node in the graph
     *
     * Uses MERGE semantics: creates if not exists, matches if exists.
     * Updates properties on existing nodes.
     * This is idempotent and safe for concurrent operations.
     *
     * @param node Node to merge
     * @param matchProperties Properties to match on (for finding existing node)
     * @returns Promise that resolves to the node ID (existing or newly created)
     */
    mergeNode(node: GraphNode, matchProperties: Record<string, unknown>): Promise<string>;
    /**
     * Get a node by ID
     *
     * @param id Node ID
     * @returns Promise that resolves to the node, or null if not found
     */
    getNode(id: string): Promise<GraphNode | null>;
    /**
     * Update a node's properties
     *
     * @param id Node ID
     * @param properties Properties to update
     * @returns Promise that resolves when updated
     */
    updateNode(id: string, properties: Record<string, unknown>): Promise<void>;
    /**
     * Delete a node
     *
     * @param id Node ID
     * @param detach If true, also deletes connected relationships
     * @returns Promise that resolves when deleted
     */
    deleteNode(id: string, detach?: boolean): Promise<void>;
    /**
     * Find nodes by label and properties
     *
     * @param label Node label
     * @param properties Properties to match
     * @param limit Maximum number of results
     * @returns Promise that resolves to matching nodes
     */
    findNodes(label: string, properties?: Record<string, unknown>, limit?: number): Promise<GraphNode[]>;
    /**
     * Create an edge (relationship) between two nodes
     *
     * @param edge Edge to create
     * @returns Promise that resolves to the created edge ID
     */
    createEdge(edge: GraphEdge): Promise<string>;
    /**
     * Delete an edge
     *
     * @param id Edge ID
     * @returns Promise that resolves when deleted
     */
    deleteEdge(id: string): Promise<void>;
    /**
     * Find edges by type and properties
     *
     * @param type Edge type
     * @param properties Properties to match
     * @param limit Maximum number of results
     * @returns Promise that resolves to matching edges
     */
    findEdges(type: string, properties?: Record<string, unknown>, limit?: number): Promise<GraphEdge[]>;
    /**
     * Execute a raw Cypher query
     *
     * @param query Query object or Cypher string
     * @param params Optional query parameters
     * @returns Promise that resolves to query results
     */
    query(query: GraphQuery | string, params?: Record<string, unknown>): Promise<GraphQueryResult>;
    /**
     * Traverse the graph from a starting node
     *
     * @param config Traversal configuration
     * @returns Promise that resolves to connected nodes
     */
    traverse(config: TraversalConfig): Promise<GraphNode[]>;
    /**
     * Find the shortest path between two nodes
     *
     * @param config Shortest path configuration
     * @returns Promise that resolves to the path, or null if no path exists
     */
    findPath(config: ShortestPathConfig): Promise<GraphPath | null>;
    /**
     * Execute multiple operations in a single transaction
     *
     * @param operations Array of operations to execute
     * @returns Promise that resolves when all operations complete
     */
    batchWrite(operations: GraphOperation[]): Promise<void>;
    /**
     * Count nodes in the database
     *
     * @param label Optional label to filter by
     * @returns Promise that resolves to the count
     */
    countNodes(label?: string): Promise<number>;
    /**
     * Count edges in the database
     *
     * @param type Optional type to filter by
     * @returns Promise that resolves to the count
     */
    countEdges(type?: string): Promise<number>;
    /**
     * Clear all data from the database
     *
     * WARNING: This deletes all nodes and relationships!
     *
     * @returns Promise that resolves when cleared
     */
    clearDatabase(): Promise<void>;
}
/**
 * Error thrown when graph database operations fail
 */
declare class GraphDatabaseError extends Error {
    readonly code?: string | undefined;
    readonly cause?: Error | undefined;
    constructor(message: string, code?: string | undefined, cause?: Error | undefined);
}
/**
 * Error thrown when connection to graph database fails
 */
declare class GraphConnectionError extends GraphDatabaseError {
    constructor(message: string, cause?: Error);
}
/**
 * Error thrown when graph database authentication fails
 *
 * This is a specific subclass of GraphConnectionError for auth failures,
 * allowing consumers to catch and handle authentication issues specifically.
 *
 * @example
 * ```typescript
 * try {
 *   await adapter.connect(config);
 * } catch (error) {
 *   if (error instanceof GraphAuthenticationError) {
 *     console.error("Check your NEO4J_PASSWORD in .env");
 *   }
 * }
 * ```
 */
declare class GraphAuthenticationError extends GraphConnectionError {
    readonly uri: string;
    readonly username: string;
    constructor(message: string, uri: string, username: string, cause?: Error);
}
/**
 * Error thrown when a graph query fails
 */
declare class GraphQueryError extends GraphDatabaseError {
    readonly query?: string | undefined;
    constructor(message: string, query?: string | undefined, cause?: Error);
}
/**
 * Error thrown when a node or edge is not found
 */
declare class GraphNotFoundError extends GraphDatabaseError {
    constructor(resourceType: "node" | "edge" | "path", identifier: string);
}

/**
 * Cortex SDK Resilience Types
 *
 * Type definitions for the overload protection system including:
 * - Token Bucket Rate Limiter
 * - Semaphore Concurrency Limiter
 * - Priority Queue
 * - Circuit Breaker
 */
/**
 * Request priority levels for queue ordering
 *
 * - critical: GDPR/security operations (never dropped)
 * - high: Real-time conversation storage
 * - normal: Standard reads/writes
 * - low: Bulk operations, exports
 * - background: Async sync, analytics
 */
type Priority = "critical" | "high" | "normal" | "low" | "background";
/**
 * Token Bucket Rate Limiter configuration
 */
interface RateLimiterConfig {
    /** Maximum burst capacity (tokens) - default: 100 */
    bucketSize?: number;
    /** Token refill rate per second - default: 50 */
    refillRate?: number;
}
/**
 * Semaphore Concurrency Limiter configuration
 */
interface ConcurrencyConfig {
    /** Maximum concurrent requests - default: 20 */
    maxConcurrent?: number;
    /** Maximum requests waiting in queue - default: 1000 */
    queueSize?: number;
    /** Maximum wait time for a permit (ms) - default: 30000 */
    timeout?: number;
}
/**
 * Semaphore permit returned when acquiring
 */
interface SemaphorePermit {
    /** Release the permit back to the semaphore */
    release: () => void;
}
/**
 * Circuit breaker states
 */
type CircuitState = "closed" | "open" | "half-open";
/**
 * Circuit Breaker configuration
 */
interface CircuitBreakerConfig {
    /** Number of failures before opening circuit - default: 5 */
    failureThreshold?: number;
    /** Number of successes in half-open to close circuit - default: 2 */
    successThreshold?: number;
    /** Time to wait in open state before half-open (ms) - default: 30000 */
    timeout?: number;
    /** Max test requests allowed in half-open state - default: 3 */
    halfOpenMax?: number;
}
/**
 * Priority Queue configuration
 */
interface QueueConfig {
    /** Maximum queue size per priority level */
    maxSize?: Partial<Record<Priority, number>>;
}
/**
 * A queued request waiting for execution
 */
interface QueuedRequest<T = unknown> {
    /** Unique request ID */
    id: string;
    /** The operation to execute */
    operation: () => Promise<T>;
    /** Request priority */
    priority: Priority;
    /** Operation name for logging/metrics */
    operationName: string;
    /** When the request was queued */
    queuedAt: number;
    /** Number of execution attempts */
    attempts: number;
    /** Promise resolve function */
    resolve: (value: T) => void;
    /** Promise reject function */
    reject: (error: Error) => void;
}
/**
 * Retry configuration for transient failure handling
 */
interface RetryConfig {
    /** Maximum number of retry attempts - default: 3 */
    maxRetries?: number;
    /** Base delay between retries in ms - default: 500 */
    baseDelayMs?: number;
    /** Maximum delay between retries in ms - default: 10000 */
    maxDelayMs?: number;
    /** Exponential backoff base - default: 2.0 */
    exponentialBase?: number;
    /** Add jitter to prevent thundering herd - default: true */
    jitter?: boolean;
}
/**
 * Main resilience layer configuration
 */
interface ResilienceConfig {
    /** Enable/disable resilience layer - default: true */
    enabled?: boolean;
    /** Token bucket rate limiter settings */
    rateLimiter?: RateLimiterConfig;
    /** Semaphore concurrency limiter settings */
    concurrency?: ConcurrencyConfig;
    /** Circuit breaker settings */
    circuitBreaker?: CircuitBreakerConfig;
    /** Priority queue settings */
    queue?: QueueConfig;
    /** Retry settings for transient failures */
    retry?: RetryConfig;
    /** Called when circuit breaker opens */
    onCircuitOpen?: (failures: number) => void;
    /** Called when circuit breaker closes */
    onCircuitClose?: () => void;
    /** Called when circuit breaker enters half-open state */
    onCircuitHalfOpen?: () => void;
    /** Called when a queue is full and request is dropped */
    onQueueFull?: (priority: Priority) => void;
    /** Called when request is throttled (waiting for rate limit) */
    onThrottle?: (waitTimeMs: number) => void;
    /** Called periodically with current metrics */
    onMetrics?: (metrics: ResilienceMetrics) => void;
    /** Called when a retry is about to be attempted */
    onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}
/**
 * Rate limiter metrics
 */
interface RateLimiterMetrics {
    /** Current available tokens */
    tokensAvailable: number;
    /** Total requests that had to wait */
    requestsThrottled: number;
    /** Average wait time for throttled requests (ms) */
    avgWaitTimeMs: number;
}
/**
 * Concurrency limiter metrics
 */
interface ConcurrencyMetrics {
    /** Currently executing requests */
    active: number;
    /** Requests waiting for a permit */
    waiting: number;
    /** Peak concurrent requests reached */
    maxReached: number;
    /** Requests that timed out waiting */
    timeouts: number;
}
/**
 * Circuit breaker metrics
 */
interface CircuitBreakerMetrics {
    /** Current circuit state */
    state: CircuitState;
    /** Consecutive failures count */
    failures: number;
    /** Last failure timestamp */
    lastFailureAt?: number;
    /** Last state change timestamp */
    lastStateChangeAt: number;
    /** Total times circuit has opened */
    totalOpens: number;
}
/**
 * Priority queue metrics
 */
interface QueueMetrics {
    /** Total requests in queue */
    total: number;
    /** Queue size by priority */
    byPriority: Record<Priority, number>;
    /** Total requests processed from queue */
    processed: number;
    /** Total requests dropped (queue full) */
    dropped: number;
    /** Oldest request age in queue (ms) */
    oldestRequestAgeMs?: number;
}
/**
 * Combined resilience metrics
 */
interface ResilienceMetrics {
    /** Rate limiter statistics */
    rateLimiter: RateLimiterMetrics;
    /** Concurrency limiter statistics */
    concurrency: ConcurrencyMetrics;
    /** Circuit breaker statistics */
    circuitBreaker: CircuitBreakerMetrics;
    /** Queue statistics */
    queue: QueueMetrics;
    /** Metrics collection timestamp */
    timestamp: number;
}
/**
 * Error thrown when circuit breaker is open
 */
declare class CircuitOpenError extends Error {
    readonly retryAfterMs?: number | undefined;
    constructor(message?: string, retryAfterMs?: number | undefined);
}
/**
 * Error thrown when queue is full
 */
declare class QueueFullError extends Error {
    readonly priority: Priority;
    readonly queueSize: number;
    constructor(priority: Priority, queueSize: number);
}
/**
 * Error thrown when semaphore acquire times out
 */
declare class AcquireTimeoutError extends Error {
    readonly timeoutMs: number;
    readonly waitingCount: number;
    constructor(timeoutMs: number, waitingCount: number);
}
/**
 * Error thrown when rate limit is exceeded and waiting is disabled
 */
declare class RateLimitExceededError extends Error {
    readonly tokensAvailable: number;
    readonly refillInMs: number;
    constructor(tokensAvailable: number, refillInMs: number);
}

/**
 * Token Bucket Rate Limiter
 *
 * Implements the classic token bucket algorithm to smooth burst traffic.
 * Tokens are consumed on each request and refill over time.
 *
 * Behavior:
 * - Bucket starts full (bucketSize tokens)
 * - Each request consumes 1 token
 * - Tokens refill at refillRate per second
 * - Burst traffic up to bucketSize passes immediately
 * - Sustained traffic is smoothed to refillRate
 */

declare class TokenBucket {
    private tokens;
    private lastRefill;
    private readonly bucketSize;
    private readonly refillRate;
    private requestsThrottled;
    private totalWaitTimeMs;
    constructor(config?: RateLimiterConfig);
    /**
     * Refill tokens based on time elapsed since last refill
     */
    private refill;
    /**
     * Try to acquire a token without waiting
     *
     * @returns true if token was acquired, false if bucket is empty
     */
    tryAcquire(): boolean;
    /**
     * Acquire a token, waiting if necessary
     *
     * @param timeout Maximum time to wait (ms). If not provided, waits indefinitely.
     * @throws RateLimitExceededError if timeout is reached
     */
    acquire(timeout?: number): Promise<void>;
    /**
     * Get the number of tokens currently available
     */
    getAvailableTokens(): number;
    /**
     * Get time until next token is available (ms)
     */
    getTimeUntilNextToken(): number;
    /**
     * Get current metrics
     */
    getMetrics(): RateLimiterMetrics;
    /**
     * Reset the bucket to full and clear metrics
     */
    reset(): void;
    /**
     * Sleep utility
     */
    private sleep;
}

/**
 * Async Semaphore Concurrency Limiter
 *
 * Limits the number of concurrent in-flight requests using a semaphore pattern.
 * Requests beyond the limit wait in a queue until a permit becomes available.
 *
 * Behavior:
 * - maxConcurrent permits available at any time
 * - Requests acquire a permit before executing, release after
 * - Excess requests wait in a queue (up to queueSize)
 * - Optional timeout prevents indefinite waiting
 */

declare class Semaphore {
    private availablePermits;
    private readonly maxPermits;
    private readonly queueLimit;
    private readonly defaultTimeout;
    private waiting;
    private maxReached;
    private timeouts;
    constructor(config?: ConcurrencyConfig);
    /**
     * Acquire a permit, waiting if necessary
     *
     * @param timeout Maximum time to wait (ms). Uses default if not provided.
     * @returns A permit that must be released when done
     * @throws AcquireTimeoutError if timeout is reached
     * @throws Error if queue is full
     */
    acquire(timeout?: number): Promise<SemaphorePermit>;
    /**
     * Try to acquire a permit without waiting
     *
     * @returns A permit if available, undefined otherwise
     */
    tryAcquire(): SemaphorePermit | undefined;
    /**
     * Create a permit object with release function
     */
    private createPermit;
    /**
     * Release a permit back to the semaphore
     * (Called internally by permit.release())
     */
    private release;
    /**
     * Update max concurrent reached metric
     */
    private updateMaxReached;
    /**
     * Get number of currently active (acquired) permits
     */
    getActiveCount(): number;
    /**
     * Get number of requests waiting for a permit
     */
    getWaitingCount(): number;
    /**
     * Get available permits
     */
    getAvailableCount(): number;
    /**
     * Get current metrics
     */
    getMetrics(): ConcurrencyMetrics;
    /**
     * Reset semaphore to initial state
     * WARNING: This will reject all waiting requests
     */
    reset(): void;
}

/**
 * Priority Queue
 *
 * In-memory queue that orders requests by priority level.
 * Higher priority requests are processed before lower priority ones.
 *
 * Features:
 * - Separate queues per priority level
 * - Configurable max size per priority
 * - Starvation prevention (optional aging)
 * - FIFO within same priority level
 */

declare class PriorityQueue<T = unknown> {
    private queues;
    private limits;
    private processed;
    private dropped;
    constructor(config?: QueueConfig);
    /**
     * Add a request to the queue
     *
     * @param request The request to queue
     * @returns true if queued, false if queue was full
     * @throws QueueFullError if queue is full for the given priority
     */
    enqueue(request: QueuedRequest<T>): boolean;
    /**
     * Try to add a request without throwing
     *
     * @param request The request to queue
     * @returns true if queued, false if queue was full
     */
    tryEnqueue(request: QueuedRequest<T>): boolean;
    /**
     * Remove and return the highest priority request
     *
     * @returns The next request to process, or undefined if queue is empty
     */
    dequeue(): QueuedRequest<T> | undefined;
    /**
     * Peek at the highest priority request without removing it
     *
     * @returns The next request that would be dequeued, or undefined if empty
     */
    peek(): QueuedRequest<T> | undefined;
    /**
     * Get total number of queued requests
     */
    size(): number;
    /**
     * Get queue size broken down by priority
     */
    sizeByPriority(): Record<Priority, number>;
    /**
     * Check if the queue is empty
     */
    isEmpty(): boolean;
    /**
     * Check if a specific priority queue has capacity
     */
    hasCapacity(priority: Priority): boolean;
    /**
     * Get the age of the oldest request in the queue (ms)
     */
    getOldestRequestAge(): number | undefined;
    /**
     * Remove all expired requests (older than maxAge)
     *
     * @param maxAgeMs Maximum age in milliseconds
     * @returns Number of requests removed
     */
    removeExpired(maxAgeMs: number): number;
    /**
     * Cancel a specific request by ID
     *
     * @param requestId The request ID to cancel
     * @returns true if found and cancelled, false otherwise
     */
    cancel(requestId: string): boolean;
    /**
     * Get current metrics
     */
    getMetrics(): QueueMetrics;
    /**
     * Clear all queues and reject all pending requests
     */
    clear(): void;
    /**
     * Reset metrics (but keep queued requests)
     */
    resetMetrics(): void;
}

/**
 * Circuit Breaker
 *
 * Implements the circuit breaker pattern to prevent cascading failures.
 * When too many failures occur, the circuit "opens" and fails fast.
 *
 * States:
 * - CLOSED: Normal operation, counting failures
 * - OPEN: All requests fail immediately, waiting for timeout
 * - HALF-OPEN: Testing with limited requests to see if system recovered
 *
 * Behavior:
 * - Starts in CLOSED state
 * - Opens after failureThreshold consecutive failures
 * - Waits timeout ms in OPEN state, then transitions to HALF-OPEN
 * - In HALF-OPEN, allows halfOpenMax test requests
 * - If successThreshold successes in HALF-OPEN, transitions to CLOSED
 * - Any failure in HALF-OPEN transitions back to OPEN
 */

declare class CircuitBreaker {
    private state;
    private failures;
    private successes;
    private halfOpenAttempts;
    private lastFailureAt?;
    private lastStateChangeAt;
    private openedAt?;
    private readonly failureThreshold;
    private readonly successThreshold;
    private readonly timeout;
    private readonly halfOpenMax;
    private totalOpens;
    private onOpen?;
    private onClose?;
    private onHalfOpen?;
    constructor(config?: CircuitBreakerConfig, callbacks?: {
        onOpen?: (failures: number) => void;
        onClose?: () => void;
        onHalfOpen?: () => void;
    });
    /**
     * Check if circuit is currently open (not accepting requests)
     */
    isOpen(): boolean;
    /**
     * Check if circuit allows execution
     */
    allowsExecution(): boolean;
    /**
     * Execute a function through the circuit breaker
     *
     * @param fn The function to execute
     * @returns The result of the function
     * @throws CircuitOpenError if circuit is open
     */
    execute<T>(fn: () => Promise<T>): Promise<T>;
    /**
     * Record a successful execution
     */
    recordSuccess(): void;
    /**
     * Record a failed execution
     */
    recordFailure(_error: Error): void;
    /**
     * Get current circuit state
     */
    getState(): CircuitState;
    /**
     * Get time until circuit might close (ms)
     * Returns 0 if circuit is closed
     */
    getTimeUntilClose(): number;
    /**
     * Get current metrics
     */
    getMetrics(): CircuitBreakerMetrics;
    /**
     * Manually reset circuit to closed state
     */
    reset(): void;
    /**
     * Force circuit to open state (for testing/maintenance)
     */
    forceOpen(): void;
    /**
     * Force circuit to closed state (for testing/recovery)
     */
    forceClose(): void;
    /**
     * Transition to a new state
     */
    private transitionTo;
}

/**
 * Operation Priority Mapping
 *
 * Automatically assigns priority levels to SDK operations based on their
 * importance and latency requirements.
 *
 * Priority Levels:
 * - critical: GDPR/security operations that must not be delayed
 * - high: Real-time conversation operations for responsive UX
 * - normal: Standard reads/writes with reasonable latency tolerance
 * - low: Bulk operations that can tolerate delays
 * - background: Async operations that run when resources are available
 */

/**
 * Operation name to priority mapping
 *
 * Uses pattern matching with wildcards:
 * - Exact match: "memory:remember" → specific operation
 * - Wildcard suffix: "graphSync:*" → all graphSync operations
 */
declare const OPERATION_PRIORITIES: Record<string, Priority>;
/**
 * Get priority for an operation name
 *
 * Supports exact matches and wildcard patterns (e.g., "graphSync:*")
 *
 * @param operationName - The operation name (e.g., "memory:remember")
 * @returns The priority level for the operation
 */
declare function getPriority(operationName: string): Priority;
/**
 * Check if an operation is critical (should never be dropped)
 */
declare function isCritical(operationName: string): boolean;

/**
 * Cortex SDK Resilience Layer
 *
 * Main entry point for the overload protection system.
 * Provides a unified interface that combines:
 * - Token Bucket Rate Limiter (Layer 1)
 * - Semaphore Concurrency Limiter (Layer 2)
 * - Priority Queue (Layer 3)
 * - Circuit Breaker (Layer 4)
 *
 * Usage:
 * ```typescript
 * const resilience = new ResilienceLayer(ResiliencePresets.default);
 *
 * // Execute an operation through all layers
 * const result = await resilience.execute(
 *   () => convexClient.mutation(...),
 *   'memory:remember'
 * );
 * ```
 */

/**
 * Pre-configured resilience settings for common use cases.
 *
 * Based on Convex platform limits:
 * @see https://docs.convex.dev/production/state/limits
 *
 * Free/Starter Plan:
 *   - Concurrent queries: 16
 *   - Concurrent mutations: 16
 *   - Concurrent actions: 64
 *   - Function calls: 1M/month
 *
 * Professional Plan:
 *   - Concurrent queries: 256
 *   - Concurrent mutations: 256
 *   - Concurrent actions: 256-1000
 *   - Function calls: 25M/month
 */
declare const ResiliencePresets: {
    /**
     * Default configuration for Convex Free/Starter plan
     *
     * Respects Convex's 16 concurrent query/mutation limit.
     * Good for most single-agent use cases.
     * Includes automatic retry (3 attempts) for transient failures.
     */
    default: ResilienceConfig;
    /**
     * Real-time agent configuration for Convex Free/Starter plan
     *
     * Optimized for low latency conversation storage.
     * Uses conservative limits to ensure fast response times.
     */
    realTimeAgent: ResilienceConfig;
    /**
     * Batch processing configuration for Convex Professional plan
     *
     * High throughput for bulk operations.
     * ⚠️ Requires Professional plan (256 concurrent limit)
     */
    batchProcessing: ResilienceConfig;
    /**
     * Hive Mode configuration for Convex Professional plan
     *
     * Extreme concurrency for multi-agent swarms sharing one database.
     * ⚠️ Requires Professional plan with increased limits.
     * Contact Convex support for limits beyond default Professional tier.
     */
    hiveMode: ResilienceConfig;
    /**
     * Disabled configuration
     *
     * Bypasses all resilience mechanisms.
     * ⚠️ Not recommended for production - may hit Convex rate limits.
     */
    disabled: ResilienceConfig;
};
/**
 * Convex plan tier type
 */
type ConvexPlanTier = "free" | "starter" | "professional";
/**
 * Get the appropriate resilience preset based on Convex plan tier.
 *
 * Reads from CONVEX_PLAN environment variable if not specified.
 * Defaults to 'free' plan limits for safety.
 *
 * @param plan Optional plan tier override. If not provided, reads from CONVEX_PLAN env var.
 * @returns The appropriate ResilienceConfig for the plan tier
 *
 * @example
 * ```typescript
 * // Auto-detect from CONVEX_PLAN env var
 * const config = getPresetForPlan();
 *
 * // Explicit plan tier
 * const proConfig = getPresetForPlan('professional');
 *
 * // Use with ResilienceLayer
 * const resilience = new ResilienceLayer(getPresetForPlan());
 * ```
 */
declare function getPresetForPlan(plan?: ConvexPlanTier): ResilienceConfig;
/**
 * Main resilience layer that orchestrates all protection mechanisms
 */
declare class ResilienceLayer {
    private readonly enabled;
    private readonly tokenBucket;
    private readonly semaphore;
    private readonly queue;
    private readonly circuitBreaker;
    private readonly config;
    private isProcessingQueue;
    private queueProcessorInterval?;
    private requestCounter;
    constructor(config?: ResilienceConfig);
    /**
     * Execute an operation through all resilience layers with automatic retry
     * for transient failures (timeouts, rate limits, server errors).
     *
     * @param operation The async operation to execute
     * @param operationName Operation identifier for priority mapping
     * @returns The result of the operation
     */
    execute<T>(operation: () => Promise<T>, operationName: string): Promise<T>;
    /**
     * Execute a single attempt through rate limiting, concurrency, and circuit breaker
     */
    private _executeSingleAttempt;
    /**
     * Execute with automatic retry on transient failures
     *
     * @param operation The operation to execute
     * @param operationName Operation identifier
     * @param maxRetries Maximum retry attempts
     * @param retryDelayMs Delay between retries (ms)
     */
    executeWithRetry<T>(operation: () => Promise<T>, operationName: string, maxRetries?: number, retryDelayMs?: number): Promise<T>;
    /**
     * Enqueue an operation and wait for execution
     */
    private enqueueAndWait;
    /**
     * Process queued requests
     */
    private processQueueBatch;
    /**
     * Execute a queued request
     */
    private executeQueuedRequest;
    /**
     * Start background queue processor
     */
    private startQueueProcessor;
    /**
     * Stop background queue processor
     */
    stopQueueProcessor(): void;
    /**
     * Get current metrics from all layers
     */
    getMetrics(): ResilienceMetrics;
    /**
     * Check if the system is healthy
     */
    isHealthy(): boolean;
    /**
     * Check if the system is accepting requests
     */
    isAcceptingRequests(): boolean;
    /**
     * Reset all layers to initial state
     */
    reset(): void;
    /**
     * Graceful shutdown - wait for pending operations
     *
     * @param timeoutMs Maximum time to wait for pending operations
     */
    shutdown(timeoutMs?: number): Promise<void>;
    /**
     * Sleep utility
     */
    private sleep;
}

/**
 * Cortex SDK - Conversations API
 *
 * Layer 1a: ACID-compliant immutable conversation storage
 */

declare class ConversationsAPI {
    private readonly client;
    private readonly graphAdapter?;
    private readonly resilience?;
    private readonly authContext?;
    constructor(client: ConvexClient, graphAdapter?: GraphAdapter | undefined, resilience?: ResilienceLayer | undefined, authContext?: AuthContext | undefined);
    /**
     * Execute an operation through the resilience layer (if available)
     */
    private executeWithResilience;
    /**
     * Handle ConvexError from direct Convex calls (queries that don't go through resilience)
     * Extracts error.data and includes it in the thrown error message
     */
    private handleConvexError;
    /**
     * Create a new conversation
     *
     * @example
     * ```typescript
     * const conversation = await cortex.conversations.create({
     *   memorySpaceId: 'user-123-personal',
     *   type: 'user-agent',
     *   participants: {
     *     userId: 'user-123',
     *     participantId: 'my-bot',
     *   },
     * });
     * ```
     */
    create(input: CreateConversationInput, _options?: CreateConversationOptions): Promise<Conversation>;
    /**
     * Get a conversation by ID
     *
     * @example
     * ```typescript
     * const conversation = await cortex.conversations.get('conv-abc123');
     *
     * // With options
     * const convNoMessages = await cortex.conversations.get('conv-abc123', {
     *   includeMessages: false,
     * });
     *
     * // Limit messages returned
     * const convLimited = await cortex.conversations.get('conv-abc123', {
     *   messageLimit: 10,
     * });
     * ```
     */
    get(conversationId: string, options?: GetConversationOptions): Promise<Conversation | null>;
    /**
     * Add a message to a conversation
     *
     * @example
     * ```typescript
     * await cortex.conversations.addMessage({
     *   conversationId: 'conv-abc123',
     *   message: {
     *     role: 'user',
     *     content: 'Hello!',
     *   },
     * });
     * ```
     */
    addMessage(input: AddMessageInput, _options?: AddMessageOptions): Promise<Conversation>;
    /**
     * List conversations with optional filters and pagination
     *
     * @example
     * ```typescript
     * const result = await cortex.conversations.list({
     *   userId: 'user-123',
     *   limit: 10,
     * });
     * console.log(`Found ${result.total} conversations`);
     *
     * // With pagination and sorting
     * const page2 = await cortex.conversations.list({
     *   memorySpaceId: 'space-123',
     *   offset: 10,
     *   limit: 10,
     *   sortBy: 'lastMessageAt',
     *   sortOrder: 'desc',
     * });
     *
     * // Filter by date range
     * const recent = await cortex.conversations.list({
     *   createdAfter: Date.now() - 7 * 24 * 60 * 60 * 1000, // Last week
     * });
     * ```
     */
    list(filter?: ListConversationsFilter): Promise<ListConversationsResult>;
    /**
     * Count conversations
     *
     * @example
     * ```typescript
     * const count = await cortex.conversations.count({
     *   memorySpaceId: 'user-123-personal',
     * });
     * ```
     */
    count(filter?: CountConversationsFilter): Promise<number>;
    /**
     * Delete a conversation (for GDPR/cleanup)
     *
     * @example
     * ```typescript
     * const result = await cortex.conversations.delete('conv-abc123');
     * console.log(`Deleted ${result.messagesDeleted} messages`);
     * console.log(`Restorable: ${result.restorable}`); // false - permanent!
     * ```
     */
    delete(conversationId: string, _options?: DeleteConversationOptions): Promise<ConversationDeletionResult>;
    /**
     * Delete many conversations matching filters
     *
     * @example
     * ```typescript
     * // Preview what would be deleted (dryRun)
     * const preview = await cortex.conversations.deleteMany(
     *   { userId: 'user-123' },
     *   { dryRun: true }
     * );
     * console.log(`Would delete ${preview.wouldDelete} conversations`);
     *
     * // Execute deletion
     * const result = await cortex.conversations.deleteMany({
     *   memorySpaceId: 'user-123-personal',
     *   userId: 'user-123',
     *   type: 'user-agent',
     * });
     * console.log(`Deleted ${result.deleted} conversations`);
     * ```
     */
    deleteMany(filter: {
        userId?: string;
        memorySpaceId?: string;
        type?: "user-agent" | "agent-agent";
    }, options?: DeleteManyConversationsOptions): Promise<DeleteManyConversationsResult>;
    /**
     * Get a specific message by ID
     *
     * @example
     * ```typescript
     * const message = await cortex.conversations.getMessage('conv-123', 'msg-456');
     * ```
     */
    getMessage(conversationId: string, messageId: string): Promise<Message | null>;
    /**
     * Get multiple messages by their IDs
     *
     * @example
     * ```typescript
     * const messages = await cortex.conversations.getMessagesByIds('conv-123', ['msg-1', 'msg-2']);
     * ```
     */
    getMessagesByIds(conversationId: string, messageIds: string[]): Promise<Message[]>;
    /**
     * Find an existing conversation by participants
     *
     * @example
     * ```typescript
     * const existing = await cortex.conversations.findConversation({
     *   memorySpaceId: 'user-123-personal',
     *   type: 'user-agent',
     *   userId: 'user-123',
     * });
     * ```
     */
    findConversation(params: {
        memorySpaceId: string;
        type: "user-agent" | "agent-agent";
        userId?: string;
        memorySpaceIds?: string[];
    }): Promise<Conversation | null>;
    /**
     * Get or create a conversation (atomic)
     *
     * @example
     * ```typescript
     * const conversation = await cortex.conversations.getOrCreate({
     *   memorySpaceId: 'user-123-personal',
     *   type: 'user-agent',
     *   participants: { userId: 'user-123', participantId: 'my-bot' },
     * });
     * ```
     */
    getOrCreate(input: CreateConversationInput): Promise<Conversation>;
    /**
     * Get paginated message history from a conversation
     *
     * @example
     * ```typescript
     * const history = await cortex.conversations.getHistory('conv-abc123', {
     *   limit: 20,
     *   offset: 0,
     *   sortOrder: 'desc',
     * });
     *
     * // Filter by date range
     * const recent = await cortex.conversations.getHistory('conv-abc123', {
     *   since: Date.now() - 24 * 60 * 60 * 1000, // Last 24 hours
     * });
     *
     * // Filter by roles
     * const userMessages = await cortex.conversations.getHistory('conv-abc123', {
     *   roles: ['user'],
     * });
     * ```
     */
    getHistory(conversationId: string, options?: GetHistoryOptions): Promise<{
        messages: Message[];
        total: number;
        hasMore: boolean;
        conversationId: string;
    }>;
    /**
     * Search conversations by text query
     *
     * @example
     * ```typescript
     * const results = await cortex.conversations.search({
     *   query: 'password',
     *   filters: {
     *     userId: 'user-123',
     *     limit: 5,
     *   },
     * });
     *
     * // Search with options
     * const fuzzyResults = await cortex.conversations.search({
     *   query: 'account balance',
     *   options: {
     *     searchIn: 'both', // Search content and metadata
     *     matchMode: 'fuzzy',
     *   },
     * });
     * ```
     */
    search(input: SearchConversationsInput): Promise<ConversationSearchResult[]>;
    /**
     * Export conversations to JSON or CSV
     *
     * @example
     * ```typescript
     * const exported = await cortex.conversations.export({
     *   filters: { memorySpaceId: 'user-123-personal', userId: 'user-123' },
     *   format: 'json',
     *   includeMetadata: true,
     * });
     * ```
     */
    export(options: ExportConversationsOptions): Promise<ExportResult>;
    /**
     * Check if a user has access to a conversation based on visibility
     *
     * This is a quick, cheap method to check access rights without fetching
     * the full conversation data. Use this for access control checks.
     *
     * @example
     * ```typescript
     * const access = await cortex.conversations.checkAccess({
     *   conversationId: 'conv-abc123',
     *   userId: 'user-456',
     * });
     *
     * if (access.canView) {
     *   // User can access the conversation
     * }
     * ```
     */
    checkAccess(input: CheckAccessInput): Promise<CheckAccessResult>;
    /**
     * Set the visibility of a conversation
     *
     * Only the owner (participants.userId) can change visibility.
     *
     * @example
     * ```typescript
     * // Make a conversation public
     * const updated = await cortex.conversations.setVisibility({
     *   conversationId: 'conv-abc123',
     *   visibility: 'public',
     * });
     *
     * // Make it space-visible
     * await cortex.conversations.setVisibility({
     *   conversationId: 'conv-abc123',
     *   visibility: 'space',
     * });
     * ```
     */
    setVisibility(input: SetVisibilityInput): Promise<Conversation>;
    /**
     * Create a share for a conversation
     *
     * Creates a shareable link or grant for accessing a conversation.
     * Returns the share ID which can be used with `buildShareUrl()` to create URLs.
     *
     * @example
     * ```typescript
     * import { buildShareUrl } from '@cortex/sdk';
     *
     * // Create a public link share
     * const result = await cortex.conversations.share({
     *   conversationId: 'conv-abc123',
     *   grantType: 'link',
     *   permissions: { canView: true, canFork: true },
     *   expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
     * });
     *
     * // Build the URL
     * const url = buildShareUrl(result.shareId, {
     *   baseUrl: 'https://myapp.com/shared'
     * });
     * ```
     */
    share(input: CreateShareInput): Promise<CreateShareResult>;
    /**
     * Revoke an existing share
     *
     * @example
     * ```typescript
     * const result = await cortex.conversations.revokeShare('share-abc123');
     * console.log(`Revoked at: ${result.revokedAt}`);
     * ```
     */
    revokeShare(shareId: string): Promise<RevokeShareResult>;
    /**
     * List shares for a conversation
     *
     * @example
     * ```typescript
     * // List all active shares
     * const shares = await cortex.conversations.listShares('conv-abc123', {
     *   status: 'active',
     * });
     * ```
     */
    listShares(conversationId: string, filter?: {
        status?: ShareStatus;
    }): Promise<ConversationShare[]>;
    /**
     * Get a share by its ID
     *
     * Also validates whether the share is still active and within limits.
     *
     * @example
     * ```typescript
     * const share = await cortex.conversations.getShare('share-abc123');
     * if (share?.isValid) {
     *   // Share is valid and can be used
     * }
     * ```
     */
    getShare(shareId: string): Promise<ConversationShare | null>;
    /**
     * Check if a user/space has access to a conversation via share
     *
     * @example
     * ```typescript
     * const access = await cortex.conversations.checkShareAccess({
     *   conversationId: 'conv-abc123',
     *   userId: 'user-456',
     * });
     *
     * if (access.hasAccess) {
     *   console.log('Permissions:', access.permissions);
     * }
     * ```
     */
    checkShareAccess(input: {
        conversationId: string;
        userId?: string;
        memorySpaceId?: string;
        emailDomain?: string;
    }): Promise<CheckShareAccessResult>;
    /**
     * Create a snapshot of a conversation
     *
     * Creates an immutable point-in-time copy of a conversation with optional
     * PII redaction. Useful for sharing or archiving conversations.
     *
     * @example
     * ```typescript
     * const result = await cortex.conversations.snapshot({
     *   conversationId: 'conv-abc123',
     *   redactPII: true,
     * });
     * console.log(result.snapshotId);
     * ```
     */
    snapshot(input: CreateSnapshotInput): Promise<CreateSnapshotResult>;
    /**
     * Get a snapshot by ID
     */
    getSnapshot(snapshotId: string): Promise<ConversationSnapshot | null>;
    /**
     * List snapshots for a conversation
     */
    listSnapshots(conversationId: string, options?: {
        includeArchived?: boolean;
    }): Promise<ConversationSnapshot[]>;
    /**
     * Delete a snapshot
     */
    deleteSnapshot(snapshotId: string): Promise<{
        deleted: boolean;
    }>;
    /**
     * Approve a pending message in a collaborative conversation
     *
     * Only the conversation owner can approve messages.
     *
     * @example
     * ```typescript
     * await cortex.conversations.approveMessage({
     *   conversationId: 'conv-abc123',
     *   messageId: 'msg-456',
     * });
     * ```
     */
    approveMessage(input: ApproveMessageInput): Promise<Conversation>;
    /**
     * Reject a pending message in a collaborative conversation
     *
     * Only the conversation owner can reject messages.
     *
     * @example
     * ```typescript
     * await cortex.conversations.rejectMessage({
     *   conversationId: 'conv-abc123',
     *   messageId: 'msg-456',
     * });
     * ```
     */
    rejectMessage(input: ApproveMessageInput): Promise<Conversation>;
    private generateConversationId;
    private generateMessageId;
    private generateId;
}

/**
 * Cortex SDK - Immutable Store API
 *
 * Layer 1b: ACID-compliant versioned immutable storage for shared data
 */

declare class ImmutableAPI {
    private readonly client;
    private readonly graphAdapter?;
    private readonly resilience?;
    private readonly authContext?;
    constructor(client: ConvexClient, graphAdapter?: GraphAdapter | undefined, resilience?: ResilienceLayer | undefined, authContext?: AuthContext | undefined);
    /**
     * Execute an operation through the resilience layer (if available)
     */
    private executeWithResilience;
    /**
     * Handle ConvexError from direct Convex calls
     */
    private handleConvexError;
    /**
     * Store immutable data (creates v1 or increments version if exists)
     *
     * @example
     * ```typescript
     * const record = await cortex.immutable.store({
     *   type: 'kb-article',
     *   id: 'refund-policy',
     *   data: {
     *     title: 'Refund Policy',
     *     content: 'Refunds available within 30 days...',
     *   },
     * });
     * ```
     */
    store(entry: ImmutableEntry, _options?: StoreImmutableOptions): Promise<ImmutableRecord>;
    /**
     * Get current version of an immutable entry
     *
     * @example
     * ```typescript
     * const article = await cortex.immutable.get('kb-article', 'refund-policy');
     * ```
     */
    get(type: string, id: string): Promise<ImmutableRecord | null>;
    /**
     * Get a specific version of an immutable entry
     *
     * @example
     * ```typescript
     * const v1 = await cortex.immutable.getVersion('kb-article', 'refund-policy', 1);
     * ```
     */
    getVersion(type: string, id: string, version: number): Promise<ImmutableVersionExpanded | null>;
    /**
     * Get all versions of an immutable entry
     *
     * @example
     * ```typescript
     * const history = await cortex.immutable.getHistory('kb-article', 'refund-policy');
     * console.log(`${history.length} versions`);
     * ```
     */
    getHistory(type: string, id: string): Promise<ImmutableVersionExpanded[]>;
    /**
     * List immutable entries with optional filters
     *
     * @example
     * ```typescript
     * const articles = await cortex.immutable.list({
     *   type: 'kb-article',
     *   limit: 10,
     * });
     * ```
     */
    list(filter?: ListImmutableFilter): Promise<ImmutableRecord[]>;
    /**
     * Search immutable entries by text query
     *
     * @example
     * ```typescript
     * const results = await cortex.immutable.search({
     *   query: 'refund',
     *   type: 'kb-article',
     * });
     * ```
     */
    search(input: SearchImmutableInput): Promise<ImmutableSearchResult[]>;
    /**
     * Count immutable entries
     *
     * @example
     * ```typescript
     * const count = await cortex.immutable.count({
     *   type: 'kb-article',
     * });
     * ```
     */
    count(filter?: CountImmutableFilter): Promise<number>;
    /**
     * Delete (purge) an immutable entry and all its versions
     *
     * @example
     * ```typescript
     * await cortex.immutable.purge('feedback', 'feedback-123');
     * ```
     */
    purge(type: string, id: string): Promise<{
        deleted: boolean;
        type: string;
        id: string;
        versionsDeleted: number;
    }>;
    /**
     * Get version that was current at specific timestamp
     *
     * @example
     * ```typescript
     * const policy = await cortex.immutable.getAtTimestamp(
     *   'policy',
     *   'refund-policy',
     *   Date.parse('2025-01-01')
     * );
     * ```
     */
    getAtTimestamp(type: string, id: string, timestamp: number | Date): Promise<ImmutableVersionExpanded | null>;
    /**
     * Bulk delete immutable entries matching filters
     *
     * @example
     * ```typescript
     * const result = await cortex.immutable.purgeMany({ type: 'old-data', userId: 'user-123' });
     * ```
     */
    purgeMany(filter: {
        type?: string;
        userId?: string;
    }): Promise<{
        deleted: number;
        totalVersionsDeleted: number;
        entries: Array<{
            type: string;
            id: string;
        }>;
    }>;
    /**
     * Delete old versions while keeping recent ones
     *
     * @example
     * ```typescript
     * await cortex.immutable.purgeVersions('kb-article', 'guide-123', 20); // Keep latest 20
     * ```
     */
    purgeVersions(type: string, id: string, keepLatest: number): Promise<{
        versionsPurged: number;
        versionsRemaining: number;
    }>;
}

/**
 * Cortex SDK - Mutable Store API
 *
 * Layer 1c: ACID-compliant mutable storage for live data
 */

declare class MutableAPI {
    private readonly client;
    private readonly graphAdapter?;
    private readonly resilience?;
    private readonly authContext?;
    constructor(client: ConvexClient, graphAdapter?: GraphAdapter | undefined, resilience?: ResilienceLayer | undefined, authContext?: AuthContext | undefined);
    /**
     * Execute an operation through the resilience layer (if available)
     */
    private executeWithResilience;
    /**
     * Handle ConvexError from direct Convex calls
     */
    private handleConvexError;
    /**
     * Set a key to a value (creates or overwrites)
     *
     * @example
     * ```typescript
     * await cortex.mutable.set('inventory', 'widget-qty', 100);
     * ```
     */
    set(namespace: string, key: string, value: unknown, userId?: string, metadata?: Record<string, unknown>, _options?: SetMutableOptions): Promise<MutableRecord>;
    /**
     * Get current value for a key
     *
     * @example
     * ```typescript
     * const qty = await cortex.mutable.get('inventory', 'widget-qty');
     * ```
     */
    get(namespace: string, key: string): Promise<unknown | null>;
    /**
     * Get full record (including metadata)
     *
     * @example
     * ```typescript
     * const record = await cortex.mutable.getRecord('inventory', 'widget-qty');
     * console.log(record.updatedAt);
     * ```
     */
    getRecord(namespace: string, key: string): Promise<MutableRecord | null>;
    /**
     * Atomic update using updater function
     *
     * @example
     * ```typescript
     * await cortex.mutable.update('inventory', 'widget-qty', (qty) => qty - 10);
     * ```
     */
    update<T = unknown>(namespace: string, key: string, updater: (current: T) => T): Promise<MutableRecord>;
    /**
     * Increment a numeric value
     *
     * @example
     * ```typescript
     * await cortex.mutable.increment('counters', 'total-sales', 1);
     * ```
     */
    increment(namespace: string, key: string, amount?: number): Promise<MutableRecord>;
    /**
     * Decrement a numeric value
     *
     * @example
     * ```typescript
     * await cortex.mutable.decrement('inventory', 'widget-qty', 10);
     * ```
     */
    decrement(namespace: string, key: string, amount?: number): Promise<MutableRecord>;
    /**
     * Check if key exists
     *
     * @example
     * ```typescript
     * if (await cortex.mutable.exists('inventory', 'widget-qty')) { ... }
     * ```
     */
    exists(namespace: string, key: string): Promise<boolean>;
    /**
     * List keys in namespace
     *
     * @param filter - Filter options for listing keys
     * @param filter.namespace - Required namespace to list
     * @param filter.keyPrefix - Filter by key prefix
     * @param filter.userId - Filter by user
     * @param filter.limit - Max results (default: 100)
     * @param filter.offset - Pagination offset
     * @param filter.updatedAfter - Filter by updatedAt > timestamp
     * @param filter.updatedBefore - Filter by updatedAt < timestamp
     * @param filter.sortBy - Sort by "key" | "updatedAt" | "accessCount"
     * @param filter.sortOrder - Sort order "asc" | "desc"
     * @returns Array of matching MutableRecord objects
     *
     * @example
     * ```typescript
     * const items = await cortex.mutable.list({
     *   namespace: 'inventory',
     *   keyPrefix: 'widget-',
     *   sortBy: 'updatedAt',
     *   sortOrder: 'desc',
     *   limit: 50,
     * });
     * ```
     */
    list(filter: ListMutableFilter): Promise<MutableRecord[]>;
    /**
     * Count keys in namespace
     *
     * @param filter - Filter options for counting keys
     * @param filter.namespace - Required namespace to count
     * @param filter.userId - Filter by user
     * @param filter.keyPrefix - Filter by key prefix
     * @param filter.updatedAfter - Filter by updatedAt > timestamp
     * @param filter.updatedBefore - Filter by updatedAt < timestamp
     * @returns Count of matching keys
     *
     * @example
     * ```typescript
     * const count = await cortex.mutable.count({
     *   namespace: 'inventory',
     *   updatedAfter: Date.now() - 24 * 60 * 60 * 1000, // Last 24 hours
     * });
     * ```
     */
    count(filter: CountMutableFilter): Promise<number>;
    /**
     * Delete a key
     *
     * @example
     * ```typescript
     * await cortex.mutable.delete('inventory', 'discontinued-item');
     * ```
     */
    delete(namespace: string, key: string, _options?: DeleteMutableOptions): Promise<{
        deleted: boolean;
        namespace: string;
        key: string;
    }>;
    /**
     * Purge a key (alias for delete - for API consistency)
     *
     * @example
     * ```typescript
     * await cortex.mutable.purge('inventory', 'discontinued-item');
     * ```
     */
    purge(namespace: string, key: string): Promise<{
        deleted: boolean;
        namespace: string;
        key: string;
    }>;
    /**
     * Purge all keys in a namespace
     *
     * @param namespace - Namespace to purge
     * @param options - Optional settings
     * @param options.dryRun - If true, returns what would be deleted without deleting
     * @param options.tenantId - Override tenant ID (defaults to authContext.tenantId)
     * @returns Result with deleted count, namespace, and optionally keys (in dryRun mode)
     *
     * @example
     * ```typescript
     * // Preview what would be deleted
     * const preview = await cortex.mutable.purgeNamespace('temp-cache', { dryRun: true });
     * console.log(`Would delete ${preview.deleted} keys`);
     *
     * // Actually delete
     * const result = await cortex.mutable.purgeNamespace('temp-cache');
     * console.log(`Deleted ${result.deleted} keys`);
     * ```
     */
    purgeNamespace(namespace: string, options?: PurgeNamespaceOptions): Promise<{
        deleted: number;
        namespace: string;
        keys?: string[];
        dryRun: boolean;
    }>;
    /**
     * Execute multiple operations atomically
     *
     * @example
     * ```typescript
     * await cortex.mutable.transaction([
     *   { op: 'increment', namespace: 'counters', key: 'sales', amount: 1 },
     *   { op: 'decrement', namespace: 'inventory', key: 'widget-qty', amount: 1 },
     *   { op: 'set', namespace: 'state', key: 'last-sale', value: Date.now() },
     * ]);
     * ```
     */
    transaction(operations: Array<{
        op: "set" | "update" | "delete" | "increment" | "decrement";
        namespace: string;
        key: string;
        value?: unknown;
        amount?: number;
    }>): Promise<{
        success: boolean;
        operationsExecuted: number;
        results: unknown[];
    }>;
    /**
     * Bulk delete keys matching filters
     *
     * @param filter - Filter options for deleting keys
     * @param filter.namespace - Required namespace to purge from
     * @param filter.keyPrefix - Filter by key prefix
     * @param filter.userId - Filter by user
     * @param filter.updatedBefore - Delete keys updated before this timestamp
     * @param filter.tenantId - Override tenant ID (defaults to authContext.tenantId)
     * @returns Result with deleted count, namespace, and deleted keys
     *
     * @example
     * ```typescript
     * // Delete keys with prefix
     * await cortex.mutable.purgeMany({
     *   namespace: 'cache',
     *   keyPrefix: 'temp-',
     * });
     *
     * // Delete old keys
     * await cortex.mutable.purgeMany({
     *   namespace: 'cache',
     *   updatedBefore: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
     * });
     *
     * // Delete by user (GDPR compliance)
     * await cortex.mutable.purgeMany({
     *   namespace: 'sessions',
     *   userId: 'user-123',
     * });
     * ```
     */
    purgeMany(filter: PurgeManyFilter): Promise<{
        deleted: number;
        namespace: string;
        keys: string[];
    }>;
}

/**
 * Cortex SDK - Vector Memory API
 *
 * Layer 2: Searchable agent-private memories with embeddings
 */

declare class VectorAPI {
    private readonly client;
    private readonly graphAdapter?;
    private readonly resilience?;
    private readonly authContext?;
    constructor(client: ConvexClient, graphAdapter?: GraphAdapter | undefined, resilience?: ResilienceLayer | undefined, authContext?: AuthContext | undefined);
    /**
     * Execute an operation through the resilience layer (if available)
     */
    private executeWithResilience;
    /**
     * Handle ConvexError from direct Convex calls
     */
    private handleConvexError;
    /**
     * Store a vector memory
     *
     * @param memorySpaceId - The memory space to store the memory in
     * @param input - Memory input data including content, embedding, and metadata
     * @param options - Optional storage options (e.g., syncToGraph)
     * @returns The stored memory entry
     *
     * @example
     * ```typescript
     * const memory = await cortex.vector.store('agent-1', {
     *   content: 'User prefers dark mode',
     *   contentType: 'raw',
     *   embedding: await embed('User prefers dark mode'),
     *   source: { type: 'conversation', userId: 'user-123' },
     *   metadata: { importance: 70, tags: ['preferences'] },
     *   // For bullet-proof retrieval (v0.21.0+)
     *   enrichedContent: 'User prefers dark mode for UI',
     *   factCategory: 'ui_preference',
     * });
     *
     * // With graph sync
     * const memory = await cortex.vector.store('agent-1', data, {
     *   syncToGraph: true
     * });
     * ```
     */
    store(memorySpaceId: string, input: StoreMemoryInput, _options?: StoreMemoryOptions): Promise<MemoryEntry>;
    /**
     * Get memory by ID
     *
     * @example
     * ```typescript
     * const memory = await cortex.vector.get('agent-1', 'mem-abc123');
     * ```
     */
    get(memorySpaceId: string, memoryId: string): Promise<MemoryEntry | null>;
    /**
     * Search memories (semantic with embeddings or keyword without)
     *
     * @param memorySpaceId - The memory space to search in
     * @param query - Text query for keyword search
     * @param options - Search options including embedding for semantic search
     * @returns Array of matching memory entries
     *
     * @example
     * ```typescript
     * const results = await cortex.vector.search('agent-1', 'user preferences', {
     *   embedding: await embed('user preferences'),
     *   limit: 10,
     *   // For bullet-proof retrieval (v0.21.0+)
     *   queryCategory: 'ui_preference', // +30% score boost for matching category
     * });
     * ```
     */
    search(memorySpaceId: string, query: string, options?: SearchMemoriesOptions): Promise<MemoryEntry[]>;
    /**
     * Delete a memory
     *
     * @example
     * ```typescript
     * await cortex.vector.delete('agent-1', 'mem-abc123');
     *
     * // With graph sync and orphan cleanup
     * await cortex.vector.delete('agent-1', 'mem-abc123', {
     *   syncToGraph: true
     * });
     * ```
     */
    delete(memorySpaceId: string, memoryId: string, _options?: DeleteMemoryOptions): Promise<{
        deleted: boolean;
        memoryId: string;
    }>;
    /**
     * List memories with filters
     *
     * @example
     * ```typescript
     * const memories = await cortex.vector.list({
     *   agentId: 'agent-1',
     *   userId: 'user-123',
     *   limit: 50,
     * });
     * ```
     */
    list(filter: ListMemoriesFilter): Promise<MemoryEntry[]>;
    /**
     * Count memories
     *
     * @example
     * ```typescript
     * const count = await cortex.vector.count({
     *   agentId: 'agent-1',
     *   userId: 'user-123',
     * });
     * ```
     */
    count(filter: CountMemoriesFilter): Promise<number>;
    /**
     * Update a memory (creates new version)
     *
     * @example
     * ```typescript
     * await cortex.vector.update('agent-1', 'mem-123', {
     *   content: 'Updated content',
     *   importance: 90,
     * });
     * ```
     */
    update(memorySpaceId: string, memoryId: string, updates: {
        content?: string;
        embedding?: number[];
        importance?: number;
        tags?: string[];
    }): Promise<MemoryEntry>;
    /**
     * Get specific version of a memory
     *
     * @example
     * ```typescript
     * const v1 = await cortex.vector.getVersion('agent-1', 'mem-123', 1);
     * ```
     */
    getVersion(memorySpaceId: string, memoryId: string, version: number): Promise<{
        memoryId: string;
        version: number;
        content: string;
        embedding?: number[];
        timestamp: number;
    } | null>;
    /**
     * Get version history for a memory
     *
     * @example
     * ```typescript
     * const history = await cortex.vector.getHistory('agent-1', 'mem-123');
     * ```
     */
    getHistory(memorySpaceId: string, memoryId: string): Promise<Array<{
        memoryId: string;
        version: number;
        content: string;
        embedding?: number[];
        timestamp: number;
    }>>;
    /**
     * Delete many memories matching filters
     *
     * @example
     * ```typescript
     * await cortex.vector.deleteMany({
     *   agentId: 'agent-1',
     *   sourceType: 'system',
     * });
     * ```
     */
    deleteMany(filter: {
        memorySpaceId: string;
        userId?: string;
        sourceType?: "conversation" | "system" | "tool" | "a2a";
    }): Promise<{
        deleted: number;
        memoryIds: string[];
    }>;
    /**
     * Export memories to JSON or CSV
     *
     * @example
     * ```typescript
     * const exported = await cortex.vector.export({
     *   agentId: 'agent-1',
     *   format: 'json',
     * });
     * ```
     */
    export(options: {
        memorySpaceId: string;
        userId?: string;
        format: "json" | "csv";
        includeEmbeddings?: boolean;
    }): Promise<{
        format: string;
        data: string;
        count: number;
        exportedAt: number;
    }>;
    /**
     * Update many memories matching filters
     *
     * @example
     * ```typescript
     * await cortex.vector.updateMany({
     *   agentId: 'agent-1',
     *   sourceType: 'system',
     * }, {
     *   importance: 20,
     * });
     * ```
     */
    updateMany(filter: {
        memorySpaceId: string;
        userId?: string;
        sourceType?: "conversation" | "system" | "tool" | "a2a";
    }, updates: {
        importance?: number;
        tags?: string[];
    }): Promise<{
        updated: number;
        memoryIds: string[];
    }>;
    /**
     * Archive a memory (soft delete)
     *
     * @example
     * ```typescript
     * await cortex.vector.archive('agent-1', 'mem-123');
     * ```
     */
    archive(memorySpaceId: string, memoryId: string): Promise<{
        archived: boolean;
        memoryId: string;
        restorable: boolean;
    }>;
    /**
     * Restore a memory from archive
     *
     * @example
     * ```typescript
     * const result = await cortex.vector.restoreFromArchive('agent-1', 'mem-123');
     * console.log(result.restored); // true
     * console.log(result.memory); // MemoryEntry
     * ```
     */
    restoreFromArchive(memorySpaceId: string, memoryId: string): Promise<{
        restored: boolean;
        memoryId: string;
        memory: MemoryEntry;
    }>;
    /**
     * Get version at specific timestamp
     *
     * @example
     * ```typescript
     * const memory = await cortex.vector.getAtTimestamp('agent-1', 'mem-123', Date.parse('2025-01-01'));
     * ```
     */
    getAtTimestamp(memorySpaceId: string, memoryId: string, timestamp: number | Date): Promise<{
        memoryId: string;
        version: number;
        content: string;
        embedding?: number[];
        timestamp: number;
    } | null>;
}

/**
 * Cortex SDK - Memory Spaces API
 *
 * Hive/Collaboration Mode management
 */

declare class MemorySpacesAPI {
    private client;
    private graphAdapter?;
    private resilience?;
    private authContext?;
    constructor(client: ConvexClient, graphAdapter?: GraphAdapter | undefined, resilience?: ResilienceLayer | undefined, authContext?: AuthContext | undefined);
    /**
     * Execute an operation through the resilience layer (if available)
     */
    private executeWithResilience;
    /**
     * Handle ConvexError from direct Convex calls (queries that don't go through resilience)
     * Extracts error.data and includes it in the thrown error message
     */
    private handleConvexError;
    /**
     * Register a new memory space
     *
     * @example
     * ```typescript
     * const space = await cortex.memorySpaces.register({
     *   memorySpaceId: 'team-alpha',
     *   name: 'Team Alpha Workspace',
     *   type: 'team',
     *   participants: [
     *     { id: 'user-1', type: 'user', joinedAt: Date.now() },
     *     { id: 'agent-assistant', type: 'agent', joinedAt: Date.now() },
     *   ],
     * });
     * ```
     */
    register(params: RegisterMemorySpaceParams, _options?: RegisterMemorySpaceOptions): Promise<MemorySpace>;
    /**
     * Get memory space by ID
     *
     * @example
     * ```typescript
     * const space = await cortex.memorySpaces.get('team-alpha');
     * ```
     */
    get(memorySpaceId: string): Promise<MemorySpace | null>;
    /**
     * List memory spaces with pagination and sorting
     *
     * @example
     * ```typescript
     * // Basic listing
     * const teams = await cortex.memorySpaces.list({
     *   type: 'team',
     *   status: 'active',
     * });
     *
     * // With pagination and sorting
     * const result = await cortex.memorySpaces.list({
     *   type: 'personal',
     *   limit: 20,
     *   offset: 0,
     *   sortBy: 'createdAt',
     *   sortOrder: 'desc',
     * });
     * console.log(`Found ${result.total} spaces, showing ${result.spaces.length}`);
     *
     * // Filter by participant (Hive Mode)
     * const cursorSpaces = await cortex.memorySpaces.list({
     *   participant: 'cursor',
     * });
     * ```
     */
    list(filter?: ListMemorySpacesFilter): Promise<ListMemorySpacesResult>;
    /**
     * Count memory spaces
     *
     * @example
     * ```typescript
     * const activeCount = await cortex.memorySpaces.count({ status: 'active' });
     * ```
     */
    count(filter?: {
        type?: "personal" | "team" | "project" | "custom";
        status?: "active" | "archived";
    }): Promise<number>;
    /**
     * Update memory space metadata
     *
     * @example
     * ```typescript
     * // Update name and status
     * await cortex.memorySpaces.update('team-alpha', {
     *   name: 'Updated Name',
     *   status: 'archived',
     * });
     *
     * // Update with graph sync
     * await cortex.memorySpaces.update('team-alpha', {
     *   metadata: { lastReview: Date.now() },
     * }, { syncToGraph: true });
     * ```
     */
    update(memorySpaceId: string, updates: {
        name?: string;
        metadata?: Record<string, unknown>;
        status?: "active" | "archived";
    }, _options?: UpdateMemorySpaceOptions): Promise<MemorySpace>;
    /**
     * Add participant to memory space
     *
     * @example
     * ```typescript
     * await cortex.memorySpaces.addParticipant('team-alpha', {
     *   id: 'tool-analyzer',
     *   type: 'tool',
     *   joinedAt: Date.now(),
     * });
     * ```
     */
    addParticipant(memorySpaceId: string, participant: {
        id: string;
        type: string;
        joinedAt: number;
    }): Promise<MemorySpace>;
    /**
     * Remove participant from memory space
     *
     * @example
     * ```typescript
     * await cortex.memorySpaces.removeParticipant('team-alpha', 'tool-analyzer');
     * ```
     */
    removeParticipant(memorySpaceId: string, participantId: string): Promise<MemorySpace>;
    /**
     * Archive memory space (marks as inactive but preserves data)
     *
     * @example
     * ```typescript
     * await cortex.memorySpaces.archive('project-apollo', {
     *   reason: 'Project completed successfully'
     * });
     * ```
     */
    archive(memorySpaceId: string, options?: {
        reason?: string;
        metadata?: Record<string, unknown>;
    }): Promise<MemorySpace>;
    /**
     * Reactivate archived memory space
     *
     * @example
     * ```typescript
     * await cortex.memorySpaces.reactivate('project-apollo');
     * ```
     */
    reactivate(memorySpaceId: string): Promise<MemorySpace>;
    /**
     * Delete memory space and all associated data
     *
     * @example
     * ```typescript
     * // GDPR deletion request
     * const result = await cortex.memorySpaces.delete('user-123-personal', {
     *   cascade: true,
     *   reason: 'GDPR deletion request from user-123',
     *   confirmId: 'user-123-personal', // Safety check
     * });
     *
     * console.log(`Deleted ${result.cascade.memoriesDeleted} memories`);
     * console.log(`Deleted ${result.cascade.conversationsDeleted} conversations`);
     * console.log(`Deleted ${result.cascade.factsDeleted} facts`);
     * ```
     */
    delete(memorySpaceId: string, options: DeleteMemorySpaceOptions): Promise<DeleteMemorySpaceResult>;
    /**
     * Get memory space statistics with optional time window and participant breakdown
     *
     * @example
     * ```typescript
     * // Basic stats
     * const stats = await cortex.memorySpaces.getStats('team-alpha');
     * console.log(`${stats.totalConversations} conversations, ${stats.totalMemories} memories`);
     *
     * // With time window
     * const weekStats = await cortex.memorySpaces.getStats('team-alpha', {
     *   timeWindow: '7d',
     * });
     * console.log(`Activity this week: ${weekStats.memoriesThisWindow} memories`);
     *
     * // With participant breakdown (Hive Mode)
     * const hiveStats = await cortex.memorySpaces.getStats('team-engineering-workspace', {
     *   timeWindow: '7d',
     *   includeParticipants: true,
     * });
     * hiveStats.participants?.forEach((p) => {
     *   console.log(`${p.participantId}: ${p.memoriesStored} memories`);
     * });
     * ```
     */
    getStats(memorySpaceId: string, options?: GetMemorySpaceStatsOptions): Promise<MemorySpaceStats>;
    /**
     * Find memory spaces by participant
     *
     * @example
     * ```typescript
     * const userSpaces = await cortex.memorySpaces.findByParticipant('user-123');
     * ```
     */
    findByParticipant(participantId: string): Promise<MemorySpace[]>;
    /**
     * Search memory spaces by name or metadata
     *
     * @example
     * ```typescript
     * const results = await cortex.memorySpaces.search('engineering', {
     *   type: 'team',
     *   status: 'active',
     *   limit: 10
     * });
     * ```
     */
    search(query: string, options?: {
        type?: "personal" | "team" | "project" | "custom";
        status?: "active" | "archived";
        limit?: number;
    }): Promise<MemorySpace[]>;
    /**
     * Update participants (combined add/remove)
     *
     * @example
     * ```typescript
     * await cortex.memorySpaces.updateParticipants('user-123-personal', {
     *   add: [{ id: 'github-copilot', type: 'ai-tool', joinedAt: Date.now() }],
     *   remove: ['old-tool']
     * });
     * ```
     */
    updateParticipants(memorySpaceId: string, updates: {
        add?: Array<{
            id: string;
            type: string;
            joinedAt: number;
        }>;
        remove?: string[];
    }): Promise<MemorySpace>;
}

/**
 * User API Validation
 *
 * Client-side validation for user operations to catch errors before
 * they reach the backend, providing faster feedback and better error messages.
 */

/**
 * Custom error class for user validation failures
 */
declare class UserValidationError extends Error {
    readonly code: string;
    readonly field?: string | undefined;
    constructor(message: string, code: string, field?: string | undefined);
}

/**
 * Cortex SDK - Users API
 *
 * Coordination Layer: User profile management with GDPR cascade deletion
 */

/** Server-confirmed profile write receipt when the updated profile cannot be read. */
interface UserProfileWriteReceipt {
    updated: true;
    type: string;
    id: string;
    tenantId: string;
    memorySpaceId: string | undefined;
    createdId?: string;
}
/** The write committed, but returning a hydrated profile requires read capability. */
declare class UserProfileWriteReceiptError extends Error {
    readonly code = "PROFILE_WRITE_COMMITTED_READ_UNAVAILABLE";
    readonly retryable = false;
    readonly outcome = "committed";
    readonly requiredCapability = "read";
    readonly receipt: Readonly<UserProfileWriteReceipt>;
    constructor(receipt: UserProfileWriteReceipt);
}

/**
 * Users API
 *
 * Provides convenience wrappers over immutable store (type='user') with the
 * critical feature of GDPR cascade deletion across all layers.
 *
 * Key Principle: Same code for free SDK and Cloud Mode
 * - Free SDK: User provides graph adapter (DIY), cascade works if configured
 * - Cloud Mode: Cortex provides managed graph adapter, cascade always works + legal guarantees
 */
declare class UsersAPI {
    private readonly client;
    private readonly graphAdapter?;
    private readonly resilience?;
    private readonly authContext?;
    constructor(client: ConvexClient, graphAdapter?: GraphAdapter | undefined, resilience?: ResilienceLayer | undefined, authContext?: AuthContext | undefined);
    /**
     * Execute an operation through the resilience layer (if available)
     */
    private executeWithResilience;
    /**
     * Get user profile by ID
     *
     * @example
     * ```typescript
     * const user = await cortex.users.get('user-123');
     * if (user) {
     *   console.log(user.data.displayName);
     * }
     * ```
     */
    get(userId: string): Promise<UserProfile | null>;
    /**
     * Update user profile (creates new version by default)
     *
     * Throws UserProfileWriteReceiptError if the write committed but the backend
     * returned a safe receipt because the updated profile could not be read.
     *
     * @param userId - User ID to update
     * @param data - Profile data to store
     * @param options - Update options
     * @param options.skipVersioning - Don't create new version (default: false)
     * @param options.versionReason - Why this update happened (stored in metadata)
     * @param options.merge - Merge with existing data (default: true)
     *
     * @example
     * ```typescript
     * // Basic update (merges with existing, creates new version)
     * const updated = await cortex.users.update('user-123', {
     *   displayName: 'Alex Johnson',
     *   email: 'alex@example.com',
     *   preferences: { theme: 'dark' }
     * });
     *
     * // Skip versioning for routine updates
     * await cortex.users.update('user-123', {
     *   lastSeen: new Date().toISOString()
     * ```
     */
    update(userId: string, data: Record<string, unknown>): Promise<UserProfile>;
    /**
     * Delete user profile with optional cascade deletion across all layers
     *
     * @param userId - User ID to delete
     * @param options - Deletion options
     * @param options.cascade - Enable cascade deletion across all layers (default: false)
     * @param options.verify - Run verification after deletion (default: true)
     * @param options.dryRun - Preview what would be deleted without actually deleting (default: false)
     *
     * @example
     * ```typescript
     * // Simple deletion (user profile only)
     * await cortex.users.delete('user-123');
     *
     * // GDPR cascade deletion (all layers)
     * const result = await cortex.users.delete('user-123', {
     *   cascade: true
     * });
     * console.log(`Deleted ${result.totalDeleted} records across ${result.deletedLayers.length} layers`);
     * ```
     */
    delete(userId: string, options?: DeleteUserOptions): Promise<UserDeleteResult>;
    /**
     * List user profiles with pagination, filtering, and sorting
     *
     * @param filters - Filter and pagination options
     * @returns ListUsersResult with pagination metadata
     *
     * @example
     * ```typescript
     * // Basic listing with limit
     * const result = await cortex.users.list({ limit: 50 });
     * console.log(`Found ${result.total} users, showing ${result.users.length}`);
     *
     * // With date filters and sorting
     * const recent = await cortex.users.list({
     *   createdAfter: Date.now() - 7 * 24 * 60 * 60 * 1000,
     *   sortBy: 'createdAt',
     *   sortOrder: 'desc',
     *   limit: 20
     * });
     *
     * // Pagination
     * const page2 = await cortex.users.list({ limit: 10, offset: 10 });
     * ```
     */
    list(filters?: ListUsersFilter): Promise<ListUsersResult>;
    /**
     * Search user profiles with filters
     *
     * @param filters - Filter, sorting, and pagination options
     * @returns Array of matching user profiles
     *
     * @example
     * ```typescript
     * // Search with date filter
     * const recentUsers = await cortex.users.search({
     *   createdAfter: Date.now() - 30 * 24 * 60 * 60 * 1000,
     *   limit: 100
     * });
     *
     * // Search by displayName (client-side filter)
     * const alexUsers = await cortex.users.search({
     *   displayName: 'alex',
     *   limit: 50
     * });
     *
     * // Search with sorting
     * const sorted = await cortex.users.search({
     *   sortBy: 'updatedAt',
     *   sortOrder: 'desc'
     * });
     * ```
     */
    search(filters: UserFilters): Promise<UserProfile[]>;
    /**
     * Count user profiles with optional filters
     *
     * @param filters - Optional filter parameters
     * @returns Count of matching user profiles
     *
     * @example
     * ```typescript
     * // Total users
     * const total = await cortex.users.count();
     * console.log(`Total users: ${total}`);
     *
     * // Count recent users (last 30 days)
     * const recentCount = await cortex.users.count({
     *   createdAfter: Date.now() - 30 * 24 * 60 * 60 * 1000
     * });
     *
     * // Count users updated this week
     * const activeCount = await cortex.users.count({
     *   updatedAfter: Date.now() - 7 * 24 * 60 * 60 * 1000
     * });
     * ```
     */
    count(filters?: UserFilters): Promise<number>;
    /**
     * Get specific version of user profile
     *
     * @example
     * ```typescript
     * const v1 = await cortex.users.getVersion('user-123', 1);
     * ```
     */
    getVersion(userId: string, version: number): Promise<UserVersion | null>;
    /**
     * Get version history of user profile
     *
     * @example
     * ```typescript
     * const history = await cortex.users.getHistory('user-123');
     * console.log(`User has ${history.length} versions`);
     * ```
     */
    getHistory(userId: string): Promise<UserVersion[]>;
    /**
     * Get user profile at specific timestamp
     *
     * @example
     * ```typescript
     * const snapshot = await cortex.users.getAtTimestamp(
     *   'user-123',
     *   new Date('2025-10-01')
     * );
     * ```
     */
    getAtTimestamp(userId: string, timestamp: Date): Promise<UserVersion | null>;
    /**
     * Check if user profile exists
     *
     * @example
     * ```typescript
     * if (await cortex.users.exists('user-123')) {
     *   console.log('User exists');
     * }
     * ```
     */
    exists(userId: string): Promise<boolean>;
    /**
     * Get user profile or create with defaults if doesn't exist
     *
     * @param userId - User ID
     * @param defaults - Default profile data if user doesn't exist
     * @returns User profile (existing or newly created)
     *
     * @example
     * ```typescript
     * const user = await cortex.users.getOrCreate('user-123', {
     *   displayName: 'Guest User',
     *   preferences: { theme: 'light' },
     *   metadata: { tier: 'free' }
     * });
     * ```
     */
    getOrCreate(userId: string, defaults?: Record<string, unknown>): Promise<UserProfile>;
    /**
     * Merge partial updates with existing profile
     *
     * This is an alias for update() with merge behavior, which is the default.
     *
     * @param userId - User ID
     * @param updates - Partial updates to merge with existing data
     * @returns Updated user profile
     *
     * @example
     * ```typescript
     * // Existing: { displayName: 'Alex', preferences: { theme: 'dark', language: 'en' } }
     * await cortex.users.merge('user-123', {
     *   preferences: { notifications: true }  // Adds notifications, keeps theme and language
     * });
     * // Result: { displayName: 'Alex', preferences: { theme: 'dark', language: 'en', notifications: true } }
     * ```
     */
    merge(userId: string, updates: Record<string, unknown>): Promise<UserProfile>;
    /**
     * Helper: Deep merge two objects
     */
    private deepMerge;
    /**
     * Export user profiles with optional related data
     *
     * @param options - Export options including format and what to include
     * @returns Exported data as JSON or CSV string
     *
     * @example
     * ```typescript
     * // Basic JSON export
     * const json = await cortex.users.export({ format: 'json' });
     *
     * // Export with version history
     * const withHistory = await cortex.users.export({
     *   format: 'json',
     *   includeVersionHistory: true
     * });
     *
     * // Full GDPR export with conversations and memories
     * const gdprExport = await cortex.users.export({
     *   format: 'json',
     *   filters: { displayName: 'alex' },
     *   includeVersionHistory: true,
     *   includeConversations: true,
     *   includeMemories: true
     * });
     * ```
     */
    export(options?: ExportUsersOptions): Promise<string>;
    /**
     * Bulk update multiple users by explicit IDs or filters
     *
     * @param userIdsOrFilters - Array of user IDs OR UserFilters object
     * @param updates - Updates to apply to matching users
     * @param options - Update options
     * @returns Update result with count and affected userIds
     * @throws UserProfileWriteReceiptError if an item committed without a readable
     * profile. Earlier items may already have committed; do not replay the batch.
     *
     * @example
     * ```typescript
     * // Update by explicit IDs
     * const result = await cortex.users.updateMany(
     *   ['user-1', 'user-2', 'user-3'],
     *   { data: { status: 'active' } }
     * );
     *
     * // Update by filters (all users created in last 7 days)
     * const filtered = await cortex.users.updateMany(
     *   { createdAfter: Date.now() - 7 * 24 * 60 * 60 * 1000 },
     *   { data: { welcomeEmailSent: true } }
     * );
     *
     * // Dry run to preview
     * const preview = await cortex.users.updateMany(
     *   { displayName: 'alex' },
     *   { data: { verified: true } },
     *   { dryRun: true }
     * );
     * console.log(`Would update ${preview.userIds.length} users`);
     * ```
     */
    updateMany(userIdsOrFilters: string[] | UserFilters, updates: {
        data: Record<string, unknown>;
    }, options?: {
        skipVersioning?: boolean;
        dryRun?: boolean;
    }): Promise<{
        updated: number;
        userIds: string[];
    }>;
    /**
     * Bulk delete multiple users by explicit IDs or filters
     *
     * @param userIdsOrFilters - Array of user IDs OR UserFilters object
     * @param options - Delete options (cascade, dryRun)
     * @returns Delete result with count and affected userIds
     *
     * @example
     * ```typescript
     * // Delete by explicit IDs
     * const result = await cortex.users.deleteMany(
     *   ['user-1', 'user-2', 'user-3'],
     *   { cascade: true }
     * );
     *
     * // Delete by filters (inactive users older than 1 year)
     * const oldUsers = await cortex.users.deleteMany(
     *   { createdBefore: Date.now() - 365 * 24 * 60 * 60 * 1000 },
     *   { cascade: true }
     * );
     *
     * // Dry run to preview what would be deleted
     * const preview = await cortex.users.deleteMany(
     *   { updatedBefore: Date.now() - 90 * 24 * 60 * 60 * 1000 },
     *   { dryRun: true }
     * );
     * console.log(`Would delete ${preview.userIds.length} users`);
     * ```
     */
    deleteMany(userIdsOrFilters: string[] | UserFilters, options?: {
        cascade?: boolean;
        dryRun?: boolean;
    }): Promise<{
        deleted: number;
        userIds: string[];
    }>;
    /**
     * PHASE 1: Collect all records that will be deleted
     *
     * OPTIMIZED: Instead of collecting all individual records (which requires
     * looping through all memory spaces), we collect:
     * - Memory space IDs (for batch deleteMany operations)
     * - Individual records only where batch operations aren't available
     *
     * This matches the Python SDK approach for fast cascade deletion.
     */
    private collectDeletionTargets;
    /**
     * Collect mutable keys associated with user
     */
    private collectMutableKeys;
    /**
     * Collect graph nodes associated with user
     */
    private collectGraphNodes;
    /**
     * PHASE 2: Backup records for rollback
     */
    private backupRecords;
    /**
     * PHASE 3: Execute cascade deletion in reverse dependency order
     *
     * OPTIMIZED: Uses batch deleteMany operations instead of individual deletes.
     * This is much faster for large datasets and matches the Python SDK approach.
     */
    private executeCascadeDeletion;
    /**
     * ROLLBACK: Restore backed up records
     */
    private rollbackDeletion;
    /**
     * PHASE 4: Verify deletion completeness
     *
     * OPTIMIZED: Uses simple count queries instead of looping through all memory spaces.
     * This matches the Python SDK approach for fast verification.
     */
    private verifyDeletion;
    /**
     * Count remaining graph nodes for user
     */
    private countGraphNodes;
    /**
     * Calculate deletion totals from plan
     */
    private calculateDeletionTotals;
    /**
     * Get affected layers from deletion plan
     */
    private getAffectedLayers;
}

/**
 * Cortex SDK - Agents API
 *
 * Coordination Layer: Optional agent metadata registry with cascade deletion
 *
 * Key Principle: Agents work without registration (just use string IDs).
 * Registration provides discovery, analytics, and convenient cascade deletion.
 */

interface AgentRegistryScope {
    tenantId?: string;
    memorySpaceId?: string;
}
/** Legacy client cascades cannot prove complete authorized child cleanup. */
declare class AgentRegistryCapabilityError extends Error {
    readonly code = "TRUSTED_BACKEND_CASCADE_REQUIRED";
    readonly requiredCapability = "trusted-backend-cascade";
    constructor();
}
/** The deletion committed but the server did not disclose its result IDs. */
declare class AgentRegistryCommittedResultError extends Error {
    readonly deleted: number;
    readonly code = "AGENT_REGISTRY_COMMITTED_RESULT_UNAVAILABLE";
    readonly retryable = false;
    readonly outcome = "committed";
    constructor(deleted: number);
}
/** A server-confirmed write whose registry row cannot be disclosed. */
interface AgentRegistryWriteReceipt {
    accepted: true;
    resourceType: "agents";
    resourceId: string;
}
/** The registry write committed; retrying it may duplicate an effect. */
declare class AgentRegistryWriteReceiptError extends Error {
    readonly code = "AGENT_REGISTRY_WRITE_COMMITTED_READ_UNAVAILABLE";
    readonly retryable = false;
    readonly outcome = "committed";
    readonly requiredCapability = "read";
    readonly receipt: Readonly<AgentRegistryWriteReceipt>;
    constructor(receipt: AgentRegistryWriteReceipt);
}
declare class AgentsAPI {
    private readonly client;
    private readonly graphAdapter?;
    private readonly resilience?;
    private readonly authContext?;
    constructor(client: ConvexClient, graphAdapter?: GraphAdapter | undefined, resilience?: ResilienceLayer | undefined, authContext?: AuthContext | undefined);
    /**
     * Execute an operation through the resilience layer (if available)
     */
    private executeWithResilience;
    /**
     * Handle ConvexError from direct Convex calls
     */
    private handleConvexError;
    /**
     * Register an agent in the registry
     *
     * @example
     * ```typescript
     * const agent = await cortex.agents.register({
     *   id: 'support-agent',
     *   name: 'Customer Support Bot',
     *   description: 'Handles customer inquiries',
     *   metadata: {
     *     team: 'support',
     *     capabilities: ['troubleshooting', 'empathy']
     *   }
     * });
     * ```
     */
    register(agent: AgentRegistration): Promise<RegisteredAgent>;
    /**
     * Get agent registration by ID
     *
     * @example
     * ```typescript
     * const agent = await cortex.agents.get('support-agent');
     * if (agent) {
     *   console.log(agent.name, agent.metadata.team);
     * }
     * ```
     */
    get(agentId: string, scope?: AgentRegistryScope): Promise<RegisteredAgent | null>;
    /**
     * List agents with filters
     *
     * @param filters - Optional filters to apply
     * @returns Array of registered agents matching the filters
     *
     * @remarks
     * **Pagination Limitation:** The `offset` and `limit` parameters are applied at the
     * database level BEFORE client-side filtering. This means combining `offset` with
     * client-side filters (`metadata`, `name`, `capabilities`, `lastActiveAfter`,
     * `lastActiveBefore`) may produce unexpected results.
     *
     * For example, if you have 100 agents and request `{ metadata: { team: "alpha" }, offset: 10 }`,
     * the database will skip the first 10 agents (regardless of team), then the SDK filters
     * the remaining results for `team: "alpha"`. This may return fewer results than expected
     * or empty results even when matching agents exist.
     *
     * **Safe pagination patterns:**
     * - Use `offset`/`limit` with `status` filter only (backend-applied)
     * - Use `offset`/`limit` without any client-side filters
     * - For paginating with metadata/name/capabilities, fetch all results and paginate client-side
     *
     * @example
     * ```typescript
     * // Safe: offset with backend filter only
     * const agents = await cortex.agents.list({ status: 'active', offset: 10, limit: 20 });
     *
     * // Safe: client-side filter without offset
     * const teamAgents = await cortex.agents.list({ metadata: { team: 'alpha' } });
     *
     * // WARNING: offset + metadata may produce unexpected results
     * const paginated = await cortex.agents.list({ metadata: { team: 'alpha' }, offset: 10 });
     * ```
     */
    list(filters?: AgentFilters): Promise<RegisteredAgent[]>;
    /**
     * Search agents (alias for list with filters)
     *
     * @example
     * ```typescript
     * const supportAgents = await cortex.agents.search({
     *   metadata: { team: 'support' }
     * });
     * ```
     */
    search(filters: AgentFilters): Promise<RegisteredAgent[]>;
    /**
     * Count registered agents
     *
     * @example
     * ```typescript
     * const total = await cortex.agents.count();
     * console.log(`Total agents: ${total}`);
     * ```
     */
    count(filters?: AgentFilters): Promise<number>;
    /**
     * Update agent registration
     *
     * @example
     * ```typescript
     * await cortex.agents.update('support-agent', {
     *   metadata: { team: 'customer-success' }
     * });
     * ```
     */
    update(agentId: string, updates: Partial<AgentRegistration> & {
        status?: string;
    }): Promise<RegisteredAgent>;
    /**
     * Configure agent settings
     *
     * @example
     * ```typescript
     * await cortex.agents.configure('audit-agent', {
     *   memoryVersionRetention: -1  // Unlimited
     * });
     * ```
     */
    configure(agentId: string, config: Record<string, unknown>, scope?: AgentRegistryScope): Promise<void>;
    /**
     * Check if agent is registered
     *
     * @example
     * ```typescript
     * if (await cortex.agents.exists('my-agent')) {
     *   console.log('Agent is registered');
     * }
     * ```
     */
    exists(agentId: string, scope?: AgentRegistryScope): Promise<boolean>;
    /**
     * Unregister agent with optional cascade deletion by participantId
     *
     * @param agentId - Agent ID to unregister
     * @param options - Unregistration options
     * @param options.cascade - Delete all data where participantId = agentId (default: false)
     * @param options.verify - Verify deletion completeness (default: true)
     * @param options.dryRun - Preview what would be deleted (default: false)
     *
     * @example
     * ```typescript
     * // Simple unregister (keep data)
     * await cortex.agents.unregister('old-agent');
     *
     * // Cascade delete all agent data
     * const result = await cortex.agents.unregister('old-agent', {
     *   cascade: true
     * });
     * console.log(`Deleted ${result.totalDeleted} records from ${result.memorySpacesAffected.length} spaces`);
     * ```
     */
    unregister(agentId: string, options?: UnregisterAgentOptions & AgentRegistryScope): Promise<UnregisterAgentResult>;
    /**
     * Unregister multiple agents matching filters
     *
     * @param filters - Filter criteria for agents to unregister
     * @param options - Unregistration options
     * @returns Unregistration result
     *
     * @example
     * ```typescript
     * // Unregister experimental agents (keep data)
     * const result = await cortex.agents.unregisterMany(
     *   { metadata: { environment: 'experimental' } },
     *   { cascade: false }
     * );
     * console.log(`Unregistered ${result.deleted} agents`);
     *
     * // Unregister and cascade delete all data
     * const result = await cortex.agents.unregisterMany(
     *   { status: 'archived' },
     *   { cascade: true }
     * );
     * ```
     */
    unregisterMany(filters: AgentFilters, options?: UnregisterAgentOptions): Promise<{
        deleted: number;
        agentIds: string[];
        totalDataDeleted?: number;
    }>;
    /**
     * Update multiple agents matching filters
     *
     * @param filters - Filter criteria for agents to update
     * @param updates - Fields to update on matching agents
     * @returns Update result with count and agent IDs
     *
     * @example
     * ```typescript
     * // Update all agents in a team
     * const result = await cortex.agents.updateMany(
     *   { metadata: { team: 'support' } },
     *   { metadata: { trainingCompleted: true } }
     * );
     * console.log(`Updated ${result.updated} agents`);
     *
     * // Upgrade all agents to new version
     * await cortex.agents.updateMany(
     *   { metadata: { version: '2.0.0' } },
     *   { metadata: { version: '2.1.0' } }
     * );
     * ```
     */
    updateMany(filters: AgentFilters, updates: Partial<AgentRegistration>): Promise<{
        updated: number;
        agentIds: string[];
    }>;
    /**
     * Export registered agents matching filters
     *
     * @param options - Export options including format and filters
     * @returns Export result with data string
     *
     * @example
     * ```typescript
     * // Export all agents as JSON
     * const result = await cortex.agents.export({
     *   format: "json",
     *   includeStats: true,
     * });
     * fs.writeFileSync("agents.json", result.data);
     *
     * // Export support team as CSV
     * const csv = await cortex.agents.export({
     *   filters: { metadata: { team: "support" } },
     *   format: "csv",
     * });
     * ```
     */
    export(options: ExportAgentsOptions): Promise<ExportAgentsResult>;
    /**
     * Escape a field for CSV output
     */
    private escapeCsvField;
    /**
     * Get agent statistics
     */
    private getAgentStats;
    /**
     * PHASE 1: Collect all records where participantId = agentId
     * This queries across ALL memory spaces IN PARALLEL for performance
     */
    private collectAgentDeletionTargets;
    /**
     * Collect graph nodes where participantId = agentId
     */
    private collectGraphNodes;
    /**
     * PHASE 2: Backup records for rollback
     */
    private backupRecords;
    /**
     * PHASE 3: Execute cascade deletion in reverse dependency order
     * OPTIMIZED: Uses batch deletes instead of individual API calls
     */
    private executeAgentCascadeDeletion;
    /**
     * ROLLBACK: Restore backed up records
     */
    private rollbackAgentDeletion;
    /**
     * PHASE 4: Verify deletion completeness
     * OPTIMIZED: Runs all verification queries in parallel
     */
    private verifyAgentDeletion;
    /**
     * Count remaining graph nodes for agent
     */
    private countGraphNodes;
    /**
     * Calculate deletion totals from plan
     */
    private calculateDeletionTotals;
    /**
     * Get affected layers from deletion plan
     */
    private getAffectedLayers;
}

/**
 * Memory API Validation
 *
 * Client-side validation for memory operations to catch errors before
 * they reach the backend, providing faster feedback and better error messages.
 */

/**
 * Custom error class for memory validation failures
 */
declare class MemoryValidationError extends Error {
    readonly code: string;
    readonly field?: string | undefined;
    constructor(message: string, code: string, field?: string | undefined);
}

/**
 * Dependencies for full memory orchestration
 */
interface MemoryAPIDependencies {
    /** Memory spaces API for auto-registration */
    memorySpaces: MemorySpacesAPI;
    /** Users API for auto-profile creation */
    users: UsersAPI;
    /** Agents API for auto-registration */
    agents: AgentsAPI;
    /** LLM config for auto fact extraction */
    llm?: LLMConfig;
    /** Embedding config for automatic semantic search (v0.30.0+) */
    embedding?: EmbeddingConfig;
    /** Auth context for tenant isolation */
    authContext?: AuthContext;
}
declare class MemoryAPI {
    private readonly client;
    private readonly conversations;
    private readonly vector;
    private readonly facts;
    private readonly graphAdapter?;
    private readonly resilience?;
    private readonly memorySpacesAPI?;
    private readonly usersAPI?;
    private readonly agentsAPI?;
    private readonly llmConfig?;
    private readonly embeddingConfig?;
    private readonly authContext?;
    private llmClient?;
    private embeddingGenerator?;
    constructor(client: ConvexClient, graphAdapter?: GraphAdapter, resilience?: ResilienceLayer, dependencies?: MemoryAPIDependencies);
    /**
     * Create an embedding generator function from config (v0.30.0+)
     *
     * Enables batteries-included semantic search by auto-generating embeddings.
     */
    private createEmbeddingGenerator;
    /**
     * Execute an operation through the resilience layer (if available)
     */
    private executeWithResilience;
    /**
     * Helper: Find and cascade delete facts linked to a memory
     * Graph sync is automatic when CORTEX_GRAPH_SYNC=true and graphAdapter is configured
     */
    private cascadeDeleteFacts;
    /**
     * Helper: Archive facts (mark as expired)
     * Graph sync is automatic when CORTEX_GRAPH_SYNC=true and graphAdapter is configured
     */
    private archiveFacts;
    /**
     * Helper: Fetch facts for a memory or conversation
     */
    private fetchFactsForMemory;
    /**
     * Generate a unique orchestration ID
     */
    private generateOrchestrationId;
    /**
     * Notify the observer of a layer update (safely handles async observers)
     */
    private notifyLayerUpdate;
    /**
     * Notify the observer of remember phase start
     */
    private notifyRememberStart;
    /**
     * Notify the observer of remember phase completion
     */
    private notifyRememberComplete;
    /**
     * Notify the observer of recall phase start
     */
    private notifyRecallStart;
    /**
     * Notify the observer of recall phase completion
     */
    private notifyRecallComplete;
    /**
     * Create a layer event with current timing info
     */
    private createLayerEvent;
    /**
     * Check if a layer should be skipped
     */
    private shouldSkipLayer;
    /**
     * Build deduplication config from remember params
     *
     * Defaults to 'semantic' strategy for maximum effectiveness (convenience layer).
     * BATTERIES INCLUDED (v0.30.0+): Falls back to this.embeddingGenerator if available,
     * then to 'structural' if no embedding function is available.
     * Returns undefined if deduplication is explicitly disabled.
     */
    private buildDeduplicationConfig;
    /**
     * Validate and normalize remember params with orchestration defaults
     */
    private validateAndNormalizeParams;
    /**
     * Ensure memory space exists, auto-register if not
     * Graph sync is automatic when CORTEX_GRAPH_SYNC=true and graphAdapter is configured
     */
    private ensureMemorySpaceExists;
    /**
     * Ensure user profile exists, auto-create if not
     */
    private ensureUserExists;
    /**
     * Ensure agent is registered, auto-register if not
     */
    private ensureAgentExists;
    /**
     * Get fact extraction function - uses provided extractor, LLM config, or returns null
     */
    private getFactExtractor;
    /**
     * Get or create LLM client for fact extraction
     */
    private getLLMClient;
    /**
     * Create an LLM-based fact extractor function
     *
     * Uses the configured LLM provider (OpenAI or Anthropic) to automatically
     * extract structured facts from conversations. Falls back to null if
     * extraction fails or LLM is not properly configured.
     */
    private createLLMFactExtractor;
    /**
     * Remember a conversation exchange (stores in both ACID and Vector)
     *
     * This method orchestrates across multiple layers by default:
     * - Auto-registers memory space if it doesn't exist
     * - Auto-creates user profile if userId is provided
     * - Auto-registers agent if agentId is provided
     * - Stores messages in ACID conversation layer
     * - Creates searchable vector memories
     * - Extracts facts if LLM is configured or extractFacts provided
     * - Syncs to graph if configured
     *
     * Use `skipLayers` to explicitly opt-out of specific layers.
     *
     * @example
     * ```typescript
     * // Full orchestration (default)
     * await cortex.memory.remember({
     *   memorySpaceId: 'user-123-space',
     *   userId: 'user-123',
     *   userName: 'Alex',
     *   conversationId: 'conv-123',
     *   userMessage: 'Call me Alex',
     *   agentResponse: "I'll remember that, Alex!",
     * });
     *
     * // Skip facts and graph (lightweight mode)
     * await cortex.memory.remember({
     *   memorySpaceId: 'user-123-space',
     *   agentId: 'quick-bot',
     *   conversationId: 'conv-456',
     *   userMessage: 'Quick question',
     *   agentResponse: 'Quick answer',
     *   skipLayers: ['facts', 'graph'],
     * });
     * ```
     */
    remember(params: RememberParams, options?: RememberOptions): Promise<RememberResult>;
    /**
     * Remember a conversation exchange from a streaming response (ENHANCED)
     *
     * This method provides true streaming capabilities with:
     * - Progressive storage during streaming
     * - Real-time fact extraction
     * - Streaming hooks for monitoring
     * - Error recovery with resume capability
     * - Adaptive processing based on stream characteristics
     * - Optional chunking for very long responses
     *
     * Auto-syncs to graph if configured (default: true)
     *
     * @param params - Stream parameters including responseStream
     * @param options - Optional streaming options
     * @returns Promise with enhanced remember result including metrics
     *
     * @example
     * ```typescript
     * // Basic usage
     * const result = await cortex.memory.rememberStream({
     *   memorySpaceId: 'agent-1',
     *   conversationId: 'conv-123',
     *   userMessage: 'What is the weather?',
     *   responseStream: llmStream,
     *   userId: 'user-1',
     *   userName: 'Alex',
     * });
     *
     * // With progressive features
     * const result = await cortex.memory.rememberStream({
     *   memorySpaceId: 'agent-1',
     *   conversationId: 'conv-123',
     *   userMessage: 'Explain quantum computing',
     *   responseStream: llmStream,
     *   userId: 'user-1',
     *   userName: 'Alex',
     *   extractFacts: extractFactsFromText,
     * }, {
     *   storePartialResponse: true,
     *   partialResponseInterval: 3000,
     *   progressiveFactExtraction: true,
     *   factExtractionThreshold: 500,
     *   hooks: {
     *     onChunk: (event) => console.log('Chunk:', event.chunk),
     *     onProgress: (event) => console.log('Progress:', event.bytesProcessed),
     *   },
     *   partialFailureHandling: 'store-partial',
     * });
     * ```
     */
    rememberStream(params: RememberStreamParams, options?: StreamingOptions): Promise<EnhancedRememberStreamResult>;
    /**
     * Forget a memory (delete from Vector and optionally ACID)
     *
     * Auto-syncs to graph if configured (default: true)
     *
     * @example
     * ```typescript
     * await cortex.memory.forget('agent-1', 'mem-123', {
     *   deleteConversation: true,
     * });
     *
     * // Disable graph sync
     * await cortex.memory.forget('agent-1', 'mem-123', {
     *   deleteConversation: true,
     *   syncToGraph: false,
     * });
     * ```
     */
    /**
     * Forget a memory (delete from Vector and optionally ACID)
     *
     * Auto-syncs to graph if configured (default: true)
     *
     * @param memorySpaceId - Memory space that contains the memory
     * @param memoryId - Memory ID to forget
     * @param options - Options for deletion behavior
     * @returns ForgetResult with deletion details
     *
     * @example
     * ```typescript
     * await cortex.memory.forget('user-123-space', 'mem-123', {
     *   deleteConversation: true,
     * });
     *
     * // Disable graph sync
     * await cortex.memory.forget('user-123-space', 'mem-123', {
     *   deleteConversation: true,
     *   syncToGraph: false,
     * });
     * ```
     */
    forget(memorySpaceId: string, memoryId: string, options?: ExtendedForgetOptions): Promise<ForgetResult>;
    /**
     * Get memory with optional ACID enrichment
     *
     * @param memorySpaceId - Memory space that contains the memory
     * @param memoryId - Memory ID to retrieve
     * @param options - Options for retrieval (includeConversation)
     * @returns MemoryEntry, EnrichedMemory (if includeConversation), or null
     *
     * @example
     * ```typescript
     * const enriched = await cortex.memory.get('user-123-space', 'mem-123', {
     *   includeConversation: true,
     * });
     * ```
     */
    get(memorySpaceId: string, memoryId: string, options?: GetMemoryOptions & {
        includeConversation?: false;
    }): Promise<MemoryEntry | null>;
    get(memorySpaceId: string, memoryId: string, options: GetMemoryOptions & {
        includeConversation: true;
    }): Promise<EnrichedMemory | null>;
    get(memorySpaceId: string, memoryId: string, options: GetMemoryOptions): Promise<MemoryEntry | EnrichedMemory | null>;
    /**
     * Search memories with optional ACID enrichment
     *
     * @param memorySpaceId - Memory space to search in
     * @param query - Search query string
     * @param options - Search options (embedding, filters, enrichConversation)
     * @returns Array of MemoryEntry or EnrichedMemory results
     *
     * @example
     * ```typescript
     * const results = await cortex.memory.search('user-123-space', 'password', {
     *   embedding: await embed('password'),
     *   enrichConversation: true,
     * });
     * ```
     */
    search(memorySpaceId: string, query: string, options?: SearchMemoryOptions & {
        enrichConversation?: false;
    }): Promise<MemoryEntry[]>;
    search(memorySpaceId: string, query: string, options: SearchMemoryOptions & {
        enrichConversation: true;
    }): Promise<EnrichedMemory[]>;
    search(memorySpaceId: string, query: string, options: SearchMemoryOptions): Promise<MemoryEntry[] | EnrichedMemory[]>;
    /**
     * Recall context from all memory layers with unified orchestration.
     *
     * This is the retrieval counterpart to `remember()`. It orchestrates across:
     * - Vector memories (Layer 2) via semantic search
     * - Facts store (Layer 3) as a primary search source
     * - Graph database for relational context discovery
     *
     * Results are merged, deduplicated, ranked, and formatted for LLM injection.
     *
     * **Batteries Included Defaults:**
     * - All sources enabled (vector, facts, graph)
     * - Graph expansion enabled (if graph configured)
     * - LLM-ready context formatting enabled
     * - Conversation enrichment enabled
     *
     * @example
     * ```typescript
     * // Minimal usage - full orchestration
     * const result = await cortex.memory.recall({
     *   memorySpaceId: 'user-123-space',
     *   query: 'user preferences',
     * });
     *
     * // Inject context into LLM prompt
     * const response = await llm.chat({
     *   messages: [
     *     { role: 'system', content: `Context:\n${result.context}` },
     *     { role: 'user', content: userMessage },
     *   ],
     * });
     *
     * // With semantic search (recommended)
     * const result = await cortex.memory.recall({
     *   memorySpaceId: 'user-123-space',
     *   query: 'user preferences',
     *   embedding: await embed('user preferences'),
     *   userId: 'user-123',
     * });
     * ```
     */
    recall(params: RecallParams): Promise<RecallResult>;
    /**
     * Store memory with smart layer detection and optional fact extraction
     *
     * @param memorySpaceId - Memory space to store the memory in
     * @param input - Memory input data (content, source, metadata, etc.)
     * @returns StoreMemoryResult with memory and extracted facts
     *
     * @example
     * ```typescript
     * await cortex.memory.store('user-123-space', {
     *   content: 'User prefers dark mode',
     *   contentType: 'raw',
     *   source: { type: 'system' },
     *   metadata: { importance: 60, tags: ['preferences'] },
     *   extractFacts: async (content) => [{
     *     fact: 'User prefers dark mode',
     *     factType: 'preference',
     *     confidence: 90,
     *   }],
     * });
     * ```
     */
    store(memorySpaceId: string, input: StoreMemoryInput): Promise<StoreMemoryResult>;
    /**
     * Update a memory with optional fact re-extraction
     *
     * @param memorySpaceId - Memory space that contains the memory
     * @param memoryId - Memory ID to update
     * @param updates - Fields to update (content, embedding, importance, tags)
     * @param options - Options for update behavior (reextractFacts, syncToGraph)
     * @returns UpdateMemoryResult with updated memory and optionally re-extracted facts
     *
     * @example
     * ```typescript
     * const updated = await cortex.memory.update('user-123-space', 'mem-123', {
     *   content: 'Updated content',
     *   importance: 80,
     * });
     * ```
     */
    update(memorySpaceId: string, memoryId: string, updates: {
        content?: string;
        embedding?: number[];
        importance?: number;
        tags?: string[];
    }, options?: UpdateMemoryOptions): Promise<UpdateMemoryResult>;
    /**
     * Delete a memory with cascade delete of facts
     *
     * @param memorySpaceId - Memory space that contains the memory
     * @param memoryId - Memory ID to delete
     * @param options - Options for deletion behavior (cascadeDeleteFacts, syncToGraph)
     * @returns DeleteMemoryResult with deletion details
     *
     * @example
     * ```typescript
     * const result = await cortex.memory.delete('user-123-space', 'mem-123');
     * console.log(`Deleted ${result.factsDeleted} associated facts`);
     * ```
     */
    delete(memorySpaceId: string, memoryId: string, options?: DeleteMemoryOptions): Promise<DeleteMemoryResult>;
    /**
     * List memories with optional fact enrichment
     */
    list(filter: ListMemoriesFilter & {
        enrichFacts?: false;
    }): Promise<MemoryEntry[]>;
    list(filter: ListMemoriesFilter & {
        enrichFacts: true;
    }): Promise<EnrichedMemory[]>;
    list(filter: ListMemoriesFilter): Promise<MemoryEntry[] | EnrichedMemory[]>;
    /**
     * Count memories (delegates to vector.count)
     */
    count(filter: CountMemoriesFilter): Promise<number>;
    /**
     * Update many memories and track affected facts
     */
    updateMany(filter: {
        memorySpaceId: string;
        userId?: string;
        sourceType?: SourceType;
    }, updates: {
        importance?: number;
        tags?: string[];
    }): Promise<UpdateManyResult>;
    /**
     * Delete many memories with batch cascade delete of facts
     */
    deleteMany(filter: {
        memorySpaceId: string;
        userId?: string;
        sourceType?: SourceType;
    }): Promise<DeleteManyResult>;
    /**
     * Export memories with optional fact inclusion
     */
    export(options: ExportMemoriesOptions): Promise<{
        format: string;
        data: string;
        count: number;
        exportedAt: number;
    }>;
    /**
     * Archive a memory and mark associated facts as expired
     *
     * @param memorySpaceId - Memory space that contains the memory
     * @param memoryId - Memory ID to archive
     * @returns ArchiveResult with archive details
     *
     * @example
     * ```typescript
     * const result = await cortex.memory.archive('user-123-space', 'mem-123');
     * console.log(`Archived ${result.factsArchived} associated facts`);
     * ```
     */
    archive(memorySpaceId: string, memoryId: string): Promise<ArchiveResult>;
    /**
     * Restore memory from archive
     *
     * @example
     * ```typescript
     * const restored = await cortex.memory.restoreFromArchive('agent-1', 'mem-123');
     * ```
     */
    restoreFromArchive(memorySpaceId: string, memoryId: string): Promise<{
        restored: boolean;
        memoryId: string;
        memory: MemoryEntry;
    }>;
    /**
     * Get specific version of a memory
     *
     * @param memorySpaceId - Memory space that contains the memory
     * @param memoryId - Memory ID to get version for
     * @param version - Version number to retrieve
     * @returns MemoryVersion or null if not found
     *
     * @example
     * ```typescript
     * const v1 = await cortex.memory.getVersion('user-123-space', 'mem-123', 1);
     * if (v1) {
     *   console.log(`Version 1 content: ${v1.content}`);
     * }
     * ```
     */
    getVersion(memorySpaceId: string, memoryId: string, version: number): Promise<{
        memoryId: string;
        version: number;
        content: string;
        embedding?: number[];
        timestamp: number;
    } | null>;
    /**
     * Get version history of a memory
     *
     * @param memorySpaceId - Memory space that contains the memory
     * @param memoryId - Memory ID to get history for
     * @returns Array of MemoryVersion sorted by version number
     *
     * @example
     * ```typescript
     * const history = await cortex.memory.getHistory('user-123-space', 'mem-123');
     * history.forEach(v => console.log(`v${v.version}: ${v.content}`));
     * ```
     */
    getHistory(memorySpaceId: string, memoryId: string): Promise<Array<{
        memoryId: string;
        version: number;
        content: string;
        embedding?: number[];
        timestamp: number;
    }>>;
    /**
     * Get memory version at specific point in time (temporal query)
     *
     * @param memorySpaceId - Memory space that contains the memory
     * @param memoryId - Memory ID to query
     * @param timestamp - Point in time to query (Date or Unix timestamp)
     * @returns MemoryVersion that was current at that time, or null
     *
     * @example
     * ```typescript
     * const historicalMemory = await cortex.memory.getAtTimestamp(
     *   'user-123-space',
     *   'mem-password',
     *   new Date('2025-08-01')
     * );
     * if (historicalMemory) {
     *   console.log(`Value on Aug 1: ${historicalMemory.content}`);
     * }
     * ```
     */
    getAtTimestamp(memorySpaceId: string, memoryId: string, timestamp: number | Date): Promise<{
        memoryId: string;
        version: number;
        content: string;
        embedding?: number[];
        timestamp: number;
    } | null>;
}

/**
 * Cortex SDK - Conflict Resolution Prompts
 *
 * LLM prompt templates for nuanced conflict resolution when
 * slot or semantic matching finds potential duplicates.
 */

/**
 * Conflict resolution action types
 */
type ConflictAction = "UPDATE" | "SUPERSEDE" | "NONE" | "ADD";
/**
 * Candidate fact for conflict resolution
 */
interface ConflictCandidate {
    fact: string;
    factType?: string;
    subject?: string;
    predicate?: string;
    object?: string;
    confidence: number;
    tags?: string[];
    /** Embedding for semantic search (v0.30.0+) */
    embedding?: number[];
    /** Named entities mentioned in the fact (v0.31.0+) */
    entities?: Array<{
        name: string;
        type: string;
        fullValue?: string;
    }>;
    /** Subject-predicate-object relations (v0.31.0+) */
    relations?: Array<{
        subject: string;
        predicate: string;
        object: string;
    }>;
}

/**
 * Cortex SDK - Belief Revision Service
 *
 * Main orchestration service for the belief revision pipeline.
 * Determines whether a new fact should CREATE, UPDATE, SUPERSEDE, or be IGNORED.
 *
 * Pipeline flow:
 * 1. Slot matching (fast path)
 * 2. Semantic matching (catch-all)
 * 3. LLM conflict resolution (nuanced decisions)
 * 4. Execute decision
 * 5. Log history
 * 6. Sync to graph
 */

/**
 * LLM client interface for belief revision conflict resolution.
 *
 * This is separate from the base LLMClient to allow for different
 * implementations (e.g., OpenAI, Anthropic) while keeping the
 * belief revision logic generic.
 */
interface BeliefRevisionLLMClient {
    /**
     * Complete a prompt with system and user messages.
     *
     * @param options Completion options
     * @returns The model's response as a string
     */
    complete(options: {
        system: string;
        prompt: string;
        model?: string;
        responseFormat?: "json" | "text";
    }): Promise<string>;
}
/**
 * Configuration for belief revision
 */
interface BeliefRevisionConfig {
    /** Slot matching configuration */
    slotMatching?: {
        /** Enable slot matching (default: true) */
        enabled?: boolean;
        /** Custom predicate classes */
        predicateClasses?: Record<string, string[]>;
    };
    /** Semantic matching configuration */
    semanticMatching?: {
        /** Enable semantic matching (default: true) */
        enabled?: boolean;
        /** Similarity threshold (default: 0.7, lower than dedup's 0.85) */
        threshold?: number;
        /** Max candidates to consider */
        limit?: number;
        /** Embedding function for semantic search */
        generateEmbedding?: (text: string) => Promise<number[]>;
    };
    /** LLM resolution configuration */
    llmResolution?: {
        /** Enable LLM resolution (default: true if llmClient provided) */
        enabled?: boolean;
        /** Custom model to use */
        model?: string;
    };
    /** History logging configuration */
    history?: {
        /** Enable history logging (default: true) */
        enabled?: boolean;
        /** Days to retain history */
        retentionDays?: number;
    };
}
/**
 * Parameters for the revise operation
 */
interface ReviseParams {
    /** Memory space to operate in */
    memorySpaceId: string;
    /** The new fact to evaluate */
    fact: ConflictCandidate;
    /** Optional user ID filter */
    userId?: string;
    /** Optional participant ID */
    participantId?: string;
    /** Multi-tenancy: SaaS platform isolation */
    tenantId?: string;
    /** Source type for provenance tracking */
    sourceType?: "conversation" | "system" | "tool" | "manual" | "a2a";
    /** Source reference for provenance tracking */
    sourceRef?: {
        conversationId?: string;
        messageIds?: string[];
        memoryId?: string;
    };
}
/**
 * Result of the revise operation
 */
interface ReviseResult {
    /** The action that was taken */
    action: ConflictAction;
    /** The resulting fact record */
    fact: FactRecord;
    /** Facts that were superseded (if any) */
    superseded: FactRecord[];
    /** Explanation for the decision */
    reason: string;
    /** Confidence in the decision */
    confidence: number;
    /** Pipeline stages that were executed */
    pipeline: {
        slotMatching?: {
            executed: boolean;
            matched: boolean;
            factIds?: string[];
        };
        semanticMatching?: {
            executed: boolean;
            matched: boolean;
            factIds?: string[];
        };
        subjectTypeMatching?: {
            executed: boolean;
            matched: boolean;
            factIds?: string[];
        };
        llmResolution?: {
            executed: boolean;
            decision?: ConflictAction;
        };
    };
}
/**
 * Result of conflict check (preview without execution)
 */
interface ConflictCheckResult {
    /** Whether conflicts were found */
    hasConflicts: boolean;
    /** Slot-based conflicts */
    slotConflicts: FactRecord[];
    /** Semantic conflicts */
    semanticConflicts: Array<{
        fact: FactRecord;
        score: number;
    }>;
    /** Recommended action (without executing) */
    recommendedAction: ConflictAction;
    /** Recommendation reason */
    reason: string;
}

/**
 * Cortex SDK - Fact History Service
 *
 * SDK wrapper for fact change history operations.
 * Provides audit trail for belief revision decisions.
 */

/**
 * Fact change action types
 */
type FactChangeAction = "CREATE" | "UPDATE" | "SUPERSEDE" | "DELETE";
/**
 * Pipeline information for a change event
 */
interface FactChangePipeline {
    slotMatching?: boolean;
    semanticMatching?: boolean;
    llmResolution?: boolean;
}
/**
 * Fact change event record
 */
interface FactChangeEvent {
    eventId: string;
    factId: string;
    memorySpaceId: string;
    action: FactChangeAction;
    oldValue?: string;
    newValue?: string;
    supersededBy?: string;
    supersedes?: string;
    reason?: string;
    confidence?: number;
    pipeline?: FactChangePipeline;
    userId?: string;
    participantId?: string;
    conversationId?: string;
    timestamp: number;
}
/**
 * Filter for querying change events
 */
interface ChangeFilter {
    memorySpaceId: string;
    after?: Date;
    before?: Date;
    action?: FactChangeAction;
    limit?: number;
    offset?: number;
}
/**
 * Activity summary for a time period
 */
interface ActivitySummary {
    timeRange: {
        hours: number;
        since: string;
        until: string;
    };
    totalEvents: number;
    actionCounts: {
        CREATE: number;
        UPDATE: number;
        SUPERSEDE: number;
        DELETE: number;
    };
    uniqueFactsModified: number;
    activeParticipants: number;
}
/**
 * Supersession chain entry
 */
interface SupersessionChainEntry {
    factId: string;
    supersededBy: string | null;
    timestamp: number;
    reason?: string;
}

/**
 * Cortex SDK - Facts API (Layer 3)
 *
 * Structured knowledge with versioning and relationships
 */

/**
 * Extended options for storing facts with deduplication
 */
interface StoreFactWithDedupOptions extends StoreFactOptions {
    /**
     * Deduplication configuration. Set to false to disable deduplication.
     *
     * - 'semantic': Embedding-based similarity (most accurate, requires generateEmbedding)
     * - 'structural': Subject + predicate + object match (fast, good accuracy)
     * - 'exact': Normalized text match (fastest, lowest accuracy)
     * - false: Disable deduplication
     *
     * @default undefined (no deduplication at facts.store level)
     */
    deduplication?: DeduplicationConfig | DeduplicationStrategy | false;
}
declare class FactsAPI {
    private client;
    private graphAdapter?;
    private resilience?;
    private deduplicationService;
    private beliefRevisionService?;
    private historyService;
    private llmClient?;
    private authContext?;
    constructor(client: ConvexClient, graphAdapter?: GraphAdapter | undefined, resilience?: ResilienceLayer | undefined, authContext?: AuthContext, llmClient?: BeliefRevisionLLMClient, beliefRevisionConfig?: BeliefRevisionConfig);
    /**
     * Configure or update the belief revision service
     */
    configureBeliefRevision(llmClient?: BeliefRevisionLLMClient, config?: BeliefRevisionConfig): void;
    /**
     * Check if belief revision is configured and available
     *
     * @returns true if belief revision service is initialized
     *
     * @example
     * ```typescript
     * if (facts.hasBeliefRevision()) {
     *   // Use revise() for intelligent fact management
     *   await facts.revise({ ... });
     * } else {
     *   // Fall back to storeWithDedup()
     *   await facts.storeWithDedup({ ... });
     * }
     * ```
     */
    hasBeliefRevision(): boolean;
    /**
     * Handle ConvexError from direct Convex calls
     */
    private handleConvexError;
    /**
     * Execute an operation through the resilience layer (if available)
     */
    private executeWithResilience;
    /**
     * Store a new fact
     *
     * @example
     * ```typescript
     * const fact = await cortex.facts.store({
     *   memorySpaceId: 'space-1',
     *   fact: 'User prefers dark mode',
     *   factType: 'preference',
     *   subject: 'user-123',
     *   confidence: 95,
     *   sourceType: 'conversation',
     *   tags: ['ui', 'preferences'],
     * });
     * ```
     */
    store(params: StoreFactParams, _options?: StoreFactOptions): Promise<FactRecord>;
    /**
     * Store a fact with cross-session deduplication
     *
     * This method checks for existing similar facts before storing.
     * If a duplicate is found:
     * - If the new fact has higher confidence, the existing fact is updated
     * - Otherwise, the existing fact is returned without creating a duplicate
     *
     * @example
     * ```typescript
     * const result = await cortex.facts.storeWithDedup(
     *   {
     *     memorySpaceId: 'space-1',
     *     fact: 'User prefers dark mode',
     *     factType: 'preference',
     *     subject: 'user-123',
     *     confidence: 95,
     *     sourceType: 'conversation',
     *   },
     *   {
     *     deduplication: {
     *       strategy: 'semantic',
     *       generateEmbedding: embedFn,
     *     },
     *   }
     * );
     *
     * if (result.wasUpdated) {
     *   console.log('Updated existing fact:', result.fact.factId);
     * } else {
     *   console.log('Created new fact:', result.fact.factId);
     * }
     * ```
     */
    storeWithDedup(params: StoreFactParams, options?: StoreFactWithDedupOptions): Promise<StoreWithDedupResult>;
    /**
     * Get fact by ID
     *
     * @example
     * ```typescript
     * const fact = await cortex.facts.get('space-1', 'fact-123');
     * ```
     */
    get(memorySpaceId: string, factId: string): Promise<FactRecord | null>;
    /**
     * List facts with filters
     *
     * @example
     * ```typescript
     * const facts = await cortex.facts.list({
     *   memorySpaceId: 'space-1',
     *   factType: 'preference',
     *   subject: 'user-123',
     * });
     * ```
     */
    list(filter: ListFactsFilter): Promise<FactRecord[]>;
    /**
     * Count facts
     *
     * @example
     * ```typescript
     * const count = await cortex.facts.count({
     *   memorySpaceId: 'space-1',
     *   factType: 'knowledge',
     * });
     * ```
     */
    count(filter: CountFactsFilter): Promise<number>;
    /**
     * Search facts
     *
     * @example
     * ```typescript
     * const results = await cortex.facts.search('space-1', 'password', {
     *   factType: 'knowledge',
     *   minConfidence: 80,
     * });
     * ```
     */
    search(memorySpaceId: string, query: string, options?: SearchFactsOptions): Promise<FactRecord[]>;
    /**
     * Semantic search for facts using vector embeddings (v0.30.0+)
     *
     * Uses cosine similarity to find semantically related facts,
     * unlike text search which requires keyword matching.
     *
     * @param memorySpaceId - The memory space to search in
     * @param embedding - The query embedding vector
     * @param options - Search options (filters, limits, etc.)
     * @returns Array of matching fact records
     *
     * @example
     * ```typescript
     * const embedding = await generateEmbedding('user preferences');
     * const facts = await cortex.facts.semanticSearch('space-1', embedding, {
     *   minConfidence: 80,
     *   limit: 10,
     * });
     * ```
     */
    semanticSearch(memorySpaceId: string, embedding: number[], options?: SemanticSearchFactsOptions): Promise<FactRecord[]>;
    /**
     * Update fact (creates new version)
     *
     * @example
     * ```typescript
     * const updated = await cortex.facts.update('space-1', 'fact-123', {
     *   fact: 'Updated fact statement',
     *   confidence: 99,
     * });
     * ```
     */
    update(memorySpaceId: string, factId: string, updates: UpdateFactInput, _options?: UpdateFactOptions): Promise<FactRecord>;
    /**
     * Delete fact (soft delete - marks as invalidated)
     *
     * @example
     * ```typescript
     * await cortex.facts.delete('space-1', 'fact-123');
     * ```
     */
    delete(memorySpaceId: string, factId: string, _options?: DeleteFactOptions): Promise<{
        deleted: boolean;
        factId: string;
    }>;
    /**
     * Delete multiple facts matching filters in a single operation
     *
     * @example
     * ```typescript
     * // Delete all facts in a memory space
     * const result = await cortex.facts.deleteMany({
     *   memorySpaceId: 'space-1',
     * });
     *
     * // Delete all facts for a specific user (GDPR compliance)
     * const gdprResult = await cortex.facts.deleteMany({
     *   memorySpaceId: 'space-1',
     *   userId: 'user-to-delete',
     * });
     *
     * // Delete all preference facts
     * const prefResult = await cortex.facts.deleteMany({
     *   memorySpaceId: 'space-1',
     *   factType: 'preference',
     * });
     * ```
     */
    deleteMany(params: DeleteManyFactsParams): Promise<DeleteManyFactsResult>;
    /**
     * Get fact version history
     *
     * @example
     * ```typescript
     * const history = await cortex.facts.getHistory('space-1', 'fact-123');
     * ```
     */
    getHistory(memorySpaceId: string, factId: string): Promise<FactRecord[]>;
    /**
     * Query facts by subject (entity-centric view)
     *
     * @example
     * ```typescript
     * const userFacts = await cortex.facts.queryBySubject({
     *   memorySpaceId: 'space-1',
     *   subject: 'user-123',
     *   factType: 'preference',
     * });
     * ```
     */
    queryBySubject(filter: QueryBySubjectFilter): Promise<FactRecord[]>;
    /**
     * Query facts by relationship (graph traversal)
     *
     * @example
     * ```typescript
     * const workPlaces = await cortex.facts.queryByRelationship({
     *   memorySpaceId: 'space-1',
     *   subject: 'user-123',
     *   predicate: 'works_at',
     * });
     * ```
     */
    queryByRelationship(filter: QueryByRelationshipFilter): Promise<FactRecord[]>;
    /**
     * Export facts
     *
     * @example
     * ```typescript
     * const exported = await cortex.facts.export({
     *   memorySpaceId: 'space-1',
     *   format: 'jsonld',
     * });
     * ```
     */
    export(options: {
        memorySpaceId: string;
        format: "json" | "jsonld" | "csv";
        factType?: "preference" | "identity" | "knowledge" | "relationship" | "event" | "observation" | "custom";
    }): Promise<{
        format: string;
        data: string;
        count: number;
        exportedAt: number;
    }>;
    /**
     * Consolidate duplicate facts
     *
     * @example
     * ```typescript
     * await cortex.facts.consolidate({
     *   memorySpaceId: 'space-1',
     *   factIds: ['fact-1', 'fact-2', 'fact-3'],
     *   keepFactId: 'fact-1',
     * });
     * ```
     */
    consolidate(params: {
        memorySpaceId: string;
        factIds: string[];
        keepFactId: string;
    }): Promise<{
        consolidated: boolean;
        keptFactId: string;
        mergedCount: number;
    }>;
    /**
     * Revise a fact using the belief revision pipeline
     *
     * This method intelligently determines whether a new fact should:
     * - CREATE: Add as new fact (no conflicts)
     * - UPDATE: Merge with existing fact (refinement)
     * - SUPERSEDE: Replace existing fact (contradiction)
     * - NONE: Skip (duplicate)
     *
     * @example
     * ```typescript
     * const result = await cortex.facts.revise({
     *   memorySpaceId: 'space-1',
     *   fact: {
     *     fact: 'User prefers purple',
     *     subject: 'user-123',
     *     predicate: 'favorite color',
     *     object: 'purple',
     *     confidence: 90,
     *   },
     * });
     *
     * console.log(`Action: ${result.action}, Reason: ${result.reason}`);
     * ```
     */
    revise(params: ReviseParams): Promise<ReviseResult>;
    /**
     * Check for conflicts without executing (preview mode)
     *
     * Useful for showing users what would happen before committing.
     *
     * @example
     * ```typescript
     * const conflicts = await cortex.facts.checkConflicts({
     *   memorySpaceId: 'space-1',
     *   fact: {
     *     fact: 'User prefers purple',
     *     subject: 'user-123',
     *     predicate: 'favorite color',
     *     object: 'purple',
     *     confidence: 90,
     *   },
     * });
     *
     * if (conflicts.hasConflicts) {
     *   console.log(`Found ${conflicts.slotConflicts.length} slot conflicts`);
     *   console.log(`Recommended action: ${conflicts.recommendedAction}`);
     * }
     * ```
     */
    checkConflicts(params: ReviseParams): Promise<ConflictCheckResult>;
    /**
     * Manually supersede a fact
     *
     * Marks an existing fact as superseded by a new fact.
     * This creates an audit trail and maintains history.
     *
     * @example
     * ```typescript
     * await cortex.facts.supersede({
     *   memorySpaceId: 'space-1',
     *   oldFactId: 'fact-old',
     *   newFactId: 'fact-new',
     *   reason: 'User explicitly corrected this information',
     * });
     * ```
     */
    supersede(params: {
        memorySpaceId: string;
        oldFactId: string;
        newFactId: string;
        reason?: string;
    }): Promise<{
        superseded: boolean;
        oldFactId: string;
        newFactId: string;
    }>;
    /**
     * Get change history for a fact
     *
     * Returns the audit trail of all changes to a fact.
     *
     * @example
     * ```typescript
     * const history = await cortex.facts.history('fact-123');
     * for (const event of history) {
     *   console.log(`${event.action} at ${new Date(event.timestamp)}: ${event.reason}`);
     * }
     * ```
     */
    history(factId: string, limit?: number): Promise<FactChangeEvent[]>;
    /**
     * Get change events for a memory space in a time range
     *
     * @example
     * ```typescript
     * const changes = await cortex.facts.getChanges({
     *   memorySpaceId: 'space-1',
     *   after: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
     *   action: 'SUPERSEDE',
     * });
     * ```
     */
    getChanges(filter: ChangeFilter): Promise<FactChangeEvent[]>;
    /**
     * Get the supersession chain for a fact
     *
     * Shows the evolution of knowledge over time.
     *
     * @example
     * ```typescript
     * const chain = await cortex.facts.getSupersessionChain('fact-latest');
     * // Returns: [oldest] -> [older] -> [old] -> [current]
     * ```
     */
    getSupersessionChain(factId: string): Promise<SupersessionChainEntry[]>;
    /**
     * Get activity summary for a memory space
     *
     * @example
     * ```typescript
     * const summary = await cortex.facts.getActivitySummary('space-1', 24); // Last 24 hours
     * console.log(`Total events: ${summary.totalEvents}`);
     * console.log(`Creates: ${summary.actionCounts.CREATE}`);
     * ```
     */
    getActivitySummary(memorySpaceId: string, hours?: number): Promise<ActivitySummary>;
}

/**
 * Cortex SDK - Context Chains API
 *
 * Hierarchical workflow coordination for multi-agent tasks
 */

interface ContextVersion {
    version: number;
    status: string;
    data?: Record<string, unknown>;
    timestamp: number;
    updatedBy?: string;
}
interface Context {
    _id: string;
    contextId: string;
    memorySpaceId: string;
    tenantId?: string;
    purpose: string;
    description?: string;
    userId?: string;
    parentId?: string;
    rootId?: string;
    depth: number;
    childIds: string[];
    status: "active" | "completed" | "cancelled" | "blocked";
    conversationRef?: {
        conversationId: string;
        messageIds?: string[];
    };
    participants: string[];
    grantedAccess?: Array<{
        memorySpaceId: string;
        scope: string;
        grantedAt: number;
    }>;
    data?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    version: number;
    previousVersions?: ContextVersion[];
    createdAt: number;
    updatedAt: number;
    completedAt?: number;
}
interface ContextChain {
    current: Context;
    parent?: Context;
    root: Context;
    children: Context[];
    siblings: Context[];
    ancestors: Context[];
    descendants: Context[];
    depth: number;
    totalNodes: number;
}
interface ContextWithConversation extends ContextChain {
    conversation?: {
        _id: string;
        conversationId: string;
        messages: Array<{
            id: string;
            role: string;
            content: string;
            timestamp: number;
        }>;
    };
    triggerMessages?: Array<{
        id: string;
        role: string;
        content: string;
        timestamp: number;
    }>;
}
interface CreateContextParams {
    purpose: string;
    memorySpaceId: string;
    description?: string;
    userId?: string;
    parentId?: string;
    conversationRef?: {
        conversationId: string;
        messageIds?: string[];
    };
    data?: Record<string, unknown>;
    status?: "active" | "completed" | "cancelled" | "blocked";
}
interface UpdateContextParams {
    status?: "active" | "completed" | "cancelled" | "blocked";
    description?: string;
    data?: Record<string, unknown>;
    completedAt?: number;
}
interface ListContextsFilter {
    memorySpaceId?: string;
    userId?: string;
    status?: "active" | "completed" | "cancelled" | "blocked";
    parentId?: string;
    rootId?: string;
    depth?: number;
    limit?: number;
}
interface CountContextsFilter {
    memorySpaceId?: string;
    userId?: string;
    status?: "active" | "completed" | "cancelled" | "blocked";
}

declare class ContextsAPI {
    private client;
    private graphAdapter?;
    private resilience?;
    private authContext?;
    constructor(client: ConvexClient, graphAdapter?: GraphAdapter | undefined, resilience?: ResilienceLayer | undefined, authContext?: AuthContext | undefined);
    /**
     * Execute an operation through the resilience layer (if available)
     */
    private executeWithResilience;
    /**
     * Handle ConvexError from direct Convex calls
     */
    private handleConvexError;
    /**
     * Create a new context
     *
     * @example
     * ```typescript
     * const context = await cortex.contexts.create({
     *   purpose: 'Process customer refund',
     *   memorySpaceId: 'supervisor-space',
     *   userId: 'user-123',
     *   conversationRef: {
     *     conversationId: 'conv-456',
     *     messageIds: ['msg-089'],
     *   },
     * });
     * ```
     */
    create(params: CreateContextParams, _options?: CreateContextOptions): Promise<Context>;
    /**
     * Get context by ID
     *
     * @example
     * ```typescript
     * const context = await cortex.contexts.get('ctx-123');
     *
     * // Get with full chain
     * const chain = await cortex.contexts.get('ctx-123', { includeChain: true });
     *
     * // Get with conversation context
     * const enriched = await cortex.contexts.get('ctx-123', {
     *   includeChain: true,
     *   includeConversation: true
     * });
     * ```
     */
    get(contextId: string, options?: {
        includeChain?: false;
        includeConversation?: boolean;
    }): Promise<Context | null>;
    get(contextId: string, options: {
        includeChain: true;
        includeConversation: true;
    }): Promise<ContextChain | ContextWithConversation | null>;
    get(contextId: string, options: {
        includeChain: true;
        includeConversation?: false;
    }): Promise<ContextChain | null>;
    get(contextId: string, options: {
        includeChain?: boolean;
        includeConversation?: boolean;
    }): Promise<Context | ContextChain | ContextWithConversation | null>;
    /**
     * Update a context
     *
     * @example
     * ```typescript
     * await cortex.contexts.update('ctx-123', {
     *   status: 'completed',
     *   data: { result: 'success' },
     * });
     * ```
     */
    update(contextId: string, updates: UpdateContextParams, _options?: UpdateContextOptions): Promise<Context>;
    /**
     * Delete a context
     *
     * @example
     * ```typescript
     * // Delete single context (must have no children)
     * await cortex.contexts.delete('ctx-123');
     *
     * // Delete context and all descendants
     * await cortex.contexts.delete('ctx-123', { cascadeChildren: true });
     *
     * // Allow orphaning (remove parent, keep children as new roots)
     * await cortex.contexts.delete('ctx-123', { orphanChildren: true });
     * ```
     */
    delete(contextId: string, options?: DeleteContextOptions & {
        cascadeChildren?: boolean;
        orphanChildren?: boolean;
    }): Promise<{
        deleted: boolean;
        contextId: string;
        descendantsDeleted: number;
        orphanedChildren?: string[];
    }>;
    /**
     * List contexts
     *
     * @example
     * ```typescript
     * const contexts = await cortex.contexts.list({
     *   memorySpaceId: 'finance-space',
     *   status: 'active',
     * });
     * ```
     */
    list(filter?: ListContextsFilter): Promise<Context[]>;
    /**
     * Count contexts
     *
     * @example
     * ```typescript
     * const count = await cortex.contexts.count({
     *   memorySpaceId: 'supervisor-space',
     *   status: 'active',
     * });
     * ```
     */
    count(filter?: CountContextsFilter): Promise<number>;
    /**
     * Search contexts (alias for list with filters)
     *
     * @example
     * ```typescript
     * const contexts = await cortex.contexts.search({
     *   userId: 'user-123',
     *   status: 'active',
     * });
     * ```
     */
    search(filter?: ListContextsFilter): Promise<Context[]>;
    /**
     * Get complete chain from any context
     *
     * @example
     * ```typescript
     * const chain = await cortex.contexts.getChain('ctx-child');
     * console.log(chain.root.purpose);
     * console.log(chain.children.length);
     * ```
     */
    getChain(contextId: string): Promise<ContextChain>;
    /**
     * Get root context
     *
     * @example
     * ```typescript
     * const root = await cortex.contexts.getRoot('ctx-deeply-nested');
     * ```
     */
    getRoot(contextId: string): Promise<Context>;
    /**
     * Get children of a context
     *
     * @example
     * ```typescript
     * const children = await cortex.contexts.getChildren('ctx-root');
     *
     * // Get all descendants recursively
     * const all = await cortex.contexts.getChildren('ctx-root', { recursive: true });
     * ```
     */
    getChildren(contextId: string, options?: {
        status?: "active" | "completed" | "cancelled" | "blocked";
        recursive?: boolean;
    }): Promise<Context[]>;
    /**
     * Add participant to context
     *
     * @example
     * ```typescript
     * await cortex.contexts.addParticipant('ctx-123', 'legal-agent-space');
     * ```
     */
    addParticipant(contextId: string, participantId: string): Promise<Context>;
    /**
     * Grant cross-space access to a context (Collaboration Mode)
     *
     * @example
     * ```typescript
     * await cortex.contexts.grantAccess('ctx-123', 'partner-space', 'read-only');
     * ```
     */
    grantAccess(contextId: string, targetMemorySpaceId: string, scope: string): Promise<Context>;
    /**
     * Update many contexts matching filters
     *
     * @example
     * ```typescript
     * await cortex.contexts.updateMany(
     *   { status: 'completed', completedBefore: Date.now() - 30*24*60*60*1000 },
     *   { data: { archived: true } }
     * );
     * ```
     */
    updateMany(filters: {
        memorySpaceId?: string;
        userId?: string;
        status?: "active" | "completed" | "cancelled" | "blocked";
        parentId?: string;
        rootId?: string;
    }, updates: {
        status?: "active" | "completed" | "cancelled" | "blocked";
        data?: Record<string, unknown>;
    }): Promise<{
        updated: number;
        contextIds: string[];
    }>;
    /**
     * Delete many contexts matching filters
     *
     * @example
     * ```typescript
     * await cortex.contexts.deleteMany({
     *   status: 'cancelled',
     *   completedBefore: Date.now() - 90*24*60*60*1000
     * }, { cascadeChildren: true });
     * ```
     */
    deleteMany(filters: {
        memorySpaceId?: string;
        userId?: string;
        status?: "active" | "completed" | "cancelled" | "blocked";
        completedBefore?: number;
    }, options?: {
        cascadeChildren?: boolean;
    }): Promise<{
        deleted: number;
        contextIds: string[];
    }>;
    /**
     * Export contexts to JSON or CSV
     *
     * @example
     * ```typescript
     * const exported = await cortex.contexts.export(
     *   { userId: 'user-123' },
     *   { format: 'json', includeChain: true, includeVersionHistory: true }
     * );
     * ```
     */
    export(filters?: {
        memorySpaceId?: string;
        userId?: string;
        status?: "active" | "completed" | "cancelled" | "blocked";
    }, options?: {
        format: "json" | "csv";
        includeChain?: boolean;
        includeVersionHistory?: boolean;
    }): Promise<{
        format: string;
        data: string;
        count: number;
        exportedAt: number;
    }>;
    /**
     * Remove participant from context
     *
     * @example
     * ```typescript
     * await cortex.contexts.removeParticipant('ctx-123', 'old-agent-space');
     * ```
     */
    removeParticipant(contextId: string, participantId: string): Promise<Context>;
    /**
     * Get all contexts originating from a specific conversation
     *
     * @example
     * ```typescript
     * const contexts = await cortex.contexts.getByConversation('conv-456');
     * ```
     */
    getByConversation(conversationId: string): Promise<Context[]>;
    /**
     * Find contexts whose parent no longer exists
     *
     * @example
     * ```typescript
     * const orphaned = await cortex.contexts.findOrphaned();
     * console.log(`Found ${orphaned.length} orphaned contexts`);
     * ```
     */
    findOrphaned(): Promise<Context[]>;
    /**
     * Get specific version of a context
     *
     * @example
     * ```typescript
     * const v1 = await cortex.contexts.getVersion('ctx-123', 1);
     * ```
     */
    getVersion(contextId: string, version: number): Promise<{
        version: number;
        status: string;
        data?: Record<string, unknown>;
        timestamp: number;
        updatedBy?: string;
    } | null>;
    /**
     * Get all versions of a context
     *
     * @example
     * ```typescript
     * const history = await cortex.contexts.getHistory('ctx-123');
     * console.log(`Context has ${history.length} versions`);
     * ```
     */
    getHistory(contextId: string): Promise<Array<{
        version: number;
        status: string;
        data?: Record<string, unknown>;
        timestamp: number;
        updatedBy?: string;
    }>>;
    /**
     * Get context state at specific point in time
     *
     * @example
     * ```typescript
     * const historical = await cortex.contexts.getAtTimestamp(
     *   'ctx-123',
     *   new Date('2025-10-20')
     * );
     * ```
     */
    getAtTimestamp(contextId: string, timestamp: Date): Promise<{
        version: number;
        status: string;
        data?: Record<string, unknown>;
        timestamp: number;
        updatedBy?: string;
    } | null>;
}

/**
 * Governance API Validation
 *
 * Client-side validation for governance operations to catch errors before
 * they reach the backend, providing faster feedback and better error messages.
 */

/**
 * Custom error class for governance validation failures
 */
declare class GovernanceValidationError extends Error {
    readonly code: string;
    readonly field?: string | undefined;
    constructor(message: string, code: string, field?: string | undefined);
}

/**
 * Governance API - Data Retention, Purging, and Compliance Rules
 *
 * Centralized control over data retention, purging, and compliance rules
 * across all Cortex storage layers.
 */

/**
 * Manual enforcement requires a trusted backend worker. The current worker
 * adapter records simulations; actual retention deletion is not implemented.
 */
declare class GovernanceCapabilityError extends Error {
    readonly code = "BACKEND_ENFORCEMENT_ONLY";
    readonly retryable = false;
    readonly outcome = "not_dispatched";
    readonly requiredExecution = "trusted_backend_worker";
    readonly enforcementAdapter = "SIMULATION";
    constructor();
}
declare class GovernanceAPI {
    private readonly client;
    private readonly _graphAdapter?;
    private readonly resilience?;
    constructor(client: ConvexClient, _graphAdapter?: unknown | undefined, resilience?: ResilienceLayer | undefined);
    /**
     * Execute an operation through the resilience layer (if available)
     */
    private executeWithResilience;
    /**
     * Set governance policy for organization or memory space
     *
     * @param policy - Complete governance policy
     * @returns Policy result with confirmation
     *
     * @example
     * ```typescript
     * await cortex.governance.setPolicy({
     *   organizationId: "org-123",
     *   conversations: {
     *     retention: { deleteAfter: "7y", purgeOnUserRequest: true },
     *     purging: { autoDelete: true, deleteInactiveAfter: "2y" }
     *   },
     *   compliance: { mode: "GDPR", dataRetentionYears: 7, auditLogging: true }
     * });
     * ```
     */
    setPolicy(policy: GovernancePolicy): Promise<PolicyResult>;
    /**
     * Get current governance policy
     *
     * @param scope - Optional organization or memory space scope
     * @returns Current policy (includes org defaults + overrides)
     *
     * @example
     * ```typescript
     * // Get org-wide policy
     * const orgPolicy = await cortex.governance.getPolicy({
     *   organizationId: "org-123"
     * });
     *
     * // Get memory-space-specific policy (includes org defaults)
     * const spacePolicy = await cortex.governance.getPolicy({
     *   memorySpaceId: "audit-agent-space"
     * });
     * ```
     */
    getPolicy(scope?: PolicyScope): Promise<GovernancePolicy>;
    /**
     * Override policy for specific memory space
     *
     * @param memorySpaceId - Memory space to override
     * @param overrides - Partial policy to override org defaults
     *
     * @example
     * ```typescript
     * // Audit agent needs unlimited retention
     * await cortex.governance.setAgentOverride("audit-agent", {
     *   vector: {
     *     retention: { defaultVersions: -1 } // Unlimited
     *   }
     * });
     * ```
     */
    setAgentOverride(memorySpaceId: string, overrides: Partial<GovernancePolicy>): Promise<void>;
    /**
     * Get compliance template (GDPR, HIPAA, SOC2, FINRA)
     *
     * @param template - Template name
     * @returns Pre-configured policy for compliance standard
     *
     * @example
     * ```typescript
     * const gdprPolicy = await cortex.governance.getTemplate("GDPR");
     * await cortex.governance.setPolicy({
     *   organizationId: "org-123",
     *   ...gdprPolicy
     * });
     * ```
     */
    getTemplate(template: ComplianceTemplate): Promise<GovernancePolicy>;
    /**
     * Validate a manual enforcement request and reject client-side execution.
     *
     * Enforcement is internal to trusted backend workers. This client method
     * dispatches no request and does not enter the resilience layer. The current
     * backend adapter records simulations only; actual retention deletion,
     * including automatic retention enforcement, is not implemented.
     *
     * @param options - Enforcement options (layers, rules)
     * @throws {GovernanceValidationError} If the options are invalid.
     * @throws {GovernanceCapabilityError} For valid options; requires a trusted
     * backend worker, is not retryable, and has outcome `not_dispatched`.
     */
    enforce(options: EnforcementOptions): Promise<EnforcementResult>;
    /**
     * Simulate policy impact without applying
     *
     * Previews what would happen if a policy were applied, without actually
     * applying it. Useful for testing policy changes before committing.
     *
     * @param options - Simulation options (policy to test)
     * @returns Simulation result with impact analysis
     *
     * @example
     * ```typescript
     * const impact = await cortex.governance.simulate({
     *   organizationId: "org-123",
     *   vector: {
     *     retention: {
     *       byImportance: [{ range: [0, 30], versions: 1 }]
     *     }
     *   }
     * });
     * console.log(`Would delete ${impact.versionsAffected} versions`);
     * console.log(`Would save ${impact.storageFreed} MB`);
     * console.log(`Estimated savings: $${impact.costSavings}/month`);
     * ```
     */
    simulate(options: SimulationOptions): Promise<SimulationResult>;
    /**
     * Generate compliance report
     *
     * Creates a detailed compliance report showing policy adherence,
     * data retention status, and user request fulfillment.
     *
     * @param options - Report options (org, period)
     * @returns Compliance report
     *
     * @example
     * ```typescript
     * const report = await cortex.governance.getComplianceReport({
     *   organizationId: "org-123",
     *   period: {
     *     start: new Date("2025-01-01"),
     *     end: new Date("2025-10-31")
     *   }
     * });
     * console.log(`Status: ${report.conversations.complianceStatus}`);
     * ```
     */
    getComplianceReport(options: ComplianceReportOptions): Promise<ComplianceReport>;
    /**
     * Get enforcement statistics
     *
     * Returns statistics about policy enforcement over a time period.
     * Shows what has been purged, storage freed, and cost savings.
     *
     * @param options - Stats options (period)
     * @returns Enforcement statistics
     *
     * @example
     * ```typescript
     * const stats = await cortex.governance.getEnforcementStats({
     *   period: "30d"
     * });
     * console.log(`Vector versions deleted: ${stats.vector.versionsDeleted}`);
     * console.log(`Storage freed: ${stats.storageFreed} MB`);
     * console.log(`Cost savings: $${stats.costSavings}`);
     * ```
     */
    getEnforcementStats(options: EnforcementStatsOptions): Promise<EnforcementStats>;
}

/**
 * A2A API Validation
 *
 * Client-side validation for A2A operations to catch errors before
 * they reach the backend, providing faster feedback and better error messages.
 */

/**
 * Custom error class for A2A validation failures
 */
declare class A2AValidationError extends Error {
    readonly code: string;
    readonly field?: string | undefined;
    readonly name = "A2AValidationError";
    constructor(message: string, code: string, field?: string | undefined);
}

/**
 * A2A Communication API
 *
 * Agent-to-agent communication helpers with optional pub/sub support.
 * Provides convenience wrappers over the memory system with source.type='a2a'.
 *
 * Operations:
 * - send(): Fire-and-forget message (no pub/sub required)
 * - request(): Synchronous request-response (requires pub/sub)
 * - broadcast(): One-to-many communication (pub/sub optimal)
 * - getConversation(): Retrieve conversation history (no pub/sub required)
 */

declare class A2AAPI {
    private readonly client;
    private readonly _graphAdapter?;
    private readonly resilience?;
    constructor(client: ConvexClient, _graphAdapter?: unknown | undefined, resilience?: ResilienceLayer | undefined);
    /**
     * Execute an operation through the resilience layer (if available)
     */
    private executeWithResilience;
    /**
     * Send a message from one agent to another.
     * Stores in ACID conversation + both agents' Vector memories.
     *
     * No pub/sub required - this is fire-and-forget.
     *
     * @param params - Send parameters
     * @returns A2A message result
     *
     * @example
     * ```typescript
     * const result = await cortex.a2a.send({
     *   from: "sales-agent",
     *   to: "support-agent",
     *   message: "Customer asking about enterprise pricing",
     *   importance: 70
     * });
     * console.log(`Message ${result.messageId} sent`);
     * ```
     */
    send(params: A2ASendParams): Promise<A2AMessage>;
    /**
     * Send a request and wait for response (synchronous request-response).
     *
     * REQUIRES PUB/SUB INFRASTRUCTURE:
     * - Direct Mode: Configure your own Redis/RabbitMQ/NATS adapter
     * - Cloud Mode: Pub/sub infrastructure included automatically
     *
     * @param params - Request parameters
     * @returns A2A response
     * @throws A2ATimeoutError if no response within timeout
     *
     * @example
     * ```typescript
     * try {
     *   const response = await cortex.a2a.request({
     *     from: "finance-agent",
     *     to: "hr-agent",
     *     message: "What is the Q4 budget?",
     *     timeout: 30000
     *   });
     *   console.log(response.response);
     * } catch (error) {
     *   if (error instanceof A2ATimeoutError) {
     *     console.log("HR agent did not respond within timeout");
     *   }
     * }
     * ```
     */
    request(params: A2ARequestParams): Promise<A2AResponse>;
    /**
     * Broadcast a message to multiple agents.
     *
     * REQUIRES PUB/SUB for optimized delivery confirmation.
     * Without pub/sub, messages are stored but delivery is not confirmed.
     *
     * @param params - Broadcast parameters
     * @returns Broadcast result
     *
     * @example
     * ```typescript
     * const result = await cortex.a2a.broadcast({
     *   from: "manager-agent",
     *   to: ["dev-agent-1", "dev-agent-2", "qa-agent"],
     *   message: "Sprint review meeting Friday at 2 PM",
     *   importance: 70
     * });
     * console.log(`Broadcast to ${result.recipients.length} agents`);
     * console.log(`Created ${result.memoriesCreated} total memories`);
     * ```
     */
    broadcast(params: A2ABroadcastParams): Promise<A2ABroadcastResult>;
    /**
     * Get conversation between two agents with filtering.
     *
     * No pub/sub required - this is a database query only.
     *
     * @param agent1 - First agent ID
     * @param agent2 - Second agent ID
     * @param filters - Optional filters
     * @returns A2A conversation with messages
     *
     * @example
     * ```typescript
     * const convo = await cortex.a2a.getConversation(
     *   "finance-agent",
     *   "hr-agent",
     *   {
     *     since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
     *     minImportance: 70,
     *     tags: ["budget"]
     *   }
     * );
     * console.log(`${convo.messageCount} messages exchanged`);
     * ```
     */
    getConversation(agent1: string, agent2: string, filters?: A2AConversationFilters): Promise<A2AConversation>;
}

/**
 * Cortex SDK - Sessions API Validators
 *
 * Client-side validation for session operations.
 */

/**
 * Validation error for session operations
 */
declare class SessionValidationError extends Error {
    readonly code: string;
    readonly field?: string | undefined;
    constructor(message: string, code: string, field?: string | undefined);
}

/**
 * Cortex SDK - Sessions API
 *
 * Native session management with fully extensible metadata.
 * Sessions are stored in Convex for real-time reactivity.
 */

/** Idle session expiration requires a trusted backend worker. */
declare class SessionCapabilityError extends Error {
    readonly code = "BACKEND_MAINTENANCE_ONLY";
    readonly retryable = false;
    readonly outcome = "not_dispatched";
    readonly requiredExecution = "trusted_backend_worker";
    constructor();
}
/**
 * Sessions API
 *
 * Provides native session management for multi-session applications.
 * Session lifecycle is controlled via governance policies.
 */
declare class SessionsAPI {
    private readonly client;
    private readonly graphAdapter?;
    private readonly resilience?;
    private readonly authContext?;
    constructor(client: ConvexClient, graphAdapter?: GraphAdapter | undefined, resilience?: ResilienceLayer | undefined, authContext?: AuthContext | undefined);
    /**
     * Execute an operation through the resilience layer (if available)
     */
    private executeWithResilience;
    /**
     * Create a new session for a user.
     *
     * @param params - Session creation parameters
     * @returns Created session
     *
     * @example
     * ```typescript
     * const session = await cortex.sessions.create({
     *   userId: 'user-123',
     *   tenantId: 'tenant-456',
     *   memorySpaceId: 'workspace-abc',
     *   metadata: {
     *     device: 'Chrome on macOS',
     *     browser: 'Chrome 120',
     *     ip: '192.168.1.1',
     *     location: 'San Francisco, CA',
     *   },
     * });
     * ```
     */
    create(params: CreateSessionParams): Promise<Session>;
    /**
     * Get a session by ID.
     *
     * @param sessionId - Session ID to retrieve
     * @returns Session or null if not found
     *
     * @example
     * ```typescript
     * const session = await cortex.sessions.get('sess-123');
     * if (session && session.status === 'active') {
     *   console.log('Session is active');
     * }
     * ```
     */
    get(sessionId: string): Promise<Session | null>;
    /**
     * Get or create a session for a user.
     *
     * If the user has an active session, returns it.
     * Otherwise, creates a new session.
     *
     * @param userId - User ID
     * @param metadata - Optional session metadata
     * @returns Session (existing or newly created)
     *
     * @example
     * ```typescript
     * const session = await cortex.sessions.getOrCreate('user-123', {
     *   device: 'Mobile Safari',
     * });
     * ```
     */
    getOrCreate(userId: string, metadata?: Record<string, unknown>): Promise<Session>;
    /**
     * Update session activity timestamp (touch).
     *
     * @param sessionId - Session ID to touch
     *
     * @example
     * ```typescript
     * // Keep session alive during user activity
     * await cortex.sessions.touch('sess-123');
     * ```
     */
    touch(sessionId: string): Promise<void>;
    /**
     * End a session.
     *
     * @param sessionId - Session ID to end
     *
     * @example
     * ```typescript
     * // End session on logout
     * await cortex.sessions.end('sess-123');
     * ```
     */
    end(sessionId: string): Promise<void>;
    /**
     * End all sessions for a user.
     *
     * @param userId - User ID
     * @param options - Optional parameters including tenantId for multi-tenant isolation
     * @returns Result with count of ended sessions
     *
     * @example
     * ```typescript
     * // End all sessions on password change
     * const result = await cortex.sessions.endAll('user-123');
     * console.log(`Ended ${result.ended} sessions`);
     *
     * // End sessions only for a specific tenant (multi-tenant safe)
     * const tenantResult = await cortex.sessions.endAll('admin', {
     *   tenantId: 'tenant-456',
     * });
     * ```
     */
    endAll(userId: string, options?: EndAllOptions): Promise<EndSessionsResult>;
    /**
     * List sessions with filters.
     *
     * @param filters - Filter parameters
     * @returns Array of matching sessions
     *
     * @example
     * ```typescript
     * // List all active sessions for a tenant
     * const sessions = await cortex.sessions.list({
     *   tenantId: 'tenant-456',
     *   status: 'active',
     * });
     * ```
     */
    list(filters: SessionFilters): Promise<Session[]>;
    /**
     * Count sessions with filters.
     *
     * @param filters - Filter parameters
     * @returns Count of matching sessions
     *
     * @example
     * ```typescript
     * const activeCount = await cortex.sessions.count({
     *   tenantId: 'tenant-456',
     *   status: 'active',
     * });
     * ```
     */
    count(filters: SessionFilters): Promise<number>;
    /**
     * Get active sessions for a user.
     *
     * @param userId - User ID
     * @returns Array of active sessions
     *
     * @example
     * ```typescript
     * const active = await cortex.sessions.getActive('user-123');
     * console.log(`User has ${active.length} active sessions`);
     * ```
     */
    getActive(userId: string): Promise<Session[]>;
    /**
     * Request idle session expiration, which requires a trusted backend worker.
     *
     * Valid client requests reject with SessionCapabilityError before dispatch.
     * This method does not perform or schedule automatic session maintenance.
     * Tenant selectors retain the existing SDK auth-context mismatch validation.
     *
     * @param options - Expiration options (idle timeout defaults to 30 minutes)
     * @throws SessionCapabilityError when trusted backend execution is required
     */
    expireIdle(options?: ExpireSessionsOptions): Promise<{
        expired: number;
    }>;
    /**
     * Generate a cryptographically secure unique session ID
     */
    private generateSessionId;
}

/**
 * Cortex SDK - Artifacts API Validation
 *
 * Client-side validation for artifact operations to catch errors before
 * they reach the backend, providing faster feedback and better error messages.
 */
/**
 * Custom error class for artifact validation failures
 */
declare class ArtifactValidationError extends Error {
    readonly code: string;
    readonly field?: string | undefined;
    constructor(message: string, code: string, field?: string | undefined);
}

/**
 * Cortex SDK - Artifacts API
 *
 * Versioned artifact management with full undo/redo support
 *
 * Artifacts are versioned, content-addressable documents that support:
 * - Multiple content types (text, code, sheet, image, diagram, html, custom)
 * - Full undo/redo with version history
 * - Streaming content generation
 * - File attachments
 * - Graph database integration
 */

declare class ArtifactsAPI {
    private readonly client;
    private readonly graphAdapter?;
    private readonly resilience?;
    private readonly authContext?;
    constructor(client: ConvexClient, graphAdapter?: GraphAdapter | undefined, resilience?: ResilienceLayer | undefined, authContext?: AuthContext | undefined);
    /**
     * Execute an operation through the resilience layer (if available)
     */
    private executeWithResilience;
    /**
     * Handle ConvexError from direct Convex calls
     */
    private handleConvexError;
    /**
     * Sync artifact to graph database (if configured)
     */
    private syncToGraph;
    /**
     * Update artifact in graph database
     */
    private updateInGraph;
    /**
     * Delete artifact from graph database
     */
    private deleteFromGraph;
    /**
     * Create a new artifact
     *
     * @example
     * ```typescript
     * const artifact = await cortex.artifacts.create({
     *   memorySpaceId: 'user-123-space',
     *   title: 'Code Snippet',
     *   content: 'function hello() { return "world"; }',
     *   kind: 'code',
     *   tags: ['javascript', 'function'],
     * });
     * console.log(artifact.artifactId); // "art-abc123def456"
     * ```
     */
    create(options: CreateArtifactOptions): Promise<Artifact>;
    /**
     * Get an artifact by ID
     *
     * @example
     * ```typescript
     * const artifact = await cortex.artifacts.get('art-abc123def456');
     * if (artifact) {
     *   console.log(artifact.title, artifact.content);
     * }
     * ```
     */
    get(artifactId: string): Promise<Artifact | null>;
    /**
     * Update an artifact's content (creates a new version)
     *
     * @example
     * ```typescript
     * const updated = await cortex.artifacts.update(
     *   'art-abc123def456',
     *   'function hello() { return "updated world"; }',
     *   { changeSummary: 'Fixed return value' }
     * );
     * console.log(updated.version); // 2
     * ```
     */
    update(artifactId: string, content: string, options?: UpdateArtifactOptions): Promise<Artifact>;
    /**
     * Delete an artifact
     *
     * @param artifactId - The artifact ID to delete
     * @param hard - If true, permanently deletes. If false (default), soft deletes.
     *
     * @example
     * ```typescript
     * const result = await cortex.artifacts.delete('art-abc123def456');
     * console.log(result.deleted); // true
     * ```
     */
    delete(artifactId: string, hard?: boolean): Promise<DeleteArtifactResult>;
    /**
     * List artifacts with filtering
     *
     * @example
     * ```typescript
     * const artifacts = await cortex.artifacts.list({
     *   memorySpaceId: 'user-123-space',
     *   streamingState: 'final',
     *   tags: ['important'],
     *   sortBy: 'updatedAt',
     *   sortOrder: 'desc',
     *   limit: 20,
     * });
     * ```
     */
    list(filter: ListArtifactsFilter): Promise<Artifact[]>;
    /**
     * Count artifacts matching filter
     *
     * @example
     * ```typescript
     * const count = await cortex.artifacts.count({
     *   memorySpaceId: 'user-123-space',
     *   streamingState: 'final',
     * });
     * console.log(`${count} finalized artifacts`);
     * ```
     */
    count(filter: CountArtifactsFilter): Promise<number>;
    /**
     * Undo the last change to an artifact
     *
     * Restores the artifact to its previous version using the version pointer.
     * Does not delete version history - moves the pointer backward.
     *
     * @example
     * ```typescript
     * // Make changes
     * await cortex.artifacts.update('art-abc123', 'version 2 content');
     * await cortex.artifacts.update('art-abc123', 'version 3 content');
     *
     * // Undo to version 2
     * const undone = await cortex.artifacts.undo('art-abc123');
     * console.log(undone.content); // "version 2 content"
     * ```
     *
     * @throws Error if no previous version exists (UNDO_NOT_AVAILABLE)
     */
    undo(artifactId: string): Promise<{
        success: boolean;
        artifactId: string;
        previousVersion: number;
        currentVersion: number;
        canUndo: boolean;
        canRedo: boolean;
    }>;
    /**
     * Redo a previously undone change
     *
     * Restores the artifact to a more recent version after undo.
     * Moves the version pointer forward.
     *
     * @example
     * ```typescript
     * // After undoing
     * await cortex.artifacts.undo('art-abc123');
     *
     * // Redo to restore
     * const redone = await cortex.artifacts.redo('art-abc123');
     * console.log(redone.content); // Back to latest version content
     * ```
     *
     * @throws Error if no newer version exists (REDO_NOT_AVAILABLE)
     */
    redo(artifactId: string): Promise<{
        success: boolean;
        artifactId: string;
        previousVersion: number;
        currentVersion: number;
        canUndo: boolean;
        canRedo: boolean;
    }>;
    /**
     * Get the version history of an artifact
     *
     * @example
     * ```typescript
     * const history = await cortex.artifacts.getHistory('art-abc123');
     * for (const version of history) {
     *   console.log(`v${version.version}: ${version.changeSummary || 'No note'}`);
     * }
     * ```
     */
    getHistory(artifactId: string, options?: GetArtifactHistoryOptions): Promise<ArtifactVersion[]>;
    /**
     * Get a specific version of an artifact
     *
     * @example
     * ```typescript
     * const v2 = await cortex.artifacts.getVersion('art-abc123', 2);
     * console.log(v2.content);
     * ```
     */
    getVersion(artifactId: string, version: number): Promise<ArtifactVersion | null>;
    /**
     * Start a streaming session for an artifact
     *
     * Transitions the artifact to "streaming" state and returns a session ID
     * for appending content chunks.
     *
     * @example
     * ```typescript
     * const { sessionId, artifact } = await cortex.artifacts.startStreaming({
     *   artifactId: 'art-abc123',
     * });
     *
     * // Now append content chunks...
     * await cortex.artifacts.appendContent({
     *   artifactId: 'art-abc123',
     *   sessionId,
     *   chunk: 'First chunk of content...',
     * });
     * ```
     */
    startStreaming(params: StartStreamingParams): Promise<{
        success: boolean;
        sessionId: string;
        artifactId: string;
        startedAt: number;
        previousState: StreamingState;
        currentState: StreamingState;
    }>;
    /**
     * Append a content chunk to a streaming artifact
     *
     * @example
     * ```typescript
     * await cortex.artifacts.appendContent({
     *   artifactId: 'art-abc123',
     *   sessionId: 'session-xyz',
     *   chunk: 'More content...',
     * });
     * ```
     */
    appendContent(params: AppendContentParams): Promise<{
        success: boolean;
        artifactId: string;
        sessionId: string;
        chunkIndex?: number;
        chunkBytes: number;
        totalBytesReceived: number;
        contentLength: number;
        progress?: number;
        timestamp: number;
    }>;
    /**
     * Pause an active streaming session
     *
     * Transitions the artifact to "paused" state. Can be resumed later.
     */
    pauseStreaming(params: StreamingSessionParams): Promise<{
        success: boolean;
        artifactId: string;
        sessionId: string;
        pausedAt: number;
        previousState: string;
        currentState: string;
        bytesReceived: number;
        contentPreserved: boolean;
    }>;
    /**
     * Resume a paused streaming session
     *
     * Transitions the artifact back to "streaming" state.
     */
    resumeStreaming(params: StreamingSessionParams): Promise<{
        success: boolean;
        artifactId: string;
        sessionId: string;
        resumedAt: number;
        previousState: string;
        currentState: string;
        bytesReceived: number;
    }>;
    /**
     * Cancel an active streaming session
     *
     * Transitions the artifact to "draft" state and discards streaming progress.
     */
    cancelStreaming(params: StreamingSessionParams): Promise<{
        success: boolean;
        artifactId: string;
        sessionId: string;
        cancelledAt: number;
        previousState: StreamingState;
        currentState: string;
        contentPreserved: boolean;
        bytesReceived: number;
        contentLength: number;
    }>;
    /**
     * Finalize a streaming session
     *
     * Completes streaming and transitions the artifact to "final" state.
     * Creates a new version in the history.
     *
     * @example
     * ```typescript
     * const final = await cortex.artifacts.finalizeStreaming({
     *   artifactId: 'art-abc123',
     *   sessionId: 'session-xyz',
     *   changeSummary: 'AI-generated code completion',
     * });
     * console.log(final.streamingState); // "final"
     * ```
     */
    finalizeStreaming(params: FinalizeStreamingParams): Promise<{
        success: boolean;
        artifactId: string;
        sessionId: string;
        finalizedAt: number;
        previousState: string;
        currentState: string;
        contentLength: number;
        bytesReceived: number;
        totalDurationMs: number;
        versionCreated: boolean;
        version: number;
    }>;
    /**
     * Set the streaming state of an artifact
     *
     * Directly sets the streaming state. Use with caution - prefer the
     * streaming methods (startStreaming, finalizeStreaming) for proper
     * state transitions.
     *
     * @example
     * ```typescript
     * // Mark as error state
     * await cortex.artifacts.setStreamingState('art-abc123', 'error');
     * ```
     */
    setStreamingState(artifactId: string, streamingState: StreamingState): Promise<{
        success: boolean;
        artifactId: string;
        previousState: StreamingState;
        currentState: StreamingState;
        updatedAt: number;
    }>;
    /**
     * Asset upload and delivery require a qualified authenticated backend capability.
     * This intermediate SDK rejects with AssetCapabilityUnavailableError before
     * transport or file processing; no bearer URL or upload result is returned.
     * Future support uses bounded authenticated Convex upload and delivery.
     *
     * @throws AssetCapabilityUnavailableError with CAPABILITY_UNAVAILABLE
     */
    uploadFile(params: {
        artifactId: string;
        file: Blob;
        filename: string;
        mimeType: string;
        metadata?: Record<string, unknown>;
    }): Promise<{
        success: boolean;
        artifactId: string;
        fileRef: {
            storageId: string;
            mimeType: string;
            size: number;
            checksum?: string;
            originalFilename?: string;
        };
        version: number;
        updatedAt: number;
    }>;
    /**
     * Asset upload and delivery require a qualified authenticated backend capability.
     * This intermediate SDK rejects with AssetCapabilityUnavailableError before
     * transport or file processing; no bearer URL or upload result is returned.
     * Future support uses bounded authenticated Convex upload and delivery.
     *
     * @throws AssetCapabilityUnavailableError with CAPABILITY_UNAVAILABLE
     */
    getFileUrl(artifactId: string): Promise<string | null>;
    /**
     * Detach a file from an artifact
     *
     * Removes the file reference. The file may still exist in storage
     * depending on retention policy.
     *
     * @example
     * ```typescript
     * const artifact = await cortex.artifacts.detachFile(
     *   'art-abc123',
     *   'file-xyz789'
     * );
     * ```
     */
    detachFile(artifactId: string, deleteFile?: boolean): Promise<{
        success: boolean;
        artifactId: string;
        previousFileRef: {
            storageId: string;
            mimeType: string;
            size: number;
            originalFilename?: string;
        };
        fileDeleted: boolean;
        version: number;
        updatedAt: number;
    }>;
}

/**
 * Cortex SDK - Attachments API Validation
 *
 * Client-side validation for attachment operations to catch errors before
 * they reach the backend, providing faster feedback and better error messages.
 */
/**
 * Custom error class for attachment validation failures
 */
declare class AttachmentValidationError extends Error {
    readonly code: string;
    readonly field?: string | undefined;
    constructor(message: string, code: string, field?: string | undefined);
}

/**
 * Cortex SDK - Attachments API
 *
 * Multi-modal file storage for images, PDFs, audio, video, and generic files.
 * Memory space-scoped with multi-tenancy support.
 *
 * Features:
 * - Convex native file storage integration
 * - Upload URL generation for direct client uploads
 * - Signed download URLs
 * - Memory space isolation
 * - Multi-tenancy support
 */

declare class AttachmentsAPI {
    private readonly client;
    private readonly resilience?;
    private readonly authContext?;
    constructor(client: ConvexClient, resilience?: ResilienceLayer | undefined, authContext?: AuthContext | undefined);
    /**
     * Execute an operation through the resilience layer (if available)
     */
    private executeWithResilience;
    /**
     * Handle ConvexError from direct Convex calls
     */
    private handleConvexError;
    /**
     * Asset upload and delivery require a qualified authenticated backend capability.
     * This intermediate SDK rejects with AssetCapabilityUnavailableError before
     * transport or file processing; no bearer URL or upload result is returned.
     * Future support uses bounded authenticated Convex upload and delivery.
     *
     * @throws AssetCapabilityUnavailableError with CAPABILITY_UNAVAILABLE
     */
    generateUploadUrl(): Promise<UploadUrlResult>;
    /**
     * Register an uploaded file as an attachment.
     *
     * Call this after successfully uploading a file using the URL from generateUploadUrl.
     *
     * @example
     * ```typescript
     * const attachment = await cortex.attachments.attach({
     *   storageId: 'kg2abc123...',
     *   memorySpaceId: 'my-space',
     *   userId: 'user-123',
     *   type: 'image',
     *   mimeType: 'image/png',
     *   filename: 'screenshot.png',
     *   size: 1024000,
     *   conversationId: 'conv-456',
     * });
     * console.log(attachment.attachmentId); // "attach-abc123..."
     * ```
     */
    attach(params: AttachParams): Promise<Attachment>;
    /**
     * Get an attachment by ID.
     *
     * @example
     * ```typescript
     * const attachment = await cortex.attachments.get('attach-abc123');
     * if (attachment) {
     *   console.log(attachment.filename, attachment.mimeType);
     * }
     * ```
     */
    get(attachmentId: string): Promise<Attachment | null>;
    /**
     * Asset upload and delivery require a qualified authenticated backend capability.
     * This intermediate SDK rejects with AssetCapabilityUnavailableError before
     * transport or file processing; no bearer URL or upload result is returned.
     * Future support uses bounded authenticated Convex upload and delivery.
     *
     * @throws AssetCapabilityUnavailableError with CAPABILITY_UNAVAILABLE
     */
    getUrl(attachmentId: string): Promise<string | null>;
    /**
     * List attachments with comprehensive filters and pagination.
     *
     * @example
     * ```typescript
     * const result = await cortex.attachments.list({
     *   memorySpaceId: 'my-space',
     *   type: 'image',
     *   limit: 20,
     * });
     *
     * for (const attachment of result.attachments) {
     *   console.log(attachment.filename);
     * }
     *
     * // Pagination
     * if (result.hasMore) {
     *   const nextPage = await cortex.attachments.list({
     *     memorySpaceId: 'my-space',
     *     cursor: result.cursor,
     *   });
     * }
     * ```
     */
    list(filter: ListAttachmentsFilter): Promise<ListAttachmentsResult>;
    /**
     * Get attachments for a specific conversation.
     *
     * @example
     * ```typescript
     * const attachments = await cortex.attachments.getByConversation('conv-123');
     * console.log(`${attachments.length} attachments in this conversation`);
     * ```
     */
    getByConversation(conversationId: string, options?: {
        type?: "image" | "audio" | "video" | "file" | "pdf";
        limit?: number;
    }): Promise<Attachment[]>;
    /**
     * Get attachments for a specific message.
     *
     * @example
     * ```typescript
     * const attachments = await cortex.attachments.getByMessage('msg-123');
     * for (const att of attachments) {
     *   console.log(att.filename);
     * }
     * ```
     */
    getByMessage(messageId: string): Promise<Attachment[]>;
    /**
     * Count attachments matching filters.
     *
     * @example
     * ```typescript
     * const count = await cortex.attachments.count({
     *   memorySpaceId: 'my-space',
     *   type: 'image',
     * });
     * console.log(`${count} images in this space`);
     * ```
     */
    count(filter: {
        memorySpaceId: string;
        conversationId?: string;
        messageId?: string;
        userId?: string;
        type?: "image" | "audio" | "video" | "file" | "pdf";
        tenantId?: string;
    }): Promise<number>;
    /**
     * Delete an attachment.
     *
     * Removes both the metadata record and the file from storage.
     *
     * @example
     * ```typescript
     * const success = await cortex.attachments.delete('attach-abc123');
     * if (success) {
     *   console.log('Attachment deleted');
     * }
     * ```
     */
    delete(attachmentId: string): Promise<boolean>;
    /**
     * Bulk delete multiple attachments.
     *
     * Returns the count of successfully deleted attachments.
     *
     * @example
     * ```typescript
     * const result = await cortex.attachments.deleteMany([
     *   'attach-123',
     *   'attach-456',
     *   'attach-789',
     * ]);
     * console.log(`Deleted ${result.deleted} of ${result.total} attachments`);
     * ```
     */
    deleteMany(attachmentIds: string[]): Promise<DeleteManyAttachmentsResult>;
    /**
     * Upload a file and register it as an attachment in one operation.
     *
     * This is a convenience method that handles the full upload flow:
     * generates upload URL, uploads file, and registers the attachment.
     *
     * @example
     * ```typescript
     * const attachment = await cortex.attachments.upload({
     *   file: imageBlob,
     *   memorySpaceId: 'my-space',
     *   userId: 'user-123',
     *   type: 'image',
     *   filename: 'photo.png',
     *   conversationId: 'conv-456',
     * });
     * console.log(attachment.attachmentId);
     * ```
     */
    upload(params: {
        file: Blob;
        memorySpaceId: string;
        userId: string;
        type: "image" | "audio" | "video" | "file" | "pdf";
        filename: string;
        mimeType?: string;
        conversationId?: string;
        messageId?: string;
        memoryId?: string;
        artifactId?: string;
        dimensions?: {
            width: number;
            height: number;
        };
        duration?: number;
        metadata?: Record<string, unknown>;
        tenantId?: string;
    }): Promise<Attachment>;
}

/** The host must bypass its token cache when Convex requests a refresh. */
interface HostTokenRequest {
    forceRefreshToken: boolean;
}
/**
 * Retrieve the current host-issued JWT, or null after logout. This is an
 * authentication credential, never an upstream model/provider credential.
 */
type HostTokenFetcher = (request: HostTokenRequest) => Promise<string | null>;
/** Sanitized reactive-auth failure; contains no token or host error content. */
interface HostAuthFailure {
    readonly code: "HOST_TOKEN_FETCH_FAILED" | "INVALID_HOST_TOKEN";
    readonly attemptId: number;
}
/** Callback failures are isolated from the reactive transport's auth flow. */
type HostAuthErrorHandler = (failure: HostAuthFailure) => void | Promise<void>;
type ReactiveAuthClient = Pick<ConvexClient, "closed" | "setAuth"> & {
    readonly client: Pick<ConvexClient["client"], "hasAuth" | "clearAuth">;
};
/**
 * Browser-safe host credentials shared by reactive and HTTP transports.
 * Tokens are not cached, decoded, logged or converted into authorization claims.
 * Convex verifies identity; Cortex's backend resolves trusted grants.
 */
declare class HostCredentials {
    private readonly fetchAuthToken;
    private readonly onAuthError?;
    private readonly httpOperations;
    private reactiveClient?;
    private reactiveVersion;
    private reactiveAttemptId;
    private latestAuthFailure?;
    private pendingDeauthTimer?;
    constructor(fetchAuthToken: HostTokenFetcher, onAuthError?: HostAuthErrorHandler | undefined);
    /** Latest reactive failure; only a later current successful token/null fetch clears it. */
    get authFailure(): HostAuthFailure | undefined;
    /** Direct token retrieval rejects errors. Reactive binding uses a safe adapter. */
    readonly fetchToken: HostTokenFetcher;
    /** Bind one reactive transport using Convex's official refresh callback. */
    bindReactiveClient(client: ReactiveAuthClient): void;
    /**
     * Call after host login, logout or identity changes. Reconfigure official Convex
     * auth and force the first host token fetch to bypass its cache; later refresh
     * requests are forwarded unchanged. A null token clears Convex identity.
     * Stop private observers on logout; persisted background grants still require
     * explicit backend revocation/deletion. Throws when unbound or already closed.
     */
    notifySessionChanged(): void;
    private configureReactiveAuth;
    private isCurrentReactiveAttempt;
    /**
     * Fresh headers for a host-approved private Convex HTTP request. Use this
     * result as the request's auth headers; do not retain old Authorization headers
     * after null/logout. The caller owns route/origin validation and byte limits.
     */
    getAuthorizationHeaders(request?: HostTokenRequest): Promise<Record<string, string>>;
    /**
     * Attach the current credential before one HTTP operation. The official HTTP
     * client accepts a static token, so obtain it again for every invocation.
     * Serialize operations on this client to keep concurrent credentials separate.
     * No authentication failure or operation error triggers an operation retry.
     * Use a dedicated client with this helper for all of its authenticated calls.
     */
    withHttpAuth<T>(client: ConvexHttpClient, operation: (client: ConvexHttpClient) => Promise<T>, request?: HostTokenRequest): Promise<T>;
}

/**
 * Graph Sync Worker
 *
 * Real-time graph database synchronization using Convex reactive queries.
 * Subscribes to sync queue and automatically syncs entities when queue changes.
 */

/**
 * Worker configuration options
 */
interface GraphSyncWorkerOptions {
    /** Maximum items to process per batch (default: 100) */
    batchSize?: number;
    /** Maximum retry attempts for failed syncs (default: 3) */
    retryAttempts?: number;
    /** Enable verbose logging (default: false) */
    verbose?: boolean;
}
/**
 * Sync health metrics
 */
interface SyncHealthMetrics {
    /** Is worker running? */
    isRunning: boolean;
    /** Total items processed */
    totalProcessed: number;
    /** Items successfully synced */
    successCount: number;
    /** Items that failed */
    failureCount: number;
    /** Average sync time per item (ms) */
    avgSyncTimeMs: number;
    /** Last sync timestamp */
    lastSyncAt?: number;
    /** Current queue size (unsynced items) */
    queueSize: number;
}
/**
 * GraphSyncWorker - Real-time graph synchronization
 *
 * Uses Convex reactive queries (client.onUpdate) to automatically sync
 * entities to graph database when they're added to the sync queue.
 *
 * This is NOT polling - it's truly reactive. The callback fires
 * automatically when the query result changes.
 */
declare class GraphSyncWorker {
    private client;
    private adapter;
    private options;
    private running;
    private unsubscribe?;
    private metrics;
    private syncTimes;
    constructor(client: ConvexClient, adapter: GraphAdapter, options?: GraphSyncWorkerOptions);
    /**
     * Start the sync worker
     *
     * Subscribes to sync queue reactively - callback fires automatically
     * when items are added to the queue!
     */
    start(): Promise<void>;
    /**
     * Stop the sync worker
     */
    stop(): void;
    /**
     * Get current health metrics
     */
    getMetrics(): SyncHealthMetrics;
    /**
     * Process a batch of sync items
     */
    private processBatch;
    /**
     * Process a single sync item
     */
    private processItem;
    /**
     * Perform sync operation (insert or update)
     */
    private performSync;
    /**
     * Perform delete operation
     */
    private performDelete;
}

/**
 * Cypher Graph Adapter
 *
 * Implementation of GraphAdapter interface for Neo4j and Memgraph databases
 * using the Bolt protocol and Cypher query language.
 */

/**
 * CypherGraphAdapter - Neo4j and Memgraph compatible graph database adapter
 *
 * Supports both Neo4j Community and Memgraph using the standard Bolt protocol.
 * Can be used interchangeably by just changing the connection URI.
 */
declare class CypherGraphAdapter implements GraphAdapter {
    private driver;
    private config;
    private useElementId;
    connect(config: GraphConnectionConfig): Promise<void>;
    /**
     * Create appropriate error type based on connection failure diagnosis
     */
    private createConnectionError;
    disconnect(): Promise<void>;
    isConnected(): Promise<boolean>;
    /**
     * Verify authentication by running a simple query
     *
     * verifyConnectivity() only checks if the server is reachable, not
     * if credentials are valid. This method runs a simple query to
     * verify authentication works, failing fast with a clear error
     * if credentials are invalid.
     */
    private verifyAuthentication;
    /**
     * Detect database type and set appropriate ID function
     */
    private detectDatabaseType;
    /**
     * Get the appropriate ID function for the connected database
     */
    private getIdFunction;
    /**
     * Convert ID to appropriate type for database queries
     * Neo4j uses string IDs (elementId), Memgraph uses integer IDs (id)
     */
    private convertIdForQuery;
    createNode(node: GraphNode): Promise<string>;
    mergeNode(node: GraphNode, matchProperties: Record<string, unknown>): Promise<string>;
    getNode(id: string): Promise<GraphNode | null>;
    updateNode(id: string, properties: Record<string, any>): Promise<void>;
    deleteNode(id: string, detach?: boolean): Promise<void>;
    findNodes(label: string, properties?: Record<string, any>, limit?: number): Promise<GraphNode[]>;
    createEdge(edge: GraphEdge): Promise<string>;
    deleteEdge(id: string): Promise<void>;
    findEdges(type: string, properties?: Record<string, any>, limit?: number): Promise<GraphEdge[]>;
    query(query: GraphQuery | string, params?: Record<string, any>): Promise<GraphQueryResult>;
    traverse(config: TraversalConfig): Promise<GraphNode[]>;
    findPath(config: ShortestPathConfig): Promise<GraphPath | null>;
    batchWrite(operations: GraphOperation[]): Promise<void>;
    countNodes(label?: string): Promise<number>;
    countEdges(type?: string): Promise<number>;
    clearDatabase(): Promise<void>;
    private getSession;
    private escapeLabel;
    private escapeProperty;
    private serializeValue;
    private serializeProperties;
    private deserializeValue;
    private deserializeProperties;
    private toNumber;
    private handleError;
}

/**
 * Cortex SDK - Auth Context Validators
 *
 * Client-side validation for auth context parameters.
 */

/**
 * Validation error for auth context operations
 */
declare class AuthValidationError extends Error {
    readonly code: string;
    readonly field?: string | undefined;
    constructor(message: string, code: string, field?: string | undefined);
}

/**
 * Cortex SDK - Auth Context Creation and Validation
 *
 * Factory functions for creating and validating AuthContext objects.
 */

/**
 * Create a validated AuthContext from parameters.
 *
 * This is the primary way to create an auth context for use with Cortex.
 * All parameters are validated before the context is created.
 *
 * @param params - Auth context parameters
 * @returns Validated AuthContext object
 * @throws AuthValidationError if validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const authContext = createAuthContext({
 *   userId: 'user-123',
 * });
 *
 * // With multi-tenancy
 * const authContext = createAuthContext({
 *   userId: 'user-123',
 *   tenantId: 'tenant-456',
 *   organizationId: 'org-engineering',
 * });
 *
 * // With session tracking
 * const authContext = createAuthContext({
 *   userId: 'user-123',
 *   tenantId: 'tenant-456',
 *   sessionId: 'sess-abc',
 * });
 *
 * // With provider info and claims
 * const authContext = createAuthContext({
 *   userId: 'user-123',
 *   tenantId: 'tenant-456',
 *   authProvider: 'auth0',
 *   authMethod: 'oauth',
 *   authenticatedAt: Date.now(),
 *   claims: {
 *     'https://myapp.com/roles': ['admin'],
 *     'https://myapp.com/subscription': 'enterprise',
 *   },
 * });
 *
 * // With custom metadata
 * const authContext = createAuthContext({
 *   userId: 'user-123',
 *   metadata: {
 *     internalUserId: 'legacy-789',
 *     featureFlags: ['beta-features'],
 *     region: 'us-west-2',
 *   },
 * });
 *
 * // Use with Cortex
 * const cortex = new Cortex({
 *   convexUrl: process.env.CONVEX_URL!,
 *   auth: authContext,
 * });
 * ```
 */
declare function createAuthContext(params: AuthContextParams): AuthContext;
/**
 * Validate an existing AuthContext object.
 *
 * Use this to validate auth contexts that were created elsewhere
 * (e.g., from a JWT payload or external auth provider).
 *
 * @param context - Object to validate as AuthContext
 * @returns true if valid
 * @throws AuthValidationError if validation fails
 *
 * @example
 * ```typescript
 * // Validate JWT payload as auth context
 * const jwtPayload = decodeJwt(token);
 * validateAuthContext({
 *   userId: jwtPayload.sub,
 *   tenantId: jwtPayload.tenant_id,
 *   claims: jwtPayload,
 * });
 * ```
 */
declare function validateAuthContext(context: unknown): context is AuthContext;

/**
 * Cortex SDK - Sharing Utilities
 *
 * Framework-agnostic utilities for working with shareable conversation links.
 */
/**
 * URL style for share links
 * - 'path': /shared/{id} (default)
 * - 'query': /shared?id={id}
 */
type ShareUrlStyle = "path" | "query";
/**
 * Configuration for building share URLs
 */
interface ShareUrlConfig {
    /** Base URL for share links (e.g., 'https://app.example.com/shared') */
    baseUrl: string;
    /** URL style: 'path' → /shared/{id}, 'query' → /shared?id={id} */
    style?: ShareUrlStyle;
    /** Query param name when style='query' (default: 'id') */
    paramName?: string;
}
/**
 * Build a shareable URL from a share ID
 *
 * This is a pure utility function that doesn't make any API calls.
 * Use it to construct URLs for sharing conversations in your application.
 *
 * @example
 * ```typescript
 * import { buildShareUrl } from '@cortex/sdk';
 *
 * // Path style (default): https://myapp.com/shared/share-abc123
 * const url1 = buildShareUrl('share-abc123', {
 *   baseUrl: 'https://myapp.com/shared'
 * });
 *
 * // Query style: https://myapp.com/shared?id=share-abc123
 * const url2 = buildShareUrl('share-abc123', {
 *   baseUrl: 'https://myapp.com/shared',
 *   style: 'query',
 * });
 *
 * // Custom param name: https://myapp.com/view?share=share-abc123
 * const url3 = buildShareUrl('share-abc123', {
 *   baseUrl: 'https://myapp.com/view',
 *   style: 'query',
 *   paramName: 'share',
 * });
 * ```
 */
declare function buildShareUrl(shareId: string, config: ShareUrlConfig): string;
/**
 * Extract a share ID from a URL
 *
 * Reverse of buildShareUrl - extracts the share ID from a URL.
 *
 * @example
 * ```typescript
 * import { extractShareId } from '@cortex/sdk';
 *
 * // From path style
 * extractShareId('https://myapp.com/shared/share-abc123', { style: 'path' });
 * // => 'share-abc123'
 *
 * // From query style
 * extractShareId('https://myapp.com/shared?id=share-abc123', { style: 'query' });
 * // => 'share-abc123'
 * ```
 */
declare function extractShareId(url: string, config?: {
    style?: ShareUrlStyle;
    paramName?: string;
}): string | null;

/**
 * Cortex SDK - User Profile Schemas
 *
 * Provides standard user profile schema with fully extensible fields
 * and validation presets for different use cases.
 */
/**
 * Standard user profile interface.
 *
 * This interface provides commonly-used fields while remaining fully extensible.
 * All fields except displayName are optional, and developers can add any
 * additional fields they need.
 *
 * @example
 * ```typescript
 * const profile: StandardUserProfile = {
 *   displayName: 'Alice Johnson',
 *   email: 'alice@example.com',
 *   avatarUrl: 'https://example.com/avatars/alice.jpg',
 *
 *   // Extensible preferences - any shape
 *   preferences: {
 *     theme: 'dark',
 *     language: 'en',
 *     notifications: { email: true, push: false },
 *     customSetting: { nested: 'value' },
 *   },
 *
 *   // Extensible platform metadata - any shape
 *   platformMetadata: {
 *     tier: 'enterprise',
 *     signupSource: 'referral',
 *     internalNotes: ['VIP customer'],
 *   },
 *
 *   // Additional developer-defined fields
 *   legacyId: 'old-system-123',
 *   featureFlags: ['beta', 'new-ui'],
 * };
 * ```
 */
interface StandardUserProfile {
    /** Display name for the user (required) */
    displayName: string;
    /** Email address */
    email?: string;
    /** Avatar URL */
    avatarUrl?: string;
    /** Phone number */
    phone?: string;
    /** First name */
    firstName?: string;
    /** Last name */
    lastName?: string;
    /** Bio or description */
    bio?: string;
    /** User's locale/language preference */
    locale?: string;
    /** User's timezone */
    timezone?: string;
    /** Account status */
    status?: "active" | "inactive" | "suspended" | "pending" | string;
    /** Account type or tier */
    accountType?: string;
    /**
     * User preferences - fully extensible.
     *
     * @example
     * ```typescript
     * preferences: {
     *   theme: 'dark',
     *   language: 'en',
     *   notifications: { email: true, push: false },
     *   accessibility: { reducedMotion: true },
     * }
     * ```
     */
    preferences?: Record<string, unknown>;
    /**
     * Platform-specific metadata - fully extensible.
     *
     * Use this for internal data, integration IDs, analytics data, etc.
     *
     * @example
     * ```typescript
     * platformMetadata: {
     *   stripeCustomerId: 'cus_xxx',
     *   hubspotContactId: 'contact_xxx',
     *   tier: 'enterprise',
     *   signupSource: 'referral',
     *   signupDate: '2024-01-15',
     * }
     * ```
     */
    platformMetadata?: Record<string, unknown>;
    /**
     * Any additional developer-defined fields.
     *
     * The interface is fully extensible - add any fields your application needs.
     */
    [key: string]: unknown;
}
/**
 * Validation preset configuration
 */
interface ValidationPreset {
    /** Fields that must be present */
    requiredFields?: string[];
    /** Validate email format */
    validateEmail?: boolean;
    /** Validate phone format */
    validatePhone?: boolean;
    /** Maximum size of profile data in bytes */
    maxDataSize?: number;
    /** Maximum length for string fields */
    maxStringLength?: number;
    /** Custom validation function */
    customValidator?: (data: Record<string, unknown>) => {
        valid: boolean;
        errors: string[];
    };
}
/**
 * Built-in validation presets for common use cases.
 *
 * @example
 * ```typescript
 * // Use strict validation for enterprise apps
 * const cortex = new Cortex({
 *   convexUrl: process.env.CONVEX_URL!,
 *   users: {
 *     validation: validationPresets.strict,
 *   },
 * });
 *
 * // Use minimal validation for quick prototyping
 * const cortex = new Cortex({
 *   convexUrl: process.env.CONVEX_URL!,
 *   users: {
 *     validation: validationPresets.minimal,
 *   },
 * });
 *
 * // No validation for maximum flexibility
 * const cortex = new Cortex({
 *   convexUrl: process.env.CONVEX_URL!,
 *   users: {
 *     validation: validationPresets.none,
 *   },
 * });
 * ```
 */
declare const validationPresets: Record<string, ValidationPreset>;
/**
 * Validate user profile data against a preset.
 *
 * @param data - Profile data to validate
 * @param preset - Validation preset to use
 * @returns Validation result
 *
 * @example
 * ```typescript
 * const result = validateUserProfile(
 *   { displayName: 'Alice', email: 'not-an-email' },
 *   validationPresets.strict
 * );
 *
 * if (!result.valid) {
 *   console.error('Validation failed:', result.errors);
 * }
 * ```
 */
declare function validateUserProfile(data: Record<string, unknown>, preset?: ValidationPreset): {
    valid: boolean;
    errors: string[];
};
/**
 * Create a user profile with defaults applied.
 *
 * @param data - Partial profile data
 * @param defaults - Default values to apply
 * @returns Complete profile with defaults
 *
 * @example
 * ```typescript
 * const profile = createUserProfile(
 *   { displayName: 'Alice' },
 *   { status: 'active', preferences: { theme: 'light' } }
 * );
 * // Result: { displayName: 'Alice', status: 'active', preferences: { theme: 'light' } }
 * ```
 */
declare function createUserProfile(data: Partial<StandardUserProfile>, defaults?: Partial<StandardUserProfile>): StandardUserProfile;

/** Authenticated bounded asset upload/delivery has not been qualified yet. */
declare class AssetCapabilityUnavailableError extends Error {
    readonly version = 1;
    readonly code = "CAPABILITY_UNAVAILABLE";
    readonly retryable = false;
    readonly outcome = "not_dispatched";
    constructor();
}

/**
 * Cortex SDK - Main Entry Point
 *
 * Open-source SDK for AI agents with persistent memory
 * Built on Convex for reactive TypeScript queries
 */

/**
 * Graph database configuration
 */
interface GraphConfig {
    /** Pre-configured graph adapter. The caller owns it and must disconnect it. */
    adapter: GraphAdapter;
    /** Enable orphan cleanup on deletes (default: true) */
    orphanCleanup?: boolean;
    /** Auto-start sync worker for real-time synchronization (default: false) */
    autoSync?: boolean;
    /** Sync worker configuration options */
    syncWorkerOptions?: GraphSyncWorkerOptions;
}
/**
 * LLM provider type
 */
type LLMProvider = "openai" | "anthropic" | "custom";
/**
 * LLM configuration for auto fact extraction
 *
 * When configured, enables automatic fact extraction from conversations
 * during remember() operations (unless explicitly skipped via skipLayers).
 */
interface LLMConfig {
    /** LLM provider */
    provider: LLMProvider;
    /** API key for the provider */
    apiKey: string;
    /**
     * Model to use for fact extraction.
     * Default: 'gpt-4o-mini' for OpenAI, 'claude-3-haiku-20240307' for Anthropic
     */
    model?: string;
    /**
     * Custom extraction function (for 'custom' provider or to override default behavior).
     * If provided, this will be used instead of the built-in extraction.
     */
    extractFacts?: (userMessage: string, agentResponse: string) => Promise<Array<{
        fact: string;
        factType: "preference" | "identity" | "knowledge" | "relationship" | "event" | "observation" | "custom";
        subject?: string;
        predicate?: string;
        object?: string;
        confidence: number;
        tags?: string[];
    }> | null>;
    /**
     * Maximum tokens for fact extraction response.
     * Default: 1000
     */
    maxTokens?: number;
    /**
     * Temperature for fact extraction.
     * Default: 0.1 (low for consistent extraction)
     */
    temperature?: number;
}
/**
 * Embedding provider configuration for automatic embedding generation.
 *
 * When configured, enables batteries-included semantic search:
 * - recall() automatically generates embeddings for queries
 * - remember() automatically generates embeddings for facts
 * - No manual embedding handling required
 */
interface EmbeddingConfig {
    /**
     * Embedding provider type.
     * - 'openai': Use OpenAI embeddings API
     * - 'custom': Use a custom embedding function
     */
    provider: "openai" | "custom";
    /**
     * API key for the provider (required for 'openai' provider)
     */
    apiKey?: string;
    /**
     * Model to use for embeddings.
     * Default: 'text-embedding-3-small' for OpenAI
     */
    model?: string;
    /**
     * Custom embedding function (required for 'custom' provider).
     * Takes text input and returns embedding vector.
     *
     * @example
     * ```typescript
     * generate: async (text) => {
     *   const response = await myEmbeddingAPI.embed(text);
     *   return response.embedding;
     * }
     * ```
     */
    generate?: (text: string) => Promise<number[]>;
}
/**
 * Cortex SDK configuration
 */
interface CortexConfig {
    /** Convex deployment URL */
    convexUrl: string;
    /** Optional graph database integration */
    graph?: GraphConfig;
    /**
     * Optional LLM configuration for auto fact extraction.
     *
     * When configured, enables automatic fact extraction from conversations
     * during remember() operations (unless explicitly skipped via skipLayers).
     *
     * @example
     * ```typescript
     * llm: {
     *   provider: 'openai',
     *   apiKey: process.env.OPENAI_API_KEY,
     *   model: 'gpt-4o-mini',
     * }
     * ```
     */
    llm?: LLMConfig;
    /**
     * Optional embedding configuration for automatic semantic search.
     *
     * When configured, enables batteries-included semantic search:
     * - recall() automatically generates embeddings for queries
     * - remember() automatically generates embeddings for extracted facts
     *
     * @example
     * ```typescript
     * // OpenAI embeddings (recommended)
     * embedding: {
     *   provider: 'openai',
     *   apiKey: process.env.OPENAI_API_KEY,
     *   model: 'text-embedding-3-small',
     * }
     *
     * // Custom embedding function
     * embedding: {
     *   provider: 'custom',
     *   generate: async (text) => myEmbedFunction(text),
     * }
     * ```
     */
    embedding?: EmbeddingConfig;
    /**
     * Optional caller metadata and scope selectors for multi-tenant applications.
     *
     * Operations inject these userId/tenantId labels as selectors. This context,
     * including claims/roles, does not authenticate a request or grant access.
     * Verified identity and trusted memberships/grants are resolved by the backend.
     *
     * @example
     * ```typescript
     * auth: createAuthContext({
     *   userId: 'user-123',
     *   tenantId: 'tenant-456',
     *   sessionId: 'sess-abc',
     * })
     * ```
     */
    auth?: AuthContext;
    /**
     * Get the current host-issued JWT for Convex authentication, or null on logout.
     * Forward forceRefreshToken to the host provider's cache-bypass/refresh option.
     * Convex calls this again to refresh credentials for active subscriptions.
     * Never return a model provider key or derive a token from AuthContext metadata.
     * Host auth.config.ts remains responsible for issuer/audience verification.
     *
     * Logout/null clears transport identity; stop private observers on host logout.
     * Call cortex.credentials?.notifySessionChanged() after login/logout/identity
     * changes to update active transport credentials immediately.
     * Stored background grants require explicit backend revocation or deletion.
     *
     * @example
     * ```typescript
     * fetchAuthToken: async ({ forceRefreshToken }) =>
     *   hostAuth.getToken({ skipCache: forceRefreshToken }),
     * ```
     */
    fetchAuthToken?: HostTokenFetcher;
    /**
     * Observe sanitized reactive authentication failures. Reactive auth fails closed
     * to null; inspect credentials.authFailure for the latest diagnostic. Direct
     * token/header/HTTP helpers still reject host errors. Observer errors are isolated.
     */
    onAuthError?: HostAuthErrorHandler;
    /**
     * Resilience/overload protection configuration
     *
     * Provides rate limiting, concurrency control, circuit breaking,
     * and priority queuing for burst traffic handling.
     *
     * @default ResiliencePresets.default (enabled with balanced settings)
     *
     * @example
     * ```typescript
     * // Use preset
     * resilience: ResiliencePresets.hiveMode
     *
     * // Custom configuration
     * resilience: {
     *   enabled: true,
     *   rateLimiter: { bucketSize: 200, refillRate: 100 },
     *   circuitBreaker: { failureThreshold: 10 },
     * }
     *
     * // Disable resilience
     * resilience: { enabled: false }
     * ```
     */
    resilience?: ResilienceConfig;
}
declare class Cortex {
    private readonly client;
    private syncWorker?;
    private readonly resilienceLayer;
    private readonly llmConfig?;
    private readonly embeddingConfig?;
    private readonly authContext?;
    /** Host credential seam for HTTP/private fetch transports; absent without a getter. */
    readonly credentials?: HostCredentials;
    /**
     * Auto-configure embedding from environment variables.
     *
     * Uses a two-gate approach:
     * - Gate 1: An API key must be present (OPENAI_API_KEY)
     * - Gate 2: CORTEX_EMBEDDING must be explicitly set to 'true'
     *
     * This prevents accidental API costs - users must explicitly opt-in.
     *
     * @returns EmbeddingConfig if both gates pass, undefined otherwise
     */
    private static autoConfigureEmbedding;
    /**
     * Auto-configure LLM from environment variables.
     *
     * Uses a two-gate approach:
     * - Gate 1: An API key must be present (OPENAI_API_KEY or ANTHROPIC_API_KEY)
     * - Gate 2: CORTEX_FACT_EXTRACTION must be explicitly set to 'true'
     *
     * This prevents accidental API costs - users must explicitly opt-in.
     *
     * @returns LLMConfig if both gates pass, undefined otherwise
     */
    private static autoConfigureLLM;
    /**
     * Auto-configure graph database from environment variables.
     *
     * Uses a two-gate approach:
     * - Gate 1: Connection credentials must be present (NEO4J_URI or MEMGRAPH_URI + auth)
     * - Gate 2: CORTEX_GRAPH_SYNC must be explicitly set to 'true'
     *
     * This prevents accidental graph connections - users must explicitly opt-in.
     *
     * @returns GraphConfig if both gates pass, undefined otherwise
     */
    private static autoConfigureGraph;
    /**
     * Create a Cortex instance with automatic configuration.
     *
     * This factory method enables async auto-configuration of:
     * - Graph database (if CORTEX_GRAPH_SYNC=true and connection credentials set)
     * - LLM for fact extraction (if CORTEX_FACT_EXTRACTION=true and API key set)
     *
     * Use this instead of `new Cortex()` when you want environment-based auto-config.
     *
     * @example
     * ```typescript
     * // With env vars: CORTEX_GRAPH_SYNC=true, NEO4J_URI=bolt://localhost:7687
     * const cortex = await Cortex.create({ convexUrl: process.env.CONVEX_URL! });
     * // Graph is automatically connected and sync worker started
     * ```
     *
     * @param config - Cortex configuration (explicit config takes priority over env vars)
     * @returns Promise<Cortex> - Fully configured Cortex instance
     */
    static create(config: CortexConfig): Promise<Cortex>;
    conversations: ConversationsAPI;
    immutable: ImmutableAPI;
    mutable: MutableAPI;
    vector: VectorAPI;
    facts: FactsAPI;
    contexts: ContextsAPI;
    memorySpaces: MemorySpacesAPI;
    memory: MemoryAPI;
    users: UsersAPI;
    agents: AgentsAPI;
    governance: GovernanceAPI;
    a2a: A2AAPI;
    sessions: SessionsAPI;
    artifacts: ArtifactsAPI;
    attachments: AttachmentsAPI;
    constructor(config: CortexConfig);
    /**
     * Get the caller metadata and scope selectors (if configured).
     *
     * Returns the AuthContext that was passed during initialization.
     * These labels do not establish verified identity or trusted access grants.
     *
     * @example
     * ```typescript
     * const cortex = new Cortex({
     *   convexUrl: process.env.CONVEX_URL!,
     *   auth: createAuthContext({ userId: 'user-123', tenantId: 'tenant-456' })
     * });
     *
     * console.log(cortex.auth?.userId); // 'user-123'
     * console.log(cortex.auth?.tenantId); // 'tenant-456'
     * ```
     */
    get auth(): AuthContext | undefined;
    /**
     * Get the underlying Convex client (for testing and advanced use cases)
     */
    getClient(): ConvexClient;
    /**
     * Get graph sync worker (if running)
     */
    getGraphSyncWorker(): GraphSyncWorker | undefined;
    /**
     * Get the resilience layer for monitoring and manual control
     *
     * @example
     * ```typescript
     * // Check system health
     * const isHealthy = cortex.getResilience().isHealthy();
     *
     * // Get current metrics
     * const metrics = cortex.getResilience().getMetrics();
     * console.log('Circuit state:', metrics.circuitBreaker.state);
     * console.log('Queue size:', metrics.queue.total);
     *
     * // Reset all resilience state (use with caution)
     * cortex.getResilience().reset();
     * ```
     */
    getResilience(): ResilienceLayer;
    /**
     * Get current resilience metrics
     *
     * Convenience method equivalent to `getResilience().getMetrics()`
     */
    getResilienceMetrics(): ResilienceMetrics;
    /**
     * Check if the SDK is healthy and accepting requests
     *
     * Returns false if circuit breaker is open
     */
    isHealthy(): boolean;
    /**
     * Close the connection to Convex and stop all workers
     */
    close(): void;
    /**
     * Gracefully shutdown the SDK
     *
     * Waits for pending operations to complete before closing.
     *
     * @param timeoutMs Maximum time to drain pending operations (default: 30000ms)
     */
    shutdown(timeoutMs?: number): Promise<void>;
}

export { type A2ABroadcastParams, type A2ABroadcastResult, type A2AConversation, type A2AConversationFilters, type A2AConversationMessage, type A2AMessage, type A2ARequestParams, type A2AResponse, type A2ASendParams, A2ATimeoutError, A2AValidationError, AcquireTimeoutError, type AddMessageInput, type AddMessageOptions, type AgentDeletionBackup, type AgentDeletionPlan, type AgentFilters, type AgentRegistration, AgentRegistryCapabilityError, AgentRegistryCommittedResultError, type AgentRegistryScope, type AgentRegistryWriteReceipt, AgentRegistryWriteReceiptError, type AgentStats, type AppendContentParams, type ApproveMessageInput, type ArchiveResult, type Artifact, type ArtifactCollaborator, type ArtifactFileRef, type ArtifactKind, type ArtifactKindConfig, type ArtifactMemoryRef, type ArtifactStats, ArtifactValidationError, type ArtifactVersion, AssetCapabilityUnavailableError, type AttachParams, type Attachment, type AttachmentDimensions, type AttachmentType, AttachmentValidationError, type AuthContext, type AuthContextParams, type AuthMethod, AuthValidationError, type BulkArtifactResult, type CheckAccessInput, type CheckAccessResult, type CheckShareAccessResult, type ChunkEvent, type ChunkMetadata, type ChunkStrategy, type ChunkingConfig, CircuitBreaker, type CircuitBreakerConfig, CircuitOpenError, type CircuitState, type CollaborativeSettings, type ComplianceMode, type ComplianceReport, type ComplianceReportOptions, type ComplianceTemplate, type ConcurrencyConfig, type ContentChunk, type ContentType, type ContextVersion$1 as ContextVersion, type Conversation, type ConversationDeletionResult, type ConversationRef, type ConversationSearchResult, type ConversationShare, type ConversationSnapshot, type ConversationType, type ConversationVisibility, Cortex, type CortexConfig, type CountArtifactsFilter, type CountConversationsFilter, type CountFactsFilter, type CountImmutableFilter, type CountMemoriesFilter, type CountMutableFilter, type CreateArtifactOptions, type CreateContextOptions, type CreateConversationInput, type CreateConversationOptions, type CreateSessionParams, type CreateShareInput, type CreateShareResult, type CreateSnapshotInput, type CreateSnapshotResult, type CustomRedaction, CypherGraphAdapter, type DeduplicationConfig, type DeduplicationStrategy, type DeleteArtifactResult, type DeleteContextOptions, type DeleteConversationOptions, type DeleteFactOptions, type DeleteImmutableOptions, type DeleteManyAttachmentsResult, type DeleteManyConversationsOptions, type DeleteManyConversationsResult, type DeleteManyFactsParams, type DeleteManyFactsResult, type DeleteManyResult, type DeleteMemoryOptions, type DeleteMemoryResult, type DeleteMemorySpaceOptions, type DeleteMemorySpaceResult, type DeleteMutableOptions, type DeleteUserOptions, type DeletionBackup, type DeletionPlan, type DuplicateResult, type EmbeddingConfig, type EmbeddingMergeStrategy, type EndSessionsResult, type EnforcementOptions, type EnforcementResult, type EnforcementStats, type EnforcementStatsOptions, type EnhancedRememberStreamParams, type EnhancedRememberStreamResult, type EnrichedEntity, type EnrichedMemory, type EnrichedRelation, type EnrichedSearchResult, type ErrorContext, type ExpireSessionsOptions, type ExportAgentsOptions, type ExportAgentsResult, type ExportConversationsOptions, type ExportMemoriesOptions, type ExportResult, type ExportUsersOptions, type ExtendedForgetOptions, type FactCandidate, type FactRecord, type FactsRef, type FailureStrategy, type FileReference, type FinalizeStreamingParams, type ForgetOptions, type ForgetResult, type GetArtifactHistoryOptions, type GetConversationOptions, type GetHistoryOptions, type GetMemoryOptions, type GetMemorySpaceStatsOptions, GovernanceCapabilityError, type GovernancePolicy, GovernanceValidationError, type GraphAdapter, GraphAuthenticationError, type GraphConfig, type GraphConnectionConfig, GraphConnectionError, GraphDatabaseError, type GraphEdge, type GraphNode, GraphNotFoundError, type GraphOperation, type GraphPath, type GraphQuery, GraphQueryError, type GraphQueryResult, type GraphSyncEvent, type GraphSyncOption, GraphSyncWorker, type GraphSyncWorkerOptions, type HostAuthErrorHandler, type HostAuthFailure, HostCredentials, type HostTokenFetcher, type HostTokenRequest, type ImmutableEntry, type ImmutableRecord, type ImmutableRef, type ImmutableSearchResult, type ImmutableVersion, type ImmutableVersionExpanded, type LLMConfig, type LLMProvider, type LayerEvent, type LayerStatus, type ListArtifactsFilter, type ListAttachmentsFilter, type ListAttachmentsResult, type ListConversationsFilter, type ListConversationsResult, type ListFactsFilter, type ListImmutableFilter, type ListMemoriesFilter, type ListMemorySpacesFilter, type ListMemorySpacesResult, type ListMutableFilter, type ListSharesFilter, type ListSnapshotsFilter, type ListUsersFilter, type ListUsersResult, type MemoryEfficiencyOptions, type MemoryEntry, type MemoryLayer, type MemoryMetadata, type MemorySpace, type MemorySpaceStats, MemoryValidationError, type MemoryVersion, type Message, type MessageApprovalStatus, type MutableRecord, type MutableRef, OPERATION_PRIORITIES, type OrchestrationObserver, type OrchestrationSummary, type PartialMemoryResult, type PartialUpdate, type ParticipantUpdates, type PerformanceInsights, type PolicyResult, type PolicyScope, type Priority, PriorityQueue, type ProcessedChunk, type ProcessingStrategy, type ProgressEvent, type ProgressiveFact, type ProgressiveProcessing, type PurgeManyFilter, type PurgeNamespaceOptions, type QueryByRelationshipFilter, type QueryBySubjectFilter, type QueryStatistics, type QueueConfig, QueueFullError, RateLimitExceededError, type RateLimiterConfig, type RecallItem, type RecallLimits, type RecallOptions, type RecallParams, type RecallResult, type RecallSourceBreakdown, type RecallSummary, type RecoveryOptions, type RecoveryResult, type RegisterMemorySpaceOptions, type RegisterMemorySpaceParams, type RegisteredAgent, type RememberOptions, type RememberParams, type RememberResult, type RememberStreamParams, type RememberStreamResult, type ResilienceConfig, ResilienceLayer, type ResilienceMetrics, ResiliencePresets, type ResumeContext, type RevisionAction, type RevokeShareResult, type SearchConversationsInput, type SearchConversationsOptions, type SearchFactsOptions, type SearchImmutableInput, type SearchMemoriesOptions, type SearchMemoryOptions, type SemanticSearchFactsOptions, Semaphore, type Session, SessionCapabilityError, type SessionCleanupPolicy, type SessionFilters, type SessionLifecyclePolicy, type SessionLimitsPolicy, type SessionMetadata, type SessionPolicy, type SessionStatus, SessionValidationError, SessionsAPI, type SetMutableInput, type SetMutableOptions, type SetVisibilityInput, type ShareGrantType, type SharePermissions, type ShareStatus, type ShareUrlConfig, type ShareUrlStyle, type ShortestPathConfig, type SimulationOptions, type SimulationResult, type SkippableLayer, type SnapshotFact, type SnapshotIncludedContent, type SnapshotRedaction, type SnapshotStatus, type SourceType, type StandardUserProfile, type StartStreamingParams, type StoreFactOptions, type StoreFactParams, type StoreImmutableOptions, type StoreMemoryInput, type StoreMemoryOptions, type StoreMemoryResult, type StoreWithDedupResult, type StreamCompleteEvent, type StreamContext, type StreamError, type StreamHooks, type StreamMetrics, type StreamType, type StreamingMetadata, type StreamingOptions, type StreamingSessionParams, type StreamingState, type SyncHealthMetrics, TokenBucket, type TraversalConfig, type UnregisterAgentOptions, type UnregisterAgentResult, type UnregisterMemorySpaceOptions, type UpdateArtifactOptions, type UpdateContextOptions, type UpdateConversationOptions, type UpdateFactInput, type UpdateFactOptions, type UpdateImmutableOptions, type UpdateManyResult, type UpdateMemoryOptions, type UpdateMemoryResult, type UpdateMemorySpaceOptions, type UpdateMutableInput, type UpdateMutableOptions, type UploadUrlResult, type UserDeleteResult, type UserFilters, type UserProfile, UserProfileWriteReceiptError, UserValidationError, type UserVersion, type ValidationPreset, type VerificationResult, buildShareUrl, createAuthContext, createUserProfile, extractShareId, getPresetForPlan, getPriority, isCritical, validateAuthContext, validateUserProfile, validationPresets };
