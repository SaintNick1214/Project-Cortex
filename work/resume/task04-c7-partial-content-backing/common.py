from pathlib import Path
import os,stat,json,gzip,hashlib,sqlite3,io,tarfile,zlib,datetime
from stream_json import Reader,loads
R=Path('/workspace/Project-Cortex');B=R/'_goals/convex-backend-runtime-2026-10-02/qa';W=R/'work/resume/task04-c7-partial-content-backing';Q=B/'task04-c7-partial-content-backing';T=Path('/dev/shm/cortex-root-c7-partial-content-backing')
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def ident(s):return {'schema':'FS_IDENTITY_DECIMAL_V1','fields':{k:str(getattr(s,'st_'+k)) for k in FIELDS}}
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def dump(p,x):
 with p.open('x') as f:json.dump(x,f,separators=(',',':'));f.write('\n')
def held(p):
 s=p.lstat();assert stat.S_ISREG(s.st_mode) and s.st_nlink==1
 f=os.fdopen(os.open(p,os.O_RDONLY|os.O_NOFOLLOW),'rb');assert ident(s)==ident(os.fstat(f.fileno()));return f,s
def hashfile(p,expected=None,estimate=False):
 f,s=held(p);h=hashlib.sha256();n=0;z=zlib.compressobj(3,wbits=31) if estimate else None;e=0
 with f:
  for b in iter(lambda:f.read(65536),b''):
   h.update(b);n+=len(b)
   if z:e+=len(z.compress(b))
  if z:e+=len(z.flush())
  assert n==s.st_size and ident(s)==ident(os.fstat(f.fileno()))==ident(p.lstat())
 if expected:assert h.hexdigest()==expected
 return {'path':str(p),'sha256':h.hexdigest(),'bytes':n,'identity':ident(s),'gzipIndividualBytes':e if estimate else None}
def parse(p,arrays=(),objects=(),item=lambda *a:None,pair=lambda *a:None):
 f,s=held(p)
 with f:
  inp=gzip.GzipFile(fileobj=f,mode='rb') if p.suffix=='.gz' else f
  reader=Reader(iter(lambda:inp.read(16384),b''),valueLimit=1048576)
  result=reader.top(arrays,objects,item,pair)
  if inp is not f:inp.close()
  assert ident(s)==ident(os.fstat(f.fileno()))==ident(p.lstat())
 return result
