import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const q=path.dirname(new URL(import.meta.url).pathname);
const raw=await fs.readFile(q+'/k10-cli-first.typescript');
const events=[...raw.toString().matchAll(/\{"type":"cortex-(?:cli|client)-latency"[^\r\n]*\}/g)].map(m=>JSON.parse(m[0]));
const first=events.find(e=>e.type==='cortex-cli-latency'&&e.commandId===1&&e.phase==='answer.first_printed');
assert.ok(first&&Number.isFinite(first.durationMs));
assert.equal(events.some(e=>e.type==='cortex-cli-latency'&&e.commandId===2&&e.phase==='answer.first_printed'),false);
assert.ok(raw.toString().includes('Tool approvals:'));
assert.ok(raw.toString().includes(': waiting_approval;'));
assert.equal(/REQUEST_DEADLINE_EXCEEDED|RPC_DEADLINE_EXCEEDED/.test(raw.toString()),false);
const receipt={observedAt:new Date().toISOString(),sessionId:'0243a635-96dc-4c03-a2b1-34fbcc8a6e63',target:'warmhearted-mallard-13',id:6144705,sourceCommit:'6eb45386fb146be330c5c58419e840015b4e936d',
  condition:'Canonical Basic after two indexed browser turns. First memory verified before warm. Browser later attached as an observer; warm requested a backend tool approval.',
  commands:[{commandId:1,firstStdoutAcknowledgedMs:first.durationMs,originalDeadlineMs:30000},{commandId:2,firstStdoutAcknowledgedMs:null,outcome:'waiting_approval',deadlineFailure:false,comparableTextLatencySample:false}],
  events,processExit:0,paidRetry:false,originalDeadlineMs:30000,deadlineFailure:false,
  subsequentOutcome:{sameRun:true,activeBrowserDisconnectReconnect:true,toolApprovalCount:1,backendTool:'memory_remember',toolSucceeded:true,canonicalResponseComplete:true,browserReceipt:'browser/k10-complete-tool-readiness.json'},
  sourceReceipt:{path:'k10-cli-first.typescript',bytes:raw.length,sha256:createHash('sha256').update(raw).digest('hex')},
  clock:'Original CLI monotonic first stdout-write acknowledgement; independent of server Date.now and browser paint markers. Human/tool approval pause is not a comparable no-tool TTFT.',
  originalMemoryReceipt:'k10-cli-memory-native-v2-first-warm-verification-1791915587703.json',originalMemoryVerdict:'FAIL: original two-message sequence assertion does not include the additional approved tool event',subsecondAccepted:false};
await fs.writeFile(q+'/k10-cli-timing-and-approval.json',JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({commands:receipt.commands,events:events.length,processExit:0,paidRetry:false}));
