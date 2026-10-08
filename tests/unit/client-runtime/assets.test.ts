import { jest } from "@jest/globals";
import { getFunctionName } from "convex/server";
import { CortexRuntimeClient, RUNTIME_ASSET_MAX_BYTES } from "../../../src/client-runtime/index";
import type { RuntimeAssetVersion, RuntimeClientPort, RuntimeSession } from "../../../src/client-runtime/index";
import { assetDigest, assetVersion } from "../../../src/client-runtime/assets";

const actor: RuntimeSession = { version: 1, tenantId: "tenant", memorySpaceId: "space", principalId: "owner", userId: "user" };
const ref = { assetId: "asset", version: 1 };
const payload = new TextEncoder().encode("private binary");
async function metadata(bytes = payload): Promise<RuntimeAssetVersion> {
  return { version: 1, assetId: "asset", versionId: "immutable-v1", assetVersion: 1, contentHash: await assetDigest(bytes),
    sizeBytes: bytes.byteLength, mimeType: "application/octet-stream", mediaKind: "binary", lineage: { kind: "upload", requestId: "upload-key" } };
}
function fixture(value: RuntimeAssetVersion, origin = "https://fixture.convex.site/") {
  let current = actor, callback = (_authenticated: boolean) => {};
  const token = jest.fn(async (_args: { forceRefreshToken: boolean }) => "private-host-jwt");
  const requests: { url: URL; init: RequestInit }[] = [];
  const fetcher = jest.fn(async (input: Parameters<typeof globalThis.fetch>[0], init?: RequestInit) => {
    requests.push({ url: new URL(String(input)), init: init! });
    return init?.method === "POST" ? Response.json(value) : new Response(payload, { headers: { "Content-Type": value.mimeType } });
  });
  const mutation = jest.fn(async (reference: Parameters<RuntimeClientPort["mutation"]>[0], _args: Record<string, unknown>) => {
    expect(getFunctionName(reference)).toBe("runtimeAssets:get"); return value;
  });
  const port = { setAuth: (_fetch: unknown, notify: (authenticated: boolean) => void) => { callback = notify; notify(true); },
    query: async () => current, mutation, close: jest.fn(async () => {}) } as unknown as RuntimeClientPort;
  const client = new CortexRuntimeClient({ deploymentUrl: "https://fixture.convex.cloud", assetHttpUrl: origin, fetchToken: token,
    fetch: fetcher as typeof globalThis.fetch, client: port });
  return { client, requests, token, fetcher, mutation, port, actor: (next: RuntimeSession) => { current = next; }, auth: (next: boolean) => callback(next) };
}
const upload = { requestId: "upload-key", mimeType: "application/octet-stream" };
describe("authenticated bounded runtime asset helpers (controlled transport)", () => {
  it("forces a fresh JWT and returns bounded verified bytes; metadata selectors are fresh mutations", async () => {
    const value = await metadata(), f = fixture(value); const blob = await f.client.fetchAsset(ref);
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(payload); expect(blob.type).toBe(value.mimeType);
    expect(f.token).toHaveBeenCalledWith({ forceRefreshToken: true }); expect(f.requests).toHaveLength(1);
    const request = f.requests[0]; expect(request.url.pathname).toBe("/cortex/assets/download");
    expect(Object.fromEntries(request.url.searchParams)).toEqual({ tenantId: "tenant", memorySpaceId: "space", assetId: "asset", version: "1" });
    expect(new Headers(request.init.headers).get("Authorization")).toBe("Bearer private-host-jwt");
    expect(request.init).toMatchObject({ redirect: "error", credentials: "omit", cache: "no-store", method: "GET" });
    expect(f.mutation.mock.calls.map(row => row[1])).toEqual([ { tenantId: "tenant", memorySpaceId: "space", ...ref }, { tenantId: "tenant", memorySpaceId: "space", ...ref } ]);
    await f.client.close(); expect(f.port.close).not.toHaveBeenCalled();
  });
  it("uploads direct bytes once, validates exact hash/MIME/version and detaches mutable caller bytes", async () => {
    const value = await metadata(), f = fixture(value), input = payload.slice();
    const pending = f.client.uploadAsset(input, upload); input.fill(0); expect(await pending).toEqual(value);
    expect(f.requests).toHaveLength(1); expect(f.requests[0].url.pathname).toBe("/cortex/assets/upload");
    expect(f.requests[0].url.searchParams.get("requestId")).toBe("upload-key");
    const body = f.requests[0].init.body as Blob; expect(new Uint8Array(await body.arrayBuffer())).toEqual(payload);
    expect(new Headers(f.requests[0].init.headers).get("Content-Type")).toBe(upload.mimeType); await f.client.close();
  });
  it("rejects oversized input before token, metadata or HTTP", async () => {
    const f = fixture(await metadata()); await expect(f.client.uploadAsset(new Uint8Array(RUNTIME_ASSET_MAX_BYTES + 1), upload)).rejects.toMatchObject({ code: "ASSET_TOO_LARGE" });
    expect(f.token).not.toHaveBeenCalled(); expect(f.fetcher).not.toHaveBeenCalled(); expect(f.mutation).not.toHaveBeenCalled(); await f.client.close();
  });
  it.each([{ bytes: new Uint8Array(0), options: upload }, { bytes: payload, options: { ...upload, filename: "header\r\ninjection" } },
    { bytes: payload, options: { ...upload, requestId: "x".repeat(257) } }])("mirrors empty-byte and metadata limits before HTTP %#", async ({ bytes, options }) => {
    const f = fixture(await metadata()); await expect(f.client.uploadAsset(bytes, options)).rejects.toMatchObject({ code: "INVALID_ASSET_METADATA" });
    expect(f.fetcher).not.toHaveBeenCalled(); await f.client.close();
  });
  it("accepts the exact application upload boundary (controlled, not service qualification)", async () => {
    const bytes = new Uint8Array(RUNTIME_ASSET_MAX_BYTES), value = await metadata(bytes), f = fixture(value);
    expect((await f.client.uploadAsset(bytes, upload)).sizeBytes).toBe(RUNTIME_ASSET_MAX_BYTES); await f.client.close();
  });
  it.each(["http://foreign.example", "https://user:password@example.com", "https://example.com/path", "https://example.com/?token=bad", "https://example.com/#private"])("rejects unsafe HTTP origin %s without forwarding a token", async origin => {
    const f = fixture(await metadata(), origin); await expect(f.client.fetchAsset(ref)).rejects.toMatchObject({ code: "INVALID_INPUT" }); expect(f.token).not.toHaveBeenCalled(); await f.client.close();
  });
  it("allows an explicit loopback HTTP action origin for disposable local hosts", async () => {
    const f = fixture(await metadata(), "http://127.0.0.1:3211"); await f.client.fetchAsset(ref); expect(f.requests[0].url.origin).toBe("http://127.0.0.1:3211"); await f.client.close();
  });
  it("cancels a declared oversized response before body materialization", async () => {
    const f = fixture(await metadata()), cancel = jest.fn<() => void>();
    f.fetcher.mockImplementation(async () => new Response(new ReadableStream({ cancel }), { headers: { "Content-Length": String(RUNTIME_ASSET_MAX_BYTES + 1) } }));
    await expect(f.client.fetchAsset(ref)).rejects.toMatchObject({ code: "ASSET_TOO_LARGE" }); expect(cancel).toHaveBeenCalledTimes(1); await f.client.close();
  });
  it("measures streamed decoded bytes when Content-Length is missing or smaller", async () => {
    const f = fixture(await metadata()), cancel = jest.fn<() => void>(); let chunk = 0;
    f.fetcher.mockImplementation(async () => new Response(new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(chunk++ === 0 ? RUNTIME_ASSET_MAX_BYTES : 1)); }, cancel }), { headers: { "Content-Length": "1" } }));
    await expect(f.client.fetchAsset(ref)).rejects.toMatchObject({ code: "ASSET_TOO_LARGE" }); expect(cancel).toHaveBeenCalledTimes(1); await f.client.close();
  });
  it.each(["size", "mime", "hash"])("withholds bytes with a mismatching immutable %s", async field => {
    const value = await metadata(), f = fixture(field === "size" ? { ...value, sizeBytes: 1 } : value);
    f.fetcher.mockImplementation(async () => new Response(field === "hash" ? new Uint8Array(payload.length) : payload, { headers: { "Content-Type": field === "mime" ? "text/plain" : value.mimeType } }));
    await expect(f.client.fetchAsset(ref)).rejects.toMatchObject({ code: "ASSET_CONTENT_MISMATCH" }); await f.client.close();
  });
  it("rechecks authorization after byte receipt and withholds a retired version", async () => {
    const f = fixture(await metadata()); f.mutation.mockImplementationOnce(async () => await metadata()).mockRejectedValueOnce({ data: { code: "FORBIDDEN" } });
    await expect(f.client.fetchAsset(ref)).rejects.toMatchObject({ code: "FORBIDDEN" }); expect(f.fetcher).toHaveBeenCalledTimes(1); await f.client.close();
  });
  it("rejects mismatched immutable version metadata before HTTP", async () => {
    const f = fixture({ ...await metadata(), assetVersion: 2 }); await expect(f.client.fetchAsset(ref)).rejects.toMatchObject({ code: "ASSET_VERSION_CHANGED" }); expect(f.fetcher).not.toHaveBeenCalled(); await f.client.close();
  });
  it("drops private extras from metadata and lineage", async () => {
    const v = await metadata(); const safe = assetVersion({ ...v, storageId: "private", url: "bearer", lineage: { ...v.lineage, token: "private" } });
    expect(safe).toEqual(v); expect(Object.isFrozen(safe)).toBe(true); expect(Object.isFrozen(safe.lineage)).toBe(true);
  });
  it("refuses malformed response diagnostics and retains only a safe typed code", async () => {
    const f = fixture(await metadata()); f.fetcher.mockImplementation(async () => Response.json({ version: 1, code: "FORBIDDEN", message: "private-diagnostic" }, { status: 403 }));
    await expect(f.client.fetchAsset(ref)).rejects.toMatchObject({ code: "FORBIDDEN", message: "Cortex runtime: FORBIDDEN" }); await f.client.close();
  });
  it("does not fetch on missing fresh identity", async () => {
    const f = fixture(await metadata()); f.token.mockResolvedValueOnce(null as never); await expect(f.client.fetchAsset(ref)).rejects.toMatchObject({ code: "UNAUTHENTICATED" }); expect(f.fetcher).not.toHaveBeenCalled(); await f.client.close();
  });
  it.each(["close", "refresh", "revoke", "cancel"])("bounds an uncooperative HTTP promise after %s", async mode => {
    const f = fixture(await metadata()), external = new AbortController(); let started = () => {};
    const ready = new Promise<void>(resolve => { started = resolve; });
    f.fetcher.mockImplementation(async () => { started(); return await new Promise<Response>(() => {}); });
    const pending = f.client.fetchAsset(ref, { signal: external.signal }); const assertion = expect(pending).rejects.toMatchObject({ code: { close: "CLIENT_CLOSED", refresh: "SESSION_CHANGED", revoke: "UNAUTHENTICATED", cancel: "ASSET_CANCELLED" }[mode] });
    await ready;
    if (mode === "close") await f.client.close(); else if (mode === "refresh") await f.client.refreshAuth(); else if (mode === "revoke") f.auth(false); else external.abort();
    await assertion; await f.client.close();
  });
  it("bounds a hung fresh token lookup before dispatch and ignores its late token", async () => {
    const f = fixture(await metadata()); let release = (_token: string) => {}, started = () => {};
    const ready = new Promise<void>(resolve => { started = resolve; }); f.token.mockImplementation(async () => { started(); return new Promise<string>(resolve => { release = resolve; }); });
    const pending = f.client.fetchAsset(ref); const assertion = expect(pending).rejects.toMatchObject({ code: "CLIENT_CLOSED" }); await ready; await f.client.close(); await assertion; release("late-jwt");
    for (let i = 0; i < 8; i++) await Promise.resolve(); expect(f.fetcher).not.toHaveBeenCalled();
  });
  it("withholds delivery when the verified principal changes during a body read", async () => {
    const f = fixture(await metadata()); f.fetcher.mockImplementation(async () => { f.actor({ ...actor, principalId: "other" }); return new Response(payload, { headers: { "Content-Type": upload.mimeType } }); });
    await expect(f.client.fetchAsset(ref)).rejects.toMatchObject({ code: "SESSION_CHANGED" }); await f.client.close();
  });
  it.each(["close", "refresh", "revoke", "manual"])("revokes local Blob rendering URLs after %s", async mode => {
    const f = fixture(await metadata()), revoke = jest.spyOn(URL, "revokeObjectURL");
    const preview = await f.client.createAssetUrl(ref); expect(preview.url.startsWith("blob:")).toBe(true);
    expect(preview).toMatchObject({ mimeType: upload.mimeType, sizeBytes: payload.length });
    if (mode === "close") await f.client.close(); else if (mode === "refresh") await f.client.refreshAuth(); else if (mode === "revoke") f.auth(false); else preview.revoke();
    preview.revoke(); expect(revoke).toHaveBeenCalledTimes(1); expect(revoke).toHaveBeenCalledWith(preview.url);
    await f.client.close(); revoke.mockRestore();
  });
  it("bounds a hung HTTP operation at its configured deadline", async () => {
    const f = fixture(await metadata()); f.fetcher.mockImplementation(async () => new Promise<Response>(() => {}));
    await expect(f.client.fetchAsset(ref, { timeoutMs: 1000 })).rejects.toMatchObject({ code: "ASSET_TIMEOUT" }); await f.client.close();
  });
});
