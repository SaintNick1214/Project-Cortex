import pathlib,json,os,stat,hashlib,base64,datetime,subprocess
R=pathlib.Path.cwd();root=pathlib.Path('/dev/shm/cortex-root-storage-rescue-c5/transfer42-encodings');assert root.resolve()==root
meta={}
for name in ['transfer42-binary-upload-meta.json','transfer42b-binary-upload-meta.json']:
 for r in json.loads((R/'work/resume'/name).read_text()):
  if r['file'] in meta:assert meta[r['file']]==r
  meta[r['file']]=r
assert len(meta)==142 and {str(p) for p in root.iterdir()}==set(meta)
fields=['st_dev','st_ino','st_mode','st_uid','st_gid','st_nlink','st_size','st_mtime_ns','st_ctime_ns']
ident=lambda s:{k:getattr(s,k) for k in fields}
def held(p):
 p=pathlib.Path(p);s=os.lstat(p);assert stat.S_ISREG(s.st_mode) and s.st_nlink==1 and s.st_uid==os.getuid();fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  assert ident(os.fstat(fd))==ident(s);out=[]
  while True:
   b=os.read(fd,1048576)
   if not b:break
   out.append(b)
  assert ident(os.fstat(fd))==ident(s)==ident(os.lstat(p))
 finally:os.close(fd)
 return b''.join(out),ident(s)
rows=[]
for file,r in sorted(meta.items()):
 p=pathlib.Path(file);assert p.parent==root;b,i=held(p);assert len(b)==r['characters'] and hashlib.sha256(b).hexdigest()==r['encodedSHA256'];raw=base64.b64decode(b,validate=True);assert base64.b64encode(raw)==b and len(raw)==r['rawBytes'] and hashlib.sha256(raw).hexdigest()==r['rawSHA256'];assert hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()==r['blob']
 sources=[]
 for source in r['sourcePaths']:
  v,si=held(source['sourcePath']);assert v==raw;sources.append({**source,'identity':si,'bytes':len(v),'sha256':hashlib.sha256(v).hexdigest()})
 rows.append({**r,'encodedIdentity':i,'canonicalSources':sources})
head=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip();index=hashlib.sha256((R/'.git/index').read_bytes()).hexdigest();assert head=='dee3308d351fb609b8a969fcd7f040fb0556e183' and index=='025561040ecad1721f1d57bd7aa54ca8dcc1750bfb460ca5ddaa7abc8af90249'
for r in rows:
 b,i=held(r['file']);assert i==r['encodedIdentity'] and hashlib.sha256(b).hexdigest()==r['encodedSHA256']
assert {str(p) for p in root.iterdir()}==set(meta)
receipt={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'ROOT_COMPLETED42_UPLOAD_ENCODING_CLEANUP_ONLY','rows':rows,'files':len(rows),'encodedBytesRemoved':sum(r['characters'] for r in rows),'allCanonicalDecodeSourceSHAAndGitBlobChecksBeforeAnyRemoval':True,'completedRemoteCommit':'04c50307cc4d84095487cdb3168af5b098e4b316','currentRemoteCommit':'5619c79df18cd0765d5f6ab0b6fbcb37934ff597','liveHead':head,'liveIndexSHA256':index,'canonicalPartsSourcesAndGitObjectsPreserved':True,'initialFailedOversizeEncoding':'Exact canonical decoded index remains; request failure and encoded SHA/size preserved, encoding reproducible with canonical base64. No failure erased.','oldEncodingInodeContinuity':'ENDS_AT_REMOVAL','runtimeAcceptance':False}
(R/'_goals/convex-backend-runtime-2026-10-02/qa/root-completed42-upload-encoding-cleanup.json').open('x').write(json.dumps(receipt,indent=2)+'\n')
for r in rows:pathlib.Path(r['file']).unlink()
assert not list(root.iterdir());assert hashlib.sha256((R/'.git/index').read_bytes()).hexdigest()==index;print(json.dumps({'removedFiles':len(rows),'removedBytes':receipt['encodedBytesRemoved'],'canonicalSourcesPreserved':True,'localIndexUnchanged':True}))
