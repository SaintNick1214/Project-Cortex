/** Fresh delivery deadlines are server-derived bounds, never an authorization substitute. */
import type { QueryCtx } from "./_generated/server";
import type { RuntimeAuthorityReference, RuntimeCapability } from "../src/auth/verified";
import { ConvexError } from "convex/values";
import { createAuthorityReader, recheckAuthority } from "./runtimeAuth";

function denied(): never {
  throw new ConvexError({ version: 1, code: "FORBIDDEN", message: "Access denied", retryable: false, outcome: "not_dispatched" });
}

/** The caller supplies only deadlines from already authorized server records. */
export async function deliveryExpiresAt(
  ctx: Pick<QueryCtx, "db">,
  reference: RuntimeAuthorityReference,
  reliedOnDeadlines: readonly (number | undefined)[] = [],
  capability: RuntimeCapability = "read",
): Promise<number | undefined> {
  await recheckAuthority(ctx, reference, {
    capability, tenantId: reference.tenantId, memorySpaceId: reference.memorySpaceId,
  });
  const grant = await createAuthorityReader(ctx).getGrant(reference.grantId);
  if (!grant || grant.version !== reference.grantVersion) denied();
  const deadlines = [grant.expiresAt, ...reliedOnDeadlines].filter((value): value is number => value !== undefined);
  if (deadlines.some(value => !Number.isFinite(value) || value > Number.MAX_SAFE_INTEGER || value <= Date.now())) denied();
  return deadlines.length ? Math.min(...deadlines) : undefined;
}
