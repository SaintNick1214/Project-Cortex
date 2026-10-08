from pathlib import Path
import os,stat,json,gzip,hashlib,datetime
R=Path('/workspace/Project-Cortex');Q=R/'_goals/convex-backend-runtime-2026-10-02/qa';C=Q/'task04-native-c5-composition-c5-fresh-review';W=R/'work/resume/task04-native-c5-composition-c5-fresh-review';T=Path('/tmp/cortex-native-c5-independent-review-c5-fresh-7bc323d1-56c7-43bc-bac6-60026125b030')
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
def reference(ref):
 h,s,b=read(ref['path'],True);assert h==ref['sha256'] and s.st_size==ref['bytes'] and identity(s)==ref['identity']
 if 'decodedSHA256' in ref:
  body=gzip.decompress(b);assert len(body)==ref['decodedBytes'] and H(body)==ref['decodedSHA256']
checks=[]
for scope,root,name,pin in [('QA',C,'selfseal.json','833c7a60e9ad6f7c5514e7601dd6767e932a9a30019ff5f1f5412e6e7b25d10d'),('work',W,'selfseal.json','95783e253c52bfe4b3c84e9d93726b5872559f847e7a45c0d48e0980fff88ad0'),('own',T,'selfseal.json.gz','f22c7d8037574897f45ffc60c709477506def7b9afda9e9206dd42c94b0a090d')]:
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
 for ref in packet['references']:reference(ref)
 checks.append({'scope':scope,'root':str(root),'sealSHA256':pin,'decodedSealSHA256':H(decoded),'rows':len(expected),'regularBytesVerified':regularBytes,'literalLinksNeverFollowed':links,'fullRecordedIdentityAndMembershipVerified':True})
e=json.loads((C/'evidence-index.json').read_text());assert e['verdict']=='REJECT' and e['average']==3.0
for ref in e['references']:reference(ref)
r={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'ROOT_FRESH_REVIEW_PACKET_INSPECTION','reportReadFully':True,'checks':checks,'verdict':e['verdict'],'average':e['average'],'evidenceReferences':len(e['references']),'reportSHA256':read(C/'report.md')[0],'original122':'HELD','actualApproval':'ABSENT','sourceParentNativePaidTiming':'HELD','historicalCustody':'BROKEN_FOREVER'}
(Q/'task04-native-c5-composition-c5-fresh-review-root-inspection.json').open('x').write(json.dumps(r,indent=2)+'\n');print(json.dumps(r))
