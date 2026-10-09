import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import ts from "typescript";
import { build } from "esbuild";
import { stageNativeCiBackend } from "../lib/ci-backend-stage.mjs";
import { buildBackendDistribution } from "../backend/build-distribution.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

async function files(directory, prefix = "") {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const name = prefix + entry.name;
    if (entry.isDirectory()) result.push(...await files(join(directory, entry.name), name + "/"));
    else result.push(name);
  }
  return result.sort();
}

function relativeImports(name, text) {
  const ast = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true);
  const result = new Set();
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) result.add(node.moduleSpecifier.text);
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) result.add(node.argument.literal.text);
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === "require") && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) result.add(node.arguments[0].text);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return [...result].filter(name => name.startsWith("."));
}

test("the real canonical native stage preserves every relative source import and its own Convex tsconfig", async () => {
  const stage = await mkdtemp(join(tmpdir(), "cortex-native-stage-control-"));
  try {
    await stageNativeCiBackend({ sourceRoot: root, stageRoot: stage });
    const names = new Set(await files(stage));
    for (const name of ["src/domain/model-policy.ts", "src/domain/media-jobs.ts", "src/auth/verified.ts", "src/common/userExportSupport.ts", "src/types/index.ts", "convex-dev/tsconfig.json", "convex-dev/_generated/api.js", "convex-dev/_generated/server.d.ts"])
      assert.deepEqual(await readFile(join(stage, name)), await readFile(join(root, name)), name);
    assert.ok(!names.has("tsconfig.json"), "the canonical Convex config is self-contained");
    assert.deepEqual(JSON.parse(await readFile(join(stage, "convex.json"))), { functions: "convex-dev/" });
    for (const name of [...names].filter(name => /\.(?:ts|js)$/.test(name))) {
      for (const specifier of relativeImports(name, await readFile(join(stage, name), "utf8"))) {
        const base = resolve(dirname(join(stage, name)), specifier).slice(stage.length + 1).replaceAll("\\", "/");
        const source = base.replace(/\.js$/, "");
        assert.ok([base, source + ".ts", source + ".tsx", source + ".d.ts", source + "/index.ts", source + "/index.js"].some(candidate => names.has(candidate)), `${name} has an unresolved staged import: ${specifier}`);
      }
    }
    for (const name of await readdir(join(root, "tests/fixtures/native"))) {
      if (!name.endsWith(".ts")) continue;
      assert.equal(await readFile(join(stage, "convex-dev", name), "utf8"), (await readFile(join(root, "tests/fixtures/native", name), "utf8")).replaceAll("../../../convex-dev/", "./"));
    }
    // This is offline verification using the actual versioned bindings. Native
    // codegen and its deployment remain enabled in the guarded CI entry point.
    execFileSync(process.execPath, [join(root, "node_modules/typescript/bin/tsc"), "--project", join(stage, "convex-dev/tsconfig.json"), "--noEmit"], { cwd: stage, timeout: 120000, stdio: "pipe" });
    const bundle = await build({ entryPoints: [join(stage, "convex-dev/runtimeGateway.ts"), join(stage, "convex-dev/runtimeMediaGateway.ts"), join(stage, "convex-dev/schema.ts")], outdir: join(stage, "bundle"), bundle: true, write: false, packages: "external", platform: "node", format: "esm", logLevel: "silent" });
    assert.equal(bundle.outputFiles.length, 3);
  } finally { await rm(stage, { recursive: true, force: true }); }
});

test("native fixture sources remain outside the published runtime distribution", async () => {
  const output = await mkdtemp(join(tmpdir(), "cortex-published-stage-control-"));
  try {
    const manifest = await buildBackendDistribution({ sourceRoot: root, outputRoot: output });
    const fixtureNames = new Set(await readdir(join(root, "tests/fixtures/native")));
    assert.ok(manifest.files.some(file => file.sourcePath === "src/domain/model-policy.ts"));
    assert.ok(manifest.files.some(file => file.sourcePath === "src/domain/media-jobs.ts"));
    for (const file of manifest.files) {
      assert.match(file.sourcePath, /^(?:convex-dev|src)\//);
      assert.ok(!fixtureNames.has(file.path), `private fixture entered the published runtime: ${file.path}`);
      assert.ok(!/(?:^|\/)(?:tests|fixtures|__tests__|_generated|_DEPRECATED)\//.test(file.sourcePath));
      assert.ok(!/(?:\.env|\.(?:tgz|zip|json)$)/.test(file.path));
    }
  } finally { await rm(output, { recursive: true, force: true }); }
});

test("source staging excludes credentials, archives, accidental tests and symlinks", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cortex-source-filter-control-"));
  const source = join(directory, "source"), stage = join(directory, "stage");
  try {
    const entries = {
      "package.json": '{"name":"source-control","dependencies":{}}',
      "convex-dev/schema.ts": "export const canonical = true;",
      "convex-dev/tsconfig.json": "{}",
      "src/domain/model-policy.ts": "export const canonical = true;",
      "src/.env.local": "PRIVATE_CREDENTIAL=sentinel",
      "convex-dev/.env.native-ci": "PRIVATE_CREDENTIAL=sentinel",
      "src/credentials.json": '{"secret":"sentinel"}',
      "src/archive.tgz": "private archive",
      "src/archives/old.ts": "archived source",
      "src/fixtures/private.ts": "accidental fixture",
      "src/domain/model-policy.test.ts": "accidental test",
      "convex-dev/__tests__/private.ts": "accidental test",
      "outside-secret.ts": "private external source",
      "tests/fixtures/native/trustedNative.ts": 'export { canonical } from "../../../convex-dev/schema";',
    };
    for (const [name, text] of Object.entries(entries)) { await mkdir(dirname(join(source, name)), { recursive: true }); await writeFile(join(source, name), text); }
    await mkdir(join(source, "node_modules")); await mkdir(stage);
    await symlink(join(source, "outside-secret.ts"), join(source, "src/leak.ts"));
    await stageNativeCiBackend({ sourceRoot: source, stageRoot: stage });
    assert.deepEqual(await files(stage), ["convex-dev/schema.ts", "convex-dev/trustedNative.ts", "convex-dev/tsconfig.json", "convex.json", "package.json", "src/domain/model-policy.ts"]);
    assert.equal(await readFile(join(source, "src/.env.local"), "utf8"), "PRIVATE_CREDENTIAL=sentinel");
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("unqualified native targets refuse before staging or reading local credentials", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cortex-native-guard-control-"));
  try {
    const scratch = join(directory, "scratch"); await mkdir(scratch);
    await writeFile(join(directory, ".env.local"), "CONVEX_DEPLOY_KEY=private-guard-sentinel\n");
    const env = { PATH: process.env.PATH, TMPDIR: scratch, CI: "true", CORTEX_CI_PREPARE_NATIVE_FIXTURES: "true", CORTEX_CI_TARGET_CLASS: "isolated-native", CORTEX_CI_NATIVE_CONTAINER_ID: "abcdef123456", CORTEX_CI_NATIVE_OWNER: "guard-123", CONVEX_URL: "http://127.0.0.1:53310", CORTEX_CI_EXPECTED_CONVEX_URL: "http://127.0.0.1:53310", CORTEX_TEST_EXPECTED_CONVEX_URL: "http://127.0.0.1:53310", CONVEX_DEPLOY_KEY: "private-guard-sentinel" };
    for (const invalid of [{ CORTEX_CI_NATIVE_OWNER: "" }, { CORTEX_CI_NATIVE_CONTAINER_ID: "" }, { CORTEX_CI_EXPECTED_CONVEX_URL: "http://127.0.0.1:3210" }, { CONVEX_URL: "https://foreign.convex.cloud", CORTEX_CI_EXPECTED_CONVEX_URL: "https://foreign.convex.cloud", CORTEX_TEST_EXPECTED_CONVEX_URL: "https://foreign.convex.cloud" }]) {
      const result = spawnSync(process.execPath, [join(root, "scripts/prepare-ci-backend.mjs")], { cwd: directory, env: { ...env, ...invalid }, encoding: "utf8", timeout: 10000 });
      assert.equal(result.status, 1); assert.equal(result.stdout, "");
      assert.match(result.stderr, /Native fixture preparation requires/); assert.ok(!result.stderr.includes("private-guard-sentinel"));
      assert.deepEqual(await readdir(scratch), []);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
