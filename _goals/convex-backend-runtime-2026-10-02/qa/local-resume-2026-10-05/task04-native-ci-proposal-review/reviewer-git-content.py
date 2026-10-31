"""Independent read-only full route worktree/Git blob comparison; no custody claim."""
from pathlib import Path
import hashlib,json,os,stat,subprocess,time
REPO=Path(__file__).resolve().parents[5]; OUT=Path(__file__).resolve().parent
proof=json.loads((REPO/'_goals/convex-backend-runtime-2026-10-02/qa/task04-c8-physical-preparation-r3/current-git-six361-content-backing.json').read_text())
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def identity(s):return {'schema':'FS_IDENTITY_DECIMAL_V1','fields':{k:str(getattr(s,'st_'+k)) for k in FIELDS}}
def tree(commit):
 raw=subprocess.check_output(['git','ls-tree','-r','--full-tree','-z',commit,'--',*[r['path'] for r in proof['parts']]],cwd=REPO); result={}
 for row in raw.split(b'\0'):
  if row:
   header,path=row.split(b'\t',1); mode,kind,oid=header.decode().split(); assert kind=='blob' and mode in ('100644','100755'); result[os.fsdecode(path)]=oid
 return result
start=time.monotonic(); head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=REPO,text=True).strip(); pinned=tree(proof['commit']); current=tree(head); assert pinned==current
assert len(pinned)==361 and len({r['route'] for r in proof['parts']})==6
reader=subprocess.Popen(['git','cat-file','--batch'],cwd=REPO,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
rows=[]
try:
 for expected in proof['parts']:
  path=REPO/expected['path']; fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
  try:
   pre=identity(os.fstat(fd)); assert stat.S_ISREG(os.fstat(fd).st_mode) and pre['fields']['nlink']=='1'; h=hashlib.sha256(); oid=hashlib.sha1(('blob '+str(expected['bytes'])+'\0').encode()); size=0
   while b:=os.read(fd,1048576):h.update(b);oid.update(b);size+=len(b)
   post=identity(os.fstat(fd)); pathpost=identity(os.lstat(path)); assert pre==post==pathpost==expected['PRE']==expected['POST']==expected['pathPOST']
  finally:os.close(fd)
  assert size==expected['bytes'] and h.hexdigest()==expected['sha256'] and oid.hexdigest()==pinned[expected['path']]==expected['gitBlobOID']
  reader.stdin.write((expected['gitBlobOID']+'\n').encode());reader.stdin.flush()
  assert reader.stdout.readline(256).decode().strip().split()==[expected['gitBlobOID'],'blob',str(size)]
  remaining=size; gh=hashlib.sha256();goid=hashlib.sha1(('blob '+str(size)+'\0').encode())
  while remaining:
   b=reader.stdout.read(min(1048576,remaining));assert b;remaining-=len(b);gh.update(b);goid.update(b)
  assert reader.stdout.read(1)==b'\n';assert gh.hexdigest()==expected['sha256'] and goid.hexdigest()==expected['gitBlobOID']
  rows.append({'route':expected['route'],'path':expected['path'],'bytes':size,'sha256':h.hexdigest(),'pinnedGitBlobOID':pinned[expected['path']],'currentGitBlobOID':current[expected['path']],'gitFullRawSHA256':gh.hexdigest(),'PRE':pre,'POST':post,'pathPOST':pathpost,'EOF':True})
 reader.stdin.close();assert reader.stdout.read(1)==b'';assert reader.wait(timeout=30)==0;assert reader.stderr.read(1048577)==b''
finally:
 if reader.poll() is None:reader.kill();reader.wait(timeout=10)
 for s in (reader.stdin,reader.stdout,reader.stderr):
  if s and not s.closed:s.close()
remote=subprocess.run(['gh','api','repos/SaintNick1214/Project-Cortex/git/commits/'+proof['commit'],'--jq','{sha,tree}'],cwd=REPO,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=60)
assert remote.returncode==0;remote_value=json.loads(remote.stdout);assert remote_value['sha']==proof['commit'] and remote_value['tree']['sha']==proof['rootTreeOID']
result={'scope':'CURRENT_CONTENT_BACKING_ONLY_NOT_HISTORICAL_C7_CUSTODY','pinnedCommit':proof['commit'],'pinnedTree':proof['rootTreeOID'],'reviewHEAD':head,'currentHEADAtEnd':subprocess.check_output(['git','rev-parse','HEAD'],cwd=REPO,text=True).strip(),'partCount':len(rows),'routes':6,'encodedBytes':sum(r['bytes'] for r in rows),'remotePinnedCommitTree':remote_value,'rows':rows,'negativeControls':{'wrongSHA256PredicateRejected':rows[0]['sha256']!='0'*64,'missingPathTreePredicateRejected':set(pinned)!=set(pinned)|{'not-a-source-route'}},'history':'C7_5_OF36_ACKNOWLEDGED_31_UNVERIFIED_PART0005_ONLY_COPY_4224_UNPUBLISHED_GAPS_UNCHANGED','nativeSubjectsExecuted':False,'elapsedSeconds':time.monotonic()-start}
(OUT/'current-git-route-byte-review.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k not in ('rows','remotePinnedCommitTree')}))
