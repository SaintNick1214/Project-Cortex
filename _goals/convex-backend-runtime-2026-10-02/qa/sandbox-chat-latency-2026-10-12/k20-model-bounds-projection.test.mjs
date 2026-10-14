import test from 'node:test';
import assert from 'node:assert/strict';
import { projectK20ModelBounds } from './k20-model-bounds-projection.mjs';
const value = { phase: 'gateway.model.bounds', stage: 'preflight', ordinal: 1, semanticIdHash: 'a'.repeat(64),
  runBudgetIdHash: 'b'.repeat(64), modelIdentityHash: 'c'.repeat(64), dimensions: { inputTokens: 36422, contextTokens: 37446 },
  limits: { inputTokens: 32768, contextTokens: 65536 }, exceeded: ['inputTokens'] };
test('retains exact scalar dimensions and fixed exceeded field labels', () => assert.deepEqual(projectK20ModelBounds(value), value));
test('drops private payload, args, credentials and arbitrary numeric fields', () => {
  const output = projectK20ModelBounds({ ...value, prompt: 'PRIVATE', secret: 'SECRET', args: { text: 'PRIVATE' },
    dimensions: { ...value.dimensions, private: 2, outputTokens: Infinity }, limits: { ...value.limits, private: 3 } });
  assert.deepEqual(output, value); assert.doesNotMatch(JSON.stringify(output), /PRIVATE|SECRET|private|args|prompt/);
});
for (const [name, patch] of Object.entries({ rawIdentity: { semanticIdHash: 'private-name' }, negativeOrdinal: { ordinal: -1 },
  arbitraryExceeded: { exceeded: ['PRIVATE'] }, wrongStage: { stage: 'private' }, wrongPhase: { phase: 'gateway.private' } }))
  test('refuses ' + name, () => assert.equal(projectK20ModelBounds({ ...value, ...patch }), null));
test('native stage retains zero scalar values and deduplicates fixed labels', () => {
  const output = projectK20ModelBounds({ ...value, stage: 'native', ordinal: 0, dimensions: { toolSteps: 0 }, exceeded: ['inputTokens', 'inputTokens'] });
  assert.deepEqual(output.dimensions, { toolSteps: 0 }); assert.equal(output.stage, 'native'); assert.equal(output.ordinal, 0);
  assert.deepEqual(output.exceeded, ['inputTokens']);
});
