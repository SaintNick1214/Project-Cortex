import { afterAll, describe, expect, it } from '@jest/globals';
import * as conversations from '../../../convex-dev/conversations';
import * as shares from '../../../convex-dev/conversationShares';
import * as snapshots from '../../../convex-dev/conversationSnapshots';
import * as history from '../../../convex-dev/factHistory';
import * as a2a from '../../../convex-dev/a2a';
import { ConvexError } from 'convex/values';
import { fixture, invoke } from '../runtimeRegistryAuth/fixture';
import fs from 'node:fs';
import { backendSource, catalogDeclarations, catalogFixture, type HistoricalModules } from '../../helpers/backend-catalog';

type Native = { isPublic?: boolean; isInternal?: boolean; isQuery?: boolean; exportArgs(): string };
type Validator = { type: string; value?: unknown; tableName?: string };
const modules = { conversations, conversationShares: shares, conversationSnapshots: snapshots, factHistory: history, a2a };
const internal = new Set(['conversations:purgeAll', 'conversationShares:incrementViewCount', ...['logEvent', 'deleteByFactId', 'deleteByUserId', 'deleteByMemorySpace', 'purgeOldEvents'].map(n => 'factHistory:' + n)]);
const calls = Object.entries(modules).flatMap(([module, exports]) => Object.entries(exports).map(([name, registration]) => ({ path: module + ':' + name, registration: registration as unknown as Native })));
function sample(v: Validator): unknown {
  switch (v.type) {
    case 'string': return 'same-id';
    case 'number': return 1;
    case 'boolean': return true;
    case 'null': return null;
    case 'literal': return v.value;
    case 'array': return [sample(v.value as Validator)];
    case 'union': return sample((v.value as Validator[])[0]);
    case 'object': return Object.fromEntries(Object.entries(v.value as Record<string, { fieldType: Validator; optional: boolean }>).filter(([, f]) => !f.optional).map(([k, f]) => [k, sample(f.fieldType)]));
    case 'id': return v.tableName + ':fixture';
    case 'any': return {};
    default: throw new Error('Unsupported native validator ' + v.type);
  }
}
function args(call: typeof calls[number]): Record<string, unknown> {
  const validators = JSON.parse(call.registration.exportArgs()) as Validator;
  const fields = validators.value as Record<string, unknown>;
  return { ...(sample(validators) as Record<string, unknown>), ...(fields.tenantId ? { tenantId: 'tenant-a' } : {}), ...(fields.memorySpaceId ? { memorySpaceId: 'space-a' } : {}) };
}
function trapped(capabilities = ['read', 'write']) {
  const f = fixture(capabilities);
  const controls = new Set(['runtimeAuthPrincipals', 'runtimeAuthMemberships', 'runtimeAuthGrants', 'runtimeAuthScopes', 'runtimeAuthTombstones']);
  const attempts: string[] = [];
  f.db.beforeRead = table => { if (!controls.has(table)) { attempts.push(table); throw new Error('PRIVATE DATA'); } };
  f.db.beforeWrite = table => { attempts.push(table); throw new Error('EFFECT'); };
  const effect = new Proxy(() => undefined, { get() { attempts.push('external-effect'); throw new Error('EFFECT'); }, apply() { attempts.push('external-effect'); throw new Error('EFFECT'); } });
  const query = f.db.query.bind(f.db); f.db.query = table => { if (!controls.has(table)) { attempts.push(table); throw new Error('PRIVATE DATA'); } return query(table); };
  const get = f.db.get.bind(f.db); f.db.get = async (table, id) => { if (!controls.has(table)) { attempts.push(table); throw new Error('PRIVATE DATA'); } return await get(table, id); };
  Object.assign(f.ctx, { scheduler: effect, storage: effect, runQuery: effect, runMutation: effect, runAction: effect });
  return { ...f, attempts };
}
const positiveControls: Record<string, unknown> = {};
afterAll(() => { if (process.env.CORTEX_UNAVAILABLE_RECEIPT) fs.writeFileSync(process.env.CORTEX_UNAVAILABLE_RECEIPT, JSON.stringify(positiveControls, null, 2)); });
async function outcome(call: typeof calls[number], f: ReturnType<typeof trapped>, input: unknown, code: string) {
  const error: unknown = await invoke(call.registration, f.ctx, input).then(() => undefined, (failure: unknown) => failure);
  expect(error).toMatchObject({ data: { version: 1, code, retryable: false, outcome: code === 'REGISTRY_OPERATION_FAILED' ? 'failed' : 'not_dispatched' } });
  expect(f.attempts).toEqual([]); expect(f.db.writes).toBe(0);
  return error instanceof ConvexError ? error.data : undefined;
}
it('covers exactly 48 native registrations, 41 public and 7 internal', () => {
  expect(calls).toHaveLength(48); expect(calls.filter(c => c.registration.isPublic)).toHaveLength(41);
  for (const c of calls) expect(!!c.registration.isInternal).toBe(internal.has(c.path));
});
for (const call of calls) describe(call.path, () => {
  it('rejects every healthy invocation before legacy bodies, with unchanged native fields', async () => {
    const f = trapped(); const observed = await outcome(call, f, args(call), 'CAPABILITY_NOT_READY');
    positiveControls[call.path] = { observed, nativeValidators: JSON.parse(call.registration.exportArgs()), privateDataOrEffectAttempts: f.attempts, writes: f.db.writes, controlTables: [...new Set(f.db.traces.map(trace => trace.table))] };
    if (!internal.has(call.path)) {
      const fields = (JSON.parse(call.registration.exportArgs()) as { value: Record<string, unknown> }).value;
      expect(fields.tenantId).toBeDefined(); expect(fields.memorySpaceId).toBeDefined();
    }
  });
  if (internal.has(call.path)) {
    it('internal unready is uniform even without identity or private rows', async () => { const f = trapped([]); f.ctx.auth.getUserIdentity = async () => null; await outcome(call, f, {}, 'CAPABILITY_NOT_READY'); });
    return;
  }
  it.each(['missing', 'forged', 'expired', 'revoked', 'capability', 'tenant', 'space', 'deleted', 'principal', 'membership'])('denies %s', async variant => {
    const f = trapped(); const input = args(call);
    if (variant === 'missing') f.ctx.auth.getUserIdentity = async () => null;
    if (variant === 'forged') f.ctx.auth.getUserIdentity = async () => ({ issuer: 'forged', subject: 'user-a', tokenIdentifier: 'fake' });
    if (variant === 'expired') f.grant.expiresAt = Date.now() - 1;
    if (variant === 'revoked') f.grant.revokedAt = 1;
    if (variant === 'capability') f.grant.capabilities = [call.registration.isQuery ? 'write' : 'read', 'admin', 'run'];
    if (variant === 'tenant') input.tenantId = 'tenant-b';
    if (variant === 'space') input.memorySpaceId = 'space-b';
    if (variant === 'deleted') f.db.table('runtimeAuthScopes')[1].deletedAt = 1;
    if (variant === 'principal') f.principal.deletedAt = 1;
    if (variant === 'membership') f.membership.revokedAt = 1;
    await outcome(call, f, input, variant === 'missing' ? 'UNAUTHENTICATED' : 'FORBIDDEN');
  });
  it('untrusted owner/participant/share labels and pending private fields never change readiness', async () => {
    for (const owner of ['user-a', 'other-owner', undefined]) {
      const f = trapped();
      for (const table of ['conversations', 'conversationShares', 'conversationSnapshots', 'factHistory', 'memories', 'facts', 'agents']) f.db.seed(table, { tenantId: 'tenant-b', memorySpaceId: 'space-a', shareId: 'same-id', conversationId: 'same-id', ownerPrincipalId: owner, participants: { userId: owner }, pending: owner !== undefined, private: 'SECRET' });
      const input = args(call); const fields = (JSON.parse(call.registration.exportArgs()) as { value: Record<string, unknown> }).value;
      for (const field of ['userId', 'ownerUserId', 'grantedBy', 'createdBy']) if (fields[field]) input[field] = owner;
      if (fields.participants) input.participants = { userId: owner };
      await outcome(call, f, input, 'CAPABILITY_NOT_READY');
    }
  });
  it('requires concrete scope, preserves omitted unique space resolution and denies ambiguity', async () => {
    const f = trapped(); const input = args(call); delete input.tenantId; delete input.memorySpaceId;
    await outcome(call, f, input, 'CAPABILITY_NOT_READY');
    f.db.seed('runtimeAuthScopes', { tenantId: 'tenant-a', memorySpaceId: 'space-b', epoch: 1 });
    f.db.seed('runtimeAuthGrants', { ...f.grant, _id: 'grant-b', memorySpaceId: 'space-b' });
    await outcome(call, f, input, 'FORBIDDEN');
    const tenant = fixture(['read', 'write'], true); const g = trapped(); g.db.rows = tenant.db.rows;
    await outcome(call, g, input, 'FORBIDDEN');
  });
  it('unavailable outcome is invariant under caller-source tombstones initially or after authority admission', async () => {
    const input = args(call);
    const sources: { resourceType: string; resourceId: string }[] = [];
    if (input.conversationId) sources.push({ resourceType: 'conversation', resourceId: String(input.conversationId) });
    if (input.factId) sources.push({ resourceType: 'fact', resourceId: String(input.factId) });
    if (input.shareId) sources.push({ resourceType: 'source', resourceId: JSON.stringify(['conversationShares', input.shareId]) });
    if (input.snapshotId) sources.push({ resourceType: 'source', resourceId: JSON.stringify(['conversationSnapshots', input.snapshotId]) });
    const fields = (JSON.parse(call.registration.exportArgs()) as { value: Record<string, unknown> }).value;
    if (fields.conversationIds) { input.conversationIds = ['same-id']; sources.push({ resourceType: 'conversation', resourceId: 'same-id' }); }
    const baseline = await outcome(call, trapped(), input, 'CAPABILITY_NOT_READY');
    for (const source of sources) for (const late of [false, true]) for (const memorySpaceId of ['space-a', undefined]) {
      const f = trapped(); let reads = 0;
      const seed = () => f.db.seed('runtimeAuthTombstones', { tenantId: 'tenant-a', memorySpaceId, ...source, deletedAt: 1 });
      if (!late) seed();
      else f.db.beforeRead = table => { if (table === 'runtimeAuthPrincipals' && ++reads === 2) seed(); };
      const observed = await outcome(call, f, input, 'CAPABILITY_NOT_READY');
      expect(observed).toEqual(baseline);
      expect(f.db.traces.filter(trace => trace.table === 'runtimeAuthTombstones').every(trace => trace.keys.some(([key, value]) => key === 'resourceType' && ['tenant', 'memorySpace'].includes(String(value))))).toBe(true);
    }
  });
  it('authority control fault cannot masquerade as an exact policy FORBIDDEN after source lookups are removed', async () => {
    const input = args(call); const fields = (JSON.parse(call.registration.exportArgs()) as { value: Record<string, unknown> }).value;
    if (fields.conversationIds) input.conversationIds = ['same-id'];
    if (!['conversationId', 'conversationIds', 'factId', 'shareId', 'snapshotId'].some(key => input[key] !== undefined)) return;
    const f = trapped(); let reads = 0;
    f.db.beforeRead = table => { if (table === 'runtimeAuthTombstones' && ++reads === 3) throw new ConvexError({ version: 1, code: 'FORBIDDEN', message: 'Access denied', retryable: false, outcome: 'not_dispatched' }); };
    await outcome(call, f, input, 'REGISTRY_OPERATION_FAILED');
  });
  it.each(['issuer', 'subject'])('returned identity %s accessor is opaque without invoking it', async field => {
    const f = trapped(); let invoked = 0;
    const value = Object.defineProperty({ issuer: 'https://host.test', subject: 'user-a' }, field, { get() { invoked++; throw new ConvexError({ version: 1, code: 'FORBIDDEN', message: 'Access denied', retryable: false, outcome: 'not_dispatched' }); } });
    f.ctx.auth.getUserIdentity = async () => value as never;
    await outcome(call, f, args(call), 'REGISTRY_OPERATION_FAILED'); expect(invoked).toBe(0);
  });
  it.each(['principal', 'membership', 'grant'])('returned %s control accessors remain opaque before pure policy', async field => {
    const f = trapped(); let invoked = 0; const get = f.db.get.bind(f.db);
    const table = field === 'principal' ? 'runtimeAuthPrincipals' : field === 'membership' ? 'runtimeAuthMemberships' : 'runtimeAuthGrants';
    f.db.get = async (name, id) => {
      const row = await get(name, id); if (name !== table || !row) return row;
      return Object.defineProperty({ ...row }, 'version', { enumerable: true, get() { invoked++; throw new ConvexError({ version: 1, code: 'FORBIDDEN', message: 'Access denied', retryable: false, outcome: 'not_dispatched' }); } });
    };
    await outcome(call, f, args(call), 'REGISTRY_OPERATION_FAILED'); expect(invoked).toBe(0);
  });
  it('inherited identity accessors are opaque without evaluating their getters', async () => {
    const f = trapped(); let invoked = 0;
    const prototype = Object.defineProperty({}, 'issuer', { get() { invoked++; throw new ConvexError({ version: 1, code: 'FORBIDDEN', message: 'Access denied', retryable: false, outcome: 'not_dispatched' }); } });
    f.ctx.auth.getUserIdentity = async () => Object.create(prototype) as never;
    await outcome(call, f, args(call), 'REGISTRY_OPERATION_FAILED'); expect(invoked).toBe(0);
  });
  it('returned identity proxy descriptor faults cannot become policy denial', async () => {
    const f = trapped(); f.ctx.auth.getUserIdentity = async () => new Proxy({ issuer: 'https://host.test', subject: 'user-a' }, { getOwnPropertyDescriptor() { throw new ConvexError({ version: 1, code: 'FORBIDDEN', message: 'Access denied', retryable: false, outcome: 'not_dispatched' }); } }) as never;
    await outcome(call, f, args(call), 'REGISTRY_OPERATION_FAILED');
  });
  it.each(['identity', 'control'])('keeps %s unknown faults opaque, never invokes error getters', async location => {
    for (const thrown of [new Error('PRIVATE SECRET'), Object.defineProperty({}, 'data', { get() { throw new Error('GETTER'); } }), new Proxy({}, { getOwnPropertyDescriptor() { throw new Error('PROXY'); } }), new ConvexError({ version: 1, code: 'FORBIDDEN', message: 'Access denied', retryable: false, outcome: 'not_dispatched' })]) {
      const f = trapped(); if (location === 'identity') f.ctx.auth.getUserIdentity = async () => { throw thrown; }; else f.db.beforeRead = () => { throw thrown; };
      await outcome(call, f, args(call), 'REGISTRY_OPERATION_FAILED');
    }
  });
  it.each(['grant', 'principal', 'scope'])('late %s generation changes deny before unready', async variant => {
    const f = trapped(); let reads = 0;
    f.db.beforeRead = table => { if (table === 'runtimeAuthPrincipals' && ++reads === 2) {
      if (variant === 'grant') f.grant.version = 2;
      if (variant === 'principal') f.principal.version = 2;
      if (variant === 'scope') f.db.table('runtimeAuthScopes')[1].epoch = 2;
    } };
    await outcome(call, f, args(call), 'FORBIDDEN');
  });
});
interface TranscriptHistorical extends HistoricalModules {
  classification: string;
  registrations: { path: string; sourceSha256: string; validators: string }[];
  baseline: {
    completeness: { counts: Record<string, number>; unresolved: string[]; sourceHashes: { file: string; sha256: string }[] };
    endpoints: { path: string; visibility: string; disposition: string }[];
  };
}
it('pins the original source provenance, all 48 registrations and every original 251 classification as historical', () => {
  const frozen = catalogFixture<TranscriptHistorical>('transcript-historical.json');
  expect(frozen.classification).toBe('HISTORICAL_PRE_CLOSURE_ONLY');
  expect(Object.keys(frozen.sourceHashes)).toHaveLength(5);
  expect(frozen.registrations).toHaveLength(48);
  expect(new Set(frozen.registrations.map(row => row.path))).toHaveProperty('size', 48);
  for (const row of frozen.registrations) {
    const module = row.path.split(':')[0];
    expect(row.sourceSha256).toBe(frozen.sourceHashes[`convex-dev/${module}.ts`]);
    expect(row.validators).toMatch(/^\{/);
  }
  expect(frozen.registrations.map(row => row.path).sort()).toEqual(calls.map(call => call.path).sort());
  expect(frozen.baseline.completeness.unresolved).toEqual([]);
  expect(frozen.baseline.completeness.counts).toEqual({ modules: 22, registered: 251, public: 240, internal: 11,
    httpRoutes: 0, registeredBuilderCalls: 251, resolvedExports: 251, guard: 198, internalize: 42 });
  expect(frozen.baseline.endpoints).toHaveLength(251);
  expect(new Set(frozen.baseline.endpoints.map(row => row.path)).size).toBe(251);
  expect(frozen.baseline.endpoints.filter(row => row.visibility === 'public')).toHaveLength(240);
  expect(frozen.baseline.endpoints.filter(row => row.visibility === 'internal')).toHaveLength(11);
  expect(frozen.baseline.endpoints.filter(row => row.disposition === 'guard')).toHaveLength(198);
  expect(frozen.baseline.endpoints.filter(row => row.disposition === 'internalize')).toHaveLength(42);
  expect(frozen.baseline.endpoints.filter(row => row.disposition === 'retain-internal')).toHaveLength(11);
  for (const [file, hash] of Object.entries(frozen.sourceHashes)) {
    expect(frozen.baseline.completeness.sourceHashes.find(row => row.file === file)?.sha256).toBe(hash);
  }
});

it('original argument validators remain byte-identical per AST; only absent selectors added', () => {
  const frozen = catalogFixture<HistoricalModules>('transcript-historical.json');
  for (const module of Object.keys(modules)) {
    const before = frozen.originalModules[module];
    const after = catalogDeclarations(backendSource(module));
    expect(after.map(row => row.name)).toEqual(before.map(row => row.name));
    for (const original of before) {
      const current = after.find(row => row.name === original.name)!.validators;
      for (const [field, validator] of Object.entries(original.validators)) expect(current[field]).toBe(validator);
      expect(Object.keys(current).filter(field => !(field in original.validators)).every(field => ['tenantId', 'memorySpaceId'].includes(field))).toBe(true);
    }
  }
});
