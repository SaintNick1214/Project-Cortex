import os,stat,json,hashlib
from pathlib import Path
R=Path('/workspace/Project-Cortex')
def verify(path,pin):
 p=Path(path);p=p if p.is_absolute() else R/p;b=p.read_bytes();assert hashlib.sha256(b).hexdigest()==pin
 d=json.loads(b);root=Path(d.get('root',str(p.parent)));root=root if root.is_absolute() else R/root;rows=d.get('files',d.get('entries'));assert isinstance(rows,list);expected={r['path']:r for r in rows};assert len(expected)==len(rows)
 directories=any(r.get('kind')=='directory' for r in rows);actual={}
 def walk(base):
  for x in os.scandir(base):
   f=Path(x.path);s=f.lstat();n=str(f.relative_to(root))
   if stat.S_ISDIR(s.st_mode):
    if directories:actual[n]=f
    walk(f)
   elif f!=p:actual[n]=f
 walk(root);assert set(actual)==set(expected),(str(p),'exact set',len(actual),len(expected));links=0
 for n,f in actual.items():
  r=expected[n];s=f.lstat()
  if 'mode' in r:assert stat.S_IMODE(s.st_mode)==(int(r['mode'],8) if isinstance(r['mode'],str) else r['mode']),(n,'mode')
  for k,v in [('uid',s.st_uid),('nlink',s.st_nlink)]:
   if k in r:assert r[k]==v,(n,k)
  if stat.S_ISDIR(s.st_mode):assert r['kind']=='directory';continue
  if stat.S_ISLNK(s.st_mode):
   links+=1;raw=os.fsencode(os.readlink(f));assert r['kind'] in ['symlink','literal-symlink','link']
   if 'target' in r:assert os.readlink(f)==r['target']
   if 'targetHex' in r:assert raw.hex()==r['targetHex']
  else:
   assert stat.S_ISREG(s.st_mode) and r['kind']=='file';fd=os.open(f,os.O_RDONLY|os.O_NOFOLLOW)
   with os.fdopen(fd,'rb') as h:
    z=os.fstat(h.fileno());assert (z.st_dev,z.st_ino)==(s.st_dev,s.st_ino);raw=h.read();z2=os.fstat(h.fileno());assert (z.st_size,z.st_mtime_ns,z.st_ctime_ns)==(z2.st_size,z2.st_mtime_ns,z2.st_ctime_ns)
  if 'bytes' in r:assert len(raw)==r['bytes'],(n,'bytes')
  if 'sha256' in r:assert hashlib.sha256(raw).hexdigest()==r['sha256'],(n,'hash')
 return {'path':str(p),'sha256':pin,'rows':len(rows),'literalLinks':links,'directoriesIncluded':directories,'verified':True}
