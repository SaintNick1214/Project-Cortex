/** Exact-source demo packages; cache only immutable archives, never node_modules. */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { appendFileSync, copyFileSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const names = { 'sdk.tgz': '@cortexmemory/sdk', 'provider.tgz': '@cortexmemory/vercel-ai-provider', 'cli-dist.tgz': '@cortexmemory/cli', 'cli-package.json': '@cortexmemory/cli' };
const entries = Object.keys(names);
const shaPattern = /^[a-f0-9]{40}$/;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const run = (args, cwd) => execFileSync('tar', args, { cwd, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });

export function assertCandidateCheckout(sha, root = process.cwd()) {
  if (!shaPattern.test(sha ?? '') || execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim() !== sha) throw new Error('Artifact requires the exact candidate checkout');
}

export function validateArchive(file, prefix) {
  const paths = run(['-tf', file]).trim().split('\n');
  const modes = run(['-tvf', file]).trim().split('\n');
  if (!paths.length || paths.length !== modes.length || paths.some(path => !path.startsWith(`${prefix}/`) || path.includes('\\') || [...path].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) || path.split('/').some(part => part === '..' || part === '.')) || modes.some(line => !['-', 'd'].includes(line[0]))) throw new Error('Unsafe archive paths, links or entry types');
  if (new Set(paths).size !== paths.length || !modes.some(line => line[0] === '-')) throw new Error('Archive must contain distinct regular files');
  return paths;
}

function packageInfo(manifest, expected) {
  if (manifest?.name !== expected || typeof manifest.version !== 'string' || !/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(manifest.version)) throw new Error(`Invalid candidate package identity for ${expected}`);
  return { name: manifest.name, version: manifest.version };
}

/** npm12 keys pack JSON by package name; earlier npm emits an array. */
export function parsePackArchive(stdout, expectedName) {
  const output = JSON.parse(stdout);
  const packed = Array.isArray(output) ? output : output && typeof output === 'object' && Object.keys(output).length === 1 && Object.hasOwn(output, expectedName) ? [output[expectedName]] : [];
  if (packed.length !== 1 || typeof packed[0]?.filename !== 'string' || !/^[A-Za-z0-9_.-]+\.tgz$/.test(packed[0].filename) || !packed[0].filename.endsWith('.tgz')) throw new Error('Expected one explicit candidate package archive');
  packageInfo(packed[0], expectedName);
  return packed[0].filename;
}

function archivePackage(file, expected) {
  validateArchive(file, 'package');
  return packageInfo(JSON.parse(run(['-xOf', file, 'package/package.json'])), expected);
}

export function verifyCandidateArtifacts({ directory, sha, cliSource }) {
  if (!shaPattern.test(sha ?? '')) throw new Error('Exact candidate SHA required');
  const dir = resolve(directory);
  const actual = readdirSync(dir).sort();
  if (JSON.stringify(actual) !== JSON.stringify([...entries, 'manifest.json'].sort())) throw new Error('Candidate artifact files must exactly match the manifest contract');
  for (const name of actual) if (!lstatSync(join(dir, name)).isFile() || lstatSync(join(dir, name)).isSymbolicLink()) throw new Error('Candidate artifacts must be regular files');
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
  if (manifest.schema !== 1 || manifest.sha !== sha || !manifest.files || JSON.stringify(Object.keys(manifest.files).sort()) !== JSON.stringify(entries.slice().sort())) throw new Error('Missing, malformed or wrong-SHA candidate manifest');
  for (const name of entries) {
    const item = manifest.files[name], bytes = readFileSync(join(dir, name));
    if (!item || !Number.isSafeInteger(item.size) || item.size < 1 || item.size !== bytes.length || !/^[a-f0-9]{64}$/.test(item.sha256 ?? '') || item.sha256 !== hash(bytes)) throw new Error(`Candidate checksum/size mismatch: ${name}`);
    packageInfo(item.package, names[name]);
  }
  for (const name of ['sdk.tgz', 'provider.tgz']) {
    const actualPackage = archivePackage(join(dir, name), names[name]);
    if (JSON.stringify(actualPackage) !== JSON.stringify(packageInfo(manifest.files[name].package, names[name]))) throw new Error(`Archive package identity differs from manifest: ${name}`);
  }
  const composerFiles = validateArchive(join(dir, 'cli-dist.tgz'), 'dist');
  if (!['dist/index.js', 'dist/utils/schema-sync.js'].every(path => composerFiles.includes(path))) throw new Error('Built CLI entrypoint and backend composer are required');
  const cliManifest = readFileSync(join(dir, 'cli-package.json'));
  const cli = packageInfo(JSON.parse(cliManifest), names['cli-package.json']);
  for (const name of ['cli-dist.tgz', 'cli-package.json']) if (JSON.stringify(cli) !== JSON.stringify(packageInfo(manifest.files[name].package, names[name]))) throw new Error('CLI package and composer identity differ');
  if (cliSource && !cliManifest.equals(readFileSync(join(resolve(cliSource), 'package.json')))) throw new Error('CLI composer manifest differs from the exact candidate source');
  return { manifest, sdkArchive: join(dir, 'sdk.tgz'), providerArchive: join(dir, 'provider.tgz'), cliArchive: join(dir, 'cli-dist.tgz') };
}

export function createCandidateArtifacts({ directory, sha, root = process.cwd() }) {
  assertCandidateCheckout(sha, root);
  const dir = resolve(directory);
  mkdirSync(dir, { recursive: true });
  if (readdirSync(dir).length) throw new Error('Candidate artifact directory must be empty; artifacts are immutable');
  for (const [name, workspace] of [['sdk.tgz', undefined], ['provider.tgz', '@cortexmemory/vercel-ai-provider']]) {
    const args = ['pack', '--ignore-scripts', '--json', '--pack-destination', dir, workspace ? `--workspace=${workspace}` : '--workspaces=false'];
    const filename = parsePackArchive(execFileSync('npm', args, { cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }), names[name]);
    renameSync(join(dir, filename), join(dir, name));
  }
  const cliSource = join(root, 'packages/cortex-cli');
  run(['-czf', join(dir, 'cli-dist.tgz'), '-C', cliSource, 'dist']);
  copyFileSync(join(cliSource, 'package.json'), join(dir, 'cli-package.json'));
  const cli = packageInfo(JSON.parse(readFileSync(join(dir, 'cli-package.json'), 'utf8')), '@cortexmemory/cli');
  const files = Object.fromEntries(entries.map(name => {
    const bytes = readFileSync(join(dir, name));
    return [name, { size: bytes.length, sha256: hash(bytes), package: name.startsWith('cli-') ? cli : archivePackage(join(dir, name), names[name]) }];
  }));
  writeFileSync(join(dir, 'manifest.json'), `${JSON.stringify({ schema: 1, sha, files }, null, 2)}\n`, { flag: 'wx' });
  return verifyCandidateArtifacts({ directory: dir, sha, cliSource });
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const [command, directory, sha] = process.argv.slice(2);
    if (!directory) throw new Error('Use create|verify <artifact-directory> <exact-sha>');
    if (command === 'create') console.log(JSON.stringify(createCandidateArtifacts({ directory, sha }).manifest));
    else if (command === 'verify') {
      assertCandidateCheckout(sha);
      const cliSource = resolve('packages/cortex-cli');
      const artifact = verifyCandidateArtifacts({ directory, sha, cliSource });
      // All entries/hashes are verified before any extraction. npm ci supplies runtime dependencies.
      const dist = join(cliSource, 'dist');
      try { if (lstatSync(dist).isSymbolicLink()) throw new Error('CLI dist extraction target cannot be a symlink'); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      run(['-xzf', artifact.cliArchive, '-C', cliSource]);
      if (process.env.GITHUB_ENV) appendFileSync(process.env.GITHUB_ENV, `SDK_ARCHIVE=${artifact.sdkArchive}\nPROVIDER_ARCHIVE=${artifact.providerArchive}\n`);
      console.log(JSON.stringify(artifact.manifest));
    } else throw new Error('Use create or verify');
  } catch (error) {
    console.error(`Candidate artifacts: ${error.message}`);
    process.exitCode = 1;
  }
}
