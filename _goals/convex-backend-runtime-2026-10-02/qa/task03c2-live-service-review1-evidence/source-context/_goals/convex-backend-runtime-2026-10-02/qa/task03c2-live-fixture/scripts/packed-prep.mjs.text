import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Cortex, HostCredentials, SessionsAPI, SessionCapabilityError, createAuthContext } from "../../../../../work/backend-runtime/task03c2-live-fixture/packed-sdk/package/dist/index.js";
import { localPreflight, writeEvidence } from "./guard.mjs";
localPreflight();
for (const value of [Cortex, HostCredentials, SessionsAPI, SessionCapabilityError, createAuthContext]) assert.equal(typeof value, "function");
let dispatches = 0, callbacks = 0;
// Explicit offline pre-dispatch probe. No live outcome uses this fake transport.
const transport = new Proxy({}, { get() { dispatches++; throw new Error("TRANSPORT_MUST_NOT_BE_TOUCHED"); } });
const sessions = new SessionsAPI(transport, undefined, undefined, createAuthContext({ userId: "offline-user", tenantId: "offline-tenant" }));
for (const options of [undefined, { idleTimeout: 0 }, { idleTimeout: 123, tenantId: "offline-tenant" }]) {
  await assert.rejects(sessions.expireIdle(options), (error) => { assert(error instanceof SessionCapabilityError); assert.equal(error.code, "BACKEND_MAINTENANCE_ONLY"); assert.equal(error.outcome, "not_dispatched"); assert.equal(error.retryable, false); return true; });
}
await assert.rejects(sessions.expireIdle({ tenantId: "wrong-tenant" })); assert.equal(dispatches, 0);
await assert.rejects(new HostCredentials(async () => "not-a-JWT").withHttpAuth({}, async () => { callbacks++; return 0; })); assert.equal(callbacks, 0);
assert.deepEqual(await new HostCredentials(async () => null).getAuthorizationHeaders(), {});
writeEvidence(`packed-prep-${randomUUID()}.json`, { evidenceKind: "offline actual packed SDK; fake transport only for zero pre-dispatch assertion", discovered: 6, passed: 6, skipped: 0, workerDispatches: dispatches, invalidCredentialOperationCallbacks: callbacks, networkCalls: 0, signedTokens: 0 }, false);
process.stdout.write(JSON.stringify({ discovered: 6, passed: 6, skipped: 0, workerDispatches: dispatches, invalidCredentialOperationCallbacks: callbacks }) + "\n");
