/** Offline outcome regressions; no native model or service success is claimed. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { HERE, CANDIDATE, ENGINE, PRIVATE_ROOT, verifyInputs, fixedInput, commissioningManifest, publicDiagnostic,
  oneImage, runImageDiagnostic, diagnosticJobSource, extractDiagnostics, validateNativeLock, durable,
  IMAGE_MODEL, RETIRED_MODEL, IMAGE_BOUND, IMAGE_CONTRACT, imagePrice } from './image-diagnostic.mjs';
const requireCandidate = createRequire(path.join(CANDIDATE, 'package.json'));
const ts = requireCandidate('typescript');
const review = 'a'.repeat(64);
const digest = text => createHash('sha256').update(text).digest('hex');
const syntheticPrompt = 'offline-fixture-input';

function loadTs(source, imports) {
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function('require', 'exports', 'module', code)(name => { assert.ok(name in imports, name); return imports[name]; }, module.exports, module);
  return module.exports;
}
async function fixtureModules() {
  const diagnostic = loadTs(await fs.readFile(path.join(HERE, 'diagnostic.ts'), 'utf8'), {
    './_cortex/shared/domain/profile': { semanticHash: async text => digest(text) },
  });
  const probe = loadTs(await fs.readFile(path.join(HERE, 'image-probe.ts'), 'utf8'), {
    './_generated/server': { internalAction: value => value, internalQuery: value => value }, 'convex/server': {},
    './runtimeMediaGateway': {}, './imageDiagnosticMetadata': diagnostic,
    './imageDiagnosticScope': { IMAGE_INPUT: { prompt: syntheticPrompt }, IMAGE_MODEL, IMAGE_MARKER: 'offline-marker' },
  });
  return { diagnostic, probe };
}

test('current source equivalence preserves old8/2.7M and fixes the new scope to one image/2M', async () => {
  const inputs = await verifyInputs(); assert.equal(inputs.materialSources, 18); assert.equal(inputs.nativeFiles, 19);
  assert.equal(inputs.originalAttempts, 8); assert.equal(inputs.originalPossibleLiabilityUnits, 2700000);
  assert.equal(inputs.maximumNewImageSubmissions, 1); assert.equal(inputs.cumulativePossibleLiabilityAfterThis, 4800000);
  assert.equal(inputs.existingV1.retainedUnknownUnits, 100000); assert.equal(inputs.priorAttempts, 9);
  assert.equal(inputs.modelId, IMAGE_MODEL); assert.equal(inputs.oldModelExecutionBlocked, true); assert.equal(inputs.evidenceRenewsRetiredModel, false);
  assert.equal(inputs.nativeContract.convexRequested, '^1.46.0'); assert.equal(inputs.nativeContract.convexLocked, '1.46.0');
  assert.ok(!PRIVATE_ROOT.startsWith(CANDIDATE + path.sep));
  const input = await fixedInput(); assert.equal(digest(input.prompt), inputs.promptSha256);
  assert.ok(!JSON.stringify(inputs).includes(input.prompt), 'No prompt appears in public input receipt');
});
test('durability synchronizes the issued file before its containing directory and closes both handles', async () => {
  const events = [], file = path.join(HERE, 'offline-intent.json');
  await durable(file, { open: async (name, mode) => { events.push(['open', name, mode]); return {
    sync: async () => events.push(['sync', name]), close: async () => events.push(['close', name]),
  }; } });
  assert.deepEqual(events, [['open', file, 'r'], ['sync', file], ['close', file],
    ['open', HERE, 'r'], ['sync', HERE], ['close', HERE]]);
});
test('only the reviewed Convex range-to-exact lock match is allowed; another native dependency mismatch fails closed', () => {
  const distribution = { dependencies: { convex: '^1.46.0', ai: '7.0.127' } }, lock = { packages: { '': { dependencies: { convex: '1.46.0', ai: '7.0.127' } } } };
  assert.equal(validateNativeLock(distribution, lock).exactOtherDependencies, 1);
  assert.throws(() => validateNativeLock(distribution, { packages: { '': { dependencies: { convex: '1.46.1', ai: '7.0.127' } } } }));
  assert.throws(() => validateNativeLock(distribution, { packages: { '': { dependencies: { convex: '1.46.0', ai: '^7.0.127' } } } }));
});

test('private diagnostic captures useful bounded status/code and redacts credentials, prompt, raw bodies and unsafe getters', async () => {
  const { diagnostic } = await fixtureModules();
  const secret = 'sk-proj-abcdefghijklmno', jwt = 'eyJabcdefghijk.abcdefghijk.abcdefghijk';
  const error = Object.assign(new Error(syntheticPrompt + ' Bearer service-secret ' + secret + ' ' + jwt + ' ' + 'x'.repeat(9000)), {
    name: 'AI_APICallError', statusCode: 403, isRetryable: false,
    responseBody: JSON.stringify({ error: { code: 'insufficient_credits', type: 'quota', message: syntheticPrompt + ' Bearer remote-secret' }, credential: secret }),
    responseHeaders: { 'x-request-id': 'safe-request-123', Authorization: 'Bearer never-retain-this' },
  });
  Object.defineProperty(error, 'data', { get: () => { throw Error('getter must never execute'); } });
  const result = await diagnostic.privateDiagnostic(error, [syntheticPrompt]);
  assert.equal(result.statusCode, 403); assert.equal(result.providerCode, 'insufficient_credits');
  assert.equal(result.requestIds['x-request-id'], 'safe-request-123'); assert.equal(result.messageSha256, digest(error.message));
  assert.ok(result.message.length <= 1024); assert.ok(JSON.stringify(result).length < 7000);
  for (const forbidden of [syntheticPrompt, secret, jwt, 'service-secret', 'remote-secret', 'never-retain-this']) assert.ok(!JSON.stringify(result).includes(forbidden));
  assert.ok(!('responseBody' in result)); assert.ok(!('requestBodyValues' in result)); assert.ok(!('Authorization' in result.requestIds));
});

test('public diagnostic exposes only safe status/code/hash fields, never private message, header or body', () => {
  const privateValue = { phase: 'native-image-threw', diagnostic: { statusCode: 403, providerCode: 'insufficient_credits',
    message: 'private upstream message', responseBody: 'private body', requestIds: { secret: 'private-id' },
    messageSha256: 'b'.repeat(64), responseBodySha256: 'c'.repeat(64) } };
  const result = publicDiagnostic(privateValue); assert.equal(result.providerCode, 'insufficient_credits'); assert.equal(result.statusCode, 403);
  assert.ok(!JSON.stringify(result).includes('private')); assert.match(result.diagnosticSha256, /^[a-f0-9]{64}$/);
  assert.equal(publicDiagnostic({ phase: 'private payload', diagnostic: { providerCode: 'sk-proj-abcdefghijklmno' } }).providerCode, null);
});
test('private log extraction accepts official legacy/structured lines and refuses another job or oversized metadata', () => {
  const marker = 'offline-marker:', record = { jobId: 'owned-job', value: { phase: 'native-image-threw', diagnostic: { statusCode: 403 } } };
  const line = marker + JSON.stringify(record);
  for (const logLines of [[line], ['[ERROR] ' + line], [{ messages: [line] }], [{ messages: [JSON.stringify(line)] }]]) {
    assert.deepEqual(extractDiagnostics([{ logLines }], marker, 'owned-job'), [record.value]);
  }
  assert.throws(() => extractDiagnostics([{ logLines: [line] }], marker, 'other-job'));
  assert.throws(() => extractDiagnostics([{ logLines: [marker + 'x'.repeat(16385)] }], marker, 'owned-job'));
});

test('trusted wrapper calls the same official factory once, retains metadata before rethrow and preserves original exception if logging fails', async () => {
  const { probe } = await fixtureModules(), original = new Error('offline image rejection');
  let calls = 0; const captured = [];
  const native = { image: async input => { calls++; assert.equal(input.prompt, syntheticPrompt); throw original; } };
  const wrapped = probe.observedFactory(value => captured.push(value), modelId => { assert.equal(modelId, IMAGE_MODEL); return native; })(IMAGE_MODEL);
  await assert.rejects(wrapped.image({ prompt: syntheticPrompt, signal: new AbortController().signal }), error => error === original);
  assert.equal(calls, 1); assert.equal(captured.length, 1); assert.equal(captured[0].phase, 'native-image-threw');
  const brokenLog = probe.observedFactory(() => { throw Error('logging unavailable'); }, () => native)(IMAGE_MODEL);
  await assert.rejects(brokenLog.image({ prompt: syntheticPrompt }), error => error === original); assert.equal(calls, 2);
  const output = { data: 'offline-only', mimeType: 'image/png' };
  const success = probe.observedFactory(() => { throw Error('logging unavailable'); }, () => ({ image: async () => output }))(IMAGE_MODEL);
  assert.equal(await success.image({}), output);
  assert.throws(() => probe.observedFactory(() => {}, () => { throw Error('retired factory must never be constructed'); })(RETIRED_MODEL), /UNEXPECTED_IMAGE_MODEL/);
});

test('synthetic commissioning uses actual image governor contract and leaves prior application budgets unchanged', async () => {
  const inputs = await verifyInputs();
  const manifest = await commissioningManifest({ id: '11111111-1111-4111-8111-111111111111', target: { expiresAt: Date.now() + 86400000 } }, inputs,
    { modelId: IMAGE_MODEL, observedAt: Date.now(), maximumPublishedUnits: 1000000 }, review);
  const previous = await import(pathToFileURL(path.join(HERE, '../qualification-renewal/renewal.mjs'))), domain = previous.contracts().domain;
  const scope = { tenantId: 'offline', memorySpaceId: 'offline', principalId: 'offline', principalVersion: 1, membershipId: 'offline', membershipVersion: 1, grantId: 'offline', grantVersion: 1, tenantEpoch: 1, memorySpaceEpoch: 1 };
  for (const operationKey of ['agent.respond', 'media.image.generate']) {
    const snapshot = domain.resolveModelPolicy({ context: { scope, operationKey, runBudgetId: 'offline', authorizedOverrides: [] },
      policies: manifest.policies.filter(row => !row.operationKey || row.operationKey === operationKey), qualifications: manifest.qualifications });
    if (operationKey === 'media.image.generate') { assert.equal(snapshot.modelId, IMAGE_MODEL); assert.equal(snapshot.pins.boundRevision, IMAGE_BOUND);
      assert.equal(snapshot.costBound.maximumCostUnits, 2000000); assert.equal(snapshot.limits.runBudgetUnits, 3000000); }
  }
  assert.equal(manifest.qualifications[1].modelId, IMAGE_MODEL); assert.equal(manifest.dispatchEvidence[1].modelId, IMAGE_MODEL);
  assert.deepEqual(manifest.dispatchEvidence[1].mediaContract, IMAGE_CONTRACT);
  assert.ok(manifest.policies.every(row => row.rules.modelId !== RETIRED_MODEL && !row.rules.allowedModels?.includes(RETIRED_MODEL)));
  await assert.rejects(commissioningManifest({ id: 'offline', target: { expiresAt: Date.now() + 1000 } }, inputs,
    { modelId: IMAGE_MODEL, observedAt: Date.now(), maximumPublishedUnits: 2000001 }, review));
  await assert.rejects(commissioningManifest({ id: 'offline', target: { expiresAt: Date.now() + 1000 } }, { ...inputs, modelId: RETIRED_MODEL },
    { modelId: IMAGE_MODEL, observedAt: Date.now(), maximumPublishedUnits: 1 }, review));
});

test('replacement price check selects only the exact new model and denies stale-model or over-ceiling quotes', async () => {
  let fetched;
  const quote = id => ({ fetch: async url => { fetched = url; return new Response(JSON.stringify({ data: { id,
    pricing: { prompt: '0.0000001', image_output: '0.000001' } } }), { status: 200 }); } });
  const price = await imagePrice(quote(IMAGE_MODEL));
  assert.equal(fetched, 'https://openrouter.ai/api/v1/model/' + IMAGE_MODEL); assert.equal(price.modelId, IMAGE_MODEL);
  assert.equal(price.fullUnknownCeilingUnits, 2000000); assert.ok(price.maximumPublishedUnits <= 2000000);
  await assert.rejects(imagePrice(quote(RETIRED_MODEL)));
  await assert.rejects(imagePrice({ fetch: async () => new Response(JSON.stringify({ data: { id: IMAGE_MODEL,
    pricing: { prompt: '1', image_output: '1' } } }), { status: 200 }) }));
});

test('unchanged official factory plus installed compatible adapter emits only the replacement model change in native wire bytes', async () => {
  const source = await fs.readFile(path.join(CANDIDATE, 'convex-dev/runtimeMediaGateway.ts'), 'utf8');
  const ast = ts.createSourceFile('runtimeMediaGateway.ts', source, ts.ScriptTarget.Latest, true);
  const declaration = ast.statements.filter(ts.isVariableStatement).flatMap(row => [...row.declarationList.declarations])
    .find(row => row.name.getText(ast) === 'officialMediaFactory');
  assert.ok(declaration?.initializer);
  const code = ts.transpileModule('module.exports=' + declaration.initializer.getText(ast) + ';', {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const { createOpenAICompatible } = await import(pathToFileURL(requireCandidate.resolve('@ai-sdk/openai-compatible')));
  let wire, requests = 0;
  const compatible = createOpenAICompatible({ name: 'convexGateway', baseURL: 'https://ai-gateway.convex.dev/v1', fetch: async (url, init) => {
    requests++; assert.equal(String(url), 'https://ai-gateway.convex.dev/v1/images/generations'); wire = JSON.parse(init.body);
    return new Response(JSON.stringify({ data: [{ b64_json: 'AA==' }] }), { status: 200 });
  } });
  const module = { exports: {} };
  new Function('convexGateway', 'module', code)({ imageModel: model => { assert.equal(model, IMAGE_MODEL); return compatible.imageModel(model); }, videoModel: () => ({}) }, module);
  const input = await fixedInput(); await module.exports(IMAGE_MODEL).image({ prompt: input.prompt, signal: new AbortController().signal });
  assert.equal(requests, 1); assert.equal(wire.model, IMAGE_MODEL); assert.ok(!('response_format' in wire));
  assert.deepEqual(Object.keys(wire).sort(), ['model', 'n', 'output_format', 'prompt', 'quality', 'size']);
  assert.equal(wire.n, 1); assert.equal(wire.size, '1024x1024'); assert.equal(wire.quality, 'low'); assert.equal(wire.output_format, 'png');
  assert.equal(digest(wire.prompt), input.promptSha256);
  assert.equal(digest(JSON.stringify(wire)), input.wireSha256);
});

test('one-image entrypoint writes exclusive durable intent before governed submit and never resubmits failed or UNKNOWN job', async t => {
  const root = await fs.mkdtemp(path.join(HERE, '.offline-image-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  const inputs = await verifyInputs(), saved = [], session = { id: 'offline', target: { name: 'synthetic-target' }, receiptDir: root };
  const ctx = { persist: async () => saved.push('persist'), receipt: async () => {}, signal: new AbortController().signal };
  let submits = 0, reads = 0;
  const cloud = { verifyCloud: async () => {}, privateWrite: async (file, value, options) => {
    assert.equal(options.exclusive, true); await fs.writeFile(file, JSON.stringify(value), { flag: 'wx', mode: 0o600 });
  } };
  const prepared = { modelId: IMAGE_MODEL, prompt: syntheticPrompt, price: { modelId: IMAGE_MODEL, observedAt: Date.now() }, scope: {}, client: { mutation: async (name, args) => {
    if (name === 'runtimeMediaJobs:submit') {
      submits++; assert.equal(session.imageIssued, true); assert.ok(saved.includes('synced-issued-image-only.json'));
      assert.equal(saved.at(-1), 'persist');
      const intent = JSON.parse(await fs.readFile(path.join(root, 'issued-image-only.json'))); assert.equal(intent.maximumNewSubmissions, 1);
      assert.ok(!JSON.stringify(intent).includes(syntheticPrompt)); return { jobId: 'synthetic-job' };
    }
    reads++; assert.equal(args.jobId, 'synthetic-job'); return { state: 'submission_unknown', failureCode: 'MEDIA_SUBMISSION_UNKNOWN' };
  } } };
  const sync = async file => { await durable(file); saved.push('synced-' + path.basename(file)); };
  const result = await oneImage(session, ctx, prepared, inputs, cloud, sync);
  assert.equal(result.actualSuccess, false); assert.equal(submits, 1); assert.equal(reads, 1);
  await assert.rejects(oneImage(session, ctx, prepared, inputs, cloud), { code: 'EEXIST' }); assert.equal(submits, 1);
});

async function offlineRun(t, options = {}) {
  const root = await fs.mkdtemp(path.join(HERE, '.offline-lifecycle-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  const events = [], controller = new AbortController();
  const services = { createCloud: async session => { session.cloudIntent = { status: 'created' }; session.target = { name: 'synthetic-owned-target' }; events.push('create'); },
    verifyCloud: async () => {}, prepareHost: async () => { events.push('prepare'); return {}; },
    oneImage: async (session, ctx) => { events.push('one-image'); session.imageIssued = true; await ctx.persist();
      await ctx.receipt('issued-image-only', { synthetic: true, status: 'UNKNOWN', ceilingUnits: 2000000 }); controller.abort(); throw Error('synthetic interruption'); },
    collectPrivateEvidence: async (session, ctx) => { events.push('collect'); assert.equal(ctx.signal, undefined); return []; },
    deleteCloud: async (session, ctx) => { events.push('delete'); assert.equal(ctx.signal, undefined); session.cloudDeleted = true; }, ...options };
  const result = await runImageDiagnostic({ services, sessionRoot: root, signal: controller.signal, reviewSha256: review });
  return { root, events, result, services };
}
test('interruption retains UNKNOWN intent and one attempt, gathers private evidence and cleans with an uncanceled context', async t => {
  const run = await offlineRun(t); assert.equal(run.result.failure, true); assert.equal(run.result.cleanup, 'CLEANED');
  assert.deepEqual(run.events, ['create', 'prepare', 'one-image', 'collect', 'delete']);
  const dir = path.join(run.root, '.sandbox-env-runs', run.result.sessionId);
  assert.equal(JSON.parse(await fs.readFile(path.join(dir, 'receipts/issued-image-only.json'))).status, 'UNKNOWN');
  assert.equal(JSON.parse(await fs.readFile(path.join(dir, 'receipts/image-safe-summary.json'))).originalPossibleLiabilityUnits, 2700000);
  await assert.rejects(fs.stat(path.join(dir, 'secrets')), { code: 'ENOENT' });
  await assert.rejects(runImageDiagnostic({ services: run.services, sessionRoot: run.root, reviewSha256: review }), { code: 'EEXIST' });
  assert.deepEqual(run.events, ['create', 'prepare', 'one-image', 'collect', 'delete']);
  assert.equal((await fs.readdir(path.join(run.root, '.sandbox-env-runs'))).length, 1);
});
test('cleanup failure stays explicit and retains exact-session recovery credentials', async t => {
  const run = await offlineRun(t, { deleteCloud: async () => { throw Error('synthetic deletion unavailable'); } });
  assert.equal(run.result.cleanupFailed, true); assert.equal(run.result.cleanup, 'CLEANUP_FAILED');
  const dir = path.join(run.root, '.sandbox-env-runs', run.result.sessionId); assert.ok((await fs.stat(path.join(dir, 'secrets'))).isDirectory());
  const recovery = JSON.parse(await fs.readFile(path.join(dir, 'receipts/cleanup-recovery.json')));
  assert.equal(recovery.status, 'FAILED'); assert.ok(recovery.recoveryCommand.includes('image-diagnostic.mjs cleanup ' + run.result.sessionId));
});

test('temporary diagnostic fixture compiles against the actual backend without writing a host', async () => {
  const base = path.join(CANDIDATE, 'convex-dev'), probeName = path.join(base, 'imageDiagnosticProbe.ts'), metadataName = path.join(base, 'imageDiagnosticMetadata.ts'), scopeName = path.join(base, 'imageDiagnosticScope.ts');
  const sources = new Map([[probeName, await fs.readFile(path.join(HERE, 'image-probe.ts'), 'utf8')],
    [metadataName, (await fs.readFile(path.join(HERE, 'diagnostic.ts'), 'utf8')).replace('./_cortex/shared/domain/profile', '../src/domain/profile')],
    [scopeName, 'export const IMAGE_INPUT={prompt:"offline-fixture"}; export const IMAGE_MODEL="openai/gpt-image-2.5-flare"; export const IMAGE_MARKER="offline-marker";']]);
  const jobName = path.join(base, 'runtimeMediaJobs.ts');
  sources.set(jobName, diagnosticJobSource(await fs.readFile(jobName, 'utf8')));
  const options = { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true, noEmit: true, skipLibCheck: true, esModuleInterop: true, types: ['node'] };
  const host = ts.createCompilerHost(options), fileExists = host.fileExists.bind(host), readFile = host.readFile.bind(host);
  host.fileExists = file => sources.has(file) || fileExists(file); host.readFile = file => sources.get(file) ?? readFile(file);
  host.getSourceFile = (file, target) => { const source = host.readFile(file); return source === undefined ? undefined : ts.createSourceFile(file, source, target, true); };
  const program = ts.createProgram([probeName, jobName], options, host);
  const errors = ts.getPreEmitDiagnostics(program).filter(row => row.category === ts.DiagnosticCategory.Error);
  assert.deepEqual(errors.map(row => ts.flattenDiagnosticMessageText(row.messageText, '\n')), []);
  assert.equal((await (await import(pathToFileURL(path.join(ENGINE, 'qualification.mjs')))).verifyProcedure()).maximumPaidRequests, 8);
});
