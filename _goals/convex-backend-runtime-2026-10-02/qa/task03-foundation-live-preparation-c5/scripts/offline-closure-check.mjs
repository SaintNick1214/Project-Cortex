import assert from 'node:assert/strict';
import schema from '../../../../../convex-dev/schema.ts';
import { seedClosureFixtures } from './closure-fixtures.mjs';
import { validate } from './offline-arguments-check.mjs';
const run='foundation-'+'b'.repeat(32),collected=[];
await seedClosureFixtures({run,scopes:{tenantId:run+':tenantA',memorySpaceId:run+':spaceA'},users:{reader:run+':reader',foreign:run+':foreign'},principals:{reader:'OFFLINE_PRINCIPAL_READER',foreign:'OFFLINE_PRINCIPAL_FOREIGN'},files:[{id:'OFFLINE_STORAGE_OWNED'},{id:'OFFLINE_STORAGE_FOREIGN'}],seed:async rows=>{collected.push(...rows);return rows.map((row,i)=>({table:row.table,id:'OFFLINE_ROW_'+i}));}});
assert.equal(collected.length,12);for(const row of collected)validate(schema.tables[row.table].validator.json,row.value);
console.log(JSON.stringify({scope:'OFFLINE_CURRENT_TABLE_SHAPES',status:'PASS',rows:12,tables:4,realIds:'NOT_RUN_REQUIRES_OWNED_SERVICE_IDS',dispatches:0,signatures:0}));
