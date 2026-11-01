import {afterEach,expect,it,jest} from '@jest/globals';
import {ConvexError} from 'convex/values';
import {getFunctionName} from 'convex/server';
import type {ActionCtx} from '../../../convex-dev/_generated/server';
import type {DerivedFact} from '../../../src/domain/contracts';
import {DEFAULT_EMBEDDING_PROFILE as profile} from '../../../src/domain/profile';
import {resolveMemoryEffortPolicy} from '../../../src/domain/memory-effort';
import {traverseMemoryEvidence} from '../../../src/domain/memory-traversal';
import {prepareSourceContent} from '../../../src/domain/sources';
import {ConvexMemoryRepository,memoryScope} from '../../../convex-dev/runtimeMemoryRepository';
import type {MemoryDeliveryBindings} from '../../../convex-dev/runtimeMemoryRepository';
import {createMemoryRetrievalWorkClock,factEvidenceNode,traverseConvexMemory} from '../../../convex-dev/runtimeMemoryTraversal';
import {completeRecallDelivery} from '../../../convex-dev/runtimeMemoryServices';
import {finishAgentRecallV8,withPrivateInlineAgentSelection} from '../../../convex-dev/runtimeAgentRecall';
import type {readMatchesHandler} from '../../../convex-dev/runtimeAgentRecall';
import {finishPublicRecall} from '../../../convex-dev/runtimeMemoryQuery';
import {memoryFixture} from '../../unit/runtimeMemory/fixture';

afterEach(()=>{jest.restoreAllMocks();});
const bindings=():MemoryDeliveryBindings=>({sources:[],facts:[],vectors:[]});
const policy=()=>resolveMemoryEffortPolicy({effort:'fast'});
async function fixture(validUntil?:number){
 jest.spyOn(Date,'now').mockReturnValue(1000);
 const f=memoryFixture(),scope=memoryScope(f.reference),repository=new ConvexMemoryRepository(f.ctx,f.reference,'read',undefined,{now:()=>1000});
 const lineage={sourceId:'apricot-source',sourceEventId:'apricot-event',sourceRevision:1,role:'user' as const,trust:'user_assertion' as const};
 const source=await prepareSourceContent(scope,lineage,"My favorite fruit is apricot.",{now:()=>1000});f.db.seed('runtimeMemorySources',{...source.source});
 const fact:DerivedFact={_id:'',tenantId:scope.tenantId,memorySpaceId:scope.memorySpaceId,ownerPrincipalId:scope.principalId,lineage,
  extractionPolicyVersion:'v1',factId:'apricot',fact:"User's favorite fruit is apricot.",factType:'preference',subject:'User',predicate:'is_favorite_fruit',object:'apricot',
  confidence:100,tags:[],sourceType:'conversation',version:1,createdAt:1000,updatedAt:1000,...(validUntil===undefined?{}:{validUntil})};
 fact._id=f.db.seed('facts',{...fact})._id;return {...f,repository,fact};
}
async function selected(f:Awaited<ReturnType<typeof fixture>>){
 const captured=bindings(),result=await traverseConvexMemory(f.ctx,f.repository,[factEvidenceNode(f.fact)],policy(),captured,undefined,undefined,'What is my favorite fruit?',1000,{startedAt:1000,now:()=>1000});
 result.memoryEffort.retrievalRoute='semantic-v1';return {captured,result};
}
it('Fast semantic evidence survives a 785ms Action return, with the actual independent delivery check and honest deadline',async()=>{
 const f=await fixture(),{captured,result}=await selected(f),before=structuredClone(result.items),units=result.memoryEffort.selectedInputUnits;
 const delivery=jest.fn(async()=>await f.repository.checkDelivery(captured));
 const actual=await completeRecallDelivery({clock:{now:()=>1785},finalDelivery:delivery},{limit:4},profile.profileId,[],[],result,1000);
 expect(actual.items).toEqual(before);expect(actual.items.some(item=>item.content.includes('apricot'))).toBe(true);
 expect(actual.memoryEffort).toMatchObject({retrievalRoute:'semantic-v1',durationMs:785,selected:before.length,selectedInputUnits:units});
 expect(actual.memoryEffort!.stopReasons).toContain('deadline');expect(actual.memoryEffort!.entriesByKind.fact).toBe(1);expect(delivery).toHaveBeenCalledTimes(1);
});
it.each(['grant','fact'] as const)('a late %s expiry still refuses on the Action clock after the actual final native check',async kind=>{
 const f=await fixture(kind==='fact'?1750:undefined);if(kind==='grant')f.grant.expiresAt=1750;
 const {captured,result}=await selected(f),delivery=jest.fn(async()=>await f.repository.checkDelivery(captured));
 await expect(completeRecallDelivery({clock:{now:()=>1785},finalDelivery:delivery},{limit:4},profile.profileId,[],[],result,1000)).rejects.toMatchObject({data:{code:'FORBIDDEN'}});
 expect(delivery).toHaveBeenCalledTimes(1);
});
it.each(['tombstone','revocation'] as const)('elapsed retrieval never swallows a current %s refusal',async kind=>{
 const f=await fixture(),{captured,result}=await selected(f);
 if(kind==='tombstone')f.db.table('runtimeMemorySources')[0]!.tombstonedAt=1000;else f.grant.revokedAt=1000;
 await expect(completeRecallDelivery({clock:{now:()=>1785},finalDelivery:async()=>await f.repository.checkDelivery(captured)},
  {limit:4},profile.profileId,[],[],result,1000)).rejects.toBeInstanceOf(ConvexError);
});
it('omitting the historical private ranking pin keeps the original late-result interpretation',async()=>{
 const f=await fixture(),legacy=policy();delete legacy.evidenceRankingVersion;
 const captured=bindings(),result=await traverseConvexMemory(f.ctx,f.repository,[factEvidenceNode(f.fact)],legacy,captured,undefined,undefined,undefined,0);
 expect(result.items.length).toBeGreaterThan(0);expect(result).not.toHaveProperty('retainValidatedOnDeadline');
 const actual=await completeRecallDelivery({clock:{now:()=>1785},finalDelivery:async()=>await f.repository.checkDelivery(captured)},
  {limit:4},profile.profileId,[],[],result,1000);
 expect(actual.items).toEqual([]);expect(actual.memoryEffort).toMatchObject({selected:0,durationMs:785});
 expect(actual.memoryEffort!.stopReasons).toContain('deadline');
});
it('elapsed work uses each invocation origin, counts pre-read time, and leaves the expiry Date clock fixed',async()=>{
 let elapsed=900_000;const date=jest.spyOn(Date,'now').mockReturnValue(1495);jest.spyOn(performance,'now').mockImplementation(()=>elapsed);
 const first=createMemoryRetrievalWorkClock();elapsed+=200;expect(first.now()).toBe(1695);expect(Date.now()).toBe(1495);
 date.mockReturnValue(1700);elapsed=37;const second=createMemoryRetrievalWorkClock();elapsed+=50;
 expect(second.now()).toBe(1750);expect(second.startedAt).toBe(1700);expect(Date.now()).toBe(1700);
});
it('a fixed query performance clock keeps bounded work, while a spent inherited budget starts no traversal reads',async()=>{
 const f=await fixture(),captured=bindings();jest.spyOn(performance,'now').mockReturnValue(0);jest.spyOn(Date,'now').mockReturnValue(1800);
 const expand=jest.spyOn(f.repository,'getFact');
 const result=await traverseConvexMemory(f.ctx,f.repository,[factEvidenceNode(f.fact)],policy(),captured,undefined,undefined,undefined,1000);
 expect(result.items).toEqual([]);expect(result.memoryEffort).toMatchObject({durationMs:800,visited:0,expanded:0});
 expect(result.memoryEffort.stopReasons).toContain('deadline');expect(expand).not.toHaveBeenCalled();expect(captured).toEqual({version:2,sources:[],facts:[],vectors:[]});
});
it('a future private start cannot borrow a new budget after native pre-read time',async()=>{
 const f=await fixture(),read=jest.spyOn(f.repository,'getFact'),result=await traverseConvexMemory(f.ctx,f.repository,[factEvidenceNode(f.fact)],policy(),bindings(),
  undefined,undefined,undefined,999_999,{startedAt:1000,now:()=>1750});
 expect(result.items).toEqual([]);expect(result.memoryEffort.durationMs).toBe(750);expect(result.memoryEffort.stopReasons).toContain('deadline');expect(read).not.toHaveBeenCalled();
});
it.each([NaN,Infinity,-1])('invalid private start %s fails closed before source/fact traversal',async start=>{
 const f=await fixture(),read=jest.spyOn(f.repository,'getFact'),source=jest.spyOn(f.repository,'getSource');
 await expect(traverseConvexMemory(f.ctx,f.repository,[factEvidenceNode(f.fact)],policy(),bindings(),undefined,undefined,undefined,start))
  .rejects.toMatchObject({data:{code:'INVALID_INPUT'}});
 expect(read).not.toHaveBeenCalled();expect(source).not.toHaveBeenCalled();
});
it.each([NaN,Infinity,9])('invalid advancing work clock %s refuses rather than silently dropping the deadline',value=>{
 jest.spyOn(Date,'now').mockReturnValue(1000);const elapsed=jest.spyOn(performance,'now').mockReturnValue(10),clock=createMemoryRetrievalWorkClock();
 elapsed.mockReturnValue(value);expect(()=>clock.now()).toThrow('INVALID_STATE');expect(Date.now()).toBe(1000);
});
it('pre-read elapsed and an in-flight page share one original deadline; selected entries survive and no next page starts',async()=>{
 const f=await fixture(),apricot=factEvidenceNode(f.fact);let now=1495;const calls:string[]=[];
 const result=await traverseMemoryEvidence({seeds:[apricot],policy:policy(),startedAt:1000,now:()=>now,expand:async node=>{
  calls.push(node.key);now=1750;return {edges:[{node:{...apricot,key:'late-page'},relationship:'exact-entity'}],cursor:'next-page'};
 }});
 expect(calls).toEqual(['fact:apricot']);expect(result.nodes.map(node=>node.key)).toEqual(['fact:apricot']);
 expect(result.trace).toMatchObject({selected:1,expanded:1,visited:1,durationMs:750});expect(result.trace.stopReasons).toContain('deadline');
});
it('native mutation work includes time before traversal and starts no source/adjacency read after an in-flight fact exhausts the budget',async()=>{
 const f=await fixture();let elapsed=10_000;jest.spyOn(performance,'now').mockImplementation(()=>elapsed);
 const clock=createMemoryRetrievalWorkClock();elapsed+=700;
 const original=f.repository.getFact.bind(f.repository);let facts=0;
 jest.spyOn(f.repository,'getFact').mockImplementation(async id=>{const value=await original(id);if(++facts===2)elapsed+=50;return value;});
 const source=jest.spyOn(f.repository,'getSource'),captured=bindings();
 const result=await traverseConvexMemory(f.ctx,f.repository,[factEvidenceNode(f.fact)],policy(),captured,undefined,undefined,undefined,1000,clock);
 expect(result.items.map(item=>item.id)).toEqual(['apricot']);expect(result.memoryEffort).toMatchObject({selected:1,expanded:1,durationMs:750});
 expect(result.memoryEffort.stopReasons).toContain('deadline');expect(facts).toBe(2);expect(source).toHaveBeenCalledTimes(1);
 expect(f.db.reads.filter(read=>read.table==='runtimeMemoryFactEntities')).toEqual([]);
 expect(Date.now()).toBe(1000);await expect(f.repository.checkDelivery(captured)).resolves.toMatchObject({version:1});
});
it('cancellation starts no additional expansion and preserves the original entry, units and relevance ceilings',async()=>{
 const f=await fixture(),good=factEvidenceNode(f.fact),bad={...good,key:'irrelevant',item:{...good.item,score:0}};
 let cancelled=false,calls=0;const run=async(maxContextTokens:number)=>await traverseMemoryEvidence({seeds:[bad,good,{...good,key:'second'}],
  policy:resolveMemoryEffortPolicy({effort:'fast',maxEntries:1,maxContextTokens}),now:()=>1000,cancelled:()=>cancelled,
  expand:async()=>{calls++;cancelled=true;return {edges:[],cursor:'later'};}});
 const result=await run(32768);expect(result.nodes.map(node=>node.key)).toEqual(['fact:apricot']);expect(result.trace.selectedInputUnits).toBeLessThanOrEqual(32768);
 expect(result.trace.stopReasons).toContain('cancellation');expect(result.trace.stopReasons).toContain('relevance');expect(calls).toBe(1);
 cancelled=false;calls=0;const tiny=await run(1);expect(tiny.nodes).toEqual([]);expect(tiny.trace.stopReasons).toContain('input');expect(calls).toBe(0);
});
it('Agent semantic RPCs preserve the exact Action start across prepare/ANN/native read and a late combined delivery',async()=>{
 const f=await fixture(),{captured,result}=await selected(f);let now=1000;const calls:{name:string;startedAt?:number}[]=[];
 const read:Awaited<ReturnType<typeof readMatchesHandler>>={effortResult:result,vectorItems:[],facts:[f.fact],bindings:captured,witnesses:[],provenance:[],itemLineages:[],sourceScores:[]};
 const ctx={runQuery:async(ref:Parameters<typeof getFunctionName>[0],args:{retrievalStartedAt?:number})=>{calls.push({name:getFunctionName(ref),startedAt:args.retrievalStartedAt});now=1495;return {resourceAccess:'own',factPlan:{kind:'ready',facts:[f.fact],bindings:captured}};},
  vectorSearch:async()=>[],runMutation:async(ref:Parameters<typeof getFunctionName>[0],args:{retrievalStartedAt?:number})=>{
   calls.push({name:getFunctionName(ref),startedAt:args.retrievalStartedAt});now=1785;return {read,delivery:await f.repository.checkDelivery(captured)};
  }} as unknown as ActionCtx;
 const actual=await finishAgentRecallV8(ctx,{reference:f.reference,runId:'run',attemptNumber:1,leaseVersion:1},{now:()=>now},
  {text:'What is my favorite fruit?',requestId:'same-intent',limit:4,memory:{effort:'fast'}},profile,{profile,vectors:[Array.from({length:1536},(_,i)=>i===0?1:0)]},
  withPrivateInlineAgentSelection({cutoff:1,boundary:{conversationId:'c',runId:'run',queueSequence:1,anchor:{order:1,stepOrder:0}},excludedSourceKeys:[],onSelected:()=>{}}));
 expect(calls).toEqual([{name:'runtimeAgentRecall:prepareReadsV8',startedAt:1000},{name:'runtimeAgentRecall:readMatchesAndDeliveryV8',startedAt:1000}]);
 expect(actual.items.some(item=>item.content.includes('apricot'))).toBe(true);expect(actual.memoryEffort).toMatchObject({durationMs:785,retrievalRoute:'semantic-v1'});
});
it('public semantic read carries its original start through native work and retains the independent final delivery RPC',async()=>{
 const f=await fixture(),{captured,result}=await selected(f);let now=1000;const calls:{name:string;startedAt?:number}[]=[];
 const ctx={runQuery:async(ref:Parameters<typeof getFunctionName>[0],args:{retrievalStartedAt?:number})=>{
  const name=getFunctionName(ref);calls.push({name,startedAt:args.retrievalStartedAt});now=name.endsWith('prepareReads')?1495:1749;
  return name.endsWith('prepareReads')?{resourceAccess:'own'}:{effortResult:result,vectorItems:[],facts:[f.fact],bindings:captured};},
  vectorSearch:async()=>[],runMutation:async(ref:Parameters<typeof getFunctionName>[0])=>{calls.push({name:getFunctionName(ref)});now=1785;return await f.repository.checkDelivery(captured);}
 } as unknown as ActionCtx;
 const actual=await finishPublicRecall(ctx,{reference:f.reference,runBudgetId:'budget',profile,input:{text:'What is my favorite fruit?',requestId:'public-intent',limit:4,memory:{effort:'fast'}}},
  {profile,vectors:[Array.from({length:1536},(_,i)=>i===0?1:0)]},{now:()=>now});
 expect(calls).toEqual([{name:'runtimeMemoryQuery:prepareReads',startedAt:undefined},{name:'runtimeMemoryQuery:readMatches',startedAt:1000},{name:'runtimeMemoryQuery:finalRecallDelivery'}]);
 expect(actual.items.some(item=>item.content.includes('apricot'))).toBe(true);expect(actual.memoryEffort).toMatchObject({durationMs:785,retrievalRoute:'semantic-v1'});
});
