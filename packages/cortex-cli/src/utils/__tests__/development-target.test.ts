import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { assertDevelopmentBackendCapability, registerInstalledDevelopmentBackend, verifyDisposableDevelopmentTarget } from "../init/development-target.js";

const target = { teamId: 12, projectId: 34, deploymentName: "safe-test-123", deploymentUrl: "https://safe-test-123.convex.cloud", disposable: true as const };
function mockManagement(overrides: Record<string, unknown> = {}) {
  return jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const value = String(input).includes("/deployments/")
      ? { name: target.deploymentName, deploymentType: "dev", projectId: target.projectId, deploymentUrl: target.deploymentUrl, kind: "cloud", ...overrides }
      : { id: target.projectId, teamId: target.teamId, ...overrides };
    return new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" } });
  });
}
afterEach(() => { jest.restoreAllMocks(); });
describe("verified disposable development operations", () => {
  it("accepts exact official management readbacks without any mutation", async () => {
    const fetch = mockManagement();
    const receipt = await verifyDisposableDevelopmentTarget(target, "private-token");
    expect(receipt.target).toEqual(target);
    expect(Object.isFrozen(receipt.target)).toBe(true);
    expect(Object.keys(receipt).sort()).toEqual(["target", "verifiedAt"]);
    expect(JSON.stringify(receipt)).not.toContain("private-token");
    expect(fetch).toHaveBeenCalledTimes(2);
    for (const [, options] of fetch.mock.calls) expect(options?.method).toBeUndefined();
  });
  it.each([
    { deploymentType: "prod" }, { deploymentType: "preview" }, { projectId: 99 }, { teamId: 99 },
    { name: "foreign-test-456" }, { deploymentUrl: "https://foreign-test-456.convex.cloud" }, { kind: "local" },
  ])("rejects wrong target metadata %j before mutation", async (override) => {
    mockManagement(override);
    await expect(verifyDisposableDevelopmentTarget(target, "private-token")).rejects.toThrow("differs");
  });
  it("refuses a development deployment without explicit disposable ownership", async () => {
    const fetch = mockManagement();
    await expect(verifyDisposableDevelopmentTarget({ ...target, disposable: false as unknown as true }, "private-token")).rejects.toThrow("explicit disposable");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("refuses credential-bearing or non-Convex URLs before management reads", async () => {
    const fetch = mockManagement();
    await expect(verifyDisposableDevelopmentTarget({ ...target, deploymentUrl: "https://secret@safe-test-123.convex.cloud" }, "private-token")).rejects.toThrow("URL is invalid");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("refuses forged receipts even when their public metadata looks correct", async () => {
    const fetch = mockManagement();
    await expect(registerInstalledDevelopmentBackend({ target, verifiedAt: new Date().toISOString() }, "/unused", "dev:safe-test-123|key")).rejects.toThrow("verified development-target receipt");
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each(["prod:safe-test-123|key", "dev:foreign-test-123|key", "legacy-key", "dev:safe-test-123|key\nOTHER=value"])("refuses mismatched/production/legacy deploy key %s", async (key) => {
    const fetch = mockManagement();
    const receipt = await verifyDisposableDevelopmentTarget(target, "private-token");
    await expect(registerInstalledDevelopmentBackend(receipt, "/unused", key)).rejects.toThrow("not explicitly bound");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("rechecks live target state immediately before dispatch and fences a changed deployment", async () => {
    const fetch = mockManagement();
    const receipt = await verifyDisposableDevelopmentTarget(target, "private-token");
    fetch.mockRestore(); mockManagement({ deploymentType: "prod" });
    await expect(registerInstalledDevelopmentBackend(receipt, "/unused", "dev:safe-test-123|key")).rejects.toThrow("differs");
  });
  it("rejects expired prospective verification", async () => {
    mockManagement(); const receipt = await verifyDisposableDevelopmentTarget(target, "private-token");
    const now = Date.now(); jest.spyOn(Date, "now").mockReturnValue(now + 300001);
    await expect(registerInstalledDevelopmentBackend(receipt, "/unused", "dev:safe-test-123|key")).rejects.toThrow("verify again");
  });
  it("returns actionable incomplete-capability details and permits a fully configured core", () => {
    expect(() => assertDevelopmentBackendCapability({ authConfigured: false, bootstrapConfigured: true, coreRegistered: false })).toThrow("authConfigured, coreRegistered");
    expect(() => assertDevelopmentBackendCapability({ authConfigured: true, bootstrapConfigured: true, coreRegistered: true })).not.toThrow();
  });
});
