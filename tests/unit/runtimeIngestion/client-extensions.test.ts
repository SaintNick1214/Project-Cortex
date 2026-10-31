/** Controlled registered-handler checks; no real service or model qualification. */
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { ingestionFixture, installIngestionMockRoot, ingestion } from "./fixture";
import { DEFAULT_EMBEDDING_PROFILE, LARGE_EMBEDDING_PROFILE } from "../../../src/domain/profile";
const extensions = await import("../../../convex-dev/runtimeClientExtensions");
describe("fresh backend profile and stage delivery", () => {
  beforeEach(() => installIngestionMockRoot()); afterEach(() => { jest.restoreAllMocks(); });
  test("fresh mutation metadata retains current managed provenance without creating operations", async () => {
    const f = await ingestionFixture();
    expect((extensions.embeddingProfile as unknown as { isMutation: boolean }).isMutation).toBe(true);
    expect(await f.call(extensions.embeddingProfile, { tenantId: "tenant-a", memorySpaceId: "space-a" })).toEqual({ version: 1, profile: DEFAULT_EMBEDDING_PROFILE });
    expect(f.db.table("runtimeModelOperations")).toEqual([]);
  });
  test("caller guards cannot select a different administrator profile", async () => {
    const f = await ingestionFixture();
    await expect(f.call(extensions.embeddingProfile, { memorySpaceId: "space-a", expectedProfileId: LARGE_EMBEDDING_PROFILE.profileId })).rejects.toThrow("PROFILE_MISMATCH");
    expect(f.db.table("runtimeModelOperations")).toEqual([]);
  });
  test("own grants cannot inspect whole-scope activity", async () => {
    const f = await ingestionFixture();
    await expect(f.call(extensions.memoryReadiness, { memorySpaceId: "space-a" })).rejects.toThrow("FORBIDDEN");
  });
  test("strict vectors succeeds across a failed facts hole; facts strict fails without paid calls", async () => {
    const f = await ingestionFixture(); f.grant.resourceAccess = "space";
    await ingestion.enqueueSourceEvent(f.ctx, f.reference, await f.source("first"));
    f.db.table("runtimeIngestionEvents")[0].factsState = "failed"; f.db.table("runtimeIngestionEvents")[0].vectorsState = "complete";
    const result = await f.call(extensions.memoryReadiness, { memorySpaceId: "space-a", strictStages: ["vectors"] });
    expect(result).toMatchObject({ cutoff: 1, graphCutoff: 0, strictStages: ["vectors"], stages: { vectors: { complete: true }, facts: { complete: false, hole: { sequence: 1, state: "failed" } } } });
    await expect(f.call(extensions.memoryReadiness, { memorySpaceId: "space-a", strictStages: ["facts"] })).rejects.toThrow("CONTEXT_INCOMPLETE");
    expect(f.db.table("runtimeModelOperations")).toEqual([]);
  });
  test("future or malformed cutoffs and duplicate strict stages fail closed", async () => {
    const f = await ingestionFixture(); f.grant.resourceAccess = "space";
    for (const extra of [{ cutoff: 1 }, { graphCutoff: 1 }, { cutoff: -1 }, { cutoff: 0.5 }, { strictStages: ["facts", "facts"] }])
      await expect(f.call(extensions.memoryReadiness, { memorySpaceId: "space-a", ...extra })).rejects.toThrow("INVALID_INPUT");
  });
  test("unconfigured graph is unavailable even at a zero cutoff", async () => {
    const f = await ingestionFixture(); f.grant.resourceAccess = "space";
    await expect(f.call(extensions.memoryReadiness, { memorySpaceId: "space-a", strictStages: ["graph"] })).rejects.toThrow("CAPABILITY_UNAVAILABLE");
  });
  test("the same fresh metadata arguments deny time-only grant expiry", async () => {
    const f = await ingestionFixture(); const args = { memorySpaceId: "space-a" };
    f.grant.expiresAt = Date.now() + 10_000; await f.call(extensions.embeddingProfile, args);
    f.grant.expiresAt = Date.now() - 1;
    await expect(f.call(extensions.embeddingProfile, args)).rejects.toThrow("FORBIDDEN");
    expect(f.db.table("runtimeModelOperations")).toEqual([]);
  });
  test("foreign selectors and revoked actors reveal no profile or readiness", async () => {
    const f = await ingestionFixture();
    await expect(f.call(extensions.embeddingProfile, { tenantId: "foreign", memorySpaceId: "space-a" })).rejects.toThrow();
    f.grant.revokedAt = Date.now();
    await expect(f.call(extensions.embeddingProfile, { memorySpaceId: "space-a" })).rejects.toThrow();
  });
});
