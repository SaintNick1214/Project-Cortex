import { beforeAll, describe, expect, it, jest } from "@jest/globals";
import { ConvexHttpClient, ConvexClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import {
  HostCredentials,
  type HostTokenFetcher,
  type HostTokenRequest,
  type HostAuthFailure,
} from "../../../src/auth/credentials";

// Synthetic compact strings test transport plumbing only. No signed identity or
// managed Convex authorization qualification is claimed by this suite.
const firstToken = "header.payload.signatureA";
const refreshedToken = "header.payload.signatureB";
const testQuery = makeFunctionReference<"query", Record<string, never>, string>(
  "test:read",
);

function httpFixture() {
  const requests: Array<RequestInit | undefined> = [];
  const fetch: typeof globalThis.fetch = async (_input, init) => {
    requests.push(init);
    return new Response(JSON.stringify({ status: "success", value: "result" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  const client = new ConvexHttpClient("https://example.convex.cloud", {
    fetch,
    logger: false,
  });
  return { client, requests };
}

describe("HostCredentials", () => {
  it("forwards the exact official force-refresh request and returns changed tokens", async () => {
    let token: string | null = firstToken;
    const getter = jest.fn<HostTokenFetcher>(async () => token);
    const credentials = new HostCredentials(getter);
    const ordinary = { forceRefreshToken: false };
    const forced = { forceRefreshToken: true };

    expect(await credentials.fetchToken(ordinary)).toBe(firstToken);
    token = refreshedToken;
    expect(await credentials.fetchToken(forced)).toBe(refreshedToken);
    token = null;
    expect(await credentials.fetchToken(forced)).toBeNull();
    expect(getter.mock.calls.map(([request]) => request)).toEqual([
      ordinary, forced, forced,
    ]);
    expect(getter.mock.calls[0][0]).toBe(ordinary);
    expect(getter.mock.calls[1][0]).toBe(forced);
  });

  it.each([undefined, null, "static-token", {}, 42])(
    "rejects a non-function getter (%p) before any client is allocated",
    (getter) => {
      expect(() => new HostCredentials(getter as HostTokenFetcher)).toThrow(
        "fetchAuthToken must be an async function",
      );
    },
  );

  it("rejects a synchronous getter result", async () => {
    const getter = (() => firstToken) as unknown as HostTokenFetcher;
    await expect(new HostCredentials(getter).fetchToken({ forceRefreshToken: false }))
      .rejects.toThrow("fetchAuthToken must return a Promise");
  });

  it.each([
    undefined, 7, {}, { token: firstToken }, "", " ", "provider-key",
    `Bearer ${firstToken}`, ` ${firstToken}`, `${firstToken}\n`,
    "header.payload.", "header.payload.signature.extra",
  ])("rejects malformed token results (%p) without disclosure or HTTP effects", async (value) => {
    const credentials = new HostCredentials(
      (async () => value) as HostTokenFetcher,
    );
    const { client, requests } = httpFixture();
    const setAuth = jest.spyOn(client, "setAuth");
    const clearAuth = jest.spyOn(client, "clearAuth");
    const operation = jest.fn(async () => "should not run");
    await expect(credentials.withHttpAuth(client, operation)).rejects.toMatchObject({
      name: "TypeError",
      message: "fetchAuthToken must resolve to a raw JWT or null",
    });
    expect(operation).not.toHaveBeenCalled();
    expect(setAuth).not.toHaveBeenCalled();
    expect(clearAuth).not.toHaveBeenCalled();
    expect(requests).toEqual([]);
  });

  it("preserves a host getter rejection and never invokes an HTTP operation", async () => {
    const rejection = new Error("host authentication unavailable");
    const credentials = new HostCredentials(async () => { throw rejection; });
    const { client, requests } = httpFixture();
    const setAuth = jest.spyOn(client, "setAuth");
    const clearAuth = jest.spyOn(client, "clearAuth");
    const operation = jest.fn(async () => "should not run");

    await expect(credentials.fetchToken({ forceRefreshToken: true }))
      .rejects.toBe(rejection);
    await expect(credentials.withHttpAuth(client, operation)).rejects.toBe(rejection);
    expect(operation).not.toHaveBeenCalled();
    expect(setAuth).not.toHaveBeenCalled();
    expect(clearAuth).not.toHaveBeenCalled();
    expect(requests).toEqual([]);
  });

  it("supplies fresh fetch headers, honors forced refresh, and removes auth on null", async () => {
    let token: string | null = firstToken;
    const getter = jest.fn<HostTokenFetcher>(async () => token);
    const credentials = new HostCredentials(getter);
    expect(await credentials.getAuthorizationHeaders()).toEqual({
      Authorization: `Bearer ${firstToken}`,
    });
    token = refreshedToken;
    expect(await credentials.getAuthorizationHeaders({ forceRefreshToken: true }))
      .toEqual({ Authorization: `Bearer ${refreshedToken}` });
    token = null;
    expect(await credentials.getAuthorizationHeaders()).toEqual({});
    expect(getter.mock.calls.map(([request]) => request.forceRefreshToken))
      .toEqual([false, true, false]);
  });

  it("propagates a header getter failure instead of returning stale headers", async () => {
    const rejection = new Error("host session expired");
    const credentials = new HostCredentials(async () => { throw rejection; });
    await expect(credentials.getAuthorizationHeaders()).rejects.toBe(rejection);
  });

  it("attaches changed JWTs to actual ConvexHttpClient wire requests and clears logout identity", async () => {
    let token: string | null = firstToken;
    const getter = jest.fn<HostTokenFetcher>(async () => token);
    const credentials = new HostCredentials(getter);
    const { client, requests } = httpFixture();
    const operation = (http: ConvexHttpClient) => http.query(testQuery, {});

    expect(await credentials.withHttpAuth(client, operation)).toBe("result");
    token = refreshedToken;
    expect(await credentials.withHttpAuth(client, operation, { forceRefreshToken: true }))
      .toBe("result");
    token = null;
    expect(await credentials.withHttpAuth(client, operation)).toBe("result");
    expect(requests.map((request) => new Headers(request?.headers).get("Authorization")))
      .toEqual([`Bearer ${firstToken}`, `Bearer ${refreshedToken}`, null]);
    expect(getter.mock.calls.map(([request]) => request.forceRefreshToken))
      .toEqual([false, true, false]);
  });

  it("does not retry an ambiguous operation error and permits the next explicit invocation", async () => {
    const credentials = new HostCredentials(async () => firstToken);
    const { client } = httpFixture();
    const uncertain = new Error("upstream outcome unknown");
    const operation = jest.fn(async () => { throw uncertain; });

    await expect(credentials.withHttpAuth(client, operation)).rejects.toBe(uncertain);
    expect(operation).toHaveBeenCalledTimes(1);
    const next = jest.fn(async () => "next explicit request");
    expect(await credentials.withHttpAuth(client, next)).toBe("next explicit request");
    expect(next).toHaveBeenCalledTimes(1);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("serializes a shared HTTP client without fetching or replacing the next operation's token early", async () => {
    let token = firstToken;
    const getter = jest.fn<HostTokenFetcher>(async () => token);
    const credentials = new HostCredentials(getter);
    const { client, requests } = httpFixture();
    let release!: () => void;
    let entered!: () => void;
    const barrier = new Promise<void>((resolve) => { release = resolve; });
    const started = new Promise<void>((resolve) => { entered = resolve; });
    const first = credentials.withHttpAuth(client, async (http) => {
      entered();
      await barrier;
      return await http.query(testQuery, {});
    });
    await started;
    token = refreshedToken;
    const second = credentials.withHttpAuth(client, (http) => http.query(testQuery, {}));
    await Promise.resolve();
    expect(getter).toHaveBeenCalledTimes(1);
    release();
    expect(await Promise.all([first, second])).toEqual(["result", "result"]);
    expect(requests.map((request) => new Headers(request?.headers).get("Authorization")))
      .toEqual([`Bearer ${firstToken}`, `Bearer ${refreshedToken}`]);
  });
});

// Mock only the reactive transport constructor. Domain modules and Cortex's
// constructor execute normally; the captured official callback is invoked below.
class ReactiveClient {
  closed = false;
  readonly client = { hasAuth: () => false, clearAuth: jest.fn() };
  readonly setAuth = jest.fn<ConvexClient["setAuth"]>();
  readonly close = jest.fn(async () => undefined);
}
const reactiveInstances: ReactiveClient[] = [];
const reactiveConstructor = jest.fn((_url: string) => {
  const client = new ReactiveClient();
  reactiveInstances.push(client);
  return client;
});
jest.unstable_mockModule("convex/browser", () => ({
  ConvexClient: reactiveConstructor,
  ConvexHttpClient,
}));
const { Cortex } = await import("../../../src/index");

describe("Cortex host credential constructor binding", () => {
  it("binds the real credential callback and observes refresh/logout changes", async () => {
    let token: string | null = firstToken;
    const getter = jest.fn<HostTokenFetcher>(async () => token);
    const metadata = { userId: "caller-label", tenantId: "caller-tenant", claims: { role: "admin" } };
    const cortex = new Cortex({
      convexUrl: "https://example.convex.cloud",
      fetchAuthToken: getter,
      auth: metadata,
      resilience: { enabled: false },
    });
    const reactive = reactiveInstances.at(-1)!;
    expect(reactive.setAuth).toHaveBeenCalledTimes(1);
    expect(reactive.setAuth).toHaveBeenCalledWith(expect.any(Function), expect.any(Function));
    const callback = reactive.setAuth.mock.calls[0][0];
    const force: HostTokenRequest = { forceRefreshToken: true };
    expect(await callback({ forceRefreshToken: false })).toBe(firstToken);
    token = refreshedToken;
    expect(await callback(force)).toBe(refreshedToken);
    expect(getter.mock.calls.at(-1)![0]).toBe(force);
    token = null;
    expect(await callback(force)).toBeNull();
    expect(cortex.auth).toBe(metadata);
    cortex.close();
    expect(reactive.close).toHaveBeenCalledTimes(1);
  });

  it("does not set Convex auth from caller user/tenant/claims metadata", () => {
    const cortex = new Cortex({
      convexUrl: "https://example.convex.cloud",
      auth: { userId: "claimed-user", tenantId: "claimed-tenant", claims: { role: "admin", token: firstToken } },
      resilience: { enabled: false },
    });
    const reactive = reactiveInstances.at(-1)!;
    expect(reactive.setAuth).not.toHaveBeenCalled();
    expect(cortex.credentials).toBeUndefined();
    cortex.close();
  });

  it("notifies the active binding on logout, login and host identity replacement", async () => {
    let token: string | null = firstToken;
    const getter = jest.fn<HostTokenFetcher>(async () => token);
    const cortex = new Cortex({
      convexUrl: "https://example.convex.cloud",
      fetchAuthToken: getter,
      resilience: { enabled: false },
    });
    const reactive = reactiveInstances.at(-1)!;
    for (const nextToken of [null, firstToken, refreshedToken]) {
      token = nextToken;
      const calls = reactive.setAuth.mock.calls.length;
      cortex.credentials!.notifySessionChanged();
      expect(reactive.setAuth).toHaveBeenCalledTimes(calls + 1);
      const callback = reactive.setAuth.mock.calls.at(-1)![0];
      expect(await callback({ forceRefreshToken: false })).toBe(nextToken);
      expect(getter.mock.calls.at(-1)![0]).toEqual({ forceRefreshToken: true });
      const subsequent = { forceRefreshToken: false };
      expect(await callback(subsequent)).toBe(nextToken);
      expect(getter.mock.calls.at(-1)![0]).toBe(subsequent);
    }
    cortex.close();
  });

  it("rejects unbound/closed reactive notifications and prevents multiple active bindings", () => {
    const credentials = new HostCredentials(async () => firstToken);
    expect(() => credentials.notifySessionChanged()).toThrow("No reactive client is bound");
    const first = new ReactiveClient();
    const second = new ReactiveClient();
    credentials.bindReactiveClient(first);
    expect(first.setAuth).toHaveBeenCalledWith(expect.any(Function), expect.any(Function));
    expect(() => credentials.bindReactiveClient(second)).toThrow("already have a bound reactive client");
    expect(second.setAuth).not.toHaveBeenCalled();
    first.closed = true;
    expect(() => credentials.notifySessionChanged()).toThrow("Cannot refresh a closed reactive client");
    expect(first.setAuth).toHaveBeenCalledTimes(1);
    expect(() => credentials.bindReactiveClient(first)).toThrow("Cannot bind a closed reactive client");
    credentials.bindReactiveClient(second);
    expect(second.setAuth).toHaveBeenCalledTimes(1);
  });

  it("validates a configured non-function getter before constructing ConvexClient", () => {
    const calls = reactiveConstructor.mock.calls.length;
    expect(() => new Cortex({
      convexUrl: "https://example.convex.cloud",
      fetchAuthToken: "static-token" as unknown as HostTokenFetcher,
    })).toThrow("fetchAuthToken must be an async function");
    expect(reactiveConstructor.mock.calls.length).toBe(calls);
  });

  it("fails reactive callback errors closed with a sanitized diagnostic and no metadata credentials", async () => {
    const rejected = new Error("host auth failure");
    const cortex = new Cortex({
      convexUrl: "https://example.convex.cloud",
      fetchAuthToken: async () => { throw rejected; },
      auth: { userId: "claimed-user", claims: { token: firstToken } },
      resilience: { enabled: false },
    });
    const reactive = reactiveInstances.at(-1)!;
    const callback = reactive.setAuth.mock.calls[0][0];
    await expect(callback({ forceRefreshToken: true })).resolves.toBeNull();
    expect(cortex.credentials!.authFailure).toEqual({ code: "HOST_TOKEN_FETCH_FAILED", attemptId: 1 });
    expect(reactive.setAuth).toHaveBeenCalledTimes(1);
    cortex.close();
  });

  it("validates a configured diagnostic callback before allocating a client", () => {
    const calls = reactiveConstructor.mock.calls.length;
    expect(() => new Cortex({
      convexUrl: "https://example.convex.cloud",
      fetchAuthToken: async () => null,
      onAuthError: "invalid" as unknown as (failure: HostAuthFailure) => void,
    })).toThrow("onAuthError must be a function");
    expect(reactiveConstructor.mock.calls.length).toBe(calls);
  });

  it("auth success notifications cannot hide a getter diagnostic and stale/closed deferred clears are fenced", async () => {
    let rejectHost = true;
    const credentials = new HostCredentials(async () => {
      if (rejectHost) throw new Error("host failure");
      return refreshedToken;
    });
    const reactive = new ReactiveClient();
    credentials.bindReactiveClient(reactive);
    const [oldFetcher, oldStatus] = reactive.setAuth.mock.calls[0];
    await expect(oldFetcher({ forceRefreshToken: false })).resolves.toBeNull();
    const diagnostic = credentials.authFailure;
    oldStatus?.(true);
    expect(credentials.authFailure).toBe(diagnostic);
    oldStatus?.(false);
    rejectHost = false;
    credentials.notifySessionChanged();
    const [newFetcher, newStatus] = reactive.setAuth.mock.calls.at(-1)!;
    await expect(newFetcher({ forceRefreshToken: false })).resolves.toBe(refreshedToken);
    await flushAuthTasks();
    expect(reactive.client.clearAuth).not.toHaveBeenCalled();
    expect(credentials.authFailure).toBeUndefined();
    newStatus?.(false);
    oldStatus?.(false);
    await flushAuthTasks();
    expect(reactive.client.clearAuth).toHaveBeenCalledTimes(1);
    reactive.client.clearAuth.mockClear();
    newStatus?.(false);
    reactive.closed = true;
    await flushAuthTasks();
    expect(reactive.client.clearAuth).not.toHaveBeenCalled();
  });
});

interface WireMessage {
  type: string;
  tokenType?: string;
  value?: string;
}

/** Inert opened transport: records official messages in memory, performs no network. */
class InertWebSocket {
  static instances: InertWebSocket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onclose: ((event: { code: number; reason: string; wasClean: boolean }) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  readonly messages: WireMessage[] = [];

  constructor(readonly url: string) {
    InertWebSocket.instances.push(this);
    queueMicrotask(() => {
      if (this.readyState === 0) {
        this.readyState = 1;
        this.onopen?.();
      }
    });
  }

  send(message: string): void {
    // The installed Convex client produces these JSON protocol objects.
    this.messages.push(JSON.parse(message) as WireMessage);
  }

  close(): void {
    this.readyState = 3;
    queueMicrotask(() => this.onclose?.({ code: 1000, reason: "test complete", wasClean: true }));
  }
}

async function flushAuthTasks(): Promise<void> {
  // Include the single post-resume deauthentication event task.
  await new Promise<void>((resolve) => setImmediate(resolve));
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  await new Promise<void>((resolve) => setImmediate(resolve));
}

function assertResumedWithoutIdentity(client: ConvexClient, socket: InertWebSocket): void {
  expect(client.getAuth()).toBeUndefined();
  expect(client.connectionState().hasEverConnected).toBe(true);
  const before = socket.messages.length;
  const stop = client.onUpdate(testQuery, {}, () => undefined);
  expect(socket.messages.slice(before).some((message) => message.type === "ModifyQuerySet")).toBe(true);
  stop();
}

describe("Installed Convex reactive authentication error outcomes", () => {
  let ActualCortex: typeof Cortex;

  beforeAll(async () => {
    // Restore the official constructor for this proof; earlier tests retain their
    // already-imported narrow mocked Cortex constructor in their local binding.
    jest.unstable_unmockModule("convex/browser");
    jest.resetModules();
    ({ Cortex: ActualCortex } = await import("../../../src/index"));
  });

  it("actual Cortex constructor contains rejecting host callbacks, resumes unauthenticated and recovers", async () => {
    const originalWebSocket = globalThis.WebSocket;
    // Fake implements the small transport surface used by the installed client.
    globalThis.WebSocket = InertWebSocket as unknown as typeof WebSocket;
    const unhandled: unknown[] = [];
    const observeUnhandled = (error: unknown) => { unhandled.push(error); };
    process.on("unhandledRejection", observeUnhandled);
    let rejectHost = true;
    const observed: HostAuthFailure[] = [];
    const getter = jest.fn<HostTokenFetcher>(async () => {
      if (rejectHost) throw new Error("host-private-error-do-not-expose");
      return refreshedToken;
    });
    const cortex = new ActualCortex({
      convexUrl: "https://example.convex.cloud",
      fetchAuthToken: getter,
      onAuthError: (failure) => { observed.push(failure); throw new Error("observer failed"); },
      resilience: { enabled: false },
    });
    try {
      await flushAuthTasks();
      const client = cortex.getClient();
      const socket = InertWebSocket.instances.at(-1)!;
      assertResumedWithoutIdentity(client, socket);
      expect(unhandled).toEqual([]);
      expect(observed).toEqual([
        { code: "HOST_TOKEN_FETCH_FAILED", attemptId: 1 },
        { code: "HOST_TOKEN_FETCH_FAILED", attemptId: 2 },
      ]);
      expect(cortex.credentials!.authFailure).toEqual(observed[1]);
      expect(Object.isFrozen(cortex.credentials!.authFailure)).toBe(true);
      expect(socket.messages.some((message) => message.tokenType === "User")).toBe(false);
      rejectHost = false;
      cortex.credentials!.notifySessionChanged();
      await flushAuthTasks();
      expect(client.getAuth()?.token).toBe(refreshedToken);
      expect(cortex.credentials!.authFailure).toBeUndefined();
      expect(getter.mock.calls.map(([request]) => request.forceRefreshToken)).toEqual([false, true, true]);
      expect(unhandled).toEqual([]);
    } finally {
      await cortex.shutdown();
      process.off("unhandledRejection", observeUnhandled);
      globalThis.WebSocket = originalWebSocket;
    }
  });

  it.each([
    ["malformed", (async () => "Bearer invalid-secret-value") as HostTokenFetcher],
    ["synchronous", (() => firstToken) as unknown as HostTokenFetcher],
  ])("official client contains %s results, isolates async observers and clears an existing identity", async (_label, invalidGetter) => {
    let getter: HostTokenFetcher = async () => firstToken;
    const credentials = new HostCredentials(
      (request) => getter(request),
      async () => { throw new Error("async observer failure"); },
    );
    const client = new ConvexClient("https://example.convex.cloud", {
      webSocketConstructor: InertWebSocket as unknown as typeof WebSocket,
      logger: false,
    });
    const unhandled: unknown[] = [];
    const observeUnhandled = (error: unknown) => { unhandled.push(error); };
    process.on("unhandledRejection", observeUnhandled);
    try {
      credentials.bindReactiveClient(client);
      await flushAuthTasks();
      expect(client.getAuth()?.token).toBe(firstToken);
      getter = invalidGetter;
      credentials.notifySessionChanged();
      await flushAuthTasks();
      const socket = InertWebSocket.instances.at(-1)!;
      assertResumedWithoutIdentity(client, socket);
      expect(credentials.authFailure).toEqual({ code: "INVALID_HOST_TOKEN", attemptId: 3 });
      expect(socket.messages.filter((message) => message.tokenType === "User").map((message) => message.value))
        .toEqual([firstToken]);
      expect(socket.messages.some((message) => message.tokenType === "None")).toBe(true);
      expect(unhandled).toEqual([]);
      getter = async () => refreshedToken;
      credentials.notifySessionChanged();
      await flushAuthTasks();
      expect(client.getAuth()?.token).toBe(refreshedToken);
      expect(credentials.authFailure).toBeUndefined();
      expect(unhandled).toEqual([]);
    } finally {
      await client.close();
      process.off("unhandledRejection", observeUnhandled);
    }
  });

  it("official refresh/logout/login updates identity with no getter failure diagnostic", async () => {
    let token: string | null = firstToken;
    const getter = jest.fn<HostTokenFetcher>(async () => token);
    const credentials = new HostCredentials(getter);
    const client = new ConvexClient("https://example.convex.cloud", {
      webSocketConstructor: InertWebSocket as unknown as typeof WebSocket,
      logger: false,
    });
    try {
      credentials.bindReactiveClient(client);
      await flushAuthTasks();
      expect(client.getAuth()?.token).toBe(firstToken);
      token = null;
      credentials.notifySessionChanged();
      await flushAuthTasks();
      assertResumedWithoutIdentity(client, InertWebSocket.instances.at(-1)!);
      expect(credentials.authFailure).toBeUndefined();
      token = refreshedToken;
      credentials.notifySessionChanged();
      await flushAuthTasks();
      expect(client.getAuth()?.token).toBe(refreshedToken);
      expect(getter.mock.calls.map(([request]) => request.forceRefreshToken)).toEqual([false, true, true, true]);
    } finally {
      await client.close();
    }
  });

  it("official server rejection refresh contains host errors, reconnects unauthenticated and exposes a diagnostic", async () => {
    let rejectHost = false;
    const getter = jest.fn<HostTokenFetcher>(async () => {
      if (rejectHost) throw new Error("host refresh failed");
      return firstToken;
    });
    const credentials = new HostCredentials(getter);
    const client = new ConvexClient("https://example.convex.cloud", {
      webSocketConstructor: InertWebSocket as unknown as typeof WebSocket,
      logger: false,
    });
    const unhandled: unknown[] = [];
    const observeUnhandled = (error: unknown) => { unhandled.push(error); };
    process.on("unhandledRejection", observeUnhandled);
    try {
      credentials.bindReactiveClient(client);
      await flushAuthTasks();
      expect(client.getAuth()?.token).toBe(firstToken);
      const oldSocket = InertWebSocket.instances.at(-1)!;
      rejectHost = true;
      oldSocket.onmessage?.({ data: JSON.stringify({
        type: "AuthError", error: "test credential rejected", baseVersion: 0,
        authUpdateAttempted: true,
      }) });
      await flushAuthTasks();
      const newSocket = InertWebSocket.instances.at(-1)!;
      expect(newSocket).not.toBe(oldSocket);
      expect(oldSocket.readyState).toBe(3);
      assertResumedWithoutIdentity(client, newSocket);
      expect(credentials.authFailure).toEqual({ code: "HOST_TOKEN_FETCH_FAILED", attemptId: 2 });
      expect(newSocket.messages.some((message) => message.tokenType === "User")).toBe(false);
      expect(getter.mock.calls.map(([request]) => request.forceRefreshToken)).toEqual([false, true]);
      expect(unhandled).toEqual([]);
    } finally {
      await client.close();
      process.off("unhandledRejection", observeUnhandled);
    }
  });

  it("older delayed success/rejection cannot overwrite the latest failure or recovered official session", async () => {
    let settleOld!: (token: string | null) => void;
    let rejectOld!: (error: Error) => void;
    let getter: HostTokenFetcher = () => new Promise((resolve, reject) => {
      settleOld = resolve;
      rejectOld = reject;
    });
    const observed: HostAuthFailure[] = [];
    const credentials = new HostCredentials((request) => getter(request), (failure) => { observed.push(failure); });
    const client = new ConvexClient("https://example.convex.cloud", {
      webSocketConstructor: InertWebSocket as unknown as typeof WebSocket,
      logger: false,
    });
    try {
      credentials.bindReactiveClient(client);
      getter = async () => { throw new Error("latest host failure"); };
      credentials.notifySessionChanged();
      await flushAuthTasks();
      const latestFailure = credentials.authFailure;
      expect(latestFailure).toEqual({ code: "HOST_TOKEN_FETCH_FAILED", attemptId: 3 });
      settleOld(firstToken);
      await flushAuthTasks();
      expect(credentials.authFailure).toBe(latestFailure);
      expect(client.getAuth()).toBeUndefined();

      getter = () => new Promise((_resolve, reject) => { rejectOld = reject; });
      credentials.notifySessionChanged();
      getter = async () => refreshedToken;
      credentials.notifySessionChanged();
      await flushAuthTasks();
      expect(credentials.authFailure).toBeUndefined();
      expect(client.getAuth()?.token).toBe(refreshedToken);
      const observedBefore = observed.length;
      rejectOld(new Error("stale host failure"));
      await flushAuthTasks();
      expect(credentials.authFailure).toBeUndefined();
      expect(client.getAuth()?.token).toBe(refreshedToken);
      expect(observed).toHaveLength(observedBefore);
    } finally {
      await client.close();
    }
  });

  it("overlapping official notifications while paused deliver None and preserve a newer recovered identity", async () => {
    let settleOld!: (token: string | null) => void;
    let getter: HostTokenFetcher = async () => firstToken;
    const credentials = new HostCredentials((request) => getter(request));
    const client = new ConvexClient("https://example.convex.cloud", {
      webSocketConstructor: InertWebSocket as unknown as typeof WebSocket,
      logger: false,
    });
    try {
      credentials.bindReactiveClient(client);
      await flushAuthTasks();
      expect(client.getAuth()?.token).toBe(firstToken);
      getter = () => new Promise((resolve) => { settleOld = resolve; });
      credentials.notifySessionChanged();
      getter = async () => { throw new Error("latest host failure"); };
      credentials.notifySessionChanged();
      await flushAuthTasks();
      const socket = InertWebSocket.instances.at(-1)!;
      assertResumedWithoutIdentity(client, socket);
      expect(credentials.authFailure).toEqual({ code: "HOST_TOKEN_FETCH_FAILED", attemptId: 4 });
      expect(socket.messages.filter((message) => message.tokenType === "None").length).toBeGreaterThanOrEqual(2);
      getter = async () => refreshedToken;
      credentials.notifySessionChanged();
      await flushAuthTasks();
      settleOld(firstToken);
      await flushAuthTasks();
      expect(client.getAuth()?.token).toBe(refreshedToken);
      expect(credentials.authFailure).toBeUndefined();
      expect(socket.messages.filter((message) => message.tokenType === "User").map((message) => message.value))
        .toEqual([firstToken, refreshedToken]);
    } finally {
      await client.close();
    }
  });
});
