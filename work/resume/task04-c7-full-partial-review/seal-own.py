import os,stat,json,gzip,hashlib,datetime
from pathlib import Path
R=Path('/workspace/Project-Cortex');W=R/'work/resume/task04-c7-full-partial-review';Q=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-c7-full-partial-review'
F=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns');NAME='seal-own-review.json.gz'
def ident(s):return {'schema':'FS_IDENTITY_DECIMAL_V1','fields':{k:str(getattr(s,'st_'+k)) for k in F}}
def row(root,p):
 s=os.lstat(p);v={'path':str(p.relative_to(root)),'identity':ident(s)}
 if stat.S_ISDIR(s.st_mode):v.update(kind='directory',members=sorted(os.listdir(p)))
 elif stat.S_ISLNK(s.st_mode):v.update(kind='symlink',literalTarget=os.readlink(p))
 else:
  assert stat.S_ISREG(s.st_mode) and s.st_nlink==1
  h=hashlib.sha256();fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
  try:
   assert ident(os.fstat(fd))==ident(s)
   while b:=os.read(fd,65536):h.update(b)
   assert ident(os.fstat(fd))==ident(s)
  finally:os.close(fd)
  v.update(kind='file',sha256=h.hexdigest(),bytes=s.st_size)
 assert ident(os.lstat(p))==ident(s);return v
refs=[]
for root in (W,Q):
 p=root/NAME;fd=os.open(p,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600);pre=ident(os.lstat(root));members=sorted(os.listdir(root));n=0
 with os.fdopen(fd,'wb') as target:
  with gzip.GzipFile(filename='',fileobj=target,mode='wb',mtime=0) as out:
   header={'schema':'INDEPENDENT_TASK04_FULL_PARTIAL_REVIEW_LITERAL_SEAL_V1','scope':'OWN_REVIEW_STATIC_ONLY','verdict':'REJECT','root':str(root),'rootIdentity':pre,'rootMembers':members,'onlyExcluded':NAME,'references':refs,'utc':datetime.datetime.now(datetime.timezone.utc).isoformat()};out.write(json.dumps(header,separators=(',',':')).encode()[:-1]+b',"rows":[')
   for directory,dirs,files in os.walk(root,followlinks=False):
    dirs.sort();files.sort();paths=([Path(directory)] if Path(directory)!=root else [])+[Path(directory)/x for x in files if Path(directory)/x!=p]
    for x in paths:
     out.write((b',' if n else b'')+json.dumps(row(root,x),separators=(',',':')).encode());n+=1
   out.write(b'],"rowCount":'+str(n).encode()+b'}\n')
  target.flush();os.fsync(target.fileno())
 assert ident(os.lstat(root))==pre and sorted(os.listdir(root))==members
 os.chmod(p,0o400);r=row(root,p);r['path']=str(p);refs.append(r)
 print(json.dumps({'sealed':str(root),'rows':n,'verdict':'REJECT'}))
