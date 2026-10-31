/** Prospective fresh exact read-only absence verifier. Root owns actual cleanup. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {Q,PROOFS_ROOT,parsePins,readReady,pendingMetadata} from './memory-effort-canonical-native-pins.mjs';
let PINS;
try{PINS=parsePins(process.argv.slice(2));}catch(error){console.log(JSON.stringify({...pendingMetadata(),pinValidation:'PENDING_OR_INVALID'}));process.exitCode=2;}
if(PINS){if(PINS.localPreflight||process.env.CORTEX_MEMORY_EFFORT_CANONICAL_ABSENCE_GO!=='1'){console.log(JSON.stringify({...pendingMetadata(),purpose:'CLEANUP_VERIFIER_PREPARATION_ONLY'}));if(!PINS.localPreflight)process.exitCode=2;}else await verify();}
async function verify(){
const SESSION=PINS.sessionId,SOURCE=PINS.sourceCommit,IMAGE=PINS.imageId;
const out={version:1,status:'UNRUN',sessionId:SESSION,sourceCommit:SOURCE,imageId:IMAGE,modelCalls:0,mutations:0,cleanupActions:0,startedAt:Date.now(),checks:[]},destination=path.join(Q,'memory-effort-canonical-cleanup-'+Date.now()+'.json');
function check(label,value){assert.ok(value,label);out.checks.push(label);}
try{
 check('explicit post-cleanup verifier authorization',process.env.CORTEX_MEMORY_EFFORT_CANONICAL_ABSENCE_GO==='1');
 check('pinned Node and unchanged HOME',process.version==='v24.15.0'&&process.env.HOME==='/Users/SaintNick');
 const ready=await readReady(PINS,{allowExpired:true});check('exact accepted metadata',ready.sessionId===SESSION&&ready.sourceCommit===SOURCE&&ready.container.imageId===IMAGE);
 const {loadSession}=await import('/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/sandbox-env/runner.mjs');
 const s=await loadSession(PROOFS_ROOT,SESSION);check('exact cleaned owned session',s.phase==='CLEANED'&&s.ownerUid===process.getuid()&&s.ownerGid===process.getgid()&&s.launcherHost===os.hostname()&&s.launcherPid===PINS.launcherPid&&s.target.id===PINS.targetId&&s.target.name===ready.target.name&&s.target.teamId===325340&&s.target.projectId===3200658&&s.target.reference==='dev/cortex-sandbox-'+SESSION&&s.container.id===ready.container.id&&s.container.imageId===IMAGE);
 let launcherAbsent=false;try{process.kill(PINS.launcherPid,0);}catch(error){if(error.code==='ESRCH')launcherAbsent=true;else throw error;}check('original launcher PID absent',launcherAbsent);out.launcher={pid:PINS.launcherPid,absent:true,directExit:'Root separate launcher receipt required; absence is not a fabricated exit status'};
 const configPath=path.join(os.homedir(),'.convex/config.json'),stat=await fs.lstat(configPath);check('existing owned regular management login',stat.isFile()&&!stat.isSymbolicLink()&&stat.uid===process.getuid());const token=JSON.parse(await fs.readFile(configPath,'utf8')).accessToken;check('management login available without creating credentials',typeof token==='string'&&token.length>0);
 async function get(route){const response=await fetch('https://api.convex.dev/v1'+route,{method:'GET',redirect:'error',signal:AbortSignal.timeout(30000),headers:{Authorization:'Bearer '+token,'Convex-Client':'npm-cli-1.46.0'}});check('fresh management200 '+route,response.status===200);return response.json();}
 const [project,deployments]=await Promise.all([get('/projects/3200658'),get('/projects/3200658/list_deployments')]);check('fresh exact approved project',project.id===3200658&&project.teamId===325340&&project.slug==='cortex-sandboxes');check('fresh exact deployment identity absent',Array.isArray(deployments)&&!deployments.some(row=>row.id===PINS.targetId||row.name===ready.target.name||row.reference==='dev/cortex-sandbox-'+SESSION));out.database={status:'ABSENT',targetId:PINS.targetId,targetName:ready.target.name,reference:'dev/cortex-sandbox-'+SESSION,verifiedAt:Date.now()};
 const docker='/Applications/Docker.app/Contents/Resources/bin/docker',exec=promisify(execFile),options={encoding:'utf8',timeout:30000,maxBuffer:65536};
 const listed=await exec(docker,['container','ls','--all','--no-trunc','--filter','name=^/cortex-sandbox-'+SESSION+'$','--format','{{.ID}}'],options);check('fresh Docker exact name absent with daemon success',listed.stdout.trim()==='');
 const labelled=await exec(docker,['container','ls','--all','--no-trunc','--filter','label=dev.cortex.disposable-sandbox='+SESSION,'--format','{{.ID}}'],options);check('fresh Docker exact ownership label absent with daemon success',labelled.stdout.trim()==='');
 let inspectAbsent=false;try{await exec(docker,['container','inspect',ready.container.id],options);}catch(error){inspectAbsent=error.code===1&&String(error.stdout).trim()==='[]'&&/no such (object|container)/i.test(String(error.stderr));}check('fresh exact container ID inspect is an absence response',inspectAbsent);out.container={status:'ABSENT',id:ready.container.id,name:ready.container.name,verifiedAt:Date.now()};
 out.privatePaths={};for(const [label,file]of Object.entries({issuerDir:s.issuerDir,secretsDir:s.secretsDir,workspace:s.workspace,backendDir:s.backendDir,hostHome:path.join(s.runDir,'host-home'),tmp:path.join(s.runDir,'tmp'),deployKey:s.deploymentKeyPath})){let absent=false;try{await fs.lstat(file);}catch(error){if(error.code==='ENOENT')absent=true;else throw error;}check('owned private path absent '+label,absent);out.privatePaths[label]='ABSENT';}
 out.status='ABSENT';out.clientsClosed=true;out.unknownLiability='Retained final ledger/failed-output receipts remain evidence; resource deletion does not establish exact cost or refund historical UNKNOWN liability.';
}catch(error){out.status='FAIL';out.error={name:error?.name,code:typeof error?.code==='string'?error.code:'OTHER_ERROR',assertion:error?.name==='AssertionError'?String(error.message).split('\n')[0].slice(0,240):'Raw diagnostics suppressed'};process.exitCode=1;}
finally{out.finishedAt=Date.now();await fs.writeFile(destination,JSON.stringify(out,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({receipt:destination,status:out.status,error:out.error,checks:out.checks.length,cleanupActions:0}));}

}
