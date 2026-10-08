from pathlib import Path
import os,stat,json,gzip,hashlib,datetime
R=Path('/workspace/Project-Cortex');Q=R/'_goals/convex-backend-runtime-2026-10-02/qa';C=Q/'task04-native-c6-full-composition-restored-review';W=R/'work/resume/task04-native-c6-full-composition-restored-review';T=Path('/dev/shm/cortex-native-c6-restored-review')
H=lambda b:hashlib.sha256(b).hexdigest()
K=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def identity(s):return {k:getattr(s,'st_'+k) for k in K}
def held(p,retain=False):
 p=Path(p);a=p.lstat();assert stat.S_ISREG(a.st_mode) and a.st_nlink==1
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW);h=hashlib.sha256();chunks=[]
 try:
  assert identity(a)==identity(os.fstat(fd))
  while True:
   b=os.read(fd,1048576)
   if not b:break
   h.update(b)
   if retain:chunks.append(b)
  assert identity(a)==identity(os.fstat(fd))==identity(p.lstat())
 finally:os.close(fd)
 return h.hexdigest(),a,b''.join(chunks) if retain else None
def bound(row,retain=False):
 h,s,b=held(row['path'],retain);assert h==row['sha256'] and s.st_size==row['bytes']
 if 'identity' in row:assert identity(s)==row['identity']
 return b
subjects=[('QA',C,'3aacd1e6e7468ed8964418bc5a68021bdd4a24e710733348e4fa8aa4b96028dc'),('work',W,'0a40c200c335394f025bcbe0ff84e67cc40cbadab0b4cce07d707111562337f4'),('temporary',T,'6f96403c8f1f505709b63fc5bef9d804fa9fb7b7914adcd8073b35e553ba2d51')]
checks=[]
for scope,root,pin in subjects:
 h,_,b=held(root/'seal.json',True);assert h==pin;d=json.loads(b)
 assert d['root']==str(root) and d['exclusion']=='ONLY_OWN_ROOT_seal.json' and d['literalNoLinkTraversal']
 rows={};size=0;links=0
 for row in d['rows']:
  rel=Path(row['path']);assert not rel.is_absolute() and '..' not in rel.parts and row['path'] not in rows
  rows[row['path']]=row;p=root/rel;s=p.lstat();assert identity(s)==row['identity'],(scope,row['path'],'identity')
  if row['kind']=='file':
   actual,s,_=held(p);assert actual==row['sha256'] and s.st_size==row['bytes'];size+=s.st_size
  elif row['kind']=='directory':assert stat.S_ISDIR(s.st_mode)
  elif row['kind']=='symlink':assert stat.S_ISLNK(s.st_mode) and os.readlink(p)==row['target'];links+=1
  else:raise AssertionError(row['kind'])
 actual={'.'}
 for parent,dirs,files in os.walk(root,followlinks=False):
  for name in dirs+files:
   p=Path(parent)/name
   if p!=root/'seal.json':actual.add(str(p.relative_to(root)))
  dirs[:]=[name for name in dirs if not (Path(parent)/name).is_symlink()]
 assert actual==set(rows) and size==d['regularBytes']
 children={}
 for n in rows:
  if n!='.':children.setdefault(str(Path(n).parent),set()).add(Path(n).name)
 for rel,row in rows.items():
  if row['kind']=='directory':
   expected=children.get(rel,set()).copy()
   if rel=='.':expected.add('seal.json')
   assert set(os.listdir(root/rel))==expected
 checks.append({'scope':scope,'root':str(root),'sealSHA256':pin,'rows':len(rows),'regularBytesVerified':size,'literalLinksNeverFollowed':links})

reportHash,_,report=held(C/'report.md',True);assert reportHash=='d9a4c86b7cb06a98f65918d12346eb788118b22c1cca4565c66f3467a3238061';assert 'REJECT' in report.decode()
out={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'ROOT_RESTORED_INDEPENDENT_REVIEW_LITERAL_SEALS_VERIFIED','checks':checks,'reportSHA256':reportHash,'verdict':'REJECT','score':2.8,'candidateQualification':False,'limits':'Current full literal membership, exact nine-field identities and bytes only; review remains rejection, prior timeout/null exit and precision defects preserved.'}
with (Q/'task04-native-c6-restored-review-root-seals-inspection.json').open('x') as f:json.dump(out,f,indent=2);f.write('\n')
print(json.dumps(out))
