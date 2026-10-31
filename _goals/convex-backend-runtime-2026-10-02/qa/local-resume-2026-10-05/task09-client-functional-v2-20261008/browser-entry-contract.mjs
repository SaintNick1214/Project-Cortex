import { build } from "esbuild";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const root = process.cwd();
const qa = path.dirname(new URL(import.meta.url).pathname);
const runtime = path.join(root, "src/client-runtime/index.ts");
const remote = path.join(root, "packages/vercel-ai-provider/src/remote/index.ts");
const results = [];
for (const [name, entry] of [["runtime", runtime], ["remote", remote]]) {
  const result = await build({ entryPoints: [entry], bundle: true, platform: "browser", format: "esm", write: false,
    metafile: true, alias: { "@cortexmemory/sdk/runtime": runtime }, logLevel: "silent" });
  const inputs = Object.keys(result.metafile.inputs);
  const forbidden = inputs.filter(input => /(?:neo4j|@ai-sdk\/|node_modules\/ai\/|src\/index\.ts$|src\/runtime\.ts$|runtimeGateway|runtimeModelPolicy|dotenv|node_modules\/openai\/|@anthropic-ai)/.test(input));
  assert.deepEqual(forbidden, [], `${name} imported a server, graph or inference module`);
  for (const input of Object.values(result.metafile.inputs)) {
    assert.equal(input.imports.some(item => item.external && (/^node:/.test(item.path) || ["fs", "path", "crypto", "os", "http", "https"].includes(item.path))), false);
  }
  const text = result.outputFiles[0].text;
  results.push({ condition: `${name} resolves and bundles for a browser without Node/SDK-root/graph/provider inference imports`, passed: true,
    entry, inputs, bytes: Buffer.byteLength(text), sha256: createHash("sha256").update(text).digest("hex") });
}
const sdk = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const provider = JSON.parse(await readFile(path.join(root, "packages/vercel-ai-provider/package.json"), "utf8"));
assert.deepEqual(sdk.exports["."], { types: "./dist/index.d.ts", import: "./dist/index.js", require: "./dist/index.cjs" });
assert.deepEqual(provider.exports["."], { types: "./dist/src/index.d.ts", import: "./dist/src/index.js", require: "./dist/src/index.cjs" });
for (const [name, pkg, prefix, subpath] of [["runtime", sdk, root, "./runtime"], ["remote", provider, path.join(root, "packages/vercel-ai-provider"), "./remote"]]) {
  const exports = pkg.exports[subpath];
  for (const key of ["types", "import", "require"]) {
    const bytes = await readFile(path.join(prefix, exports[key])); assert.ok(bytes.length);
    if (key === "types") assert.equal(/from ["']@cortexmemory\/sdk["']|neo4j|node:|apiKey|OPENAI_API_KEY/.test(bytes.toString()), false);
  }
  results.push({ condition: `${name} ESM/CJS/types public subpath exists and preserves established root exports`, passed: true });
}
await writeFile(path.join(qa, "browser-entry-contract-results1.json"), JSON.stringify({ scope: "offline built browser/package boundary", passed: results.length, failed: 0, results }, null, 2) + "\n");
console.log(`${results.length}/${results.length} browser/package contracts PASS`);
