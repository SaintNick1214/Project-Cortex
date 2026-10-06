"""ROOT-authorized future selective key transfer. Import/parse performs no private access."""
from pathlib import Path
import hashlib,json,os,stat,time
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
QA=R/'_goals/convex-backend-runtime-2026-10-02/qa';P=QA/'local-resume-2026-10-05/task03-attempt6-integrated-preparation'
OLD=Path('/Users/SaintNick/.codex/tmp/cortex-runtime-task03-attempt5-private-20261006/jwt-private.pem')
NEW=Path('/Users/SaintNick/.codex/tmp/cortex-runtime-task03-attempt6-private-20261006')
KEY_SHA='05043519a0211079f376b702e5bd9497e5fec18e2562e1a3da0ece67a54c2451'
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def identity(s):return {k:str(getattr(s,'st_'+k))for k in FIELDS}
def owned_file(s):assert stat.S_ISREG(s.st_mode)and s.st_uid==501 and s.st_gid==20 and s.st_nlink==1 and stat.S_IMODE(s.st_mode)==0o600 and 0<s.st_size<=65536

def main():
 # This separate public authorization record is parent-authored only after source review.
 from importlib.util import spec_from_file_location,module_from_spec
 path=QA/'task03-local-native-attempt6-2026-10-06/integrated/source-gates.py';spec=spec_from_file_location('key_source_gate',path);G=module_from_spec(spec);spec.loader.exec_module(G)
 approval,approval_sha,mfsha=G.qualify_sources();binding=G.strict(G.read(P/'prospective-binding.json'))
 auth=G.strict(G.read(P/'private-key-reuse-authorization.json'))
 assert set(auth)=={'operation','authorizedByRoot','sourceApprovalSha256','sourceManifestSha256','purpose'}
 assert auth['operation']==binding['operation']and auth['authorizedByRoot']is True and auth['sourceApprovalSha256']==approval_sha and auth['sourceManifestSha256']==mfsha and auth['purpose']=='EXACT_SINGLE_REUSED_KEY_FRESH_PROSPECTIVE_CUSTODY'
 assert os.getuid()==501 and os.getgid()==20
 # First private stat happens only after the explicit ROOT authorization and independent source gate above.
 assert OLD.resolve(strict=True)==OLD
 pre=os.lstat(OLD);owned_file(pre);src=os.open(OLD,os.O_RDONLY|os.O_NOFOLLOW);dst=None
 try:
  assert identity(pre)==identity(os.fstat(src));raw=bytearray()
  while block:=os.read(src,4096):raw.extend(block);assert len(raw)<=pre.st_size
  assert len(raw)==pre.st_size and hashlib.sha256(raw).hexdigest()==KEY_SHA
  assert identity(pre)==identity(os.fstat(src))==identity(os.lstat(OLD))
  assert not NEW.exists();os.mkdir(NEW,0o700);assert NEW.resolve()==NEW
  directory=os.lstat(NEW);assert directory.st_uid==501 and directory.st_gid==20 and stat.S_IMODE(directory.st_mode)==0o700
  dst=os.open(NEW/'jwt-private.pem',os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
  data=memoryview(raw)
  while data:written=os.write(dst,data);assert written>0;data=data[written:]
  os.fsync(dst);newpin=identity(os.fstat(dst));owned_file(os.fstat(dst))
  assert newpin==identity(os.lstat(NEW/'jwt-private.pem'))
  assert identity(pre)==identity(os.fstat(src))==identity(os.lstat(OLD))
  fd=os.open(NEW,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
  try:os.fsync(fd)
  finally:os.close(fd)
  receipt={'scope':'ONE_REUSED_KEY_COPY_PROSPECTIVE_CUSTODY_ONLY','operation':binding['operation'],'status':'COPY_TIME_NINE_PASS_CURRENT_CRYPTO_REQUALIFICATION_REQUIRED','originalGenerationTime':'2026-10-06T08:34:05.422Z','keyReused':True,'sourcePRE':identity(pre),'sourcePOST':identity(os.fstat(src)),'destinationAtWrite':newpin,'keySha256':KEY_SHA,'bytes':len(raw),'privateBytesPrinted':False,'environmentOrTargetCopied':False,'serviceCalls':0,'historicalCustodyRepaired':False,'observedUnixNs':str(time.time_ns())}
  fd=os.open(P/'key-reuse-copy-receipt.json',os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
  with os.fdopen(fd,'w')as f:json.dump(receipt,f,indent=2);f.write('\n');f.flush();os.fsync(f.fileno())
 finally:
  if dst is not None:os.close(dst)
  os.close(src)
if __name__=='__main__':main()
