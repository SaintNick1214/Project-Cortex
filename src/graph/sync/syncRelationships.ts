/** Managed-v2 compatibility. Legacy logical IDs cannot establish physical source authority. */
import {GraphDatabaseError,type GraphAdapter} from "../types";
import type {Context} from "../../contexts";
import type {Conversation,MemoryEntry,FactRecord} from "../../types";
/** @deprecated Use graph-enabled domain writes and their original captured jobs. Uncaptured writes refuse before effects. */
export async function syncContextRelationships(
  context: Context,
  contextNodeId: string,
  adapter: GraphAdapter,
): Promise<void> {
  void [context, contextNodeId, adapter];
  throw new GraphDatabaseError("This logical-ID helper cannot establish physical graph authority. Use graph-enabled domain writes and their original native jobs, or explicit administrator initialGraphSync for existing data.", "GRAPH_CAPTURED_JOB_REQUIRED");
}

/** @deprecated Use graph-enabled domain writes and their original captured jobs. Uncaptured writes refuse before effects. */
export async function syncConversationRelationships(
  conversation: Conversation,
  conversationNodeId: string,
  adapter: GraphAdapter,
): Promise<void> {
  void [conversation, conversationNodeId, adapter];
  throw new GraphDatabaseError("This logical-ID helper cannot establish physical graph authority. Use graph-enabled domain writes and their original native jobs, or explicit administrator initialGraphSync for existing data.", "GRAPH_CAPTURED_JOB_REQUIRED");
}

/** @deprecated Use graph-enabled domain writes and their original captured jobs. Uncaptured writes refuse before effects. */
export async function syncMemoryRelationships(
  memory: MemoryEntry,
  memoryNodeId: string,
  adapter: GraphAdapter,
): Promise<void> {
  void [memory, memoryNodeId, adapter];
  throw new GraphDatabaseError("This logical-ID helper cannot establish physical graph authority. Use graph-enabled domain writes and their original native jobs, or explicit administrator initialGraphSync for existing data.", "GRAPH_CAPTURED_JOB_REQUIRED");
}

/** @deprecated Use graph-enabled domain writes and their original captured jobs. Uncaptured writes refuse before effects. */
export async function syncFactRelationships(
  fact: FactRecord,
  factNodeId: string,
  adapter: GraphAdapter,
): Promise<void> {
  void [fact, factNodeId, adapter];
  throw new GraphDatabaseError("This logical-ID helper cannot establish physical graph authority. Use graph-enabled domain writes and their original native jobs, or explicit administrator initialGraphSync for existing data.", "GRAPH_CAPTURED_JOB_REQUIRED");
}

/** @deprecated Use graph-enabled domain writes and their original captured jobs. Uncaptured writes refuse before effects. */
export async function syncA2ARelationships(
  memory: MemoryEntry,
  adapter: GraphAdapter,
): Promise<void> {
  void [memory, adapter];
  throw new GraphDatabaseError("This logical-ID helper cannot establish physical graph authority. Use graph-enabled domain writes and their original native jobs, or explicit administrator initialGraphSync for existing data.", "GRAPH_CAPTURED_JOB_REQUIRED");
}
