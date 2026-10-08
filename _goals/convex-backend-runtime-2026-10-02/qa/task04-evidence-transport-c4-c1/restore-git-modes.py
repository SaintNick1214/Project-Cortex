#!/usr/bin/env python3
"""Explicit exact Git0644→frozen0600 metadata restoration; never overwrite bytes."""
import argparse,datetime,hashlib,json,os,stat
from pathlib import Path
HELPER_SHA='78a512af1a003f3275b66e014a949ac77a5a961df01c9957d04d950b84348067'
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def load_helper(packet):
 # Compile authenticated .py bytes directly: no owned __pycache__ reads or writes.
 p=packet/'materialize.py';anchor=os.open('/',os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
 try:
  for component in Path(os.path.abspath(packet)).parts[1:]:
   child=os.open(component,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=anchor);os.close(anchor);anchor=child
  f=os.open('materialize.py',os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=anchor)
 finally:os.close(anchor)
 try:
  a=os.fstat(f);assert stat.S_ISREG(a.st_mode) and a.st_size==10603 and a.st_nlink==1
  b=bytearray()
  while len(b)<a.st_size:
   chunk=os.read(f,a.st_size-len(b));assert chunk;b.extend(chunk)
  assert not os.read(f,1);z=os.fstat(f);assert (a.st_dev,a.st_ino,a.st_size,a.st_mtime_ns,a.st_ctime_ns)==(z.st_dev,z.st_ino,z.st_size,z.st_mtime_ns,z.st_ctime_ns)
 finally:os.close(f)
 assert hashlib.sha256(b).hexdigest()==HELPER_SHA,'materializer .py source hash mismatch'
 env={'__file__':str(p),'__name__':'authenticated_transport_source'};exec(compile(bytes(b),str(p),'exec'),env)
 class Namespace:pass
 h=Namespace()
 for k,v in env.items():setattr(h,k,v)
 return h

def fmeta(s):return {'dev':s.st_dev,'ino':s.st_ino,'uid':s.st_uid,'nlink':s.st_nlink,'mode':stat.S_IMODE(s.st_mode),'bytes':s.st_size,'mtimeNs':s.st_mtime_ns,'ctimeNs':s.st_ctime_ns}

def verify_fd(h,f,row):
 before=os.fstat(f);h.require(stat.S_ISREG(before.st_mode) and before.st_size==row['bytes'] and before.st_uid==os.geteuid() and before.st_nlink==1,'existing regular ownership/size/nlink mismatch')
 os.lseek(f,0,os.SEEK_SET);digest=hashlib.sha256();remaining=row['bytes']
 while remaining:
  b=os.read(f,min(1048576,remaining));h.require(0<len(b)<=remaining,'normalizer bounded short read');digest.update(b);remaining-=len(b)
 h.require(not os.read(f,1),'normalizer input growth');after=os.fstat(f)
 h.require(fmeta(before)==fmeta(after) and digest.hexdigest()==row['sha256'],'normalizer exact original content/identity changed')
 return before

def normalize(packet,target):
 h=load_helper(packet);idx,m,rows,byhash=h.load(packet);rowmap={r['path']:r for r in rows};fd=h.directory(target);os.close(fd)
 existing=set()
 for root in h.ROOTS:
  try:fd=h.directory(target/root)
  except FileNotFoundError:continue
  os.close(fd)
  def walk(p):
   fd=h.directory(target/p)
   try:
    for n in os.listdir(fd):
     s=os.stat(n,dir_fd=fd,follow_symlinks=False);path=p+'/'+n
     if stat.S_ISDIR(s.st_mode):walk(path)
     else:existing.add(path)
   finally:os.close(fd)
  walk(root)
 h.require(existing<=set(rowmap),'unknown existing filelike entry before chmod')
 changes=[];verified=0;start=now()
 try:
  # Whole existing closure is authenticated before any mutation; keep change FDs open.
  for path in sorted(existing):
   row=rowmap[path]
   if row['kind']=='literal-symlink':h.require(h.present(target,row),'literal existing link changed');verified+=1;continue
   fd,n=h.parent(target,path)
   try:f=os.open(n,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=fd)
   finally:os.close(fd)
   keep=False
   try:
    before=verify_fd(h,f,row);actual=stat.S_IMODE(before.st_mode)
    if actual==row['mode']:pass
    else:
     h.require(row['mode']==0o600 and actual==0o644,'only explicit exact Git0644 to frozen0600 allowed')
     h.require(len(changes)<len(rows),'derived descriptor count ceiling');changes.append((f,row,fmeta(before)));keep=True
    verified+=1
   finally:
    if not keep:os.close(f)
  # Recheck every held descriptor/path/ancestry after the whole preflight, before first chmod.
  for f,row,before in changes:
   s=verify_fd(h,f,row);h.require(fmeta(s)==before,'preflight original identity drift')
   fd,n=h.parent(target,row['path'])
   try:s2=os.stat(n,dir_fd=fd,follow_symlinks=False)
   finally:os.close(fd)
   h.require(s2.st_dev==s.st_dev and s2.st_ino==s.st_ino,'allowed original path identity changed')
  events=[]
  for f,row,before in changes:
   s=verify_fd(h,f,row);h.require(fmeta(s)==before,'immediate before chmod identity drift')
   fd,n=h.parent(target,row['path'])
   try:s2=os.stat(n,dir_fd=fd,follow_symlinks=False)
   finally:os.close(fd)
   h.require(s2.st_dev==s.st_dev and s2.st_ino==s.st_ino,'immediate safe path changed')
   utcpre=now();os.fchmod(f,0o600);os.fsync(f);after=verify_fd(h,f,row)
   h.require(after.st_dev==before['dev'] and after.st_ino==before['ino'] and stat.S_IMODE(after.st_mode)==0o600 and after.st_uid==before['uid'] and after.st_nlink==1 and after.st_mtime_ns==before['mtimeNs'],'mode restoration changed bytes/identity/owner/nlink')
   h.require(h.present(target,row),'normalized path exact verification')
   events.append({'path':row['path'],'sha256':row['sha256'],'utcPRE':utcpre,'utcPOST':now(),'before':before,'after':fmeta(after)})
  return {'status':'EXPLICIT_GIT_MODE_RESTORATION_PASS','utcPRE':start,'utcPOST':now(),'target':str(target),'existingFilelikeEntriesPrevalidated':verified,'changed':len(events),'changes':events,'allowedTransition':'0644→0600 only for approved exact regular bytes currentuid nlink1','materializerSourceSha256':HELPER_SHA,'ownCachedBytecode':'NOT_READ_NOT_WRITTEN','sourceAcceptance':False,'nativeAcceptance':False}
 finally:
  for f,row,before in changes:os.close(f)

def main():
 p=argparse.ArgumentParser();p.add_argument('--target',required=True,type=Path);p.add_argument('--packet',type=Path,default=Path(__file__).absolute().parent);a=p.parse_args();print(json.dumps(normalize(a.packet,a.target)))
if __name__=='__main__':main()
