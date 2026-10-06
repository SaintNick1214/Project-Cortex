/** Crash-recovery cleanup: existing private ownership ledger, no signing or guessed IDs. */
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { livePreflight, scratch, canonical, appendRedactedReceipt } from './guard.mjs';
const run=process.argv[2];if(!/^foundation-[a-f0-9]{32}$/.test(run??''))throw new Error('Exact owned run required');
const {target,values}=livePreflight();const ledger=JSON.parse(readFileSync(canonical(resolve(scratch,'owned-'+run+'.json'),scratch,true)));
if(ledger.run!==run||!Array.isArray(ledger.refs)||ledger.refs.length>320||ledger.files.length>2)throw new Error('Owned ledger rejected');
const client=new ConvexHttpClient(target.deploymentUrl,{logger:false,fetch:(url,options)=>{if(new URL(url).origin!==target.deploymentUrl)throw new Error('Origin rejected');return globalThis.fetch(url,{...options,signal:AbortSignal.timeout(12000)});}});client.setAdminAuth(values.CONVEX_DEPLOY_KEY);
let complete,status;const start=Date.now();
try{for(const file of ledger.files){const storage=await client.mutation(makeFunctionReference('qualificationOwned:cleanupStorage'),{run,...file});if(storage===null||typeof storage!=='object'||typeof storage.deleted!=='boolean')throw new Error('Storage cleanup not verified');}
 let rowsComplete=false;
 for(let attempt=0;attempt<2;attempt++){await client.mutation(makeFunctionReference('qualificationOwned:cleanup'),{run,refs:ledger.refs});const rows=await client.query(makeFunctionReference('qualificationOwned:snapshot'),{run,refs:ledger.refs});if(Array.isArray(rows)&&rows.length===ledger.refs.length&&rows.every((row,index)=>row.table===ledger.refs[index].table&&row.id===ledger.refs[index].id&&row.row===null)){rowsComplete=true;break;}}
 if(!rowsComplete)throw new Error('Owned row cleanup not verified');
 // The conserved helper's idempotent false result requires absent catalog AND native storage metadata.
 for(const file of ledger.files){const storage=await client.mutation(makeFunctionReference('qualificationOwned:cleanupStorage'),{run,...file});if(storage?.deleted!==false)throw new Error('Owned storage absence not verified');}
 const policy=await client.query(makeFunctionReference('qualificationDelta:policySnapshot'),{run});
 const policyTables=['runtimeModelPolicies','runtimeModelQualifications','runtimeBudgetAccounts','runtimeModelOperations','runtimeModelAttempts'];
 if(!Array.isArray(policy)||policy.length!==policyTables.length||policy.some((row,index)=>row.table!==policyTables[index]||row.count!==0))throw new Error('Policy cleanup not verified');
 // Success is committed only after every owned row/storage and exact policy-table fence.
 complete=true;status='PASS';}
catch{complete=false;status='FAIL';}
appendRedactedReceipt('cleanup-'+randomUUID()+'.json',{phase:'owned-cleanup',status,cleanupComplete:complete,counts:{trackedRows:ledger.refs.length,storageFiles:ledger.files.length},elapsedMs:Date.now()-start});
process.stdout.write(JSON.stringify({status,cleanupComplete:complete})+'\n');process.exitCode=status==='PASS'&&complete===true?0:1;
