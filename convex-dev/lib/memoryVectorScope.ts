/** Derived vector isolation key. Never ownership authority or caller input. */
import { ConvexError } from "convex/values";
import { validateDomainScope } from "./domainScope";
export function memoryVectorScopeKey(tenantId: string | undefined, memorySpaceId: string): string {
  validateDomainScope(tenantId);
  if (typeof memorySpaceId !== "string" || !memorySpaceId.length) throw new ConvexError("DOMAIN_INVALID_SPACE");
  return JSON.stringify(["memory-vector-scope-v1", tenantId === undefined ? ["tenantless"] : ["tenant", tenantId], memorySpaceId]);
}
export function hasMemoryVectorScope(row: {tenantId?: string; memorySpaceId: string; vectorScopeKey?: string}): boolean {
  return row.vectorScopeKey === memoryVectorScopeKey(row.tenantId, row.memorySpaceId);
}
