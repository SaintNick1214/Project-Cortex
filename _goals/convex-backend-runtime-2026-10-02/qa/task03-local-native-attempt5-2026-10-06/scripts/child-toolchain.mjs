/** Read-only compiler/runtime qualification; no service or package installation. */
import { accessSync,constants,readFileSync,realpathSync,lstatSync } from 'node:fs';
import { resolve,delimiter } from 'node:path';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { repo,fixture,canonical } from './guard.mjs';
const fail=()=>{throw new Error('ATTEMPT2_TOOLCHAIN_NOT_QUALIFIED');};
function command(name,path){
 for(const directory of path.split(delimiter).filter(Boolean)){
  const candidate=resolve(directory,name);try{accessSync(candidate,constants.X_OK);return realpathSync(candidate);}catch{/* Continue to next actual installed executable. */}
 }
 return fail();
}
function version(script,path,home,expected){
 const result=spawnSync(process.execPath,[script,'--version'],{env:{PATH:path,LANG:'C.UTF-8',NO_COLOR:'1',HOME:home},encoding:'utf8',timeout:3000,maxBuffer:16384});
 if(result.error||result.status!==0||result.signal!==null||result.stdout.trim()!==expected)fail();
 return result.stdout.trim();
}
export function childToolchain(inherited=process.env.PATH){
 if(process.version!=='v24.15.0'||typeof inherited!=='string'||!inherited)fail();
 const home=process.env.HOME||homedir();canonical(home,home);const homeStat=lstatSync(home);
 if(!homeStat.isDirectory()||homeStat.uid!==process.getuid()||(process.platform==='linux'&&(home!=='/tmp'||(homeStat.mode&0o777)!==0o700)))fail();
 const bin=canonical(resolve(repo,'node_modules/.bin'),repo),path=bin+delimiter+inherited;
 const node=command('node',path);if(node!==realpathSync(process.execPath))fail();
 const compiler=canonical(resolve(repo,'node_modules/typescript/bin/tsc'),repo);
 if(command('tsc',path)!==compiler||JSON.parse(readFileSync(resolve(repo,'node_modules/typescript/package.json'))).version!=='6.0.3')fail();
 const projected=canonical(resolve(fixture,'fixture/node_modules/typescript/bin/tsc'),fixture);
 const npm=command('npm',path);
 return {path,home,node,compiler,projected,npm,nodeVersion:process.version,npmVersion:version(npm,path,home,'12.2.0'),compilerVersion:version(compiler,path,home,'Version 6.0.3'),projectedCompilerVersion:version(projected,path,home,'Version 6.0.3')};
}
