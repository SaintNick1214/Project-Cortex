/**
 * Artifact type definitions for Cortex Memory Provider
 *
 * These types define the structure of artifacts - persistent, structured content
 * generated during AI conversations (code files, documents, diagrams, etc.).
 *
 * All schemas use Zod for runtime validation, following Vercel AI SDK patterns.
 *
 * @see 00-unified-specification.md for canonical type definitions
 */

import { z } from "zod";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Canonical Enum Schemas (from unified specification)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Artifact kind - defines the type of content
 *
 * @see 00-unified-specification.md Section 1.1
 */
export const ArtifactKindSchema = z.enum([
  "text", // Plain text, markdown, prose documents
  "code", // Source code with syntax highlighting
  "sheet", // Tabular/spreadsheet data (JSON array format)
  "image", // Generated/edited images (stored in file storage)
  "diagram", // Mermaid, SVG, or structured diagrams
  "html", // Interactive HTML/React components
  "custom", // User-defined types (requires kindConfig.customKind)
]);
export type ArtifactKind = z.infer<typeof ArtifactKindSchema>;

/**
 * Streaming state - artifact lifecycle state
 *
 * @see 00-unified-specification.md Section 1.2
 */
export const StreamingStateSchema = z.enum([
  "draft", // Initial creation, content may be incomplete
  "streaming", // Actively receiving content from AI generation
  "paused", // Streaming temporarily halted (can resume)
  "final", // Content is complete and stable
  "error", // Generation failed
]);
export type StreamingState = z.infer<typeof StreamingStateSchema>;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Core Artifact Schema
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Kind-specific configuration
 */
export const KindConfigSchema = z
  .object({
    customKind: z.string().optional(),
    mimeType: z.string().optional(),
    language: z.string().optional(),
    framework: z.string().optional(),
    schema: z.unknown().optional(),
  })
  .optional();
export type KindConfig = z.infer<typeof KindConfigSchema>;

/**
 * Conversation reference for artifact context
 */
export const ConversationRefSchema = z
  .object({
    conversationId: z.string(),
    messageId: z.string().optional(),
    turnIndex: z.number().optional(),
  })
  .optional();
export type ConversationRef = z.infer<typeof ConversationRefSchema>;

/**
 * Memory reference for linking artifacts to memories
 */
export const MemoryRefSchema = z.object({
  memoryId: z.string(),
  relevance: z.number().min(0).max(100).optional(),
});
export type MemoryRef = z.infer<typeof MemoryRefSchema>;

/**
 * Version history entry
 */
export const VersionEntrySchema = z.object({
  version: z.number(),
  content: z.string().optional(),
  title: z.string().optional(),
  timestamp: z.number(),
  changedBy: z.string().optional(),
  changeType: z.enum(["create", "update", "undo", "redo"]),
  changeSummary: z.string().optional(),
});
export type VersionEntry = z.infer<typeof VersionEntrySchema>;

/**
 * Streaming metadata for progress tracking
 */
export const StreamingMetadataSchema = z
  .object({
    sessionId: z.string().optional(),
    startedAt: z.number().optional(),
    lastChunkAt: z.number().optional(),
    bytesReceived: z.number().optional(),
    estimatedTotal: z.number().optional(),
    errorMessage: z.string().optional(),
    errorCode: z.string().optional(),
  })
  .optional();
export type StreamingMetadata = z.infer<typeof StreamingMetadataSchema>;

/**
 * Content statistics
 */
export const ArtifactStatsSchema = z
  .object({
    characterCount: z.number().optional(),
    wordCount: z.number().optional(),
    lineCount: z.number().optional(),
    tokenCount: z.number().optional(),
  })
  .optional();
export type ArtifactStats = z.infer<typeof ArtifactStatsSchema>;

/**
 * Full Cortex Artifact schema
 *
 * This schema represents the complete artifact structure as stored in Cortex.
 * Use CortexArtifactSchema.parse() to validate incoming artifact data.
 */
export const CortexArtifactSchema = z.object({
  // Identity
  id: z.string(),
  artifactId: z.string().optional(), // Public ID
  memorySpaceId: z.string(),

  // Multi-tenancy & Ownership
  tenantId: z.string().optional(),
  userId: z.string().optional(),
  agentId: z.string().optional(),
  participantId: z.string().optional(),

  // Artifact Type
  kind: ArtifactKindSchema,
  kindConfig: KindConfigSchema,

  // Content Storage
  content: z.string(),
  language: z.string().optional(), // Convenience for code artifacts
  mimeType: z.string().optional(), // Content type hint

  // Display Metadata
  title: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),

  // References
  conversationRef: ConversationRefSchema,
  conversationId: z.string().optional(), // Shorthand for conversationRef.conversationId
  messageId: z.string().optional(), // Shorthand for conversationRef.messageId
  memoryRefs: z.array(MemoryRefSchema).optional(),

  // Streaming State
  streamingState: StreamingStateSchema,
  streamingMetadata: StreamingMetadataSchema,

  // Versioning
  version: z.number().default(1),
  versionPointer: z.number().optional(),
  versionHistory: z.array(VersionEntrySchema).optional(),
  previousVersionId: z.string().optional(),

  // Statistics
  stats: ArtifactStatsSchema,

  // Flexible Metadata
  metadata: z.record(z.string(), z.unknown()).optional(),

  // Timestamps
  createdAt: z.number(),
  updatedAt: z.number(),
  lastAccessedAt: z.number().optional(),
  accessCount: z.number().optional(),

  // Soft Delete
  isDeleted: z.boolean().optional(),
  deletedAt: z.number().optional(),
  deletedBy: z.string().optional(),
});
export type CortexArtifact = z.infer<typeof CortexArtifactSchema>;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Operation Input Schemas
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Input for creating a new artifact
 */
export const CreateArtifactInputSchema = z.object({
  kind: ArtifactKindSchema.describe("Type of artifact to create"),
  title: z.string().describe("Human-readable title for the artifact"),
  content: z.string().describe("The artifact content"),
  language: z
    .string()
    .optional()
    .describe("Programming language (for code artifacts)"),
  description: z.string().optional().describe("Description of the artifact"),
  mimeType: z.string().optional().describe("Content MIME type"),
  tags: z.array(z.string()).optional().describe("Tags for categorization"),
  metadata: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Additional metadata"),
});
export type CreateArtifactInput = z.infer<typeof CreateArtifactInputSchema>;

/**
 * Input for updating an existing artifact
 */
export const UpdateArtifactInputSchema = z.object({
  artifactId: z.string().describe("ID of the artifact to update"),
  content: z.string().optional().describe("New content (replaces existing)"),
  title: z.string().optional().describe("New title"),
  description: z.string().optional().describe("New description"),
  metadata: z.record(z.string(), z.unknown()).optional().describe("Additional metadata"),
  tags: z.array(z.string()).optional().describe("Updated tags"),
});
export type UpdateArtifactInput = z.infer<typeof UpdateArtifactInputSchema>;

/**
 * Input for appending content to an artifact
 */
export const AppendToArtifactInputSchema = z.object({
  artifactId: z.string().describe("ID of the artifact to append to"),
  content: z.string().describe("Content to append"),
  position: z
    .enum(["start", "end"])
    .optional()
    .default("end")
    .describe("Where to append"),
});
export type AppendToArtifactInput = z.infer<typeof AppendToArtifactInputSchema>;

/**
 * Input for getting an artifact
 */
export const GetArtifactInputSchema = z.object({
  artifactId: z.string().describe("ID of the artifact to retrieve"),
});
export type GetArtifactInput = z.infer<typeof GetArtifactInputSchema>;

/**
 * Input for listing artifacts
 */
export const ListArtifactsInputSchema = z.object({
  kind: ArtifactKindSchema.optional().describe("Filter by artifact kind"),
  limit: z.number().optional().default(10).describe("Maximum number to return"),
});
export type ListArtifactsInput = z.infer<typeof ListArtifactsInputSchema>;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Stream Event Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Artifact stream event for real-time updates
 */
export interface ArtifactStreamEvent {
  artifactId: string;
  type: "create" | "update" | "append" | "complete" | "error";
  artifact: Partial<CortexArtifact>;
  chunk?: string;
  progress?: number;
  error?: { message: string; code?: string };
}

/**
 * Stream event constants for artifact operations
 */
export const ARTIFACT_STREAM_EVENTS = {
  CREATE: "data-artifact-create",
  UPDATE: "data-artifact-update",
  APPEND: "data-artifact-append",
  PROGRESS: "data-artifact-progress",
  COMPLETE: "data-artifact-complete",
  ERROR: "data-artifact-error",
} as const;

export type ArtifactStreamEventType =
  (typeof ARTIFACT_STREAM_EVENTS)[keyof typeof ARTIFACT_STREAM_EVENTS];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Configuration Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Configuration for artifact storage and handling
 */
export interface ArtifactConfig {
  /** Enable automatic artifact storage (default: true) */
  enableArtifactStorage?: boolean;

  /** Enable artifact version history (default: true) */
  enableVersionHistory?: boolean;

  /** Maximum versions to keep per artifact (default: 10) */
  maxVersionsPerArtifact?: number;

  /** Default artifact importance for memory storage (0-100, default: 60) */
  defaultArtifactImportance?: number;

  /** Sync artifacts to graph database (default: false) */
  syncArtifactsToGraph?: boolean;

  /** Custom artifact kind handlers */
  kindHandlers?: Partial<Record<ArtifactKind, ArtifactKindHandler>>;
}

/**
 * Custom handler for an artifact kind
 */
export interface ArtifactKindHandler {
  /** Validate content for this artifact kind */
  validate?: (content: string) => boolean;

  /** Transform content before storage */
  transform?: (content: string) => string;

  /** Generate preview/summary */
  generatePreview?: (content: string) => string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Tool Output Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Result from createArtifact tool
 */
export interface CreateArtifactResult {
  artifactId: string;
  title: string;
  kind: ArtifactKind;
  version: number;
  message: string;
}

/**
 * Result from updateArtifact tool
 */
export interface UpdateArtifactResult {
  artifactId: string;
  version: number;
  updatedAt: number;
  message: string;
}

/**
 * Result from appendToArtifact tool
 */
export interface AppendToArtifactResult {
  artifactId: string;
  version: number;
  bytesAdded: number;
  contentLength: number;
  message: string;
}

/**
 * Result from getArtifact tool
 */
export interface GetArtifactResult {
  artifact?: {
    id: string;
    kind: ArtifactKind;
    title: string;
    content: string;
    language?: string;
    version: number;
    createdAt: number;
    updatedAt: number;
  };
  error?: string;
}

/**
 * Result from listArtifacts tool
 */
export interface ListArtifactsResult {
  count: number;
  artifacts: Array<{
    id: string;
    kind: ArtifactKind;
    title: string;
    version: number;
    preview: string;
  }>;
}
