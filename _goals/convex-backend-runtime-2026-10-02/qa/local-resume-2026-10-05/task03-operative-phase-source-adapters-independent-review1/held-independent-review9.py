"""Bounded reviewer capture: staged headers, full held cohort, finite controls."""
import os,stat,time,json,hashlib,traceback
from pathlib import Path
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
ATTRS=('st_dev','st_ino','st_mode','st_uid','st_gid','st_nlink','st_size','st_mtime_ns','st_ctime_ns')
def nine(s):return dict(zip(FIELDS,(str(getattr(s,k)) for k in ATTRS)))
def sha(raw):return hashlib.sha256(raw).hexdigest()
def run(root,review,output,entry_sha):
 R=Path(root);J=Path(review);P=J.parent;N=P/'task03-operative-phase-source-adapters1';E=N/'prospective-document-epoch2'
 started=time.monotonic();held=[];rows=[];bodies={};events=[];failures=[];results=None;control_start=None;newdocs=[]
 def clock():
  if time.monotonic()-started>190:raise TimeoutError('GLOBAL_190S')
  if control_start is not None and time.monotonic()-control_start>48:raise TimeoutError('CONTROL_BODY_48S')
 def openrow(path,size,digest,pin,basis,stop=None):
  clock();p=Path(path);p=p if p.is_absolute() else R/p
  if p.resolve()!=p:raise ValueError('NONCANONICAL_PATH')
  name=str(p)
  if any(r['path']==name for r in rows):raise ValueError('DUPLICATE_PHYSICAL_REFERENCE')
  st=os.lstat(p);current=nine(st);now=time.time_ns()
  if not stat.S_ISREG(st.st_mode) or st.st_uid!=501 or st.st_gid!=20 or st.st_nlink!=1:raise ValueError('REGULAR_OWNER_LINK')
  if pin is not None and current!=pin:raise ValueError('ORIGINAL_NINE_CHANGED:'+name)
  if st.st_size!=size or size>16777216:raise ValueError('FILE_BYTES_CAP')
  if now-max(st.st_mtime_ns,st.st_ctime_ns)<240000000000:raise ValueError('GENUINE_CURRENT_AGE_LT240:'+name)
  if stop is not None and max(st.st_mtime_ns,st.st_ctime_ns)>stop:raise ValueError('AFTER_STOP:'+name)
  if len(held)>=4096 or sum(r['bytes'] for r in rows)+size>67108864:raise ValueError('LOCAL_SOURCE_CAP_BEFORE_OPEN')
  fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW);r={'path':name,'bytes':size,'sha256':digest,'PRE9':current,'basis':basis,'ageSeconds':(now-max(st.st_mtime_ns,st.st_ctime_ns))/1e9,'fd':fd,'closeCount':0}
  held.append((fd,r));rows.append(r);events.append(['OPEN',name,fd]);r['OPEN9']=nine(os.fstat(fd))
  if r['OPEN9']!=current:raise ValueError('OPEN_NINE_CHANGED')
  return fd,r
 def readrow(fd,r,stage):
  clock();raw=b'';offset=0
  while True:
   clock();x=os.pread(fd,262144,offset)
   if not x:break
   raw+=x;offset+=len(x)
   if len(raw)>r['bytes']:raise ValueError('EOF_OVERRUN')
  r['POST9']=nine(os.fstat(fd));r['fullEOF']=True;events.append(['EOF',r['path'],stage,len(raw)])
  if len(raw)!=r['bytes'] or sha(raw)!=r['sha256'] or r['POST9']!=r['PRE9']:raise ValueError('FULL_EOF_HASH_SIZE_NINE:'+r['path'])
  bodies[r['path']]=raw;return raw
 try:
  # Three known finite headers are held before header content. The native
  # bootstrap separately retains the entry and own STOP through this run.
  headers=[]
  for p,size,digest,basis in (
   (E/'closed-input-reference-manifest2.json',39128,'3da5f0d404bc449dd1441aad6beb22a45388cd79c781ca6aded4daf069a1e38a','CURRENT_MATURE_CANDIDATE_HEADER'),
   (E/'final-writers-stopped2.json',3638,'2530be1ab71957806feb65d45e17f017c74f0aa927ed99f68a7e16e12bc995ed','CURRENT_MATURE_CANDIDATE_HEADER'),
   (J/'execution-writers-stopped9.json',None,None,'CURRENT_MATURE_REVIEWER_HEADER')):
   if size is None:
    st=os.lstat(p);size=st.st_size;digest=None
   headers.append(openrow(p,size,digest,None,basis))
  # The own STOP exact body/digest is passed from separately qualified native
  # bootstrap; no unbound ordinary body read occurs here.
  ownfd,ownrow=headers[2];ownrow['sha256']=entry_sha['stopSha256']
  mf=json.loads(readrow(*headers[0],'HEADER_DISCOVERY'));cstop=json.loads(readrow(*headers[1],'HEADER_DISCOVERY'));own=json.loads(readrow(*headers[2],'HEADER_DISCOVERY'))
  if time.time_ns()-1791425131397080000<240000000000 or time.time_ns()-own['stoppedAtUnixNs']<240000000000:raise ValueError('STOP_AGE_LT240')
  declarations=mf['members']
  if len(declarations)!=43 or sum(x['bytes'] for x in declarations)!=594245:raise ValueError('FINITE_MANIFEST_CHANGED')
  changed={str(E/'native-author-entry2.txt'):'1791425131443096826',str(E/'preparation-report2.json'):'1791425131445134333'}
  members=[]
  for r in declarations:
   path=r.get('physicalPath',r['path']);p=Path(path);p=p if p.is_absolute() else R/p;path=str(p)
   pin=dict(r['PRE9']);basis='STRICT_UNCHANGED_ORIGINAL_AUTHOR_NINE'
   if path in changed:
    old=dict(pin);pin['ctime_ns']=changed[path];basis='DISTINCT_NEW_CURRENT_DOCUMENTARY_NINE_OLD_INTERVAL_FAILED_UNKNOWN';newdocs.append({'path':path,'oldFailedNine':old,'newCurrentNine':pin,'bytes':r['bytes'],'sha256':r['sha256'],'additionalVersionDebt':r['bytes']})
   members.append(openrow(path,r['bytes'],r['sha256'],pin,basis,None if path in changed else 1791425131397080000))
  for r in own['members']:
   if r['path']==str(J/'held-independent-review9.py') and r['sha256']!=entry_sha['entrySha256']:raise ValueError('ENTRY_PUBLISHER_HASH_CHANGED')
   members.append(openrow(r['path'],r['bytes'],r['sha256'],r['nine'],'STRICT_REVIEWER_OWN_CURRENT_EXECUTION_PIN',own['stoppedAtUnixNs']))
  events.append(['ALL_CANDIDATE_AND_OWN_MEMBER_FDS_BEFORE_MEMBER_BODY',len(members)])
  control_start=time.monotonic()
  for fd,r in members:readrow(fd,r,'COMPLETE_MEMBER_BODY')
  paths={'adapter':str(N/'source_adapters1.py'),'api':str(P/'task03-f2-phase-contract-repair5'/'phase_partition3.py')}
  cp=str(J/'independent-controls7.py');namespace={};exec(compile(bodies[cp],cp,'exec',dont_inherit=True),namespace)
  results=namespace['run'](bodies,paths,str(J));clock()
 except BaseException as e:failures.append({'stage':'capture_or_controls','type':type(e).__name__,'error':str(e),'traceback':traceback.format_exc()})
 finally:
  for fd,r in held:
   try:
    raw=b'';offset=0
    while True:
     x=os.pread(fd,262144,offset)
     if not x:break
     raw+=x;offset+=len(x)
     if len(raw)>r['bytes']:raise ValueError('FINAL_OVERRUN')
    r['FINAL9']=nine(os.fstat(fd));r['finalBytes']=len(raw);r['finalSha256']=sha(raw);r['finalEOF']=True
    if len(raw)!=r['bytes'] or r['FINAL9']!=r['PRE9'] or (r['sha256'] is not None and sha(raw)!=r['sha256']):raise ValueError('FINAL_EOF_HASH_SIZE_NINE')
   except BaseException as e:failures.append({'stage':'final:'+r['path'],'type':type(e).__name__,'error':str(e)})
  for fd,r in held:
   r['closeCount']+=1
   try:os.close(fd);r['closeSuccess']=True
   except BaseException as e:r['closeSuccess']=False;failures.append({'stage':'close:'+r['path'],'type':type(e).__name__,'error':str(e)})
   events.append(['CLOSE',r['path'],fd])
 packet={'scope':'INDEPENDENT_CODE_BEHAVIOR_HOST_SOURCE_ONLY','elapsedSeconds':time.monotonic()-started,'sourceRows':rows,'events':events,'actualSourceCount':len(rows),'actualSourceBytes':sum(r['bytes'] for r in rows),'ownedCloseCount':sum(r['closeCount'] for r in rows),'failures':failures,'results':results,'newDocumentaryAdmissions':newdocs,'oldE2FailuresPreserved':True,'additionalChangedVersionDebtBytes':9556,'priorChangedVersionDebtBytes':10206,'refundOrReset':False,'limits':{'uniqueAndSimultaneousFD':4096,'cumulativeSourceBytes':67108864,'fileBytes':16777216,'oneDATABytes':2097152,'globalSeconds':190,'controlBodySeconds':48},'fullParentSharedLedgerAndWholeCurrentCensus':'PENDING_UNKNOWN','sourceEligibility':False,'functionalAcceptance':False,'DockerOrServiceOrPrivateEffects':0}
 Path(output).write_text(json.dumps(packet,indent=2,sort_keys=True)+'\n');return packet
