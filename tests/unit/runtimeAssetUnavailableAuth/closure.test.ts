import { beforeEach, afterEach, describe, expect, it, jest } from '@jest/globals';
import { ConvexError, v, type Value } from 'convex/values';
import { defineSchema, defineTable } from 'convex/server';
import schema from '../../../convex-dev/schema';
import { fixture, invoke } from '../runtimeRegistryAuth/fixture';
import { runtimeAssetUnavailable, internalAssetUnavailable } from '../../../convex-dev/runtimeAssetUnavailableAuth';
import { artifacts, attachments, assetCase, assetCapability, openedAuthorityTests, openedFaultTests, assertCurrentArgs, installMockRoot, type NativeCall } from '../../helpers/current-closure-fixtures';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { backendSource, canonicalValidator, catalogDeclarations, catalogFixture, historicalRepairSources, repairedHistoricalSources, sha256, verifyHistoricalRepair, withComposedCatalog, type HistoricalModules, type HistoricalRepair } from '../../helpers/backend-catalog';
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
it('maintained current composition preserves every current native table and the unique artifact scope index', async () => {
  await withComposedCatalog((_directory, files) => {
    expect(files['schema.ts'].toString()).toContain('...cortexTablesV1');
    expect(files['_cortex/schema.ts'].toString()).toContain('...runtimePolicyTables');
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

interface AssetHistorical extends HistoricalModules {
  classification: string;
  nativeValidators: { registrations: { path: string; args: { type: string; value: Record<string, unknown> } }[] };
  accepted22: { path: string; declaration: string; sha256: string }[];
}
// Later managed attachment filters are additive; every added field stays explicit.
const scopeAddition = { memorySpaceId: "string" };
const filterAdditions = { cursor: "string", memoryId: "string", artifactId: "string", sortBy: "string", sortOrder: "string" };
const currentArgumentAdditions: Record<string, Record<string, string>> = {
  "artifacts:completeArtifactUpload": scopeAddition, "artifacts:detachFile": scopeAddition,
  "attachments:remove": scopeAddition, "attachments:removeMany": scopeAddition,
  "attachments:get": scopeAddition, "attachments:getUrl": scopeAddition, "attachments:getByIds": scopeAddition,
  "attachments:count": { limit: "number", ...filterAdditions },
  "attachments:getByConversation": { ...scopeAddition, messageId: "string", userId: "string", ...filterAdditions },
  "attachments:getByMessage": { ...scopeAddition, conversationId: "string", userId: "string", type: "attachmentType", limit: "number", ...filterAdditions },
};
function addedNativeValidator(kind: string) {
  return { optional: true, fieldType: kind === "attachmentType"
    ? { type: "union", value: ["image", "audio", "video", "file", "pdf"].map(value => ({ type: "literal", value })) }
    : { type: kind } };
}
it('historical native validators remain immutable and current original handlers preserve their argument fields', () => {
  const frozen = catalogFixture<AssetHistorical>('asset-historical.json');
  expect(frozen.classification).toBe('HISTORICAL_PRE_ASSET_CLOSURE_ONLY');
  expect(frozen.nativeValidators.registrations).toHaveLength(17);
  expect(calls.map(call => call.path)).toEqual(expect.arrayContaining(frozen.nativeValidators.registrations.map(row => row.path)));
  for (const row of frozen.nativeValidators.registrations) {
    const call = calls.find(c => c.path === row.path)!;
    const current = JSON.parse(call.registration.exportArgs()) as { type: string; value: Record<string, unknown> };
    expect(current.type).toBe(row.args.type);
    for (const [field, validator] of Object.entries(row.args.value)) {
      // Current verified scope can be derived when omitted. The original selector
      // type remains literal-identical; only optionality can change for selectors.
      if (row.path === "attachments:list" && ["sortBy", "sortOrder"].includes(field)) {
        // Later managed attachments retain filename/size sorting and check the
        // finite allowed sort names inside listRows before reading asset rows.
        expect(current.value[field]).toEqual({ fieldType: { type: "string" }, optional: true });
        const source = backendSource("attachments");
        expect(source).toContain('!["createdAt", "updatedAt", "size", "filename"].includes(args.sortBy)');
        expect(source).toContain('!["asc", "desc"].includes(args.sortOrder)');
        continue;
      }
      expect(current.value[field]).toEqual(['tenantId', 'memorySpaceId'].includes(field)
        ? { ...(validator as object), optional: (current.value[field] as { optional: boolean }).optional }
        : validator);
    }
    const additions = currentArgumentAdditions[row.path] ?? {};
    expect(Object.keys(current.value).filter(k => !(k in row.args.value)).sort()).toEqual(Object.keys(additions).sort());
    for (const [field, kind] of Object.entries(additions)) expect(current.value[field]).toEqual(addedNativeValidator(kind));
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
  expect(sha256(repaired['convex-dev/artifacts.ts'])).toBe('3252eb473cd80c9fe222a21322cb55e321704635dfd17596c319183fb9bcc2a3');
  expect(catalogDeclarations(backendSource('artifacts')).map(row => row.name)).toContain('attachAsset');
  expect(catalogDeclarations(backendSource('artifacts'))).toHaveLength(28);
  for (const module of ['artifacts', 'attachments']) {
    const before = frozen.originalModules[module];
    const after = catalogDeclarations(backendSource(module));
    expect(after.map(row => row.name).sort()).toEqual([...before.map(row => row.name), ...(module === "artifacts" ? ["attachAsset"] : ["create"]) ].sort());
    for (const original of before) {
      const validators = after.find(row => row.name === original.name)!.validators;
      for (const [field, literal] of Object.entries(original.validators)) {
        if (module === "attachments" && original.name === "list" && ["sortBy", "sortOrder"].includes(field))
          expect(validators[field]).toBe(canonicalValidator("v.optional(v.string())"));
        else if (module === "attachments" && ["list", "count"].includes(original.name) && field === "memorySpaceId")
          expect(validators[field]).toBe(canonicalValidator("v.optional(v.string())"));
        else expect(validators[field]).toBe(canonicalValidator(literal));
      }
      const additions = currentArgumentAdditions[`${module}:${original.name}`] ?? {};
      expect(Object.keys(validators).filter(key => !(key in original.validators)).sort()).toEqual(Object.keys(additions).sort());
      for (const [field, kind] of Object.entries(additions)) expect(validators[field]).toBe(canonicalValidator(kind === "attachmentType" ? "v.optional(attachmentTypeValidator)" : `v.optional(v.${kind}())`));
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
  const historicalDeclarations = catalogDeclarations(repaired['convex-dev/artifacts.ts']);
  expect(historicalDeclarations.map(row => row.name).sort()).toEqual(Object.keys(native.registrations).sort());
  for (const declaration of historicalDeclarations) {
    const captured = native.registrations[declaration.name] as { isInternal?: boolean; isPublic?: boolean };
    const internal = /export const \w+ = internal(?:Mutation|Query|Action)\(/.test(declaration.declaration);
    expect(captured.isInternal === true).toBe(internal);
    expect(captured.isPublic === true).toBe(!internal);
  }

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
