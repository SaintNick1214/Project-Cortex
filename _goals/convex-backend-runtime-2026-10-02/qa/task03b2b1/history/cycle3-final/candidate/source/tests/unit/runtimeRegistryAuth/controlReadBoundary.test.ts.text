import { describe, expect, it } from "@jest/globals";
import { ConvexError } from "convex/values";
import * as agents from "../../../convex-dev/agents";
import * as memorySpaces from "../../../convex-dev/memorySpaces";
import * as contexts from "../../../convex-dev/contexts";
import { snapshot } from "../../../convex-dev/runtimeRegistryAuth";
import { fixture, invoke, seedAgent, seedSpace, seedContext } from "./fixture";

const scope = { tenantId: "tenant-a", memorySpaceId: "space-a" };
const canonical = [
  { table: "agents", registration: agents.update, seed: seedAgent, args: { agentId: "agent-a", name: "Updated" } },
  { table: "memorySpaces", registration: memorySpaces.update, seed: seedSpace, args: { name: "Updated" } },
  { table: "contexts", registration: contexts.update, seed: seedContext, args: { contextId: "context-a", description: "Updated" } },
] as const;
const envelopes = [
  { code: "UNAUTHENTICATED", message: "Verified identity required" },
  { code: "FORBIDDEN", message: "Access denied" },
  { code: "INVALID_INPUT", message: "Invalid authority configuration" },
  { code: "CAPABILITY_NOT_READY", message: "Access denied or invalid registry input" },
] as const;
const stages = ["initialControl", "optionalReadControl", "postEffectReference"] as const;
describe("cycle3 low-level read exceptions cannot impersonate resolver policy", () => {
  it.each(canonical.flatMap((entry) => envelopes.flatMap((envelope) => stages.map((stage) => ({ ...entry, ...envelope, stage })))))
  ("$table $stage exact $code read exception remains a failed operation", async (entry) => {
    const f = fixture(); entry.seed(f); const before = snapshot([...f.db.rows]); let reached = false; let principalReads = 0; let attempts = 0;
    const fault = new ConvexError({ version: 1, code: entry.code, message: entry.message, retryable: false, outcome: "not_dispatched" });
    f.db.beforeWrite = () => { attempts++; };
    f.db.beforeRead = (table) => {
      const optionalRead = table === "runtimeAuthPrincipals" && ++principalReads === (entry.table === "memorySpaces" ? 5 : 4);
      if (entry.stage === "optionalReadControl" ? optionalRead : table === "runtimeAuthScopes" && (entry.stage === "initialControl" || f.db.writes > 0)) {
        reached = true; throw fault;
      }
    };
    let caught: unknown;
    try { await f.db.transaction(async () => await invoke(entry.registration, f.ctx, { ...scope, ...entry.args })); } catch (error) { caught = error; }
    expect(reached).toBe(true); expect(caught).toBeInstanceOf(ConvexError);
    if (!(caught instanceof ConvexError)) throw new Error("Expected a failed read instead of a receipt or policy decision");
    expect(caught.data).toEqual({ version: 1, code: "REGISTRY_OPERATION_FAILED", message: "Registry operation failed", retryable: false,
      outcome: entry.stage === "postEffectReference" ? "rolled_back" : "failed" });
    expect(attempts).toBe(entry.stage === "postEffectReference" ? 1 : 0);
    expect(f.db.writes).toBe(0); expect(snapshot([...f.db.rows])).toBe(before);
  });
});
