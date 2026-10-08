import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import vm from "node:vm";
import { build } from "esbuild";

const root = "/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion";
const here = path.dirname(new URL(import.meta.url).pathname);
const candidate = JSON.parse(fs.readFileSync(path.join(here, "../native-actual/packages-current1.json"), "utf8"));
const temporary = fs.mkdtempSync(path.join(root, "node_modules/.cortex-runtime-assets-"));
const started = Date.now();
let outcome = { status: "FAIL" };
try {
  const packed = fs.readFileSync(candidate.sdk.file);
  assert.equal(crypto.createHash("sha256").update(packed).digest("hex"), candidate.sdk.sha256);
  const destination = path.join(temporary, "node_modules/@cortexmemory/sdk");
  fs.mkdirSync(destination, { recursive: true });
  execFileSync("tar", ["-xzf", candidate.sdk.file, "--strip-components=1", "-C", destination], { timeout: 30000 });
  const require = createRequire(path.join(temporary, "consumer.cjs"));
  const esmEntry = path.join(destination, "dist/client-runtime/index.js");
  const esm = await import(pathToFileURL(esmEntry));
  const cjs = require("@cortexmemory/sdk/runtime");
  for (const exports of [esm, cjs]) {
    assert.equal(exports.RUNTIME_ASSET_MAX_BYTES, 20_000_000);
    assert.equal(typeof exports.CortexRuntimeError, "function");
    for (const method of ["uploadAsset", "getAsset", "fetchAsset", "createAssetUrl", "close"]) {
      assert.equal(typeof exports.CortexRuntimeClient.prototype[method], "function", method);
    }
  }
  fs.writeFileSync(path.join(temporary, "consumer.mts"), `
    import {CortexRuntimeClient, RUNTIME_ASSET_MAX_BYTES} from '@cortexmemory/sdk/runtime';
    import type {RuntimeAssetReference, RuntimeAssetVersion, RuntimeAssetPreview} from '@cortexmemory/sdk/runtime';
    async function consume(client: CortexRuntimeClient, reference: RuntimeAssetReference) {
      const uploaded: RuntimeAssetVersion = await client.uploadAsset(new Uint8Array([1]), {mimeType:'application/octet-stream',requestId:'contract'});
      const current: RuntimeAssetVersion = await client.getAsset(reference);
      const bytes: Blob = await client.fetchAsset(reference, {timeoutMs:1000});
      const preview: RuntimeAssetPreview = await client.createAssetUrl(reference);
      preview.revoke();
      void uploaded; void current; void bytes;
    }
    void RUNTIME_ASSET_MAX_BYTES; void consume;
  `);
  execFileSync(path.join(root, "node_modules/.bin/tsc"), ["--ignoreConfig", "--noEmit", "--strict", "--skipLibCheck", "--module", "NodeNext", "--moduleResolution", "NodeNext", "--target", "ES2022", path.join(temporary, "consumer.mts")], { timeout: 40000, stdio: "inherit" });
  const bundled = await build({ entryPoints: [esmEntry], platform: "browser", bundle: true, format: "iife", globalName: "CortexRuntime", write: false, metafile: true });
  const inputs = Object.keys(bundled.metafile.inputs);
  assert.equal(inputs.some(p => /neo4j|graph-runtime|graph\/runtime|dist\/backend|cortex-runtime-toolchain/.test(p)), false);
  const context = vm.createContext({ crypto: globalThis.crypto, TextEncoder, TextDecoder, URL, URLSearchParams, Headers, Response, Request, Blob, AbortController, fetch, setTimeout, clearTimeout, setInterval, clearInterval, console });
  vm.runInContext(bundled.outputFiles[0].text, context, { timeout: 1000 });
  await vm.runInContext(`(async () => {
    if (typeof process !== 'undefined' || typeof Buffer !== 'undefined' || typeof require !== 'undefined') throw Error('Node globals must be unavailable');
    const port = {setAuth(_fetch, ready) {ready(true)}, query() {throw Error('No services')}, mutation() {throw Error('No services')}, action() {throw Error('No services')}, onUpdate() {return () => {}}, close() {throw Error('Shared client remains caller owned')}};
    const client = new CortexRuntime.CortexRuntimeClient({deploymentUrl:'https://example.convex.cloud',fetchToken:async()=>null,client:port});
    await client.close();
    if (CortexRuntime.RUNTIME_ASSET_MAX_BYTES !== 20000000) throw Error('Application asset cap export changed');
  })()`, context, { timeout: 1000 });
  outcome = { status: "PASS", assertions: ["Exact native packed candidate digest", "Public runtime ESM/CJS asset exports", "Installed asset consumer declarations", "Browser runtime bundle without graph/backend dependencies or Node globals", "Caller-owned client closes without service effects"], browserInputCount: inputs.length };
} catch (error) {
  outcome.error = String(error);
  process.exitCode = 1;
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
  const receipt = { version: 1, timestampUtc: new Date().toISOString(), scope: "PACKED_RUNTIME_ASSET_PUBLIC_BROWSER_CONTRACT_NO_SERVICES", node: process.version, cwd: root, command: [process.execPath, path.join(here, "packed-runtime-assets1.mjs")], durationMs: Date.now() - started, packedCandidate: candidate.sdk.sha256, ...outcome, temporaryConsumerRemoved: !fs.existsSync(temporary), actualServiceAcceptance: false };
  fs.writeFileSync(path.join(here, "packed-runtime-assets1.json"), JSON.stringify(receipt, null, 2) + "\n");
  console.log(JSON.stringify(receipt));
}
