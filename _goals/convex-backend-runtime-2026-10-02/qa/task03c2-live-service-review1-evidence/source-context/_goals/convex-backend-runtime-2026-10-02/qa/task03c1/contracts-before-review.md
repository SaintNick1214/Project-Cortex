# Task03C1 host credential transport contract

This freezes the bounded client credential foundation. It does not certify managed
JWT verification, endpoint closure or private media delivery. Task03A is frozen at
`cf579f3`; Task03B and Task03C2 remain separate gates. No host auth configuration,
HTTP routes, backend domain modules or package dependencies are changed here.

## Public constructor and credential API

```ts
import { Cortex, type HostTokenFetcher } from "@cortexmemory/sdk";

const fetchAuthToken: HostTokenFetcher = async ({ forceRefreshToken }) =>
  hostAuth.getToken({ skipCache: forceRefreshToken }); // raw host JWT or null

const cortex = new Cortex({
  convexUrl,
  fetchAuthToken,
  auth: { userId: "audit-label", tenantId: "selected-tenant" },
});

// Register with the host's actual session-change lifecycle:
// after login, logout or changing the signed-in identity
cortex.credentials?.notifySessionChanged();
```

`HostTokenRequest` is `{ forceRefreshToken: boolean }`.
`HostTokenFetcher` is `(request: HostTokenRequest) => Promise<string | null>`.
`CortexConfig.fetchAuthToken` is optional. `cortex.credentials` is absent when the
option is omitted, including when caller `auth` metadata is present.

`HostCredentials.fetchToken` has the official reactive callback signature. The
getter is validated as a function before the constructor allocates a Convex client.
Each callback obtains a new getter result, checks that it is asynchronous and checks
a raw, unpadded three-part compact JWT shape. `undefined`, a token object, a provider
key, empty/prefixed/whitespace strings and other malformed results fail with a generic
TypeError. Expected host rejections propagate unchanged. Credentials are never
logged, decoded, signed, cached or converted into memberships/capabilities.

Convex 1.46.0's `ConvexClient.setAuth` accepts an `AuthTokenFetcher` whose request
contains `forceRefreshToken`, returning `Promise<string | null | undefined>`.
Cortex intentionally narrows absence to `null`. The constructor calls
`credentials.bindReactiveClient(client)` and attaches `credentials.fetchToken`
through that official API. Normal reactive refresh requests reach the host unchanged.
The installed auth manager refreshes the active socket identity, so subscriptions
share the refreshed credential rather than a captured startup token.

`bindReactiveClient` supports one live transport. An additional different live
binding throws. A closed transport cannot be bound. `notifySessionChanged` calls
`setAuth` once and forces the first getter request to bypass the host cache; later
requests are forwarded unchanged. It throws when unbound or closed and drops the
stored closed binding when notified. It neither creates another client nor owns an
independent polling timer. Convex handles outdated credential-fetch races itself.

## Authority, logout and host responsibilities

Caller `AuthContext.userId`, `tenantId`, claims and roles remain selector/context
metadata. They never produce a credential, verified identity, trusted membership,
grant or elevated capability. Convex's host-owned issuer/audience/signature/expiry
verification and Cortex's backend exact verified issuer/subject mapping establish
authority. An HTTP token is only a credential; all protected backend paths must
still enforce current grants and scoped resource ownership.

After host logout the getter returns `null`; the host calls `notifySessionChanged`
and stops/detaches private observers and clears private presentation state. Convex's
official null flow clears socket identity, while later HTTP calls clear their static
identity before invocation. No caller metadata fallback is attempted. This local
transport notification does not revoke durable backend grants, cancel already
dispatched effects or reverse charges. Explicit grant/membership revocation or
principal/scope deletion applies Task03A's retained backend fences to background
reads, dispatches and sensitive commits. Task09 owns UI observer/cache cleanup.

## HTTP and private-fetch seams

Convex 1.46.0's `ConvexHttpClient.setAuth` accepts a static raw token and exposes
`clearAuth`. It has no automatic host getter callback. Use a dedicated HTTP client
and `credentials.withHttpAuth(client, operation, request?)` for each authenticated
invocation. The helper obtains the current token immediately before the operation,
calls `setAuth(token)` or `clearAuth()` for null, and invokes the operation once.
Concurrent operations using the same credential object/client are serialized across
auth attachment and operation completion. Use this helper for all authenticated calls
on that dedicated client; calls outside it or sharing the client among different
credential objects do not participate in its queue.

Getter rejection/invalid results cause zero HTTP authentication writes, operation
calls or wire requests. HTTP operation errors propagate unchanged. They do not
refresh and redispatch the operation, and they do not poison later explicit calls.
No silent retry is added for a mutation, paid request or external effect. An explicit
caller request can pass `{ forceRefreshToken: true }` without replaying another call.

`getAuthorizationHeaders(request?)` obtains a fresh current host token and returns
`{ Authorization: "Bearer <host JWT>" }`, or `{}` on null. These are auth headers for
one request; never merge a previous Authorization header back into a logout request.
Header creation performs no fetch, follows no redirect and returns no bytes. Task12
must bind actual private fetches to a trusted configured Convex origin/route, reject
untrusted asset URLs and redirects, and enforce independent storage authorization
and the 20,000,000-byte response cap. Never send this bearer credential to a remote
provider, raw storage bearer URL or user-supplied asset origin. Route validation and
private byte lifecycle are intentionally not inferred from a header helper.

## Browser and downstream integration

The credential leaf module has only type imports from `convex/browser`. Its bundled
browser implementation has one source input, no Node/provider/backend modules and
no injected credentials. Its browser consumer compiles with `types: []` and only
ES2022/DOM libraries. The root package exports `HostCredentials`, `HostTokenFetcher`
and `HostTokenRequest`; declaration/package export checks cover constructor wiring.
Task09 can reuse the live bound credential object for thin transports without
reintroducing model keys, token caches or a second client-owned agent loop.

Task03C2 must qualify actual signed host JWTs and identity changes against the
verified disposable service: reactive refresh/reconnect, cross-tenant subscription
denial, null/logout identity, forged/expired/missing issuer/audience/signature,
scoped tool execution and grant-revoked/deleted background outcomes. Task12/13 then
provide private byte/upload/storage-reference and authenticated callback negative
cases, trusted route binding and byte-cap outcomes. Mocked callback tests and actual
HTTP-client requests with synthetic strings are transport plumbing evidence only.
