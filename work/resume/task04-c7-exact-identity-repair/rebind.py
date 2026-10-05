"""Prospective C7 bindings only. No original command, approval or old-root write."""
from pathlib import Path
import os,stat,json,hashlib,gzip,datetime,time,zlib,struct,sqlite3,resource,uuid
from stream_json import Reader,loads
R=Path('/workspace/Project-Cortex');B=R/'work/resume/task04-c7-exact-identity-repair';W=B/'candidate';T=Path('/dev/shm/cortex-native-c7-exact-identity-repair');OW=R/'work/resume/task04-model-drift-native-preparation-c6/closed-launcher-c6';OT=Path('/dev/shm/cortex-native-c6-closed-launcher-c6');A=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-evidence-transport-c4-c1'
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns');H=lambda b:hashlib.sha256(b).hexdigest();utc=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat();began=time.monotonic();deadline=began+120;references=[]
sealRows={}
def ident(s):return {'schema':'FS_IDENTITY_DECIMAL_V1','fields':{k:str(getattr(s,'st_'+k)) for k in FIELDS}}
def fence():
 if time.monotonic()>=deadline:raise TimeoutError('OWN_C7_REBIND_120S_ABSOLUTE_DEADLINE')
def renamed(p):return str(p).replace(str(OW),str(W)).replace(str(OT),str(T))
def namespace(b):return b.replace(str(OW).encode(),str(W).encode()).replace(str(OT).encode(),str(T).encode())
def observe(p,expected=None,bytesWanted=False,archive=False):
 fence();p=Path(p);s=os.lstat(p)
 if not stat.S_ISREG(s.st_mode) or s.st_nlink!=1 or str(p.resolve())!=str(p):raise RuntimeError('C7_SOURCE_BINDING '+str(p))
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW);a=os.fstat(fd);h=hashlib.sha256();count=0;blocks=[]
 temporary=None;compressed=None;output=None
 if archive:
  directory=T/'prospective-source-prebytes';directory.mkdir(exist_ok=True,mode=0o700);temporary=directory/('capture-v3-'+uuid.uuid4().hex+'.gz');output=temporary.open('xb');compressed=gzip.GzipFile(filename='',fileobj=output,mode='wb',mtime=0)
 try:
  if ident(a)!=ident(s):raise RuntimeError('C7_SOURCE_OPEN_DRIFT')
  while True:
   b=os.read(fd,1048576)
   if not b:break
   h.update(b);count+=len(b)
   if bytesWanted:blocks.append(b)
   if compressed:compressed.write(b)
  z=os.fstat(fd);last=os.lstat(p)
  if ident(a)!=ident(z) or ident(a)!=ident(last) or count!=a.st_size:raise RuntimeError('C7_SOURCE_READ_DRIFT')
 finally:
  os.close(fd)
  if compressed:compressed.close();output.flush();os.fsync(output.fileno());output.close()
 digest=h.hexdigest()
 if expected is not None and digest!=expected:raise RuntimeError('C7_SOURCE_SHA_DRIFT '+str(p))
 if str(p) in sealRows:
  sealed=sealRows[str(p)]
  if digest!=sealed['sha256'] or count!=sealed['bytes'] or ident(a)['fields']!={k:str(sealed['identity'][k]) for k in FIELDS}:raise RuntimeError('C7_IMMUTABLE_C6_LITERAL_SEAL_BINDING')
 row={'path':str(p),'bytes':count,'sha256':digest,'identity':ident(a),'observation':'PROSPECTIVE_CURRENT_C7_NOT_HISTORICAL_CERTIFICATION'}
 data=b''.join(blocks) if bytesWanted else None
 if archive:
  target=directory/(digest+'-stream-v3.gz')
  if target.exists():temporary.unlink()
  else:temporary.rename(target);os.chmod(target,0o600)
  encoded=observe(target);backfd=os.open(target,os.O_RDONLY|os.O_NOFOLLOW);before=os.fstat(backfd);decodedHash=hashlib.sha256();decodedSize=0
  try:
   with os.fdopen(os.dup(backfd),'rb') as backing:
    with gzip.GzipFile(fileobj=backing,mode='rb') as decoded:
     while chunk:=decoded.read(1048576):decodedHash.update(chunk);decodedSize+=len(chunk)
   if ident(before)!=ident(os.fstat(backfd)) or ident(before)!=ident(os.lstat(target)):raise RuntimeError('C7_SOURCE_BACKING_IDENTITY_DRIFT')
  finally:os.close(backfd)
  if decodedHash.hexdigest()!=digest or decodedSize!=count:raise RuntimeError('C7_SOURCE_BACKING_DRIFT')
  row['beforeByteBacking']={'path':str(target),'bytes':encoded['bytes'],'sha256':encoded['sha256'],'identity':encoded['identity'],'encoding':'GZIP_EXACT_PREIMAGE'}
 if bytesWanted:row['data']=data
 return row
def read(p,expected=None):
 row=observe(p,expected,bytesWanted=True,archive=True);data=row.pop('data');references.append(row);return data
def readImmutableBacking(p,expected):
 row=observe(p,expected,bytesWanted=True);data=row.pop('data');row['beforeByteBacking']={'kind':'READONLY_IMMUTABLE_CAPTURED_BYTE_REFERENCE','path':row['path'],'bytes':row['bytes'],'sha256':row['sha256'],'identity':row['identity']};references.append(row);return data
def put(p,data):
 p=Path(p)
 if not (p.is_relative_to(W) or p.is_relative_to(T) or p.is_relative_to(B)):raise RuntimeError('C7_OUTPUT_SCOPE')
 p.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
 if not isinstance(data,bytes):data=(json.dumps(data,separators=(',',':'))+'\n').encode()
 p.write_bytes(data);os.chmod(p,0o600);return observe(p,archive=True)
def cleanrow(r):return {k:v for k,v in r.items() if k!='data'}
started=utc();resourcePRE={k:Path('/sys/fs/cgroup/'+k).read_text() for k in ['memory.current','memory.stat','memory.events']}
for root,pin in [(OW,'7d4c0048114ca756d7cfe0ae42ed81e6fcfdec7237f780511b07a2b252f82606'),(OT,'451993ad4dfad8b6c30d22e8ddc637eab2efe18b86f8ce18e0625baf9b00038b')]:
 sealed=loads(read(root/'seal.json',pin));assert sealed['root']==str(root)
 for row in sealed['rows']:
  if row['kind']=='file':sealRows[str(root/row['path'])]=row
# Immutable captured C6 roots are inputs, never adopted as C7 authority.
lineage=loads(read(OW/'mirror-source-transform-map.json'));assert len(lineage['inputs'])==823
for row in lineage['inputs']:
 old=Path(row['destination']);original=observe(row['source'],row['sha256'],archive=True);copy=read(old,row['destinationSHA256']);new=Path(renamed(old));newbytes=namespace(copy) if old.suffix in ['.mjs','.cjs','.json','.ts','.py'] else copy;destination=put(new,newbytes)
 row['legacyC6']={'sourcePath':str(old),'bytes':len(copy),'sha256':H(copy),'identityStatus':'PRECISION_LIMITED_NOT_EXACT_AUTHORITY','rawLegacyIdentityJSON':json.dumps(row.pop('identity',None),separators=(',',':')),'existingBacking':row.pop('beforeByteBacking',None)}
 row.update(destination=str(new),destinationBytes=destination['bytes'],destinationSHA256=destination['sha256'],sourceIdentity=original['identity'],destinationIdentity=destination['identity'],identity=original['identity'],beforeByteBacking=original['beforeByteBacking'],prospectiveDestinationBeforeByteBacking=destination['beforeByteBacking'])
put(W/'mirror-source-transform-map.json',lineage)
graph=loads(read(OT/'package-graph.json'))
for row in graph['files']:
 current=observe(row['path'],row['sha256'],archive=True);row['legacyC6']={'rawLegacyIdentityJSON':json.dumps(row.pop('identity',None),separators=(',',':')),'identityStatus':'PRECISION_LIMITED_NOT_EXACT_AUTHORITY','existingBacking':row.pop('beforeByteBacking',None)};row.update(current)
graph['identityObservation']='PROSPECTIVE_CURRENT_C7_NOT_ORIGINAL_ACCEPTANCE';put(T/'package-graph.json',graph)
# Literal seven aliases only; every target and scope directory remain separate.
aliasRoot=T/'mirror/node_modules';dirs=[aliasRoot,aliasRoot/'@esbuild',aliasRoot/'@types']
for p in dirs:p.mkdir(mode=0o700,parents=True,exist_ok=True)
links=[]
for name in graph['packages']:
 p=aliasRoot/name;target=R/'node_modules'/name
 if p.exists() or p.is_symlink():
  if not p.is_symlink() or os.readlink(p)!=str(target):raise RuntimeError('C7_ALIAS_VERSION_DRIFT')
 else:p.symlink_to(target,target_is_directory=True)
 literal=os.fsencode(os.readlink(p));links.append({'package':name,'path':str(p),'target':str(target),'identity':ident(os.lstat(p)),'literalTargetBytes':len(literal),'literalTargetSHA256':H(literal),'capturedPackageRows':sum(r['path'].startswith(str(target)+'/') for r in graph['files'])})
put(T/'package-aliases.json',{'packageGraphSHA256':observe(T/'package-graph.json')['sha256'],'directories':[{'path':str(p),'identity':ident(os.lstat(p))} for p in dirs],'links':links,'wholeNodeModulesAlias':False,'NODE_PATH':'ABSENT'})
# Authenticate the complete immutable original8 byte archive. Its transport
# equality still cannot repair any old physical-identity custody incident.
indexBytes=read(A/'index.json','a82fb82ad92d4a9753a9c7fe612ba880f82f4893a7a6d3e211dc8ec9a4fad869');index=loads(indexBytes)
scratch=T/'rebind3-scratch';scratch.mkdir(mode=0o700,exist_ok=False)
db=sqlite3.connect(scratch/'map.sqlite');db.execute('PRAGMA cache_size=-2048');db.execute('PRAGMA temp_store=FILE');db.execute('CREATE TABLE maprows(path TEXT PRIMARY KEY, kind TEXT NOT NULL, sha TEXT, bytes INTEGER)')
contents={};mapCounts={'rows':0,'files':0,'symlinks':0};mapDigest=hashlib.sha256();mapSize=0
# Each immutable encoded part is fully read under exact9, then decoded in small
# chunks. The scalar-value domain remains the original authenticated whole size.
def mapChunks():
 global mapSize
 decoder=zlib.decompressobj(31)
 for part in index['mapParts']:
  encoded=readImmutableBacking(A/part['path'],part['sha256']);assert len(encoded)==part['bytes'];pending=encoded
  while pending:
   block=decoder.decompress(pending,65536);pending=decoder.unconsumed_tail;mapDigest.update(block);mapSize+=len(block)
   if mapSize>index['mapDecodedBytes']:raise RuntimeError('C7_MAP_DECODE_CAP')
   if block:yield block
 block=decoder.flush();mapDigest.update(block);mapSize+=len(block)
 if block:yield block
 assert decoder.eof and not decoder.unused_data and mapSize==index['mapDecodedBytes'] and mapDigest.hexdigest()==index['mapDecodedSha256']
def mapItem(key,row):
 fence();assert type(row) is dict
 # The exact original mapping record is inspected below after its shape is
 # authenticated; no record is discarded and duplicate paths are forbidden.
 path=row['path'];kind=row['kind'];assert type(path) is str and type(kind) is str and path and not path.startswith('/') and '..' not in path.split('/')
 assert any(path==r['root'] or path.startswith(r['root']+'/') for r in index['sourcePins'])
 assert type(row['mode']) is int and 0<=row['mode']<=0o7777
 if kind=='literal-symlink':
  assert type(row['targetHex']) is str;literal=bytes.fromhex(row['targetHex']);assert len(literal)==row['bytes'] and H(literal)==row['sha256']
 db.execute('INSERT INTO maprows VALUES(?,?,?,?)',(path,kind,row.get('sha256'),row.get('bytes')));mapCounts['rows']+=1
 if kind=='file':mapCounts['files']+=1
 elif kind=='literal-symlink':mapCounts['symlinks']+=1
 else:raise RuntimeError('C7_MAP_UNKNOWN_ROW_KIND '+kind)
def mapPair(key,digest,size):
 assert type(digest) is str and len(digest)==64 and all(c in '0123456789abcdef' for c in digest) and type(size) is int and size>=0 and size<=index['maxObjectBytes'];contents[digest]=size
mapReader=Reader(mapChunks(),valueLimit=index['mapDecodedBytes']);mapMetadata=mapReader.top(arrayKeys=('files',),objectKeys=('contents',),item=mapItem,pair=mapPair);db.commit()
assert mapCounts['rows']==148325 and mapCounts['symlinks']==30 and len(contents)==index['uniqueContents']
for kind,digest,size in db.execute('SELECT kind,sha,bytes FROM maprows'):
 if kind=='file':assert type(size) is int and size>=0 and digest in contents and contents[digest]==size
mapMetrics={'counts':mapCounts,'maxValueBytes':mapReader.maxValueBytes,'peakBufferBytes':mapReader.peakBuffer,'SQLiteCacheKiB':2048,'metadata':mapMetadata};db.close()
def decodedChunks():
 decoder=zlib.decompressobj(31);total=0
 for r in index['archiveParts']:
  encoded=readImmutableBacking(A/r['path'],r['sha256']);assert len(encoded)==r['bytes'];pending=encoded
  while pending:
   out=decoder.decompress(pending,1048576);pending=decoder.unconsumed_tail;total+=len(out)
   if total>index['archiveDecodedBytes']:raise RuntimeError('C7_ARCHIVE_DECODE_CAP')
   if out:yield out
 out=decoder.flush();total+=len(out)
 if out:yield out
 assert decoder.eof and not decoder.unused_data and total==index['archiveDecodedBytes']
chunks=iter(decodedChunks());buffer=bytearray()
def take(n):
 while len(buffer)<n:buffer.extend(next(chunks))
 data=bytes(buffer[:n]);del buffer[:n];return data
seen=set()
for _ in range(index['uniqueContents']):
 fence();digest=take(64).decode('ascii');size=struct.unpack('>Q',take(8))[0];assert digest in contents and digest not in seen and contents[digest]==size and size<=index['maxObjectBytes'];seen.add(digest);h=hashlib.sha256();remaining=size
 while remaining:n=min(1048576,remaining);h.update(take(n));remaining-=n
 assert h.hexdigest()==digest
assert seen==set(contents)
try:next(chunks);raise RuntimeError('C7_ARCHIVE_TRAILING_BYTES')
except StopIteration:assert not buffer
transport={'kind':'READONLY_AUTHENTICATED_ORIGINAL8_LOSSLESS_BYTE_ARCHIVE_NO_PHYSICAL_IDENTITY_CERTIFICATION','indexPath':str(A/'index.json'),'indexSHA256':H(indexBytes),'archiveMembersVerified':len(seen),'archiveDecodedBytes':index['archiveDecodedBytes']}
historical=loads(read(OT/'historical-plan-index.json'))
historyMetrics={}
for command,ref in historical['perId'].items():
 source=Path(ref['path']);sourcePin=observe(source,ref['sha256']);fd=os.open(source,os.O_RDONLY|os.O_NOFOLLOW);initial=os.fstat(fd);assert ident(initial)==sourcePin['identity'];digest=hashlib.sha256();readSize=0;rowCount=0;rowBytes=0
 target=T/source.name;output=target.open('wb');output.write(b'{"rows":[')
 def chunksHistory():
  global readSize
  while chunk:=os.read(fd,65536):digest.update(chunk);readSize+=len(chunk);yield chunk
 def historyRow(key,row):
  global rowCount,rowBytes
  fence();assert type(row) is dict
  if row['kind']=='EXACT_OLD_GUARD_NEGATIVE_HISTORY_FIXTURE':
   # Content expectation comes exclusively from its sealed retained raw backing.
   # Current source metadata is observed separately; no current source-byte
   # certification or historical inode custody is inferred from backing bytes.
   backing=OT/'consumed-prebytes'/(row['sha256']+'.raw');assert str(backing) in sealRows;raw=readImmutableBacking(backing,row['sha256']);assert len(raw)==row['bytes']
   p=Path(row['path']);s=os.lstat(p);fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
   try:
    a=os.fstat(fd);assert stat.S_ISREG(a.st_mode) and a.st_nlink==1 and a.st_size==row['bytes'] and ident(a)==ident(s)==ident(os.fstat(fd))==ident(os.lstat(p));row['identity']=ident(a)
   finally:os.close(fd)
   row['observation']='PROSPECTIVE_EXACT_SOURCE_METADATA_ONLY_CONTENT_EXPECTATION_FROM_SEPARATE_C6_RETAINED_RAW_BACKING';row['beforeByteBacking']={**cleanrow(observe(backing,row['sha256'])),'encoding':'RAW_EXACT_PREIMAGE','sealedC6RootSHA256':'451993ad4dfad8b6c30d22e8ddc637eab2efe18b86f8ce18e0625baf9b00038b','historicalIdentityStatus':'PRECISION_LIMITED_NOT_RETROACTIVELY_CERTIFIED'}
  else:
   current=observe(row['path'],row['sha256']);row.update(current)
   if row['sha256'] in contents:row['beforeByteBacking']={**transport,'objectSHA256':row['sha256'],'objectBytes':row['bytes']}
   else:
    backing=OT/'consumed-prebytes'/(row['sha256']+'.raw');assert str(backing) in sealRows;raw=readImmutableBacking(backing,row['sha256']);assert len(raw)==row['bytes'];row['beforeByteBacking']={**cleanrow(observe(backing,row['sha256'])),'encoding':'RAW_EXACT_PREIMAGE','sealedC6RootSHA256':'451993ad4dfad8b6c30d22e8ddc637eab2efe18b86f8ce18e0625baf9b00038b','historicalIdentityStatus':'PRECISION_LIMITED_NOT_RETROACTIVELY_CERTIFIED'}
  if rowCount:output.write(b',')
  output.write(json.dumps(row,separators=(',',':')).encode());rowCount+=1;rowBytes+=row['bytes']
 try:
  parser=Reader(chunksHistory(),valueLimit=sourcePin['bytes']);metadata=parser.top(arrayKeys=('rows',),item=historyRow)
  assert ident(initial)==ident(os.fstat(fd))==ident(os.lstat(source)) and readSize==sourcePin['bytes'] and digest.hexdigest()==ref['sha256']
  assert rowCount==ref['rows'] and rowBytes==ref['historicalBytes']
  output.write(b']')
  for key,value in metadata.items():output.write(b','+json.dumps(key).encode()+b':'+json.dumps(value,separators=(',',':')).encode())
  output.write(b'}\n');output.flush();os.fsync(output.fileno())
 finally:os.close(fd);output.close()
 new=observe(target,archive=True);ref.update(path=new['path'],bytes=new['bytes'],sha256=new['sha256'],identity=new['identity']);historyMetrics[command]={'rows':rowCount,'rowBytes':rowBytes,'maxValueBytes':parser.maxValueBytes,'peakBufferBytes':parser.peakBuffer}
put(T/'historical-plan-index.json',historical)
put(T/'original-read-map.json',read(OT/'original-read-map.json'))
# Source selectors are mechanically re-rooted and their physical source pins
# observed anew. Original byte bodies and AST call coordinates stay unchanged.
rules=loads(namespace(read(OW/'finite-producer-rules.json')))
for recipe in rules['perId'].values():
 for call in recipe['calls']:
  if Path(call['producer']).name=='external-review-executor.mjs':call['line']+=1
  producer=observe(call['producer'],archive=True);call['producerSHA256']=producer['sha256'];call['producerIdentity']=producer['identity']
  for source in call['sources']:source.update(observe(source['path'],archive=True))
put(W/'finite-producer-rules.json',rules)
for name in ['parent-source-recipes.json','finite-selector-lineage.json','original122-route-bindings.json']:
 put(W/name,namespace(read(OW/name)))
inputs=loads(read(OW/'prepared-source-inputs.json'));fresh=[]
for row in inputs['files']:
 p=Path(renamed(row['path']));current=observe(p,archive=True);fresh.append(current)
put(W/'prepared-source-inputs.json',{'files':fresh,'identityObservation':'PROSPECTIVE_CURRENT_C7_NOT_RETROACTIVE_C6_CUSTODY'})
result={'utcPRE':started,'utcPOST':utc(),'elapsedSeconds':time.monotonic()-began,'deadlineSeconds':120,'mirrorRows':len(lineage['inputs']),'packageRows':len(graph['files']),'historicalRows':{k:v['rows'] for k,v in historical['perId'].items()},'transport':transport,'mapMetrics':mapMetrics,'historyMetrics':historyMetrics,'peakRSSKiB':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,'C6References':references,'resourcePRE':resourcePRE,'resourcePOST':{k:Path('/sys/fs/cgroup/'+k).read_text() for k in ['memory.current','memory.stat','memory.events']},'original122':'HELD','originalWhole120':'UNEXECUTED_HELD','historicalIncidents':'BROKEN_IRREPARABLE_NOT_ADOPTED','rootApproval':'NOT_CREATED'}
put(B/'rebind-result.json',result);print(json.dumps({k:v for k,v in result.items() if k not in ['C6References','resourcePRE','resourcePOST']}))
