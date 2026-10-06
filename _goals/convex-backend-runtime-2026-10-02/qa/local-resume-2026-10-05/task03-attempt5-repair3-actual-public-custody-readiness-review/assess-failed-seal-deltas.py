"""Account every old failed-manifest delta and later file without refreshing a pin."""
import hashlib
import json
import os
from pathlib import Path
import stat
O=Path(__file__).parent
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
F=('st_dev','st_ino','st_mode','st_nlink','st_uid','st_gid','st_size','st_mtime_ns','st_ctime_ns')
def identity(s):return {k:str(getattr(s,k)) for k in F}
def held(path):
    before=path.lstat();assert stat.S_ISREG(before.st_mode) and before.st_nlink==1 and path.resolve()==path
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
    try:
        pin=identity(before);assert identity(os.fstat(fd))==pin;h=hashlib.sha256();size=0
        while True:
            raw=os.read(fd,65536)
            if not raw:break
            size+=len(raw);assert size<=4*1024*1024;h.update(raw)
        assert size==before.st_size and identity(os.fstat(fd))==identity(path.lstat())==pin
        return {'path':str(path.relative_to(R)),'sha256':h.hexdigest(),'bytes':size,'identityDecimal':pin,'fullEOF':True,'allNinePreOpenPostFinal':True}
    finally:os.close(fd)
mf=O/'final-evidence-manifest.json';meta=held(mf)
assert meta['sha256']=='20b655f1f79e3675a8d171edb63a9daba7dffe7ac9e983b393769989afd717a9'
manifest=json.loads(mf.read_bytes());expected={r['path']:r for r in manifest['files']};deltas=[];unchanged=[]
for row in manifest['files']:
    current=held(R/row['path'])
    if current['sha256']!=row['sha256'] or current['bytes']!=row['bytes'] or current['identityDecimal']!=row['identityDecimal']:
        deltas.append({'path':row['path'],'expected':row,'current':current,
          'fieldsChanged':[k for k in F if row['identityDecimal'][k]!=current['identityDecimal'][k]],
          'contentChanged':current['sha256']!=row['sha256'],'bytesChanged':current['bytes']!=row['bytes'],
          'reason':'EXPLICIT_REPORT_VERDICT_EXCLUSION_AMENDMENT_WITH_EXACT_FIRST_BYTES_PREIMAGE' if (R/row['path']).name in ['report.md','verdict.json'] else 'FAILED_DELAYED_CTIME_INITIAL_OBSERVATION_PRESERVED'})
    else:unchanged.append(current)
assert {Path(row['path']).name for row in deltas}=={'report.md','verdict.json','pre-manifest-final-assessment.json'}
later=[]
for root,dirs,files in os.walk(O,followlinks=False):
    root=Path(root);assert root.resolve()==root
    for name in dirs:assert stat.S_ISDIR((root/name).lstat().st_mode) and not (root/name).is_symlink()
    for name in files:
        path=root/name
        if str(path.relative_to(R)) not in expected and path!=mf:later.append(held(path))
assert not (O/'own-final-source-pin.json').exists()
anchors=json.loads((O/'final-operative-evidence-anchors.json').read_bytes())
for row in anchors['files']:assert held(R/row['path'])==row
assert json.loads((O/'verdict.json').read_bytes())['ownEvidenceSeal']=='FAILED_PRESERVED_NOT_OPERATIONAL_AUTHORITY'
value={'scope':'FAILED_OWN_QA_SEAL_DELTA_ACCOUNTING_ONLY_NOT_OPERATIONAL_AUTHORITY','status':'FAILED_PRESERVED',
  'ownFiniteManifestAll9Seal':'FAIL','ownFinalSourcePinExists':False,'failedFirstManifest':meta,'originalFiles':len(expected),
  'unchangedOriginalFiles':len(unchanged),'oldManifestDeltas':deltas,'laterFiles':sorted(later,key=lambda r:r['path']),
  'laterFilesAccounted':len(later),'selfExcluded':'final-source-assessment.json','failedManifestRefreshed':False,
  'sourcePinRefreshed':False,'newCopiedEvidenceCohortCreated':False,
  'currentOperationalRawContentAnchors':'PASS_ALL9_FULL_EOF_HASH_SIZE_UNCHANGED',
  'currentOperationalCustodyReadinessVerdict':'PASS_WITHIN_DISTINCT_SCOPES','historicalSourceIdentityRestored':False,
  'privateOperationReleased':False,'nativeFoundationAccepted':False,'fullTask03':False,'goalAccepted':False,'writersStopped':True}
raw=(json.dumps(value,indent=2)+'\n').encode();fd=os.open(O/'final-source-assessment.json',os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
try:
    view=memoryview(raw)
    while view:
        count=os.write(fd,view);assert count>0;view=view[count:]
    os.fsync(fd)
finally:os.close(fd)
print(json.dumps({'operationalVerdict':'PASS','ownEvidenceSeal':'FAILED_PRESERVED','originalDeltas':len(deltas),'laterFilesAccounted':len(later),'ownFinalSourcePinExists':False,'writersStopped':True}))
