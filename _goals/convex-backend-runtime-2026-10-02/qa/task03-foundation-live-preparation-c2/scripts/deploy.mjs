import { resolve } from 'node:path';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { livePreflight, fixture, repo, scratch, appendRedactedReceipt, sha256, safeProcessFailure } from './guard.mjs';
import { ProcessOwner } from './process-owner.mjs';
const mode=process.argv[2];if(!['deploy','codegen'].includes(mode))throw new Error('Select deploy or codegen');
const {values,target}=livePreflight();const owner=new ProcessOwner();let status='FAIL';const start=Date.now(),startedAt=new Date().toISOString();let failureClass='unknown_infrastructure',exitCode=-1;
const runtime={};for(const name of ['HTTPS_PROXY','HTTP_PROXY','NO_PROXY','https_proxy','http_proxy','no_proxy','NODE_EXTRA_CA_CERTS'])if(process.env[name])runtime[name]=process.env[name];
try{const result=await owner.run([resolve(repo,'node_modules/convex/bin/main.js'),'dev','--once','--codegen','enable','--typecheck','enable','--tail-logs','disable','--env-file',resolve(scratch,'deploy.env')],{cwd:resolve(fixture,'fixture'),env:{PATH:process.env.PATH,LANG:'C.UTF-8',CI:'1',NO_COLOR:'1',NODE_USE_ENV_PROXY:'1',...runtime,...values}},120000);writeFileSync(resolve(scratch,'private-cli-diagnostics-'+randomUUID()+'.json'),JSON.stringify({phase:mode,startedAt,observedAt:new Date().toISOString(),exitCode:result.code,stdout:result.stdout,stderr:result.stderr,privateMayContainSensitiveDiagnostics:true},null,2)+'\n',{flag:'wx',mode:0o600});exitCode=result.code??-1;failureClass=safeProcessFailure(result);if(result.code===0&&!result.timedOut&&!result.overflow)status='PASS';}
catch{status='FAIL';}
finally{await owner.reapAll();if(owner.records.size!==0)status='FAIL';}
if(status==='PASS'){const dir=resolve(fixture,'fixture/convex/_generated');const files=readdirSync(dir).filter(name=>!name.startsWith('.')).map(name=>({path:'fixture/convex/_generated/'+name,sha256:sha256(readFileSync(resolve(dir,name)))}));
 writeFileSync(resolve(scratch,'codegen-'+randomUUID()+'.json'),JSON.stringify({operation:target.operation,officialCodegen:true,typecheck:'enable',status:'PASS',files},null,2)+'\n',{flag:'wx',mode:0o600});}
appendRedactedReceipt(mode+'-'+randomUUID()+'.json',{phase:mode,startedAt,observedAt:new Date().toISOString(),argv:[process.execPath,resolve(repo,'node_modules/convex/bin/main.js'),'dev','--once','--codegen','enable','--typecheck','enable','--tail-logs','disable','--env-file',resolve(scratch,'deploy.env')],exitCode,failureClass,status,counts:{ownedGroupsRemaining:owner.records.size,verifiedTerminalGroups:owner.verifiedGroups},elapsedMs:Date.now()-start});
process.stdout.write(JSON.stringify({phase:mode,status})+'\n');process.exitCode=status==='PASS'?0:1;
