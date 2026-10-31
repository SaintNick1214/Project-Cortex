"""One finite evidence manifest, then own source pin; failed assessments stay failed."""
import hashlib
import json
import os
from pathlib import Path
import stat
import sys
O=Path(__file__).parent
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
FIELDS=('st_dev','st_ino','st_mode','st_nlink','st_uid','st_gid','st_size','st_mtime_ns','st_ctime_ns')
def ident(s):return {k:str(getattr(s,k)) for k in FIELDS}
def held(path):
    s=path.lstat();assert stat.S_ISREG(s.st_mode) and s.st_nlink==1 and s.st_uid==501 and s.st_gid==20 and path.resolve()==path
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
    try:
        pin=ident(s);assert ident(os.fstat(fd))==pin
        h=hashlib.sha256();size=0
        while True:
            raw=os.read(fd,65536)
            if not raw:break
            size+=len(raw);assert size<=4*1024*1024;h.update(raw)
        assert size==s.st_size and ident(os.fstat(fd))==ident(path.lstat())==pin
        return {'path':str(path.relative_to(R)),'sha256':h.hexdigest(),'bytes':size,'identityDecimal':pin,'fullEOF':True,'allNinePreOpenPostFinal':True}
    finally:os.close(fd)
def write(path,value):
    raw=(json.dumps(value,indent=2)+'\n').encode();fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
    try:
        view=memoryview(raw)
        while view:
            count=os.write(fd,view);assert count>0;view=view[count:]
        os.fsync(fd)
    finally:os.close(fd)
def names():
    files=[]
    for root,dirs,items in os.walk(O,followlinks=False):
        root=Path(root);assert root.resolve()==root
        for d in dirs:assert stat.S_ISDIR((root/d).lstat().st_mode) and not (root/d).is_symlink()
        for n in items:files.append(root/n)
    return sorted(files)
def compare(rows):
    failures=[]
    for row in rows:
        path=R/row['path'];current=held(path)
        if current!=row:failures.append({'path':row['path'],'expected':row,'current':current})
    return failures
if sys.argv[1]=='observe':
    assert not (O/'final-evidence-manifest.json').exists()
    rows=[held(p) for p in names()]
    failures=compare(rows)
    write(O/'pre-manifest-current-observation.json',{'status':'PASS' if not failures else 'FAIL_PRESERVED','files':rows,'failures':failures,'sourcePinsRefreshed':False,'firstManifestNotYetWritten':True})
    print(json.dumps({'status':'PASS' if not failures else 'FAIL','files':len(rows),'phase':'CURRENT_OBSERVATION_BEFORE_FIRST_MANIFEST'}))
    raise SystemExit(0 if not failures else 1)
if sys.argv[1]=='manifest':
    observation=json.loads((O/'pre-manifest-current-observation.json').read_bytes());assert observation['status']=='PASS'
    failures=compare(observation['files'])
    write(O/'pre-manifest-final-assessment.json',{'status':'PASS' if not failures else 'FAIL_PRESERVED','compared':len(observation['files']),'failures':failures,'originalObservationNotRefreshed':True})
    if failures:raise SystemExit(1)
    rows=[held(p) for p in names()]
    failures=compare(rows);assert not failures
    write(O/'final-evidence-manifest.json',{'scope':'FINITE_FINAL_INDEPENDENT_PUBLIC_CUSTODY_READINESS_EVIDENCE','status':'FROZEN_SOURCE_PIN_AND_FINAL_ASSESSMENT_REQUIRED','files':rows,'regularFiles':len(rows),'selfExcluded':True,'postManifestFiles':['own-final-source-pin.json','final-source-assessment.json'],'oldFailedRunsIncluded':True,'failedHistoricalPinsRefreshed':False})
    print(json.dumps({'status':'MANIFEST_FINALIZED_BEFORE_OWN_SOURCE_PIN','files':len(rows)}));raise SystemExit(0)
if sys.argv[1]=='pin':
    manifest_path=O/'final-evidence-manifest.json';meta=held(manifest_path);manifest=json.loads(manifest_path.read_bytes())
    failures=compare(manifest['files']);assert not failures
    source_names=['independent-audit-r3.py','linux-public-audit.py','linux-dependencies-readiness.mjs','finalize-review.py','seal-evidence.py']
    sources=[held(O/n) for n in source_names]
    write(O/'own-final-source-pin.json',{'scope':'OWN_FINAL_CURRENT_SOURCE_PIN_AFTER_FINITE_MANIFEST','manifest':meta,'sources':sources,'failedInitialAssessmentsPreserved':True,'sourcePinsRefreshed':False})
    print(json.dumps({'status':'OWN_SOURCE_PIN_WRITTEN_AFTER_MANIFEST','manifestSha256':meta['sha256'],'sources':len(sources)}));raise SystemExit(0)
assert sys.argv[1]=='verify'
pin=json.loads((O/'own-final-source-pin.json').read_bytes());manifest=json.loads((O/'final-evidence-manifest.json').read_bytes())
failures=compare([pin['manifest'],*pin['sources'],*manifest['files']])
expected={R/row['path'] for row in manifest['files']}|{O/'final-evidence-manifest.json',O/'own-final-source-pin.json'}
assert set(names())==expected
write(O/'final-source-assessment.json',{'scope':'FINAL_INDEPENDENT_PUBLIC_CUSTODY_READINESS_EVIDENCE_ASSESSMENT','status':'PASS' if not failures else 'FAIL_PRESERVED','finiteManifestAll9FullEOFHashSize':'PASS' if not failures else 'FAIL','ownSourcePinAll9FullEOFHashSize':'PASS' if not failures else 'FAIL','manifestSha256':pin['manifest']['sha256'],'regularEvidenceFiles':len(manifest['files']),'operativeSources':len(pin['sources']),'failures':failures,'pinRefreshPerformed':False,'writersStopped':True,'historicalFailedAssessmentsRemainFailed':True})
print(json.dumps({'status':'PASS' if not failures else 'FAIL','manifestSha256':pin['manifest']['sha256'],'files':len(manifest['files']),'sources':len(pin['sources'])}));raise SystemExit(0 if not failures else 1)
