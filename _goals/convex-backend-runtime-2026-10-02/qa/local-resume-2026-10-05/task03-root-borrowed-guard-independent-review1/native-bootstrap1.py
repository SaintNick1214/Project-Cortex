"""Fixed native Source/mock review bootstrap. No service or operative Source approval."""
import hashlib,json,os,stat,sys,time,traceback
from pathlib import Path
K=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def nine(s):return {k:str(getattr(s,'st_'+k)) for k in K}
declared=json.loads(sys.argv[1]);J=Path(sys.argv[2]);D=Path(sys.argv[3]);R=Path(sys.argv[4])
assert len(sys.argv[1].encode())<=327692
owned=[];observed=[];bodies={};failures=[];closes=[];result=None
PRIOR=1343335;RESERVED=4194304+1048576+2097152
try:
 assert type(declared)is list and len(declared)==len({r['path'] for r in declared})
 assert len(declared)+104+32<=4096
 assert PRIOR+sum(r['bytes'] for r in declared)+RESERVED<=67108864
 for r in declared:
  p=Path(r['path']);pre=nine(os.lstat(p))
  assert p.is_absolute() and p.resolve()==p and p.is_relative_to(R)
  assert pre==r['PRE9'],('original_nine',str(p),pre,r['PRE9'])
  assert stat.S_ISREG(int(pre['mode'])) and pre['uid']=='501' and pre['gid']=='20' and pre['nlink']=='1'
  assert int(pre['size'])==r['bytes']<=16777216
  age=time.time_ns()-max(int(pre['mtime_ns']),int(pre['ctime_ns']));assert age>=240000000000,('maturity',str(p),age)
  fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
  try:owned.append((fd,r))
  except BaseException as e:
   failures.append({'stage':'ownership_registration','error':repr(e),'path':str(p)})
   err=None
   try:os.close(fd)
   except BaseException as ex:err=repr(ex);failures.append({'stage':'unregistered_close_unknown','error':err,'path':str(p)})
   closes.append({'path':str(p),'attempts':1,'error':err,'fallback':True})
   raise
  op=nine(os.fstat(fd));assert op==pre
  observed.append({'path':str(p),'PRE9':pre,'OPEN9':op,'expectedSha256':r['sha256'],'expectedBytes':r['bytes'],'firstCaptureMinimumAgeNs':str(age)})
 for (fd,r),row in zip(owned,observed):
  raw=bytearray();offset=0
  while True:
   chunk=os.pread(fd,65536,offset)
   if not chunk:break
   raw.extend(chunk);offset+=len(chunk);assert len(raw)<=16777216
  assert len(raw)==r['bytes'] and hashlib.sha256(raw).hexdigest()==r['sha256']
  post=nine(os.fstat(fd));assert post==r['PRE9']==nine(os.lstat(r['path']))
  row.update({'POST9':post,'fullEOF':True,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()})
  bodies[r['path']]=bytes(raw)
 plan=json.loads(bodies[str(J/'review-source-inputs-plan1.json')])
 assert set(p['path'] for p in plan['members'])==set(bodies)-{str(J/'review-source-inputs-plan1.json'),str(J/'review-writers-stopped1.json')}
 assert plan['sourceEligibility'] is False and plan['priorConservativeDebtBytes']==PRIOR
 stop=json.loads(bodies[str(J/'review-writers-stopped1.json')])
 assert stop['remainingWrites']==[] and stop['sourceWriters']=='STOPPED'
 source=str(J/'review-actor1.py')
 ns={'__name__':'independent_g_held_actor','__file__':source}
 exec(compile(bodies[source],source,'exec'),ns)
 result=ns['run']({'bodies':bodies,'pins':declared,'J':str(J),'D':str(D),'R':str(R)})
 print(json.dumps({'state':'CONTROLS_COMPLETED','inputs':len(owned),'bytes':sum(r['bytes'] for _,r in owned),
  'author18PASS':sum(x['PASS'] for x in result['author18']),'N71PASS':result['underlyingN71ScopedOnly'].get('PASS'),
  'freshIndependent':{k:v for k,v in result['freshIndependent'].items() if k!='conditions'},
  'minimumFirstCaptureAgeNs':min(int(x['firstCaptureMinimumAgeNs']) for x in observed)}),flush=True)
except BaseException as e:
 failures.append({'stage':'primary','type':type(e).__name__,'error':str(e),'traceback':traceback.format_exc()})
finally:
 for (fd,r),row in zip(owned,observed):
  try:
   raw=bytearray();offset=0
   while True:
    b=os.pread(fd,65536,offset)
    if not b:break
    raw.extend(b);offset+=len(b);assert len(raw)<=16777216
   f=nine(os.fstat(fd));p=nine(os.lstat(r['path']))
   assert f==p==r['PRE9'] and len(raw)==r['bytes'] and hashlib.sha256(raw).hexdigest()==r['sha256']
   row.update({'FINAL9':f,'pathFINAL9':p,'finalFullEOFHashSize':True})
  except BaseException as e:failures.append({'stage':'final_source_fence','path':r['path'],'error':repr(e)})
 for fd,r in owned:
  err=None
  try:os.close(fd)
  except BaseException as e:err=repr(e);failures.append({'stage':'unknown_owned_close','path':r['path'],'error':err})
  closes.append({'path':r['path'],'attempts':1,'error':err})
 rec={'scope':'INDEPENDENT_ROOT_G_HELD_SOURCE_CODE_HOST_ONLY','inputs':observed,'FDCloses':closes,'failures':failures,
  'allFDsBeforeMemberBodies':True,'bodyCount':len(bodies),'SourceEligibility':False,'effects':0,
  'priorConservativeDebtBytes':PRIOR,'thisAdmissionBytes':sum(r['bytes'] for _,r in owned),
  'cumulativeConservativeDebtBytes':PRIOR+sum(r['bytes'] for _,r in owned),'remainingOriginalReservations':RESERVED,
  'allSourcesHeldThroughControlsAndFinal':result is not None,'nativeBootstrapSelfSourceCompiledBeforePhysicalGate':True}
 try:(J/'held-source-control-FDclosure1.json').write_text(json.dumps(rec,indent=2,sort_keys=True)+'\n')
 except BaseException as e:print(json.dumps({'publicationFailure':repr(e),'allClosesAttempted':len(closes),'failures':failures}),flush=True)
 print(json.dumps({'state':'CLOSED','inputs':len(owned),'FDCloses':len(closes),'failures':failures}),flush=True)
