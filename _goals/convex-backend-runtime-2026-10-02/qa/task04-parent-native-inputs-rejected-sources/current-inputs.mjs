/** Parent-only finite watcher: no RPC, signing, storage, network or model calls. */
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const candidate=process.argv[2];
assert.match(candidate,/^task04-native-admission-fixture-c[4-9][0-9]*$/);
const base=resolve('_goals/convex-backend-runtime-2026-10-02/qa',candidate);
const guard=await import(pathToFileURL(resolve(base,'scripts/guard.mjs')).href);
const generator=await import(pathToFileURL(resolve(base,'scripts/arguments.mjs')).href);
const {scratch,root,json,exclusive,sha256,livePreflight,canonical}=guard;
const {target}=livePreflight('synthetic');
const history=json(resolve(scratch,'historical-native-locators.json'),scratch,true);
assert.equal(history.operation,target.operation);assert.equal(history.runId,target.runId);
const ids={...history.ids},receipts={};
const deadline=Date.now()+120000;
while(!ids.runtimeModelOperations||!ids.runtimeModelAttempts){
  if(Date.now()>deadline)throw Error('CURRENT_NATIVE_ID_OWNERSHIP_NOT_OBSERVED');
  livePreflight('synthetic');
  for(const name of readdirSync(scratch).filter(n=>/^owned-created-[a-f0-9]{64}\.json$/.test(n))){
    const path=resolve(scratch,name),bytes=readFileSync(canonical(path,scratch,true));
    if(!bytes.toString().endsWith('\n'))continue;
    const row=JSON.parse(bytes);
    assert.equal(row.operation,target.operation);assert.equal(row.kind,'created');
    if(['runtimeModelOperations','runtimeModelAttempts'].includes(row.table)&&!ids[row.table]){
      assert.equal(name,'owned-created-'+sha256(row.table+':'+row.id)+'.json');
      ids[row.table]=row.id;receipts[row.table]={path,sha256:sha256(bytes),locatorSHA256:sha256(row.id),bytes:bytes.length};
    }
  }
  if(!ids.runtimeModelOperations||!ids.runtimeModelAttempts)await new Promise(r=>setTimeout(r,100));
}
const scope={operation:target.operation,runId:target.runId,tenantId:target.runId+'-security-owner',memorySpaceId:target.runId+'-security-owner-space',ids,storageCreated:0,nativeIdShapeVerified:true};
const proof={operation:target.operation,runId:target.runId,observedAt:new Date().toISOString(),status:'SOURCE_BOUND_NATIVE_ISSUANCE_PROVENANCE',historicalProvenanceSHA256:sha256(readFileSync(resolve(scratch,'initial-physical-id-provenance.json'))),currentCoreOwnership:receipts,scopeSHA256:sha256(JSON.stringify(scope)),storageCreated:0,currentPublicStorageDecoding:'NOT_RUN; requires actual handler auth denial on the two existing noJWT sweep observations',extraRPC:0,extraRows:0};
exclusive(resolve(scratch,'current-physical-id-input-receipt.json'),proof);
exclusive(resolve(scratch,'argument-scope.json'),scope);
const inventory=json(resolve(root,'registration-inventory.json')),publicArgs={},internalArgs={};
for(const row of inventory.registrations)(row.visibility==='public'?publicArgs:internalArgs)[row.path]=generator.argumentsFor(row,scope);
exclusive(resolve(scratch,'public-arguments.json'),{operation:target.operation,inventorySha256:sha256(readFileSync(resolve(root,'registration-inventory.json'))),arguments:publicArgs,internalArguments:internalArgs,modelAttemptId:ids.runtimeModelAttempts});
process.stdout.write(JSON.stringify({status:'PASS_SOURCE_BOUND_INPUTS',extraRPC:0,extraRows:0,storageCreated:0,currentCoreIDTables:Object.keys(receipts),currentPublicStorageDecoding:'NOT_RUN'})+'\n');
