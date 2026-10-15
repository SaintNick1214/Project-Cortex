import {it,expect} from "@jest/globals";
import type {DerivedFact} from "../../../src/domain/contracts";
import {sufficientDirectFactLookup,directFactTraversalComplete,directFactTraversalCompatible} from "../../../src/domain/memory-direct-recall";
import {resolveMemoryEffortPolicy} from "../../../src/domain/memory-effort";
import {prepareSourceContent} from "../../../src/domain/sources";
import {ConvexMemoryRepository,memoryScope} from "../../../convex-dev/runtimeMemoryRepository";
import type {MemoryDeliveryBindings} from "../../../convex-dev/runtimeMemoryRepository";
import {factEvidenceNode,replaceFactEntityLinks,traverseConvexMemory} from "../../../convex-dev/runtimeMemoryTraversal";
import {memoryFixture} from "./fixture";
const fact:DerivedFact={_id:"f",factId:"f",tenantId:"t",memorySpaceId:"s",ownerPrincipalId:"p",lineage:{sourceId:"s",sourceEventId:"e",sourceRevision:1,role:"user",trust:"user_assertion"},extractionPolicyVersion:"v1",fact:"User's favorite season is autumn",factType:"preference",subject:"user",predicate:"favorite season",object:"autumn",confidence:1,tags:[],sourceType:"manual",version:1,createdAt:1000,updatedAt:1000};
const sufficient=(text:string,values:DerivedFact[]=[fact],candidateWorkBound=false)=>sufficientDirectFactLookup(text,{facts:values,candidateWorkBound},1000);
it("uses literal subject/property/value coverage, independently of extracted confidence",()=>{expect(sufficient("What is my favorite season?")).toBe(true);expect(sufficient("What is my favorite season?",[{...fact,subject:undefined,predicate:undefined,object:undefined}])).toBe(true);});
it.each(["Which season do I prefer?","What is my home address?","What is my favorite thing?","What is my favorite season? Also compare winter.","Tell me everything about my favorite season","What is my favorite season and color?"])("%s retains semantic discovery",text=>expect(sufficient(text)).toBe(false));
it.each(["conflict","page","correction","edited","future","subject","object","negation"])("%s cannot assert deterministic sufficiency",kind=>{
 const next={...fact};let values=[next],partial=false;
 if(kind==="conflict")values=[next,{...fact,factId:"other",object:"spring",fact:"User favorite season is spring"}];
 if(kind==="page")partial=true;if(kind==="correction")next.supersedes="old";if(kind==="edited")next.updatedAt=1001;if(kind==="future")next.validFrom=1001;
 if(kind==="subject")next.subject="another user";if(kind==="object")next.object="spring";if(kind==="negation")next.fact="User favorite season is not autumn";
 expect(sufficient("What is my favorite season?",values,partial)).toBe(false);
});
it("requires a qualified named subject for a the-property lookup",()=>{expect(sufficient("What is the Aurora launch date?",[{...fact,fact:"Aurora launch date is October 12",subject:"Aurora",predicate:"launch date",object:"October 12"}])).toBe(true);expect(sufficient("What is the launch date?",[{...fact,fact:"Aurora launch date is October 12",subject:"Aurora",predicate:"launch date",object:"October 12"}])).toBe(false);});

it("private traversal compatibility includes discovered facts even when selection drops them",()=>{
  expect(directFactTraversalCompatible(fact,[fact])).toBe(true);
  expect(directFactTraversalCompatible(fact,[fact,{...fact,factId:"conflict"}])).toBe(false);
  expect(directFactTraversalCompatible(fact,[{...fact,factId:"correction",predicate:"different",supersedes:"old"}])).toBe(false);
});
it.each(["entries","input","work","deadline","cancellation","relevance","unavailable"] as const)("%s traversal truncation retains semantic discovery",reason=>{
  expect(directFactTraversalComplete({stopReasons:["depth",reason],unavailableStages:[]})).toBe(false);
});
it("only fully examined candidates inside the configured depth horizon permit direct discovery",()=>{
  expect(directFactTraversalComplete({stopReasons:["depth"],unavailableStages:[]})).toBe(true);
  expect(directFactTraversalComplete({stopReasons:["exhausted"],unavailableStages:[]})).toBe(true);
  expect(directFactTraversalComplete({stopReasons:["depth"],unavailableStages:["entity-projection-unavailable"]})).toBe(false);
});

const observed:DerivedFact={...fact,fact:"User's favorite fruit is apricot.",subject:"User",predicate:"prefers",object:"apricot",createdAt:1792032300476,updatedAt:1792032300476};
const literal=(values:DerivedFact[]=[observed],candidateWorkBound=false)=>sufficientDirectFactLookup("What is my favorite fruit?",{facts:values,candidateWorkBound},1792032300476);
it("grounds the actual extracted singleton in explicit literal text and matching owned subject/value",()=>{
  expect(literal()).toBe(true);
  expect(literal([{...observed,predicate:"records"}])).toBe(true);
  expect(literal([{...observed,subject:observed.ownerPrincipalId}])).toBe(true);
});
it.each([
  {name:"wrong subject",changes:{subject:"another user"}},
  {name:"wrong owner subject",changes:{subject:"other-principal"}},
  {name:"wrong value",changes:{object:"pear"}},
  {name:"missing value",changes:{object:undefined}},
  {name:"empty predicate metadata",changes:{predicate:"!!!"}},
  {name:"likes is not literal favorite fruit",changes:{fact:"User likes apricot."}},
  {name:"prefers is not literal favorite fruit",changes:{fact:"User prefers apricot."}},
  {name:"different literal property",changes:{fact:"User's favorite color is apricot."}},
  {name:"negated literal",changes:{fact:"User's favorite fruit is not apricot."}},
  {name:"compound literal",changes:{fact:"User's favorite fruit is apricot and pear.",object:"apricot and pear"}},
  {name:"correction",changes:{supersedes:"older"}},
  {name:"superseded",changes:{supersededBy:"newer"}},
  {name:"edited assertion",changes:{updatedAt:1792032300477}},
  {name:"later version",changes:{version:2}},
  {name:"future assertion",changes:{validFrom:1792032300477}},
  {name:"expired assertion",changes:{validUntil:1792032300475}},
])("$name retains semantic discovery for the actual extracted shape",({changes})=>{
  expect(literal([{...observed,...changes}])).toBe(false);
});
it("keeps singleton and bounded-candidate requirements for literal text with broad predicate metadata",()=>{
  expect(literal([observed,{...observed,factId:"other",fact:"User's favorite fruit is pear.",object:"pear"}])).toBe(false);
  expect(literal([observed],true)).toBe(false);
});
it("rejects discovered assertions of the same literal property across differing structured predicates",()=>{
  const conflict={...observed,factId:"conflict",fact:"My favorite fruit is pear.",subject:"user",predicate:"favorite fruit",object:"pear"};
  const unrelated:DerivedFact={...conflict,fact:"User's favorite color is blue.",predicate:"favorite color",object:"blue"};
  expect(directFactTraversalCompatible(observed,[observed])).toBe(true);
  expect(directFactTraversalCompatible(observed,[conflict])).toBe(false);
  expect(directFactTraversalCompatible(conflict,[observed])).toBe(false);
  expect(directFactTraversalCompatible(observed,[{...conflict,fact:"User likes pear.",predicate:"likes"}])).toBe(false);
  expect(directFactTraversalCompatible(observed,[unrelated])).toBe(true);
});
it.each([1,4])("inspects mixed-predicate conflicting literal evidence before selection at cap%i",async maxEntries=>{
  const f=memoryFixture(),scope=memoryScope(f.reference),repository=new ConvexMemoryRepository(f.ctx,f.reference,"read",undefined,{now:()=>1000}),facts:DerivedFact[]=[];
  for(const [index,template]of [observed,{...observed,fact:"User's favorite fruit is pear.",predicate:"favorite fruit",object:"pear"}].entries()){
    const lineage={sourceId:`literal-source-${index}`,sourceEventId:`literal-event-${index}`,sourceRevision:1,role:"user" as const,trust:"user_assertion" as const};
    const prepared=await prepareSourceContent(scope,lineage,template.fact,{now:()=>1000});f.db.seed("runtimeMemorySources",{...prepared.source});
    const value:DerivedFact={...template,_id:`literal-row-${index}`,factId:`literal-fact-${index}`,tenantId:scope.tenantId,memorySpaceId:scope.memorySpaceId,ownerPrincipalId:scope.principalId,lineage,createdAt:1000,updatedAt:1000};
    f.db.seed("facts",{...value});await replaceFactEntityLinks(f.ctx.db,value);facts.push(value);
  }
  const bindings:MemoryDeliveryBindings={sources:[],facts:[],vectors:[]},inspected:string[]=[],compatibility={accepted:true};
  const result=await traverseConvexMemory(f.ctx,repository,[factEvidenceNode(facts[0]!,1)],resolveMemoryEffortPolicy({effort:"fast",maxEntries}),bindings,undefined,value=>{
    inspected.push(value.factId);compatibility.accepted=compatibility.accepted&&directFactTraversalCompatible(facts[0]!,[value]);
  });
  expect(inspected).toContain(facts[1]!.factId);expect(compatibility.accepted).toBe(false);
  expect(compatibility.accepted&&directFactTraversalComplete(result.memoryEffort)).toBe(false);
  expect(result.items.length).toBeLessThanOrEqual(maxEntries);
  if(maxEntries===1){expect(result.items.map(item=>item.id)).toEqual([facts[0]!.factId]);expect(result.memoryEffort.stopReasons).toContain("entries");expect(JSON.stringify(result)).not.toContain("pear");}
});
