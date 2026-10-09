'use strict';
// Prospective qualification guard: no synthetic Node version or simulated CLI outcome.
const fs = require('node:fs');
const path = require('node:path');
const { syncBuiltinESMExports } = require('node:module');
const root = process.env.NODE20_QUAL_ROOT;
const audit = process.env.NODE20_QUAL_AUDIT;
const nativeOpen = fs.openSync.bind(fs);
const nativeWrite = fs.writeSync.bind(fs);
const nativeClose = fs.closeSync.bind(fs);
if (!root || !audit || !path.isAbsolute(root) || fs.realpathSync(root) !== root ||
    audit !== path.join(root, 'audit.jsonl') || process.env.HOME !== path.join(root, 'home') ||
    process.env.TMPDIR !== path.join(root, 'tmp')) throw new Error('QUALIFICATION_GUARD_INPUT_INVALID');
const stat = fs.lstatSync(root);
if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o077) ||
    (process.getuid && stat.uid !== process.getuid())) throw new Error('QUALIFICATION_GUARD_ROOT_INVALID');
const auditInfo = fs.lstatSync(audit);
if (!auditInfo.isFile() || auditInfo.isSymbolicLink() || auditInfo.nlink !== 1 || (auditInfo.mode & 0o077)) throw new Error('QUALIFICATION_AUDIT_INVALID');
const auditFd = nativeOpen(audit, fs.constants.O_WRONLY | fs.constants.O_APPEND | fs.constants.O_NOFOLLOW);
const log = event => nativeWrite(auditFd, JSON.stringify({ ...event, pid: process.pid }) + '\n');
process.on('exit', () => nativeClose(auditFd));
const deny = factory => {
  log({ kind: 'factory-denied', phase: 'product', factory });
  throw new Error('QUALIFICATION_EFFECT_DENIED: ' + factory);
};
for (const [name, names] of [
  ['node:child_process', ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']],
  ['node:http', ['request', 'get', 'createServer']],
  ['node:https', ['request', 'get', 'createServer']],
  ['node:tls', ['connect', 'createServer']],
  ['node:dns', ['lookup', 'resolve', 'resolve4', 'resolve6']],
  ['node:dgram', ['createSocket']],
]) {
  const module = require(name);
  for (const factory of names) module[factory] = () => deny(name + '.' + factory);
}
const net = require('node:net');
net.Socket.prototype.connect = () => deny('net.Socket.connect');
net.Server.prototype.listen = () => deny('net.Server.listen');
globalThis.fetch = () => deny('fetch');
if ('WebSocket' in globalThis) globalThis.WebSocket = class { constructor() { deny('WebSocket'); } };
for (const factory of ['writeFile', 'writeFileSync', 'appendFile', 'appendFileSync', 'mkdir', 'mkdirSync', 'rename', 'renameSync', 'unlink', 'unlinkSync', 'rm', 'rmSync', 'rmdir', 'rmdirSync', 'createWriteStream', 'copyFile', 'copyFileSync', 'chmod', 'chmodSync', 'chown', 'chownSync'])
  fs[factory] = () => deny('fs.' + factory);
const sensitive = file => {
  if (file instanceof URL) file = file.pathname;
  return typeof file === 'string' && /(?:^|\/)(?:\.env[^/]*|cortex\.config\.[^/]+|\.cortexrc[^/]*|credentials\.json)$/.test(file);
};
for (const factory of ['readFile', 'readFileSync', 'stat', 'statSync', 'lstat', 'lstatSync', 'existsSync', 'realpath', 'realpathSync']) {
  const original = fs[factory];
  fs[factory] = function(file, ...args) {
    if (sensitive(file)) deny('fs.' + factory + '.configuration');
    return original.call(this, file, ...args);
  };
}
for (const factory of ['open', 'openSync']) {
  const original = fs[factory];
  fs[factory] = function(file, flags, ...args) {
    if (sensitive(file) || (typeof flags === 'string' ? flags !== 'r' : Boolean(flags & (fs.constants.O_WRONLY | fs.constants.O_RDWR | fs.constants.O_CREAT | fs.constants.O_TRUNC)))) deny('fs.' + factory);
    return original.call(this, file, flags, ...args);
  };
}
const promises = require('node:fs/promises');
for (const factory of ['writeFile', 'appendFile', 'mkdir', 'rename', 'unlink', 'rm', 'rmdir', 'copyFile', 'chmod', 'chown'])
  promises[factory] = async () => deny('fs.promises.' + factory);
for (const factory of ['readFile', 'stat', 'lstat', 'realpath', 'open']) {
  const original = promises[factory];
  promises[factory] = async function(file, ...args) {
    if (sensitive(file) || (factory === 'open' && (typeof args[0] === 'string' ? args[0] !== 'r' : Boolean(args[0] & (fs.constants.O_WRONLY | fs.constants.O_RDWR | fs.constants.O_CREAT | fs.constants.O_TRUNC))))) deny('fs.promises.' + factory);
    return original.call(this, file, ...args);
  };
}
const environment = process.env;
process.env = new Proxy(environment, {
  get(target, key) {
    if (typeof key === 'string' && /^(?:CONVEX_|OPENAI_|ANTHROPIC_|CORTEX_AUTH|RUNTIME_CANARY)/.test(key)) deny('environment.read');
    return Reflect.get(target, key);
  },
  set(target, key, value) {
    if (typeof key === 'string' && /^(?:CONVEX_|OPENAI_|ANTHROPIC_|CORTEX_AUTH|RUNTIME_CANARY)/.test(key)) deny('environment.write');
    return Reflect.set(target, key, value);
  },
});
syncBuiltinESMExports();
log({ kind: 'guard-ready', node: process.version, guardVersion: 1 });
