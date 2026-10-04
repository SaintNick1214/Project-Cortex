#!/usr/bin/env python3
"""Bounded frozen C4 evidence transport. No source/native qualification."""
import argparse,hashlib,json,os,stat,struct,zlib
from pathlib import Path
INDEX_SHA='a82fb82ad92d4a9753a9c7fe612ba880f82f4893a7a6d3e211dc8ec9a4fad869'
PART_LIMIT=5*1024*1024
OBJECT_LIMIT=49217478 # exact immutable maximum, checked again by packer
MAP_LIMIT=48104635 # generated exact decoded map byte ceiling
STREAM_LIMIT=1216981953 # generated exact sum(object bytes + 72-byte record headers)
INDEX_LIMIT=8005 # generated exact encoded index size
ROOTS=['_goals/convex-backend-runtime-2026-10-02/qa/task04-model-drift-native-extension-preparation-c4', '_goals/convex-backend-runtime-2026-10-02/qa/task04-model-drift-native-regression-preparation-c4', '_goals/convex-backend-runtime-2026-10-02/qa/task04-model-drift-native-extra-preparation-c4', 'work/resume/task04-model-drift-native-preparation-c4', '_goals/convex-backend-runtime-2026-10-02/qa/task04-native-c4-source-fresh-review', 'work/resume/task04-native-c4-source-fresh-review', '_goals/convex-backend-runtime-2026-10-02/qa/task04-native-c4-parent-fresh-review', 'work/resume/task04-native-c4-parent-fresh-review'] # generated eight immutable exact namespaces

def require(ok,msg):
 if not ok:raise ValueError(msg)
def sha(b):return hashlib.sha256(b).hexdigest()
def safe(p):
 require(isinstance(p,str) and p and '\\' not in p and '\0' not in p and not p.startswith('/') and all(x not in ('','.','..') for x in p.split('/')),'unsafe path')
 return p
def allowed(p):
 safe(p);require(any(p.startswith(r+'/') for r in ROOTS),'outside frozen namespace');return p
def directory(path,create=False):
 fd=os.open('/',os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
 try:
  for c in Path(os.path.abspath(path)).parts[1:]:
   if create:
    try:os.mkdir(c,0o755,dir_fd=fd)
    except FileExistsError:pass
   n=os.open(c,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=fd);os.close(fd);fd=n
  return fd
 except BaseException:os.close(fd);raise

def parent(base,path,create=False):
 safe(path);p,n=os.path.split(path);return directory(base/p,create),n

def exactread(base,path,size,expected=None,mode=None,nlink=False):
 require(type(size) is int and 0<=size<=max(OBJECT_LIMIT,PART_LIMIT,INDEX_LIMIT),'read trusted bound')
 fd,n=parent(base,path)
 try:f=os.open(n,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=fd)
 finally:os.close(fd)
 try:
  before=os.fstat(f);require(stat.S_ISREG(before.st_mode) and before.st_size==size,'regular exact pre-size required')
  if mode is not None:require(stat.S_IMODE(before.st_mode)==mode,'mode mismatch')
  if nlink:require(before.st_nlink==1,'restored file must have unique inode')
  chunks=[];left=size
  while left:
   b=os.read(f,min(left,1048576));require(0<len(b)<=left,'short/invalid read');chunks.append(b);left-=len(b)
  require(os.read(f,1)==b'','growth detected')
  after=os.fstat(f);require((before.st_dev,before.st_ino,before.st_size,before.st_mode,before.st_mtime_ns,before.st_ctime_ns)==(after.st_dev,after.st_ino,after.st_size,after.st_mode,after.st_mtime_ns,after.st_ctime_ns),'input changed during read')
  b=b''.join(chunks);require(len(b)==size and (expected is None or sha(b)==expected),'length/hash mismatch');return b
 finally:os.close(f)

def present(base,row,unique=True):
 p=row['path'];allowed(p)
 try:fd,n=parent(base,p)
 except FileNotFoundError:return False
 try:
  try:s=os.stat(n,dir_fd=fd,follow_symlinks=False)
  except FileNotFoundError:return False
  if row['kind']=='literal-symlink':
   require(stat.S_ISLNK(s.st_mode),'link type collision')
   b=os.readlink(os.fsencode(n),dir_fd=fd);require(b.hex()==row['targetHex'] and len(b)==row['bytes'] and sha(b)==row['sha256'],'literal link mismatch');return True
  require(stat.S_ISREG(s.st_mode),'regular type collision')
 finally:os.close(fd)
 exactread(base,p,row['bytes'],row['sha256'],row['mode'],unique);return True

def writeall(f,b):
 view=memoryview(b)
 while view:
  n=os.write(f,view);require(type(n) is int and 0<n<=len(view),'short/invalid write');view=view[n:]

def create(base,row,b=None):
 allowed(row['path']);fd,n=parent(base,row['path'],True)
 try:
  if row['kind']=='literal-symlink':
   os.symlink(bytes.fromhex(row['targetHex']),os.fsencode(n),dir_fd=fd)
  else:
   require(b is not None and len(b)==row['bytes'] and sha(b)==row['sha256'],'write input mismatch')
   f=os.open(n,os.O_RDWR|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600,dir_fd=fd)
   try:
    require(stat.S_ISREG(os.fstat(f).st_mode) and os.fstat(f).st_nlink==1,'unsafe created descriptor')
    writeall(f,b);os.fchmod(f,row['mode']);os.fsync(f)
    require(os.fstat(f).st_size==len(b),'write exact post-size')
    os.lseek(f,0,os.SEEK_SET);h=hashlib.sha256();left=len(b)
    while left:
     chunk=os.read(f,min(left,1048576));require(0<len(chunk)<=left,'write readback short');h.update(chunk);left-=len(chunk)
    require(os.read(f,1)==b'' and h.hexdigest()==row['sha256'] and os.fstat(f).st_nlink==1,'write readback mismatch')
   finally:os.close(f)
  os.fsync(fd)
 finally:os.close(fd)
 require(present(base,row),'created file verification failed')

class Parts:
 def __init__(self,base,parts):self.base=base;self.parts=iter(parts)
 def __iter__(self):
  for p in self.parts:
   safe(p['path']);require(type(p['bytes']) is int and 0<p['bytes']<=PART_LIMIT,'encoded part cap')
   yield exactread(self.base,p['path'],p['bytes'],p['sha256'])

class Decode:
 def __init__(self,chunks,cap):
  require(type(cap) is int and cap>=0,'decoded cap');self.chunks=iter(chunks);self.z=zlib.decompressobj(31);self.buf=bytearray();self.pending=b'';self.total=0;self.cap=cap;self.done=False
 def fill(self):
  require(not self.done,'missing decoded bytes')
  if not self.pending:
   try:self.pending=next(self.chunks)
   except StopIteration:
    require(self.z.eof and not self.z.unused_data,'truncated compressed stream');self.done=True;return
  out=self.z.decompress(self.pending,min(1048576,self.cap-self.total+1));self.pending=self.z.unconsumed_tail;self.total+=len(out)
  require(self.total<=self.cap,'decoded ceiling exceeded');self.buf.extend(out)
  if self.z.eof:
   require(not self.z.unused_data and not self.pending,'trailing compressed bytes')
   try:next(self.chunks);raise ValueError('trailing encoded part')
   except StopIteration:pass
   self.done=True
 def read(self,n):
  require(type(n) is int and 0<=n<=OBJECT_LIMIT,'bounded decoded read')
  while len(self.buf)<n and not self.done:self.fill()
  require(len(self.buf)>=n,'missing decoded bytes');b=bytes(self.buf[:n]);del self.buf[:n];return b
 def finish(self):
  while not self.done:self.fill()
  require(not self.buf and self.total==self.cap,'extra/missing decoded bytes')

def decoded_map(base,idx):
 d=Decode(Parts(base,idx['mapParts']),MAP_LIMIT);out=bytearray()
 while len(out)<MAP_LIMIT:out.extend(d.read(min(1048576,MAP_LIMIT-len(out))))
 d.finish();require(sha(out)==idx['mapDecodedSha256'],'map decoded hash');m=json.loads(out);return m

def validate_map(m):
 require(m['format']=='cortex-c4-lossless-raw-sha-v1' and m['roots']==ROOTS,'format/root mismatch')
 rows=m['files'];seen=set();byhash={};links=0
 for r in rows:
  require(type(r) is dict,'bad row');allowed(r['path']);require(r['path'] not in seen,'duplicate path');seen.add(r['path'])
  require(type(r['bytes']) is int and 0<=r['bytes']<=OBJECT_LIMIT,'object cap')
  require(type(r['sha256']) is str and len(r['sha256'])==64 and all(c in '0123456789abcdef' for c in r['sha256']),'digest')
  require(type(r['mode']) is int and 0<=r['mode']<=0o7777,'mode')
  if r['kind']=='literal-symlink':
   b=bytes.fromhex(r['targetHex']);require(b and b'\0' not in b and len(b)==r['bytes'] and sha(b)==r['sha256'],'link literal');links+=1
  else:
   require(r['kind']=='file','unknown kind');require(m['contents'].get(r['sha256'])==r['bytes'],'content reference');byhash.setdefault(r['sha256'],[]).append(r)
 require(set(byhash)==set(m['contents']),'unknown/missing content')
 require(sum(m['contents'].values())+72*len(byhash)==STREAM_LIMIT,'stream derived ceiling')
 require(len(rows)==m['manifestRows']+len(ROOTS) and links==m['literalLinks'],'row count')
 return rows,byhash

def objects(base,idx,m):
 d=Decode(Parts(base,idx['archiveParts']),STREAM_LIMIT);seen=set()
 for _ in range(len(m['contents'])):
  h=d.read(64).decode('ascii');size=struct.unpack('>Q',d.read(8))[0]
  require(h in m['contents'] and h not in seen and size==m['contents'][h] and size<=OBJECT_LIMIT,'unknown/duplicate/member-size');seen.add(h)
  b=d.read(size);require(sha(b)==h,'object corrupt');yield h,b
 d.finish();require(seen==set(m['contents']),'missing object')

def verify_set(base,rows):
 expected={r['path'] for r in rows};seen=set()
 for root in ROOTS:
  fd=directory(base/root);os.close(fd)
  def walk(p):
   fd=directory(base/p)
   try:
    for n in os.listdir(fd):
     s=os.stat(n,dir_fd=fd,follow_symlinks=False);q=p+'/'+n
     if stat.S_ISDIR(s.st_mode):walk(q)
     else:seen.add(q)
   finally:os.close(fd)
  walk(root)
 require(seen==expected,'physical filelike set mismatch')
 for r in rows:require(present(base,r),'missing original')

def load(base):
 b=exactread(base,'index.json',INDEX_LIMIT,INDEX_SHA);idx=json.loads(b)
 for category in ['mapParts','archiveParts']:
  ps=idx[category];require(ps and len({p['path'] for p in ps})==len(ps),'missing/duplicate part')
  for i,p in enumerate(ps):require(p['path']==category+'/part-%05d.gzpart'%i,'part path mismatch')
 m=decoded_map(base,idx);rows,byhash=validate_map(m);return idx,m,rows,byhash

def main():
 p=argparse.ArgumentParser();p.add_argument('--target',required=True,type=Path);p.add_argument('--materialize',action='store_true');p.add_argument('--packet',type=Path,default=Path(__file__).absolute().parent);a=p.parse_args()
 idx,m,rows,byhash=load(a.packet)
 # Validate complete compressed stream/object set before any target write.
 for h,b in objects(a.packet,idx,m):pass
 fd=directory(a.target);os.close(fd)
 existing={r['path'] for r in rows if present(a.target,r)};created=0
 if a.materialize:
  for h,b in objects(a.packet,idx,m):
   for r in byhash[h]:
    if r['path'] not in existing:create(a.target,r,b);created+=1
  for r in rows:
   if r['kind']=='literal-symlink' and r['path'] not in existing:create(a.target,r);created+=1
 verify_set(a.target,rows)
 print(json.dumps({'transportOnly':True,'sourceAcceptance':False,'nativeAcceptance':False,'rowsVerified':len(rows),'manifestRows':m['manifestRows'],'originalManifests':len(ROOTS),'literalLinks':m['literalLinks'],'created':created,'existingVerified':len(existing),'indexSha256':INDEX_SHA}))
if __name__=='__main__':main()
