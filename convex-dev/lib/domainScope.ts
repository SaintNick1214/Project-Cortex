/** Exact caller-selected domain scope; this is not authentication. */
import { ConvexError, convexToJson, type Value } from "convex/values";
import type { QueryCtx } from "../_generated/server";

export function validateDomainScope(tenantId: string | undefined): void {
  if (tenantId !== undefined && (typeof tenantId !== "string" || tenantId.trim().length === 0 || tenantId.length > 256)) {
    throw new ConvexError("INVALID_TENANT_ID");
  }
}

export async function scopedSpace(ctx: Pick<QueryCtx, "db">, tenantId: string | undefined, memorySpaceId: string) {
  validateDomainScope(tenantId);
  const rows = await ctx.db.query("memorySpaces").withIndex("by_tenant_memorySpaceId", q => q.eq("tenantId", tenantId).eq("memorySpaceId", memorySpaceId)).take(2);
  if (rows.length > 1) throw new ConvexError("DOMAIN_SCOPE_AMBIGUOUS");
  return rows[0] ?? null;
}

export async function scopedImmutable(ctx: Pick<QueryCtx, "db">, tenantId: string | undefined, type: string, id: string) {
  validateDomainScope(tenantId);
  const rows = await ctx.db.query("immutable").withIndex("by_tenant_type_id", q => q.eq("tenantId", tenantId).eq("type", type).eq("id", id)).take(2);
  if (rows.length > 1) throw new ConvexError("DOMAIN_SCOPE_AMBIGUOUS");
  return rows[0] ?? null;
}

/** Serialized full-document estimate, excluding files, indexes and physical overhead. */
export function convexDocumentBytes(documents: Value[]): number {
  return documents.reduce<number>((sum, document) => sum + new TextEncoder().encode(JSON.stringify(convexToJson(document))).byteLength, 0);
}
