/** Managed-v2 compatibility. Legacy logical IDs cannot establish physical source authority. */
import {GraphDatabaseError,type GraphAdapter,type GraphIdentity} from "../types";
import {MANAGED_LABELS,identityProperties,assertIdentityProperties,primaryGraphIdentity} from "../identity";
import type {Context} from "../../contexts";
import type {Conversation,MemoryEntry,FactRecord,MemorySpace} from "../../types";

/** Exact physical lookup; omission of captured identity is a migration error, never a wildcard. */
export async function findGraphNodeId(label:string,cortexId:string,adapter:GraphAdapter,identity?:GraphIdentity):Promise<string|null> {
  if(!identity||identity.kind!==label)throw new GraphDatabaseError("Pass captured native physical identity and exact scope for managed lookup.","GRAPH_IDENTITY_REQUIRED");
  identityProperties(identity);
  const display:Record<string,string>={Context:"contextId",Conversation:"conversationId",Memory:"memoryId",Fact:"factId",MemorySpace:"memorySpaceId",Immutable:"id",Mutable:"mutableKey",Artifact:"artifactId"};
  const nodes=await adapter.findNodes(MANAGED_LABELS[identity.kind],{key:identity.key},2);
  if(nodes.length>1)throw new GraphDatabaseError("Managed physical graph identity is ambiguous.","GRAPH_IDENTITY_MISMATCH");
  if(!nodes.length)return null;
  assertIdentityProperties(nodes[0].properties,identity);
  if(nodes[0].properties[display[label]]!==cortexId||!nodes[0].id)throw new GraphDatabaseError("Captured physical identity does not match the requested display ID.","GRAPH_IDENTITY_MISMATCH");
  return nodes[0].id;
}

/** Bounded managed-only chain. Every intermediate node and edge must remain inside exact captured scope. */
export async function getFactSupersessionChainFromGraph(factId:string,adapter:GraphAdapter,identity?:GraphIdentity):Promise<Array<{factId:string;fact:string;supersededAt?:number}>> {
  if(!identity||identity.kind!=="Fact")throw new GraphDatabaseError("Pass the captured physical Fact identity for a scoped chain.","GRAPH_IDENTITY_REQUIRED");
  if(await findGraphNodeId("Fact",factId,adapter,identity)===null)return [];
  if(!adapter.managedRead)throw new GraphDatabaseError("Adapter lacks managed bounded reads.","GRAPH_SCHEMA_MIGRATION_REQUIRED");
  const result=await adapter.managedRead(`MATCH path=(start:CortexV2Fact {key:$key})-[:SUPERSEDES|SUPERSEDED_BY*0..10]-(node:CortexV2Fact)
    WHERE all(n IN nodes(path) WHERE n.schemaVersion=2 AND n.kind='Fact' AND n.tenantTag=$tenantTag AND n.tenantValue=$tenantValue AND n.spaceTag='space' AND n.spaceValue=$space)
      AND all(r IN relationships(path) WHERE r.schemaVersion=2 AND r.sourceKey=startNode(r).key AND r.targetKey=endNode(r).key AND r.ownerKey=r.sourceKey)
    RETURN DISTINCT properties(node) AS node,length(path) AS hops ORDER BY node.createdAt ASC LIMIT 65`,
    {key:identity.key,tenantTag:identity.tenantId===null?"knownTenantless":"tenant",tenantValue:identity.tenantId??"",space:identity.memorySpaceId});
  if(result.count>64||result.records.some(r=>r.hops===10))throw new GraphDatabaseError("Supersession chain exceeds the bounded graph query; no truncated chain is returned.","GRAPH_QUERY_BUDGET");
  const seen=new Set<string>(),chain=[];
  for(const record of result.records){const node=record.node as Record<string,unknown>;
    const captured=primaryGraphIdentity("Fact",String(node.physicalSourceId),identity);assertIdentityProperties(node,captured);
    if(seen.has(captured.key))continue;seen.add(captured.key);
    if(typeof node.factId!=="string"||typeof node.fact!=="string")throw new GraphDatabaseError("Managed Fact projection is malformed.","GRAPH_IDENTITY_MISMATCH");
    chain.push({factId:node.factId,fact:node.fact,...typeof node.statusUpdatedAt==="number"?{supersededAt:node.statusUpdatedAt}:{}});
  }
  return chain;
}
/** @deprecated Use graph-enabled domain writes and their original captured jobs. Uncaptured writes refuse before effects. */
export async function syncContextToGraph(
  context: Context,
  adapter: GraphAdapter,
  tenantId?: string,
): Promise<string> {
  void [context, adapter, tenantId];
  throw new GraphDatabaseError("This logical-ID helper cannot establish physical graph authority. Use graph-enabled domain writes and their original native jobs, or explicit administrator initialGraphSync for existing data.", "GRAPH_CAPTURED_JOB_REQUIRED");
}

/** @deprecated Use graph-enabled domain writes and their original captured jobs. Uncaptured writes refuse before effects. */
export async function syncConversationToGraph(
  conversation: Conversation,
  adapter: GraphAdapter,
  tenantId?: string,
): Promise<string> {
  void [conversation, adapter, tenantId];
  throw new GraphDatabaseError("This logical-ID helper cannot establish physical graph authority. Use graph-enabled domain writes and their original native jobs, or explicit administrator initialGraphSync for existing data.", "GRAPH_CAPTURED_JOB_REQUIRED");
}

/** @deprecated Use graph-enabled domain writes and their original captured jobs. Uncaptured writes refuse before effects. */
export async function syncMemoryToGraph(
  memory: MemoryEntry,
  adapter: GraphAdapter,
  tenantId?: string,
): Promise<string> {
  void [memory, adapter, tenantId];
  throw new GraphDatabaseError("This logical-ID helper cannot establish physical graph authority. Use graph-enabled domain writes and their original native jobs, or explicit administrator initialGraphSync for existing data.", "GRAPH_CAPTURED_JOB_REQUIRED");
}

/** @deprecated Use graph-enabled domain writes and their original captured jobs. Uncaptured writes refuse before effects. */
export async function syncFactToGraph(
  fact: FactRecord,
  adapter: GraphAdapter,
  tenantId?: string,
): Promise<string> {
  void [fact, adapter, tenantId];
  throw new GraphDatabaseError("This logical-ID helper cannot establish physical graph authority. Use graph-enabled domain writes and their original native jobs, or explicit administrator initialGraphSync for existing data.", "GRAPH_CAPTURED_JOB_REQUIRED");
}

/** @deprecated Use graph-enabled domain writes and their original captured jobs. Uncaptured writes refuse before effects. */
export async function syncMemorySpaceToGraph(
  memorySpace: MemorySpace,
  adapter: GraphAdapter,
  tenantId?: string,
): Promise<string> {
  void [memorySpace, adapter, tenantId];
  throw new GraphDatabaseError("This logical-ID helper cannot establish physical graph authority. Use graph-enabled domain writes and their original native jobs, or explicit administrator initialGraphSync for existing data.", "GRAPH_CAPTURED_JOB_REQUIRED");
}

/** @deprecated Use graph-enabled domain writes and their original captured jobs. Uncaptured writes refuse before effects. */
export async function ensureUserNode(
  userId: string,
  adapter: GraphAdapter,
  tenantId?: string,
): Promise<string> {
  void [userId, adapter, tenantId];
  throw new GraphDatabaseError("This logical-ID helper cannot establish physical graph authority. Use graph-enabled domain writes and their original native jobs, or explicit administrator initialGraphSync for existing data.", "GRAPH_CAPTURED_JOB_REQUIRED");
}

/** @deprecated Use graph-enabled domain writes and their original captured jobs. Uncaptured writes refuse before effects. */
export async function ensureAgentNode(
  agentId: string,
  adapter: GraphAdapter,
  tenantId?: string,
): Promise<string> {
  void [agentId, adapter, tenantId];
  throw new GraphDatabaseError("This logical-ID helper cannot establish physical graph authority. Use graph-enabled domain writes and their original native jobs, or explicit administrator initialGraphSync for existing data.", "GRAPH_CAPTURED_JOB_REQUIRED");
}

/** @deprecated Use graph-enabled domain writes and their original captured jobs. Uncaptured writes refuse before effects. */
export async function ensureParticipantNode(
  participantId: string,
  adapter: GraphAdapter,
  tenantId?: string,
): Promise<string> {
  void [participantId, adapter, tenantId];
  throw new GraphDatabaseError("This logical-ID helper cannot establish physical graph authority. Use graph-enabled domain writes and their original native jobs, or explicit administrator initialGraphSync for existing data.", "GRAPH_CAPTURED_JOB_REQUIRED");
}

/** @deprecated Use graph-enabled domain writes and their original captured jobs. Uncaptured writes refuse before effects. */
export async function ensureEntityNode(
  entityName: string,
  entityType: string,
  adapter: GraphAdapter,
  tenantId?: string,
): Promise<string> {
  void [entityName, entityType, adapter, tenantId];
  throw new GraphDatabaseError("This logical-ID helper cannot establish physical graph authority. Use graph-enabled domain writes and their original native jobs, or explicit administrator initialGraphSync for existing data.", "GRAPH_CAPTURED_JOB_REQUIRED");
}

/** @deprecated Use graph-enabled domain writes and their original captured jobs. Uncaptured writes refuse before effects. */
export async function ensureEnrichedEntityNode(
  entityName: string,
  entityType: string,
  fullValue: string | undefined,
  adapter: GraphAdapter,
  tenantId?: string,
): Promise<string> {
  void [entityName, entityType, fullValue, adapter, tenantId];
  throw new GraphDatabaseError("This logical-ID helper cannot establish physical graph authority. Use graph-enabled domain writes and their original native jobs, or explicit administrator initialGraphSync for existing data.", "GRAPH_CAPTURED_JOB_REQUIRED");
}

/** @deprecated Use graph-enabled domain writes and their original captured jobs. Uncaptured writes refuse before effects. */
export async function syncFactSupersession(
  oldFact: FactRecord,
  newFact: FactRecord,
  adapter: GraphAdapter,
  reason?: string,
  tenantId?: string,
): Promise<{ oldNodeId: string; newNodeId: string; relationshipId: string }> {
  void [oldFact, newFact, adapter, reason, tenantId];
  throw new GraphDatabaseError("This logical-ID helper cannot establish physical graph authority. Use graph-enabled domain writes and their original native jobs, or explicit administrator initialGraphSync for existing data.", "GRAPH_CAPTURED_JOB_REQUIRED");
}

/** @deprecated Use graph-enabled domain writes and their original captured jobs. Uncaptured writes refuse before effects. */
export async function updateFactGraphStatus(
  factId: string,
  status: "active" | "superseded" | "deleted",
  adapter: GraphAdapter,
): Promise<void> {
  void [factId, status, adapter];
  throw new GraphDatabaseError("This logical-ID helper cannot establish physical graph authority. Use graph-enabled domain writes and their original native jobs, or explicit administrator initialGraphSync for existing data.", "GRAPH_CAPTURED_JOB_REQUIRED");
}

/** @deprecated Use graph-enabled domain writes and their original captured jobs. Uncaptured writes refuse before effects. */
export async function syncFactUpdateInPlace(
  fact: FactRecord,
  adapter: GraphAdapter,
  tenantId?: string,
): Promise<string> {
  void [fact, adapter, tenantId];
  throw new GraphDatabaseError("This logical-ID helper cannot establish physical graph authority. Use graph-enabled domain writes and their original native jobs, or explicit administrator initialGraphSync for existing data.", "GRAPH_CAPTURED_JOB_REQUIRED");
}

/** @deprecated Use graph-enabled domain writes and their original captured jobs. Uncaptured writes refuse before effects. */
export async function syncFactRevision(
  originalFact: FactRecord,
  revisedFact: FactRecord,
  adapter: GraphAdapter,
  reason?: string,
  tenantId?: string,
): Promise<{
  originalNodeId: string;
  revisedNodeId: string;
  relationshipId: string;
}> {
  void [originalFact, revisedFact, adapter, reason, tenantId];
  throw new GraphDatabaseError("This logical-ID helper cannot establish physical graph authority. Use graph-enabled domain writes and their original native jobs, or explicit administrator initialGraphSync for existing data.", "GRAPH_CAPTURED_JOB_REQUIRED");
}

/** @deprecated Use graph-enabled domain writes and their original captured jobs. Uncaptured writes refuse before effects. */
export async function removeFactSupersessionRelationships(
  factId: string,
  adapter: GraphAdapter,
): Promise<number> {
  void [factId, adapter];
  throw new GraphDatabaseError("This logical-ID helper cannot establish physical graph authority. Use graph-enabled domain writes and their original native jobs, or explicit administrator initialGraphSync for existing data.", "GRAPH_CAPTURED_JOB_REQUIRED");
}
