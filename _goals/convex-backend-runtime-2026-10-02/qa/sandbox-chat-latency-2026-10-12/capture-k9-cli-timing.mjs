import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const q=path.dirname(new URL(import.meta.url).pathname);
const raw=await fs.readFile(q+'/k9-cli-first.typescript');
const events=[...raw.toString().matchAll(/\{"type":"cortex-(?:cli|client)-latency"[^\r\n]*\}/g)].map(m=>JSON.parse(m[0]));
const commands=[];
for(const commandId of [1,2]){
 const parts=events.filter(e=>e.type==='cortex-cli-latency'&&e.commandId===commandId);
 const submit=parts.find(e=>e.phase==='submit.begin'),first=parts.find(e=>e.phase==='answer.first_printed');
 assert.ok(submit&&first);assert.ok(Number.isFinite(first.durationMs));
 commands.push({commandId,firstStdoutAcknowledgedMs:first.durationMs,method:submit.method});
}
assert.equal(/REQUEST_DEADLINE_EXCEEDED|RPC_DEADLINE_EXCEEDED/.test(raw.toString()),false);
const receipt={observedAt:new Date().toISOString(),sessionId:'e8cccbc7-fc49-44ef-a61a-d12ca169d472',target:'hushed-cobra-213',id:6136804,sourceCommit:'ae9a836ff9c5e6a0ce9a279bdbdb96ad37c2a448',condition:'Canonical Basic after two indexed browser turns, before negative QA; first then same-conversation warm after native first-memory verification',commands,events,originalDeadlineMs:30000,deadlineFailure:false,processExit:0,paidRetry:false,sourceReceipt:{path:'k9-cli-first.typescript',bytes:raw.length,sha256:createHash('sha256').update(raw).digest('hex')},clock:'Original client monotonic first stdout-write acknowledgement; independent of server Date.now and browser double-animation-frame markers',memoryReceipt:'k9-cli-memory-native-v2-first-warm-verification-1791894197833.json',subsecondAccepted:false};
await fs.writeFile(q+'/k9-cli-first-warm-timing.json',JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({commands,deadlineFailure:false,processExit:0,events:events.length}));
