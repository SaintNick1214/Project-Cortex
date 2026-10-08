import assert from 'node:assert/strict';import {readFileSync,writeFileSync,mkdirSync,cpSync,rmSync,symlinkSync,linkSync} from 'node:fs';import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';import {createHash,randomUUID} from 'node:crypto';
const repo='/workspace/Project-Cortex',base=resolve(repo,'work/resume/task04-terminal-capture-native-profiles-c3-review'),subject=resolve(repo,'_goals/convex-backend-runtime-2026-10-02/qa/task04-terminal-capture-native-extension-preparation-c3'),generation=randomUUID(),oldPath='_goals/convex-backend-runtime-2026-10-02/qa/task04-terminal-capture-parent-inputs-c7-review',sha=b=>createHash('sha256').update(b).digest('hex'),results=[];
for(const label of ['extension','regression']){const p=label==='extension'?subject:resolve(subject,'regression'),original=readFileSync(resolve(p,'scripts/guard.mjs'),'utf8'),packet=JSON.parse(readFileSync(resolve(p,'historical-preservation.json'))).packets.find(x=>x.path===oldPath),indexName='historical-parent-c7-review-full-index.json';
 for(const name of ['healthy','no-supplement','wrong-index-path','supplement-hash','unknown-packet','original80-drift','original-index-drift','extra-file','missing-file','duplicate-index','reorder-index','drop-original-row','replace-addition','wrong-schema','symlink-file','hardlink-file','dropped-old-self']){
  const tree=resolve(base,'hostiles',generation,label,name),root=resolve(tree,'profile'),hist=resolve(tree,oldPath);mkdirSync(root,{recursive:true});cpSync(resolve(repo,oldPath),hist,{recursive:true});cpSync(resolve(p,indexName),resolve(root,indexName));const row=structuredClone(packet),idx=JSON.parse(readFileSync(resolve(root,indexName))),known=idx.files.find(x=>!x.path.startsWith('source-preimages/'));
  const reindex=()=>{const b=Buffer.from(JSON.stringify(idx,null,2)+'\n');writeFileSync(resolve(root,indexName),b);row.fullClosure.bytes=b.length;row.fullClosure.sha256=sha(b);};
  if(name==='no-supplement')delete row.fullClosure;
  if(name==='wrong-index-path')row.fullClosure.path='elsewhere.json';
  if(name==='supplement-hash')row.fullClosure.sha256='0'.repeat(64);
  if(name==='unknown-packet'){row.path='_goals/unknown';cpSync(hist,resolve(tree,row.path),{recursive:true});}
  if(name==='original80-drift')writeFileSync(resolve(hist,known.path),'drift');
  if(name==='original-index-drift')writeFileSync(resolve(hist,'qa-manifest.json'),'{}');
  if(name==='extra-file')writeFileSync(resolve(hist,'extra'),'x');
  if(name==='missing-file')rmSync(resolve(hist,known.path));
  if(name==='duplicate-index'){idx.files[1]=idx.files[0];reindex();}
  if(name==='reorder-index'){idx.files.reverse();reindex();}
  if(name==='drop-original-row'){idx.files.splice(idx.files.findIndex(x=>x.path===known.path),1);reindex();}
  if(name==='replace-addition'){idx.files.find(x=>x.path.includes('qa-manifest.json')).path='zzz';idx.files.sort((a,b)=>a.path<b.path?-1:1);reindex();}
  if(name==='wrong-schema'){idx.extra=true;reindex();}
  if(name==='symlink-file'){const f=resolve(hist,known.path),b=readFileSync(f);rmSync(f);writeFileSync(resolve(root,'linked'),b);symlinkSync(resolve(root,'linked'),f);}
  if(name==='hardlink-file'){linkSync(resolve(hist,known.path),resolve(root,'hardlinked'));}
  if(name==='dropped-old-self')rmSync(resolve(hist,'qa-manifest.json'));
  const s=original.replace(/export const root=.*?fixture=resolve\(root,'fixture'\);/s,`export const root=${JSON.stringify(root)},repo=${JSON.stringify(tree)},fixture=resolve(root,'fixture');`).replace(/export const scratch=.*?;/,`export const scratch=${JSON.stringify(resolve(tree,'scratch'))};`),file=resolve(root,'guard.mjs');writeFileSync(file,s);const mod=await import(pathToFileURL(file));let err=null,result;try{result=mod.verifyHistoricalPacket(row);}catch(e){err=e.message;}if(name==='healthy')assert.deepEqual(result,{originalRows:80,completeRows:83});else assert.ok(err,name);results.push({profile:label,name,status:'PASS',observedError:err,sourceSHA256:sha(original),adaptedSHA256:sha(s)});
 }
 // Source-bound supplement cannot be modified while keeping accepted freeze.
 const tree=resolve(base,'hostiles',generation,label,'source-freeze'),root=resolve(tree,'profile');mkdirSync(root,{recursive:true});const freeze=JSON.parse(readFileSync(resolve(p,'runtime-freeze.json')));for(const row of freeze.files){const dest=resolve(root,row.path);mkdirSync(resolve(dest,'..'),{recursive:true});cpSync(resolve(p,row.path),dest);}cpSync(resolve(p,'runtime-freeze.json'),resolve(root,'runtime-freeze.json'));
 const s=original.replace(/export const root=.*?fixture=resolve\(root,'fixture'\);/s,`export const root=${JSON.stringify(root)},repo=${JSON.stringify(repo)},fixture=resolve(root,'fixture');`);writeFileSync(resolve(root,'scripts/guard.mjs'),s);const gRow=freeze.files.find(x=>x.path==='scripts/guard.mjs');gRow.sha256=sha(s);writeFileSync(resolve(root,'runtime-freeze.json'),JSON.stringify(freeze));writeFileSync(resolve(root,indexName),readFileSync(resolve(root,indexName),'utf8')+' ');const mod=await import(pathToFileURL(resolve(root,'scripts/guard.mjs')));assert.throws(()=>mod.sourcePreflight(),/QA_SOURCE_DRIFT/);results.push({profile:label,name:'source-freeze-supplement-bypass',status:'PASS',observedError:'QA_SOURCE_DRIFT'});
}
console.log(JSON.stringify({tests:results.length,passed:results.length,failed:0,skipped:0,todo:0,results},null,2));
