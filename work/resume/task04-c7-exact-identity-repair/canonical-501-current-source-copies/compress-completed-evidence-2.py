from fs_identity import fs_identity
from fs_identity import loads as authority_loads
from pathlib import Path
import os,stat,json,gzip,hashlib,uuid,datetime
T=Path('/dev/shm/cortex-native-c7-exact-identity-repair');assert not any('record-batch.py'in Path('/proc',n,'cmdline').read_bytes().decode(errors='replace') for n in os.listdir('/proc') if n.isdigit() and Path('/proc',n,'cmdline').exists() and int(n)!=os.getpid()),'LIVE_RECORDER'
I=authority_loads((T/'compression-inventory-2.json').read_bytes());D=T/'evidence-compression'/uuid.uuid4().hex;D.mkdir(parents=True,mode=0o700);index=D/'mapping.jsonl';identity=lambda s:fs_identity(s);utc=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat();total=0
for ordinal,r in enumerate(I['rows']):
 p=Path(r['path']);assert p.is_relative_to(T) and p.suffix in ['.json','.jsonl'];s=p.lstat();assert stat.S_ISREG(s.st_mode) and s.st_nlink==1 and identity(s)==r['identity'];fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW);target=D/(str(ordinal)+'.gz');h=hashlib.sha256();size=0
 try:
  assert identity(os.fstat(fd))==r['identity']
  with target.open('xb')as output:
   with gzip.GzipFile(fileobj=output,mode='wb',mtime=0)as z:
    while b:=os.read(fd,1048576):h.update(b);size+=len(b);z.write(b)
   output.flush();os.fsync(output.fileno())
  assert identity(os.fstat(fd))==r['identity']==identity(p.lstat());os.chmod(target,0o600)
 finally:os.close(fd)
 decoded=hashlib.sha256();decodedsize=0
 with gzip.open(target,'rb')as z:
  while b:=z.read(1048576):decoded.update(b);decodedsize+=len(b)
 assert decoded.hexdigest()==h.hexdigest() and decodedsize==size==r['bytes'];encoded=hashlib.sha256();targetIdentity=identity(target.lstat());assert target.lstat().st_uid==os.getuid()and target.lstat().st_nlink==1 and stat.S_ISREG(target.lstat().st_mode)and target.lstat().st_mode&0o777==0o600
 targetFD=os.open(target,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  assert identity(os.fstat(targetFD))==targetIdentity
  while b:=os.read(targetFD,1048576):encoded.update(b)
  assert identity(os.fstat(targetFD))==targetIdentity==identity(target.lstat())
 finally:os.close(targetFD)
 assert identity(p.lstat())==r['identity'];record={**r,'utcVerified':utc(),'decodedSHA256':h.hexdigest(),'decodedBytes':size,'backing':str(target),'encodedSHA256':encoded.hexdigest(),'encodedBytes':target.stat().st_size,'exactFullDecodeVerified':True,'backingIdentityBeforeUnlink':targetIdentity,'custody':'CONTENT_ONLY_OLD_INODE_ENDS_ON_UNLINK','authenticStatus':'PARTIAL_JSON_EXIT_MINUS9'if p.name=='receipt.json'and'whole-freeze-fixture-metadata-version-05'in str(p)else'COMPLETED_EVIDENCE_FORMAT_NOT_REPARSED'}
 with index.open('a')as f:f.write(json.dumps(record)+'\n');f.flush();os.fsync(f.fileno())
 p.unlink();total+=size-target.stat().st_size
summary={'utc':utc(),'index':str(index),'indexSHA256':hashlib.sha256(index.read_bytes()).hexdigest(),'count':len(I['rows']),'reclaimedBytes':total,'noOriginalFrozenSourceBackingAliasWrites':True};(T/'completed-evidence-compression-2.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary))
