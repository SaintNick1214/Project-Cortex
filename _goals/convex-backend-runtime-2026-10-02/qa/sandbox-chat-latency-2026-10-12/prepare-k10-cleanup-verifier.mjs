import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const q=path.dirname(new URL(import.meta.url).pathname);
let source=await fs.readFile(q+'/verify-k9-cleanup.mjs','utf8');
for(const [oldValue,newValue] of [['e8cccbc7-fc49-44ef-a61a-d12ca169d472','0243a635-96dc-4c03-a2b1-34fbcc8a6e63'],['hushed-cobra-213','warmhearted-mallard-13'],['6136804','6144705'],['k9-cleanup-final.json','k10-cleanup-final.json']]){
  assert.ok(source.includes(oldValue));source=source.replaceAll(oldValue,newValue);
}
await fs.writeFile(q+'/verify-k10-cleanup.mjs',source,{flag:'wx'});
console.log(JSON.stringify({prepared:true,serviceActions:false,source:'verify-k9-cleanup.mjs',changes:'Exact session/name/id and output receipt only'}));
