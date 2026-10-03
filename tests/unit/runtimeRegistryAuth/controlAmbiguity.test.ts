import { describe, expect, it } from "@jest/globals";
import { ConvexError } from "convex/values";
import * as agents from "../../../convex-dev/agents";
import * as memorySpaces from "../../../convex-dev/memorySpaces";
import * as contexts from "../../../convex-dev/contexts";
import { snapshot } from "../../../convex-dev/runtimeRegistryAuth";
import { fixture, invoke, seedAgent, seedSpace, seedContext } from "./fixture";

const scope = { tenantId: "tenant-a", memorySpaceId: "space-a" };
const marker = "private-control-compatibility-diagnostic";
const canonical = [
  { table: "agents", registration: agents.update, seed: seedAgent, args: { agentId: "agent-a", name: "Updated" } },
  { table: "memorySpaces", registration: memorySpaces.update, seed: seedSpace, args: { name: "Updated" } },
  { table: "contexts", registration: contexts.update, seed: seedContext, args: { contextId: "context-a", description: "Updated" } },
] as const;
const stages = ["initialControl", "postEffectReference"] as const;
function ambiguity() {
  return new ConvexError({ version: 1, code: "AUTHORITY_LOOKUP_AMBIGUOUS", message: "Authority lookup is ambiguous", retryable: false, outcome: "not_dispatched" });
}
async function assertFailure(run: () => Promise<unknown>, code: "FORBIDDEN" | "REGISTRY_OPERATION_FAILED", outcome: "failed" | "rolled_back") {
  let caught: unknown; try { await run(); } catch (error) { caught = error; }
  expect(caught).toBeInstanceOf(ConvexError);
  if (!(caught instanceof ConvexError)) throw new Error("Expected exact opaque control failure");
  expect(caught.data).toEqual({ version: 1, code,
    message: code === "FORBIDDEN" ? "Access denied or invalid registry input" : "Registry operation failed", retryable: false, outcome });
  const publicError = JSON.stringify({ data: caught.data, message: caught.message });
  expect(publicError).not.toContain(marker); expect(publicError).not.toContain("AUTHORITY_LOOKUP_AMBIGUOUS");
}
describe("cycle3 exact control ambiguity protocol compatibility without dependency adoption", () => {
  it.each(canonical.flatMap((entry) => ["runtimeAuthPrincipals", "runtimeAuthScopes", "runtimeAuthTombstones"].flatMap((controlTable) =>
    stages.map((stage) => ({ ...entry, controlTable, stage })))))
  ("$table $stage exact $controlTable ambiguity retains the appropriate failure", async (entry) => {
    const f = fixture(); entry.seed(f); const before = snapshot([...f.db.rows]); let reached = false; let attempts = 0;
    f.db.beforeWrite = () => { attempts++; };
    f.db.beforeRead = (table) => { if (table === entry.controlTable && (entry.stage === "initialControl" || f.db.writes > 0)) { reached = true; throw ambiguity(); } };
    await assertFailure(async () => await f.db.transaction(async () => await invoke(entry.registration, f.ctx, { ...scope, ...entry.args })),
      entry.stage === "initialControl" ? "REGISTRY_OPERATION_FAILED" : "FORBIDDEN", entry.stage === "initialControl" ? "failed" : "rolled_back");
    expect(reached).toBe(true); expect(attempts).toBe(entry.stage === "initialControl" ? 0 : 1);
    expect(f.db.writes).toBe(0); expect(snapshot([...f.db.rows])).toBe(before);
  });
  it.each(canonical.flatMap((entry) => ["unknownCode", "wrongMessage", "outerMessage", "hidden", "symbol", "outerHidden", "codeGetter", "dataDescriptorTrap"].flatMap((shape) =>
    stages.map((stage) => ({ ...entry, shape, stage })))))
  ("$table $stage malformed $shape control envelope remains an unexpected failure", async (entry) => {
    const f = fixture(); entry.seed(f); const before = snapshot([...f.db.rows]); const fault = ambiguity(); let getterCalls = 0; let trapped = false;
    if (entry.shape === "unknownCode") { fault.data.code = "AUTHORITY_LOOKUP_UNKNOWN"; fault.message = JSON.stringify(fault.data); }
    if (entry.shape === "wrongMessage") { fault.data.message = "Access denied"; fault.message = JSON.stringify(fault.data); }
    if (entry.shape === "outerMessage") fault.message = marker;
    if (entry.shape === "hidden") Object.defineProperty(fault.data, "privateDiagnostic", { value: marker });
    if (entry.shape === "symbol") Object.defineProperty(fault.data, Symbol(marker), { value: marker });
    if (entry.shape === "outerHidden") Object.defineProperty(fault, "privateDiagnostic", { value: marker });
    if (entry.shape === "codeGetter") Object.defineProperty(fault.data, "code", { get: () => { getterCalls++; throw new Error(marker); }, enumerable: true });
    if (entry.shape === "dataDescriptorTrap") fault.data = new Proxy(fault.data, { getOwnPropertyDescriptor: () => { trapped = true; throw new Error(marker); } });
    let reached = false; let attempts = 0; f.db.beforeWrite = () => { attempts++; };
    f.db.beforeRead = (table) => { if (table === "runtimeAuthScopes" && (entry.stage === "initialControl" || f.db.writes > 0)) { reached = true; throw fault; } };
    await assertFailure(async () => await f.db.transaction(async () => await invoke(entry.registration, f.ctx, { ...scope, ...entry.args })),
      "REGISTRY_OPERATION_FAILED", entry.stage === "initialControl" ? "failed" : "rolled_back");
    expect(reached).toBe(true); expect(getterCalls).toBe(0); if (entry.shape === "dataDescriptorTrap") expect(trapped).toBe(true);
    expect(attempts).toBe(entry.stage === "initialControl" ? 0 : 1); expect(f.db.writes).toBe(0); expect(snapshot([...f.db.rows])).toBe(before);
  });
});
