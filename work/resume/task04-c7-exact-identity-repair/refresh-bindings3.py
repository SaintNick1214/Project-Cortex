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
from raw_json_spans import identity_spans
oldSeal=loads(read(OW/'seal.json','7d4c0048114ca756d7cfe0ae42ed81e6fcfdec7237f780511b07a2b252f82606'))
oldMapRow=next(r for r in oldSeal['rows'] if r['path']=='mirror-source-transform-map.json');sealRows[str(OW/'mirror-source-transform-map.json')]=oldMapRow
oldBytes=read(OW/'mirror-source-transform-map.json',oldMapRow['sha256']);spans=identity_spans(oldBytes);oldReference=references[-1]
lineage=loads(read(W/'mirror-source-transform-map.json'));legacyAnnotations=[]
for n,row in enumerate(lineage['inputs']):
 prior=row.get('c6GeneratedMetadataVersion',{}).get('prior')
 if prior is not None:
  location='.inputs['+str(n)+'].c6GeneratedMetadataVersion.prior.identity';assert location in spans
  prior.pop('identity',None);prior['rawLegacyIdentityJSON']=spans[location];prior['identityStatus']='PRECISION_LIMITED_NOT_EXACT_AUTHORITY';prior['rawLegacyIdentitySource']={'path':oldReference['path'],'sha256':oldReference['sha256'],'bytes':oldReference['bytes'],'identity':oldReference['identity'],'beforeByteBacking':oldReference['beforeByteBacking'],'JSONLocation':location,'numericTokens':'EXACT_LITERAL_FORENSIC_TOKENS_NEVER_CONVERTED_TO_NUMBER'};legacyAnnotations.append(location)
assert len(legacyAnnotations)==6;put(W/'mirror-source-transform-map.json',lineage)
rules=loads(read(W/'finite-producer-rules.json'))
for recipe in rules['perId'].values():
 for call in recipe['calls']:
  producer=observe(call['producer'],archive=True);call['producerSHA256']=producer['sha256'];call['producerIdentity']=producer['identity']
  for source in call['sources']:source.update(observe(source['path'],archive=True))
put(W/'finite-producer-rules.json',rules)
inputs=loads(read(W/'prepared-source-inputs.json'));fresh=[]
for row in inputs['files']:fresh.append(observe(row['path'],archive=True))
put(W/'prepared-source-inputs.json',{'files':fresh,'identityObservation':'PROSPECTIVE_CURRENT_C7_NOT_RETROACTIVE_C6_CUSTODY'})
result={'utcPRE':started,'utcPOST':utc(),'elapsedSeconds':time.monotonic()-began,'deadlineSeconds':120,'preparedRows':len(fresh),'legacyAnnotations':legacyAnnotations,'sourceReferences':references,'peakRSSKiB':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,'resourcePRE':resourcePRE,'resourcePOST':{k:Path('/sys/fs/cgroup/'+k).read_text() for k in ['memory.current','memory.stat','memory.events']},'original122':'HELD','originalWhole120':'UNEXECUTED_HELD','rootApproval':'NOT_CREATED'}
put(B/'refresh-bindings-result.json',result);print(json.dumps({k:v for k,v in result.items() if k not in ['sourceReferences','resourcePRE','resourcePOST']}))
