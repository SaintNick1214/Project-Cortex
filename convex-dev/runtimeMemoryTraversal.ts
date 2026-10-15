import { createSha256 } from "../src/common/crypto";
/** Current Convex evidence adjacency; projection rows are candidates, never authority. */
import type { DatabaseWriter, QueryCtx } from "./_generated/server";
import type { DerivedFact, SourceContent } from "../src/domain/contracts";
import type { MemoryEvidenceNode, MemoryEvidencePage } from "../src/domain/memory-traversal";
import type { EffectiveMemoryEffortPolicy } from "../src/domain/memory-effort";
import { traverseMemoryEvidence } from "../src/domain/memory-traversal";
import { factToRecallItem } from "../src/domain/recall";
import { literalPropertyEvidence } from "../src/domain/memory-direct-recall";
import { ConvexMemoryRepository, captureRecallFact, captureRecallSource,isMemoryResourceDenied,canonicalMemoryValue,memoryError } from "./runtimeMemoryRepository";
import type { MemoryDeliveryBindings } from "./runtimeMemoryRepository";

export function createMemoryRetrievalWorkClock() {
  // Capture at the native handler boundary, before its source/hydration awaits.
  // Each invocation gets its own performance origin; only epoch start crosses RPCs.
  const startedAt=Date.now(),origin=performance.now();
  return {startedAt,now:()=>{
    const elapsed=performance.now()-origin;
    if(!Number.isFinite(origin)||!Number.isFinite(elapsed)||elapsed<0)memoryError("INVALID_STATE","Invalid retrieval work clock");
    return startedAt+elapsed;
  }};
}

export function factEntityKeys(fact: Pick<DerivedFact,"subject"|"object"|"entities"|"relations">): string[] {
  // Exact canonical labels only; no substring, invented conversation or fuzzy links.
  return [...new Set([fact.subject,fact.object,...(fact.entities??[]).map(value=>value.name),...(fact.relations??[]).flatMap(value=>[value.subject,value.object])]
    .filter((value):value is string=>typeof value==="string"&&value.trim().length>0).map(value=>value.normalize("NFC").trim()))].sort();
}
export async function replaceFactEntityLinks(db: DatabaseWriter, fact: Pick<DerivedFact,"tenantId"|"memorySpaceId"|"ownerPrincipalId"|"factId"|"version"|"lineage"|"subject"|"object"|"entities"|"relations">) {
  const old=await db.query("runtimeMemoryFactEntities").withIndex("by_scope_fact",q=>q.eq("tenantId",fact.tenantId!).eq("memorySpaceId",fact.memorySpaceId).eq("factId",fact.factId)).take(65);
  for(const row of old) await db.delete("runtimeMemoryFactEntities",row._id);
  // Projection work bound, not an entry/depth limit. Oversize evidence reports partial coverage on reads.
  for(const entityKey of factEntityKeys(fact).slice(0,64)) await db.insert("runtimeMemoryFactEntities",{
    tenantId:fact.tenantId!,memorySpaceId:fact.memorySpaceId,ownerPrincipalId:fact.ownerPrincipalId,entityKey,factId:fact.factId,factVersion:fact.version,
    sourceId:fact.lineage.sourceId,sourceEventId:fact.lineage.sourceEventId,sourceRevision:fact.lineage.sourceRevision });
}
export function factEvidenceNode(fact:DerivedFact,score=.7):MemoryEvidenceNode { return {key:`fact:${fact.factId}`,item:factToRecallItem(fact,"facts",score),lineage:fact.lineage}; }
export function sourceEvidenceNode(source:SourceContent,score=.65):MemoryEvidenceNode {
  return { key:`source:${createSha256().update(JSON.stringify([source.tenantId,source.memorySpaceId,source.lineage.sourceId,source.lineage.sourceEventId,source.lineage.sourceRevision])).digestHex()}`,
    lineage:source.lineage,item:{type:"memory",id:source.lineage.sourceId,content:source.content,score,source:"graph-expanded"} };
}
export async function traverseConvexMemory(ctx:QueryCtx, repository:ConvexMemoryRepository, seeds:MemoryEvidenceNode[], policy:EffectiveMemoryEffortPolicy,
  bindings:MemoryDeliveryBindings, eligible?:(node:MemoryEvidenceNode)=>Promise<boolean>, inspectFact?:(fact:DerivedFact)=>void, literalQuery?:string, retrievalStartedAt?:number,
  workClock=createMemoryRetrievalWorkClock()) {
  // Transaction Date.now is the authority/expiry clock and remains untouched.
  // Only elapsed work uses performance: it advances in mutations but is fixed
  // in queries, where candidate/work limits still bound an in-flight read.
  // Translate this invocation's local origin once; never compare performance
  // origins across RPCs or restart the Action's inherited retrieval budget.
  if(retrievalStartedAt!==undefined&&(!Number.isFinite(retrievalStartedAt)||retrievalStartedAt<0))memoryError("INVALID_INPUT","Invalid retrieval work start");
  const now=policy.evidenceRankingVersion===1?workClock.now:()=>Date.now();
  const startedAt=policy.evidenceRankingVersion===1?Math.min(workClock.startedAt,retrievalStartedAt??workClock.startedAt):undefined;
  const expired=()=>startedAt!==undefined&&now()-startedAt>=policy.retrievalDeadlineMs;
  const authority=await repository.authority(undefined,"read"), scope=repository.scope;
  async function optionalMemorySource(sourceId:string){
    try{return await repository.getSource(sourceId,"canViewMemories");}
    catch(error){if(!isMemoryResourceDenied(error))throw error;await repository.recheckAuthority();return null;}
  }
  let candidateBytes=0,candidateBound=false;
  const candidateBindings=new Map<string,MemoryDeliveryBindings>(),candidateNodes=new Map<string,MemoryEvidenceNode>();
  async function bind(node:MemoryEvidenceNode):Promise<boolean> {
    if(expired())return false;
    if(!candidateNodes.has(node.key)){
      const bytes=new TextEncoder().encode(JSON.stringify(node)).length;
      if(candidateBytes+bytes>policy.maxCandidateBytes){candidateBound=true;return false;}candidateBytes+=bytes;
    }
    if(eligible&&!await eligible(node))return false;
    if(expired())return false;
    const source=node.item.type==="fact"?await repository.getSource(node.lineage.sourceId,"canViewFacts"):await optionalMemorySource(node.lineage.sourceId);if(!source)return false;
    const selectedBindings:MemoryDeliveryBindings={sources:[],facts:[],vectors:[]};
    if(canonicalMemoryValue(source.lineage)!==canonicalMemoryValue(node.lineage))memoryError("STALE_SOURCE","Traversal seed source changed");
    if(expired())return false;
    if(node.item.type==="fact") {const fact=await repository.getFact(node.item.id);if(!fact)return false;
      if(canonicalMemoryValue(fact)!==canonicalMemoryValue(node.item.fact))memoryError("STALE_SOURCE","Traversal seed fact changed");
      if(expired())return false;
      if(policy.evidenceRankingVersion===1&&literalQuery!==undefined&&literalPropertyEvidence(literalQuery,fact,Date.now()))node.literalPropertyPriority=true;
      inspectFact?.(fact);await captureRecallFact(selectedBindings,fact,source);}
    else captureRecallSource(selectedBindings,source,"canViewMemories");
    candidateBindings.set(node.key,selectedBindings);if(!candidateNodes.has(node.key))candidateNodes.set(node.key,node);
    return true;
  }
  const accepted:MemoryEvidenceNode[]=[];for(const node of seeds.slice(0,Math.max(1,Math.floor(policy.maxWork/4)))){if(expired())break;if(await bind(node))accepted.push(node);}
  const result=await traverseMemoryEvidence({seeds:accepted,policy,now,...(policy.evidenceRankingVersion===1?{retainValidatedSeedPrefixOnDeadline:true as const}:{}),...(startedAt===undefined?{}:{startedAt}),expand:async(node,cursor,limit):Promise<MemoryEvidencePage>=>{
    await repository.recheckAuthority();
    const edges:MemoryEvidencePage["edges"]=[];const unavailableStages:string[]=[];
    if(expired())return {edges,cursor:null,work:1};
    // One phase per page; entity membership key and cursor are private traversal state.
    const state=cursor?JSON.parse(cursor) as {phase:number;key:number;cursor:string|null}:{phase:0,key:0,cursor:null};
    const fact=node.item.type==="fact"?await repository.getFact(node.item.id):null;
    if(node.item.type==="fact"&&!fact)return {edges,cursor:null,work:1};
    if(expired())return {edges,cursor:null,work:1};
    if(state.phase===0&&fact){
      const source=await optionalMemorySource(fact.lineage.sourceId);
      if(source){const next=sourceEvidenceNode(source,node.item.score*.98);if(await bind(next))edges.push({node:next,relationship:"supporting-source"});}
      return {edges,cursor:JSON.stringify({phase:1,key:0,cursor:null}),work:1};
    }
    if(node.item.type==="memory") {
      const source=await optionalMemorySource(node.lineage.sourceId);if(!source)return {edges,cursor:null,work:1};
      if(expired())return {edges,cursor:null,work:1};
      const rows=await ctx.db.query("facts").withIndex("by_runtime_source_fact",q=>{const range=q.eq("tenantId",scope.tenantId).eq("memorySpaceId",scope.memorySpaceId)
        .eq("lineage.sourceId",source.lineage.sourceId).eq("lineage.sourceRevision",source.lineage.sourceRevision);return state.cursor===null?range:range.gt("factId",state.cursor);}).take(limit);
      for(const row of rows){if(expired())break;const current=await repository.currentFact(row,authority);if(current){inspectFact?.(current);const next=factEvidenceNode(current,node.item.score*.98);if(await bind(next))edges.push({node:next,relationship:"derived-fact"});}}
      return {edges,cursor:rows.length<limit?null:JSON.stringify({phase:0,key:0,cursor:rows[rows.length-1]!.factId}),work:rows.length};
    }
    const keys=factEntityKeys(fact!);if(keys.length>64)unavailableStages.push("entity-projection-work-bound");
    if(state.key>=Math.min(keys.length,64))return {edges,cursor:null,unavailableStages,work:1};
    const entityKey=keys[state.key]!;
    const selected=authority.resourceAccess==="own"?ctx.db.query("runtimeMemoryFactEntities").withIndex("by_owner_entity",q=>{const range=q.eq("tenantId",scope.tenantId).eq("memorySpaceId",scope.memorySpaceId).eq("ownerPrincipalId",authority.principalId).eq("entityKey",entityKey);return state.cursor===null?range:range.gt("factId",state.cursor);})
      :ctx.db.query("runtimeMemoryFactEntities").withIndex("by_scope_entity",q=>{const range=q.eq("tenantId",scope.tenantId).eq("memorySpaceId",scope.memorySpaceId).eq("entityKey",entityKey);return state.cursor===null?range:range.gt("factId",state.cursor);});
    const rows=await selected.take(limit);
    if(!rows.length)unavailableStages.push("entity-projection-unavailable");
    for(const link of rows){
      if(expired())break;
      const current=await repository.getFact(link.factId);
      if(!current||current.version!==link.factVersion||current.lineage.sourceId!==link.sourceId||current.lineage.sourceEventId!==link.sourceEventId||current.lineage.sourceRevision!==link.sourceRevision
        ||!factEntityKeys(current).includes(entityKey))continue;
      // Inspect every current indexed candidate before output/queue caps prune it.
      // Only the private caller verdict survives; discarded fact text is not returned.
      inspectFact?.(current);
      const next=factEvidenceNode(current,node.item.score*.98);if(await bind(next))edges.push({node:next,relationship:"exact-entity"});
    }
    const done=rows.length<limit;const nextKey=done?state.key+1:state.key;
    return {edges,cursor:nextKey>=Math.min(keys.length,64)?null:JSON.stringify({phase:1,key:nextKey,cursor:done?null:rows[rows.length-1]!.factId}),unavailableStages,work:rows.length};
  }});
  // Persist selected evidence and its actual shortest bridges only. Frontier-only
  // rows remain private read candidates; Max never journals its whole visited set.
  const retained=new Set(result.nodes.flatMap(node=>node.path??[node.key]));
  const vectorIds=new Set([...retained].flatMap(key=>{const id=candidateNodes.get(key)?.item.memory?._id;return id?[id]:[];}));
  bindings.version=2;
  bindings.vectors=bindings.vectors.filter(value=>vectorIds.has(value.vectorId));bindings.sources=[];bindings.facts=[];
  for(const key of retained)for(const field of ["sources","facts"] as const){
    const incoming=candidateBindings.get(key)?.[field]??[];
    if(field==="sources")for(const value of incoming as MemoryDeliveryBindings["sources"])if(!bindings.sources.some(old=>old.sourceId===value.sourceId&&old.permission===value.permission))bindings.sources.push(value);
    if(field==="facts")for(const value of incoming as MemoryDeliveryBindings["facts"])if(!bindings.facts.some(old=>old.factId===value.factId))bindings.facts.push(value);
  }
  if((candidateBound||seeds.length>Math.max(1,Math.floor(policy.maxWork/4)))&&!result.trace.stopReasons.includes("work"))result.trace.stopReasons.push("work");
  return {retrievalDeadlineMs:policy.retrievalDeadlineMs,...(policy.evidenceRankingVersion===1?{retainValidatedOnDeadline:true as const}:{}),itemLineages:result.nodes.map(node=>[`${node.item.type}:${node.item.id}`,node.lineage] as [string,typeof node.lineage]),items:result.nodes.map(node=>({...node.item,retrieval:{depth:node.depth!,path:node.path!}})),memoryEffort:result.trace};
}
