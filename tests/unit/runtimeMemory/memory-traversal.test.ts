import {ConvexError} from "convex/values";
import {describe,it,expect,jest} from "@jest/globals";
import type {DerivedFact} from "../../../src/domain/contracts";
import {resolveMemoryEffortPolicy,emptyMemoryEffortTrace} from "../../../src/domain/memory-effort";
import {traverseMemoryEvidence} from "../../../src/domain/memory-traversal";
import {directFactTraversalComplete} from "../../../src/domain/memory-direct-recall";
import {prepareSourceContent} from "../../../src/domain/sources";
import type {MemoryDeliveryBindings} from "../../../convex-dev/runtimeMemoryRepository";
import {ConvexMemoryRepository,memoryScope} from "../../../convex-dev/runtimeMemoryRepository";
import {factEvidenceNode,replaceFactEntityLinks,traverseConvexMemory} from "../../../convex-dev/runtimeMemoryTraversal";
import {completeRecallDelivery} from "../../../convex-dev/runtimeMemoryServices";
import {memoryFixture} from "./fixture";
async function chain(count=12){const f=memoryFixture(),scope=memoryScope(f.reference),repository=new ConvexMemoryRepository(f.ctx,f.reference,"read",undefined,{now:()=>1000}),facts:DerivedFact[]=[];
 for(let i=1;i<=count;i++){const lineage={sourceId:`s${i}`,sourceEventId:`e${i}`,sourceRevision:1,role:"user" as const,trust:"user_assertion" as const};const prepared=await prepareSourceContent(scope,lineage,`evidence-${i}`,{now:()=>1000});f.db.seed("runtimeMemorySources",{...prepared.source});const fact:DerivedFact={_id:"",tenantId:scope.tenantId,memorySpaceId:scope.memorySpaceId,ownerPrincipalId:scope.principalId,lineage,extractionPolicyVersion:"v1",factId:`f${i}`,fact:i===1?"unique-seed":"linked-evidence",factType:"relationship",subject:`entity-${i-1}`,object:`entity-${i}`,confidence:90,tags:[],sourceType:"manual",version:1,createdAt:1000,updatedAt:1000};const stored=f.db.seed("facts",{...fact});fact._id=stored._id;facts.push(fact);await replaceFactEntityLinks(f.ctx.db,fact);}
 return {...f,scope,repository,facts};}
const empty=():MemoryDeliveryBindings=>({sources:[],facts:[],vectors:[]});
describe("actual scoped indexed logical traversal",()=>{
 it.each([["fast",2],["normal",4],["high",8]] as const)("%s cumulatively reaches %i but not its next fact",async(effort,depth)=>{const f=await chain();f.db.reads.length=0;const before=JSON.stringify(f.db.table("runtimeMemorySources")),result=await traverseConvexMemory(f.ctx,f.repository,[factEvidenceNode(f.facts[0]!)],resolveMemoryEffortPolicy({effort}),empty());const ids=result.items.filter(item=>item.type==="fact").map(item=>item.id);expect(ids).toEqual(Array.from({length:depth},(_,i)=>`f${i+1}`));expect(result.memoryEffort.reachedDepth).toBe(depth);expect(result.memoryEffort.stopReasons).toContain("depth");expect(ids).not.toContain(`f${depth+1}`);expect(JSON.stringify(f.db.table("runtimeMemorySources"))).toBe(before);expect(f.db.reads.filter(read=>read.table==="runtimeMemoryFactEntities").every(read=>["by_owner_entity","by_scope_entity"].includes(read.index!)&&read.limit<=16)).toBe(true);});
 it("private fact inspection sees current indexed candidates omitted by cap1 without retaining their private payload",async()=>{
  const f=await chain(3),bindings=empty(),inspected:string[]=[];
  const result=await traverseConvexMemory(f.ctx,f.repository,[factEvidenceNode(f.facts[0]!)],resolveMemoryEffortPolicy({effort:"fast",maxEntries:1}),bindings,undefined,fact=>{inspected.push(fact.factId);});
  expect(inspected).toContain("f2");expect(result.items.map(item=>item.id)).toEqual(["f1"]);expect(result.memoryEffort.stopReasons).toContain("entries");
  expect(bindings.facts.map(fact=>fact.factId)).toEqual(["f1"]);expect(JSON.stringify(result)).not.toContain("linked-evidence");
 });
 it("Max traverses real nine-plus-hop facts without artificial entry/depth cap",async()=>{const f=await chain(),bindings=empty(),result=await traverseConvexMemory(f.ctx,f.repository,[factEvidenceNode(f.facts[0]!)],resolveMemoryEffortPolicy({effort:"max"}),bindings);expect(result.items.some(item=>item.id==="f12"&&item.retrieval.depth===12)).toBe(true);expect(result.memoryEffort.maxDepth).toBeNull();expect(result.memoryEffort.maxEntries).toBeNull();expect(result.items).toHaveLength(24);expect(result.memoryEffort.deduplicated).toBeGreaterThan(0);await expect(f.repository.checkDelivery(bindings)).resolves.toMatchObject({version:1});});
 it("direct old/deep matches remain depth1 and duplicate paths use shortest depth",async()=>{const f=await chain(),result=await traverseConvexMemory(f.ctx,f.repository,[factEvidenceNode(f.facts[0]!),factEvidenceNode(f.facts[11]!),factEvidenceNode(f.facts[0]!)],resolveMemoryEffortPolicy({effort:"high"}),empty());expect(result.items.find(item=>item.id==="f12")?.retrieval.depth).toBe(1);expect(new Set(result.items.map(item=>`${item.type}:${item.id}`)).size).toBe(result.items.length);});
 it.each(["version","tombstone","foreign"] as const)("does not follow %s adjacency candidates",async fault=>{const f=await chain();const row=f.db.table("facts").find(row=>row.factId==="f2")!;if(fault==="version")row.version=2;if(fault==="tombstone")row.tombstonedAt=1000;if(fault==="foreign")row.tenantId="other";const result=await traverseConvexMemory(f.ctx,f.repository,[factEvidenceNode(f.facts[0]!)],resolveMemoryEffortPolicy({effort:"max"}),empty());expect(result.items.some(item=>item.id==="f2"||item.id==="f3")).toBe(false);});
 it("facts-only permission skips supporting message edges and still delivers authorized linked facts",async()=>{const f=await chain(),original=f.repository.getSource.bind(f.repository),bindings=empty();
  jest.spyOn(f.repository,"getSource").mockImplementation(async(sourceId,permission,deadlines)=>{if(permission==="canViewMemories")throw new ConvexError({version:1,code:"FORBIDDEN",retryable:false,outcome:"not_dispatched"});return original(sourceId,permission,deadlines);});
  const result=await traverseConvexMemory(f.ctx,f.repository,[factEvidenceNode(f.facts[0]!)],resolveMemoryEffortPolicy({effort:"max"}),bindings);expect(result.items).toHaveLength(12);expect(result.items.every(item=>item.type==="fact")).toBe(true);expect(bindings.sources.every(source=>source.permission==="canViewFacts")).toBe(true);await expect(f.repository.checkDelivery(bindings)).resolves.toMatchObject({version:1});
 });
 it("final delivery fences an intermediate supporting bridge after traversal",async()=>{const f=await chain(),bindings=empty();await traverseConvexMemory(f.ctx,f.repository,[factEvidenceNode(f.facts[0]!)],resolveMemoryEffortPolicy({effort:"high"}),bindings);f.db.table("facts").find(row=>row.factId==="f2")!.version=2;await expect(f.repository.checkDelivery(bindings)).rejects.toMatchObject({data:{code:"STALE_SOURCE"}});});
 it("missing entity projection is partial coverage, with no invented same-conversation edge",async()=>{const f=await chain();f.db.rows.set("runtimeMemoryFactEntities",[]);const result=await traverseConvexMemory(f.ctx,f.repository,[factEvidenceNode(f.facts[0]!)],resolveMemoryEffortPolicy({effort:"max"}),empty());expect(result.items.filter(item=>item.type==="fact").map(item=>item.id)).toEqual(["f1"]);expect(result.memoryEffort.unavailableStages).toContain("entity-projection-unavailable");});
 it("bounded work, context and cancellation stop expansion independently of Max depth",async()=>{const f=await chain();const work=await traverseConvexMemory(f.ctx,f.repository,[factEvidenceNode(f.facts[0]!)],resolveMemoryEffortPolicy({effort:"max"},{version:1,maxWork:10}),empty());expect(work.memoryEffort.stopReasons).toContain("work");const small=await traverseConvexMemory(f.ctx,f.repository,[factEvidenceNode(f.facts[0]!)],resolveMemoryEffortPolicy({effort:"max",maxContextTokens:2}),empty());expect(small.items).toEqual([]);expect(small.memoryEffort.stopReasons).toContain("input");let reads=0;const result=await traverseMemoryEvidence({seeds:[factEvidenceNode(f.facts[0]!)],policy:resolveMemoryEffortPolicy({effort:"max"}),now:()=>1000,cancelled:()=>true,expand:async()=>{reads++;return {edges:[],cursor:null};}});expect(result.trace.stopReasons).toContain("cancellation");expect(reads).toBe(0);});
 it("high fan-out bounds queued payload bytes and retains selected paths rather than discarded frontier",async()=>{const f=await chain(180);
  for(const fact of f.facts){const row=f.db.table("facts").find(row=>row.factId===fact.factId)!;fact.subject="hub";fact.object="hub";fact.fact="useful "+"x".repeat(2800);Object.assign(row,{subject:fact.subject,object:fact.object,fact:fact.fact});await replaceFactEntityLinks(f.ctx.db,fact);}
  const bindings=empty(),policy=resolveMemoryEffortPolicy({effort:"max"}),result=await traverseConvexMemory(f.ctx,f.repository,[factEvidenceNode(f.facts[0]!)],policy,bindings);
  expect(result.memoryEffort.stopReasons).toContain("work");expect(result.memoryEffort.visited).toBeLessThan(180);expect(result.memoryEffort.selectedInputUnits).toBeLessThanOrEqual(32768);
  expect(bindings.facts.length).toBeLessThan(result.memoryEffort.visited);expect(new TextEncoder().encode(JSON.stringify(bindings)).length).toBeLessThan(131072);
  await expect(f.repository.checkDelivery(bindings)).resolves.toMatchObject({version:1});
 });
 it("Action work deadline retains pinned validated native results and still executes the final authority fence",async()=>{const f=await chain(),policy=resolveMemoryEffortPolicy({effort:"fast"}),trace=emptyMemoryEffortTrace(policy);trace.selected=1;trace.entriesByKind.fact=1;const items=[factEvidenceNode(f.facts[0]!).item],finalDelivery=jest.fn(async()=>({version:1 as const}));const result=await completeRecallDelivery({clock:{now:()=>2000},finalDelivery},{limit:10},"p",[],[],{items,memoryEffort:trace,retrievalDeadlineMs:policy.retrievalDeadlineMs,retainValidatedOnDeadline:true},1000);expect(result.items).toEqual(items);expect(result.memoryEffort).toMatchObject({selected:1,durationMs:1000,entriesByKind:{fact:1}});expect(result.memoryEffort?.stopReasons).toContain("deadline");expect(finalDelivery).toHaveBeenCalledTimes(1);});
 it("native seed fully bound before750ms survives pure fitting at848ms with no late reads or expansion",async()=>{
  const f=await chain(2),bindings=empty(),policy=resolveMemoryEffortPolicy({effort:"fast"});let elapsed=749;
  const source=jest.spyOn(f.repository,"getSource"),fact=jest.spyOn(f.repository,"getFact");f.db.reads.length=0;
  const result=await traverseConvexMemory(f.ctx,f.repository,f.facts.map(fact=>factEvidenceNode(fact)),policy,bindings,undefined,()=>{elapsed=848;},undefined,1000,{startedAt:1000,now:()=>1000+elapsed});
  expect(source).toHaveBeenCalledTimes(1);expect(source.mock.calls[0]![1]).toBe("canViewFacts");expect(fact).toHaveBeenCalledTimes(1);
  expect(f.db.reads.some(read=>read.table==="runtimeMemoryFactEntities")).toBe(false);
  expect(result.items.map(item=>item.id)).toEqual(["f1"]);expect(result.items[0]!.retrieval).toMatchObject({depth:1,path:["fact:f1"]});
  expect(bindings.facts.map(fact=>fact.factId)).toEqual(["f1"]);expect(bindings.sources.map(source=>source.permission)).toEqual(["canViewFacts"]);
  expect(result.memoryEffort).toMatchObject({selected:1,visited:1,expanded:0,durationMs:848,entriesByKind:{fact:1}});expect(result.memoryEffort.stopReasons).toContain("deadline");expect(result.memoryEffort.stopReasons).not.toContain("exhausted");expect(directFactTraversalComplete(result.memoryEffort)).toBe(false);
  const final=jest.fn(()=>f.repository.checkDelivery(bindings));
  const delivered=await completeRecallDelivery({clock:{now:()=>1848},finalDelivery:final},{limit:10},"p",[],[],result,1000);
  expect(delivered.items.map(item=>item.id)).toEqual(["f1"]);expect(final).toHaveBeenCalledTimes(1);expect(source.mock.calls.length).toBeGreaterThan(1);
 });
 it("late unbound seeds remain empty at848ms without starting permission/source I/O or asserting exhaustion",async()=>{
  const f=await chain(2),source=jest.spyOn(f.repository,"getSource"),fact=jest.spyOn(f.repository,"getFact");
  const result=await traverseConvexMemory(f.ctx,f.repository,f.facts.map(fact=>factEvidenceNode(fact)),resolveMemoryEffortPolicy({effort:"fast"}),empty(),undefined,undefined,undefined,1000,{startedAt:1000,now:()=>1848});
  expect(result.items).toEqual([]);expect(result.memoryEffort).toMatchObject({selected:0,visited:0,expanded:0,durationMs:848});expect(result.memoryEffort.stopReasons).toEqual(["deadline"]);
  expect(source).not.toHaveBeenCalled();expect(fact).not.toHaveBeenCalled();expect(directFactTraversalComplete(result.memoryEffort)).toBe(false);
 });
 it.each(["revoked","expired","deleted-source","changed-fact"])("retained late prefix still rejects fresh final %s",async fault=>{
  const f=await chain(1),bindings=empty();let elapsed=0;
  const result=await traverseConvexMemory(f.ctx,f.repository,[factEvidenceNode(f.facts[0]!)],resolveMemoryEffortPolicy({effort:"fast"}),bindings,undefined,()=>{elapsed=848;},undefined,1000,{startedAt:1000,now:()=>1000+elapsed});
  expect(result.items.map(item=>item.id)).toEqual(["f1"]);
  if(fault==="revoked")f.grant.revokedAt=1000;if(fault==="expired")f.db.table("facts")[0]!.validUntil=1000;
  if(fault==="deleted-source")f.db.table("runtimeMemorySources")[0]!.tombstonedAt=1000;if(fault==="changed-fact")f.db.table("facts")[0]!.fact="changed";
  const final=jest.fn(()=>f.repository.checkDelivery(bindings));await expect(completeRecallDelivery({clock:{now:()=>1848},finalDelivery:final},{limit:10},"p",[],[],result,1000)).rejects.toThrow();expect(final).toHaveBeenCalledTimes(1);
 });
 it.each([{maxEntries:0},{maxContextTokens:1},{maxWork:1}])("late authorized prefix preserves original bound %j",async bound=>{
  const f=await chain(2),policy=resolveMemoryEffortPolicy({effort:"fast"}, {version:1,...bound});let elapsed=0;
  const result=await traverseConvexMemory(f.ctx,f.repository,f.facts.map(fact=>factEvidenceNode(fact)),policy,empty(),undefined,()=>{elapsed=848;},undefined,1000,{startedAt:1000,now:()=>1000+elapsed});
  expect(result.items.length).toBeLessThanOrEqual(policy.maxEntries!);expect(result.memoryEffort.selectedInputUnits).toBeLessThanOrEqual(policy.maxContextTokens);expect(result.memoryEffort.expanded).toBe(0);expect(result.memoryEffort.stopReasons).toContain("deadline");
  if(bound.maxEntries===0||bound.maxContextTokens===1)expect(result.items).toEqual([]);else expect(result.items.map(item=>item.id)).toEqual(["f1"]);
 });
 it("late pure fitting requires the native opt-in and cannot override cancellation",async()=>{
  const f=await chain(1),policy=resolveMemoryEffortPolicy({effort:"fast"}),expand=jest.fn(async()=>({edges:[],cursor:null}));
  const options={seeds:[factEvidenceNode(f.facts[0]!)],policy,now:()=>1848,startedAt:1000,expand};
  const ordinary=await traverseMemoryEvidence(options);expect(ordinary.nodes).toEqual([]);expect(ordinary.trace.stopReasons).toContain("deadline");
  const cancelled=await traverseMemoryEvidence({...options,retainValidatedSeedPrefixOnDeadline:true,cancelled:()=>true});
  expect(cancelled.nodes).toEqual([]);expect(cancelled.trace.stopReasons).toContain("cancellation");expect(expand).not.toHaveBeenCalled();
 });
});
