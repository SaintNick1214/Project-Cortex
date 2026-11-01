/** Deployment-key legacy maintenance, separate from verified runtime grants. */
import { ConvexError, v, type ObjectType, type PropertyValidators } from "convex/values";
import { internalAction, internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "../_generated/server";

const runtimeFields = ["ownerPrincipalId", "lineage", "runtimeEditor", "manualSourceBinding", "tombstonedAt", "authority", "authorityReference"] as const;

export function isRuntimeManagedRow(row: unknown): boolean {
  return row !== null && typeof row === "object" && runtimeFields.some((key) =>
    Object.prototype.hasOwnProperty.call(row, key) && (row as Record<string, unknown>)[key] !== undefined);
}

export function assertLegacyOperatorRow(row: unknown): void {
  if (isRuntimeManagedRow(row)) throw new ConvexError({ version: 1, code: "UNSUPPORTED_OPERATION",
    message: "Runtime lifecycle data requires its verified runtime operation; legacy maintenance cannot mutate it",
    retryable: false, outcome: "not_dispatched" });
}

/** A legacy export/erasure cannot claim completeness while omitting runtime data. */
export async function assertLegacyDomainScope(ctx: Pick<QueryCtx, "db">, tenantId?: string, memorySpaceId?: string): Promise<void> {
  if (tenantId === undefined) return;
  const scope = await ctx.db.query("runtimeAuthScopes").withIndex("by_tenant_space", (q) =>
    memorySpaceId === undefined ? q.eq("tenantId", tenantId) : q.eq("tenantId", tenantId).eq("memorySpaceId", memorySpaceId)).first();
  if (scope) throw new ConvexError({ version: 1, code: "UNSUPPORTED_OPERATION",
    message: "Legacy export and erasure do not cover this tenant's runtime lifecycle data",
    retryable: false, outcome: "not_dispatched" });
}

/** Check persisted rows before destructive routing, including derived helper writes.
 * Convex rolls back the transaction if a later row fails this check.
 */
export function legacyOperatorContext(ctx: MutationCtx): MutationCtx {
  const db = new Proxy(ctx.db, { get(target, key, receiver) {
    const method: unknown = Reflect.get(target, key, receiver);
    if (typeof method !== "function") return method;
    if (!["insert", "patch", "replace", "delete"].includes(String(key))) return method.bind(target);
    return async (...args: unknown[]) => {
      if (key === "insert") assertLegacyOperatorRow(args[1]);
      else {
        const idArgs = args.length === (key === "delete" ? 2 : 3) ? args.slice(0, 2) : args.slice(0, 1);
        const row: unknown = await Reflect.apply(target.get, target, idArgs);
        assertLegacyOperatorRow(row);
        if (key === "patch" || key === "replace") assertLegacyOperatorRow(args[args.length - 1]);
      }
      return Reflect.apply(method, target, args);
    };
  } });
  return { ...ctx, db };
}

export function operatorMutation<A extends PropertyValidators, R>(definition: {
  args: A; handler: (ctx: MutationCtx, args: ObjectType<A>) => R;
}) {
  return internalMutation({ args: v.object(definition.args),
    handler: (ctx, args) => definition.handler(legacyOperatorContext(ctx), args) });
}

export const operatorQuery = internalQuery;
export const operatorAction = internalAction;
