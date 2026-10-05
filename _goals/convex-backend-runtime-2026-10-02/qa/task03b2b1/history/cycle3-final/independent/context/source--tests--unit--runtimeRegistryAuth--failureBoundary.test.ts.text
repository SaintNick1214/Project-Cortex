import { describe, expect, it } from "@jest/globals";
import { ConvexError } from "convex/values";
import * as agents from "../../../convex-dev/agents";
import * as memorySpaces from "../../../convex-dev/memorySpaces";
import * as contexts from "../../../convex-dev/contexts";
import { snapshot } from "../../../convex-dev/runtimeRegistryAuth";
import { fixture, invoke, seedAgent, seedSpace, seedContext } from "./fixture";
const scope = { tenantId: "tenant-a", memorySpaceId: "space-a" };
const marker = "private-document-id-and-driver-payload-accessor-escape";
const privateCode = "private-driver-payload-in-public-code";
const safeEnvelope = { version: 1, code: "FORBIDDEN", message: "Access denied", retryable: false, outcome: "not_dispatched" };
const modules: Record<string, Record<string, unknown>> = { agents, memorySpaces, contexts };
const selected = Object.entries(modules).flatMap(([module, values]) => Object.entries(values).filter(([name]) => !["computeStats", "getStats"].includes(name))
  .map(([name, registration]) => ({ module, name, registration, path: `${module}:${name}` })));
const mutations = selected.filter((entry) => (entry.registration as { isMutation?: boolean }).isMutation === true);
function args(entry: typeof selected[number]) {
  if (entry.name === "purgeAll") return {};
  const specific: Record<string, Record<string, unknown>> = {
    register: { agentId: "new-agent", name: "New", type: "personal" }, update: { name: "Updated", description: "Updated" },
    updateMany: { agentIds: ["agent-a"], name: "Bulk", updates: { status: "completed" } }, unregisterMany: { agentIds: ["agent-a"] }, create: { purpose: "New" },
    addParticipant: { participant: { id: "label-b", type: "user", joinedAt: 1000 }, participantId: "label-b" }, removeParticipant: { participantId: "label-b" },
    grantAccess: { targetMemorySpaceId: "space-a", scope: "read-only" }, deleteSpace: { cascade: true, reason: "owned" }, search: { query: "space" },
    updateParticipants: { add: [] }, getByConversation: { conversationId: "conversation-a" }, findByParticipant: { participantId: "label-a" }, getVersion: { version: 1 },
    getAtTimestamp: { timestamp: 1000 }, exportContexts: { format: "json" },
  };
  const fields = (JSON.parse((entry.registration as { exportArgs(): string }).exportArgs()) as { value: Record<string, unknown> }).value;
  return Object.fromEntries(Object.entries({ ...scope, agentId: "agent-a", contextId: "context-a", ...specific[entry.name] }).filter(([key]) => Object.prototype.hasOwnProperty.call(fields, key)));
}
function poison(kind: string) {
  let calls = 0;
  const error = kind === "message" || kind === "native-stack" ? new Error(kind === "native-stack" ? "unique() query returned more than one result from table agents:\n [private-one, private-two, ...]" : "Driver fault") : new ConvexError({ ...safeEnvelope });
  const data: unknown = error instanceof ConvexError ? error.data : null;
  const target = kind.startsWith("field:") || kind === "stateful" ? data : error;
  const key = kind === "message" ? "message" : kind === "data" ? "data" : kind === "native-stack" || kind === "stack" ? "stack" : kind === "name" ? "name" : kind === "stateful" ? "code" : kind.slice(6);
  if (!target || typeof target !== "object") throw new Error("Invalid synthetic exception fixture");
  Object.defineProperty(target, key, { configurable: true, enumerable: true, get: () => { calls++; if (kind === "stateful") return calls <= 2 ? "FORBIDDEN" : privateCode; throw new Error(marker); } });
  return { error, calls: () => calls };
}
async function failed(run: () => Promise<unknown>, outcome: "failed" | "rolled_back") {
  let caught: unknown; try { await run(); } catch (error) { caught = error; }
  expect(caught).toBeInstanceOf(ConvexError);
  if (!(caught instanceof ConvexError)) throw new Error("Expected opaque structured operation failure");
  expect(caught.data).toEqual({ version: 1, code: "REGISTRY_OPERATION_FAILED", message: "Registry operation failed", retryable: false, outcome });
  const output = JSON.stringify({ message: caught.message, data: caught.data }); expect(output).not.toContain(marker); expect(output).not.toContain(privateCode);
}
const canonical = [
  { table: "agents", registration: agents.update, seed: seedAgent, args: { agentId: "agent-a", name: "New" } },
  { table: "memorySpaces", registration: memorySpaces.update, seed: seedSpace, args: { name: "New" } },
  { table: "contexts", registration: contexts.update, seed: seedContext, args: { contextId: "context-a", description: "New" } },
] as const;
describe("cycle3 C1 total static diagnostic classification at native handlers", () => {
  it.each(selected)("$path first read message getter never escapes or runs", async (entry) => {
    const f = fixture(); const fault = poison("message"); let reached = false;
    f.db.beforeRead = () => { reached = true; throw fault.error; };
    await failed(async () => await f.db.transaction(async () => await invoke(entry.registration, f.ctx, args(entry))), "failed");
    expect(reached).toBe(true); expect(fault.calls()).toBe(0); expect(f.db.writes).toBe(0);
  });
  it.each(mutations)("$path rejected first write attempt returns exact rolled-back failure", async (entry) => {
    const f = fixture(); seedSpace(f); seedAgent(f); seedContext(f); if (entry.module === "memorySpaces" && entry.name === "register") f.db.rows.set("memorySpaces", []);
    const before = snapshot([...f.db.rows]); const fault = poison("message"); let attempts = 0;
    f.db.beforeWrite = () => { attempts++; throw fault.error; };
    await failed(async () => await f.db.transaction(async () => await invoke(entry.registration, f.ctx, args(entry))), "rolled_back");
    expect(attempts).toBe(1); expect(fault.calls()).toBe(0); expect(f.db.writes).toBe(0); expect(snapshot([...f.db.rows])).toBe(before);
  });
  it.each(canonical.flatMap((entry) => ["data", "field:code", "field:version", "field:message", "field:retryable", "field:outcome", "stateful", "name", "stack"].flatMap((kind) =>
    ["canonicalRead", "firstWrite", "postEffectReload"].map((stage) => ({ ...entry, kind, stage })))))
  ("$table $stage hostile $kind descriptor cannot leak or adopt a private code", async (entry) => {
    const f = fixture(); entry.seed(f); const before = snapshot(f.db.table(entry.table)); const fault = poison(entry.kind); let reached = false; let attempts = 0;
    if (entry.stage === "firstWrite") f.db.beforeWrite = () => { reached = true; attempts++; throw fault.error; };
    else { f.db.beforeWrite = () => { attempts++; }; f.db.beforeRead = (table) => { if (table === entry.table && (entry.stage === "canonicalRead" || f.db.writes > 0)) { reached = true; throw fault.error; } }; }
    await failed(async () => await f.db.transaction(async () => await invoke(entry.registration, f.ctx, { ...scope, ...entry.args })), entry.stage === "canonicalRead" ? "failed" : "rolled_back");
    expect(reached).toBe(true); expect(attempts).toBe(entry.stage === "canonicalRead" ? 0 : 1); expect(fault.calls()).toBe(0); expect(f.db.writes).toBe(0); expect(snapshot(f.db.table(entry.table))).toBe(before);
  });
  it.each(selected.flatMap((entry) => ["getPrototypeOf", "ownKeys", "getOwnPropertyDescriptor", "revoked"].map((trap) => ({ ...entry, trap }))))
  ("$path guards thrown Proxy $trap inspection", async (entry) => {
    const f = fixture(); const target = new ConvexError({ ...safeEnvelope }); let trapped = false; let reached = false;
    const handler: ProxyHandler<object> = {};
    if (entry.trap === "getPrototypeOf") handler.getPrototypeOf = () => { trapped = true; throw new Error(marker); };
    if (entry.trap === "ownKeys") handler.ownKeys = () => { trapped = true; throw new Error(marker); };
    if (entry.trap === "getOwnPropertyDescriptor") handler.getOwnPropertyDescriptor = () => { trapped = true; throw new Error(marker); };
    const fault = Proxy.revocable(target, handler); if (entry.trap === "revoked") fault.revoke();
    f.db.beforeRead = () => { reached = true; throw fault.proxy; };
    await failed(async () => await f.db.transaction(async () => await invoke(entry.registration, f.ctx, args(entry))), "failed");
    expect(reached).toBe(true); if (entry.trap !== "revoked") expect(trapped).toBe(true); expect(f.db.writes).toBe(0);
  });
  it.each(canonical.flatMap((entry) => ["hidden", "symbol", "outerHidden", "wrongPair", "missing", "inherited", "dataPrototypeTrap", "dataDescriptorTrap"].map((shape) => ({ ...entry, shape }))))
  ("$table initial optional READ $shape fault stays failed instead of successful receipt", async (entry) => {
    const f = fixture(); entry.seed(f); const before = snapshot(f.db.table(entry.table)); const fault = new ConvexError({ ...safeEnvelope });
    if (entry.shape === "hidden") Object.defineProperty(fault.data, "privateDriverPayload", { value: marker, enumerable: false });
    if (entry.shape === "symbol") Object.defineProperty(fault.data, Symbol(marker), { value: privateCode });
    if (entry.shape === "outerHidden") Object.defineProperty(fault, "privateDriverPayload", { value: marker });
    if (entry.shape === "wrongPair") { fault.data.message = "Verified identity required"; fault.message = JSON.stringify(fault.data); }
    if (entry.shape === "missing") { const { retryable: _unused, ...data } = fault.data; Object.assign(fault, { data, message: JSON.stringify(data) }); }
    if (entry.shape === "inherited") Object.setPrototypeOf(fault.data, { privateDriverPayload: marker });
    let trapped = false;
    if (entry.shape === "dataPrototypeTrap") fault.data = new Proxy(fault.data, { getPrototypeOf: () => { trapped = true; throw new Error(marker); } });
    if (entry.shape === "dataDescriptorTrap") fault.data = new Proxy(fault.data, { getOwnPropertyDescriptor: () => { trapped = true; throw new Error(marker); } });
    let principalReads = 0; let reached = false;
    f.db.beforeRead = (table) => { if (table === "runtimeAuthPrincipals" && ++principalReads === (entry.table === "memorySpaces" ? 5 : 4)) { reached = true; throw fault; } };
    await failed(async () => await f.db.transaction(async () => await invoke(entry.registration, f.ctx, { ...scope, ...entry.args })), "failed");
    expect(reached).toBe(true); if (entry.shape.startsWith("data")) expect(trapped).toBe(true); expect(f.db.writes).toBe(0); expect(snapshot(f.db.table(entry.table))).toBe(before);
  });
  it("a poisoned stack on a native-looking ambiguity is a failure without invoking it", async () => {
    const f = fixture(); const fault = poison("native-stack"); let reached = false;
    f.db.beforeRead = () => { reached = true; throw fault.error; };
    await failed(async () => await invoke(agents.get, f.ctx, { ...scope, agentId: "agent-a" }), "failed");
    expect(reached).toBe(true); expect(fault.calls()).toBe(0); expect(f.db.writes).toBe(0);
  });
  it.each(canonical.flatMap((entry) => [false, true].map((read) => ({ ...entry, read }))))("$table ordinary READ=$read remains available with the correct authorized output", async (entry) => {
    const f = fixture(readCaps(entry.read)); const row = entry.seed(f);
    const result = await f.db.transaction(async () => await invoke(entry.registration, f.ctx, { ...scope, ...entry.args }));
    expect(result).toMatchObject(entry.read ? { _id: row._id, ownerPrincipalId: f.principal._id } : { accepted: true, resourceType: entry.table, resourceId: entry.table === "agents" ? "agent-a" : entry.table === "contexts" ? "context-a" : "space-a" });
    expect(f.db.writes).toBe(1);
  });
});
function readCaps(read: boolean) { return read ? ["admin", "read", "write"] : ["admin", "write"]; }
