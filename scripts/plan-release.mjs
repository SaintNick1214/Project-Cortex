import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const paths = JSON.parse(readFileSync('delivery-paths.json', 'utf8'));
if (!process.env.SOURCE_SHA || paths.sha !== process.env.SOURCE_SHA) {
  throw new Error('Release paths must match the checked main commit');
}
const packages = [
  { key: 'sdk', folder: '.', tag: 'v', changed: paths.sdk, paths: ['src/','convex-dev/','package.json','package-lock.json','tsconfig*.json'] },
  { key: 'provider', folder: 'packages/vercel-ai-provider', tag: 'vercel-ai-provider-v', changed: paths.sdk || paths.provider, paths: ['packages/vercel-ai-provider/src/','packages/vercel-ai-provider/react/','packages/vercel-ai-provider/package.json','packages/vercel-ai-provider/tsconfig*.json'] },
  { key: 'cli', folder: 'packages/cortex-cli', tag: 'cli-v', changed: paths.sdk || paths.provider || paths.cli, paths: ['packages/cortex-cli/src/','packages/cortex-cli/templates/','packages/cortex-cli/scripts/','packages/cortex-cli/package.json'] },
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
  // Registry errors must fail the release, not masquerade as an unpublished package.
  const response = JSON.parse(execFileSync('npm', ['view', pkg.name, 'version', 'gitHead', '--json'], { encoding: 'utf8' }));
  const latest = Array.isArray(response) ? response[0] : response;
  // Include changes from earlier main commits whose delivery was superseded
  // or failed. A push's path list alone would permanently lose those changes.
  if (/^[a-f0-9]{40}$/.test(latest.gitHead ?? '') && /^[a-f0-9]{40}$/.test(paths.sha)) {
    const changed = execFileSync('git', ['diff','--name-only',latest.gitHead,paths.sha,'--',...pkg.paths], {encoding:'utf8'}).trim();
    pkg.changed ||= Boolean(changed);
  }
  if (pkg.key !== 'sdk') pkg.changed ||= packages[0].changed || packages[0].released;
  if (pkg.key === 'cli') pkg.changed ||= packages[1].changed || packages[1].released;
  if (latest.gitHead === paths.sha) {
    pkg.changed = false; // A retry must not republish a completed package.
    pkg.released = true;
    pkg.version = latest.version;
    manifest.version = latest.version;
    writeFileSync(filename, JSON.stringify(manifest, null, 2) + '\n');
    continue;
  }
  if (!pkg.changed) {
    pkg.version = latest.version;
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
console.log(packages.map(pkg => `${pkg.name}: ${pkg.changed ? pkg.version : 'unchanged/already released'}`).join('\n'));
