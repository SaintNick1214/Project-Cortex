from pathlib import Path
import os,stat,json,hashlib,gzip,tarfile,io,datetime,traceback
R=Path('/workspace/Project-Cortex'); BASE=R/'_goals/convex-backend-runtime-2026-10-02/qa';Q=BASE/'task04-c5-fresh-review-content-backing';W=R/'work/resume/task04-c5-fresh-review-content-backing';O=Path('/dev/shm/cortex-root-c5-fresh-review-content-backing')
H=lambda b:hashlib.sha256(b).hexdigest()
def ident(s):return {k:getattr(s,'st_'+k) for k in ['dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns']}
def checkid(s,d):
 for k,v in d.items():assert getattr(s,k if k.startswith('st_') else 'st_'+k)==v,(k,v)
def held(p):
 p=Path(p);s=p.lstat();assert stat.S_ISREG(s.st_mode) and s.st_nlink==1
 f=os.fdopen(os.open(p,os.O_RDONLY|os.O_NOFOLLOW),'rb');assert ident(s)==ident(os.fstat(f.fileno()));return f,s
def read(p,retain=False):
 f,s=held(p);h=hashlib.sha256();b=[]
 with f:
  for x in iter(lambda:f.read(1048576),b''):h.update(x);b.append(x) if retain else None
  assert ident(s)==ident(os.fstat(f.fileno()))==ident(Path(p).lstat())
 return h.hexdigest(),s,b''.join(b) if retain else None
def pin(p,h):
 actual,s,b=read(p,True);assert actual==h,(str(p),actual,h);return b
class Parts(io.RawIOBase):
 def __init__(self,rows):self.rows=rows;self.i=0;self.f=None;self.h=hashlib.sha256();self.n=0
 def readable(self):return True
 def read(self,n=-1):
  if n<0:n=sum(r['bytes'] for r in self.rows)-self.n
  out=[]
  while n and self.i<len(self.rows):
   r=self.rows[self.i];p=Path(r['sourcePath'])
   if self.f is None:
    actual,s,_=read(p);assert actual==r['sha256'] and s.st_size==r['bytes'];self.f,self.s=held(p)
   b=self.f.read(n)
   if not b:
    assert ident(self.s)==ident(os.fstat(self.f.fileno()))==ident(p.lstat());self.f.close();self.f=None;self.i+=1;continue
   out.append(b);self.h.update(b);self.n+=len(b);n-=len(b)
  return b''.join(out)
 def finish(self):
  while self.read(1048576):pass
  return self.h.hexdigest(),self.n
 def close(self):
  if self.f:self.f.close()
  super().close()
def verifytar(rows,objects,expected):
 parts=Parts(rows);seen=set();decoded=0
 # Gzip reader is drained to EOF independently of tar's zero-block stopping rule.
 with gzip.GzipFile(fileobj=parts,mode='rb') as z:
  with tarfile.open(fileobj=z,mode='r|') as t:
   for m in t:
    assert m.isfile() and m.name.startswith('objects/');h=m.name[8:];assert h in objects and h not in seen and m.size==objects[h]
    a=hashlib.sha256();n=0
    with t.extractfile(m) as f:
     for b in iter(lambda:f.read(1048576),b''):a.update(b);n+=len(b)
    assert n==m.size and a.hexdigest()==h;seen.add(h);decoded+=n
  while True:
   b=z.read(1048576)
   if not b:break
   assert not any(b),'nonzero trailing tar data'
 assert seen==set(objects);assert parts.finish()==expected;parts.close()
 return {'objects':len(seen),'rawBytes':decoded,'gzipEOFVerified':True,'exactMembersSHAAndSizeVerified':True}
def main():
 catalogPath=Path('/tmp/cortex-root-storage-rescue/c5-prior-content-catalog/catalog.json');catalogRaw=pin(catalogPath,'0d5f75f77bea82d00b860491ba040b5af9c06b871304e7a798cc588d59715d38');cat=json.loads(catalogRaw);assert len(cat['objects'])==25939
 for backing in cat['backings']:
  pin(backing['indexPath'],backing['indexSHA256']);p=Parts(backing['parts']);assert p.finish()==(backing['archiveSHA256'],backing['archiveBytes']);p.close()
 print('Authenticated four prior backing indexes, ordered parts and whole archives',flush=True)
 oldReceipt=BASE/'task04-c5-prior-content-catalog-root-verification.json';oldh,olds,oldb=read(oldReceipt,True);old=json.loads(oldb);assert old['catalogSHA256']==H(catalogRaw) and old['everyArchiveMemberHashVerified'] and old['uniqueObjects']==25939
 c5root=Path('/dev/shm/cortex-root-storage-rescue-c5/c5-delta-byte-backing');c5raw=pin(c5root/'index.json','7965c514d83b60e5beb58e6119b63f350798f92476bb4d026afcd69644df2f59');c5=json.loads(c5raw)
 transport=c5root/'index.transport.json.gz';traw=pin(transport,'3ca2de0a690231e3ac39a095c02304318b6f618edcf548355563c4cfaa4406c3');assert gzip.decompress(traw)==c5raw
 c5parts=[{**r,'sourcePath':str(c5root/r['name']),'repositoryPath':str((BASE/'task04-c5-delta-byte-backing'/r['name']).relative_to(R))} for r in c5['archive']['parts']];assert len(c5parts)==139
 c5delta={r['sha256']:r['bytes'] for r in c5['objects'] if r['backing']=='delta'};assert len(c5delta)==3652
 c5verify=verifytar(c5parts,c5delta,('beadb619e93885dce23dcb45c465de6b2fe144c51def10d4720e90431eba6280',727823685))
 prior=dict(cat['objects'])
 for h,n in c5delta.items():assert h not in prior;prior[h]={'bytes':n,'backing':'task04-c5-delta-byte-backing'}
 assert len(prior)==29591
 for r in c5['objects']:assert prior[r['sha256']]['bytes']==r['bytes']
 print('Fully streamed and object-verified C5 dependency; authenticated union 29591 objects',flush=True)
 subjects=[]
 for name,pins,own in [('task04-native-c5-composition-c5-fresh-review',['833c7a60e9ad6f7c5514e7601dd6767e932a9a30019ff5f1f5412e6e7b25d10d','95783e253c52bfe4b3c84e9d93726b5872559f847e7a45c0d48e0980fff88ad0','f22c7d8037574897f45ffc60c709477506def7b9afda9e9206dd42c94b0a090d'],Path('/tmp/cortex-native-c5-independent-review-c5-fresh-7bc323d1-56c7-43bc-bac6-60026125b030')),('task04-native-c5-generated-producer-source-audit',['d2127fbe04e63073b0fb60e584fc687cd3ca6b20e06c1fb1e9e16d8f8fd1c764','a8dc6e773242fc5f92ac9a49ee414ae5e1ee8e9982eba9b063fb02fda75ce79a','284cba070758e9b8340fc6e2a4c5d766353b847d9c9e565fac8dca39c4bc2fc4'],Path('/dev/shm/cortex-native-c5-generated-producer-source-audit')),('task04-native-c6-repair-preparation',['bf8652e16284a3bbc4f085ddca8bd4d7269b44090101d75e800292b3b0d759ab','e1af049ce57ba1fb17a327427bcc8c7159cadff91ea17b8e3aafbd71a7e63e31'],None)]:
  for root,p in zip([BASE/name,R/'work/resume'/name]+([own] if own else []),pins):subjects.append({'root':str(root),'sealPath':str(root/('selfseal.json.gz' if root==own and 'fresh-review' in name else 'selfseal.json')),'sealSHA256':p,'subject':name})
 refs=[];objects={};checks=[];external=[]
 def register(p,h,n):
  if h in objects:assert objects[h]['bytes']==n
  else:objects[h]={'path':str(p),'bytes':n}
 def reference(r,context):
  p=Path(r['path']);a,s,b=read(p,'decodedSHA256' in r);assert a==r['sha256'] and s.st_size==r['bytes'];checkid(s,r.get('identity',{}))
  if 'decodedSHA256' in r:
   d=gzip.decompress(b);assert H(d)==r['decodedSHA256'] and len(d)==r['decodedBytes']
  external.append({'context':context,'originalReference':r});register(p,a,s.st_size)
 for subject in subjects:
  root=Path(subject['root']);seal=Path(subject['sealPath']);raw=pin(seal,subject['sealSHA256']);dec=gzip.decompress(raw) if seal.suffix=='.gz' else raw;packet=json.loads(dec);assert packet['root']==str(root)
  if seal.suffix=='.gz':assert H(dec)=='13288525cc8f7d495308b66d7072f57b8a23af3fe8d71acc8332de5d8f8bfde6'
  aid='members' in packet;rows=packet['members'] if aid else packet['rows'];excluded=packet['excludedExactly'] if aid else packet['excludedSelfOnly'];assert excluded==[seal.name]
  expected=set();rawbytes=0;links=0
  for row in rows:
   rel=Path(row['path']);assert not rel.is_absolute() and '..' not in rel.parts and row['path'] not in expected;expected.add(row['path']);p=root/rel;s=p.lstat();checkid(s,row['identity']);kind=row['kind']
   if kind in ('regular','file'):
    a,s,_=read(p);assert a==row['sha256'] and s.st_size==row['bytes'];register(p,a,s.st_size);rawbytes+=s.st_size
   elif kind=='directory':assert stat.S_ISDIR(s.st_mode) and sorted(os.listdir(p))==row['members']
   elif kind=='symlink':assert stat.S_ISLNK(s.st_mode) and os.readlink(p)==row['target'];links+=1
   else:raise AssertionError(kind)
   refs.append({'subject':subject['subject'],'root':str(root),'provenancePath':str(p),'originalRow':row})
  actual=set() if aid else {'.'}
  for parent,dirs,files in os.walk(root,followlinks=False):
   for n in dirs+files:
    p=Path(parent)/n
    if p!=seal:actual.add(str(p.relative_to(root)))
   dirs[:]=[n for n in dirs if not (Path(parent)/n).is_symlink()]
  assert actual==expected
  a,s,_=read(seal);register(seal,a,s.st_size);refs.append({'subject':subject['subject'],'root':str(root),'sealFile':True,'provenancePath':str(seal),'bytes':s.st_size,'sha256':a,'identity':ident(s)})
  for r in packet.get('references',[]):reference(r,str(seal))
  checks.append({**subject,'decodedSealSHA256':H(dec),'schema':'original-members-regular-st_identity' if aid else 'original-rows-file-identity','rows':len(rows),'regularBytesVerified':rawbytes,'literalSymlinksNeverFollowed':links,'membershipAndAllRecordedIdentitiesVerified':True})
  print('Verified frozen subject '+str(root)+' rows='+str(len(rows)),flush=True)
 fresh=BASE/'task04-native-c5-composition-c5-fresh-review';e=json.loads((fresh/'evidence-index.json').read_bytes());assert e['verdict']=='REJECT' and e['average']==3.0;assert read(fresh/'report.md')[0]=='0b72b77540fd242bfe914db404a8d6ff57b1b84e9c67490c050dbf9b314852b4'
 for r in e['references']:reference(r,'fresh-evidence-index')
 # Additional recorded current source pins: historical C6 snapshots remain bytes only.
 for r in json.loads((BASE/'task04-native-c5-generated-producer-source-audit/context-pins.json').read_bytes()):
  reference({'path':str(R/r['source']),'sha256':r['sha256'],'bytes':r['bytes'],'identity':r['identity']},'source-aid-context-origin');assert read(r['backing'])[0]==r['sha256']
 for source,r in json.loads((BASE/'task04-native-c5-generated-producer-source-audit/frozen-adapter-source-evidence.json').read_bytes()).items():
  reference({'path':str(R/source),'sha256':r['sha256'],'bytes':r['bytes'],'identity':r['identity']},'source-aid-adapter-origin');assert read(r['backing'])[0]==r['sha256']
 prepPins=json.loads((BASE/'task04-native-c6-repair-preparation/sourcepins.json').read_bytes())
 for r in prepPins['freshHeldRows']:reference(r,'C6-preparation-current-held-source-only')
 reused={h:v for h,v in objects.items() if h in prior};delta={h:v for h,v in objects.items() if h not in prior}
 for h,v in reused.items():assert v['bytes']==prior[h]['bytes']
 union={'format':'AUTHENTICATED_OLD_PLUS_C5_DELTA_CONTENT_CATALOG_V1','priorCatalogSHA256':H(catalogRaw),'C5indexSHA256':H(c5raw),'objects':prior};unionraw=(json.dumps(union,separators=(',',':'))+'\n').encode();(O/'union-catalog.json').write_bytes(unionraw)
 class Sink:
  def __init__(self):self.f=None;self.parts=[];self.h=hashlib.sha256();self.n=0
  def write(self,data):
   at=0
   while at<len(data):
    if self.f is None:self.f=(O/f'objects.part-{len(self.parts):04d}').open('xb');self.ph=hashlib.sha256();self.pn=0
    n=min(len(data)-at,5*1024*1024-self.pn);b=data[at:at+n];assert self.f.write(b)==n;self.h.update(b);self.ph.update(b);self.pn+=n;self.n+=n;at+=n
    if self.pn==5*1024*1024:self.end()
   return len(data)
  def flush(self):
   if self.f:self.f.flush()
  def end(self):
   if self.f:
    self.f.flush();os.fsync(self.f.fileno());name=Path(self.f.name).name;self.f.close();self.parts.append({'name':name,'bytes':self.pn,'sha256':self.ph.hexdigest(),'repositoryPath':str((Q/name).relative_to(R))});self.f=None
 sink=Sink()
 with gzip.GzipFile(fileobj=sink,filename='',mode='wb',mtime=0,compresslevel=3) as z:
  with tarfile.open(fileobj=z,mode='w|',format=tarfile.USTAR_FORMAT) as tar:
   for h,v in sorted(delta.items()):
    f,s=held(v['path'])
    with f:
     m=tarfile.TarInfo('objects/'+h);m.size=v['bytes'];m.mode=0o600;m.uid=m.gid=m.mtime=0;tar.addfile(m,f);assert ident(s)==ident(os.fstat(f.fileno()))==ident(Path(v['path']).lstat())
 sink.end();newverify=verifytar([{**r,'sourcePath':str(O/r['name'])} for r in sink.parts],{h:v['bytes'] for h,v in delta.items()},(sink.h.hexdigest(),sink.n))
 for s in subjects:pin(s['sealPath'],s['sealSHA256'])
 dependencies={'oldCatalog':{'sourcePath':str(catalogPath),'sha256':H(catalogRaw),'bytes':len(catalogRaw),'backings':cat['backings'],'decodedVerificationReceipt':{'path':str(oldReceipt),'sha256':oldh,'bytes':olds.st_size,'verification':old}},'C5':{'publishedCheckpoint':'42b04c50307cc4d84095487cdb3168af5b098e4b316','decodedIndexSHA256':H(c5raw),'decodedIndexBytes':len(c5raw),'transportRepositoryPath':str((BASE/'task04-c5-delta-byte-backing/index.json.gz').relative_to(R)),'transportSHA256':H(traw),'transportBytes':len(traw),'archive':{**c5['archive'],'parts':c5parts},'decodedObjectVerification':c5verify},'unionCatalog':{'repositoryPath':str((Q/'union-catalog.json').relative_to(R)),'bytes':len(unionraw),'sha256':H(unionraw),'objects':len(prior)}}
 index={'format':'C5_FRESH_REJECT_SOURCE_AID_C6_PREPARATION_CONTENT_ONLY_DELTA_V1','scope':'AUTHENTIC_CONTENT_ONLY_NO_PHYSICAL_RESTORATION_OLD_INODE_CUSTODY_OR_RUNTIME_ACCEPTANCE','freshReview':{'verdict':'REJECT','average':3.0,'reportSHA256':'0b72b77540fd242bfe914db404a8d6ff57b1b84e9c67490c050dbf9b314852b4'},'C6':'PREPARATION_ONLY_INITIAL_SEALS_HISTORICAL_NOT_CURRENT','original122':'HELD','sourceSeals':checks,'references':refs,'independentlyVerifiedReferences':external,'objects':[{'sha256':h,'bytes':v['bytes'],'backing':prior[h]['backing'] if h in prior else 'delta'} for h,v in sorted(objects.items())],'dependencies':dependencies,'archive':{'bytes':sink.n,'sha256':sink.h.hexdigest(),'parts':sink.parts},'decodedObjectVerification':newverify}
 raw=(json.dumps(index,separators=(',',':'))+'\n').encode();(O/'index.json').write_bytes(raw);encoded=gzip.compress(raw,compresslevel=6,mtime=0);assert gzip.decompress(encoded)==raw and len(encoded)*4//3<10*1024*1024;(O/'index.transport.json.gz').write_bytes(encoded)
 unionenc=gzip.compress(unionraw,mtime=0);(O/'union-catalog.transport.json.gz').write_bytes(unionenc);assert gzip.decompress(unionenc)==unionraw
 mapping={str((Q/r['name']).relative_to(R)):str(O/r['name']) for r in sink.parts};mapping[str((Q/'index.json.gz').relative_to(R))]=str(O/'index.transport.json.gz');mapping[str((Q/'union-catalog.json.gz').relative_to(R))]=str(O/'union-catalog.transport.json.gz');(W/'virtual-source-mapping.json').write_text(json.dumps(mapping,indent=2)+'\n')
 receipt={'status':'VERIFIED_CONTENT_ONLY_READY_FOR_ROOT_PUBLICATION','utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':index['scope'],'references':len(refs),'independentlyVerifiedReferences':len(external),'objects':len(objects),'deltaObjects':len(delta),'reusedObjects':len(reused),'deltaRawBytes':sum(v['bytes'] for v in delta.values()),'archive':index['archive'],'index':{'decodedBytes':len(raw),'decodedSHA256':H(raw),'transportBytes':len(encoded),'transportSHA256':H(encoded),'repositoryPath':str((Q/'index.json.gz').relative_to(R))},'unionCatalog':{'decodedBytes':len(unionraw),'decodedSHA256':H(unionraw),'transportBytes':len(unionenc),'transportSHA256':H(unionenc),'repositoryPath':str((Q/'union-catalog.json.gz').relative_to(R))},'sourceChecks':checks,'dependencies':dependencies,'verification':newverify,'freshReview':index['freshReview'],'C6':index['C6'],'rootPublicationAuthoritative':True}
 (Q/'pack-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps({k:receipt[k] for k in ['status','references','objects','deltaObjects','reusedObjects','deltaRawBytes','index','unionCatalog']}),flush=True)
if __name__=='__main__':
 try:main()
 except BaseException:
  (Q/'failure-01.txt').write_text(traceback.format_exc());raise
