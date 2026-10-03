from pathlib import Path
import json,hashlib,datetime,subprocess,difflib
root=Path('/workspace/Project-Cortex/work/backend-runtime/task03b2a-checkout');out=Path('/tmp/task03b2a-review3-tgufib91');qa=root/'_goals/convex-backend-runtime-2026-10-02/qa/task03b2a'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest() if p.is_file() else None
checks=[]
def verify(name,condition,detail=None):
 checks.append({'name':name,'pass':bool(condition),'detail':detail})
freeze=json.loads((qa/'freeze.json').read_text())
verify('provided source freeze SHA256',sha(qa/'freeze.json')=='97de43cfc1c447173a961de2dde11e7a77baaa0c888345d43dc842dc3f8a42fa')
verify('current and cycle3 freeze byte equality',(qa/'freeze.json').read_bytes()==(qa/'cycle3/freeze.json').read_bytes())
verify('exact source freeze timestamp',freeze['frozenAt']=='2026-10-03T10:59:44.498391+00:00')
for kind in ['sourceHashes','checkHashes']:
 for item in freeze[kind]:verify('frozen '+kind+': '+item['file'],sha(root/item['file'])==item['sha256'])
for key,p in [('artifactHashesSha256','cycle3/artifact-hashes.json'),('receiptsSha256','check-receipts.json'),('contractsSha256','contracts.md'),('reportSha256','cycle3/report.md'),('verificationSha256','cycle3/verification.json'),('ordinaryTestPreservationSha256','cycle3/catalog-test-preservation.json')]:
 verify('frozen '+key,sha(qa/p)==freeze[key])
for record in json.loads((qa/'cycle3/artifact-hashes.json').read_text())['records']:verify('artifact '+record['file'],sha(root/record['file'])==record['sha256'])
archiveCounts={}
for cycle in ['cycle1-final','cycle2-final']:
 base=qa/'history'/cycle;data=json.loads((base/'preservation.json').read_text());archiveCounts[cycle]=len(data['records'])
 for record in data['records']:
  p=base/record['kind']/(record['file']+'.text' if record['kind']=='source' else record['path']);verify('archive '+cycle+': '+str(p.relative_to(base)),sha(p)==record['sha256'])
verify('unchanged archive counts',archiveCounts=={'cycle1-final':69,'cycle2-final':101},archiveCounts)
changed=[]
for item in sorted((qa/'history/cycle2-final/source').rglob('*.text')):
 rel=str(item.relative_to(qa/'history/cycle2-final/source'))[:-5]
 if (root/rel).read_bytes()!=item.read_bytes():changed.append(rel)
verify('exact bounded source changes',changed==['convex-dev/immutable.ts','convex-dev/users.ts','tests/unit/runtimeMetadataAuth/registrations.test.ts'],changed)
for p in [root/'convex-dev/runtimeAuth.ts',root/'convex-dev/runtimeAuthSchema.ts',root/'src/auth/verified.ts',root/'convex-dev/tsconfig.json']+sorted((root/'_goals/convex-backend-runtime-2026-10-02/qa/task03a').rglob('*')):
 if not p.is_file():continue
 rel=str(p.relative_to(root));r=subprocess.run(['git','show','HEAD:'+rel],cwd=root,stdout=subprocess.PIPE,stderr=subprocess.PIPE);verify('reviewed HEAD baseline '+rel,r.returncode==0 and r.stdout==p.read_bytes())
initial=json.loads((out/'initial-snapshot.json').read_text());status=subprocess.check_output(['git','status','--short'],cwd=root,text=True)
verify('git head unchanged',subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()==initial['head'])
verify('git status unchanged',status==initial['status'])
for item in initial['records']:verify('review snapshot '+item['file'],sha(root/item['file'])==item['sha256'])
newFiles=set(str(p.relative_to(root)) for parent in [qa,root/'convex-dev',root/'tests/unit/runtimeMetadataAuth',root/'_goals/convex-backend-runtime-2026-10-02/qa/task03a'] for p in parent.rglob('*') if p.is_file())
verify('no new candidate source/QA files',not newFiles-set(v['file'] for v in initial['records']),sorted(newFiles-set(v['file'] for v in initial['records'])))
actual=json.loads((out/'catalog/public-path-inventory.json').read_text());canonical=json.loads((qa/'catalog/public-path-inventory.json').read_text());old=json.loads((qa/'history/cycle2-final/qa/catalog/public-path-inventory.json').read_text());baseline=json.loads((root/'_goals/convex-backend-runtime-2026-10-02/qa/task03a/public-path-inventory.json').read_text())
verify('AST canonical equality',actual==canonical)
verify('AST exact zero unresolved',actual['completeness']['unresolved']==[])
verify('AST exact counts',all(actual['completeness']['counts'][k]==v for k,v in {'registered':41,'public':36,'internal':5,'guard':36,'registeredBuilderCalls':41,'resolvedExports':41}.items()),actual['completeness']['counts'])
verify('AST all endpoint semantics unchanged from cycle2',[{k:v for k,v in e.items() if k!='line'} for e in actual['endpoints']]==[{k:v for k,v in e.items() if k!='line'} for e in old['endpoints']])
verify('exact internal5 retained registrations',sorted(v['path'] for v in actual['endpoints'] if v['visibility']=='internal')==sorted(['immutable:purgeAll','mutable:purgeAll','sessions:expireIdle','sessions:incrementMessageCount','sessions:incrementMemoryCount']))
cycle3Receipts=json.loads((qa/'cycle3/check-receipts.json').read_text());canonicalReceipts=json.loads((qa/'check-receipts.json').read_text())
verify('canonical receipt core equals cycle3 plus retained verifier receipts',canonicalReceipts==cycle3Receipts+[json.loads((qa/'cycle3/verification-receipt.initial.json').read_text()),json.loads((qa/'cycle3/verification-receipt.json').read_text())])
verify('AST reviewed03A path correspondence',sorted(v['path'] for v in actual['endpoints'])==sorted(v['path'] for v in baseline['endpoints'] if v['path'].split(':')[0] in ['immutable','mutable','users','sessions']))
native=json.loads((out/'framework-registration.json').read_text());verify('native exact validators unchanged',native==json.loads((qa/'history/cycle2-final/qa/framework-registration.json').read_text()))
verify('native actual41 visibility',len(native)==41 and sum(v['visibility']=='public' for v in native)==36 and sum(v['visibility']=='internal' for v in native)==5)
verify('native public no reference credentials',all('reference' not in v['args']['value'] for v in native if v['visibility']=='public'))
tests=json.loads((out/'jest-results.json').read_text());oldTests=json.loads((qa/'history/cycle2-final/qa/jest-results.json').read_text()); names=lambda d:sorted(a['fullName'] for s in d['testResults'] for a in s['assertionResults'])
verify('ordinary selected tests189 all passed two suites no skips',tests['numTotalTests']==189 and tests['numPassedTests']==189 and tests['numFailedTests']==0 and tests['numPendingTests']==0 and tests['numTotalTestSuites']==2 and tests['numFailedTestSuites']==0)
verify('ordinary names unchanged',names(tests)==names(oldTests))
discovery=next(json.loads(line) for line in (out/'discovery.log').read_text().splitlines() if line.startswith('['));verify('ordinary exact discovery',sorted(discovery)==sorted([str(root/'tests/unit/runtimeMetadataAuth/handlers.test.ts'),str(root/'tests/unit/runtimeMetadataAuth/registrations.test.ts')]),discovery)
preservation=json.loads((out/'ordinary-test-preservation.json').read_text());verify('ordinary canonical QA unchanged and temporary cleanup',preservation['catalogUnchanged'] and preservation['temporaryClean'],preservation)
for name,total in [('boundary-probes',118),('extra-probes',33)]:
 d=json.loads((out/(name+'.json')).read_text());verify('replayed '+name,len(d)==total and all(v['pass'] for v in d),{'total':len(d),'failed':[v for v in d if not v['pass']]})
if (out/'timestamp-equivalence.json').exists():
 d=json.loads((out/'timestamp-equivalence.json').read_text())['outcomes'];verify('fresh timestamp equivalence72',len(d)==72 and all(v['pass'] for v in d))
if (out/'cleanup-controls.json').exists():
 d=json.loads((out/'cleanup-controls.json').read_text())['outcomes'];verify('fresh real callback6 cleanup outcomes',len(d)==6 and all(v['pass'] and v['cleanupObserved'] and v['canonicalQAUnchanged'] for v in d))
verify('full-root raw bytes identical to archived cycle2',(out/'full-root-types.log').read_bytes()==(qa/'history/cycle2-final/qa/checks/full-root-types.log').read_bytes())
verify('full-root exactly five consumer diagnostics',(out/'full-root-types.log').read_text().count('error TS')==5)
verify('virtual reviewed baseline zero diagnostics',json.loads((out/'baseline-diagnostics.json').read_text())['diagnostics']==[])
commands=json.loads((out/'commands.json').read_text());verify('actual affected checks successful',all(c['exitCode']==(2 if c['name']=='full-root-types' else 0) for c in commands))
result={'verifiedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'checks':len(checks),'passed':sum(c['pass'] for c in checks),'failed':[c for c in checks if not c['pass']],'snapshotRecords':len(initial['records']),'archives':archiveCounts,'results':checks}
(out/'verification.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k!='results'},indent=2))
raise SystemExit(0 if not result['failed'] else 1)
