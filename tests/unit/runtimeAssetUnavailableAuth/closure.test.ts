import { describe, expect, it, jest } from '@jest/globals';
import * as artifacts from '../../../convex-dev/artifacts';
import * as attachments from '../../../convex-dev/attachments';
import { runtimeAssetUnavailable, internalAssetUnavailable } from '../../../convex-dev/runtimeAssetUnavailableAuth';
import { ConvexError, v, type Value } from 'convex/values';
import { defineSchema, defineTable } from 'convex/server';
import schema from '../../../convex-dev/schema';
import { backendSource, catalogDeclarations, catalogFixture, historicalRepairSources, repairedHistoricalSources, sha256, verifyHistoricalRepair, withComposedCatalog, type HistoricalModules, type HistoricalRepair } from '../../helpers/backend-catalog';
import { fixture, invoke } from '../runtimeRegistryAuth/fixture';

type Native = { isPublic?: boolean; isInternal?: boolean; isQuery?: boolean; exportArgs(): string };
type Validator = { type: string; value?: unknown; tableName?: string };
const selected = ['setFileRef', 'generateArtifactUploadUrl', 'completeArtifactUpload', 'getArtifactFileUrl', 'detachFile'];
const internal = new Set(['artifacts:setFileRef', 'artifacts:generateArtifactUploadUrl', 'artifacts:getArtifactFileUrl', 'attachments:generateUploadUrl', 'attachments:getUrl', 'attachments:purgeAll']);
const calls = [
  ...Object.entries(artifacts).filter(([name]) => selected.includes(name)).map(([name, registration]) => ({ path: 'artifacts:' + name, registration: registration as unknown as Native })),
  ...Object.entries(attachments).map(([name, registration]) => ({ path: 'attachments:' + name, registration: registration as unknown as Native })),
];
const unavailable = { version: 1, code: 'CAPABILITY_UNAVAILABLE', message: 'Asset capability unavailable.', retryable: false, outcome: 'not_dispatched' };
function sample(v: Validator): unknown {
  switch (v.type) {
    case 'string': return 'same-id'; case 'number': return 1; case 'boolean': return true;
    case 'null': return null; case 'literal': return v.value;
    case 'array': return [sample(v.value as Validator)];
    case 'union': return sample((v.value as Validator[])[0]);
    case 'object': return Object.fromEntries(Object.entries(v.value as Record<string, { fieldType: Validator; optional: boolean }>).filter(([, f]) => !f.optional).map(([k, f]) => [k, sample(f.fieldType)]));
    case 'id': return v.tableName + ':fixture'; case 'any': return {};
    default: throw new Error('Unsupported validator ' + v.type);
  }
}
function args(call: typeof calls[number]): Record<string, unknown> {
  return { ...(sample(JSON.parse(call.registration.exportArgs()) as Validator) as Record<string, unknown>), tenantId: 'tenant-a', memorySpaceId: 'space-a' };
}
function trapped(capabilities = ['storage:read', 'storage:write']) {
  const f = fixture(capabilities);
  const controls = new Set(['runtimeAuthPrincipals', 'runtimeAuthMemberships', 'runtimeAuthGrants', 'runtimeAuthScopes', 'runtimeAuthTombstones']);
  const attempts: string[] = [];
  const fail = (label: string): never => { attempts.push(label); throw new Error('PRIVATE SECRET EFFECT'); };
  const query = f.db.query.bind(f.db); f.db.query = table => { if (!controls.has(table)) fail('query:' + table); return query(table); };
  const get = f.db.get.bind(f.db); f.db.get = async (table, id) => { if (!controls.has(table)) fail('get:' + table); return await get(table, id); };
  f.db.beforeWrite = table => fail('write:' + table);
  f.db.delete = async () => fail('delete');
  const effect = new Proxy(() => undefined, { get: (_target, key) => fail('effect:' + String(key)), apply: () => fail('effect:call') });
  Object.assign(f.ctx, { scheduler: effect, storage: effect, runQuery: effect, runMutation: effect, runAction: effect });
  return { ...f, attempts };
}
async function outcome(call: typeof calls[number], f: ReturnType<typeof trapped>, input: unknown, code: string) {
  let error: unknown;
  try { await invoke(call.registration, f.ctx, input); } catch (caught) { error = caught; }
  expect(error).toBeInstanceOf(ConvexError);
  const data = (error as ConvexError<Value>).data;
  if (code === 'CAPABILITY_UNAVAILABLE') expect(data).toEqual(unavailable);
  else expect(data).toEqual({ version: 1, code, message: code === 'REGISTRY_OPERATION_FAILED' ? 'Registry operation failed' : 'Access denied or invalid registry input', retryable: false, outcome: code === 'REGISTRY_OPERATION_FAILED' ? 'failed' : 'not_dispatched' });
  expect(JSON.stringify(data)).not.toMatch(/PRIVATE|SECRET|GETTER|PROXY|storageId|same-id/);
  expect(f.attempts).toEqual([]); expect(f.db.writes).toBe(0);
  expect(f.db.traces.every(t => t.table.startsWith('runtimeAuth'))).toBe(true);
}
it('covers all original17 actual handlers: eleven public, six internal with no public aliases', () => {
  expect(calls).toHaveLength(17); expect(calls.filter(c => c.registration.isPublic)).toHaveLength(11);
  for (const c of calls) { expect(!!c.registration.isInternal).toBe(internal.has(c.path)); expect(!!c.registration.isPublic).toBe(!internal.has(c.path)); }
});
for (const call of calls) describe(call.path, () => {
  it('healthy matching storage authority is fixed unavailable before any old effect', async () => {
    const f = trapped(); await outcome(call, f, args(call), 'CAPABILITY_UNAVAILABLE');
    expect(f.db.traces.length > 0).toBe(!internal.has(call.path));
  });
  if (internal.has(call.path)) {
    it('internal helper is uniformly unavailable without identity, scope or any DB access', async () => {
      const f = trapped([]); f.ctx.auth.getUserIdentity = async () => { throw new Error('PRIVATE'); }; f.db.beforeRead = () => { throw new Error('PRIVATE'); };
      await outcome(call, f, args(call), 'CAPABILITY_UNAVAILABLE'); expect(f.db.traces).toEqual([]);
    });
    return;
  }
  it.each(['missing', 'forgedIssuer', 'forgedSubject', 'expired', 'revoked', 'grantDeleted', 'capability', 'oppositeStorage', 'tenant', 'space', 'scopeDeleted', 'scopeEpoch', 'tenantDeleted', 'principalDeleted', 'principalRevoked', 'membershipRevoked', 'membershipDeleted', 'tombstone'])('denies %s', async variant => {
    const f = trapped(); const input = args(call);
    if (variant === 'missing') f.ctx.auth.getUserIdentity = async () => null;
    if (variant === 'forgedIssuer') f.ctx.auth.getUserIdentity = async () => ({ issuer: 'forged', subject: 'user-a', tokenIdentifier: 'fake' });
    if (variant === 'forgedSubject') f.ctx.auth.getUserIdentity = async () => ({ issuer: 'https://host.test', subject: 'forged', tokenIdentifier: 'fake' });
    if (variant === 'expired') f.grant.expiresAt = Date.now() - 1;
    if (variant === 'revoked') f.grant.revokedAt = 1;
    if (variant === 'grantDeleted') f.grant.deletedAt = 1;
    if (variant === 'capability') f.grant.capabilities = ['read', 'write', 'admin', 'run', 'tool'];
    if (variant === 'oppositeStorage') f.grant.capabilities = [call.registration.isQuery ? 'storage:write' : 'storage:read'];
    if (variant === 'tenant') input.tenantId = 'tenant-b';
    if (variant === 'space') input.memorySpaceId = 'space-b';
    if (variant === 'scopeDeleted') f.db.table('runtimeAuthScopes')[1].deletedAt = 1;
    if (variant === 'scopeEpoch') f.db.table('runtimeAuthScopes')[1].epoch = 2;
    if (variant === 'tenantDeleted') f.db.table('runtimeAuthScopes')[0].deletedAt = 1;
    if (variant === 'principalDeleted') f.principal.deletedAt = 1;
    if (variant === 'principalRevoked') f.principal.revokedAt = 1;
    if (variant === 'membershipRevoked') f.membership.revokedAt = 1;
    if (variant === 'membershipDeleted') f.membership.deletedAt = 1;
    if (variant === 'tombstone') f.db.seed('runtimeAuthTombstones', { tenantId: 'tenant-a', memorySpaceId: 'space-a', resourceType: 'memorySpace', resourceId: 'space-a', deletedAt: 1 });
    await outcome(call, f, input, variant === 'missing' ? 'UNAUTHENTICATED' : 'FORBIDDEN');
  });
  it('private IDs and caller owner labels never affect unavailable or grant denial', async () => {
    for (const label of ['user-a', 'other-owner', '']) for (const id of ['same-id', 'foreign-id', 'absent-id']) {
      const f = trapped(); const input = args(call); const fields = (JSON.parse(call.registration.exportArgs()) as { value: Record<string, unknown> }).value;
      for (const key of ['artifactId', 'attachmentId', 'conversationId', 'messageId', 'memoryId']) if (fields[key]) input[key] = id;
      if (fields.attachmentIds) input.attachmentIds = [id]; if (fields.userId) input.userId = label;
      for (const table of ['artifacts', 'attachments', 'conversations', 'memories', 'conversationShares', '_storage', 'runtimeAssets', 'users']) f.db.seed(table, { tenantId: 'tenant-b', memorySpaceId: 'space-a', artifactId: id, attachmentId: id, ownerPrincipalId: label, private: 'SECRET' });
      await outcome(call, f, input, 'CAPABILITY_UNAVAILABLE'); f.grant.capabilities = ['read', 'write']; await outcome(call, f, input, 'FORBIDDEN');
    }
  });
  it('omitted unique trusted scope works; ambiguous space, ambiguous tenant and tenant-only authority deny', async () => {
    const f = trapped(); const input = args(call); delete input.tenantId; delete input.memorySpaceId;
    await outcome(call, f, input, 'CAPABILITY_UNAVAILABLE');
    f.db.seed('runtimeAuthScopes', { tenantId: 'tenant-a', memorySpaceId: 'space-b', epoch: 1 });
    f.db.seed('runtimeAuthGrants', { ...f.grant, _id: 'runtimeAuthGrants:grant-b', memorySpaceId: 'space-b' });
    await outcome(call, f, input, 'FORBIDDEN');
    const g = trapped(); const membership = g.db.seed('runtimeAuthMemberships', { ...g.membership, _id: 'runtimeAuthMemberships:membership-b', tenantId: 'tenant-b' });
    g.db.seed('runtimeAuthScopes', { tenantId: 'tenant-b', epoch: 1 }); g.db.seed('runtimeAuthScopes', { tenantId: 'tenant-b', memorySpaceId: 'space-a', epoch: 1 });
    g.db.seed('runtimeAuthGrants', { ...g.grant, _id: 'runtimeAuthGrants:grant-b', membershipId: membership._id, tenantId: 'tenant-b' });
    await outcome(call, g, input, 'FORBIDDEN');
    const tenant = fixture(['storage:read', 'storage:write'], true); const h = trapped(); h.db.rows = tenant.db.rows; await outcome(call, h, input, 'FORBIDDEN');
  });
  it.each(['identity', 'control'])('opaque %s failures never become denial or readiness and never invoke diagnostic getters', async location => {
    let getters = 0;
    const errors = [new Error('PRIVATE SECRET'), new ConvexError('PRIVATE SECRET native diagnostic'), new ConvexError(unavailable), Object.defineProperty({}, 'data', { get() { getters++; throw new Error('GETTER'); } }), new Proxy({}, { getOwnPropertyDescriptor() { throw new Error('PROXY'); } }), new ConvexError({ version: 1, code: 'FORBIDDEN', message: 'Access denied', retryable: false, outcome: 'not_dispatched' })];
    for (const error of errors) {
      const f = trapped(); if (location === 'identity') f.ctx.auth.getUserIdentity = async () => { throw error; }; else f.db.beforeRead = () => { throw error; };
      await outcome(call, f, args(call), 'REGISTRY_OPERATION_FAILED');
    }
    expect(getters).toBe(0);
  });
  it('malicious identity and control-row getters abort opaquely without revealing values', async () => {
    for (const location of ['identity', 'control']) {
      const f = trapped(); let getters = 0;
      if (location === 'identity') f.ctx.auth.getUserIdentity = async () => Object.defineProperty({ issuer: 'https://host.test', subject: 'user-a', tokenIdentifier: 'fake' }, 'issuer', { get() { getters++; throw new ConvexError({ version: 1, code: 'FORBIDDEN', message: 'Access denied', retryable: false, outcome: 'not_dispatched' }); } });
      else Object.defineProperty(f.principal, 'version', { get() { getters++; throw new Error('PRIVATE GETTER SECRET'); } });
      await outcome(call, f, args(call), 'REGISTRY_OPERATION_FAILED'); expect(getters).toBe(location === 'identity' ? 0 : 1);
    }
  });
  it.each(['grant', 'principal', 'scope', 'membership', 'expiry', 'tombstone', 'fault'])('late %s fences stop readiness before old body', async variant => {
    const f = trapped(); let reads = 0;
    f.db.beforeRead = table => { if (table === 'runtimeAuthPrincipals' && ++reads === 2) {
      if (variant === 'grant') f.grant.version = 2;
      if (variant === 'principal') f.principal.version = 2;
      if (variant === 'scope') f.db.table('runtimeAuthScopes')[1].epoch = 2;
      if (variant === 'membership') f.membership.version = 2;
      if (variant === 'expiry') f.grant.expiresAt = Date.now() - 1;
      if (variant === 'tombstone') f.db.seed('runtimeAuthTombstones', { tenantId: 'tenant-a', memorySpaceId: 'space-a', resourceType: 'memorySpace', resourceId: 'space-a', deletedAt: 1 });
      if (variant === 'fault') throw new ConvexError({ version: 1, code: 'FORBIDDEN', message: 'Access denied', retryable: false, outcome: 'not_dispatched' });
    } };
    await outcome(call, f, args(call), variant === 'fault' ? 'REGISTRY_OPERATION_FAILED' : 'FORBIDDEN');
  });
  it('an exact FORBIDDEN getter on a pinned native control read stays opaque infrastructure failure', async () => {
    const f = trapped(); const get = f.db.get.bind(f.db);
    f.db.get = async (table, id) => {
      const row = await get(table, id);
      if (row && table === 'runtimeAuthPrincipals') return Object.defineProperty({ ...row }, 'version', { enumerable: true, get() { throw new ConvexError({ version: 1, code: 'FORBIDDEN', message: 'Access denied', retryable: false, outcome: 'not_dispatched' }); } });
      return row;
    };
    await outcome(call, f, args(call), 'REGISTRY_OPERATION_FAILED');
  });
  it('expiry reached during the last read of the final matching sweep denies', async () => {
    const f = trapped(); let now = 1000; let tombstones = 0; f.grant.expiresAt = 1001;
    const clock = jest.spyOn(Date, 'now').mockImplementation(() => now);
    f.db.beforeRead = table => { if (table === 'runtimeAuthTombstones' && ++tombstones === 6) now = 1001; };
    try { await outcome(call, f, args(call), 'FORBIDDEN'); expect(tombstones).toBe(6); } finally { clock.mockRestore(); }
  });
  it('expiry at the final database await cannot reveal readiness', async () => {
    const f = trapped(); let now = 1000; f.grant.expiresAt = 1001;
    const clock = jest.spyOn(Date, 'now').mockImplementation(() => now);
    f.db.beforeRead = table => { if (table === 'runtimeAuthTombstones') now = 1001; };
    try { await outcome(call, f, args(call), 'FORBIDDEN'); } finally { clock.mockRestore(); }
  });
});
it('both adapter guards reject and never resolve Promise<never>', async () => {
  const f = trapped(); await expect(runtimeAssetUnavailable(f.ctx, 'storage:read', { tenantId: 'tenant-a', memorySpaceId: 'space-a' })).rejects.toMatchObject({ data: unavailable });
  await expect(internalAssetUnavailable()).rejects.toMatchObject({ data: unavailable });
});
interface AssetHistorical extends HistoricalModules {
  classification: string;
  nativeValidators: { registrations: { path: string; args: { type: string; value: Record<string, unknown> } }[] };
  accepted22: { path: string; declaration: string; sha256: string }[];
}
it('native exportArgs matches every original installed Convex validator field and preserves required selectors', () => {
  const frozen = catalogFixture<AssetHistorical>('asset-historical.json');
  expect(frozen.classification).toBe('HISTORICAL_PRE_ASSET_CLOSURE_ONLY');
  expect(frozen.nativeValidators.registrations).toHaveLength(17);
  expect(frozen.nativeValidators.registrations.map(row => row.path).sort()).toEqual(calls.map(call => call.path).sort());
  for (const row of frozen.nativeValidators.registrations) {
    const call = calls.find(c => c.path === row.path)!;
    const current = JSON.parse(call.registration.exportArgs()) as { type: string; value: Record<string, unknown> };
    expect(current.type).toBe(row.args.type);
    for (const [field, validator] of Object.entries(row.args.value)) expect(current.value[field]).toEqual(validator);
    for (const field of Object.keys(current.value).filter(k => !(k in row.args.value))) {
      expect(['tenantId', 'memorySpaceId']).toContain(field);
      expect(current.value[field]).toEqual({ fieldType: { type: 'string' }, optional: true });
    }
  }
});
it('accepted22 historical declarations stay literal-identical; all current validators and artifact bodies preserve the authorized repair', () => {
  const frozen = catalogFixture<AssetHistorical>('asset-historical.json');
  const archived = historicalRepairSources()['convex-dev/artifacts.ts'];
  expect(sha256(archived)).toBe('15959b6cbc5126425c40a16d7a473cf0c353211b78b677e51660720abe7a9c14');
  const accepted = catalogDeclarations(archived);
  expect(frozen.accepted22).toHaveLength(22);
  for (const row of frozen.accepted22) {
    const text = accepted.find(declaration => declaration.name === row.path.split(':')[1])!.declaration;
    expect(text).toBe(row.declaration);
    expect(sha256(text)).toBe(row.sha256);
  }
  const repaired = repairedHistoricalSources(historicalRepairSources());
  // Bind the entire maintained artifact body to the accepted source with its
  // sole reviewed index edit, rather than weakening this to validator equality.
  expect(backendSource('artifacts')).toBe(repaired['convex-dev/artifacts.ts']);
  expect(sha256(backendSource('artifacts'))).toBe('3252eb473cd80c9fe222a21322cb55e321704635dfd17596c319183fb9bcc2a3');
  expect(catalogDeclarations(backendSource('artifacts'))).toHaveLength(27);
  for (const module of ['artifacts', 'attachments']) {
    const before = frozen.originalModules[module];
    const after = catalogDeclarations(backendSource(module));
    expect(after.map(row => row.name)).toEqual(before.map(row => row.name));
    for (const original of before) {
      const validators = after.find(row => row.name === original.name)!.validators;
      for (const [field, literal] of Object.entries(original.validators)) expect(validators[field]).toBe(literal);
      expect(Object.keys(validators).filter(key => !(key in original.validators)).every(key => ['tenantId', 'memorySpaceId'].includes(key))).toBe(true);
    }
  }
  // The immutable manifest binds all seven original source hashes. Current auth
  // files have later approved fences; historical hashes are not current pins.
  expect(Object.keys(frozen.sourceHashes)).toHaveLength(7);
  const repair = catalogFixture<HistoricalRepair>('index-repair-historical.json');
  expect(frozen.sourceHashes['convex-dev/schema.ts']).toBe(repair.preHashes['convex-dev/schema.ts']);
  expect(frozen.sourceHashes['convex-dev/runtimeArtifactAuth.ts']).toBe(repair.preHashes['convex-dev/runtimeArtifactAuth.ts']);
});
it('replays the exact historical three-edit native repair, 26 tables, 173 indexes and every tamper control without private runners', () => {
  const repair = catalogFixture<HistoricalRepair>('index-repair-historical.json');
  const repaired = repairedHistoricalSources(historicalRepairSources());
  verifyHistoricalRepair(repaired);
  expect(repair.wholeByteAuthorizedEdits).toBe(3);
  expect(repair.postHashes).toEqual({
    'convex-dev/schema.ts': '07df1b0be4647848a3e9fbd1eb9d27d81ad78194f77d3c447c7ee4f2de419b1d',
    'convex-dev/runtimeArtifactAuth.ts': 'aa75122698632dfb836b10a12251de7c580f58aa8c16d866913f07fc657962c8',
    'convex-dev/artifacts.ts': '3252eb473cd80c9fe222a21322cb55e321704635dfd17596c319183fb9bcc2a3',
  });
  const controls = [
    ['changed tenant scope', 'convex-dev/runtimeArtifactAuth.ts', 'q.eq("tenantId", authority.tenantId)', 'q.eq("tenantId", "foreign")'],
    ['extra index', 'convex-dev/schema.ts', '.index("by_runtime_key",', '.index("unauthorized", ["tenantId"]).index("by_runtime_key",'],
    ['changed candidate index', 'convex-dev/runtimeArtifactAuth.ts', '.withIndex("by_tenant_space",', '.withIndex("by_runtime_scope",'],
    ['changed purge space bound', 'convex-dev/artifacts.ts', '.eq("memorySpaceId", args.memorySpaceId!)', '.eq("memorySpaceId", "foreign")'],
    ['changed other declaration', 'convex-dev/artifacts.ts', 'export const purgeAll', '/* unrelated tamper */ export const purgeAll'],
  ];
  for (const [, target, needle, replacement] of controls) {
    expect(repaired[target]).toContain(needle);
    expect(() => verifyHistoricalRepair({ ...repaired, [target]: repaired[target].replace(needle, replacement) })).toThrow();
  }
  expect(controls.map(([name]) => name)).toEqual(['changed tenant scope', 'extra index', 'changed candidate index', 'changed purge space bound', 'changed other declaration']);
  const before = repair.before;
  expect(before.definitions).toHaveLength(26);
  expect(before.definitions.reduce((count, table) => count + table.exported.indexes.length, 0)).toBe(174);
  const native = structuredClone(before);
  const table = native.definitions.find(definition => definition.table === 'artifacts')!;
  expect(table.exported.indexes.filter(index => index.indexDescriptor === 'by_runtime_scope')).toHaveLength(1);
  table.exported.indexes = table.exported.indexes.filter(index => index.indexDescriptor !== 'by_runtime_scope');
  // All 26 validators, search/vector/index definitions and all 27 registrations
  // must equal the actual approved native capture, not a newly captured baseline.
  expect(sha256(JSON.stringify(native))).toBe(repair.afterHash);
  expect(native.definitions).toHaveLength(repair.tableCount);
  expect(native.definitions.reduce((count, definition) => count + definition.exported.indexes.length, 0)).toBe(173);
  const duplicates = native.definitions.flatMap(definition => definition.exported.indexes.flatMap((index, position) =>
    definition.exported.indexes.slice(position + 1).filter(other => JSON.stringify(other.fields) === JSON.stringify(index.fields))));
  expect(duplicates).toHaveLength(0);
  expect(repair.duplicateSequencesAfter).toBe(0);
  expect(table.exported.indexes.filter(index => index.fields.join(',') === 'tenantId,memorySpaceId'))
    .toEqual([{ indexDescriptor: 'by_tenant_space', fields: ['tenantId', 'memorySpaceId'] }]);
  type Registration = { isPublic?: boolean; isInternal?: boolean; exportArgs(): string; exportReturns(): string };
  const current = Object.fromEntries(Object.entries(artifacts).map(([name, value]) => {
    const registration = value as unknown as Registration;
    return [name, { isPublic: registration.isPublic, isInternal: registration.isInternal, args: registration.exportArgs(), returns: registration.exportReturns() }];
  }));
  expect(JSON.parse(JSON.stringify(current))).toEqual(native.registrations);
});
it('retains all four historical foundation declaration tamper controls', () => {
  const repaired = repairedHistoricalSources(historicalRepairSources());
  const artifact = repaired['convex-dev/artifacts.ts'];
  const statistics = catalogFixture<Record<string, { sourceHash: string; declaration: string; sha256: string }>>('statistics-historical.json');
  const controls = [
    { source: artifact, needle: 'artifactHandler(async () => {', expected: sha256(artifact) },
    { source: artifact, needle: 'runtimeAssetUnavailable(', expected: sha256(artifact) },
    ...['agents', 'memorySpaces'].map(module => ({ source: statistics[module].declaration, needle: 'statisticsUnavailable(', expected: statistics[module].sha256 })),
  ];
  expect(controls).toHaveLength(4);
  for (const module of ['agents', 'memorySpaces']) {
    expect(catalogDeclarations(backendSource(module)).find(row => row.declaration.includes('statisticsUnavailable('))?.declaration)
      .toBe(statistics[module].declaration);
  }
  for (const { source, needle, expected } of controls) {
    expect(sha256(source)).toBe(expected);
    expect(source).toContain(needle);
    expect(sha256(source.replace(needle, needle + '/* unauthorized tampering */'))).not.toBe(expected);
  }
});
it('maintained current composition preserves every current native table and the unique artifact scope index', () => {
  withComposedCatalog((_directory, files) => {
    expect(files['schema.ts'].toString()).toBe(backendSource('schema'));
    const native = JSON.parse((schema as unknown as { export(): string }).export()) as { tables: { tableName: string; indexes: { indexDescriptor: string; fields: string[] }[]; documentType: unknown }[] };
    for (const table of native.tables) {
      expect(table.indexes.flatMap((index, position) => table.indexes.slice(position + 1)
        .filter(other => JSON.stringify(index.fields) === JSON.stringify(other.fields)))).toEqual([]);
    }
    expect(native.tables.find(table => table.tableName === 'artifacts')!.indexes
      .filter(index => index.fields.join(',') === 'tenantId,memorySpaceId'))
      .toEqual([{ indexDescriptor: 'by_tenant_space', fields: ['tenantId', 'memorySpaceId'] }]);
    const host = defineTable({ owner: v.string(), amount: v.number() }).index('by_owner', ['owner']);
    const composed = JSON.parse((defineSchema({ ...schema.tables, portableHost: host }) as unknown as { export(): string }).export()) as typeof native;
    expect(composed.tables).toHaveLength(native.tables.length + 1);
    for (const table of native.tables) expect(composed.tables.find(candidate => candidate.tableName === table.tableName)).toEqual(table);
  });
});
