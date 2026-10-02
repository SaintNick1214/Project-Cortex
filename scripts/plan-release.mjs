import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const paths = JSON.parse(readFileSync('delivery-paths.json', 'utf8'));
if (!process.env.SOURCE_SHA || paths.sha !== process.env.SOURCE_SHA) {
  throw new Error('Release paths must match the checked main commit');
}
const packages = [
  { key: 'sdk', folder: '.', tag: 'v', changed: paths.sdk },
  { key: 'provider', folder: 'packages/vercel-ai-provider', tag: 'vercel-ai-provider-v', changed: paths.sdk || paths.provider },
  { key: 'cli', folder: 'packages/cortex-cli', tag: 'cli-v', changed: paths.sdk || paths.provider || paths.cli },
];
const parse = version => {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`Stable semver required: ${version}`);
  return version.split('.').map(Number);
};
const compare = (a,b) => {
  const x = parse(a), y = parse(b);
  return x[0]-y[0] || x[1]-y[1] || x[2]-y[2];
};
for (const pkg of packages) {
  const filename = `${pkg.folder}/package.json`;
  const manifest = JSON.parse(readFileSync(filename, 'utf8'));
  pkg.name = manifest.name;
  pkg.version = manifest.version;
  if (!pkg.changed) continue;
  // Registry errors must fail the release, not masquerade as an unpublished package.
  const response = JSON.parse(execFileSync('npm', ['view', pkg.name, 'version', 'gitHead', '--json'], { encoding: 'utf8' }));
  const latest = Array.isArray(response) ? response[0] : response;
  if (latest.gitHead === paths.sha) {
    pkg.changed = false; // A retry must not republish a completed package.
    pkg.released = true;
    pkg.version = latest.version;
    manifest.version = latest.version;
    writeFileSync(filename, JSON.stringify(manifest, null, 2) + '\n');
    continue;
  }
  const chosen = compare(manifest.version, latest.version) > 0
    ? manifest.version
    : (() => { const [major,minor,patch] = parse(latest.version); return `${major}.${minor}.${patch+1}`; })();
  manifest.version = pkg.version = chosen;
  writeFileSync(filename, JSON.stringify(manifest, null, 2) + '\n');
}
const sdk = packages[0];
if (sdk.version) {
  for (const pkg of packages.slice(1)) {
    const filename = `${pkg.folder}/package.json`;
    const manifest = JSON.parse(readFileSync(filename, 'utf8'));
    if (manifest.dependencies?.[sdk.name]) manifest.dependencies[sdk.name] = `^${sdk.version}`;
    writeFileSync(filename, JSON.stringify(manifest, null, 2) + '\n');
  }
}
writeFileSync('release-plan.json', JSON.stringify(packages, null, 2) + '\n');
appendFileSync(process.env.GITHUB_ENV, `RELEASE_SDK=${Boolean(paths.sdk)}\n`);
console.log(packages.map(pkg => `${pkg.name}: ${pkg.changed ? pkg.version : 'unchanged/already released'}`).join('\n'));
