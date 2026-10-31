/** Saved canonical CLI observations only; no service or private credential access. */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const q=new URL('.',import.meta.url);
const raw=await fs.readFile(new URL('k14-cli-first.typescript',q));
const text=raw.toString();
const events=[...text.matchAll(/\{"type":"cortex-(?:cli|client)-latency"[^\r\n]*\}/g)].map(match=>JSON.parse(match[0]));
const commands=[1,2].map(commandId=>{
  const selected=events.filter(event=>event.type==='cortex-cli-latency'&&event.commandId===commandId);
  const submit=selected.find(event=>event.phase==='submit.begin');
  const first=selected.find(event=>event.phase==='answer.first_printed');
  assert.ok(submit&&first);assert.ok(Number.isFinite(first.durationMs));
  assert.ok(Math.abs(first.atMs-submit.atMs-first.durationMs)<0.01);
  return {commandId,method:submit.method,firstStdoutAcknowledgedMs:first.durationMs};
});
assert.equal(/REQUEST_DEADLINE_EXCEEDED|RPC_DEADLINE_EXCEEDED/.test(text),false);
for(const runId of ['run:f600e0263131135d6c0f752963aa1e572c3415405b097747406c4dee2356e43d','run:68ee2464ec0a49342521a1cddc862ac6f36ae21a78aeb8b01e1fb458cd1904fe'])assert.ok(text.includes(`Run ${runId}: complete; memory pending; graph not_requested`));
const receipt={observedAt:new Date().toISOString(),repository:'SaintNick1214/Project-Cortex',sourceCommit:'8917f3250fc50aa7f30f5cd727aaf279709a2ef2',sessionId:'e07fd8cd-4f0b-4ceb-833c-15b167bda97f',target:'mild-eagle-107',id:6150945,
  condition:'Canonical Basic after two indexed browser turns; IAB signed out and closed before CLI; same-conversation first then warm; native all-four proof after both CLI turns.',commands,events,originalDeadlineMs:30000,deadlineFailure:false,processExit:0,paidRetry:false,
  sourceReceipt:{path:'k14-cli-first.typescript',bytes:raw.length,sha256:createHash('sha256').update(raw).digest('hex')},
  clock:'Client monotonic first stdout-write acknowledgement; separate from backend transaction stamps and browser after-paint markers.',
  nativeMemoryReceipt:null,subsecondAccepted:false};
await fs.writeFile(new URL('k14-cli-pure-timing.json',q),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({commands,events:events.length,processExit:0,subsecondAccepted:false}));
