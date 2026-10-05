from pathlib import Path
import os,sys,json,gzip,hashlib,subprocess,datetime,time,signal,importlib.util
W=Path('/workspace/Project-Cortex/work/resume/task04-c7-exact-identity-repair');T=Path('/dev/shm/cortex-native-c7-exact-identity-repair');N=Path('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node');fields=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
phase=sys.argv[1]
if phase not in ['rebind','rebind2','rebind3','rebind3b','refresh-bindings','refresh-bindings2','refresh-bindings3','rebound-controls2','parser-controls','parser-controls2','rebound-controls']:raise ValueError('OWN_PHASE_ONLY')
out=T/('execution-'+phase);out.mkdir(mode=0o700,exist_ok=False)
def ident(s):return {'schema':'FS_IDENTITY_DECIMAL_V1','fields':{k:str(getattr(s,'st_'+k)) for k in fields}}
def utc():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def resources():return {p:Path('/sys/fs/cgroup/'+p).read_text() for p in ['memory.current','memory.max','memory.stat','memory.events']}
held=[]
def capture(p):
 p=Path(p);s=os.lstat(p);fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW);a=os.fstat(fd);assert s.st_nlink==1 and ident(s)==ident(a)
 h=hashlib.sha256();count=0;back=out/(str(len(held))+'.gz')
 with back.open('xb') as f:
  with gzip.GzipFile(fileobj=f,mode='wb',mtime=0) as compressed:
   while b:=os.read(fd,1048576):h.update(b);count+=len(b);compressed.write(b)
  f.flush();os.fsync(f.fileno())
 assert ident(a)==ident(os.fstat(fd))==ident(os.lstat(p)) and count==s.st_size
 eh=hashlib.sha256();encodedFd=os.open(back,os.O_RDONLY|os.O_NOFOLLOW);encodedPre=os.fstat(encodedFd)
 while block:=os.read(encodedFd,1048576):eh.update(block)
 assert ident(encodedPre)==ident(os.fstat(encodedFd))==ident(os.lstat(back));os.close(encodedFd)
 row={'path':str(p),'bytes':count,'sha256':h.hexdigest(),'identity':ident(a),'beforeByteBacking':{'path':str(back),'bytes':back.stat().st_size,'sha256':eh.hexdigest(),'identity':ident(encodedPre),'encoding':'GZIP_EXACT_PREIMAGE'}};held.append((fd,row));return row
isRebind=phase.startswith('rebind') and phase!='rebound-controls'
isPython=isRebind or phase.startswith('parser-controls') or phase.startswith('refresh-bindings')
sourcePaths=sorted(p for p in (W/'candidate').iterdir() if p.is_file() and p.suffix in ['.mjs','.cjs','.py'])+[W/('rebind.py' if isRebind else phase+'.py' if isPython else phase+'.mjs'),Path(__file__),N,Path(sys.executable).resolve()]
if isRebind or phase.startswith('refresh-bindings'):
 sourcePaths += [W/'stream_json.py']
 sqliteOrigin=importlib.util.find_spec('_sqlite3').origin
 if sqliteOrigin!='built-in':sourcePaths += [Path(sqliteOrigin)]
if phase.startswith('parser-controls'):sourcePaths += [W/'stream_json.py']
if phase=='refresh-bindings3':sourcePaths += [W/'raw_json_spans.py']
if phase.startswith('rebound-controls'):
 sourcePaths+=sorted(p for p in (W/'candidate').iterdir() if p.suffix=='.json')
 sourcePaths+=sorted(p for p in T.iterdir() if p.suffix=='.json')
preResources=resources();rows=[capture(p) for p in sourcePaths]
argv=[str(Path(sys.executable).resolve()),'-u',str(W/('rebind.py' if isRebind else phase+'.py'))] if isPython else [str(N),'--max-old-space-size=256','--experimental-vm-modules',str(W/(phase+'.mjs'))]
env={'PATH':str(N.parent)+':/usr/bin:/bin','TMPDIR':str(T/'tmp'),'PYTHONDONTWRITEBYTECODE':'1'};pre={'utc':utc(),'argv':argv,'cwd':str(W),'env':env,'sourceTools':rows,'resourcePRE':preResources,'deadlineSeconds':120,'phase':phase,'mutableOutputRole':'C7 prospective metadata outputs only; C6 immutable inputs unchanged' if isRebind else 'Owned controls output only'}
(W/(phase+'-PRE.json')).write_text(json.dumps(pre,indent=2)+'\n');started=utc();begin=time.monotonic();absoluteDeadline=begin+120;timeout=False;code=None
def safePid(x,zero=False):
 if type(x) is not int or x<0 or (not zero and x==0) or x>9007199254740991:raise ValueError('OWN_PID_SCHEMA')
 return x
def processRow(pid):
 safePid(pid);p=Path('/proc')/str(pid)/'stat';raw=p.read_bytes();text=raw.decode();fields=text[text.rindex(')')+2:].split();parsed=int(text.split(' ',1)[0]);ppid=safePid(int(fields[1]),True);pgid=safePid(int(fields[2]),True);start=fields[19]
 if not start.isdecimal() or (len(start)>1 and start.startswith('0')):raise ValueError('OWN_STARTTIME_SCHEMA')
 assert parsed==pid
 backing=out/('proc-'+str(pid)+'-'+hashlib.sha256(raw).hexdigest()+'.raw')
 if not backing.exists():backing.write_bytes(raw);os.chmod(backing,0o600)
 return {'pid':pid,'ppid':ppid,'pgid':pgid,'state':fields[0],'startTime':start,'raw':text,'rawBeforeByteBacking':{'path':str(backing),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'identity':ident(backing.stat())}}
owner=processRow(os.getpid())
def census(pgid):
 names=[n for n in os.listdir('/proc') if n.isdecimal()];assert len(names)<=4096;result=[]
 for n in names:
  try:
   text=(Path('/proc')/n/'stat').read_text();f=text[text.rindex(')')+2:].split()
   if safePid(int(f[2]),True)==pgid:result.append(processRow(safePid(int(n))))
  except (FileNotFoundError,ProcessLookupError):continue
 assert len(result)<=6
 return {'utc':utc(),'rows':result,'effectfulRows':[r for r in result if r['state']!='Z']}
with (W/(phase+'.stdout')).open('xb') as stdout,(W/(phase+'.stderr')).open('xb') as stderr:
 child=subprocess.Popen(argv,cwd=W,env=env,stdout=stdout,stderr=stderr,start_new_session=True)
 initial=processRow(safePid(child.pid));actualArgv=(Path('/proc')/str(child.pid)/'cmdline').read_bytes();actualArgvList=[x.decode() for x in actualArgv.rstrip(b'\0').split(b'\0')];assert initial['pid']==child.pid and initial['ppid']==owner['pid'] and initial['pgid']==child.pid and os.getpgid(child.pid)==child.pid and actualArgvList==argv
 groupBinding={'owner':owner,'initial':initial,'argv':actualArgvList,'rawArgvHex':actualArgv.hex(),'pgid':child.pid,'startTime':initial['startTime']}
 (W/(phase+'-group-PRE.json')).write_text(json.dumps(groupBinding,indent=2)+'\n')
 try:code=child.wait(timeout=max(0.001,absoluteDeadline-time.monotonic()))
 except subprocess.TimeoutExpired:
  timeout=True;os.killpg(child.pid,signal.SIGTERM)
  try:code=child.wait(timeout=1)
  except subprocess.TimeoutExpired:os.killpg(child.pid,signal.SIGKILL);code=child.wait(timeout=5)
 finalCensus=census(child.pid);leader=next((r for r in finalCensus['rows'] if r['pid']==child.pid),None)
 if leader and leader['startTime']!=initial['startTime']:raise RuntimeError('OWN_GROUP_REUSED')
 groupEmpty=not finalCensus['effectfulRows']
 if not groupEmpty:os.killpg(child.pid,signal.SIGKILL)
post=[]
for fd,row in held:
 a=os.fstat(fd);os.lseek(fd,0,os.SEEK_SET);h=hashlib.sha256();count=0
 while b:=os.read(fd,1048576):h.update(b);count+=len(b)
 z=os.fstat(fd);p=os.lstat(row['path']);post.append({'path':row['path'],'identity':ident(a),'bytes':count,'sha256':h.hexdigest(),'equal':row['identity']==ident(a)==ident(z)==ident(p) and count==row['bytes'] and h.hexdigest()==row['sha256']});os.close(fd)
raws=[]
for p in [W/(phase+'.stdout'),W/(phase+'.stderr')]:
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW);a=os.fstat(fd);h=hashlib.sha256();size=0
 while block:=os.read(fd,1048576):h.update(block);size+=len(block)
 assert ident(a)==ident(os.fstat(fd))==ident(os.lstat(p));os.close(fd);raws.append({'path':str(p),'bytes':size,'sha256':h.hexdigest(),'identity':ident(a)})
receipt={'utcStart':started,'utcEnd':utc(),'argv':argv,'cwd':str(W),'env':env,'phase':phase,'elapsedSeconds':time.monotonic()-begin,'deadlineSeconds':120,'absoluteMonotonicDeadline':absoluteDeadline,'actualExit':code,'signal':-code if code is not None and code<0 else None,'timeout':timeout,'groupEmpty':groupEmpty,'groupBinding':groupBinding,'finalGroupCensus':finalCensus,'sourceToolPOST':post,'sourceToolsExactEqual':all(r['equal'] for r in post),'raws':raws,'resourcePOST':resources(),'original122':'HELD','originalWhole120':'UNEXECUTED_HELD','rootApproval':'ABSENT_NOT_CREATED'}
(W/(phase+'-receipt.json')).write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps({k:v for k,v in receipt.items() if k not in ['sourceToolPOST','resourcePOST']}))
