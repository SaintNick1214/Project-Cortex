import { beforeEach, afterEach, expect, it, jest } from '@jest/globals';
import { getFunctionName } from 'convex/server';
import { mediaFixture, gateway, installMediaMockRoot } from '../../../../../tests/unit/runtimeMedia/fixture';
import { ledger } from '../../../../../tests/unit/runtimeTranscript/fixture';
import type { MutationCtx } from '../../../../../convex-dev/_generated/server';
beforeEach(() => installMediaMockRoot());
afterEach(() => jest.restoreAllMocks());

it('current native budget cancellation after terminal attachment prevents atomic output publication', async () => {
  const f = await mediaFixture(); const job = await f.submit(); const row = f.db.table('runtimeMediaJobs')[0];
  const original = f.ctx.runMutation.bind(f.ctx);
  f.ctx.runMutation = (async (reference, args) => {
    if (getFunctionName(reference) === 'runtimeMediaJobs:materialized') {
      await f.call(ledger.cancelBudget, { reference: f.reference, runBudgetId: row.runBudgetId });
    }
    return original(reference, args);
  }) as MutationCtx['runMutation'];
  await gateway.processSubmissionHandler(f.action, { jobId: job.jobId }, f.factory);
  const account = f.db.table('runtimeBudgetAccounts').find(value => value._id === row.runAccountId)!;
  expect(account.cancelled).toBe(true);
  expect(f.counts().images).toBe(1);
  expect(f.db.table('runtimeModelAttempts')[0]).toMatchObject({ state: 'uncertain', slotReleased: true });
  expect(f.db.table('runtimeMediaJobs')[0].state).not.toBe('ready');
  expect(f.db.table('artifacts')[0].fileRef).toBeUndefined();
});
