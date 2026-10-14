import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const qa=path.dirname(fileURLToPath(import.meta.url));
const root=execFileSync('git',['rev-parse','--show-toplevel'],{cwd:qa,encoding:'utf8'}).trim();
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const build=JSON.parse(fs.readFileSync(path.join(qa,'docs-k28-actual-build-v3.json')));
assert.equal(build.exitCode,0);assert.equal(build.unchanged,true);
const website='/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-docs';
assert.ok(Object.entries(build.hashes).every(([name,digest])=>hash(path.join(website,name))===digest));
const docsReceipt={observedAt:new Date().toISOString(),repository:'SaintNick1214/cortexmemory.dev',build:'docs-k28-actual-build-v3.json',buildExit:0,sourceHashes:build.hashes,sourceUnchanged:true,render:'docs-k28-actual-render-v3.json',serverExit:130,serverClosed:true,tabId:'61',tabClosed:true,published:false,committed:false,priorTypecheck:'docs-k22-typecheck-v1.log; TypeScript inputs unchanged',patch:'k28-website-documentation-handoff-actual-v3.patch',patchSha256:hash(path.join(qa,'k28-website-documentation-handoff-actual-v3.patch'))};
fs.writeFileSync(path.join(qa,'docs-k28-actual-final-v3.json'),JSON.stringify(docsReceipt,null,2)+'\n',{flag:'wx'});
const relative=p=>path.relative(root,p);
let selected=fs.readdirSync(qa).filter(n=>n.toLowerCase().includes('k28')||n.startsWith('procedure-delivery-plan')).map(n=>path.join(qa,n)).filter(p=>fs.statSync(p).isFile());
for(const sub of ['browser','kit-checks-delivery-plan']){
 for(const name of fs.readdirSync(path.join(qa,sub))){
  const p=path.join(qa,sub,name);
  if(fs.statSync(p).isFile()&&(sub!=='browser'||name.startsWith('k28')))selected.push(p);
 }
}
const localOnly=selected.filter(p=>p.endsWith('.png')||fs.statSync(p).size>512000).map(p=>({path:relative(p),bytes:fs.statSync(p).size,sha256:hash(p),reason:p.endsWith('.png')?'Local-only browser pixels':'Raw evidence exceeds512000byte Git limit; original remains local'}));
const ledger=path.join(qa,'k28-native-local-only-evidence.json');
fs.writeFileSync(ledger,JSON.stringify({observedAt:new Date().toISOString(),files:localOnly,originalsPreserved:true,archiveCopiesCreated:false},null,2)+'\n',{flag:'wx'});
selected=selected.filter(p=>!p.endsWith('.png')&&fs.statSync(p).size<=512000);
selected.push(ledger,...['status.json','completion-notices.jsonl','execution-progress.md','../execution-progress.md'].map(n=>path.resolve(qa,n)));
selected=[...new Set(selected)];
const leaked=selected.filter(p=>/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/.test(fs.readFileSync(p,'utf8')));
assert.deepEqual(leaked,[],'JWT-shaped content cannot be staged');
assert.equal(execFileSync('git',['diff','--cached','--name-only'],{cwd:root,encoding:'utf8'}),'','Preserve any pre-existing staged work');
execFileSync('git',['add','-f','--',...selected.map(relative)],{cwd:root});
const staged=execFileSync('git',['diff','--cached','--name-only','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
assert.ok(staged.every(n=>n.startsWith('_goals/convex-backend-runtime-2026-10-02/qa/')));
assert.ok(!staged.some(n=>n.endsWith('k11-expired-auth-source-investigation.md')||n.endsWith('workflow-trace-repair-report.md')));
console.log(JSON.stringify({stagedFiles:staged.length,localOnly:localOnly.length,websiteSourceFiles:Object.keys(build.hashes).length,websiteBuildExit:0,coreProductChanges:0,goalPercent:50}));
