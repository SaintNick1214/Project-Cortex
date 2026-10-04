from pathlib import Path
import os,stat,hashlib,json,gzip,tarfile,struct,datetime,io
R=Path('/workspace/Project-Cortex');Q=R/'_goals/convex-backend-runtime-2026-10-02/qa';O=Path('/tmp/cortex-root-storage-rescue/c5-prior-content-catalog');O.mkdir(mode=0o700,exist_ok=True)
H=lambda b:hashlib.sha256(b).hexdigest()
I=lambda s:tuple(getattr(s,'st_'+k) for k in ['dev','ino','mode','uid','nlink','size','mtime_ns','ctime_ns'])
def held(p):
 p=Path(p);s=p.lstat();assert stat.S_ISREG(s.st_mode) and s.st_nlink==1
 f=os.fdopen(os.open(p,os.O_RDONLY|os.O_NOFOLLOW),'rb');assert (s.st_dev,s.st_ino,s.st_size)==(os.fstat(f.fileno()).st_dev,os.fstat(f.fileno()).st_ino,os.fstat(f.fileno()).st_size)
 return f,s
def file_digest(p):
 f,s=held(p);h=hashlib.sha256()
 with f:
  for b in iter(lambda:f.read(1048576),b''):h.update(b)
  assert I(os.fstat(f.fileno()))==I(s)==I(Path(p).lstat())
 return h.hexdigest(),s.st_size
class Parts(io.RawIOBase):
 def __init__(self,rows):
  self.rows=rows;self.files=[];self.i=0;self.hash=hashlib.sha256();self.count=0
  for r in rows:
   f,s=held(r['sourcePath']);h=hashlib.sha256()
   for b in iter(lambda:f.read(1048576),b''):h.update(b)
   assert s.st_size==r['bytes'] and h.hexdigest()==r['sha256'];assert I(os.fstat(f.fileno()))==I(s)==I(Path(r['sourcePath']).lstat());f.seek(0);self.files.append((f,s))
 def readable(self):return True
 def read(self,n=-1):
  if n<0:n=sum(r['bytes'] for r in self.rows)-self.count
  out=[]
  while n and self.i<len(self.files):
   f,s=self.files[self.i];b=f.read(n)
   if not b:
    assert I(os.fstat(f.fileno()))==I(s)==I(Path(self.rows[self.i]['sourcePath']).lstat());self.i+=1;continue
   out.append(b);self.hash.update(b);self.count+=len(b);n-=len(b)
  return b''.join(out)
 def finish(self):
  while self.read(1048576):pass
  return self.hash.hexdigest(),self.count
 def close(self):
  for f,s in self.files:f.close()
  super().close()
catalog={};backings=[]
def register(h,size,kind):
 if h in catalog:assert catalog[h]['bytes']==size
 else:catalog[h]={'bytes':size,'backing':kind}
tp=Q/'task04-evidence-transport-c4-c1';indexRaw=(tp/'index.json').read_bytes();assert H(indexRaw)=='a82fb82ad92d4a9753a9c7fe612ba880f82f4893a7a6d3e211dc8ec9a4fad869';ix=json.loads(indexRaw)
mapraw=b''.join((tp/r['path']).read_bytes() for r in ix['mapParts'])
for r in ix['mapParts']:assert file_digest(tp/r['path'])==(r['sha256'],r['bytes'])
decoded=gzip.decompress(mapraw);assert len(decoded)==ix['mapDecodedBytes'] and H(decoded)==ix['mapDecodedSha256'];m=json.loads(decoded)
rows=[{**r,'sourcePath':str(tp/r['path'])} for r in ix['archiveParts']];parts=Parts(rows);seen=set();total=0
with gzip.GzipFile(fileobj=parts,mode='rb') as z:
 for _ in range(ix['uniqueContents']):
  header=z.read(72);assert len(header)==72;h=header[:64].decode('ascii');size=struct.unpack('>Q',header[64:])[0];assert h in m['contents'] and h not in seen and size==m['contents'][h] and size<=ix['maxObjectBytes'];remaining=size;digest=hashlib.sha256()
  while remaining:
   b=z.read(min(1048576,remaining));assert b;digest.update(b);remaining-=len(b)
  assert digest.hexdigest()==h;seen.add(h);total+=size+72;register(h,size,'transport-c4-c1')
 assert z.read(1)==b''
assert total==ix['archiveDecodedBytes'] and seen==set(m['contents']);archiveSHA,archiveBytes=parts.finish();parts.close()
backings.append({'kind':'transport-c4-c1','indexPath':str(tp/'index.json'),'indexSHA256':H(indexRaw),'format':ix['format'],'objectCount':len(seen),'archiveSHA256':archiveSHA,'archiveBytes':archiveBytes,'parts':rows})
for number,name,pin in [(38,'task04-c3-and-review-byte-backing','4a3c61ac138bf864fc93fb2e26636a8ab90582b73ca636dd2e80c087b6c6277f'),(39,'task04-c4-delta-byte-backing','a0c2f982bbc0f1d97cf0fa34255ea73fa9e9d0ea56c39fd83b3ed38fe26b8399'),(40,'task04-c4-fresh-review-delta-byte-backing','2e8b11330055a70aa5ab0eb14c683f43a9bb86c4735a84714268a0a29ad5871b')]:
 mapping=json.loads((R/f'work/resume/transfer{number}-virtual-source-mapping.json').read_text());indexRel=str((Q/name/'index.json').relative_to(R));indexPath=Path(mapping.get(indexRel,str(R/indexRel)));raw=indexPath.read_bytes();assert H(raw)==pin;idx=json.loads(raw);objects={r['sha256']:r['bytes'] for r in idx['objects'] if number==38 or r['backing']=='delta'}
 rows=[{**r,'sourcePath':mapping[str((Q/name/r['name']).relative_to(R))]} for r in idx['archive']['parts']];parts=Parts(rows);seen=set()
 with tarfile.open(fileobj=parts,mode='r|gz') as tar:
  for member in tar:
   assert member.isfile() and member.name.startswith('objects/');h=member.name[8:];assert h in objects and h not in seen and member.size==objects[h];digest=hashlib.sha256()
   with tar.extractfile(member) as source:
    for b in iter(lambda:source.read(1048576),b''):digest.update(b)
   assert digest.hexdigest()==h;seen.add(h);register(h,member.size,name)
 assert seen==set(objects);archiveSHA,archiveBytes=parts.finish();parts.close();assert archiveSHA==idx['archive']['sha256'] and archiveBytes==idx['archive']['bytes']
 backings.append({'kind':name,'indexPath':str(indexPath),'repositoryIndexPath':indexRel,'indexSHA256':pin,'format':idx['format'],'objectCount':len(seen),'archiveSHA256':archiveSHA,'archiveBytes':archiveBytes,'parts':rows})
out={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'VERIFIED_PRIOR_CONTENT_OBJECT_CATALOG_ONLY_NO_RUNTIME_CUSTODY_OR_C5_ACCEPTANCE','backings':backings,'objects':catalog};p=O/'catalog.json';p.write_text(json.dumps(out,separators=(',',':'))+'\n');receipt={'utc':out['utc'],'scope':out['scope'],'catalogPath':str(p),'catalogBytes':p.stat().st_size,'catalogSHA256':H(p.read_bytes()),'backingCount':len(backings),'uniqueObjects':len(catalog),'uniqueBytes':sum(r['bytes'] for r in catalog.values()),'everyArchiveMemberHashVerified':True,'orderedCanonicalPartsUsedWithoutConcatenatedDuplicateFiles':True}
(Q/'task04-c5-prior-content-catalog-root-verification.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt))
