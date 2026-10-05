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
rows=[]
for name in names:
 a=digest(P/name);b=digest(Q/name);assert (a['bytes'],a['sha256'])==(b['bytes'],b['sha256'])
 dec=digest(Q/name,True)
 rows.append({'removedCompletedDuplicate':str(P/name),'original':a,'retainedCanonical':str(Q/name),'canonical':b,'decodedCanonical':dec})
for row in rows:
 assert digest(row['removedCompletedDuplicate'])==row['original'] and digest(row['retainedCanonical'])==row['canonical']
out=Q/'root-completed-duplicate-archives-cleanup.json'
with out.open('x') as f:json.dump({'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'VERIFIED_COMPLETED_ROOT_TMP_DUPLICATES_READY_FOR_REMOVAL','rows':rows,'scope':'Four closed, unconsumed, unfrozen ROOT scratch duplicates only. Canonical repository archives remain byte-exact and full gzip EOF verified before any unlink. No frozen subject, actual source, Git object/index/ref or only-copy backing removed. Old tmp path identity ends at unlink; canonical content never becomes runtime FS/custody fallback.'},f,indent=2);f.write('\n')
for row in rows:
 assert digest(row['removedCompletedDuplicate'])==row['original'] and digest(row['retainedCanonical'])==row['canonical']
 os.unlink(row['removedCompletedDuplicate']);assert not os.path.lexists(row['removedCompletedDuplicate'])
 with (Q/'root-completed-duplicate-archives-unlink-events.jsonl').open('a') as f:json.dump({'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'originalPath':row['removedCompletedDuplicate'],'retainedCanonical':row['retainedCanonical'],'bytes':row['original']['bytes'],'sha256':row['original']['sha256'],'status':'UNLINK_COMPLETE_CANONICAL_UNCHANGED'},f);f.write('\n')
print(json.dumps({'status':'COMPLETE_VERIFIED_DUPLICATE_CLEANUP','files':len(rows),'tmpBytesFreed':sum(r['original']['bytes'] for r in rows)}))
