import {it,expect} from "@jest/globals";
import type {DerivedFact,SourceContent} from "../../../src/domain/contracts";
import {sufficientDirectFactLookup,directFactTraversalComplete,directFactTraversalCompatible,proveDirectFactLookup,directFactProofCompatible,directFactLookupSourceId} from "../../../src/domain/memory-direct-recall";
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

const literalSource:SourceContent={tenantId:observed.tenantId!,memorySpaceId:observed.memorySpaceId,ownerPrincipalId:observed.ownerPrincipalId,lineage:observed.lineage,content:"My favorite fruit is apricot.",contentHash:"a".repeat(64),createdAt:observed.createdAt};
const projections:DerivedFact[]=[observed,
  {...observed,factId:"likes",fact:"User likes fruit.",predicate:"likes",object:"fruit"},
  {...observed,factId:"general",fact:"User stated a specific preference for a type of fruit.",predicate:"has_a_preference_for",object:"apricot"}];
const sourceProof=(facts:DerivedFact[]=projections,source=literalSource,version?:1)=>proveDirectFactLookup("What is my favorite fruit?",{facts,candidateWorkBound:false},observed.createdAt,version,source);
it.each([
 {fact:"User likes fruit.",predicate:"likes",object:"fruit"},
 {fact:"User likes apricot.",predicate:"likes",object:"apricot"},
 {fact:"User stated a specific preference for a type of fruit.",predicate:"has_a_preference_for",object:"apricot"},
 {fact:"User prefers apricot as their favorite fruit.",predicate:"prefers",object:"apricot"},
 {fact:"The user prefers apricot as their favorite fruit.",predicate:"prefers",object:"apricot"},
 {fact:"I prefer apricot as my favorite fruit.",predicate:"prefer",object:"apricot"},
])("closed canonical projection grammar accepts $fact with matching metadata",projection=>{
 const facts=[observed,{...observed,factId:"canonical-projection",...projection}],proof=sourceProof(facts,literalSource,1);
 expect(proof?.source).toEqual(literalSource);expect(directFactProofCompatible(proof!,facts,observed.createdAt)).toBe(true);
 expect(sourceProof(facts,literalSource)).toBeUndefined();
});
it.each([
 {name:"wrong value",changes:{fact:"User prefers pear as their favorite fruit.",object:"pear"}},
 {name:"wrong property",changes:{fact:"User prefers apricot as their favorite color."}},
 {name:"wrong predicate",changes:{predicate:"likes"}},
 {name:"metadata value mismatch",changes:{object:"pear"}},
 {name:"unknown form",changes:{fact:"User prefers apricot."}},
 {name:"hypothetical",changes:{fact:"User might prefer apricot as their favorite fruit."}},
 {name:"negation",changes:{fact:"User does not prefer apricot as their favorite fruit."}},
 {name:"wrong possessive",changes:{fact:"User prefers apricot as your favorite fruit."}},
 {name:"wrong verb agreement",changes:{fact:"I prefers apricot as my favorite fruit."}},
 {name:"history",changes:{supersedes:"older"}},
 {name:"time bound",changes:{validUntil:observed.createdAt+100}},
 {name:"other lineage",changes:{lineage:{...observed.lineage,sourceId:"other"}}},
 {name:"missing subject",changes:{subject:undefined}},
 {name:"missing predicate",changes:{predicate:undefined}},
 {name:"missing object",changes:{object:undefined}},
])("closed canonical projection grammar refuses $name without speculative source reads",({changes})=>{
 const projection={...observed,factId:"canonical-projection",fact:"User prefers apricot as their favorite fruit.",predicate:"prefers",...changes};
 const candidates={facts:[observed,projection],candidateWorkBound:false};
 expect(directFactLookupSourceId("What is my favorite fruit?",candidates,observed.createdAt,1)).toBeUndefined();
 expect(sourceProof(candidates.facts,literalSource,1)).toBeUndefined();
 expect(directFactProofCompatible(sourceProof([observed],literalSource,1)!,[projection],observed.createdAt)).toBe(false);
});
it("prefers a pinned canonical proof for one initial hit before compatible value projection traversal",()=>{
 const candidates={facts:[observed],candidateWorkBound:false},query="What is my favorite fruit?",now=observed.createdAt;
 const later={...observed,factId:"later-likes",fact:"User likes apricot.",predicate:"likes",object:"apricot"};
 expect(directFactLookupSourceId(query,candidates,now,1)).toBe(literalSource.lineage.sourceId);
 const proof=proveDirectFactLookup(query,candidates,now,1,literalSource)!;expect(proof.source).toEqual(literalSource);
 expect(directFactProofCompatible(proof,[observed,later],now)).toBe(true);
 expect(directFactLookupSourceId(query,candidates,now)).toBeUndefined();
 const legacy=proveDirectFactLookup(query,candidates,now,undefined,literalSource)!;expect(legacy).toEqual({seed:observed});
 expect(directFactProofCompatible(legacy,[later],now)).toBe(false);
 expect(proveDirectFactLookup(query,candidates,now,1)).toEqual(legacy);
 expect(proveDirectFactLookup(query,candidates,now,1,{...literalSource,content:"Please acknowledge my favorite fruit."})).toEqual(legacy);
});
it.each([
 {name:"wrong value",change:{fact:"User likes pear.",object:"pear"}},
 {name:"metadata mismatch",change:{object:"pear"}},
 {name:"negation",change:{fact:"User does not like apricot."}},
 {name:"unknown assertion",change:{fact:"User enjoys apricot."}},
 {name:"other lineage",change:{lineage:{...observed.lineage,sourceId:"other"}}},
 {name:"history",change:{supersedes:"older"}},
 {name:"missing subject",change:{subject:undefined}},
 {name:"missing predicate",change:{predicate:undefined}},
 {name:"missing object",change:{object:undefined}},
])("singleton source proof refuses a newly discovered $name projection",({change})=>{
 const proof=sourceProof([observed],literalSource,1)!;
 expect(proof.source).toEqual(literalSource);
 expect(directFactProofCompatible(proof,[{...observed,factId:"later-likes",fact:"User likes apricot.",predicate:"likes",...change}],observed.createdAt)).toBe(false);
});
it.each(["subject","predicate","object"] as const)("unstructured singleton %s retains the old rule without a prospective source read",field=>{
 for(const missing of [undefined,""," ","!!!"]){
  const candidates={facts:[{...observed,[field]:missing}],candidateWorkBound:false};
  expect(directFactLookupSourceId("What is my favorite fruit?",candidates,observed.createdAt,1)).toBeUndefined();
  const proof=proveDirectFactLookup("What is my favorite fruit?",candidates,observed.createdAt,1,literalSource);
  expect(proof?.source).toBeUndefined();
  expect(proof!==undefined).toBe(sufficientDirectFactLookup("What is my favorite fruit?",candidates,observed.createdAt));
 }
});
it("only the new source-proof pin admits the observed three projections of one exact canonical assertion",()=>{
 expect(sourceProof()).toBeUndefined();expect(sufficientDirectFactLookup("What is my favorite fruit?",{facts:projections,candidateWorkBound:false},observed.createdAt)).toBe(false);
 const proof=sourceProof(projections,literalSource,1);expect(proof?.seed.factId).toBe(observed.factId);expect(proof?.source).toEqual(literalSource);
 expect(directFactLookupSourceId("What is my favorite fruit?",{facts:projections,candidateWorkBound:false},observed.createdAt,1)).toBe(literalSource.lineage.sourceId);
 expect(directFactProofCompatible(proof!,projections,observed.createdAt)).toBe(true);
 expect(resolveMemoryEffortPolicy({effort:"fast"})).toMatchObject({literalSourceProofVersion:2,maxEntries:4,maxDepth:2,targetFirstAnswerMs:3000});
});
it.each([
 {name:"same-source contradiction",change:{fact:"User's favorite fruit is pear.",object:"pear"}},
 {name:"same-source negation",change:{fact:"User does not like fruit."}},
 {name:"unknown projection",change:{fact:"User hates fruit."}},
 {name:"unknown neutral projection",change:{fact:"User enjoys fruit."}},
 {name:"wrong projection value",change:{object:"pear"}},
 {name:"wrong owner",change:{ownerPrincipalId:"other"}},
 {name:"different source",change:{lineage:{...observed.lineage,sourceId:"other"}}},
 {name:"different event",change:{lineage:{...observed.lineage,sourceEventId:"other"}}},
 {name:"different revision",change:{lineage:{...observed.lineage,sourceRevision:2}}},
 {name:"correction",change:{supersedes:"old"}},
 {name:"history",change:{historyReceipt:{committed:true as const,graphJobs:[],events:[],affectedFactIds:[],resultFactId:undefined}}},
 {name:"edited projection",change:{updatedAt:observed.createdAt+1}},
 {name:"future projection",change:{validFrom:observed.createdAt+1}},
 {name:"expired projection",change:{validUntil:observed.createdAt-1}},
 {name:"time-bound projection",change:{validUntil:observed.createdAt+1}},
])("$name cannot use the canonical-source proof",({change})=>{
 const facts=[projections[0]!,{...projections[1]!,...change},projections[2]!];expect(sourceProof(facts,literalSource,1)).toBeUndefined();
 expect(directFactLookupSourceId("What is my favorite fruit?",{facts,candidateWorkBound:false},observed.createdAt,1)).toBeUndefined();
 const proof=sourceProof(projections,literalSource,1)!;expect(directFactProofCompatible(proof,[facts[1]!],observed.createdAt)).toBe(false);
});
it.each(["My favorite fruit is pear.","My favorite fruit is apricot. My favorite fruit is pear.","My favorite fruit is apricot and pear.","I like apricot.","'My favorite fruit is apricot.'","My favorite fruit is apricot. Please acknowledge."])("non-single or nonmatching canonical source %s retains semantic discovery",content=>{
 expect(sourceProof(projections,{...literalSource,content},1)).toBeUndefined();
});
it("does not infer literal aliases, ignore work limits or accept absent/retired canonical sources",()=>{
 expect(proveDirectFactLookup("Which fruit do I prefer?",{facts:projections,candidateWorkBound:false},observed.createdAt,1,literalSource)).toBeUndefined();
 expect(proveDirectFactLookup("What is my favorite fruit?",{facts:projections,candidateWorkBound:true},observed.createdAt,1,literalSource)).toBeUndefined();
 expect(proveDirectFactLookup("What is my favorite fruit?",{facts:projections,candidateWorkBound:false},observed.createdAt,1)).toBeUndefined();
 expect(sourceProof(projections,{...literalSource,tombstonedAt:observed.createdAt},1)).toBeUndefined();
 expect(sourceProof(projections,{...literalSource,lineage:{...literalSource.lineage,sourceRevision:2}},1)).toBeUndefined();
 expect(sourceProof(projections.map(fact=>({...fact,lineage:{...fact.lineage,sourceRevision:2}})),{...literalSource,lineage:{...literalSource.lineage,sourceRevision:2}},1)).toBeUndefined();
});

it.each(["contradiction","canonical-mismatch","same-value"])("LSR-1 unstructured %s has no prospective/source proof while the historical singleton rule remains",scenario=>{
 const values=["apricot",scenario==="contradiction"?"pear":"apricot"],facts=values.map((value,index)=>({...observed,factId:`unstructured-${index}`,fact:`My favorite fruit is ${value}.`,subject:undefined,predicate:undefined,object:undefined}));
 const source={...literalSource,content:`My favorite fruit is ${scenario==="canonical-mismatch"?"pear":"apricot"}.`},candidates={facts,candidateWorkBound:false};
 expect(sufficientDirectFactLookup("What is my favorite fruit?",{facts:[facts[0]!],candidateWorkBound:false},observed.createdAt)).toBe(true);
 expect(directFactLookupSourceId("What is my favorite fruit?",candidates,observed.createdAt,1)).toBeUndefined();
 expect(proveDirectFactLookup("What is my favorite fruit?",candidates,observed.createdAt,1,source)).toBeUndefined();
 expect(directFactProofCompatible(sourceProof(projections,literalSource,1)!,facts,observed.createdAt)).toBe(false);
});
it.each(["subject","predicate","object"] as const)("new multi-fact source proof requires nonempty structured %s before its prospective source read",field=>{
 for(const missing of [undefined,""," ","!!!"]){
  const facts=[{...observed,[field]:missing},{...observed,factId:"second",[field]:missing}],candidates={facts,candidateWorkBound:false};
  expect(directFactLookupSourceId("What is my favorite fruit?",candidates,observed.createdAt,1)).toBeUndefined();
  expect(proveDirectFactLookup("What is my favorite fruit?",candidates,observed.createdAt,1,literalSource)).toBeUndefined();
 }
});
it.each(["contradiction","canonical-mismatch"])("LSR-1 actual repository/traversal/delivery cannot turn unstructured %s into source proof",async scenario=>{
 const f=memoryFixture(),scope=memoryScope(f.reference),writer=new ConvexMemoryRepository(f.ctx,f.reference,"write",f.ctx.db,{now:()=>1000});
 const lineage={sourceId:`unstructured-${scenario}`,sourceEventId:`unstructured-event-${scenario}`,sourceRevision:1,role:"user" as const,trust:"user_assertion" as const};
 const prepared=await prepareSourceContent(scope,lineage,`My favorite fruit is ${scenario==="canonical-mismatch"?"pear":"apricot"}.`,{now:()=>1000});await writer.putSource(prepared.source);
 const facts:DerivedFact[]=["apricot",scenario==="contradiction"?"pear":"apricot"].map((value,index)=>({...observed,_id:"",factId:`native-unstructured-${index}`,tenantId:scope.tenantId,memorySpaceId:scope.memorySpaceId,ownerPrincipalId:scope.principalId,lineage,
  fact:`My favorite fruit is ${value}.`,subject:undefined,predicate:undefined,object:undefined,createdAt:1000,updatedAt:1000}));
 await writer.commitDerived({source:lineage,identity:{...lineage,stage:"facts",semanticPolicyVersion:observed.extractionPolicyVersion},facts,expectedFactVersions:Object.fromEntries(facts.map(fact=>[fact.factId,0]))});
 const repository=new ConvexMemoryRepository(f.ctx,f.reference,"read",undefined,{now:()=>1000}),query="What is my favorite fruit",candidates=await repository.searchFactCandidates(query,8);
 expect(candidates.facts).toHaveLength(2);expect(candidates.candidateWorkBound).toBe(false);
 const proof=proveDirectFactLookup(query,candidates,1000,1,prepared.source);expect(proof).toBeUndefined();expect(directFactLookupSourceId(query,candidates,1000,1)).toBeUndefined();
 const bindings:MemoryDeliveryBindings={sources:[],facts:[],vectors:[]},inspected:string[]=[];
 const traversal=await traverseConvexMemory(f.ctx,repository,candidates.facts.map(fact=>factEvidenceNode(fact,1)),resolveMemoryEffortPolicy({effort:"fast"}),bindings,undefined,fact=>{inspected.push(fact.factId);},query);
 expect(new Set(inspected)).toEqual(new Set(facts.map(fact=>fact.factId)));expect(traversal.items.filter(item=>item.type==="fact")).toHaveLength(2);
 expect(bindings.facts.map(fact=>fact.factId).sort()).toEqual(facts.map(fact=>fact.factId).sort());expect(directFactTraversalComplete(traversal.memoryEffort)).toBe(true);
 await expect(repository.checkDelivery(bindings)).resolves.toMatchObject({version:1});expect(!!proof&&directFactTraversalComplete(traversal.memoryEffort)).toBe(false);
});
