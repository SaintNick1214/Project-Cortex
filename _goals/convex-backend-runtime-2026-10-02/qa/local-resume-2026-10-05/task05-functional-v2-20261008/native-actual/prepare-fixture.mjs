import { readFile, writeFile, mkdir, copyFile, symlink } from 'node:fs/promises';
import { dirname, join, resolve, relative } from 'node:path';
import { createHash, generateKeyPairSync } from 'node:crypto';
const qa = dirname(new URL(import.meta.url).pathname);
const root = resolve(qa, '../../../../../..');
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
for (const rel of ['convex-dev/runs.ts','convex-dev/runtimeTranscript.ts','convex-dev/agentDefinitions.ts','convex-dev/conversations.ts','convex-dev/conversationShares.ts','convex-dev/conversationSnapshots.ts','convex-dev/runtimeMemory.ts','convex-dev/runtimeMemoryServices.ts','convex-dev/runtimeAuth.ts','convex-dev/schema.ts','convex-dev/tsconfig.json','convex-dev/convex.config.ts']) await acquire(rel);
try { await symlink(join(root, 'node_modules'), join(fixture, 'node_modules')); } catch (e) { if (e.code !== 'EEXIST') throw e; }
await writeFile(join(fixture, 'package.json'), JSON.stringify({ name: 'cortex-task05-disposable-native', private: true, type: 'module', engines: { node: '>=24.15.0' }, packageManager: 'npm@12.2.0', dependencies: { convex: '1.46.0', ai: '7.0.0-beta.26', '@convex-dev/ai-sdk-provider': '0.2.1', '@convex-dev/agent': '0.7.3', zod: '^4.0.0' } }, null, 2));
await writeFile(join(fixture, 'convex.json'), JSON.stringify({ functions: 'convex-dev/' }));
await copyFile(join(qa, 'qualification.ts'), join(fixture, 'convex-dev/qualification.ts'));
await writeFile(join(qa, 'fixture-copy-manifest.json'), JSON.stringify({ operation: pointer.operation, fixture, files, scope: 'selective current product source; registered real Agent component; unchanged compiled deployment registry', qualificationOnlyTrustChange: false }, null, 2));
console.log(JSON.stringify({ fixture, files: files.length, bytes: files.reduce((n,f) => n+f.bytes,0) }));

const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
await writeFile(join(pointer.privateDirectory,'jwt-private.pem'), pair.privateKey.export({type:'pkcs8',format:'pem'}), {mode:0o600,flag:'wx'});
const jwk={...pair.publicKey.export({format:'jwk'}),kid:'cortex-task05-native',alg:'RS256',use:'sig'};
const jwks='data:text/plain;charset=utf-8;base64,'+Buffer.from(JSON.stringify({keys:[jwk]})).toString('base64');
const auth={issuer:'https://cortex-qualification.invalid',applicationID:'cortex-task05',kid:jwk.kid};
await writeFile(join(qa,'jwt-public-config.json'),JSON.stringify(auth,null,2));
await writeFile(join(fixture,'convex-dev/auth.config.ts'),'import type { AuthConfig } from "convex/server";\nexport default '+JSON.stringify({providers:[{type:'customJwt',applicationID:auth.applicationID,issuer:auth.issuer,jwks,algorithm:'RS256'}]})+' satisfies AuthConfig;\n');
