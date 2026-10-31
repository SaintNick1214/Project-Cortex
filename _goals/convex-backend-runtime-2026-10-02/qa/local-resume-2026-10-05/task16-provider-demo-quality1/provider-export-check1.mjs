import { createRequire } from 'node:module';
import { strict as assert } from 'node:assert';
import { writeFile } from 'node:fs/promises';
const root = '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/packages/vercel-ai-provider';
const require = createRequire(root + '/package.json');
const spec = [['.', ['createCortexMemory', 'createCortexMemoryAsync', 'CortexMemoryProvider']], ['./react', ['useLayerTracking', 'useArtifacts', 'useArtifact']], ['./remote', ['CortexRemoteTransport']]];
const rows = [];
for (const [name, keys] of spec) {
  const entry = require(root + '/package.json').exports[name];
  const esm = await import(root + '/' + entry.import);
  const cjs = require(root + '/' + entry.require);
  for (const key of keys) { assert.equal(typeof esm[key], 'function'); assert.equal(typeof cjs[key], 'function'); }
  rows.push({ subpath: name, esm: entry.import, cjs: entry.require, types: entry.types, checkedExports: keys });
}
await writeFile(new URL('./provider-export-outcomes1.json', import.meta.url), JSON.stringify({ status: 'PASS_IMPORTS_ONLY', rows, constructorsCalled: 0, serviceCalls: 0, modelCalls: 0 }, null, 2) + '\n');
console.log(JSON.stringify(rows));
