import fs from 'node:fs/promises';
import path from 'node:path';
const q=path.dirname(new URL(import.meta.url).pathname);
const status=JSON.parse(await fs.readFile(q+'/status.json','utf8'));
status.actualSampleHistory??=[];
if(status.actualSamples.generation!=='K10')status.actualSampleHistory.push(status.actualSamples);
status.actualSamples={generation:'K10',sourceCommit:'6eb45386fb146be330c5c58419e840015b4e936d',
  browserFirstAfterPaintMs:11181.899999976158,browserWarmAfterPaintMs:9365.100000023842,
  browserLatencyMeasured:true,browserResponses:'COMPLETE',browserNativeMemory:'4/4 positive facts/vectors/current authority/full native usage PASS',
  cliFirstStdoutAcknowledgedMs:15456.622757000005,cliWarmFirstStdoutAcknowledgedMs:null,
  cliWarmOutcome:'waiting_approval; no first text before approval; not a comparable no-tool TTFT sample',cliDeadlineFailure:false,originalDeadlineMs:30000,
  cliRecovery:'No resubmission: active browser disconnect/reconnect of same waiting-approval run, one approved memory_remember, canonical CLW30 COMPLETE',
  originalCliMemoryVerdict:'FAIL: two-message expected sequence excludes approved tool event8; user7/tool8/assistant9 actually contiguous',
  readiness:{factsThrough:9,vectorsThrough:9,graphRequired:false},
  subsecondAccepted:false,requiredIntegrationAccepted:false,
  priorAuthenticationExpectedCodeFailures:{generation:'K9',failures:['expired valid signature → AUTHENTICATION_TIMEOUT','invalid signature → AUTHENTICATION_TIMEOUT'],notRerun:true},
  receipts:['browser/k10-first-warm-events.json','browser/k10-complete-tool-readiness.json','browser/k10-active-reconnect.json',
    'k10-cli-timing-and-approval.json','k10-cli-memory-native-v2-first-warm-verification-1791915587703.json','cloud-k10-delay-chain.md','k10-financial-metadata-1791915701228.json']};
status.phase='K10 actual cloud browser/CLI/tool/reconnect completed; subsecond target unmet; cleanup and tool-inclusive independent supplement pending';
status.updatedAt=new Date().toISOString();
status.browserPrerequisite={surface:'Root IAB actual K10 QA executed; closed after verified signout clearing',osClipboard:'untouched',evidence:'browser/k10-signout-cleared.json'};
status.pendingRepairs=['Fresh Agent-only resolution composition measured from model preparation prefix','Installed successor cloud latency and applicable functional checks','Under1000ms goal and final independent audit remain incomplete'];
const refinement=status.refinements.find(item=>item.name.toLowerCase().includes('separat'));
if(refinement){refinement.sourceGate='PASS4.0';refinement.sourcePercent=100;refinement.review='cloud-context-transaction-separation-review.md';refinement.liveIntegration='K10 native separate context step and initial/resume wrappers had no saved OCC retries; browser11.18/9.37s still fail target';}
status.currentEnvironment.financialSnapshot='k10-financial-metadata-1791915701228.json';
await fs.writeFile(q+'/status.json',JSON.stringify(status,null,2)+'\n');
const milestone={observedAt:status.updatedAt,scope:status.scope,milestone:'K10 native cloud browser/CLI/tool/reconnect and governed accounting observations',complete:2,total:4,percent:50,
  sourceRefinementPercent:100,subsecondAccepted:false,requiredIntegrationAccepted:false,finalAuditAccepted:false,originalCliMemoryFailurePreserved:true,
  finance:{nativeAttempts:33,activeSlots:0,allSlotsReleased:true,reservationCeilingsUnits:5200000,chargesUnknown:true}};
await fs.appendFile(q+'/completion-notices.jsonl',JSON.stringify(milestone)+'\n');
console.log(JSON.stringify(milestone));
