"""ROOT-authorized future selective key transfer. Import/parse performs no private access."""
from pathlib import Path
import hashlib,json,os,stat,time,sys,types
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
QA=R/'_goals/convex-backend-runtime-2026-10-02/qa';P=QA/'local-resume-2026-10-05/task03-attempt6-integrated-preparation'
OLD=Path('/Users/SaintNick/.codex/tmp/cortex-runtime-task03-attempt5-private-20261006/jwt-private.pem')
NEW=Path('/Users/SaintNick/.codex/tmp/cortex-runtime-task03-attempt6-private-20261006')
KEY_SHA='05043519a0211079f376b702e5bd9497e5fec18e2562e1a3da0ece67a54c2451'
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def identity(s):return {k:str(getattr(s,'st_'+k))for k in FIELDS}
def owned_file(s):assert stat.S_ISREG(s.st_mode)and s.st_uid==501 and s.st_gid==20 and s.st_nlink==1 and stat.S_IMODE(s.st_mode)==0o600 and 0<s.st_size<=65536

APPROVAL=P/'integrated-source-review.json'
def strict_json(raw):
 def pairs(items):
  out={}
  for key,value in items:
   if key in out:raise ValueError('duplicate_source_bootstrap_key')
   out[key]=value
  return out
 return json.loads(raw,object_pairs_hook=pairs,parse_constant=lambda value:(_ for _ in ()).throw(ValueError('nonfinite_source_bootstrap')))
def load_module(name, path):
    # Compile ONLY verified held source bytes; never execute an unpinned .pyc.
    fields = ('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
    identify = lambda value: {key: str(getattr(value, 'st_'+key)) for key in fields}
    def held_read(source, pin=None):
        assert source.is_relative_to(R) and source.resolve() == source
        before = os.lstat(source)
        assert stat.S_ISREG(before.st_mode) and before.st_nlink == 1 and before.st_uid == 501 and before.st_gid == 20 and 0 <= before.st_size <= 16777216
        fd = os.open(source, os.O_RDONLY | os.O_NOFOLLOW)
        try:
            current = identify(before)
            assert current == identify(os.fstat(fd))
            if pin is not None: assert current == pin
            data = bytearray()
            while chunk := os.read(fd, 65536):
                data.extend(chunk); assert len(data) <= before.st_size
            assert len(data) == before.st_size
            assert current == identify(os.fstat(fd)) == identify(os.lstat(source))
            return bytes(data)
        finally: os.close(fd)
    approval = strict_json(held_read(APPROVAL))
    assert approval['scope'] == 'TASK03_ATTEMPT6_INTEGRATED_SOURCE_ONLY' and approval['verdict'] == 'PASS' and approval['independent'] is True
    mfraw = held_read(P/'operative-source-manifest.json')
    assert hashlib.sha256(mfraw).hexdigest() == approval['sourceManifestSha256']
    manifest = strict_json(mfraw)
    freeze_rows = [item for item in manifest['files'] if item['path'].endswith('/task03-local-native-attempt6-2026-10-06/candidate-freeze-attempt6.json')]
    assert len(freeze_rows) == 1 and approval['candidateSha256'] == freeze_rows[0]['sha256']
    found = [row for row in manifest['files'] if row['path'] == str(path.relative_to(R))]
    assert len(found) == 1
    row = found[0]; raw = held_read(path, row['PRE'])
    assert len(raw) == row['bytes'] and hashlib.sha256(raw).hexdigest() == row['sha256'] == approval['sources'][row['path']]
    module = types.ModuleType(name)
    module.__file__ = str(path); module.__package__ = ''
    exec(compile(raw, str(path), 'exec', dont_inherit=True), module.__dict__)
    return module

def main():
 # This separate public authorization record is parent-authored only after source review.
 assert sys.dont_write_bytecode is True, 'launch_with_python_B_required'
 path=QA/'task03-local-native-attempt6-2026-10-06/integrated/source-gates.py';G=load_module('key_source_gate',path)
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
