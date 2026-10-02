import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const plan = JSON.parse(readFileSync('release-plan.json', 'utf8'));
const run = (command, args, cwd = '.') => execFileSync(command, args, { cwd, stdio: 'inherit' });
for (const pkg of plan.filter(pkg => pkg.changed || pkg.released)) {
  if (pkg.changed) {
    if (pkg.key === 'cli') {
      // Generated apps must install registry versions, not monorepo file links.
      for (const template of ['basic','vercel-ai-quickstart','chat-sdk-quickstart']) {
        const folder = join(pkg.folder,'templates',template);
        const filename = join(folder,'package.json');
        if (!existsSync(filename)) continue;
        const manifest = JSON.parse(readFileSync(filename,'utf8'));
        for (const dependency of plan) {
          if (dependency.version && manifest.dependencies?.[dependency.name]) {
            manifest.dependencies[dependency.name] = `^${dependency.version}`;
          }
        }
        writeFileSync(filename,JSON.stringify(manifest,null,2)+'\n');
        run('npm',['install','--package-lock-only','--ignore-scripts','--no-audit','--no-fund'],folder);
      }
    }
    run('npm', ['pack', '--workspaces=false', '--dry-run', '--ignore-scripts'], pkg.folder);
    run('npm', ['publish', '--workspaces=false', '--access', 'public', '--ignore-scripts'], pkg.folder);
  }
  // Check the exact version, not merely that the package name exists.
  let visible = false;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const actual = execFileSync('npm', ['view', `${pkg.name}@${pkg.version}`, 'version'], {encoding:'utf8'}).trim();
      if (actual === pkg.version) { visible = true; break; }
    } catch { /* Registry propagation can take several seconds. */ }
    await new Promise(resolve => setTimeout(resolve, 10_000));
  }
  if (!visible) throw new Error(`Published version not visible: ${pkg.name}@${pkg.version}`);
  const tag = `${pkg.tag}${pkg.version}`;
  try { execFileSync('git',['rev-parse','--verify',`refs/tags/${tag}`],{stdio:'pipe'}); }
  catch { run('git', ['tag', tag, process.env.SOURCE_SHA]); run('git', ['push', 'origin', tag]); }
  try { execFileSync('gh',['release','view',tag],{stdio:'pipe'}); }
  catch { run('gh', ['release', 'create', tag, '--title', `${pkg.name} ${pkg.version}`, '--notes', `Automatically built and tested from ${process.env.SOURCE_SHA}. Install ${pkg.name}@${pkg.version}. Documentation: https://docs.cortexmemory.dev`]); }
}
