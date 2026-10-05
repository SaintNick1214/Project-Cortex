from pathlib import Path
import os,stat,json,hashlib,gzip,tarfile,io,datetime,zlib,sys
R=Path('/workspace/Project-Cortex');B=R/'_goals/convex-backend-runtime-2026-10-02/qa';Q=B/'task04-c6-review-content-backing';W=R/'work/resume/task04-c6-review-content-backing';T=Path('/dev/shm/cortex-root-c6-review-content-backing');P=Path('/dev/shm/cortex-root-c5-fresh-review-content-backing')
H=lambda b:hashlib.sha256(b).hexdigest()
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def ident(s):return {k:getattr(s,'st_'+k) for k in ['dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns']}
def held(p):
 p=Path(p);s=p.lstat();assert stat.S_ISREG(s.st_mode) and s.st_nlink==1,(str(p),'regular single-link required');f=os.fdopen(os.open(p,os.O_RDONLY|os.O_NOFOLLOW),'rb');assert ident(s)==ident(os.fstat(f.fileno()));return f,s
def read(p,retain=False,estimate=False):
 f,s=held(p);h=hashlib.sha256();chunks=[];z=zlib.compressobj(3,wbits=31) if estimate else None;n=0
 with f:
  for b in iter(lambda:f.read(65536),b''):
   h.update(b)
   if retain:chunks.append(b)
   if z:n+=len(z.compress(b))
  if z:n+=len(z.flush())
  assert ident(s)==ident(os.fstat(f.fileno()))==ident(Path(p).lstat()),str(p)
 return h.hexdigest(),s,b''.join(chunks) if retain else n
def pin(p,h):
 a,s,b=read(p,True);assert a==h,(str(p),a,h);return b
def dump(p,x):
 with Path(p).open('x') as f:json.dump(x,f,separators=(',',':'));f.write('\n')
def paths(root):
 yield root
 for parent,dirs,files in os.walk(root,followlinks=False):
  for n in dirs+files:yield Path(parent)/n
  dirs[:]=[n for n in dirs if not (Path(parent)/n).is_symlink()]
def checkrow(p,row,hashbytes=True):
 s=p.lstat();assert ident(s)==row['identity'],(str(p),'identity')
 if row['kind']=='file':
  assert stat.S_ISREG(s.st_mode)
  if hashbytes:assert read(p)[0]==row['sha256']
 elif row['kind']=='directory':assert stat.S_ISDIR(s.st_mode) and sorted(os.listdir(p))==row['members']
 elif row['kind']=='symlink':assert stat.S_ISLNK(s.st_mode) and os.readlink(p)==row['target']
 else:raise AssertionError(row['kind'])
