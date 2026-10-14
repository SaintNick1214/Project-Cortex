import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const qa=path.dirname(fileURLToPath(import.meta.url));
const read=name=>JSON.parse(fs.readFileSync(path.join(qa,name),'utf8'));
const cleanup=read('k28-cleanup-final.json');
const finance=read('k28-financial-metadata-1792011421540.json');
const tool=read('browser/k28-tool-outcome.json');
assert.equal(cleanup.status,'ABSENT');
assert.equal(cleanup.verification.launcherExit,130);
assert.equal(read('k28-financial-collector-direct-exit.json').exit_code,0);
assert.equal(finance.summary.activeSlots,0);
assert.equal(tool.canonicalReply,'TOOL48');
assert.equal(tool.readiness.facts.indexedThrough,11);
assert.equal(tool.readiness.vectors.indexedThrough,11);
const now=new Date().toISOString();
const status=read('status.json');
status.updatedAt=now;
status.phase='K28 hosted functional checks and independent cleanup complete; latency SLO failed 0/4; next measured backend preparation repair';
status.currentEnvironment.state='CLEANED';
status.currentEnvironment.launcherChildExit=130;
status.currentEnvironment.cleanup='k28-cleanup-final.json';
status.pendingRepairs=[
 'Reduce measured backend pre-dispatch preparation (2087–6949ms) and protected delivery while retaining all current authority/source/accounting predicates and fresh boundaries',
 'Fresh installed hosted sub1000ms and semantic qualification',
 'Unqualified in-plan new-target UPDATE/SUPERSEDE remains disclosed',
 'Independent final audit',
];
status.sourceK28.state='SOURCE_ACCEPTED_NATIVE_FUNCTIONAL_PASS_LATENCY_FAIL_CLEANED';
status.sourceK28.native='FUNCTIONAL_SCOPED_PASS_SLO0_OF4';
status.sourceK28.docs.sourceReview='PASS3.8 for v1 bytes; later actual-results-only refresh separately built/rendered';
Object.assign(status.actualSamplesK28,{
 canonicalMemoryNative:'PASS exact canonical markers4/4 plus45fresh memory checks',
 tool:'PASS ONEsubmit/ONEapproval/ONEeffect/reconnect/finalTOOL48/strictfacts+vectors11of11',
 toolReceipt:'browser/k28-tool-outcome.json',
 auth:'PASS quiet owner+expired+invalid; negativeHTTP401/0protectedRPC/exactinventory+financeunchanged',
 financialSummary:finance.summary,
 financialReceipt:'k28-financial-metadata-1792011421540.json',
 cleanup:'ABSENT independently verified; direct launcher130; exact DB/container/private directories absent',
 cleanupReceipt:'k28-cleanup-final.json',
 fullDelayChain:'k28-four-run-critical-path-readonly.md',
 backendPreparationToMainDispatchMs:[2223,2087,5305,6949],
 modelDispatchToProcessedFirstTextMs:[668,481,497,535],
 processedFirstTextToFirstOutputCommitMs:[637.2,502.9,556.8,1023.2],
 subsecondAccepted:false,
 requiredIntegrationAccepted:false,
});
fs.writeFileSync(path.join(qa,'status.json'),JSON.stringify(status,null,2)+'\n');
const report=`# K28 actual hosted qualification and cleanup\n\nSource a773bd545c22e3c6eeb228b800d4c3a679375c5b in SaintNick1214/Project-Cortex. Three isolated builds, four packs, four real consumer groups, one image,121 launcher tests/dryrun and8 startup qualification calls passed. One independent nonauthor source review PASS3.8 remains a scoped source verdict.\n\nFour ordinary responses completed with independently matching canonical markers4/4. Browser after-paint4379.5/3765.6ms; Basic CLI stdout7704.97/9901.85ms: SLO0/4. Backend trace was enabled/read back before every measured turn. Browser first/warm fitted1/3messages with zero recalled-memory/fact/pending bytes. Native admission-entry to main dispatch2223/2087/5305/6949ms; dispatch to processed first text668/481/497/535ms. Protected output and client observation add further work; nested clocks are not summed. Full exact delay chain is k28-four-run-critical-path-readonly.md.\n\nThe fixed four-run proof passed45fresh checks:6facts across4positive inputs,8matching current-profile vectors, exact source/candidate/native-usage bindings and contiguousfacts/vectors8. Separate ordinary capture/replay/conflict/public recall/isolation passed82actual fresh verifications. ONE public recall3702.19ms (3332.81ms nested RPC) with5scoped items passed. Its actual embedding is about317ms; about2005ms follows embedding readiness. Parent native times/read counts do not identify per-table latency, raw network or provider queue.\n\nQuiet signed SDK authentication negatives returned401/UNAUTHENTICATED,0protectednegativeRPC/payload and unchanged native inventory/finance. ONE approved memory_remember intent survived observer disconnect/reconnect, completed ONE effect and finalTOOL48; strictfacts/vectors11of11 passed. Original initial approval selector failure is retained, with no resubmission or paid retry.\n\nFinance46native attempts,0active slots/all released,6500000UNKNOWN reservation ceiling units. These are not actual charges. All clients closed before ONE exact SIGINT; direct launcher child exited130. Independent k28-cleanup-final.json confirms exact DB6177151 resilient-ptarmigan-738, Docker container and issuer/secrets/workspace/backend directories ABSENT. No production/UnionArena/GitHub work.\n\nInternal native testing+cleanup milestone100%; latency follow-up2/4=50%. Full goal remains incomplete. K27 and earlier failures, missing C7 backing, deferred asynchronous video, optional graph coverage and new-target UPDATE/SUPERSEDE refusal remain explicitly separate.\n`;
fs.writeFileSync(path.join(qa,'k28-actual-outcomes.md'),report,{flag:'wx'});
for(const target of ['execution-progress.md','../execution-progress.md']){
 fs.appendFileSync(path.join(qa,target),'\n\n## '+now+' — K28 native outcomes and cleanup\n\n'+report.split('\n\n').slice(2).join('\n\n'));
}
fs.appendFileSync(path.join(qa,'completion-notices.jsonl'),JSON.stringify({observedAt:now,milestone:'K28 functional native checks and independent exact cleanup complete; SLO0/4 retained',task:'K28 native qualification and cleanup',taskPercent:100,goalPercent:50,goalMetric:'latencyfollowup2/4; not original17task completion',nativeQualified:false})+'\n');
const proofs='/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs';
const sandboxPath=path.join(proofs,'SANDBOX.md');
let sandbox=fs.readFileSync(sandboxPath,'utf8');
sandbox=sandbox.replace('This exact candidate is awaiting hosted qualification. The latest completed prior cloud outcomes below remain separate; the latency target remains unmet.','Hosted functional qualification and exact cleanup passed for this candidate. All four latency samples failed the one-second target; the measured outcomes below remain separate from source acceptance.');
sandbox=sandbox.replace(/The latest completed hosted run, K27,[\s\S]*?For timing,/,`The latest completed hosted run, K28, completed all four ordinary responses with independently matching canonical markers. First visible text took **4.38/3.77 seconds** in the browser and **7.70/9.90 seconds** in Basic CLI: **0/4** met the below1,000ms target. These samples had no earlier tool prefix. Backend trace was enabled and read back before all four turns. Native entry to main model dispatch took2.22/2.09/5.31/6.95seconds; model dispatch to processed first text took0.67/0.48/0.50/0.54seconds. Most delay preceded the main model call, with additional protected output and observation work.\n\nNative proof retained six facts across four positive inputs, eight matching vectors and contiguous indexing through eight ordinary events. Separate capture/replay/public recall/isolation and quiet expired/invalid-token denial passed. ONE public managed recall took **3.70 seconds**, including its3.33second backendRPC. About0.32seconds was embedding and about2.0seconds followed embedding readiness. One approved tool survived observer reconnect, completed one effect/final answer and strict facts/vectors **11 of11**. The initial approval selector timeout remains recorded; no paid request was retried. Newly created in-plan UPDATE/SUPERSEDE remains an unqualified refusal. These scoped outcomes do not establish full goal acceptance.\n\nFor timing,`);
sandbox=sandbox.replace("K27's exact database/container/private directories", "K28's exact database/container/private directories");
fs.writeFileSync(sandboxPath,sandbox);
const website='/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-docs/docs-site/docs';
const perf=path.join(website,'architecture/performance.mdx');
let docs=fs.readFileSync(perf,'utf8');
docs=docs.replace('| Vercel quickstart, visible after paint | 4.38 seconds | 3.20 seconds | No |','| Vercel quickstart, visible after paint | 4.38 seconds | 3.77 seconds | No |');
docs=docs.replace('| Basic CLI, first stdout acknowledgement | 8.84 seconds | 9.35 seconds | No |','| Basic CLI, first stdout acknowledgement | 7.70 seconds | 9.90 seconds | No |');
docs=docs.replace('The actual first CLI request contained static system instructions, quoted recalled evidence as assistant data, and the current user last. This verifies the intended V8 message order for that installed request; it does not guarantee universal model compliance. The prior wrong-marker/trailing-system failure remains recorded.','The prior installed candidate verified static system instructions, quoted recalled evidence as assistant data and the current user last. The current candidate retains that reviewed constructor and all four canonical markers matched. The earlier wrong-marker/trailing-system failure remains recorded.');
docs=docs.replace('Native proof retained five facts','Native proof retained six facts');
docs=docs.replace('**2.78 seconds**, including its **2.43-second** backend RPC','**3.70 seconds**, including its **3.33-second** backend RPC');
const start=docs.indexOf('The CLI trace joins');
const end=docs.indexOf('Gateway internal routing,',start);
assert.ok(start>0&&end>start);
docs=docs.slice(0,start)+`Backend phase tracing was enabled and read back before every measured browser and CLI turn. Exact run and Action execution identities join these intervals on the server clock:\n\n| Segment | Browser first | Browser warm | CLI first | CLI warm |\n| --- | ---: | ---: | ---: | ---: |\n| Admission mutation entry to main dispatch | 2,223 ms | 2,087 ms | 5,305 ms | 6,949 ms |\n| Main dispatch to processed first text | 668 ms | 481 ms | 497 ms | 535 ms |\n| Processed text to first output mutation completion | 637 ms | 503 ms | 557 ms | 1,023 ms |\n\nPreparation exceeds one second before the main model is called. The browser requests fitted one/three executable messages and **zero** recalled-memory, fact or pending bytes. A large model context does not explain those two delays. Their direct preparation took712/618ms.\n\nThe CLI preparation includes1.98/3.17seconds inside Agent recall. Its actual query embedding takes312/336ms; policy admission/checkpoint, terminal evidence capture, attachment and the guarded read/delivery tail add time around it. Context/profile preparation, save/candidate preparation and main admission are separate. These accounting stages are nested within the recorded preparation prefix and must not be added twice. The assembled CLI contexts were2,507/2,077UTF-8bytes; both fitted the conservative32,768 qualified input bound.\n\nThe single public recall has a separate complete trace: about891ms precedes embedding dispatch,317ms is embedding, and about2,005ms follows embedding readiness. The three composed read parents take345/286/758ms, reading30/93/67documents. These are repeated authority, policy and source reads, not unique memory counts or a vector-search-only measurement. No optimistic concurrency retry occurred on that public recall chain.\n\nThe warm CLI main admission has an actual budget-account concurrency conflict. Its writer's exact semantic stage and account scope are unavailable. Later capture/finalization conflicts are separate. A stored row's creation timestamp is fixed at mutation entry and is not a measured commit timestamp. Fresh hydration before Agent pending storage remains a required denial boundary.\n\nBefore first text, browser turns completed three/two protected observation RPCs and four/three session RPCs; CLI turns completed three/three protected observations and five/five sessions. The last protected observation plus fresh session took573/430/475/881ms on the client clock, overlapping native work. Browser paint, CLI stdout and server epochs have different clock origins.\n\nThe installed candidate coalesces matching opaque observation acknowledgements and composes public recall reads within a native snapshot. Changed revisions still require a protected read; every delivered result still receives an independent fresh session check. Controlled call/read reductions have not produced subsecond hosted replies. The terminal main-result attachment occurred after first output in all four traces and is not credited as a first-text improvement.\n\n`+docs.slice(end);
fs.writeFileSync(perf,docs);
const memory=path.join(website,'core-features/memory-orchestration.mdx');
fs.writeFileSync(memory,fs.readFileSync(memory,'utf8').replace('retained five facts across four positive inputs','retained six facts across four positive inputs'));
console.log(JSON.stringify({status:'K28_CLOSED',taskPercent:100,goalPercent:50,slo:'0/4',docs:'actual-results refresh pending build/render',proofsCommitted:false,websiteCommitted:false}));
