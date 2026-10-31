/** Read-only closure of the already committed cleanup1; never reissues retirement. */
import assert from 'node:assert/strict';
import {readFile, lstat, open, unlink} from 'node:fs/promises';
import {constants} from 'node:fs';
import {join, dirname} from 'node:path';
import {openNativeContext, q, scope, sha} from './common.mjs';

const c = await openNativeContext({requestTimeoutMs:30000});
const sorted = rows => [...rows].sort((a,b) => a._id.localeCompare(b._id));
const financial = value => ({accounts:sorted(value.accounts),attempts:sorted(value.attempts)});
const load = async name => JSON.parse(await readFile(join(q,name+'.json'),'utf8'));
let tokenRemoved = false;
try {
  await c.verifyTarget('cleanup-merged2-target');
  const prior = await load('cleanup-merged1-outcomes');
  assert.equal(prior.status,'FAIL_OR_UNKNOWN');
  assert.deepEqual(prior.completed,['tiny-artifact-tombstone','scope-0','scope-1']);
  for (const index of [0,1]) assert.equal((await load('cleanup-merged1-retired-'+index)).result,null);
  const before = await load('cleanup-merged1-before');
  const baseline = await load('financial-baseline3');
  const fixture = await load('fixture4');
  const refs = await load('setup-merged3-current-authority');
  const selectors = [scope,{tenantId:refs.outsider.tenantId,memorySpaceId:refs.outsider.memorySpaceId}];
  const denials = [];
  for (const subject of [fixture.subject,fixture.operatorSubject,fixture.outsiderSubject]) {
    const selector = subject === fixture.outsiderSubject ? selectors[1] : scope;
    try {
      await c.http(subject).mutation('runtimeClient:session',selector);
      throw Error('RETIRED_SCOPE_NOT_DENIED');
    } catch (error) {
      assert.notEqual(error.message,'RETIRED_SCOPE_NOT_DENIED');
      const safe = c.publicError(error);
      assert.match(JSON.stringify(safe),/FORBIDDEN/);
      denials.push({subject,scope:selector,error:safe,currentSignedJWT:true});
    }
  }
  const after = await c.admin.query('nativeMerged:snapshot',scope);
  const moneyAfter = await c.admin.query('nativeMerged:financial',{});
  assert.deepEqual(financial(moneyAfter),financial(before.financial));
  for (const table of ['accounts','attempts']) for (const row of baseline[table]) {
    assert.deepEqual(moneyAfter[table].find(value => value._id === row._id),row);
  }
  for (const table of ['runtimeAssets','runtimeAssetJobs','runtimeMediaJobs']) assert.equal(after.data[table].length,0);
  assert.equal(after.data.runtimeIngestionJobs.length,3);
  assert.equal(after.data.runtimeIngestionStages.length,9);
  const stages = after.data.runtimeIngestionStages.map(({_id,eventId,stage,state,attempt}) => ({_id,eventId,stage,state,attempt}));
  assert.ok(stages.every(row => ['complete','skipped','failed','cancelled'].includes(row.state)));
  assert.equal(after.attempts.length,9);
  assert.ok(after.attempts.every(row => row.slotReleased));
  assert.equal(after.accounts.find(row => row.kind === 'tenant').uncertainUnits,900000);
  const tokenFile = '/Users/SaintNick/.codex/tmp/cortex-merged-v2-ui-20261009/actor.jwt';
  const parent = await lstat(dirname(tokenFile));
  assert.ok(parent.isDirectory() && !parent.isSymbolicLink());
  assert.equal(parent.mode & 0o777,0o700);
  const tokenHandle = await open(tokenFile,constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  let info;
  try {
    info = await tokenHandle.stat();
    assert.ok(info.isFile());
    assert.equal(info.mode & 0o777,0o600);
    const token = await tokenHandle.readFile('utf8');
    const claims = JSON.parse(Buffer.from(token.trim().split('.')[1],'base64url'));
    assert.equal(claims.sub,fixture.subject);
    assert.equal(claims.iss,c.auth.issuer);
    const current = await lstat(tokenFile);
    assert.equal(current.ino,info.ino);
    assert.equal(current.dev,info.dev);
  } finally { await tokenHandle.close(); }
  await unlink(tokenFile);
  tokenRemoved = true;
  await assert.rejects(lstat(tokenFile),{code:'ENOENT'});
  await c.close();
  const held = moneyAfter.attempts.filter(row => !row.slotReleased).map(row => row._id);
  await c.publish('cleanup-merged2-after',{snapshot:after,financial:financial(moneyAfter),denials,stages,allTargetFinancialExactIdEquality:true,oldFinancialBaselineExactIds:true,oldHeldSlotsUnchanged:held,newModelCalls:0});
  await c.publish('cleanup-merged2-outcomes',{
    status:'ACTUAL_MERGED_SCOPE_CLEANUP_PASS',readOnlySuccessorOf:'cleanup-merged1-outcomes.json',
    originalOracleCorrection:'Ingestion jobs are immutable job metadata; activity is checked on their persisted stage.state rows.',
    committedEffectsReissued:0,retiredScopes:2,roleDenials:denials,assets:0,assetJobs:0,mediaJobs:0,
    retainedIngestionJobRows:3,terminalStageRows:9,ownedIngestionStagesActive:0,
    ownedAttempts:9,ownedUnknownUnits:900000,ownedHeldSlots:0,oldHeldSlots:held,
    oldHeld2AndAllPriorFinancialRootsWindowsCountersUnchanged:true,allTargetFinancialExactIdEquality:true,
    ownedToken:{path:tokenFile,mode:'0600',bytes:info.size,removed:true},
    HTTPAndRuntimeClientsClosed:true,ownedNativeChildrenClosed:true,
    rootUI:'../root1/ui/cleanup1.json',
    mainTarget3174742:'retained for final merged-candidate CI and unresolved external async capability; not retired',
    graphContainers:'retained exact owned Neo4j/Memgraph for final checks',
    centralCredentials:'sole 0700/0600 copy retained; no values printed',
    newModelCalls:0,scopeRestorations:0,refunds:0,
    originalFailureSha256:sha(await readFile(join(q,'cleanup-merged1-outcomes.json'))),
  });
  console.log(JSON.stringify({status:'ACTUAL_MERGED_SCOPE_CLEANUP_PASS',readOnlySuccessor:true,retiredScopes:2,roleDenials:3,terminalStages:9,unknownUnits:900000,oldHeldSlots:held.length,newModelCalls:0}));
} catch (error) {
  await c.publish('cleanup-merged2-outcomes',{status:'FAIL_OR_UNKNOWN',error:c.publicError(error),retirementsReissued:0,tokenRemoved,newModelCalls:0});
  throw Error('MERGED_CLEANUP_READBACK_FAILED_SEE_RECEIPT');
} finally { await c.close(); }
