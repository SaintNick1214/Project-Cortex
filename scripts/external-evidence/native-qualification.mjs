/** Exact-package, local-only Convex qualification. Test credentials never enter receipts. */
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { execFile, execFileSync, spawn } from "node:child_process";
import fs from "node:fs/promises";
import { openSync, closeSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { pathToFileURL, fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { publishedControls, runBackendInstall, seedHost } from "./installer-controls.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sdk = path.resolve(process.argv[2] ?? ""), receiptPath = path.resolve(process.argv[3] ?? "");
if (process.argv.length !== 4 || sdk === root || !receiptPath.endsWith(".json")) throw new Error("Explicit extracted candidate SDK and receipt path required");
const pointer = "/tmp/cortex-external-native-target-path", targetPath = (await fs.readFile(pointer, "utf8")).trim();
const target = JSON.parse(await fs.readFile(targetPath, "utf8"));
assert.equal(target.url, "http://127.0.0.1:3486"); assert.equal(target.site, "http://127.0.0.1:3487");
assert.equal(target.fresh, true); assert.equal(target.production, false);
assert.ok(target.state.startsWith(tmpdir()) && path.basename(target.state).startsWith("cortex-external-native-"));
assert.ok(target.binary.endsWith("/convex-local-backend"));
const manifest = JSON.parse(await fs.readFile(path.join(sdk, "package.json"), "utf8"));
assert.equal(manifest.version, "0.40.0-external-evidence.0");
const { CortexRuntimeClient } = await import(pathToFileURL(path.join(sdk, "dist/client-runtime/index.js")));
const environment = { ...process.env, CONVEX_BEACON_DISABLED: "true" };
for (const name of Object.keys(environment)) if (/^(?:CONVEX|CORTEX|OPENAI|ANTHROPIC|GOOGLE|GEMINI|NEO4J|MEMGRAPH)_/.test(name)) delete environment[name];
environment.CONVEX_BEACON_DISABLED = "true";
const redact = text => String(text).replaceAll(target.key, "[private]").replaceAll(target.secret, "[private]");
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const digest = text => createHash("sha256").update(text).digest("hex");
const results = [], record = (name, extra = {}) => { results.push({ name, status: "PASS", ...extra }); console.log("PASS " + name); };
let backendPid = Number(await fs.readFile(path.join(target.state, "qualification.pid"), "utf8").catch(() => "88837")), restartArgs, stage, controls, succeeded = false, receipt;
const clients = [];

function ownedCommand(pid) {
  const command = execFileSync("ps", ["-p", String(pid), "-o", "args="], { encoding: "utf8" }).trim();
  const args = command.split(/\s+/);
  assert.equal(args[0], target.binary); assert.ok(args.includes(path.join(target.state, "db.sqlite3")));
  assert.ok(args.includes(path.join(target.state, "storage"))); assert.ok(args.includes(target.secret));
  assert.equal(args[args.indexOf("--port") + 1], "3486");
  return args.slice(1);
}
async function stopOwned() {
  ownedCommand(backendPid); process.kill(backendPid, "SIGTERM");
  for (let attempt = 0; attempt < 100; attempt++) {
    try { process.kill(backendPid, 0); } catch (error) { if (error.code === "ESRCH") return; throw error; }
    await pause(100);
  }
  throw new Error("Owned backend did not terminate gracefully");
}
async function restartOwned() {
  await stopOwned();
  const log = openSync(path.join(target.state, "qualification-backend.log"), "a", 0o600);
  try { const child = spawn(target.binary, restartArgs, { cwd: target.state, env: environment, detached: true, stdio: ["ignore", log, log] }); backendPid = child.pid; child.unref(); }
  finally { closeSync(log); }
  await fs.writeFile(path.join(target.state, "qualification.pid"), String(backendPid), { mode: 0o600 });
  for (let attempt = 0; attempt < 100; attempt++) {
    try { const response = await fetch(target.url + "/version"); if (response.ok) { ownedCommand(backendPid); return; } } catch { /* Wait for this owned service only. */ }
    await pause(100);
  }
  throw new Error("Restarted owned backend did not become ready");
}
function http(identity) {
  const client = new ConvexHttpClient(target.url); client.setDebug(false); client.setAdminAuth(target.key, identity); return client;
}
const admin = http();
const internal = (name, args) => admin.function(name, undefined, args);
function runtime(identity, scope) {
  const connection = http(identity);
  // Only authentication notification is controlled. Every RPC uses actual native HTTP
  // and actual server-side impersonation/grant checks; no JWT verification is claimed.
  const port = { setAuth: (_fetchToken, changed) => queueMicrotask(() => changed(true)),
    query: (...args) => connection.query(...args), mutation: (...args) => connection.mutation(...args), action: (...args) => connection.action(...args),
    onUpdate: () => { throw new Error("Observers are outside this replay probe"); }, close: async () => {} };
  const client = new CortexRuntimeClient({ deploymentUrl: target.url, scope, fetchToken: async () => "controlled-not-a-jwt", client: port });
  clients.push(client); return { client, connection };
}
async function denied(action, codes) {
  try { await action(); assert.fail("Expected denial: " + codes.join("/")); }
  catch (error) {
    const code = error.code ?? error.data?.code;
    assert.ok(codes.includes(code), "Expected " + codes.join("/") + "; got " + String(code) + (code === undefined ? "; " + redact(error.message) : "")); return code;
  }
}
async function pages(client, input = {}) {
  const events = []; let after = input.after, watermark;
  for (let page = 0; page < 50; page++) {
    const current = await client.changes.list({ ...input, ...(after ? { after } : {}), limit: 1 });
    watermark ??= current.watermark; assert.equal(current.watermark, watermark); events.push(...current.events); after = current.nextCursor;
    if (!current.hasMore) { assert.equal(current.completeThroughWatermark, true); return { events, nextCursor: after, watermark }; }
  }
  throw new Error("Native feed pagination exceeded fixture bound");
}
async function capture(client, source, requestId = randomUUID()) {
  const batch = await client.sources.ingest({ requestId, sources: [source] }); assert.equal(batch.results.length, 1);
  assert.equal(batch.results[0].status, "accepted"); return batch.results[0].result;
}
async function purge(scope, sourceId) {
  await internal("runtimeExternalErasure:eraseSource", { ...scope, sourceId });
  for (let attempt = 0; attempt < 256; attempt++) {
    const result = await internal("runtimeExternalErasure:continueSource", { ...scope, sourceId }); if (result.complete) return attempt + 1;
    if (attempt % 16 === 0) await pause(20);
  }
  throw new Error("Native erasure did not complete within bounded continuation probe");
}

try {
  restartArgs = ownedCommand(backendPid);
  stage = await fs.realpath(await fs.mkdtemp(path.join(tmpdir(), "cortex-external-native-host-")));
  controls = await publishedControls(root); await seedHost(stage);
  const install = runBackendInstall(controls.cli.directory, stage, sdk); assert.equal(install.code, 0, install.diagnostic);
  await fs.symlink(await fs.realpath(path.join(root, "node_modules")), path.join(stage, "node_modules"), "dir");
  await fs.writeFile(path.join(stage, "package.json"), JSON.stringify({ name: "cortex-external-native-owned-host", private: true, type: "module", dependencies: { ...manifest.peerDependencies, ...manifest.dependencies } }));
  await fs.writeFile(path.join(stage, "backend/externalEvidenceFixture.ts"), (await fs.readFile(path.join(root, "tests/fixtures/native/externalEvidenceFixture.ts"), "utf8")).replaceAll("../../../convex-dev/", "./"));
  const envFile = path.join(stage, ".env.external-native");
  await fs.writeFile(envFile, `CONVEX_SELF_HOSTED_URL=${target.url}\nCONVEX_SELF_HOSTED_ADMIN_KEY=${target.key}\n`, { mode: 0o600 });
  try {
    const deployed = await promisify(execFile)(process.execPath, [path.join(root, "node_modules/convex/bin/main.js"), "dev", "--once", "--typecheck", "enable", "--codegen", "enable", "--tail-logs", "disable", "--env-file", envFile], { cwd: stage, env: environment, timeout: 600000, maxBuffer: 8 * 1024 * 1024 });
    await fs.writeFile(receiptPath.replace(/\.json$/, ".deploy.log"), redact(deployed.stdout + deployed.stderr));
  } catch (error) {
    // Native CLI failures can carry credential-bearing diagnostics. Retain only sanitized text.
    // eslint-disable-next-line preserve-caught-error -- Never attach the unredacted subprocess error.
    throw new Error(redact(String(error.stdout ?? "") + String(error.stderr ?? error.message)));
  }
  record("exact-package additive host install, official codegen/typecheck and local-only deploy");
  assert.equal(await new ConvexHttpClient(target.url).query("huntFunctions:list", {}), "host-owned");
  assert.equal(await (await fetch(target.site + "/hunt/ping")).text(), "host-owned"); record("host function and HTTP route survive actual deployment");
  const scope = { tenantId: "external-native-" + randomUUID() }; scope.memorySpaceId = scope.tenantId + "/evidence";
  const otherScope = { tenantId: "external-native-" + randomUUID() }; otherScope.memorySpaceId = otherScope.tenantId + "/evidence";
  const issuer = "https://native-fixture.invalid", identityA = { issuer, subject: randomUUID() }, identityB = { issuer, subject: randomUUID() }, identityC = { issuer, subject: randomUUID() };
  const provision = (identity, selected = scope, access = "own") => internal("runtimeAuth:provision", { ...selected, ...identity, actorKind: "service", capabilities: ["read", "write"], resourceAccess: access });
  const authorityA = await provision(identityA), authorityB = await provision(identityB); await provision(identityC, otherScope);
  let { client: a, connection: aHttp } = runtime(identityA, scope); const { client: b } = runtime(identityB, scope), { client: c } = runtime(identityC, otherScope);
  await denied(() => new ConvexHttpClient(target.url).mutation("runtimeExternalSources:capabilities", scope), ["UNAUTHENTICATED"]);
  const capabilities = await a.capabilities(); assert.equal(capabilities.externalSources.version, 1); assert.equal(capabilities.changes.durable, true); assert.equal(capabilities.largeAssets.resumableUpload, false); assert.equal(capabilities.largeAssets.rangeRetrieval, false);
  record("real server grants and authenticated capabilities; anonymous refusal; P2 false");
  const archive = JSON.parse(await fs.readFile(path.join(root, "tests/fixtures/external-evidence/archive.json"), "utf8"));
  const originals = [];
  for (const entry of archive.records) {
    const result = await capture(a, entry.input); originals.push(result);
    const retrieved = await a.sources.get({ sourceId: result.receipt.reference.sourceId, versionId: result.receipt.reference.versionId });
    assert.equal(retrieved.originalText, entry.input.originalText); assert.equal(digest(retrieved.originalText), entry.originalContentHash);
    assert.deepEqual(retrieved.author, entry.input.author); assert.equal(retrieved.authoredAt, entry.input.authoredAt);
    assert.equal(result.readiness.facts, "skipped");
  }
  record("four real archive messages retain exact originals, hashes, authors and times", { messages: 4, originalBodyBytes: 689 });
  const duplicate = await Promise.all([capture(a, archive.records[0].input, "concurrent-replay-a"), capture(a, archive.records[0].input, "concurrent-replay-b")]);
  duplicate.forEach(value => assert.deepEqual(value.receipt, originals[0].receipt));
  const conflict = await a.sources.ingest({ requestId: "conflict", sources: [{ ...archive.records[0].input, originalText: "SYNTHETIC CONFLICT" }] });
  assert.equal(conflict.results[0].status, "rejected"); assert.equal(conflict.results[0].code, "IDEMPOTENCY_CONFLICT");
  const base = { ...archive.records[0].input, externalSourceId: "synthetic-revision-order", externalEventId: "synthetic-revision-3", externalRevision: 3,
    originalText: "SYNTHETIC latest revision — café\r\nExact punctuation!", metadata: { synthetic: true } };
  const latest = await capture(a, base), older = await capture(a, { ...base, externalRevision: 1, externalEventId: "synthetic-revision-1", originalText: "SYNTHETIC original revision" });
  assert.equal(older.receipt.outcome, "historical");
  assert.equal((await a.sources.get({ sourceId: latest.receipt.reference.sourceId })).originalText, base.originalText);
  assert.equal((await a.sources.get({ sourceId: older.receipt.reference.sourceId, versionId: older.receipt.reference.versionId })).originalText, "SYNTHETIC original revision");
  const beforeNoop = await pages(a), noop = await capture(a, { ...base, externalRevision: 4, externalEventId: "synthetic-unchanged-4", observedAt: base.observedAt + 1 });
  assert.equal(noop.receipt.outcome, "unchanged"); assert.equal(noop.readiness.ingestionEventId, latest.readiness.ingestionEventId);
  const noSemantic = await pages(a, { after: beforeNoop.nextCursor }); assert.ok(noSemantic.events.every(event => !event.type.startsWith("source.revised")));
  const revised = await capture(a, { ...base, externalRevision: 5, externalEventId: "synthetic-edit-5", editedAt: base.observedAt + 2, originalText: "SYNTHETIC delayed correction" });
  assert.equal(revised.receipt.outcome, "revised");
  const history = []; let historyCursor;
  do { const page = await a.sources.history({ sourceId: latest.receipt.reference.sourceId, limit: 1, ...(historyCursor ? { after: historyCursor } : {}) }); history.push(...page.items); historyCursor = page.nextCursor; } while (historyCursor);
  assert.deepEqual(history.map(item => item.externalEventId), ["synthetic-revision-3", "synthetic-revision-1", "synthetic-unchanged-4", "synthetic-edit-5"]);
  record("concurrent duplicate receipts, explicit conflict, out-of-order versions, unchanged observations and synthetic edit");
  const literal = "— café\r\nExact punctuation!"; let searchAfter, searchWatermark; const matches = [];
  do { const page = await a.sources.search({ literal, includeHistory: true, limit: 1, ...(searchAfter ? { after: searchAfter } : {}) }); searchWatermark ??= page.watermark; assert.equal(page.watermark, searchWatermark); matches.push(...page.items); searchAfter = page.nextCursor; if (!page.hasMore) assert.equal(page.completeThroughWatermark, true); } while (searchAfter);
  assert.equal(matches.length, 2); assert.ok(matches.every(item => item.originalText === base.originalText));
  record("literal Unicode/newline original-text search with fixed complete watermark");
  await denied(() => b.sources.get({ sourceId: originals[0].receipt.reference.sourceId }), ["FORBIDDEN"]);
  await denied(() => c.sources.get({ sourceId: originals[0].receipt.reference.sourceId }), ["FORBIDDEN"]);
  await denied(() => aHttp.mutation("runtimeExternalSources:get", { ...otherScope, sourceId: originals[0].receipt.reference.sourceId }), ["FORBIDDEN"]);
  const ownEmpty = await pages(b); await capture(a, { ...base, externalSourceId: "owner-a-hidden", externalEventId: "owner-a-hidden", externalRevision: 1 });
  assert.deepEqual(await pages(b, { after: ownEmpty.nextCursor }), ownEmpty);
  const bCheckpoint = await b.changes.list();
  await internal("runtimeAuth:revokeGrant", { grantId: authorityB.grantId });
  await denied(() => b.changes.list({ after: bCheckpoint.nextCursor }), ["FORBIDDEN"]);
  record("cross-owner/tenant read denial, own progress noninterference, current replay revocation");
  const stateBefore = await internal("externalEvidenceFixture:inspect", scope), feedBefore = await pages(a);
  const rollbackInput = { ...base, externalSourceId: "synthetic-rollback", externalEventId: "synthetic-rollback", externalRevision: 1 };
  await denied(() => http(identityA).function("externalEvidenceFixture:ingestThenRollback", undefined, { ...scope, requestId: "rollback", input: rollbackInput }), ["FIXTURE_ROLLBACK"]);
  const stateAfter = await internal("externalEvidenceFixture:inspect", scope);
  assert.equal(stateAfter.runtimeExternalSources.length, stateBefore.runtimeExternalSources.length);
  assert.equal(stateAfter.runtimeExternalVersions.length, stateBefore.runtimeExternalVersions.length);
  assert.equal(stateAfter.runtimeExternalObservations.length, stateBefore.runtimeExternalObservations.length);
  assert.deepEqual((await pages(a, { after: feedBefore.nextCursor })).events.filter(event => event.type === "source.created"), []);
  const conversation = await http(identityA).function("externalEvidenceFixture:createConversation", undefined, { ...scope, id: "native-component-probe" });
  const componentRead = () => http(identityA).function("externalEvidenceFixture:componentMessages", undefined, { ...scope, ...conversation });
  assert.equal((await componentRead()).page.length, 0);
  await denied(() => http(identityA).function("externalEvidenceFixture:ingestComponentThenRollback", undefined, { ...scope, ...conversation, requestId: "nested-rollback", input: rollbackInput }), ["FIXTURE_ROLLBACK"]);
  assert.equal((await componentRead()).page.length, 0);
  const nestedAfter = await internal("externalEvidenceFixture:inspect", scope);
  assert.equal(nestedAfter.runtimeExternalSources.length, stateBefore.runtimeExternalSources.length); assert.equal(nestedAfter.runtimeTranscriptMessages.length, 0);
  record("genuine Convex source/event rollback and nested component/parent transaction rollback");
  const pairInputs = [0, 1].map(n => ({ ...base, externalSourceId: "same-time-" + n, externalEventId: "same-time-" + n, externalRevision: 1 }));
  const pair = await http(identityA).function("externalEvidenceFixture:ingestPair", undefined, { ...scope, requestId: "same-time", inputs: pairInputs });
  const sameTime = (await pages(a)).events.filter(event => pair.some(result => result.receipt.reference.sourceId === event.source.sourceId) && event.type === "source.created");
  assert.equal(sameTime.length, 2); assert.equal(sameTime[0].occurredAt, sameTime[1].occurredAt); assert.notEqual(sameTime[0].eventId, sameTime[1].eventId);
  record("two actual same-timestamp source events replay across single-event pages");
  const first = await a.changes.list({ limit: 1 }), expectedSecond = await a.changes.list({ after: first.nextCursor, limit: 1 }); assert.equal(first.hasMore, true);
  await fs.writeFile(path.join(stage, "saved-consumer.json"), JSON.stringify({ after: first.nextCursor, watermark: first.watermark }));
  await a.close(); await restartOwned();
  ({ client: a, connection: aHttp } = runtime(identityA, scope));
  const restored = JSON.parse(await fs.readFile(path.join(stage, "saved-consumer.json"), "utf8"));
  const second = await a.changes.list({ after: restored.after, limit: 1 }); assert.deepEqual(second, expectedSecond); assert.equal(second.watermark, restored.watermark);
  const rest = await pages(a, { after: second.nextCursor }); assert.equal(rest.watermark, first.watermark);
  assert.equal(new Set([...first.events, ...second.events, ...rest.events].map(event => event.eventId)).size, 2 + rest.events.length);
  await capture(a, { ...base, externalSourceId: "after-backend-restart", externalEventId: "after-backend-restart", externalRevision: 1 });
  const caught = await pages(a, { after: rest.nextCursor }); assert.ok(caught.events.some(event => event.type === "source.created")); assert.notEqual(caught.watermark, rest.watermark);
  record("incomplete cursor replay survives consumer and actual backend restart on same SQLite/secret", { backendRestart: true });
  const failingReceipt = originals[1].receipt; let failingStatus;
  for (let attempt = 0; attempt < 100; attempt++) { failingStatus = await a.sources.status(failingReceipt.receiptId); if (["failed", "dead_letter", "unknown"].includes(failingStatus.readiness.vectors)) break; await pause(100); }
  assert.equal(failingStatus.readiness.vectors, "failed"); assert.equal(failingStatus.readiness.failureCode, "INDEXING_ADMISSION_FAILED");
  const ingestionEventId = failingStatus.readiness.ingestionEventId, previousAttempt = failingStatus.readiness.attempt;
  assert.deepEqual(await aHttp.mutation("runtimeIngestion:retry", { ...scope, eventId: ingestionEventId, stage: "vectors" }), { queued: true });
  for (let attempt = 0; attempt < 100; attempt++) { failingStatus = await a.sources.status(failingReceipt.receiptId); if (failingStatus.readiness.attempt > previousAttempt && failingStatus.readiness.vectors === "failed") break; await pause(100); }
  assert.equal(failingStatus.readiness.vectors, "failed"); assert.equal(failingStatus.readiness.attempt, previousAttempt + 1);
  const failures = (await pages(a)).events.filter(event => event.type === "source.index.failed" && event.source.sourceId === failingReceipt.reference.sourceId);
  assert.deepEqual(failures.map(event => event.attempt), [1, 2]); assert.equal(new Set(failures.map(event => event.eventId)).size, 2);
  assert.equal((await a.sources.get({ sourceId: failingReceipt.reference.sourceId })).originalText, archive.records[1].input.originalText);
  record("actual background worker admission failure and guarded retry publish distinct durable attempts", { providerDispatches: 0, failureCode: failingStatus.readiness.failureCode });
  const deleted = await a.sources.tombstone({ sourceId: latest.receipt.reference.sourceId, requestId: "synthetic-delete", externalEventId: "synthetic-delete-6", externalRevision: 6, observedAt: base.observedAt + 3, provenance: {} });
  assert.equal(deleted.receipt.outcome, "tombstoned");
  assert.equal((await a.sources.get({ sourceId: latest.receipt.reference.sourceId, versionId: latest.receipt.reference.versionId })).tombstoned, true);
  const refusedResurrection = await a.sources.ingest({ requestId: "restore", sources: [{ ...base, externalEventId: "synthetic-restore-7", externalRevision: 7 }] });
  assert.equal(refusedResurrection.results[0].code, "SOURCE_TOMBSTONED");
  assert.ok((await pages(a)).events.some(event => event.type === "source.tombstoned" && event.source.sourceId === latest.receipt.reference.sourceId));
  record("explicit tombstone retains immutable history and refuses ordinary resurrection");
  const erasing = originals[0].receipt.reference.sourceId;
  assert.deepEqual(await http(identityA).function("externalEvidenceFixture:appendDerived", undefined, { ...scope, ...conversation, sourceId: erasing }), { messageCount: 2 });
  assert.equal((await componentRead()).page.length, 2);
  const beforeErase = await a.changes.list(), historyBeforeErase = await a.sources.history({ sourceId: erasing, limit: 1 });
  const continuations = await purge(scope, erasing);
  await denied(() => a.sources.get({ sourceId: erasing, versionId: originals[0].receipt.reference.versionId }), ["FORBIDDEN"]);
  await denied(() => a.sources.status(originals[0].receipt.receiptId), ["FORBIDDEN"]);
  await denied(() => a.sources.history({ sourceId: erasing, ...(historyBeforeErase.nextCursor ? { after: historyBeforeErase.nextCursor } : {}) }), ["FORBIDDEN", "CURSOR_EXPIRED"]);
  await denied(() => a.changes.list({ after: beforeErase.nextCursor }), ["CURSOR_EXPIRED"]);
  const erasedReplay = await a.sources.ingest({ requestId: "erased-replay", sources: [{ ...archive.records[0].input, externalEventId: "new-after-erasure" }] }); assert.equal(erasedReplay.results[0].code, "FORBIDDEN");
  const persisted = await internal("externalEvidenceFixture:inspect", scope), serialized = JSON.stringify(persisted);
  assert.ok(!serialized.includes(archive.records[0].input.originalText)); assert.ok(!serialized.includes("PRIVATE-COMPONENT-ROLLBACK"));
  assert.equal(persisted.runtimeExternalVersions.filter(row => row.sourceId === erasing).length, 0); assert.equal(persisted.runtimeExternalObservations.filter(row => row.sourceId === erasing).length, 0);
  const remainingMessages = (await componentRead()).page; assert.equal(remainingMessages.length, 1); assert.equal(remainingMessages[0].message.role, "user");
  assert.equal(remainingMessages[0].message.content, "Authored fixture message survives source erasure.");
  assert.equal(persisted.facts.length, 0); assert.equal(persisted.runtimeMemoryVectors.length, 0);
  record("bounded physical erasure removes originals and registered native derived copy; authored message survives", { continuations });
  // A separate principal owns the first source under its own identity; explicit
  // space grants permit reading it, and the next revocation blocks replay.
  const renewedB = await provision(identityB, scope, "space"), shared = runtime(identityB, scope);
  assert.equal((await shared.client.sources.get({ sourceId: originals[1].receipt.reference.sourceId })).originalText, archive.records[1].input.originalText);
  const sharedCursor = await shared.client.changes.list(); await internal("runtimeAuth:revokeGrant", { grantId: renewedB.grantId });
  await denied(() => shared.client.changes.list({ after: sharedCursor.nextCursor }), ["FORBIDDEN"]);
  record("explicit current space grant permits cross-owner read; revocation denies saved replay");
  assert.equal(authorityA.principalId, originals[0].receipt.principalId);
  succeeded = true;
  receipt = { version: 1, coverage: "actual-local-convex-http-with-admin-identity", sdkVersion: manifest.version,
    target: { url: target.url, fresh: true, production: false }, results,
    testedFileHashes: { "dist/backend/v1/manifest.json": digest(await fs.readFile(path.join(sdk, "dist/backend/v1/manifest.json"))),
      "dist/client-runtime/index.js": digest(await fs.readFile(path.join(sdk, "dist/client-runtime/index.js"))),
      privateNativeFixture: digest(await fs.readFile(path.join(root, "tests/fixtures/native/externalEvidenceFixture.ts"))) },
    actualBackendRestart: true, jwtVerification: "not-exercised-admin-impersonation", providerSuccess: "not-exercised-no-credentials-or-policy", managedAnn: "not-exercised", graph: "not-selected-no-graph-behavior-change",
    controlledDerivedCopy: "actual-registration-and-component-cleanup-no-model-output", arbitraryExperimentalNativeRowMigration: "not-certified-operator-reconciliation-required",
    cleanup: "owned-backend-stopped-state-and-test-key-removed" };
} catch (error) {
  console.error(redact(error.stack ?? error)); process.exitCode = 1;
} finally {
  for (const client of clients) await client.close().catch(() => {});
  if (succeeded) {
    await stopOwned(); await fs.rm(target.state, { recursive: true, force: true }); await fs.rm(targetPath, { force: true });
    if ((await fs.readFile(pointer, "utf8")).trim() === targetPath) await fs.rm(pointer);
    await fs.writeFile(receiptPath, JSON.stringify(receipt, null, 2) + "\n", { flag: "wx" });
  }
  if (stage) await fs.rm(stage, { recursive: true, force: true }); if (controls) await controls.cleanup();
}
