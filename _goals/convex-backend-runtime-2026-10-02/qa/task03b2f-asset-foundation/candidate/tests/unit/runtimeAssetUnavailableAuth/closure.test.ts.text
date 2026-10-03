import { describe, expect, it, jest } from '@jest/globals';
import * as artifacts from '../../../convex-dev/artifacts';
import * as attachments from '../../../convex-dev/attachments';
import { runtimeAssetUnavailable, internalAssetUnavailable } from '../../../convex-dev/runtimeAssetUnavailableAuth';
import { ConvexError, type Value } from 'convex/values';
import { fixture, invoke } from '../runtimeRegistryAuth/fixture';
import fs from 'node:fs';
import crypto from 'node:crypto';
import ts from 'typescript';

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
const qa = '_goals/convex-backend-runtime-2026-10-02/qa/task03b2f-asset-foundation/original/';
function declarations(source: string) {
  const ast = ts.createSourceFile('source.ts', source, ts.ScriptTarget.Latest, true); const result = new Map<string, { declaration: string; validators: Map<string, string> }>();
  for (const s of ast.statements) if (ts.isVariableStatement(s)) for (const d of s.declarationList.declarations) {
    const c = d.initializer; if (!c || !ts.isCallExpression(c) || !ts.isObjectLiteralExpression(c.arguments[0])) continue;
    const a = c.arguments[0].properties.find(p => p.name?.getText(ast) === 'args');
    if (!a || !ts.isPropertyAssignment(a) || !ts.isObjectLiteralExpression(a.initializer)) continue;
    result.set(d.name.getText(ast), { declaration: s.getText(ast), validators: new Map(a.initializer.properties.filter(ts.isPropertyAssignment).map(p => [p.name.getText(ast), p.initializer.getText(ast)])) });
  }
  return result;
}
it('native exportArgs matches every original installed Convex validator field and preserves required selectors', () => {
  const frozen = JSON.parse(fs.readFileSync(qa + 'native-validators17.json', 'utf8')) as { registrations: { path: string; args: { type: string; value: Record<string, unknown> } }[] };
  expect(frozen.registrations).toHaveLength(17);
  for (const row of frozen.registrations) {
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
it('accepted22 declarations stay literal-identical;17 original validators unchanged, only absent scope selectors added', () => {
  const accepted = JSON.parse(fs.readFileSync(qa + 'accepted22.json', 'utf8')) as { path: string; declaration: string; sha256: string }[];
  const current = declarations(fs.readFileSync('convex-dev/artifacts.ts', 'utf8')); expect(accepted).toHaveLength(22);
  for (const row of accepted) { const text = current.get(row.path.split(':')[1])!.declaration; expect(text).toBe(row.declaration); expect(crypto.createHash('sha256').update(text).digest('hex')).toBe(row.sha256); }
  for (const module of ['artifacts', 'attachments']) {
    const before = declarations(fs.readFileSync(qa + module + '.ts', 'utf8')); const after = declarations(fs.readFileSync('convex-dev/' + module + '.ts', 'utf8'));
    expect([...after.keys()]).toEqual([...before.keys()]);
    for (const [name, original] of before) {
      const validators = after.get(name)!.validators;
      for (const [field, literal] of original.validators) expect(validators.get(field)).toBe(literal);
      expect([...validators.keys()].filter(k => !original.validators.has(k)).every(k => ['tenantId', 'memorySpaceId'].includes(k))).toBe(true);
    }
  }
  const hashes = JSON.parse(fs.readFileSync(qa + 'source-hashes.json', 'utf8')) as Record<string, string>;
  for (const [path, hash] of Object.entries(hashes)) {
    const actual = path.endsWith('/artifacts.ts') || path.endsWith('/attachments.ts') ? qa + path.split('/').pop() : path;
    expect(crypto.createHash('sha256').update(fs.readFileSync(actual)).digest('hex')).toBe(hash);
  }
});
