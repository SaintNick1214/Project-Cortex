from pathlib import Path
import os,sys,json,hashlib,gzip,subprocess,datetime,time,signal,ast
W=Path('/workspace/Project-Cortex/work/resume/task04-c7-exact-identity-repair')
T=Path('/dev/shm/cortex-native-c7-exact-identity-repair')
N=Path('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node')
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def identity(s):return {'schema':'FS_IDENTITY_DECIMAL_V1','fields':{k:str(getattr(s,'st_'+k)) for k in FIELDS}}
def utc():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def resources():return {p:Path('/sys/fs/cgroup/'+p).read_text() for p in ['memory.current','memory.max','memory.stat','memory.events']}
back=T/'execution-prebytes';back.mkdir(mode=0o700,exist_ok=False)
fixture=T/'fixture';fixture.mkdir(mode=0o700,exist_ok=False)
(fixture/'one').write_bytes(b'owned fixture\n');os.chmod(fixture/'one',0o600)
(T/'consumed-prebytes').mkdir(mode=0o700,exist_ok=False)
(T/'tmp').mkdir(mode=0o700,exist_ok=False)
held=[]
def capture(p):
 p=Path(p);s=os.lstat(p);fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW);a=os.fstat(fd)
 if identity(s)!=identity(a) or s.st_nlink!=1:raise RuntimeError('OWN_SOURCE_BINDING')
 h=hashlib.sha256();size=0;tmp=back/(str(len(held))+'.gz')
 with tmp.open('xb') as out:
  with gzip.GzipFile(fileobj=out,mode='wb',mtime=0) as encoded:
   while True:
    b=os.read(fd,1048576)
    if not b:break
    h.update(b);size+=len(b);encoded.write(b)
  out.flush();os.fsync(out.fileno())
 if identity(a)!=identity(os.fstat(fd)) or identity(a)!=identity(os.lstat(p)) or size!=s.st_size:raise RuntimeError('OWN_SOURCE_DRIFT')
 digest=h.hexdigest();eh=hashlib.sha256()
 with tmp.open('rb') as f:
  while b:=f.read(1048576):eh.update(b)
 row={'path':str(p),'identity':identity(a),'bytes':size,'sha256':digest,'beforeByteBacking':{'path':str(tmp),'sha256':eh.hexdigest(),'bytes':tmp.stat().st_size,'encoding':'GZIP_EXACT_PREIMAGE'}}
 held.append((fd,row));return row
before=resources();paths=sorted(p for p in (W/'candidate').iterdir() if p.is_file())+[W/'controls.mjs',Path(__file__),N,Path(sys.executable).resolve()]
rows=[capture(p) for p in paths]
for p in (W/'candidate').glob('*.py'):ast.parse(p.read_text(),filename=str(p))
argv=[str(N),'--max-old-space-size=64','--experimental-vm-modules',str(W/'controls.mjs')]
pre={'utc':utc(),'scope':'NEW_SOURCE_PREFLIGHT_ONLY_NO_ORIGINAL_OR_ROOT_ROUTE','sourceTools':rows,'fixturePRE':capture(fixture/'one'),'argv':argv,'cwd':str(W),'env':{'PATH':str(N.parent)+':/usr/bin:/bin','TMPDIR':str(T/'tmp')},'resourcePRE':before,'deadlineSeconds':90}
(W/'controls-PRE.json').write_text(json.dumps(pre,indent=2)+'\n')
started=utc();begin=time.monotonic();absolute=begin+90;timed=False;code=None;sig=None
with (W/'controls.stdout').open('xb') as stdout,(W/'controls.stderr').open('xb') as stderr:
 child=subprocess.Popen(argv,cwd=W,env=pre['env'],stdout=stdout,stderr=stderr,start_new_session=True)
 try:code=child.wait(timeout=max(0.001,absolute-time.monotonic()))
 except subprocess.TimeoutExpired:
  timed=True;os.killpg(child.pid,signal.SIGTERM)
  try:code=child.wait(timeout=1)
  except subprocess.TimeoutExpired:os.killpg(child.pid,signal.SIGKILL);code=child.wait(timeout=5)
 finally:
  try:os.killpg(child.pid,0);groupEmpty=False;os.killpg(child.pid,signal.SIGKILL)
  except ProcessLookupError:groupEmpty=True
post=[]
for fd,row in held:
 if row['path']==str(fixture/'one'):os.close(fd);continue
 a=os.fstat(fd);os.lseek(fd,0,os.SEEK_SET);h=hashlib.sha256();n=0
 while b:=os.read(fd,1048576):h.update(b);n+=len(b)
 z=os.fstat(fd);p=os.lstat(row['path']);post.append({'path':row['path'],'identity':identity(a),'bytes':n,'sha256':h.hexdigest(),'equal':identity(a)==row['identity']==identity(z)==identity(p) and n==row['bytes'] and h.hexdigest()==row['sha256']});os.close(fd)
raws=[]
for p in [W/'controls.stdout',W/'controls.stderr']:raws.append({'path':str(p),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
receipt={'utcStart':started,'utcEnd':utc(),'argv':argv,'cwd':str(W),'env':pre['env'],'elapsedSeconds':time.monotonic()-begin,'deadlineSeconds':90,'actualExit':code,'signal':-code if code is not None and code<0 else None,'timeout':timed,'groupEmpty':groupEmpty,'raws':raws,'sourceToolPOST':post,'sourceToolsExactEqual':all(r['equal'] for r in post),'resourcePOST':resources(),'fixturePOST':{'identity':identity(os.lstat(fixture/'one'))},'original122':'HELD','whole120':'UNEXECUTED_HELD','rootApproval':'ABSENT_NOT_CREATED'}
(W/'controls-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({'actualExit':code,'timeout':timed,'groupEmpty':groupEmpty,'sourceToolsExactEqual':receipt['sourceToolsExactEqual'],'raws':raws}))
