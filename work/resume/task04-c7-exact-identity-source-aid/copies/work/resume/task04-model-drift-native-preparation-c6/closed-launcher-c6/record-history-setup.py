from pathlib import Path
import os,stat,json,hashlib,gzip,datetime,subprocess,importlib.util,sys,uuid
R=Path('/workspace/Project-Cortex');W=R/'work/resume/task04-model-drift-native-preparation-c6/closed-launcher-c6';T=Path('/dev/shm/cortex-native-c6-closed-launcher-c6');T.mkdir(parents=True,exist_ok=True,mode=0o700)
H=lambda b:hashlib.sha256(b).hexdigest();utc=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
def put(p,x):p.write_text(json.dumps(x,indent=2)+'\n')
def row(p,archive=False):
 s=p.lstat();assert stat.S_ISREG(s.st_mode) and s.st_nlink==1 and p.resolve()==p
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  a=os.fstat(fd);assert stat.S_ISREG(a.st_mode) and a.st_nlink==1;blocks=[]
  while True:
   x=os.read(fd,1048576)
   if not x:break
   blocks.append(x)
  identity=lambda z:tuple(getattr(z,'st_'+k) for k in ['dev','ino','mode','uid','nlink','size','mtime_ns','ctime_ns']);assert identity(s)==identity(a)==identity(os.fstat(fd))==identity(p.lstat());b=b''.join(blocks)
 finally:os.close(fd)
 d={'path':str(p),'bytes':len(b),'sha256':H(b),'identity':{k:getattr(s,'st_'+k) for k in ['dev','ino','mode','uid','nlink','size','mtime_ns','ctime_ns']}}
 if archive:
  target=T/'prebytes'/(H(b)+'.gz');target.parent.mkdir(exist_ok=True)
  if not target.exists():target.write_bytes(gzip.compress(b,mtime=0))
  encoded=target.read_bytes();assert gzip.decompress(encoded)==b;d.update(beforeByteBacking=str(target),encodedBytes=len(encoded),encodedSHA256=H(encoded),exactDecompressionVerified=True)
 return d

assert len(sys.argv)==1,'NO_ARBITRARY_ARGV'
run=T/'runs'/uuid.uuid4().hex;run.mkdir(parents=True)
files=set(W.glob('*.mjs'))|set(W.glob('*.py'))|set(W.glob('*.cjs'))|{p for p in W.glob('*.json')if p.name not in ['mirror-source-transform-map.json','synthetic-bootstrap.json']}
for x in json.loads((R/'work/resume/task04-model-drift-native-preparation-c5/closed-launcher-c2/bridge/mirror-source-transform-map.json').read_bytes())['inputs']:
 files.add(Path(x['source']))
q=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-model-drift-native-extra-preparation-c5'
for name,key in [('runner-dependency-inventory.json','inputs'),('toolchain-evidence.json','files')]:
 for x in json.loads((q/name).read_bytes())[key]:
  p=R/x['path']
  if p.is_file():files.add(p)
for kind in ['extension','regression','extra']:
 root=R/'_goals/convex-backend-runtime-2026-10-02/qa'/('task04-model-drift-native-'+kind+'-preparation-c5');files.add(root/'historical-preservation.json')
 for packet in json.loads((root/'historical-preservation.json').read_bytes())['packets']:
  files.add(R/packet['path']/packet['manifest'])
  if 'fullClosure' in packet:files.add(root/packet['fullClosure']['path'])
files.add(T/'original-read-map.json');files.add(R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-native-admission-fixture-c8/evidence/full-preservation01-failure/scripts--guard.mjs.text')
node=Path(sys.executable).resolve();files.add(node)
receipt={'utcPRE':utc(),'historicalCustody':'BROKEN: six prior incident receipts omitted C4 scratch; no continuity claim','internalCompilerServiceArgv':'NOT_CAPTURED by component recorder; real bridge pending','commands':[]}
pre=[row(p,True) for p in sorted(files)];put(run/'sourcePRE.json',pre)
spec=importlib.util.spec_from_file_location('owned_capture',W/'capture-originals.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
try:
 receipt['original8PRE']=module.capture('component-before')
 tmp=T/'child-tmp';tmp.mkdir(exist_ok=True);env={'PATH':str(node.parent)+':/usr/bin:/bin','TMPDIR':str(tmp)};receipt['environment']=env
 for name in ['prepare-history.py']:
  if not (W/name).exists():raise Exception('MISSING_FIXED_CONTROL')
  argv=[str(node),str(W/name)];command={'argv':argv,'cwd':str(R),'utcSourcePRE':utc(),'sourcePRE':[row(f,True)for f in sorted(files)],'utcStart':utc()};p=subprocess.run(argv,cwd=R,env=env,capture_output=True,timeout=120);command.update(utcEnd=utc(),exitCode=p.returncode,sourcePOST=[row(f)for f in sorted(files)]);(run/(name+'.stdout')).write_bytes(p.stdout);(run/(name+'.stderr')).write_bytes(p.stderr);receipt['commands'].append(command)
except BaseException as e:receipt['primaryFailure']={'type':type(e).__name__,'message':str(e)}
finally:
 try:receipt['original8POST']=module.capture('component-after')
 except BaseException as e:receipt['secondaryFailure']={'type':type(e).__name__,'message':str(e)}
 receipt['sourcePOST']=[row(p) for p in sorted(files)];receipt['utcPOST']=utc()
 if 'original8PRE' in receipt and 'original8POST' in receipt:
  a=json.loads(gzip.decompress(Path(receipt['original8PRE']['path']).read_bytes()));b=json.loads(gzip.decompress(Path(receipt['original8POST']['path']).read_bytes()));receipt['original8LiteralRowsAndIdentitiesEqual']=a['files']==b['files']
 receipt['sourceByteHashesEqual']=all(a['sha256']==b['sha256'] and a['bytes']==b['bytes'] for a,b in zip(pre,receipt['sourcePOST']));put(run/'receipt.json',receipt)
print(json.dumps({'run':str(run),'commands':[{'argv':c['argv'],'exitCode':c['exitCode']}for c in receipt['commands']],'primary':receipt.get('primaryFailure'),'secondary':receipt.get('secondaryFailure'),'sourceEqual':receipt.get('sourceByteHashesEqual'),'original8Equal':receipt.get('original8LiteralRowsAndIdentitiesEqual')}))
