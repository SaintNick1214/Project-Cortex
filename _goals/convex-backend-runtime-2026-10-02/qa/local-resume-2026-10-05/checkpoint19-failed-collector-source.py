from pathlib import Path
import json,hashlib,os,stat,subprocess,datetime,re
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
QA=R/'_goals/convex-backend-runtime-2026-10-02/qa';P=QA/'local-resume-2026-10-05'
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
identity=lambda s:{k:str(getattr(s,'st_'+k))for k in FIELDS}
selected={}; external={}; packets=[]; errors=[]; held=[]
EXTERNAL_ALLOWED={Path('/Users/SaintNick/.codex/tmp')/n for n in ['cortex-task04-public-cli-20261006.py','cortex-task04-public-export-20261006.py','cortex-task04-public-parent-run-20261006.py']}
EXTERNAL_COPIED=set()
secrets=[json.loads(Path('/Users/SaintNick/.convex/config.json').read_bytes())['accessToken'].encode(),subprocess.run(['gh','auth','token'],capture_output=True,check=True).stdout.strip()]
assert len(secrets)==2 and all(secrets)
max_secret=max(map(len,secrets))
def include(path,expected=None,size=None):
 path=Path(path);assert path.is_absolute() and (path.is_relative_to(R) or path in EXTERNAL_ALLOWED)
 pre=path.lstat();assert stat.S_ISREG(pre.st_mode) and pre.st_nlink==1 and pre.st_size<=16777216,str(path)
 fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  assert identity(pre)==identity(os.fstat(fd));h=hashlib.sha256();n=0;carry=b''
  while b:=os.read(fd,65536):
   n+=len(b);h.update(b);scan=carry+b
   assert not any(secret in scan for secret in secrets),'Private token match in selected public file'
   assert not re.search(rb'(?m)^-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----$',scan),'Private PEM body in public selection'
   carry=scan[-max(max_secret,128):]
  assert n==pre.st_size and identity(pre)==identity(os.fstat(fd))==identity(path.lstat()),'CURRENT_EOF_NINE_FAIL:'+str(path)
 finally:os.close(fd)
 digest=h.hexdigest();assert expected is None or expected==digest,'BYTE_HASH_FAIL:'+str(path);assert size is None or size==n
 row={'sha256':digest,'bytes':n,'currentIdentityDecimal':identity(pre),'EOF':True,'historyRestored':False}
 rel=str(path.relative_to(R)) if path.is_relative_to(R) else str(path)
 allowed=path.is_relative_to(QA) or rel.startswith('work/resume/task04-c8-current-canonical-input-producers/source/') or rel.startswith('work/resume/task04-c8-current-canonical-input-producers/repair1/source/') or rel.startswith('work/resume/task04-c8-current-canonical-input-producers/repair1/proposal/') or rel in ['work/resume/task04-c8-current-canonical-input-producers/controls/run_controls.py','work/resume/task04-c8-current-canonical-input-producers/repair1/controls/run_controls.py'] or rel.startswith('work/resume/task04-c8-current-canonical-input-producers/linux-public-control-proposal/') or rel=='work/resume/task04-c8-current-canonical-input-producers/README.md'
 (selected if allowed else external)[rel]=row
 return path.read_bytes() if n<=1048576 else None

def packet(base,name,relative=False):
 path=base/name;raw=include(path);x=json.loads(raw if raw is not None else path.read_bytes());rows=x.get('files',x.get('reviewArtifacts',[])+x.get('currentReadReceipts',[]));assert rows and len(rows)<5000
 for row in rows:
  v=Path(row['path']);target=v if v.is_absolute() else (base/v if relative else R/v)
  raw_source=include(target,row['sha256'],row['bytes'])
  if target in EXTERNAL_ALLOWED and target not in EXTERNAL_COPIED:
   assert raw_source is not None
   backing=P/'checkpoint19-public-external-source-backings'/target.name;backing.parent.mkdir(mode=0o700,exist_ok=True)
   with backing.open('xb') as f:f.write(raw_source);f.flush();os.fsync(f.fileno())
   include(backing,row['sha256'],row['bytes']);EXTERNAL_COPIED.add(target)
 packets.append({'manifest':str(path.relative_to(R)),'rows':len(rows),'oldIdentityPins':'EVIDENCE_ONLY_NEVER_REFRESHED','claimedScope':'PUBLIC_BYTE_BACKING_CHECKPOINT_ONLY'})
 for q in sorted(base.iterdir()):
  if q.is_file():include(q)

packet(P/'task03-attempt5-private-source-repair2','prospective-4-receipt-manifest.json',True)
packet(P/'task03-attempt5-mount-translation-repair3','final-evidence-manifest.json')
packet(P/'task03-attempt5-repair3-current-source-review','final-evidence-manifest.json')
packet(P/'task03-attempt5-repair3-actual-public-custody-readiness-review','final-evidence-manifest.json')
packet(P/'task04-current-canonical-input-producers','packet-manifest.json')
packet(P/'task04-current-canonical-input-producers','closed-source-manifest.json')
packet(P/'task04-current-canonical-input-producers/repair1','manifest.json')
for sub,name in [('','finite-evidence-manifest.json'),('operational-supplement1','evidence-manifest.json'),('actual-outcome1','evidence-manifest.json'),('repair1-source-review','finite-evidence-manifest.json'),('repair1-current-source-review','finite-evidence-manifest.json'),('repair1-current-source-review2','finite-evidence-manifest.json'),('repair1-actual-outcome1','finite-evidence-manifest.json')]:
 packet(P/'task04-current-canonical-input-source-review'/sub,name)
# These are exact closed public namespaces, not archive/cohort regeneration.
folders=['task03-attempt5-private-repair2-operative-current-observation','task03-attempt5-private-source-repair3','task03-attempt5-public-repair2-prospective3','task03-attempt5-repair3-prospective-current','task03-current-daemon-inventory-20261006T1443','task04-current-producer-linux-public-run-r3','task04-current-producer-linux-public-repair1','task04-current-producer-repair1-parent-preparation','task04-current-producer-repair1-parent-driver-preparation','task04-current-producer-repair1-current-source-baseline1']
for name in folders:
 base=P/name;paths=[]
 for root,dirs,files in os.walk(base,followlinks=False):
  for d in dirs:assert not (Path(root)/d).is_symlink()
  for f in files:paths.append(Path(root)/f)
 assert len(paths)<1500,'finite namespace cap'
 for q in sorted(paths):include(q)
 packets.append({'closedPublicNamespace':str(base.relative_to(R)),'files':len(paths)})
q3=QA/'task03-local-native-attempt5-2026-10-06/coordinate-source/repair3'
paths=[]
for root,dirs,files in os.walk(q3,followlinks=False):
 for d in dirs:assert not (Path(root)/d).is_symlink()
 for f in files:paths.append(Path(root)/f)
assert len(paths)<128
for q in sorted(paths):include(q)
for name in ['task03-attempt5-parent-current-source-release-check.json','task03-attempt5-parent-wrapper-setup-failure.json','task03-attempt5-repair3-parent-current-source-release-check.json','task03-attempt5-repair3-parent-release-writer-failure-1.json','task03-attempt5-public-repair2-actual-failure-classification.json','task03-attempt5-repair3-shared-docker-hold.json','task04-current-producer-parent-packet-check1.json','task04-current-producer-parent-source-check1.json','checkpoint19-reader-setup-failure.json']:
 include(P/name)
# Required bookkeeping is updated by the coordinator only after all pertinent writers close.
for q in [QA/'execution-progress.md',QA/'outcome-matrix.md',P/'current-state.md']:include(q)
for rel,row in selected.items():assert identity((R/rel).lstat())==row['currentIdentityDecimal'],'FINAL_CURRENT_PATH_CHANGE:'+rel
receipt={'scope':'PUBLIC_GIT_BYTES_AND_SCOPED_FAILURE_HISTORY_ONLY','utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'packets':packets,'selectedFiles':len(selected),'selectedBytes':sum(x['bytes']for x in selected.values()),'externalOperativeReferences':external,'privateTokenPatternsChecked':2,'privatePEMHeaderScan':True,'task03PrivateScratchRead':False,'privateMatches':0,'noArchiveCopies':True,'excludedOnlyCopyArtifacts':['six original Mac failed fixture trees under W/controls','old142MB prospective preparation','soleNativeCI ZIP','retainedLinux archive volume','all private scratch'],'historicalFilesystemIdentityRestored':False,'historicalCustodyRepaired':False,'newSourceActivation':False,'Task03':'HELD','Task04':'OPEN','fullGoalComplete':False}
out=P/'checkpoint19-public-packet-verification.json';assert not out.exists();out.write_text(json.dumps(receipt,indent=2)+'\n');include(out)
# No Git operation is performed by this preparation script.
prefix=Path('/Users/SaintNick/.codex/tmp/cortex-runtime-checkpoint19')
prefix.with_name(prefix.name+'-files.json').write_text(json.dumps(sorted(selected),indent=2)+'\n')
prefix.with_name(prefix.name+'-pins.json').write_text(json.dumps(selected,indent=2)+'\n')
prefix.with_name(prefix.name+'-pathspec.nul').write_bytes(b'\0'.join(os.fsencode(n)for n in sorted(selected))+b'\0')
print(json.dumps({'selected':len(selected),'bytes':sum(x['bytes']for x in selected.values()),'externalRefs':len(external),'privateMatches':0,'GitEffects':False}))
