from pathlib import Path
import os,stat,json,gzip,hashlib,datetime
R=Path('/workspace/Project-Cortex');Q=R/'_goals/convex-backend-runtime-2026-10-02/qa';C=Q/'task04-c5-fresh-review-content-backing';W=R/'work/resume/task04-c5-fresh-review-content-backing';T=Path('/dev/shm/cortex-root-c5-fresh-review-content-backing')
H=lambda b:hashlib.sha256(b).hexdigest()
def identity(s):return {k:getattr(s,'st_'+k) for k in ['dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns']}
def read(p,retain=False):
 p=Path(p);s=p.lstat();assert stat.S_ISREG(s.st_mode) and s.st_nlink==1
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW);h=hashlib.sha256();chunks=[]
 try:
  assert identity(s)==identity(os.fstat(fd))
  while True:
   b=os.read(fd,1048576)
   if not b:break
   h.update(b)
   if retain:chunks.append(b)
  assert identity(s)==identity(os.fstat(fd))==identity(p.lstat())
 finally:os.close(fd)
 return h.hexdigest(),s,b''.join(chunks) if retain else None
def reference(ref):
 h,s,b=read(ref['path'],True);assert h==ref['sha256'] and s.st_size==ref['bytes'] and identity(s)==ref['identity']
 if 'decodedSHA256' in ref:
  body=gzip.decompress(b);assert len(body)==ref['decodedBytes'] and H(body)==ref['decodedSHA256']
checks=[]
for scope,root,name,pin in [('QA',C,'selfseal.json','52cfb99229356db5c0b15d12755b48b906611c786570b6a0bac3e5522f3b2e07'),('work',W,'selfseal.json','e036c65d3137ee6f4c358f4904b0992928a3ca0a284b02a932f93a588bece9cb'),('own',T,'selfseal.json','ddaf7f384beff7a2cca16923b9066fbab5e632019ff9a56cfa59903c0c19168b')]:
 seal=root/name;actual,s,encoded=read(seal,True);assert actual==pin;decoded=gzip.decompress(encoded) if name.endswith('.gz') else encoded;packet=json.loads(decoded);assert packet['root']==str(root) and packet['excludedSelfOnly']==[name]
 expected={};regularBytes=0;links=0
 for row in packet['rows']:
  rel=Path(row['path']);assert not rel.is_absolute() and '..' not in rel.parts and row['path'] not in expected;expected[row['path']]=row;p=root/rel;s=p.lstat();assert identity(s)==row['identity'],(scope,row['path'],'identity')
  if row['kind']=='file':
   actual,s,_=read(p);assert s.st_size==row['bytes'] and actual==row['sha256'];regularBytes+=s.st_size
  elif row['kind']=='directory':assert stat.S_ISDIR(s.st_mode) and sorted(os.listdir(p))==row['members']
  elif row['kind']=='symlink':assert stat.S_ISLNK(s.st_mode) and os.readlink(p)==row['target'];links+=1
  else:raise AssertionError(row['kind'])
 actualMembers={'.'}
 for parent,dirs,files in os.walk(root,followlinks=False):
  for n in dirs+files:
   p=Path(parent)/n
   if p!=seal:actualMembers.add(str(p.relative_to(root)))
  dirs[:]=[n for n in dirs if not (Path(parent)/n).is_symlink()]
 assert actualMembers==set(expected)
 for ref in packet['references']:reference(ref)
 checks.append({'scope':scope,'root':str(root),'sealSHA256':pin,'decodedSealSHA256':H(decoded),'rows':len(expected),'regularBytesVerified':regularBytes,'literalLinksNeverFollowed':links,'fullRecordedIdentityAndMembershipVerified':True})

import io,tarfile
packet=json.loads((C/'pack-receipt.json').read_text());indexRaw=(T/'index.json').read_bytes();indexEncoded=(T/'index.transport.json.gz').read_bytes();assert gzip.decompress(indexEncoded)==indexRaw
assert H(indexRaw)==packet['index']['decodedSHA256'] and H(indexEncoded)==packet['index']['transportSHA256'];assert len(indexRaw)==packet['index']['decodedBytes'] and len(indexEncoded)==packet['index']['transportBytes'];index=json.loads(indexRaw)
catalogRaw=(T/'union-catalog.json').read_bytes();catalogEncoded=(T/'union-catalog.transport.json.gz').read_bytes();assert gzip.decompress(catalogEncoded)==catalogRaw
assert H(catalogRaw)==packet['unionCatalog']['decodedSHA256'] and H(catalogEncoded)==packet['unionCatalog']['transportSHA256'];union=json.loads(catalogRaw)
oldPath=Path('/tmp/cortex-root-storage-rescue/c5-prior-content-catalog/catalog.json');oldRaw=oldPath.read_bytes();assert H(oldRaw)=='0d5f75f77bea82d00b860491ba040b5af9c06b871304e7a798cc588d59715d38';old=json.loads(oldRaw);previous=old['objects']
c5Path=Path('/dev/shm/cortex-root-storage-rescue-c5/c5-delta-byte-backing/index.json');c5Raw=c5Path.read_bytes();assert H(c5Raw)=='7965c514d83b60e5beb58e6119b63f350798f92476bb4d026afcd69644df2f59';c5=json.loads(c5Raw)
expected=set(previous)|{r['sha256'] for r in c5['objects']};assert len(expected)==29591 and set(union['objects'])==expected
for h,r in previous.items():assert union['objects'][h]==r
new={r['sha256']:r for r in c5['objects'] if r['sha256'] not in previous};assert len(new)==3652 and all(r['backing']=='delta' for r in new.values())
for h,r in new.items():assert union['objects'][h]['bytes']==r['bytes'] and union['objects'][h]['backing']=='task04-c5-delta-byte-backing'
objects={r['sha256']:r for r in index['objects']};assert len(objects)==7063
delta={h:r for h,r in objects.items() if r['backing']=='delta'};assert len(delta)==289
for h,r in objects.items():
 if h not in delta:assert h in union['objects'] and union['objects'][h]['bytes']==r['bytes'] and union['objects'][h]['backing']==r['backing']
parts=index['archive']['parts'];archiveH=hashlib.sha256();archiveBytes=0;partIdentities={}
for r in parts:
 p=T/r['name'];h,st,b=read(p,True);assert h==r['sha256'] and st.st_size==r['bytes'];partIdentities[r['name']]=identity(st);archiveH.update(b);archiveBytes+=len(b)
assert len(parts)==11 and archiveBytes==54331839==index['archive']['bytes'] and archiveH.hexdigest()=='4c534f6e44ed66e9b9a54dd330a7306409ea7a184d2b40fb91bdf86b49010a55'==index['archive']['sha256']
class Joined(io.RawIOBase):
 def __init__(self):self.i=0;self.fd=None;self.h=hashlib.sha256();self.n=0;self.ph=None;self.pn=0
 def readable(self):return True
 def read(self,n=-1):
  if n<0:n=archiveBytes-self.n
  out=[]
  while n and self.i<len(parts):
   r=parts[self.i];p=T/r['name']
   if self.fd is None:
    self.fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW);assert identity(os.fstat(self.fd))==partIdentities[r['name']];self.ph=hashlib.sha256();self.pn=0
   b=os.read(self.fd,n)
   if not b:
    assert self.ph.hexdigest()==r['sha256'] and self.pn==r['bytes'];assert identity(os.fstat(self.fd))==identity(p.lstat())==partIdentities[r['name']];os.close(self.fd);self.fd=None;self.i+=1;continue
   self.h.update(b);self.ph.update(b);self.n+=len(b);self.pn+=len(b);out.append(b);n-=len(b)
  return b''.join(out)
joined=Joined();seen=set();rawBytes=0
with gzip.GzipFile(fileobj=joined,mode='rb') as gz:
 with tarfile.open(fileobj=gz,mode='r|') as tar:
  for m in tar:
   assert m.isfile() and m.name.startswith('objects/');h=m.name[8:];assert h in delta and h not in seen and m.size==delta[h]['bytes'];fh=hashlib.sha256();n=0
   with tar.extractfile(m) as f:
    for b in iter(lambda:f.read(1048576),b''):fh.update(b);n+=len(b)
   assert n==m.size and fh.hexdigest()==h;seen.add(h);rawBytes+=n
 for b in iter(lambda:gz.read(1048576),b''):assert not any(b),'Nonzero tar trailing data'
assert joined.read(1)==b'' and joined.n==archiveBytes and joined.h.hexdigest()==archiveH.hexdigest();assert seen==set(delta) and rawBytes==90913685
r={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'ROOT_AUTHENTICATED_CONTENT_ONLY_BACKING_INSPECTION','checks':checks,'indexEncodedSHA256':H(indexEncoded),'indexDecodedSHA256':H(indexRaw),'unionCatalogEncodedSHA256':H(catalogEncoded),'unionCatalogDecodedSHA256':H(catalogRaw),'unionObjects':29591,'priorIDsPreserved':True,'objects':len(objects),'deltaObjects':len(delta),'reusedObjects':len(objects)-len(delta),'deltaRawBytes':rawBytes,'archiveBytes':archiveBytes,'archiveSHA256':archiveH.hexdigest(),'parts':len(parts),'everyDeltaObjectAndGzipEOFIndependentlyVerified':True,'freshReview':'REJECT3.0','original122':'HELD','C6Packet':'PREPARATION_ONLY','physicalRestorationOrRuntimeAcceptance':False,'catalogPublication':'ROOT will publish both exact decoded union-catalog.json and gzip transport to satisfy the recorded logical dependency path.'}
(Q/'task04-c5-fresh-review-content-backing-root-inspection.json').open('x').write(json.dumps(r,indent=2)+'\n');print(json.dumps(r))
