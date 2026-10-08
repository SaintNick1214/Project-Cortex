/** Safety closure only. No private source existence/ownership/deletion is inspected. */
import { deny, operation, type RegistryCtx, type Selectors } from "./runtimeRegistryAuth";
import { createAuthorityReader, resolveAuthority, resolveAuthorityReference, type AuthorityReader,
  type GrantRecord } from "./runtimeAuth";

/** Copy trusted control values without invoking accessors. Inspection/Proxy failures
 * stay inside the infrastructure boundary; their diagnostics never reach policy. */
function controlValue(value: unknown): unknown {
  if (value === null || value === undefined || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (!value || typeof value !== "object") throw new Error("Invalid control value");
  const array = Array.isArray(value);
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null && !(array && prototype === Array.prototype)) throw new Error("Invalid control prototype");
  const result: Record<string, unknown> = {};
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string") throw new Error("Invalid control key");
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value")) throw new Error("Invalid control descriptor");
    Object.defineProperty(result, key, { value: controlValue(descriptor.value), enumerable: true });
  }
  if (!array) return result;
  const length = result.length;
  if (typeof length !== "number" || !Number.isSafeInteger(length) || length < 0
    || Object.keys(result).some(key => key !== "length" && !/^(0|[1-9]\d*)$/.test(key))) throw new Error("Invalid control array");
  return Array.from({ length }, (_, index) => result[String(index)]);
}
function protectedReader(ctx: RegistryCtx) {
  const base = createAuthorityReader(ctx);
  let selectedGrant: GrantRecord | null = null;
  async function read<T>(run: () => Promise<T>): Promise<T> {
    try { return controlValue(await run()) as T; }
    catch { throw new Error("Unavailable authority lookup failed"); }
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
    if (!selectedGrant || selectedGrant.expiresAt !== undefined
      && (!Number.isFinite(selectedGrant.expiresAt) || Date.now() >= selectedGrant.expiresAt)) deny();
  } };
}
async function verifiedIdentity(ctx: RegistryCtx) {
  try {
    const identity = await ctx.auth.getUserIdentity(); if (identity === null) return null;
    const prototype: unknown = Object.getPrototypeOf(identity);
    if (prototype !== Object.prototype && prototype !== null) throw new Error();
    const issuer = Object.getOwnPropertyDescriptor(identity, "issuer");
    const subject = Object.getOwnPropertyDescriptor(identity, "subject");
    if ((issuer && !Object.prototype.hasOwnProperty.call(issuer, "value"))
      || (subject && !Object.prototype.hasOwnProperty.call(subject, "value"))) throw new Error();
    const issuerValue: unknown = issuer?.value; const subjectValue: unknown = subject?.value;
    if ((issuerValue !== undefined && typeof issuerValue !== "string")
      || (subjectValue !== undefined && typeof subjectValue !== "string")) throw new Error();
    return { issuer: typeof issuerValue === "string" ? issuerValue : "",
      subject: typeof subjectValue === "string" ? subjectValue : "" };
  } catch { throw new Error("Unavailable identity lookup failed"); }
}
/** Never resolves. Task05/07/08 must replace dead legacy bodies with actual canonical
 * owned-source adapters, source tombstone/revision fencing and stale derived repair.
 * During this unavailable stage, caller source IDs cannot select any control read. */
export async function runtimeUnavailable(ctx: RegistryCtx, capability: "read" | "write", scope: Selectors): Promise<never> {
  return await operation(ctx, capability === "read" ? "query" : "mutation", async () => {
    const { reader, deadline } = protectedReader(ctx);
    const authority = await resolveAuthority(reader, await verifiedIdentity(ctx), {
      capability, tenantId: scope.tenantId, memorySpaceId: scope.memorySpaceId,
    });
    if (!authority.memorySpaceId || authority.memorySpaceEpoch === undefined) deny();
    const requirement = { capability, tenantId: authority.tenantId, memorySpaceId: authority.memorySpaceId };
    let previous: string | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      const current = JSON.stringify(await resolveAuthorityReference(reader, authority, requirement));
      deadline();
      if (current === previous) return deny("CAPABILITY_NOT_READY");
      previous = current;
    }
    return deny();
  });
}
/** Internal visibility never revives unsupported operators or legacy effects. */
export async function internalUnavailable(): Promise<never> { return deny("CAPABILITY_NOT_READY"); }
