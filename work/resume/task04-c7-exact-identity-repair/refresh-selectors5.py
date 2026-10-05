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
rules=loads(read(W/'finite-producer-rules.json'))

# Closed mechanical remapping only; failed/old selector coordinates remain retained.
oldseal=loads(read(OW/'seal.json', '7d4c0048114ca756d7cfe0ae42ed81e6fcfdec7237f780511b07a2b252f82606'))
def sealed_old(p):
 p=Path(p);row=next((r for r in oldseal['rows'] if str(OW/r.get('path',''))==str(p)),None)
 if row is None:raise RuntimeError('C7_OLD_SELECTOR_SOURCE_NOT_SEALED')
 data=read(p,row['sha256'])
 if len(data)!=row['bytes']:raise RuntimeError('C7_OLD_SELECTOR_SOURCE_SIZE')
 return data
oldrules=loads(sealed_old(OW/'finite-producer-rules.json'))['perId'];selectorProof=[]
selectorOldTPins={};wantedOldProducers={c['producer'] for r in oldrules.values() for c in r['calls']};sealPath=OT/'seal.json';sealPin=observe(sealPath,'451993ad4dfad8b6c30d22e8ddc637eab2efe18b86f8ce18e0625baf9b00038b');sealFD=os.open(sealPath,os.O_RDONLY|os.O_NOFOLLOW)
try:
 sealPRE=os.fstat(sealFD);sealHash=hashlib.sha256();sealBytes=0
 def selectorSealChunks():
  global sealBytes
  while block:=os.read(sealFD,65536):fence();sealHash.update(block);sealBytes+=len(block);yield block
 def selectorSealMember(key,row):
  full=str(OT/row['path'])
  if full in wantedOldProducers:selectorOldTPins[full]=row
 Reader(selectorSealChunks(),valueLimit=sealPRE.st_size).top(arrayKeys=('rows',),item=selectorSealMember)
 if sealHash.hexdigest()!=sealPin['sha256'] or sealBytes!=sealPin['bytes'] or ident(sealPRE)!=sealPin['identity'] or ident(sealPRE)!=ident(os.fstat(sealFD)) or ident(sealPRE)!=ident(sealPath.lstat()):raise RuntimeError('C7_SELECTOR_OT_SEAL_STREAM_BINDING')
finally:os.close(sealFD)
def mapped_line(text,producer):
 text=namespace(text.encode()).decode()
 if Path(producer).name=='external-review-executor.mjs':
  text=text.replace(r'\/tmp\/cortex-native-c6-independent-review-',r'\/dev\/shm\/cortex-native-c7-exact-identity-repair\/independent-review-').replace('JSON.parse','identity.parse')
 return text
def utf16_prefix(text,column):return text.encode('utf-16-le')[:2*(column-1)].decode('utf-16-le')
def utf16_column(text):return len(text.encode('utf-16-le'))//2+1
for command,recipe in rules['perId'].items():
 oldcalls=oldrules[command]['calls']
 if len(oldcalls)!=len(recipe['calls']):raise RuntimeError('C7_SELECTOR_MEMBERSHIP_DRIFT')
 for index,call in enumerate(recipe['calls']):
  old=oldcalls[index];oldpath=Path(old['producer'])
  if oldpath.is_relative_to(OW):oldbytes=sealed_old(oldpath)
  else:
   seal=selectorOldTPins.get(str(oldpath))
   if seal is None:raise RuntimeError('C7_SELECTOR_OT_SOURCE_NOT_SEALED')
   oldbytes=read(oldpath,seal['sha256'])
   if len(oldbytes)!=seal['bytes']:raise RuntimeError('C7_SELECTOR_OT_SOURCE_SIZE')
  oldline=oldbytes.decode().splitlines()[old['line']-1]
  current=read(call['producer']).decode().splitlines();mapped=mapped_line(oldline,call['producer']);matches=[n+1 for n,line in enumerate(current) if line==mapped]
  if len(matches)!=1:raise RuntimeError('C7_SELECTOR_MECHANICAL_LINE_AMBIGUOUS')
  expected={'line':matches[0],'columnStart':utf16_column(mapped_line(utf16_prefix(oldline,old['columnStart']),call['producer'])),'columnEnd':utf16_column(mapped_line(utf16_prefix(oldline,old['columnEnd']),call['producer']))}
  selectorProof.append({'command':command,'index':index,'before':{k:call[k] for k in expected},'after':expected,'kind':call['kind'],'argumentExpression':call['argumentExpression'],'mechanicalFullLineEqual':True})
  call.update(expected)
if len(selectorProof)!=246:raise RuntimeError('C7_SELECTOR_COUNT_246')

for recipe in rules['perId'].values():
 for call in recipe['calls']:
  producer=observe(call['producer'],archive=True);call['producerSHA256']=producer['sha256'];call['producerIdentity']=producer['identity']
  for source in call['sources']:source.update(observe(source['path'],archive=True))
put(W/'finite-producer-rules.json',rules)
inputs=loads(read(W/'prepared-source-inputs.json'));fresh=[]
for row in inputs['files']:fresh.append(observe(row['path'],archive=True))
put(W/'prepared-source-inputs.json',{'files':fresh,'identityObservation':'PROSPECTIVE_CURRENT_C7_NOT_RETROACTIVE_C6_CUSTODY'})
result={'utcPRE':started,'utcPOST':utc(),'elapsedSeconds':time.monotonic()-began,'deadlineSeconds':120,'selectorProof':selectorProof,'preparedRows':len(fresh),'sourceReferences':references,'peakRSSKiB':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,'resourcePRE':resourcePRE,'resourcePOST':{k:Path('/sys/fs/cgroup/'+k).read_text() for k in ['memory.current','memory.stat','memory.events']},'original122':'HELD','originalWhole120':'UNEXECUTED_HELD','rootApproval':'NOT_CREATED'}
put(B/'refresh-selectors5-result.json',result);print(json.dumps({k:v for k,v in result.items() if k not in ['sourceReferences','resourcePRE','resourcePOST']}))
