import { explicitErasureAction, erasureEdgeKind, validateErasureDomain, erasureTables, checkErasureIncoming } from "../../convex-dev/lib/domainErasureScope";
import type { QueryCtx } from "../../convex-dev/_generated/server";
import { sourceIdentity } from "../../convex-dev/lib/graphSync";
const user={kind:"user" as const,tenantId:"A",userId:"u"};
const space={kind:"space" as const,tenantId:"A",memorySpaceId:"s"};
describe("server-owned primary erasure disposition",()=>{
  test("live selected source job is allowed only in readonly preparation, never root mutation",async()=>{
    const live={_id:"old",tenantId:"A",memorySpaceId:"s",participants:{userIds:["u","other"]}},authority={_id:"old-target",table:"conversations",documentId:"old",state:"live",scopeKnown:true,tenantId:"A",memorySpaceId:"s",sourceRevision:1};
    const queue={_id:"job",schemaVersion:2,tenantKnown:true,tenantId:"A",memorySpaceId:"s",table:"conversations",physicalSourceId:"old",sourceRevision:1,state:"pending",entity:{copied:true},identity:sourceIdentity("conversations",live)};
    const run=(preflight:boolean,job=queue,source=live,proof=authority)=>{
      const ctx={db:{normalizeId:(_table:string,id:string)=>id,get:async(id:string)=>id==="queue-target"?{table:"graphSyncQueue",documentId:"job",state:"live"}:id==="job"?job:source,query:(table:string)=>({withIndex:(index:string,fn:(q:unknown)=>unknown)=>{const values:Record<string,unknown>={};const q={eq:(key:string,value:unknown)=>{values[key]=value;return q;}};fn(q);return {take:async()=>values.documentId==="old"?[proof]:[{_id:"root-target"}],collect:async()=>table==="cortexReferenceEdges"&&index==="by_target"?[{sourceTargetId:"queue-target",role:"space",kind:"physical"}]:[]};}})}} as unknown as QueryCtx;
      return checkErasureIncoming(ctx,"memorySpaces",{_id:"root"},space,preflight);
    };
    await expect(run(true)).resolves.toBeUndefined();
    await expect(run(false)).rejects.toThrow("GRAPH_JOB_UNRESOLVED");
    await expect(run(true,{...queue,identity:{...queue.identity,key:"forged"}})).rejects.toThrow("GRAPH_JOB_UNRESOLVED");
    await expect(run(true,{...queue,tenantId:"B"})).rejects.toThrow("GRAPH_JOB_UNRESOLVED");
    await expect(run(true,queue,{...live,memorySpaceId:"foreign"})).rejects.toThrow("GRAPH_JOB_UNRESOLVED");
    await expect(run(true,queue,live,{...authority,scopeKnown:false})).rejects.toThrow("GRAPH_JOB_UNRESOLVED");
    await expect(run(true,queue,live,{...authority,sourceRevision:0})).rejects.toThrow("GRAPH_JOB_UNRESOLVED");
  });
  test("space-root admits only disposed terminal exact-scope physical-source job metadata",async()=>{
    const queue={_id:"job",schemaVersion:2,tenantKnown:true,tenantId:"A",memorySpaceId:"s",table:"conversations",physicalSourceId:"old",sourceRevision:2,state:"synced",disposedAt:1,identity:{tenantId:"A",memorySpaceId:"s",physicalSourceId:"old"}};
    const authority={_id:"old-target",table:"conversations",documentId:"old",state:"deleted",finalSnapshotDigest:"native",scopeKnown:true,tenantId:"A",memorySpaceId:"s",sourceRevision:2};
    const run=(job:Record<string,unknown>,physical:Record<string,unknown>)=>{
      const ctx={db:{normalizeId:(_table:string,id:string)=>id,get:async(id:string)=>id==="queue-target"?{table:"graphSyncQueue",documentId:"job",state:"live"}:job,query:(table:string)=>({withIndex:(index:string,fn:(q:unknown)=>unknown)=>{const values:Record<string,unknown>={};const q={eq:(key:string,value:unknown)=>{values[key]=value;return q;}};fn(q);return {take:async()=>values.documentId==="old"?[physical]:[{_id:"root-target"}],collect:async()=>table==="cortexReferenceEdges"&&index==="by_target"?[{sourceTargetId:"queue-target",role:"space",kind:"physical"}]:[]};}})}} as unknown as QueryCtx;
      return checkErasureIncoming(ctx,"memorySpaces",{_id:"root"},space);
    };
    await expect(run(queue,authority)).resolves.toBeUndefined();
    for(const changed of [{state:"pending"},{state:"failed"},{disposedAt:undefined},{entity:{}},{projection:{}},{requestJson:"copy"},{projectionJson:"copy"},{tenantId:"B"},{memorySpaceId:"foreign"},{schemaVersion:undefined},{identity:{...queue.identity,physicalSourceId:"replacement"}}])await expect(run({...queue,...changed},authority)).rejects.toThrow("GRAPH_JOB_UNRESOLVED");
    for(const changed of [{state:"live"},{scopeKnown:false},{finalSnapshotDigest:undefined},{tenantId:"B"},{memorySpaceId:"foreign"},{sourceRevision:1}])await expect(run(queue,{...authority,...changed})).rejects.toThrow("GRAPH_JOB_UNRESOLVED");
  });
  test("all seventeen tables have a declared disposition",()=>expect(erasureTables).toEqual(["conversations","conversationShares","conversationSnapshots","immutable","mutable","memories","facts","factHistory","memorySpaces","contexts","agents","sessions","governancePolicies","governanceEnforcement","graphSyncQueue","artifacts","attachments"]));
  for(const table of ["immutable","mutable","memories","facts","contexts","sessions","artifacts","attachments"] as const)test(`${table} explicit selected owner is eligible without borrowing its data source`,()=>{
    expect(explicitErasureAction(table,{tenantId:"A",userId:"u",sourceUserId:"foreign",memorySpaceId:"s"},user)).toEqual({action:"delete"});
    expect(explicitErasureAction(table,{tenantId:"B",userId:"u",memorySpaceId:"s"},user)).toMatchObject({action:"preserve",reason:"foreignTenant"});
  });
  test("foreign profile with corrupt userId remains foreign",()=>expect(explicitErasureAction("immutable",{tenantId:"A",type:"user",id:"other",userId:"u"},user)).toEqual({action:"preserve",reason:"foreignProfile"}));
  test("profile is root last",()=>expect(explicitErasureAction("immutable",{tenantId:"A",type:"user",id:"u"},user)?.action).toBe("root"));
  test("foreign explicit owner overrides sourceUserId",()=>expect(explicitErasureAction("memories",{tenantId:"A",userId:"foreign",sourceUserId:"u"},user)).toEqual({action:"preserve",reason:"foreignOwnerAssociation"}));
  test("unowned memory requires immutable proof",()=>expect(explicitErasureAction("memories",{tenantId:"A",sourceUserId:"u"},user)).toBeUndefined());
  test("shared human transcript blocks",()=>expect(explicitErasureAction("conversations",{tenantId:"A",participants:{userId:"u",userIds:["other"]}},user)).toMatchObject({action:"block"}));
  test("approval owner and cross-space participant mismatch block",()=>{
    expect(explicitErasureAction("conversations",{tenantId:"A",participants:{userId:"u"},collaborativeSettings:{approvedParticipants:["other"]}},user)?.action).toBe("block");
    expect(explicitErasureAction("conversations",{tenantId:"A",memorySpaceId:"s",participants:{userId:"u",memorySpaceIds:["foreign"]}},user)?.action).toBe("block");
  });
  test("same-space participants do not block explicit space erasure",()=>expect(explicitErasureAction("conversations",{tenantId:"A",memorySpaceId:"s",participants:{userIds:["u","other"]}},space)).toEqual({action:"delete"}));
  test("co-owned artifact blocks; editor detaches; agent owner conflicts",()=>{
    expect(explicitErasureAction("artifacts",{tenantId:"A",userId:"u",collaborators:[{id:"other",type:"user",role:"owner"}]},user)?.action).toBe("block");
    expect(explicitErasureAction("artifacts",{tenantId:"A",userId:"other",collaborators:[{id:"u",type:"user",role:"editor"}]},user)?.action).toBe("detach");
    expect(explicitErasureAction("artifacts",{tenantId:"A",userId:"u",collaborators:[{id:"agent",type:"agent",role:"owner"}]},user)?.action).toBe("block");
  });
  test("only human membership detaches",()=>{
    expect(explicitErasureAction("memorySpaces",{tenantId:"A",participants:[{id:"u",type:"human"},{id:"u",type:"ai-agent"}]},user)?.action).toBe("detach");
    expect(explicitErasureAction("memorySpaces",{tenantId:"A",participants:[{id:"u",type:"ai-agent"}]},user)?.action).toBe("preserve");
  });
  test("owner history deletes but actor-only needs proof",()=>{
    expect(explicitErasureAction("factHistory",{tenantId:"A",scopeVersion:1,ownerKnown:true,ownerUserId:"u",userId:"other"},user)?.action).toBe("delete");
    expect(explicitErasureAction("factHistory",{tenantId:"A",scopeVersion:1,ownerKnown:true,ownerUserId:"other",userId:"u"},user)).toMatchObject({action:"preserve",reason:"foreignOwnerActorOnly"});
  });
  test("approval ownership cannot replace the exact canonical human participant set",()=>{
    expect(explicitErasureAction("conversations",{tenantId:"A",participants:{},collaborativeSettings:{ownerUserId:"u"}},user)?.action).toBe("block");
    expect(explicitErasureAction("conversations",{tenantId:"A",participants:{userIds:["u","u"]}},user)?.action).toBe("delete");
  });
  test("relevant legacy history without tenant evidence blocks instead of disappearing behind the tenant filter",()=>{
    expect(explicitErasureAction("factHistory",{userId:"u",memorySpaceId:"s"},user)).toMatchObject({action:"block",reason:"SOURCE_PROVENANCE_UNRESOLVED"});
    expect(explicitErasureAction("factHistory",{memorySpaceId:"s"},space)?.action).toBe("block");
    expect(explicitErasureAction("factHistory",{tenantId:"B",userId:"u",memorySpaceId:"s"},user)).toMatchObject({action:"preserve",reason:"foreignTenant"});
  });
  test("incoming user grant deletes only grant; unrelated foreign grant remains",()=>{
    expect(explicitErasureAction("conversationShares",{tenantId:"A",grantType:"user",grantedTo:"u",grantedBy:"other"},user)?.action).toBe("delete");
    expect(explicitErasureAction("conversationShares",{tenantId:"A",grantType:"link",grantedBy:"other"},user)?.action).toBe("preserve");
  });
  test("space never borrows ownership from tenant-global metadata",()=>{
    for(const table of ["immutable","mutable"] as const)expect(explicitErasureAction(table,{tenantId:"A",memorySpaceId:"s",metadata:{space:"s"}},space)).toEqual({action:"preserve",reason:"tenantGlobal"});
  });
  test("relevant unscoped governance blocks space; actor governance is excluded",()=>{
    for(const table of ["governancePolicies","governanceEnforcement"] as const){expect(explicitErasureAction(table,{memorySpaceId:"s"},space)?.action).toBe("block");expect(explicitErasureAction(table,{triggeredBy:"u"},user)?.action).toBe("preserve");}
  });
  for(const tenantId of ["", " ", null])test(`invalid tenant ${String(tenantId)} refuses`,()=>expect(()=>validateErasureDomain({...user,tenantId:tenantId as string})).toThrow());
  test("tenantless stays distinct and malformed envelope refuses",()=>{expect(explicitErasureAction("sessions",{userId:"u"},{kind:"user",userId:"u"})?.action).toBe("delete");expect(()=>validateErasureDomain({...user,memorySpaceId:"s"})).toThrow();});
  test("authority/hierarchy hard edges versus reciprocal backlinks",()=>{expect(erasureEdgeKind("memory",true)).toBe("hard");expect(erasureEdgeKind("context-parent",false)).toBe("hard");expect(erasureEdgeKind("context-child",false)).toBe("backlink");expect(erasureEdgeKind("fact",false)).toBe("data");});
});
