import { getFunctionName } from "convex/server";
import { transcriptFixture, installMockRoot, invoke } from "../runtimeTranscript/fixture";
import { assetContentHash } from "../../../src/domain/assets";
import type { ActionCtx, MutationCtx } from "../../../convex-dev/_generated/server";
import type { RuntimeAssetVersion } from "../../../src/domain/assets";
export { installMockRoot, invoke };
export const assets = await import("../../../convex-dev/runtimeAssets");
export const artifacts = await import("../../../convex-dev/artifacts");
export const attachments = await import("../../../convex-dev/attachments");
export const auth = await import("../../../convex-dev/runtimeAuth");
export const http = await import("../../../convex-dev/runtimeAssetsHttp");
export const transcript = await import("../../../convex-dev/runtimeTranscript");
export async function assetFixture() {
  const f = await transcriptFixture();
  const originalGet = f.db.get.bind(f.db);
  Object.defineProperty(f.db, "get", { value: (table: string, id?: string) => originalGet(id === undefined ? table.split(":")[0] : table, id ?? table) });
  const originalQuery = f.db.query.bind(f.db);
  Object.defineProperty(f.db, "query", { value: (table: string) => {
    const query = originalQuery(table); const filter = query.filter;
    query.filter = callback => filter(q => { const operators = { ...q, neq: (a: unknown, b: unknown) => (row: Parameters<ReturnType<typeof q.eq>>[0]) => !q.eq(a, b)(row) }; return callback(operators); });
    return query;
  } });
  f.grant.capabilities = ["read", "write", "run", "admin", "storage:read", "storage:write"];
  const blobs = new Map<string, Blob>(); const deleted: string[] = []; let sequence = 0; let failDelete = false; let stores = 0;
  const storage = {
    store: async (blob: Blob) => { stores++; const id = `_storage:${++sequence}`; blobs.set(id, blob); f.db.seed("_storage", { _id: id, contentType: blob.type, size: blob.size, sha256: await assetContentHash(await blob.arrayBuffer()) }); return id; },
    get: async (id: string) => blobs.get(id) ?? null,
    getMetadata: async (id: string) => { const blob = blobs.get(id); return blob ? { contentType: blob.type, size: blob.size, sha256: await assetContentHash(await blob.arrayBuffer()) } : null; },
    delete: async (id: string) => { if (failDelete) throw new Error("HOST_STORAGE_SECRET"); deleted.push(id); blobs.delete(id); await f.db.delete("_storage", id); },
  };
  Object.defineProperty(f.ctx, "storage", { value: storage });
  Object.defineProperty(f.db, "system", { value: { get: f.db.get.bind(f.db), query: (table: string) => { const query = f.db.query(table); return { withIndex: (_name: string, callback: (q: { gte(key: string, value: number): unknown }) => unknown) => { let minimum = 0; callback({ gte: (_key, value) => { minimum = value; return {}; } }); return query.filter(q => q.gt(q.field("_creationTime"), minimum - 1)); } }; } } });
  const old = f.ctx.runMutation.bind(f.ctx);
  f.ctx.runMutation = (async (ref, args) => {
    let name: string; try { name = getFunctionName(ref); } catch { return old(ref, args); }
    if (name.startsWith("runtimeAssets:")) { const key = name.slice("runtimeAssets:".length); const registration = assets[key as keyof typeof assets]; if (typeof registration === "function" && "_handler" in registration) return await f.call(registration, args); }
    return old(ref, args);
  }) as MutationCtx["runMutation"];
  const action = f.ctx as unknown as ActionCtx;
  async function reserve(text = "private bytes", requestId = "upload-1", mimeType = "text/plain") {
    const bytes = new TextEncoder().encode(text); const job = await f.call<{ jobId: string; marker: string; ready?: RuntimeAssetVersion }>(assets.beginUpload, { requestId, contentHash: await assetContentHash(bytes.buffer), sizeBytes: bytes.byteLength, mimeType }); return { ...job, bytes };
  }
  async function upload(text = "private bytes", requestId = "upload-1", mimeType = "text/plain") { const job = await reserve(text, requestId, mimeType); return { asset: job.ready ?? await assets.storeJobBytes(action, job, job.bytes.buffer), job }; }
  return { ...f, action, blobs, deleted, storage, reserve, upload, get stores() { return stores; }, failDelete(value: boolean) { failDelete = value; } };
}
