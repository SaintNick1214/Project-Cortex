/**
 * Artifacts module for Cortex Memory Provider
 *
 * This module provides support for creating, managing, and streaming artifacts
 * (code files, documents, diagrams, etc.) during AI conversations.
 *
 * @example
 * ```typescript
 * import {
 *   createArtifactTools,
 *   ArtifactStreamer,
 *   CortexArtifact,
 *   ArtifactKind,
 * } from '@cortexmemory/vercel-ai-provider';
 *
 * // Create tools for AI to use
 * const tools = createArtifactTools({
 *   storage: artifactStorage,
 *   writer: streamWriter,
 * });
 *
 * // Use with streamText
 * const result = streamText({
 *   model: openai('gpt-4o'),
 *   messages,
 *   tools,
 * });
 * ```
 *
 * @packageDocumentation
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Type Exports
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export {
  // Zod Schemas
  ArtifactKindSchema,
  StreamingStateSchema,
  KindConfigSchema,
  ConversationRefSchema,
  MemoryRefSchema,
  VersionEntrySchema,
  StreamingMetadataSchema,
  ArtifactStatsSchema,
  CortexArtifactSchema,
  CreateArtifactInputSchema,
  UpdateArtifactInputSchema,
  AppendToArtifactInputSchema,
  GetArtifactInputSchema,
  ListArtifactsInputSchema,
  // Constants
  ARTIFACT_STREAM_EVENTS,
} from "./types";

export type {
  // Canonical types
  ArtifactKind,
  StreamingState,
  KindConfig,
  ConversationRef,
  MemoryRef,
  VersionEntry,
  StreamingMetadata,
  ArtifactStats,
  CortexArtifact,
  // Input types
  CreateArtifactInput,
  UpdateArtifactInput,
  AppendToArtifactInput,
  GetArtifactInput,
  ListArtifactsInput,
  // Event types
  ArtifactStreamEvent,
  ArtifactStreamEventType,
  // Config types
  ArtifactConfig,
  ArtifactKindHandler,
  // Tool result types
  CreateArtifactResult,
  UpdateArtifactResult,
  AppendToArtifactResult,
  GetArtifactResult,
  ListArtifactsResult,
} from "./types";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Tool Exports
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export {
  // Main factory
  createArtifactTools,
  // Streamer class and factory
  ArtifactStreamer,
  createArtifactStreamer,
} from "./artifact-tools";

export type {
  // Interfaces
  ArtifactStorageInterface,
  ArtifactToolsContext,
  CreateArtifactToolsOptions,
  ArtifactTools,
} from "./artifact-tools";
