import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/node_modules/typescript/lib/typescript.js';

const root = '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion';
const q = dirname(fileURLToPath(import.meta.url));
const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const printer = ts.createPrinter({ removeComments: true });
const digest = value => createHash('sha256').update(value).digest('hex');
const before = file => execFileSync('git', ['show', head + ':' + file], { cwd: root, encoding: 'utf8', maxBuffer: 2000000 });
function parse(source) { return ts.createSourceFile('source.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS); }
function find(tree, predicate) {
  let found;
  function walk(node) { if (!found && predicate(node)) found = node; if (!found) ts.forEachChild(node, walk); }
  walk(tree); assert.ok(found, 'Required original/current AST node is absent'); return found;
}
function printed(tree, node) { return printer.printNode(ts.EmitHint.Unspecified, node, tree); }
function body(tree, name) {
  return find(tree, node => (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) && node.name?.getText(tree) === name).body;
}
const checks = [];
function same(label, oldTree, oldNode, newTree, newNode) {
  const a = printed(oldTree, oldNode), b = printed(newTree, newNode); assert.equal(b, a, label + ' changed');
  checks.push({ label, identical: true, canonicalAstSha256: digest(a) });
}
const oldClient = parse(before('convex-dev/runtimeClient.ts'));
const newClient = parse(await readFile(join(root, 'convex-dev/runtimeClient.ts'), 'utf8'));
const oldSession = find(oldClient, node => ts.isVariableDeclaration(node) && node.name.getText(oldClient) === 'session');
const oldSessionHandler = find(oldSession, node => ts.isPropertyAssignment(node) && node.name.getText(oldClient) === 'handler').initializer;
same('original session handler body', oldClient, oldSessionHandler.body, newClient, body(newClient, 'sessionHandler'));
same('combined admission handler body', oldClient, body(oldClient, 'submitAndStartHandler'), newClient, body(newClient, 'submitAndStartHandler'));
same('payload-free signal registration', oldClient, find(oldClient, node => ts.isVariableDeclaration(node) && node.name.getText(oldClient) === 'signal'),
  newClient, find(newClient, node => ts.isVariableDeclaration(node) && node.name.getText(newClient) === 'signal'));
const oldSdk = parse(before('src/client-runtime/client.ts'));
const newSdk = parse(await readFile(join(root, 'src/client-runtime/client.ts'), 'utf8'));
for (const name of ['inSession', 'session', 'installAuth', 'refreshAuth', 'sessionDeadline', 'trackDelivery', 'call', 'watchRun', 'watchObservation', 'close', 'submitAndStart', 'cancel']) {
  same('SDK ' + name + ' body', oldSdk, body(oldSdk, name), newSdk, body(newSdk, name));
}
const oldAgent = parse(before('convex-dev/runtimeAgent.ts'));
const newAgent = parse(await readFile(join(root, 'convex-dev/runtimeAgent.ts'), 'utf8'));
same('original private observe handler body', oldAgent, body(oldAgent, 'observeHandler'), newAgent, body(newAgent, 'observeHandler'));
const result = { status: 'PASS', head, nodeVersion: process.version, typescriptVersion: ts.version, checks,
  scope: 'AST equivalence of original authorization/projection and retained SDK fences; no native service/OCC or latency result' };
await writeFile(join(q, 'cloud-observation-composition-equivalence.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(result));
