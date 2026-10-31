/** Close the ordinary native evidence index only after all current focused runs/cleanup succeed. */
import assert from 'node:assert/strict';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {q,sha} from './common.mjs';
const read=async name=>JSON.parse(await readFile(join(q,name+'.json')));
const needed=[['native-core1-outcomes','ACTUAL_CORE_PASS'],['native-profile2-outcomes','ACTUAL_PROFILE_DENIAL_PASS'],
 ['native-late6-outcomes','ACTUAL_LATE_WRITE_PASS'],['native-exhaustion2-outcomes','ACTUAL_EXHAUSTION_PASS'],
 ['native-dependency3-outcomes','ACTUAL_DEPENDENCY_RETIREMENT_PASS'],['native-fresh-rpc1-outcomes','ACTUAL_FRESH_RPC_EXPIRY_PASS'],
 ['native-timeout3-outcomes','ACTUAL_TIMEOUT_PASS'],['native-revocation3-outcomes','ACTUAL_REVOCATION_PASS'],
 ['native-retirement4-outcomes','ACTUAL_SCOPED_RETIREMENT_RETAINED_RESOURCES_PASS']];
const groups=[];
for(const[name,status]of needed){const value=await read(name);assert.equal(value.status,status,name);groups.push({receipt:name+'.json',status,groups:value.outcomes?.map(x=>({name:x.name,status:x.status})),elapsedMs:value.elapsedMs});}
const cleanup=await read('native-retirement4-outcomes'),installed=await read('installed-current3-source-manifest'),built=await read('built-backend-current3'),packed=await read('packed-sdk-current3');
const neoTimeout=await read('native-timeout2-neo4j');assert.equal(neoTimeout.status,'PASS');
const partialExpansion=await read('native-expansion1-outcomes');assert.equal(partialExpansion.outcomes.length,6);
const lateOriginal=await read('native-late1-outcomes');assert.equal(lateOriginal.outcomes.filter(x=>x.status==='PASS').length,2);
const report={version:1,status:'ACTUAL_SCOPED_PASS_REQUIRES_SINGLE_NONAUTHOR_REVIEW',task:11,modelCalls:0,
 candidate:{receipt:'installed-current3-source-manifest.json',projectId:cleanup.target.projectId,backend:built,packed:{bytes:packed.bytes,sha256:packed.sha256},files:installed.files.length,tables:installed.tables.length},
 applicability:{current1:'native-core1: seven groups; native-expansion1: six related-neighbor/private-filter/profile groups before fixture policy-parser failure; native-late1: two newer revision arrival positives before deletion-oracle failure.',
  current2:'native-profile2, native-late6 source-tombstone, native-exhaustion2, Neo4j actual500ms timeout and ordinary pending completion. These branches remain applicable; unchanged groups were not repeated.',
  current3:'fresh mutation RPCs/real expired service grant within valid lease, three-level retirement after pagination repair, Memgraph3000ms actual held-RUN timeout, final revocation/scoped cleanup.'},
 requirements:{runtimeNetwork:'Packed SDK declared Node export communicates with verified Convex cloud dev plus both exact owned loopback Bolt services; ESM+CJS imports and browser transport exclusion checked.',
  atomicOutbox:'Real parent rollback; atomic manual-fact outbox; service/current scope denial; actual worker retry and deduplicated receipts; exhaustion dead-letter rather than synced.',
  independentWorker:'Reactive app client closed before actual host Node worker drain; no graph adapter in Convex actions and no model call.',
  remoteFence:'Actual old first RUN held after auth/readiness, newer revision or genuine source tombstone/revocation applied directly, then delayed old arrival rejected/server-aborted; remote content/fence and Core currentness verified.',
  strictFreshness:'Pending, failed/dead-letter, wrong current profile, retired source/grant and expired service authority deny; fresh mutation registrations avoid cached time-dependent eligibility.'},
 groups,additionalApplicableScopedPositives:{neo4jSilentFirstRun:'native-timeout2-neo4j.json',relatedNeighborsAndPrivateFilter:'native-expansion1-outcomes.json',newerRevisionBothEngines:'native-late1-outcomes.json',emptyFactReplacement:'native-late3-outcomes.json'},
 preservedFailures:[
  'native-expansion1: fixture JSON.stringify policy canonicalization error; corrected native-profile2, no model replay.',
  'native-timeout1: owned child terminated exit143/unknown; read-only diagnosis proved driver/socket close while RUN and tx.close promises remained pending; independent I/O race repaired.',
  'native-late1/3: literal tombstone oracle wrong for deleteFact canonical-source-preserving empty replacement; separate actual source tombstone tested.',
  'native-late2: fixture payload lookup key mismatch; no mutation.',
  'native-late4/5: wall-time/query-poll fixture expiry checks failed; no false expiry claim; fresh denied mutation was used in late6.',
  'native-late3: real rich-scope GraphPayload validation error/atomic rollback, repaired in current2.',
  'native-timeout2: Memgraph500ms readiness failed before silent RUN; distinct supported3000ms timeout case used, Neo4j500ms result retained.',
  'native-retirement3: all scoped cleanup effects completed before a stale public Task10 managed-setup1 filename; retirement4 read-only closure uses actual managed-setup4 and repeats no cleanup effects.',
  'native-dependency1: real recursive multiple-pagination platform error/atomic rollback; dependency2 parent committed on current3 then dependent STALE_SOURCE denial differed from literal FORBIDDEN oracle; dependency3 drains same committed tombstones without repeated parent.'
 ],
 cleanup:{receipt:'native-retirement4-outcomes.json',status:cleanup.status,pendingJobs:cleanup.pendingJobs,ownedWorkersAndClientsClosed:cleanup.ownedWorkersAndClientsClosed,
  target:cleanup.target,services:cleanup.services,privateMetadata:cleanup.privateMetadata,unknownTenantLiability:cleanup.unknownTenantLiability,liabilityResetOrRefund:false,
  finalGoalRetirementRequired:true,noTask12ScopeOrInferenceStarted:true},
 sourceScope:'Only QA/private-owned fixture changes by this executor; Root/backend author own product source; reviewer is non-author. Current source deployment tested; no production target/release or Git edits.',
 createdAt:new Date().toISOString()};
await writeFile(join(q,'final-native-report1.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
await writeFile(join(q,'final-native-report1.md'),'# Task11 actual native report\n\nBoth owned graph engines received scoped atomic outbox projection through the installed packed Node worker. Meaningful retry/dedup, newer/deleted late arrival, strict currentness, exhaustion and app-disconnect cases are covered; all earlier failures remain preserved. Current3 focused checks cover fresh mutation authority, repaired transitive retirement and Memgraph silent-RUN timeout.\n\nAll Task11 data and remote content are retired; grants and owned clients/processes/proxies are closed. Project3174742 remains explicitly retained for12/13, and the two owned containers for16/final adversarial checks. Private credentials remain0700/0600. Prior Task10 full500000 uncertain liability and zero terminal slots remain unchanged. No Task11 model dispatch occurred.\n\nSee final-native-report1.json for exact source applicability and public-receipt mapping. This executor does not grant independent task acceptance.\n',{flag:'wx'});
const rows=[];
for(const name of (await readdir(q)).sort())if(/\.(json|md|mjs|ts|log)$/.test(name)&&name!=='final-native-index1.json'){
 const body=await readFile(join(q,name));rows.push({path:name,bytes:body.length,sha256:sha(body)});
}
await writeFile(join(q,'final-native-index1.json'),JSON.stringify({version:1,kind:'ordinary-public-redacted-receipt-index',rows,privateCredentialBodiesIncluded:false,createdAt:new Date().toISOString()},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:report.status,groups:groups.length,publicFiles:rows.length,modelCalls:0,retainedTarget:cleanup.target.projectId}));
