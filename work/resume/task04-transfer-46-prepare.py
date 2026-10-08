import pathlib,os,stat,json,hashlib,datetime,subprocess
R=pathlib.Path('/workspace/Project-Cortex');W=R/'work/resume';Q=R/'_goals/convex-backend-runtime-2026-10-02/qa';BASE='9b1994206110306524e9cd5c64f022cff5b94065';PARENT='bd0b4dd71787faf4144023d7ded9afc077d59188'
F=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def ident(s):return {'schema':'FS_IDENTITY_DECIMAL_V1','fields':{k:str(getattr(s,'st_'+k)) for k in F}}
selection=[]
for name in ('task04-c7-exact-identity-repair','task04-c7-full-partial-review','task04-c7-identity-disposition-aid','task04-c7-identity-primitive-review','task04-c7-recorder-v4-review','task04-c7-recorder-v5-review','task04-c7-recorder-v6-review','task04-c7-partial-content-backing'):
 for root in (Q/name,W/name):
  if root.is_dir():selection.append(root)
for pattern in ('task04-c7*','connector-transfer-45-*','task04-c6-review-content-backing-temporary-root-selfseal.json','task04-c6-review-content-backing-supplemental-seal-routing.json','root-sparse-tree-expectation-replay-45.json'):
 selection.extend(p for p in Q.glob(pattern) if p.is_file())
selection.append(Q/'execution-progress.md')
for pattern in ('root-c7-*.py','root-sparse-tree-expectation.py','task04-transfer-46-*.py'):selection.extend(W.glob(pattern))
mapping=json.loads((W/'task04-c7-partial-content-backing/partial-virtual-source-mapping.json').read_text());mapping.update({str((Q/'task04-c7-partial-content-backing/preallocation-index.json.gz').relative_to(R)):'/dev/shm/cortex-root-c7-partial-content-backing/index.json.gz',str((Q/'task04-c7-partial-content-backing/temporary-root-seal-c7-content.json.gz').relative_to(R)):'/dev/shm/cortex-root-c7-partial-content-backing/seal-c7-content.json.gz',str((Q/'task04-c7-exact-identity-repair/temporary-root-seal-c7-partial.json.gz').relative_to(R)):'/dev/shm/cortex-native-c7-exact-identity-repair/seal-c7-partial.json.gz'});route=Q/'connector-transfer-46-content-routing.json';assert not route.exists();route.write_text(json.dumps({'scope':'EXACT_LOSSLESS_CONTENT_ONLY_NOT_CURRENT_PHYSICAL_RESTORATION','virtualSources':mapping,'completeC7Backing':False,'remoteEncoding':'5ASCII_BASE64_VERIFIED_PARTS_ONLY','missingRemoteParts':31,'localSpoolPreservedExcluded':True,'frozenSourcePacketsUnmodified':True},indent=2)+'\n');selection.append(route)
paths=set();omitted=[]
for p in selection:
 if p.is_dir():
  for parent,dirs,files in os.walk(p,followlinks=False):
   assert not any((pathlib.Path(parent)/d).is_symlink() for d in dirs)
   for n in files:
    source=pathlib.Path(parent)/n
    if '/task04-c7-partial-content-backing/spool/' in str(source):omitted.append({'path':str(source),'reason':'UNACKNOWLEDGED_RETAINED_LOCAL_ONLY_SPOOL_NOT_REMOTE_VERIFIED'});continue
    paths.add(source)
 else:assert p.is_file();paths.add(p)
paths.update(PathSource for PathSource in (pathlib.Path(x) for x in mapping.values()))
reverseMapping={str(pathlib.Path(source)):path for path,source in mapping.items()}
known={r['blob'] for r in json.loads((W/'connector-transfer-plan-45.json').read_text())['rows']}
rows=[]
for p in sorted(paths):
 a=os.lstat(p);assert stat.S_ISREG(a.st_mode) and a.st_nlink==1;fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  assert ident(os.fstat(fd))==ident(a);h=hashlib.sha256();g=hashlib.sha1(b'blob '+str(a.st_size).encode()+b'\0');size=0
  while b:=os.read(fd,262144):h.update(b);g.update(b);size+=len(b)
  assert size==a.st_size and ident(a)==ident(os.fstat(fd))==ident(os.lstat(p))
 finally:os.close(fd)
 rows.append({'path':reverseMapping.get(str(p),str(p.relative_to(R)) if p.is_relative_to(R) else None),'sourcePath':str(p),'mode':'100644','bytes':size,'sha256':h.hexdigest(),'blob':g.hexdigest(),'identity':ident(a),'existing':g.hexdigest() in known,'sourceKind':'CURRENT_HELD_LOCAL_BYTES'})
acks=[]
for p in sorted((W/'task04-c7-partial-content-backing/remote-acks').glob('*.json')):
 ack=json.loads(p.read_text());assert ack['schema']=='C7_REMOTE_PART_ACK_V2' and ack['immutableStoredContentCompared'] and ack['fetchedImmutableBlobBytesCompared'] and ack['uploadReturnedGitSHA']==ack['fetchGitSHA']==ack['storedGitBlobSHA'];acks.append(ack)
 rows.append({'path':ack['storedRepositoryPath'],'mode':'100644','bytes':ack['storedBytes'],'blob':ack['storedGitBlobSHA'],'existing':True,'sourceKind':'REMOTE_IMMUTABLE_VERIFIED_BASE64','ackPath':str(p),'encoding':'BASE64_ASCII_LOSSLESS','decodedPartBytes':ack['bytes'],'decodedPartSHA256':ack['sha256'],'identityMeaning':'NO_FABRICATED_CURRENT_LOCAL_RAW_IDENTITY'})
assert len({r['path'] for r in rows})==len(rows)
plan={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'head':PARENT,'tree':BASE,'localHead':subprocess.check_output(['git','rev-parse','HEAD'],cwd=R,text=True).strip(),'liveIndexSHA256':hashlib.sha256((R/'.git/index').read_bytes()).hexdigest(),'scope':'Frozen C7 PARTIAL exact identity source repair, fresh FULL REJECT2.8, static recorder reviews and ROOT verifications; incomplete five-part remote lossless transport; Task04 runtime/original122/whole120/ROOT gates remain held. No product acceptance or full backing completeness.','rows':rows,'omittedLocalSpools':omitted,'remoteParts':len(acks),'plannedParts':36,'completeC7ContentBacking':False}
p=W/'connector-transfer-plan-46.json';assert not p.exists();p.write_text(json.dumps(plan,indent=2)+'\n');(W/'task04-transfer-46-selection.json').write_text(json.dumps([str(p.relative_to(R)) for p in selection],indent=2)+'\n');print(json.dumps({'selectedPaths':len(rows),'newUniqueBlobs':len({r['blob'] for r in rows if not r['existing']}),'newUniqueBytes':sum(r['bytes'] for r in {r['blob']:r for r in rows if not r['existing']}.values()),'remoteParts':len(acks),'omittedSpools':len(omitted)}))
