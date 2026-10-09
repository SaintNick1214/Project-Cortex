import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createReleasePlan, registryResult } from './release-contract.mjs';
const readManifest = folder => JSON.parse(readFileSync(`${folder}/package.json`, 'utf8'));
const registry = name => {
  try { return registryResult(execFileSync('npm', ['view', name, 'version', 'gitHead', '--json', '--prefer-online'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })); }
  catch (error) { return registryResult(String(error.stdout ?? ''), error); }
};
const plan = createReleasePlan({
  paths: JSON.parse(readFileSync('delivery-paths.json', 'utf8')),
  sourceSha: process.env.SOURCE_SHA, readManifest, registry,
  diffPaths: (from, to, paths) => execFileSync('git', ['diff', '--name-only', from, to, '--', ...paths], { encoding: 'utf8' }).trim(),
});
for (const pkg of plan.packages.filter(pkg => pkg.changed || pkg.released)) {
  const manifest = readManifest(pkg.folder);
  manifest.version = pkg.version;
  for (const dependency of plan.packages) {
    if (manifest.dependencies?.[dependency.name]) manifest.dependencies[dependency.name] = `^${dependency.version}`;
  }
  writeFileSync(`${pkg.folder}/package.json`, JSON.stringify(manifest, null, 2) + '\n');
}
writeFileSync('release-plan.json', JSON.stringify(plan, null, 2) + '\n');
console.log(plan.packages.map(pkg => `${pkg.name}: ${pkg.changed ? pkg.version : 'unchanged/already released'}`).join('\n'));
