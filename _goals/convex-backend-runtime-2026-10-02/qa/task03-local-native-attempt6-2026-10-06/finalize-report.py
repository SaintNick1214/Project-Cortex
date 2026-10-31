from pathlib import Path
import json,hashlib,datetime
q=Path(__file__).resolve().parent;r=q.parents[3];sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
p=q/'freeze-candidate.py';s=p.read_text();s=s.replace("'jest.config.js'", "'jest.config.mjs','convex.json'");s=s.replace("source=product+[r/path for path in extra if (r/path).is_file()]", "source=sorted(set(product+[r/path for path in extra if (r/path).is_file()]+[r/path for path in json.loads((q/'source-pre.json').read_text())['files']]))");p.write_text(s)
pre=json.loads((q/'source-pre.json').read_text());post=json.loads((q/'source-post.json').read_text());assert pre['files']==post['files'];current={p:sha(r/p) for p in pre['files']};assert current==pre['files'];
discovery=[line for line in (q/'test-discovery.stdout').read_text().splitlines() if line.strip()];result=json.loads((q/'jest-result.json').read_text());actual=sorted(row['name'] for row in result['testResults']);assert sorted(discovery)==actual;assert len(actual)==17;assert result['success'] and result['numTotalTests']==1005 and result['numPassedTests']==1005 and result['numFailedTests']==0 and result['numPendingTests']==0 and result['numTodoTests']==0
network=[]
for p in sorted((q/'tmp').glob('network-*.json')):
 d=json.loads(p.read_text());network.append({'receipt':str(p.relative_to(q)),'sha256':sha(p),**d})
# The preloader counters are checked from actual per-process receipts, not assumed from empty credentials.
originalDenied=[row for row in network if row['deniedAttempts'] and 'attempts' not in row];classifiedDenied=[row for row in network if row['deniedAttempts'] and 'attempts' in row]
assert len(originalDenied)==3 and sum(row['deniedAttempts'] for row in originalDenied)==6
assert len(classifiedDenied)==3 and sum(row['deniedAttempts'] for row in classifiedDenied)==6
for row in classifiedDenied:assert all(item['targetClass']=='LOCAL_UNIX_IPC_UNDER_QA_TMP' for item in row['attempts'])
for row in originalDenied:assert row['surfaces']==['node:net:createConnection']*2
qa={'state':'CREDENTIAL_FREE_AFFECTED_CHECKS_PASS_SERVICE_NOT_RUN','discoveredSuitePaths':discovery,'executedSuitePaths':actual,'discoveredSuites':len(discovery),'executedSuites':result['numTotalTestSuites'],'passedSuites':result['numPassedTestSuites'],'failedSuites':result['numFailedTestSuites'],'pendingSuites':result['numPendingTestSuites'],'totalTests':result['numTotalTests'],'passedTests':result['numPassedTests'],'failedTests':result['numFailedTests'],'pendingTests':result['numPendingTests'],'todoTests':result['numTodoTests'],'discoveryExactlyMatchesExecution':True,'sourceFingerprintsBeforeAfterCurrentExact':len(current),'rootActualTypes':'PASS','backendActualES2021Types':'PASS','managedFixtureCurrentTypes':'PASS','currentRootSdkQAOutputBuild':'PASS','serviceTestsClaimed':0,'officialCodegen':'NOT_RUN','actualManagedPublication':'NOT_RUN','networkPreloaderReceipts':network,'preloaderObservation':'All connections were blocked. Original three tsx audits recorded6 denied createConnection attempts without destination classification;3 repeat audits recorded6 denied local Unix IPC attempts under QA tmp. Selected1005 unit tests recorded zero attempts. No managed/service driver ran.', 'originalUnclassifiedDeniedConnections':6,'classifiedRepeatedLocalUnixIpcDeniedConnections':6,'classifiedExternalOrUnknownConnectionAttempts':0}
(q/'affected-check-summary.json').write_text(json.dumps(qa,indent=2)+'\n')
p=q/'delta-native-cases.json';d=json.loads(p.read_text());d.update({'executionEntry':'scripts/driver.mjs','qualificationEntry':'scripts/qualify.mjs','deltaControlsEntry':'scripts/policy-delta.mjs','expectedPublication':{'productRegistered':275,'fixtureOnlyInternal':12,'total':287,'public':200,'internal':87,'http':0},'newInternalVisibilityBeforeAfterSnapshots':32,'currentNativeSafeControls':16,'healthyNativeAuthorityControls':2,'revokedNativeNoEffectControls':1,'liveStatus':'NOT_RUN_INDEPENDENT_PREPARATION_REVIEW_REQUIRED','originalFullTask03Criteria':'original-task03.md','dependencyAllocation':'dependency-allocation.md'});p.write_text(json.dumps(d,indent=2)+'\n')
(q/'state.json').write_text(json.dumps({'state':'PREPARATION_COMPLETE_AWAITING_INDEPENDENT_PREPARATION_REVIEW','scope':'BOUNDED_03_FOUNDATION_CURRENT_DELTA_PREPARATION','productSourceWrites':0,'historicalEvidenceWrites':0,'actualExternalRequests':0,'actualManagedTargetsCreated':0,'actualDeployments':0,'paidCalls':0,'freshIdentity':'fresh-identity-public.json','officialCodegen':'NOT_RUN','actualNativeLiveQualification':'NOT_RUN','foundationTaskAcceptance':'NOT_CLAIMED','fullTask03Acceptance':'NOT_CLAIMED','goalCompletion':'NOT_CLAIMED'},indent=2)+'\n')
original=json.loads((q/'historical-script-provenance.json').read_text());deltas=json.loads((q/'prospective-script-deltas.json').read_text());seen={row['path'] for row in deltas['files']}
import difflib
for row in original['files']:
 path=row.get('prospectiveCopy');h=row.get('preimage')
 if not(path and h and path.endswith('.mjs') and path not in seen):continue
 p=q/path;preimage=q/h
 if p.read_bytes()==preimage.read_bytes():continue
 diff='historical-preimages/'+p.name+'.prospective.diff';(q/diff).write_text(''.join(difflib.unified_diff(preimage.read_text().splitlines(True),p.read_text().splitlines(True),fromfile='historical-c11/'+p.name,tofile='prospective-current/'+p.name)));deltas['files'].append({'path':path,'preimage':h,'preimageSha256':sha(preimage),'prospectiveSha256':sha(p),'diff':diff});seen.add(path)
(q/'prospective-script-deltas.json').write_text(json.dumps(deltas,indent=2)+'\n')
# Auth/helper provenance and current source copies are actual byte comparisons.
for row in original['files']:
 assert sha(r/row['historicalSource'])==row['sha256']
 if row.get('preimage'):assert sha(q/row['preimage'])==row['sha256']
for row in json.loads((q/'managed-fixture-copy-manifest.json').read_text())['files']:assert sha(r/row['source'])==row['sha256'];assert sha(q/row['copy'])==row['sha256']
print(json.dumps({'status':'PASS','suites':17,'tests':1005,'skips':0,'sourcePrePostCurrentExact':155,'historicalOperationalSourcesExact':len(original['files']),'productSourceWrites':0,'actualServices':0}))
