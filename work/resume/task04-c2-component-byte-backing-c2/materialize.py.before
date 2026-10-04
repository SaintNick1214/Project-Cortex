"""Pinned historical byte-object recovery; never writes provenance paths."""
import argparse,hashlib,io,json,os,re,stat,tarfile,zlib
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--index',type=Path,required=True);p.add_argument('--index-sha256',required=True);p.add_argument('--destination',type=Path,required=True);a=p.parse_args()
def read_regular(path):
 st=path.lstat();assert stat.S_ISREG(st.st_mode) and st.st_nlink==1
 fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
 with os.fdopen(fd,'rb') as h:
  before=os.fstat(h.fileno());assert (before.st_dev,before.st_ino)==(st.st_dev,st.st_ino);data=h.read();after=os.fstat(h.fileno());assert (before.st_size,before.st_mtime_ns,before.st_ctime_ns)==(after.st_size,after.st_mtime_ns,after.st_ctime_ns)
 return data
def unique_pairs(pairs):
 d={}
 for k,v in pairs:assert k not in d;d[k]=v
 return d
rawindex=read_regular(a.index);assert hashlib.sha256(rawindex).hexdigest()==a.index_sha256
index=json.loads(rawindex,object_pairs_hook=unique_pairs,parse_constant=lambda _: (_ for _ in ()).throw(ValueError('nonfinite JSON')));assert index['schemaVersion']==1
objects={}
for r in index['objects']:
 sha=r['sha256'];assert re.fullmatch('[0-9a-f]{64}',sha) and sha not in objects and type(r['bytes']) is int and 0<=r['bytes']<=index['archiveBytes'];objects[sha]=r['bytes']
assert 0<len(objects)<=10000 and 0<index['archiveBytes']<=256*1024*1024
compressed=bytearray()
for n,r in enumerate(index['parts']):
 assert r['path']==f'objects.part-{n:04d}' and type(r['bytes']) is int and 0<r['bytes']<=5*1024*1024
 b=read_regular(a.index.parent/r['path']);assert len(b)==r['bytes'] and hashlib.sha256(b).hexdigest()==r['sha256'];assert len(compressed)+len(b)<=index['archiveBytes'];compressed.extend(b)
assert len(compressed)==index['archiveBytes'] and hashlib.sha256(compressed).hexdigest()==index['archiveSHA256']
limit=sum(((n+511)//512)*512+512 for n in objects.values())+10240
z=zlib.decompressobj(31);decoded=z.decompress(compressed,limit+1);assert len(decoded)<=limit and z.eof and not z.unused_data and not z.unconsumed_tail
validated={};last_end=0
with tarfile.open(fileobj=io.BytesIO(decoded),mode='r:') as t:
 for m in t:
  assert m.isfile() and not m.pax_headers and m.mode==0o600 and re.fullmatch('objects/[0-9a-f]{64}',m.name)
  sha=m.name[8:];assert sha in objects and sha not in validated and m.size==objects[sha];b=t.extractfile(m).read();assert len(b)==objects[sha] and hashlib.sha256(b).hexdigest()==sha;validated[sha]=b;last_end=m.offset_data+((m.size+511)//512)*512
assert set(validated)==set(objects) and len(decoded)-last_end>=1024 and not decoded[last_end:].strip(b'\0')
# Validate all inputs before any destination mutation. Ancestors are ordinary directories.
dst=a.destination.absolute();assert dst!=Path('/')
for parent in reversed(dst.parents):assert stat.S_ISDIR(parent.lstat().st_mode)
created=False
if not dst.exists() and not dst.is_symlink():dst.mkdir(mode=0o700);created=True
st=dst.lstat();assert stat.S_ISDIR(st.st_mode) and st.st_uid==os.getuid() and stat.S_IMODE(st.st_mode)==0o700
rootfd=os.open(dst,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
try:
 assert (os.fstat(rootfd).st_dev,os.fstat(rootfd).st_ino)==(st.st_dev,st.st_ino)
 if created:os.mkdir('objects',0o700,dir_fd=rootfd)
 assert set(os.listdir(rootfd))=={'objects'}
 objfd=os.open('objects',os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=rootfd)
 try:
  s=os.fstat(objfd);assert s.st_uid==os.getuid() and stat.S_IMODE(s.st_mode)==0o700
  if created:
   for sha,b in validated.items():
    fd=os.open(sha,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600,dir_fd=objfd)
    with os.fdopen(fd,'wb') as h:h.write(b);h.flush();os.fsync(h.fileno())
  assert set(os.listdir(objfd))==set(objects)
  for sha,n in objects.items():
   fd=os.open(sha,os.O_RDONLY|os.O_NOFOLLOW,dir_fd=objfd)
   with os.fdopen(fd,'rb') as h:
    s=os.fstat(h.fileno());assert stat.S_ISREG(s.st_mode) and s.st_uid==os.getuid() and s.st_nlink==1 and stat.S_IMODE(s.st_mode)==0o600;b=h.read();assert len(b)==n and hashlib.sha256(b).hexdigest()==sha
 finally:os.close(objfd)
finally:os.close(rootfd)
print(json.dumps({'status':'MATERIALIZED' if created else 'VERIFIED_EXISTING','objects':len(objects),'bytes':sum(objects.values()),'provenancePathsWritten':False,'historicalCustody':'BROKEN','qualificationReleased':False}))
