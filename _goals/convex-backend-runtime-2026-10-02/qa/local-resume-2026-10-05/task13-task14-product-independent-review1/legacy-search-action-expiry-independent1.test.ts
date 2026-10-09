import { beforeEach, afterEach, expect, it, jest } from '@jest/globals';
import * as memories from '../../../../../convex-dev/memories';
import { harness } from '../../../../../tests/unit/runtimeEndpointAuth/sharedfixtures';

beforeEach(() => { jest.spyOn(Date, 'now').mockReturnValue(1000); });
afterEach(() => { jest.restoreAllMocks(); });

async function fixture() {
  const h = harness();
  const owner = await h.provisionScope();
  await h.seedData('memories', owner, 'expiry-sentinel');
  await h.db.patch(owner.grantId, { expiresAt: 2000 });
  return { h, owner };
}

it('the actual public search action delivers a current authorized memory without effects', async () => {
  const { h } = await fixture();
  h.db.attemptedWrites = [];
  const result = await h.invoke<{ content: string }[]>(memories.search, { memorySpaceId: 'space-a', query: 'expiry-sentinel' });
  expect(result).toHaveLength(1);
  expect(result[0].content).toContain('private expiry-sentinel');
  expect(h.db.attemptedWrites).toEqual([]);
  expect(h.vectorCalls()).toBe(0);
});

it('action delivery withholds private payload when the grant expires after the final query RPC', async () => {
  const { h } = await fixture();
  let finalRpcReturned = false;
  h.setInternalHook(async (name, stage) => {
    if (name === 'memories:fetchMemoriesByIds' && stage === 'after') {
      // Every query snapshot finished at1000. Only the surrounding action clock now advances.
      finalRpcReturned = true;
      jest.spyOn(Date, 'now').mockReturnValue(2001);
    }
  });
  h.db.attemptedWrites = [];
  await expect(h.invoke(memories.search, { memorySpaceId: 'space-a', query: 'expiry-sentinel' }))
    .rejects.toMatchObject({ data: { code: 'FORBIDDEN' } });
  expect(finalRpcReturned).toBe(true);
  await expect(h.invoke(memories.get, { memorySpaceId: 'space-a', memoryId: 'expiry-sentinel' }))
    .rejects.toMatchObject({ data: { code: 'FORBIDDEN' } });
  expect(h.db.attemptedWrites).toEqual([]);
  expect(h.vectorCalls()).toBe(0);
});
