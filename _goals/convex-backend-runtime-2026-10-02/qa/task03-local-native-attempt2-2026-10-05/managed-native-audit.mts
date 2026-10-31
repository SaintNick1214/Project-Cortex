import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const q=dirname(fileURLToPath(import.meta.url));const ledger=JSON.parse(readFileSync(resolve(q,'path-ledger.json'),'utf8'));
const expected=new Map(ledger.cases.map((row:any)=>[row.path,{kind:row.kind,visibility:row.visibility}]));
const helperKinds:any={'qualificationOwned:seed':'mutation','qualificationOwned:snapshot':'query','qualificationOwned:cleanup':'mutation','qualificationOwned:ownedTombstones':'query','qualificationOwned:discoverOwnedEffects':'query','qualificationOwned:storageSnapshot':'query','qualificationOwned:storageCatalog':'query','qualificationOwned:registerStorage':'mutation','qualificationOwned:storeTiny':'action','qualificationOwned:cleanupStorage':'mutation','qualificationDelta:allocateDeletedAttemptId':'mutation','qualificationDelta:policySnapshot':'query'};
for(const [path,kind] of Object.entries(helperKinds))expected.set(path,{kind,visibility:'internal'});
const rows:any[]=[];
for(const name of new Set([...expected.keys()].map((path:any)=>path.split(':')[0]))){const exported=await import(pathToFileURL(resolve(q,'managed-fixture/fixture/convex/'+name+'.ts')).href);for(const [symbol,value] of Object.entries(exported) as any){const kind=value?.isQuery?'query':value?.isMutation?'mutation':value?.isAction?'action':undefined;if(!kind)continue;const path=name+':'+symbol,visibility=value.isInternal?'internal':value.isPublic?'public':'unknown';assert.deepEqual({kind,visibility},expected.get(path),path);rows.push({path,kind,visibility,args:JSON.parse(value.exportArgs())});}}
assert.deepEqual(rows.map(row=>row.path).sort(),[...expected.keys()].sort());assert.equal(rows.length,287);assert.equal(rows.filter(row=>row.visibility==='public').length,200);assert.equal(rows.filter(row=>row.visibility==='internal').length,87);
const schema=await import(pathToFileURL(resolve(q,'managed-fixture/fixture/convex/schema.ts')).href);assert.equal(Object.keys(schema.default.tables).length,31);
writeFileSync(resolve(q,'managed-native-registration-schemas.json'),JSON.stringify({status:'OFFLINE_NATIVE_EXPORT_OBJECTS_OBSERVED',registrationCount:rows.length,public:200,internal:87,productRegistered:275,fixtureHelpers:12,tables:31,actualManagedPublication:'NOT_RUN',rows},null,2)+'\n');
console.log(JSON.stringify({status:'PASS',registered:287,productRegistered:275,fixtureOnlyInternal:12,tables:31,actualManagedPublication:'NOT_RUN',externalRequests:0}));
