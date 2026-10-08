import { convexToJson } from "convex/values";
import * as spaces from "../../convex-dev/memorySpaces";
import * as immutable from "../../convex-dev/immutable";
import * as memories from "../../convex-dev/memories";
import * as conversations from "../../convex-dev/conversations";
import * as facts from "../../convex-dev/facts";
import { ownership, naturalIdentity, referenceDigest, WRITER_MANIFEST_HASH } from "../../convex-dev/lib/referenceLifecycle";
const scopes=["A","B",undefined];
const byteSize=(rows:any[])=>rows.reduce((n,row)=>n+Buffer.byteLength(JSON.stringify(convexToJson(row)),"utf8"),0);
function dbFixture(tables:Record<string,any[]>) {
 const generation="unit-prepared-generation";
 const primary = Object.entries(tables).flatMap(([table,rows])=>rows.map(row=>({table,row})));
 tables.cortexReferenceState=[{_id:"cortexReferenceState-fixed",_creationTime:0,key:"reference-lifecycle-v1",kind:"control",generation,writerManifestHash:WRITER_MANIFEST_HASH,status:"ready",unresolvedCount:0,legacyUnknownCount:0,missingOrAmbiguousCount:0}];
 tables.cortexReferenceTargets=primary.map(({table,row},i)=>({_id:`cortexReferenceTargets-fixture-${i}`,_creationTime:0,key:`document:${table}:${row._id}`,kind:"document",lifecycleVersion:1,generation,preparedGeneration:generation,revision:1,state:"live",table,documentId:row._id,scopeKnown:true,...ownership(table as never,row),naturalKeyDigest:naturalIdentity(table as never,row),ownershipRevision:1,referenceDigest:referenceDigest(table as never,row),incomingCount:0,outgoingCount:0}));
 tables.cortexReferenceEdges=[];
 const events:any[]=[];const derivedEvents:any[]=[];
 const record=(event:any)=>{(String(event.table??event.id).startsWith("cortexReference")?derivedEvents:events).push(event);};
 const reads:any[]=[];let failCollect=false;let seq=0;
 const all=()=>Object.values(tables).flat();
 const db:any={
  normalizeId:(table:string,id:string)=>id.startsWith(table+"-")?id:null,
  query:(table:string)=>{
   const predicates:((row:any)=>boolean)[]=[];
   const index={eq:(key:string,value:any)=>{predicates.push(row=>row[key]===value);reads.push({table,key,value});return index;}};
   const query={withIndex:(_name:string,fn:any)=>{fn(index);return query;},collect:async()=>{if(failCollect)throw new Error("native-budget");return (tables[table] ?? []).filter(row=>predicates.every(fn=>fn(row)));},take:async(n:number)=>(await query.collect()).slice(0,n),first:async()=>(await query.collect())[0]??null};return query;
  },
  get:async(id:string)=>all().find(row=>row._id===id)??null,
  patch:async(id:string,data:any)=>{record({op:"patch",id});const row=all().find(row=>row._id===id);Object.assign(row,data);},
  delete:async(id:string)=>{record({op:"delete",id});for(const t of Object.keys(tables))tables[t]=tables[t].filter(r=>r._id!==id);},
  insert:async(table:string,data:any)=>{const row={...data,_id:`${table}-new-${++seq}`,_creationTime:42};record({op:"insert",table,id:row._id});(tables[table] ??= []).push(row);return row._id;},
 };
 return {ctx:{db,meta:{getTransactionMetrics:async()=>({documentsRead:{used:0,remaining:100000},bytesRead:{used:0,remaining:16*1024*1024},bytesWritten:{used:0,remaining:16*1024*1024},documentsWritten:{used:0,remaining:100000}})}},events,derivedEvents,reads,tables,fail:()=>{failCollect=true;}};
}
async function invoke(reg:any,f:ReturnType<typeof dbFixture>,args:any){return reg._handler(f.ctx,args);}
function doc(table:string,tenantId:string|undefined,extra:any={}){
 return {_id:`${table}-${tenantId??"none"}`, _creationTime:1, tenantId,createdAt:10,updatedAt:20,...extra};
}
function triplets(order:(string|undefined)[]=scopes) {
 const tables:any={memorySpaces:[],immutable:[],conversations:[],memories:[],facts:[]};
 for(const tenant of order){
  tables.memorySpaces.push(doc("memorySpaces",tenant,{memorySpaceId:"same",type:"team",status:"active",name:`space-${tenant??"none"}`,participants:[{id:"p",type:"tool",joinedAt:2}],metadata:{}}));
  tables.immutable.push(doc("immutable",tenant,{type:"user",id:"same",data:{tenant:tenant??"none"},version:2,previousVersions:[{version:1,data:{old:tenant??"none"},timestamp:10}]}));
  tables.conversations.push(doc("conversations",tenant,{conversationId:"same",memorySpaceId:"same",type:"user-agent",participants:{userId:"u"},participantId:"p",messages:[],messageCount:tenant==="B"?99:2,metadata:{unicode:"é🌱",big:2n,bytes:new Uint8Array([1,2]).buffer,nan:NaN,inf:Infinity}}));
  tables.memories.push(doc("memories",tenant,{memoryId:"same",memorySpaceId:"same",participantId:"p",userId:"u",sourceType:"system",content:"é🌱",importance:tenant==="B"?1:95,tags:[tenant??"none"],previousVersions:[]}));
  tables.facts.push(doc("facts",tenant,{factId:"same",memorySpaceId:"same",userId:"u",participantId:"p",factType:"knowledge",subject:"s",predicate:"p",object:"o",confidence:75,sourceType:"manual",tags:["one","two"],metadata:{x:"é"},version:1}));
 }
 return dbFixture(tables);
}
for(const order of [scopes,[undefined,"B","A"]]) for(const tenant of scopes) describe(`actual handlers ${order.join('/')} selected ${tenant??"tenantless"}`,()=>{
 it("get/profile/history choose exact colliding row and registration refuses only selected duplicate",async()=>{
  const f=triplets(order);expect((await invoke(spaces.get,f,{memorySpaceId:"same",tenantId:tenant}))._id).toBe(`memorySpaces-${tenant??"none"}`);
  expect((await invoke(immutable.get,f,{type:"user",id:"same",tenantId:tenant}))._id).toBe(`immutable-${tenant??"none"}`);
  expect((await invoke(immutable.getHistory,f,{type:"user",id:"same",tenantId:tenant})).map((v:any)=>v.data)).toEqual([{old:tenant??"none"},{tenant:tenant??"none"}]);
  await expect(invoke(spaces.register,f,{memorySpaceId:"same",type:"team",tenantId:tenant})).rejects.toThrow("MEMORYSPACE_ALREADY_EXISTS");expect(f.events).toHaveLength(0);expect(f.derivedEvents).toHaveLength(0);
 });
 it("lifecycle and participant mutations affect only selected physical row",async()=>{
  const f=triplets(order);const foreign=f.tables.memorySpaces.filter((r:any)=>r.tenantId!==tenant).map((r:any)=>structuredClone(r));
  for(const [reg,args] of [[spaces.update,{name:"updated",metadata:{tag:"kept"}}],[spaces.addParticipant,{participant:{id:"new",type:"tool",joinedAt:3}}],[spaces.removeParticipant,{participantId:"p"}],[spaces.updateParticipants,{add:[{id:"third",type:"agent",joinedAt:4}],remove:["new"]}],[spaces.archive,{reason:"owned"}],[spaces.reactivate,{}]] as any){await invoke(reg,f,{memorySpaceId:"same",tenantId:tenant,...args});}
  expect(f.events.map(e=>e.id)).toEqual(Array(6).fill(`memorySpaces-${tenant??"none"}`));expect(f.tables.memorySpaces.filter((r:any)=>r.tenantId!==tenant)).toEqual(foreign);
  const row=f.tables.memorySpaces.find((r:any)=>r.tenantId===tenant);expect(row.participants).toEqual([{id:"third",type:"agent",joinedAt:4}]);expect(row.status).toBe("active");expect(row.name).toBe("updated");
 });
 it("list/search/find/count filter scope before aggregation or limit",async()=>{
  const f=triplets(order);for(const result of [(await invoke(spaces.list,f,{tenantId:tenant})).spaces,await invoke(spaces.search,f,{tenantId:tenant,query:"space",limit:1}),await invoke(spaces.findByParticipant,f,{tenantId:tenant,participantId:"p"})])expect(result.map((r:any)=>r.tenantId)).toEqual([tenant]);
  expect(await invoke(spaces.count,f,{tenantId:tenant,type:"team",status:"active"})).toBe(1);
  expect((await invoke(immutable.list,f,{tenantId:tenant,type:"user"})).entries.map((r:any)=>r.tenantId)).toEqual([tenant]);
 });
 it("stats use scoped full native values including system fields and retained superseded fact bytes",async()=>{
  const f=triplets(order);const old={...f.tables.facts.find((r:any)=>r.tenantId===tenant),_id:"old",factId:"old",supersededBy:"same"};f.tables.facts.push(old);
  const selected=(table:string)=>f.tables[table].filter((r:any)=>r.tenantId===tenant);const result=await invoke(spaces.getStats,f,{tenantId:tenant,memorySpaceId:"same",includeParticipants:true,timeWindow:"all"});
  expect(result.storage).toEqual({conversationsBytes:byteSize(selected("conversations")),memoriesBytes:byteSize(selected("memories")),factsBytes:byteSize(selected("facts")),totalBytes:byteSize([...selected("conversations"),...selected("memories"),...selected("facts")])});
  expect(result.storageMeasurement).toBe("convex-json-utf8-estimate");expect(result.totalFacts).toBe(1);expect(result.totalMemories).toBe(1);expect(result.totalMessages).toBe(tenant==="B"?99:2);expect(result.topTags).toEqual([tenant??"none"]);expect(result.participants[0]).toMatchObject({participantId:"p",memoriesStored:1,conversationsStored:1,factsExtracted:1});
 });
 it("profile store retains selected history, purge leaves all foreign rows and nonprofiles",async()=>{
  const f=triplets(order);f.tables.immutable.push(doc("spoof",tenant,{type:"audit",id:"same",userId:"same",data:{keep:true},version:1,previousVersions:[]}));const foreign=f.tables.immutable.filter((r:any)=>r.type!=="user"||r.tenantId!==tenant).map((r:any)=>structuredClone(r));
  const updated=await invoke(immutable.store,f,{tenantId:tenant,type:"user",id:"same",data:{new:true}});expect(updated.version).toBe(3);expect(updated.previousVersions).toHaveLength(2);
  await invoke(immutable.purge,f,{tenantId:tenant,type:"user",id:"same"});expect(f.tables.immutable).toEqual(foreign);
 });
 it("space transaction deletes only exact linked three domains, preserving foreign and same-tenant other-space",async()=>{
  const f=triplets(order);for(const table of ["conversations","memories","facts"]){f.tables[table].push({...f.tables[table][0],_id:table+"-other",tenantId:tenant,memorySpaceId:"other"});}
  const before=Object.fromEntries(Object.entries(f.tables).map(([t,rows])=>[t,structuredClone(rows)]));const result=await invoke(spaces.deleteSpace,f,{tenantId:tenant,memorySpaceId:"same",cascade:true,reason:"owned",confirmId:"same"});expect(result.cascade).toMatchObject({conversationsDeleted:1,memoriesDeleted:1,factsDeleted:1});
  for(const table of ["memorySpaces","conversations","memories","facts"]){expect(f.tables[table]).toEqual((before[table] as any[]).filter(r=>!(r.tenantId===tenant&&r.memorySpaceId==="same")));}expect(f.tables.immutable).toEqual(before.immutable);
 });
});
for(const tenant of scopes) it(`duplicate ${tenant??"tenantless"} ambiguity rejects every selected single-row effect`,async()=>{
 const f=triplets();for(const t of ["memorySpaces","immutable"])f.tables[t].push({...f.tables[t].find((r:any)=>r.tenantId===tenant),_id:t+"-duplicate"});
 for(const [reg,args] of [[spaces.get,{}],[spaces.register,{type:"team"}],[spaces.update,{name:"new"}],[spaces.addParticipant,{participant:{id:"x",type:"tool",joinedAt:1}}],[spaces.removeParticipant,{participantId:"p"}],[spaces.updateParticipants,{remove:["p"]}],[spaces.archive,{}],[spaces.reactivate,{}],[spaces.getStats,{}],[spaces.deleteSpace,{cascade:true,reason:"owned"}]] as any)await expect(invoke(reg,f,{tenantId:tenant,memorySpaceId:"same",...args})).rejects.toThrow("DOMAIN_SCOPE_AMBIGUOUS");
 for(const [reg,args] of [[immutable.get,{}],[immutable.getHistory,{}],[immutable.store,{data:{x:1}}],[immutable.purge,{}]] as any)await expect(invoke(reg,f,{tenantId:tenant,type:"user",id:"same",...args})).rejects.toThrow("DOMAIN_SCOPE_AMBIGUOUS");expect(f.events).toHaveLength(0);expect(f.derivedEvents).toHaveLength(0);
});
it("foreign-only rows are missing, with no tenantless fallback",async()=>{const f=triplets(["B"]);expect(await invoke(spaces.get,f,{memorySpaceId:"same",tenantId:"A"})).toBeNull();expect(await invoke(immutable.get,f,{type:"user",id:"same"})).toBeNull();expect(await invoke(immutable.getHistory,f,{type:"user",id:"same"})).toEqual([]);await expect(invoke(spaces.update,f,{memorySpaceId:"same",tenantId:"A"})).rejects.toThrow("MEMORYSPACE_NOT_FOUND");expect(f.events).toHaveLength(0);expect(f.derivedEvents).toHaveLength(0);});
for(const scope of ["", " ", null]) it(`malformed scope ${String(scope)} rejects before DB`,async()=>{const f=triplets();for(const reg of [spaces.count,spaces.get,spaces.list,spaces.getStats,immutable.get,immutable.list,immutable.count,memories.count,conversations.count,facts.count])await expect(invoke(reg,f,{tenantId:scope,memorySpaceId:"same",type:"user",id:"same"})).rejects.toThrow("INVALID_TENANT_ID");expect(f.reads).toHaveLength(0);expect(f.events).toHaveLength(0);expect(f.derivedEvents).toHaveLength(0);});
it("exact >1000 counts retain all existing filters, physical duplicates and inline history does not inflate",async()=>{
 const f=triplets();for(const t of Object.keys(f.tables)){const base=f.tables[t].find((r:any)=>r.tenantId==="A");f.tables[t]=Array.from({length:1001},(_,i)=>({...base,_id:t+"-"+i,createdAt:i,updatedAt:i+0.5})).concat(f.tables[t].filter((r:any)=>r.tenantId!=="A"));}
 expect(await invoke(spaces.count,f,{tenantId:"A"})).toBe(1001);expect(await invoke(immutable.count,f,{tenantId:"A",type:"user"})).toBe(1001);
 expect(await invoke(immutable.count,f,{tenantId:"A",type:"user",createdAfter:0,createdBefore:2,updatedAfter:0.5,updatedBefore:2.5})).toBe(1);
 expect(await invoke(memories.count,f,{tenantId:"A",memorySpaceId:"same",userId:"u",participantId:"p",sourceType:"system"})).toBe(1001);
 expect(await invoke(memories.count,f,{tenantId:"A",memorySpaceId:"same",participantId:"foreign"})).toBe(0);
 expect(await invoke(conversations.count,f,{tenantId:"A",memorySpaceId:"same",type:"user-agent",userId:"u"})).toBe(1001);
 expect(await invoke(facts.count,f,{tenantId:"A",memorySpaceId:"same",factType:"knowledge",subject:"s",predicate:"p",object:"o",confidence:75,minConfidence:70,userId:"u",participantId:"p",tags:["one","two"],tagMatch:"all",sourceType:"manual",version:1,metadata:{x:"é"}})).toBe(1001);
 expect(await invoke(facts.count,f,{tenantId:"A",memorySpaceId:"same",tags:["none"],tagMatch:"any"})).toBe(0);
});
it("empty stats and native collection failures remain genuine zero/error",async()=>{const f=triplets();f.tables.conversations=[];f.tables.memories=[];f.tables.facts=[];expect((await invoke(spaces.getStats,f,{tenantId:"A",memorySpaceId:"same"})).storage).toEqual({conversationsBytes:0,memoriesBytes:0,factsBytes:0,totalBytes:0});f.fail();for(const reg of [spaces.count,immutable.count,memories.count,conversations.count,facts.count])await expect(invoke(reg,f,{tenantId:"A",memorySpaceId:"same"})).rejects.toThrow("native-budget");});
for(const args of [{cascade:false,reason:"owned"},{cascade:true,reason:""},{cascade:true,reason:"owned",confirmId:"other"}])it("space refusal has zero effects",async()=>{const f=triplets();await expect(invoke(spaces.deleteSpace,f,{tenantId:"A",memorySpaceId:"same",...args})).rejects.toThrow();expect(f.events).toHaveLength(0);expect(f.derivedEvents).toHaveLength(0);});

for (const tenantId of scopes) it(`search handles every supported Convex metadata value in ${tenantId ?? "tenantless"} scope`,async()=>{
 const f=triplets();for(const row of f.tables.memorySpaces)row.metadata={unicode:"é🌱",big:42n,bytes:new Uint8Array([0,255]).buffer,nan:NaN,inf:Infinity};
 expect((await invoke(spaces.search,f,{tenantId,query:"é🌱"})).map((row:any)=>row.tenantId)).toEqual([tenantId]);
 expect(await invoke(spaces.search,f,{tenantId,query:"absent-metadata-text"})).toEqual([]);
 expect(f.events).toHaveLength(0);expect(f.derivedEvents).toHaveLength(0);
});
