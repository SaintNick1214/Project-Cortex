import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';

const expectedSource='9fb9687536af0b7abfcb7280e0aa26ef450051ea';
assert.match(expectedSource,/^[a-f0-9]{40}$/,'Root accepted commit GO required');
// Extract the npm tarball: source imports cannot validate the package export map.
const temporary = mkdtempSync("/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/sandbox-chat-latency-2026-10-12/kit-checks-managed-source/packed-contract-");
try {
  const receipt = JSON.parse(readFileSync("/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/manual-sandbox-managed-source-2026-10-14/image/archives/manifest.json", 'utf8'));
  const packed = receipt.packages.find(row => row.role === 'sdk');
  assert.equal(receipt.sourceCommit, expectedSource);
  assert.equal(receipt.backend.files, 170);
  const actualArchive = join("/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/manual-sandbox-managed-source-2026-10-14/image/archives", packed.filename);
  assert.equal(createHash('sha256').update(readFileSync(actualArchive)).digest('hex'), packed.sha256);
  const destination = join(temporary, 'node_modules/@cortexmemory/sdk');
  mkdirSync(destination, {recursive:true});
  execFileSync('tar', ['-xzf', actualArchive, '--strip-components=1', '-C', destination]);
  const entry = join(destination, 'dist/index.js');
  const esm = await import(pathToFileURL(entry));
  const cjs = createRequire(join(temporary, 'consumer.cjs'))('@cortexmemory/sdk');
  const requirePacked = createRequire(join(temporary, 'consumer.cjs'));
  const runtimeEntry = join(destination, 'dist/client-runtime/index.js');
  const graphEntry = join(destination, 'dist/graph-runtime/index.js');
  for (const relative of ['dist/client-runtime/index.js','dist/client-runtime/index.cjs']) {
    const text = readFileSync(join(destination, relative), 'utf8');
    assert.ok(text.includes('runtimeClient:submitAndStartEnvelope'));
    assert.ok(text.includes('runtimeClient:session'));
    assert.ok(text.includes('probeAuthenticationDenial') && text.includes('AUTH_PROBE_ORIGIN_CHANGED'), 'Fresh authentication refusal probe bundled in both runtime formats');
  }
  for (const runtime of [await import(pathToFileURL(runtimeEntry)), requirePacked('@cortexmemory/sdk/runtime')]) {
    assert.equal(typeof runtime.CortexRuntimeClient, 'function');
    assert.equal(typeof runtime.CortexRuntimeClient.prototype.submitAndStart, 'function');
    assert.equal(typeof runtime.CortexRuntimeClient.prototype.recall, 'function');
    assert.equal(typeof runtime.CortexRuntimeClient.prototype.remember, 'function');
    assert.equal(typeof runtime.CortexRuntimeClient.prototype.rememberStatus, 'function');
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
  assert.equal(manifest.files.length, 170);
  assert.equal(manifest.tables.length, 78); assert.deepEqual(manifest.components, ['agent','workflow']);
  assert.ok(manifest.tables.includes('runtimeIngestionSequenceHeads'));
  for(const table of ['runtimeRunMemoryProgress','runtimeMemoryCaptureConversations','runtimeMemoryCaptures','runtimeMemoryCaptureMessages'])assert.ok(manifest.tables.includes(table));
  const paths = new Set();
  for (const file of manifest.files) {
    assert.match(file.path, /^(?:[A-Za-z0-9_.]+\/)*[A-Za-z0-9_.]+\.ts$/);
    assert.ok(file.path.split('/').every(piece => piece !== '.' && piece !== '..'));
    assert.ok(!paths.has(file.path), `Duplicate packaged backend file: ${file.path}`);
    paths.add(file.path);
    const bytes = readFileSync(join(destination, 'dist/backend/v1', file.path));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256, `Packaged backend digest: ${file.path}`);
  }
  for (const required of ['runs.ts', 'runtimeAgent.ts', 'runtimeAgentRecall.ts', 'runtimeAgentQueryEmbedding.ts', 'runtimeMemoryCapture.ts','runtimeMemoryQuery.ts','runtimeMemoryRefusal.ts','_cortex/shared/domain/model_input_selection.ts','runtimeGateway.ts', 'runtimeIngestion.ts', 'runtimeMemory.ts', 'runtimeAssetsHttp.ts', 'cliOperator/admin.ts', 'cliOperator/facts.ts', '_cortex/schema.ts', '_cortex/components.config.ts', '_cortex/http.ts']) {
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
    import {CortexRuntimeClient, type TextSubmitV1, type RuntimeObservation, type RuntimeAdmissionResult, type RuntimeLatencyEvent, type RuntimeRememberInput, type RuntimeRememberResult} from '@cortexmemory/sdk/runtime';
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
      const memory = await client.recall({text:'synthetic query',requestId:'one-semantic-id',limit:10});
      memory.profileId; memory.items[0]?.content;
      const captureInput: RuntimeRememberInput = {conversationId:'capture-label',requestId:'retained-request',userMessage:'synthetic input',agentResponse:'synthetic output'};
      const captured: RuntimeRememberResult = await client.remember(captureInput);
      captured.messageIds[0]; captured.sourceEventIds[1]; captured.memoryStatus; captured.historyRevision;
      const captureStatus: RuntimeRememberResult = await client.rememberStatus(captured.receiptId); captureStatus.stages.vectors[1];
      disconnect(); await client.close();
    }
    function latencyContract(event: RuntimeLatencyEvent) { event.phase; event.atMs; event.rpcId; event.durationMs; }
    function graphContract(options: CortexGraphWorkerOptions) { return new CortexGraphWorker(options); }
    void runtimeContract; void graphContract; void latencyContract;
  `);
  execFileSync(resolve('node_modules/.bin/tsc'), ['--ignoreConfig','--noEmit','--strict','--skipLibCheck','--module','NodeNext','--moduleResolution','NodeNext','--target','ES2022',join(temporary,'consumer.mts')], {stdio:'inherit',cwd:'/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion'});
  const bundled = await build({entryPoints:[entry],platform:'browser',bundle:true,format:'iife',globalName:'CortexSDK',write:false});
  const sandbox = {crypto:globalThis.crypto,TextEncoder,TextDecoder,URL,URLSearchParams,Headers,Response,Request,fetch:() => { throw Error('No network in package contract'); },WebSocket:class { constructor() { setTimeout(() => this.onopen?.(), 0); } close() { this.onclose?.(); } send() { throw Error('No socket writes in package contract'); } },setTimeout,clearTimeout,setInterval,clearInterval,console};
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
    if (typeof CortexRuntime.CortexRuntimeClient.prototype.remember !== 'function' || typeof CortexRuntime.CortexRuntimeClient.prototype.rememberStatus !== 'function') throw Error('Managed capture missing');
    if (CortexRuntime.RUNTIME_ASSET_MAX_BYTES !== 20000000) throw Error('Private delivery cap changed');
    if (new CortexRuntime.CortexRuntimeError('FORBIDDEN').code !== 'FORBIDDEN') throw Error('Typed runtime error missing');
  `, runtimeContext);
  console.log('Packed root/runtime/graph ESM+CJS, backend manifest bytes, consumer declarations, URL round trips and root/runtime browser execution passed.');
} finally {
  rmSync(temporary,{recursive:true,force:true});
}
