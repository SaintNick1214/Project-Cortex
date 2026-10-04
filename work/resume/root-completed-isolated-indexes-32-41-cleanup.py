from pathlib import Path
import hashlib,os,stat,gzip,json,datetime,re
R=Path('/workspace/Project-Cortex');T=Path('/tmp/cortex-root-storage-rescue');A=T/'completed-isolated-indexes-32-41';A.mkdir(mode=0o700,exist_ok=True)
H=lambda b:hashlib.sha256(b).hexdigest()
live=R/'.git/index';liveBefore=H(live.read_bytes())
def ident(s):return {k:getattr(s,'st_'+k) for k in ['dev','ino','mode','uid','nlink','size','mtime_ns','ctime_ns']}
rows=[]
paths=sorted(p for p in T.iterdir() if re.fullmatch(r'transfer-(?:3[2-9]|4[01])-[a-f0-9]{32}\.index',p.name))
assert len(paths)==12,len(paths)
for p in paths:
 s=p.lstat();assert stat.S_ISREG(s.st_mode) and s.st_nlink==1 and s.st_uid==os.getuid()
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  assert ident(os.fstat(fd))==ident(s);raw=os.read(fd,4);assert raw==b'DIRC';os.lseek(fd,0,0)
  digest=hashlib.sha256();size=0;out=A/(p.name+'.gz')
  with out.open('xb') as target:
   with gzip.GzipFile(fileobj=target,mode='wb',mtime=0) as z:
    while True:
     b=os.read(fd,1048576)
     if not b:break
     z.write(b);digest.update(b);size+=len(b)
   target.flush();os.fsync(target.fileno())
  assert ident(os.fstat(fd))==ident(s)==ident(p.lstat())
 finally:os.close(fd)
 decoded=hashlib.sha256();count=0
 with gzip.open(out,'rb') as z:
  while True:
   b=z.read(1048576)
   if not b:break
   decoded.update(b);count+=len(b)
 assert count==size==s.st_size and decoded.hexdigest()==digest.hexdigest()
 rows.append({'originalPath':str(p),'originalBytes':size,'originalSHA256':digest.hexdigest(),'originalIdentity':ident(s),'archivePath':str(out),'archiveBytes':out.stat().st_size,'archiveSHA256':H(out.read_bytes()),'decodedExactEqualityVerifiedBeforeAnyDeletion':True})
for r in rows:
 p=Path(r['originalPath']);assert ident(p.lstat())==r['originalIdentity'];assert H(p.read_bytes())==r['originalSHA256']
 p.unlink();r['removedCompletedScratchCopy']=True
assert H(live.read_bytes())==liveBefore
receipt={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'ROOT_COMPLETED_DISPOSABLE_GIT_INDEXES_ONLY','rows':rows,'reclaimedBytes':sum(r['originalBytes']-r['archiveBytes'] for r in rows),'liveIndexSHA256':liveBefore,'liveIndexUnchanged':True,'limitations':['Old deleted scratch inode continuity is not claimed.','These are completed isolated indexes, not live index, refs, source, failures or frozen packets.','Restore exact gzip-decoded bytes and verify recorded SHA before any future inspection requiring the old scratch path.']}
(R/'_goals/convex-backend-runtime-2026-10-02/qa/root-completed-isolated-indexes-32-41-cleanup.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({'files':len(rows),'reclaimedBytes':receipt['reclaimedBytes'],'liveIndexUnchanged':True}))
