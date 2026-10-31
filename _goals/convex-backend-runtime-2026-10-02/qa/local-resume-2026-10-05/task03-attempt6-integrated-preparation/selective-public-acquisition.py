from pathlib import Path
import os,stat,hashlib,json,time,uuid
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
Q5=R/'_goals/convex-backend-runtime-2026-10-02/qa/task03-local-native-attempt5-2026-10-06'
Q6=Q5.with_name('task03-local-native-attempt6-2026-10-06')
P=Q5.parent/'local-resume-2026-10-05/task03-attempt6-integrated-preparation'
FIELDS=('st_dev','st_ino','st_mode','st_uid','st_gid','st_nlink','st_size','st_mtime_ns','st_ctime_ns')
def identity(s):return {k:str(getattr(s,k)) for k in FIELDS}
def sha(b):return hashlib.sha256(b).hexdigest()
def write(p,b):
 p.parent.mkdir(mode=0o700,parents=True,exist_ok=True)
 fd=os.open(p,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
 try:
  view=memoryview(b)
  while view:n=os.write(fd,view);view=view[n:]
  os.fsync(fd)
 finally:os.close(fd)
def main():
 f=Q5/'candidate-freeze-attempt5.json'; raw=f.read_bytes();assert sha(raw)=='053e131a8f408031af7ead1e2c8c73f75954ba5acd905eac9e6091a24429e570'
 old=json.loads(raw);members=old['files'];assert len(members)==1905
 extras=[{'path':n,'sha256':sha((Q5/n).read_bytes()),'bytes':(Q5/n).stat().st_size} for n in old['mutableOfficialCodegenOnly']+['candidate-freeze-attempt5.json','independent-preparation-review.json']]
 assert len(extras)==7
 rows=[];total=0
 for row in members+extras:
  rel=Path(row['path']);assert not rel.is_absolute() and '..' not in rel.parts
  src=Q5/rel;dst=Q6/rel;before=os.lstat(src)
  assert stat.S_ISREG(before.st_mode) and before.st_nlink==1 and before.st_uid==501 and before.st_gid==20
  assert src.resolve()==src
  fd=os.open(src,os.O_RDONLY|os.O_NOFOLLOW)
  try:
   opened=os.fstat(fd);assert identity(before)==identity(opened)
   chunks=[];remain=row['bytes'];assert 0<=remain<=16*1024*1024
   while remain:
    b=os.read(fd,min(65536,remain));assert b;chunks.append(b);remain-=len(b)
   assert os.read(fd,1)==b'';b=b''.join(chunks);assert sha(b)==row['sha256']
   write(dst,b);os.chmod(dst,stat.S_IMODE(before.st_mode))
   post=os.fstat(fd);pathpost=os.lstat(src);assert identity(before)==identity(post)==identity(pathpost)
   ds=os.lstat(dst);assert ds.st_uid==501 and ds.st_gid==20 and ds.st_nlink==1 and stat.S_ISREG(ds.st_mode)
   rows.append({'path':str(rel),'sha256':sha(b),'bytes':len(b),'sourcePRE':identity(before),'sourceOPEN':identity(opened),'sourcePOST':identity(post),'sourcePathPOST':identity(pathpost),'newDestinationAtWrite':identity(ds),'fullEOF':True,'historicalFilesystemIdentityRestored':False})
   total+=len(b);assert total<=34*1024*1024
  finally:os.close(fd)
 receipt={'scope':'SELECTIVE_Q5_PUBLIC_BYTE_ACQUISITION_ONLY','status':'PASS_AT_COPY_TIME','sourceFrozenMembers':1905,'explicitGeneratedBaselines':5,'explicitPublicCompanions':2,'members':len(rows),'bytes':total,'ceilingBytes':34*1024*1024,'rows':rows,'archiveCopied':False,'originalCustodyRepaired':False,'privateReads':0,'externalEffects':0,'observedUnixNs':str(time.time_ns())}
 write(P/'selective-copy-receipt.json',(json.dumps(receipt,indent=2)+'\n').encode())
 print(json.dumps({k:receipt[k] for k in ('status','members','bytes','archiveCopied','privateReads')}))
if __name__=='__main__':main()
