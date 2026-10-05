from pack import *
class Parts(io.RawIOBase):
 def __init__(self,rows):self.rows=rows;self.i=0;self.f=None;self.h=hashlib.sha256();self.n=0
 def readable(self):return True
 def read(self,n=-1):
  assert n>=0;out=[]
  while n and self.i<len(self.rows):
   r=self.rows[self.i];p=T/r['name']
   if self.f is None:self.f,self.s=held(p);self.ph=hashlib.sha256();self.pn=0
   b=self.f.read(n)
   if not b:
    assert self.ph.hexdigest()==r['sha256'] and self.pn==r['bytes'];assert ident(self.s)==ident(os.fstat(self.f.fileno()))==ident(p.lstat());self.f.close();self.f=None;self.i+=1;continue
   self.ph.update(b);self.pn+=len(b);self.h.update(b);self.n+=len(b);n-=len(b);out.append(b)
  return b''.join(out)
def verifytar(archive,objects):
 joined=Parts(archive['parts']);seen=set();n=0
 with gzip.GzipFile(fileobj=joined,mode='rb') as z:
  with tarfile.open(fileobj=z,mode='r|') as t:
   for m in t:
    assert m.isfile() and m.name.startswith('objects/');h=m.name[8:];assert h in objects and h not in seen and m.size==objects[h]['bytes'];a=hashlib.sha256();size=0
    with t.extractfile(m) as f:
     for b in iter(lambda:f.read(1048576),b''):a.update(b);size+=len(b)
    assert a.hexdigest()==h and size==m.size;seen.add(h);n+=size
  for b in iter(lambda:z.read(1048576),b''):assert not any(b),'nonzero tar trailing bytes'
 assert joined.read(1)==b'' and joined.h.hexdigest()==archive['sha256'] and joined.n==archive['bytes'];assert seen==set(objects)
 return {'objects':len(seen),'rawBytes':n,'fullGzipEOFAndCRC':True,'exactMemberSHA256AndSizes':True,'archiveSHA256AndPartHashes':True}
def sourcescheck():
 members={str(r):set() for r,_,_ in SOURCES};counts=0
 for line in (T/'source-rows.jsonl').open():
  x=json.loads(line);p=Path(x['root'])/x['row']['path'];checkrow(p,x['row']);members[x['root']].add(x['row']['path']);counts+=1
 for root,name,h in SOURCES:assert {str(p.relative_to(root)) for p in paths(root)}==members[str(root)];assert read(root/name)[0]==h
 for line in (T/'external-references-final.jsonl').open():
  x=json.loads(line)
  if x.get('freshFullStreamVerified'):h,s,_=read(x['literalPath']);assert h==x['expectedSHA256'] and s.st_size==x['bytes'] and ident(s)==x['currentIdentity']
 return {'utc':now(),'allSixSourceRows':counts,'fullHashNineIdentityMembershipAndLiteralLinks':True,'allSourceManifestHashesUnchanged':True}
class Sink:
 def __init__(self):self.f=None;self.parts=[];self.h=hashlib.sha256();self.n=0;self.limit=5*1024*1024-1;self.events=Path('/sys/fs/cgroup/memory.events').read_text()
 def write(self,data):
  at=0
  while at<len(data):
   assert self.n+len(data)-at<=1073741824,'encoded reserve exceeded'
   if self.f is None:
    assert Path('/sys/fs/cgroup/memory.events').read_text().split('oom_kill ')[1].splitlines()[0]==self.events.split('oom_kill ')[1].splitlines()[0],'new OOM kill event'
    self.f=(T/f'objects.part-{len(self.parts):04d}').open('xb');self.ph=hashlib.sha256();self.pn=0
   n=min(len(data)-at,self.limit-self.pn);b=data[at:at+n];assert self.f.write(b)==n;self.h.update(b);self.ph.update(b);self.n+=n;self.pn+=n;at+=n
   if self.pn==self.limit:self.end()
  return len(data)
 def flush(self):
  if self.f:self.f.flush()
 def end(self):
  if self.f:
   self.f.flush();os.fsync(self.f.fileno());name=Path(self.f.name).name;self.f.close();self.parts.append({'name':name,'bytes':self.pn,'sha256':self.ph.hexdigest(),'repositoryPath':str((Q/name).relative_to(R))});self.f=None
   if len(self.parts)%10==0:print('encodedBytes='+str(self.n)+' memory.current='+Path('/sys/fs/cgroup/memory.current').read_text().strip(),flush=True)
class HashRead:
 def __init__(self,f):self.f=f;self.h=hashlib.sha256();self.n=0
 def read(self,n):b=self.f.read(n);self.h.update(b);self.n+=len(b);return b
def transport(p):
 out=T/(p.stem+'.transport.json.gz');f,s=held(p)
 with f,out.open('xb') as o,gzip.GzipFile(fileobj=o,filename='',mode='wb',mtime=0,compresslevel=6) as z:
  for b in iter(lambda:f.read(1048576),b''):z.write(b)
  assert ident(s)==ident(os.fstat(f.fileno()))==ident(p.lstat())
 with p.open('rb') as f,out.open('rb') as e,gzip.GzipFile(fileobj=e,mode='rb') as z:
  while True:
   a=f.read(1048576);b=z.read(1048576);assert a==b
   if not a:break
 a,s,_=read(p);h,st,_=read(out);return {'decodedSHA256':a,'decodedBytes':s.st_size,'transportSHA256':h,'transportBytes':st.st_size,'decodedRepositoryPath':str((Q/p.name).relative_to(R)),'transportRepositoryPath':str((Q/(p.name+'.gz')).relative_to(R)),'losslessFullGzipEOFCRCVerified':True}
def main():
 closure=json.loads((Q/'final-closure-measurement.json').read_bytes());assert closure['allLiteralBackingReferencesResolved'];assert closure['estimatedGzipBytes']<1073741824
 pre=sourcescheck();dump(Q/'source-pre-pack-check.json',pre);objects=json.loads((T/'objects-final.json').read_bytes());delta={h:v for h,v in objects.items() if v['backing']=='delta'};sink=Sink()
 with gzip.GzipFile(fileobj=sink,filename='',mode='wb',mtime=0,compresslevel=3) as z:
  with tarfile.open(fileobj=z,mode='w|',format=tarfile.USTAR_FORMAT) as t:
   for h,v in sorted(delta.items()):
    f,s=held(v['path']);assert s.st_size==v['bytes'];wrapper=HashRead(f)
    with f:
     m=tarfile.TarInfo('objects/'+h);m.size=v['bytes'];m.mode=0o600;m.uid=m.gid=m.mtime=0;t.addfile(m,wrapper);assert wrapper.h.hexdigest()==h and wrapper.n==v['bytes'];assert ident(s)==ident(os.fstat(f.fileno()))==ident(Path(v['path']).lstat())
 sink.end();archive={'bytes':sink.n,'sha256':sink.h.hexdigest(),'parts':sink.parts};dump(T/'archive.json',archive);verification=verifytar(archive,delta);post=sourcescheck();dump(Q/'source-post-pack-check.json',post)
 # Stream exact source ledger and reference ledger into the decoded index without buffering either ledger.
 header={'format':'C6_FROZEN_SIX_ROOTS_AUTHENTICATED_CONTENT_ONLY_V1','scope':'CONTENT_ONLY_NO_PHYSICAL_RESTORATION_NO_OLD_CUSTODY_NO_RUNTIME_ACCEPTANCE','C6fullCriterion':'UNRESOLVED120','whole07':'TIMEOUT_NULL_EXIT_RETAINED','actualApproval':'ABSENT','original122SourceParentNativePrivatePaid':'HELD','sourceChecks':json.loads((T/'source-checks.json').read_bytes()),'sourcePRE':pre,'sourcePOST':post,'archive':archive,'decodedObjectVerification':verification,'historicalUnresolvedSourceProvenance':closure['unresolved'],'capturedPreimageResolutions':json.loads((T/'captured-preimage-resolutions.json').read_bytes()),'priorLocators':json.loads((T/'authenticated-prior-locators.json').read_bytes())}
 with (T/'index.json').open('x') as f:
  s=json.dumps(header,separators=(',',':'));f.write(s[:-1]+',"sourceRows":[')
  for i,line in enumerate((T/'source-rows.jsonl').open()):f.write((',' if i else '')+line.strip())
  f.write('],"externalReferences":[')
  for i,line in enumerate((T/'external-references-final.jsonl').open()):f.write((',' if i else '')+line.strip())
  f.write('],"objects":[')
  for i,(h,v) in enumerate(sorted(objects.items())):f.write((',' if i else '')+json.dumps({'sha256':h,'bytes':v['bytes'],'backing':v['backing']},separators=(',',':')))
  f.write(']}\n')
 idx=transport(T/'index.json');union=transport(T/'union-catalog.json');mapping={str((Q/r['name']).relative_to(R)):str(T/r['name']) for r in archive['parts']}
 for n in ['index','union-catalog']:
  mapping[str((Q/(n+'.json')).relative_to(R))]=str(T/(n+'.json'));mapping[str((Q/(n+'.json.gz')).relative_to(R))]=str(T/(n+'.transport.json.gz'))
 dump(W/'virtual-source-mapping.json',mapping)
 receipt={'status':'CONTENT_ONLY_SELF_READBACK_COMPLETE_ROOT_INDEPENDENT_READBACK_REQUIRED','utc':now(),'sourceRoots':6,'sourceRows':pre['allSixSourceRows'],'references':closure['references'],'objects':len(objects),'reusedObjects':len(objects)-len(delta),'deltaObjects':len(delta),'deltaRawBytes':sum(v['bytes'] for v in delta.values()),'archive':archive,'index':idx,'unionCatalog':union,'unionObjects':29880,'sourcePRE':pre,'sourcePOST':post,'verification':verification,'limits':header['scope'],'C6fullCriterion':'UNRESOLVED120','actualApproval':'ABSENT','original122SourceParentNativePrivatePaid':'HELD','historicalSourceProvenanceGaps':closure['historicalSourceProvenanceGaps'],'historicalSourceProvenanceGapRows':len(closure['unresolved']),'allLiteralBackingReferencesResolved':True,'capturedPreimagesResolved':closure['capturedPreimagesResolved'],'encodedHardLimit':1073741824,'totalNewEncodedBytes':sink.n+idx['transportBytes']+union['transportBytes'],'sourceOnlyPerformanceAid':'LATE_PROSPECTIVE_CONTENT_SNAPSHOT_NOT_ORIGINAL_DIRECTORY_SEAL_NOT_EARLIER_CUSTODY_NOT_PERFORMANCE_QUALIFICATION'};dump(Q/'pack-receipt.json',receipt);print(json.dumps({k:v for k,v in receipt.items() if k not in ['archive']}),flush=True)
if __name__=='__main__':main()
