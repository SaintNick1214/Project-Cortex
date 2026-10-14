import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {assembleCatalog,stableJson,hashBytes} from '../../../../packages/cortex-templates/scripts/assemble.mjs';
const root=process.cwd(),qa=path.dirname(new URL(import.meta.url).pathname),base=path.join(root,'packages/cortex-templates'),source=path.join(root,'packages/cortex-cli/templates/basic');
const oldBytes=await fs.readFile(path.join(base,'catalog.json')),old=JSON.parse(oldBytes);
assert.equal(old.version,'1.3.2');assert.equal(old.templates.length,14);assert.ok(!old.templates.some(t=>t.id==='basic'&&t.version==='1.4.2'));
const example='.env.local.example',env=await fs.readFile(path.join(source,example),'utf8');
const assembly=await assembleCatalog([{id:'basic',manager:'npm',version:'1.4.2',source,provenance:'packages/cortex-cli/templates/basic@1.4.2',envExamples:[example],envNames:[...new Set([...env.matchAll(/^([A-Z][A-Z0-9_]*)\s*=/gm)].map(m=>m[1]))].sort(),backend:true,graph:true}],'1.3.3');
assert.equal(assembly.catalog.templates.length,1);
const newDirectory=path.join(base,'payloads/basic/1.4.2');await fs.mkdir(newDirectory);
const written=[];
try{
 for(const [relative,file] of assembly.payloads){
  assert.ok(relative.startsWith('payloads/basic/1.4.2/'));const target=path.join(base,relative);
  await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,file.bytes,{flag:'wx',mode:file.executable?0o755:0o644});written.push(relative);
 }
 const catalog={...old,version:'1.3.3',templates:[...old.templates,...assembly.catalog.templates].sort((a,b)=>`${a.id}@${a.version}`.localeCompare(`${b.id}@${b.version}`,'en'))};
 for(const entry of old.templates)assert.equal(stableJson(catalog.templates.find(t=>t.id===entry.id&&t.version===entry.version)),stableJson(entry));
 const bytes=Buffer.from(stableJson(catalog)+'\n');await fs.writeFile(path.join(base,'catalog.json'),bytes);
 await fs.writeFile(path.join(qa,'k25-basic-catalog-append-receipt.json'),JSON.stringify({oldVersion:'1.3.2',newVersion:'1.3.3',oldDescriptorsPreserved:14,newDescriptors:1,total:15,basicVersion:'1.4.2',oldCatalogSha256:hashBytes(oldBytes),newCatalogSha256:hashBytes(bytes),newPayload:assembly.catalog.templates[0],sourceReceipt:assembly.receipt,onlyNewPayloadFilesWritten:written,oldPayloadsWritten:0,oldPayloadsCopied:0,serviceCalls:0},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({descriptors:15,oldPreserved:14,newFiles:written.length,oldPayloadWrites:0}));
}catch(error){await fs.rm(newDirectory,{recursive:true,force:true});throw error;}
