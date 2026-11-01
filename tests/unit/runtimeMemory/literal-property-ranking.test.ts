import {expect,it} from '@jest/globals';
import type {DerivedFact} from '../../../src/domain/contracts';
import {literalPropertyEvidence,sufficientDirectFactLookup} from '../../../src/domain/memory-direct-recall';
import {resolveMemoryEffortPolicy} from '../../../src/domain/memory-effort';
import {traverseMemoryEvidence} from '../../../src/domain/memory-traversal';
const fact=(value='apricot'):DerivedFact=>({_id:'',factId:value,tenantId:'t',memorySpaceId:'s',ownerPrincipalId:'owner',lineage:{sourceId:value,sourceEventId:value,sourceRevision:1,role:'user',trust:'user_assertion'},extractionPolicyVersion:'v1',fact:`User's favorite fruit is ${value}.`,factType:'preference',subject:'User',predicate:'is_favorite_fruit',object:value,confidence:100,tags:[],version:1,sourceType:'conversation',createdAt:1,updatedAt:1});
it('prioritizes every explicit matching value and current correction without making ambiguous discovery sufficient',()=>{
 const first=fact(),second={...fact('plum'),version:2,supersedes:'old',updatedAt:2};
 expect(literalPropertyEvidence('What is my favorite fruit?',first,3)).toBe(true);expect(literalPropertyEvidence('What is my favorite fruit?',second,3)).toBe(true);
 expect(sufficientDirectFactLookup('What is my favorite fruit?',{facts:[first,second],candidateWorkBound:false},3)).toBe(false);
 expect(sufficientDirectFactLookup('What is my favorite fruit?',{facts:[second],candidateWorkBound:false},3)).toBe(false);
});
it.each(['What fruit do I like?','What is my favorite food?','What is my favorite fruit and color?','Tell me everything about fruit'])('does not infer property priority for %s',query=>expect(literalPropertyEvidence(query,fact(),3)).toBe(false));
it.each([
 {fact:'User has a favorite fruit.',predicate:'has',object:'favorite fruit'},
 {fact:'User prefers apricot.',predicate:'prefers',object:'apricot'},
 {fact:'User favorite fruit is not apricot.',object:'apricot'},
 {fact:'User favorite fruit is plum.',object:'apricot'},
 {validUntil:2},{validFrom:4},{supersededBy:'new'},
])('unknown/negative/value-mismatched/noncurrent evidence gets no priority: %j',patch=>expect(literalPropertyEvidence('What is my favorite fruit?',{...fact(),...patch},3)).toBe(false));
it('new ranking is explicit and old omitted-pin traversal keeps the exact score comparator including cosine above1',async()=>{
 const policy=resolveMemoryEffortPolicy({effort:'fast'}),old={...policy};delete old.evidenceRankingVersion;expect(policy.evidenceRankingVersion).toBe(1);
 const literal=fact(),node={key:'fact:a',item:{type:'fact' as const,id:'a',content:literal.fact,score:.7,source:'facts' as const,fact:literal},lineage:literal.lineage,literalPropertyPriority:true as const};
 const seeds=[...Array.from({length:4},(_,i)=>({key:`source:q${i}`,item:{type:'memory' as const,id:`q${i}`,content:'What is my favorite fruit?',score:1.000000238418579,source:'vector' as const},lineage:literal.lineage})),node];
 const run=(p:typeof policy)=>traverseMemoryEvidence({seeds,policy:p,now:()=>0,expand:async()=>({edges:[],cursor:null})});
 expect((await run(policy)).nodes.map(node=>node.key)).toContain('fact:a');expect((await run(old)).nodes.map(node=>node.key)).not.toContain('fact:a');
 const capped=await run({...policy,maxEntries:1});expect(capped.nodes.map(node=>node.key)).toEqual(['fact:a']);expect(capped.trace.stopReasons).toContain('entries');
 const tiny=await run({...policy,maxContextTokens:1});expect(tiny.nodes).toEqual([]);expect(tiny.trace.stopReasons).toContain('input');
});
it('entry-bound selection retains a discovered depth2 literal conflict without reordering breadth-first discovery',async()=>{
 const apricot=fact(),plum=fact('plum'),node=(value:DerivedFact)=>({key:`fact:${value.factId}`,item:{type:'fact' as const,id:value.factId,content:value.fact,score:.7,source:'facts' as const,fact:value},lineage:value.lineage,literalPropertyPriority:true as const});
 const questions=Array.from({length:4},(_,i)=>({key:`source:q${i}`,item:{type:'memory' as const,id:`q${i}`,content:'What is my favorite fruit?',score:1.000000238418579,source:'vector' as const},lineage:apricot.lineage}));
 const expansions:string[]=[];
 const result=await traverseMemoryEvidence({seeds:[node(apricot),...questions],policy:resolveMemoryEffortPolicy({effort:'fast'}),now:()=>0,expand:async current=>{expansions.push(current.key);return {edges:current.key==='fact:apricot'?[{node:node(plum),relationship:'exact-entity' as const}]:[],cursor:null};}});
 expect(result.nodes.map(value=>value.key)).toEqual(['fact:apricot','fact:plum','source:q0','source:q1']);expect(result.nodes.find(value=>value.key==='fact:plum')).toMatchObject({depth:2,path:['fact:apricot','fact:plum']});expect(result.trace.selected).toBe(4);expect(result.trace.stopReasons).toContain('entries');
 expect(expansions).toEqual(['fact:apricot','source:q0','source:q1','source:q2']);
});
it('priority selection preserves shortest paths and cycles when a later same-depth frontier offers a shorter route',async()=>{
 const lineage=fact().lineage,node=(key:string,priority=false)=>({key,item:{type:'memory' as const,id:key,content:key,score:.8,source:'vector' as const},lineage,...(priority?{literalPropertyPriority:true as const}:{})});
 const a=node('a',true),q=node('q'),b=node('b',true),target=node('target',true);
 const result=await traverseMemoryEvidence({seeds:[a,q],policy:{...resolveMemoryEffortPolicy({effort:'high'}),maxEntries:4},now:()=>0,expand:async current=>({edges:(current.key==='a'?[b]:current.key==='q'?[target]:current.key==='b'?[target,a]:[]).map(next=>({node:next,relationship:'exact-entity' as const})),cursor:null})});
 expect(result.nodes.find(value=>value.key==='target')).toMatchObject({depth:2,path:['q','target']});expect(result.trace.deduplicated).toBe(2);expect(new Set(result.nodes.map(value=>value.key)).size).toBe(result.nodes.length);
});
function contextSheddingFixture(){
 const apricot=fact(),apricotNode={key:'fact:apricot',item:{type:'fact' as const,id:'apricot',content:apricot.fact,score:.7,source:'facts' as const,fact:apricot},lineage:apricot.lineage,literalPropertyPriority:true as const};
 const units=(node:{key:string;item:{content:string}},depth:number,path:string[])=>new TextEncoder().encode(JSON.stringify({content:node.item.content,key:node.key,depth,path})).length;
 const shortPlum=fact('plum'),shortNode={key:'fact:plum',item:{content:shortPlum.fact}},padding=490-units(apricotNode,1,['fact:apricot'])-units(shortNode,2,['fact:apricot','fact:plum']);
 expect(padding).toBeGreaterThan(0);const plum={...fact('plum'+'x'.repeat(padding)),factId:'plum'};
 expect(literalPropertyEvidence('What is my favorite fruit?',plum,3)).toBe(true);
 const plumNode={key:'fact:plum',item:{type:'fact' as const,id:'plum',content:plum.fact,score:.686,source:'facts' as const,fact:plum},lineage:plum.lineage,literalPropertyPriority:true as const};
 expect(units(apricotNode,1,['fact:apricot'])+units(plumNode,2,['fact:apricot','fact:plum'])).toBe(490);
 const question=(i:number)=>({key:`source:q${i}`,item:{type:'memory' as const,id:`q${i}`,content:'What is my favorite fruit?',score:1.000000238418579,source:'vector' as const},lineage:apricot.lineage});
 return {apricotNode,plumNode,question,seeds:[apricotNode,question(0),question(1)],policy:{...resolveMemoryEffortPolicy({effort:'fast'}),maxContextTokens:500}};
}
it('LP-2 replaces question entries after input shedding and queue exhaustion when both literal facts fit490of500',async()=>{
 const f=contextSheddingFixture(),expanded:string[]=[];
 const result=await traverseMemoryEvidence({seeds:f.seeds,policy:f.policy,now:()=>0,expand:async node=>{expanded.push(node.key);return {edges:node.key==='fact:apricot'?[{node:f.plumNode,relationship:'exact-entity' as const},{node:f.question(2),relationship:'supporting-source' as const}]:[],cursor:null};}});
 expect(result.nodes.map(node=>node.key)).toEqual(['fact:apricot','fact:plum']);expect(result.trace.selectedInputUnits).toBe(490);expect(result.trace.visited).toBe(5);expect(result.trace.stopReasons).toContain('input');expect(result.trace.stopReasons).not.toContain('entries');
 expect(expanded).toEqual(['fact:apricot','source:q0','source:q1']);
});
it.each(['cancellation','deadline','work'] as const)('LP-2 final selection honors %s without new discovery or a restarted budget',async boundary=>{
 const f=contextSheddingFixture(),expanded:string[]=[];let cancelled=false,now=0;
 const policy={...f.policy,...(boundary==='work'?{maxWork:7}:{})};
 const result=await traverseMemoryEvidence({seeds:f.seeds,policy,now:()=>now,cancelled:()=>cancelled,expand:async node=>{
  expanded.push(node.key);if(node.key==='source:q1'){if(boundary==='cancellation')cancelled=true;if(boundary==='deadline')now=policy.retrievalDeadlineMs;}
  return {edges:node.key==='fact:apricot'?[{node:f.plumNode,relationship:'exact-entity' as const},{node:f.question(2),relationship:'supporting-source' as const}]:[],cursor:null};
 }});
 expect(result.trace.stopReasons).toContain(boundary);expect(result.trace.selectedInputUnits).toBeLessThanOrEqual(500);expect(result.nodes.length).toBeLessThanOrEqual(4);expect(expanded).toEqual(['fact:apricot','source:q0','source:q1']);
 expect(result.nodes.some(node=>node.key==='fact:plum')).toBe(boundary==='work');if(boundary==='deadline')expect(result.trace.durationMs).toBe(policy.retrievalDeadlineMs);
});
it.each([{maxEntries:1,maxContextTokens:500},{maxEntries:4,maxContextTokens:489}])('LP-2 preserves an entry or context ceiling that cannot fit both facts: %j',async bound=>{
 const f=contextSheddingFixture(),result=await traverseMemoryEvidence({seeds:f.seeds,policy:{...f.policy,...bound},now:()=>0,expand:async node=>({edges:node.key==='fact:apricot'?[{node:f.plumNode,relationship:'exact-entity' as const},{node:f.question(2),relationship:'supporting-source' as const}]:[],cursor:null})});
 expect(result.nodes.length).toBeLessThanOrEqual(bound.maxEntries);expect(result.trace.selectedInputUnits).toBeLessThanOrEqual(bound.maxContextTokens);expect(result.nodes.some(node=>node.key==='fact:plum')).toBe(false);
});
