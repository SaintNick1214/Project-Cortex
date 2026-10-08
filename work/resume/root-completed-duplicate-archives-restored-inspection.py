from pathlib import Path
import os,stat,gzip,hashlib,json,datetime
R=Path('/workspace/Project-Cortex');P=Path('/tmp/cortex-root-storage-rescue');Q=R/'_goals/convex-backend-runtime-2026-10-02/qa'
names=['root-completed-isolated-indexes-12-29.tar.gz','root-completed-isolated-indexes-30-31.tar.gz','root-completed-transfer-plans-12-32.tar.gz','root-completed-tree-payloads-26-29-32.tar.gz']
K=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def identity(s):return {k:getattr(s,'st_'+k) for k in K}
def digest(p,decode=False):
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  s=os.fstat(fd);assert stat.S_ISREG(s.st_mode) and s.st_uid==os.getuid() and s.st_nlink==1
  h=hashlib.sha256();n=0
  with os.fdopen(os.dup(fd),'rb') as f:
   source=gzip.GzipFile(fileobj=f,mode='rb') if decode else f
   while True:
    b=source.read(1048576)
    if not b:break
    h.update(b);n+=len(b)
   if decode:source.close()
  assert identity(s)==identity(os.fstat(fd))==identity(os.lstat(p))
  return {'bytes':n,'sha256':h.hexdigest(),'identity':identity(s)}
 finally:os.close(fd)

rows=json.loads((Q/'root-completed-duplicate-archives-cleanup.json').read_text())['rows']
events=[json.loads(s) for s in (Q/'root-completed-duplicate-archives-unlink-events.jsonl').read_text().splitlines()]
assert len(rows)==len(events)==4
for r,e in zip(rows,events):
 assert not os.path.lexists(r['removedCompletedDuplicate']) and e['originalPath']==r['removedCompletedDuplicate'] and e['retainedCanonical']==r['retainedCanonical'] and e['status']=='UNLINK_COMPLETE_CANONICAL_UNCHANGED'
 assert digest(r['retainedCanonical'])==r['canonical'] and digest(r['retainedCanonical'],True)==r['decodedCanonical']
out={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'ROOT_RESTORED_DUPLICATE_CLEANUP_FULL_CONTENT_AND_EVENTS_VERIFIED','files':4,'tmpBytesFreed':sum(r['original']['bytes'] for r in rows),'allCanonicalEncodedAndDecodedBytesAnd9IdentitiesVerified':True,'oldPhysicalPathContinuity':'ENDS_AT_UNLINK','runtimeQualification':'NONE'}
with (Q/'root-completed-duplicate-archives-restored-inspection.json').open('x') as f:json.dump(out,f,indent=2);f.write('\n')
print(json.dumps(out))
