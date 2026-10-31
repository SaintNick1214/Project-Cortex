const fs = require('node:fs');
const path = require('node:path');
const sensitiveEnvFile = name => typeof name === 'string' && /^\.env(?:\.|$)/.test(path.basename(name));
const check = name => {
  if (sensitiveEnvFile(name) && fs.existsSync(name)) throw new Error('OFFLINE_QUALITY_ENV_FILE_PROHIBITED');
};
const readSync = fs.readFileSync.bind(fs);
fs.readFileSync = function(name, ...args) { check(name); return readSync(name, ...args); };
const read = fs.readFile.bind(fs);
fs.readFile = function(name, ...args) { check(name); return read(name, ...args); };
const readAsync = fs.promises.readFile.bind(fs.promises);
fs.promises.readFile = function(name, ...args) { check(name); return readAsync(name, ...args); };
process.loadEnvFile = () => { throw new Error('OFFLINE_QUALITY_ENV_FILE_PROHIBITED'); };

// Unit transport cases own bounded ephemeral loopback HTTP fixtures. Real services remain refused.
const blocked = () => { throw new Error('UNIT_QUALITY_NON_LOOPBACK_NETWORK_PROHIBITED'); };
const loopback = host => ['127.0.0.1', '::1', '[::1]', 'localhost'].includes(host);
const checkUrl = value => { const u = new URL(typeof value === 'string' || value instanceof URL ? value : value.url); if (u.protocol !== 'http:' || !loopback(u.hostname)) blocked(); };
const socketConnect = require('node:net').Socket.prototype.connect;
require('node:net').Socket.prototype.connect = function(...args) {
  const first = args[0];
  const options = first && typeof first === 'object' && !Array.isArray(first) ? first : Array.isArray(first) ? first[0] : undefined;
  const host = options?.host ?? (typeof args[1] === 'string' ? args[1] : 'localhost');
  if (options?.path || typeof first === 'string' || !loopback(host)) blocked();
  return socketConnect.apply(this, args);
};
require('node:tls').connect = blocked;
require('node:https').request = blocked;
require('node:https').get = blocked;
const http = require('node:http');
for (const name of ['request', 'get']) {
 const original = http[name];
 http[name] = function(...args) {
  const first = args[0];
  if (typeof first === 'string' || first instanceof URL) checkUrl(first);
  else if (!loopback(first?.hostname ?? first?.host ?? 'localhost')) blocked();
  return original.apply(this, args);
 };
}
const nativeFetch = globalThis.fetch;
globalThis.fetch = function(input, options) { checkUrl(input); return nativeFetch(input, options); };
