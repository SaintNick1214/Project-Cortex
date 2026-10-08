import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { installAdditiveBackend } from '../../../../../packages/cortex-cli/src/utils/init/additive-backend.ts';

const cwd = process.cwd();
const run = process.argv[2] ?? '2';
const controlledInstalledDependencies = process.argv[3] === 'installed-qualified';
const qa = path.join(cwd, '_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task06-additive-functional-v2-20261008');
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'cortex-packed-backend-'));
const report: Record<string, unknown> = { version: 1, startedAt: new Date().toISOString(), cwd, node: process.version, coverage: 'offline packed consumer; no deployment, no paid calls, no live Task06 acceptance', checks: [], temporary };
async function command(name: string, args: string[], working: string, log: string) {
  const result = await new Promise<{ exit: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(name, args, { cwd: working, env: process.env }); let stdout = '', stderr = '';
    const timer = setTimeout(() => child.kill('SIGTERM'), 120000);
    child.stdout.on('data', (chunk) => stdout += chunk); child.stderr.on('data', (chunk) => stderr += chunk);
    child.once('error', reject); child.once('close', (exit) => { clearTimeout(timer); resolve({ exit, stdout, stderr }); });
  });
  await fs.writeFile(path.join(qa, log), JSON.stringify({ command: [name, ...args], cwd: working, ...result }, null, 2) + '\n');
  if (result.exit !== 0) throw new Error(`${name} exited ${result.exit}; see ${log}`);
  return result.stdout;
}
function check(name: string, condition: boolean) { if (!condition) throw new Error(name); (report.checks as string[]).push(name); }
try {
  const packOutput = JSON.parse(await command('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', temporary], cwd, `pack-command${run}.json`));
  const packed = Array.isArray(packOutput) ? packOutput[0] : packOutput['@cortexmemory/sdk'];
  if (!packed?.filename) throw new Error('npm pack did not return the selected SDK package');
  report.package = { filename: packed.filename, shasum: packed.shasum, integrity: packed.integrity, sourceFiles: packed.files.filter((file: { path: string }) => file.path.startsWith('dist/backend/v1/')).length };
  const host = path.join(temporary, 'host'); await fs.mkdir(host);
  await fs.writeFile(path.join(host, 'package.json'), JSON.stringify({ name: 'cortex-installed-host-fixture', private: true, type: 'module', dependencies: { '@cortexmemory/sdk': `file:${path.join(temporary, packed.filename)}` } }, null, 2));
  const sdk = path.join(host, 'node_modules/@cortexmemory/sdk');
  if (controlledInstalledDependencies) {
    await fs.mkdir(sdk, { recursive: true });
    await command('tar', ['-xzf', path.join(temporary, packed.filename), '--strip-components=1', '-C', sdk], cwd, `consumer-extract-command${run}.json`);
    const dependencies = JSON.parse(await fs.readFile(path.join(sdk, 'dist/backend/v1/manifest.json'), 'utf8')).dependencies;
    const linked: Record<string, unknown>[] = [];
    const bare = new Set([...Object.keys(dependencies), '@ai-sdk/provider']);
    for (const name of bare) {
      const source = path.join(cwd, 'node_modules', name);
      const destination = path.join(host, 'node_modules', name);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.symlink(source, destination, 'dir');
      const metadata = await fs.readFile(path.join(source, 'package.json'), 'utf8');
      linked.push({ name, version: JSON.parse(metadata).version, sourcePackageJsonSha256: crypto.createHash('sha256').update(metadata).digest('hex'), source });
    }
    report.dependencies = { mode: 'controlled already-installed qualified package bytes; not a clean registry install', linked, registryInstallStatus: 'blocked: declared ai@7.0.127 returned ETARGET, preserved in run3' };
  } else {
    await command('npm', ['install', '--ignore-scripts', '--registry=https://registry.npmjs.org', '--cache', path.join(temporary, 'npm-cache'), '--omit=optional', '--package-lock=false', '--no-audit', '--no-fund'], host, `consumer-install-command${run}.json`);
  }
  check('packed SDK has no repository src directory', !(await fs.stat(path.join(sdk, 'src')).catch(() => null)));
  const manifest = JSON.parse(await fs.readFile(path.join(sdk, 'dist/backend/v1/manifest.json'), 'utf8'));
  report.distribution = { id: manifest.distributionId, files: manifest.files.length, tables: manifest.tables.length, components: manifest.components };
  const functions = 'services/host-backend';
  await fs.mkdir(path.join(host, functions), { recursive: true });
  const hostConfig = JSON.stringify({ functions: functions + '/', codegen: { staticApi: true } });
  const hostSchema = 'import { defineSchema, defineTable } from "convex/server"; import { v } from "convex/values";\nexport default defineSchema({ hostTasks: defineTable({ title: v.string() }).index("by_title", ["title"]) });\n';
  const hostFunction = 'export const hostValue = 42;\n';
  await fs.writeFile(path.join(host, 'convex.json'), hostConfig);
  await fs.writeFile(path.join(host, functions, 'schema.ts'), hostSchema);
  await fs.writeFile(path.join(host, functions, 'hostFunction.ts'), hostFunction);
  const installation = await installAdditiveBackend(host, sdk);
  check('host config preserved byte-for-byte', await fs.readFile(path.join(host, 'convex.json'), 'utf8') === hostConfig);
  check('unrelated host function preserved byte-for-byte', await fs.readFile(path.join(host, functions, 'hostFunction.ts'), 'utf8') === hostFunction);
  let localImports = 0, dependencyImports = 0, generatedImports = 0;
  for (const entry of manifest.files) {
    const file = path.join(host, functions, entry.path);
    const text = await fs.readFile(file, 'utf8');
    check(`installed digest ${entry.path}`, crypto.createHash('sha256').update(text).digest('hex') === entry.sha256);
    const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    for (const node of ast.statements) {
      if (!(ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) || !node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) continue;
      const specifier = node.moduleSpecifier.text;
      check(`no repo-only src import ${entry.path}:${specifier}`, !specifier.includes('../src/'));
      if (specifier.startsWith('./_generated/')) { generatedImports++; continue; }
      if (specifier.startsWith('.')) {
        const base = path.resolve(path.dirname(file), specifier.replace(/\.js$/, ''));
        check(`installed local import ${entry.path}:${specifier}`, Boolean(await fs.stat(base + '.ts').catch(() => null) || await fs.stat(path.join(base, 'index.ts')).catch(() => null)));
        localImports++;
      } else { createRequire(file).resolve(specifier); dependencyImports++; }
    }
  }
  report.imports = { localImports, dependencyImports, generatedImports, generatedCoverage: 'ordinary Convex codegen owns these bindings; actual target gate pending Task05' };
  check('runtime schema inspection uses composed host schema, not the installation fragment', /import schema from [\"']\.\/schema[\"']/.test(await fs.readFile(path.join(host, functions, 'runtimeRegistryAuth.ts'), 'utf8')));
  report.installedDependencyVersions = {};
  for (const name of Object.keys(manifest.dependencies)) {
    const metadata = JSON.parse(await fs.readFile(path.join(host, 'node_modules', name, 'package.json'), 'utf8'));
    (report.installedDependencyVersions as Record<string, string>)[name] = metadata.version;
  }
  const profile = await import(pathToFileURL(path.join(host, functions, '_cortex/shared/domain/profile.ts')).href);
  check('installed shared module executes without repository source', profile.DEFAULT_EMBEDDING_PROFILE.dimensions === 1536);
  const schema = await import(pathToFileURL(path.join(host, functions, 'schema.ts')).href);
  check('installed host schema evaluates preserved host table and all Cortex table maps', Object.keys(schema.default.tables).length === manifest.tables.length + 1 && Boolean(schema.default.tables.hostTasks));
  const retry = await installAdditiveBackend(host, sdk);
  check('packed consumer retry performs zero writes', retry.installed.length === 0);
  report.installation = { installed: installation.installed.length, unchangedOnRetry: retry.unchanged.length, capabilities: installation.capabilities };
  report.result = controlledInstalledDependencies ? 'PASS_OFFLINE_CONTROLLED_INSTALLED_DEPENDENCIES' : 'PASS_OFFLINE';
} catch (error) { report.result = 'FAIL'; report.error = (error as Error).message; process.exitCode = 1; }
finally {
  await fs.rm(temporary, { recursive: true, force: true });
  report.cleanup = { ownedTemporaryRemoved: !(await fs.stat(temporary).catch(() => null)), noServiceTarget: true };
  report.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(qa, `packed-consumer-report${run}.json`), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ result: report.result, checks: (report.checks as unknown[]).length, error: report.error, cleanup: report.cleanup }));
}
