/** Saved canonical CLI observations only; no service or private credential access. */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {K17_PINS,requireK17ReadyPins} from './k17-collector-pins.mjs';
requireK17ReadyPins();
const q=new URL('.',import.meta.url);
const raw=await fs.readFile(new URL('k17-cli-first.typescript',q));
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
for(const runId of K17_PINS.runIds.slice(2))assert.ok(text.includes(`Run ${runId}: complete; memory pending; graph not_requested`));
const receipt={observedAt:new Date().toISOString(),repository:'SaintNick1214/Project-Cortex',sourceCommit:K17_PINS.sourceCommit,sessionId:K17_PINS.sessionId,target:K17_PINS.name,id:K17_PINS.targetId,
  condition:'Canonical Basic after two indexed browser turns; IAB signed out and closed before CLI; same-conversation first then warm; native all-four proof after both CLI turns.',commands,events,originalDeadlineMs:30000,deadlineFailure:false,processExit:0,paidRetry:false,
  sourceReceipt:{path:'k17-cli-first.typescript',bytes:raw.length,sha256:createHash('sha256').update(raw).digest('hex')},
  clock:'Client monotonic first stdout-write acknowledgement; separate from backend transaction stamps and browser after-paint markers.',
  nativeMemoryReceipt:null,subsecondAccepted:false};
await fs.writeFile(new URL('k17-cli-pure-timing.json',q),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({commands,events:events.length,processExit:0,subsecondAccepted:false}));
