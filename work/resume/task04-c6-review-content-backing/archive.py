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
     for b in iter(lambda:f.read(65536),b''):a.update(b);size+=len(b)
    assert a.hexdigest()==h and size==m.size;seen.add(h);n+=size
  for b in iter(lambda:z.read(65536),b''):assert not any(b),'nonzero tar trailing bytes'
 assert joined.read(1)==b'' and joined.h.hexdigest()==archive['sha256'] and joined.n==archive['bytes'];assert seen==set(objects)
 return {'objects':len(seen),'rawBytes':n,'fullGzipEOFAndCRC':True,'exactMemberSHA256AndSizes':True,'archiveSHA256AndPartHashes':True}
class Sink:
 def __init__(self):self.f=None;self.parts=[];self.h=hashlib.sha256();self.n=0;self.limit=5*1024*1024-1;self.events=Path('/sys/fs/cgroup/memory.events').read_text()
 def write(self,data):
  at=0
  while at<len(data):
   assert self.n+len(data)-at<=268435456,'encoded reserve exceeded'
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
  for b in iter(lambda:f.read(65536),b''):z.write(b)
  assert ident(s)==ident(os.fstat(f.fileno()))==ident(p.lstat())
 with p.open('rb') as f,out.open('rb') as e,gzip.GzipFile(fileobj=e,mode='rb') as z:
  while True:
   a=f.read(65536);b=z.read(65536);assert a==b
   if not a:break
 a,s,_=read(p);h,st,_=read(out);return {'decodedSHA256':a,'decodedBytes':s.st_size,'transportSHA256':h,'transportBytes':st.st_size,'decodedRepositoryPath':str((Q/p.name).relative_to(R)),'transportRepositoryPath':str((Q/(p.name+'.gz')).relative_to(R)),'losslessFullGzipEOFCRCVerified':True}
