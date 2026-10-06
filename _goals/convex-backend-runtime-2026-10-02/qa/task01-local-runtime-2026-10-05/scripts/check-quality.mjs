import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const owned = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repo = resolve(owned, "../../../..");
const fixture = join(owned, "fixture");
const evidence = join(owned, "evidence");
const oldFixture = resolve(owned, "../task01/fixture");
const hash = file => createHash("sha256").update(readFileSync(file)).digest("hex");
const files = root => readdirSync(root, { withFileTypes: true }).flatMap(entry => {
  if (["node_modules", "_generated"].includes(entry.name)) return [];
  const path = join(root, entry.name);
  return entry.isDirectory() ? files(path) : entry.isFile() ? [path] : [];
});
const startedAt = new Date().toISOString();
const { ESLint } = await import(pathToFileURL(join(repo, "node_modules/eslint/lib/api.js")));
const { default: rootConfig } = await import(pathToFileURL(join(repo, "eslint.config.js")));
const oldRelative = relative(repo, oldFixture);
const newRelative = relative(repo, fixture);
// Keep the root's applicable rules and exclusions, replacing only the QA-wide
// ignore and the relocated fixture's explicit TypeScript project selector.
const config = rootConfig.map(part => ({
  ...part,
  ...(part.ignores ? { ignores: part.ignores.filter(pattern => pattern !== "_goals/**/qa/**/*") } : {}),
  ...(part.files ? { files: part.files.map(pattern => pattern.replaceAll(oldRelative, newRelative)) } : {}),
  ...(part.languageOptions?.parserOptions?.project ? {
    languageOptions: {
      ...part.languageOptions,
      parserOptions: {
        ...part.languageOptions.parserOptions,
        tsconfigRootDir: repo,
        project: Array.isArray(part.languageOptions.parserOptions.project)
          ? part.languageOptions.parserOptions.project.map(project => project.replaceAll(oldRelative, newRelative))
          : part.languageOptions.parserOptions.project.replaceAll(oldRelative, newRelative),
      },
    },
  } : {}),
}));
const linter = new ESLint({ cwd: repo, overrideConfigFile: true, overrideConfig: config });
const lintFiles = files(fixture).filter(file => /\.(ts|mjs)$/.test(file)).concat(fileURLToPath(import.meta.url));
const lint = await linter.lintFiles(lintFiles);
writeFileSync(join(evidence, "fixture-lint.json"), JSON.stringify(lint, null, 2) + "\n");
const errors = lint.reduce((sum, result) => sum + result.errorCount, 0);
const fatalErrors = lint.reduce((sum, result) => sum + result.fatalErrorCount, 0);
const warnings = lint.reduce((sum, result) => sum + result.warningCount, 0);
const suppressedMessages = lint.reduce((sum, result) => sum + result.suppressedMessages.length, 0);
const syntax = files(fixture).filter(file => file.endsWith(".mjs")).concat(fileURLToPath(import.meta.url)).map(file => {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  return { file: relative(repo, file), exitCode: result.status, stdout: result.stdout, stderr: result.stderr };
});
writeFileSync(join(evidence, "syntax.json"), JSON.stringify(syntax, null, 2) + "\n");
const rootLock = JSON.parse(readFileSync(join(repo, "package-lock.json")));
const fixtureLock = JSON.parse(readFileSync(join(fixture, "package-lock.json")));
const packageResults = Object.entries(fixtureLock.packages).filter(([path]) => path).map(([path, lock]) => {
  assert.deepEqual(lock, rootLock.packages[path], "Exact relevant root lock entry differs: " + path);
  const installedPath = join(fixture, path, "package.json");
  if (!existsSync(installedPath)) {
    assert.equal(lock.optional, true, "Missing nonoptional locked package: " + path);
    return { path, version: lock.version, integrity: lock.integrity, installed: false, reason: "Optional package omitted for this platform" };
  }
  const installed = JSON.parse(readFileSync(installedPath));
  assert.equal(installed.version, lock.version, "Installed version differs: " + path);
  return { path, version: lock.version, integrity: lock.integrity, installed: true };
});
const manifest = JSON.parse(readFileSync(join(fixture, "package.json")));
const lockMatrix = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies }).map(name => {
  const root = rootLock.packages["node_modules/" + name];
  return { name, version: root.version, integrity: root.integrity };
});
writeFileSync(join(evidence, "lock-runtime.json"), JSON.stringify({
  version: 1, observedAt: new Date().toISOString(), node: process.version,
  npm: spawnSync("npm", ["--version"], { encoding: "utf8" }).stdout.trim(),
  repositoryNodeFloor: manifest.engines.node, packageManager: manifest.packageManager,
  fixtureLockSha256: hash(join(fixture, "package-lock.json")), rootLockSha256: hash(join(repo, "package-lock.json")),
  exactRelevantRootEntries: true, lockMatrix, packageResults,
}, null, 2) + "\n");
const receipt = {
  version: 1, startedAt, finishedAt: new Date().toISOString(), scope: "standalone fixture only",
  rootConfigSha256: hash(join(repo, "eslint.config.js")),
  selection: "inherited root rules with QA-wide ignore removed and fixture project path relocated; product source unchanged",
  lintFiles: lint.length, errors, fatalErrors, warnings, suppressedMessages, syntaxFiles: syntax.length,
  syntaxPass: syntax.every(result => result.exitCode === 0),
  relevantLockEntries: packageResults.length, installedLockedPackages: packageResults.filter(result => result.installed).length,
  status: errors === 0 && suppressedMessages === 0 && syntax.every(result => result.exitCode === 0) ? "PASS" : "FAIL",
  serviceCalls: 0, deployments: 0, paidInference: 0,
};
writeFileSync(join(evidence, "quality-receipt.json"), JSON.stringify(receipt, null, 2) + "\n");
console.log(JSON.stringify(receipt));
process.exitCode = receipt.status === "PASS" ? 0 : 1;
