import { describe, expect, it } from "@jest/globals";
import { ConvexError, type Value } from "convex/values";
import * as agents from "../../../convex-dev/agents";
import * as spaces from "../../../convex-dev/memorySpaces";
import * as contexts from "../../../convex-dev/contexts";
import { snapshot } from "../../../convex-dev/runtimeRegistryAuth";
import { fixture, invoke, seedAgent, seedContext, seedSpace, type Fixture } from "./fixture";
const scope = { tenantId: "tenant-a", memorySpaceId: "space-a" };
const privateIds = ["stored-private-a", "stored-private-b"];
type ReadMode = "none" | "ownerDenied" | "partial" | "all";
function independentRead(f: Fixture, mode: ReadMode) {
  if (mode === "none") return null;
  return f.db.seed("runtimeAuthGrants", { principalId: f.principal._id, membershipId: f.membership._id, ...scope,
    memorySpaceEpoch: 1, tenantEpoch: 1, capabilities: ["read"], resourceAccess: mode === "all" ? "space" : "own", version: 7, createdAt: 1000 });
}
function owners(f: Fixture, mode: ReadMode) { return mode === "ownerDenied" ? ["peer", "peer"] : [f.principal._id, "peer"]; }
const disclosures = [
  { name: "agent status", registration: agents.unregisterMany, field: "agentIds", args: { status: "active" }, setup: (f: Fixture, mode: ReadMode) => {
    owners(f, mode).forEach((owner, index) => seedAgent(f, { agentId: privateIds[index], ownerPrincipalId: owner }));
  } },
  { name: "context update filter", registration: contexts.updateMany, field: "contextIds", args: { updates: { status: "completed" } }, setup: (f: Fixture, mode: ReadMode) => {
    owners(f, mode).forEach((owner, index) => seedContext(f, { contextId: privateIds[index], rootId: privateIds[index], ownerPrincipalId: owner }));
  } },
  { name: "context delete filter", registration: contexts.deleteMany, field: "contextIds", args: {}, setup: (f: Fixture, mode: ReadMode) => {
    owners(f, mode).forEach((owner, index) => seedContext(f, { contextId: privateIds[index], rootId: privateIds[index], ownerPrincipalId: owner }));
  } },
  { name: "context delete cascade filter", registration: contexts.deleteMany, field: "contextIds", args: { status: "completed", cascadeChildren: true }, setup: (f: Fixture, mode: ReadMode) => {
    const [parentOwner, childOwner] = owners(f, mode);
    seedContext(f, { contextId: privateIds[0], rootId: privateIds[0], ownerPrincipalId: parentOwner, childIds: [privateIds[1]], status: "completed" });
    seedContext(f, { contextId: privateIds[1], rootId: privateIds[0], parentId: privateIds[0], depth: 1, ownerPrincipalId: childOwner });
  } },
  { name: "context orphan children", registration: contexts.deleteContext, field: "orphanedChildren", args: { contextId: "caller-parent", orphanChildren: true }, setup: (f: Fixture, mode: ReadMode) => {
    seedContext(f, { contextId: "caller-parent", rootId: "caller-parent", childIds: privateIds });
    owners(f, mode).forEach((owner, index) => seedContext(f, { contextId: privateIds[index], rootId: "caller-parent", parentId: "caller-parent", depth: 1, ownerPrincipalId: owner }));
  } },
] as const;
async function rejected(run: () => Promise<unknown>, code: string, outcome?: string) {
  let caught: unknown;
  try { await run(); } catch (error) { caught = error; }
  expect(caught).toBeInstanceOf(ConvexError);
  if (!(caught instanceof ConvexError)) throw new Error("Expected an opaque structured registry failure");
  expect(caught.data).toMatchObject({ version: 1, code, retryable: false, ...(outcome ? { outcome } : {}) });
  return caught;
}
describe("cycle2 F1 independent READ before every stored identifier output", () => {
  it.each(disclosures.flatMap((job) => (["none", "ownerDenied", "partial", "all"] as const).map((mode) => ({ ...job, mode }))))
  ("$name under $mode READ returns only eligible identifiers or a count receipt", async (job) => {
    const f = fixture(["write", "admin"], true); job.setup(f, job.mode); const read = independentRead(f, job.mode);
    const result = await f.db.transaction(async () => await invoke<Record<string, unknown>>(job.registration, f.ctx, { ...scope, ...job.args }));
    if (job.mode === "all") expect(result[job.field]).toEqual(privateIds);
    else { expect(result[job.field]).toBeUndefined(); for (const id of privateIds) expect(JSON.stringify(result)).not.toContain(id); }
    expect(result).toMatchObject(job.field === "orphanedChildren" ? { deleted: true, contextId: "caller-parent", descendantsDeleted: 0 } : job.name.includes("update") ? { updated: 2 } : { deleted: 2 });
    expect(f.db.writes).toBeGreaterThan(0);
    if (read) expect(read.version).toBe(7); // Independent current READ generation; ADMIN stays on the tenant WRITE grant.
  });
  it.each(disclosures.flatMap((job) => (["partial", "all"] as const).flatMap((mode) => (["before", "after"] as const).map((stage) => ({ ...job, mode, stage })))))
  ("$name retains $mode READ revocation at $stage first effect and rolls back", async (job) => {
    const f = fixture(["write", "admin"], true); job.setup(f, job.mode); const read = independentRead(f, job.mode)!;
    const table = job.name.startsWith("agent") ? "agents" : "contexts"; const before = snapshot(f.db.table(table)); let reached = false;
    if (job.stage === "before") {
      const original = f.db.get.bind(f.db);
      f.db.get = async (name, id) => { if (!reached && name === "runtimeAuthGrants" && id === read._id) { reached = true; read.revokedAt = 1001; } return await original(name, id); };
    } else f.db.beforeRead = (name) => { if (!reached && name === "runtimeAuthPrincipals" && f.db.writes > 0) { reached = true; read.revokedAt = 1001; } };
    await rejected(async () => await f.db.transaction(async () => await invoke(job.registration, f.ctx, { ...scope, ...job.args })), "FORBIDDEN", job.stage === "before" ? "not_dispatched" : "rolled_back");
    expect(reached).toBe(true); expect(f.db.writes).toBe(0); expect(snapshot(f.db.table(table))).toBe(before);
  });
  it.each(disclosures)("$name retains peer-owner READ eligibility after intended retirement/effects", async (job) => {
    const f = fixture(["write", "admin"], true); job.setup(f, "all"); const read = independentRead(f, "all")!;
    const table = job.name.startsWith("agent") ? "agents" : "contexts"; const before = snapshot(f.db.table(table)); let reached = false;
    f.db.beforeRead = (name) => { if (!reached && name === "runtimeAuthPrincipals" && f.db.writes > 0) { reached = true; read.resourceAccess = "own"; } };
    await rejected(async () => await f.db.transaction(async () => await invoke(job.registration, f.ctx, { ...scope, ...job.args })), "FORBIDDEN", "rolled_back");
    expect(reached).toBe(true); expect(f.db.writes).toBe(0); expect(snapshot(f.db.table(table))).toBe(before);
  });
  it("explicit caller-provided agent IDs remain a safe WRITE+ADMIN receipt", async () => {
    const f = fixture(["write", "admin"]); seedAgent(f);
    expect(await f.db.transaction(async () => await invoke(agents.unregisterMany, f.ctx, { ...scope, agentIds: ["agent-a"] }))).toEqual({ deleted: 1, agentIds: ["agent-a"] });
  });
});
describe("cycle2 F2 resulting graph bound before child insertion", () => {
  it.each([99, 100].flatMap((count) => [false, true].map((read) => ({ count, read }))))("$count nodes with READ=$read validates the resulting full graph before insert", async ({ count, read }) => {
    const f = fixture(read ? ["read", "write"] : ["write"]); seedSpace(f);
    for (let index = 0; index < count; index++) seedContext(f, { contextId: `node-${index}`, rootId: "node-0", parentId: index ? `node-${index - 1}` : undefined,
      depth: index, childIds: index === count - 1 ? [] : [`node-${index + 1}`] });
    const before = snapshot(f.db.table("contexts")); let attempts = 0; f.db.beforeWrite = () => { attempts++; };
    const create = async () => await f.db.transaction(async () => await invoke<Record<string, unknown>>(contexts.create, f.ctx, { ...scope, parentId: `node-${count - 1}`, purpose: "Boundary" }));
    if (count === 100) { await rejected(create, "INVALID_INPUT", "not_dispatched"); expect(attempts).toBe(0); expect(f.db.writes).toBe(0); expect(snapshot(f.db.table("contexts"))).toBe(before); }
    else {
      const created = await create(); expect(f.db.table("contexts")).toHaveLength(100); expect(attempts).toBe(2);
      if (!read) expect(created).toMatchObject({ accepted: true, resourceType: "contexts" });
      // An authorized control grants READ for the subsequent operation, never during the write.
      if (!read) f.grant.capabilities = ["read", "write"];
      const chain = await invoke<Record<string, unknown>>(contexts.getChain, f.ctx, { ...scope, contextId: read ? created.contextId : created.resourceId });
      expect(chain.totalNodes).toBe(100); expect(chain.depth).toBe(99);
    }
  });
});
const modules: Record<string, Record<string, unknown>> = { agents, memorySpaces: spaces, contexts };
const selected = Object.entries(modules).flatMap(([module, values]) => Object.entries(values).filter(([name]) => !["computeStats", "getStats"].includes(name))
  .map(([name, registration]) => ({ module, name, path: `${module}:${name}`, registration })));
const publicPaths = selected.filter((entry) => entry.name !== "purgeAll");
function nativeArgs(entry: typeof selected[number]) {
  if (entry.name === "purgeAll") return {};
  const specific: Record<string, Record<string, unknown>> = {
    register: { agentId: "new-agent", name: "New", type: "personal" }, update: { name: "Updated", description: "Updated" },
    updateMany: { agentIds: ["agent-a"], name: "Bulk", updates: { status: "completed" } }, unregisterMany: { agentIds: ["agent-a"] },
    create: { purpose: "New Task", userId: "user-a" }, addParticipant: { participant: { id: "label-b", type: "user", joinedAt: 1000 }, participantId: "label-b" },
    removeParticipant: { participantId: "label-b" }, grantAccess: { targetMemorySpaceId: "space-a", scope: "read-only" },
    deleteSpace: { cascade: true, reason: "owned test", confirmId: "space-a" }, search: { query: "space" }, updateParticipants: { add: [{ id: "label-b", type: "user", joinedAt: 1000 }] },
    getByConversation: { conversationId: "conversation-a" }, findByParticipant: { participantId: "label-a" }, getVersion: { version: 1 }, getAtTimestamp: { timestamp: 1000 }, exportContexts: { format: "json" },
  };
  const actual = entry.registration as { exportArgs(): string }; const fields = (JSON.parse(actual.exportArgs()) as { value: Record<string, unknown> }).value;
  return Object.fromEntries(Object.entries({ ...scope, agentId: "agent-a", contextId: "context-a", ...specific[entry.name] }).filter(([key]) => Object.prototype.hasOwnProperty.call(fields, key)));
}
const markers = ["native-private-document-id-one", "native-private-document-id-two", "private-driver-payload", "private-control-id"];
function opaque(error: ConvexError<Value>) { const output = JSON.stringify({ message: error.message, data: error.data }); for (const marker of markers) expect(output).not.toContain(marker); }
describe("cycle2 F3 installed native unique and all selected private error paths", () => {
  it("the fixture reproduces the actual installed unique diagnostic before the boundary sanitizes it", async () => {
    const f = fixture(); seedAgent(f, { _id: markers[0] }); seedAgent(f, { _id: markers[1] });
    await expect(f.db.query("agents").unique()).rejects.toThrow("unique() query returned more than one result from table agents:");
    await expect(f.db.query("agents").unique()).rejects.toThrow(markers[0]);
    opaque(await rejected(async () => await invoke(agents.update, f.ctx, { ...scope, agentId: "agent-a", name: "New" }), "FORBIDDEN", "not_dispatched"));
    expect(f.db.writes).toBe(0);
  });
  it.each(publicPaths)("$path distinguishes an unexpected private control read failure from permission denial", async (entry) => {
    const f = fixture(); let reached = false;
    f.db.beforeRead = () => { reached = true; throw new Error(markers.join(" ")); };
    opaque(await rejected(async () => await f.db.transaction(async () => await invoke(entry.registration, f.ctx, nativeArgs(entry))), "REGISTRY_OPERATION_FAILED", "failed"));
    expect(reached).toBe(true); expect(f.db.writes).toBe(0);
  });
  const mutations = selected.filter((entry) => (entry.registration as { isMutation?: boolean }).isMutation === true);
  it.each(mutations)("$path sanitizes an actual rejected first write attempt and retains atomic failure", async (entry) => {
    const f = fixture(); seedSpace(f); seedAgent(f); seedContext(f); if (entry.module === "memorySpaces" && entry.name === "register") f.db.rows.set("memorySpaces", []);
    const before = snapshot([...f.db.rows]); let attempts = 0;
    f.db.beforeWrite = () => { attempts++; throw new Error(markers.join(" ")); };
    opaque(await rejected(async () => await f.db.transaction(async () => await invoke(entry.registration, f.ctx, nativeArgs(entry))), "REGISTRY_OPERATION_FAILED", "rolled_back"));
    expect(attempts).toBe(1); expect(f.db.writes).toBe(0); expect(snapshot([...f.db.rows])).toBe(before);
  });
  const canonicalCases = [
    { table: "agents", registration: agents.update, insert: agents.register, seed: seedAgent, args: { agentId: "agent-a", name: "New" } },
    { table: "memorySpaces", registration: spaces.update, insert: spaces.register, seed: seedSpace, args: { name: "New", type: "personal" } },
    { table: "contexts", registration: contexts.update, insert: contexts.create, seed: seedContext, args: { contextId: "context-a", description: "New", purpose: "New" } },
  ] as const;
  it.each(canonicalCases.flatMap((entry) => ["initial", "reload", "inserted"].map((seam) => ({ ...entry, seam }))))
  ("$table native duplicate at $seam is opaque, denied and transactionally rolled back", async (entry) => {
    const f = fixture(["write", "admin"]); if (entry.seam !== "inserted") entry.seed(f, { _id: markers[0] });
    if (entry.table === "contexts" && entry.seam === "inserted") seedSpace(f);
    let reached = false;
    if (entry.seam === "initial") { entry.seed(f, { _id: markers[1] }); reached = true; }
    else f.db.beforeRead = (table) => { if (!reached && table === entry.table && f.db.writes > 0) {
      reached = true; const first = f.db.table(entry.table)[0]!; f.db.seed(entry.table, { ...first, _id: markers[1] });
    } };
    const before = snapshot(f.db.table(entry.table));
    opaque(await rejected(async () => await f.db.transaction(async () => await invoke(entry.seam === "inserted" ? entry.insert : entry.registration, f.ctx, { ...scope, ...entry.args })), "FORBIDDEN", entry.seam === "initial" ? "not_dispatched" : "rolled_back"));
    expect(reached).toBe(true); expect(f.db.writes).toBe(0); expect(snapshot(f.db.table(entry.table))).toBe(before);
  });
  it.each(["runtimeAuthTombstones", "runtimeAuthScopes"])("retained %s native ambiguity after retirement stays opaque and rolls back", async (table) => {
    const f = fixture(); seedAgent(f); let reached = false;
    f.db.beforeRead = (name) => { if (!reached && name === table && f.db.writes > 0) {
      reached = true; const original = f.db.table(table).find((row) => table === "runtimeAuthTombstones" || row.memorySpaceId === "space-a")!;
      f.db.seed(table, { ...original, _id: markers[1] });
    } };
    opaque(await rejected(async () => await f.db.transaction(async () => await invoke(agents.unregister, f.ctx, { ...scope, agentId: "agent-a" })), "FORBIDDEN", "rolled_back"));
    expect(reached).toBe(true); expect(f.db.writes).toBe(0); expect(f.db.table("runtimeAuthTombstones")).toEqual([]);
  });
  it.each(canonicalCases)("$table unexpected canonical reload after an effect stays a separate failed operation", async (entry) => {
    const f = fixture(); entry.seed(f); const before = snapshot(f.db.table(entry.table)); let reached = false;
    f.db.beforeRead = (table) => { if (!reached && table === entry.table && f.db.writes > 0) { reached = true; throw new Error(markers.join(" ")); } };
    opaque(await rejected(async () => await f.db.transaction(async () => await invoke(entry.registration, f.ctx, { ...scope, ...entry.args })), "REGISTRY_OPERATION_FAILED", "rolled_back"));
    expect(reached).toBe(true); expect(f.db.writes).toBe(0); expect(snapshot(f.db.table(entry.table))).toBe(before);
  });
  it.each(canonicalCases)("$table unexpected inserted-row reload failure is opaque and rolls back", async (entry) => {
    const f = fixture(["write", "admin"]); if (entry.table === "contexts") seedSpace(f); let reached = false;
    f.db.beforeRead = (table) => { if (!reached && table === entry.table && f.db.writes > 0) { reached = true; throw new Error(markers.join(" ")); } };
    opaque(await rejected(async () => await f.db.transaction(async () => await invoke(entry.insert, f.ctx, { ...scope, ...entry.args })), "REGISTRY_OPERATION_FAILED", "rolled_back"));
    expect(reached).toBe(true); expect(f.db.writes).toBe(0); expect(f.db.table(entry.table)).toEqual([]);
  });
  it.each(["runtimeAuthScopes", "runtimeAuthTombstones"])("unexpected permission-looking %s driver error cannot be pruned as an authority candidate", async (table) => {
    const f = fixture(); let reached = false;
    f.db.beforeRead = (name) => { if (!reached && name === table) { reached = true; throw new ConvexError({ code: "FORBIDDEN", message: markers.join(" "), private: markers }); } };
    opaque(await rejected(async () => await invoke(agents.update, f.ctx, { ...scope, agentId: "agent-a", name: "New" }), "REGISTRY_OPERATION_FAILED", "failed"));
    expect(reached).toBe(true); expect(f.db.writes).toBe(0);
  });
  it("an unexpected ConvexError with a permission-looking code and private data cannot become a safe receipt", async () => {
    const f = fixture(["write", "admin"]); seedAgent(f); let reached = false;
    f.db.beforeRead = (table) => { if (!reached && table === "runtimeAuthPrincipals" && f.db.traces.some((trace) => trace.table === "agents")) {
      reached = true; throw new ConvexError({ code: "FORBIDDEN", message: markers.join(" "), private: markers });
    } };
    opaque(await rejected(async () => await invoke(agents.update, f.ctx, { ...scope, agentId: "agent-a", name: "New" }), "REGISTRY_OPERATION_FAILED", "failed"));
    expect(reached).toBe(true); expect(f.db.writes).toBe(0);
  });
});
describe("cycle2 F4 typed staged conversation capability", () => {
  it.each(["missing", "invalid", "absentGrant", "valid", "lateRevoked"])("$status authority reports accurate denial/readiness before transcript hydration", async (status) => {
    const f = fixture(); let reached = false;
    if (status === "invalid") Object.assign(f.ctx, { auth: { getUserIdentity: async () => ({ issuer: "https://host.test", subject: "forged" }) } });
    if (status === "absentGrant") f.grant.capabilities = ["write", "admin"];
    if (status === "lateRevoked") { const original = f.db.get.bind(f.db); f.db.get = async (table, id) => {
      if (!reached && table === "runtimeAuthGrants") { reached = true; f.grant.revokedAt = 1001; } return await original(table, id);
    }; }
    const expected = status === "missing" ? "UNAUTHENTICATED" : status === "valid" ? "CAPABILITY_NOT_READY" : "FORBIDDEN";
    await rejected(async () => await invoke(contexts.getByConversation, status === "missing" ? f.anonymous : f.ctx, { ...scope, conversationId: "private-conversation" }), expected, "not_dispatched");
    expect(f.db.writes).toBe(0); expect(f.db.traces.some((trace) => trace.table === "conversations")).toBe(false);
    if (status === "lateRevoked") expect(reached).toBe(true);
  });
});
