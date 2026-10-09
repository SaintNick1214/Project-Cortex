import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import {
  assembleCatalog, writeAssembly, AssemblyError, stableJson, hashBytes, payloadHash,
} from "../scripts/assemble.mjs";

const execute = promisify(execFile);
const script = fileURLToPath(new URL("../scripts/assemble.mjs", import.meta.url));
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const version = "1.1.0";
const ids = ["basic", "vercel-ai-quickstart", "chat-sdk"];

async function fixture(t, order = ids) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "cortex-catalog-fixture-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const selections = [];
  for (const id of order) {
    const root = path.join(directory, id);
    await fs.mkdir(path.join(root, "src"), { recursive: true });
    const manifest = {
      name: id === "basic" ? "{{PROJECT_NAME}}" : `fixture-${id}`,
      version, private: true, engines: { node: ">=20" },
      ...(id === "chat-sdk" ? { packageManager: "pnpm@10.33.0" } : {}),
      scripts: { build: "tsc", dev: "tsx src/main.ts" },
      dependencies: {
        "@cortexmemory/sdk": id === "basic" ? "^0.38.0" : "file:../../../sdk",
        ...(id === "basic" ? {} : { "@cortexmemory/vercel-ai-provider": "file:../../../provider" }),
        convex: "1.46.0",
      },
    };
    const files = [
      ["package.json", JSON.stringify(manifest, null, 2) + "\n"],
      ["src/main.ts", `export const app = ${JSON.stringify(id)};\n`],
      [".env.example", "CONVEX_URL=\nOPENAI_API_KEY=\n"],
      ["run.sh", "#!/bin/sh\nexit 0\n"],
    ];
    for (const [name, bytes] of order[0] === "chat-sdk" ? files.reverse() : files) {
      await fs.writeFile(path.join(root, name), bytes);
    }
    await fs.chmod(path.join(root, "run.sh"), 0o755);
    selections.push({ id, version, source: root, provenance: `fixture/${id}@${version}`, manager: id === "chat-sdk" ? "pnpm" : "npm", envNames: ["OPENAI_API_KEY", "CONVEX_URL"], envExamples: [".env.example"], backend: true, graph: true });
  }
  return { directory, selections };
}
async function manifest(selection, update) {
  const target = path.join(selection.source, "package.json");
  const value = JSON.parse(await fs.readFile(target, "utf8"));
  update(value);
  await fs.writeFile(target, JSON.stringify(value));
}
const errorCode = code => error => error instanceof AssemblyError && error.code === code;

test("canonical hash helpers match independently computed CLI wire rules", () => {
  assert.equal(stableJson({ z: 1, a: { y: 2, x: 3 }, list: [{ b: 2, a: 1 }] }), '{"a":{"x":3,"y":2},"list":[{"a":1,"b":2}],"z":1}');
  const files = new Map([["z.txt", Buffer.from("z")], ["a.txt", Buffer.from("a")]]);
  assert.equal(hashBytes(Buffer.from("a")), sha(Buffer.from("a")));
  assert.equal(payloadHash(files), sha(Buffer.from(JSON.stringify([["a.txt", sha(Buffer.from("a"))], ["z.txt", sha(Buffer.from("z"))]]))));
  assert.throws(() => stableJson(undefined), errorCode("CATALOG_INPUT_INVALID"));
});

test("assembly is byte-identical across input/tree order and timestamps with all three managers", async t => {
  const first = await fixture(t);
  const second = await fixture(t, [...ids].reverse());
  await fs.utimes(path.join(second.selections[0].source, "src/main.ts"), 10, 20);
  const a = await assembleCatalog(first.selections);
  const b = await assembleCatalog(second.selections);
  assert.deepEqual(a.catalogBytes, b.catalogBytes);
  assert.deepEqual(a.receipt, b.receipt);
  assert.deepEqual(a.payloads, b.payloads);
  assert.deepEqual(a.catalog.templates.map(item => [item.id, item.manager]), [["basic", "npm"], ["chat-sdk", "pnpm"], ["vercel-ai-quickstart", "npm"]]);
  assert.equal(a.receipt.catalogHash, sha(a.catalogBytes));
  assert.equal(a.catalog.version, "1.0.0");
  assert.equal(a.catalog.schemaVersion, 1);
  assert.equal(a.catalog.apiVersion, 1);
  assert.ok(!a.catalogBytes.includes(Buffer.from(first.directory)));
  assert.ok(!JSON.stringify(a.receipt).includes(first.directory));
});

test("manifest rendering rewrites exactly the four Next development references without altering source or app fields", async t => {
  const { selections } = await fixture(t);
  const before = await Promise.all(selections.map(item => fs.readFile(path.join(item.source, "package.json"))));
  const assembly = await assembleCatalog(selections);
  for (const [index, selection] of selections.entries()) {
    const raw = assembly.payloads.get(`payloads/${selection.id}/${version}/package.json`).bytes;
    const rendered = JSON.parse(raw);
    const original = JSON.parse(before[index]);
    assert.equal(rendered.dependencies["@cortexmemory/sdk"], "^0.38.0");
    if (selection.id !== "basic") assert.equal(rendered.dependencies["@cortexmemory/vercel-ai-provider"], "^0.38.0");
    assert.equal(rendered.name, original.name);
    assert.equal(rendered.version, "1.1.0");
    assert.equal(rendered.private, true);
    assert.deepEqual(rendered.engines, { node: ">=20" });
    assert.deepEqual(rendered.scripts, original.scripts);
    assert.equal(rendered.packageManager, original.packageManager);
    assert.deepEqual(await fs.readFile(path.join(selection.source, "package.json")), before[index]);
    const entry = assembly.catalog.templates.find(item => item.id === selection.id);
    assert.deepEqual(entry.compatibility, { sdk: "^0.38.0", ...(selection.id === "basic" ? {} : { provider: "^0.38.0" }), convex: "1.46.0" });
    assert.deepEqual(entry.envNames, ["CONVEX_URL", "OPENAI_API_KEY"]);
    assert.equal(entry.backend, true);
    assert.equal(entry.graph, true);
    const file = entry.files.find(item => item.path === "package.json");
    assert.equal(file.hash, sha(raw));
    assert.equal(file.bytes, raw.length);
    const receipt = assembly.receipt.templates.find(item => item.id === selection.id).files.find(item => item.path === "package.json");
    assert.equal(receipt.sourceHash, sha(before[index]));
    assert.equal(receipt.transformed, true);
  }
});

test("changing one selected source changes its actual hashes without changing other template payloads", async t => {
  const { selections } = await fixture(t);
  const a = await assembleCatalog(selections);
  await fs.writeFile(path.join(selections[0].source, "src/main.ts"), "upstream change\n");
  const b = await assembleCatalog(selections, "1.0.1");
  const old = a.catalog.templates.find(item => item.id === "basic");
  const next = b.catalog.templates.find(item => item.id === "basic");
  assert.notEqual(next.payloadHash, old.payloadHash);
  assert.notEqual(b.receipt.catalogHash, a.receipt.catalogHash);
  assert.equal(b.catalog.version, "1.0.1");
  for (const id of ["chat-sdk", "vercel-ai-quickstart"]) assert.deepEqual(b.catalog.templates.find(item => item.id === id), a.catalog.templates.find(item => item.id === id));
  assert.equal(next.files.find(item => item.path === "src/main.ts").hash, sha(Buffer.from("upstream change\n")));
});

test("local/generated/lock/credential files are omitted; only explicitly selected examples and executable source survive", async t => {
  const { directory, selections } = await fixture(t);
  const root = selections[0].source;
  for (const name of [".env", ".env.local", ".env.production", ".env.unselected.example", "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "npm-shrinkwrap.json", "bun.lock", "trace.log", "tsconfig.tsbuildinfo", "private.pem", "private.key", "credentials.json"]) await fs.writeFile(path.join(root, name), "synthetic-excluded-sentinel");
  for (const name of [".git", ".convex", ".cortex", ".vercel", "dist", "build", "out", ".next", ".cache", "coverage", "_generated"]) {
    await fs.mkdir(path.join(root, name));
    await fs.writeFile(path.join(root, name, "sentinel"), "synthetic-excluded-sentinel");
  }
  await fs.symlink(directory, path.join(root, "node_modules"));
  const assembly = await assembleCatalog(selections);
  const basic = assembly.catalog.templates.find(item => item.id === "basic");
  assert.deepEqual(basic.files.map(file => file.path), [".env.example", "package.json", "run.sh", "src/main.ts"]);
  assert.equal(basic.files.find(file => file.path === "run.sh").executable, true);
  assert.equal(basic.files.find(file => file.path === "src/main.ts").executable, false);
  assert.ok(![...assembly.payloads.values()].some(file => file.bytes.includes(Buffer.from("synthetic-excluded-sentinel"))));
});

test("documented .env.local.example opt-in is supported by producer and omission remains the default", async t => {
  const { selections } = await fixture(t);
  await fs.writeFile(path.join(selections[1].source, ".env.local.example"), "CONVEX_URL=\n");
  const omitted = await assembleCatalog(selections);
  assert.ok(!omitted.catalog.templates.find(item => item.id === selections[1].id).files.some(file => file.path === ".env.local.example"));
  selections[1].envExamples.push(".env.local.example");
  const selected = await assembleCatalog(selections);
  assert.ok(selected.catalog.templates.find(item => item.id === selections[1].id).files.some(file => file.path === ".env.local.example"));
});

for (const [name, mutate, code] of [
  ["manifest version", value => { value.version = "1.0.0"; }, "CATALOG_MANIFEST_IDENTITY"],
  ["manager", value => { value.packageManager = "pnpm@10.33.0"; }, "CATALOG_MANAGER_MISMATCH"],
  ["old SDK fallback", value => { value.dependencies["@cortexmemory/sdk"] = "^0.36.0"; }, "CATALOG_RELEASE_SPEC_INVALID"],
  ["duplicate SDK maps", value => { value.devDependencies = { "@cortexmemory/sdk": "^0.38.0" }; }, "CATALOG_DEPENDENCY_DUPLICATE"],
  ["unrelated source link", value => { value.dependencies.other = "file:../private"; }, "CATALOG_LOCAL_DEPENDENCY_REFUSED"],
  ["missing SDK", value => { delete value.dependencies["@cortexmemory/sdk"]; }, "CATALOG_REQUIRED_DEPENDENCY"],
  ["Convex link", value => { value.dependencies.convex = "workspace:*"; }, "CATALOG_LOCAL_DEPENDENCY_REFUSED"],
  ["invalid Convex range", value => { value.dependencies.convex = "https://example.test/convex"; }, "CATALOG_CONVEX_COMPATIBILITY"],
]) test(`manifest refuses ${name}`, async t => {
  const { selections } = await fixture(t);
  await manifest(selections[0], mutate);
  await assert.rejects(assembleCatalog(selections), errorCode(code));
});

test("Next provider is required; invalid JSON and missing root manifest refuse", async t => {
  const { selections } = await fixture(t);
  await manifest(selections[1], value => { delete value.dependencies["@cortexmemory/vercel-ai-provider"]; });
  await assert.rejects(assembleCatalog([selections[1]]), errorCode("CATALOG_REQUIRED_DEPENDENCY"));
  await fs.writeFile(path.join(selections[0].source, "package.json"), "{");
  await assert.rejects(assembleCatalog([selections[0]]), errorCode("CATALOG_MANIFEST_INVALID"));
  await fs.unlink(path.join(selections[0].source, "package.json"));
  await assert.rejects(assembleCatalog([selections[0]]), errorCode("CATALOG_MANIFEST_MISSING"));
});

test("selection identity/provenance/env declarations refuse malformed values and exact duplicate tuples", async t => {
  const { selections } = await fixture(t);
  for (const change of [
    { id: "unknown" }, { version: "latest" }, { manager: "pnpm" }, { source: "relative" },
    { provenance: "../private" }, { provenance: "/absolute" }, { graph: "true" },
    { envNames: ["OPENAI_API_KEY", "OPENAI_API_KEY"] }, { envNames: ["invalid-name"] },
    { envExamples: [".env.local"] }, { envExamples: ["../.env.example"] },
    { envExamples: [".cortex/.env.example"] }, { envExamples: [".env.example", ".env.example"] },
  ]) await assert.rejects(assembleCatalog([{ ...selections[0], ...change }]), AssemblyError);
  await assert.rejects(assembleCatalog([selections[0], selections[0]]), errorCode("CATALOG_SELECTION_DUPLICATE"));
  await assert.rejects(assembleCatalog([]), errorCode("CATALOG_INPUT_INVALID"));
  await assert.rejects(assembleCatalog(selections, "latest"), errorCode("CATALOG_INPUT_INVALID"));
  await assert.rejects(assembleCatalog([{ ...selections[0], envExamples: [".env.sample"] }]), errorCode("CATALOG_ENV_EXAMPLE_MISSING"));
  await assert.rejects(assembleCatalog([{ ...selections[0], source: path.join(selections[0].source, "packages/cortex-cli/templates/vercel-ai-quickstart") }]), errorCode("CATALOG_MIRROR_REFUSED"));
});

test("included symlinks and hardlinks refuse while source roots cannot be symlinks", async t => {
  const { directory, selections } = await fixture(t);
  const root = selections[0].source;
  await fs.symlink(path.join(root, "src/main.ts"), path.join(root, "link.ts"));
  await assert.rejects(assembleCatalog([selections[0]]), errorCode("CATALOG_SOURCE_LINK"));
  await fs.unlink(path.join(root, "link.ts"));
  await fs.link(path.join(root, "src/main.ts"), path.join(root, "hard.ts"));
  await assert.rejects(assembleCatalog([selections[0]]), errorCode("CATALOG_SOURCE_LINK"));
  await fs.unlink(path.join(root, "hard.ts"));
  await fs.symlink(root, path.join(directory, "root-link"));
  await assert.rejects(assembleCatalog([{ ...selections[0], source: path.join(directory, "root-link") }]), errorCode("CATALOG_SOURCE_KIND"));
});

test("portable path validation and file budget refuse unsupported source payloads", async t => {
  const { selections } = await fixture(t);
  const root = selections[0].source;
  await fs.writeFile(path.join(root, "drive:name"), "invalid");
  await assert.rejects(assembleCatalog([selections[0]]), errorCode("CATALOG_PATH_INVALID"));
  await fs.unlink(path.join(root, "drive:name"));
  await fs.writeFile(path.join(root, "large.bin"), Buffer.alloc(8 * 1024 * 1024 + 1));
  await assert.rejects(assembleCatalog([selections[0]]), errorCode("CATALOG_PAYLOAD_BUDGET"));
});

test("data-package output has exact catalog/payload bytes, no dependencies/lifecycle, modes and safe existing-output refusal", async t => {
  const { directory, selections } = await fixture(t);
  const assembly = await assembleCatalog(selections);
  const output = path.join(directory, "package");
  const result = await writeAssembly(output, assembly);
  assert.deepEqual(result, { catalogHash: assembly.receipt.catalogHash, templates: 3 });
  assert.deepEqual(await fs.readFile(path.join(output, "catalog.json")), assembly.catalogBytes);
  const published = JSON.parse(await fs.readFile(path.join(output, "package.json"), "utf8"));
  assert.equal(published.name, "@cortexmemory/templates");
  assert.equal(published.version, "1.0.0");
  for (const field of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies", "scripts", "main"]) assert.equal(published[field], undefined);
  assert.deepEqual(published.files, ["catalog.json", "payloads", "README.md"]);
  for (const [name, file] of assembly.payloads) {
    assert.deepEqual(await fs.readFile(path.join(output, name)), file.bytes);
    assert.equal((await fs.stat(path.join(output, name))).mode & 0o777, file.executable ? 0o755 : 0o644);
  }
  const before = await fs.readFile(path.join(output, "catalog.json"));
  await assert.rejects(writeAssembly(output, assembly), errorCode("CATALOG_OUTPUT_EXISTS"));
  assert.deepEqual(await fs.readFile(path.join(output, "catalog.json")), before);
  await assert.rejects(writeAssembly(path.join(selections[0].source, "generated"), assembly), errorCode("CATALOG_OUTPUT_INSIDE_SOURCE"));
  await assert.rejects(writeAssembly("relative", assembly), errorCode("CATALOG_OUTPUT_INVALID"));
});

test("actual assembler subprocess joins with deterministic success and invalid later selection makes zero output", async t => {
  const { directory, selections } = await fixture(t);
  const configuration = path.join(directory, "inputs.json");
  const home = path.join(directory, "home");
  await fs.mkdir(home);
  const env = { PATH: path.dirname(process.execPath), HOME: home, TMPDIR: directory };
  await fs.writeFile(configuration, JSON.stringify({ catalogVersion: "1.0.0", templates: selections }));
  const output = path.join(directory, "cli-output");
  const result = await execute(process.execPath, [script, configuration, output], { env, timeout: 10000, maxBuffer: 65536 });
  assert.equal(result.stderr, "");
  const printed = JSON.parse(result.stdout);
  assert.equal(printed.catalogHash, sha(await fs.readFile(path.join(output, "catalog.json"))));
  assert.equal(printed.templates, 3);
  await manifest(selections[2], value => { value.version = "0.1.0"; });
  const refused = path.join(directory, "must-not-exist");
  await assert.rejects(execute(process.execPath, [script, configuration, refused], { env, timeout: 10000, maxBuffer: 65536 }), error => error.code === 1 && error.stderr.trim() === "CATALOG_MANIFEST_IDENTITY" && error.stdout === "");
  await assert.rejects(fs.stat(refused), error => error.code === "ENOENT");
});


test("Basic npm requirement becomes explicit capability without changing dependencies or app version", async t => {
  const { selections } = await fixture(t);
  await manifest(selections.find(s => s.id === "basic"), value => { value.engines.npm = ">=11.0.0"; });
  const assembled = await assembleCatalog(selections);
  assert.equal(assembled.catalog.templates.find(s => s.id === "basic").managerMinimum, "11.0.0");
  assert.equal(assembled.catalog.templates.find(s => s.id === "chat-sdk").managerMinimum, undefined);
  const rendered = JSON.parse(assembled.payloads.get("payloads/basic/1.1.0/package.json").bytes);
  assert.equal(rendered.version, "1.1.0");
  assert.equal(rendered.engines.npm, ">=11.0.0");
  assert.equal(rendered.dependencies.convex, "1.46.0");
  await manifest(selections.find(s => s.id === "basic"), value => { value.engines.npm = ">=10"; });
  await assert.rejects(assembleCatalog(selections), errorCode("CATALOG_MANAGER_MINIMUM_UNSUPPORTED"));
});
