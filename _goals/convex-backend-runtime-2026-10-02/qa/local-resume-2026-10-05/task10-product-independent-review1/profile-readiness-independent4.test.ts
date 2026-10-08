/** Independent controlled handlers; no service/profile qualification. */
import { describe, expect, it } from "@jest/globals";
import { memoryFixture } from "/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/tests/unit/runtimeMemory/fixture";
import { ConvexMemoryRepository } from "/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeMemoryRepository";
import { refreshScopeWatermarks } from "/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeMemoryContext";
import { DEFAULT_EMBEDDING_PROFILE as small, LARGE_EMBEDDING_PROFILE as large } from "/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/src/domain/profile";

describe("independent selected-profile readiness boundaries", () => {
  it("private-peer generations cannot consume an own-only metadata bound", async () => {
    const f = memoryFixture({ profile: () => large });
    for (let i=0; i<1025; i++) f.db.seed("runtimeMemoryVectorGenerations", {
      tenantId:f.reference.tenantId, memorySpaceId:f.reference.memorySpaceId, ownerPrincipalId:"private-peer",
      sourceId:`peer-${i}`, sourceRevision:1, profile:small });
    const writes = f.db.writes;
    await expect(new ConvexMemoryRepository(f.ctx,f.reference,"read").assertProfileReady(large)).resolves.toBeUndefined();
    expect(f.db.writes).toBe(writes); expect(f.searches).toHaveLength(0);
  });
  it("a genuine own-domain oversize remains explicitly bounded", async () => {
    const f = memoryFixture({ profile: () => large });
    for (let i=0; i<1025; i++) f.db.seed("runtimeMemoryVectorGenerations", {
      tenantId:f.reference.tenantId, memorySpaceId:f.reference.memorySpaceId, ownerPrincipalId:f.reference.principalId,
      sourceId:`owned-${i}`, sourceRevision:1, profile:small });
    await expect(new ConvexMemoryRepository(f.ctx,f.reference,"read").assertProfileReady(large)).rejects.toMatchObject({data:{code:"QUERY_TOO_BROAD"}});
  });
  it("a large-only completed metadata page schedules continuation while facts/default already finished", async () => {
    const f = memoryFixture();
    const scheduled: string[] = [];
    f.ctx.scheduler = {runAfter: async (_delay: number, _ref: unknown, _args: unknown) => {scheduled.push("refresh"); return "scheduled:own-metadata";}} as typeof f.ctx.scheduler;
    const originalQuery = f.db.query.bind(f.db);
    f.db.query = ((table: string) => {
      if(table !== "runtimeIngestionEvents") {
        const original = originalQuery(table); const unique = original.unique.bind(original);
        // Convex returns detached document snapshots. The original MemoryTestDb
        // returns live objects, which would incorrectly mutate the captured prior cursor.
        original.unique = async () => JSON.parse(JSON.stringify(await unique())) as Awaited<ReturnType<typeof unique>>;
        return original;
      }
      const filters: ((row: Record<string,unknown>) => boolean)[] = [];
      const builder = {withIndex: (_name:string, callback:(q:unknown)=>unknown) => {
        const q = {eq:(key:string,value:unknown)=>{filters.push(row=>row[key]===value);return q;},
          gt:(key:string,value:number)=>{filters.push(row=>(row[key] as number)>value);return q;},
          lte:(key:string,value:number)=>{filters.push(row=>(row[key] as number)<=value);return q;}};
        callback(q); return builder;},
        take:async(limit:number)=>f.db.table(table).filter(row=>filters.every(predicate=>predicate(row))).sort((a,b)=>(a.sequence as number)-(b.sequence as number)).slice(0,limit)};
      return builder as ReturnType<typeof originalQuery>;
    }) as typeof f.db.query;
    for(let sequence=1; sequence<=600; sequence++) f.db.seed("runtimeIngestionEvents", {
      tenantId:f.reference.tenantId,memorySpaceId:f.reference.memorySpaceId,sequence,
      eligibility:"eligible",factsState:"complete",vectorsState:"complete",profile:small,
      vectorProfilesComplete:[small.profileId,large.profileId] });
    f.db.seed("runtimeIngestionScopes", {tenantId:f.reference.tenantId,memorySpaceId:f.reference.memorySpaceId,
      sequence:600,factsThrough:600,vectorsThrough:600,vectorProfileThrough:{[small.profileId]:600,[large.profileId]:0},graphThrough:0,version:1});
    await refreshScopeWatermarks(f.ctx,f.reference);
    expect(f.db.table("runtimeIngestionScopes")[0].vectorProfileThrough).toEqual({[small.profileId]:600,[large.profileId]:256});
    expect(scheduled).toHaveLength(1);
  });
});
