import {it,expect} from "@jest/globals";
import type {DerivedFact} from "../../../src/domain/contracts";
import {sufficientDirectFactLookup,directFactTraversalComplete,directFactTraversalCompatible} from "../../../src/domain/memory-direct-recall";
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
