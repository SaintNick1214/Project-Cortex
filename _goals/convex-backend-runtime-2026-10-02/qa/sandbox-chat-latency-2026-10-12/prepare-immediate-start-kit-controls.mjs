import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const p='/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs';
const q=path.dirname(new URL(import.meta.url).pathname);
const oldKit=p+'/manual-sandbox-latency-authority-routing-2026-10-13';
const kit=p+'/manual-sandbox-latency-immediate-start-2026-10-13';
const digest=x=>createHash('sha256').update(x).digest('hex');
await fs.mkdir(kit,{recursive:false});
await fs.mkdir(kit+'/image',{recursive:false});
await fs.mkdir(kit+'/image/archives',{recursive:false});
const controls=[];
for(const relative of ['prepare.mjs','image/Dockerfile','image/install-candidates.mjs','image/entrypoint.mjs']){
  const original=oldKit+'/'+relative,stat=await fs.lstat(original);
  assert.ok(stat.isFile()&&!stat.isSymbolicLink()&&stat.uid===process.getuid());
  const oldBytes=await fs.readFile(original);
  let bytes=oldBytes;
  if(relative==='prepare.mjs'){
    const oldText=oldBytes.toString(),oldFragment='/kit-checks-authority-routing';
    assert.equal(oldText.split(oldFragment).length,2);
    bytes=Buffer.from(oldText.replace(oldFragment,'/kit-checks-immediate-start'));
  }
  await fs.writeFile(kit+'/'+relative,bytes,{flag:'wx',mode:stat.mode&0o777});
  controls.push({path:relative,bytes:bytes.length,oldSha256:digest(oldBytes),newSha256:digest(bytes),change:relative==='prepare.mjs'?'QA output directory only':'byte-identical'});
}
const receipt={observedAt:new Date().toISOString(),scope:'Fresh four-control kit setup only; no source snapshot/build/pack/service/inference',oldKit,kit,controls,archiveCopy:false,stageCopy:false,identityCreated:false};
await fs.writeFile(q+'/immediate-start-kit-control-baseline.json',JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({kit,controls:controls.length,archivesCopied:0,sourceSnapshotCreated:false}));
