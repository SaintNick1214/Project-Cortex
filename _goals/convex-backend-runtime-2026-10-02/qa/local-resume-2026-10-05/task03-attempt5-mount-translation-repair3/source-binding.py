"""Finite full-EOF/current-all9 reader for exact public and operative cohorts."""
import hashlib,os,stat
from pathlib import Path
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def identity(value):return {field:str(getattr(value,'st_'+field)) for field in FIELDS}
def read(root,path,expected=None):
 root=Path(root);path=Path(path);relative=path.relative_to(root)
 assert not relative.is_absolute() and '..' not in relative.parts
 part=root
 assert stat.S_ISDIR(part.lstat().st_mode)
 for name in relative.parts[:-1]:
  part=part/name;assert stat.S_ISDIR(part.lstat().st_mode)
 before=path.lstat();pin=identity(before)
 assert stat.S_ISREG(before.st_mode) and before.st_nlink==1 and before.st_uid==501 and before.st_gid==20
 if expected is not None:
  assert pin==expected['identityDecimal'], {'path':str(relative),'phase':'PRE_ALL9','old':expected['identityDecimal'],'current':pin}
 fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  assert identity(os.fstat(fd))==pin
  h=hashlib.sha256();count=0
  while True:
   raw=os.read(fd,65536)
   if not raw:break
   count+=len(raw);assert count<=before.st_size;h.update(raw)
  assert count==before.st_size and pin==identity(os.fstat(fd))==identity(path.lstat())
 finally:os.close(fd)
 row={'path':str(relative),'sha256':h.hexdigest(),'bytes':count,'identityDecimal':pin,'fullEOF':True,'allNineThroughRead':True}
 if expected is not None:assert row['sha256']==expected['sha256'] and count==expected['bytes']
 return row
def final(root,rows):
 for row in rows:
  current=identity((Path(root)/row['path']).lstat())
  assert current==row['identityDecimal'], {'path':row['path'],'phase':'FINAL_PATH_ALL9','old':row['identityDecimal'],'current':current}
 return {'status':'PASS','bindings':len(rows),'fullEOFHashSize':'PASS','allNineThroughReadAndFinalPath':'PASS_ALL9','deltas':[]}
