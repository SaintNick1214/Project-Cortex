import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {assembleCatalog,appendExistingCatalog,stableJson} from '../../../../../packages/cortex-templates/scripts/assemble.mjs';
const root = '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion';
const pkg = path.join(root,'packages/cortex-templates');
const source = path.join(root,'packages/cortex-cli/templates/chat-sdk-quickstart');
const qa = path.dirname(new URL(import.meta.url).pathname);
const before = JSON.parse(await fs.readFile(path.join(pkg,'catalog.json'),'utf8'));
const version = JSON.parse(await fs.readFile(path.join(source,'package.json'),'utf8')).version;
if(version !== '1.4.1' || before.templates.some(t=>t.id==='chat-sdk' && t.version===version)) throw Error('New patch tuple required');
const env = await fs.readFile(path.join(source,'.env.local.example'),'utf8');
const assembly = await assembleCatalog([{id:'chat-sdk',version,source,manager:'pnpm',provenance:`packages/cortex-cli/templates/chat-sdk-quickstart@${version}`,envExamples:['.env.local.example'],envNames:[...new Set([...env.matchAll(/^([A-Z][A-Z0-9_]*)\s*=/gm)].map(m=>m[1]))].sort(),backend:true,graph:true}],before.version);
const merged = await appendExistingCatalog(assembly,pkg);
for(const old of before.templates){
  if(stableJson(old)!==stableJson(merged.catalog.templates.find(t=>t.id===old.id&&t.version===old.version))) throw Error('Existing tuple changed');
}
const prefix=`payloads/chat-sdk/${version}/`;
let files=0;
for(const [relative,file] of assembly.payloads){
  if(!relative.startsWith(prefix)) throw Error('Unselected output');
  const dest=path.join(pkg,relative);
  await fs.mkdir(path.dirname(dest),{recursive:true});
  await fs.writeFile(dest,file.bytes,{flag:'wx',mode:file.executable?0o755:0o644});
  files++;
}
const temporary = path.join(pkg,'.catalog-chat-patch.json');
await fs.writeFile(temporary,merged.catalogBytes,{flag:'wx'});
await fs.rename(temporary,path.join(pkg,'catalog.json'));
const original = JSON.parse(await fs.readFile(path.join(qa,'immutable-payload-baseline1.json'),'utf8'));
for(const [relative,hash] of Object.entries(original.files)){
  if(createHash('sha256').update(await fs.readFile(path.join(pkg,'payloads',relative))).digest('hex')!==hash) throw Error('Historical payload changed');
}
const receipt={recordedAt:new Date().toISOString(),operation:'Append only new ChatSDK1.4.1 payload files and catalog metadata; no existing payload path written.',newTuple:`chat-sdk@${version}`,newFiles:files,priorTupleCount:before.templates.length,priorTuplesUnchanged:true,historicalFilesUnchanged:Object.keys(original.files).length,catalogHash:merged.receipt.catalogHash,newSourceReceipt:assembly.receipt.templates[0]};
await fs.writeFile(path.join(qa,'chat-patch-assembly1.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({...receipt,newSourceReceipt:undefined}));
