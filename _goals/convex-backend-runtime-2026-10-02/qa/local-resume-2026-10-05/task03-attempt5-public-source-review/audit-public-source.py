import ast,hashlib,json,os,stat
from pathlib import Path
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
Q=R/'_goals/convex-backend-runtime-2026-10-02/qa/task03-local-native-attempt5-2026-10-06'
S=Q/'coordinate-source';O=Path(__file__).resolve().parent
F=('st_dev','st_ino','st_mode','st_nlink','st_uid','st_gid','st_size','st_mtime_ns','st_ctime_ns')
identity=lambda s:{k:str(getattr(s,k)) for k in F}
rows={}
def read(p):
 p=Path(p);a=p.lstat();assert p.resolve(strict=True)==p and stat.S_ISREG(a.st_mode) and a.st_nlink==1
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  assert identity(a)==identity(os.fstat(fd));raw=b''
  while len(raw)<a.st_size:
   b=os.read(fd,min(65536,a.st_size-len(raw)));assert b;raw+=b
  assert not os.read(fd,1) and identity(a)==identity(os.fstat(fd))==identity(p.lstat())
 finally:os.close(fd)
 row={'path':str(p),'identityDecimal':identity(a),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}
 if str(p) in rows:assert rows[str(p)]==row
 rows[str(p)]=row;return raw
def obj(p):return json.loads(read(p))
def save(name,value):
 with (O/name).open('x') as f:json.dump(value,f,indent=2);f.write('\n');f.flush();os.fsync(f.fileno())
m=obj(S/'source-receipt-manifest.json');assert len(m['files'])==131
for row in m['files']:
 raw=read(S/row['path']);assert len(raw)==row['bytes'] and hashlib.sha256(raw).hexdigest()==row['sha256']
pre=O/'source-preimages';pre.mkdir(mode=0o700)
for name,h in m['sources'].items():
 raw=read(S/name);assert hashlib.sha256(raw).hexdigest()==h;ast.parse(raw,filename=name);(pre/(name+'.text')).write_bytes(raw)
for name in ['public-recipe-binding.json','source-report.md','source-receipt-manifest.json']:(pre/(name+'.text')).write_bytes(read(S/name))
b=obj(S/'public-recipe-binding.json');expected={'candidate':'/host_mnt'+str(Q),'helper':'/host_mnt'+str(S)}
assert b['preparationFreezeSha256']==m['preparationFreezeSha256']=='053e131a8f408031af7ead1e2c8c73f75954ba5acd905eac9e6091a24429e570'
assert b['preparationMembers']==m['preparationMembers']==1905 and b['publicCopiedFiles']==m['publicCopiedFiles']==1912
code=read(S/'task03-attempt5-public-coordinate.py').decode();assert "m['Source'] == '/host_mnt' + str(source)" in code
save('recipe-mount-binding-check.json',{'status':'PASS' if b['ownedSourceMounts']==expected else 'FAIL','actualBinding':b['ownedSourceMounts'],'expectedExactCanonicalDockerSources':expected,'coordinatorSourcePredicateCorrect':True,'actualDockerCalls':0,'sourceAndMetadataDifferent':b['ownedSourceMounts']!=expected})
linux=[]
for w,status in [('linux-window','FAIL'),('linux-window2','FAIL'),('linux-window3','PASS')]:
 p=Q/'attempt5'/w;r=obj(p/'result.json');assert r['status']==status
 for c in r['commands']:
  receipt=obj(p/(c['label']+'.receipt.json'));assert receipt==c
  for kind in ['stdout','stderr']:assert hashlib.sha256(read(p/(c['label']+'.'+kind))).hexdigest()==c[kind+'Sha256']
  assert c['terminal'] and not c['closeErrors'] and c['ownedGroup']['absenceObserved']
 assert read(p/'owned-final-container-absence.stdout').strip()==b''
 assert 'no such volume' in read(p/'owned-final-volume-absence.stderr').decode().lower()
 row={'window':w,'status':status,'outerReceipts':len(r['commands']),'physicalOwnedAbsenceReceiptsAudited':True,'actualCandidateTransfer':False,'innerCommonStderr':'UNKNOWN_UNAVAILABLE' if w=='linux-window2' else 'SEE_RAW','actualServices':0}
 if w=='linux-window3':
  assert len(r['commands'])==68 and len(list((p/'native-public-receipts').iterdir()))==46
  n=p/'native-public-receipts';a=obj(n/'source.stdout');assert a['count']==46
  common=obj(n/'common--controls.json');desc=obj(n/'descendant--controls.json')
  assert common['sourceSha256']==desc['sourceSha256']==m['sources']['task03-attempt5-coordinate-common.py']
  assert common['actualChildOutcomeControls']==9 and common['invalidBoundsRejectedBeforeSpawn']==4
  assert desc['actualExitedParentVariants']==2 and desc['injectedUnknownOwnershipControls']==1
  for stage in ['init','controls']:
   initial=obj(p/(stage+'-initial-inspect.stdout'))[0];terminal=obj(p/(stage+'-terminal-inspect.stdout'))[0]
   assert initial['Image']=='sha256:9ff43bfe7849197a6dfbaa80f2d11a34db4202d8aaae269ddc8b740f7da75fb3' and initial['HostConfig']['Memory']==initial['HostConfig']['MemorySwap']==536870912 and initial['HostConfig']['NetworkMode']=='none' and initial['HostConfig']['ReadonlyRootfs']
   assert not terminal['State']['Running'] and not terminal['State']['OOMKilled'] and terminal['State']['ExitCode']==0
  row.update(acquisitionControls=46,commonActual=9,commonBounds=4,actualDescendants=2,unknownSeam=1,nativeExportFiles=46,linuxScope='PUBLIC_DUMMY_ONLY_NOT_CURRENT_FUNCTIONAL_NATIVE')
 linux.append(row)
save('audited-linux-primitive-evidence.json',{'windows':linux,'reviewerDockerCalls':0,'priorFailuresRemainFailures':True,'unknownInnerDummy2StateNotReconstructed':True})
for p in list(rows):read(p)
save('source-bindings-final.json',{'files':list(rows.values()),'allNineDescriptorPathFullByteAndEOFReread':True,'sourceManifestMembers':131,'privateCredentialReads':0,'DockerCalls':0,'services':0})
print(json.dumps({'sourceAudit':'PASS','boundFiles':len(rows),'recipeMetadataBinding':'PASS' if b['ownedSourceMounts']==expected else 'FAIL','linux3RawAudited':True,'freshASTSources':5,'services':0}))
