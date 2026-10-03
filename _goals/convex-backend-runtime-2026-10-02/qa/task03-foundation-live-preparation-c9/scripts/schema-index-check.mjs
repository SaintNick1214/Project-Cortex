/** All native table definitions, exact index names and normalized native configurations. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { fixture, sourcePreflight } from './guard.mjs';
export function inspectSchema(schema){
 const duplicates=[],names=[];let indexes=0,normalDbIndexes=0,searchVectorIndexes=0,stagedDbIndexes=0;
 for(const [table,definition] of Object.entries(schema.tables)){
  const byName=new Map(),byConfiguration=new Map();
  for(const [property,kind] of [['indexes','db'],['stagedDbIndexes','db'],['searchIndexes','search'],['stagedSearchIndexes','search'],['vectorIndexes','vector'],['stagedVectorIndexes','vector']])for(const index of definition[property]??[]){
   assert.equal(typeof index.indexDescriptor,'string');const name=index.indexDescriptor;indexes++;if(property==='indexes')normalDbIndexes++;else if(property==='stagedDbIndexes')stagedDbIndexes++;else searchVectorIndexes++;names.push({table,name,kind});
   if(byName.has(name))duplicates.push({table,kind:'name',indexes:[byName.get(name),name]});else byName.set(name,name);
   let config;
   if(kind==='db'){assert.ok(Array.isArray(index.fields));const fields=[...index.fields];if(fields.at(-1)!=='_creationTime')fields.push('_creationTime');config={fields};}
   else continue;
   const signature=JSON.stringify([kind,config]);if(byConfiguration.has(signature))duplicates.push({table,kind:'configuration',indexes:[byConfiguration.get(signature),name],configuration:config});else byConfiguration.set(signature,name);
  }
 }
 return {tables:Object.keys(schema.tables).length,indexes,normalDbIndexes,stagedDbIndexes,searchVectorIndexes,duplicates,names};
}
sourcePreflight();
const priorHelper=readFileSync(resolve(fixture,'../task03-foundation-live-fixture-c2/fixture/convex/qualificationOwned.ts'),'utf8');
const helper=readFileSync(resolve(fixture,'fixture/convex/qualificationOwned.ts'),'utf8');
const removedAlias='ctx.db.query("artifacts").withIndex("by_runtime_scope"';
assert.equal(priorHelper.split(removedAlias).length,2);
assert.equal(helper,priorHelper.replace(removedAlias,'ctx.db.query("artifacts").withIndex("by_tenant_space"'),'Only artifact tenant-first index name changes in fixture helper');
const module=await import(pathToFileURL(resolve(fixture,'fixture/convex/schema.ts')));const schema=module.default.default??module.default;const observed=inspectSchema(schema);
const priorModule=await import(pathToFileURL(resolve(fixture,'../task03-foundation-live-fixture-c2/fixture/convex/schema.ts')));const prior=priorModule.default.default??priorModule.default;
for(const [table,definition] of Object.entries(schema.tables))for(const property of ['searchIndexes','stagedSearchIndexes','vectorIndexes','stagedVectorIndexes'])assert.deepEqual(definition[property],prior.tables[table][property],'Search/vector native definitions remain unchanged');

 assert.equal(observed.tables,26);assert.deepEqual(observed.duplicates,[],'Every current native table/index must be deployable without duplicate configuration');
 assert.equal(inspectSchema({tables:{probe:{indexes:[{indexDescriptor:'one',fields:['tenantId']},{indexDescriptor:'two',fields:['tenantId','_creationTime']}]}}}).duplicates.length,1);
 assert.equal(inspectSchema({tables:{probe:{indexes:[{indexDescriptor:'one',fields:['tenantId']},{indexDescriptor:'one',fields:['memorySpaceId']}]}}}).duplicates.length,1);
 console.log(JSON.stringify({scope:'OFFLINE_FULL_NATIVE_SCHEMA_INDEX_UNIQUENESS',status:'PASS',tables:observed.tables,allIndexes:observed.indexes,normalDbIndexes:observed.normalDbIndexes,searchVectorIndexes:observed.searchVectorIndexes,stagedDbIndexes:observed.stagedDbIndexes,searchVectorDefinitionsPreserved:true,fixtureHelperSoleIndexSubstitutionVerified:true,normalConfigurationDuplicates:0,negativeControls:2,serviceCalls:0,signatures:0}));
