/** SOURCE-only isolated actual observer functions; all fixture FDs belong to this test. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import vm from 'node:vm';
import {join,resolve} from 'node:path';
const input=JSON.parse(fs.readFileSync(0,'utf8'));
assert.equal(process.version,'v24.15.0');
const src=input.newSource,old=input.oldSource,controls=[];
const pre=src.slice(0,src.indexOf('try{\nassert.equal(process.version')).split('\n').filter(l=>!l.startsWith('import ')).join('\n');
const tail=src.slice(src.indexOf('}catch(error){primaryError=error;}finally{closeOwnedInputs();}'));
assert.ok(src.indexOf('try{\nassert.equal(process.version')<src.indexOf('const prior=controlledJson'));
assert.ok(src.indexOf('pins.push(pin)')<src.indexOf("assert.ok(BigInt(Date.now())"));
for(const name of ['emit','qualify','sameOriginal']){
 const functionPart=(s,n)=>{const start=s.indexOf('function '+n+'(');let depth=0,quote=null,escape=false,begun=false;for(let i=start;i<s.length;i++){const c=s[i];if(quote){if(escape)escape=false;else if(c==='\\')escape=true;else if(c===quote)quote=null;continue;}if(c==="'"||c==='"'||c==='`'){quote=c;continue;}if(c==='{'){depth++;begun=true;}else if(c==='}'&&--depth===0&&begun)return s.slice(start,i+1);}throw Error('function extraction');};
 assert.equal(functionPart(src,name),functionPart(old,name));
}
controls.push({name:'js:unchanged-original-qualify-emit-and-compare',status:'PASS',wholeLifetimeGuardBeforeSetup:true,registrationBeforeMaturity:true});
for(const stage of ['open','fstat','maturity','read','parse','report','close','assert'])for(const index of [0,1,2]){
 const fdIndex=new Map(),opened=[],closes=[];let reports=0;let injected=null;let primary=null;
 const fail=(s,i)=>{if(stage===s&&index===i){injected=new Error(s+':'+i);throw injected;}};
 const ctx={assert,Buffer,createHash,gzipSync,BigInt,Date,join,resolve,constants:fs.constants,
  lstatSync:(path,opts)=>{const i=input.fixtures.indexOf(path);const s=fs.lstatSync(path,opts);if(stage==='maturity'&&i===index)return {...s,mtimeNs:BigInt(Date.now())*1000000n,ctimeNs:BigInt(Date.now())*1000000n};return s;},
  realpathSync:fs.realpathSync,
  openSync:(p,f)=>{const i=input.fixtures.indexOf(p);assert.ok(i>=0);fail('open',i);const fd=fs.openSync(p,f);opened.push(fd);fdIndex.set(fd,i);return fd;},
  fstatSync:(fd,o)=>{fail('fstat',fdIndex.get(fd));return fs.fstatSync(fd,o);},
  readSync:(fd,...args)=>{fail('read',fdIndex.get(fd));return fs.readSync(fd,...args);},
  closeSync:(fd)=>{assert.ok(opened.includes(fd));assert.ok(!closes.includes(fd),'unknown close state retry');closes.push(fd);fs.closeSync(fd);fail('close',fdIndex.get(fd));},
  process:{stdout:{write:()=>{fail('report',reports++);}}},fixtures:input.fixtures,
  failAssertion:i=>fail('assert',i),stage,index};
 vm.createContext(ctx);
 const body=`for(let i=0;i<fixtures.length;i++){capture(fixtures[i],'owned-source-fixture');if(stage==='assert')failAssertion(i);}for(let i=0;i<pins.length;i++){const row=qualify(pins[i],true);JSON.parse(stage==='parse'&&i===index?'{':row.body);if(stage==='report')emit({fixture:i});}if(stage==='close')throw new Error('primary-before-close');`;
 try{vm.runInContext(pre+'\ntry{'+body+'\n'+tail,ctx,{timeout:5000});}catch(e){primary=e;}
 assert.ok(primary,'injected fault must deny');assert.deepEqual(closes,opened);
 assert.equal(new Set(closes).size,closes.length);
 assert.ok(primary.errors?.length>=1);
 if(stage==='close'){assert.equal(primary.errors[0].message,'primary-before-close');assert.equal(primary.errors[1],injected);}
 else if(injected)assert.equal(primary.errors[0],injected);
 if(['fstat','maturity','assert'].includes(stage))assert.equal(opened.length,index+1,'immediate ownership covers first qualification failure');
 controls.push({name:'js:'+stage+':'+index,status:'PASS',opened:opened.length,closeAttempts:closes.length,allOwnedAttemptedExactlyOnce:true,primaryErrorIdentityRetained:true,unknownRetry:false,noForeignFDs:true,scope:'ISOLATED_ACTUAL_SOURCE_HOST_OWNED_FD'});
}
{
 const opened=[],closes=[];
 const ctx={assert,Buffer,createHash,gzipSync,BigInt,Date,join,resolve,constants:fs.constants,lstatSync:fs.lstatSync,realpathSync:fs.realpathSync,
 openSync:(p,f)=>{assert.ok(input.fixtures.includes(p));const fd=fs.openSync(p,f);opened.push(fd);return fd;},fstatSync:fs.fstatSync,readSync:fs.readSync,
 closeSync:fd=>{assert.ok(opened.includes(fd)&&!closes.includes(fd));closes.push(fd);fs.closeSync(fd);},process:{stdout:{write:()=>{}}},fixtures:input.fixtures};
 vm.createContext(ctx);vm.runInContext(pre+'\ntry{for(const p of fixtures){const pin=capture(p,"positive");const row=qualify(pin,true);assert.equal(row.fullEOF,true);JSON.parse(row.body);emit({sha256:row.sha256,bytes:row.bytes});}\n'+tail,ctx,{timeout:5000});
 assert.deepEqual(closes,opened);controls.push({name:'js:positive-fullEOF-allNine',status:'PASS',opened:3,closeAttempts:3,allOwnedAttemptedExactlyOnce:true});
}
process.stdout.write(JSON.stringify({scope:'U3_SOURCE_ONLY_JS_ISOLATED_FAULT_CONTROLS',status:'PASS',nodeVersion:process.version,controls}));
