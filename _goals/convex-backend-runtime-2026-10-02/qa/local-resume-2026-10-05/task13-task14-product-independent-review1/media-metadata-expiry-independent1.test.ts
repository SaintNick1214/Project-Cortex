import { beforeEach, afterEach, expect, it, jest } from '@jest/globals';
import { mediaFixture, media, installMediaMockRoot } from '../../../../../tests/unit/runtimeMedia/fixture';
import { clock } from '../../../../../tests/unit/runtimeTranscript/fixture';

beforeEach(() => installMediaMockRoot());
afterEach(() => jest.restoreAllMocks());

it('fresh media metadata denies a grant that expires during its final awaited resource lookup', async () => {
  const f = await mediaFixture(); const job = await f.submit('image', 'media-metadata-expiry');
  f.grant.expiresAt = clock + 5;
  await expect(f.call(media.get, { jobId: job.jobId })).resolves.toMatchObject({ jobId: job.jobId, state: 'pending' });
  const query = f.db.query.bind(f.db);
  const now = jest.spyOn(Date, 'now').mockReturnValue(clock);
  let crossedDeadline = false;
  jest.spyOn(f.db, 'query').mockImplementation(table => {
    const result = query(table);
    if (table === 'artifacts') {
      const unique = result.unique;
      result.unique = async () => { const row = await unique(); crossedDeadline = true; now.mockReturnValue(clock + 6); return row; };
    }
    return result;
  });
  await expect(f.call(media.get, { jobId: job.jobId })).rejects.toMatchObject({ data: { code: 'FORBIDDEN' } });
  expect(crossedDeadline).toBe(true);
});
