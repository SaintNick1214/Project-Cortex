#!/usr/bin/env python3
"""Explicit pinned0700 directory restoration within eight frozen namespaces."""
import argparse,datetime,hashlib,json,os,stat
from pathlib import Path
SIDE_BYTES=898206
SIDE_SHA='aaa0f268de76d0a39cd40f12b7d2865e74b30ca2d6e3613a1705a767f396125f'
DECODE_BYTES=20105927
DECODE_SHA='4a64f9f5c8792908579d5946d880919bf71c2788452a627f87e313a4335f2ca8'
DIR_COUNT=62205
NORMALIZER_SHA='187c3950f02caa16f0671a615faa93d0657377e8b84da95b7ea28e7069da48cf'
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def helper(packet):
 # Load only authenticated ordinary source bytes, bypassing own cached bytecode.
 anchor=os.open('/',os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
 try:
  for c in Path(os.path.abspath(packet)).parts[1:]:
   n=os.open(c,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=anchor);os.close(anchor);anchor=n
  f=os.open('restore-git-modes.py',os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=anchor)
 finally:os.close(anchor)
 try:
  s=os.fstat(f);assert stat.S_ISREG(s.st_mode) and s.st_nlink==1 and 0<s.st_size<=65536
  b=bytearray()
  while len(b)<s.st_size:
   chunk=os.read(f,s.st_size-len(b));assert chunk;b.extend(chunk)
  assert not os.read(f,1);after=os.fstat(f);assert (s.st_dev,s.st_ino,s.st_size,s.st_mtime_ns,s.st_ctime_ns)==(after.st_dev,after.st_ino,after.st_size,after.st_mtime_ns,after.st_ctime_ns)
 finally:os.close(f)
 assert hashlib.sha256(b).hexdigest()==NORMALIZER_SHA,'normalizer source changed'
 scope={'__file__':str(packet/'restore-git-modes.py'),'__name__':'authenticated_mode_source'};exec(compile(bytes(b),scope['__file__'],'exec'),scope);return scope['load_helper'](packet)

def load(packet):
 h=helper(packet);b=h.exactread(packet,'directory-modes.json.gz',SIDE_BYTES,SIDE_SHA);h.require(SIDE_BYTES<=h.PART_LIMIT,'directory encoded part cap');d=h.Decode([b],DECODE_BYTES);out=bytearray()
 while len(out)<DECODE_BYTES:out.extend(d.read(min(1048576,DECODE_BYTES-len(out))))
 d.finish();h.require(h.sha(out)==DECODE_SHA,'directory decoded hash');m=json.loads(out)
 h.require(m['format']=='cortex-c4-exact-directory-modes-v1' and m['roots']==h.ROOTS and len(m['directories'])==DIR_COUNT,'directory fixed identity/count');paths=set()
 for r in m['directories']:
  h.safe(r['path']);h.require(r['path'] in h.ROOTS or any(r['path'].startswith(root+'/') for root in h.ROOTS),'directory outside exact scope');h.require(r['path'] not in paths and r['mode']==0o700,'directory duplicate/expected mode');paths.add(r['path'])
 for p in paths:
  if p not in h.ROOTS:h.require(os.path.dirname(p) in paths,'directory missing ordinary ancestor')
 return h,m

def meta(s):return {'dev':s.st_dev,'ino':s.st_ino,'uid':s.st_uid,'mode':stat.S_IMODE(s.st_mode),'nlink':s.st_nlink,'mtimeNs':s.st_mtime_ns,'ctimeNs':s.st_ctime_ns}
def safe_fd(h,f):
 s=os.fstat(f);h.require(stat.S_ISDIR(s.st_mode) and s.st_uid==os.geteuid() and stat.S_IMODE(s.st_mode) in (0o700,0o755),'directory owner/type/current-mode mismatch');return s

def restore(packet,target,prepare=False):
 h,m=load(packet);fd=h.directory(target);os.close(fd);rows=m['directories'];expected={r['path'] for r in rows};existing=set()
 for root in h.ROOTS:
  try:fd=h.directory(target/root)
  except FileNotFoundError:continue
  os.close(fd)
  def walk(p):
   existing.add(p);fd=h.directory(target/p)
   try:
    for n in os.listdir(fd):
     s=os.stat(n,dir_fd=fd,follow_symlinks=False)
     if stat.S_ISDIR(s.st_mode):walk(p+'/'+n)
   finally:os.close(fd)
  walk(root)
 h.require(existing<=expected,'unknown directory before mutation');held=[];start=now();created=[];events=[]
 try:
  # All existing directories validated BEFORE any mkdir/chmod. Retain exact identities with bounded sequential descriptors; revalidate whole set before mutation.
  for p in sorted(existing):
   f=h.directory(target/p)
   try:s=safe_fd(h,f);held.append((p,meta(s)));os.close(f)
   except BaseException:os.close(f);raise
   h.require(len(held)<=DIR_COUNT,'derived open-directory count ceiling')
  for p,before in held:
   f=h.directory(target/p)
   try:s=safe_fd(h,f);h.require(meta(s)==before,'directory preflight identity drift')
   finally:os.close(f)
  selected=set(h.ROOTS) if prepare else expected
  # Fresh roots and every new ordinary directory start private0700.
  for p in sorted(selected-existing,key=lambda p:(p.count('/'),p)):
   parent,name=os.path.split(p);anchor=h.directory(target/parent,True)
   try:os.mkdir(name,0o700,dir_fd=anchor)
   finally:os.close(anchor)
   f=h.directory(target/p)
   try:s=safe_fd(h,f);h.require(stat.S_IMODE(s.st_mode)==0o700,'created directory not private');created.append({'path':p,'mode':0o700,'dev':s.st_dev,'ino':s.st_ino})
   finally:os.close(f)
  # Existing expected0755→0700 only. Missing directories were exclusively created above.
  for p,initial in held:
   if p not in selected:continue
   f=h.directory(target/p)
   try:
    s=safe_fd(h,f);before=meta(s);h.require(s.st_dev==initial['dev'] and s.st_ino==initial['ino'] and s.st_uid==initial['uid'] and before['mode']==initial['mode'],'directory identity/owner/mode drift')
    check=h.directory(target/p)
    try:s2=os.fstat(check);h.require(s2.st_dev==s.st_dev and s2.st_ino==s.st_ino,'immediate safe directory path changed')
    finally:os.close(check)
    if before['mode']==0o700:continue
    utcpre=now();os.fchmod(f,0o700);os.fsync(f);after=meta(safe_fd(h,f));h.require(after['dev']==before['dev'] and after['ino']==before['ino'] and after['uid']==before['uid'] and after['mode']==0o700 and after['nlink']==before['nlink'] and after['mtimeNs']==before['mtimeNs'],'directory chmod changed identity/topology/mtime')
    events.append({'path':p,'utcPRE':utcpre,'utcPOST':now(),'before':before,'after':after})
   finally:os.close(f)
  for p in selected:
   f=h.directory(target/p)
   try:s=safe_fd(h,f);h.require(stat.S_IMODE(s.st_mode)==0o700,'directory final mode mismatch')
   finally:os.close(f)
  return {'status':'PINNED_DIRECTORY_MODE_RESTORATION_PASS','utcPRE':start,'utcPOST':now(),'target':str(target),'prepareRootsOnly':prepare,'sourceDirectoryRows':DIR_COUNT,'directoriesVerified':len(selected),'existingDirectoriesPrevalidated':len(existing),'created':len(created),'changed':len(events),'createdDirectories':created,'changes':events,'decodedDirectorySha256':DECODE_SHA,'sourceModeMetadataCapture':'Current recovered original source snapshot; no historical preincident directory metadata capture is claimed','sourceDirectoryInodeTimeTopologyNotReconstructed':True,'ownBytecodeRead':False,'sourceAcceptance':False,'nativeAcceptance':False}
 finally:
  pass

def main():
 p=argparse.ArgumentParser();p.add_argument('--target',required=True,type=Path);p.add_argument('--packet',type=Path,default=Path(__file__).absolute().parent);p.add_argument('--prepare-roots',action='store_true');a=p.parse_args();print(json.dumps(restore(a.packet,a.target,a.prepare_roots)))
if __name__=='__main__':main()
