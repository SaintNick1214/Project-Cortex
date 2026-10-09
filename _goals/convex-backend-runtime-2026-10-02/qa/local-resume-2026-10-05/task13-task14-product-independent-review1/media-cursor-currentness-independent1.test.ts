import { beforeEach, afterEach, expect, it, jest } from '@jest/globals';
import { mediaFixture, installMediaMockRoot } from '../../../../../tests/unit/runtimeMedia/fixture';
const runtime = await import('../../../../../convex-dev/runtimeAgent');
beforeEach(() => installMediaMockRoot());
afterEach(() => jest.restoreAllMocks());

it('a retained media projection is fenced for both full replay and an exhausted current-attempt cursor', async () => {
  const f = await mediaFixture(); const job = await f.submit(); const run = await f.run();
  const row = f.db.table('runtimeRuns')[0];
  await f.db.patch('runtimeRuns', row._id as string, { attemptNumber: 1, responseStatus: 'complete' });
  f.db.seed('runtimeAgentExecutions', { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId,
    runId: run.runId, attemptNumber: 1, state: 'complete', streaming: true, sourceWitnesses: [] });
  f.db.seed('runtimeAgentOutput', { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId,
    runId: run.runId, attemptNumber: 1, sequence: 1, final: true,
    partCanonical: JSON.stringify({ type: 'media-job', version: 1, jobId: job.jobId, artifactId: job.artifactId, kind: job.kind }) });
  const full = await f.call<{ parts: unknown[] }>(runtime.observe, { runId: run.runId, afterSequence: 0, finalOnly: true });
  expect(full.parts).toHaveLength(1);
  expect(await f.call(runtime.observe, { runId: run.runId, afterSequence: 1, finalOnly: true })).toMatchObject({ parts: [] });
  const artifact = f.db.table('artifacts').find(value => value.artifactId === job.artifactId)!;
  await f.db.patch('artifacts', artifact._id as string, { isDeleted: true });
  await expect(f.call(runtime.observe, { runId: run.runId, afterSequence: 0, finalOnly: true })).rejects.toMatchObject({ data: { code: 'FORBIDDEN' } });
  await expect(f.call(runtime.observe, { runId: run.runId, afterSequence: 1, finalOnly: true })).rejects.toMatchObject({ data: { code: 'FORBIDDEN' } });
});
