import { it, expect } from "vitest";
import { installed } from "../helpers/e2e.js";
it("memory/profile readiness reflects backend receipts instead of an app extraction/embedding loop", async () => {
  await installed(async (client, runId) => {
    const handle = await client.attach(runId), run = await client.get(handle);
    expect(["pending", "complete", "failed", "not_requested"]).toContain(run.memoryStatus);
    const profile = await client.getDefaultProfile(), readiness = await client.memoryReadiness();
    expect(readiness.version).toBe(1); expect(readiness.profile.profileId).toBe(profile.profile.profileId);
    expect(readiness.profile.dimensions).toBeGreaterThan(0);
    const facts = readiness.stages.facts;
    expect(facts).toBeDefined(); expect(facts!.indexedThrough).toBeLessThanOrEqual(facts!.cutoff);
    if (facts!.complete) expect(facts!.hole).toBeNull();
  });
});
