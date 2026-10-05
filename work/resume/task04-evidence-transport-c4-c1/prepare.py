import datetime,hashlib,importlib.util,json,os,shutil,stat,struct,zlib
from pathlib import Path
REPO=Path.cwd();Q=REPO/'_goals/convex-backend-runtime-2026-10-02/qa/task04-evidence-transport-c4-c1';S=REPO/'work/resume/task04-evidence-transport-c4-c1';T=Path('/tmp/cortex-evidence-transport-c4-c1')
spec=importlib.util.spec_from_file_location('transport',Q/'materialize.py');h=importlib.util.module_from_spec(spec);spec.loader.exec_module(h)
inv=json.loads((REPO/'_goals/convex-backend-runtime-2026-10-02/qa/task04-native-c4-root-transport-size-inventory.json').read_bytes());pins=inv['manifests']
for name,kind,pin,count in [('source','qa','f6b00a579905f0898ae60d3fff607e653bf1ad200b5f49946c64af2abb1d1652',17),('source','work','a9ef43a05de4b25a713eef6ddfcb6137cdea7e47fb6b07d59967f24429a01be7',4709),('parent','qa','d272d087eea1a19c6fb7bde2e38c674a89f9d4314d3cba9d6898b2225291a711',2009),('parent','work','1862d87f668a6dee35500a52c00bf01d3a05fd017a7ba8d6a0d92c9e6ceaf804',83)]:
 root=('_goals/convex-backend-runtime-2026-10-02/qa/' if kind=='qa' else 'work/resume/')+'task04-native-c4-'+name+'-fresh-review'
 pins.append({'root':root,'manifest':kind+'-manifest.json','sha256':pin,'rows':count,'manifestBytes':(REPO/root/(kind+'-manifest.json')).stat().st_size})
h.ROOTS=[p['root'] for p in pins];rows=[];contents={};first={};observations=[]
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def dump(path,value):path.write_text(json.dumps(value,indent=2)+'\n')
start=now()
for pin in pins:
 p=REPO/pin['root']/pin['manifest'];b=h.exactread(REPO,str(p.relative_to(REPO)),pin['manifestBytes'],pin['sha256']);m=json.loads(b)
 h.require(len(m['files'])==pin['rows'],'source row count mismatch')
 source_rows=m['files']+[{'path':pin['manifest'],'kind':'file','bytes':len(b),'sha256':pin['sha256']}]
 expected=set();rowstart=len(rows)
 for orig in source_rows:
  path=pin['root']+'/'+orig['path'];h.safe(path);h.require(path not in expected,'duplicate source path');expected.add(path)
  fd,n=h.parent(REPO,path)
  try:
   meta=os.stat(n,dir_fd=fd,follow_symlinks=False);kind=orig.get('kind','file')
   row={'path':path,'kind':kind,'mode':stat.S_IMODE(meta.st_mode),'bytes':orig.get('bytes'),'sha256':orig['sha256']}
   if kind=='literal-symlink':
    h.require(stat.S_ISLNK(meta.st_mode),'source link type');literal=os.readlink(os.fsencode(n),dir_fd=fd);h.require(literal==os.fsencode(orig['target']) and h.sha(literal)==orig['sha256'],'source literal mismatch');row['bytes']=len(literal);row['targetHex']=literal.hex()
   else:
    h.require(kind=='file' and stat.S_ISREG(meta.st_mode),'source file kind');data=h.exactread(REPO,path,row['bytes'],row['sha256'],row['mode'])
    key=row['sha256'];h.require(key not in contents or contents[key]==len(data),'hash-size collision');contents[key]=len(data);first.setdefault(key,row)
  finally:os.close(fd)
  rows.append(row)
 # exact terminal filelike set; do not follow any literal link, including broken negatives.
 actual=set()
 for dp,dns,fns in os.walk(REPO/pin['root'],followlinks=False):
  for n in list(dns):
   if (Path(dp)/n).is_symlink():actual.add(str((Path(dp)/n).relative_to(REPO)));dns.remove(n)
  for n in fns:actual.add(str((Path(dp)/n).relative_to(REPO)))
 h.require(actual==expected,'source full filelike set mismatch')
 observations.append({**pin,'verifiedFilelikeRowsIncludingManifest':len(source_rows),'regularBytes':sum(r['bytes'] for r in rows[rowstart:] if r['kind']=='file'),'literalLinks':sum(r['kind']=='literal-symlink' for r in rows[rowstart:]),'utcPOST':now(),'fullSelfOnly':True})
 print('SOURCE_PRE_VERIFIED',pin['root'],len(source_rows),flush=True)
dump(Q/'source-before.json',{'utcPRE':start,'utcPOST':now(),'status':'EXACT_WHOLE_BYTES_AND_LITERAL_LINKS_VERIFIED','observations':observations,'sourcePrebyteBacking':'Pinned immutable original manifest bytes and full closure rows; regular payload verified exact before pack; no original copies or target traversal','sourceAcceptance':False,'nativeAcceptance':False})
maxobject=max(contents.values());h.require(maxobject==49217478,'immutable max changed; do not silently widen')
m={'format':'cortex-c4-lossless-raw-sha-v1','roots':h.ROOTS,'manifestRows':sum(p['rows'] for p in pins),'literalLinks':sum(r['kind']=='literal-symlink' for r in rows),'files':rows,'contents':contents,'originalManifests':pins}
mapbytes=json.dumps(m,separators=(',',':'),ensure_ascii=True).encode();streamlimit=sum(contents.values())+72*len(contents)
class Sink:
 def __init__(self,name):self.name=name;self.z=zlib.compressobj(6,zlib.DEFLATED,31);self.buf=bytearray();self.parts=[];self.dir=T/name;self.dir.mkdir()
 def add(self,b):self.encoded(self.z.compress(b))
 def encoded(self,b):
  self.buf.extend(b)
  while len(self.buf)>=h.PART_LIMIT:self.part(bytes(self.buf[:h.PART_LIMIT]));del self.buf[:h.PART_LIMIT]
 def part(self,b):
  name='part-%05d.gzpart'%len(self.parts);p=self.dir/name
  with p.open('xb') as f:
   h.writeall(f.fileno(),b);os.fsync(f.fileno())
  h.require(p.stat().st_nlink==1 and p.stat().st_size==len(b) and h.sha(p.read_bytes())==h.sha(b),'part backing check')
  self.parts.append({'path':self.name+'/'+name,'bytes':len(b),'sha256':h.sha(b)})
 def finish(self):self.encoded(self.z.flush());self.part(bytes(self.buf)) if self.buf else None;return self.parts
archive=Sink('archiveParts')
for i,key in enumerate(sorted(contents)):
 row=first[key];data=h.exactread(REPO,row['path'],row['bytes'],key,row['mode']);archive.add(key.encode()+struct.pack('>Q',len(data)))
 for offset in range(0,len(data),1048576):archive.add(data[offset:offset+1048576])
 if i%1000==0:print('PACKED',i,len(contents),flush=True)
archiveparts=archive.finish();mapsink=Sink('mapParts')
for offset in range(0,len(mapbytes),1048576):mapsink.add(mapbytes[offset:offset+1048576])
mapparts=mapsink.finish();idx={'format':m['format'],'mapParts':mapparts,'archiveParts':archiveparts,'mapDecodedSha256':h.sha(mapbytes),'mapDecodedBytes':len(mapbytes),'archiveDecodedBytes':streamlimit,'uniqueContents':len(contents),'uniqueBytes':sum(contents.values()),'maxObjectBytes':maxobject,'sourcePins':pins,'transportOnly':True,'qualificationAcceptance':False}
ib=json.dumps(idx,indent=2).encode()+b'\n';(T/'index.json').write_bytes(ib)
helper=(Q/'materialize.py').read_bytes();(S/'helper-before-pins.py.text').write_bytes(helper)
helper=helper.replace(b"INDEX_SHA='UNBUILT'",("INDEX_SHA="+repr(h.sha(ib))).encode()).replace(b'MAP_LIMIT=0',('MAP_LIMIT='+str(len(mapbytes))).encode()).replace(b'STREAM_LIMIT=0',('STREAM_LIMIT='+str(streamlimit)).encode()).replace(b'INDEX_LIMIT=0',('INDEX_LIMIT='+str(len(ib))).encode()).replace(b'ROOTS=[]',('ROOTS='+repr(h.ROOTS)).encode())
(Q/'materialize.py').write_bytes(helper)
needed=sum(p['bytes'] for p in archiveparts+mapparts)+len(ib);free=shutil.disk_usage(Q).free;h.require(free>=needed+32*1024*1024,'overlay reserve insufficient; finalized parts remain OWN/tmp')
for name in ['archiveParts','mapParts']:shutil.copytree(T/name,Q/name)
shutil.copyfile(T/'index.json',Q/'index.json')
dump(Q/'pack-result.json',{'utcPOST':now(),'sourceRoots':len(pins),'originalManifestRows':m['manifestRows'],'restoredRowsIncludingManifests':len(rows),'literalLinks':m['literalLinks'],'maxObjectBytes':maxobject,'mapDecodedExactBytes':len(mapbytes),'archiveDecodedExactBytes':streamlimit,'uniqueContents':len(contents),'uniqueBytes':sum(contents.values()),'encodedParts':len(archiveparts)+len(mapparts),'encodedBytes':needed,'maxEncodedPartBytes':max(p['bytes'] for p in archiveparts+mapparts),'overlayFreeBeforeCopy':free,'indexSha256':h.sha(ib),'helperSha256':h.sha(helper),'status':'PACK_COMPLETE_TRANSPORT_ONLY'})
print(json.dumps({'packComplete':True,'rows':len(rows),'unique':len(contents),'encodedBytes':needed,'parts':len(archiveparts)+len(mapparts)}),flush=True)
