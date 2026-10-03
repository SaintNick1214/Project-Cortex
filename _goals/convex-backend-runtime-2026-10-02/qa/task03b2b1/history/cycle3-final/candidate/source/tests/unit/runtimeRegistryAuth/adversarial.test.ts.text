import { describe, expect, it } from "@jest/globals";
import * as agents from "../../../convex-dev/agents";
import * as spaces from "../../../convex-dev/memorySpaces";
import * as contexts from "../../../convex-dev/contexts";
import { RegistryAccess, resource } from "../../../convex-dev/runtimeRegistryAuth";
import { jsonToConvex } from "convex/values";
import { fixture, invoke, seedAgent, seedContext, seedSpace, addSpaceGrant, type Fixture } from "./fixture";
const scope = { tenantId: "tenant-a", memorySpaceId: "space-a" };
const forbidden = { data: { code: "FORBIDDEN" } };
function graph(f: Fixture, secondSpace = false) {
  const parent = seedContext(f, { childIds: ["context-b"] });
  if (secondSpace) addSpaceGrant(f);
  const child = seedContext(f, { contextId: "context-b", parentId: "context-a", rootId: "context-a", depth: 1, memorySpaceId: secondSpace ? "space-b" : "space-a" });
  return { parent, child };
}
describe("canonical scope, labels, bulk preflight and independent capabilities", () => {
  it.each([[agents.list, "agents", seedAgent], [spaces.list, "memorySpaces", seedSpace], [contexts.list, "contexts", seedContext]] as const)("scopes %s before hydration/filter/limit even with foreign rows first", async (registration, table, seed) => {
    const f = fixture(); seed(f, { tenantId: "tenant-b", ownerPrincipalId: "foreign" }); seed(f, { ownerPrincipalId: "foreign" }); seed(f, { ownerPrincipalId: undefined });
    const own = seed(f); const result = await invoke<Record<string, unknown>>(registration, f.ctx, { ...scope, limit: 1 });
    expect(table === "memorySpaces" ? result.spaces : result).toEqual([own]);
    const traces = f.db.traces.filter((trace) => trace.table === table); expect(traces.length).toBeGreaterThan(0);
    for (const trace of traces) { expect(trace.keys).toContainEqual(["tenantId", "tenant-a"]); expect(trace.returned).toEqual([own._id]); }
  });
  it.each([[agents.update, seedAgent, { agentId: "agent-a", name: "Overwrite" }], [spaces.update, seedSpace, { memorySpaceId: "space-a", name: "Overwrite" }], [contexts.update, seedContext, { contextId: "context-a", data: { overwrite: true } }]] as const)("never adopts foreign or absent canonical owners in %s", async (registration, seed, extra) => {
    for (const owner of ["foreign", undefined]) { const f = fixture(); const row = seed(f, { ownerPrincipalId: owner });
      await expect(invoke(registration, f.ctx, { ...scope, ...extra })).rejects.toMatchObject(forbidden); expect(f.db.writes).toBe(0); expect(row.name ?? row.data).not.toEqual("Overwrite"); }
  });
  it.each([[agents.register, "agents", seedAgent, { agentId: "agent-a", name: "New" }], [spaces.register, "memorySpaces", seedSpace, { type: "personal" }]] as const)("same-key foreign/unowned collision in %s yields only opaque conflict and zero effects", async (registration, table, seed, extra) => {
    for (const owner of ["foreign", undefined]) { const f = fixture(); const foreign = seed(f, { ownerPrincipalId: owner, metadata: { secret: "never returned" } });
      await expect(invoke(registration, f.ctx, { ...scope, ...extra })).rejects.toMatchObject(forbidden); expect(f.db.writes).toBe(0);
      const reads = f.db.traces.filter((trace) => trace.table === table); expect(reads).toHaveLength(1); expect(reads[0]!.returned).toEqual([foreign._id]);
      expect(reads[0]!.keys).toContainEqual(["tenantId", "tenant-a"]); expect(reads[0]!.keys).toContainEqual(["memorySpaceId", "space-a"]); }
  });
  it("omitted selectors derive exactly one scope, while two spaces/tenants deny without domain hydration", async () => {
    const f = fixture(); const own = seedAgent(f); expect(await invoke(agents.get, f.ctx, { agentId: "agent-a" })).toEqual(own);
    addSpaceGrant(f); f.db.traces = []; await expect(invoke(agents.get, f.ctx, { agentId: "agent-a" })).rejects.toMatchObject(forbidden);
    expect(f.db.traces.some((trace) => trace.table === "agents")).toBe(false);
    expect(await invoke(agents.get, f.ctx, { ...scope, agentId: "agent-a" })).toEqual(own);
  });
  it.each(["admin", "write", "read"])("registry mutation cannot treat %s as a capability wildcard", async (capability) => {
    const f = fixture([capability]); seedSpace(f); seedAgent(f);
    await expect(invoke(agents.update, f.ctx, { ...scope, agentId: "agent-a", name: "No" })).rejects.toMatchObject(forbidden); expect(f.db.writes).toBe(0);
    await expect(invoke(spaces.addParticipant, f.ctx, { ...scope, participant: { id: "admin", type: "admin", joinedAt: 1000 } })).rejects.toMatchObject(forbidden); expect(f.db.writes).toBe(0);
  });
  it.each([[agents.update, seedAgent, { agentId: "agent-a", name: "Written" }], [spaces.update, seedSpace, { name: "Written" }], [contexts.update, seedContext, { contextId: "context-a", data: { written: true } }]] as const)("initial absent READ permits %s only with a safe receipt", async (registration, seed, extra) => {
    const f = fixture(["write", "admin"]); seed(f); const result = await invoke<Record<string, unknown>>(registration, f.ctx, { ...scope, ...extra });
    expect(result).toEqual({ accepted: true, resourceType: registration === agents.update ? "agents" : registration === spaces.update ? "memorySpaces" : "contexts", resourceId: registration === agents.update ? "agent-a" : registration === spaces.update ? "space-a" : "context-a" });
    expect(f.db.writes).toBe(1); expect(result.data).toBeUndefined(); expect(result.metadata).toBeUndefined(); expect(result.config).toBeUndefined();
  });
  it("register/create derive owners and privileged user binding without provisioning control records", async () => {
    const f = fixture(); seedSpace(f); const controls = structuredClone([f.db.table("runtimeAuthPrincipals"), f.db.table("runtimeAuthMemberships"), f.db.table("runtimeAuthGrants"), f.db.table("runtimeAuthScopes")]);
    const agent = await invoke<Record<string, unknown>>(agents.register, f.ctx, { ...scope, agentId: "admin", name: "Admin", config: { roles: ["admin"], tenantId: "tenant-b" } });
    expect(agent.ownerPrincipalId).toBe(f.principal._id); expect(agent.tenantId).toBe("tenant-a");
    await expect(invoke(contexts.create, f.ctx, { ...scope, purpose: "Forge", userId: "foreign" })).rejects.toMatchObject(forbidden);
    const created = await invoke<Record<string, unknown>>(contexts.create, f.ctx, { ...scope, purpose: "Owned" }); expect(created.userId).toBe("user-a");
    expect([f.db.table("runtimeAuthPrincipals"), f.db.table("runtimeAuthMemberships"), f.db.table("runtimeAuthGrants"), f.db.table("runtimeAuthScopes")]).toEqual(controls);
  });
  it.each(["missing", "foreign", "tombstone", "duplicate", "shape"])("agent bulk %s fails before its first write", async (problem) => {
    const f = fixture(); seedAgent(f); const second = problem === "missing" ? null : seedAgent(f, { agentId: "agent-b", ...(problem === "foreign" ? { ownerPrincipalId: "foreign" } : problem === "tombstone" ? { tombstonedAt: 1000 } : problem === "shape" ? { status: "not-valid" } : {}) });
    const ids = problem === "duplicate" ? ["agent-a", "agent-a"] : ["agent-a", "agent-b"];
    await expect(invoke(agents.updateMany, f.ctx, { ...scope, agentIds: ids, name: "No" })).rejects.toBeDefined(); expect(f.db.writes).toBe(0);
    expect(f.db.table("agents")[0]!.name).toBe("Agent A"); if (second) expect(second.name).toBe("Agent A");
  });
  it("bulk version overflow and malformed history deny before earlier valid context writes", async () => {
    for (const overrides of [{ version: Number.MAX_SAFE_INTEGER }, { previousVersions: [{ version: 0, status: "active", timestamp: 1000 }] }]) {
      const f = fixture(); seedContext(f); seedContext(f, { contextId: "context-b", rootId: "context-b", ...overrides });
      await expect(invoke(contexts.updateMany, f.ctx, { ...scope, updates: { status: "completed" } })).rejects.toBeDefined(); expect(f.db.writes).toBe(0); expect(f.db.table("contexts")[0]!.status).toBe("active");
    }
  });
  it("participant bulk rejects duplicates/collisions before effects", async () => {
    const f = fixture(); seedSpace(f, { participants: [{ id: "exists", type: "user", joinedAt: 1000 }] });
    for (const args of [{ add: [{ id: "dup", type: "user", joinedAt: 1000 }, { id: "dup", type: "user", joinedAt: 1000 }] }, { add: [{ id: "exists", type: "user", joinedAt: 1000 }] }, { add: [{ id: "both", type: "user", joinedAt: 1000 }], remove: ["both"] }]) {
      await expect(invoke(spaces.updateParticipants, f.ctx, { ...scope, ...args })).rejects.toMatchObject({ data: { code: "INVALID_INPUT" } }); expect(f.db.writes).toBe(0);
    }
  });
});
describe("whole-graph links, cross-space grants, deletion and revision attribution", () => {
  it("cross-space hierarchy preserves independently admitted current grants for each actual space", async () => {
    const f = fixture(); const { parent, child } = graph(f, true);
    const result = await invoke<Record<string, unknown>>(contexts.getChain, f.ctx, { ...scope, contextId: "context-a" });
    expect(result).toMatchObject({ current: parent, root: parent, children: [child], descendants: [child], totalNodes: 2 });
    const other = f.db.table("runtimeAuthGrants").find((row) => row.memorySpaceId === "space-b")!; other.revokedAt = 1000;
    await expect(invoke(contexts.getChain, f.ctx, { ...scope, contextId: "context-a" })).rejects.toMatchObject(forbidden);
  });
  it.each(["parent", "root", "child", "duplicate", "cycle", "depth", "owner", "ambiguous"])("malformed/foreign %s link denies the whole graph", async (problem) => {
    const f = fixture(); const { parent, child } = graph(f);
    if (problem === "parent") child.parentId = "missing";
    if (problem === "root") child.rootId = "missing";
    if (problem === "child") parent.childIds = ["missing"];
    if (problem === "duplicate") parent.childIds = ["context-b", "context-b"];
    if (problem === "cycle") child.childIds = ["context-a"];
    if (problem === "depth") child.depth = 99;
    if (problem === "owner") child.ownerPrincipalId = "foreign";
    if (problem === "ambiguous") { addSpaceGrant(f); seedContext(f, { contextId: "context-b", rootId: "context-b", memorySpaceId: "space-b" }); }
    await expect(invoke(contexts.getChain, f.ctx, { ...scope, contextId: "context-a" })).rejects.toBeDefined(); expect(f.db.writes).toBe(0);
  });
  it("descriptive grantedAccess and participants cannot replace a current target-space grant", async () => {
    const f = fixture(); const { parent, child } = graph(f); child.memorySpaceId = "space-b";
    parent.grantedAccess = [{ memorySpaceId: "space-b", scope: "admin", grantedAt: 1000 }]; parent.participants = ["space-a", "space-b"];
    await expect(invoke(contexts.getChain, f.ctx, { ...scope, contextId: "context-a" })).rejects.toMatchObject(forbidden);
    await expect(invoke(contexts.grantAccess, f.ctx, { ...scope, contextId: "context-a", targetMemorySpaceId: "space-b", scope: "admin" })).rejects.toMatchObject(forbidden);
    expect(f.db.writes).toBe(0);
  });
  it("grantAccess requires current target metadata/grant and only writes descriptive metadata", async () => {
    const f = fixture(); seedContext(f); addSpaceGrant(f); const grants = structuredClone(f.db.table("runtimeAuthGrants"));
    const result = await invoke<Record<string, unknown>>(contexts.grantAccess, f.ctx, { ...scope, contextId: "context-a", targetMemorySpaceId: "space-b", scope: "read-only" });
    expect(result.grantedAccess).toEqual([{ memorySpaceId: "space-b", scope: "read-only", grantedAt: expect.any(Number) }]); expect(f.db.table("runtimeAuthGrants")).toEqual(grants);
  });
  it("child creation changes parent topology and versions with the actual writer", async () => {
    const f = fixture(); seedSpace(f); const parent = seedContext(f);
    const result = await invoke<Record<string, unknown>>(contexts.create, f.ctx, { ...scope, purpose: "Child", parentId: "context-a" });
    expect(result).toMatchObject({ rootId: "context-a", parentId: "context-a", depth: 1, lastUpdatedBy: f.principal._id });
    expect(parent).toMatchObject({ version: 2, childIds: [result.contextId], lastUpdatedBy: f.principal._id });
    expect(parent.previousVersions).toEqual([{ version: 1, status: "active", data: { private: "a" }, timestamp: 1000, updatedBy: f.principal._id }]);
  });
  it("cross-principal writer is distinct from owner and the archived revision preserves its own writer", async () => {
    const f = fixture(); f.grant.resourceAccess = "space"; const row = seedContext(f, { ownerPrincipalId: "owner-other", lastUpdatedBy: "writer-original" });
    const result = await invoke<Record<string, unknown>>(contexts.update, f.ctx, { ...scope, contextId: "context-a", data: { updated: true } });
    expect(result).toMatchObject({ ownerPrincipalId: "owner-other", lastUpdatedBy: f.principal._id, version: 2 });
    expect(row.previousVersions).toEqual([{ version: 1, status: "active", data: { private: "a" }, timestamp: 1000, updatedBy: "writer-original" }]);
    expect(await invoke(contexts.getVersion, f.ctx, { ...scope, contextId: "context-a", version: 2 })).toMatchObject({ updatedBy: f.principal._id });
  });
  it("missing prior actor stays unknown and never fabricates owner attribution", async () => {
    const f = fixture(); const row = seedContext(f, { lastUpdatedBy: undefined }); await invoke(contexts.update, f.ctx, { ...scope, contextId: "context-a", status: "completed" });
    expect((row.previousVersions as Record<string, unknown>[])[0]!.updatedBy).toBeUndefined(); expect(row.lastUpdatedBy).toBe(f.principal._id);
  });
  it("orphan deletion repairs all descendant root/depth links and records revisions", async () => {
    const f = fixture(); const { parent, child } = graph(f); child.childIds = ["context-c"];
    const grandchild = seedContext(f, { contextId: "context-c", parentId: "context-b", rootId: "context-a", depth: 2 });
    expect(await invoke(contexts.deleteContext, f.ctx, { ...scope, contextId: "context-a", orphanChildren: true })).toEqual({ deleted: true, contextId: "context-a", descendantsDeleted: 0, orphanedChildren: ["context-b"] });
    expect(parent.tombstonedAt).toEqual(expect.any(Number)); expect(child).toMatchObject({ rootId: "context-b", depth: 0, version: 2 }); expect(child).not.toHaveProperty("parentId"); expect(grandchild).toMatchObject({ rootId: "context-b", depth: 1, version: 2 });
    expect(await invoke(contexts.getChain, f.ctx, { ...scope, contextId: "context-b" })).toMatchObject({ totalNodes: 2 });
  });
  it("overlapping cascade bulk preflights and retires each row exactly once", async () => {
    const f = fixture(); const { parent, child } = graph(f);
    expect(await invoke(contexts.deleteMany, f.ctx, { ...scope, cascadeChildren: true })).toEqual({ deleted: 2, contextIds: ["context-a", "context-b"] });
    expect(f.db.table("runtimeAuthTombstones")).toHaveLength(2); expect(parent.tombstonedAt).toEqual(expect.any(Number)); expect(child.tombstonedAt).toEqual(expect.any(Number));
  });
  it.each([false, true])("space deletion retains canonical/control barriers for tenant-wide=%s and reports downstream cascade pending", async (tenantOnly) => {
    const f = fixture(undefined, tenantOnly); const row = seedSpace(f); const source = f.db.seed("runtimeMemorySources", { resource: "retained" });
    const result = await invoke<Record<string, unknown>>(spaces.deleteSpace, f.ctx, { ...scope, cascade: true, reason: "owned" });
    expect(result).toMatchObject({ deleted: true, cascade: { status: "pending", memoriesDeleted: 0, conversationsDeleted: 0, factsDeleted: 0 }, pendingTasks: ["08", "12", "15"] });
    expect(row.tombstonedAt).toEqual(expect.any(Number)); expect(f.db.table("runtimeAuthScopes").find((scope) => scope.memorySpaceId === "space-a")).toMatchObject({ epoch: 2, deletedAt: expect.any(Number) });
    expect(f.db.table("runtimeAuthGrants")).toHaveLength(1); expect(f.db.table("runtimeMemorySources")).toEqual([source]);
    for (const [registration, args] of [[spaces.register, { type: "personal" }], [spaces.reactivate, {}], [contexts.create, { purpose: "Resurrect" }], [agents.register, { agentId: "late", name: "Late" }]]) {
      await expect(invoke(registration, f.ctx, { ...scope, ...args })).rejects.toMatchObject(forbidden);
    }
  });
  it("conversation references and anchors fail closed before any raw transcript hydration", async () => {
    const f = fixture(); seedSpace(f); const row = seedContext(f, { conversationRef: { conversationId: "conversation-a", messageIds: ["message-a"] } });
    f.db.seed("conversations", { tenantId: "tenant-a", memorySpaceId: "space-a", conversationId: "conversation-a", messages: [{ id: "message-a", content: "private reasoning" }] });
    for (const [registration, args] of [[contexts.get, { contextId: "context-a", includeConversation: true }], [contexts.create, { purpose: "Source", conversationRef: row.conversationRef }], [contexts.getByConversation, { conversationId: "conversation-a" }]]) {
      await expect(invoke(registration, f.ctx, { ...scope, ...args })).rejects.toMatchObject({ data: { code: "CAPABILITY_NOT_READY" } });
    }
    expect(f.db.writes).toBe(0); expect(f.db.traces.some((trace) => trace.table === "conversations")).toBe(false);
  });
});
describe("retained authority/row witnesses through the last await and atomic rollback", () => {
  it.each(["read", "write", "admin"])("late admitted %s loss after a mutation effect denies and rolls back", async (lost) => {
    const f = fixture(); const row = seedAgent(f); const before = structuredClone(row); let changed = false;
    f.db.beforeRead = (table) => { if (!changed && table === "runtimeAuthPrincipals" && f.db.writes > 0) { changed = true; f.grant.capabilities = (f.grant.capabilities as string[]).filter((cap) => cap !== lost); } };
    await expect(f.db.transaction(async () => await invoke(agents.update, f.ctx, { ...scope, agentId: "agent-a", name: "Late" }))).rejects.toMatchObject(forbidden);
    expect(changed).toBe(true); expect(f.db.writes).toBe(0); expect(f.db.table("agents")).toEqual([before]);
  });
  it("late peer revocation retains the earlier cross-space graph grant and rolls back the parent edit", async () => {
    const f = fixture(); const { parent } = graph(f, true); const before = structuredClone(parent); const peer = f.db.table("runtimeAuthGrants").find((row) => row.memorySpaceId === "space-b")!; let changed = false;
    f.db.beforeRead = (table) => { if (!changed && table === "runtimeAuthPrincipals" && f.db.writes > 0) { changed = true; peer.revokedAt = 1000; } };
    await expect(f.db.transaction(async () => await invoke(contexts.update, f.ctx, { ...scope, contextId: "context-a", status: "completed" }))).rejects.toMatchObject(forbidden);
    expect(changed).toBe(true); expect(f.db.writes).toBe(0); expect(f.db.table("contexts")[0]).toEqual(before);
  });
  it("later row admission cannot silently rebind an earlier row's topology/version/owner", async () => {
    const f = fixture(); const { parent, child } = graph(f); let changed = false;
    f.db.beforeRead = (table) => { if (!changed && table === "contexts" && f.db.traces.some((trace) => trace.returned.includes(child._id))) { changed = true; parent.ownerPrincipalId = "foreign"; } };
    await expect(invoke(contexts.getChain, f.ctx, { ...scope, contextId: "context-a" })).rejects.toMatchObject(forbidden); expect(changed).toBe(true); expect(f.db.writes).toBe(0);
  });
  it("late canonical tombstone before delivery denies private output", async () => {
    const f = fixture(); seedAgent(f); let changed = false;
    f.db.beforeRead = (table) => { if (!changed && table === "runtimeAuthPrincipals" && f.db.traces.filter((trace) => trace.table === "agents").length > 0) { changed = true;
      f.db.seed("runtimeAuthTombstones", { ...scope, resourceType: "source", resourceId: JSON.stringify(["agents", "agent-a"]), deletedAt: 1000 }); } };
    await expect(invoke(agents.get, f.ctx, { ...scope, agentId: "agent-a" })).rejects.toMatchObject(forbidden); expect(changed).toBe(true);
  });
  it("bulk database failure rolls back earlier effects and never suppresses the failure", async () => {
    const f = fixture(); const first = seedAgent(f); const second = seedAgent(f, { agentId: "agent-b" }); const before = structuredClone([first, second]);
    let reached = false;
    f.db.beforeWrite = (table) => { if (table === "agents" && f.db.writes === 1) { reached = true; throw new Error("Atomic DB failure"); } };
    await expect(f.db.transaction(async () => await invoke(agents.updateMany, f.ctx, { ...scope, agentIds: ["agent-a", "agent-b"], name: "No" }))).rejects.toMatchObject({ data: { code: "REGISTRY_OPERATION_FAILED", outcome: "rolled_back" } });
    expect(reached).toBe(true); expect(f.db.writes).toBe(0); expect(f.db.table("agents")).toEqual(before);
  });
  it("independent admitted READ references remain pinned when a WRITE grant still exists", async () => {
    const f = fixture(); seedContext(f); const access = await RegistryAccess.open(f.ctx, "write", scope);
    expect(await access.optionalRead(resource("contexts", { ...scope, contextId: "context-a", ownerPrincipalId: f.principal._id }))).toBe(true);
    f.grant.capabilities = ["write", "admin"]; await expect(access.fence()).rejects.toMatchObject(forbidden);
  });
});

describe("snapshot stability across repeated canonical admission", () => {
  it("a repeated graph root lookup cannot adopt a new valid version while later children are checked", async () => {
    const f = fixture(); const { parent } = graph(f); let changed = false;
    f.db.beforeRead = (table) => { if (!changed && table === "contexts" && f.db.traces.filter((trace) => trace.returned.includes(parent._id)).length === 1) {
      changed = true; parent.previousVersions = [{ version: 1, status: "active", data: { private: "a" }, timestamp: 1000, updatedBy: f.principal._id }]; parent.version = 2; parent.data = { private: "rebound" };
    } };
    await expect(invoke(contexts.getChain, f.ctx, { ...scope, contextId: "context-a" })).rejects.toMatchObject(forbidden); expect(changed).toBe(true); expect(f.db.writes).toBe(0);
  });
  it("an agent list cannot deliver an earlier payload after a later canonical reload changed it", async () => {
    const f = fixture(); const row = seedAgent(f); let changed = false;
    f.db.beforeRead = (table) => { if (!changed && table === "agents" && f.db.traces.filter((trace) => trace.table === "agents").length === 1) { changed = true; row.config = { secret: "rebound" }; } };
    await expect(invoke(agents.list, f.ctx, scope)).rejects.toMatchObject(forbidden); expect(changed).toBe(true);
  });
});

describe("mutation collision and serializable-data preflight", () => {
  it.each([[agents.update, seedAgent, { agentId: "agent-a", name: "No" }], [agents.unregister, seedAgent, { agentId: "agent-a" }],
    [spaces.update, seedSpace, { name: "No" }], [spaces.deleteSpace, seedSpace, { cascade: true, reason: "No" }],
    [contexts.update, seedContext, { contextId: "context-a", status: "completed" }], [contexts.deleteContext, seedContext, { contextId: "context-a" }]] as const)("foreign same-key collision blocks %s before its first effect", async (registration, seed, args) => {
    const f = fixture(); seed(f, { ownerPrincipalId: "foreign", metadata: { private: "discarded" } }); const own = seed(f); const before = structuredClone(own);
    await expect(invoke(registration, f.ctx, { ...scope, ...args })).rejects.toMatchObject(forbidden);
    expect(f.db.writes).toBe(0); expect(f.db.table("runtimeAuthTombstones")).toEqual([]); expect(own).toEqual(before);
  });
  it("a collision introduced while checking a later bulk target remains a retained Boolean witness", async () => {
    const f = fixture(); const first = seedAgent(f); const second = seedAgent(f, { agentId: "agent-b" }); let changed = false;
    f.db.beforeRead = (table) => { if (!changed && table === "agents" && f.db.traces.some((trace) => trace.returned.includes(second._id))) {
      changed = true; seedAgent(f, { agentId: "agent-a", ownerPrincipalId: "foreign", config: { private: "discarded" } });
    } };
    await expect(invoke(agents.updateMany, f.ctx, { ...scope, agentIds: ["agent-a", "agent-b"], name: "No" })).rejects.toMatchObject(forbidden);
    expect(changed).toBe(true); expect(f.db.writes).toBe(0); expect(first.name).toBe("Agent A"); expect(second.name).toBe("Agent A");
  });
  const cycle: Record<string, unknown> = {}; cycle.self = cycle;
  class Unsupported { value = true; }
  it.each([new Date(0), new Map([["unsupported", true]]), { value: BigInt("9223372036854775808") }, new Unsupported(), cycle])("native-invalid bulk config denies before all effects", async (config) => {
    const f = fixture(); seedAgent(f); seedAgent(f, { agentId: "agent-b" });
    await expect(invoke(agents.updateMany, f.ctx, { ...scope, agentIds: ["agent-a", "agent-b"], config })).rejects.toMatchObject({ data: { code: "INVALID_INPUT" } }); expect(f.db.writes).toBe(0);
  });
  it("context retirement creates an attributed revision before retaining the tombstone", async () => {
    const f = fixture(); const row = seedContext(f, { lastUpdatedBy: "prior-actor" });
    await invoke(contexts.deleteContext, f.ctx, { ...scope, contextId: "context-a" });
    expect(row).toMatchObject({ version: 2, lastUpdatedBy: f.principal._id, tombstonedAt: expect.any(Number) });
    expect(row.previousVersions).toEqual([{ version: 1, status: "active", data: { private: "a" }, timestamp: 1000, updatedBy: "prior-actor" }]);
  });
});

describe("create/register initial READ admission and distinct pinned READ generation", () => {
  function independentRead(f: Fixture) {
    return f.db.seed("runtimeAuthGrants", { principalId: f.principal._id, membershipId: f.membership._id, tenantId: "tenant-a",
      tenantEpoch: 1, capabilities: ["read"], resourceAccess: "own", version: 1, createdAt: 1000 });
  }
  const creates = [
    [agents.register, "agents", { agentId: "new", name: "New", config: { private: "no receipt payload" } }],
    [spaces.register, "memorySpaces", { type: "personal", metadata: { private: "no receipt payload" } }],
    [contexts.create, "contexts", { purpose: "New", data: { private: "no receipt payload" } }],
  ] as const;
  it.each(creates)("initially unavailable READ for %s permits only a safe receipt", async (registration, table, args) => {
    const f = fixture(["write", "admin"]); if (table === "contexts") seedSpace(f);
    const result = await invoke<Record<string, unknown>>(registration, f.ctx, { ...scope, ...args });
    expect(result).toEqual({ accepted: true, resourceType: table, resourceId: table === "agents" ? "new" : table === "memorySpaces" ? "space-a" : expect.stringMatching(/^ctx-/) });
    expect(f.db.writes).toBe(1); expect(f.db.table(table)).toHaveLength(1); expect(result.data).toBeUndefined(); expect(result.config).toBeUndefined(); expect(result.metadata).toBeUndefined();
  });
  it.each(creates)("already-admitted independent READ revoked at the actual %s insert attempt denies and rolls back", async (registration, table, args) => {
    const f = fixture(["write", "admin"]); if (table === "contexts") seedSpace(f); const read = independentRead(f); let attempted = false;
    f.db.beforeWrite = (target) => { if (target === table) { attempted = true; read.revokedAt = 1000; } };
    await expect(f.db.transaction(async () => await invoke(registration, f.ctx, { ...scope, ...args }))).rejects.toMatchObject(forbidden);
    expect(attempted).toBe(true); expect(f.db.writes).toBe(0); expect(f.db.table(table)).toEqual([]);
    expect(f.db.table("runtimeAuthGrants").find((grant) => grant.memorySpaceId === "space-a")!.capabilities).toEqual(["write", "admin"]);
  });
  it.each([[agents.update, "agents", seedAgent, { agentId: "agent-a", name: "No" }], [spaces.update, "memorySpaces", seedSpace, { name: "No" }], [contexts.update, "contexts", seedContext, { contextId: "context-a", status: "completed" }]] as const)("distinct pinned READ lost at the actual %s patch attempt denies rather than replacing the response with a receipt", async (registration, table, seed, args) => {
    const f = fixture(["write", "admin"]); const row = seed(f); const before = structuredClone(row); const read = independentRead(f); let attempted = false;
    f.db.beforeWrite = (target) => { if (target === table) { attempted = true; read.revokedAt = 1000; } };
    await expect(f.db.transaction(async () => await invoke(registration, f.ctx, { ...scope, ...args }))).rejects.toMatchObject(forbidden);
    expect(attempted).toBe(true); expect(f.db.writes).toBe(0); expect(f.db.table(table)).toEqual([before]);
    expect(f.db.table("runtimeAuthGrants").find((grant) => grant.memorySpaceId === "space-a")!.capabilities).toEqual(["write", "admin"]);
  });
});

describe("retired canonical rows and exact tombstones survive the final deletion barrier", () => {
  const retirements = [
    [agents.unregister, "agents", seedAgent, { agentId: "agent-a" }],
    [agents.unregisterMany, "agents", seedAgent, { agentIds: ["agent-a"] }],
    [contexts.deleteContext, "contexts", seedContext, { contextId: "context-a" }],
    [contexts.deleteMany, "contexts", seedContext, {}],
  ] as const;
  it.each(retirements)("late retired row or resource fence changes in %s deny and roll back", async (registration, table, seed, args) => {
    for (const change of ["owner", "rowFence", "resourceFence"] as const) {
      const f = fixture(); const row = seed(f); const before = structuredClone(row); let changed = false;
      f.db.beforeRead = (target) => {
        if (!changed && target === "runtimeAuthPrincipals" && f.db.writes >= 2) {
          changed = true;
          if (change === "owner") row.ownerPrincipalId = "foreign";
          else if (change === "rowFence") row.tombstonedAt = undefined;
          else f.db.rows.set("runtimeAuthTombstones", []);
        }
      };
      await expect(f.db.transaction(async () => await invoke(registration, f.ctx, { ...scope, ...args }))).rejects.toMatchObject(forbidden);
      expect(changed).toBe(true); expect(f.db.writes).toBe(0); expect(f.db.table(table)).toEqual([before]); expect(f.db.table("runtimeAuthTombstones")).toEqual([]);
    }
  });
  it.each(["rowFence", "resourceFence"] as const)("late space %s loss after all three intentional effects denies and rolls back", async (change) => {
    const f = fixture(); const row = seedSpace(f); const before = structuredClone(row); const scopeBefore = structuredClone(f.db.table("runtimeAuthScopes")); let changed = false;
    f.db.beforeRead = (target) => {
      if (!changed && target === "runtimeAuthPrincipals" && f.db.writes >= 3) {
        changed = true;
        if (change === "rowFence") row.tombstonedAt = undefined;
        else f.db.rows.set("runtimeAuthTombstones", []);
      }
    };
    await expect(f.db.transaction(async () => await invoke(spaces.deleteSpace, f.ctx, { ...scope, cascade: true, reason: "Late fence loss" }))).rejects.toMatchObject(forbidden);
    expect(changed).toBe(true); expect(f.db.writes).toBe(0); expect(f.db.table("memorySpaces")).toEqual([before]);
    expect(f.db.table("runtimeAuthScopes")).toEqual(scopeBefore); expect(f.db.table("runtimeAuthTombstones")).toEqual([]);
  });
  it("later cascade retirement cannot discard an earlier retired canonical snapshot", async () => {
    const f = fixture(); const { parent, child } = graph(f); const before = structuredClone([parent, child]); let changed = false;
    f.db.beforeWrite = (target, id) => {
      if (!changed && target === "contexts" && id === child._id) { changed = true; parent.data = { private: "rebound" }; }
    };
    await expect(f.db.transaction(async () => await invoke(contexts.deleteContext, f.ctx, { ...scope, contextId: "context-a", cascadeChildren: true }))).rejects.toMatchObject(forbidden);
    expect(changed).toBe(true); expect(f.db.writes).toBe(0); expect(f.db.table("contexts")).toEqual(before); expect(f.db.table("runtimeAuthTombstones")).toEqual([]);
  });
});

describe("locally computed insertion expectations before the first canonical reread", () => {
  const creates = [
    [agents.register, "agents", { agentId: "new", name: "New", config: { private: "original" } }],
    [spaces.register, "memorySpaces", { type: "personal", metadata: { private: "original" } }],
    [contexts.create, "contexts", { purpose: "New", data: { private: "original" } }],
  ] as const;
  const scenarios = creates.flatMap(([registration, table, args]) => [true, false].map((read) => ({ registration, table, args, read })));
  it.each(scenarios)("$table READ=$read cannot adopt a late first-reread payload/owner/collision", async ({ registration, table, args, read }) => {
    for (const change of ["payload", "owner", "collision"] as const) {
      const f = fixture(read ? ["read", "write", "admin"] : ["write", "admin"]); if (table === "contexts") seedSpace(f); let changed = false;
      f.db.beforeRead = (target) => {
        if (!changed && target === table && f.db.writes > 0) {
          changed = true; const row = f.db.table(table)[0]!;
          if (change === "payload") row[table === "agents" ? "config" : table === "contexts" ? "data" : "metadata"] = { private: "rebound" };
          else if (change === "owner") row.ownerPrincipalId = "foreign";
          else f.db.seed(table, { ...row, _id: `${table}:collision`, ownerPrincipalId: "foreign" });
        }
      };
      await expect(f.db.transaction(async () => await invoke(registration, f.ctx, { ...scope, ...args }))).rejects.toMatchObject(forbidden);
      expect(changed).toBe(true); expect(f.db.writes).toBe(0); expect(f.db.table(table)).toEqual([]);
    }
  });
  it.each(creates)("native %s insertion payloads may reorder object keys while preserving exact values", async (registration, table, args) => {
    const f = fixture(); if (table === "contexts") seedSpace(f); let reordered = false;
    f.db.beforeRead = (target) => {
      if (!reordered && target === table && f.db.writes > 0) {
        reordered = true; const row = f.db.table(table)[0]!; const entries = Object.entries(row).reverse();
        for (const key of Object.keys(row)) delete row[key]; Object.assign(row, Object.fromEntries(entries));
      }
    };
    const result = await invoke<Record<string, unknown>>(registration, f.ctx, { ...scope, ...args });
    expect(reordered).toBe(true); expect(result).toMatchObject({ tenantId: "tenant-a", ownerPrincipalId: f.principal._id, ...args });
    expect(f.db.table(table)).toHaveLength(1); expect(f.db.writes).toBe(1);
  });
});

describe("native descriptive strings retain their ordinary API values", () => {
  it.each([[agents.register, agents.get, { agentId: "new", name: "", description: "" }, { agentId: "new" }],
    [spaces.register, spaces.get, { type: "personal", name: "" }, {}],
    [contexts.create, contexts.get, { purpose: "", description: "" }, {}]] as const)("%s creates and reads empty descriptive strings without granting authority", async (registration, get, args, selector) => {
    const f = fixture(); if (registration === contexts.create) seedSpace(f); const grants = structuredClone(f.db.table("runtimeAuthGrants"));
    const result = await invoke<Record<string, unknown>>(registration, f.ctx, { ...scope, ...args });
    const retrieved = await invoke(get, f.ctx, { ...scope, ...selector, ...(registration === contexts.create ? { contextId: result.contextId } : {}) });
    expect(result).toMatchObject(args); expect(retrieved).toEqual(result); expect(f.db.table("runtimeAuthGrants")).toEqual(grants);
  });
  it.each([[agents.update, agents.get, seedAgent, { agentId: "agent-a", name: "", description: "" }],
    [spaces.update, spaces.get, seedSpace, { name: "" }],
    [contexts.update, contexts.get, seedContext, { contextId: "context-a", description: "" }]] as const)("%s edits and reads empty descriptive strings under actual verified ownership", async (registration, get, seed, args) => {
    const f = fixture(); seed(f); const result = await invoke<Record<string, unknown>>(registration, f.ctx, { ...scope, ...args });
    const selector = "agentId" in args ? { agentId: args.agentId } : "contextId" in args ? { contextId: args.contextId } : {};
    const retrieved = await invoke(get, f.ctx, { ...scope, ...selector });
    expect(result).toMatchObject(args); expect(retrieved).toEqual(result); expect(result.ownerPrincipalId).toBe(f.principal._id);
  });
});

describe("native Convex v.any round trips and exact integer/binary witnesses", () => {
  function payload() {
    return { text: "native config", ordinary: [null, true, "", { descriptive: "" }],
      integer: BigInt("9223372036854775807"), bytes: new Uint8Array([0, 128, 255]).buffer,
      nan: NaN, infinity: Infinity, negativeInfinity: -Infinity, signedZero: -0 };
  }
  function expectNative(value: unknown) {
    const data = value as ReturnType<typeof payload>;
    expect(data.text).toBe("native config"); expect(data.ordinary).toEqual([null, true, "", { descriptive: "" }]);
    expect(data.integer).toBe(BigInt("9223372036854775807")); expect([...new Uint8Array(data.bytes)]).toEqual([0, 128, 255]);
    expect(Number.isNaN(data.nan)).toBe(true); expect(data.infinity).toBe(Infinity); expect(data.negativeInfinity).toBe(-Infinity); expect(Object.is(data.signedZero, -0)).toBe(true);
  }
  it.each([[agents.register, agents.update, agents.get, "config", { agentId: "new", name: "New" }, { agentId: "new", name: "Edited" }, { agentId: "new" }],
    [spaces.register, spaces.update, spaces.get, "metadata", { type: "personal" }, { name: "Edited" }, {}],
    [contexts.create, contexts.update, contexts.get, "data", { purpose: "New" }, { description: "Edited" }, {}]] as const)("native %s values survive create/edit/get and their scoped metadata paths", async (register, update, get, field, args, edits, selector) => {
    const f = fixture(); if (register === contexts.create) seedSpace(f); const grants = structuredClone(f.db.table("runtimeAuthGrants"));
    const result = await invoke<Record<string, unknown>>(register, f.ctx, { ...scope, ...args, [field]: payload() }); expectNative(result[field]);
    const identity = { ...selector, ...(register === contexts.create ? { contextId: result.contextId } : {}) };
    const edited = await invoke<Record<string, unknown>>(update, f.ctx, { ...scope, ...identity, ...edits }); expectNative(edited[field]);
    const retrieved = await invoke<Record<string, unknown>>(get, f.ctx, { ...scope, ...identity }); expectNative(retrieved[field]);
    if (field === "config") {
      const rows = await invoke<Record<string, unknown>[]>(agents.list, f.ctx, scope); expect(rows).toHaveLength(1); expectNative(rows[0]!.config);
    } else if (field === "metadata") {
      const rows = await invoke<Record<string, unknown>[]>(spaces.search, f.ctx, { ...scope, query: "native config" }); expect(rows).toHaveLength(1); expectNative(rows[0]!.metadata);
    } else {
      const history = await invoke<Record<string, unknown>[]>(contexts.getHistory, f.ctx, { ...scope, ...identity }); expect(history).toHaveLength(2); history.forEach((version) => expectNative(version.data));
      const exported = await invoke<{ data: string; count: number }>(contexts.exportContexts, f.ctx, { ...scope, format: "json", includeVersionHistory: true });
      const rows = jsonToConvex(JSON.parse(exported.data)) as Record<string, unknown>[]; expect(exported.count).toBe(1); expectNative(rows[0]!.data);
    }
    expect(f.db.table("runtimeAuthGrants")).toEqual(grants); expect(retrieved.ownerPrincipalId).toBe(f.principal._id);
  });
  it.each(["integer", "bytes"] as const)("a late changed %s cannot collapse into an identical row witness and must roll back", async (field) => {
    const f = fixture(); const row = seedAgent(f, { config: payload() }); const original = payload(); let changed = false;
    f.db.beforeRead = (target) => {
      if (!changed && target === "runtimeAuthPrincipals" && f.db.writes > 0) {
        changed = true; const config = row.config as ReturnType<typeof payload>;
        if (field === "integer") config.integer = BigInt("9223372036854775806"); else new Uint8Array(config.bytes)[1] = 127;
      }
    };
    await expect(f.db.transaction(async () => await invoke(agents.update, f.ctx, { ...scope, agentId: "agent-a", name: "No" }))).rejects.toMatchObject(forbidden);
    expect(changed).toBe(true); expect(f.db.writes).toBe(0); expectNative(f.db.table("agents")[0]!.config);
    expect(f.db.table("agents")[0]!.name).toBe("Agent A"); expect((f.db.table("agents")[0]!.config as ReturnType<typeof payload>).integer).toBe(original.integer);
  });
  it.each([[agents.register, agents.update, agents.get, "config", { agentId: "new", name: "New" }, { agentId: "new" }],
    [spaces.register, spaces.update, spaces.get, "metadata", { type: "personal" }, {}],
    [contexts.create, contexts.update, contexts.get, "data", { purpose: "New" }, {}]] as const)("%s retains native v.any root values instead of silently coercing them to records", async (register, update, get, field, args, selector) => {
    for (const value of [BigInt("-9223372036854775808"), new Uint8Array([0, 128, 255]).buffer, NaN, Infinity, -0, [null, true, ""], null]) {
      const f = fixture(); if (register === contexts.create) seedSpace(f);
      const created = await invoke<Record<string, unknown>>(register, f.ctx, { ...scope, ...args, [field]: value });
      const identity = { ...selector, ...(register === contexts.create ? { contextId: created.contextId } : {}) };
      const edited = await invoke<Record<string, unknown>>(update, f.ctx, { ...scope, ...identity, [field]: value });
      const retrieved = await invoke<Record<string, unknown>>(get, f.ctx, { ...scope, ...identity });
      for (const result of [created, edited, retrieved]) {
        if (value instanceof ArrayBuffer) expect([...new Uint8Array(result[field] as ArrayBuffer)]).toEqual([0, 128, 255]);
        else if (typeof value === "number") expect(Object.is(result[field], value)).toBe(true);
        else expect(result[field]).toEqual(value);
        expect(result.ownerPrincipalId).toBe(f.principal._id);
      }
    }
  });
  it("a valid native object beyond the invented old depth50 limit survives create and read", async () => {
    const f = fixture(); let config: Record<string, unknown> = { leaf: "retained" };
    for (let index = 0; index < 55; index++) config = { nested: config };
    const created = await invoke<Record<string, unknown>>(agents.register, f.ctx, { ...scope, agentId: "deep", name: "Deep", config });
    const retrieved = await invoke<Record<string, unknown>>(agents.get, f.ctx, { ...scope, agentId: "deep" });
    expect(created.config).toEqual(config); expect(retrieved.config).toEqual(config); expect(f.db.writes).toBe(1);
  });
  it("archiving native binary metadata preserves the value while applying actual WRITE and ADMIN", async () => {
    const f = fixture(); const value = new Uint8Array([0, 128, 255]).buffer;
    await invoke(spaces.register, f.ctx, { ...scope, type: "personal", metadata: value });
    const archived = await invoke<Record<string, unknown>>(spaces.archive, f.ctx, { ...scope, reason: "Descriptive" });
    const retrieved = await invoke<Record<string, unknown>>(spaces.get, f.ctx, scope);
    expect(archived.status).toBe("archived"); expect(retrieved.status).toBe("archived");
    expect([...new Uint8Array(archived.metadata as ArrayBuffer)]).toEqual([0, 128, 255]); expect([...new Uint8Array(retrieved.metadata as ArrayBuffer)]).toEqual([0, 128, 255]);
    expect(retrieved.ownerPrincipalId).toBe(f.principal._id);
  });
  it("ordinary context record patches merge retained native values while replacing a non-record root explicitly", async () => {
    const f = fixture(); seedContext(f, { data: { kept: BigInt("9223372036854775807"), prior: true } });
    const merged = await invoke<Record<string, unknown>>(contexts.update, f.ctx, { ...scope, contextId: "context-a", data: { added: NaN } });
    expect(merged.data).toEqual({ kept: BigInt("9223372036854775807"), prior: true, added: NaN });
    const replaced = await invoke<Record<string, unknown>>(contexts.update, f.ctx, { ...scope, contextId: "context-a", data: new Uint8Array([1, 2]).buffer });
    expect([...new Uint8Array(replaced.data as ArrayBuffer)]).toEqual([1, 2]); expect(replaced.version).toBe(3); expect(f.db.writes).toBe(2);
  });
  it("native required missing metadata denies rather than fabricating a searchable payload", async () => {
    const f = fixture(); const row = seedSpace(f, { metadata: undefined, name: "Searchable" });
    await expect(invoke(spaces.search, f.ctx, { ...scope, query: "Searchable" })).rejects.toMatchObject(forbidden);
    expect(row).not.toHaveProperty("metadata"); expect(f.db.writes).toBe(0);
  });
});
