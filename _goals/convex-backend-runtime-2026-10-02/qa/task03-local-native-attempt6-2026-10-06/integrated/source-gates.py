"""Public-only immutable source and current independent release gates; no private access."""
from pathlib import Path
import hashlib,json,os,stat
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
QA=R/'_goals/convex-backend-runtime-2026-10-02/qa'
P=QA/'local-resume-2026-10-05/task03-attempt6-integrated-preparation'
Q=QA/'task03-local-native-attempt6-2026-10-06'
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def identity(s):return {k:str(getattr(s,'st_'+k))for k in FIELDS}
def strict(raw):
 def pairs(items):
  out={}
  for k,v in items:
   if k in out:raise ValueError('duplicate_public_gate_key')
   out[k]=v
  return out
 return json.loads(raw,object_pairs_hook=pairs,parse_constant=lambda x:(_ for _ in ()).throw(ValueError('nonfinite_gate')))
def digest(raw):return hashlib.sha256(raw).hexdigest()
def read(path,pin=None):
 assert path.is_absolute()and path.is_relative_to(R)and path.resolve()==path
 pre=os.lstat(path);assert stat.S_ISREG(pre.st_mode)and pre.st_nlink==1 and pre.st_uid==501 and pre.st_gid==20 and 0<=pre.st_size<=16*1024*1024
 fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  current=identity(pre);assert current==identity(os.fstat(fd))
  if pin is not None:assert current==pin
  raw=bytearray()
  while data:=os.read(fd,65536):raw.extend(data);assert len(raw)<=pre.st_size
  assert len(raw)==pre.st_size
  assert current==identity(os.fstat(fd))==identity(os.lstat(path))
  return bytes(raw)
 finally:os.close(fd)
def expected_source_paths():
 frozen=strict(read(Q/'candidate-freeze-attempt6.json'))
 assert len(frozen['files'])==1907
 paths={Q/row['path']for row in frozen['files']}
 paths.update(Q/name for name in ('candidate-freeze-attempt6.json','integrated/coordinate-common.py','integrated/retire-selector.py','integrated/linux-private-custody-crypto-observer.mjs','integrated/source-gates.py','integrated/official-dispatcher.py','integrated/private-coordinate.py','integrated/reuse-private-key.py','coordinate-source/task03-attempt5-coordinate-common.py','coordinate-source/task03-attempt5-linux-public-transfer.py','coordinate-source/task03-attempt5-public-coordinate.py','coordinate-source/public-recipe-binding.json','coordinate-source/source-receipt-manifest.json'))
 paths.update(P/name for name in ('target-management.mjs','prospective-binding.json','collect-operative-source.py'))
 for file,field in [('source-inventory.json','path'),('attempt2/compiler-projection.json','source'),('attempt2/cli-source-pins.json','path'),('historical-script-provenance.json','historicalSource')]:
  for row in strict(read(Q/file))['files']:paths.add(R/row[field])
 assert all(path.is_relative_to(R)and path.resolve()==path for path in paths)
 return sorted(paths)

def qualify_sources():
 mfraw=read(P/'operative-source-manifest.json');mf=strict(mfraw)
 approvalraw=read(P/'integrated-source-review.json');approval=strict(approvalraw)
 assert approval['verdict']=='PASS'and approval['independent']is True and approval['scope']=='TASK03_ATTEMPT6_INTEGRATED_SOURCE_ONLY'
 assert approval['sourceManifestSha256']==digest(mfraw)
 assert approval['candidateSha256']==digest(read(Q/'candidate-freeze-attempt6.json'))
 assert mf['scope']=='FIRST_PROSPECTIVE_COMPLETE_OPERATIVE_SOURCE_CLOSURE_ONLY'and mf['status']=='READY_FOR_FIRST_INDEPENDENT_REVIEW'
 assert len(mf['files'])==len({row['path']for row in mf['files']})
 assert {R/row['path']for row in mf['files']}==set(expected_source_paths())
 assert set(approval['sources'])=={row['path']for row in mf['files']}
 held=[]
 try:
  for row in mf['files']:
   path=R/row['path'];assert path.is_relative_to(R)and path.resolve()==path
   pre=os.lstat(path);assert stat.S_ISREG(pre.st_mode)and pre.st_nlink==1
   fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW);held.append((path,fd,row['PRE']))
   assert identity(pre)==identity(os.fstat(fd))==row['PRE']
   raw=bytearray()
   while data:=os.read(fd,65536):raw.extend(data);assert len(raw)<=16777216
   assert len(raw)==row['bytes']and digest(raw)==row['sha256']==approval['sources'][row['path']]
   assert identity(os.fstat(fd))==identity(os.lstat(path))==row['PRE']
  for path,fd,pin in held:assert identity(os.fstat(fd))==identity(os.lstat(path))==pin
 finally:
  for path,fd,pin in held:os.close(fd)
 return approval,digest(approvalraw),digest(mfraw)
def qualify_public_release():
 approval,approval_sha,mf_sha=qualify_sources();binding=strict(read(P/'prospective-binding.json'));freeze_sha=digest(read(Q/'candidate-freeze-attempt6.json'))
 assert freeze_sha==binding['freezeSha256']==approval['candidateSha256']
 request=strict(read(Q/'project-request.json'));transport=strict(read(Q/'transport-prep/transport-binding.json'))
 assert request['operation']==binding['operation']==transport['operation']
 assert digest(json.dumps(request,separators=(',',':'),ensure_ascii=False).encode())==binding['requestSha256']==transport['requestSha256']
 prep=strict(read(Q/'independent-preparation-review.json'))
 assert prep['scope']=='BOUNDED_03_FOUNDATION_CURRENT_DELTA_PREPARATION'and prep['verdict']=='PASS'and prep['independent']is True
 assert prep['candidateSha256']==freeze_sha and type(prep['candidateMembers'])is int and prep['candidateMembers']==binding['candidateMembers']
 management=strict(read(P/'task03-attempt6-management-review.json'))
 assert management['scope']=='TASK03_DISPOSABLE_TARGET_MANAGEMENT_ONLY'and management['verdict']=='PASS'and management['independent']is True
 assert management['managementSourceSha256']==digest(read(P/'target-management.mjs')) and management['requestSha256']==binding['requestSha256']
 custody=strict(read(P/'task03-attempt6-linux-public-custody-review.json'))
 assert custody['scope']=='TASK03_ACTUAL_PUBLIC_LINUX_CUSTODY_ONLY'and custody['verdict']=='PASS'and custody['independent']is True
 assert custody['operation']==binding['operation']and custody['volume']==binding['volume']and custody['candidateSha256']==freeze_sha
 assert type(custody['publicFiles'])is int and custody['publicFiles']==binding['publicCopiedFiles']
 assert custody['allCurrentDestinationIdentities']=='PASS_ALL9'and custody['currentSourceDestinationFullContent']=='PASS'
 assert custody['publicRecipeBindingSha256']==digest(read(Q/'coordinate-source/public-recipe-binding.json'))
 assert custody['publicSourceManifestSha256']==digest(read(Q/'coordinate-source/source-receipt-manifest.json'))
 return {'binding':binding,'approvalSha256':approval_sha,'sourceManifestSha256':mf_sha}
