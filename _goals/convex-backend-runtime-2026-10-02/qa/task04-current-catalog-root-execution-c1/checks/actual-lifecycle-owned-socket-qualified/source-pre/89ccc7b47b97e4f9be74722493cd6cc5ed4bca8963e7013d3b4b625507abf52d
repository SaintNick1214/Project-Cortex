import { describe, expect, it } from "@jest/globals";
import * as agents from "../../../convex-dev/agents";
import * as spaces from "../../../convex-dev/memorySpaces";
import * as contexts from "../../../convex-dev/contexts";
import { fixture, invoke, seedAgent, seedContext, seedSpace, type Registration } from "./fixture";
const modules: Record<string, Record<string, unknown>> = { agents, memorySpaces: spaces, contexts };
const selected = Object.entries(modules).flatMap(([module, values]) => Object.entries(values)
  .filter(([name]) => !["computeStats", "getStats"].includes(name)).map(([name, registration]) => ({ path: `${module}:${name}`, module, name, registration })));
const publicPaths = selected.filter((path) => path.name !== "purgeAll");
const scope = { tenantId: "tenant-a", memorySpaceId: "space-a" };
function args(path: string): Record<string, unknown> {
  const name = path.split(":")[1]!;
  const common = { ...scope, agentId: "agent-a", contextId: "context-a" };
  const specific: Record<string, Record<string, unknown>> = {
    register: { agentId: "new-agent", name: "New", type: "personal" }, update: { name: "Updated", description: "Updated", data: { b: true } },
    updateMany: { agentIds: ["agent-a"], name: "Bulk", updates: { status: "completed", data: { b: true } } },
    unregisterMany: { agentIds: ["agent-a"] }, create: { purpose: "New Task", userId: "user-a" },
    addParticipant: { participant: { id: "label-b", type: "user", joinedAt: 1000 }, participantId: "label-b" },
    removeParticipant: { participantId: "label-b" }, grantAccess: { targetMemorySpaceId: "space-a", scope: "read-only" },
    deleteSpace: { cascade: true, reason: "owned test", confirmId: "space-a" }, search: { query: "space" },
    updateParticipants: { add: [{ id: "label-b", type: "user", joinedAt: 1000 }] },
    getByConversation: { conversationId: "conversation-a" }, findByParticipant: { participantId: "label-a" },
    getVersion: { version: 1 }, getAtTimestamp: { timestamp: 1000 }, exportContexts: { format: "json", includeVersionHistory: true },
  };
  const candidate = { ...common, ...(specific[name] ?? {}) };
  const registration = selected.find((value) => value.path === path)!.registration as { exportArgs(): string };
  const fields = (JSON.parse(registration.exportArgs()) as { value: Record<string, unknown> }).value;
  return Object.fromEntries(Object.entries(candidate).filter(([field]) => Object.prototype.hasOwnProperty.call(fields, field)));
}
describe("exact 46 native registrations and complete missing-auth outcomes", () => {
  it("selects agents10/spaces14/contexts22 and keeps exactly three operator purges internal", () => {
    expect(selected).toHaveLength(46); expect(publicPaths).toHaveLength(43);
    expect(selected.filter((value) => value.module === "agents")).toHaveLength(10);
    expect(selected.filter((value) => value.module === "memorySpaces")).toHaveLength(14);
    expect(selected.filter((value) => value.module === "contexts")).toHaveLength(22);
  });
  it.each(selected)("$path retains actual native validators and registered visibility", ({ registration, name }) => {
    const actual = registration as Registration & { exportArgs(): string };
    expect(typeof actual._handler).toBe("function"); expect(actual.isInternal).toBe(name === "purgeAll" ? true : undefined);
    expect(actual.isPublic).toBe(name === "purgeAll" ? undefined : true);
    const validator = JSON.parse(actual.exportArgs()) as { type: string; value: Record<string, unknown> };
    expect(validator.type).toBe("object");
    if (name === "purgeAll") expect(validator.value).toEqual({});
    else {
      expect(validator.value.tenantId).toMatchObject({ optional: true }); expect(validator.value.memorySpaceId).toBeDefined();
      for (const field of ["ownerPrincipalId", "lastUpdatedBy", "principalId", "grantId", "authority", "admin"]) expect(validator.value[field]).toBeUndefined();
    }
  });
  it.each(publicPaths)("$path requires verified identity before domain reads/effects", async ({ path, registration }) => {
    const f = fixture(); seedSpace(f); seedAgent(f); seedContext(f);
    await expect(f.db.transaction(async () => await invoke(registration, f.anonymous, args(path)))).rejects.toMatchObject({ data: { code: "UNAUTHENTICATED" } });
    expect(f.db.writes).toBe(0); expect(f.db.traces.filter((trace) => ["agents", "memorySpaces", "contexts", "conversations"].includes(trace.table))).toEqual([]);
  });
  it.each(publicPaths)("$path rejects forged issuer/subject and caller role/tenant labels", async ({ path, registration }) => {
    const f = fixture(); seedSpace(f); seedAgent(f); seedContext(f);
    Object.assign(f.ctx, { auth: { getUserIdentity: async () => ({ issuer: "https://host.test", subject: "attacker", tenantId: "tenant-a", roles: ["admin"] }) } });
    await expect(invoke(registration, f.ctx, args(path))).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    expect(f.db.writes).toBe(0); expect(f.db.traces.some((trace) => ["agents", "memorySpaces", "contexts", "conversations"].includes(trace.table))).toBe(false);
  });
  it.each(publicPaths)("$path rejects forged tenant scope with zero effects", async ({ path, registration }) => {
    const f = fixture(); seedSpace(f); seedAgent(f); seedContext(f);
    await expect(f.db.transaction(async () => await invoke(registration, f.ctx, { ...args(path), tenantId: "tenant-b" }))).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    expect(f.db.writes).toBe(0);
  });
  it.each(publicPaths)("$path returns its expected authorized outcome", async ({ path, module, name, registration }) => {
    const f = fixture(); const space = seedSpace(f, { participants: [{ id: "label-a", type: "user", joinedAt: 1000 }] }); const agent = seedAgent(f); const context = seedContext(f);
    if (module === "memorySpaces" && name === "register") f.db.rows.set("memorySpaces", []);
    if (name === "getByConversation") {
      await expect(invoke(registration, f.ctx, args(path))).rejects.toMatchObject({ data: { code: "CAPABILITY_NOT_READY" } });
      expect(f.db.writes).toBe(0); expect(f.db.traces.some((trace) => trace.table === "conversations")).toBe(false); return;
    }
    const result = await f.db.transaction(async () => await invoke<Record<string, unknown>>(registration, f.ctx, args(path)));
    if (name === "count") { expect(result).toBe(1); return; }
    if (name === "exists") { expect(result).toBe(true); return; }
    if (name === "get") { expect(result).toMatchObject(module === "agents" ? agent : module === "memorySpaces" ? space : context); return; }
    if (name === "list" && module === "memorySpaces") { expect(result).toMatchObject({ total: 1, hasMore: false, spaces: [space] }); return; }
    if (["list", "search", "findByParticipant"].includes(name)) { expect(result).toHaveLength(1); return; }
    if (name === "findOrphaned") { expect(result).toEqual([]); return; }
    if (name === "getChain") { expect(result).toMatchObject({ current: context, root: context, parent: null, totalNodes: 1 }); return; }
    if (name === "getRoot") { expect(result).toEqual(context); return; }
    if (name === "getChildren") { expect(result).toEqual([]); return; }
    if (["getVersion", "getAtTimestamp"].includes(name)) { expect(result).toMatchObject({ version: 1, data: { private: "a" }, updatedBy: f.principal._id }); return; }
    if (name === "getHistory") { expect(result).toEqual([{ version: 1, status: "active", data: { private: "a" }, timestamp: 1000, updatedBy: f.principal._id }]); return; }
    if (name === "exportContexts") { expect(result.count).toBe(1); expect(JSON.parse(result.data as string)[0]).toMatchObject({ contextId: "context-a", data: { private: "a" }, previousVersions: [] }); return; }
    if (name === "updateMany") { expect(result.updated).toBe(1); expect(f.db.writes).toBe(1); return; }
    if (["unregister", "deleteContext", "deleteSpace"].includes(name)) { expect(result.deleted).toBe(true); expect(f.db.table("runtimeAuthTombstones")).toHaveLength(1); return; }
    if (["unregisterMany", "deleteMany"].includes(name)) { expect(result.deleted).toBe(1); expect(f.db.table("runtimeAuthTombstones")).toHaveLength(1); return; }
    if (name === "register") { expect(result).toMatchObject({ tenantId: "tenant-a", ownerPrincipalId: f.principal._id, status: "active" }); expect(f.db.writes).toBe(1); return; }
    if (name === "create") { expect(result).toMatchObject({ tenantId: "tenant-a", ownerPrincipalId: f.principal._id, lastUpdatedBy: f.principal._id, userId: "user-a", version: 1 }); return; }
    expect(f.db.writes).toBe(1);
    if (name === "update") expect(result).toMatchObject(module === "memorySpaces" ? { name: "Updated" } : { description: "Updated" });
    else if (["addParticipant", "updateParticipants"].includes(name)) expect(result.participants).toContainEqual(module === "contexts" ? "label-b" : { id: "label-b", type: "user", joinedAt: 1000 });
    else if (name === "removeParticipant") expect(JSON.stringify(result.participants)).not.toContain("label-b");
    else if (name === "archive") expect(result.status).toBe("archived");
    else if (name === "reactivate") expect(result.status).toBe("active");
    else if (name === "grantAccess") expect(result.grantedAccess).toEqual([{ memorySpaceId: "space-a", scope: "read-only", grantedAt: expect.any(Number) }]);
    else throw new Error(`Missing explicit outcome assertion: ${path}`);
  });
  it.each(selected.filter((value) => value.name === "purgeAll"))("$path retains auth, source and metadata fences", async ({ module, registration }) => {
    const f = fixture(); seedSpace(f); seedAgent(f); seedContext(f);
    const source = f.db.seed("runtimeMemorySources", { private: "retained" }); const originalControls = [f.principal, f.membership, f.grant];
    expect(await invoke(registration, f.anonymous, {})).toMatchObject({ deleted: 1 });
    expect(f.db.table(module)[0]).toMatchObject({ tombstonedAt: expect.any(Number) });
    expect(f.db.table("runtimeMemorySources")).toEqual([source]);
    expect([f.db.table("runtimeAuthPrincipals")[0], f.db.table("runtimeAuthMemberships")[0], f.db.table("runtimeAuthGrants")[0]]).toEqual(originalControls);
    expect(f.db.table("runtimeAuthTombstones")).toHaveLength(1);
  });
});
