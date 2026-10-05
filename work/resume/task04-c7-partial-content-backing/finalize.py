from common import *
import sys
conn=sqlite3.connect('file:'+str(W/'metadata.sqlite')+'?mode=ro',uri=True);conn.execute('PRAGMA cache_size=-2048');conn.execute('PRAGMA mmap_size=0')
measurement=loads((Q/'measurement.json').read_text())
class Count(io.RawIOBase):
 def __init__(self):self.n=0;self.h=hashlib.sha256()
 def writable(self):return True
 def write(self,b):self.n+=len(b);self.h.update(b);return len(b)
class HashRead:
 def __init__(self,f):self.f=f;self.h=hashlib.sha256();self.n=0
 def read(self,n):
  b=self.f.read(n);self.h.update(b);self.n+=len(b);return b
sink=Count();count=raw=0
with gzip.GzipFile(filename='',fileobj=sink,mode='wb',mtime=0,compresslevel=3) as gz:
 with tarfile.open(fileobj=gz,mode='w|',format=tarfile.USTAR_FORMAT) as tar:
  for h,n,p,e,identity in conn.execute('select h,n,p,e,identity from delta order by h'):
   path=Path(p);f,s=held(path);assert ident(s)==loads(identity);wrap=HashRead(f)
   with f:
    m=tarfile.TarInfo('objects/'+h);m.size=n;m.mode=0o600;m.uid=m.gid=m.mtime=0;tar.addfile(m,wrap)
    assert wrap.n==n and wrap.h.hexdigest()==h;assert ident(s)==ident(os.fstat(f.fileno()))==ident(path.lstat())
   count+=1;raw+=n
resource={'memoryCurrent':int(Path('/sys/fs/cgroup/memory.current').read_text()),'memoryMax':int(Path('/sys/fs/cgroup/memory.max').read_text()),'memoryEvents':Path('/sys/fs/cgroup/memory.events').read_text(),'overlayAvailable':os.statvfs(W).f_bavail*os.statvfs(W).f_frsize,'tmpAvailable':os.statvfs('/tmp').f_bavail*os.statvfs('/tmp').f_frsize,'shmAvailable':os.statvfs(T).f_bavail*os.statvfs(T).f_frsize};resource['literalMemoryHeadroom']=resource['memoryMax']-resource['memoryCurrent'];reserve=16*1024*1024
assert count==measurement['uniqueDeltaObjects'] and raw==measurement['deltaRawBytes']
blocker={'schema':'C7_PARTIAL_EXACT_DELTA_RESOURCE_GATE_V1','utc':now(),'status':'BLOCKED_BEFORE_DELTA_CONTENT_ALLOCATION','uniqueDeltaObjects':count,'deltaRawBytes':raw,'exactGzipTarBytes':sink.n,'exactGzipTarSHA256':sink.h.hexdigest(),'method':'FULL_NEW_OBJECT_HELDFD_ALL9_PREPOST_SHA256_USTAR_GZIP_LEVEL3_COUNTING_SINK_NO_CONTENT_OUTPUT','resources':resource,'minimumRuntimeReserveBytes':reserve,'overlayShortfallBytes':max(0,sink.n-resource['overlayAvailable']),'tmpShortfallBytes':max(0,sink.n-resource['tmpAvailable']),'shmMemoryShortfallBytes':max(0,sink.n+reserve-resource['literalMemoryHeadroom']),'partsWritten':0,'noBulkBytesAllocated':True,'losslessTransportComplete':False,'contentMapOnlyAchievable':True,'scope':'CONTENT_ONLY_NOT_RUNTIME_OR_PHYSICAL_IDENTITY_RESTORATION','original122':'HELD','whole120':'UNQUALIFIED','actualApproval':'ABSENT'}
assert blocker['overlayShortfallBytes'] and blocker['tmpShortfallBytes'] and blocker['shmMemoryShortfallBytes'],blocker
dump(Q/'resource-gate.json',blocker);print(json.dumps(blocker,separators=(',',':')),flush=True)
# Exact source verification POST: full9 heldFD bytes and literal links; source root seals remain unchanged.
post={'utc':now(),'rows':0,'fileBytes':0,'full9HeldFDPrePostSHA256':True,'literalLinksNeverFollowed':True,'roots':[]}
with gzip.open(T/'source-map.jsonl.gz','rb') as stream:
 for line in stream:
  row=loads(line);p=Path(row['literalPath']);s=p.lstat();assert ident(s)==row['identity'];post['rows']+=1
  if row['kind']=='file':a=hashfile(p,row['sha256']);assert a['identity']==row['identity'] and a['bytes']==row['bytes'];post['fileBytes']+=row['bytes']
  elif row['kind']=='directory':assert stat.S_ISDIR(s.st_mode) and sorted(os.listdir(p))==row['members']
  elif row['kind']=='symlink':assert stat.S_ISLNK(s.st_mode) and os.readlink(p)==row['literalTarget'] and hashlib.sha256(os.fsencode(row['literalTarget'])).hexdigest()==row['literalTargetSHA256']
  assert ident(s)==ident(p.lstat())
for root in loads((Q/'sources.json').read_text()):
 p=Path(root['root']);assert ident(p.lstat())==root['rootIdentity'] and sorted(os.listdir(p))==root['rootMembers'];post['roots'].append({'root':str(p),'exactRoot9AndLiteralMembership':True,'sealSHA256':root['seal']['sha256']})
assert post['rows']==measurement['totalsIncludingExcludedSourceSeals']['rows'] and post['fileBytes']==measurement['totalsIncludingExcludedSourceSeals']['fileBytes'];dump(Q/'source-post-check.json',post)
# Stream the small reviewable exact byte map. Delta entries are explicitly unavailable for published reuse.
decoded=Count();seen=set();reused=[]
with (T/'index.json.gz').open('xb') as out,gzip.GzipFile(filename='',fileobj=out,mode='wb',mtime=0,compresslevel=3) as gz:
 def emit(b):gz.write(b);decoded.write(b)
 header={'schema':'C7_PARTIAL_CONTENT_MAPPING_BLOCKED_V1','status':'PARTIAL_MAPPING_NO_DELTA_ARCHIVE','scope':'CONTENT_ONLY_NOT_RUNTIME_OR_PHYSICAL_IDENTITY_RESTORATION','sources':loads((Q/'sources.json').read_text()),'baselineAuthentication':hashfile(Q/'baseline-authentication.json'),'resourceGate':blocker,'sourcePOST':post,'historicalGaps':{'c6FrozenRows':68,'c6FrozenUniqueHashes':67,'c6ReviewRows':1,'c6ReviewUniqueHashes':1,'policy':'UNCHANGED_NO_MUTABLE_HISTORICAL_SOURCE_READ'},'candidateNodeOrHeldPhases':False,'sourceRows':None}
 header.pop('sourceRows');emit(json.dumps(header,separators=(',',':')).encode()[:-1]+b',"sourceRows":[')
 with gzip.open(T/'source-map.jsonl.gz','rb') as stream:
  for i,line in enumerate(stream):
   row=loads(line);emit((b',' if i else b'')+line.rstrip(b'\n'))
   if row['kind']=='file' and row['backing']!='NEW_UNALLOCATED' and row['sha256'] not in seen:seen.add(row['sha256']);reused.append((row['sha256'],row['bytes'],row['backing']))
 emit(b'],"objects":[');i=0
 for h,n,b in sorted(reused):
  emit((b',' if i else b'')+json.dumps({'sha256':h,'bytes':n,'backing':b,'availability':'AUTHENTICATED_PRIOR_CONTENT_ONLY'},separators=(',',':')).encode());i+=1
 for h,n,p,e,identity in conn.execute('select h,n,p,e,identity from delta order by h'):
  emit((b',' if i else b'')+json.dumps({'sha256':h,'bytes':n,'backing':'NEW_UNALLOCATED','availability':'SOURCE_FROZEN_CURRENT_ONLY_NO_PUBLISHED_DELTA'},separators=(',',':')).encode());i+=1
 emit(b']}\n')
conn.close();encoded=hashfile(T/'index.json.gz');check=Count()
with gzip.open(T/'index.json.gz','rb') as f:
 for b in iter(lambda:f.read(65536),b''):check.write(b)
assert check.n==decoded.n and check.h.hexdigest()==decoded.h.hexdigest()
receipt={'schema':'C7_PARTIAL_CONTENT_MAPPING_RECEIPT_V1','status':'BLOCKED_LOSSLESS_DELTA_TRANSPORT_NOT_COMPLETED','utc':now(),'sourceRows':post['rows'],'sourceFileBytes':post['fileBytes'],'uniqueReusedObjects':len(reused),'uniqueNewUnavailableObjects':count,'index':{'decodedBytes':decoded.n,'decodedSHA256':decoded.h.hexdigest(),'transport':encoded,'fullGzipEOFCRCDecodedSHA256Verified':True},'resourceGate':hashfile(Q/'resource-gate.json'),'sourceMap':hashfile(T/'source-map.jsonl.gz'),'contentParts':[],'sourcePREPOST':'FULL9_HELDFD_HASH_LITERAL_MEMBERSHIP_LINKS','historicalGaps':'UNCHANGED','scope':blocker['scope'],'original122':'HELD','whole120':'UNQUALIFIED','actualApproval':'ABSENT'}
dump(Q/'mapping-receipt.json',receipt);dump(W/'virtual-source-mapping.json',{str((Q/'index.json.gz').relative_to(R)):str(T/'index.json.gz'),str((Q/'source-map.jsonl.gz').relative_to(R)):str(T/'source-map.jsonl.gz')});print(json.dumps(receipt,separators=(',',':')),flush=True)
