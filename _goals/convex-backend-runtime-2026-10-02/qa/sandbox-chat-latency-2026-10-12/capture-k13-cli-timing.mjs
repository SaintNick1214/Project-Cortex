/** Saved canonical CLI observations only; no service or private credential access. */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const q=new URL('.',import.meta.url);
const raw=await fs.readFile(new URL('k13-cli-first.typescript',q));
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
for(const runId of ['run:f648349509e350597d65e8c269158bd576e92c18248ea63bfc11c00a889640b9','run:0fe32622ab2d45c511994e5249a8afc18d77e44799d0c10dda1802858f06de77'])assert.ok(text.includes(`Run ${runId}: complete; memory pending; graph not_requested`));
const receipt={observedAt:new Date().toISOString(),repository:'SaintNick1214/Project-Cortex',sourceCommit:'eb8c4c03a2457b79d3b7129a7e7af8da3ecd67bd',sessionId:'90c168d7-c872-4e13-872a-808673687f18',target:'reminiscent-gazelle-386',id:6149177,
  condition:'Canonical Basic after two indexed browser turns; IAB signed out and closed before CLI; same-conversation first then warm; native all-four proof after both CLI turns.',commands,events,originalDeadlineMs:30000,deadlineFailure:false,processExit:0,paidRetry:false,
  sourceReceipt:{path:'k13-cli-first.typescript',bytes:raw.length,sha256:createHash('sha256').update(raw).digest('hex')},
  clock:'Client monotonic first stdout-write acknowledgement; separate from backend transaction stamps and browser after-paint markers.',
  nativeMemoryReceipt:'k13-memory-native-v2-four-run-verification-1791927604019.json',subsecondAccepted:false};
await fs.writeFile(new URL('k13-cli-pure-timing.json',q),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({commands,events:events.length,processExit:0,subsecondAccepted:false}));
