from pathlib import Path
import os,stat,json,hashlib,gzip,datetime,re
R=Path('/workspace/Project-Cortex');W=R/'work/resume/task04-c7-exact-identity-repair';Q=R/'_goals/convex-backend-runtime-2026-10-02/qa';K=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def ident(s):return {k:str(getattr(s,'st_'+k)) for k in K}
def pairs(rows):
 out={}
 for k,v in rows:
  assert k not in out;out[k]=v
 return out
def held(p,expected=None,decoded=False,want=False):
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  a=os.fstat(fd);assert stat.S_ISREG(a.st_mode) and a.st_nlink==1
  h=hashlib.sha256();size=0;chunks=[]
  with os.fdopen(os.dup(fd),'rb') as raw:
   source=gzip.GzipFile(fileobj=raw,mode='rb') if decoded else raw
   try:
    while chunk:=source.read(65536):
     h.update(chunk);size+=len(chunk)
     if want:chunks.append(chunk)
   finally:
    if decoded:source.close()
  assert ident(a)==ident(os.fstat(fd))==ident(os.lstat(p))
  row={'path':str(p),'identity':ident(a),'bytes':size,'sha256':h.hexdigest()}
  if expected:
   assert row['identity']==expected['identity']['fields'] and row['bytes']==expected['bytes'] and row['sha256']==expected['sha256']
  return b''.join(chunks) if want else None,row
 finally:os.close(fd)
b,prepin=held(W/'v6-refresh-bindings4-PRE.json',want=True);pre=json.loads(b,object_pairs_hook=pairs)
b,receiptpin=held(W/'v6-refresh-bindings4-receipt.json',want=True);post=json.loads(b,object_pairs_hook=pairs)
assert pre['sourceTools']==post['sourceToolPRE'] and len(pre['sourceTools'])==len(post['sourceToolPOST'])==118
assert post['creationAttempted'] is False and post['childExecuted'] is False and post['actualExit'] is None
assert post['primary'] is None and post['secondary']==[] and post['preflightHold']=='INSUFFICIENT_MEASURED_LITERAL_RESERVE'
assert post['requiredLiteralReserveBytes']==134217728 and post['observedLiteralReserveBytes']==88592384
assert post['deadlineSeconds']==pre['deadlineSeconds']==120 and post['finishedWithinDeadline'] and not post['timeout']
assert post['sourceToolsExactEqual'] and not post['completeOwnedEvidence'] and post['groupBinding'] is None
assert post['finalGroupCensus']=={'utc':post['finalGroupCensus']['utc'],'rows':[],'effectfulRows':[],'complete':True,'scope':'NO_CREATION_ATTEMPT'}
assert len(post['FDCloses'])==118 and all(r['complete'] for r in post['FDCloses'])
verified=[];current_drift=[]
for before,after in zip(pre['sourceTools'],post['sourceToolPOST']):
 assert all(before[k]==after[k] for k in ('path','bytes','sha256','identity')) and after['equal'] and after['complete']
 identity=before['identity'];assert identity['schema']=='FS_IDENTITY_DECIMAL_V1' and set(identity['fields'])==set(K)
 for key,value in identity['fields'].items():assert type(value)is str and re.fullmatch(r'(?:0|[1-9][0-9]*|-[1-9][0-9]*)' if key.endswith('_ns') else r'(?:0|[1-9][0-9]*)',value)
 backing=before['beforeByteBacking'];_,encoded=held(Path(backing['path']),expected=backing)
 _,decoded=held(Path(backing['path']),decoded=True);assert decoded['identity']==encoded['identity'] and decoded['bytes']==before['bytes'] and decoded['sha256']==before['sha256']
 _,current=held(Path(before['path']))
 if any(current[k]!=(before['identity']['fields'] if k=='identity' else before[k]) for k in ('identity','bytes','sha256')):current_drift.append(current['path'])
 verified.append({'sourcePath':before['path'],'encoded':encoded,'decodedBytes':decoded['bytes'],'decodedSHA256':decoded['sha256']})
for row in post['raws']:assert row['created'] is False and row['role']=='NO_CHILD_OUTPUT' and not os.path.lexists(row['path'])
def events(row):return {k:int(v) for k,v in (s.split() for s in row['memory.events'].splitlines())}
before=events(post['resourcePRE']);after=events(post['resourcePOST']);delta={k:after[k]-before[k] for k in ('oom','oom_kill')}
assert delta=={'oom':0,'oom_kill':0}
out={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'ROOT_V6_RESOURCE_NO_CHILD_PREPOST_AND_ALL_PREIMAGES_VERIFIED','sourcePRE':prepin,'receipt':receiptpin,'sourceRows':118,'beforeByteBackings':verified,'currentSourceDriftSinceExecution':current_drift,'creationAttempted':False,'childExit':None,'recordedRecorderCLIExit':'Reported78 separately; not part of receipt; original toolresult pending','OOMDelta':delta,'requiredLiteralReserveBytes':134217728,'observedLiteralReserveBytes':88592384,'elapsedSeconds':post['elapsedSeconds'],'limits':'Full118 recordedPREPOST pairs and authentic encoded+decoded beforebytes current9/hash independentlyverified. Explicit NO_CREATION_ATTEMPT resourcehold, not successful child/runtime qualification. FDcloses are recorded assertions, no caller PID census here. Current source drifts listed separately. Original122/native/private/paid/actualROOT remainheld.'}
(Q/'task04-c7-v6-resource-hold-root-inspection.json').open('x').write(json.dumps(out,indent=2)+'\n')
print({k:v for k,v in out.items() if k not in ('sourcePRE','receipt','beforeByteBackings')})
