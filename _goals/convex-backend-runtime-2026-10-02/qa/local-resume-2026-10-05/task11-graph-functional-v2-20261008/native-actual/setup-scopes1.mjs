/** Invoke after the coherent Task11 candidate is installed. New scopes only; no inference. */
import assert from 'node:assert/strict';
import {access} from 'node:fs/promises';
import {join} from 'node:path';
import {openOwnedContext, authorityReference, q} from './common.mjs';

const context = await openOwnedContext();
const actors = [];
try {
  let closed = true;
  try {await access(join(q, 'setup-scopes1.json'));} catch (error) {if (error.code === 'ENOENT') closed = false; else throw error;}
  assert.equal(closed, false, 'Do not repeat a closed setup phase');
  await context.verifyTarget('setup-scopes1-target-verified');
  const expiresAt = Date.now() + 7200000;
  const provision = async (name, subject, scope, actorKind, capabilities, resourceAccess = 'space') => {
    const authority = await context.admin.mutation('runtimeAuth:provision', {
      issuer: context.auth.issuer, subject, actorKind, ...scope,
      capabilities, resourceAccess, expiresAt,
    });
    const actor = {name, subject, scope, reference: authorityReference(authority), actorKind, capabilities, resourceAccess};
    actors.push(actor); await context.publish('setup-scopes1-' + name, actor); return actor;
  };
  const data = await provision('owner', context.fixture.ownerSubject,
    {tenantId: context.tenantId, memorySpaceId: context.memorySpaceId}, 'user', ['read', 'write', 'admin', 'tool']);
  const ownReader = await provision('own-reader', 'task11-own-reader-' + context.pointer.operation,
    data.scope, 'user', ['read', 'write', 'tool'], 'own');
  const policyAdmin = await provision('policy-admin', 'task11-policy-admin-' + context.pointer.operation,
    {tenantId: context.tenantId}, 'user', ['admin'], 'tenant');
  const controlScope = {tenantId: context.fixture.controlTenantId, memorySpaceId: context.fixture.controlMemorySpaceId};
  const operator = await provision('operator', context.fixture.operatorSubject, controlScope, 'user', ['read', 'write', 'admin']);
  // Current worker RPC contract requires service+admin in the configured control scope,
  // followed by an exact configured principal/connector/data-scope fence.
  const worker = await provision('worker', context.fixture.workerSubject, controlScope, 'service', ['admin']);
  const foreign = await provision('foreign', context.fixture.foreignSubject,
    {tenantId: context.fixture.foreignTenantId, memorySpaceId: context.fixture.foreignMemorySpaceId}, 'user', ['read', 'write', 'admin', 'tool']);
  const spaces = [];
  for (const actor of [data, operator, foreign]) {
    const client = context.http(actor.subject);
    const created = await client.mutation('memorySpaces:register', {
      ...actor.scope, name: 'Task11 owned ' + actor.name + ' space', type: 'project',
    });
    assert.equal(created.tenantId, actor.reference.tenantId);
    assert.equal(created.ownerPrincipalId, actor.reference.principalId);
    spaces.push({name: actor.name, memorySpaceId: created.memorySpaceId, ownerPrincipalId: created.ownerPrincipalId});
  }
  assert.notEqual(worker.reference.tenantId, data.reference.tenantId);
  assert.equal(worker.actorKind, 'service');
  await context.publish('setup-scopes1', {status: 'PASS', projectId: context.state.projectId,
    operation: context.pointer.operation, data, ownReader, policyAdmin, operator, worker, foreign, spaces,
    expiresAt, separateCurrentWorkerControlScope: true, priorTask10ScopesChanged: false, modelCalls: 0,
    credentialsOrJwtPrinted: false, connectorConfigurationPending: true});
  console.log(JSON.stringify({status: 'SCOPES_READY', projectId: context.state.projectId, modelCalls: 0,
    separateCurrentWorkerControlScope: true}));
} catch (error) {
  await context.publish('setup-scopes1-failure', {status: 'FAIL_OR_UNKNOWN', completedActorNames: actors.map(actor => actor.name),
    error: context.publicError(error), noBlindSetupRepeat: true});
  throw error;
} finally {await context.close();}
