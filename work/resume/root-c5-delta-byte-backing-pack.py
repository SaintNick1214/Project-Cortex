from pathlib import Path
import os,stat,json,hashlib,gzip,tarfile,datetime,sys,io
R=Path('/workspace/Project-Cortex');Q=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-c5-delta-byte-backing';O=Path('/dev/shm/cortex-root-storage-rescue-c5/c5-delta-byte-backing')
assert len(sys.argv)==2
planPath=Path(sys.argv[1]);planRaw=planPath.read_bytes();plan=json.loads(planRaw)
H=lambda b:hashlib.sha256(b).hexdigest()
def digest(p):
 h=hashlib.sha256()
 with Path(p).open('rb') as f:
  for b in iter(lambda:f.read(1048576),b''):h.update(b)
 return h.hexdigest()
catalogPath=Path('/tmp/cortex-root-storage-rescue/c5-prior-content-catalog/catalog.json');catalogRaw=catalogPath.read_bytes();assert H(catalogRaw)=='0d5f75f77bea82d00b860491ba040b5af9c06b871304e7a798cc588d59715d38';catalog=json.loads(catalogRaw)
# Authenticate canonical prior parts again; the catalog's actual decoded objects were independently fully streamed and hashed.
for backing in catalog['backings']:
 assert digest(backing['indexPath'])==backing['indexSHA256']
 archiveHash=hashlib.sha256();archiveBytes=0
 for r in backing['parts']:
  p=Path(r['sourcePath']);s=p.lstat();assert stat.S_ISREG(s.st_mode) and s.st_nlink==1 and s.st_size==r['bytes']
  fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
  with os.fdopen(fd,'rb') as f:
   a=os.fstat(f.fileno());h=hashlib.sha256()
   for b in iter(lambda:f.read(1048576),b''):h.update(b);archiveHash.update(b);archiveBytes+=len(b)
   assert (a.st_dev,a.st_ino,a.st_size,a.st_mtime_ns,a.st_ctime_ns)==(s.st_dev,s.st_ino,s.st_size,s.st_mtime_ns,s.st_ctime_ns)
   z=os.fstat(f.fileno());last=p.lstat();assert (z.st_dev,z.st_ino,z.st_size,z.st_mtime_ns,z.st_ctime_ns)==(last.st_dev,last.st_ino,last.st_size,last.st_mtime_ns,last.st_ctime_ns)==(s.st_dev,s.st_ino,s.st_size,s.st_mtime_ns,s.st_ctime_ns)
  assert h.hexdigest()==r['sha256']
 assert archiveHash.hexdigest()==backing['archiveSHA256'] and archiveBytes==backing['archiveBytes']
refs=[];allObjects={};seals=[]
for subject in plan['subjects']:
 root=Path(subject['root']);seal=Path(subject['sealPath']);raw=seal.read_bytes();assert H(raw)==subject['sealSHA256'];packet=json.loads(gzip.decompress(raw) if seal.suffix=='.gz' else raw);assert packet['root']==str(root)
 rows=list(packet['rows']);s=seal.lstat();rows.append({'path':str(seal.relative_to(root)),'kind':'file','bytes':len(raw),'sha256':H(raw),'identity':{k:getattr(s,'st_'+k) for k in ['dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns']}})
 for row in rows:
  rel=Path(row['path']);assert not rel.is_absolute() and '..' not in rel.parts;p=root/rel;s=p.lstat()
  for k,v in row['identity'].items():assert getattr(s,'st_'+k)==v
  kind=row['kind']
  if kind=='file':
   assert stat.S_ISREG(s.st_mode) and s.st_nlink==1 and s.st_size==row['bytes'] and digest(p)==row['sha256'];allObjects.setdefault(row['sha256'],{'path':str(p),'bytes':row['bytes']});assert allObjects[row['sha256']]['bytes']==row['bytes']
  elif kind=='directory':assert stat.S_ISDIR(s.st_mode)
  elif kind=='symlink':assert stat.S_ISLNK(s.st_mode) and os.readlink(p)==row['target']
  else:raise AssertionError(kind)
  refs.append({'scope':subject['scope'],'provenancePath':str(p),**row})
 seals.append({**subject,'rows':len(packet['rows'])})
prior=catalog['objects'];reused={h:v for h,v in allObjects.items() if h in prior}
for h,v in reused.items():assert v['bytes']==prior[h]['bytes']
delta={h:v for h,v in allObjects.items() if h not in prior};Q.mkdir(mode=0o700);O.mkdir(mode=0o700)
class SplitWriter:
 def __init__(self):self.file=None;self.count=0;self.hash=hashlib.sha256();self.partHash=None;self.partBytes=0;self.parts=[]
 def write(self,data):
  at=0
  while at<len(data):
   if self.file is None:
    self.file=(O/f'objects.part-{len(self.parts):04d}').open('xb');self.partHash=hashlib.sha256();self.partBytes=0
   n=min(len(data)-at,5*1024*1024-self.partBytes);chunk=data[at:at+n];assert self.file.write(chunk)==n;self.hash.update(chunk);self.partHash.update(chunk);self.partBytes+=n;self.count+=n;at+=n
   if self.partBytes==5*1024*1024:self.closePart()
  return len(data)
 def flush(self):
  if self.file:self.file.flush()
 def closePart(self):
  if self.file:
   self.file.flush();os.fsync(self.file.fileno());name=Path(self.file.name).name;self.file.close();self.parts.append({'name':name,'bytes':self.partBytes,'sha256':self.partHash.hexdigest()});self.file=None
 def finish(self):self.closePart()
class JoinedParts(io.RawIOBase):
 def __init__(self,parts):self.parts=parts;self.i=0;self.file=None;self.count=0;self.hash=hashlib.sha256()
 def readable(self):return True
 def read(self,n=-1):
  if n<0:n=sum(r['bytes'] for r in self.parts)-self.count
  out=[]
  while n and self.i<len(self.parts):
   if self.file is None:
    r=self.parts[self.i];p=O/r['name'];assert p.stat().st_size==r['bytes'] and digest(p)==r['sha256'];self.file=p.open('rb')
   b=self.file.read(n)
   if not b:self.file.close();self.file=None;self.i+=1;continue
   out.append(b);self.hash.update(b);self.count+=len(b);n-=len(b)
  return b''.join(out)
 def finish(self):
  while self.read(1048576):pass
sink=SplitWriter()
with gzip.GzipFile(fileobj=sink,mode='wb',filename='',mtime=0,compresslevel=3) as z:
 with tarfile.open(fileobj=z,mode='w|',format=tarfile.USTAR_FORMAT) as tar:
  for h,v in sorted(delta.items()):
   p=Path(v['path']);fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
   with os.fdopen(fd,'rb') as source:
    s=os.fstat(source.fileno());assert stat.S_ISREG(s.st_mode) and s.st_nlink==1 and s.st_size==v['bytes'];header=tarfile.TarInfo('objects/'+h);header.size=v['bytes'];header.mode=0o600;header.uid=header.gid=header.mtime=0;tar.addfile(header,source);last=os.fstat(source.fileno());assert (s.st_dev,s.st_ino,s.st_size,s.st_mtime_ns,s.st_ctime_ns)==(last.st_dev,last.st_ino,last.st_size,last.st_mtime_ns,last.st_ctime_ns)
sink.finish();parts=sink.parts;joined=JoinedParts(parts);seen=set()
with tarfile.open(fileobj=joined,mode='r|gz') as tar:
 for member in tar:
  assert member.isfile() and member.name.startswith('objects/');h=member.name[8:];assert h in delta and h not in seen and member.size==delta[h]['bytes'];actual=hashlib.sha256()
  with tar.extractfile(member) as source:
   for b in iter(lambda:source.read(1048576),b''):actual.update(b)
  assert actual.hexdigest()==h;seen.add(h)
assert seen==set(delta);joined.finish();assert joined.count==sink.count and joined.hash.hexdigest()==sink.hash.hexdigest()
mapping={str((Q/r['name']).relative_to(R)):str(O/r['name']) for r in parts}
for subject in seals:assert digest(subject['sealPath'])==subject['sealSHA256']
index={'format':'C5_DELTA_MULTIPRIOR_CONTENT_OBJECTS_ONLY_V1','utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourcePlanSHA256':H(planRaw),'sourceSeals':seals,'references':refs,'objects':[{'sha256':h,'bytes':v['bytes'],'backing':prior[h]['backing'] if h in reused else 'delta'} for h,v in sorted(allObjects.items())],'priorCatalog':{'repositoryPath':'_goals/convex-backend-runtime-2026-10-02/qa/task04-c5-prior-content-catalog/catalog.json','sha256':H(catalogRaw),'backings':catalog['backings']},'archive':{'bytes':sink.count,'sha256':sink.hash.hexdigest(),'parts':parts},'scope':'AUTHENTIC_CONTENT_ONLY_NO_PHYSICAL_RESTORATION_INODE_CUSTODY_OR_RUNTIME_ACCEPTANCE','original122':'HELD','freshCompositionReview':'PENDING'}
p=O/'index.json';p.write_text(json.dumps(index,separators=(',',':'))+'\n');mapping[str((Q/'index.json').relative_to(R))]=str(p);mapping['_goals/convex-backend-runtime-2026-10-02/qa/task04-c5-prior-content-catalog/catalog.json']=str(catalogPath)
(R/'work/resume/transfer42-virtual-source-mapping.json').write_text(json.dumps(mapping,indent=2)+'\n');receipt={'utc':index['utc'],'scope':index['scope'],'references':len(refs),'objects':len(allObjects),'deltaObjects':len(delta),'reusedObjects':len(reused),'deltaRawBytes':sum(v['bytes'] for v in delta.values()),'archiveBytes':index['archive']['bytes'],'archiveSHA256':index['archive']['sha256'],'parts':len(parts),'indexSHA256':digest(p),'priorCatalogSHA256':H(catalogRaw),'everyDeltaObjectStreamVerified':True,'sourceSealHashesUnchanged':True};(Q/'root-pack-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt))
