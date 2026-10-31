/** Offline regressions. Synthetic fixtures never count as native qualification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { CANDIDATE, HERE, ENGINE, PRIVATE_RUN_ROOT, contracts, verifyInputs, prospectiveDescriptorCoverage, prospectiveV1,
  evaluateV1, evaluateV1Ledger, runRenewal } from './renewal.mjs';

const requireCandidate = createRequire(path.join(CANDIDATE, 'package.json'));
const syntheticReview = 'a'.repeat(64);
const fixture = () => {
  const { domain, tools } = contracts(), now = Date.now();
  return { checkedAt: now - 100, completedAt: now - 1, modelId: 'openai/gpt-4o-mini',
    registryVersion: 'cortex-memory-tools-v1', boundRevision: 'agent-tools-32768-512-v1', replay: false,
    readerDone: true, readerLockReleased: true, error: null, completionError: null,
    terminalReceipts: [{ capturedAt: now - 2, receipt: { modelId: 'openai/gpt-4o-mini', actualModel: 'openai/gpt-4o-mini',
      nativeInterface: 'chat', outcome: 'confirmed', proof: 'provider-terminal-v1', costSource: 'unavailable',
      usage: { inputTokens: 100, outputTokens: 20 } } }],
    admissions: [{ status: 'reserved', registryVersion: 'cortex-memory-tools-v1', boundRevision: 'agent-tools-32768-512-v1',
      reservationUnits: 100000, outputTokens: 512, inputTokens: 10000, requestHash: 'b'.repeat(64),
      toolsCanonical: domain.canonicalModelJson(tools.AGENT_NATIVE_TOOLS.map(tool => ({ name: tool.name,
        definition: { description: tool.description, inputSchema: tool.inputSchema } }))) }],
    parts: [{ type: 'tool-call', toolName: 'memory_recall', input: '{"text":"jasmine tea","limit":1}' }, { type: 'finish' }],
  };
};
const ledger = () => {
  const before = { attempts: Array.from({ length: 8 }, (_, index) => ({ _id: 'attempt-' + index, ordinal: 0, state: 'uncertain',
    operationDocumentId: 'operation-' + index, dispatchIdentity: String(index).repeat(64), reservationUnits: index === 7 ? 2000000 : 100000,
    slotReleased: true })), operations: Array.from({ length: 8 }, (_, index) => ({ _id: 'operation-' + index })),
    accounts: [{ _id: 'old-account', uncertainUnits: 2700000, root: { revision: 1 } }] };
  const after = structuredClone(before);
  after.attempts.push({ _id: 'v1-attempt', ordinal: 0, state: 'uncertain', operationDocumentId: 'v1-operation',
    dispatchIdentity: 'f'.repeat(64), reservationUnits: 100000, slotReleased: true });
  after.operations.push({ _id: 'v1-operation' });
  for (const kind of ['run', 'tenant']) after.accounts.push({ _id: 'v1-' + kind, kind,
    limitUnits: kind === 'run' ? 2000000 : 10000000, uncertainUnits: 100000, activeConcurrency: 0, reservedUnits: 0, settledUnits: 0 });
  return { before, after };
};

test('offline material source fingerprints preserve original roots, V1 bytes, ceilings and secondary selectors', async () => {
  const inputs = await verifyInputs();
  assert.equal(inputs.finiteSources.length, 18); assert.equal(inputs.native.length, 19);
  assert.equal(inputs.totalMaximumPaidRequests, 9); assert.equal(inputs.totalMaximumUnknownLiabilityUnits, 2800000);
  assert.deepEqual(inputs.historicalRoots.map(row => row.revision), [3, 5, 9, 14, 15, 16, 17, 18]);
  assert.equal(inputs.supplemental.qualification.limits.runBudgetUnits, 2000000);
  assert.ok(inputs.baselineDispatchEvidence.some(row => row.boundRevision === 'agent-tools-32768-512-v1'));
  assert.ok(inputs.baselinePolicies.every(row => !row.rules.limits || row.rules.limits.runBudgetUnits <= 3000000));
  assert.ok(!PRIVATE_RUN_ROOT.startsWith(CANDIDATE + path.sep));
  const coverage = await prospectiveDescriptorCoverage(inputs);
  assert.equal(coverage.descriptorRows.length, 10); assert.equal(coverage.noQualifiedJsonObjectDescriptorInV16, true);
  assert.ok(coverage.descriptorRows.every(row => row.pureResolverEquivalent && !row.actualRenewalObserved));
});

test('separate synthetic V1 commissioning resolves real policy without widening100k/2M bounds; price increases fail closed', async () => {
  const inputs = await verifyInputs(), now = Date.now();
  const session = { id: '11111111-1111-4111-8111-111111111111', target: { expiresAt: now + 86400000 } };
  const reference = { tenantId: 'offline-tenant', memorySpaceId: 'offline-space', principalId: 'offline-principal', principalVersion: 1,
    membershipId: 'offline-member', membershipVersion: 1, grantId: 'offline-grant', grantVersion: 1, tenantEpoch: 1, memorySpaceEpoch: 1 };
  const prices = { observedAt: now, models: [{ modelId: 'openai/gpt-4o-mini', prompt: 0.000000165, completion: 0.00000066 }] };
  const manifest = prospectiveV1(inputs, session, reference, prices, syntheticReview);
  assert.equal(manifest.classification, 'fixture-synthetic'); assert.equal(manifest.qualifications.length, 1);
  const snapshot = contracts().domain.resolveModelPolicy({ context: { scope: reference, operationKey: 'agent.respond',
    runBudgetId: 'offline-v1', authorizedOverrides: [] }, policies: manifest.policies, qualifications: manifest.qualifications });
  assert.equal(snapshot.pins.toolRegistryVersion, 'cortex-memory-tools-v1'); assert.equal(snapshot.pins.boundRevision, 'agent-tools-32768-512-v1');
  assert.equal(snapshot.costBound.maximumCostUnits, 100000); assert.equal(snapshot.limits.runBudgetUnits, 2000000);
  assert.deepEqual(snapshot.allowedTools, ['memory_recall', 'memory_remember']); assert.deepEqual(snapshot.fallbackCandidates, []);
  assert.throws(() => prospectiveV1(inputs, session, reference, { ...prices, models: [{ ...prices.models[0], prompt: 1 }] }, syntheticReview), /Current price/);
  assert.throws(() => prospectiveV1(inputs, session, reference, { ...prices, observedAt: now - 3600001 }, syntheticReview));
  assert.throws(() => prospectiveV1(inputs, session, reference, prices, 'unreviewed'));
});

test('V1 outcome requires admitted exact tools, one native terminal, complete bounded usage and released stream', () => {
  evaluateV1(fixture());
  for (const mutate of [raw => { raw.readerLockReleased = false; }, raw => { raw.replay = true; },
    raw => { raw.terminalReceipts[0].receipt.usage.outputTokens = 513; }, raw => { raw.terminalReceipts[0].receipt.actualModel = 'other'; },
    raw => { raw.admissions[0].toolsCanonical = '[]'; }, raw => { raw.admissions[0].reservationUnits = 300000; },
    raw => { raw.parts.push(raw.parts[0]); }, raw => { raw.parts[0].input = '{"text":"jasmine tea","limit":2}'; }]) {
    const raw = fixture(); mutate(raw); assert.throws(() => evaluateV1(raw));
  }
});

test('financial evaluation preserves every old row and UNKNOWN amounts, with one separate V1 attempt and no active slot', () => {
  const { before, after } = ledger();
  assert.equal(evaluateV1Ledger(before, after).totalUnknownLiabilityUnits, 2800000);
  for (const mutate of [data => { data.after.attempts[0].state = 'settled'; }, data => { data.after.attempts.at(-1).reservationUnits = 300000; },
    data => { data.after.attempts.at(-1).dispatchIdentity = data.after.attempts[0].dispatchIdentity; },
    data => { data.after.accounts.at(-1).activeConcurrency = 1; }, data => { data.after.accounts.at(-2).limitUnits = 3000000; }]) {
    const data = ledger(); mutate(data); assert.throws(() => evaluateV1Ledger(data.before, data.after));
  }
});

async function offlineRun(t, overrides = {}, controller) {
  const root = await fs.mkdtemp(path.join(HERE, '.offline-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const events = [], services = {
    createCloud: async session => { events.push('create'); session.cloudIntent = { status: 'created' }; session.target = { name: 'synthetic-owned-target' }; },
    verifyCloud: async () => events.push('verify'), provisionRuntime: async () => events.push('eight'),
    supplemental: async (session, ctx) => { events.push('v1'); await ctx.receipt('issued-supplemental-v1', { synthetic: true }); return { offlineSynthetic: true }; },
    deleteCloud: async (session, ctx) => { events.push('cleanup'); assert.equal(ctx.signal, undefined); session.cloudDeleted = true; },
    ...overrides,
  };
  const result = runRenewal({ services, signal: controller?.signal, reviewSha256: syntheticReview, sessionRoot: root });
  return { root, events, result };
}

test('normal exit and cancellation settle owned work before uncanceled exact cleanup; no retry', async t => {
  const normal = await offlineRun(t); assert.equal((await normal.result).phase, 'CLEANED');
  assert.deepEqual(normal.events, ['create', 'verify', 'eight', 'v1', 'cleanup']);
  const controller = new AbortController(); let calls = 0;
  const canceled = await offlineRun(t, { provisionRuntime: async () => { calls++; controller.abort(); throw Error('synthetic canceled'); } }, controller);
  await assert.rejects(canceled.result, /failed or is UNKNOWN/);
  assert.equal(calls, 1); assert.ok(!canceled.events.includes('v1')); assert.equal(canceled.events.at(-1), 'cleanup');
  const id = (await fs.readdir(path.join(canceled.root, '.sandbox-env-runs')))[0];
  const journal = JSON.parse(await fs.readFile(path.join(canceled.root, '.sandbox-env-runs', id, 'session.json')));
  assert.equal(journal.phase, 'CLEANED'); assert.equal(journal.cloudDeleted, true);
});

test('UNKNOWN supplemental result retains issued receipt, exact cleanup, and original no-retry failure', async t => {
  let calls = 0;
  const run = await offlineRun(t, { supplemental: async (session, ctx) => {
    calls++; await ctx.receipt('issued-supplemental-v1', { synthetic: true, status: 'UNKNOWN', ceilingUnits: 100000 });
    throw Error('synthetic unknown');
  } });
  await assert.rejects(run.result, /failed or is UNKNOWN/); assert.equal(calls, 1);
  const id = (await fs.readdir(path.join(run.root, '.sandbox-env-runs')))[0], dir = path.join(run.root, '.sandbox-env-runs', id);
  assert.equal(JSON.parse(await fs.readFile(path.join(dir, 'session.json'))).phase, 'CLEANED');
  assert.equal(JSON.parse(await fs.readFile(path.join(dir, 'receipts/issued-supplemental-v1.json'))).status, 'UNKNOWN');
  await assert.rejects(fs.stat(path.join(dir, 'secrets')), { code: 'ENOENT' });
});

test('cleanup failure is not success and retains exact recovery journal', async t => {
  const run = await offlineRun(t, { deleteCloud: async () => { throw Error('synthetic cleanup unavailable'); } });
  await assert.rejects(run.result, /failed or is UNKNOWN/);
  const id = (await fs.readdir(path.join(run.root, '.sandbox-env-runs')))[0], dir = path.join(run.root, '.sandbox-env-runs', id);
  assert.equal(JSON.parse(await fs.readFile(path.join(dir, 'session.json'))).phase, 'CLEANUP_FAILED');
  assert.equal(JSON.parse(await fs.readFile(path.join(dir, 'receipts/cleanup-recovery.json'))).status, 'FAILED');
  assert.ok((await fs.stat(path.join(dir, 'secrets'))).isDirectory());
});

test('V1 probe compiles against current actual backend types in a read-only virtual host; only internal registrations', async () => {
  const ts = requireCandidate('typescript'), probeName = path.join(CANDIDATE, 'convex-dev/renewalV1Probe.ts');
  const scopeName = path.join(CANDIDATE, 'convex-dev/renewalV1Scope.ts');
  const originalProbe = await fs.readFile(path.join(HERE, 'supplemental-v1-probe.ts'), 'utf8');
  const probe = originalProbe.replace('./_cortex/shared/domain/model_policy', '../src/domain/model-policy')
    .replace('./_cortex/shared/domain/profile', '../src/domain/profile').replace('./_cortex/shared/domain/agent_tools', '../src/domain/agent-tools');
  const scope = 'export const V1_OPERATION="offline-v1"; export const V1_REFERENCE={tenantId:"offline",memorySpaceId:"offline",principalId:"offline",principalVersion:1,membershipId:"offline",membershipVersion:1,grantId:"offline",grantVersion:1,tenantEpoch:1,memorySpaceEpoch:1} as const;';
  const files = new Map([[probeName, probe], [scopeName, scope]]);
  const options = { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true, noEmit: true, skipLibCheck: true, esModuleInterop: true, types: ['node'] };
  const host = ts.createCompilerHost(options), fileExists = host.fileExists.bind(host), readFile = host.readFile.bind(host);
  host.fileExists = file => files.has(file) || fileExists(file); host.readFile = file => files.get(file) ?? readFile(file);
  host.getSourceFile = (file, languageVersion) => { const source = host.readFile(file); return source === undefined ? undefined : ts.createSourceFile(file, source, languageVersion, true); };
  const program = ts.createProgram([probeName], options, host);
  const errors = ts.getPreEmitDiagnostics(program).filter(row => row.category === ts.DiagnosticCategory.Error);
  assert.deepEqual(errors.map(row => ts.flattenDiagnosticMessageText(row.messageText, '\n')), []);
  const source = ts.createSourceFile(probeName, originalProbe, ts.ScriptTarget.Latest, true);
  const registrations = source.statements.filter(ts.isVariableStatement).flatMap(row => [...row.declarationList.declarations])
    .filter(row => row.initializer && ts.isCallExpression(row.initializer));
  assert.deepEqual(registrations.map(row => [row.name.getText(source), row.initializer.expression.getText(source)]),
    [['snapshot', 'internalQuery'], ['observe', 'internalAction']]);
});

test('fixed V1 replay uses canonical saved output before any native stream dispatch', async () => {
  const ts = requireCandidate('typescript'), source = await fs.readFile(path.join(HERE, 'supplemental-v1-probe.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  let dispatched = 0, completed = 0;
  const lifecycle = { consumeReplay: async () => 'saved-private-result', complete: async () => { completed++; }, signal: new AbortController().signal };
  const composition = { ledger: { admit: async () => { throw Error('must not admit'); } }, terminalSink: { capture: async () => { throw Error('must not capture'); } } };
  const { domain, tools } = contracts();
  const dependencies = {
    './_generated/server': { internalAction: value => value, internalQuery: value => value },
    './runtimeGatewayBackend': { ensureBackendGatewayBudget: async () => ({ runBudgetId: 'offline' }), createBackendGatewayComposition: () => composition },
    './runtimeGateway': { createGovernedGatewayModel: async () => ({ lifecycle, model: { modelId: 'openai/gpt-4o-mini', doStream: async () => { dispatched++; } } }) },
    './_cortex/shared/domain/model_policy': domain, './_cortex/shared/domain/profile': { semanticHash: async () => 'a'.repeat(64) },
    './_cortex/shared/domain/agent_tools': tools, './renewalV1Scope': { V1_REFERENCE: {}, V1_OPERATION: 'offline' },
  };
  const module = { exports: {} };
  new Function('require', 'exports', 'module', code)(name => { assert.ok(name in dependencies); return dependencies[name]; }, module.exports, module);
  const raw = await module.exports.observe.handler({});
  assert.equal(raw.replay, true); assert.equal(dispatched, 0); assert.equal(completed, 1); assert.deepEqual(raw.terminalReceipts, []);
  assert.throws(() => evaluateV1(raw), 'Replay is never accepted as fresh native evidence');
  // Existing immutable engine remains available and asserts exactly eight requests.
  const qualification = await import(pathToFileURL(path.join(ENGINE, 'qualification.mjs')));
  assert.equal((await qualification.verifyProcedure()).maximumPaidRequests, 8);
});
