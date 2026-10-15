import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawn, execFileSync } from 'node:child_process';

const root = '/work/chat', app = root + '/app', tooling = root + '/.tooling';
const stage = process.argv[2];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const owner = JSON.parse(await fs.readFile(root + '/.owner.json', 'utf8'));
assert.equal(owner.sessionId, 'e9b26cd6-1a6c-481d-b426-9f031c2e46e3');
assert.equal(process.versions.node, '24.15.0');
assert.equal(process.getuid(), 501);
const archivesDir = '/opt/archives';
const archiveRaw = await fs.readFile(archivesDir + '/manifest.json');
const manifest = JSON.parse(archiveRaw);
assert.equal(manifest.sourceCommit, '07f669e35cc3221c0411d1e4dfd790e4b95aa54d');
assert.equal(manifest.backend.files, 174);
assert.equal(manifest.backend.manifestSha256, '848227120ba1e8aab38bab28684a43d0f07232934dfabd178a507f1903facbdc');
const expectedArchives = {
  sdk: '6aee999b1d993670a15add3ca3f38a54534583c3fa837bf2834b598a8fb30f8c',
  cli: '847367abe21d000cd34b3bb59f1d7aadaacfbd8fdc3b36baf85baba822345f8b',
  provider: 'a1d9309a6d6175bc1779e5eee36a5afee0d846b47b23887a9038009bc71864f2',
  catalog: '1d01be513fa6f0f0f2cccc63bef02321366a88e641c11ed17c966d67aee843e4',
};
const archives = {};
for (const [role, hash] of Object.entries(expectedArchives)) {
  const entry = manifest.packages.find(item => item.role === role);
  assert.equal(entry.sha256, hash);
  archives[role] = path.join(archivesDir, entry.filename);
  assert.equal(sha(await fs.readFile(archives[role])), hash);
}
const runtime = JSON.parse(await fs.readFile('/work/runtime.json', 'utf8'));
assert.equal(runtime.sessionId, owner.sessionId);
assert.equal(runtime.deploymentName, 'agile-mink-589');
assert.equal(runtime.deploymentUrl, 'https://agile-mink-589.convex.cloud');
const publicEnv = {
  CONVEX_URL: runtime.deploymentUrl, NEXT_PUBLIC_CONVEX_URL: runtime.deploymentUrl,
  CORTEX_HTTP_URL: runtime.httpUrl, NEXT_PUBLIC_CORTEX_HTTP_URL: runtime.httpUrl,
  CORTEX_TENANT_ID: runtime.tenantId, NEXT_PUBLIC_CORTEX_TENANT_ID: runtime.tenantId,
  CORTEX_MEMORY_SPACE_ID: runtime.memorySpaceId, NEXT_PUBLIC_CORTEX_MEMORY_SPACE_ID: runtime.memorySpaceId,
  CORTEX_AGENT_ID: runtime.agentId, NEXT_PUBLIC_CORTEX_AGENT_ID: runtime.agentId,
  CORTEX_AGENT_VERSION: String(runtime.agentVersion), NEXT_PUBLIC_CORTEX_AGENT_VERSION: String(runtime.agentVersion),
  NEXT_TELEMETRY_DISABLED: '1',
};
const env = { ...process.env, ...publicEnv,
  PATH: tooling + '/bin:' + process.env.PATH,
  TMPDIR: tooling + '/tmp', npm_config_cache: tooling + '/npm-cache',
  npm_config_store_dir: tooling + '/pnpm-store', XDG_CACHE_HOME: tooling + '/cache',
  XDG_DATA_HOME: tooling + '/data', XDG_STATE_HOME: tooling + '/state',
  PNPM_HOME: tooling + '/pnpm-home', COREPACK_HOME: tooling + '/corepack',
  npm_config_userconfig: '/dev/null', npm_config_update_notifier: 'false',
  npm_config_audit: 'false', npm_config_fund: 'false', CI: '1',
};
for (const name of Object.keys(env)) {
  if (/^(?:CONVEX_DEPLOY_KEY|CONVEX_DEPLOYMENT|CORTEX_APP_DEPLOYMENT_ADMIN_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY|AI_GATEWAY_API_KEY|AI_GATEWAY_VERCEL_TOKEN|CORTEX_SESSION_TOKEN|AUTH_SECRET)$/.test(name)) delete env[name];
}
const secrets = [];
const redact = value => {
  let text = String(value);
  for (const secret of secrets) text = text.split(secret).join('[REDACTED]');
  return text.replace(/\b(?:dev|prod|preview):[a-z0-9-]+\|[^\s"'\\]+/g, '[REDACTED_DEPLOY_KEY]')
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_JWT]');
};
const results = [];
async function run(name, executable, args, childEnv = env, cwd = app) {
  const started = Date.now(); let stdout = '', stderr = '', timedOut = false;
  const child = spawn(executable, args, { cwd, env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  const timer = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); }, name === 'install' ? 600000 : 300000);
  const result = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', (code, signal) => resolve({ code, signal })); });
  clearTimeout(timer);
  const receipt = { name, executable, args, cwd, ...result, elapsedMs: Date.now() - started,
    timedOut, naturalExit: !timedOut && result.signal === null, stdout: redact(stdout), stderr: redact(stderr),
    node: process.versions.node, modelCalls: 0, deployments: 0 };
  await fs.writeFile(tooling + '/receipts/' + name + '.json', JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  await fs.writeFile(tooling + '/receipts/' + name + '.log', receipt.stdout + '\n' + receipt.stderr, { flag: 'wx', mode: 0o600 });
  results.push(receipt);
  console.log(JSON.stringify({ stage: name, code: result.code, naturalExit: receipt.naturalExit, elapsedMs: receipt.elapsedMs }));
  assert.equal(result.code, 0, name + ' failed; see retained stage receipt');
  assert.equal(receipt.naturalExit, true);
  return receipt;
}
async function packageInfo(name) {
  const require = createRequire(app + '/package.json');
  let directory = path.dirname(require.resolve(name));
  for (;;) {
    try {
      const pkg = JSON.parse(await fs.readFile(path.join(directory, 'package.json'), 'utf8'));
      if (pkg.name === name) return { version: pkg.version, directory };
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const parent = path.dirname(directory); assert.notEqual(parent, directory); directory = parent;
  }
}
async function snapshot() {
  const names = ['convex.json', 'convex/tsconfig.json', 'tsconfig.json', 'next.config.ts', 'package.json', 'pnpm-lock.yaml',
    ...(await fs.readdir(app)).filter(name => name.startsWith('.env'))];
  const files = [];
  for (const name of names.sort()) {
    const bytes = await fs.readFile(path.join(app, name));
    files.push({ path: name, sha256: sha(bytes), bytes: bytes.length });
  }
  return files;
}
async function assertInstalledState(state) {
  assert.equal(state.sourceCommit, manifest.sourceCommit);
  assert.equal(state.installId, owner.installId);
  const sdkManifest = await fs.readFile(path.join(state.packages['@cortexmemory/sdk'].directory, 'dist/backend/v1/manifest.json'));
  assert.equal(sha(sdkManifest), manifest.backend.manifestSha256);
  const backend = JSON.parse(sdkManifest);
  assert.equal(backend.files.length, 174);
  for (const file of backend.files) assert.equal(sha(await fs.readFile(path.join(app, 'convex', file.path))), file.sha256, file.path);
  assert.deepEqual(JSON.parse(await fs.readFile(app + '/convex/tsconfig.json', 'utf8')).compilerOptions.lib, ['ES2021', 'DOM']);
  assert.deepEqual(await snapshot(), state.protectedFiles);
  return backend;
}
if (stage === 'prepare') {
  assert.equal(execFileSync('npm', ['--version'], { encoding: 'utf8', env }).trim(), '12.2.0');
  await assert.rejects(fs.access(app), error => error.code === 'ENOENT');
  for (const directory of ['bin', 'tmp', 'receipts', 'npm-cache', 'pnpm-store', 'cache', 'pnpm-tool', 'data', 'state', 'pnpm-home', 'corepack'])
    await fs.mkdir(path.join(tooling, directory), { mode: 0o700, recursive: true });
  await fs.mkdir(app, { mode: 0o700 });
  const cli = '/opt/cortex/node_modules/@cortexmemory/cli';
  assert.equal(JSON.parse(await fs.readFile(cli + '/package.json', 'utf8')).version, '0.39.0');
  const { resolveTemplateCatalog, selectResolvedTemplate } = await import(cli + '/dist/utils/templates/resolver.js');
  const catalog = await resolveTemplateCatalog(archives.catalog, { catalogVersion: '1.4.0' });
  const selected = selectResolvedTemplate(catalog, 'chat-sdk', '1.5.0');
  assert.equal(selected.template.payloadHash, '6512666f75fa4907908eeaa612d27a46d806678bf278f2c649c693ac4e58f2a9');
  assert.equal(selected.files.size, 261);
  for (const [name, file] of selected.files) {
    const target = path.join(app, name); assert.ok(target.startsWith(app + '/'));
    await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
    await fs.writeFile(target, file.bytes, { flag: 'wx', mode: file.executable ? 0o755 : 0o644 });
  }
  await run('pnpm-tool', 'npm', ['install', '--prefix', tooling + '/pnpm-tool', '--ignore-scripts', '--no-audit', '--no-fund', 'pnpm@10.33.0']);
  await fs.writeFile(tooling + '/bin/pnpm', '#!/bin/sh\nexec /usr/local/bin/node /work/chat/.tooling/pnpm-tool/node_modules/pnpm/bin/pnpm.cjs "$@"\n', { flag: 'wx', mode: 0o700 });
  assert.equal(execFileSync('pnpm', ['--version'], { cwd: app, env, encoding: 'utf8' }).trim(), '10.33.0');
  await run('install', process.execPath, [tooling + '/install-ci-demo.mjs', '--directory', app, '--sdk-archive', archives.sdk,
    '--provider-archive', archives.provider, '--cli-source', cli]);
  await assert.rejects(fs.access(app + '/convex/_generated'), error => error.code === 'ENOENT');
  await fs.writeFile(app + '/.env.local', Object.entries(publicEnv).map(([name, value]) => name + '=' + value).join('\n') + '\n', { flag: 'wx', mode: 0o600 });
  const packages = {};
  for (const name of ['@cortexmemory/sdk', '@cortexmemory/vercel-ai-provider', 'convex', 'typescript', 'next']) packages[name] = await packageInfo(name);
  assert.equal(packages['@cortexmemory/sdk'].version, '0.39.0');
  assert.equal(packages['@cortexmemory/vercel-ai-provider'].version, '0.39.0');
  const providerRequire = createRequire(path.join(packages['@cortexmemory/vercel-ai-provider'].directory, 'package.json'));
  assert.equal(await fs.realpath(providerRequire.resolve('@cortexmemory/sdk')), await fs.realpath(createRequire(app + '/package.json').resolve('@cortexmemory/sdk')));
  const catalogFiles = [...selected.files].map(([name, file]) => ({ path: name, expectedSha256: sha(file.bytes) }));
  const ordinaryInstallerChanges = [];
  for (const file of catalogFiles) if (sha(await fs.readFile(path.join(app, file.path))) !== file.expectedSha256) ordinaryInstallerChanges.push(file.path);
  assert.deepEqual(ordinaryInstallerChanges.sort(), ['convex/schema.ts', 'package.json']);
  const state = { sourceCommit: manifest.sourceCommit, installId: owner.installId, sessionId: owner.sessionId, app, packages,
    catalog: { version: catalog.packageVersion, templateVersion: selected.template.version, payloadHash: selected.template.payloadHash, files: selected.files.size },
    archiveManifestSha256: sha(archiveRaw), archiveSha256: expectedArchives, backendManifestSha256: manifest.backend.manifestSha256,
    catalogFiles, ordinaryInstallerChanges, protectedFiles: await snapshot(), publicEnv,
    generatedBindingsBeforeCodegen: 'ABSENT', npm: '12.2.0', pnpm: '10.33.0', node: process.versions.node };
  await assertInstalledState(state);
  await fs.writeFile(tooling + '/state.json', JSON.stringify(state, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ state: 'GENUINE_CHAT_INSTALLED', catalog: state.catalog, packages, ordinaryInstallerChanges }));
} else {
  const state = JSON.parse(await fs.readFile(tooling + '/state.json', 'utf8'));
  const backend = await assertInstalledState(state);
  if (stage === 'codegen') {
    await assert.rejects(fs.access(app + '/convex/_generated'), error => error.code === 'ENOENT');
    const keyPath = '/run/cortex-secrets/dev-deploy-key.txt', stat = await fs.lstat(keyPath);
    assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.uid === process.getuid() && (stat.mode & 0o077) === 0);
    const key = (await fs.readFile(keyPath, 'utf8')).trim();
    assert.ok(key.startsWith('dev:agile-mink-589|')); secrets.push(key);
    await run('codegen', process.execPath, [state.packages.convex.directory + '/bin/main.js', 'codegen', '--typecheck', 'enable'],
      { ...env, CONVEX_DEPLOYMENT: 'dev:agile-mink-589', CONVEX_DEPLOY_KEY: key });
  } else if (stage === 'types') {
    await run('types', process.execPath, [state.packages.typescript.directory + '/bin/tsc', '--noEmit']);
  } else if (stage === 'build') {
    const buildSecret = randomBytes(48).toString('base64url'); secrets.push(buildSecret);
    await run('build', 'pnpm', ['run', 'build'], { ...env, AUTH_SECRET: buildSecret });
  } else throw Error('Unknown bounded stage');
  await assertInstalledState(state);
  const generated = [];
  for (const name of (await fs.readdir(app + '/convex/_generated')).sort()) {
    const bytes = await fs.readFile(app + '/convex/_generated/' + name);
    generated.push({ path: name, bytes: bytes.length, sha256: sha(bytes) });
  }
  assert.equal(generated.length, 5);
  const summary = { stage, state: stage.toUpperCase() + '_PASS', sourceCommit: manifest.sourceCommit,
    sessionId: owner.sessionId, installId: owner.installId, app, generated, backendFilesUnchanged: backend.files.length,
    protectedConfigChanges: [], results, modelCalls: 0, deployments: 0, serverStarted: false };
  await fs.writeFile(tooling + '/receipts/' + stage + '-summary.json', JSON.stringify(summary, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ state: summary.state, generatedFiles: generated.length, backendFilesUnchanged: backend.files.length }));
}
