import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { preparation } from './guard.mjs';
import { argumentsFor } from './argument-candidates.mjs';
const ledger=JSON.parse(readFileSync(resolve(preparation,'path-ledger.json')));
const native=JSON.parse(readFileSync(resolve(preparation,'native-registration-schemas.json')));
const run='foundation-'+'a'.repeat(32), fake=table=>'OFFLINE_SHAPE_ONLY_'+table;
const ctx={run,issuer:'https://cortex-qualification.invalid',scopes:{tenantId:run+':tenantA',memorySpaceId:run+':spaceA'},users:{reader:run+':reader'},principals:{reader:fake('runtimeAuthPrincipals')},identities:{reader:run+':subject'},references:{reader:{membershipId:fake('runtimeAuthMemberships')}},grants:{reader:fake('runtimeAuthGrants')},refs:['runtimeAuthPrincipals','governancePolicies','graphSyncQueue','runtimeAuthGrants','runtimeAuthMemberships','runtimeMemoryVectors','memories','facts'].map(table=>({table,id:fake(table)})),files:[{id:fake('_storage')}]};
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
for(const row of ledger.cases)validate(native.rows.find(r=>r.path===row.path).args,argumentsFor(row,ctx));
console.log(JSON.stringify({scope:'OFFLINE_NATIVE_VALIDATOR_SHAPES',status:'PASS',registered:259,realIdEncoding:'NOT_RUN_REQUIRES_SEEDED_SERVICE_IDS',dispatches:0,signatures:0}));
