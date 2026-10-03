import assert from "node:assert/strict";
import { ConvexClient, ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { ConvexError, type Value } from "convex/values";
import { Cortex, HostCredentials, SessionCapabilityError, createAuthContext } from "../../../../../work/backend-runtime/task03c2-live-fixture/packed-sdk/package/dist/index.js";
import type { RuntimeAuthorityReference } from "../fixture/src/auth/verified";
import { ParentChannel, type Variant } from "./parent-channel";
import { cases, type CaseName } from "./cases.mjs";
import { configureReactiveTransport } from "./reactive-transport.mjs";

// Convex's SDK-created transport uses the default console logger. Consume all
// diagnostic output here; only the allowlisted final count summary reaches stdout.
for (const method of ["log", "warn", "error", "info", "debug"]) Reflect.set(console, method, () => {});
const parent = new ParentChannel();
const bootstrap = await parent.bootstrap;
const runId = bootstrap.runId;
const target = { deploymentUrl: bootstrap.endpoint };
const issuer = "https://cortex-qualification.invalid";
const timeoutMs = bootstrap.timeoutMs;
const watchQuietMs = bootstrap.quietMs;
if (bootstrap.phase === "live") configureReactiveTransport(target.deploymentUrl);
const operator = (name: string, args: object) => parent.rpc("operator", { name, args });
type Args = Record<string, Value>;
const query = (name: string) => makeFunctionReference<"query", Args, unknown>(name);
const mutation = (name: string) => makeFunctionReference<"mutation", Args, unknown>(name);
function object(value: unknown): Record<string, unknown> {
  assert(value !== null && typeof value === "object" && !Array.isArray(value), "OBJECT_RESULT_REQUIRED");
  return value as Record<string, unknown>; // Assertion above narrows unknown result shape.
}
async function bounded<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("BOUNDED_TIMEOUT")), timeoutMs); })]); }
  finally { clearTimeout(timer); }
}
async function waitFor(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) { assert(Date.now() < deadline, "BOUNDED_OBSERVATION_TIMEOUT"); await new Promise((done) => setTimeout(done, 25)); }
}
async function jwt(subject: string, variant: Variant = "valid"): Promise<string> { return await parent.sign(subject, variant); }
function denial(error: unknown): "FORBIDDEN" | "UNAUTHENTICATED" | "INTERNAL_ONLY" | undefined {
  if (error instanceof ConvexError) {
    const data: unknown = error.data;
    if (typeof data === "object" && data !== null && "code" in data) {
      if (data.code === "FORBIDDEN" || data.code === "UNAUTHENTICATED") return data.code;
    }
  }
  // Official protocol errors are inspected in memory only; no raw message is saved.
  if (error instanceof Error) {
    if (/Could not find public function|internal function|not a public function/i.test(error.message)) return "INTERNAL_ONLY";
    if (/InvalidAuth|could not authenticate|authentication failed|no auth provider|invalid (?:JWT|token)|token (?:is |has )?expired|JWT.*expired|expired.*JWT|Unauthenticated/i.test(error.message)) return "UNAUTHENTICATED";
  }
  return undefined;
}
async function denied(promise: Promise<unknown>, expected?: string): Promise<void> {
  try { await bounded(promise); } catch (error) { const code = denial(error); assert(code && (!expected || code === expected), "EXPECTED_AUTH_DENIAL_REQUIRED"); return; }
  assert.fail("UNEXPECTED_AUTHORIZATION_SUCCESS");
}
async function operatorDenied(name: string, args: object): Promise<void> {
  try { await operator(name, args); } catch (error) { assert(error instanceof Error && error.message === "OPERATOR_AUTHORIZATION_DENIED", "OPERATOR_REJECTION_REQUIRED"); return; }
  assert.fail("UNEXPECTED_OPERATOR_SUCCESS");
}
function http(token?: string): ConvexHttpClient { const client = new ConvexHttpClient(target.deploymentUrl, { logger: false }); if (token) client.setAuth(token); return client; }
const ids = (caseId: string) => ({ tenantId: `task03c2-${runId}-${caseId}`, memorySpaceId: `space-${runId}-${caseId}` });
interface Principal { subject: string; userId: string; scope: ReturnType<typeof ids>; reference: RuntimeAuthorityReference; token: string; client: ConvexHttpClient }
const owned: Array<{ subject: string; userId: string; scope: ReturnType<typeof ids>; reference: RuntimeAuthorityReference }> = [];
class SetupUnavailable extends Error {}
async function provision(caseId: string, access: "own" | "space" = "own", capabilities: string[] = ["read", "write"], scope = ids(caseId)): Promise<Principal> {
  const subject = `subject-${runId}-${caseId}`, userId = `user-${runId}-${caseId}`;
  let raw: unknown;
  try { raw = await operator("runtimeAuth:provision", { issuer, subject, actorKind: "user", metadataUserId: userId, ...scope, capabilities, resourceAccess: access }); }
  catch (error) { if (error instanceof Error && error.message === "OPERATOR_UNAVAILABLE") throw new SetupUnavailable("operator_setup_unavailable"); throw error; }
  const result = object(raw);
  for (const field of ["principalId", "membershipId", "grantId"]) assert.equal(typeof result[field], "string", "TRUSTED_REFERENCE_REQUIRED");
  // Only the exact accepted reference fields are copied; authority is not inferred from JWT claims.
  const reference: RuntimeAuthorityReference = {
    principalId: String(result.principalId), principalVersion: Number(result.principalVersion),
    membershipId: String(result.membershipId), membershipVersion: Number(result.membershipVersion),
    grantId: String(result.grantId), grantVersion: Number(result.grantVersion), tenantId: scope.tenantId,
    tenantEpoch: Number(result.tenantEpoch), memorySpaceId: scope.memorySpaceId, memorySpaceEpoch: Number(result.memorySpaceEpoch),
  };
  owned.push({ subject, userId, scope, reference });
  const token = await jwt(subject); return { subject, userId, scope, reference, token, client: http(token) };
}
const names = cases;
type Name = CaseName;
const results = names.map((name) => ({ name, status: "BLOCKED" as "PASS" | "FAIL" | "BLOCKED", reason: "not_reached" }));
function failureReason(error: unknown): string {
  const code = denial(error); if (code) return `unexpected_${code.toLowerCase()}`;
  if (error instanceof Error) {
    const allowed = ["BOUNDED_TIMEOUT", "BOUNDED_OBSERVATION_TIMEOUT", "EXPECTED_AUTH_DENIAL_REQUIRED", "UNEXPECTED_AUTHORIZATION_SUCCESS", "OPERATOR_REJECTION_REQUIRED", "UNEXPECTED_OPERATOR_SUCCESS", "NO_POST_REVOCATION_DELIVERY", "CAPABILITY_REJECTION_REQUIRED"];
    if (allowed.includes(error.message)) return error.message.toLowerCase();
    if (error.message === "OPERATOR_UNAVAILABLE") return "operator_unavailable";
  }
  return "sanitized_assertion_or_service_failure";
}
async function test(name: Name, fn: () => Promise<void>, dependencies: Name[] = [names.indexOf(name) > names.indexOf("sdk-metadata-consumers") ? "sdk-metadata-consumers" : "valid-owned-metadata"]): Promise<boolean> {
  const result = results.find((entry) => entry.name === name)!;
  if (dependencies.some((dependency) => results.find((entry) => entry.name === dependency)?.status !== "PASS")) {
    result.reason = "dependency_blocked"; parent.send({ type: "case-block", name }); return false;
  }
  parent.send({ type: "case-start", name });
  try { await fn(); result.status = "PASS"; result.reason = "observed_assertions"; }
  catch (error) { result.status = error instanceof SetupUnavailable ? "BLOCKED" : "FAIL"; result.reason = error instanceof SetupUnavailable ? "operator_setup_unavailable" : failureReason(error); }
  parent.send({ type: "case-end", name, status: result.status, reason: result.reason });
  return result.status === "PASS";
}
const openClients: ConvexClient[] = [];
const sdkClients: Cortex[] = [];
function observe(principal: Principal, args: Args) {
  const client = new ConvexClient(target.deploymentUrl, { logger: false }); openClients.push(client);
  new HostCredentials(async () => principal.token).bindReactiveClient(client);
  const state = { successes: 0, denied: false, last: undefined as unknown };
  const stop = client.onUpdate(query("mutable:get"), args, (value) => { state.successes++; state.last = value; }, (error) => { state.denied = denial(error) !== undefined; });
  return { state, stop };
}
async function revocation(kind: "grant" | "principal" | "membership" | "space" | "tenant") {
  const principal = await provision(`revocation-${kind}`);
  const broad = await provision(`writer-${kind}`, "space", ["read", "write"], principal.scope);
  const key = { namespace: "revocation", key: kind, ...principal.scope };
  await bounded(principal.client.mutation(mutation("mutable:set"), { ...key, value: 1 }));
  const watcher = observe(principal, key);
  try {
    await waitFor(() => watcher.state.successes > 0); assert.equal(object(watcher.state.last).value, 1);
    const control = kind === "grant" ? ["runtimeAuth:revokeGrant", { grantId: principal.reference.grantId }] as const
      : kind === "principal" ? ["runtimeAuth:deletePrincipal", { principalId: principal.reference.principalId }] as const
      : kind === "membership" ? ["runtimeAuth:revokeMembership", { membershipId: principal.reference.membershipId }] as const
      : ["runtimeAuth:deleteScope", kind === "tenant" ? { tenantId: principal.scope.tenantId } : principal.scope] as const;
    await operator(control[0], control[1]); await waitFor(() => watcher.state.denied);
    await denied(principal.client.query(query("mutable:get"), key), "FORBIDDEN");
    await denied(principal.client.mutation(mutation("mutable:set"), { ...key, value: 99 }), "FORBIDDEN");
    await operatorDenied("runtimeAuth:recheck", { reference: principal.reference, requirement: { capability: "write", ...principal.scope } });
    const successes = watcher.state.successes;
    if (kind !== "space" && kind !== "tenant") {
      await bounded(broad.client.mutation(mutation("mutable:set"), { ...key, value: 2 }));
      assert.equal(object(await bounded(broad.client.query(query("mutable:get"), key))).value, 2);
    } else {
      await denied(broad.client.mutation(mutation("mutable:set"), { ...key, value: 2 }), "FORBIDDEN");
      await operatorDenied("runtimeAuth:provision", { issuer, subject: principal.subject, actorKind: "user", metadataUserId: principal.userId, ...principal.scope, capabilities: ["read", "write"], resourceAccess: "own" });
    }
    await new Promise((done) => setTimeout(done, watchQuietMs)); assert.equal(watcher.state.successes, successes, "NO_POST_REVOCATION_DELIVERY");
  } finally { watcher.stop(); }
}

async function qualifyCases() {
  if (bootstrap.phase === "offline-probe") {
    await test("operator-provisioning", async () => { await provision("probe"); assert.equal(await new HostCredentials(async () => null).fetchToken({ forceRefreshToken: false }), null); }, []);
    return;
  }
  const principals: Principal[] = [];
  const setup = await test("operator-provisioning", async () => {
    const owner = await provision("owner"); principals.push(owner);
    principals.push(await provision("other", "own", ["read", "write"], owner.scope));
    principals.push(await provision("reader", "space", ["read"], owner.scope));
    principals.push(await provision("admin", "space", ["admin"], owner.scope));
    assert.equal(owned.length, 4); assert.notEqual(principals[0].reference.principalId, principals[1].reference.principalId);
  }, []);
  if (!setup) return;
  const [owner, other, broad, admin] = principals;
  const immutableKey = { type: "fixture", id: `immutable-${runId}`, ...owner.scope };
  const mutableKey = { namespace: "fixture", key: `mutable-${runId}`, ...owner.scope };
  const sessionKey = { sessionId: `session-${runId}`, ...owner.scope };
  await test("valid-owned-metadata", async () => {
    assert.equal(object(await bounded(owner.client.mutation(mutation("immutable:store"), { ...immutableKey, data: { marker: 17 }, userId: owner.userId }))).version, 1);
    assert.equal(object(await bounded(owner.client.mutation(mutation("mutable:set"), { ...mutableKey, value: 23, userId: owner.userId }))).value, 23);
    const session = object(await bounded(owner.client.mutation(mutation("sessions:create"), { ...sessionKey, userId: owner.userId, startedAt: Date.now(), metadata: { marker: 31 } })));
    assert.equal(session.messageCount, 0); assert.equal("authorityReference" in session, false);
    assert.equal(object(await bounded(owner.client.query(query("immutable:get"), immutableKey))).version, 1);
  }, ["operator-provisioning"]);
  const payload = { ...mutableKey, value: 999 };
  for (const [name, variant] of [
    ["missing-identity", undefined], ["forged-signature", "forged"], ["wrong-issuer", "wrong-issuer"],
    ["wrong-audience", "wrong-audience"], ["expired-token", "expired"],
  ] as const) await test(name, async () => { const client = http(variant ? await jwt(owner.subject, variant) : undefined); await denied(client.query(query("mutable:get"), mutableKey)); await denied(client.mutation(mutation("mutable:set"), payload)); });
  await test("wrong-tenant", async () => { const key = { ...mutableKey, tenantId: `wrong-${runId}` }; await denied(owner.client.query(query("mutable:get"), key), "FORBIDDEN"); await denied(owner.client.mutation(mutation("mutable:set"), { ...key, value: 99 }), "FORBIDDEN"); });
  await test("wrong-space", async () => { const key = { ...mutableKey, memorySpaceId: `wrong-${runId}` }; await denied(owner.client.query(query("mutable:get"), key), "FORBIDDEN"); await denied(owner.client.mutation(mutation("mutable:set"), { ...key, value: 99 }), "FORBIDDEN"); });
  await test("owner-denied", async () => { await denied(other.client.query(query("mutable:get"), mutableKey), "FORBIDDEN"); await denied(other.client.mutation(mutation("mutable:set"), payload), "FORBIDDEN"); });
  await test("explicit-space-read", async () => { assert.equal(object(await bounded(broad.client.query(query("mutable:get"), mutableKey))).value, 23); await denied(broad.client.mutation(mutation("mutable:set"), payload), "FORBIDDEN"); });
  await test("admin-alone-read-denied", async () => { await denied(admin.client.query(query("mutable:get"), mutableKey), "FORBIDDEN"); });
  await test("admin-alone-write-denied", async () => { await denied(admin.client.mutation(mutation("mutable:set"), payload), "FORBIDDEN"); });
  await test("ambiguous-omission-denied", async () => {
    const scope = ids("second-owner-scope");
    const second = object(await operator("runtimeAuth:provision", { issuer, subject: owner.subject, actorKind: "user", metadataUserId: owner.userId, ...scope, capabilities: ["read", "write"], resourceAccess: "own" }));
    owned.push({ subject: owner.subject, userId: owner.userId, scope, reference: { ...owner.reference, ...scope, membershipId: String(second.membershipId), grantId: String(second.grantId), membershipVersion: Number(second.membershipVersion), grantVersion: Number(second.grantVersion), memorySpaceEpoch: Number(second.memorySpaceEpoch), tenantEpoch: Number(second.tenantEpoch) } });
    await denied(owner.client.query(query("mutable:get"), { namespace: mutableKey.namespace, key: mutableKey.key }), "FORBIDDEN");
    await denied(owner.client.mutation(mutation("mutable:set"), { namespace: "ambiguous", key: runId, value: 99 }), "FORBIDDEN");
    assert.equal(object(await bounded(owner.client.query(query("mutable:get"), mutableKey))).value, 23);
  });
  await test("actor-binding-denied", async () => {
    await denied(owner.client.mutation(mutation("immutable:store"), { ...immutableKey, type: "user", id: other.userId, data: { marker: 99 }, userId: other.userId }), "FORBIDDEN");
    await denied(owner.client.mutation(mutation("sessions:create"), { ...sessionKey, sessionId: `wrong-actor-${runId}`, userId: other.userId, startedAt: Date.now() }), "FORBIDDEN");
  });
  await test("caller-metadata-no-principal", async () => {
    await bounded(owner.client.mutation(mutation("immutable:store"), { ...immutableKey, type: "user", id: owner.userId, data: { subject: `unprovisioned-${runId}`, role: "admin" } }));
    await denied(http(await jwt(`unprovisioned-${runId}`)).query(query("mutable:get"), mutableKey), "FORBIDDEN");
  });
  await test("public-internal-provision-denied", async () => {
    await denied(owner.client.mutation(mutation("runtimeAuth:provision"), { issuer, subject: `forged-control-${runId}`, actorKind: "user", ...owner.scope, capabilities: ["admin"], resourceAccess: "space" }), "INTERNAL_ONLY");
    for (const [name, args] of [
      ["runtimeAuth:revokeGrant", { grantId: owner.reference.grantId }], ["runtimeAuth:revokeMembership", { membershipId: owner.reference.membershipId }],
      ["runtimeAuth:deletePrincipal", { principalId: owner.reference.principalId }], ["runtimeAuth:deleteScope", owner.scope],
      ["runtimeAuth:tombstoneResource", { ...owner.scope, resourceType: "source", resourceId: `fixture-${runId}` }],
    ] satisfies Array<[string, Args]>) await denied(owner.client.mutation(mutation(name), args), "INTERNAL_ONLY");
    await denied(owner.client.query(query("runtimeAuth:authorize"), { requirement: { capability: "admin", ...owner.scope } }), "INTERNAL_ONLY");
    await denied(owner.client.query(query("runtimeAuth:recheck"), { reference: owner.reference as unknown as Value, requirement: { capability: "write", ...owner.scope } }), "INTERNAL_ONLY");
  });
  await test("public-internal-maintenance-denied", async () => { await denied(owner.client.mutation(mutation("sessions:incrementMessageCount"), { ...sessionKey, reference: owner.reference as unknown as Value }), "INTERNAL_ONLY"); await denied(owner.client.mutation(mutation("sessions:expireIdle"), { reference: owner.reference as unknown as Value, idleTimeout: 0 }), "INTERNAL_ONLY"); });
  await test("negative-effect-counts", async () => { assert.equal(object(await bounded(owner.client.query(query("mutable:get"), mutableKey))).value, 23); assert.equal(object(await bounded(owner.client.query(query("immutable:get"), immutableKey))).version, 1); assert.equal(object(await bounded(owner.client.query(query("sessions:get"), sessionKey))).messageCount, 0); });
  for (const [name, selector] of [["reactive-wrong-tenant", { tenantId: `wrong-${runId}` }], ["reactive-wrong-space", { memorySpaceId: `wrong-${runId}` }]] as const) await test(name, async () => { const watcher = observe(owner, { ...mutableKey, ...selector }); try { await waitFor(() => watcher.state.denied); assert.equal(watcher.state.successes, 0); } finally { watcher.stop(); } });
  await test("resource-deletion-subscription", async () => {
    const watcher = observe(owner, mutableKey);
    try {
      await waitFor(() => watcher.state.successes > 0); assert.equal(object(watcher.state.last).value, 23);
      await bounded(owner.client.mutation(mutation("mutable:deleteKey"), mutableKey)); await waitFor(() => watcher.state.denied);
      const successes = watcher.state.successes;
      await denied(owner.client.mutation(mutation("mutable:set"), payload), "FORBIDDEN");
      await new Promise((done) => setTimeout(done, watchQuietMs)); assert.equal(watcher.state.successes, successes);
    } finally { watcher.stop(); }
  });
  await test("immutable-delete-read-denied", async () => { await bounded(owner.client.mutation(mutation("immutable:purge"), immutableKey)); await denied(owner.client.query(query("immutable:get"), immutableKey), "FORBIDDEN"); });
  await test("immutable-delete-write-denied", async () => { await denied(owner.client.mutation(mutation("immutable:store"), { ...immutableKey, data: { marker: 99 } }), "FORBIDDEN"); }, ["immutable-delete-read-denied"]);
  await test("mutable-delete-read-denied", async () => { await denied(owner.client.query(query("mutable:get"), mutableKey), "FORBIDDEN"); }, ["resource-deletion-subscription"]);
  await test("mutable-delete-write-denied", async () => { await denied(owner.client.mutation(mutation("mutable:set"), payload), "FORBIDDEN"); }, ["resource-deletion-subscription"]);
  for (const [name, kind] of [["grant-revocation", "grant"], ["principal-deletion", "principal"], ["membership-revocation", "membership"], ["space-deletion", "space"], ["tenant-deletion", "tenant"]] as const) await test(name, () => revocation(kind), ["operator-provisioning"]);

  const sdkSession = `sdk-session-${runId}`;
  let principal: Principal, sdk: Cortex, sdkHttp: ConvexHttpClient, sdkKey: Args;
  let currentToken: string | null = null;
  let mode: "current" | "late" | "throw" = "current";
  let lateResolve: ((value: string | null) => void) | undefined;
  let forceRefreshSeen = false;
  const callbackCodes: string[] = [];
  const sdkReady = await test("sdk-metadata-consumers", async () => {
    principal = await provision("sdk"); currentToken = principal.token;
    sdk = new Cortex({ convexUrl: target.deploymentUrl, resilience: { enabled: false }, auth: createAuthContext({ userId: principal.userId, tenantId: principal.scope.tenantId }),
    fetchAuthToken: async (request) => {
      forceRefreshSeen ||= request.forceRefreshToken;
      if (mode === "late") return await new Promise((done) => { lateResolve = done; });
      if (mode === "throw") throw new Error("PRIVATE_CALLBACK_CONTENT_MUST_NOT_ESCAPE");
      return currentToken;
    }, onAuthError: async (failure) => { callbackCodes.push(failure.code); throw new Error("PRIVATE_DIAGNOSTIC_OBSERVER_CONTENT"); },
  }); sdkClients.push(sdk);
    sdkHttp = http();
    sdkKey = { namespace: "sdk", key: runId, ...principal.scope };
  await bounded(principal.client.mutation(mutation("mutable:set"), { ...sdkKey, value: 41 }));
    const session = await bounded(sdk.sessions.create({ sessionId: sdkSession, userId: principal.userId, memorySpaceId: principal.scope.memorySpaceId }));
    assert.equal(session.sessionId, sdkSession); assert.equal("authorityReference" in session, false);
    assert.equal((await bounded(sdk.sessions.get(sdkSession)))?.sessionId, sdkSession);
    const profile = await bounded(sdk.users.update(principal.userId, { marker: 43 })); assert.equal(profile.data.marker, 43);
    assert.equal((await bounded(sdk.users.get(principal.userId)))?.data.marker, 43);
  }, ["operator-provisioning"]);
  if (!sdkReady) { for (const name of names.slice(names.indexOf("sdk-refresh"))) await test(name, async () => {}, ["sdk-metadata-consumers"]); return; }
  function watchSdk() {
    const state = { successes: 0, denied: false, values: [] as number[], invalidPayload: false };
    const stop = sdk.getClient().onUpdate(query("mutable:get"), sdkKey, (value) => {
      state.successes++;
      const marker = value !== null && typeof value === "object" && "value" in value ? value.value : undefined;
      if (typeof marker !== "number" || ![41, 42, 43].includes(marker) || state.values.length >= 64) state.invalidPayload = true;
      else state.values.push(marker);
    }, (error) => { state.denied = denial(error) === "UNAUTHENTICATED"; });
    return { state, stop };
  }
  async function fenced(name: "sdk-logout" | "late-credential-fencing", baseline: 41 | 42, updated: 42 | 43, late = false) {
    const watcher = watchSdk();
    try {
      await waitFor(() => watcher.state.successes > 0); assert.equal(watcher.state.invalidPayload, false);
      assert.equal(watcher.state.values.at(-1), baseline);
      if (late) { lateResolve = undefined; mode = "late"; sdk.credentials!.notifySessionChanged(); await waitFor(() => lateResolve !== undefined); }
      const before = watcher.state.successes;
      mode = "current"; currentToken = null; sdk.credentials!.notifySessionChanged();
      await waitFor(() => watcher.state.denied);
      if (late) lateResolve!(principal.token);
      // A separately authenticated owned writer changes the real persisted row
      // after null/logout. This gives the former observer a concrete new delivery
      // opportunity, rather than allowing a silent/never-working observer to pass.
      await bounded(principal.client.mutation(mutation("mutable:set"), { ...sdkKey, value: updated }));
      assert.equal(object(await bounded(principal.client.query(query("mutable:get"), sdkKey))).value, updated);
      await new Promise((done) => setTimeout(done, watchQuietMs));
      assert.equal(watcher.state.invalidPayload, false); assert.equal(watcher.state.successes, before, "NO_POST_REVOCATION_DELIVERY");
      await denied(sdk.getClient().query(query("mutable:get"), sdkKey), "UNAUTHENTICATED");
      parent.send({ type: "metric", name, baseline, updated, before, after: watcher.state.successes, quietMs: watchQuietMs,
        payloadFields: ["value"], observedValues: watcher.state.values });
    } finally { watcher.stop(); }
  }
  await test("sdk-refresh", async () => {
    currentToken = await jwt(principal.subject); sdk.credentials!.notifySessionChanged();
    assert.equal(object(await bounded(sdk.getClient().query(query("mutable:get"), sdkKey))).value, 41);
    assert.equal(object(await bounded(sdk.credentials!.withHttpAuth(sdkHttp, (client) => bounded(client.query(query("mutable:get"), sdkKey)), { forceRefreshToken: true }))).value, 41);
    assert.equal(forceRefreshSeen, true);
  });
  await test("sdk-logout", async () => {
    await fenced("sdk-logout", 41, 42);
    await denied(sdk.credentials!.withHttpAuth(sdkHttp, (client) => bounded(client.query(query("mutable:get"), sdkKey))), "UNAUTHENTICATED");
    assert.deepEqual(await bounded(sdk.credentials!.getAuthorizationHeaders()), {});
  }, ["sdk-metadata-consumers", "sdk-refresh"]);
  await test("sdk-labels-no-authority", async () => {
    const labels = new Cortex({ convexUrl: target.deploymentUrl, resilience: { enabled: false }, auth: createAuthContext({ userId: principal.userId, tenantId: principal.scope.tenantId, claims: { role: "admin" } }), fetchAuthToken: async () => null }); sdkClients.push(labels);
    await denied(labels.getClient().query(query("mutable:get"), sdkKey), "UNAUTHENTICATED");
  });
  await test("background-after-ordinary-logout", async () => { await operator("sessions:incrementMessageCount", { sessionId: sdkSession, reference: principal.reference }); assert.equal(object(await bounded(principal.client.query(query("sessions:get"), { sessionId: sdkSession, ...principal.scope }))).messageCount, 1); }, ["sdk-metadata-consumers", "sdk-logout"]);
  await test("late-credential-fencing", async () => {
    mode = "current"; currentToken = await jwt(principal.subject); sdk.credentials!.notifySessionChanged();
    await fenced("late-credential-fencing", 42, 43, true);
  }, ["sdk-metadata-consumers", "sdk-logout"]);
  await test("sanitized-host-callback", async () => {
    mode = "throw"; sdk.credentials!.notifySessionChanged(); await waitFor(() => callbackCodes.length > 0);
    assert.deepEqual(Object.keys(sdk.credentials!.authFailure!).sort(), ["attemptId", "code"]);
    assert(callbackCodes.every((code) => code === "HOST_TOKEN_FETCH_FAILED"));
    await denied(sdk.getClient().query(query("mutable:get"), sdkKey), "UNAUTHENTICATED");
    mode = "current"; currentToken = await jwt(principal.subject); sdk.credentials!.notifySessionChanged();
    assert.equal(object(await bounded(sdk.getClient().query(query("mutable:get"), sdkKey))).value, 43);
    assert.equal(sdk.credentials!.authFailure, undefined);
  }, ["sdk-metadata-consumers", "late-credential-fencing"]);
  await test("sdk-session-capability", async () => {
    try { await bounded(sdk.sessions.expireIdle({ idleTimeout: 0 })); assert.fail("CAPABILITY_REJECTION_REQUIRED"); }
    catch (error) { assert(error instanceof SessionCapabilityError); assert.equal(error.outcome, "not_dispatched"); assert.equal(error.code, "BACKEND_MAINTENANCE_ONLY"); }
    assert.equal(object(await bounded(principal.client.query(query("sessions:get"), { sessionId: sdkSession, ...principal.scope }))).status, "active");
  });
  await test("session-end-not-grant-revocation", async () => {
    await bounded(sdk.sessions.end(sdkSession)); assert.equal((await bounded(sdk.sessions.get(sdkSession)))?.status, "ended");
    assert.equal(object(await bounded(principal.client.query(query("mutable:get"), sdkKey))).value, 43);
    await operator("runtimeAuth:recheck", { reference: principal.reference, requirement: { capability: "write", ...principal.scope } });
  }, ["sdk-metadata-consumers", "sanitized-host-callback"]);
  await test("background-after-revocation", async () => {
    const active = `revoked-worker-${runId}`; await bounded(principal.client.mutation(mutation("sessions:create"), { sessionId: active, ...principal.scope, userId: principal.userId, startedAt: Date.now() }));
    await operator("runtimeAuth:revokeGrant", { grantId: principal.reference.grantId });
    await operatorDenied("sessions:incrementMemoryCount", { sessionId: active, reference: principal.reference });
    const auditor = await provision("sdk-auditor", "space", ["read"], principal.scope);
    assert.equal(object(await bounded(auditor.client.query(query("sessions:get"), { sessionId: active, ...principal.scope }))).memoryCount, 0);
  });
}
let finished = false;
try { await qualifyCases(); finished = true; }
finally {
  await bounded(Promise.allSettled(openClients.map((client) => bounded(client.close()))));
  await bounded(Promise.allSettled(sdkClients.map((client) => bounded(client.shutdown(2_000)))));
  if (finished) parent.send({ type: "complete" });
  if (process.connected && process.disconnect) process.disconnect();
}
