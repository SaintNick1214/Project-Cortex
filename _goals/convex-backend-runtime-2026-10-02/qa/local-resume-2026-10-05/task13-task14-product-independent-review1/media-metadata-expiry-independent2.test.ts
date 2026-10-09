import { beforeEach, afterEach, expect, it, jest } from '@jest/globals';
import { mediaFixture, media, installMediaMockRoot } from '../../../../../tests/unit/runtimeMedia/fixture';
import { clock, invoke } from '../../../../../tests/unit/runtimeTranscript/fixture';

beforeEach(() => installMediaMockRoot());
afterEach(() => jest.restoreAllMocks());

it('fresh media metadata denies a grant that expires during its final awaited resource lookup', async () => {
  const f = await mediaFixture(); const job = await f.submit('image', 'media-metadata-expiry');
  f.grant.expiresAt = clock + 5;
  await expect(f.call(media.get, { jobId: job.jobId })).resolves.toMatchObject({ jobId: job.jobId, state: 'pending' });
  const query = f.db.query.bind(f.db);
  const now = jest.spyOn(Date, 'now').mockReturnValue(clock);
  let crossedDeadline = false;
  const lateDb = Object.create(f.db);
  Object.defineProperty(lateDb, 'query', { value: (table: string) => {
    const result = query(table);
    if (table === 'artifacts') {
      const unique = result.unique;
      result.unique = async () => { const row = await unique(); crossedDeadline = true; now.mockReturnValue(clock + 6); return row; };
    }
    return result;
  } });
  const lateCtx = { ...f.ctx, db: lateDb };
  await expect(invoke(media.get, lateCtx, { jobId: job.jobId })).rejects.toMatchObject({ data: { code: 'FORBIDDEN' } });
  expect(crossedDeadline).toBe(true);
});
