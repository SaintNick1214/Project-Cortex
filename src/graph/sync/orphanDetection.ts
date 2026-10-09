/** Managed orphan cleanup removes only proven derived Entity islands. Primary sources need captured deletion jobs. */
import {GraphDatabaseError,type GraphAdapter,type GraphScope,type ManagedGraphTransaction} from "../types";
import {derivedGraphIdentity} from "../identity";
export interface OrphanRule {keepIfReferencedBy?:string[];neverDelete?:boolean;explicitOnly?:boolean}
export const ORPHAN_RULES:Record<string,OrphanRule>={User:{neverDelete:true},Agent:{neverDelete:true},Participant:{neverDelete:true},MemorySpace:{neverDelete:true},Memory:{explicitOnly:true},Fact:{explicitOnly:true},Context:{explicitOnly:true},Conversation:{explicitOnly:true},Immutable:{explicitOnly:true},Mutable:{explicitOnly:true},Artifact:{explicitOnly:true},Entity:{keepIfReferencedBy:["Fact"]}};
export interface DeletionContext {deletedNodeIds:Set<string>;reason:string;timestamp:number;orphanRules?:Record<string,OrphanRule>;scope?:GraphScope}
export interface OrphanCheckResult {isOrphan:boolean;reason:string;referencedBy:string[];partOfCircularIsland:boolean;islandNodes?:string[]}
export interface DeleteResult {deletedNodes:string[];deletedEdges:string[];orphanIslands:Array<{nodes:string[];reason:string}>}
type Properties=Record<string,unknown>;
const record=(value:unknown):Properties=>value&&typeof value==="object"&&!Array.isArray(value)?value as Properties:{};
function entity(properties:Properties,scope:GraphScope):string {
 if(properties.kind!=="Entity"||typeof properties.name!=="string"||typeof properties.type!=="string")throw new GraphDatabaseError("Unknown or non-derived graph node is preserved.","GRAPH_ERASURE_BLOCKED");
 const expected=derivedGraphIdentity("Entity",properties.name,scope,properties.type);
 for(const [key,value]of Object.entries(expected.properties))if(properties[key]!==value)throw new GraphDatabaseError("Foreign or legacy Entity is preserved.","GRAPH_ERASURE_BLOCKED");
 return expected.key;
}
async function selected(nodeId:string,nodeLabel:string,context:DeletionContext,adapter:GraphAdapter):Promise<{key:string;scope:GraphScope}|null> {
 if(nodeLabel!=="Entity")return null;
 if(context.orphanRules?.Entity?.neverDelete||context.orphanRules?.Entity?.explicitOnly)return null;
 if(!context.scope||context.scope.tenantKnown!==true||typeof context.scope.memorySpaceId!=="string")throw new GraphDatabaseError("Derived orphan cleanup needs exact known tenant and space selection.","GRAPH_IDENTITY_REQUIRED");
 const node=await adapter.getNode(nodeId);if(!node)return null;
 return {key:entity(node.properties,context.scope),scope:context.scope};
}
/** Lock selected derived nodes, inspect every incident edge, and refuse incomplete traversal. No primary cascade. */
async function island(tx:ManagedGraphTransaction,start:string,scope:GraphScope,lock:boolean):Promise<{keys:string[];edges:string[];anchors:string[];circular:boolean}> {
 const queue=[{key:start,depth:0}],seen=new Set<string>(),edges=new Set<string>(),anchors=new Set<string>();let circular=false;
 while(queue.length) {
  const next=queue.shift()!;if(seen.has(next.key)){circular=true;continue;}
  if(seen.size>=64||next.depth>10)throw new GraphDatabaseError("Derived island exceeds the bounded traversal; no truncated cleanup is allowed.","GRAPH_QUERY_BUDGET");
  const found=await tx.query(`MATCH (n:CortexV2Entity {key:$key}) ${lock?"SET n.key=n.key":""} RETURN properties(n) AS node`,{key:next.key});
  if(found.count===0){if(next.key===start)return {keys:[],edges:[],anchors:[],circular:false};throw new GraphDatabaseError("Derived island changed during traversal.","GRAPH_ERASURE_BLOCKED");}
  if(found.count!==1||entity(record(found.records[0].node),scope)!==next.key)throw new GraphDatabaseError("Derived identity is ambiguous.","GRAPH_ERASURE_BLOCKED");
  seen.add(next.key);
  const links=await tx.query("MATCH (n:CortexV2Entity {key:$key})-[r]-(other) RETURN properties(r) AS edge,properties(startNode(r)) AS source,properties(endNode(r)) AS target,properties(other) AS other,type(r) AS type LIMIT 65",{key:next.key});
  if(links.count>64)throw new GraphDatabaseError("Derived incident degree exceeds the cleanup guard.","GRAPH_QUERY_BUDGET");
  for(const row of links.records) {
   const edge=record(row.edge),source=record(row.source),target=record(row.target),other=record(row.other);
   if(edge.schemaVersion!==2||typeof edge.edgeKey!=="string"||typeof edge.ownerKey!=="string"||typeof edge.ownerTuple!=="string"||edge.sourceKey!==source.key||edge.sourceTuple!==source.tupleJson||edge.targetKey!==target.key||edge.targetTuple!==target.tupleJson)throw new GraphDatabaseError("Manual, foreign or legacy edge is preserved.","GRAPH_ERASURE_BLOCKED");
   edges.add(edge.edgeKey as string);if(edges.size>128)throw new GraphDatabaseError("Derived island edge budget exceeded.","GRAPH_QUERY_BUDGET");
   if(other.kind!=="Entity") {anchors.add(String(other.key));continue;}
   const otherKey=entity(other,scope);
   if(row.type!=="ENTITY_RELATION")throw new GraphDatabaseError("Unsupported derived relationship is preserved.","GRAPH_ERASURE_BLOCKED");
   const owner=await tx.query("MATCH (s:CortexV2SourceState {key:$key}) RETURN properties(s) AS state",{key:edge.ownerKey});
   if(owner.count!==1||record(owner.records[0].state).tupleJson!==edge.ownerTuple)throw new GraphDatabaseError("Relationship owner is unresolved; preserve the island.","GRAPH_ERASURE_BLOCKED");
   if(record(owner.records[0].state).tombstoned!==true)anchors.add(edge.ownerKey as string);
   if(seen.has(otherKey))circular=true;else queue.push({key:otherKey,depth:next.depth+1});
  }
 }
 return {keys:[...seen],edges:[...edges],anchors:[...anchors],circular};
}
export async function detectOrphan(nodeId:string,nodeLabel:string,context:DeletionContext,adapter:GraphAdapter):Promise<OrphanCheckResult> {
 const target=await selected(nodeId,nodeLabel,context,adapter);
 if(!target)return {isOrphan:false,reason:"Primary, protected or absent node; captured primary erasure is separate",referencedBy:[],partOfCircularIsland:false};
 if(!adapter.managedRead)throw new GraphDatabaseError("Managed bounded graph reads are required.","GRAPH_SCHEMA_MIGRATION_REQUIRED");
 const found=await island({query:adapter.managedRead.bind(adapter)},target.key,target.scope,false);
 return {isOrphan:found.keys.length>0&&found.anchors.length===0,reason:found.anchors.length?"Preserved live references":"Proven derived island",referencedBy:found.anchors,partOfCircularIsland:found.circular,islandNodes:found.keys};
}
export async function deleteWithOrphanCleanup(nodeId:string,nodeLabel:string,context:DeletionContext,adapter:GraphAdapter):Promise<DeleteResult> {
 const target=await selected(nodeId,nodeLabel,context,adapter);
 if(!target)throw new GraphDatabaseError("Orphan cleanup cannot delete a primary, protected or unknown node. Use its original captured delete job.","GRAPH_ERASURE_BLOCKED");
 if(!adapter.managedTransaction)throw new GraphDatabaseError("Managed explicit transaction is required.","GRAPH_SCHEMA_MIGRATION_REQUIRED");
 const result=await adapter.managedTransaction(async tx=>{
  const found=await island(tx,target.key,target.scope,true);
  if(found.anchors.length)throw new GraphDatabaseError("Live references preserve the derived island.","GRAPH_ERASURE_BLOCKED");
  if(found.keys.length)await tx.query("MATCH (n:CortexV2Entity) WHERE n.key IN $keys AND n.schemaVersion=2 AND n.tenantTag=$tenantTag AND n.tenantValue=$tenantValue AND n.spaceTag='space' AND n.spaceValue=$space DETACH DELETE n",{keys:found.keys,tenantTag:target.scope.tenantId===null?"knownTenantless":"tenant",tenantValue:target.scope.tenantId??"",space:target.scope.memorySpaceId});
  return {deletedNodes:found.keys,deletedEdges:found.edges,orphanIslands:found.circular?[{nodes:found.keys,reason:"Proven scoped derived island"}]:[]};
 });
 // V2 receipts use canonical derived keys; no engine-specific id arithmetic or primary identity substitution.
 for(const key of result.deletedNodes)context.deletedNodeIds.add(key);return result;
}
export function createDeletionContext(reason:string,orphanRules?:Record<string,OrphanRule>,scope?:GraphScope):DeletionContext {return {deletedNodeIds:new Set(),reason,timestamp:Date.now(),orphanRules,scope};}
export async function canRunOrphanCleanup(adapter:GraphAdapter):Promise<boolean>{try{return !!adapter.managedTransaction&&await adapter.isConnected();}catch{return false;}}
