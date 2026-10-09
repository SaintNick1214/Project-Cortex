/** Managed-v2 compatibility. Legacy logical IDs cannot establish physical source authority. */
import {GraphDatabaseError,type GraphAdapter} from "../types";
import type {DeleteResult} from "./orphanDetection";
/** @deprecated Use graph-enabled domain writes and their original captured jobs. Uncaptured writes refuse before effects. */
export async function deleteMemoryFromGraph(
  memoryId: string,
  adapter: GraphAdapter,
  enableOrphanCleanup: boolean = true,
): Promise<DeleteResult> {
  void [memoryId, adapter, enableOrphanCleanup];
  throw new GraphDatabaseError("This logical-ID helper cannot establish physical graph authority. Use graph-enabled domain writes and their original native jobs, or explicit administrator initialGraphSync for existing data.", "GRAPH_CAPTURED_JOB_REQUIRED");
}

/** @deprecated Use graph-enabled domain writes and their original captured jobs. Uncaptured writes refuse before effects. */
export async function deleteFactFromGraph(
  factId: string,
  adapter: GraphAdapter,
  enableOrphanCleanup: boolean = true,
): Promise<DeleteResult> {
  void [factId, adapter, enableOrphanCleanup];
  throw new GraphDatabaseError("This logical-ID helper cannot establish physical graph authority. Use graph-enabled domain writes and their original native jobs, or explicit administrator initialGraphSync for existing data.", "GRAPH_CAPTURED_JOB_REQUIRED");
}

/** @deprecated Use graph-enabled domain writes and their original captured jobs. Uncaptured writes refuse before effects. */
export async function deleteContextFromGraph(
  contextId: string,
  adapter: GraphAdapter,
  enableOrphanCleanup: boolean = true,
): Promise<DeleteResult> {
  void [contextId, adapter, enableOrphanCleanup];
  throw new GraphDatabaseError("This logical-ID helper cannot establish physical graph authority. Use graph-enabled domain writes and their original native jobs, or explicit administrator initialGraphSync for existing data.", "GRAPH_CAPTURED_JOB_REQUIRED");
}

/** @deprecated Use graph-enabled domain writes and their original captured jobs. Uncaptured writes refuse before effects. */
export async function deleteConversationFromGraph(
  conversationId: string,
  adapter: GraphAdapter,
  enableOrphanCleanup: boolean = true,
): Promise<DeleteResult> {
  void [conversationId, adapter, enableOrphanCleanup];
  throw new GraphDatabaseError("This logical-ID helper cannot establish physical graph authority. Use graph-enabled domain writes and their original native jobs, or explicit administrator initialGraphSync for existing data.", "GRAPH_CAPTURED_JOB_REQUIRED");
}

/** @deprecated Use graph-enabled domain writes and their original captured jobs. Uncaptured writes refuse before effects. */
export async function deleteMemorySpaceFromGraph(
  memorySpaceId: string,
  adapter: GraphAdapter,
): Promise<DeleteResult> {
  void [memorySpaceId, adapter];
  throw new GraphDatabaseError("This logical-ID helper cannot establish physical graph authority. Use graph-enabled domain writes and their original native jobs, or explicit administrator initialGraphSync for existing data.", "GRAPH_CAPTURED_JOB_REQUIRED");
}

/** @deprecated Use graph-enabled domain writes and their original captured jobs. Uncaptured writes refuse before effects. */
export async function deleteImmutableFromGraph(
  immutableType: string,
  immutableId: string,
  adapter: GraphAdapter,
  enableOrphanCleanup: boolean = true,
): Promise<DeleteResult> {
  void [immutableType, immutableId, adapter, enableOrphanCleanup];
  throw new GraphDatabaseError("This logical-ID helper cannot establish physical graph authority. Use graph-enabled domain writes and their original native jobs, or explicit administrator initialGraphSync for existing data.", "GRAPH_CAPTURED_JOB_REQUIRED");
}

/** @deprecated Use graph-enabled domain writes and their original captured jobs. Uncaptured writes refuse before effects. */
export async function deleteMutableFromGraph(
  namespace: string,
  key: string,
  adapter: GraphAdapter,
): Promise<DeleteResult> {
  void [namespace, key, adapter];
  throw new GraphDatabaseError("This logical-ID helper cannot establish physical graph authority. Use graph-enabled domain writes and their original native jobs, or explicit administrator initialGraphSync for existing data.", "GRAPH_CAPTURED_JOB_REQUIRED");
}
