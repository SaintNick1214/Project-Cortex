/** Safety closure only. No legacy row is queried or adopted as canonical Agent state. */
import { RegistryAccess, deny, operation, type RegistryCtx, type Selectors } from "./runtimeRegistryAuth";
import type { RuntimeResourceType } from "../src/auth/verified";

type SourceFence = { resourceType: RuntimeResourceType; resourceId: string };
/** This guard deliberately never resolves, preserving inferred legacy return types while
 * preventing all legacy handlers from executing. Remove the unreachable bodies only with
 * Task05's canonical Agent adapters and Task07/08's actual revision/source repair contracts. */
export async function runtimeUnavailable(ctx: RegistryCtx, capability: "read" | "write", scope: Selectors,
  sources: SourceFence[] = []): Promise<never> {
  return await operation(ctx, capability === "read" ? "query" : "mutation", async () => {
    const access = await RegistryAccess.open(ctx, capability, scope);
    const a = access.authority;
    if (!a.memorySpaceId || a.memorySpaceEpoch === undefined) deny();
    // Only trusted tombstone controls are inspected. Caller IDs select a denial fence;
    // they never prove ownership, existence, share eligibility or source authority.
    for (const source of sources) for (const memorySpaceId of [a.memorySpaceId, undefined]) {
      const key = { tenantId: a.tenantId, memorySpaceId, ...source };
      const load = async () => {
        try {
          return await ctx.db.query("runtimeAuthTombstones").withIndex("by_resource", q => q
            .eq("tenantId", key.tenantId).eq("memorySpaceId", key.memorySpaceId)
            .eq("resourceType", key.resourceType).eq("resourceId", key.resourceId)).unique();
        } catch {
          // A thrown control read is infrastructure failure even if it impersonates a
          // policy envelope. Never inspect diagnostics or downgrade it into permission.
          throw new Error("Unavailable control lookup failed");
        }
      };
      const row = await load(); if (row) deny();
      access.witness(`unavailable-source:${JSON.stringify(key)}`, null, load);
    }
    await access.fence();
    return deny("CAPABILITY_NOT_READY");
  });
}
/** Internal operators are also unavailable; internal visibility cannot revive unsafe work. */
export async function internalUnavailable(): Promise<never> { return deny("CAPABILITY_NOT_READY"); }
