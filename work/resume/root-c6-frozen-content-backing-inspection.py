from pathlib import Path
import os,stat,json,gzip,hashlib,datetime,io,tarfile
R=Path('/workspace/Project-Cortex');Q=R/'_goals/convex-backend-runtime-2026-10-02/qa';C=Q/'task04-c6-frozen-content-backing';W=R/'work/resume/task04-c6-frozen-content-backing';T=Path('/dev/shm/cortex-root-c6-frozen-content-backing')
H=lambda b:hashlib.sha256(b).hexdigest()
K=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def identity(s):return {k:getattr(s,'st_'+k) for k in K}
def held(p,retain=False):
 p=Path(p);a=p.lstat();assert stat.S_ISREG(a.st_mode) and a.st_nlink==1
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW);h=hashlib.sha256();chunks=[]
 try:
  assert identity(a)==identity(os.fstat(fd))
  while True:
   b=os.read(fd,1048576)
   if not b:break
   h.update(b)
   if retain:chunks.append(b)
  assert identity(a)==identity(os.fstat(fd))==identity(p.lstat())
 finally:os.close(fd)
 return h.hexdigest(),a,b''.join(chunks) if retain else None
checks=[]
for scope,root,pin in [('QA',C,'91f914037261c04dd2afd40eedd67b105f5e29369caf2038bd143097bdd1bd9b'),('work',W,'e4b2e205afbcab32dea7a5e27e2b571a9d1f2fef1b4ccd134b1ed3787cf98439'),('own',T,'f0d242206e83f256df942149bd9539b64687e507522527da2503bc2c7fb16f4a')]:
 h,_,b=held(root/'selfseal.json',True);assert h==pin;d=json.loads(b);assert d['root']==str(root) and d['excludedSelfOnly']==['selfseal.json']
 rows={};size=0;links=0
 for row in d['rows']:
  rel=Path(row['path']);assert not rel.is_absolute() and '..' not in rel.parts and row['path'] not in rows;rows[row['path']]=row;p=root/rel;s=p.lstat();assert identity(s)==row['identity']
  if row['kind']=='file':
   h,s,_=held(p);assert h==row['sha256'] and s.st_size==row['bytes'];size+=s.st_size
  elif row['kind']=='directory':assert stat.S_ISDIR(s.st_mode) and sorted(os.listdir(p))==row['members']
  elif row['kind']=='symlink':assert stat.S_ISLNK(s.st_mode) and os.readlink(p)==row['target'];links+=1
  else:raise AssertionError(row['kind'])
 actual={'.'}
 for parent,dirs,files in os.walk(root,followlinks=False):
  for name in dirs+files:
   p=Path(parent)/name
   if p!=root/'selfseal.json':actual.add(str(p.relative_to(root)))
  dirs[:]=[name for name in dirs if not (Path(parent)/name).is_symlink()]
 assert actual==set(rows)
 for ref in d['references']:
  h,s,b=held(ref['path'],True);assert h==ref['sha256'] and s.st_size==ref['bytes'] and identity(s)==ref['identity']
  if 'decodedSHA256' in ref:
   body=gzip.decompress(b);assert len(body)==ref['decodedBytes'] and H(body)==ref['decodedSHA256']
 checks.append({'scope':scope,'rows':len(rows),'regularBytesVerified':size,'literalLinksNeverFollowed':links,'sealSHA256':pin})
receipt=json.loads(held(C/'pack-receipt.json',True)[2]);indexRaw=held(T/'index.json',True)[2];indexEncoded=held(T/'index.transport.json.gz',True)[2]
assert H(indexRaw)=='3cc2357a9eb2adff1aaa1c9bf2db167fc532a9e028b80b89f26f77cc5c9c2d32'==receipt['index']['decodedSHA256'];assert H(indexEncoded)=='144b84f4951865450b4a76a80fb2d76801c40eabfec6e4173898fc0b957a1e07' and gzip.decompress(indexEncoded)==indexRaw
index=json.loads(indexRaw);del indexRaw,indexEncoded
unionRaw=held(T/'union-catalog.json',True)[2];unionEncoded=held(T/'union-catalog.transport.json.gz',True)[2]
assert H(unionRaw)=='1cee18abd6591e12c4e32ab598e34e7880e129300876994226986c06b1b647da'==receipt['unionCatalog']['decodedSHA256'];assert H(unionEncoded)=='4f73375a30c58e3c1883c249dcfbd53a9e7c838e8585950d1ff3bde3f5f91a5f' and gzip.decompress(unionEncoded)==unionRaw
union=json.loads(unionRaw)['objects'];del unionRaw,unionEncoded
objects={r['sha256']:r for r in index['objects']};delta={h:r for h,r in objects.items() if r['backing']=='delta'};assert len(objects)==14522 and len(delta)==1463
for h,r in objects.items():
 if h not in delta:assert union[h]['bytes']==r['bytes'] and union[h]['backing']==r['backing']
archive=index['archive'];assert archive==receipt['archive'] and archive['bytes']==583028605 and archive['sha256']=='6f9d87d719f97f7f7485bcf70a41c4b561b93ddec10e2f4c684b17b488caf9b9' and len(archive['parts'])==112
partIDs={};whole=hashlib.sha256();total=0
for row in archive['parts']:
 assert 0<row['bytes']<5*1024*1024
 h,s,b=held(T/row['name'],True);assert h==row['sha256'] and s.st_size==row['bytes'];partIDs[row['name']]=identity(s);whole.update(b);total+=len(b)
assert total==archive['bytes'] and whole.hexdigest()==archive['sha256']
class Joined(io.RawIOBase):
 def __init__(self):self.i=0;self.fd=None;self.h=hashlib.sha256();self.n=0;self.ph=None;self.pn=0
 def readable(self):return True
 def readinto(self,buf):
  while self.i<len(archive['parts']):
   row=archive['parts'][self.i];p=T/row['name']
   if self.fd is None:
    self.fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW);assert identity(os.fstat(self.fd))==partIDs[row['name']];self.ph=hashlib.sha256();self.pn=0
   b=os.read(self.fd,len(buf))
   if b:
    buf[:len(b)]=b;self.h.update(b);self.ph.update(b);self.n+=len(b);self.pn+=len(b);return len(b)
   assert self.pn==row['bytes'] and self.ph.hexdigest()==row['sha256'];assert identity(os.fstat(self.fd))==partIDs[row['name']]==identity(os.lstat(p));os.close(self.fd);self.fd=None;self.i+=1
  return 0
 def close(self):
  if self.fd is not None:os.close(self.fd);self.fd=None
  super().close()
joined=Joined();seen=set();rawBytes=0
with io.BufferedReader(joined,1048576) as encoded:
 with gzip.GzipFile(fileobj=encoded,mode='rb') as decoded:
  with tarfile.open(fileobj=decoded,mode='r|') as tar:
   for member in tar:
    assert member.isfile() and member.name.startswith('objects/');h=member.name.removeprefix('objects/');assert h in delta and h not in seen and member.size==delta[h]['bytes'];seen.add(h)
    f=tar.extractfile(member);digest=hashlib.sha256();n=0
    while True:
     b=f.read(1048576)
     if not b:break
     digest.update(b);n+=len(b)
    assert n==delta[h]['bytes'] and digest.hexdigest()==h;rawBytes+=n
  while decoded.read(1048576):pass
 while encoded.read(1048576):pass
assert seen==set(delta) and joined.n==archive['bytes'] and joined.h.hexdigest()==archive['sha256'] and rawBytes==1176721954
assert len(index['historicalUnresolvedSourceProvenance'])==68 and len({r['expectedSHA256'] for r in index['historicalUnresolvedSourceProvenance']})==67
assert len(index['capturedPreimageResolutions'])==32 and len(index['externalReferences'])==5203 and len(index['sourceRows'])==19493
for x in index['sourceRows']:
 p=Path(x['root'])/x['row']['path'];row=x['row'];s=p.lstat();assert identity(s)==row['identity']
 if row['kind']=='file':
  h,s,_=held(p);assert h==row['sha256'] and s.st_size==row['bytes'] and h in objects and objects[h]['bytes']==row['bytes']
 elif row['kind']=='directory':assert stat.S_ISDIR(s.st_mode) and sorted(os.listdir(p))==row['members']
 elif row['kind']=='symlink':assert stat.S_ISLNK(s.st_mode) and os.readlink(p)==row['target']
 else:raise AssertionError(row['kind'])
out={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'ROOT_AUTHENTICATED_C6_CONTENT_BACKING_READBACK_NOT_ACCEPTANCE','checks':checks,'objects':len(objects),'deltaObjectsStreamed':len(delta),'deltaRawBytesVerified':rawBytes,'reuseSHA256SizeAndPriorLocatorVerified':len(objects)-len(delta),'archiveParts':112,'archiveBytes':archive['bytes'],'archiveSHA256':archive['sha256'],'gzipEOFCRCAndExactTarMembershipVerified':True,'sourceRowsCurrentFullBytesIdentityMembershipVerified':19493,'literalBackingDeclarations':5203,'historicalProvenanceGapRows':68,'historicalProvenanceGapUniqueHashes':67,'capturedPreimageResolutions':32,'actualApproval':'ABSENT','original122SourceParentNativePrivatePaid':'HELD','fullCriterion':'UNRESOLVED120_AND_EXACT_RUNTIME_IDENTITY','limits':'Content backing only. Current literal exact identities do not restore older precision-limited Node identity records, historical missing custody or unresolved provenance. Reused locators checked against authenticated prior union; prior archives independently streamed by prior ROOT inspection and worker additional fresh verification; no physical restoration, runtime acceptance or aggregate clean-checkout claim.'}
with (Q/'task04-c6-frozen-content-backing-root-inspection.json').open('x') as f:json.dump(out,f,indent=2);f.write('\n')
print(json.dumps(out))
