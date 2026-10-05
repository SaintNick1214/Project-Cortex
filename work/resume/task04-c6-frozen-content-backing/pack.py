from pathlib import Path
import os,stat,json,hashlib,gzip,tarfile,io,datetime,zlib,sys
R=Path('/workspace/Project-Cortex');B=R/'_goals/convex-backend-runtime-2026-10-02/qa';Q=B/'task04-c6-frozen-content-backing';W=R/'work/resume/task04-c6-frozen-content-backing';T=Path('/dev/shm/cortex-root-c6-frozen-content-backing');P=Path('/dev/shm/cortex-root-c5-fresh-review-content-backing')
H=lambda b:hashlib.sha256(b).hexdigest()
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def ident(s):return {k:getattr(s,'st_'+k) for k in ['dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns']}
def held(p):
 p=Path(p);s=p.lstat();assert stat.S_ISREG(s.st_mode) and s.st_nlink==1,(str(p),'regular single-link required');f=os.fdopen(os.open(p,os.O_RDONLY|os.O_NOFOLLOW),'rb');assert ident(s)==ident(os.fstat(f.fileno()));return f,s
def read(p,retain=False,estimate=False):
 f,s=held(p);h=hashlib.sha256();chunks=[];z=zlib.compressobj(3,wbits=31) if estimate else None;n=0
 with f:
  for b in iter(lambda:f.read(1048576),b''):
   h.update(b)
   if retain:chunks.append(b)
   if z:n+=len(z.compress(b))
  if z:n+=len(z.flush())
  assert ident(s)==ident(os.fstat(f.fileno()))==ident(Path(p).lstat()),str(p)
 return h.hexdigest(),s,b''.join(chunks) if retain else n
def pin(p,h):
 a,s,b=read(p,True);assert a==h,(str(p),a,h);return b
def dump(p,x):
 with Path(p).open('x') as f:json.dump(x,f,separators=(',',':'));f.write('\n')
def paths(root):
 yield root
 for parent,dirs,files in os.walk(root,followlinks=False):
  for n in dirs+files:yield Path(parent)/n
  dirs[:]=[n for n in dirs if not (Path(parent)/n).is_symlink()]
def checkrow(p,row,hashbytes=True):
 s=p.lstat();assert ident(s)==row['identity'],(str(p),'identity')
 if row['kind']=='file':
  assert stat.S_ISREG(s.st_mode)
  if hashbytes:assert read(p)[0]==row['sha256']
 elif row['kind']=='directory':assert stat.S_ISDIR(s.st_mode) and sorted(os.listdir(p))==row['members']
 elif row['kind']=='symlink':assert stat.S_ISLNK(s.st_mode) and os.readlink(p)==row['target']
 else:raise AssertionError(row['kind'])
SOURCES=[(B/'task04-native-c6-closed-launcher-c6','seal.json','1e9a4dfc94509ccaeaeef9cf1de424e5dcaed57fa583bab5b9d43bc63775926a'),(R/'work/resume/task04-model-drift-native-preparation-c6/closed-launcher-c6','seal.json','7d4c0048114ca756d7cfe0ae42ed81e6fcfdec7237f780511b07a2b252f82606'),(Path('/dev/shm/cortex-native-c6-closed-launcher-c6'),'seal.json','451993ad4dfad8b6c30d22e8ddc637eab2efe18b86f8ce18e0625baf9b00038b'),(Path('/tmp/cortex-native-c6-independent-review-87eb6f28-3812-499b-ab08-09282d98678d'),'seal.json','2e976f8c3453e39bb09a77253761d187719a3d930a2a6809028bcc7e1fecc318'),(B/'task04-native-c6-capture-performance-source-aid','exact-files-sha256.json','a6ee1ea645d7ac856135715d294cb957fb84ead3470ac3133de09ce13e839f0c'),(R/'work/resume/task04-native-c6-capture-performance-source-aid','exact-files-sha256.json','3d6afec29d69ba6b3a198c5f479891a4593a4894c36d402806decd82ef29cb9a')]
def authenticate():
 receipt=json.loads(pin(B/'task04-c5-fresh-review-content-backing/pack-receipt.json','dummypin')) if False else json.loads(read(B/'task04-c5-fresh-review-content-backing/pack-receipt.json',True)[2])
 root=json.loads(read(B/'task04-c5-fresh-review-content-backing-root-inspection.json',True)[2]);assert root['everyDeltaObjectAndGzipEOFIndependentlyVerified']
 for k,n in [('index','index.json'),('unionCatalog','union-catalog.json')]:
  raw=pin(P/n,receipt[k]['decodedSHA256']);assert len(raw)==receipt[k]['decodedBytes'];enc=pin(P/(n.replace('.json','.transport.json.gz')),receipt[k]['transportSHA256']);assert gzip.decompress(enc)==raw
 idx=json.loads((P/'index.json').read_bytes());u=json.loads((P/'union-catalog.json').read_bytes());assert len(u['objects'])==29591
 prior=u['objects'];added=0
 for row in idx['objects']:
  h=row['sha256']
  if row['backing']=='delta':assert h not in prior;prior[h]={'bytes':row['bytes'],'backing':'task04-c5-fresh-review-content-backing'};added+=1
  else:assert prior[h]=={'bytes':row['bytes'],'backing':row['backing']}
 assert added==289 and len(prior)==29880
 old=json.loads(pin('/tmp/cortex-root-storage-rescue/c5-prior-content-catalog/catalog.json','0d5f75f77bea82d00b860491ba040b5af9c06b871304e7a798cc588d59715d38'))
 c5=json.loads(pin('/dev/shm/cortex-root-storage-rescue-c5/c5-delta-byte-backing/index.json','7965c514d83b60e5beb58e6119b63f350798f92476bb4d026afcd69644df2f59'))
 backings=old['backings']
 c5parts=[dict(r,sourcePath=str(Path('/dev/shm/cortex-root-storage-rescue-c5/c5-delta-byte-backing')/r['name'])) for r in c5['archive']['parts']]
 backings=backings+[{'indexPath':'/dev/shm/cortex-root-storage-rescue-c5/c5-delta-byte-backing/index.json','indexSHA256':'7965c514d83b60e5beb58e6119b63f350798f92476bb4d026afcd69644df2f59','parts':c5parts,'archiveSHA256':c5['archive']['sha256'],'archiveBytes':c5['archive']['bytes']},{'indexPath':str(P/'index.json'),'indexSHA256':receipt['index']['decodedSHA256'],'parts':[dict(r,sourcePath=str(P/r['name'])) for r in idx['archive']['parts']],'archiveSHA256':idx['archive']['sha256'],'archiveBytes':idx['archive']['bytes']}]
 for backing in backings:
  pin(backing['indexPath'],backing['indexSHA256']);a=hashlib.sha256();n=0
  for r in backing['parts']:
   p=Path(r['sourcePath']);f,s=held(p);h=hashlib.sha256();pn=0
   with f:
    for b in iter(lambda:f.read(1048576),b''):h.update(b);a.update(b);pn+=len(b);n+=len(b)
    assert ident(s)==ident(os.fstat(f.fileno()))==ident(p.lstat())
   assert h.hexdigest()==r['sha256'] and pn==r['bytes']
  assert a.hexdigest()==backing['archiveSHA256'] and n==backing['archiveBytes']
 return prior,{'receipt':receipt,'rootVerification':root,'backings':backings,'priorUnionObjects':29591,'freshIndexDeltaAdded':289,'reusableUnionObjects':29880}
def measure():
 prior,deps=authenticate();dump(T/'authenticated-prior-locators.json',deps);dump(T/'union-catalog.json',{'format':'AUTHENTICATED_PRIOR_UNION_PLUS_FRESH289_V1','objects':prior});objects={};checks=[];newEstimate=0;counts=0
 ledger=(T/'source-rows.jsonl').open('x')
 def register(p,h,n,estimate):
  nonlocal newEstimate
  if h in objects:assert objects[h]['bytes']==n;return
  if h in prior:assert prior[h]['bytes']==n
  else:newEstimate+=estimate
  objects[h]={'path':str(p),'bytes':n,'backing':prior[h]['backing'] if h in prior else 'delta','estimate':estimate if h not in prior else 0}
 for root,name,pinh in SOURCES:
  pre=now();raw=pin(root/name,pinh);packet=json.loads(raw);frozen=name=='seal.json';known={row['path']:row for row in (packet['rows'] if frozen else packet['files'])};assert not frozen or packet['root']==str(root) and packet['exclusion']=='ONLY_OWN_ROOT_seal.json'
  actual={str(p.relative_to(root)) for p in paths(root)};assert actual-({name})==set(known) if frozen else actual-{'.',name}-({str(p.relative_to(root)) for p in paths(root) if p.is_dir()})==set(known)
  nr=nb=links=0
  for p in sorted(paths(root),key=lambda p:str(p.relative_to(root))):
   rel=str(p.relative_to(root));s=p.lstat();row={'path':rel,'identity':ident(s)}
   if frozen and rel!=name:assert row['identity']==known[rel]['identity'],(str(p),'seal identity')
   if stat.S_ISREG(s.st_mode):
    h,s,estimate=read(p,estimate=True);row.update(kind='file',bytes=s.st_size,sha256=h);nr+=1;nb+=s.st_size
    if rel!=name:assert h==known[rel]['sha256'] and s.st_size==known[rel]['bytes']
    register(p,h,s.st_size,estimate)
   elif stat.S_ISDIR(s.st_mode):row.update(kind='directory',members=sorted(os.listdir(p)))
   elif stat.S_ISLNK(s.st_mode):row.update(kind='symlink',target=os.readlink(p));links+=1;assert row['target']==known[rel]['target']
   else:raise AssertionError(str(p))
   ledger.write(json.dumps({'root':str(root),'row':row},separators=(',',':'))+'\n');counts+=1
  assert actual=={str(p.relative_to(root)) for p in paths(root)}
  checks.append({'root':str(root),'manifestPath':str(root/name),'manifestSHA256':pinh,'originalKind':'FROZEN_LITERAL_DIRECTORY_IDENTITY_SEAL' if frozen else 'CONTENT_MANIFEST_ONLY_LATE_PROSPECTIVE_SNAPSHOT','utcPRE':pre,'utcPOST':now(),'sourceRowsIncludingOwnManifest':len(actual),'sourceSealRows':len(known) if frozen else None,'regularFiles':nr,'regularBytes':nb,'literalLinksNeverFollowed':links});print(json.dumps(checks[-1]),flush=True)
 ledger.close();dump(T/'objects.json',objects);dump(T/'source-checks.json',checks)
 report={'status':'MEASURED_BEFORE_LARGE_ALLOCATION','utc':now(),'sourceRows':counts,'uniqueObjects':len(objects),'reuse':sum(v['backing']!='delta' for v in objects.values()),'deltaObjects':sum(v['backing']=='delta' for v in objects.values()),'deltaRawBytes':sum(v['bytes'] for v in objects.values() if v['backing']=='delta'),'estimatedGzipBytesFromFullIndividualStreams':newEstimate,'cgroupMemoryCurrent':int(Path('/sys/fs/cgroup/memory.current').read_text()),'cgroupMemoryMax':int(Path('/sys/fs/cgroup/memory.max').read_text()),'encodedHardLimit':1073741824,'externalClosurePending':True};dump(Q/'measurement.json',report);print(json.dumps(report),flush=True)
if __name__=='__main__':measure()
