import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { ConvexClient, ConvexHttpClient } from "convex/browser";
import { HostCredentials } from "../../../../../work/backend-runtime/task03c2-live-fixture/packed-sdk/package/dist/index.js";
import { SessionsAPI, SessionCapabilityError } from "../../../../../work/backend-runtime/task03c2-live-fixture/sdk/src/sessions/index";
import { createAuthContext } from "../../../../../work/backend-runtime/task03c2-live-fixture/sdk/src/auth/context";
import { localPreflight, writeEvidence } from "./guard.mjs";
localPreflight();
const startedAt = new Date().toISOString();
let dispatches = 0, callbacks = 0;
// Deliberately fake transport ONLY for this offline pre-dispatch assertion.
const client = new Proxy({} as ConvexClient, { get() { dispatches++; throw new Error("TRANSPORT_MUST_NOT_BE_TOUCHED"); } });
const sessions = new SessionsAPI(client, undefined, undefined, createAuthContext({ userId: "offline-user", tenantId: "offline-tenant" }));
for (const options of [undefined, { idleTimeout: 0 }, { idleTimeout: 123, tenantId: "offline-tenant" }]) {
  await assert.rejects(sessions.expireIdle(options), (error: unknown) => {
    assert(error instanceof SessionCapabilityError); assert.equal(error.code, "BACKEND_MAINTENANCE_ONLY");
    assert.equal(error.outcome, "not_dispatched"); assert.equal(error.retryable, false); return true;
  });
}
assert.equal(dispatches, 0);
await assert.rejects(sessions.expireIdle({ tenantId: "wrong-tenant" })); assert.equal(dispatches, 0);
const bad = new HostCredentials(async () => "not-a-JWT");
await assert.rejects(bad.withHttpAuth({} as ConvexHttpClient, async () => { callbacks++; return 0; }));
assert.equal(callbacks, 0);
const loggedOut = new HostCredentials(async () => null); assert.deepEqual(await loggedOut.getAuthorizationHeaders(), {});
writeEvidence(`client-prep-${randomUUID()}.json`, { startedAt, completedAt: new Date().toISOString(), discovery: 6, passed: 6, skipped: 0, workerDispatches: dispatches, invalidCredentialOperationCallbacks: callbacks, evidenceKind: "offline actual accepted SDK code with fake transport" }, false);
process.stdout.write(JSON.stringify({ passed: 6, workerDispatches: dispatches, invalidCredentialOperationCallbacks: callbacks }) + "\n");
