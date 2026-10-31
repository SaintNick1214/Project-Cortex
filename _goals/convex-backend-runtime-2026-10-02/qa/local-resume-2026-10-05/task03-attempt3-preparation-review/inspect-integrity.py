import hashlib, json, os, stat, sys
from pathlib import Path
repo = Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
qa = repo/'_goals/convex-backend-runtime-2026-10-02/qa'
q = qa/'task03-local-native-attempt3-2026-10-05'
out = Path(__file__).resolve().parent
bindings = []
fields = ('st_dev','st_ino','st_mode','st_nlink','st_uid','st_gid','st_size','st_mtime_ns','st_ctime_ns')
def ident(s): return {k:str(getattr(s,k)) for k in fields}
def raw(p):
    p=Path(p); assert p.is_absolute()
    for a in [*reversed(p.parents),p]: assert not stat.S_ISLNK(a.lstat().st_mode), str(a)
    fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
    try:
        before=os.fstat(fd); assert stat.S_ISREG(before.st_mode) and before.st_nlink==1, str(p)
        assert ident(before)==ident(p.lstat())
        chunks=[]
        while True:
            b=os.read(fd,1048576)
            if not b: break
            chunks.append(b)
        b=b''.join(chunks)
        assert ident(before)==ident(os.fstat(fd))==ident(p.lstat()),str(p)
        assert len(b)==before.st_size
        bindings.append({'path':str(p),'sha256':hashlib.sha256(b).hexdigest(),'bytes':len(b),'currentHeldPathIdentityDecimal':ident(before)})
        return b
    finally: os.close(fd)
def sha(b): return hashlib.sha256(b).hexdigest()
def h(p): return sha(raw(p))
def j(p): return json.loads(raw(p))
def rows(base, entries):
    names=set()
    for r in entries:
        p=Path(r['path']); assert not p.is_absolute() and '..' not in p.parts and str(p) not in names
        names.add(str(p)); b=raw(base/p); assert sha(b)==r['sha256'],str(p)
        if 'bytes' in r: assert len(b)==r['bytes'],str(p)
    return names
expected={'candidate-freeze-attempt3.json':'2fb8d11a7e6c0bcaf92b2fe8d7ff228a6e554f9241c07c22079e6be8bcc870ef','receipt-manifest-attempt3.json':'75ec4e5fbb3afbb9c9a779f4a6a01b28ec2a67b67cdd6b7f641ce9ff9bd913c8','attempt3/conservation-receipt.json':'71f90a5aa40f2cc19440faa5a8e0393e41e17369cfd4dc73960a33f3012c5cf2','attempt3/preparation-report.md':'215774a3a4c62a6be4fdcf5eb550f92daf3c8b5a9382bf9c0a9ab01b650a17ed','scripts/guard.mjs':'92d65df6faf9cba42d063dc6baa3f0d66e87518bda590acc9e229f97b7bec36f','transport-prep/private-transport.py':'ecb1eff9a9edf025e2b7eb9108580857ff41da8bb54e8956251b219a5bebc23e'}
for p,d in expected.items(): assert h(q/p)==d,p
f=j(q/'candidate-freeze-attempt3.json');m=j(q/'receipt-manifest-attempt3.json');c=j(q/'attempt3/conservation-receipt.json')
assert len(rows(q,f['files']))==965 and len(rows(q,m['files']))==964
assert f['actualExternalRequests']==f['actualDeployments']==0 and f['state']=='FROZEN_AWAITING_INDEPENDENT_PREPARATION_REVIEW'
old=qa/'task03-local-native-attempt2-2026-10-05';oldf=j(old/'candidate-freeze-attempt2-repair1.json')
assert h(old/'candidate-freeze-attempt2-repair1.json')==c['sourceAttempt2FreezeSha256']
assert len(rows(old,oldf['files']))==833
changes={r['path']:r for r in c['explicitFreshAttempt3Deltas']}; unchanged=0
for r in oldf['files']:
    if h(q/r['path'])==r['sha256']: unchanged+=1
    else:
        p=changes[r['path']];assert h(q/p['preimage'])==r['sha256']==p['attempt2Sha256'] and h(q/r['path'])==p['currentSha256']
assert unchanged==824 and len(changes)==9
base=qa/'task03-local-current-delta-2026-10-05';bf=j(base/'candidate-freeze-cycle2.json');assert len(rows(base,bf['files']))==559
changes0={r['path']:r for r in c['acceptedOriginalDeclaredDeltas']}; unchanged0=0
for r in bf['files']:
    if h(q/r['path'])==r['sha256']:unchanged0+=1
    else: assert h(q/changes0[r['path']]['originalExactPreimage'])==r['sha256']
assert unchanged0==550 and len(changes0)==9
source=j(q/'source-inventory.json');assert len(rows(repo,source['files']))==161
inputs=j(q/'source-pre.json')['files'];assert inputs==j(q/'source-post.json')['files'] and len(inputs)==155
for p,d in inputs.items():assert h(repo/p)==d
copies=j(q/'managed-fixture-copy-manifest.json')['files'];assert len(copies)==138
for r in copies:assert h(repo/r['source'])==h(q/r['copy'])==r['sha256']
historic=j(q/'historical-script-provenance.json')['files'];assert len(historic)==23
for r in historic:
    assert h(repo/r['historicalSource'])==r['sha256']
    if r.get('preimage'):assert h(q/r['preimage'])==r['sha256']
proj=j(q/'attempt2/compiler-projection.json');assert len(proj['files'])==114 and proj['version']=='6.0.3'
for r in proj['files']:assert h(repo/r['source'])==h(q/r['copy'])==r['sha256']
assert h(q/'scripts/deploy.mjs')=='df2bf5200e8c8342412e97761ab8cde75d573df8049076bc4187118f3041a982'
assert sha(raw(q/'scripts/incidental-custody.mjs').replace(b'candidate-freeze-attempt3.json',b'candidate-freeze-attempt2-repair1.json'))=='7d5d1a31a18736482f78925cfbc4ea1b56e7a0db4b1b2156cb03056ae860e02f'
assert h(q/'original-task03.md')==h(repo/'_goals/convex-backend-runtime-2026-10-02/tasks/03-authorization.md')
assert h(q/'dependency-allocation.md')==h(qa/'resume-dependency-refinement-c2/plan.md')
inv=j(q/'current-inventory/public-path-inventory.json');e=inv['endpoints'];assert len(e)==len({r['path'] for r in e})==275 and not inv['routes']
assert sum(r['visibility']=='public' for r in e)==200 and sum(r['visibility']=='internal' for r in e)==75
native=j(q/'managed-native-registration-schemas.json');assert native['registrationCount']==len(native['rows'])==287 and native['public']==200 and native['internal']==87
unit=j(q/'jest-result.json');assert unit['numPassedTests']==1005 and unit['numFailedTests']==unit['numPendingTests']==unit['numTodoTests']==0 and unit['numTotalTestSuites']==unit['numPassedTestSuites']==17
linux=j(q/'attempt2/linux-cli-readiness.stdout');assert linux['status']=='PASS' and linux['nodeVersion']=='v24.15.0' and linux['npmVersion']=='12.2.0' and linux['projectedCompilerVersion']=='Version 6.0.3'
assert linux['resourceBefore']['cgroupMemoryMax']==linux['resourceAfter']['cgroupMemoryMax']=='2147483648'
assert h(q/'attempt2/linux-cli-readiness-receipt.json')=='524f2d489c96eb33bc9782febcfe24e740d55d449d7e5b5d48cea7c18d323538'
assert bf['requiredConservedCounts']==f['requiredConservedCounts']==c['requiredConservedCounts']
for rel,count in [('attempt3/source-47-controls.stdout',47),('attempt3/filesystem-3-controls.stdout',3),('attempt3/cleanup-driver-28-controls.stdout',28)]:
    a=j(q/rel);assert a['status']=='PASS' and a['cases']==count and all(r['status']=='PASS' for r in a['results'])
guard=j(q/'attempt3/guard-check.stdout');assert guard['status']=='PASS' and guard['negativeControls']==40
prev=qa/'local-resume-2026-10-05/task03-attempt2-repair1-management-review'
helper=qa/'local-resume-2026-10-05/task03-attempt3-target-management.mjs'
assert h(helper)=='a1b39e13afeccd3f81fb91fed9eef1228dc8e0d8886cb0bb4ba6f42ea871cd77'
assert sha(raw(helper).replace(b'task03-local-native-attempt3-',b'task03-local-native-attempt2-').replace(b'task03-attempt3-',b'task03-attempt2-'))=='213739458a90078a164cb4b87a583364109d43c2e2ee6687b8a2c97a0600a457'
assert h(prev/'offline-vm-harness.mjs')=='3e4c5a35bb41cf0f898a3126ffef9c34dd155d1447a428675426324f991c97c1'
copier=qa/'local-resume-2026-10-05/task03-attempt3-linux-public-transfer.py';h(copier)
priorcopier=qa/'local-resume-2026-10-05/task03-attempt2-linux-public-transfer.py';h(priorcopier)
summary={'status':'PASS','scope':'PREPARATION_ONLY','hashes':expected,'frozenFiles':965,'manifestEntries':964,'previousAttemptRecovery':{'namespaceExact':833,'currentExact':824,'explicitPreimages':9},'acceptedAncestry':{'namespaceExact':559,'currentExact':550,'explicitPreimages':9},'sourcePins':161,'testPins':155,'managedCopies':138,'historicalReferences':23,'compilerProjection':114,'registrations':{'product':275,'public':200,'internal':75,'expectedNative':287},'conservedCounts':f['requiredConservedCounts'],'observedProducerControls':{'source':47,'filesystem':3,'cleanupDriver':28,'guardNegatives':40},'reusedTests':{'passed':1005,'suites':17,'newExecution':False},'reusedLinuxReadiness':{'memoryBytes':2147483648,'newExecution':False},'privateReads':0,'candidateWrites':0,'serviceCalls':0}
name=sys.argv[1] if len(sys.argv)>1 else 'integrity-before'
(out/(name+'.json')).write_text(json.dumps(summary,indent=2)+'\n')
by_path={r['path']:r for r in bindings}
(out/(name+'-source-bindings.json')).write_text(json.dumps({'scope':'CURRENT_PUBLIC_HELD_READ_BINDINGS_ONLY','observations':list(by_path.values()),'historicalIdentitiesReconstructed':False},indent=2)+'\n')
print(json.dumps(summary))
