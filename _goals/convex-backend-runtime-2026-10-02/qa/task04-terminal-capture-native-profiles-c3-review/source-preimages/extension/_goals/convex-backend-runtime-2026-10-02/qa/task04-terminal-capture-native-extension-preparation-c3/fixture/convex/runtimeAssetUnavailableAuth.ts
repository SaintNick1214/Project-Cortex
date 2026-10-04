/** Bounded Task03 safety closure; actual private bytes, ownership/reference
 * catalog and authenticated HTTP delivery remain required in Tasks12/13/14.
 * Caller IDs/owner labels are never inspected and cannot expose private presence. */
import { ConvexError, convexToJson, jsonToConvex, type Value } from "convex/values";
import { deny, operation, type RegistryCtx, type Selectors } from "./runtimeRegistryAuth";
import { createAuthorityReader, resolveAuthority, resolveAuthorityReference, type AuthorityReader,
  type GrantRecord } from "./runtimeAuth";

function unavailable(): never {
  throw new ConvexError({ version: 1, code: "CAPABILITY_UNAVAILABLE",
    message: "Asset capability unavailable.", retryable: false, outcome: "not_dispatched" });
}
/** Narrow adapter to the accepted reader/pure policy. Capture native control values
 * inside the read boundary: getters/proxies and even exact FORBIDDEN diagnostics
 * from infrastructure cannot become resolver candidate-pruning policy decisions. */
function protectedAssetReader(ctx: RegistryCtx) {
  const base = createAuthorityReader(ctx);
  let selectedGrant: GrantRecord | null = null;
  async function read<T>(run: () => Promise<T>): Promise<T> {
    try { return jsonToConvex(convexToJson(await run() as Value)) as T; }
    catch { throw new Error("Asset authority lookup failed"); }
  }
  const reader: AuthorityReader = {
    findPrincipal: (issuer, subject) => read(() => base.findPrincipal(issuer, subject)),
    getPrincipal: id => read(() => base.getPrincipal(id)),
    listMemberships: id => read(() => base.listMemberships(id)),
    getMembership: id => read(() => base.getMembership(id)),
    listGrants: id => read(() => base.listGrants(id)),
    getGrant: async id => { selectedGrant = await read(() => base.getGrant(id)); return selectedGrant; },
    getScope: (tenant, space) => read(() => base.getScope(tenant, space)),
    hasTombstone: key => read(() => base.hasTombstone(key)),
  };
  return { reader, deadline: () => {
    if (!selectedGrant || (selectedGrant.expiresAt !== undefined
      && (!Number.isFinite(selectedGrant.expiresAt) || Date.now() >= selectedGrant.expiresAt))) deny();
  } };
}
async function verifiedIdentity(ctx: RegistryCtx) {
  try {
    const identity = await ctx.auth.getUserIdentity(); if (identity === null) return null;
    const issuer = Object.getOwnPropertyDescriptor(identity, "issuer");
    const subject = Object.getOwnPropertyDescriptor(identity, "subject");
    if ((issuer && !("value" in issuer)) || (subject && !("value" in subject))) throw new Error();
    // A fresh ordinary object contains only the verified identity fields read by
    // accepted policy; no caller claim, extra JWT field or getter grants privilege.
    const issuerValue: unknown = issuer?.value; const subjectValue: unknown = subject?.value;
    if ((issuerValue !== undefined && typeof issuerValue !== "string")
      || (subjectValue !== undefined && typeof subjectValue !== "string")) throw new Error();
    return { issuer: typeof issuerValue === "string" ? issuerValue : "",
      subject: typeof subjectValue === "string" ? subjectValue : "" };
  } catch { throw new Error("Asset identity lookup failed"); }
}
/** Never resolves: legacy return inference remains behind this guard until actual
 * asset restoration replaces the typed dead bodies. Complete matching pinned
 * reference sweeps reuse accepted policy and check expiry after the last DB await. */
export async function runtimeAssetUnavailable(ctx: RegistryCtx,
  capability: "storage:read" | "storage:write", scope: Selectors): Promise<never> {
  await operation(ctx, capability === "storage:read" ? "query" : "mutation", async () => {
    const { reader, deadline } = protectedAssetReader(ctx);
    const authority = await resolveAuthority(reader, await verifiedIdentity(ctx), { capability, ...scope });
    if (!authority.tenantId || !authority.memorySpaceId || authority.memorySpaceEpoch === undefined) deny();
    const requirement = { capability, tenantId: authority.tenantId, memorySpaceId: authority.memorySpaceId };
    let previous: string | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      const current = JSON.stringify(await resolveAuthorityReference(reader, authority, requirement));
      deadline();
      if (current === previous) return;
      previous = current;
    }
    deny();
  });
  // Outside the registry normalizer, only after strict successful current fences.
  return unavailable();
}
/** Internal visibility never revives upload URLs, bytes or operator effects. */
export async function internalAssetUnavailable(): Promise<never> { return unavailable(); }
