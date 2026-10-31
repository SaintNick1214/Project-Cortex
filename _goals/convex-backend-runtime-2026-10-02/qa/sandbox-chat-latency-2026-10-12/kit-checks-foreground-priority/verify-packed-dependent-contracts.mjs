import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import vm from "node:vm";
import { build } from "esbuild";
const q = path.dirname(new URL(import.meta.url).pathname);
const kit = "/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/manual-sandbox-foreground-priority-2026-10-14";
const sha = "be39655e09fdee69907a6ba81b096e5a44067945";
assert.match(sha, /^[a-f0-9]{40}$/, 'Root accepted commit GO required');
const receipt = JSON.parse(fs.readFileSync(path.join(kit, "image/archives/manifest.json"), "utf8"));
assert.equal(receipt.sourceCommit, sha);
const temporary = fs.mkdtempSync(path.join(q, "dependent-contract-"));
try {
  for (const row of receipt.packages) {
    const archive = path.join(kit, "image/archives", row.filename);
    assert.equal(createHash("sha256").update(fs.readFileSync(archive)).digest("hex"), row.sha256);
    const destination = path.join(temporary, "node_modules", row.name);
    fs.mkdirSync(destination, { recursive: true });
    execFileSync("tar", ["-xzf", archive, "--strip-components=1", "-C", destination]);
    assert.equal(JSON.parse(fs.readFileSync(path.join(destination, "package.json"))).version, row.version);
  }
  const providerRoot = path.join(temporary, "node_modules/@cortexmemory/vercel-ai-provider");
  const packedRequire = createRequire(path.join(temporary, "consumer.cjs"));
  for (const [subpath, file, exported] of [["", "dist/src/index.js", "createCortexMemory"], ["/react", "dist/react/index.js", "useLayerTracking"], ["/remote", "dist/remote/index.js", "CortexRemoteTransport"]]) {
    const esm = await import(pathToFileURL(path.join(providerRoot, file)));
    const cjs = packedRequire("@cortexmemory/vercel-ai-provider" + subpath);
    assert.equal(typeof esm[exported], "function"); assert.equal(typeof cjs[exported], "function");
  }
  fs.writeFileSync(path.join(temporary, "consumer.mts"), `
    import {createCortexMemory} from '@cortexmemory/vercel-ai-provider';
    import {useLayerTracking, useArtifacts} from '@cortexmemory/vercel-ai-provider/react';
    import {CortexRemoteTransport, type CortexRemoteTransportOptions} from '@cortexmemory/vercel-ai-provider/remote';
    import type {CortexRuntimeClient} from '@cortexmemory/sdk/runtime';
    function contract(client: CortexRuntimeClient) {
      const options: CortexRemoteTransportOptions = {client, agentId:'agent', agentVersion:1, onObservation: value => { value.run.responseStatus; value.approvals; }};
      const remote = new CortexRemoteTransport(options); remote.disconnect();
      return remote;
    }
    void createCortexMemory; void useLayerTracking; void useArtifacts; void contract;
  `);
  execFileSync(path.resolve("node_modules/.bin/tsc"), ["--ignoreConfig", "--noEmit", "--strict", "--skipLibCheck", "--module", "NodeNext", "--moduleResolution", "NodeNext", "--target", "ES2022", path.join(temporary, "consumer.mts")], { stdio: "inherit", cwd: "/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion" });
  for (const [file, globalName, exported] of [["dist/react/index.js", "CortexReact", "useArtifacts"], ["dist/remote/index.js", "CortexRemote", "CortexRemoteTransport"]]) {
    const bundled = await build({entryPoints:[path.join(providerRoot, file)], platform:"browser", bundle:true, format:"iife", globalName, write:false});
    const sandbox = {crypto:globalThis.crypto, TextEncoder, TextDecoder, URL, URLSearchParams, Headers, Response, Request, ReadableStream, fetch:() => { throw Error("No network in package contract"); }, setTimeout, clearTimeout, setInterval, clearInterval, console};
    const context = vm.createContext(sandbox);
    vm.runInContext(bundled.outputFiles[0].text, context);
    vm.runInContext(`if(typeof process !== 'undefined' || typeof require !== 'undefined') throw Error('Node globals absent'); if(typeof ${globalName}.${exported} !== 'function') throw Error('Browser export missing');`,context);
    if (globalName === "CortexRemote") vm.runInContext(`const remote = new CortexRemote.CortexRemoteTransport({client:{},agentId:'agent',agentVersion:1}); if(remote.run !== undefined || remote.state !== undefined) throw Error('Unexpected dispatch/state'); remote.disconnect();`,context);
  }
  // A tarball fixture has no npm resolver. Select the CLI workspace's actual declared dependency installations,
  // rather than accidentally inheriting the SDK root's unrelated transitive commander4.1.1.
  const cliRoot = path.join(temporary, "node_modules/@cortexmemory/cli");
  const actualCliRequire = createRequire(path.join(kit, "staging", sha, "packages/cortex-cli/package.json"));
  const cliPackage = JSON.parse(fs.readFileSync(path.join(cliRoot, "package.json")));
  for (const name of Object.keys(cliPackage.dependencies)) {
    if (name.startsWith("@cortexmemory/")) continue; // Keep the actual candidate archives extracted above.
    let directory = path.dirname(actualCliRequire.resolve(name));
    for (;;) {
      const candidate = path.join(directory, "package.json");
      if (fs.existsSync(candidate) && JSON.parse(fs.readFileSync(candidate)).name === name) break;
      const parent = path.dirname(directory); assert.notEqual(parent,directory,`Missing declared dependency ${name}`); directory=parent;
    }
    const target = path.join(cliRoot, "node_modules", name); fs.mkdirSync(path.dirname(target), {recursive:true});
    fs.symlinkSync(directory,target);
  }
  const selectedCommander = JSON.parse(fs.readFileSync(path.join(cliRoot,"node_modules/commander/package.json")));
  assert.match(selectedCommander.version,/^15\./);
  fs.writeFileSync(path.join(q,"packed-cli-dependency-selection.json"), JSON.stringify({declaredRange:cliPackage.dependencies.commander,actualVersion:selectedCommander.version,actualPath:fs.realpathSync(path.join(cliRoot,"node_modules/commander")),preservedPackedSdkAndCatalog:true},null,2)+"\n");
  const cli = path.join(cliRoot, "dist/index.js");
  for (const arg of ["--version", "--help"]) {
    const stdout = execFileSync(process.execPath, [cli, arg], {cwd:temporary, encoding:"utf8", timeout:15000});
    if(arg === "--version") assert.match(stdout, /0\.39\.0/); else assert.match(stdout, /Usage:.*cortex/);
    fs.writeFileSync(path.join(q, arg === "--version" ? "packed-cli-version.log" : "packed-cli-help.log"), stdout);
  }
  process.stdout.write("Prepared provider core/react/remote ESM+CJS exports and declarations, React/remote browser evaluation without Node globals/network, and actual packed CLI version/help passed.\n");
} finally { fs.rmSync(temporary, { recursive: true, force: true }); }
