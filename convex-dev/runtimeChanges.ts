/** Persisted scoped catch-up. This external-source feed does not depend on process observers. */
import { ConvexError, v } from "convex/values";
import type { RegisteredMutation } from "convex/server";
import { mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { ScopedDataAuthority } from "./runtimeDataAuth";
import { dataAuthorityReference, dataDenied, requireDataAuthority } from "./runtimeDataAuth";
import { changesInput, RUNTIME_EXTERNAL_LIMITS } from "../src/client-runtime/external";
import type { RuntimeChangeEvent, RuntimeChangesInput, RuntimeChangesPage } from "../src/client-runtime/external";
import { canonicalModelJson } from "../src/domain/model-policy";
import { semanticHash } from "../src/domain/profile";
import { ensureChangeHead } from "./runtimeChangesStore";
import { externalHead, externalVersionRow, authorizeExternalVersion } from "./runtimeExternalSources";
import { deliveryExpiresAt } from "./runtimeDelivery";

const selectors = { tenantId: v.optional(v.string()), memorySpaceId: v.optional(v.string()) };
type ListArgs = { [K in keyof ({ tenantId?: string; memorySpaceId?: string } & RuntimeChangesInput)]: ({ tenantId?: string; memorySpaceId?: string } & RuntimeChangesInput)[K] };
interface Position { position: number; through: number; watermark: string; erasureEpoch: number; complete: boolean; nonce: string }
const visibility = (actor: ScopedDataAuthority) => actor.resourceAccess === "own" ? `own:${actor.principalId}` : "scope";
function forbidden(error: unknown) { return error instanceof ConvexError && typeof error.data === "object" && error.data !== null && "code" in error.data && error.data.code === "FORBIDDEN"; }
async function window(ctx: MutationCtx, actor: ScopedDataAuthority, input: RuntimeChangesInput, filterCanonical: string): Promise<Position> {
  const visible = visibility(actor), head = await ensureChangeHead(ctx, actor, actor.resourceAccess === "own" ? actor.principalId : "");
  const erasureEpoch = head.erasureEpoch, through = head.sequence, nonce = head.nonce;
  if (input.after) {
    const cursor = await ctx.db.query("runtimeChangeCursors").withIndex("by_token", q => q.eq("token", input.after!)).unique();
    if (!cursor) dataDenied("CURSOR_INVALID");
    if (cursor.tenantId !== actor.tenantId || cursor.memorySpaceId !== actor.memorySpaceId || cursor.principalId !== actor.principalId || cursor.visibility !== visible || cursor.filterCanonical !== filterCanonical) dataDenied("CURSOR_SCOPE_CHANGED");
    if (cursor.invalidatedAt !== undefined || cursor.erasureEpoch !== erasureEpoch) dataDenied("CURSOR_EXPIRED");
    if (!cursor.complete) return { position: cursor.position, through: cursor.through, watermark: cursor.watermark, erasureEpoch, complete: false, nonce };
    if (cursor.position > through) dataDenied("CURSOR_INVALID");
    return { position: cursor.position, through, watermark: await watermark(actor, visible, filterCanonical, through, erasureEpoch, nonce), erasureEpoch, complete: false, nonce };
  }
  return { position: 0, through, watermark: await watermark(actor, visible, filterCanonical, through, erasureEpoch, nonce), erasureEpoch, complete: false, nonce };
}
async function watermark(actor: ScopedDataAuthority, visible: string, filter: string, through: number, epoch: number, nonce: string) {
  return `change-watermark:${await semanticHash(canonicalModelJson([nonce, actor.tenantId, actor.memorySpaceId, actor.principalId, visible, filter, through, epoch]))}`;
}
async function checkpoint(ctx: MutationCtx, actor: ScopedDataAuthority, filterCanonical: string, position: Position) {
  const { nonce, ...stored } = position;
  const data = { tenantId: actor.tenantId, memorySpaceId: actor.memorySpaceId, principalId: actor.principalId, visibility: visibility(actor), filterCanonical, ...stored };
  const token = `change-cursor:${await semanticHash(canonicalModelJson([nonce, data]))}`;
  const prior = await ctx.db.query("runtimeChangeCursors").withIndex("by_token", q => q.eq("token", token)).unique();
  if (!prior) await ctx.db.insert("runtimeChangeCursors", { ...data, token, createdAt: Date.now() });
  return token;
}
export async function listChangesHandler(ctx: MutationCtx, args: { tenantId?: string; memorySpaceId?: string } & RuntimeChangesInput): Promise<RuntimeChangesPage> {
  const actor = await requireDataAuthority(ctx, args, "read"), { tenantId: _tenant, memorySpaceId: _space, ...raw } = args;
  let input: RuntimeChangesInput; try { input = changesInput(raw); } catch { return dataDenied("INVALID_INPUT"); }
  const types = input.types ? [...input.types].sort() : undefined, filterCanonical = canonicalModelJson(types ?? []), pos = await window(ctx, actor, input, filterCanonical);
  const limit = input.limit ?? RUNTIME_EXTERNAL_LIMITS.maxChangePageSize, own = actor.resourceAccess === "own";
  const rows = own ? await ctx.db.query("runtimeChangeEvents").withIndex("by_owner_sequence", q => q.eq("tenantId", actor.tenantId).eq("memorySpaceId", actor.memorySpaceId).eq("ownerPrincipalId", actor.principalId).gt("ownerSequence", pos.position).lte("ownerSequence", pos.through)).take(101)
    : await ctx.db.query("runtimeChangeEvents").withIndex("by_scope_sequence", q => q.eq("tenantId", actor.tenantId).eq("memorySpaceId", actor.memorySpaceId).gt("sequence", pos.position).lte("sequence", pos.through)).take(101);
  const events: RuntimeChangeEvent[] = [], deadlines: number[] = []; let position = pos.position, scanned = 0;
  for (const row of rows.slice(0, 100)) {
    position = own ? row.ownerSequence : row.sequence; scanned++;
    const payload = JSON.parse(row.payloadCanonical) as RuntimeChangeEvent;
    if (types && !types.includes(payload.type)) continue;
    const head = await externalHead(ctx, actor, row.sourceId); if (!head) continue;
    const version = await externalVersionRow(ctx, actor, row.sourceId, payload.source.versionId); if (!version) continue;
    try { await authorizeExternalVersion(ctx, actor, head, version, deadlines); }
    catch (error) { if (!forbidden(error)) throw error; await requireDataAuthority(ctx, args, "read"); continue; }
    events.push(payload); if (events.length === limit) break;
  }
  const hasMore = rows.length > scanned;
  if (!hasMore) position = pos.through;
  const nextCursor = await checkpoint(ctx, actor, filterCanonical, { ...pos, position, complete: !hasMore });
  const expiry = await deliveryExpiresAt(ctx, dataAuthorityReference(actor), deadlines);
  return { version: 1, scope: { tenantId: actor.tenantId, memorySpaceId: actor.memorySpaceId }, principalId: actor.principalId, events,
    nextCursor, hasMore, watermark: pos.watermark, completeThroughWatermark: !hasMore, ...(expiry === undefined ? {} : { deliveryExpiresAt: expiry }) };
}
export const list: RegisteredMutation<"public", ListArgs, Promise<RuntimeChangesPage>> = mutation({ args: { ...selectors, after: v.optional(v.string()), limit: v.optional(v.number()), types: v.optional(v.array(v.union(v.literal("source.created"), v.literal("source.revised"), v.literal("source.tombstoned"), v.literal("source.index.ready"), v.literal("source.index.failed")))) }, handler: listChangesHandler });
