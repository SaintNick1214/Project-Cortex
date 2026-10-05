import assert from 'node:assert/strict';
let getters=0;
const missing=()=>Object.freeze({state:'missing',cost:null,reason:'missing'});
const invalid=reason=>Object.freeze({state:'invalid',cost:null,reason});
function descriptors(x,seen){
 if(x===null||typeof x!=='object'||Array.isArray(x)||seen.has(x)||![Object.prototype,null].includes(Object.getPrototypeOf(x)))throw Error('shape');
 seen.add(x);const ds=Object.getOwnPropertyDescriptors(x),keys=Reflect.ownKeys(ds);
 if(keys.length>4096)throw Error('bounds');
 for(const k of keys)if(typeof k!=='string'||!k.isWellFormed()||!('value'in ds[k])||!ds[k].enumerable)throw Error('shape');
 return ds;
}
function select(root){
 try{
 const seen=new Set(),rd=descriptors(root,seen),pm=rd.providerMetadata?.value;
 if(pm==null)return missing();
 const pd=descriptors(pm,seen),cg=pd.convexGateway?.value;if(cg==null)return missing();
 const cd=descriptors(cg,seen),n=cd.cost?.value;if(n==null)return missing();
 if(typeof n!=='number'||!Number.isFinite(n)||n<0||Object.is(n,-0))return invalid('number');
 return Object.freeze({state:'present',cost:n,reason:'none'});
 }catch(e){return invalid(e.message==='bounds'?'bounds':'shape')}
}
function associate(p,raw,id='raw-id',model='model',nativeId=id,nativeModel=model){
 return p.state==='present'&&typeof raw==='number'&&Number.isFinite(raw)&&raw>=0&&!Object.is(raw,-0)&&Object.is(p.cost,raw)&&id!==null&&model!==null&&nativeId===id&&nativeModel===model;
}
const counts={controls:0};
function test(name,fn){fn();counts.controls++;console.log('PASS '+name)}
const r=n=>({providerMetadata:{convexGateway:{cost:n}}});
test('original numeric preserved',()=>assert(Object.is(select(r(.000001)).cost,.000001)));
test('explicit zero remains observed only',()=>assert.equal(select(r(0)).state,'present'));
test('missing is never zero',()=>{for(const x of [{},{providerMetadata:null},{providerMetadata:{convexGateway:{}}},r(null),r(undefined)])assert.deepEqual(select(x),missing())});
test('invalid numbers and kinds',()=>{for(const n of [-1,-0,NaN,Infinity,-Infinity,'0',{},1n])assert.equal(select(r(n)).state,'invalid')});
test('accessor getter0',()=>{const x={providerMetadata:{convexGateway:{}}};Object.defineProperty(x.providerMetadata.convexGateway,'cost',{enumerable:true,get(){getters++;return 0}});assert.equal(select(x).state,'invalid');assert.equal(getters,0)});
test('custom prototype',()=>assert.equal(select({providerMetadata:Object.create({convexGateway:{cost:0}})}).state,'invalid'));
test('symbol and nonenumerable',()=>{const x=r(1);x.providerMetadata[Symbol('bad')]=1;assert.equal(select(x).state,'invalid');const y=r(1);Object.defineProperty(y.providerMetadata.convexGateway,'hidden',{value:1});assert.equal(select(y).state,'invalid')});
test('selected ancestor alias',()=>{const x={};x.providerMetadata=x;assert.equal(select(x).state,'invalid');const y={providerMetadata:{}};y.providerMetadata.convexGateway=y.providerMetadata;assert.equal(select(y).state,'invalid')});
test('unused shared costDetails ignored',()=>{const details={cache:1};const x=r(1);x.body={usage:{cost:1,cost_details:details}};x.providerMetadata.convexGateway.costDetails=details;assert.equal(select(x).cost,1)});
test('detached mutation',()=>{const x=r(.01),p=select(x),before=JSON.stringify(p);x.providerMetadata.convexGateway.cost=100;x.providerMetadata=null;assert.equal(JSON.stringify(p),before);assert(Object.isFrozen(p))});
test('raw mapped correlation exact',()=>{assert(associate(select(r(1)),1));assert(!associate(select(r(1)),2));assert(!associate(select(r(1)),null));assert(!associate(select(r(1)),1,'foreign','model','raw-id'));assert(!associate(select(r(1)),1,'raw-id',null))});
test('oversize parent descriptor set',()=>{const x=r(1);for(let i=0;i<4097;i++)x.providerMetadata.convexGateway['k'+i]=i;assert.deepEqual(select(x),invalid('bounds'))});
test('no whole invocation inference',()=>{const p=select(r(0)),correlated=associate(p,0);assert(correlated);const outcome={money:'UNKNOWN',categories:[],stop:true,liability:314310};assert.equal(outcome.money,'UNKNOWN');assert.deepEqual(outcome.categories,[])});
console.log(JSON.stringify({status:'PASS',...counts,getters,kind:'DUMMY specification model',productionQualification:false,currentMoneyDomain:'EMPTY'}));
