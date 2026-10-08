from pathlib import Path
import os,stat,json,hashlib,gzip,datetime,re
R=Path('/workspace/Project-Cortex');W=R/'work/resume/task04-c7-exact-identity-repair';Q=R/'_goals/convex-backend-runtime-2026-10-02/qa';K=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def ident(s):return {k:str(getattr(s,'st_'+k)) for k in K}
def held(p,retain=False):
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW);chunks=[];h=hashlib.sha256();n=0
 try:
  a=os.fstat(fd);assert stat.S_ISREG(a.st_mode) and a.st_nlink==1
  while True:
   b=os.read(fd,1048576)
   if not b:break
   h.update(b);n+=len(b)
   if retain:chunks.append(b)
  assert ident(a)==ident(os.fstat(fd))==ident(os.lstat(p))
 finally:os.close(fd)
 return {'path':str(p),'bytes':n,'sha256':h.hexdigest(),'currentIdentity':ident(a)},b''.join(chunks)
prePin,b=held(W/'controls-PRE.json',True);pre=json.loads(b);postPin,b=held(W/'controls-receipt.json',True);post=json.loads(b)
assert post['actualExit']==0 and not post['timeout'] and post['sourceToolsExactEqual'] and post['deadlineSeconds']==pre['deadlineSeconds']==90
assert post['argv']==pre['argv'] and post['cwd']==pre['cwd'] and post['env']==pre['env']
assert len(pre['sourceTools'])==len(post['sourceToolPOST'])==131
verified=[]
for a,z in zip(pre['sourceTools'],post['sourceToolPOST']):
 assert a['path']==z['path'] and a['identity']==z['identity'] and a['bytes']==z['bytes'] and a['sha256']==z['sha256'] and z['equal']
 identity=a['identity'];assert identity['schema']=='FS_IDENTITY_DECIMAL_V1' and set(identity)=={'schema','fields'} and set(identity['fields'])==set(K)
 for key,v in identity['fields'].items():assert isinstance(v,str) and str(int(v))==v and (key in ('mtime_ns','ctime_ns') or int(v)>=0)
 backing=a['beforeByteBacking'];pin,_=held(backing['path']);assert pin['bytes']==backing['bytes'] and pin['sha256']==backing['sha256'];h=hashlib.sha256();n=0
 fd=os.open(backing['path'],os.O_RDONLY|os.O_NOFOLLOW)
 try:
  assert ident(os.fstat(fd))==pin['currentIdentity']
  with os.fdopen(fd,'rb',closefd=False) as encoded:
   with gzip.GzipFile(fileobj=encoded,mode='rb') as decoded:
    while True:
     body=decoded.read(1048576)
     if not body:break
     h.update(body);n+=len(body)
  assert ident(os.fstat(fd))==ident(os.lstat(backing['path']))==pin['currentIdentity']
 finally:os.close(fd)
 assert n==a['bytes'] and h.hexdigest()==a['sha256'];verified.append(pin)
raws=[];result=None
for row in post['raws']:
 pin,b=held(row['path'],True);assert pin['bytes']==row['bytes'] and pin['sha256']==row['sha256'];raws.append(pin)
 if Path(row['path']).name=='controls.stdout':result=json.loads(b)
assert result['scope']=='OWN_PROSPECTIVE_EXACT_IDENTITY_CONTROLS_ONLY' and len(result['results'])==20 and len({x['name'] for x in result['results']})==20 and all(x['status']=='PASS' for x in result['results']) and result['completeRepair'] is False
def events(r):return dict(line.split() for line in r['memory.events'].splitlines())
a=events(pre['resourcePRE']);b=events(post['resourcePOST']);assert all(a[k]==b[k] for k in ('oom','oom_kill','oom_group_kill'))
out={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'ROOT_INITIAL_RECORDED_20_SEMANTIC_CONTROLS_AND_FULL_PREIMAGE_INSPECTION_ONLY','pre':prePin,'receipt':postPin,'sourceToolPairsRecordedExactEqual':131,'fullCurrentEncodedAndDecodedPreimagesVerified':verified,'raws':raws,'recordedExit':0,'recordedElapsedSeconds':post['elapsedSeconds'],'recordedDeadlineSeconds':90,'recordedAssertions':result['results'],'oomDeltas':0,'candidateCurrentSource':'NOT_CERTIFIED_SOURCE_MIGRATION_CONTINUES','groupEvidenceLimit':'Receipt records groupEmpty Boolean; no initial PID/startTime/PGID/argv binding or census rows verified here. No fresh process-cleanup claim.','historicalCustodyLimit':'Full retained preimages and recorded PRE/POST pairs checked; current exact gzip identities do not establish earlier backing custody or current candidate readiness.','original122WholeNativePrivatePaidROOTApproval':'HELD_UNEXECUTED'}
(Q/'task04-c7-initial-controls-root-inspection.json').open('x').write(json.dumps(out,indent=2)+'\n');print(json.dumps({k:v for k,v in out.items() if k not in ('fullCurrentEncodedAndDecodedPreimagesVerified','recordedAssertions','raws','pre','receipt')}))
