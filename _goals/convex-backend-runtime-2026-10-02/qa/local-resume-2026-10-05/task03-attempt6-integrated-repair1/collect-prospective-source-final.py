"""ONE new prospective stopped-writer source capture; never refresh a d101 tuple."""
from pathlib import Path
import os,stat,json,hashlib,time,resource,datetime
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion');P=R/'_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task03-attempt6-integrated-repair1';FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def identity(s):return {f:str(getattr(s,'st_'+f))for f in FIELDS}
def publish(path,value):
 fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o644)
 data=json.dumps(value,indent=2)+'\n'
 with os.fdopen(fd,'w')as out:out.write(data);out.flush();os.fsync(out.fileno())
 return data.encode()
def current_read(path):
 pre=os.lstat(path);fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  pin=identity(pre);assert pin==identity(os.fstat(fd));data=bytearray()
  while b:=os.read(fd,65536):data.extend(b);assert len(data)<=pre.st_size<=16777216
  assert len(data)==pre.st_size and pin==identity(os.fstat(fd))==identity(os.lstat(path));return bytes(data)
 finally:os.close(fd)
planraw=current_read(P/'prospective-source-plan-final.json');plan=json.loads(planraw);stopraw=current_read(P/'source-writers-stopped-final.json');stop=json.loads(stopraw)
assert stop['sourceWriters']=='STOPPED'and stop['remainingSourceWrites']==[]
assert time.time_ns()>=int(stop['stoppedUnixNs'])+60000000000,'sixty_second_stopped_maturity_required'
captured_ns=time.time_ns()
assert plan['scope']=='TASK03_ATTEMPT6_REPAIR1_FINITE_SOURCE_PLAN_ONLY'and plan['historicalD101OriginalCustody']=='FAILED_UNKNOWN_ONE_CTIME_NOT_REPAIRED'
assert len(plan['members'])==len({row['path']for row in plan['members']})
expected={row['path']:row for row in plan['members']};paths=sorted({R/row['path']for row in plan['members']}|{P/'prospective-source-plan-final.json',P/'source-writers-stopped-final.json'});assert len(paths)<=4096
soft,hard=resource.getrlimit(resource.RLIMIT_NOFILE);assert soft>=len(paths)+32
held=[];rows=[];bytes_total=0;historical=[]
try:
 # Every PRE/path/OPEN descriptor is captured before first source content qualification.
 for path in paths:
  assert path.is_absolute()and path.is_relative_to(R)and path.resolve()==path
  pre=os.lstat(path);fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW);held.append((path,fd,identity(pre)))
 for path,fd,pin in held:
  assert stat.S_ISREG(int(pin['mode']))and pin['uid']=='501'and pin['gid']=='20'and pin['nlink']=='1'
  assert pin==identity(os.fstat(fd))==identity(os.lstat(path))
  assert path==P/'source-writers-stopped-final.json'or int(pin['ctime_ns'])<=int(stop['stoppedUnixNs'])
  assert int(pin['ctime_ns'])+60000000000<=captured_ns,'each_input_metadata_must_be_mature_for_sixty_seconds'
  content=bytearray()
  while data:=os.read(fd,65536):content.extend(data);assert len(content)<=int(pin['size'])<=16777216
  assert len(content)==int(pin['size']);digest=hashlib.sha256(content).hexdigest();rel=str(path.relative_to(R))
  if rel in expected:
   bound=expected[rel];assert len(content)==bound['bytes']and digest==bound['sha256']
   if 'historicalD101PRE'in bound and pin!=bound['historicalD101PRE']:
    historical.append({'path':rel,'originalD101PRE':bound['historicalD101PRE'],'newProspectivePRE':pin,'differenceCause':'UNKNOWN','originalPinRefreshed':False})
  bytes_total+=len(content);assert bytes_total<=67108864
  assert pin==identity(os.fstat(fd))==identity(os.lstat(path))
  rows.append({'path':rel,'bytes':len(content),'sha256':digest,'PRE':pin,'OPEN':identity(os.fstat(fd)),'POST':identity(os.fstat(fd)),'pathPOST':identity(os.lstat(path)),'fullEOF':True,'provenanceRole':expected.get(rel,{}).get('provenanceRole','NEW_PROSPECTIVE_CONTROL'),'historicalCustodyRepaired':False})
 known=plan['knownFailedHistoricalPath'];assert len(historical)==1 and historical[0]['path']==known
 assert {field for field in FIELDS if historical[0]['originalD101PRE'][field]!=historical[0]['newProspectivePRE'][field]}=={'ctime_ns'}
 for path,fd,pin in held:assert pin==identity(os.fstat(fd))==identity(os.lstat(path))
 manifest={'scope':'TASK03_ATTEMPT6_REPAIR1_NEW_PROSPECTIVE_SOURCE_CLOSURE_ONLY','status':'READY_FOR_FRESH_INDEPENDENT_REVIEW','sourceWriters':'STOPPED','capturedUnixNs':str(captured_ns),'sourcePlanSha256':hashlib.sha256(planraw).hexdigest(),'sourceWritersStoppedSha256':hashlib.sha256(stopraw).hexdigest(),'historicalD101OriginalCustody':'FAILED_UNKNOWN_ONE_CTIME_NOT_REPAIRED','historicalSourceManifestSha256':'d1012a242bcf52899d63199798ae9c97b821ca04acc00a29db164e889cfff7f1','historicalDifferences':historical,'historicalCustodyRepaired':False,'originalPinsRefreshed':False,'members':len(rows),'bytes':bytes_total,'memberCeiling':4096,'byteCeiling':67108864,'fileByteCeiling':16777216,'allDescriptorsCapturedBeforeFirstContent':True,'allDescriptorsHeldThroughFinalPublication':True,'files':rows,'privateAccess':0,'externalEffects':0,'goal':'OPEN','observedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()}
 mraw=publish(P/'prospective-source-manifest-final.json',manifest)  # Publisher bytes only; no immediate physical MF baseline.
 for path,fd,pin in held:assert pin==identity(os.fstat(fd))==identity(os.lstat(path))
 handoff={'scope':'REPAIR1_STOPPED_SOURCE_HANDOFF_ONLY_NOT_ACCEPTANCE','sourceWriters':'STOPPED','manifestPath':str(P/'prospective-source-manifest-final.json'),'sourceManifestSha256':hashlib.sha256(mraw).hexdigest(),'sourceManifestPhysicalNine':'REQUIRES_NEW_INDEPENDENT_CAPTURE_AFTER_OUTPUT_MATURITY','sourcePlanSha256':manifest['sourcePlanSha256'],'sourceWritersStoppedSha256':manifest['sourceWritersStoppedSha256'],'members':len(rows),'bytes':bytes_total,'historicalOriginalCustody':'FAILED_UNKNOWN_ONE_CTIME_NOT_REPAIRED','privateAccess':0,'externalEffects':0,'runtime':'HELD','independentReview':'REQUIRED_NEW_FRESH_JUDGE','goal':'OPEN'}
 publish(P/'source-closure-handoff-final.json',handoff)
 for path,fd,pin in held:assert pin==identity(os.fstat(fd))==identity(os.lstat(path))
 print(json.dumps(handoff))
finally:
 for _,fd,_ in held:os.close(fd)
