// DUMMY DESIGN_ONLY examples, no repository implementation or native imports.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const canonical=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const hash=x=>createHash('sha256').update(canonical(x)).digest('hex');
let assertions=0;
function check(x){assert.ok(x);assertions++;}
function start(x,sequence){
  if(sequence!==0||!x||typeof x!=='object'||Object.getPrototypeOf(x)!==Object.prototype)return false;
  const d=Object.getOwnPropertyDescriptors(x),ks=Reflect.ownKeys(d);
  if(ks.length!==2||!ks.includes('type')||!ks.includes('warnings'))return false;
  if(ks.some(k=>!('value' in d[k])||!d[k].enumerable))return false;
  if(d.type.value!=='stream-start')return false;
  const w=d.warnings.value;
  if(!Array.isArray(w)||Object.getPrototypeOf(w)!==Array.prototype)return false;
  const wd=Object.getOwnPropertyDescriptors(w);
  return Reflect.ownKeys(wd).length===1&&'value' in wd.length&&wd.length.value===0;
}
const prefix={type:'stream-start',warnings:[]};
check(start(prefix,0));
for(const x of [null,{}, {type:'stream-start'}, {warnings:[]}, {type:'start',warnings:[]}, {type:'stream-start',warnings:null}, {type:'stream-start',warnings:{}}, {type:'stream-start',warnings:['warning']}, {type:'stream-start',warnings:Array(1)}, {type:'stream-start',warnings:[],extra:true},Object.assign(Object.create(null),prefix),Object.assign(Object.create({extra:true}),prefix)])check(!start(x,0));
check(!start(prefix,1));check(!start(prefix,511));
let getterCalls=0;const getter={warnings:[]};Object.defineProperty(getter,'type',{enumerable:true,get(){getterCalls++;return 'stream-start';}});check(!start(getter,0));check(getterCalls===0);
const symbol={...prefix,[Symbol('extra')]:true};check(!start(symbol,0));
const nonenumerable={...prefix};Object.defineProperty(nonenumerable,'extra',{value:1});check(!start(nonenumerable,0));
const arrayExtra=[];arrayExtra.extra=1;check(!start({type:'stream-start',warnings:arrayExtra},0));
const raw={type:'raw',rawValue:{id:'DUMMY',model:'DUMMY',choices:[{index:0,delta:{content:'x'},finish_reason:null}]}};
const text={type:'text-delta',id:'DUMMY',delta:'x'};
const events=xs=>xs.map((data,sequence)=>({sequence,kind:data.type,digest:hash(data),data}));
const original=events([raw,text]),prefixed=events([prefix,raw,text]);
const substantive=xs=>xs.filter(e=>e.kind!=='stream-start').map(e=>e.data);
check(canonical(substantive(original))===canonical(substantive(prefixed)));
check(hash(original)!==hash(prefixed));check(prefixed[2].sequence===original[1].sequence+1);
check(prefixed[0].digest===hash(prefix));check(prefixed[1].digest===original[0].digest);
const identity=(sequence,rawPartDigest)=>({version:1,scenarioId:'C09',dispatchIdentity:'DUMMY',binding:{original:true},partSequence:sequence,rawPartDigest,stageCanonicalHash:hash({text:'x'}),trigger:'revoke'});
check(hash(identity(1,hash(raw)))!==hash(identity(2,hash(raw))));
check(hash(identity(2,hash(raw)))!==hash(identity(2,hash({...raw,rawValue:{changed:true}}))));
check(hash(identity(2,hash(raw)))===hash(identity(2,hash(raw))));
// Prefix-only facts are explicit unknown nominations; this is NOT a proof resolver.
const prefixOnly={lifetime:'unknown',money:'unknown',serving:'unknown',usage:'unknown',eligible:[]};
check(prefixOnly.eligible.length===0&&Object.values(prefixOnly).slice(0,4).every(x=>x==='unknown'));
check(1+511===512);check(1+512>512);
console.log(JSON.stringify({classification:'DUMMY_DESIGN_ONLY_NOT_NATIVE_NOT_IMPLEMENTATION',assertions,caseGroups:['original-shape','descriptor-getter-not-invoked','missing-extra-symbol-prototype','sparse-nonempty-array','late-repeat-position','complete-transcript-hash-shift','actual-part-sequence-stage-identity','prefix-only-unknown','event-arithmetic-bound'],notCovered:['full-codec-bounds','production-reducer','native-OCC','services','proof-registry','actual-money','UI']}));
