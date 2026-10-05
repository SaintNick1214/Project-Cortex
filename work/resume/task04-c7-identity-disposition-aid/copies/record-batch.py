from fs_identity import loads as authority_loads
from fs_identity import fs_identity
from pathlib import Path
import signal,time,os,stat,json,hashlib,gzip,datetime,subprocess,importlib.util,sys,uuid
R=Path('/workspace/Project-Cortex');W=R/'work/resume/task04-c7-exact-identity-repair/candidate';T=Path('/dev/shm/cortex-native-c7-exact-identity-repair');T.mkdir(parents=True,exist_ok=True,mode=0o700)
H=lambda b:hashlib.sha256(b).hexdigest();utc=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
def put(p,x):p.write_text(json.dumps(x,indent=2)+'\n')
def memory_observation():
 return {'utc':utc(),**{n:Path('/sys/fs/cgroup',n).read_text() for n in ['memory.current','memory.max','memory.events','memory.stat']}}
def row(p,archive=False):
 s=p.lstat();assert stat.S_ISREG(s.st_mode) and s.st_nlink==1 and p.resolve()==p
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  a=os.fstat(fd);assert stat.S_ISREG(a.st_mode) and a.st_nlink==1;blocks=[]
  while True:
   x=os.read(fd,1048576)
   if not x:break
   blocks.append(x)
  identity=lambda z:tuple(getattr(z,'st_'+k) for k in ['dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns']);assert identity(s)==identity(a)==identity(os.fstat(fd))==identity(p.lstat());b=b''.join(blocks)
 finally:os.close(fd)
 d={'path':str(p),'bytes':len(b),'sha256':H(b),'identity':fs_identity(s)}
 if archive:
  target=T/'prebytes'/(H(b)+'.gz');target.parent.mkdir(exist_ok=True)
  if not target.exists():target.write_bytes(gzip.compress(b,mtime=0))
  encoded=target.read_bytes();assert gzip.decompress(encoded)==b;d.update(beforeByteBacking=str(target),encodedBytes=len(encoded),encodedSHA256=H(encoded),exactDecompressionVerified=True)
 return d

def process_rows():
 result={}
 for name in os.listdir('/proc'):
  if not name.isdigit():continue
  try:
   text=Path('/proc',name,'stat').read_text();f=text[text.rfind(')')+2:].split();cmd=Path('/proc',name,'cmdline').read_bytes()
  except FileNotFoundError:continue
  result[int(name)]={'pid':int(name),'ppid':int(f[1]),'pgid':int(f[2]),'state':f[0],'startTime':f[19],'argvHex':cmd.hex(),'argv':[x.decode(errors='replace')for x in cmd.split(b'\0')if x]}
 return result

def stop_owned_tree(process,initial):
 observations=[];errors=[];rows=process_rows();leader=rows.get(process.pid)
 if leader and leader['startTime']!=initial['startTime']:raise RuntimeError('OWN_RECORDER_PID_REUSED')
 owned={process.pid};changed=True
 while changed:
  changed=False
  for pid,r in rows.items():
   if r['ppid']in owned and pid not in owned:owned.add(pid);changed=True
 bindings={pid:rows[pid]for pid in owned if pid in rows};groups={r['pgid']for r in bindings.values()}
 for sig in [signal.SIGTERM,signal.SIGKILL]:
  current=process_rows();observations.append({'utc':utc(),'signal':sig.name,'rows':[current[p]for p in bindings if p in current]})
  for pgid in groups:
   members=[r for r in current.values()if r['pgid']==pgid and r['state']!='Z']
   try:
    if any(r['pid']not in bindings or r['startTime']!=bindings[r['pid']]['startTime']or r['argvHex']!=bindings[r['pid']]['argvHex']for r in members):raise RuntimeError('OWN_RECORDER_GROUP_BINDING')
    if members:os.killpg(pgid,sig)
   except BaseException as e:errors.append({'stage':'owned.group.'+sig.name,'type':type(e).__name__,'message':str(e)})
  time.sleep(.25)
 current=process_rows();live=[r for pid,r in current.items()if pid in bindings and r['startTime']==bindings[pid]['startTime']and r['state']!='Z'];observations.append({'utc':utc(),'remainingLive':live})
 return {'bindings':list(bindings.values()),'observations':observations,'complete':not live and not errors,'errors':errors}

assert len(sys.argv)==1,'NO_ARBITRARY_ARGV'
run=T/'runs'/uuid.uuid4().hex;run.mkdir(parents=True)
files=set(W.glob('*.mjs'))|set(W.glob('*.py'))|set(W.glob('*.cjs'))|{p for p in W.glob('*.json')if p.name!='synthetic-bootstrap.json'}
for x in authority_loads((W/'mirror-source-transform-map.json').read_bytes())['inputs']:
 files.add(Path(x['source']));files.add(Path(x['destination']))
for name in ['package-graph.json','original-read-map.json']:
 files.add(T/name)
 if name=='package-graph.json':
  for x in authority_loads((T/name).read_bytes())['files']:files.add(Path(x['path']))
for x in authority_loads((W/'prepared-source-inputs.json').read_bytes())['files']:files.add(Path(x['path']))
q=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-model-drift-native-extra-preparation-c5'
for name,key in [('runner-dependency-inventory.json','inputs'),('toolchain-evidence.json','files')]:
 for x in authority_loads((q/name).read_bytes())[key]:
  p=R/x['path']
  if p.is_file():files.add(p)
files.add(T/'historical-plan-index.json')
for v in authority_loads((T/'historical-plan-index.json').read_bytes())['perId'].values():files.add(Path(v['path']))
files.add(R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-native-admission-fixture-c8/evidence/full-preservation01-failure/scripts--guard.mjs.text')
files.add(R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-model-drift-native-extension-preparation-c4/c3-source-finding-map.json')
node=Path('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node');files.add(node)
receipt={'utcPRE':utc(),'historicalCustody':'BROKEN: six prior incident receipts omitted C4 scratch; no continuity claim','internalCompilerServiceArgv':'Recorded by recorded-esbuild.mjs in service-receipt.json; not whole122 composition acceptance','commands':[]}
receipt['memoryPRE']=memory_observation()
pre=[row(p,True) for p in sorted(files)];put(run/'sourcePRE.json',pre)
spec=importlib.util.spec_from_file_location('owned_capture',W/'capture-originals.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
try:
 receipt['original8PRE']=module.capture('component-before')
 tmp=T/'child-tmp';tmp.mkdir(exist_ok=True);env={'PATH':str(node.parent)+':/usr/bin:/bin','TMPDIR':str(tmp)};receipt['environment']=env
 for name in ['owner-loss-pre-signal-controls.mjs','root-delivery-controls.mjs','root-terminal-controls.mjs','vm-consumer-controls.mjs','external-seam-controls.mjs']:
  if not (W/name).exists():raise Exception('MISSING_FIXED_CONTROL')
  argv=[str(node),'--experimental-vm-modules',str(W/name)];command={'argv':argv,'cwd':str(R),'utcSourcePRE':utc(),'sourcePRE':[row(f,True)for f in sorted(files)],'utcStart':utc()};
  try:
   child=subprocess.Popen(argv,cwd=R,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True);initial=process_rows()[child.pid];command['ownedRecorderChild']=initial
   out,err=child.communicate(timeout=120);p=subprocess.CompletedProcess(argv,child.returncode,out,err)
  except subprocess.TimeoutExpired as failure:
   command['timeoutOwnershipCleanup']=stop_owned_tree(child,initial)
   try:out,err=child.communicate(timeout=5)
   except BaseException as delivery:out,err=failure.stdout or b'',failure.stderr or b'';command['timeoutRawDeliveryFailure']={'type':type(delivery).__name__,'message':str(delivery)}
   failure.stdout=out;failure.stderr=err;command['observedPostTimeoutTerminationExitCode']=child.returncode
   (run/(name+'.stdout')).write_bytes(failure.stdout or b'');(run/(name+'.stderr')).write_bytes(failure.stderr or b'');command.update(utcTimeoutObserved=utc(),exitCode=None,status='TIMEOUT_EXIT_NOT_CAPTURED',rawPartialOnly=True,sourcePOST=[row(f)for f in sorted(files)]);receipt['commands'].append(command);raise
  command.update(utcEnd=utc(),exitCode=p.returncode,sourcePOST=[row(f)for f in sorted(files)]);(run/(name+'.stdout')).write_bytes(p.stdout);(run/(name+'.stderr')).write_bytes(p.stderr);receipt['commands'].append(command)
except BaseException as e:receipt['primaryFailure']={'type':type(e).__name__,'message':str(e)}
finally:
 try:receipt['original8POST']=module.capture('component-after')
 except BaseException as e:receipt['secondaryFailure']={'type':type(e).__name__,'message':str(e)}
 receipt['memoryPOST']=memory_observation()
 receipt['sourcePOST']=[row(p) for p in sorted(files)];receipt['utcPOST']=utc()
 if 'original8PRE' in receipt and 'original8POST' in receipt:
  a=authority_loads(gzip.decompress(Path(receipt['original8PRE']['path']).read_bytes()));b=authority_loads(gzip.decompress(Path(receipt['original8POST']['path']).read_bytes()));receipt['original8LiteralRowsAndIdentitiesEqual']=a['files']==b['files']
 receipt['sourceByteHashesEqual']=all(a['sha256']==b['sha256'] and a['bytes']==b['bytes'] for a,b in zip(pre,receipt['sourcePOST']));put(run/'receipt.json',receipt)
print(json.dumps({'run':str(run),'commands':[{'argv':c['argv'],'exitCode':c['exitCode']}for c in receipt['commands']],'primary':receipt.get('primaryFailure'),'secondary':receipt.get('secondaryFailure'),'sourceEqual':receipt.get('sourceByteHashesEqual'),'original8Equal':receipt.get('original8LiteralRowsAndIdentitiesEqual')}))
