import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { assertCandidateCheckout, createCandidateArtifacts, validateArchive, verifyCandidateArtifacts } from '../scripts/ci-candidate-artifacts.mjs';

const sha = 'a'.repeat(40);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const tar = args => execFileSync('tar', args, { encoding: 'utf8' });
const info = (file, pkg) => { const bytes = readFileSync(file); return { size: bytes.length, sha256: hash(bytes), package: pkg }; };
const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), 'cortex-candidate-'));
  const directory = join(root, 'artifact'), cliSource = join(root, 'cli');
  mkdirSync(directory); mkdirSync(join(cliSource, 'dist/utils'), { recursive: true });
  const cli = { name: '@cortexmemory/cli', version: '1.2.3' };
  writeFileSync(join(cliSource, 'package.json'), JSON.stringify(cli));
  writeFileSync(join(cliSource, 'dist/index.js'), 'export const version = "1.2.3";\n');
  writeFileSync(join(cliSource, 'dist/utils/schema-sync.js'), 'export const composer = "candidate-bytes";\n');
  const files = {};
  for (const [name, pkgName] of [['sdk.tgz', '@cortexmemory/sdk'], ['provider.tgz', '@cortexmemory/vercel-ai-provider']]) {
    const staging = join(root, name.slice(0, -4));
    mkdirSync(join(staging, 'package/dist'), { recursive: true });
    const pkg = { name: pkgName, version: '1.2.3' };
    writeFileSync(join(staging, 'package/package.json'), JSON.stringify(pkg));
    writeFileSync(join(staging, 'package/dist/index.js'), 'export const candidate = true;\n');
    tar(['-czf', join(directory, name), '-C', staging, 'package']);
    files[name] = info(join(directory, name), pkg);
  }
  tar(['-czf', join(directory, 'cli-dist.tgz'), '-C', cliSource, 'dist']);
  writeFileSync(join(directory, 'cli-package.json'), readFileSync(join(cliSource, 'package.json')));
  for (const name of ['cli-dist.tgz', 'cli-package.json']) files[name] = info(join(directory, name), cli);
  writeFileSync(join(directory, 'manifest.json'), JSON.stringify({ schema: 1, sha, files }));
  return { root, directory, cliSource };
};
const withFixture = fn => { const f = fixture(); try { return fn(f); } finally { rmSync(f.root, { recursive: true, force: true }); } };
const mutateManifest = (f, fn) => { const file = join(f.directory, 'manifest.json'), manifest = JSON.parse(readFileSync(file, 'utf8')); fn(manifest); writeFileSync(file, JSON.stringify(manifest)); };

test('real candidate archives preserve SHA, byte hashes, package identities and built composer files', () => withFixture(f => {
  const verified = verifyCandidateArtifacts({ ...f, sha });
  assert.equal(verified.manifest.sha, sha);
  assert.equal(verified.sdkArchive, join(f.directory, 'sdk.tgz'));
  assert.equal(verified.providerArchive, join(f.directory, 'provider.tgz'));
  const paths = validateArchive(verified.cliArchive, 'dist');
  assert.ok(paths.includes('dist/utils/schema-sync.js'));
  const extracted = join(f.root, 'restored'); mkdirSync(extracted);
  tar(['-xzf', verified.cliArchive, '-C', extracted]);
  assert.deepEqual(readFileSync(join(extracted, 'dist/utils/schema-sync.js')), readFileSync(join(f.cliSource, 'dist/utils/schema-sync.js')));
}));

for (const reason of ['wrong-sha', 'wrong-schema', 'missing-entry', 'extra-entry', 'wrong-size', 'wrong-checksum', 'wrong-package', 'wrong-version', 'malformed-json']) test(`candidate manifest refuses ${reason}`, () => withFixture(f => {
  if (reason === 'malformed-json') writeFileSync(join(f.directory, 'manifest.json'), '{');
  else mutateManifest(f, manifest => {
    if (reason === 'wrong-sha') manifest.sha = 'b'.repeat(40);
    if (reason === 'wrong-schema') manifest.schema = 2;
    if (reason === 'missing-entry') delete manifest.files['sdk.tgz'];
    if (reason === 'extra-entry') manifest.files['../escape'] = manifest.files['sdk.tgz'];
    if (reason === 'wrong-size') manifest.files['sdk.tgz'].size++;
    if (reason === 'wrong-checksum') manifest.files['sdk.tgz'].sha256 = '0'.repeat(64);
    if (reason === 'wrong-package') manifest.files['sdk.tgz'].package.name = '@other/sdk';
    if (reason === 'wrong-version') manifest.files['sdk.tgz'].package.version = '9.9.9';
  });
  assert.throws(() => verifyCandidateArtifacts({ ...f, sha }));
}));

for (const reason of ['missing-file', 'extra-file', 'changed-bytes', 'symlink-file', 'composer-mismatch']) test(`candidate refuses ${reason} before consumer install`, () => withFixture(f => {
  if (reason === 'missing-file') rmSync(join(f.directory, 'provider.tgz'));
  if (reason === 'extra-file') writeFileSync(join(f.directory, 'extra'), 'unowned');
  if (reason === 'changed-bytes') writeFileSync(join(f.directory, 'sdk.tgz'), 'different bytes');
  if (reason === 'symlink-file') { const target = join(f.root, 'manifest-copy'); writeFileSync(target, readFileSync(join(f.directory, 'manifest.json'))); rmSync(join(f.directory, 'manifest.json')); symlinkSync(target, join(f.directory, 'manifest.json')); }
  if (reason === 'composer-mismatch') writeFileSync(join(f.cliSource, 'package.json'), JSON.stringify({ name: '@cortexmemory/cli', version: '2.0.0' }));
  assert.throws(() => verifyCandidateArtifacts({ ...f, sha }));
}));

for (const reason of ['symlink-entry', 'hardlink-entry', 'wrong-prefix', 'duplicate-entry']) test(`archive refuses ${reason} even with a matching checksum`, () => withFixture(f => {
  const archive = join(f.directory, 'cli-dist.tgz');
  if (reason === 'symlink-entry') { symlinkSync('../../outside', join(f.cliSource, 'dist/escape')); tar(['-czf', archive, '-C', f.cliSource, 'dist']); }
  if (reason === 'hardlink-entry') { execFileSync('ln', [join(f.cliSource, 'dist/index.js'), join(f.cliSource, 'dist/linked.js')]); tar(['-czf', archive, '-C', f.cliSource, 'dist']); }
  if (reason === 'wrong-prefix') tar(['-czf', archive, '-C', f.cliSource, 'package.json']);
  if (reason === 'duplicate-entry') tar(['-czf', archive, '-C', f.cliSource, 'dist/index.js', 'dist/index.js']);
  mutateManifest(f, manifest => { manifest.files['cli-dist.tgz'] = info(archive, manifest.files['cli-dist.tgz'].package); });
  assert.throws(() => verifyCandidateArtifacts({ ...f, sha }), /Unsafe archive|distinct regular files/);
}));

test('real traversal archive is refused before extraction even with matching manifest bytes', () => withFixture(f => {
  const header = Buffer.alloc(512);
  header.write('dist/../escape', 0);
  for (const [offset, length, value] of [[100, 8, '0000644\0'], [108, 8, '0000000\0'], [116, 8, '0000000\0'], [124, 12, '00000000001\0'], [136, 12, '00000000000\0']]) header.write(value, offset, length);
  header.fill(32, 148, 156); header.write('0', 156); header.write('ustar\0', 257); header.write('00', 263);
  const sum = header.reduce((total, byte) => total + byte, 0);
  header.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148, 8);
  const archive = join(f.directory, 'cli-dist.tgz');
  writeFileSync(archive, Buffer.concat([header, Buffer.from('x'), Buffer.alloc(511 + 1024)]));
  mutateManifest(f, manifest => { manifest.files['cli-dist.tgz'] = info(archive, manifest.files['cli-dist.tgz'].package); });
  assert.throws(() => verifyCandidateArtifacts({ ...f, sha }), /Unsafe archive/);
  assert.equal(readFileSync(join(f.cliSource, 'dist/utils/schema-sync.js'), 'utf8'), 'export const composer = "candidate-bytes";\n');
}));

test('a checksummed CLI artifact still requires the complete composer entrypoints', () => withFixture(f => {
  const archive = join(f.directory, 'cli-dist.tgz');
  tar(['-czf', archive, '-C', f.cliSource, 'dist/index.js']);
  mutateManifest(f, manifest => { manifest.files['cli-dist.tgz'] = info(archive, manifest.files['cli-dist.tgz'].package); });
  assert.throws(() => verifyCandidateArtifacts({ ...f, sha }), /backend composer are required/);
}));

test('exact checkout validation rejects invalid or different commits and succeeds for HEAD', () => {
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  assertCandidateCheckout(head);
  assert.throws(() => assertCandidateCheckout('main'));
  assert.throws(() => assertCandidateCheckout(sha));
  assert.throws(() => assertCandidateCheckout(head, '/missing/candidate-fixture'));
});

test('artifact creation packs an isolated exact checkout, ignores prepack scripts and refuses replacement', () => {
  const root = mkdtempSync(join(tmpdir(), 'cortex-candidate-pack-'));
  try {
    const cli = join(root, 'packages/cortex-cli'), provider = join(root, 'packages/vercel-ai-provider');
    for (const directory of [root, cli, provider]) { mkdirSync(join(directory, 'dist/utils'), { recursive: true }); writeFileSync(join(directory, 'dist/index.js'), 'export const version = "1.2.3";\n'); }
    writeFileSync(join(cli, 'dist/utils/schema-sync.js'), 'export const composer = true;\n');
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: '@cortexmemory/sdk', version: '1.2.3', workspaces: ['packages/*'], files: ['dist'], scripts: { prepack: 'exit 99' } }));
    for (const [directory, name] of [[cli, '@cortexmemory/cli'], [provider, '@cortexmemory/vercel-ai-provider']]) writeFileSync(join(directory, 'package.json'), JSON.stringify({ name, version: '1.2.3', files: ['dist'], scripts: { prepack: 'exit 99' } }));
    const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    git(['init', '--quiet']); git(['add', '.']); git(['-c', 'user.name=CI Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'fixture']);
    const commit = git(['rev-parse', 'HEAD']).trim(), directory = join(root, 'artifact');
    const created = createCandidateArtifacts({ root, directory, sha: commit });
    assert.equal(created.manifest.sha, commit);
    assert.equal(created.manifest.files['sdk.tgz'].package.name, '@cortexmemory/sdk');
    assert.equal(created.manifest.files['cli-dist.tgz'].package.version, '1.2.3');
    const composerBytes = readFileSync(join(cli, 'dist/utils/schema-sync.js'));
    writeFileSync(join(cli, 'dist/utils/schema-sync.js'), 'different ignored build bytes');
    const output = join(root, 'github-env');
    const verified = spawnSync(process.execPath, [resolve('scripts/ci-candidate-artifacts.mjs'), 'verify', directory, commit], { cwd: root, env: { ...process.env, GITHUB_ENV: output }, encoding: 'utf8' });
    assert.equal(verified.status, 0, verified.stderr);
    assert.deepEqual(readFileSync(join(cli, 'dist/utils/schema-sync.js')), composerBytes);
    assert.match(readFileSync(output, 'utf8'), /SDK_ARCHIVE=.*sdk\.tgz\nPROVIDER_ARCHIVE=.*provider\.tgz\n/);
    assert.throws(() => createCandidateArtifacts({ root, directory, sha: commit }), /immutable/);
    assert.throws(() => createCandidateArtifacts({ root, directory: join(root, 'wrong'), sha }), /exact candidate/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('artifact executable refuses malformed commands and wrong candidate before extracting', () => withFixture(f => {
  const bad = spawnSync(process.execPath, ['scripts/ci-candidate-artifacts.mjs', 'verify', f.directory, sha], { encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /exact candidate checkout/);
  const unknown = spawnSync(process.execPath, [resolve('scripts/ci-candidate-artifacts.mjs'), 'unknown', f.directory, sha], { encoding: 'utf8' });
  assert.equal(unknown.status, 1);
  assert.match(unknown.stderr, /Use create or verify/);
}));
