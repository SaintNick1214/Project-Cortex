import type { ConvexClient, ConvexHttpClient } from "convex/browser";

/** The host must bypass its token cache when Convex requests a refresh. */
export interface HostTokenRequest {
  forceRefreshToken: boolean;
}

/**
 * Retrieve the current host-issued JWT, or null after logout. This is an
 * authentication credential, never an upstream model/provider credential.
 */
export type HostTokenFetcher = (
  request: HostTokenRequest,
) => Promise<string | null>;

/** Sanitized reactive-auth failure; contains no token or host error content. */
export interface HostAuthFailure {
  readonly code: "HOST_TOKEN_FETCH_FAILED" | "INVALID_HOST_TOKEN";
  readonly attemptId: number;
}

/** Callback failures are isolated from the reactive transport's auth flow. */
export type HostAuthErrorHandler = (
  failure: HostAuthFailure,
) => void | Promise<void>;

class InvalidHostTokenResultError extends TypeError {}

type ReactiveAuthClient = Pick<ConvexClient, "closed" | "setAuth"> & {
  readonly client: Pick<ConvexClient["client"], "hasAuth" | "clearAuth">;
};

/**
 * Browser-safe host credentials shared by reactive and HTTP transports.
 * Tokens are not cached, decoded, logged or converted into authorization claims.
 * Convex verifies identity; Cortex's backend resolves trusted grants.
 */
export class HostCredentials {
  private readonly httpOperations = new WeakMap<ConvexHttpClient, Promise<void>>();
  private reactiveClient?: ReactiveAuthClient;
  private reactiveVersion = 0;
  private reactiveAttemptId = 0;
  private latestAuthFailure?: HostAuthFailure;
  private pendingDeauthTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly fetchAuthToken: HostTokenFetcher,
    private readonly onAuthError?: HostAuthErrorHandler,
  ) {
    if (typeof fetchAuthToken !== "function") {
      throw new TypeError("fetchAuthToken must be an async function");
    }
    if (onAuthError !== undefined && typeof onAuthError !== "function") {
      throw new TypeError("onAuthError must be a function");
    }
  }

  /** Latest reactive failure; only a later current successful token/null fetch clears it. */
  get authFailure(): HostAuthFailure | undefined {
    return this.latestAuthFailure;
  }

  /** Direct token retrieval rejects errors. Reactive binding uses a safe adapter. */
  readonly fetchToken: HostTokenFetcher = async (request) => {
    const pending: unknown = this.fetchAuthToken(request);
    if (
      typeof pending !== "object" ||
      pending === null ||
      !("then" in pending) ||
      typeof pending.then !== "function"
    ) {
      throw new InvalidHostTokenResultError("fetchAuthToken must return a Promise");
    }

    const token: unknown = await Promise.resolve(pending);
    if (token === null) {
      return null;
    }
    // Only validate the raw compact JWT shape. Signature, issuer, audience and
    // claims are checked by the host-configured Convex authentication boundary.
    if (
      typeof token !== "string" ||
      !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)
    ) {
      throw new InvalidHostTokenResultError("fetchAuthToken must resolve to a raw JWT or null");
    }
    return token;
  };

  /** Bind one reactive transport using Convex's official refresh callback. */
  bindReactiveClient(client: ReactiveAuthClient): void {
    if (client.closed) {
      throw new Error("Cannot bind a closed reactive client");
    }
    if (this.reactiveClient && this.reactiveClient !== client && !this.reactiveClient.closed) {
      throw new Error("Host credentials already have a bound reactive client");
    }
    this.reactiveClient = client;
    this.configureReactiveAuth(client, false);
  }

  /**
   * Call after host login, logout or identity changes. Reconfigure official Convex
   * auth and force the first host token fetch to bypass its cache; later refresh
   * requests are forwarded unchanged. A null token clears Convex identity.
   * Stop private observers on logout; persisted background grants still require
   * explicit backend revocation/deletion. Throws when unbound or already closed.
   */
  notifySessionChanged(): void {
    const client = this.reactiveClient;
    if (!client) {
      throw new Error("No reactive client is bound to host credentials");
    }
    if (client.closed) {
      this.reactiveClient = undefined;
      throw new Error("Cannot refresh a closed reactive client");
    }
    this.configureReactiveAuth(client, true);
  }

  private configureReactiveAuth(
    client: ReactiveAuthClient,
    forceFirstFetch: boolean,
  ): void {
    const version = ++this.reactiveVersion;
    if (this.pendingDeauthTimer !== undefined) {
      clearTimeout(this.pendingDeauthTimer);
      this.pendingDeauthTimer = undefined;
    }
    const baseClient = client.client;
    // Remove the prior session identity before setAuth pauses the transport.
    if (baseClient.hasAuth()) {
      baseClient.clearAuth();
    }
    let firstFetch = forceFirstFetch;
    client.setAuth(async (request) => {
      if (version !== this.reactiveVersion || client.closed) {
        return null;
      }
      const currentRequest = firstFetch
        ? { ...request, forceRefreshToken: true }
        : request;
      firstFetch = false;
      const attemptId = ++this.reactiveAttemptId;
      try {
        const token = await this.fetchToken(currentRequest);
        if (this.isCurrentReactiveAttempt(client, version, attemptId)) {
          this.latestAuthFailure = undefined;
        }
        return token;
      } catch (error: unknown) {
        if (this.isCurrentReactiveAttempt(client, version, attemptId)) {
          const failure: HostAuthFailure = Object.freeze({
            code: error instanceof InvalidHostTokenResultError
              ? "INVALID_HOST_TOKEN"
              : "HOST_TOKEN_FETCH_FAILED",
            attemptId,
          });
          this.latestAuthFailure = failure;
          // Convex invokes setAuth's async callback without awaiting/catching it.
          // Isolate both synchronous and async diagnostic observer failures too.
          try {
            void Promise.resolve(this.onAuthError?.(failure)).catch(() => undefined);
          } catch (_observerError: unknown) {
            // The diagnostic remains readable even if the observer fails.
          }
        }
        // Official null handling clears identity and resumes the paused socket.
        return null;
      }
    }, (authenticated) => {
      if (authenticated || version !== this.reactiveVersion || client.closed) return;
      const attemptId = this.reactiveAttemptId;
      // Convex 1.46 drops Authenticate(None) while setConfig is paused. Its
      // false callback runs before the await-refetch continuation resumes the
      // socket. One event task lets those promise continuations finish, then
      // uses the public clearAuth API to actually deliver identity removal.
      if (this.pendingDeauthTimer !== undefined) {
        clearTimeout(this.pendingDeauthTimer);
      }
      const timer = setTimeout(() => {
        if (this.pendingDeauthTimer === timer) {
          this.pendingDeauthTimer = undefined;
        }
        if (this.isCurrentReactiveAttempt(client, version, attemptId)) {
          baseClient.clearAuth();
        }
      }, 0);
      this.pendingDeauthTimer = timer;
    });
  }

  private isCurrentReactiveAttempt(
    client: ReactiveAuthClient,
    version: number,
    attemptId: number,
  ): boolean {
    return version === this.reactiveVersion &&
      attemptId === this.reactiveAttemptId && !client.closed;
  }

  /**
   * Fresh headers for a host-approved private Convex HTTP request. Use this
   * result as the request's auth headers; do not retain old Authorization headers
   * after null/logout. The caller owns route/origin validation and byte limits.
   */
  async getAuthorizationHeaders(
    request: HostTokenRequest = { forceRefreshToken: false },
  ): Promise<Record<string, string>> {
    const token = await this.fetchToken(request);
    return token === null ? {} : { Authorization: `Bearer ${token}` };
  }

  /**
   * Attach the current credential before one HTTP operation. The official HTTP
   * client accepts a static token, so obtain it again for every invocation.
   * Serialize operations on this client to keep concurrent credentials separate.
   * No authentication failure or operation error triggers an operation retry.
   * Use a dedicated client with this helper for all of its authenticated calls.
   */
  async withHttpAuth<T>(
    client: ConvexHttpClient,
    operation: (client: ConvexHttpClient) => Promise<T>,
    request: HostTokenRequest = { forceRefreshToken: false },
  ): Promise<T> {
    const previous = this.httpOperations.get(client) ?? Promise.resolve();
    const result = previous.then(async () => {
      const token = await this.fetchToken(request);
      if (token === null) {
        client.clearAuth();
      } else {
        client.setAuth(token);
      }
      return await operation(client);
    });
    // A rejected operation must not poison the queue or replay that operation.
    const settled = result.then(() => undefined, () => undefined);
    this.httpOperations.set(client, settled);
    try {
      return await result;
    } finally {
      if (this.httpOperations.get(client) === settled) {
        this.httpOperations.delete(client);
      }
    }
  }
}
