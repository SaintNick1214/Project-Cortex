/** Local synthetic outcomes are never counted as actual model evidence. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { HERE, PRIVATE_ROOT, inspect, pinnedHostDependencies, evaluateLedger, observeOne, runV1, main } from './v1-renewal.mjs';
import { CANDIDATE, STAGING, ENGINE, contracts, prospectiveV1, evaluateV1 } from '../qualification-renewal/renewal.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const reviewSha256 = 'a'.repeat(64);
const requireCandidate = createRequire(path.join(CANDIDATE, 'package.json'));
const ledger = () => ({ accounts: [], operations: [], attempts: [] });
const finished = () => ({ attempts: [{ _id: 'a1', operationDocumentId: 'op1', dispatchIdentity: 'b'.repeat(64),
  state: 'uncertain', reservationUnits: 100000, ordinal: 0, slotReleased: true }], operations: [{ _id: 'op1' }],
  accounts: ['run', 'tenant'].map(kind => ({ kind, limitUnits: kind === 'run' ? 2000000 : 10000000,
    activeConcurrency: 0, reservedUnits: 0, settledUnits: 0, uncertainUnits: 100000 })) });
function raw() {
  const { domain, tools } = contracts(), now = Date.now();
  return { checkedAt: now - 50, completedAt: now - 1, modelId: 'openai/gpt-4o-mini',
    registryVersion: 'cortex-memory-tools-v1', boundRevision: 'agent-tools-32768-512-v1', replay: false,
    readerDone: true, readerLockReleased: true, error: null, completionError: null,
    terminalReceipts: [{ capturedAt: now - 2, receipt: { modelId: 'openai/gpt-4o-mini', actualModel: 'openai/gpt-4o-mini',
      nativeInterface: 'chat', outcome: 'confirmed', proof: 'provider-terminal-v1', costSource: 'unavailable', usage: { inputTokens: 100, outputTokens: 20 } } }],
    admissions: [{ status: 'reserved', registryVersion: 'cortex-memory-tools-v1', boundRevision: 'agent-tools-32768-512-v1',
      reservationUnits: 100000, outputTokens: 512, inputTokens: 10000, requestHash: 'b'.repeat(64),
      toolsCanonical: domain.canonicalModelJson(tools.AGENT_NATIVE_TOOLS.map(tool => ({ name: tool.name,
        definition: { description: tool.description, inputSchema: tool.inputSchema } }))) }],
    parts: [{ type: 'tool-call', toolName: 'memory_recall', input: '{"text":"jasmine tea","limit":1}' }, { type: 'finish' }],
  };
}

test('offline preflight preserves seven actual passes and uses exact V1 descriptor/2M run without resource creation', async () => {
  const inputs = await inspect(), dry = await main([]);
  assert.equal(dry.networkCalls, 0); assert.equal(dry.modelCalls, 0); assert.equal(dry.maximumPaidRequests, 1);
  assert.equal(dry.maximumUnknownLiabilityUnits, 100000); assert.equal(dry.cumulativePotentialIncludingImageDiagnostic, 4800000);
  assert.equal(dry.cumulativeMaximumCalls, 10); assert.equal(dry.revision19Created, false);
  const reference = { tenantId: 'offline', memorySpaceId: 'offline', principalId: 'offline', principalVersion: 1,
    membershipId: 'offline', membershipVersion: 1, grantId: 'offline', grantVersion: 1, tenantEpoch: 1, memorySpaceEpoch: 1 };
  const session = { id: '11111111-1111-4111-8111-111111111111', target: { expiresAt: Date.now() + 86400000 } };
  const prices = { observedAt: Date.now(), models: [{ modelId: 'openai/gpt-4o-mini', prompt: 0.000000165, completion: 0.00000066 }] };
  const manifest = prospectiveV1(inputs, session, reference, prices, reviewSha256);
  const resolved = contracts().domain.resolveModelPolicy({ context: { scope: reference, operationKey: 'agent.respond', runBudgetId: 'offline', authorizedOverrides: [] },
    policies: manifest.policies, qualifications: manifest.qualifications });
  assert.equal(manifest.classification, 'fixture-synthetic'); assert.equal(resolved.costBound.maximumCostUnits, 100000);
  assert.equal(resolved.limits.runBudgetUnits, 2000000); assert.equal(resolved.limits.outputTokens, 512);
  assert.deepEqual(resolved.allowedTools, ['memory_recall', 'memory_remember']); assert.deepEqual(resolved.fallbackCandidates, []);
  assert.throws(() => prospectiveV1(inputs, session, reference, { ...prices, models: [{ ...prices.models[0], prompt: 1 }] }, reviewSha256));
  assert.ok(!PRIVATE_ROOT.startsWith(CANDIDATE + path.sep));
});

test('empty-to-one financial evaluator rejects widening, extra attempts and unreleased or settled liability', () => {
  assert.equal(evaluateLedger(ledger(), finished()).retainedV1UnknownUnits, 100000);
  for (const alter of [after => { after.attempts.push(after.attempts[0]); }, after => { after.attempts[0].state = 'settled'; },
    after => { after.attempts[0].reservationUnits = 200000; }, after => { after.accounts[0].limitUnits = 3000000; },
    after => { after.accounts[1].activeConcurrency = 1; }]) {
    const after = finished(); alter(after); assert.throws(() => evaluateLedger(ledger(), after));
  }
  assert.throws(() => evaluateLedger(finished(), finished()));
  const replay = raw(); replay.replay = true; assert.throws(() => evaluateV1(replay));
});

test('actual staged SDK Convex range uses maintained exact host pin; every other declaration remains exact', async () => {
  const distribution = JSON.parse(await fs.readFile(path.join(STAGING, 'dist/backend/v1/manifest.json')));
  const lock = JSON.parse(await fs.readFile(path.join(ENGINE, 'templates/native-package-lock.json')));
  assert.equal(distribution.dependencies.convex, '^1.46.0'); assert.equal(lock.packages[''].dependencies.convex, '1.46.0');
  const pins = pinnedHostDependencies(distribution, lock);
  assert.equal(pins.convex, '1.46.0');
  for (const [name, version] of Object.entries(distribution.dependencies)) if (name !== 'convex') assert.equal(pins[name], version);
  const widenedConvex = structuredClone(lock); widenedConvex.packages[''].dependencies.convex = '^1.46.0';
  assert.throws(() => pinnedHostDependencies(distribution, widenedConvex), /convex/);
  const other = Object.keys(distribution.dependencies).find(name => name !== 'convex');
  const drifted = structuredClone(lock); drifted.packages[''].dependencies[other] += '-changed';
  assert.throws(() => pinnedHostDependencies(distribution, drifted), /dependency mismatch/);
});

test('exact reused V1 probe and catalog compile read-only against current backend; only internal registrations', async () => {
  const ts = requireCandidate('typescript'), probeName = path.join(CANDIDATE, 'convex-dev/renewalV1Probe.ts');
  const scopeName = path.join(CANDIDATE, 'convex-dev/renewalV1Scope.ts'), catalogName = path.join(CANDIDATE, 'convex-dev/v1OnlyCatalog.ts');
  const probe = (await fs.readFile(path.join(HERE, '../qualification-renewal/supplemental-v1-probe.ts'), 'utf8'))
    .replace('./_cortex/shared/domain/model_policy', '../src/domain/model-policy').replace('./_cortex/shared/domain/profile', '../src/domain/profile')
    .replace('./_cortex/shared/domain/agent_tools', '../src/domain/agent-tools');
  const scope = 'export const V1_OPERATION="offline"; export const V1_REFERENCE={tenantId:"offline",memorySpaceId:"offline",principalId:"offline",principalVersion:1,membershipId:"offline",membershipVersion:1,grantId:"offline",grantVersion:1,tenantEpoch:1,memorySpaceEpoch:1} as const;';
  const catalog = await fs.readFile(path.join(HERE, 'catalog.ts'), 'utf8');
  const files = new Map([[probeName, probe], [scopeName, scope], [catalogName, catalog]]);
  const options = { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true, noEmit: true, skipLibCheck: true, esModuleInterop: true, types: ['node'] };
  const host = ts.createCompilerHost(options), originalExists = host.fileExists.bind(host), originalRead = host.readFile.bind(host);
  host.fileExists = file => files.has(file) || originalExists(file); host.readFile = file => files.get(file) ?? originalRead(file);
  host.getSourceFile = (file, languageVersion) => { const source = host.readFile(file); return source === undefined ? undefined : ts.createSourceFile(file, source, languageVersion, true); };
  const program = ts.createProgram([probeName, catalogName], options, host);
  assert.deepEqual(ts.getPreEmitDiagnostics(program).filter(row => row.category === ts.DiagnosticCategory.Error)
    .map(row => ts.flattenDiagnosticMessageText(row.messageText, '\n')), []);
  for (const [name, source, expected] of [[probeName, probe, ['internalQuery', 'internalAction']], [catalogName, catalog, ['internalAction']]]) {
    const ast = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true);
    const registrations = ast.statements.filter(ts.isVariableStatement).flatMap(statement => [...statement.declarationList.declarations])
      .filter(row => row.initializer && ts.isCallExpression(row.initializer));
    assert.deepEqual(registrations.map(row => row.initializer.expression.getText(ast)), expected);
  }
});

async function fixture(t, { unknown = false, cancel = false, cleanupFailure = false } = {}) {
  const root = await fs.mkdtemp(path.join(HERE, '.offline-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const controller = new AbortController(), events = []; let paidCalls = 0;
  const services = {
    createCloud: async (session, ctx) => {
      events.push('create'); const now = Date.now();
      session.cloudIntent = { teamId: 325340, projectId: 3200658, reference: 'dev/cortex-sandbox-' + session.id,
        type: 'dev', isDefault: false, createdAt: now, expiresAt: now + 86400000, status: 'created' };
      session.target = { id: 1001, name: 'offline-otter-901', kind: 'cloud', teamId: 325340, projectId: 3200658,
        reference: session.cloudIntent.reference, deploymentType: 'dev', isDefault: false, expiresAt: session.cloudIntent.expiresAt,
        deploymentUrl: 'https://offline-otter-901.convex.cloud', disposable: true, serverExpiryVerified: true };
      const credential = path.join(session.runDir, 'fake-config.json');
      await fs.writeFile(credential, JSON.stringify({ accessToken: 'offline-management-credential' }), { mode: 0o600 });
      ctx.convexConfigPath = credential;
      ctx.fetch = async url => {
        if (url.endsWith('/projects/3200658')) return new Response(JSON.stringify({ id: 3200658, teamId: 325340, slug: 'cortex-sandboxes' }));
        assert.ok(url.endsWith('/projects/3200658/list_deployments'));
        return new Response(JSON.stringify([{ ...session.target }]));
      };
      await ctx.persist();
    },
    verifyCloud: async () => events.push('verify'),
    commission: async (session, ctx, inputs) => {
      events.push('commission-only'); if (cancel) { controller.abort(); throw Error('Synthetic canceled setup'); }
      const probe = await fs.readFile(path.join(HERE, '../qualification-renewal/supplemental-v1-probe.ts'));
      await fs.mkdir(path.join(session.backendDir, 'convex'));
      await fs.writeFile(path.join(session.backendDir, 'convex/renewalV1Probe.ts'), probe);
      let dispatched = false;
      const client = {
        query: async () => dispatched ? finished() : ledger(),
        action: async name => {
          assert.equal(name, 'renewalV1Probe:observe');
          const intent = JSON.parse(await fs.readFile(path.join(root, 'issued-v1-only.json')));
          assert.equal(intent.maximumUnknownLiabilityUnits, 100000); assert.equal(intent.runBudgetUnits, 2000000);
          assert.equal(intent.sessionId, session.id); assert.equal(intent.target.reference, session.target.reference);
          paidCalls++; dispatched = true; if (unknown) throw Error('Synthetic unknown native call'); return raw();
        },
      };
      return { client, probeSha256: sha(probe), manifest: { manifestId: 'synthetic-v1-' + session.id,
        dispatchEvidence: [inputs.supplemental.dispatchEvidence] } };
    },
    observeOne,
    deleteCloud: async (session, ctx) => {
      events.push('cleanup'); assert.equal(ctx.signal, undefined);
      if (cleanupFailure) throw Error('Synthetic cleanup unavailable'); session.cloudDeleted = true; await ctx.persist();
    },
  };
  const result = runV1({ services, signal: controller.signal, reviewSha256, sessionRoot: root });
  return { root, events, result, services, calls: () => paidCalls };
}

test('one issued stream has exact private intent, empty→one ledger and finally cleanup; rerun cannot create a new target', async t => {
  const f = await fixture(t), result = await f.result;
  assert.equal(result.phase, 'CLEANED'); assert.equal(f.calls(), 1);
  assert.deepEqual(f.events, ['create', 'verify', 'commission-only', 'cleanup']);
  const intent = JSON.parse(await fs.readFile(path.join(f.root, 'issued-v1-only.json')));
  assert.equal(intent.exactToolContract.registryVersion, 'cortex-memory-tools-v1'); assert.equal(intent.ordinal, 0);
  assert.equal((await fs.stat(path.join(f.root, 'issued-v1-only.json'))).mode & 0o777, 0o600);
  await assert.rejects(() => runV1({ services: f.services, reviewSha256, sessionRoot: f.root }), /Existing V1 execution intent/);
  assert.equal(f.calls(), 1); assert.equal(f.events.filter(event => event === 'create').length, 1);
});

test('UNKNOWN single call retains issued100k receipt and cleanup, while cancellation dispatches zero calls', async t => {
  const unknown = await fixture(t, { unknown: true });
  await assert.rejects(unknown.result, /failed or is UNKNOWN/); assert.equal(unknown.calls(), 1); assert.equal(unknown.events.at(-1), 'cleanup');
  const intent = JSON.parse(await fs.readFile(path.join(unknown.root, 'execution-intent.json')));
  const dir = path.join(unknown.root, '.sandbox-env-runs', intent.sessionId);
  assert.equal(JSON.parse(await fs.readFile(path.join(dir, 'session.json'))).phase, 'CLEANED');
  assert.equal(JSON.parse(await fs.readFile(path.join(dir, 'receipts/v1-only-failure.json'))).retainedPotentialLiabilityUnits, 100000);
  await assert.rejects(fs.stat(path.join(dir, 'secrets')), { code: 'ENOENT' });
  const canceled = await fixture(t, { cancel: true });
  await assert.rejects(canceled.result, /failed or is UNKNOWN/); assert.equal(canceled.calls(), 0); assert.equal(canceled.events.at(-1), 'cleanup');
});

test('cleanup failure stays failed with recoverable private journal and credentials', async t => {
  const f = await fixture(t, { cleanupFailure: true }); await assert.rejects(f.result, /failed or is UNKNOWN/);
  const intent = JSON.parse(await fs.readFile(path.join(f.root, 'execution-intent.json')));
  const dir = path.join(f.root, '.sandbox-env-runs', intent.sessionId);
  assert.equal(JSON.parse(await fs.readFile(path.join(dir, 'session.json'))).phase, 'CLEANUP_FAILED');
  const recovery = JSON.parse(await fs.readFile(path.join(dir, 'receipts/cleanup-recovery.json')));
  assert.equal(recovery.status, 'FAILED');
  assert.ok(recovery.recoveryCommand.includes(path.join(HERE, 'v1-renewal.mjs')));
  assert.ok(recovery.recoveryCommand.endsWith('cleanup ' + intent.sessionId));
  assert.equal(recovery.recoveryCommand.includes('start-sandbox.sh'), false);
  assert.ok((await fs.stat(path.join(dir, 'secrets'))).isDirectory());
});
