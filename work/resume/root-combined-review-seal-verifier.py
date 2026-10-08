from pathlib import Path
import json,hashlib,stat,os

def verify(path,pin):
 p=Path(path).absolute();assert hashlib.sha256(p.read_bytes()).hexdigest()==pin;d=json.loads(p.read_text());rows={r['path']:r for r in d['entries']};assert len(rows)==len(d['entries']);actual={};excluded=set(d['excludedExactSelfOnly']);assert excluded=={str(p)}
 def walk(f):
  s=f.lstat();actual[str(f)]=f
  if stat.S_ISDIR(s.st_mode):
   for x in os.scandir(f):
    z=Path(x.path)
    if str(z) not in excluded:walk(z)
 for root in d['ownedRoots']:walk(Path(root))
 assert set(actual)==set(rows)
 for name,f in actual.items():
  r=rows[name];s=f.lstat()
  for k,v in [('mode',stat.S_IMODE(s.st_mode)),('uid',s.st_uid),('gid',s.st_gid),('dev',s.st_dev),('ino',s.st_ino),('nlink',s.st_nlink),('size',s.st_size),('mtime_ns',s.st_mtime_ns),('ctime_ns',s.st_ctime_ns)]:
   if k in r:assert r[k]==v,(name,k)
  if stat.S_ISREG(s.st_mode):
   assert r['kind'] in ['regular','file'];fd=os.open(f,os.O_RDONLY|os.O_NOFOLLOW)
   with os.fdopen(fd,'rb') as h:
    before=os.fstat(h.fileno());assert (before.st_dev,before.st_ino)==(s.st_dev,s.st_ino);digest=hashlib.file_digest(h,'sha256').hexdigest();after=os.fstat(h.fileno());assert (before.st_size,before.st_mtime_ns,before.st_ctime_ns)==(after.st_size,after.st_mtime_ns,after.st_ctime_ns)
   assert digest==r['sha256'],name
  elif stat.S_ISLNK(s.st_mode):
   assert r['kind'] in ['symlink','literal-symlink']
   if 'target' in r:assert os.readlink(f)==r['target']
   if 'targetHex' in r:assert os.fsencode(os.readlink(f)).hex()==r['targetHex']
  elif stat.S_ISDIR(s.st_mode):assert r['kind']=='directory'
  elif stat.S_ISFIFO(s.st_mode):assert r['kind'] in ['fifo','special']
  else:assert r['kind']=='special'
 return {'path':str(p),'sha256':pin,'entries':len(rows),'exactSelfOnly':True,'allDeclaredMetadataAndRegularBytesVerified':True,'symlinksLiteralOnly':True,'specialFilesNeverOpened':True}
