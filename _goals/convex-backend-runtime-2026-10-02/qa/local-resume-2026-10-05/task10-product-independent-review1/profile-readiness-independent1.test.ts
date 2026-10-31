/** Independent controlled handlers; no service/profile qualification. */
import { describe, expect, it } from "@jest/globals";
import { memoryFixture } from "/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/tests/unit/runtimeMemory/fixture";
import { ingestionFixture, installIngestionMockRoot } from "/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/tests/unit/runtimeIngestion/fixture";
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
    installIngestionMockRoot(); const f = await ingestionFixture();
    for(let sequence=1; sequence<=270; sequence++) f.db.seed("runtimeIngestionEvents", {
      tenantId:f.reference.tenantId,memorySpaceId:f.reference.memorySpaceId,sequence,
      eligibility:"eligible",factsState:"complete",vectorsState:"complete",profile:small,
      vectorProfilesComplete:[small.profileId,large.profileId] });
    f.db.seed("runtimeIngestionScopes", {tenantId:f.reference.tenantId,memorySpaceId:f.reference.memorySpaceId,
      sequence:270,factsThrough:270,vectorsThrough:270,vectorProfileThrough:{[small.profileId]:270,[large.profileId]:0},graphThrough:0,version:1});
    await refreshScopeWatermarks(f.ctx,f.reference);
    expect(f.db.table("runtimeIngestionScopes")[0].vectorProfileThrough).toEqual({[small.profileId]:270,[large.profileId]:256});
    expect(f.scheduled.filter(item=>item.name==="runtimeMemoryContext:refreshWatermarks")).toHaveLength(1);
  });
});
