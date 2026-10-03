import { describe, expect, it } from '@jest/globals';
import { computeStats } from '../../../convex-dev/agents';
import { getStats } from '../../../convex-dev/memorySpaces';
import { fixture, invoke, seedAgent, seedSpace } from '../runtimeRegistryAuth/fixture';
const calls = [
  { name: 'agents.computeStats', registration: computeStats, args: { agentId: 'agent-a', memorySpaceId: 'space-a' } },
  { name: 'memorySpaces.getStats', registration: getStats, args: { memorySpaceId: 'space-a', includeParticipants: true } },
];
function prepared(capabilities?: string[]) { const f = fixture(capabilities); seedAgent(f); seedSpace(f); return f; }
const dataTables = ['memories', 'facts', 'conversations', 'runtimeMemorySources'];
for (const call of calls) describe(call.name + ' bounded authorization closure; functional statistics pending', () => {
  it('is a native public query with tenant and space validators', () => {
    expect(call.registration.isPublic).toBe(true); expect(call.registration.isQuery).toBe(true);
    const native: unknown = call.registration;
    if (!native || typeof native !== 'function' || !('exportArgs' in native) || typeof native.exportArgs !== 'function') throw new Error('Native validators unavailable');
    const fields = (JSON.parse(native.exportArgs()) as { value: Record<string, unknown> }).value;
    expect(fields).toHaveProperty('tenantId'); expect(fields).toHaveProperty('memorySpaceId');
  });
  it('healthy canonical READ admission returns explicit typed unavailable and performs no data reads', async () => {
    const f = prepared();
    await expect(invoke(call.registration, f.ctx, call.args)).rejects.toMatchObject({ data: {
      version: 1, code: 'CAPABILITY_NOT_READY', message: 'Access denied or invalid registry input', retryable: false, outcome: 'not_dispatched' } });
    expect(f.db.traces.filter(trace => dataTables.includes(trace.table))).toEqual([]); expect(f.db.writes).toBe(0);
  });
  it('is uniformly unavailable with foreign/ownerless/same-ID data and deleted sources present', async () => {
    const f = prepared();
    for (const table of dataTables) for (const ownerPrincipalId of [undefined, 'foreign', f.principal._id]) {
      f.db.seed(table, { tenantId: 'tenant-a', memorySpaceId: 'space-a', ownerPrincipalId, memoryId: 'same-id',
        factId: 'same-id', conversationId: 'same-id', private: 'SECRET', tombstonedAt: 1000 });
      f.db.seed(table, { tenantId: 'tenant-b', memorySpaceId: 'space-a', ownerPrincipalId, private: 'SECRET' });
    }
    await expect(invoke(call.registration, f.ctx, call.args)).rejects.toMatchObject({ data: { code: 'CAPABILITY_NOT_READY' } });
    expect(f.db.traces.filter(trace => dataTables.includes(trace.table))).toEqual([]);
  });
  it('denies anonymous before registry or data reads', async () => {
    const f = prepared(); await expect(invoke(call.registration, f.anonymous, call.args)).rejects.toMatchObject({ data: { code: 'UNAUTHENTICATED' } });
    expect(f.db.traces.filter(trace => [...dataTables, 'agents', 'memorySpaces'].includes(trace.table))).toEqual([]);
  });
  it('denies a forged issuer/subject that has no trusted principal', async () => {
    const f = prepared(); f.ctx.auth.getUserIdentity = async () => ({ issuer: 'https://forged.invalid', subject: 'user-a', tokenIdentifier: 'forged-user-a' });
    await expect(invoke(call.registration, f.ctx, call.args)).rejects.toMatchObject({ data: { code: 'FORBIDDEN' } });
    expect(f.db.traces.filter(trace => [...dataTables, 'agents', 'memorySpaces'].includes(trace.table))).toEqual([]);
  });
  it.each([['write'], ['admin']])('denies capabilities %s without READ', async (...capabilities) => {
    const f = prepared(capabilities); await expect(invoke(call.registration, f.ctx, call.args)).rejects.toMatchObject({ data: { code: 'FORBIDDEN' } });
  });
  it('denies foreign tenant/space and ownerless or foreign canonical registry targets', async () => {
    const f = prepared();
    for (const args of [{ ...call.args, tenantId: 'tenant-b' }, { ...call.args, memorySpaceId: 'space-b' }])
      await expect(invoke(call.registration, f.ctx, args)).rejects.toMatchObject({ data: { code: 'FORBIDDEN' } });
    const row = f.db.table(call.name.startsWith('agents') ? 'agents' : 'memorySpaces')[0];
    row.ownerPrincipalId = 'foreign'; await expect(invoke(call.registration, f.ctx, call.args)).rejects.toMatchObject({ data: { code: 'FORBIDDEN' } });
    delete row.ownerPrincipalId; await expect(invoke(call.registration, f.ctx, call.args)).rejects.toMatchObject({ data: { code: 'FORBIDDEN' } });
    expect(f.db.traces.filter(trace => dataTables.includes(trace.table))).toEqual([]);
  });
  it('denies expired or revoked grants before declaring readiness', async () => {
    const f = prepared(); f.grant.expiresAt = Date.now() - 1;
    await expect(invoke(call.registration, f.ctx, call.args)).rejects.toMatchObject({ data: { code: 'FORBIDDEN' } });
    delete f.grant.expiresAt; f.grant.revokedAt = Date.now();
    await expect(invoke(call.registration, f.ctx, call.args)).rejects.toMatchObject({ data: { code: 'FORBIDDEN' } });
  });
  it('denies revocation or canonical owner replacement during late registry fence', async () => {
    for (const change of ['revoke', 'owner']) {
      const f = prepared(); const table = call.name.startsWith('agents') ? 'agents' : 'memorySpaces'; let reads = 0;
      f.db.beforeRead = current => { if (current === table && ++reads === 2) {
        if (change === 'revoke') f.grant.revokedAt = Date.now(); else f.db.table(table)[0].ownerPrincipalId = 'foreign';
      } };
      await expect(invoke(call.registration, f.ctx, call.args)).rejects.toMatchObject({ data: { code: 'FORBIDDEN' } });
      expect(reads).toBeGreaterThanOrEqual(2); expect(f.db.traces.filter(trace => dataTables.includes(trace.table))).toEqual([]);
    }
  });
  it('denies retained registry target tombstones', async () => {
    const f = prepared(); f.db.seed('runtimeAuthTombstones', { tenantId: 'tenant-a', memorySpaceId: 'space-a',
      resourceType: call.name.startsWith('agents') ? 'source' : 'memorySpace',
      resourceId: call.name.startsWith('agents') ? JSON.stringify(['agents', 'agent-a']) : 'space-a', deletedAt: Date.now() });
    await expect(invoke(call.registration, f.ctx, call.args)).rejects.toMatchObject({ data: { code: 'FORBIDDEN' } });
  });
  it('normalizes private/accessor infrastructure errors without invoking getters', async () => {
    for (const location of ['identity', 'registry']) {
      const f = prepared(); let reads = 0;
      const error = Object.defineProperty({}, 'data', { get: () => { reads++; return 'SECRET'; } });
      if (location === 'identity') f.ctx.auth.getUserIdentity = async () => { throw error; };
      else f.db.beforeRead = table => { if (table === (call.name.startsWith('agents') ? 'agents' : 'memorySpaces')) throw error; };
      await expect(invoke(call.registration, f.ctx, call.args)).rejects.toMatchObject({ data: { code: 'REGISTRY_OPERATION_FAILED', message: 'Registry operation failed' } });
      expect(reads).toBe(0); expect(f.db.traces.filter(trace => dataTables.includes(trace.table))).toEqual([]);
    }
  });
});
it('agent omitted space cannot make a tenant-wide statistics request', async () => {
  const f = fixture(undefined, true); seedAgent(f);
  await expect(invoke(computeStats, f.ctx, { agentId: 'agent-a' })).rejects.toMatchObject({ data: { code: 'FORBIDDEN' } });
  expect(f.db.traces.filter(trace => dataTables.includes(trace.table))).toEqual([]);
});
