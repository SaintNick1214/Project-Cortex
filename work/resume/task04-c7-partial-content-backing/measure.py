from pathlib import Path
import os,stat,json,gzip,hashlib,sqlite3,io,tarfile,zlib,datetime
from stream_json import Reader,loads
R=Path('/workspace/Project-Cortex');B=R/'_goals/convex-backend-runtime-2026-10-02/qa';W=R/'work/resume/task04-c7-partial-content-backing';Q=B/'task04-c7-partial-content-backing';T=Path('/dev/shm/cortex-root-c7-partial-content-backing')
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def ident(s):return {'schema':'FS_IDENTITY_DECIMAL_V1','fields':{k:str(getattr(s,'st_'+k)) for k in FIELDS}}
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def dump(p,x):
 with p.open('x') as f:json.dump(x,f,separators=(',',':'));f.write('\n')
def held(p):
 s=p.lstat();assert stat.S_ISREG(s.st_mode) and s.st_nlink==1
 f=os.fdopen(os.open(p,os.O_RDONLY|os.O_NOFOLLOW),'rb');assert ident(s)==ident(os.fstat(f.fileno()));return f,s
def hashfile(p,expected=None,estimate=False):
 f,s=held(p);h=hashlib.sha256();n=0;z=zlib.compressobj(3,wbits=31) if estimate else None;e=0
 with f:
  for b in iter(lambda:f.read(65536),b''):
   h.update(b);n+=len(b)
   if z:e+=len(z.compress(b))
  if z:e+=len(z.flush())
  assert n==s.st_size and ident(s)==ident(os.fstat(f.fileno()))==ident(p.lstat())
 if expected:assert h.hexdigest()==expected
 return {'path':str(p),'sha256':h.hexdigest(),'bytes':n,'identity':ident(s),'gzipIndividualBytes':e if estimate else None}
def parse(p,arrays=(),objects=(),item=lambda *a:None,pair=lambda *a:None):
 f,s=held(p)
 with f:
  inp=gzip.GzipFile(fileobj=f,mode='rb') if p.suffix=='.gz' else f
  reader=Reader(iter(lambda:inp.read(16384),b''),valueLimit=1048576)
  result=reader.top(arrays,objects,item,pair)
  if inp is not f:inp.close()
  assert ident(s)==ident(os.fstat(f.fileno()))==ident(p.lstat())
 return result
conn=sqlite3.connect(W/'metadata.sqlite');conn.execute('PRAGMA cache_size=-2048');conn.execute('PRAGMA journal_mode=OFF');conn.execute('PRAGMA temp_store=FILE');conn.execute('PRAGMA mmap_size=0')
conn.execute('create table prior(h text primary key,n integer,b text) without rowid')
conn.execute('create table delta(h text primary key,n integer,p text,e integer,identity text) without rowid')
conn.execute('create table arch(h text primary key,n integer,seen integer default 0) without rowid')
def prioradd(h,n,b):
 old=conn.execute('select n,b from prior where h=?',(h,)).fetchone()
 if old:assert old==(n,b),(h,old,n,b)
 else:conn.execute('insert into prior values(?,?,?)',(h,n,b))
def transport(p,z,pin):
 a=hashfile(p,pin['decodedSHA256']);e=hashfile(z,pin['transportSHA256']);assert a['bytes']==pin['decodedBytes'] and e['bytes']==pin['transportBytes']
 f,s=held(p);g,t=held(z)
 with f,g,gzip.GzipFile(fileobj=g,mode='rb') as d:
  for b in iter(lambda:f.read(65536),b''):assert d.read(len(b))==b
  assert d.read(1)==b''
  assert ident(s)==ident(os.fstat(f.fileno()))==ident(p.lstat());assert ident(t)==ident(os.fstat(g.fileno()))==ident(z.lstat())
 return {'decoded':a,'encoded':e,'exactDecodedEqualityFullGzipEOFCRC':True}
class Parts(io.RawIOBase):
 def __init__(self,root,parts):self.root=root;self.parts=iter(parts);self.f=None;self.h=hashlib.sha256();self.n=0
 def readable(self):return True
 def readinto(self,b):
  while True:
   if self.f is None:
    try:self.part=next(self.parts)
    except StopIteration:return 0
    self.p=self.root/self.part['name'];self.f,self.s=held(self.p);self.ph=hashlib.sha256();self.pn=0
   d=self.f.read(len(b))
   if d:self.ph.update(d);self.h.update(d);self.pn+=len(d);self.n+=len(d);b[:len(d)]=d;return len(d)
   assert self.pn==self.part['bytes'] and self.ph.hexdigest()==self.part['sha256'];assert ident(self.s)==ident(os.fstat(self.f.fileno()))==ident(self.p.lstat());self.f.close();self.f=None
baseline=[]
for tag in ['frozen','review']:
 name='task04-c6-'+tag+'-content-backing';root=Path('/dev/shm/cortex-root-c6-'+tag+'-content-backing');receipt=loads((B/name/'pack-receipt.json').read_text());proofpath=B/(name+'-root-inspection.json');proof=loads(proofpath.read_text());assert proof['gzipEOFCRCAndExactTarMembershipVerified'] is True
 checks={k:transport(root/(n+'.json'),root/(n+'.transport.json.gz'),receipt[k]) for k,n in [('index','index'),('unionCatalog','union-catalog')]}
 parse(root/'union-catalog.json',objects=('objects',),pair=lambda key,h,v:prioradd(h,v['bytes'],v['backing']))
 conn.execute('delete from arch')
 def objectrow(key,v):
  if key!='objects':return
  if v['backing']=='delta':
   conn.execute('insert into arch(h,n) values(?,?)',(v['sha256'],v['bytes']));prioradd(v['sha256'],v['bytes'],name)
  else:assert conn.execute('select n,b from prior where h=?',(v['sha256'],)).fetchone()==(v['bytes'],v['backing'])
 parse(root/'index.json',arrays=('sourceChecks','sources','sourceRows','externalReferences','objects','capturedPreimages','historicalUnresolved'),item=objectrow)
 parts=Parts(root,receipt['archive']['parts']);count=nb=0
 with io.BufferedReader(parts,65536) as encoded,gzip.GzipFile(fileobj=encoded,mode='rb') as decoded:
  with tarfile.open(fileobj=decoded,mode='r|') as tar:
   for member in tar:
    assert member.isfile() and member.name.startswith('objects/')
    h=member.name[8:];row=conn.execute('select n,seen from arch where h=?',(h,)).fetchone();assert row==(member.size,0),(h,row,member.size)
    sha=hashlib.sha256();n=0
    with tar.extractfile(member) as f:
     for b in iter(lambda:f.read(65536),b''):sha.update(b);n+=len(b)
    assert n==member.size and sha.hexdigest()==h;conn.execute('update arch set seen=1 where h=?',(h,));count+=1;nb+=n
  assert not decoded.read(65536).strip(b'\0');assert decoded.read(1)==b''
  assert encoded.read(1)==b''
 assert not conn.execute('select 1 from arch where seen=0').fetchone();assert parts.n==receipt['archive']['bytes'] and parts.h.hexdigest()==receipt['archive']['sha256'];assert count==receipt['deltaObjects'] and nb==receipt['deltaRawBytes']
 baseline.append({'name':name,'rootInspection':hashfile(proofpath),'indexTransports':checks,'archive':receipt['archive'],'freshArchiveFullSHA256PartsGzipEOFCrcTarMembership':True,'deltaObjectsVerified':count,'rawBytesVerified':nb,'historicalGaps':{'rows':proof['historicalProvenanceGapRows'],'uniqueHashes':proof['historicalProvenanceGapUniqueHashes']}})
 conn.commit();print('AUTHENTICATED '+name+' '+str(count),flush=True)
dump(Q/'baseline-authentication.json',baseline)
rootproofpath=B/'task04-c7-partial-seals-root-inspection.json';rootproof=loads(rootproofpath.read_text());sources=[];totals={'rows':0,'files':0,'directories':0,'symlinks':0,'fileBytes':0,'reusedFileRows':0,'newFileRows':0}
ledger=gzip.open(T/'source-map.jsonl.gz','xb',compresslevel=3)
for source in rootproof['results']:
 seal=Path(source['seal']['path']);root=seal.parent;assert hashfile(seal,source['seal']['sha256'])['identity']==source['seal']['identity'];count=nb=0;members=set()
 def register(p,row):
  global count,nb
  rel=row['path'];assert rel not in members;members.add(rel);s=p.lstat();assert ident(s)==row['identity'],str(p);kind=row['kind'];v=dict(row);v['root']=str(root);v['literalPath']=str(p);count+=1;totals['rows']+=1
  if kind=='file':
   old=conn.execute('select n,b from prior where h=?',(row['sha256'],)).fetchone();assert not old or old[0]==row['bytes']
   a=hashfile(p,row['sha256'],estimate=not old);assert a['bytes']==row['bytes'] and a['identity']==row['identity'];v['backing']=old[1] if old else 'NEW_UNALLOCATED';totals['files']+=1;totals['fileBytes']+=row['bytes'];nb+=row['bytes'];totals['reusedFileRows' if old else 'newFileRows']+=1
   if not old:
    d=conn.execute('select n from delta where h=?',(row['sha256'],)).fetchone()
    if d:assert d[0]==row['bytes']
    else:conn.execute('insert into delta values(?,?,?,?,?)',(row['sha256'],row['bytes'],str(p),a['gzipIndividualBytes'],json.dumps(row['identity'],separators=(',',':'))))
  elif kind=='directory':assert stat.S_ISDIR(s.st_mode) and sorted(os.listdir(p))==row['members'];totals['directories']+=1
  elif kind=='symlink':assert stat.S_ISLNK(s.st_mode) and os.readlink(p)==row['literalTarget'];assert hashlib.sha256(os.fsencode(row['literalTarget'])).hexdigest()==row['literalTargetSHA256'];totals['symlinks']+=1
  else:raise AssertionError(kind)
  assert ident(s)==ident(p.lstat());ledger.write(json.dumps(v,separators=(',',':')).encode()+b'\n')
 header=parse(seal,arrays=('rows',),item=lambda k,row:register(root/row['path'],row));assert header['schema']=='C7_OWN_CURRENT_LITERAL_STREAM_SEAL_V1';assert header['rowCount']==count and header['fileBytes']==nb;assert ident(root.lstat())==header['rootIdentity'] and sorted(os.listdir(root))==header['rootMembers']
 actual=set()
 for parent,dirs,files in os.walk(root,followlinks=False):
  for n in dirs+files:
   p=Path(parent)/n
   if p!=seal:actual.add(str(p.relative_to(root)))
  dirs[:]=[n for n in dirs if not (Path(parent)/n).is_symlink()]
 assert actual==members
 sources.append({'root':str(root),'seal':source['seal'],'rootIdentity':header['rootIdentity'],'rootMembers':header['rootMembers'],'references':header['references'],'rows':count,'fileBytes':nb,'literalMembershipAndAll9HeldFDPrePostAndFullHash':True})
 # Own source seal is excluded by source self-seal and must itself be backed.
 sealrow={'path':seal.name,'kind':'file','bytes':source['seal']['bytes'],'sha256':source['seal']['sha256'],'identity':source['seal']['identity']};register(seal,sealrow)
 print('C7_SOURCE '+str(root)+' '+str(count),flush=True);conn.commit()
ledger.close();dump(Q/'sources.json',sources)
raw,estimate,count=conn.execute('select coalesce(sum(n),0),coalesce(sum(e),0),count(*) from delta').fetchone();resource={'memoryCurrent':int(Path('/sys/fs/cgroup/memory.current').read_text()),'memoryMax':int(Path('/sys/fs/cgroup/memory.max').read_text()),'memoryEvents':Path('/sys/fs/cgroup/memory.events').read_text(),'overlayAvailable':os.statvfs(W).f_bavail*os.statvfs(W).f_frsize,'tmpAvailable':os.statvfs('/tmp').f_bavail*os.statvfs('/tmp').f_frsize,'shmAvailable':os.statvfs(T).f_bavail*os.statvfs(T).f_frsize};resource['literalMemoryHeadroom']=resource['memoryMax']-resource['memoryCurrent']
report={'schema':'C7_PARTIAL_CONTENT_PREALLOCATION_MEASUREMENT_V1','utc':now(),'status':'MEASURED_NO_NEW_CONTENT_ALLOCATION','scope':'CONTENT_ONLY_NOT_RUNTIME_OR_PHYSICAL_IDENTITY_RESTORATION','totalsIncludingExcludedSourceSeals':totals,'baselineObjects':conn.execute('select count(*) from prior').fetchone()[0],'uniqueDeltaObjects':count,'deltaRawBytes':raw,'sumIndependentGzipBytes':estimate,'resources':resource,'historicalGaps':'UNCHANGED_NO_MUTABLE_HISTORICAL_SOURCE_READ','original122':'HELD','whole120':'UNQUALIFIED','actualApproval':'ABSENT','candidateNodeOrHeldPhaseExecuted':False,'sourceMap':hashfile(T/'source-map.jsonl.gz'),'rootSourceInspection':hashfile(rootproofpath)}
dump(Q/'measurement.json',report);conn.close();print(json.dumps(report,separators=(',',':')),flush=True)
