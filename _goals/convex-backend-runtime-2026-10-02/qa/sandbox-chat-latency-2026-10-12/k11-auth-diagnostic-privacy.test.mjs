import test from 'node:test';
import assert from 'node:assert/strict';
import { authMetadata, classifyOfficialLog, parseArgs, safeError } from './k11-auth-diagnostic-readonly.mjs';

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
