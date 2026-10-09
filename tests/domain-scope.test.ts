import { nativeAdmin, nativeTarget, operatorFunctionName, proofPrefix } from "./helpers/native-ci";
import { UsersAPI } from "../src/users";
import { createHash } from "node:crypto";
import { makeFunctionReference } from "convex/server";
import { convexToJson } from "convex/values";
import { Cortex, createAuthContext } from "./helpers/deployment-operator";
const prefix=proofPrefix("task17-ci");
const {url,key}=nativeTarget();
const admin=nativeAdmin();
const ref=(name:string)=>makeFunctionReference<"query">(operatorFunctionName(name));
const scopes=["A","B","none"] as const;
const tenant=(scope:string)=>scope==="none"?undefined:`${prefix}-${scope}`;
const digest=(doc:any)=>createHash("sha256").update(JSON.stringify(convexToJson(doc))).digest("hex");
const bytes=(rows:any[])=>rows.reduce((n,r)=>n+Buffer.byteLength(JSON.stringify(convexToJson(r)),"utf8"),0);
const ledger:Array<{case:string;scope:string;batch:number;ids:string[]}>=[];
const outcomes:any[]=[];
const clients: Cortex[]=[];
const erasureTransport=new UsersAPI({} as never).createErasureTransport({url,deploymentKey:key});
afterAll(()=>erasureTransport.close());
function save(){ /* Assertions remain in Jest; no host-specific proof artifacts. */ }
async function seed(c:string,s:string,batch=0){const args={prefix,case:c,scope:s,batch};let ids:string[];try{ids=await admin.function("task17Fixture:seed",undefined,args) as string[];}catch(e){outcomes.push({kind:"seed-failed",args,outcome:"ERROR",error:String(e).replaceAll(key,"[private]")});save();throw e;}ledger.push({...args,ids});save();return ids;}
async function rows(ids:string[]){const out:any[]=[];for(let i=0;i<ids.length;i+=16)out.push(...await admin.function("task17Fixture:readLedgerRows",undefined,{prefix,ids:ids.slice(i,i+16)}) as any[]);return out;}
async function caseRows(c:string){return rows(ledger.filter(x=>x.case===c).flatMap(x=>x.ids));}
function api(s:string){const c=new Cortex({convexUrl:url,convexLogger:false,graphEnabled:false,resilience:{enabled:false},auth:createAuthContext({userId:"actor",...(tenant(s)?{tenantId:tenant(s)}:{})})});clients.push(c);return c;}
function record(name:string,facts:any={}){outcomes.push({name,outcome:"PASS",...facts});console.info("Native scope proof:",name);save();}
async function expectedError(p:Promise<unknown>,contains?:string){try{await p;throw Error("EXPECTED_ERROR_MISSING");}catch(e){const error=String(e).replaceAll(key,"[private]");if(error.includes("EXPECTED_ERROR_MISSING"))throw e;if(contains)expect(error).toContain(contains);return error;}}
it("actual scoped SDK/native domain matrix, physical preservation, >1000 counts, storage and native rollback",async()=>{
 try{
  for(const [c,order] of [["first",scopes],["last",["none","B","A"]]] as const){for(const s of order)await seed(c,s);
   for(const s of scopes){const cApi=api(s);const space=`${prefix}-${c}`;const user=`${prefix}-${c}-user`;const before=await caseRows(c);const selected=before.filter(r=>r.tenantId===tenant(s));const foreign=before.filter(r=>r.tenantId!==tenant(s)).map(digest);
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
    expect(await cApi.vector.count({memorySpaceId:space,participantId:"participant",userId:`${prefix}-user`,sourceType:"system"})).toBe(1);
    expect(await cApi.memory.count({memorySpaceId:space,participantId:"participant"})).toBe(1);
    expect(await cApi.conversations.count({memorySpaceId:space,userId:`${prefix}-user`,type:"user-agent"})).toBe(1);
    expect(await cApi.facts.count({memorySpaceId:space,tags:["task17","tag"],tagMatch:"all",confidence:75,metadata:{owner:"task17"}})).toBe(1);
    const after=await caseRows(c);expect(after.filter(r=>r.tenantId!==tenant(s)).map(digest)).toEqual(foreign);
    record(`collision-${c}-${s}`,{selectedPhysicalIds:selected.map(r=>r._id),foreignPreserved:foreign.length,profileVersions:3});
   }
  }
  await seed("foreign","B");
  for(const scope of ["A","none"]){const client=api(scope);expect(await client.memorySpaces.get(`${prefix}-foreign`)).toBeNull();expect(await client.users.get(`${prefix}-foreign-user`)).toBeNull();expect(await client.users.getHistory(`${prefix}-foreign-user`)).toEqual([]);await expectedError(client.memorySpaces.update(`${prefix}-foreign`,{name:"no"}),"MEMORYSPACE_NOT_FOUND");}
  record("foreign-only-missing");
  const empty=await api("A").memorySpaces.register({memorySpaceId:`${prefix}-empty`,type:"team"});ledger.push({case:"empty",scope:"A",batch:0,ids:[empty._id]});save();
  expect((await api("A").memorySpaces.getStats(`${prefix}-empty`)).storage).toEqual({conversationsBytes:0,memoriesBytes:0,factsBytes:0,totalBytes:0});record("empty-stats-zero");
  for(const s of scopes){await seed("duplicate",s,0);await seed("duplicate",s,1);const cApi=api(s);const before=(await caseRows("duplicate")).map(digest);
   const attempts=[()=>cApi.memorySpaces.get(`${prefix}-duplicate`),()=>cApi.memorySpaces.register({memorySpaceId:`${prefix}-duplicate`,type:"team"}),()=>cApi.memorySpaces.update(`${prefix}-duplicate`,{name:"no"}),()=>cApi.memorySpaces.addParticipant(`${prefix}-duplicate`,{id:"no",type:"tool",joinedAt:1}),()=>cApi.memorySpaces.removeParticipant(`${prefix}-duplicate`,"participant"),()=>cApi.memorySpaces.updateParticipants(`${prefix}-duplicate`,{remove:["participant"]}),()=>cApi.memorySpaces.archive(`${prefix}-duplicate`),()=>cApi.memorySpaces.reactivate(`${prefix}-duplicate`),()=>cApi.memorySpaces.getStats(`${prefix}-duplicate`),()=>cApi.memorySpaces.delete(`${prefix}-duplicate`,{erasureTransport,cascade:true,reason:"owned"}),()=>cApi.users.get(`${prefix}-duplicate-user`),()=>cApi.users.update(`${prefix}-duplicate-user`,{no:true}),()=>cApi.users.getHistory(`${prefix}-duplicate-user`),()=>cApi.users.delete(`${prefix}-duplicate-user`)];
   for(const [index,invoke] of attempts.entries())await expectedError(invoke(),index===9?"ERASURE_NATIVE_REFUSAL":"DOMAIN_SCOPE_AMBIGUOUS");await expectedError(admin.function("domainErasure:discoverPage",undefined,{domain:{kind:"space",tenantId:tenant(s),memorySpaceId:`${prefix}-duplicate`},table:"memorySpaces",cursor:null,numItems:1}),"DOMAIN_SCOPE_AMBIGUOUS");expect((await caseRows("duplicate")).map(digest)).toEqual(before);record(`ambiguity-${s}`,{refusals:attempts.length,physicalRowsPreserved:before.length});
  }
  for(const s of scopes)await seed("stats",s);
  for(const s of scopes){const cApi=api(s);const all=await caseRows("stats");const selected=all.filter(r=>r.tenantId===tenant(s));const conversations=selected.filter(r=>"conversationId" in r);const memories=selected.filter(r=>"memoryId" in r);const facts=selected.filter(r=>"factId" in r);
   const stats=await cApi.memorySpaces.getStats(`${prefix}-stats`,{includeParticipants:true,timeWindow:"all"});expect(stats.storage).toEqual({conversationsBytes:bytes(conversations),memoriesBytes:bytes(memories),factsBytes:bytes(facts),totalBytes:bytes([...conversations,...memories,...facts])});expect(stats.storage.totalBytes).toBeGreaterThan(0);expect(stats.storageMeasurement).toBe("convex-json-utf8-estimate");expect(stats).toMatchObject({totalMemories:1,totalConversations:1,totalFacts:1,totalMessages:1,memoriesThisWindow:1,conversationsThisWindow:1,topTags:["task17","tag"],importanceBreakdown:{critical:1,high:0,medium:0,low:0,trivial:0}});expect(stats.participants?.[0]).toMatchObject({participantId:"participant",memoriesStored:1,conversationsStored:1,factsExtracted:1,avgImportance:95});record(`stats-${s}`,{storage:stats.storage,systemFieldsAndSpecialValues:true});
  }
  // Supported SDK erasure proves the small selected domain before unrelated
  // >1000 count data would exhaust the current bounded root preflight.
  for(const s of scopes)await seed("delete",s);
  const deletion=api("A");const before=await caseRows("delete");const foreign=before.filter(r=>r.tenantId!==tenant("A")||r.type==="user"||r.type==="audit"||r.memorySpaceId===`${prefix}-delete-other`).map(digest);
  await expectedError(deletion.memorySpaces.delete(`${prefix}-delete`,{erasureTransport,cascade:true,reason:"owned",confirmId:"other"}));
  expect((await caseRows("delete")).map(digest)).toEqual(before.map(digest));const result=await deletion.memorySpaces.delete(`${prefix}-delete`,{erasureTransport,cascade:true,reason:"owned",confirmId:`${prefix}-delete`});expect(result.cascade).toMatchObject({conversationsDeleted:1,memoriesDeleted:1,factsDeleted:1});expect(result.erasure?.perTable.contexts.deleted).toBe(1);const after=(await caseRows("delete")).filter(Boolean);expect(after.map(digest)).toEqual(foreign);record("supported-current-domain-delete",{deleted:5,preserved:foreign.length,fullErasureClaim:false});
  const countBaselines=new Map<string,{spaces:number;profiles:number[]}>();
  const profileFilters=[{createdAfter:0,createdBefore:2,updatedAfter:0.5,updatedBefore:2.5},{createdAfter:0.5},{createdBefore:0},{updatedAfter:1000.5},{createdAfter:500,createdBefore:501},{updatedAfter:0.25,updatedBefore:1.25}];
  for(const s of scopes){const cApi=api(s);countBaselines.set(s,{spaces:await cApi.memorySpaces.count({type:"custom"}),profiles:await Promise.all([{createdBefore:1001},...profileFilters.map(filter=>({...filter,createdBefore:filter.createdBefore??1001}))].map(filter=>cApi.users.count(filter)))});}
  for(const s of scopes){for(let batch=0;batch<334;batch++)await seed("count",s,batch);record(`seed-1001-${s}`,{physicalRows:5005,maxRowsPerMutation:15});}
  for(const s of scopes){const cApi=api(s);const all=(await caseRows("count")).filter(r=>r.tenantId===tenant(s));expect(all).toHaveLength(5005);
   expect(await cApi.memorySpaces.count({type:"custom"})).toBe(countBaselines.get(s)!.spaces+1001);expect(await cApi.vector.count({memorySpaceId:`${prefix}-count`,participantId:"count-participant",userId:`${prefix}-count-user`,sourceType:"system"})).toBe(1001);expect(await cApi.memory.count({memorySpaceId:`${prefix}-count`,participantId:"count-participant"})).toBe(1001);expect(await cApi.conversations.count({memorySpaceId:`${prefix}-count`,userId:`${prefix}-count-user`,type:"user-agent"})).toBe(1001);expect(await cApi.facts.count({memorySpaceId:`${prefix}-count`,participantId:"count-participant",sourceType:"manual",factType:"knowledge",tags:["tag","task17"],tagMatch:"all",minConfidence:70})).toBe(1001);
   expect(await cApi.users.count({createdBefore:1001})).toBe(countBaselines.get(s)!.profiles[0]+1001);const profileRows=all.filter(r=>r.type==="user");
   for(const [filterIndex,filter] of profileFilters.entries()){const expected=profileRows.filter(r=>Object.entries(filter).every(([field,value])=>field.endsWith("After")?r[field.startsWith("created")?"createdAt":"updatedAt"]>value:r[field.startsWith("created")?"createdAt":"updatedAt"]<value)).length;expect(await cApi.users.count({...filter,createdBefore:(filter as any).createdBefore??1001})).toBe(countBaselines.get(s)!.profiles[filterIndex+1]+expected);}
   expect(await cApi.vector.count({memorySpaceId:`${prefix}-count`,participantId:"other"})).toBe(0);expect(await cApi.conversations.count({memorySpaceId:"other"})).toBe(0);expect(await cApi.facts.count({memorySpaceId:`${prefix}-count`,tags:["absent"]})).toBe(0);record(`count-1001-${s}`,{counts:{spaces:1001,memories:1001,conversations:1001,facts:1001,profiles:1001},physicalProfiles:profileRows.length,dateOracle:"independent-fixed-physical-ID-full-documents"});
  }
  for(const s of scopes){const cApi=api(s);const user=`${prefix}-first-user`;const profileBefore=(await caseRows("first")).filter(Boolean);const dry=await cApi.users.delete(user,{dryRun:true});expect(dry.verification).toMatchObject({scope:"user-profile",complete:false});expect((await caseRows("first")).filter(Boolean).map(digest)).toEqual(profileBefore.map(digest));const result=await cApi.users.delete(user);expect(result.verification).toMatchObject({scope:"user-profile",complete:true});expect(await cApi.users.get(user)).toBeNull();const after=await caseRows("first");const removed=profileBefore.find(r=>r.tenantId===tenant(s)&&r.type==="user")._id;expect(after.filter(Boolean).map(digest)).toEqual(profileBefore.filter(r=>r._id!==removed).map(digest));record(`profile-only-delete-${s}`,{deleted:1,preserved:after.filter(Boolean).length});}
  for(const name of ["memories:count","conversations:count","facts:count","memorySpaces:count","immutable:count"]){await expectedError(admin.query(ref(name),{tenantId:null,...(name.startsWith("memories")||name.startsWith("facts")?{memorySpaceId:`${prefix}-count`}:{})}));}
  await expectedError(admin.query(ref("immutable:count"),{type:"user",filters:{}}));await expectedError(admin.query(ref("immutable:count"),{type:"user",limit:1}));record("native-validator-refusals",{unsupportedNullsAndUnknownFields:7});
  for(let batch=0;batch<40;batch++){if(ledger.some(row=>row.case==="rollback"&&row.batch===batch))continue;await seed("rollback","A",batch);await new Promise(resolve=>setTimeout(resolve,300));}
  const rollbackRows=await caseRows("rollback");expect(rollbackRows.filter(Boolean)).toHaveLength(42);const beforeHash=rollbackRows.map(digest);const countError=await expectedError(deletion.vector.count({memorySpaceId:`${prefix}-rollback`}));expect(countError).toMatch(/limit|many bytes|maximum/i);record("native-count-budget-error",{error:countError,countReported:null});
  const deleteError=await expectedError(admin.function("cliOperator/memorySpaces:deleteSpace",undefined,{tenantId:tenant("A"),memorySpaceId:`${prefix}-rollback`,cascade:true,reason:"owned late-failure"}));expect(deleteError).toMatch(/limit|many bytes|maximum/i);expect((await caseRows("rollback")).map(digest)).toEqual(beforeHash);record("native-late-delete-rollback",{error:deleteError,physicalRowsUnchanged:42,attemptedEarlierConversationDelete:true});
  for(const s of scopes)await seed("python",s);record("python-fixtures-ready");
 }catch(e){outcomes.push({name:"native-matrix",outcome:"FAIL",error:String(e).replaceAll(key,"[private]")});save();throw e;}
 finally{for(const c of clients){await c.shutdown();outcomes.push({name:"actual-client-shutdown",outcome:"PASS"});}save();}
},600000);

it("reconciles selected committed rows after an authoritative refused seed without replay", async () => {
 const ids = await seed("reconcile", "A", 0);
 const before = await rows(ids);
 await expect(admin.function("task17Fixture:seed",undefined,{prefix,case:"reconcile",scope:"A",batch:1,reject:true})).rejects.toThrow("FIXTURE_REJECTED_BEFORE_WRITE");
 expect((await rows(ids)).map(digest)).toEqual(before.map(digest));
 const observed = await admin.query(ref("memories:list"),{tenantId:tenant("A"),memorySpaceId:`${prefix}-reconcile`,limit:100}) as any[];
 const known = await caseRows("reconcile");
 expect(observed.every(row=>row.tenantId===tenant("A"))).toBe(true);
 expect(observed.map(row=>row._id).sort()).toEqual(known.filter(row=>row.memoryId).map(row=>row._id).sort());
 expect(observed.map(row=>row.createdAt).sort((a,b)=>a-b)).toEqual([10000,10001,10002,10003,10004,10005,10006]);
});

it("public TS search tolerates native Convex metadata in every selected scope",async()=>{
 try {for(const scope of scopes){if(!ledger.some(row=>row.case==="stats"&&row.scope===scope))await seed("stats",scope);if(!ledger.some(row=>row.case==="python"&&row.scope===scope))await seed("python",scope);}const before=(await caseRows("stats")).map(digest);
  for(const scope of scopes){const cApi=api(scope);
   expect((await cApi.memorySpaces.search(`${prefix}-python`)).map(row=>row.memorySpaceId)).toEqual([`${prefix}-python`]);
   expect((await cApi.memorySpaces.search(`é🌱${prefix}`)).map(row=>row.memorySpaceId)).toEqual([`${prefix}-stats`]);
   expect(await cApi.memorySpaces.search("unmatched-search-text")).toEqual([]);
   record(`native-official-metadata-search-${scope}`,{queryKinds:3,scope:tenant(scope)??"tenantless"});
  }expect((await caseRows("stats")).map(digest)).toEqual(before);record("search-physical-preservation",{knownDocuments:before.length});
 }finally{for(const c of clients){await c.shutdown();outcomes.push({name:"actual-client-shutdown",outcome:"PASS"});}save();}
},30000);
