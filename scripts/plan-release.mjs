import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createReleasePlan, registryResult } from './release-contract.mjs';
if (process.argv.slice(2).some(arg => arg !== '--dry-run')) throw new Error('Only --dry-run is supported');
const dryRun = process.argv.includes('--dry-run');
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
for (const pkg of plan.packages.filter(pkg => !dryRun && (pkg.changed || pkg.released))) {
  const manifest = readManifest(pkg.folder);
  manifest.version = pkg.version;
  for (const dependency of plan.packages) {
    if (manifest.dependencies?.[dependency.name]) manifest.dependencies[dependency.name] = `^${dependency.version}`;
  }
  writeFileSync(`${pkg.folder}/package.json`, JSON.stringify(manifest, null, 2) + '\n');
}
writeFileSync('release-plan.json', JSON.stringify(plan, null, 2) + '\n');
const outcome = plan.packages.some(pkg => pkg.changed) ? 'changes planned' : plan.packages.some(pkg => pkg.released) ? 'release metadata recovery planned' : 'nothing to publish';
const summary = `## Package release plan\n\nOutcome: **${outcome}**; source: \`${plan.sourceSha}\`; mode: ${dryRun ? 'dry-plan (no manifest changes or publication)' : 'publication/recovery plan'}.\n\n` + plan.packages.map(pkg => `- ${pkg.name}: ${pkg.changed ? `publish ${pkg.version}` : pkg.released ? `already accepted ${pkg.version}; verify visibility and recover release metadata` : 'unchanged'}`).join('\n') + '\n';
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
console.log(summary);
