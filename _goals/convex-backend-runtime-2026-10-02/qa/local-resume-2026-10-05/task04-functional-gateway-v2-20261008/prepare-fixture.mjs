import { readFile, writeFile, mkdir, copyFile, symlink } from 'node:fs/promises';
import { dirname, join, resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
const qa = dirname(new URL(import.meta.url).pathname);
const root = resolve(qa, '../../../../..');
const pointer = JSON.parse(await readFile(join(qa, 'fixture-pointer.json'), 'utf8'));
const fixture = join(pointer.privateDirectory, 'project');
await mkdir(fixture, { recursive: true, mode: 0o700 });
const selected = new Set(); const files = [];
async function acquire(rel) {
  if (selected.has(rel)) return; selected.add(rel);
  const raw = await readFile(join(root, rel));
  await mkdir(dirname(join(fixture, rel)), { recursive: true }); await writeFile(join(fixture, rel), raw);
  files.push({ path: rel, bytes: raw.length, sha256: createHash('sha256').update(raw).digest('hex') });
  const text = raw.toString('utf8');
  for (const match of text.matchAll(/(?:from\s*|import\s*)["'](\.[^"']+)["']/g)) {
    const base = resolve(dirname(join(root, rel)), match[1]);
    for (const candidate of [base.replace(/\.js$/, '.ts'), base + '.ts', base + '.d.ts', join(base, 'index.ts'), base]) {
      try { await acquire(relative(root, candidate)); break; } catch (err) { if (err.code !== 'ENOENT' && err.code !== 'EISDIR') throw err; }
    }
  }
}
for (const rel of ['convex-dev/runtimeGatewayBackend.ts','convex-dev/runtimeGateway.ts','convex-dev/runtimeModelPolicy.ts','convex-dev/schema.ts','convex-dev/tsconfig.json']) await acquire(rel);
try { await symlink(join(root, 'node_modules'), join(fixture, 'node_modules')); } catch (e) { if (e.code !== 'EEXIST') throw e; }
await writeFile(join(fixture, 'package.json'), JSON.stringify({ name: 'cortex-task04-disposable-qualification', private: true, type: 'module', engines: { node: '>=24.15.0' }, packageManager: 'npm@12.2.0', dependencies: { convex: '1.46.0', ai: '7.0.0-beta.26', '@convex-dev/ai-sdk-provider': '0.2.1', zod: '^4.0.0' } }, null, 2));
await writeFile(join(fixture, 'convex.json'), JSON.stringify({ functions: 'convex-dev/' }));
await copyFile(join(qa, 'qualification.ts'), join(fixture, 'convex-dev/qualification.ts'));
const originalBootstrap = await readFile(join(fixture, 'convex-dev/runtimeModelPolicyBootstrap.ts'), 'utf8');
await writeFile(join(fixture, 'convex-dev/runtimeModelPolicyBootstrap.ts'), originalBootstrap.replace('const manifests: readonly DeploymentPolicyManifest[] = Object.freeze([]);', 'import { fixtureManifest } from "./qualificationManifest";\nconst manifests: readonly DeploymentPolicyManifest[] = Object.freeze([fixtureManifest]);').replace('manifest.classification === "reviewed-actual"', 'manifest.classification === "fixture-synthetic"'));
const manifest = JSON.parse(await readFile(join(qa, 'provisional-manifest.json'), 'utf8'));
await writeFile(join(fixture, 'convex-dev/qualificationManifest.ts'), 'import type { DeploymentPolicyManifest } from "./runtimeModelPolicyBootstrap";\n// Provisional qualification-only authority, never production acceptance.\nexport const fixtureManifest = ' + JSON.stringify(manifest) + ' as const satisfies DeploymentPolicyManifest;\n');
await writeFile(join(qa, 'fixture-copy-manifest.json'), JSON.stringify({ operation: pointer.operation, fixture, files, scope: 'selective disposable fixture; production bootstrap unchanged', qualificationOnlyTrustChange: true }, null, 2));
console.log(JSON.stringify({ fixture, files: files.length, bytes: files.reduce((n,f) => n+f.bytes,0) }));
