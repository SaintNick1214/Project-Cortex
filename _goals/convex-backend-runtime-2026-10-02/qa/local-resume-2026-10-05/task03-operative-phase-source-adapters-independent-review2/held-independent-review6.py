"""Finite held N2 reviewer execution; explicit discovery-header stages."""
import os,time,stat,json,hashlib,traceback
from pathlib import Path
F=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns');A=('st_dev','st_ino','st_mode','st_uid','st_gid','st_nlink','st_size','st_mtime_ns','st_ctime_ns')
def nine(s):return dict(zip(F,(str(getattr(s,k)) for k in A)))
def sha(raw):return hashlib.sha256(raw).hexdigest()
def run(root,review,output,known):
 R=Path(root);J=Path(review);P=J.parent;N=P/'task03-operative-phase-source-adapters2';held=[];records=[];bodies={};events=[];errors=[];results=None;start=time.monotonic();body_start=None
 def deadline():
  if time.monotonic()-start>190:raise TimeoutError('REVIEW_GLOBAL190')
  if body_start is not None and time.monotonic()-body_start>48:raise TimeoutError('REVIEW_BODY48')
 def openrow(path,size,digest,pin,basis,stop=None):
  deadline();p=Path(path);pre=os.lstat(p);current=nine(pre);age=(time.time_ns()-max(pre.st_mtime_ns,pre.st_ctime_ns))/1e9
  if not stat.S_ISREG(pre.st_mode) or pre.st_uid!=501 or pre.st_gid!=20 or pre.st_nlink!=1 or pre.st_size!=size:raise ValueError('SOURCE_PHYSICAL_SIZE_OWNER_LINK')
  if size>16777216 or age<240 or (stop is not None and max(pre.st_mtime_ns,pre.st_ctime_ns)>stop):raise ValueError('SOURCE_FILE_CAP_OR_STOP_MATURITY')
  if pin is not None and current!=pin:raise ValueError('STRICT_ORIGINAL_NINE_CHANGED:'+str(p))
  if any(r['path']==str(p) for r in records):raise ValueError('DUPLICATE_PHYSICAL_NOT_SILENTLY_DEDUPED')
  if len(held)>=4096 or sum(r['bytes'] for r in records)+size>67108864:raise ValueError('LOCAL_SOURCE_CAP')
  fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW);r={'path':str(p),'bytes':size,'sha256':digest,'PRE9':current,'basis':basis,'ageSeconds':age,'closeCount':0};held.append((fd,r));records.append(r);r['OPEN9']=nine(os.fstat(fd));events.append(['OPEN',str(p),fd])
  if r['OPEN9']!=current:raise ValueError('OPEN_NINE_CHANGED')
  return fd,r
 def read(fd,r,stage):
  deadline();raw=b'';off=0
  while True:
   deadline();x=os.pread(fd,262144,off)
   if not x:break
   raw+=x;off+=len(x)
   if len(raw)>r['bytes']:raise ValueError('EOF_OVERRUN')
  r['POST9']=nine(os.fstat(fd));r['fullEOF']=True;events.append(['FULL_EOF',r['path'],stage,len(raw)])
  if len(raw)!=r['bytes'] or sha(raw)!=r['sha256'] or r['POST9']!=r['PRE9']:raise ValueError('EOF_HASH_SIZE_NINE')
  bodies[r['path']]=raw;return raw
 try:
  headers=[]
  for path,size,digest in [(N/'closed-source-reference-manifest.json',95395,'56eb5734860c7acb40c94305eaf62c4d737ae048dcf0e5c59097178098a525d7'),(N/'final-writers-stopped.json',1769,'c568ea5ff3cd22f377b1db0532a41dfc24f981373b3be239c3e25c24a86ae3ba'),(J/'execution-writers-stopped6.json',known['stopBytes'],known['stopSha256'])]:headers.append(openrow(path,size,digest,None,'SEPARATE_MATURE_HEADER_DISCOVERY_CURRENT_DOCUMENTARY_TUPLE'))
  mf=json.loads(read(*headers[0],'HEADER'));stop=json.loads(read(*headers[1],'HEADER'));own=json.loads(read(*headers[2],'HEADER'))
  if stop['stoppedUnixNs']!=1791430499341829000 or stop['remainingWrites'] or len(mf['inputs'])!=52 or sum(r['bytes'] for r in mf['inputs'])!=1050601:raise ValueError('ANNOUNCED_FINITE_PACKET_OR_STOP_CHANGED')
  if time.time_ns()-stop['stoppedUnixNs']<240000000000 or time.time_ns()-own['stoppedAtUnixNs']<240000000000:raise ValueError('ACTUAL_STOP_AGE_LT240')
  refs=list(mf['inputs'])+[r for r in stop['publishers'] if Path(r['path']).name!='closed-source-reference-manifest.json'];members=[]
  # Complete metadata census precedes any member body, with original nine
  # strict and ONLY four newly closed final publishers documentary-current.
  for r in refs:
   pre=os.lstat(r['path']);pin=r.get('PRE9')
   if pin is not None and nine(pre)!=pin:raise ValueError('METADATA_CENSUS_ORIGINAL_NINE_CHANGED:'+r['path'])
   if time.time_ns()-max(pre.st_mtime_ns,pre.st_ctime_ns)<240000000000:raise ValueError('METADATA_CENSUS_IMMATURE')
  for r in refs:members.append(openrow(r['path'],r['bytes'],r['sha256'],r.get('PRE9'),'ORIGINAL_MEMBER_STRICT' if r.get('PRE9') is not None else 'NEW_FINAL_PUBLISHER_CURRENT_DOCUMENTARY'))
  for r in own['members']:
   if r['path']==str(J/'held-independent-review6.py') and r['sha256']!=known['entrySha256']:raise ValueError('ENTRY_PIN_CHANGED')
   members.append(openrow(r['path'],r['bytes'],r['sha256'],r['nine'],'ORIGINAL_OWN_EXECUTION_SOURCE_PIN',own['stoppedAtUnixNs']))
  events.append(['ALL_DECLARED_MEMBER_FDS_BEFORE_FIRST_MEMBER_BODY',len(members)]);body_start=time.monotonic()
  for fd,r in members:read(fd,r,'MEMBER')
  paths={'adapter':str(N/'source_adapters2.py'),'api':str(P/'task03-f2-close-fence-repair6'/'phase_partition4.py')};source=str(J/'independent-controls4.py');ns={};exec(compile(bodies[source],source,'exec',dont_inherit=True),ns);results=ns['run'](bodies,paths,str(J));deadline()
 except BaseException as e:errors.append({'stage':'capture_or_controls','type':type(e).__name__,'error':str(e),'traceback':traceback.format_exc()})
 finally:
  for fd,r in held:
   try:
    raw=b'';off=0
    while True:
     x=os.pread(fd,262144,off)
     if not x:break
     raw+=x;off+=len(x)
     if len(raw)>r['bytes']:raise ValueError('FINAL_OVERRUN')
    r['FINAL9']=nine(os.fstat(fd));r['finalBytes']=len(raw);r['finalSha256']=sha(raw);r['finalEOF']=True
    if len(raw)!=r['bytes'] or sha(raw)!=r['sha256'] or r['FINAL9']!=r['PRE9']:raise ValueError('FINAL_EOF_HASH_SIZE_NINE')
   except BaseException as e:errors.append({'stage':'final:'+r['path'],'type':type(e).__name__,'error':str(e)})
  for fd,r in held:
   r['closeCount']+=1
   try:os.close(fd);r['closeSuccess']=True
   except BaseException as e:errors.append({'stage':'close:'+r['path'],'type':type(e).__name__,'error':str(e)})
   events.append(['CLOSE',r['path'],fd])
 packet={'scope':'INDEPENDENT_N2_CODE_BEHAVIOR_HOST_SOURCE_ONLY','sourceRecords':records,'events':events,'sourceCount':len(records),'sourceBytes':sum(r['bytes'] for r in records),'ownedOnceCloses':sum(r['closeCount'] for r in records),'errors':errors,'results':results,'elapsedSeconds':time.monotonic()-start,'SourceEligibility':False,'functionalAcceptance':False,'phaseAPI':'EXACT_R6_REJECTED_INJECTION_NO_ADOPTION','wholeRootSharedLedgerABIAndSourceCensus':'PENDING_UNKNOWN','candidateEdits':0,'networkDockerServicePrivateEffects':0};Path(output).write_text(json.dumps(packet,indent=2,sort_keys=True)+'\n');return packet
