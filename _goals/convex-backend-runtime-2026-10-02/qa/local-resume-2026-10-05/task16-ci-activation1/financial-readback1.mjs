/** Read-only durable CI ledger audit; secret/body fields never persist in public output. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
const run=promisify(execFile),r='/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion',q=join(r,'_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task16-ci-activation1'),priv='/Users/SaintNick/.codex/tmp/cortex-task16-ci-native-5b5ba39cd23b';
const json=async path=>JSON.parse(await readFile(path,'utf8')),save=async(name,value)=>writeFile(join(q,name+'.json'),JSON.stringify(value,null,2)+'\n',{flag:'wx'}),hash=value=>createHash('sha256').update(value).digest('hex');
const pick=(row,keys)=>Object.fromEntries(keys.filter(key=>row[key]!==undefined).map(key=>[key,row[key]]));
const accountKeys=['_id','tenantId','runBudgetId','kind','windowId','windowStart','windowEnd','limitUnits','reservedUnits','settledUnits','uncertainUnits','activeConcurrency','concurrencyLimit','overrun','current','cancelled','version'];
const operationKeys=['_id','operationId','tenantId','memorySpaceId','semanticId','operationKey','runAccountId','parentOperationId','source','reservedUnits','settledUnits','uncertainUnits','cancelled'];
const attemptKeys=['_id','operationDocumentId','childCallId','ordinal','attemptNumber','tenantAccountId','runAccountId','reservationUnits','state','dispatchIdentity','checkpointAt','slotReleased','actualModel','resultWithheld','resultAttachmentState','failureCode'];
const project=(table,row)=>table==='runtimeBudgetAccounts'?{...pick(row,accountKeys),...row.root?{root:pick(row.root,['manifestId','revision','hash'])}:{}}:table==='runtimeModelOperations'?pick(row,operationKeys):pick(row,attemptKeys);
const baseline=await json(join(q,'financial-preflight2.json'));const targets=[];
for(const kind of ['sdk','cli']){
 const credential=await json(join(priv,kind+'-credentials.json')),before=baseline.targets.find(t=>t.kind===kind);assert.equal(credential.projectId,before.projectId);assert.equal(credential.deploymentName,before.deploymentName);
 const env={PATH:process.env.PATH,HOME:process.env.HOME,CI:'true',CONVEX_URL:credential.url,CONVEX_DEPLOY_KEY:credential.deployKey,CONVEX_DEPLOYMENT:'dev:'+credential.deploymentName};
 const tables={};
 for(const table of ['runtimeBudgetAccounts','runtimeModelOperations','runtimeModelAttempts']){
  const start=Date.now();let result;
  try{result=await run(process.execPath,[join(r,'node_modules/convex/bin/main.js'),'data',table,'--limit','500','--format','jsonArray'],{cwd:r,env,timeout:60000,maxBuffer:8*1024*1024});}catch{throw Error('READONLY_LEDGER_COMMAND_FAILED:'+kind+':'+table);}
  const rows=JSON.parse(result.stdout);assert.ok(Array.isArray(rows)&&rows.length<500,'Bounded table read incomplete');
  const projected=rows.map(row=>project(table,row));tables[table]=projected;
  await save(kind+'-ledger-readback1-'+table+'-command',{kind,table,code:0,elapsedMs:Date.now()-start,rows:rows.length,rawPrivateBodiesPrinted:false,managementMutations:0});
  for(const old of before.tables[table]){const row=projected.find(row=>row._id===old._id);assert.deepEqual(row,old,'Historical financial/provenance row changed:'+table+':'+old._id);}
 }
 const currentTenant='cortex-ci-37891412235-1-'+kind;const newAccounts=tables.runtimeBudgetAccounts.filter(x=>x.tenantId===currentTenant),newOps=tables.runtimeModelOperations.filter(x=>x.tenantId===currentTenant),opIds=new Set(newOps.map(x=>x._id)),newAttempts=tables.runtimeModelAttempts.filter(x=>opIds.has(x.operationDocumentId));
 targets.push({kind,projectId:credential.projectId,deploymentName:credential.deploymentName,checkedAt:new Date().toISOString(),oldRowsExactIdEquality:true,oldRowsCompared:Object.fromEntries(Object.entries(before.tables).map(([key,value])=>[key,value.length])),tables,current:{tenantId:currentTenant,accounts:newAccounts.length,operations:newOps.length,attempts:newAttempts.length,operationKeyCounts:Object.fromEntries([...new Set(newOps.map(x=>x.operationKey))].map(key=>[key,newOps.filter(x=>x.operationKey===key).length])),tenantAccounts:newAccounts.filter(x=>x.kind==='tenant'),slotsReleased:newAttempts.filter(x=>x.slotReleased===true).length,heldSlots:newAttempts.filter(x=>x.slotReleased!==true).length}});
}
const result={status:'READONLY_CURRENT_CI_FINANCIAL_AUDIT',workflowRunId:37891412235,headSha:'171a1574aa7ea7ade1bfdf14a644521d36c54473',baselineSha256:hash(await readFile(join(q,'financial-preflight2.json'))),targets,newModelCallsByAudit:0,authorityRestoration:0,refunds:0};
await save('financial-readback1',result);console.log(JSON.stringify({status:result.status,targets:targets.map(({kind,current,oldRowsExactIdEquality})=>({kind,current,oldRowsExactIdEquality})),readOnly:true}));
