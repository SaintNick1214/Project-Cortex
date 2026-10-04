import { describe, expect, it } from "@jest/globals";
import { ConvexError } from "convex/values";
import { snapshot } from "../../../convex-dev/runtimeRegistryAuth";
import { invoke } from "./fixture";
import { admissionCases, admissionFixture, corruptControl, controlCorruptions } from "./admissionFixture";
async function denied(run: () => Promise<unknown>, code: "FORBIDDEN" | "REGISTRY_OPERATION_FAILED") {
  let caught: unknown; try { await run(); } catch (error) { caught = error; }
  expect(caught).toBeInstanceOf(ConvexError);
  if (!(caught instanceof ConvexError)) throw new Error("Expected structured failure");
  expect(caught.data).toEqual({ version: 1, code, message: code === "FORBIDDEN" ? "Access denied or invalid registry input" : "Registry operation failed",
    retryable: false, outcome: code === "FORBIDDEN" ? "not_dispatched" : "failed" });
  expect(caught.message).not.toContain("private-control-document-id");
  expect(caught.message).not.toContain("healthy-second-scope-private-value");
}
describe("cycle3 original omitted-selector admission cannot prune a corrupt control lookup", () => {
  it.each(admissionCases.flatMap((entry) => controlCorruptions.map((corruption) => ({ ...entry, corruption }))))
  ("$scopes $path native $corruption ambiguity stops before selecting any peer or effect", async (entry) => {
    const f = admissionFixture(entry); corruptControl(f, entry.corruption); const before = snapshot([...f.db.rows]); let attempts = 0;
    f.db.beforeWrite = () => { attempts++; };
    await denied(async () => await f.db.transaction(async () => await invoke(entry.registration, f.ctx, entry.args)), "REGISTRY_OPERATION_FAILED");
    const table = entry.corruption.endsWith("Scope") ? "runtimeAuthScopes" : "runtimeAuthTombstones";
    expect(f.db.traces.some((trace) => trace.table === table && trace.returned.length === 2)).toBe(true);
    expect(f.db.traces.some((trace) => ["agents", "memorySpaces", "contexts"].includes(trace.table))).toBe(false);
    expect(attempts).toBe(0); expect(f.db.writes).toBe(0); expect(snapshot([...f.db.rows])).toBe(before);
  });
  it.each(admissionCases)("$scopes $path two healthy eligible scopes remain ambiguous", async (entry) => {
    const f = admissionFixture(entry); let attempts = 0; f.db.beforeWrite = () => { attempts++; };
    await denied(async () => await f.db.transaction(async () => await invoke(entry.registration, f.ctx, entry.args)), "FORBIDDEN");
    expect(attempts).toBe(0); expect(f.db.writes).toBe(0);
  });
  it.each(admissionCases.flatMap((entry) => ["revoked", "expired", "missingCapability"].map((reason) => ({ ...entry, reason }))))
  ("$scopes $path actual $reason grant is pruned and the sole eligible scope succeeds", async (entry) => {
    const f = admissionFixture(entry);
    if (entry.reason === "revoked") f.grant.revokedAt = 1001;
    else if (entry.reason === "expired") f.grant.expiresAt = 1001;
    else f.grant.capabilities = [];
    const result = await f.db.transaction(async () => await invoke(entry.registration, f.ctx, entry.args));
    expect(result).toBeTruthy(); const rows = f.db.table(entry.table);
    expect(rows.every((row) => row.tenantId === f.secondTenant && row.memorySpaceId === f.secondSpace)).toBe(true);
    expect(f.db.writes).toBe(entry.mutation ? 1 : 0);
    if (entry.mutation) expect(rows[0]!.updatedAt).toBeGreaterThan(1000);
  });
  it.each(admissionCases)("$scopes $path a single authorized grant succeeds with omitted selectors", async (entry) => {
    const f = admissionFixture(entry); f.db.rows.set("runtimeAuthGrants", f.db.table("runtimeAuthGrants").filter((grant) => grant._id !== f.grant._id));
    const result = await f.db.transaction(async () => await invoke(entry.registration, f.ctx, entry.args));
    expect(result).toBeTruthy(); expect(f.db.writes).toBe(entry.mutation ? 1 : 0);
  });
});
