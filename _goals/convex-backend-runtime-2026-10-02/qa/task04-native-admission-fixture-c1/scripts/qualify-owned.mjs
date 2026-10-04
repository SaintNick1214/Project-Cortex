/** Parent-only qualifier process group; no direct child survives a timeout/overflow. */
import {resolve} from 'node:path';import {randomUUID} from 'node:crypto';import {ProcessOwner} from './process-owner.mjs';import {root,repo,scratch,livePreflight,reserveTicket,exclusive,limits} from './guard.mjs';
const phase=process.argv[2];const {target}=livePreflight(phase);if(!['synthetic','empty'].includes(phase))throw Error('QA_PHASE');const owner=new ProcessOwner();const runtime={};for(const name of ['HTTPS_PROXY','HTTP_PROXY','NO_PROXY','https_proxy','http_proxy','no_proxy','NODE_EXTRA_CA_CERTS'])if(process.env[name])runtime[name]=process.env[name];let result,status='FAIL';
try{if(phase==='synthetic')await reserveTicket('process',6);else { // The second tiny phase runs in this parent; spawning a seventh group is prohibited.
 const {session,qualify}=await import('./driver.mjs');result=await qualify(await session('empty'),'empty');status=result.status;
}
 if(phase==='synthetic'){result=await owner.run([resolve(root,'scripts/driver.mjs'),phase],{cwd:repo,env:{PATH:process.env.PATH,LANG:'C.UTF-8',NODE_USE_ENV_PROXY:'1',...runtime}},limits.driverMs);status=result.code===0&&!result.timedOut&&!result.overflow?'PASS':'FAIL';}
}finally{await owner.reapAll();if(owner.records.size)status='FAIL';exclusive(resolve(scratch,'qualifier-process-'+phase+'-'+randomUUID()+'.json'),{operation:target.operation,phase,status,counts:{spawned:owner.spawned,verifiedTerminalGroups:owner.verifiedGroups,remaining:owner.records.size},exitCode:result?.code??(status==='PASS'?0:1)});}
if(status!=='PASS')process.exitCode=1;
