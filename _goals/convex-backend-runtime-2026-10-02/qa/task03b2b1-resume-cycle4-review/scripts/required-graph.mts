import assert from 'node:assert/strict';
import { fixture, invoke, seedSpace, seedContext } from '/workspace/Project-Cortex/work/resume/registry/candidate/tests/unit/runtimeRegistryAuth/fixture.ts';
import * as contexts from '/workspace/Project-Cortex/work/resume/registry/candidate/convex-dev/contexts.ts';
import { snapshot } from '/workspace/Project-Cortex/work/resume/registry/candidate/convex-dev/runtimeRegistryAuth.ts';
const scope = { tenantId: 'tenant-a', memorySpaceId: 'space-a' };
const results = [];
for (const count of [99, 100]) for (const read of [false, true]) {
  const f = fixture(read ? ['read', 'write'] : ['write']); seedSpace(f);
  for (let index = 0; index < count; index++) seedContext(f, { contextId: `node-${index}`, rootId: 'node-0', parentId: index ? `node-${index-1}` : undefined,
    depth: index, childIds: index === count - 1 ? [] : [`node-${index+1}`] });
  const before = snapshot(f.db.table('contexts')); let attempts = 0; f.db.beforeWrite = () => { attempts++; };
  let created; let error;
  try { created = await f.db.transaction(() => invoke<Record<string, unknown>>(contexts.create, f.ctx, { ...scope, purpose: 'Boundary', parentId: `node-${count-1}` })); }
  catch (caught) { error = caught; }
  if (count === 100) {
    assert.equal(error.data.code, 'INVALID_INPUT'); assert.equal(error.data.outcome, 'not_dispatched'); assert.equal(attempts, 0);
    assert.equal(f.db.writes, 0); assert.equal(snapshot(f.db.table('contexts')), before);
    results.push({ count, read, code: error.data.code, outcome: error.data.outcome, attempts, committedWrites: f.db.writes, persistedNodes: f.db.table('contexts').length });
  } else {
    assert(!error); assert.equal(attempts, 2); assert.equal(f.db.table('contexts').length, 100);
    if (!read) { assert.equal(created.accepted, true); f.grant.capabilities = ['read', 'write']; }
    const chain = await invoke<Record<string, unknown>>(contexts.getChain, f.ctx, { ...scope, contextId: read ? created.contextId : created.resourceId });
    assert.equal(chain.totalNodes, 100); assert.equal(chain.depth, 99);
    results.push({ count, read, created, attempts, committedWrites: f.db.writes, readableTotalNodes: chain.totalNodes, readableDepth: chain.depth });
  }
}
console.log(JSON.stringify({ cases: results.length, results }, null, 2));
