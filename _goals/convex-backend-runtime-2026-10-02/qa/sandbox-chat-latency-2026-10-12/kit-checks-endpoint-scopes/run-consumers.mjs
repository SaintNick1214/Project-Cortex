import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const r='/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion',q=path.dirname(new URL(import.meta.url).pathname);
const env={...process.env,PATH:`${path.dirname(process.execPath)}:${process.env.PATH}`};
for(const name of ['verify-actual-packed-public-contracts','verify-packed-dependent-contracts','verify-packed-backend-export-closure','verify-packed-template-catalog']){
 const helper=path.join(q,name+'.mjs'),log=path.join(q,name+'-v1.log'),fd=fs.openSync(log,'wx');const started=performance.now();
 const result=spawnSync(process.execPath,[helper],{cwd:r,env,stdio:['ignore',fd,fd]});fs.closeSync(fd);
 fs.writeFileSync(path.join(q,name+'-exit.json'),JSON.stringify({command:[process.execPath,helper],cwd:r,node:process.versions.node,pinnedNodeFirstInPATH:true,exitCode:result.status,signal:result.signal,elapsedMs:performance.now()-started,consumerNetwork:0,consumerInference:0},null,2)+'\n');
 console.log(JSON.stringify({name,exitCode:result.status}));if(result.status!==0)process.exit(result.status??1);
}
