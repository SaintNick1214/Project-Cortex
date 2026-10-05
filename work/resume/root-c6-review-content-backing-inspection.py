from pathlib import Path
import os,stat,json,gzip,hashlib,datetime,io,tarfile
R=Path('/workspace/Project-Cortex');Q=R/'_goals/convex-backend-runtime-2026-10-02/qa';C=Q/'task04-c6-review-content-backing';W=R/'work/resume/task04-c6-review-content-backing';T=Path('/dev/shm/cortex-root-c6-review-content-backing')
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
for scope,root,pin in [('QA',C,'d8b4bae0dd7d2f1b40a9c518eee315ebff255c67b640a4285c1ac0cfd2ff3cb8'),('work',W,'a166b8189d789d04d0a49aec8cb3a06dacef969e253809b4115bf721513e26eb'),('own',T,'7a054e4f23e1bd9e4f406048159806fb693160b19c4821ca36efa15c4376e388')]:
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
assert H(indexRaw)=='6806ab4278ee8f52904caef53c234169c825ae623e77597aec5ebc41e2d159ed'==receipt['index']['decodedSHA256'];assert H(indexEncoded)=='ab24715bd266228f35c260ce44449250006e70e82ec0a60796e3a253c551c8ea' and gzip.decompress(indexEncoded)==indexRaw
index=json.loads(indexRaw);del indexRaw,indexEncoded
unionRaw=held(T/'union-catalog.json',True)[2];unionEncoded=held(T/'union-catalog.transport.json.gz',True)[2]
assert H(unionRaw)=='671b2ecf2c851f92d7433bed556d7dc42a75221e977be6903eb2568733e22405'==receipt['unionCatalog']['decodedSHA256'];assert H(unionEncoded)=='5b6b3c8ecab2a881bd40d96a8f3efaa5f339628eecb09952b71475dd11692c3e' and gzip.decompress(unionEncoded)==unionRaw
union=json.loads(unionRaw)['objects'];del unionRaw,unionEncoded
objects={r['sha256']:r for r in index['objects']};delta={h:r for h,r in objects.items() if r['backing']=='delta'};assert len(objects)==10332 and len(delta)==2666
for h,r in objects.items():
 if h not in delta:assert union[h]['bytes']==r['bytes'] and union[h]['backing']==r['backing']
archive=index['archive'];assert archive==receipt['archive'] and archive['bytes']==81133500 and archive['sha256']=='28864ed3d5439d1dad9af0a566c57e9d4f8aabcba49b484fc4e77ff51284da51' and len(archive['parts'])==16
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
assert seen==set(delta) and joined.n==archive['bytes'] and joined.h.hexdigest()==archive['sha256'] and rawBytes==239138151
assert len(index['historicalUnresolved'])==1 and index['historicalUnresolved'][0]['expectedSHA256']=='fa67443527ed9647f760d807e2a38f26340757123e643c4639cf273ed15d5ea7'
assert len(index['capturedPreimages'])==2585 and len(index['externalReferences'])==13865 and len(index['sourceRows'])==3587 and len(index['sources'])==8
for x in index['sourceRows']:
 p=Path(x['root'])/x['row']['path'];row=x['row'];s=p.lstat();assert identity(s)==row['identity']
 if row['kind']=='file':
  h,s,_=held(p);assert h==row['sha256'] and s.st_size==row['bytes'] and h in objects and objects[h]['bytes']==row['bytes']
 elif row['kind']=='directory':assert stat.S_ISDIR(s.st_mode) and sorted(os.listdir(p))==row['members']
 elif row['kind']=='symlink':assert stat.S_ISLNK(s.st_mode) and os.readlink(p)==row['target']
 else:raise AssertionError(row['kind'])
out={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'ROOT_AUTHENTICATED_C6_REVIEW_SUPPLEMENT_READBACK_NOT_ACCEPTANCE','checks':checks,'objects':len(objects),'deltaObjectsStreamed':len(delta),'deltaRawBytesVerified':rawBytes,'reuseSHA256SizeAndPriorLocatorVerified':len(objects)-len(delta),'archiveParts':16,'archiveBytes':archive['bytes'],'archiveSHA256':archive['sha256'],'gzipEOFCRCAndExactTarMembershipVerified':True,'sourceRowsCurrentFullBytesIdentityMembershipVerified':3587,'literalBackingDeclarations':13865,'historicalProvenanceGapRows':1,'historicalProvenanceGapUniqueHashes':1,'capturedPreimageResolutions':2585,'actualApproval':'ABSENT','original122SourceParentNativePrivatePaid':'HELD','fullCriterion':'UNRESOLVED120_AND_EXACT_RUNTIME_IDENTITY','limits':'Content backing only. Current literal exact identities do not restore older precision-limited Node identity records, historical missing custody or unresolved provenance. Reused locators checked against authenticated prior union; prior archives independently streamed by prior ROOT inspection and worker additional fresh verification; no physical restoration, runtime acceptance or aggregate clean-checkout claim.'}
with (Q/'task04-c6-review-content-backing-root-inspection.json').open('x') as f:json.dump(out,f,indent=2);f.write('\n')
print(json.dumps(out))
