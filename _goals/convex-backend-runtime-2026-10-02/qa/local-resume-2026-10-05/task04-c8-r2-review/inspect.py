"""Independent read-only r2 content judge tooling; stdlib only, no subject evaluation."""
import argparse, ast, base64, collections, hashlib, io, json, os, platform, re, stat, struct, sys, tarfile, time, zlib
from pathlib import Path
ROOT=Path('/repair'); REPO=Path('/inputs/Project-Cortex'); CHUNK=1048576
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
SHA='2e55621b73fed30c608559d76f215b1f5ccf8cda72857d5122acb4ea9d7f79c6'
def ident(s):return {'schema':'FS_IDENTITY_DECIMAL_V1','fields':{k:str(getattr(s,'st_'+k)) for k in FIELDS}}
def capture(path,body=False):
 p=Path(path);before=os.lstat(p);assert stat.S_ISREG(before.st_mode) and before.st_nlink==1 and p.resolve()==p
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW);h=hashlib.sha256();n=0;parts=[]
 try:
  pre=ident(os.fstat(fd));assert pre==ident(before)
  while block:=os.read(fd,CHUNK):h.update(block);n+=len(block);parts.append(block) if body else None
  post=ident(os.fstat(fd));pp=ident(os.lstat(p));assert pre==post==pp and n==before.st_size
  proof={'path':str(p),'bytes':n,'sha256':h.hexdigest(),'PRE':pre,'POST':post,'pathPOST':pp}
  return (proof,b''.join(parts)) if body else proof
 finally:os.close(fd)
def pairs(items):
 out={}
 for k,v in items:
  assert k not in out,('duplicate',k);out[k]=v
 return out
def load(path):
 proof,raw=capture(path,True)
 if raw.startswith(b'\x1f\x8b'):
  d=zlib.decompressobj(31);raw=d.decompress(raw);assert d.eof and not d.unused_data and not d.unconsumed_tail
 return json.loads(raw,object_pairs_hook=pairs)
def resource():
 raw={n:Path('/sys/fs/cgroup',n).read_text() for n in ('memory.max','memory.current','memory.stat','memory.events')};mx=raw['memory.max'].strip();cu=raw['memory.current'].strip()
 assert mx.isdecimal() and cu.isdecimal() and int(mx)-int(cu)>=134217728
 assert platform.system()=='Linux' and platform.machine()=='x86_64' and sys.version_info[:2]==(3,12)
 v=os.statvfs(ROOT);mount=[s for s in Path('/proc/self/mountinfo').read_text().splitlines() if s.split()[4]=='/repair'];assert len(mount)==1 and 'ro' in mount[0].split()[5].split(',')
 return {'memory':raw,'reserveBytes':int(mx)-int(cu),'requiredReserveBytes':134217728,'diskAvailableBytes':v.f_bavail*v.f_frsize,'mountLine':mount[0]}
def seal():
 proof,raw=capture(ROOT/'final-linux-packet-manifest.json',True);assert proof['sha256']==SHA and proof['bytes']==1031477
 m=json.loads(raw,object_pairs_hook=pairs);assert len(m['files'])==697 and len(m['literalDirectories'])==66
 filepaths=set();dirpaths=set()
 for row in m['files']:
  assert row['path'] not in filepaths;filepaths.add(row['path']);assert capture(row['path'])==row
 for row in m['literalDirectories']:
  p=Path(row['path']);assert row['path'] not in dirpaths;dirpaths.add(row['path']);assert row['PRE']==row['POST']==ident(os.lstat(p));assert sorted(os.listdir(p))==row['members']
 actualfiles=set();actualdirs=set()
 for d,ds,fs in os.walk(ROOT,followlinks=False):
  actualdirs.add(d)
  for f in fs:actualfiles.add(str(Path(d)/f))
 assert actualdirs==dirpaths and actualfiles==filepaths|{str(ROOT/'final-linux-packet-manifest.json')}
 assert m['selfExcludedFile']==str(ROOT/'final-linux-packet-manifest.json') and m['ROOT']=='ABSENT' and not m['FULL8OrHIST70020Materialized'] and not m['candidateOrCompilerOrConsumerExecuted']
 return {'seal':proof,'files':697,'directories':66,'fileBytes':sum(r['bytes'] for r in m['files']),'literalCompleteWalk':True}
def core():
 c=load(ROOT/'attempt2/report/acquisition-contract.json');objs=load(ROOT/'attempt2/report/selected-object-baselines.json')['objects'];obj={r['sha256']:r for r in objs};assert len(obj)==489 and set(obj)==set(c['wanted']) and sum(r['bytes'] for r in objs)==33206385
 for h,r in obj.items():assert c['wanted'][h]==r['bytes'] and capture(r['path'])==r
 extra=c['mandatoryHistoricalObject'];assert extra['sha256']=='fcba3f917eef5557eb6c3d4ed360e236f2bd9dfc9745d689d541c885768c3c62' and extra['bytes']==13909295 and extra['sha256'] in obj
 positive=load(ROOT/'completion/positive-object-pin-equality.json');assert len(positive)==489
 for r in positive:assert r['existingPin']==r['freshHeldEquality']==capture(r['existingPin']['path'])
 failed=[]
 for p in (ROOT/'report/acquisition-receipt.json',ROOT/'attempt2/report/acquisition-receipt.json'):
  r=load(p);assert r['status']=='FAILED_PRESERVED_NO_IMPLICIT_REFRESH' and r['ownedToolsAndRuntimeEqual'] and r['ROOT']=='ABSENT' and r['original122']=='HELD';assert r['toolsPRE']==r['toolsPOST']
  assert r['interpreterPRE']==r['interpreterPOST'] and r['nodeBinaryPRE']==r['nodeBinaryPOST'];failed.append(r['primary'])
 assert failed[1]=={'type':'KeyError','message':"'bytes'"}
 assert failed[0]['message']=='REQUIRED_SOURCE_PLAN_NOT_PHYSICAL _goals/convex-backend-runtime-2026-10-02/qa/task04-model-drift-native-extension-preparation-c4/qa-manifest.json'
 aids=load(ROOT/'completion/finite-source-baselines.json');assert len(aids)==138
 for r in aids:
  own=r['freshOwnedLinuxBaseline'];transport=r['readOnlyTransport'];assert capture(own['path'])==own and own['bytes']==transport['bytes'] and own['sha256']==transport['sha256'] and not r['sourceImportedOrEvaluated']
 candidate=ROOT/'completion/source-aids/work/resume/task04-c8-prospective-preparation/candidate';assert len(list(candidate.iterdir()))==124
 stub=b'"""Administrative producer retired in this prospective candidate."""\nraise RuntimeError("QA_C8_ADMINISTRATIVE_WRITER_RETIRED")\n'
 for n in ('fork-c5.py','freeze-candidate.py'):assert capture(candidate/n,True)[1]==stub
 logical=c['logicalOriginalInputs'];assert len(logical)==823 and sum(r['bytes'] for r in logical.values())==18836975
 lineage=load(ROOT/'input-metadata/work/resume/task04-c7-exact-identity-repair/candidate/mirror-source-transform-map.json');assert len(lineage['inputs'])==823 and sum(r['legacyC6']['bytes'] for r in lineage['inputs'])==19047356
 for r in lineage['inputs']:
  key=r['source'].removeprefix('/workspace/Project-Cortex/');assert logical[key]=={'sha256':r['sha256'],'bytes':r['bytes']};assert obj[r['sha256']]['bytes']==r['bytes'] and obj[r['legacyC6']['sha256']]['bytes']==r['legacyC6']['bytes']
 commands=load(ROOT/'completion/source-aids/work/resume/task04-model-drift-native-preparation-c5/output-route-audit/proposed-closed-command-contract.json');assert len(commands['commands'])==122 and len({r['id'] for r in commands['commands']})==122
 cmdproof=capture(ROOT/'completion/source-aids/work/resume/task04-model-drift-native-preparation-c5/output-route-audit/proposed-closed-command-contract.json');assert cmdproof['sha256']=='4db94b3105073be227e2ac3ab461336e3927f3cffe17f901413ca3bf301445dd'
 gates=load(ROOT/'completion/original-gate-conservation.json');assert gates['commandIDs']==[r['id'] for r in commands['commands']] and gates['original122ByteExact']==cmdproof and gates['nativeMinimumMs']==20000 and gates['wholeDeadlineMs']==120000 and len(gates['eightNativeRecipeIDs'])==8 and gates['sourceTiers']=='ORIGINAL_FULL_RPC_UNCHANGED' and not gates['assertionsModified'] and gates['ROOTApproval']=='ABSENT'
 sem=load(ROOT/'completion/source-aids/work/resume/task04-c8-prospective-preparation/semantic-501-residual.json');assert len(sem['allOriginalSiteIDs'])==len(set(sem['allOriginalSiteIDs']))==501 and gates['allOriginalSiteIDs']==sem['allOriginalSiteIDs'] and sem['C7UnresolvedInterpretations']==gates['semanticResiduals']==301
 transportdir=ROOT/'attempt2/input-metadata/_goals/convex-backend-runtime-2026-10-02/qa/task04-evidence-transport-c4-c1';index=load(transportdir/'index.json');mp=transportdir/index['mapParts'][0]['path'];proof,encoded=capture(mp,True);d=zlib.decompressobj(31);raw=d.decompress(encoded);assert d.eof and not d.unused_data and not d.unconsumed_tail and hashlib.sha256(raw).hexdigest()==index['mapDecodedSha256'] and len(raw)==index['mapDecodedBytes'];mapping=json.loads(raw,object_pairs_hook=pairs)
 assert len(mapping['roots'])==8 and len(mapping['files'])==148325 and len({r['path'] for r in mapping['files']})==148325
 regular=[r for r in mapping['files'] if r['kind']=='file'];links=[r for r in mapping['files'] if r['kind']=='literal-symlink'];assert len(regular)==148295 and len(links)==30
 member={r['sha256']:r['bytes'] for r in regular};assert member==c['routes'][0]['members'] and len(member)==18995 and sum(member.values())==1215614313 and sum(r['bytes'] for r in regular)==3110990905
 for r in links:target=bytes.fromhex(r['targetHex']);assert hashlib.sha256(target).hexdigest()==r['sha256'] and ('bytes' not in r or len(target)==r['bytes'])
 full8=load(ROOT/'attempt2/report/full8-demand-and-coverage.json');assert full8['rows']==148325 and full8['regularPathBytes']==3110990905 and full8['missingRequiredContents']==0
 available={}
 for route in c['routes']:
  for h,n in route['members'].items():assert h not in available or available[h][1]==n;available[h]=(route['name'],n)
 history=load(ROOT/'attempt2/report/historical70020-coverage.json');assert history['rows']==70020 and history['regularPathBytes']==3001521619 and len(history['members'])==70020
 histrows={};existing=missing=0
 for r in history['members']:
  row=r['declared'];assert row['path'] not in histrows;histrows[row['path']]={k:row[k] for k in ('path','bytes','sha256')};cap=r['freshReadOnlyTransportCapture'];assert not r['historicalIdentityAdopted'] and r['missingPhysicalPath']==(cap is None)
  if cap:
   existing+=1;assert cap['bytes']==row['bytes'] and cap['sha256']==row['sha256'] and cap['PRE']==cap['POST']==cap['pathPOST']
  else:missing+=1;assert available[row['sha256']][1]==row['bytes'] and available[row['sha256']][0]==r['verifiedCatalogRoute']
 assert existing==history['currentlyByteValidPhysicalPaths']==59756 and missing==history['missingPhysicalPaths']==10264 and history['missingRequiredContents']==0 and sum(r['bytes'] for r in histrows.values())==3001521619
 # Derive every historical obligation again from exact declared manifests/full83.
 def data(relative,digest=None,size=None):
  physical=REPO/relative
  if physical.is_file() and not physical.is_symlink():proof,raw=capture(physical,True)
  else:
   digest=digest or logical[relative]['sha256'];proof,raw=capture(obj[digest]['path'],True)
  assert digest is None or proof['sha256']==digest;assert size is None or proof['bytes']==size
  return json.loads(raw,object_pairs_hook=pairs),proof
 derived={};manifestcount=0
 for kind in ('extension','regression','extra'):
  root='_goals/convex-backend-runtime-2026-10-02/qa/task04-model-drift-native-'+kind+'-preparation-c5/';key=root+'historical-preservation.json';pres,_=data(key,logical[key]['sha256'],logical[key]['bytes'])
  for packet in pres['packets']:
   p=packet['path']+'/'+packet['manifest'];body,proof=data(p,packet['manifestSHA256']);assert len(body['files'])==packet['rows'];rows=body['files'];manifestcount+=1;derived[p]={'path':p,'bytes':proof['bytes'],'sha256':proof['sha256']}
   if 'fullClosure' in packet:
    r=packet['fullClosure'];body,_=data(root+r['path'],r['sha256'],r['bytes']);rows=body['files'];assert len(rows)==r['rows']==83
   for row in rows:
    p=packet['path']+'/'+row['path'];value={'path':p,'bytes':row['bytes'],'sha256':row['sha256']};assert p not in derived or derived[p]==value;derived[p]=value
 assert derived==histrows and manifestcount==107
 pkgs=load(ROOT/'attempt2/report/seven-package-source-inventory.json')['packages'];lock=load(ROOT/'attempt2/input-metadata/package-lock.json');packagefiles={};expanded=encodedtotal=regularcount=0
 assert len(pkgs)==7
 for p in pkgs:
  definition=lock['packages']['node_modules/'+p['package']];assert p['resolved']==definition['resolved'] and p['resolved'].startswith('https://registry.npmjs.org/') and p['version']==definition['version'] and p['lockIntegrity']==definition['integrity'] and p['lockIntegrity'].startswith('sha512-')
  proof,raw=capture(p['archive']['path'],True);assert proof==p['archive'] and 'sha512-'+base64.b64encode(hashlib.sha512(raw).digest()).decode()==p['lockIntegrity'];dec=zlib.decompressobj(31);decoded=dec.decompress(raw);assert dec.eof and not dec.unused_data and not dec.unconsumed_tail and len(decoded)==p['gzipBoundary']['decodedBytes'] and hashlib.sha256(decoded).hexdigest()==p['gzipBoundary']['decodedSHA256']
  expected={r['path']:r for r in p['members']};seen={};count=0;metadata=None
  with tarfile.open(fileobj=io.BytesIO(decoded),mode='r:') as tape:
   for entry in tape:
    parts=Path(entry.name).parts;assert not Path(entry.name).is_absolute() and parts and all(v not in ('.','..') for v in parts) and entry.name not in seen and (entry.isfile() or entry.isdir());assert parts[0]==p['literalArchiveRoot']
    row={'path':entry.name,'bytes':entry.size,'mode':entry.mode,'type':'regular' if entry.isfile() else 'directory'}
    if entry.isfile():
     with tape.extractfile(entry) as stream:body=stream.read()
     assert len(body)==entry.size;row['sha256']=hashlib.sha256(body).hexdigest();count+=len(body);regularcount+=1;packagefiles['node_modules/'+p['package']+'/'+entry.name.removeprefix(p['literalArchiveRoot']+'/')]=row
     if len(parts)==2 and parts[1]=='package.json':metadata=json.loads(body,object_pairs_hook=pairs)
    assert row==expected[entry.name];seen[entry.name]=row
  assert seen==expected and count==p['expandedRegularBytes'] and metadata['name']==p['package'] and metadata['version']==p['version'];assert not p['installScriptsExecuted'] and not p['nativeBinaryExecuted'];expanded+=count;encodedtotal+=len(raw)
 assert expanded==76057286 and encodedtotal==17420689 and regularcount==3458
 pkgproof=load(ROOT/'completion/original-package-obligation-comparison.json');oldkey=pkgproof['originalSource'];old=load(obj[logical[oldkey]['sha256']]['path']);assert len(old['files'])==18
 for r in old['files']:assert packagefiles[r['path']]['sha256']==r['sha256'] and ('bytes' not in r or packagefiles[r['path']]['bytes']==r['bytes'])
 assert not pkgproof['packageHashConflicts'] and len(pkgproof['originalDeclaredPackageFiles'])==18 and pkgproof['compilerVersionsMatch']
 inspection=load(ROOT/'version-disposition/source-inspection.json');patterns={'exact24.19':r'24\.19\.0','versionFieldOrNodeVersion':r'\.versions|[\"\']versions[\"\']|[Nn]ode[Vv]ersion','versionProperty':r'\.version\b|[\"\']version[\"\']','toolchainMetadataRead':r'toolchain-evidence|parentDeclaredToolchain|QA_DECLARED_TOOLCHAIN|QA_TOOLCHAIN_DRIFT'};compiled={k:re.compile(v) for k,v in patterns.items()};matches=[];sourcecount=0;originalcount=0
 for src in inspection['sourceProofs']:
  proof,raw=capture(src['heldRead']['path'],True);assert proof==src['heldRead'];sourcecount+=1;originalcount+=src['sourceTier']=='ORIGINAL_OPERATIONAL_CONTENT'
  for n,line in enumerate(raw.decode().splitlines(),1):
   kinds=[k for k,p in compiled.items() if p.search(line)]
   if kinds:matches.append({'path':src['originalPath'],'sourceTier':src['sourceTier'],'line':n,'kinds':kinds,'text':line})
 assert sourcecount==854 and originalcount==741 and matches==inspection['matches'] and not any('exact24.19' in r['kinds'] for r in matches);assert old['versions']['node']=='v24.19.0'
 disposition=load(ROOT/'review-documents/runtime-version-disposition.json');assert not disposition['oldVersionMetadataRelabeledCurrent'] and not disposition['runtimeExecuted'] and disposition['sourceScan']['toolchainVersionsNodeConsumersFound']==0
 for row in disposition['exactRelevantConsumers']:assert row in matches
 assert not any(re.search(r'(?:toolchain|parentDeclaredToolchain|frozen|tools)\.versions(?:\?\.)?\.node',r['text']) for r in matches)
 demand=load(ROOT/'completion/next-phase-demand-accounting.json');subtotal=3110990905+3001521619+18836975+19047356+expanded;assert subtotal==6226454141==demand['nextPhysicalRegularSubtotalBytes']==demand['nextRAW_EXACT_PREIMAGEBytesForAllThoseSources'] and 2*subtotal==12452908282==demand['physicalPlusRawPrebytesSubtotalBytes'];assert demand['subjectRawAndReceiptCapacity']['admission'].startswith('HOLD_BEFORE_SUBJECT_DISPATCH')
 return {'selectedObjects':489,'selectedBytes':33206385,'sourceAids':138,'candidateCopies':124,'original122':122,'original823':823,'JS_TS':741,'FULL8':{'rows':148325,'regular':148295,'links':30,'pathBytes':3110990905,'objects':18995},'HIST70020':{'rows':70020,'bytes':3001521619,'actualValidReceiptRows':existing,'absentPhysicalWithBacking':missing,'derivedManifests':107,'missingContent':0},'packages':{'count':7,'lockedSHA512':True,'regularPaths':regularcount,'expandedBytes':expanded,'encodedBytes':encodedtotal,'originalPins':18},'versionSources':854,'versionMatches':len(matches),'exact24_19AssertionsFound':0,'historicalNodeMetadata':'v24.19.0','semanticSites':501,'semanticResiduals':301,'knownPhysicalPlusRawDemand':2*subtotal,'dispatchCapacity':'HELD','preservedFailures':failed}
def archives():
 c=load(ROOT/'attempt2/report/acquisition-contract.json');prior=load(ROOT/'attempt2/report/archive-stream-proofs.json');results=[]
 class Reader(io.RawIOBase):
  def __init__(self,route):self.route=route;self.gen=self.encoded();self.pending=b'';self.d=zlib.decompressobj(31);self.done=False;self.h=hashlib.sha256();self.n=0;self.eh=hashlib.sha256();self.en=0;self.partproofs=[]
  def readable(self):return True
  def encoded(self):
   for part in self.route['parts']:
    p=REPO/part['path'];before=os.lstat(p);fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW);pre=ident(os.fstat(fd));assert pre==ident(before);h=hashlib.sha256();n=0
    try:
     while b:=os.read(fd,CHUNK):h.update(b);self.eh.update(b);n+=len(b);self.en+=len(b);yield b
     post=ident(os.fstat(fd));pp=ident(os.lstat(p));assert pre==post==pp and h.hexdigest()==part['sha256'] and n==part['bytes'];self.partproofs.append({'path':str(p),'bytes':n,'sha256':h.hexdigest(),'PRE':pre,'POST':post,'pathPOST':pp})
    finally:os.close(fd)
  def read(self,n=-1):
   assert 0<=n<=CHUNK
   while not self.done:
    if not self.pending:
     try:self.pending=next(self.gen)
     except StopIteration:self.done=True;assert self.d.eof;return b''
    out=self.d.decompress(self.pending,n);self.pending=self.d.unconsumed_tail;assert not self.d.unused_data;self.h.update(out);self.n+=len(out);assert self.n<=self.route['decodedCap']
    if out:return out
   return b''
 def take(r,n):
  out=bytearray()
  while len(out)<n:
   b=r.read(min(CHUNK,n-len(out)));assert b;out.extend(b)
  return bytes(out)
 for route,receipt in zip(c['routes'],prior):
  pre=resource();r=Reader(route);seen=set();rawbytes=0;start=time.monotonic()
  def member(h,n,read):
   nonlocal rawbytes
   assert h not in seen and route['members'].get(h)==n;seen.add(h);digest=hashlib.sha256();left=n
   while left:
    b=read(min(CHUNK,left));assert b and len(b)<=left;digest.update(b);left-=len(b)
   assert digest.hexdigest()==h;rawbytes+=n
  if route['format']=='raw-sha-be64':
   for _ in range(len(route['members'])):h=take(r,64).decode('ascii');n=struct.unpack('>Q',take(r,8))[0];member(h,n,lambda n:take(r,n))
   assert not r.read(1)
  else:
   with tarfile.open(fileobj=r,mode='r|',bufsize=10240) as tape:
    for item in tape:
     assert item.isfile() and item.name.startswith('objects/') and len(item.name)==72
     with tape.extractfile(item) as stream:member(item.name[8:],item.size,stream.read)
   while r.read(CHUNK):pass
  assert seen==set(route['members']) and r.en==route['bytes']==receipt['encodedBytes'] and r.eh.hexdigest()==route['sha256']==receipt['encodedSHA256'] and r.n==receipt['decodedBytes'] and r.h.hexdigest()==receipt['decodedSHA256'];assert receipt['gzipEOFCRC'] and receipt['completeMemberHashes']
  results.append({'route':route['name'],'members':len(seen),'rawMemberBytes':rawbytes,'encodedBytes':r.en,'encodedHash':r.eh.hexdigest(),'decodedBytes':r.n,'decodedHash':r.h.hexdigest(),'gzipEOFCRC':True,'freshAll9Parts':r.partproofs,'resourcePRE':pre,'resourcePOST':resource(),'elapsedSeconds':time.monotonic()-start})
  print(json.dumps({'progress':route['name'],'members':len(seen),'elapsedSeconds':results[-1]['elapsedSeconds']}),file=sys.stderr,flush=True)
 assert len(results)==6 and sum(len(r['freshAll9Parts']) for r in results)==361
 return results
p=argparse.ArgumentParser();p.add_argument('--mode',choices=('core','archives'),required=True);args=p.parse_args();begin=time.monotonic();pre=resource();python=capture(Path(sys.executable).resolve());tool=capture(Path(__file__).resolve());s=seal();result=core() if args.mode=='core' else archives();assert python==capture(Path(sys.executable).resolve()) and tool==capture(Path(__file__).resolve());post=resource();s2=seal();assert s==s2
print(json.dumps({'status':'PASS_INDEPENDENT_READ_ONLY_'+args.mode.upper(),'scope':'BOUNDED_ACQUISITION_SOURCE_CONTENT_ONLY_NO_SUBJECT_RUNTIME_OR_ROOT_ACCEPTANCE','mode':args.mode,'seal':s,'result':result,'resourcePRE':pre,'resourcePOST':post,'currentReviewContainerPython':python,'reviewTool':tool,'elapsedSeconds':time.monotonic()-begin,'original122':'HELD','native20':'HELD','whole120':'HELD','ROOT':'ABSENT','volumeWrites':False,'subjectImportedOrEvaluated':False}))
