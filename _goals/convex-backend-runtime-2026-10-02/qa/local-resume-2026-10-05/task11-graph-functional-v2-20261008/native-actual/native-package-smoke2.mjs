/** Bind the actual worker to the installed packed package's declared public subpath. */
import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {openOwnedContext, sha} from './common.mjs';
const context = await openOwnedContext();
try {
  const helper = join(context.host, 'task11-graph-runtime-entry.mjs');
  const source = "export * from '@cortexmemory/sdk/runtime/graph';\nexport const runtimeGraphEntry = import.meta.resolve('@cortexmemory/sdk/runtime/graph');\n";
  assert.equal(await readFile(helper,'utf8'),source,'Existing owned declared-package helper remains exact');
  const esm = await import(pathToFileURL(helper));
  const load = createRequire(join(context.host, 'package.json'));
  const cjs = load('@cortexmemory/sdk/runtime/graph');
  const cjsPath = load.resolve('@cortexmemory/sdk/runtime/graph');
  for (const key of ['CypherProjectionConnector', 'CortexGraphWorker', 'ConvexGraphWorkerTransport']) {
    assert.equal(typeof esm[key], 'function'); assert.equal(typeof cjs[key], 'function');
  }
  assert.equal(esm.runtimeGraphEntry, pathToFileURL(join(context.host, 'node_modules/@cortexmemory/sdk/dist/graph-runtime/index.js')).href);
  assert.equal(cjsPath, join(context.host, 'node_modules/@cortexmemory/sdk/dist/graph-runtime/index.cjs'));
  const browserPath = join(context.host, 'node_modules/@cortexmemory/sdk/dist/client-runtime/index.js');
  const browser = await readFile(browserPath);
  assert.doesNotMatch(browser.toString(), /neo4j-driver|CypherProjectionConnector|CortexGraphWorker|GraphWorkerTransport/);
  await context.publish('native-package-smoke2', {status: 'PASS', declaredSubpath: '@cortexmemory/sdk/runtime/graph',
    esmPath: esm.runtimeGraphEntry, esmSha256: sha(await readFile(new URL(esm.runtimeGraphEntry))),
    cjsPath, cjsSha256: sha(await readFile(cjsPath)), fixtureHelper: {path: helper, bytes: Buffer.byteLength(source), sha256: sha(source)},
    browserEntry: {path: browserPath, bytes: browser.length, sha256: sha(browser), graphTransportMarkersAbsent: true},
    serviceEffects: 0, graphWrites: 0, modelCalls: 0});
  console.log(JSON.stringify({status: 'PACKED_DECLARED_SUBPATH_PASS', esm: true, cjs: true, browserHasGraphTransport: false}));
} finally {await context.close();}
