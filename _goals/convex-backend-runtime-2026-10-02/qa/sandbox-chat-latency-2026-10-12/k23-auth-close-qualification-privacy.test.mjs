import test from 'node:test';
import assert from 'node:assert/strict';
import { authMetadata, classifyOfficialLog, parseArgs, safeError, safeCloseMetadata, createCloseCaptureWebSocket } from './k23-auth-close-qualification-readonly.mjs';

test('official AuthError and auth-manager paths classify without retaining dynamic errors or auth-state token suffix', () => {
  let time = 100; const metadata = authMetadata(() => time);
  metadata.logger.logVerbose('received ws message with type AuthError');
  metadata.logger.logVerbose('attempting to reauthenticate: PRIVATE_SERVER_ERROR [v1]');
  metadata.logger.logVerbose('setting auth state to {"state":"waitingForServerConfirmationOfFreshToken","token":"...SECRET7"} [v1]');
  time = 110; metadata.fetched(true); metadata.officialChanged(false); metadata.sdkChanged(false);
  const value = metadata.snapshot(), serialized = JSON.stringify(value);
  assert.equal(value.nativeAuthErrorObserved, true); assert.equal(value.forceRefreshCount, 1); assert.equal(value.fetchCount, 1);
  assert.deepEqual(value.officialAuthChanges, [false]); assert.deepEqual(value.sdkAuthChanges, [false]); assert.equal(metadata.elapsed(), 10);
  assert.equal(serialized.includes('PRIVATE_SERVER_ERROR'), false); assert.equal(serialized.includes('SECRET7'), false);
  assert.equal(value.loggerClassCounts.reauthentication_attempt, 1); assert.equal(value.loggerClassCounts.auth_state_waitingForServerConfirmationOfFreshToken, 1);
});
test('SDK-only timer callback is not misreported as native server rejection', () => {
  const metadata = authMetadata(() => 0); metadata.sdkChanged(false); const value = metadata.snapshot();
  assert.equal(value.nativeAuthErrorObserved, false); assert.deepEqual(value.officialAuthChanges, []); assert.deepEqual(value.sdkAuthChanges, [false]);
});
test('logger discards arbitrary payload, private error, token and hostile non-string objects without invoking getters', () => {
  const metadata = authMetadata(() => 0); let touched = false;
  const hostile = { get secret() { touched = true; throw Error('PRIVATE'); }, toString() { touched = true; throw Error('PRIVATE'); } };
  for (const method of ['logVerbose', 'log', 'warn', 'error']) metadata.logger[method](hostile, 'unknown PRIVATE_TOKEN PRIVATE_PAYLOAD');
  assert.equal(touched, false); assert.equal(JSON.stringify(metadata.snapshot()).includes('PRIVATE'), false);
  assert.equal(classifyOfficialLog([hostile]), 'other');
});
test('known protocol classes remain bounded and copy-safe', () => {
  const metadata = authMetadata(() => 0);
  for (let i = 0; i < 300; i++) metadata.logger.logVerbose('received ws message with type AuthError');
  const value = metadata.snapshot(); assert.equal(value.events.length, 256); assert.equal(value.droppedMetadataEvents, 44); assert.equal(value.loggerClassCounts.native_auth_error, 300);
  value.events[0].classification = 'PRIVATE'; assert.equal(metadata.snapshot().events[0].classification, 'native_auth_error');
  assert.throws(() => metadata.rpc('runs:submit', 'begin')); assert.throws(() => metadata.fetched('PRIVATE')); assert.throws(() => metadata.officialChanged('PRIVATE'));
});
test('saved errors contain only allowlisted code, hash and byte count', () => {
  const known = safeError(Object.assign(Error('PRIVATE_TOKEN PRIVATE_MESSAGE'), { code: 'AUTHENTICATION_TIMEOUT' }));
  assert.equal(known.code, 'AUTHENTICATION_TIMEOUT'); assert.match(known.messageSha256, /^[a-f0-9]{64}$/); assert.equal(JSON.stringify(known).includes('PRIVATE'), false);
  assert.equal(safeError(Object.assign(Error('PRIVATE'), { code: 'CALLER_PRIVATE_CODE' })).code, 'OTHER_ERROR');
});
test('exact prospective READY pins required, no fallback or extra selector accepted', () => {
  const argv = ['--session', '12345678-1234-4234-8234-123456789abc', '--name', 'new-fixture-123', '--id', '123', '--expires-at', '1792000000000',
    '--source-commit', 'a'.repeat(40), '--manifest-sha256', 'b'.repeat(64), '--sdk-archive-sha256', 'c'.repeat(64), '--image-id', 'sha256:' + 'd'.repeat(64), '--owner-control', '1'];
  assert.equal(parseArgs(argv).ownerControl, true); assert.equal(parseArgs(argv).expiresAt, 1792000000000);
  assert.throws(() => parseArgs([])); assert.throws(() => parseArgs([...argv, '--source-commit', 'e'.repeat(40)]));
  assert.throws(() => parseArgs([...argv, '--mutation', 'runs:submit']));
  assert.throws(() => parseArgs(argv.map(value => value === 'new-fixture-123' ? 'production' : value)));
});

test('close metadata retains code and bounded full reason hash, never raw reason or native-auth proof', () => {
  const metadata = authMetadata(() => 0), reason = 'PRIVATE_TOKEN jwt expired PRIVATE_REASON';
  metadata.closed({ code: 1008, reason, wasClean: false }); const value = metadata.snapshot(), close = value.events[0];
  assert.equal(close.closeCode, 1008); assert.equal(close.wasClean, false); assert.equal(close.reasonBytes, Buffer.byteLength(reason));
  assert.match(close.reasonSha256, /^[a-f0-9]{64}$/); assert.equal(close.reasonMentionsAuth, true); assert.equal(close.reasonMentionsExpiry, true);
  assert.equal(close.beforeAuthDeadline, true); assert.equal(value.nativeAuthErrorObserved, false); assert.equal(value.publicCloseCount, 1);
  assert.equal(JSON.stringify(value).includes('PRIVATE'), false); assert.deepEqual(value.officialAuthChanges, []);
  assert.equal(safeCloseMetadata({ code: 1000, reason: '', wasClean: true }).reasonClass, 'empty');
});
test('close projection bounds oversized metadata and isolates hostile accessors without dropping the transport callback', () => {
  const metadata = authMetadata(() => 0);
  metadata.closed({ code: 1006, reason: 'x'.repeat(1025), wasClean: false });
  metadata.closed({ get code() { throw Error('PRIVATE'); } });
  const value = metadata.snapshot(); assert.equal(value.events.length, 1); assert.equal(value.events[0].reasonClass, 'over_bound');
  assert.equal(value.events[0].reasonBytes, 1025); assert.equal(value.events[0].reasonSha256, undefined);
  assert.equal(value.closeMetadataReadFailures, 1); assert.equal(JSON.stringify(value).includes('PRIVATE'), false);
});
test('public constructor subclass preserves native API identity, args, add/remove listeners and onclose event', () => {
  class Native extends EventTarget {
    constructor(...args) { super(); this.args = args; }
    set onclose(callback) { if (this.callback) this.removeEventListener('close', this.callback); this.callback = callback; if (callback) this.addEventListener('close', callback); }
    get onclose() { return this.callback; }
    send(value) { this.sent = value; }
    close() { this.dispatchEvent(new Event('close')); }
  }
  const captures = [], Wrapped = createCloseCaptureWebSocket(Native, event => captures.push(event)), instance = new Wrapped('ws://no-network.invalid', ['protocol']);
  assert.equal(instance instanceof Native, true); assert.deepEqual(instance.args, ['ws://no-network.invalid', ['protocol']]);
  assert.equal(Wrapped.prototype.addEventListener, Native.prototype.addEventListener); assert.equal(Wrapped.prototype.removeEventListener, Native.prototype.removeEventListener);
  assert.equal(Wrapped.prototype.send, Native.prototype.send); assert.equal(Wrapped.prototype.close, Native.prototype.close);
  const descriptor = Object.getOwnPropertyDescriptor(Native.prototype, 'onclose'); assert.equal(Object.getOwnPropertyDescriptor(Wrapped.prototype, 'onclose'), undefined);
  let removed = 0, original = 0, extra = 0, originalEvent; const discarded = () => removed++;
  instance.addEventListener('close', discarded); instance.removeEventListener('close', discarded);
  instance.addEventListener('close', () => extra++); instance.onclose = event => { original++; originalEvent = event; };
  assert.equal(Object.getOwnPropertyDescriptor(Native.prototype, 'onclose').set, descriptor.set);
  const event = new Event('close'); instance.dispatchEvent(event);
  assert.equal(removed, 0); assert.equal(original, 1); assert.equal(extra, 1); assert.equal(captures[0], event); assert.equal(originalEvent, event);
  instance.onclose = null; instance.close(); assert.equal(original, 1); assert.equal(extra, 2); assert.equal(captures.length, 2);
});
test('diagnostic listener failure cannot interrupt the original public close callback', () => {
  class Native extends EventTarget { constructor() { super(); } }
  const Wrapped = createCloseCaptureWebSocket(Native, () => { throw Error('PRIVATE'); }), instance = new Wrapped(); let delivered = 0;
  instance.addEventListener('close', () => delivered++); instance.dispatchEvent(new Event('close')); assert.equal(delivered, 1);
});
test('close timing distinguishes pre-deadline from cleanup and keeps event storage bounded', () => {
  let now = 0; const metadata = authMetadata(() => now); now = 3999; metadata.closed({ code: 1006, reason: '', wasClean: false });
  now = 4000; metadata.closed({ code: 1000, reason: '', wasClean: true });
  for (let i = 0; i < 300; i++) metadata.closed({ code: 1006, reason: '', wasClean: false });
  const value = metadata.snapshot(); assert.equal(value.events[0].beforeAuthDeadline, true); assert.equal(value.events[1].beforeAuthDeadline, false);
  assert.equal(value.events.length, 256); assert.equal(value.droppedMetadataEvents, 46); assert.equal(value.publicCloseCount, 302);
});
test('new official classes retain neither fatal payload nor socket error reason', () => {
  const metadata = authMetadata(() => 0);
  for (const message of ['received ws message with type FatalError', '[CONVEX FATAL ERROR] PRIVATE_ERROR', 'WebSocket error message: PRIVATE_TOKEN', 'WebSocket closed with code 1008: PRIVATE_REASON', 'WebSocket reconnected at PRIVATE_REASON']) metadata.logger.log(message);
  const value = metadata.snapshot(); assert.equal(value.loggerClassCounts.native_fatal_error, 1); assert.equal(value.loggerClassCounts.official_fatal_error, 1);
  assert.equal(value.loggerClassCounts.socket_close_log, 1); assert.equal(value.nativeAuthErrorObserved, false); assert.equal(JSON.stringify(value).includes('PRIVATE'), false);
});
