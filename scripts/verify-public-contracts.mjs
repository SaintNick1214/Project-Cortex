import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';

// Extract the npm tarball: source imports cannot validate the package export map.
const temporary = mkdtempSync(resolve('node_modules/.cortex-contract-'));
try {
  const packResult = JSON.parse(execFileSync('npm', ['pack', '--workspaces=false', '--ignore-scripts', '--json', '--pack-destination', temporary], {encoding:'utf8'}));
  const packed = Array.isArray(packResult) ? packResult[0] : packResult['@cortexmemory/sdk'];
  const destination = join(temporary, 'node_modules/@cortexmemory/sdk');
  mkdirSync(destination, {recursive:true});
  execFileSync('tar', ['-xzf', join(temporary, packed.filename), '--strip-components=1', '-C', destination]);
  const entry = join(destination, 'dist/index.js');
  const esm = await import(pathToFileURL(entry));
  const cjs = createRequire(join(temporary, 'consumer.cjs'))('@cortexmemory/sdk');
  const requirePacked = createRequire(join(temporary, 'consumer.cjs'));
  const runtimeEntry = join(destination, 'dist/client-runtime/index.js');
  const graphEntry = join(destination, 'dist/graph-runtime/index.js');
  for (const runtime of [await import(pathToFileURL(runtimeEntry)), requirePacked('@cortexmemory/sdk/runtime')]) {
    assert.equal(typeof runtime.CortexRuntimeClient, 'function');
    assert.equal(typeof runtime.CortexRuntimeClient.prototype.submitAndStart, 'function');
    assert.equal(new runtime.CortexRuntimeError('FORBIDDEN').code, 'FORBIDDEN');
    assert.equal(runtime.RUNTIME_ASSET_MAX_BYTES, 20_000_000);
  }
  for (const graph of [await import(pathToFileURL(graphEntry)), requirePacked('@cortexmemory/sdk/runtime/graph')]) {
    assert.equal(typeof graph.CortexGraphWorker, 'function');
    assert.equal(typeof graph.ConvexGraphWorkerTransport, 'function');
    assert.equal(typeof graph.CypherProjectionConnector, 'function');
  }
  const manifest = JSON.parse(readFileSync(join(destination, 'dist/backend/v1/manifest.json'), 'utf8'));
  assert.equal(manifest.sdkVersion, JSON.parse(readFileSync(join(destination, 'package.json'), 'utf8')).version);
  assert.ok(manifest.files.length > 0);
  const paths = new Set();
  for (const file of manifest.files) {
    assert.match(file.path, /^(?:[A-Za-z0-9_.]+\/)*[A-Za-z0-9_.]+\.ts$/);
    assert.ok(file.path.split('/').every(piece => piece !== '.' && piece !== '..'));
    assert.ok(!paths.has(file.path), `Duplicate packaged backend file: ${file.path}`);
    paths.add(file.path);
    const bytes = readFileSync(join(destination, 'dist/backend/v1', file.path));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256, `Packaged backend digest: ${file.path}`);
  }
  for (const required of ['runs.ts', 'runtimeAgent.ts', 'runtimeMemory.ts', 'runtimeAssetsHttp.ts', 'cliOperator/admin.ts', 'cliOperator/facts.ts', '_cortex/schema.ts', '_cortex/components.config.ts', '_cortex/http.ts']) {
    assert.ok(paths.has(required), `Missing installed runtime contract: ${required}`);
  }
  for (const sdk of [esm,cjs]) {
    assert.equal(typeof sdk.Cortex, 'function');
    assert.equal(typeof sdk.getPresetForPlan, 'function');
    assert.equal(typeof sdk.MemoryValidationError, 'function');
    for (const style of ['query','path']) {
      for (const id of ['literal%2Fvalue','percent%','space and + plus','café/雪?&=']) {
        assert.equal(sdk.extractShareId(sdk.buildShareUrl(id, {baseUrl:'https://example.com',style}), {style}), id);
      }
    }
  }
  writeFileSync(join(temporary, 'consumer.mts'), `
    import {Cortex, MemoryValidationError, getPresetForPlan} from '@cortexmemory/sdk';
    import {CortexRuntimeClient, type TextSubmitV1, type RuntimeObservation, type RuntimeAdmissionResult, type RuntimeLatencyEvent} from '@cortexmemory/sdk/runtime';
    import {CortexGraphWorker, type CortexGraphWorkerOptions} from '@cortexmemory/sdk/runtime/graph';
    const cortex = new Cortex({convexUrl:'https://example.convex.cloud'});
    const preset = getPresetForPlan('free');
    const error = new MemoryValidationError('example', 'EXAMPLE');
    async function verify(dynamic: boolean) {
      const raw = await cortex.memory.get('space','memory'); raw?.content;
      const enriched = await cortex.memory.get('space','memory',{includeConversation:true}); enriched?.memory.content;
      const found = await cortex.memory.search('space','query'); found[0]?.content;
      const rich = await cortex.memory.search('space','query',{enrichConversation:true}); rich[0]?.memory.content;
      const listed = await cortex.memory.list({memorySpaceId:'space'}); listed[0]?.content;
      const facts = await cortex.memory.list({memorySpaceId:'space',enrichFacts:true}); facts[0]?.memory.content;
      const context = await cortex.contexts.get('ctx-example'); context?.contextId;
      const chain = await cortex.contexts.get('ctx-example',{includeChain:true}); chain?.current.contextId;
      const conditional = await cortex.memory.get('space','memory',{includeConversation:dynamic});
      if (conditional && 'memory' in conditional) conditional.memory.content;
    }
    void preset; void error; void verify;
    const request: TextSubmitV1 = {version:1,agentId:'agent',agentVersion:1,clientRequestId:'request',parts:[{type:'text',text:'hello'}]};
    async function runtimeContract(client: CortexRuntimeClient, render: (observation: RuntimeObservation) => void) {
      const combined: RuntimeAdmissionResult = await client.submitAndStart(request, {streaming:true});
      combined.handle.runId; combined.run.attemptNumber; combined.start.state;
      const handle = await client.submit(request);
      const disconnect = client.watchObservation(handle, render);
      await client.start(handle, {streaming:true});
      disconnect(); await client.close();
    }
    function latencyContract(event: RuntimeLatencyEvent) { event.phase; event.atMs; event.rpcId; event.durationMs; }
    function graphContract(options: CortexGraphWorkerOptions) { return new CortexGraphWorker(options); }
    void runtimeContract; void graphContract; void latencyContract;
  `);
  execFileSync(resolve('node_modules/.bin/tsc'), ['--ignoreConfig','--noEmit','--strict','--skipLibCheck','--module','NodeNext','--moduleResolution','NodeNext','--target','ES2022',join(temporary,'consumer.mts')], {stdio:'inherit'});
  const bundled = await build({entryPoints:[entry],platform:'browser',bundle:true,format:'iife',globalName:'CortexSDK',write:false});
  const sandbox = {crypto:globalThis.crypto,TextEncoder,TextDecoder,URL,URLSearchParams,Headers,Response,Request,fetch,WebSocket:globalThis.WebSocket,setTimeout,clearTimeout,setInterval,clearInterval,console};
  const context = vm.createContext(sandbox);
  vm.runInContext(bundled.outputFiles[0].text,context);
  await vm.runInContext(`(async () => {
    if (typeof process !== 'undefined' || typeof require !== 'undefined') throw Error('Node globals must be unavailable');
    const cortex = new CortexSDK.Cortex({convexUrl:'https://example.convex.cloud'});
    await cortex.shutdown();
  })()`,context);
  const runtimeBrowser = await build({entryPoints:[runtimeEntry],platform:'browser',bundle:true,format:'iife',globalName:'CortexRuntime',write:false});
  const runtimeContext = vm.createContext({...sandbox});
  vm.runInContext(runtimeBrowser.outputFiles[0].text, runtimeContext);
  vm.runInContext(`
    if (typeof process !== 'undefined' || typeof require !== 'undefined') throw Error('Runtime needs Node globals');
    if (typeof CortexRuntime.CortexRuntimeClient !== 'function') throw Error('Runtime constructor missing');
    if (typeof CortexRuntime.CortexRuntimeClient.prototype.submitAndStart !== 'function') throw Error('Combined admission missing');
    if (CortexRuntime.RUNTIME_ASSET_MAX_BYTES !== 20000000) throw Error('Private delivery cap changed');
    if (new CortexRuntime.CortexRuntimeError('FORBIDDEN').code !== 'FORBIDDEN') throw Error('Typed runtime error missing');
  `, runtimeContext);
  console.log('Packed root/runtime/graph ESM+CJS, backend manifest bytes, consumer declarations, URL round trips and root/runtime browser execution passed.');
} finally {
  rmSync(temporary,{recursive:true,force:true});
}
