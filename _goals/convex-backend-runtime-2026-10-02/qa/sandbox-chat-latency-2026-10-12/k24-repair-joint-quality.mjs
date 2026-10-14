import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
const root=process.cwd(),qa=path.join(root,'_goals/convex-backend-runtime-2026-10-02/qa/sandbox-chat-latency-2026-10-12');
const npm='/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/npm/bin/npm-cli.js';
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean);
if(process.version!=='v24.15.0'||execFileSync(process.execPath,[npm,'--version'],{encoding:'utf8'}).trim()!=='12.2.0')throw Error('Declared pinned toolchain required');
const files=[...new Set([...git(['diff','--name-only','HEAD']),...git(['ls-files','--others','--exclude-standard'])])]
  .filter(name=>(name==='README.md'||/^(convex-dev|src|tests|scripts|packages)\//.test(name))&&fs.statSync(path.join(root,name)).isFile());
const hashes=Object.fromEntries(files.map(name=>[name,hash(fs.readFileSync(path.join(root,name)))]));
fs.writeFileSync(path.join(qa,'k24-repair-joint-quality-inputs.json'),JSON.stringify({baseline:'efcc91d2317dadcb143c5cf1929504bd0cbee3a6',head:git(['rev-parse','HEAD'])[0],node:process.version,npm:'12.2.0',hashes},null,2)+'\n');
async function check(name,args){
  const log=path.join(qa,`k24-repair-joint-${name}-v1.log`),fd=fs.openSync(log,'w');
  const result=await new Promise(resolve=>{const child=spawn(process.execPath,args,{cwd:root,env:process.env,stdio:['ignore',fd,fd]});
    child.on('error',error=>resolve({exitCode:null,error:error.message}));child.on('close',(exitCode,signal)=>resolve({exitCode,signal}));});
  fs.closeSync(fd);fs.writeFileSync(path.join(qa,`k24-repair-joint-${name}-v1-exit.json`),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({check:name,...result}));return result;
}
const tsc=path.join(root,'node_modules/typescript/bin/tsc'),eslint=path.join(root,'node_modules/eslint/bin/eslint.js');
const early=await Promise.all([
  check('root-types',[tsc,'--noEmit','-p','tsconfig.json']),
  check('backend-types',[tsc,'--noEmit','-p','convex-dev/tsconfig.json']),
  check('lint-types',[tsc,'--noEmit','-p','tsconfig.lint.json']),
  check('scoped-lint',[eslint,...files.filter(name=>name.endsWith('.ts'))]),
]);
if(early.some(result=>result.exitCode!==0))process.exitCode=1;
else if((await check('build',[npm,'run','build'])).exitCode!==0)process.exitCode=1;
else if((await check('packed-contracts',[path.join(root,'scripts/verify-public-contracts.mjs')])).exitCode!==0)process.exitCode=1;
const unchanged=Object.entries(hashes).every(([name,digest])=>hash(fs.readFileSync(path.join(root,name)))===digest);
fs.writeFileSync(path.join(qa,'k24-repair-joint-quality-input-check.json'),JSON.stringify({unchanged,count:files.length},null,2)+'\n');
if(!unchanged)process.exitCode=1;
