from pathlib import Path
import os,stat,json,hashlib,gzip
R=Path('/workspace/Project-Cortex');Q=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-c5-fresh-review-content-backing';W=R/'work/resume/task04-c5-fresh-review-content-backing';O=Path('/dev/shm/cortex-root-c5-fresh-review-content-backing')
H=lambda b:hashlib.sha256(b).hexdigest()
def identity(s):return {k:getattr(s,'st_'+k) for k in ['dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns']}
def held(p):
 s=p.lstat();assert stat.S_ISREG(s.st_mode) and s.st_nlink==1;h=hashlib.sha256()
 with os.fdopen(os.open(p,os.O_RDONLY|os.O_NOFOLLOW),'rb') as f:
  assert identity(s)==identity(os.fstat(f.fileno()))
  for b in iter(lambda:f.read(1048576),b''):h.update(b)
  assert identity(s)==identity(os.fstat(f.fileno()))==identity(p.lstat())
 return h.hexdigest(),s
sealed=[]
for root in [O,W,Q]:
 name='selfseal.json';seal=root/name;seal.open('x').close();paths=[root]
 for parent,dirs,files in os.walk(root,followlinks=False):
  for n in dirs+files:
   p=Path(parent)/n
   if p!=seal:paths.append(p)
  dirs[:]=[n for n in dirs if not (Path(parent)/n).is_symlink()]
 rows=[]
 for p in sorted(paths,key=lambda p:str(p.relative_to(root))):
  s=p.lstat();row={'path':str(p.relative_to(root)),'identity':identity(s)}
  if stat.S_ISREG(s.st_mode):h,s=held(p);row.update(kind='file',sha256=h,bytes=s.st_size)
  elif stat.S_ISDIR(s.st_mode):row.update(kind='directory',members=sorted(os.listdir(p)))
  elif stat.S_ISLNK(s.st_mode):row.update(kind='symlink',target=os.readlink(p))
  else:raise AssertionError(str(p))
  rows.append(row)
 packet={'scope':'SELF_ONLY_NEW_CONTENT_BACKING_NO_INHERITED_ACCEPTANCE','root':str(root),'excludedSelfOnly':[name],'rows':rows,'references':list(sealed)};raw=(json.dumps(packet,separators=(',',':'))+'\n').encode();seal.write_bytes(raw);h,s=held(seal);ref={'path':str(seal),'bytes':s.st_size,'sha256':h,'identity':identity(s)};sealed.append(ref)
 for row in rows:
  p=root/row['path'];assert identity(p.lstat())==row['identity']
  if row['kind']=='file':assert held(p)[0]==row['sha256']
  elif row['kind']=='directory':assert sorted(os.listdir(p))==row['members']
  else:assert os.readlink(p)==row['target']
 print(json.dumps({'root':str(root),'rows':len(rows),'selfseal':ref}),flush=True)
