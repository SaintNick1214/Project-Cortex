from pathlib import Path
import os,stat,json,gzip,hashlib,datetime
R=Path('/workspace/Project-Cortex');Q=R/'_goals/convex-backend-runtime-2026-10-02/qa';C=Q/'task04-native-c6-closed-launcher-c6';W=R/'work/resume/task04-model-drift-native-preparation-c6/closed-launcher-c6';T=Path('/tmp/cortex-native-c5-closed-launcher-c5');E=Path('/tmp/cortex-native-c6-independent-review-87eb6f28-3812-499b-ab08-09282d98678d')
H=lambda b:hashlib.sha256(b).hexdigest()
def identity(s):return {k:getattr(s,'st_'+k) for k in ['dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns']}
def read(p,retain=False):
 p=Path(p);s=p.lstat();assert stat.S_ISREG(s.st_mode) and s.st_nlink==1
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW);h=hashlib.sha256();chunks=[]
 try:
  assert identity(s)==identity(os.fstat(fd))
  while True:
   b=os.read(fd,1048576)
   if not b:break
   h.update(b)
   if retain:chunks.append(b)
  assert identity(s)==identity(os.fstat(fd))==identity(p.lstat())
 finally:os.close(fd)
 return h.hexdigest(),s,b''.join(chunks) if retain else None
pinsHash,_,pinsRaw=read(C/'sourcepins.json',True);pins=json.loads(pinsRaw)
for row in pins['rows']:
 h,s,_=read(row['path']);assert h==row['sha256'] and s.st_size==row['bytes'] and identity(s)==row['identity']
bindingsHash,_,bindingsRaw=read(C/'prepared122bindings.json',True);bindings=json.loads(bindingsRaw);contractHash,contractStat,contractRaw=read(bindings['contract']['path'],True);assert contractHash==bindings['contract']['sha256'] and contractStat.st_size==bindings['contract']['bytes'] and identity(contractStat)==bindings['contract']['identity'];contract=json.loads(contractRaw);assert len(bindings['commands'])==122 and len({r['id'] for r in bindings['commands']})==122
for a,b in zip(bindings['commands'],contract['commands']):
 assert b['status']=='PROPOSAL_ONLY_NOT_EXECUTION_RELEASE' and a['status']=='HELD_PENDING_INDEPENDENT_FULL_COMPOSITION_PASS_AND_ROOT_FIXED_APPROVAL';assert all(a[k]==v for k,v in b.items() if k!='status');assert read(a['proposedArgv'][2])[0]==a['entrySha256'];assert read(a['mirrorEntry'])[0]==a['mirrorEntrySHA256']
assert read(W/'route-policy.mjs')[0]=='72eedf1f80bcca600319e690605d29675389fbb6dda371246293f63ee242ec03'

approval=Q/'task04-native-c6-closed-launcher-c6-root-approval'
assert not (approval/'approval.json').exists() and not (approval/'approval-pin.json').exists()
r={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'ROOT_FROZEN_SOURCE_AND_122_BINDINGS_INSPECTION_ONLY','sourcePinsSHA256':pinsHash,'bindingsSHA256':bindingsHash,'contractSHA256':contractHash,'currentSourcePinsVerified':len(pins['rows']),'exact122BindingsVerified':122,'original122':'HELD','actualApproval':'ABSENT','sourceParentNativePrivatePaidTiming':'HELD','fullCompositionAcceptance':'NOT_GRANTED'}
with (Q/'task04-native-c6-root-frozen-source-bindings-inspection.json').open('x') as f:json.dump(r,f,indent=2);f.write('\n')
print(json.dumps(r))
