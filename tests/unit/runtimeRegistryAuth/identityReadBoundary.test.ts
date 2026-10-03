import { describe, expect, it } from "@jest/globals";
import { ConvexError } from "convex/values";
import * as agents from "../../../convex-dev/agents";
import * as memorySpaces from "../../../convex-dev/memorySpaces";
import * as contexts from "../../../convex-dev/contexts";
import { snapshot } from "../../../convex-dev/runtimeRegistryAuth";
import { fixture, invoke, seedAgent, seedSpace, seedContext } from "./fixture";

const scope = { tenantId: "tenant-a", memorySpaceId: "space-a" };
const edits = [
  { table: "agents", registration: agents.update, seed: seedAgent, args: { agentId: "agent-a", name: "Changed" }, nth: 4 },
  { table: "memorySpaces", registration: memorySpaces.update, seed: seedSpace, args: { name: "Changed" }, nth: 5 },
  { table: "contexts", registration: contexts.update, seed: seedContext, args: { contextId: "context-a", description: "Changed" }, nth: 4 },
];
const creates = [
  { table: "agents", registration: agents.register, seed: undefined, args: { agentId: "new", name: "New" }, nth: 0 },
  { table: "memorySpaces", registration: memorySpaces.register, seed: undefined, args: { type: "personal" }, nth: 0 },
  { table: "contexts", registration: contexts.create, seed: seedSpace, args: { purpose: "New" }, nth: 0 },
];
const envelopes = [
  { code: "UNAUTHENTICATED", message: "Verified identity required" },
  { code: "FORBIDDEN", message: "Access denied" },
  { code: "INVALID_INPUT", message: "Invalid authority configuration" },
  { code: "CAPABILITY_NOT_READY", message: "Access denied or invalid registry input" },
];
const entries = [...edits.map(entry => ({ ...entry, stage: "initial" })),
  ...edits.map(entry => ({ ...entry, stage: "optionalRead" })),
  ...creates.map(entry => ({ ...entry, stage: "postInsert" }))];
describe("identity adapter exceptions cannot impersonate resolver policy", () => {
  it.each(entries.flatMap(entry => envelopes.map(envelope => ({ ...entry, ...envelope }))))
  ("$table $stage exact $code identity rejection aborts without commitments", async entry => {
    const f = fixture(); entry.seed?.(f); const before = snapshot([...f.db.rows]);
    let calls = 0; let reached = false; let attempts = 0;
    f.db.beforeWrite = () => { attempts++; };
    f.ctx.auth.getUserIdentity = async () => {
      calls++;
      if (entry.stage === "initial" || entry.stage === "optionalRead" && calls === entry.nth || entry.stage === "postInsert" && f.db.writes > 0) {
        reached = true;
        throw new ConvexError({ version: 1, code: entry.code, message: entry.message, retryable: false, outcome: "not_dispatched" });
      }
      return { issuer: "https://host.test", subject: "user-a", tokenIdentifier: "https://host.test|user-a" };
    };
    let caught: unknown;
    try { await f.db.transaction(async () => await invoke(entry.registration, f.ctx, { ...scope, ...entry.args })); }
    catch (error) { caught = error; }
    expect(reached).toBe(true); expect(caught).toBeInstanceOf(ConvexError);
    if (!(caught instanceof ConvexError)) throw new Error("Identity failure must not return a successful receipt");
    expect(caught.data).toEqual({ version: 1, code: "REGISTRY_OPERATION_FAILED", message: "Registry operation failed", retryable: false,
      outcome: entry.stage === "postInsert" ? "rolled_back" : "failed" });
    expect(attempts).toBe(entry.stage === "postInsert" ? 1 : 0);
    expect(f.db.writes).toBe(0); expect(snapshot([...f.db.rows])).toBe(before);
  });
});
