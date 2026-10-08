from pathlib import Path
import os,stat,json,hashlib,datetime
W=Path('/workspace/Project-Cortex/work/resume/task04-c7-exact-identity-repair')
Q=Path('/workspace/Project-Cortex/_goals/convex-backend-runtime-2026-10-02/qa')
K=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def identity(s):return {k:str(getattr(s,'st_'+k)) for k in K}
def held(p):
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  before=os.fstat(fd);assert stat.S_ISREG(before.st_mode) and before.st_nlink==1
  blocks=[]
  while chunk:=os.read(fd,65536):blocks.append(chunk)
  data=b''.join(blocks)
  assert identity(before)==identity(os.fstat(fd))==identity(os.lstat(p)) and len(data)==before.st_size
  return data,{'path':str(p),'identity':identity(before),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
 finally:os.close(fd)
data,pin=held(W/'refresh3-reconstructed-observation.json');r=json.loads(data)
data,gpin=held(W/'refresh-bindings3-group-PRE.json');g=json.loads(data)
assert r['kind']=='FRESH_POST_INTERRUPTION_KERNEL_OBSERVATION_NOT_RECORDER_RECEIPT'
assert r['actualRecorderExit']=='UNOBSERVED' and r['sourceToolHeldPOST']=='UNOBSERVED_NOT_RECONSTRUCTED'
assert not (W/'refresh-bindings3-receipt.json').exists()
verified=[]
for row in r['bound']:
 b,z=held(Path(row['rawBeforeByteBacking']['path']));e=row['rawBeforeByteBacking']
 assert z['identity']==e['identity']['fields'] and z['bytes']==e['bytes'] and z['sha256']==e['sha256']
 fields=b.decode()[b.decode().rindex(')')+2:].split()
 assert int(b.split(b' ',1)[0])==row['pid'] and fields[19]==row['startTime']==g[row['role']]['startTime']
 assert fields[0]==row['state']=='Z' and int(fields[2])==row['pgid'] and fields[49]==row['kernelExitCodeRaw']
 assert row['FDSizeZero'] is True
 verified.append(z)
for row in r['raws']:
 b,z=held(Path(row['path']));assert z['identity']==row['identity']['fields'] and z['bytes']==row['bytes'] and z['sha256']==row['sha256'];verified.append(z)
assert r['freshGroupCensus']['effectfulRows']==[]
current=[]
for role in ('owner','initial'):
 old=g[role];p=Path('/proc')/str(old['pid'])/'stat'
 try:
  b=p.read_bytes();tail=b.decode()[b.decode().rindex(')')+2:].split()
  current.append({'role':role,'pid':old['pid'],'sameStartTime':tail[19]==old['startTime'],'state':tail[0],'kernelExitCodeRaw':tail[49]})
 except FileNotFoundError:current.append({'role':role,'pid':old['pid'],'observation':'ABSENT'})
out={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'ROOT_RECOVERY_RAW_BINDINGS_VERIFIED_NOT_RECORDER_RECEIPT','observation':pin,'groupPRE':gpin,'verifiedRawBackings':verified,'freshProcessObservations':current,'limits':'Fresh kernel termination observations only. Recorder actual exit, deadline accounting and held sourceToolPOST unobserved; no reconstruction or qualification. FDSizeZero and empty effectful census are recorded assertions, not independently re-censused here. No OOM causal attribution.'}
(Q/'task04-c7-refresh3-recovery-root-inspection.json').open('x').write(json.dumps(out,indent=2)+'\n')
print({'status':out['status'],'rawFiles':len(verified),'freshProcessObservations':current})
