/** Owned process boundary: terminal group reaping is mandatory, including crashes. */
import { resolve } from 'node:path';
import { readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { livePreflight, repo, scratch, preparation, appendRedactedReceipt, verifyCodegen, safeProcessFailure } from './guard.mjs';
import { ProcessOwner } from './process-owner.mjs';
const {values,target}=livePreflight();const codegen=verifyCodegen(target);
const runtime={};for(const name of ['HTTPS_PROXY','HTTP_PROXY','NO_PROXY','https_proxy','http_proxy','no_proxy','NODE_EXTRA_CA_CERTS'])if(process.env[name])runtime[name]=process.env[name];
const env={PATH:process.env.PATH,LANG:'C.UTF-8',CI:'1',NO_COLOR:'1',NODE_USE_ENV_PROXY:'1',...runtime,...values,CORTEX_FOUNDATION_TARGET_RECEIPT:resolve(scratch,'target.json'),CORTEX_FOUNDATION_DEPLOY_ENV:resolve(scratch,'deploy.env'),CORTEX_FOUNDATION_CODEGEN_RECEIPT:codegen};
const owner=new ProcessOwner();let status='FAIL',cleanupComplete=false,cleanupRecoveryVerified=0,childExit=-1;const start=Date.now(),startedAt=new Date().toISOString(),argv=[process.execPath,resolve(preparation,'scripts/qualify.mjs')];let failureClass='unknown_infrastructure';
try{const result=await owner.run([resolve(preparation,'scripts/qualify.mjs')],{cwd:repo,env},1260000);
 childExit=result.code??-1;failureClass=safeProcessFailure(result);
 if(result.code===0&&!result.timedOut&&!result.overflow){const safe=JSON.parse(result.stdout.trim());if(safe.status==='PASS'&&safe.cleanupComplete===true){status='PASS';cleanupComplete=true;}}
 if(status!=='PASS'){
  // Qualified cleanup recovery can reduce residue; it cannot turn failed qualification into PASS.
  const owned=readdirSync(scratch).filter(name=>/^owned-foundation-[a-f0-9]{32}\.json$/.test(name));if(owned.length>1)throw new Error('More than one owned run ledger');
  if(owned.length===1){const run=owned[0].slice(6,-5);const clean=await owner.run([resolve(preparation,'scripts/cleanup.mjs'),run],{cwd:repo,env},60000);cleanupRecoveryVerified=clean.code===0&&!clean.timedOut&&!clean.overflow?1:0;}
 }
}catch{status='FAIL';}finally{await owner.reapAll();if(owner.records.size!==0)status='FAIL';}
appendRedactedReceipt('driver-'+randomUUID()+'.json',{phase:'owned-current-foundation-driver',startedAt,observedAt:new Date().toISOString(),argv,exitCode:childExit,failureClass,status,cleanupComplete,elapsedMs:Date.now()-start,counts:{cleanupRecoveryVerified,childExitCodeNonnegative:childExit<0?255:childExit,processesSpawned:owner.spawned,remainingOwnedGroups:owner.records.size,verifiedTerminalGroups:owner.verifiedGroups}});
process.stdout.write(JSON.stringify({status,cleanupComplete,physicalRetirement:'REQUIRED_COORDINATOR_FINAL_FENCE'})+'\n');process.exitCode=status==='PASS'?0:1;
