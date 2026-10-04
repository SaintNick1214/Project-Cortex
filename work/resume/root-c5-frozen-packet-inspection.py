from pathlib import Path
import os,stat,json,gzip,hashlib,datetime
R=Path('/workspace/Project-Cortex');Q=R/'_goals/convex-backend-runtime-2026-10-02/qa';C=Q/'task04-native-c5-closed-launcher-c5';W=R/'work/resume/task04-model-drift-native-preparation-c5/closed-launcher-c5';T=Path('/tmp/cortex-native-c5-closed-launcher-c5');E=Path('/tmp/cortex-native-c5-independent-review-c5-15b2ef7a-3243-4271-a78d-bf819fdf7393')
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
checks=[];plan=[]
for scope,root,name,pin in [('QA',C,'selfseal.json','b472772d31968e5f47f2af09fe7e993198fb0de90c58e359d2c2294bc479e260'),('work',W,'selfseal.json','461019d6a2a5bcdd4a9092836171123bd2b080ef750a7b453061a4e27cb03324'),('temporary',T,'selfseal.json.gz','a90ffbf84422fc2db387b107144a07ac3ad209ae0cdc560e8bd29d18b8972909'),('external',E,'selfseal.json.gz','8a20a05868bd7413268915bf2a1dc74f237c050fa7a0a4f6604573b97fd4e5c5')]:
 seal=root/name;actual,s,encoded=read(seal,True);assert actual==pin;decoded=gzip.decompress(encoded) if name.endswith('.gz') else encoded;packet=json.loads(decoded);assert packet['root']==str(root) and packet['excludedSelfOnly']==[name]
 expected={};regularBytes=0;links=0
 for row in packet['rows']:
  rel=Path(row['path']);assert not rel.is_absolute() and '..' not in rel.parts and row['path'] not in expected;expected[row['path']]=row;p=root/rel;s=p.lstat();assert identity(s)==row['identity'],(scope,row['path'],'identity')
  if row['kind']=='file':
   actual,s,_=read(p);assert s.st_size==row['bytes'] and actual==row['sha256'];regularBytes+=s.st_size
  elif row['kind']=='directory':assert stat.S_ISDIR(s.st_mode) and sorted(os.listdir(p))==row['members']
  elif row['kind']=='symlink':assert stat.S_ISLNK(s.st_mode) and os.readlink(p)==row['target'];links+=1
  else:raise AssertionError(row['kind'])
 actualMembers={'.'}
 for parent,dirs,files in os.walk(root,followlinks=False):
  for n in dirs+files:
   p=Path(parent)/n
   if p!=seal:actualMembers.add(str(p.relative_to(root)))
  dirs[:]=[n for n in dirs if not (Path(parent)/n).is_symlink()]
 assert actualMembers==set(expected)
 for ref in packet['references']:
  h,s,b=read(ref['path'],True);assert h==ref['sha256'] and s.st_size==ref['bytes'] and identity(s)==ref['identity'];body=gzip.decompress(b) if ref['path'].endswith('.gz') else b;assert len(body)==ref['decodedBytes'] and H(body)==ref['decodedSHA256']
 checks.append({'scope':scope,'root':str(root),'sealSHA256':pin,'decodedSealSHA256':H(decoded),'rows':len(expected),'regularBytesVerified':regularBytes,'literalLinksNeverFollowed':links,'fullRecordedIdentityAndMembershipVerified':True})
 plan.append({'scope':scope,'root':str(root),'sealPath':str(seal),'sealSHA256':pin})
pins=json.loads((C/'sourcepins.json').read_text())
for row in pins['rows']:
 h,s,_=read(row['path']);assert h==row['sha256'] and s.st_size==row['bytes'] and identity(s)==row['identity']
bindings=json.loads((C/'prepared122bindings.json').read_text());contract=json.loads(Path(bindings['contract']['path']).read_text());assert len(bindings['commands'])==122 and len({r['id'] for r in bindings['commands']})==122
for a,b in zip(bindings['commands'],contract['commands']):
 assert b['status']=='PROPOSAL_ONLY_NOT_EXECUTION_RELEASE' and a['status']=='HELD_PENDING_INDEPENDENT_FULL_COMPOSITION_PASS_AND_ROOT_FIXED_APPROVAL';assert all(a[k]==v for k,v in b.items() if k!='status');assert read(a['proposedArgv'][2])[0]==a['entrySha256'];assert read(a['mirrorEntry'])[0]==a['mirrorEntrySHA256']
assert read(W/'route-policy.mjs')[0]=='72eedf1f80bcca600319e690605d29675389fbb6dda371246293f63ee242ec03'
assert read(C/'report.md')[0]=='8417454eaf985fa9ae234f4d3edaa46519cbe8c5cd2911686800fbdc30d59a9e'
approval=Q/'task04-native-c5-closed-launcher-c5-root-approval';assert not (approval/'approval.json').exists() and not (approval/'approval-pin.json').exists()
r={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'ROOT_FROZEN_PACKET_INSPECTION_NOT_INDEPENDENT_ACCEPTANCE','reportReadFully':True,'checks':checks,'currentSourcePinsVerified':len(pins['rows']),'exact122BindingsVerified':122,'original122':'HELD','actualApproval':'ABSENT','sourceParentNativePaidTiming':'HELD','historicalCustody':'BROKEN_FOREVER','wholeFreezeRoute120sFeasibility':'UNPROVED','externalExecutionCohort':'EARLIER_THAN_FINAL_SOURCE'}
(Q/'task04-native-c5-frozen-packet-root-inspection.json').write_text(json.dumps(r,indent=2)+'\n');(R/'work/resume/task04-c5-frozen-source-seal-inputs.json').write_text(json.dumps({'subjects':plan},indent=2)+'\n');print(json.dumps(r))
