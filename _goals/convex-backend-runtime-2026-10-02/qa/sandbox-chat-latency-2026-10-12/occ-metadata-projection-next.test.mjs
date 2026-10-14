import assert from 'node:assert/strict';
import { test } from 'node:test';
import { projectOccMetadata } from './occ-metadata-projection-next.mjs';
test('bounded native conflict identifiers survive while row IDs stay hashed', () => {
  const actual = projectOccMetadata({ retryCount: 0, tableName: 'runtimeAgentExecutions', componentPath: 'agent', documentId: 'private-row-identity', writeSource: 'runtimeAgent:recordOutput' });
  assert.equal(actual.retryCount, 0); assert.equal(actual.tableName, 'runtimeAgentExecutions');
  assert.equal(actual.componentPath, 'agent'); assert.equal(actual.writeSource, 'runtimeAgent:recordOutput');
  assert.match(actual.documentIdSha256, /^[a-f0-9]{64}$/); assert.equal(JSON.stringify(actual).includes('private-row-identity'), false);
});
test('unknown writer content is hashed; unrelated payload and invalid fields never escape', () => {
  const secret = 'Bearer TEST_ONLY_SECRET_MARKER';
  const actual = projectOccMetadata({ retryCount: -1, tableName: 'invalid name', componentPath: '\ninvalid', documentId: 'x'.repeat(513), writeSource: secret, error: secret, prompt: secret });
  assert.deepEqual(Object.keys(actual), ['writeSourceSha256']); assert.match(actual.writeSourceSha256, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(actual).includes(secret), false);
});
test('absent metadata remains unavailable and oversized or token-shaped writers are not printed', () => {
  for (const input of [undefined, null, [], 'text']) assert.equal(projectOccMetadata(input), undefined);
  assert.deepEqual(projectOccMetadata({ writeSource: 'x'.repeat(513), retryCount: 1.5 }), {});
  const actual = projectOccMetadata({ writeSource: 'TESTONLYTOKENWITHNOSOURCEDELIMITER' });
  assert.deepEqual(Object.keys(actual), ['writeSourceSha256']);
});
