import { beforeEach, afterEach, describe, expect, it, jest } from '@jest/globals';
import { ConvexError, type Value } from 'convex/values';
import { fixture, invoke } from '../runtimeRegistryAuth/fixture';
import { runtimeAssetUnavailable, internalAssetUnavailable } from '../../../convex-dev/runtimeAssetUnavailableAuth';
import { artifacts, attachments, assetCase, assetCapability, openedAuthorityTests, openedFaultTests, assertCurrentArgs, installMockRoot, type NativeCall } from '../../helpers/current-closure-fixtures';
import fs from 'node:fs';
import crypto from 'node:crypto';
const selected = ['setFileRef', 'generateArtifactUploadUrl', 'completeArtifactUpload', 'getArtifactFileUrl', 'detachFile'];
const internal = new Set(['artifacts:setFileRef', 'artifacts:generateArtifactUploadUrl', 'artifacts:getArtifactFileUrl', 'attachments:generateUploadUrl', 'attachments:getUrl', 'attachments:purgeAll']);
const calls: NativeCall[] = [
  ...Object.entries(artifacts).filter(([name]) => selected.includes(name)).map(([name, registration]) => ({ path: 'artifacts:' + name, registration: registration as unknown as NativeCall['registration'] })),
  ...Object.entries(attachments).map(([name, registration]) => ({ path: 'attachments:' + name, registration: registration as unknown as NativeCall['registration'] })),
];
const opened = calls.filter(call => !internal.has(call.path));
beforeEach(() => installMockRoot()); afterEach(() => { jest.restoreAllMocks(); });
type Validator = { type: string; value?: unknown; tableName?: string };
function sample(v: Validator): unknown {
  switch (v.type) {
    case 'string': return 'same-id'; case 'number': return 1; case 'boolean': return true; case 'null': return null; case 'literal': return v.value;
    case 'array': return [sample(v.value as Validator)]; case 'union': return sample((v.value as Validator[])[0]);
    case 'object': return Object.fromEntries(Object.entries(v.value as Record<string, { fieldType: Validator; optional: boolean }>).filter(([, f]) => !f.optional).map(([k, f]) => [k, sample(f.fieldType)]));
    case 'id': return v.tableName + ':fixture'; case 'any': return {}; default: throw new Error('Unsupported validator ' + v.type);
  }
}
function args(call: NativeCall): Record<string, unknown> {
  const validator = JSON.parse(call.registration.exportArgs()) as Validator; const fields = validator.value as Record<string, unknown>;
  return { ...(sample(validator) as Record<string, unknown>), ...(fields.tenantId ? { tenantId: 'tenant-a' } : {}), ...(fields.memorySpaceId ? { memorySpaceId: 'space-a' } : {}) };
}
it('inventories all 18 current handlers, including new catalog create, with six internal raw-storage aliases', () => {
  expect(calls).toHaveLength(18); expect(opened).toHaveLength(12);
  for (const call of calls) { expect(!!call.registration.isInternal).toBe(internal.has(call.path)); expect(!!call.registration.isPublic).toBe(!internal.has(call.path)); }
  expect(opened.every(call => call.registration.isMutation)).toBe(true);
});
openedAuthorityTests(opened, assetCapability, args);
openedFaultTests(opened, args);
for (const call of opened) describe(call.path, () => {
  it('uses the current catalog and produces its protected outcome without raw-storage delivery', async () => {
    const { f, args, asset, name, module } = await assetCase(call); const before = f.db.writes;
    assertCurrentArgs(call, args);
    const result = await f.call(call.registration, args);
    if (module === 'artifacts') {
      expect(result).toMatchObject({ success: true, artifactId: 'artifact-a', version: expect.any(Number) });
      const row = f.db.table('artifacts')[0];
      if (name === 'detachFile') { expect(row.fileRef).toBeUndefined(); expect(result).toMatchObject({ fileDeleted: false, retainedHistory: true }); }
      else expect(row.fileRef).toMatchObject({ assetId: asset.assetId, versionId: asset.versionId, size: asset.sizeBytes });
      expect(f.db.writes).toBeGreaterThan(before);
    } else if (['create', 'attach', 'get'].includes(name)) expect(result).toMatchObject({ attachmentId: expect.any(String), tenantId: 'tenant-a', memorySpaceId: 'space-a', asset });
    else if (name === 'list') expect(result).toMatchObject({ attachments: [expect.objectContaining({ attachmentId: 'attachment-a', asset })], total: 1, hasMore: false });
    else if (name === 'count') expect(result).toBe(1);
    else if (name === 'remove') { expect(result).toEqual({ deleted: true, attachmentId: 'attachment-a' }); expect(f.db.table('attachments')[0].tombstonedAt).toBeDefined(); }
    else if (name === 'removeMany') { expect(result).toEqual({ deleted: 1 }); expect(f.db.table('attachments')[0].tombstonedAt).toBeDefined(); }
    else expect(result).toEqual([expect.objectContaining({ attachmentId: 'attachment-a', asset })]);
    expect(f.deleted).toEqual([]); expect(f.stores).toBe(1); expect(f.blobs.size).toBe(1);
    expect(f.db.table('runtimeAssetVersions')).toHaveLength(1);
  });
  it('foreign resource ownership and caller labels cannot be adopted, returned or mutated', async () => {
    const { f, args, name, module } = await assetCase(call);
    if (module === 'artifacts') f.db.table('artifacts')[0].ownerPrincipalId = 'foreign-principal';
    else if (['create', 'attach'].includes(name)) {
      if (name === 'attach') args.userId = 'forged-owner-label';
      else { f.db.table('runtimeAssetVersions')[0].ownerPrincipalId = 'foreign-principal'; f.db.table('runtimeAssetReferences').forEach(row => { row.ownerPrincipalId = 'foreign-principal'; }); }
    } else f.db.table('attachments')[0].ownerPrincipalId = 'foreign-principal';
    const before = f.db.writes;
    if (['list', 'count', 'getByConversation', 'getByMessage'].includes(name) && module === 'attachments') {
      const result = await f.call(call.registration, args);
      if (name === 'count') expect(result).toBe(0);
      else if (name === 'list') expect(result).toEqual({ attachments: [], total: 0, hasMore: false });
      else expect(result).toEqual([]);
    } else await expect(f.call(call.registration, args)).rejects.toMatchObject({ data: { code: 'FORBIDDEN' } });
    expect(f.db.writes).toBe(before); expect(f.deleted).toEqual([]); expect(f.stores).toBe(1);
  });
  it('derives a unique omitted trusted scope and denies ambiguous space or ambiguous tenant-wide authority with no effects', async () => {
    const { f, args } = await assetCase(call); delete args.tenantId;
    const fields = (JSON.parse(call.registration.exportArgs()) as { value: Record<string, { optional: boolean }> }).value;
    if (fields.memorySpaceId.optional) delete args.memorySpaceId;
    assertCurrentArgs(call, args);
    await f.call(call.registration, args);
    const before = f.db.writes; const storage = f.deleted.length;
    const membership = f.db.seed('runtimeAuthMemberships', { ...f.membership, _id: 'runtimeAuthMemberships:ambiguous', tenantId: 'tenant-b' });
    f.db.seed('runtimeAuthScopes', { tenantId: 'tenant-b', epoch: 1 });
    f.db.seed('runtimeAuthScopes', { tenantId: 'tenant-b', memorySpaceId: 'space-a', epoch: 1 });
    f.db.seed('runtimeAuthGrants', { ...f.grant, _id: 'runtimeAuthGrants:ambiguous', membershipId: membership._id, tenantId: 'tenant-b' });
    await expect(f.call(call.registration, args)).rejects.toMatchObject({ data: { code: 'FORBIDDEN' } });
    expect(f.db.writes).toBe(before); expect(f.deleted).toHaveLength(storage);
    const tenant = fixture(['storage:read', 'storage:write', 'read', 'write'], true);
    const otherMembership = tenant.db.seed('runtimeAuthMemberships', { ...tenant.membership, _id: 'runtimeAuthMemberships:other-tenant', tenantId: 'tenant-b' });
    tenant.db.seed('runtimeAuthScopes', { tenantId: 'tenant-b', epoch: 1 }); tenant.db.seed('runtimeAuthScopes', { tenantId: 'tenant-b', memorySpaceId: 'space-a', epoch: 1 });
    tenant.db.seed('runtimeAuthGrants', { ...tenant.grant, _id: 'runtimeAuthGrants:other-tenant', membershipId: otherMembership._id, tenantId: 'tenant-b' });
    await expect(Promise.resolve().then(() => invoke(call.registration, tenant.ctx, args))).rejects.toMatchObject({ data: { code: 'FORBIDDEN' } }); expect(tenant.db.writes).toBe(0);
  });
  it.each(['grant', 'principal', 'scope', 'membership', 'expiry', 'tombstone'])('late %s fence rejects before a protected result or effect', async variant => {
    const { f, args } = await assetCase(call); const before = f.db.writes;
    const get = f.db.get.bind(f.db); let hit = false;
    // The asset fixture deliberately freezes its installed get seam. A context
    // adapter injects at the actual pinned read without changing that fixture.
    const adapter = Object.create(f.db) as typeof f.db;
    Object.defineProperty(adapter, 'get', { value: async (table: string, id: string) => {
      if (!hit && table === 'runtimeAuthPrincipals') {
        hit = true;
        if (variant === 'grant') f.grant.version = 2;
        if (variant === 'principal') f.principal.version = 2;
        if (variant === 'scope') f.db.table('runtimeAuthScopes')[1].epoch = 2;
        if (variant === 'membership') f.membership.version = 2;
        if (variant === 'expiry') f.grant.expiresAt = Date.now();
        if (variant === 'tombstone') f.db.seed('runtimeAuthTombstones', { tenantId: 'tenant-a', memorySpaceId: 'space-a', resourceType: 'memorySpace', resourceId: 'space-a', deletedAt: 1 });
      }
      return await get(table, id);
    } });
    f.ctx.db = adapter as unknown as typeof f.ctx.db;
    await expect(f.call(call.registration, args)).rejects.toMatchObject({ data: { code: 'FORBIDDEN' } }); expect(hit).toBe(true);
    expect(f.db.writes).toBe(before); expect(f.deleted).toEqual([]); expect(f.stores).toBe(1);
  });
});
for (const call of calls.filter(call => internal.has(call.path))) it(`${call.path} remains uniformly fail closed before every legacy effect`, async () => {
  const f = fixture([]); const attempts: string[] = []; f.ctx.auth.getUserIdentity = async () => { attempts.push('identity'); throw new Error('PRIVATE'); };
  f.db.beforeRead = table => { attempts.push(table); throw new Error('PRIVATE'); }; f.db.beforeWrite = table => { attempts.push(table); throw new Error('EFFECT'); };
  const code = call.path.startsWith('attachments:') ? 'PRIVATE_ASSET_HTTP_REQUIRED' : 'CAPABILITY_UNAVAILABLE';
  const error = await Promise.resolve().then(() => invoke(call.registration, f.ctx, args(call))).then(() => undefined, (failure: unknown) => failure);
  expect(error).toBeInstanceOf(ConvexError); expect((error as ConvexError<Value>).data).toMatchObject({ version: 1, code, retryable: false, outcome: 'not_dispatched' });
  expect(attempts).toEqual([]); expect(f.db.writes).toBe(0);
});
it('unavailable adapters still reject; historical assets and original 17 registrations remain unchanged in their archive', async () => {
  const f = fixture(['storage:read']);
  await expect(runtimeAssetUnavailable(f.ctx, 'storage:read', { tenantId: 'tenant-a', memorySpaceId: 'space-a' })).rejects.toMatchObject({ data: { code: 'CAPABILITY_UNAVAILABLE' } });
  await expect(internalAssetUnavailable()).rejects.toMatchObject({ data: { code: 'CAPABILITY_UNAVAILABLE' } });
  const qa = '_goals/convex-backend-runtime-2026-10-02/qa/task03b2f-asset-foundation/original/';
  expect(JSON.parse(fs.readFileSync(qa + 'native-validators17.json', 'utf8')).registrations).toHaveLength(17);
  const hashes = JSON.parse(fs.readFileSync(qa + 'source-hashes.json', 'utf8')) as Record<string, string>;
  for (const file of ['artifacts.ts', 'attachments.ts']) expect(crypto.createHash('sha256').update(fs.readFileSync(qa + file)).digest('hex')).toBe(hashes['convex-dev/' + file]);
});
