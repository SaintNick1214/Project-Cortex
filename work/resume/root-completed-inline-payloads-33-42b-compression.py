from pathlib import Path
import os,stat,gzip,hashlib,json,datetime
R=Path('/workspace/Project-Cortex');P=Path('/tmp/cortex-root-storage-rescue');D=Path('/dev/shm/cortex-root-storage-rescue-c5/completed-inline-payloads-33-42b')
D.mkdir(mode=0o700)
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
for p in sorted(P.glob('connector-transfer-*-inlinebatch-*.json')):
 assert p.parent==P and p.name.split('-')[2] in {str(n) for n in range(33,42)}|{'42b'}
 before=digest(p);out=D/(p.name+'.gz')
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  assert identity(os.fstat(fd))==before['identity']
  with os.fdopen(os.dup(fd),'rb') as source,open(out,'xb') as dest:
   with gzip.GzipFile(filename='',fileobj=dest,mode='wb',compresslevel=6,mtime=0) as z:
    while True:
     b=source.read(1048576)
     if not b:break
     z.write(b)
   dest.flush();os.fsync(dest.fileno())
  assert identity(os.fstat(fd))==before['identity']==identity(os.lstat(p))
 finally:os.close(fd)
 encoded=digest(out);decoded=digest(out,True)
 assert (decoded['bytes'],decoded['sha256'])==(before['bytes'],before['sha256'])
 rows.append({'originalPath':str(p),'original':before,'backingPath':str(out),'encoded':encoded,'decoded':decoded})
assert len(rows)==24
for r in rows:
 assert digest(r['originalPath'])==r['original'] and digest(r['backingPath'])==r['encoded']
 assert (digest(r['backingPath'],True)['bytes'],digest(r['backingPath'],True)['sha256'])==(r['original']['bytes'],r['original']['sha256'])
index=D/'index.json'
index.write_text(json.dumps({'status':'CONTENT_ONLY_COMPLETED_ROOT_UPLOAD_PAYLOADS','rows':rows,'scope':'Previously delivered closed ROOT-owned scratch only; no source, frozen subject, original, Git object/index/ref or active payload. Old physical path identity ends at unlink; gzip is content backing only.'},indent=2)+'\n')
for r in rows:
 assert digest(r['originalPath'])==r['original'];os.unlink(r['originalPath']);assert not os.path.lexists(r['originalPath'])
result={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'LOSSLESS_COMPLETED_ROOT_SCRATCH_COMPRESSION','files':len(rows),'originalBytes':sum(r['original']['bytes'] for r in rows),'encodedBytes':sum(r['encoded']['bytes'] for r in rows),'index':str(index),'indexObserved':digest(index),'allBackingsDecodedBeforeAnyUnlink':True,'originalInodeContinuity':'ENDS_AT_UNLINK','runtimeQualification':'NONE'}
with (R/'_goals/convex-backend-runtime-2026-10-02/qa/root-completed-inline-payloads-33-42b-compression.json').open('x') as f:json.dump(result,f,indent=2);f.write('\n')
print(json.dumps(result))
