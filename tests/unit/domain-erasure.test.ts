import type { ConvexClient } from "convex/browser";
import { digest } from "../../convex-dev/lib/factHistoryProvenance";
import { orderErasure, assertErasureTransport, prepareErasure, executeErasure, discoverErasure, ERASURE_OPERATIONS, ERASURE_TABLES, ErasureTransportError, type ErasureProjection, type ErasureTransport, type ErasureOutcome } from "../../src/users/erasure";
const domain={kind:"user" as const,userId:"u",tenantId:"A"};
const node=(id:string,table="memories",action="delete",dependencies:ErasureProjection["dependencies"]=[]):ErasureProjection=>({id,table:table as ErasureProjection["table"],action:action as ErasureProjection["action"],fingerprint:digest({id}),dependencies,retainedVersions:2,messages:0,serializedBytes:128,storageIds:[]});
function fixture(records:ErasureProjection[]) {
  const live=new Map(records.map(row=>[row.id,row])),commits:ErasureOutcome[]=[],sent:string[]=[];let mode="normal";
  const envelope={protocolVersion:1 as const,domain,observationTime:1};
  const transport:ErasureTransport={kind:"cortex-erasure-v1",protocolVersion:1,operations:ERASURE_OPERATIONS,close:()=>{},
    discoverPage:async(r)=>({...envelope,table:r.table as string,page:[...live.values()].filter(row=>row.table===r.table),isDone:true,continueCursor:"done"}),
    verifyPage:async(r)=>transport.discoverPage(r),
    checkRecord:async(r)=>({...envelope,record:live.get(r.id as string)??null}),
    checkBinaryReferences:async()=>({...envelope,blobs:[]}),
    getReceiptPage:async()=>({...envelope,page:mode==="unknownAbsent"?[]:commits,isDone:true,continueCursor:"done"}),
    eraseRecord:async(r)=>{
      sent.push(r.id as string);
      const outcome:ErasureOutcome={...envelope,operationId:r.operationId as string,itemKey:r.itemKey as string,table:r.table as string,id:r.id as string,state:"committed",deleted:1,detached:0,retainedVersions:2,messages:3,blobs:[],graphJobs:[]};
      if(mode==="badCounts")outcome.deleted=2;
      if(mode==="rollback")throw new ErasureTransportError("ERASURE_SELECTION_CHANGED","eraseRecord","rolledBack");
      live.delete(outcome.id);commits.push(outcome);
      if(mode.startsWith("unknown"))throw new ErasureTransportError("ERASURE_RESPONSE_UNKNOWN","eraseRecord","unknown");
      return outcome;
    },purgeExpiredReceiptsPage:async()=>({protocolVersion:1,deleted:0,isDone:true,continueCursor:"done"})};
  return {transport,live,sent,commits,setMode:(value:string)=>{mode=value;}};
}
test("consumer-before-source with root and detachments last",()=>{
  const c=node("C","conversations"),m=node("M","memories","delete",[{id:"C",kind:"hard"}]),f=node("F","facts","delete",[{id:"M",kind:"hard"}]),root=node("R","immutable","root"),detach=node("D","memorySpaces","detach");
  expect(orderErasure([root,c,m,detach,f]).map(row=>row.id)).toEqual(["F","M","C","D","R"]);
});
test("hard cycle refuses before any effect",()=>expect(()=>orderErasure([node("M","memories","delete",[{id:"F",kind:"hard"}]),node("F","facts","delete",[{id:"M",kind:"hard"}])])).toThrow("ERASURE_DEPENDENCY_CYCLE"));
test("discovery and verification request the existing native 128-row bound without mutation",async()=>{
  const f=fixture([node("selected")]),read=f.transport.discoverPage,requests:Record<string,unknown>[]=[];
  f.transport.discoverPage=async r=>{requests.push(r);return read(r);};
  expect((await discoverErasure(domain,f.transport,{})).map(row=>row.id)).toEqual(["selected"]);
  expect((await discoverErasure(domain,f.transport,{},true)).map(row=>row.id)).toEqual(["selected"]);
  expect(requests).toHaveLength(2*ERASURE_TABLES.length);
  expect(requests.every(request=>request.numItems===128)).toBe(true);
  expect(f.sent).toEqual([]);
});
test("split provisional data is discarded while exact left/right and sparse original tail exhaust",async()=>{
  const f=fixture([]),base=f.transport.discoverPage,ranges:unknown[]=[];
  f.transport.discoverPage=async(r)=>{if(r.table!=="memories")return base(r);ranges.push([r.cursor,r.endCursor]);const page={protocolVersion:1 as const,domain,table:"memories",observationTime:1};if(r.cursor===null&&r.endCursor===null)return {...page,page:[node("poison")],pageStatus:"SplitRequired",splitCursor:"middle",continueCursor:"tail",isDone:false};if(r.cursor===null)return {...page,page:[node("left")],continueCursor:"middle",isDone:true};if(r.cursor==="middle")return {...page,page:[node("right")],continueCursor:"tail",isDone:true};if(r.cursor==="tail")return {...page,page:[],continueCursor:"sparse",isDone:false};return {...page,page:[node("last")],continueCursor:"done",isDone:true};};
  expect((await discoverErasure(domain,f.transport,{})).map(r=>r.id)).toEqual(["left","right","last"]);expect(ranges).toEqual([[null,null],[null,"middle"],["middle","tail"],["tail",null],["sparse",null]]);expect(f.sent).toEqual([]);
});
test("nonprogress and contradictory repeated physical fingerprints refuse before effects",async()=>{
  const f=fixture([]),base=f.transport.discoverPage;let iteration=0;
  f.transport.discoverPage=async(r)=>r.table!=="memories"?base(r):({protocolVersion:1,domain,table:"memories",observationTime:1,page:[],continueCursor:"same",isDone:false});
  await expect(discoverErasure(domain,f.transport,{})).rejects.toThrow("ERASURE_PAGE_NONPROGRESS");
  f.transport.discoverPage=async(r)=>r.table!=="memories"?base(r):({protocolVersion:1,domain,table:"memories",observationTime:1,page:[{...node("same"),fingerprint:String(iteration++)}],continueCursor:"next",isDone:iteration===2});
  await expect(discoverErasure(domain,f.transport,{})).rejects.toThrow("ERASURE_SELECTION_CHANGED");expect(f.sent).toEqual([]);
});
test("bounded split ranges stop at their exact end even while the native table has more rows",async()=>{
  const f=fixture([]),base=f.transport.discoverPage,ranges:unknown[]=[];
  f.transport.discoverPage=async r=>{
    if(r.table!=="memories")return base(r);
    ranges.push([r.cursor,r.endCursor]);
    const page={protocolVersion:1 as const,domain,table:"memories",observationTime:1};
    if(r.cursor===null&&r.endCursor===null)return {...page,page:[node("provisional")],pageStatus:"SplitRecommended",splitCursor:"middle",continueCursor:"tail",isDone:false};
    if(r.cursor===null)return {...page,page:[node("left")],continueCursor:"middle",isDone:false};
    if(r.cursor==="middle")return {...page,page:[node("right")],continueCursor:"tail",isDone:false};
    if(r.cursor==="tail")return {...page,page:[],continueCursor:"sparse",isDone:false};
    return {...page,page:[node("last")],continueCursor:"done",isDone:true};
  };
  expect((await discoverErasure(domain,f.transport,{})).map(row=>row.id)).toEqual(["left","right","last"]);
  expect(ranges).toEqual([[null,null],[null,"middle"],["middle","tail"],["tail",null],["sparse",null]]);
  expect(f.sent).toEqual([]);
});
test.each([null,"","tail"])("malformed split cursor %p refuses without accepting provisional data or effects",async splitCursor=>{
  const f=fixture([]),base=f.transport.discoverPage;
  f.transport.discoverPage=async r=>r.table!=="memories"?base(r):({protocolVersion:1,domain,table:"memories",observationTime:1,page:[node("provisional")],pageStatus:"SplitRequired",splitCursor,continueCursor:"tail",isDone:false});
  await expect(discoverErasure(domain,f.transport,{})).rejects.toThrow("ERASURE_PAGE_NONPROGRESS");
  expect(f.sent).toEqual([]);
});
test("nested bounded split discards provisional data and never schedules an empty bounded tail",async()=>{
  const f=fixture([]),base=f.transport.discoverPage,ranges:unknown[]=[];
  f.transport.discoverPage=async r=>{
    if(r.table!=="memories")return base(r);
    ranges.push([r.cursor,r.endCursor]);
    const page={protocolVersion:1 as const,domain,table:"memories",observationTime:1};
    if(r.cursor===null&&r.endCursor===null)return {...page,page:[node("outer-provisional")],pageStatus:"SplitRequired",splitCursor:"middle",continueCursor:"tail",isDone:false};
    if(r.cursor===null&&r.endCursor==="middle")return {...page,page:[node("inner-provisional")],pageStatus:"SplitRecommended",splitCursor:"quarter",continueCursor:"middle",isDone:false};
    if(r.cursor===null)return {...page,page:[node("left")],continueCursor:"quarter",isDone:false};
    if(r.cursor==="quarter")return {...page,page:[node("right")],continueCursor:"middle",isDone:false};
    if(r.cursor===r.endCursor)return {...page,page:[],continueCursor:r.cursor as string,isDone:false};
    if(r.cursor==="middle")return {...page,page:[node("sibling")],continueCursor:"tail",isDone:false};
    return {...page,page:[node("last")],continueCursor:"done",isDone:true};
  };
  expect((await discoverErasure(domain,f.transport,{})).map(row=>row.id)).toEqual(["left","right","sibling","last"]);
  expect(ranges).toEqual([[null,null],[null,"middle"],[null,"quarter"],["quarter","middle"],["middle","tail"],["tail",null]]);
  expect(f.sent).toEqual([]);
});
test("server-proven pure data SCC has stable order",()=>expect(orderErasure([node("M","memories","delete",[{id:"F",kind:"data"}]),node("F","facts","delete",[{id:"M",kind:"data"}])]).map(row=>row.id)).toEqual(["M","F"]));
test("eleven-hop hard chain has no two-hop cutoff",()=>{const records=Array.from({length:12},(_,i)=>node(String(i),"memories","delete",i<11?[{id:String(i+1),kind:"hard"}]:[]));expect(orderErasure(records.reverse()).map(row=>row.id)).toEqual(Array.from({length:12},(_,i)=>String(i)));});
test("export transport cannot pass administrative capability validation",()=>expect(()=>assertErasureTransport({inspect:()=>{},page:()=>{}})).toThrow("ERASURE_ADMIN_TRANSPORT_REQUIRED"));
test("every named operation and close are mandatory",()=>{const f=fixture([]);for(const operation of [...ERASURE_OPERATIONS,"close"]){const partial={...f.transport,[operation]:undefined};expect(()=>assertErasureTransport(partial)).toThrow();}});
test("all seventeen tables discovered before first mutation",async()=>{const f=fixture([node("M")]),seen:string[]=[];const original=f.transport.discoverPage;f.transport.discoverPage=async(r)=>{seen.push(r.table as string);return original(r);};const prepared=await prepareErasure(domain,{erasureTransport:f.transport});expect(new Set(seen)).toEqual(new Set(ERASURE_TABLES));expect(f.sent).toEqual([]);await executeErasure(prepared,{} as ConvexClient);expect(f.sent).toEqual(["M"]);});
test("dry-run preserves state and never asserts verified completion",async()=>{const f=fixture([node("M")]);const prepared=await prepareErasure(domain,{erasureTransport:f.transport,dryRun:true});const result=await executeErasure(prepared,{} as ConvexClient);expect(f.live.size).toBe(1);expect(f.sent).toEqual([]);expect(result).toMatchObject({executed:false,complete:false,totalDeleted:0,verification:{state:"notExecuted",complete:false}});});
test("verify=false retains preflight and honest notRequested state",async()=>{const f=fixture([node("M")]),prepared=await prepareErasure(domain,{erasureTransport:f.transport,verify:false});const result=await executeErasure(prepared,{} as ConvexClient);expect(f.live.size).toBe(0);expect(result).toMatchObject({totalDeleted:1,complete:false,verification:{state:"notRequested",complete:false}});});
test("blocker produces zero mutations and includes bounded plan",async()=>{const f=fixture([{...node("X"),action:"block",reason:"shared"}]);await expect(prepareErasure(domain,{erasureTransport:f.transport})).rejects.toMatchObject({code:"ERASURE_PREFLIGHT_BLOCKED",receipt:{blockers:[{id:"X",reason:"shared"}],outcomes:[]}});expect(f.sent).toEqual([]);});
test("managed queue without graph participant refuses before mutation",async()=>{const f=fixture([{...node("M"),managedQueueCount:1}]);await expect(prepareErasure(domain,{erasureTransport:f.transport})).rejects.toMatchObject({code:"ERASURE_GRAPH_PARTICIPANT_REQUIRED"});expect(f.sent).toEqual([]);});
test("lost response reconciles original receipt with exactly one primary send",async()=>{const f=fixture([node("M")]);f.setMode("unknownCommitted");const prepared=await prepareErasure(domain,{erasureTransport:f.transport});const result=await executeErasure(prepared,{} as ConvexClient);expect(f.sent).toEqual(["M"]);expect(result.totalDeleted).toBe(1);expect(result.unknown).toEqual([]);expect(result.complete).toBe(true);});
test("lost response without receipt stays UNKNOWN without resend",async()=>{const f=fixture([node("M")]);f.setMode("unknownAbsent");const prepared=await prepareErasure(domain,{erasureTransport:f.transport});await expect(executeErasure(prepared,{} as ConvexClient)).rejects.toMatchObject({code:"ERASURE_OUTCOME_UNKNOWN",receipt:{complete:false,totalDeleted:0}});expect(f.sent).toEqual(["M"]);});
test("native rollback records zero commits and preserves row",async()=>{const f=fixture([node("M")]);f.setMode("rollback");const prepared=await prepareErasure(domain,{erasureTransport:f.transport});await expect(executeErasure(prepared,{} as ConvexClient)).rejects.toMatchObject({receipt:{totalDeleted:0,remaining:["M"],complete:false}});expect(f.live.size).toBe(1);expect(f.sent).toEqual(["M"]);});
test("invalid numeric outcome cannot inflate totals",async()=>{const f=fixture([node("M")]);f.setMode("badCounts");const prepared=await prepareErasure(domain,{erasureTransport:f.transport});await expect(executeErasure(prepared,{} as ConvexClient)).rejects.toMatchObject({code:"ERASURE_PROTOCOL",receipt:{totalDeleted:0}});});
test("cancellation before dispatch leaves every item unstarted",async()=>{const f=fixture([node("M")]),controller=new AbortController(),prepared=await prepareErasure(domain,{erasureTransport:f.transport,signal:controller.signal});controller.abort();await expect(executeErasure(prepared,{} as ConvexClient)).rejects.toMatchObject({code:"ERASURE_CANCELLED",receipt:{remaining:["M"],outcomes:[]}});expect(f.sent).toEqual([]);});
test("late new row prevents root removal",async()=>{const f=fixture([node("M"),node("R","immutable","root")]),original=f.transport.eraseRecord;f.transport.eraseRecord=async(r)=>{const result=await original(r);if(r.id==="M")f.live.set("new",node("new"));return result;};const prepared=await prepareErasure(domain,{erasureTransport:f.transport});await expect(executeErasure(prepared,{} as ConvexClient)).rejects.toMatchObject({code:"ERASURE_REMAINING_PRIMARY",receipt:{totalDeleted:1,remaining:["R"]}});expect(f.live.has("R")).toBe(true);expect(f.sent).toEqual(["M"]);});
