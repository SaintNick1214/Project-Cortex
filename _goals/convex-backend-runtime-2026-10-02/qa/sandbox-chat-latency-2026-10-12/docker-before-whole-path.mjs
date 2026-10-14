/** Local resources for a single journaled disposable sandbox. No global prune or shared kit edits. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import net from 'node:net';

// Replace only with the independently accepted new capsule's exact receipts.
export const IMAGE_ID = 'sha256:910746b1165ef87f6ef10da25a391b7b9889f9804a625c2af0f1af90c16038ac';
export const SOURCE_COMMIT = '126231a0102936998837dd14a64a77d2b4d09785';
export const BACKEND_MANIFEST_SHA256 = 'b808915a043e50d1827f4c41d64a05e32f8405c79826c449239cb6615ebe6663';
export const BACKEND_FILE_COUNT = 158;
export const PREVIOUS_IMAGE_ID = 'sha256:921e859ec3de043d081070de08e810440ed26b774a2cbe15fad1d239f452b2f7';
export const PRIOR_LATENCY_IMAGE_ID = 'sha256:6d69abc7d180131b64f41834050ba10c715c96bb32dfcb8fe397bcfe5ebe0126';
export const PRIOR_WORKFLOW_IMAGE_ID = 'sha256:0a6a273996eced19bcbe4325b850a96fe6ffe62e24053ab9082761936db3cf05';
export const PRIOR_EARLY_TEXT_IMAGE_ID = 'sha256:7c722812b834247e6328e87c70c37224dae0d0c2ce27c75b42fbb82713e977fc';
export const PRIOR_JSON_CONTEXT_IMAGE_ID = 'sha256:374c36e2ad6ad56045d4073e516caa29c904e026c2f3ed52f632a228005555cc';
export const PRIOR_COMPOSED_IMAGE_ID = 'sha256:b4459d791a584e4997de42c3c9669b000547e7f96e5c30d6abb9c6fb49f8afbf';
export const PRIOR_COMPACT_VECTOR_IMAGE_ID = 'sha256:dc90698021d55918e6b301fc9b3de5abdc08260b66a1093bcf77418801520ead';
export const PRIOR_CONTEXT_TRANSACTION_IMAGE_ID = 'sha256:7b80b75968ab80ee5ffff058a119eaff79ae5dd007fcdb0d7eb2a7724fdc1663';
export const PRIOR_QUERY_COMPOSITION_IMAGE_ID = 'sha256:48563409a20b1362e4dab416c4477877d292cb49f981c1edff65f5f6dd4e3c48';
export const PRIOR_AUTHORITY_ROUTING_IMAGE_ID = 'sha256:7a933ed4cb36c1951f9e338e4fda3f4c804eaed4f873e447e2749f2f64e82ef1';
export const PRIOR_IMMEDIATE_START_IMAGE_ID = 'sha256:4155c4f494de20db78117d27898455c11f961acc9b3a8d93fb7d1798ef367bb5';
export const PRIOR_PARALLEL_POLICY_IMAGE_ID = 'sha256:f1b4bb13bf023ed2851f0bca5c9da2a18eca1e7010daee7eeaef730978d56406';
export const PRIOR_TURN_CONSOLIDATION_IMAGE_ID = 'sha256:78149117c6ef5a0f6a8484d2d4c6dfa121afbe95632b649bed80e0f245162780';
export const PRIOR_TRANSCRIPT_READER_IMAGE_ID = 'sha256:b6348f112d76399d79c1b2bdd10ec1499cb9b70291e297192496a27199b1748b';
export const PRIOR_PROGRESS_SOURCE_BATCH_IMAGE_ID = 'sha256:fda79d598f57bade27dfdf442e3ef299084406420e3840b2a200b11a514d6218';
export const PRIOR_ENDPOINT_SCOPES_IMAGE_ID = 'sha256:a1330ff0ee1431af68a69f0b65c82a67acdd8611fb8d1188f6b821b5fc8a708c';
export const LABEL = 'dev.cortex.disposable-sandbox';
export const CANDIDATE_PACKAGES = Object.freeze({
  sdk: { name: '@cortexmemory/sdk', version: '0.39.0', filename: 'cortexmemory-sdk-0.39.0.tgz', sha256: '3c25cdc13fb04c2ddd92dcf9ccf86438e7af67aa1901ef9c8d7627e1da461f31' },
  cli: { name: '@cortexmemory/cli', version: '0.39.0', filename: 'cortexmemory-cli-0.39.0.tgz', sha256: '2fef802c7662cf4e32df3d146505a02cee3614a966655a71ae3ee9627a9d72e5' },
  provider: { name: '@cortexmemory/vercel-ai-provider', version: '0.39.0', filename: 'cortexmemory-vercel-ai-provider-0.39.0.tgz', sha256: '8580c09b900454a505e408512d367c3b048eb2ede68bb43797019a0225d74f53' },
  catalog: { name: '@cortexmemory/templates', version: '1.3.1', filename: 'cortexmemory-templates-1.3.1.tgz', sha256: '6526448490290d2d19fc61ec67e27a921b0f57bac6fe6ed658b9ac6329182970' },
});
export function assertPinnedCandidate() {
  if (!/^sha256:[a-f0-9]{64}$/.test(IMAGE_ID) || !/^[a-f0-9]{40}$/.test(SOURCE_COMMIT)
    || !/^[a-f0-9]{64}$/.test(BACKEND_MANIFEST_SHA256) || BACKEND_FILE_COUNT !== 158
    || Object.values(CANDIDATE_PACKAGES).some(entry => !/^[a-f0-9]{64}$/.test(entry.sha256))) throw Error('Latency candidate is unready; reviewed source/image/archive/backend pins are required before startup.');
}

async function regular(file) {
  const stat = await fs.lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw Error(`Expected an ordinary artifact: ${path.basename(file)}`);
  return stat;
}
async function directory(file) {
  const stat = await fs.lstat(file);
  if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid()) throw Error('Expected a current-owner ordinary session directory.');
}
export async function verifyArtifacts(kit) {
  assertPinnedCandidate();
  const archives = path.join(kit, 'image', 'archives');
  await regular(path.join(archives, 'manifest.json'));
  const manifest = JSON.parse(await fs.readFile(path.join(archives, 'manifest.json'), 'utf8'));
  if (manifest.version !== 1 || manifest.sourceCommit !== SOURCE_COMMIT || manifest.node !== '24.15.0' || manifest.npm !== '12.2.0'
    || manifest.backend?.manifestSha256 !== BACKEND_MANIFEST_SHA256
    || manifest.backend?.files !== BACKEND_FILE_COUNT || manifest.backend?.allSourceOutputHashesMatch !== true || manifest.packages?.length !== 4) throw Error('Reviewed source/artifact manifest differs.');
  const seen = new Set();
  for (const entry of manifest.packages) {
    const expected = CANDIDATE_PACKAGES[entry.role];
    if (!expected || seen.has(entry.role) || Object.entries(expected).some(([key, value]) => entry[key] !== value)) throw Error('Reviewed Cortex package identity differs.');
    seen.add(entry.role);
    const file = path.join(archives, entry.filename);
    await regular(file);
    if (createHash('sha256').update(await fs.readFile(file)).digest('hex') !== expected.sha256) throw Error(`Reviewed ${entry.role} archive hash differs.`);
  }
  return { imageId: IMAGE_ID, sourceCommit: SOURCE_COMMIT, packages: Object.keys(CANDIDATE_PACKAGES) };
}

export async function preflightDocker(session, ctx) {
  const artifacts = await verifyArtifacts(ctx.kit);
  const result = await ctx.command('docker-image-preflight', ctx.docker, ['image', 'inspect', IMAGE_ID]);
  const image = JSON.parse(result.stdout)[0];
  const identity = JSON.parse(await fs.readFile(path.join(ctx.kit, 'identity.json'), 'utf8'));
  if (image?.Id !== IMAGE_ID || image.Os !== 'linux' || image.Architecture !== 'arm64' || image.Config?.User !== 'sandbox'
    || image.Config?.Labels?.['dev.cortex.manual-sandbox'] !== identity.id
    || image.Config?.Labels?.['dev.cortex.manual-sandbox.path'] !== ctx.kit
    || identity.ownerUid !== session.ownerUid || identity.ownerGid !== session.ownerGid) throw Error('Pinned Docker image or ownership differs; rebuild/review explicitly before creating a cloud database.');
  await ctx.receipt('local-preflight', { artifacts, ownerUid: session.ownerUid, ownerGid: session.ownerGid, imageId: image.Id, os: image.Os, architecture: image.Architecture });
}

function socketAvailable(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', error => { if (error.code === 'EADDRINUSE' || error.code === 'EACCES') resolve(false); else reject(error); });
    server.listen({ host: '127.0.0.1', port, exclusive: true }, () => server.close(error => error ? reject(error) : resolve(true)));
  });
}
export async function selectPorts() {
  // Advisory reservation only: Docker binds atomically; a racing bind fails setup and triggers exact cleanup.
  const first = 3100 + Math.floor(Math.random() * 180) * 2;
  for (let offset = 0; offset < 180; offset++) {
    const web = 3100 + ((first - 3100 + offset * 2) % 360), basic = web + 1;
    if (await socketAvailable(web) && await socketAvailable(basic)) return { web, basic };
  }
  throw Error('No free loopback port pair3100..3459; no existing listener was stopped.');
}

export function expectedContainer(session) {
  // Existing sessions keep the exact reviewed image they already journaled.
  const imageId = session.container?.imageId ?? session.containerIntent?.imageId ?? IMAGE_ID;
  if (session.container?.imageId && session.containerIntent?.imageId && session.container.imageId !== session.containerIntent.imageId) throw Error('Container ownership/image journal differs; refusing mutation.');
  if (![IMAGE_ID, PREVIOUS_IMAGE_ID, PRIOR_LATENCY_IMAGE_ID, PRIOR_WORKFLOW_IMAGE_ID, PRIOR_EARLY_TEXT_IMAGE_ID, PRIOR_JSON_CONTEXT_IMAGE_ID, PRIOR_COMPOSED_IMAGE_ID, PRIOR_COMPACT_VECTOR_IMAGE_ID, PRIOR_CONTEXT_TRANSACTION_IMAGE_ID, PRIOR_QUERY_COMPOSITION_IMAGE_ID, PRIOR_AUTHORITY_ROUTING_IMAGE_ID, PRIOR_IMMEDIATE_START_IMAGE_ID, PRIOR_PARALLEL_POLICY_IMAGE_ID, PRIOR_TURN_CONSOLIDATION_IMAGE_ID, PRIOR_TRANSCRIPT_READER_IMAGE_ID, PRIOR_PROGRESS_SOURCE_BATCH_IMAGE_ID, PRIOR_ENDPOINT_SCOPES_IMAGE_ID].includes(imageId)) throw Error('Container ownership/image identity drift; refusing an unreviewed image.');
  return { name: `cortex-sandbox-${session.id}`, imageId,
    labels: { [LABEL]: session.id, [`${LABEL}.root`]: session.runDir } };
}
export function assertOwnedContainer(session, info) {
  const expected = expectedContainer(session);
  if (!info || info.Name !== `/${expected.name}` || info.Image !== expected.imageId
    || Object.entries(expected.labels).some(([key, value]) => info.Config?.Labels?.[key] !== value)
    || (session.container?.id && session.container.id !== info.Id)) throw Error('Container ownership/identity drift; refusing removal.');
}
async function findContainer(session, ctx) {
  const expected = expectedContainer(session);
  const result = await ctx.command('docker-find-owned', ctx.docker, ['container', 'ls', '--all', '--no-trunc', '--filter', `name=^/${expected.name}$`, '--format', '{{.ID}}']);
  const ids = result.stdout.trim().split(/\s+/).filter(Boolean);
  if (ids.length > 1 || ids.some(id => !/^[0-9a-f]{64}$/.test(id))) throw Error('Exact container lookup is ambiguous.');
  if (!ids.length) return null;
  const inspected = await ctx.command('docker-inspect-owned', ctx.docker, ['container', 'inspect', ids[0]]);
  const info = JSON.parse(inspected.stdout)[0];
  assertOwnedContainer(session, info);
  return info;
}
export async function createDocker(session, ctx) {
  assertPinnedCandidate();
  await directory(session.workspace); await directory(session.secretsDir);
  const expected = expectedContainer(session);
  if (expected.imageId !== IMAGE_ID) throw Error('Fresh Docker creation refuses an old session image; cleanup the original session instead.');
  if (await findContainer(session, ctx)) throw Error('Fresh session container already exists; recover with cleanup instead of reusing it.');
  session.containerIntent = expected;
  await ctx.persist();
  const args = ['container', 'create', '--name', expected.name, '--hostname', 'cortex-sandbox', '--init',
    '--user', `${session.ownerUid}:${session.ownerGid}`, '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--pids-limit', '512', '--memory', '4g',
    '--publish', `127.0.0.1:${session.ports.web}:3000`, '--publish', `127.0.0.1:${session.ports.basic}:3001`,
    '--mount', `type=bind,source=${session.workspace},target=/work`, '--mount', `type=bind,source=${session.secretsDir},target=/run/cortex-secrets,readonly`];
  for (const [key, value] of Object.entries(expected.labels)) args.push('--label', `${key}=${value}`);
  args.push(IMAGE_ID);
  await ctx.command('docker-create', ctx.docker, args);
  const info = await findContainer(session, ctx);
  if (!info) throw Error('Created container could not be reconciled.');
  session.container = { ...expected, id: info.Id };
  await ctx.persist();
  await ctx.command('docker-start', ctx.docker, ['container', 'start', info.Id]);
  await ctx.receipt('docker-created', { ...session.container, ports: session.ports });
  return session.container;
}
export async function removeDocker(session, ctx) {
  const info = await findContainer(session, ctx);
  if (info) await ctx.command('docker-remove', ctx.docker, ['container', 'rm', '--force', info.Id]);
  if (await findContainer(session, ctx)) throw Error('Owned container still exists after removal.');
  await ctx.receipt('docker-cleanup', { status: 'ABSENT', name: expectedContainer(session).name, id: info?.Id ?? session.container?.id ?? null });
  session.containerRemoved = true;
  await ctx.persist();
}

export async function execDocker(session, ctx, name, cwd, executable, args = [], options = {}) {
  if (!session.container?.id) throw Error('Owned container is not journaled.');
  const info = await findContainer(session, ctx);
  if (!info?.State?.Running) throw Error('Owned container is not running.');
  return ctx.command(name, ctx.docker, ['exec', '--workdir', cwd, session.container.id, executable, ...args], options);
}

async function atomic(file, content) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  try { await fs.writeFile(temporary, content, { flag: 'wx', mode: 0o600 }); await fs.rename(temporary, file); }
  finally { await fs.rm(temporary, { force: true }); }
}
export async function configureApps(session, ctx) {
  const metadata = session.publicRuntime;
  if (!metadata || metadata.teamId !== session.target?.teamId || metadata.projectId !== session.target?.projectId
    || metadata.deploymentName !== session.target?.name || metadata.deploymentUrl !== `https://${session.target.name}.convex.cloud`
    || metadata.httpUrl !== `https://${session.target.name}.convex.site`) throw Error('Runtime metadata is not bound to this new target.');
  for (const field of ['tenantId', 'memorySpaceId', 'agentId']) if (typeof metadata[field] !== 'string' || !metadata[field] || /[\r\n\0]/.test(metadata[field])) throw Error('Missing or unsafe scoped agent metadata.');
  if (!Number.isSafeInteger(metadata.agentVersion) || metadata.agentVersion < 1) throw Error('Published agent version required.');
  const keyStat = await regular(session.deploymentKeyPath);
  if ((keyStat.mode & 0o777) !== 0o600 || keyStat.uid !== session.ownerUid) throw Error('Deploy key file must be current-owner private0600.');
  const key = (await fs.readFile(session.deploymentKeyPath, 'utf8')).trim();
  if (!key.startsWith(`dev:${session.target.name}|`) || /[\r\n]/.test(key)) throw Error('Deploy key is not bound to the new disposable target.');
  ctx.registerSecret(key);
  await execDocker(session, ctx, 'scaffold-basic', '/work', 'cortex', ['init', '/work/basic', '--template', 'basic', '--cloud', '--no-deploy', '--no-install', '--yes', '--graph', 'none', '--sdk-package', '/opt/archives/cortexmemory-sdk-0.39.0.tgz', '--templates-package', '/opt/archives/cortexmemory-templates-1.3.1.tgz', '--catalog-version', '1.3.1', '--template-version', '1.4.1']);
  await execDocker(session, ctx, 'scaffold-demo', '/work', 'cortex', ['templates', 'init', '/work/demo', '--template', 'vercel-ai-quickstart', '--template-version', '1.4.1', '--catalog-version', '1.3.1', '--templates-package', '/opt/archives/cortexmemory-templates-1.3.1.tgz', '--sdk-package', '/opt/archives/cortexmemory-sdk-0.39.0.tgz', '--provider-package', '/opt/archives/cortexmemory-vercel-ai-provider-0.39.0.tgz', '--graph', 'none', '--yes', '--no-install']);
  for (const app of ['basic', 'demo']) {
    const appDir = path.join(session.workspace, app); await directory(appDir);
    const configFile = path.join(appDir, 'cortex.config.json');
    const config = JSON.parse(await fs.readFile(configFile, 'utf8').catch(error => { if (error.code === 'ENOENT') return '{"deployments":{},"default":"","format":"table","confirmDangerous":true}'; throw error; }));
    if (config.deployments && Object.keys(config.deployments).length) throw Error('Fresh scaffold unexpectedly contains deployment registrations.');
    config.deployments = { sandbox: { url: metadata.deploymentUrl, key, deployment: `dev:${session.target.name}`, projectPath: `/work/${app}`, tenantId: metadata.tenantId, memorySpaceId: metadata.memorySpaceId, tokenFile: '/run/cortex-secrets/owner.jwt' } };
    config.default = 'sandbox';
    await atomic(configFile, JSON.stringify(config, null, 2) + '\n');
    const values = { CONVEX_DEPLOYMENT: `dev:${session.target.name}`, CONVEX_URL: metadata.deploymentUrl, NEXT_PUBLIC_CONVEX_URL: metadata.deploymentUrl,
      NEXT_PUBLIC_CORTEX_HTTP_URL: metadata.httpUrl, NEXT_PUBLIC_CORTEX_AGENT_ID: metadata.agentId, NEXT_PUBLIC_CORTEX_AGENT_VERSION: metadata.agentVersion, NEXT_PUBLIC_CORTEX_MEMORY_SPACE_ID: metadata.memorySpaceId };
    if (ctx.latencyTrace === true && session.container?.imageId === IMAGE_ID) values[app === 'basic' ? 'CORTEX_RUNTIME_LATENCY_TRACE' : 'NEXT_PUBLIC_CORTEX_LATENCY_TRACE'] = '1';
    if (app === 'basic') Object.assign(values, { TENANT_ID: metadata.tenantId, MEMORY_SPACE_ID: metadata.memorySpaceId, AGENT_ID: metadata.agentId, AGENT_VERSION: metadata.agentVersion, CORTEX_AUTH_TOKEN_FILE: '/run/cortex-secrets/owner.jwt' });
    await atomic(path.join(appDir, '.env.local'), '# This UUID-owned disposable sandbox only.\n' + Object.entries(values).map(([name, value]) => `${name}=${JSON.stringify(String(value))}`).join('\n') + '\n');
  }
  const nextConfig = path.join(session.workspace, 'demo', 'next.config.js');
  await regular(nextConfig);
  const before = await fs.readFile(nextConfig, 'utf8');
  if (/allowedDevOrigins\s*:/.test(before) || !/const\s+nextConfig[^=]*=\s*\{/.test(before)) throw Error('Unexpected Next scaffold configuration; cannot apply reviewed loopback origin.');
  await atomic(nextConfig, before.replace(/(const\s+nextConfig[^=]*=\s*\{)/, '$1\n  allowedDevOrigins: ["127.0.0.1"],'));
  await atomic(path.join(session.workspace, 'runtime.json'), JSON.stringify(metadata, null, 2) + '\n');
  for (const app of ['basic', 'demo']) await execDocker(session, ctx, `install-${app}`, `/work/${app}`, 'npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund'], { timeoutMs: 600_000 });
  const observed = await execDocker(session, ctx, 'local-versions', '/work/demo', 'node', ['--input-type=module', '-e', 'import fs from "node:fs";for(const name of ["sdk","vercel-ai-provider"]){const p=JSON.parse(fs.readFileSync("node_modules/@cortexmemory/"+name+"/package.json"));if(p.version!=="0.39.0")throw Error("Installed candidate version differs");}console.log(JSON.stringify({node:process.version,sdk:"0.39.0",provider:"0.39.0"}))']);
  const versions = JSON.parse(observed.stdout.trim());
  if (versions.node !== 'v24.15.0') throw Error('Installed container Node differs.');
  await ctx.receipt('local-apps-ready', { versions, templateVersions: { basic: '1.4.1', demo: '1.4.1' }, catalogVersion: '1.3.1', noDeployment: true, installScriptsDisabled: true, loopbackOrigin: '127.0.0.1', deploymentName: session.target.name });
}
export async function launchDemo(session, ctx) {
  return execDocker(session, ctx, 'demo-foreground', '/work/demo', 'npm', ['run', 'dev', '--', '--hostname', '0.0.0.0'], { foreground: true, timeoutMs: 0 });
}
