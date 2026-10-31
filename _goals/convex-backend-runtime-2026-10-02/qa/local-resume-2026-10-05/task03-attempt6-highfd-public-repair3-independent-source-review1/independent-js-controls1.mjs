import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {join,resolve} from 'node:path';
const input=JSON.parse(fs.readFileSync(0,'utf8'));
const prefix=input.source.slice(0,input.source.indexOf('try{\nassert.equal(process.version')).split('\n').filter(l=>!l.startsWith('import ')).join('\n');
const tail=input.source.slice(input.source.indexOf('}catch(error){primaryError=error;}finally{closeOwnedInputs();}'));
assert.ok(prefix&&tail);
const controls=[],failures=[];
const cases=[{name:'complete'},{name:'early-setup',early:true},...['open','fstat','maturity','read','parse','report','close'].flatMap(stage=>[0,1,2].map(i=>({name:stage+'-'+i,stage,i}))),{name:'all-close',positions:[0,1,2]}, {name:'primary-all-close',primary:true,positions:[0,1,2]}, {name:'report-all-close',stage:'report',i:0,positions:[0,1,2]}];
for(const c of cases){
 const opened=[],closed=[],errorObjects=[],closeMessages=[];let reportIndex=0;
 const fault=(stage,i)=>{if(c.stage===stage&&c.i===i){const e=new Error(stage+':'+i);errorObjects.push(e);throw e;}};
 const index=fd=>opened.indexOf(fd);
 const context={assert,Buffer,BigInt,Date,join,resolve,createHash,gzipSync,constants:fs.constants,fixtures:input.fixtures,c,
  realpathSync:fs.realpathSync,
  lstatSync:(p,o)=>{const s=fs.lstatSync(p,o);if(c.stage==='maturity'&&input.fixtures.indexOf(p)===c.i)return {...s,ctimeNs:BigInt(Date.now())*1000000n};return s;},
  openSync:(p,f)=>{const i=input.fixtures.indexOf(p);assert.ok(i>=0);fault('open',i);const fd=fs.openSync(p,f);opened.push(fd);return fd;},
  fstatSync:(fd,o)=>{fault('fstat',index(fd));return fs.fstatSync(fd,o);},
  readSync:(fd,...args)=>{fault('read',index(fd));return fs.readSync(fd,...args);},
  closeSync:fd=>{assert.ok(opened.includes(fd)&&!closed.includes(fd));closed.push(fd);fs.closeSync(fd);const i=index(fd);if(c.positions?.includes(i)||c.stage==='close'&&c.i===i){const e=new Error('close:'+i);errorObjects.push(e);closeMessages.push(e.message);throw e;}},
  process:{stdout:{write:()=>fault('report',reportIndex++)}}};
 vm.createContext(context);let thrown=null;
 const body=`if(c.early)throw new Error('early-setup');for(const p of fixtures)capture(p,'mock-source');for(let i=0;i<pins.length;i++){const r=qualify(pins[i],true);if(c.stage==='parse'&&i===c.i)JSON.parse('{');else JSON.parse(r.body);}if(c.primary)throw new Error('primary-work');emit({status:'PASS'});`;
 try{vm.runInContext(prefix+'\ntry{'+body+'\n'+tail,context,{timeout:5000});}catch(e){thrown=e;}
 try{
  assert.deepEqual(closed,opened);assert.equal(new Set(closed).size,closed.length);
  const errs=thrown?.errors??[];
  for(const e of errorObjects)assert.ok(errs.includes(e),'sticky identity lost');
  for(const s of closeMessages)assert.ok(errs.some(e=>e.message===s));
  const shouldFail=c.name!=='complete';assert.equal(Boolean(thrown),shouldFail);
  if(c.primary)assert.equal(errs[0].message,'primary-work');
  if(['fstat','maturity'].includes(c.stage))assert.equal(opened.length,c.i+1,'first-postopen owner missing');
  vm.runInContext('closeOwnedInputs()',context,{timeout:5000});assert.deepEqual(closed,opened);
  controls.push({name:'js:'+c.name,status:'PASS',opened:opened.length,closeAttempts:closed.length,accepted:!thrown,errors:errs.map(e=>e.message),allAttemptedExactlyOnce:true,actualWholeLifetimeCatchFinally:true});
 }catch(e){failures.push({name:'js:'+c.name,class:e.name,reason:e.message});controls.push({name:'js:'+c.name,status:'FAIL',reason:e.message});}
}
// Original assert statements are retained, independent of indentation/wrapper placement.
const assertions=s=>s.match(/assert\.(?:equal|deepEqual|ok)\([^\n;]*\);/g)||[];
const newAs=assertions(input.source),oldAs=assertions(input.old);
for(const a of oldAs){const i=newAs.indexOf(a);assert.ok(i>=0,a);newAs.splice(i,1);}
controls.push({name:'js:original-assertions-conserved',status:'PASS',originalCount:oldAs.length});
process.stdout.write(JSON.stringify({scope:'INDEPENDENT_U3_JS_SOURCE_MOCK',sourceEligibility:false,controls,PASS:controls.filter(c=>c.status==='PASS').length,FAIL:failures.length,failures,nodeVersion:process.version}));
