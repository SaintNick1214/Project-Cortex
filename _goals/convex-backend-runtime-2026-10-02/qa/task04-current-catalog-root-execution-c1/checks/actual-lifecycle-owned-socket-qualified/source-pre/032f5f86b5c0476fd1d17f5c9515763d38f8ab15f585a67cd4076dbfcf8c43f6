import * as agents from "../../../convex-dev/agents";
import * as spaces from "../../../convex-dev/memorySpaces";
import * as contexts from "../../../convex-dev/contexts";
import { fixture, addSpaceGrant, seedAgent, seedSpace, seedContext } from "./fixture";
export const admissionCases = [
  ...["spaces", "tenants"].flatMap((scopes) => [
    { scopes, path: "agents:get", registration: agents.get, table: "agents", mutation: false, args: { agentId: "agent-a" } },
    { scopes, path: "agents:update", registration: agents.update, table: "agents", mutation: true, args: { agentId: "agent-a", name: "Updated" } },
    { scopes, path: "contexts:get", registration: contexts.get, table: "contexts", mutation: false, args: { contextId: "context-a" } },
    { scopes, path: "contexts:update", registration: contexts.update, table: "contexts", mutation: true, args: { contextId: "context-a", description: "Updated" } },
  ]),
  { scopes: "spaces", path: "memorySpaces:list", registration: spaces.list, table: "memorySpaces", mutation: false, args: {} },
  { scopes: "tenants", path: "memorySpaces:get", registration: spaces.get, table: "memorySpaces", mutation: false, args: { memorySpaceId: "space-a" } },
  { scopes: "tenants", path: "memorySpaces:update", registration: spaces.update, table: "memorySpaces", mutation: true, args: { memorySpaceId: "space-a", name: "Updated" } },
];
export type AdmissionCase = typeof admissionCases[number];
export const controlCorruptions = ["tenantScope", "spaceScope", "tenantTombstone", "spaceTombstone"] as const;
export type Corruption = typeof controlCorruptions[number];
export function admissionFixture(entry: AdmissionCase) {
  const f = fixture(); const tenantId = entry.scopes === "tenants" ? "tenant-b" : "tenant-a";
  const memorySpaceId = entry.scopes === "tenants" ? "space-a" : "space-b";
  if (entry.scopes === "spaces") addSpaceGrant(f, memorySpaceId);
  else {
    const membership = f.db.seed("runtimeAuthMemberships", { principalId: f.principal._id, tenantId, version: 1, createdAt: 1000 });
    f.db.seed("runtimeAuthScopes", { tenantId, epoch: 1, createdAt: 1000 });
    f.db.seed("runtimeAuthScopes", { tenantId, memorySpaceId, epoch: 1, createdAt: 1000 });
    f.db.seed("runtimeAuthGrants", { principalId: f.principal._id, membershipId: membership._id, tenantId, memorySpaceId,
      memorySpaceEpoch: 1, tenantEpoch: 1, capabilities: ["admin", "read", "write"], resourceAccess: "own", version: 1, createdAt: 1000 });
    seedSpace(f, { tenantId, memorySpaceId });
  }
  seedAgent(f, { tenantId, memorySpaceId, metadata: { marker: "healthy-second-scope-private-value" } });
  seedContext(f, { tenantId, memorySpaceId, participants: [memorySpaceId] });
  return { ...f, secondTenant: tenantId, secondSpace: memorySpaceId };
}
export function corruptControl(f: ReturnType<typeof admissionFixture>, corruption: Corruption) {
  if (corruption === "tenantScope" || corruption === "spaceScope") {
    const original = f.db.table("runtimeAuthScopes").find((row) => row.tenantId === "tenant-a" && row.memorySpaceId === (corruption === "spaceScope" ? "space-a" : undefined))!;
    f.db.seed("runtimeAuthScopes", { ...original, _id: "private-control-document-id-duplicate" });
  } else for (const id of ["private-control-document-id-one", "private-control-document-id-two"]) {
    const space = corruption === "spaceTombstone";
    f.db.seed("runtimeAuthTombstones", { _id: id, tenantId: "tenant-a", ...(space ? { memorySpaceId: "space-a" } : {}),
      resourceType: space ? "memorySpace" : "tenant", resourceId: space ? "space-a" : "tenant-a", deletedAt: 1001 });
  }
}
