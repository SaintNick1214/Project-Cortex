import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { publishReleasePlan, validateReleasePlan } from './release-contract.mjs';
const sourceSha = process.env.SOURCE_SHA;
const plan = JSON.parse(readFileSync('release-plan.json', 'utf8'));
validateReleasePlan(plan, sourceSha);
if (execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() !== sourceSha) throw new Error('Checkout/source mismatch');
const run = (command, args, cwd = '.') => execFileSync(command, args, { cwd, stdio: 'inherit' });
await publishReleasePlan({
  plan, sourceSha,
  publish: pkg => {
    // Never resynchronize retired mirrors or rewrite independent app locks here.
    const manifest = JSON.parse(readFileSync(`${pkg.folder}/package.json`, 'utf8'));
    if (manifest.name !== pkg.name || manifest.version !== pkg.version) throw new Error('Built package/plan mismatch');
    run('npm', ['pack', '--workspaces=false', '--dry-run', '--ignore-scripts'], pkg.folder);
    run('npm', ['publish', '--workspaces=false', '--access', 'public', '--ignore-scripts'], pkg.folder);
  },
  visibleVersion: pkg => execFileSync('npm', ['view', `${pkg.name}@${pkg.version}`, 'version', '--prefer-online', '--fetch-retries=0', '--fetch-timeout=20000'], { encoding: 'utf8', timeout: 30_000, stdio: ['ignore', 'pipe', 'pipe'] }).trim(),
  wait: milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)),
  tagAndRelease: pkg => {
    const tag = `${pkg.tag}${pkg.version}`;
    let existing;
    try { existing = execFileSync('git', ['rev-parse', '--verify', `refs/tags/${tag}^{commit}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); } catch { /* New tag. */ }
    if (existing && existing !== sourceSha) throw new Error(`Release tag belongs to another commit: ${tag}`);
    if (!existing) { run('git', ['tag', tag, sourceSha]); run('git', ['push', 'origin', tag]); }
    try { execFileSync('gh', ['release', 'view', tag], { stdio: 'pipe' }); }
    catch { run('gh', ['release', 'create', tag, '--title', `${pkg.name} ${pkg.version}`, '--notes', `Automatically built and tested from ${sourceSha}. Install ${pkg.name}@${pkg.version}. Documentation: https://docs.cortexmemory.dev`]); }
  },
});
