import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { convexToJson } from "convex/values";
import { Cortex, createAuthContext } from "../src/index";
const root=process.env.CORTEX_TASK17_PROOF_ROOT!;
const key=JSON.parse(readFileSync(`${root}/private-admin.json`,"utf8")).key;
const url="http://127.0.0.1:45710";
const admin=new ConvexHttpClient(url,{logger:false});(admin as unknown as {setAdminAuth(key: string): void}).setAdminAuth(key);
const seedRef=makeFunctionReference<"mutation">("task17Fixture:seed");
const readRef=makeFunctionReference<"query">("task17Fixture:readLedgerRows");
const ref=(name:string)=>makeFunctionReference<"query">(name);
const scopes=["A","B","none"] as const;
const tenant=(scope:string)=>scope==="none"?undefined:`task17-${scope}`;
const digest=(doc:any)=>createHash("sha256").update(JSON.stringify(convexToJson(doc))).digest("hex");
const bytes=(rows:any[])=>rows.reduce((n,r)=>n+Buffer.byteLength(JSON.stringify(convexToJson(r)),"utf8"),0);
const resume = process.env.CORTEX_TASK17_NATIVE_RESUME === "1";
const searchOnly = process.env.CORTEX_TASK17_SEARCH_ONLY === "1";
const ledger:Array<{case:string;scope:string;batch:number;ids:string[]}>=(resume || searchOnly) ? JSON.parse(readFileSync(`${root}/evidence/native-ledger${searchOnly ? "5" : "4"}.json`,"utf8")) : [];
const outcomes:any[]=[];
const clients: Cortex[]=[];
function save(){if(!searchOnly)writeFileSync(`${root}/evidence/native-ledger${resume ? "5" : ""}.json`,JSON.stringify(ledger,null,2));writeFileSync(`${root}/evidence/native-outcomes${searchOnly ? "search6" : resume ? "5" : ""}.json`,JSON.stringify(outcomes,null,2));}
async function seed(c:string,s:string,batch=0){const args={case:c,scope:s,batch};let ids:string[];try{ids=await admin.mutation(seedRef,args) as string[];}catch(e){outcomes.push({kind:"seed-failed",args,outcome:"ERROR",error:String(e).replaceAll(key,"[private]")});save();throw e;}ledger.push({...args,ids});save();return ids;}
async function rows(ids:string[]){const out:any[]=[];for(let i=0;i<ids.length;i+=16)out.push(...await admin.query(readRef,{ids:ids.slice(i,i+16)}) as any[]);return out;}
async function caseRows(c:string){return rows(ledger.filter(x=>x.case===c).flatMap(x=>x.ids));}
function api(s:string){const c=new Cortex({convexUrl:url,convexLogger:false,graphEnabled:false,resilience:{enabled:false},auth:createAuthContext({userId:"actor",...(tenant(s)?{tenantId:tenant(s)}:{})})},{initializeTransport(client){(client as any).setAdminAuth(key);return undefined;}});clients.push(c);return c;}
function record(name:string,facts:any={}){outcomes.push({name,outcome:"PASS",...facts});save();}
async function expectedError(p:Promise<unknown>,contains?:string){try{await p;throw Error("EXPECTED_ERROR_MISSING");}catch(e){const error=String(e).replaceAll(key,"[private]");if(error.includes("EXPECTED_ERROR_MISSING"))throw e;if(contains)expect(error).toContain(contains);return error;}}
if (!resume && !searchOnly) it("actual scoped SDK/native domain matrix, physical preservation, >1000 counts, storage and native rollback",async()=>{
 try{
  for(const [c,order] of [["first",scopes],["last",["none","B","A"]]] as const){for(const s of order)await seed(c,s);
   for(const s of scopes){const cApi=api(s);const space=`task17-${c}`;const user=`task17-${c}-user`;const before=await caseRows(c);const selected=before.filter(r=>r.tenantId===tenant(s));const foreign=before.filter(r=>r.tenantId!==tenant(s)).map(digest);
    expect((await cApi.memorySpaces.get(space))!._id).toBe(selected.find(r=>r.memorySpaceId===space&&r.type==="team")._id);
    expect((await cApi.users.get(user))!.data.marker).toBe(s);expect((await cApi.users.getHistory(user)).map(v=>v.version)).toEqual([1,2]);
    await expectedError(cApi.memorySpaces.register({memorySpaceId:space,type:"team"}),"MEMORYSPACE_ALREADY_EXISTS");
    await cApi.memorySpaces.update(space,{name:`updated-${s}`,metadata:{owner:"task17",name:s}});
    await cApi.memorySpaces.addParticipant(space,{id:`new-${s}`,type:"tool",joinedAt:21});
    await cApi.memorySpaces.updateParticipants(space,{add:[{id:`third-${s}`,type:"agent",joinedAt:22}],remove:[`new-${s}`]});
    await cApi.memorySpaces.removeParticipant(space,`third-${s}`);await cApi.memorySpaces.archive(space,{reason:"task17 owned"});expect((await cApi.memorySpaces.get(space))!.status).toBe("archived");await cApi.memorySpaces.reactivate(space);
    await cApi.users.update(user,{updated:s});expect((await cApi.users.getHistory(user)).map(v=>v.version)).toEqual([1,2,3]);
    expect((await cApi.memorySpaces.list({limit:1000})).spaces.every(r=>r.tenantId===tenant(s))).toBe(true);
    expect((await cApi.memorySpaces.search(space)).map(r=>r.memorySpaceId)).toEqual([space]);
    expect((await cApi.memorySpaces.findByParticipant("participant")).every(r=>r.tenantId===tenant(s))).toBe(true);
    expect(await cApi.vector.count({memorySpaceId:space,participantId:"participant",userId:"task17-user",sourceType:"system"})).toBe(1);
    expect(await cApi.memory.count({memorySpaceId:space,participantId:"participant"})).toBe(1);
    expect(await cApi.conversations.count({memorySpaceId:space,userId:"task17-user",type:"user-agent"})).toBe(1);
    expect(await cApi.facts.count({memorySpaceId:space,tags:["task17","tag"],tagMatch:"all",confidence:75,metadata:{owner:"task17"}})).toBe(1);
    const after=await caseRows(c);expect(after.filter(r=>r.tenantId!==tenant(s)).map(digest)).toEqual(foreign);
    record(`collision-${c}-${s}`,{selectedPhysicalIds:selected.map(r=>r._id),foreignPreserved:foreign.length,profileVersions:3});
   }
  }
  await seed("foreign","B");
  for(const scope of ["A","none"]){const client=api(scope);expect(await client.memorySpaces.get("task17-foreign")).toBeNull();expect(await client.users.get("task17-foreign-user")).toBeNull();expect(await client.users.getHistory("task17-foreign-user")).toEqual([]);await expectedError(client.memorySpaces.update("task17-foreign",{name:"no"}),"MEMORYSPACE_NOT_FOUND");}
  record("foreign-only-missing");
  const empty=await api("A").memorySpaces.register({memorySpaceId:"task17-empty",type:"team"});ledger.push({case:"empty",scope:"A",batch:0,ids:[empty._id]});save();
  expect((await api("A").memorySpaces.getStats("task17-empty")).storage).toEqual({conversationsBytes:0,memoriesBytes:0,factsBytes:0,totalBytes:0});record("empty-stats-zero");
  for(const s of scopes){await seed("duplicate",s,0);await seed("duplicate",s,1);const cApi=api(s);const before=(await caseRows("duplicate")).map(digest);
   const attempts=[()=>cApi.memorySpaces.get("task17-duplicate"),()=>cApi.memorySpaces.register({memorySpaceId:"task17-duplicate",type:"team"}),()=>cApi.memorySpaces.update("task17-duplicate",{name:"no"}),()=>cApi.memorySpaces.addParticipant("task17-duplicate",{id:"no",type:"tool",joinedAt:1}),()=>cApi.memorySpaces.removeParticipant("task17-duplicate","participant"),()=>cApi.memorySpaces.updateParticipants("task17-duplicate",{remove:["participant"]}),()=>cApi.memorySpaces.archive("task17-duplicate"),()=>cApi.memorySpaces.reactivate("task17-duplicate"),()=>cApi.memorySpaces.getStats("task17-duplicate"),()=>cApi.memorySpaces.delete("task17-duplicate",{cascade:true,reason:"owned"}),()=>cApi.users.get("task17-duplicate-user"),()=>cApi.users.update("task17-duplicate-user",{no:true}),()=>cApi.users.getHistory("task17-duplicate-user"),()=>cApi.users.delete("task17-duplicate-user")];
   for(const invoke of attempts)await expectedError(invoke(),"DOMAIN_SCOPE_AMBIGUOUS");expect((await caseRows("duplicate")).map(digest)).toEqual(before);record(`ambiguity-${s}`,{refusals:attempts.length,physicalRowsPreserved:before.length});
  }
  for(const s of scopes)await seed("stats",s);
  for(const s of scopes){const cApi=api(s);const all=await caseRows("stats");const selected=all.filter(r=>r.tenantId===tenant(s));const conversations=selected.filter(r=>"conversationId" in r);const memories=selected.filter(r=>"memoryId" in r);const facts=selected.filter(r=>"factId" in r);
   const stats=await cApi.memorySpaces.getStats("task17-stats",{includeParticipants:true,timeWindow:"all"});expect(stats.storage).toEqual({conversationsBytes:bytes(conversations),memoriesBytes:bytes(memories),factsBytes:bytes(facts),totalBytes:bytes([...conversations,...memories,...facts])});expect(stats.storage.totalBytes).toBeGreaterThan(0);expect(stats.storageMeasurement).toBe("convex-json-utf8-estimate");expect(stats).toMatchObject({totalMemories:1,totalConversations:1,totalFacts:1,totalMessages:1,memoriesThisWindow:1,conversationsThisWindow:1,topTags:["task17","tag"],importanceBreakdown:{critical:1,high:0,medium:0,low:0,trivial:0}});expect(stats.participants?.[0]).toMatchObject({participantId:"participant",memoriesStored:1,conversationsStored:1,factsExtracted:1,avgImportance:95});record(`stats-${s}`,{storage:stats.storage,systemFieldsAndSpecialValues:true});
  }
  for(const s of scopes){for(let batch=0;batch<334;batch++)await seed("count",s,batch);record(`seed-1001-${s}`,{physicalRows:5005,maxRowsPerMutation:15});}
  for(const s of scopes){const cApi=api(s);const all=(await caseRows("count")).filter(r=>r.tenantId===tenant(s));expect(all).toHaveLength(5005);
   expect(await cApi.memorySpaces.count({type:"custom"})).toBe(1001);expect(await cApi.vector.count({memorySpaceId:"task17-count",participantId:"count-participant",userId:"task17-count-user",sourceType:"system"})).toBe(1001);expect(await cApi.memory.count({memorySpaceId:"task17-count",participantId:"count-participant"})).toBe(1001);expect(await cApi.conversations.count({memorySpaceId:"task17-count",userId:"task17-count-user",type:"user-agent"})).toBe(1001);expect(await cApi.facts.count({memorySpaceId:"task17-count",participantId:"count-participant",sourceType:"manual",factType:"knowledge",tags:["tag","task17"],tagMatch:"all",minConfidence:70})).toBe(1001);
   expect(await cApi.users.count({createdBefore:1001})).toBe(1001);const profileRows=all.filter(r=>r.type==="user");
   for(const filter of [{createdAfter:0,createdBefore:2,updatedAfter:0.5,updatedBefore:2.5},{createdAfter:0.5},{createdBefore:0},{updatedAfter:1000.5},{createdAfter:500,createdBefore:501},{updatedAfter:0.25,updatedBefore:1.25}]){const expected=profileRows.filter(r=>Object.entries(filter).every(([field,value])=>field.endsWith("After")?r[field.startsWith("created")?"createdAt":"updatedAt"]>value:r[field.startsWith("created")?"createdAt":"updatedAt"]<value)).length;expect(await cApi.users.count({...filter,createdBefore:(filter as any).createdBefore??1001})).toBe(expected);}
   expect(await cApi.vector.count({memorySpaceId:"task17-count",participantId:"other"})).toBe(0);expect(await cApi.conversations.count({memorySpaceId:"other"})).toBe(0);expect(await cApi.facts.count({memorySpaceId:"task17-count",tags:["absent"]})).toBe(0);record(`count-1001-${s}`,{counts:{spaces:1001,memories:1001,conversations:1001,facts:1001,profiles:1001},physicalProfiles:profileRows.length,dateOracle:"independent-fixed-physical-ID-full-documents"});
  }
  for(const s of scopes)await seed("delete",s);
  const deletion=api("A");const before=await caseRows("delete");const foreign=before.filter(r=>r.tenantId!==tenant("A")||r.type==="user"||r.type==="audit"||r.memorySpaceId==="task17-delete-other"||"contextId" in r).map(digest);
  await expectedError(deletion.memorySpaces.delete("task17-delete",{cascade:true,reason:"owned",confirmId:"other"}));
  expect((await caseRows("delete")).map(digest)).toEqual(before.map(digest));const result=await deletion.memorySpaces.delete("task17-delete",{cascade:true,reason:"owned",confirmId:"task17-delete"});expect(result.cascade).toMatchObject({conversationsDeleted:1,memoriesDeleted:1,factsDeleted:1});const after=(await caseRows("delete")).filter(Boolean);expect(after.map(digest)).toEqual(foreign);record("atomic-current-three-domain-delete",{deleted:4,preserved:foreign.length,fullErasureClaim:false});
  for(const s of scopes){const cApi=api(s);const user="task17-first-user";const profileBefore=(await caseRows("first")).filter(Boolean);const dry=await cApi.users.delete(user,{dryRun:true});expect(dry.verification).toMatchObject({scope:"user-profile",complete:false});expect((await caseRows("first")).filter(Boolean).map(digest)).toEqual(profileBefore.map(digest));const result=await cApi.users.delete(user);expect(result.verification).toMatchObject({scope:"user-profile",complete:true});expect(await cApi.users.get(user)).toBeNull();const after=await caseRows("first");const removed=profileBefore.find(r=>r.tenantId===tenant(s)&&r.type==="user")._id;expect(after.filter(Boolean).map(digest)).toEqual(profileBefore.filter(r=>r._id!==removed).map(digest));record(`profile-only-delete-${s}`,{deleted:1,preserved:after.filter(Boolean).length});}
  for(const name of ["memories:count","conversations:count","facts:count","memorySpaces:count","immutable:count"]){await expectedError(admin.query(ref(name),{tenantId:null,...(name.startsWith("memories")||name.startsWith("facts")?{memorySpaceId:"task17-count"}:{})}));}
  await expectedError(admin.query(ref("immutable:count"),{type:"user",filters:{}}));await expectedError(admin.query(ref("immutable:count"),{type:"user",limit:1}));record("native-validator-refusals",{unsupportedNullsAndUnknownFields:7});
  for(let batch=0;batch<40;batch++){if(ledger.some(row=>row.case==="rollback"&&row.batch===batch))continue;await seed("rollback","A",batch);await new Promise(resolve=>setTimeout(resolve,300));}
  const rollbackRows=await caseRows("rollback");expect(rollbackRows.filter(Boolean)).toHaveLength(42);const beforeHash=rollbackRows.map(digest);const countError=await expectedError(deletion.vector.count({memorySpaceId:"task17-rollback"}));expect(countError).toMatch(/limit|many bytes|maximum/i);record("native-count-budget-error",{error:countError,countReported:null});
  const deleteError=await expectedError(deletion.memorySpaces.delete("task17-rollback",{cascade:true,reason:"owned late-failure"}));expect(deleteError).toMatch(/limit|many bytes|maximum/i);expect((await caseRows("rollback")).map(digest)).toEqual(beforeHash);record("native-late-delete-rollback",{error:deleteError,physicalRowsUnchanged:42,attemptedEarlierConversationDelete:true});
  for(const s of scopes)await seed("python",s);record("python-fixtures-ready");
 }catch(e){outcomes.push({name:"native-matrix",outcome:"FAIL",error:String(e).replaceAll(key,"[private]")});save();throw e;}
 finally{for(const c of clients){await c.shutdown();outcomes.push({name:"actual-client-shutdown",outcome:"PASS"});}save();}
},600000);

if (resume) it("continue unfinished native checks after exact committed-profile reconciliation",async()=>{
 try {
  // Reconcile committed selected IDs and authoritative rate-refused batch before retry.
  const observed=await admin.query(ref("memories:list"),{memorySpaceId:"task17-rollback",limit:100}) as any[];
  expect(observed.every(row=>row.tenantId==="task17-A")).toBe(true);
  const committed=ledger.filter(row=>row.case==="rollback");
  const known=await rows(committed.flatMap(row=>row.ids));expect(observed.map(row=>row._id).sort()).toEqual(known.filter(row=>row.memoryId).map(row=>row._id).sort());
  expect(observed.map(row=>row.createdAt).sort((a,b)=>a-b)).toEqual([10000,10001,10002,10003,10004,10005,10006]);
  record("rate-refused-batch-reconciliation",{failedBatch:7,absent:true,committedMemoryRows:7,mutationReplayed:false});
  const deletion=api("A");
  for(const name of ["memories:count","conversations:count","facts:count","memorySpaces:count","immutable:count"]){await expectedError(admin.query(ref(name),{tenantId:null,...(name.startsWith("memories")||name.startsWith("facts")?{memorySpaceId:"task17-count"}:{})}));}
  await expectedError(admin.query(ref("immutable:count"),{type:"user",filters:{}}));await expectedError(admin.query(ref("immutable:count"),{type:"user",limit:1}));record("native-validator-refusals",{unsupportedNullsAndUnknownFields:7});
  for(let batch=0;batch<40;batch++){if(ledger.some(row=>row.case==="rollback"&&row.batch===batch))continue;await seed("rollback","A",batch);await new Promise(resolve=>setTimeout(resolve,300));}
  const rollbackRows=await caseRows("rollback");expect(rollbackRows.filter(Boolean)).toHaveLength(42);const beforeHash=rollbackRows.map(digest);const countError=await expectedError(deletion.vector.count({memorySpaceId:"task17-rollback"}));expect(countError).toMatch(/limit|many bytes|maximum/i);record("native-count-budget-error",{error:countError,countReported:null});
  const deleteError=await expectedError(deletion.memorySpaces.delete("task17-rollback",{cascade:true,reason:"owned late-failure"}));expect(deleteError).toMatch(/limit|many bytes|maximum/i);expect((await caseRows("rollback")).map(digest)).toEqual(beforeHash);record("native-late-delete-rollback",{error:deleteError,physicalRowsUnchanged:42,attemptedEarlierConversationDelete:true});
  for(const s of scopes)await seed("python",s);record("python-fixtures-ready");

 } catch(e) {outcomes.push({name:"native-continuation",outcome:"FAIL",error:String(e).replaceAll(key,"[private]")});save();throw e;}
 finally {for(const c of clients){await c.shutdown();outcomes.push({name:"actual-client-shutdown",outcome:"PASS"});}save();}
},600000);

if(searchOnly) it("public TS search tolerates native Convex metadata in every selected scope",async()=>{
 try {const before=(await caseRows("stats")).map(digest);
  for(const scope of scopes){const cApi=api(scope);
   expect((await cApi.memorySpaces.search("task17-python")).map(row=>row.memorySpaceId)).toEqual(["task17-python"]);
   expect((await cApi.memorySpaces.search("é🌱")).map(row=>row.memorySpaceId)).toEqual(["task17-stats"]);
   expect(await cApi.memorySpaces.search("unmatched-search-text")).toEqual([]);
   record(`native-official-metadata-search-${scope}`,{queryKinds:3,scope:tenant(scope)??"tenantless"});
  }expect((await caseRows("stats")).map(digest)).toEqual(before);record("search-physical-preservation",{knownDocuments:before.length});
 }finally{for(const c of clients){await c.shutdown();outcomes.push({name:"actual-client-shutdown",outcome:"PASS"});}save();}
},30000);
