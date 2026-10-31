import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { IMAGE_ID, PREVIOUS_IMAGE_ID, PRIOR_LATENCY_IMAGE_ID, PRIOR_WORKFLOW_IMAGE_ID, PRIOR_EARLY_TEXT_IMAGE_ID, PRIOR_JSON_CONTEXT_IMAGE_ID, PRIOR_COMPOSED_IMAGE_ID, PRIOR_COMPACT_VECTOR_IMAGE_ID, PRIOR_CONTEXT_TRANSACTION_IMAGE_ID, PRIOR_QUERY_COMPOSITION_IMAGE_ID, PRIOR_AUTHORITY_ROUTING_IMAGE_ID, PRIOR_IMMEDIATE_START_IMAGE_ID, PRIOR_PARALLEL_POLICY_IMAGE_ID, PRIOR_TURN_CONSOLIDATION_IMAGE_ID, PRIOR_TRANSCRIPT_READER_IMAGE_ID, SOURCE_COMMIT, LABEL, assertPinnedCandidate, expectedContainer, assertOwnedContainer, createDocker, removeDocker, configureApps, selectPorts, verifyArtifacts, preflightDocker } from './docker.mjs';
import { createContext, formatHandoff, newSession } from './runner.mjs';
import { verifyProcedure } from './qualification.mjs';

const kit = path.resolve(import.meta.dirname, '../manual-sandbox-latency-progress-source-batch-2026-10-13');
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cortex-local-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const session = await newSession(root, 'smoke'); session.ports = { web: 3190, basic: 3191 };
  return session;
}
function info(session, id = 'a'.repeat(64)) {
  const expected = expectedContainer(session);
  return { Id: id, Name: '/' + expected.name, Image: expected.imageId, Config: { Labels: expected.labels }, State: { Running: true } };
}
function dockerContext(session) {
  const calls = [], receipts = []; let present = false;
  const ctx = { docker: 'fake-docker', calls, receipts, persist: async () => {}, registerSecret: () => {}, receipt: async (name, data) => receipts.push({ name, data }),
    command: async (name, executable, args) => { calls.push({ name, executable, args });
      if (name === 'docker-find-owned') return { stdout: present ? 'a'.repeat(64) + '\n' : '' };
      if (name === 'docker-inspect-owned') return { stdout: JSON.stringify([info(session)]) };
      if (name === 'docker-create') present = true;
      if (name === 'docker-remove') present = false;
      return { code: 0, stdout: '', stderr: '' }; } };
  return ctx;
}

test('candidate artifacts refuse unready pins or verify accepted archive identities and reject copied mutation', async t => {
  try { assertPinnedCandidate(); } catch (error) {
    assert.match(error.message, /candidate is unready/); await assert.rejects(verifyArtifacts(kit), /candidate is unready/);
    const session = await fixture(t), ctx = dockerContext(session);
    await assert.rejects(preflightDocker(session, { ...ctx, kit }), /candidate is unready/); assert.equal(ctx.calls.length, 0); return;
  }
  const actual = await verifyArtifacts(kit);
  assert.equal(actual.imageId, IMAGE_ID); assert.deepEqual(actual.packages, ['sdk', 'cli', 'provider', 'catalog']);
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cortex-artifact-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'image', 'archives'), { recursive: true });
  await fs.cp(path.join(kit, 'image', 'archives'), path.join(root, 'image', 'archives'), { recursive: true });
  await fs.appendFile(path.join(root, 'image', 'archives', 'cortexmemory-sdk-0.39.0.tgz'), 'changed');
  await assert.rejects(verifyArtifacts(root), /archive hash differs/);
});
test('fresh loopback port pairs are distinct and limited to selected sandbox range', async () => {
  const result = await selectPorts();
  assert.ok(result.web >= 3100 && result.web <= 3458); assert.equal(result.basic, result.web + 1);
});
test('container ownership requires exact session UUID/root/name/image/id, never only a label', async t => {
  const session = await fixture(t), original = info(session); session.container = { id: original.Id };
  assert.doesNotThrow(() => assertOwnedContainer(session, original));
  for (const wrong of [ { ...original, Id: 'b'.repeat(64) }, { ...original, Name: '/other' }, { ...original, Image: 'sha256:other' },
    { ...original, Config: { Labels: { ...original.Config.Labels, [`${LABEL}.root`]: '/other' } } },
    { ...original, Config: { Labels: { ...original.Config.Labels, [LABEL]: randomUUID() } } } ]) assert.throws(() => assertOwnedContainer(session, wrong), /ownership/);
});
test('fresh Docker refuses unready candidates or journals exact intent, own mounts and cleanup', async t => {
  const session = await fixture(t), ctx = dockerContext(session);
  try { assertPinnedCandidate(); } catch (error) {
    assert.match(error.message, /candidate is unready/); await assert.rejects(createDocker(session, ctx), /candidate is unready/);
    assert.equal(ctx.calls.length, 0); assert.equal(session.container, null); return;
  }
  await createDocker(session, ctx);
  assert.equal(session.container.id, 'a'.repeat(64)); assert.equal(session.containerIntent.name, expectedContainer(session).name);
  const create = ctx.calls.find(call => call.name === 'docker-create').args;
  assert.equal(create.at(-1), IMAGE_ID);
  const mounts = create.flatMap((value, index) => value === '--mount' ? [create[index + 1]] : []);
  assert.deepEqual(mounts, [`type=bind,source=${session.workspace},target=/work`, `type=bind,source=${session.secretsDir},target=/run/cortex-secrets,readonly`]);
  assert.ok(!create.join(' ').includes(session.issuerDir)); assert.ok(!create.join(' ').includes(session.backendDir));
  assert.ok(!create.join(' ').includes('docker.sock')); assert.ok(!create.join(' ').includes('.convex'));
  assert.ok(create.includes('ALL')); assert.ok(create.includes('no-new-privileges')); assert.ok(create.includes('4g'));
  assert.ok(create.includes('127.0.0.1:3190:3000')); assert.ok(create.includes('127.0.0.1:3191:3001'));
  await assert.rejects(createDocker(session, ctx), /already exists/);
  await removeDocker(session, ctx); await removeDocker(session, ctx);
  assert.equal(ctx.calls.filter(call => call.name === 'docker-remove').length, 1);
  assert.deepEqual(ctx.calls.find(call => call.name === 'docker-remove').args, ['container', 'rm', '--force', 'a'.repeat(64)]);
  assert.equal(session.containerRemoved, true);
});
test('Docker identity drift refuses mutation while preserving the specific foreign container', async t => {
  const session = await fixture(t); session.container = { id: 'a'.repeat(64) };
  const calls = [], ctx = { docker: 'fake', command: async (name, executable, args) => { calls.push(args);
    return { stdout: name === 'docker-find-owned' ? 'a'.repeat(64) : JSON.stringify([{ ...info(session), Image: 'wrong' }]) }; } };
  await assert.rejects(removeDocker(session, ctx), /ownership/);
  assert.ok(!calls.some(args => args.includes('rm')));
});
for (const traceMode of ['disabled', 'new-trace', 'old-trace', 'prior-latency-trace', 'prior-workflow-trace']) test(`fresh app configure preserves scoped candidate/origin guards with ${traceMode}`, async t => {
  const session = await fixture(t); session.target = { name: 'new-test-123', teamId: 325340, projectId: 777 };
  session.publicRuntime = { teamId: 325340, projectId: 777, deploymentName: session.target.name, deploymentUrl: 'https://new-test-123.convex.cloud', httpUrl: 'https://new-test-123.convex.site',
    tenantId: 'new-tenant', memorySpaceId: 'manual-space', agentId: 'agent:new', agentVersion: 1 };
  session.container = { ...expectedContainer(session), id: 'a'.repeat(64) };
  if (traceMode === 'old-trace') session.container.imageId = PREVIOUS_IMAGE_ID;
  if (traceMode === 'prior-latency-trace') session.container.imageId = PRIOR_LATENCY_IMAGE_ID;
  if (traceMode === 'prior-workflow-trace') session.container.imageId = PRIOR_WORKFLOW_IMAGE_ID;
  await fs.writeFile(session.deploymentKeyPath, 'dev:new-test-123|private-key-fixture', { mode: 0o600 });
  const ctx = dockerContext(session), original = ctx.command; ctx.latencyTrace = traceMode !== 'disabled';
  ctx.command = async (name, executable, args, options) => {
    if (name === 'docker-find-owned') return { stdout: session.container.id };
    if (name === 'docker-inspect-owned') return { stdout: JSON.stringify([info(session)]) };
    if (name.startsWith('scaffold-')) { const app = name.slice(9), appDir = path.join(session.workspace, app); await fs.mkdir(appDir);
      if (app === 'demo') await fs.writeFile(path.join(appDir, 'next.config.js'), 'const nextConfig = {\n};\nmodule.exports = nextConfig;\n'); }
    if (name === 'local-versions') { ctx.calls.push({ name, args }); return { stdout: JSON.stringify({ node: 'v24.15.0', sdk: '0.39.0', provider: '0.39.0' }) }; }
    return original(name, executable, args, options);
  };
  await configureApps(session, ctx);
  for (const app of ['basic', 'demo']) {
    const file = path.join(session.workspace, app, 'cortex.config.json'), config = JSON.parse(await fs.readFile(file, 'utf8'));
    assert.equal((await fs.stat(file)).mode & 0o777, 0o600);
    assert.equal(config.deployments.sandbox.url, session.publicRuntime.deploymentUrl);
    assert.equal(config.deployments.sandbox.tokenFile, '/run/cortex-secrets/owner.jwt');
    const env = await fs.readFile(path.join(session.workspace, app, '.env.local'), 'utf8');
    const flag = app === 'basic' ? 'CORTEX_RUNTIME_LATENCY_TRACE' : 'NEXT_PUBLIC_CORTEX_LATENCY_TRACE';
    assert.equal(env.includes(`${flag}=\"1\"`), traceMode === 'new-trace');
    assert.ok(!env.includes(app === 'basic' ? 'NEXT_PUBLIC_CORTEX_LATENCY_TRACE' : '\nCORTEX_RUNTIME_LATENCY_TRACE'));
    const installed = ctx.calls.find(call => call.name === 'install-' + app).args;
    assert.ok(installed.includes('--ignore-scripts')); assert.ok(!installed.includes('deploy'));
  }
  const basic = ctx.calls.find(call => call.name === 'scaffold-basic').args, demo = ctx.calls.find(call => call.name === 'scaffold-demo').args;
  assert.ok(basic.includes('--no-deploy'));
  for (const args of [basic, demo]) { assert.equal(args[args.indexOf('--catalog-version') + 1], '1.3.1'); assert.ok(args.includes('/opt/archives/cortexmemory-templates-1.3.1.tgz')); }
  assert.equal(basic[basic.indexOf('--template-version') + 1], '1.4.1'); assert.equal(demo[demo.indexOf('--template-version') + 1], '1.4.1');
  assert.ok(ctx.calls.find(call => call.name === 'scaffold-demo').args.includes('--no-install'));
  assert.match(await fs.readFile(path.join(session.workspace, 'demo', 'next.config.js'), 'utf8'), /allowedDevOrigins: \["127\.0\.0\.1"\]/);
  const bad = { ...session, publicRuntime: { ...session.publicRuntime, deploymentName: 'other-db' } };
  await assert.rejects(configureApps(bad, ctx), /not bound/);
});

test('future candidate and legacy dependency paths stay separate; handoff names the canonical interactive chat', async t => {
  const session = await fixture(t), ctx = await createContext(session, { logger: () => {} });
  assert.equal(ctx.kit, kit); assert.equal(ctx.dependenciesDir, path.resolve(import.meta.dirname, '../manual-sandbox-2026-10-12/workspace/backend/node_modules'));
  session.target = { name: 'new-owned-db' }; session.container = { name: expectedContainer(session).name };
  const handoff = formatHandoff(session);
  assert.ok(handoff.includes('http://127.0.0.1:3190')); assert.ok(handoff.includes(`docker exec -it --workdir /work/basic ${session.container.name} npm start`));
  assert.ok(handoff.includes(`docker exec --workdir /work/basic ${session.container.name} cortex --help`)); assert.ok(!handoff.includes('jwt'));
});
for (const previousImage of [PREVIOUS_IMAGE_ID, PRIOR_LATENCY_IMAGE_ID, PRIOR_WORKFLOW_IMAGE_ID, PRIOR_EARLY_TEXT_IMAGE_ID, PRIOR_JSON_CONTEXT_IMAGE_ID, PRIOR_COMPOSED_IMAGE_ID, PRIOR_COMPACT_VECTOR_IMAGE_ID, PRIOR_CONTEXT_TRANSACTION_IMAGE_ID, PRIOR_QUERY_COMPOSITION_IMAGE_ID, PRIOR_AUTHORITY_ROUTING_IMAGE_ID, PRIOR_IMMEDIATE_START_IMAGE_ID, PRIOR_PARALLEL_POLICY_IMAGE_ID, PRIOR_TURN_CONSOLIDATION_IMAGE_ID, PRIOR_TRANSCRIPT_READER_IMAGE_ID]) test(`known prior-image ${previousImage.slice(7, 15)} keeps exact cleanup; arbitrary/conflicting journals refuse`, async t => {
  const session = await fixture(t); session.container = { ...expectedContainer(session), imageId: previousImage, id: 'a'.repeat(64) };
  session.containerIntent = { ...session.container }; const original = info(session);
  assert.equal(expectedContainer(session).imageId, previousImage); assert.doesNotThrow(() => assertOwnedContainer(session, original));
  const ctx = dockerContext(session); let present = true;
  const command = ctx.command;
  ctx.command = async (name, executable, args) => {
    if (name === 'docker-find-owned') return { stdout: present ? session.container.id : '' };
    if (name === 'docker-inspect-owned') return { stdout: JSON.stringify([original]) };
    if (name === 'docker-remove') present = false;
    return command(name, executable, args);
  };
  await assert.rejects(createDocker(session, ctx), /Fresh Docker creation refuses an old session image/); assert.equal(ctx.calls.length, 0);
  await removeDocker(session, ctx); assert.equal(session.containerRemoved, true); assert.equal(ctx.calls.filter(call => call.name === 'docker-remove').length, 1);
  assert.throws(() => expectedContainer({ ...session, container: { ...session.container, imageId: 'sha256:' + 'f'.repeat(64) } }), /journal differs|unreviewed image/);
  assert.throws(() => expectedContainer({ ...session, containerIntent: { ...session.containerIntent, imageId: IMAGE_ID } }), /journal differs/);
  assert.throws(() => assertOwnedContainer(session, { ...original, Image: IMAGE_ID }), /ownership/);
});
test('procedure source hash gates still reject changed controls until a separate accepted approval is supplied', async () => {
  const root = import.meta.dirname, approval = JSON.parse(await fs.readFile(path.join(root, 'procedure-approval.json'), 'utf8'));
  let changed = false;
  for (const row of approval.files) if (createHash('sha256').update(await fs.readFile(path.resolve(root, row.path))).digest('hex') !== row.sha256) changed = true;
  if (approval.maximumPaidRequests !== 8) await assert.rejects(verifyProcedure(), /Approved procedure fixed request ceiling changed/);
  else if (approval.maximumUnknownLiabilityUnits !== 2700000) await assert.rejects(verifyProcedure(), /Approved procedure fixed liability ceiling changed/);
  else if (changed) await assert.rejects(verifyProcedure(), /Approved procedure source changed/);
  else assert.match((await verifyProcedure()).digest, /^[a-f0-9]{64}$/);
});

test('only the exact launcher trace opt-in reaches context; other inherited values remain disabled', async t => {
  const original = process.env.CORTEX_RUNTIME_LATENCY_TRACE;
  t.after(() => { if (original === undefined) delete process.env.CORTEX_RUNTIME_LATENCY_TRACE; else process.env.CORTEX_RUNTIME_LATENCY_TRACE = original; });
  const session = await fixture(t);
  for (const flag of [undefined, '0', 'true', '1']) {
    if (flag === undefined) delete process.env.CORTEX_RUNTIME_LATENCY_TRACE; else process.env.CORTEX_RUNTIME_LATENCY_TRACE = flag;
    assert.equal((await createContext(session, { logger: () => {} })).latencyTrace, flag === '1');
  }
});
test('candidate manifest/source/count drift refuses before any Docker call', async t => {
  assertPinnedCandidate();
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cortex-manifest-drift-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'image/archives'), { recursive: true });
  const original = JSON.parse(await fs.readFile(path.join(kit, 'image/archives/manifest.json'), 'utf8'));
  const session = await fixture(t), ctx = dockerContext(session);
  for (const field of ['sourceCommit', 'files', 'manifestSha256', 'allSourceOutputHashesMatch']) {
    const manifest = structuredClone(original);
    if (field === 'sourceCommit') manifest.sourceCommit = 'f'.repeat(40);
    else manifest.backend[field] = field === 'files' ? original.backend.files + 1 : field === 'manifestSha256' ? 'f'.repeat(64) : false;
    await fs.writeFile(path.join(root, 'image/archives/manifest.json'), JSON.stringify(manifest));
    await assert.rejects(preflightDocker(session, { ...ctx, kit: root }), /source\/artifact manifest differs/);
  }
  assert.equal(ctx.calls.length, 0);
});
test('new image preflight binds actual local artifacts and rejects controlled image/owner/label drift', async t => {
  const session = await fixture(t), identity = JSON.parse(await fs.readFile(path.join(kit, 'identity.json'), 'utf8'));
  const image = { Id: IMAGE_ID, Os: 'linux', Architecture: 'arm64', Config: { User: 'sandbox', Labels: { 'dev.cortex.manual-sandbox': identity.id, 'dev.cortex.manual-sandbox.path': kit } } };
  const receipts = [], ctx = { kit, docker: 'controlled-no-docker', command: async () => ({ stdout: JSON.stringify([image]) }), receipt: async (name, data) => receipts.push({ name, data }) };
  await preflightDocker(session, ctx); assert.equal(receipts[0].data.artifacts.sourceCommit, SOURCE_COMMIT);
  for (const fault of ['image', 'owner', 'label']) {
    const changed = structuredClone(image);
    if (fault === 'image') changed.Id = PREVIOUS_IMAGE_ID;
    if (fault === 'owner') changed.Config.User = 'root';
    if (fault === 'label') changed.Config.Labels['dev.cortex.manual-sandbox.path'] = '/other-kit';
    await assert.rejects(preflightDocker(session, { ...ctx, command: async () => ({ stdout: JSON.stringify([changed]) }) }), /image or ownership differs/);
  }
});
