import hashlib,json,os,stat
from pathlib import Path
repo=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
q=repo/'_goals/convex-backend-runtime-2026-10-02/qa/task03-local-native-attempt2-2026-10-05'
old=q.parent/'task03-local-current-delta-2026-10-05'
def raw(p):
 p=Path(p)
 for a in [*reversed(p.parents),p]: assert not stat.S_ISLNK(a.lstat().st_mode),str(a)
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  before=os.fstat(fd);assert stat.S_ISREG(before.st_mode) and before.st_nlink==1,str(p)
  chunks=[]
  while True:
   b=os.read(fd,1048576)
   if not b: break
   chunks.append(b)
  after=os.fstat(fd)
  fields=('st_dev','st_ino','st_mode','st_nlink','st_uid','st_gid','st_size','st_mtime_ns','st_ctime_ns')
  assert tuple(getattr(before,x) for x in fields)==tuple(getattr(after,x) for x in fields),str(p)
  return b''.join(chunks)
 finally:os.close(fd)
def sha(b):return hashlib.sha256(b).hexdigest()
def h(p):return sha(raw(p))
def j(p):return json.loads(raw(p))
def rows(base,entries):
 names=set()
 for r in entries:
  p=Path(r['path']);assert not p.is_absolute() and '..' not in p.parts and str(p) not in names
  names.add(str(p));b=raw(base/p);assert sha(b)==r['sha256'],str(p)
  if 'bytes' in r:assert len(b)==r['bytes'],str(p)
 return names
expected={'candidate-freeze-attempt2-repair1.json':'cd5e0c71e1839f079906becb9c5e0a90aba2261890ec4fb7997bc2981db966f5','receipt-manifest-attempt2-repair1.json':'8322d8d9f9294306432977515faa2552f36c7c210435895d6829e3402c6bd031','attempt2-repair1/conservation-receipt.json':'bd5c089c40b21d609f866cf812a397fc04291324a0b7e57b1303169e860d90ec','attempt2-repair1/repair-report.md':'9cb3a6da394e0224cc204781df3b1aa8b439d779227b30982d4dd6d70d4db20c','candidate-freeze-attempt2.json':'7d633bd5e2e6588b9650c6a8b717e4f9eaab9528b6e988ccd3d3746a6b65db7c','receipt-manifest-attempt2.json':'c466ddb4033105d6374a3e119b26fbd26edfa55755eb36ccaf65c924dbafa71d'}
for p,d in expected.items():assert h(q/p)==d,p
f=j(q/'candidate-freeze-attempt2-repair1.json');m=j(q/'receipt-manifest-attempt2-repair1.json');c=j(q/'attempt2-repair1/conservation-receipt.json')
assert len(rows(q,f['files']))==833 and len(rows(q,m['files']))==832
assert f['actualExternalRequests']==f['actualDeployments']==0 and f['state']=='FROZEN_AWAITING_INDEPENDENT_PREPARATION_REVIEW'
rejected=j(q/'candidate-freeze-attempt2.json');changes={r['path']:r for r in c['changedRejectedFiles']};unchanged=0
for r in rejected['files']:
 if h(q/r['path'])==r['sha256']:unchanged+=1
 else:
  assert r['path'] in changes
  p=changes[r['path']];assert h(q/p['exactPreimage'])==r['sha256']==p['rejectedSha256'] and h(q/r['path'])==p['currentSha256']
assert len(rejected['files'])==774 and unchanged==770 and len(changes)==4
rejected_manifest=j(q/'receipt-manifest-attempt2.json')
for r in rejected_manifest['files']:
 p=q/(changes[r['path']]['exactPreimage'] if r['path'] in changes else r['path'])
 assert h(p)==r['sha256'],r['path']
assert len(rejected_manifest['files'])==773
review_old=q.parent/'local-resume-2026-10-05/task03-attempt2-preparation-review'
for p in (q/'attempt2-repair1/rejected-review').iterdir():
 assert h(p)==h(review_old/p.name),p.name
oldf=j(old/'candidate-freeze-cycle2.json');assert h(old/'candidate-freeze-cycle2.json')=='2fa7ddfd9898216a84ac5079edd0661604b709d09384d847ced94e6c725e4c55'
assert len(rows(old,oldf['files']))==559
oldchanges=[]
for r in oldf['files']:
 if h(q/r['path'])!=r['sha256']:
  assert h(q/'attempt2/preimages'/r['path'])==r['sha256'];oldchanges.append(r['path'])
assert sorted(oldchanges)==sorted(c['acceptedAncestryDeclaredDeltaPaths']) and len(oldchanges)==8
source=j(q/'source-inventory.json');assert len(rows(repo,source['files']))==161
inputs=j(q/'source-pre.json')['files'];assert inputs==j(q/'source-post.json')['files'] and len(inputs)==155
for p,d in inputs.items():assert h(repo/p)==d
copies=j(q/'managed-fixture-copy-manifest.json')['files'];assert len(copies)==138
for r in copies:assert h(repo/r['source'])==h(q/r['copy'])==r['sha256']
historical=j(q/'historical-script-provenance.json')['files'];assert len(historical)==23
for r in historical:
 assert h(repo/r['historicalSource'])==r['sha256']
 if r.get('preimage'):assert h(q/r['preimage'])==r['sha256']
proj=j(q/'attempt2/compiler-projection.json');assert len(proj['files'])==114 and proj['version']=='6.0.3'
for r in proj['files']:assert h(repo/r['source'])==h(q/r['copy'])==r['sha256']
prior=j(q/'attempt2-repair1/preimages/attempt2/attempt2-actual-source-controls.stdout');new=j(q/'attempt2-repair1/actual-source-47-controls.stdout')
pnames={r['name'] for r in prior['results']};nnames={r['name'] for r in new['results']};assert len(pnames)==35 and pnames<=nnames and len(nnames)==47
assert next(r for r in new['results'] if r['name']=='nonterminal-cli-group')['incidentalCaptureCalls']==0
assert h(q/'original-task03.md')==h(repo/'_goals/convex-backend-runtime-2026-10-02/tasks/03-authorization.md')
assert h(q/'dependency-allocation.md')==h(repo/'_goals/convex-backend-runtime-2026-10-02/qa/resume-dependency-refinement-c2/plan.md')
inv=j(q/'current-inventory/public-path-inventory.json');endpoints=inv['endpoints'];assert len(endpoints)==len({r['path'] for r in endpoints})==275 and not inv['routes']
assert sum(r['visibility']=='public' for r in endpoints)==200 and sum(r['visibility']=='internal' for r in endpoints)==75
native=j(q/'managed-native-registration-schemas.json');assert native['registrationCount']==len(native['rows'])==287 and native['public']==200 and native['internal']==87
unit=j(q/'jest-result.json');assert unit['numPassedTests']==1005 and unit['numFailedTests']==unit['numPendingTests']==unit['numTodoTests']==0 and unit['numTotalTestSuites']==unit['numPassedTestSuites']==17
linux=j(q/'attempt2/linux-cli-readiness.stdout');assert linux['status']=='PASS' and linux['nodeVersion']=='v24.15.0' and linux['npmVersion']=='12.2.0' and linux['projectedCompilerVersion']=='Version 6.0.3'
assert linux['resourceBefore']['cgroupMemoryMax']==linux['resourceAfter']['cgroupMemoryMax']=='2147483648'
assert h(q/'attempt2/linux-cli-readiness-receipt.json')=='524f2d489c96eb33bc9782febcfe24e740d55d449d7e5b5d48cea7c18d323538'
assert oldf['requiredConservedCounts']==f['requiredConservedCounts']==c['requiredConservedCounts']
print(json.dumps({'status':'PASS','scope':'READ_ONLY_REPAIR1_INTEGRITY_AND_CONSERVATION','hashes':expected,'frozenFiles':833,'manifestFiles':832,'rejectedRecovery':{'files':774,'unchanged':770,'exactPreimages':4,'receiptEntriesRecoverable':773,'priorReviewerCopiesExact':9},'originalAncestry':{'exactNamespaceFiles':559,'currentExact':551,'declaredDeltaPaths':sorted(oldchanges)},'productPins':161,'testPins':155,'managedCopies':138,'historicalReferences':23,'exactTSProjection':114,'originalControlNamesRetained':35,'newControls':sorted(nnames-pnames),'originalCounts':f['requiredConservedCounts'],'productRegistrations':275,'expectedNativePublished':287,'reusedTests':{'passed':1005,'suites':17,'freshExecution':False},'reusedLinuxReadiness':{'literalMemoryBytes':2147483648,'freshExecution':False},'privateReads':0,'candidateWrites':0,'serviceCalls':0},indent=2))
