import { describe, expect, it, jest } from '@jest/globals';
import { DEFAULT_EMBEDDING_PROFILE, semanticHash } from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/src/domain/profile';
import { canonicalModelJson } from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/src/domain/model-policy';
import type { GraphProjectionPayloadV1 } from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/src/domain/graph-projection';
let controlledDriver: unknown;
jest.unstable_mockModule('neo4j-driver', () => ({ default: { driver: () => controlledDriver, auth: { basic: () => ({}) }, int: (v: number) => v, isInt: () => false } }));
const { CypherProjectionConnector } = await import('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/src/graph/runtime/CypherProjectionConnector');
async function fixture(kind: 'begin-failure' | 'close-failure' | 'normal') {
  const constraintLabels = ['CortexRuntimeGraphScope', 'CortexRuntimeGraphSource', 'CortexRuntimeGraphFact', 'CortexRuntimeGraphEntity', 'CortexRuntimeGraphReceipt'];
  const setupSession = { run: jest.fn<(statement: string) => Promise<unknown>>().mockImplementation(async statement => ({ records: statement.startsWith('SHOW CONSTRAINTS')
    ? constraintLabels.map(label => ({ get: (key: string) => ({ type: 'UNIQUENESS', labelsOrTypes: [label], properties: ['key'] })[key] })) : [] })),
    close: jest.fn<() => Promise<void>>().mockResolvedValue(undefined) };
  const record = (values: Record<string, unknown>) => ({ get: (key: string) => values[key] });
  let calls = 0;
  const tx = { run: jest.fn<() => Promise<unknown>>().mockImplementation(async () => {
    calls++;
    if (calls === 1) return { records: [record({ tenantEpoch: 1, memorySpaceEpoch: 1 })] };
    if (calls === 2) return { records: [record({ tenantEpoch: 1, memorySpaceEpoch: 1, revision: 0, payloadHash: '', payloadCanonical: '', leaseVersion: 0 })] };
    return { records: [] };
  }), commit: jest.fn<() => Promise<void>>().mockResolvedValue(undefined), rollback: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  close: jest.fn<() => Promise<void>>().mockImplementation(async () => { if (kind === 'close-failure') throw new Error('controlled transaction cleanup failure'); }), isOpen: () => true };
  const projectionSession = { beginTransaction: jest.fn<() => Promise<typeof tx>>().mockImplementation(async () => {
    if (kind === 'begin-failure') throw new Error('controlled network/acquisition failure'); return tx;
  }), close: jest.fn<() => Promise<void>>().mockResolvedValue(undefined) };
  let sessions = 0;
  const driver = { session: () => ++sessions === 1 ? setupSession : projectionSession, verifyConnectivity: async () => undefined, close: jest.fn<() => Promise<void>>().mockResolvedValue(undefined) };
  controlledDriver = driver;
  const connector = new CypherProjectionConnector({ engine: 'neo4j', uri: 'bolt://localhost:1', username: 'controlled', password: 'controlled', tenantId: 't', memorySpaceId: 's', connectorId: 'c' });
  await connector.connect();
  const payload: GraphProjectionPayloadV1 = { version: 1, scope: { tenantId: 't', memorySpaceId: 's', tenantEpoch: 1, memorySpaceEpoch: 1 },
    source: { sourceId: 'source', sourceEventId: 'event', sourceRevision: 1, contentHash: 'a'.repeat(64), ownerPrincipalId: 'owner' },
    revision: 1, operation: 'replace', profile: DEFAULT_EMBEDDING_PROFILE, facts: [] };
  const work = { version: 1 as const, tenantId: 't', memorySpaceId: 's', connectorId: 'c', jobId: 'j', workerId: 'w', leaseVersion: 1,
    leaseExpiresAt: Date.now() + 10_000, payload, payloadHash: await semanticHash(canonicalModelJson(payload)) };
  return { connector, work, tx, setupSession, projectionSession, driver };
}
describe('independent remote session ownership on real connector paths (controlled driver only)', () => {
  it('closes the allocated session after beginTransaction rejects', async () => {
    const f = await fixture('begin-failure');
    try {
      await expect(f.connector.apply(f.work)).rejects.toThrow();
      expect(f.projectionSession.close).toHaveBeenCalledTimes(1);
      expect(f.tx.run).not.toHaveBeenCalled();
      expect(f.tx.close).not.toHaveBeenCalled();
    } finally { await f.connector.close(); }
    expect(f.driver.close).toHaveBeenCalledTimes(1);
  });
  it('closes the session independently when transaction close rejects after commit', async () => {
    const f = await fixture('close-failure');
    try {
      await expect(f.connector.apply(f.work)).rejects.toThrow();
      expect(f.tx.commit).toHaveBeenCalledTimes(1);
      expect(f.tx.close).toHaveBeenCalledTimes(1);
      expect(f.projectionSession.close).toHaveBeenCalledTimes(1);
    } finally { await f.connector.close(); }
    expect(f.driver.close).toHaveBeenCalledTimes(1);
  });
  it('returns an applied receipt and closes each owner once on the ordinary path', async () => {
    const f = await fixture('normal');
    try {
      const result = await f.connector.apply(f.work);
      expect(result.state).toBe('applied');
      expect(result.currentRevision).toBe(1);
      expect(f.tx.commit).toHaveBeenCalledTimes(1);
      expect(f.tx.close).toHaveBeenCalledTimes(1);
      expect(f.projectionSession.close).toHaveBeenCalledTimes(1);
      expect(f.setupSession.close).toHaveBeenCalledTimes(1);
    } finally { await f.connector.close(); }
    expect(f.driver.close).toHaveBeenCalledTimes(1);
  });
});
