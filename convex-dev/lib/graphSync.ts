/** Native fixed outbox capture. Caller intent requests delivery; actual lifecycle rows supply all authority. */
import {v, ConvexError, type ObjectType, type PropertyValidators, type Infer} from "convex/values";
import {mutation, type MutationCtx, type QueryCtx} from "../_generated/server";
import type {Doc} from "../_generated/dataModel";
import {canonical, digest, byteSize, clean} from "./factHistoryProvenance";
import {reserveLifecycle, requireLifecycleReady, ensureLifecycleState, uniqueReference, captureInsertedRow, reconcileRow} from "./referenceLifecycle";

export const graphTables = {memories:"Memory", facts:"Fact", contexts:"Context", conversations:"Conversation",
  memorySpaces:"MemorySpace", immutable:"Immutable", mutable:"Mutable", artifacts:"Artifact"} as const;
export type GraphTable = keyof typeof graphTables;
type Reader = MutationCtx | QueryCtx;
const MIB = 1024 * 1024;
export const graphScopeValidator = {tenantId:v.optional(v.string())};
export const graphRequestValidator = v.object({graphInvocationId:v.string(), priority:v.optional(v.union(v.literal("high"),v.literal("normal"),v.literal("low")))});
export type GraphRequest = Infer<typeof graphRequestValidator>;
export const graphIdentityValidator = v.object({schemaVersion:v.literal(2),key:v.string(),tupleJson:v.string(),kind:v.string(),physicalSourceId:v.string(),
  tenantKnown:v.literal(true),tenantId:v.union(v.string(),v.null()),memorySpaceId:v.union(v.string(),v.null())});
export const graphReceiptValidator = v.object({id:v.id("graphSyncQueue"),generation:v.string(),identity:graphIdentityValidator,sourceRevision:v.number()});
export const graphJobFields = {
  schemaVersion:v.optional(v.literal(2)), identity:v.optional(graphIdentityValidator),
  physicalSourceId:v.optional(v.string()), sourceRevision:v.optional(v.number()),
  tenantKnown:v.optional(v.literal(true)),tenantId:v.optional(v.string()), memorySpaceId:v.optional(v.string()),
  graphInvocationId:v.optional(v.string()),requestDigest:v.optional(v.string()),projectionJson:v.optional(v.string()),projectionDigest:v.optional(v.string()),sourceDigest:v.optional(v.string()),requestJson:v.optional(v.string()),generation:v.optional(v.string()),attemptToken:v.optional(v.string()),
  referenceGeneration:v.optional(v.string()),ownershipRevision:v.optional(v.number()),projection:v.optional(v.any()),
  state:v.optional(v.union(v.literal("pending"),v.literal("synced"),v.literal("failed"),v.literal("suppressed"))),
  suppressedJobs:v.optional(v.array(graphReceiptValidator)),
  terminalAt:v.optional(v.number()),terminalAttemptToken:v.optional(v.string()),lastFailedAttemptToken:v.optional(v.string()),
  disposedAt:v.optional(v.number()),disposalRevision:v.optional(v.number()),disposedJobCount:v.optional(v.number()),
  disposalComplete:v.optional(v.boolean()),
  disposalRanges:v.optional(v.array(v.object({cursor:v.union(v.string(),v.null()),endCursor:v.union(v.string(),v.null())}))),
};
export function graphFail(code:string):never {throw new ConvexError({code,message:code});}
export function graphTable(table:string):GraphTable {if (!(table in graphTables)) graphFail("GRAPH_TABLE_UNSUPPORTED"); return table as GraphTable;}
const str = (x:unknown):string|undefined => typeof x === "string" ? x : undefined;
const obj = (x:unknown):Record<string,unknown> => x && typeof x === "object" && !Array.isArray(x) ? x as Record<string,unknown> : {};
export function sourceIdentity(table:GraphTable,row:Record<string,unknown>) {
  const physicalSourceId=str(row._id); if(!physicalSourceId)graphFail("GRAPH_PHYSICAL_SOURCE_REQUIRED");
  const tenantId=str(row.tenantId)??null, memorySpaceId=table==="immutable"||table==="mutable"?null:str(row.memorySpaceId)??null;
  if(memorySpaceId===null && table!=="immutable" && table!=="mutable")graphFail("GRAPH_SCOPE_UNRESOLVED");
  const kind=graphTables[table], tuple=["cortex.graph.v2",tenantId===null?["knownTenantless"]:["tenant",tenantId],kind,
    memorySpaceId===null?["spaceNotApplicable"]:["space",memorySpaceId],physicalSourceId];
  return {schemaVersion:2 as const,key:digest(tuple),tupleJson:canonical(tuple),kind,physicalSourceId,tenantKnown:true as const,tenantId,memorySpaceId};
}
export interface GraphProofBudget {reads:number;targets:Map<string,Doc<"cortexReferenceTargets">|null>; }
export async function sourceTarget(ctx:Reader, table:GraphTable, row:Record<string,unknown>,proof?:GraphProofBudget) {
  if(proof && ++proof.reads>16)graphFail("GRAPH_REBUILD_PROOF_BUDGET");
  const state=await requireLifecycleReady(ctx), id=str(row._id);
  const target=await ctx.db.query("cortexReferenceTargets").withIndex("by_key",q=>q.eq("key",`document:${table}:${id}`)).take(2).then(uniqueReference);
  if(!target || target.kind!=="document" || target.table!==table || target.documentId!==id || target.state!=="live" || !target.scopeKnown ||
    target.generation!==state.generation || target.preparedGeneration!==state.generation || target.tenantId!==str(row.tenantId) ||
    target.memorySpaceId!==str(row.memorySpaceId) || !Number.isSafeInteger(target.sourceRevision) || target.sourceRevision!<1)
    graphFail("GRAPH_SOURCE_NOT_PREPARED");
  // Reuse this already-read source target for self/peer references in the same native page.
  proof?.targets.set(target._id,target);
  return target;
}
const roles:Record<string,string>={space:"IN_SPACE",conversation:"REFERENCES",memory:"SOURCED_FROM",fact:"SOURCED_FROM",immutable:"SOURCED_FROM",mutable:"SOURCED_FROM",
  "context-parent":"CHILD_OF","context-root":"PART_OF","access-space":"GRANTS_ACCESS_TO","fact-supersedes":"SUPERSEDES","fact-supersededBy":"SUPERSEDED_BY"};
function relationship(table:GraphTable,role:string) {
  if(role==="conversation")return table==="contexts"?"TRIGGERED_BY":table==="facts"?"EXTRACTED_FROM":table==="artifacts"?"ARTIFACT_CONVERSATION":"REFERENCES";
  if(role==="memory" && table==="artifacts")return "ARTIFACT_MEMORY";
  return roles[role];
}
function properties(table:GraphTable,row:Record<string,unknown>):Record<string,unknown> {
  const fields:Record<GraphTable,string[]>={
    memories:["memoryId","memorySpaceId","participantId","userId","agentId","contentType","sourceType","sourceUserId","importance","tags","version","createdAt","updatedAt","isPartial"],
    facts:["factId","memorySpaceId","participantId","fact","factType","subject","predicate","object","confidence","sourceType","tags","version","supersededBy","supersedes","createdAt","updatedAt"],
    contexts:["contextId","memorySpaceId","purpose","status","depth","userId","parentId","rootId","participants","createdAt","updatedAt","completedAt"],
    conversations:["conversationId","memorySpaceId","participantId","type","messageCount","createdAt","updatedAt"],
    memorySpaces:["memorySpaceId","name","type","status","createdAt","updatedAt"],
    immutable:["type","id","version","createdAt","updatedAt"],mutable:["namespace","key","version","createdAt","updatedAt"],
    artifacts:["artifactId","memorySpaceId","userId","agentId","kind","title","version","createdAt","updatedAt"],
  };
  const result:Record<string,unknown>={}; for(const key of fields[table])if(row[key]!==undefined)result[key]=row[key];
  if(table==="memories")result.content=String(row.content??"").substring(0,200);
  if(table==="immutable"||table==="mutable")result.dataJson=canonical(row.data??row.value??null);
  if(table==="artifacts")result.contentJson=canonical({content:row.content??null,kindConfig:row.kindConfig??null});
  if(table==="conversations") {const p=obj(row.participants);if(p.userId!==undefined)result.userId=p.userId;if(p.agentId!==undefined)result.agentId=p.agentId;}
  if(table==="memorySpaces")result.participantCount=Array.isArray(row.participants)?row.participants.length:0;
  return result;
}
function derived(table:GraphTable,row:Record<string,unknown>) {
  const result:Array<{kind:string;logicalId:string;entityType?:string;relationship:string;properties:Record<string,unknown>}>=[];
  const participant=obj(row.participants), anchors={User:str(row.userId)??str(participant.userId),Agent:str(row.agentId)??str(participant.agentId),Participant:str(row.participantId)};
  for(const [kind,logicalId]of Object.entries(anchors))if(logicalId)result.push({kind,logicalId,relationship:kind==="Participant"?(table==="facts"?"EXTRACTED_BY":table==="memories"?"STORED_BY":"HAS_PARTICIPANT"):table==="contexts"||table==="conversations"?"INVOLVES":"RELATES_TO",properties:{}});
  if(table==="facts") {
    const entities=Array.isArray(row.entities)?row.entities.map(obj):[];
    for(const [logicalId,entityType] of [[str(row.subject),"subject"],[str(row.object),"object"]])if(logicalId && !entities.some(e=>str(e.name)?.trim().toLowerCase()===logicalId.trim().toLowerCase()))entities.push({name:logicalId,type:entityType});
    for(const relation of Array.isArray(row.relations)?row.relations.map(obj):[]) {
      for(const [name,type]of [[str(relation.subject),"subject"],[str(relation.object),"object"]])
        if(name && !entities.some(e=>str(e.name)?.trim().toLowerCase()===name.trim().toLowerCase()))entities.push({name,type});
    }
    for(const entity of entities)if(str(entity.name)&&str(entity.type))result.push({kind:"Entity",logicalId:String(entity.name),entityType:String(entity.type),relationship:"MENTIONS",properties:clean({fullValue:entity.fullValue,role:entity.type})});
  }
  return result;
}
export async function capturedProjection(ctx:Reader,table:GraphTable,row:Record<string,unknown>,target:Doc<"cortexReferenceTargets">,
  operation:"insert"|"update"|"delete", revision=target.sourceRevision!,proof?:GraphProofBudget) {
  const identity=sourceIdentity(table,row), references=[];
  const edges=await ctx.db.query("cortexReferenceEdges").withIndex("by_source",q=>q.eq("sourceTargetId",target._id)).take(65);
  if(edges.length>64)graphFail("GRAPH_RELATIONSHIP_BUDGET");
  const targets=proof?.targets??new Map<string,Doc<"cortexReferenceTargets">|null>();
  for(const edge of edges) {
    const rel=relationship(table,edge.role); if(!rel)continue;
    if(edge.kind==="unresolved")graphFail("GRAPH_REFERENCE_UNRESOLVED");
    if(!edge.targetTargetId)continue;
    if(!targets.has(edge.targetTargetId)) {
      if(proof?++proof.reads>16:targets.size>=16)graphFail(proof?"GRAPH_REBUILD_PROOF_BUDGET":"GRAPH_PROOF_READ_BUDGET");
      targets.set(edge.targetTargetId,await ctx.db.get(edge.targetTargetId));
    }
    const other=targets.get(edge.targetTargetId);
    if(!other || other.kind!=="document" || !other.table || !(other.table in graphTables) || !other.documentId || !other.scopeKnown ||
      other.generation!==target.generation || other.tenantId!==edge.capturedTargetTenantId || other.memorySpaceId!==edge.capturedTargetMemorySpaceId ||
      other.ownershipRevision!==edge.capturedOwnershipRevision || other.tenantId!==str(row.tenantId) || !Number.isSafeInteger(other.sourceRevision))
      graphFail("GRAPH_REFERENCE_UNRESOLVED");
    // Deleted known targets retain their exact captured identity; graph delivery reports them absent.
    references.push({role:edge.role,slot:edge.slot,relationship:rel,
      identity:sourceIdentity(other.table as GraphTable,{_id:other.documentId,tenantId:other.tenantId,memorySpaceId:other.memorySpaceId}),
      sourceRevision:other.sourceRevision!,ownershipRevision:other.ownershipRevision!,referenceGeneration:other.generation});
  }
  const nodes=operation==="delete"?[]:derived(table,row);
  const derivedRelations=table!=="facts"||operation==="delete"?[]:(Array.isArray(row.relations)?row.relations.map(obj):[]).map(relation=>{
    const subject=str(relation.subject),object=str(relation.object),predicate=str(relation.predicate);
    if(!subject||!object||!predicate)graphFail("GRAPH_RELATIONSHIP_INVALID");
    const nodeType=(name:string,fallback:string)=>nodes.find(n=>n.kind==="Entity"&&n.logicalId.trim().toLowerCase()===name.trim().toLowerCase())?.entityType??fallback;
    return {subject:{name:subject,type:nodeType(subject,"subject")},object:{name:object,type:nodeType(object,"object")},predicate};
  });
  const projection={identity,sourceRevision:revision,properties:operation==="delete"?{}:properties(table,row),references,derived:nodes,derivedRelations};
  if(projection.derived.length+1>32 || projection.derived.length+references.length+derivedRelations.length>64 || byteSize(projection)>256*1024)graphFail("GRAPH_PROJECTION_BUDGET");
  const metrics=await ctx.meta.getTransactionMetrics();
  if(metrics.bytesRead.used>12*MIB || metrics.bytesRead.remaining<256*1024)graphFail("GRAPH_NATIVE_BUDGET");
  return projection;
}
export function graphSourceDigest(projection: Awaited<ReturnType<typeof capturedProjection>>): string {
  return digest({...projection,references:projection.references.map(({sourceRevision:_targetRevision,...binding})=>binding)});
}
type Receipt = Infer<typeof graphReceiptValidator>;
type Capture={request:{graphInvocationId:string;priority?:"high"|"normal"|"low"};receipts:Receipt[]};
const captures=new WeakMap<object,Capture>();
export function currentGraphReceipts(ctx:MutationCtx):Receipt[] {return [...(captures.get(ctx)?.receipts??[])];}
export async function captureGraphChange(ctx:MutationCtx, table:string, row:Record<string,unknown>, target:Doc<"cortexReferenceTargets">,
  operation:"insert"|"update"|"delete",revision=target.sourceRevision!) {
  const capture=captures.get(ctx);if(!capture || !(table in graphTables))return;
  const fixed=graphTable(table),projection=await capturedProjection(ctx,fixed,row,target,operation,revision);
  const suppressedJobs=operation==="delete"?await suppressPriorGraphJobs(ctx,fixed,projection.identity,revision):[];
  const sourceDigest=graphSourceDigest(projection);
  const requestBody={sourceDigest,suppressedJobs,request:{graphInvocationId:capture.request.graphInvocationId,priority:capture.request.priority??"normal"},table:fixed,operation,projection};
  const requestDigest=digest(requestBody),requestJson=canonical(requestBody),projectionJson=canonical(projection),projectionDigest=digest(projection),identity=projection.identity;
  const existing=await ctx.db.query("graphSyncQueue").withIndex("by_invocation_source",q=>q.eq("tenantId",identity.tenantId??undefined)
    .eq("graphInvocationId",capture.request.graphInvocationId).eq("physicalSourceId",identity.physicalSourceId).eq("sourceRevision",revision).eq("operation",operation)).take(2).then(uniqueReference);
  if(existing) {
    if(existing.requestDigest!==requestDigest || !existing.generation)graphFail("GRAPH_JOB_DIGEST_CONFLICT");
    capture.receipts.push({id:existing._id,generation:existing.generation,identity,sourceRevision:revision});return;
  }
  const job=clean({schemaVersion:2 as const,table:fixed,entityId:identity.physicalSourceId,operation,synced:false,failedAttempts:0,
    priority:capture.request.priority??"normal",createdAt:Date.now(),identity,physicalSourceId:identity.physicalSourceId,sourceRevision:revision,
    tenantKnown:true as const,tenantId:identity.tenantId??undefined,memorySpaceId:identity.memorySpaceId??undefined,
    graphInvocationId:capture.request.graphInvocationId,requestDigest,requestJson,projectionJson,projectionDigest,sourceDigest,suppressedJobs,generation:crypto.randomUUID(),attemptToken:crypto.randomUUID(),
    referenceGeneration:target.generation,ownershipRevision:target.ownershipRevision!,projection,state:"pending" as const});
  if(byteSize(job)+8192>1024*1024)graphFail("GRAPH_PROJECTION_BUDGET");
  await reserveLifecycle(ctx,0,byteSize(job)+8192,3);
  const id=await captureInsertedRow(ctx,"graphSyncQueue",job);
  capture.receipts.push({id,generation:job.generation,identity,sourceRevision:revision});
}
/** Exact targeted native queue barrier. It never scans another source or discards an unexamined tail. */
async function suppressPriorGraphJobs(ctx:MutationCtx,table:GraphTable,identity:ReturnType<typeof sourceIdentity>,revision:number) {
  const pending=await ctx.db.query("graphSyncQueue").withIndex("by_scope_source_state",q=>q.eq("tenantId",identity.tenantId??undefined).eq("physicalSourceId",identity.physicalSourceId).eq("state","pending")).take(129);
  const failed=await ctx.db.query("graphSyncQueue").withIndex("by_scope_source_state",q=>q.eq("tenantId",identity.tenantId??undefined).eq("physicalSourceId",identity.physicalSourceId).eq("state","failed")).take(129);
  const rows=[...pending,...failed];if(rows.length>128)graphFail("GRAPH_ERASURE_QUEUE_BUDGET");
  const receipts=[];let writes=0;
  for(const row of rows) {
    if(row.schemaVersion!==2||row.table!==table||row.identity?.key!==identity.key||row.identity?.tupleJson!==identity.tupleJson||!row.generation||!row.attemptToken||!Number.isSafeInteger(row.sourceRevision)||row.sourceRevision!>revision)graphFail("GRAPH_JOB_UNRESOLVED");
    writes+=byteSize(row)+4096;receipts.push({id:row._id,generation:row.generation,identity:row.identity,sourceRevision:row.sourceRevision!});
  }
  await reserveLifecycle(ctx,0,writes,rows.length*3);
  for(const row of rows)await reconcileRow(ctx,row._id,{state:"suppressed",synced:false,terminalAt:Date.now(),terminalAttemptToken:row.attemptToken,lastError:undefined});
  return receipts;
}
/** Task19 calls this in its native source-erasure transaction BEFORE markDeletedRow/source disappearance. */
export async function captureGraphErasure(ctx:MutationCtx,table:GraphTable,row:Record<string,unknown>,request:GraphRequest) {
  if(captures.has(ctx))graphFail("GRAPH_CAPTURE_CONTEXT_CONFLICT");
  if(!request.graphInvocationId||request.graphInvocationId.length>256)graphFail("GRAPH_INVOCATION_INVALID");
  const target=await sourceTarget(ctx,table,row),capture:Capture={request,receipts:[]};captures.set(ctx,capture);
  try {await captureGraphChange(ctx,table,row,target,"delete",target.sourceRevision!+1);return capture.receipts;}finally{captures.delete(ctx);}
}
/** Only the named graph primary writer registrations use this optional capture envelope. */
export function graphMutation<A extends PropertyValidators,R>(definition:{args:A;handler:(ctx:MutationCtx,args:ObjectType<A>)=>Promise<R>}) {
  return mutation({args:{...definition.args,queueGraph:v.optional(graphRequestValidator)},handler:async(ctx,args)=>{
    const {queueGraph,...original}=args;
    if(!queueGraph)return definition.handler(ctx,original as ObjectType<A>);
    if(!queueGraph.graphInvocationId || queueGraph.graphInvocationId.length>256)graphFail("GRAPH_INVOCATION_INVALID");
    await ensureLifecycleState(ctx);
    await requireLifecycleReady(ctx);
    const capture:Capture={request:queueGraph,receipts:[]};captures.set(ctx,capture);
    try {
      const result=await definition.handler(ctx,original as ObjectType<A>);
      let receipts=capture.receipts;
      // Facts replay authority is the original immutable history anchor, never the live result.
      const value=obj(result),history=obj(value.historyReceipt),events=Array.isArray(history.events)?history.events:[];
      for(const event of events) {
        const id=str(obj(event)._id);const normalized=id?ctx.db.normalizeId("factHistory",id):null;
        if(!normalized)graphFail("GRAPH_HISTORY_ANCHOR_REQUIRED");
        const anchor=await ctx.db.get(normalized);if(!anchor)graphFail("GRAPH_HISTORY_ANCHOR_REQUIRED");
        if(anchor.graphJobs)receipts=anchor.graphJobs;
        else if(receipts.length) {
          const metrics=await ctx.meta.getTransactionMetrics(),estimate=byteSize(anchor)+byteSize(receipts)+4096;
          if(metrics.bytesWritten.used+estimate>3*MIB)graphFail("FACT_HISTORY_BUDGET_EXCEEDED");
          await reconcileRow(ctx,anchor._id,{graphJobs:receipts});
        }
      }
      const envelope={graphVersion:2 as const,primaryResult:(result===undefined?null:result) as R extends void ? null : R,graphJobs:receipts};
      const metrics=await ctx.meta.getTransactionMetrics();
      if(byteSize(envelope)>8*MIB || metrics.bytesRead.used>12*MIB || (events.length && metrics.bytesWritten.used>3*MIB))graphFail("GRAPH_NATIVE_BUDGET");
      return envelope;
    }finally{captures.delete(ctx);}
  }});
}

/** Trusted transaction-callable compatibility capture; no source CRUD or arbitrary entity payload. */
export async function captureValidatedGraphJob(ctx:MutationCtx, table:GraphTable, row:Record<string,unknown>, request:GraphRequest, operation:"insert"|"update"|"delete") {
  if(captures.has(ctx))graphFail("GRAPH_CAPTURE_CONTEXT_CONFLICT");
  const target=await sourceTarget(ctx,table,row),capture:Capture={request,receipts:[]};captures.set(ctx,capture);
  try {await captureGraphChange(ctx,table,row,target,operation);return capture.receipts;}finally{captures.delete(ctx);}
}
