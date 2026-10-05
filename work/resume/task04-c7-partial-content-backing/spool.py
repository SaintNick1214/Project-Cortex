from common import *
import time,base64
conn=sqlite3.connect('file:'+str(W/'metadata.sqlite')+'?mode=ro',uri=True);conn.execute('PRAGMA cache_size=-2048');conn.execute('PRAGMA mmap_size=0')
gate=loads((Q/'resource-gate.json').read_text());LIMIT=5242879
class VerifyTar:
 def __init__(self):self.z=zlib.decompressobj(31);self.header=bytearray();self.remaining=0;self.padding=0;self.member=None;self.sha=None;self.seen=set();self.nb=0;self.zero=False
 def raw(self,b):
  at=0
  while at<len(b):
   if self.remaining:
    n=min(self.remaining,len(b)-at);self.sha.update(b[at:at+n]);at+=n;self.remaining-=n
    if not self.remaining:assert self.sha.hexdigest()==self.member;self.seen.add(self.member)
   elif self.padding:
    n=min(self.padding,len(b)-at);assert not b[at:at+n].strip(b'\0');at+=n;self.padding-=n
   else:
    n=min(512-len(self.header),len(b)-at);self.header.extend(b[at:at+n]);at+=n
    if len(self.header)==512:
     header=bytes(self.header);self.header.clear()
     if not header.strip(b'\0'):self.zero=True;continue
     assert not self.zero;member=tarfile.TarInfo.frombuf(header,'utf-8','strict');assert member.isfile() and member.name.startswith('objects/');h=member.name[8:];assert h not in self.seen;expected=conn.execute('select n from delta where h=?',(h,)).fetchone();assert expected==(member.size,)
     self.member=h;self.remaining=member.size;self.padding=(-member.size)%512;self.sha=hashlib.sha256();self.nb+=member.size
     if not member.size:assert h==self.sha.hexdigest();self.seen.add(h)
 def encoded(self,b):
  while True:
   d=self.z.decompress(b,65536);self.raw(d);b=self.z.unconsumed_tail
   if not b:break
 def finish(self):
  self.raw(self.z.flush(65536));assert self.z.eof and not self.z.unused_data and not self.header and not self.remaining and not self.padding and self.zero;assert len(self.seen)==gate['uniqueDeltaObjects'] and self.nb==gate['deltaRawBytes']
class Sink(io.RawIOBase):
 def __init__(self):self.n=0;self.h=hashlib.sha256();self.f=None;self.pn=0;self.parts=[];self.verifier=VerifyTar();self.events={k:int(v) for k,v in (line.split() for line in Path('/sys/fs/cgroup/memory.events').read_text().splitlines()) if k in ('oom','oom_kill')}
 def writable(self):return True
 def new(self):
  events={k:int(v) for k,v in (line.split() for line in Path('/sys/fs/cgroup/memory.events').read_text().splitlines()) if k in ('oom','oom_kill')};assert events==self.events,'OOM_COUNTER_CHANGED_KEEP_OWN_SPOOL';current=int(Path('/sys/fs/cgroup/memory.current').read_text());cap=int(Path('/sys/fs/cgroup/memory.max').read_text());assert cap-current>=16*1024*1024+LIMIT,'INSUFFICIENT_LITERAL_HEADROOM_FOR_ONEPART'
  free=os.statvfs(W).f_bavail*os.statvfs(W).f_frsize;assert free>=LIMIT+4*1024*1024
  self.name='objects.part-'+str(len(self.parts)).zfill(4);self.p=W/'spool'/self.name;self.existing=self.p.exists();self.f=self.p.open('rb' if self.existing else 'xb');self.pn=0;self.ph=hashlib.sha256()
 def write(self,b):
  self.h.update(b);self.n+=len(b);self.verifier.encoded(b);at=0
  while at<len(b):
   if self.f is None:self.new()
   n=min(LIMIT-self.pn,len(b)-at);v=b[at:at+n];(self.f.read(n)==v or (_ for _ in ()).throw(AssertionError('RESUME_PART_BYTES_MISMATCH'))) if self.existing else self.f.write(v);self.ph.update(v);self.pn+=n;at+=n
   if self.pn==LIMIT:self.consume()
  return len(b)
 def consume(self):
  
  if not self.existing:self.f.flush();os.fsync(self.f.fileno())
  self.f.close();self.f=None
  if not self.existing:os.chmod(self.p,0o400)
  proof=hashfile(self.p,self.ph.hexdigest());git=hashlib.sha1(('blob '+str(self.pn)+'\0').encode());f,s=held(self.p)
  with f:
   for b in iter(lambda:f.read(65536),b''):git.update(b)
   assert ident(s)==proof['identity']==ident(os.fstat(f.fileno()))==ident(self.p.lstat())
  record={'schema':'C7_SERIALIZED_IMMUTABLE_PART_READY_V1','partName':self.name,'partNumber':len(self.parts),'bytes':self.pn,'sha256':self.ph.hexdigest(),'gitBlobSHA':git.hexdigest(),'path':str(self.p),'observedIdentity':proof['identity'],'identityMeaning':'OBSERVED_LOCAL9_ONLY_NOT_CURRENT_AFTER_REMOTE_ACK_CONSUMPTION','repositoryPath':str((Q/self.name).relative_to(R)),'archiveExpectedSHA256':gate['exactGzipTarSHA256'],'archiveExpectedBytes':gate['exactGzipTarBytes'],'unfrozenOwnedSpoolOnly':True,'utc':now()};
  manifest=W/'part-manifests'/(self.name+'.json')
  if manifest.exists():
   existing=loads(manifest.read_text());assert all(record[k]==existing[k] for k in ('partName','partNumber','bytes','sha256','gitBlobSHA','path','observedIdentity','repositoryPath'));record=existing
  else:dump(manifest,record)
  storedBytes=4*((self.pn+2)//3);storedGit=hashlib.sha1(('blob '+str(storedBytes)+'\0').encode());storedSHA=hashlib.sha256();f,ss=held(self.p)
  with f:
   for block in iter(lambda:f.read(65535),b''):
    encoded=base64.b64encode(block);storedGit.update(encoded);storedSHA.update(encoded)
   assert ident(ss)==proof['identity']==ident(os.fstat(f.fileno()))==ident(self.p.lstat())
  storage={'storageEncoding':'BASE64_ASCII_LOSSLESS','storedRepositoryPath':record['repositoryPath']+'.base64','storedGitBlobSHA':storedGit.hexdigest(),'storedBytes':storedBytes,'storedSHA256':storedSHA.hexdigest(),'rawSHA256':record['sha256'],'rawGitBlobSHA':record['gitBlobSHA'],'rawBytes':record['bytes'],'decodedEqualityBasis':'EXACT_FETCHED_RFC4648_BASE64_TEXT_BIJECTION_NO_BINARY_ADAPTER_CLAIM'}
  storageManifest=W/'part-manifests'/(self.name+'.storage.json')
  if storageManifest.exists():assert loads(storageManifest.read_text())==storage
  else:dump(storageManifest,storage)
  print('READY '+self.name,flush=True)
  ackpath=W/'remote-acks'/(self.name+'.json');deadline=time.monotonic()+600
  while not ackpath.exists():
   if time.monotonic()>deadline:raise TimeoutError('REMOTE_ACK_ABSENT_KEEP_OWN_SPOOL_'+self.name)
   time.sleep(.25)
  ack=loads(ackpath.read_text());assert ack['schema']=='C7_REMOTE_PART_ACK_V2';assert ack['partName']==self.name and ack['bytes']==self.pn and ack['sha256']==self.ph.hexdigest() and ack['gitBlobSHA']==git.hexdigest() and ack['uploadReturnedGitSHA']==storedGit.hexdigest() and ack['fetchGitSHA']==storedGit.hexdigest() and ack['fetchedImmutableBlobBytesCompared'] is True and ack['immutableStoredContentCompared'] is True and ack['repositoryPath']==record['repositoryPath'] and isinstance(ack['repository'],str) and ack['repository'];assert isinstance(ack['utc'],str);assert all(ack[k]==storage[k] for k in ('storageEncoding','storedRepositoryPath','storedGitBlobSHA','storedBytes'))
  assert hashfile(self.p,self.ph.hexdigest())['identity']==proof['identity'];record.update(remoteAck=hashfile(ackpath),remoteRepository=ack['repository'],remoteImmutableGitBlob=storedGit.hexdigest(),remoteStorage=storage);self.parts.append(record);os.unlink(self.p);print('CONSUMED '+self.name,flush=True)
 def end(self):
  if self.f is not None:self.consume()
  self.verifier.finish();assert self.n==gate['exactGzipTarBytes'] and self.h.hexdigest()==gate['exactGzipTarSHA256']
class HashRead:
 def __init__(self,f):self.f=f;self.h=hashlib.sha256();self.n=0
 def read(self,n):b=self.f.read(n);self.h.update(b);self.n+=len(b);return b
if __name__=='__main__':
 for n in ['spool','part-manifests','remote-acks']:(W/n).mkdir(exist_ok=True)
 sink=Sink()
 with gzip.GzipFile(filename='',fileobj=sink,mode='wb',mtime=0,compresslevel=3) as gz:
  with tarfile.open(fileobj=gz,mode='w|',format=tarfile.USTAR_FORMAT) as tar:
   for h,n,p,e,identity in conn.execute('select h,n,p,e,identity from delta order by h'):
    path=Path(p);f,s=held(path);assert ident(s)==loads(identity);wrap=HashRead(f)
    with f:
     m=tarfile.TarInfo('objects/'+h);m.size=n;m.mode=0o600;m.uid=m.gid=m.mtime=0;tar.addfile(m,wrap);assert wrap.n==n and wrap.h.hexdigest()==h;assert ident(s)==ident(os.fstat(f.fileno()))==ident(path.lstat())
 sink.end();dump(Q/'remote-archive-receipt.json',{'schema':'C7_SERIALIZED_REMOTE_CONTENT_ARCHIVE_V1','status':'LOSSLESS_NEW_DELTA_ARCHIVE_REMOTE_IMMUTABLE_BLOBS','utc':now(),'bytes':sink.n,'sha256':sink.h.hexdigest(),'parts':sink.parts,'decodedObjects':len(sink.verifier.seen),'decodedBytes':sink.verifier.nb,'fullGzipEOFCRCExactTarMembershipSHA256':True,'rootImmutableRemoteByteComparisonEachPart':True,'observedLocal9LineageNotCurrentPhysicalIdentity':True,'ownedConsumedUnfrozenSpoolDeletionOnly':True,'wholeArchiveAllocation':False,'peakPartLimit':LIMIT,'scope':'CONTENT_ONLY_NOT_RUNTIME_OR_PHYSICAL_IDENTITY_RESTORATION'});conn.close();print('ARCHIVE_COMPLETE',flush=True)
