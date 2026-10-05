import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { preparation } from './guard.mjs';
import { prepare as prepareMf } from '../cases/mf-registry-artifacts.mjs';
import { admitBatchRow, batchTarget, qualifyBatchTargets } from './batch-bindings.mjs';
import { argumentsFor } from './argument-candidates.mjs';
const ledger=JSON.parse(readFileSync(resolve(preparation,'path-ledger.json')));
const native=JSON.parse(readFileSync(resolve(preparation,'native-registration-schemas.json')));
const run='foundation-'+'a'.repeat(32), fake=table=>'OFFLINE_SHAPE_ONLY_'+table;
const ctx={run,issuer:'https://cortex-qualification.invalid',scopes:{tenantId:run+':tenantA',memorySpaceId:run+':spaceA'},users:{reader:run+':reader'},principals:{reader:fake('runtimeAuthPrincipals')},identities:{reader:run+':subject'},references:{reader:{membershipId:fake('runtimeAuthMemberships')}},grants:{reader:fake('runtimeAuthGrants')},refs:['runtimeAuthPrincipals','governancePolicies','graphSyncQueue','runtimeAuthGrants','runtimeAuthMemberships','runtimeMemoryVectors','memories','facts'].map(table=>({table,id:fake(table)})),files:[{id:fake('_storage')}]};
// Derive resource rows from the actual unchanged family seed author, not mirrored fixtures.
Object.assign(ctx.scopes,{writerMemorySpaceId:run+':spaceWriter',foreignTenantId:run+':tenantB',foreignMemorySpaceId:run+':spaceB'});
for(const key of ['writer','foreign','revoked','deleted'])ctx.principals[key]=fake('principal-'+key);
const seedRows=[];ctx.operator=async(name,{rows})=>{assert.equal(name,'seed');return rows.map((entry,index)=>{const ref={table:entry.table,id:fake(entry.table)+'_'+index};seedRows.push({...entry,value:{...entry.value,_id:ref.id}});ctx.refs.push(ref);return ref;});};
await prepareMf(ctx);
ctx.snapshot=async()=>seedRows;ctx.call=async(identity,path,args)=>{assert.equal(identity,'reader');const table=path.split(':')[0],key=table==='facts'?'factId':'memoryId';return seedRows.find(row=>row.table===table&&row.value[key]===args[key])?.value??null;};
const healthy=await qualifyBatchTargets(ctx);assert.equal(healthy.length,2);
let bindingNegatives=0;
for(const table of ['facts','memories']){
 const key=table==='facts'?'factId':'memoryId',owned=seedRows.find(row=>row.table===table&&row.value[key]===run+':'+table+'-owned').value;
 const row=ledger.cases.find(item=>item.path===table+':deleteByIds'),args=argumentsFor(row,ctx),ids=args[table==='facts'?'factIds':'memoryIds'];assert.equal(ids.length,1);assert.equal(ids[0],owned[key]);assert.equal(batchTarget(ctx,table),owned[key]);
 const unbound={...ctx,batchBindings:{[table]:owned}};assert.throws(()=>argumentsFor(row,unbound));bindingNegatives++;
 for(const patch of [null,{[key]:run+':fake-resource'},{tenantId:ctx.scopes.foreignTenantId},{memorySpaceId:ctx.scopes.foreignMemorySpaceId},{ownerPrincipalId:ctx.principals.foreign},{_id:'UNTRACKED_FAKE_SEED'},{lineage:undefined},{lineage:{...owned.lineage,sourceRevision:99}}]){assert.throws(()=>admitBatchRow({...ctx},table,patch===null?null:{...owned,...patch}));bindingNegatives++;}
 const lost={...ctx,refs:[]};assert.throws(()=>admitBatchRow(lost,table,owned));bindingNegatives++;
}
export function validate(schema,value){switch(schema.type){
 case 'object':assert.ok(value&&typeof value==='object');assert.ok(Object.keys(value).every(key=>Object.hasOwn(schema.value,key)));for(const[key,field]of Object.entries(schema.value)){if(value[key]===undefined){assert.ok(field.optional,key);continue;}validate(field.fieldType,value[key]);}break;
 case 'string':case 'id':assert.equal(typeof value,'string');break; // ID table encoding requires real service IDs; never claimed offline.
 case 'number':assert.equal(typeof value,'number');assert.ok(Number.isFinite(value));break;
 case 'boolean':assert.equal(typeof value,'boolean');break;
 case 'bigint':assert.equal(typeof value,'bigint');break;
 case 'null':assert.equal(value,null);break;
 case 'literal':assert.deepEqual(value,schema.value);break;
 case 'array':assert.ok(Array.isArray(value));for(const item of value)validate(schema.value,item);break;
 case 'record':for(const[key,item]of Object.entries(value)){validate(schema.keys,key);validate(schema.values.fieldType,item);}break;
 case 'union':assert.ok(schema.value.some(option=>{try{validate(option,value);return true;}catch{return false;}}));break;
 case 'bytes':assert.ok(value instanceof ArrayBuffer);break;
 case 'any':break;default:assert.fail('Unsupported native validator '+schema.type);
}}
const audit=JSON.parse(readFileSync(resolve(preparation,'array-resource-audit.json')));
const containsArray=value=>value&&typeof value==='object'&&(value.type==='array'||Object.values(value).some(containsArray));
const actualArrayRows=native.rows.filter(row=>ledger.cases.find(item=>item.path===row.path).visibility==='public'&&containsArray(row.args));
assert.deepEqual(actualArrayRows.map(row=>row.path).sort(),audit.rows.map(row=>row.path).sort());assert.equal(audit.arrayBearingPublicPaths,actualArrayRows.length);
assert.deepEqual(audit.correctedPaths.sort(),['facts:deleteByIds','memories:deleteByIds']);
for(const entry of audit.rows){const row=ledger.cases.find(item=>item.path===entry.path),fields=row.validatorSchema.fields;
 if(entry.classification==='owned-resource-batch-corrected')assert.deepEqual(Object.keys(fields),[entry.path.startsWith('facts:')?'factIds':'memoryIds']);
 else if(entry.classification==='guarded-unavailable')assert.equal(row.safeClosure,true);
 else if(entry.classification==='scoped-array-input')assert.ok('tenantId' in fields||'memorySpaceId' in fields);
 else{assert.equal(entry.path,'memories:finalizePartialMemory');assert.ok('memoryId' in fields);assert.ok('embedding' in fields);}
}
for(const row of ledger.cases)validate(native.rows.find(r=>r.path===row.path).args,argumentsFor(row,ctx));
console.log(JSON.stringify({scope:'OFFLINE_NATIVE_VALIDATOR_SHAPES',status:'PASS',registered:259,arrayBearingPublicPaths:audit.arrayBearingPublicPaths,nonemptyBatchPaths:2,healthyMockGetters:healthy.length,bindingNegatives,seedRowsFromActualFamily:seedRows.length,realIdEncoding:'NOT_RUN_REQUIRES_SEEDED_SERVICE_IDS',dispatches:0,signatures:0}));
