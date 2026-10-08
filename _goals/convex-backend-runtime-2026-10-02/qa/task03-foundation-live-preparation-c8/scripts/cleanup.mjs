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
let complete=false,status='FAIL';const start=Date.now();
try{for(const file of ledger.files)await client.mutation(makeFunctionReference('qualificationOwned:cleanupStorage'),{run,...file});
 for(let attempt=0;attempt<2;attempt++){await client.mutation(makeFunctionReference('qualificationOwned:cleanup'),{run,refs:ledger.refs});const rows=await client.query(makeFunctionReference('qualificationOwned:snapshot'),{run,refs:ledger.refs});if(rows.every(row=>row.row===null)){complete=true;break;}}if(complete)status='PASS';}
catch{status='FAIL';}
appendRedactedReceipt('cleanup-'+randomUUID()+'.json',{phase:'owned-cleanup',status,cleanupComplete:complete,counts:{trackedRows:ledger.refs.length,storageFiles:ledger.files.length},elapsedMs:Date.now()-start});
process.stdout.write(JSON.stringify({status,cleanupComplete:complete})+'\n');process.exitCode=complete?0:1;
