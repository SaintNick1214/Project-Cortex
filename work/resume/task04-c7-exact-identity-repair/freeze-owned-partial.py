"""Streaming literal current-byte seals for owned PARTIAL evidence only."""
from pathlib import Path
import os,stat,json,gzip,hashlib,datetime,time
R=Path('/workspace/Project-Cortex');B=R/'work/resume/task04-c7-exact-identity-repair';Q=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-c7-exact-identity-repair';T=Path('/dev/shm/cortex-native-c7-exact-identity-repair')
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns');NAME='seal-c7-partial.json.gz';begin=time.monotonic();deadline=begin+120

def ident(s):return {'schema':'FS_IDENTITY_DECIMAL_V1','fields':{k:str(getattr(s,'st_'+k)) for k in FIELDS}}
def fence():
 if time.monotonic()>=deadline:raise TimeoutError('OWN_STATIC_SEAL_ONE_120_DEADLINE')
def row(root,p):
 fence();s=os.lstat(p);r={'path':str(p.relative_to(root)),'identity':ident(s)}
 if stat.S_ISLNK(s.st_mode):
  target=os.readlink(p);assert ident(s)==ident(os.lstat(p));r.update(kind='symlink',literalTarget=target,literalTargetBytes=len(os.fsencode(target)),literalTargetSHA256=hashlib.sha256(os.fsencode(target)).hexdigest());return r
 if stat.S_ISDIR(s.st_mode):
  members=sorted(os.listdir(p));assert ident(s)==ident(os.lstat(p));r.update(kind='directory',members=members);return r
 assert stat.S_ISREG(s.st_mode) and s.st_nlink==1,str(p)
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  a=os.fstat(fd);assert ident(a)==ident(s);h=hashlib.sha256();n=0
  while block:=os.read(fd,1048576):fence();h.update(block);n+=len(block)
  assert n==a.st_size and ident(a)==ident(os.fstat(fd))==ident(os.lstat(p));r.update(kind='file',bytes=n,sha256=h.hexdigest());return r
 finally:os.close(fd)
def paths(root):
 for directory,dirs,files in os.walk(root,followlinks=False):
  dirs.sort();files.sort();p=Path(directory)
  if p!=root:yield p
  for name in dirs:
   q=p/name
   if q.is_symlink():yield q
  for name in files:
   q=p/name
   if q!=root/NAME:yield q

def seal(root,refs=()):
 assert root in (B,Q,T);p=root/NAME;fd=os.open(p,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600);created=os.fstat(fd);rootPRE=os.lstat(root);members=sorted(os.listdir(root));count=0;counts={'file':0,'directory':0,'symlink':0};byteTotal=0
 try:
  with os.fdopen(os.dup(fd),'wb') as target:
   with gzip.GzipFile(filename='',fileobj=target,mode='wb',mtime=0) as stream:
    header={'schema':'C7_OWN_CURRENT_LITERAL_STREAM_SEAL_V1','identitySchema':'FS_IDENTITY_DECIMAL_V1','status':'PARTIAL_NOT_QUALIFICATION','root':str(root),'rootIdentity':ident(rootPRE),'rootMembers':members,'exclusion':'ONLY_OWN_ROOT_'+NAME,'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'references':list(refs),'historicalCustody':'NO_RETROACTIVE_CLAIM','original122':'HELD','whole120':'UNEXECUTED_HELD'}
    raw=json.dumps(header,separators=(',',':')).encode();stream.write(raw[:-1]+b',"rows":[');comma=False
    for path in paths(root):
     r=row(root,path);payload=json.dumps(r,separators=(',',':')).encode();stream.write((b',' if comma else b'')+payload);comma=True;count+=1;counts[r['kind']]+=1;byteTotal+=r.get('bytes',0)
    stream.write(b'],"rowCount":'+str(count).encode()+b',"kindCounts":'+json.dumps(counts,separators=(',',':')).encode()+b',"fileBytes":'+str(byteTotal).encode()+b'}\n')
   target.flush();os.fsync(target.fileno())
  final=os.fstat(fd);assert final.st_dev==created.st_dev and final.st_ino==created.st_ino and final.st_nlink==1 and ident(final)==ident(os.lstat(p));assert ident(rootPRE)==ident(os.lstat(root)) and members==sorted(os.listdir(root))
 finally:os.close(fd)
 os.chmod(p,0o400);ref=row(root,p);ref['path']=str(p);ref.update(rowCount=count,kindCounts=counts,fileBytes=byteTotal,sealSchema='C7_OWN_CURRENT_LITERAL_STREAM_SEAL_V1');return ref

if __name__=='__main__':
 refs=[seal(B),seal(T)];q=seal(Q,refs);print(json.dumps({'scope':'STREAMING_OWN_PARTIAL_FREEZE_ONLY','elapsedSeconds':time.monotonic()-begin,'deadlineSeconds':120,'seals':[*refs,q],'rootApproval':'ABSENT_NOT_CREATED'},separators=(',',':')))
