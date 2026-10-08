import { afterAll, describe, expect, it } from '@jest/globals';
import * as conversations from '../../../convex-dev/conversations';
import * as shares from '../../../convex-dev/conversationShares';
import * as snapshots from '../../../convex-dev/conversationSnapshots';
import * as history from '../../../convex-dev/factHistory';
import * as a2a from '../../../convex-dev/a2a';
import { ConvexError } from 'convex/values';
import { fixture, invoke } from '../runtimeRegistryAuth/fixture';
import fs from 'node:fs';
import crypto from 'node:crypto';
import ts from 'typescript';

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
  it('checks applicable source deletion fences initially and after admission without source hydration', async () => {
    const input = args(call);
    const sources: { resourceType: string; resourceId: string }[] = [];
    if (input.conversationId) sources.push({ resourceType: 'conversation', resourceId: String(input.conversationId) });
    if (input.factId) sources.push({ resourceType: 'fact', resourceId: String(input.factId) });
    if (input.shareId) sources.push({ resourceType: 'source', resourceId: JSON.stringify(['conversationShares', input.shareId]) });
    if (input.snapshotId) sources.push({ resourceType: 'source', resourceId: JSON.stringify(['conversationSnapshots', input.snapshotId]) });
    const fields = (JSON.parse(call.registration.exportArgs()) as { value: Record<string, unknown> }).value;
    if (fields.conversationIds) { input.conversationIds = ['same-id']; sources.push({ resourceType: 'conversation', resourceId: 'same-id' }); }
    for (const source of sources) for (const late of [false, true]) for (const memorySpaceId of ['space-a', undefined]) {
      const f = trapped(); let reads = 0;
      const seed = () => f.db.seed('runtimeAuthTombstones', { tenantId: 'tenant-a', memorySpaceId, ...source, deletedAt: 1 });
      if (!late) seed();
      else f.db.beforeRead = table => { if (table === 'runtimeAuthPrincipals' && ++reads === 2) seed(); };
      await outcome(call, f, input, 'FORBIDDEN');
    }
  });
  it('source control fault cannot masquerade as an exact policy FORBIDDEN', async () => {
    const input = args(call); const fields = (JSON.parse(call.registration.exportArgs()) as { value: Record<string, unknown> }).value;
    if (fields.conversationIds) input.conversationIds = ['same-id'];
    if (!['conversationId', 'conversationIds', 'factId', 'shareId', 'snapshotId'].some(key => input[key] !== undefined)) return;
    const f = trapped(); let reads = 0;
    f.db.beforeRead = table => { if (table === 'runtimeAuthTombstones' && ++reads === 3) throw new ConvexError({ version: 1, code: 'FORBIDDEN', message: 'Access denied', retryable: false, outcome: 'not_dispatched' }); };
    await outcome(call, f, input, 'REGISTRY_OPERATION_FAILED');
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
it('freezes original source hashes, full native validators and original 251 classification', () => {
  const qa = '_goals/convex-backend-runtime-2026-10-02/qa/task03b2e-transcript-a2a-foundation/original/';
  const hashes = JSON.parse(fs.readFileSync(qa + 'source-hashes.json', 'utf8')) as Record<string, string>;
  for (const [file, expected] of Object.entries(hashes)) expect(crypto.createHash('sha256').update(fs.readFileSync(qa + file.split('/').pop())).digest('hex')).toBe(expected);
  const rows = JSON.parse(fs.readFileSync(qa + 'registrations48.json', 'utf8')) as unknown[]; expect(rows).toHaveLength(48);
  expect(fs.existsSync(qa + 'baseline251.json')).toBe(true);
});

it('original argument validators remain byte-identical per AST; only absent selectors added', () => {
  const originals = '_goals/convex-backend-runtime-2026-10-02/qa/task03b2e-transcript-a2a-foundation/original/';
  function validators(source: string) {
    const ast = ts.createSourceFile('source.ts', source, ts.ScriptTarget.Latest, true);
    const result = new Map<string, Map<string, string>>();
    for (const statement of ast.statements) if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) {
      const call = declaration.initializer;
      if (!call || !ts.isCallExpression(call) || !ts.isObjectLiteralExpression(call.arguments[0])) continue;
      const property = call.arguments[0].properties.find(p => p.name?.getText(ast) === 'args');
      if (!property || !ts.isPropertyAssignment(property) || !ts.isObjectLiteralExpression(property.initializer)) continue;
      result.set(declaration.name.getText(ast), new Map(property.initializer.properties.filter(ts.isPropertyAssignment).map(p => [p.name.getText(ast), p.initializer.getText(ast)])));
    }
    return result;
  }
  for (const module of Object.keys(modules)) {
    const before = validators(fs.readFileSync(originals + module + '.ts', 'utf8'));
    const after = validators(fs.readFileSync('convex-dev/' + module + '.ts', 'utf8'));
    expect([...after.keys()]).toEqual([...before.keys()]);
    for (const [name, fields] of before) {
      const current = after.get(name)!;
      for (const [field, validator] of fields) expect(current.get(field)).toBe(validator);
      expect([...current.keys()].filter(field => !fields.has(field)).every(field => ['tenantId', 'memorySpaceId'].includes(field))).toBe(true);
    }
  }
});
