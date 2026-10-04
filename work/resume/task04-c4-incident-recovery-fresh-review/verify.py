from pathlib import Path
import os, stat, json, hashlib, tarfile, datetime, sys, gzip
B=Path('/workspace/Project-Cortex')
C=B/'work/resume/task04-model-drift-native-preparation-c4'
M=Path('/tmp/cortex-evidence-transport-c4-c1/clean-checkout')/C.relative_to(B)
Q=B/'_goals/convex-backend-runtime-2026-10-02/qa/task04-c4-incident-recovery-fresh-review'
R=B/'_goals/convex-backend-runtime-2026-10-02/qa/task04-c4-namespace-incident-root-recovery'
utc=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
sha=lambda b:hashlib.sha256(b).hexdigest()
def identity(s):return [s.st_dev,s.st_ino,s.st_mode,s.st_nlink,s.st_size,s.st_mtime_ns,s.st_ctime_ns]
def read(p):
 s=p.lstat();assert stat.S_ISREG(s.st_mode),str(p)
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  assert identity(s)==identity(os.fstat(fd)),str(p)
  chunks=[]
  while True:
   b=os.read(fd,1048576)
   if not b:break
   chunks.append(b)
  assert identity(s)==identity(os.fstat(fd)),str(p)
  return b''.join(chunks),s
 finally:os.close(fd)
def filelikes(root):
 out=set();stack=[root]
 while stack:
  p=stack.pop()
  for e in os.scandir(p):
   if e.is_dir(follow_symlinks=False):stack.append(Path(e.path))
   else:out.add(str(Path(e.path).relative_to(root)))
 return out
started=utc();mb,ms=read(C/'work-manifest.json');d=json.loads(mb)
assert sha(mb)=='0e3575cdb2978556896a4fa41e78a370d417d2b3352367717ad0a274b81e1901'
assert d['excludeONLY']=='work-manifest.json'
rows=d['files'];expected={r['path']:r for r in rows};assert len(rows)==len(expected)==133251
assert filelikes(C)==set(expected)|{'work-manifest.json'}
pre={};hardlinks=[];literal=0;total_bytes=0
for rel,r in expected.items():
 p=C/rel;s=p.lstat();pre[rel]=identity(s)
 if r['kind']=='literal-symlink':
  assert stat.S_ISLNK(s.st_mode),rel
  target=os.readlink(p);assert target==r['target'] and sha(os.fsencode(target))==r['sha256'],rel
  literal+=1
 else:
  assert r['kind']=='file',rel
  b,s=read(p);assert len(b)==r['bytes'] and sha(b)==r['sha256'],rel
  total_bytes+=len(b)
  if s.st_nlink>1:
   mirror,sm=read(M/rel);assert mirror==b and stat.S_IMODE(sm.st_mode)==stat.S_IMODE(s.st_mode),rel
   hardlinks.append({'path':rel,'current':identity(s),'mirror':identity(sm),'sha256':sha(b)})
assert literal==30
before=json.loads((R/'source-before.json').read_bytes());after=json.loads((R/'recovery-receipt.json').read_bytes())
handoff=json.loads((B/'work/resume/task04-model-drift-native-preparation-c5/incident-hold/incident-handoff.json').read_bytes())
incident_path=B/handoff['incidentMap'];ib,_=read(incident_path);incident=json.loads(ib)
assert sha(ib)==before['incidentMapSha256']
added={a['path']:a for a in incident['added']};assert len(added)==750 and not set(added)&set(expected)
overwritten={'extension/inventory-entry.ts','extension/inventory-bundle.mjs'}
sources={str(Path(s['path']).relative_to(C.relative_to(B))):s for s in before['sourceBefore']}
assert len(sources)==752 and set(sources)==set(added)|overwritten
ab,ars=read(R/'incident-bytes.tar.gz');assert sha(ab)==after['archive']['sha256'] and len(ab)==after['archive']['bytes']
with tarfile.open(R/'incident-bytes.tar.gz','r:gz') as t:
 members=t.getmembers();assert len(members)==752 and len({m.name for m in members})==752 and {m.name for m in members}==set(sources)
 for m in members:
  s=sources[m.name];assert m.isfile() and m.mode==s['mode']
  b=t.extractfile(m).read();assert len(b)==s['bytes'] and sha(b)==s['sha256']
  assert int(m.mtime)==s['mtime_ns']//1000000000
  if m.name in added:assert len(b)==added[m.name]['bytes'] and sha(b)==added[m.name]['sha256']
restored=[]
for rel in overwritten:
 b,s=read(C/rel);original,sm=read(M/rel);assert b==original
 assert stat.S_IMODE(s.st_mode)==stat.S_IMODE(sm.st_mode)==0o600
 old=sources[rel];assert (s.st_dev,s.st_ino,s.st_nlink)==(old['dev'],old['inode'],1)
 retained=next(x for x in handoff['overwrittenBytes'] if x['source']==str((C/rel).relative_to(B)))
 rb,_=read(B/retained['preserved']);assert sha(rb)==retained['sha256']==old['sha256'] and len(rb)==retained['bytes']==old['bytes']
 restored.append({'path':rel,'sha256':sha(b),'current':identity(s),'mirror':identity(sm),'archivedIncidentSha256':old['sha256']})
assert len(after['actions'])==752
removals=[x for x in after['actions'] if x['operation']=='remove-only-archived-manifest-absent-incident-addition']
assert len(removals)==750
assert {str(Path(x['before']['path']).relative_to(C.relative_to(B))) for x in removals}==set(added)
for a in removals:assert a['before']==sources[str(Path(a['before']['path']).relative_to(C.relative_to(B)))]
for rel in added:assert not os.path.lexists(C/rel)
commands=[]
for c in handoff['commands']:
 raw,_=read(B/c['receipt']);assert sha(raw)==c['sha256']
 rc=json.loads(gzip.decompress(raw));assert rc==c['receiptContent']
 command={k:rc[k] for k in ['argv','cwd','startedAt','observedAt','elapsedMs','exitCode','scope','native']}
 command['receipt']=c['receipt'];command['receiptSha256']=sha(raw)
 command['preRows']=len(rc['sourceBefore']);command['postRows']=len(rc['sourceAfter'])
 command['captureGap']='Receipt inventory may omit unauthorized C4 scratch paths: scope string is not proof of full namespace pre/post custody.'
 command['rawVerified']={}
 for channel,v in rc['raw'].items():
  raw_bytes,_=read(B/c['archive']/v['path']);decoded=gzip.decompress(raw_bytes)
  assert sha(raw_bytes)==v['encodedSHA256'] and sha(decoded)==v['sha256'] and len(decoded)==v['bytes']
  command['rawVerified'][channel]={k:v[k] for k in ['path','bytes','sha256','encodedSHA256','encoding']}
 commands.append(command)
assert filelikes(C)==set(expected)|{'work-manifest.json'}
for rel,i in pre.items():assert identity((C/rel).lstat())==i,rel
assert read(C/'work-manifest.json')[0]==mb
result={'status':'PASS_RECOVERY_ONLY','argv':[sys.executable,*sys.argv],'cwd':str(B),'startedAt':started,'observedAt':utc(),'originalManifestSha256':sha(mb),'fullFilelikeCountIncludingSelf':len(expected)+1,'manifestRows':len(rows),'regularFiles':len(rows)-literal,'literalSymlinks':literal,'regularBytesRead':total_bytes,'prePostIdentitiesStable':len(pre),'selfOnlyExactSet':True,'archiveMembersVerified':len(members),'archiveSha256':sha(ab),'incidentAdditionsAbsent':len(added),'restored':restored,'hardlinkFixtures':hardlinks,'commands':commands,'limits':['No original inode/mtime/ctime recovery or custody continuity claim.','Recovery is not C4 native preparation acceptance or C5 acceptance.','Read-only source content audit can update access times; access times are excluded from identity stability.','Earlier context inspection output was truncated and wrong qa shorthand returned missing path; canonical goal QA subsequently read and independently verified.','No full historical preincident inode metadata was provided for untouched fixtures; current negative hardlinks and mirror byte/mode agreement establish current content, not historical metadata continuity.']}
(Q/'verification.json').write_text(json.dumps(result,indent=2)+'\n')
with gzip.open(Q/'source-pre-post-identities.json.gz','wt') as f:json.dump({'captureStartedAt':started,'completedAt':result['observedAt'],'fields':['dev','inode','mode','nlink','bytes','mtime_ns','ctime_ns'],'pre':pre,'postExactlyEqualsPre':True,'excluded':'work-manifest.json independently byte-pinned'},f)
print(json.dumps({k:v for k,v in result.items() if k not in ['restored','hardlinkFixtures','commands','limits']}))
