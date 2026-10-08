/** Explicitly owned disposable fixture update. General installer collision policy remains unchanged. */
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir, access} from 'node:fs/promises';
import {join, dirname, normalize} from 'node:path';
import {spawn} from 'node:child_process';
import {openOwnedContext, q, sha} from './common.mjs';

const context = await openOwnedContext();
try {
  await context.verifyTarget('install-current1-target-verified');
  const prior = JSON.parse(await readFile(join(q, 'installed-baseline-source-manifest1.json'), 'utf8'));
  const packed = JSON.parse(await readFile(join(q, 'packed-sdk-current1.json'), 'utf8'));
  assert.equal(sha(await readFile(packed.file)), packed.sha256);
  const manifestBytes = await readFile(join(packed.unpackedBackend, 'manifest.json'));
  assert.equal(sha(manifestBytes), packed.manifestSha256);
  const incoming = JSON.parse(manifestBytes), functions = join(context.host, context.functionsDirectory);
  assert.deepEqual(incoming.components, ['agent', 'workflow']);
  const safe = path => {
    assert.ok(!path.startsWith('/') && normalize(path) === path && !path.split('/').includes('..'));
    return path;
  };
  const previous = new Map(prior.files.map(row => [row.path, row]));
  const next = new Map(incoming.files.map(row => [safe(row.path), row]));
  assert.equal(next.size, incoming.files.length, 'Duplicate distributed path');
  for (const row of previous.values()) {
    assert.ok(next.has(row.path), 'No unreviewed deletion of prior owned source: ' + row.path);
    assert.equal(sha(await readFile(join(functions, row.path))), row.sha256, 'Owned preimage changed: ' + row.path);
  }
  // Task11 has no model qualification/financial-root change.
  for (const path of ['runtimeGatewayQualifications.ts', 'runtimeModelPolicyBootstrap.ts']) {
    assert.equal(next.get(path)?.sha256, previous.get(path)?.sha256, 'Task10 shipped9 lookup must remain exact');
  }
  const protectedPaths = ['convex.json', 'custom/backend/host.ts', 'custom/backend/hostNode.ts',
    'custom/backend/http.ts', 'custom/backend/auth.config.ts', 'custom/backend/convex.config.ts', 'custom/backend/schema.ts'];
  const preserved = await Promise.all(protectedPaths.map(async path => ({path, sha256: sha(await readFile(join(context.host, path)))})));
  const changed = incoming.files.filter(row => previous.get(row.path)?.sha256 !== row.sha256);
  const preimages = [];
  for (const row of changed) {
    if (previous.has(row.path)) {
      const bytes = await readFile(join(functions, row.path));
      preimages.push({path: row.path, bytes: bytes.length, sha256: sha(bytes), source: bytes.toString('utf8')});
    } else {
      let exists = true; try {await access(join(functions, row.path));} catch (error) {if (error.code === 'ENOENT') exists = false; else throw error;}
      assert.equal(exists, false, 'New distributed source collides with an existing host file: ' + row.path);
    }
  }
  await context.publish('install-current1-preimages', {preimages, preserved,
    changedPaths: changed.map(row => row.path), explicitOwnedFixturePatch: true,
    generalProductInstallerOverwriteEnabled: false});
  const npm = '/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/npm/bin/npm-cli.js';
  const args = [npm, 'install', packed.file, '--ignore-scripts', '--no-audit', '--no-fund'];
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    ['HOME', 'PATH', 'TMPDIR', 'SHELL', 'LANG', 'LC_ALL', 'TERM', 'NO_COLOR', 'CI'].includes(key)));
  env.PATH = dirname(process.execPath) + ':' + env.PATH;
  const began = Date.now(), child = spawn(process.execPath, args, {cwd: context.host, env,
    detached: true, stdio: ['ignore', 'pipe', 'pipe']});
  let stdout = '', stderr = '', closed = false, timedOut = false;
  child.stdout.on('data', bytes => {stdout += bytes;}); child.stderr.on('data', bytes => {stderr += bytes;});
  const signal = name => {if (!closed) try {process.kill(-child.pid, name);} catch {}};
  const timer = setTimeout(() => {timedOut = true; signal('SIGTERM');}, 120000);
  const hard = setTimeout(() => {if (timedOut) signal('SIGKILL');}, 125000);
  let exit;
  try {exit = await new Promise((resolve, reject) => {
    child.once('error', reject); child.once('close', (code, signal) => {closed = true; resolve({code, signal});});
  });} finally {clearTimeout(timer); clearTimeout(hard);}
  await writeFile(join(q, 'install-current1.stdout.log'), context.redact(stdout), {flag: 'wx'});
  await writeFile(join(q, 'install-current1.stderr.log'), context.redact(stderr), {flag: 'wx'});
  await context.publish('install-current1', {executable: process.execPath, args, cwd: context.host,
    pid: child.pid, ...exit, timedOut, childClosed: closed, elapsedMs: Date.now() - began, deadlineMs: 120000});
  assert.equal(timedOut, false); assert.equal(exit.code, 0, context.redact(stderr).slice(-4000));
  assert.equal(sha(await readFile(join(context.host, 'node_modules/@cortexmemory/sdk/dist/backend/v1/manifest.json'))), packed.manifestSha256);
  for (const row of changed) {
    await mkdir(dirname(join(functions, row.path)), {recursive: true});
    const bytes = await readFile(join(packed.unpackedBackend, row.path)); assert.equal(sha(bytes), row.sha256);
    await writeFile(join(functions, row.path), bytes);
  }
  const qaSource = await readFile(join(q, 'graphNative.ts'));
  const qaPath = join(functions, 'graphNative.ts');
  let qaExists = true; try {await access(qaPath);} catch (error) {if (error.code === 'ENOENT') qaExists = false; else throw error;}
  assert.equal(qaExists, false, 'Do not overwrite an earlier QA fixture');
  await writeFile(qaPath, qaSource, {flag: 'wx'});
  for (const row of preserved) assert.equal(sha(await readFile(join(context.host, row.path))), row.sha256);
  const files = [];
  for (const row of incoming.files) {
    const bytes = await readFile(join(functions, row.path)); assert.equal(sha(bytes), row.sha256);
    files.push({path: row.path, bytes: bytes.length, sha256: sha(bytes)});
  }
  await context.publish('installed-current1-source-manifest', {status: 'PASS', projectId: context.state.projectId,
    packed, files, preserved, qa: {path: 'graphNative.ts', bytes: qaSource.length, sha256: sha(qaSource)},
    changedPaths: changed.map(row => row.path), tables: incoming.tables, default9QualificationLookupExact: true,
    priorFinancialAccountsChanged: false, noServiceMutationByInstall: true, enabledDeploymentPending: true});
  console.log(JSON.stringify({status: 'FIXTURE_INSTALLED', files: files.length, tables: incoming.tables.length,
    changedPaths: changed.length, preservedHostFiles: preserved.length}));
} finally {await context.close();}
