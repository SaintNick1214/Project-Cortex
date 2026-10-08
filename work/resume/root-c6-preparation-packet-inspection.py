from pathlib import Path
import os,stat,json,gzip,hashlib,datetime
R=Path('/workspace/Project-Cortex');Q=R/'_goals/convex-backend-runtime-2026-10-02/qa';C=Q/'task04-native-c6-repair-preparation';W=R/'work/resume/task04-native-c6-repair-preparation'
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
 h,s,b=read(ref['path'],True);assert h==ref['sha256'] and s.st_size==ref['bytes']
 if 'identity' in ref:assert identity(s)==ref['identity']
 if 'decodedSHA256' in ref:
  body=gzip.decompress(b);assert len(body)==ref['decodedBytes'] and H(body)==ref['decodedSHA256']
checks=[]
for scope,root,name,pin in [('QA',C,'selfseal.json','bf8652e16284a3bbc4f085ddca8bd4d7269b44090101d75e800292b3b0d759ab'),('work',W,'selfseal.json','e1af049ce57ba1fb17a327427bcc8c7159cadff91ea17b8e3aafbd71a7e63e31')]:
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
r={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'ROOT_C6_READ_ONLY_PREPARATION_PACKET_INSPECTION','checks':checks,'reportAndAddendumReadFully':True,'acceptance':False,'original122':'HELD','currentC6Implementation':'IN_PROGRESS','historicalInitialSeals':'RETAINED_HISTORICAL_ONLY'}
(Q/'task04-native-c6-repair-preparation-root-inspection.json').open('x').write(json.dumps(r,indent=2)+'\n');print(json.dumps(r))
