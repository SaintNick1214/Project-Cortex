import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
const R=process.cwd(),Q=path.dirname(new URL(import.meta.url).pathname);
const NODE='/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin/node';
const NPM='/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/npm/bin/npm-cli.js';
const files=['convex-dev/runtimeIngestion.ts','tests/unit/runtimeIngestion/progress-publication.test.ts'];
const hashes=async()=>Object.fromEntries(await Promise.all(files.map(async p=>[p,createHash('sha256').update(await fs.readFile(path.join(R,p))).digest('hex')])));
const paths=JSON.parse(await fs.readFile(path.join(Q,'ingestion-progress-publication-selected-paths.json'),'utf8'));
const jest=['--experimental-vm-modules','node_modules/jest/bin/jest.js','--runTestsByPath',...paths,'--runInBand','--watchman=false','--forceExit=false'];
const steps=[['root-types-v2',['node_modules/typescript/bin/tsc','--noEmit']],['backend-types',['node_modules/typescript/bin/tsc','--project','convex-dev/tsconfig.json','--noEmit']],['scoped-eslint',['node_modules/eslint/bin/eslint.js',...files,'--report-unused-disable-directives']],['affected',[...jest,'--json','--outputFile='+path.join(Q,'ingestion-progress-publication-affected-final-jest.json')]],['root-lint',[NPM,'run','lint']],['build',[NPM,'run','build']],['contracts',[NPM,'run','test:contracts']]];
const checks=JSON.parse(await fs.readFile(path.join(Q,'ingestion-progress-publication-final-checks.json'),'utf8')).checks.filter(check=>check.exitCode===0);
for(const [name,args]of steps){
 const before=await hashes(),start=performance.now(),log=path.join(Q,'ingestion-progress-publication-'+name+'-final.log');
 const output=await fs.open(log,'wx');
 const child=spawn(NODE,args,{cwd:R,env:{...process.env,PATH:path.dirname(NODE)+':'+process.env.PATH,CORTEX_TEST_ENV_MODE:'explicit',CONVEX_URL:'http://127.0.0.1:9'},stdio:['ignore',output.fd,output.fd]});
 const exitCode=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);});await output.close();
 const result={name,command:[NODE,...args],cwd:R,exitCode,elapsedMs:performance.now()-start,before,after:await hashes(),log,explicitOffline:true};checks.push(result);
 await fs.writeFile(path.join(Q,'ingestion-progress-publication-'+name+'-final.json'),JSON.stringify(result,null,2)+'\n');
 await fs.writeFile(path.join(Q,'ingestion-progress-publication-final-checks-v2.json'),JSON.stringify({checks,allExecuted:checks.length===steps.length+1,allPassed:checks.length===steps.length+1&&checks.every(c=>c.exitCode===0)},null,2)+'\n');
 console.log(JSON.stringify({name,exitCode,elapsedMs:result.elapsedMs}));
 if(exitCode!==0){process.exitCode=exitCode;break;}
}
