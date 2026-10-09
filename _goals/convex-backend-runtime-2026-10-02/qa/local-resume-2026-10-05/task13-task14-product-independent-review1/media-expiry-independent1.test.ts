import { beforeEach, afterEach, expect, it, jest } from '@jest/globals';
import { getFunctionName } from 'convex/server';
import { mediaFixture, media, gateway, installMediaMockRoot } from '../../../../../../tests/unit/runtimeMedia/fixture';
import { clock } from '../../../../../../tests/unit/runtimeTranscript/fixture';
import type { MutationCtx } from '../../../../../../convex-dev/_generated/server';

beforeEach(() => installMediaMockRoot());
afterEach(() => jest.restoreAllMocks());

it('positive: exact confirmed image publishes once before its retention deadline', async () => {
  const f = await mediaFixture(); const job = await f.submit();
  await gateway.processSubmissionHandler(f.action, { jobId: job.jobId }, f.factory);
  await gateway.processDownloadHandler(f.action, { jobId: job.jobId }, f.factory);
  expect(f.db.table('runtimeMediaJobs')[0].state).toBe('ready');
  expect(f.db.table('artifacts')[0].version).toBe(2);
  expect(f.counts()).toMatchObject({ images: 1, downloads: 0 });
});

it('late owned storage completion cannot publish after job expiry before the scheduled expiry mutation runs', async () => {
  const f = await mediaFixture(); const job = await f.submit(); const row = f.db.table('runtimeMediaJobs')[0];
  await f.db.patch('runtimeMediaJobs', row._id as string, { expiresAt: clock + 100 });
  const original = f.ctx.runMutation.bind(f.ctx);
  f.ctx.runMutation = (async (reference, args) => {
    if (getFunctionName(reference) === 'runtimeMediaJobs:materialized') jest.spyOn(Date, 'now').mockReturnValue(clock + 101);
    return original(reference, args);
  }) as MutationCtx['runMutation'];
  await gateway.processSubmissionHandler(f.action, { jobId: job.jobId }, f.factory);
  expect(f.db.table('runtimeModelAttempts')[0]).toMatchObject({ state: 'uncertain', slotReleased: true });
  expect(f.counts().images).toBe(1);
  expect(f.db.table('runtimeMediaJobs')[0].state).not.toBe('ready');
  expect(f.db.table('artifacts')[0].fileRef).toBeUndefined();
});

it('recoverable stored-output gap cannot publish after retention expiry or issue another image call', async () => {
  const f = await mediaFixture(); const job = await f.submit(); const row = f.db.table('runtimeMediaJobs')[0];
  await f.db.patch('runtimeMediaJobs', row._id as string, { expiresAt: clock + 100 });
  const original = f.ctx.runMutation.bind(f.ctx); let held = true;
  f.ctx.runMutation = (async (reference, args) => {
    if (getFunctionName(reference) === 'runtimeMediaJobs:materialized' && held) { held = false; throw new Error('OWNED_SAVE_GAP'); }
    return original(reference, args);
  }) as MutationCtx['runMutation'];
  await gateway.processSubmissionHandler(f.action, { jobId: job.jobId }, f.factory);
  expect(f.db.table('runtimeMediaJobs')[0].state).toBe('downloading');
  expect(f.db.table('runtimeAssetVersions')).toHaveLength(1);
  jest.spyOn(Date, 'now').mockReturnValue(clock + 101);
  await gateway.processDownloadHandler(f.action, { jobId: job.jobId }, f.factory).catch(() => undefined);
  expect(f.counts()).toMatchObject({ images: 1, downloads: 0 });
  expect(f.db.table('runtimeMediaJobs')[0].state).not.toBe('ready');
  expect(f.db.table('artifacts')[0].fileRef).toBeUndefined();
});
