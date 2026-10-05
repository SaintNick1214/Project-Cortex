/** Parent-only official deployment into exclusive staging. Frozen fixture remains immutable. */
import {resolve,relative} from 'node:path';
import {cpSync,mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {root,repo,fixture,scratch,livePreflight,exclusive,sha256,json,limits,reserveTicket} from './guard.mjs';
import {ProcessOwner} from './process-owner.mjs';
const phase=process.argv[2];if(!['synthetic','empty'].includes(phase))throw Error('QA_PHASE');
const {target,values}=livePreflight();const stage=resolve(scratch,'deploy-'+phase);mkdirSync(stage,{mode:0o700});cpSync(fixture,stage,{recursive:true,errorOnExist:true,force:false});
if(phase==='empty')writeFileSync(resolve(stage,'convex/runtimeModelPolicyBootstrap.ts'),readFileSync(resolve(repo,'convex-dev/runtimeModelPolicyBootstrap.ts')),{flag:'w',mode:0o600});
const owner=new ProcessOwner(),startedAt=new Date().toISOString();let status='FAIL';
const runtime={};for(const name of ['HTTPS_PROXY','HTTP_PROXY','NO_PROXY','https_proxy','http_proxy','no_proxy','NODE_EXTRA_CA_CERTS'])if(process.env[name])runtime[name]=process.env[name];
try {await reserveTicket('process',6);const result=await owner.run([resolve(repo,'node_modules/convex/bin/main.js'),'dev','--once','--codegen','enable','--typecheck','enable','--tail-logs','disable','--env-file',resolve(scratch,'deploy.env')],{cwd:stage,env:{PATH:process.env.PATH,LANG:'C.UTF-8',CI:'1',NO_COLOR:'1',NODE_USE_ENV_PROXY:'1',...runtime,...values}},limits.cliMs);
 exclusive(resolve(scratch,'private-cli-'+phase+'-'+randomUUID()+'.json'),{startedAt,observedAt:new Date().toISOString(),exitCode:result.code,stdout:result.stdout,stderr:result.stderr});
 if(result.code!==0||result.timedOut||result.overflow)throw Error('QA_DEPLOY_FAILED');status='PASS';
 const directory=resolve(stage,'convex/_generated'),generated=readdirSync(directory).map(name=>({path:'convex/_generated/'+name,sha256:sha256(readFileSync(resolve(directory,name)))}));
 exclusive(resolve(scratch,'codegen-'+phase+'.json'),{operation:target.operation,phase,status,officialCodegen:true,typecheck:'enable',freezeSha256:sha256(readFileSync(resolve(root,'runtime-freeze.json'))),bootstrapSha256:sha256(readFileSync(resolve(stage,'convex/runtimeModelPolicyBootstrap.ts'))),generated,startedAt,observedAt:new Date().toISOString()});
}finally{await owner.reapAll();if(owner.records.size)throw Error('QA_GROUP_NOT_TERMINAL');exclusive(resolve(scratch,'process-deploy-'+phase+'-'+randomUUID()+'.json'),{phase,status,startedAt,observedAt:new Date().toISOString(),spawned:owner.spawned,verifiedTerminalGroups:owner.verifiedGroups,remaining:owner.records.size});}
