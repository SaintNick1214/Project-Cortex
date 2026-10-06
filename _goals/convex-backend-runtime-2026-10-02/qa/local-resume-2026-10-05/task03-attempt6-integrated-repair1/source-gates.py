"""Public-only immutable source and current independent release gates; no private access."""
from pathlib import Path
import hashlib,json,os,stat
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
QA=R/'_goals/convex-backend-runtime-2026-10-02/qa'
P=QA/'local-resume-2026-10-05/task03-attempt6-integrated-repair1'
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
 plan=strict(read(P/'prospective-source-plan.json'))
 assert plan['scope']=='TASK03_ATTEMPT6_REPAIR1_FINITE_SOURCE_PLAN_ONLY'
 assert plan['historicalD101OriginalCustody']=='FAILED_UNKNOWN_ONE_CTIME_NOT_REPAIRED'
 assert len(plan['members'])==len({row['path']for row in plan['members']})
 paths={R/row['path']for row in plan['members']}|{P/'prospective-source-plan.json',P/'source-writers-stopped.json'}
 assert all(path.is_absolute()and path.is_relative_to(R)and path.resolve()==path for path in paths)
 return sorted(paths)
def reviewed_source(path):
 mf=strict(read(P/'prospective-source-manifest.json'));approval=strict(read(P/'integrated-source-review.json'))
 assert approval['scope']=='TASK03_ATTEMPT6_INTEGRATED_REPAIR1_SOURCE_ONLY'and approval['verdict']=='PASS'and approval['independent']is True
 assert digest(read(P/'prospective-source-manifest.json',approval['sourceManifestOriginalNine']))==approval['sourceManifestSha256']
 found=[row for row in mf['files']if row['path']==str(path.relative_to(R))];assert len(found)==1
 row=found[0];raw=read(path,row['PRE']);assert len(raw)==row['bytes']and digest(raw)==row['sha256']==approval['sources'][row['path']]
 return row,raw

def qualify_sources():
 approvalraw=read(P/'integrated-source-review.json');approval=strict(approvalraw)
 mfraw=read(P/'prospective-source-manifest.json',approval['sourceManifestOriginalNine']);mf=strict(mfraw)
 assert approval['verdict']=='PASS'and approval['independent']is True and approval['scope']=='TASK03_ATTEMPT6_INTEGRATED_REPAIR1_SOURCE_ONLY'
 assert approval['sourceManifestSha256']==digest(mfraw)
 assert approval['candidateSha256']==digest(read(Q/'candidate-freeze-attempt6.json'))
 assert mf['scope']=='TASK03_ATTEMPT6_REPAIR1_NEW_PROSPECTIVE_SOURCE_CLOSURE_ONLY'and mf['status']=='READY_FOR_FRESH_INDEPENDENT_REVIEW'and mf['sourceWriters']=='STOPPED'
 assert mf['historicalD101OriginalCustody']=='FAILED_UNKNOWN_ONE_CTIME_NOT_REPAIRED'
 planraw=read(P/'prospective-source-plan.json');assert digest(planraw)==mf['sourcePlanSha256']==approval['sourcePlanSha256']
 stopraw=read(P/'source-writers-stopped.json');stop=strict(stopraw)
 assert digest(stopraw)==mf['sourceWritersStoppedSha256']and stop['sourceWriters']=='STOPPED'and stop['remainingSourceWrites']==[]
 assert all(int(row['PRE']['ctime_ns'])<=int(stop['stoppedUnixNs'])for row in mf['files']if row['path']!=str((P/'source-writers-stopped.json').relative_to(R)))
 assert len(mf['files'])==len({row['path']for row in mf['files']})
 assert {R/row['path']for row in mf['files']}==set(expected_source_paths())
 assert set(approval['sources'])=={row['path']for row in mf['files']}
 plan=strict(planraw);planrows={row['path']:row for row in plan['members']}
 assert 0<len(mf['files'])<=4096 and sum(row['bytes']for row in mf['files'])<=67108864
 for row in mf['files']:
  assert type(row['bytes'])is int and 0<=row['bytes']<=16777216
  if row['path']in planrows:assert row['sha256']==planrows[row['path']]['sha256']and row['bytes']==planrows[row['path']]['bytes']
 held=[]
 try:
  # Acquire every original descriptor before qualifying any source content.
  for row in mf['files']:
   path=R/row['path'];assert path.is_relative_to(R)and path.resolve()==path
   pre=os.lstat(path);assert stat.S_ISREG(pre.st_mode)and pre.st_nlink==1
   fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW);held.append((path,fd,row))
   assert pre.st_uid==501 and pre.st_gid==20 and pre.st_size<=16777216
   assert identity(pre)==identity(os.fstat(fd))==row['PRE']
  for path,fd,row in held:
   raw=bytearray()
   while data:=os.read(fd,65536):raw.extend(data);assert len(raw)<=16777216
   assert len(raw)==row['bytes']and digest(raw)==row['sha256']==approval['sources'][row['path']]
   assert identity(os.fstat(fd))==identity(os.lstat(path))==row['PRE']
  for path,fd,row in held:assert identity(os.fstat(fd))==identity(os.lstat(path))==row['PRE']
 finally:
  for path,fd,row in held:os.close(fd)
 return approval,digest(approvalraw),digest(mfraw)
def qualify_public_release():
 approval,approval_sha,mf_sha=qualify_sources();binding=strict(read(P/'prospective-binding.json'));freeze_sha=digest(read(Q/'candidate-freeze-attempt6.json'))
 assert freeze_sha==binding['freezeSha256']==approval['candidateSha256']
 request=strict(read(Q/'project-request.json'));transport=strict(read(Q/'transport-prep/transport-binding.json'))
 assert request['operation']==binding['operation']==transport['operation']
 assert digest(json.dumps(request,separators=(',',':'),ensure_ascii=False).encode())==binding['requestSha256']==transport['requestSha256']
 prep=strict(read(P/'independent-preparation-review.json'))
 assert prep['scope']=='BOUNDED_03_FOUNDATION_CURRENT_DELTA_PREPARATION'and prep['verdict']=='PASS'and prep['independent']is True
 assert prep['candidateSha256']==freeze_sha and type(prep['candidateMembers'])is int and prep['candidateMembers']==binding['candidateMembers']
 management=strict(read(P/'task03-attempt6-management-review.json'))
 assert management['scope']=='TASK03_DISPOSABLE_TARGET_MANAGEMENT_ONLY'and management['verdict']=='PASS'and management['independent']is True
 assert management['managementSourceSha256']==digest(read(P/'target-management.mjs')) and management['requestSha256']==binding['requestSha256']
 custody=strict(read(P/'task03-attempt6-linux-public-custody-review.json'))
 assert custody['scope']=='TASK03_ACTUAL_PUBLIC_LINUX_CUSTODY_ONLY'and custody['verdict']=='PASS'and custody['independent']is True
 assert custody['operation']==binding['operation']and custody['volume']==binding['volume']and custody['candidateSha256']==freeze_sha
 assert custody['prospectiveSourceManifestSha256']==mf_sha and custody['sourceApprovalSha256']==approval_sha
 assert custody['immutableImage']=='sha256:9ff43bfe7849197a6dfbaa80f2d11a34db4202d8aaae269ddc8b740f7da75fb3'
 assert type(custody['publicFiles'])is int and custody['publicFiles']==binding['publicCopiedFiles']
 assert custody['allCurrentDestinationIdentities']=='PASS_ALL9'and custody['currentSourceDestinationFullContent']=='PASS'
 assert custody['publicRecipeBindingSha256']==digest(read(P/'public-recipe-binding.json'))
 assert custody['publicSourceManifestSha256']==digest(read(P/'public-source-receipt-manifest.json'))
 assert type(custody['publicTransferReceiptSha256'])is str and len(custody['publicTransferReceiptSha256'])==64 and all(c in '0123456789abcdef'for c in custody['publicTransferReceiptSha256'])
 return {'binding':binding,'approvalSha256':approval_sha,'sourceManifestSha256':mf_sha,'publicTransferReceiptSha256':custody['publicTransferReceiptSha256']}
