/** Private byte delivery. Storage IDs never become public download URLs. */
import { httpAction } from "./_generated/server";
import { makeFunctionReference } from "convex/server";
import { ConvexError } from "convex/values";
import { ASSET_MAX_BYTES, assetContentHash, assetMediaKind, readBoundedAsset } from "../src/domain/assets";
import type { RuntimeAssetVersion } from "../src/domain/assets";
import type { RuntimeAuthorityReference } from "../src/auth/verified";
import type { Id } from "./_generated/dataModel";
import { storeJobBytes } from "./runtimeAssets";
const headers = { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "X-Content-Type-Options": "nosniff" };
function fail(error: unknown): Response {
  const known = error instanceof ConvexError && typeof error.data === "object" && error.data !== null && "code" in error.data ? String(error.data.code) : error instanceof Error ? error.message : "ASSET_OPERATION_FAILED";
  const codes = ["UNAUTHENTICATED", "FORBIDDEN", "ASSET_TOO_LARGE", "INVALID_ASSET_METADATA", "ASSET_IDEMPOTENCY_CONFLICT", "ASSET_UPLOAD_IN_PROGRESS", "ASSET_UPLOAD_EXPIRED", "ASSET_NOT_READY", "ASSET_INTEGRITY_FAILED"];
  const code = codes.includes(known) ? known : "ASSET_OPERATION_FAILED";
  return new Response(JSON.stringify({ version: 1, code }), { status: code === "UNAUTHENTICATED" ? 401 : code === "FORBIDDEN" ? 403 : code === "ASSET_TOO_LARGE" ? 413 : code === "INVALID_ASSET_METADATA" ? 400 : code === "ASSET_OPERATION_FAILED" ? 500 : 409, headers: { ...headers, "Content-Type": "application/json" } });
}
function selectors(url: URL) { return { ...(url.searchParams.has("tenantId") ? { tenantId: url.searchParams.get("tenantId")! } : {}), ...(url.searchParams.has("memorySpaceId") ? { memorySpaceId: url.searchParams.get("memorySpaceId")! } : {}) }; }
export const assetOptions = httpAction(async () => new Response(null, { status: 204, headers }));
export const uploadAsset = httpAction(async (ctx, request) => {
  try {
    if (!await ctx.auth.getUserIdentity()) throw new Error("UNAUTHENTICATED");
    const url = new URL(request.url);
    const reference = await ctx.runMutation(makeFunctionReference<"mutation", Record<string, unknown>, RuntimeAuthorityReference>("runtimeAssets:uploadAuthorization"), selectors(url));
    const requestId = url.searchParams.get("requestId") ?? "";
    const mimeType = request.headers.get("Content-Type") ?? ""; assetMediaKind(mimeType);
    const claimed = request.headers.get("Content-Length"); if (claimed !== null && (!/^\d+$/.test(claimed) || Number(claimed) > ASSET_MAX_BYTES)) throw new Error("ASSET_TOO_LARGE");
    if (!request.body) throw new Error("INVALID_ASSET_METADATA");
    const bytes = await readBoundedAsset(request.body); const contentHash = await assetContentHash(bytes.buffer);
    await ctx.runMutation(makeFunctionReference<"mutation">("runtimeAssets:uploadCheckpoint"), { reference });
    const job = await ctx.runMutation(makeFunctionReference<"mutation", Record<string, unknown>, { jobId: string; marker: string; ready?: RuntimeAssetVersion }>("runtimeAssets:beginUpload"), { ...selectors(url), requestId, mimeType, contentHash, sizeBytes: bytes.byteLength, ...(url.searchParams.has("filename") ? { filename: url.searchParams.get("filename")! } : {}) });
    const value = job.ready ?? await storeJobBytes(ctx, job, bytes.buffer);
    return new Response(JSON.stringify(value), { status: 200, headers: { ...headers, "Content-Type": "application/json" } });
  } catch (error) { return fail(error); }
});
export const downloadAsset = httpAction(async (ctx, request) => {
  try {
    if (!await ctx.auth.getUserIdentity()) throw new Error("UNAUTHENTICATED");
    const url = new URL(request.url); const assetId = url.searchParams.get("assetId") ?? ""; const raw = url.searchParams.get("version") ?? "";
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) < 1) throw new Error("INVALID_ASSET_METADATA");
    const held = await ctx.runMutation(makeFunctionReference<"mutation", Record<string, unknown>, { metadata: RuntimeAssetVersion; storageId: Id<"_storage">; reference: RuntimeAuthorityReference }>("runtimeAssets:downloadAuthorization"), { ...selectors(url), assetId, version: Number(raw) });
    const blob = await ctx.storage.get(held.storageId); if (!blob) throw new Error("ASSET_NOT_READY");
    if (blob.size > ASSET_MAX_BYTES) throw new Error("ASSET_TOO_LARGE");
    const bytes = await readBoundedAsset(blob.stream());
    if (bytes.byteLength !== held.metadata.sizeBytes || await assetContentHash(bytes.buffer) !== held.metadata.contentHash) throw new Error("ASSET_INTEGRITY_FAILED");
    await ctx.runMutation(makeFunctionReference<"mutation">("runtimeAssets:downloadCheckpoint"), { reference: held.reference, assetId, version: Number(raw), contentHash: held.metadata.contentHash });
    return new Response(bytes, { status: 200, headers: { ...headers, "Content-Type": held.metadata.mimeType, "Content-Length": String(bytes.byteLength) } });
  } catch (error) { return fail(error); }
});
