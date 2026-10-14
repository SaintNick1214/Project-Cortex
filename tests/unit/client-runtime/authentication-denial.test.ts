import { jest } from "@jest/globals";
import type { AuthTokenFetcher } from "convex/browser";
import { CortexRuntimeClient } from "../../../src/client-runtime/index";
import type { RuntimeClientPort, CortexRuntimeClientOptions } from "../../../src/client-runtime/index";

const actor = { version: 1, tenantId: "tenant", memorySpaceId: "space", principalId: "owner", userId: "user" };
const tick = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
function fixture(fetch: typeof globalThis.fetch, hostFetcher: AuthTokenFetcher = async () => "OPAQUE_TOKEN_WITHOUT_LOCAL_CLAIMS") {
  const callbacks: ((authenticated: boolean) => void)[] = [], fetchers: AuthTokenFetcher[] = [];
  const mutation = jest.fn(async () => actor), close = jest.fn(async () => {});
  const port = { setAuth: (fetcher: AuthTokenFetcher, callback: (authenticated: boolean) => void) => {
    fetchers.push(fetcher); callbacks.push(callback);
  }, mutation, close } as unknown as RuntimeClientPort;
  const authChanges: boolean[] = [];
  const options: CortexRuntimeClientOptions = { deploymentUrl: "https://fixture.convex.cloud", client: port,
    scope: { tenantId: "tenant", memorySpaceId: "space" }, fetchToken: hostFetcher,
    fetch, authTimeoutMs: 40, onAuthChange: value => { authChanges.push(value); } };
  const client = new CortexRuntimeClient(options);
  return { client, options, mutation, close, callbacks, fetchers, authChanges,
    token: (index = fetchers.length - 1) => fetchers[index]({ forceRefreshToken: false }) };
}

describe("authoritative HTTP refusal during a silent official handshake", () => {
  afterEach(() => { jest.useRealTimers(); });
  it.each(["expired", "invalid-signature"])("maps observed 401 for %s to refusal without protected port calls", async () => {
    let request: { url: string; init?: RequestInit } | undefined;
    const f = fixture(async (url, init) => { request = { url: String(url), init }; return new Response("unauthorized", { status: 401 }); });
    const waiting = f.client.session(); const refusal = expect(waiting).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    await f.token(); await refusal;
    expect(request!.url).toBe("https://fixture.convex.cloud/api/mutation");
    expect(request!.init?.redirect).toBe("error"); expect(request!.init?.cache).toBe("no-store");
    expect(new Headers(request!.init?.headers).get("Authorization")).toBe("Bearer OPAQUE_TOKEN_WITHOUT_LOCAL_CLAIMS");
    expect(JSON.parse(String(request!.init?.body))).toMatchObject({ path: "runtimeClient:session", args: [{ tenantId: "tenant", memorySpaceId: "space" }] });
    expect(f.mutation).not.toHaveBeenCalled(); expect(f.authChanges).toEqual([false]);
    await f.client.close(); expect(f.close).not.toHaveBeenCalled();
  });
  it("maps only the official typed UNAUTHENTICATED response", async () => {
    const f = fixture(async () => new Response(JSON.stringify({ status: "error", errorMessage: "refusal",
      errorData: { code: "UNAUTHENTICATED", version: 1 } }), { status: 200 }));
    const refusal = expect(f.client.session()).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    await f.token(); await refusal; expect(f.mutation).not.toHaveBeenCalled(); await f.client.close();
  });
  it("keeps the original destination and fetch port when the caller mutates its options object", async () => {
    const destinations: string[] = [], changedFetch = jest.fn<typeof globalThis.fetch>();
    const f = fixture(async url => { destinations.push(String(url)); return new Response("unauthorized", { status: 401 }); });
    f.options.deploymentUrl = "https://different.convex.cloud"; f.options.fetch = changedFetch;
    const refusal = expect(f.client.session()).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    await f.token(); await refusal;
    expect(destinations).toEqual(["https://fixture.convex.cloud/api/mutation"]);
    expect(changedFetch).not.toHaveBeenCalled(); expect(f.mutation).not.toHaveBeenCalled(); await f.client.close();
  });
  it("never authenticates from a successful HTTP body; official acceptance and native session are still required", async () => {
    const f = fixture(async () => new Response(JSON.stringify({ status: "success", value: actor }), { status: 200 }));
    let delivered = false; const waiting = f.client.session().then(value => { delivered = true; return value; });
    await f.token(); await tick(); expect(delivered).toBe(false); expect(f.mutation).not.toHaveBeenCalled();
    f.callbacks[0](true); expect(await waiting).toEqual(actor); expect(f.mutation).toHaveBeenCalledTimes(1);
    await f.client.close(); expect(f.close).not.toHaveBeenCalled();
  });
  it("preserves the original undefined-token handshake behavior without issuing a probe", async () => {
    jest.useFakeTimers(); const fetch = jest.fn<typeof globalThis.fetch>();
    const f = fixture(fetch, async () => undefined);
    const refusal = expect(f.client.session()).rejects.toMatchObject({ code: "AUTHENTICATION_TIMEOUT" });
    expect(await f.token()).toBeUndefined(); await jest.advanceTimersByTimeAsync(40); await refusal;
    expect(fetch).not.toHaveBeenCalled(); expect(f.mutation).not.toHaveBeenCalled(); await f.client.close();
  });
  it.each(["5xx", "network", "silent", "other-code", "message-only"])("keeps the original timeout for %s", async kind => {
    jest.useFakeTimers(); let signal: AbortSignal | null | undefined;
    const f = fixture(async (_url, init) => {
      signal = init?.signal;
      if (kind === "silent") return new Promise<Response>(() => {});
      if (kind === "network") throw new Error("1006 UNAUTHENTICATED arbitrary message");
      if (kind === "5xx") return new Response("unavailable", { status: 503 });
      return new Response(JSON.stringify({ status: "error", errorMessage: "UNAUTHENTICATED",
        ...(kind === "other-code" ? { errorData: { code: "FORBIDDEN" } } : {}) }), { status: 200 });
    });
    const refusal = expect(f.client.session()).rejects.toMatchObject({ code: "AUTHENTICATION_TIMEOUT" });
    await f.token(); await tick(); await jest.advanceTimersByTimeAsync(40); await refusal;
    expect(signal?.aborted).toBe(true); expect(f.mutation).not.toHaveBeenCalled(); await f.client.close();
  });
  it("ignores a late refusal after refresh and aborts the previous generation", async () => {
    const old = deferred<Response>(), current = deferred<Response>(); const signals: AbortSignal[] = [];
    const f = fixture(async (_url, init) => { signals.push(init!.signal!); return signals.length === 1 ? old.promise : current.promise; });
    const oldRefusal = expect(f.client.session()).rejects.toMatchObject({ code: "AUTH_REFRESHED" });
    await f.token(); const refreshed = f.client.refreshAuth(); await oldRefusal; expect(signals[0].aborted).toBe(true);
    await f.token(); old.resolve(new Response("unauthorized", { status: 401 })); await tick(); expect(f.authChanges).toEqual([]);
    f.callbacks[1](true); await refreshed; current.resolve(new Response("unauthorized", { status: 401 })); await tick();
    expect(await f.client.session()).toEqual(actor); expect(f.authChanges).toEqual([true]); await f.client.close();
  });
  it("keeps a timed-out generation rejected when either transport reports a late result", async () => {
    jest.useFakeTimers(); const late = deferred<Response>();
    const f = fixture(async () => late.promise);
    const refusal = expect(f.client.session()).rejects.toMatchObject({ code: "AUTHENTICATION_TIMEOUT" });
    await f.token(); await jest.advanceTimersByTimeAsync(40); await refusal;
    late.resolve(new Response("unauthorized", { status: 401 })); f.callbacks[0](true); await tick();
    await expect(f.client.session()).rejects.toMatchObject({ code: "AUTHENTICATION_TIMEOUT" });
    expect(f.authChanges).toEqual([false]); expect(f.mutation).not.toHaveBeenCalled(); await f.client.close();
  });
  it("ignores the earlier token probe when the official provider fetches a new token in the same generation", async () => {
    const old = deferred<Response>(), current = deferred<Response>(); const signals: AbortSignal[] = [];
    const f = fixture(async (_url, init) => { signals.push(init!.signal!); return signals.length === 1 ? old.promise : current.promise; });
    const waiting = f.client.session(); await f.token(); await f.token(); expect(signals[0].aborted).toBe(true);
    old.resolve(new Response("unauthorized", { status: 401 })); await tick(); expect(f.authChanges).toEqual([]);
    f.callbacks[0](true); expect(await waiting).toEqual(actor); current.resolve(new Response("ok", { status: 200 })); await tick();
    expect(f.authChanges).toEqual([true]); await f.client.close();
  });
  it("suppresses all late outcomes after close and keeps ownership of a borrowed client", async () => {
    const late = deferred<Response>(); let signal: AbortSignal | null | undefined;
    const f = fixture(async (_url, init) => { signal = init?.signal; return late.promise; });
    const refusal = expect(f.client.session()).rejects.toMatchObject({ code: "CLIENT_CLOSED" });
    await f.token(); await f.client.close(); await refusal; expect(signal?.aborted).toBe(true);
    late.resolve(new Response("unauthorized", { status: 401 })); f.callbacks[0](true); await tick();
    expect(f.authChanges).toEqual([]); expect(f.mutation).not.toHaveBeenCalled(); expect(f.close).not.toHaveBeenCalled();
  });
});
