from pathlib import Path
import json, hashlib, difflib, datetime, os

q=Path(__file__).resolve().parents[1]; repo=q.parents[3]; c=q/'attempt2-repair1'; old=q.parent/'task03-local-current-delta-2026-10-05'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
failed_digest='7d633bd5e2e6588b9650c6a8b717e4f9eaab9528b6e988ccd3d3746a6b65db7c'
manifest_digest='c466ddb4033105d6374a3e119b26fbd26edfa55755eb36ccaf65c924dbafa71d'
assert sha(q/'candidate-freeze-attempt2.json')==sha(c/'preimages/candidate-freeze-attempt2.json')==failed_digest
assert sha(q/'receipt-manifest-attempt2.json')==sha(c/'preimages/receipt-manifest-attempt2.json')==manifest_digest
failed=json.loads((q/'candidate-freeze-attempt2.json').read_text()); assert len(failed['files'])==774
changed=[]
for row in failed['files']:
 p=q/row['path']
 if sha(p)==row['sha256']:continue
 pre=c/'preimages'/row['path']; assert sha(pre)==row['sha256']
 diff=c/'diffs'/(row['path']+'.diff'); diff.parent.mkdir(parents=True,exist_ok=True)
 diff.write_text(''.join(difflib.unified_diff(pre.read_text().splitlines(True),p.read_text().splitlines(True),fromfile='rejected-attempt2/'+row['path'],tofile='attempt2-repair1/'+row['path'])))
 changed.append({'path':row['path'],'rejectedSha256':row['sha256'],'currentSha256':sha(p),'exactPreimage':str(pre.relative_to(q)),'diff':str(diff.relative_to(q))})
assert sorted(r['path'] for r in changed)==['attempt2/affected-controls.mjs','scripts/deploy.mjs','scripts/guard.mjs','scripts/incidental-custody.mjs']
accepted=json.loads((old/'candidate-freeze-cycle2.json').read_text()); assert len(accepted['files'])==559
assert sha(old/'candidate-freeze-cycle2.json')=='2fa7ddfd9898216a84ac5079edd0661604b709d09384d847ced94e6c725e4c55'
accepted_delta=[]
for row in accepted['files']:
 assert sha(old/row['path'])==row['sha256']
 if sha(q/row['path'])!=row['sha256']:
  assert sha(q/'attempt2/preimages'/row['path'])==row['sha256']; accepted_delta.append(row['path'])
assert len(accepted_delta)==8
source=json.loads((q/'source-inventory.json').read_text()); assert len(source['files'])==161
assert all(sha(repo/r['path'])==r['sha256'] for r in source['files'])
tests=json.loads((q/'source-pre.json').read_text())['files']; assert len(tests)==155
assert tests==json.loads((q/'source-post.json').read_text())['files']; assert all(sha(repo/p)==h for p,h in tests.items())
copies=json.loads((q/'managed-fixture-copy-manifest.json').read_text())['files']; assert len(copies)==138
assert all(sha(repo/r['source'])==sha(q/r['copy'])==r['sha256'] for r in copies)
historical=json.loads((q/'historical-script-provenance.json').read_text())['files']; assert len(historical)==23
assert all(sha(repo/r['historicalSource'])==r['sha256'] and (not r.get('preimage') or sha(q/r['preimage'])==r['sha256']) for r in historical)
projection=json.loads((q/'attempt2/compiler-projection.json').read_text()); assert len(projection['files'])==114
assert all(sha(repo/r['source'])==sha(q/r['copy'])==r['sha256'] for r in projection['files'])
for p in ['scripts/cleanup.mjs','scripts/driver.mjs','scripts/child-toolchain.mjs','project-request.json','fresh-identity-public.json','original-task03.md','dependency-allocation.md','attempt2/compiler-projection.json','attempt2/linux-cli-readiness-receipt.json','attempt2/linux-cli-readiness.stdout','attempt2/disposable-runner-recipe.md','attempt2/preparation-report.md']:
 row=next(r for r in failed['files'] if r['path']==p);assert sha(q/p)==row['sha256']
prior=json.loads((c/'preimages/attempt2/attempt2-actual-source-controls.stdout').read_text()); current=json.loads((c/'actual-source-47-controls.stdout').read_text())
assert prior['cases']==35 and current['cases']==47 and prior['status']==current['status']=='PASS'
prior_names={r['name'] for r in prior['results']}; current_names={r['name'] for r in current['results']}
assert len(prior_names)==35 and prior_names<=current_names and len(current_names-prior_names)==12
for name,file in [('toolchain','child-toolchain'),('custody','incidental-custody'),('deploy','deploy')]:assert current['actualSourceSha256'][name]==sha(q/'scripts'/(file+'.mjs'))
assert next(r for r in current['results'] if r['name']=='nonterminal-cli-group')['incidentalCaptureCalls']==0
real=json.loads((c/'actual-filesystem-3-controls.stdout').read_text()); assert real['status']=='PASS' and real['cases']==3
recovery=json.loads((c/'conserved-28-cleanup-driver-controls.stdout').read_text()); assert recovery['status']=='PASS' and recovery['cases']==28
assert recovery['actualSourceSha256']['cleanup']==sha(q/'scripts/cleanup.mjs') and recovery['actualSourceSha256']['driver']==sha(q/'scripts/driver.mjs')
guard=json.loads((c/'guard-check.stdout').read_text());assert guard['status']=='PASS' and guard['negativeControls']==39 and guard['actualManagedTargets']==0
commands=json.loads((c/'command-receipts.json').read_text());assert len(commands['commands'])==7 and all(r['status']=='PASS' and r['exitCode']==0 for r in commands['commands'])
linux=json.loads((q/'attempt2/linux-cli-readiness.stdout').read_text());assert linux['status']=='PASS' and linux['nodeVersion']=='v24.15.0' and linux['npmVersion']=='12.2.0' and linux['projectedCompilerVersion']=='Version 6.0.3'
assert linux['resourceBefore']['cgroupMemoryMax']==linux['resourceAfter']['cgroupMemoryMax']=='2147483648'
assert sha(q/'attempt2/linux-cli-readiness-receipt.json')=='524f2d489c96eb33bc9782febcfe24e740d55d449d7e5b5d48cea7c18d323538'
unit=json.loads((q/'jest-result.json').read_text());assert unit['numPassedTests']==1005 and unit['numFailedTests']==unit['numPendingTests']==unit['numTodoTests']==0 and unit['numTotalTestSuites']==unit['numPassedTestSuites']==17
ledger=json.loads((q/'path-ledger.json').read_text());assert len(ledger['cases'])==275 and sum(r['visibility']=='public' for r in ledger['cases'])==200 and sum(r['visibility']=='internal' for r in ledger['cases'])==75 and sum(r.get('safeClosure',False) for r in ledger['cases'])==67
request=json.loads((q/'project-request.json').read_text());request_parsed=hashlib.sha256(json.dumps(request,separators=(',',':')).encode()).hexdigest();assert request_parsed=='e085a6822de67476645f04d89f5ca6b8951ab845ae1b0663382abfbef95a13c2'
private=Path('/Users/SaintNick/.codex/tmp/cortex-runtime-task03-attempt2-private-20261005');key=private/'jwt-private.pem'
assert private.stat().st_uid==key.stat().st_uid==os.getuid()==501 and private.stat().st_mode&0o777==0o700 and key.stat().st_mode&0o777==0o600 and key.stat().st_nlink==1
assert not (private/'target.json').exists() and not (private/'deploy.env').exists();assert not (q/'managed-fixture/fixture/.env.local').exists()
start=datetime.datetime.fromisoformat(commands['commands'][0]['startedAtUtc']).timestamp()
counters=[{'temporaryPath':str(p.relative_to(q)),'sha256':sha(p),'raw':json.loads(p.read_text())} for p in sorted((q/'tmp').glob('network-v2-*.json')) if p.stat().st_mtime>=start]
assert counters and all(r['raw']['deniedAttempts']==0 for r in counters)
(c/'offline-network-counters.json').write_text(json.dumps({'scope':'NEW_REPAIR_PROCESS_COUNTERS_ONLY','processReceipts':len(counters),'deniedAttempts':0,'privateInputsRead':False,'historicalCounters':'Retained without relabeling','files':counters},indent=2)+'\n')
report={'state':'BOUNDED_REPAIR_CHECKS_PASS_AWAITING_FRESH_INDEPENDENT_REVIEW','rejectedFreezeSha256':failed_digest,'rejectedManifestSha256':manifest_digest,'rejectedReviewSha256':sha(c/'rejected-review/report.md'),'rejectedFrozenFiles':774,'unchangedRejectedFiles':770,'changedRejectedFiles':changed,'rejectedCandidateRecovery':'All774 exact historical bytes available: unchanged770 paths plus four exact preimages; original7d freeze and c466 manifest preserved. No filesystem identity relabeling.','acceptedAncestryFiles':559,'acceptedAncestryExact':551,'acceptedAncestryDeclaredDeltaPaths':accepted_delta,'acceptedOriginalNamespaceAll559Exact':True,'currentSourcePins':161,'testSourcePins':155,'managedProductCopies':138,'historicalC11References':23,'compilerProjectionFiles':114,'original35ControlsConserved':35,'correctedOriginalAssertion':'nonterminal-cli-group capture calls1 was unsafe; now0 with fixed FAIL receipt and retained ownership','newControls':sorted(current_names-prior_names),'actualSourceControls':47,'actualFilesystemControls':3,'conservedCleanupDriverControls':28,'guardNegatives':39,'scopedLintFiles':5,'syntaxChecks':3,'newChecks':'Effect-blocked VM, dummy owned actual filesystem, pre-dispatch guard, scoped lint/syntax only','reusedChecks':'1005/17 source-discovery/skips exact; root/backend types and measured Linux projected fixture types/readiness unchanged and reused, not rerun','linuxReadinessReceiptSha256':sha(q/'attempt2/linux-cli-readiness-receipt.json'),'requiredMemoryBytes':2147483648,'currentGuardSha256':sha(q/'scripts/guard.mjs'),'requestParsedSha256':request_parsed,'managementReview':'Fresh independent review required for changed guard freeze references. Old helper21373945 and priorPASS4.4 do not authorize this candidate.','requiredConservedCounts':accepted['requiredConservedCounts'],'runtimeBounds':'CLI120s/native20min/driver21min/12s call/10000RPC/320rows/16subjects/2storage64bytes/2cleanup/5generated unchanged','custodyScope':'Fresh incidental source BigInt decimal held-FD identity and full bytes; final post-durable-receipt revalidation, no unknown replacement deletion; no atomic conditional-unlink or C8 contract claim','privateWitness':'Metadata only; current501/0700/key0600/nlink1, no key bytes read; target/env absent; new Linux transfer still requires actual owner/canonical checks','policyRegistry':'Empty product registry and all5 empty policy checks preserved; foreign policy rows never deleted','productWrites':0,'acceptedNamespaceWrites':0,'firstVolumeWrites':0,'privateWrites':0,'serviceCalls':0,'paidCalls':0,'nativeCases':'NOT_RUN','officialCodegen':'NOT_RUN','fullTask03FunctionalAcceptance':'OPEN'}
(c/'conservation-receipt.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'status':'CONSERVATION_PASS','rejectedRecoveryFiles':774,'rejectedUnchanged':770,'explicitChanged':4,'acceptedAncestryExact':551,'sourcePins':161,'testPins':155,'projection':114,'newVM':47,'newRealFilesystem':3,'newGuard':39,'conservationSha256':sha(c/'conservation-receipt.json')}))
