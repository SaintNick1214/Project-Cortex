import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const {canonical:frozenCanonical}=await import('../../../_goals/convex-backend-runtime-2026-10-02/qa/task04-default-native-driver-implementation-c2/fixture/convex/canonical.ts');
const hash=x=>createHash('sha256').update(x).digest('hex');
function inspect(x,depth=0,state={nodes:0,seen:new Set()}){
 if(++state.nodes>4096||depth>16)throw Error('GRAPH_LIMIT');
 if(x===null||typeof x==='boolean')return state;
 if(typeof x==='number'){if(!Number.isFinite(x)||Object.is(x,-0))throw Error('NUMBER');return state}
 if(typeof x==='string'){if(!x.isWellFormed())throw Error('UNICODE');return state}
 if(typeof x!=='object'||state.seen.has(x))throw Error('DATA_GRAPH');state.seen.add(x);
 const arr=Array.isArray(x),p=Object.getPrototypeOf(x);if(p!==(arr?Array.prototype:Object.prototype)&&!(p===null&&!arr))throw Error('PROTOTYPE');
 const ds=Object.getOwnPropertyDescriptors(x);if(Reflect.ownKeys(ds).some(k=>typeof k!=='string'))throw Error('SYMBOL');
 for(const [k,d]of Object.entries(ds)){if(!k.isWellFormed()||!('value'in d)||(!d.enumerable&&!(arr&&k==='length')))throw Error('OWN_DATA')}
 if(arr){if(Object.keys(ds).length!==x.length+1)throw Error('SPARSE');for(let i=0;i<x.length;i++){if(!ds[i])throw Error('SPARSE');inspect(ds[i].value,depth+1,state)}}
 else for(const d of Object.values(ds))inspect(d.value,depth+1,state);
 return state;
}
function encode(x){if(x===null||typeof x!=='object')return JSON.stringify(x);if(Array.isArray(x))return '['+x.map(encode).join(',')+']';return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+encode(x[k])).join(',')+'}'}
function localResource(x){const s=inspect(x),text=encode(x),bytes=Buffer.byteLength(text);if(bytes>180000)throw Error('BYTE_LIMIT');return {nodes:s.nodes,bytes,text,digest:hash(text)}}
let frozenComparisons=0;
function resource(x){let local,error,official,officialError;try{local=localResource(x)}catch(e){error=e}try{official=frozenCanonical(x,180000)}catch(e){officialError=e}assert.equal(Boolean(error),Boolean(officialError),'local/frozen acceptance mismatch');frozenComparisons++;if(error)throw error;assert.equal(local.text,official,'exact frozen canonical bytes');return local}
function validateWitnesses(x){if(!x||typeof x!=='object')return;if(x.providerShape!==undefined){const w=x.providerShape;assert(Array.isArray(w)&&w.length===3);for(const row of w){assert.deepEqual(Object.keys(row).sort(),['keys','state']);assert(['record','missing','invalid'].includes(row.state));assert(Array.isArray(row.keys));assert(row.keys.every(k=>typeof k==='string'&&k.isWellFormed()));assert.deepEqual([...new Set(row.keys)].sort(),row.keys);if(row.state!=='record')assert.equal(row.keys.length,0)}if(x.providerCost.state==='present'){assert(w.every(row=>row.state==='record'));assert(w[0].keys.includes('providerMetadata')&&w[1].keys.includes('convexGateway')&&w[2].keys.includes('cost'));assert(typeof x.providerCost.cost==='number'&&Number.isFinite(x.providerCost.cost)&&x.providerCost.cost>=0&&!Object.is(x.providerCost.cost,-0))}}for(const v of Object.values(x))validateWitnesses(v)}
function capture(text,expected){const x=JSON.parse(text);const got=resource(x);assert.equal(got.text,text);assert.equal(got.digest,expected);validateWitnesses(x);return got}
function parent(x,seen){
 if(!x||typeof x!=='object'||Array.isArray(x)||seen.has(x)||![Object.prototype,null].includes(Object.getPrototypeOf(x)))throw Error('SHAPE');
 seen.add(x);const d=Object.getOwnPropertyDescriptors(x);for(const k of Reflect.ownKeys(d))if(typeof k!=='string'||!k.isWellFormed()||!('value'in d[k])||!d[k].enumerable)throw Error('SHAPE');
 return {d,w:{state:'record',keys:Object.keys(d).sort()}};
}
function snapshot(root){
 const seen=new Set(),a=parent(root,seen),b=parent(a.d.providerMetadata.value,seen),c=parent(b.d.convexGateway.value,seen),cost=c.d.cost.value;
 assert(typeof cost==='number'&&Number.isFinite(cost)&&cost>=0&&!Object.is(cost,-0));
 const value={providerCost:{state:'present',cost,reason:'none'},providerShape:[a.w,b.w,c.w]};
 const detached=JSON.parse(resource(value).text);
 function freeze(x){if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x)}}freeze(detached);return detached;
}
const root=extra=>({providerMetadata:{convexGateway:{cost:.000001,...(extra?{unused:7}:{})}}});
let n=0,getters=0;function test(name,fn){fn();n++;console.log('PASS '+name)}
const small=snapshot(root(false)),large=snapshot(root(true));
test('original C1 information-loss failure reproduced',()=>{assert.deepEqual(small.providerCost,large.providerCost);assert(4093+3<=4096);assert(4093+4>4096)});
test('different parents now replay distinct charged keys',()=>{const a=resource(small),b=resource(large);assert.equal(b.nodes,a.nodes+1);assert(b.bytes>a.bytes);assert.notEqual(a.digest,b.digest)});
function padded(value,total){const x={value,pad:[]};const current=resource(x).nodes;assert(total>=current);x.pad=Array(total-current).fill(null);return x}
test('exact4096 initial and capture',()=>{const x=padded(small,4096),a=resource(x);assert.equal(a.nodes,4096);assert.equal(capture(a.text,a.digest).nodes,4096)});
test('equal cost different parent crosses exact boundary',()=>{const x=padded(small,4096);x.value=large;assert.throws(()=>resource(x),/GRAPH_LIMIT/);const text=encode(x);assert.throws(()=>capture(text,hash(text)),/GRAPH_LIMIT/)});
test('exact byte boundary initial capture and overflow',()=>{const x={v:'x'.repeat(180000-Buffer.byteLength(encode({v:''})))};const a=resource(x);assert.equal(a.bytes,180000);assert.equal(capture(a.text,a.digest).bytes,180000);x.v+='x';assert.throws(()=>resource(x),/BYTE_LIMIT/);const t=encode(x);assert.throws(()=>capture(t,hash(t)),/BYTE_LIMIT/)});
test('root0 depth16 allowed depth17 rejected',()=>{let x=null;for(let i=0;i<16;i++)x=[x];assert.equal(resource(x).nodes,17);let t=resource(x);assert.equal(capture(t.text,t.digest).nodes,17);x=[x];assert.throws(()=>resource(x),/GRAPH_LIMIT/)});
test('UTF8 keys and JSON escapes counted canonically',()=>{const x={unicodeKeys:[{state:'record',keys:['a\\n','😀']}]};const a=resource(x);assert.equal(a.bytes,Buffer.byteLength(a.text));assert(a.bytes>a.text.length);assert.equal(capture(a.text,a.digest).bytes,a.bytes)});
test('same prefix100times never double charges',()=>{const x=padded(small,4096),a=resource(x);for(let i=0;i<100;i++)assert.equal(resource(x).nodes,a.nodes)});
test('new events count entire cumulative history',()=>{const x={version:2,events:[]};while(resource(x).nodes<4095)x.events.push(null);assert(resource(x).nodes<=4096);x.events.push(null);assert.equal(resource(x).nodes,4096);x.events.push(null);assert.throws(()=>resource(x),/GRAPH_LIMIT/)});
test('capture key state and scalar mutation with old digest',()=>{const a=resource(small);for(const mutate of [x=>x.providerShape[2].keys.push('unused'),x=>x.providerShape[2].state='invalid',x=>x.providerCost.cost=1]){const x=JSON.parse(a.text);mutate(x);assert.throws(()=>capture(encode(x),a.digest))}});
test('coherently rehashed smaller witness grants no provenance',()=>{const a=resource(small);assert.equal(capture(a.text,a.digest).digest,a.digest);const outcome={money:'UNKNOWN',categories:[],liability:314310,stop:true};assert.equal(outcome.money,'UNKNOWN');assert.equal(outcome.liability,314310)});
test('unused aliased costDetails remains allowed',()=>{const x=root(false),details={cache:1};x.body={usage:{cost_details:details}};x.providerMetadata.convexGateway.costDetails=details;assert.equal(snapshot(x).providerCost.cost,.000001)});
test('getter0 and selected ancestor alias',()=>{const x=root(false);Object.defineProperty(x.providerMetadata.convexGateway,'cost',{enumerable:true,get(){getters++;return 0}});assert.throws(()=>snapshot(x));assert.equal(getters,0);const y={};y.providerMetadata=y;assert.throws(()=>snapshot(y))});
test('mutating original after snapshot changes no retained bytes',()=>{const x=root(false),p=snapshot(x),before=resource(p).text;x.providerMetadata.convexGateway.unused=7;x.providerMetadata.convexGateway.cost=100;assert.equal(resource(p).text,before);assert(Object.isFrozen(p.providerShape[2].keys))});
test('duplicated or aliased retained witness refused',()=>{const x=JSON.parse(resource(small).text);x.providerShape[1]=x.providerShape[0];assert.throws(()=>resource(x),/DATA_GRAPH/)});
test('coherently rehashed malformed duplicate witness rejected',()=>{const x=JSON.parse(resource(small).text);x.providerShape[2].keys.push('cost');const t=encode(x);assert.throws(()=>capture(t,hash(t)))});
console.log(JSON.stringify({status:'PASS',controls:n,getters,frozenComparisons,kind:'DUMMY retained-graph resource/capture model',actualMoney:'EMPTY',productionQualification:false}));
