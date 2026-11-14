/** Qualify the exact local tarball in an independent, offline npm consumer. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import vm from "node:vm";
import { build } from "esbuild";
import { CANDIDATE_VERSION } from "./package-candidate.mjs";
import { publishedControls, qualifyUpgrade, qualifyTableCollision, seedHost, regularFiles } from "./installer-controls.mjs";

const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const sourceRoot = fileURLToPath(new URL("../../", import.meta.url));
const declarations = `
import { Cortex, MemoryValidationError, getPresetForPlan } from '@cortexmemory/sdk';
import { CortexRuntimeClient, RUNTIME_EXTERNAL_LIMITS, RUNTIME_CHANGE_TYPES,
  type RuntimeExternalSourceInput, type RuntimeExternalBatchResult, type RuntimeExternalReceipt,
  type RuntimeExternalSourceVersion, type RuntimeExternalHistoryPage, type RuntimeExternalSearchPage,
  type RuntimeExternalIngestResult, type RuntimeExternalCapabilities, type RuntimeChangesPage,
  type RuntimeChangeEvent, type RuntimeChangeType, type RuntimeExternalTombstoneInput,
  type RuntimeRememberInput, type RuntimeRememberResult, type RuntimeObservation,
  type RuntimeExternalSourcesClient, type RuntimeChangesClient } from '@cortexmemory/sdk/runtime';
import { CortexGraphWorker, type CortexGraphWorkerOptions } from '@cortexmemory/sdk/runtime/graph';
const cortex = new Cortex({convexUrl:'https://example.convex.cloud'});
const source: RuntimeExternalSourceInput = { provider:'archive', externalSourceId:'message-1',
  externalEventId:'capture-1', externalRevision:1, originalText:'Exact source text.\\n',
  author:{id:'author-1',name:'Archive author'}, authoredAt:1, observedAt:2,
  provenance:{location:'archive://message-1',metadata:{replyTo:'message-0'}}, attribution:'unverified_external', extraction:'none' };
async function external(client: CortexRuntimeClient) {
  const sources: Readonly<RuntimeExternalSourcesClient> = client.sources;
  const changes: Readonly<RuntimeChangesClient> = client.changes;
  const batch: RuntimeExternalBatchResult = await sources.ingest({requestId:'batch',sources:[source]});
  for (const item of batch.results) { if (item.status === 'accepted') { const receipt: RuntimeExternalReceipt = item.result.receipt;
    receipt.reference.versionId; receipt.reference.externalRevision; receipt.originalContentHash; item.result.readiness.facts; }
    else { const outcome: 'not_dispatched'|'uncertain' = item.outcome; void outcome; item.retryable; } }
  const version: RuntimeExternalSourceVersion = await sources.get({sourceId:'source',versionId:'version'});
  if (version.kind === 'content') { version.originalText; version.originalContentHash; version.author; version.attribution; }
  else version.reason;
  const history: RuntimeExternalHistoryPage = await sources.history({sourceId:'source',limit:2}); history.nextCursor; history.items;
  const search: RuntimeExternalSearchPage = await sources.search({literal:'Exact',includeHistory:true}); search.watermark; search.completeThroughWatermark;
  const status: RuntimeExternalIngestResult = await sources.status('receipt'); status.readiness.vectors; status.receipt;
  const tombstone: RuntimeExternalTombstoneInput = {sourceId:'source',requestId:'delete',externalEventId:'capture-2',externalRevision:2,observedAt:3,provenance:{}};
  await sources.tombstone(tombstone);
  const page: RuntimeChangesPage = await changes.list({after:'opaque',types:['source.revised'],limit:2});
  const event: RuntimeChangeEvent|undefined = page.events[0]; event?.source.versionId; event?.indexState; event?.failureCode;
  page.nextCursor; page.watermark; page.completeThroughWatermark;
  const capabilities: RuntimeExternalCapabilities = await client.capabilities();
  const none: readonly ['none'] = capabilities.externalSources.extraction;
  const resumable: false = capabilities.largeAssets.resumableUpload;
  const range: false = capabilities.largeAssets.rangeRetrieval;
  const durable: true = capabilities.changes.durable;
  void none; void resumable; void range; void durable;
  const legacy: RuntimeRememberInput = {conversationId:'conversation',requestId:'capture',userMessage:'hello',agentResponse:'hi'};
  const remembered: RuntimeRememberResult = await client.remember(legacy); remembered.receiptId;
  const observe = (value: RuntimeObservation) => value;
  void observe; await client.close();
}
const type: RuntimeChangeType = RUNTIME_CHANGE_TYPES[0];
const limit: number = RUNTIME_EXTERNAL_LIMITS.maxBatchSources;
function graph(options: CortexGraphWorkerOptions) { return new CortexGraphWorker(options); }
void Cortex; void MemoryValidationError; void getPresetForPlan; void cortex; void source; void external; void type; void limit; void graph;
`;

async function pinnedCommandRefusals(cli, sdk, root, environment) {
  const host = path.join(root, "pinned-refusal-host"); await seedHost(host);
  await fs.mkdir(path.join(host, "node_modules/@cortexmemory"), { recursive: true });
  await fs.cp(sdk, path.join(host, "node_modules/@cortexmemory/sdk"), { recursive: true });
  const baseline = await regularFiles(host), results = [];
  for (const args of [["install", host, "--sdk-package", sdk, "--no-install", "--no-deploy", "--graph", "none", "--yes", "--dry-run"], ["schema", "status", host], ["schema", "sync", host, "--dry-run"]]) {
    const child = spawnSync(process.execPath, [path.join(cli, "dist/index.js"), ...args], { cwd: host, env: environment, encoding: "utf8", timeout: 120_000, maxBuffer: 4 * 1024 * 1024 });
    if (child.error) throw child.error;
    assert.equal(child.status, 1, "Fixed-version command unexpectedly accepted candidate: " + args.join(" "));
    const diagnostic = String(child.stderr || child.stdout);
    assert.match(diagnostic, /0\.39\.0|SDK_PACKAGE_VERSION_MISMATCH|SDK_VERSION_MISMATCH|SDK package version/i);
    assert.deepEqual(await regularFiles(host), baseline, "Fixed-version refusal changed host files");
    results.push({ command: args[0] === "schema" ? "schema " + args[1] : args[0], rejectedCandidate: true, hostBytesPreserved: true });
  }
  return results;
}

export async function verifyPackage({ archive, artifacts, stateFile }) {
  archive = path.resolve(archive); artifacts = path.resolve(artifacts);
  await fs.mkdir(artifacts, { recursive: true });
  const temporary = await fs.realpath(await fs.mkdtemp(path.join(tmpdir(), "cortex-external-consumer-")));
  const consumer = path.join(temporary, "consumer"); await fs.mkdir(consumer);
  const environment = { ...process.env };
  for (const key of Object.keys(environment)) if (/^(?:CONVEX|CORTEX|OPENAI|ANTHROPIC|GOOGLE|GEMINI|NEO4J|MEMGRAPH)_/.test(key)) delete environment[key];
  try {
    const sourceLock = JSON.parse(await fs.readFile(path.join(sourceRoot, "package-lock.json"), "utf8"));
    // Root SDK's optional model factories contain dynamic imports. Install those
    // peer packages explicitly for the legacy root browser bundle check; they
    // are never constructed or contacted by this contract qualification.
    const optionalPeers = Object.fromEntries(["openai", "@anthropic-ai/sdk"].map(name => [name, sourceLock.packages["node_modules/" + name].version]));
    const consumerPackage = { name: "external-evidence-tarball-consumer", version: "1.0.0", private: true, type: "module", dependencies: { "@cortexmemory/sdk": "file:" + archive, ...optionalPeers } };
    await fs.writeFile(path.join(consumer, "package.json"), JSON.stringify(consumerPackage, null, 2) + "\n");
    // Retain the already qualified dependency versions instead of asking cached
    // registry metadata to select newer range releases whose tarballs are absent.
    // npm still installs independent package bytes into this fresh consumer.
    const sourcePackage = JSON.parse(await fs.readFile(path.join(sourceRoot, "package.json"), "utf8"));
    const seededPackages = Object.fromEntries(Object.entries(sourceLock.packages).filter(([name, value]) => name.startsWith("node_modules/") && !value.link));
    seededPackages["node_modules/@cortexmemory/sdk"] = { version: CANDIDATE_VERSION, resolved: "file:" + archive,
      integrity: "sha512-" + createHash("sha512").update(await fs.readFile(archive)).digest("base64"),
      dependencies: sourcePackage.dependencies, peerDependencies: sourcePackage.peerDependencies, peerDependenciesMeta: sourcePackage.peerDependenciesMeta,
      engines: sourcePackage.engines, license: sourcePackage.license };
    await fs.writeFile(path.join(consumer, "package-lock.json"), JSON.stringify({ name: consumerPackage.name, version: consumerPackage.version,
      lockfileVersion: 3, requires: true, packages: { "": { name: consumerPackage.name, version: consumerPackage.version, dependencies: consumerPackage.dependencies }, ...seededPackages } }, null, 2) + "\n");
    const installed = spawnSync("npm", ["install", "--offline", "--ignore-scripts", "--workspaces=false", "--no-audit", "--no-fund", archive], { cwd: consumer, env: environment, encoding: "utf8", timeout: 300_000, maxBuffer: 16 * 1024 * 1024 });
    await fs.writeFile(path.join(artifacts, "consumer-install.log"), (installed.stdout ?? "") + (installed.stderr ?? ""));
    if (installed.error) throw installed.error;
    assert.equal(installed.status, 0, "Offline consumer install failed; inspect consumer-install.log");
    const sdk = path.join(consumer, "node_modules/@cortexmemory/sdk");
    assert.equal((await fs.lstat(sdk)).isSymbolicLink(), false, "Consumer must install package bytes, not a workspace link");
    const pkg = JSON.parse(await fs.readFile(path.join(sdk, "package.json"), "utf8")); assert.equal(pkg.version, CANDIDATE_VERSION);
    const requireConsumer = createRequire(path.join(consumer, "consumer.cjs"));
    const rootImports = [await import(pathToFileURL(path.join(sdk, "dist/index.js"))), requireConsumer("@cortexmemory/sdk")];
    for (const root of rootImports) { assert.equal(typeof root.Cortex, "function"); assert.equal(typeof root.MemoryValidationError, "function"); assert.equal(typeof root.getPresetForPlan, "function"); }
    const runtimeImports = [await import(pathToFileURL(path.join(sdk, "dist/client-runtime/index.js"))), requireConsumer("@cortexmemory/sdk/runtime")];
    for (const runtime of runtimeImports) {
      assert.deepEqual(runtime.RUNTIME_CHANGE_TYPES, ["source.created", "source.revised", "source.tombstoned", "source.index.ready", "source.index.failed"]);
      assert.equal(runtime.RUNTIME_EXTERNAL_LIMITS.maxBatchSources, 25); assert.equal(runtime.RUNTIME_EXTERNAL_LIMITS.maxSourceBytes, 64000);
      assert.equal(runtime.RUNTIME_ASSET_MAX_BYTES, 20_000_000);
      assert.equal(typeof runtime.CortexRuntimeClient.prototype.remember, "function"); assert.equal(typeof runtime.CortexRuntimeClient.prototype.submitAndStart, "function");
      assert.equal(typeof runtime.CortexRuntimeClient.prototype.capabilities, "function");
      const port = { setAuth: (_token, changed) => changed(true), query: async () => { throw new Error("Contract check must not dispatch"); },
        mutation: async () => { throw new Error("Contract check must not dispatch"); }, action: async () => { throw new Error("Contract check must not dispatch"); }, onUpdate: () => { throw new Error("Contract check must not subscribe"); }, close: async () => {} };
      const client = new runtime.CortexRuntimeClient({ deploymentUrl: "https://contract.invalid", fetchToken: async () => null, client: port });
      assert.ok(Object.isFrozen(client.sources)); assert.ok(Object.isFrozen(client.changes));
      for (const method of ["ingest", "get", "history", "search", "status", "tombstone"]) assert.equal(typeof client.sources[method], "function");
      assert.equal(typeof client.changes.list, "function"); await client.close();
    }
    for (const graph of [await import(pathToFileURL(path.join(sdk, "dist/graph-runtime/index.js"))), requireConsumer("@cortexmemory/sdk/runtime/graph")]) assert.equal(typeof graph.CortexGraphWorker, "function");
    await fs.writeFile(path.join(consumer, "consumer.mts"), declarations);
    execFileSync(path.join(sourceRoot, "node_modules/.bin/tsc"), ["--ignoreConfig", "--noEmit", "--strict", "--skipLibCheck", "--module", "NodeNext", "--moduleResolution", "NodeNext", "--target", "ES2022", path.join(consumer, "consumer.mts")], { cwd: consumer, env: environment, stdio: "pipe" });
    const sandbox = { crypto: globalThis.crypto, TextEncoder, TextDecoder, URL, URLSearchParams, Headers, Response, Request, fetch, WebSocket: globalThis.WebSocket, setTimeout, clearTimeout, setInterval, clearInterval, console };
    for (const [name, entry] of [["CortexSDK", "dist/index.js"], ["CortexRuntime", "dist/client-runtime/index.js"]]) {
      const bundled = await build({ entryPoints: [path.join(sdk, entry)], platform: "browser", bundle: true, format: "iife", globalName: name, write: false });
      const context = vm.createContext({ ...sandbox }); vm.runInContext(bundled.outputFiles[0].text, context);
      assert.equal(vm.runInContext("typeof process", context), "undefined"); assert.equal(vm.runInContext("typeof require", context), "undefined");
      if (name === "CortexSDK") await vm.runInContext("(async () => { const sdk = new CortexSDK.Cortex({convexUrl:'https://contract.invalid'}); await sdk.shutdown(); })()", context);
      else vm.runInContext("if (CortexRuntime.RUNTIME_EXTERNAL_LIMITS.maxBatchSources !== 25 || CortexRuntime.RUNTIME_CHANGE_TYPES.length !== 5 || typeof CortexRuntime.CortexRuntimeClient.prototype.capabilities !== 'function') throw Error('Browser external contract missing')", context);
    }
    const manifest = JSON.parse(await fs.readFile(path.join(sdk, "dist/backend/v1/manifest.json"), "utf8"));
    for (const file of manifest.files) assert.equal(hash(await fs.readFile(path.join(sdk, "dist/backend/v1", file.path))), file.sha256);
    const controls = await publishedControls(sourceRoot);
    let upgrade, collision, fixedVersionRefusals;
    try {
      upgrade = await qualifyUpgrade({ cliDirectory: controls.cli.directory, oldSdk: controls.sdk.directory, candidateSdk: sdk, host: path.join(controls.temporary, "actual-candidate-upgrade") });
      collision = await qualifyTableCollision({ cliDirectory: controls.cli.directory, sdk, host: path.join(controls.temporary, "actual-candidate-collision") });
      fixedVersionRefusals = await pinnedCommandRefusals(controls.cli.directory, sdk, controls.temporary, environment);
    } finally { await controls.cleanup(); }
    const receipt = { schemaVersion: 1, actualCandidate: true, version: CANDIDATE_VERSION, archive: path.basename(archive), archiveSha256: hash(await fs.readFile(archive)),
      install: { offline: true, lifecycleScripts: false, workspaceSymlink: false, optionalModelPeersForLegacyRootBrowserBundle: optionalPeers, dependencySelection: "Fresh consumer lock seeded with repository locked dependency versions; npm resolves/prunes that graph and installs independent cached bytes.", command: "npm install --offline --ignore-scripts --workspaces=false --no-audit --no-fund <exact-local-tarball>",
        dependencyCount: Object.keys(JSON.parse(await fs.readFile(path.join(consumer, "package-lock.json"), "utf8")).packages).length - 1 },
      contracts: { root: ["ESM", "CJS"], runtime: ["ESM", "CJS", "external_sources", "changes", "capabilities", "legacy_methods"], graph: ["ESM", "CJS"],
        consumerTypeScript: true, browserRootExecution: true, browserRuntimeExecution: true, noNodeGlobals: true, backendManifestDigests: true },
      installer: { publicCliVersion: "0.39.0", publicCliSha256: "cbff7c3415ffc710a4517d386861253374b575a37872d3b56a12f8cc602eb24d", upgrade, collision, fixedVersionRefusals },
      liveDeployment: false, limitations: ["Browser VM/bundler contract execution is not interactive browser or JWT authentication testing.", "Published CLI artifacts are immutable; CLI dependencies are borrowed from the installed dependency tree."] };
    await fs.writeFile(path.join(artifacts, "package-qualification.json"), JSON.stringify(receipt, null, 2) + "\n");
    if (stateFile) {
      const state = JSON.parse(await fs.readFile(stateFile, "utf8")); state.packageQualification = receipt.archiveSha256;
      await fs.writeFile(stateFile, JSON.stringify(state, null, 2) + "\n");
    }
    return receipt;
  } finally { await fs.rm(temporary, { recursive: true, force: true }); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [archive, artifacts, stateFile] = process.argv.slice(2);
  const receipt = await verifyPackage({ archive, artifacts, stateFile });
  console.log(JSON.stringify({ version: receipt.version, archiveSha256: receipt.archiveSha256, contracts: receipt.contracts, installerUpgrade: true, offlineConsumerInstall: true }));
}
